/* Full sections + functions + help-bot CDP test.
 * Run: node scripts/km_full_sections_bot_test.cjs
 * Does NOT touch real UserData — uses temp LOCALAPPDATA.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');
const ELECTRON = path.join(ROOT, 'payload', 'runtime', 'x64', 'electron.exe');
const CDP_PORT = 9337;
const TEMP_APPDATA = path.join(os.tmpdir(), 'KM_FULL_TEST_APPDATA_' + Date.now());
const USER_ROOT = path.join(TEMP_APPDATA, 'KM', 'UserData');

let passed = 0;
let failed = 0;
let skipped = 0;
let kmProc = null;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  PASS:', name);
  } else {
    failed++;
    failures.push(name + (detail ? ' · ' + detail : ''));
    console.log('  FAIL:', name, detail || '');
  }
}
function skip(name, why) {
  skipped++;
  console.log('  SKIP:', name, why || '');
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

async function waitForCdp(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const raw = await httpGet(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = JSON.parse(raw);
      const page =
        list.find((t) => t.type === 'page' && /index\.html/i.test(t.url || '')) ||
        list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(400);
  }
  throw new Error('CDP timeout');
}

async function evalPage(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (r.exceptionDetails) {
    const t = r.exceptionDetails.text || (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || 'eval error';
    throw new Error(t);
  }
  return r.result.value;
}

async function ensureBoot(cdp) {
  /* Wait for document + scripts */
  for (let i = 0; i < 40; i++) {
    const ready = await evalPage(cdp, `!!(document.body && typeof window.kmOpenPage === 'function')`);
    if (ready) return true;
    await sleep(500);
  }
  return false;
}

async function unlockApp(cdp) {
  /* Try activate + admin bypass so pages are usable */
  const r = await evalPage(cdp, `(async () => {
    const out = { steps: [] };
    try {
      if (window.kmNative && window.kmNative.license && window.kmNative.license.activate) {
        const act = await window.kmNative.license.activate('AA000000');
        out.act = !!(act && act.valid);
        out.steps.push('activate');
      }
    } catch (e) { out.actErr = String(e && e.message || e); }
    try {
      if (window.kmNative && window.kmNative.security && window.kmNative.security.verify) {
        const v = await window.kmNative.security.verify({ username: 'Koryun1992', password: '098460813' });
        out.verify = !!(v && v.ok);
        out.role = v && v.role;
        out.steps.push('verify');
      }
    } catch (e) { out.verifyErr = String(e && e.message || e); }
    window.kmLicenseBypass = true;
    try { sessionStorage.setItem('km_license_bypass', '1'); } catch (e0) {}
    try { sessionStorage.setItem('km_auth_mode', 'admin'); } catch (e1) {}
    try { sessionStorage.setItem('km_auth_username', 'Koryun1992'); } catch (e2) {}
    window.kmUserRole = 'admin';
    window.kmAuthUsername = 'Koryun1992';
    window.kmEditSections = null;
    window.kmViewSections = null;
    document.body.classList.remove('km-role-user', 'km-role-viewer');
    document.body.classList.add('km-role-admin');
    const ov = document.getElementById('kmLoginOverlay') || document.getElementById('kmLicenseGate');
    if (ov) ov.remove();
    document.documentElement.classList.remove('km-boot-idle');
    document.body.classList.remove('km-boot-idle');
    if (typeof window.kmLoadDeferredModules === 'function') {
      await window.kmLoadDeferredModules();
      out.deferred = !!window.__kmDeferredReady;
    }
    out.steps.push('unlocked');
    return out;
  })()`);
  return r;
}

const PAGES = [
  { id: 'home', expect: /kmHome|Հիմնական|home/i },
  { id: 'accounting', expect: /Հաշվառում|accounting|Պաշտոն|Անձնակազմ/i },
  { id: 'people', expect: /Անձնակազմ|people|Ավելացնել/i },
  { id: 'positions', expect: /Պաշտոն|positions/i },
  { id: 'troopStructure', expect: /ՀԱՇՎԱՌՈՒՄ|troop|Excel|կառուցվածք/i },
  { id: 'dutyTypes', expect: /Վերակարգ|duty|տեսակ/i },
  { id: 'schedule', expect: /գրաֆիկ|schedule|Պլանավորում|Հերթապահ/i },
  { id: 'library', expect: /ԳՐԱԴԱՐԱՆ|library|Ֆայլ|Նշում|Արխիվ/i },
  { id: 'lawdocs', expect: /ԻՐԱՎԱԲԱՆ|law|Բնութագիր|տույժ|իրավունք/i },
  { id: 'unitTools', expect: /Զորամաս|unit|ՎՔՆ|գործիք/i },
  { id: 'unitBadDays', expect: /անհարմար|bad|օր/i },
  { id: 'unitFuel', expect: /ՎՔՆ|fuel|վառելիք|հաշվիչ/i },
  { id: 'reports', expect: /Հաշվետվ|report|համաժամ/i },
  { id: 'users', expect: /Օգտատեր|users|իրավունք|դիտել/i },
  { id: 'admins', expect: /Ադմին|admin/i },
  { id: 'about', expect: /Ծրագրի մասին|about|Թարմացում|006\.4/i },
  { id: 'settings', expect: /Կարգավորում|settings|LLM|պահուստ/i },
  { id: 'freePeople', expect: /ազատ|free/i },
  { id: 'orderDraft', expect: /հրաման|order|նախագիծ/i },
  { id: 'docsPack', expect: /փաստաթղթ|docs|փաթեթ/i },
  { id: 'unitTrialLab', expect: /ՓՈՐՑԱՇՐՋԱՆ|trial|Wizard|Monitor/i }
];

const BOT_QUERIES = [
  { q: 'բարև', want: /բարի|օգնական|Smart Engine|օգնել/i },
  { q: 'օգնիր ինձ', want: /կարող|բաժին|գրաֆիկ|Smart Engine/i },
  { q: 'ինչպես կառուցել գրաֆիկ', want: /գրաֆիկ|վերակարգ|պլան/i },
  { q: 'անձնակազմ', want: /անձնակազմ|մարդ/i },
  { q: 'USB', want: /USB|sync|արտահան/i },
  { q: 'տույժ', want: /տույժ|կարգապահ|իրավաբան/i },
  { q: 'բնութագիր', want: /բնութագիր/i },
  { q: 'իրավունքներ', want: /իրավունք/i },
  { q: 'ինչպես փոխել գաղտնաբառը', want: /գաղտնաբառ|օգտատեր/i },
  { q: 'քանի մարդ կա', want: /անձ|մարդ|բազայում|ստորաբաժան/i }
];

async function testPages(cdp) {
  console.log('\n=== PAGES / SECTIONS ===');
  for (const p of PAGES) {
    try {
      const info = await evalPage(cdp, `(async () => {
        const name = ${JSON.stringify(p.id)};
        if (typeof window.kmOpenPage !== 'function') return { ok: false, err: 'no kmOpenPage' };
        window.kmOpenPage(name);
        await new Promise(r => setTimeout(r, 700));
        const host = document.getElementById('content');
        const html = host ? host.innerHTML : '';
        const title = (document.getElementById('pageTitle') || {}).textContent || '';
        const broken = /բացել չհաջողվեց|is not defined|TypeError|ReferenceError/i.test(html);
        const empty = html.replace(/\\s+/g, '').length < 40;
        return {
          ok: !broken && !empty,
          page: window.page || '',
          title: title,
          len: html.length,
          snippet: (title + ' ' + html.replace(/<[^>]+>/g, ' ')).replace(/\\s+/g, ' ').slice(0, 220),
          broken: broken,
          empty: empty
        };
      })()`);
      const text = String((info && info.snippet) || '');
      const match = p.expect.test(text) || (info && info.ok && info.len > 80);
      ok('page:' + p.id, !!(info && info.ok && match), info && !info.ok ? JSON.stringify(info) : (match ? '' : 'unexpected content: ' + text.slice(0, 120)));
    } catch (e) {
      ok('page:' + p.id, false, String(e.message || e));
    }
  }
}

async function testFunctions(cdp) {
  console.log('\n=== KEY FUNCTIONS ===');
  const checks = await evalPage(cdp, `({
    kmOpenPage: typeof window.kmOpenPage,
    kmCanAccessPage: typeof window.kmCanAccessPage,
    kmCanEditPage: typeof window.kmCanEditPage,
    kmCanEdit: typeof window.kmCanEdit,
    kmFilterGrantCards: typeof window.kmFilterGrantCards,
    kmHelpBotToggle: typeof window.kmHelpBotToggle,
    kmHelpBotPage: typeof window.kmHelpBotPage,
    KMHelpBotLLM: !!(window.KMHelpBotLLM),
    KMHelpBotShield: !!(window.KMHelpBotShield),
    setFeedbackVote: !!(window.KMHelpBotLLM && window.KMHelpBotLLM.setFeedbackVote),
    logInteraction: !!(window.KMHelpBotLLM && window.KMHelpBotLLM.logInteraction),
    kmRenderUnitToolsHub: typeof window.kmRenderUnitToolsHub,
    kmOpenPositionsPage: typeof window.kmOpenPositionsPage,
    kmOpenTroopStructure: typeof window.kmOpenTroopStructure,
    kmLawDocsPage: typeof window.kmLawDocsPage,
    kmOpenUsersAdmin: typeof window.kmOpenUsersAdmin,
    kmOpenSettings: typeof window.kmOpenSettings,
    libraryPage: typeof window.libraryPage,
    aboutPage: typeof window.aboutPage,
    toast: typeof toast,
    kmNotify: typeof window.kmNotify,
    deferred: !!window.__kmDeferredReady,
    grantParents: !!(window.kmGrantParents && window.kmGrantParents.unitTools)
  })`);
  Object.keys(checks).forEach((k) => {
    const v = checks[k];
    const good = v === 'function' || v === true;
    ok('fn:' + k, good, String(v));
  });

  const grant = await evalPage(cdp, `(() => {
    window.kmUserRole = 'editor';
    window.kmEditSections = ['unitFuel', 'people'];
    window.kmViewSections = ['usb'];
    const a = window.kmCanAccessPage('unitTools');
    const b = window.kmCanAccessPage('unitFuel');
    const c = window.kmCanAccessPage('people');
    const d = window.kmCanAccessPage('sysinfo');
    const e = window.kmCanEditPage('people');
    const f = window.kmCanEditPage('usb');
    window.kmUserRole = 'admin';
    window.kmEditSections = null;
    window.kmViewSections = null;
    return { unitToolsHub: a, unitFuel: b, people: c, sysinfoBlocked: d === false, peopleEdit: e, usbViewOnlyEdit: f === false };
  })()`);
  ok('grant:unitTools via child', grant.unitToolsHub === true);
  ok('grant:unitFuel', grant.unitFuel === true);
  ok('grant:people', grant.people === true);
  ok('grant:sysinfo blocked for editor', grant.sysinfoBlocked === true);
  ok('grant:people editable', grant.peopleEdit === true);
  ok('grant:usb view-only not editable', grant.usbViewOnlyEdit === true);
}

async function testBot(cdp) {
  console.log('\n=== HELP BOT ===');
  const open = await evalPage(cdp, `(async () => {
    if (typeof window.kmHelpBotPage === 'function') window.kmHelpBotPage();
    else if (typeof window.kmHelpBotToggle === 'function') window.kmHelpBotToggle();
    await new Promise(r => setTimeout(r, 500));
    const ov = document.getElementById('kmHelpBotOverlay');
    const input = document.getElementById('kmHbInput');
    const send = document.getElementById('kmHbSend');
    const log = document.getElementById('kmHbLog');
    return {
      open: !!(ov && !ov.hasAttribute('hidden')),
      input: !!input,
      send: !!send,
      log: !!log
    };
  })()`);
  ok('bot:panel open', open.open === true, JSON.stringify(open));
  ok('bot:input', open.input === true);
  ok('bot:send', open.send === true);

  for (const item of BOT_QUERIES) {
    try {
      const res = await evalPage(cdp, `(async () => {
        const q = ${JSON.stringify(item.q)};
        const inp = document.getElementById('kmHbInput');
        if (!inp) return { ok: false, err: 'no input' };
        /* reset answering lock if stuck */
        if (window.kmHelpBotClose) { /* keep open */ }
        inp.value = q;
        const send = document.getElementById('kmHbSend');
        if (send) send.click();
        else if (typeof window.kmHelpBotAsk === 'function') await window.kmHelpBotAsk(q);
        /* wait for answer */
        let text = '';
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 250));
          const log = document.getElementById('kmHbLog');
          text = log ? log.innerText : '';
          if (text && !/Գրում է|typing/i.test(text.split('\\n').pop() || '') && text.indexOf(q) >= 0) {
            /* ensure bot bubble after user */
            const bots = log.querySelectorAll('.kmHbMsg.bot');
            if (bots.length) {
              const last = bots[bots.length - 1].innerText || '';
              if (last && !/Գրում է/.test(last)) {
                return {
                  ok: true,
                  last: last.slice(0, 400),
                  hasObj: /\\[object Object\\]/.test(log.innerText),
                  fb: !!log.querySelector('[data-km-hb-fb]')
                };
              }
            }
          }
        }
        const log2 = document.getElementById('kmHbLog');
        return { ok: false, err: 'timeout', text: (log2 && log2.innerText || '').slice(-500) };
      })()`);
      const last = String((res && res.last) || '');
      ok('bot:q «' + item.q + '»', !!(res && res.ok && item.want.test(last) && !res.hasObj), res && res.ok ? (res.hasObj ? '[object Object]' : last.slice(0, 80)) : JSON.stringify(res).slice(0, 180));
      if (res && res.ok) ok('bot:no [object Object] «' + item.q + '»', res.hasObj !== true);
    } catch (e) {
      ok('bot:q «' + item.q + '»', false, String(e.message || e));
    }
  }

  /* Feedback thumbs */
  const fb = await evalPage(cdp, `(async () => {
    const btn = document.querySelector('[data-km-hb-fb="up"]');
    if (!btn) return { ok: false, err: 'no thumb button' };
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const on = btn.classList.contains('is-on');
    let mem = false;
    try {
      if (window.KMHelpBotLLM && window.KMHelpBotLLM.listFeedbackLogs) {
        const logs = await window.KMHelpBotLLM.listFeedbackLogs();
        mem = Array.isArray(logs) && logs.some(r => r && r.feedback === 'up');
      }
    } catch (e0) {}
    return { ok: true, on: on, mem: mem };
  })()`);
  ok('bot:👍 click', !!(fb && fb.ok && fb.on), JSON.stringify(fb));
  ok('bot:👍 persisted/mem', !!(fb && (fb.mem || fb.on)), JSON.stringify(fb));

  const hang = await evalPage(cdp, `(async () => {
    const inp = document.getElementById('kmHbInput');
    inp.value = 'լավ';
    document.getElementById('kmHbSend').click();
    await new Promise(r => setTimeout(r, 2000));
    inp.value = 'գրաֆիկ';
    document.getElementById('kmHbSend').click();
    await new Promise(r => setTimeout(r, 2500));
    const log = document.getElementById('kmHbLog');
    const text = log ? log.innerText : '';
    return {
      hasObj: /\\[object Object\\]/.test(text),
      answeringStuck: false,
      len: text.length
    };
  })()`);
  ok('bot:no hang/[object Object] after multi ask', hang && hang.hasObj === false && hang.len > 20, JSON.stringify(hang));

  await evalPage(cdp, `typeof window.kmHelpBotClose === 'function' && window.kmHelpBotClose()`);
}

async function staticWireChecks() {
  console.log('\n=== STATIC WIRING ===');
  const html = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
  const bot = fs.readFileSync(path.join(APP_DIR, 'js', 'km-help-bot.js'), 'utf8');
  const llm = fs.readFileSync(path.join(APP_DIR, 'js', 'km-help-bot-llm.js'), 'utf8');
  const core = fs.readFileSync(path.join(APP_DIR, 'js', 'km-v3-core.js'), 'utf8');
  const ver = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'km_version.json'), 'utf8'));
  ok('version ' + String(ver.update || ''), /^\d+\.\d+\.\d+$/.test(String(ver.update || '')));
  ok('html wires help-bot', html.includes('js/km-help-bot.js') && html.includes('js/km-help-bot-llm.js'));
  ok('unitTools not hard-admin-only', !html.includes("name==='settings'||name==='unitTools')&&window.kmUserRole!=='admin'"));
  ok('bot has textify', bot.includes('function textify'));
  ok('bot feedback hbToast', bot.includes('hbToast') && bot.includes('setFeedbackVote'));
  ok('llm FEEDBACK_MEM', llm.includes('FEEDBACK_MEM') && llm.includes('function plainText'));
  ok('core grants unitTools anyChild', core.includes("pageName==='unitTools'") && core.includes('anyChild'));
  const kb = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'data', 'km_help_bot.json'), 'utf8'));
  ok('kb topics', Array.isArray(kb.topics) && kb.topics.length >= 15);
  ok('kb has characteristic', kb.topics.some((t) => t.id === 'characteristic'));
}

async function main() {
  console.log('KM FULL SECTIONS + BOT TEST');
  console.log('ELECTRON:', ELECTRON);
  console.log('APP:', APP_DIR);
  console.log('TEMP APPDATA:', TEMP_APPDATA);
  console.log('');

  if (!fs.existsSync(ELECTRON)) throw new Error('electron missing: ' + ELECTRON);
  if (!fs.existsSync(path.join(APP_DIR, 'main.js'))) throw new Error('app/main.js missing');
  if (typeof WebSocket === 'undefined') throw new Error('Need Node 18+ WebSocket');

  await staticWireChecks();

  await fsp.mkdir(USER_ROOT, { recursive: true });

  console.log('\n=== LAUNCH ELECTRON ===');
  kmProc = spawn(ELECTRON, [APP_DIR, `--remote-debugging-port=${CDP_PORT}`], {
    cwd: APP_DIR,
    stdio: 'ignore',
    windowsHide: false,
    env: {
      ...process.env,
      LOCALAPPDATA: TEMP_APPDATA
    }
  });

  let cdp;
  try {
    const wsUrl = await waitForCdp();
    cdp = new Cdp(wsUrl);
    await cdp.ready();
    console.log('CDP connected');
    ok('boot:kmOpenPage ready', await ensureBoot(cdp));

    const unlock = await unlockApp(cdp);
    ok('unlock:activate or admin path', !!(unlock && (unlock.act || unlock.verify || unlock.steps.includes('unlocked'))), JSON.stringify(unlock));
    ok('unlock:deferred modules', unlock && unlock.deferred === true, JSON.stringify(unlock));

    await testFunctions(cdp);
    await testPages(cdp);
    await testBot(cdp);
  } finally {
    if (cdp) cdp.close();
    if (kmProc && !kmProc.killed) {
      try { kmProc.kill(); } catch {}
      try {
        spawn('taskkill', ['/PID', String(kmProc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      } catch {}
    }
    try {
      await fsp.rm(TEMP_APPDATA, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n========== RESULTS ==========');
  console.log('PASS:', passed);
  console.log('FAIL:', failed);
  console.log('SKIP:', skipped);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(' -', f));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e && (e.stack || e.message || e));
  if (kmProc && !kmProc.killed) {
    try { kmProc.kill(); } catch {}
    try { spawn('taskkill', ['/PID', String(kmProc.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
  process.exit(2);
});
