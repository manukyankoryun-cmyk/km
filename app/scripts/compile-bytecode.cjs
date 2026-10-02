/**
 * Production bytecode compile (bytenode) for Setup / runtime trees.
 *
 * CRITICAL: .jsc MUST be produced by Electron's V8 (same binary shipped in Setup).
 * Compiling under system Node.js causes: Error: Invalid or incompatible cached data
 * (cachedDataRejected) when KM.exe loads the stubs.
 *
 * Strategy: re-exec this script under Electron with ELECTRON_RUN_AS_NODE=1 so
 * bytenode.compileFile uses the current process V8 (= Electron V8). Do NOT rely
 * on bytenode's electron:true spawn path (fragile / version-skew prone).
 *
 * Run:
 *   node scripts/compile-bytecode.cjs [--out DIR] [--electron-path PATH]
 * Env:
 *   KM_ELECTRON_PATH — absolute path to payload runtime electron.exe / KM.exe
 *   KM_BYTECODE_REPLACE=1 — replace .js with bytenode loader stubs
 *   KM_BYTECODE_ALLOW_NODE=1 — emergency only (Setup will break)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const APP = path.join(__dirname, '..');
const PROJECT = path.join(APP, '..');
/** Must match payload Electron 22.3.27 (last successful BUILD_SETUP.log). */
const EXPECTED_ELECTRON = '22.3.27';
const EXPECTED_NODE_PREFIX = '16.17';
const EXPECTED_V8_PREFIX = '10.8.168';

const TARGETS = [
  'main.js',
  'km_backend.js',
  'km_guard.js',
  'km_license.js',
  'km_net.js',
  'km_lan_sync.js',
  'km_bot_knowledge.js',
  'km_crypto_store.js',
  'km_secrets_load.js',
  'km_security_secrets.js',
  'km_owner_vault.js',
  'km_library.js',
  'km_bot_rag.js',
  'km_gemini_config.js',
  'office_backend.js',
  'km_shtatka.js',
  'km_edge_tts.js',
  'km_pdf_translate.js',
  'km_pdf_text.js',
  'km_fonts.js',
  'km_version.js',
  'km_help_bot_core.js',
  'km_domain_router.js',
  'km_text_clean.js',
  'km_sqlite_bridge.js',
  'km_conversations.js',
  'km_retention.js'
];

function usage() {
  console.log('Usage: node scripts/compile-bytecode.cjs [--out DIR] [--electron-path PATH]');
  console.log('Compiles .jsc with Electron V8 via ELECTRON_RUN_AS_NODE re-exec.');
}

function fileOk(p) {
  try {
    return !!(p && fs.existsSync(p) && fs.statSync(p).isFile() && fs.statSync(p).size > 1000000);
  } catch (_) {
    return false;
  }
}

function resolveElectronPath(cliPath) {
  const candidates = [];
  if (cliPath) candidates.push(path.resolve(cliPath));
  if (process.env.KM_ELECTRON_PATH) candidates.push(path.resolve(process.env.KM_ELECTRON_PATH));
  if (process.env.ELECTRON_PATH) candidates.push(path.resolve(process.env.ELECTRON_PATH));

  candidates.push(
    path.join(PROJECT, 'payload', 'runtime', 'x64', 'electron.exe'),
    path.join(PROJECT, 'payload', 'runtime', 'x64', 'KM.exe'),
    path.join(APP, 'node_modules', 'electron', 'dist', 'electron.exe')
  );

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'KM', 'runtime', 'KM.exe'));
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'KM', 'runtime', 'electron.exe'));
  }
  candidates.push('E:\\KM\\runtime\\KM.exe');
  candidates.push('E:\\KM\\runtime\\electron.exe');

  try {
    const fromPkg = require('electron');
    if (fromPkg) candidates.unshift(String(fromPkg));
  } catch (_) {}

  for (const c of candidates) {
    if (fileOk(c)) return path.resolve(c);
  }
  return '';
}

function isElectronHost() {
  return !!(process.versions.electron || process.env.ELECTRON_RUN_AS_NODE === '1');
}

function assertRuntimeMatch(ver) {
  const v8 = String((ver && ver.v8) || '');
  const electron = String((ver && ver.electron) || '');
  const node = String((ver && ver.node) || '');
  if (!v8) {
    throw new Error('Could not read Electron V8 version — refusing .jsc compile');
  }
  if (EXPECTED_V8_PREFIX && v8.indexOf(EXPECTED_V8_PREFIX) !== 0) {
    throw new Error(
      'V8 mismatch: host is ' +
        v8 +
        ', KM runtime expects ' +
        EXPECTED_V8_PREFIX +
        '* (Electron ' +
        EXPECTED_ELECTRON +
        '). Refusing incompatible .jsc (cachedDataRejected).'
    );
  }
  if (electron && electron !== EXPECTED_ELECTRON && electron.indexOf('22.3.') !== 0) {
    throw new Error(
      'Electron mismatch: host is ' + electron + ', expected ' + EXPECTED_ELECTRON
    );
  }
  if (node && EXPECTED_NODE_PREFIX && node.indexOf(EXPECTED_NODE_PREFIX) !== 0) {
    console.warn('WARNING: Node ' + node + ' vs expected ' + EXPECTED_NODE_PREFIX + '*');
  }
}

function electronNodeVersion(electronExe) {
  if (isElectronHost() && process.versions.v8) {
    return {
      node: process.versions.node || '',
      v8: process.versions.v8 || '',
      electron: process.versions.electron || ''
    };
  }
  const r = spawnSync(
    electronExe,
    ['-e', 'process.stdout.write(process.versions.node+"|"+process.versions.v8+"|"+(process.versions.electron||""))'],
    {
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000
    }
  );
  if (r.status !== 0) {
    throw new Error('Electron version probe failed: ' + String(r.stderr || r.stdout || r.status));
  }
  const parts = String(r.stdout || '').trim().split('|');
  return { node: parts[0] || '', v8: parts[1] || '', electron: parts[2] || '' };
}

function reexecUnderElectron(electronExe) {
  const args = [path.resolve(__filename)].concat(process.argv.slice(2));
  console.log('Re-exec under Electron V8 (ELECTRON_RUN_AS_NODE=1):');
  console.log('  ', electronExe);
  const r = spawnSync(electronExe, args, {
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      KM_ELECTRON_PATH: electronExe
    }),
    stdio: 'inherit',
    windowsHide: true
  });
  if (r.error) {
    console.error('Electron re-exec failed:', r.error.message || r.error);
    process.exit(1);
  }
  process.exit(r.status === null ? 1 : r.status);
}

async function compileAll(outDir, electronExe, useElectron) {
  let bytenode;
  try {
    bytenode = require('bytenode');
  } catch (e) {
    console.error('bytenode not installed. Run: npm i --save-dev bytenode');
    console.error(String((e && e.message) || e));
    process.exit(1);
  }

  const ver = useElectron
    ? electronNodeVersion(electronExe)
    : { node: process.versions.node, v8: process.versions.v8, electron: '' };

  if (useElectron) {
    console.log('Electron bytecode compile (in-process V8):');
    console.log('  exe:', electronExe || '(current)');
    console.log('  electron:', ver.electron || '(via ELECTRON_RUN_AS_NODE)');
    console.log('  node:', ver.node);
    console.log('  v8:', ver.v8);
    if (!isElectronHost()) {
      throw new Error('Not running under Electron V8 — refusing compile (would cause cachedDataRejected)');
    }
    assertRuntimeMatch(ver);
  } else {
    console.warn('WARNING: KM_BYTECODE_ALLOW_NODE=1 — system Node V8 (Setup will break).');
  }

  fs.mkdirSync(outDir, { recursive: true });
  const compiled = [];
  const metaPath = path.join(outDir, 'km_bytecode_meta.json');

  for (const rel of TARGETS) {
    const src = path.join(APP, rel);
    if (!fs.existsSync(src)) {
      console.warn('skip missing', rel);
      continue;
    }
    const destJs = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(destJs), { recursive: true });
    if (path.resolve(src) !== path.resolve(destJs)) {
      fs.copyFileSync(src, destJs);
    }
    const jsc = destJs.replace(/\.js$/i, '.jsc');

    /* Compile with CURRENT process V8 (must be Electron when useElectron). */
    await bytenode.compileFile({
      filename: destJs,
      output: jsc,
      compileAsModule: true
    });

    if (!fs.existsSync(jsc) || fs.statSync(jsc).size < 32) {
      throw new Error('compile produced empty/missing jsc: ' + jsc);
    }

    if (process.env.KM_BYTECODE_REPLACE === '1' || path.resolve(outDir) !== path.resolve(APP)) {
      const baseJsc = path.basename(jsc).replace(/\\/g, '/');
      const stub =
        "'use strict';\n" +
        "const fs = require('fs');\n" +
        "const path = require('path');\n" +
        "const jsc = path.join(__dirname, '" +
        baseJsc +
        "');\n" +
        "if (fs.existsSync(jsc)) {\n" +
        "  require('bytenode');\n" +
        "  module.exports = require('./" +
        baseJsc +
        "');\n" +
        "} else {\n" +
        "  throw new Error('Missing " +
        baseJsc +
        " (bytenode). Restore plaintext " +
        rel +
        " from installer/project, or recompile bytecode.');\n" +
        "}\n";
      fs.writeFileSync(destJs, stub, 'utf8');
    }
    compiled.push(rel);
    console.log('compiled', rel, '->', path.relative(outDir, jsc), useElectron ? '(electron-v8)' : '(node-v8)');
  }

  const meta = {
    at: new Date().toISOString(),
    electronExe: electronExe || null,
    versions: ver,
    expected: {
      electron: EXPECTED_ELECTRON,
      nodePrefix: EXPECTED_NODE_PREFIX,
      v8Prefix: EXPECTED_V8_PREFIX
    },
    engine: useElectron ? 'electron' : 'node',
    host: isElectronHost() ? 'electron-as-node' : 'node',
    compiled
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  console.log('OK compiled', compiled.length, 'modules into', outDir, 'engine=' + meta.engine);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(0);
  }

  let outDir = APP;
  const ix = args.indexOf('--out');
  if (ix >= 0 && args[ix + 1]) outDir = path.resolve(args[ix + 1]);

  let cliEp = '';
  const epIx = args.indexOf('--electron-path');
  if (epIx >= 0 && args[epIx + 1]) cliEp = args[epIx + 1];

  const allowNode = process.env.KM_BYTECODE_ALLOW_NODE === '1';
  const electronExe = resolveElectronPath(cliEp);

  if (!electronExe && !allowNode) {
    console.error('ERROR: Electron binary not found. Bytecode must match Electron V8.');
    console.error('Set KM_ELECTRON_PATH to payload\\runtime\\x64\\electron.exe (or installed KM.exe).');
    console.error('Refusing to compile with system Node (causes cachedDataRejected).');
    process.exit(1);
  }

  /* Re-spawn under Electron so compileFile uses Electron V8 in-process. */
  if (electronExe && !isElectronHost() && !allowNode) {
    reexecUnderElectron(electronExe);
    return;
  }

  await compileAll(outDir, electronExe, !!(electronExe && !allowNode));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
