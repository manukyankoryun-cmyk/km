"""Verify the offline rich corpus and structural recognition against source DOMs."""
import importlib.util,json,pathlib,sys,re
from lxml import html
root=pathlib.Path(__file__).resolve().parents[1]
sys.argv=['test',str(root/'app/data')]
spec=importlib.util.spec_from_file_location('prep',root/'scripts/prepare-legal-sources.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
for text,level in [('Գ Լ ՈՒ Խ 12',4),('Հավելված N 1',1),('Հոդված 40.2.',5),('Ենթաբաժին IV',3),('ՄԱՍ ԱՌԱՋԻՆ',1),('ԱՂՅՈՒՍԱԿ 2',5)]:
 assert m.classify(text)[0]==level,text
assert m.classify('Հավելվածի փոփոխությունները')[0]==0
node=html.fromstring('<p align="center"><strong>Ա. ԸՆԴՀԱՆՈՒՐ ԴՐՈՒՅԹՆԵՐ</strong></p>');assert m.classify(node.text_content(),node)[0]==4
count=tables=cells=0
assets=root/'app/data/legal-reader/assets'
for p in (root/'app/data/legal-source-records').glob('*.json'):
 d=json.loads(p.read_text());src=html.fromstring(d['sourceHtml']);v=d['verification']
 assert len(src.xpath('.//table'))==v['tableCount'],p
 assert len(src.xpath('.//td|.//th'))==v['cellCount'],p
 assert not src.xpath('.//script|.//style|.//iframe|.//object|.//embed|.//form'),p
 for el in src.iter():
  assert not any(k.lower().startswith('on') for k in el.attrib),p
  if el.tag=='img' and el.get('src'):assert (assets/pathlib.Path(el.get('src')).name).is_file(),el.get('src')
 for b in d['richBlocks']:
  fragment=html.fromstring(b['html']);length=len(fragment.text_content().encode('utf-16-le'))//2
  assert b['end']-b['start']==length,p
 count+=1;tables+=v['tableCount'];cells+=v['cellCount']
assert count==1166
print(json.dumps({'passed':True,'officialDocuments':count,'tables':tables,'cells':cells}))
