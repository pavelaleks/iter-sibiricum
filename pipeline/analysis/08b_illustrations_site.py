"""08b. Иллюстрации → данные сайта.

Вход: data/illustrations.csv (08a), data/review/illustrations_review.json сайта (правки из
рабочего места, если есть), site_data/works.json.
Выход: site/data/illustrations.json (изображения копируются в site/img/ill) — компактный список для страницы «Иллюстрации»
и подборка для главной (hero): люди, виды и карты с читаемой подписью, не больше
двух на книгу, равномерно по эпохам.
"""
import csv, json, pathlib, re, collections, random

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT.parent / 'site'  # как в 10_build_site.py

def good_caption(c):
    c = c or ''
    w = re.findall(r'[A-Za-zÀ-ÿĀ-ž]{3,}', c or '')
    return len(w) >= 2 and len(c) <= 90 and not re.search(r'[|^~<>{}\\]|(.)\1\1', c)

def main():
    rows = list(csv.DictReader(open(ROOT / 'data' / 'illustrations.csv', encoding='utf-8')))
    # HTML-издания Gutenberg (08c): изображения и подписи из набранного текста
    pgx = ROOT / 'data' / 'illustrations_gutenberg.csv'
    if pgx.exists(): rows += list(csv.DictReader(open(pgx, encoding='utf-8')))
    works = {w['id']: w for w in json.load(open(SITE / 'data' / 'works.json', encoding='utf-8'))}
    # проверка подписей (агенты по инструкции validation/illustrations/INSTRUCTIONS.md):
    # исправленная подпись, перевод, тип, народы, места, «не иллюстрация»
    chk = {}
    pth = ROOT / 'data' / 'illustrations_captions.csv'
    if pth.exists():
        chk = {r['ill_id']: r for r in csv.DictReader(open(pth, encoding='utf-8'))}
    # проверка подписей Gutenberg: validation/illustrations/gutenberg_review_*.tsv (пустая исправленная подпись = оригинал)
    orig = {r['ill_id']: r['caption'] for r in rows}
    for f in sorted((ROOT / 'validation' / 'illustrations').glob('gutenberg_review_*.tsv')):
        for line in open(f, encoding='utf-8').read().splitlines()[1:]:
            q = (line.split('\t') + [''] * 7)[:7]
            if not q[0]: continue
            chk[q[0]] = dict(caption_fixed=q[1] or orig.get(q[0], ''), ru=q[2], kind=q[3], groups=q[4], places=q[5], not_illustration=q[6])
    # визуальная проверка (validation/illustrations/VISUAL.md): брак, поворот, тип, отбор для главной
    vis = {}
    pv = ROOT / 'data' / 'illustrations_visual.csv'
    if pv.exists():
        vis = {r['ill_id']: r for r in csv.DictReader(open(pv, encoding='utf-8'))}
    # макрорегион иллюстрации: по местам из проверенной подписи, иначе по абзацу рядом
    GZ = {'west_siberia': 'sib', 'east_siberia': 'sib', 'arctic_siberia': 'sib', 'far_east': 'sib', 'kamchatka_chukotka': 'sib',
          'yakutia_ne': 'sib', 'kazakh_steppe': 'sib', 'urals': 'eur', 'european_russia': 'eur', 'china': 'china',
          'manchuria': 'china', 'mongolia': 'china', 'america': 'other', 'europe': 'other', 'japan_korea': 'other'}
    MAC = {r['label_ru'].strip(): GZ.get(r['region'], '') for r in csv.DictReader(open(ROOT / 'data' / 'places.csv', encoding='utf-8'))}
    MAC.update({r['place'].strip(): r['macro'] for r in csv.DictReader(open(ROOT / 'data' / 'illustration_place_regions.csv', encoding='utf-8'))})
    PREG = {}
    for line in open(ROOT / 'corpus' / 'paragraphs.jsonl', encoding='utf-8'):
        q = json.loads(line); PREG[q['pid']] = GZ.get(q['region'], '')
    def macro(places, pid):
        m = [MAC.get(x, '') for x in places]; m = [x for x in m if x]
        if m:  # если среди мест есть сибирское — иллюстрация сибирская
            return ('sib' if 'sib' in m else collections.Counter(m).most_common(1)[0][0]), 'cap'
        return PREG.get(pid, ''), 'par' if PREG.get(pid) else ''
    unmapped = collections.Counter()
    ROT = {'rot_cw': 90, 'rot_ccw': 270, 'rot_180': 180}
    items = []
    for r in rows:
        v = vis.get(r['ill_id'], {})
        if v.get('verdict') == 'reject': continue
        r = {**r, 'vrot': ROT.get(v.get('verdict'), 0), 'vkind': v.get('kind', ''), 'vhero': v.get('hero') == '1'}
        c = chk.get(r['ill_id'])
        if c:
            if c.get('not_illustration') == '1': continue
            r = {**r, 'caption': c['caption_fixed'] if c['caption_fixed'] or not r['caption'] else c['caption_fixed'],
                 'kind': c['kind'] if c['kind'] and c['kind'] != 'unknown' else r['kind'],
                 'groups': c['groups'] or r['groups'], 'ru': c.get('ru', ''), 'places_ru': c.get('places', '')}
        if r['work_id'] not in works or r['status'] == 'rejected': continue
        items.append(dict(id=r['ill_id'], w=r['work_id'], ia=r['ia'], n=int(r['leaf']), k=r['kind'], c=r['caption'],
                          f=r['facing_page'], p=r['pid'].split('_p')[-1] if r['pid'] else '',
                          g=[x for x in r['groups'].split(';') if x], pl=[x.strip() for x in (r.get('places_ru') or '').split(';') if x.strip()], ru=r.get('ru', ''),
                          t=r['thumb'], tw=int(r['thumb_w']), th=int(r['thumb_h']), r=int(r['rotated'] or 0),
                          a=float(r['area']), vrot=r['vrot'], hero=r['vhero']))
        if r.get('source') == 'gutenberg': items[-1]['src'] = 'pg'; items[-1]['u'] = r['src_url']
        it = items[-1]
        it['rg'], it['rb'] = macro(it['pl'], r['pid'])
        unmapped.update(x for x in it['pl'] if x not in MAC)
        if r['vkind'] and (it['k'] in ('other', 'unknown', '') or not it['c']): it['k'] = r['vkind']
        if it['k'] == 'unknown': it['k'] = 'other'
    items.sort(key=lambda x: (works[x['w']]['year'], x['w'], x['id']))
    # подборка для главной
    pool = [x for x in items if x['hero'] and good_caption(x['c']) and x['rg'] in ('sib', '')]  # на главной — только Сибирь
    if len(pool) < 20:
        pool += [x for x in items if not x['hero'] and x['k'] in ('people', 'portrait', 'view', 'map') and good_caption(x['c'])
                 and 0.55 <= x['tw'] / max(1, x['th']) <= 1.6 and x['a'] >= 0.12]
    by_per = collections.defaultdict(list)
    for x in pool: by_per[works[x['w']]['period']].append(x)
    rnd = random.Random(1832); hero = []
    for per in sorted(by_per):
        L = by_per[per]; rnd.shuffle(L); seen = collections.Counter()
        for x in L:
            if seen[x['w']] < 3: hero.append(x['id']); seen[x['w']] += 1
            if sum(seen.values()) >= 12: break
    out = None
    import shutil
    src = ROOT / 'site_data' / 'img' / 'ill'; dst = SITE / 'img' / 'ill'
    if dst.exists(): shutil.rmtree(dst)
    keep = {x['t'] for x in items}
    for x in items:
        (dst / x['w']).mkdir(parents=True, exist_ok=True)
        if x['vrot']:
            from PIL import Image
            im = Image.open(ROOT / 'site_data' / x['t']).rotate(-x['vrot'], expand=True)
            im.save(SITE / x['t'], 'WEBP', quality=68, method=6); x['tw'], x['th'] = im.size; x['r'] = 1
        else:
            shutil.copy2(ROOT / 'site_data' / x['t'], SITE / x['t'])
    for x in items: x.pop('vrot', None); x.pop('hero', None); x['a'] = round(x['a'], 2)
    out = dict(method='ia_djvu_layout_v1', items=items, hero=hero)
    json.dump(out, open(SITE / 'data' / 'illustrations.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('регионы:', dict(collections.Counter(x['rg'] or '?' for x in items)), 'по подписи:', sum(x['rb'] == 'cap' for x in items),
          '| мест без региона:', len(unmapped), list(unmapped)[:10])
    print(len(items), 'иллюстраций,', len({x['w'] for x in items}), 'книг; на главной', len(hero))

if __name__ == '__main__':
    main()
