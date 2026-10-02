'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const file = path.join(proj, 'app/js/km-unit-tools.js');
let t = fs.readFileSync(file, 'utf8');
const MARK = 'KM_TERMWATCH_UNIT_ARCHIVE_FLOW_V2';
if (t.includes(MARK + '_DONE')) {
  console.log('already');
  process.exit(0);
}

// 1) Formal sheet: keep personal rank separate from post rankSlot (no fallback)
t = t.replace(
  /rankSlot: cell\(r, COL\.rankSlot\),\s*rank: cell\(r, COL\.rank\) \|\| cell\(r, COL\.rankSlot\),/,
  'rankSlot: cell(r, COL.rankSlot),\n' +
  '          /* ' + MARK + ': personal rank must not fall back to post rankSlot */\n' +
  '          rank: cell(r, COL.rank),\n' +
  '          lastAccept: cell(r, COL.lastAccept),'
);
// If COL.lastAccept already exists later in object, we may duplicate - check
if ((t.match(/lastAccept: cell\(r, COL\.lastAccept\)/g) || []).length > 2) {
  console.log('warn: multiple lastAccept cell mappings');
}

// Also position-archive fallback mapping: keep rank separate
t = t.replace(
  /rankSlot: r\.rankSlot \|\| '',\s*rank: r\.rank \|\| r\.rankSlot \|\| '',\s*sourceName: name,/,
  'rankSlot: r.rankSlot || \'\',\n' +
  '          rank: r.rank || \'\',\n' +
  '          sourceName: name,'
);

// people() enrich: keep separate
t = t.replace(
  /name: n,\s*rank: r\.rank \|\| r\.rankSlot \|\| '',\s*rankSlot: r\.rankSlot \|\| '',/,
  'name: n,\n' +
  '          rank: r.rank || \'\',\n' +
  '          rankSlot: r.rankSlot || \'\','
);

// 2) Replace collectTermArchiveRows to ONLY use Unit Archive staff source
{
  const start = t.indexOf('function collectTermArchiveRows');
  if (start < 0) throw new Error('collectTermArchiveRows missing');
  // end at next function at same indent level - find "function syncTermRanksFromArchive" or next "function "
  const end = t.indexOf('function syncTermRanksFromArchive', start);
  if (end < 0) throw new Error('sync after collect missing');
  const neu =
    'function collectTermArchiveRows() {\n' +
    '    /* ' + MARK + ': ONLY 🗄 Զորամասի Արխիվ (kmUnitArchiveStaffSource / unitFormalArchives) */\n' +
    '    var byName = Object.create(null);\n' +
    '    try {\n' +
    '      if (typeof window.kmEnsureHtmlV7UnitArchive === \'function\') {\n' +
    '        try { window.kmEnsureHtmlV7UnitArchive({ noPersist: true }); } catch (eE) {}\n' +
    '      }\n' +
    '      var src = window.kmUnitArchiveStaffSource;\n' +
    '      if (!src || typeof src.rows !== \'function\') return [];\n' +
    '      var uid = \'\';\n' +
    '      try {\n' +
    '        var ctx = typeof window.kmGetOrgContext === \'function\' ? window.kmGetOrgContext() : null;\n' +
    '        uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || \'\').trim();\n' +
    '      } catch (eC) {}\n' +
    '      if (src.hasFormal && !src.hasFormal(uid || undefined)) return [];\n' +
    '      (src.rows(uid || undefined) || []).forEach(function (r) {\n' +
    '        if (!r || r.type === \'section\') return;\n' +
    '        var name = String(r.sourceName || r.name || r.personName || \'\').trim();\n' +
    '        if (!name) return;\n' +
    '        if (typeof window.kmLooksLikePersonName === \'function\' && !window.kmLooksLikePersonName(name)) return;\n' +
    '        var k = name.toLocaleLowerCase(\'hy-AM\');\n' +
    '        if (byName[k]) return;\n' +
    '        byName[k] = {\n' +
    '          name: name,\n' +
    '          post: r.position || r.post || \'\',\n' +
    '          code: r.code || r.vus || \'\',\n' +
    '          rankSlot: r.rankSlot || \'\',\n' +
    '          personRank: r.rank || \'\',\n' +
    '          unit: r.unit || r.section || \'\',\n' +
    '          posOrder: r.seq || r.posOrder || \'\',\n' +
    '          rankOrder: r.rankOrder || \'\',\n' +
    '          lastAccept: r.lastAccept || \'\',\n' +
    '          appointmentDate: r.appointmentDate || r.lastAccept || \'\',\n' +
    '          fromUnitArchive: true\n' +
    '        };\n' +
    '      });\n' +
    '    } catch (eUA) {}\n' +
    '    return Object.keys(byName).map(function (k) { return byName[k]; });\n' +
    '  }\n' +
    '  ';
  t = t.slice(0, start) + neu + t.slice(end);
}

// 3) Replace syncTermRanksFromArchive body to use only collectTermArchiveRows (Unit Archive)
{
  const start = t.indexOf('function syncTermRanksFromArchive');
  if (start < 0) throw new Error('sync missing');
  const end = t.indexOf('window.kmScheduleRankTerm', start);
  if (end < 0) throw new Error('schedule marker missing');
  const neu =
    'function syncTermRanksFromArchive() {\n' +
    '    /* ' + MARK + '_DONE — հոսքը միայն 🗄 Զորամասի Արխիվ */\n' +
    '    window.kmUnitEnsureStores();\n' +
    '    try {\n' +
    '      if (typeof window.kmEnsureHtmlV7UnitArchive === \'function\') {\n' +
    '        window.kmEnsureHtmlV7UnitArchive({ noPersist: true });\n' +
    '      }\n' +
    '    } catch (eEns) {}\n' +
    '    var manual = (db.unitTermWatch.ranks || []).filter(function (r) { return r && !r.autoFromPos; });\n' +
    '    var auto = [];\n' +
    '    var seen = Object.create(null);\n' +
    '    function pushAuto(row, target, years, fromDate, kind, extraNote, currentCanon) {\n' +
    '      if (!target || isTermDismissed(row.name, target)) return;\n' +
    '      var key = row.name.toLocaleLowerCase(\'hy-AM\') + \'|\' + (typeof normRankLocal === \'function\' ? normRankLocal(target) : String(target));\n' +
    '      if (seen[key]) return;\n' +
    '      seen[key] = 1;\n' +
    '      if (!(years && years > 0 && fromDate)) return;\n' +
    '      auto.push({\n' +
    '        id: uid(\'rankAuto\'),\n' +
    '        person: row.name,\n' +
    '        rank: target,\n' +
    '        date: addYearsIso(fromDate, years),\n' +
    '        autoFromPos: true,\n' +
    '        post: row.post || \'\',\n' +
    '        code: row.code || \'\',\n' +
    '        rankSlot: row.rankSlot || \'\',\n' +
    '        currentRank: currentCanon || row.rankSlot || \'\',\n' +
    '        personRank: row.personRank || \'\',\n' +
    '        termYears: years,\n' +
    '        appointedAt: fromDate || \'\',\n' +
    '        unit: row.unit || \'\',\n' +
    '        kind: kind || \'time\',\n' +
    '        note: extraNote || \'\',\n' +
    '        fromUnitArchive: true\n' +
    '      });\n' +
    '    }\n' +
    '    var rows = [];\n' +
    '    try { rows = collectTermArchiveRows() || []; } catch (eR) { rows = []; }\n' +
    '    rows.forEach(function (row) {\n' +
    '      var postCanon = canonExcelRank(row.rankSlot || \'\');\n' +
    '      var personCanon = canonExcelRank(row.personRank || \'\');\n' +
    '      if (!postCanon && !personCanon) return;\n' +
    '      var fromDate = extractStaffAppointedAt(row, null);\n' +
    '      if (!fromDate) fromDate = parseStaffDate(row.lastAccept || row.appointmentDate || row.posOrder || row.rankOrder || \'\');\n' +
    '      var postIdx = RANK_LADDER_LOCAL.indexOf(postCanon);\n' +
    '      var personIdx = RANK_LADDER_LOCAL.indexOf(personCanon);\n' +
    '      /* Համեմատել՝ Կոչում ըստ հաստիքի vs Կոչում */\n' +
    '      if (postIdx >= 0 && personIdx >= 0 && personIdx < postIdx) {\n' +
    '        var step = RANK_LADDER_LOCAL[personIdx + 1] || postCanon;\n' +
    '        var yearsA = rankTermYears(personCanon);\n' +
    '        if (!(yearsA && yearsA > 0)) yearsA = rankTermYears(postCanon) || 2;\n' +
    '        pushAuto(row, step, yearsA, fromDate, \'rankGap\',\n' +
    '          \'🗄 Արխիվ · հաստիքի կոչում՝ \' + (row.rankSlot || postCanon) +\n' +
    '          \' · Կոչում՝ \' + (row.personRank || personCanon) +\n' +
    '          (fromDate ? (\' · նշանակում՝ \' + fromDate) : \'\') +\n' +
    '          \' · կրում՝ \' + yearsA + \'տ\',\n' +
    '          personCanon);\n' +
    '        return;\n' +
    '      }\n' +
    '      var base = postCanon || personCanon;\n' +
    '      var next = nextRankAfter(base);\n' +
    '      var years = rankTermYears(base);\n' +
    '      if (next && years && years > 0) {\n' +
    '        pushAuto(row, next, years, fromDate, \'time\',\n' +
    '          \'🗄 Արխիվ · հաստիքի կոչում՝ \' + (row.rankSlot || base) +\n' +
    '          (row.personRank ? (\' · Կոչում՝ \' + row.personRank) : \'\') +\n' +
    '          (fromDate ? (\' · նշանակում՝ \' + fromDate) : \' · ամսաթիվ չկա\') +\n' +
    '          \' · կրում՝ \' + years + \'տ\',\n' +
    '          base);\n' +
    '      }\n' +
    '    });\n' +
    '    db.unitTermWatch.ranks = manual.concat(auto);\n' +
    '    (function purgeFakeJan1Autos() {\n' +
    '      var cy = (new Date()).getFullYear();\n' +
    '      function badIso(iso) {\n' +
    '        iso = String(iso || \'\').slice(0, 10);\n' +
    '        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) return false;\n' +
    '        if (iso.slice(5) !== \'01-01\') return false;\n' +
    '        var y = Number(iso.slice(0, 4));\n' +
    '        return y >= 1950 && y <= (cy - 2);\n' +
    '      }\n' +
    '      db.unitTermWatch.ranks = (db.unitTermWatch.ranks || []).filter(function (r) {\n' +
    '        if (!r || !r.autoFromPos) return true;\n' +
    '        if (badIso(r.appointedAt) || badIso(r.date)) return false;\n' +
    '        var dy = Number(String(r.date || \'\').slice(0, 4));\n' +
    '        if (dy && dy < (cy - 5)) return false;\n' +
    '        return true;\n' +
    '      });\n' +
    '    })();\n' +
    '    return (db.unitTermWatch.ranks || []).filter(function (r) { return r && r.autoFromPos; }).length;\n' +
    '  }\n' +
    '  ';
  t = t.slice(0, start) + neu + t.slice(end);
}

// 4) UI copy
t = t.replace(
  /Համեմատում է զորամասի արխիվի Կոչում ըստ հաստիքի և Կոչում դաշտերը/,
  'Հոսքը՝ 🗄 Զորամասի Արխիվ։ Համեմատում է Կոչում ըստ հաստիքի և Կոչում դաշտերը'
);

fs.writeFileSync(file, t);
fs.copyFileSync(file, path.join(live, 'js/km-unit-tools.js'));
console.log('ok', t.includes(MARK + '_DONE'));
console.log('collectOnlyUA', t.includes('ONLY') && t.includes('kmUnitArchiveStaffSource'));
console.log('rankNoFallback', t.includes('personal rank must not fall back'));
console.log('lastAcceptCell', t.includes('lastAccept: cell(r, COL.lastAccept)'));
