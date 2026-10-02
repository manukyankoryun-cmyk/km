'use strict';
const fs = require('fs');
const path = require('path');
const p = process.argv[2] || path.join(__dirname, '..', 'app', 'js', 'km-positions.js');
let t = fs.readFileSync(p, 'utf8');
if (t.includes('KM_NO_XLSX_STORE_V1')) {
  console.log('already patched', p);
  process.exit(0);
}

const n1 = (t.match(/var rows = await parseShtatkaXlsxBuffer\(base64ToArrayBuffer\(a\.base64\)\);/g) || []).length;
t = t.replace(
  /var rows = await parseShtatkaXlsxBuffer\(base64ToArrayBuffer\(a\.base64\)\);/g,
  "/* KM_NO_XLSX_STORE_V1 */ var rows = (a.rows && a.rows.length) ? a.rows : (a.base64 ? await parseShtatkaXlsxBuffer(base64ToArrayBuffer(a.base64)) : []); if (a && a.base64) { try { a.base64 = ''; a.mime = 'application/x-km-unit-archive+json'; } catch (eNoX) {} }"
);
console.log('refresh-from-base64 replacements', n1);

const n2 = (t.match(/accept="\.xlsx,\.xls,application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/g) || []).length;
t = t.replace(
  /accept="\.xlsx,\.xls,application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet"/g,
  'accept=".json,.xlsx,.xls,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-km-no-xlsx-store="1"'
);
console.log('accept replacements', n2);

const n3 = (t.match(/var name = a\.name \|\| 'archive\.xlsx';/g) || []).length;
t = t.replace(/var name = a\.name \|\| 'archive\.xlsx';/g, "var name = a.name || 'unit-archive.json';");
console.log('name default replacements', n3);

// upload save block: base64: bytesToBase64(bytes) inside replaceUnitExcelArchive call near file.name
let n4 = 0;
t = t.replace(
  /replaceUnitExcelArchive\(\{([\s\S]*?)base64:\s*bytesToBase64\(bytes\),([\s\S]*?)rows:\s*rows,/g,
  function (m, a, b) {
    n4++;
    return "replaceUnitExcelArchive({ /* KM_NO_XLSX_STORE_V1 */" + a +
      "mime: 'application/x-km-unit-archive+json',\n            base64: ''," + b + "rows: rows,";
  }
);
console.log('upload store replacements', n4);

// Also neutralize any remaining mime: file.type || spreadsheetml in that region by global safe replace of spreadsheet default on archive add
t = t.replace(
  /mime:\s*file\.type\s*\|\|\s*'application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet'/g,
  "mime: 'application/x-km-unit-archive+json'"
);

if (!t.includes('function kmStripArchiveXlsxBlob')) {
  t = t.replace(
    /function parseShtatkaXlsxBuffer\(buf\)\s*\{/,
    "function kmStripArchiveXlsxBlob(a) {\n    /* KM_NO_XLSX_STORE_V1 */\n    if (!a || typeof a !== 'object') return a;\n    if (a.base64) a.base64 = '';\n    if (/spreadsheetml|\\.xlsx/i.test(String(a.mime || ''))) a.mime = 'application/x-km-unit-archive+json';\n    if (typeof a.name === 'string') a.name = a.name.replace(/\\.xlsx?$/i, '');\n    return a;\n  }\n  function parseShtatkaXlsxBuffer(buf) {"
  );
}

t = t.replace(
  /function replaceUnitExcelArchive\(entry\)\s*\{\s*ensureStore\(\);\s*if\s*\(!entry\)\s*return;/,
  "function replaceUnitExcelArchive(entry) {\n    ensureStore();\n    if (!entry) return;\n    /* KM_NO_XLSX_STORE_V1 */\n    try { kmStripArchiveXlsxBlob(entry); } catch (eStrip) {}"
);

if (!t.includes('KM_NO_XLSX_STORE_V1')) {
  console.error('patch failed — no marker');
  process.exit(1);
}
fs.writeFileSync(p, t, 'utf8');
console.log('OK markers', (t.match(/KM_NO_XLSX_STORE_V1/g) || []).length, p);
