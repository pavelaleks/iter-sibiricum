#!/usr/bin/env python3
"""Обработка очереди новых книг из рабочего места (data/review/books_queue.json сайта).

Запуск (из папки конвейера):
    python3 tools/ingest_queue.py ../site            # принять предложенные книги, скачать тексты
    bash run_all.sh                                  # полная пересборка: очистка, разметка, анализ, сайт
    python3 tools/ingest_queue.py ../site --finalize # отметить в очереди книги, попавшие в библиотеку

Что делает для каждой записи со статусом proposed:
  1. разбирает ссылку: archive.org/details/<id>, gutenberg.org/ebooks/<n>, gallica.bnf.fr/ark:/12148/<ark>;
     другие источники получают статус needs_manual (нужно найти копию в одной из трёх библиотек);
  2. присваивает идентификатор книги: фамилия автора + год (без повторов);
  3. скачивает текст: IA — распознанный текст *_djvu.txt, Gallica — texteBrut, Gutenberg — клон
     репозитория GITenberg с GitHub (сайт gutenberg.org из конвейера недоступен);
  4. добавляет строку в data/corpus_plan.csv (status=include) и data/works_meta.csv (тип поездки, годы);
  5. пишет в очередь статус queued (с work_id) или error (с причиной).
Книги, у которых текст не скачался или OCR отбракован на этапе 01, остаются в очереди с пояснением.
"""
import csv, json, re, sys, pathlib, subprocess, unicodedata, datetime, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from fetch_corpus import get  # noqa: E402

CORPUS = pathlib.Path(__import__('os').environ.get('CORPUS_DIR', ROOT.parent / 'siberia_corpus'))
RAW_PG = ROOT.parent / 'raw_repos'
NAT = {'брит': 'UK', 'англ': 'UK', 'шотл': 'UK', 'франц': 'France', 'нем': 'Germany', 'австр': 'Austria', 'итал': 'Italy', 'пол': 'Poland',
       'фин': 'Finland', 'швед': 'Sweden', 'норв': 'Norway', 'дат': 'Denmark', 'голл': 'Netherlands', 'чеш': 'Czech', 'венг': 'Hungary',
       'амер': 'USA', 'швейц': 'Switzerland', 'бельг': 'Belgium'}

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z]', '', s)

def parse_source(url):
    if m := re.search(r'archive\.org/(?:details|download)/([^/?#]+)', url): return 'archive.org', m.group(1)
    if m := re.search(r'gutenberg\.org/(?:ebooks|files|cache/epub)/(\d+)', url): return 'gutenberg', m.group(1)
    if m := re.search(r'ark:/12148/([a-z0-9]+)', url): return 'gallica', m.group(1)
    return None, None

def fetch(kind, ident):
    if kind == 'archive.org':
        (CORPUS / 'ia').mkdir(parents=True, exist_ok=True); dest = CORPUS / 'ia' / f'{ident}_djvu.txt'
        if dest.exists() and dest.stat().st_size > 1000: return True, ''
        meta = json.loads(get(f'https://archive.org/metadata/{ident}'))
        fn = next((f['name'] for f in meta.get('files', []) if f['name'].endswith('_djvu.txt')), None)
        if not fn: return False, 'в Internet Archive нет распознанного текста (_djvu.txt)'
        dest.write_bytes(get(f'https://archive.org/download/{ident}/{urllib.request.quote(fn)}'))
        return True, ''
    if kind == 'gallica':
        (CORPUS / 'gallica').mkdir(parents=True, exist_ok=True); dest = CORPUS / 'gallica' / f'{ident}.html'
        if dest.exists() and dest.stat().st_size > 1000: return True, ''
        try: dest.write_bytes(get(f'https://gallica.bnf.fr/ark:/12148/{ident}.texteBrut', timeout=300)); return True, ''
        except Exception as e: return False, f'Gallica не отдала текст ({e}); скачайте texteBrut вручную в {dest}'
    if kind == 'gutenberg':
        d = RAW_PG / ident
        if d.exists(): return True, ''
        q = subprocess.run(['gh', 'api', f'search/repositories?q=org:GITenberg+{ident}+in:name', '--jq', '.items[].name'], capture_output=True, text=True).stdout.split()
        name = next((n for n in q if n.endswith('_' + ident)), None)
        if not name: return False, f'репозиторий GITenberg для PG {ident} не найден; положите текст {ident}-0.txt в {d}'
        r = subprocess.run(['git', 'clone', '--depth', '1', f'https://github.com/GITenberg/{name}.git', str(d)], capture_output=True, text=True)
        return (r.returncode == 0), r.stderr[-200:]
    return False, 'неизвестный источник'

def main(site, finalize=False):
    qf = pathlib.Path(site) / 'data' / 'review' / 'books_queue.json'
    Q = json.load(open(qf, encoding='utf-8'))
    plan_f = ROOT / 'data' / 'corpus_plan.csv'
    plan = list(csv.DictReader(open(plan_f, encoding='utf-8'))); fields = list(plan[0].keys())
    have = {r['work_id'] for r in plan}
    if finalize:
        texts = pathlib.Path(site) / 'texts'
        for b in Q:
            if b.get('status') == 'queued' and (texts / f"{b['work_id']}.json").exists(): b['status'] = 'added'; b['added'] = datetime.date.today().isoformat()
        json.dump(Q, open(qf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print('отмечено'); return
    meta_f = ROOT / 'data' / 'works_meta.csv'; meta = list(csv.DictReader(open(meta_f, encoding='utf-8'))); mf = list(meta[0].keys())
    for b in Q:
        if b.get('status') != 'proposed': continue
        kind, ident = parse_source(b.get('source', ''))
        if not kind: b['status'] = 'needs_manual'; b['message'] = 'ссылка не на Internet Archive, Gutenberg или Gallica'; continue
        dup = next((r['work_id'] for r in plan if ident in (r['ia_ids'] or '').split(';') + (r['gallica_arks'] or '').split(';') + [r['pg_id']]), None)
        if dup: b['status'] = 'duplicate'; b['work_id'] = dup; b['message'] = f'это издание уже в корпусе ({dup})'; continue
        base = slug(b['author'].split(',')[0].split()[-1] if ',' not in b['author'] else b['author'].split(',')[0]) + str(b['year'])
        wid = base; k = 2
        while wid in have: wid = f'{base}_{k}'; k += 1
        try: ok, msg = fetch(kind, ident)
        except Exception as e: ok, msg = False, str(e)[:200]
        if not ok: b['status'] = 'error'; b['message'] = msg; continue
        nat = next((v for k2, v in NAT.items() if k2 in (b.get('nationality') or '').lower()), '')
        row = {f: '' for f in fields}
        au = b['author'].strip(); au = ' '.join(reversed([x.strip() for x in au.split(',', 1)])) if ',' in au else au  # «Lansdell, Henry» → «Henry Lansdell»
        row.update(work_id=wid, author=au, origin=nat, text_lang=b['lang'], original_lang=b['lang'], is_translation='false',
                   edition_year=str(b['year']), source=kind, status='include', genre_verdict='travelogue',
                   ia_ids=ident if kind == 'archive.org' else '', gallica_arks=ident if kind == 'gallica' else '', pg_id=ident if kind == 'gutenberg' else '',
                   notes=f"из очереди рабочего места: {b.get('by', '')}, {b.get('date', '')}; {b.get('note', '')}".strip('; '))
        plan.append(row); have.add(wid)
        js = re.findall(r'\d{4}', b.get('journey') or '')
        m = {f: '' for f in mf}; m.update(work_id=wid, nationality=b.get('nationality', ''), stay_type=b.get('stay', 'unknown'),
                                        journey_start=js[0] if js else '', journey_end=js[-1] if js else '', date_cert='medium' if js else 'unknown',
                                        meta_note='из очереди рабочего места')
        meta.append(m)
        b['status'] = 'queued'; b['work_id'] = wid; b['message'] = 'текст скачан; книга появится после пересборки (run_all.sh)'
        print('принята', wid, kind, ident)
    for f, rows, fl in [(plan_f, plan, fields), (meta_f, meta, mf)]:
        w = csv.DictWriter(open(f, 'w', encoding='utf-8', newline=''), fieldnames=fl); w.writeheader(); w.writerows(rows)
    json.dump(Q, open(qf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('очередь:', {s: sum(1 for b in Q if b.get('status') == s) for s in {b.get('status') for b in Q}})

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1], '--finalize' in sys.argv)
