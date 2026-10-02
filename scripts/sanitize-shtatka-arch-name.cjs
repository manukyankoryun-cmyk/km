/* Rename old SHTATKA archive display labels in JSON seed only; never modify archive IDs, rows or XLSX source data. */
'use strict';
const fs=require('fs'),path=require('path');
function sanitizeRoots(roots){
 const changed=[];
 function visit(dir){if(!fs.existsSync(dir))return;for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const f=path.join(dir,item.name);if(item.isDirectory()){visit(f);continue;}
  if(!item.isFile()||!item.name.endsWith('.json'))continue;
  let obj;try{obj=JSON.parse(fs.readFileSync(f,'utf8'));}catch(_){continue;}
  let hits=0;
  function walk(v){if(!v||typeof v!=='object')return;
   if(Array.isArray(v)){for(const x of v)walk(x);return;}
   if(typeof v.name==='string'&&/^SHTATKA(?:\s|$)/i.test(v.name)){
      v.name='Զորամասի հաստիքային արխիվ ('+v.name.replace(/^SHTATKA\s*/i,'').trim()+')';hits++;
   }
   for(const [k,x] of Object.entries(v))if(k!=='rows'&&k!=='data'&&x&&typeof x==='object')walk(x);
  }
  walk(obj);if(hits){fs.writeFileSync(f,JSON.stringify(obj,null,2)+'\n','utf8');changed.push(f);}
 }}
 for(const dir of roots||[])visit(dir);return changed;
}
module.exports={sanitizeRoots};
