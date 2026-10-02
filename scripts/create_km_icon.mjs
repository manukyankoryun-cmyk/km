import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const args = process.argv.slice(2);
if (args.length < 2) throw new Error('Usage: create_km_icon.mjs <png1> [png2 ...] <out.ico>');

const ico = path.resolve(args[args.length - 1]);
const sources = args.slice(0, -1).map((p) => path.resolve(p));
for (const src of sources) {
  if (!fs.existsSync(src)) throw new Error(`Missing PNG: ${src}`);
}

const cacheDir = path.join(root, '_cache', 'png-to-ico');
const pkg = path.join(cacheDir, 'node_modules', 'png-to-ico');
if (!fs.existsSync(pkg)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const { execSync } = await import('child_process');
  execSync('npm init -y', { cwd: cacheDir, stdio: 'ignore' });
  execSync('npm install png-to-ico@2.1.8 --no-audit --no-fund --silent', { cwd: cacheDir, stdio: 'inherit' });
}

const pngToIco = require(path.join(cacheDir, 'node_modules', 'png-to-ico'));
const buf = await pngToIco(sources);
fs.writeFileSync(ico, buf);
console.log('Created', ico, buf.length, 'bytes from', sources.length, 'PNG sizes');
