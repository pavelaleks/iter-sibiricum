"""Проверка жанра на полном тексте: травелог ли это (повествование очевидца о поездке), а не научный трактат/компиляция.

Признаки (на 1000 токенов): местоимения 1-го лица, лексика передвижения, даты (месяцы), маркеры научного текста
(sp./var./Fig./Taf., латинские биномены с автором), доля цифр. Пороги откалиброваны на 14 заведомых травелогах v0.1
и на 69 кандидатах archive.org (проверка в браузере 25.11.2026).
Решение: travelogue | travel+analysis | check | non-travel.
"""
import re, csv, json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
FP = {'en': r"\b(?:i|me|my|we|us|our)\b", 'fr': r"\b(?:je|j'|nous|me|m'|mon|ma|mes|notre|nos)\b", 'de': r"\b(?:ich|mich|mir|mein\w*|wir|uns|unser\w*)\b",
      'nl': r"\b(?:ik|mij|mijn|wij|we|ons|onze)\b", 'fi': r"\b(?:minä|minun|minulle|minua|me|meidän|meille|meitä)\b|\w+(?:imme|in)\b"}
TV = {'en': r"\b(?:arrived|reached|left|started|set out|travell?ed|drove|rode|crossed|halted|stopped|journey|road|station|sledge|tarantass|horses|steamer)\b",
      'fr': r"\b(?:arrivâmes|arrivons|arrivés|partîmes|partons|atteignîmes|traversons|traversâmes|voyage|route|relais|étape|station|chevaux|traîneau|tarantass|bateau)\b",
      'de': r"\b(?:kamen|fuhren|reisten|erreichten|verließen|ankamen|reise|station|weg|pferde|schlitten|tarantas|dampfer)\b",
      'nl': r"\b(?:kwamen|reisden|bereikten|vertrokken|reis|station|paarden|slee|weg|stoomboot)\b",
      'fi': r"\b(?:matka\w*|saavuimme|lähdimme|kyyti\w*|hevos\w*|laiva\w*|asema\w*)\b"}
MON = r"\b(?:january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|januar|februar|märz|juni|juli|oktober|dezember|januari|februari|maart|augustus|tammikuu\w*|helmikuu\w*|maaliskuu\w*|huhtikuu\w*|toukokuu\w*|kesäkuu\w*|heinäkuu\w*|elokuu\w*|syyskuu\w*|lokakuu\w*|marraskuu\w*|joulukuu\w*)\b"
SCI = r"\b(?:sp|gen|var|nov|syn|fig|taf|tab)\.|\b[A-Z][a-z]+ [a-z]{4,} (?:L|Linn|Pall|Brandt)\."

def features(text, lang):
    low = text.lower(); toks = re.findall(r"[^\W\d_]+", low); n = max(1, len(toks))
    per = lambda rx, src=low: round(len(re.findall(rx, src)) / n * 1000, 2)
    return dict(tokens=n, first_person=per(FP.get(lang, FP['en'])), travel_lex=per(TV.get(lang, TV['en'])), months=per(MON),
                sci_markers=round(len(re.findall(SCI, text)) / n * 1000, 2), digit_share=round(sum(c.isdigit() for c in text) / max(1, len(text)), 4))

def decide(f):
    if f['sci_markers'] > 1.0 or f['digit_share'] > 0.05: return 'non-travel'
    if f['first_person'] >= 10 and f['travel_lex'] >= 1.5: return 'travelogue'
    if f['first_person'] >= 3 and f['travel_lex'] >= 1.0: return 'travel+analysis'
    return 'check'

if __name__ == '__main__':
    W = {r['work_id']: r for r in csv.DictReader(open(ROOT/'data/works.csv', encoding='utf-8'))}
    rows = []
    for wid, w in W.items():
        p = ROOT/f'corpus/clean/{wid}.txt'
        if not p.exists(): continue
        f = features(p.read_text(encoding='utf-8'), w['text_language']); rows.append(dict(work_id=wid, **f, decision=decide(f)))
    with open(ROOT/'data/genre_scores.csv', 'w', newline='', encoding='utf-8') as fh:
        wr = csv.DictWriter(fh, fieldnames=list(rows[0].keys())); wr.writeheader(); wr.writerows(rows)
    for r in rows: print(r['work_id'], r['first_person'], r['travel_lex'], r['months'], r['sci_markers'], r['decision'])
