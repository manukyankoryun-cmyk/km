/* KM official ARLIS -> in-app JSON content importer. Source is arlis.am only.
   Run on Windows before BUILD_SETUP.ps1. No Word, HTML or PDF output. */
'use strict';
const fs=require('fs'),path=require('path'),https=require('https');
const data=path.resolve(__dirname,'../app/data');
const catalogPath=path.join(data,'km_arlis_military_catalog.json');
const reportPath=path.join(data,'KM_ARLIS_IMPORT_REPORT.txt');
const lookup={constitution:143723,electoral:105967,admin_offenses:20,civil:29,land:39,water:41,family:49,labor:51,forest:21354,subsoil:82035,admin_proc:87705,tax:109017,eaeu:159647,judicial:119531,civil_proc:120057,criminal:153080,crim_proc:154763,penitentiary:164938,statute_internal:225574,statute_garrison:112468,statute_discipline:200323,rights_service_status:225571};
const includeOrders=process.argv.includes('--orders');
const refresh=process.argv.includes('--refresh');
function saveAtomic(file,data){const tmp=file+'.new';fs.writeFileSync(tmp,data,'utf8');fs.renameSync(tmp,file);}
function get(url,depth=0){return new Promise((ok,no)=>{
 if(depth>5)return no(Error('Too many redirects'));
 let req=https.get(url,{headers:{'User-Agent':'Mozilla/5.0 (KM legal library importer)','Accept':'text/html,application/xhtml+xml','Accept-Language':'hy'},timeout:45000},r=>{
  if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){const target=new URL(r.headers.location,url);r.resume();if(!['www.arlis.am','arlis.am'].includes(target.hostname))return no(Error('Unsafe redirect'));return get(target.href,depth+1).then(ok,no);}
  if(r.statusCode!==200){r.resume();return no(Error('HTTP '+r.statusCode));}
  const chunks=[];let length=0;r.on('data',c=>{length+=c.length;if(length>18*1024*1024){req.destroy(Error('Response too large'));return;}chunks.push(c);});r.on('end',()=>ok(Buffer.concat(chunks).toString('utf8')));
 });req.on('timeout',()=>req.destroy(Error('Timeout')));req.on('error',no);
});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const REQUEST_GAP_MS=Number(process.env.KM_ARLIS_GAP_MS||900); // arlis.am answers HTTP 429 when requests come too fast
async function getRetry(url){
 for(let a=0;;a++){
  try{return await get(url);}
  catch(e){
   const transient=/HTTP (429|5\d\d)|Timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(String(e&&e.message));
   if(!transient||a>=6)throw e;
   await sleep(Math.min(120000,5000*Math.pow(2,a))); // 5s, 10s, 20s ... up to 2 min
  }
 }
}
function decode(s){return s.replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(x[0-9a-f]+|\d+);/gi,(m,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):parseInt(v,10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;});}
function extract(raw){let s=raw.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|svg|noscript|head)\b[^>]*>[\s\S]*?<\/\1>/gi,'');const main=s.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i);if(main&&main[1].length>3000)s=main[1];return decode(s.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/(?:div|p|tr|li|h[1-6]|section|table)>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function contentOK(text,section){
 const min=/^(orders_|military_acts$|laws$|statute_discipline$)/.test(section)?350:1500;
 if(text.length<min||/Just a moment|enable javascript|cloudflare/i.test(text.slice(0,900)))return false;
 const articleCount=(text.match(/Հոդված\s+\d+/gi)||[]).length;
 if(/^(constitution|electoral|admin_offenses|civil|land|water|family|labor|forest|subsoil|admin_proc|tax|eaeu|judicial|civil_proc|criminal|crim_proc|penitentiary)$/.test(section))return articleCount>=5;
 return /Հոդված|ՀՐԱՄԱՆ|ՈՐՈՇՈՒՄ|ՍԱՀՄԱՆԱԴՐՈՒԹՅՈՒՆ|ԿԱՆՈՆԱԳԻՐՔ|ԿԱՆՈՆԱԴՐՈՒԹՅՈՒՆ|ՀԱՄԱՁԱՅՆԱԳԻՐ|ԱՐՁԱՆԱԳՐՈՒԹՅՈՒՆ|ՊԱՅՄԱՆԱԳԻՐ|ՕՐԵՆՔ|ՊԱՅՄԱՆԱԳՐ/i.test(text);
}

// Remove arlis.am page chrome and pull the "Ակտի վավերապայմաններ" block into structured fields.
function cleanAct(raw){
 let t=String(raw||'');
 const foot=t.lastIndexOf('Ներբեռնել իրավական ակտը');if(foot!==-1)t=t.slice(0,foot);
 const meta={};
 const re=/Տեղեկատվություն\s+Ակտի վավերապայմաններ/g;let m,last=null;while((m=re.exec(t)))last=m;
 if(last){
  const tail=t.slice(last.index);t=t.slice(0,last.index);
  const F=[['Համար','number'],['Տիպ','type'],['Կարգավիճակ','status'],['Սկզբնաղբյուր','gazette'],['Ընդունող մարմին','adoptedBy'],['Ընդունման ամսաթիվ','adoptedDate'],['Ստորագրման ամսաթիվ','signedDate'],['Ուժի մեջ մտնելու ամսաթիվ','inForceDate']];
  for(const [lab,key] of F){const r=new RegExp('(?:^|\\n)\\s*'+lab+'\\s*\\n+\\s*([^\\n]+)').exec(tail);if(r)meta[key]=r[1].trim();}
  const e=/\((\d\d\.\d\d\.\d{4})\s*-\s*մինչ օրս\)/.exec(meta.status||'');if(e)meta.editionDate=e[1];
 }
 t=t.replace(/^(?:\s*(?:Պաշտոնական ինկորպորացիա|Բովանդակություն)\s*\n+)+/i,'').replace(/^\s+/,'');
 t=t.replace(/^[ \t]*Գ\s?Լ\s?ՈՒ\s?Խ(?=\s*\d)/gm,'ԳԼՈՒԽ').replace(/^[ \t]*Հ\s?ՈԴՎԱԾ(?=\s*\d)/gm,'ՀՈԴՎԱԾ').replace(/^[ \t]*Բ\s?Ա\s?Ժ\s?Ի\s?Ն(?=\s*\d)/gm,'ԲԱԺԻՆ');
 t=t.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';
 return {text:t,meta};
}
async function main(){const c=JSON.parse(fs.readFileSync(catalogPath,'utf8'));c.embeddedLegalTexts=c.embeddedLegalTexts||{};c.embeddedLegalAliases=c.embeddedLegalAliases||{};
 const jobs=Object.entries(lookup).map(([section,id])=>({section,id:String(id)}));
 if(includeOrders)for(const item of c.items||[])if(/^(orders_|military_acts$|laws$|statute_discipline$)/.test(item.section||'')&&/^\d+$/.test(String(item.actId)))jobs.push({section:item.section,id:String(item.actId)});
 // One canonical legal text for each official act; section keys are aliases.
 const grouped=new Map();for(const j of jobs){const k=String(j.id);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(j.section);}
 let ok=0,cached=0,failed=0;const lines=['KM ARLIS import '+new Date().toISOString(),'Source: arlis.am; currency and completeness require independent legal review.'];
 const groupedEntries=[...grouped.entries()];
 for(const [i,[id,sections]] of groupedEntries.entries()){
  const canonical='act/'+id,source='https://www.arlis.am/hy/acts/'+id+'/latest';
  const old=(c.embeddedLegalTexts[canonical] && c.embeddedLegalTexts[canonical].importedAt ? c.embeddedLegalTexts[canonical] : null) || sections.map(sec=>c.embeddedLegalTexts[c.embeddedLegalAliases[sec+'/'+id]||sec+'/'+id]).find(r=>r&&r.importedAt);
  if(!refresh&&old&&old.text&&old.importedAt){
   c.embeddedLegalTexts[canonical]=old;
   for(const sec of sections)c.embeddedLegalAliases[sec+'/'+id]=canonical;
   cached++;continue;
  }
  try{
   const actText=extract(await getRetry(source));
   if(!sections.some(sec=>contentOK(actText,sec)))throw Error('Text validation failed ('+actText.length+' chars)');
   const cl=cleanAct(actText);c.embeddedLegalTexts[canonical]={actId:id,text:cl.text,source,importedAt:new Date().toISOString(),cleaned:true,verification:'Imported automatically; edition/completeness not independently verified'};if(Object.keys(cl.meta).length){c.embeddedLegalTexts[canonical].meta=cl.meta;if(cl.meta.editionDate)c.embeddedLegalTexts[canonical].editionDate=cl.meta.editionDate;if(cl.meta.number)c.embeddedLegalTexts[canonical].docNumber=cl.meta.number;}
   for(const sec of sections){const key=sec+'/'+id;c.embeddedLegalAliases[key]=canonical;if(key!==canonical && c.embeddedLegalTexts[key] && c.embeddedLegalTexts[key].importedAt)delete c.embeddedLegalTexts[key];}
   ok++;await sleep(REQUEST_GAP_MS);lines.push('IMPORTED '+canonical+' sections='+sections.join(',')+' chars='+cl.text.length);
   if(ok%10===0)saveAtomic(catalogPath,JSON.stringify(c));
  }catch(e){failed++;lines.push('FAILED '+canonical+' '+e.message);await sleep(REQUEST_GAP_MS);}
  if((i+1)%10===0){saveAtomic(catalogPath,JSON.stringify(c));saveAtomic(reportPath,lines.join('\n')+'\n');console.log('Processed '+(i+1)+'/'+groupedEntries.length+'; imported '+ok+'; errors '+failed);}
 }
 saveAtomic(catalogPath,JSON.stringify(c));lines.push('TOTAL unique acts='+groupedEntries.length+' imported='+ok+' cached='+cached+' failed='+failed);saveAtomic(reportPath,lines.join('\n')+'\n');
 console.log(lines[lines.length-1]);console.log('Report: '+reportPath);if(failed)process.exitCode=2;
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
