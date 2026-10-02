/* Builds the offline reader without network access. Verified source records take precedence. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const app=path.resolve(__dirname,'../app'),model=require('./km-legal-model.cjs');
const c=JSON.parse(fs.readFileSync(path.join(app,'data/km_arlis_military_catalog.json'),'utf8'));
const dir=path.join(app,'data/legal-reader');fs.mkdirSync(dir,{recursive:true});
const records={};
for(const [key,old] of Object.entries(c.embeddedLegalTexts||{})){
 if(!old.text)continue;
 const sourcePath=path.join(app,'data/legal-source-records',String(old.actId||key.slice(4))+'.json');
 const record=key.startsWith('act/')&&fs.existsSync(sourcePath)?JSON.parse(fs.readFileSync(sourcePath,'utf8')):old;
 const filename=crypto.createHash('sha256').update(key).digest('hex').slice(0,24)+'.json';
 const prepared=record.richFormatVersion?{...record}:({...record,...model.build(record.text)});
 if(prepared.sourceHtml){
  const sourceFile='source-'+record.actId+'.html';
  prepared.sourceFile=sourceFile;delete prepared.sourceHtml;
 }
 fs.writeFileSync(path.join(dir,filename),JSON.stringify(prepared));
 const v=record.verification&&typeof record.verification==='object'?record.verification:null;
 records[key]={file:filename,actId:record.actId||'',internal:!!record.internal,checkedAt:v?v.checkedAt:'',status:v?v.sourceStatus:'',formatted:!!record.richFormatVersion};
}
fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify({items:c.items,aliases:c.embeddedLegalAliases||{},records}));
console.log('Prepared',Object.keys(records).length,'documents; index',fs.statSync(path.join(dir,'index.json')).size,'bytes');
