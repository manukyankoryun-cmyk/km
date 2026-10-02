'use strict';
/** KM_NO_XLSX_ARCHIVE_V1 — strip stored xlsx base64; keep rows; mime -> JSON archive */
const fs = require('fs');
const path = require('path');

const MIME_NEW = 'application/x-km-unit-archive+json';
const roots = process.argv.slice(2);
if (!roots.length) {
  console.error('usage: node strip-xlsx-from-archives.cjs <dir>...');
  process.exit(2);
}

function walk(r, acc) {
  if (!fs.existsSync(r)) return;
  for (const ent of fs.readdirSync(r, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'KM_Net') continue;
    const f = path.join(r, ent.name);
    if (ent.isDirectory()) walk(f, acc);
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) acc.push(f);
  }
}

function looksXlsxBase64(b64) {
  if (!b64 || typeof b64 !== 'string' || b64.length < 8) return false;
  try {
    const h = Buffer.from(b64.slice(0, 64), 'base64').slice(0, 4).toString('hex');
    return h === '504b0304';
  } catch {
    return false;
  }
}

function scrubObj(o, stats) {
  if (!o || typeof o !== 'object') return false;
  let changed = false;
  const scrubOne = (a) => {
    if (!a || typeof a !== 'object') return;
    const hadB64 = !!(a.base64 && String(a.base64).length);
    const xlsx = looksXlsxBase64(a.base64) || /spreadsheetml|\.xlsx/i.test(String(a.mime || '')) || /\.xlsx$/i.test(String(a.name || ''));
    if (hadB64) {
      delete a.base64;
      a.base64 = '';
      changed = true;
      stats.strippedBase64++;
    }
    if (xlsx || hadB64) {
      if (a.mime !== MIME_NEW) { a.mime = MIME_NEW; changed = true; stats.mimeFixed++; }
      if (typeof a.name === 'string' && /\.xlsx$/i.test(a.name)) {
        a.name = a.name.replace(/\.xlsx$/i, '').trim() || 'Զորամասի հաստիքային արխիվ';
        changed = true;
        stats.renamed++;
      }
    }
    if (Array.isArray(a.rows) && a.rows.length) stats.keptRows += a.rows.length;
  };

  if (Array.isArray(o.rows) || o.mime || o.base64 != null || o.archiveRole) {
    scrubOne(o);
  }
  if (Array.isArray(o.positionArchives)) o.positionArchives.forEach(scrubOne);
  if (Array.isArray(o.archives)) o.archives.forEach(scrubOne);
  if (o.data && typeof o.data === 'object') {
    if (Array.isArray(o.data.positionArchives)) o.data.positionArchives.forEach(scrubOne);
  }
  if (o.kmCorpsData && typeof o.kmCorpsData === 'object') {
    for (const k of Object.keys(o.kmCorpsData)) {
      const cd = o.kmCorpsData[k];
      if (cd && Array.isArray(cd.positionArchives)) cd.positionArchives.forEach(scrubOne);
    }
  }
  // index.json entries
  if (Array.isArray(o.items)) o.items.forEach(scrubOne);
  if (Array.isArray(o.list)) o.list.forEach(scrubOne);
  return changed;
}

const stats = { files: 0, changed: 0, strippedBase64: 0, mimeFixed: 0, renamed: 0, keptRows: 0 };
for (const root of roots) {
  const files = [];
  walk(path.resolve(root), files);
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    if (!/base64|spreadsheetml|\.xlsx/i.test(text)) continue;
    let o;
    try { o = JSON.parse(text); } catch { continue; }
    stats.files++;
    const before = JSON.stringify(o);
    scrubObj(o, stats);
    const after = JSON.stringify(o);
    if (before !== after) {
      fs.writeFileSync(f, JSON.stringify(o, null, 2), 'utf8');
      stats.changed++;
      console.log('SCRUB', f);
    }
  }
}
console.log('STATS', JSON.stringify(stats));