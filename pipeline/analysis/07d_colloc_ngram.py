"""07d. Коллокации по этносам и Ngram-датасет.

Коллокации: для каждого упоминания группы в абзаце о Сибири берётся окно ±5 слов (без самого этнонима).
  f_xy — сколько раз слово y встретилось в окне группы x; f_x — число упоминаний группы; f_y — частота слова
  во всех абзацах о Сибири на этом языке. Меры: logDice = 14 + log2(2·f_xy/(f_x+f_y)) (не зависит от размера
  корпуса) и log-likelihood G² (значимость). Фильтры: f_xy ≥ 5, слово встречается в окнах ≥ 3 книг, стоп-слова
  исключены. Для каждой коллокации — абзац-пример. Разрезы: язык × группа; для английского ещё период.
Ngram:
  ngram_ethnonyms.csv — упоминания групп по году издания и десятилетию поездки, языку и стране автора,
     с числом слов-знаменателем (частота на миллион слов считается на сайте);
  ngram_markers.csv — то же для слов-маркеров дискурса (savage, civilised, extinct, Russified, …);
  ngram_en_siberia.csv.gz — 1–3-граммы абзацев о Сибири (англ.) по году издания, частота ≥ 30 во всём корпусе.
"""
import re, math, gzip, collections
import numpy as np, pandas as pd
from research_common import ROOT, RES, SITE, works, groups, paragraphs, jdump, PERIOD_RU

W = works(); G = groups()
P = paragraphs(); P = P[P.in_siberia].set_index('pid')
P['lang'] = P.work_id.map(W.text_language)
M = pd.read_csv(ROOT / 'data/mentions.csv', usecols=['pid', 'work_id', 'group_id', 'form', 'start', 'end', 'in_siberia'])
M = M[(M.in_siberia.astype(str) == 'True') & M.pid.isin(P.index)]
M['lang'] = M.work_id.map(W.text_language)

STOP = {
 'en': set("""a an the and or but if of to in on at by for with from into onto upon as is are was were be been being am do does did have has had
   having it its it's this that these those there here which who whom whose what when where why how not no nor so than then too very can could
   would should will shall may might must i me my we us our you your he him his she her they them their one two three all any some such each
   other another more most much many few own same also only just even about over under after before again further once out up down off
   s t said says say like upon whilst while though although because between through during without within among amongst towards toward per
   whom whose ever never yet still quite rather mr mrs dr st""".split()),
 'fr': set("""le la les l un une des de du d et ou mais si à au aux en dans par pour sur sous avec sans que qui quoi dont où ne pas plus
   ce cet cette ces c il elle ils elles on nous vous je j me m se s son sa ses leur leurs lui y est sont était étaient été être avoir a ont
   avait avaient fait comme tout tous toute toutes très bien aussi même autre autres entre chez dont puis alors encore mon ma mes notre nos""".split()),
 'de': set("""der die das den dem des ein eine einer eines einem einen und oder aber wenn als wie in im an am auf aus bei mit nach von vom
   zu zum zur für über unter vor durch gegen ohne um bis ist sind war waren sein seine seiner seinen ihr ihre ihren ihrer es er sie wir
   ich man sich nicht auch noch nur so da dann doch schon sehr hat haben hatte hatten wird werden wurde wurden kann können diese dieser
   dieses diesen welche welcher welches alle aller allen andere anderen einige viel viele mehr dass daß bereits sogenannten sog wohl ganz jedoch immer wieder""".split()),
}
TOK = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", re.U)
def toks(s): return [t.lower() for t in TOK.findall(s)]

# частоты слов по языкам (знаменатели)
fy = {lg: collections.Counter() for lg in ('en', 'fr', 'de')}
N = collections.Counter()
for pid, r in P.iterrows():
    if r.lang in fy:
        t = toks(r.text); fy[r.lang].update(t); N[r.lang] += len(t)

def ll(a, b, c, d):
    """G² для таблицы 2×2: a=f_xy, b=f_x-a, c=f_y-a, d=N-a-b-c."""
    n = a + b + c + d; e = [(a + b) * (a + c) / n, (a + b) * (b + d) / n, (c + d) * (a + c) / n, (c + d) * (b + d) / n]
    return 2 * sum(o * math.log(o / ee) for o, ee in zip((a, b, c, d), e) if o > 0 and ee > 0)

ETH_TOK = set()
for f in M.form.unique(): ETH_TOK.update(toks(f))

win = collections.defaultdict(collections.Counter); win_w = collections.defaultdict(lambda: collections.defaultdict(set))
ex = {}; fx = collections.Counter()
for m in M[M.lang.isin(fy)].itertuples():
    t = P.at[m.pid, 'text']; L = toks(t[:m.start])[-5:]; R = toks(t[m.end:])[:5]
    key = (m.lang, m.group_id); fx[key] += 1
    per = W.at[m.work_id, 'period']
    for y in L + R:
        if y in STOP[m.lang] or len(y) < 3 or y in ETH_TOK: continue
        win[key][y] += 1; win_w[key][y].add(m.work_id); ex.setdefault((key, y), m.pid)
        if m.lang == 'en': win[('en@' + per, m.group_id)][y] += 1; win_w[('en@' + per, m.group_id)][y].add(m.work_id)

rows = []
for (lg, g), c in win.items():
    base = lg.split('@')[0]; NN = N[base]; fxx = sum(c.values()) / 10 if '@' in lg else fx[(lg, g)]
    for y, a in c.items():
        mn, mw = (5, 3) if base == 'en' else (3, 2)          # меньше текстов на fr/de — мягче порог
        if a < mn or len(win_w[(lg, g)][y]) < mw: continue
        fyy = fy[base][y]; fxn = fx.get((base, g), fxx)
        rows.append(dict(slice=lg, lang=base, period=lg.split('@')[1] if '@' in lg else '', group_id=g, group=G.loc[g, 'name_ru'],
                         collocate=y, f_xy=a, f_x=fxn, f_y=fyy, works=len(win_w[(lg, g)][y]),
                         logdice=round(14 + math.log2(2 * a / (fxn + fyy)), 2), ll=round(ll(a, max(0, fxn * 10 - a), max(0, fyy - a), NN), 1),
                         example_pid=ex.get(((lg, g), y), '')))
C = pd.DataFrame(rows)
C = C[C.ll >= 10.83]                                   # p < 0.001
C = C.sort_values(['slice', 'group_id', 'logdice'], ascending=[True, True, False])
C.to_csv(RES / 'collocations_by_group.csv', index=False)
top = C.groupby(['slice', 'group_id']).head(25)
jdump('collocations.json', dict(note='окно ±5 слов, logDice; p<0.001 по G²; ≥5 совпадений в ≥3 книгах',
                                rows=top[['slice', 'lang', 'period', 'group_id', 'group', 'collocate', 'f_xy', 'works', 'logdice', 'll', 'example_pid']].to_dict(orient='records')))
for g in ['khanty', 'sakha', 'buryat', 'chukchi', 'kazakh_kirghiz', 'samoyedic', 'evenki_even', 'russian', 'exiles', 'cossack', 'chinese', 'siberian_tatar']:
    d = C[(C.slice == 'en') & (C.group_id == g)].head(18)
    print(G.loc[g, 'name_ru'], '|', ', '.join(f"{r.collocate}({r.f_xy})" for r in d.itertuples()))
for g in ['khanty', 'sakha', 'buryat', 'kazakh_kirghiz']:
    for lg in ('fr', 'de'):
        d = C[(C.slice == lg) & (C.group_id == g)].head(12)
        print(lg, G.loc[g, 'name_ru'], '|', ', '.join(f"{r.collocate}({r.f_xy})" for r in d.itertuples()))

# ---------- Ngram: этнонимы ----------
Pall = paragraphs(); Pall = Pall[Pall.in_siberia]
wy = Pall.groupby('work_id').words.sum()
meta = W[['edition_year', 'jy', 'text_language', 'nat_group', 'period']].copy(); meta['words_siberia'] = wy
meta['decade'] = (meta.jy // 10) * 10
E = M.groupby(['work_id', 'group_id']).size().rename('mentions').reset_index().merge(meta, left_on='work_id', right_index=True)
E['group'] = E.group_id.map(G.name_ru)
E.to_csv(RES / 'ngram_ethnonyms.csv', index=False)
den = meta.reset_index()[['work_id', 'edition_year', 'decade', 'text_language', 'nat_group', 'words_siberia']]
den.to_csv(RES / 'ngram_denominators.csv', index=False)
by_dec = E.groupby(['decade', 'group']).mentions.sum().unstack(fill_value=0)
wd = meta.groupby('decade').words_siberia.sum()
pm = (by_dec.div(wd, axis=0) * 1e6).round(1)
print((pm[[c for c in pm.columns if pm[c].sum() > 300]]).to_string())

# ---------- Ngram: маркеры ----------
MARK = {
 'savage(s)': r"\bsavages?\b", 'barbarous/barbarian': r"\bbarbar(?:ous|ians?)\b", 'primitive': r"\bprimitive\b", 'civilised/civilized': r"\bcivili[sz]ed\b",
 'uncivilised': r"\buncivili[sz]ed\b", 'civilisation': r"\bcivili[sz]ation\b", 'race(s)': r"\braces?\b", 'tribe(s)': r"\btribes?\b",
 'natives': r"\bnatives\b", 'aborigines': r"\baborigin(?:es|als?)\b", 'inorodtsy': r"\binorod[tz]\w*|\binorodets\b",
 'extinct/dying out': r"\bextinct\b|\bdying out\b|\bdie out\b", 'Russified': r"\bRussifi\w+|\bRussiani[sz]\w+", 'half-breed': r"\bhalf-?breeds?\b|\bhalf-?castes?\b",
 'exile(s)': r"\bexiles?\b", 'convict(s)': r"\bconvicts?\b", 'settler(s)/colonist(s)': r"\bsettlers?\b|\bcolonists?\b", 'shaman': r"\bshaman\w*|\bschaman\w*",
 'yasak/tribute': r"\byasak\b|\biassak\b|\btribute\b", 'vodka': r"\bvodka\b|\bbrandy\b",
 'sauvages (fr)': r"\bsauvages?\b", 'civilisation (fr)': r"\bcivilisation\b", 'indigènes (fr)': r"\bindigènes?\b",
 'Wilde (de)': r"(?-i:\bWilde[nr]?\b)", 'Kultur (de)': r"\bKultur\b", 'Eingeborene (de)': r"\bEingeboren\w*",
}
MRX = {k: re.compile(v, re.I) for k, v in MARK.items()}
rows = []
for w, d in Pall.groupby('work_id'):
    txt = '\n'.join(d.text)
    for k, rx in MRX.items():
        n = len(rx.findall(txt))
        if n: rows.append(dict(work_id=w, marker=k, count=n))
MK = pd.DataFrame(rows).merge(meta, left_on='work_id', right_index=True)
MK.to_csv(RES / 'ngram_markers.csv', index=False)
en_w = meta[meta.text_language == 'en'].groupby('decade').words_siberia.sum()
mk = MK[MK.text_language == 'en'].groupby(['decade', 'marker'])['count'].sum().unstack(fill_value=0)
print((mk.div(en_w, axis=0) * 1e6).round(0).to_string())

# ---------- Ngram: 1–3-граммы (англ., абзацы о Сибири) ----------
cnt = collections.Counter(); by = collections.defaultdict(collections.Counter)
EN = Pall[Pall.work_id.map(W.text_language) == 'en']
for r in EN.itertuples():
    t = toks(r.text); y = int(W.at[r.work_id, 'edition_year'])
    for n in (1, 2, 3):
        for i in range(len(t) - n + 1):
            g = ' '.join(t[i:i + n]); by[g][y] += 1
for g, c in by.items():
    s = sum(c.values())
    if s >= 30: cnt[g] = s
with gzip.open(RES / 'ngram_en_siberia.csv.gz', 'wt', encoding='utf-8') as f:
    f.write('ngram,n,year,count\n')
    for g in cnt:
        for y, c in sorted(by[g].items()): f.write(f'"{g}",{g.count(" ") + 1},{y},{c}\n')
yw = EN.assign(y=EN.work_id.map(W.edition_year)).groupby('y').words.sum()
yw.rename('words').to_csv(RES / 'ngram_en_year_totals.csv')
# компактная версия для сайта: этнонимы и маркеры + 2–3-граммы с этнонимами
keep = [g for g in cnt if (set(g.split()) & ETH_TOK) or any(MRX[k].fullmatch(g) for k in MRX)]
keep = sorted(keep, key=lambda g: -cnt[g])[:2500]
jdump('ngram_en.json', dict(year_totals={int(k): int(v) for k, v in yw.items()}, ngrams={g: {int(y): int(c) for y, c in by[g].items()} for g in keep},
                            note='абзацы о Сибири, английские тексты; год — год издания; частота на миллион = count / year_totals × 1e6'))
print('ngrams kept', len(cnt), 'site', len(keep))
