const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=50,b=900){return s.slice(Math.max(0,i-a), i+b);}
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const feat=fs.readFileSync(path.join(root,'app/js/km-features.js'),'utf8');

for (const k of ['kmRenderGrantsLockedHome','grantCard','kmGrantCard','kmHomeCard','homeCards','renderHome','kmFilterGrantCards','PAGE_META','PAGE_ICONS','iconForPage','kmPageIcon']) {
  console.log(k, 'v3', v3.indexOf(k), 'users', users.indexOf(k), 'html', html.indexOf(k), 'feat', feat.indexOf(k));
}

let i=v3.indexOf('kmRenderGrantsLockedHome');
console.log('\n=== grants locked home ===\n', snip(v3,i,20,2000));

i=v3.indexOf('kmFilterGrantCards');
console.log('\n=== filter grant cards ===\n', snip(v3,i,20,1500));

// accounting page open - sub tiles
i=html.indexOf("data-page=\"accounting\"");
console.log('\n accounting open handlers');
for (const k of ['function openAccounting','kmOpenAccounting','page===\"accounting\"','case \"accounting\"','accounting:']) {
  console.log(k, html.indexOf(k), v3.indexOf(k), feat.indexOf(k));
}

// search accounting hub tiles in index or features
i=html.indexOf('unitTermWatch');
console.log('\nhtml unitTermWatch count-ish', (html.match(/unitTermWatch/g)||[]).length);
i=feat.indexOf('unitTermWatch');
console.log('feat', i, snip(feat,i>=0?i:0,100,400));

// how accounting submenu is rendered for users
i=v3.indexOf('Հաշվառում');
console.log('\nv3 Hashvarum', i, snip(v3,i>=0?i:0,50,600));

// look for different icon colors in role-user CSS
i=html.indexOf('km-role-user');
let p=0,c=0;
while((p=html.indexOf('km-role-user',p))>=0 && c<15){
  console.log('html role-user@',p, snip(html,p,0,220).replace(/\n/g,' '));
  p++; c++;
}
