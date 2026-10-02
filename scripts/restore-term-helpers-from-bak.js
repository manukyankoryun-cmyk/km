'use strict';
const fs = require('fs');
const path = require('path');
const proj = process.argv[2];
const live = process.argv[3];
const bak = process.argv[4];
const file = path.join(proj, 'app/js/km-unit-tools.js');
let cur = fs.readFileSync(file, 'utf8');
const old = fs.readFileSync(bak, 'utf8');
const MARK = 'KM_RESTORE_TERM_HELPERS_FROM_BAK_V1';
if (cur.includes(MARK)) { console.log('already'); process.exit(0); }

function extractFn(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index;
  // include preceding var RANK_* if right before
  let start = i;
  // find end by brace count
  let j = src.indexOf('{', i);
  let depth = 0;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  return src.slice(start, j);
}

function extractVar(src, name) {
  const re = new RegExp('var\\s+' + name + '\\s*=');
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index;
  let j = i;
  let depth = 0;
  let started = false;
  for (; j < src.length; j++) {
    const ch = src[j];
    if (ch === '{' || ch === '[') { depth++; started = true; }
    else if (ch === '}' || ch === ']') depth--;
    else if (ch === ';' && started && depth === 0) { j++; break; }
    else if (ch === ';' && !started) { j++; break; }
  }
  return src.slice(i, j);
}

const names = [
  'canonExcelRank', 'rankTermYears', 'nextRankAfter', 'parseStaffDate',
  'extractStaffAppointedAt', 'addYearsIso', 'isTermDismissed', 'rankTermTableHtml'
];
const vars = ['RANK_LADDER_LOCAL', 'RANK_TERM_YEARS', 'RANK_NO_TERM'];
let block = '  /* ' + MARK + ' */\n';
for (const v of vars) {
  let piece = extractVar(old, v);
  if (!piece) { console.log('missing var', v); continue; }
  // avoid duplicate if somehow present
  if (cur.includes('var ' + v)) {
    console.log('skip existing var', v);
  } else {
    block += piece + '\n';
    console.log('got var', v, piece.length);
  }
}
for (const n of names) {
  if (n === 'rankTermTableHtml' && /function\s+rankTermTableHtml\s*\(/.test(cur)) {
    // replace our stub with bak version
    const neu = extractFn(old, n);
    if (neu) {
      cur = cur.replace(/function\s+rankTermTableHtml\s*\([^]*?\n  function renderTerms/, neu + '\n  function renderTerms');
      console.log('replaced rankTermTableHtml from bak', neu.length);
    }
    continue;
  }
  if (new RegExp('function\\s+' + n + '\\s*\\(').test(cur)) {
    console.log('skip existing fn', n);
    continue;
  }
  const piece = extractFn(old, n);
  if (!piece) { console.log('missing fn', n); continue; }
  block += piece + '\n';
  console.log('got fn', n, piece.length);
}

const insertAt = cur.indexOf('function collectTermArchiveRows');
if (insertAt < 0) throw new Error('collectTermArchiveRows missing');
cur = cur.slice(0, insertAt) + block + '\n  ' + cur.slice(insertAt);

// Alias names if sync uses different spellings
const aliases = [
  ['isTermDismissed', 'isTermDismissed'],
  ['addYearsIso', 'addYearsIso'],
  ['extractStaffAppointedAt', 'extractStaffAppointedAt'],
  ['parseStaffDate', 'parseStaffDate'],
  ['nextRankAfter', 'nextRankAfter'],
  ['canonExcelRank', 'canonExcelRank'],
  ['rankTermYears', 'rankTermYears']
];
// Check what sync actually calls
const sync = cur.slice(cur.indexOf('function syncTermRanksFromArchive'), cur.indexOf('function syncTermRanksFromArchive') + 3500);
console.log('sync calls sample:', (sync.match(/\b(canonExcelRank|rankTermYears|nextRankAfter|addYearsIso|isTermDismissed|extractStaffAppointedAt|parseStaffDate|RANK_LADDER_LOCAL)\b/g) || []).join(','));

fs.writeFileSync(file, cur);
fs.copyFileSync(file, path.join(live, 'js/km-unit-tools.js'));
try { new Function(cur); console.log('syntax OK'); } catch (e) { console.log('SYNTAX', e.message); process.exit(1); }
console.log('size', cur.length);
