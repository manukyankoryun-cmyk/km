'use strict';
const fs = require('fs');
const p = process.argv[2];
let t = fs.readFileSync(p, 'utf8');

// remove duplicate mime line
t = t.replace(
  /mime: 'application\/x-km-unit-archive\+json',\r?\n(\s*)mime: 'application\/x-km-unit-archive\+json',/g,
  "mime: 'application/x-km-unit-archive+json',"
);

// name without xlsx extension in KM_NO_XLSX store block
t = t.replace(
  /replaceUnitExcelArchive\(\{ \/\* KM_NO_XLSX_STORE_V1 \*\/\r?\n(\s*)id:([^\n]+)\r?\n\1name: file\.name,/g,
  "replaceUnitExcelArchive({ /* KM_NO_XLSX_STORE_V1 */\n$1id:$2\n$1name: String(file.name || '').replace(/\\.xlsx?$/i, '').trim() || '\u0536\u0578\u0580\u0561\u0574\u0561\u057d\u056b \u0570\u0561\u057d\u057f\u056b\u0584\u0561\u0575\u056b\u0576 \u0561\u0580\u056d\u056b\u057e',"
);

// JSON import
if (!t.includes('KM_NO_XLSX_JSON_IMPORT_V1')) {
  const needle = 'var buf = await file.arrayBuffer();\n          var rows = await parseShtatkaXlsxBuffer(buf);';
  const repl =
    'var rows;\n' +
    '          /* KM_NO_XLSX_JSON_IMPORT_V1 */\n' +
    '          if (/\\.json$/i.test(file.name) || (file.type && /json/i.test(file.type))) {\n' +
    '            var txt = await file.text();\n' +
    '            var parsed = JSON.parse(txt);\n' +
    '            rows = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.rows) ? parsed.rows : []);\n' +
    '          } else {\n' +
    '            var buf = await file.arrayBuffer();\n' +
    '            rows = await parseShtatkaXlsxBuffer(buf);\n' +
    '          }';
  if (!t.includes(needle)) {
    // try CRLF
    const needle2 = needle.replace(/\n/g, '\r\n');
    if (t.includes(needle2)) t = t.replace(needle2, repl.replace(/\n/g, '\r\n'));
    else {
      console.error('onAdd buffer block not found');
      process.exit(1);
    }
  } else {
    t = t.replace(needle, repl);
  }
}

fs.writeFileSync(p, t, 'utf8');
console.log('dupMime', (t.match(/mime: 'application\/x-km-unit-archive\+json',\s*\n\s*mime: 'application\/x-km-unit-archive\+json'/g) || []).length);
console.log('jsonImport', t.includes('KM_NO_XLSX_JSON_IMPORT_V1'));
console.log('nameStrip', t.includes(".replace(/\\.xlsx?/i, '')"));
