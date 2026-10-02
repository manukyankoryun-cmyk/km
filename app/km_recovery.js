'use strict';
/**
 * KM — Super-Admin recovery passcode (per machine, UserData only).
 *
 * A random passcode is generated on first run and stored as a scrypt hash in
 * km_recovery.json. The plaintext is written once to KM_RECOVERY_CODE.txt in
 * the same UserData folder (never shipped in Setup). There is no universal
 * factory password in the application package.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LEGACY_FIXED_PASSCODES = Object.freeze([
  '98460813',
  '098460813',
  '199206',
  'Koryun1992.06'
]);

function recoveryFilePath(userRoot) {
  return path.join(userRoot, 'km_recovery.json');
}

function showFilePath(userRoot) {
  return path.join(userRoot, 'KM_RECOVERY_CODE.txt');
}

function scryptHash(passcode, saltHex) {
  return crypto.scryptSync(String(passcode), Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function generatePasscode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function writeRecoveryRecord(userRoot, passcode, log) {
  const file = recoveryFilePath(userRoot);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = scryptHash(passcode, salt);
  fs.mkdirSync(userRoot, { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify({
      salt,
      hash,
      random: true,
      createdAt: new Date().toISOString()
    }, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    showFilePath(userRoot),
    [
      'KM — super-admin վերականգնման կոդ',
      'Ստեղծված. ' + new Date().toISOString(),
      '',
      '  ' + passcode,
      '',
      'Այս կոդը թույլ է տալիս վերականգնել super-admin մուտքը, եթե',
      'մոռացել եք գաղտնաբառը։ Պահեք միայն այս համակարգչի UserData-ում։',
      'Տեղադրումից հետո փոխեք սովորական գաղտնաբառը։',
      ''
    ].join('\r\n'),
    'utf8'
  );
  if (typeof log === 'function') {
    log('[KM Recovery] New per-machine passcode written -> ' + showFilePath(userRoot));
  }
  return { created: true, rotated: true, passcode };
}

function readRecoveryData(userRoot) {
  try {
    const file = recoveryFilePath(userRoot);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || !data.hash || !data.salt) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function hashMatchesPasscode(data, passcode) {
  if (!data || !data.hash || !data.salt) return false;
  try {
    const got = Buffer.from(scryptHash(passcode, data.salt), 'hex');
    const want = Buffer.from(String(data.hash), 'hex');
    if (got.length !== want.length) return false;
    return crypto.timingSafeEqual(got, want);
  } catch (_) {
    return false;
  }
}

function isLegacyFixedRecord(userRoot, data) {
  if (!data) return true;
  if (data.random === true) return false;
  return LEGACY_FIXED_PASSCODES.some((p) => hashMatchesPasscode(data, p));
}

function persistPasscode(userRoot, log, forceNew) {
  const data = readRecoveryData(userRoot);
  if (!forceNew && data && !isLegacyFixedRecord(userRoot, data)) {
    return { created: false, rotated: false };
  }
  return writeRecoveryRecord(userRoot, generatePasscode(), log);
}

function ensureRecoveryPasscode(userRoot, log) {
  return persistPasscode(userRoot, log, false);
}

function rotateRecoveryPasscode(userRoot, log) {
  return persistPasscode(userRoot, log, true);
}

function checkRecoveryPasscode(userRoot, candidate) {
  const p = String(candidate || '').trim();
  if (!p) return false;
  const data = readRecoveryData(userRoot);
  if (!data) return false;
  return hashMatchesPasscode(data, p);
}

function isLegacyFactoryPassword(candidate) {
  const p = String(candidate || '');
  if (!p) return false;
  return LEGACY_FIXED_PASSCODES.some((known) => {
    const a = Buffer.from(p);
    const b = Buffer.from(known);
    if (a.length !== b.length) return false;
    try { return crypto.timingSafeEqual(a, b); } catch (_) { return p === known; }
  });
}

module.exports = {
  ensureRecoveryPasscode,
  rotateRecoveryPasscode,
  checkRecoveryPasscode,
  generatePasscode,
  isLegacyFactoryPassword,
  showFilePath
};
