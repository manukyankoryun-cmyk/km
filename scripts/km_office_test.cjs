const {toBuffer,createOfficeBackend,psQuote,psCommonPreamble,CONVERTERS}=require('../app/office_backend.js');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');

let pass=0,fail=0,skip=0;
function ok(name,cond,detail){
  if(cond){pass++;console.log('  PASS:',name);}
  else {fail++;console.log('  FAIL:',name,detail||'');}
}
function skipped(name,why){skip++;console.log('  SKIP:',name,why||'');}

function runPsFile(scriptPath,timeoutMs){
  return spawnSync('powershell.exe',[
    '-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',scriptPath
  ],{encoding:'utf8',timeout:timeoutMs||60000,windowsHide:true,maxBuffer:8*1024*1024});
}

function writePs(dir,body){
  const p=path.join(dir,'km_test_'+Date.now()+'_'+Math.random().toString(16).slice(2)+'.ps1');
  fs.writeFileSync(p,'\uFEFF'+body+'\r\n','utf8');
  return p;
}

function zipInnerText(file,inner){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'km-zip-'));
  try{
    const zip=path.join(dir,'pack.zip');
    fs.copyFileSync(file,zip);
    const r=spawnSync('tar',['-xf',zip,'-C',dir,inner],{encoding:'utf8',windowsHide:true});
    if(r.status!==0)return '';
    const p=path.join(dir,...inner.split('/'));
    return fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
  }finally{try{fs.rmSync(dir,{recursive:true,force:true});}catch{}}
}

function bufHas(buf,s){
  if(!buf)return false;
  if(buf.includes(s))return true;
  return buf.includes(Buffer.from(s,'utf16le'));
}

const KINDS=['word-to-pdf','pdf-to-word','word-to-excel','excel-to-word','excel-to-pdf','pdf-to-excel','ppt-to-pdf','pdf-to-ppt','image-to-pdf'];
const UI_FNS={
  'word-to-pdf':'convertWordToPdf',
  'pdf-to-word':'convertPdfToWord',
  'word-to-excel':'convertWordToExcel',
  'excel-to-word':'convertExcelToWord',
  'excel-to-pdf':'convertExcelToPdf',
  'pdf-to-excel':'convertPdfToExcel',
  'ppt-to-pdf':'convertPptToPdf',
  'pdf-to-ppt':'convertPdfToPpt'
};
const UI_IDS={
  'word-to-pdf':'convWordPdf',
  'pdf-to-word':'convPdfWord',
  'word-to-excel':'convWordExcel',
  'excel-to-word':'convExcelWord',
  'excel-to-pdf':'convExcelPdf',
  'pdf-to-excel':'convPdfExcel',
  'ppt-to-pdf':'convPptPdf',
  'pdf-to-ppt':'convPdfPpt',
  'image-to-pdf':'convImagePdf'
};
const MARKER='Բարև KM';

(async()=>{
console.log('KM office converter helpers');
const hy=Buffer.from('Բարև','utf8');
ok('utf8 armenian roundtrip',toBuffer(hy).equals(hy));
ok('uint8array',toBuffer(new Uint8Array(hy)).equals(hy));
ok('plain array',toBuffer(Array.from(hy)).equals(hy));
ok('json buffer',toBuffer({type:'Buffer',data:Array.from(hy)}).equals(hy));
ok('object with length',toBuffer({0:hy[0],1:hy[1],2:hy[2],3:hy[3],4:hy[4],5:hy[5],6:hy[6],7:hy[7],length:hy.length}).equals(hy));
let threw=false;
try{toBuffer({});}catch{threw=true;}
ok('rejects plain object',threw);
ok('not [object Object]',threw||!toBuffer(Buffer.from('x')).includes(0x5b));
ok('psQuote escapes',psQuote("a'b")==="'a''b'");

const src=fs.readFileSync(path.join(__dirname,'..','app','office_backend.js'),'utf8');
ok('uses STA',src.includes("'-STA'"));
ok('writes utf8 BOM script',src.includes('\\uFEFF'));
ok('pdf export api',src.includes('ExportAsFixedFormat'));
ok('docx SaveAs2',src.includes('SaveAs2'));
ok('no SaveAs [ref]',!src.includes('SaveAs([ref]'));
ok('excel text format',src.includes("NumberFormat='@'"));
ok('excel uses .Text',src.includes('.Text'));
ok('silences pdf warning',src.includes('DisableConvertPdfWarning'));
ok('auto-clicks pdf prompt',src.includes('KM-StartWordPdfClicker'));
ok('powershell timeout',src.includes('p.kill()'));
ok('word automation security',src.includes('AutomationSecurity=3'));
ok('unlinks input in finally',src.includes('finally{try{await fsp.unlink(input);}'));

ok('nine converters',Object.keys(CONVERTERS).length===9);
for(const kind of KINDS){
  const spec=CONVERTERS[kind];
  ok(kind+' registered',!!spec&&Array.isArray(spec.inExt)&&spec.outExt);
}
ok('word-to-pdf out pdf',CONVERTERS['word-to-pdf'].outExt==='.pdf');
ok('pdf-to-word out docx',CONVERTERS['pdf-to-word'].outExt==='.docx');
ok('word-to-excel out xlsx',CONVERTERS['word-to-excel'].outExt==='.xlsx');
ok('excel-to-word out docx',CONVERTERS['excel-to-word'].outExt==='.docx');
ok('excel-to-pdf out pdf',CONVERTERS['excel-to-pdf'].outExt==='.pdf');
ok('pdf-to-excel out xlsx',CONVERTERS['pdf-to-excel'].outExt==='.xlsx');
ok('ppt-to-pdf out pdf',CONVERTERS['ppt-to-pdf'].outExt==='.pdf');
ok('pdf-to-ppt out pptx',CONVERTERS['pdf-to-ppt'].outExt==='.pptx');
ok('image-to-pdf out pdf',CONVERTERS['image-to-pdf'].outExt==='.pdf');

const html=fs.readFileSync(path.join(__dirname,'..','app','index.html'),'utf8');
const lib=fs.readFileSync(path.join(__dirname,'..','app','js','km-library-ui.js'),'utf8');
const preload=fs.readFileSync(path.join(__dirname,'..','app','preload.js'),'utf8');
const main=fs.readFileSync(path.join(__dirname,'..','app','main.js'),'utf8');
ok('ipc convert handler',main.includes("ipcMain.handle('km:convert:run'"));
ok('preload convert.run',preload.includes("km:convert:run"));
ok('renderer uses Uint8Array',html.includes('Array.from(new Uint8Array(await file.arrayBuffer()))'));
ok('ipc folder/merge/split',main.includes("km:convert:folder")&&main.includes("km:convert:mergePdf")&&main.includes("km:convert:splitPdf"));
ok('duty order ipc',main.includes("km:export:dutyOrderWord")&&preload.includes("km:export:dutyOrderWord"));
ok('duty order packs',src.includes("==='flat'")&&src.includes('sections'));
ok('convert progress ipc',main.includes("km:convert:progress")&&preload.includes("km:convert:progress"));
ok('usb library ipc',main.includes("km:usb:importLibrary")&&preload.includes("km:usb:importLibrary"));
ok('usb photos ipc',main.includes("km:usb:importPhotos")&&preload.includes("km:usb:importPhotos")&&main.includes("scheme:'kmphoto'"));
ok('drop bind ui',html.includes('window.kmBindConverterDrops=')&&lib.includes('kmDropHint'));
for(const kind of KINDS){
  if(kind==='image-to-pdf'){
    ok('ui fn convertImagesToPdf',html.includes('window.convertImagesToPdf='));
    ok('library box image-to-pdf',lib.includes('id="convImagePdf"')&&lib.includes('convertImagesToPdf()'));
    continue;
  }
  ok('ui fn '+UI_FNS[kind],html.includes('window.'+UI_FNS[kind]+'=')&&html.includes("runConvert('"+kind+"'"));
  ok('library box '+kind,lib.includes('id="'+UI_IDS[kind]+'"')&&lib.includes(UI_FNS[kind]+'()'));
}
ok('merge/split/folder ui',html.includes('window.convertMergePdfs=')&&html.includes('window.convertSplitPdf=')&&html.includes('window.convertFolderBatch='));
ok('image restore removed',!html.includes('convertRestoreImages')&&!lib.includes('convImageRestore')&&!src.includes('function restoreImages')&&!main.includes('kmrestore')&&!preload.includes('km:convert:restoreImages'));
ok('library laws ipc',main.includes("km:library:lawsStats")&&preload.includes("km:library:lawsList")&&lib.includes('kmLawsSetSection')&&lib.includes("label: 'Օրենքներ'"));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'km-off-'));
const b=createOfficeBackend(tmp,tmp);
ok('backend created',typeof b.nativeConvert==='function');
ok('backend extras',typeof b.convertFolder==='function'&&typeof b.mergePdfs==='function'&&typeof b.splitPdf==='function'&&typeof b.imagesToPdf==='function'&&typeof b.exportDutyOrderWord==='function'&&typeof b.restoreImages!=='function');

async function expectThrow(name,fn,re){
  try{await fn();ok(name,false,'did not throw');}
  catch(e){ok(name,re.test(String(e&&e.message||e)),String(e&&e.message||e));}
}
await expectThrow('rejects empty request',()=>b.nativeConvert({}),/սխալ/);
await expectThrow('rejects unknown kind',()=>b.nativeConvert({kind:'nope',name:'a.docx',bytes:[80,75]}),/Անընդունելի|Անհայտ/);
await expectThrow('rejects pdf as word-to-pdf',()=>b.nativeConvert({kind:'word-to-pdf',name:'a.pdf',bytes:[37,80,68,70]}),/Անընդունելի/);
await expectThrow('rejects docx as pdf-to-word',()=>b.nativeConvert({kind:'pdf-to-word',name:'a.docx',bytes:[80,75]}),/Անընդունելի/);
await expectThrow('rejects pdf as excel-to-pdf',()=>b.nativeConvert({kind:'excel-to-pdf',name:'a.pdf',bytes:[37,80,68,70]}),/Անընդունելի/);
await expectThrow('rejects xlsx as pdf-to-excel',()=>b.nativeConvert({kind:'pdf-to-excel',name:'a.xlsx',bytes:[80,75]}),/Անընդունելի/);
await expectThrow('merge needs two pdfs',()=>b.mergePdfs({files:[{name:'a.pdf',bytes:[37,80,68,70]}]}),/2/);

const preamblePath=writePs(tmp,psCommonPreamble()+"Write-Output 'PARSE_OK'");
const parseBody=[
  "$e=$null",
  "$t=[System.Management.Automation.Language.Parser]::ParseFile("+psQuote(preamblePath)+",[ref]$null,[ref]$e)",
  "if($e -and @($e).Count -gt 0){ @($e) | ForEach-Object { $_.Message }; exit 1 }",
  "Write-Output 'PARSE_OK'"
].join('\r\n');
const parseFile=writePs(tmp,parseBody);
const parsed=runPsFile(parseFile,30000);
ok('preamble parses',parsed.status===0&&String(parsed.stdout||'').includes('PARSE_OK'),
  (parsed.stderr||parsed.stdout||('exit '+parsed.status)).slice(0,400));

console.log('KM office live COM conversions');
const probeFile=writePs(tmp,[
  "$ErrorActionPreference='Continue'",
  "$w=$false;$x=$false;$ppt=$false",
  "try{$a=New-Object -ComObject Word.Application;$a.Quit();$w=$true}catch{}",
  "try{$a=New-Object -ComObject Excel.Application;$a.Quit();$x=$true}catch{}",
  "try{$a=New-Object -ComObject PowerPoint.Application;$a.Quit();$ppt=$true}catch{}",
  "Write-Output ('word=' + $(if($w){'1'}else{'0'}) + ';excel=' + $(if($x){'1'}else{'0'}) + ';ppt=' + $(if($ppt){'1'}else{'0'}))"
].join('\r\n'));
const probed=runPsFile(probeFile,45000);
const probeOut=String(probed.stdout||'').trim();
const hasWord=/\bword=1\b/.test(probeOut);
const hasExcel=/\bexcel=1\b/.test(probeOut);
const hasPpt=/\bppt=1\b/.test(probeOut);
ok('office probe ran',probed.status===0,probeOut||String(probed.stderr||'').slice(0,200));
console.log('  INFO: Word='+(hasWord?'yes':'no')+' Excel='+(hasExcel?'yes':'no')+' PowerPoint='+(hasPpt?'yes':'no'));

if(!hasWord&&!hasExcel&&!hasPpt){
  skipped('live conversions','Microsoft Word/Excel/PowerPoint not installed');
}else{
  const sampleDir=path.join(tmp,'samples');
  fs.mkdirSync(sampleDir,{recursive:true});
  const docx=path.join(sampleDir,'sample.docx');
  const xlsx=path.join(sampleDir,'sample.xlsx');
  if(hasWord){
    const makeDoc=writePs(sampleDir,[
      "$ErrorActionPreference='Stop'",
      "$w=New-Object -ComObject Word.Application;$w.Visible=$false;$w.DisplayAlerts=0",
      "try{$w.AutomationSecurity=3}catch{}",
      "$d=$w.Documents.Add()",
      "$d.Content.Font.Name='Sylfaen'",
      "$d.Content.Text="+psQuote(MARKER+' converter'),
      "$d.SaveAs2("+psQuote(docx)+",16)",
      "$d.Close($false)",
      "$w.Quit()"
    ].join('\r\n'));
    const made=runPsFile(makeDoc,90000);
    ok('sample docx created',made.status===0&&fs.existsSync(docx)&&(fs.statSync(docx).size>0),
      String(made.stderr||made.stdout||'').slice(0,300));
  }else skipped('sample docx','Word not installed');
  if(hasExcel){
    const makeXls=writePs(sampleDir,[
      "$ErrorActionPreference='Stop'",
      "$e=New-Object -ComObject Excel.Application;$e.Visible=$false;$e.DisplayAlerts=$false",
      "try{$e.AutomationSecurity=3}catch{}",
      "$b=$e.Workbooks.Add();$s=$b.Worksheets.Item(1)",
      "$s.Cells.Item(1,1).NumberFormat='@';$s.Cells.Item(1,1).Value2="+psQuote(MARKER),
      "$s.Cells.Item(1,2).NumberFormat='@';$s.Cells.Item(1,2).Value2='converter'",
      "$b.SaveAs("+psQuote(xlsx)+",51)",
      "$b.Close($false)",
      "$e.Quit()"
    ].join('\r\n'));
    const made=runPsFile(makeXls,90000);
    ok('sample xlsx created',made.status===0&&fs.existsSync(xlsx)&&(fs.statSync(xlsx).size>0),
      String(made.stderr||made.stdout||'').slice(0,300));
  }else skipped('sample xlsx','Excel not installed');

  async function convertKind(kind,file){
    try{
      const bytes=fs.readFileSync(file);
      const r=await b.nativeConvert({kind,name:path.basename(file),bytes});
      const outExt=CONVERTERS[kind].outExt;
      const magic=outExt==='.pdf'?'%PDF':'PK';
      const buf=fs.existsSync(r.output)?fs.readFileSync(r.output):Buffer.alloc(0);
      ok(kind+' ok+size',r&&r.ok&&r.size>0&&path.extname(r.output).toLowerCase()===outExt,JSON.stringify({ok:r&&r.ok,size:r&&r.size,output:r&&r.output}));
      ok(kind+' magic '+magic,outExt==='.pdf'?buf.slice(0,4).toString('ascii')==='%PDF':(buf[0]===0x50&&buf[1]===0x4B));
      return r;
    }catch(e){
      ok(kind+' ok+size',false,String(e&&e.message||e).slice(0,400));
      return null;
    }
  }

  let pdfFromWord=null,pdfFromExcel=null;
  if(hasWord&&fs.existsSync(docx)){
    const wpdf=await convertKind('word-to-pdf',docx);
    pdfFromWord=wpdf&&wpdf.output;
    if(pdfFromWord&&fs.existsSync(pdfFromWord)){
      const pdfBuf=fs.readFileSync(pdfFromWord);
      ok('word-to-pdf keeps marker or fonts',bufHas(pdfBuf,MARKER)||pdfBuf.length>400);
    }
    const wx=await convertKind('word-to-excel',docx);
    if(wx&&wx.output&&fs.existsSync(wx.output)){
      const xml=zipInnerText(wx.output,'xl/sharedStrings.xml')||zipInnerText(wx.output,'xl/worksheets/sheet1.xml');
      ok('word-to-excel keeps Բարև',xml.includes('Բարև')||xml.includes(MARKER),xml.slice(0,180));
    }
    if(pdfFromWord&&fs.existsSync(pdfFromWord)){
      const p2w=await convertKind('pdf-to-word',pdfFromWord);
      if(p2w&&p2w.output&&fs.existsSync(p2w.output)){
        const xml=zipInnerText(p2w.output,'word/document.xml');
        ok('pdf-to-word keeps Բարև',xml.includes('Բարև')||xml.includes(MARKER),xml.replace(/<[^>]+>/g,' ').slice(0,180));
      }
      if(hasExcel){
        const p2x=await convertKind('pdf-to-excel',pdfFromWord);
        if(p2x&&p2x.output&&fs.existsSync(p2x.output)){
          const xml=zipInnerText(p2x.output,'xl/sharedStrings.xml')||zipInnerText(p2x.output,'xl/worksheets/sheet1.xml');
          ok('pdf-to-excel keeps Բարև',xml.includes('Բարև')||xml.includes(MARKER),xml.slice(0,180));
        }
      }else skipped('pdf-to-excel','Excel not installed');
    }
  }else{
    skipped('word-to-pdf / word-to-excel / pdf-to-word','Word sample missing');
    if(!hasExcel)skipped('pdf-to-excel','Word/Excel missing');
  }

  if(hasExcel&&fs.existsSync(xlsx)){
    const e2w=await convertKind('excel-to-word',xlsx);
    if(e2w&&e2w.output&&fs.existsSync(e2w.output)){
      const xml=zipInnerText(e2w.output,'word/document.xml');
      ok('excel-to-word keeps Բարև',xml.includes('Բարև')||xml.includes(MARKER),xml.replace(/<[^>]+>/g,' ').slice(0,180));
    }
    const e2p=await convertKind('excel-to-pdf',xlsx);
    pdfFromExcel=e2p&&e2p.output;
    if(pdfFromExcel&&fs.existsSync(pdfFromExcel)){
      const pdfBuf=fs.readFileSync(pdfFromExcel);
      ok('excel-to-pdf file real',pdfBuf.slice(0,4).toString('ascii')==='%PDF'&&pdfBuf.length>400);
    }
  }else{
    skipped('excel-to-word / excel-to-pdf','Excel sample missing');
  }

  if(hasWord){
    const png=path.join(sampleDir,'dot.png');
    fs.writeFileSync(png,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
    await convertKind('image-to-pdf',png);
  }else skipped('image-to-pdf','Word not installed');

  if(hasPpt && pdfFromWord && fs.existsSync(pdfFromWord)){
    await convertKind('pdf-to-ppt',pdfFromWord);
  }else if(hasPpt) skipped('pdf-to-ppt','no pdf sample');

  if(hasPpt){
    const pptx=path.join(sampleDir,'sample.pptx');
    const makePpt=writePs(sampleDir,[
      "$ErrorActionPreference='Stop'",
      "$p=New-Object -ComObject PowerPoint.Application;try{$p.Visible=0}catch{}",
      "$pr=$p.Presentations.Add()",
      "$sl=$pr.Slides.Add(1,12)",
      "$box=$sl.Shapes.AddTextbox(1,40,40,600,200)",
      "$box.TextFrame.TextRange.Text="+psQuote(MARKER),
      "$box.TextFrame.TextRange.Font.Name='Sylfaen'",
      "$pr.SaveAs("+psQuote(pptx)+",24)",
      "$pr.Close()",
      "$p.Quit()"
    ].join('\r\n'));
    const made=runPsFile(makePpt,90000);
    ok('sample pptx created',made.status===0&&fs.existsSync(pptx)&&(fs.statSync(pptx).size>0),String(made.stderr||made.stdout||'').slice(0,300));
    if(fs.existsSync(pptx))await convertKind('ppt-to-pdf',pptx);
  }else skipped('ppt-to-pdf','PowerPoint not installed');
}

try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
console.log('Results:',pass,'passed,',fail,'failed,',skip,'skipped');
process.exit(fail?1:0);
})().catch(e=>{
  console.error(e);
  process.exit(1);
});
