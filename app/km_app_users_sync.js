/**
 * Parse / merge km_app_users.json (plaintext or KMJS1 encrypted).
 * Union of users so LAN last-write-wins cannot drop a just-registered account.
 */
'use strict';

const fsp = require('fs').promises;
const cryptoStore = require('./km_crypto_store.js');

function displayUsername(s) {
  try { return String(s || '').normalize('NFC').trim().replace(/\s+/g, ' '); }
  catch { return String(s || '').trim().replace(/\s+/g, ' '); }
}
function usernameKey(s) {
  try { return displayUsername(s).toLocaleLowerCase('hy-AM'); }
  catch { return displayUsername(s).toLowerCase(); }
}
function userKey(u) {
  if (!u || typeof u !== 'object') return '';
  return usernameKey(u.usernameKey || u.username);
}

function parseAppUsersBuffer(buf) {
  if (!buf || !buf.length) return null;
  try {
    let text;
    const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (cryptoStore.isEncryptedJson(raw)) {
      const body = raw.slice(5);
      let dec = null;
      try { dec = cryptoStore.decryptBuffer(body, cryptoStore.fileKey('km_app_users.json')); } catch (_) {}
      if (!dec && typeof cryptoStore.fileKeyLegacy === 'function') {
        try { dec = cryptoStore.decryptBuffer(body, cryptoStore.fileKeyLegacy('km_app_users.json')); } catch (_) {}
      }
      if (!dec) return null;
      text = dec.toString('utf8');
    } else {
      text = raw.toString('utf8');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      if (text.charAt(0) !== '{' && text.charAt(0) !== '[') return null;
    }
    const j = JSON.parse(text);
    if (!j || typeof j !== 'object') return null;
    if (!Array.isArray(j.users)) j.users = [];
    if (!Array.isArray(j.admins)) j.admins = [];
    if (!Array.isArray(j.deletedUsers)) j.deletedUsers = [];
    if (!Array.isArray(j.purgedUsers)) j.purgedUsers = [];
    return j;
  } catch {
    return null;
  }
}

function mergeUser(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aPw = !!(a.passwordHash);
  const bPw = !!(b.passwordHash);
  let base = a;
  let other = b;
  if (bPw && !aPw) { base = b; other = a; }
  else if (aPw === bPw) {
    const at = Date.parse(a.lastLoginAt || a.updatedAt || a.createdAt || '') || 0;
    const bt = Date.parse(b.lastLoginAt || b.updatedAt || b.createdAt || '') || 0;
    if (bt > at) { base = b; other = a; }
  }
  const machines = Object.assign({}, other.machines || {}, base.machines || {});
  /* KM_MERGE_KEEP_SECTIONS_V1 + KM_GRANTS_CONFIRM_STAMP_V1:
     Admin Confirm stamps grantsUpdatedAt/grantsRevision — that side wins even if shorter.
     Empty peer still cannot wipe grants when the other side has any. */
  function grantStamp(u) {
    const rev = Number(u && u.grantsRevision) || 0;
    const ts = Date.parse((u && u.grantsUpdatedAt) || '') || 0;
    return { rev: rev, ts: ts };
  }
  function pickGrantDonor(a, b) {
    const sa = grantStamp(a);
    const sb = grantStamp(b);
    if (sb.rev > sa.rev) return b;
    if (sa.rev > sb.rev) return a;
    if (sb.ts > sa.ts) return b;
    if (sa.ts > sb.ts) return a;
    return null;
  }
  function pickSections(a, b) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    if (bb.length > aa.length) return bb.slice();
    if (aa.length > bb.length) return aa.slice();
    if (aa.length) return aa.slice();
    return bb.slice();
  }
  function pickMode(a, b, editLen, viewLen) {
    const order = { mixed: 3, edit: 2, view: 1, '': 0 };
    const am = String(a || '');
    const bm = String(b || '');
    let mode = (order[am] || 0) >= (order[bm] || 0) ? am : bm;
    if (editLen && viewLen) mode = 'mixed';
    else if (editLen && !mode) mode = 'edit';
    else if (viewLen && !mode) mode = 'view';
    return mode || '';
  }
  const donor = pickGrantDonor(base, other);
  let editSections;
  let viewSections;
  let pageAccessMode;
  let grantsUpdatedAt = base.grantsUpdatedAt || other.grantsUpdatedAt || null;
  let grantsRevision = Math.max(Number(base.grantsRevision) || 0, Number(other.grantsRevision) || 0) || undefined;
  if (donor) {
    editSections = Array.isArray(donor.editSections) ? donor.editSections.slice() : [];
    viewSections = Array.isArray(donor.viewSections) ? donor.viewSections.slice() : [];
    pageAccessMode = String(donor.pageAccessMode || '') || pickMode('', '', editSections.length, viewSections.length);
    grantsUpdatedAt = donor.grantsUpdatedAt || grantsUpdatedAt;
    grantsRevision = Number(donor.grantsRevision) || grantsRevision;
  } else {
    editSections = pickSections(base.editSections, other.editSections);
    viewSections = pickSections(base.viewSections, other.viewSections);
    pageAccessMode = pickMode(base.pageAccessMode, other.pageAccessMode, editSections.length, viewSections.length);
  }
  return Object.assign({}, other, base, {
    machines,
    editSections,
    viewSections,
    pageAccessMode,
    grantsUpdatedAt: grantsUpdatedAt || undefined,
    grantsRevision: grantsRevision || undefined,
    passwordHash: base.passwordHash || other.passwordHash || null,
    salt: (base.passwordHash ? base.salt : null) || other.salt || base.salt,
    codeSalt: base.codeSalt || other.codeSalt || null,
    codeHash: base.codeHash || other.codeHash || null,
    codeUsed: !!(base.codeUsed || other.codeUsed),
    active: base.active !== false && other.active !== false
  }); /* KM_CLIENT_LOGIN_SYNC_V1 PLAIN_WIRE keep hash+salt+codeSalt */
}

function mergeAdmins(aList, bList) {
  const map = new Map();
  function add(x) {
    if (!x || typeof x !== 'object') return;
    const k = usernameKey(x.username) || String(x.id || '');
    if (!k) return;
    map.set(k, map.has(k) ? Object.assign({}, map.get(k), x) : x);
  }
  (aList || []).forEach(add);
  (bList || []).forEach(add);
  return [...map.values()];
}

function emptyStore() {
  return { users: [], admins: [], deletedUsers: [], purgedUsers: [] };
}

function stampOf(u, keys) {
  const list = keys || [];
  for (let i = 0; i < list.length; i++) {
    const t = Date.parse((u && u[list[i]]) || '') || 0;
    if (t) return t;
  }
  return 0;
}

function purgeKey(u) {
  return userKey(u) || String((u && u.id) || '');
}

/** disk = existing file, incoming = this write / LAN payload */
function mergeAppUsersStores(disk, incoming) {
  const a = disk && typeof disk === 'object' ? disk : emptyStore();
  const b = incoming && typeof incoming === 'object' ? incoming : emptyStore();
  const del = new Map();
  function addDel(list) {
    (list || []).forEach((u) => {
      const k = userKey(u);
      if (k) del.set(k, Object.assign({}, u));
    });
  }
  addDel(a.deletedUsers);
  addDel(b.deletedUsers);

  const purged = new Map();
  function addPurged(list) {
    (list || []).forEach((u) => {
      if (!u || typeof u !== 'object') return;
      const k = purgeKey(u);
      if (!k) return;
      const next = Object.assign({}, u, { usernameKey: userKey(u) || k });
      const prev = purged.get(k);
      if (!prev || stampOf(next, ['purgedAt']) >= stampOf(prev, ['purgedAt'])) purged.set(k, next);
    });
  }
  addPurged(a.purgedUsers);
  addPurged(b.purgedUsers);

  const users = new Map();
  function addUser(u) {
    if (!u || typeof u !== 'object') return;
    const k = userKey(u);
    if (!k) return;
    users.set(k, users.has(k) ? mergeUser(users.get(k), u) : u);
  }
  (Array.isArray(a.users) ? a.users : []).forEach(addUser);
  (Array.isArray(b.users) ? b.users : []).forEach(addUser);

  const incomingUserKeys = new Set((Array.isArray(b.users) ? b.users : []).map(userKey).filter(Boolean));
  const incomingDelKeys = new Set((Array.isArray(b.deletedUsers) ? b.deletedUsers : []).map(userKey).filter(Boolean));
  incomingDelKeys.forEach((k) => {
    if (!incomingUserKeys.has(k)) users.delete(k);
  });

  users.forEach((u, k) => {
    const p = purged.get(k);
    if (!p) return;
    const rt = stampOf(u, ['restoredAt']);
    const pt = stampOf(p, ['purgedAt']);
    /* KM_USER_PURGE_FIX_V1: only explicit restore (restoredAt > purgedAt) un-purges.
       A live/LAN copy with older createdAt/lastLoginAt must NOT resurrect the user. */
    if (rt && pt && rt > pt) purged.delete(k);
    else users.delete(k);
  });
  users.forEach((_, k) => del.delete(k));
  purged.forEach((_, k) => del.delete(k));

  return {
    superAdminUsername: b.superAdminUsername || a.superAdminUsername || '',
    admins: mergeAdmins(a.admins, b.admins),
    users: [...users.values()],
    deletedUsers: [...del.values()],
    purgedUsers: [...purged.values()],
    updatedAt: new Date().toISOString()
  };
}

/** LAN wire: always plaintext JSON so peers can merge without matching file keys. */
function toPlainUsersBuffer(buf) {
  if (!buf || !buf.length) return null;
  const parsed = parseAppUsersBuffer(buf);
  if (parsed) {
    try { return Buffer.from(JSON.stringify(parsed), 'utf8'); } catch (_) { return null; }
  }
  try {
    const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    let text = raw.toString('utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (text.charAt(0) === '{' || text.charAt(0) === '[') return Buffer.from(text, 'utf8');
  } catch (_) {}
  return null;
}

function storeFingerprint(s) {
  if (!s || typeof s !== 'object') return '';
  const users = (Array.isArray(s.users) ? s.users : []).map((u) => [
    userKey(u),
    (u && u.passwordHash) || '',
    Number(u && u.grantsRevision) || 0,
    (u && u.grantsUpdatedAt) || '',
    (Array.isArray(u && u.editSections) ? u.editSections : []).join(','),
    (Array.isArray(u && u.viewSections) ? u.viewSections : []).join(','),
    u && u.active === false ? 0 : 1
  ].join('|')).sort().join(';');
  const purged = (Array.isArray(s.purgedUsers) ? s.purgedUsers : []).map(purgeKey).filter(Boolean).sort().join(',');
  const deleted = (Array.isArray(s.deletedUsers) ? s.deletedUsers : []).map(userKey).filter(Boolean).sort().join(',');
  return users + '#p' + purged + '#d' + deleted + '#sa' + String(s.superAdminUsername || '');
}

async function installAppUsersBuffer(absPath, incomingBuf, existingBufOpt) {
  /* KM_USERS_PLAIN_WIRE_V1 */
  let liveBuf = null;
  try { liveBuf = await fsp.readFile(absPath); } catch { liveBuf = null; }
  const snap = parseAppUsersBuffer(existingBufOpt);
  const live = parseAppUsersBuffer(liveBuf);
  const rawIn = Buffer.isBuffer(incomingBuf) ? incomingBuf : (incomingBuf ? Buffer.from(incomingBuf) : null);
  const looksKmjs = !!(rawIn && rawIn.length >= 5 && rawIn.slice(0, 5).toString('utf8') === 'KMJS1');
  const incoming = parseAppUsersBuffer(incomingBuf);
  if (looksKmjs && !incoming) {
    return { ok: false, skipped: 'undecryptable-users', users: (live && live.users || []).length };
  }
  const incomingUsers = incoming && Array.isArray(incoming.users) ? incoming.users : [];
  const incomingPurged = incoming && Array.isArray(incoming.purgedUsers) ? incoming.purgedUsers : [];
  const existingUsers = []
    .concat(snap && Array.isArray(snap.users) ? snap.users : [])
    .concat(live && Array.isArray(live.users) ? live.users : []);
  if (!incomingUsers.length && !incomingPurged.length) {
    if (existingUsers.length) {
      return { ok: true, skipped: 'empty-users', users: existingUsers.length };
    }
    return { ok: true, skipped: 'empty-users-noop', users: 0 };
  }
  if (!incoming && existingUsers.length) {
    return { ok: true, skipped: 'unreadable-incoming', users: existingUsers.length };
  }
  if (!incoming && !existingUsers.length) {
    return { ok: false, skipped: 'unreadable-incoming', users: 0 };
  }
  const base = mergeAppUsersStores(snap || emptyStore(), live || emptyStore());
  const merged = mergeAppUsersStores(base, incoming || emptyStore());
  if (storeFingerprint(live) === storeFingerprint(merged)) {
    return { ok: true, skipped: 'unchanged', users: merged.users.length };
  }
  await cryptoStore.writeJsonSecure(absPath, merged, 'km_app_users.json');
  return { ok: true, merged: true, users: merged.users.length, userNames: (merged.users||[]).map(function(u){return (u&& (u.username||u.user||u.name)||'');}).filter(Boolean) }; /* KM_USERS_NAMES_ON_MERGE_V1 */
}


module.exports = {
  displayUsername,
  usernameKey,
  userKey,
  parseAppUsersBuffer,
  mergeAppUsersStores,
  mergeUser,
  toPlainUsersBuffer,
  storeFingerprint,
  installAppUsersBuffer
};
