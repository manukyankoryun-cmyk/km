const fs=require('fs'); const path=require('path');
const root=process.argv[2];
function snip(s,i,a=40,b=1200){return s.slice(Math.max(0,i-a), i+b);}
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const users=fs.readFileSync(path.join(root,'app/js/km-users-ui.js'),'utf8');
const v3=fs.readFileSync(path.join(root,'app/js/km-v3-core.js'),'utf8');

// kmUserFlyPanel HTML
let i=html.indexOf('kmUserFlyPanel');
console.log('=== user fly panel ===\n', snip(html,i,100,2500));

i=html.indexOf('km-user-only');
console.log('\n=== user-only nav blocks ===');
let p=0,c=0;
while((p=html.indexOf('km-user-only',p))>=0 && c<8){
  console.log('@',p, snip(html,p,80,350).replace(/\n/g,' '));
  p++; c++;
}

// kmGrantCard styling
i=html.indexOf('kmGrantCard');
console.log('\n=== kmGrantCard css/html ===\n', snip(html,i,50,800));

i=users.indexOf('kmGrantCard');
console.log('\n=== users kmGrantCard ===\n', snip(users,i,50,1500));

// accounting hub cards in index - kmLawCard
i=html.indexOf('unitArchive');
console.log('\n=== accounting cards near unitArchive ===\n', snip(html,i,400,800));
