"""07j. Ручные оценки координат для мест маршрутов, не найденных в GeoNames и Wikidata (07i).

Вход: data/places_manual_coords.csv (place_id, lat, lon, precision: point | approx | area, basis),
data/places_new.csv, ../site/data/review/journeys_review.json.
Координаты проставляются только местам без координат (coord_source = none); источник —
estimate_manual, на карте такие остановки помечены ≈. Это оценка по историческим картам и
контексту маршрута, она требует подтверждения экспертом (рабочее место → Маршруты).
"""
import csv, json, pathlib
import pandas as pd
ROOT = pathlib.Path(__file__).resolve().parents[1]
REVF = ROOT.parent / 'site' / 'data' / 'review' / 'journeys_review.json'
M = {r['place_id']: r for r in csv.DictReader(open(ROOT / 'data/places_manual_coords.csv', encoding='utf-8'))}
T = pd.read_csv(ROOT / 'data/places_new.csv')
n = 0
for i, r in T.iterrows():
    if r.coord_source == 'none' and r.place_id in M:
        m = M[r.place_id]; T.loc[i, ['lat', 'lon', 'coord_source', 'ref', 'matched_name']] = [float(m['lat']), float(m['lon']), 'estimate_manual', 'precision:' + m['precision'], m['basis']]; n += 1
T.to_csv(ROOT / 'data/places_new.csv', index=False)
R = json.load(open(REVF, encoding='utf-8')); k = 0
for w, v in R.items():
    for s in v['stops'] + v.get('rejected', []):
        m = M.get(s['place'])
        if m and s.get('lat') is None:
            s['lat'], s['lon'] = float(m['lat']), float(m['lon']); s['coord_source'] = 'estimate_manual'; s['ref'] = 'precision:' + m['precision']; k += 1
json.dump(R, open(REVF, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('мест:', n, '| остановок:', k, '| осталось без координат:', int((T.coord_source == 'none').sum()), list(T[T.coord_source == 'none'].name))
