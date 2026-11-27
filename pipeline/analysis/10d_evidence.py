"""Указатель свидетельств: для каждого народа (группы) и каждого места — все абзацы корпуса, где они упомянуты.
site/data/evidence/g/<group>.json, site/data/evidence/p/<place>.json:
{"r": [[книга, № абзаца, о Сибири 0/1, фрагмент, [[нач, кон], …] в фрагменте, [другие сущности абзаца]], …]}.
Фрагмент — до ~360 знаков вокруг первого упоминания, по границам слов; в строке группы — места абзаца, в строке места — группы."""
import json, pathlib, collections, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT.parent / 'site'
TX = SITE / 'texts'; GEO = SITE / 'data' / 'geo'; OUT = SITE / 'data' / 'evidence'
(OUT / 'g').mkdir(parents=True, exist_ok=True); (OUT / 'p').mkdir(parents=True, exist_ok=True)
G = collections.defaultdict(list); P = collections.defaultdict(list)
def snip(text, spans):
    a0 = min(a for a, b in spans); s = max(0, a0 - 150); e = min(len(text), max(s + 360, a0 + 210))
    if s > 0: s = text.find(' ', s) + 1 or s
    if e < len(text): e = text.rfind(' ', s, e) if text.rfind(' ', s, e) > a0 else e
    rel = [[a - s, b - s] for a, b in spans if a >= s and b <= e]
    return ('…' if s > 0 else '') + text[s:e] + ('…' if e < len(text) else ''), [[a + (1 if s > 0 else 0), b + (1 if s > 0 else 0)] for a, b in rel]
for f in sorted(TX.glob('*.json')):
    d = json.load(open(f)); w = d['id']
    pm = collections.defaultdict(list)
    gf = GEO / f'{w}.json'
    if gf.exists():
        for n, pl, a, b in json.load(open(gf))['m']: pm[n].append((a, b, pl))
    for p in d['p']:
        n = int(p[0]); text = p[4]; sib = 1 if str(p[3]) in ('1', 'True', 'true') else 0
        gm = collections.defaultdict(list)
        for a, b, g in (p[5] or []): gm[g].append((a, b))
        pls = collections.defaultdict(list)
        for a, b, pl in pm.get(n, []): pls[pl].append((a, b))
        for g, sp in gm.items():
            s, rel = snip(text, sp); G[g].append([w, n, sib, s, rel, list(pls)[:10]])
        for pl, sp in pls.items():
            s, rel = snip(text, sp); P[pl].append([w, n, sib, s, rel, list(gm)[:10]])
for k, rows in G.items(): json.dump({'r': rows}, open(OUT / 'g' / f'{k}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for k, rows in P.items(): json.dump({'r': rows}, open(OUT / 'p' / f'{k}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(G), 'групп,', sum(map(len, G.values())), 'строк;', len(P), 'мест,', sum(map(len, P.values())), 'строк')
