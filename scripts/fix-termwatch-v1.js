'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const file = path.join(proj, 'app/js/km-unit-tools.js');
let t = fs.readFileSync(file, 'utf8');
const MARK = 'KM_TERMWATCH_ARCHIVE_COMPARE_V1';
if (t.includes(MARK + '_DONE')) {
  console.log('already patched');
  process.exit(0);
}

// 1) Replace canonExcelRank
{
  const re = /function canonExcelRank\(rank\) \{[\s\S]*?\n  function rankTermYears/;
  if (!re.test(t)) throw new Error('canon block missing');
  const neu =
    'function canonExcelRank(rank) {\n' +
    '    /* ' + MARK + ' */\n' +
    "    var n = String(rank || '').trim().toLocaleLowerCase('hy-AM').replace(/և/g, 'եւ').replace(/\\s+/g, ' ');\n" +
    "    n = n.replace(/\\./g, '․');\n" +
    "    if (!n) return '';\n" +
    '    if (typeof normRankLocal === \'function\') {\n' +
    '      try { var nn = normRankLocal(n); if (nn) n = String(nn).trim().toLocaleLowerCase(\'hy-AM\').replace(/\\./g, \'․\'); } catch (eN) {}\n' +
    '    }\n' +
    "    if (/^գեներալ/.test(n) || n === 'գեն․' || n === 'գեն' || n === 'գեն.') return 'գեներալ';\n" +
    '    var alias = {\n' +
    "      'շարքային': 'շ-ն', 'շ-ն': 'շ-ն', 'շն': 'շ-ն', 'եֆրեյտոր': 'շ-ն',\n" +
    "      'կրտսեր սերժանտ': 'կրտ․ս-տ', 'կրտ․ս-տ': 'կրտ․ս-տ', 'կրտ.ս-տ': 'կրտ․ս-տ', 'կրտս-տ': 'կրտ․ս-տ',\n" +
    "      'սերժանտ': 'ս-տ', 'ս-տ': 'ս-տ', 'ստ': 'ս-տ',\n" +
    "      'ավագ սերժանտ': 'ավ․ս-տ', 'ավ․ս-տ': 'ավ․ս-տ', 'ավ.ս-տ': 'ավ․ս-տ', 'ավս-տ': 'ավ․ս-տ',\n" +
    "      'ավագ': 'ավագ',\n" +
    "      'ենթասպա': 'ենթասպա', 'հդ ս-տ': 'ենթասպա', 'հդս-տ': 'ենթասպա',\n" +
    "      'ավագ ենթասպա': 'ավագ ենթասպա', 'հվ ս-տ': 'ավագ ենթասպա', 'հգմ -ս-տ': 'ավագ ենթասպա',\n" +
    "      'գնդի սերժանտ': 'ավագ ենթասպա', 'կորպուսի սերժանտ': 'ավագ ենթասպա',\n" +
    "      'լեյտենանտ': 'լ-տ', 'լ-տ': 'լ-տ', 'լտ': 'լ-տ',\n" +
    "      'ավագ լեյտենանտ': 'ավ․լ-տ', 'ավ․լ-տ': 'ավ․լ-տ', 'ավ.լ-տ': 'ավ․լ-տ', 'ավլ-տ': 'ավ․լ-տ',\n" +
    "      'կապիտան': 'կ-ն', 'կ-ն': 'կ-ն', 'կն': 'կ-ն',\n" +
    "      'մայոր': 'մ-ր', 'մ-ր': 'մ-ր', 'մր': 'մ-ր',\n" +
    "      'փոխգնդապետ': 'փ/գ-տ', 'փ/գ-տ': 'փ/գ-տ', 'փգ-տ': 'փ/գ-տ', 'փ.գ-տ': 'փ/գ-տ',\n" +
    "      'գնդապետ': 'գ-տ', 'գ-տ': 'գ-տ', 'գտ': 'գ-տ'\n" +
    '    };\n' +
    '    if (alias[n]) return alias[n];\n' +
    "    var soft = n.replace(/\\s*\\/\\s*/g, '/').replace(/\\s*․\\s*/g, '․');\n" +
    '    return alias[soft] || n;\n' +
    '  }\n' +
    '  function rankTermYears';
  t = t.replace(re, neu);
}

// 2) appoint date fields
t = t.replace(
  /if \(row\) \{\s*parts\.push\(row\.appointmentDate, row\.lastAccept\);\s*\}/,
  'if (row) {\n      parts.push(row.appointmentDate, row.lastAccept, row.posOrder, row.rankOrder, row.appointedAt, row.fromDate);\n    }'
);

// 3) Replace syncTermRanksFromArchive through window.kmScheduleRankTerm
{
  const start = t.indexOf('function syncTermRanksFromArchive');
  if (start < 0) throw new Error('sync missing');
  const end = t.indexOf('window.kmScheduleRankTerm', start);
  if (end < 0) throw new Error('sync end missing');
  const neu =
    'function syncTermRanksFromArchive() {\n' +
    '    /* ' + MARK + '_DONE */\n' +
    '    window.kmUnitEnsureStores();\n' +
    '    var manual = (db.unitTermWatch.ranks || []).filter(function (r) { return r && !r.autoFromPos; });\n' +
    '    var auto = [];\n' +
    '    var seen = Object.create(null);\n' +
    '    function pushAuto(row, target, years, fromDate, kind, extraNote, currentCanon) {\n' +
    '      if (!target || isTermDismissed(row.name, target)) return;\n' +
    "      var key = row.name.toLocaleLowerCase('hy-AM') + '|' + (typeof normRankLocal === 'function' ? normRankLocal(target) : String(target));\n" +
    '      if (seen[key]) return;\n' +
    '      seen[key] = 1;\n' +
    '      if (!(years && years > 0 && fromDate)) return;\n' +
    '      auto.push({\n' +
    "        id: uid('rankAuto'),\n" +
    '        person: row.name,\n' +
    '        rank: target,\n' +
    '        date: addYearsIso(fromDate, years),\n' +
    '        autoFromPos: true,\n' +
    "        post: row.post || '',\n" +
    "        code: row.code || '',\n" +
    "        rankSlot: row.rankSlot || '',\n" +
    "        currentRank: currentCanon || row.rankSlot || '',\n" +
    "        personRank: row.personRank || '',\n" +
    '        termYears: years,\n' +
    "        appointedAt: fromDate || '',\n" +
    "        unit: row.unit || '',\n" +
    "        kind: kind || 'time',\n" +
    "        note: extraNote || ''\n" +
    '      });\n' +
    '    }\n' +
    '    function rowsFromPositionArchives() {\n' +
    '      var out = [];\n' +
    '      try {\n' +
    '        var list = (db && db.positionArchives) || [];\n' +
    "        var unitId = '';\n" +
    '        try {\n' +
    "          var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;\n" +
    "          unitId = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();\n" +
    '        } catch (e0) {}\n' +
    '        (list || []).forEach(function (arch) {\n' +
    '          if (!arch || !Array.isArray(arch.rows)) return;\n' +
    '          if (unitId && arch.unitId && String(arch.unitId) !== unitId) return;\n' +
    '          (arch.rows || []).forEach(function (r) {\n' +
    '            if (!r || r.type === \'section\') return;\n' +
    "            var name = String(r.sourceName || r.name || r.personName || '').trim();\n" +
    '            if (!name) return;\n' +
    "            if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(name)) return;\n" +
    '            out.push({\n' +
    '              name: name,\n' +
    "              post: r.position || '',\n" +
    "              code: r.code || r.vus || '',\n" +
    "              rankSlot: r.rankSlot || '',\n" +
    "              personRank: r.rank || '',\n" +
    "              unit: r.unit || r.section || '',\n" +
    "              appointmentDate: r.appointmentDate || '',\n" +
    "              posOrder: r.posOrder || '',\n" +
    "              rankOrder: r.rankOrder || '',\n" +
    "              lastAccept: r.lastAccept || ''\n" +
    '            });\n' +
    '          });\n' +
    '        });\n' +
    '      } catch (ePA) {}\n' +
    '      return out;\n' +
    '    }\n' +
    '    var rows = [];\n' +
    '    try { rows = collectTermArchiveRows() || []; } catch (eC) { rows = []; }\n' +
    '    var by = Object.create(null);\n' +
    '    (rows || []).forEach(function (r) {\n' +
    '      if (!r || !r.name) return;\n' +
    '      if (!r.personRank && r.rank) r.personRank = r.rank;\n' +
    "      by[r.name.toLocaleLowerCase('hy-AM')] = r;\n" +
    '    });\n' +
    '    rowsFromPositionArchives().forEach(function (r) {\n' +
    "      var k = r.name.toLocaleLowerCase('hy-AM');\n" +
    '      var cur = by[k];\n' +
    '      if (!cur) { by[k] = r; return; }\n' +
    '      if (!cur.rankSlot && r.rankSlot) cur.rankSlot = r.rankSlot;\n' +
    '      if (!cur.personRank && r.personRank) cur.personRank = r.personRank;\n' +
    '      if (!cur.appointmentDate && r.appointmentDate) cur.appointmentDate = r.appointmentDate;\n' +
    '      if (!cur.posOrder && r.posOrder) cur.posOrder = r.posOrder;\n' +
    '      if (!cur.post && r.post) cur.post = r.post;\n' +
    '      if (!cur.code && r.code) cur.code = r.code;\n' +
    '    });\n' +
    '    rows = Object.keys(by).map(function (k) { return by[k]; });\n' +
    '    rows.forEach(function (row) {\n' +
    "      var postCanon = canonExcelRank(row.rankSlot || '');\n" +
    "      var personCanon = canonExcelRank(row.personRank || row.rank || '');\n" +
    '      if (!postCanon && !personCanon) return;\n' +
    '      var fromDate = extractStaffAppointedAt(row, null);\n' +
    "      if (!fromDate) fromDate = parseStaffDate(row.appointmentDate || row.posOrder || row.rankOrder || row.lastAccept || '');\n" +
    '      var postIdx = RANK_LADDER_LOCAL.indexOf(postCanon);\n' +
    '      var personIdx = RANK_LADDER_LOCAL.indexOf(personCanon);\n' +
    '      if (postIdx >= 0 && personIdx >= 0 && personIdx < postIdx) {\n' +
    '        var step = RANK_LADDER_LOCAL[personIdx + 1] || postCanon;\n' +
    '        var yearsA = rankTermYears(personCanon);\n' +
    '        if (!(yearsA && yearsA > 0)) yearsA = rankTermYears(postCanon) || 2;\n' +
    "        pushAuto(row, step, yearsA, fromDate, 'rankGap',\n" +
    "          'Հաստիքի կոչում՝ ' + (row.rankSlot || postCanon) +\n" +
    "          ' · անձնական՝ ' + (row.personRank || personCanon) +\n" +
    "          (fromDate ? (' · նշանակում՝ ' + fromDate) : '') +\n" +
    "          ' · կրում՝ ' + yearsA + 'տ',\n" +
    '          personCanon);\n' +
    '        return;\n' +
    '      }\n' +
    '      var base = postCanon || personCanon;\n' +
    '      var next = nextRankAfter(base);\n' +
    '      var years = rankTermYears(base);\n' +
    '      if (next && years && years > 0) {\n' +
    "        pushAuto(row, next, years, fromDate, 'time',\n" +
    "          'Արխիվի հաստիքի կոչում՝ ' + (row.rankSlot || base) +\n" +
    "          (row.personRank ? (' · Կոչում՝ ' + row.personRank) : '') +\n" +
    "          (row.code ? (' · կոդ ' + row.code) : '') +\n" +
    "          (fromDate ? (' · նշանակում՝ ' + fromDate) : ' · Արխիվի ամսաթիվ չկա') +\n" +
    "          ' · կրում՝ ' + years + 'տ',\n" +
    '          base);\n' +
    '      }\n' +
    '    });\n' +
    '    db.unitTermWatch.ranks = manual.concat(auto);\n' +
    '    (function purgeFakeJan1Autos() {\n' +
    '      var cy = (new Date()).getFullYear();\n' +
    '      function badIso(iso) {\n' +
    "        iso = String(iso || '').slice(0, 10);\n" +
    "        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) return false;\n" +
    "        if (iso.slice(5) !== '01-01') return false;\n" +
    '        var y = Number(iso.slice(0, 4));\n' +
    '        return y >= 1950 && y <= (cy - 2);\n' +
    '      }\n' +
    '      db.unitTermWatch.ranks = (db.unitTermWatch.ranks || []).filter(function (r) {\n' +
    '        if (!r || !r.autoFromPos) return true;\n' +
    '        if (badIso(r.appointedAt) || badIso(r.date)) return false;\n' +
    "        var dy = Number(String(r.date || '').slice(0, 4));\n" +
    '        if (dy && dy < (cy - 5)) return false;\n' +
    '        return true;\n' +
    '      });\n' +
    '    })();\n' +
    '    return (db.unitTermWatch.ranks || []).filter(function (r) { return r && r.autoFromPos; }).length;\n' +
    '  }\n' +
    '  ';
  t = t.slice(0, start) + neu + t.slice(end);
}

t = t.replace(/Excel-ի պաշտոնի կոչումով/g, 'զորամասի արխիվի պաշտոնի կոչումով');
t = t.replace(
  /Համեմատում է Զորամասի Արխիվի պաշտոնի կոչումը \(ոչ անձնական կոչումը\) և նշանակման ամսաթիվը/,
  'Համեմատում է զորամասի արխիվի Կոչում ըստ հաստիքի և Կոչում դաշտերը, ապա նշանակման ամսաթիվը'
);

fs.writeFileSync(file, t);
fs.copyFileSync(file, path.join(live, 'js/km-unit-tools.js'));
console.log('ok', t.includes(MARK + '_DONE'));
console.log('hasMajor', t.includes("'մայոր': 'մ-ր'"));
console.log('hasGap', t.includes('rankGap'));
console.log('hasPA', t.includes('rowsFromPositionArchives'));
