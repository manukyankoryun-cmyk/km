/* Launch installed KM.exe (project has no local Electron binary). */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const candidates = [
  'E:\\KM\\runtime\\KM.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'KM', 'runtime', 'KM.exe')
];

const exe = candidates.find((p) => p && fs.existsSync(p));
if (!exe) {
  console.error('KM.exe not found. Expected E:\\KM\\runtime\\KM.exe');
  process.exit(1);
}

console.log('Starting', exe);
const child = spawn(exe, [], { detached: true, stdio: 'ignore' });
child.unref();
process.exit(0);
