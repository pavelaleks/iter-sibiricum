"""10. Данные для сайта (GitHub Pages): site/data/*.json и site/texts/<work_id>.json.

Всё компактно и в одном месте, чтобы статический сайт работал без сервера:
  works.json      паспорта книг + показатели + ссылки на источник;
  groups.json     карточки народов: ареал (схематично), упоминания по десятилетиям, кто описывал, коллокации,
                  дискурсы, цитаты из экспертной выборки, места;
  places.json     места газеттира: координаты, упоминания, какие книги и какие группы рядом;
  routes.json     ручные маршруты (с абзацами-доказательствами) и автомаршруты;
  networks.json   сети групп по периодам и интертекстуальная сеть;
  analytics.json  дискурсы, маркеры, рамки, модели, темы, экспертные оценки, отношения, проверки качества;
  ngram_en.json   n-граммы по годам (английские абзацы о Сибири);
  reuse.json      пары заимствований;
  texts/*.json    тексты: абзацы (тип, регион, флаг «Сибирь») и упоминания групп для подсветки.
"""
import json, re, math, collections, pathlib, shutil
import pandas as pd, numpy as np
import sys; sys.path.insert(0, str(pathlib.Path(__file__).parent))
from research_common import ROOT, works, groups, PERIOD_RU, NAT_RU, STAY_RU

SITE = ROOT.parent / 'site'; D = SITE / 'data'; TX = SITE / 'texts'
D.mkdir(parents=True, exist_ok=True); TX.mkdir(parents=True, exist_ok=True)
R = ROOT / 'analysis/results/research'; SD = ROOT / 'site_data'
def _clean(o):
    if isinstance(o, float): return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict): return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [_clean(v) for v in o]
    if hasattr(o, 'item'): return _clean(o.item())
    return o
def dump(name, obj): json.dump(_clean(obj), open(D / name, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), allow_nan=False, default=str)
def num(x):
    try: return None if x is None or (isinstance(x, float) and math.isnan(x)) else x
    except Exception: return x

W = works(); G = groups()
plan = pd.read_csv(ROOT / 'data/corpus_plan.csv').set_index('work_id')
C = {c['work_id']: c for c in json.load(open(SD / 'corpus.json'))}
M = pd.read_csv(ROOT / 'data/mentions.csv', usecols=['pid', 'work_id', 'group_id', 'start', 'end', 'in_siberia', 'form'])
Ms = M[M.in_siberia.astype(str) == 'True']

# ---------- works ----------
wrows = []
for w, r in W.iterrows():
    p = plan.loc[w] if w in plan.index else None
    ia = [x for x in str(p.ia_ids).split(';') if x and x != 'nan'] if p is not None else []
    pg = str(int(float(r.pg_id))) if str(r.pg_id) not in ('', 'nan') and str(r.pg_id).replace('.0', '').isdigit() else ''
    src = [f'https://archive.org/details/{x}' for x in ia] or ([f'https://www.gutenberg.org/ebooks/{pg}'] if pg else [])
    c = C.get(w, {})
    gm = Ms[Ms.work_id == w].group_id.value_counts().head(6)
    wrows.append(dict(id=w, label=r.label, author=r.author, year=int(r.edition_year), place=num(r.edition_place), lang=r.text_language,
                      orig_lang=r.original_language, translation=str(r.is_translation).lower() == 'true', nat=r.nat_group, nat_ru=NAT_RU.get(r.nat_group, r.nat_group),
                      nationality=num(r.nationality), gender=num(r.gender), role=num(r.role), stay=r.stay_type, stay_ru=STAY_RU.get(r.stay_type, r.stay_type),
                      j0=num(r.journey_start), j1=num(r.journey_end), period=r.period, period_ru=PERIOD_RU[r.period], core=bool(r.core), genre=num(r.genre),
                      words=c.get('words_total'), words_sib=c.get('words_siberia'), mentions=c.get('mentions_siberia'), per10k=c.get('mentions_per_10k'),
                      top_groups=[[G.loc[g, 'name_ru'], int(n)] for g, n in gm.items()], sources=src, note=num(p.notes) if p is not None else None))
dump('works.json', wrows)

# ---------- places ----------
PL = pd.read_csv(ROOT / 'data/places.csv')
PM = pd.read_csv(ROOT / 'data/place_mentions.csv')
pm_pid = PM.groupby('pid').place_id.agg(lambda s: sorted(set(s)))
gm_pid = M[M.group_id.map(G.category).isin(['indigenous', 'generic'])].groupby('pid').group_id.agg(list)
pg_count = collections.defaultdict(collections.Counter)
for pid, pls in pm_pid.items():
    if pid in gm_pid.index:
        for pl in pls: pg_count[pl].update(gm_pid[pid])
prows = []
for r in PL.itertuples():
    d = PM[PM.place_id == r.place_id]
    tw = d.work_id.value_counts().head(8)
    prows.append(dict(id=r.place_id, name=r.label_ru, lat=float(r.lat), lon=float(r.lon), region=r.region, sib=str(r.in_siberia) == 'True', type=r.type,
                      coord=r.coord_source, mentions=int(len(d)), works=int(d.work_id.nunique()), top_works=[[w, int(n)] for w, n in tw.items()],
                      groups=[[G.loc[g, 'name_ru'], int(n)] for g, n in pg_count[r.place_id].most_common(6)]))
dump('places.json', prows)

# ---------- routes ----------
IT = pd.read_csv(ROOT / 'data/itineraries.csv'); IA = pd.read_csv(ROOT / 'data/itineraries_auto.csv')
routes = []
for w, d in IT.groupby('work_id'):
    d = d.sort_values('seq')
    routes.append(dict(work=w, method='manual', stops=[[s.place_id, s.label_ru, round(float(s.lon), 3), round(float(s.lat), 3), s.evidence_pid if isinstance(s.evidence_pid, str) else None, s.evidence_status] for s in d.itertuples()]))
manual = set(IT.work_id)
for w, d in IA.groupby('work_id'):
    if w in manual: continue
    d = d.sort_values('seq')
    routes.append(dict(work=w, method='auto', stops=[[s.place_id, s.label_ru, round(float(s.lon), 3), round(float(s.lat), 3), s.evidence_pid, 'auto'] for s in d.itertuples()]))
dump('routes.json', routes)

# ---------- groups ----------
AREAS = {  # схематичные ареалы около 1900 г.: [долгота, широта, rx°, ry°]; по этнографическим картам, только для ориентира
 'khanty': [[70, 62, 8, 3.5]], 'mansi': [[62, 61.5, 2.5, 2.5]], 'selkup': [[82, 59.5, 4, 2], [83, 65.5, 3, 1.5]], 'ket': [[88, 62.5, 1.5, 2.5]],
 'samoyedic': [[85, 70, 25, 3.5]], 'nenets': [[72, 68, 9, 2.5]], 'kamas': [[95, 55.3, 1.2, 0.7]], 'evenki_even': [[112, 60, 20, 7], [150, 62, 8, 3]],
 'sakha': [[125, 64, 11, 5]], 'buryat': [[108, 52.5, 5, 2.3]], 'chukchi': [[175, 67, 9, 2.6]], 'koryak': [[163, 61.5, 5, 2.5]],
 'itelmen_kamchadal': [[157, 56, 2, 3]], 'yukaghir': [[152, 67.5, 5, 2]], 'nivkh': [[141.5, 53, 2, 1.5]], 'ainu': [[142.7, 47, 1, 1.5]],
 'nanai_amur': [[136, 49, 4, 1.6]], 'tuvan': [[94, 51.5, 4, 1.4]], 'altai_kalmyk': [[87.5, 50.8, 2.8, 1.5]], 'kazakh_kirghiz': [[70, 49, 12, 4]],
 'siberian_tatar': [[71, 57, 8, 2]], 'mongol': [[103, 47, 10, 3]],
}
Wsib = {w['id']: w['words_sib'] or 0 for w in wrows}
den = pd.read_csv(R / 'ngram_denominators.csv'); dec_words = den.groupby('decade').words_siberia.sum()
NG = pd.read_csv(R / 'ngram_ethnonyms.csv')
COL = pd.read_csv(R / 'collocations_by_group.csv')
DG = pd.read_csv(R / 'discourse_by_group.csv')
EA = pd.read_csv(ROOT / 'data/expert_annotations_v04.csv'); EA = EA[EA.pol != 'invalid']
POL = {'neg': 'отрицательная', 'pos': 'положительная', 'amb': 'амбивалентная', 'neu': 'нейтральная'}
FORMS = M.groupby('group_id').form.agg(lambda s: [f for f, _ in collections.Counter(s).most_common(8)])
grows = []
for g, r in G.iterrows():
    d = Ms[Ms.group_id == g]
    if len(d) < 20: continue
    ng = NG[NG.group_id == g].groupby('decade').mentions.sum()
    series = [[int(dc), int(ng.get(dc, 0)), round(float(ng.get(dc, 0)) / float(dec_words[dc]) * 1e6, 1)] for dc in dec_words.index if dec_words[dc] > 30000]
    byw = d.work_id.value_counts()
    authors = sorted(([w, int(n), round(n / max(1, Wsib.get(w, 1)) * 1e4, 1)] for w, n in byw.items() if Wsib.get(w, 0) > 5000), key=lambda x: -x[2])[:12]
    col = {lg: [[c.collocate, int(c.f_xy), float(c.logdice), c.example_pid] for c in COL[(COL.slice == lg) & (COL.group_id == g)].head(15).itertuples()] for lg in ('en', 'fr', 'de')}
    disc = [[x.discourse_ru, round(100 * x.share, 1), round(100 * x.lo, 1), round(100 * x.hi, 1)] for x in DG[DG.group_id == g].itertuples()]
    quotes = [dict(work=q.work, pol=POL.get(q.pol, q.pol), frame=q.frame, stereotype=q.stereotype if isinstance(q.stereotype, str) else '', pid=q.pid, text=str(q.context)[:420])
              for q in EA[EA.group_id == g].sort_values('pol').itertuples()][:8]
    places = sorted(((p['name'], dict(p['groups']).get(r.name_ru, 0)) for p in prows if dict(p['groups']).get(r.name_ru)), key=lambda x: -x[1])[:8]
    grows.append(dict(id=g, name=r.name_ru, name_en=r.name_en, category=r.category, family=num(r.language_family), sub=num(r.subcategory), note=num(r.note),
                      mentions=int(len(d)), works=int(d.work_id.nunique()), forms=FORMS.get(g, []), areas=AREAS.get(g, []), series=series,
                      authors=authors, collocations=col, discourses=disc, quotes=quotes, places=places))
dump('groups.json', sorted(grows, key=lambda x: (x['category'] != 'indigenous', -x['mentions'])))

# ---------- networks ----------
NET = json.load(open(SD / 'research/relation_networks_by_period.json'))
IN = json.load(open(SD / 'research/intertext_network.json'))
dump('networks.json', dict(periods=NET, intertext=IN))

# ---------- analytics ----------
A = {}
A['discourse'] = pd.read_csv(R / 'discourse_prevalence.csv').to_dict(orient='records')
A['discourse_examples'] = json.load(open(SD / 'research/discourse.json'))['examples']
mk = pd.read_csv(R / 'ngram_markers.csv')
A['markers'] = mk[mk.text_language == 'en'].groupby(['decade', 'marker'])['count'].sum().reset_index().to_dict(orient='records')
A['marker_words'] = {int(k): int(v) for k, v in den[den.text_language == 'en'].groupby('decade').words_siberia.sum().items()}
A['expert'] = pd.read_csv(R / 'expert_v04_estimates.csv').to_dict(orient='records')
A['models'] = pd.read_csv(R / 'expert_v04_models.csv').to_dict(orient='records')
A['relations_manual'] = pd.read_csv(R / 'expert_v04_relation_profile.csv').to_dict(orient='records')
T = json.load(open(SD / 'research/topics.json')); A['topics'] = dict(words=T['top_words'], labels=T['label_ru'], shares=T['shares'])
A['keyness'] = pd.read_csv(R / 'keyness.csv').groupby('contrast').head(25).to_dict(orient='records')
A['quality'] = json.load(open(ROOT / 'dash_data/quality.json'))['rows']
A['routes_validation'] = pd.read_csv(R / 'routes_auto_validation.csv').to_dict(orient='records')
A['summary'] = {k: v for k, v in json.load(open(SD / 'summary.json')).items() if not isinstance(v, (dict, list))}
A['citations'] = pd.read_csv(R / 'intertext_nodes.csv').head(25)[['label', 'kind', 'cited_by']].to_dict(orient='records')
dump('analytics.json', A)
shutil.copy(SD / 'research/ngram_en.json', D / 'ngram_en.json')
RU = pd.read_csv(R / 'reuse_with_discourse.csv')
Pt = {}
for l in open(ROOT / 'corpus/paragraphs.jsonl', encoding='utf-8'):
    x = json.loads(l); Pt[x['pid']] = x['text']
RP = pd.read_csv(ROOT / 'analysis/results/text_reuse_passages.csv')
reuse = []
for r in RP.itertuples():
    bp = r.pid_a if r.borrower == r.work_a else r.pid_b; sp = r.pid_b if bp == r.pid_a else r.pid_a
    kind = 'цитата с указанием автора' if r.acknowledged_in_paragraph else ('общая цитата' if r.kind == 'shared_quotation' else 'кандидат в заимствование')
    reuse.append(dict(b=r.borrower, s=r.source, kind=kind, n=int(r.shared_8grams), bp=bp, sp=sp, bt=Pt.get(bp, '')[:260], st=Pt.get(sp, '')[:260]))
dump('reuse.json', sorted(reuse, key=lambda x: -x['n']))

# ---------- texts ----------
mm = collections.defaultdict(list)
for r in M.itertuples(): mm[r.pid].append([int(r.start), int(r.end), r.group_id])
cur, buf = None, []
def flush():
    if cur: json.dump(dict(id=cur, p=buf), open(TX / f'{cur}.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
for l in open(ROOT / 'corpus/paragraphs.jsonl', encoding='utf-8'):
    x = json.loads(l)
    if x['work_id'] != cur: flush(); cur, buf = x['work_id'], []
    if x['type'] not in ('text', 'heading', 'note'): continue
    buf.append([x['pid'].rsplit('_p', 1)[1], x['type'][0], x['region'], 1 if x['in_siberia'] else 0, x['text'], mm.get(x['pid'], [])])
flush()
print('works', len(wrows), 'groups', len(grows), 'places', len(prows), 'routes', len(routes))
