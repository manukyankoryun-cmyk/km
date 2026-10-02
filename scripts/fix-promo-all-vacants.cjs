'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(process.argv[2], 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');

// 1) In promoVacantForPerson: set code via kmRowStaffingCode
const vacantStart = t.indexOf('function promoVacantForPerson');
const vacantEnd = t.indexOf('function promoVacantForNextRank', vacantStart);
if (vacantStart < 0 || vacantEnd < 0) throw new Error('vacant span missing');
let vacant = t.slice(vacantStart, vacantEnd);
if (!vacant.includes('KM_PROMO_ALL_UNIT_VACANTS_V1')) {
  vacant = vacant.replace(
    /code: r\.code \|\| '',\s*personName: pname,/,
    "code: (typeof kmRowStaffingCode === 'function' ? kmRowStaffingCode(r) : (r.code || r.vus || '')),\n" +
      "          personName: pname,"
  );
  vacant = vacant.replace(
    /rec\.code = r\.code \|\| rec\.code \|\| '';/,
    "rec.code = (typeof kmRowStaffingCode === 'function' ? kmRowStaffingCode(r) : (r.code || r.vus || rec.code || '')); /* KM_PROMO_ALL_UNIT_VACANTS_V1 */"
  );
  // occupied: treat empty name / vacant flag as free
  vacant = vacant.replace(
    /function occupied\(rec\) \{[\s\S]*?return !!promoResolveName\(rec, blob\);\s*\}/,
    `function occupied(rec) {
      if (rec && (rec.vacant === true || rec._vacant === true)) return false;
      var asg = blob.positionAssignments && blob.positionAssignments[rec.id];
      if (asg && asg.vacant) return false;
      if (asg && asg.manual && asg.personName && looksLikePersonName(asg.personName)) return true;
      var nm = promoResolveName(rec, blob);
      if (!nm) return false;
      return !!looksLikePersonName(nm);
    }`
  );
  // keep vacant flag from row
  vacant = vacant.replace(
    /catalogId: r\.catalogId \|\| r\.id \|\| ''\s*\};/,
    "catalogId: r.catalogId || r.id || '',\n" +
      "          vacant: !!(r.vacant || !String(r.name || r.sourceName || r.personName || '').trim())\n" +
      "        };"
  );
  t = t.slice(0, vacantStart) + vacant + t.slice(vacantEnd);
}

// 2) fillPos: do not require eligibleRanks (rank ladder); use staffingCode only
t = t.replace(
  /if \(!eligibleRanks\.length\) \{\s*listEl\.innerHTML = '<p class="muted"[^;]+;\s*return;\s*\}/,
  `if (!staffingCode) {
        listEl.innerHTML = '<p class="muted" style="margin:10px;font-size:13px">Անձի հաստիքային կոդը բացակայում է։</p>';
        return;
      }`
);

// 3) On confirm: remove rank-fit block (code-based promotion)
if (!t.includes('KM_PROMO_CONFIRM_NO_RANK_V1')) {
  t = t.replace(
    /promoApplyExcelFacts\(picked, cid, uid\);\s*var excelRank = promoPosRank\(picked\);\s*if \(!promoPersonFitsPost\(curRank, excelRank\)\) \{[\s\S]*?return;\s*\}/,
    `/* KM_PROMO_CONFIRM_NO_RANK_V1 — promotion by staffing code list; no rank gate */\n` +
      `      var excelRank = promoPosRank(picked);`
  );
}

// 4) UI copy: all vacants in unit
t = t.replace(
  /Թափուր պաշտոններ զորամասի արխիվից՝ նույն կամ ավելի բարձր հաստիքային կոդ/,
  'Թափուր պաշտոններ այս զորամասում՝ նույն կամ ավելի բարձր հաստիքային կոդ (բոլորը)'
);

fs.writeFileSync(p, t);
const vs = t.slice(t.indexOf('function promoVacantForPerson'), t.indexOf('function promoVacantForNextRank'));
console.log('rowCode in vacant', vs.includes('kmRowStaffingCode'));
console.log('marker', vs.includes('KM_PROMO_ALL_UNIT_VACANTS_V1'));
console.log('confirmNoRank', t.includes('KM_PROMO_CONFIRM_NO_RANK_V1'));
