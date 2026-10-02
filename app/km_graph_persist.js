/**
 * KM_HUB_ALL_PERSIST_V1 (extends KM_HUB_GRAPH_PERSIST_V1)
 * Permanent Hub merge for ALL user-edited unit/corps data + related files.
 * Empty/stale client pushes cannot wipe Hub copies; unit_graph_data + snapshot survive reinstall.
 */
'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const GRAPH_SLICE_KEYS = [
  'people', 'schedule', 'userPositions', 'positionAssignments', 'positionArchives', 'peopleRemoved',
  'vacations', 'tables', 'spreadsheets', 'registrations', 'notebookNotes', 'archives',
  'futureSchedules', 'dutyTypes', 'dutyTypeSchedules', 'dutyPosts',
  'units', 'cellComments', 'substitutions', 'dutyRankRules', 'dutyGraphTemplates', 'scheduleTemplates',
  'printPresets', 'orderDraft', 'troopStructure',
  'disciplinePenalties', 'disciplinePenaltiesArchive', 'personCharacteristics',
  'personEncouragements', 'monthSummaries',
  'unitDocs', 'unitInventory', 'unitCharDrafts', 'unitFuel', 'unitDayPlans', 'unitMedical',
  'unitLeavePlan', 'unitBlanks', 'unitDossiers', 'unitFormation', 'unitTermWatch',
  'trialExamDrafts', 'trialCharDrafts', 'trialMonitorDismissed',
  'formalTemplates', 'accounting', 'unitAccounting', 'cards', 'personCards'
];

/* Every user-content key: empty incoming must not wipe non-empty Hub/local */
const PROTECT_NONEMPTY_KEYS = {};
GRAPH_SLICE_KEYS.forEach((k) => { PROTECT_NONEMPTY_KEYS[k] = 1; });

const MAP_MERGE_KEYS = {
  unitDossiers: 1,
  userPositions: 1,
  positionAssignments: 1,
  positionArchives: 1,
  vacations: 1,
  tables: 1,
  spreadsheets: 1,
  registrations: 1,
  notebookNotes: 1,
  archives: 1,
  futureSchedules: 1,
  dutyPosts: 1,
  cellComments: 1,
  substitutions: 1,
  dutyRankRules: 1,
  dutyGraphTemplates: 1,
  scheduleTemplates: 1,
  printPresets: 1,
  troopStructure: 1,
  disciplinePenalties: 1,
  disciplinePenaltiesArchive: 1,
  personCharacteristics: 1,
  personEncouragements: 1,
  monthSummaries: 1,
  unitDocs: 1,
  unitInventory: 1,
  unitCharDrafts: 1,
  unitFuel: 1,
  unitDayPlans: 1,
  unitMedical: 1,
  unitLeavePlan: 1,
  unitBlanks: 1,
  unitFormation: 1,
  unitTermWatch: 1,
  trialExamDrafts: 1,
  trialCharDrafts: 1,
  formalTemplates: 1,
  accounting: 1,
  unitAccounting: 1,
  cards: 1,
  personCards: 1
};

let _chain = Promise.resolve();
function withLock(fn) {
  const next = _chain.then(fn, fn);
  _chain = next.then(() => {}, () => {});
  return next;
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isEmptyVal(v) {
  if (v == null) return true;
  if (typeof v === 'string') return !v.trim();
  if (Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) {
    const keys = Object.keys(v);
    if (!keys.length) return true;
    if (Object.prototype.hasOwnProperty.call(v, 'rows') || Object.prototype.hasOwnProperty.call(v, 'assignments')) {
      const rows = v.rows;
      const assignments = v.assignments;
      const formal = v.formalGraph;
      const hasRows = isPlainObject(rows) ? Object.keys(rows).length > 0 : (Array.isArray(rows) && rows.length > 0);
      const hasAssign = isPlainObject(assignments) ? Object.keys(assignments).length > 0 : false;
      const hasFormal = isPlainObject(formal) && Object.keys(formal).length > 0;
      if (!hasRows && !hasAssign && !hasFormal && !(Array.isArray(v.selectedPeople) && v.selectedPeople.length)) {
        return !hasRows && !hasAssign && !hasFormal;
      }
    }
    return false;
  }
  return false;
}

function cloneJson(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v; }
}

function personKey(p) {
  if (!p || typeof p !== 'object') return '';
  const id = String(p.id || p.personId || p.uid || '').trim();
  if (id) return 'id:' + id;
  const name = String(p.name || p.fullName || '').trim().toLowerCase();
  return name ? 'n:' + name : '';
}

function assignmentStamp(a) {
  if (!a || typeof a !== 'object') return 0;
  return Date.parse(a.updatedAt || a.clearedAt || a.editedAt || '') || 0;
}

function mergePeopleRemoved(existing, incoming) {
  const a = isPlainObject(existing) ? existing : {};
  const b = isPlainObject(incoming) ? incoming : {};
  return Object.assign({}, a, b);
}

function mergePeople(existing, incoming, removedMap) {
  const a = Array.isArray(existing) ? existing : [];
  const b = Array.isArray(incoming) ? incoming : [];
  if (!b.length && a.length) return cloneJson(a);
  if (!a.length) return cloneJson(b);
  const removed = isPlainObject(removedMap) ? removedMap : {};
  const map = new Map();
  a.forEach((p, i) => {
    const k = personKey(p) || ('idx:a' + i);
    map.set(k, cloneJson(p));
  });
  b.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const k = personKey(p) || ('idx:b' + i);
    const nk = String(p.name || p.fullName || '').trim().toLowerCase();
    if (nk && removed[nk] && !map.has(k)) return;
    const prev = map.get(k);
    if (!prev) { map.set(k, cloneJson(p)); return; }
    const out = Object.assign({}, prev, p);
    Object.keys(p).forEach((fk) => {
      if (isEmptyVal(p[fk]) && !isEmptyVal(prev[fk])) out[fk] = cloneJson(prev[fk]);
    });
    map.set(k, out);
  });
  Array.from(map.keys()).forEach((k) => {
    const p = map.get(k);
    const nk = String((p && (p.name || p.fullName)) || '').trim().toLowerCase();
    if (nk && removed[nk]) {
      const stillLocal = a.some((x) => String((x && (x.name || x.fullName)) || '').trim().toLowerCase() === nk);
      if (!stillLocal) map.delete(k);
    }
  });
  return Array.from(map.values());
}

function mergePositionAssignments(existing, incoming) {
  const a = isPlainObject(existing) ? existing : {};
  const b = isPlainObject(incoming) ? incoming : {};
  if (isEmptyVal(b) && !isEmptyVal(a)) return cloneJson(a);
  const out = Object.assign({}, a);
  Object.keys(b).forEach((id) => {
    const prev = a[id];
    const next = b[id];
    if (!next) return;
    if (!prev) { out[id] = cloneJson(next); return; }
    const pt = assignmentStamp(prev);
    const nt = assignmentStamp(next);
    if ((prev.vacant || prev.manual || prev.userEdited) && pt >= nt) {
      out[id] = cloneJson(prev);
      return;
    }
    if ((next.vacant || next.manual || next.userEdited) && nt >= pt) {
      out[id] = cloneJson(next);
      return;
    }
    out[id] = nt >= pt ? Object.assign({}, prev, next) : Object.assign({}, next, prev);
  });
  return out;
}

function mergeByIdArray(existing, incoming, opts) {
  opts = opts || {};
  const a = Array.isArray(existing) ? existing : [];
  const b = Array.isArray(incoming) ? incoming : [];
  if (!b.length && a.length) return cloneJson(a);
  if (!a.length) return cloneJson(b);
  const map = new Map();
  a.forEach((item, i) => {
    const id = item && item.id ? String(item.id) : ('a' + i);
    map.set(id, cloneJson(item));
  });
  b.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const id = item.id ? String(item.id) : ('b' + i);
    const prev = map.get(id);
    if (!prev) { map.set(id, cloneJson(item)); return; }
    if (opts.protectEdited && prev._shtatUserEdited && !item._shtatUserEdited) {
      map.set(id, prev);
      return;
    }
    if (opts.protectVacant && prev.vacant && prev.userEdited && !item.userEdited) {
      map.set(id, prev);
      return;
    }
    const out = Object.assign({}, prev, item);
    if (opts.protectEdited && prev._shtatUserEdited) {
      out.rows = prev.rows;
      out._shtatUserEdited = true;
    }
    if (opts.protectVacant && prev.vacant && prev.userEdited) {
      out.vacant = true;
      out.personName = prev.personName || '';
    }
    map.set(id, out);
  });
  return Array.from(map.values());
}

function mergeMapObjects(existing, incoming) {
  if (Array.isArray(existing) || Array.isArray(incoming)) {
    const a = Array.isArray(existing) ? existing : [];
    const b = Array.isArray(incoming) ? incoming : [];
    if (!b.length && a.length) return cloneJson(a);
    if (!a.length) return cloneJson(b);
    if ((a[0] && a[0].id) || (b[0] && b[0].id)) return mergeByIdArray(a, b);
    return cloneJson(b);
  }
  const a = isPlainObject(existing) ? existing : {};
  const b = isPlainObject(incoming) ? incoming : {};
  if (isEmptyVal(b) && !isEmptyVal(a)) return cloneJson(a);
  const out = Object.assign({}, a);
  Object.keys(b).forEach((k) => {
    const prev = a[k];
    const next = b[k];
    if (isEmptyVal(next) && !isEmptyVal(prev)) {
      out[k] = cloneJson(prev);
      return;
    }
    if (isPlainObject(prev) && isPlainObject(next)) {
      const merged = Object.assign({}, prev, next);
      Object.keys(next).forEach((fk) => {
        if (isEmptyVal(next[fk]) && !isEmptyVal(prev[fk])) merged[fk] = cloneJson(prev[fk]);
      });
      out[k] = merged;
    } else {
      out[k] = cloneJson(next);
    }
  });
  return out;
}

function mergeSchedule(existing, incoming) {
  const a = isPlainObject(existing) ? existing : {};
  const b = isPlainObject(incoming) ? incoming : {};
  if (isEmptyVal(b) && !isEmptyVal(a)) return cloneJson(a);
  if (isEmptyVal(a)) return cloneJson(b);
  const out = Object.assign({}, a, b);
  if (isEmptyVal(b.formalGraph) && !isEmptyVal(a.formalGraph)) out.formalGraph = cloneJson(a.formalGraph);
  if (isEmptyVal(b.rows) && !isEmptyVal(a.rows)) out.rows = cloneJson(a.rows);
  if (isEmptyVal(b.selectedPeople) && !isEmptyVal(a.selectedPeople)) out.selectedPeople = cloneJson(a.selectedPeople);
  if (isEmptyVal(b.assignments) && !isEmptyVal(a.assignments)) out.assignments = cloneJson(a.assignments);
  return out;
}

function mergeDutyTypeSchedules(existing, incoming) {
  const a = isPlainObject(existing) ? existing : {};
  const b = isPlainObject(incoming) ? incoming : {};
  if (isEmptyVal(b) && !isEmptyVal(a)) return cloneJson(a);
  const out = Object.assign({}, a);
  Object.keys(b).forEach((k) => {
    const prev = a[k];
    const next = b[k];
    if (isEmptyVal(next) && !isEmptyVal(prev)) {
      out[k] = cloneJson(prev);
      return;
    }
    if (isPlainObject(prev) && isPlainObject(next)) {
      out[k] = mergeSchedule(prev, next);
    } else {
      out[k] = cloneJson(next);
    }
  });
  return out;
}

function mergeGraphSlice(existing, incoming) {
  const a = isPlainObject(existing) ? existing : {};
  const b = isPlainObject(incoming) ? incoming : {};
  if (!Object.keys(b).length) return cloneJson(a);
  const out = Object.assign({}, a);
  const keys = new Set(Object.keys(a).concat(Object.keys(b)).concat(GRAPH_SLICE_KEYS));
  keys.forEach((k) => {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return;
    const prev = a[k];
    const next = b[k];
    if (k === 'schedule') {
      out[k] = mergeSchedule(prev, next);
      return;
    }
    if (k === 'dutyTypeSchedules') {
      out[k] = mergeDutyTypeSchedules(prev, next);
      return;
    }
    if (k === 'people') {
      out[k] = mergePeople(prev, next, mergePeopleRemoved(a.peopleRemoved, b.peopleRemoved));
      return;
    }
    if (k === 'peopleRemoved') {
      out[k] = mergePeopleRemoved(prev, next);
      return;
    }
    if (k === 'positionAssignments') {
      out[k] = mergePositionAssignments(prev, next);
      return;
    }
    if (k === 'userPositions') {
      out[k] = mergeByIdArray(Array.isArray(prev) ? prev : [], Array.isArray(next) ? next : [], { protectVacant: true });
      return;
    }
    if (k === 'positionArchives') {
      out[k] = mergeByIdArray(Array.isArray(prev) ? prev : [], Array.isArray(next) ? next : [], { protectEdited: true });
      return;
    }
    if (MAP_MERGE_KEYS[k]) {
      out[k] = mergeMapObjects(prev, next);
      return;
    }
    if (PROTECT_NONEMPTY_KEYS[k] && isEmptyVal(next) && !isEmptyVal(prev)) {
      out[k] = cloneJson(prev);
      return;
    }
    out[k] = cloneJson(next);
  });
  return out;
}

function mergeKmCorpsData(existingMap, incomingMap) {
  const a = isPlainObject(existingMap) ? existingMap : {};
  const b = isPlainObject(incomingMap) ? incomingMap : {};
  const out = Object.assign({}, a);
  Object.keys(b).forEach((sid) => {
    if (!sid) return;
    out[sid] = mergeGraphSlice(a[sid], b[sid]);
  });
  return out;
}

function parseJsonBuffer(buf) {
  let t = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  t = t.trim();
  if (!t || (t[0] !== '{' && t[0] !== '[')) return null;
  try { return JSON.parse(t); } catch (_) { return null; }
}

function sliceIdFromPayload(data) {
  if (!data || typeof data !== 'object') return '';
  const id = String(data._kmCorpsId || '').trim();
  if (id) return id;
  const cd = data.kmCorpsData;
  if (isPlainObject(cd)) {
    const keys = Object.keys(cd).filter((k) => k && k !== '_legacy' && k !== '_super');
    if (keys.length === 1) return keys[0];
  }
  return '';
}

function ensureIncomingSlice(data) {
  if (!data || typeof data !== 'object') return data;
  const sid = sliceIdFromPayload(data);
  if (!sid) return data;
  if (!isPlainObject(data.kmCorpsData)) data.kmCorpsData = {};
  if (!data.kmCorpsData[sid] || typeof data.kmCorpsData[sid] !== 'object') {
    const slice = {};
    GRAPH_SLICE_KEYS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(data, k)) slice[k] = data[k];
    });
    data.kmCorpsData[sid] = slice;
  } else {
    const sl = data.kmCorpsData[sid];
    GRAPH_SLICE_KEYS.forEach((k) => {
      if (!Object.prototype.hasOwnProperty.call(data, k)) return;
      if (isEmptyVal(data[k])) return;
      if (k === 'schedule') sl[k] = mergeSchedule(sl[k], data[k]);
      else if (k === 'dutyTypeSchedules') sl[k] = mergeDutyTypeSchedules(sl[k], data[k]);
      else if (k === 'people') sl[k] = mergePeople(sl[k], data[k], mergePeopleRemoved(sl.peopleRemoved, data.peopleRemoved));
      else if (k === 'peopleRemoved') sl[k] = mergePeopleRemoved(sl[k], data[k]);
      else if (k === 'positionAssignments') sl[k] = mergePositionAssignments(sl[k], data[k]);
      else if (MAP_MERGE_KEYS[k]) sl[k] = mergeMapObjects(sl[k], data[k]);
      else if (isEmptyVal(sl[k])) sl[k] = cloneJson(data[k]);
    });
  }
  data._kmCorpsId = sid;
  return data;
}

function mergeDatabaseSnapshot(existingSnap, incomingSnap) {
  const a = isPlainObject(existingSnap) ? existingSnap : {};
  const b = ensureIncomingSlice(isPlainObject(incomingSnap) ? cloneJson(incomingSnap) : {});
  const out = Object.assign({}, a);
  out.kmCorpsData = mergeKmCorpsData(a.kmCorpsData, b.kmCorpsData);
  if (b._kmCorpsMigrated) out._kmCorpsMigrated = b._kmCorpsMigrated;
  if (b._kmUnitSliceMigrated) out._kmUnitSliceMigrated = b._kmUnitSliceMigrated;
  if (b.kmOrg) out.kmOrg = b.kmOrg;
  if (b.version != null) out.version = b.version;
  GRAPH_SLICE_KEYS.forEach((k) => {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return;
    if (k === 'schedule') {
      out[k] = mergeSchedule(a[k], b[k]);
      return;
    }
    if (k === 'dutyTypeSchedules') {
      out[k] = mergeDutyTypeSchedules(a[k], b[k]);
      return;
    }
    if (k === 'people') {
      out[k] = mergePeople(a[k], b[k], mergePeopleRemoved(a.peopleRemoved, b.peopleRemoved));
      return;
    }
    if (k === 'peopleRemoved') {
      out[k] = mergePeopleRemoved(a[k], b[k]);
      return;
    }
    if (k === 'positionAssignments') {
      out[k] = mergePositionAssignments(a[k], b[k]);
      return;
    }
    if (k === 'userPositions') {
      out[k] = mergeByIdArray(Array.isArray(a[k]) ? a[k] : [], Array.isArray(b[k]) ? b[k] : [], { protectVacant: true });
      return;
    }
    if (k === 'positionArchives') {
      out[k] = mergeByIdArray(Array.isArray(a[k]) ? a[k] : [], Array.isArray(b[k]) ? b[k] : [], { protectEdited: true });
      return;
    }
    if (MAP_MERGE_KEYS[k]) {
      out[k] = mergeMapObjects(a[k], b[k]);
      return;
    }
    if (PROTECT_NONEMPTY_KEYS[k] && isEmptyVal(b[k]) && !isEmptyVal(a[k])) return;
    out[k] = cloneJson(b[k]);
  });
  const aAt = Date.parse(a.kmSavedAt || '') || 0;
  const bAt = Date.parse(b.kmSavedAt || '') || 0;
  out.kmSavedAt = bAt >= aAt ? (b.kmSavedAt || a.kmSavedAt || new Date().toISOString()) : (a.kmSavedAt || b.kmSavedAt || new Date().toISOString());
  if (b._kmCorpsId) out._kmCorpsId = b._kmCorpsId;
  return out;
}

function unitGraphRoot(userRoot) {
  return path.join(userRoot, 'unit_graph_data');
}

function sliceFileName(sliceId) {
  return String(sliceId || '')
    .replace(/::/g, '__')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 180) + '.json';
}

async function readJsonFile(p, def) {
  try {
    let t = await fsp.readFile(p, 'utf8');
    if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
    return JSON.parse(t);
  } catch (_) {
    return def;
  }
}

async function writeJsonAtomic(p, obj) { /* KM_SNAP_RENAME_RETRY_V1 */
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const json = JSON.stringify(obj);
  const tmp = p + '.tmp';
  await fsp.writeFile(tmp, json, 'utf8');
  let last = null;
  for (let i = 0; i < 8; i++) {
    try { await fsp.rename(tmp, p); return; }
    catch (e) {
      last = e;
      const code = String((e && e.code) || '');
      if (code !== 'EPERM' && code !== 'EACCES' && code !== 'EBUSY') throw e;
      await new Promise((r) => setTimeout(r, 40 + i * 40));
      try { await fsp.unlink(p); } catch (_) {}
    }
  }
  try { await fsp.copyFile(tmp, p); try { await fsp.unlink(tmp); } catch (_) {} }
  catch (e2) { throw last || e2; }
}

async function persistUnitGraphFiles(userRoot, corpsData) {
  const root = unitGraphRoot(userRoot);
  await fsp.mkdir(root, { recursive: true });
  const idxPath = path.join(root, 'index.json');
  const idx = (await readJsonFile(idxPath, {})) || {};
  const map = isPlainObject(corpsData) ? corpsData : {};
  const ids = Object.keys(map);
  for (let i = 0; i < ids.length; i++) {
    const sid = ids[i];
    if (!sid || sid === '_legacy') continue;
    const fname = sliceFileName(sid);
    const slice = map[sid] || {};
    const rec = {
      id: sid,
      file: fname,
      savedAt: new Date().toISOString(),
      dutyTypes: Array.isArray(slice.dutyTypes) ? slice.dutyTypes.length : 0,
      people: Array.isArray(slice.people) ? slice.people.length : 0,
      dossiers: isPlainObject(slice.unitDossiers) ? Object.keys(slice.unitDossiers).length : 0,
      hasFormal: !!(slice.schedule && slice.schedule.formalGraph)
    };
    await writeJsonAtomic(path.join(root, fname), {
      id: sid,
      savedAt: rec.savedAt,
      slice: slice
    });
    idx[sid] = rec;
  }
  await writeJsonAtomic(idxPath, idx);
  return { ok: true, count: ids.length };
}

async function installGraphPayload(userRoot, plainBuf, opts) {
  opts = opts || {};
  const SNAP_MERGE_MAX = 2 * 1024 * 1024;
  if (plainBuf && plainBuf.length > SNAP_MERGE_MAX) {
    return { ok: true, skipped: true, reason: 'too_large' };
  }
  return withLock(async () => {
    const incoming0 = parseJsonBuffer(plainBuf);
    if (!incoming0 || typeof incoming0 !== 'object') {
      return { ok: false, error: 'bad_json' };
    }
    let incoming = incoming0;
    /* In-lock unwrap — recursive installGraphPayload deadlocked Hub on unit_graph push */
    if (incoming.slice && incoming.id && !incoming.kmCorpsData && !incoming.people && !incoming.schedule) {
      incoming = { _kmCorpsId: incoming.id, kmCorpsData: {} };
      incoming.kmCorpsData[incoming0.id] = incoming0.slice;
    }
    ensureIncomingSlice(incoming);
    let files = null;
    try {
      files = await persistUnitGraphFiles(userRoot, incoming.kmCorpsData);
    } catch (e) {
      files = { ok: false, error: String((e && e.message) || e) };
    }
    const snapPath = path.join(userRoot, 'database_snapshot.json');
    let snapSize = 0;
    try { snapSize = (await fsp.stat(snapPath)).size; } catch (_) {}
    if (opts.sliceOnly || opts.skipSnapshot || snapSize > SNAP_MERGE_MAX) {
      return {
        ok: true,
        merged: false,
        sliceOnly: true,
        slices: incoming.kmCorpsData ? Object.keys(incoming.kmCorpsData).length : 0,
        sliceId: sliceIdFromPayload(incoming) || '',
        unitGraph: files,
        source: opts.source || 'push'
      };
    }
    const existing = (await readJsonFile(snapPath, {})) || {};
    const merged = mergeDatabaseSnapshot(existing, incoming);
    await writeJsonAtomic(snapPath, merged);
    return {
      ok: true,
      merged: true,
      slices: merged.kmCorpsData ? Object.keys(merged.kmCorpsData).length : 0,
      sliceId: sliceIdFromPayload(incoming) || '',
      kmSavedAt: merged.kmSavedAt || '',
      unitGraph: files,
      source: opts.source || 'push'
    };
  });
}

/** Merge one unit_archives/*.json push: empty cannot wipe non-empty archive body */
async function installUnitArchiveFile(absPath, plainBuf) {
  return withLock(async () => {
    const incoming = parseJsonBuffer(plainBuf);
    if (!incoming || typeof incoming !== 'object') return { ok: false, error: 'bad_json' };
    const existing = (await readJsonFile(absPath, null)) || null;
    if (!existing) {
      await fsp.mkdir(path.dirname(absPath), { recursive: true });
      await writeJsonAtomic(absPath, incoming);
      return { ok: true, merged: false, wrote: true };
    }
    const aEmpty = isEmptyVal(existing.base64) && isEmptyVal(existing.rows) && isEmptyVal(existing.data);
    const bEmpty = isEmptyVal(incoming.base64) && isEmptyVal(incoming.rows) && isEmptyVal(incoming.data);
    if (bEmpty && !aEmpty) {
      return { ok: true, merged: true, keptExisting: true };
    }
    const out = Object.assign({}, existing, incoming);
    if (isEmptyVal(incoming.base64) && !isEmptyVal(existing.base64)) out.base64 = existing.base64;
    if (isEmptyVal(incoming.rows) && !isEmptyVal(existing.rows)) out.rows = existing.rows;
    if (isEmptyVal(incoming.data) && !isEmptyVal(existing.data)) out.data = existing.data;
    await writeJsonAtomic(absPath, out);
    return { ok: true, merged: true };
  });
}

async function recoverFromInboxKmSync(userRoot, inboxDir, log) {
  return withLock(async () => {
    let names = [];
    try { names = await fsp.readdir(inboxDir); } catch (_) { return { ok: true, recovered: 0 }; }
    const syncs = names.filter((n) => /KM_SYNC\.json$/i.test(n));
    if (!syncs.length) return { ok: true, recovered: 0 };
    const snapPath = path.join(userRoot, 'database_snapshot.json');
    let snap = (await readJsonFile(snapPath, {})) || {};
    let recovered = 0;
    const ordered = [];
    for (const n of syncs) {
      const p = path.join(inboxDir, n);
      try {
        const st = await fsp.stat(p);
        ordered.push({ p, mtime: st.mtimeMs, n });
      } catch (_) {}
    }
    ordered.sort((a, b) => a.mtime - b.mtime);
    for (const it of ordered) {
      try {
        const buf = await fsp.readFile(it.p);
        const incoming = parseJsonBuffer(buf);
        if (!incoming) continue;
        ensureIncomingSlice(incoming);
        snap = mergeDatabaseSnapshot(snap, incoming);
        recovered++;
      } catch (e) {
        if (log) log('all-persist recover ' + it.n + ' ' + ((e && e.message) || e));
      }
    }
    if (recovered) {
      await writeJsonAtomic(snapPath, snap);
      try { await persistUnitGraphFiles(userRoot, snap.kmCorpsData); } catch (_) {}
    }
    return { ok: true, recovered, slices: snap.kmCorpsData ? Object.keys(snap.kmCorpsData).length : 0 };
  });
}

module.exports = {
  GRAPH_SLICE_KEYS,
  PROTECT_NONEMPTY_KEYS,
  mergeGraphSlice,
  mergeKmCorpsData,
  mergeDatabaseSnapshot,
  mergeSchedule,
  mergePeople,
  mergeMapObjects,
  isEmptyVal,
  ensureIncomingSlice,
  installGraphPayload,
  installUnitArchiveFile,
  persistUnitGraphFiles,
  recoverFromInboxKmSync,
  unitGraphRoot,
  withLock
};
