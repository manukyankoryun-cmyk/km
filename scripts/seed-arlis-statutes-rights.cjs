/* Dedupe statutes + soldier rights, fetch official arlis Word/PDF/HTML, lock further downloads. */
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const {
  createLibraryBackend, LAW_SECTIONS, STATUTE_SECTION_IDS, RIGHTS_SECTION_IDS
} = require('../app/km_library.js');

const userRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'KM', 'UserData');

const ARLIS_ACTS = [
  { id: 'statute_internal', actId: '225574' },
  { id: 'statute_garrison', actId: '112468' },
  { id: 'statute_discipline', actId: '200323' },
  { id: 'rights_service_status', actId: '225571' },
  { id: 'rights_military_service_law', actId: '117693' }
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

async function ensurePdf(lib, browser, section, title) {
  const names = await namesOf(lib, section);
  if (names.some((n) => /\.pdf$/.test(n))) return false;
  const htmlAbs = await htmlAbsOf(lib, section);
  if (!htmlAbs || !fs.existsSync(htmlAbs)) throw new Error('no html for pdf: ' + section);
  const tmpPdf = path.join(os.tmpdir(), 'km_arlis_' + section + '.pdf');
  console.log('  print html→pdf ' + section);
  htmlToPdf(browser, htmlAbs, tmpPdf);
  const pdfBuf = await fsp.readFile(tmpPdf);
  try { fs.unlinkSync(tmpPdf); } catch (_) {}
  await lib.addLawsFile(section, title + '.pdf', pdfBuf, { displayName: title + '.pdf' });
  console.log('  pdf added size=' + pdfBuf.length);
  return true;
}

async function main() {
  if (!fs.existsSync(userRoot)) throw new Error('UserData missing: ' + userRoot);
  const lib = createLibraryBackend(userRoot);
  await lib.ensureDirs();
  const browser = findBrowser();
  console.log('browser=' + (browser || 'NONE'));

  console.log('fill local guides…');
  const g = await lib.ensureSoldierRightsGuides({ allowFill: true });
  console.log('guides seeded=' + (g && g.seeded) + ' skipped=' + (g && g.skipped));

  console.log('dedupe…');
  const d1 = await lib.dedupeLawHubSections();
  console.log('dedupe removed=' + (d1 && d1.removed));

  for (const card of ARLIS_ACTS) {
    const title = LAW_SECTIONS[card.id] || card.id;
    console.log('ensure ' + card.id + ' act=' + card.actId);
    const r = await lib.ensureArlisLaw(card.id, {
      actId: card.actId,
      title: title,
      allowNetwork: true
    });
    console.log('  skipped=' + (r && r.skipped) + ' downloaded=' + !!(r && r.downloaded) + ' needPdf=' + !!(r && r.needPdf));
    await ensurePdf(lib, browser, card.id, title);
  }

  const extra = STATUTE_SECTION_IDS.concat(RIGHTS_SECTION_IDS);
  for (const section of extra) {
    const names = await namesOf(lib, section);
    const hasHtml = names.some((n) => /\.html?$/.test(n));
    const hasPdf = names.some((n) => /\.pdf$/.test(n));
    if (hasHtml && !hasPdf) {
      await ensurePdf(lib, browser, section, LAW_SECTIONS[section] || section);
    }
  }

  const leave = await lib.listLaws('rights_leave', { offset: 0, limit: 400, q: '' });
  for (const e of (leave.items || [])) {
    const n = String(e.name || e.displayName || '');
    if (/ԾԱՌԱՅՈՒԹՅՈՒՆ ԱՆՑՆԵԼՈՒ|military.?service/i.test(n) && /\.pdf$/i.test(n)) {
      try {
        await lib.removeLawsFile(e.id, 'rights_leave', { explicitUserDelete: true, callerIsSuper: true });
        console.log('removed duplicate law pdf from rights_leave');
      } catch (err) {
        console.log('leave pdf skip ' + (err && err.message));
      }
    }
  }
  await ensurePdf(lib, browser, 'rights_leave', LAW_SECTIONS.rights_leave || 'rights_leave');

  const d2 = await lib.dedupeLawHubSections();
  console.log('dedupe after seed removed=' + (d2 && d2.removed));
  const lock = await lib.writeArlisOfflineLock({
    sections: ARLIS_ACTS.map((c) => c.id).concat(STATUTE_SECTION_IDS, RIGHTS_SECTION_IDS)
  });
  console.log('lock=' + JSON.stringify(lock));

  const show = STATUTE_SECTION_IDS.concat(RIGHTS_SECTION_IDS);
  for (const id of show) {
    const listed = await lib.listLaws(id, { offset: 0, limit: 50, q: '' });
    const items = listed.items || [];
    console.log(id + ' count=' + items.length + ' types=' + items.map((e) => path.extname(String(e.name || '')).toLowerCase()).join(','));
  }
}

main().catch((e) => {
  console.error(e && e.stack || e);
  process.exit(1);
});
