"""06b. Наборы данных для новых разделов дашборда (дискурсы, n-граммы, коллокации, рамки, отношения) — формат {rows, meta}."""
import json, pathlib
import pandas as pd
ROOT = pathlib.Path(__file__).resolve().parents[1]; R = ROOT/'analysis/results/research'; OUT = ROOT/'dash_data'
CODE = pathlib.Path(__file__).read_text(encoding='utf-8')
def save(name, rows, inputs):
    meta = [{'label': '06b_dashboard_research.py', 'value': CODE, 'type': 'code', 'lang': 'python'}, {'label': 'Input', 'value': inputs}]
    json.dump({'rows': rows, 'meta': meta}, open(OUT/f'{name}.json', 'w', encoding='utf-8'), ensure_ascii=False)
D = pd.read_csv(R/'discourse_prevalence.csv')
ORD = ['до 1855 (Николай I и ранее)', '1856–1880 (Амур, реформы)', '1881–1904 (споры о ссылке, Транссиб)', '1905–1917 (после 1905 г., переселение)', '1918–1930 (война, плен, Гражданская война)']
d = D[D.dimension == 'period'].copy(); d['order'] = d.key.map(ORD.index)
d = d[d.discourse != 'civilizing_colonization']
save('discourse_period', [dict(period=r.key, order=int(r.order), discourse=r.discourse_ru, share_pct=round(100*r.share, 2), lo_pct=round(100*r.lo, 2), hi_pct=round(100*r.hi, 2),
                               paragraphs=int(r.paragraphs), works=int(r.works)) for r in d.sort_values(['discourse', 'order']).itertuples()],
     'analysis/results/research/discourse_prevalence.csv (07c_discourse.py): доля абзацев о Сибири с упоминанием коренных народов')
M = pd.read_csv(R/'ngram_markers.csv'); den = pd.read_csv(R/'ngram_denominators.csv')
en = den[den.text_language == 'en']; tot = en.groupby('decade').words_siberia.sum()
mk = M[M.text_language == 'en'].groupby(['decade', 'marker'])['count'].sum().unstack(fill_value=0)
keep = ['savage(s)', 'civilised/civilized', 'primitive', 'natives', 'tribe(s)', 'race(s)', 'extinct/dying out', 'Russified', 'exile(s)', 'convict(s)', 'settler(s)/colonist(s)', 'shaman', 'vodka', 'yasak/tribute']
rows = []
for dec in tot.index:
    if tot[dec] < 50000: continue
    for m in keep:
        rows.append(dict(decade=int(dec), marker=m, per_million=round(float(mk.loc[dec, m]) / tot[dec] * 1e6, 1) if dec in mk.index and m in mk.columns else 0.0,
                         count=int(mk.loc[dec, m]) if dec in mk.index and m in mk.columns else 0, words=int(tot[dec])))
save('ngram_markers', rows, 'analysis/results/research/ngram_markers.csv + ngram_denominators.csv (07d): английские тексты, абзацы о Сибири, десятилетие поездки; десятилетия < 50 тыс. слов исключены')
C = pd.read_csv(R/'collocations_by_group.csv')
C = C[C.slice == 'en'].groupby('group').head(15)
C = C[C.groupby('group').collocate.transform('size') >= 5]
save('collocations', [dict(group=r.group, collocate=r.collocate, f_xy=int(r.f_xy), works=int(r.works), logdice=float(r.logdice), example_pid=r.example_pid) for r in C.itertuples()],
     'analysis/results/research/collocations_by_group.csv (07d): окно ±5 слов, logDice, p<0.001, ≥5 совпадений в ≥3 книгах, англ.')
F = pd.read_csv(R/'expert_v04_estimates.csv'); F = F[F.dimension == 'frame']
FR = {'ethno': 'этнографическое описание', 'contact': 'повседневный контакт', 'econ': 'хозяйство и торговля', 'decline': 'упадок, вымирание, болезни',
      'civ': 'иерархия «цивилизованности»', 'relig': 'религия', 'conflict': 'конфликт', 'admin': 'власть и управление', 'other': 'прочее'}
save('frames', [dict(frame=FR.get(r.key, r.key), n=int(r.n), works=int(r.works), neg_pct=round(100*r.neg, 1), neg_lo_pct=round(100*r.neg_lo, 1), neg_hi_pct=round(100*r.neg_hi, 1),
                     pos_pct=round(100*r.pos, 1), pos_lo_pct=round(100*r.pos_lo, 1), pos_hi_pct=round(100*r.pos_hi, 1)) for r in F.sort_values('n', ascending=False).itertuples()],
     'analysis/results/research/expert_v04_estimates.csv (09): рамки описаний, экспертная выборка v0.4')
P = pd.read_csv(R/'expert_v04_relation_profile.csv')
save('relations_manual', [dict(period=r.per, relation=r.type_ru, share_pct=round(100*r.share, 1)) for r in P.itertuples()],
     'analysis/results/research/expert_v04_relation_profile.csv (09): 84 предложения с отношением из 100 размеченных вручную')
Mo = pd.read_csv(R/'expert_v04_models.csv')
TERM = {'personal': 'личное наблюдение (vs. обобщение, пересказ)', 'brit': 'британский автор', 'transit': 'транзит / плавание / война', 'C(per3)[T.b_1881_1904]': '1881–1904 (vs. до 1880)', 'C(per3)[T.c_после1904]': 'после 1904 (vs. до 1880)'}
save('models', [dict(outcome='отрицательная оценка' if r.model.startswith('neg') else 'положительная оценка', term=TERM[r.term], OR=r.OR, lo=r.lo, hi=r.hi, p=r.p)
                for r in Mo[Mo.term != 'Intercept'].itertuples()], 'analysis/results/research/expert_v04_models.csv (09): логит, ошибки кластеризованы по книгам')
print(sorted(p.name for p in OUT.iterdir()))
