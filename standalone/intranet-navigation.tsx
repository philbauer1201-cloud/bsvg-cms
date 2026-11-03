import IbaDemo from './iba-demo';
import {useState} from 'react';

const sections = [
  {id:'organisation',label:'Unterrichtsorganisation',items:['Supplierungen','Lehrgangsorganisation','Pausenaufsicht','Räume','Internat']},
  {id:'classes',label:'Klassenmanagement',items:['Meine Klassen','Klassenvorstand','KV-Unterlagen und Checklisten']},
  {id:'iba',label:'IBA',items:['Übersicht','Gespräche und Protokolle']},
  {id:'leadership',label:'Leitung & Steuerung',items:['Direktion','Qualitätsmanagement','Q-Handbuch','Mitteilungen','Leitungsvertretung']},
  {id:'forms',label:'Formulare & Anträge',items:['Exkursionen und Lehrausgänge','Kollegiale Hospitation']},
  {id:'other',label:'Weitere Informationen',items:['SGA','Funktionen und Aufgaben','Gegenstände']},
];

export default function IntranetNavigation({onHome,onTeaching,onHead,hasHead,onNavigate}:{onHome:()=>void;onTeaching:()=>void;onHead:()=>void;hasHead:boolean;onNavigate:(open:boolean)=>void}) {
 const [site,setSite]=useState<'voecklabruck'|'gmunden'>('voecklabruck');
 const [section,setSection]=useState('home'),[item,setItem]=useState('');
 function openSection(id:string){setSection(id);setItem('');onNavigate(true);}
 function choose(label:string){
   if(label==='Meine Klassen'){setSection('home');onNavigate(false);onTeaching();return;}
   if(label==='Klassenvorstand'&&hasHead){setSection('home');onNavigate(false);onHead();return;}
   setItem(label);
 }
 const current=sections.find(s=>s.id===section);
 return <section className="intranet-navigation"><div className="intranet-top"><nav aria-label="Intranet-Bereiche"><button type="button" aria-current={section==='home'?'page':undefined} className={section==='home'?'selected':''} onClick={()=>{setSection('home');setItem('');onNavigate(false);onHome();}}>Start</button>{sections.map(s=><button type="button" key={s.id} aria-current={section===s.id?'page':undefined} className={section===s.id?'selected':''} onClick={()=>openSection(s.id)}>{s.label}</button>)}</nav><label>Standort<select value={site} onChange={e=>setSite(e.target.value as typeof site)}><option value="voecklabruck">Vöcklabruck</option><option value="gmunden">Gmunden</option></select></label></div>{current&&<div className="intranet-section"><h2>{current.label}</h2><div className="intranet-links">{current.items.map(label=><button type="button" key={label} aria-pressed={item===label} className={item===label?'selected':''} onClick={()=>choose(label)}>{label}</button>)}</div>{section==='iba'&&item==='Gespräche und Protokolle'?<IbaDemo/>:item&&<div className="intranet-empty"><h3>{item}</h3><p>Für diesen Bereich sind noch keine Inhalte eingerichtet. Standort: {site==='gmunden'?'Gmunden':'Vöcklabruck'}.</p></div>}</div>}</section>;
}
