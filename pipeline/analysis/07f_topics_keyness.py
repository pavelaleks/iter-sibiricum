"""07f. Тематическая модель и ключевые слова (английские тексты, абзацы о Сибири).

Темы: NMF (k=18) по TF-IDF абзацев ≥40 слов, где названа коренная группа или «туземцы»; стоп-слова и этнонимы
исключены из словаря (чтобы темы были о содержании, а не о народе). Тема абзаца — максимальный вес.
Доля тем по периодам и типам пребывания; ДИ — кластерный бутстреп по книгам. Подписи тем даны вручную
по 15 верхним словам (поле label_ru), их нужно перепроверить специалисту.
Ключевые слова: log-likelihood (G²) слов в окнах упоминаний коренных групп у британцев (против всех остальных
английских текстов — переводов) и по периодам (период против остальных).
"""
import re, math, collections
import numpy as np, pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import NMF
from research_common import ROOT, RES, SITE, works, groups, paragraphs, jdump, cluster_boot, PERIOD_RU, STAY_RU

W = works(); G = groups()
P = paragraphs(); P = P[P.in_siberia & (P.words >= 40)]
P = P[P.work_id.map(W.text_language) == 'en']
M = pd.read_csv(ROOT / 'data/mentions.csv', usecols=['pid', 'group_id', 'form'])
cat = M.group_id.map(G.category)
ind = set(M[cat.isin(['indigenous', 'generic'])].pid)
U = P[P.pid.isin(ind)].copy()
ETH = set(t.lower() for f in M.form.unique() for t in re.findall(r"[A-Za-z]+", f))
STOP = 'english'
vec = TfidfVectorizer(max_df=0.4, min_df=8, stop_words=STOP, token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z]{2,}\b", max_features=12000)
X = vec.fit_transform(U.text)
voc = np.array(vec.get_feature_names_out())
keep = np.array([w not in ETH and w not in {'siberia', 'siberian', 'russian', 'russians', 'natives', 'native', 'tribe', 'tribes', 'people', 'country', 'said', 'did', 'like', 'great', 'little', 'time', 'way', 'long', 'good', 'old'} for w in voc])
X = X[:, keep]; voc = voc[keep]
K = 18
nmf = NMF(n_components=K, random_state=1, init='nndsvda', max_iter=400)
Wt = nmf.fit_transform(X); H = nmf.components_
top = [list(voc[np.argsort(-H[k])[:15]]) for k in range(K)]
for k in range(K): print(k, ' '.join(top[k]))
U['topic'] = Wt.argmax(1); U['topic_w'] = Wt.max(1)
U['period'] = U.work_id.map(W.period); U['stay'] = U.work_id.map(W.stay_type)
rows = []
for dim, col, lab in (('period', 'period', PERIOD_RU), ('stay', 'stay', STAY_RU)):
    for key, d in U.groupby(col):
        if d.work_id.nunique() < 3: continue
        for k in range(K):
            p, lo, hi = cluster_boot(d.assign(v=(d.topic == k).astype(int)), 'v')
            rows.append(dict(dimension=dim, key=lab.get(key, key), topic=k, share=round(p, 4), lo=round(lo, 4), hi=round(hi, 4), paragraphs=len(d)))
T = pd.DataFrame(rows); T.to_csv(RES / 'topics_shares.csv', index=False)
ex = []
for k in range(K):
    for r in U[U.topic == k].nlargest(3, 'topic_w').itertuples():
        ex.append(dict(topic=k, pid=r.pid, work=W.loc[r.work_id, 'label'], text=r.text[:300] + '…'))
pd.DataFrame(dict(topic=range(K), top_words=[' '.join(t) for t in top])).to_csv(RES / 'topics_words.csv', index=False)
U[['pid', 'work_id', 'topic', 'topic_w']].to_csv(RES / 'topics_paragraphs.csv', index=False)
print((T[T.dimension == 'period'].pivot(index='topic', columns='key', values='share') * 100).round(1).to_string())

# ключевые слова в окнах коренных групп: британцы против переводов; периоды
TOK = re.compile(r"[a-z]+")
STOPW = set(vec.get_stop_words()) | ETH
def window_counts(df):
    c = collections.Counter()
    mm = M[M.pid.isin(set(df.pid)) & cat.isin(['indigenous', 'generic'])]
    T_ = df.set_index('pid').text
    for pid, forms in mm.groupby('pid').form:
        t = T_[pid].lower()
        for f in set(forms):
            for m in re.finditer(re.escape(f.lower()), t):
                for w in TOK.findall(t[max(0, m.start() - 60):m.end() + 60]):
                    if w not in STOPW and len(w) > 2: c[w] += 1
    return c
def ll_table(a, b, name, n=40):
    A, B = sum(a.values()), sum(b.values()); out = []
    for w in set(a) | set(b):
        x, y = a[w], b[w]
        if x + y < 10: continue
        e1 = A * (x + y) / (A + B); e2 = B * (x + y) / (A + B)
        g2 = 2 * ((x * math.log(x / e1) if x else 0) + (y * math.log(y / e2) if y else 0))
        out.append(dict(contrast=name, word=w, a=x, b=y, a_per10k=round(x / A * 1e4, 1), b_per10k=round(y / B * 1e4, 1), g2=round(g2, 1), direction='+' if x / A > y / B else '-'))
    d = pd.DataFrame(out); return d[d.direction == '+'].nlargest(n, 'g2')
U['nat'] = U.work_id.map(W.nat_group)
kw = [ll_table(window_counts(U[U.nat == 'british']), window_counts(U[U.nat != 'british']), 'британцы против переводов')]
for per in sorted(U.period.unique()):
    kw.append(ll_table(window_counts(U[U.period == per]), window_counts(U[U.period != per]), PERIOD_RU[per]))
KW = pd.concat(kw); KW.to_csv(RES / 'keyness.csv', index=False)
for name, d in KW.groupby('contrast', sort=False): print(name, '|', ', '.join(d.word.head(20)))
jdump('topics.json', dict(k=K, top_words=top, shares=T.to_dict(orient='records'), examples=ex,
                          note='NMF по англ. абзацам о Сибири с упоминанием коренных народов; подписи тем — ручные, требуют проверки'))
jdump('keyness.json', KW.to_dict(orient='records'))
