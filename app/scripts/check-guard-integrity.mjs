#!/usr/bin/env node
/**
 * Client integrity checks: CORE must not require Cursor test harness, and
 * leftover scripts/test-*.mjs on a simulated client (no KM_UPDATE_ORIGIN)
 * must heal instead of GUARD extra / missing.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guard = require(path.join(ROOT, 'km_guard.js'));

const {
  CORE_FILES,
  verify,
  verifyAsync,
  writeIntegrity,
  isLeftoverTestHarness,
  shouldOmitFromClientPackage,
  stripLeftoverTestHarness
} = guard;

const fail = [];
let ok = 0;

function pass(msg) {
  ok++;
  console.log('  OK  ' + msg);
}
function bad(msg) {
  fail.push(msg);
  console.log('  FAIL ' + msg);
}

function assert(cond, msg) {
  if (cond) pass(msg);
  else bad(msg);
}

const KNOWN_HARNESS = [
  'scripts/test-empty-sections-fix.mjs',
  'scripts/test-34day-curriculum.mjs',
  'scripts/test-ai-dialog.mjs',
  'scripts/test-law-docs.mjs',
  'scripts/test-duty-types.mjs',
  'scripts/test-health.mjs',
  'scripts/test-client-update.mjs',
  'scripts/test-ui-unfreeze.mjs',
  'scripts/test-legal-sync-unfreeze.mjs',
  'scripts/test-product-batch.mjs'
];

console.log('=== CORE_FILES must not list test harness ===');
const coreHits = CORE_FILES.filter((rel) => String(rel).replace(/\\/g, '/').indexOf('scripts/test-') === 0);
assert(coreHits.length === 0, 'CORE_FILES has zero scripts/test-* entries');
if (coreHits.length) bad('CORE_FILES still lists: ' + coreHits.join(', '));

console.log('\n=== shipped km_integrity.json must not require test harness ===');
const shipped = JSON.parse(fs.readFileSync(path.join(ROOT, 'km_integrity.json'), 'utf8'));
const sealHits = Object.keys(shipped.files || {}).filter((rel) => String(rel).indexOf('scripts/test-') === 0);
assert(sealHits.length === 0, 'km_integrity.json files has zero scripts/test-* keys');
if (sealHits.length) bad('seal still lists: ' + sealHits.join(', '));

console.log('\n=== classify leftover harness vs malware ===');
KNOWN_HARNESS.forEach((rel) => {
  assert(isLeftoverTestHarness(rel) && shouldOmitFromClientPackage(rel), 'omit/heal ' + rel);
});
assert(!isLeftoverTestHarness('evil.js'), 'evil.js is not leftover harness');
assert(!isLeftoverTestHarness('scripts/seed-34day-knowledge.mjs'), 'seed script is not leftover harness');
assert(!isLeftoverTestHarness('js/km-ops.js'), 'runtime js is not leftover harness');

function makeSimClient(opts) {
  opts = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'km-guard-'));
  const appDir = path.join(tmp, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  CORE_FILES.forEach((rel) => {
    const full = path.join(appDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'dummy-core:' + rel + '\n', 'utf8');
  });
  writeIntegrity(appDir);
  if (opts.origin) {
    fs.writeFileSync(path.join(appDir, 'KM_UPDATE_ORIGIN'), '', 'utf8');
  }
  (opts.leftovers || []).forEach((rel) => {
    const full = path.join(appDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'orphan-harness:' + rel + '\n', 'utf8');
  });
  (opts.malware || []).forEach((rel) => {
    const full = path.join(appDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'malware:' + rel + '\n', 'utf8');
  });
  return { tmp, appDir };
}

function leftoverPresent(appDir, names) {
  return names.filter((rel) => fs.existsSync(path.join(appDir, rel)));
}

console.log('\n=== simulated client (no origin) with leftover test-*.mjs ===');
{
  const leftovers = [
    'scripts/test-34day-curriculum.mjs',
    'scripts/test-ai-dialog.mjs',
    'scripts/test-empty-sections-fix.mjs',
    'scripts/test-ui-unfreeze.mjs',
    'scripts/test-product-batch.mjs'
  ];
  const { tmp, appDir } = makeSimClient({ leftovers });
  leftovers.forEach((rel) => assert(fs.existsSync(path.join(appDir, rel)), 'precondition present ' + rel));
  const logs = [];
  const r = verify(appDir, (m) => logs.push(String(m)));
  assert(!!(r && r.ok), 'verify ok after heal leftovers=' + JSON.stringify(r));
  assert(r && r.reason !== 'extra' && r.reason !== 'missing', 'no extra/missing reason');
  assert(!(r && r.message && /օտար կամ հին/.test(r.message)), 'no foreign/old-files dialog message');
  const still = leftoverPresent(appDir, leftovers);
  assert(still.length === 0, 'leftover test harness removed from disk');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n=== simulated client with leftovers absent ===');
{
  const { tmp, appDir } = makeSimClient({});
  const r = verify(appDir);
  assert(!!(r && r.ok), 'verify ok when leftovers absent=' + JSON.stringify(r));
  assert(!(r && r.reason === 'missing'), 'no missing CORE');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n=== verifyAsync client leftovers ===');
{
  const leftovers = ['scripts/test-34day-curriculum.mjs', 'scripts/test-ai-dialog.mjs'];
  const { tmp, appDir } = makeSimClient({ leftovers });
  const r = await verifyAsync(appDir);
  assert(!!(r && r.ok), 'verifyAsync ok after heal=' + JSON.stringify(r));
  assert(leftoverPresent(appDir, leftovers).length === 0, 'verifyAsync removed leftovers');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n=== malware extra still blocked on client ===');
{
  const leftovers = ['scripts/test-ai-dialog.mjs'];
  const { tmp, appDir } = makeSimClient({ leftovers, malware: ['evil.js'] });
  const r = verify(appDir);
  assert(r && r.ok === false && r.reason === 'extra', 'malware extra still fails reason=' + (r && r.reason));
  assert(r && r.message && /evil\.js/.test(r.message), 'malware named in extra message');
  assert(!fs.existsSync(path.join(appDir, 'scripts/test-ai-dialog.mjs')), 'harness still healed when malware present');
  assert(fs.existsSync(path.join(appDir, 'evil.js')), 'malware file not deleted');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n=== Hub origin keeps test scripts ===');
{
  const leftovers = ['scripts/test-ai-dialog.mjs'];
  const { tmp, appDir } = makeSimClient({ leftovers, origin: true });
  const r = verify(appDir);
  assert(!!(r && r.ok && r.origin), 'origin verify ok=' + JSON.stringify(r));
  assert(fs.existsSync(path.join(appDir, leftovers[0])), 'Hub test script not deleted');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n=== strip helper + remint stripOrphans:false ===');
{
  const leftovers = ['scripts/test-34day-curriculum.mjs'];
  const { tmp, appDir } = makeSimClient({ leftovers });
  const r = verify(appDir, null, null, { stripOrphans: false });
  assert(r && r.ok === false && r.reason === 'extra', 'without strip, leftovers are extras');
  const n = stripLeftoverTestHarness(appDir).length;
  assert(n === 1, 'stripLeftoverTestHarness removed 1');
  const r2 = verify(appDir, null, null, { stripOrphans: false });
  assert(!!(r2 && r2.ok), 'after explicit strip, verify ok');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n' + ok + ' passed, ' + fail.length + ' failed');
if (fail.length) {
  fail.forEach((m) => console.log('  • ' + m));
  process.exit(1);
}
console.log('GUARD_INTEGRITY_CHECKS_OK');
