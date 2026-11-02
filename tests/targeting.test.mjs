import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {nodeStore} from '../standalone/store.mjs';import {handleApi} from '../core/cms.mjs';import {visiblePost} from '../core/directory.mjs';import {personalPrincipal,isPublic} from '../core/targeting.mjs';
test('Mehrere Klassen, gemeinsame Empfänger, KV und Fachfilter werden bei jedem Zugriff geprüft',()=>{
 const teacher={id:crypto.randomUUID(),roles:['teacher','admin'],user:{},workshop:false},student={id:crypto.randomUUID(),roles:['student'],workshop:false},outsider={id:crypto.randomUUID(),roles:['student'],workshop:false},subject=crypto.randomUUID();const a={id:crypto.randomUUID(),site:'voecklabruck',course:'2',startDate:'2026-11-01',endDate:'2027-02-09',subjectIds:[subject],assignments:[{userId:teacher.id,function:'head',subjectIds:[subject]}]},b={...a,id:crypto.randomUUID(),site:'gmunden',assignments:[]};
 const data={directory:{classes:[a,b],memberships:[{userId:teacher.id,classId:a.id,role:'teacher',status:'active'},{userId:student.id,classId:b.id,role:'student',status:'active'}]}};
 const p={status:'published',site:'all',audience:'intranet',audiences:['intranet','students'],classIds:[a.id,b.id],subjectId:subject,teacherGroup:'heads',course:'2'};const day='2026-11-02';
 assert(visiblePost(data,personalPrincipal(teacher),p,day));assert(visiblePost(data,student,p,day));assert(!visiblePost(data,outsider,p,day));assert(!isPublic(p));
 assert(!visiblePost(data,student,{...p,site:'voecklabruck'},day));assert(!visiblePost(data,student,p,'2027-02-10'));
 a.assignments=[];assert(!visiblePost(data,personalPrincipal(teacher),p,day));assert(visiblePost(data,teacher,p,day),'Die Verwaltung bleibt unabhängig vom persönlichen Zugriff.');
 assert(!visiblePost(data,student,{...p,status:'draft'},day));
});
test('Empfänger und Fach bleiben im neuen Sicherungsformat erhalten; ungültige Verweise werden abgewiesen',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bsvg-targets-')),store=await nodeStore(dir),origin='https://cms.test',owner={kind:'workshop',subject:'test'};
 const api=(url,method='GET',body)=>handleApi(new Request(origin+url,{method,headers:{origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),store,owner);
 try{await api('/api/subjects','POST',{code:'VP',name:'Verkaufskompetenz und Persönlichkeitsentwicklung'});let d=(await store.read()).data.directory;const sid=d.subjects[0].id;
 for(const name of['A','B'])assert.equal((await api('/api/classes','POST',{name,course:'2',site:'voecklabruck',startDate:'2026-11-01',endDate:'2027-02-09',subjectIds:[sid]})).status,201);
 d=(await store.read()).data.directory;const p={title:'Beide Klassen',body:'Information',site:'voecklabruck',status:'published',audience:'intranet',audiences:['intranet','students'],classIds:d.classes.map(c=>c.id),subjectId:sid,course:'2',teacherGroup:'heads'};
 assert.equal((await api('/api/posts','POST',p)).status,201);assert.equal((await api('/api/posts','POST',{...p,audiences:['website','students']})).status,400);assert.equal((await api('/api/posts','POST',{...p,classIds:[crypto.randomUUID()]})).status,400);
 const backup=await(await api('/api/backup')).json();assert.equal(backup.version,3);assert.equal(backup.posts[0].classIds.length,2);assert.equal((await api('/api/restore','POST',backup)).status,200);const restored=(await store.read()).data.posts[0];assert.equal(restored.subjectId,sid);assert.deepEqual(restored.audiences,['intranet','students']);
 assert.equal((await api('/api/posts/'+restored.id,'PUT',{title:'Alt',body:'',site:'all',status:'published',audience:'students'})).status,400);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
