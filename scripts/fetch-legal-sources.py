"""Fetch public ARLIS latest pages; checkpoint every result, retain failures explicitly."""
import concurrent.futures, datetime, json, pathlib, time, urllib.request, urllib.error, urllib.parse, sys
from lxml import html
root=pathlib.Path(__file__).resolve().parents[1]
cache=pathlib.Path(sys.argv[1]).resolve();cache.mkdir(parents=True,exist_ok=True)
c=json.loads((root/'app/data/km_arlis_military_catalog.json').read_text())
ids=[k.split('/')[1] for k in c['embeddedLegalTexts'] if k.startswith('act/')]
priority=['143723','105967','20','29','39','41','49','51','21354','82035','87705','109017','159647','119531','120057','153080','154763','164938','225574','112468','200323','225571']
ids=list(dict.fromkeys(priority+ids))
def fetch(act):
 dst=cache/(act+'.html');status=cache/(act+'.json')
 if dst.exists() and status.exists():
  old=json.loads(status.read_text())
  if old.get('ok'):return old
 url='https://www.arlis.am/hy/acts/'+act+'/latest';result={'actId':act,'url':url}
 for attempt in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (KM offline legal source verification)','Accept-Language':'hy'})
   with urllib.request.urlopen(req,timeout=35) as r:
    if urllib.parse.urlparse(r.url).hostname not in ['arlis.am','www.arlis.am']:raise ValueError('Unexpected source host')
    raw=r.read(20*1024*1024+1)
    if len(raw)>20*1024*1024:raise ValueError('Document exceeds bound')
   doc=html.fromstring(raw)
   body=doc.xpath('//*[@id="act_body"]')
   if not body or len(body[0].text_content().strip())<80:raise ValueError('Missing official act body')
   dst.write_bytes(raw);result.update(ok=True,checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),bytes=len(raw));break
  except Exception as e:
   result.update(ok=False,error=str(e),checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
   if isinstance(e,urllib.error.HTTPError) and e.code not in [429,500,502,503,504]:break
   time.sleep(3*(attempt+1))
 status.write_text(json.dumps(result,ensure_ascii=False));time.sleep(0.8);return result
out=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for r in pool.map(fetch,ids):
  out.append(r)
  if len(out)%25==0:print(json.dumps({'done':len(out),'total':len(ids),'failed':sum(not x['ok'] for x in out)}),flush=True)
(cache/'results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({'done':len(out),'failed':sum(not x['ok'] for x in out)}),flush=True)
