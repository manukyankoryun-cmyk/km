#!/usr/bin/env node
/**
 * Seed BotKnowledge (qa.jsonl + vectors + SQLite) with curated 34-day curriculum Q&A.
 * No API keys required — uses bundled high-quality Armenian QA pairs.
 *
 * Usage (from app/):
 *   npm run seed:34day
 *   npm run seed:34day -- --fresh
 *   KM_TRAIN_OUT=C:\path\to\UserData npm run seed:34day
 *
 * Flags:
 *   --fresh     Backup existing qa.jsonl, then write seed set only
 *   --merge     Default: append new pairs, skip duplicates (q+a hash)
 *   --no-reindex  Skip TF-IDF rebuild at end
 */
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const { createBotKnowledge } = require(path.join(APP_DIR, 'km_bot_knowledge.js'));
const { CURRICULUM_25_DAYS, CURRICULUM_34_DAYS } = require(path.join(APP_DIR, 'km_gemini_config.js'));
void CURRICULUM_25_DAYS;
const { getAllSeedQa } = require(path.join(APP_DIR, 'data', 'curriculum34-seed-data.js'));

const ARGS = new Set(process.argv.slice(2));
const FRESH = ARGS.has('--fresh');
const MERGE = !FRESH || ARGS.has('--merge');
const NO_REINDEX = ARGS.has('--no-reindex');

function userRoot() {
  if (process.env.KM_TRAIN_OUT) return path.resolve(process.env.KM_TRAIN_OUT);
  const local = process.env.LOCALAPPDATA || process.env.HOME || process.cwd();
  return path.join(local, 'KM', 'UserData');
}

function parseDay(entry) {
  const m = String(entry).match(/^(\d+)\.\s*(.+)$/);
  return { day: m ? Number(m[1]) : 0, domain: m ? m[2].trim() : String(entry) };
}

function qaKey(rec) {
  return [rec.day, rec.domain, rec.q, rec.a].join('\x1e').toLocaleLowerCase('hy-AM');
}

function loadExistingKeys(qaPath) {
  const seen = new Set();
  if (!fs.existsSync(qaPath)) return seen;
  const raw = fs.readFileSync(qaPath, 'utf8');
  raw.split(/\r?\n/).forEach((ln) => {
    if (!ln.trim()) return;
    try {
      const j = JSON.parse(ln);
      if (j && j.q && j.a) seen.add(qaKey(j));
    } catch (_) {}
  });
  return seen;
}

async function main() {
  const root = userRoot();
  const kb = createBotKnowledge(root, {
    log: (...a) => console.log('[BotKnowledge]', ...a)
  });
  const paths = kb.paths();
  const seedRows = getAllSeedQa();

  console.log('══════════════════════════════════════════════════');
  console.log(' KM 34-Day Curriculum — Local QA Seed');
  console.log('══════════════════════════════════════════════════');
  console.log('  UserData     :', root);
  console.log('  qa.jsonl     :', paths.qaPath);
  console.log('  seed pairs   :', seedRows.length);
  console.log('  mode         :', FRESH ? 'fresh' : 'merge');
  console.log('──────────────────────────────────────────────────');

  if (FRESH && fs.existsSync(paths.qaPath)) {
    const bak = paths.qaPath + '.bak-' + Date.now();
    fs.copyFileSync(paths.qaPath, bak);
    fs.unlinkSync(paths.qaPath);
    console.log('  Backed up existing qa.jsonl →', bak);
  }

  const seen = MERGE ? loadExistingKeys(paths.qaPath) : new Set();
  let added = 0;
  let skipped = 0;
  let turnByDay = Object.create(null);

  for (let i = 0; i < seedRows.length; i++) {
    const row = seedRows[i];
    const entry = CURRICULUM_34_DAYS[row.day - 1];
    const parsed = entry ? parseDay(entry) : { day: row.day, domain: row.domain };
    const day = row.day || parsed.day;
    const domain = row.domain || parsed.domain;
    const q = String(row.q || '').trim();
    const a = String(row.a || '').trim();
    if (!q || !a || q.length < 8 || a.length < 12) {
      skipped++;
      continue;
    }
    turnByDay[day] = (turnByDay[day] || 0) + 1;
    const rec = { day, domain, q, a };
    const key = qaKey(rec);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    await kb.addQa({
      day,
      domain,
      turn: turnByDay[day],
      q,
      a,
      tags: ['curriculum34', 'seed', 'day-' + day, domain],
      source: 'seed-34day-knowledge'
    });
    added++;
    if (added % 50 === 0) {
      process.stdout.write('  … ' + added + ' saved\r');
    }
  }

  await kb.flush();

  let reindex = null;
  if (!NO_REINDEX) {
    console.log('\n  Rebuilding TF-IDF index…');
    reindex = await kb.rebuildFromJsonl();
  }

  const st = await kb.getStatus();
  console.log('──────────────────────────────────────────────────');
  console.log('DONE seed.');
  console.log('  added        :', added);
  console.log('  skipped/dup  :', skipped);
  console.log('  indexed      :', st.indexed);
  console.log('  jsonl lines  :', st.jsonlLines);
  console.log('  needsReindex :', st.needsReindex);
  if (reindex) console.log('  reindex      :', JSON.stringify(reindex));
  console.log('Restart KM desktop to reload BotKnowledge in the Help Bot.');
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
