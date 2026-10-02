const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=40,b=900){return s.slice(Math.max(0,i-a), i+b);}
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');

// accounting hub - where tiles listed
let i=ut.indexOf('unitBadDays');
console.log('PAGES end area', snip(ut, ut.indexOf("unitBadDays: 'Անհարմար օրեր'"), 20, 200));

// hub render in index for accounting
i=html.indexOf("kmOpenPage('accounting')");
console.log('\naccounting open count', (html.match(/accounting/g)||[]).length);
i=html.indexOf('kmUnitOpen');
console.log('html kmUnitOpen sample', snip(html, html.indexOf("kmUnitOpen('unitTermWatch')")>=0?html.indexOf("kmUnitOpen('unitTermWatch')"):html.indexOf('unitTermWatch'), 80, 500));

// find accounting page renderer
for (const f of ['km-ops.js','km-features.js','km-extra-tools.js','km-v3-ext.js']) {
  const s=fs.readFileSync(path.join(root,'app/js',f),'utf8');
  const j=s.indexOf('unitTermWatch');
  if(j>=0) console.log(f,'termwatch',j, snip(s,j,60,300).replace(/\n/g,' '));
  const k=s.indexOf('Հաշվառում');
  if(k>=0) console.log(f,'hash',k);
}

// name split helpers
i=pos.indexOf('ազգանուն');
console.log('\naah area', snip(pos,i,80,400));
i=pos.indexOf('splitName');
console.log('splitName', i, snip(pos,i>=0?i:pos.indexOf('nameParts'),20,400));
i=pos.indexOf('parsePersonName');
console.log('parsePersonName', i);

// zeroPersonCard rest - does it clear name?
i=pos.indexOf('function zeroPersonCard');
console.log('\nzero full', snip(pos,i,0,1200));

// BUILD_SETUP how it stages js
const ps1=fs.readFileSync(path.join(root,'BUILD_SETUP.ps1'),'utf8');
i=ps1.indexOf('km-unit-tools.js');
console.log('\nps1 unit-tools', snip(ps1,i,100,400));
i=ps1.indexOf('KM_PROMOTION_ACCESS');
console.log('\npromo patch style', snip(ps1,i,50,800));

// user menu icons - compare admin accounting fly vs user
i=html.indexOf('kmUserFlyPanel');
console.log('\nfly id occurrences', (html.match(/kmUserFlyPanel/g)||[]).length);
i=html.indexOf('id="kmUserFlyPanel"');
console.log(snip(html,i>=0?i:html.indexOf('UserFly'),0,3000));
