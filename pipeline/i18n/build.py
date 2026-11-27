import json,re
D=json.load(open('auto.json'))
def idx(tsv, keys):
    for line in open(tsv,encoding='utf-8'):
        line=line.rstrip('\n')
        if not line: continue
        i,en=line.split('\t',1); D[keys[int(i)]]=en
need=json.load(open('need.json'))
idx('t1.tsv',need)
idx('t2.tsv',json.load(open('need_rest.json')))
for line in open('t3.tsv',encoding='utf-8'):
    line=line.rstrip('\n')
    if line: k,v=line.split('\t',1); D[k]=v
idx('t4.tsv',json.load(open('places_manual.json')))
S=json.load(open('summ.json'))
for line in open('t5.tsv',encoding='utf-8'):
    line=line.rstrip('\n')
    if line: i,v=line.split('\t',1); D[re.sub(r'\s+',' ',S[int(i)][1]).strip()]=v
import glob
for f in sorted(glob.glob('t[6-9]*.tsv'))+sorted(glob.glob('t1[0-9]*.tsv')):
    for line in open(f,encoding='utf-8'):
        line=line.rstrip('\n')
        if line and '\t' in line: k,v=line.split('\t',1); D[k]=v
# ключи с числами → шаблоны
NUM=re.compile(r'\d+(?:[   ,.]\d+)*')
from typo import typo
D2={}
for k,v in D.items():
    D2[k]=typo(v)
json.dump(D2,open('dict.json','w'),ensure_ascii=False)
open('/home/claude/gh-repo/assets/i18n-en.js','w').write('window.I18N_EN = '+json.dumps(D2,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(D2))
