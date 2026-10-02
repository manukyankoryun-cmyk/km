/**
 * Persistent Node worker for knowledge.db when Electron lacks node:sqlite
 * (Electron 22 / Node 16). Protocol: one JSON line per request/response on stdio.
 *
 * Request:  { id, op: 'get'|'all'|'exec'|'ping'|'close', sql?, params? }
 * Response: { id, ok, row?|rows?|error? }
 */
'use strict';

const path = require('path');
const readline = require('readline');

let db = null;

function fail(id, err) {
  process.stdout.write(JSON.stringify({ id: id || 0, ok: false, error: String(err || 'error') }) + '\n');
}

function capSelectSql(sql) {
  const s = String(sql || '');
  if (!/^\s*SELECT\b/i.test(s)) return s;
  if (/\bLIMIT\b/i.test(s)) return s;
  if (/\bCOUNT\s*\(/i.test(s)) return s;
  return s.replace(/;?\s*$/, '') + ' LIMIT 64';
}

function closeAndExit(code) {
  try {
    if (db) db.close();
  } catch (_) {}
  db = null;
  process.exit(code == null ? 0 : code);
}

function ok(id, extra) {
  process.stdout.write(JSON.stringify(Object.assign({ id: id || 0, ok: true }, extra || {})) + '\n');
}

try {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = String(process.argv[2] || '').trim();
  if (!dbPath) {
    fail(0, 'missing_db_path');
    process.exit(1);
  }
  db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout = 120000;');
  } catch (_) {}
  try {
    db.exec('PRAGMA journal_mode = WAL;');
  } catch (_) {}
  try {
    db.exec('PRAGMA synchronous = NORMAL;');
  } catch (_) {}
  try {
    db.exec('PRAGMA query_only = ON;');
  } catch (_) {}
  try {
    db.exec('PRAGMA temp_store = MEMORY;');
  } catch (_) {}
  try {
    db.exec('PRAGMA cache_size = -8192;');
  } catch (_) {}
  ok(0, { ready: true, engine: 'node:sqlite', dbPath });
} catch (e) {
  fail(0, 'worker_open_fail: ' + (e && e.message));
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  let req;
  try {
    req = JSON.parse(String(line || '').trim() || '{}');
  } catch (e) {
    fail(0, 'bad_json');
    return;
  }
  const id = req.id || 0;
  const op = String(req.op || '');
  try {
    if (op === 'ping') {
      ok(id, { pong: true });
      return;
    }
    if (op === 'close') {
      ok(id, { closed: true });
      closeAndExit(0);
      return;
    }
    if (!db) {
      fail(id, 'db_closed');
      return;
    }
    if (op === 'exec') {
      db.exec(String(req.sql || ''));
      ok(id, {});
      return;
    }
    if (op === 'get') {
      const stmt = db.prepare(capSelectSql(req.sql));
      const params = Array.isArray(req.params) ? req.params : [];
      const row = stmt.get(...params);
      ok(id, { row: row == null ? null : row });
      return;
    }
    if (op === 'all') {
      const stmt = db.prepare(capSelectSql(req.sql));
      const params = Array.isArray(req.params) ? req.params : [];
      const rows = stmt.all(...params);
      ok(id, { rows: rows || [] });
      return;
    }
    fail(id, 'unknown_op');
  } catch (e) {
    fail(id, e && e.message);
  }
});

process.on('disconnect', () => closeAndExit(0));
process.on('SIGTERM', () => closeAndExit(0));
process.on('SIGINT', () => closeAndExit(0));
