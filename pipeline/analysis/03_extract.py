"""Этап 3: извлечение упоминаний мест и этнонимов, регион абзаца, маршруты с доказательствами."""
import json, csv, re, pathlib, sys
from collections import Counter, defaultdict
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from lexicon import COMPILED
from gazetteer import P, WORK_OVERRIDES, SIBERIA

ROOT = pathlib.Path(__file__).resolve().parents[1]
paras = [json.loads(l) for l in open(ROOT/'corpus/paragraphs.jsonl', encoding='utf-8')]
places = {r['place_id']: r for r in csv.DictReader(open(ROOT/'data/places.csv', encoding='utf-8'))}
PRX = [(pid, re.compile(rx)) for pid, lab, rx, *_ in P if rx]
COUNTED = ('text', 'note')
# этноним как определение к топониму («Buriat steppe», «Tchuktchi peninsula», «district tunguse», «Kirghis frontier») —
# это название места, а не упоминание людей (экспертная выборка v0.4: 8 из 20 невалидных единиц)
TOPO_AFTER = re.compile(r"^[\s-]*(?:steppes?|frontier|border|peninsula|district|territory|line|country|land|coast|river|mountains?|range|plateau|"
                        r"Steppe|Grenze|Halbinsel|Gebiet|Land|Bezirk|Linie|Küste|steppe|frontière|presqu'île|péninsule|terre|rivières?|ligne|côte|"
                        r"stepp[ae]|steppen|halvø|halvøen|grænse|landet)\b", re.I)
TOPO_BEFORE = re.compile(r"(?:district|terre|rivières?|frontière|steppe|presqu'île|ligne|pays|région)\s+$", re.I)

# --- 1. места ---
place_mentions = []
for p in paras:
    if p['type'] not in COUNTED: continue
    for pid, rx in PRX:
        for m in rx.finditer(p['text']):
            pl = WORK_OVERRIDES.get((p['work_id'], pid), pid)
            # Granö: деревни финских колонистов под Омском носят имена «Helsinki», «Narva»
            if p['work_id'] == 'grano1893' and pid == 'helsinki' and re.search(r'kyl|siirto|Om', p['text'][m.end():m.end()+60]):
                pl = 'om_colonies'
            place_mentions.append(dict(pid=p['pid'], work_id=p['work_id'], place_id=pl, form=m.group(0), start=m.start()))

# --- 2. регион абзаца: собственные упоминания (≥2 или один регион) иначе большинство по главе ---
by_para = defaultdict(list)
for m in place_mentions: by_para[m['pid']].append(places[m['place_id']]['region'])
chap_votes = defaultdict(Counter)
for p in paras:
    for r in by_para.get(p['pid'], []): chap_votes[(p['work_id'], p['chapter'])][r] += 1
# v0.4: перенос региона ограничен. (1) Явные топонимы вне газеттира (Америка, Гавайи, Индия, Крым, Польша…) обрывают перенос
# и ставят регион 'elsewhere'. (2) Без собственных упоминаний мест перенос длится не дальше MAX_CARRY абзацев:
# в OCR-книгах главы часто не распознаны, и регион иначе «протекает» на сотни абзацев (экспертная выборка v0.4: 8 невалидных единиц).
ELSEWHERE = re.compile(r"\b(?:America\w*|Amérique|Amerika\w*|Hawai\w*|Sandwich Islands|Honolulu|Samoa\w*|Apia|Ceylon|Colombo|India\b|Indien|Inde\b|"
                       r"Bombay|Calcutta|Sahara|Alg[ée]ri\w*|Egypt\w*|Ägypt\w*|Crimea|Krim\b|Crimée|Krym\w*|Polsk\w*|Polen\b|Pologne|Warszaw\w*|Warsaw|Varsovie|"
                       r"Lithuania|Litw\w*|Canada|Greenland|Grönland|Groenland|Australia\w*|Africa\w*|Afrique|Afrika|Mexico|Brazil|Persia|Perse|Persien|Turkestan|"
                       r"Bokhara|Boukhara|Buchara|Samarkand|Tibet|Tokio|Tokyo|Yokohama|Nagasaki|Hakodate|Hakodadi|Kioto|Kyoto|Shanghai|Canton|Hong[- ]?Kong|Constantinople)\b")
MAX_CARRY = 30
n_chap = Counter(); _seen = set()
for p in paras:
    if (p['work_id'], p['chapter']) not in _seen: _seen.add((p['work_id'], p['chapter'])); n_chap[p['work_id']] += 1
FEW_CHAPTERS = {w for w, n in n_chap.items() if n <= 5}     # главы не распознаны — ограничиваем перенос
prev_region = {}; last_evidence = {}
for i, p in enumerate(paras):
    own = Counter(by_para.get(p['pid'], []))
    key0 = (p['work_id'], p['chapter'])
    if not own and ELSEWHERE.search(p['text']):
        own = Counter({'elsewhere': 2})
    if own: last_evidence[p['work_id']] = i
    elif p['work_id'] in FEW_CHAPTERS and i - last_evidence.get(p['work_id'], -10**9) > MAX_CARRY:
        p['region'], p['region_basis'], p['in_siberia'] = 'unknown', 'carry_expired', False
        prev_region[key0] = None; prev_region[p['work_id']] = 'unknown'
        continue
    key = (p['work_id'], p['chapter'])
    last = prev_region.get(key)          # последний регион внутри той же главы
    if own and (sum(own.values()) >= 2 or len(own) == 1):
        reg, how = own.most_common(1)[0][0], 'paragraph'
    elif own and last in own:
        reg, how = last, 'paragraph+carry'
    elif last:
        reg, how = last, 'carry_in_chapter'
    elif chap_votes[key]:
        reg, how = chap_votes[key].most_common(1)[0][0], 'chapter_majority'
    else:
        reg, how = prev_region.get(p['work_id'], 'unknown'), 'carry_prev_chapter'
    p['region'], p['region_basis'] = reg, how
    p['in_siberia'] = reg in SIBERIA
    prev_region[p['work_id']] = reg
    if how.startswith('paragraph'): prev_region[key] = reg

# --- 3. этнонимы с маскированием ---
works_lang = {r['work_id']: r['text_language'] for r in csv.DictReader(open(ROOT/'data/works.csv', encoding='utf-8'))}
def lang_ok(d, lang):
    ls = d['lang'].split('/')
    return 'all' in ls or lang in ls
# этноним как определение к топониму («Buriat steppe», «Tchuktchi peninsula», «district tunguse», «Kirghis frontier») —
# это название места, а не упоминание людей (экспертная выборка v0.4: 8 из 20 невалидных единиц)
TOPO_AFTER = re.compile(r"^[\s-]*(?:steppes?|frontier|border|peninsula|district|territory|line|country|land|coast|river|mountains?|range|plateau|"
                        r"Steppe|Grenze|Halbinsel|Gebiet|Land|Bezirk|Linie|Küste|steppe|frontière|presqu'île|péninsule|terre|rivières?|ligne|côte|"
                        r"stepp[ae]|steppen|halvø|halvøen|grænse|landet)\b", re.I)
TOPO_BEFORE = re.compile(r"(?:district|terre|rivières?|frontière|steppe|presqu'île|ligne|pays|région)\s+$", re.I)
mentions = []
for p in paras:
    if p['type'] not in COUNTED: continue
    t = p['text']; mask = bytearray(len(t)); lang = works_lang[p['work_id']]
    for d, rx in COMPILED:
        if not lang_ok(d, lang): continue
        for m in rx.finditer(t):
            if any(mask[m.start():m.end()]): continue
            mask[m.start():m.end()] = b'\x01' * (m.end() - m.start())
            if TOPO_AFTER.match(t[m.end():m.end() + 30]) or (TOPO_BEFORE.search(t[max(0, m.start() - 25):m.start()]) and m.group(0)[:1].islower()): continue
            mentions.append(dict(mid=f"{p['pid']}_{m.start()}", pid=p['pid'], work_id=p['work_id'], chapter=p['chapter'],
                                 ethnonym_id=d['ethnonym_id'], form=m.group(0), group_id=d['group_id'], map_conf=d['conf'],
                                 start=m.start(), end=m.end(), region=p['region'], in_siberia=p['in_siberia'],
                                 left=t[max(0, m.start()-220):m.start()], right=t[m.end():m.end()+220]))
mentions.sort(key=lambda x: (x['pid'], x['start']))

# --- 4. маршруты: остановки из паспорта источника, доказательство = первый абзац с упоминанием после предыдущей остановки ---
ROUTES = {
 'michie1864': ['peking','kalgan','urga','maimachin','kiakhta','selenginsk','verkhneudinsk','baikal','irkutsk','nizhneudinsk','kansk','krasnoyarsk','achinsk','mariinsk','tomsk','kolyvan','kainsk','omsk','petropavlovsk_kz','ishim','tyumen','ekaterinburg','perm','kazan','nizhny','moscow','stpetersburg'],
 'dewindt1889': ['peking','kalgan','gobi','urga','kiakhta','verkhneudinsk','baikal','irkutsk','krasnoyarsk','tomsk','tobolsk','tyumen','ekaterinburg','perm','moscow'],
 'dewindt1903': ['paris','moscow','irkutsk','kachug','zhigalovo','kirensk','vitim','olekminsk','yakutsk','verkhoyansk','srednekolymsk','nizhnekolymsk','eastcape','beringstrait','alaska'],
 'meignan1877': ['paris','stpetersburg','moscow','nizhny','kazan','perm','ekaterinburg','tyumen','ishim','omsk','kainsk','tomsk','krasnoyarsk','irkutsk','baikal','verkhneudinsk','kiakhta','maimachin','urga','gobi','kalgan','peking'],
 'price1892': ['karasea','yenisei','yeniseisk','krasnoyarsk','kansk','nizhneudinsk','irkutsk','baikal','verkhneudinsk','kiakhta','maimachin','urga','gobi','kalgan','peking'],
 'ready1904': ['london','moscow','omsk','krasnoyarsk','irkutsk','baikal','harbin','shanghai'],
 'barzini1908': ['peking','kalgan','urga','kiakhta','verkhneudinsk','baikal','irkutsk','krasnoyarsk','tomsk','omsk','ekaterinburg','perm','kazan','moscow','stpetersburg','berlin','paris'],
 'gaunt1919': ['peking','harbin','vladivostok','sakhalin','nikolaevsk','khabarovsk','blagoveshchensk','sretensk','chita','irkutsk','omsk','moscow'],
 'ward1920': ['vladivostok','khabarovsk','harbin','chita','irkutsk','krasnoyarsk','omsk','chelyabinsk','ekaterinburg'],
 'grano1893': ['helsinki','stpetersburg','moscow','nizhny','perm','ekaterinburg','tyumen','omsk','irtysh','tobolsk','tomsk','krasnoyarsk','irkutsk'],
 'donner1915': ['helsinki','tomsk','narym','tymskoye','ket','krasnoyarsk'],
 'svinhufvud1928': ['viipuri','stpetersburg','tomsk','tymskoye','narym','tomsk','kolyvan'],
 'leroybeaulieu1900': [], 'kubalski1856': [],
}
order = {p['pid']: i for i, p in enumerate(paras)}
first_by_work = defaultdict(lambda: defaultdict(list))
for m in place_mentions: first_by_work[m['work_id']][m['place_id']].append(order[m['pid']])
itins = []
present = {p['work_id'] for p in paras}
for w, stops in ROUTES.items():
    if w not in present: continue
    cur = -1
    for k, s in enumerate(stops):
        idxs = sorted(first_by_work[w].get(s, []))
        nxt = next((i for i in idxs if i >= cur), None)
        status = 'attested_in_order'
        if nxt is None and idxs: nxt, status = idxs[0], 'attested_out_of_order'
        ev = paras[nxt]['pid'] if nxt is not None else ''
        if nxt is not None and status == 'attested_in_order': cur = nxt
        if not ev: status = 'not_found_in_text' 
        pl = places[s]
        itins.append(dict(work_id=w, seq=k+1, place_id=s, label_ru=pl['label_ru'], lat=pl['lat'], lon=pl['lon'], region=pl['region'],
                          evidence_pid=ev, evidence_status=status,
                          mentions_total=len(idxs)))

# --- запись ---
def dump(path, rows):
    with open(ROOT/path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
dump('data/mentions.csv', mentions)
dump('data/place_mentions.csv', place_mentions)
dump('data/itineraries.csv', itins)
with open(ROOT/'corpus/paragraphs.jsonl', 'w', encoding='utf-8') as f:
    for p in paras: f.write(json.dumps(p, ensure_ascii=False) + '\n')

print('place mentions', len(place_mentions), '| ethnonym mentions', len(mentions),
      '| in Siberia', sum(m['in_siberia'] for m in mentions))
print('itinerary stops', len(itins), 'not found:', [(i['work_id'], i['place_id']) for i in itins if not i['evidence_pid']])
print(Counter(p['region_basis'] for p in paras if p['type'] in COUNTED))
