"""08. Новая экспертная выборка по всему корпусу (v0.4).

A. Описания (250 единиц «абзац × группа»): абзацы о Сибири, ≥25 слов, коренная группа или обобщённые «туземцы»,
   только основные книги (core). Страты: группа наблюдателей × период. Цель — одинаковое число в каждой страте
   (не больше доступного), остаток добирается случайно; не больше 6 единиц из одной книги.
   Вес единицы = (единиц в страте в генеральной совокупности) / (единиц страты в выборке) — для оценок по корпусу.
B. Отношения (100 предложений): предложения, где коренная группа названа вместе с русскими, казаками,
   переселенцами или ссыльными, в абзацах о Сибири, основные книги; 75 с маркером типа отношения и 25 без него.
Файлы для разметки: validation/expert_v04_desc_b{1..5}.tsv и validation/expert_v04_rel_b{1..2}.tsv.
"""
import math
import numpy as np, pandas as pd
from research_common import ROOT, works, groups

W = works(); G = groups()
A = pd.read_csv(ROOT / 'data/annotations.csv')
A = A[(A.in_siberia.astype(str) == 'True') & A.category.isin(['indigenous', 'generic'])]
A = A[A.work_id.map(W.core) == True]
A['words'] = A.context.str.split().str.len()
A = A[A.words >= 20]
A['obs'] = A.work_id.map(W.nat_group).replace({'scandinavian': 'nordic', 'finnish': 'nordic', 'italian': 'south_central', 'central_european': 'south_central', 'dutch': 'south_central'})
A['period'] = A.work_id.map(W.period)
A['stratum'] = A.obs + '|' + A.period
rng = np.random.default_rng(2026)
pop = A.stratum.value_counts()
TARGET = 250; per = math.ceil(TARGET / len(pop))
picked = []
for s, d in A.groupby('stratum'):
    d = d.sample(frac=1, random_state=int(rng.integers(1e9)))
    d = d.groupby('work_id').head(6)
    picked.append(d.head(per))
S = pd.concat(picked)
rest = A[~A.unit_id.isin(S.unit_id)]
rest = rest[rest.work_id.map(S.work_id.value_counts()).fillna(0) < 6]
S = pd.concat([S, rest.sample(max(0, TARGET - len(S)), random_state=7)]).head(TARGET)
S['weight'] = S.stratum.map(pop) / S.stratum.map(S.stratum.value_counts())
S = S.sample(frac=1, random_state=3).reset_index(drop=True)
S['group'] = S.group_id.map(G.name_ru); S['work'] = S.work_id.map(W.label)
S[['unit_id', 'pid', 'work_id', 'work', 'group_id', 'group', 'obs', 'period', 'stratum', 'weight', 'polarity', 'obs_type', 'context']].to_csv(ROOT / 'data/expert_v04_sample.csv', index=False)
for i in range(5):
    b = S.iloc[i * 50:(i + 1) * 50]
    with open(ROOT / f'validation/expert_v04_desc_b{i + 1}.tsv', 'w', encoding='utf-8') as f:
        for r in b.itertuples():
            f.write(f"{r.Index}\t{r.work}\t{r.group}\t{r.context[:900].replace(chr(10), ' ').replace(chr(9), ' ')}\n")
print(S.stratum.value_counts().to_string()); print('works', S.work_id.nunique())

R = pd.read_csv(ROOT / 'data/relations.csv')
R = R[(R.in_siberia.astype(str) == 'True') & (R.work_id.map(W.core) == True)]
ca, cb = R.group_a.map(G.category), R.group_b.map(G.category)
other = {'russian', 'cossack', 'pereselentsy', 'exiles', 'political_exiles', 'sibiriak', 'old_believer'}
mask = ((ca == 'indigenous') & R.group_b.isin(other)) | ((cb == 'indigenous') & R.group_a.isin(other))
R = R[mask & (R.sentence.str.split().str.len().between(8, 120))].drop_duplicates('sentence')
RS = pd.concat([R[R.rel_type != 'co_mention'].sample(75, random_state=5), R[R.rel_type == 'co_mention'].sample(25, random_state=5)]).sample(frac=1, random_state=1).reset_index(drop=True)
RS['work'] = RS.work_id.map(W.label); RS['period'] = RS.work_id.map(W.period)
RS['ga'] = RS.group_a.map(G.name_ru); RS['gb'] = RS.group_b.map(G.name_ru)
RS.to_csv(ROOT / 'data/expert_v04_rel_sample.csv', index=False)
for i in range(2):
    b = RS.iloc[i * 50:(i + 1) * 50]
    with open(ROOT / f'validation/expert_v04_rel_b{i + 1}.tsv', 'w', encoding='utf-8') as f:
        for r in b.itertuples():
            f.write(f"{r.Index}\t{r.work}\t{r.ga} / {r.gb}\t[{r.rel_type}]\t{r.sentence[:600].replace(chr(10), ' ').replace(chr(9), ' ')}\n")
print('relations sample', len(RS), RS.work_id.nunique(), 'works')
