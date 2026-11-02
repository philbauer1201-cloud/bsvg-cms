import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../core/cms.mjs';
test('Werkstatt-Vorschau zeigt nur persönliche Fächer und KV, ohne Kontenaktivierung oder Schreibzugriff',async()=>{
 const teacher={id:crypto.randomUUID(),name:'Test-Lehrkraft',email:'teacher@example.test',status:'pending',roles:['teacher','admin']},other={...teacher,id:crypto.randomUUID(),email:'other@example.test',status:'active'},subject={id:crypto.randomUUID(),code:'VP',name:'Verkaufskompetenz',optional:false},own={id:crypto.randomUUID(),name:'1TEST',site:'voecklabruck',course:'2',startDate:'2000-01-01',endDate:'2099-12-31',subjectIds:[subject.id],assignments:[{userId:teacher.id,function:'head',subjectIds:[subject.id]}]};
 const foreign={...own,id:crypto.randomUUID(),name:'FREMD',assignments:[]};
 const data={posts:[{id:'own',title:'Meine Klasse',status:'published',audience:'students',site:'all',classIds:[own.id]},{id:'foreign',title:'Fremde Klasse',status:'published',audience:'students',site:'all',classIds:[foreign.id]},{id:'draft',title:'Entwurf',status:'draft',audience:'intranet',site:'all'}],files:[],activity:[],directory:{users:[teacher,other],subjects:[subject],templates:[],classes:[own,foreign],memberships:[{userId:teacher.id,classId:own.id,status:'active',role:'teacher'}]}};
 const store={read:async()=>({revision:1,data:structuredClone(data)}),write:async()=>{throw Error('Vorschau darf nichts schreiben');}};
 const call=(actor,method='GET',id=teacher.id)=>handleApi(new Request('https://cms.test/api/teacher-preview?userId='+id,{method,headers:{origin:'https://cms.test'}}),store,actor);
 const owner={kind:'workshop',subject:'owner'};let r=await call(owner);assert.equal(r.status,200);const result=await r.json();assert.equal(result.preview,true);assert.equal(result.directory.classes.length,1);assert.equal(result.directory.classes[0].myAssignment.function,'head');assert.deepEqual(result.directory.classes[0].myAssignment.subjectIds,[subject.id]);assert.deepEqual(result.posts.map(p=>p.id),['own']);assert.equal(result.directory.users.length,1);assert.equal(data.directory.users[0].status,'pending');
 assert.equal((await call(owner,'POST')).status,405);assert.equal((await call({kind:'cms',userId:other.id})).status,403);assert.equal((await call(owner,'GET',crypto.randomUUID())).status,404);
 data.directory.users[0].status='disabled';assert.equal((await call(owner)).status,404);
});
