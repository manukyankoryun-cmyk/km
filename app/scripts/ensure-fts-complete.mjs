/**
 * Wait for any bot:reindex to finish, then rebuild FTS until qa_fts >= qa.
 * Usage: node scripts/ensure-fts-complete.mjs
 */
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, '..');

function reindexRunning() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -match \'reindex-bot-knowledge|bot:reindex\' } | Measure-Object | Select-Object -ExpandProperty Count"',
      { encoding: 'utf8', cwd: APP }
    );
    return Number(String(out).trim()) > 0;
  } catch (_) {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runFtsRound(round) {
  console.log('\n=== FTS ensure round', round, '===');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/rebuild-fts-until-complete.mjs', '--rounds', '40'], {
      cwd: APP,
      stdio: 'inherit',
      env: process.env
    });
    child.on('close', (code) => resolve(code === 0));
  });
}

async function main() {
  console.log('ensure-fts: waiting for bot:reindex to finish…');
  while (reindexRunning()) {
    await sleep(15000);
    process.stdout.write('.');
  }
  console.log('\nensure-fts: reindex idle — starting FTS rebuild loop');

  for (let round = 1; round <= 50; round++) {
    const ok = await runFtsRound(round);
    if (ok) {
      console.log('ensure-fts: DONE — FTS complete after', round, 'round(s)');
      process.exit(0);
    }
    console.log('ensure-fts: round', round, 'incomplete — retry in 30s (close KM Desktop if open)');
    await sleep(30000);
  }
  console.error('ensure-fts: gave up after 50 rounds');
  process.exit(1);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
