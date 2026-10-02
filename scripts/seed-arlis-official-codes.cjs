/* Fetch official arlis.am HTML for six codes, make Word+PDF, dedupe constitution hub, lock further arlis downloads. */
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const https = require('https');
const { spawnSync } = require('child_process');
const { createLibraryBackend, LAW_SECTIONS } = require('../app/km_library.js');

const userRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'KM', 'UserData');
const SIX = [
  { id: 'eaeu', actId: '159647' },
  { id: 'judicial', actId: '119531' },
  { id: 'civil_proc', actId: '120057' },
  { id: 'criminal', actId: '153080' },
  { id: 'crim_proc', actId: '154763' },
  { id: 'penitentiary', actId: '164938' }
];

function findBrowser() {
  const cands = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  return cands.find((p) => p && fs.existsSync(p)) || '';
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'KM-Desktop', Accept: '*/*' },
      timeout: 180000
    }, (res) => {
      const loc = res.headers && res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
        res.resume();
        httpsGet(/^https?:/i.test(loc) ? loc : new URL(loc, url).href).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode || 0,
        ctype: String((res.headers && res.headers['content-type']) || ''),
        buf: Buffer.concat(chunks)
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout ' + url)); });
  });
}

function htmlToPdf(browser, htmlAbs, pdfAbs) {
  if (!browser) throw new Error('Edge/Chrome not found');
  if (fs.existsSync(pdfAbs)) try { fs.unlinkSync(pdfAbs); } catch (_) {}
  const fileUrl = 'file:///' + String(htmlAbs).replace(/\\/g, '/');
  const r = spawnSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-pdf-header-footer',
    '--print-to-pdf=' + pdfAbs,
    fileUrl
  ], { timeout: 300000, windowsHide: true, encoding: 'utf8' });
  if (r.error) throw r.error;
  if (!fs.existsSync(pdfAbs) || fs.statSync(pdfAbs).size < 80) {
    throw new Error('PDF empty status=' + r.status + ' ' + String(r.stderr || '').slice(0, 200));
  }
}

async function namesOf(lib, section) {
  const listed = await lib.listLaws(section, { offset: 0, limit: 400, q: '' });
  return (listed.items || []).map((e) => String(e.name || '').toLowerCase());
}

async function htmlAbsOf(lib, section) {
  const listed = await lib.listLaws(section, { offset: 0, limit: 400, q: '' });
  const htmlItem = (listed.items || []).find((e) => /\.html?$/i.test(String(e.name || '')));
  if (!htmlItem) return '';
  const row = await lib.getLawsEntry(htmlItem.id, section);
  if (!row || !row.rel) return '';
  return path.join(userRoot, 'Library', row.rel);
}

async function tryOfficialPdf(actId) {
  const urls = [
    'https://www.arlis.am/hy/acts/' + actId + '/pdf',
    'https://www.arlis.am/hy/acts/' + encodeURIComponent(actId) + '/download',
    'https://www.arlis.am/DocumentView.aspx?DocID=' + actId
  ];
  for (const url of urls) {
    try {
      const r = await httpsGet(url);
      const looksPdf = r.ctype.indexOf('pdf') >= 0 || (r.buf && r.buf.slice(0, 5).toString() === '%PDF-');
      if (looksPdf && r.buf && r.buf.length > 200) {
        console.log('  official pdf from ' + url + ' bytes=' + r.buf.length);
        return r.buf;
      }
    } catch (e) {
      console.log('  pdf url skip ' + url + ' ' + (e && e.message || e));
    }
  }
  return null;
}

async function main() {
  if (!fs.existsSync(userRoot)) throw new Error('UserData missing: ' + userRoot);
  const lib = createLibraryBackend(userRoot);
  await lib.ensureDirs();
  const browser = findBrowser();
  console.log('browser=' + (browser || 'NONE'));

  console.log('dedupe hub…');
  const d1 = await lib.dedupeLawHubSections();
  console.log('dedupe removed=' + (d1 && d1.removed));

  for (const card of SIX) {
    const title = LAW_SECTIONS[card.id] || card.id;
    console.log('ensure ' + card.id + ' act=' + card.actId);
    const r = await lib.ensureArlisLaw(card.id, {
      actId: card.actId,
      title: title,
      allowNetwork: true
    });
    console.log('  html/doc skipped=' + (r && r.skipped) + ' downloaded=' + !!(r && r.downloaded) + ' needPdf=' + !!(r && r.needPdf));
    const names = await namesOf(lib, card.id);
    const hasPdf = names.some((n) => /\.pdf$/.test(n));
    if (hasPdf) {
      console.log('  pdf already present');
      continue;
    }
    let pdfBuf = await tryOfficialPdf(card.actId);
    if (!pdfBuf) {
      const htmlAbs = r && r.htmlAbs || await htmlAbsOf(lib, card.id);
      if (!htmlAbs || !fs.existsSync(htmlAbs)) throw new Error('no html for pdf: ' + card.id);
      const tmpPdf = path.join(os.tmpdir(), 'km_arlis_' + card.id + '.pdf');
      console.log('  print html→pdf ' + htmlAbs);
      htmlToPdf(browser, htmlAbs, tmpPdf);
      pdfBuf = await fsp.readFile(tmpPdf);
      try { fs.unlinkSync(tmpPdf); } catch (_) {}
    }
    const added = await lib.addLawsFile(card.id, title + '.pdf', pdfBuf, { displayName: title + '.pdf' });
    console.log('  pdf added skipped=' + !!(added && added.skipped) + ' size=' + pdfBuf.length);
  }

  const d2 = await lib.dedupeLawHubSections();
  console.log('dedupe after seed removed=' + (d2 && d2.removed));
  const lock = await lib.writeArlisOfflineLock({
    sections: SIX.map((c) => c.id)
  });
  console.log('lock=' + JSON.stringify(lock));

  for (const id of ['constitution', 'eaeu', 'judicial', 'civil_proc', 'criminal', 'crim_proc', 'penitentiary', 'admin_proc', 'civil', 'labor']) {
    const listed = await lib.listLaws(id, { offset: 0, limit: 50, q: '' });
    const items = listed.items || [];
    console.log(id + ' count=' + items.length + ' types=' + items.map((e) => path.extname(String(e.name || '')).toLowerCase()).join(','));
  }
}

main().catch((e) => {
  console.error(e && e.stack || e);
  process.exit(1);
});
