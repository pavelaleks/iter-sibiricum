"""07g. Путешествия и остановки: единая таблица маршрутов со статусами и черновики для экспертной проверки.

Почему не 07a. Автомаршрут 07a соединяет места по порядку упоминаний. Упоминание не означает посещения:
автор пишет о Пекине, Лондоне или Беринговом проливе, не бывая там. На карте такая линия выдаёт себя за путь.

Метод черновика (travel_evidence_v1).
  1. Берутся упоминания населённых пунктов и узловых точек (тип city/town/village/station/post/…)
     в основном тексте книги (не во введении, оглавлении, указателе).
  2. Для каждого упоминания находится его предложение. Упоминание считается свидетельством посещения,
     если в предложении есть глагол перемещения или пребывания (arrive, reach, leave, stay, spend the night…
     и их соответствия на 9 языках корпуса) и либо местоимение 1-го лица, либо безличная конструкция
     прибытия («on arriving at», «à notre arrivée à», «bei der Ankunft in»).
  3. Место входит в черновик, если есть хотя бы одно такое свидетельство. Порядок — медиана номеров абзацев со
     всеми упоминаниями места (как в 07a): он точнее первого упоминания. Абзац-доказательство и цитата
     сохраняются для проверки; confidence = higher, если свидетельств посещения два и больше.
  4. Черновик не попадает на карту как маршрут, пока эксперт не проверит его (status: draft → verified).

Проверка: на 12 книгах с маршрутами, восстановленными по тексту, считаются точность (доля остановок черновика,
которые есть в восстановленном маршруте), полнота и тау Кендалла по общим остановкам — для нового метода
и для старого (07a), на одинаковых условиях.

Выходы:
  data/journeys.csv            — все остановки: восстановленные (reconstructed) и черновики (draft)
  data/journeys_works.csv      — по книге: есть ли поездка, статус маршрута, число остановок
  validation/journeys_eval.csv, validation/journeys_eval.md
"""
import re, sys
import numpy as np, pandas as pd
from scipy.stats import kendalltau
from research_common import ROOT, works, paragraphs

W = works()
LANG = W.text_language.fillna('en').str.lower().str[:2].to_dict()
PL = pd.read_csv(ROOT / 'data/places.csv').set_index('place_id')
KEEP = {'city', 'town', 'village', 'station', 'post', 'settlement', 'fort', 'mine', 'monastery', 'port'}
BOX = lambda lon, lat: 40 <= (lon if lon >= 0 else lon + 360) <= 195 and 34 <= lat <= 79

P = paragraphs(only_text=True).set_index('pid')
FRONT = P.chapter_title.fillna('').str.contains(r'front matter|preface|introduction|contents|index|appendix|préface|vorwort|einleitung|inhalt|table des', case=False)
PM = pd.read_csv(ROOT / 'data/place_mentions.csv')
PM = PM[PM.place_id.isin(PL.index) & PM.place_id.map(PL.type).isin(KEEP) & PM.pid.isin(P.index)]
PM = PM[~PM.pid.map(FRONT)]
PM['n'] = PM.pid.str.extract(r'_p(\d+)$')[0].astype(int)

# --- лексика перемещения и пребывания по языкам (основы слов; регистр не важен) ---
MOVE = {
 'en': r"arriv|reach|got to|came to|come to|entered|left|leaving|quitted|start(?:ed)? from|set out|set off|drove|rode|sailed|steamed|travell?ed|journeyed|stopp|stayed|halted|spent (?:the|a|two|three|several|some) (?:night|day|week)|slept|put up|lodged|passed through|went (?:on )?to|proceeded|departed|embarked|landed|crossed|changed horses",
 'de': r"angekommen|ankamen|ankunft|erreicht|trafen .{0,20}ein|kamen .{0,30}(?:an|nach)|verließ|verliessen|abreise|fuhren|reisten|ritten|übernacht|blieben|verweilten|hielten|aufenthalt|landeten|überschritten|zogen",
 'fr': r"arriv|atteign|parv(?:în|in)|quitt|part(?:î|i)mes|partis|départ|séjourn|pass(?:â|a)mes|couch(?:â|a)mes|nuit à|descend|débarqu|traversâmes|march|voyage|rest(?:â|a)mes|entrâmes|gagn",
 'it': r"arriv|giun|raggiun|partim|partii|lasciam|sostam|pernott|fermam|entram|attraversam|viaggi|passam",
 'nl': r"aankomst|kwamen .{0,30}aan|bereikten|vertrokken|verlieten|reisden|overnacht|bleven|verbleven|trokken",
 'pl': r"przyby|przyjecha|dojecha|stanęli|wyjecha|opuści|nocowa|zatrzyma|jechali|podróż|przeby",
 'cs': r"přijel|dorazil|dojel|odjel|opustil|nocoval|zastavil|cestoval|projel",
 'da': r"ankom|ankomst|kom(?:me)? til|nåede|naaede|forlod|reiste|rejste|overnat|blev|opholdt",
 'no': r"ankom|ankomst|kom(?:me)? til|nådde|naadde|forlot|reiste|overnat|blev|opholdt",
 'sv': r"anlände|ankomst|kom(?:mo)? till|nådde|lämnade|reste|övernatt|stannade",
 'fi': r"saavu|saavuimme|lähdimme|matkustimme|yövyimme|pysähdyimme|tulimme",
}
FIRST = {
 'en': r"\b(?:we|i|us|our|my)\b", 'de': r"\b(?:wir|ich|uns|unser\w*|mein\w*)\b", 'fr': r"\b(?:nous|je|j'|notre|nos|mon|ma)\b",
 'it': r"\b(?:noi|io|ci|nostr\w+|mi)\b|\w+(?:ammo|emmo|immo)\b", 'nl': r"\b(?:wij|we|ik|ons|onze)\b", 'pl': r"\b(?:my|ja|nas|nasz\w*)\b|\w+(?:liśmy|łem|łam)\b",
 'cs': r"\b(?:my|já|nás|náš\w*)\b|\w+(?:li jsme|l jsem)\b", 'da': r"\b(?:vi|jeg|os|vor\w*)\b", 'no': r"\b(?:vi|jeg|oss|vår\w*)\b",
 'sv': r"\b(?:vi|jag|oss|vår\w*)\b", 'fi': r"\w+(?:imme|in)\b|\b(?:me|minä)\b",
}
IMPERS = r"on (?:our )?arriv|on reaching|on leaving|arrival at|à (?:notre |l')arrivée|bei (?:der|unserer) ankunft|nach (?:der|unserer) ankunft|all'arrivo"
NEG = r"\b(?:would|should|might|if|unless|intend|hope|plan|said to|is said|they say|according to|wenn|würde|falls|si nous|aurions|pourrait|se)\b"
RX = {l: (re.compile(MOVE[l], re.I), re.compile(FIRST[l], re.I)) for l in MOVE}
IMP, NEGX = re.compile(IMPERS, re.I), re.compile(NEG, re.I)
SENT = re.compile(r'(?<=[.!?;])\s+')

def sentence(text, start):
    s = 0
    for m in SENT.finditer(text):
        if m.start() >= start: return text[s:m.start()]
        s = m.end()
    return text[s:]

def evidence(row):
    t = P.at[row.pid, 'text']; lg = LANG.get(row.work_id, 'en'); lg = lg if lg in RX else 'en'
    s = sentence(t, int(row.start)) if row.start == row.start else t
    mv, fp = RX[lg]
    if len(s) > 900: return False, s[:300]
    ok = bool(mv.search(s)) and (bool(fp.search(s)) or bool(IMP.search(s))) and not NEGX.search(s)
    return ok, s.strip()

ev = PM.apply(evidence, axis=1, result_type='expand'); PM['visit'], PM['sent'] = ev[0], ev[1]
V = PM[PM.visit & PM.place_id.map(lambda p: BOX(PL.at[p, 'lon'], PL.at[p, 'lat']))]

AUTO = pd.read_csv(ROOT / 'data/itineraries_auto.csv')

def draft_for(w):
    """Состав — места со свидетельством посещения; порядок — медиана всех упоминаний места (из 07a),
    она устойчивее первого упоминания к ретроспекциям и обзорным фразам (см. validation/journeys_eval.md)."""
    d = V[V.work_id == w]
    if d.empty: return []
    order = AUTO[AUTO.work_id == w].sort_values('median_par')
    order = [p for p in order.place_id if p in set(d.place_id)]
    order += [p for p in d.sort_values('n').place_id.unique() if p not in order]  # места с 1 упоминанием
    cnt = d.place_id.value_counts(); out = []
    for seq, pl in enumerate(order, 1):
        r = d[d.place_id == pl].sort_values('n').iloc[0]
        out.append(dict(work_id=w, seq=seq, place_id=pl, evidence_pid=r.pid, evidence_text=r.sent[:280], evidence_n=int(cnt[pl]),
                        confidence='higher' if cnt[pl] >= 2 else 'lower'))
    return out

# --- восстановленные маршруты (по тексту, с абзацами-доказательствами) ---
src = open(ROOT / 'analysis/03_extract.py', encoding='utf-8').read(); ns = {}
exec(re.search(r'ROUTES = \{.*?\n\}', src, re.S).group(0), ns); MANUAL = {k: v for k, v in ns['ROUTES'].items() if v}
IT = pd.read_csv(ROOT / 'data/itineraries.csv')

def score(gold, pred):
    gold = [p for p in gold if p in PL.index and PL.at[p, 'type'] in KEEP and BOX(PL.at[p, 'lon'], PL.at[p, 'lat'])]
    common = [p for p in pred if p in gold]
    prec = len(common) / max(1, len(pred)); rec = len(set(common)) / max(1, len(gold))
    tau = kendalltau([gold.index(p) for p in common], list(range(len(common)))).statistic if len(common) >= 3 else np.nan
    return dict(gold=len(gold), pred=len(pred), hit=len(common), precision=round(prec, 3), recall=round(rec, 3), tau=round(float(tau), 3) if tau == tau else None)

ev_rows = []
for w, gold in MANUAL.items():
    new = [r['place_id'] for r in draft_for(w)]
    old = [p for p in AUTO[AUTO.work_id == w].sort_values('seq').place_id if BOX(PL.at[p, 'lon'], PL.at[p, 'lat'])]
    ev_rows.append(dict(work_id=w, method='travel_evidence_v1', **score(gold, new)))
    hi = [r['place_id'] for r in draft_for(w) if r['confidence'] == 'higher']
    ev_rows.append(dict(work_id=w, method='travel_evidence_v1 (только higher)', **score(gold, hi)))
    ev_rows.append(dict(work_id=w, method='mention_order_07a', **score(gold, old)))
E = pd.DataFrame(ev_rows); E.to_csv(ROOT / 'validation/journeys_eval.csv', index=False)
S = E.groupby('method')[['precision', 'recall', 'tau']].median().round(2)
micro = E.groupby('method')[['hit', 'pred', 'gold']].sum(); S['precision_micro'] = (micro.hit / micro.pred).round(2); S['recall_micro'] = (micro.hit / micro.gold).round(2)

# --- единая таблица остановок ---
rows = []
for w in W.index:
    if w in set(IT.work_id):
        for r in IT[IT.work_id == w].sort_values('seq').itertuples():
            rows.append(dict(work_id=w, seq=r.seq, place_id=r.place_id, evidence_pid=r.evidence_pid if isinstance(r.evidence_pid, str) else '',
                             evidence_text='', status='reconstructed', method='expert_reading', reviewer='', reviewed_at='',
                             note='' if r.evidence_status == 'attested_in_order' else r.evidence_status))
    else:
        for r in draft_for(w):
            rows.append(dict(r, status='draft', method='travel_evidence_v1', reviewer='', reviewed_at='', note=''))
J = pd.DataFrame(rows)
cols = ['work_id', 'seq', 'place_id', 'evidence_pid', 'evidence_text', 'evidence_n', 'confidence', 'status', 'method', 'reviewer', 'reviewed_at', 'note']
J = J.reindex(columns=cols); J.to_csv(ROOT / 'data/journeys.csv', index=False)

JW = []
for w in W.index:
    d = J[J.work_id == w]; st = d.status.iloc[0] if len(d) else 'none'
    JW.append(dict(work_id=w, stops=len(d), route_status=st, journey='likely' if len(d) >= 3 else 'unclear',
                   route_summary=W.at[w, 'route_summary'] if 'route_summary' in W else ''))
pd.DataFrame(JW).to_csv(ROOT / 'data/journeys_works.csv', index=False)

with open(ROOT / 'validation/journeys_eval.md', 'w', encoding='utf-8') as f:
    f.write('# Проверка черновиков маршрутов\n\nЭталон: маршруты 12 книг, восстановленные по тексту. Остановки — населённые пункты в пределах карты.\n\n')
    f.write(S.to_markdown() + '\n\n')
    f.write(f'Книг с черновиком: {(pd.DataFrame(JW).route_status == "draft").sum()}; из них с ≥3 остановками: {((pd.DataFrame(JW).route_status == "draft") & (pd.DataFrame(JW).stops >= 3)).sum()}.\n')
print(S.to_string()); print(pd.DataFrame(JW).route_status.value_counts().to_dict(), 'stops:', len(J))
