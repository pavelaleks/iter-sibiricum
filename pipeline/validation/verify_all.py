"""Проверка данных сайта по текстам корпуса. Сайт показывает только то, что прошло проверку.

Правило проекта (решение руководителя, 28.11.2026): на сайте нет непроверенных данных. Всё, что получено
языковой моделью или правилами и выдаётся за сведения о корпусе, сверяется здесь с текстами книг
(texts/*.json — те же тексты, что открываются в библиотеке). Результат — белый список
data/verification.json: сайт показывает элемент, только если он в этом списке. Новые или изменённые
в рабочем месте данные остаются скрытыми, пока скрипт не будет запущен снова.

Проверки:
  citations      ссылки на предшественников: фамилия есть в абзаце; самоупоминания исключены
                 (автор книги не «цитирует» сам себя); список «чаще всего упоминаются» строится отсюда;
  route_stops    остановки маршрутов: абзац существует, цитата дословно есть в абзаце, место названо
                 в цитате (формы названия, транслитерация, фонетическая основа — как в check_places.py);
  summaries      краткие описания поездок: каждое имя собственное в описании — остановка маршрута,
                 место, упомянутое в книге, или имя автора; каждый год лежит в пределах поездки (±1);
  group_quotes   цитаты на карточках народов: текст дословно есть в указанном абзаце;
  ill_tags       народы и места, приписанные иллюстрациям: название есть в подписи источника;
  works          годы поездки не позже года издания.
Отчёт: pipeline/validation/VERIFICATION.md. Запуск из корня: python3 pipeline/validation/verify_all.py
"""
import csv, json, re, sys, pathlib, collections, datetime, unicodedata
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'pipeline/validation'))
from check_places import fold, named, para, skel, conv  # noqa: E402

J = lambda p: json.load(open(ROOT / p, encoding='utf-8'))
W = {w['id']: w for w in J('data/works.json')}
TXT = {}
def paras(w):
    if w not in TXT:
        f = ROOT / 'texts' / f'{w}.json'
        TXT[w] = J(f'texts/{w}.json')['p'] if f.exists() else []
    return TXT[w]
def surname(a):
    a = re.sub(r'\s*\(.*?\)', '', a or '').strip()
    parts = a.split()
    if len(parts) >= 2 and parts[-2].lower() in ('de', 'von', 'van'): return ' '.join(parts[-2:])
    return parts[-1] if parts else ''
def nfd(s): return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c)).lower()
OUT = {'generated': datetime.date.today().isoformat(), 'rule': 'shown on the site only if verified against the corpus texts'}
REP = []

# ---------- 1. ссылки на предшественников ----------
AUTH = {'Gmelin': r'\bGmelin', 'Pallas': r'\bPallas\b', 'Castrén': r'\bCastr[ée]n', 'Middendorff': r'\bMiddendorf', 'Erman': r'\bErman\b',
        'Wrangell': r'\b(?:Von |von |Baron |Admiral )?Wrangell?\b(?!.{0,40}(?:Crimea|army|Denikin))', 'Atkinson': r'\bAtkinson', 'Kennan': r'\bKennan\b',
        'Lansdell': r'\bLansdell', 'Huc': r'\bHuc\b', 'Cochrane': r'\bCochrane\b', 'Dobell': r'\bDobell', 'Krasheninnikov': r'\bKrasch?h?en+in+ik',
        'Steller': r'\bSteller\b', 'Humboldt': r'\bHumboldt', 'Hansteen': r'\bHansteen', 'Dostoevsky': r'\bDosto[iy]e?vsk', 'Radloff': r'\bRadlo',
        'Michie': r'\bMichie\b', 'de Windt': r'\b[Dd]e Windt', 'Knox': r'(?<!General )(?<!Gen\. )(?<!Sir Alfred )\bKnox\b(?!,? (?:the )?British)',
        'Meignan': r'\bMeignan', 'Nansen': r'\bNansen', 'Bush (R.J.)': r'\bR\. ?J\. Bush\b', 'Ravenstein': r'\bRavenstein', 'Schrenck': r'\bSchren[ck]',
        'Maack': r'\bMaack\b', 'Ahlqvist': r'\bAhlqvist', 'Strahlenberg': r'\bStrahlenberg', 'Beniowski': r'\bBeniows', 'Krapotkin': r'\bKr[ao]potkin'}
# топонимы и предметы, названные по фамилии, — не ссылки на автора
NOT_PERSON = re.compile(r'Humboldt(?:\s+(?:Bay|River|Glacier|Current|Mountains|Range|county)|ia\b)|Pallas[’\']?s?\s+(?:cat|sand-?grouse|warbler|bunting|squirrel|iron)|Cape\s+Cochrane|Lake\s+Middendorf', re.I)
ex = collections.defaultdict(list); cnt = collections.Counter(); books = collections.defaultdict(set)
where = collections.defaultdict(list)   # (книга, авторитет) → абзацы с упоминанием: доказательства для рёбер сети
# год, с которого человек известен в связи с Сибирью и Азией (начало поездок или работы, иначе первое издание):
# книга, вышедшая раньше, не может его упоминать — совпадение фамилии означает другого человека
# (у Коцебу, 1802, «Atkinson» — художник Джон Аткинсон; у Хилла, 1854, «Knox» — не Т. Нокс).
# Берётся начало деятельности, а не год книги: Кокрейн встречал Добелла на Камчатке, Эрман ездил с Ханстеном.
AUTH_FROM = {'Strahlenberg': 1720, 'Gmelin': 1733, 'Krasheninnikov': 1737, 'Steller': 1737, 'Pallas': 1768, 'Beniowski': 1770, 'Humboldt': 1799,
             'Dobell': 1798, 'Hansteen': 1819, 'Wrangell': 1820, 'Cochrane': 1820, 'Erman': 1828, 'Castrén': 1838, 'Middendorff': 1842, 'Dostoevsky': 1846,
             'Huc': 1844, 'Atkinson': 1848, 'Schrenck': 1853, 'Maack': 1853, 'Ahlqvist': 1853, 'Ravenstein': 1855, 'Radloff': 1859, 'Michie': 1863,
             'Krapotkin': 1862, 'Kennan': 1865, 'Knox': 1866, 'Bush (R.J.)': 1865, 'Meignan': 1873, 'Lansdell': 1879, 'de Windt': 1887, 'Nansen': 1888}
for w, meta in W.items():
    own = nfd(surname(meta.get('author', '')))
    for p in paras(w):
        if p[1] not in ('t', 'n'): continue
        t = NOT_PERSON.sub(' ', p[4])
        for a, rx in AUTH.items():
            if nfd(a) == own or nfd(a.split()[-1]) == own.split()[-1]: continue  # самоупоминание
            n = len(re.findall(rx, t))
            if n:
                cnt[a] += n; books[a].add(w)
                if len(where[(w, a)]) < 15: where[(w, a)].append(p[0])
                if len(ex[a]) < 3: ex[a].append(f'{w}_p{p[0]}')
cit = sorted(({'name': a, 'books': len(books[a]), 'mentions': cnt[a], 'examples': ex[a]} for a in cnt), key=lambda x: (-x['books'], -x['mentions']))
OUT['citations'] = cit
# рёбра сети цитирований: остаются только подтверждённые (книга → авторитет/книга с этой фамилией, не сам автор)
N = J('data/networks.json')['intertext']; nodes = {n['id']: n for n in N['nodes']}
def tgt_name(t):
    n = nodes.get(t, {})
    if n.get('kind') == 'authority': return n.get('label') or t.split(':', 1)[-1]
    return surname(W.get(t, {}).get('author', ''))
ok_edges, cite_ev, anachr = [], {}, []
for l in N['links']:
    if l.get('type') != 'cites': continue
    a = tgt_name(l['target']); src = l['source']
    key = next((k for k in AUTH if nfd(k) == nfd(a) or nfd(k).split()[-1] == nfd(a).split()[-1]), None)
    if key and src in books.get(key, set()):
        if (W.get(src, {}).get('year') or 9999) < AUTH_FROM.get(key, 0):
            anachr.append(f"{src}>{l['target']}"); continue
        ok_edges.append(f"{src}>{l['target']}"); cite_ev[f"{src}>{l['target']}"] = where[(src, key)]
OUT['cite_edges'] = sorted(ok_edges)
OUT['cite_ev'] = dict(sorted(cite_ev.items()))   # абзацы, где фамилия названа (для панели сети «Связи»)
n_cites = sum(1 for l in N['links'] if l.get('type') == 'cites')
REP.append(('Ссылки на предшественников', f"{len(cit)} авторитетов; рёбер сети подтверждено {len(ok_edges)} из {n_cites} (остальные — самоупоминания, не найдены или анахронизмы: {', '.join(anachr) or 'нет'})",
            'Чаще всего (число книг других авторов): ' + ', '.join(f"{c['name']} ({c['books']})" for c in cit[:8])))

# ---------- 2. остановки маршрутов и 3. краткие описания ----------
REV = J('data/review/journeys_review.json'); PLC = {p['id']: p for p in J('data/places.json')}
stops_ok, stops_bad, summ_ok, summ_bad = [], [], {}, []
BOOKPL = J('data/bookgeo.json')
COMMON = {'Сибирь', 'Сибири', 'Россия', 'России', 'Европа', 'Европы', 'Азия', 'Азии', 'Писание', 'Писания', 'Транссиб', 'Транссибу', 'Транссибирской',
          'Север', 'Востоке', 'Восток', 'Дальний', 'Дальнего', 'Западную', 'Западной', 'Восточную', 'Восточной', 'Северный', 'Северного', 'Ледовитый', 'Ледовитого',
          'Тихий', 'Тихого', 'Великий', 'Великого', 'Писание', 'Писания', 'Евангелие', 'Священного', 'Святой', 'Святого', 'Св', 'Русско', 'Первой', 'Первая', 'Гражданской', 'Красной', 'Белой', 'Белых', 'Колчака', 'КВЖД', 'Его', 'Она', 'Он'}
SKC = {}
def book_skels(w):
    """Множество префиксов фонетических основ всех слов книги (для поиска имени в любой транскрипции)."""
    if w not in SKC:
        P = set()
        for p in paras(w):
            for t in set(fold(p[4]).split()):
                for k in {skel(t), skel(t.replace('j', 'zh'))}:  # j — «й» (нем.) или «ж» (фр.)
                    for i in range(2, min(len(k), 9) + 1): P.add(k[:i])
                    P.add('=' + k)
        SKC[w] = P
    return SKC[w]
# формы названий из газеттира (LPF до фильтрации — все написания, встреченные в книгах) и шаблоны справочника
import subprocess
TOPO = collections.defaultdict(set)
try:
    _lpf = json.loads(subprocess.run(['git', '-C', str(ROOT), 'show', 'dae0f34~1:data/export/iter-sibiricum-places.lpf.jsonld'], capture_output=True, text=True).stdout or '{}')
except Exception: _lpf = {}
for f in (_lpf.get('features') or J('data/export/iter-sibiricum-places.lpf.jsonld')['features']):
    t = fold(f['properties']['title']).split(' (')[0]
    for n in f['names']: TOPO[t].add(fold(n['toponym']))
TOPO_RX = collections.defaultdict(list)
for r in csv.DictReader(open(ROOT / 'pipeline/data/places.csv', encoding='utf-8')):
    try: TOPO_RX[fold(r['label_ru']).split(' (')[0]].append(re.compile(r['pattern']))
    except re.error: pass
for t in list(TOPO) + list(TOPO_RX):  # «санкт петербург» ищется и по «петербург»
    for part in t.split():
        if len(part) >= 5 and part != t: TOPO[part] |= TOPO[t]; TOPO_RX[part] += TOPO_RX[t]
RAW = {}
def book_rx(w, rx):
    if w not in RAW: RAW[w] = '\n'.join(p[4] for p in paras(w))
    return bool(rx.search(RAW[w]))
BOOKTXT = {}
def book_has(w, form):
    if w not in BOOKTXT: BOOKTXT[w] = ' ' + ' '.join(fold(p[4]) for p in paras(w)) + ' '
    return len(form) >= 3 and (' ' + form) in BOOKTXT[w]
def in_book_topo(w, word):
    x = fold(word); n = max(4, len(x) - 2)
    for t in set(TOPO) | set(TOPO_RX):
        if t[:n] == x[:n] or x.startswith(t[:max(4, len(t) - 1)]):
            if any(book_has(w, f) for f in TOPO.get(t, ())) or any(book_rx(w, rx) for rx in TOPO_RX.get(t, ())): return True
    return False
def in_book(word, P):
    k = skel(conv(word))
    if len(k) < 2: return True
    if len(k) == 2: return ('=' + k) in P or any(('=' + k + c) in P for c in 'aeiouy')
    return k[:9] in P or (len(k) > 4 and k[:-1][:9] in P)  # окончание падежа даёт лишнюю согласную
for w, v in REV.items():
    good_names = set()
    for s in v.get('stops', []):
        p, q = s.get('pid'), s.get('quote') or ''
        k = f"{w}:{p}:{s.get('place')}"
        t = para(w, p) if p else None
        forms = {s.get('name', '')} | ({PLC[s['place']]['name']} if s.get('place') in PLC else set())
        forms |= {conv(f) for f in list(forms) if f}
        if t and q and fold(q)[:60] in fold(t) and (named(q, forms) or named(t, forms)):
            stops_ok.append(k); good_names |= {x for f in forms for x in re.findall(r'[А-ЯЁ][а-яё\-]+', f)}
        else: stops_bad.append(k)
    sm = v.get('summary') or ''
    if not sm: continue
    meta = W.get(w, {})
    SK = book_skels(w)
    # имена собственные (кроме первого слова предложения) должны быть названы в тексте книги
    words = [m.group(0) for m in re.finditer(r'(?<![.!?]\s)(?<!^)\b[А-ЯЁ][а-яё]{2,}', sm)]
    words += [x for m in re.finditer(r'\b([А-ЯЁ][а-яё]+)-([А-ЯЁ][а-яё]+)\b', sm) for x in [m.group(1) + m.group(2)]]
    unk = [x for x in words if x not in COMMON and not in_book(x, SK) and not in_book_topo(w, x)]
    yrs = [int(y) for y in re.findall(r'\b(1[789]\d\d)\b', sm)]
    y0, y1 = meta.get('j0'), meta.get('j1') or meta.get('j0')
    bad_y = [y for y in yrs if not (y0 and y0 - 1 <= y <= (y1 or y0) + 1) and y != meta.get('year')]
    if unk or bad_y: summ_bad.append((w, unk[:6], bad_y))
    else: summ_ok[w] = sm
OUT['route_stops'] = sorted(stops_ok); OUT['route_summaries'] = summ_ok
REP.append(('Остановки маршрутов', f'подтверждено {len(stops_ok)} из {len(stops_ok) + len(stops_bad)}', 'Неподтверждённые остановки не показываются; маршрут рисуется по подтверждённым.'))
REP.append(('Краткие описания поездок', f'подтверждено {len(summ_ok)} из {len(summ_ok) + len(summ_bad)}',
            'Не прошли (первые 15): ' + '; '.join(f"{w}: {', '.join(u) or ''}{' годы ' + str(b) if b else ''}" for w, u, b in summ_bad[:15])))

# ---------- 4. цитаты на карточках народов ----------
G = J('data/groups.json'); q_ok, q_bad = [], []
for g in G:
    for qx in g.get('quotes') or []:
        pid = qx.get('pid', ''); w, _, n = pid.rpartition('_p')
        t = para(w, n) if w else None
        (q_ok if t and fold(qx.get('text', ''))[:80] in fold(t) else q_bad).append(pid)
OUT['group_quotes'] = sorted(set(q_ok))
REP.append(('Цитаты на карточках народов', f'подтверждено {len(q_ok)} из {len(q_ok) + len(q_bad)}', ''))

# ---------- 5. народы и места на иллюстрациях ----------
ETH = collections.defaultdict(list)
for r in csv.DictReader(open(ROOT / 'pipeline/data/ethnonyms.csv', encoding='utf-8')):
    try: ETH[r['group_id']].append(re.compile(r['pattern'], re.I if r['ci'] == 'True' else 0))
    except re.error: pass
for g in G:  # формы, перечисленные на карточке народа, тоже считаются
    for f in g.get('forms') or []: ETH[g['id']].append(re.compile(r'\b' + re.escape(f), re.I))
PLP = {}
for r in csv.DictReader(open(ROOT / 'pipeline/data/places.csv', encoding='utf-8')):
    try: PLP[r['place_id']] = re.compile(r['pattern'])
    except re.error: pass
ILL = J('data/illustrations.json')['items']; tags = {}; t_all = t_ok = 0
for it in ILL:
    cap = it.get('c') or ''
    g_ok = [g for g in it.get('g') or [] if any(rx.search(cap) for rx in ETH.get(g, []))]
    p_ok = [p for p in it.get('pl') or [] if p in PLP and PLP[p].search(cap)]
    t_all += len(it.get('g') or []) + len(it.get('pl') or []); t_ok += len(g_ok) + len(p_ok)
    if g_ok or p_ok: tags[it['id']] = {'g': g_ok, 'pl': p_ok}
OUT['ill_tags'] = tags
REP.append(('Народы и места на иллюстрациях', f'подтверждено подписью {t_ok} из {t_all} привязок', 'Привязки, которых нет в подписи источника, не показываются.'))

# ---------- 6. каталог ----------
wb = [w for w, m in W.items() if m.get('j1') and m.get('year') and m['j1'] > m['year']]
OUT['works_issues'] = wb
REP.append(('Каталог: годы поездки не позже издания', f'нарушений {len(wb)}', ', '.join(wb)))

# ---------- 7. разметка выборки ----------
# Оценки, рамки описания и типы отношений — суждения, которые скрипт проверить не может. Результаты на их основе
# показываются только после того, как экспертами проверены все единицы выборки (рабочее место → «Разметка»).
units = {r['unit_id'] for r in csv.DictReader(open(ROOT / 'pipeline/data/expert_annotations_v04.csv', encoding='utf-8'))}
AR = J('data/review/annotation_review.json') if (ROOT / 'data/review/annotation_review.json').exists() else {}
done = {u for u, x in AR.items() if x.get('by') and x.get('by') != 'model'}
OUT['sample_annotation'] = {'verified': bool(units) and units <= done}
REP.append(('Разметка выборки (оценки, отношения)', f'проверено экспертами {len(units & done)} из {len(units)}',
            'Результаты на её основе на сайте не показываются, пока не проверены все единицы.'))

pc = J('data/places_count.json') if (ROOT / 'data/places_count.json').exists() else {}
OUT['summary'] = [
    dict(ru='места газеттира: место названо в абзаце книги', en='gazetteer places named in a paragraph of a book', ok=pc.get('attested', 0), total=pc.get('checked', 0)),
    dict(ru='остановки маршрутов: цитата найдена в абзаце, место в ней названо', en='route stops: quotation found in the paragraph and the place named in it', ok=len(stops_ok), total=len(stops_ok) + len(stops_bad)),
    dict(ru='ссылки на предшественников: фамилия в тексте другого автора', en='references to predecessors: surname in the text of another author', ok=len(ok_edges), total=n_cites),
    dict(ru='цитаты на карточках народов', en='quotations on the profiles of peoples', ok=len(q_ok), total=len(q_ok) + len(q_bad)),
    dict(ru='народы и места на иллюстрациях: названы в подписи', en='peoples and places on illustrations: named in the caption', ok=t_ok, total=t_all)]
json.dump(OUT, open(ROOT / 'data/verification.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
md = ['# Проверка данных сайта по текстам', '', f'Дата: {OUT["generated"]}. Скрипт: `pipeline/validation/verify_all.py`. Белый список: `data/verification.json`.', '',
      '| проверка | итог | примечание |', '|---|---|---|'] + [f'| {a} | {b} | {c} |' for a, b, c in REP]
md += ['', '## Не прошедшие проверку остановки маршрутов', ''] + [f'- {k}' for k in stops_bad]
(ROOT / 'pipeline/validation/VERIFICATION.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
for a, b, c in REP: print(f'{a}: {b}' + (f' — {c[:300]}' if c else ''))
