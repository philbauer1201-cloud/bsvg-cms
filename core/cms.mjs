import {CurriculumError} from './curriculum.mjs';
import { normalizeDirectory, newDirectory, resolvePrincipal, capabilities, can, classAccess, directoryProjection, directoryAction, validateDirectory, visiblePost, DirectoryError } from './directory.mjs';
export const MAX_FILE = 2 * 1024 * 1024;
export const MAX_BACKUP = 20 * 1024 * 1024;
export const SCHEMA_SQL = 'CREATE TABLE IF NOT EXISTS cms_state (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL)';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const empty = () => ({ posts: [], files: [], activity: [], directory:newDirectory() });
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
export class CmsError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
function check(ok, message, status = 400) { if (!ok) throw new CmsError(message, status); }
function text(v, max, label, required = true) {
  check(typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0), `${label} ist ungültig oder zu lang.`); return v.trim();
}
function postInput(p) {
  check(p && typeof p === 'object', 'Beitrag fehlt.');
  const title = text(p.title, 160, 'Titel'), excerpt = text(p.excerpt ?? '', 400, 'Kurztext', false), body = text(p.body ?? '', 30000, 'Inhalt', false);
  check(['all', 'voecklabruck', 'gmunden'].includes(p.site), 'Standort ist ungültig.');
  check(['draft', 'published'].includes(p.status), 'Status ist ungültig.');
  check(['website', 'intranet','students'].includes(p.audience), 'Zielbereich ist ungültig.');
  check(p.classId===undefined||p.classId===null||validId(p.classId),'Klassenkennung ist ungültig.');
  check(p.audience!=='website'||!p.classId,'Öffentliche Beiträge dürfen nicht auf eine Klasse beschränkt werden.');
  return { title, excerpt, body, site: p.site, status: p.status, audience: p.audience, classId:p.classId??null };
}
const validDate = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const validId = v => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v);
function checkFile(bytes, type) {
  check(bytes.length > 0 && bytes.length <= MAX_FILE, 'Dateien dürfen maximal 2 MB groß sein.');
  check(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'].includes(type), 'Erlaubt sind PNG, JPG, WebP, PDF und TXT.');
  const prefix = new TextDecoder().decode(bytes.slice(0, 16));
  if (type === 'application/pdf') check(prefix.startsWith('%PDF-'), 'Keine gültige PDF-Datei.');
  if (type === 'image/png') check([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v), 'Keine gültige PNG-Datei.');
  if (type === 'image/jpeg') check(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, 'Keine gültige JPG-Datei.');
  if (type === 'image/webp') check(prefix.startsWith('RIFF') && prefix.slice(8,12) === 'WEBP', 'Keine gültige WebP-Datei.');
  if (type === 'text/plain') { try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new CmsError('TXT muss UTF-8 enthalten.'); } }
}
function base64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 16384) s += String.fromCharCode(...bytes.subarray(i,i+16384)); return btoa(s); }
function unbase64(v) {
  check(typeof v === 'string' && v.length <= Math.ceil(MAX_FILE / 3) * 4 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v), 'Dateikodierung ist ungültig.');
  try { return Uint8Array.from(atob(v), c => c.charCodeAt(0)); } catch { throw new CmsError('Dateikodierung ist ungültig.'); }
}
async function sha(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join(''); }
const read = async store => { const row=await store.read()??{revision:0,data:empty()};return {...row,data:normalizeDirectory(row.data)}; };
function checkPostClass(data,p) {
  if(!p.classId)return;
  const c=data.directory.classes.find(c=>c.id===p.classId);
  check(c,'Die zugeordnete Klasse existiert nicht.');
  check(p.site==='all'||p.site===c.site,'Beitrag und Klasse müssen zum selben Standort gehören.');
}
async function commit(store, row, actor, message) {
  row.data.activity.unshift({ id: uuid(), at: now(), actor, text: message }); row.data.activity = row.data.activity.slice(0,30);
  check(new TextEncoder().encode(JSON.stringify(row.data)).length <= 1500000,'Die Inhaltsgröße des Grundgerüsts ist erreicht (1,5 MB Text und Metadaten).');
  check(await store.write(row.revision, row.data), 'Der Datenstand wurde inzwischen geändert. Bitte neu laden.', 409);
}
async function requestJson(request) {
  const bytes = new Uint8Array(await request.arrayBuffer()); check(bytes.length <= MAX_BACKUP, 'Anfrage überschreitet 20 MB.', 413);
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new CmsError('Ungültige JSON-Datei.'); }
}
export async function handleApi(request, store, actor) {
  try {
    const initial=await read(store),principal=resolvePrincipal(initial.data,actor);
    const url = new URL(request.url), path = url.pathname, method = request.method;
    if (!['GET','HEAD'].includes(method)) check(request.headers.get('origin') === url.origin, 'Anfrage stammt nicht aus dieser Anwendung.', 403);
    if(path==='/api/directory'&&method==='GET')return json({directory:directoryProjection(initial.data,principal),capabilities:capabilities(initial.data,principal)});
    const classDetail=path.match(/^\/api\/classes\/([a-f0-9-]{36})$/);
    if(classDetail&&method==='GET') {
      const access=classAccess(initial.data.directory,principal,classDetail[1]);check(access.read,'Kein Zugriff auf diese Lehrgangsklasse.',403);
      return json({class:initial.data.directory.classes.find(c=>c.id===classDetail[1]),access});
    }
    if(/^\/api\/(users|classes|memberships|subjects|templates)(\/|$)/.test(path)||path==='/api/permissions/check') {
      return json(await directoryAction(request,path,method,initial,principal,(row,message)=>commit(store,row,principal.id,message),requestJson),method==='POST'&&path!=='/api/permissions/check'?201:200);
    }
    if(path==='/api/backup'||path==='/api/restore'||path==='/api/demo')check(can(principal,'backup'),'Nur die Administration darf sichern, wiederherstellen oder Beispieldaten laden.',403);
    if(!['GET','HEAD'].includes(method))check(can(principal,'content:manage'),'Keine Berechtigung zum Verändern von Inhalten.',403);
    if (path === '/api/state' && method === 'GET') {
      const row = initial;
      return json({ ...row.data,posts:row.data.posts.filter(p=>visiblePost(row.data,principal,p)),files:row.data.files.filter(f=>can(principal,'content:manage')||can(principal,'staff:read')).map(({key,...f})=>f),activity:can(principal,'directory:manage')?row.data.activity:[],directory:directoryProjection(row.data,principal),capabilities:capabilities(row.data,principal),revision:row.revision });
    }
    if (path === '/api/posts' && method === 'POST') {
      const input = postInput(await requestJson(request)), row = initial; check(row.data.posts.length < 500, 'Maximal 500 Beiträge im Grundgerüst.');
      checkPostClass(row.data,input);
      row.data.posts.unshift({ ...input, id: uuid(), createdAt: now(), updatedAt: now() });
      await commit(store,row,principal.id,`Beitrag „${input.title}“ angelegt`); return json({ ok: true },201);
    }
    const pm = path.match(/^\/api\/posts\/([a-f0-9-]{36})$/);
    if (pm && ['PUT','DELETE'].includes(method)) {
      const input = method === 'PUT' ? postInput(await requestJson(request)) : null, row = initial, i = row.data.posts.findIndex(p => p.id === pm[1]);
      check(i >= 0, 'Beitrag nicht gefunden.',404); const old = row.data.posts[i];
      if(input)checkPostClass(row.data,input);
      if (input) row.data.posts[i] = { ...old, ...input, updatedAt: now() }; else row.data.posts.splice(i,1);
      await commit(store,row,principal.id,`Beitrag „${old.title}“ ${input ? 'aktualisiert' : 'gelöscht'}`); return json({ ok: true });
    }
    if (path === '/api/files' && method === 'POST') {
      const bytes = new Uint8Array(await request.arrayBuffer()), type = request.headers.get('content-type') ?? ''; checkFile(bytes,type);
      let raw; try { raw = decodeURIComponent(request.headers.get('x-file-name') ?? 'Datei'); } catch { throw new CmsError('Ungültiger Dateiname.'); }
      const name = text(raw,180,'Dateiname').replace(/[\x00-\x1f\\/]/g,'_'), row = initial;
      check(row.data.files.length < 40 && row.data.files.reduce((n,f) => n+f.size,0)+bytes.length <= 10*1024*1024, 'Maximal 40 Dateien mit insgesamt 10 MB.');
      const f = { id: uuid(), key: uuid(), name, type, size: bytes.length, sha256: await sha(bytes), createdAt: now() };
      await store.putFile(f.key,bytes,type); row.data.files.unshift(f);
      try { await commit(store,row,principal.id,`Datei „${name}“ hochgeladen`); } catch (e) { await store.deleteFile(f.key); throw e; }
      return json({ ok: true },201);
    }
    const fm = path.match(/^\/api\/files\/([a-f0-9-]{36})$/);
    if (fm && ['GET','DELETE'].includes(method)) {
      check(can(principal,'content:manage')||can(principal,'staff:read'),'Kein Zugriff auf interne Dateien.',403); const row = initial, f = row.data.files.find(f => f.id === fm[1]); check(f,'Datei nicht gefunden.',404);
      if (method === 'DELETE') {
        row.data.files = row.data.files.filter(x => x.id !== f.id); await commit(store,row,principal.id,`Datei „${f.name}“ entfernt`);
        // Blobs bleiben für laufende Exporte erhalten; spätere Wartung entfernt verwaiste Objekte.
        return json({ ok: true });
      }
      const bytes = await store.getFile(f.key); check(bytes,'Datei fehlt im Speicher.',404);
      return new Response(bytes,{ headers: { 'content-type': f.type, 'content-disposition': `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name)}`, 'x-content-type-options':'nosniff', 'cache-control':'no-store' } });
    }
    if (path === '/api/backup' && method === 'GET') {
      const row = initial, files = [];
      for (const { key,...f } of row.data.files) { const bytes = await store.getFile(key); check(bytes,`Datei „${f.name}“ fehlt.`,409); check(await sha(bytes) === f.sha256,`Prüfsumme von „${f.name}“ stimmt nicht.`,409); files.push({ ...f, base64: base64(bytes) }); }
      check((await read(store)).revision === row.revision,'Daten wurden während des Exports geändert. Bitte erneut exportieren.',409);
      return json({ format:'bsvg-cms',version:2,exportedAt:now(),posts:row.data.posts,activity:row.data.activity,files,directory:row.data.directory },200,{ 'content-disposition':`attachment; filename="bsvg-backup-${now().slice(0,10)}.json"` });
    }
    if (path === '/api/restore' && method === 'POST') {
      const b = await requestJson(request); check(b?.format === 'bsvg-cms' && [1,2].includes(b.version),'Unbekanntes Backupformat oder nicht unterstützte Version.');
      const directory=b.version===2?validateDirectory(b.directory,{resetActivation:true}):initial.data.directory;
      check(Array.isArray(b.posts) && b.posts.length <= 500 && Array.isArray(b.files) && b.files.length <= 40,'Ungültige Einträge im Backup.');
      const ids = new Set();
      const posts = b.posts.map(p => { check(validId(p.id) && !ids.has(p.id) && validDate(p.createdAt) && validDate(p.updatedAt),'Ungültige oder doppelte Beitragskennung.'); ids.add(p.id); return { ...postInput(p),id:p.id,createdAt:p.createdAt,updatedAt:p.updatedAt }; });
      for(const p of posts)checkPostClass({directory},p);
      let total = 0; const files = [];
      for (const f of b.files) {
        check(validId(f.id) && !ids.has(f.id) && validDate(f.createdAt),'Ungültige oder doppelte Dateikennung.'); ids.add(f.id);
        const name = text(f.name,180,'Dateiname').replace(/[\x00-\x1f\\/]/g,'_'), bytes = unbase64(f.base64); checkFile(bytes,f.type);
        total += bytes.length; check(total <= 10*1024*1024,'Backup enthält mehr als 10 MB Dateien.'); check(bytes.length === f.size && await sha(bytes) === f.sha256,`Dateiprüfung fehlgeschlagen: ${name}`);
        files.push({ meta: { id:f.id,key:uuid(),name,type:f.type,size:bytes.length,sha256:f.sha256,createdAt:f.createdAt },bytes });
      }
      const row = initial, uploaded = [];
      try { for (const f of files) { await store.putFile(f.meta.key,f.bytes,f.meta.type); uploaded.push(f.meta.key); } row.data = { posts,files:files.map(f => f.meta),activity:[],directory }; await commit(store,row,principal.id,`${posts.length} Beiträge und ${files.length} Dateien wiederhergestellt`); }
      catch (e) { for (const key of uploaded) await store.deleteFile(key); throw e; }
      return json({ ok:true,posts:posts.length,files:files.length });
    }
    if (path === '/api/demo' && method === 'POST') {
      const row = initial; check(!row.data.posts.length && !row.data.files.length,'Beispieldaten benötigen eine leere Werkstatt.',409);
      row.data.posts = [
        { title:'Zwei Standorte. Viele Möglichkeiten.',excerpt:'Eine gemeinsame Plattform für unsere Schule in Vöcklabruck und Gmunden.',body:'Dies ist ein frei bearbeitbarer Beispielbeitrag. Hier entsteht die gemeinsame digitale Heimat unserer Schule.',site:'all',audience:'website',status:'published' },
        { title:'Einblicke in den Schulalltag',excerpt:'Raum für Projekte, Begegnungen und Geschichten aus Vöcklabruck.',body:'Beispielinhalt für Vöcklabruck. Ersetzen Sie diesen Text durch einen eigenen Beitrag.',site:'voecklabruck',audience:'website',status:'draft' },
        { title:'Gut organisiert ins neue Schuljahr',excerpt:'Wichtige Informationen für das Kollegium in Gmunden.',body:'Beispielmitteilung für das Kollegium am Standort Gmunden.',site:'gmunden',audience:'intranet',status:'draft' },
      ].map(p => ({ ...p,id:uuid(),createdAt:now(),updatedAt:now() }));
      await commit(store,row,principal.id,'Drei Beispielbeiträge geladen'); return json({ ok:true });
    }
    return json({ error:'Endpunkt nicht gefunden.' },404);
  } catch (e) { if (e instanceof CmsError||e instanceof DirectoryError||e instanceof CurriculumError) return json({ error:e.message },e.status); console.error('CMS request failed',e instanceof Error ? e.message : 'unknown'); return json({ error:'Der Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen.' },500); }
}
