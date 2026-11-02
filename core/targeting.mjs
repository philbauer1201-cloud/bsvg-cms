export function targets(p){return {audiences:p.audiences??[p.audience],classIds:p.classIds??(p.classId?[p.classId]:[]),subjectId:p.subjectId??null,course:p.course??'',teacherGroup:p.teacherGroup??'all'};}
export function isPublic(p){const t=targets(p);return t.audiences.length===1&&t.audiences[0]==='website'&&!t.classIds.length&&!t.subjectId&&!t.course&&t.teacherGroup==='all';}
export function personalPrincipal(p){return {...p,workshop:false,roles:p.roles.filter(r=>['teacher','student'].includes(r))};}
