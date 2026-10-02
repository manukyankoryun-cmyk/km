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
