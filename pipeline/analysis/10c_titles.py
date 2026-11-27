"""Заглавия и выходные данные изданий для каталога и цитирования: из метаданных Internet Archive (кэш корпуса)
и заголовков Project Gutenberg. data/titles.csv: work_id, title, title_short, publisher. Ручные правки — data/titles_manual.csv."""
import csv, json, os, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
CORP = pathlib.Path(os.environ.get('CORPUS_DIR', ROOT.parent / 'siberia_corpus'))
PG = json.load(open(ROOT / 'data/_pg_headers.json'))
plan = list(csv.DictReader(open(ROOT / 'data/corpus_plan.csv')))
man = {r['work_id']: r for r in csv.DictReader(open(ROOT / 'data/titles_manual.csv'))} if (ROOT / 'data/titles_manual.csv').exists() else {}
def clean(t): return re.sub(r'\s+', ' ', str(t or '')).strip().rstrip('.')
def short(t):
    s = re.split(r'\s*[;:]\s+|\.\s+(?=[A-ZА-Я])|,\s+(?:containing|being|with|par|von|from)\b', t, maxsplit=1)[0]
    return s if len(s) >= 8 else t
out = []
for x in plan:
    w = x['work_id']; t = pub = ''
    for i in [i for i in x['ia_ids'].split(';') if i]:
        f = CORP / 'ia' / f'{i}_meta.json'
        if f.exists():
            m = json.load(open(f)); t = clean(m.get('title')); pub = clean(m.get('publisher')); break
    if not t and x['pg_id'] and x['pg_id'] in PG: t = clean(PG[x['pg_id']].get('Title', '').split('\r\n')[0])
    if w in man: t = man[w].get('title') or t; pub = man[w].get('publisher') or pub
    if t: out.append({'work_id': w, 'title': t, 'title_short': (man.get(w, {}).get('title_short') or short(t)), 'publisher': pub})
with open(ROOT / 'data/titles.csv', 'w', newline='', encoding='utf-8') as f:
    wr = csv.DictWriter(f, fieldnames=['work_id', 'title', 'title_short', 'publisher']); wr.writeheader(); wr.writerows(out)
print(len(out), 'заглавий')
