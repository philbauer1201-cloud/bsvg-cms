import { env } from "cloudflare:workers";
export function sitesStore() {
  if (!env.DB || !env.BUCKET) throw new Error("CMS-Speicher ist nicht konfiguriert.");
  const db = env.DB, bucket = env.BUCKET;
  return {
    async read() {
      const row = await db.prepare("SELECT revision, payload FROM cms_state WHERE id = ?").bind("school").first<{ revision:number; payload:string }>();
      return row ? { revision:row.revision,data:JSON.parse(row.payload) } : null;
    },
    async write(revision:number,data:unknown) {
      const result = revision === 0
        ? await db.prepare("INSERT OR IGNORE INTO cms_state(id, revision, payload) VALUES (?, 1, ?)").bind("school",JSON.stringify(data)).run()
        : await db.prepare("UPDATE cms_state SET revision = revision + 1, payload = ? WHERE id = ? AND revision = ?").bind(JSON.stringify(data),"school",revision).run();
      return result.meta.changes === 1;
    },
    async putFile(key:string,bytes:Uint8Array,type:string) { await bucket.put(key,bytes,{ httpMetadata:{ contentType:type } }); },
    async getFile(key:string) { const o = await bucket.get(key); return o ? new Uint8Array(await o.arrayBuffer()) : null; },
    async deleteFile(key:string) { await bucket.delete(key); },
  };
}
