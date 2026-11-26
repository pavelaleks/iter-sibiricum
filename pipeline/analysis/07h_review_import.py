"""07h. Импорт результатов проверки маршрутов по тексту в data/review/journeys_review.json.

Вход: review/out/stops_b*.csv, books_b*.csv — проверка каждой книги чтением текста (см. review/INSTRUCTIONS.md).
Каждая остановка проходит автоматический контроль, прежде чем попасть в файл решений:
  - абзац с таким номером существует в тексте книги;
  - цитата дословно (с точностью до пробелов и регистра) находится в этом абзаце;
Остановки, не прошедшие контроль (и помеченные проверяющим как unclear), сохраняются отдельно (rejected) и в маршрут не идут.
Остановки новых мест без координат остаются в маршруте, но на карте не рисуются, пока место не получит координаты.
Статус книги: checked — маршрут проверен по тексту (не экспертом: подтверждение эксперта делается в рабочем месте);
no_journey — книга не описывает поездку автора. Решения, уже принятые экспертами (verified), не перезаписываются.
Происхождение записывается: reviewer = 'проверка по тексту (автоматизированная)', method = 'reading_check_v1'.
Выход: site/data/review/journeys_review.json, validation/review_import_report.md
"""
import json, re, glob, pathlib, unicodedata, datetime
import pandas as pd
from research_common import ROOT

REV = pathlib.Path('/home/claude/review/out'); SITE = pathlib.Path('/home/claude/site')
OUT = SITE / 'data/review/journeys_review.json'
PL = pd.read_csv(ROOT / 'data/places.csv').set_index('place_id')
norm = lambda s: re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(s))).strip().lower()

S = pd.concat([pd.read_csv(f, dtype={'evidence_pid': str}) for f in sorted(glob.glob(str(REV / 'stops_b*.csv')))], ignore_index=True)
B = pd.concat([pd.read_csv(f) for f in sorted(glob.glob(str(REV / 'books_b*.csv')))], ignore_index=True).drop_duplicates('work_id', keep='last')
cur = json.load(open(OUT, encoding='utf-8')) if OUT.exists() else {}
today = datetime.date.today().isoformat(); rep = []

for b in B.itertuples():
    w = b.work_id
    if w in cur and cur[w].get('status') == 'verified': rep.append((w, 'пропущено: уже подтверждено экспертом', 0, 0)); continue
    T = {p[0]: p[4] for p in json.load(open(SITE / f'texts/{w}.json', encoding='utf-8'))['p']}
    d = S[(S.work_id == w)].copy()
    stops, bad = [], 0
    for r in d.sort_values(['journey', 'seq']).itertuples():
        pid = str(r.evidence_pid).split('.')[0].zfill(5) if r.evidence_pid == r.evidence_pid else ''
        lat, lon = r.lat, r.lon
        if r.place_id in PL.index: lat, lon, name = PL.at[r.place_id, 'lat'], PL.at[r.place_id, 'lon'], PL.at[r.place_id, 'label_ru']
        else: name = r.place_name
        checks = []
        if pid not in T: checks.append('нет абзаца')
        elif isinstance(r.quote, str) and r.quote.strip() and norm(r.quote.strip(' «»"…')) not in norm(T[pid]): checks.append('цитата не найдена в абзаце')
        ok = not checks and r.decision == 'visited'
        if not (lat == lat and lon == lon): checks.append('нет координат: в списке остановок, но не на карте')
        bad += not ok
        stops.append(dict(place=r.place_id, name=name, lat=float(lat) if lat == lat else None, lon=float(lon) if lon == lon else None, pid=pid,
                          quote=r.quote if isinstance(r.quote, str) else '', journey=int(r.journey) if r.journey == r.journey else 1,
                          decision=r.decision, ok=ok, issues=checks, note=r.note if isinstance(r.note, str) else '', new_place=not r.place_id in PL.index))
    status = 'no_journey' if b.has_journey == 'no' or b.quality == 'not_a_journey' else ('checked' if any(s['ok'] for s in stops) else 'draft')
    cur[w] = dict(status=status, stops=[s for s in stops if s['ok']] if status == 'checked' else stops, rejected=[s for s in stops if not s['ok']] if status == 'checked' else [],
                  summary=b.summary if isinstance(b.summary, str) else '', direction=b.direction if isinstance(b.direction, str) else '',
                  years=str(b.years) if b.years == b.years else '', quality=b.quality, draft_note=b.draft_precision_note if isinstance(b.draft_precision_note, str) else '',
                  reviewer='проверка по тексту (автоматизированная)', method='reading_check_v1', date=today,
                  history=cur.get(w, {}).get('history', []) + [dict(status=status, by='reading_check_v1', date=today)])
    rep.append((w, status, len(stops), bad))

OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump(cur, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
R = pd.DataFrame(rep, columns=['work_id', 'status', 'stops', 'failed_checks'])
with open(ROOT / 'validation/review_import_report.md', 'w', encoding='utf-8') as f:
    f.write(f'# Импорт проверки маршрутов по тексту ({today})\n\nКниг: {len(R)}; статусы: {R.status.value_counts().to_dict()}; остановок: {R.stops.sum()}; не прошли контроль: {R.failed_checks.sum()}.\n\n')
    f.write(R.to_markdown(index=False))
print(R.status.value_counts().to_dict(), 'stops', R.stops.sum(), 'failed', R.failed_checks.sum())

# --- насколько черновик 07g совпадает с маршрутами, проверенными по тексту (книги, где был черновик) ---
J = pd.read_csv(ROOT / 'data/journeys.csv'); D = J[J.status == 'draft']
BOXP = lambda p: p in PL.index and 40 <= PL.at[p, 'lon'] <= 195 and 34 <= PL.at[p, 'lat'] <= 79
rows = []
for w, d in D.groupby('work_id'):
    v = cur.get(w)
    if not v or v['status'] != 'checked': continue
    gold = {s['place'] for s in v['stops'] if BOXP(s['place'])}; pred = [p for p in d.place_id if BOXP(p)]
    hit = sum(p in gold for p in pred)
    rows.append(dict(work_id=w, pred=len(pred), gold=len(gold), hit=hit))
E = pd.DataFrame(rows)
if len(E):
    with open(ROOT / 'validation/review_import_report.md', 'a', encoding='utf-8') as f:
        f.write(f'\n\n## Черновик 07g против проверки по тексту\n\nКниг: {len(E)}. Точность черновика (доля его остановок, подтверждённых чтением): {E.hit.sum() / E.pred.sum():.2f}; '
                f'полнота (доля проверенных остановок из справочника, которые черновик нашёл): {E.hit.sum() / E.gold.sum():.2f}.\n')
    print('draft vs checked: precision', round(E.hit.sum() / E.pred.sum(), 2), 'recall', round(E.hit.sum() / E.gold.sum(), 2), 'books', len(E))
