import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { nodeStore } from '../standalone/store.mjs';
import { handleApi } from '../core/cms.mjs';
import { newDirectory,resolvePrincipal,capabilities,classAccess,visiblePost,todayVienna,validDay } from '../core/directory.mjs';
const owner={kind:'workshop',subject:'test-owner'},origin='https://cms.test';
const request=(route,method='GET',body)=>new Request(origin+route,{method,headers:{origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
async function fixture(){
  const directory=await mkdtemp(path.join(os.tmpdir(),'bsvg-roles-')),store=await nodeStore(directory);
  const api=(route,method='GET',body,actor=owner)=>handleApi(request(route,method,body),store,actor);
  const state=async()=>await(await api('/api/state')).json();
  const close=async()=>{store.close();await rm(directory,{recursive:true,force:true});};
  return {store,api,state,close};
}
test('Konten deduplizieren, Mehrfachrollen, Klasse und Mitgliedschaften speichern; pending ist keine Aktivierung',async()=>{
  const f=await fixture();try{
    assert.equal((await f.api('/api/users','POST',{email:'teacher@example.test',roles:['admin','teacher']})).status,201);
    assert.equal((await f.api('/api/users','POST',{email:'student@example.test',roles:['student']})).status,201);
    assert.equal((await f.api('/api/users','POST',{email:'TEACHER@example.test',roles:['teacher']})).status,409);
    assert.equal((await f.api('/api/users','POST',{email:'mixed@example.test',roles:['student','admin']})).status,400);
    assert.equal((await f.api('/api/users','POST',{email:'active@example.test',roles:['teacher'],status:'active'})).status,400);
    assert.equal((await f.api('/api/classes','POST',{name:'Testklasse',course:'Testlehrgang',site:'voecklabruck',startDate:'2026-11-18',endDate:'2027-02-09'})).status,201);
    const s=await f.state(),[teacher,student]=s.directory.users,c=s.directory.classes[0];
    assert.equal((await f.api('/api/memberships','POST',{classId:c.id,userId:teacher.id,role:'teacher'})).status,201);
    assert.equal((await f.api('/api/memberships','POST',{classId:c.id,userId:student.id,role:'student'})).status,201);
    assert.equal((await f.api('/api/memberships','POST',{classId:c.id,userId:student.id,role:'student'})).status,409);
    assert.equal((await f.api('/api/memberships','POST',{classId:c.id,userId:student.id,role:'teacher'})).status,400);
    assert.equal((await f.api('/api/state','GET',undefined,{kind:'cms',userId:student.id})).status,403);
    const before=await f.store.read();
    const actual=await(await f.api('/api/permissions/check','POST',{userId:student.id,day:'2026-11-18'})).json();
    assert.equal(actual.active,false);assert.equal(actual.classChecks[0].read,false);
    const simulation=await(await f.api('/api/permissions/check','POST',{userId:student.id,day:'2026-11-18',simulateActivation:true})).json();
    assert.equal(simulation.classChecks[0].read,true);assert.equal(simulation.classChecks[0].write,false);assert.equal(simulation.capabilities.directoryManage,false);
    assert.deepEqual(await f.store.read(),before,'Simulation darf Konto nicht aktivieren.');
    const backup=await(await f.api('/api/backup')).json();assert.equal(backup.version,2);assert.equal(backup.directory.users.length,2);
    const g=await fixture();try{assert.equal((await g.api('/api/restore','POST',backup)).status,200);assert.deepEqual((await g.state()).directory,backup.directory);}finally{await g.close();}
    const malformed=structuredClone(backup);malformed.directory.memberships[0].userId=crypto.randomUUID();assert.equal((await f.api('/api/restore','POST',malformed)).status,400);assert.deepEqual(await f.store.read(),before);
    const legacy={...backup,version:1};delete legacy.directory;assert.equal((await f.api('/api/restore','POST',legacy)).status,200);assert.equal((await f.state()).directory.users.length,2);
  }finally{await f.close();}
});
test('Serverrechte: Schüler verwalten nichts, sehen kein Intranet, keine Kontoliste, keine fremde Klasse und keine internen Dateien',async()=>{
  const f=await fixture();try{
    for(const [email,roles] of [['student@example.test',['student']],['teacher@example.test',['teacher']],['editor@example.test',['editor']]])await f.api('/api/users','POST',{email,roles});
    const day=todayVienna(),start=day,end=day;
    for(const name of ['Eigene Klasse','Fremde Klasse'])await f.api('/api/classes','POST',{name,course:'Test',site:'voecklabruck',startDate:start,endDate:end});
    let row=await f.store.read();for(const u of row.data.directory.users)u.status='active';await f.store.write(row.revision,row.data);
    const s=await f.state(),[student,teacher,editor]=s.directory.users,[own,foreign]=s.directory.classes;
    for(const [u,role]of [[student,'student'],[teacher,'teacher']])await f.api('/api/memberships','POST',{userId:u.id,classId:own.id,role});
    for(const p of [{title:'Öffentlich',audience:'website',status:'published'},{title:'Intern',audience:'intranet',status:'published'},{title:'Entwurf',audience:'students',status:'draft',classId:own.id},{title:'Klasse sichtbar',audience:'students',status:'published',classId:own.id},{title:'Fremde Klasse geheim',audience:'students',status:'published',classId:foreign.id}])assert.equal((await f.api('/api/posts','POST',{excerpt:'',body:'',site:'all',...p})).status,201);
    const actor={kind:'cms',userId:student.id};
    const pupilState=await(await f.api('/api/state','GET',undefined,actor)).json();
    assert.deepEqual(pupilState.posts.map(p=>p.title).sort(),['Klasse sichtbar','Öffentlich']);
    assert.equal(pupilState.directory.users.length,1);assert.equal(pupilState.directory.classes.length,1);assert.equal(pupilState.activity.length,0);assert.equal(pupilState.files.length,0);
    assert.equal((await f.api('/api/users','POST',{email:'unauthorized@example.test',roles:['admin']},actor)).status,403);
    assert.equal((await f.api('/api/posts','POST',{title:'No',site:'all',audience:'website',status:'draft'},actor)).status,403);
    assert.equal((await f.api('/api/backup','GET',undefined,actor)).status,403);
    assert.equal((await f.api(`/api/classes/${foreign.id}`,'GET',undefined,actor)).status,403);
    assert.equal((await f.api(`/api/files/${crypto.randomUUID()}`,'GET',undefined,actor)).status,403);
    assert.equal((await f.api('/api/memberships','POST',{userId:teacher.id,classId:foreign.id,role:'teacher'},{kind:'cms',userId:teacher.id})).status,403);
    const teacherState=await(await f.api('/api/state','GET',undefined,{kind:'cms',userId:teacher.id})).json();assert(teacherState.posts.some(p=>p.title==='Intern'));assert(!teacherState.posts.some(p=>p.title==='Fremde Klasse geheim'));
    assert.equal((await f.api('/api/backup','GET',undefined,{kind:'cms',userId:editor.id})).status,403);
    const membership=(await f.state()).directory.memberships.find(m=>m.userId===student.id);
    await f.api(`/api/memberships/${membership.id}`,'DELETE');
    assert.equal((await f.api(`/api/classes/${own.id}`,'GET',undefined,actor)).status,403);
    const backup=await(await f.api('/api/backup')).json();
    await f.api('/api/restore','POST',backup);assert.equal((await f.state()).directory.users[0].status,'pending','Restore setzt Aktivierung zurück.');
  }finally{await f.close();}
});
test('Lehrgangszeitraum gilt einschließlich Enddatum in Wien; Lehrkraft und Schüler haben getrennte Schreibrechte',()=>{
  const c={id:crypto.randomUUID(),site:'voecklabruck',startDate:'2026-11-18',endDate:'2027-02-09',archived:false};
  const student={id:crypto.randomUUID(),roles:['student'],status:'active'},teacher={id:crypto.randomUUID(),roles:['teacher'],status:'active'};
  const directory={users:[student,teacher],classes:[c],memberships:[{classId:c.id,userId:student.id,role:'student',status:'active'},{classId:c.id,userId:teacher.id,role:'teacher',status:'active'}]};
  const data={directory},sp=resolvePrincipal(data,{kind:'cms',userId:student.id}),tp=resolvePrincipal(data,{kind:'cms',userId:teacher.id});
  for(const day of ['2026-11-18','2027-02-09']){assert.equal(classAccess(directory,sp,c.id,day).read,true);assert.equal(classAccess(directory,sp,c.id,day).write,false);assert.equal(classAccess(directory,tp,c.id,day).write,true);}
  for(const day of ['2026-11-17','2027-02-10'])assert.equal(classAccess(directory,sp,c.id,day).read,false);
  assert.equal(todayVienna(new Date('2027-02-09T23:30:00Z')),'2027-02-10');
  assert.equal(validDay('2026-02-30'),false);assert.equal(validDay('2027-02-09'),true);
  c.archived=true;assert.equal(classAccess(directory,tp,c.id,'2026-11-18').read,false);
});
