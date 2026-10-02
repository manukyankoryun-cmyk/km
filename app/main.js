'use strict';

/*
 * KM main bootstrap
 * - Registers compatibility IPC channels before bytecode starts.
 * - Loads the existing soldier-card archive bridge before main.jsc.
 * - Adds a small persistent permission sidecar for Admin view/edit rights,
 *   because main.jsc is compiled bytecode and is not safely editable here.
 */
const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

function safeHandle(channel, handler) {
  try {
    ipcMain.handle(channel, handler);
  } catch (e) {
    /* If a future main.jsc already registers it, do not crash startup. */
    try { console.warn('[KM] IPC handler already registered:', channel, e && e.message); } catch (_) {}
  }
}

/* BNS/BRO compatibility handlers: never throw "No handler registered".
 * The original project does not contain a BNS/BRO client implementation, so
 * these return a structured unavailable result instead of a rejected invoke.
 */
safeHandle('bns-client-invocation', async (_event, args) => ({
  ok: false,
  code: 'BNS_CLIENT_UNAVAILABLE',
  message: 'BNS client service-ը հասանելի չէ այս տեղադրման մեջ։',
  args: args == null ? null : args
}));

safeHandle('bro-client-invocation', async (_event, args) => ({
  ok: false,
  code: 'BRO_CLIENT_UNAVAILABLE',
  message: 'BRO client service-ը հասանելի չէ այս տեղադրման մեջ։',
  args: args == null ? null : args
}));

/* Soldier-card bridge MUST load before main.jsc.  The old bootstrap loaded it
 * after main.jsc, so a startup failure in the bytecode could leave its handlers
 * unregistered and produce repeated km:soldiercard:* errors in the UI.
 */
try {
/* KM_SOLDIER_CARD_ARCHIVE_MAIN_V1 — inlined into main.js (a separate .cjs is not sealed in
   km_integrity.json and the guard reports it as a foreign/old file). Runs before main.jsc. */
(function kmSoldierCardArchiveBridge() {
/**
 * KM_SOLDIER_CARD_ARCHIVE_MAIN_V1
 * IPC for Անձի քարտ PDF archive under UserData/archive/soldiers-cards.
 * Loaded from main.js after main.jsc so we do not patch bytecode.
 */
const crypto = require('crypto');
const { execFile } = require('child_process');

const MAX_FILES = 100;
const MAX_BYTES = 25 * 1024 * 1024;
const KIND_DIR = 'soldiers-cards';

function runWiaScanToJpeg(targetPath) {
  return new Promise((resolve, reject) => {
    /* ASCII-only PowerShell + -EncodedCommand (UTF-16LE): Armenian text on the command line
       was turned into "?????" by the console code page. Errors are ASCII codes mapped in JS. */
    const ps = [
      '$ErrorActionPreference = "Stop";',
      'try {',
      '$dm = New-Object -ComObject WIA.DeviceManager;',
      '$info = $null;',
      'foreach ($d in $dm.DeviceInfos) { if ($d.Type -eq 1) { $info = $d; break } }',
      'if ($null -eq $info) { [Console]::Error.WriteLine("KM_NO_SCANNER"); exit 3 }',
      '$dev = $info.Connect();',
      '$item = $dev.Items.Item(1);',
      '$img = $item.Transfer();',
      '$proc = New-Object -ComObject WIA.ImageProcess;',
      '$filter = $proc.FilterInfos.Item("Convert");',
      '$proc.Filters.Add($filter.FilterID);',
      '$proc.Filters.Item(1).Properties.Item("FormatID").Value = "{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}";',
      '$out = $proc.Apply($img);',
      '$out.SaveFile(' + JSON.stringify(targetPath) + ');',
      'Write-Output "OK";',
      '} catch { [Console]::Error.WriteLine("KM_WIA_ERR: " + $_.Exception.Message); exit 4 }'
    ].join(' ');
    const encoded = Buffer.from(ps, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-OutputFormat', 'Text', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const raw = String(stderr || '');
          if (raw.indexOf('KM_NO_SCANNER') >= 0) return reject(new Error('Սկաներ չի գտնվել։ Միացրեք սկաները, տեղադրեք դրայվերը (WIA) և կրկին փորձեք։'));
          const line = raw.split(/\r?\n/).map(x => x.trim()).filter(Boolean)[0] || err.message || 'Սկանավորումը ձախողվեց';
          return reject(new Error('Սկանավորումը ձախողվեց՝ ' + line.replace(/^KM_WIA_ERR:\s*/, '')));
        }
        if (!fs.existsSync(targetPath)) return reject(new Error('Սկանավորված ֆայլը չի ստեղծվել'));
        resolve(targetPath);
      });
  });
}

function jpegSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    let marker = buf[i + 1]; i += 2;
    while (marker === 0xff && i < buf.length) marker = buf[i++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (i + 2 > buf.length) break;
    const len = buf.readUInt16BE(i); if (len < 2 || i + len > buf.length) break;
    const sof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
    if (sof && len >= 7) return { width: buf.readUInt16BE(i + 5), height: buf.readUInt16BE(i + 3) };
    i += len;
  }
  return null;
}

function jpegToPdf(jpeg) {
  const sz = jpegSize(jpeg) || { width: 1240, height: 1754 };
  const w = Math.max(72, Math.round(sz.width * 72 / 150));
  const h = Math.max(72, Math.round(sz.height * 72 / 150));
  const content = Buffer.from(`q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`, 'ascii');
  const objects = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${sz.width} /Height ${sz.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')]),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`), content, Buffer.from('endstream')])
  ];
  const chunks = [Buffer.from('%PDF-1.3\n%\xff\xff\xff\xff\n')];
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${i + 1} 0 obj\n`));
    chunks.push(objects[i]);
    chunks.push(Buffer.from('\nendobj\n'));
  }
  const xref = Buffer.concat(chunks).length;
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (let i = 1; i <= objects.length; i++) chunks.push(Buffer.from(String(offsets[i]).padStart(10, '0') + ' 00000 n \n'));
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return Buffer.concat(chunks);
}


function userDataRoot() {
  const local = process.env.LOCALAPPDATA || process.env.HOME || '';
  return path.join(local, 'KM', 'UserData');
}

function archiveRoot() {
  return path.join(userDataRoot(), 'archive', KIND_DIR);
}

function safeId(raw, fallback) {
  const s = String(raw || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96);
  return s || String(fallback || 'x').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 96) || 'x';
}

function personDir(personKey) {
  return path.join(archiveRoot(), safeId(personKey, 'unknown'));
}

function metaPath(personKey) {
  return path.join(personDir(personKey), 'meta.json');
}

function readMeta(personKey) {
  const p = metaPath(personKey);
  try {
    if (!fs.existsSync(p)) return { personKey: safeId(personKey), personName: '', files: [] };
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j || typeof j !== 'object') return { personKey: safeId(personKey), personName: '', files: [] };
    if (!Array.isArray(j.files)) j.files = [];
    j.personKey = safeId(personKey);
    return j;
  } catch (e) {
    return { personKey: safeId(personKey), personName: '', files: [] };
  }
}

/* Non-blocking twin of readMeta(): same fallbacks, but does not stall the main process. */
async function readMetaAsync(personKey) {
  const empty = () => ({ personKey: safeId(personKey), personName: '', files: [] });
  try {
    const j = JSON.parse(await fs.promises.readFile(metaPath(personKey), 'utf8'));
    if (!j || typeof j !== 'object') return empty();
    if (!Array.isArray(j.files)) j.files = [];
    j.personKey = safeId(personKey);
    return j;
  } catch (e) {
    return empty();
  }
}

function writeMeta(personKey, meta) {
  const dir = personDir(personKey);
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    personKey: safeId(personKey),
    personName: String((meta && meta.personName) || '').trim(),
    files: Array.isArray(meta && meta.files) ? meta.files : [],
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(metaPath(personKey), JSON.stringify(out, null, 2), 'utf8');
  return out;
}

function toBytes(bytes) {
  if (!bytes) return null;
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes);
  if (Array.isArray(bytes)) return Buffer.from(bytes);
  if (typeof bytes === 'string') {
    try { return Buffer.from(bytes, 'base64'); } catch (e) { return null; }
  }
  return null;
}

function ensureHandlers() {
  if (global.__kmSoldierCardArchiveIpc) return;
  global.__kmSoldierCardArchiveIpc = true;

  ipcMain.handle('km:soldiercard:list', async (_e, req) => {
    try {
      const personKey = safeId(req && req.personKey);
      if (!personKey || personKey === 'x') return { ok: false, message: 'Անվավեր բանալի' };
      const meta = readMeta(personKey);
      if (req && req.personName) meta.personName = String(req.personName || '').trim();
      return { ok: true, personKey, personName: meta.personName || '', files: meta.files || [], max: MAX_FILES };
    } catch (e) {
      return { ok: false, message: e.message || String(e) };
    }
  });

  ipcMain.handle('km:soldiercard:listAll', async () => {
    try {
      const root = archiveRoot();
      let entries;
      try {
        entries = await fs.promises.readdir(root, { withFileTypes: true });
      } catch (e) {
        if (e && e.code === 'ENOENT') return { ok: true, people: [] };
        throw e;
      }
      const dirs = entries.filter(d => d.isDirectory()).map(d => d.name);
      const metas = await Promise.all(dirs.map(name => readMetaAsync(name)));
      const people = dirs.map((name, i) => {
        const meta = metas[i];
        return {
          personKey: meta.personKey || name,
          personName: meta.personName || name,
          count: (meta.files || []).length,
          files: meta.files || [],
          updatedAt: meta.updatedAt || null
        };
      });
      people.sort((a, b) => String(a.personName || '').localeCompare(String(b.personName || ''), 'hy'));
      return { ok: true, people, max: MAX_FILES };
    } catch (e) {
      return { ok: false, message: e.message || String(e), people: [] };
    }
  });


  ipcMain.handle('km:soldiercard:scanAndSave', async (_e, req) => {
    try {
      const personKey = safeId(req && req.personKey);
      if (!personKey || personKey === 'x') return { ok: false, message: 'Անվավեր բանալի' };
      const personName = String((req && req.personName) || '').trim();
      const meta = readMeta(personKey);
      if (personName) meta.personName = personName;
      if ((meta.files || []).length >= MAX_FILES) return { ok: false, message: 'Առավելագույնը ' + MAX_FILES + ' PDF մեկ անձի քարտում' };
      const dir = personDir(personKey);
      fs.mkdirSync(dir, { recursive: true });
      const tmpJpg = path.join(dir, '.scan_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex') + '.jpg');
      await runWiaScanToJpeg(tmpJpg);
      const jpeg = fs.readFileSync(tmpJpg);
      try { fs.unlinkSync(tmpJpg); } catch (_) {}
      const pdf = jpegToPdf(jpeg);
      if (!pdf || pdf.length < 20 || pdf.slice(0, 5).toString('ascii') !== '%PDF-') return { ok: false, message: 'Չհաջողվեց PDF ստեղծել սկանից' };
      if (pdf.length > MAX_BYTES) return { ok: false, message: 'Սքանավորված PDF-ը չափազանց մեծ է (մինչև 25 ՄԲ)' };
      const fileId = safeId('scan_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'), 'scan_x');
      const dest = path.join(dir, fileId + '.pdf');
      fs.writeFileSync(dest, pdf);
      const entry = { id: fileId, name: 'Սկան ' + new Date().toLocaleString('hy-AM').replace(/[\\/:]/g, '-') + '.pdf', addedAt: new Date().toISOString(), size: pdf.length };
      meta.files = (meta.files || []).concat([entry]);
      writeMeta(personKey, meta);
      return { ok: true, file: entry, files: meta.files, max: MAX_FILES };
    } catch (e) {
      return { ok: false, message: e && e.message ? e.message : String(e) };
    }
  });

  ipcMain.handle('km:soldiercard:save', async (_e, req) => {
    try {
      const personKey = safeId(req && req.personKey);
      if (!personKey || personKey === 'x') return { ok: false, message: 'Անվավեր բանալի' };
      const personName = String((req && req.personName) || '').trim();
      const fileName = String((req && req.name) || 'document.pdf').trim() || 'document.pdf';
      if (!/\.pdf$/i.test(fileName)) return { ok: false, message: 'Միայն PDF ֆայլ' };
      const buf = toBytes(req && req.bytes);
      if (!buf || buf.length < 5) return { ok: false, message: 'Դատարկ ֆայլ' };
      if (buf.length > MAX_BYTES) return { ok: false, message: 'PDF-ը չափազանց մեծ է (մինչև 25 ՄԲ)' };
      if (buf.slice(0, 5).toString('utf8') !== '%PDF-') return { ok: false, message: 'Անվավեր PDF' };

      const meta = readMeta(personKey);
      if (personName) meta.personName = personName;
      if ((meta.files || []).length >= MAX_FILES) {
        return { ok: false, message: 'Առավելագույնը ' + MAX_FILES + ' PDF մեկ անձի քարտում' };
      }

      const fileId = safeId('f_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'), 'f_x');
      const dir = personDir(personKey);
      fs.mkdirSync(dir, { recursive: true });
      const dest = path.join(dir, fileId + '.pdf');
      fs.writeFileSync(dest, buf);

      const entry = {
        id: fileId,
        name: fileName.slice(0, 180),
        addedAt: new Date().toISOString(),
        size: buf.length
      };
      meta.files = (meta.files || []).concat([entry]);
      writeMeta(personKey, meta);
      return { ok: true, file: entry, files: meta.files, max: MAX_FILES };
    } catch (e) {
      return { ok: false, message: e.message || String(e) };
    }
  });

  ipcMain.handle('km:soldiercard:read', async (_e, req) => {
    try {
      const personKey = safeId(req && req.personKey);
      const fileId = safeId(req && req.id);
      if (!personKey || !fileId) return { ok: false, message: 'Անվավեր հարցում' };
      const pdfPath = path.join(personDir(personKey), fileId + '.pdf');
      if (!fs.existsSync(pdfPath)) return { ok: false, message: 'PDF չի գտնվել' };
      const buf = fs.readFileSync(pdfPath);
      const meta = readMeta(personKey);
      const entry = (meta.files || []).find((f) => f && f.id === fileId) || null;
      return {
        ok: true,
        id: fileId,
        name: (entry && entry.name) || (fileId + '.pdf'),
        mime: 'application/pdf',
        base64: buf.toString('base64'),
        size: buf.length
      };
    } catch (e) {
      return { ok: false, message: e.message || String(e) };
    }
  });

  ipcMain.handle('km:soldiercard:remove', async (_e, req) => {
    try {
      const personKey = safeId(req && req.personKey);
      const fileId = safeId(req && req.id);
      if (!personKey || !fileId) return { ok: false, message: 'Անվավեր հարցում' };
      const pdfPath = path.join(personDir(personKey), fileId + '.pdf');
      try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch (eU) {}
      const meta = readMeta(personKey);
      meta.files = (meta.files || []).filter((f) => f && f.id !== fileId);
      if (req && req.personName) meta.personName = String(req.personName || '').trim();
      writeMeta(personKey, meta);
      return { ok: true, files: meta.files, max: MAX_FILES };
    } catch (e) {
      return { ok: false, message: e.message || String(e) };
    }
  });
}

ensureHandlers();


})();
} catch (e) {
  try { console.error('[KM] soldier-card-archive bridge failed:', e && e.stack ? e.stack : e); } catch (_) {}
}

const jsc = path.join(__dirname, 'main.jsc');
if (!fs.existsSync(jsc)) {
  throw new Error('Missing main.jsc (bytenode). Restore plaintext main.js from installer/project, or recompile bytecode.');
}

require('bytenode');
const exported = require('./main.jsc');

/* ---------- Admin granular permissions sidecar ---------- */
const PERM_FILE = (() => {
  try {
    const local = process.env.LOCALAPPDATA || process.env.HOME || '';
    return path.join(local, 'KM', 'UserData', 'km_admin_permissions.json');
  } catch (_) { return path.join(__dirname, 'km_admin_permissions.json'); }
})();

function readPerms() {
  try {
    if (!fs.existsSync(PERM_FILE)) return { version: 1, admins: {} };
    const x = JSON.parse(fs.readFileSync(PERM_FILE, 'utf8'));
    return x && typeof x === 'object' ? x : { version: 1, admins: {} };
  } catch (_) { return { version: 1, admins: {} }; }
}
function writePerms(data) {
  const out = data && typeof data === 'object' ? data : { version: 1, admins: {} };
  out.version = 1;
  if (!out.admins || typeof out.admins !== 'object') out.admins = {};
  try {
    fs.mkdirSync(path.dirname(PERM_FILE), { recursive: true });
    const tmp = PERM_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(out, null, 2), 'utf8');
    fs.renameSync(tmp, PERM_FILE);
    return true;
  } catch (e) {
    try { console.error('[KM] permission sidecar write failed:', e && e.message); } catch (_) {}
    return false;
  }
}
function cleanList(v) {
  return Array.from(new Set((Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean)));
}
function saveAdminPermission(id, value) {
  if (!id) return false;
  const d = readPerms();
  d.admins[String(id)] = {
    viewSections: cleanList(value && value.viewSections),
    editSections: cleanList(value && value.editSections),
    pageAccessMode: String((value && value.pageAccessMode) || ''),
    username: String((value && value.username) || ''),
    updatedAt: new Date().toISOString()
  };
  return writePerms(d);
}
function mergeAdminPermissions(list) {
  const d = readPerms();
  return (Array.isArray(list) ? list : []).map(a => {
    const x = a && typeof a === 'object' ? Object.assign({}, a) : a;
    const p = x && d.admins ? d.admins[String(x.id)] : null;
    if (p) {
      x.viewSections = cleanList(p.viewSections);
      x.editSections = cleanList(p.editSections);
      x.pageAccessMode = p.pageAccessMode || '';
      /* Legacy field remains edit-compatible. */
      x.sections = cleanList(x.sections && x.sections.length ? x.sections : x.editSections);
    } else {
      const legacy = cleanList(x && x.sections);
      x.editSections = legacy;
      x.viewSections = [];
      x.pageAccessMode = 'legacy';
    }
    return x;
  });
}


function mergeSecurityResult(r) {
  if (!r || typeof r !== 'object' || !r.isAdmin) return r;
  const d = readPerms();
  let p = null;
  const username = String(r.username || '').trim();
  for (const k of Object.keys(d.admins || {})) {
    const x = d.admins[k];
    if (x && username && String(x.username || '').trim() === username) { p = x; break; }
  }
  const legacy = cleanList(r.sections);
  if (p) {
    r.viewSections = cleanList(p.viewSections);
    r.editSections = cleanList(p.editSections);
    r.pageAccessMode = p.pageAccessMode || '';
    r.sections = r.editSections.slice();
  } else {
    r.viewSections = [];
    r.editSections = legacy;
    r.pageAccessMode = 'legacy';
  }
  return r;
}

/* Returns the registered invoke handler for a channel, or null (uses Electron's internal map). */
function getInvokeHandler(channel) {
  const map = ipcMain && ipcMain._invokeHandlers;
  const fn = map && typeof map.get === 'function' ? map.get(channel) : null;
  return typeof fn === 'function' ? fn : null;
}

/* Wraps an already-registered handler. Returns true when the channel is wrapped. */
function wrapInvokeHandler(channel, makeWrapper) {
  try {
    const map = ipcMain && ipcMain._invokeHandlers;
    if (!map || typeof map.set !== 'function') return false;
    const original = getInvokeHandler(channel);
    if (!original) return false;
    if (original.__kmWrapped) return true;
    const wrapped = makeWrapper(original);
    wrapped.__kmWrapped = true;
    map.set(channel, wrapped);
    return true;
  } catch (e) {
    try { console.error('[KM] IPC wrap failed:', channel, e && e.message); } catch (_) {}
    return false;
  }
}

/* The compiled core may register its handlers after this file loads. Without a retry the wrap
   silently fails and every delegated admin falls back to "legacy" (full) rights. */
const WRAP_RETRY_MS = 250;
const WRAP_RETRY_MAX = 120; /* 30 s */
function wrapWhenRegistered(channel, makeWrapper) {
  if (wrapInvokeHandler(channel, makeWrapper)) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    if (wrapInvokeHandler(channel, makeWrapper)) { clearInterval(timer); return; }
    if (tries >= WRAP_RETRY_MAX) {
      clearInterval(timer);
      try { console.error('[KM] permission wrap gave up, channel never registered:', channel); } catch (_) {}
    }
  }, WRAP_RETRY_MS);
  if (timer && typeof timer.unref === 'function') timer.unref();
}

/* Looks an admin up through the compiled list handler (by username or by id). */
async function findAdmin(event, adminToken, predicate) {
  try {
    const listHandler = getInvokeHandler('km:users:list');
    if (!listHandler) return null;
    const lr = await listHandler(event, { adminToken: adminToken || '' });
    return ((lr && lr.admins) || []).find(predicate) || null;
  } catch (e) {
    try { console.error('[KM] admin lookup failed:', e && e.message); } catch (_) {}
    return null;
  }
}

/* Merge sidecar fields into Admin list results. */
wrapWhenRegistered('km:users:list', original => async function (event, req) {
  const r = await original(event, req);
  if (r && Array.isArray(r.admins)) r.admins = mergeAdminPermissions(r.admins);
  return r;
});

wrapWhenRegistered('km:security:loginAdmin', original => async function (event, req) {
  return mergeSecurityResult(await original(event, req));
});
wrapWhenRegistered('km:security:verifySession', original => async function (event, token) {
  return mergeSecurityResult(await original(event, token));
});

/* Persist view/edit fields after the real compiled saveAdmin succeeds.
   If the sidecar cannot be written the caller is told, instead of silently losing the rights. */
wrapWhenRegistered('km:users:saveAdmin', original => async function (event, req) {
  const r = await original(event, req);
  if (!r || !r.ok) return r;
  const q = req && typeof req === 'object' ? req : {};
  let id = q.id || (r.admin && r.admin.id) || '';
  let username = q.username || (r.admin && r.admin.username) || '';
  if (!id && username) {
    const found = await findAdmin(event, q.adminToken, a => String(a.username || '') === String(username));
    if (found) id = found.id;
  }
  if (!id) return r;
  if (!username) {
    const found = await findAdmin(event, q.adminToken, a => String(a.id) === String(id));
    if (found) username = found.username || '';
  }
  const saved = saveAdminPermission(id, {
    viewSections: q.viewSections,
    editSections: q.editSections,
    pageAccessMode: q.pageAccessMode,
    username
  });
  if (!saved) {
    return Object.assign({}, r, { permissionsSaved: false, message: 'Իրավունքները չպահպանվեցին (ֆայլի գրառման սխալ)' });
  }
  return r;
});

module.exports = exported;
