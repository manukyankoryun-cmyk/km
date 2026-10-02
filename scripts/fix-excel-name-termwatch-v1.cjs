'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const NEW = 'Զորամասի հաստիքային արխիվ';

function patchFile(rel) {
  const p = path.join(proj, rel);
  if (!fs.existsSync(p)) { console.log('skip missing', rel); return false; }
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  t = t.split('Excel-ի պաշտոնի կոչումով').join('զորամասի արխիվի պաշտոնի կոչումով');
  t = t.split('Excel-ի պաշտոնի').join('զորամասի արխիվի պաշտոնի');
  // SHTATKA display names left in source strings
  t = t.replace(/SHTATKA\s*նոր\s*31\.08\.2025\.xlsx/gi, NEW);
  t = t.replace(/SHTATKA\s*նոր\s*31\.08\.2025/gi, NEW);
  if (rel.endsWith('km-positions.js') && !t.includes('KM_SANITIZE_SHTATKA_NAME_ON_READ_V2')) {
    const needle = "if (typeof a.name === 'string') a.name = a.name.replace(/\\.xlsx?$/i, '');";
    const repl =
      "if (typeof a.name === 'string') {\n" +
      "      /* KM_SANITIZE_SHTATKA_NAME_ON_READ_V2 */\n" +
      "      if (/SHTATKA/i.test(a.name) || /\\.xlsx?$/i.test(a.name)) a.name = '" + NEW + "';\n" +
      "      else a.name = a.name.replace(/\\.xlsx?$/i, '');\n" +
      "    }";
    if (t.includes(needle)) t = t.replace(needle, repl);
    else console.log('sanitize needle missing in positions');
  }
  if (t !== before) {
    fs.writeFileSync(p, t);
    console.log('patched', rel);
  } else console.log('no change', rel);
  return t !== before;
}

patchFile('app/js/km-unit-tools.js');
patchFile('app/js/km-positions.js');
patchFile('app/js/km-org-context.js');

// copy to live
['km-unit-tools.js', 'km-positions.js', 'km-org-context.js'].forEach(function (f) {
  const src = path.join(proj, 'app/js', f);
  const dst = path.join(live, 'js', f);
  if (fs.existsSync(src) && fs.existsSync(path.dirname(dst))) {
    fs.copyFileSync(src, dst);
    console.log('copied', f);
  }
});

// verify UI + archive name
const ut = fs.readFileSync(path.join(proj, 'app/js/km-unit-tools.js'), 'utf8');
console.log('uiFixed', ut.includes('զորամասի արխիվի պաշտոնի կոչումով') && !ut.includes('Excel-ի պաշտոնի կոչումով'));

const snap = 'C:/Users/PUBG/AppData/Local/KM/UserData/database_snapshot.json';
const o = JSON.parse(fs.readFileSync(snap, 'utf8'));
const db = o.db || o;
const names = (db.positionArchives || []).map(a => a.name);
console.log('archiveNames', names);
const bad = JSON.stringify(o).match(/SHTATKA[^\"\\]{0,40}/gi);
console.log('remainingSHTATKA', bad ? bad.slice(0, 8) : []);
