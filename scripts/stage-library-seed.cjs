/* Copy live UserData Library (legal corner + all library files) into Setup seed. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const Project = path.resolve(__dirname, '..');
const localApp = process.env.LOCALAPPDATA
  || path.join(os.homedir(), 'AppData', 'Local');
const userRoot = path.join(localApp, 'KM', 'UserData');
const liveLib = path.join(userRoot, 'Library');
const liveFonts = path.join(userRoot, 'Fonts');
const payloadLib = process.env.KM_LIBRARY_SEED_OUT
  ? path.resolve(process.env.KM_LIBRARY_SEED_OUT)
  : path.join(Project, 'payload', 'seed', 'Library');
const payloadFonts = path.join(Project, 'payload', 'seed', 'Fonts');

const SKIP_DIR = /^(?:_pdf_text_cache|Cache|blob_storage|Thumbs\.db)$/i;

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {
    try { fs.rmdirSync(p, { recursive: true }); } catch (_) {}
  }
}

function copyTree(src, dst, acc) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    const base = path.basename(src);
    if (SKIP_DIR.test(base)) return;
    fs.mkdirSync(dst, { recursive: true });
    const names = fs.readdirSync(src);
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      if (n === 'desktop.ini' || n === 'Thumbs.db') continue;
      copyTree(path.join(src, n), path.join(dst, n), acc);
    }
    return;
  }
  if (!st.isFile()) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  acc.files++;
  acc.bytes += st.size;
}

function main() {
  if (!fs.existsSync(liveLib)) {
    throw new Error('Live Library missing: ' + liveLib);
  }
  rmrf(payloadLib);
  fs.mkdirSync(payloadLib, { recursive: true });
  const acc = { files: 0, bytes: 0 };
  copyTree(liveLib, payloadLib, acc);
  if (acc.files < 20) {
    throw new Error('Library seed too small: ' + acc.files + ' files from ' + liveLib);
  }
  const meta = {
    at: new Date().toISOString(),
    files: acc.files,
    bytes: acc.bytes,
    source: liveLib
  };
  fs.writeFileSync(path.join(payloadLib, '..', 'Library.meta.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log('LIBRARY SEED files=' + acc.files + ' bytes=' + acc.bytes + ' -> ' + payloadLib);

  rmrf(payloadFonts);
  if (fs.existsSync(liveFonts)) {
    const fAcc = { files: 0, bytes: 0 };
    fs.mkdirSync(payloadFonts, { recursive: true });
    copyTree(liveFonts, payloadFonts, fAcc);
    console.log('FONTS SEED files=' + fAcc.files + ' bytes=' + fAcc.bytes);
    if (!fAcc.files) rmrf(payloadFonts);
  }
}

main();
