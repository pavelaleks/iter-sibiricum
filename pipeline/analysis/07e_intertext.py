"""07e. Интертекстуальная сеть: кто на кого ссылается (явные упоминания авторов) и кто у кого заимствует (общие 8-граммы).

Узлы — книги корпуса и внешние авторитеты (Pallas, Gmelin, Castrén, Middendorff…). Рёбра:
  cites   — книга → авторитет / другая книга корпуса (число упоминаний фамилии; самоупоминания исключены);
  reuse   — более поздняя книга → более ранняя (пары абзацев с ≥4 общими 8-граммами; тип: с указанием автора,
            общая цитата, кандидат в заимствование).
Метрики: входящая степень (кого цитируют чаще), PageRank по сети ссылок, «каналы» стереотипов — пары reuse,
где заимствованный абзац содержит дискурс из 07c.
"""
import pandas as pd, networkx as nx
from research_common import ROOT, RES, SITE, works, jdump, PERIOD_RU

W = works()
C = pd.read_csv(ROOT / 'analysis/results/citations.csv')
RP = pd.read_csv(ROOT / 'analysis/results/text_reuse_passages.csv')
DU = pd.read_csv(RES / 'discourse_units.csv').set_index('pid')
surn = {w: W.loc[w, 'author'].split(' (')[0].split()[-1] for w in W.index}
corpus_auth = {}
for w, s in surn.items(): corpus_auth.setdefault(s, []).append(w)

g = nx.DiGraph()
for w in W.index:
    g.add_node(w, kind='work', label=W.loc[w, 'label'], period=W.loc[w, 'period'], nat=W.loc[w, 'nat_group'], year=int(W.loc[w, 'edition_year']))
for r in C.itertuples():
    tgt = 'auth:' + r.cited
    if r.cited in corpus_auth:           # ссылка на автора, чья книга есть в корпусе — на самую раннюю его книгу до года ссылающейся
        cand = [w for w in corpus_auth[r.cited] if W.loc[w, 'edition_year'] <= W.loc[r.work_id, 'edition_year'] and w != r.work_id]
        if cand: tgt = min(cand, key=lambda w: W.loc[w, 'edition_year'])
    if tgt not in g: g.add_node(tgt, kind='authority', label=r.cited)
    if tgt == r.work_id: continue
    w0 = g[r.work_id][tgt]['weight'] if g.has_edge(r.work_id, tgt) else 0
    g.add_edge(r.work_id, tgt, weight=w0 + int(r.n), type='cites')
reuse_rows = []
for r in RP.itertuples():
    b, s = r.borrower, r.source
    kind = 'acknowledged' if r.acknowledged_in_paragraph else r.kind
    bp = r.pid_a if b == r.work_a else r.pid_b
    disc = [k for k in DU.columns if k != 'work_id' and bp in DU.index and DU.at[bp, k] == 1]
    reuse_rows.append(dict(borrower=b, source=s, kind=kind, pid=bp, shared_8grams=int(r.shared_8grams), discourses=';'.join(disc)))
R = pd.DataFrame(reuse_rows)
for (b, s), d in R.groupby(['borrower', 'source']):
    g.add_edge(b, s, type='reuse', passages=len(d), unacknowledged=int((d.kind == 'candidate_borrowing').sum()), weight=len(d))

ci = nx.DiGraph([(u, v, x) for u, v, x in g.edges(data=True) if x['type'] == 'cites'])
pr = nx.pagerank(ci, weight='weight') if ci.number_of_edges() else {}
nodes = [dict(id=n, **{k: v for k, v in x.items()}, cited_by=int(ci.in_degree(n, weight='weight')) if n in ci else 0, pagerank=round(pr.get(n, 0), 4)) for n, x in g.nodes(data=True)]
links = [dict(source=u, target=v, **x) for u, v, x in g.edges(data=True)]
jdump('intertext_network.json', dict(nodes=nodes, links=links, note='cites: явное упоминание фамилии; reuse: ≥4 общих 8-граммы в паре абзацев (только англ. тексты)'))
N = pd.DataFrame(nodes).sort_values('cited_by', ascending=False); N.to_csv(RES / 'intertext_nodes.csv', index=False)
R.to_csv(RES / 'reuse_with_discourse.csv', index=False)
print(N.head(15)[['id', 'label', 'kind', 'cited_by', 'pagerank']].to_string())
pairs = R.groupby(['borrower', 'source']).agg(passages=('pid', 'size'), unack=('kind', lambda s: (s == 'candidate_borrowing').sum()),
                                              with_discourse=('discourses', lambda s: (s.str.len() > 0).sum())).sort_values('unack', ascending=False)
pairs.to_csv(RES / 'reuse_pairs_summary.csv'); print(pairs.head(15).to_string())
print('reuse passages carrying a discourse:', (R.discourses.str.len() > 0).sum(), 'of', len(R))
