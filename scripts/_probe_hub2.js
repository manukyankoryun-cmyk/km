const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=40,b=800){return s.slice(Math.max(0,i-a), i+b);}
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');

// render hub for accounting - search in ut for tiles HTML
let i=ut.indexOf('unitTermWatch');
// find where hub cards are built
i=ut.indexOf('kmUtHub');
console.log('kmUtHub', i);
i=ut.indexOf('data-km-ut-page');
console.log('data-km-ut-page', i, snip(ut,i>=0?i:0,50,600));
i=ut.indexOf('PAGES).forEach')>=0?ut.indexOf('PAGES).forEach'):ut.indexOf('Object.keys(PAGES)');
console.log('Object.keys PAGES', ut.indexOf('Object.keys(PAGES)'), snip(ut, ut.indexOf('Object.keys(PAGES)'), 20, 700));

// how accounting page shows children in index.html
i=html.indexOf("name==='accounting'");
console.log('\naccounting branch', snip(html,i,50,1200));

// GRANT renderNode icon display
i=users.indexOf('function renderNode');
console.log('\nrenderNode', snip(users,i,20,900));

// side menu icon colors - per-page icon bg overrides?
i=html.indexOf('kmNavCardIcon');
const re=/data-page="([^"]+)"[^>]*>[\s\S]*?kmNavCardIcon[^>]*>([^<]+)</g;
let m, icons=[];
const sideChunk=html.slice(html.indexOf('id="kmSideMenu"'), html.indexOf('id="kmSideMenu"')+8000);
while((m=re.exec(sideChunk))) icons.push(m[1]+'='+m[2]);
console.log('side icons', icons);

// user fly items
i=html.indexOf('id="kmUserFlyPanel"');
console.log('\nUserFly len search', i);
const ufly=html.indexOf('kmUserMenuBlock')>=0?html.slice(html.indexOf('kmUserMenuBlock'), html.indexOf('kmUserMenuBlock')+5000):'';
console.log('user menu block head', ufly.slice(0,2000));
