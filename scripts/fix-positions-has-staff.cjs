'use strict';
const fs = require('fs');
const p = process.argv[2];
let t = fs.readFileSync(p, 'utf8');
const bad = `window.kmUnitHasStaffSource = function () {
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.people) && db.people.length) return true;
    } catch (e) {}
    return false;
  };`;
const good = `window.kmUnitHasStaffSource = function (unitId) {
    /* KM_RESTORE_HAS_STAFF_V1 */
    try {
      if (window.kmUnitArchiveStaffSource && window.kmUnitArchiveStaffSource.hasFormal &&
          window.kmUnitArchiveStaffSource.hasFormal(unitId)) return true;
    } catch (e0) {}
    try {
      if (typeof db !== 'undefined' && db && db.unitFormalArchives) {
        var uid = String(unitId != null && String(unitId) !== '' ? unitId : '').trim();
        if (!uid) {
          try {
            var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
            uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
          } catch (eC) {}
        }
        var sh = uid ? db.unitFormalArchives[uid] : null;
        if (sh && Array.isArray(sh.rows) && sh.rows.length) return true;
      }
    } catch (e1) {}
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.positionArchives) &&
          db.positionArchives.some(function (a) { return a && Array.isArray(a.rows) && a.rows.length; })) return true;
    } catch (e2) {}
    try {
      if (typeof db !== 'undefined' && db && Array.isArray(db.people) && db.people.length) return true;
    } catch (e3) {}
    return false;
  };`;
if (!t.includes(bad)) {
  // try CRLF variant
  const bad2 = bad.replace(/\n/g, '\r\n');
  if (t.includes(bad2)) {
    t = t.replace(bad2, good.replace(/\n/g, '\r\n'));
  } else {
    // lastIndex fallback
    const idx = t.lastIndexOf('window.kmUnitHasStaffSource = function ()');
    if (idx < 0) { console.error('not found'); process.exit(1); }
    const end = t.indexOf('return false;\n  };', idx);
    const end2 = t.indexOf('return false;\r\n  };', idx);
    const e = end >= 0 ? end + 'return false;\n  };'.length : (end2 >= 0 ? end2 + 'return false;\r\n  };'.length : -1);
    if (e < 0) { console.error('end not found', t.slice(idx, idx+200)); process.exit(1); }
    t = t.slice(0, idx) + good + t.slice(e);
  }
} else {
  t = t.replace(bad, good);
}
fs.writeFileSync(p, t);
const last = t.lastIndexOf('window.kmUnitHasStaffSource');
console.log(t.slice(last, last+280));
console.log('ok', t.includes('KM_RESTORE_HAS_STAFF_V1'));
