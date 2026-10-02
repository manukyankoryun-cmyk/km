/* Shared by the offline catalog builder and reader. No legal wording is rewritten. */
(function(root){
  'use strict';
  var heading=/^(?:[⚖\s]*)(ՄԱՍ|Մաս|ԲԱԺԻՆ|Բաժին|ԵՆԹԱԲԱԺԻՆ|Ենթաբաժին|ԳԼՈՒԽ|Գլուխ|ՀՈԴՎԱԾ|Հոդված|ՀԱՎԵԼՎԱԾ|Հավելված|ԱՂՅՈՒՍԱԿ|Աղյուսակ)\s*(?:N\s*|№\s*)?([0-9]+(?:[.․\-–][0-9]+)*|[IVXLCDM]+|[Ա-Ֆ]+)(?:[.):՝]?)(?=\s|$)/;
  function normalize(text){
    return String(text||'').replace(/&#(x[0-9a-f]+|\d+);?/gi,function(all,n){var c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):all;})
      .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&')
      .replace(/\r\n?/g,'\n').replace(/\f/g,'\n\n').replace(/\u00a0/g,' ')
      .replace(/^[ \t]*⚖[ \t]*/gm,'').trim();
  }
  function level(label){return /^(ՄԱՍ|Մաս|ՀԱՎԵԼՎԱԾ|Հավելված)/.test(label)?1:/^(ԲԱԺԻՆ|Բաժին)/.test(label)?2:/^(ԵՆԹԱԲԱԺԻՆ|Ենթաբաժին)/.test(label)?3:/^(ԳԼՈՒԽ|Գլուխ)/.test(label)?4:5;}
  function build(input,limit){
    var text=normalize(input),blocks=[],outline=[],re=/[^\n]+(?:\n(?!\n)[^\n]+)*/g,m;
    limit=limit||9000;
    while((m=re.exec(text))){
      var raw=m[0],label=raw.trim(),hm=heading.exec(label),lev=hm?level(label):0;
      // A heading number and its title may be separate source paragraphs.
      var block={start:m.index,end:m.index+raw.length,level:lev};
      if(hm&&label===hm[0].trim()){
        var tail=text.slice(block.end),next=/^\n\n+([^\n]+)(?=\n|$)/.exec(tail);
        if(next&&!heading.test(next[1].trim())&&!/^\s*\d+[.)]/.test(next[1])&&next[1].length<300){
          block.end+=next[0].length;re.lastIndex=block.end;label+=' '+next[1].trim();
        }
      }
      blocks.push(block);
      if(lev)outline.push({pos:block.start,label:label.replace(/\s+/g,' '),level:lev,chapter:lev<5});
    }
    var starts=[0],pageStart=0;
    blocks.forEach(function(b,i){
      var next=blocks[i+1],end=b.end;
      // Keep each structural heading with at least the following paragraph.
      if(b.level&&next)end=next.end;
      if(end-pageStart>limit&&b.start>pageStart){starts.push(b.start);pageStart=b.start;}
      // Very long individual paragraphs are split at word boundaries only.
      while(b.end-pageStart>limit*2){
        var cut=text.lastIndexOf(' ',pageStart+limit);
        if(cut<=pageStart)cut=pageStart+limit;
        else cut++;
        starts.push(cut);pageStart=cut;
      }
    });
    return {text:text,starts:starts,outline:outline,blocks:blocks};
  }
  function pageAt(starts,pos){var lo=0,hi=starts.length;while(lo+1<hi){var mid=(lo+hi)>>1;if(starts[mid]<=pos)lo=mid;else hi=mid;}return lo;}
  var api={build:build,pageAt:pageAt,heading:heading,level:level};
  if(typeof window==='object')root.kmLegalModel=api;else if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:this);

/* KM LEGAL INLINE V1: local text reader. Does not misrepresent absent ARLIS texts as complete laws. */
(function () {
  'use strict';
  var codes = {
    constitution:['ՀՀ ՍԱՀՄԱՆԱԴՐՈՒԹՅՈՒՆ','143723'], electoral:['ՀՀ ԸՆՏՐԱԿԱՆ ՕՐԵՆՍԳԻՐՔ','105967'],
    admin_offenses:['ՎԱՐՉԱԿԱՆ ԻՐԱՎԱԽԱԽՏՈՒՄՆԵՐԻ ՎԵՐԱԲԵՐՅԱԼ ՀՀ ՕՐԵՆՍԳԻՐՔ','20'],
    civil:['ՀՀ ՔԱՂԱՔԱՑԻԱԿԱՆ ՕՐԵՆՍԳԻՐՔ','29'],land:['ՀՀ ՀՈՂԱՅԻՆ ՕՐԵՆՍԳԻՐՔ','39'],
    water:['ՀՀ ՋՐԱՅԻՆ ՕՐԵՆՍԳԻՐՔ','41'],family:['ՀՀ ԸՆՏԱՆԵԿԱՆ ՕՐԵՆՍԳԻՐՔ','49'],
    labor:['ՀՀ ԱՇԽԱՏԱՆՔԱՅԻՆ ՕՐԵՆՍԳԻՐՔ','51'],forest:['ՀՀ ԱՆՏԱՌԱՅԻՆ ՕՐԵՆՍԳԻՐՔ','21354'],
    subsoil:['ԸՆԴԵՐՔԻ ՄԱՍԻՆ ՀՀ ՕՐԵՆՍԳԻՐՔ','82035'], admin_proc:['ՀՀ ՎԱՐՉԱԿԱՆ ԴԱՏԱՎԱՐՈՒԹՅԱՆ ՕՐԵՆՍԳԻՐՔ','87705'],
    tax:['ՀՀ ՀԱՐԿԱՅԻՆ ՕՐԵՆՍԳԻՐՔ','109017'],eaeu:['ԵԱՏՄ ՄԱՔՍԱՅԻՆ ՕՐԵՆՍԳԻՐՔ','159647'],
    judicial:['ՀՀ ԴԱՏԱԿԱՆ ՕՐԵՆՍԳԻՐՔ','119531'],civil_proc:['ՀՀ ՔԱՂԱՔԱՑԻԱԿԱՆ ԴԱՏԱՎԱՐՈՒԹՅԱՆ ՕՐԵՆՍԳԻՐՔ','120057'],
    criminal:['ՀՀ ՔՐԵԱԿԱՆ ՕՐԵՆՍԳԻՐՔ','153080'],crim_proc:['ՀՀ ՔՐԵԱԿԱՆ ԴԱՏԱՎԱՐՈՒԹՅԱՆ ՕՐԵՆՍԳԻՐՔ','154763'],
    penitentiary:['ՀՀ ՔՐԵԱԿԱՏԱՐՈՂԱԿԱՆ ՕՐԵՆՍԳԻՐՔ','164938'],
    statute_internal:['ՀՀ ԶՈՒ ՆԵՐՔԻՆ ԾԱՌԱՅՈՒԹՅԱՆ ԿԱՆՈՆԱԳԻՐՔ','225574'],
    statute_garrison:['ՀՀ ԶՈՒ ԿԱՅԱԶՈՐԱՅԻՆ ԵՎ ՊԱՀԱԿԱՅԻՆ ԾԱՌԱՅՈՒԹՅՈՒՆՆԵՐԻ ԿԱՆՈՆԱԳԻՐՔ','112468'],
    statute_discipline:['ՀՀ ԶՈՒ ԿԱՐԳԱՊԱՀԱԿԱՆ ԿԱՆՈՆԱԳԻՐՔ','200323'],
    statute_drill:['ՀՀ ԶՈՒ ՇԱՐԱՅԻՆ ԿԱՆՈՆԱԴՐՈՒԹՅՈՒՆ',null],
    rights_service_status:['ԶԻՆՎՈՐԱԿԱՆ ԾԱՌԱՅՈՒԹՅԱՆ ԵՎ ԶԻՆԾԱՌԱՅՈՂԻ ԿԱՐԳԱՎԻՃԱԿԻ ՄԱՍԻՆ','225571']
  };
  var orders = {
    orders_president:'ՀՀ ՆԱԽԱԳԱՀԻ ՀՐԱՄԱՆՆԵՐ',orders_pm:'ՀՀ ՎԱՐՉԱՊԵՏԻ ՀՐԱՄԱՆՆԵՐ',
    orders_mod:'ՀՀ ՊՆ ՆԱԽԱՐԱՐԻ ՀՐԱՄԱՆՆԵՐ',orders_cgs:'ՀՀ ՊՆ ԳՇ ՊԵՏԻ ՀՐԱՄԱՆՆԵՐ',
    orders_mp:'ԲԱՆԱԿԱՅԻՆ ԿՈՐՊՈՒՍԻ ՀՐԱՄԱՆԱՏԱՐԻ ՀՐԱՄԱՆՆԵՐ',orders_gdnd:'ԳՆԴԻ ՀՐԱՄԱՆԱՏԱՐԻ ՀՐԱՄԱՆՆԵՐ'
  };
  var state = {section:'',rows:[],filtered:[],title:'', text:'',page:0,orderPage:0,request:0,searchTicket:0};
  var catalogPromise=null;
  var searchCache={text:null,folded:null};
  function getCatalog(){if(!catalogPromise) catalogPromise=fetch('data/legal-reader/index.json').then(function(r){if(!r.ok)throw Error('Իրավական տվյալների պահոցը հասանելի չէ');return r.json();}).catch(function(e){catalogPromise=null;throw e;});return catalogPromise;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function host(){return document.getElementById('content');}
  function official(id){return id ? 'https://www.arlis.am/hy/acts/'+encodeURIComponent(id)+'/latest' : 'https://www.arlis.am/hy/';}
  function back(){if(state.isDocument&&(orders[state.section]||state.section==='directives'||state.section==='military_acts'))return 'kmLegalInlineOpen(\''+state.section+'\')';return state.section.indexOf('statute_')===0?'kmLawsOpenStatutesHub()':state.section.indexOf('orders_')===0?'kmLawsOpenOrdersHub()':(state.section==='directives'||state.section==='military_acts')?'kmLawDocsPage()':(state.section.indexOf('rights_')===0||state.section==='rights_service_status')?'kmSoldierRightsHub()':'kmLawsConstitutionHub()';}
  function shell(title,body){
    var h=host();if(!h)return;
    if(!document.getElementById('kmLegalReaderStyle')){
      var css=document.createElement('style');css.id='kmLegalReaderStyle';
      css.textContent='.kmLegalReader{width:100%;max-width:1140px;margin:0 auto;min-width:0;box-sizing:border-box;overflow-wrap:anywhere}'+
        '.kmLegalReader h3{overflow-wrap:anywhere;word-break:normal;line-height:1.35;max-width:100%}'+
        '.kmLegalReader .toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;max-width:100%;min-width:0}'+
        '.kmLegalReader .toolbar button{flex:0 0 auto;max-width:100%;white-space:normal}'+
        '.kmLegalReader input[type=search]{flex:1 1 220px;min-width:0!important;width:100%;max-width:520px;box-sizing:border-box}'+
        '.kmLegalReader #kmLegalText{min-width:0;max-width:100%;overflow-wrap:anywhere;overflow-y:auto;overflow-x:hidden;position:relative;height:calc(100vh - 330px);min-height:240px;contain:content;overscroll-behavior:contain;padding:4px 10px 4px 2px;border-top:1px solid #d5dde4}'+
        '.kmLegalReader #kmLegalText p{margin:0 0 .85em;white-space:pre-line;text-align:left;font-size:var(--km-app-font-size,11pt);line-height:1.8;user-select:text}'+
        '.kmLegalReader #kmLegalText p.kmLegalCh{margin:1.6em 0 .7em;text-align:left;font-size:1.12em;font-weight:700;letter-spacing:.02em}'+
        '.kmLegalReader #kmLegalText p.kmLegalAr{margin-top:1.4em;padding-top:.5em;border-top:1px solid #d5dde4}.kmLegalReader select{white-space:normal;min-width:0!important;width:100%}.kmLegalReader #kmLegalText{background:#fff;color:#182433;border-radius:6px;padding:16px;box-sizing:border-box}@media(max-width:700px){.kmLegalReader #kmLegalText{height:55vh;min-height:200px;padding:10px}.kmLegalReader .toolbar{gap:5px}}'+
        '.kmLegalReader mark{background:#ffe27a;color:#111;padding:0 1px}'+
        '.kmLegalReader .kmLegalMeta{display:flex;flex-wrap:wrap;gap:2px 16px;font-size:12.5px;margin:2px 0 8px;opacity:.9}'+
        '.kmLegalReader .kmLegalMeta span b{opacity:.65;font-weight:600;margin-right:4px}'+
        '.kmLegalReader .kmLegalActOpen{max-width:100%;white-space:normal;text-align:left;overflow-wrap:anywhere}';
      css.textContent+=' .kmLegalReader #kmLegalText .kmLegalRichBlock{max-width:100%;overflow-x:auto;overflow-y:hidden;margin:0 0 .6em;contain:content}'+
        '.kmLegalReader #kmLegalText .kmLegalRichBlock p{white-space:normal;margin:.35em 0;line-height:1.7;text-align:inherit}'+
        '.kmLegalReader #kmLegalText .kmLegalRichBlock table{border-collapse:collapse;max-width:100%}'+
        '.kmLegalReader #kmLegalText .kmLegalRichBlock td,.kmLegalReader #kmLegalText .kmLegalRichBlock th{padding:4px;vertical-align:top;overflow-wrap:normal}'+
        '.kmLegalReader #kmLegalText .kmLegalRichBlock [align=center]{text-align:center}.kmLegalReader #kmLegalText .kmLegalRichBlock [align=right]{text-align:right}.kmLegalReader #kmLegalText .kmLegalRichBlock [align=justify]{text-align:justify}'+
        '.kmLegalReader #kmLegalText .kmLegalRichBlock sup,.kmLegalReader #kmLegalText .kmLegalRichBlock sub{font-size:.75em}.kmLegalReader #kmLegalText .kmLegalRichBlock img{max-width:100%;height:auto}'+
        '.kmLegalHeading{font-weight:700}.kmLegalLevel1,.kmLegalLevel2,.kmLegalLevel3,.kmLegalLevel4{margin-top:1.2em!important}'+
        '.kmLegalSourceDialog{width:94vw;max-width:1400px;height:92vh;border:1px solid #b5c6d5;border-radius:12px;padding:14px}.kmLegalSourceDialog::backdrop{background:#0008}.kmLegalSourceDialog iframe{display:block;width:100%;height:calc(100% - 105px);border:1px solid #ddd}';
      document.head.appendChild(css);
    }
    window.page='lawdocs'; window._kmLawSubPage=state.section;
    h.innerHTML='<div class="card kmLegalReader" style="line-height:1.65">'+
      '<div class="toolbar"><button type="button" onclick="'+back()+'">← Վերադարձ</button></div>'+
      '<h3>'+esc(title)+'</h3>'+body+'</div>';
    var pt=document.getElementById('pageTitle');if(pt)pt.textContent=title;
  }
  // Render only one bounded chunk at a time: huge codes must not block Chromium for seconds.
  var PAGE_SIZE=9000;
  function totalPages(){return state.starts?state.starts.length:1;}
  function pageAt(pos){return window.kmLegalModel.pageAt(state.starts||[0],pos);}
  var HEAD_CH=/^(?:ԳԼՈՒԽ|Գլուխ|ԲԱԺԻՆ|Բաժին)[ \t]+\S+/, HEAD_AR=/^(?:ՀՈԴՎԱԾ|Հոդված)[ \t]+[0-9][0-9\-]*\.?/;
  // Append text[from,to) to parent; the first boldLen chars of the paragraph are bold, marked ranges use <mark>.
  function addRange(parent,text,from,to,boldLen,mark){
    if(to<=from)return;
    var cut=(boldLen>from&&boldLen<to)?boldLen:-1, parts=cut===-1?[[from,to]]:[[from,cut],[cut,to]];
    parts.forEach(function(r){
      var node=document.createTextNode(text.slice(r[0],r[1])), wrap=node;
      if(r[0]<boldLen){var bb=document.createElement('b');bb.appendChild(wrap);wrap=bb;}
      if(mark){var mk=document.createElement('mark');mk.appendChild(wrap);wrap=mk;}
      parent.appendChild(wrap);
    });
  }
  // KM_LEGAL_RICH_V2: retain source tables, lists, superscripts and paragraph alignment.
  function safeRichFragment(markup){
    var t=document.createElement('template');t.innerHTML=markup;
    t.content.querySelectorAll('script,style,iframe,object,embed,form,input,button,select,textarea,link,meta,base,svg,math').forEach(function(n){n.remove();});
    t.content.querySelectorAll('*').forEach(function(n){
      Array.from(n.attributes).forEach(function(a){
        if(/^on/i.test(a.name)||a.name==='srcdoc')n.removeAttribute(a.name);
        if(a.name==='href'&&!/^https?:\/\//i.test(a.value))n.removeAttribute('href');
        if(a.name==='src'&&!/^data\/legal-reader\/assets\/[a-f0-9]+\.img$/.test(a.value))n.removeAttribute('src');
      });
    });return t.content;
  }
  function renderRich(el,chunks,q,start,end){
    var frag=document.createDocumentFragment(),found=0,focusEl=null,firstMark=null,key=q.toLocaleLowerCase();
    chunks.forEach(function(b){
      var wrap=document.createElement('div');wrap.className='kmLegalRichBlock';wrap.appendChild(safeRichFragment(b.html));
      // Source offsets refer to text nodes, including those within nested table cells.
      var walker=document.createTreeWalker(wrap,NodeFilter.SHOW_TEXT),nodes=[],node,offset=0;
      while((node=walker.nextNode())){nodes.push({node:node,start:offset,end:offset+node.nodeValue.length});offset+=node.nodeValue.length;}
      var text=wrap.textContent,low=text.toLocaleLowerCase(),matches=[],from=0,hit;
      if(key)while(found<150&&(hit=low.indexOf(key,from))!==-1){matches.push([hit,hit+key.length]);from=hit+key.length;found++;}
      nodes.forEach(function(part){
        var n=part.node,raw=n.nodeValue,f=document.createDocumentFragment(),cur=0,has=false;
        if(state.focus!=null&&state.focus>=b.start+part.start&&state.focus<b.start+part.end&&!focusEl)focusEl=n.parentElement;
        matches.forEach(function(m){
          var a=Math.max(m[0],part.start)-part.start,z=Math.min(m[1],part.end)-part.start;
          if(z<=a)return;has=true;f.appendChild(document.createTextNode(raw.slice(cur,a)));
          var mark=document.createElement('mark');mark.textContent=raw.slice(a,z);f.appendChild(mark);if(!firstMark)firstMark=mark;
          if(state.focus!=null&&state.focus>=b.start+part.start+a&&state.focus<b.start+part.start+z)focusEl=mark;
          cur=z;
        });
        if(has){f.appendChild(document.createTextNode(raw.slice(cur)));n.replaceWith(f);}
      });
      if(!focusEl&&state.focus!=null&&state.focus>=b.start&&state.focus<b.end)focusEl=wrap;
      frag.appendChild(wrap);
    });
    el.replaceChildren(frag);
    var counter=document.getElementById('kmLegalFound');if(counter)counter.textContent=found>=150?'150+':String(found);
    var target=focusEl||firstMark;el.scrollTop=0;
    if(target)el.scrollTop=Math.max(0,target.getBoundingClientRect().top-el.getBoundingClientRect().top-12);
  }
  // KM_LEGAL_SOURCE_JSON_V3: source content is data, never an executable app file.
  window.kmLegalSourceView=async function(){
    var match=/^source-(\d+)\.html$/.exec(state.sourceFile||'');
    if(!match)return;
    var dlg=document.createElement('dialog');dlg.className='kmLegalSourceDialog';
    var close=document.createElement('button');close.type='button';close.textContent='Փակել';close.onclick=function(){dlg.close();};
    var title=document.createElement('p');title.textContent='Բեռնվում է սկզբնաղբյուրի դասավորությունը…';
    var frame=document.createElement('iframe');frame.title=state.title;frame.setAttribute('sandbox','');
    dlg.append(close,title,frame);document.body.appendChild(dlg);dlg.addEventListener('close',function(){dlg.remove();});dlg.showModal();
    try{
      var response=await fetch('data/legal-source-records/'+match[1]+'.json');
      if(!response.ok)throw Error('Սկզբնաղբյուրի ֆայլը հասանելի չէ');
      var record=await response.json();
      if(!dlg.isConnected)return;
      if(String(record.actId)!==match[1]||typeof record.sourceHtml!=='string'||!record.sourceHtml.trim())throw Error('Սկզբնաղբյուրի տվյալները սխալ են');
      var body=document.createElement('div');body.appendChild(safeRichFragment(record.sourceHtml));
      // srcdoc inherits the app document base URL; only validated local images are retained.
      body.querySelectorAll('img[src]').forEach(function(img){img.src=new URL(img.getAttribute('src'),document.baseURI).href;});
      var css='body{font:16px Arial,sans-serif;line-height:1.65;padding:24px;color:#17212b;background:white;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}td,th{padding:4px;vertical-align:top}img{max-width:100%;height:auto}sup,sub{font-size:.75em}p{margin:.5em 0}';
      frame.srcdoc='<!doctype html><html lang="hy"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\' file: data:; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><style>'+css+'</style></head><body>'+body.innerHTML+'</body></html>';
      title.textContent='ARLIS-ի էջից պահված ամբողջ բովանդակությունը՝ սկզբնաղբյուրի դասավորությամբ';
    }catch(e){if(dlg.isConnected){frame.remove();title.textContent='Չհաջողվեց բացել սկզբնաղբյուրը․ '+String(e.message||e);}}
  };
  // Render one bounded page as separate paragraphs: chapters and articles are visually separated,
  // and only this small DOM is ever painted. The text scrolls inside its own box (not the whole page).
  function searchRender(){
    var el=document.getElementById('kmLegalText'), inp=document.getElementById('kmLegalSearch');if(!el)return;
    var source=state.text||'', total=totalPages();
    state.page=Math.max(0,Math.min(state.page,total-1));
    var start=state.starts[state.page], end=state.starts[state.page+1]||source.length, view=source.slice(start,end), q=(inp&&inp.value||'').trim();
    var counter=document.getElementById('kmLegalFound');
    var pageLabel=document.getElementById('kmLegalPage');if(pageLabel)pageLabel.textContent=(state.page+1)+' / '+total;
    var jump=document.getElementById('kmLegalJump');if(jump){jump.max=String(total);jump.value=String(state.page+1);}
    ['kmLegalFirst','kmLegalPrev'].forEach(function(id){var b=document.getElementById(id);if(b)b.disabled=state.page===0;});
    ['kmLegalNext','kmLegalLast'].forEach(function(id){var b=document.getElementById(id);if(b)b.disabled=state.page>=total-1;});
    var focusAt=(state.focus!=null&&state.focus>=start&&state.focus<end)?state.focus-start:-1;
    var key=q.toLocaleLowerCase(), low=key?view.toLocaleLowerCase():'', found=0, focusEl=null, firstMark=null;
    var chunks=(state.richBlocks||state.blocks||[]).filter(function(b){return (b.end>start&&b.start<end)||(b.end===b.start&&b.start>=start&&(b.start<end||(state.page===total-1&&b.start===end)));});
    if(state.richBlocks){renderRich(el,chunks,q,start,end);return;}
    var frag=document.createDocumentFragment();
    for(var ci=0;ci<chunks.length;ci++){
      var block=chunks[ci], pStart=Math.max(start,block.start)-start, para=source.slice(Math.max(start,block.start),Math.min(end,block.end));
      if(!para.trim())continue;
      var pe=document.createElement('p'), boldLen=0;
      if(window.kmLegalModel.heading.test(para.trim())&&window.kmLegalModel.level(para.trim())<5){pe.className='kmLegalCh';boldLen=para.length;}
      else{
        var hm=HEAD_AR.exec(para);
        if(hm){pe.className='kmLegalAr';var nl=para.indexOf('\n');boldLen=(nl>0&&nl<=160)?nl:hm[0].length;}
      }
      var cur=0, ms=[];
      // `low` covers the whole page: convert absolute hits to this paragraph's range
      if(key){ms=[];var from=pStart,hit;while(found+ms.length<150&&(hit=low.indexOf(key,from))!==-1&&hit+key.length<=pStart+para.length){ms.push(hit-pStart);from=hit+key.length;}}
      for(var mi=0;mi<ms.length;mi++){
        addRange(pe,para,cur,ms[mi],boldLen,false);addRange(pe,para,ms[mi],ms[mi]+q.length,boldLen,true);cur=ms[mi]+q.length;
      }
      addRange(pe,para,cur,para.length,boldLen,false);
      found+=ms.length;
      if(!firstMark&&ms.length)firstMark=pe;
      if(!focusEl&&focusAt>=0&&focusAt>=pStart&&focusAt<pStart+para.length+2)focusEl=pe;
      frag.appendChild(pe);
    }
    el.replaceChildren(frag);
    if(counter)counter.textContent=found>=150?'150+':String(found);
    var target=focusEl||firstMark;
    if(target){el.scrollTop=Math.max(0,target.offsetTop-8);}else{el.scrollTop=0;}
  }
  function goPage(n){state.focus=null;state.page=n;searchRender();}
  window.kmLegalChangePage=function(step){goPage(state.page+step);};
  window.kmLegalGoPage=function(kind){
    var total=totalPages();
    if(kind==='first')goPage(0);else if(kind==='last')goPage(total-1);
    else{var inp=document.getElementById('kmLegalJump');var n=parseInt(inp&&inp.value,10);if(n>0)goPage(n-1);}
  };
  // Search the full source without filling the DOM with matches from thousands of articles.
  // Defer the scan so keystrokes and button clicks remain responsive.
  window.kmLegalInlineSearch=function(){
    var ticket=++state.searchTicket,inp=document.getElementById('kmLegalSearch');
    var query=(inp&&inp.value||'').trim();
    if(!query){state.focus=null;searchRender();var st0=document.getElementById('kmLegalSearchStatus');if(st0)st0.textContent='';return;}
    var status=document.getElementById('kmLegalSearchStatus');
    if(status)status.textContent='Որոնվում է ամբողջ տեքստում…';
    clearTimeout(state.searchTimer);
    state.searchTimer=setTimeout(function(){
      if(ticket!==state.searchTicket||!document.getElementById('kmLegalText'))return;
      var raw=state.text||'';
      if(searchCache.text!==raw){searchCache.text=raw;searchCache.folded=raw.toLocaleLowerCase();}
      var pos=searchCache.folded.indexOf(query.toLocaleLowerCase());
      state.hitFrom=pos;
      if(pos!==-1){state.page=pageAt(pos);state.focus=pos;}else state.focus=null;
      searchRender();
      if(status)status.textContent=pos===-1?'Ոչինչ չի գտնվել։':'Առաջին արդյունքը՝ էջ '+(state.page+1)+' (հաջորդ արդյունքի համար՝ «Հաջորդ գտածո»)';
    },140);
  };
  window.kmLegalNextHit=function(){
    clearTimeout(state.searchTimer);state.searchTicket++;
    var inp=document.getElementById('kmLegalSearch'),q=(inp&&inp.value||'').trim();if(!q)return;if(searchCache.text!==state.text){searchCache.text=state.text;searchCache.folded=state.text.toLocaleLowerCase();}
    var from=(state.hitFrom==null||state.hitFrom<0?-1:state.hitFrom)+1;
    var pos=searchCache.folded.indexOf(q.toLocaleLowerCase(),from);
    if(pos===-1)pos=searchCache.folded.indexOf(q.toLocaleLowerCase());
    if(pos===-1)return;
    state.hitFrom=pos;state.focus=pos;state.page=pageAt(pos);searchRender();
    var status=document.getElementById('kmLegalSearchStatus');if(status)status.textContent='Գտածո՝ էջ '+(state.page+1);
  };
  // Table of contents: chapters and articles found in the stored text (built once per opened act).
  function buildOutline(){
    return state.preparedOutline||[];
  }

  function fillOutline(){
    var sel=document.getElementById('kmLegalOutline');if(!sel)return;
    var o=buildOutline();state.outline=o;
    if(!o.length){sel.style.display='none';return;}
    var html='<option value="">Բովանդակություն՝ մաս / բաժին / գլուխ / հոդված ('+o.length+')</option>';
    o.forEach(function(x,i){html+='<option value="'+i+'">'+Array(Math.max(1,x.level||1)).join('\u00a0\u00a0')+esc(x.label.length>90?x.label.slice(0,90)+'…':x.label)+'</option>';});
    sel.innerHTML=html;
  }
  window.kmLegalOutlineGo=function(sel){
    var i=parseInt(sel.value,10);if(isNaN(i)||!state.outline||!state.outline[i])return;
    var pos=state.outline[i].pos;state.focus=pos;state.page=pageAt(pos);
    var inp=document.getElementById('kmLegalSearch');if(inp)inp.value='';searchRender();
  };
  function metaBlock(title,id,info){
    var m=info.meta||{},v=info.verification&&typeof info.verification==='object'?info.verification:null;
    var ed=info.editionDate?esc(info.editionDate):(info.importedAt?esc(String(info.importedAt).slice(0,10))+' (ներմուծման օր)':'նշված չէ');
    function it(l,v){return v?'<span><b>'+l+'</b>'+esc(v)+'</span>':'';}
    return '<div class="kmLegalMeta">'+it('Համար',info.docNumber||m.number||'')+it('ARLIS ID',id||'')+it('Ընդունվել է',m.adoptedDate||'')+it('Ուժի մեջ',m.inForceDate||'')+it('ARLIS կարգավիճակ',m.status||'')+it('Աղբյուրի ստուգում',v?String(v.checkedAt).slice(0,10):'չի հաստատվել')+it('Ընթացիկ խմբագրության ID',v?v.resolvedActId:'')+
      (info.internal?'<span><b>Աղբյուր</b>'+esc(info.sourceLabel||'Ծրագրի ներքին նյութ')+'</span>':'<span><b>Խմբագրություն</b>'+ed+'</span><span><a href="'+official(id)+'" target="_blank" rel="noopener">arlis.am</a></span>')+'</div>';
  }
  function showText(title,source,id,imported,info){
    info=info||{};
    var prepared=info.prepared||window.kmLegalModel.build(source);
    state.starts=prepared.starts;state.preparedOutline=prepared.outline;state.blocks=prepared.blocks;state.richBlocks=prepared.richBlocks||null;state.sourceFile=prepared.sourceFile||null;
    state.title=title;state.text=prepared.text;state.page=0;state.focus=null;state.hitFrom=-1;state.outline=null;searchCache.text=null;searchCache.folded=null;
    shell(title,metaBlock(title,id,info)+
      '<p style="font-size:13px">'+(info.internal?'Սա ծրագրի ներքին նյութ է, ոչ թե իրավական ակտի պաշտոնական տեքստ։ Վերջնական կարգավորումը ստուգել օրենքներում։':info.verification&&typeof info.verification==='object'?'Տեքստը համեմատված և թարմացված է ARLIS-ի վերջին հրապարակված էջից՝ նշված ստուգման օրվա դրությամբ։ Հետագա փոփոխությունները և առանձին հղված փաստաթղթերը ստուգեք աղբյուրում։':imported?'Սա ARLIS-ից ներբեռնված պատճեն է․ խմբագրության գործող լինելը պետք է ստուգել։':'Սա ծրագրում նախկինում պահված պատճենն է․ այն կարող է լինել ոչ ամբողջական կամ հնացած։')+'</p>'+
      (state.sourceFile?'<div class="toolbar"><button type="button" onclick="kmLegalSourceView()">Սկզբնաղբյուրի դասավորությամբ</button></div>':'')+
      '<div class="toolbar"><input id="kmLegalSearch" type="search" oninput="kmLegalInlineSearch()" placeholder="Որոնել տեքստում…" style="min-width:250px">'+
      '<button type="button" onclick="kmLegalNextHit()">Հաջորդ գտածո</button>'+
      '<span>Գտնվել է այս էջում՝ <b id="kmLegalFound">0</b></span><span id="kmLegalSearchStatus" aria-live="polite"></span></div>'+
      '<div class="toolbar" style="margin-top:8px"><select id="kmLegalOutline" onchange="kmLegalOutlineGo(this)" style="max-width:100%;min-width:200px"><option value="">Բովանդակությունը կառուցվում է…</option></select></div>'+
      '<div class="toolbar" style="margin-top:8px">'+
      '<button type="button" id="kmLegalFirst" onclick="kmLegalGoPage(\'first\')">Առաջին</button>'+
      '<button type="button" id="kmLegalPrev" onclick="kmLegalChangePage(-1)">← Նախորդ</button>'+
      '<span id="kmLegalPage"></span>'+
      '<input id="kmLegalJump" type="number" min="1" style="width:70px" onchange="kmLegalGoPage(\'jump\')" aria-label="Էջ">'+
      '<button type="button" id="kmLegalNext" onclick="kmLegalChangePage(1)">Հաջորդ →</button>'+
      '<button type="button" id="kmLegalLast" onclick="kmLegalGoPage(\'last\')">Վերջին</button></div>'+
      '<div id="kmLegalText" class="notranslate" translate="no" data-km-i18n-skip tabindex="0" aria-label="Փաստաթղթի տեքստ" style="margin-top:8px"></div>');
    var reader=document.getElementById('kmLegalText');
    requestAnimationFrame(function(){if(document.getElementById('kmLegalText')!==reader)return;searchRender();setTimeout(function(){if(document.getElementById('kmLegalText')===reader)fillOutline();},0);});
  }
  async function openDoc(section,id,title){
    state.section=section;state.isDocument=true;state.searchTicket++;
    var request=++state.request;
    shell(title,'<p>Բեռնվում է իրավական տեքստը…</p>');
    var owner=host().firstElementChild;
    function current(){return request===state.request&&host()&&host().firstElementChild===owner;}
    // For the drill statute there is no ARLIS act ID in the project. Show the
    // preserved *partial* source instead of discarding it before the fallback.
    var embedded={},aliases={};
    try{var catalog=await getCatalog();if(!current())return;embedded=catalog.records||{};aliases=catalog.aliases||{};}
    catch(eStore){if(current())shell(title,'<p>Իրավական տվյալների պահոցը չի բեռնվել․ '+esc(eStore.message)+'</p>');return;}
    var requested=section+'/'+(id||'archive');
    var archive=section+'/archive';
    var canonical=id?'act/'+id:'';
    var record=(canonical&&embedded[canonical]) || embedded[aliases[requested]||requested] || embedded[aliases[archive]||archive];
    if(record&&record.file){
      try{var response=await fetch('data/legal-reader/'+record.file);if(!response.ok)throw Error('Տեքստի ֆայլը հասանելի չէ');record=await response.json();if(!current())return;}
      catch(e){if(current())shell(title,'<p>'+esc(e.message)+'</p><button type="button" onclick="kmLegalInlineOpen(\''+esc(section)+'\')">Կրկին փորձել</button>');return;}
    }
    if(record && record.text){
      var warning= section==='statute_drill' && !record.importedAt ? 'ՈՒՇԱԴՐՈՒԹՅՈՒՆ․ Շարային կանոնադրության ամբողջական պաշտոնական տեքստը ծրագրում չկա (ARLIS-ում չի գտնվել)։ Ստորև պահպանված համառոտ նյութն է։\n\n' : '';
      if(record.internal)warning=(record.notice?record.notice+'\n\n':'');
      showText(title,warning+record.text,record.internal?'':(id||(record.actId||'')),!!record.importedAt,{editionDate:record.editionDate||record.editedAt||'',importedAt:record.importedAt||'',meta:record.meta||null,docNumber:record.docNumber||'',internal:!!record.internal,sourceLabel:record.source||'',verification:record.verification,prepared:warning?null:record});
      return;
    }
    shell(title,'<p>Այս ակտի ամբողջական տեքստը տեղային փաթեթում առկա չէ։ Չեմ ներկայացնում հղումը կամ համառոտագիրը որպես ամբողջական օրենք։</p>'+ 
      '<p><a href="'+official(id)+'" target="_blank" rel="noopener">Բացել գործող պաշտոնական խմբագրությունը ARLIS-ում</a></p>');
  }
  // Keep the 1,145-act catalog out of the DOM: list only 25 filtered titles at a time.
  var ORDER_PAGE_SIZE=25;
  async function openOrders(section){
    state.section=section;state.isDocument=false;state.searchTicket++;
    var request=++state.request, title=orders[section] || (section==='military_acts'?'ՀՀ կառավարության որոշումներ՝ ԶՈՒ մասով':'Հրահանգներ');
    shell(title,'<p>Բեռնվում է տեղում պահված իրավական ակտերի ցանկը…</p>');
    var owner=host().firstElementChild;
    function current(){return request===state.request&&host()&&host().firstElementChild===owner;}
    try{
      var c=await getCatalog();if(!current())return;
      var seen=Object.create(null);
      state.rows=(c.items||[]).filter(function(x){
        if(x.section!==section)return false;
        var key=String(x.actId||'').trim() || String(x.title||'').trim().toLocaleLowerCase();
        if(seen[key])return false;seen[key]=true;return true;
      });
      var em=c.records||{};state.fullIds=Object.create(null);
      Object.keys(em).forEach(function(k){if(k.indexOf('act/')===0&&em[k]&&em[k].file)state.fullIds[k.slice(4)]=em[k];});
      state.filtered=state.rows;state.orderPage=0;
      shell(title,'<p>Այստեղ ներկայացված են տեղային տեքստերը։ Ակտի մոտ նշվում են պաշտոնական աղբյուրի ստուգման օրը և ARLIS-ի կարգավիճակը։ Առանձին հղված հավելվածները կարող են պահանջել համացանց։</p>'+
        '<input type="search" placeholder="Որոնել հրամանի անվամբ կամ ARLIS համարով…" oninput="kmLegalOrderFilter(this.value)" style="width:100%;max-width:520px;padding:9px">'+
        '<p id="kmLegalOrderCount" aria-live="polite"></p>'+
        '<div id="kmLegalOrders" style="margin-top:14px"></div>'+
        '<div class="toolbar" style="margin-top:12px"><button type="button" id="kmOrderPrev" onclick="kmLegalOrderPage(-1)">← Նախորդ</button> <span id="kmOrderPage"></span> <button type="button" id="kmOrderNext" onclick="kmLegalOrderPage(1)">Հաջորդ →</button></div>');
      window.kmLegalOrderFilter('');
    }catch(e){if(current())shell(title,'<p>Կատալոգի բեռնումը ձախողվեց․ '+esc(e.message)+'</p>');}
  }
  function renderOrders(){
    var el=document.getElementById('kmLegalOrders');if(!el)return;
    var rows=state.filtered||[], pages=Math.max(1,Math.ceil(rows.length/ORDER_PAGE_SIZE));
    state.orderPage=Math.max(0,Math.min(state.orderPage,pages-1));
    var from=state.orderPage*ORDER_PAGE_SIZE;
    el.innerHTML=rows.length?rows.slice(from,from+ORDER_PAGE_SIZE).map(function(x){
      // Read the act ID from a data attribute instead of injecting it into JS source.
      return '<div style="border-bottom:1px solid #ccc;padding:11px 0"><button type="button" class="kmLegalActOpen" data-act-id="'+esc(x.actId)+'">'+esc(x.title)+'</button> <small>ARLIS '+esc(x.actId)+'</small>'+((state.fullIds&&state.fullIds[String(x.actId)])?' <small>Տեքստը առկա է'+(state.fullIds[String(x.actId)].checkedAt?' · Ստուգված՝ '+esc(state.fullIds[String(x.actId)].checkedAt.slice(0,10)):' · Չստուգված')+'</small><div class="kmLegalActStatus">'+esc(state.fullIds[String(x.actId)].status||'Կարգավիճակը չի հաստատվել')+'</div>':' <small style="color:#b26a00">միայն վերնագիր</small>')+'</div>';
    }).join(''):'<p>Այս ենթաբաժնի համար կատալոգում համապատասխան հրապարակային ակտ չի գտնվել։</p>';
    el.querySelectorAll('.kmLegalActOpen').forEach(function(btn){btn.addEventListener('click',function(){window.kmLegalInlineOrder(btn.getAttribute('data-act-id'));});});
    var count=document.getElementById('kmLegalOrderCount');if(count)count.textContent='Գտնվել է՝ '+rows.length+' ակտ';
    var label=document.getElementById('kmOrderPage');if(label)label.textContent=(state.orderPage+1)+' / '+pages;
    var prev=document.getElementById('kmOrderPrev'),next=document.getElementById('kmOrderNext');
    if(prev)prev.disabled=state.orderPage===0;if(next)next.disabled=state.orderPage>=pages-1;
  }
  window.kmLegalOrderFilter=function(q){
    q=String(q||'').trim().toLocaleLowerCase();
    state.filtered=state.rows.filter(function(x){return (x.title||'').toLocaleLowerCase().includes(q) || String(x.actId||'').includes(q);});
    state.orderPage=0;renderOrders();
  };
  window.kmLegalOrderPage=function(step){state.orderPage+=step;renderOrders();};
  window.kmLegalInlineOrder=function(id){var row=state.rows.find(function(x){return String(x.actId)===String(id);});if(row)openDoc(state.section,id,row.title);};
  window.kmLegalShowUncatalogued=function(section,title){openDoc(section,null,title);};
  window.kmLegalInlineOpen=function(section){
    if(section==='military_acts'||section==='directives'){openOrders(section);return true;}
    if(codes[section]){openDoc(section,codes[section][1],codes[section][0]);return true;}
    if(orders[section]){openOrders(section);return true;}
    // All rights subsections use the same in-app reader, never the old file browser.
    if(/^rights_/.test(section)){var meta=window.kmLegalSectionTitles||{};openDoc(section,null,meta[section]||section.replace(/^rights_/,''));return true;}
    return false;
  };
})();

/* KM Library hub — Files, Օրենքներ, Բնօրինակ, Ֆայլերի փոխակերպում, Արխիվ */
(function () {
  'use strict';

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s ?? '');
  }

  /** Ֆոնտեր / Տեղեկություն — միայն ադմին (օգտատիրոջը չերևա) */
  function libIsAdmin() {
    if (window.kmUserRole === 'admin') return true;
    if (typeof window.kmCanAdmin === 'function' && window.kmCanAdmin()) return true;
    try {
      if (sessionStorage.getItem('km_auth_mode') === 'admin' && window.kmUserRole === 'admin') return true;
    } catch (e) {}
    return false;
  }

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  const FILE_TABS = [
    { id: 'word', label: 'Word', icon: '📝', tone: '#2b579a' },
    { id: 'excel', label: 'Excel', icon: '📊', tone: '#217346' },
    { id: 'pdf', label: 'PDF', icon: '📄', tone: '#c0392b' },
    { id: 'ppt', label: 'PowerPoint', icon: '📽️', tone: '#d35400' }
  ];

  const LIB_SECTIONS = [
    { id: 'notes', label: 'Նշումներ', icon: '📅' },
    { id: 'management', label: 'Կառավարում', icon: '⚙️', superAdminOnly: true },
    /* KM_MENU15_V1: reports section deleted (stats→duty tools, USB/docsPack→unitTools) */
    { id: 'spreadsheets', label: 'Աղյուսակներ և հաշվարկներ', icon: '🧮' },
    { id: 'license', label: 'Արտոնագիր', icon: '🔑', adminOnly: true }, /* shown under Համակարգի կարգավորումներ */
    { id: 'fonts', label: 'Ֆոնտեր', icon: '🔤', adminOnly: true },
    { id: 'files', label: 'Ֆայլերի պահոց', icon: '📚' },
    { id: 'pdfTranslate', label: 'PDF թարգմանություն', icon: '🌐' },
    { id: 'original', label: 'Բնօրինակ', icon: '📁' },
    { id: 'convert', label: 'Ֆայլերի փոխակերպում', icon: '🔄' },
    { id: 'current', label: 'Ընթացիկ արխիվ', icon: '💾' },
    { id: 'hishoxutyun', label: 'Հիշողություն', icon: '🕘' },
    { id: 'archive', label: 'Արխիվ', icon: '🗄' }
  ];

  const LAW_SECTIONS = [
    { id: 'constitution', label: 'ՀՀ Սահմանադրություն' },
    { id: 'electoral', label: 'ՀՀ Ընտրական օրենսգիրք' },
    { id: 'admin_offenses', label: 'Վարչական իրավախախտումներ' },
    { id: 'civil', label: 'ՀՀ Քաղաքացիական օրենսգիրք' },
    { id: 'land', label: 'ՀՀ Հողային օրենսգիրք' },
    { id: 'water', label: 'ՀՀ Ջրային օրենսգիրք' },
    { id: 'family', label: 'ՀՀ Ընտանեկան օրենսգիրք' },
    { id: 'labor', label: 'ՀՀ Աշխատանքային օրենսգիրք' },
    { id: 'forest', label: 'ՀՀ Անտառային օրենսգիրք' },
    { id: 'subsoil', label: 'Ընդերքի մասին ՀՀ օրենսգիրք' },
    { id: 'admin_proc', label: 'ՀՀ Վարչական դատավարություն' },
    { id: 'tax', label: 'ՀՀ Հարկային օրենսգիրք' },
    { id: 'eaeu', label: 'ԵԱՏՄ մաքսային օրենսգիրք' },
    { id: 'judicial', label: 'ՀՀ Դատական օրենսգիրք' },
    { id: 'civil_proc', label: 'ՀՀ Քաղաքացիական դատավարություն' },
    { id: 'criminal', label: 'ՀՀ Քրեական օրենսգիրք' },
    { id: 'crim_proc', label: 'ՀՀ Քրեական դատավարություն' },
    { id: 'penitentiary', label: 'ՀՀ Քրեակատարողական օրենսգիրք' },
    { id: 'statutes', label: 'Կանոնադրություններ' },
    { id: 'statute_internal', label: 'ՀՀ ԶՈՒ Ներքին ծառայության կանոնագիրք' },
    { id: 'statute_garrison', label: 'ՀՀ ԶՈՒ Կայազորային և պահակային ծառայությունների կանոնագիրք' },
    { id: 'statute_discipline', label: 'ՀՀ ԶՈՒ Կարգապահական կանոնագիրք' },
    { id: 'statute_drill', label: 'ՀՀ ԶՈՒ Շարային կանոնադրություն' },
    { id: 'orders', label: 'Հրամաններ' },
    { id: 'orders_president', label: 'ՀՀ Նախագահի հրամաններ' },
    { id: 'orders_pm', label: 'ՀՀ Վարչապետի հրամաններ' },
    { id: 'orders_mod', label: 'ՀՀ ՊՆ նախարարի հրամաններ' },
    { id: 'orders_cgs', label: 'ՀՀ ՊՆ ԳՇ պետի հրամաններ' },
    { id: 'orders_mp', label: 'Բանակային կորպուսի հրամանատարի հրամաններ' },
    { id: 'orders_gdnd', label: 'ԳՆԴի հրամանատարի հրամաններ' },
    { id: 'acts_discipline', label: '\u053f\u0561\u0580\u0563\u0561\u057a\u0561\u0570\u0561\u056f\u0561\u0576 \u057f\u0578\u0582\u0575\u056b\u0565\u0580' },
    { id: 'acts_exam', label: 'Ծառայողական քննության եզրակացություն' },
    { id: 'directives', label: 'Հրահանգներ' },
    { id: 'internal', label: 'Ներքին կարգ' },
    { id: 'characteristic', label: 'Բնութագիր' },
    { id: 'encouragements', label: 'Խրախուսանքներ' },
    { id: 'soldier_rights', label: 'Զինծառայողի իրավունքները' },
    { id: 'rights_medical', label: 'Բուժօգնություն և հոսպիտալացում' },
    { id: 'rights_housing', label: 'Բնակարանային ապահովում' },
    { id: 'rights_education', label: 'Կրթական արտոնություններ' },
    { id: 'rights_transport', label: 'Տրանսպորտային արտոնություններ' },
    { id: 'rights_leave', label: 'Արձակուրդներ և հանգիստ' },
    { id: 'rights_military_service_law', label: 'Զինվորական ծառայություն անցնելու մասին ՀՀ օրենք' },
    { id: 'rights_family_leave', label: 'Սոցիալական և ընտանեկան արձակուրդներ' },
    { id: 'rights_pay', label: 'Դրամական բավարարում' },
    { id: 'rights_lump', label: 'Մեկանգամյա վճարներ' },
    { id: 'rights_injury', label: 'Վնասվածքներ և ապահովագրություն' },
    { id: 'rights_zinapah', label: 'ԶԻՆԱՊԱՀ (1000+)' },
    { id: 'rights_service_status', label: 'ԶԻՆՎՈՐԱԿԱՆ ԾԱՌԱՅՈՒԹՅԱՆ ԵՎ ԶԻՆԾԱՌԱՅՈՂԻ ԿԱՐԳԱՎԻՃԱԿԻ ՄԱՍԻՆ' },
    { id: 'rights_complaint', label: 'Բողոքարկում / իրավական աջակցություն' },
    { id: 'rights_hotlines', label: 'Թեժ գծեր' },
    { id: 'military_acts', label: 'ՀՀ ԿԱՌԱՎԱՐՈՒԹՅԱՆ ՈՐՈՇՈՒՄ' }
  ];

  let libTab = 'word';
  let libSection = '';
  let libOffset = 0;
  let libSearch = '';
  let libFolder = '';
  let lawSection = 'constitution';
  let lawOffset = 0;
  let lawSearch = '';

  function updateLibSectionBack(onclick) {
    const host = document.getElementById('content') || content;
    if (!host) return;
    const fn = String(onclick || 'kmLibShowHub()');
    const btn = host.querySelector('.kmBackToolbar .kmBackBtn, .kmBackToolbar button, .kmBackBtn');
    if (btn) btn.setAttribute('onclick', fn);
  }
  const LIB_PAGE = 50;

  function injectLibCss() {
    const existing = document.getElementById('km-lib-css');
    if (existing) {
      if (existing.textContent.indexOf('data-admin-only') < 0) {
        existing.textContent += '\nbody.km-role-user #kmLibSections .kmLawCard[data-admin-only="1"],\nbody.km-role-viewer #kmLibSections .kmLawCard[data-admin-only="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important}\n';
      }
      if (existing.textContent.indexOf('#kmDocPrintBtn') < 0) {
        existing.textContent +=
          '\n.kmDocViewerTop .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0!important}' +
          '\n.kmDocViewerTop .toolbar button{border-radius:8px;padding:8px 14px;font-weight:600}' +
          '\n.kmDocViewerTop .toolbar button.primary,.kmDocViewerTop #kmDocPrintBtn{background:#17212b!important;color:#fff!important;border:1px solid #17212b!important}' +
          '\n.kmDocViewerTop .toolbar button.primary:hover,.kmDocViewerTop #kmDocPrintBtn:hover{background:#243447!important;border-color:#243447!important}\n';
      }
      return;
    }
    const s = document.createElement('style');
    s.id = 'km-lib-css';
    s.textContent = `
      .kmLibHubTitle{margin:0 0 6px}
      .kmLibSections{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px;padding-bottom:12px;border-bottom:1px solid #e2e8ef}
      .kmLibSections button.active{background:#17212b;color:#fff;border-color:#17212b}
      .kmLibStats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
      .kmLibStats .stat{margin:0;padding:8px 12px;font-size:13px;border:1px solid #e2e8ef;border-radius:8px;background:#fff;min-width:88px}
      .kmLibTypeFilter{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 12px;padding:0;background:transparent;border:0;border-radius:0}
      .kmLibTypeBtn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:14px;border:1px solid #d7e3ec;background:linear-gradient(180deg,#fff 0%,#f4f8fb 100%);cursor:pointer;font-size:13px;font-weight:700;color:#0d4a66;box-shadow:0 4px 12px rgba(16,40,60,.07);transition:transform .15s,background .15s,border-color .15s,box-shadow .15s}
      .kmLibTypeBtn:hover{transform:translateY(-1px);background:linear-gradient(180deg,#fff 0%,#eef6fa 100%);border-color:#b7cedb;box-shadow:0 8px 18px rgba(26,111,138,.12)}
      .kmLibTypeBtn.active{color:#0d4a66!important;border-color:#1a8fa0!important;background:linear-gradient(180deg,#f0fafb 0%,#e7f6f8 100%)!important;box-shadow:0 8px 18px rgba(26,143,160,.18),inset 0 0 0 1px #1a8fa0}
      .kmLibTypeBtn .kmLibTypeCount{font-size:12px;font-weight:700;opacity:.85;padding:1px 7px;border-radius:999px;background:rgba(0,0,0,.08)}
      .kmLibTypeBtn.active .kmLibTypeCount{background:rgba(255,255,255,.22)}
      .kmLibActiveType{margin:0 0 10px;font-size:13px;color:#556}
      .kmLibActiveType b{color:#17212b}
      .kmLibTypeBadge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff}
      .kmLibTable{width:100%;border-collapse:collapse;font-size:13px}
      .kmLibTable th,.kmLibTable td{border-bottom:1px solid #e2e8ef;padding:8px 6px;text-align:left}
      .kmLibTable th{font-size:12px;color:#556;background:#f8fafc}
      .kmLibPager{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
      .kmLawsSubs{display:none}
      .kmLawsSubs.is-order-nav{display:block;margin:0 0 14px}
      .kmOrderSubNavCard.kmOrderSubNavActive{box-shadow:0 8px 20px rgba(15,40,60,.14), inset 0 0 0 2px #1a8fa0}
      .kmLawsHub{margin:0}
      .kmLawsHubTitle{margin:0 0 6px;font-size:20px;font-weight:800;color:#0d4a66;letter-spacing:.02em}
      .kmLawsHubLead{margin:0 0 16px;color:#5a6b78;font-size:13px}
      .kmLawsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      @media (max-width:1100px){.kmLawsGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media (max-width:780px){.kmLawsGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .kmLawCard{position:relative;display:flex;align-items:center;gap:12px;min-height:92px;padding:14px 14px 14px 12px;border:1px solid #d7e3ec;border-radius:16px;background:linear-gradient(180deg,#fff 0%,#f4f8fb 100%);box-shadow:0 6px 16px rgba(16,40,60,.08);cursor:pointer;text-align:left;overflow:hidden;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
      .kmLawCard:hover{transform:translateY(-2px);border-color:#b7cedb;box-shadow:0 12px 24px rgba(26,111,138,.14);background:linear-gradient(180deg,#fff 0%,#eef6fa 100%)}
      .kmLawCard:focus-visible{outline:2px solid #1a8fa0;outline-offset:2px}
      .kmLawCard::after{content:none!important;display:none!important}
      .kmLawCardText{flex:1;min-width:0;color:#0d4a66;font-weight:800;font-size:13px;line-height:1.3;text-transform:none;letter-spacing:.01em}
      .kmLawCardIcon{order:-1;flex:0 0 46px;width:46px;height:46px;border-radius:14px;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;background:linear-gradient(145deg,#16344a,#1a8fa0);box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
      .kmLawCardIcon svg{width:22px;height:22px;display:block;stroke:#fff}
      .kmLawCard.kmLawCardLocal{box-shadow:0 6px 16px rgba(16,40,60,.08)}
      .kmLawsSubBtn{display:flex;align-items:center;gap:10px;min-height:64px;padding:10px 12px;border-radius:14px;border:1px solid #d7e3ec;background:linear-gradient(180deg,#fff 0%,#f4f8fb 100%);cursor:pointer;font-size:13px;font-weight:700;color:#0d4a66;box-shadow:0 4px 12px rgba(16,40,60,.07)}
      .kmLawsSubBtn:hover{background:linear-gradient(180deg,#fff 0%,#eef6fa 100%);border-color:#b7cedb}
      .kmLawsSubBtn.active{background:linear-gradient(180deg,#fff 0%,#eef6fa 100%);color:#0d4a66;border-color:#1a8fa0;box-shadow:0 8px 18px rgba(26,143,160,.18),inset 0 0 0 1px #1a8fa0}
      .kmLawsSubBtn .kmLawsCount{font-size:12px;font-weight:700;opacity:.85;margin-left:6px}
      .kmLawsLocalPanel{display:none;margin-top:8px}
      .kmLawsLocalPanel.is-open{display:block}
      .kmLawsHub.is-hidden{display:none}
      .kmDocViewer{position:fixed;inset:0;z-index:600000;background:rgba(15,23,42,.55);display:flex;align-items:stretch;justify-content:center;padding:12px}
      .kmDocViewerCard{flex:1;max-width:980px;background:#fff;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35)}
      .kmDocViewer.is-fs{padding:0}
      .kmDocViewer.is-fs .kmDocViewerCard{max-width:none;border-radius:0;height:100%}
      .kmDocViewerTop{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #e2e8ef;background:#f8fafc}
      .kmDocViewerTop h3{margin:0;font-size:15px;color:#0d4a66;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
      .kmDocViewerTop .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0!important}
      .kmDocViewerTop .toolbar button{border-radius:8px;padding:8px 14px;font-weight:600}
      .kmDocViewerTop .toolbar button.primary,
      .kmDocViewerTop #kmDocPrintBtn{background:#17212b!important;color:#fff!important;border:1px solid #17212b!important}
      .kmDocViewerTop .toolbar button.primary:hover,
      .kmDocViewerTop #kmDocPrintBtn:hover{background:#243447!important;border-color:#243447!important}
      .kmDocViewerFrame{flex:1;border:0;width:100%;min-height:0;background:#f5f5f5}
      .kmDocViewerFrame.is-pdf{background:#525659}
      .kmLawOpenLink{background:none;border:0;padding:0;color:#0d4a66;font:inherit;font-weight:600;text-align:left;cursor:pointer;text-decoration:underline}
      .kmLawOpenLink:hover{color:#1565c0}
      .kmExamFilesGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:4px}
      @media (max-width:1100px){.kmExamFilesGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:780px){.kmExamFilesGrid{grid-template-columns:1fr}}
      .kmLawCardExamWrap{position:relative}
      .kmLawCardExam{min-height:96px;width:100%}
      .kmLawCardExam .kmLawCardText{text-transform:none;font-size:13px;font-weight:700;line-height:1.35}
      .kmLawCardExam .kmLawCardMeta{display:block;margin-top:8px;font-size:11px;font-weight:600;color:#5a6b78;text-transform:none;letter-spacing:0}
      .kmLawCardExamDel{position:absolute;top:10px;right:10px;z-index:2;width:28px;height:28px;border:1px solid #e2a0a0;border-radius:999px;background:#fff;color:#a43;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
      .kmLawCardExamDel:hover{background:#fff5f5;border-color:#c0392b}
      .kmDiscArchiveCard{cursor:pointer}
      .kmDiscArchiveCard:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,40,60,.14)}
      .kmDiscActiveEarly{position:absolute;top:10px;left:10px;z-index:2;padding:4px 8px;border:1px solid #c5d0dc;border-radius:8px;background:#fff;color:#0d4a66;font-size:11px;font-weight:700;cursor:pointer;line-height:1.2}
      .kmDiscActiveEarly:hover{background:#eef3f8;border-color:#94a3b8}
      body.km-role-user #kmLibSections .kmLawCard[data-admin-only="1"],
      body.km-role-viewer #kmLibSections .kmLawCard[data-admin-only="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important}
      body.km-role-user .kmLawCardExamDel,body.km-role-user .kmDiscActiveEarly,
      body.km-role-viewer .kmLawCardExamDel,body.km-role-viewer .kmDiscActiveEarly{display:none!important;visibility:hidden!important;pointer-events:none!important}
    `;
    document.head.appendChild(s);
  }
  window.kmInjectLibCss = injectLibCss;

  async function libApi(method, ...args) {
    if (!window.kmNative || !window.kmNative.library) {
      throw new Error('Ֆայլերի պահոցը հասանելի է միայն KM desktop-ում'); /* KM_RENAME_LEFTOVERS_V1 */
    }
    return window.kmNative.library[method](...args);
  }

  function libOrgScope() {
    if (typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin()) {
      var superCtx = typeof window.kmGetOrgContext === 'function' ? window.kmGetOrgContext() : null;
      if (superCtx && superCtx.corpsId && superCtx.unitId) {
        return {
          corpsId: superCtx.corpsId,
          unitId: superCtx.unitId,
          archiveRole: superCtx.archiveRole || 'admin'
        };
      }
      return {};
    }
    if (typeof window.kmOrgArchiveScope === 'function') {
      var s = window.kmOrgArchiveScope();
      if (s && s.corpsId && s.unitId && s.archiveRole) {
        return { corpsId: s.corpsId, unitId: s.unitId, archiveRole: s.archiveRole };
      }
    }
    return { corpsId: '__none__', unitId: '__none__', archiveRole: '__none__' };
  }

  function withLibScope(opts) {
    return Object.assign({}, libOrgScope(), opts || {});
  }

  function htmlOriginalSection() {
    return `<div class="card" id="originalManagerCard" style="margin-bottom:0">
      <h3>Բնօրինակ</h3>
      <p class="muted">Մինչև 200,000 Word, Excel և PDF ֆայլերի մեծածավալ ստուգում։ Setup-ով բացված KM-ում խորհուրդ է տրվում ընտրել ամբողջ պանակը․ native համակարգը չի բեռնում բոլոր ֆայլերը browser-ի հիշողության մեջ։ Նույն անունով և նույն բովանդակությամբ կրկնօրինակներից պահպանվում է մեկ բնօրինակ, իսկ մնացածը տեղափոխվում են անվտանգ <b>_KM_Duplicates_Trash</b> պանակ։</p>
      <div class="originalGrid">
        <div class="originalBox">
          <h4>1. Ընտրել պանակ</h4>
          <button type="button" onclick="originalSelectFolder()">Ընտրել Word / Excel / PDF պանակը</button>
          <div id="originalFolder" class="originalPath">Պանակ ընտրված չէ։</div>
        </div>
        <div class="originalBox">
          <h4>2. Վերլուծել</h4>
          <button type="button" onclick="originalAnalyze()">Փնտրել կրկնօրինակներ և չբացվող ֆայլեր</button>
          <div class="muted">Համեմատվում է նույն անուն + SHA-256 բովանդակություն (կրկնօրինակ)։</div>
        </div>
        <div class="originalBox">
          <h4>3. Մաքրել կրկնօրինակները</h4>
          <button type="button" class="danger" onclick="originalCleanDuplicates()">Հեռացնել կրկնօրինակները՝ թողնելով բնօրինակը</button>
        </div>
        <div class="originalBox">
          <h4>4. Ուղղել չբացվողները</h4>
          <button type="button" onclick="originalRepairBroken()">Փորձել վերականգնել</button>
        </div>
      </div>
      <div id="originalStatus" class="converterStatus">Պատրաստ է։</div>
      <div id="originalSummary" class="originalSummary"></div>
      <details style="margin-top:10px"><summary>Եթե KM-ը բացված է առանց Setup-ի</summary>
        <input id="originalFilesFallback" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.pdf">
        <button type="button" onclick="originalAnalyzeFallback()">Ստուգել ընտրված ֆայլերը</button>
      </details>
    </div>`;
  }

  function htmlConvertSection() {
    return `<div class="card" style="margin-bottom:0">
      <h3>Ֆայլերի փոխակերպում</h3>
      <p class="muted">Փոխակերպումները կատարվում են Microsoft Word/Excel/PowerPoint local automation-ով (Setup-ով բացված KM)։ Խմբային պանակը վերցնում է մինչև 80 ֆայլ։</p>
      <div class="converterGrid">
        <div class="converterBox"><h4>Word → PDF</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convWordPdf" type="file" accept=".doc,.docx"><button type="button" onclick="convertWordToPdf()">Փոխակերպել PDF</button></div>
        <div class="converterBox"><h4>PDF → Word</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convPdfWord" type="file" accept=".pdf"><button type="button" onclick="convertPdfToWord()">Փոխակերպել Word</button></div>
        <div class="converterBox"><h4>Word → Excel</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convWordExcel" type="file" accept=".doc,.docx"><button type="button" onclick="convertWordToExcel()">Փոխակերպել Excel</button></div>
        <div class="converterBox"><h4>Excel → Word</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convExcelWord" type="file" accept=".xlsx,.xls"><button type="button" onclick="convertExcelToWord()">Փոխակերպել Word</button></div>
        <div class="converterBox"><h4>Excel → PDF</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convExcelPdf" type="file" accept=".xlsx,.xls"><button type="button" onclick="convertExcelToPdf()">Փոխակերպել PDF</button></div>
        <div class="converterBox"><h4>PDF → Excel</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convPdfExcel" type="file" accept=".pdf"><button type="button" onclick="convertPdfToExcel()">Փոխակերպել Excel</button></div>
        <div class="converterBox"><h4>PowerPoint → PDF</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convPptPdf" type="file" accept=".ppt,.pptx"><button type="button" onclick="convertPptToPdf()">Փոխակերպել PDF</button></div>
        <div class="converterBox"><h4>PDF → PowerPoint</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convPdfPpt" type="file" accept=".pdf"><button type="button" onclick="convertPdfToPpt()">Փոխակերպել PPT</button></div>
        <div class="converterBox"><h4>Նկար → PDF</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convImagePdf" type="file" accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,.gif" multiple><button type="button" onclick="convertImagesToPdf()">Փոխակերպել PDF</button></div>
        <div class="converterBox"><h4>PDF միավորում</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convPdfMerge" type="file" accept=".pdf" multiple><button type="button" onclick="convertMergePdfs()">Միավորել</button></div>
        <div class="converterBox"><h4>PDF բաժանում</h4><p class="kmDropHint">Քաշեք ֆայլը այստեղ</p><input id="convPdfSplit" type="file" accept=".pdf"><button type="button" onclick="convertSplitPdf()">Բաժանել էջերով</button></div>
        <div class="converterBox"><h4>Պանակի խմբային փոխակերպում</h4>
          <select id="convFolderKind">
            <option value="word-to-pdf">Word → PDF</option>
            <option value="pdf-to-word">PDF → Word</option>
            <option value="excel-to-pdf">Excel → PDF</option>
            <option value="ppt-to-pdf">PowerPoint → PDF</option>
            <option value="image-to-pdf">Նկար → PDF</option>
          </select>
          <button type="button" onclick="convertFolderBatch()">Ընտրել պանակը</button>
        </div>
      </div>
      <div id="converterStatus" class="converterStatus">Պատրաստ է։</div>
      <div class="toolbar" id="convResultActions" style="margin-top:8px;display:none">
        <button type="button" onclick="kmShowLastConvert()">Ցույց տալ ֆայլը Desktop-ում</button>
        <button type="button" onclick="kmOpenLastConvert()">Բացել արդյունքը</button>
      </div>
    </div>`;
  }

  function archiveItems() {
    if (typeof window.cleanupArchives === 'function') window.cleanupArchives();
    var raw = (typeof db !== 'undefined' && db.archives) ? db.archives : [];
    var list = typeof window.kmFilterArchivesForContext === 'function'
      ? window.kmFilterArchivesForContext(raw)
      : raw;
    return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function htmlCurrentArchiveSection() {
    const items = archiveItems().slice(0, 3);
    const last = items[0];
    const org = typeof window.kmOrgContextLabel === 'function' ? window.kmOrgContextLabel() : '';
    return `<div class="card" style="margin-bottom:0">
      <h3>Ընթացիկ արխիվ</h3>
      <p class="muted">Պահպանիր հիմա ամբողջ աշխատանքային վիճակը՝ անձնակազմ, գրաֆիկ, արձակուրդ և գրանցումներ։ Պահվածները երևում են «Արխիվ» բաժնում՝ միայն այս կորպուսի (բոլոր զորամասերը փոխկապակցված են) և ձեր դերի համար։${org ? '<br><b>' + esc(org) + '</b>' : ''}</p>
      <div class="toolbar">
        <button type="button" onclick="createCurrentArchive('Ընթացիկ գրաֆիկ/բազա');kmLibRefreshArchive()">Ստեղծել ընթացիկ արխիվ</button>
        <button type="button" onclick="kmLibSetSection('archive')">Բացել արխիվը</button>
      </div>
      ${last ? `<p>Վերջին արխիվ՝ <b>${esc(last.label || '')}</b> · ${esc(new Date(last.createdAt).toLocaleString())} · ${last.month}/${last.year}</p>` : '<p class="muted">Դեռ արխիվ չկա։</p>'}
    </div>`;
  }

  function htmlArchiveSection() {
    return '<div class="card" style="margin-bottom:0" id="kmLibChangeArchive">' +
      '<h3>Արխիվ</h3>' +
      '<p class="muted">Յուրաքանչյուր բաժնի պահպանված փոփոխությունները՝ <b>անուն ազգանունով</b>, ինչ է ավելացվել կամ հանվել, օրը և ժամը։</p>' +
      '<div id="kmLibChangeArchiveBody"><p class="muted">Բեռնվում է…</p></div>' +
      '<details style="margin-top:16px"><summary class="muted" style="cursor:pointer">Ընթացիկ գրաֆիկի արխիվներ</summary>' +
      htmlGraphArchivesInner() +
      '</details></div>';
  }

  function htmlGraphArchivesInner() {
    const items = archiveItems();
    const admin = libIsAdmin();
    return '<div class="toolbar" style="margin-top:8px">' +
      '<button type="button" onclick="cleanupArchives();save(true);kmLibRefreshArchive()">Մաքրել 3 տարուց հին</button>' +
      (admin ? '<button type="button" class="danger" onclick="clearAllArchiveKM()">Մաքրել ամբողջ արխիվը</button>' : '') +
      '</div>' +
      '<div class="gridwrap"><table class="grid"><thead><tr><th>Ամսաթիվ</th><th>Անվանում</th><th>Ամիս / տարի</th><th>Գործողություն</th><th>Դիտել</th></tr></thead>' +
      '<tbody>' + (items.map((a) => `<tr><td>${esc(new Date(a.createdAt).toLocaleString())}</td><td>${esc(a.label)}</td><td>${a.month}/${a.year}</td><td>${admin ? `<button onclick="restoreFullArchive('${a.id}')">Վերականգնել ամբողջ բազան</button>` : '<span class="muted">—</span>'}</td><td><button type="button" onclick="viewArchiveReadOnly('${a.id}')">Դիտել</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Արխիվներ չկան</td></tr>') +
      '</tbody></table></div>';
  }

  async function fillLibChangeArchive() {
    var host = document.getElementById('kmLibChangeArchiveBody');
    if (!host) return;
    try {
      var api = window.kmNative && window.kmNative.hishoxutyun;
      var rows = [];
      if (api && api.list) {
        var listed = await api.list({ limit: 2000 });
        rows = (listed && listed.rows) || [];
      }
      if (typeof window.kmHishoxutyunArchiveHtml === 'function') {
        host.innerHTML = window.kmHishoxutyunArchiveHtml(rows);
      } else {
        host.innerHTML = rows.length
          ? ('<p>' + rows.length + ' գրառում</p>')
          : '<p class="muted">Դեռ փոփոխություն չի գրանցվել։</p>';
      }
      try {
        var lan = window.kmNative && window.kmNative.lanSync;
        if (lan && lan.pullPrefix && (!window._kmArchPullAt || Date.now() - window._kmArchPullAt > 20000)) {
          window._kmArchPullAt = Date.now();
          lan.pullPrefix('hishoxutyun', { timeoutMs: 4000 }).then(function () {
            if (String(window.kmLibSection || '') === 'archive') fillLibChangeArchive();
          }).catch(function () {});
        }
      } catch (eP) {}
    } catch (e) {
      host.innerHTML = '<p class="muted">Արխիվը չհաջողվեց բեռնել։</p>';
    }
  }

  function htmlFontsSection() {
    return '<div class="card" style="margin-bottom:0">' +
      '<h3>Ֆոնտեր</h3>' +
      '<p class="muted">Ներբեռնեք <b>Times Armenian</b> (.ttf / .otf), որպեսզի Formal փաստաթղթերը, տպումը և հայերեն ANSI ֆայլերը կարդացվեն։ Ֆոնտերը պահվում են KM UserData-ում և գրանցվում համակարգում։</p>' +
      '<div class="toolbar">' +
        '<button type="button" class="primary" onclick="kmFontsUpload()">＋ Ավելացնել ֆոնտ</button>' +
        '<button type="button" onclick="kmFontsRefresh()">Թարմացնել</button>' +
      '</div>' +
      '<div style="overflow:auto">' +
        '<table class="kmLibTable">' +
          '<thead><tr><th>Անուն</th><th>Ընտանիք</th><th>Չափ</th><th>Ավելացվել է</th><th></th></tr></thead>' +
          '<tbody id="kmFontsBody"><tr><td colspan="5">…</td></tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  }

  async function refreshFontsList() {
    const tbody = document.getElementById('kmFontsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Բեռնվում է…</td></tr>';
    try {
      if (!window.kmNative || !window.kmNative.fonts) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted">Հասանելի է միայն KM desktop-ում</td></tr>';
        return;
      }
      const r = await window.kmNative.fonts.list();
      const items = (r && r.items) || [];
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="muted">Ֆոնտեր չկան — ավելացրեք Times Armenian</td></tr>';
      } else {
        tbody.innerHTML = items.map((f) => {
          const fam = esc(f.family || '—');
          const hint = f.aliasTimesArmenian || /times\s*armenian/i.test(String(f.family || ''))
            ? ' <span class="muted">(Times Armenian)</span>'
            : '';
          return '<tr>' +
            '<td>' + esc(f.name) + '</td>' +
            '<td>' + fam + hint + '</td>' +
            '<td>' + esc(fmtSize(f.size)) + '</td>' +
            '<td>' + (f.addedAt ? new Date(f.addedAt).toLocaleDateString('hy-AM') : '—') + '</td>' +
            '<td><button type="button" onclick="kmFontsDelete(\'' + esc(f.id) + '\')">Ջնջել</button></td>' +
          '</tr>';
        }).join('');
      }
      await window.kmApplyKmFontsCss();
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#a43">' + esc(e.message || e) + '</td></tr>';
    }
  }

  window.kmFontsRefresh = function () {
    refreshFontsList();
  };

  window.kmFontsUpload = function () {
    if (!libIsAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    if (!window.kmNative || !window.kmNative.fonts) {
      if (typeof toast === 'function') toast('Հասանելի է միայն KM desktop-ում', 'error');
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.ttf,.otf';
    inp.onchange = async () => {
      const files = [...(inp.files || [])];
      if (!files.length) return;
      let ok = 0;
      let fail = 0;
      for (const f of files) {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          await window.kmNative.fonts.add({ name: f.name, bytes: [...bytes] });
          ok++;
        } catch (e) {
          fail++;
          if (typeof toast === 'function') toast((f.name || 'ֆոնտ') + ': ' + (e.message || e), 'error');
        }
      }
      if (typeof toast === 'function') toast('Ավելացվեց ' + ok + (fail ? ', սխալ ' + fail : ''));
      await refreshFontsList();
    };
    inp.click();
  };

  window.kmFontsDelete = async function (id) {
    if (!libIsAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      return;
    }
    if (!confirm('Ջնջե՞լ ֆոնտը բազայից')) return;
    try {
      await window.kmNative.fonts.remove({ id });
      if (typeof toast === 'function') toast('Ֆոնտը ջնջվեց');
      await refreshFontsList();
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmApplyKmFontsCss = async function () {
    try {
      if (!window.kmNative || !window.kmNative.fonts) return;
      const r = await window.kmNative.fonts.list();
      const items = (r && r.items) || [];
      let css = '';
      items.forEach((f) => {
        if (!f.url) return;
        const family = String(f.family || 'KM Font').replace(/"/g, '');
        const format = /\.otf$/i.test(String(f.name || f.stored || '')) ? 'opentype' : 'truetype';
        css += '@font-face{font-family:"' + family + '";src:url("' + f.url + '") format("' + format + '");font-display:swap;}';
        if (f.aliasTimesArmenian || /times\s*armenian/i.test(family) || /timesarm/i.test(String(f.name || ''))) {
          css += '@font-face{font-family:"Times Armenian";src:url("' + f.url + '") format("' + format + '");font-display:swap;}';
        }
      });
      let el = document.getElementById('km-fonts-css');
      if (!el) {
        el = document.createElement('style');
        el.id = 'km-fonts-css';
        document.head.appendChild(el);
      }
      el.textContent = css;
    } catch (e) {}
  };

  function tabMeta(id) {
    return FILE_TABS.find((t) => t.id === id) || FILE_TABS[0];
  }

  function typeBadge(type) {
    if (type === 'html' || type === 'htm') {
      return '<span class="kmLibTypeBadge" style="background:#0d4a66">HTML</span>';
    }
    const t = tabMeta(type);
    return `<span class="kmLibTypeBadge" style="background:${t.tone}">${esc(t.label)}</span>`;
  }

  function htmlTypeFilterButtons(counts) {
    counts = counts || {};
    return FILE_TABS.map((t) => {
      const active = libTab === t.id ? ' active' : '';
      const cnt = Number(counts[t.id]) || 0;
      return `<button type="button" class="kmLibTypeBtn${active}" data-tab="${t.id}" style="${libTab === t.id ? 'background:' + t.tone : ''}" onclick="kmLibSetTab('${t.id}')">${t.icon} ${t.label}<span class="kmLibTypeCount">${cnt}</span></button>`;
    }).join('');
  }

  function updateTabUi(counts) {
    document.querySelectorAll('.kmLibTypeBtn').forEach((b) => {
      const on = b.dataset.tab === libTab;
      const meta = tabMeta(b.dataset.tab);
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.style.background = on ? meta.tone : '';
      b.style.borderColor = on ? meta.tone : '';
      b.style.color = on ? '#fff' : '';
      if (counts && b.dataset.tab) {
        const cntEl = b.querySelector('.kmLibTypeCount');
        if (cntEl) cntEl.textContent = String(Number(counts[b.dataset.tab]) || 0);
      }
    });
    const hint = document.getElementById('kmLibActiveType');
    if (hint) {
      const meta = tabMeta(libTab);
      hint.innerHTML = `Ցուցադրվում է՝ <b>${esc(meta.icon + ' ' + meta.label)}</b> բաժնի ֆայլերը`;
    }
  }

  function htmlFilesSection(counts) {
    return `<div class="card" style="margin-bottom:0">
      <p class="muted">Ֆայլերի պահոց՝ մինչև <b>6,000,000</b> Word, Excel, PDF և PowerPoint փաստաթուղթ։ Ֆայլերը ավտոմատ դասակարգվում են ըստ ընդլայնման։</p>
      <div class="kmLibStats" id="kmLibStats"><div class="stat muted">…</div></div>
      <div class="toolbar">
        <button type="button" class="primary" onclick="kmLibUploadFolder()">📁 Բեռնել պանակ</button>
        <button type="button" onclick="kmLibUpload()">＋ Ավելացնել ֆայլ(եր)</button>
        <button type="button" class="danger" onclick="kmLibRemoveAll()">🗑 Հեռացնել բոլորը</button>
        <select id="kmLibFolderFilter" onchange="kmLibFilterFolder(this.value)" style="padding:8px;min-width:160px">
          <option value="">Բոլոր պապկաները</option>
        </select>
        <input type="search" placeholder="Որոնում…" style="padding:8px;min-width:180px" oninput="kmLibSearch(this.value)">
      </div>
      <div class="kmLibTypeFilter" id="kmLibTypeFilter" role="tablist" aria-label="Ֆայլերի տեսակ">${htmlTypeFilterButtons(counts)}</div>
      <p class="kmLibActiveType" id="kmLibActiveType"></p>
      <div style="overflow:auto">
        <table class="kmLibTable">
          <thead><tr><th>Տեսակ</th><th>Պապկա</th><th>Անուն</th><th>Չափ</th><th>Ավելացվել է</th><th></th></tr></thead>
          <tbody id="kmLibBody"><tr><td colspan="6">…</td></tbody>
        </table>
      </div>
      <div class="kmLibPager">
        <button type="button" id="kmLibPrev" onclick="kmLibPage(-1)">← Նախորդ</button>
        <span id="kmLibPagerInfo" class="muted">…</span>
        <button type="button" id="kmLibNext" onclick="kmLibPage(1)">Հաջորդ →</button>
      </div>
    </div>`;
  }

  function lawMeta(id) {
    return LAW_SECTIONS.find((s) => s.id === id) || LAW_SECTIONS[0];
  }

  function currentLibArchiveMeta() {
    var pageId = String(window.page || '');
    var lawsId = String(window._kmLawOpenSection || lawSection || '');
    if (pageId === 'lawdocs' || libSection === 'laws') {
      var m = lawMeta(lawsId || 'constitution');
      return {
        section: 'lawdocs',
        sectionLabel: 'Իրավական անկյուն',
        subsection: lawsId,
        subsectionLabel: m.label
      };
    }
    var sid = String(libSection || '');
    var hit = LIB_SECTIONS.find(function (s) { return s.id === sid; });
    var fileTab = String(libTab || '');
    var tab = (typeof tabMeta === 'function') ? tabMeta(fileTab) : { label: fileTab };
    return {
      section: sid === 'files' ? 'files' : (sid || 'library'),
      sectionLabel: (hit && hit.label) || 'Ֆայլերի պահոց', /* KM_RENAME_LEFTOVERS_V1 */
      subsection: sid === 'files' ? fileTab : sid,
      subsectionLabel: sid === 'files' ? (tab.label || fileTab) : ((hit && hit.label) || '')
    };
  }

  function logLibChange(action, fileName) {
    try {
      if (typeof window.kmHishoxutyunLog !== 'function') return;
      var meta = currentLibArchiveMeta();
      var name = String(fileName || '').trim();
      var exam = String(meta.section || '') === 'acts_exam' || String(meta.subsection || '') === 'acts_exam' ||
        String(window._kmLawSubPage || '') === 'acts_exam';
      var detail = name;
      if (exam) {
        if (action === 'add') detail = 'Ավելացրել է եզրակացություն՝ ' + (name || 'ֆայլ');
        else if (action === 'delete') detail = 'Հեռացրել է եզրակացությունը՝ ' + (name || 'ֆայլ');
        else detail = 'Փոխել է եզրակացությունը՝ ' + (name || 'ֆայլ');
      } else if (name) {
        if (action === 'add') detail = 'ավելացրել է ֆայլ՝ ' + name;
        else if (action === 'delete') detail = 'հեռացրել է ֆայլ՝ ' + name;
        else detail = 'փոխել է ֆայլ՝ ' + name;
      }
      window.kmHishoxutyunLog({
        section: meta.section,
        sectionLabel: exam ? 'Ծառայողական քննության եզրակացություն' : meta.sectionLabel,
        subsection: meta.subsection,
        subsectionLabel: exam ? 'Ծառայողական քննության եզրակացություն' : meta.subsectionLabel,
        action: action || 'change',
        detail: detail,
        file: name
      });
    } catch (e) {}
  }
  window.kmLibCurrentArchiveMeta = currentLibArchiveMeta;

  const LAW_ICONS = {
    scroll: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 10h20a4 4 0 0 1 4 4v22H18a4 4 0 0 0-4 4V10z"/><path d="M14 10a4 4 0 0 0-4 4v24"/><path d="M20 18h12M20 24h12M20 30h8"/></svg>',
    ballot: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="12" y="14" width="24" height="22" rx="2"/><path d="M18 14v-2a6 6 0 0 1 12 0v2"/><path d="M20 26l3 3 6-7"/><path d="M10 36h28"/></svg>',
    shield: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 8l14 6v10c0 9-6 15-14 18-8-3-14-9-14-18V14l14-6z"/><path d="M24 18v12M18 24h12"/></svg>',
    handshake: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 24l8-6 6 4 6-4 12 8"/><path d="M16 18l4-4 6 4"/><path d="M28 18l4-4 6 3"/><path d="M18 30l4 4 5-3 5 3"/></svg>',
    plant: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 40V22"/><path d="M24 28c-8-2-12-8-12-14 8 0 12 6 12 14z"/><path d="M24 24c8-2 12-8 12-14-8 0-12 6-12 14z"/><path d="M16 40h16"/></svg>',
    drop: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 8c8 10 12 16 12 22a12 12 0 0 1-24 0c0-6 4-12 12-22z"/></svg>',
    family: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="4"/><circle cx="32" cy="16" r="4"/><circle cx="24" cy="28" r="3"/><path d="M8 38c1-6 5-9 8-9s6 2 8 6c2-4 5-6 8-6s7 3 8 9"/></svg>',
    briefcase: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="16" width="32" height="22" rx="2"/><path d="M18 16v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/><path d="M8 26h32"/></svg>',
    trees: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 38V26l-6 0 8-12 8 12h-6v12"/><path d="M32 38V28l-5 0 7-10 7 10h-5v10"/><circle cx="36" cy="12" r="3"/></svg>',
    subsoil: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 28h32"/><path d="M8 34h32"/><path d="M8 40h32"/><path d="M18 28c2-8 6-12 6-12s4 4 6 12"/><path d="M24 16v-4"/></svg>',
    tax: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="12" y="8" width="24" height="32" rx="2"/><path d="M18 18h12M18 24h12M18 30h8"/><path d="M28 34l4-4 4 4"/></svg>',
    eaeu: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18c6-8 14-8 20 0"/><path d="M12 30c8 8 16 8 24 0"/><path d="M18 24c4-4 8-4 12 0"/><path d="M18 24c4 4 8 4 12 0"/></svg>',
    gavel: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 34l16-16"/><path d="M26 14l8 8"/><path d="M12 36h20"/><rect x="28" y="10" width="10" height="6" rx="1" transform="rotate(45 33 13)"/></svg>',
    person: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="16" r="6"/><path d="M10 40c2-10 8-14 14-14s12 4 14 14"/></svg>',
    scales: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 10v28"/><path d="M12 38h24"/><path d="M10 18h28"/><path d="M16 18l-4 10h8l-4-10z"/><path d="M32 18l-4 10h8l-4-10z"/></svg>',
    book: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12h10a6 6 0 0 1 6 6v18H18a6 6 0 0 0-6 6V12z"/><path d="M36 12H26a6 6 0 0 0-6 6v18h10a6 6 0 0 1 6 6V12z"/></svg>',
    order: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="12" y="8" width="24" height="32" rx="2"/><path d="M18 16h12M18 22h12M18 28h8"/><circle cx="30" cy="34" r="3"/></svg>',
    directive: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 10h20l4 6v22H14V10z"/><path d="M18 20h12M18 26h12M18 32h8"/><path d="M34 10v6h4"/></svg>',
    internal: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="10" y="14" width="28" height="22" rx="2"/><path d="M16 14v-2a8 8 0 0 1 16 0v2"/><circle cx="24" cy="25" r="3"/><path d="M24 28v4"/></svg>',
    characteristic: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="12" y="8" width="24" height="32" rx="2"/><circle cx="24" cy="18" r="5"/><path d="M16 34c2-6 6-8 8-8s6 2 8 8"/><path d="M30 12h4M30 16h4"/></svg>',
    encouragement: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 8l4.5 9.5L39 19l-7.5 7 2 10.5L24 31l-9.5 5.5 2-10.5L9 19l10.5-1.5L24 8z"/></svg>'
  };

  const LAW_DOCS_HUB_CARDS = [
    { id: 'constitution_hub', title: 'ՀՀ ՍԱՀՄԱՆԱԴՐՈՒԹՅՈՒՆ ԵՎ ՕՐԵՆՍԳՐՔԵՐ', icon: 'scroll', constitutionHub: true },
    { id: 'statutes', title: 'ԿԱՆՈՆԱԴՐՈՒԹՅՈՒՆՆԵՐ', icon: 'book', statutesHub: true },
    { id: 'orders', title: 'ՀՐԱՄԱՆՆԵՐ', icon: 'order', ordersHub: true },
    { id: 'directives', title: 'ՀՐԱՀԱՆԳՆԵՐ', icon: 'directive', local: true },
    { id: 'military_acts', title: 'ՀՀ ԿԱՌԱՎԱՐՈՒԹՅԱՆ ՈՐՈՇՈՒՄ', icon: 'scroll', local: true },
    { id: 'characteristic', title: 'ԲՆՈՒԹԱԳԻՐ', icon: 'characteristic', characteristicPage: true },
    { id: 'acts_discipline', title: 'ԿԱՐԳԱՊԱՀԱԿԱՆ ՏՈՒՅԺԵՐ', icon: 'gavel', disciplineTable: true },
    { id: 'encouragements', title: 'ԽՐԱԽՈՒՍԱՆՔՆԵՐ', icon: 'encouragement', encouragementsPage: true },
    { id: 'acts_exam', title: 'ԾԱՌԱՅՈՂԱԿԱՆ ՔՆՆՈՒԹՅԱՆ ԵԶՐԱԿԱՑՈՒԹՅԱՆ ԲԱԺԻՆ', icon: 'person', local: true },
    { id: 'soldier_rights', title: 'ԶԻՆԾԱՌԱՅՈՂԻ ԻՐԱՎՈՒՆՔՆԵՐԸ', icon: 'scales', rightsHub: true }
  ];

  const LAW_HUB_CARDS = [
    { id: 'constitution', title: 'ՀՀ ՍԱՀՄԱՆԱԴՐՈՒԹՅՈՒՆ', icon: 'scroll', actId: '143723', local: true },
    { id: 'electoral', title: 'ՀՀ ԸՆՏՐԱԿԱՆ ՕՐԵՆՍԳԻՐՔ ՀՀ ՍԱՀՄԱՆԱԴՐԱԿԱՆ ՕՐԵՆՔԸ', icon: 'ballot', actId: '105967', local: true },
    { id: 'admin_offenses', title: 'ՎԱՐՉԱԿԱՆ ԻՐԱՎԱԽԱԽՏՈՒՄՆԵՐԻ ՎԵՐԱԲԵՐՅԱԼ ՀՀ ՕՐԵՆՍԳԻՐՔ', icon: 'shield', actId: '20', local: true },
    { id: 'civil', title: 'ՀՀ ՔԱՂԱՔԱՑԻԱԿԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'handshake', actId: '29', local: true },
    { id: 'land', title: 'ՀՀ ՀՈՂԱՅԻՆ ՕՐԵՆՍԳԻՐՔ', icon: 'plant', actId: '39', local: true },
    { id: 'water', title: 'ՀՀ ՋՐԱՅԻՆ ՕՐԵՆՍԳԻՐՔ', icon: 'drop', actId: '41', local: true },
    { id: 'family', title: 'ՀՀ ԸՆՏԱՆԵԿԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'family', actId: '49', local: true },
    { id: 'labor', title: 'ՀՀ ԱՇԽԱՏԱՆՔԱՅԻՆ ՕՐԵՆՍԳԻՐՔ', icon: 'briefcase', actId: '51', local: true },
    { id: 'forest', title: 'ՀՀ ԱՆՏԱՌԱՅԻՆ ՕՐԵՆՍԳԻՐՔ', icon: 'trees', actId: '21354', local: true },
    { id: 'subsoil', title: 'ԸՆԴԵՐՔԻ ՄԱՍԻՆ ՀՀ ՕՐԵՆՍԳԻՐՔ', icon: 'subsoil', actId: '82035', local: true },
    { id: 'admin_proc', title: 'ՀՀ ՎԱՐՉԱԿԱՆ ԴԱՏԱՎԱՐՈՒԹՅԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'shield', actId: '87705', local: true },
    { id: 'tax', title: 'ՀՀ ՀԱՐԿԱՅԻՆ ՕՐԵՆՍԳԻՐՔ', icon: 'tax', actId: '109017', local: true },
    { id: 'eaeu', title: 'ԵՎՐԱՍԻԱԿԱՆ ՏՆՏԵՍԱԿԱՆ ՄԻՈՒԹՅԱՆ ՄԱՔՍԱՅԻՆ ՕՐԵՆՍԳԻՐՔԸ', icon: 'eaeu', actId: '159647', local: true },
    { id: 'judicial', title: 'ՀՀ ԴԱՏԱԿԱՆ ՕՐԵՆՍԳԻՐՔ ՀՀ ՍԱՀՄԱՆԱԴՐԱԿԱՆ ՕՐԵՆՔԸ', icon: 'gavel', actId: '119531', local: true },
    { id: 'civil_proc', title: 'ՀՀ ՔԱՂԱՔԱՑԻԱԿԱՆ ԴԱՏԱՎԱՐՈՒԹՅԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'person', actId: '120057', local: true },
    { id: 'criminal', title: 'ՀՀ ՔՐԵԱԿԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'gavel', actId: '153080', local: true },
    { id: 'crim_proc', title: 'ՀՀ ՔՐԵԱԿԱՆ ԴԱՏԱՎԱՐՈՒԹՅԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'scales', actId: '154763', local: true },
    { id: 'penitentiary', title: 'ՀՀ ՔՐԵԱԿԱՏԱՐՈՂԱԿԱՆ ՕՐԵՆՍԳԻՐՔ', icon: 'shield', actId: '164938', local: true }
  ];

  const ZU_STATUTE_CARDS = [
    { id: 'statute_internal', title: 'ՀՀ ԶՈՒ ՆԵՐՔԻՆ ԾԱՌԱՅՈՒԹՅԱՆ ԿԱՆՈՆԱԳԻՐՔ', icon: 'book', actId: '225574', local: true },
    { id: 'statute_garrison', title: 'ՀՀ ԶՈՒ ԿԱՅԱԶՈՐԱՅԻՆ ԵՎ ՊԱՀԱԿԱՅԻՆ ԾԱՌԱՅՈՒԹՅՈՒՆՆԵՐԻ ԿԱՆՈՆԱԳԻՐՔ', icon: 'shield', actId: '112468', local: true },
    { id: 'statute_discipline', title: 'ՀՀ ԶՈՒ ԿԱՐԳԱՊԱՀԱԿԱՆ ԿԱՆՈՆԱԳԻՐՔ', icon: 'gavel', actId: '200323', local: true },
    { id: 'statute_drill', title: 'ՀՀ ԶՈՒ ՇԱՐԱՅԻՆ ԿԱՆՈՆԱԴՐՈՒԹՅՈՒՆ', icon: 'order', local: true }
  ];

  const ORDER_SUB_CARDS = [
    { id: 'orders_president', title: 'ՀՀ ՆԱԽԱԳԱՀԻ ՀՐԱՄԱՆՆԵՐ', icon: 'order', local: true },
    { id: 'orders_pm', title: 'ՀՀ ՎԱՐՉԱՊԵՏԻ ՀՐԱՄԱՆՆԵՐ', icon: 'order', local: true },
    { id: 'orders_mod', title: 'ՀՀ ՊՆ ՆԱԽԱՐԱՐԻ ՀՐԱՄԱՆՆԵՐ', icon: 'order', local: true },
    { id: 'orders_cgs', title: 'ՀՀ ՊՆ ԳՇ ՊԵՏԻ ՀՐԱՄԱՆՆԵՐ', icon: 'order', local: true },
    { id: 'orders_mp', title: 'ԲԱՆԱԿԱՅԻՆ ԿՈՐՊՈՒՍԻ ՀՐԱՄԱՆԱՏԱՐԻ ՀՐԱՄԱՆՆԵՐ', icon: 'order', local: true },
    { id: 'orders_gdnd', title: 'ԳՆԴԻ ՀՐԱՄԱՆԱՏԱՐԻ ՀՐԱՄԱՆՆԵՐ', icon: 'order', local: true }
  ];

  function findLawCard(id) {
    return LAW_DOCS_HUB_CARDS.find((c) => c.id === id)
      || LAW_HUB_CARDS.find((c) => c.id === id)
      || ZU_STATUTE_CARDS.find((c) => c.id === id)
      || ORDER_SUB_CARDS.find((c) => c.id === id);
  }

  function isOrderSubSection(section) {
    return ORDER_SUB_CARDS.some((c) => c.id === section);
  }

  // Legal acts, orders and rights are read in the in-app reader; only document-workflow sections keep a file list.
  function lawsUsesFileBrowser(section) {
    return section === 'acts_exam' || section === 'internal';
  }

  const LAWS_TITLED_SECTIONS = {
    acts_exam: true
  };

  function lawsUsesTitledUpload(section) {
    return !!LAWS_TITLED_SECTIONS[section];
  }

  function lawsListNameHeader(section) {
    return lawsUsesTitledUpload(section) ? 'Վերնագիր' : 'Անուն';
  }

  function htmlLawsAdminUploadButtons(section) {
    section = section || lawSection;
    if (section === 'acts_exam') {
      return '';
    }
    if (lawsUsesTitledUpload(section)) {
      return '<button type="button" class="primary" onclick="kmLawsUploadTitled()">＋ Ավելացնել</button>' +
        '<button type="button" onclick="kmLawsUploadFolder()">📁 Բեռնել պանակ</button>';
    }
    return '<button type="button" class="primary" onclick="kmLawsUploadFolder()">📁 Բեռնել պանակ</button>' +
      '<button type="button" onclick="kmLawsUpload()">＋ Ավելացնել ֆայլ(եր)</button>';
  }

  function htmlLawsExamAddButton() {
    if (!lawsCanAdd()) return '';
    return '<button type="button" class="primary" onclick="kmLawsUploadTitled()">＋ Ավելացնել</button>';
  }

  function htmlLawsToolbar(section, backAction) {
    section = section || lawSection;
    const back = backAction || getLawSectionBackAction(section);
    const backBtn = typeof window.kmBackBtnHtml === 'function'
      ? window.kmBackBtnHtml(back)
      : ('<button type="button" onclick="' + back + '">← Վերադարձ</button>');
    const searchVal = esc(lawSearch || '');
    const search = '<input type="search" placeholder="Որոնում…" style="padding:8px;min-width:180px" value="' + searchVal + '" oninput="kmLawsSearch(this.value)">';
    if (section === 'acts_exam') {
      return backBtn + search + htmlLawsExamAddButton();
    }
    if (lawsCanAdd()) {
      return backBtn +
        htmlLawsAdminUploadButtons(section) + search;
    }
    return backBtn + search;
  }

  function updateLawsAdminToolbar(backAction) {
    const panel = document.getElementById('kmLawsLocalPanel');
    if (!panel || !lawsCanAdd()) return;
    const toolbar = panel.querySelector('.toolbar');
    if (!toolbar) return;
    toolbar.innerHTML = htmlLawsToolbar(lawSection, backAction || getLawSectionBackAction(lawSection));
  }

  function getLawSectionBackAction(section) {
    if (ZU_STATUTE_CARDS.find((c) => c.id === section)) return 'kmLawsOpenStatutesHub()';
    if (ORDER_SUB_CARDS.find((c) => c.id === section)) return 'kmLawsOpenOrdersHub()';
    if (LAW_HUB_CARDS.find((c) => c.id === section)) return 'kmLawsConstitutionHub()';
    if (String(section || '').indexOf('rights_') === 0) return 'kmSoldierRightsHub()';
    return 'kmLawDocsPage()';
  }

  window.kmLegalOpenTool = async function(kind) {
    var names={characteristic:'kmCharacteristicPage',encouragements:'kmEncouragementsPage',acts_discipline:'kmDisciplinePenaltiesPage'};
    var name=names[kind];if(!name)return;
    var root=document.getElementById('content'),owner=root&&root.firstElementChild;
    try {
      if(typeof window[name]!=='function'&&typeof window.kmLoadPageModules==='function')await window.kmLoadPageModules('legalTools');
      if(!root||root.firstElementChild!==owner)return;
      if(typeof window[name]==='function')window[name]({back:'kmLawDocsPage()'});
      else if(typeof toast==='function')toast('Բաժինը չի բեռնվել։ Փորձեք կրկին։','error');
    } catch(e) {if(typeof toast==='function')toast('Բաժնի բեռնումը ձախողվեց։','error');}
  };

  function htmlLawCard(card) {
    const icon = LAW_ICONS[card.icon] || LAW_ICONS.book;
    const cls = (card.local || card.statutesHub || card.ordersHub || card.constitutionHub || card.characteristicPage || card.encouragementsPage || card.disciplineTable || card.rightsHub) ? 'kmLawCard kmLawCardLocal' : 'kmLawCard';
    const action = card.constitutionHub
      ? 'kmLawsConstitutionHub()'
      : card.statutesHub
        ? 'kmLawsOpenStatutesHub()'
        : card.ordersHub
          ? 'kmLawsOpenOrdersHub()'
          : card.rightsHub
            ? 'kmSoldierRightsHub()'
          : card.characteristicPage
            ? 'kmLegalOpenTool(\'characteristic\')'
            : card.encouragementsPage
              ? 'kmLegalOpenTool(\'encouragements\')'
              : card.disciplineTable
                ? 'kmLegalOpenTool(\'acts_discipline\')'
                : 'kmLawsOpenLocal(\'' + card.id + '\')';
    return '<button type="button" class="' + cls + '" onclick="' + action + '">' +
      '<span class="kmLawCardText">' + esc(card.title) + '</span>' +
      '<span class="kmLawCardIcon" aria-hidden="true">' + icon + '</span></button>';
  }

  function updateLawSectionSubNav(counts) {
    const subs = document.getElementById('kmLawsSubs');
    if (!subs) return;
    // Inside a subsection: never show sibling section cards
    subs.innerHTML = '';
    subs.className = 'kmLawsSubs';
    subs.setAttribute('hidden', 'hidden');
  }

  function lawsIsAdmin() {
    return typeof window.kmCanAdmin === 'function' && window.kmCanAdmin();
  }

  function lawsCurrentSection(section) {
    return String(section || window._kmLawSubPage || window._kmLawOpenSection || lawSection || '').trim();
  }

  function lawsCanMutate(section) {
    if (window.kmUserRole === 'viewer') return false;
    var sec = lawsCurrentSection(section);
    if (typeof window.kmCanEditPage === 'function' && window.kmCanEditPage('lawdocs', sec)) return true;
    if (typeof window.kmCanEdit === 'function' && sec && window.kmCanEdit(sec)) return true;
    return lawsIsAdmin();
  }

  function isSuperAdmin() {
    return typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin();
  }

  function adminToken() {
    try { return localStorage.getItem('km_admin_token') || ''; } catch (e) { return ''; }
  }

  function lawsFileIsProtected(f) {
    return !!(f && (f.protected || f.program));
  }

  function lawsCanDeleteFile(f) {
    if (lawsFileIsProtected(f)) return isSuperAdmin();
    return lawsCanMutate(f && f.section);
  }

  function lawsCanAdd() {
    return lawsCanMutate();
  }
  function libCanEditSection(sec) {
    var id = sec || libSection || 'files';
    if (typeof window.kmCanEdit === 'function') {
      return window.kmCanEdit('lib:' + id) || window.kmCanEdit('library') || window.kmCanEdit(id);
    }
    return true;
  }

  function lawsUsesLawFileCards(section) {
    if (!lawsCanMutate(section)) return true;
    return section === 'acts_exam' || section === 'military_acts' || section === 'directives'
      || section === 'statute_internal' || section === 'statute_garrison'
      || section === 'statute_discipline' || section === 'statute_drill'
      || isOrderSubSection(section)
      || String(section || '').indexOf('rights_') === 0;
  }

  function lawFileCardIconKey(f, section) {
    const name = String((f && f.name) || '');
    const type = String((f && f.type) || '');
    if (section === 'acts_exam') return 'person';
    if (/html/i.test(type) || /\.html?$/i.test(name)) return 'scroll';
    if (/pdf/i.test(type) || /\.pdf$/i.test(name)) return 'order';
    if (isOrderSubSection(section)) return 'order';
    if (section === 'directives') return 'directive';
    return 'book';
  }

  function htmlLawsFileListArea(section) {
    if (lawsUsesLawFileCards(section)) {
      return '<div class="kmExamFilesGrid" id="kmLawsBody" role="list"><p class="muted" style="grid-column:1/-1">…</p></div>';
    }
    return '<div style="overflow:auto">' +
      '<table class="kmLibTable">' +
        '<thead><tr><th>Տեսակ</th><th>' + esc(lawsListNameHeader(section)) + '</th><th>Չափ</th><th>Ավելացվել է</th><th></th></tr></thead>' +
        '<tbody id="kmLawsBody"><tr><td colspan="5">…</td></tbody>' +
      '</table>' +
    '</div>';
  }

  function htmlLawFileCard(f, iconKey) {
    iconKey = iconKey || 'person';
    const openArgs = "'" + esc(f.id) + "','" + esc(f.section || lawSection) + "'";
    const title = esc(f.displayName || f.name);
    const size = esc(fmtSize(f.size));
    const date = esc(f.addedAt ? new Date(f.addedAt).toLocaleDateString('hy-AM') : '—');
    const icon = LAW_ICONS[iconKey] || LAW_ICONS.book;
    const del = lawsCanDeleteFile(f)
      ? ('<button type="button" class="kmLawCardExamDel" onclick="event.stopPropagation();kmLawsDelete(\'' +
          esc(f.id) + '\',\'' + esc(f.section || lawSection) + '\',' + (lawsFileIsProtected(f) ? '1' : '0') + ',' +
          JSON.stringify(String(f.displayName || f.name || '')) +
          ')" title="Ջնջել" aria-label="Ջնջել">×</button>')
      : '';
    return '<div class="kmLawCardExamWrap" role="listitem">' + del +
      '<button type="button" class="kmLawCard kmLawCardLocal kmLawCardExam" onclick="kmLawsOpen(' + openArgs + ')">' +
        '<span class="kmLawCardText">' + title +
          '<span class="kmLawCardMeta">' + size + ' · ' + date + '</span>' +
        '</span>' +
        '<span class="kmLawCardIcon" aria-hidden="true">' + icon + '</span>' +
      '</button></div>';
  }

  function htmlExamFileCard(f) {
    return htmlLawFileCard(f, lawFileCardIconKey(f, 'acts_exam'));
  }

  function htmlLawsReadOnlyPanel(backAction) {
    const meta = lawMeta(lawSection);
    const back = backAction || 'kmLawDocsPage()';
    return '<div class="kmLawsLocalPanel is-open" id="kmLawsLocalPanel">' +
      '<div class="toolbar" style="margin-bottom:10px">' +
        htmlLawsToolbar(lawSection, back) +
      '</div>' +
      '<p class="kmLibActiveType" id="kmLawsActiveType">Ցուցադրվում է՝ <b>' + esc(meta.label) + '</b></p>' +
      htmlLawsFileListArea(lawSection) +
      '<div class="kmLibPager">' +
        '<button type="button" id="kmLawsPrev" onclick="kmLawsPage(-1)">← Նախորդ</button>' +
        '<span id="kmLawsPagerInfo" class="muted">…</span>' +
        '<button type="button" id="kmLawsNext" onclick="kmLawsPage(1)">Հաջորդ →</button>' +
      '</div>' +
    '</div>';
  }

  function htmlLawsLocalPanel(counts, backAction) {
    const meta = lawMeta(lawSection);
    const back = backAction || 'kmLawsShowHub()';
    return '<div class="kmLawsLocalPanel' + (lawsIsAdmin() ? ' km-admin-only' : '') + ' is-open" id="kmLawsLocalPanel">' +
      '<div class="toolbar" style="margin-bottom:10px">' +
        htmlLawsToolbar(lawSection, back) +
      '</div>' +
      '<div class="kmLibStats" id="kmLawsStats"><div class="stat muted">…</div></div>' +
      '<p class="kmLibActiveType" id="kmLawsActiveType">Ցուցադրվում է՝ <b>' + esc(meta.label) + '</b></p>' +
      htmlLawsFileListArea(lawSection) +
      '<div class="kmLibPager">' +
        '<button type="button" id="kmLawsPrev" onclick="kmLawsPage(-1)">← Նախորդ</button>' +
        '<span id="kmLawsPagerInfo" class="muted">…</span>' +
        '<button type="button" id="kmLawsNext" onclick="kmLawsPage(1)">Հաջորդ →</button>' +
      '</div>' +
    '</div>';
  }

  function htmlLawsSection(counts) {
    const cards = LAW_HUB_CARDS.map((c) => htmlLawCard(c)).join('');
    return '<div class="card kmLawsHubWrap" style="margin-bottom:0">' +
      '<div class="kmLawsHub" id="kmLawsHub">' +
        '<div class="toolbar" style="margin-bottom:10px"><button type="button" onclick="kmLawDocsPage()">← Վերադարձ</button></div>' +
        '<h3 class="kmLawsHubTitle">ՀՀ ՍԱՀՄԱՆԱԴՐՈՒԹՅՈՒՆ ԵՎ ՕՐԵՆՍԳՐՔԵՐ</h3>' +
        '<p class="kmLawsHubLead">ՀՀ սահմանադրություն և օրենսգիրքեր։</p>' +
        '<div class="kmLawsGrid" role="list">' + cards + '</div>' +
      '</div>' +
      '<div class="kmLawsLocalPanel" id="kmLawsLocalPanel" hidden></div>' +
    '</div>';
  }

  function htmlLawDocsHub() {
    const cards = LAW_DOCS_HUB_CARDS.map((c) => htmlLawCard(c)).join('');
    const backBar = typeof window.kmBackToolbar === 'function'
      ? window.kmBackToolbar('kmReportsBack()')
      : '<div class="toolbar kmBackToolbar" style="margin-bottom:10px"><button type="button" class="kmBackBtn" onclick="kmReportsBack()">' + (window.KM_BACK_LABEL || '← Վերադարձ') + '</button></div>';
    return '<div class="card kmLawsHubWrap" style="margin-bottom:0">' +
      backBar +
      '<div class="kmLawsHub" id="kmLawsHub">' +
        '<h3 class="kmLawsHubTitle">Իրավական անկյուն</h3>' +
        '<p class="kmLawsHubLead">ՀՀ սահմանադրություն և օրենսգրքեր, կանոնադրություններ, հրամաններ, զինծառայողի իրավունքներ, բնութագիր, կարգապահական տույժեր, խրախուսանքներ և ծառայողական քննության եզրակացություններ։</p>' +
        '<div class="kmLawsGrid" role="list">' + cards + '</div>' +
      '</div>' +
      '<div class="kmLawsLocalPanel" id="kmLawsLocalPanel" hidden></div>' +
    '</div>';
  }

  async function refreshLawsList(silent) {
    const host = document.getElementById('kmLawsBody');
    if (!host) return;
    const examCards = lawsUsesLawFileCards(lawSection);
    if (!silent) {
      host.innerHTML = examCards
        ? '<p class="muted" style="grid-column:1/-1">Բեռնվում է…</p>'
        : '<tr><td colspan="5">Բեռնվում է…</td></tr>';
    }
    try {
      const r = await libApi('lawsList', lawSection, { offset: lawOffset, limit: LIB_PAGE, q: lawSearch });
      if (!r.items.length) {
        const meta = lawMeta(lawSection);
        let emptyMsg = '«' + esc(meta.label) + '» բաժնում ֆայլեր չկան';
        if (lawSection === 'statute_drill') {
          emptyMsg = lawsCanAdd()
            ? 'Շարային կանոնադրության ֆայլը դեռ ավելացված չէ։ Ավելացրեք PDF/DOCX «Ավելացնել ֆայլ(եր)» կոճակով։'
            : 'Շարային կանոնադրության ֆայլը դեռ չի ավելացվել՝ դիմեք ադմինիստրատորին';
        } else if (lawsCanAdd()) {
          emptyMsg += '։ Ավելացրեք ֆայլ վերևի կոճակներով։';
        }
        host.innerHTML = examCards
          ? ('<p class="muted" style="grid-column:1/-1">' + emptyMsg + '</p>')
          : ('<tr><td colspan="5" class="muted">' + emptyMsg + '</td></tr>');
      } else if (examCards) {
        host.innerHTML = r.items.map((f) => htmlLawFileCard(f, lawFileCardIconKey(f, lawSection))).join('');
      } else {
        host.innerHTML = r.items.map((f) => {
          const openArgs = "'" + esc(f.id) + "','" + esc(f.section || lawSection) + "'";
          const canInApp = f.type === 'pdf' || f.type === 'html'
            || /\.pdf$/i.test(String(f.name || '')) || /\.html?$/i.test(String(f.name || ''));
          const nameCell = canInApp
            ? ('<button type="button" class="kmLawOpenLink" onclick="kmLawsOpen(' + openArgs + ')">' + esc(f.displayName || f.name) + '</button>')
            : esc(f.displayName || f.name);
          const delName = JSON.stringify(String(f.displayName || f.name || ''));
          return `
          <tr>
            <td>${typeBadge(f.type)}</td>
            <td>${nameCell}</td>
            <td>${fmtSize(f.size)}</td>
            <td>${f.addedAt ? new Date(f.addedAt).toLocaleDateString('hy-AM') : '—'}</td>
            <td>
              <button type="button" onclick="kmLawsOpen(${openArgs})">Բացել</button>
              ${lawsCanDeleteFile(f) ? '<button type="button" onclick="kmLawsDelete(\'' + esc(f.id) + '\',\'' + esc(f.section || lawSection) + '\',' + (lawsFileIsProtected(f) ? '1' : '0') + ',' + delName + ')">Ջնջել</button>' : ''}
            </td>
          </tr>`;
        }).join('');
      }
      const info = document.getElementById('kmLawsPagerInfo');
      if (info) {
        const from = r.total ? lawOffset + 1 : 0;
        const to = Math.min(lawOffset + r.items.length, r.total);
        info.textContent = from ? `${from}–${to} / ${r.total}` : '0';
      }
      const prev = document.getElementById('kmLawsPrev');
      const next = document.getElementById('kmLawsNext');
      if (prev) prev.disabled = lawOffset <= 0;
      if (next) next.disabled = lawOffset + LIB_PAGE >= r.total;
      scheduleLawsIndexPull();
      if (typeof window.kmApplyRoleGuard === 'function') window.kmApplyRoleGuard();
    } catch (e) {
      host.innerHTML = examCards
        ? ('<p style="color:#a43;grid-column:1/-1">' + esc(e.message || e) + '</p>')
        : ('<tr><td colspan="5" style="color:#a43">' + esc(e.message || e) + '</td></tr>');
    }
  }

  function scheduleLawsIndexPull() {
    try {
      const lan = window.kmNative && window.kmNative.lanSync;
      if (!lan || typeof lan.pullPrefix !== 'function') return;
      if (window._kmLawsIndexPullBusy) return;
      if (window._kmLawsIndexPullAt && (Date.now() - window._kmLawsIndexPullAt) < 20000) return;
      const wantSection = String(lawSection || '');
      const bundledHub = /^(constitution|electoral|admin_offenses|civil|land|water|family|labor|forest|subsoil|admin_proc|tax|eaeu|judicial|civil_proc|criminal|crim_proc|penitentiary|statute_|soldier_rights|rights_|military_acts|directives|orders_)/.test(wantSection);
      if (bundledHub) return;
      window._kmLawsIndexPullAt = Date.now();
      window._kmLawsIndexPullBusy = true;
      Promise.resolve(lan.status ? lan.status() : null).then(function (st) {
        const role = String((st && (st.effectiveRole || st.role)) || '');
        if (role === 'server' || role === 'hub' || (st && st.isServer)) {
          window._kmLawsIndexPullBusy = false;
          return null;
        }
        return lan.pullPrefix('Library/laws/' + wantSection, { timeoutMs: 6000, indexOnly: true });
      }).then(function () {
        window._kmLawsIndexPullBusy = false;
        if (String(window._kmLawOpenSection || lawSection) === wantSection) {
          refreshLawsList(true);
        }
      }).catch(function () { window._kmLawsIndexPullBusy = false; });
    } catch (ePull) {
      window._kmLawsIndexPullBusy = false;
    }
  }

  async function refreshLawsStats() {
    const el = document.getElementById('kmLawsStats');
    if (!el) return null;
    try {
      const s = await libApi('lawsStats');
      const secCount = Number((s.counts || {})[lawSection]) || 0;
      const secMax = Number((s.sectionMax || {})[lawSection]) || 0;
      const secStat = secMax
        ? ('<div class="stat"><b>' + secCount + ' / ' + secMax + '</b><br><span class="muted">' + esc(lawMeta(lawSection).label) + '</span></div>')
        : ('<div class="stat"><b>' + secCount + '</b><br><span class="muted">' + esc(lawMeta(lawSection).label) + '</span></div>');
      el.innerHTML = secStat +
        '<div class="stat"><b>' + (s.total || 0) + '</b><br><span class="muted">Ընդամենը ֆայլեր</span></div>';
      const subs = document.getElementById('kmLawsSubs');
      if (subs) updateLawSectionSubNav(s.counts || {});
      const hint = document.getElementById('kmLawsActiveType');
      if (hint) hint.innerHTML = `Ցուցադրվում է՝ <b>${esc(lawMeta(lawSection).label)}</b>`;
      updateLawsAdminToolbar(getLawSectionBackAction(lawSection));
      return s;
    } catch (e) {
      el.innerHTML = `<p class="muted">${esc(e.message || e)}</p>`;
      return null;
    }
  }

  async function refreshLibraryList() {
    const tbody = document.getElementById('kmLibBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">Բեռնվում է…</td></tr>';
    try {
      const r = await libApi('list', libTab, withLibScope({ offset: libOffset, limit: LIB_PAGE, q: libSearch, folder: libFolder }));
      const folderSel = document.getElementById('kmLibFolderFilter');
      if (folderSel && r.folders) {
        const cur = libFolder;
        folderSel.innerHTML = '<option value="">Բոլոր պապկաները</option>' +
          r.folders.map((f) => `<option value="${esc(f)}"${f === cur ? ' selected' : ''}>${esc(f)}</option>`).join('');
      }
      if (!r.items.length) {
        const meta = tabMeta(libTab);
        tbody.innerHTML = `<tr><td colspan="6" class="muted">«${esc(meta.label)}» բաժնում ֆայլեր չկան</td></tr>`;
      } else {
        tbody.innerHTML = r.items.map((f) => `
          <tr>
            <td>${typeBadge(f.type || libTab)}</td>
            <td>${esc(f.folder || '—')}</td>
            <td>${esc(f.displayName || f.name)}</td>
            <td>${fmtSize(f.size)}</td>
            <td>${f.addedAt ? new Date(f.addedAt).toLocaleDateString('hy-AM') : '—'}</td>
            <td>
              <button type="button" onclick="kmLibOpen('${esc(f.id)}','${esc(f.type || libTab)}')">Բացել</button>
              <button type="button" onclick="kmLibDelete(${JSON.stringify(String(f.id))},${JSON.stringify(String(f.type || libTab))},${JSON.stringify(String(f.displayName || f.name || ''))})">Ջնջել</button>
            </td>
          </tr>`).join('');
      }
      const info = document.getElementById('kmLibPagerInfo');
      if (info) {
        const from = r.total ? libOffset + 1 : 0;
        const to = Math.min(libOffset + r.items.length, r.total);
        info.textContent = from ? `${from}–${to} / ${r.total}` : '0';
      }
      const prev = document.getElementById('kmLibPrev');
      const next = document.getElementById('kmLibNext');
      if (prev) prev.disabled = libOffset <= 0;
      if (next) next.disabled = libOffset + LIB_PAGE >= r.total;
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:#a43">${esc(e.message || e)}</td></tr>`;
    }
  }

  async function refreshLibraryStats() {
    const el = document.getElementById('kmLibStats');
    if (!el) return null;
    try {
      const s = await libApi('stats', libOrgScope());
      el.innerHTML = `
        <div class="stat"><b>${s.total}</b><br><span class="muted">Ընդամենը</span></div>
        <div class="stat"><b>${s.free}</b><br><span class="muted">Մնացած</span></div>`;
      const filter = document.getElementById('kmLibTypeFilter');
      if (filter) filter.innerHTML = htmlTypeFilterButtons(s.counts || {});
      updateTabUi(s.counts || {});
      return s;
    } catch (e) {
      el.innerHTML = `<p class="muted">${esc(e.message || e)}</p>`;
      return null;
    }
  }

  function htmlPdfTranslateSection() {
    return '<div class="card" style="margin-bottom:0">' +
      '<h3 class="kmLawsHubTitle" style="margin-top:0">PDF թարգմանություն</h3>' +
      '<p class="kmLawsHubLead">PDF-ից արտահանեք տեքստը և թարգմանեք <b>հայերեն</b>, <b>ռուսերեն</b> կամ <b>անգլերեն</b>։ ' +
      '<b>Offline</b>՝ տեղական Ollama (<code>http://localhost:11434</code>, llama3) · <b>Online</b>՝ ինտերնետով։ ' +
      'Տեքստային շերտով PDF-ը կարդացվում է անմիջապես։ Սկանավորված (միայն նկար) ֆայլի համար փորձվում է Word/OCR՝ առանց կախվելու, ' +
      'իսկ եթե տեքստ չկա՝ ցուցադրվում է հստակ հաղորդագրություն։</p>' +
      '<div id="kmPdfTrStatus" class="converterStatus muted" style="margin-bottom:12px">Ստուգվում է…</div>' +
      '<div class="converterGrid">' +
        '<div class="converterBox">' +
          '<h4>1. Ընտրել PDF</h4>' +
          '<input type="file" id="kmPdfTrFile" accept=".pdf,application/pdf">' +
        '</div>' +
        '<div class="converterBox">' +
          '<h4>2. Թարգմանության լեզու</h4>' +
          '<label>Լեզու<select id="kmPdfTrLang">' +
            '<option value="hy">Հայերեն</option>' +
            '<option value="ru">Русский</option>' +
            '<option value="en">English</option>' +
          '</select></label>' +
          '<label>Ռեժիմ<select id="kmPdfTrMode">' +
            '<option value="auto">Ավտո · Ollama, ապա ինտերնետ</option>' +
            '<option value="offline">Միայն Ollama (offline)</option>' +
            '<option value="online">Միայն ինտերնետ</option>' +
          '</select></label>' +
          '<button type="button" class="primary" id="kmPdfTrRunBtn" onclick="kmPdfTranslateRun()">Թարգմանել</button>' +
        '</div>' +
      '</div>' +
      '<div id="kmPdfTrOut" class="converterStatus" style="margin-top:12px;min-height:48px"></div>' +
    '</div>';
  }

  async function kmPdfTranslateProbe() {
    const el = document.getElementById('kmPdfTrStatus');
    if (!el) return;
    try {
      const api = window.kmNative && window.kmNative.pdfTranslate;
      if (!api || typeof api.probe !== 'function') {
        el.textContent = 'PDF թարգմանության համակարգը հասանելի չէ';
        el.className = 'converterStatus error';
        return;
      }
      const r = await api.probe();
      if (r && r.ok) {
        if (r.ollama) {
          el.textContent = 'Offline պատրաստ է · Ollama · ' + (r.model || 'llama3') + ' · Online-ը նույնպես հասանելի է';
          el.className = 'converterStatus ok';
        } else {
          el.textContent = (r.message || 'Online թարգմանությունը հասանելի է ինտերնետով') +
            ' · Offline-ի համար՝ ollama pull llama3';
          el.className = 'converterStatus ok';
        }
      } else {
        el.textContent = 'Թարգմանության համակարգը հասանելի չէ';
        el.className = 'converterStatus error';
      }
    } catch (e) {
      el.textContent = e.message || String(e);
      el.className = 'converterStatus error';
    }
  }

  window.kmPdfTranslateRun = async function () {
    const fileEl = document.getElementById('kmPdfTrFile');
    const langEl = document.getElementById('kmPdfTrLang');
    const out = document.getElementById('kmPdfTrOut');
    const btn = document.getElementById('kmPdfTrRunBtn');
    if (!fileEl || !fileEl.files || !fileEl.files[0]) {
      if (typeof toast === 'function') toast('Ընտրեք PDF ֆայլ', 'warn');
      return;
    }
    const file = fileEl.files[0];
    const targetLang = langEl ? langEl.value : 'hy';
    const modeEl = document.getElementById('kmPdfTrMode');
    const mode = modeEl ? modeEl.value : 'auto';
    const api = window.kmNative && window.kmNative.pdfTranslate;
    if (!api || typeof api.run !== 'function') {
      if (typeof toast === 'function') toast('PDF թարգմանության համակարգը հասանելի չէ', 'error');
      return;
    }
    if (out) {
      out.textContent = 'Արտահանվում է տեքստը և թարգմանվում է… (կարող է տևել մի քանի րոպե)';
      out.className = 'converterStatus busy';
    }
    if (btn) btn.disabled = true;
    try {
      let req = buildPdfTranslateReq(null, file, targetLang);
      if (!req) {
        req = { name: file.name, base64: await readFileAsBase64(file), targetLang: targetLang };
      }
      req.mode = mode;
      try {
        const s = window.kmNative && window.kmNative.settings ? await window.kmNative.settings.get() : {};
        if (s && s.helpBotLlmModel) req.model = s.helpBotLlmModel;
        if (s && s.helpBotLlmBaseUrl) req.ollamaUrl = s.helpBotLlmBaseUrl;
      } catch (eSet) {}
      const r = await api.run(req);
      if (!r || !r.ok) {
        const failMsg = (r && r.message) || 'Ձախողվեց';
        if (out) {
          out.textContent = failMsg;
          out.className = 'converterStatus error';
        }
        if (typeof toast === 'function') toast(failMsg, 'error');
        return;
      }
      if (out) {
        out.textContent = 'Պատրաստ է · ' + (r.chunks || 1) + ' հատված · ' + (r.extractedChars || 0) + ' նիշ';
        out.className = 'converterStatus ok';
      }
      if (r.html && typeof window.kmLawsShowDocViewer === 'function') {
        window.kmLawsShowDocViewer(r.name || 'translated.html', 'text/html', { html: r.html });
      }
      if (typeof toast === 'function') toast('Թարգմանությունը պատրաստ է', 'ok');
    } catch (e) {
      if (out) {
        out.textContent = e.message || String(e);
        out.className = 'converterStatus error';
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  function renderLibSectionBody() {
    const root = document.getElementById('kmLibSectionRoot');
    if (!root) return;
    if (!libSection || libSection === 'hub') {
      root.innerHTML = '';
      return;
    }
    if (libSection === 'notes') {
      if (typeof window.notesPage === 'function') window.notesPage(root);
      else root.innerHTML = '<div class="card"><p class="muted">Նշումների բաժինը հասանելի չէ։</p></div>';
    }
    else if (libSection === 'management') {
      if (typeof window.management === 'function') window.management(root);
      else root.innerHTML = '<div class="card"><p class="muted">Կառավարման բաժինը հասանելի չէ։</p></div>';
    }
    else if (libSection === 'reports') { /* KM_MENU15_V1: section deleted */
      if (typeof window.kmOpenPage === 'function') window.kmOpenPage('unitTools');
      return;
    } else if (false && libSection === 'reports_removed') {
      var embedBackR = typeof window.kmLibEmbedBackHtml === 'function' ? window.kmLibEmbedBackHtml(root) : '';
      var hubHtml = typeof window.kmReportsHubCardsHtml === 'function'
        ? window.kmReportsHubCardsHtml()
        : '<h3 class="kmLawsHubTitle" style="margin-top:0">Հաշվետվություններ և համաժամեցում</h3><p class="muted">Բաժինը հասանելի չէ։</p>';
      root.innerHTML = embedBackR +
        '<div class="card" data-km-reports-hub="1" data-km-home-reports="1">' + hubHtml + '</div>';
      window._kmHomeReportsHubHtml = null;
      var pendingSec = window._kmPendingReportsSection;
      window._kmPendingReportsSection = '';
      if (pendingSec && typeof window.kmHomeReportsOpen === 'function') {
        setTimeout(function () {
          try { window.kmHomeReportsOpen(pendingSec); } catch (eR) {}
        }, 0);
      }
    }
    else if (libSection === 'syssettings' || libSection === 'network' || libSection === 'sysinfo') {
      if (typeof window.kmOpenPage === 'function') {
        window._kmSysSettingsPending = libSection === 'syssettings' ? '' : libSection;
        window.kmOpenPage('syssettings');
      }
      return;
    }
    else if (libSection === 'spreadsheets') {
      if (typeof window.kmSpreadsheetsPage === 'function') window.kmSpreadsheetsPage(root);
      else root.innerHTML = '<div class="card"><p class="muted">Աղյուսակների բաժինը հասանելի չէ։</p></div>';
    }
    else if (libSection === 'license') {
      if (typeof window.kmOpenLicensePage === 'function') window.kmOpenLicensePage(root);
      else root.innerHTML = '<div class="card"><p class="muted">Արտոնագրի բաժինը հասանելի չէ։</p></div>';
    }
    else if (libSection === 'fonts') {
      if (!libIsAdmin()) {
        libSection = '';
        window.kmLibSection = '';
        if (typeof window.kmLibShowHub === 'function') window.kmLibShowHub();
        return;
      } else {
        root.innerHTML = htmlFontsSection();
        refreshFontsList();
      }
    }
    else if (libSection === 'files') root.innerHTML = htmlFilesSection();
    else if (libSection === 'pdfTranslate') {
      root.innerHTML = htmlPdfTranslateSection();
      kmPdfTranslateProbe();
      updateLibSectionBack(KM_TOOLS_LIB.pdfTranslate ? 'kmToolsHubBack()' : 'kmLibShowHub()'); /* KM_MENU_REORG_V1 */
      return;
    }
    else if (libSection === 'laws') {
      if (typeof window.kmCodesPage === 'function') {
        window.kmCodesPage();
        return;
      }
      root.innerHTML = htmlLawsSection();
    }
    else if (libSection === 'original') root.innerHTML = htmlOriginalSection();
    else if (libSection === 'convert') {
      root.innerHTML = htmlConvertSection();
      if (typeof window.kmBindConverterDrops === 'function') window.kmBindConverterDrops();
    }
    else if (libSection === 'current') root.innerHTML = htmlCurrentArchiveSection();
    else if (libSection === 'hishoxutyun') {
      if (typeof window.kmOpenHishoxutyun === 'function') {
        window.kmOpenHishoxutyun();
        return;
      }
      root.innerHTML = '<div class="card"><p class="muted">Հիշողության բաժինը հասանելի չէ։</p></div>';
    }
    else if (libSection === 'archive') {
      root.innerHTML = htmlArchiveSection();
      fillLibChangeArchive();
    }
    if (typeof window.kmEnsurePageBack === 'function') window.kmEnsurePageBack(root, KM_ARCH_LIB[libSection] ? { onclick: 'kmArchiveHubBack()' } : (KM_TOOLS_LIB[libSection] ? { onclick: 'kmToolsHubBack()' } : undefined)); /* KM_ARCHIVE_HUB_V1 + KM_MENU_REORG_V1 */
  }

  function updateSectionTabs() {
    document.querySelectorAll('#kmLibSections .kmLawCard').forEach((b) => {
      const id = (b.getAttribute('onclick') || '').match(/kmLibSetSection\('([^']+)'\)/);
      b.classList.toggle('active', id && id[1] === libSection);
      b.style.outline = (id && id[1] === libSection) ? '2px solid #1a8fa0' : '';
    });
    document.querySelectorAll('.kmLibSections button[data-section]').forEach((b) => {
      b.classList.toggle('active', b.dataset.section === libSection);
    });
    const dbInfo = document.getElementById('kmLibDbInfo');
    if (dbInfo) dbInfo.style.display = libSection === 'notes' ? 'none' : '';
    if (typeof window.kmSetActiveLibNav === 'function') window.kmSetActiveLibNav(libSection);
    const titles = {
      notes: 'Նշումներ',
      management: 'Կարգավարում',
      reports: 'Հաշվետվություններ և համաժամեցում',
      syssettings: 'Համակարգի կարգավորումներ',
      network: 'Ցանց և ֆայլեր',
      spreadsheets: 'Աղյուսակներ և հաշվարկներ',
      license: 'Արտոնագիր',
      sysinfo: 'Տեղեկություն',
      fonts: 'Ֆոնտեր',
      files: 'Ֆայլերի պահոց',
      pdfTranslate: 'PDF թարգմանություն',
      original: 'Բնօրինակ',
      convert: 'Ֆայլերի փոխակերպում',
      current: 'Ընթացիկ արխիվ',
      hishoxutyun: 'Հիշողություն',
      archive: 'Արխիվ'
    };
    const pt = document.getElementById('pageTitle');
    if (pt) {
      if (!libSection || libSection === 'hub') {
        pt.textContent = typeof window.kmTranslateUI === 'function'
          ? window.kmTranslateUI('Գրադարան')
          : 'Գրադարան';
      } else if (titles[libSection]) {
        pt.textContent = typeof window.kmTranslateUI === 'function' ? window.kmTranslateUI(titles[libSection]) : titles[libSection];
      }
    }
  }

  window.kmLibSetTab = function (t) {
    if (!FILE_TABS.some((x) => x.id === t)) return;
    libTab = t;
    libOffset = 0;
    libFolder = '';
    libSearch = '';
    const folderSel = document.getElementById('kmLibFolderFilter');
    if (folderSel) folderSel.value = '';
    const searchInp = document.querySelector('#kmLibSectionRoot input[type="search"]');
    if (searchInp) searchInp.value = '';
    updateTabUi();
    refreshLibraryList();
  };

  window.kmLibShowHub = function () {
    /* KM_MENU_REORG_V1: every Գրադարան section now lives in another hub -> «← Վերադարձ» goes to Աշխատանքային գործիքներ */
    try {
      if (KM_TOOLS_LIB[String(libSection || window.kmLibSection || '')] || kmLibHubEmpty()) {
        window.kmToolsHubBack();
        return;
      }
    } catch (eRe) {}
    libSection = '';
    window.kmLibSection = '';
    if (typeof window.libraryPage === 'function') window.libraryPage('', { hub: true });
  };

  window.kmLibSetSection = function (section) {
    section = section || '';
    if (section === 'syssettings' || section === 'network' || section === 'sysinfo') {
      window._kmSysSettingsPending = section === 'syssettings' ? '' : section;
      if (typeof window.kmOpenPage === 'function') window.kmOpenPage('syssettings');
      return;
    }
    if ((section === 'fonts' || section === 'sysinfo') && !libIsAdmin()) {
      section = '';
    }
    if ((section === 'management' || section === 'archive') &&
        !(typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin())) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմինիստրատոր', 'error');
      else if (typeof window.kmNotify === 'function') window.kmNotify('Միայն սուպեր ադմինիստրատոր', 'warn');
      return;
    }
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      if (section && !window.kmCanAccessPage('library', section)) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        else if (typeof window.kmNotify === 'function') window.kmNotify('Այս բաժինը ձեզ թույլատրված չէ', 'warn');
        return;
      }
    }
    /* Դատարկ / hub՝ վերադարձ դեպի ԳՐԱԴԱՐԱՆ հաբ */
    if (!section || section === 'hub') {
      window.kmLibShowHub();
      return;
    }
    window._kmLibStaySection = section;
    /* Մուտք բաժին՝ ամբողջ էջ (հաբի քարտերը չեն մնում տեսանելի) */
    libSection = section;
    window.kmLibSection = libSection;
    libOffset = 0;
    libSearch = '';
    libFolder = '';
    const hostEl = document.getElementById('content') || content;
    if (hostEl) content = hostEl;
    var __kmArchSec = !!KM_ARCH_LIB[libSection]; /* KM_ARCHIVE_HUB_V1: moved sections return to the Արխիվ hub */
    var __kmToolsSec = !__kmArchSec && !!KM_TOOLS_LIB[libSection]; /* KM_MENU_REORG_V1: moved sections return to Աշխատանքային գործիքներ */
    if (__kmToolsSec) { try { if (typeof page !== 'undefined') page = 'library'; window.page = 'library'; } catch (ePg) {} }
    const __kmBackFn = __kmArchSec ? 'kmArchiveHubBack()' : (__kmToolsSec ? 'kmToolsHubBack()' : 'kmLibShowHub()');
    const back =
      typeof window.kmBackToolbar === 'function'
        ? window.kmBackToolbar(__kmBackFn)
        : '<div class="toolbar"><button type="button" onclick="' + __kmBackFn + '">← Վերադարձ</button></div>';
    content.innerHTML = back + '<div id="kmLibSectionRoot"></div>';
    updateSectionTabs();
    if (__kmArchSec) { window._kmArchiveSub = libSection; archSetNav(); } else { window._kmArchiveSub = ''; }
    if (__kmToolsSec) toolsSetNav(); /* KM_MENU_REORG_V1 */
    renderLibSectionBody();
    if (libSection === 'files') {
      refreshLibraryStats();
      refreshLibraryList();
    } else if (libSection === 'laws') {
      refreshLawsStats();
      refreshLawsList();
    }
    if (typeof window.kmApplyLanguage === 'function') {
      try { window.kmApplyLanguage(); } catch (e0) {}
    }
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(); } catch (e1) {}
    }
  };

  window.kmLawsShowHub = function () {
    const hub = document.getElementById('kmLawsHub');
    const panel = document.getElementById('kmLawsLocalPanel');
    if (hub) hub.classList.remove('is-hidden');
    if (panel) panel.classList.remove('is-open');
  };

  window.kmLawsOpenArlis = async function (sectionOrUrl) {
    // Offline-first: never open browser; open local official HTML in-app.
    const card = findLawCard(sectionOrUrl);
    if (card && card.id) {
      await window.kmLawsOpenLocal(card.id);
      return;
    }
    if (typeof toast === 'function') toast('Բացվում է միայն ծրագրում՝ առանց համացանցի', 'warn');
  };

  function stripViewerHtmlAutoPrint(html) {
    let s = String(html || '');
    s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<script\b[^>]*\/>/gi, '');
    s = s.replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
    s = s.replace(/\bwindow\s*\.\s*print\s*\(\s*\)\s*;?/gi, '');
    return s;
  }

  function pdfTextToEditableHtml(title, text) {
    const escLocal = function (t) {
      return String(t || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };
    const paras = String(text || '').split(/\n+/).map(function (p) {
      const line = String(p || '').trim();
      return line ? ('<p>' + escLocal(line) + '</p>') : '<p><br></p>';
    }).join('\n');
    return '<!DOCTYPE html><html lang="hy"><head><meta charset="utf-8">' +
      '<style>body{font-family:"Times New Roman",Times,serif;font-size:15px;line-height:1.55;' +
      'padding:28px 32px;max-width:920px;margin:0 auto;color:#111}' +
      'p{margin:0 0 .7em} h1{font-size:1.25em;margin:0 0 1em}</style></head><body>' +
      '<h1>' + escLocal(title || 'Փաստաթուղթ') + '</h1>' +
      (paras || '<p><br></p>') +
      '</body></html>';
  }

  function buildPdfTranslateReq(wrap, file, targetLang) {
    const req = { targetLang: targetLang };
    if (wrap && wrap._kmOpenReq) {
      Object.assign(req, wrap._kmOpenReq);
    }
    if (wrap && wrap._kmPdfPath) {
      req.path = wrap._kmPdfPath;
      req.name = wrap._kmPdfName || 'document.pdf';
      return req;
    }
    if (file && file.path) {
      req.path = file.path;
      req.name = file.name || 'document.pdf';
      return req;
    }
    return null;
  }

  async function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const data = String(reader.result || '');
        const i = data.indexOf(',');
        resolve(i >= 0 ? data.slice(i + 1) : data);
      };
      reader.onerror = function () { reject(reader.error || new Error('read failed')); };
      reader.readAsDataURL(file);
    });
  }

  function kmDocViewerSetPdfReady(wrap) {
    if (!wrap) return;
    wrap._kmPdfReady = true;
    const btn = wrap.querySelector('#kmDocTrBtn');
    if (btn) btn.disabled = false;
    const statusEl = wrap.querySelector('#kmDocTrStatus');
    if (statusEl && !statusEl.textContent) statusEl.textContent = '';
  }

  window.kmLawsShowDocViewer = function (name, mime, payload) {
    injectLibCss();
    window.kmLawsCloseDocViewer();
    payload = payload || {};
    const isHtml = /html/i.test(mime || '') || !!payload.html;
    const isPdf = /pdf/i.test(mime || '') || /\.pdf$/i.test(String(name || '')) || (!isHtml && !!(payload.base64 || payload.docUrl || payload.path));
    const title = String(name || 'Փաստաթուղթ').replace(/\.(html?|pdf)$/i, '');
    const wrap = document.createElement('div');
    wrap.id = 'kmDocViewer';
    wrap.className = 'kmDocViewer';
    wrap._kmIsPdf = !!isPdf;
    wrap._kmIsHtml = !!isHtml;
    wrap._kmPdfName = /\.pdf$/i.test(String(name || '')) ? String(name) : (title + '.pdf');
    wrap._kmPdfPath = payload.path || payload.filePath || '';
    wrap._kmOpenReq = payload.openReq || null;
    wrap._kmPdfReady = !!wrap._kmPdfPath;
    wrap._kmHtmlEditing = false;
    wrap._kmPdfEditing = false;
    const superOk = isSuperAdmin();
    const canEditDoc = superOk && (isPdf || isHtml);
    const pdfTools = isPdf
      ? '<label class="kmDocTrPick" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600">' +
          'Լեզու<select id="kmDocTrLang" style="padding:4px 8px;border-radius:6px;border:1px solid #c5d0dc">' +
            '<option value="hy">Հայերեն</option><option value="ru">Русский</option><option value="en">English</option>' +
          '</select></label>' +
          '<button type="button" id="kmDocTrBtn" onclick="kmDocViewerTranslate()">Թարգմանել</button>' +
          (canEditDoc
            ? ('<button type="button" id="kmDocEditBtn" class="primary" onclick="kmDocViewerEditPdf()">Խմբագրել</button>' +
               '<button type="button" id="kmDocSavePdfHtmlBtn" onclick="kmDocViewerSavePdfFromHtml()" style="display:none" title="Պահպանել փոփոխությունները PDF">Պահպանել</button>' +
               '<button type="button" id="kmDocWordBtn" onclick="kmDocViewerEditPdfWord()" title="Բացել Microsoft Word-ում">Word</button>' +
               '<button type="button" id="kmDocSavePdfBtn" onclick="kmDocViewerSavePdfFromWord()" title="Word-ից պահպանել PDF" style="display:none">Պահպանել Word-ից</button>' +
               '<button type="button" id="kmDocReloadBtn" onclick="kmDocViewerReloadPdf()" title="Թարմացնել դիտումը">Թարմացնել</button>')
            : '') +
          '<span id="kmDocTrStatus" class="muted" style="font-size:12px;max-width:220px"></span>'
      : '';
    const htmlTools = isHtml
      ? (canEditDoc
          ? ('<button type="button" id="kmDocEditBtn" class="primary" onclick="kmDocViewerEditHtml()">Խմբագրել</button>' +
             '<button type="button" id="kmDocSaveHtmlBtn" onclick="kmDocViewerSaveHtml()" style="display:none">Պահպանել</button>' +
             '<button type="button" id="kmDocWordBtn" onclick="kmDocViewerEditPdfWord()" title="Բացել Word-ում">Word</button>' +
             '<button type="button" id="kmDocReloadBtn" onclick="kmDocViewerReloadHtml()">Թարմացնել</button>' +
             '<span id="kmDocTrStatus" class="muted" style="font-size:12px;max-width:260px"></span>')
          : '')
      : '';
    wrap.innerHTML =
      '<div class="kmDocViewerCard">' +
        '<div class="kmDocViewerTop">' +
          '<h3>' + esc(title) + '</h3>' +
          '<div class="toolbar" style="margin:0">' +
            pdfTools +
            htmlTools +
            '<button type="button" id="kmDocPrintBtn" onclick="event.stopPropagation();kmLawsPrintDocViewer()">Տպել</button>' +
            '<button type="button" id="kmDocFsBtn" onclick="kmLawsToggleDocFullscreen()">Ամբողջ Էկրան</button>' +
            '<button type="button" onclick="kmLawsCloseDocViewer()">← Վերադարձ</button>' +
          '</div>' +
        '</div>' +
        '<iframe class="kmDocViewerFrame' + (isHtml ? '' : ' is-pdf') + '" title="' + esc(title) + '"' +
          (isHtml ? ' sandbox="allow-same-origin"' : '') + '></iframe>' +
      '</div>';
    document.body.appendChild(wrap);
    if (wrap._kmPdfPath) kmDocViewerSetPdfReady(wrap);
    const frame = wrap.querySelector('iframe');
    if (isHtml) {
      let html = stripViewerHtmlAutoPrint(payload.html || '');
      if (!html && payload.base64) {
        try { html = stripViewerHtmlAutoPrint(atob(payload.base64)); } catch (e) { html = ''; }
      }
      if (html && !/<meta[^>]+charset\s*=/i.test(html)) {
        if (/<head[\s>]/i.test(html)) {
          html = html.replace(/<head(\s[^>]*)?>/i, function (m) { return m + '<meta charset="utf-8">'; });
        } else if (/<html[\s>]/i.test(html)) {
          html = html.replace(/<html(\s[^>]*)?>/i, function (m) { return m + '<head><meta charset="utf-8"></head>'; });
        } else {
          html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
        }
      }
      frame.srcdoc = html || '<html><head><meta charset="utf-8"></head><body><p>Բովանդակություն չկա</p></body></html>';
    } else {
      const docUrl = payload.docUrl || '';
      const b64 = payload.base64 || '';
      const applyPdfBytes = function (bytes) {
        try {
          wrap._kmPdfBytes = bytes;
          const blob = new Blob([bytes], { type: mime || 'application/pdf' });
          const url = URL.createObjectURL(blob);
          wrap._kmBlobUrl = url;
          frame.src = url + '#toolbar=0&navpanes=0';
          kmDocViewerSetPdfReady(wrap);
        } catch (e) {
          frame.srcdoc = '<html><body><p>PDF-ը բացել չհաջողվեց</p></body></html>';
        }
      };
      if (b64) {
        try {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          applyPdfBytes(bytes);
        } catch (e) {
          frame.srcdoc = '<html><body><p>PDF-ը բացել չհաջողվեց</p></body></html>';
        }
      } else if (docUrl) {
        fetch(docUrl).then(function (res) {
          if (!res.ok) throw new Error('PDF load');
          return res.arrayBuffer();
        }).then(function (buf) {
          applyPdfBytes(new Uint8Array(buf));
        }).catch(function () {
          frame.src = docUrl + (docUrl.indexOf('#') >= 0 ? '&toolbar=0' : '#toolbar=0&navpanes=0');
        });
      } else {
        frame.srcdoc = '<html><body><p>PDF բովանդակություն չկա</p></body></html>';
      }
    }
    wrap.addEventListener('click', function (ev) {
      if (ev.target === wrap) window.kmLawsCloseDocViewer();
    });
  };

  window.kmDocViewerEditPdfWord = async function () {
    if (!isSuperAdmin()) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմին կարող է խմբագրել', 'error');
      return;
    }
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !(wrap._kmIsPdf || wrap._kmIsHtml || wrap._kmPdfEditing)) return;
    const api = window.kmNative && window.kmNative.library && window.kmNative.library.editPdf;
    if (!api) {
      if (typeof toast === 'function') toast('Խմբագրումը հասանելի չէ այս միջավայրում', 'error');
      return;
    }
    const statusEl = document.getElementById('kmDocTrStatus');
    const btn = document.getElementById('kmDocWordBtn');
    const saveWordBtn = document.getElementById('kmDocSavePdfBtn');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = 'Word-ում բացվում է…';
    try {
      const req = Object.assign({}, wrap._kmOpenReq || {}, {
        path: wrap._kmPdfPath || '',
        token: adminToken()
      });
      const r = await api(req);
      if (!r || !r.ok) {
        if (typeof toast === 'function') toast((r && r.message) || 'Չհաջողվեց բացել Word-ում', 'error');
        if (statusEl) statusEl.textContent = '';
        return;
      }
      if (r.path) wrap._kmPdfPath = r.path;
      if (saveWordBtn) saveWordBtn.style.display = '';
      if (typeof toast === 'function') {
        toast('Բացվեց Word-ում։ Փոփոխությունից հետո՝ «Պահպանել Word-ից», ապա «Թարմացնել»։');
      }
      if (statusEl) statusEl.textContent = 'Word → Պահպանել Word-ից → Թարմացնել';
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
      if (statusEl) statusEl.textContent = '';
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.kmDocViewerEditPdf = async function () {
    if (!isSuperAdmin()) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմին կարող է խմբագրել', 'error');
      return;
    }
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !wrap._kmIsPdf) return;
    const api = window.kmNative && window.kmNative.library && window.kmNative.library.extractPdfText;
    if (!api) {
      if (typeof toast === 'function') toast('Խմբագրումը հասանելի չէ', 'error');
      return;
    }
    const statusEl = document.getElementById('kmDocTrStatus');
    const btn = document.getElementById('kmDocEditBtn');
    const saveBtn = document.getElementById('kmDocSavePdfHtmlBtn');
    const frame = wrap.querySelector('iframe');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = 'Տեքստը արտահանվում է խմբագրման համար…';
    try {
      const r = await api(Object.assign({}, wrap._kmOpenReq || {}, {
        path: wrap._kmPdfPath || '',
        token: adminToken()
      }));
      if (!r || !r.ok) throw new Error((r && r.message) || 'Տեքստ չհաջողվեց արտահանել');
      const title = String(wrap.querySelector('h3') && wrap.querySelector('h3').textContent || 'Փաստաթուղթ');
      const html = pdfTextToEditableHtml(title, r.text || '');
      if (wrap._kmBlobUrl) {
        try { URL.revokeObjectURL(wrap._kmBlobUrl); } catch (e0) {}
        wrap._kmBlobUrl = null;
      }
      wrap._kmPdfEditing = true;
      wrap._kmIsPdf = false;
      wrap._kmIsHtml = true;
      if (frame) {
        frame.classList.remove('is-pdf');
        frame.removeAttribute('src');
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.srcdoc = html;
        setTimeout(function () {
          try {
            const doc = frame.contentDocument;
            if (doc && doc.body) {
              doc.designMode = 'on';
              doc.body.contentEditable = 'true';
              doc.body.focus();
            }
          } catch (e1) {}
        }, 80);
      }
      if (saveBtn) saveBtn.style.display = '';
      if (btn) btn.textContent = 'Խմբագրում…';
      if (statusEl) statusEl.textContent = 'Խմբագրեք տեքստը, ապա «Պահպանել»';
      if (typeof toast === 'function') toast('PDF խմբագրումը միացված է — փոխեք տեքստը և պահպանեք');
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.kmDocViewerSavePdfFromHtml = async function () {
    if (!isSuperAdmin()) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմին', 'error');
      return;
    }
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !wrap._kmPdfEditing) return;
    const api = window.kmNative && window.kmNative.library && window.kmNative.library.savePdfFromHtml;
    if (!api) {
      if (typeof toast === 'function') toast('Պահպանումը հասանելի չէ', 'error');
      return;
    }
    const frame = wrap.querySelector('iframe');
    const statusEl = document.getElementById('kmDocTrStatus');
    const saveBtn = document.getElementById('kmDocSavePdfHtmlBtn');
    try {
      const doc = frame && frame.contentDocument;
      if (!doc) throw new Error('Փաստաթուղթ չկա');
      const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      if (saveBtn) saveBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'PDF պահպանվում է…';
      const r = await api(Object.assign({}, wrap._kmOpenReq || {}, {
        path: wrap._kmPdfPath || '',
        html: html,
        token: adminToken()
      }));
      if (!r || !r.ok) throw new Error((r && r.message) || 'Պահպանումը ձախողվեց');
      if (r.path) wrap._kmPdfPath = r.path;
      if (typeof toast === 'function') toast('PDF-ը պահպանվեց');
      if (statusEl) statusEl.textContent = 'Պահպանված է';
      wrap._kmPdfEditing = false;
      wrap._kmIsPdf = true;
      wrap._kmIsHtml = false;
      const editBtn = document.getElementById('kmDocEditBtn');
      if (editBtn) editBtn.textContent = 'Խմբագրել';
      if (saveBtn) saveBtn.style.display = 'none';
      await window.kmDocViewerReloadPdf();
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  window.kmDocViewerSavePdfFromWord = async function () {
    if (!isSuperAdmin()) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմին', 'error');
      return;
    }
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !wrap._kmIsPdf) return;
    const api = window.kmNative && window.kmNative.library && window.kmNative.library.savePdfFromWord;
    if (!api) {
      if (typeof toast === 'function') toast('Պահպանումը հասանելի չէ', 'error');
      return;
    }
    const statusEl = document.getElementById('kmDocTrStatus');
    const btn = document.getElementById('kmDocSavePdfBtn');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = 'PDF պահպանվում է Word-ից…';
    try {
      const r = await api(Object.assign({}, wrap._kmOpenReq || {}, {
        path: wrap._kmPdfPath || '',
        token: adminToken()
      }));
      if (!r || !r.ok) throw new Error((r && r.message) || 'Պահպանումը ձախողվեց');
      if (r.path) wrap._kmPdfPath = r.path;
      if (typeof toast === 'function') toast('PDF-ը պահպանվեց։ Սեղմեք «Թարմացնել»։');
      if (statusEl) statusEl.textContent = 'Պահպանված է — սեղմեք Թարմացնել';
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.kmDocViewerEditHtml = function () {
    if (!isSuperAdmin()) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմին կարող է խմբագրել', 'error');
      return;
    }
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !wrap._kmIsHtml) return;
    const frame = wrap.querySelector('iframe');
    const statusEl = document.getElementById('kmDocTrStatus');
    const saveBtn = document.getElementById('kmDocSaveHtmlBtn');
    const editBtn = document.getElementById('kmDocEditBtn');
    try {
      const doc = frame && frame.contentDocument;
      if (!doc || !doc.body) throw new Error('Փաստաթուղթը դեռ պատրաստ չէ');
      doc.designMode = 'on';
      if (doc.body) {
        doc.body.contentEditable = 'true';
        doc.body.focus();
      }
      wrap._kmHtmlEditing = true;
      if (saveBtn) saveBtn.style.display = '';
      if (editBtn) editBtn.textContent = 'Խմբագրում…';
      if (statusEl) statusEl.textContent = 'Խմբագրեք տեքստը, ապա «Պահպանել»';
      if (typeof toast === 'function') toast('HTML խմբագրումը միացված է');
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmDocViewerSaveHtml = async function () {
    if (!isSuperAdmin()) {
      if (typeof toast === 'function') toast('Միայն սուպեր ադմին կարող է պահպանել', 'error');
      return;
    }
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !wrap._kmIsHtml) return;
    const frame = wrap.querySelector('iframe');
    const statusEl = document.getElementById('kmDocTrStatus');
    const saveBtn = document.getElementById('kmDocSaveHtmlBtn');
    const api = window.kmNative && window.kmNative.library && window.kmNative.library.saveHtml;
    if (!api) {
      if (typeof toast === 'function') toast('Պահպանումը հասանելի չէ', 'error');
      return;
    }
    try {
      const doc = frame && frame.contentDocument;
      if (!doc) throw new Error('Փաստաթուղթ չկա');
      const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      if (saveBtn) saveBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Պահպանվում է…';
      const r = await api(Object.assign({}, wrap._kmOpenReq || {}, {
        path: wrap._kmPdfPath || '',
        html: html,
        token: adminToken()
      }));
      if (!r || !r.ok) throw new Error((r && r.message) || 'Պահպանումը ձախողվեց');
      if (r.path) wrap._kmPdfPath = r.path;
      try {
        doc.designMode = 'off';
        if (doc.body) doc.body.contentEditable = 'false';
      } catch (e0) {}
      wrap._kmHtmlEditing = false;
      const editBtn = document.getElementById('kmDocEditBtn');
      if (editBtn) editBtn.textContent = 'Խմբագրել';
      if (saveBtn) saveBtn.style.display = 'none';
      if (statusEl) statusEl.textContent = 'Պահպանված է';
      if (typeof toast === 'function') toast('Փոփոխությունները պահպանվեցին');
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  };

  window.kmDocViewerReloadHtml = async function () {
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap || !wrap._kmIsHtml || wrap._kmPdfEditing) return;
    const statusEl = document.getElementById('kmDocTrStatus');
    const frame = wrap.querySelector('iframe');
    const openReq = wrap._kmOpenReq;
    if (statusEl) statusEl.textContent = 'Թարմացվում է…';
    try {
      if (!openReq || !openReq.id) throw new Error('Ֆայլի նույնացուցիչ չկա');
      const r = await libApi('open', Object.assign({}, openReq, { inApp: true }));
      if (!r || !r.ok) throw new Error((r && r.message) || 'Չթարմացվեց');
      if (r.path) wrap._kmPdfPath = r.path;
      let html = stripViewerHtmlAutoPrint(r.html || '');
      if (!html && r.base64) {
        try { html = stripViewerHtmlAutoPrint(atob(r.base64)); } catch (e1) { html = ''; }
      }
      if (!html) throw new Error('Բովանդակություն չկա');
      if (html && !/<meta[^>]+charset\s*=/i.test(html)) {
        if (/<head[\s>]/i.test(html)) {
          html = html.replace(/<head(\s[^>]*)?>/i, function (m) { return m + '<meta charset="utf-8">'; });
        } else {
          html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
        }
      }
      if (frame) frame.srcdoc = html;
      wrap._kmHtmlEditing = false;
      const saveBtn = document.getElementById('kmDocSaveHtmlBtn');
      const editBtn = document.getElementById('kmDocEditBtn');
      if (saveBtn) saveBtn.style.display = 'none';
      if (editBtn) editBtn.textContent = 'Խմբագրել';
      if (statusEl) statusEl.textContent = 'Թարմացված է';
      if (typeof toast === 'function') toast('Դիտումը թարմացվեց');
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmDocViewerReloadPdf = async function () {
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap) return;
    const statusEl = document.getElementById('kmDocTrStatus');
    const frame = wrap.querySelector('iframe');
    if (statusEl) statusEl.textContent = 'Թարմացվում է…';
    try {
      let bytes = null;
      const openReq = wrap._kmOpenReq;
      if (openReq && openReq.id) {
        let r = null;
        if (openReq.store === 'laws' && typeof libApi === 'function') {
          try {
            r = await libApi('lawsRead', { id: openReq.id, section: openReq.section });
          } catch (eLaws) { r = null; }
        }
        if (!r || !r.ok) {
          r = await libApi('open', Object.assign({}, openReq, { inApp: true, reload: true, wantBase64: true }));
        }
        if (r && r.ok) {
          if (r.path) wrap._kmPdfPath = r.path;
          if (r.base64) {
            const bin = atob(r.base64);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          } else if (r.docUrl) {
            const res = await fetch(r.docUrl + (r.docUrl.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now());
            if (!res.ok) throw new Error('PDF load');
            bytes = new Uint8Array(await res.arrayBuffer());
          }
        }
      }
      if (!bytes && wrap._kmPdfPath) {
        const r2 = await libApi('open', Object.assign({}, openReq || {}, {
          inApp: true,
          reload: true,
          wantBase64: true,
          path: wrap._kmPdfPath
        }));
        if (r2 && r2.base64) {
          const bin = atob(r2.base64);
          bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else if (r2 && r2.docUrl) {
          const res = await fetch(r2.docUrl + (r2.docUrl.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now());
          if (res.ok) bytes = new Uint8Array(await res.arrayBuffer());
        }
      }
      if (!bytes) throw new Error('Ֆայլը չի թարմացվել');
      if (wrap._kmBlobUrl) {
        try { URL.revokeObjectURL(wrap._kmBlobUrl); } catch (e0) {}
      }
      wrap._kmPdfBytes = bytes;
      wrap._kmIsPdf = true;
      wrap._kmIsHtml = false;
      wrap._kmPdfEditing = false;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      wrap._kmBlobUrl = url;
      if (frame) {
        frame.classList.add('is-pdf');
        frame.removeAttribute('sandbox');
        frame.removeAttribute('srcdoc');
        frame.src = url + '#toolbar=0&navpanes=0';
      }
      const saveHtmlBtn = document.getElementById('kmDocSavePdfHtmlBtn');
      const editBtn = document.getElementById('kmDocEditBtn');
      if (saveHtmlBtn) saveHtmlBtn.style.display = 'none';
      if (editBtn) editBtn.textContent = 'Խմբագրել';
      if (statusEl) statusEl.textContent = 'Թարմացված է';
      if (typeof toast === 'function') toast('PDF դիտումը թարմացվեց');
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    }
  };

  window.kmDocViewerTranslate = async function () {
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap) return;
    if (!wrap._kmIsPdf && !wrap._kmPdfBytes && !wrap._kmPdfPath) {
      if (typeof toast === 'function') toast('Թարգմանել կարելի է PDF ֆայլը', 'error');
      return;
    }
    const langEl = document.getElementById('kmDocTrLang');
    const statusEl = document.getElementById('kmDocTrStatus');
    const btn = document.getElementById('kmDocTrBtn');
    const targetLang = langEl ? langEl.value : 'hy';
    const api = window.kmNative && window.kmNative.pdfTranslate;
    if (!api || typeof api.run !== 'function') {
      if (typeof toast === 'function') toast('PDF թարգմանության համակարգը հասանելի չէ', 'error');
      return;
    }
    if (statusEl) statusEl.textContent = 'Պատրաստվում է…';
    if (btn) btn.disabled = true;
    try {
      let req = buildPdfTranslateReq(wrap, null, targetLang);
      if (!req || !req.path) {
        let bytes = wrap._kmPdfBytes;
        if (!bytes && wrap._kmBlobUrl) {
          const res = await fetch(wrap._kmBlobUrl);
          if (!res.ok) throw new Error('PDF կարդալ չհաջողվեց');
          bytes = new Uint8Array(await res.arrayBuffer());
          wrap._kmPdfBytes = bytes;
        }
        if (!bytes || !bytes.length) {
          throw new Error('PDF բովանդակություն չկա');
        }
        req = Object.assign({}, wrap._kmOpenReq || {}, {
          name: wrap._kmPdfName || 'document.pdf',
          base64: await (async function () {
            let bin = '';
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
            }
            return btoa(bin);
          })(),
          targetLang: targetLang
        });
      } else {
        req.targetLang = targetLang;
      }
      req.mode = req.mode || 'auto';
      try {
        const s = window.kmNative && window.kmNative.settings ? await window.kmNative.settings.get() : {};
        if (s && s.helpBotLlmModel) req.model = s.helpBotLlmModel;
        if (s && s.helpBotLlmBaseUrl) req.ollamaUrl = s.helpBotLlmBaseUrl;
      } catch (eSet) {}
      if (statusEl) statusEl.textContent = 'Արտահանվում է տեքստը և թարգմանվում է…';
      const r = await api.run(req);
      if (!r || !r.ok) {
        const msg = (r && r.message) || 'Ձախողվեց';
        if (statusEl) statusEl.textContent = msg;
        if (typeof toast === 'function') toast(msg, 'error');
        return;
      }
      const frame = wrap.querySelector('iframe');
      if (frame && r.html) {
        if (wrap._kmBlobUrl) {
          try { URL.revokeObjectURL(wrap._kmBlobUrl); } catch (e1) {}
          wrap._kmBlobUrl = null;
        }
        wrap._kmIsPdf = false;
        wrap._kmPdfBytes = null;
        wrap._kmTranslated = true;
        frame.classList.remove('is-pdf');
        let html = stripViewerHtmlAutoPrint(r.html);
        if (html && !/<meta[^>]+charset\s*=/i.test(html)) {
          if (/<head[\s>]/i.test(html)) {
            html = html.replace(/<head(\s[^>]*)?>/i, function (m) { return m + '<meta charset="utf-8">'; });
          } else {
            html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
          }
        }
        frame.removeAttribute('src');
        frame.setAttribute('sandbox', 'allow-same-origin');
        frame.srcdoc = html;
      }
      if (statusEl) {
        statusEl.textContent = 'Պատրաստ · ' + (r.chunks || 1) + ' հատված · ' + (r.extractedChars || 0) + ' նիշ';
      }
      if (typeof toast === 'function') toast('Թարգմանությունը պատրաստ է', 'ok');
    } catch (e) {
      if (statusEl) statusEl.textContent = e.message || String(e);
      if (typeof toast === 'function') toast(e.message || String(e), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.kmLawsPrintDocViewer = async function () {
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap) return;
    const frame = wrap.querySelector('iframe');
    const statusToast = function (msg, kind) {
      if (typeof toast === 'function') toast(msg, kind || 'warn');
    };
    try {
      /* Միայն բացահայտ «Տպել» սեղմումից — ավտոմատ չկանչել */
      if (wrap._kmIsPdf || wrap._kmPdfBytes || wrap._kmPdfPath) {
        const api = window.kmNative && window.kmNative.library && window.kmNative.library.printPdf;
        if (api) {
          let req = null;
          if (wrap._kmPdfPath) {
            req = { path: wrap._kmPdfPath };
          } else if (wrap._kmPdfBytes && wrap._kmPdfBytes.length) {
            let bin = '';
            const bytes = wrap._kmPdfBytes;
            const chunk = 0x8000;
            for (let i = 0; i < bytes.length; i += chunk) {
              bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
            }
            req = { base64: btoa(bin), name: wrap._kmPdfName || 'document.pdf' };
          }
          if (req) {
            statusToast('Տպման պատուհան…', 'ok');
            const r = await api(req);
            if (r && r.ok) return;
            if (r && r.message) statusToast(r.message, 'error');
          }
        }
        const blobUrl = wrap._kmBlobUrl;
        if (blobUrl) {
          const w = window.open(blobUrl, '_blank');
          if (w) {
            setTimeout(function () {
              try { w.focus(); w.print(); } catch (e1) {}
            }, 900);
            return;
          }
        }
      }
      if (frame && frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
      window.print();
    } catch (e) {
      statusToast((e && e.message) || 'Տպել չհաջողվեց', 'error');
    }
  };

  window.kmLawsToggleDocFullscreen = function () {
    const wrap = document.getElementById('kmDocViewer');
    if (!wrap) return;
    wrap.classList.toggle('is-fs');
    const btn = document.getElementById('kmDocFsBtn');
    if (btn) btn.textContent = wrap.classList.contains('is-fs') ? 'Պատուհան' : 'Ամբողջ Էկրան';
  };

  window.kmLawsCloseDocViewer = function () {
    const wrap = document.getElementById('kmDocViewer');
    if (wrap && wrap._kmBlobUrl) {
      try { URL.revokeObjectURL(wrap._kmBlobUrl); } catch (e) {}
    }
    wrap?.remove();
  };

  window.kmLawsOpenStatutesHub = function () {
    injectLibCss();
    window._kmLawSubPage = 'statutes';
    window._kmLawOpenSection = 'statutes';
    const host = document.getElementById('content') || content;
    if (host) content = host;
    const cards = ZU_STATUTE_CARDS.map((c) => htmlLawCard(c)).join('');
    content.innerHTML = '<div class="card kmLawsHubWrap" style="margin-bottom:0">' +
      '<div class="kmLawsHub" id="kmLawsHub">' +
        '<div class="toolbar" style="margin-bottom:10px"><button type="button" onclick="kmLawDocsPage()">← Վերադարձ</button></div>' +
        '<h3 class="kmLawsHubTitle">ՀՀ ԶՈՒ ԿԱՆՈՆԱԴՐՈՒԹՅՈՒՆՆԵՐ</h3>' +
        '<p class="kmLawsHubLead">Համազորային կանոնագրքեր՝ Ներքին ծառայություն, Կայազորային և պահակային, Կարգապահական, Շարային։ Սեղմեք՝ ծրագրում բացելու համար։</p>' +
        '<div class="kmLawsGrid" role="list">' + cards + '</div>' +
      '</div>' +
      '<div class="kmLawsLocalPanel" id="kmLawsLocalPanel"></div>' +
    '</div>';
  };

  window.kmLawsOpenOrdersHub = function () {
    injectLibCss();
    window._kmLawSubPage = 'orders';
    window._kmLawOpenSection = 'orders';
    const host = document.getElementById('content') || content;
    if (host) content = host;
    const cards = ORDER_SUB_CARDS.map((c) => htmlLawCard(c)).join('');
    content.innerHTML = '<div class="card kmLawsHubWrap" style="margin-bottom:0">' +
      '<div class="kmLawsHub" id="kmLawsHub">' +
        '<div class="toolbar" style="margin-bottom:10px"><button type="button" onclick="kmLawDocsPage()">← Վերադարձ</button></div>' +
        '<h3 class="kmLawsHubTitle">ՀՐԱՄԱՆՆԵՐ</h3>' +
        '<p class="kmLawsHubLead">Նախագահի, վարչապետի, ՊՆ նախարարի, ԳՇ պետի, բանակային կորպուսի և ԳՆԴի հրամանատարի հրամաններ։ Ընտրեք ենթաբաժինը, ապա՝ հրամանը։ Ցանկում նշվում է՝ տեղային տեքստը հասանելի է, թե առկա է միայն վերնագիրը։</p>' +
        '<div class="kmLawsGrid" role="list">' + cards + '</div>' +
      '</div>' +
      '<div class="kmLawsLocalPanel" id="kmLawsLocalPanel"></div>' +
    '</div>';
  };

  window.kmLawsOpenLocal = async function (section) {
    if (typeof window.kmLegalInlineOpen === 'function' && window.kmLegalInlineOpen(section)) return;
    if (section === 'statutes') {
      window.kmLawsOpenStatutesHub();
      return;
    }
    if (section === 'acts_discipline') {
      if (typeof window.kmDisciplinePenaltiesPage === 'function') {
        window.kmDisciplinePenaltiesPage({ back: 'kmLawDocsPage()' });
        return;
      }
    }
    if (section === 'characteristic' || section === 'internal') {
      if (typeof window.kmCharacteristicPage === 'function') {
        window.kmCharacteristicPage({ back: 'kmLawDocsPage()' });
        return;
      }
    }
    if (section === 'encouragements') {
      if (typeof window.kmEncouragementsPage === 'function') {
        window.kmEncouragementsPage({ back: 'kmLawDocsPage()' });
        return;
      }
    }
    if (section === 'orders') {
      window.kmLawsOpenOrdersHub();
      return;
    }
    if (section === 'soldier_rights') {
      if (typeof window.kmSoldierRightsHub === 'function') {
        window.kmSoldierRightsHub();
        return;
      }
    }
    if (!LAW_SECTIONS.some((s) => s.id === section)) return;
    // Legal acts and rights are read from a single internal store; file-manager
    // controls remain only in dedicated document-workflow sections.
    if(section!=='acts_exam' && section!=='internal'){
      const item=LAW_SECTIONS.find((s)=>s.id===section);
      if(typeof window.kmLegalInlineOpen==='function' && window.kmLegalInlineOpen(section))return;
      if(typeof window.kmLegalShowUncatalogued==='function'){
        window.kmLegalShowUncatalogued(section,item.label);return;
      }
    }
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    lawSection = section;
    window._kmLawOpenSection = section;
    window._kmLawSubPage = section;
    lawOffset = 0;
    lawSearch = '';

    // View-only: card browser. Edit/admin: local panel with upload.
    if (!lawsCanMutate(section)) {
      if (lawsUsesFileBrowser(section)) {
        injectLibCss();
        const host = document.getElementById('content') || content;
        if (host) content = host;
        const backAction = getLawSectionBackAction(section);
        content.innerHTML = '<div class="card kmLawsHubWrap" style="margin-bottom:0">' +
          htmlLawsReadOnlyPanel(backAction) +
        '</div>';
        await refreshLawsList();
        try {
          await refreshLawsStats();
          const s = await libApi('lawsStats');
          updateLawSectionSubNav((s && s.counts) || {});
        } catch (e) {}
        return;
      }
      return;
    }

    const hub = document.getElementById('kmLawsHub');
    const backAction = getLawSectionBackAction(section);
    /* Միշտ վերակառուցել վահանակը՝ քարտերն ու սերմերը երաշխավորելու համար */
    content.innerHTML = '<div class="card kmLawsHubWrap" style="margin-bottom:0">' +
      htmlLawsLocalPanel({}, backAction) +
    '</div>';
    if (hub) { /* replaced */ }
    document.querySelectorAll('.kmLawsSubBtn, .kmOrderSubNavCard').forEach((b) => {
      b.classList.toggle('active', b.classList.contains('kmLawsSubBtn') && b.dataset.law === lawSection);
      b.classList.toggle('kmOrderSubNavActive', b.classList.contains('kmOrderSubNavCard') && b.dataset.law === lawSection);
    });
    const hint = document.getElementById('kmLawsActiveType');
    if (hint) hint.innerHTML = 'Ցուցադրվում է՝ <b>' + esc(lawMeta(lawSection).label) + '</b>';
    await refreshLawsStats();
    await refreshLawsList();
    updateLawsAdminToolbar(backAction);
  };

  window.kmLawsSetSection = function (section) {
    window.kmLawsOpenLocal(section);
  };

  window.kmLawsSearch = function (q) {
    lawSearch = String(q || '').trim();
    lawOffset = 0;
    refreshLawsList();
  };

  window.kmLawsPage = function (dir) {
    lawOffset = Math.max(0, lawOffset + dir * LIB_PAGE);
    refreshLawsList();
  };

  window.kmLawsOpen = async function (id, section) {
    // Legal acts, orders and rights open in the in-app reader, never as an external/file document.
    if (section && section !== 'acts_exam' && section !== 'internal' && typeof window.kmLegalInlineOpen === 'function' && window.kmLegalInlineOpen(section)) return;
    try {
      const r = await libApi('open', {
        id,
        store: 'laws',
        section: section || lawSection,
        inApp: true
      });
      if (!r || !r.ok) {
        if (typeof toast === 'function') toast((r && r.message) || 'Չբացվեց', 'error');
        return;
      }
      if (r.inApp && (r.html || r.base64 || r.docUrl || r.path)) {
        window.kmLawsShowDocViewer(r.name, r.mime || 'application/pdf', {
          html: r.html,
          base64: r.base64,
          docUrl: r.docUrl,
          path: r.path,
          openReq: { id: id, store: 'laws', section: section || lawSection, inApp: true }
        });
        return;
      }
      if (typeof toast === 'function') toast('Բացվեց արտաքին ծրագրով');
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  window.kmLawsDelete = async function (id, section, protectedFlag, fileName) {
    const isProt = protectedFlag === 1 || protectedFlag === true || protectedFlag === '1';
    if (isProt && !isSuperAdmin()) {
      if (typeof toast === 'function') toast("Այս ֆայլը ծրագրի մաս է։ Ջնջել կարող է միայն սուպեր ադմինը", 'error');
      return;
    }
    if (!lawsCanMutate(section || lawSection)) {
      if (typeof toast === 'function') toast('Միայն դիտում — ջնջել չի թույլատրվում', 'error');
      return;
    }
    if (!confirm("Ջնջե՞լ ֆայլը ֆայլերի պահոցից")) return; /* KM_RENAME_LEFTOVERS_V1 */
    try {
      await libApi('lawsRemove', {
        id,
        section: section || lawSection,
        token: adminToken(),
        adminToken: adminToken()
      });
      try { if (typeof window.kmHelpBotInvalidateKnowledge === 'function') window.kmHelpBotInvalidateKnowledge('laws_delete'); } catch (eInv) {}
      logLibChange('delete', fileName || id || 'ֆայլ');
      if (typeof toast === 'function') toast("Ջնջվեց");
      await refreshLawsStats();
      await refreshLawsList();
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  window.kmLawsUploadFolder = function () {
    if (!lawsCanAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    libApi('lawsImportFolder', lawSection).then(async (r) => {
      if (r && r.canceled) return;
      if (typeof toast === 'function') {
        toast(`Պանակից ավելացվեց ${r.added || 0}, բաց թողնված ${r.skipped || 0}`);
      }
      if (r && r.added) logLibChange('add', 'Պանակ · ' + (r.added || 0) + ' ֆայլ');
      lawOffset = 0;
      await refreshLawsStats();
      await refreshLawsList();
    }).catch((e) => alert(e.message || String(e)));
  };

  window.kmLawsUpload = function () {
    if (!lawsCanAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    if (lawsUsesTitledUpload(lawSection)) {
      window.kmLawsUploadTitled();
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.doc,.docx,.rtf,.odt,.xls,.xlsx,.xlsm,.csv,.ods,.pdf,.ppt,.pptx,.ppsx,.odp';
    inp.onchange = async () => {
      const files = [...(inp.files || [])];
      if (!files.length) return;
      let ok = 0;
      let fail = 0;
      for (const f of files) {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          await libApi('lawsAdd', { section: lawSection, name: f.name, bytes: [...bytes] });
          logLibChange('add', f.name);
          ok++;
        } catch (e) {
          fail++;
          if (typeof toast === 'function') toast((f.name || 'ֆայլ') + ': ' + (e.message || e));
        }
      }
      if (typeof toast === 'function') toast(`Ավելացվեց ${ok}, սխալ ${fail}`);
      lawOffset = 0;
      await refreshLawsStats();
      await refreshLawsList();
    };
    inp.click();
  };

  window.kmLawsUploadTitled = function () {
    if (!lawsCanAdd()) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    const old = document.getElementById('kmLawsUploadModal');
    if (old) old.remove();
    const meta = lawMeta(lawSection);
    const isExam = lawSection === 'acts_exam';
    const wrap = document.createElement('div');
    wrap.id = 'kmLawsUploadModal';
    wrap.className = 'kmModalOverlay';
    wrap.innerHTML =
      '<div class="kmModalCard" role="dialog" aria-modal="true">' +
        '<div class="kmModalHead">' +
          '<h3>' + esc(isExam ? 'Ավելացնել եզրակացություն' : 'Ավելացնել փաստաթուղթ') + '</h3>' +
          '<button type="button" class="kmModalClose" id="kmLawsUploadClose">×</button>' +
        '</div>' +
        '<p class="muted" style="margin:0 0 12px">' + esc(meta.label) + '</p>' +
        '<div class="kmFormGrid">' +
          '<label class="kmField kmFull"><span>Վ\u0565rնագիր</span>' +
            '<input id="kmLawsUploadTitle" type="text" autocomplete="off" placeholder="' + esc(isExam ? 'Եզրակացության վ\u0565rնագիր' : 'Հրամանի վ\u0565rնագիր') + '">' +
          '</label>' +
          '<label class="kmField kmFull"><span>Ֆայլ</span>' +
            '<input id="kmLawsUploadFile" type="file" accept=".doc,.docx,.rtf,.odt,.xls,.xlsx,.xlsm,.csv,.ods,.pdf,.ppt,.pptx,.ppsx,.odp,.html,.htm">' +
          '</label>' +
        '</div>' +
        '<div id="kmLawsUploadErr" class="kmFormError"></div>' +
        '<div class="kmModalActions">' +
          '<button type="button" id="kmLawsUploadCancel">Չեղարկել</button>' +
          '<button type="button" class="primary" id="kmLawsUploadSave">Պահպանել</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    const close = function () { wrap.remove(); };
    document.getElementById('kmLawsUploadClose').onclick = close;
    document.getElementById('kmLawsUploadCancel').onclick = close;
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    const titleEl = document.getElementById('kmLawsUploadTitle');
    const fileEl = document.getElementById('kmLawsUploadFile');
    const errEl = document.getElementById('kmLawsUploadErr');
    document.getElementById('kmLawsUploadSave').onclick = async function () {
      const title = titleEl ? String(titleEl.value || '').trim() : '';
      const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
      if (!title) {
        if (errEl) errEl.textContent = 'Լրացրեք վ\u0565rնագիրը';
        if (titleEl) titleEl.focus();
        return;
      }
      if (!file) {
        if (errEl) errEl.textContent = 'Ընտրեք ֆայլը';
        if (fileEl) fileEl.focus();
        return;
      }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await libApi('lawsAdd', {
          section: lawSection,
          name: file.name,
          displayName: title,
          bytes: [...bytes]
        });
        logLibChange('add', title || file.name);
        if (typeof toast === 'function') toast(isExam ? 'Եզրակացությունը ավելացվեց' : 'Փաստաթուղթը ավելացվեց');
        close();
        lawOffset = 0;
        await refreshLawsStats();
        await refreshLawsList();
      } catch (e) {
        if (errEl) errEl.textContent = (e && e.message) ? e.message : String(e);
      }
    };
    if (titleEl) titleEl.focus();
  };

  window.kmLibRefreshArchive = function () {
    if (libSection === 'archive' || libSection === 'current') renderLibSectionBody();
    else if (typeof window.kmLibSetSection === 'function') window.kmLibSetSection('archive');
  };

  window.kmSysSettingsBack = function () {
    window._kmSysSettingsSub = '';
    window._kmSysSettingsPending = '';
    if (typeof window.kmOpenPage === 'function') window.kmOpenPage('syssettings');
  };

  /* === KM_ARCHIVE_HUB_V1 === left-menu «Արխիվ» hub (between Գրադարան and Համակարգի կարգավորումներ).
     Cards moved here: Գրադարան → Հիշողություն (lib 'hishoxutyun'), Ընթացիկ արխիվ (lib 'current'), Արխիվ (lib 'archive');
     Համակարգի կարգավորումներ → Տեղեկություն ('sysinfo', kmSysInfoPage), Գործողությունների մատյան (kmOpenAuditLog).
     The pages themselves are unchanged (library sections still render through kmLibSetSection with page 'library',
     same storage); only their location, back target and active menu item change. */
  var KM_ARCH_LIB = { hishoxutyun: 1, current: 1, archive: 1 };
  window.KM_ARCHIVE_LIB_SECTIONS = ['hishoxutyun', 'current', 'archive'];
  window.kmIsArchiveLibSection = function (sec) { return !!KM_ARCH_LIB[String(sec || '')]; };
  function archNav() { try { return document.querySelector('.nav[data-page="archiveHub"]'); } catch (e) { return null; } }
  function archSetNav() { try { if (typeof kmSetActiveNav === 'function') kmSetActiveNav(archNav()); } catch (e) {} }
  function archTitle(t) {
    try {
      var pt = document.getElementById('pageTitle');
      if (pt) pt.textContent = typeof window.kmTranslateUI === 'function' ? window.kmTranslateUI(t) : t;
    } catch (e) {}
  }
  function archLibVisible(sec) {
    if (sec === 'archive' && !(typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin())) return false;
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      try { if (!window.kmCanAccessPage('library', sec)) return false; } catch (e) {}
    }
    return true;
  }
  window.kmArchiveHubHtml = function () {
    var card = typeof window.kmUiLawCard === 'function' ? window.kmUiLawCard : null;
    if (!card) return '<p class="muted">Արխիվը հասանելի չէ։</p>';
    var admin = libIsAdmin();
    var grid = '';
    if (archLibVisible('hishoxutyun')) grid += card('Հիշողություն', "kmArchiveOpen('hishoxutyun')", '🕘');
    if (archLibVisible('current')) grid += card('Ընթացիկ արխիվ', "kmArchiveOpen('current')", '💾');
    if (archLibVisible('archive')) grid += card('Արխիվ', "kmArchiveOpen('archive')", '🗄');
    /* KM_RIGHTS_V8: soldierCards grant (or archiveHub parent) */
    if (typeof window.kmSectionGranted !== 'function' || window.kmSectionGranted('soldierCards') || window.kmSectionGranted('archiveHub') || window.kmUserRole === 'admin') {
      grid += card('Զինծառայողների քարտեր', "kmArchiveOpen('soldierCards')", '📁');
    }
    if (admin) {
      grid += card('Գործողությունների մատյան', 'kmOpenAuditLog()', '📝') +
        card('UserData պահուստ', 'kmOpenBackupManager()', '💾') + /* KM_BACKUP_TO_ARCHIVE_V1: moved from Համակարգի կարգավորումներ */
        card('Տեղեկություն', "kmArchiveOpen('sysinfo')", 'ℹ️');
    }
    return '<h3 class="kmLawsHubTitle" style="margin-top:0">Արխիվ</h3>' +
      '<p class="kmLawsHubLead">Հիշողություն, ընթացիկ և պահպանված արխիվներ, զինծառայողների քարտեր' + (admin ? ', գործողությունների մատյան, UserData պահուստ և համակարգի տեղեկություն' : '') + '։</p>' +
      (grid ? '<div class="kmLawsGrid" data-km-cards="1">' + grid + '</div>' : '<p class="muted">Այս բաժնում Ձեզ հասանելի քարտ չկա։</p>');
  };
  window.kmArchiveHubPage = function () {
    window._kmArchiveSub = '';
    if (typeof page !== 'undefined') page = 'archiveHub';
    window.page = 'archiveHub';
    var pend = String(window._kmArchivePending || '');
    window._kmArchivePending = '';
    if (pend) { window.kmArchiveOpen(pend); return; }
    var host = document.getElementById('content');
    if (!host) return;
    archTitle('Արխիվ');
    archSetNav();
    host.innerHTML = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar('kmReportsBack()') : '') +
      '<div class="card" data-km-archive-hub="1">' + window.kmArchiveHubHtml() + '</div>';
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(host); } catch (eF) {}
    }
    if (typeof kmApplyLanguage === 'function') {
      try { kmApplyLanguage(); } catch (eL) {}
    }
  };
  window.kmArchiveOpen = function (section) {
    section = String(section || '');
    if (!section) { window.kmArchiveHubPage(); return; }
    if (section === 'soldierCards') {
      if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
        try {
          if (!window.kmCanAccessPage('soldierCards') && !window.kmCanAccessPage('archiveHub')) {
            if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
            return;
          }
        } catch (eSc) {}
      }
      var openSoldierCards = function () {
        window._kmArchiveSub = 'soldierCards';
        if (typeof page !== 'undefined') page = 'archiveHub';
        window.page = 'archiveHub';
        var hostSc = document.getElementById('content');
        if (!hostSc) return;
        archTitle('Զինծառայողների քարտեր');
        archSetNav();
        if (typeof window.kmSoldierCardsArchivePage === 'function') window.kmSoldierCardsArchivePage(hostSc);
        else hostSc.innerHTML = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar("kmArchiveOpen('')") : '') +
          '<div class="card"><p class="muted">Բաժինը դեռ չի բեռնվել։ Փակեք և նորից բացեք Արխիվը։</p></div>';
      };
      if (typeof window.kmSoldierCardsArchivePage !== 'function' && typeof window.kmLoadDeferredModules === 'function') {
        window.kmLoadDeferredModules(function () { openSoldierCards(); });
        return;
      }
      openSoldierCards();
      return;
    }
    if (section === 'auditLog') {
      if (typeof window.kmOpenAuditLog === 'function') window.kmOpenAuditLog();
      return;
    }
    if (section === 'sysinfo') {
      if (!libIsAdmin()) {
        if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
        return;
      }
      if (typeof window.kmSysInfoPage !== 'function' && typeof window.kmLoadPageModules === 'function' && !window._kmArchSysLoading) {
        window._kmArchSysLoading = 1;
        window.kmLoadPageModules('sysinfo', function () {
          window._kmArchSysLoading = 0;
          window.kmArchiveOpen('sysinfo');
        });
        return;
      }
      window._kmArchiveSub = 'sysinfo';
      window._kmSysSettingsSub = '';
      if (typeof page !== 'undefined') page = 'archiveHub';
      window.page = 'archiveHub';
      var host = document.getElementById('content');
      if (!host) return;
      archTitle('Տեղեկություն');
      archSetNav();
      if (typeof window.kmSysInfoPage === 'function') window.kmSysInfoPage(host);
      else host.innerHTML = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar('kmArchiveHubBack()') : '') +
        '<div class="card"><p class="muted">Տեղեկության բաժինը հասանելի չէ։</p></div>';
      return;
    }
    if (KM_ARCH_LIB[section]) {
      if (typeof window.kmLibSetSection === 'function') window.kmLibSetSection(section);
    }
  };
  /* «← Վերադարձ» of every moved page -> Արխիվ hub */
  window.kmArchiveHubBack = function () {
    window._kmArchiveSub = '';
    try {
      if (window.page === 'library' && KM_ARCH_LIB[String(window.kmLibSection || '')]) {
        libSection = '';
        window.kmLibSection = '';
        window._kmLibStaySection = '';
      }
    } catch (eL) {}
    if (typeof window.kmBackToPage === 'function') window.kmBackToPage('archiveHub');
    else if (typeof window.kmOpenPage === 'function') window.kmOpenPage('archiveHub');
  };
  /* === /KM_ARCHIVE_HUB_V1 === */

  /* === KM_MENU_REORG_V1 === Գրադարան sections moved into the «Աշխատանքային գործիքներ» hub (page 'unitTools').
     The pages are unchanged (they still render through kmLibSetSection with page 'library', same storage and grants
     lib:<id> / library); only their location, «← Վերադարձ» target and active menu item change. When every library
     section lives in another hub the Գրադարան hub itself is not shown any more: its navigation opens this hub. */
  var KM_TOOLS_LIB = { notes: 1, management: 1, spreadsheets: 1, fonts: 1, files: 1, pdfTranslate: 1, original: 1, convert: 1 }; /* KM_MENU15_V1: reports deleted; license -> syssettings */
  window.KM_TOOLS_LIB_SECTIONS = ['notes', 'management', 'spreadsheets', 'fonts', 'files', 'pdfTranslate', 'original', 'convert'];
  var KM_SYS_LIB = { license: 1 }; /* KM_MENU15_V1 */
  window.KM_SYS_LIB_SECTIONS = ['license'];
  window.kmIsSysLibSection = function (sec) { return !!KM_SYS_LIB[String(sec || '')]; };
  window.kmIsToolsLibSection = function (sec) { return !!KM_TOOLS_LIB[String(sec || '')]; };
  function kmLibHubEmpty() {
    for (var i = 0; i < LIB_SECTIONS.length; i++) {
      var id = LIB_SECTIONS[i].id;
      if (!KM_ARCH_LIB[id] && !KM_TOOLS_LIB[id]) return false;
    }
    return true;
  }
  window.kmLibHubEmpty = kmLibHubEmpty;
  function toolsNav() { try { return document.querySelector('.nav[data-page="unitTools"]'); } catch (e) { return null; } }
  function toolsSetNav() { try { if (typeof kmSetActiveNav === 'function') kmSetActiveNav(toolsNav()); } catch (e) {} }
  window.kmToolsSetNav = toolsSetNav;
  function toolsLibVisible(s) {
    if (s.superAdminOnly && !(typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin())) return false;
    if (s.adminOnly && !libIsAdmin()) return false;
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      try { if (!window.kmCanAccessPage('library', s.id)) return false; } catch (e) {}
    }
    return true;
  }
  /* Uniform kmLawCard cards (same onclick as the old Գրադարան hub, so grant filtering keeps working) */
  window.kmToolsLibCardsHtml = function () {
    var card = typeof window.kmUiLawCard === 'function' ? window.kmUiLawCard : null;
    if (!card) return '';
    return LIB_SECTIONS.filter(function (s) { return KM_TOOLS_LIB[s.id] && toolsLibVisible(s); }).map(function (s) {
      var h = card(String(s.label || ''), "kmLibSetSection('" + s.id + "')", s.icon || '📁');
      return h.replace('<button', '<button data-km-tools-lib="' + s.id + '"' + (s.adminOnly ? ' data-admin-only="1"' : '') + (s.superAdminOnly ? ' data-super-only="1"' : ''));
    }).join('');
  };
  window.kmToolsOpen = function (sec) {
    sec = String(sec || '');
    if (KM_TOOLS_LIB[sec] && typeof window.kmLibSetSection === 'function') window.kmLibSetSection(sec);
    else window.kmToolsHubBack();
  };
  /* «← Վերադարձ» of every moved page -> Աշխատանքային գործիքներ hub */
  window.kmToolsHubBack = function () {
    try {
      if (KM_TOOLS_LIB[String(libSection || window.kmLibSection || '')] || !String(window.kmLibSection || '')) {
        libSection = '';
        window.kmLibSection = '';
        window._kmLibStaySection = '';
      }
    } catch (eL) {}
    try {
      if (typeof kmCurrentView !== 'undefined' && kmCurrentView && kmCurrentView.kind === 'page' && kmCurrentView.value === 'library') {
        kmCurrentView = { kind: 'page', value: 'unitTools' };
      }
    } catch (eV) {}
    if (typeof window.kmBackToPage === 'function') window.kmBackToPage('unitTools');
    else if (typeof window.kmOpenPage === 'function') window.kmOpenPage('unitTools');
  };
  /* Empty Գրադարան hub requested (history restore, render(), old links) -> Աշխատանքային գործիքներ hub in place */
  function toolsShowHub() {
    libSection = '';
    window.kmLibSection = '';
    window._kmLibStaySection = '';
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      var okT = true;
      try { okT = !!window.kmCanAccessPage('unitTools'); } catch (eA) {}
      if (!okT) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        if (typeof window.kmOpenPage === 'function') window.kmOpenPage('home');
        return;
      }
    }
    try {
      if (typeof kmCurrentView !== 'undefined' && kmCurrentView && kmCurrentView.kind === 'page' && (kmCurrentView.value === 'library' || !kmCurrentView.value)) {
        kmCurrentView = { kind: 'page', value: 'unitTools' };
      }
    } catch (eV) {}
    try { if (typeof page !== 'undefined') page = 'unitTools'; } catch (eP) {}
    window.page = 'unitTools';
    if (typeof window.kmRenderUnitToolsHub === 'function') {
      try {
        var pt = document.getElementById('pageTitle');
        if (pt) pt.textContent = typeof window.kmTranslateUI === 'function' ? window.kmTranslateUI('Աշխատանքային գործիքներ') : 'Աշխատանքային գործիքներ';
      } catch (eT) {}
      toolsSetNav();
      window.kmRenderUnitToolsHub();
      toolsSetNav();
    } else if (typeof window.kmOpenPage === 'function') {
      window.kmOpenPage('unitTools');
    }
  }
  window.kmToolsShowHub = toolsShowHub;
  /* === /KM_MENU_REORG_V1 === */

  window.kmContextBackOnclick = function () {
    if (window.page === 'archiveHub' || (window.page === 'library' && KM_ARCH_LIB[String(window.kmLibSection || '')])) return 'kmArchiveHubBack()'; /* KM_ARCHIVE_HUB_V1 */
    if (window.page === 'syssettings' || window._kmSysSettingsSub || (String(window.kmLibSection || '') === 'license' && window.page === 'syssettings')) return 'kmSysSettingsBack()'; /* KM_MENU15_V1 */
    if ((window.page === 'library' || window.page === 'unitTools') && KM_TOOLS_LIB[String(window.kmLibSection || '')]) return 'kmToolsHubBack()'; /* KM_MENU_REORG_V1 */
    if (window.page === 'library' || window.kmLibSection) return 'kmLibShowHub()';
    return 'kmReportsBack()';
  };

  window.kmSysSettingsHubHtml = function () {
    var card = typeof window.kmUiLawCard === 'function' ? window.kmUiLawCard : null;
    if (!card) return '<p class="muted">Կարգավորումները հասանելի չեն։</p>';
    var admin = libIsAdmin();
    var grid = card('Ցանց և ֆայլեր', "kmSysSettingsOpen('network')", '🌐');
    if (admin) {
      grid += card('Արտոնագիր', "kmSysSettingsOpen('license')", '🔑') + /* KM_MENU15_V1 */
        /* KM_ARCHIVE_HUB_V1: Տեղեկություն + Գործողությունների մատյան moved to the Արխիվ hub */
        card('Կարգավորումներ', 'kmOpenSettings()', '⚙') +
        /* KM_BACKUP_TO_ARCHIVE_V1: UserData պահուստ moved to the Արխիվ hub */
        card('Անվտանգություն', 'kmOpenSecuritySettings()', '🔒') +
        card('Օգնություն', 'kmShowShortcuts()', '❓');
    }
    return '<h3 class="kmLawsHubTitle" style="margin-top:0">Համակարգի կարգավորումներ</h3>' +
      '<p class="kmLawsHubLead">Ցանց, ֆայլեր' + (admin ? ', արտոնագիր և անվտանգություն' : '') + '։</p>' + /* KM_MENU15_V1 */
      '<div class="kmLawsGrid" data-km-cards="1">' + grid + '</div>';
  };

  window.kmSysSettingsPage = function () {
    window._kmSysSettingsSub = '';
    if (typeof page !== 'undefined') page = 'syssettings';
    window.page = 'syssettings';
    var host = document.getElementById('content');
    if (!host) return;
    var pt = document.getElementById('pageTitle');
    if (pt) {
      pt.textContent = typeof window.kmTranslateUI === 'function'
        ? window.kmTranslateUI('Համակարգի կարգավորումներ')
        : 'Համակարգի կարգավորումներ';
    }
    if (typeof kmSetActiveNav === 'function') {
      try { kmSetActiveNav(document.querySelector('.nav[data-page="syssettings"]')); } catch (eN) {}
    }
    host.innerHTML = '<div class="card" data-km-syssettings-hub="1">' + window.kmSysSettingsHubHtml() + '</div>';
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(host); } catch (eF) {}
    }
    if (typeof kmApplyLanguage === 'function') {
      try { kmApplyLanguage(); } catch (eL) {}
    }
  };

  window.kmSysSettingsOpen = function (section) {
    section = String(section || '');
    if (!section) {
      window.kmSysSettingsPage();
      return;
    }
    if (section === 'sysinfo' && typeof window.kmArchiveOpen === 'function') { window.kmArchiveOpen('sysinfo'); return; } /* KM_ARCHIVE_HUB_V1 */
    if (section === 'sysinfo' && !libIsAdmin()) {
      if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
      window.kmSysSettingsPage();
      return;
    }
    if (section === 'sysinfo' && typeof window.kmSysInfoPage !== 'function' && typeof window.kmLoadPageModules === 'function') {
      window._kmSysSettingsPending = 'sysinfo';
      window.kmLoadPageModules('sysinfo', function () { window.kmSysSettingsOpen('sysinfo'); });
      return;
    }
    window._kmSysSettingsSub = section;
    if (typeof page !== 'undefined') page = 'syssettings';
    window.page = 'syssettings';
    var host = document.getElementById('content');
    if (!host) return;
    if (typeof kmSetActiveNav === 'function') {
      try { kmSetActiveNav(document.querySelector('.nav[data-page="syssettings"]')); } catch (eN) {}
    }
    if (section === 'network') {
      if (typeof window.kmNetPage === 'function') window.kmNetPage(undefined, false, host);
      else host.innerHTML = '<div class="card"><p class="muted">Ցանցի բաժինը հասանելի չէ։</p></div>';
      return;
    }
    if (section === 'license') { /* KM_MENU15_V1 */
      if (!libIsAdmin()) {
        if (typeof toast === 'function') toast('Միայն ադմինիստրատոր', 'error');
        window.kmSysSettingsPage();
        return;
      }
      window.kmLibSection = 'license';
      libSection = 'license';
      if (typeof window.kmOpenLicensePage === 'function') {
        window.kmOpenLicensePage(host);
        if (typeof window.kmEnsurePageBack === 'function') {
          try { window.kmEnsurePageBack(host, { onclick: 'kmSysSettingsBack()' }); } catch (eB) {}
        }
      } else host.innerHTML = '<div class="card"><p class="muted">Արտոնագրի բաժինը հասանելի չէ։</p></div>';
      return;
    }
    if (section === 'sysinfo') {
      if (typeof window.kmSysInfoPage === 'function') window.kmSysInfoPage(host);
      else host.innerHTML = '<div class="card"><p class="muted">Տեղեկության բաժինը հասանելի չէ։</p></div>';
    }
  };

  window.kmOpenLibrarySection = function (section) {
    const sec = section || 'files';
    if (sec === 'syssettings' || sec === 'network' || sec === 'sysinfo' || sec === 'license') { /* KM_MENU15_V1 */
      window._kmSysSettingsPending = (sec === 'syssettings') ? '' : sec;
      if (typeof window.kmOpenPage === 'function') window.kmOpenPage('syssettings');
      return;
    }
    if (sec === 'reports') { /* KM_MENU15_V1 */
      if (typeof window.kmOpenPage === 'function') window.kmOpenPage('unitTools');
      return;
    }
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      if (!window.kmCanAccessPage('library', sec)) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        else if (typeof window.kmNotify === 'function') window.kmNotify('Այս բաժինը ձեզ թույլատրված չէ', 'warn');
        return;
      }
    }
    libSection = sec;
    window.kmLibSection = sec;
    const already = (typeof page !== 'undefined' && page === 'library') || window.page === 'library';
    if (typeof page !== 'undefined') page = 'library';
    window.page = 'library';
    if (already && document.getElementById('kmLibSections')) {
      if (typeof window.kmLibSetSection === 'function') window.kmLibSetSection(sec);
      return;
    }
    if (typeof window.libraryPage === 'function') {
      window.libraryPage(sec);
      return;
    }
    if (typeof window.kmOpenPage === 'function') window.kmOpenPage('library');
    else if (typeof render === 'function') render();
  };

  window.kmLibSearch = function (q) {
    libSearch = String(q || '').trim();
    libOffset = 0;
    refreshLibraryList();
  };

  window.kmLibPage = function (dir) {
    libOffset = Math.max(0, libOffset + dir * LIB_PAGE);
    refreshLibraryList();
  };

  window.kmLibFilterFolder = function (f) {
    libFolder = String(f || '').trim();
    libOffset = 0;
    refreshLibraryList();
  };

  window.kmLibUploadFolder = function () {
    if (typeof window.kmCanEdit === 'function' && !libCanEditSection(libSection)) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    if (window.kmNative && window.kmNative.library && window.kmNative.library.importFolder) {
      libApi('importFolder', libOrgScope()).then(async (r) => {
        if (r && r.canceled) return;
        if (typeof toast === 'function') {
          toast(`Պանակից ավելացվեց ${r.added || 0}, բաց թողնված ${r.skipped || 0}${r.limitReached ? ' (սահմանաչափ)' : ''}`);
        }
        if (r && r.added) logLibChange('add', 'Պանակ · ' + (r.added || 0) + ' ֆայլ');
        libOffset = 0;
        await refreshLibraryStats();
        await refreshLibraryList();
      }).catch((e) => alert(e.message || String(e)));
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.webkitdirectory = true;
    inp.accept = '.doc,.docx,.rtf,.odt,.xls,.xlsx,.xlsm,.csv,.ods,.pdf,.ppt,.pptx,.ppsx,.odp';
    inp.onchange = async () => {
      const files = [...(inp.files || [])];
      if (!files.length) return;
      let ok = 0;
      let fail = 0;
      for (const f of files) {
        try {
          const rel = f.webkitRelativePath || f.name;
          const parts = rel.replace(/\\/g, '/').split('/');
          parts.pop();
          const folder = parts.join('/');
          const bytes = new Uint8Array(await f.arrayBuffer());
          await libApi('add', Object.assign({ name: f.name, folder, bytes: [...bytes] }, libOrgScope()));
          logLibChange('add', f.name);
          ok++;
        } catch (e) {
          fail++;
        }
      }
      if (typeof toast === 'function') toast(`Պանակից ավելացվեց ${ok}, սխալ ${fail}`);
      libOffset = 0;
      await refreshLibraryStats();
      await refreshLibraryList();
    };
    inp.click();
  };

  window.kmLibUpload = function () {
    if (typeof window.kmCanEdit === 'function' && !libCanEditSection(libSection)) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.multiple = true;
    inp.accept = '.doc,.docx,.rtf,.odt,.xls,.xlsx,.xlsm,.csv,.ods,.pdf,.ppt,.pptx,.ppsx,.odp';
    inp.onchange = async () => {
      const files = [...(inp.files || [])];
      if (!files.length) return;
      let ok = 0;
      let fail = 0;
      for (const f of files) {
        try {
          const bytes = new Uint8Array(await f.arrayBuffer());
          await libApi('add', Object.assign({ name: f.name, bytes: [...bytes] }, libOrgScope()));
          logLibChange('add', f.name);
          ok++;
        } catch (e) {
          fail++;
          if (typeof toast === 'function') toast((f.name || 'ֆայլ') + ': ' + (e.message || e));
        }
      }
      if (typeof toast === 'function') toast(`Ավելացվեց ${ok}, սխալ ${fail}`);
      libOffset = 0;
      await refreshLibraryStats();
      await refreshLibraryList();
    };
    inp.click();
  };

  window.kmLibOpen = async function (id, type) {
    try {
      const r = await libApi('open', { id, type, inApp: true });
      if (!r || !r.ok) {
        if (typeof toast === 'function') toast((r && r.message) || 'Չբացվեց', 'error');
        return;
      }
      if (r.inApp && (r.html || r.base64 || r.docUrl || r.path)) {
        window.kmLawsShowDocViewer(r.name, r.mime || 'application/pdf', {
          html: r.html,
          base64: r.base64,
          docUrl: r.docUrl,
          path: r.path,
          openReq: { id: id, type: type || '', inApp: true }
        });
        return;
      }
      if (typeof toast === 'function') toast('Բացվեց արտաքին ծրագրով');
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  window.kmLibDelete = async function (id, type, fileName) {
    if (typeof window.kmCanEdit === 'function' && !libCanEditSection(libSection)) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    if (!confirm('Ջնջե՞լ ֆայլը ֆայլերի պահոցից')) return; /* KM_RENAME_LEFTOVERS_V1 */
    try {
      await libApi('remove', { id, type });
      try { if (typeof window.kmHelpBotInvalidateKnowledge === 'function') window.kmHelpBotInvalidateKnowledge('library_delete'); } catch (eInv) {}
      logLibChange('delete', fileName || id || 'ֆայլ');
      if (typeof toast === 'function') toast('Ջնջվեց');
      await refreshLibraryStats();
      await refreshLibraryList();
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  window.kmLibRemoveAll = async function () {
    if (typeof window.kmCanEdit === 'function' && !libCanEditSection(libSection)) {
      if (typeof toast === 'function') toast('Դիտորդի իրավունք', 'error');
      return;
    }
    let total = 0;
    try {
      const s = await libApi('stats', libOrgScope());
      total = Number(s.total) || 0;
    } catch (e) {
      alert(e.message || String(e));
      return;
    }
    if (!total) {
      if (typeof toast === 'function') toast('Ֆայլերի պահոցում ֆայլեր չկան'); /* KM_RENAME_LEFTOVERS_V1 */
      return;
    }
    if (!confirm(`Հեռացնե՞լ այս կորպուսի արխիվի ${total} ֆայլերը։\n\nԱյլ կորպուսների ֆայլերը չեն ջնջվի։`)) return;
    if (!confirm('Վերջնական հաստատում. Այս արխիվի Word, Excel, PDF և PowerPoint ֆայլերը կջնջվեն։')) return;
    try {
      if (!window.kmNative.library.removeAll) {
        throw new Error('Հեռացնել բոլորը հասանելի է միայն KM desktop-ի նոր տարբերակում');
      }
      const r = await libApi('removeAll', Object.assign({}, libOrgScope(), { adminToken: adminToken(), token: adminToken() }));
      libOffset = 0;
      libSearch = '';
      libFolder = '';
      logLibChange('delete', 'Բոլոր ֆայլերը · ' + (r.removed || 0));
      if (typeof toast === 'function') toast(`Հեռացվեց ${r.removed || 0} ֆայլ`);
      await refreshLibraryStats();
      await refreshLibraryList();
    } catch (e) {
      alert(e.message || String(e));
    }
  };

  window.kmLibRenderArchive = function (target) {
    const root = target || document.getElementById('kmLibSectionRoot');
    if (root) root.innerHTML = htmlArchiveSection();
    fillLibChangeArchive();
  };

  window.kmLawsOpenPdfTranslate = function () {
    window._kmLibStaySection = 'pdfTranslate';
    window.kmLibSection = 'pdfTranslate';
    if (typeof window.kmOpenPage === 'function') {
      window.kmOpenPage('library');
      return;
    }
    if (typeof window.kmLibSetSection === 'function') window.kmLibSetSection('pdfTranslate');
  };

  window.kmLawDocsPage = function () {
    if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
      if (!window.kmCanAccessPage('lawdocs')) {
        if (typeof toast === 'function') toast('Այս բաժինը ձեզ թույլատրված չէ', 'error');
        else if (typeof window.kmNotify === 'function') window.kmNotify('Այս բաժինը ձեզ թույլատրված չէ', 'warn');
        return;
      }
    }
    window._kmLawSubPage = '';
    window._kmLawSubBack = '';
    window._kmLawSubNavBack = '';
    injectLibCss();
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    window.kmLibSection = '';
    document.body.classList.remove('km-boot-idle');
    const host = document.getElementById('content') || content;
    if (host) content = host;
    const pt = document.getElementById('pageTitle');
    if (pt) {
      pt.textContent = typeof window.kmTranslateUI === 'function'
        ? window.kmTranslateUI('Իրավական անկյուն')
        : 'Իրավական անկյուն';
    }
    if (typeof window.kmSetActiveNav === 'function') {
      window.kmSetActiveNav(document.querySelector('.nav[data-page="lawdocs"]') || document.querySelector('.nav[data-page="codes"]'));
    }
    content.innerHTML = htmlLawDocsHub();
    if (typeof window.kmCloseFlyMenus === 'function') window.kmCloseFlyMenus();
    if (typeof window.kmEnsurePageBack === 'function') window.kmEnsurePageBack(content, { skip: true });
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(); } catch (eG) {}
    }
  };

  window.kmLawsConstitutionHub = function () {
    injectLibCss();
    if (typeof page !== 'undefined') page = 'lawdocs';
    window.page = 'lawdocs';
    window.kmLibSection = '';
    window._kmLawSubPage = 'constitution_hub';
    window._kmLawOpenSection = 'constitution_hub';
    document.body.classList.remove('km-boot-idle');
    const host = document.getElementById('content') || content;
    if (host) content = host;
    const pt = document.getElementById('pageTitle');
    if (pt) {
      pt.textContent = typeof window.kmTranslateUI === 'function'
        ? window.kmTranslateUI('ՀՀ Սահմանադրություն և օրենսգրքեր')
        : 'ՀՀ Սահմանադրություն և օրենսգրքեր';
    }
    if (typeof window.kmSetActiveNav === 'function') {
      window.kmSetActiveNav(document.querySelector('.nav[data-page="lawdocs"]') || document.querySelector('.nav[data-page="codes"]'));
    }
    content.innerHTML = htmlLawsSection();
    if (typeof window.kmCloseFlyMenus === 'function') window.kmCloseFlyMenus();
  };

  window.kmCodesPage = function () {
    window.kmLawDocsPage();
  };

  window.libraryPage = async function (section, opts) {
    opts = opts || {};
    if (section === 'laws') {
      if (typeof window.kmLawDocsPage === 'function') window.kmLawDocsPage();
      return;
    }
    injectLibCss();
    if (opts.hub || !section || section === 'hub') {
      section = '';
      window._kmLibStaySection = '';
    } else if (section === 'pdfTranslate' && window._kmLibStaySection !== 'pdfTranslate') {
      section = '';
    }
    if (section && section !== 'hub') {
      window.kmLibSetSection(section);
      return;
    }
    if (kmLibHubEmpty()) { toolsShowHub(); return; } /* KM_MENU_REORG_V1: Գրադարան has no cards left */
    libSection = '';
    window.kmLibSection = '';
    window._kmLibStaySection = '';
    if (!libSection) libTab = libTab || 'word';
    libOffset = 0;
    libSearch = '';
    libFolder = '';

    const libCards = LIB_SECTIONS.filter(function (s) {
      if (KM_ARCH_LIB[s.id]) return false; /* KM_ARCHIVE_HUB_V1: shown in the Արխիվ hub */
      if (KM_TOOLS_LIB[s.id]) return false; /* KM_MENU_REORG_V1: shown in the Աշխատանքային գործիքներ hub */
      if (s.superAdminOnly && !(typeof window.kmIsSuperAdmin === 'function' && window.kmIsSuperAdmin())) return false;
      if (s.adminOnly && !libIsAdmin()) return false;
      if (window.kmUserRole === 'editor' && Array.isArray(window.kmEditSections) && typeof window.kmCanAccessPage === 'function') {
        if (!window.kmCanAccessPage('library', s.id)) return false;
      }
      return true;
    }).map(function (s) {
      return '<button type="button" class="kmLawCard"' +
        (s.adminOnly ? ' data-admin-only="1"' : '') +
        ' onclick="kmLibSetSection(\'' + s.id + '\')">' +
        '<span class="kmLawCardText">' + esc(String(s.label || '')) + '</span>' +
        '<span class="kmLawCardIcon" aria-hidden="true" style="font-size:28px;line-height:1">' + (s.icon || '📁') + '</span></button>';
    }).join('');

    content.innerHTML = (typeof window.kmBackToolbar === 'function' ? window.kmBackToolbar('kmReportsBack()') : '') +
      '<div class="card" style="margin-bottom:0">' +
      '<h3 class="kmLawsHubTitle">Գրադարան</h3>' +
      '<p class="kmLawsHubLead">Ընտրեք բաժինը՝ մուտք գործելու համար։</p>' +
      '<div class="kmLawsGrid" id="kmLibSections" role="list">' + libCards + '</div>' +
    '</div>';

    updateSectionTabs();
    if (typeof window.kmApplyKmFontsCss === 'function') {
      window.kmApplyKmFontsCss().catch(function () {});
    }
    if (typeof window.kmApplyLanguage === 'function') window.kmApplyLanguage();
    if (typeof window.kmFilterGrantCards === 'function') {
      try { window.kmFilterGrantCards(); } catch (eG) {}
    }
  };

  if (typeof window.kmApplyKmFontsCss === 'function') {
    setTimeout(function () {
      window.kmApplyKmFontsCss().catch(function () {});
    }, 800);
  }
})();
