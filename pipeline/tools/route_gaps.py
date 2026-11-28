"""Перегоны маршрутов, на которых могли пропустить остановку.

Берёт проверенные маршруты (data/review/journeys_review.json) и ищет перегоны длиннее GAP км
(на карте они рисуются пунктиром). Для каждого такого перегона смотрит абзацы книги между двумя
остановками и собирает населённые пункты из справочника (data/places.json), которые там упомянуты
и лежат примерно по пути (обход через место не длиннее перегона больше чем на 25 %).

Упоминание — ещё не посещение: это очередь на проверку, а не исправление. Места, которых нет
в справочнике (например, Ашхабад или Эрбиль), сюда не попадают — их ищут при чтении абзацев.

Выход: data/review/route_gaps.json, его показывает рабочее место → «Маршруты».
Запуск из корня сайта: python3 pipeline/tools/route_gaps.py
"""
import json, math, pathlib, datetime

SITE = pathlib.Path(__file__).resolve().parents[2]
GAP = 800          # км, как в assets/atlas2.js
DETOUR = 1.25      # насколько обход через место может быть длиннее перегона
NEAR = 100         # км: место ближе к концу перегона — это и есть конец перегона
POINT_TYPES = {'city', 'town', 'village', 'villages'}


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[1], a[0], b[1], b[0]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def main():
    rev = json.load(open(SITE / 'data/review/journeys_review.json', encoding='utf-8'))
    places = {p['id']: p for p in json.load(open(SITE / 'data/places.json', encoding='utf-8'))}
    out, n_gaps = {}, 0
    for work, v in sorted(rev.items()):
        if v.get('status') in ('no_journey', 'draft'):
            continue
        geo = SITE / f'data/geo/{work}.json'
        txt = SITE / f'texts/{work}.json'
        if not geo.exists() or not txt.exists():
            continue
        mentions = json.load(open(geo, encoding='utf-8'))['m']   # [абзац, место, начало, конец]
        paras = {int(p[0]): p[4] for p in json.load(open(txt, encoding='utf-8'))['p']}
        stops = v.get('stops', [])
        idx = [i for i, s in enumerate(stops) if s.get('lon') is not None and s.get('lat') is not None]
        gaps = []
        for i, j in zip(idx, idx[1:]):
            a, b = stops[i], stops[j]
            if a.get('journey', 1) != b.get('journey', 1):
                continue
            A, B = (a['lon'], a['lat']), (b['lon'], b['lat'])
            d = km(A, B)
            if d <= GAP:
                continue
            n_gaps += 1
            pa, pb = int(a.get('pid') or 0), int(b.get('pid') or 0)
            cands = {}
            if pa and pb > pa:
                for para, pid, s0, s1 in mentions:
                    p = places.get(pid)
                    if not (pa <= para <= pb) or not p or p['type'] not in POINT_TYPES or pid in (a['place'], b['place']):
                        continue
                    P = (p['lon'], p['lat'])
                    if km(A, P) < NEAR or km(P, B) < NEAR or km(A, P) + km(P, B) > d * DETOUR:
                        continue
                    if pid in cands:
                        continue
                    t = paras.get(para, '')
                    snip = t[max(0, s0 - 120):s1 + 120].replace('\n', ' ').strip()
                    cands[pid] = {'place': pid, 'name': p['name'], 'lat': p['lat'], 'lon': p['lon'],
                                  'pid': f'{para:05d}', 'snippet': ('…' if s0 > 120 else '') + snip + ('…' if s1 + 120 < len(t) else '')}
            gaps.append({'after': i, 'from': a['name'], 'to': b['name'], 'km': round(d),
                         'candidates': sorted(cands.values(), key=lambda c: c['pid'])})
        flagged = [g for g in gaps if g['candidates']]
        if flagged:
            out[work] = flagged
    res = {'generated': datetime.date.today().isoformat(), 'gap_km': GAP,
           'note': 'Перегоны длиннее gap_km, внутри которых текст называет населённый пункт по пути. Упоминание — не обязательно посещение.',
           'works': out}
    (SITE / 'data/review/route_gaps.json').write_text(json.dumps(res, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'перегонов длиннее {GAP} км: {n_gaps}; с кандидатами: {sum(len(g) for g in out.values())} в {len(out)} книгах')


if __name__ == '__main__':
    main()
