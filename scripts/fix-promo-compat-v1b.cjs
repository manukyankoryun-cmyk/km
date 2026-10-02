'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(process.argv[2], 'app/js/km-positions.js');
let t = fs.readFileSync(p, 'utf8');
if (t.includes('KM_PROMO_CODE_HIERARCHY_V1b')) {
  console.log('already v1b');
} else {
  const start = t.indexOf('function kmStaffingCodesCompatible(a, b)');
  if (start < 0) throw new Error('compat missing');
  const end = t.indexOf('window.kmNormStaffingCode', start);
  if (end < 0) throw new Error('export missing');
  const good = `function kmStaffingCodesCompatible(a, b) {
    /* KM_PROMO_CODE_HIERARCHY_V1b — equal grade, or higher grade in SAME shape (19→20/23; not 19→3/6) */
    var ga = kmStaffingGradeToken(a);
    var gb = kmStaffingGradeToken(b);
    if (!ga || !gb) {
      var na0 = kmNormStaffingCode(a);
      var nb0 = kmNormStaffingCode(b);
      return !!(na0 && nb0 && na0 === nb0);
    }
    if (ga === gb) return true;
    var slashA = ga.indexOf('/') >= 0;
    var slashB = gb.indexOf('/') >= 0;
    if (slashA !== slashB) return false;
    var va = kmStaffingGradeValue(ga);
    var vb = kmStaffingGradeValue(gb);
    if (va == null || vb == null) return false;
    return vb >= va;
  }
  `;
  t = t.slice(0, start) + good + t.slice(end);
  fs.writeFileSync(p, t);
  console.log('wrote v1b');
}
// self-test
eval(t.slice(t.indexOf('function kmNormStaffingCode'), t.indexOf('window.kmNormStaffingCode')));
const cases = [['19','19'],['19','20'],['19','23'],['19','18'],['19','12'],['19','3/6'],['19','850300'],['23','19'],['3/6','5/3'],['3/6','3/2']];
for (const [a,b] of cases) console.log(a, '->', b, kmStaffingCodesCompatible(a,b));
