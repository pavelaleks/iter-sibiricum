"""07b. Межэтнические отношения v2: диады групп, типы отношений, периоды, наблюдатели, сети по периодам.

Единица — предложение в абзаце о Сибири, где названы ≥2 группы (data/relations.csv, 04_annotate).
Тип отношения — правило по лексике предложения (trade_exchange, conflict, …); без маркера — co_mention.
Нормировка: на 100 тыс. слов текста о Сибири в соответствующем периоде / группе наблюдателей.
ДИ долей — кластерный бутстреп по книгам.
"""
import itertools, collections
import numpy as np, pandas as pd, networkx as nx
from networkx.algorithms.community import louvain_communities
from research_common import ROOT, RES, SITE, works, groups, jdump, cluster_boot, PERIOD_RU, NAT_RU

W = works(); G = groups()
R = pd.read_csv(ROOT / 'data/relations.csv')
R = R[R.in_siberia.astype(str) == 'True'].copy()
R['period'] = R.work_id.map(W.period); R['nat'] = R.work_id.map(W.nat_group)
R['dyad'] = R.apply(lambda r: ' — '.join(sorted([G.loc[r.group_a, 'name_ru'], G.loc[r.group_b, 'name_ru']])), axis=1)
R['cat_a'] = R.group_a.map(G.category); R['cat_b'] = R.group_b.map(G.category)
R['typed'] = (R.rel_type != 'co_mention').astype(int)
R['kind'] = np.where((R.cat_a == 'indigenous') & (R.cat_b == 'indigenous'), 'коренные ↔ коренные',
            np.where(((R.cat_a == 'indigenous') & (R.cat_b.isin(['settler', 'social']))) | ((R.cat_b == 'indigenous') & (R.cat_a.isin(['settler', 'social']))),
                     'коренные ↔ русские/пришлые', 'прочие'))
P = pd.read_json(ROOT / 'corpus/paragraphs.jsonl', lines=True)
P = P[(P.type == 'text') & P.in_siberia]
P['period'] = P.work_id.map(W.period); P['nat'] = P.work_id.map(W.nat_group)
words_period = P.groupby('period').words.sum(); words_nat = P.groupby('nat').words.sum()
REL_RU = {'trade_exchange': 'торговля и обмен', 'exploitation': 'эксплуатация, обман, долги', 'conflict': 'конфликт, насилие',
          'intermarriage_mixing': 'браки и смешение', 'assimilation': 'ассимиляция, обрусение', 'administration_tribute': 'власть, ясак, подати',
          'labour_service': 'наём и служба', 'religious_mission': 'миссия, крещение', 'coexistence_neighbourhood': 'соседство', 'co_mention': 'совместное упоминание'}

# 1. Диады
dy = R.groupby('dyad').agg(sentences=('pid', 'size'), works=('work_id', 'nunique'), typed=('typed', 'sum'), kind=('kind', 'first')).sort_values('sentences', ascending=False)
types = R[R.typed == 1].pivot_table(index='dyad', columns='rel_type', values='pid', aggfunc='size', fill_value=0)
dy = dy.join(types).fillna(0); dy.to_csv(RES / 'dyads.csv')
top_dyads = dy[dy.works >= 5].head(40)

# 2. Профиль типов отношений по периодам (только «коренные ↔ русские/пришлые», типизированные)
K = R[(R.kind == 'коренные ↔ русские/пришлые') & (R.typed == 1)]
prof = []
for per, d in K.groupby('period'):
    for t in REL_RU:
        if t == 'co_mention': continue
        d2 = d.assign(v=(d.rel_type == t).astype(int)); p, lo, hi = cluster_boot(d2, 'v')
        prof.append(dict(period=per, period_ru=PERIOD_RU[per], rel_type=t, rel_ru=REL_RU[t], n_typed=len(d), share=round(p, 3), lo=round(lo, 3), hi=round(hi, 3)))
prof = pd.DataFrame(prof); prof.to_csv(RES / 'relation_profile_by_period.csv', index=False)
profn = []
for nat, d in K.groupby('nat'):
    if d.work_id.nunique() < 2: continue
    for t in REL_RU:
        if t == 'co_mention': continue
        d2 = d.assign(v=(d.rel_type == t).astype(int)); p, lo, hi = cluster_boot(d2, 'v')
        profn.append(dict(nat=nat, nat_ru=NAT_RU.get(nat, nat), works=d.work_id.nunique(), rel_type=t, rel_ru=REL_RU[t], n_typed=len(d), share=round(p, 3), lo=round(lo, 3), hi=round(hi, 3)))
profn = pd.DataFrame(profn); profn.to_csv(RES / 'relation_profile_by_nat.csv', index=False)

# 3. Интенсивность: упоминаний отношений на 100 тыс. слов о Сибири
inten = (R.groupby(['period', 'kind']).size() / R.period.map(words_period).groupby([R.period, R.kind]).first() * 1e5).round(1).rename('per100k').reset_index()
inten.to_csv(RES / 'relation_intensity_by_period.csv', index=False)

# 4. Сети по периодам
nets = {}
for per, d in R.groupby('period'):
    g = nx.Graph()
    for (a, b), n in d.groupby(['group_a', 'group_b']).size().items():
        if a == b: continue
        w = g[a][b]['weight'] + n if g.has_edge(a, b) else n
        g.add_edge(a, b, weight=w)
    g.remove_edges_from([(a, b) for a, b, x in g.edges(data=True) if x['weight'] < 2])
    g.remove_nodes_from(list(nx.isolates(g)))
    if g.number_of_nodes() < 3: continue
    bet = nx.betweenness_centrality(g, weight=lambda u, v, x: 1 / x['weight'])
    comm = louvain_communities(g, weight='weight', seed=1); cid = {n: i for i, c in enumerate(comm) for n in c}
    nets[per] = dict(period=per, period_ru=PERIOD_RU[per], works=int(d.work_id.nunique()),
                     nodes=[dict(id=n, name=G.loc[n, 'name_ru'], category=G.loc[n, 'category'], betweenness=round(bet[n], 3), community=cid[n],
                                 degree=int(g.degree(n, weight='weight'))) for n in g.nodes],
                     links=[dict(source=a, target=b, weight=int(x['weight'])) for a, b, x in g.edges(data=True)])
jdump('relation_networks_by_period.json', nets)
cent = pd.DataFrame([dict(period=k, group=n['name'], betweenness=n['betweenness'], degree=n['degree']) for k, v in nets.items() for n in v['nodes']])
cent.to_csv(RES / 'centrality_by_period.csv', index=False)

# 5. Выборка для ручной проверки типизации
R[R.typed == 1].sample(60, random_state=11)[['pid', 'group_a', 'group_b', 'rel_type', 'sentence']].to_csv(ROOT / 'validation/relations_sample_v2.csv', index=False)

jdump('dyads.json', top_dyads.reset_index().to_dict(orient='records'))
jdump('relation_profile.json', dict(by_period=prof.to_dict(orient='records'), by_nat=profn.to_dict(orient='records'), labels=REL_RU))
print(top_dyads.head(15)[['sentences', 'works', 'typed', 'kind']].to_string())
print(prof.pivot(index='rel_ru', columns='period', values='share').to_string())
print(cent.sort_values(['period', 'betweenness'], ascending=[True, False]).groupby('period').head(4).to_string())
print(inten.to_string())
