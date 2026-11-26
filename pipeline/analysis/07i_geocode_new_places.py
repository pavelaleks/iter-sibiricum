"""07i. Координаты для новых мест маршрутов (не из справочника): сверка с GeoNames.

Проверяющие по тексту добавили места, которых нет в справочнике (place_id = new:…), и для большинства указали
приблизительные координаты по памяти. Такие координаты нельзя публиковать без сверки. Здесь каждое место
сопоставляется с GeoNames cities1000 (населённые пункты от 1000 жителей; файл из пакета reverse_geocoder):
  - geonames      — найден пункт GeoNames с тем же названием (нечёткое сравнение транслитераций ≥ 85)
                    не дальше 60 км от оценки проверяющего; берутся координаты GeoNames;
  - geonames_ctx  — оценки не было; найден единственный одноимённый пункт (≥ 92) не дальше 700 км от соседних
                    остановок маршрута; берутся координаты GeoNames;
  - estimate      — сверить не удалось (исторический пункт, станция, урочище); остаётся оценка проверяющего,
                    на карте помечается как приблизительная;
  - none          — координат нет; место видно в списке остановок, на карте не рисуется.
Выход: data/places_new.csv (справочник новых мест с происхождением координат), обновлённый
site/data/review/journeys_review.json (lat, lon, coord_source у остановок), validation/geocode_report.md.
"""
import json, math, re, glob, pathlib
import pandas as pd
from unidecode import unidecode
from rapidfuzz import fuzz
from research_common import ROOT

REVF = pathlib.Path('/home/claude/site/data/review/journeys_review.json')
RG = glob.glob('/tmp/rg/**/rg_cities1000.csv', recursive=True)[0]
G = pd.read_csv(RG); G = G[(G.lon.between(25, 180) | G.lon.between(-180, -168)) & G.lat.between(30, 78)].copy()

def norm(s):
    s = unidecode(str(s)).lower()
    s = re.sub(r"\b(ostrog|stanitsa|sloboda|zavod|selo|derevnia|derevnya|pos[eë]lok|gorod|fort|post|river|reka)\b", '', s)
    for a, b in [('kh', 'h'), ('ya', 'ia'), ('yu', 'iu'), ('ye', 'e'), ('tz', 'ts'), ('y', 'i'), ('j', 'i'), ('w', 'v'), ("'", ''), ('-', ''), (' ', '')]: s = s.replace(a, b)
    return s
G['k'] = G.name.map(norm)
def km(a, b, c, d):
    p = math.pi / 180; return 6371 * 2 * math.asin(math.sqrt(math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2))

R = json.load(open(REVF, encoding='utf-8'))
# соберём новые места с оценками и соседями по маршруту
NEW = {}
for w, v in R.items():
    st = v['stops']
    for i, s in enumerate(st):
        if not str(s['place']).startswith('new:'): continue
        e = NEW.setdefault(s['place'], dict(name=s['name'], est=[], ctx=[], works=set()))
        e['works'].add(w)
        if s['lat'] is not None: e['est'].append((s['lat'], s['lon']))
        for j in (i - 1, i + 1):
            if 0 <= j < len(st) and st[j]['lat'] is not None and not str(st[j]['place']).startswith('new:'): e['ctx'].append((st[j]['lat'], st[j]['lon']))

rows = []
for pid, e in NEW.items():
    parts = [x for x in re.split(r'[()/,;]| — | или ', e['name']) if x.strip() and not re.search(r'селение|на амуре|станция|река', x)]
    keys = {norm(x) for x in parts} | {norm(pid[4:].replace('_', ' '))}
    keys = {k for k in keys if len(k) >= 4} or {norm(e['name'])}
    G['sc'] = G.k.map(lambda k: max(fuzz.ratio(k, q) for q in keys))
    cand = G[G.sc >= 85]
    res = dict(place_id=pid, name=e['name'], works=';'.join(sorted(e['works'])), lat=None, lon=None, coord_source='none', geonames_name='', dist_km=None)
    if e['est']:
        la, lo = sum(x[0] for x in e['est']) / len(e['est']), sum(x[1] for x in e['est']) / len(e['est'])
        if len(cand):
            cand = cand.assign(d=[km(la, lo, a, b) for a, b in zip(cand.lat, cand.lon)]).sort_values(['d'])
            c = cand.iloc[0]
            if c.d <= 60: res.update(lat=c.lat, lon=c.lon, coord_source='geonames', geonames_name=c['name'], dist_km=round(c.d, 1))
        if res['coord_source'] == 'none': res.update(lat=round(la, 3), lon=round(lo, 3), coord_source='estimate')
    elif len(cand) and e['ctx']:
        strong = cand[cand.sc >= 92]
        strong = strong.assign(d=[min(km(a, b, x, y) for x, y in e['ctx']) for a, b in zip(strong.lat, strong.lon)])
        strong = strong[strong.d <= 700]
        if len(strong) == 1:
            c = strong.iloc[0]; res.update(lat=c.lat, lon=c.lon, coord_source='geonames_ctx', geonames_name=c['name'], dist_km=round(c.d, 1))
    rows.append(res)

T = pd.DataFrame(rows); T.to_csv(ROOT / 'data/places_new.csv', index=False)
idx = T.set_index('place_id')
for w, v in R.items():
    for s in v['stops'] + v.get('rejected', []):
        if s['place'] in idx.index:
            r = idx.loc[s['place']]; ok = r.coord_source != 'none'
            s['lat'] = float(r.lat) if ok else None; s['lon'] = float(r.lon) if ok else None; s['coord_source'] = r.coord_source
json.dump(R, open(REVF, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
vc = T.coord_source.value_counts().to_dict()
with open(ROOT / 'validation/geocode_report.md', 'w', encoding='utf-8') as f:
    f.write(f'# Координаты новых мест маршрутов\n\nМест: {len(T)}. Источник координат: {vc}.\n\n'
            f'Медианное расхождение оценки проверяющего и GeoNames для сверенных мест: {T[T.coord_source == "geonames"].dist_km.median():.1f} км.\n\n'
            '`estimate` — оценка проверяющего, не сверенная с GeoNames: на карте помечается как приблизительная; требует проверки.\n')
print(vc, 'median dist', T[T.coord_source == 'geonames'].dist_km.median())
