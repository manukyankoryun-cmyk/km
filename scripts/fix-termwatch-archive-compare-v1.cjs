'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const p = path.join(proj, 'app/js/km-unit-tools.js');
let t = fs.readFileSync(p, 'utf8');
const MARK = 'KM_TERMWATCH_ARCHIVE_COMPARE_V1';

if (t.includes(MARK)) {
  console.log('already patched');
} else {
  // 1) Strengthen canonExcelRank aliases: full names ↔ ladder abbrevs
  const oldCanon = `function canonExcelRank(rank) {
    var n = normRankLocal(rank);
    if (!n) return '';
    if (/^գեներալ/i.test(n) || n === 'գեն.' || n === 'գեն') return 'գեներալ';
    var alias = {
      'հդ ս-տ': 'ենթասպա',
      'հվ ս-տ': 'ավագ ենթասպա',
      'հգմ -ս-տ': 'ավագ ենթասպա',
      'գնդի սերժանտ': 'ավագ ենթասպա',
      'կորպուսի սերժանտ': 'ավագ ենթասպա'
    };
    return alias[n] || n;
  }`;

  const newCanon = `function canonExcelRank(rank) {
    /* ${MARK}: map full Armenian ranks + abbr to RANK_LADDER_LOCAL tokens */
    var n = String(rank || '').trim().toLocaleLowerCase('hy-AM').replace(/և/g, 'եւ').replace(/\\s+/g, ' ');
    n = n.replace(/\\./g, '․'); /* ASCII dot → Armenian */
    if (!n) return '';
    if (/^գեներալ/.test(n) || n === 'գեն․' || n === 'գեն' || n === 'գեն.') return 'գեներալ';
    var alias = {
      'շարքային': 'շ-ն', 'շ-ն': 'շ-ն', 'շն': 'շ-ն',
      'եֆրեյտոր': 'շ-ն',
      'կրտսեր սերժանտ': 'կրտ․ս-տ', 'կրտ․ս-տ': 'կրտ․ս-տ', 'կրտս-տ': 'կրտ․ս-տ', 'կրտ.ս-տ': 'կրտ․ս-տ',
      'սերժանտ': 'ս-տ', 'ս-տ': 'ս-տ', 'ստ': 'ս-տ',
      'ավագ սերժանտ': 'ավ․ս-տ', 'ավ․ս-տ': 'ավ․ս-տ', 'ավ.ս-տ': 'ավ․ս-տ', 'ավս-տ': 'ավ․ս-տ',
      'ավագ': 'ավագ',
      'ենթասպա': 'ենթասպա', 'հդ ս-տ': 'ենթասպա', 'հդս-տ': 'ենթասպա',
      'ավագ ենթասպա': 'ավագ ենթասպա', 'հվ ս-տ': 'ավագ ենթասպա', 'հգմ -ս-տ': 'ավագ ենթասպա',
      'գնդի սերժանտ': 'ավագ ենթասպա', 'կորպուսի սերժանտ': 'ավագ ենթասպա',
      'լեյտենանտ': 'լ-տ', 'լ-տ': 'լ-տ', 'լտ': 'լ-տ',
      'ավագ լեյտենանտ': 'ավ․լ-տ', 'ավ․լ-տ': 'ավ․լ-տ', 'ավ.լ-տ': 'ավ․լ-տ', 'ավլ-տ': 'ավ․լ-տ',
      'կապիտան': 'կ-ն', 'կ-ն': 'կ-ն', 'կն': 'կ-ն',
      'մայոր': 'մ-ր', 'մ-ր': 'մ-ր', 'մր': 'մ-ր',
      'փոխգնդապետ': 'փ/գ-տ', 'փ/գ-տ': 'փ/գ-տ', 'փգ-տ': 'փ/գ-տ', 'փ.գ-տ': 'փ/գ-տ',
      'գնդապետ': 'գ-տ', 'գ-տ': 'գ-տ', 'գտ': 'գ-տ'
    };
    if (alias[n]) return alias[n];
    /* soft: strip spaces around slash/dot */
    var soft = n.replace(/\\s*\\/\\s*/g, '/').replace(/\\s*․\\s*/g, '․');
    if (alias[soft]) return alias[soft];
    return alias[n] || n;
  }`;

  if (!t.includes(oldCanon)) {
    // replace by regex
    const re = /function canonExcelRank\(rank\) \{[\s\S]*?\n  function rankTermYears/;
    if (!re.test(t)) throw new Error('canonExcelRank block not found');
    t = t.replace(re, newCanon + '\n  function rankTermYears');
    console.log('canon via regex');
  } else {
    t = t.replace(oldCanon, newCanon);
    console.log('canon exact');
  }

  // 2) extractStaffAppointedAt — also read posOrder / appointmentDate / rankOrder text
  if (!t.includes('KM_TERM_APPOINT_FROM_POSORDER_V1')) {
    t = t.replace(
      /if \(row\) \{\s*parts\.push\(row\.appointmentDate, row\.lastAccept\);\s*\}/,
      `if (row) {
      parts.push(row.appointmentDate, row.lastAccept, row.posOrder, row.rankOrder, row.appointedAt, row.fromDate);
      /* KM_TERM_APPOINT_FROM_POSORDER_V1 */
    }`
    );
    console.log('appointParts', t.includes('KM_TERM_APPOINT_FROM_POSORDER_V1'));
  }

  // 3) Replace syncTermRanksFromArchive body to compare post vs personal + direct positionArchives
  const syncStart = t.indexOf('function syncTermRanksFromArchive');
  if (syncStart < 0) throw new Error('sync missing');
  const syncEnd = t.indexOf('window.kmScheduleRankTerm', syncStart);
  if (syncEnd < 0) throw new Error('sync end missing');

  const newSync = `function syncTermRanksFromArchive() {
    /* ${MARK}: Զորամասի արխիվ — համեմատել Կոչում ըստ հաստիքի (rankSlot) և Կոչում (rank) */
    window.kmUnitEnsureStores();
    var manual = (db.unitTermWatch.ranks || []).filter(function (r) { return r && !r.autoFromPos; });
    var auto = [];
    var seen = Object.create(null);

    function pushAuto(row, target, years, fromDate, kind, extraNote, currentCanon) {
      if (!target || isTermDismissed(row.name, target)) return;
      var key = row.name.toLocaleLowerCase('hy-AM') + '|' + normRankLocal(target);
      if (seen[key]) return;
      seen[key] = 1;
      if (!(years && years > 0 && fromDate)) return;
      var due = addYearsIso(fromDate, years);
      auto.push({
        id: uid('rankAuto'),
        person: row.name,
        rank: target,
        date: due,
        autoFromPos: true,
        post: row.post || '',
        code: row.code || '',
        rankSlot: row.rankSlot || '',
        currentRank: currentCanon || row.rankSlot || '',
        personRank: row.personRank || '',
        termYears: years,
        appointedAt: fromDate || '',
        unit: row.unit || '',
        kind: kind || 'time',
        note: extraNote || ''
      });
    }

    function rowsFromPositionArchives() {
      var out = [];
      try {
        var list = (db && db.positionArchives) || [];
        var uid = '';
        try {
          var ctx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
          uid = String((ctx && ctx.unitId) || window._kmArchiveForUnitId || '').trim();
        } catch (e0) {}
        list.forEach(function (arch) {
          if (!arch || !Array.isArray(arch.rows)) return;
          if (uid && arch.unitId && String(arch.unitId) !== uid) return;
          (arch.rows || []).forEach(function (r) {
            if (!r || r.type === 'section') return;
            var name = String(r.sourceName || r.name || r.personName || '').trim();
            if (!name) return;
            if (typeof window.kmLooksLikePersonName === 'function' && !window.kmLooksLikePersonName(name)) return;
            out.push({
              name: name,
              post: r.position || '',
              code: r.code || r.vus || '',
              rankSlot: r.rankSlot || '',
              personRank: r.rank || '',
              unit: r.unit || r.section || '',
              appointmentDate: r.appointmentDate || '',
              posOrder: r.posOrder || '',
              rankOrder: r.rankOrder || '',
              lastAccept: r.lastAccept || ''
            });
          });
        });
      } catch (ePA) {}
      return out;
    }

    var rows = [];
    try { rows = collectTermArchiveRows() || []; } catch (eC) { rows = []; }
    if (!rows.length) rows = rowsFromPositionArchives();
    /* always merge positionArchives so we never miss rank/rankSlot */
    var by = Object.create(null);
    rows.forEach(function (r) {
      if (!r || !r.name) return;
      by[r.name.toLocaleLowerCase('hy-AM')] = r;
    });
    rowsFromPositionArchives().forEach(function (r) {
      var k = r.name.toLocaleLowerCase('hy-AM');
      var cur = by[k];
      if (!cur) { by[k] = r; return; }
      if (!cur.rankSlot && r.rankSlot) cur.rankSlot = r.rankSlot;
      if (!cur.personRank && r.personRank) cur.personRank = r.personRank;
      if (!cur.appointmentDate && r.appointmentDate) cur.appointmentDate = r.appointmentDate;
      if (!cur.posOrder && r.posOrder) cur.posOrder = r.posOrder;
      if (!cur.post && r.post) cur.post = r.post;
      if (!cur.code && r.code) cur.code = r.code;
    });
    rows = Object.keys(by).map(function (k) { return by[k]; });

    rows.forEach(function (row) {
      var postCanon = canonExcelRank(row.rankSlot || '');
      var personCanon = canonExcelRank(row.personRank || '');
      if (!postCanon && !personCanon) return;
      var fromDate = extractStaffAppointedAt(row, null);
      if (!fromDate) fromDate = parseStaffDate(row.appointmentDate || row.posOrder || row.rankOrder || row.lastAccept || '');

      var postIdx = RANK_LADDER_LOCAL.indexOf(postCanon);
      var personIdx = RANK_LADDER_LOCAL.indexOf(personCanon);

      /* A) Անձնական կոչում < հաստիքի կոչում → հերթ դեպի հաջորդ քայլը (կամ հաստիքի կոչումը) */
      if (postIdx >= 0 && personIdx >= 0 && personIdx < postIdx) {
        var step = RANK_LADDER_LOCAL[personIdx + 1] || postCanon;
        var yearsA = rankTermYears(personCanon);
        if (!(yearsA && yearsA > 0)) yearsA = rankTermYears(postCanon) || 2;
        pushAuto(row, step, yearsA, fromDate, 'rankGap',
          'Հաստիքի կոչում՝ ' + (row.rankSlot || postCanon) +
          ' · անձնական՝ ' + (row.personRank || personCanon) +
          (fromDate ? (' · նշանակում՝ ' + fromDate) : '') +
          ' · կրում՝ ' + yearsA + 'տ',
          personCanon);
        return;
      }

      /* B) Նույն մակարդակ / հաստիքի կոչումով՝ հաջորդ կոչման ժամկետ */
      var base = postCanon || personCanon;
      var next = nextRankAfter(base);
      var years = rankTermYears(base);
      if (next && years && years > 0) {
        pushAuto(row, next, years, fromDate, 'time',
          'Արխիվի հաստիքի կոչում՝ ' + (row.rankSlot || base) +
          (row.personRank ? (' · Կոչում՝ ' + row.personRank) : '') +
          (row.code ? (' · կոդ ' + row.code) : '') +
          (fromDate ? (' · նշանակում՝ ' + fromDate) : ' · Արխիվի ամսաթիվ չկա') +
          ' · կրում՝ ' + years + 'տ',
          base);
      }
    });

    db.unitTermWatch.ranks = manual.concat(auto);
    (function purgeFakeJan1Autos() {
      var cy = (new Date()).getFullYear();
      function badIso(iso) {
        iso = String(iso || '').slice(0, 10);
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(iso)) return false;
        if (iso.slice(5) !== '01-01') return false;
        var y = Number(iso.slice(0, 4));
        return y >= 1950 && y <= (cy - 2);
      }
      db.unitTermWatch.ranks = (db.unitTermWatch.ranks || []).filter(function (r) {
        if (!r || !r.autoFromPos) return true;
        if (badIso(r.appointedAt) || badIso(r.date)) return false;
        var dy = Number(String(r.date || '').slice(0, 4));
        if (dy && dy < (cy - 5)) return false;
        return true;
      });
    })();
    return (db.unitTermWatch.ranks || []).filter(function (r) { return r && r.autoFromPos; }).length;
  }
  `;

  t = t.slice(0, syncStart) + newSync + t.slice(syncEnd);

  // 4) UI blurb
  t = t.replace(
    /Համեմատում է Զորամասի Արխիվի պաշտոնի կոչումը \(ոչ անձնական կոչումը\) և նշանակման ամսաթիվը՝ կրման ժամկետների հետ \(Հոդված 10\/15\)։[^<]*/,
    'Համեմատում է զորամասի արխիվի <b>Կոչում ըստ հաստիքի</b>-ը և <b>Կոչում</b>-ը, ապա նշանակման ամսաթիվը՝ կրման ժամկետների հետ (Հոդված 10/15)։ '
  );

  fs.writeFileSync(p, t);
  console.log('marker', t.includes(MARK));
  console.log('syncHasGap', t.includes('rankGap'));
  console.log('syncHasPA', t.includes('rowsFromPositionArchives'));
  console.log('canonMajor', t.includes(\"'մայոր': 'մ-ր'\") || t.includes('"մայոր": "մ-ր"') || t.includes("'մայոր': 'մ-ր'"));
}

// copy + integrity
fs.copyFileSync(p, path.join(live, 'js/km-unit-tools.js'));
console.log('copied live');
