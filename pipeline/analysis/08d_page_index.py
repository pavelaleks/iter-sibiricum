"""08d. Соответствие абзацев библиотеки страницам сканов Internet Archive.

Для каждой книги со сканом IA: текст страниц из djvu.xml (тот же разбор, что в 08a) → для каждого абзаца
корпуса ищется страница, где встречаются 4-граммы его первых слов. Поиск идёт по порядку книги
(окно от текущей страницы на 2 назад и 25 вперёд), поэтому страницы не «прыгают»; если совпадений мало,
абзац наследует страницу предыдущего. Многотомные издания рассматриваются как одна последовательность томов.

Выход: ../site/data/pages/{work}.json = {"v": [ia томов], "s": [[номер абзаца, том, страница n], …]} —
только абзацы, с которых начинается новая страница (сжато); validation/page_index.json — доля уверенных привязок.
Сайт показывает в библиотеке метки страниц и скан страницы рядом с текстом.
"""
import csv, json, pathlib, re, collections, sys, importlib.util
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('a08', ROOT / 'analysis' / '08a_illustrations.py')
A = importlib.util.module_from_spec(spec); sys.argv = [sys.argv[0]]; spec.loader.exec_module(A)
OUT = ROOT.parent / 'site' / 'data' / 'pages'

def toks(t): return re.findall(r'[^\W\d_]{2,}', t.lower())
def grams(w, n=3): return {' '.join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    works = [w for w in csv.DictReader(open(ROOT / 'data' / 'works.csv', encoding='utf-8')) if w['ia_ids']]
    paras = collections.defaultdict(list)
    for line in open(ROOT / 'corpus' / 'paragraphs.jsonl', encoding='utf-8'):
        q = json.loads(line); paras[q['work_id']].append((int(q['para_n']), q['text']))
    stats = {}
    for w in works:
        vols = [x for x in w['ia_ids'].split(';') if x]
        seq = []  # (том, n, множество триграмм страницы)
        for vi, ia in enumerate(vols):
            dj = A.ia_file(ia, '_djvu.xml')
            if not dj: continue
            for n, (W, H, L) in enumerate(A.read_pages(dj)):
                seq.append((vi, n, grams(toks(' '.join(b[4] for b in L)))))
        if not seq: stats[w['work_id']] = 'нет djvu.xml'; continue
        inv = collections.defaultdict(list)
        for k, (_, _, gg) in enumerate(seq):
            for x in gg: inv[x].append(k)
        cur, out, sure, last, nlong = 0, [], 0, None, 0
        for pn, text in sorted(paras[w['work_id']]):
            g = grams(toks(text)[:25])
            best, bs = cur, 0
            if len(g) >= 3:
                for k in range(max(0, cur - 2), min(len(seq), cur + 26)):
                    s = len(g & seq[k][2])
                    if s > bs: best, bs = k, s
            if bs < max(3, 0.35 * len(g)) and len(g) >= 8:
                # потеряли место (вступление, перестановки): поиск по всей книге
                cnt = collections.Counter(k for x in g for k in inv.get(x, ()))
                if cnt:
                    k, sc = cnt.most_common(1)[0]
                    if sc >= max(5, 0.5 * len(g)): best, bs = k, sc
            nlong += len(g) >= 8
            if bs >= max(3, 0.35 * len(g)): cur = best; sure += len(g) >= 8
            key = (seq[cur][0], seq[cur][1])
            if key != last: out.append([pn, key[0], key[1]]); last = key
        stats[w['work_id']] = round(sure / max(1, nlong), 3)  # доля длинных абзацев, найденных на странице уверенно
        f = OUT / f"{w['work_id']}.json"
        if stats[w['work_id']] >= 0.6: json.dump(dict(v=vols, s=out), open(f, 'w', encoding='utf-8'), separators=(',', ':'))
        else: f.unlink(missing_ok=True)  # текст корпуса и скан не совпадают — не публикуем
        print(w['work_id'], len(vols), 'том(а)', len(seq), 'стр.', 'уверенно:', stats[w['work_id']], flush=True)
    json.dump(stats, open(ROOT / 'validation' / 'page_index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
