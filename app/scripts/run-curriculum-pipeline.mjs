#!/usr/bin/env node
/**
 * Full 25-domain Knowledge Pipeline (append-only):
 *   Existing ~700k QA preserved + ~700k new unique → target corpus 1,400,000
 *   1) Validate locked curriculum (assertCurriculum25)
 *   2) Batch-generate JSONL → app/data/bulk-import/generated/
 *   3) Optional Wikipedia enrichment (--wiki)
 *   4) Append import + question-hash dedupe + incremental FTS
 *
 * Usage (from app/):
 *   npm run pipeline:700k
 *   npm run pipeline:700k -- --resume --wiki
 *   npm run pipeline:700k -- --target 5000 --dry-run
 *   npm run pipeline:700k -- --import-only
 */
import { spawn } from 'child_process';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, '..');
const {
  CURRICULUM_25_DAYS,
  CURRICULUM_NEW_QA,
  CURRICULUM_TOTAL_QA,
  MAX_TURNS,
  assertCurriculum25
} = require(path.join(APP_DIR, 'km_gemini_config.js'));

assertCurriculum25(CURRICULUM_25_DAYS);

const passthrough = process.argv.slice(2);
if (passthrough.includes('--fresh') || passthrough.includes('--replace-store')) {
  console.error('REFUSED: --fresh / --replace-store blocked (append-only pipeline).');
  process.exit(2);
}
if (!passthrough.includes('--target') && !process.env.KM_BULK_TARGET) {
  passthrough.push('--target', String(CURRICULUM_NEW_QA));
}

console.log('══════════════════════════════════════════════════');
console.log(' KM curriculum pipeline (25 domains · append-only)');
console.log('  domains      :', CURRICULUM_25_DAYS.length);
console.log('  new QA       :', CURRICULUM_NEW_QA);
console.log('  corpus target:', CURRICULUM_TOTAL_QA);
console.log('  HelpBot turns:', MAX_TURNS, '/ day·session');
console.log('  args         :', passthrough.join(' ') || '(defaults)');
console.log('══════════════════════════════════════════════════');

const child = spawn(
  process.execPath,
  [path.join(__dirname, 'generate-curriculum-700k.mjs'), ...passthrough],
  { cwd: APP_DIR, stdio: 'inherit', env: process.env }
);

child.on('exit', (code) => process.exit(code == null ? 1 : code));
