/* End-to-end license + security tests (isolated temp UserData) */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { createKmBackend } = require('../app/km_backend.js');
const kmLicense = require('../app/km_license.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'km-lic-test-'));
let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  PASS:', name);
  } else {
    failed++;
    console.log('  FAIL:', name, detail || '');
  }
}

async function run() {
  console.log('KM License Test Suite');
  console.log('Temp UserData:', tmpRoot);
  console.log('');

  const backend = createKmBackend(tmpRoot);

  // --- 1. Default admin credentials ---
  console.log('[1] Default admin security');
  await backend.ensureDefaultSecurity();
  const sec = await backend.getSecurity();
  ok('default role admin', sec.role === 'admin');
  ok('default username Koryun1992', sec.username === 'Koryun1992');
  ok('password set', sec.hasPassword === true);

  const goodAdmin = await backend.verifySecurity('Koryun1992', '098460813');
  ok('admin login ok', goodAdmin.ok && goodAdmin.isAdmin);

  const badPw = await backend.verifySecurity('Koryun1992', 'wrong');
  ok('wrong password rejected', !badPw.ok);

  const badUser = await backend.verifySecurity('other', '098460813');
  ok('wrong username rejected', !badUser.ok);

  // --- 2. No license yet ---
  console.log('[2] Initial license state');
  let st = await backend.getLicenseStatus();
  ok('needs activation', st.needsActivation === true && st.valid === false);

  // --- 3. Activate AA000000 ---
  console.log('[3] Activation AA000000');
  const act = await backend.activateLicense('AA000000');
  ok('activation ok', act.ok && act.valid);
  ok('365 days left', act.daysLeft >= 364 && act.daysLeft <= 365);
  ok('last code AA000000', act.lastCode === 'AA000000');

  // --- 4. Reuse same code ---
  console.log('[4] One-time code reuse');
  let reuseErr = '';
  try {
    await backend.activateLicense('AA000000');
  } catch (e) {
    reuseErr = e.message;
  }
  ok('reuse blocked', /օգտագործված/i.test(reuseErr));

  // --- 5. Invalid code ---
  console.log('[5] Invalid code');
  let badCodeErr = '';
  try {
    await backend.activateLicense('ZZ999999');
  } catch (e) {
    badCodeErr = e.message;
  }
  ok('invalid code rejected', /Սխալ/i.test(badCodeErr));

  // --- 6. Expired license blocks non-admin conceptually ---
  console.log('[6] Expired license simulation');
  const lic = await backend.getLicenseRecord();
  lic.expiresAt = new Date(Date.now() - 86400000).toISOString();
  await fsp.writeFile(path.join(tmpRoot, 'km_license.json'), JSON.stringify(lic, null, 2));
  st = await backend.getLicenseStatus();
  ok('expired flag', st.expired === true && st.valid === false);

  const adminWhenExpired = await backend.verifySecurity('Koryun1992', '098460813');
  ok('admin still verifies when expired', adminWhenExpired.ok && adminWhenExpired.isAdmin);

  // --- 7. kod_apply-style renewal ---
  console.log('[7] Renewal via new code AA000001');
  const kodApply = kmLicense.applyActivationCode(lic, 'AA000001');
  await fsp.writeFile(path.join(tmpRoot, 'km_license.json'), JSON.stringify(kodApply, null, 2));
  st = await backend.getLicenseStatus();
  ok('renewed valid', st.valid === true && !st.expired);
  ok('renewal code stored', kodApply.lastCode === 'AA000001');

  // --- 8. Code range sanity ---
  console.log('[8] Code range AA000000 … ALEBC1FF');
  ok('AA000000 valid', kmLicense.isValidCodeFormat('AA000000'));
  ok('ALEBC1FF valid (last)', kmLicense.isValidCodeFormat('ALEBC1FF'));
  ok('ALEBC200 invalid', !kmLicense.isValidCodeFormat('ALEBC200'));
  ok('PP000000 invalid', !kmLicense.isValidCodeFormat('PP000000'));
  ok('AA000001 index', kmLicense.codeToIndex('AA000001') === 1);
  ok('QQ000000 invalid', !kmLicense.isValidCodeFormat('QQ000000'));

  // --- 9b. kod3.cmd quarter codes AA00-UU00, 3 months ---
  console.log('[9b] kod3 quarter code AA00-UU00');
  ok('AA00-AA00 valid', kmLicense.isValidQuarterCodeFormat('AA00-AA00'));
  ok('AA00-UU00 valid', kmLicense.isValidQuarterCodeFormat('AA00-UU00'));
  ok('AA00-AA00 index 0', kmLicense.quarterCodeToIndex('AA00-AA00') === 0);
  ok('AA00-UU00 index 44000', kmLicense.quarterCodeToIndex('AA00-UU00') === 44000);
  ok('hyphen required', !kmLicense.isValidQuarterCodeFormat('AA00AA00'));
  const qTmp = path.join(tmpRoot, 'q-user');
  fs.mkdirSync(qTmp, { recursive: true });
  const qBackend = createKmBackend(qTmp);
  const qAct = await qBackend.activateLicense('AA00-AA00');
  ok('kod3 activation ok', qAct.ok && qAct.valid && qAct.kind === 'quarter');
  ok('kod3 last code', qAct.lastCode === 'AA00-AA00');
  ok('kod3 ~3 months', qAct.daysLeft >= 88 && qAct.daysLeft <= 94);
  const yStill = kmLicense.applyActivationCode({ usedCodes: ['AA00-AA00'] }, 'AA000000');
  ok('yearly still 365 after kod3 code used', yStill.lastKind === 'year');
  const yDays = Math.ceil((new Date(yStill.expiresAt).getTime() - Date.now()) / 86400000);
  ok('yearly days still ~365', yDays >= 364 && yDays <= 366);

  console.log('[8b] Setup requires a new one-time code');
  const resetKeep = kmLicense.resetLicenseSession({
    usedCodes: ['AA000000'],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    activatedAt: new Date().toISOString(),
    lastCode: 'AA000000',
    lastKind: 'year'
  });
  ok('reset keeps used codes', resetKeep.usedCodes.includes('AA000000'));
  ok('reset clears expiry', !resetKeep.expiresAt && !resetKeep.lastKind);

  const gateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'km-setup-gate-'));
  fs.writeFileSync(path.join(gateRoot, 'km_license.json'), JSON.stringify({
    usedCodes: ['AA000001'],
    lastCode: 'AA000001',
    lastKind: 'year',
    activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 86400000).toISOString()
  }));
  fs.writeFileSync(path.join(gateRoot, 'km_setup_require_activation'), '1');
  const gateBackend = createKmBackend(gateRoot);
  const gateSt = await gateBackend.getLicenseStatus();
  ok('setup gate requires activation', gateSt.valid === false && gateSt.needsActivation === true);
  const gateLic = JSON.parse(fs.readFileSync(path.join(gateRoot, 'km_license.json'), 'utf8'));
  ok('setup gate keeps used codes', Array.isArray(gateLic.usedCodes) && gateLic.usedCodes.includes('AA000001'));
  ok('setup gate file consumed', !fs.existsSync(path.join(gateRoot, 'km_setup_require_activation')));
  try { fs.rmSync(gateRoot, { recursive: true, force: true }); } catch {}

  // --- 9. payload file ---
  console.log('[9] kod_codes.txt file');
  const codesFile = path.join(__dirname, '..', 'payload', 'kod_codes.txt');
  if (fs.existsSync(codesFile)) {
    const lines = fs.readFileSync(codesFile, 'utf8').trim().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const first = lines[0];
    const lastLine = lines[lines.length - 1];
    ok('file exists', true);
    ok('first line AA000000', first === 'AA000000');
    ok('20M codes in file', lines.length >= 20000000);
  } else {
    ok('file exists', false, codesFile);
  }

  console.log('');
  console.log('Results:', passed, 'passed,', failed, 'failed');
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
