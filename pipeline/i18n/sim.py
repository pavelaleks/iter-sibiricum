import json,re,sys
NUM=re.compile(r'\d+(?:[   ,.]\d+)*')
SPLIT=re.compile(r'( · | → | — | – |, |; |: | / | \| |\(|\)|«|»)')
EDGE=re.compile(r'^([\s·•→—–:;,.(«»"]*)(.*?)([\s·•→—–:;,.)«»"]*)$',re.S)
CY=re.compile('[А-Яа-яЁё]')
def load(D):
    T={k:v for k,v in D.items() if '#' in k}; return T
def one(D,T,k):
    if k in D: return D[k]
    nums=NUM.findall(k)
    if nums:
        tk=NUM.sub('#',k)
        if tk in T: return T[tk]
    return None
def core(D,T,x):
    t=one(D,T,x)
    if t is not None: return t
    m=EDGE.match(x)
    if m and m.group(2)!=x:
        t=one(D,T,m.group(2))
        if t is not None: return t
    return None
def tr(D,T,s,miss):
    k0=re.sub(r'\s+',' ',s).strip()
    if not k0 or not CY.search(k0): return True
    if one(D,T,k0) is not None: return True
    m=EDGE.match(k0); k=m.group(2) if m else k0
    if one(D,T,k) is not None: return True
    if len(k)>=50 and ' · ' not in k and ' → ' not in k:
        miss.add(NUM.sub('#',k)); return False
    parts=SPLIT.split(k); bad=[]
    for p in parts:
        p=p.strip()
        if not p or not CY.search(p) or SPLIT.fullmatch(' '+p+' ') : continue
        if core(D,T,p) is None: bad.append(p)
    if bad and len(parts)>1:
        for b in bad: miss.add(NUM.sub('#',b))
    elif bad or len(parts)==1: miss.add(NUM.sub('#',k))
    return not bad
if __name__=='__main__':
    D=json.load(open(sys.argv[1])); T=load(D)
    src=json.load(open(sys.argv[2])); miss=set()
    for s in src: tr(D,T,s,miss)
    miss=sorted(miss); print(len(miss),sum(map(len,miss)))
    json.dump(miss,open(sys.argv[3],'w'),ensure_ascii=False,indent=0)
