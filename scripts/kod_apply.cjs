/* Stage unused activation code for KM UI (does NOT activate license) */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function findLicenseModule() {
  const candidates = [
    path.join(__dirname, '..', 'runtime', 'resources', 'app', 'km_license.js'),
    path.join(__dirname, '..', 'app', 'km_license.js')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return require(c);
  }
  throw new Error('km_license.js not found');
}

const kmLicense = findLicenseModule();
const userRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'KM', 'UserData');
const licenseFile = path.join(userRoot, 'km_license.json');
const pendingFile = path.join(userRoot, 'km_pending_activation.json');

async function readJson(p, def) {
  try { return JSON.parse(await fsp.readFile(p, 'utf8')); } catch { return def; }
}

async function writeJson(p, obj) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fsp.rename(tmp, p);
}

function usage() {
  console.log('Usage:');
  console.log('  node kod_apply.cjs --stage-next          Pick next unused code -> KM login field');
  console.log('  node kod_apply.cjs --stage CODE        Stage specific code -> KM login field');
  console.log('  node kod_apply.cjs --activate CODE     Apply code immediately (admin only)');
}

(async () => {
  const args = process.argv.slice(2);
  const mode = args[0] || '--stage-next';

  try {
    const lic = await readJson(licenseFile, { usedCodes: [], expiresAt: null, activatedAt: null });

    if (mode === '--stage-next') {
      const pick = kmLicense.findNextUnusedCode(lic);
      await writeJson(pendingFile, { code: pick.code, stagedAt: new Date().toISOString(), scanIndex: pick.index });
      console.log('OK: Unused code staged for KM login screen');
      console.log('Code:', pick.code);
      console.log('');
      console.log('License is NOT activated yet.');
      console.log('Open KM -> User tab -> verify code in field -> click Login/Activate.');
      process.exit(0);
    }

    if (mode === '--stage') {
      const code = args[1] || '';
      const idx = kmLicense.codeToIndex(code);
      if (idx < 0) throw new Error('Invalid code format (AA000000 … PP000000)');
      const canonical = kmLicense.indexToCode(idx);
      if ((lic.usedCodes || []).includes(canonical)) throw new Error('Code already used');
      await writeJson(pendingFile, { code: canonical, stagedAt: new Date().toISOString() });
      console.log('OK: Code staged for KM login screen:', canonical);
      console.log('License is NOT activated yet.');
      process.exit(0);
    }

    if (mode === '--activate') {
      const code = args[1] || '';
      if (lic.lastCode && Array.isArray(lic.receipts)) {
        lic.receipts.forEach((r) => {
          if (r && String(r.code) === String(lic.lastCode) && !r.endedAt) {
            r.endedAt = new Date().toISOString();
            r.endReason = 'replaced';
          }
        });
      }
      const next = kmLicense.applyActivationCode(lic, code);
      let user = '';
      try { user = os.userInfo().username; } catch {}
      const cpus = os.cpus() || [];
      const machine = {
        hostname: os.hostname() || '',
        osName: (os.type() || '') + ' ' + (os.release() || ''),
        osRelease: os.release() || '',
        arch: os.arch(),
        platform: os.platform(),
        username: user,
        cpu: (cpus[0] && cpus[0].model) || '',
        cpuCount: cpus.length,
        ramTotal: os.totalmem(),
        ramFree: os.freemem(),
        ips: [],
        execPath: process.execPath || '',
        userData: userRoot,
        at: new Date().toISOString()
      };
      next.machine = machine;
      next.machineStamp = crypto.createHash('sha256').update(['KM1', os.hostname(), os.platform(), os.arch(), user, (cpus[0] && cpus[0].model) || ''].join('\n')).digest('hex');
      next.receipts = Array.isArray(next.receipts) ? next.receipts : [];
      next.receipts.push({
        code: next.lastCode,
        kind: next.lastKind || 'year',
        at: next.activatedAt,
        expiresAt: next.expiresAt,
        endedAt: null,
        endReason: null,
        machine,
        source: 'kod_apply'
      });
      await writeJson(licenseFile, next);
      try { await fsp.unlink(pendingFile); } catch {}
      const st = kmLicense.licenseStatus(next);
      console.log('OK: License active until', st.expiresAt);
      console.log('Code used:', next.lastCode);
      console.log('Computer:', machine.hostname || '');
      process.exit(0);
    }

    usage();
    process.exit(1);
  } catch (e) {
    console.error('ERROR:', e.message || e);
    process.exit(1);
  }
})();
