'use strict';
/**
 * KM_WRITE_INTEGRITY_CLI_V1
 * Usage (ELECTRON_RUN_AS_NODE=1):
 *   electron.exe scripts/km_write_integrity.cjs <absolute-app-dir>
 *
 * Loads km_guard from the target app dir (stub+.jsc) and reseals km_integrity.json.
 * Avoids electron -e quoting breakage on Windows PowerShell.
 */
const path = require('path');
const fs = require('fs');

const appDir = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!appDir) {
  console.error('usage: km_write_integrity.cjs <appDir>');
  process.exit(2);
}
if (!fs.existsSync(appDir)) {
  console.error('appDir missing: ' + appDir);
  process.exit(3);
}
const guardJs = path.join(appDir, 'km_guard.js');
const guardJsc = path.join(appDir, 'km_guard.jsc');
if (!fs.existsSync(guardJs) && !fs.existsSync(guardJsc)) {
  console.error('km_guard.js/.jsc missing in ' + appDir);
  process.exit(4);
}
const g = require(guardJs);
if (typeof g.writeIntegrity !== 'function') {
  console.error('writeIntegrity missing on km_guard export');
  process.exit(5);
}
const r = g.writeIntegrity(appDir);
const n = r && r.files ? Object.keys(r.files).length : 0;
console.log('integrity ok files=' + n + ' at=' + (r && r.at ? r.at : ''));
