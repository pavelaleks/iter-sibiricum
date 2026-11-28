"""11. Экспорт мест и маршрутов в открытые форматы исторической географии.

1) data/export/iter-sibiricum-places.lpf.jsonld — Linked Places Format v1.1 (GeoJSON-LD) для загрузки в
   World Historical Gazetteer (https://whgazetteer.org): каждое место — Feature с названием по-русски,
   формами названия, засвидетельствованными в травелогах (со ссылкой на книгу и абзац), временем
   засвидетельствования (годы поездок), координатами с оценкой точности и ссылками на GeoNames / Wikidata.
2) data/export/iter-sibiricum-routes.geojson — маршруты (по поездкам) как LineString со статусом проверки.

Вход: data/places.csv, data/place_mentions.csv, data/places_new.csv, data/works.csv,
../site/data/review/journeys_review.json. Выход в ../site/data/export/.
"""
import csv, json, pathlib, collections, datetime
import pandas as pd
import reverse_geocoder as rg
ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT.parent / 'site'; OUT = SITE / 'data' / 'export'; OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://iter-sibiricum.ru/'
PID = BASE + 'data/export/iter-sibiricum-places.lpf.jsonld#'  # постоянные идентификаторы мест
W = {r['work_id']: r for r in csv.DictReader(open(ROOT / 'data/works.csv', encoding='utf-8'))}
def wyear(w):
    r = W.get(w, {}); y = r.get('journey_start') or r.get('edition_year')
    try: return int(float(y))
    except Exception: return None
def wlabel(w):
    r = W.get(w, {}); return f"{r.get('author', w)}, {r.get('edition_year', '')}".strip(', ')
REV = json.load(open(SITE / 'data/review/journeys_review.json', encoding='utf-8'))

def link(ref):
    ref = ref or ''
    if ref.startswith('geonames:'): return dict(type='closeMatch', identifier='gn:' + ref.split(':', 1)[1].split('|')[0])
    if ref.startswith('wikidata:'): return dict(type='closeMatch', identifier='wd:' + ref.split(':', 1)[1])
    return None


# классы объектов GeoNames (WHG требует properties.fclasses или types):
# P населённые пункты, H воды, T рельеф, L области/местности, A административные, S сооружения
FC_GAZ = {'city': 'P', 'town': 'P', 'village': 'P', 'villages': 'P', 'river': 'H', 'sea': 'H', 'lake': 'H', 'strait': 'H',
          'mountains': 'T', 'island': 'T', 'peninsula': 'T', 'cape': 'T', 'desert': 'T', 'region': 'L', 'country': 'A'}
TY_RU = {'P': 'населённый пункт', 'H': 'водный объект', 'T': 'элемент рельефа', 'L': 'местность / область', 'A': 'административная единица', 'S': 'сооружение / станция'}
import re
def fclass_new(name, ref):
    n = name.lower(); first = n.split('(')[0].strip()
    W = lambda words: r'^(?:' + words + r')(?=[\s.,/]|$)'
    if re.search(r'(селение|стойбищ|улус|аул|прииск|деревн|посёлок|город)', n): return 'P'
    if re.search(r'\(станция|^(?:ст\.|станция)\s', n) or re.search(W('монастырь|маяк|станок|зимовье|застава|пикет|крепость'), first): return 'S'
    if re.search(W('р\\.|река|оз\\.|озеро|протока|залив|бухта|губа|пролив|море|порог'), first) or re.search(r'\s(озеро|залив|море|пролив)$', first): return 'H'
    if re.search(W('мыс|гора|хребет|перевал|полуостров|о\\.|остров|сопка|пик|ледник'), first): return 'T'
    if re.search(W('долина|край|угодье|тундра|степь|область|земля|страна|пустыня|тайга|урочище|район|верховья|южный берег|берег'), first) or re.search(r'край\s', first): return 'L'
    return 'P'

feats = []
# --- места газеттира (упоминания во всём корпусе) ---
PL = pd.read_csv(ROOT / 'data/places.csv'); PM = pd.read_csv(ROOT / 'data/place_mentions.csv')
forms = PM.groupby(['place_id', 'form']).agg(n=('pid', 'size'), works=('work_id', lambda s: sorted(set(s)))).reset_index()
FIRST = PM.groupby(['place_id', 'form', 'work_id']).pid.first().to_dict()  # первый абзац с этой формой в книге
pts = []
for r in PL.itertuples():
    f = forms[forms.place_id == r.place_id].sort_values('n', ascending=False).head(12)
    names = [dict(toponym=r.label_ru, lang='ru', citations=[dict(label='Iter Sibiricum (нормализованное название)', **{'@id': BASE})])]
    for x in f.itertuples():
        names.append(dict(toponym=x.form, citations=[dict(label=wlabel(w), **{'@id': f'{BASE}#book-{w.replace("_", "-")}-p{FIRST[(r.place_id, x.form, w)].split("_p")[-1]}'}) for w in x.works[:5]]))
    yrs = sorted({y for w in PM[PM.place_id == r.place_id].work_id.unique() for y in [wyear(w)] if y})
    cs = str(r.coord_source)
    feats.append(dict(type='Feature', **{'@id': PID + r.place_id},
                      properties=dict(title=r.label_ru, src='gazetteer', region=r.region, in_siberia=bool(r.in_siberia), fclasses=[FC_GAZ.get(str(r.type), 'P')]),
                      when=dict(timespans=[dict(start={'earliest': str(yrs[0])}, end={'latest': str(yrs[-1])})]) if yrs else None,
                      names=names, types=[dict(label=r.type)],
                      geometry=dict(type='Point', coordinates=[round(r.lon, 5), round(r.lat, 5)], certainty='certain' if cs.startswith('geonames') else 'less-certain'),
                      links=[l for l in [link(cs.replace('geonames_cities1000:', 'geonames:'))] if l and l['identifier'][3:].isdigit()]))
    pts.append((r.lat, r.lon))
# --- новые места маршрутов (только те, что встречаются в маршрутах) ---
NEW = pd.read_csv(ROOT / 'data/places_new.csv')
cit = collections.defaultdict(list)
for w, v in REV.items():
    for s in v['stops']:
        if str(s['place']).startswith('new:') and s.get('pid'): cit[s['place']].append((w, s['pid'], s.get('quote', '')))
CERT = {'geonames': 'certain', 'wikidata': 'certain', 'geonames_ctx': 'less-certain', 'wikidata_ctx': 'less-certain', 'estimate': 'less-certain', 'estimate_manual': 'less-certain'}
for r in NEW.itertuples():
    if r.coord_source == 'none' or pd.isna(r.lat): continue
    c = cit.get(r.place_id, [])
    ws = [w for w in re.split(r'[;,|\s]+', str(r.works)) if w in W] if isinstance(r.works, str) else []
    yrs = sorted({y for w in ([w for w, _, _ in c] or ws) for y in [wyear(w)] if y})
    names = [dict(toponym=r.name, lang='ru', citations=[dict(label=f'{wlabel(w)}: «{q[:120]}»', **{'@id': f'{BASE}#book-{w.replace("_", "-")}-p{p}'}) for w, p, q in c[:5]] or [dict(label=wlabel(w), **{'@id': f'{BASE}#book-{w.replace("_", "-")}'}) for w in ws[:5]] or [dict(label='Iter Sibiricum', **{'@id': BASE})])]
    l = link(r.ref if isinstance(r.ref, str) else '')
    fc = fclass_new(r.name, r.ref)
    feats.append(dict(type='Feature', **{'@id': PID + r.place_id.replace('new:', 'route-')},
                      properties=dict(title=r.name, src='route_stop', coord_source=r.coord_source,
                                      precision=(r.ref.split(':', 1)[1] if isinstance(r.ref, str) and r.ref.startswith('precision:') else ''), fclasses=[fc]),
                      types=[dict(label=TY_RU[fc])],
                      when=dict(timespans=[dict(start={'earliest': str(yrs[0])}, end={'latest': str(yrs[-1])})]) if yrs else None,
                      names=names,
                      geometry=dict(type='Point', coordinates=[round(r.lon, 5), round(r.lat, 5)], certainty=CERT.get(r.coord_source, 'less-certain')),
                      links=[l] if l else []))
    pts.append((r.lat, r.lon))
# коды стран (современные границы) — по ближайшему населённому пункту GeoNames
cc = rg.search(pts, mode=1)
for f, c in zip(feats, cc): f['properties']['ccodes'] = [c['cc']]
for f in feats:
    if f.get('when') is None: f.pop('when', None)
lpf = {'type': 'FeatureCollection', '@context': 'https://raw.githubusercontent.com/LinkedPasts/linked-places/master/linkedplaces-context-v1.1.jsonld',
       'metadata': dict(title='Iter Sibiricum: места европейских травелогов о Сибири, 1800–1930', creator='Коллектив проекта РНФ № 25-28-20397',
                        license='CC BY-NC 4.0', created=datetime.date.today().isoformat(), homepage=BASE,
                        description='Места, упомянутые в корпусе травелогов (газеттир) и остановки маршрутов, восстановленных по тексту. '
                                    'Формы названий даны так, как они встречаются в книгах, со ссылкой на абзац. '
                                    'certainty=less-certain — координаты приблизительные (≈ на сайте).'),
       'features': feats}
json.dump(lpf, open(OUT / 'iter-sibiricum-places.lpf.jsonld', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
# --- маршруты ---
rf = []
for w, v in REV.items():
    if v.get('status') not in ('checked', 'verified') or not v['stops']: continue
    by = collections.defaultdict(list)
    for s in v['stops']:
        if s.get('lat') is not None: by[s.get('journey', 1)].append(s)
    for j, S in by.items():
        if len(S) < 2: continue
        rf.append(dict(type='Feature', geometry=dict(type='LineString', coordinates=[[round(s['lon'], 4), round(s['lat'], 4)] for s in S]),
                       properties=dict(work=w, author=W.get(w, {}).get('author', ''), edition_year=W.get(w, {}).get('edition_year', ''), journey=j,
                                       years=v.get('years', ''), status=v['status'], status_ru='подтверждён экспертом' if v['status'] == 'verified' else 'предварительный (языковая модель)',
                                       stops=[dict(name=s['name'], place=s['place'], paragraph=f"{BASE}#book-{w.replace('_', '-')}-p{s['pid']}" if s.get('pid') else None,
                                                   approx=str(s.get('coord_source', '')).startswith('estimate')) for s in S])))
json.dump(dict(type='FeatureCollection', name='Iter Sibiricum: маршруты травелогов', license='CC BY-NC 4.0', features=rf),
          open(OUT / 'iter-sibiricum-routes.geojson', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('мест:', len(feats), '| из них газеттир', len(PL), '| маршрутов (поездок):', len(rf))
