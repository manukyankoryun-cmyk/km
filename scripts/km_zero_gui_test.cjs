/* Zero GUI test — fresh UserData, full flow via CDP */
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');
const os = require('os');

const KM_EXE = process.env.KM_EXE || 'E:\\2\\KM\\runtime\\KM.exe';
const KM_CWD = process.env.KM_CWD || 'E:\\2\\KM\\runtime';
const SETUP = process.env.KM_SETUP || 'C:\\Users\\PUBG\\OneDrive\\Desktop\\KM_1.009.4_SEPARATE_FORMAL_DATA_PER_GRAPH\\dist\\KM_Setup_x64.exe';
const USER_ROOT = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'KM', 'UserData');
const CDP_PORT = 9223;

let passed = 0, failed = 0, kmProc = null;

function ok(n, c, d) { if (c) { passed++; console.log('  PASS:', n); } else { failed++; console.log('  FAIL:', n, d || ''); } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpGet(url) { return new Promise((res, rej) => http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej)); }

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map();
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    };
  }
  ready() { return new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; }); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function waitCdp() {
  for (let i = 0; i < 90; i++) {
    try {
      const list = JSON.parse(await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`));
      const page = list.find(t => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error('CDP timeout');
}

async function evalPage(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
  return r.result.value;
}

async function freshUserData() {
  const backup = USER_ROOT + '_backup_' + Date.now();
  if (fs.existsSync(USER_ROOT)) {
    await fsp.rename(USER_ROOT, backup);
    console.log('  Backed up UserData ->', backup);
  }
  await fsp.mkdir(USER_ROOT, { recursive: true });
}

async function install() {
  if (!fs.existsSync(SETUP)) throw new Error('Setup missing: ' + SETUP);
  const { execSync } = require('child_process');
  execSync(`"${SETUP}" /S /D=E:\\2\\KM`, { stdio: 'inherit' });
  await sleep(5000);
  if (!fs.existsSync(KM_EXE)) throw new Error('KM.exe missing after install');
}

async function runFlow(cdp) {
  console.log('[1] Activation gate (fresh install)');
  let gate = false;
  for (let i = 0; i < 16; i++) {
    gate = await evalPage(cdp, `!!document.getElementById('kmLicenseGate')`);
    if (gate) break;
    await sleep(500);
  }
  ok('activation gate on first run', gate === true);

  const act = await evalPage(cdp, `(async()=>window.kmActivateLicense('AA000000'))()`);
  ok('activate AA000000', act === true);

  console.log('[2] Home layout');
  await evalPage(cdp, `{page='home';render();}`);
  await sleep(1500);
  const home = await evalPage(cdp, `({
    row:!!document.querySelector('.kmHomeBottomRow'),
    compact:!!document.querySelector('.kmWorkStatusCompact'),
    graph:!!document.querySelector('.kmCurrentGraphCard'),
    help:!!document.querySelector('.kmHomeHelpCard')
  })`);
  ok('kmHomeBottomRow', home.row);
  ok('compact work status', home.compact);
  ok('current graph card', home.graph);
  ok('help bottom-right', home.help);

  console.log('[3] Sidebar navigation');
  const nav = await evalPage(cdp, `({
    mgmt:!!document.querySelector('[data-page="management"]'),
    vac:!!document.getElementById('vacationsNavBtn'),
    lib:!!document.querySelector('[data-page="library"]'),
    about:!!document.querySelector('[data-page="about"]')
  })`);
  ok('sidebar Կառավարում', nav.mgmt);
  ok('sidebar Արձակուրդ', nav.vac);
  ok('sidebar Գրադարան', nav.lib);
  ok('sidebar Ծրագրի մասին', nav.about);

  console.log('[4] Library page');
  await evalPage(cdp, `{page='library';render();}`);
  await sleep(2000);
  const lib = await evalPage(cdp, `({
    title:document.getElementById('pageTitle')?.textContent,
    stats:!!document.getElementById('kmLibStats'),
    tabs:document.querySelectorAll('.kmLibTabs button').length
  })`);
  ok('library page title', lib.title === 'Գրադարան');
  ok('library stats', lib.stats);
  ok('4 library tabs', lib.tabs === 4);

  const upload = await evalPage(cdp, `(async()=>{
    if(!window.kmNative?.library)return {ok:false,err:'no api'};
    const bytes=[37,80,68,70,45,49,46,52,10];
    const r=await window.kmNative.library.add({name:'zero-test.pdf',bytes});
    return {ok:r.ok&&r.entry?.type==='pdf'};
  })()`);
  ok('upload PDF via library API', upload.ok === true);

  console.log('[5] Admin login');
  await evalPage(cdp, `{page='home';render();}`);
  const login = await evalPage(cdp, `(async()=>{
    if(typeof kmEnsureSecurity!=='function')return {ok:false};
    const r=await window.kmNative.security.verify({username:'Koryun1992',password:'098460813'});
    return {ok:r.ok&&r.isAdmin,role:r.role};
  })()`);
  ok('admin Koryun1992 login', login.ok === true);

  console.log('[6] Duty types + planning block');
  await evalPage(cdp, `typeof openDutyTypesSection==='function'&&openDutyTypesSection()`);
  await sleep(1000);
  const duty = await evalPage(cdp, `({
    plan:!!document.getElementById('kmDutyPlanBlock'),
    title:document.getElementById('pageTitle')?.textContent
  })`);
  ok('planning block in duty types', duty.plan);
  ok('duty types page title', /Վերակարգ/.test(duty.title || ''));
}

async function main() {
  console.log('KM ZERO GUI TEST');
  if (typeof WebSocket === 'undefined') { console.error('Need Node 18+'); process.exit(2); }
  process.env.LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

  try {
    console.log('[0] Install + fresh UserData');
    await install();
    await freshUserData();

    try { require('child_process').execSync('taskkill /IM KM.exe /F', { stdio: 'ignore' }); } catch {}
    await sleep(1500);

    kmProc = spawn(KM_EXE, [`--remote-debugging-port=${CDP_PORT}`], { cwd: KM_CWD, stdio: 'ignore', env: { ...process.env } });
    const cdp = new Cdp(await waitCdp());
    await cdp.ready();
    await runFlow(cdp);
    cdp.close();
  } finally {
    if (kmProc && !kmProc.killed) try { kmProc.kill(); } catch {}
  }

  console.log('\nResults:', passed, 'passed,', failed, 'failed');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e.message); if (kmProc) try { kmProc.kill(); } catch {}; process.exit(2); });
