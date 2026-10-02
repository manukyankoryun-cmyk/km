/* Live GUI test via Electron CDP (remote-debugging-port) */
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');
const os = require('os');

const KM_EXE = process.env.KM_EXE || 'E:\\2\\KM\\runtime\\KM.exe';
const KM_CWD = process.env.KM_CWD || 'E:\\2\\KM\\runtime';
const USER_ROOT = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'KM', 'UserData');
const LICENSE_FILE = path.join(USER_ROOT, 'km_license.json');
const SECURITY_FILE = path.join(USER_ROOT, 'km_security.json');
const CDP_PORT = 9222;

let passed = 0;
let failed = 0;
let kmProc = null;

function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail || ''); }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }
  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

async function waitForCdp(timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const raw = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = JSON.parse(raw);
      const page = list.find((t) => t.type === 'page' && /index\.html/i.test(t.url || '')) || list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP endpoint not available');
}

async function evalInPage(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails));
  }
  return r.result.value;
}

async function resetUserData() {
  await fsp.mkdir(USER_ROOT, { recursive: true });
  for (const f of [LICENSE_FILE, SECURITY_FILE]) {
    try { await fsp.unlink(f); } catch {}
  }
}

async function readLicenseValid() {
  try {
    const lic = JSON.parse(await fsp.readFile(LICENSE_FILE, 'utf8'));
    const exp = lic.expiresAt ? new Date(lic.expiresAt).getTime() : 0;
    return exp > Date.now();
  } catch {
    return false;
  }
}

async function runGuiFlow(cdp) {
  await cdp.send('DOM.enable');
  await sleep(2000);

  const gateVisible = await evalInPage(cdp, `!!document.getElementById('kmLoginOverlay')`);
  ok('dual login visible on first run', gateVisible === true);

  const actResult = await evalInPage(cdp, `(async () => {
    const tabUser = document.getElementById('kmLoginTabUser');
    if (tabUser) tabUser.click();
    const inp = document.getElementById('kmLoginUserCode');
    if (!inp) return { ok: false, err: 'no user code input' };
    inp.value = 'AA000000';
    if (!window.kmNative || !window.kmNative.license) return { ok: false, err: 'no license API' };
    const act = await window.kmNative.license.activate('AA000000');
    return { ok: !!(act && act.valid), overlay: !!document.getElementById('kmLoginOverlay') };
  })()`);
  ok('user activation AA000000 via dual login', actResult && actResult.ok === true, JSON.stringify(actResult));

  const licValid = await readLicenseValid();
  ok('km_license.json written and valid', licValid);

  const lic = JSON.parse(await fsp.readFile(LICENSE_FILE, 'utf8'));
  lic.expiresAt = new Date(Date.now() - 86400000).toISOString();
  await fsp.writeFile(LICENSE_FILE, JSON.stringify(lic, null, 2));

  await evalInPage(cdp, `sessionStorage.clear(); location.reload();`);
  await sleep(3000);

  const expiredLogin = await evalInPage(cdp, `(async () => {
    if (typeof window.kmEnsureSecurity === 'function') await window.kmEnsureSecurity();
    const overlay = document.getElementById('kmLoginOverlay');
    const txt = overlay ? overlay.innerText : '';
    return { hasOverlay: !!overlay, hasAdmin: /Administrator/i.test(txt), hasUser: /Օգտատեր/i.test(txt) };
  })()`);
  ok('dual login shown when expired', expiredLogin && expiredLogin.hasOverlay === true, JSON.stringify(expiredLogin));
  ok('admin tab on expired login', expiredLogin && expiredLogin.hasAdmin === true);
  ok('user tab on expired login', expiredLogin && expiredLogin.hasUser === true);

  const adminLogin = await evalInPage(cdp, `(async () => {
    const user = document.getElementById('kmLoginUser');
    const pw = document.getElementById('kmLoginPw');
    if (!user || !pw) return { ok: false, err: 'no admin fields' };
    user.value = 'Koryun1992';
    pw.value = '098460813';
    const r = await window.kmNative.security.verify({ username: user.value, password: pw.value });
    if (!r.ok || !r.isAdmin) return { ok: false, r };
    window.kmLicenseBypass = true;
    sessionStorage.setItem('km_license_bypass', '1');
    document.getElementById('kmLoginOverlay')?.remove();
    return { ok: true, role: r.role, bypass: sessionStorage.getItem('km_license_bypass') };
  })()`);
  ok('admin login Koryun1992 when expired', adminLogin && adminLogin.ok === true, JSON.stringify(adminLogin));

  const renew = await evalInPage(cdp, `(async () => window.kmNative.license.activate('AA000001'))()`);
  ok('renewal AA000001 via IPC', renew && renew.valid === true, JSON.stringify(renew));
  ok('renewal last code', renew && renew.lastCode === 'AA000001');

  const licValid2 = await readLicenseValid();
  ok('license valid after renewal', licValid2);
}

async function main() {
  console.log('KM Live GUI Test (CDP)');
  console.log('KM_EXE:', KM_EXE);
  console.log('USER_ROOT:', USER_ROOT);
  console.log('');

  if (!fs.existsSync(KM_EXE)) {
    console.error('KM.exe not found:', KM_EXE);
    process.exit(2);
  }
  if (typeof WebSocket === 'undefined') {
    console.error('Node WebSocket not available — use Node 18+');
    process.exit(2);
  }

  process.env.LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

  console.log('[0] Reset license/security for clean run');
  await resetUserData();

  console.log('[1] Launch KM with remote debugging');
  kmProc = spawn(KM_EXE, [`--remote-debugging-port=${CDP_PORT}`], {
    cwd: KM_CWD,
    stdio: 'ignore',
    windowsHide: false,
    env: { ...process.env }
  });

  let cdp;
  try {
    const wsUrl = await waitForCdp();
    cdp = new Cdp(wsUrl);
    await cdp.ready();
    console.log('[2] CDP connected');
    await runGuiFlow(cdp);
  } finally {
    if (cdp) cdp.close();
    if (kmProc && !kmProc.killed) {
      try { kmProc.kill(); } catch {}
    }
  }

  console.log('');
  console.log('Results:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message || e);
  if (kmProc && !kmProc.killed) try { kmProc.kill(); } catch {}
  process.exit(2);
});
