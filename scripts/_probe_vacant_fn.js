const fs=require('fs'); const path=require('path');
const root=process.argv[2];
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const i=pos.lastIndexOf('Դարձնել թափուր՝', 160000);
// find function start before this
const start=pos.lastIndexOf('async function', i);
const start2=pos.lastIndexOf('function ', i);
const s=Math.max(start, start2>0&&start2<i?start2:-1);
console.log('fn start', s, pos.slice(s, s+80));
console.log(pos.slice(s, i+900));

// find mark vacant button handler assignment
const j=pos.indexOf('Դարձնել թափուր">');
console.log('\nBTN near', pos.slice(j-400, j+200));

// sidebar icons admin vs user
const files=['app/index.html','app/js/km-ops.js','app/js/km-v3-core.js','app/js/km-features.js','app/js/km-extensions.js'];
for(const f of files){
  const p=path.join(root,f);
  if(!fs.existsSync(p)) continue;
  const t=fs.readFileSync(p,'utf8');
  if(/sideNav|navItems|PAGE_ICONS|role.*icon|kmNav|sidebar/i.test(t) && /admin|userRole|editor/i.test(t)){
    const m=t.match(/PAGE_ICONS|NAV_ICONS|navIcon|iconByPage|sideMenu/g);
    if(m) console.log(f, m.slice(0,10));
  }
}
