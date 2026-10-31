import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { nodeStore } from './store.mjs';
import { handleApi, MAX_BACKUP } from '../core/cms.mjs';

export async function startServer(options = {}) {
  const local = options.localPreview ?? process.argv.includes('--local-preview');
  const token = options.token ?? process.env.CMS_ADMIN_TOKEN;
  const host = options.host ?? process.env.CMS_HOST ?? '127.0.0.1';
  if (local && !['127.0.0.1','::1'].includes(host)) throw new Error('Lokale Vorschau darf ausschließlich an Loopback gebunden werden.');
  if (!local && (!token || token.length < 32)) throw new Error('CMS_ADMIN_TOKEN mit mindestens 32 Zeichen setzen. Für lokale Vorschau: npm run preview:standalone');
  const originSetting = options.origin ?? process.env.CMS_ORIGIN;
  if (!local && !originSetting) throw new Error('CMS_ORIGIN auf die externe HTTPS-Adresse setzen.');
  if (!local && !originSetting.startsWith('https://')) throw new Error('CMS_ORIGIN muss HTTPS verwenden.');
  const store = await nodeStore(options.directory ?? process.env.CMS_DATA_DIR ?? path.resolve('data'));
  const staticRoot = path.resolve('standalone-dist');
  const sessions = new Map(), attempts = new Map();
  const mime = { '.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png','.html':'text/html; charset=utf-8' };
  const server = http.createServer(async (req,res) => {
    try {
      const port = server.address().port;
      const origin = local ? `http://${host === '::1' ? '[::1]' : host}:${port}` : originSetting;
      const hostHeader = req.headers.host ?? '';
      if (local && hostHeader !== new URL(origin).host) { res.writeHead(403); return res.end('Host nicht erlaubt.'); }
      const url = new URL(req.url,origin);
      if (url.origin !== origin) { res.writeHead(403); return res.end('Origin nicht erlaubt.'); }
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','same-origin');
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
      if (url.pathname === '/healthz') { res.writeHead(200,{'content-type':'application/json'}); return res.end('{"status":"ok","version":"0.1.0"}'); }
      const chunks = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > MAX_BACKUP) { res.writeHead(413); res.end('Anfrage zu groß'); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      if (url.pathname === '/login' && !local) {
        if (req.method === 'POST') {
          if (req.headers.origin !== origin) { res.writeHead(403); return res.end('Origin nicht erlaubt'); }
          const key = req.socket.remoteAddress ?? 'unknown';
          const count = attempts.get(key) ?? { n:0,until:Date.now()+15*60*1000 };
          if (count.until < Date.now()) { count.n=0; count.until=Date.now()+15*60*1000; }
          if (count.n >= 10) { res.writeHead(429); return res.end('Bitte später erneut versuchen.'); }
          const supplied = new URLSearchParams(body.toString()).get('token') ?? '';
          const suppliedBytes = Buffer.from(supplied), tokenBytes = Buffer.from(token);
          if (suppliedBytes.length !== tokenBytes.length || !timingSafeEqual(suppliedBytes,tokenBytes)) { count.n++; attempts.set(key,count); res.writeHead(401); return res.end('Zugang abgelehnt.'); }
          for (const [id,expiry] of sessions) if (expiry <= Date.now()) sessions.delete(id);
          if (sessions.size >= 1000) { res.writeHead(503); return res.end('Zu viele Testsitzungen.'); }
          attempts.delete(key); const id = randomBytes(32).toString('hex'); sessions.set(id,Date.now()+4*60*60*1000);
          res.writeHead(303,{ location:'/', 'set-cookie':`bsvg_session=${id}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=14400` }); return res.end();
        }
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
        return res.end('<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BSVG Testzugang</title><link rel="stylesheet" href="/login.css"><main><h1>BSVG · Geschützter Testzugang</h1><p>Temporärer Administrationsschlüssel. Eigene Benutzerkonten folgen später.</p><form method="post" action="/login"><label>Administrationsschlüssel <input name="token" type="password" required autocomplete="current-password"></label><button>Anmelden</button></form></main></html>');
      }
      if (url.pathname === '/login.css') { res.writeHead(200,{'content-type':'text/css'}); return res.end('body{font:16px Arial;background:#eef4f5;color:#365b6d}main{max-width:520px;margin:15vh auto;background:white;padding:35px}input,button{display:block;padding:12px;margin-top:15px}input{width:90%}button{background:#007699;color:white;border:0}'); }
      const session = (req.headers.cookie ?? '').match(/(?:^|;\s*)bsvg_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const authenticated = local || (session && (sessions.get(session) ?? 0) > Date.now());
      if (!authenticated) {
        if (url.pathname.startsWith('/api/')) { res.writeHead(401,{'content-type':'application/json'}); return res.end('{"error":"Bitte anmelden."}'); }
        res.writeHead(303,{location:'/login'}); return res.end();
      }
      if (url.pathname.startsWith('/api/')) {
        const webRequest = new Request(url,{ method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method) ? {} : { body }) });
        const result = await handleApi(webRequest,store,{kind:'workshop',subject:'standalone-admin'});
        res.writeHead(result.status,Object.fromEntries(result.headers)); return res.end(Buffer.from(await result.arrayBuffer()));
      }
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      let decoded; try { decoded = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
      const target = path.resolve(staticRoot,decoded === '/' ? 'standalone/index.html' : `.${decoded}`);
      if (!target.startsWith(staticRoot+path.sep)) { res.writeHead(403); return res.end(); }
      try { const data = await readFile(target); res.writeHead(200,{'content-type':mime[path.extname(target)] ?? 'application/octet-stream','cache-control':'no-cache'}); res.end(req.method === 'HEAD' ? undefined : data); }
      catch(e) { if (e.code !== 'ENOENT') throw e; res.writeHead(404); res.end('Nicht gefunden'); }
    } catch { res.writeHead(500); res.end('Serverfehler'); }
  });
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(options.port ?? Number(process.env.PORT ?? 3100),host,resolve); });
  return { server,store,close:async()=>{ await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())); store.close(); } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await startServer(); console.log(`BSVG CMS: http://${process.env.CMS_HOST ?? '127.0.0.1'}:${app.server.address().port}`);
  if (process.argv.includes('--local-preview')) console.log('Lokale Vorschau ohne Benutzerkonten, ausschließlich auf diesem Rechner.');
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{ await app.close(); process.exit(0); });
}
