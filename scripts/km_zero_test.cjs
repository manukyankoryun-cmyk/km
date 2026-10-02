/* Zero-from-scratch integration test — license, security, library */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { createKmBackend } = require('../app/km_backend.js');
const { createLibraryBackend } = require('../app/km_library.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'km-zero-'));
let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name, detail || ''); }
}

async function run() {
  console.log('KM ZERO TEST (from scratch)');
  console.log('Temp root:', tmpRoot);
  console.log('');

  const backend = createKmBackend(tmpRoot);
  const library = createLibraryBackend(tmpRoot);

  // --- Fresh install state ---
  console.log('[A] Fresh install — no license, no security');
  ok('no license file', !fs.existsSync(path.join(tmpRoot, 'km_license.json')));
  ok('no security file', !fs.existsSync(path.join(tmpRoot, 'km_security.json')));

  let st = await backend.getLicenseStatus();
  ok('needs activation', st.needsActivation && !st.valid);

  await backend.ensureDefaultSecurity();
  const admin = await backend.verifySecurity('Koryun1992', '098460813');
  ok('default admin created', admin.ok && admin.isAdmin);
  const sec = await backend.getSecurity();
  ok('must change default password', sec.mustChangePassword === true);

  console.log('[B] First activation');
  const act = await backend.activateLicense('AA000000');
  ok('license active', act.valid && act.daysLeft >= 364);

  console.log('[C] Library empty');
  const stats0 = await library.getStats();
  ok('library empty', stats0.total === 0);
  ok('max 6000000', stats0.maxFiles === 6000000);

  console.log('[D] Library type separation');
  const pdfBytes = Buffer.from('%PDF-1.4 test');
  const docBytes = Buffer.from('PK fake docx');
  const xlsBytes = Buffer.from('PK fake xlsx');
  const pptBytes = Buffer.from('PK fake pptx');

  await library.addFile('test.pdf', pdfBytes);
  await library.addFile('report.docx', docBytes);
  await library.addFile('data.xlsx', xlsBytes);
  await library.addFile('slides.pptx', pptBytes);

  const stats1 = await library.getStats();
  ok('4 files added', stats1.total === 4);
  ok('pdf count', stats1.counts.pdf === 1);
  ok('word count', stats1.counts.word === 1);
  ok('excel count', stats1.counts.excel === 1);
  ok('ppt count', stats1.counts.ppt === 1);

  const pdfList = await library.list('pdf', { offset: 0, limit: 10 });
  ok('pdf list has 1', pdfList.items.length === 1);
  ok('word list empty of pdf', (await library.list('word', { offset: 0, limit: 10 })).items.every(x => x.type === 'word'));

  console.log('[E] Invalid file type rejected');
  let badType = '';
  try { await library.addFile('image.png', Buffer.from('PNG')); } catch (e) { badType = e.message; }
  ok('png rejected', /Word|Excel|PDF|PowerPoint|Աջակ/i.test(badType));

  console.log('[F] File delete');
  const id = pdfList.items[0].id;
  await library.removeFile(id, 'pdf');
  const stats2 = await library.getStats();
  ok('after delete total 3', stats2.total === 3);
  ok('pdf count 0', stats2.counts.pdf === 0);

  console.log('[G] Library folders exist');
  for (const t of ['word', 'excel', 'pdf', 'ppt']) {
    ok('folder ' + t, fs.existsSync(path.join(tmpRoot, 'Library', t)));
  }

  console.log('[H] Required app files');
  const root = path.resolve(__dirname, '..');
  for (const rel of [
    'app/km_library.js', 'app/js/km-library-ui.js', 'app/js/km-v3-ext.js',
    'app/km_license.js', 'app/js/km-license-ui.js', 'kod.cmd',
    'app/km_ops_logic.js', 'app/js/km-ops.js'
  ]) {
    ok(rel, fs.existsSync(path.join(root, rel)));
  }

  console.log('[I] index.html wiring');
  const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
  ok('library script', html.includes('km-library-ui.js'));
  ok('sidebar library nav', html.includes('data-page="library"'));
  ok('sidebar management nav', html.includes('data-page="management"'));
  ok('ops logic script', html.includes('km_ops_logic.js'));
  ok('ops ui script', html.includes('js/km-ops.js'));
  ok('window chrome', html.includes('id="kmWinChrome"') && html.includes('kmMinimizeWindow()') && html.includes('kmCloseWindow()'));
  const mainJs = fs.readFileSync(path.join(root, 'app/main.js'), 'utf8');
  const preloadJs = fs.readFileSync(path.join(root, 'app/preload.js'), 'utf8');
  ok('minimize ipc', mainJs.includes("km:app:minimize"));
  ok('minimize preload', preloadJs.includes('km:app:minimize'));

  console.log('');
  console.log('Results:', passed, 'passed,', failed, 'failed');
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(2); });
