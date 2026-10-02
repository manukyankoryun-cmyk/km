#!/usr/bin/env node
/**
 * Generate ~700,000 NEW unique curriculum Q&A pairs (25 domains) offline,
 * append into existing BotKnowledge (~700k → ~1.4M total).
 *
 * APPEND-ONLY: existing qa.jsonl / knowledge.db are never wiped.
 * --fresh and --replace-store are blocked.
 *
 * Sources (hybrid):
 *   1) Algorithmic/template generation (curriculum-bulk-engine.cjs)
 *   2) Wikipedia open summaries (optional --wiki)
 * Dedup: skip questions whose normalized SHA-256 matches existing corpus.
 * FTS: incremental sync for new rows only.
 *
 * Usage (from app/):
 *   npm run generate:700k
 *   npm run generate:700k -- --target 700000 --batch 5000
 *   npm run generate:700k -- --target 10000 --wiki --resume
 *   npm run generate:700k -- --import-only
 *
 * Env:
 *   KM_BULK_TARGET       (default CURRICULUM_NEW_QA = 700000 new rows)
 *   KM_BULK_BATCH        (default 5000)
 *   KM_BOT_KNOWLEDGE_MAX (default 1400000)
 *   KM_TRAIN_OUT         UserData root
 */
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { fetchWikiBatch } from './lib/curriculum-wiki-source.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const { createBotKnowledge, questionHash } = require(path.join(APP_DIR, 'km_bot_knowledge.js'));
const {
  CURRICULUM_NEW_QA,
  CURRICULUM_TOTAL_QA,
  CURRICULUM_DOMAIN_COUNT,
  assertCurriculum25
} = require(path.join(APP_DIR, 'km_gemini_config.js'));
const {
  generateForDay,
  perDayTarget,
  parseDomain,
  CURRICULUM_25_DAYS
} = require(path.join(APP_DIR, 'scripts', 'lib', 'curriculum-bulk-engine.cjs'));
assertCurriculum25(CURRICULUM_25_DAYS);

const ARGS = process.argv.slice(2);
const FLAG = new Set(ARGS.filter((a) => a.startsWith('--')));

function argNum(name, def) {
  const i = ARGS.indexOf(name);
  if (i >= 0 && ARGS[i + 1] != null) {
    const n = Number(ARGS[i + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return def;
}

const TARGET = argNum(
  '--target',
  Number(process.env.KM_BULK_TARGET) || CURRICULUM_NEW_QA || 700000
);
const BATCH_SIZE = argNum('--batch', Number(process.env.KM_BULK_BATCH) || 5000);
const IMPORT_EVERY = argNum('--import-every', Number(process.env.KM_BULK_IMPORT_EVERY) || 10);
const RESUME = FLAG.has('--resume');
const USE_WIKI = FLAG.has('--wiki') || process.env.KM_BULK_WIKI === '1';
const IMPORT_ONLY = FLAG.has('--import-only');
const NO_IMPORT = FLAG.has('--no-import');
const DRY = FLAG.has('--dry-run');
const FRESH = FLAG.has('--fresh');
const REPLACE_STORE = FLAG.has('--replace-store');
const CLEAR_BATCHES = FLAG.has('--clear-batches');

if (FRESH || REPLACE_STORE) {
  console.error('');
  console.error('REFUSED: --fresh / --replace-store are blocked.');
  console.error('Knowledge Pipeline is APPEND-ONLY: existing qa.jsonl and knowledge.db must stay intact.');
  console.error('To clear only local generated/*.jsonl batches (not UserData), use --clear-batches.');
  console.error('');
  process.exit(2);
}

const OUT_DIR = path.join(APP_DIR, 'data', 'bulk-import', 'generated');
const PROGRESS_PATH = path.join(OUT_DIR, '.gen-progress.json');

function userRoot() {
  if (process.env.KM_TRAIN_OUT) return path.resolve(process.env.KM_TRAIN_OUT);
  const local = process.env.LOCALAPPDATA || process.env.HOME || process.cwd();
  return path.join(local, 'KM', 'UserData');
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  } catch (_) {
    return {
      target: TARGET,
      corpusTarget: CURRICULUM_TOTAL_QA,
      totalGenerated: 0,
      day: 1,
      dayGenerated: 0,
      batchNo: 0,
      seq: 0,
      files: [],
      skippedDup: 0
    };
  }
}

function saveProgress(p) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  p.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(p, null, 2), 'utf8');
}

function writeBatchFile(day, batchNo, rows) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const name =
    'day-' +
    String(day).padStart(2, '0') +
    '-batch-' +
    String(batchNo).padStart(5, '0') +
    '.jsonl';
  const fp = path.join(OUT_DIR, name);
  fs.writeFileSync(fp, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  return fp;
}

function collectGeneratedFiles() {
  if (!fs.existsSync(OUT_DIR)) return [];
  /* Newest days first — unfinished later-day batches import sooner after resume. */
  return fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(OUT_DIR, f))
    .sort()
    .reverse();
}

function filterUniqueRows(rows, seenQ) {
  const out = [];
  let skipped = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r.q) {
      skipped++;
      continue;
    }
    const h = questionHash(r.q);
    if (seenQ.has(h)) {
      skipped++;
      continue;
    }
    seenQ.add(h);
    out.push(r);
  }
  return { rows: out, skipped };
}

async function importFiles(kb, files) {
  if (!files.length) return null;
  kb.invalidateCache();
  return kb.importFromFiles(files, {
    merge: true,
    replace: false,
    appendOnly: true,
    incrementalFts: true
  });
}

async function generatePhase(progress, seenQ) {
  const quotas = perDayTarget(progress.target || TARGET);
  let batchNo = progress.batchNo || 0;
  let total = progress.totalGenerated || 0;
  let skippedDup = progress.skippedDup || 0;
  let filesSinceImport = 0;
  const newFiles = [];
  const domainCount = CURRICULUM_DOMAIN_COUNT;

  console.log('  New QA target:', progress.target);
  console.log('  Corpus final :', CURRICULUM_TOTAL_QA);
  console.log('  Domains      :', domainCount);
  console.log('  Existing q#  :', seenQ.size);
  console.log('  Resume day   :', progress.day, 'generated:', progress.dayGenerated);
  console.log('  Batch size   :', BATCH_SIZE);
  console.log('  Wiki enrich  :', USE_WIKI);

  for (let day = progress.day || 1; day <= domainCount; day++) {
    const entry = CURRICULUM_25_DAYS[day - 1];
    const { domain } = parseDomain(entry);
    const quota = quotas[day];
    let done = day === progress.day ? progress.dayGenerated || 0 : 0;
    let seq = day === progress.day ? progress.seq || 0 : day * 1000000 + 500000;

    console.log('\n── Day ' + day + '/' + domainCount + ' · «' + domain + '» · quota ' + quota + ' ──');

    let emptyStreak = 0;
    while (done < quota && total < progress.target) {
      const need = Math.min(BATCH_SIZE, quota - done, progress.target - total);
      /* over-generate to compensate for dedupe skips */
      const ask = Math.min(need * 3, need + 2000);
      const gen = generateForDay(day, seq, ask);
      let rows = gen.rows;
      seq = gen.nextSeq;

      if (USE_WIKI && rows.length < need) {
        try {
          const wikiRows = await fetchWikiBatch(
            day,
            domain,
            Math.min(50, need - rows.length),
            path.dirname(OUT_DIR)
          );
          rows = rows.concat(wikiRows);
        } catch (eW) {
          console.log('  wiki skip:', String(eW.message || eW).slice(0, 80));
        }
      }

      const filtered = filterUniqueRows(rows, seenQ);
      skippedDup += filtered.skipped;
      rows = filtered.rows.slice(0, need);

      if (DRY) rows = rows.slice(0, Math.min(20, rows.length));
      if (!rows.length) {
        emptyStreak++;
        console.log('  WARN: empty unique batch at seq', seq, '(streak', emptyStreak + ')');
        seq += Math.max(BATCH_SIZE, 10000) + emptyStreak * 1000;
        if (emptyStreak > 80) {
          console.log('  STOP day: too many empty unique batches — advancing');
          break;
        }
        continue;
      }
      emptyStreak = 0;

      batchNo++;
      const fp = writeBatchFile(day, batchNo, rows);
      newFiles.push(fp);
      filesSinceImport++;
      done += rows.length;
      total += rows.length;

      progress.day = day;
      progress.dayGenerated = done;
      progress.batchNo = batchNo;
      progress.seq = seq;
      progress.totalGenerated = total;
      progress.skippedDup = skippedDup;
      progress.files = (progress.files || []).concat([fp]);
      saveProgress(progress);

      console.log(
        '  batch ' +
          batchNo +
          ' · +' +
          rows.length +
          ' · day ' +
          done +
          '/' +
          quota +
          ' · total ' +
          total +
          '/' +
          progress.target +
          ' · dup-skip ' +
          skippedDup +
          ' · ' +
          path.basename(fp)
      );

      if (DRY) break;
    }

    if (DRY) break;
    progress.day = day + 1;
    progress.dayGenerated = 0;
    progress.seq = (day + 1) * 1000000 + 500000;
    saveProgress(progress);
  }

  return { total, newFiles, filesSinceImport, batchNo, skippedDup };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (CLEAR_BATCHES && !RESUME && !IMPORT_ONLY) {
    try {
      const old = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.jsonl'));
      old.forEach((f) => fs.unlinkSync(path.join(OUT_DIR, f)));
      console.log('  Cleared', old.length, 'local generated batch files (UserData untouched)');
    } catch (_) {}
  }

  const root = userRoot();
  const kb = createBotKnowledge(root, {
    log: (...a) => console.log('[BotKnowledge]', ...a)
  });

  console.log('══════════════════════════════════════════════════');
  console.log(' KM Curriculum Bulk Generator → BotKnowledge');
  console.log('  mode         : APPEND-ONLY (+ dedupe + incremental FTS)');
  console.log('══════════════════════════════════════════════════');
  console.log('  Output dir   :', OUT_DIR);
  console.log('  UserData     :', root);
  console.log('  New target   :', TARGET);
  console.log('  Final corpus :', CURRICULUM_TOTAL_QA);

  const statusBefore = await kb.getStatus();
  console.log(
    '  before       : jsonl=' +
      statusBefore.jsonlLines +
      ' sqlite=' +
      statusBefore.sqliteCount +
      ' mode=' +
      statusBefore.mode
  );

  const seenQ = new Set();
  if (!IMPORT_ONLY) {
    console.log('  Loading existing question hashes for dedupe…');
    try {
      if (typeof process.stdout?.write === 'function') process.stdout.write('');
    } catch (_) {}
    const dedupe = kb.loadDedupeSets();
    const loaded = dedupe.qHashes || new Set();
    loaded.forEach((h) => seenQ.add(h));
    console.log('  existing q#  :', seenQ.size);

    /* Also seed hashes from already-generated batches (resume-safe). */
    try {
      const existingFiles = collectGeneratedFiles();
      let fromFiles = 0;
      for (let i = 0; i < existingFiles.length; i++) {
        const raw = fs.readFileSync(existingFiles[i], 'utf8').split(/\r?\n/);
        for (let j = 0; j < raw.length; j++) {
          const ln = raw[j].trim();
          if (!ln) continue;
          try {
            const row = JSON.parse(ln);
            if (row && row.q) {
              const h = questionHash(row.q);
              if (!seenQ.has(h)) {
                seenQ.add(h);
                fromFiles++;
              }
            }
          } catch (_) {}
        }
      }
      if (fromFiles) console.log('  + from batches:', fromFiles, '→ q#', seenQ.size);
    } catch (eBat) {
      console.log('  batch hash seed skip:', String(eBat.message || eBat).slice(0, 80));
    }
  } else {
    console.log('  Import-only: skip pre-load hashes (import does its own dedupe)');
  }

  let progress = loadProgress();
  if (!RESUME || IMPORT_ONLY) {
    if (!RESUME && !IMPORT_ONLY) {
      progress = {
        target: TARGET,
        corpusTarget: CURRICULUM_TOTAL_QA,
        totalGenerated: 0,
        day: 1,
        dayGenerated: 0,
        batchNo: 0,
        seq: 0,
        files: [],
        skippedDup: 0
      };
      saveProgress(progress);
    }
  } else {
    progress.target = TARGET;
    progress.corpusTarget = CURRICULUM_TOTAL_QA;
  }

  if (!IMPORT_ONLY) {
    console.log('──────────────────────────────────────────────────');
    console.log('PHASE 1: Generate unique JSONL batches');
    const gen = await generatePhase(progress, seenQ);
    console.log(
      '\nGenerate done. Unique rows:',
      gen.total,
      'files:',
      gen.newFiles.length,
      'dup-skipped:',
      gen.skippedDup
    );
  }

  if (!NO_IMPORT) {
    console.log('──────────────────────────────────────────────────');
    console.log('PHASE 2: Append import + incremental FTS');
    const allFiles = collectGeneratedFiles();
    console.log('  Import files :', allFiles.length);

    if (allFiles.length) {
      /* Chunked import — checkpoint/close between chunks to avoid WAL/native crashes. */
      const CHUNK = Math.max(5, Number(process.env.KM_BULK_IMPORT_CHUNK) || 40);
      let totalAdded = 0;
      let totalSkipped = 0;
      let totalParsed = 0;
      for (let i = 0; i < allFiles.length; i += CHUNK) {
        const slice = allFiles.slice(i, i + CHUNK);
        console.log(
          '\n  Import chunk',
          Math.floor(i / CHUNK) + 1 + '/' + Math.ceil(allFiles.length / CHUNK),
          'files',
          i + 1 + '-' + Math.min(i + CHUNK, allFiles.length),
          'of',
          allFiles.length
        );
        kb.invalidateCache();
        if (typeof kb.closeSqliteForSync === 'function') {
          try {
            kb.closeSqliteForSync();
          } catch (_) {}
        }
        const isLastChunk = i + CHUNK >= allFiles.length;
        const r = await kb.importFromFiles(slice, {
          merge: true,
          replace: false,
          appendOnly: true,
          deferFts: true,
          skipFtsSync: !isLastChunk,
          incrementalFts: true,
          checkpointEvery: 10,
          questionDedupe: false,
          preloadDedupe: false, /* rely on SQLite PRIMARY KEY — no 1.6M+ RAM Set */
          maxRows: Math.max(
            2500000,
            Number(process.env.KM_BOT_KNOWLEDGE_MAX) || 0,
            TARGET + (statusBefore.sqliteCount || 0)
          ),
          onProgress: (p) => {
            if (
              p &&
              ((p.parsed > 0 && p.parsed % 50000 === 0) || (p.added > 0 && p.added % 25000 === 0))
            ) {
              process.stdout.write(
                '\r  import progress added=' +
                  p.added +
                  ' skipped=' +
                  p.skipped +
                  ' parsed=' +
                  p.parsed +
                  '   '
              );
            }
          }
        });
        totalAdded += (r && r.added) || 0;
        totalSkipped += (r && r.skipped) || 0;
        totalParsed += (r && r.parsed) || 0;
        console.log(
          '\n  chunk done   : added=' +
            ((r && r.added) || 0) +
            ' skipped=' +
            ((r && r.skipped) || 0) +
            ' total=' +
            ((r && r.total) || '?')
        );
        try {
          kb.checkpointWal();
        } catch (_) {}
        if (typeof kb.closeSqliteForSync === 'function') {
          try {
            kb.closeSqliteForSync();
          } catch (_) {}
        }
      }
      console.log(
        '\n  merge added  :',
        totalAdded,
        'skipped:',
        totalSkipped,
        'parsed:',
        totalParsed
      );
    }

    /* Gap-fill FTS for any rows inserted without FTS (never full wipe). */
    const fts = kb.syncFtsIncremental();
    console.log('  fts sync     :', JSON.stringify(fts));

    kb.invalidateCache();
    const st = await kb.getStatus();
    console.log(
      '  final status :',
      'jsonl=' + st.jsonlLines + ' sqlite=' + st.sqliteCount + ' mode=' + st.mode + ' fts=' + st.fts
    );
  }

  console.log('──────────────────────────────────────────────────');
  console.log('DONE. Restart KM desktop to load BotKnowledge.');
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});

process.on('uncaughtException', (e) => {
  console.error('UNCAUGHT:', e && e.stack ? e.stack : e);
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  console.error('UNHANDLED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
