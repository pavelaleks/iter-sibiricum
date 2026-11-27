"""Статические страницы для поисковых систем.

Сайт — одностраничное приложение с адресами после «#», а поисковики считают всё после «#» одной страницей.
Скрипт делает по лёгкой HTML-странице на каждую книгу (/b/<id>/), народ (/p/<id>/) и место (/pl/<id>/)
на русском и английском (/en/...), с заголовком, описанием, разметкой schema.org и ссылкой в сам ресурс;
плюс sitemap.xml и robots.txt. Тексты книг на эти страницы не выносятся — только описание и счётчики.

Запуск из корня сайта: python3 pipeline/tools/seo_pages.py
"""
import json, html, pathlib, re, shutil, datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / 'data'
BASE = 'https://iter-sibiricum.ru/'
TODAY = datetime.date.today().isoformat()
works = json.load(open(D / 'works.json', encoding='utf-8'))
groups = json.load(open(D / 'groups.json', encoding='utf-8'))
places = json.load(open(D / 'places.json', encoding='utf-8'))
P = json.load(open(D / 'project.json', encoding='utf-8'))
EN = json.loads(re.search(r'=\s*(\{.*\})\s*;?\s*$', (ROOT / 'assets/i18n-en.js').read_text(encoding='utf-8'), re.S).group(1))
VER = re.search(r'site\.css\?v=(\d+)', (ROOT / 'index.html').read_text(encoding='utf-8')).group(1)
W = {w['id']: w for w in works}
G = {g['id']: g for g in groups}
GN = {g['name']: g for g in groups}
e = lambda s: html.escape(str(s if s is not None else ''), quote=True)
toH = lambda i: str(i).replace('_', '-')
tr = lambda s: EN.get(s, s)
LANG = {'en': ('английский', 'English'), 'de': ('немецкий', 'German'), 'fr': ('французский', 'French'), 'it': ('итальянский', 'Italian'), 'sv': ('шведский', 'Swedish'),
        'no': ('норвежский', 'Norwegian'), 'fi': ('финский', 'Finnish'), 'cs': ('чешский', 'Czech'), 'pl': ('польский', 'Polish'), 'nl': ('нидерландский', 'Dutch'),
        'da': ('датский', 'Danish'), 'hu': ('венгерский', 'Hungarian'), 'es': ('испанский', 'Spanish'), 'ru': ('русский', 'Russian')}
lang_name = lambda c, en: LANG.get(c, (c, c))[1 if en else 0]
num = lambda n, en: f'{n:,}'.replace(',', ' ' if not en else ',')
def plural(n, a, b, c):
    n = abs(int(n)); return a if n % 10 == 1 and n % 100 != 11 else b if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else c
yrs = lambda w: (f"{int(w['j0'])}" + (f"–{int(w['j1'])}" if w.get('j1') and int(w['j1']) != int(w['j0']) else '')) if w.get('j0') else ''
gname = lambda g, en: (g.get('name_en') or g['name']) if en else g['name']

STYLE = """<style>.seo{max-width:760px}.seo h1{font-size:clamp(28px,4.4vw,44px);line-height:1.12;margin:.2em 0 .35em}.seo .meta{color:var(--mute);margin:0 0 1.2em}
.seo dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:1.2em 0}.seo dt{color:var(--mute)}.seo dd{margin:0}.seo ul{padding-left:1.1em}
.seo .go{display:inline-block;margin:1em 0 1.6em;padding:11px 18px;border-radius:999px;background:var(--ink);color:var(--paper);text-decoration:none;font-weight:600}
.seo .crumbs{font-size:14px;color:var(--mute);margin:1.4em 0 .4em}.seo .crumbs a{color:inherit}.seo footer{margin:3em 0 2em;font-size:13.5px;color:var(--mute)}</style>"""

def page(path, en, title, desc, body, ld, alt_path):
    """path — относительный путь без языка ('b/x/'); en — английская версия."""
    url = BASE + ('en/' if en else '') + path
    ru_url, en_url = BASE + alt_path, BASE + 'en/' + alt_path
    depth = (2 if en else 1) + path.count('/') - 1
    up = '../' * depth
    home = up + ('?lang=en' if en else '')
    doc = f"""<!DOCTYPE html>
<html lang="{'en' if en else 'ru'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} — Iter Sibiricum</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ru" href="{ru_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{ru_url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Iter Sibiricum">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<link rel="stylesheet" href="{up}assets/site.css?v={VER}">
{STYLE}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="{home}">Iter Sibiricum</a>
<nav style="display:flex;gap:18px"><a href="{(ru_url if en else en_url).replace(BASE, up)}" hreflang="{'ru' if en else 'en'}">{'RU' if en else 'EN'}</a></nav></div></header>
<main class="wrap seo">
{body.replace('{UP}', up).replace('{HOME}', home).replace('{Q}', '?lang=en' if en else '')}
<footer>{'Iter Sibiricum: European travelogues about Siberia, 1800–1930. Russian Science Foundation grant No. ' if en else 'Iter Sibiricum: европейские травелоги о Сибири, 1800–1930. Грант Российского научного фонда № '}{e(P['grant'])}. <a href="{home}">{'Home' if en else 'На главную'}</a> · <a href="{up}{'?lang=en' if en else ''}#data">{'Data' if en else 'Данные'}</a></footer>
</main>
</body>
</html>
"""
    out = ROOT / (('en/' if en else '') + path) / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(doc, encoding='utf-8')
    return url

ISPART = {'@type': 'WebSite', 'name': 'Iter Sibiricum', 'url': BASE}
urls = []

# ---------- книги ----------
for w in works:
    for en in (False, True):
        t = w.get('title') or w['label']
        title = f"{w['author']}, {w['year']}: {w.get('title_short') or t}"
        tg = [(n, c) for n, c in (w.get('top_groups') or [])][:6]
        tgl = ', '.join(gname(GN[n], en) if n in GN else n for n, _ in tg[:4])
        desc = (f"{w['author']}, “{w.get('title_short') or t}” ({w['year']}): full text in the Iter Sibiricum library with every paragraph linked, the reconstructed route and the peoples of Siberia the author describes"
                + (f" ({tgl})." if tgl else '.')) if en else \
               (f"{w['author']}, «{w.get('title_short') or t}» ({w['year']}): полный текст в библиотеке Iter Sibiricum с постоянными ссылками на абзацы, восстановленный маршрут и народы Сибири, о которых пишет автор"
                + (f" ({tgl})." if tgl else '.'))
        go = f"{{UP}}{{Q}}#book-{toH(w['id'])}"
        rows = [((('Author', 'Автор')[not en]), e(w['author'])), (('Published', 'Издание')[not en], e(', '.join(x for x in [w.get('publisher') or '', str(w['year'])] if x))),
                (('Language', 'Язык')[not en], e(lang_name(w['lang'], en)) + (e(f" ({'translated from' if en else 'перевод с'} {lang_name(w['orig_lang'], en) if en else lang_name(w['orig_lang'], en)[:-2] + 'ого'})") if w.get('translation') and w.get('orig_lang') and w['orig_lang'] != w['lang'] else '')),
                (('Journey', 'Поездка')[not en], e(yrs(w)) + (e(f" · {tr(w.get('stay_ru',''))}" if en else f" · {w.get('stay_ru','')}") if w.get('stay_ru') else '')),
                (('Length', 'Объём')[not en], e(f"{num(w['words'], en)} {'words' if en else plural(w['words'], 'слово', 'слова', 'слов')}") + (e(f"; {num(w['mentions'], en)} {'mentions of peoples' if en else plural(w['mentions'], 'упоминание', 'упоминания', 'упоминаний') + ' народов'}") if w.get('mentions') else ''))]
        src = ''.join(f'<li><a href="{e(u)}" rel="nofollow">{e(re.sub(r"^https?://(www\.)?", "", u)[:70])}</a></li>' for u in (w.get('sources') or [])[:3])
        peo = ''.join(f'<li><a href="{{UP}}{"en/" if en else ""}p/{toH(GN[n]["id"])}/">{e(gname(GN[n], en))}</a> — {c}</li>' if n in GN else f'<li>{e(n)} — {c}</li>' for n, c in tg)
        body = f"""<p class="crumbs"><a href="{{HOME}}">Iter Sibiricum</a> › <a href="{{UP}}{{Q}}#library">{'Library' if en else 'Библиотека'}</a></p>
<h1>{e(t)}</h1>
<p class="meta">{e(w['author'])} · {w['year']}</p>
<a class="go" href="{go}">{'Read in the library' if en else 'Читать в библиотеке'}</a>
<dl>{''.join(f'<dt>{a}</dt><dd>{b}</dd>' for a, b in rows)}</dl>
{f'<h2>{"Peoples most often mentioned" if en else "Чаще всего упоминаемые народы"}</h2><ul>{peo}</ul>' if peo else ''}
{f'<h2>{"Digitised copy" if en else "Оцифрованное издание"}</h2><ul>{src}</ul>' if src else ''}"""
        ld = {'@context': 'https://schema.org', '@type': 'Book', 'name': t, 'author': {'@type': 'Person', 'name': w['author']}, 'datePublished': str(w['year']), 'inLanguage': w['lang'],
              'publisher': w.get('publisher') or None, 'url': BASE + ('en/' if en else '') + f"b/{toH(w['id'])}/", 'sameAs': (w.get('sources') or [])[:3], 'isPartOf': ISPART,
              'about': [{'@type': 'Place', 'name': 'Siberia'}] + [{'@type': 'Thing', 'name': gname(GN[n], True)} for n, _ in tg[:4] if n in GN]}
        ld = {k: v for k, v in ld.items() if v}
        urls.append(page(f"b/{toH(w['id'])}/", en, title, desc, body, ld, f"b/{toH(w['id'])}/"))

# ---------- народы ----------
for g in groups:
    for en in (False, True):
        nm = gname(g, en)
        bw = (g.get('by_work') or [])[:12]
        forms = ', '.join((g.get('forms') or [])[:10])
        desc = (f"How European travellers of 1800–1930 described the {nm}: {num(g['mentions'], en)} mentions in {g['works']} books, the names they used ({forms[:80]}), quotations, contexts and places."
                if en else f"Как европейские путешественники 1800–1930 годов описывали народ «{nm}»: {num(g['mentions'], en)} {plural(g['mentions'], 'упоминание', 'упоминания', 'упоминаний')} в {g['works']} {plural(g['works'], 'книге', 'книгах', 'книгах')}, названия ({forms[:80]}), цитаты, контексты и места.")
        books = ''.join(f'<li><a href="{{UP}}{"en/" if en else ""}b/{toH(wid)}/">{e(W[wid]["author"])}, {W[wid]["year"]}</a> — {n}</li>' for wid, n in bw if wid in W)
        body = f"""<p class="crumbs"><a href="{{HOME}}">Iter Sibiricum</a> › <a href="{{UP}}{{Q}}#peoples">{'Peoples' if en else 'Народы'}</a></p>
<h1>{e(nm)}</h1>
<p class="meta">{num(g['mentions'], en)} {'mentions' if en else plural(g['mentions'], 'упоминание', 'упоминания', 'упоминаний')} · {g['works']} {'books' if en else plural(g['works'], 'книга', 'книги', 'книг')}</p>
<a class="go" href="{{UP}}{{Q}}#people-{toH(g['id'])}">{'Open the profile' if en else 'Открыть страницу народа'}</a>
{f'<p>{"Names in the travelogues" if en else "Названия в травелогах"}: {e(forms)}</p>' if forms else ''}
{f'<p>{e(g["note"]) if not en else ""}</p>' if g.get('note') and not en else ''}
{f'<h2>{"Books that mention them most" if en else "Книги, где они упоминаются чаще всего"}</h2><ul>{books}</ul>' if books else ''}
<p><a href="{{UP}}{{Q}}#evidence?g={e(g['id'])}">{'All paragraphs about them' if en else 'Все абзацы о них'}</a></p>"""
        ld = {'@context': 'https://schema.org', '@type': 'WebPage', 'name': nm, 'description': desc, 'url': BASE + ('en/' if en else '') + f"p/{toH(g['id'])}/", 'isPartOf': ISPART,
              'about': {'@type': 'Thing', 'name': g.get('name_en') or g['name'], 'alternateName': (g.get('forms') or [])[:10]}}
        urls.append(page(f"p/{toH(g['id'])}/", en, nm if en else f'{nm} в европейских травелогах', desc, body, ld, f"p/{toH(g['id'])}/"))

# ---------- места ----------
for p in places:
    for en in (False, True):
        nm = tr(p['name']) if en else p['name']
        tw = (p.get('top_works') or [])[:10]
        desc = (f"{nm} in European travelogues of Siberia, 1800–1930: {num(p['mentions'], en)} mentions in {p['works']} books, with the paragraphs where travellers write about it."
                if en else f"{nm} в европейских травелогах о Сибири, 1800–1930: {num(p['mentions'], en)} {plural(p['mentions'], 'упоминание', 'упоминания', 'упоминаний')} в {p['works']} {plural(p['works'], 'книге', 'книгах', 'книгах')} и абзацы, где о нём пишут путешественники.")
        books = ''.join(f'<li><a href="{{UP}}{"en/" if en else ""}b/{toH(wid)}/">{e(W[wid]["author"])}, {W[wid]["year"]}</a> — {n}</li>' for wid, n in tw if wid in W)
        body = f"""<p class="crumbs"><a href="{{HOME}}">Iter Sibiricum</a> › <a href="{{UP}}{{Q}}#atlas">{'Atlas' if en else 'Атлас'}</a></p>
<h1>{e(nm)}</h1>
<p class="meta">{num(p['mentions'], en)} {'mentions' if en else plural(p['mentions'], 'упоминание', 'упоминания', 'упоминаний')} · {p['works']} {'books' if en else plural(p['works'], 'книга', 'книги', 'книг')}</p>
<a class="go" href="{{UP}}{{Q}}#evidence?pl={e(p['id'])}">{'All paragraphs about this place' if en else 'Все абзацы об этом месте'}</a>
{f'<h2>{"Books that mention it most" if en else "Книги, где оно упоминается чаще всего"}</h2><ul>{books}</ul>' if books else ''}"""
        ld = {'@context': 'https://schema.org', '@type': 'Place', 'name': nm, 'description': desc, 'url': BASE + ('en/' if en else '') + f"pl/{toH(p['id'])}/",
              'geo': {'@type': 'GeoCoordinates', 'latitude': p['lat'], 'longitude': p['lon']}, 'isPartOf': ISPART} if p.get('lat') is not None else \
             {'@context': 'https://schema.org', '@type': 'Place', 'name': nm, 'url': BASE + ('en/' if en else '') + f"pl/{toH(p['id'])}/"}
        urls.append(page(f"pl/{toH(p['id'])}/", en, nm if en else f'{nm} в европейских травелогах о Сибири', desc, body, ld, f"pl/{toH(p['id'])}/"))

# ---------- sitemap и robots ----------
def alt(u):
    rel = u.replace(BASE + 'en/', '').replace(BASE, '')
    return f'<xhtml:link rel="alternate" hreflang="ru" href="{BASE}{rel}"/><xhtml:link rel="alternate" hreflang="en" href="{BASE}en/{rel}"/>'
sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      f'<url><loc>{BASE}</loc><lastmod>{TODAY}</lastmod><xhtml:link rel="alternate" hreflang="ru" href="{BASE}?lang=ru"/><xhtml:link rel="alternate" hreflang="en" href="{BASE}?lang=en"/><priority>1.0</priority></url>']
sm += [f'<url><loc>{u}</loc><lastmod>{TODAY}</lastmod>{alt(u)}</url>' for u in urls]
sm.append('</urlset>')
(ROOT / 'sitemap.xml').write_text('\n'.join(sm) + '\n', encoding='utf-8')
(ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /pipeline/\n\nSitemap: {BASE}sitemap.xml\n', encoding='utf-8')
print('страниц:', len(urls))
