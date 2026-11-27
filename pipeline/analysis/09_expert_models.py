"""09. Ручная экспертная выборка v0.4: сборка, оценки с весами и ДИ, модели, точность правил.

Описания: оценка (neg/pos/amb/neu), тип знания (personal/generalization/reported/bookish), рамка описания
(ethno, contact, econ, decline, civ, relig, conflict, admin, other), формулировка стереотипа.
Единицы с меткой invalid (топоним, не Сибирь, неверная группа) — мера валидности автоматического слоя.
Оценки по корпусу — с весами страт (08_expert_sample.py), ДИ — кластерный бутстреп по книгам.
Модель: логит P(отрицательная оценка) ~ наблюдатель + период + тип пребывания + личное наблюдение,
ошибки кластеризованы по книгам. Выборка мала: модель — разведочная.
Отношения: ручной тип против правила; профиль типов по периодам.
"""
import glob
import numpy as np, pandas as pd
import statsmodels.formula.api as smf
from research_common import ROOT, RES, SITE, works, jdump, PERIOD_RU, NAT_RU, STAY_RU, wilson

W = works()
S = pd.read_csv(ROOT / 'data/expert_v04_sample.csv')
L = pd.concat([pd.read_csv(f, sep='\t', header=None, names=['i', 'pol', 'obs_m', 'frame', 'stereotype'], dtype=str, keep_default_na=False)
               for f in sorted(glob.glob(str(ROOT / 'validation/expert_v04_labels_b*.tsv')))])
L['i'] = L.i.astype(int)
E = S.join(L.set_index('i'), how='inner')
E['annotator'] = 'model'
# экспертная проверка из рабочего места заменяет предварительные метки (pipeline/validation/ANNOTATION_PROTOCOL.md)
_rv = ROOT.parent / 'site' / 'data' / 'review' / 'annotation_review.json'
if _rv.exists():
    import json as _j
    for _uid, _x in _j.load(open(_rv, encoding='utf-8')).items():
        _m = E.unit_id == _uid
        if _m.any():
            E.loc[_m, ['pol', 'obs_m', 'frame', 'annotator']] = [_x['pol'], _x['obs'], _x['frame'], _x['by']]
    print('экспертная проверка:', int((E.annotator != 'model').sum()), 'из', len(E))
E['stay'] = E.work_id.map(W.stay_type); E['nat'] = E.work_id.map(W.nat_group); E['gender'] = E.work_id.map(W.gender)
E.drop(columns=['polarity', 'obs_type']).to_csv(ROOT / 'data/expert_annotations_v04.csv', index=False)
valid = E[E.pol != 'invalid'].copy()
inv = (E.pol == 'invalid').sum(); lo, hi = wilson(len(E) - inv, len(E))
print(f'units {len(E)}, invalid {inv} → validity {1 - inv / len(E):.3f} [{lo:.3f}, {hi:.3f}]')

for c in ('neg', 'pos', 'amb'): valid[c] = (valid.pol == c).astype(int)
valid['personal'] = (valid.obs_m == 'personal').astype(int)
valid['secondhand'] = valid.obs_m.isin(['reported', 'bookish']).astype(int)


def wboot(d, col, n=2000, seed=3):
    g = d.assign(wv=d[col] * d.weight).groupby('work_id')[['wv', 'weight']].sum()
    if len(g) == 0: return (np.nan,) * 3
    a, b = g.wv.to_numpy(), g.weight.to_numpy(); rng = np.random.default_rng(seed)
    idx = rng.integers(0, len(g), size=(n, len(g))); bs = a[idx].sum(1) / b[idx].sum(1)
    return (a.sum() / b.sum(), float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5)))


rows = []
def add(dim, key, d):
    r = dict(dimension=dim, key=key, n=len(d), works=d.work_id.nunique())
    for c in ('neg', 'pos', 'amb', 'personal', 'secondhand'):
        p, l, h = wboot(d, c); r[c] = round(p, 3); r[c + '_lo'] = round(l, 3); r[c + '_hi'] = round(h, 3)
    rows.append(r)
add('all', 'весь корпус', valid)
for dim, col, lab in (('period', 'period', PERIOD_RU), ('observer', 'obs', {'british': 'Великобритания', 'french': 'Франция/Бельгия', 'german': 'Германия/Австрия',
                      'nordic': 'Скандинавия и Финляндия', 'polish': 'Польша', 'south_central': 'Италия, Венгрия, Нидерланды'}), ('stay', 'stay', STAY_RU),
                      ('gender', 'gender', {'m': 'мужчины', 'f': 'женщины'}), ('frame', 'frame', {})):
    for k, d in valid.groupby(col):
        if len(d) >= 8: add(dim, lab.get(k, k), d)
T = pd.DataFrame(rows); T.to_csv(RES / 'expert_v04_estimates.csv', index=False)
print(T[['dimension', 'key', 'n', 'works', 'neg', 'neg_lo', 'neg_hi', 'pos', 'personal', 'secondhand']].to_string())

FR_RU = {'ethno': 'этнографическое описание', 'contact': 'повседневный контакт', 'econ': 'хозяйство и торговля', 'decline': 'упадок, вымирание, болезни',
         'civ': 'иерархия «цивилизованности»', 'relig': 'религия', 'conflict': 'конфликт', 'admin': 'власть и управление', 'other': 'прочее'}
frames = valid.groupby('frame').agg(n=('pid', 'size'), neg=('neg', 'mean'), pos=('pos', 'mean')).round(3)
frames['frame_ru'] = frames.index.map(FR_RU); frames.to_csv(RES / 'expert_v04_frames.csv')
print(frames.to_string())

# модель
valid['brit'] = (valid.obs == 'british').astype(int)
valid['per3'] = np.where(valid.period.isin(['P1 до 1855', 'P2 1856–1880']), 'a_до1880', np.where(valid.period == 'P3 1881–1904', 'b_1881_1904', 'c_после1904'))
valid['transit'] = valid.stay.isin(['transit', 'voyage', 'war']).astype(int)
mod = []
for f in ('neg ~ brit + C(per3) + transit + personal', 'pos ~ brit + C(per3) + transit + personal'):
    try:
        m = smf.glm(f, valid, family=__import__('statsmodels.api').api.families.Binomial(), freq_weights=None).fit(cov_type='cluster', cov_kwds={'groups': pd.factorize(valid.work_id)[0]})
        ci = m.conf_int()
        for k in m.params.index:
            mod.append(dict(model=f, term=k, OR=round(float(np.exp(m.params[k])), 2), lo=round(float(np.exp(ci.loc[k, 0])), 2), hi=round(float(np.exp(ci.loc[k, 1])), 2), p=round(float(m.pvalues[k]), 3)))
    except Exception as e:
        print('model failed', f, e)
MOD = pd.DataFrame(mod); MOD.to_csv(RES / 'expert_v04_models.csv', index=False); print(MOD.to_string())

# отношения
RS = pd.read_csv(ROOT / 'data/expert_v04_rel_sample.csv')
RL = pd.concat([pd.read_csv(f, sep='\t', header=None, names=['i', 'true_type']) for f in sorted(glob.glob(str(ROOT / 'validation/expert_v04_rel_labels_b*.tsv')))]).set_index('i')
RS = RS.join(RL, how='inner')
MAP = {'trade_exchange': 'trade', 'exploitation': 'exploitation', 'conflict': 'conflict', 'intermarriage_mixing': 'mixing', 'assimilation': 'assimilation',
       'administration_tribute': 'admin', 'labour_service': 'labour', 'religious_mission': 'mission', 'coexistence_neighbourhood': 'coexist', 'co_mention': 'none'}
RS['rule'] = RS.rel_type.map(MAP); RS['rule_ok'] = (RS.rule == RS.true_type).astype(int)
typed = RS[RS.rule != 'none']; k = typed.rule_ok.sum(); lo, hi = wilson(k, len(typed))
untyped = RS[RS.rule == 'none']; miss = (untyped.true_type != 'none').mean()
print(f'rule precision on typed {k}/{len(typed)} = {k / len(typed):.2f} [{lo:.2f},{hi:.2f}]; untyped sentences that do carry a relation: {miss:.2f}')
RS.to_csv(ROOT / 'data/expert_relations_v04.csv', index=False)
REL_RU = {'trade': 'торговля', 'exploitation': 'эксплуатация/обман', 'conflict': 'конфликт', 'mixing': 'браки и смешение', 'assimilation': 'обрусение/ассимиляция',
          'admin': 'власть, ясак', 'labour': 'наём, служба, проводники', 'mission': 'миссия', 'coexist': 'соседство', 'colonization': 'колонизация земель',
          'contrast': 'сравнение/противопоставление', 'none': 'нет отношения'}
rp = RS[RS.true_type != 'none'].assign(per=lambda d: np.where(d.period.isin(['P1 до 1855', 'P2 1856–1880']), 'до 1880', 'после 1880'))
prof = (rp.groupby(['per', 'true_type']).size() / rp.groupby('per').size()).round(3).rename('share').reset_index()
prof['type_ru'] = prof.true_type.map(REL_RU); prof.to_csv(RES / 'expert_v04_relation_profile.csv', index=False)
print(prof.pivot(index='type_ru', columns='per', values='share').to_string()); print(rp.groupby('per').size())

jdump('expert_v04.json', dict(validity=dict(units=len(E), invalid=int(inv), share_valid=round(1 - inv / len(E), 3)),
                              estimates=T.to_dict(orient='records'), frames=frames.reset_index().to_dict(orient='records'), models=MOD.to_dict(orient='records'),
                              relations=dict(rule_precision=round(k / len(typed), 3), rule_precision_ci=[round(lo, 3), round(hi, 3)], untyped_with_relation=round(miss, 3),
                                             profile=prof.to_dict(orient='records')),
                              stereotypes=valid[valid.stereotype.str.len() > 0][['work', 'group', 'pol', 'obs_m', 'frame', 'stereotype', 'pid', 'context']].assign(context=lambda d: d.context.str[:300]).to_dict(orient='records'),
                              note='разметчик — языковая модель (один, предварительно); веса страт; ДИ — кластерный бутстреп по книгам'))
