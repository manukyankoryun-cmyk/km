/* kodmutq: 40 unique files, original 1–20 prefixes unchanged. */
'use strict';
const spec = require('./kodmutq_spec.cjs');

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail == null ? '' : detail); }
}

ok('file count 40', spec.FILE_COUNT === 40, spec.FILE_COUNT);
const f1 = spec.generateFile(1);
ok('file 1 first code unchanged', f1[0] === 'MCPADISH', f1[0]);
ok('file 1 size', f1.length === 15000, f1.length);
ok('file 1 code valid', spec.isKodmutqUnitCode(f1[0]));

const f21 = spec.generateFile(21);
ok('file 21 size', f21.length === 15000, f21.length);
ok('file 21 first differs from file 1', f21[0] !== f1[0], f21[0]);
ok('file 21 code valid', spec.isKodmutqUnitCode(f21[0]));

const seen = new Set();
let dup = 0;
let bad = 0;
for (let n = 1; n <= spec.FILE_COUNT; n++) {
  const lines = spec.generateFile(n);
  if (lines.length > spec.MAX) {
    ok('file ' + n + ' max', false, lines.length);
  }
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i];
    if (seen.has(c)) dup++;
    seen.add(c);
    if (!spec.isKodmutqUnitCode(c)) bad++;
  }
}
ok('no duplicate codes', dup === 0, dup);
ok('all codes valid', bad === 0, bad);
ok('unique total', seen.size === 40 * 15000, seen.size);

console.log(failed ? 'FAIL ' + failed : 'PASS ' + passed);
process.exit(failed ? 1 : 0);
