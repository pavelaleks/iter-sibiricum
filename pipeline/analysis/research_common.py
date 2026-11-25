"""Общие загрузчики для исследовательских модулей (07–09)."""
import csv, json, pathlib, re
import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
RES = ROOT / 'analysis/results/research'; RES.mkdir(parents=True, exist_ok=True)
SITE = ROOT / 'site_data/research'; SITE.mkdir(parents=True, exist_ok=True)

PERIODS = [(0, 1855, 'P1 до 1855'), (1856, 1880, 'P2 1856–1880'), (1881, 1904, 'P3 1881–1904'),
           (1905, 1917, 'P4 1905–1917'), (1918, 1940, 'P5 1918–1930')]
PERIOD_RU = {'P1 до 1855': 'до 1855 (Николай I и ранее)', 'P2 1856–1880': '1856–1880 (Амур, реформы)',
             'P3 1881–1904': '1881–1904 (споры о ссылке, Транссиб)', 'P4 1905–1917': '1905–1917 (после 1905 г., переселение)',
             'P5 1918–1930': '1918–1930 (война, плен, Гражданская война)'}
NAT_RU = {'british': 'Великобритания', 'french': 'Франция/Бельгия', 'german': 'Германия/Австрия', 'scandinavian': 'Скандинавия',
          'finnish': 'Финляндия', 'polish': 'Польша', 'italian': 'Италия', 'central_european': 'Венгрия/Центр. Европа', 'dutch': 'Нидерланды'}
STAY_RU = {'transit': 'транзит', 'expedition': 'экспедиция', 'residence': 'долгое проживание', 'exile': 'ссылка', 'pow': 'плен',
           'war': 'война/интервенция', 'voyage': 'морское плавание', 'compilation': 'компиляция'}


def period_of(y):
    for a, b, k in PERIODS:
        if a <= y <= b: return k
    return 'P5 1918–1930'


def works():
    W = pd.read_csv(ROOT / 'data/works.csv')
    M = pd.read_csv(ROOT / 'data/works_meta.csv')
    W = W.drop(columns=[c for c in ('journey_start', 'journey_end') if c in W.columns]).merge(M, on='work_id', how='left')
    W['jy'] = W.journey_start.fillna(W.edition_year - 2).astype(int)
    W['period'] = W.jy.map(period_of)
    W['label'] = W.apply(lambda r: ('de Windt' if r.work_id.startswith('dewindt') else r.author.split(' (')[0].split()[-1]) + f" {int(r.edition_year)}", axis=1)
    W['core'] = W.corpus_role.str.startswith('core')
    return W.set_index('work_id')


def paragraphs(only_text=True):
    rows = []
    for l in open(ROOT / 'corpus/paragraphs.jsonl', encoding='utf-8'):
        r = json.loads(l)
        if only_text and r['type'] != 'text': continue
        rows.append(r)
    return pd.DataFrame(rows)


def groups():
    return pd.read_csv(ROOT / 'data/groups.csv').set_index('group_id')


def jdump(name, obj):
    json.dump(obj, open(SITE / name, 'w', encoding='utf-8'), ensure_ascii=False, default=lambda o: o.item() if hasattr(o, 'item') else str(o))


def wilson(k, n, z=1.96):
    if n == 0: return (0.0, 0.0)
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - h) / d, (c + h) / d)


def cluster_boot(df, value, cluster='work_id', n=1000, seed=1):
    """Доля value (0/1) с 95% ДИ кластерного бутстрепа по книгам: книги — независимые единицы, абзацы внутри книги — нет."""
    g = df.groupby(cluster)[value].agg(['sum', 'count'])
    if len(g) == 0: return (np.nan, np.nan, np.nan)
    s, c = g['sum'].to_numpy(float), g['count'].to_numpy(float)
    rng = np.random.default_rng(seed); idx = rng.integers(0, len(g), size=(n, len(g)))
    boots = s[idx].sum(1) / np.maximum(1, c[idx].sum(1))
    return (s.sum() / c.sum(), float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5)))
