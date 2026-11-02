export class CurriculumError extends Error {constructor(message){super(message);this.status=400;}}
const fail=message=>{throw new CurriculumError(message);};
const text=(v,n)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)fail('Ungültige Fach- oder Vorlagenangabe.');return v.trim();};
const id=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export function subjectInput(p){return {code:text(p.code,20).toUpperCase(),name:text(p.name,160),optional:p.optional===true,occupation:p.occupation?text(p.occupation,100):null};}
export function templateInput(p,subjects){
 const occupation=text(p.occupation,100),schoolYear=Number(p.schoolYear),site=p.site;
 if(!Number.isInteger(schoolYear)||schoolYear<1||schoolYear>4||!['voecklabruck','gmunden'].includes(site))fail('Standort oder Schulstufe ungültig.');
 if(!Array.isArray(p.subjectIds)||p.subjectIds.length>100||new Set(p.subjectIds).size!==p.subjectIds.length||!p.subjectIds.every(v=>subjects.some(s=>s.id===v)))fail('Ungültige Fächerzuordnung.');
 return {occupation,schoolYear,site,subjectIds:p.subjectIds};
}
export function curriculumDefaults(d){return {...d,subjects:d.subjects??[],templates:d.templates??[]};}
export function validateCurriculum(d){
 const c=curriculumDefaults(d),seen=new Set();
 if(!Array.isArray(c.subjects)||c.subjects.length>500||!Array.isArray(c.templates)||c.templates.length>500)fail('Fachkatalog zu groß oder ungültig.');
 c.subjects=c.subjects.map(s=>{if(!id(s.id)||seen.has(s.id))fail('Doppelte Fachkennung.');seen.add(s.id);return {...subjectInput(s),id:s.id};});
 if(new Set(c.subjects.map(s=>`${s.occupation??""}:${s.code}`)).size!==c.subjects.length)fail('Doppelte Fachkürzel.');
 c.templates=c.templates.map(t=>{if(!id(t.id)||seen.has(t.id))fail('Doppelte Vorlagenkennung.');seen.add(t.id);return {...templateInput(t,c.subjects),id:t.id};});
 if(new Set(c.templates.map(t=>`${t.site}:${t.occupation.toLowerCase()}:${t.schoolYear}`)).size!==c.templates.length)fail('Doppelte Fachvorlage.');
 for(const k of c.classes){
  if(!Array.isArray(k.subjectIds??[])||(k.subjectIds??[]).length>100||new Set(k.subjectIds??[]).size!==(k.subjectIds??[]).length||!(k.subjectIds??[]).every(v=>c.subjects.some(s=>s.id===v)))fail('Ungültiger Fachverweis einer Klasse.');
  if(!Array.isArray(k.assignments??[])||(k.assignments??[]).length>200||new Set((k.assignments??[]).map(a=>a.userId)).size!==(k.assignments??[]).length||(k.assignments??[]).filter(a=>a.function==='head').length>1)fail('Doppelte oder ungültige Lehrkräftezuordnung.');
  for(const a of k.assignments??[]){const u=c.users.find(u=>u.id===a.userId);if(!u?.roles.includes('teacher')||!c.memberships.some(m=>m.userId===u.id&&m.classId===k.id&&m.role==='teacher'&&m.status==='active')||!Array.isArray(a.subjectIds)||!a.subjectIds.every(v=>(k.subjectIds??[]).includes(v))||!['teacher','head','deputy'].includes(a.function))fail('Ungültige Lehrkräftezuordnung.');}
 }
 return c;
}
export async function curriculumAction(path,method,p,d){
 if(path==='/api/occupation-subjects'&&method==='POST'){
  const input=subjectInput({...p,occupation:text(p.occupation,100)}),old=d.subjects.find(s=>s.code===input.code&&s.name===input.name&&s.optional===input.optional&&(s.occupation===input.occupation||!s.occupation));
  if(!old&&d.subjects.some(s=>s.code===input.code&&s.occupation===input.occupation))fail('Dieses Kürzel ist beim Lehrberuf bereits mit einem anderen Fach belegt.');
  if(!old&&d.subjects.length>=500)fail('Maximale Anzahl an Fächern erreicht.');
  const subject=old??{...input,id:crypto.randomUUID()};
  const previous=d.templates.find(t=>t.occupation===input.occupation&&t.schoolYear===Number(p.schoolYear)&&t.site===p.site);
  if(!previous&&d.templates.length>=500)fail('Maximale Anzahl an Zuordnungen erreicht.');
  if(!old)d.subjects.push(subject);
  const template=templateInput({...p,subjectIds:[...new Set([...(previous?.subjectIds??[]),subject.id])]},d.subjects);
  if(previous)Object.assign(previous,template);else d.templates.push({...template,id:crypto.randomUUID()});
  validateCurriculum(d);return true;
 }
 const match=path.match(/^\/api\/(subjects|templates)\/([a-f0-9-]{36})$/),kind=match?.[1]??(path==='/api/subjects'?'subjects':path==='/api/templates'?'templates':null);
 if(!kind||!['POST','PUT'].includes(method))return false;
 const input=kind==='subjects'?subjectInput(p):templateInput(p,d.subjects),old=match?d[kind].find(x=>x.id===match[2]):null;
 if(match&&!old)fail('Eintrag nicht gefunden.');
 if(d[kind].length>=500&&!old)fail('Maximale Anzahl erreicht.');
 if(kind==='subjects'&&d.subjects.some(s=>s.id!==old?.id&&s.code===input.code&&(s.occupation??null)===input.occupation))fail('Fachkürzel bereits vorhanden.');
 if(old)Object.assign(old,input);else d[kind].push({...input,id:crypto.randomUUID()});
 validateCurriculum(d);return true;
}
