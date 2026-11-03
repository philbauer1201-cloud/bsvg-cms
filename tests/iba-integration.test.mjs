import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../core/cms.mjs';
import {newDirectory} from '../core/directory.mjs';

test('IBA-Import bleibt für andere Rollen gesperrt und übersteht eine Sicherung',async()=>{
 let row={revision:1,data:{posts:[],files:[],activity:[],directory:newDirectory()}};
 const teacher={id:crypto.randomUUID(),name:'Test',email:'test@example.test',roles:['teacher'],status:'active',createdAt:new Date().toISOString()};row.data.directory.users.push(teacher);
 const store={read:async()=>structuredClone(row),write:async(rev,data)=>{if(rev!==row.revision)return false;row={revision:rev+1,data:structuredClone(data)};return true;}};
 const owner={kind:'workshop',subject:'test'},user={kind:'cms',userId:teacher.id};
 const call=(path,method='GET',body,actor=owner)=>handleApi(new Request('https://cms.test'+path,{method,headers:{origin:'https://cms.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),store,actor);
 const csv='Schüler:in;Schuljahr;LG;Klasse;IBA-Status\nTestperson;2026/27;2;1kTELE;Test';
 assert.equal((await call('/api/iba','POST',{csv,location:'Vöcklabruck'})).status,200);
 assert.equal((await call('/api/iba','GET',null,user)).status,403);
 assert.equal((await call('/api/iba','POST',{csv,location:'Gmunden'},user)).status,403);
 const state=await(await call('/api/state','GET',null,user)).json();assert.equal(state.iba,undefined);
 const backup=await(await call('/api/backup')).json();assert.equal(backup.version,4);assert.equal(backup.iba[0].records[0].name,'Testperson');
 assert.equal((await call('/api/iba','POST',{csv:'ungültig',location:'Vöcklabruck'})).status,400);assert.equal((await(await call('/api/iba')).json()).snapshots[0].records[0].name,'Testperson');
 assert.equal((await call('/api/restore','POST',backup)).status,200);assert.equal((await(await call('/api/iba')).json()).snapshots[0].records[0].name,'Testperson');
});

