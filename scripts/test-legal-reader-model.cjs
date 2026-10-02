const fs=require('fs'),assert=require('assert'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../app');const model=require(path.join(root,'../scripts/km-legal-model.cjs'));
const dir=path.join(root,'data/legal-reader');const index=JSON.parse(fs.readFileSync(path.join(dir,'index.json')));
let count=0,pages=0,headings=0;
for(const [key,r] of Object.entries(index.records)){
 const x=JSON.parse(fs.readFileSync(path.join(dir,r.file)));
 assert.equal(x.starts[0],0);assert.deepEqual(x.starts,[...new Set(x.starts)].sort((a,b)=>a-b));
 const parts=x.starts.map((n,i)=>x.text.slice(n,x.starts[i+1]));assert.equal(parts.join(''),x.text,key+' dropped text');
 for(const h of x.outline){assert(h.pos>=0&&h.pos<x.text.length);if(!x.richFormatVersion)assert(x.text.slice(h.pos).trimStart().startsWith(h.label.split(' ')[0]));assert(model.pageAt(x.starts,h.pos)>=0);}
 count++;pages+=parts.length;headings+=x.outline.length;
}
let inline=0;for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc=/.test(m[1])&&m[2].trim()){new vm.Script(m[2]);inline++;}}
const sample=model.build('ԳԼՈՒԽ 1\n\nՎԵՐՆԱԳԻՐ\n\n&#9878 Հոդված 1.\n\nՀոդվածի վերնագիր\n\n1. Առաջին կետ։\n\n2) Երկրորդ կետ։');
assert.equal(sample.outline.length,2);assert(sample.outline[1].label.includes('Հոդվածի վերնագիր'));
console.log(JSON.stringify({documents:count,pages,headings,inlineScriptsParsed:inline,passed:true}));
