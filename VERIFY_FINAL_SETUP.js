'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const setup = path.join(__dirname, 'dist', 'KM_Setup_x64.exe');
if (!fs.existsSync(setup)) {
  console.error('FAIL: dist\\KM_Setup_x64.exe not found. Build Setup first.');
  process.exit(1);
}
const st = fs.statSync(setup);
if (st.size < 150 * 1024 * 1024) {
  console.error('FAIL: Setup too small for embedded BotKnowledge: ' + st.size + ' bytes (need >= 150MB)');
  process.exit(1);
}
const fd = fs.openSync(setup, 'r');
const head = Buffer.alloc(2);
fs.readSync(fd, head, 0, 2, 0);
fs.closeSync(fd);
if (head[0] !== 0x4d || head[1] !== 0x5a) {
  console.error('FAIL: Not a Windows PE executable.');
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(fs.readFileSync(setup)).digest('hex').toUpperCase();
console.log('PASS: KM_Setup_x64.exe');
console.log('Size: ' + st.size + ' bytes');
console.log('SHA-256: ' + hash);
process.exit(0);
