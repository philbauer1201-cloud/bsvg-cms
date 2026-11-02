"use client";
import {useEffect,useState} from 'react';
import {PersonalPortal} from '../standalone/portal';
type Teacher={id:string;name:string;roles:string[];status:string;email:string};
export default function TeacherPreview({workshop=false}:{workshop?:boolean}){
 const [teachers,setTeachers]=useState<Teacher[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let valid=true;fetch('/api/directory',{headers:workshop?{'x-bsvg-workshop':'operator'}:{}}).then(async r=>{const b=await r.json() as {error?:string;directory:{users:Teacher[]}};if(!r.ok)throw Error(b.error);if(!valid)return;const users=b.directory.users.filter(u=>u.roles.includes('teacher')&&u.status!=='disabled');setTeachers(users);setSelected(users[0]?.id??'');}).catch(e=>{if(valid)setError(e.message);});return()=>{valid=false;};},[]);
 const teacher=teachers.find(u=>u.id===selected);
 return <section className="teacher-preview"><div className="preview-note"><strong>Lehrkräfte-Vorschau</strong><p>Prüfe die Klassen, Unterrichtsfächer und Funktionen eines vorbereiteten Kontos. Diese Vorschau ist schreibgeschützt.</p><label>Lehrkraft<select value={selected} onChange={e=>setSelected(e.target.value)}>{teachers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label></div>{error&&<p role="alert">{error}</p>}{teacher?<PersonalPortal key={teacher.id} previewUserId={teacher.id} previewWorkshop={workshop} student={false} session={{authenticated:true,workshop:false,name:teacher.name,email:teacher.email,localPreview:false,capabilities:{roles:['teacher'],directoryManage:false,contentManage:false,staffRead:true}}}/>:<p>Keine Lehrkraft zur Vorschau verfügbar.</p>}</section>;
}
