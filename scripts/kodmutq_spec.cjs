'use strict';
/**
 * kodmutq 1.txt–40.txt
 * Each code: exactly 8 unique Latin letters (A–Z) + up to 8 digits.
 * Letters never repeat, never sit next to an alphabet neighbour (AB/BA),
 * and the 8-letter block is not sorted A→Z or Z→A.
 * Each file: at most 15 000 codes. Every code is unique across all files.
 * Files 1–20 stay the original set; 21–40 repeat the same shapes with new prefixes.
 * Owner-only; never packed into Setup.
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MAX = 15000;
const LETTER_LEN = 8;
const SEED = 0x4B4D3230;

const FILE_DEFS_CORE = [
  { kind: 'L', n: 15000 },
  { kind: 'L', n: 15000 },
  { kind: 'Ld', n: 1500, w: 1 },
  { kind: 'Ld', n: 150, w: 2 },
  { kind: 'Ld', n: 15, w: 3 },
  { kind: 'Ld', n: 15, w: 4 },
  { kind: 'Ld', n: 1, w: 5 },
  { kind: 'Ld', n: 1, w: 6 },
  { kind: 'Ld', n: 1, w: 7 },
  { kind: 'Ld', n: 1, w: 8 },
  { kind: 'dL', n: 1500, w: 1 },
  { kind: 'dL', n: 150, w: 2 },
  { kind: 'dL', n: 15, w: 3 },
  { kind: 'Lsplit', n: 150, left: 4, w: 2 },
  { kind: 'Lsplit', n: 15, left: 2, w: 3 },
  { kind: 'Lsplit', n: 1500, left: 1, w: 1 },
  { kind: 'dLdL', n: 150, left: 4 },
  { kind: 'Lsplit', n: 150, left: 3, w: 2 },
  { kind: 'Lsplit', n: 1, left: 6, w: 5 },
  { kind: 'Lsplit', n: 1500, left: 5, w: 1 }
];
const FILE_DEFS = FILE_DEFS_CORE.concat(FILE_DEFS_CORE.map((f) => Object.assign({}, f)));
const FILE_COUNT = FILE_DEFS.length;

function pad(num, width) {
  return String(num).padStart(width, '0');
}

function isMonoSorted(s) {
  let up = true;
  let down = true;
  for (let i = 1; i < s.length; i++) {
    const a = s.charCodeAt(i - 1);
    const b = s.charCodeAt(i);
    if (b <= a) up = false;
    if (b >= a) down = false;
  }
  return up || down;
}

function lettersAdjacentOk(s) {
  for (let i = 1; i < s.length; i++) {
    const a = s.charCodeAt(i - 1);
    const b = s.charCodeAt(i);
    if (a < 65 || a > 90 || b < 65 || b > 90) continue;
    if (Math.abs(a - b) === 1) return false;
  }
  return true;
}

function uniqueLetters(s) {
  const letters = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    if (ch >= 65 && ch <= 90) letters.push(s[i]);
  }
  if (letters.length !== LETTER_LEN) return false;
  return new Set(letters).size === LETTER_LEN;
}

function shapeOk(c) {
  if (!c || !/^[A-Z0-9]+$/.test(c)) return false;
  let digits = 0;
  for (let i = 0; i < c.length; i++) {
    if (c.charCodeAt(i) >= 48 && c.charCodeAt(i) <= 57) {
      digits += 1;
      if (digits > 8) return false;
    }
  }
  const letters = c.replace(/\d/g, '');
  if (!uniqueLetters(c)) return false;
  if (!lettersAdjacentOk(c)) return false;
  if (isMonoSorted(letters)) return false;
  return true;
}

function letterTryOrderFor(seed) {
  const tryAt = [];
  for (let d = 0; d < LETTER_LEN; d++) {
    const arr = [];
    for (let i = 0; i < 26; i++) arr.push(i);
    let s = (seed ^ ((d + 1) * 0x9E3779B9)) >>> 0;
    for (let i = 25; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    tryAt.push(arr);
  }
  return tryAt;
}

function shufflePrefixList(out, seed) {
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

function collectPrefixBatch(need, seed, skip) {
  const perStart = Math.ceil(need / 26);
  const out = [];
  const used = new Uint8Array(26);
  const path = [];
  const tryAt = letterTryOrderFor(seed);
  let bucketLimit = 0;
  function rec() {
    if (out.length >= bucketLimit) return;
    if (path.length === LETTER_LEN) {
      const s = path.join('');
      if (!isMonoSorted(s) && !(skip && skip.has(s))) out.push(s);
      return;
    }
    const prev = path[path.length - 1].charCodeAt(0) - 65;
    const seq = tryAt[path.length];
    for (let k = 0; k < 26; k++) {
      const i = seq[k];
      if (used[i]) continue;
      if (Math.abs(i - prev) === 1) continue;
      used[i] = 1;
      path.push(LETTERS[i]);
      rec();
      path.pop();
      used[i] = 0;
      if (out.length >= bucketLimit) return;
    }
  }
  function fillFromStarts() {
    for (let start = 0; start < 26; start++) {
      if (out.length >= need) return;
      bucketLimit = Math.min(need, out.length + perStart);
      used[start] = 1;
      path.push(LETTERS[start]);
      rec();
      path.pop();
      used[start] = 0;
    }
  }
  fillFromStarts();
  if (out.length < need) {
    for (let start = 0; start < 26 && out.length < need; start++) {
      bucketLimit = need;
      used[start] = 1;
      path.push(LETTERS[start]);
      rec();
      path.pop();
      used[start] = 0;
    }
  }
  if (out.length < need) {
    throw new Error('kodmutq prefixes ' + out.length + ' < ' + need);
  }
  if (out.length > need) out.length = need;
  return shufflePrefixList(out, seed);
}

function buildPrefixes() {
  const need1 = FILE_DEFS_CORE.reduce((s, f) => s + f.n, 0);
  const need = FILE_DEFS.reduce((s, f) => s + f.n, 0);
  const first = collectPrefixBatch(need1, SEED, null);
  if (need <= first.length) return first;
  const extra = collectPrefixBatch(need - first.length, (SEED ^ 0x0040) >>> 0, new Set(first));
  return first.concat(extra);
}

function fileMeta() {
  let start = 0;
  return FILE_DEFS.map((f) => {
    const per = MAX / f.n;
    const meta = Object.assign({ start, per }, f);
    start += f.n;
    return meta;
  });
}

let PREFIXES = null;
let PREFIX_INDEX = null;
let FILES = null;

function prefixes() {
  if (!PREFIXES) {
    PREFIXES = buildPrefixes();
    PREFIX_INDEX = new Map();
    for (let i = 0; i < PREFIXES.length; i++) PREFIX_INDEX.set(PREFIXES[i], i);
    FILES = fileMeta();
  }
  return PREFIXES;
}

function prefixIndex(s) {
  prefixes();
  const i = PREFIX_INDEX.get(s);
  return i == null ? -1 : i;
}

function fileForPrefix(idx) {
  prefixes();
  for (let i = 0; i < FILES.length; i++) {
    const f = FILES[i];
    if (idx >= f.start && idx < f.start + f.n) return f;
  }
  return null;
}

function generateFile(fileNo) {
  const P = prefixes();
  const f = FILES[Number(fileNo) - 1];
  if (!f) return [];
  const out = [];
  function push(s) {
    if (out.length >= MAX) return false;
    out.push(s);
    return out.length < MAX;
  }
  for (let i = 0; i < f.n && out.length < MAX; i++) {
    const block = P[f.start + i];
    if (f.kind === 'L') {
      if (!push(block)) return out;
      continue;
    }
    if (f.kind === 'Ld') {
      for (let d = 0; d < f.per; d++) {
        if (!push(block + pad(d, f.w))) return out;
      }
      continue;
    }
    if (f.kind === 'dL') {
      for (let d = 0; d < f.per; d++) {
        if (!push(pad(d, f.w) + block)) return out;
      }
      continue;
    }
    if (f.kind === 'Lsplit') {
      const a = block.slice(0, f.left);
      const b = block.slice(f.left);
      for (let d = 0; d < f.per; d++) {
        if (!push(a + pad(d, f.w) + b)) return out;
      }
      continue;
    }
    if (f.kind === 'dLdL') {
      const a = block.slice(0, f.left);
      const b = block.slice(f.left);
      for (let d = 0; d < f.per; d++) {
        const d1 = Math.floor(d / 10);
        const d2 = d % 10;
        if (!push(String(d1) + a + String(d2) + b)) return out;
      }
    }
  }
  return out;
}

function isKodmutqUnitCode(code) {
  const c = String(code || '').replace(/\s+/g, '').toUpperCase();
  if (!shapeOk(c)) return false;
  const letters = c.replace(/\d/g, '');
  const idx = prefixIndex(letters);
  if (idx < 0) return false;
  const f = fileForPrefix(idx);
  if (!f) return false;
  const block = prefixes()[idx];
  if (f.kind === 'L') return c === block;
  if (f.kind === 'Ld') {
    if (c.length !== LETTER_LEN + f.w || c.slice(0, LETTER_LEN) !== block) return false;
    const d = c.slice(LETTER_LEN);
    if (!/^\d+$/.test(d) || d.length !== f.w) return false;
    return Number(d) < f.per;
  }
  if (f.kind === 'dL') {
    if (c.length !== LETTER_LEN + f.w || c.slice(f.w) !== block) return false;
    const d = c.slice(0, f.w);
    if (!/^\d+$/.test(d)) return false;
    return Number(d) < f.per;
  }
  if (f.kind === 'Lsplit') {
    const a = block.slice(0, f.left);
    const b = block.slice(f.left);
    if (c.length !== LETTER_LEN + f.w) return false;
    if (c.slice(0, f.left) !== a) return false;
    if (c.slice(c.length - b.length) !== b) return false;
    const d = c.slice(f.left, f.left + f.w);
    if (!/^\d+$/.test(d) || d.length !== f.w) return false;
    return Number(d) < f.per;
  }
  if (f.kind === 'dLdL') {
    const a = block.slice(0, f.left);
    const b = block.slice(f.left);
    if (c.length !== LETTER_LEN + 2) return false;
    if (c[0] < '0' || c[0] > '9') return false;
    if (c.slice(1, 1 + a.length) !== a) return false;
    if (c[1 + a.length] < '0' || c[1 + a.length] > '9') return false;
    if (c.slice(2 + a.length) !== b) return false;
    const n = (c.charCodeAt(0) - 48) * 10 + (c.charCodeAt(1 + a.length) - 48);
    return n < f.per;
  }
  return false;
}

module.exports = {
  MAX,
  FILE_COUNT,
  LETTER_LEN,
  generateFile,
  isKodmutqUnitCode,
  shapeOk,
  prefixes,
  fileMeta
};
