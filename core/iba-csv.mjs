const normal = v => String(v ?? '').normalize('NFKC').toLocaleLowerCase('de-AT').replace(/[^\p{L}\p{N}]/gu, '');
export function parseCSV(input) {
  let text = input.replace(/^\uFEFF/, '');
  if (/^sep=[;,\t]\r?\n/i.test(text)) text = text.slice(text.indexOf('\n') + 1);
  function parse(delimiter) {
    const rows = []; let row = [], cell = '', quoted = false, closed = false, started = false;
    const pushCell = () => { row.push(cell); cell = ''; closed = false; started = false; };
    const pushRow = () => { pushCell(); if (row.some(v => v.trim())) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else cell += c;
      } else if (c === delimiter) pushCell();
      else if (c === '\r' || c === '\n') { if (c === '\r' && text[i + 1] === '\n') i++; pushRow(); }
      else if (c === '"' && !started) { quoted = true; started = true; }
      else if (closed && !/\s/.test(c)) throw new Error('Ungültiges CSV-Format.');
      else { cell += c; started = true; }
    }
    if (quoted) throw new Error('Unvollständiges Textfeld.');
    pushRow(); return rows;
  }
  const candidates = [',', ';', '\t'].flatMap(d => { try { const rows = parse(d); return [{ rows, width: rows[0]?.length || 0 }]; } catch { return []; } });
  candidates.sort((a, b) => b.width - a.width);
  if (!candidates.length) throw new Error('Ungültige CSV-Datei. Bitte erneut aus Lists exportieren.');
  const rows = candidates[0].rows;
  if (rows.length < 2) throw new Error('Die Datei enthält keine Datenzeilen. Der bisherige Stand bleibt erhalten.');
  if (rows[0].length < 2) throw new Error('Keine Tabelle erkannt. Bitte „Nach CSV exportieren“ verwenden.');
  if (rows.slice(1).some(r => r.length !== rows[0].length)) throw new Error('Die Anzahl der Spalten stimmt nicht in jeder Zeile überein. Bitte die Originaldatei exportieren.');
  return rows;
}
const aliases = {
  name: ['Schüler:in', 'Schüler/in', 'Schülerin', 'Name', 'Sch_x00fc_ler_x003a_in'], schoolYear: ['Schuljahr'], course: ['LG', 'Lehrgang'], class: ['Klasse'], status: ['IBA-Status', 'IBA_x002d_Status'],
  caretaker: ['BAS (Betreuung)', 'BAS_x0028_Betreuung_x0029_', 'Betreuung'], contact: ['Kontakt Betreuer:in', 'KontaktBetreuer_x003a_in'], meeting: ['Termin Beschulungsgespräch', 'TerminBeschulungsgespr_x00e4_ch'],
  notes: ['Besonderheiten'], changes: ['Nachträgliche Informationen / Änderungen', 'Nachtr_x00e4_glicheInformationen'], company: ['Lehrbetrieb'], assistance: ['Schulassistenz'], boarding: ['Internat'], start: ['Lehrzeit Start', 'LehrzeitStart'], end: ['Lehrzeit Ende', 'LehrzeitEnde'], id: ['ID']
};
export function readExport(text, location) {
  if (!['Vöcklabruck', 'Gmunden'].includes(location)) throw new Error('Bitte einen Standort auswählen.');
  const [headers, ...rows] = parseCSV(text), normalized = headers.map(normal);
  if (new Set(normalized).size !== normalized.length) throw new Error('Die Datei hat doppelte Spaltenüberschriften.');
  const indices = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, normalized.findIndex(h => names.some(n => normal(n) === h))]));
  const required = { name:'Schüler:in', schoolYear:'Schuljahr', course:'LG', class:'Klasse', status:'IBA-Status' };
  const missing = Object.entries(required).filter(([key]) => indices[key] < 0).map(([, label]) => label);
  if (missing.length) throw new Error(`Spalten fehlen: ${missing.join(', ')}. Bitte vor dem Export in der List-Ansicht einblenden.`);
  const records = rows.map((row, i) => {
    const record = Object.fromEntries(Object.entries(indices).map(([key, index]) => [key, index < 0 ? '' : row[index].trim()]));
    if (!record.name) throw new Error(`In Datenzeile ${i + 1} fehlt Schüler:in. Der Import wurde nicht übernommen.`);
    return { ...record, location };
  });
  const ids = records.map(r => r.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) throw new Error('Die Datei enthält doppelte IDs. Bitte die Originaldatei verwenden.');
  return { records, optionalMissing: Object.keys(aliases).filter(k => !required[k] && indices[k] < 0 && !['id','start','end','boarding'].includes(k)) };
}
export async function decodeFile(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error('Die Datei ist größer als 15 MB. Bitte einen kleineren Export verwenden.');
  const buffer = await file.arrayBuffer(), bytes = new Uint8Array(buffer);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  try { return new TextDecoder(encoding, { fatal:true }).decode(buffer); } catch { return new TextDecoder('windows-1252').decode(buffer); }
}
export function filterRecords(records, values) {
  const query = String(values.search || '').trim().toLocaleLowerCase('de-AT');
  return records.filter(r => ['location','schoolYear','course','class','status'].every(k => !values[k] || r[k] === values[k]) && (!query || r.name.toLocaleLowerCase('de-AT').includes(query)));
}

