/**
 * Rebuild qa_fts until COUNT(qa_fts) >= COUNT(qa).
 * Does NOT re-read qa.jsonl — only FTS from existing SQLite rows.
 *
 * Usage (from app/):
 *   npm run bot:fts
 *   node scripts/rebuild-fts-until-complete.mjs
 *   node scripts/rebuild-fts-until-complete.mjs --rounds 40
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createBotKnowledge } = require(path.join(__dirname, '..', 'km_bot_knowledge.js'));

const ARGS = process.argv.slice(2);
function argNum(name, def) {
  const i = ARGS.indexOf(name);
  if (i >= 0 && ARGS[i + 1] != null) {
    const n = Number(ARGS[i + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return def;
}

function userRoot() {
  if (process.env.KM_TRAIN_OUT) return path.resolve(process.env.KM_TRAIN_OUT);
  const local = process.env.LOCALAPPDATA || process.env.HOME || process.cwd();
  return path.join(local, 'KM', 'UserData');
}

async function main() {
  const maxRounds = argNum('--rounds', Number(process.env.KM_FTS_ROUNDS) || 40);
  const root = userRoot();
  const kb = createBotKnowledge(root, {
    log: (...a) => {
      try {
        console.log.apply(console, ['[fts]'].concat(a));
      } catch (_) {}
    }
  });

  const before = await kb.getStatus();
  console.log('══════════════════════════════════════════════════');
  console.log(' KM BotKnowledge FTS rebuild (until complete)');
  console.log('══════════════════════════════════════════════════');
  console.log('  UserData     :', root);
  console.log('  before       : qa=' + before.sqliteCount + ' fts=' + (before.ftsCount || 0) + ' jsonl=' + before.jsonlLines);
  console.log('  maxRounds    :', maxRounds);
  console.log('──────────────────────────────────────────────────');

  if (!before.sqliteCount) {
    console.error('No SQLite qa rows. Run npm run bot:reindex first.');
    process.exit(1);
  }

  const r = await kb.rebuildFtsUntilComplete({ maxRounds });
  const after = await kb.getStatus();

  console.log('  result       :', JSON.stringify(r));
  console.log('  after        : qa=' + after.sqliteCount + ' fts=' + (after.ftsCount || 0));
  console.log('  needsReindex :', after.needsReindex);

  if (r && r.ok && after.ftsCount >= after.sqliteCount) {
    console.log('DONE. FTS is complete. Restart KM desktop.');
    process.exit(0);
  }

  console.error('FTS still incomplete after', maxRounds, 'rounds. Will need another run (KM Desktop closed).');
  process.exit(1);
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
