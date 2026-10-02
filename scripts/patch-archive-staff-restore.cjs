'use strict';
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || path.join(__dirname, '..');

function write(p, t) { fs.writeFileSync(p, t, 'utf8'); console.log('WROTE', path.relative(root, p)); }

// 1) Stop emptyStaffApi from killing real staff source in 3 files
const killFiles = ['app/js/km-ops.js', 'app/js/km-positions.js', 'app/js/km-troop-structure.js'];
const killNeedle = '  // Kill unified formal staff source\n  window.kmUnitArchiveStaffSource = emptyStaffApi();';
const killRepl =
  '  // KM_RESTORE_ARCHIVE_STAFF_V1 — do NOT wipe real kmUnitArchiveStaffSource from km-unit-tools.js\n' +
  '  if (!(window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal && !window.kmUnitArchiveStaffSource.__kmEmptyStub)) {\n' +
  '    var __emptyStaff = emptyStaffApi();\n' +
  '    __emptyStaff.__kmEmptyStub = true;\n' +
  '    window.kmUnitArchiveStaffSource = __emptyStaff;\n' +
  '  }';
for (const rel of killFiles) {
  const p = path.join(root, rel);
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes('KM_RESTORE_ARCHIVE_STAFF_V1')) { console.log('skip kill already', rel); continue; }
  if (!t.includes(killNeedle)) {
    // try CRLF
    const n2 = killNeedle.replace(/\n/g, '\r\n');
    const r2 = killRepl.replace(/\n/g, '\r\n');
    if (t.includes(n2)) { t = t.replace(n2, r2); write(p, t); continue; }
    console.error('kill needle missing', rel);
    process.exit(1);
  }
  t = t.replace(killNeedle, killRepl);
  write(p, t);
}

// 2) unit-tools: fall back to positionArchives object-rows when formal sheet missing
const ut = path.join(root, 'app/js/km-unit-tools.js');
let u = fs.readFileSync(ut, 'utf8');
if (!u.includes('KM_POSITION_ARCHIVE_STAFF_FALLBACK_V1')) {
  // patch hasFormal
  u = u.replace(
    /function hasFormal\(unitId\) \{\s*var sheet = getSheet\(unitId\);\s*return !!\(sheet && sheet\.rows && sheet\.rows\.length\);\s*\}/,
    `function hasFormal(unitId) {\n      /* KM_POSITION_ARCHIVE_STAFF_FALLBACK_V1 */\n      var sheet = getSheet(unitId);\n      if (sheet && sheet.rows && sheet.rows.length) return true;\n      return !!pickPositionArchive(unitId);\n    }`
  );
  // insert pickPositionArchive + rowsFromPositionArchive before getSheet
  if (!u.includes('function pickPositionArchive')) {
    const anchor = 'function getSheet(unitId) {';
    const helper = `
    function pickPositionArchive(unitId) {
      /* KM_POSITION_ARCHIVE_STAFF_FALLBACK_V1 */
      if (typeof db === 'undefined' || !db) return null;
      var uid = activeUnitId(unitId);
      var lists = [];
      if (Array.isArray(db.positionArchives)) lists.push(db.positionArchives);
      try {
        var cd = db.kmCorpsData;
        if (cd && typeof cd === 'object') {
          Object.keys(cd).forEach(function (k) {
            if (cd[k] && Array.isArray(cd[k].positionArchives)) lists.push(cd[k].positionArchives);
          });
        }
      } catch (eCd) {}
      var best = null;
      lists.forEach(function (list) {
        (list || []).forEach(function (a) {
          if (!a || a.builtin || !Array.isArray(a.rows) || !a.rows.length) return;
          if (uid) {
            var au = String(a.unitId || '').trim();
            if (au && au !== uid) return;
          }
          if (!best || a.rows.length > best.rows.length) best = a;
        });
      });
      return best;
    }
    function rowsFromPositionArchive(unitId) {
      /* KM_POSITION_ARCHIVE_STAFF_FALLBACK_V1 */
      var arch = pickPositionArchive(unitId);
      if (!arch) return [];
      var uid = activeUnitId(unitId);
      var out = [];
      arch.rows.forEach(function (r, ri) {
        if (!r) return;
        if (r.type === 'section' || r.type === 'header' || r.type === 'title') {
          out.push({
            type: 'section',
            unit: r.unit || r.section || r.position || '',
            archId: String(arch.id || ''),
            archName: arch.name || 'UnitArchive',
            excelRow: r.excelRow != null ? r.excelRow : (ri + 1),
            fromFormal: true,
            fromPositionArchive: true
          });
          return;
        }
        if (r.type && r.type !== 'row') return;
        var name = String(r.name || r.sourceName || r.personName || '').trim();
        if (name && !looksName(name)) name = '';
        var position = String(r.position || '').trim();
        var code = String(r.code || r.postCode || r.vus || '').trim();
        var unit = String(r.unit || r.section || '').trim();
        if (!name && !code && !position && !unit) return;
        out.push({
          type: 'row',
          unit: unit,
          position: position,
          seq: r.seq || '',
          secret: r.secret || '',
          vus: r.vus || '',
          code: code,
          rankSlot: r.rankSlot || '',
          rank: r.rank || r.rankSlot || '',
          sourceName: name,
          name: name,
          personName: name,
          education: r.education || '',
          specialty: r.specialty || r.vus || '',
          birth: r.birth || '',
          idCard: r.idCard || '',
          contact: r.contact || r.phone || '',
          address: r.address || '',
          vacation: r.vacation || '',
          vacant: !!r.vacant || !name,
          archId: String(arch.id || ''),
          archName: arch.name || 'UnitArchive',
          excelRow: r.excelRow != null ? r.excelRow : (ri + 1),
          fromFormal: true,
          fromPositionArchive: true
        });
      });
      return out;
    }
    function getSheet(unitId) {`;
    if (!u.includes(anchor)) { console.error('getSheet anchor missing'); process.exit(1); }
    u = u.replace(anchor, helper);
  }
  // patch rows() to fallback
  u = u.replace(
    /function rows\(unitId\) \{\s*var sheet = getSheet\(unitId\);\s*if \(!sheet\) return \[\];/,
    `function rows(unitId) {\n      var sheet = getSheet(unitId);\n      if (!sheet) return rowsFromPositionArchive(unitId);`
  );
  write(ut, u);
} else console.log('unit-tools already fallback');

// 3) positions: fix vacant want[] bug + labels
const pp = path.join(root, 'app/js/km-positions.js');
let p = fs.readFileSync(pp, 'utf8');
let ch = 0;
if (p.includes('if (!want[rated]) return;')) {
  p = p.replace(
    /var rated = promoPosRank\(\{ rankSlot: r\.rankSlot, rank: r\.rankSlot \|\| r\.rank \}\);\s*if \(!want\[rated\]\) return;\s*/g,
    '/* KM_PROMOTION_VACANT_NO_RANK_FILTER_V1 — vacant by staffing code + unit archive only */\n        '
  );
  ch++;
}
const labels = [
  ['Թափուր պաշտոններ Excel շտատկայից՝ ըստ հաստիքային կոդի կառուցվածքի',
   'Թափուր պաշտոններ զորամասի արխիվից՝ ըստ հաստիքային կոդի կառուցվածքի'],
  ['Թափուր պաշտոններ Excel շտատկայից՝ ըստ հաստիքային կոդի կառուցվածքի',
   'Թափուր պաշտոններ զորամասի արխիվից՝ ըստ հաստիքային կոդի կառուցվածքի'],
];
// exact from file variants
[
  ['Excel շտատկայից', 'զորամասի արխիվից'],
  ['Excel շտատկան կպահպանվի', 'զորամասի արխիվը կթարմացվի'],
  ['Excel-ը պահպանվեց', 'զորամասի արխիվը թարմացվեց'],
  ['Excel հաստիքային կոչումը', 'Արխիվի հաստիքային կոչումը'],
].forEach(([a,b]) => {
  if (p.includes(a)) { p = p.split(a).join(b); ch++; console.log('label', a, '->', b); }
});
if (!p.includes('KM_PROMO_ARCHIVE_LABEL_V1')) {
  p = p.replace(
    "el.id = 'kmPosModal';",
    "el.id = 'kmPosModal'; /* KM_PROMO_ARCHIVE_LABEL_V1 */"
  );
  ch++;
}
if (ch) write(pp, p); else console.log('positions labels/vacant unchanged?', ch);

console.log('DONE');
