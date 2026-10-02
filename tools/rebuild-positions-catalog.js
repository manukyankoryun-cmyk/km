'use strict';
/**
 * Build Պաշտոն catalog from Զորամասի հաստիքային արխիվ
 * Columns: A=unit B=position C=code D=rankSlot E=name
 */
const fs = require('fs');
const path = require('path');
const JSZip = require('../app/vendor/jszip.min.js');

const root = path.resolve(__dirname, '..');
const src = 'c:/Users/PUBG/OneDrive/Desktop/Զորամասի հաստիքային արխիվ';

function decodeXml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

(async () => {
  const buf = fs.readFileSync(src);
  const zip = await JSZip.loadAsync(buf);
  const ss = zip.file('xl/sharedStrings.xml')
    ? await zip.file('xl/sharedStrings.xml').async('string') : '';
  const shared = [];
  const siRe = /<si(?:[^>]*)>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(ss))) {
    const parts = [];
    const tRe = /<t(?:[^>]*)>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRe.exec(m[1]))) parts.push(tm[1]);
    shared.push(decodeXml(parts.join('')));
  }
  function cellValue(cXml) {
    const t = (cXml.match(/\bt="([^"]+)"/) || [])[1];
    const v = (cXml.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    if (v == null) {
      const is = cXml.match(/<is>[\s\S]*?<t(?:[^>]*)>([\s\S]*?)<\/t>/);
      return is ? decodeXml(is[1]) : '';
    }
    if (t === 's') return shared[Number(v)] || '';
    return String(v);
  }

  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const byRow = {};
  let maxR = 0;
  const rowRe = /<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(sheet))) {
    const rnum = Number(rm[1]);
    if (rnum > maxR) maxR = rnum;
    const cells = {};
    const cRe = /<c[^>]*\br="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cRe.exec(rm[2]))) {
      cells[cm[1]] = String(cellValue(cm[0]) || '').trim();
    }
    byRow[rnum] = {
      a: cells['A' + rnum] || '',
      b: cells['B' + rnum] || '',
      c: cells['C' + rnum] || '',
      d: cells['D' + rnum] || '',
      e: cells['E' + rnum] || ''
    };
  }

  const sections = [];
  const positions = [];
  const sectionIndex = Object.create(null);
  let seq = 0;

  function sectionOf(unitName) {
    const name = String(unitName || '').trim() || 'Այլ';
    if (sectionIndex[name] != null) return sections[sectionIndex[name]];
    const id = 's' + sections.length;
    const s = { id: id, name: name, order: sections.length };
    sectionIndex[name] = sections.length;
    sections.push(s);
    return s;
  }

  for (let r = 3; r <= maxR; r++) {
    const row = byRow[r];
    if (!row) continue;
    const unit = row.a;
    const position = row.b;
    const code = row.c;
    const rankSlot = row.d;
    const name = row.e;
    if (!position && !name && !unit) continue;
    if (!position) continue;
    // skip header leftovers
    if (position === 'Պաշտոն' || unit === 'Ստորաբաժանում') continue;
    seq++;
    const sec = sectionOf(unit);
    positions.push({
      id: 'p' + (positions.length),
      sectionId: sec.id,
      section: sec.name,
      unit: unit,
      position: position,
      seq: String(seq),
      code: code,
      rankSlot: rankSlot,
      sourceName: name,
      excelRow: r
    });
  }

  const catalog = {
    title: (byRow[1] && (byRow[1].c || byRow[1].a)) || 'Պաշտոն',
    source: 'Զորամասի հաստիքային արխիվ',
    layout: 'unitPosCodeRankName',
    importedAt: new Date().toISOString().slice(0, 10),
    sections: sections,
    positions: positions
  };

  const outJson = path.join(root, 'app', 'data', 'km_shtat_catalog.json');
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(catalog), 'utf8');

  const dataJs =
    '/* KM — Պաշտոն catalog from Զորամասի հաստիքային արխիվ */\n' +
    '(function(){\n' +
    "'use strict';\n" +
    'window.KM_SHTAT_CATALOG=' + JSON.stringify(catalog) + ';\n' +
    '})();\n';
  fs.writeFileSync(path.join(root, 'app', 'js', 'km-shtat-catalog-data.js'), dataJs.replace(/\n/g, '\r\n'), 'utf8');

  console.log('sections', sections.length);
  console.log('positions', positions.length);
  console.log('named', positions.filter((p) => p.sourceName).length);
  console.log('sample', sections.slice(0, 8).map((s) => s.name + ':' + positions.filter((p) => p.sectionId === s.id).length).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
