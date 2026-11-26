"""08a. Иллюстрации и карты из сканов Internet Archive.

Для каждого тома IA:
 1. djvu.xml (слова с координатами) → страницы-кандидаты: мало текста (вклейка)
    или большой пустой от текста просвет (иллюстрация в тексте);
 2. миниатюра страницы (w=400) → графическая область: связная «краска» вне
    строк текста; отсев обложек, служебных листов, пустых страниц;
 3. подпись — строки OCR непосредственно под/над областью; для повёрнутых
    вклеек (альбомная иллюстрация на книжной странице) ориентация
    определяется Tesseract OSD, изображение поворачивается, подпись
    распознаётся заново;
 4. привязка к абзацу библиотеки — по совпадению 4-грамм текста этой и
    соседних страниц с абзацами corpus/paragraphs.jsonl;
 5. тип (карта / люди / вид / прочее), народы и места — по подписи и
    словарям проекта (data/ethnonyms.csv, data/places.csv).

Выход: data/illustrations.csv, site_data/illustrations.json,
       site_data/img/ill/<work>/<ill_id>.webp (640 px по длинной стороне),
       validation/illustrations_report.md
Кэш сканов: $ILL_CACHE (по умолчанию /home/claude/illus).
Запуск: python3 analysis/08a_illustrations.py [work_id ...]
"""
import csv, json, os, re, sys, subprocess, statistics as st, collections, unicodedata, pathlib, io
import concurrent.futures as cf
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi
from lxml import etree

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = pathlib.Path(os.environ.get('ILL_CACHE', '/home/claude/illus'))
OUT_IMG = ROOT / 'site_data' / 'img' / 'ill'
CROP = int(os.environ.get('ILL_CROP', 640))  # длинная сторона сохраняемого изображения, px
TESS = {'en': 'eng', 'fr': 'fra', 'de': 'deu', 'it': 'ita', 'pl': 'pol', 'nl': 'nld', 'ru': 'rus'}

# ---------- загрузка ----------
def curl(url, path, timeout=300):
    path = pathlib.Path(path)
    if path.exists() and path.stat().st_size > 500:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.part')
    r = subprocess.run(['curl', '-s', '-f', '-L', '-m', str(timeout), '-o', str(tmp), url])
    if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 500:
        tmp.rename(path); return path
    tmp.unlink(missing_ok=True); return None

def ia_file(ia, suffix):
    dest = CACHE / 'ia' / ia / f'{ia}{suffix}'
    got = curl(f'https://archive.org/download/{ia}/{ia}{suffix}', dest)
    if got: return got
    # у части фондов (Digital Library of India и др.) файлы названы не по идентификатору
    meta = curl(f'https://archive.org/metadata/{ia}', CACHE / 'ia' / ia / 'meta.json', 60)
    try: names = [f['name'] for f in json.load(open(meta))['files'] if f['name'].endswith(suffix)]
    except Exception: names = []
    for nm in names[:1]:
        from urllib.parse import quote
        return curl(f'https://archive.org/download/{ia}/{quote(nm)}', dest)
    return None

def page_img(ia, n, w):
    return curl(f'https://archive.org/download/{ia}/page/n{n}_w{w}.jpg', CACHE / 'thumbs' / ia / f'n{n}_w{w}.jpg', 90)

# ---------- разметка djvu ----------
def read_pages(path):
    P = []
    for _, obj in etree.iterparse(str(path), tag='OBJECT', huge_tree=True, recover=True):
        W = int(obj.get('width') or 0); H = int(obj.get('height') or 0); L = []
        for ln in obj.iter('LINE'):
            ws = []
            for w in ln.iter('WORD'):
                c = (w.get('coords') or '').split(',')
                if len(c) >= 4 and w.text and w.text.strip():
                    x0, y1, x1, y0 = map(int, c[:4]); ws.append((x0, y0, x1, y1, w.text.strip()))
            if ws:
                L.append((min(a[0] for a in ws), min(a[1] for a in ws), max(a[2] for a in ws), max(a[3] for a in ws),
                          ' '.join(a[4] for a in ws)))
        P.append((W, H, sorted(L, key=lambda b: b[1])))
        obj.clear()
    return P

def scan_types(path):
    """pageType для страниц, попавших в книгу (addToAccessFormats != false), по порядку."""
    if not path: return None
    try: t = etree.parse(str(path))
    except Exception: return None
    out = []
    for pg in t.iter('page'):
        acc = pg.findtext('addToAccessFormats')
        if acc and acc.strip().lower() == 'false': continue
        out.append((pg.findtext('pageType') or '').strip())
    return out

def candidates(P):
    full = [p for p in P if len(p[2]) >= 20]
    if not full: return []
    lh = st.median([st.median([b[3] - b[1] for b in p[2]]) for p in full])
    C = []
    for i, (W, H, L) in enumerate(P):
        if not W: continue
        B = [b for b in L if (b[3] - b[1]) < 6 * lh]
        nchar = sum(len(b[4]) for b in B)
        gaps, prev = [], 0.06 * H
        for b in B:
            if b[1] - prev > 0.16 * H: gaps.append((prev, b[1]))
            prev = max(prev, b[3])
        if 0.94 * H - prev > 0.16 * H: gaps.append((prev, 0.94 * H))
        kind = 'plate' if (len(B) <= 8 and nchar < 400) else ('inline' if gaps else None)
        if kind: C.append(dict(n=i, W=W, H=H, kind=kind, lines=B))
    return C

# ---------- графическая область ----------
def find_figure(img_path, W, H, lines):
    im = Image.open(img_path).convert('L'); a = np.asarray(im, dtype=np.float32)
    h, w = a.shape; sx, sy = w / W, h / H
    bg = float(np.percentile(a, 90))
    if bg < 120: return None  # тёмная страница: обложка, форзац, цветовая шкала
    ink = a < (bg - 55)
    for x0, y0, x1, y1, _ in lines:
        ink[max(0, int(y0 * sy) - 3):min(h, int(y1 * sy) + 3), max(0, int(x0 * sx) - 3):min(w, int(x1 * sx) + 3)] = False
    m = int(0.03 * w); ink[:, :m] = False; ink[:, w - m:] = False
    ink[:int(0.02 * h)] = False; ink[h - int(0.02 * h):] = False
    if ink.mean() < 0.01: return None
    lab, n = ndi.label(ndi.binary_dilation(ink, iterations=max(2, w // 80)))
    if not n: return None
    k = int(np.argmax(ndi.sum(ink, lab, range(1, n + 1)))) + 1
    ys, xs = np.where(lab == k)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    area = (y1 - y0) * (x1 - x0) / (w * h); dens = float(ink[y0:y1 + 1, x0:x1 + 1].mean())
    if area < 0.06 or (y1 - y0) < 0.08 * h or (x1 - x0) < 0.2 * w or dens < 0.04: return None
    # крупная область с плотной заливкой по всей странице — чаще всего обложка/переплёт
    if area > 0.8 and dens > 0.45: return None
    return dict(bbox=[int(x0 / sx), int(y0 / sy), int(x1 / sx), int(y1 / sy)], area=round(float(area), 3), dens=round(dens, 3))

# ---------- подписи ----------
SERVICE = re.compile(r'digiti[sz]ed|internet archive|library|biblioth|presented to|university of|google|'
                     r'universit[äa]t|stamp|ex libris|property of|archive\.org|\bMDZ\b|test target|image evaluation|microfiche|'
                     r'microfilm|\bCIHM\b|\bICMH\b|canadian institute|photographic sciences', re.I)
FACING = re.compile(r'\b(?:to\s+face\s+)?(?:page|p\.|pag\.|seite|s\.)\s*([0-9ivxlc]{1,4})\.?\s*$|'
                    r'^\s*(?:to\s+face\s+)?(?:page|p\.|seite)\s*([0-9ivxlc]{1,4})\.?', re.I)
RUNNING = re.compile(r'^\s*\d{1,4}\s+[A-ZÀ-Ý ]{4,}|[A-ZÀ-Ý ]{4,}\.?\s+\d{1,4}\s*$')

def clean_caption(lines):
    facing = None; out = []
    for t in lines:
        t = re.sub(r'\s+', ' ', t).strip(' .,;:-—|')
        m = FACING.search(t)
        if m:
            facing = (m.group(1) or m.group(2)); t = FACING.sub('', t).strip(' .,;:-—|')
        m2 = re.search(r'\b(?:page|pag[e.]|seite)\s*([0-9]{1,4})\b', t, re.I)
        if m2 and not facing: facing = m2.group(1)
        t = re.sub(r'\b(?:to\s+face\s+)?(?:page|seite)\b\.?\s*[0-9ivxlc]{0,4}\.?', ' ', t, flags=re.I).strip(' .,;:-—|')
        if t and not SERVICE.search(t): out.append(t)
    cap = ' '.join(out)
    cap = re.sub(r'\s+', ' ', cap).strip()
    letters = sum(ch.isalpha() for ch in cap)
    if len(cap) < 4 or letters < 0.6 * len(cap.replace(' ', '')): cap = ''
    if cap.isupper() and len(cap) > 3: cap = cap.capitalize()
    return cap[:240], facing

def is_caption_line(b, tw, first):
    t = b[4]; letters = [ch for ch in t if ch.isalpha()]
    if not letters: return False
    upper = sum(ch.isupper() for ch in letters) / len(letters)
    width = b[2] - b[0]
    # строка основного текста: почти во всю ширину полосы набора и строчными
    if width > 0.88 * tw and upper < 0.5: return False
    return True

def caption_from_lines(fig, W, H, lines, kind, tw, lh):
    x0, y0, x1, y1 = fig['bbox']
    below = [b for b in lines if b[1] >= y1 - 0.01 * H and b[1] < y1 + 0.10 * H and len(b[4]) < 200]
    pick = []
    for b in below:
        if pick and b[1] - pick[-1][3] > 1.2 * lh: break
        if not is_caption_line(b, tw, not pick): break
        pick.append(b)
        if len(pick) == 3: break
    if not pick:
        above = [b for b in lines if b[3] <= y0 + 0.01 * H and b[3] > y0 - 0.07 * H and len(b[4]) < 200
                 and not RUNNING.search(b[4]) and is_caption_line(b, tw, True)]
        pick = above[-2:] if kind == 'plate' else []
    if not pick and kind == 'plate':
        pick = [b for b in lines if len(b[4]) < 200][:3]
    return clean_caption([b[4] for b in pick])

def real_words(txt, lang):
    ws = re.findall(r'[A-Za-zÀ-ÿĀ-žА-я]{3,}', txt)
    vow = set('aeiouyAEIOUYàâäéèêëîïôöùûüÄÖÜ')
    return sum(1 for w in ws if any(c in vow for c in w) and not re.search(r'(.)\1\1', w))

def ocr_tsv(img, lang):
    buf = io.BytesIO(); img.save(buf, format='PNG')
    r = subprocess.run(['tesseract', 'stdin', '-', '-l', TESS.get(lang, 'eng'), '--psm', '11', 'tsv'],
                       input=buf.getvalue(), capture_output=True, timeout=180)
    rows = [l.split('\t') for l in r.stdout.decode('utf-8', 'ignore').splitlines()[1:]]
    return [(float(x[10]), x[11], int(x[7]), int(x[6]), int(x[8]), int(x[9])) for x in rows if len(x) == 12 and x[11].strip()]

def best_rotation(img_path, lang):
    """Альбомные вклейки печатались повёрнутыми: выбрать поворот 0/90/270°, при котором
    Tesseract уверенно читает больше всего слов (conf ≥ 75, ≥ 3 букв). Вернуть (угол, счёт, строки подписи)."""
    im = Image.open(img_path).convert('L'); res = []
    if im.width > 900: im = im.resize((900, round(im.height * 900 / im.width)))  # быстрее и достаточно для подписи
    for r in (0, 90, 270):
        imr = im.rotate(-r, expand=True)
        words = [w for w in ocr_tsv(imr, lang) if w[0] >= 75 and sum(ch.isalpha() for ch in w[1]) >= 3]
        res.append((len(words), r, words, imr.size))
    res.sort(key=lambda x: (-x[0], x[1] != 0))
    score, r, words, (w, h) = res[0]
    if r and score < 2 + next(x[0] for x in res if x[1] == 0): r = 0; words = next(x[2] for x in res if x[1] == 0)
    # подпись: слова нижней четверти повёрнутой страницы, собранные в строки
    lines = collections.defaultdict(list)
    for conf, t, top, left, ww, hh in words:
        if top > 0.6 * h: lines[round(top / 25)].append((left, t))
    txt = [' '.join(t for _, t in sorted(v)) for k, v in sorted(lines.items())]
    return r, score, txt

def osd_rotation(path):
    r = subprocess.run(['tesseract', str(path), '-', '--psm', '0'], capture_output=True, text=True, timeout=120)
    m = re.search(r'Rotate:\s*(\d+)', r.stdout); c = re.search(r'Orientation confidence:\s*([\d.]+)', r.stdout)
    return (int(m.group(1)) if m else 0), (float(c.group(1)) if c else 0.0)

def ocr(img, lang):
    buf = io.BytesIO(); img.save(buf, format='PNG')
    r = subprocess.run(['tesseract', 'stdin', '-', '-l', TESS.get(lang, 'eng'), '--psm', '6'],
                       input=buf.getvalue(), capture_output=True, timeout=120)
    return r.stdout.decode('utf-8', 'ignore')

# ---------- привязка к абзацам ----------
def norm_words(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return re.findall(r'[a-zа-яё]{3,}', ''.join(ch for ch in s if not unicodedata.combining(ch)))

class ParaIndex:
    def __init__(self, paras):
        self.idx = collections.defaultdict(set)
        for pid, text in paras:
            w = norm_words(text)
            for i in range(len(w) - 3): self.idx[tuple(w[i:i + 4])].add(pid)
    def best(self, text):
        w = norm_words(text); votes = collections.Counter()
        for i in range(len(w) - 3):
            ps = self.idx.get(tuple(w[i:i + 4]))
            if ps and len(ps) < 4:
                for p in ps: votes[p] += 1
        if not votes: return None, 0
        p, v = votes.most_common(1)[0]
        return p, v

# ---------- тип, народы, места ----------
KIND_RX = [
    ('map', r'\b(map|carte|karte|mappa|kart[ae]|plan of|plan de|plan von|sketch[- ]map|route|itin[ée]raire|routenkarte)\b'),
    ('people', r'\b(wom[ae]n|m[ae]n|girls?|boys?|child|famil|chief|priest|shaman|schaman|chaman|type|costume|portrait|'
               r'femme|homme|fille|enfant|frau|mann|mädchen|kinder|weib|tracht|donna|uomo|exiles?|convicts?|'
               r'prisoners?|forçats?|verbannte|natives?|indig[eè]nes?|eingeborene)\b'),
    ('view', r'\b(view|village|town|city|street|church|monastery|cathedral|prison|river|lake|mountain|valley|bridge|'
             r'station|house|hut|yurt|tent|camp|market|harbour|port|vue|ville|église|rivière|lac|montagne|maison|'
             r'ansicht|dorf|stadt|kirche|fluss|see|berg|haus|veduta|chiesa|fiume)\b'),
]
def classify(cap, fig, W, H):
    c = cap.lower()
    for k, rx in KIND_RX:
        if re.search(rx, c): return k
    return 'other'

def load_lexicons():
    eth = []
    for r in csv.DictReader(open(ROOT / 'data' / 'ethnonyms.csv', encoding='utf-8')):
        try: eth.append((re.compile(r['pattern'], 0 if r['ci'] == 'False' else re.I), r['group_id']))
        except re.error: pass
    pl = []
    for r in csv.DictReader(open(ROOT / 'data' / 'places.csv', encoding='utf-8')):
        try: pl.append((re.compile(r['pattern']), r['place_id']))
        except re.error: pass
    return eth, pl

# ---------- обработка тома ----------
def save_crop(ia, n, fig, W, H, rot, dest):
    src = page_img(ia, n, 1200) or page_img(ia, n, 400)
    im = Image.open(src).convert('RGB'); s = im.width / W
    x0, y0, x1, y1 = fig['bbox']; pad = 0.01 * W
    crop = im.crop((max(0, (x0 - pad) * s), max(0, (y0 - pad) * s), min(im.width, (x1 + pad) * s), min(im.height, (y1 + pad) * s)))
    if rot: crop = crop.rotate(-rot, expand=True)  # Tesseract: «Rotate: 90» — повернуть на 90° по часовой
    crop.thumbnail((CROP, CROP))
    dest.parent.mkdir(parents=True, exist_ok=True)
    crop.save(dest, 'WEBP', quality=68, method=6)
    return crop.size

def process_volume(work, ia, lang, vol, paraidx, eth, pl):
    dj = ia_file(ia, '_djvu.xml')
    if not dj: return [], dict(ia=ia, error='нет djvu.xml')
    sc = ia_file(ia, '_scandata.xml')
    P = read_pages(dj); types = scan_types(sc)
    if types and len(types) != len(P): types = None
    C = candidates(P)
    full = [p for p in P if len(p[2]) >= 20]
    tw = st.median([st.median([b[2]-b[0] for b in p[2]]) for p in full]) if full else 1000
    lh = st.median([st.median([b[3]-b[1] for b in p[2]]) for p in full]) if full else 40
    with cf.ThreadPoolExecutor(8) as ex:
        thumbs = dict(zip([c['n'] for c in C], ex.map(lambda c: page_img(ia, c['n'], 400), C)))
    out = []; last = len(P) - 1
    for c in C:
        n = c['n']; t = thumbs.get(n)
        if not t: continue
        if types and types[n] in ('Cover', 'Color Card', 'White Card', 'Tissue', 'Delete'): continue
        if any(SERVICE.search(b[4]) for b in c['lines']) and (c['kind'] == 'plate' or n >= last - 6): continue
        try: fig = find_figure(t, c['W'], c['H'], c['lines'])
        except Exception: fig = None
        if not fig: continue
        if (n <= 1 or n >= last - 1) and fig['area'] > 0.5: continue  # переплёт
        W, H = c['W'], c['H']
        cap, facing = caption_from_lines(fig, W, H, c['lines'], c['kind'], tw, lh)
        x0, y0, x1, y1 = fig['bbox']; rot = 0
        # повёрнутая вклейка: альбомная иллюстрация на книжной странице
        if c['kind'] == 'plate' and (not cap or real_words(cap, lang) < 2):
            big = page_img(ia, n, 1200)
            if big:
                r, score, txt = best_rotation(big, lang)
                if r:
                    rot = r
                    imr = Image.open(big).convert('L').rotate(-r, expand=True)
                    s2 = imr.width / H  # после поворота ширина = высота страницы
                    # подпись — последние короткие строки (под изображением в повёрнутом виде)
                    cap2, f2 = clean_caption([l for l in txt if len(l) < 160][-2:])
                    if cap2: cap, facing = cap2, facing or f2
        iid = f'{work}-{vol}{n:04d}' if vol else f'{work}-{n:04d}'
        # привязка к абзацу
        near = ' '.join(b[4] for k in (n, n - 1, n + 1) if 0 <= k <= last for b in P[k][2])
        pid, votes = paraidx.best(near) if paraidx else (None, 0)
        kind = classify(cap, fig, W, H)
        groups = sorted({g for rx, g in eth if rx.search(cap)}) if cap else []
        places = sorted({p for rx, p in pl if rx.search(cap)}) if cap else []
        if groups and kind == 'other': kind = 'people'
        dest = OUT_IMG / work / f'{iid}.webp'
        try: size = save_crop(ia, n, fig, W, H, rot, dest)
        except Exception as e: continue
        out.append(dict(ill_id=iid, work_id=work, ia=ia, leaf=n, kind=kind, layout=c['kind'],
                        rotated=rot, caption=cap, facing_page=facing or '',
                        bbox=' '.join(map(str, fig['bbox'])), page_w=W, page_h=H,
                        area=fig['area'], pid=pid or '', pid_votes=votes,
                        groups=';'.join(groups), places=';'.join(places),
                        thumb=f'img/ill/{work}/{iid}.webp', thumb_w=size[0], thumb_h=size[1],
                        method='ia_djvu_layout_v1', status='auto'))
    return out, dict(ia=ia, pages=len(P), candidates=len(C), figures=len(out))

def main(only):
    works = list(csv.DictReader(open(ROOT / 'data' / 'works.csv', encoding='utf-8')))
    eth, pl = load_lexicons()
    paras = collections.defaultdict(list)
    for line in open(ROOT / 'corpus' / 'paragraphs.jsonl', encoding='utf-8'):
        d = json.loads(line)
        if d['type'] == 'text' and (not only or d['work_id'] in only):
            paras[d['work_id']].append((d['pid'], d['text']))
    out_csv = ROOT / 'data' / 'illustrations.csv'
    prev = []
    if only and out_csv.exists():
        prev = [r for r in csv.DictReader(open(out_csv, encoding='utf-8')) if r['work_id'] not in only]
    rows, stats = list(prev), []
    for w in works:
        wid = w['work_id']
        if only and wid not in only: continue
        ids = [x.strip() for x in re.split(r'[;\s]+', w['ia_ids'] or '') if x.strip()]
        if not ids:
            stats.append(dict(work=wid, ia='', note='нет скана IA (Gutenberg)')); continue
        pidx = ParaIndex(paras.get(wid, []))
        for k, ia in enumerate(ids):
            vol = f'v{k + 1}-' if len(ids) > 1 else ''
            done = CACHE / 'done' / f'{ia}.json'
            if done.exists() and not os.environ.get('ILL_FORCE'):
                r, s = json.load(open(done)); rows += r; s['work'] = wid; stats.append(s); continue
            if os.environ.get('ILL_ASSEMBLE'):
                stats.append(dict(work=wid, ia=ia, note='ещё не обработан')); continue
            try: r, s = process_volume(wid, ia, w['text_language'] or 'en', vol, pidx, eth, pl)
            except Exception as e: r, s = [], dict(ia=ia, error=repr(e)[:120])
            if 'error' not in s:
                done.parent.mkdir(parents=True, exist_ok=True); json.dump([r, s], open(done, 'w'), ensure_ascii=False)
            rows += r; s['work'] = wid; stats.append(s)
            print(wid, ia, s, flush=True)
    keys = ['ill_id', 'work_id', 'ia', 'leaf', 'kind', 'layout', 'rotated', 'caption', 'facing_page', 'bbox', 'page_w',
            'page_h', 'area', 'pid', 'pid_votes', 'groups', 'places', 'thumb', 'thumb_w', 'thumb_h', 'method', 'status']
    with open(out_csv, 'w', newline='', encoding='utf-8') as f:
        wr = csv.DictWriter(f, keys); wr.writeheader(); wr.writerows(rows)
    json.dump(stats, open(ROOT / 'validation' / 'illustrations_stats.json', 'w'), ensure_ascii=False, indent=1)
    print('итого', len(rows))

def recrop():
    """Пересоздать изображения по data/illustrations.csv (bbox, поворот) из кэша страниц — без повторного анализа."""
    rows = list(csv.DictReader(open(ROOT / 'data' / 'illustrations.csv', encoding='utf-8')))
    def one(r):
        fig = dict(bbox=list(map(int, r['bbox'].split())))
        size = save_crop(r['ia'], int(r['leaf']), fig, int(r['page_w']), int(r['page_h']), int(r['rotated'] or 0),
                         OUT_IMG / r['work_id'] / f"{r['ill_id']}.webp")
        r['thumb_w'], r['thumb_h'] = size; return r
    with cf.ThreadPoolExecutor(6) as ex: rows = list(ex.map(one, rows))
    with open(ROOT / 'data' / 'illustrations.csv', 'w', newline='', encoding='utf-8') as f:
        wr = csv.DictWriter(f, list(rows[0])); wr.writeheader(); wr.writerows(rows)
    print('пересоздано', len(rows))

if __name__ == '__main__':
    if sys.argv[1:2] == ['--recrop']: recrop()
    else: main(set(sys.argv[1:]))
