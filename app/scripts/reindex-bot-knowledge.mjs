/**
 * Rebuild BotKnowledge TF-IDF vectors (+ SQLite) from qa.jsonl.
 *
 * Search uses vectors/index.json only — copying qa.jsonl alone does nothing
 * until this reindex runs (or training addQa rebuilds incrementally).
 *
 * Usage:
 *   npm run bot:reindex
 *   node scripts/reindex-bot-knowledge.mjs
 *   KM_TRAIN_OUT=C:\path\to\UserData node scripts/reindex-bot-knowledge.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createBotKnowledge } = require(path.join(__dirname, '..', 'km_bot_knowledge.js'));

function userRoot() {
  if (process.env.KM_TRAIN_OUT) return path.resolve(process.env.KM_TRAIN_OUT);
  const local = process.env.LOCALAPPDATA || process.env.HOME || process.cwd();
  return path.join(local, 'KM', 'UserData');
}

async function main() {
  const root = userRoot();
  const kb = createBotKnowledge(root, {
    log: function () {
      try {
        console.log.apply(console, ['[bot-knowledge]'].concat([].slice.call(arguments)));
      } catch (_) {}
    }
  });
  const before = await kb.getStatus();
  console.log('══════════════════════════════════════════════════');
  console.log(' KM BotKnowledge reindex from qa.jsonl');
  console.log('══════════════════════════════════════════════════');
  console.log('  UserData     :', root);
  console.log('  qa.jsonl     :', before.qaPath);
  console.log('  vectors      :', before.vectorsPath);
  console.log('  before       : indexed=' + before.indexed + ' jsonlLines=' + before.jsonlLines);
  console.log('──────────────────────────────────────────────────');

  const r = await kb.rebuildFromJsonl();
  let ftsFix = null;
  try {
    const mid = await kb.getStatus();
    if (mid.sqliteCount > 0 && (mid.ftsCount || 0) < mid.sqliteCount) {
      console.log('──────────────────────────────────────────────────');
      console.log(' FTS incomplete (' + (mid.ftsCount || 0) + '/' + mid.sqliteCount + ') — rebuilding until complete…');
      ftsFix = await kb.rebuildFtsUntilComplete({ maxRounds: 40 });
      console.log('  fts fix      :', JSON.stringify(ftsFix));
    }
  } catch (eFts) {
    console.log('  fts fix err  :', eFts && eFts.message);
  }
  const after = await kb.getStatus();

  console.log('  result       :', JSON.stringify(r));
  console.log('  after        : indexed=' + after.indexed + ' jsonlLines=' + after.jsonlLines + ' fts=' + (after.ftsCount || 0));
  console.log('  needsReindex :', after.needsReindex);
  console.log('DONE. Restart KM desktop so the running app reloads the index.');
  if (!r.ok || (after.indexed === 0 && after.jsonlLines > 0) || (after.sqliteCount > 0 && (after.ftsCount || 0) < after.sqliteCount)) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  process.exit(1);
});
