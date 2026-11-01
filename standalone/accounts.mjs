import { randomBytes,createHash,scrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive=promisify(scrypt),N=131072,r=8,p=1;
const opaque=()=>randomBytes(32).toString('base64url');
const digest=s=>createHash('sha256').update(s).digest('hex');
const validToken=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s);
export class AccountError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const check=(ok,message,status=400)=>{if(!ok)throw new AccountError(message,status);};
export function passwordPolicy(password) {
  check(typeof password==='string'&&[...password].length>=15&&[...password].length<=128&&Buffer.byteLength(password)<=512,'Bitte ein Passwort mit 15 bis 128 Zeichen verwenden.');
  check(!['passwordpassword','passwortpasswort','123456789012345','abcdefghijklmnop','qwertyuiopasdfgh'].includes(password.toLowerCase()),'Bitte ein weniger vorhersehbares Passwort wählen.');
}
// Node/OpenSSL scrypt; keine selbst entwickelte Kryptografie. Aufwand gemäß OWASP.
let hashesRunning=0;
async function hashWork(password,salt) {
  if(hashesRunning>=2)throw new AccountError('Die Anmeldung ist ausgelastet. Bitte erneut versuchen.',503);
  hashesRunning++;try{return await derive(password,salt,64,{N,r,p,maxmem:256*1024*1024});}finally{hashesRunning--;}
}
export async function hashPassword(password) {
  passwordPolicy(password);const salt=randomBytes(16);const hash=await hashWork(password,salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}
async function verifyPassword(password,encoded) {
  if(typeof password!=='string'||Buffer.byteLength(password)>512)return false;
  const parts=encoded.split('$');
  if(parts.length!==6||parts[0]!=='scrypt'||Number(parts[1])!==N||Number(parts[2])!==r||Number(parts[3])!==p)return false;
  const salt=Buffer.from(parts[4],'base64url'),expected=Buffer.from(parts[5],'base64url');
  if(salt.length!==16||expected.length!==64)return false;
  const actual=await hashWork(password,salt);return timingSafeEqual(actual,expected);
}
export async function accountService(store,{clock=()=>Date.now()}={}) {
  const db=store.database;
  db.exec(`CREATE TABLE IF NOT EXISTS auth_credentials(user_id TEXT PRIMARY KEY,email TEXT NOT NULL,password_hash TEXT NOT NULL,version TEXT NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_tokens(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,email TEXT NOT NULL,purpose TEXT NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,version TEXT NOT NULL,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens(user_id);
    CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id);`);
  // Nach einem Server-Neustart erneut anmelden. Kennwörter und Einmallinks bleiben erhalten.
  db.exec('DELETE FROM auth_sessions');
  const dummy=await hashPassword(opaque());
  const limits=new Map();
  const current=()=>{const row=db.prepare('SELECT revision,payload FROM cms_state WHERE id=?').get('school');return row?{revision:Number(row.revision),data:JSON.parse(row.payload)}:null;};
  const userFor=id=>current()?.data.directory?.users.find(u=>u.id===id);
  const credential=id=>db.prepare('SELECT * FROM auth_credentials WHERE user_id=?').get(id);
  function audit(row,message){row.data.activity.unshift({id:crypto.randomUUID(),at:new Date(clock()).toISOString(),actor:'account-service',text:message});row.data.activity=row.data.activity.slice(0,30);}
  function saveState(row){const result=db.prepare('UPDATE cms_state SET revision=revision+1,payload=? WHERE id=? AND revision=?').run(JSON.stringify(row.data),'school',row.revision);check(result.changes===1,'Datenstand wurde geändert. Bitte erneut versuchen.',409);}
  function transaction(f){db.exec('BEGIN IMMEDIATE');try{const result=f();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
  function rate(key,max,windowMs=15*60*1000) {
    const t=clock();let entry=limits.get(key);
    if(!entry||entry.until<=t){entry={count:0,until:t+windowMs};limits.set(key,entry);}
    if(limits.size>10000){for(const[k,v]of limits)if(v.until<=t)limits.delete(k);check(limits.size<=10000,'Bitte später erneut versuchen.',429);}
    check(entry.count<max,'Zu viele Versuche. Bitte später erneut versuchen.',429);entry.count++;
  }
  function revokeUser(id){db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(id);db.prepare('DELETE FROM auth_tokens WHERE user_id=?').run(id);}
  return {
    rate,
    async issue(userId,purpose) {
      check(['activation','reset'].includes(purpose),'Ungültiger Linktyp.');
      const user=userFor(userId),cred=credential(userId);
      check(user&&user.status!=='disabled','Konto nicht verfügbar.');
      if(purpose==='activation')check(user.status==='pending'||!cred||cred.email!==user.email,'Dieses Konto ist bereits aktiviert.');
      else check(user.status==='active'&&cred&&cred.email===user.email,'Für dieses Konto ist noch keine Wiederherstellung möglich.');
      const token=opaque(),expires=clock()+(purpose==='activation'?24*60*60*1000:30*60*1000);
      transaction(()=>{db.prepare('DELETE FROM auth_tokens WHERE user_id=?').run(user.id);db.prepare('INSERT INTO auth_tokens VALUES(?,?,?,?,?)').run(digest(token),user.id,user.email,purpose,expires);});
      return {token,email:user.email,purpose,expiresAt:new Date(expires).toISOString(),delivery:'manual',emailVerified:false};
    },
    async consume(token,password) {
      check(validToken(token),'Dieser Link ist ungültig oder abgelaufen.');
      const ticket=db.prepare('SELECT * FROM auth_tokens WHERE token_hash=?').get(digest(token));
      check(ticket&&ticket.expires_at>clock(),'Dieser Link ist ungültig oder abgelaufen.');
      const user=userFor(ticket.user_id);check(user&&user.status!=='disabled'&&user.email===ticket.email,'Dieser Link ist ungültig oder abgelaufen.');
      const hash=await hashPassword(password);
      return transaction(()=>{
        const fresh=db.prepare('SELECT * FROM auth_tokens WHERE token_hash=?').get(digest(token));
        check(fresh&&fresh.expires_at>clock(),'Dieser Link ist ungültig oder bereits verwendet.');
        const row=current(),u=row?.data.directory.users.find(u=>u.id===fresh.user_id);
        check(u&&u.status!=='disabled'&&u.email===fresh.email,'Dieser Link ist nicht mehr gültig.');
        if(fresh.purpose==='activation')check(u.status==='pending'||!credential(u.id)||credential(u.id).email!==u.email,'Konto wurde bereits aktiviert.');
        else check(u.status==='active','Konto ist nicht aktiv.');
        db.prepare('INSERT INTO auth_credentials VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash,version=excluded.version,updated_at=excluded.updated_at').run(u.id,u.email,hash,opaque(),clock());
        u.status='active';u.updatedAt=new Date(clock()).toISOString();audit(row,fresh.purpose==='activation'?'CMS-Konto durch freigegebenen Einmallink aktiviert':'CMS-Passwort zurückgesetzt');saveState(row);revokeUser(u.id);
        return {ok:true,purpose:fresh.purpose};
      });
    },
    async login(email,password,ip='unknown') {
      const normalized=typeof email==='string'?email.trim().toLowerCase():'';
      rate('ip:'+ip,100);rate('account:'+digest(normalized.slice(0,254)),10);
      const user=current()?.data.directory?.users.find(u=>u.email===normalized);
      const cred=user?credential(user.id):null;
      const eligible=user?.status==='active'&&cred?.email===user.email;
      const match=await verifyPassword(password,eligible?cred.password_hash:dummy);
      check(eligible&&match,'E-Mail-Adresse oder Passwort ist nicht korrekt.',401);
      // Status und Kennwortversion nach der teuren Prüfung erneut lesen.
      check(userFor(user.id)?.status==='active'&&credential(user.id)?.version===cred.version&&userFor(user.id)?.email===cred.email,'E-Mail-Adresse oder Passwort ist nicht korrekt.',401);
      limits.delete('account:'+digest(normalized.slice(0,254)));
      const token=opaque();db.prepare('DELETE FROM auth_sessions WHERE created_at<? OR last_seen<?').run(clock()-8*60*60*1000,clock()-30*60*1000);
      db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?)').run(digest(token),user.id,cred.version,clock(),clock());
      return {token,userId:user.id};
    },
    resolve(token) {
      if(!validToken(token))return null;
      const session=db.prepare('SELECT * FROM auth_sessions WHERE token_hash=?').get(digest(token));
      if(!session)return null;
      const user=userFor(session.user_id),cred=credential(session.user_id);
      if(clock()-session.created_at>=8*60*60*1000||clock()-session.last_seen>=30*60*1000||user?.status!=='active'||!cred||cred.email!==user.email||cred.version!==session.version){db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token));return null;}
      db.prepare('UPDATE auth_sessions SET last_seen=? WHERE token_hash=?').run(clock(),digest(token));return {kind:'cms',userId:user.id};
    },
    logout(token){if(validToken(token))db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(digest(token));},
    async change(userId,currentPassword,newPassword) {
      const user=userFor(userId),cred=credential(userId);check(user?.status==='active'&&cred?.email===user.email,'Bitte erneut anmelden.',401);
      check(await verifyPassword(currentPassword,cred.password_hash),'Das aktuelle Passwort ist nicht korrekt.',401);
      const hash=await hashPassword(newPassword);
      transaction(()=>{check(userFor(userId)?.status==='active'&&credential(userId)?.version===cred.version,'Konto wurde inzwischen geändert.',409);db.prepare('UPDATE auth_credentials SET password_hash=?,version=?,updated_at=? WHERE user_id=?').run(hash,opaque(),clock(),userId);revokeUser(userId);});
      return {ok:true};
    },
    revokeAll(){db.exec('DELETE FROM auth_sessions; DELETE FROM auth_tokens;');},
    reconcile(before,after) {
      for(const u of before?.directory?.users??[]){const next=after?.directory?.users.find(n=>n.id===u.id);if(!next||next.status!==u.status||next.email!==u.email||JSON.stringify(next.roles)!==JSON.stringify(u.roles))revokeUser(u.id);}
    },
  };
}
