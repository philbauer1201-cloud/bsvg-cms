import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,cp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {nodeStore} from '../standalone/store.mjs';
import {accountService} from '../standalone/accounts.mjs';
import {startServer} from '../standalone/server.mjs';
import {handleApi} from '../core/cms.mjs';
const owner={kind:'workshop',subject:'test-operator'},origin='https://cms.test';
const password='Lange Testpassphrase nur fuer Tests '+randomBytes(6).toString('hex');
const nextPassword=password+' neu';
const request=(url,method='GET',body)=>new Request(origin+url,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function seed(store){for(const[email,roles]of[['teacher@example.test',['admin','teacher']],['student@example.test',['student']]])assert.equal((await handleApi(request('/api/users','POST',{email,roles}),store,owner)).status,201);return(await store.read()).data.directory.users;}
test('Einmallinks, Passwort-Hashes, Wiederherstellung und Sitzungswiderruf funktionieren ohne automatische E-Mail-Verifikation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'bsvg-auth-'));const store=await nodeStore(dir);let time=Date.now();
  try{
    const[teacher,student]=await seed(store),auth=await accountService(store,{clock:()=>time});
    await assert.rejects(()=>auth.login(teacher.email,password),e=>e.status===401);
    const old=await auth.issue(teacher.id,'activation'),link=await auth.issue(teacher.id,'activation');assert.equal(link.emailVerified,false);assert.equal(link.delivery,'manual');
    await assert.rejects(()=>auth.consume(old.token,password));
    await assert.rejects(()=>auth.consume(link.token,'kurz'));
    assert.equal((await auth.consume(link.token,password)).ok,true);
    await assert.rejects(()=>auth.consume(link.token,password));
    const cred=store.database.prepare('SELECT * FROM auth_credentials WHERE user_id=?').get(teacher.id);assert.match(cred.password_hash,/^scrypt\$131072\$8\$1\$/);assert(!cred.password_hash.includes(password));
    const login=await auth.login(teacher.email,password);assert.equal(auth.resolve(login.token).userId,teacher.id);
    const saved=store.database.prepare('SELECT token_hash FROM auth_sessions').get();assert.notEqual(saved.token_hash,login.token);
    await assert.rejects(()=>auth.login(teacher.email,'falsches Kennwort'),e=>e.status===401);
    const reset=await auth.issue(teacher.id,'reset');time+=31*60*1000;await assert.rejects(()=>auth.consume(reset.token,nextPassword));
    const reset2=await auth.issue(teacher.id,'reset');await auth.consume(reset2.token,nextPassword);assert.equal(auth.resolve(login.token),null);
    await assert.rejects(()=>auth.login(teacher.email,password),e=>e.status===401);
    const login2=await auth.login(teacher.email,nextPassword);await assert.rejects(()=>auth.change(teacher.id,'falsch',password),e=>e.status===401);
    await auth.change(teacher.id,nextPassword,password);assert.equal(auth.resolve(login2.token),null);
    const login3=await auth.login(teacher.email,password);time+=30*60*1000+1;assert.equal(auth.resolve(login3.token),null);
    const studentLink=await auth.issue(student.id,'activation');const row=await store.read();row.data.directory.users.find(u=>u.id===student.id).email='changed@example.test';await store.write(row.revision,row.data);
    await assert.rejects(()=>auth.consume(studentLink.token,password));
    const login4=await auth.login(teacher.email,password);const row2=await store.read();row2.data.directory.users.find(u=>u.id===teacher.id).status='disabled';await store.write(row2.revision,row2.data);assert.equal(auth.resolve(login4.token),null);
    await assert.rejects(()=>auth.issue(teacher.id,'reset'));
    const tokens=store.database.prepare('SELECT token_hash FROM auth_tokens').all();assert(!tokens.some(t=>t.token_hash===studentLink.token));
  }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
test('Vollständiges gestopptes Datenverzeichnis erhält eigene Passwörter beim Umzug; Sitzungen überleben Neustarts nicht',async()=>{
  const source=await mkdtemp(path.join(os.tmpdir(),'bsvg-auth-source-')),parent=await mkdtemp(path.join(os.tmpdir(),'bsvg-auth-target-'));let a,b;
  try{
    a=await nodeStore(source);const[user]=await seed(a),auth=await accountService(a);const link=await auth.issue(user.id,'activation');await auth.consume(link.token,password);const login=await auth.login(user.email,password);
    const content=await(await handleApi(request('/api/backup'),a,owner)).json();assert(!JSON.stringify(content).includes('password_hash'));assert(!JSON.stringify(content).includes(login.token));
    a.close();a=null;const target=path.join(parent,'restored');await cp(source,target,{recursive:true});
    b=await nodeStore(target);const restored=await accountService(b);assert.equal(restored.resolve(login.token),null);assert.equal((await restored.login(user.email,password)).userId,user.id);
  }finally{a?.close();b?.close();await rm(source,{recursive:true,force:true});await rm(parent,{recursive:true,force:true});}
});
test('HTTP-Anmeldung trennt Lehrkräfte, Schüler und Betreiber; Rollen kommen nie aus dem Loginformular',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'bsvg-auth-http-')),app=await startServer({directory:dir,port:0,token:randomBytes(32).toString('hex'),origin});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const post=async(url,body,cookie,requestOrigin=origin)=>fetch(base+url,{method:'POST',redirect:'manual',headers:{origin:requestOrigin,'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  try{
    const[teacher,student]=await seed(app.store);for(const u of[teacher,student]){const link=await app.auth.issue(u.id,'activation');assert.equal((await post('/auth/consume',{token:link.token,password})).status,200);}
    for(const [title,audience] of [['Öffentliche Meldung','website'],['Interne Lehrkräfteinformation','intranet']])assert.equal((await handleApi(request('/api/posts','POST',{title,excerpt:'Test',body:'Testinhalt',site:'all',audience,status:'published'}),app.store,owner)).status,201);
    const publicResponse=await fetch(base+'/api/public');assert.equal(publicResponse.status,200);const publicText=await publicResponse.text();assert(publicText.includes('Öffentliche Meldung'));assert(!publicText.includes('Interne Lehrkräfteinformation'));assert(!publicText.includes(teacher.email));assert(!publicText.includes('directory'));
    assert.equal((await fetch(base+'/api/state')).status,401);assert.equal((await fetch(base+'/auth/session')).status,401);
    const pupil=await post('/auth/login',{email:student.email,password,role:'admin',bereich:'lehrkraefte'});assert.equal(pupil.status,200);assert.equal((await pupil.json()).destination,'/schueler');
    const rawCookie=pupil.headers.get('set-cookie');assert.match(rawCookie,/__Host-bsvg_session=/);assert.match(rawCookie,/HttpOnly/);assert.match(rawCookie,/Secure/);assert.match(rawCookie,/SameSite=Strict/);const cookie=rawCookie.split(';')[0];
    assert.equal((await fetch(base+'/lehrkraefte',{headers:{cookie},redirect:'manual'})).status,403);
    assert.equal((await fetch(base+'/verwaltung',{headers:{cookie},redirect:'manual'})).status,403);
    assert.equal((await fetch(base+'/schueler',{headers:{cookie},redirect:'manual'})).status,200);
    assert.equal((await post('/auth/admin/links',{userId:teacher.id,purpose:'reset'},cookie)).status,403);
    assert.equal((await post('/api/users',{email:'forged@example.test',roles:['admin']},cookie)).status,403);
    assert.equal((await post('/auth/logout',{},cookie,'https://evil.test')).status,403);
    const state=await(await fetch(base+'/api/state',{headers:{cookie}})).json();assert.equal(state.directory.users.length,1);assert.equal(state.directory.users[0].id,student.id);assert.equal(state.capabilities.directoryManage,false);
    const teacherLogin=await post('/auth/login',{email:teacher.email,password});const teacherCookie=teacherLogin.headers.get('set-cookie').split(';')[0];assert.equal((await teacherLogin.json()).destination,'/lehrkraefte');
    assert.equal((await fetch(base+'/verwaltung',{headers:{cookie:teacherCookie},redirect:'manual'})).status,200);
    assert.equal((await post('/auth/admin/links',{userId:student.id,purpose:'reset'},teacherCookie,'https://evil.test')).status,403);
    const reset=await(await post('/auth/admin/links',{userId:student.id,purpose:'reset'},teacherCookie)).json();assert.match(reset.url,/#token=/);assert(!new URL(reset.url).search);assert.equal(reset.delivery,'manual');
    assert.equal((await post('/auth/logout',{},cookie)).status,200);assert.equal((await fetch(base+'/api/state',{headers:{cookie}})).status,401);
    for(let i=0;i<10;i++)assert.equal((await post('/auth/login',{email:'unknown@example.test',password:'falsch'})).status,401);
    assert.equal((await post('/auth/login',{email:'unknown@example.test',password:'falsch'})).status,429);
  }finally{await app.close();await rm(dir,{recursive:true,force:true});}
});
