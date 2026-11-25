"""Этап 1 (v0.2): сбор и очистка текстов по плану корпуса data/corpus_plan.csv.

Источники:
  gutenberg   – клоны GITenberg в RAW_PG (вычитанный текст: срезаются только служебные части PG);
  archive.org – файлы *_djvu.txt в CORPUS_DIR/ia (скачиваются tools/fetch_corpus.py), очистка analysis/ocr_clean.py;
  gallica     – *.html (texteBrut) в CORPUS_DIR/gallica, HTML → текст → ocr_clean.
Тома одного произведения склеиваются по порядку ia_ids. Произведения со status=reject пропускаются.
Выход: corpus/clean/<work_id>.txt, data/ocr_quality.csv, data/works.csv (паспорта для следующих шагов).
"""
import os, re, csv, json, html, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from ocr_clean import strip_google, clean as ocr_clean, quality

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW_PG = pathlib.Path(os.environ.get('RAW_PG', '/home/claude/raw_repos'))
CORPUS_DIR = pathlib.Path(os.environ.get('CORPUS_DIR', '/mnt/user-data/uploads/siberia_corpus'))
OUT = ROOT/'corpus/clean'; OUT.mkdir(parents=True, exist_ok=True)

def pg_text(pg):
    d = RAW_PG/str(pg)
    for name, enc in [(f'{pg}-0.txt', 'utf-8'), (f'{pg}-8.txt', 'latin-1'), (f'{pg}.txt', 'utf-8')]:
        p = d/name
        if p.exists():
            raw = p.read_bytes()
            try: t = raw.decode(enc)
            except UnicodeDecodeError: t = raw.decode('latin-1')
            s = re.search(r'\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG.*?\*\*\*', t, re.I)
            e = re.search(r'\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG', t, re.I)
            return t[s.end() if s else 0: e.start() if e else len(t)].replace('\r\n', '\n').strip()
    return None

def gallica_text(path):
    h = path.read_text(encoding='utf-8', errors='replace')
    h = re.sub(r'(?is)<(script|style).*?</\1>', ' ', h)
    h = re.sub(r'(?i)<br\s*/?>|</p>|<hr[^>]*>', '\n', h); h = re.sub(r'<[^>]+>', ' ', h)
    return html.unescape(h)

OBS = lambda origin: 'europe_finland' if 'Finland' in origin else 'europe_poland' if origin.startswith('Poland') else 'europe_west'

def main():
    plan = [r for r in csv.DictReader(open(ROOT/'data/corpus_plan.csv', encoding='utf-8')) if r['status'] in ('include', 'check')]
    old = {r['work_id']: r for r in csv.DictReader(open(ROOT/'data/works_v01.csv', encoding='utf-8'))} if (ROOT/'data/works_v01.csv').exists() else {}
    qrows, works, missing = [], [], []
    for r in plan:
        wid, lang = r['work_id'], r['text_lang'] or 'en'
        if r['source'] == 'gutenberg':
            t = pg_text(r['pg_id']); log, q = {}, quality(t or '', lang)
            if t is None: missing.append(wid); continue
        else:
            parts = []
            for ia in filter(None, r['ia_ids'].split(';')):
                p = CORPUS_DIR/'ia'/f'{ia}_djvu.txt'
                if p.exists(): parts.append(strip_google(p.read_text(encoding='utf-8', errors='replace'))[0])  # дисклеймер в каждом томе
            for ark in filter(None, r['gallica_arks'].split(';')):
                p = CORPUS_DIR/'gallica'/f"{ark.replace('/', '_')}.html"
                if p.exists(): parts.append(gallica_text(p))
            if not parts and r['pg_id'] and pg_text(r['pg_id']):  # fallback: Gutenberg copy of the same edition
                t = pg_text(r['pg_id']); log, q = {'fallback': 'gutenberg'}, quality(t, lang)
            elif not parts: missing.append(wid); continue
            else:
                t, log, q = ocr_clean('\n\n'.join(parts), lang)
            if q['verdict'] == 'reject':
                qrows.append(dict(work_id=wid, **q, log=json.dumps(log), action='excluded: OCR quality')); continue
        (OUT/f'{wid}.txt').write_text(t, encoding='utf-8')
        qrows.append(dict(work_id=wid, **q, log=json.dumps(log), action='included'))
        o = old.get(wid, {})
        works.append(dict(work_id=wid, pg_id=r['pg_id'] or '', ia_ids=r['ia_ids'], author=r['author'], author_dates=o.get('author_dates', ''),
                          observer_origin=r['origin'], observer_group=OBS(r['origin']), text_language=lang, original_language=r['original_lang'] or lang,
                          is_translation=r['is_translation'] or 'false', translator=o.get('translator', ''), edition_year=r['edition_year'],
                          edition_place=r['edition_place'], journey_start=o.get('journey_start', ''), journey_end=o.get('journey_end', ''),
                          journey_date_certainty=o.get('journey_date_certainty', 'unknown'), genre=r['genre_verdict'], author_role=o.get('author_role', ''),
                          route_summary=o.get('route_summary', ''), corpus_role='core' if r['genre_verdict'].startswith(('travelogue', 'exile', 'POW', 'voyage', 'military', 'war', 'travel diary', 'travel letters', 'travel memoir')) else 'flagged:' + r['genre_verdict'],
                          source=r['source'], source_notes=r['notes']))
    for path, rows in [('data/ocr_quality.csv', qrows), ('data/works.csv', works)]:
        with open(ROOT/path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print(f'works ready: {len(works)} | missing texts: {len(missing)} → {missing}')

if __name__ == '__main__':
    main()
