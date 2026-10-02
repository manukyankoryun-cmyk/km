'use strict';
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const p = path.join(root, 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');

if (!t.includes('KM_PROMO_CODE_HIERARCHY_V1')) {
  const oldCompat = `function kmStaffingCodesCompatible(a, b) {
    var na = kmNormStaffingCode(a);
    var nb = kmNormStaffingCode(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    var sa = kmStaffingCodeStructure(na);
    var sb = kmStaffingCodeStructure(nb);
    if (sa && sb && sa === sb) return true;
    // shared long prefix (>=4) still counts as same structure family
    var lim = Math.min(na.length, nb.length);
    if (lim >= 4 && na.slice(0, lim) === nb.slice(0, lim)) return true;
    if (na.length >= 4 && nb.indexOf(na) === 0) return true;
    if (nb.length >= 4 && na.indexOf(nb) === 0) return true;
    return false;
  }`;

  const newCompat = `function kmStaffingGradeToken(c) {
    /* KM_PROMO_CODE_HIERARCHY_V1 — short grade like 19/20/23 or 3/6; ignore long VUS */
    var n = kmNormStaffingCode(c);
    if (!n) return '';
    if (/^\\d{1,3}$/.test(n)) return n;
    if (/^\\d{1,3}\\/\\d{1,3}$/.test(n)) return n;
    return '';
  }
  function kmStaffingGradeValue(c) {
    var g = kmStaffingGradeToken(c);
    if (!g) return null;
    if (g.indexOf('/') >= 0) {
      var parts = g.split('/');
      return (parseInt(parts[0], 10) || 0) * 1000 + (parseInt(parts[1], 10) || 0);
    }
    return parseInt(g, 10);
  }
  function kmRowStaffingCode(r) {
    if (!r || typeof r !== 'object') return '';
    var code = String(r.code || r.postCode || r.staffingCode || '').trim();
    var vus = String(r.vus || r.specialty || '').trim();
    if (kmStaffingGradeToken(code)) return kmStaffingGradeToken(code);
    if (kmStaffingGradeToken(vus)) return kmStaffingGradeToken(vus);
    return kmNormStaffingCode(code || vus);
  }
  function kmStaffingCodesCompatible(a, b) {
    /* equal OR target higher than source (promotion ladder) */
    var ga = kmStaffingGradeToken(a) || kmNormStaffingCode(a);
    var gb = kmStaffingGradeToken(b) || kmNormStaffingCode(b);
    if (!ga || !gb) return false;
    if (ga === gb) return true;
    var va = kmStaffingGradeValue(ga);
    var vb = kmStaffingGradeValue(gb);
    if (va != null && vb != null) return vb >= va;
    var sa = kmStaffingCodeStructure(ga);
    var sb = kmStaffingCodeStructure(gb);
    if (sa && sb && sa === sb) {
      var ta = ga.slice(sa.length);
      var tb = gb.slice(sb.length);
      var na = parseInt(String(ta).replace(/\\D/g, ''), 10);
      var nb = parseInt(String(tb).replace(/\\D/g, ''), 10);
      if (!isNaN(na) && !isNaN(nb)) return nb >= na;
      return gb >= ga;
    }
    return false;
  }`;

  if (!t.includes(oldCompat)) {
    // tolerant replace of function body by marker start
    const start = t.indexOf('function kmStaffingCodesCompatible(a, b)');
    if (start < 0) { console.error('compat fn missing'); process.exit(1); }
    const end = t.indexOf('window.kmNormStaffingCode', start);
    if (end < 0) { console.error('window export missing'); process.exit(1); }
    t = t.slice(0, start) + newCompat + '\n  ' + t.slice(end);
  } else {
    t = t.replace(oldCompat, newCompat);
  }

  // export new helpers
  if (!t.includes('window.kmRowStaffingCode')) {
    t = t.replace(
      'window.kmStaffingCodesCompatible = kmStaffingCodesCompatible;',
      "window.kmStaffingCodesCompatible = kmStaffingCodesCompatible;\n  window.kmStaffingGradeToken = kmStaffingGradeToken;\n  window.kmStaffingGradeValue = kmStaffingGradeValue;\n  window.kmRowStaffingCode = kmRowStaffingCode;"
    );
  }
}

// Fix vacant list to use row staffing grade (code or short vus)
if (!t.includes('KM_PROMO_ROW_CODE_FROM_VUS_V1')) {
  t = t.replace(
    /promoArchivesFor\(corpsId, unitId, blob\)\.forEach\(function \(arch\) \{\s*\(arch\.rows \|\| \[\]\)\.forEach\(function \(r, i\) \{\s*if \(!r \|\| r\.type === 'section' \|\| !String\(r\.position \|\| ''\)\.trim\(\)\) return;/,
    `promoArchivesFor(corpsId, unitId, blob).forEach(function (arch) {\n      (arch.rows || []).forEach(function (r, i) {\n        if (!r || r.type === 'section' || !String(r.position || '').trim()) return;\n        /* KM_PROMO_ROW_CODE_FROM_VUS_V1 */`
  );
  // when building rec, set code from kmRowStaffingCode
  t = t.replace(
    /(fromArchive: true,\s*virtual: true,\s*archId: arch\.id \|\| '',\s*excelRow: r\.excelRow != null \? r\.excelRow : \(i \+ 1\),\s*seq: r\.seq \|\| '',\s*catalogId: r\.catalogId \|\| r\.id \|\| ''\s*\};)/,
    `fromArchive: true,\n          virtual: true,\n          archId: arch.id || '',\n          excelRow: r.excelRow != null ? r.excelRow : (i + 1),\n          seq: r.seq || '',\n          catalogId: r.catalogId || r.id || ''\n        };\n        /* KM_PROMO_ROW_CODE_FROM_VUS_V1 */\n        rec.code = (typeof kmRowStaffingCode === 'function' ? kmRowStaffingCode(r) : (r.code || r.vus || rec.code || ''));`
  );
}

// Person staffing code: prefer short grade from vus/code
if (!t.includes('KM_PROMO_PERSON_GRADE_V1')) {
  t = t.replace(
    /var staffingCode = String\(\s*\(person && \(person\.postCode \|\| person\.posCode \|\| person\.code \|\| person\.staffCode \|\| person\.vus\)\) \|\| ''\s*\)\.trim\(\);/,
    `var staffingCode = '';\n    /* KM_PROMO_PERSON_GRADE_V1 */\n    try {\n      var _rawCode = String((person && (person.postCode || person.posCode || person.code || person.staffCode || person.vus)) || '').trim();\n      var _rawVus = String((person && (person.vus || person.specialty || person.postCode)) || '').trim();\n      if (typeof kmStaffingGradeToken === 'function') {\n        staffingCode = kmStaffingGradeToken(_rawCode) || kmStaffingGradeToken(_rawVus) || _rawCode;\n      } else {\n        staffingCode = _rawCode;\n      }\n    } catch (eGrade) { staffingCode = String((person && (person.postCode || person.code || person.vus)) || '').trim(); }`
  );
}

// UI hint text
t = t.replace(
  /առաջարկները միայն նույն կոդային կառուցվածքի թափուր պաշտոններն են \(կոչումով համեմատություն չկա\)/,
  'առաջարկները՝ նույն հաստիքային կոդը կամ ավելի բարձր (օր. 19→19/20/23)'
);
t = t.replace(
  /Թափուր պաշտոններ զորամասի արխիվից՝ ըստ հաստիքային կոդի կառուցվածքի/,
  'Թափուր պաշտոններ զորամասի արխիվից՝ նույն կամ ավելի բարձր հաստիքային կոդ'
);

fs.writeFileSync(p, t, 'utf8');
console.log('patched', p);
console.log('hierarchy', t.includes('KM_PROMO_CODE_HIERARCHY_V1'));
console.log('rowCode', t.includes('KM_PROMO_ROW_CODE_FROM_VUS_V1'));
console.log('personGrade', t.includes('KM_PROMO_PERSON_GRADE_V1'));
