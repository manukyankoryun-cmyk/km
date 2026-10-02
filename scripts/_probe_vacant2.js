const fs=require('fs'); const path=require('path');
const root=process.argv[2];
const pos=fs.readFileSync(path.join(root,'app/js/km-positions.js'),'utf8');
const ut=fs.readFileSync(path.join(root,'app/js/km-unit-tools.js'),'utf8');
const idx=pos.indexOf("toastMsg('Պաշտոնը թափուր է'");
const start=pos.lastIndexOf('window.', idx-50);
// better: search for vacant handler
let h=pos.indexOf("data-km-pos")>=0 ? pos.indexOf("=== 'vacant'") : -1;
console.log('eq vacant', h);
if(h<0) h=pos.indexOf('posAction === "vacant"');
if(h<0) h=pos.indexOf("action === 'vacant'");
if(h<0) h=pos.indexOf('"vacant"') && pos.indexOf("km-pos") ;
const keys=["=== 'vacant'","== 'vacant'","case 'vacant'","action==='vacant'","kmPosVacant","makePositionVacant","clearToVacant"];
for(const k of keys){ const i=pos.indexOf(k); if(i>=0) console.log('found',k,i); }

// extract larger block before toast
console.log('\nBLOCK\n', pos.slice(idx-2200, idx+400));

// unit tools: how pages render + sidebar tiles
const r=ut.indexOf('unitTermWatch: renderTerms');
console.log('\nRENDER MAP', ut.slice(r-400, r+600));
const tiles=ut.indexOf('unitTermWatch');
// accounting hub tiles
const hub=ut.indexOf('Հաշվառում');
console.log('hashvarum', hub, ut.slice(hub, hub+300));
