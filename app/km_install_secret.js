'use strict';
/**
 * KM — per-installation local secret material.
 *
 * SECURITY FIX: km_guard.js (integrity), km_owner_vault.js (anti-clone
 * binding) and km_crypto_store.js (at-rest AES) previously derived their
 * HMAC/encryption keys ONLY from constants shipped in km_security_secrets.js
 * — identical in every installation and readable by anyone who unpacks the
 * app. That means:
 *   - a tampered km_integrity.json could be re-signed to look valid,
 *   - the owner-vault machine-binding seal could be forged,
 *   - locally "encrypted" JSON/knowledge.db files could be decrypted,
 * ...by anyone who simply has a copy of the application, without ever
 * touching the target machine.
 *
 * This module adds one more ingredient that is NOT shipped: a random
 * 32-byte secret generated the first time KM runs on a given machine and
 * stored only in that machine's UserData folder (km_install_secret.json —
 * gitignored, never bundled). Callers combine it with the existing shipped
 * constant (HMAC(shipped_key || install_secret)) so:
 *   - a plain copy of the app/source alone is no longer sufficient to forge
 *     a valid signature or decrypt local data for a specific installation —
 *     the attacker also needs read access to THAT machine's UserData folder;
 *   - this does not (and cannot) protect against an attacker who already
 *     has full run of the exact same machine — no client-side scheme can —
 *     but it closes the much weaker "read the public source, done" attack.
 * If the secret file cannot be read/written for any reason, callers fall
 * back to the shipped-only key so the app still functions (degrades to the
 * previous behaviour rather than breaking).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let _cache = null; // { userRoot, secret }

function resolveDefaultUserRoot() {
  try {
    const base = process.env.LOCALAPPDATA || os.homedir() || '.';
    return path.join(base, 'KM', 'UserData');
  } catch (_) {
    return path.join('.', 'KM', 'UserData');
  }
}

function secretFilePath(userRoot) {
  return path.join(userRoot, 'km_install_secret.json');
}

/** Returns a 32-byte Buffer, generating + persisting it on first call for a
 *  given userRoot. Cached in-memory afterwards. Never throws. */
function ensureInstallSecret(userRoot) {
  const root = userRoot || resolveDefaultUserRoot();
  if (_cache && _cache.userRoot === root) return _cache.secret;

  const file = secretFilePath(root);
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data && /^[0-9a-f]{64}$/.test(String(data.secretHex))) {
        const secret = Buffer.from(data.secretHex, 'hex');
        _cache = { userRoot: root, secret };
        return secret;
      }
    }
  } catch (_) { /* fall through and (re)generate */ }

  const secret = crypto.randomBytes(32);
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ secretHex: secret.toString('hex'), createdAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (_) { /* best-effort only; still usable in-memory for this run */ }
  _cache = { userRoot: root, secret };
  return secret;
}

/** HMAC-SHA256(shippedKey || installSecret) — combines the shipped constant
 *  with the per-machine secret. Safe to call even if userRoot/install
 *  secret is unavailable (degrades to shipped-key-only via a zero secret). */
function deriveKey(shippedKey, userRoot) {
  let secret;
  try { secret = ensureInstallSecret(userRoot); } catch (_) { secret = Buffer.alloc(32); }
  return crypto.createHmac('sha256', String(shippedKey || ''))
    .update(secret)
    .digest();
}

module.exports = { ensureInstallSecret, deriveKey, resolveDefaultUserRoot };
