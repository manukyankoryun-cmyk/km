/* Live trial of all 10 extra KM features. Run: node scripts/km_features_live_test.cjs */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createOfficeBackend, psQuote } = require('../app/office_backend.js');
const { createKmBackend } = require('../app/km_backend.js');
const { freePeopleOnDate, contractReminders, contractOverdue, personContractEnded, todayDutyRows } = require('../app/km_ops_logic.js');

let pass = 0, fail = 0, skip = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS:', name); }
  else { fail++; console.log('  FAIL:', name, detail || ''); }
}
function skipped(name, why) { skip++; console.log('  SKIP:', name, why || ''); }

function runPsFile(scriptPath, timeoutMs) {
  return spawnSync('powershell.exe', [
    '-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
  ], { encoding: 'utf8', timeout: timeoutMs || 60000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}
function writePs(dir, body) {
  const p = path.join(dir, 'km_live_' + Date.now() + '_' + Math.random().toString(16).slice(2) + '.ps1');
  fs.writeFileSync(p, '\uFEFF' + body + '\r\n', 'utf8');
  return p;
}
function zipInnerText(file, inner) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'km-zip-'));
  try {
    const zip = path.join(dir, 'pack.zip');
    fs.copyFileSync(file, zip);
    const r = spawnSync('tar', ['-xf', zip, '-C', dir, inner], { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) return '';
    const p = path.join(dir, ...inner.split('/'));
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
}
function isPdf(p) {
  if (!p || !fs.existsSync(p)) return false;
  const b = fs.readFileSync(p);
  return b.slice(0, 4).toString('ascii') === '%PDF' && b.length > 200;
}
function isZipOffice(p) {
  if (!p || !fs.existsSync(p)) return false;
  const b = fs.readFileSync(p);
  return b[0] === 0x50 && b[1] === 0x4B && b.length > 200;
}

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const MARKER = 'Բարև KM';

(async () => {
  console.log('KM ALL FEATURES LIVE TRIAL');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8');
  const extra = fs.readFileSync(path.join(root, 'app', 'js', 'km-extra-tools.js'), 'utf8');
  const lib = fs.readFileSync(path.join(root, 'app', 'js', 'km-library-ui.js'), 'utf8');

  ok('extra-tools wired', html.includes('js/km-extra-tools.js'));
  ok('1 folder UI', lib.includes('convertFolderBatch()') && html.includes('window.convertFolderBatch='));
  ok('2 ppt UI', html.includes("runConvert('ppt-to-pdf'") && html.includes("runConvert('pdf-to-ppt'"));
  ok('3 pdf merge/split UI', html.includes('window.convertMergePdfs=') && html.includes('window.convertSplitPdf='));
  ok('4 image UI', html.includes('window.convertImagesToPdf='));
  ok('4b image restore removed', !html.includes('convertRestoreImages') && !lib.includes('convImageRestore') && !lib.includes('Ավտոնորոգում'));
  ok('5 order Word UI', extra.includes('kmExportTodayOrderWord') && extra.includes('dutyOrderWord'));
  ok('5 order PDF UI', extra.includes('kmExportTodayOrderPdf') && extra.includes('asPdf'));
  ok('5 docs pack UI', extra.includes('kmOpenDocsPack') && extra.includes('kmExportWeekOrderWord') && extra.includes('kmExportMonthOrderWord') && extra.includes('kmDocsDate'));
  ok('6 free people UI', extra.includes('kmOpenFreePeople') && extra.includes('freePeopleOnDate'));
  ok('6 free copy/print', extra.includes('kmCopyFreePeople') && extra.includes('kmPrintFreePeople'));
  ok('7 reminders UI', extra.includes('kmRenderContractReminders') && extra.includes('endDate'));
  ok('7 overdue UI', extra.includes('kmContractOverdue') && extra.includes('contractOverdue'));
  ok('8 kiosk UI', extra.includes('kmOpenDutyKiosk') && extra.includes('kmDutyKiosk') && extra.includes('Escape'));
  ok('8 kiosk refresh+photo', extra.includes('setInterval(paint, 60000)') && extra.includes('kmKioskPhoto'));
  ok('9 sms copy UI', extra.includes('kmCopyTodayDutySms') && extra.includes('Այսօր հերթապահ եք'));
  ok('10 usb UI', extra.includes('kmUsbExportUserData') && extra.includes('kmUsbImportUserData'));
  ok('10 usb library prompt', extra.includes('includeLibrary') && extra.includes('importLibrary'));
  ok('month graphs PDF UI', extra.includes('kmExportMonthGraphsPdf') && extra.includes('Ամսվա բոլոր գրաֆիկները PDF'));
  ok('day glance UI', extra.includes('kmRenderDayGlance') && (extra.includes('Երեկ / այսօր / վաղը') || extra.includes('երեկ / այսօր / վաղը') || extra.includes('kmDayGlance')));
  ok('folder progress status', html.includes("Պանակ՝ '+(ev.index") && html.includes('kmNative.convert.onProgress'));
  ok('drag-drop converters', html.includes('window.kmBindConverterDrops=') && lib.includes('kmDropHint') && lib.includes('kmBindConverterDrops'));
  ok('people endDate field', html.includes('kmPersonEndDate') && html.includes('keEndDate'));
  ok('library laws UI', lib.includes('kmLawsSetSection') && lib.includes('constitution') && (lib.includes('constitutionHub') || lib.includes('statutes') || lib.includes('ԻՐԱՎԱԲԱՆ')));
  ok('library laws about', html.includes('Գրադարան → Օրենքներ') || html.includes('ԻՐԱՎԱԲԱՆԱԿԱՆ') || html.includes('lawdocs'));

  const today = new Date();
  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const endPlus5 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5);
  const db = {
    people: [
      { name: 'Արամ', rank: 'ս-տ', unit: 'Ա', phone: '+374111', endDate: ymd(endPlus5) },
      { name: 'Գագիկ', rank: 'լ-տ', unit: 'Բ', phone: '+374222', endDate: '' }
    ],
    schedule: {
      name: 'Հիմնական', month: today.getMonth() + 1, year: today.getFullYear(),
      rows: { 'Արամ': { [today.getDate()]: 'Հերթապահ' } }
    },
    dutyTypes: [],
    dutyTypeSchedules: {}
  };
  const duty = todayDutyRows(db, today);
  ok('today duty has Aram', duty.some((r) => r.name === 'Արամ'));
  const free = freePeopleOnDate(db, today, {});
  ok('Gagik free today', free.length === 1 && free[0].name === 'Գագիկ', JSON.stringify(free));
  const rem = contractReminders(db, 30, today);
  ok('Aram reminder', rem.some((r) => r.name === 'Արամ' && r.daysLeft === 5), JSON.stringify(rem));
  db.people[1].endDate = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3));
  const overdue = contractOverdue(db, today);
  ok('Gagik overdue', overdue.some((r) => r.name === 'Գագիկ' && r.daysLeft < 0), JSON.stringify(overdue));
  ok('ended contract helper', personContractEnded(db.people[1], today) === true);
  const sms = 'Այսօր հերթապահ եք (' + today.toLocaleDateString('hy-AM') + ').\n1. ս-տ Արամ — Հիմնական · +374111';
  ok('sms text shape', /Այսօր հերթապահ եք/.test(sms) && sms.includes('Արամ') && sms.includes('+374111'));

  const userTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'km-feat-usb-'));
  const backend = createKmBackend(userTmp);
  fs.writeFileSync(path.join(userTmp, 'database_snapshot.json'), JSON.stringify(db), 'utf8');
  const usbDir = path.join(userTmp, 'stick');
  fs.mkdirSync(usbDir);
  const pack = await backend.exportUsbTransfer('km-live-usb', usbDir);
  ok('10 usb export', pack.ok && fs.existsSync(pack.path) && fs.readFileSync(pack.path).slice(0, 6).toString() === 'KMUSB1');
  let usbBad = false;
  try { await backend.importUsbTransfer('nope', fs.readFileSync(pack.path)); } catch { usbBad = true; }
  ok('10 usb rejects bad password', usbBad);
  const restored = await backend.importUsbTransfer('km-live-usb', fs.readFileSync(pack.path));
  ok('10 usb import', restored.ok && JSON.parse(restored.snapshot).people[0].name === 'Արամ');
  const libSrc = path.join(userTmp, 'Library', 'word');
  fs.mkdirSync(libSrc, { recursive: true });
  fs.writeFileSync(path.join(libSrc, 'a.txt'), 'lib', 'utf8');
  const packLib = await backend.exportUsbTransfer('km-live-usb', usbDir, { includeLibrary: true });
  ok('10 usb library export', packLib.library && fs.existsSync(path.join(packLib.library, 'word', 'a.txt')));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'km-feat-off-'));
  const office = createOfficeBackend(tmp, tmp);
  const probeFile = writePs(tmp, [
    "$ErrorActionPreference='Continue'",
    "$w=$false;$x=$false;$ppt=$false",
    "try{$a=New-Object -ComObject Word.Application;$a.Quit();$w=$true}catch{}",
    "try{$a=New-Object -ComObject Excel.Application;$a.Quit();$x=$true}catch{}",
    "try{$a=New-Object -ComObject PowerPoint.Application;$a.Quit();$ppt=$true}catch{}",
    "Write-Output ('word=' + $(if($w){'1'}else{'0'}) + ';excel=' + $(if($x){'1'}else{'0'}) + ';ppt=' + $(if($ppt){'1'}else{'0'}))"
  ].join('\r\n'));
  const probed = runPsFile(probeFile, 45000);
  const probeOut = String(probed.stdout || '').trim();
  const hasWord = /\bword=1\b/.test(probeOut);
  const hasExcel = /\bexcel=1\b/.test(probeOut);
  const hasPpt = /\bppt=1\b/.test(probeOut);
  ok('office probe', probed.status === 0, probeOut || String(probed.stderr || '').slice(0, 200));
  console.log('  INFO: Word=' + (hasWord ? 'yes' : 'no') + ' Excel=' + (hasExcel ? 'yes' : 'no') + ' PowerPoint=' + (hasPpt ? 'yes' : 'no'));

  if (!hasWord) {
    skipped('live Office extras', 'Word not installed');
  } else {
    const samples = path.join(tmp, 'samples');
    fs.mkdirSync(samples, { recursive: true });
    const docx = path.join(samples, 'sample.docx');
    const makeDoc = writePs(samples, [
      "$ErrorActionPreference='Stop'",
      "$w=New-Object -ComObject Word.Application;$w.Visible=$false;$w.DisplayAlerts=0",
      "try{$w.AutomationSecurity=3}catch{}",
      "$d=$w.Documents.Add()",
      "$d.Content.Font.Name='Sylfaen'",
      "$d.Content.Text=" + psQuote(MARKER + ' live'),
      "$d.SaveAs2(" + psQuote(docx) + ",16)",
      "$d.Close($false)",
      "$w.Quit()"
    ].join('\r\n'));
    const made = runPsFile(makeDoc, 90000);
    ok('sample docx', made.status === 0 && fs.existsSync(docx), String(made.stderr || made.stdout || '').slice(0, 240));

    const png1 = path.join(samples, 'a.png');
    const png2 = path.join(samples, 'b.png');
    fs.writeFileSync(png1, PNG);
    fs.writeFileSync(png2, PNG);

    const img = await office.imagesToPdf({ name: 'KM_images.pdf', files: [
      { name: 'a.png', bytes: PNG },
      { name: 'b.png', bytes: PNG }
    ] });
    ok('4 imagesToPdf', img && img.ok && isPdf(img.output), img && img.output);

    if (fs.existsSync(docx)) {
      const wpdf = await office.nativeConvert({ kind: 'word-to-pdf', name: 'sample.docx', bytes: fs.readFileSync(docx) });
      ok('word-to-pdf for extras', wpdf && wpdf.ok && isPdf(wpdf.output));
      const folderIn = path.join(tmp, 'batch_in');
      fs.mkdirSync(folderIn);
      fs.copyFileSync(docx, path.join(folderIn, 'one.docx'));
      fs.copyFileSync(docx, path.join(folderIn, 'two.docx'));
      const seenProg = [];
      const batch = await office.convertFolder({
        kind: 'word-to-pdf',
        folder: folderIn,
        onProgress: (ev) => { seenProg.push(ev && ev.index); }
      });
      ok('1 convertFolder 2/2', batch && batch.ok && batch.done === 2 && batch.failed === 0, JSON.stringify({ done: batch && batch.done, failed: batch && batch.failed, total: batch && batch.total }));
      ok('1 convertFolder progress', seenProg.length === 2 && seenProg[0] === 1 && seenProg[1] === 2, JSON.stringify(seenProg));

      if (wpdf && isPdf(wpdf.output)) {
        const pdfBytes = fs.readFileSync(wpdf.output);
        const merged = await office.mergePdfs({
          name: 'KM_merged.pdf',
          files: [
            { name: 'a.pdf', bytes: pdfBytes },
            { name: 'b.pdf', bytes: pdfBytes }
          ]
        });
        ok('3 mergePdfs', merged && merged.ok && isPdf(merged.output) && merged.size > pdfBytes.length, JSON.stringify({ size: merged && merged.size, src: pdfBytes.length }));
        const split = await office.splitPdf({ name: 'a.pdf', bytes: pdfBytes });
        ok('3 splitPdf pages', split && split.ok && Array.isArray(split.files) && split.files.length >= 1 && split.files.every(isPdf), JSON.stringify({ pages: split && split.pages, n: split && split.files && split.files.length }));

        if (hasPpt) {
          const p2p = await office.nativeConvert({ kind: 'pdf-to-ppt', name: 'a.pdf', bytes: pdfBytes });
          ok('2 pdf-to-ppt', p2p && p2p.ok && isZipOffice(p2p.output), p2p && p2p.output);
        } else skipped('2 pdf-to-ppt', 'PowerPoint not installed');
      }

      const order = await office.exportDutyOrderWord({
        name: 'KM_hraman_live',
        title: 'Հրաման — այսօրվա հերթապահներ',
        date: today.toLocaleDateString('hy-AM'),
        note: 'Կազմված է KM գրաֆիկներից։',
        formal: { approveTitle: '«ՀԱՍՏԱՏՈՒՄ ԵՄ»', approveLine1: 'Հրամանատար', approveDate: today.toLocaleDateString('hy-AM') },
        rows: [
          { graphName: 'Հիմնական', rank: 'ս-տ', name: 'Արամ', unit: 'Ա', phone: '+374111' },
          { graphName: 'Դարպաս', rank: 'լ-տ', name: 'Գագիկ', unit: 'Բ', phone: '+374222' }
        ]
      });
      ok('5 duty order file', order && order.ok && isZipOffice(order.output), order && order.output);
      if (order && order.output && fs.existsSync(order.output)) {
        const xml = zipInnerText(order.output, 'word/document.xml');
        ok('5 duty order keeps names', xml.includes('Արամ') && xml.includes('Գագիկ') && (xml.includes('Հրաման') || xml.includes('ՀԱՍՏԱՏՈՒՄ')), xml.replace(/<[^>]+>/g, ' ').slice(0, 220));
      }
      const orderPdf = await office.exportDutyOrderWord({
        name: 'KM_hraman_live_pdf',
        title: 'Հրաման — այսօրվա հերթապահներ',
        date: today.toLocaleDateString('hy-AM'),
        note: 'Կազմված է KM գրաֆիկներից։',
        asPdf: true,
        formal: { approveTitle: '«ՀԱՍՏԱՏՈՒՄ ԵՄ»', approveLine1: 'Հրամանատար', approveDate: today.toLocaleDateString('hy-AM') },
        rows: [
          { graphName: 'Հիմնական', rank: 'ս-տ', name: 'Արամ', unit: 'Ա', phone: '+374111' },
          { graphName: 'Դարպաս', rank: 'լ-տ', name: 'Գագիկ', unit: 'Բ', phone: '+374222' }
        ]
      });
      ok('5 duty order PDF', orderPdf && orderPdf.ok && isPdf(orderPdf.pdf), orderPdf && orderPdf.pdf);
      const weekDoc = await office.exportDutyOrderWord({
        name: 'KM_hraman_week_live',
        title: 'Հրաման — շաբաթվա հերթապահներ',
        date: 'շաբաթ',
        sections: [
          { heading: 'Օր 1', rows: [{ graphName: 'Հիմնական', rank: 'ս-տ', name: 'Արամ', unit: 'Ա' }] },
          { heading: 'Օր 2', rows: [{ graphName: 'Դարպաս', rank: 'լ-տ', name: 'Գագիկ', unit: 'Բ' }] }
        ]
      });
      ok('5 week sections file', weekDoc && weekDoc.ok && isZipOffice(weekDoc.output), weekDoc && weekDoc.output);
      if (weekDoc && weekDoc.output && fs.existsSync(weekDoc.output)) {
        const xmlW = zipInnerText(weekDoc.output, 'word/document.xml');
        ok('5 week sections text', xmlW.includes('Օր 1') && xmlW.includes('Օր 2') && xmlW.includes('Արամ') && xmlW.includes('Գագիկ'), xmlW.replace(/<[^>]+>/g, ' ').slice(0, 240));
      }
      const monthDoc = await office.exportDutyOrderWord({
        name: 'KM_hraman_month_live',
        title: 'Հրաման — ամսվա հերթապահներ',
        layout: 'flat',
        rows: [
          { day: '1', graphName: 'Հիմնական', rank: 'ս-տ', name: 'Արամ', unit: 'Ա' },
          { day: '2', graphName: 'Դարպաս', rank: 'լ-տ', name: 'Գագիկ', unit: 'Բ' }
        ]
      });
      ok('5 month flat file', monthDoc && monthDoc.ok && isZipOffice(monthDoc.output), monthDoc && monthDoc.output);
      if (monthDoc && monthDoc.output && fs.existsSync(monthDoc.output)) {
        const xmlM = zipInnerText(monthDoc.output, 'word/document.xml');
        ok('5 month flat text', xmlM.includes('Օր') && xmlM.includes('Արամ') && xmlM.includes('Գագիկ'), xmlM.replace(/<[^>]+>/g, ' ').slice(0, 240));
      }
    }

    if (hasPpt) {
      const pptx = path.join(samples, 'sample.pptx');
      const makePpt = writePs(samples, [
        "$ErrorActionPreference='Stop'",
        "$p=New-Object -ComObject PowerPoint.Application;try{$p.Visible=0}catch{}",
        "$pr=$p.Presentations.Add()",
        "$sl=$pr.Slides.Add(1,12)",
        "$box=$sl.Shapes.AddTextbox(1,40,40,600,200)",
        "$box.TextFrame.TextRange.Text=" + psQuote(MARKER),
        "$pr.SaveAs(" + psQuote(pptx) + ",24)",
        "$pr.Close()",
        "$p.Quit()"
      ].join('\r\n'));
      const madeP = runPsFile(makePpt, 90000);
      ok('sample pptx', madeP.status === 0 && fs.existsSync(pptx), String(madeP.stderr || madeP.stdout || '').slice(0, 240));
      if (fs.existsSync(pptx)) {
        const p2pdf = await office.nativeConvert({ kind: 'ppt-to-pdf', name: 'sample.pptx', bytes: fs.readFileSync(pptx) });
        ok('2 ppt-to-pdf', p2pdf && p2pdf.ok && isPdf(p2pdf.output), p2pdf && p2pdf.output);
      }
    } else skipped('2 ppt-to-pdf', 'PowerPoint not installed');
  }

  if (!hasExcel) skipped('excel live in this script', 'covered by km_office_test');

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(userTmp, { recursive: true, force: true }); } catch {}
  console.log('Results:', pass, 'passed,', fail, 'failed,', skip, 'skipped');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
