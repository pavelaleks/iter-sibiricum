"""07c. Детекторы дискурсов о межэтнических отношениях.

Единица — абзац о Сибири, где названа хотя бы одна коренная группа (или обобщённые «туземцы»).
Дискурс — семейство многоязычных регулярных выражений; абзац отмечается, если есть хотя бы одно совпадение.
Распространённость = доля таких абзацев; 95% ДИ — кластерный бутстреп по книгам.
Разрезы: период поездки, страна автора, тип пребывания, пол автора; плюс доля по группам.
Для проверки точности — выборка по 10 абзацев на дискурс (validation/discourse_sample.csv).
"""
import re
import numpy as np, pandas as pd
from research_common import ROOT, RES, SITE, works, groups, paragraphs, jdump, cluster_boot, PERIOD_RU, NAT_RU, STAY_RU

D = {
 'extinction': ('«вымирание» народов', [
    r"\bdying[- ]out\b|\bdie out\b|\bdying race\b|\bdisappearing\b|\bextinct(?:ion)?\b|\b(?:are|is) dying\b|\bdecreas\w+ in numbers?\b|\bdwindl\w+|\bdoomed (?:race|people|tribe)s?\b|\bfast disappear\w*|\brace (?:is|are) passing\b",
    r"\bs'?\s?éteign\w*|\bs'?\s?éteindre\b|\bextinction\b|\bdispara(?:ître|issent|ît|ition)\b|\brace (?:qui )?s'en va\b|\bdiminu\w+ (?:rapidement|chaque)\b",
    r"\baussterb\w*|\bausgestorben\b|\bim Aussterben\b|\bAbnahme der Bevölkerung\b|\bdem Untergang (?:geweiht|entgegen)\b",
    r"\bestin(?:ti|zione)\b|\bscompa(?:rire|iono|rsa)\b|\buddø\w*|\bforsvind\w*|\bdø ud\b|\bwymier\w*|\bwymarł\w*|\bvymír\w*|\bvymřel\w*|\bkuolee sukupuuttoon\b|\bsukupuut\w+|\bhäviä\w*|\bkuoleva\w*"]),
 'civ_hierarchy': ('иерархия «цивилизованности»', [
    r"\bsavages?\b(?! (?:dogs?|beasts?|animals?|wolf|wolves|bears?|scenery|country|mountains?|gorge|cold|wind|storm|grandeur|growl|brutes?|yells?|cry|cries|fury|attack))|\bbarbar(?:ous|ian|ians|ism)\b|\bprimitive (?:races?|peoples?|tribes?|man|men|state|condition|people)\b|\buncivili[sz]ed\b|\bsemi-?civili[sz]ed\b|\bhalf-?civili[sz]ed\b|\b(?:higher|lower|inferior|superior) (?:race|races|type|stage)\b|\bstage of civili[sz]ation\b|\bchildren of nature\b|\bchildlike\b",
    r"\bsauvages?\b|\bbarbares?\b|\bprimitifs?\b|\bdemi-?civilisés?\b|\brace (?:inférieure|supérieure)\b|\bétat de nature\b|\benfants de la nature\b",
    r"(?-i:\b(?:die|der|den|diese[nr]?|solche[nr]?|eines?|einem) Wilden?\b|\bWilde[nr]\b)|\bhalbwild\w*|\bNaturv[öo]lk\w*|\bNaturkinder?\b|\bunkultiviert\w*|\bunzivilisiert\w*|\bniedere[nr]? Kulturstufe\b|\bBarbar\w*|\bprimitive[nr]? (?:Völker|Volk|Stämme|Menschen)\b",
    r"\bselvagg\w+|\bbarbar\w+|\bprimitiv\w+ (?:folk|Folk|popol\w+|ludy|ludzie|národ\w*|kansa\w*)\b|\bvilde\b|\bvildmænd\b|\bnaturfolk\w*|\bdzik\w+\b|\bbarbarzyń\w*|\bdivoch\w*|\bprimitivn\w*|\bvillei\w*|\bpuolivilli\w*|\bluonnonkansa\w*"]),
 'colonial_comparison': ('сравнение с колониями и индейцами', [
    r"\b(?:Red|North American|American) Indians?\b|\bRedskins?\b|\bIndians of (?:North )?America\b|\bnegro(?:es)?\b|\bHottentots?\b|\bAustralian (?:aborigines|natives|blacks)\b|\bMaoris?\b|\bEskimos? of (?:Greenland|Canada)\b|\bour Indian (?:Empire|subjects)\b|\bBritish India\b|\bAfrican (?:tribes|natives)\b",
    r"\bPeaux-?Rouges\b|\bIndiens? d'Amérique\b|\bIndiens? de l'Amérique\b|\bnègres?\b|\bHottentots?\b|\bnos colonies\b|\bl'Algérie\b|\bArabes d'Algérie\b",
    r"\bRothäute\b|\bIndianer\w*|\bNeger\w*|\bHottentotten\b|\bunsere[nr]? Kolonien\b",
    r"\bpellirosse\b|\bpelli rosse\b|\bindiani d'America\b|\bindianer\w*|\brødhud\w*|\bIndian\w* (?:amerykańsk\w+|Ameryki)\b|\bIndián\w*|\bintiaan\w*|\bneekeri\w*"]),
 'russification': ('обрусение, смешение, «отуземливание» русских', [
    r"\bRussifi\w+|\bRussiani[sz]\w+|\badopted (?:the )?Russian\b|\bhalf-?breeds?\b|\bhalf-?castes?\b|\bmixed (?:blood|race|marriages?)\b|\bintermarr\w+|\bgone native\b|\b(?:Buriat|Yakut|Ostiak|Tartar)i[sz]ed\b|\bbecome (?:quite )?(?:Yakut|Buriat|Tungus|native)s?\b|\bforgotten their (?:own )?(?:language|tongue|customs)\b",
    r"\brussifi\w+|\bmétis\b|\bmétissage\b|\bsang mêlé\b|\bmariages? mixtes?\b|\boublié leur langue\b|\badopté (?:la langue|les mœurs)\b",
    r"\brussifizi\w+|\bMischling\w*|\bMischehe\w*|\bMischvolk\b|\bvermischt\w* sich\b|\bsich\b.{0,40}\bvermischt\w*|\bihre Sprache vergessen\b|\bdie Sitten der\b",
    r"\brussific\w+|\bmeticc\w+|\bsangue misto\b|\brussificer\w*|\bblandet\b|\bblanding\w*|\bmetis\w*|\bzruszcz\w*|\bzmoskwicz\w*|\bmieszań\w+|\bpoруš\w*|\bpoštěn\w*|\bmíšen\w*|\bvenäläisty\w*|\bsekarotu\w*|\bsekaveri\w*"]),
 'vodka_trade': ('водка, торговцы и долги', [
    r"\b(?:vodka|brandy|spirits|rum|alcohol|liquor)\b.{0,160}\b(?:trader|merchant|barter|fur|sable|skins?|debt|cheat)\w*|\b(?:trader|merchant)s?\b.{0,160}\b(?:vodka|brandy|spirits|liquor)\b|\bin (?:their )?debt\b|\bhopelessly in debt\b|\bfleece\w*",
    r"\beau-de-vie\b.{0,160}\b(?:marchand|fourrure|zibeline|peaux|dette)\w*|\bmarchands?\b.{0,160}\beau-de-vie\b|\bendett\w+",
    r"\bBranntwein\b.{0,160}\b(?:Händler|Kaufleute|Pelz|Zobel|Schuld)\w*|\bHändler\w*\b.{0,160}\bBranntwein\b|\bverschuldet\b|\bSchuldknechtschaft\b",
    r"\bacquavite\b.{0,160}\bmercant\w+|\bbrændevin\b.{0,160}\b(?:handel|købmænd|gæld)\w*|\bwódk\w+\b.{0,160}\bkup\w+|\bkořal\w*.{0,160}\bobchod\w*|\bviina\w*\b.{0,160}\bkauppi\w*"]),
 'mission': ('крещение и миссия', [
    r"\bbaptiz\w+|\bbaptis\w+|\bconver(?:ts|ted|ting|sion)\b(?! (?:into|to cash))|\bmissionar(?:y|ies)\b(?! (?:of|from) the (?:Emperor|Tsar|Government))|\bOrthodox (?:missionar\w+|priests? (?:baptiz|convert)\w*)\b|\bchristiani[sz]\w+|\bnominally Christian\b",
    r"\bbaptis\w+|\bconverti\w*|\bmissionnaires?\b|\borthodox\w*|\bévangélis\w*",
    r"\bgetauft\b|\bTaufe\b|\bbekehrt\w*|\bMissionar\w*|\bMissionsstation\w*",
    r"\bbattezz\w+|\bconvertit\w+|\bmissionar\w+|\bdøbt\w*|\bomvendt\w* til\b|\bmissionær\w*|\bochrzczen\w* (?:Ostiak|Samojed|Tungu|Jaku|Buria|krajowc|tubylc)\w*|\bnawróc\w*|\bmisjonar\w*|\bpokřt\w*|\bmisionář\w*|\bkastet\w*|\bkäännyt\w*|\blähetyssaarnaaj\w*"]),
 'civilizing_colonization': ('колонизация как «цивилизаторская миссия»', [
    r"\bcivili[sz]ing (?:influence|mission|power|work)\b|\b(?:spread|bring|brought|carry) (?:of )?civili[sz]ation\b|\bpioneers? of civili[sz]ation\b|\bRussia's (?:mission|work) in Asia\b|\bthe march of civili[sz]ation\b|\bcolonizing (?:power|genius)\b",
    r"\bmission civilisatrice\b|\boeuvre civilisatrice\b|\bœuvre civilisatrice\b|\bla civilisation (?:russe|européenne)\b|\bgénie colonisateur\b|\bpionniers? de la civilisation\b",
    r"\bKulturmission\b|\bKulturträger\w*|\bzivilisatorisch\w*|\bKolonisationsarbeit\b|\bPioniere? der Kultur\b",
    r"\bmissione civilizzatrice\b|\bopera civilizzatrice\b|\bcivilisatorisk\w*|\bkulturbærer\w*|\bmisj\w+ cywilizacyjn\w*|\bkulturní poslání\b|\bsivistystyö\w*"]),
 'exile_native': ('ссыльные среди коренных', None),   # по совместному упоминанию групп в абзаце
}
DLAB = {k: v[0] for k, v in D.items()}
LANG_IDX = {'en': 0, 'fr': 1, 'de': 2}   # остальные языки (it, da, no, pl, cs, fi) — четвёртый набор
RXL = {k: [re.compile(p, re.I | re.S) for p in v[1]] for k, v in D.items() if v[1]}
RX = {k: re.compile('|'.join(f'(?:{p})' for p in v[1]), re.I | re.S) for k, v in D.items() if v[1]}  # только для поиска цитаты в примерах

W = works(); G = groups()
P = paragraphs(); P = P[P.in_siberia]
M = pd.read_csv(ROOT / 'data/mentions.csv', usecols=['pid', 'group_id', 'in_siberia'])
M = M[M.in_siberia.astype(str) == 'True']
cat = M.group_id.map(G.category)
ind_pids = set(M[cat.isin(['indigenous', 'generic'])].pid)
exile_pids = set(M[M.group_id.isin(['exiles', 'political_exiles'])].pid)
groups_by_pid = M[cat.isin(['indigenous', 'generic'])].groupby('pid').group_id.agg(lambda s: sorted(set(s)))
U = P[P.pid.isin(ind_pids)].copy()
U['lang'] = U.work_id.map(W.text_language)
for k, rxs in RXL.items():
    U[k] = [int(bool(rxs[LANG_IDX.get(lg, 3)].search(t))) for t, lg in zip(U.text, U.lang)]
U['exile_native'] = U.pid.isin(exile_pids).astype(int)
for c in ('period', 'nat_group', 'stay_type', 'gender', 'core'):
    U[c] = U.work_id.map(W[c])
U = U[U.core == True]
print('units', len(U), 'works', U.work_id.nunique())

rows = []
def add(dim, key, d):
    for k in DLAB:
        p, lo, hi = cluster_boot(d, k)
        rows.append(dict(dimension=dim, key=key, discourse=k, discourse_ru=DLAB[k], paragraphs=len(d), works=d.work_id.nunique(),
                         share=round(p, 4), lo=round(lo, 4), hi=round(hi, 4)))
add('all', 'весь корпус', U)
for dim, lab in (('period', PERIOD_RU), ('nat_group', NAT_RU), ('stay_type', STAY_RU), ('gender', {'m': 'мужчины', 'f': 'женщины'})):
    for key, d in U.groupby(dim):
        if d.work_id.nunique() >= 3: add(dim, lab.get(key, key), d)
T = pd.DataFrame(rows); T.to_csv(RES / 'discourse_prevalence.csv', index=False)

# по группам: в абзацах о какой группе встречается дискурс
E = U.join(groups_by_pid, on='pid').explode('group_id')
grow = []
for g, d in E.groupby('group_id'):
    if d.work_id.nunique() < 8: continue
    for k in DLAB:
        p, lo, hi = cluster_boot(d, k)
        grow.append(dict(group=G.loc[g, 'name_ru'], group_id=g, discourse=k, discourse_ru=DLAB[k], paragraphs=len(d), works=d.work_id.nunique(), share=round(p, 4), lo=round(lo, 4), hi=round(hi, 4)))
TG = pd.DataFrame(grow); TG.to_csv(RES / 'discourse_by_group.csv', index=False)

# примеры и выборка для проверки
ex, val = [], []
for k in RX:
    hit = U[U[k] == 1]
    for r in hit.sample(min(10, len(hit)), random_state=5).itertuples():
        m = RXL[k][LANG_IDX.get(r.lang, 3)].search(r.text); s = max(0, m.start() - 220)
        val.append(dict(discourse=k, pid=r.pid, match=m.group(0)[:80], context=r.text[s:m.end() + 220].replace('\n', ' ')))
    for r in hit.sample(min(25, len(hit)), random_state=9).itertuples():
        m = RXL[k][LANG_IDX.get(r.lang, 3)].search(r.text); s = max(0, m.start() - 260)
        ex.append(dict(discourse=k, discourse_ru=DLAB[k], pid=r.pid, work=W.loc[r.work_id, 'label'], period=PERIOD_RU[r.period],
                       quote=('…' if s else '') + r.text[s:m.end() + 260].replace('\n', ' ') + '…'))
pd.DataFrame(val).to_csv(ROOT / 'validation/discourse_sample.csv', index=False)
U[['pid', 'work_id'] + list(DLAB)].to_csv(RES / 'discourse_units.csv', index=False)
jdump('discourse.json', dict(labels=DLAB, prevalence=T.to_dict(orient='records'), by_group=TG.to_dict(orient='records'), examples=ex,
                             note='доля абзацев о Сибири с упоминанием коренных народов; 95% ДИ — кластерный бутстреп по книгам'))
pv = T[T.dimension.isin(['all', 'period'])].pivot(index='key', columns='discourse', values='share')
print((pv * 100).round(1).to_string())
print((T[T.dimension == 'nat_group'].pivot(index='key', columns='discourse', values='share') * 100).round(1).to_string())
print((T[T.dimension.isin(['stay_type', 'gender'])].pivot(index='key', columns='discourse', values='share') * 100).round(1).to_string())
