"""Build inert offline HTML, structured blocks and auditable ARLIS comparison records."""
import bisect, copy, datetime, hashlib, html as escape, json, pathlib, re, sys, urllib.parse
from lxml import html, etree
ROOT=pathlib.Path(__file__).resolve().parents[1];DATA=ROOT/'app/data'
CACHE=pathlib.Path(sys.argv[1]).resolve();OUT=DATA/'legal-source-records';OUT.mkdir(exist_ok=True)
ASSETS=DATA/'legal-reader/assets';ASSETS.mkdir(parents=True,exist_ok=True)
ALLOWED=set('p div section article span b strong em i u s strike del ins sup sub br hr table thead tbody tfoot tr td th caption colgroup col ul ol li dl dt dd h1 h2 h3 h4 h5 h6 a img font center pre blockquote'.split())
DANGEROUS=set('script style iframe object embed form input button select textarea link meta base svg math noscript'.split())
CSS=set('text-align text-indent font-weight font-style text-decoration vertical-align border border-top border-bottom border-left border-right border-collapse border-spacing padding padding-left padding-right padding-top padding-bottom margin margin-left margin-right margin-top margin-bottom width min-width max-width height line-height column-count column-gap white-space'.split())
KEYWORDS=['ԵՆԹԱԲԱԺԻՆ','ԲԱԺԻՆ','ԳԼՈՒԽ','ՀՈԴՎԱԾ','ՀԱՎԵԼՎԱԾ','ԱՂՅՈՒՍԱԿ','ՄԱՍ']
LEVELS={'ՄԱՍ':1,'ԲԱԺԻՆ':2,'ԵՆԹԱԲԱԺԻՆ':3,'ԳԼՈՒԽ':4,'ՀՈԴՎԱԾ':5,'ՀԱՎԵԼՎԱԾ':1,'ԱՂՅՈՒՍԱԿ':5}
def clean_label(t):
 t=' '.join(t.replace('⚖','').replace('\xa0',' ').split())
 for k in KEYWORDS:t=re.sub('^'+r'\s*'.join(k),k,t,flags=re.I)
 return t
PAT=re.compile(r'^(ԵՆԹԱԲԱԺԻՆ|ԲԱԺԻՆ|ԳԼՈՒԽ|ՀՈԴՎԱԾ|ՀԱՎԵԼՎԱԾ|ԱՂՅՈՒՍԱԿ|ՄԱՍ)(?=\s|[0-9№]|$)\s*(?:(?:N|№|ՀԱՄԱՐ)\s*)?([0-9]+(?:[.․\-–][0-9]+)*|[IVXLCDM]+|[Ա-Ֆ]+)?',re.I)
def classify(t,el=None):
 label=clean_label(t);m=PAT.match(label) if len(label)<600 else None
 if m and (m[2] or m[1].upper()=='ՀԱՎԵԼՎԱԾ'):
  return LEVELS[m[1].upper()],label
 if el is not None and len(label)<220 and (el.get('align')=='center' or el.xpath('.//strong|.//b')):
  if re.match(r'^[IVXLCDM]+[.․)]\s+\S',label):return 4,label
  if label==label.upper() and re.match(r'^(?:[Ա-Ֆ]|[0-9]+)[.․)]\s*[^0-9\s]',label):return 4,label
 return 0,label

def sanitize(body,actid,images):
 for el in list(body.iter()):
  if not isinstance(el.tag,str):
   if el.getparent() is not None:el.drop_tree()
   continue
  tag=el.tag.lower()
  if tag in DANGEROUS:el.drop_tree();continue
  if tag not in ALLOWED:
   if el is not body:el.drop_tag()
   continue
  attrs=dict(el.attrib);el.attrib.clear()
  for k in ['colspan','rowspan','span','start','value']:
   if k in attrs and re.fullmatch(r'\d{1,4}',attrs[k]):el.set(k,attrs[k])
  for k in ['align','valign']:
   if attrs.get(k,'').lower() in ['left','right','center','justify','top','middle','bottom']:el.set(k,attrs[k].lower())
  if tag in ['table','td','th','col','img'] and re.fullmatch(r'\d{1,4}%?',attrs.get('width','')):el.set('width',attrs['width'])
  if tag=='table':
   for k in ['border','cellpadding','cellspacing']:
    if re.fullmatch(r'\d{1,2}',attrs.get(k,'')):el.set(k,attrs[k])
  styles=[]
  for decl in attrs.get('style','').split(';'):
   if ':' not in decl:continue
   key,value=decl.split(':',1);key=key.strip().lower();value=value.strip()
   if key in CSS and re.fullmatch(r'[\w\s.%#(),\-]+',value,re.UNICODE) and not re.search('url|expression|javascript|behavior|import',value,re.I):styles.append(key+':'+value)
  if styles:el.set('style',';'.join(styles))
  if tag=='a':
   href=urllib.parse.urljoin('https://www.arlis.am',attrs.get('href',''))
   if urllib.parse.urlparse(href).scheme in ['https','http']:
    el.set('href',href);el.set('target','_blank');el.set('rel','noopener noreferrer')
  if tag=='img':
   src=urllib.parse.urljoin('https://www.arlis.am',attrs.get('src',''))
   el.set('alt',attrs.get('alt','Պաշտոնական ակտի պատկեր'))
   if urllib.parse.urlparse(src).hostname in ['arlis.am','www.arlis.am']:
    filename=hashlib.sha256(src.encode()).hexdigest()[:24]+'.img';images[src]=filename
    el.set('src','data/legal-reader/assets/'+filename)
   el.set('loading','lazy')
  if tag=='font':el.tag='span'

def children_flat(el):
 if el.tag in ['div','section','article'] or (el.tag in ['span','font','strong','b','em'] and len(el.text_content())>12000 and el.xpath('.//p|.//table')):
  if el.text and el.text.strip():
   p=html.Element('p');p.text=el.text;yield p
  for child in list(el):
   tail=child.tail;child.tail=None
   for part in children_flat(child):
    if el.attrib:
     wrapper=html.Element('div');wrapper.attrib.update(el.attrib);wrapper.append(part);yield wrapper
    else:yield part
   if tail and tail.strip():p=html.Element('p');p.text=tail;yield p
 else:yield el

def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def compare_text(s):return re.sub(r'\s+','',clean_label(s)).replace('&#9878','').replace('⚖','')

def prepare(act,old,images):
 result=json.loads((CACHE/(act+'.json')).read_text())
 if not result.get('ok'):return None,result
 raw=(CACHE/(act+'.html')).read_bytes();doc=html.fromstring(raw)
 body=doc.get_element_by_id('act_body');original_body=etree.tostring(body,encoding='unicode',method='html')
 meta={};fields={'Համար':'number','Տիպ':'type','Փաստաթղթի տեսակ':'documentType','Կարգավիճակ':'status','Սկզբնաղբյուր':'gazette','Ընդունող մարմին':'adoptedBy','Ընդունման ամսաթիվ':'adoptedDate','Ստորագրման ամսաթիվ':'signedDate','Ուժի մեջ մտնելու ամսաթիվ':'inForceDate'}
 for row in doc.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," act-info__item ")]'):
  labels=row.xpath('./*[contains(@class,"act-info__label")]');values=row.xpath('./*[contains(@class,"act-info__value")]')
  if labels and values:
   k=' '.join(labels[0].text_content().split());v=' '.join(values[0].text_content().split())
   if k in fields:meta[fields[k]]=v
 resolved=act
 for a in doc.xpath('//a[contains(@href,"/print/act")]'):
  m=re.search(r'/acts/(\d+)/',a.get('href',''))
  if m:resolved=m[1];break
 original_tables=len(body.xpath('.//table'));original_cells=len(body.xpath('.//td|.//th'))
 sanitize(body,act,images)
 preserved_text=body.text_content()
 source_html=etree.tostring(body,encoding='unicode',method='html',with_tail=False)
 nodes=list(children_flat(body));blocks=[];outline=[];pos=0
 for i,el in enumerate(nodes):
  text=el.text_content()
  if not text.strip() and not el.xpath('.//img|.//table') and el.tag not in ['img','hr','table']:continue
  # IDs are internal anchors, never source IDs or executable handlers.
  el.set('id','kmSourceBlock'+str(len(blocks)))
  lev,label=classify(text,el)
  if lev:el.set('class','kmLegalHeading kmLegalLevel'+str(lev))
  block={'start':pos,'end':pos+len(text),'level':lev,'html':etree.tostring(el,encoding='unicode',method='html',with_tail=False)}
  if lev:outline.append({'pos':pos,'label':label[:240],'level':lev,'chapter':lev<5})
  # Nested article headings in layout tables and numbered appendices remain selectable.
  if not lev:
   offset=0
   for child in el.xpath('.//p|.//h1|.//h2|.//h3|.//h4'):
    ct=child.text_content();at=text.find(ct,offset);cl,lab=classify(ct,child)
    if at>=0:
     offset=at+len(ct)
     if cl:outline.append({'pos':pos+at,'label':lab[:240],'level':cl,'chapter':cl<5})
  blocks.append(block);pos+=len(text)+2
 text='\n\n'.join(html.fromstring(b['html']).text_content() for b in blocks)
 # text offsets derive from the sanitized DOM, so markup never corrupts search positions.
 if blocks:assert blocks[-1]['end']==len(text),(act,'offset mismatch')
 starts=[0];page_start=0
 for i,b in enumerate(blocks):
  end=b['end']
  if b['level'] and i+1<len(blocks):end=blocks[i+1]['end']
  if end-page_start>9000 and b['start']>page_start:starts.append(b['start']);page_start=b['start']
 for i,o in enumerate(outline):
  if re.fullmatch(r'(?:ՄԱՍ|ԲԱԺԻՆ|ԵՆԹԱԲԱԺԻՆ|ԳԼՈՒԽ|ՀՈԴՎԱԾ|ՀԱՎԵԼՎԱԾ|ԱՂՅՈՒՍԱԿ)\s*(?:N\s*)?[\w.․–-]+[.:]?\s*',o['label'],re.I):
   bidx=next((j for j,b in enumerate(blocks) if b['start']==o['pos']),None)
   if bidx is not None and bidx+1<len(blocks):
    nxt=blocks[bidx+1];label=clean_label(text[nxt['start']:nxt['end']])
    if not nxt['level'] and label and len(label)<260 and not re.match(r'^\d+[.)]',label):o['label']+=' '+label
 assert re.sub(r'\s+','',preserved_text)==re.sub(r'\s+','',text),(act,'Source text lost')
 if not outline:
  for b in blocks:
   label=clean_label(text[b['start']:b['end']])
   if re.match(r'^\d+[.․](?!\d)\s*\S',label):
    outline.append({'pos':b['start'],'label':label[:200],'level':5,'chapter':False})
 before=compare_text(old.get('text',''));after=compare_text(text)
 verification={'checkedAt':result['checkedAt'],'sourceUrl':result['url'],'resolvedActId':resolved,'sourceBodySha256':sha(original_body),'previousTextSha256':sha(old.get('text','')),'textSha256':sha(text),'comparison':'same_normalized_text' if before==after else 'refreshed_from_official_body','scope':'Published ARLIS latest HTML body; linked files and later legal changes are not implied verified','sourceStatus':meta.get('status',''),'tableCount':original_tables,'cellCount':original_cells}
 assert sum(len(html.fromstring(b['html']).xpath('descendant-or-self::table')) for b in blocks)==original_tables
 assert sum(len(html.fromstring(b['html']).xpath('descendant-or-self::td|descendant-or-self::th')) for b in blocks)==original_cells
 edition=re.search(r'\((\d\d\.\d\d\.\d{4})\s*-',meta.get('status',''))
 astral=[i for i,ch in enumerate(text) if ord(ch)>0xffff]
 if astral:
  def u16(i):return i+bisect.bisect_left(astral,i)
  starts=[u16(i) for i in starts]
  for b in blocks:b['start']=u16(b['start']);b['end']=u16(b['end'])
  for o in outline:o['pos']=u16(o['pos'])
 rec={**old,'actId':act,'text':text,'starts':starts,'blocks':[{k:v for k,v in b.items() if k!='html'} for b in blocks],'richBlocks':blocks,'outline':outline,'meta':meta,'source':result['url'],'importedAt':result['checkedAt'],'verification':verification,'editionDate':edition[1] if edition else '', 'docNumber':meta.get('number',''),'richFormatVersion':1,'sourceHtml':source_html}
 return rec,verification

def main():
 catalog=json.loads((DATA/'km_arlis_military_catalog.json').read_text());images={};results=[]
 for key,old in catalog['embeddedLegalTexts'].items():
  if not key.startswith('act/'):continue
  act=key[4:]
  if not (CACHE/(act+'.json')).exists():continue
  try:
   rec,v=prepare(act,old,images)
   if rec:(OUT/(act+'.json')).write_text(json.dumps(rec,ensure_ascii=False,separators=(',',':')))
   results.append({'actId':act,'ok':bool(rec),**v})
  except Exception as e:results.append({'actId':act,'ok':False,'error':str(e)})
 (CACHE/'image-jobs.json').write_text(json.dumps(images,ensure_ascii=False))
 report={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'records':results,'unresolved':[{'section':'statute_drill','reason':'No authenticated full official source obtained; partial local source retained'}]}
 (DATA/'LEGAL_SOURCE_AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps({'processed':len(results),'ok':sum(x['ok'] for x in results),'failed':[x for x in results if not x['ok']][:10],'images':len(images)},ensure_ascii=False))
if __name__=='__main__':main()
