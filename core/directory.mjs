import {targets} from './targeting.mjs';
import {curriculumDefaults,validateCurriculum,curriculumAction} from './curriculum.mjs';
export const ROLES = ['admin','teacher','editor','student'];
export class DirectoryError extends Error { constructor(message,status=400) { super(message); this.status=status; } }
const ensure=(ok,message,status=400)=>{ if(!ok) throw new DirectoryError(message,status); };
export const newDirectory=()=>({users:[],classes:[],memberships:[],subjects:[],templates:[]});
export const normalizeDirectory=data=>({ ...data,posts:(data.posts??[]).map(p=>({...p,classId:p.classId??null})),directory:curriculumDefaults(data.directory??newDirectory()) });
export function todayVienna(now=new Date()) {
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vienna',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(k=>p.find(v=>v.type===k).value).join('-');
}
function text(v,max,label) { ensure(typeof v==='string'&&v.trim().length>0&&v.trim().length<=max,`${label} ist ungültig.`); return v.trim(); }
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export function validDay(v) { return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v; }
const stamp=()=>new Date().toISOString();
export function userInput(p) {
  ensure(p&&typeof p==='object','Benutzerangaben fehlen.');
  const email=text(p.email,254,'E-Mail-Adresse').toLowerCase();
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Bitte eine gültige E-Mail-Adresse angeben.');
  const name=typeof p.name==='string'&&p.name.trim()?text(p.name,120,'Name'):email;
  ensure(Array.isArray(p.roles)&&p.roles.length>0&&p.roles.every(r=>ROLES.includes(r)),'Mindestens eine gültige Rolle wählen.');
  const roles=[...new Set(p.roles)];
  ensure(!(roles.includes('student')&&roles.length>1),'Schülerkonten erhalten ausschließlich die Rolle Schüler.');
  ensure(p.status===undefined||['pending','disabled'].includes(p.status),'Konten werden hier nur vorbereitet oder gesperrt. Eine Aktivierung erfordert einen verifizierten Anmeldevorgang.');
  return {name,email,roles,status:p.status??'pending'};
}
export function classInput(p) {
  ensure(p&&typeof p==='object','Klassenangaben fehlen.');
  const name=text(p.name,60,'Klassenname'),course=text(p.course,60,'Lehrgang');
  ensure(['voecklabruck','gmunden'].includes(p.site),'Bitte einen Standort wählen.');
  ensure(validDay(p.startDate)&&validDay(p.endDate)&&p.startDate<=p.endDate,'Bitte einen gültigen Zeitraum mit Beginn vor dem Ende wählen.');
  ensure(p.archived===undefined||typeof p.archived==='boolean','Archivstatus ungültig.');
  const occupation=p.occupation==null||p.occupation===''?null:text(p.occupation,100,'Lehrberuf');
  const schoolYear=p.schoolYear==null||p.schoolYear===''?null:Number(p.schoolYear);
  ensure(schoolYear===null||Number.isInteger(schoolYear)&&schoolYear>=1&&schoolYear<=4,'Bitte eine gültige Klasse (1 bis 4) auswählen.');
  ensure((occupation===null)===(schoolYear===null),'Lehrberuf und Klasse müssen gemeinsam angegeben werden.');
  return {name,course,site:p.site,startDate:p.startDate,endDate:p.endDate,archived:p.archived??false,occupation,schoolYear};
}
export function classPhase(c,day=todayVienna()) { if(c.archived)return 'archived'; return day<c.startDate?'planned':day>c.endDate?'ended':'active'; }
export function resolvePrincipal(data,actor,day=todayVienna()) {
  if(actor?.kind==='workshop'&&typeof actor.subject==='string'&&actor.subject.length>0) return {id:actor.subject,roles:['admin'],workshop:true,active:true,user:null};
  ensure(actor?.kind==='cms'&&uuid(actor.userId),'Bitte anmelden.',401);
  const user=data.directory.users.find(u=>u.id===actor.userId);
  ensure(user&&user.status==='active','Dieses CMS-Konto ist noch nicht aktiviert oder wurde gesperrt.',403);
  return {id:user.id,roles:user.roles,workshop:false,active:true,user};
}
export function can(principal,capability) {
  if(principal.roles.includes('admin')) return true;
  if(capability==='content:manage') return principal.roles.includes('editor');
  if(capability==='staff:read') return principal.roles.includes('teacher')||principal.roles.includes('editor');
  return false;
}
export function classAccess(directory,principal,classId,day=todayVienna()) {
  const c=directory.classes.find(c=>c.id===classId);
  if(!c)return {read:false,write:false,reply:false,reason:'Klasse nicht gefunden.'};
  if(can(principal,'directory:manage')) return {read:true,write:true,reply:true,reason:'Administrationszugang',phase:classPhase(c,day)};
  const m=directory.memberships.find(m=>m.classId===classId&&m.userId===principal.id&&m.status==='active');
  const phase=classPhase(c,day);
  if(!m)return {read:false,write:false,reply:false,reason:'Keine Mitgliedschaft.',phase};
  if(phase!=='active')return {read:false,write:false,reply:false,reason:phase==='planned'?'Lehrgang hat noch nicht begonnen.':'Lehrgang ist beendet oder archiviert.',phase};
  const teacher=m.role==='teacher'&&principal.roles.includes('teacher');
  const student=m.role==='student'&&principal.roles.includes('student');
  return {read:teacher||student,write:teacher,reply:teacher||student,reason:teacher?'Zugeordnete Lehrkraft':student?'Zugeordneter Schüler':'Rolle passt nicht zur Mitgliedschaft.',phase};
}
export function capabilities(data,principal,day=todayVienna()) {
  return {directoryManage:can(principal,'directory:manage'),contentManage:can(principal,'content:manage'),staffRead:can(principal,'staff:read'),backup:can(principal,'backup'),workshop:principal.workshop,roles:principal.roles,classes:data.directory.classes.map(c=>({classId:c.id,...classAccess(data.directory,principal,c.id,day)})).filter(c=>c.read)};
}
export function visiblePost(data,principal,post,day=todayVienna()) {
  if(can(principal,'content:manage'))return true;
  if(post.status!=='published')return false;
  const t=targets(post);if(t.audiences.includes('website'))return !t.classIds.length;
  const classes=data.directory.classes.filter(c=>(post.site==='all'||post.site===c.site)&&(!t.course||c.course===t.course)&&(!t.classIds.length||t.classIds.includes(c.id))&&(!t.subjectId||(c.subjectIds??[]).includes(t.subjectId))&&classAccess(data.directory,principal,c.id,day).read);
  if(t.audiences.includes('intranet')&&can(principal,'staff:read')){
    const scoped=post.site!=='all'||t.course||t.classIds.length||t.subjectId||t.teacherGroup==='heads';
    if(!scoped)return true;
    return classes.some(c=>(t.teacherGroup!=='heads'||(c.assignments??[]).some(a=>a.userId===principal.id&&a.function==='head'))&&(!t.subjectId||(c.assignments??[]).some(a=>a.userId===principal.id&&a.subjectIds.includes(t.subjectId))));
  }
  if(t.audiences.includes('students'))return classes.length>0;
  return false;
}
export function directoryProjection(data,principal,day=todayVienna()) {
  if(can(principal,'directory:manage'))return data.directory;
  const classes=data.directory.classes.filter(c=>classAccess(data.directory,principal,c.id,day).read);
  const ids=new Set(classes.map(c=>c.id));
  return {subjects:(data.directory.subjects??[]).filter(s=>classes.some(c=>(c.subjectIds??[]).includes(s.id))),templates:[],users:principal.user?[principal.user]:[],classes:classes.map(({assignments,...c})=>c),memberships:data.directory.memberships.filter(m=>m.userId===principal.id&&ids.has(m.classId)&&m.status==='active')};
}
export async function directoryAction(request,path,method,row,principal,save,readJson) {
  ensure(can(principal,'directory:manage'),'Nur die Administration darf Benutzer, Klassen und Mitgliedschaften verwalten.',403);
  const d=row.data.directory;
  if(/^\/api\/(subjects|templates)(\/|$)/.test(path)){if(await curriculumAction(path,method,await readJson(request),d)){await save(row,"Fachkatalog aktualisiert");return {ok:true};}}
  const userMatch=path.match(/^\/api\/users\/([a-f0-9-]{36})$/),classMatch=path.match(/^\/api\/classes\/([a-f0-9-]{36})$/),memberMatch=path.match(/^\/api\/memberships\/([a-f0-9-]{36})$/);
  if((path==='/api/users'&&method==='POST')||(userMatch&&method==='PUT')) {
    const input=userInput(await readJson(request)),old=userMatch?d.users.find(u=>u.id===userMatch[1]):null;
    ensure(!userMatch||old,'Benutzer nicht gefunden.',404);
    ensure(!d.users.some(u=>u.email===input.email&&u.id!==old?.id),'Diese E-Mail-Adresse ist bereits angelegt.',409);
    ensure(d.users.length<2000||old,'Maximal 2000 vorbereitete Konten.');
    if(old){
      ensure(!d.memberships.some(m=>m.userId===old.id&&m.status==='active'&&!input.roles.includes(m.role)),'Zuerst unpassende Klassenmitgliedschaften entfernen.');
      if(old.status==='active'&&old.roles.includes('admin')&&(!input.roles.includes('admin')||input.status==='disabled'))ensure(d.users.some(u=>u.id!==old.id&&u.status==='active'&&u.roles.includes('admin')),'Der letzte aktive CMS-Administrator muss erhalten bleiben.');
      // Ohne verifizierte Aktivierung ist kein Wechsel von pending/disabled nach active möglich.
      Object.assign(old,input,{status:old.status==='active'&&input.status==='pending'?'active':input.status,updatedAt:stamp()});
    } else d.users.push({...input,id:crypto.randomUUID(),createdAt:stamp(),updatedAt:stamp()});
    await save(row,`Benutzerkonto ${old?'aktualisiert':'vorbereitet'}`);return {ok:true};
  }
  if((path==='/api/classes'&&method==='POST')||(classMatch&&method==='PUT')) {
    const payload=await readJson(request),old=classMatch?d.classes.find(c=>c.id===classMatch[1]):null;
    const input=classInput(old?{...old,...payload}:payload);
    const template=d.templates.find(t=>t.occupation===input.occupation&&t.schoolYear===input.schoolYear&&t.site===input.site);input.subjectIds=payload.subjectIds??old?.subjectIds??template?.subjectIds??[];input.assignments=payload.assignments??old?.assignments??[];
    ensure(!classMatch||old,'Klasse nicht gefunden.',404);
    ensure(!d.classes.some(c=>c.id!==old?.id&&c.name.toLowerCase()===input.name.toLowerCase()&&c.course.toLowerCase()===input.course.toLowerCase()&&c.site===input.site&&c.startDate===input.startDate),'Diese Klasse ist bereits angelegt.',409);
    ensure(d.classes.length<200||old,'Maximal 200 Lehrgangsklassen.');
    if(old)Object.assign(old,input,{updatedAt:stamp()});else d.classes.push({...input,id:crypto.randomUUID(),createdAt:stamp(),updatedAt:stamp()});
    validateCurriculum(d);
    await save(row,`Lehrgangsklasse ${old?'aktualisiert':'angelegt'}`);return {ok:true};
  }
  if(path==='/api/memberships'&&method==='POST') {
    const p=await readJson(request);ensure(p&&typeof p==='object','Mitgliedschaft fehlt.');
    const user=d.users.find(u=>u.id===p.userId),c=d.classes.find(c=>c.id===p.classId);
    ensure(user&&c,'Benutzer oder Klasse nicht gefunden.',404);
    ensure(['teacher','student'].includes(p.role)&&user.roles.includes(p.role),'Die Mitgliedschaft muss zur Benutzerrolle passen.');
    ensure(user.status!=='disabled'&&!c.archived,'Gesperrtes Konto oder archivierte Klasse.');
    ensure(!d.memberships.some(m=>m.userId===p.userId&&m.classId===p.classId&&m.status==='active'),'Dieses Konto ist der Klasse bereits zugeordnet.',409);
    ensure(d.memberships.length<10000,'Maximale Anzahl an Mitgliedschaften erreicht.');
    d.memberships.push({id:crypto.randomUUID(),userId:user.id,classId:c.id,role:p.role,status:'active',createdAt:stamp()});
    await save(row,'Klassenmitgliedschaft angelegt');return {ok:true};
  }
  if(memberMatch&&method==='DELETE') {
    const m=d.memberships.find(m=>m.id===memberMatch[1]);ensure(m,'Mitgliedschaft nicht gefunden.',404);m.status='removed';m.removedAt=stamp();const k=d.classes.find(c=>c.id===m.classId);if(k)k.assignments=(k.assignments??[]).filter(a=>a.userId!==m.userId);await save(row,'Klassenmitgliedschaft beendet');return {ok:true};
  }
  if(path==='/api/permissions/check'&&method==='POST') {
    const p=await readJson(request),u=d.users.find(u=>u.id===p.userId);ensure(u,'Benutzer nicht gefunden.',404);
    const day=p.day??todayVienna();ensure(validDay(day),'Ungültiges Prüfdatum.');
    const simulated=p.simulateActivation===true;
    const active=simulated||u.status==='active';
    const principal={id:u.id,user:u,roles:u.roles,workshop:false,active};
    return {userId:u.id,day,simulated,accountStatus:u.status,active,capabilities:active?capabilities(row.data,principal,day):{directoryManage:false,contentManage:false,staffRead:false,backup:false,roles:u.roles,classes:[]},classChecks:d.classes.map(c=>({classId:c.id,...(active?classAccess(d,principal,c.id,day):{read:false,write:false,reply:false,reason:'CMS-Konto ist noch nicht aktiviert.'})})),note:'Antworten sind später nur in ausdrücklich geöffneten Diskussionen zulässig. Diese Prüfung ändert keine Rechte oder Konten.'};
  }
  throw new DirectoryError('Verwaltungsendpunkt nicht gefunden.',404);
}
export function validateDirectory(input,{resetActivation=false}={}) {
  ensure(input&&Array.isArray(input.users)&&Array.isArray(input.classes)&&Array.isArray(input.memberships),'Benutzerverzeichnis im Backup fehlt.');
  ensure(input.users.length<=2000&&input.classes.length<=200&&input.memberships.length<=10000,'Verzeichnis ist zu groß.');
  const ids=new Set(),emails=new Set();
  const entity=(v)=>{ensure(uuid(v.id)&&!ids.has(v.id),'Ungültige oder doppelte Verzeichniskennung.');ids.add(v.id);ensure(typeof v.createdAt==='string'&&!Number.isNaN(Date.parse(v.createdAt)),'Ungültiges Erstellungsdatum.');};
  const users=input.users.map(u=>{entity(u);ensure(['pending','active','disabled'].includes(u.status),'Ungültiger Kontostatus.');const v=userInput({...u,status:u.status==='active'?'pending':u.status});ensure(!emails.has(v.email),'Doppelte E-Mail-Adresse im Backup.');emails.add(v.email);return {...v,id:u.id,status:resetActivation&&u.status==='active'?'pending':u.status,createdAt:u.createdAt,updatedAt:typeof u.updatedAt==='string'?u.updatedAt:u.createdAt};});
  const classes=input.classes.map(c=>{entity(c);return {...classInput(c),subjectIds:c.subjectIds??[],assignments:c.assignments??[],id:c.id,createdAt:c.createdAt,updatedAt:typeof c.updatedAt==='string'?c.updatedAt:c.createdAt};});
  const pairs=new Set();
  const memberships=input.memberships.map(m=>{entity(m);const u=users.find(u=>u.id===m.userId),c=classes.find(c=>c.id===m.classId);ensure(u&&c&&['teacher','student'].includes(m.role)&&u.roles.includes(m.role)&&['active','removed'].includes(m.status),'Ungültiger Verweis einer Mitgliedschaft.');if(m.status==='active'){const pair=`${m.userId}:${m.classId}`;ensure(!pairs.has(pair),'Doppelte aktive Mitgliedschaft.');pairs.add(pair);}return {id:m.id,userId:m.userId,classId:m.classId,role:m.role,status:m.status,createdAt:m.createdAt,...(m.removedAt?{removedAt:m.removedAt}:{})};});
  return validateCurriculum({...input,users,classes,memberships});
}
