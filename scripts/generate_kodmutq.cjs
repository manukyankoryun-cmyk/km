#!/usr/bin/env node
'use strict';
/**
 * Owner-only unit-entry codes → ../kodmutq/1.txt … 40.txt
 * Never copied into Setup / app runtime.
 *
 * Each code: 8 unique Latin letters (A–Z, not consecutive, not sorted) + up to 8 digits.
 * Each file: at most 15 000 lines.
 */
const fs = require('fs');
const path = require('path');
const spec = require('./kodmutq_spec.cjs');

const ROOT = path.join(__dirname, '..', 'kodmutq');

function writeFile(name, lines) {
  const p = path.join(ROOT, name);
  const fd = fs.openSync(p, 'w');
  let buf = '';
  for (let i = 0; i < lines.length; i++) {
    buf += lines[i] + '\r\n';
    if (buf.length >= 1024 * 64) {
      fs.writeSync(fd, buf);
      buf = '';
    }
  }
  if (buf) fs.writeSync(fd, buf);
  fs.closeSync(fd);
  return { name, count: lines.length };
}

function main() {
  fs.mkdirSync(ROOT, { recursive: true });
  const out = [];
  const seen = new Set();
  let bad = 0;

  for (let n = 1; n <= spec.FILE_COUNT; n++) {
    const lines = spec.generateFile(n);
    if (lines.length > spec.MAX) {
      throw new Error(n + '.txt has ' + lines.length + ' > ' + spec.MAX);
    }
    for (let i = 0; i < lines.length; i++) {
      const c = lines[i];
      if (seen.has(c)) throw new Error('duplicate ' + c + ' in ' + n + '.txt');
      seen.add(c);
      if (!spec.isKodmutqUnitCode(c)) {
        bad += 1;
        if (bad <= 8) console.error('reject', n, c);
      }
    }
    out.push(writeFile(n + '.txt', lines));
  }

  const extra = fs.readdirSync(ROOT).filter((f) => {
    const m = /^(\d+)\.txt$/i.exec(f);
    return m && Number(m[1]) > spec.FILE_COUNT;
  });
  extra.forEach((f) => fs.unlinkSync(path.join(ROOT, f)));

  if (bad) throw new Error('validator rejected ' + bad + ' codes');

  const total = out.reduce((s, x) => s + x.count, 0);
  console.log('kodmutq → ' + ROOT);
  out.forEach((x) => console.log('  ' + x.name + '  ' + x.count));
  console.log('total ' + total + '  unique ' + seen.size);
}

main();
