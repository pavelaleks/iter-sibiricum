"""07a. Автоматические маршруты для всех книг и их проверка по ручным маршрутам.

Метод: для каждой книги берутся упоминания населённых пунктов и узловых точек (city/town/village/station/post)
в порядке абзацев. Место входит в маршрут, если упомянуто ≥2 раз; его позиция в маршруте — медиана номеров
абзацев с упоминаниями (устойчива к обзорным упоминаниям во введении). Абзац-доказательство — упоминание,
ближайшее к медиане. Статус всех остановок: auto_median_order / needs_verification.
Проверка: на книгах с ручным маршрутом (03_extract.ROUTES) — тау Кендалла между порядками общих мест
и доля ручных остановок, найденных автоматически (полнота).
"""
import re, sys
import numpy as np, pandas as pd
from scipy.stats import kendalltau
from research_common import ROOT, RES, SITE, works, jdump
sys.path.insert(0, str(ROOT / 'analysis'))

W = works()
PL = pd.read_csv(ROOT / 'data/places.csv').set_index('place_id')
PM = pd.read_csv(ROOT / 'data/place_mentions.csv')
PM['n'] = PM.pid.str.extract(r'_p(\d+)$')[0].astype(int)
KEEP = {'city', 'town', 'village', 'station', 'post', 'settlement', 'fort', 'mine', 'monastery', 'port', 'cape', 'strait'}
PM = PM[PM.place_id.map(PL.type).isin(KEEP)]

src = open(ROOT / 'analysis/03_extract.py', encoding='utf-8').read()
ns = {}; exec(re.search(r'ROUTES = \{.*?\n\}', src, re.S).group(0), ns); MANUAL = ns['ROUTES']

rows, val = [], []
for w, d in PM.groupby('work_id'):
    if w not in W.index: continue
    cnt = d.place_id.value_counts(); keep = cnt[cnt >= 2].index
    med = d[d.place_id.isin(keep)].groupby('place_id').n.median().sort_values()
    for seq, (pl, m) in enumerate(med.items(), 1):
        dd = d[d.place_id == pl]; ev = dd.iloc[(dd.n - m).abs().argmin()].pid
        rows.append(dict(work_id=w, seq=seq, place_id=pl, label_ru=PL.loc[pl, 'label_ru'], lat=PL.loc[pl, 'lat'], lon=PL.loc[pl, 'lon'],
                         region=PL.loc[pl, 'region'], in_siberia=PL.loc[pl, 'in_siberia'], median_par=float(m), mentions=int(cnt[pl]),
                         evidence_pid=ev, method='auto_median_order', status='needs_verification'))
    if w in MANUAL:
        man = [p for p in MANUAL[w] if p in PL.index and PL.loc[p, 'type'] in KEEP]
        auto = list(med.index); common = [p for p in man if p in auto]
        tau = kendalltau([man.index(p) for p in common], [auto.index(p) for p in common]).statistic if len(common) >= 3 else np.nan
        val.append(dict(work_id=w, manual_stops=len(man), found=len(common), recall=round(len(common) / max(1, len(man)), 2),
                        auto_stops=len(auto), kendall_tau=round(float(tau), 2) if tau == tau else None))
R = pd.DataFrame(rows); R.to_csv(ROOT / 'data/itineraries_auto.csv', index=False)
V = pd.DataFrame(val); V.to_csv(RES / 'routes_auto_validation.csv', index=False)
print(V.to_string()); print('median recall', V.recall.median(), 'median tau', V.kendall_tau.median(), '| works with auto routes', R.work_id.nunique())

feats = []
for w, d in R[R.in_siberia | R.region.isin(['kazakh_steppe', 'urals', 'european_russia', 'mongolia', 'china', 'manchuria'])].groupby('work_id'):
    d = d.sort_values('seq')
    if len(d) < 2: continue
    feats.append(dict(type='Feature', geometry=dict(type='LineString', coordinates=[[float(x), float(y)] for x, y in zip(d.lon, d.lat)]),
                      properties=dict(work_id=w, label=W.loc[w, 'label'], period=W.loc[w, 'period'], nat_group=W.loc[w, 'nat_group'],
                                      stay_type=W.loc[w, 'stay_type'], method='auto_median_order', status='needs_verification',
                                      stops=[dict(seq=int(s.seq), place=s.label_ru, pid=s.evidence_pid, mentions=int(s.mentions)) for s in d.itertuples()])))
jdump('routes_auto.geojson', dict(type='FeatureCollection', features=feats))
print('features', len(feats))
