/* Static lab checks for KM project — run with: node scripts/km_lab_audit.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const app = path.join(root, 'app');

const errors = [];
const warnings = [];

function err(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// 1. Required files
const required = [
  'app/index.html', 'app/main.js', 'app/preload.js', 'app/package.json',
  'app/office_backend.js',   'app/km_backend.js', 'app/km_app_users_sync.js', 'app/km_license.js', 'app/km_library.js',
  'app/js/km-formal.js', 'app/js/km-v3-core.js', 'app/js/km-v3-ext.js',
  'app/js/km-v3-tools.js', 'app/js/km-license-ui.js', 'app/js/km-library-ui.js', 'app/js/km-bg-slideshow.js',
  'app/js/km-features.js', 'app/js/km-services.js', 'app/js/km-display-compat.js',
  'app/vendor/jszip.min.js',
  'app/assets/km_logo.jpg', 'app/assets/km_logo_square.jpg', 'app/assets/km_icon.ico',
  'app/assets/military_bg_1.jpg', 'app/assets/military_bg_2.jpg',
  'app/assets/military_bg_3.jpg', 'app/assets/military_bg_4.jpg',
  'app/assets/military_bg_5.jpg', 'app/assets/military_bg_6.jpg',
  'app/assets/military_bg_7.jpg', 'app/assets/military_bg_8.jpg',
  'app/assets/military_bg_9.jpg', 'app/assets/military_bg_10.jpg',
  'app/km_ops_logic.js', 'app/js/km-ops.js', 'app/js/km-extra-tools.js', 'app/js/km-auth-ui.js', 'app/js/km-net-ui.js',
  'app/js/km-extensions.js', 'app/js/km-notes-calendar.js', 'app/js/km-spreadsheet.js',
  'kod.cmd', 'kod3.cmd', 'scripts/kod_apply.cjs', 'scripts/kod_stage.ps1', 'scripts/kod_codes.txt',
  'KM_Setup_x64.nsi', 'BUILD_SETUP.ps1'
];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) err('MISSING FILE: ' + rel);
}

// 2. Script refs in index.html
const html = read('app/index.html');
for (const m of html.matchAll(/src="js\/([^"]+\.js)"/g)) {
  const f = path.join(app, 'js', m[1]);
  if (!fs.existsSync(f)) err('HTML script missing: js/' + m[1]);
}

// 3. IPC channel parity
const preload = read('app/preload.js');
const main = read('app/main.js');
const invoke = [...preload.matchAll(/invoke\('(km:[^']+)'/g)].map(m => m[1]);
const handlers = [...main.matchAll(/ipcMain\.handle\('(km:[^']+)'/g)].map(m => m[1]);
for (const ch of new Set(invoke)) {
  if (!handlers.includes(ch)) err('IPC invoke without handler: ' + ch);
}
for (const ch of handlers) {
  if (!invoke.includes(ch)) warn('IPC handler without preload invoke: ' + ch);
}

// 4. JS syntax (node --check for browser IIFE modules)
import { execSync } from 'child_process';
const jsFiles = [
  'app/main.js', 'app/preload.js', 'app/office_backend.js', 'app/km_backend.js', 'app/km_app_users_sync.js', 'app/km_license.js',
  'app/km_library.js', 'app/km_guard.js', 'app/km_net.js', 'app/km_ops_logic.js', 'app/km_version.js',
  'app/js/km-formal.js', 'app/js/km-v3-core.js', 'app/js/km-v3-ext.js', 'app/js/km-v3-tools.js',
  'app/js/km-license-ui.js', 'app/js/km-features.js', 'app/js/km-services.js', 'app/js/km-display-compat.js',
  'app/js/km-auth-ui.js', 'app/js/km-library-ui.js', 'app/js/km-bg-slideshow.js', 'app/js/km-extensions.js',
  'app/js/km-net-ui.js', 'app/js/km-ops.js', 'app/js/km-notes-calendar.js', 'app/js/km-spreadsheet.js',
  'app/js/km-error-log.js', 'app/js/km-i18n-extra.js', 'app/js/km-extra-tools.js'
];
for (const rel of jsFiles) {
  try {
    execSync(`node --check "${path.join(root, rel)}"`, { stdio: 'pipe' });
  } catch (e) {
    err('JS syntax error ' + rel + ': ' + (e.stderr?.toString() || e.message));
  }
}
// Node-loadable modules only
for (const rel of ['app/office_backend.js', 'app/km_backend.js']) {
  try { require(path.join(root, rel)); } catch (e) {
    if (!/createOfficeBackend/.test(e.message)) err('JS load error ' + rel + ': ' + e.message);
  }
}

// 5. Formal module globals
const formal = read('app/js/km-formal.js');
for (const fn of ['kmFormalDefaults', 'kmFormalData', 'kmFormalTopBlock', 'kmFormalPrintTopBlock', 'kmFormalNativePrintCss']) {
  if (!formal.includes('window.' + fn)) err('km-formal.js missing export: ' + fn);
}

// 6. Security export
if (!read('app/js/km-features.js').includes('window.kmEnsureSecurity')) {
  err('kmEnsureSecurity not exported on window');
}
if (!read('app/js/km-license-ui.js').includes('window.kmEnsureLicense')) {
  err('kmEnsureLicense not exported on window');
}
if (!preload.includes('km:license:status') || !handlers.includes('km:license:status')) {
  err('license IPC channel missing');
}
try {
  const L = require(path.join(root, 'app/km_license.js'));
  if (!L.isValidCodeFormat('AA000000') || L.codeToIndex('AA000000') !== 0) err('license AA000000 index mismatch');
  if (!L.isValidCodeFormat('ALEBC1FF') || L.codeToIndex('ALEBC1FF') !== L.MAX_CODE_INDEX) err('license ALEBC1FF index mismatch');
  if (L.isValidCodeFormat('PP000000')) err('PP000000 should be out of range');
  if (!L.isValidQuarterCodeFormat('AA00-AA00') || L.quarterCodeToIndex('AA00-AA00') !== 0) err('kod3 AA00-AA00 index mismatch');
  if (!L.isValidQuarterCodeFormat('AA00-UU00') || L.quarterCodeToIndex('AA00-UU00') !== 44000) err('kod3 AA00-UU00 index mismatch');
  if (L.isValidQuarterCodeFormat('AA00UU00')) err('kod3 must keep hyphen');
  if (L.isValidQuarterCodeFormat('AA000000')) err('yearly code must not parse as kod3');
  const qAct = L.applyActivationCode({ usedCodes: [] }, 'AA00-AA00');
  if (qAct.lastKind !== 'quarter' || qAct.lastCode !== 'AA00-AA00') err('kod3 apply lastKind');
  const qDays = Math.ceil((new Date(qAct.expiresAt).getTime() - Date.now()) / 86400000);
  if (qDays < 88 || qDays > 94) err('kod3 should expire in ~3 months, got daysLeft ' + qDays);
} catch (e) { err('km_license.js load: ' + e.message); }

// 7. save() snapshot sync
if (!html.includes('kmNative.persistence.writeSnapshot')) {
  err('save() does not write database_snapshot.json');
}

// 8. render tables route
if (html.includes("if(page==='tables')page='schedule'")) {
  err('render() still redirects tables -> schedule');
}

// 9. Tables decrease functions
const ext = read('app/js/km-v3-ext.js');
for (const fn of ['kmTableRemoveCol', 'kmTableRemoveRow', 'kmTableRemoveTable']) {
  if (!ext.includes('window.' + fn)) err('tables missing: ' + fn);
}

// 10. No unexpected remote URLs in index.html (offline app; WhatsApp contact allowed)
{
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>]+/gi)].map(m => m[0]);
  const bad = urls.filter(u => !/^https:\/\/wa\.me\//i.test(u));
  if (bad.length) err('Unexpected HTTP URL in index.html: ' + bad.join(', '));
}

if (!html.includes('id="kmWinChrome"') || !html.includes('kmMinimizeWindow()')) err('window chrome missing');

if (!html.includes('km-sysinfo-ui.js')) err('sysinfo script not wired');
if (!main.includes("km:sysinfo:usbHistory")) err('sysinfo IPC incomplete');
if (!html.includes('km_ops_logic.js') || !html.includes('js/km-ops.js')) err('ops scripts not wired');
if (!main.includes("km:app:minimize") || !preload.includes("km:app:minimize")) err('minimize IPC incomplete');
const ver = JSON.parse(read('app/km_version.json'));
if (ver.version !== '001.0.00') err('product version must stay 001.0.00');
if (ver.update !== '006.2.71') err('update version expected 006.2.71, got ' + ver.update);
if (!main.includes("setImmediate(()=>requestAppQuit('ui-close'))")) err('quit IPC must return before destroying the window');
if (!main.includes("requestAppQuit('window-close')")) err('window close must quit the process');
if (!main.includes('destroyAllWindows')) err('quit must destroy all BrowserWindows');
if (!main.includes('killKmHelperProcesses')) err('quit must stop KM Office helper processes');
if (/\.unref\(\)/.test(main) && /app\.exit\(0\)/.test(main) && main.includes('3000).unref()')) err('forced exit timer must not be unref');
if (!read('app/office_backend.js').includes('killKmOfficeHelpers')) err('office helper killer missing');
if (!read('app/office_backend.js').includes('DisableConvertPdfWarning')) err('PDF conversion must silence Word prompt');
if (!read('app/office_backend.js').includes('ExportAsFixedFormat')) err('converters must use Word/Excel PDF export');
if (!read('app/office_backend.js').includes("'-STA'")) err('Office COM must run in STA');
if (!read('app/office_backend.js').includes('function toBuffer')) err('converter byte decoder missing');
{
  const office = read('app/office_backend.js');
  const libUi = read('app/js/km-library-ui.js');
  for (const kind of ['word-to-pdf','pdf-to-word','word-to-excel','excel-to-word','excel-to-pdf','pdf-to-excel','ppt-to-pdf','pdf-to-ppt','image-to-pdf']) {
    if (!office.includes("'" + kind + "'")) err('office_backend missing converter ' + kind);
  }
  for (const kind of ['word-to-pdf','pdf-to-word','word-to-excel','excel-to-word','excel-to-pdf','pdf-to-excel','ppt-to-pdf','pdf-to-ppt']) {
    if (!html.includes("runConvert('" + kind + "'")) err('index.html missing converter UI ' + kind);
  }
  for (const id of ['convWordPdf','convPdfWord','convWordExcel','convExcelWord','convExcelPdf','convPdfExcel','convPptPdf','convPdfPpt','convImagePdf','convPdfMerge','convPdfSplit','convFolderKind']) {
    if (!libUi.includes('id="' + id + '"')) err('library convert box missing ' + id);
  }
  if (office.includes('function restoreImages') || office.includes('KmImageRestore')) err('image restore backend must be removed');
  if (html.includes('convertRestoreImages') || libUi.includes('convImageRestore')) err('image restore UI must be removed');
  if (main.includes('kmrestore') || preload.includes('km:convert:restoreImages')) err('image restore IPC must be removed');
  if (html.includes('ավտոնորոգում') || html.includes('Ավտոնորոգում')) err('about/UI must not mention auto restore');
  if (read('app/km_backend.js').includes('KM_USB_ImageRestore_')) err('USB ImageRestore pack must be removed');
  if (!office.includes('AutomationSecurity=3')) err('Office COM must set AutomationSecurity');
  if (!office.includes('exportDutyOrderWord')) err('duty order Word export missing');
  if (!office.includes("==='flat'")) err('duty order month flat layout missing');
  if (!office.includes('sections')) err('duty order week sections missing');
  if (!read('app/js/km-extra-tools.js').includes('kmOpenDocsPack')) err('docs pack UI missing');
  if (!read('app/js/km-extra-tools.js').includes('kmExportWeekOrderWord')) err('week order pack missing');
  if (!read('app/js/km-extra-tools.js').includes('kmExportMonthOrderWord')) err('month order pack missing');
  if (!office.includes('asPdf')) err('duty order PDF flag missing');
  if (!read('app/km_backend.js').includes('exportUsbTransfer')) err('USB transfer export missing');
  if (!read('app/km_backend.js').includes('includeLibrary')) err('USB library pack missing');
  if (!read('app/js/km-extra-tools.js').includes('kmOpenDutyKiosk')) err('duty kiosk missing');
  if (!read('app/js/km-extra-tools.js').includes('setInterval(paint, 60000)')) err('kiosk auto-refresh missing');
  if (!read('app/js/km-extra-tools.js').includes('kmRenderDayGlance')) err('yesterday/today/tomorrow glance missing');
  if (!read('app/js/km-ops.js').includes('kmDoUnifiedCover')) err('multi-day cover substitution missing');
  if (!read('app/js/km-bg-slideshow.js').includes('function warmNext')) err('slideshow must warm only the next photo');
  if (read('app/js/km-bg-slideshow.js').includes('paths.forEach')) err('slideshow must not preload all photos');
  if (!html.includes('Թեթև մեկնարկ')) err('about must mention light startup');
  if (!libUi.includes("label: 'Օրենքներ'")) err('library laws section missing');
  for (const sid of ['constitution', 'laws', 'statutes', 'orders', 'directives', 'internal']) {
    if (!libUi.includes("id: '" + sid + "'")) err('library laws subsection missing ' + sid);
  }
  if (!read('app/km_library.js').includes('LAW_SECTIONS')) err('library backend LAW_SECTIONS missing');
  if (!main.includes("km:library:lawsStats") || !preload.includes("km:library:lawsStats")) err('laws stats IPC missing');
  if (!main.includes("km:library:lawsList") || !preload.includes("km:library:lawsList")) err('laws list IPC missing');
  if (!main.includes("store:'laws'") && !main.includes("store==='laws'")) err('library open must support laws store');
  if (!libUi.includes('kmLawsSetSection') || !libUi.includes('kmLawsOpen')) err('library laws UI handlers missing');
  if (!html.includes('Գրադարան → Օրենքներ')) err('about must mention library laws');
}
if (!read('app/js/km-license-ui.js').includes('Արտոնագիր՝')) err('license page must use Արտոնագիր');
if (!read('app/js/km-license-ui.js').includes('200000 ՀՀ դրամ (5 տարի + սպասարկում և թարմացում)')) err('license page missing 5-year price');
if (!read('app/index.html').includes("license:'Արտոնագիր'")) err('nav title must be Արտոնագիր');
if (!read('BUILD_SETUP.ps1').includes('/INPUTCHARSET UTF8')) err('x64 Setup build must compile NSI as UTF-8');
if (!read('BUILD_SETUP_X86.ps1').includes('/INPUTCHARSET UTF8')) err('x86 Setup build must compile NSI as UTF-8');
for (const nsi of ['KM_Setup_x64.nsi', 'KM_Setup_x86.nsi']) {
  const buf = fs.readFileSync(path.join(root, nsi));
  if (buf[0] !== 0xEF || buf[1] !== 0xBB || buf[2] !== 0xBF) err(nsi + ' must be UTF-8 with BOM');
  const text = buf.toString('utf8');
  if (!text.includes('Unicode true')) err(nsi + ' must be Unicode');
  if (!text.includes('MUI_WELCOMEPAGE_TITLE') || !text.includes('տեղադրում')) err(nsi + ' welcome title must stay Armenian');
}
if (!read('KM_Setup_x64.nsi').includes('km-extra-tools.js')) err('Setup x64 must pack km-extra-tools.js');
if (!read('KM_Setup_x86.nsi').includes('km-extra-tools.js')) err('Setup x86 must pack km-extra-tools.js');
if (!read('KM_Setup_x64.nsi').includes('km_setup_require_activation')) err('Setup must require one-time activation code');
if (read('KM_Setup_x64.nsi').includes('Delete "$LOCALAPPDATA\\KM\\UserData\\km_app_users.json"')) err('Setup must not wipe registered users');
if (!read('KM_Setup_x86.nsi').includes('km_setup_require_activation')) err('x86 Setup must require one-time activation code');
if (!read('scripts/kod_stage.ps1').includes('km_setup_require_activation')) err('kod_stage must clear setup activation gate');
if (!read('app/km_backend.js').includes('applySetupActivationGate')) err('backend missing setup activation gate');
if (!read('app/js/km-auth-ui.js').includes('needsActivation')) err('login must require code after setup');
if (read('app/js/km-auth-ui.js').includes('needCode.needsActivation')) err('admin login must not redirect to user activation');
if (read('app/js/km-auth-ui.js').includes('kmLoginTabViewer') || read('app/js/km-auth-ui.js').includes('Մուտք (Դիտորդ)')) err('viewer login tab must stay removed');
if (!read('app/km_ops_logic.js').includes('personContractEnded')) err('expired contract helper missing');
if (!read('app/js/km-v3-core.js').includes('kmUndoCaptureBaseline')) err('silent-save undo baseline missing');
if (!read('app/js/km-notes-calendar.js').includes('Բաց թողնված նշումներ')) err('missed note banner missing');
if (!read('app/js/km-extensions.js').includes('kmMapRegistrationKind')) err('registrations must affect planning');
if (!read('app/js/km-features.js').includes('kmExportAudit')) err('audit export missing');
if (!read('app/main.js').includes("scheme:'kmphoto'")) err('kmphoto protocol missing');
if (!read('app/js/km-ops.js').includes('kmApplyDbSnapshot')) err('snapshot assign helper missing');
if (!read('app/js/km-v3-ext.js').includes('Ավտոպահուստ (ժամ)')) err('settings labels must be Armenian');
if (!read('app/index.html').includes('UserData պահուստ')) err('home backup label must be Armenian');
if (!read('app/index.html').includes('kmPrintCommentsBlock')) err('print cell comments missing');
if (!read('app/preload.js').includes('km:photo:save')) err('photo save IPC missing');
if (!read('app/km_backend.js').includes('KM_USB_Photos_')) err('USB photos pack missing');
if (read('app/js/km-v3-ext.js').includes("textContent='Import CSV'")) err('English Import CSV button must be removed');
if (read('app/index.html').includes('Օգտատեր և Դիտորդ') || read('app/js/km-auth-ui.js').includes('կամ Դիտորդ')) err('login must not mention viewer');
if (!read('app/index.html').includes('Administrator և Օգտատեր')) err('about must mention Administrator and User login');
if (!read('app/js/km-v3-core.js').includes('td[data-s]') || !read('app/js/km-v3-core.js').includes('pointer-events:none')) err('viewer graph cells must ignore clicks');
if (read('app/js/km-v3-core.js').includes('kmSyncImport')) err('viewer whitelist must not include kmSyncImport');
if (!read('app/index.html').includes('function restore()') || !read('app/index.html').includes('kmApplyDbSnapshot')) err('JSON restore must apply snapshot in place');
if (!read('app/js/km-features.js').includes('UserData պահուստներ')) err('backup manager labels must be Armenian');
if (!read('app/js/km-auth-ui.js').includes('<span>Օգտանուն</span>')) err('login username label must be Armenian');
if (!read('app/js/km-v3-core.js').includes("if(window.kmCanEdit()&&typeof save==='function')save()")) err('viewer Ctrl+S must not save');
{
  const extra = read('app/js/km-i18n-extra.js');
  for (const k of ['Հրամաններ և փաստաթղթերի փաթեթ', 'Քաշեք ֆայլը այստեղ', 'Administrator մուտք՝ օգտանուն և գաղտնաբառ', 'Ամիսների համեմատություն, հայկական տոներ']) {
    if (!extra.includes(k)) err('i18n extra missing ' + k);
  }
  if (!html.includes('characterData:true')) err('i18n observer must watch characterData');
  if (!html.includes("attributeFilter:['placeholder','title','aria-label']")) err('i18n observer must watch UI attributes');
  if (!html.includes('k.length<20')) err('i18n must not mix short titles inside longer copy');
}
{
  const netUi = read('app/js/km-net-ui.js');
  const netJs = read('app/km_net.js');
  const core = read('app/js/km-v3-core.js');
  if (!netUi.includes('Թարմացումը տեղադրել')) err('network page must show install-update section');
  if (!netUi.includes('kmCanAdmin') || !netUi.includes('adminToken')) err('update install UI must require administrator');
  if (netUi.includes("st.updateServer ? '' : '<button type=\"button\" onclick=\"kmNetPullUpdate()\">Ստանալ և տեղադրել")) err('install update must not hide when this PC is an origin server');
  if (core.includes('kmNetPullUpdate')) err('viewer whitelist must not include kmNetPullUpdate');
  if (!netUi.includes('kmNetUserCheckAndApply')) err('user update check must download and apply automatically');
  if (!netUi.includes("tabBtn('xfer', 'Փոխանցել և ստանալ')")) err('user network tabs must include transfer');
  if (!netUi.includes('renderXfer(data.st, data.inbox) + (admin ? \'\' : renderAuto(data.st))') && !netUi.includes("admin ? '' : renderAuto(data.st)")) err('user transfer tab must include auto-search');
  if (netJs.includes('Այս համակարգիչը թարմացումների սերվեր է։ Ստանալ պետք չէ')) err('origin server must still be allowed to install an update');
  if (!html.includes('kmUserMenuBlock') || !html.includes('kmUserNavTitle')) err('user sidebar group missing');
  if (!html.includes('Օգտատիրոջ մենյուում «Օգտատեր» բաժինը պարունակում է Ցանց և ֆայլեր և Արտոնագիր')) err('about must mention User menu group');
  if (!core.includes("classList.toggle('km-role-user'")) err('role guard must mark user body class');
}
{
  const backend = read('app/km_backend.js');
  if (!backend.includes('cfg.mustChangePassword!==false')) err('password-change prompt must honor a completed first change');
  if (!backend.includes('Գործարանային գաղտնաբառը չի կարող մնալ')) err('factory admin password must be rejected as the new password');
}
{
  const licUi = read('app/js/km-license-ui.js');
  const authUi = read('app/js/km-auth-ui.js');
  if (!licUi.includes('Սպառված է')) err('admin license must show ended column');
  if (!licUi.includes('Այս համակարգիչը')) err('admin license must show this computer');
  if (!html.includes('id="KM-about-admin"')) err('admin about page must have a separate structure');
  if (!authUi.includes('Administrator ելք համակարգից')) err('admin logout must skip license-reset warning');
  if (!read('app/main.js').includes('km:license:adminOverview')) err('admin license overview IPC missing');
  if (!read('app/preload.js').includes('adminOverview')) err('admin license overview preload missing');
  if (read('app/js/km-v3-core.js').includes('adminOverview')) err('viewer whitelist must not include license adminOverview');
}

console.log('KM LAB AUDIT');
console.log('Errors:', errors.length);
errors.forEach(e => console.log('  ERROR:', e));
console.log('Warnings:', warnings.length);
warnings.forEach(w => console.log('  WARN:', w));
process.exit(errors.length ? 1 : 0);
