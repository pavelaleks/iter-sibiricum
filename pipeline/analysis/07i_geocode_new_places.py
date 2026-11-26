"""07i. Координаты для новых мест маршрутов (не из справочника): сверка с GeoNames и Wikidata.

Проверяющие по тексту добавили места, которых нет в справочнике (place_id = new:…), и для большинства указали
приблизительные координаты по памяти. Такие координаты не публикуются без сверки. Каждое место ищется
по всем своим названиям (русскому, части в скобках — современное или историческое имя, латинскому ключу):
  1. GeoNames, полные выгрузки стран региона (RU KZ MN CN UZ KG KP KR JP FI NO SE EE LV LT PL BY UA TM)
     с альтернативными названиями, включая кириллические и исторические;
  2. Wikidata: русские подписи и псевдонимы (rdfs:label, skos:altLabel) у объектов с координатами (P625).
Из одноимённых кандидатов берётся ближайший к оценке проверяющего, не дальше 80 км; если оценки нет —
ближайший к соседним остановкам маршрута, не дальше 200 км, только населённый пункт или постройка и только если он
единственный в этом радиусе. Название в скобках (современное имя, река, область) учитывается только для населённых пунктов.
Источник координат у каждой остановки: geonames | wikidata (сверено с оценкой проверяющего) | geonames_ctx | wikidata_ctx
(найдено только по соседству с маршрутом — показывается как приблизительное) | estimate (не сверено) | none.
Выход: data/places_new.csv, обновлённый site/data/review/journeys_review.json, validation/geocode_report.md.
Требует: /home/claude/gn/*.txt (download.geonames.org/export/dump/<CC>.zip), доступ к query.wikidata.org.
"""
import json, math, re, glob, pathlib, time, urllib.parse, urllib.request
import pandas as pd
from unidecode import unidecode
from research_common import ROOT

REVF = pathlib.Path('/home/claude/site/data/review/journeys_review.json')
GN = sorted(glob.glob('/home/claude/gn/[A-Z][A-Z].txt'))
QUAL = r'^(р\.|оз\.|ст\.|о\.|о-ва|мыс|бухта|залив|зал\.|пролив|г\.|с\.|д\.|пос\.|станция|хребет|перевал|устье|долина)\s+'
def nk(s):  # ключ для точного сравнения названий
    s = str(s).lower().replace('ё', 'е').strip()
    s = re.sub(QUAL, '', s)
    return re.sub(r"[\s\-‐'’`.,]", '', s)
def lk(s):  # латинский ключ с выравниванием транслитераций
    s = unidecode(str(s)).lower()
    for a, b in [('kh', 'h'), ('ya', 'ia'), ('yu', 'iu'), ('ye', 'e'), ('tz', 'ts'), ('y', 'i'), ('j', 'i'), ('w', 'v'), ('ou', 'u'), ('oe', 'e')]: s = s.replace(a, b)
    return re.sub(r"[^a-z]", '', s)
def km(a, b, c, d):
    p = math.pi / 180; return 6371 * 2 * math.asin(math.sqrt(min(1, math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2)))

R = json.load(open(REVF, encoding='utf-8'))
NEW = {}
for w, v in R.items():
    for i, s in enumerate(v['stops'] + v.get('rejected', [])):
        if not str(s['place']).startswith('new:'): continue
        e = NEW.setdefault(s['place'], dict(name=s['name'], est=[], ctx=[], works=set()))
        e['works'].add(w)
        if i < len(v['stops']):
            for j in (i - 1, i + 1):
                if 0 <= j < len(v['stops']) and v['stops'][j]['lat'] is not None and not str(v['stops'][j]['place']).startswith('new:'):
                    e['ctx'].append((v['stops'][j]['lat'], v['stops'][j]['lon']))
# оценки проверяющих берутся из сырых таблиц проверки (а не из уже сверенных значений)
raw = pd.concat([pd.read_csv(f) for f in glob.glob('/home/claude/review/out/stops_b*.csv')])
for pid, d in raw[raw.place_id.str.startswith('new:', na=False)].groupby('place_id'):
    if pid in NEW:
        ll = d.dropna(subset=['lat', 'lon']); NEW[pid]['est'] = list(zip(ll.lat, ll.lon))
for pid, e in NEW.items():
    parts = [x.strip() for x in re.split(r'[()/,;]| — | или ', e['name']) if x.strip()]
    # главное название — первая часть; части в скобках (современное имя, река, область) допускаются только для населённых пунктов
    e['main'] = {nk(parts[0])} | {lk(parts[0]), lk(pid[4:].replace('_', ' '))} if parts else set()
    e['keys'] = {nk(x) for x in parts if len(nk(x)) >= 3}
    e['lkeys'] = {lk(x) for x in parts + [pid[4:].replace('_', ' ')] if len(lk(x)) >= 4}
ALLK = set().union(*[e['keys'] for e in NEW.values()]); ALLL = set().union(*[e['lkeys'] for e in NEW.values()])

cand = {}
for f in GN:  # GeoNames: только записи с совпадающим названием
    for line in open(f, encoding='utf-8'):
        c = line.rstrip('\n').split('\t')
        names = {c[1], c[2]} | (set(c[3].split(',')) if c[3] else set())
        hit = ({nk(n) for n in names} & ALLK) | ({lk(n) for n in names if n.isascii()} & ALLL)
        for k in hit: cand.setdefault(('gn', k), []).append((float(c[4]), float(c[5]), 'geonames:' + c[0], c[1], c[6]))

def sparql(q):
    req = urllib.request.Request('https://query.wikidata.org/sparql?format=json&query=' + urllib.parse.quote(q),
                                 headers={'User-Agent': 'IterSibiricum/1.0 (research; https://pavelaleks.github.io/iter-sibiricum/)', 'Accept': 'application/sparql-results+json'})
    return json.load(urllib.request.urlopen(req, timeout=120))['results']['bindings']
ru = set()
for e in NEW.values():
    for x in re.split(r'[()/,;]| — | или ', e['name']):
        x = x.strip()
        if len(x) >= 3 and not re.search('[A-Za-z]', x): ru |= {x, re.sub(QUAL, '', x)}
ru = sorted(ru)
for i in range(0, len(ru), 50):  # Wikidata: русские подписи и псевдонимы
    vals = ' '.join(json.dumps(x, ensure_ascii=False) + '@ru' for x in ru[i:i + 50])
    q = f'SELECT ?n ?item ?lat ?lon WHERE {{ VALUES ?n {{ {vals} }} {{ ?item rdfs:label ?n }} UNION {{ ?item skos:altLabel ?n }} ?item p:P625/psv:P625 [ wikibase:geoLatitude ?lat ; wikibase:geoLongitude ?lon ] . FILTER(?lat > 30 && ?lat < 78 && ((?lon > 20 && ?lon < 180) || ?lon < -168)) }}'
    for attempt in range(3):
        try:
            for b in sparql(q): cand.setdefault(('wd', nk(b['n']['value'])), []).append((float(b['lat']['value']), float(b['lon']['value']), 'wikidata:' + b['item']['value'].split('/')[-1], b['n']['value'], 'W'))
            break
        except Exception: time.sleep(5)
    time.sleep(1)

rows = []
for pid, e in NEW.items():
    C = [(src,) + x for src in ('gn', 'wd') for k in e['keys'] | e['lkeys'] for x in cand.get((src, k), [])
         if k in e['main'] or x[4] == 'P']  # по названию в скобках — только населённые пункты
    res = dict(place_id=pid, name=e['name'], works=';'.join(sorted(e['works'])), lat=None, lon=None, coord_source='none', ref='', matched_name='', dist_km=None)
    if e['est']:
        la, lo = sum(x[0] for x in e['est']) / len(e['est']), sum(x[1] for x in e['est']) / len(e['est'])
        if C:
            best = min(C, key=lambda x: (round(km(la, lo, x[1], x[2])), x[0] != 'gn'))
            d = km(la, lo, best[1], best[2])
            if d <= 80: res.update(lat=round(best[1], 5), lon=round(best[2], 5), coord_source='geonames' if best[0] == 'gn' else 'wikidata', ref=best[3], matched_name=best[4], dist_km=round(d, 1))
        if res['coord_source'] == 'none': res.update(lat=round(la, 3), lon=round(lo, 3), coord_source='estimate')
    elif C and e['ctx']:
        near = [x for x in C if x[5] in ('P', 'S') and min(km(x[1], x[2], a, b) for a, b in e['ctx']) <= 200]
        if len({(round(x[1], 1), round(x[2], 1)) for x in near}) == 1:
            x = near[0]; res.update(lat=round(x[1], 5), lon=round(x[2], 5), coord_source='geonames_ctx' if x[0] == 'gn' else 'wikidata_ctx', ref=x[3], matched_name=x[4],
                                    dist_km=round(min(km(x[1], x[2], a, b) for a, b in e['ctx']), 1))
    rows.append(res)

T = pd.DataFrame(rows); T.to_csv(ROOT / 'data/places_new.csv', index=False)
idx = T.set_index('place_id')
for w, v in R.items():
    for s in v['stops'] + v.get('rejected', []):
        if s['place'] in idx.index:
            r = idx.loc[s['place']]; ok = r.coord_source != 'none'
            s['lat'] = float(r.lat) if ok else None; s['lon'] = float(r.lon) if ok else None; s['coord_source'] = r.coord_source; s['ref'] = r.ref if isinstance(r.ref, str) else ''
json.dump(R, open(REVF, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
vc = T.coord_source.value_counts().to_dict()
ver = T[T.coord_source.isin(['geonames', 'wikidata']) & T.dist_km.notna() & T.place_id.map(lambda p: bool(NEW[p]['est']))]
with open(ROOT / 'validation/geocode_report.md', 'w', encoding='utf-8') as f:
    f.write(f'# Координаты новых мест маршрутов\n\nМест: {len(T)}. Источник координат: {vc}.\n\n'
            f'Для сверенных мест медианное расстояние между оценкой проверяющего и найденным пунктом: {ver.dist_km.median():.1f} км '
            f'(90-й процентиль {ver.dist_km.quantile(.9):.1f} км).\n\n'
            '`estimate` — оценка проверяющего, не подтверждённая ни GeoNames, ни Wikidata: на карте помечается ≈ и требует проверки экспертом.\n'
            '`none` — координат нет: место видно в списке остановок, на карте не рисуется.\n\n'
            '## Не сверены\n\n' + T[T.coord_source.isin(['estimate', 'none'])][['place_id', 'name', 'coord_source', 'works']].to_markdown(index=False))
print(vc, 'median km', ver.dist_km.median(), 'p90', ver.dist_km.quantile(.9))
