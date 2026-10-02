#!/usr/bin/env node
/* BUILD_SETUP hook: strip leftover scripts/test-* and known obsolete archives
   from a staged CLIENT appDir. Do not run on the Hub source tree. */
'use strict';
const fs = require('fs');
const path = require('path');
const guard = require(path.join(__dirname, '..', 'km_guard.js'));

const appDir = path.resolve(process.argv[2] || '');
if (!appDir) {
  console.error('usage: node scripts/strip-client-orphans.cjs <stagedAppDir>');
  process.exit(2);
}

const log = console.log.bind(console);
const removed = [];

function tryUnlink(rel) {
  const p = path.join(appDir, rel);
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      fs.unlinkSync(p);
      removed.push(rel.replace(/\\/g, '/'));
      log('strip-client-orphans: removed ' + rel.replace(/\\/g, '/'));
    }
  } catch (e) {
    log('strip-client-orphans: skip ' + rel + ' (' + (e && e.message) + ')');
  }
}

function stripObsoleteArchives() {
  // Foreign/old Unit Archive HTML left on updated clients → GUARD extra.
  // Legitimate seed is data/km_unit_archive_25836.json — never delete it.
  tryUnlink(path.join('data', '25836_unit_archive.html'));
  // Retired module (superseded by km-extensions.js pcApi); not sealed in km_integrity.json → GUARD "foreign/old file".
  tryUnlink(path.join('js', 'km-person-card-archive.js'));
  // Bridge is inlined in main.js now; a separate .cjs is unsealed → GUARD "foreign/old file".
  tryUnlink('km-soldier-card-archive-main.cjs');
  const dataDir = path.join(appDir, 'data');
  if (!fs.existsSync(dataDir)) return;
  let names = [];
  try { names = fs.readdirSync(dataDir); } catch (_) { return; }
  for (const name of names) {
    if (/^25836_unit_archive\.html\.bak/i.test(name)) {
      tryUnlink(path.join('data', name));
    }
  }
}

const harnessRemoved = guard.stripLeftoverTestHarness(appDir, log) || [];
for (const r of harnessRemoved) {
  if (removed.indexOf(r) < 0) removed.push(r);
}
stripObsoleteArchives();

function stripRootFrontendDupes() {
  // Canonical frontend modules live under js/. Root copies are GUARD "foreign/old" extras.
  for (const name of ['km-ops.js', 'km-positions.js', 'km-troop-structure.js']) {
    const root = path.join(appDir, name);
    const underJs = path.join(appDir, 'js', name);
    try {
      if (fs.existsSync(root) && fs.existsSync(underJs) && fs.statSync(root).isFile()) {
        fs.unlinkSync(root);
        removed.push(name);
        log('strip-client-orphans: removed root dupe ' + name);
      }
    } catch (e) {
      log('strip-client-orphans: skip ' + name + ' (' + (e && e.message) + ')');
    }
  }
}
stripRootFrontendDupes();
console.log('stripped', removed.length, removed.join(', '));
