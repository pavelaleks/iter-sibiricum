"""08c. Иллюстрации из HTML-изданий Project Gutenberg.

В отличие от сканов Internet Archive (08a), в HTML-изданиях Gutenberg изображения уже
вырезаны волонтёрами Distributed Proofreaders, а подписи набраны текстом. Программа:
1) находит в HTML все <img>, отбрасывает обложки, виньетки, буквицы и значки (по имени файла,
   alt-тексту и размеру изображения: короче 160 px по одной из сторон);
2) берёт подпись из блока рисунка (div.caption, figcaption, p.caption, <b> внутри p.figure,
   следующий абзац с классом caption), а если её нет — из alt, если alt не служебный;
3) номер страницы — по ближайшей предшествующей метке pagenum;
4) привязывает рисунок к абзацу корпуса: голосование 4-граммами по тексту соседних абзацев HTML;
5) сохраняет превью WebP (640 px по длинной стороне) в site_data/img/ill/{work}/.

Вход: ../raw_repos/{pg_id}/{pg_id}-h/*.htm, corpus/paragraphs.jsonl, data/works.csv.
Выход: data/illustrations_gutenberg.csv (те же поля, что у 08a, source=gutenberg).
"""
import csv, json, pathlib, re, collections
from bs4 import BeautifulSoup
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT.parent / 'raw_repos'
OUT = ROOT / 'site_data' / 'img' / 'ill'
SKIP = re.compile(r'cover|title|deco|logo|signet|finis|enlarge|ornament|vignet|illo\.|tailpiece|headpiece|dropcap|initial|border|line\.|rule', re.I)
SKIP_ALT = re.compile(r'^(decorative|deco|logo|signet|cover|book cover|title|enlarge|ornament|illustration|image|picture|hand drawing|\d+\s*)$', re.I)
FIELDS = ['ill_id', 'work_id', 'ia', 'leaf', 'kind', 'caption', 'facing_page', 'pid', 'groups', 'thumb', 'thumb_w', 'thumb_h',
          'rotated', 'area', 'status', 'source', 'src_url']

def words(t): return re.findall(r'\w+', t.lower())
def shingles(t, n=4):
    w = words(t); return {' '.join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}

def caption_of(img):
    box = img.find_parent(['div', 'figure', 'p', 'td', 'table'])
    if box is not None:
        for sel in ['figcaption', '.caption', '.figcaption', '.ic002', '.ic001', '.ic003', 'b', '.smcap']:
            c = box.select_one(sel)
            if c and c.get_text(' ', strip=True): return c.get_text(' ', strip=True)
        nx = box.find_next_sibling()
        if nx is not None and nx.name in ('p', 'div') and 'caption' in ' '.join(nx.get('class', [])):
            return nx.get_text(' ', strip=True)
        t = box.get_text(' ', strip=True)
        if 3 < len(t) < 200 and box.name in ('div', 'figure'): return t
    alt = (img.get('alt') or img.get('title') or '').strip()
    if alt and not SKIP_ALT.match(alt) and not re.fullmatch(r'[\w-]+', alt) or (alt and ' ' in alt and not SKIP_ALT.match(alt)):
        return alt
    return ''

def split_plate(im):
    """Скан целой вклейки (у Гонт): фотографии — полосы строк с плотной «краской», подпись — текст под каждой (Tesseract)."""
    import numpy as np, subprocess, tempfile
    g = im.convert('L'); a = np.asarray(g).astype(float); bg = np.percentile(a, 90); rows = (a < bg - 55).mean(1)
    seg, on = [], False
    for i, v in enumerate(list(rows) + [0]):
        if v > 0.25 and not on: s0, on = i, True
        elif v <= 0.25 and on:
            if i - s0 > 0.12 * len(rows): seg.append((s0, i))
            on = False
    out = []
    for k, (y0, y1) in enumerate(seg):
        y2 = seg[k + 1][0] if k + 1 < len(seg) else len(rows)
        crop = g.crop((0, y1, g.size[0], min(y2, y1 + int(0.12 * len(rows)))))
        with tempfile.NamedTemporaryFile(suffix='.png') as f:
            crop.save(f.name); txt = subprocess.run(['tesseract', f.name, '-', '--psm', '6'], capture_output=True, text=True).stdout
        txt = re.sub(r'\s+', ' ', re.split(r'See page|See p\.', txt)[0]).strip(' .,—-|')
        cols = (a[y0:y1] < bg - 55).mean(0); xs = [i for i, v in enumerate(cols) if v > 0.2]
        box = (max(0, xs[0] - 4), y0, min(g.size[0], xs[-1] + 4), y1) if xs else (0, y0, g.size[0], y1)
        out.append((im.crop(box), txt))
    return out

def kind_of(c):
    c = c.lower()
    if re.search(r'\bmap\b|karte|carte|route|plan of|kartta|kart\b', c): return 'map'
    if re.search(r'portrait|bildnis|^(mr|mrs|col|general|captain|prince|fürst|m\.)\b', c): return 'portrait'
    if re.search(r'men|women|woman|girl|boy|children|natives|family|group|type|chief|priest|shaman|convict|prisoner|soldier|peasant|yakut|buriat|tungus|kirghiz|samoyed|ostiak|chukchi|gilyak|cossack|tartar|mongol|chinese|frau|leute|männer|femmes|hommes', c): return 'people'
    if re.search(r'view|town|village|river|lake|mountain|street|church|station|bridge|house|monastery|ansicht|stadt|dorf|fluss|vue|ville|église|camp', c): return 'view'
    return 'other'

def main():
    works = list(csv.DictReader(open(ROOT / 'data' / 'works.csv', encoding='utf-8')))
    pg = {w['work_id']: w['pg_id'] for w in works if w['pg_id'] and not w['ia_ids']}
    paras = collections.defaultdict(list)
    for line in open(ROOT / 'corpus' / 'paragraphs.jsonl', encoding='utf-8'):
        q = json.loads(line)
        if q['work_id'] in pg and q['type'] == 'text' and q['words'] >= 12: paras[q['work_id']].append((q['pid'], shingles(q['text'])))
    rows = []
    for wid, pid in sorted(pg.items()):
        hs = sorted((RAW / pid).glob(f'{pid}-h/*.htm*'))
        if not hs: print(wid, pid, 'нет HTML'); continue
        html = hs[0]; soup = BeautifulSoup(open(html, encoding='utf-8', errors='replace').read(), 'html.parser')
        idx = collections.defaultdict(set)
        for p, sh in paras[wid]:
            for s in sh: idx[s].add(p)
        n = 0
        for img in soup.find_all('img'):
            src = img.get('src') or ''
            # если рядом ссылка на полноразмерный файл — берём его
            a = img.find_parent('a'); full = a.get('href') if a is not None and re.search(r'\.(jpe?g|png|gif)$', a.get('href') or '', re.I) else ''
            path = html.parent / (full or src)
            if not path.exists(): path = html.parent / src
            if SKIP.search(pathlib.Path(src).name) or not path.exists(): continue
            try: im = Image.open(path); im.load()
            except Exception: continue
            if min(im.size) < 160: continue
            cap = re.sub(r'\s+', ' ', caption_of(img)).strip()
            if SKIP_ALT.match(cap or 'x'): cap = ''
            if re.fullmatch(r'\d+\s*', cap or ''): cap = ''
            # страница: ближайшая предшествующая метка pagenum / Page_N
            pg_lab = ''
            for prev in img.find_all_previous(attrs={'id': re.compile(r'(Page|Seite|page|Sivu)_?\w+')}, limit=1):
                pg_lab = re.sub(r'^\D+', '', prev.get('id'))
            # абзац: соседние абзацы HTML (2 до, 2 после) → голосование 4-граммами
            ctx = [p.get_text(' ', strip=True) for p in img.find_all_previous('p', limit=3)] + [p.get_text(' ', strip=True) for p in img.find_all_next('p', limit=3)]
            vote = collections.Counter()
            for k, t in enumerate(ctx):
                for s in shingles(t):
                    for p in idx.get(s, ()): vote[p] += 1 if k in (0, 3) else 0.6
            ppid = vote.most_common(1)[0][0] if vote and vote.most_common(1)[0][1] >= 4 else ''
            parts = split_plate(im) if not cap and im.size[1] > 1.4 * im.size[0] else [(im, cap)]
            for im1, cap1 in parts:
                n += 1; ill_id = f'{wid}-g{n:03d}'
                im1 = im1.convert('RGB'); r = 640 / max(im1.size)
                if r < 1: im1 = im1.resize((round(im1.size[0] * r), round(im1.size[1] * r)), Image.LANCZOS)
                (OUT / wid).mkdir(parents=True, exist_ok=True)
                t = f'img/ill/{wid}/{ill_id}.webp'; im1.save(ROOT / 'site_data' / t, 'WEBP', quality=68, method=6)
                rows.append(dict(ill_id=ill_id, work_id=wid, ia='', leaf=0, kind=kind_of(cap1), caption=cap1, facing_page=pg_lab, pid=ppid,
                                 groups='', thumb=t, thumb_w=im1.size[0], thumb_h=im1.size[1], rotated=0, area=1.0, status='auto',
                                 source='gutenberg', src_url=f'https://www.gutenberg.org/ebooks/{pid}'))
        print(wid, pid, n, 'изображений;', sum(1 for r in rows if r['work_id'] == wid and r['caption']), 'с подписью;',
              sum(1 for r in rows if r['work_id'] == wid and r['pid']), 'привязано к абзацу')
    w = csv.DictWriter(open(ROOT / 'data' / 'illustrations_gutenberg.csv', 'w', encoding='utf-8', newline=''), fieldnames=FIELDS)
    w.writeheader(); w.writerows(rows); print('всего', len(rows))

if __name__ == '__main__':
    main()
