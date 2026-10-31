import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes } from 'node:crypto';
import { nodeStore } from '../standalone/store.mjs';
import { startServer } from '../standalone/server.mjs';
import { handleApi } from '../core/cms.mjs';

const origin = 'https://cms.test';
function request(route,method='GET',body,headers={}) {
  return new Request(origin+route,{ method,headers:{ origin,...headers },...(body === undefined ? {} : { body:typeof body === 'string' ? body : JSON.stringify(body) }) });
}
const post = { title:'Standortübergreifendes Testprojekt',excerpt:'Gemeinsamer Beitrag',body:'Umlaute: äöü. Inhalt bleibt erhalten.',site:'all',audience:'website',status:'published' };

test('Echte SQLite-Installationen: Beitrag und Binärdatei exportieren, auf leerem Ziel wiederherstellen und nach Neustart prüfen',async()=>{
  const sourceDir = await mkdtemp(path.join(os.tmpdir(),'bsvg-source-')), targetDir = await mkdtemp(path.join(os.tmpdir(),'bsvg-target-'));
  let source,target;
  try {
    source=await nodeStore(sourceDir); target=await nodeStore(targetDir);
    assert.equal((await handleApi(request('/api/posts','POST',post),source,{kind:'workshop',subject:'tester'})).status,201);
    const file='Eine Datei mit Umlauten: Grüße aus Gmunden.\n';
    assert.equal((await handleApi(request('/api/files','POST',file,{ 'content-type':'text/plain','x-file-name':encodeURIComponent('Prüfung.txt') }),source,{kind:'workshop',subject:'tester'})).status,201);
    const backup=await (await handleApi(request('/api/backup'),source,{kind:'workshop',subject:'tester'})).json();
    assert.equal(backup.files.length,1); assert.equal(backup.posts.length,1);
    assert.equal((await handleApi(request('/api/restore','POST',backup),target,{kind:'workshop',subject:'tester'})).status,200);
    const exported=await (await handleApi(request('/api/backup'),target,{kind:'workshop',subject:'tester'})).json();
    assert.deepEqual(exported.posts,backup.posts); assert.deepEqual(exported.files,backup.files);
    target.close(); target=await nodeStore(targetDir);
    const state=await (await handleApi(request('/api/state'),target,{kind:'workshop',subject:'tester'})).json();
    assert.equal(state.posts[0].body,post.body);
    const downloaded=await handleApi(request(`/api/files/${state.files[0].id}`),target,{kind:'workshop',subject:'tester'});
    assert.equal(await downloaded.text(),file);
    assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');
    const before=await target.read(), broken=structuredClone(backup); broken.files[0].sha256='f'.repeat(64);
    assert.equal((await handleApi(request('/api/restore','POST',broken),target,{kind:'workshop',subject:'tester'})).status,400);
    assert.deepEqual(await target.read(),before,'Beschädigter Import darf aktuelle Daten nicht verändern.');
    const wrongVersion=structuredClone(backup); wrongVersion.version=99;
    assert.equal((await handleApi(request('/api/restore','POST',wrongVersion),target,{kind:'workshop',subject:'tester'})).status,400);
    assert.equal(await target.write(before.revision-1,before.data),false,'Veraltete Schreibzugriffe werden abgewiesen.');
  } finally { source?.close(); target?.close(); await rm(sourceDir,{recursive:true,force:true}); await rm(targetDir,{recursive:true,force:true}); }
});

test('API verweigert fehlende Identität, fremde Origins und ungültige Beiträge',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'bsvg-validation-')); const store=await nodeStore(dir);
  try {
    assert.equal((await handleApi(request('/api/state'),store,'')).status,401);
    const foreign=new Request(origin+'/api/posts',{method:'POST',headers:{origin:'https://evil.test'},body:JSON.stringify(post)});
    assert.equal((await handleApi(foreign,store,{kind:'workshop',subject:'tester'})).status,403);
    assert.equal((await handleApi(request('/api/posts','POST',{...post,site:'unknown'}),store,{kind:'workshop',subject:'tester'})).status,400);
    assert.equal((await handleApi(request('/api/files','POST','<script/>',{'content-type':'image/svg+xml'}),store,{kind:'workshop',subject:'tester'})).status,400);
    assert.equal((await handleApi(request('/api/files','POST','fake image',{'content-type':'image/png'}),store,{kind:'workshop',subject:'tester'})).status,400);
    assert.equal((await handleApi(request('/api/files','POST','x'.repeat(2*1024*1024+1),{'content-type':'text/plain'}),store,{kind:'workshop',subject:'tester'})).status,400);
    assert.equal(await store.read(),null);
  } finally { store.close(); await rm(dir,{recursive:true,force:true}); }
});

test('Node-Testserver: unautorisierte API gesperrt, sichere Sitzung, CSRF-Prüfung und Anmeldebegrenzung',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'bsvg-http-')),token=randomBytes(32).toString('hex');
  const app=await startServer({directory,port:0,token,origin:'https://cms.example.org'}),base=`http://127.0.0.1:${app.server.address().port}`;
  try {
    assert.equal((await fetch(base+'/api/state')).status,401);
    assert.equal((await fetch(base+'/login',{method:'POST',headers:{origin:'https://evil.test'},body:new URLSearchParams({token})})).status,403);
    const login=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{origin:'https://cms.example.org'},body:new URLSearchParams({token})});
    assert.equal(login.status,303); const cookie=login.headers.get('set-cookie'); assert.match(cookie,/HttpOnly/); assert.match(cookie,/Secure/); assert.match(cookie,/SameSite=Strict/);
    const state=await fetch(base+'/api/state',{headers:{cookie:cookie.split(';')[0]}}); assert.equal(state.status,200);
    const forged=await fetch(base+'/api/posts',{method:'POST',headers:{cookie:cookie.split(';')[0],origin:'https://evil.test'},body:JSON.stringify(post)}); assert.equal(forged.status,403);
    const allowed=await fetch(base+'/api/posts',{method:'POST',headers:{cookie:cookie.split(';')[0],origin:'https://cms.example.org'},body:JSON.stringify(post)}); assert.equal(allowed.status,201);
    for(let i=0;i<10;i++) assert.equal((await fetch(base+'/login',{method:'POST',headers:{origin:'https://cms.example.org'},body:'token=wrong'})).status,401);
    assert.equal((await fetch(base+'/login',{method:'POST',headers:{origin:'https://cms.example.org'},body:'token=wrong'})).status,429);
  } finally { await app.close(); await rm(directory,{recursive:true,force:true}); }
});
