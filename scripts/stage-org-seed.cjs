/* Copy live org names + unit_kod + unit Excel archives into Setup seed. Never packs kodmutq. */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const Project = path.resolve(__dirname, '..');
const localApp = process.env.LOCALAPPDATA
  || path.join(os.homedir(), 'AppData', 'Local');
const userRoot = path.join(localApp, 'KM', 'UserData');
const payloadOrg = process.env.KM_ORG_SEED_OUT
  ? path.resolve(process.env.KM_ORG_SEED_OUT)
  : path.join(Project, 'payload', 'seed', 'org');
const payloadKod = path.join(payloadOrg, 'unit_kod');
const appSeedJson = process.env.KM_ORG_APP_SEED_JSON
  ? path.resolve(process.env.KM_ORG_APP_SEED_JSON)
  : path.join(Project, 'app', 'data', 'km_org_seed.json');
const appKodSeed = process.env.KM_ORG_APP_KOD_DIR
  ? path.resolve(process.env.KM_ORG_APP_KOD_DIR)
  : path.join(Project, 'app', 'data', 'unit_kod_seed');
const payloadArch = path.join(payloadOrg, 'unit_archives');
const appArchSeed = process.env.KM_ORG_APP_ARCHIVES_DIR
  ? path.resolve(process.env.KM_ORG_APP_ARCHIVES_DIR)
  : path.join(Project, 'app', 'data', 'unit_archives_seed');

function slimOrg(org) {
  org = org && typeof org === 'object' ? org : {};
  const corps = (Array.isArray(org.corps) ? org.corps : []).map((c) => ({
    id: String((c && c.id) || ''),
    name: String((c && c.name) || ''),
    kind: c && c.kind ? String(c.kind) : 'corps',
    ord: Number(c && c.ord) || 0
  })).filter((c) => c.id && c.name);
  const units = (Array.isArray(org.units) ? org.units : []).map((u) => ({
    id: String((u && u.id) || ''),
    corpsId: String((u && u.corpsId) || ''),
    name: String((u && u.name) || '')
  })).filter((u) => u.id && u.name);
  return { corps, units };
}

function readJson(p) {
  try {
    let t = fs.readFileSync(p, 'utf8');
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    const j = JSON.parse(t);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

function dbFromSnapshot(snapPath) {
  const j = readJson(snapPath);
  if (!j || typeof j !== 'object') return null;
  if (j.data && typeof j.data === 'object' && !Array.isArray(j.data)) return j.data;
  return j;
}

function orgFromSnapshot(snapPath) {
  const db = dbFromSnapshot(snapPath);
  return db && db.kmOrg ? db.kmOrg : null;
}

function parseSliceKey(id) {
  const s = String(id || '');
  const i = s.indexOf('::');
  if (i < 1) return { corpsId: s, unitId: '' };
  return { corpsId: s.slice(0, i), unitId: s.slice(i + 2) };
}

function slimArchive(a, sliceHint) {
  if (!a || typeof a !== 'object' || a.builtin) return null;
  const id = String(a.id || '').trim();
  if (!id || /kodmutq/i.test(id)) return null;
  let corpsId = String(a.corpsId || '').trim();
  let unitId = String(a.unitId || '').trim();
  if ((!corpsId || !unitId) && sliceHint) {
    const p = parseSliceKey(sliceHint);
    if (!corpsId) corpsId = p.corpsId;
    if (!unitId) unitId = p.unitId;
  }
  if (!corpsId || !unitId || /kodmutq/i.test(corpsId) || /kodmutq/i.test(unitId)) return null;
  const rows = Array.isArray(a.rows) ? a.rows : [];
  const base64 = typeof a.base64 === 'string' ? a.base64 : '';
  if (!base64 && !rows.length) return null;
  return {
    id,
    name: String(a.name || 'archive.xlsx'),
    builtin: false,
    mime: String(a.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    base64,
    rows,
    addedAt: String(a.addedAt || ''),
    _shtatCols: a._shtatCols || 'A-AU',
    autoFilter: a.autoFilter || '',
    title: a.title || '',
    corpsId,
    unitId,
    archiveRole: String(a.archiveRole || ''),
    corpsName: String(a.corpsName || ''),
    unitName: String(a.unitName || '')
  };
}

function archiveFileName(corpsId, unitId, id) {
  const key = String(corpsId || '') + '__' + String(unitId || '') + '__' + String(id || '');
  return key.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) + '.json';
}

function addArchive(map, a, sliceHint) {
  const slim = slimArchive(a, sliceHint);
  if (!slim) return;
  const prev = map.get(slim.id);
  if (!prev || String(slim.base64 || '').length > String(prev.base64 || '').length) {
    map.set(slim.id, slim);
  }
}

function collectArchivesFromDb(db, map) {
  map = map || new Map();
  if (!db || typeof db !== 'object') return map;
  (Array.isArray(db.positionArchives) ? db.positionArchives : []).forEach((a) => addArchive(map, a, ''));
  const cd = db.kmCorpsData && typeof db.kmCorpsData === 'object' ? db.kmCorpsData : {};
  Object.keys(cd).forEach((k) => {
    const sl = cd[k];
    (sl && Array.isArray(sl.positionArchives) ? sl.positionArchives : []).forEach((a) => addArchive(map, a, k));
  });
  return map;
}

function collectArchivesFromDir(dir, map) {
  const idx = readJson(path.join(dir, 'index.json'));
  if (!idx || typeof idx !== 'object' || Array.isArray(idx)) return map;
  Object.keys(idx).forEach((id) => {
    const meta = idx[id] && typeof idx[id] === 'object' ? idx[id] : {};
    let fname = String(meta.file || '').replace(/[\\/]/g, '');
    if (!fname || /\.\./.test(fname) || /kodmutq/i.test(fname) || !/\.json$/i.test(fname)) return;
    const rec = readJson(path.join(dir, fname));
    addArchive(map, rec || meta, '');
  });
  return map;
}

function writeArchiveSeed(dir, map) {
  rmrf(dir);
  mkdirp(dir);
  const idx = {};
  const list = Array.from(map.values());
  list.forEach((a) => {
    const fname = archiveFileName(a.corpsId, a.unitId, a.id);
    writeJson(path.join(dir, fname), a);
    idx[a.id] = {
      file: fname,
      name: a.name,
      corpsId: a.corpsId,
      unitId: a.unitId,
      rows: Array.isArray(a.rows) ? a.rows.length : 0,
      bytes: String(a.base64 || '').length
    };
  });
  writeJson(path.join(dir, 'index.json'), idx);
  return list;
}

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(p, obj) {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

function copyKodFiles(srcDir, dstDir) {
  mkdirp(dstDir);
  const idx = readJson(path.join(srcDir, 'index.json')) || {};
  const outIdx = {};
  let copied = 0;
  if (idx && typeof idx === 'object' && !Array.isArray(idx)) {
    Object.keys(idx).forEach((k) => {
      const meta = idx[k] && typeof idx[k] === 'object' ? idx[k] : {};
      let fname = String(meta.file || '').replace(/[\\/]/g, '');
      if (!fname) fname = String(k).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) + '.txt';
      if (!fname || /\.\./.test(fname) || /kodmutq/i.test(fname) || !/\.txt$/i.test(fname)) return;
      const src = path.join(srcDir, fname);
      if (!fs.existsSync(src)) return;
      fs.copyFileSync(src, path.join(dstDir, fname));
      outIdx[k] = Object.assign({}, meta, { file: fname });
      copied++;
    });
  }
  writeJson(path.join(dstDir, 'index.json'), outIdx);
  return { copied, keys: Object.keys(outIdx) };
}

function main() {
  let org = slimOrg(readJson(path.join(userRoot, 'km_org_seed.json')));
  if (!org.units.length) {
    org = slimOrg(orgFromSnapshot(path.join(userRoot, 'database_snapshot.json')));
  }
  const payload = Object.assign({ at: new Date().toISOString() }, org);

  rmrf(payloadOrg);
  mkdirp(payloadKod);
  writeJson(path.join(payloadOrg, 'km_org_seed.json'), payload);
  writeJson(appSeedJson, payload);

  const liveKod = path.join(userRoot, 'unit_kod');
  const kod = fs.existsSync(liveKod)
    ? copyKodFiles(liveKod, payloadKod)
    : (writeJson(path.join(payloadKod, 'index.json'), {}), { copied: 0, keys: [] });

  rmrf(appKodSeed);
  mkdirp(appKodSeed);
  fs.readdirSync(payloadKod).forEach((n) => {
    fs.copyFileSync(path.join(payloadKod, n), path.join(appKodSeed, n));
  });

  const renamed = (org.units || []).filter((u) => u.name && !/^\d+-(ին|րդ) զորամաս$/.test(u.name) && u.name !== 'Կորպուսի շտաբ');
  console.log('ORG SEED userRoot=' + userRoot);
  console.log('ORG SEED corps=' + org.corps.length + ' units=' + org.units.length + ' kodFiles=' + kod.copied);
  renamed.slice(0, 12).forEach((u) => {
    console.log('ORG SEED NAME ' + u.corpsId + '::' + u.id + ' = ' + u.name);
  });
  kod.keys.forEach((k) => console.log('ORG SEED KOD ' + k));
  if (!kod.copied) console.log('ORG SEED WARN: no unit_kod txt files in live UserData');

  const archMap = new Map();
  collectArchivesFromDb(dbFromSnapshot(path.join(userRoot, 'database_snapshot.json')), archMap);
  const liveArch = path.join(userRoot, 'unit_archives');
  if (fs.existsSync(liveArch)) collectArchivesFromDir(liveArch, archMap);
  writeArchiveSeed(payloadArch, archMap);
  rmrf(appArchSeed);
  mkdirp(appArchSeed);
  fs.readdirSync(payloadArch).forEach((n) => {
    fs.copyFileSync(path.join(payloadArch, n), path.join(appArchSeed, n));
  });
  console.log('ORG SEED ARCHIVES ' + archMap.size);
  Array.from(archMap.values()).forEach((a) => {
    console.log('ORG SEED ARCH ' + a.corpsId + '::' + a.unitId + ' ' + a.name + ' rows=' + (a.rows && a.rows.length || 0));
  });
  if (!archMap.size) console.log('ORG SEED WARN: no unit Excel archives in live UserData');
}

try {
  main();
} catch (e) {
  console.error('stage-org-seed failed:', e && e.message ? e.message : e);
  process.exit(1);
}

// KM_SANITIZE_SHTATKA_ARCH_NAME_V1 — never re-emit legacy SHTATKA xlsx display name after staging from UserData
try {
  const { sanitizeRoots } = require('./sanitize-shtatka-arch-name.cjs');
  const _san = sanitizeRoots([
    path.join(__dirname, '..', 'app', 'data', 'unit_archives_seed'),
    path.join(__dirname, '..', 'payload', 'seed', 'org'),
    path.join(__dirname, '..', 'app', 'data'),
  ]);
  if (_san && _san.length) console.log('[stage-org-seed] sanitized shtatka arch name in', _san.length, 'files');
} catch (e) {
  console.warn('[stage-org-seed] sanitize-shtatka-arch-name skipped:', e && e.message ? e.message : e);
}

