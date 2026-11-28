"""Проверка мест газеттира по текстам корпуса.

Правило (решение руководителя проекта, 28.11.2026): в газеттир и во все счётчики на сайте входят только
места, засвидетельствованные текстом, то есть такие, для которых найден хотя бы один абзац корпуса, где
место названо. Проверка автоматическая и повторяемая:

* место справочника (src=gazetteer) засвидетельствовано, если хотя бы в одном абзаце, указанном в
  pipeline/data/place_mentions.csv, действительно встречается записанная форма названия;
* остановка маршрута (src=route_stop) засвидетельствована, если указанный абзац существует, приведённая
  цитата дословно в нём есть и в цитате (или абзаце) встречается название места в одной из форм:
  x

Выход:
  pipeline/validation/places_attestation.csv  — по месту: статус и абзац-подтверждение;
  pipeline/validation/places_attestation.md   — сводка и список мест без подтверждения (для ручной проверки);
  data/places_count.json                      — число засвидетельствованных мест (читается сайтом).
Запуск: python3 pipeline/validation/check_places.py [--filter-export]
  --filter-export  удалить из data/export/iter-sibiricum-places.lpf.jsonld места без подтверждения.
"""
import csv, json, re, sys, pathlib, unicodedata, collections, difflib
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'pipeline' / 'i18n'))
from translit import conv  # noqa: E402

def fold(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'[\s\-‐‑–—]+', ' ', re.sub(r"[^\w\s\-]", ' ', s)).strip()

TXT = {}
def para(w, pid):
    if w not in TXT:
        f = ROOT / 'texts' / f'{w}.json'
        TXT[w] = {p[0]: p[4] for p in json.load(open(f, encoding='utf-8'))['p']} if f.exists() else {}
    return TXT[w].get(pid)

SERV = {'р', 'оз', 'о', 'г', 'с', 'д', 'ст', 'мыс', 'гора', 'хребет', 'хр', 'залив', 'бухта', 'перевал', 'долина', 'river', 'lake', 'mount', 'cape', 'gulf',
        'bay', 'range', 'island', 'islands', 'station', 'pass', 'valley', 'the', 'of', 'mouth', 'post', 'mine', 'monastery'}
def stems(forms):
    out = set()
    for f in forms:
        for w in fold(f).split():
            if len(w) >= 4 and w not in SERV: out.add(w)
    return out

def skel(w):
    """Грубый фонетический ключ: разные транскрипции (Kongoor / Kungur, Kusnetzk / Kuznetsk, Tcherdine / Cherdyn) дают одну основу."""
    w = fold(w).replace(' ', '')
    for a, b in (('dzh', 'c'), ('dsch', 'c'), ('dj', 'c'), ('dz', 'c'), ('shch', 'c'), ('tsch', 'c'), ('sch', 'c'), ('tch', 'c'), ('tsh', 'c'), ('ch', 'c'), ('sh', 'c'),
                 ('zh', 'c'), ('kh', 'k'), ('tz', 'c'), ('ts', 'c'), ('ph', 'f'), ('ck', 'k')):
        w = w.replace(a, b)
    tr = str.maketrans({'g': 'k', 'q': 'k', 'h': 'k', 'x': 'k', 'z': 's', 'w': 'v', 'b': 'p', 'd': 't', 'j': '', 'y': '', 'ь': '', 'ъ': ''})
    w = w.translate(tr)
    w = re.sub(r'[aeiouäöüéèêëàâîïôûùæœ]', '', w)
    return re.sub(r'(.)\1+', r'\1', w)

def named(text, forms):
    t = fold(text)
    if not t: return False
    for f in forms:
        ff = fold(f)
        if len(ff) >= 3 and re.search(r'(?<!\w)' + re.escape(ff), t): return True
    tw = t.split(); words = set(tw) | {a + b for a, b in zip(tw, tw[1:])}  # «Golo-oustnaia» → golooustnaia
    st = stems(forms)
    for s in st:
        k = s[:max(4, int(len(s) * .7))]
        for w in words:
            if w.startswith(k) or (abs(len(w) - len(s)) <= 3 and difflib.SequenceMatcher(None, w[:len(s)], s).ratio() >= .8): return True
    sk = {x for x in (skel(s) for s in st) if len(x) >= 3}
    for w in words:
        ws = skel(w)
        if len(ws) == 2 and any(ws == x and w[0] == s[0] for s in st for x in [skel(s)]): return True  # Kiov / Kiew = Киев
        if len(ws) < 3: continue
        for x in sk:
            if ws.startswith(x) or (len(x) >= 4 and difflib.SequenceMatcher(None, ws[:len(x) + 1], x).ratio() >= .85): return True
    return False

def main():
    lpf_path = ROOT / 'data/export/iter-sibiricum-places.lpf.jsonld'
    L = json.load(open(lpf_path, encoding='utf-8'))
    PM = collections.defaultdict(list)
    for r in csv.DictReader(open(ROOT / 'pipeline/data/place_mentions.csv', encoding='utf-8')):
        PM[r['place_id']].append(r)
    REV = json.load(open(ROOT / 'data/review/journeys_review.json', encoding='utf-8'))
    STOPS = collections.defaultdict(list)
    for w, v in REV.items():
        for s in v.get('stops', []):
            STOPS[str(s['place'])].append((w, s))
    rows = []; keep = []
    for f in L['features']:
        fid = f['@id'].split('#', 1)[1]; src = f['properties']['src']; title = f['properties']['title']
        forms = {title, conv(title)} | {n['toponym'] for n in f['names']}
        st, ev, why = 'не подтверждено', '', ''
        if src == 'gazetteer':
            n_ok = 0
            for r in PM.get(fid, []):
                t = para(r['work_id'], r['pid'].split('_p')[-1])
                if t and fold(r['form']) in fold(t):
                    n_ok += 1
                    if not ev: ev = f"{r['work_id']}:{r['pid'].split('_p')[-1]}"
            if n_ok: st, why = 'подтверждено', f'{n_ok} абзацев с названием'
            else: why = 'ни в одном указанном абзаце форма названия не найдена'
        else:
            pid_place = 'new:' + fid[len('route-'):] if fid.startswith('route-') else fid
            cands = STOPS.get(pid_place, [])
            if not cands: why = 'нет остановки маршрута с этим местом'
            for w, s in cands:
                p = s.get('pid'); q = s.get('quote') or ''
                forms2 = forms | {s.get('name', '')}
                if not p: why = why or 'у остановки нет абзаца'; continue
                t = para(w, p)
                if t is None: why = f'абзац {w}:{p} не найден в тексте'; continue
                if q and fold(q)[:60] not in fold(t): why = f'цитата не найдена в абзаце {w}:{p}'; continue
                if named(q or t, forms2) or named(t, forms2):
                    st, ev, why = 'подтверждено', f'{w}:{p}', 'название есть в подтверждающем абзаце'; break
                why = f'в абзаце {w}:{p} название не опознано автоматически'
        rows.append(dict(place=fid, title=title, src=src, status=st, evidence=ev, reason=why))
        if st == 'подтверждено': keep.append(f)
    out = ROOT / 'pipeline/validation'
    with open(out / 'places_attestation.csv', 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    c = collections.Counter((r['src'], r['status']) for r in rows)
    ok = [r for r in rows if r['status'] == 'подтверждено']; bad = [r for r in rows if r['status'] != 'подтверждено']
    gz = sum(1 for r in ok if r['src'] == 'gazetteer'); rs = len(ok) - gz
    md = ['# Места, засвидетельствованные текстами', '',
          f'Проверено мест: {len(rows)}. Подтверждено абзацем источника: **{len(ok)}** '
          f'(справочник проекта — {gz}, остановки маршрутов — {rs}). Без подтверждения: {len(bad)}.', '',
          'Правило: место входит в газеттир, если найден хотя бы один абзац корпуса, где оно названо. '
          'Места без подтверждения из экспорта исключаются и ждут ручной проверки.', '',
          '| src | статус | число |', '|---|---|---|'] + [f'| {a} | {b} | {n} |' for (a, b), n in sorted(c.items())] + [
          '', '## Без подтверждения', '', '| место | название | причина |', '|---|---|---|'] + [
          f"| {r['place']} | {r['title']} | {r['reason']} |" for r in bad]
    (out / 'places_attestation.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    json.dump(dict(attested=len(ok), gazetteer=gz, route_stops=rs, checked=len(rows), rule='place named in at least one corpus paragraph'),
              open(ROOT / 'data/places_count.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if '--filter-export' in sys.argv:
        L['features'] = keep
        json.dump(L, open(lpf_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'подтверждено {len(ok)} из {len(rows)} (справочник {gz}, маршруты {rs}); без подтверждения {len(bad)}')
    for r in bad[:40]: print(' -', r['place'], r['title'], '|', r['reason'])

if __name__ == '__main__':
    main()
