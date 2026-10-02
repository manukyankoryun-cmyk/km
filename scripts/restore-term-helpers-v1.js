'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const file = path.join(proj, 'app/js/km-unit-tools.js');
let t = fs.readFileSync(file, 'utf8');
const MARK = 'KM_RESTORE_TERM_HELPERS_V1';
if (t.includes(MARK)) { console.log('helpers already'); process.exit(0); }

const helpers = `
  /* ${MARK} */
  var RANK_LADDER_LOCAL = ['շ-ն', 'կրտ․ս-տ', 'ս-տ', 'ավ․ս-տ', 'ավագ', 'ենթասպա', 'ավագ ենթասպա', 'լ-տ', 'ավ․լ-տ', 'կ-ն', 'մ-ր', 'փ/գ-տ', 'գ-տ', 'գեներալ'];
  var RANK_TERM_YEARS = {
    'կրտ․ս-տ': 1, 'կրտսեր սերժանտ': 1,
    'ս-տ': 2, 'սերժանտ': 2,
    'ավ․ս-տ': 2, 'ավագ սերժանտ': 2,
    'ավագ': 2,
    'ենթասպա': 3, 'հդ ս-տ': 3,
    'լ-տ': 2, 'լեյտենանտ': 2,
    'ավ․լ-տ': 2, 'ավագ լեյտենանտ': 2,
    'կ-ն': 3, 'կապիտան': 3,
    'մ-ր': 3, 'մայոր': 3,
    'փ/գ-տ': 4, 'փոխգնդապետ': 4
  };
  var RANK_NO_TERM = {
    'շ-ն': 1, 'շարքային': 1, 'եֆրեյտոր': 1,
    'ավագ ենթասպա': 1, 'հվ ս-տ': 1,
    'գ-տ': 1, 'գնդապետ': 1, 'գեներալ': 1
  };
  function canonExcelRank(rank) {
    var n = String(rank || '').trim().toLocaleLowerCase('hy-AM').replace(/և/g, 'եւ').replace(/\\s+/g, ' ');
    n = n.replace(/\\./g, '․');
    if (!n) return '';
    if (typeof normRankLocal === 'function') {
      try { var nn = normRankLocal(n); if (nn) n = String(nn).trim().toLocaleLowerCase('hy-AM').replace(/\\./g, '․'); } catch (e0) {}
    }
    if (/^գեներալ/.test(n) || n === 'գեն․' || n === 'գեն') return 'գեներալ';
    var alias = {
      'շարքային': 'շ-ն', 'շ-ն': 'շ-ն', 'շն': 'շ-ն', 'եֆրեյտոր': 'շ-ն',
      'կրտսեր սերժանտ': 'կրտ․ս-տ', 'կրտ․ս-տ': 'կրտ․ս-տ', 'կրտ.ս-տ': 'կրտ․ս-տ',
      'սերժանտ': 'ս-տ', 'ս-տ': 'ս-տ',
      'ավագ սերժանտ': 'ավ․ս-տ', 'ավ․ս-տ': 'ավ․ս-տ', 'ավ.ս-տ': 'ավ․ս-տ',
      'ավագ': 'ավագ',
      'ենթասպա': 'ենթասպա', 'հդ ս-տ': 'ենթասպա',
      'ավագ ենթասպա': 'ավագ ենթասպա', 'հվ ս-տ': 'ավագ ենթասպա',
      'լեյտենանտ': 'լ-տ', 'լ-տ': 'լ-տ',
      'ավագ լեյտենանտ': 'ավ․լ-տ', 'ավ․լ-տ': 'ավ․լ-տ', 'ավ.լ-տ': 'ավ․լ-տ',
      'կապիտան': 'կ-ն', 'կ-ն': 'կ-ն',
      'մայոր': 'մ-ր', 'մ-ր': 'մ-ր',
      'փոխգնդապետ': 'փ/գ-տ', 'փ/գ-տ': 'փ/գ-տ',
      'գնդապետ': 'գ-տ', 'գ-տ': 'գ-տ'
    };
    if (alias[n]) return alias[n];
    var soft = n.replace(/\\s*\\/\\s*/g, '/');
    return alias[soft] || n;
  }
  function rankTermYears(rank) {
    var n = canonExcelRank(rank);
    if (!n) return null;
    if (Object.prototype.hasOwnProperty.call(RANK_TERM_YEARS, n)) return RANK_TERM_YEARS[n];
    var low = String(rank || '').trim().toLocaleLowerCase('hy-AM');
    if (Object.prototype.hasOwnProperty.call(RANK_TERM_YEARS, low)) return RANK_TERM_YEARS[low];
    if (RANK_NO_TERM[n] || RANK_NO_TERM[low]) return 0;
    return null;
  }
  function nextRankAfter(rank) {
    var n = canonExcelRank(rank);
    var i = RANK_LADDER_LOCAL.indexOf(n);
    if (i < 0 || i >= RANK_LADDER_LOCAL.length - 1) return '';
    return RANK_LADDER_LOCAL[i + 1];
  }
  function parseStaffDate(raw) {
    var s = String(raw == null ? '' : raw).replace(/\\u00a0/g, ' ').trim();
    if (!s) return '';
    var iso = s.match(/(19|20)\\d{2}-\\d{2}-\\d{2}/);
    if (iso) return iso[0];
    var dmy = s.match(/(\\d{1,2})[.\\-\\/](\\d{1,2})[.\\-\\/](\\d{2,4})/);
    if (dmy) {
      var y = dmy[3].length === 2 ? ('20' + dmy[3]) : dmy[3];
      var m = Number(dmy[2]);
      var d = Number(dmy[1]);
      if (m > 12 && d <= 12) { var tmp = m; m = d; d = tmp; }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && Number(y) >= 1990) {
        return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
      }
    }
    return '';
  }
  function extractStaffAppointedAt(row, person) {
    var parts = [];
    if (person) parts.push(person.appointmentDate, person.rankAppointedAt, person.lastAccept);
    if (row) parts.push(row.appointmentDate, row.lastAccept, row.posOrder, row.rankOrder, row.appointedAt);
    for (var i = 0; i < parts.length; i++) {
      var got = parseStaffDate(parts[i]);
      if (got) return got;
    }
    return '';
  }
  function addYearsIso(iso, years) {
    years = Number(years) || 0;
    var d = new Date(String(iso || '') + 'T12:00:00');
    if (isNaN(d.getTime())) d = new Date();
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().slice(0, 10);
  }
  function isTermDismissed(person, rank) {
    try {
      var key = String(person || '').trim().toLocaleLowerCase('hy-AM') + '|' + String(rank || '').trim().toLocaleLowerCase('hy-AM');
      var list = (db.unitTermWatch && db.unitTermWatch.dismissed) || [];
      return list.indexOf(key) >= 0;
    } catch (e) { return false; }
  }
`;

// Fix rankTermTableHtml to call rankTermYears (not wrong name)
t = t.replace(
  /var y = \(typeof rankTermYears === 'function'\) \? rankTermYears\(r\) : null;/,
  "var y = (typeof rankTermYears === 'function') ? rankTermYears(r) : null;"
);
// Also fix if we used wrong identifier in restored table
t = t.replace(
  /typeof rankTermYears === 'function'\) \? rankTermYears\(r\)/,
  "typeof rankTermYears === 'function') ? rankTermYears(r)"
);

const insertAt = t.indexOf('function collectTermArchiveRows');
if (insertAt < 0) throw new Error('collectTermArchiveRows missing');
t = t.slice(0, insertAt) + helpers + '\n  ' + t.slice(insertAt);

// Align sync helper names if they use aliases
// sync uses: isTermDismissed, addYearsIso, canonExcelRank, extractStaffAppointedAt, parseStaffDate, nextRankAfter, rankTermYears, RANK_LADDER_LOCAL
// already matched above

fs.writeFileSync(file, t);
fs.copyFileSync(file, path.join(live, 'js/km-unit-tools.js'));
console.log('restored helpers', t.includes(MARK));
console.log('canon', t.includes('function canonExcelRank'));
console.log('years', t.includes('function rankTermYears'));
console.log('table', t.includes('function rankTermTableHtml'));
try { new Function(t); console.log('syntax OK'); } catch (e) { console.log('SYNTAX', e.message); process.exit(1); }
