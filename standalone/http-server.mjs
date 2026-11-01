import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { nodeStore } from './store.mjs';
import { accountService,AccountError } from './accounts.mjs';
import { handleApi,MAX_BACKUP } from '../core/cms.mjs';
import { normalizeDirectory,resolvePrincipal,capabilities,can } from '../core/directory.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const cookieValue=(header,name)=>{const match=(header??'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));return match?.slice(name.length+1);};
export async function startServer(options={}) {
  const localPreview=options.localPreview??process.argv.includes('--local-preview');
  const localAccounts=options.localAccounts??process.argv.includes('--local-accounts');
  const local=localPreview||localAccounts;
  const host=options.host??process.env.CMS_HOST??'127.0.0.1';
  const operatorKey=options.token??process.env.CMS_ADMIN_TOKEN;
  if(local&&!['127.0.0.1','::1'].includes(host))throw new Error('Lokale Betriebsarten sind ausschließlich an Loopback erlaubt.');
  const configuredOrigin=options.origin??process.env.CMS_ORIGIN;
  if(!local&&(!configuredOrigin||!configuredOrigin.startsWith('https://')))throw new Error('CMS_ORIGIN mit externer HTTPS-Adresse setzen.');
  if(!local&&(!operatorKey||operatorKey.length<32))throw new Error('CMS_ADMIN_TOKEN mit mindestens 32 Zeichen setzen.');
  const store=await nodeStore(options.directory??process.env.CMS_DATA_DIR??path.resolve('data'));
  const auth=await accountService(store,{...(options.clock?{clock:options.clock}:{})});
  const operators=new Map(),operatorAttempts=new Map();
  const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png','.html':'text/html; charset=utf-8'};
  const clientRoutes=new Set(['/','/anmelden','/konto-aktivieren','/passwort-zuruecksetzen','/konto/passwort','/lehrkraefte','/schueler','/verwaltung','/werkstatt','/betrieb']);
  const server=http.createServer(async(req,res)=>{
    let origin;
    try {
      const port=server.address().port;
      origin=local?`http://${host==='::1'?'[::1]':host}:${port}`:configuredOrigin;
      if(local&&req.headers.host!==new URL(origin).host){res.writeHead(403);return res.end('Host nicht erlaubt.');}
      const url=new URL(req.url,origin);if(url.origin!==origin){res.writeHead(403);return res.end('Origin nicht erlaubt.');}
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      if(url.pathname==='/healthz'){res.writeHead(200,{'content-type':'application/json'});return res.end('{"status":"ok","version":"0.3.0"}');}
      const chunks=[];let size=0;const max=url.pathname.startsWith('/auth/')||url.pathname==='/login'?16384:MAX_BACKUP;
      for await(const chunk of req){size+=chunk.length;if(size>max){res.writeHead(413);res.end('Anfrage zu groß.');return;}chunks.push(chunk);}
      const body=Buffer.concat(chunks),method=req.method??'GET',isWrite=!['GET','HEAD'].includes(method);
      const requireOrigin=()=>{if(req.headers.origin!==origin)throw new AccountError('Anfrage stammt nicht aus dieser Anwendung.',403);};
      const getJson=()=>{try{const p=JSON.parse(body.toString('utf8'));if(!p||typeof p!=='object'||Array.isArray(p))throw new Error();return p;}catch{throw new AccountError('Ungültige Anfrage.');}};
      const secure=!local,sessionName=secure?'__Host-bsvg_session':'bsvg_session',operatorName=secure?'__Host-bsvg_operator':'bsvg_operator';
      const setCookie=(name,value,maxAge=28800)=>`${name}=${value}; HttpOnly; ${secure?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=${maxAge}`;
      const send=async(result)=>{res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));};
      const sessionToken=cookieValue(req.headers.cookie,sessionName);
      const accountActor=auth.resolve(sessionToken);
      const operatorToken=cookieValue(req.headers.cookie,operatorName);
      const operatorValid=operatorToken&&(operators.get(operatorToken)??0)>Date.now();
      const requestedWorkshop=req.headers['x-bsvg-workshop']==='operator';
      const workshop=(requestedWorkshop&&localPreview)||operatorValid;
      const actor=requestedWorkshop&&workshop?{kind:'workshop',subject:'standalone-operator'}:accountActor??(operatorValid?{kind:'workshop',subject:'standalone-operator'}:null);
      if(url.pathname==='/login'&&method==='POST') {
        requireOrigin();const ip=req.socket.remoteAddress??'unknown',attempt=operatorAttempts.get(ip)??{count:0,until:Date.now()+15*60*1000};
        if(attempt.until<Date.now()){attempt.count=0;attempt.until=Date.now()+15*60*1000;}
        if(attempt.count>=10)throw new AccountError('Bitte später erneut versuchen.',429);
        const supplied=new URLSearchParams(body.toString()).get('token')??'',a=Buffer.from(supplied),b=Buffer.from(operatorKey??'');
        if(!operatorKey||a.length!==b.length||!timingSafeEqual(a,b)){attempt.count++;operatorAttempts.set(ip,attempt);throw new AccountError('Zugang abgelehnt.',401);}
        for(const[id,expiry]of operators)if(expiry<=Date.now())operators.delete(id);
        if(operators.size>=1000)throw new AccountError('Zu viele Testsitzungen.',503);
        operatorAttempts.delete(ip);const token=randomBytes(32).toString('hex');operators.set(token,Date.now()+4*60*60*1000);
        res.writeHead(303,{location:'/werkstatt','set-cookie':setCookie(operatorName,token,14400)});return res.end();
      }
      if(url.pathname==='/login'&&method==='GET'){res.writeHead(303,{location:'/betrieb'});return res.end();}
      if(url.pathname==='/api/public'&&method==='GET') {
        const row=await store.read();const posts=(row?.data.posts??[]).filter(p=>p.audience==='website'&&p.status==='published'&&!p.classId).map(({id,title,excerpt,body,site,updatedAt})=>({id,title,excerpt,body,site,updatedAt}));return send(json({posts}));
      }
      if(url.pathname==='/auth/session'&&method==='GET') {
        const requested=url.searchParams.get('workshop')==='1';
        const identity=requested&&(localPreview||operatorValid)?{kind:'workshop',subject:'standalone-operator'}:accountActor;
        if(!identity)return send(json({authenticated:false,localPreview},401));
        const row=await store.read();const data=normalizeDirectory(row?.data??{posts:[],files:[],activity:[]});const principal=resolvePrincipal(data,identity);
        return send(json({authenticated:true,workshop:principal.workshop,name:principal.user?.name??'Lokaler Betreiber',email:principal.user?.email??null,capabilities:capabilities(data,principal),localPreview}));
      }
      if(url.pathname.startsWith('/auth/')) {
        if(isWrite)requireOrigin();
        const ip=req.socket.remoteAddress??'unknown';
        if(url.pathname==='/auth/login'&&method==='POST') {
          const input=getJson();const login=await auth.login(input.email,input.password,ip);
          const row=await store.read(),u=row?.data.directory.users.find(u=>u.id===login.userId);
          const teacher=u.roles.includes('teacher')||u.roles.includes('editor')||u.roles.includes('admin');
          const destination=teacher?'/lehrkraefte':'/schueler';
          res.setHeader('Set-Cookie',setCookie(sessionName,login.token));return send(json({ok:true,destination}));
        }
        if(url.pathname==='/auth/consume'&&method==='POST') {auth.rate('consume:'+ip,20);const p=getJson();return send(json(await auth.consume(p.token,p.password)));}
        if(url.pathname==='/auth/logout'&&method==='POST') {auth.logout(sessionToken);if(operatorToken)operators.delete(operatorToken);res.setHeader('Set-Cookie',[setCookie(sessionName,'',0),setCookie(operatorName,'',0)]);return send(json({ok:true}));}
        if(url.pathname==='/auth/password/change'&&method==='POST') {
          if(!accountActor)throw new AccountError('Bitte anmelden.',401);auth.rate('change:'+accountActor.userId,5);
          const p=getJson(),result=await auth.change(accountActor.userId,p.currentPassword,p.password);res.setHeader('Set-Cookie',setCookie(sessionName,'',0));return send(json(result));
        }
        if(url.pathname==='/auth/admin/links'&&method==='POST') {
          if(!actor)throw new AccountError('Bitte anmelden.',401);
          const row=await store.read();const data=normalizeDirectory(row?.data??{posts:[],files:[],activity:[]});const principal=resolvePrincipal(data,actor);
          if(!can(principal,'directory:manage'))throw new AccountError('Nur die Administration darf Kontolinks freigeben.',403);
          auth.rate('issue:'+principal.id,30);const input=getJson(),result=await auth.issue(input.userId,input.purpose);
          return send(json({email:result.email,purpose:result.purpose,expiresAt:result.expiresAt,delivery:result.delivery,emailVerified:false,url:`${origin}/${result.purpose==='activation'?'konto-aktivieren':'passwort-zuruecksetzen'}#token=${result.token}`}));
        }
        return send(json({error:'Anmelde-Endpunkt nicht gefunden.'},404));
      }
      if(url.pathname.startsWith('/api/')) {
        if(!actor)return send(json({error:'Bitte anmelden.'},401));
        const before=isWrite?(await store.read())?.data:null;
        const request=new Request(url,{method,headers:req.headers,...(['GET','HEAD'].includes(method)?{}:{body})});
        const result=await handleApi(request,store,actor);
        if(result.ok&&isWrite){if(url.pathname==='/api/restore')auth.revokeAll();auth.reconcile(before,(await store.read())?.data);}
        return send(result);
      }
      if(!['GET','HEAD'].includes(method)){res.writeHead(405);return res.end();}
      if(['/lehrkraefte','/schueler','/verwaltung','/konto/passwort'].includes(url.pathname)) {
        if(!accountActor){res.writeHead(303,{location:'/anmelden'});return res.end();}
        const row=await store.read(),principal=resolvePrincipal(normalizeDirectory(row.data),accountActor);
        if(url.pathname==='/lehrkraefte'&&!can(principal,'staff:read')||url.pathname==='/schueler'&&!principal.roles.includes('student')||url.pathname==='/verwaltung'&&!can(principal,'directory:manage')&&!can(principal,'content:manage')){res.writeHead(403);return res.end('Keine Berechtigung für diesen Bereich.');}
      }
      if(url.pathname==='/werkstatt'&&!localPreview&&!operatorValid){res.writeHead(303,{location:'/betrieb'});return res.end();}
      const root=path.resolve('standalone-dist');let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{res.writeHead(400);return res.end();}
      const target=path.resolve(root,clientRoutes.has(decoded)?'standalone/index.html':`.${decoded}`);
      if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
      try{const data=await readFile(target);res.writeHead(200,{'content-type':mime[path.extname(target)]??'application/octet-stream'});res.end(method==='HEAD'?undefined:data);}catch(e){if(e.code!=='ENOENT')throw e;res.writeHead(404);res.end('Nicht gefunden.');}
    } catch(e) {
      const status=e instanceof AccountError||typeof e?.status==='number'?e.status:500;
      if(!res.headersSent)res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      res.end(JSON.stringify({error:status===500?'Der Vorgang konnte nicht abgeschlossen werden.':e.message}));
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(options.port??Number(process.env.PORT??3100),host,resolve);});
  return {server,store,auth,close:async()=>{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));store.close();}};
}
