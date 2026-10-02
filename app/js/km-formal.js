/* KM formal block — single source for editable UI, print HTML, and native print CSS */
/* KM_GRAPH_FOOTER_ALIGN_V1: equal rank|signature|name columns (1fr 24mm 1fr) on all graphs */
(function(){
  'use strict';

  function escHtml(v){
    if(typeof window.esc==='function')return window.esc(v);
    return String(v ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  function cloneData(x){
    if(typeof window.clone==='function')return window.clone(x);
    return JSON.parse(JSON.stringify(x));
  }

  function dbRef(){
    return typeof db!=='undefined'?db:null;
  }

  window.kmFormalDefaults=function(){
    return {
      approveTitle:'«ՀԱՍՏԱՏՈՒՄ ԵՄ»',
      approveLine1:'',
      approveLine2Left:'',
      approveLine2Right:'',
      approveDate:'',
      bottomTitle:'',
      bottomTitle2:'',
      bottomLeft:'',
      bottomRight:''
    };
  };

  function kmSplitRankName(text){
    const s=String(text||'').trim();
    if(!s)return null;
    const m=s.match(/^(\S+(?:\/\S+)?)\s+(.+)$/u);
    if(m&&m[2])return {left:m[1],right:m[2]};
    return null;
  }

  function kmNormalizeFormalFields(f){
    const out={...window.kmFormalDefaults(),...(f||{})};
    if(out.bottomTitle && !out.bottomTitle2){
      const parts=String(out.bottomTitle).split(/\n+/).map(x=>x.trim()).filter(Boolean);
      if(parts.length>1){
        out.bottomTitle=parts[0];
        out.bottomTitle2=parts.slice(1).join(' ');
      }
    }
    if(out.bottomTitle2 && !out.bottomLeft && !out.bottomRight){
      const split=kmSplitRankName(out.bottomTitle2);
      if(split){
        out.bottomLeft=split.left;
        out.bottomRight=split.right;
        out.bottomTitle2='';
      }
    }
    if(out.bottomLeft && !out.bottomRight){
      const split=kmSplitRankName(out.bottomLeft);
      if(split){
        out.bottomLeft=split.left;
        out.bottomRight=split.right;
      }
    }
    return out;
  };

  window.kmFormalData=function(owner){
    const d=dbRef();
    let target=(owner&&typeof owner==='object')?owner:null;
    if(!target && typeof window.kmCurrentFormalOwner==='function'){
      try{ target=window.kmCurrentFormalOwner(); }catch(_){}
    }
    if(!target) target=d&&(d.schedule||d);
    if(!target) return window.kmFormalDefaults();
    if(!target.formalGraph || typeof target.formalGraph!=='object'){
      target.formalGraph=kmNormalizeFormalFields({});
    }else{
      target.formalGraph=kmNormalizeFormalFields(target.formalGraph);
    }
    return target.formalGraph;
  };

  window.kmFormalEditable=function(key,value,cls){
    return `<span class="kmFormalEditable ${cls||''}" contenteditable="true" data-formal-key="${key}" spellcheck="false">${escHtml(value||'')}</span>`;
  };

  function kmFormalSignRowEditable(leftKey,leftVal,rightKey,rightVal,rowCls){
    /* KM_GRAPH_FOOTER_ALIGN_V1: equal flex/grid halves around signature */
    return `<div class="kmFormalSignLine kmFormalTopSignRow ${rowCls||''}">
      ${window.kmFormalEditable(leftKey,leftVal,'kmFormalHalfEdit kmFormalLeftEdit')}
      <span class="kmFormalBlankSignature kmFormalTopSignatureSlot" aria-hidden="true"></span>
      ${window.kmFormalEditable(rightKey,rightVal,'kmFormalHalfEdit kmFormalRightEdit')}
    </div>`;
  }

  function kmFormalSignRowPrint(left,right,rowCls){
    return `<div class="kmFormalSignLine kmFormalTopSignRow ${rowCls||''}">
      <span class="kmFormalPrintLeft">${escHtml(left||'')}</span>
      <span class="kmFormalBlankSignature kmFormalTopSignatureSlot" aria-hidden="true"></span>
      <span class="kmFormalPrintRight">${escHtml(right||'')}</span>
    </div>`;
  }

  window.kmFormalTopBlock=function(owner){
    const f=window.kmFormalData(owner);
    return `<div class="kmFormalTopBlock">
    <div class="kmFormalApproval">
      <div class="kmFormalApproveTitle">${window.kmFormalEditable('approveTitle',f.approveTitle)}</div>
      <div class="kmFormalEditLine">${window.kmFormalEditable('approveLine1',f.approveLine1,'kmFormalWideEdit')}</div>
      ${kmFormalSignRowEditable('approveLine2Left',f.approveLine2Left,'approveLine2Right',f.approveLine2Right,'')}
      <div class="kmFormalDate">${window.kmFormalEditable('approveDate',f.approveDate,'kmFormalDateEdit')}</div>
    </div>
  </div>`;
  };

  window.kmFormalBottomBlock=function(owner){
    const f=window.kmFormalData(owner);
    const title2=f.bottomTitle2
      ? `<div class="kmFormalEditLine kmFormalBottomTitleLine2">${window.kmFormalEditable('bottomTitle2',f.bottomTitle2,'kmFormalWideEdit')}</div>`
      : '';
    return `<div class="kmFormalBottomBlock">
    <div class="kmFormalBottomApproval">
      <div class="kmFormalEditLine kmFormalBottomTitleLine">${window.kmFormalEditable('bottomTitle',f.bottomTitle,'kmFormalWideEdit')}</div>
      ${title2}
      ${kmFormalSignRowEditable('bottomLeft',f.bottomLeft,'bottomRight',f.bottomRight,'')}
    </div>
  </div>`;
  };

  window.kmBindFormalEditable=function(root,owner){
    const boundOwner=owner||(typeof window.kmCurrentFormalOwner==='function'?window.kmCurrentFormalOwner():null);
    const scope=root&&root.querySelectorAll?root:document;
    scope.querySelectorAll('[data-formal-key]').forEach(el=>{
      if(el.dataset.kmFormalBound==='1')return;
      el.dataset.kmFormalBound='1';
      el.addEventListener('input',()=>{
        const f=window.kmFormalData(boundOwner);
        f[el.dataset.formalKey]=String(el.textContent||'').trim();
      });
      el.addEventListener('blur',async()=>{
        const f=window.kmFormalData(boundOwner);
        f[el.dataset.formalKey]=String(el.textContent||'').trim();
        try{
          if(typeof save==='function')await save(true);
        }catch(e){console.error('formal block save',e);}
      });
      el.addEventListener('keydown',e=>{
        if(e.key==='Enter'){
          e.preventDefault();
          el.blur();
        }
      });
    });
  };

  window.kmUniversalGraphPrintCss=function(){
    return `
  @page{size:A4 landscape;margin:7mm}
  html,body{width:297mm;min-width:297mm;margin:0;padding:0;background:#fff}
  body{font-family:"Times Armenian",serif}
  .kmPrintPaper,.a4PrintPaper,.dutyPrintPaper,.archivePrintPaper{box-sizing:border-box;position:relative;width:283mm;max-width:283mm;min-width:283mm;margin:0 auto;padding:0;overflow:visible}
  .kmFormalTopBlock{position:relative;width:283mm;height:34mm;min-height:34mm;margin:0;padding:0;transform:none}
  .kmFormalTopBlock .kmFormalApproval{position:absolute;left:14mm;top:3mm;width:92mm;max-width:92mm;margin:0;padding:0;text-align:center;transform:none}
  .kmFormalApproveTitle,.kmFormalEditLine,.kmFormalDate{width:92mm;max-width:92mm;text-align:center}
  .kmFormalTopSignRow{width:100%;display:grid;grid-template-columns:minmax(0,1fr) 24mm minmax(0,1fr);column-gap:2mm;align-items:end;margin-top:1.5mm;box-sizing:border-box}
  .kmFormalLeftEdit,.kmFormalPrintLeft{width:100%;min-width:0;max-width:100%;text-align:right;padding-right:1mm;white-space:nowrap;box-sizing:border-box}
  .kmFormalTopSignatureSlot{width:24mm;min-width:24mm;max-width:24mm;height:7mm;justify-self:center}
  .kmFormalRightEdit,.kmFormalPrintRight{width:100%;min-width:0;max-width:100%;text-align:left;padding-left:1mm;white-space:nowrap;box-sizing:border-box}
  h1,h2,.graphDisplayTitle,.mainScheduleGraphTitle,.dutySelectedGraphTitle,.dutyGraphTitle,.archiveGraphTitle,.graphSingleTitle{width:100%;margin:3mm auto;text-align:center;transform:none;white-space:normal;word-wrap:break-word;overflow-wrap:anywhere}
  .kmPPPeriod,.kmNativeGraphWord,.graphWord{margin:0 auto 3mm;text-align:center}
  table,.a4SystemTable,.kmPPTable,.dutyScheduleTable,.archiveScheduleTable{width:275mm;max-width:275mm;min-width:275mm;margin:0 auto;border-collapse:collapse;table-layout:fixed;transform:none}
  .a4RankCol,.kmPPRank,.dutyRankCol,.archiveRankCol{width:11mm;min-width:11mm;max-width:11mm}
  .a4PersonCol,.kmPPName,.dutyPersonCol,.archivePersonCol{width:50mm;min-width:50mm;max-width:50mm}
  .kmFormalBottomBlock{position:relative;width:92mm;max-width:92mm;min-width:92mm;min-height:18mm;margin:6mm auto 0;padding:0;text-align:center;transform:none}
  .kmFormalBottomApproval{width:92mm;max-width:92mm;margin:0 auto;padding:0;text-align:center;font-size:10pt;line-height:1.05}
  .kmFormalBottomApproval .kmFormalEditLine,.kmFormalBottomApproval .kmFormalBottomTitleLine{width:100%;max-width:100%;margin:0 auto 1mm;text-align:center;font-weight:800}
  .kmFormalBottomApproval .kmFormalBottomTitleLine2{margin-top:.8mm}
  .kmFormalBottomApproval .kmFormalTopSignRow{width:100%!important;max-width:100%!important;margin:1.5mm auto 0!important}
  .kmFormalTopSignRow .kmFormalLeftEdit,.kmFormalTopSignRow .kmFormalRightEdit,
  .kmFormalTopSignRow .kmFormalPrintLeft,.kmFormalTopSignRow .kmFormalPrintRight,
  .kmFormalBottomSignRow .kmFormalEditable{
    border-bottom:0!important;background:transparent!important;min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important;
  }
  .kmFormalTopSignRow .kmFormalTopSignatureSlot,
  .kmFormalBottomBlock .kmFormalTopSignatureSlot{
    width:24mm!important;min-width:24mm!important;max-width:24mm!important;
    height:7mm!important;border-bottom:.25mm solid #000!important;
  }
  .kmFormalBottomBlock .kmFormalLeftEdit,.kmFormalBottomBlock .kmFormalPrintLeft{
    text-align:right!important;padding-right:1mm!important;white-space:nowrap!important;
  }
  .kmFormalBottomBlock .kmFormalRightEdit,.kmFormalBottomBlock .kmFormalPrintRight{
    text-align:left!important;padding-left:1mm!important;white-space:nowrap!important;
  }
  `;
  };

  window.kmFormalPrintTopBlock=function(owner){
    const f=window.kmFormalData(owner);
    return `<div class="kmFormalTopBlock">
    <div class="kmFormalApproval">
      <div class="kmFormalApproveTitle">${escHtml(f.approveTitle||'')}</div>
      <div class="kmFormalEditLine">${escHtml(f.approveLine1||'')}</div>
      ${kmFormalSignRowPrint(f.approveLine2Left,f.approveLine2Right,'')}
      <div class="kmFormalDate">${escHtml(f.approveDate||'')}</div>
    </div>
  </div>`;
  };

  window.kmFormalPrintBottomBlock=function(owner){
    const f=window.kmFormalData(owner);
    const title2=f.bottomTitle2?`<div class="kmFormalEditLine kmFormalBottomTitleLine2">${escHtml(f.bottomTitle2)}</div>`:'';
    return `<div class="kmFormalBottomBlock">
    <div class="kmFormalBottomApproval">
      <div class="kmFormalEditLine kmFormalBottomTitleLine">${escHtml(f.bottomTitle||'')}</div>
      ${title2}
      ${kmFormalSignRowPrint(f.bottomLeft,f.bottomRight,'')}
    </div>
  </div>`;
  };

  window.kmFormalNativePrintCss=function(){
    return `
/* TOP BLOCK — fixed to the A4 page, never to the browser viewport */
.kmFormalTopBlock{
  position:relative!important;
  display:block!important;
  width:283mm!important;
  height:34mm!important;
  min-height:34mm!important;
  margin:0!important;
  padding:0!important;
  transform:none!important;
}
.kmFormalApproval{
  position:absolute!important;
  left:14mm!important;
  top:10mm!important;
  width:92mm!important;
  max-width:92mm!important;
  margin:0!important;
  padding:0!important;
  text-align:center!important;
  transform:none!important;
  font-size:10pt!important;
  line-height:1.05!important;
}
.kmFormalApproveTitle,.kmFormalEditLine,.kmFormalDate{
  display:block!important;
  position:relative!important;
  width:92mm!important;
  max-width:92mm!important;
  margin-left:auto!important;
  margin-right:auto!important;
  text-align:center!important;
  transform:none!important;
}
.kmFormalApproveTitle{font-weight:800!important;margin-bottom:1mm!important}
.kmFormalTopSignRow,
.kmFormalBottomApproval .kmFormalTopSignRow,
.kmFormalBottomApproval .kmFormalBottomSignRow{
  position:relative!important;
  display:grid!important;
  width:100%!important;
  max-width:100%!important;
  grid-template-columns:minmax(0,1fr) 24mm minmax(0,1fr)!important; /* KM_GRAPH_FOOTER_ALIGN_V1 */
  column-gap:2mm!important;
  align-items:end!important;
  margin:1.5mm auto 0!important;
  padding:0!important;
  transform:none!important;
}
.kmFormalPrintLeft,.kmFormalLeftEdit{
  position:static!important;
  text-align:right!important;
  white-space:nowrap!important;
  padding-right:1mm!important;
}
.kmFormalTopSignatureSlot{
  display:block!important;
  width:24mm!important;min-width:24mm!important;max-width:24mm!important;
  height:7mm!important;
  justify-self:center!important;
  border-bottom:.25mm solid #000!important;
}
.kmFormalPrintRight,.kmFormalRightEdit{
  position:static!important;
  text-align:left!important;
  white-space:nowrap!important;
  padding-left:1mm!important;
}
.kmFormalDate{margin-top:1mm!important}
.kmFormalTopSignRow .kmFormalLeftEdit,.kmFormalTopSignRow .kmFormalRightEdit,
.kmFormalTopSignRow .kmFormalPrintLeft,.kmFormalTopSignRow .kmFormalPrintRight,
.kmFormalBottomSignRow .kmFormalEditable{
  border-bottom:0!important;background:transparent!important;min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important;
}
.kmFormalTopSignRow .kmFormalTopSignatureSlot,
.kmFormalBottomBlock .kmFormalTopSignatureSlot{
  display:block!important;
  width:24mm!important;min-width:24mm!important;max-width:24mm!important;
  height:7mm!important;border-bottom:.25mm solid #000!important;
}
.kmFormalBottomBlock{
  position:relative!important;
  display:block!important;
  clear:both!important;
  width:92mm!important;
  max-width:92mm!important;
  min-width:92mm!important;
  min-height:18mm!important;
  margin:10mm auto 0!important;
  padding:0!important;
  transform:none!important;
  text-align:center!important;
  font-size:10pt!important;
  line-height:1.05!important;
}
.kmFormalBottomApproval{
  width:92mm!important;
  max-width:92mm!important;
  margin:0 auto!important;
  padding:0!important;
  text-align:center!important;
}
.kmFormalBottomApproval .kmFormalEditLine,
.kmFormalBottomApproval .kmFormalBottomTitleLine{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  margin:0 auto 1mm!important;
  text-align:center!important;
  font-weight:800!important;
}
.kmFormalBottomApproval .kmFormalBottomTitleLine2{margin-top:.8mm!important}
.kmFormalBottomApproval .kmFormalTopSignRow{
  width:92mm!important;
  max-width:92mm!important;
  margin:1.5mm auto 0!important;
}
.kmFormalChiefTitle{
  display:block!important;
  width:108mm!important;
  margin:0 0 2mm!important;
  padding:0!important;
  text-align:center!important;
  font-weight:800!important;
}
`;
  };
})();
