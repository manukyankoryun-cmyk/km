#!/usr/bin/env node
/**
 * Bulk-import external QA JSONL files into BotKnowledge (qa.jsonl + SQLite FTS5).
 *
 * Accepts prepared curriculum files (up to ~1,400,000 rows) without Gemini API.
 * Default merge is append-only with question-hash dedupe + incremental FTS.
 *
 * Usage:
 *   npm run bot:import
 *   npm run bot:import -- --dir "D:\datasets\curriculum25"
 *   npm run bot:import -- file1.jsonl file2.jsonl
 *   npm run bot:import -- --replace --reindex   (explicit wipe; prefer merge)
 *
 * Env:
 *   KM_TRAIN_OUT          UserData root (default %LOCALAPPDATA%\KM\UserData)
 *   KM_BULK_QA_DIR        Default scan directory (default app/data/bulk-import)
 *   KM_BOT_KNOWLEDGE_MAX  Max rows (default 1400000)
 */
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const { createBotKnowledge } = require(path.join(APP_DIR, 'km_bot_knowledge.js'));
const { CURRICULUM_25_DAYS, CURRICULUM_DOMAIN_COUNT } = require(path.join(APP_DIR, 'km_gemini_config.js'));

const ARGS = process.argv.slice(2);
const FLAG = new Set(ARGS.filter((a) => a.startsWith('--')));
const FILES = ARGS.filter((a) => !a.startsWith('--'));

function userRoot() {
  if (process.env.KM_TRAIN_OUT) return path.resolve(process.env.KM_TRAIN_OUT);
  const local = process.env.LOCALAPPDATA || process.env.HOME || process.cwd();
  return path.join(local, 'KM', 'UserData');
}

function defaultBulkDir() {
  if (process.env.KM_BULK_QA_DIR) return path.resolve(process.env.KM_BULK_QA_DIR);
  return path.join(APP_DIR, 'data', 'bulk-import');
}

function collectJsonlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.jsonl(\.gz)?$/i.test(e.name) || (e.name.endsWith('.json') && e.name.includes('qa'))) {
        out.push(full);
      }
    }
  };
  walk(dir);
  out.sort((a, b) => a.localeCompare(b, 'hy'));
  return out;
}

function inferDayFromName(filePath) {
  const base = path.basename(filePath);
  const m = base.match(/(?:day|օր)[-_]?(\d{1,2})/i) || base.match(/^(\d{1,2})[-_.]/);
  if (!m) return null;
  const day = Number(m[1]);
  return day >= 1 && day <= CURRICULUM_DOMAIN_COUNT ? day : null;
}

function parseDomain(entry) {
  const m = String(entry).match(/^(\d+)\.\s*(.+)$/);
  return m ? { day: Number(m[1]), domain: m[2].trim() } : { day: 0, domain: String(entry) };
}

async function enrichRowsFromFilename(filePath) {
  const day = inferDayFromName(filePath);
  if (!day) return null;
  const entry = CURRICULUM_25_DAYS[day - 1];
  const parsed = entry ? parseDomain(entry) : { day, domain: '' };
  return { day: parsed.day, domain: parsed.domain };
}

async function main() {
  const root = userRoot();
  const kb = createBotKnowledge(root, {
    log: (...a) => console.log('[BotKnowledge]', ...a)
  });
  const paths = kb.paths();
  const replace = FLAG.has('--replace');
  const merge = !replace || FLAG.has('--merge');
  const reindexOnly = FLAG.has('--reindex-only');
  const noReindex = FLAG.has('--no-reindex');
  const fullFts = FLAG.has('--full-fts');
  const appendOnly = !replace;

  let fileList = FILES.slice();
  const dirFlag = ARGS.find((a, i) => a === '--dir' && ARGS[i + 1]);
  if (dirFlag) {
    const idx = ARGS.indexOf('--dir');
    if (ARGS[idx + 1]) fileList = fileList.concat(collectJsonlFiles(path.resolve(ARGS[idx + 1])));
  }
  if (!fileList.length) fileList = collectJsonlFiles(defaultBulkDir());

  console.log('══════════════════════════════════════════════════');
  console.log(' KM BotKnowledge — Bulk JSONL Import');
  console.log('══════════════════════════════════════════════════');
  console.log('  UserData     :', root);
  console.log('  qa.jsonl     :', paths.qaPath);
  console.log('  max rows     :', process.env.KM_BOT_KNOWLEDGE_MAX || 1400000);
  console.log('  mode         :', replace ? 'replace' : 'append/merge + q-hash dedupe');
  console.log('  FTS          :', fullFts ? 'full rebuild' : 'incremental');
  console.log('  scan dir     :', defaultBulkDir());
  console.log('  files        :', fileList.length);
  fileList.slice(0, 12).forEach((f) => console.log('    ·', f));
  if (fileList.length > 12) console.log('    … +' + (fileList.length - 12) + ' more');
  console.log('──────────────────────────────────────────────────');

  const before = await kb.getStatus();
  console.log('  before       : jsonl=' + before.jsonlLines + ' sqlite=' + before.sqliteCount + ' mode=' + before.mode);

  if (reindexOnly) {
    console.log('  Reindex-only from existing qa.jsonl…');
    kb.invalidateCache();
    const r = await kb.rebuildFromJsonl();
    const after = await kb.getStatus();
    console.log('  result       :', JSON.stringify(r));
    console.log('  after        : jsonl=' + after.jsonlLines + ' indexed=' + after.indexed + ' mode=' + after.mode);
    return;
  }

  if (!fileList.length) {
    console.log('');
    console.log('No JSONL files found.');
    console.log('Place prepared files into:');
    console.log('  ' + defaultBulkDir());
    console.log('Expected names: qa.jsonl, day-01.jsonl … day-25.jsonl, curriculum-*.jsonl');
    console.log('');
    console.log('Supported row formats (one JSON object per line):');
    console.log('  {"q":"…","a":"…","day":1,"domain":"Մաթեմատիկա"}');
    console.log('  {"query":"…","snippet":"…"}  (legacy)');
    console.log('');
    if (before.jsonlLines > 0 && !noReindex) {
      console.log('Running incremental FTS sync on existing store…');
      const r = kb.syncFtsIncremental();
      console.log('  fts sync     :', JSON.stringify(r));
    }
    process.exitCode = fileList.length === 0 && before.jsonlLines === 0 ? 1 : 0;
    return;
  }

  void enrichRowsFromFilename;

  const t0 = Date.now();
  const result = await kb.importFromFiles(fileList, {
    merge,
    replace,
    appendOnly,
    skipJsonlAppend: FLAG.has('--skip-jsonl-append'),
    incrementalFts: !fullFts,
    onProgress: (p) => {
      process.stdout.write(
        '\r  progress: added=' +
          p.added +
          ' skipped=' +
          p.skipped +
          ' dupQ=' +
          (p.skippedDupQ || 0) +
          ' parsed=' +
          p.parsed +
          '   '
      );
    }
  });
  console.log('');

  let reindex = null;
  if (!noReindex && fullFts) {
    console.log('  Full reindex from qa.jsonl…');
    kb.invalidateCache();
    reindex = await kb.rebuildFromJsonl();
  } else if (!noReindex) {
    reindex = kb.syncFtsIncremental();
  }

  const after = await kb.getStatus();
  const sec = Math.round((Date.now() - t0) / 1000);
  console.log('──────────────────────────────────────────────────');
  console.log('DONE import (' + sec + 's).');
  console.log('  import       :', JSON.stringify(result));
  if (reindex) console.log('  fts/reindex  :', JSON.stringify(reindex));
  console.log(
    '  after        : jsonl=' +
      after.jsonlLines +
      ' sqlite=' +
      after.sqliteCount +
      ' mode=' +
      after.mode +
      ' fts=' +
      after.fts
  );
  console.log('Restart KM desktop to reload BotKnowledge.');
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
