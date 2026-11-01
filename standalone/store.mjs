import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { SCHEMA_SQL } from '../core/cms.mjs';

export async function nodeStore(directory) {
  await mkdir(path.join(directory,'files'),{ recursive:true });
  const db = new DatabaseSync(path.join(directory,'cms.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(SCHEMA_SQL);
  function filePath(key) { if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid file key'); return path.join(directory,'files',key); }
  return {
    database:db,
    async read() { const row = db.prepare('SELECT revision,payload FROM cms_state WHERE id = ?').get('school'); return row ? { revision:Number(row.revision),data:JSON.parse(row.payload) } : null; },
    async write(revision,data) {
      const result = revision === 0
        ? db.prepare('INSERT OR IGNORE INTO cms_state(id,revision,payload) VALUES (?,1,?)').run('school',JSON.stringify(data))
        : db.prepare('UPDATE cms_state SET revision = revision + 1,payload = ? WHERE id = ? AND revision = ?').run(JSON.stringify(data),'school',revision);
      return result.changes === 1;
    },
    async putFile(key,bytes) { await writeFile(filePath(key),bytes,{ flag:'wx' }); },
    async getFile(key) { try { return new Uint8Array(await readFile(filePath(key))); } catch(e) { if (e.code === 'ENOENT') return null; throw e; } },
    async deleteFile(key) { await unlink(filePath(key)).catch(e=>{ if(e.code !== 'ENOENT') throw e; }); },
    close() { db.close(); },
  };
}
