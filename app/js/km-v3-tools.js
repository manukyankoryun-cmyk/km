/* KM v3 tools: undo UI, conflict fix, table export, print presets, formal context */
(function(){
  'use strict';

  function esc(s){return typeof window.esc==='function'?window.esc(s):String(s??'');}
  function clone(x){return typeof window.clone==='function'?window.clone(x):JSON.parse(JSON.stringify(x));}
  function toastMsg(m){if(typeof toast==='function')toast(m);else if(typeof kmNotify==='function')kmNotify(m);else alert(m);}

  function ensureDbTools(){
    if(typeof db==='undefined')return;
    db.printPresets=Array.isArray(db.printPresets)?db.printPresets:[];
  }

  /* ---- Formal graph context (per-graph templates) ---- */
  window.kmFormalGraphKey=function(owner){
    if(!owner||typeof db==='undefined')return 'main';
    if(owner===db.schedule)return 'main';
    const map=db.dutyTypeSchedules||{};
    for(const k of Object.keys(map)){
      if(map[k]===owner)return k;
    }
    return 'main';
  };

  window.kmFormalGraphLabel=function(owner){
    if(!owner||owner===db.schedule)return String(db.schedule?.name||'Հիմնական');
    const key=window.kmFormalGraphKey(owner);
    const idx=Number(String(key).replace('duty_',''));
    if(!Number.isNaN(idx)&&(db.dutyTypes||[])[idx])return String(db.dutyTypes[idx]);
    return String(owner.name||key);
  };

  window.kmSetFormalContext=function(owner,label){
    const o=owner||(typeof db!=='undefined'?db.schedule:null);
    window.kmFormalContext={
      owner:o,
      key:window.kmFormalGraphKey(o),
      label:label||window.kmFormalGraphLabel(o)
    };
  };

  window.kmCurrentFormalOwner=function(){
    return (window.kmFormalContext&&window.kmFormalContext.owner)||
      (typeof db!=='undefined'?db.schedule:null);
  };

  /* ---- Undo / Redo toolbar ---- */
  function injectUndoToolbar(){
    const tb=document.querySelector('.main .top .toolbar');
    if(!tb||document.getElementById('kmUndoBtn'))return;
    const undo=document.createElement('button');
    undo.type='button';undo.id='kmUndoBtn';undo.title='Ctrl+Z — Հետարկել';
    undo.textContent='↶ Հետարկել';
    undo.onclick=()=>{if(typeof kmUndo==='function')kmUndo();};
    const redo=document.createElement('button');
    redo.type='button';redo.id='kmRedoBtn';redo.title='Ctrl+Y — Կրկնել';
    redo.textContent='↷ Կրկնել';
    redo.onclick=()=>{if(typeof kmRedo==='function')kmRedo();};
    const saveBtn=document.getElementById('saveBtn');
    if(saveBtn){
      saveBtn.insertAdjacentElement('afterend',redo);
      saveBtn.insertAdjacentElement('afterend',undo);
    }else{
      tb.insertBefore(undo,tb.firstChild);
      tb.insertBefore(redo,undo.nextSibling);
    }
  }

  /* ---- Conflict auto-fix ---- */
  window.kmAutoFixConflicts=async function(){
    if(typeof window.kmCanEdit==='function'&&!window.kmCanEdit()){toastMsg('Դիտորդի իրավունք');return;}
    if(typeof kmDetectConflicts!=='function'){toastMsg('Կոնֆլիկտների մոդուլը բացակայում է');return;}
    const list=kmDetectConflicts();
    if(!list.length){toastMsg('Խնդիր չի հայտնաբերվել');return;}
    if(!confirm(`Ավտոմատ ուղղե՞լ ${list.length} խնդիր(ներ)ը\n(արձակուրդ/անհարմար/կրկնակի հերթապահություն)`))return;
    if(typeof kmPushUndo==='function')kmPushUndo('մինչ conflict fix',clone(db));
    const s=db.schedule||{};
    const y=+s.year,m=+s.month,days=new Date(y,m,0).getDate();
    s.rows=s.rows||{};
    let fixed=0;
    const people=(db.people||[]).filter(p=>!(typeof kmPersonNotPlannable==='function'?kmPersonNotPlannable(p):(window.kmPersonIsBlocked&&kmPersonIsBlocked(p))));

    for(let d=1;d<=days;d++){
      const onDuty=[];
      people.forEach(p=>{
        const row=s.rows[p.name]=s.rows[p.name]||{};
        const v=String(row[d]||'').trim();
        if(v==='Հերթապահ')onDuty.push(p.name);
        const onVac=typeof isPersonOnVacation==='function'&&isPersonOnVacation(p.name,new Date(y,m-1,d,12,0,0));
        const badDay=(p.bad||[]).map(Number).includes(d);
        if(v==='Հերթապահ'&&(onVac||badDay)){
          row[d]='';
          fixed++;
        }
      });
      if(onDuty.length>1){
        onDuty.slice(1).forEach(name=>{
          if(s.rows[name]){s.rows[name][d]='';fixed++;}
        });
      }
    }
    if(typeof kmRebalancePlanForVacations==='function'){
      await kmRebalancePlanForVacations({silent:true});
    }else if(typeof save==='function'){
      await save(true);
    }
    if(typeof render==='function')render();
    if(typeof kmShowConflictBanner==='function')kmShowConflictBanner();
    toastMsg('Ուղղվել է '+fixed+' նշում');
  };

  /* ---- Table export ---- */
  function currentTable(){
    ensureDbTools();
    const i=Math.min(Math.max(0,typeof selectedTable!=='undefined'?selectedTable:0),Math.max(0,(db.tables||[]).length-1));
    return db.tables[i];
  }

  window.kmTableExportCsv=function(){
    const t=currentTable();if(!t){toastMsg('Աղյուսակ չկա');return;}
    const sep=';';
    const line=arr=>arr.map(c=>{
      const v=String(c??'');
      return v.includes(sep)||v.includes('"')||v.includes('\n')?'"'+v.replace(/"/g,'""')+'"':v;
    }).join(sep);
    const rows=[line(t.headers||[]),...(t.rows||[]).map(r=>line(r))];
    const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(String(t.name||'table').replace(/[<>:"/\\|?*]/g,'_')||'table')+'.csv';
    a.click();
    toastMsg('CSV արտահանված');
  };

  window.kmTableExportHtml=function(){
    const t=currentTable();if(!t){toastMsg('Աղյուսակ չկա');return;}
    const heads=(t.headers||[]).map(h=>`<th>${esc(h)}</th>`).join('');
    const body=(t.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    const html=`<!doctype html><html lang="hy"><head><meta charset="utf-8"><title>${esc(t.name||'Աղյուսակ')}</title>
<style>body{font-family:"Times Armenian",serif;padding:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;padding:6px 8px}th{background:#eef2f5}</style></head>
<body><h2>${esc(t.name||'Աղյուսակ')}</h2><table><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const w=window.open('','_blank');
    if(w){w.document.write(html);w.document.close();}
    else toastMsg('Popup արգելված — թույլատրեք popup');
  };

  window.kmTableExportPdf=async function(){
    const t=currentTable();if(!t){toastMsg('Աղյուսակ չկա');return;}
    const heads=(t.headers||[]).map(h=>`<th>${esc(h)}</th>`).join('');
    const body=(t.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    const html=`<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:10mm}table{width:100%;border-collapse:collapse;font-size:10pt}th,td{border:.3mm solid #333;padding:3mm}</style></head>
<body><h2 style="text-align:center">${esc(t.name||'Աղյուսակ')}</h2><table><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    try{
      if(window.kmNative&&window.kmNative.export&&window.kmNative.export.batchPrintPdf){
        const preset=window.kmActivePrintPreset||{};
        const r=await window.kmNative.export.batchPrintPdf({
          title:String(t.name||'KM_Table').replace(/[<>:"/\\|?*]/g,'_'),
          html,
          settings:{pageSize:preset.pageSize||'A4',orientation:preset.orientation||'landscape'}
        });
        if(r.cancelled)return;
        toastMsg('PDF՝ '+r.path);
      }else{
        kmTableExportHtml();
      }
    }catch(e){toastMsg(e.message||'PDF error');}
  };

  /* ---- Print presets ---- */
  window.kmApplyPrintPresetToDialog=function(dlg,preset){
    if(!dlg||!preset)return;
    const set=(sel,v)=>{const el=dlg.querySelector(sel);if(el&&v!=null&&v!=='')el.value=String(v);};
    const chk=(sel,v)=>{const el=dlg.querySelector(sel);if(el)el.checked=!!v;};
    set('#kmPageSize',preset.pageSize);
    set('#kmOrientation',preset.orientation);
    set('#kmScaleFactor',preset.scaleFactor);
    set('#kmNativeCopies',preset.copies);
    set('#kmColor',preset.color===false?'gray':'color');
    set('#kmDuplex',preset.duplexMode);
    set('#kmPagesPerSheet',preset.pagesPerSheet);
    set('#kmDpi',preset.dpi);
    set('#kmMarginType',preset.marginType);
    chk('#kmPrintBackground',preset.printBackground!==false);
    if(preset.watermark!=null)window.kmPrintWatermark=String(preset.watermark);
  };

  window.kmSavePrintPreset=function(){
    ensureDbTools();
    const name=prompt('Preset անուն (օր. «Պաշտոնական A4»)');if(!name)return;
    const p=window.kmActivePrintPreset||window.kmLastPrintSettings||{
      pageSize:'A4',orientation:'landscape',scaleFactor:100,copies:1,
      color:true,duplexMode:'simplex',pagesPerSheet:1,dpi:'',
      marginType:'none',printBackground:true,watermark:window.kmPrintWatermark||''
    };
    db.printPresets.push({name:name.trim(),...p,savedAt:new Date().toISOString()});
    if(typeof save==='function')save(true);
    toastMsg('Print preset պահպանված');
  };

  window.kmLoadPrintPreset=function(i){
    ensureDbTools();
    const p=db.printPresets[i];if(!p)return;
    window.kmActivePrintPreset={...p};
    if(p.watermark!=null)window.kmPrintWatermark=String(p.watermark);
    toastMsg('Preset՝ '+p.name);
  };

  window.kmDeletePrintPreset=function(i){
    ensureDbTools();
    if(!confirm('Ջնջե՞լ preset-ը'))return;
    db.printPresets.splice(i,1);
    if(typeof save==='function')save(true);
    kmOpenPrintPresetManager();
  };

  window.kmOpenPrintPresetManager=function(){
    ensureDbTools();
    const rows=(db.printPresets||[]).map((p,i)=>`<tr>
      <td><b>${esc(p.name)}</b></td>
      <td>${esc(p.pageSize||'A4')} / ${esc(p.orientation||'landscape')}</td>
      <td>${esc(p.watermark||'—')}</td>
      <td>
        <button type="button" onclick="kmLoadPrintPreset(${i})">Կիրառել</button>
        <button type="button" onclick="kmDeletePrintPreset(${i})">Ջնջել</button>
      </td></tr>`).join('');
    content.innerHTML=`<div class="card"><div class="toolbar">${typeof window.kmBackBtnHtml==='function'?window.kmBackBtnHtml('kmReportsBack()'):'<button type="button" onclick="kmReportsBack()">← Վերադարձ</button>'}<button type="button" onclick="kmSavePrintPreset()">+ Պահպանել ընթացիկ preset</button>
        <button type="button" onclick="kmRememberAndOpen({kind:'page',value:'schedule'},()=>{page='schedule';render();})">Գրաֆիկ / Տպել</button>
      </div>
      <h3>Տպման preset-ներ</h3>
      <p class="muted">Preset-ը կիրառելուց հետո «Տպել» dialog-ում արժեքները ավտոմատ լրացվում են։</p>
      <div class="gridwrap"><table class="grid"><thead><tr><th>Անուն</th><th>Ձևաչափ</th><th>Watermark</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="4">Preset չկա — ստեղծեք «Պահպանել ընթացիկ preset»</td></tr>'}</tbody></table></div></div>`;
    page='printPresets';
    document.getElementById('pageTitle').textContent='Տպման preset-ներ';
  };

  function patchPrintDialog(){
    if(typeof window.kmOpenDialog!=='function'||window.kmOpenDialog.__kmPreset)return;
    const orig=window.kmOpenDialog;
    window.kmOpenDialog=function(title,bodyHtml,onSave,saveText){
      const dlg=orig(title,bodyHtml,onSave,saveText);
      if(String(title).includes('Տպման')&&window.kmActivePrintPreset){
        setTimeout(()=>kmApplyPrintPresetToDialog(dlg,window.kmActivePrintPreset),30);
      }
      return dlg;
    };
    window.kmOpenDialog.__kmPreset=true;
  }

  function patchPrintNativeCollect(){
    if(typeof window.kmPrintNativeFromHtml!=='function'||window.kmPrintNativeFromHtml.__kmPresetHook)return;
    const orig=window.kmPrintNativeFromHtml;
    window.kmPrintNativeFromHtml=async function(title,docHtml){
      try{
        const r=await orig(title,docHtml);
        return r;
      }finally{
        /* keep active preset for next print */
      }
    };
    window.kmPrintNativeFromHtml.__kmPresetHook=true;
  }

  function patchScheduleContext(){
    const orig=window.schedule;
    if(typeof orig==='function'&&!window.schedule.__kmFormalCtx){
      window.schedule=function(){
        orig();
        kmSetFormalContext(db.schedule,db.schedule?.name||'Հիմնական');
      };
      window.schedule.__kmFormalCtx=true;
    }
    const duty=window.renderDutyTypePlanning;
    if(typeof duty==='function'&&!duty.__kmFormalCtx){
      window.renderDutyTypePlanning=function(index){
        duty(index);
        const key='duty_'+Number(index);
        const sch=(db.dutyTypeSchedules||{})[key];
        const label=(db.dutyTypes||[])[index]||sch?.name||key;
        if(sch)kmSetFormalContext(sch,label);
      };
      window.renderDutyTypePlanning.__kmFormalCtx=true;
    }
  }

  function patchTablesExport(){
    const orig=window.tablesPage;
    if(typeof orig!=='function'||window.tablesPage.__kmExport)return;
    window.tablesPage=function(){
      orig();
      const tb=document.querySelector('#content .toolbar');
      if(!tb||tb.querySelector('[data-km-table-export]'))return;
      if(document.getElementById('kmSsRoot'))return;
      const wrap=document.createElement('span');
      wrap.dataset.kmTableExport='1';
      wrap.style.cssText='display:inline-flex;gap:6px;margin-left:8px';
      wrap.innerHTML=`
        <button type="button" onclick="kmTableExportCsv()">CSV</button>
        <button type="button" onclick="kmTableExportHtml()">HTML</button>
        <button type="button" onclick="kmTableExportPdf()">PDF</button>`;
      tb.appendChild(wrap);
    };
    window.tablesPage.__kmExport=true;
  }

  document.addEventListener('DOMContentLoaded',()=>{
    ensureDbTools();
    injectUndoToolbar();
    patchPrintDialog();
    patchPrintNativeCollect();
    patchScheduleContext();
    patchTablesExport();
    if(typeof window.normalize==='function'&&!window.normalize.__kmTools){
      const _n=window.normalize;
      window.normalize=function(){_n();ensureDbTools();};
      window.normalize.__kmTools=true;
    }
  });
})();
