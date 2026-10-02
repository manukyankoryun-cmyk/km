'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const p = path.join(proj, 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');
const MARK = 'KM_PROMO_NEXT_RANK_VACANTS_V1';

if (t.includes(MARK + ' helpers')) {
  // strip previous helper block if re-run
  t = t.replace(/\/\* === KM_PROMO_NEXT_RANK_VACANTS_V1 helpers ===[\s\S]*?\/\* === \/KM_PROMO_NEXT_RANK_VACANTS_V1 helpers === \*\/\r?\n?/, '');
}

const helpers = `
/* === ${MARK} helpers === */
function kmPromoNormRank_V1(s) {
  var t = String(s || '').toLowerCase().replace(/և/g, 'եւ').replace(/\\s+/g, ' ').trim();
  if (!t) return '';
  if (/^(մ-ր|մր|մայոր)\\b/.test(t) || t.indexOf('մայոր') >= 0) return 'մայոր';
  if (/^(կ-ն|կն|կապիտան)\\b/.test(t) || t.indexOf('կապիտան') >= 0) return 'կապիտան';
  if (/փ\\/?գ-տ|փոխգնդապետ/.test(t)) return 'փոխգնդապետ';
  if (/^(գ-տ|գտ)\\b/.test(t) || t.indexOf('գնդապետ') >= 0) return 'գնդապետ';
  if (/ավ\\/?լ-տ|ավագ լեյտենանտ/.test(t)) return 'ավագ լեյտենանտ';
  if (/^(լ-տ|լտ)\\b/.test(t) || t.indexOf('լեյտենանտ') >= 0) return 'լեյտենանտ';
  return t;
}
function kmPromoNextRank_V1(personRank) {
  var r = kmPromoNormRank_V1(personRank);
  var ladder = [
    ['լեյտենանտ', 'ավագ լեյտենանտ'],
    ['ավագ լեյտենանտ', 'կապիտան'],
    ['կապիտան', 'մայոր'],
    ['մայոր', 'փոխգնդապետ'],
    ['փոխգնդապետ', 'գնդապետ']
  ];
  for (var i = 0; i < ladder.length; i++) {
    if (r === ladder[i][0] || r.indexOf(ladder[i][0]) >= 0) return ladder[i][1];
  }
  return '';
}
/** Code 19 (կապիտան) → major band 20–24; other plain grades → +1 … +5 capped in decade */
function kmPromoCodeBand_V1(wantCode) {
  var g = (typeof kmStaffingGradeToken === 'function') ? kmStaffingGradeToken(wantCode) : String(wantCode || '').replace(/\\s+/g, '');
  if (!g || g.indexOf('/') >= 0) return null;
  var c = parseInt(g, 10);
  if (!c) return null;
  if (c === 19) return { min: 20, max: 24 };
  if (c === 18) return { min: 19, max: 19 };
  return { min: c + 1, max: Math.min(c + 5, Math.floor(c / 10) * 10 + 9) };
}
function kmPromoPersonRank_V1() {
  try {
    var p = window.__kmPromoPersonRef;
    if (p) {
      var r = p.rank || p.rankSlot || p.կոչում || p.grade || '';
      if (r) return String(r);
    }
  } catch (e) {}
  return '';
}
function kmPromoVacantMatchesNext_V1(rec, wantCode) {
  var next = kmPromoNextRank_V1(kmPromoPersonRank_V1());
  // Fallback: staffing code 19 ⇒ next major even if person rank field empty
  if (!next) {
    var wg = (typeof kmStaffingGradeToken === 'function') ? kmStaffingGradeToken(wantCode) : String(wantCode || '');
    if (String(wg) === '19') next = 'մայոր';
    else if (String(wg) === '18') next = 'կապիտան';
  }
  var postRank = kmPromoNormRank_V1(rec && (rec.rank || rec.rankSlot || ''));
  var isNext = !!(next && postRank && postRank === next);
  var band = kmPromoCodeBand_V1(wantCode);
  var pcNum = parseInt(String((rec && rec.code) || '').replace(/\\s+/g, ''), 10);
  var inBand = !!(band && pcNum && pcNum >= band.min && pcNum <= band.max);
  return !!(isNext || inBand);
}
function kmPromoHintText_V1(wantCode) {
  var next = kmPromoNextRank_V1(kmPromoPersonRank_V1()) || (String(wantCode) === '19' ? 'մայոր' : 'հաջորդ');
  var band = kmPromoCodeBand_V1(wantCode);
  if (band) return 'հաջորդ կոչման (' + next + ') թափուր հաստիքներ՝ կոդ ' + band.min + '–' + band.max;
  return 'հաջորդ կոչման (' + next + ') թափուր հաստիքներ';
}
/* === /${MARK} helpers === */
`;

// Insert helpers before promoVacantForPerson
const anchor = t.indexOf('function promoVacantForPerson');
if (anchor < 0) throw new Error('promoVacantForPerson missing');
t = t.slice(0, anchor) + helpers + '\n  ' + t.slice(anchor);

// Rewrite pushIf filter inside promoVacantForPerson
const vacantStart = t.indexOf('function promoVacantForPerson');
const vacantEnd = t.indexOf('function promoVacantForNextRank', vacantStart);
if (vacantEnd < 0) throw new Error('promoVacantForNextRank missing');
let vacant = t.slice(vacantStart, vacantEnd);
vacant = vacant.replace(
  /var ok = \(typeof kmStaffingCodesCompatible === 'function'\) \? kmStaffingCodesCompatible\(wantCode, pc\) : \(String\(pc\)\.replace\(\/\\s\+\/g,''\)\.toLowerCase\(\) === wantCode\);\s*if \(!ok\) return;/,
  `/* ${MARK} — next rank (Կոչում ըստ հաստիքի) OR code band; not unlimited higher code */\n` +
    `      var ok = (typeof kmPromoVacantMatchesNext_V1 === 'function')\n` +
    `        ? kmPromoVacantMatchesNext_V1(rec, wantCode)\n` +
    `        : ((typeof kmStaffingCodesCompatible === 'function') ? kmStaffingCodesCompatible(wantCode, pc) : (String(pc).replace(/\\s+/g,'').toLowerCase() === wantCode));\n` +
    `      if (!ok) return;`
);
// Allow empty code if rank matches (majors with blank/vus-only non-grade)
vacant = vacant.replace(
  /var pc = String\(rec\.code \|\| ''\)\.trim\(\);\s*if \(!pc\) return;/,
  `var pc = String(rec.code || '').trim();\n` +
    `      /* ${MARK}: allow empty code when post rank is next rank */\n` +
    `      if (!pc) {\n` +
    `        var _okRank = (typeof kmPromoVacantMatchesNext_V1 === 'function') && kmPromoVacantMatchesNext_V1(rec, wantCode);\n` +
    `        if (!_okRank) return;\n` +
    `        if (occupied(rec)) return;\n` +
    `        seen[k] = 1;\n` +
    `        out.push(rec);\n` +
    `        return;\n` +
    `      }`
);
t = t.slice(0, vacantStart) + vacant + t.slice(vacantEnd);

// UI hint in modal open
t = t.replace(
  /\('Հաստիքային կոդ՝ <b>' \+ esc\(staffingCode\) \+ '<\/b> · առաջարկները՝ նույն հաստիքային կոդը կամ ավելի բարձր \(օր\. 19→19\/20\/23\)'\)/,
  `('Հաստիքային կոդ՝ <b>' + esc(staffingCode) + '</b> · ' + (typeof kmPromoHintText_V1 === 'function' ? kmPromoHintText_V1(staffingCode) : 'հաջորդ կոչման թափուր հաստիքներ'))`
);

// Section label
t = t.replace(
  /Թափուր պաշտոններ այս զորամասում՝ նույն կամ ավելի բարձր հաստիքային կոդ \(բոլորը\)/,
  'Թափուր պաշտոններ այս զորամասում՝ հաջորդ կոչում (բոլորը)'
);

fs.writeFileSync(p, t);
console.log('helpers', t.includes(MARK + ' helpers'));
console.log('matchNext', t.includes('kmPromoVacantMatchesNext_V1(rec'));
console.log('emptyCodeAllow', t.includes('allow empty code when post rank'));
console.log('hint', t.includes('kmPromoHintText_V1(staffingCode)'));
