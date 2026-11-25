"""Этап 2: сегментация на главы/абзацы, классификация паратекста, экспорт в TEI P5 и paragraphs.jsonl.

Типы абзацев:
  text     – авторский текст (входит во все подсчёты)
  note     – сноска (входит в подсчёты, помечается)
  heading  – заголовок главы
  figure   – подпись к иллюстрации (исключается)
  toc      – оглавление, списки иллюстраций, указатели (исключается)
  editorial– примечания транскрибера/издателя PG (исключается)
  synopsis – краткое содержание главы («Arrival--Mongols--…»), дублирует текст (исключается)
"""
import re, json, csv, pathlib, unicodedata
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parents[1]
works = {r['work_id']: r for r in csv.DictReader(open(ROOT/'data/works.csv', encoding='utf-8'))}

CHAP_RE = re.compile(r'^\s*(CHAPTER|Chapter|CHAPITRE|Chapitre|[A-ZÄÖ][a-zäöü]+es\s+Kapitel|_?[A-Z][a-zäöü]+es Kapitel_?|PART|BOOK)\b'
                     r'|^\s*[IVXLC]+\.?\s*$|^\s*[IVXLC]+\.\s+\S', re.M)
BACK_RE = re.compile(r'^\s*(INDEX\.?|Index\.?|Register\.?|TABLE DES MATI[ÈE]RES\.?|TABLE\.?)\s*$')
EDIT_RE = re.compile(r"(Transcriber|Produced by|E-text prepared|Note sur la transcription|Project Gutenberg|pgdp\.net|Internet Archive)", re.I)

def norm(s):
    s = unicodedata.normalize('NFKC', s)
    return re.sub(r'[\W_]+', ' ', s).strip().lower()

def numeric_tail_share(lines):
    lines = [l for l in lines if l.strip()]
    if not lines: return 0
    return sum(bool(re.search(r'(\b\d+|\b[IVXLC]{1,6})\.?\s*$', l.strip())) for l in lines) / len(lines)

def classify(p, toc_titles):
    s = p.strip(); lines = s.split('\n'); words = len(s.split())
    if s.startswith('[Illustration') or s.startswith('[Ill') or s.startswith('[Kuva'): return 'figure'
    if re.match(r'^\[(Footnote|Fußnote|Note|\d+)', s): return 'note'
    if EDIT_RE.search(s) and words < 120: return 'editorial'
    if len(lines) >= 3 and numeric_tail_share(lines) >= 0.4: return 'toc'
    # строки указателя: «Barnaoul, 38; attractive to immigrants, 47»
    if len(re.findall(r'[,;]\s*\d{1,3}\b', s)) >= 2 and words < 120 and len(re.findall(r'[.!?]\s+[A-ZА-Я]', s)) < 2: return 'toc'
    if words < 25 and re.search(r',\s*\d{1,3}\s*$', s): return 'toc'
    # подписи в списке иллюстраций / строки оглавления с номером страницы в конце
    if words < 30 and re.search(r'\s\d{1,3}\s*$', s) and not re.search(r'[.!?]["”’)]?\s+[A-Z]', s): return 'toc'
    if '--' in s and re.search(r'\s\d{1,3}\s*$', s): return 'synopsis'
    # аннотации глав: «Arrival at Kalgan--Mixed population--Mongols--…»
    segs = re.split(r'\s*(?:--|—|–)\s*', s)
    if len(segs) >= 4 and sum(len(x) for x in segs)/len(segs) < 45: return 'synopsis'
    # OCR: аннотации глав и списки иллюстраций через « : » / « ; » («Decline : The pristav : The guarded treasure : …»)
    segs2 = re.split(r'\s+[:;]\s+|\s*\.\s*:\s*', s)
    if len(segs2) >= 4 and sum(len(x) for x in segs2)/len(segs2) < 40: return 'synopsis'
    if len(re.findall(r'[.:;]\s+\d{1,3}\s+[A-Z]', s)) >= 3: return 'toc'
    if len(lines) >= 4 and sum(len(l.strip()) < 60 for l in lines)/len(lines) > 0.85 and words < 200 and \
       sum(bool(CHAP_RE.match(l)) or norm(l) in toc_titles for l in lines) >= 2: return 'toc'
    if words <= 14 and len(lines) <= 3 and (CHAP_RE.match(s) or norm(s) in toc_titles): return 'heading'
    return 'text'

def toc_titles_from(paras):
    """Строки оглавления в первых 15% текста → множество нормализованных заголовков."""
    out = set(); head = paras[: max(10, len(paras)//7)]
    in_toc = False
    for p in head:
        s = p.strip()
        if re.match(r'^(CONTENTS|SISÄLLYS|SISÄLTÖ|Inhaltsverzeichnis|TABLE)', s, re.I): in_toc = True; continue
        if in_toc:
            for l in s.split('\n'):
                l2 = re.sub(r'^\s*([IVXLC]+\.|\d+\.)\s*', '', l.strip())
                l2 = re.sub(r'\s*[\.\s]*\d+\s*(-\s*\d+)?\s*$', '', l2)
                if 2 < len(l2) < 70: out.add(norm(l2))
            if len(out) > 80: break
    return out

def segment(wid):
    pg = wid
    txt = (ROOT/f'corpus/clean/{wid}.txt').read_text(encoding='utf-8')
    paras = [p for p in re.split(r'\n\s*\n', txt) if p.strip()]
    toc = toc_titles_from(paras)
    # обрезка указателя / оглавления в конце (последние 25%)
    cut = len(paras)
    for i in range(int(len(paras)*0.75), len(paras)):
        if BACK_RE.match(paras[i].split('\n')[0]): cut = i; break
    recs, chap, chap_title, started, pn = [], 0, 'front matter', False, 0
    for i, p in enumerate(paras):
        t = 'toc' if i >= cut else classify(p, toc)
        s = re.sub(r'[ \t]+', ' ', p.strip())
        if t == 'heading':
            # заголовок «главы» засчитывается, только если следом идёт проза
            nxt = next((q for q in paras[i+1:i+4] if len(q.split()) > 25), None)
            if nxt is not None:
                chap += 1; started = True
                # объединяем «CHAPTER I» + следующую строку-название
                chap_title = s.replace('\n', ' ')
                if re.fullmatch(r'(CHAPTER|CHAPITRE|Chapter)\s+[IVXLC\d]+\.?|[IVXLC]+\.?', s) and i+1 < len(paras) and len(paras[i+1].split()) <= 14:
                    chap_title += ' ' + paras[i+1].strip().replace('\n', ' ')
            else:
                t = 'toc'
        pn += 1
        recs.append(dict(pid=f"{works[pg]['work_id']}_p{pn:05d}", work_id=works[pg]['work_id'], pg_id=pg,
                         chapter=chap, chapter_title=chap_title[:120], para_n=pn, type=t,
                         words=len(s.split()), text=s.replace('\n', ' ')))
    # всё до первой главы, что похоже на оглавление/титул, уже отмечено; прозу предисловия оставляем (chapter 0)
    return recs

def to_tei(recs, w):
    hdr = f'''<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:lang="{w['text_language']}">
 <teiHeader>
  <fileDesc>
   <titleStmt><title>{escape(recs[0]['work_id'])}</title><author>{escape(w['author'])}</author>
    <respStmt><resp>segmentation, encoding</resp><name>Siberia Travelogues DH project (automated pipeline v0.1)</name></respStmt></titleStmt>
   <publicationStmt><p>Derived from {'Project Gutenberg eBook #'+w['pg_id']+' (GITenberg mirror)' if w['pg_id'] else 'Internet Archive scan(s) '+escape(w.get('ia_ids',''))+' (raw OCR, cleaned by analysis/ocr_clean.py)'}. Public domain text; encoding CC BY 4.0.</p></publicationStmt>
   <sourceDesc><bibl><author>{escape(w['author'])}</author><date>{w['edition_year']}</date>
    {'<note type="translation">translation from '+w['original_language']+(' by '+escape(w['translator']) if w['translator'] else '')+'</note>' if w['is_translation']=='true' else ''}
    <idno type="{'PG' if w['pg_id'] else 'IA'}">{escape(w['pg_id'] or w.get('ia_ids',''))}</idno></bibl></sourceDesc>
  </fileDesc>
  <profileDesc><creation><date from="{w['journey_start']}" to="{w['journey_end']}" cert="{w['journey_date_certainty'] or 'unknown'}">journey</date></creation>
   <langUsage><language ident="{w['text_language']}"/></langUsage></profileDesc>
 </teiHeader>
 <text><body>
'''
    out = [hdr]; cur = None
    for r in recs:
        if r['chapter'] != cur:
            if cur is not None: out.append('  </div>\n')
            cur = r['chapter']; out.append(f'  <div type="{"front" if cur==0 else "chapter"}" n="{cur}">\n')
        t = escape(r['text'])
        if r['type'] == 'heading': out.append(f'   <head xml:id="{r["pid"]}">{t}</head>\n')
        elif r['type'] == 'figure': out.append(f'   <figure xml:id="{r["pid"]}"><figDesc>{t}</figDesc></figure>\n')
        elif r['type'] == 'note': out.append(f'   <note xml:id="{r["pid"]}">{t}</note>\n')
        elif r['type'] in ('toc', 'editorial'): out.append(f'   <ab type="{r["type"]}" xml:id="{r["pid"]}">{t}</ab>\n')
        else: out.append(f'   <p xml:id="{r["pid"]}">{t}</p>\n')
    out.append('  </div>\n </body></text>\n</TEI>\n')
    return ''.join(out)

if __name__ == '__main__':
    allrecs = []
    for pg, w in works.items():
        recs = segment(pg); allrecs += recs
        (ROOT/f'corpus/tei/{w["work_id"]}.xml').write_text(to_tei(recs, w), encoding='utf-8')
        from collections import Counter
        c = Counter(r['type'] for r in recs); tw = sum(r['words'] for r in recs if r['type'] in ('text','note'))
        print(f"{w['work_id']:18} chapters={max(r['chapter'] for r in recs):3}  paras={len(recs):5}  text_words={tw:7}  {dict(c)}")
    with open(ROOT/'corpus/paragraphs.jsonl', 'w', encoding='utf-8') as f:
        for r in allrecs: f.write(json.dumps(r, ensure_ascii=False) + '\n')
