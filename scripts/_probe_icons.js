const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=80,b=500){return s.slice(Math.max(0,i-a), i+b);}
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');
const ops=fs.readFileSync(path.join(root,'app/js/km-ops.js'),'utf8');
const feat=fs.readFileSync(path.join(root,'app/js/km-features.js'),'utf8');
const css=fs.existsSync(path.join(root,'app/css')) ? fs.readdirSync(path.join(root,'app/css')) : [];
console.log('css', css);

// find side menu render for admin vs user
for (const [name,s] of [['users',users],['v3',v3],['ops',ops],['feat',feat]]) {
  for (const k of ['renderSide','paintSide','buildNav','navItems','SIDE_MENU','menuItems','kmBuildMenu','roleMenu','isAdmin','grantPages','SECTION_META','pageMeta','kmPage']) {
    const i=s.indexOf(k);
    if(i>=0) console.log(name,k,i);
  }
}

// look for icon color differences
for (const k of ['--nav','navColor','iconColor','km-nav','side-icon','menu-ico','grantIcon','emoji']) {
  let p=0,c=0; while((p=users.indexOf(k,p))>=0 && c<3){console.log('users',k,p); p++; c++;}
}

// PAGE_ICONS or similar in v3
i=v3.indexOf('unitTermWatch');
console.log('\nv3 termwatch', snip(v3,i,100,200));
i=v3.indexOf('PAGES');
console.log('\nv3 PAGES?', i);

// search html for side nav
const htmlDir=path.join(root,'app');
function walk(d,acc=[]) {
  for(const f of fs.readdirSync(d)) {
    const p=path.join(d,f);
    const st=fs.statSync(p);
    if(st.isDirectory() && !f.includes('node_modules') && !f.startsWith('.')) walk(p,acc);
    else if(/\.(js|html|css)$/.test(f) && !f.includes('.bak')) acc.push(p);
  }
  return acc;
}
const files=walk(htmlDir).filter(p=>/index|shell|main|nav|side|menu|theme|style/i.test(path.basename(p)));
console.log('candidate files', files.map(f=>path.relative(root,f)));

// GRANT_MENU full + how user menu is painted
const g=users.indexOf('function paintGrant');
const g2=users.indexOf('function renderGrant');
const g3=users.indexOf('buildGrant');
console.log('paintGrant',g,'renderGrant',g2,'buildGrant',g3);
for (const k of ['paintUserMenu','renderUserMenu','kmPaintNav','applyGrants','grantedPages','userNav','adminNav']) {
  console.log(k, users.indexOf(k), v3.indexOf(k), ops.indexOf(k));
}
