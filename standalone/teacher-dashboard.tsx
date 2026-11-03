import {CalendarDays,ClipboardList,GraduationCap,MessageSquareText} from 'lucide-react';
import type {TeachingClass} from './teaching-workspace';
type Post={id:string;title:string;excerpt:string;body:string;site:string};
type Subject={id:string;code:string;name:string};
export default function TeacherDashboard({posts,classes,subjects,files,onTeaching}:{posts:Post[];classes:TeachingClass[];subjects:Subject[];files:{id:string;name:string}[];onTeaching:()=>void}){
 return <div className="teacher-dashboard">
  <section className="dashboard-card"><div className="dashboard-heading"><ClipboardList size={21}/><div><h2>Meine Supplierungen</h2><p>Deine Unterrichtsvertretungen im Überblick</p></div></div><p className="dashboard-empty">Supplierungen sind noch nicht angebunden.</p></section>
  <section className="dashboard-card"><div className="dashboard-heading"><CalendarDays size={21}/><div><h2>Meine Termine</h2><p>Wichtige Termine für deinen Schulalltag</p></div></div><p className="dashboard-empty">Eine Terminübersicht ist noch nicht eingerichtet.</p></section>
  <section className="dashboard-card"><div className="dashboard-heading"><GraduationCap size={21}/><div><h2>Mein Unterricht</h2><p>Deine Klassen und Fächer</p></div></div>{classes.length?classes.map(c=><div className="dashboard-entry" key={c.id}><strong>{c.name}</strong><span>{subjects.filter(s=>c.myAssignment?.subjectIds.includes(s.id)).map(s=>s.code+' · '+s.name).join(' / ')||'Keine Fächer zugeordnet'}</span>{c.myAssignment?.function==='head'&&<small>Klassenvorstand</small>}</div>):<p className="dashboard-empty">Derzeit keine laufenden Klassen zugeordnet.</p>}<button className="text-button dashboard-action" onClick={onTeaching}>Zum Unterricht →</button></section>
  <section className="dashboard-card"><div className="dashboard-heading"><MessageSquareText size={21}/><div><h2>Informationen für mich</h2><p>Aktuelles für deinen Schulalltag</p></div></div>{posts.length?posts.slice(0,4).map(p=><article className="dashboard-entry" key={p.id}><strong>{p.title}</strong><span>{p.excerpt||p.body}</span></article>):<p className="dashboard-empty">Keine neuen Informationen vorhanden.</p>}</section>
  <section className="dashboard-card"><div className="dashboard-heading"><ClipboardList size={21}/><div><h2>Interne Materialien</h2><p>Dokumente für Lehrkräfte</p></div></div>{files.length?files.map(f=><div className="dashboard-entry" key={f.id}><strong>{f.name}</strong><a href={`/api/files/${f.id}`}>Herunterladen</a></div>):<p className="dashboard-empty">Noch keine internen Dateien vorhanden.</p>}</section>
 </div>;
}
