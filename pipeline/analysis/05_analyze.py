"""Этап 5: аналитика и экспорт данных для сайта (site_data/*.json, analysis/results/*.csv)."""
import json, csv, re, math, pathlib, itertools
from collections import Counter, defaultdict
import pandas as pd, numpy as np, networkx as nx

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT, RES = ROOT/'site_data', ROOT/'analysis/results'
OUT.mkdir(exist_ok=True); RES.mkdir(exist_ok=True)
def jdump(name, obj): json.dump(obj, open(OUT/name, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, 'item') else str(o))
def wilson(k, n, z=1.96):
    if n == 0: return (None, None)
    p = k/n; d = 1 + z*z/n; c = p + z*z/(2*n); r = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))
    return (round((c-r)/d, 3), round((c+r)/d, 3))

W = pd.read_csv(ROOT/'data/works.csv'); G = pd.read_csv(ROOT/'data/groups.csv')
P = pd.read_json(ROOT/'corpus/paragraphs.jsonl', lines=True)
M = pd.read_csv(ROOT/'data/mentions.csv'); PL = pd.read_csv(ROOT/'data/places.csv')
PM = pd.read_csv(ROOT/'data/place_mentions.csv'); IT = pd.read_csv(ROOT/'data/itineraries.csv')
R = pd.read_csv(ROOT/'data/relations.csv'); E = pd.read_csv(ROOT/'data/expert_annotations.csv')
U = pd.read_csv(ROOT/'data/annotations.csv')
gname = dict(zip(G.group_id, G.name_ru)); gcat = dict(zip(G.group_id, G.category))
W['decade'] = (W.journey_start.fillna(W.edition_year) // 10 * 10).astype(int)
wmeta = W.set_index('work_id')

# ---------- 1. корпус ----------
txt = P[P.type.isin(['text', 'note'])]
sib_words = txt[txt.in_siberia].groupby('work_id').words.sum()
all_words = txt.groupby('work_id').words.sum()
Ms = M[M.in_siberia]
corpus = []
for _, w in W.iterrows():
    wid = w.work_id; sw = int(sib_words.get(wid, 0)); aw = int(all_words.get(wid, 0))
    corpus.append(dict(work_id=wid, author=w.author, title_pg=w.pg_id, observer_group=w.observer_group, language=w.text_language,
                       translation=bool(w.is_translation), edition_year=int(w.edition_year), journey=f"{int(w.journey_start) if pd.notna(w.journey_start) else ''}–{int(w.journey_end) if pd.notna(w.journey_end) else ''}",
                       decade=int(w.decade), corpus_role=w.corpus_role, words_total=aw, words_siberia=sw, siberia_share=round(sw/aw, 3) if aw else 0,
                       mentions_siberia=int((Ms.work_id == wid).sum()), groups_described=int(Ms[Ms.work_id == wid].group_id.nunique()),
                       mentions_per_10k=round((Ms.work_id == wid).sum()/sw*1e4, 1) if sw else None, genre=w.genre, route=w.route_summary))
jdump('corpus.json', corpus); pd.DataFrame(corpus).to_csv(RES/'corpus_summary.csv', index=False)

# ---------- 2. матрица видимости автор × группа ----------
mat = Ms.groupby(['work_id', 'group_id']).size().unstack(fill_value=0)
rate = mat.div(sib_words.reindex(mat.index), axis=0) * 1e4
rate.round(2).to_csv(RES/'visibility_per10k.csv'); mat.to_csv(RES/'visibility_counts.csv')
group_tot = Ms.groupby('group_id').agg(mentions=('mid', 'size'), works=('work_id', 'nunique')).sort_values('mentions', ascending=False)
group_tot['name_ru'] = group_tot.index.map(gname); group_tot['category'] = group_tot.index.map(gcat)
group_tot.to_csv(RES/'group_totals.csv')
jdump('visibility.json', dict(works=list(rate.index), groups=list(rate.columns), names={g: gname[g] for g in rate.columns},
                              categories={g: gcat[g] for g in rate.columns}, per10k=rate.round(2).values.tolist(), counts=mat.values.tolist()))

# кто описывал народ: только коренные; формы этнонимов, использованные каждым автором
who = []
for g, d in Ms[Ms.group_id.map(gcat).isin(['indigenous', 'generic'])].groupby('group_id'):
    forms = d.groupby('work_id').form.agg(lambda s: sorted(set(s.str.lower()))[:6]).to_dict()
    who.append(dict(group_id=g, name_ru=gname[g], mentions=len(d), authors=[dict(work_id=w, author=wmeta.loc[w, 'author'], n=int(n), forms=forms[w])
                    for w, n in d.work_id.value_counts().items()]))
jdump('who_described_whom.json', sorted(who, key=lambda x: -x['mentions']))

# ---------- 3. динамика по десятилетиям (поездки) ----------
Ms2 = Ms.merge(W[['work_id', 'decade', 'observer_group']], on='work_id')
dec_words = txt[txt.in_siberia].merge(W[['work_id', 'decade']], on='work_id').groupby('decade').words.sum()
dyn = Ms2.groupby(['decade', 'group_id']).size().unstack(fill_value=0)
dyn_rate = dyn.div(dec_words, axis=0) * 1e4
dyn_rate.round(2).to_csv(RES/'dynamics_per10k.csv')
cat_dyn = Ms2.assign(cat=Ms2.group_id.map(gcat)).groupby(['decade', 'cat']).size().unstack(fill_value=0).div(dec_words, axis=0) * 1e4
jdump('dynamics.json', dict(decades=[int(d) for d in dyn_rate.index], words=dec_words.astype(int).to_dict(),
                            by_category={c: cat_dyn[c].round(2).tolist() for c in cat_dyn.columns},
                            by_group={g: dyn_rate[g].round(2).tolist() for g in dyn_rate.columns if dyn[g].sum() >= 30},
                            works_per_decade=W.groupby('decade').work_id.apply(list).to_dict()))

# ---------- 4. сети ----------
Rs = R[R.in_siberia]
edges = Rs.groupby(['group_a', 'group_b', 'rel_type']).agg(n=('pid', 'size'), works=('work_id', lambda s: sorted(set(s))),
                                                         example=('pid', 'first')).reset_index()
edges.to_csv(RES/'group_relations_edges.csv', index=False)
Gg = nx.Graph()
for (a, b), d in Rs.groupby(['group_a', 'group_b']):
    typed = d[d.rel_type != 'co_mention']
    Gg.add_edge(a, b, weight=len(d.pid.unique()), typed=Counter(typed.rel_type).most_common())
bet = nx.betweenness_centrality(Gg, weight=None); deg = dict(Gg.degree(weight='weight'))
comms = nx.community.louvain_communities(Gg, weight='weight', seed=1)
cid = {n: i for i, c in enumerate(comms) for n in c}
jdump('graph_groups.json', dict(nodes=[dict(id=n, name=gname.get(n, n), category=gcat.get(n), degree=deg[n], betweenness=round(bet[n], 3), community=cid[n],
                                            mentions=int((Ms.group_id == n).sum())) for n in Gg.nodes],
                                links=[dict(source=a, target=b, weight=d['weight'], types=d['typed']) for a, b, d in Gg.edges(data=True)]))
# двудольный граф автор–народ
B = nx.Graph()
for (w, g), n in Ms.groupby(['work_id', 'group_id']).size().items():
    if n >= 3: B.add_edge('w:'+w, 'g:'+g, weight=int(n))
jdump('graph_author_group.json', dict(nodes=[dict(id=n, kind='work' if n.startswith('w:') else 'group',
                                                  label=wmeta.loc[n[2:], 'author'] + ' ' + str(int(wmeta.loc[n[2:], 'edition_year'])) if n.startswith('w:') else gname[n[2:]],
                                                  group=(wmeta.loc[n[2:], 'observer_group'] if n.startswith('w:') else gcat[n[2:]]),
                                                  decade=int(wmeta.loc[n[2:], 'decade']) if n.startswith('w:') else None) for n in B.nodes],
                                      links=[dict(source=a, target=b, weight=d['weight']) for a, b, d in B.edges(data=True)]))
pd.DataFrame([dict(group=n, name=gname.get(n), degree=deg[n], betweenness=round(bet[n], 3), community=cid[n]) for n in Gg.nodes]).sort_values('betweenness', ascending=False).to_csv(RES/'group_network_metrics.csv', index=False)

# ---------- 5. интертекстуальность: явные ссылки на предшественников ----------
AUTH = {'Gmelin': r'\bGmelin', 'Pallas': r'\bPallas\b', 'Castrén': r'\bCastr[ée]n', 'Middendorff': r'\bMiddendorf', 'Erman': r'\bErman\b',
        'Wrangell': r'\b(?:Von |von |Baron |Admiral )?Wrangell?\b(?!.{0,40}(?:Crimea|army|Denikin))', 'Atkinson': r'\bAtkinson', 'Kennan': r'\bKennan\b', 'Lansdell': r'\bLansdell', 'Huc': r'\bHuc\b',
        'Cochrane': r'\bCochrane\b', 'Dobell': r'\bDobell', 'Krasheninnikov': r'\bKrasch?h?en+in+ik', 'Steller': r'\bSteller\b', 'Humboldt': r'\bHumboldt',
        'Hansteen': r'\bHansteen', 'Dostoevsky': r'\bDosto[iy]e?vsk', 'Radloff': r'\bRadlo', 'Michie': r'\bMichie\b', 'de Windt': r'\b[Dd]e Windt',
        'Knox': r'(?<!General )(?<!Gen\. )(?<!Sir Alfred )\bKnox\b(?!,? (?:the )?British)', 'Meignan': r'\bMeignan', 'Nansen': r'\bNansen', 'Bush (R.J.)': r'\bR\. ?J\. Bush\b', 'Ravenstein': r'\bRavenstein',
        'Schrenck': r'\bSchren[ck]', 'Maack': r'\bMaack\b', 'Ahlqvist': r'\bAhlqvist', 'Strahlenberg': r'\bStrahlenberg', 'Beniowski': r'\bBeniows', 'Krapotkin': r'\bKr[ao]potkin'}
self_ = {'Kennan': 'kennan1870', 'Michie': 'michie1864', 'de Windt': 'dewindt', 'Knox': 'knox1870', 'Meignan': 'meignan1885'}
cites = []
for _, p in txt.iterrows():
    for a, rx in AUTH.items():
        n = len(re.findall(rx, p.text))
        if n and not (a in self_ and p.work_id.startswith(self_[a])):
            cites.append(dict(work_id=p.work_id, cited=a, n=n, pid=p.pid))
C = pd.DataFrame(cites)
cit = C.groupby(['work_id', 'cited']).agg(n=('n', 'sum'), example=('pid', 'first')).reset_index()
cit.to_csv(RES/'citations.csv', index=False)
jdump('citations.json', cit.to_dict(orient='records'))

# текстовые заимствования: общие 8-граммы между разными произведениями (англоязычная часть)
def toks(s): return re.findall(r"[a-zа-яäöüéèà]+", s.lower())
grams = defaultdict(set); gram_pid = {}
en_works = set(W[W.text_language == 'en'].work_id)
for _, p in txt[txt.work_id.isin(en_works)].iterrows():
    t = toks(p.text)
    for i in range(len(t)-7):
        g = hash(' '.join(t[i:i+8])); grams[g].add(p.work_id); gram_pid.setdefault((g, p.work_id), p.pid)  # хэш экономит память на 100+ книгах
shared = [(g, sorted(ws)) for g, ws in grams.items() if len(ws) > 1]
pairs = Counter(); ex = {}
for g, ws in shared:
    for a, b in itertools.combinations(ws, 2):
        pairs[(a, b)] += 1; ex.setdefault((a, b), []).append((g, gram_pid[(g, a)], gram_pid[(g, b)]))
# заимствование на уровне фрагмента: пара абзацев с ≥4 общими 8-граммами (отсекает устойчивые обороты)
pp = Counter(); ppg = defaultdict(list)
for g, ws in shared:
    for a, b in itertools.combinations(ws, 2):
        key = (a, b, gram_pid[(g, a)], gram_pid[(g, b)]); pp[key] += 1; ppg[key].append(g)
PT = P.set_index('pid')['text']
def _sample(pid_a, pid_b):
    ta, tb = toks(PT[pid_a]), toks(PT[pid_b]); sb = {' '.join(tb[i:i+8]) for i in range(len(tb)-7)}
    return next((' '.join(ta[i:i+8]) for i in range(len(ta)-7) if ' '.join(ta[i:i+8]) in sb), '')
passages = [dict(work_a=a, work_b=b, pid_a=x, pid_b=y, shared_8grams=n, sample=_sample(x, y)) for (a, b, x, y), n in pp.items() if n >= 4]
pdx = pd.DataFrame(passages)
ack = {}
for r_ in passages:
    later, earlier = sorted([r_['work_a'], r_['work_b']], key=lambda w: -int(wmeta.loc[w, 'edition_year']))
    lp = r_['pid_a'] if later == r_['work_a'] else r_['pid_b']
    surname = re.escape(re.sub(r'\s*\(.*', '', wmeta.loc[earlier, 'author']).split()[-1])
    r_['borrower'], r_['source'] = later, earlier
    r_['acknowledged_in_paragraph'] = bool(re.search(surname, PT[lp]))
    lt = PT[lp].lstrip()
    r_['kind'] = 'shared_quotation' if lt[:1] in '"“«„\'' else 'candidate_borrowing'
    r_['status'] = 'needs_manual_verification'
reuse = []
if len(pdx):
    for (a, b), d in pd.DataFrame(passages).groupby(['work_a', 'work_b']):
        reuse.append(dict(work_a=a, work_b=b, passages=len(d), shared_8grams=int(d.shared_8grams.sum()),
                          examples=[{k: v for k, v in r_.items()} for r_ in passages if r_['work_a'] == a and r_['work_b'] == b][:8]))
    reuse.sort(key=lambda r: -r['passages'])
jdump('text_reuse.json', reuse); pd.DataFrame(passages).to_csv(RES/'text_reuse_passages.csv', index=False)

# ---------- 6. экспертная выборка: оценочность, тип знания ----------
E = E.merge(W[['work_id', 'observer_group', 'decade']], on='work_id')
pop = pd.read_csv(ROOT/'validation/expert_sample_population.csv').set_index('cluster').N_units
def tab(df, by):
    out = []
    for k, d in df.groupby(by):
        n = len(d); row = dict(key=k if not isinstance(k, tuple) else ' | '.join(map(str, k)), n=n)
        for pol in ['negative', 'positive', 'ambivalent', 'neutral']:
            c = int((d.polarity == pol).sum()); lo, hi = wilson(c, n); row[pol] = round(c/n, 3); row[pol+'_ci'] = [lo, hi]
        row['evaluative_share'] = round((d.polarity != 'neutral').mean(), 3); out.append(row)
    return out
pol_cluster = tab(E, 'cluster')
pol_observer = tab(E[E.cluster.isin(['NE_indigenous', 'WS_indigenous', 'Steppe_Baikal_Amur', 'natives_generic'])], 'observer_group')
obs = E.groupby(['observer_group', 'obs_type']).size().unstack(fill_value=0)
obs_share = (obs.T / obs.sum(axis=1)).T.round(3)
themes_e = Counter(t for ts in E.themes.fillna('') for t in ts.split(';') if t)
neg_themes = Counter(t for ts in E[E.polarity.isin(['negative', 'ambivalent'])].themes.fillna('') for t in ts.split(';') if t)
# взвешенная оценка доли отрицательных описаний по всей популяции «описаний в Сибири» (по кластерам)
wneg = sum(pop[c] * (E[E.cluster == c].polarity == 'negative').mean() for c in pop.index) / pop.sum()
stereo = E[E.stereotype_ru.fillna('') != ''][['k', 'unit_id', 'pid', 'work_id', 'group_id', 'cluster', 'polarity', 'obs_type', 'themes', 'stereotype_ru', 'note', 'ctx']]
stereo = stereo.assign(author=stereo.work_id.map(wmeta.author), group_name=stereo.group_id.map(gname))
jdump('expert_stats.json', dict(n=len(E), population=pop.to_dict(), weighted_negative_share=round(wneg, 3),
                                polarity_by_cluster=pol_cluster, polarity_by_observer_indigenous=pol_observer,
                                obs_type_by_observer=obs_share.to_dict(orient='index'), obs_counts=obs.to_dict(orient='index'),
                                themes=themes_e.most_common(), themes_in_evaluative=neg_themes.most_common()))
jdump('stereotypes.json', stereo.to_dict(orient='records'))
pd.DataFrame(pol_cluster).to_csv(RES/'expert_polarity_by_cluster.csv', index=False)
pd.DataFrame(pol_observer).to_csv(RES/'expert_polarity_by_observer.csv', index=False)
obs_share.to_csv(RES/'expert_obs_by_observer.csv')

# ---------- 7. коллокации (англоязычные тексты, окно ±5) ----------
STOP = set("""a an the and or of to in on at by for with from as is was were be been are it its this that these those he she they them their his her
i we our us you your me my not no but so if then than there here which who whom what when where while had has have do did does would could should
will shall may might must can one two all any some such very more most much many also only even about into upon over under after before through
again out up down off them himself themselves itself other another each every same own just like s t said made being""".split())
en_sib = txt[txt.in_siberia & txt.work_id.isin(en_works)]
ref = Counter(); ref_n = 0
for t in en_sib.text: tk = [x for x in toks(t) if x not in STOP and len(x) > 2]; ref.update(tk); ref_n += len(tk)
Me = Ms[Ms.work_id.isin(en_works)]
coll = {}
for g, d in Me.groupby('group_id'):
    if len(d) < 25: continue
    c = Counter(); n = 0; forms = set(d.form.str.lower())
    for _, m in d.iterrows():
        win = [x for x in toks(str(m.left))[-5:] + toks(str(m.right))[:5] if x not in STOP and len(x) > 2 and x not in forms]
        c.update(win); n += len(win)
    rows = []
    for w_, f in c.items():
        if f < 3: continue
        lr = math.log2(((f + .5)/n) / ((ref[w_] + .5)/ref_n))
        rows.append((w_, f, round(lr, 2)))
    coll[g] = sorted([r for r in rows if r[2] > 1], key=lambda r: (-r[2], -r[1]))[:20]
jdump('collocates_en.json', {g: dict(name=gname[g], collocates=[dict(word=w_, freq=f, log_ratio=lr) for w_, f, lr in v]) for g, v in coll.items()})

# ---------- 8. география: точки упоминаний (место абзаца) ----------
plc = PL.set_index('place_id')
pm_first = PM.merge(PL[['place_id', 'region']], on='place_id')
pm_first = pm_first[pm_first.region.isin(['west_siberia', 'east_siberia', 'yakutia_ne', 'far_east', 'kamchatka_chukotka', 'arctic_siberia', 'kazakh_steppe'])]
pid_place = pm_first.groupby('pid').place_id.agg(lambda s: s.value_counts().index[0])
order = {p: i for i, p in enumerate(P.pid)}
last_place = {}; anchor = {}
for p in P.itertuples():
    if p.pid in pid_place.index: last_place[(p.work_id, p.chapter)] = pid_place[p.pid]
    anchor[p.pid] = last_place.get((p.work_id, p.chapter))
Ms_geo = Ms.assign(place_id=Ms.pid.map(anchor)).dropna(subset=['place_id'])
agg = Ms_geo.groupby(['place_id', 'group_id', 'work_id']).size().reset_index(name='n')
feats = []
for _, r in agg.iterrows():
    pl = plc.loc[r.place_id]
    feats.append(dict(type='Feature', geometry=dict(type='Point', coordinates=[float(pl.lon), float(pl.lat)]),
                      properties=dict(place=pl.label_ru, place_id=r.place_id, group_id=r.group_id, group=gname[r.group_id], category=gcat[r.group_id],
                                      work_id=r.work_id, author=wmeta.loc[r.work_id, 'author'], decade=int(wmeta.loc[r.work_id, 'decade']), n=int(r.n),
                                      coord_source=pl.coord_source)))
jdump('mentions_by_place.geojson', dict(type='FeatureCollection', features=feats))
routes = []
for w, d in IT[IT.evidence_status != 'not_found_in_text'].groupby('work_id'):
    d = d.sort_values('seq')
    routes.append(dict(type='Feature', geometry=dict(type='LineString', coordinates=[[float(x), float(y)] for x, y in zip(d.lon, d.lat)]),
                       properties=dict(work_id=w, author=wmeta.loc[w, 'author'], year=int(wmeta.loc[w, 'edition_year']), decade=int(wmeta.loc[w, 'decade']),
                                       observer_group=wmeta.loc[w, 'observer_group'], journey=f"{wmeta.loc[w,'journey_start']}–{wmeta.loc[w,'journey_end']}",
                                       stops=[dict(seq=int(s.seq), place=s.label_ru, pid=s.evidence_pid, status=s.evidence_status) for s in d.itertuples()])))
jdump('routes.geojson', dict(type='FeatureCollection', features=routes))
jdump('places.geojson', dict(type='FeatureCollection', features=[dict(type='Feature', geometry=dict(type='Point', coordinates=[float(r.lon), float(r.lat)]),
      properties=dict(place_id=r.place_id, label=r.label_ru, region=r.region, type=r.type, coord_source=r.coord_source,
                      mentions=int((PM.place_id == r.place_id).sum()))) for r in PL.itertuples()]))

# ---------- 9. сводка для отчёта ----------
summary = dict(
    works=len(W), works_core=int(W.corpus_role.str.startswith('core').sum()), languages=W.text_language.value_counts().to_dict(),
    words_total=int(all_words.sum()), words_siberia=int(sib_words.sum()), mentions_total=int(len(M)), mentions_siberia=int(len(Ms)),
    groups_found=int(Ms.group_id.nunique()), indigenous_groups=int(Ms[Ms.group_id.map(gcat) == 'indigenous'].group_id.nunique()),
    place_mentions=int(len(PM)), places=int(len(PL)), relations_siberia=int(len(Rs)), typed_relations=int((Rs.rel_type != 'co_mention').sum()),
    top_groups=group_tot.head(15)[['name_ru', 'mentions', 'works']].reset_index().to_dict(orient='records'),
    graph=dict(nodes=Gg.number_of_nodes(), edges=Gg.number_of_edges(), communities=[sorted(gname.get(x, x) for x in c) for c in comms],
               top_betweenness=sorted(((gname.get(k, k), round(v, 3)) for k, v in bet.items()), key=lambda x: -x[1])[:8]),
    citations_top=cit.groupby('cited').n.sum().sort_values(ascending=False).head(12).to_dict(),
    reuse_top=[(r['work_a'], r['work_b'], r['passages'], r['shared_8grams']) for r in reuse[:8]],
    expert=dict(n=len(E), weighted_negative_share=round(wneg, 3), polarity_by_cluster=pol_cluster, polarity_by_observer_indigenous=pol_observer,
                obs_share=obs_share.to_dict(orient='index'), themes_evaluative=neg_themes.most_common(10)))
jdump('summary.json', summary)
print(json.dumps({k: v for k, v in summary.items() if k not in ('expert',)}, ensure_ascii=False, indent=1, default=str)[:4500])
print('--- expert'); print(pd.DataFrame(pol_cluster)[['key', 'n', 'negative', 'positive', 'ambivalent', 'evaluative_share']].to_string())
print(pd.DataFrame(pol_observer)[['key', 'n', 'negative', 'negative_ci', 'positive', 'evaluative_share']].to_string()); print(obs_share.to_string())
print('weighted negative share', round(wneg, 3))

# ---------- 10. укрупнённые периоды (по году начала поездки) ----------
def period(y):
    return '1: до 1880' if y < 1880 else ('2: 1880–1904' if y < 1905 else '3: 1905–1920')
W['period'] = W.journey_start.fillna(W.edition_year).map(period)
per_w = W.groupby('period').work_id.apply(list).to_dict()
tx = txt[txt.in_siberia].merge(W[['work_id', 'period']], on='work_id')
pw = tx.groupby('period').words.sum()
mp = Ms.merge(W[['work_id', 'period']], on='work_id').assign(cat=lambda d: d.group_id.map(gcat))
per_cat = (mp.groupby(['period', 'cat']).size().unstack(fill_value=0).div(pw, axis=0) * 1e4).round(2)
per_grp = (mp.groupby(['period', 'group_id']).size().unstack(fill_value=0).div(pw, axis=0) * 1e4).round(2)
ep = E.merge(W[['work_id', 'period']], on='work_id')
per_pol = tab(ep[ep.cluster.isin(['NE_indigenous', 'WS_indigenous', 'Steppe_Baikal_Amur', 'natives_generic'])], 'period')
jdump('periods.json', dict(works=per_w, words=pw.astype(int).to_dict(), by_category=per_cat.to_dict(orient='index'),
                           by_group={p: {g: v for g, v in r.items() if v > 0} for p, r in per_grp.to_dict(orient='index').items()},
                           expert_polarity_indigenous=per_pol))
print(per_cat.to_string()); print(pd.DataFrame(per_pol)[['key', 'n', 'negative', 'negative_ci', 'positive', 'evaluative_share']].to_string())
# описания коренных народов по тематике (правила; P≈0.5, R≈0.5 – только как ориентир)
Ui = U[U.in_siberia & U.category.isin(['indigenous', 'generic'])].merge(W[['work_id', 'observer_group']], on='work_id')
th = Ui.assign(t=Ui.themes.fillna('').str.split(';')).explode('t'); th = th[th.t != '']
th_share = (th.groupby(['observer_group', 't']).size() / Ui.groupby('observer_group').size()).unstack().round(3)
th_share.to_csv(RES/'themes_by_observer_rules.csv'); jdump('themes_by_observer_rules.json', th_share.to_dict(orient='index'))
