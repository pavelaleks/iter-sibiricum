"""Очистка «сырого» OCR (archive.org _djvu.txt, Gallica texteBrut, Delpher) перед сегментацией.

Шаги (каждый логируется в отчёт качества):
  1. нормализация: Unicode NFC, ſ→s, лигатуры, мягкие переносы, множественные пробелы, «бумажные» артефакты;
  2. блоки = абзацы (разделены пустыми строками);
  3. колонтитулы: короткие блоки, которые после удаления цифр повторяются ≥ 4 раз (THROUGH SIBERIA., A TRAVERS LA SIBÉRIE)
     и номера страниц (арабские/римские) — удаляются;
  4. служебные штампы оцифровки (Digitized by Google, библиотечные штампы) — удаляются;
  5. переносы: «tempta-\\ntions» → «temptations» (если продолжение со строчной буквы);
  6. строки внутри блока склеиваются; абзацы, разорванные границей страницы, сшиваются;
  7. подписи к иллюстрациям — короткие блоки без знака препинания в конце — помечаются [Illustration: …];
  8. издательская реклама в конце книги — отрезается;
  9. оценка качества OCR: доля служебных слов языка и доля «мусорных» символов.
Результат — текст в формате, который понимает 02_segment.py (абзацы через пустую строку).
"""
import re, unicodedata
from collections import Counter

FW = {
 'en': set('the of and to in a is that was it for on with as he by at be his i which from this had were not but are we have they or an all their there one been so would her she them who my me no our into upon when more some what if out up these very than then any its only also us'.split()),
 'fr': set("le la les de des du et un une est en que qui dans pour pas au aux il elle ils nous je on se ne sur par avec plus son sa ses mais ce cette ces comme tout leur leurs été avait sont était ont lui y bien sans même où dont avons après".split()),
 'de': set('der die das und in den von zu mit sich des auf für ist im dem nicht ein eine als auch es an werden aus er hat daß dass sie nach wird bei einer um am sind noch wie einem über so zum war haben nur oder aber vor zur bis mehr durch man ich wir uns ihre ihr sein seine wurde wenn hatte waren'.split()),
 'nl': set('de het een en van in is dat op te zijn voor met die niet aan er om ook als bij of uit maar door over ze zich hij was naar dan wat zo nog al wij ik onze hun werd tot'.split()),
 'it': set('il la di e che le in un una per del della si non è con lo gli dei delle al alla da nel nella ma come più sono era erano ci noi io mi suo sua loro questo questa anche se ha hanno fu molto quando poi'.split()),
 'da': set('og i at det en af til er som på de med den han vi ikke et der var for sig fra har men om havde jeg mig vor vore os sin sine de dem nu kun ogsaa også meget over eller naar når efter'.split()),
 'no': set('og i at det en av til er som på de med den han vi ikke et der var for seg fra har men om hadde jeg meg vår våre oss sin sine dem nu nå kun også meget over eller når efter etter'.split()),
 'pl': set('i w na z się nie do to że jest o jak po a od przez ale tak go jego ich już był była było były tylko my nas nam mnie ja co który która które dla przy we ze za aż'.split()),
 'cs': set('a v se na je že to s z do o jak po k ve jsme jsem jsou byl byla bylo byli ale tak jeho jejich už jen my nás nám mne já co který která které pro při za od až by'.split()),
 'fi': set('ja on oli ei se että hän ne ovat olivat mutta kuin niin myös joka sen sitä siellä tämä mikä kun nyt vain jo sitten heidän meidän minä me olin olimme'.split()),
}
BOILER = re.compile(r"(Digitized by|Google\b|This is a digital copy of a book|Generated (on|for)|Internet Archive|University of Toronto|UNIVERSITY OF CALIFORNIA|LIBRARY OF THE|Bibliothèque nationale de France|gallica\.bnf\.fr|Conditions d'utilisation|source gallica|Delpher|Original from|Public Domain|http[s]?://)", re.I)
ADS = re.compile(r"(\b8vo\b|\bcr\. ?8vo|\bdemy\b|\bfcap\b|\bnet\.?\b|\d+s\. ?\d*d\.|price \d|in-8|in-18|in-12|\bfr\. ?\d|\bmark\b ?\d|\bM\. ?\d+[.,]\d\d|Verlag von|Librairie .{0,30}Envoi franco|CATALOGUE OF|NEW BOOKS|Messrs\.)", re.I)
TERMINAL = tuple('.!?:;"»”’)…]')

def norm(text):
    t = unicodedata.normalize('NFC', text.replace('\r', '').replace('\f', '\n\n'))
    t = t.replace('ſ', 's').replace('ﬁ', 'fi').replace('ﬂ', 'fl').replace('ﬀ', 'ff').replace('ﬃ', 'ffi').replace('­', '')
    t = re.sub(r'[ \t ]+', ' ', t)
    t = re.sub(r' +([,.])', r'\1', t)              # «word ,» → «word,» (французские ; : ! ? не трогаем)
    return t

def key(block):
    return re.sub(r'[\d\W_]+', ' ', block).strip().lower()

# флективные языки (fi, pl, cs) дают меньше служебных слов: пороги калиброваны по чистым текстам PG/Runeberg
GOOD = {'fi': .20, 'pl': .22, 'cs': .22}
USABLE = {'fi': .14, 'pl': .16, 'cs': .16}

def quality(text, lang):
    toks = re.findall(r"[a-zàâäçéèêëîïôöùûüœæßñåøÿ']+", text.lower())
    n = len(toks) or 1
    fw = sum(1 for w in toks if w in FW.get(lang, FW['en'])) / n
    junk = len(re.findall(r"[^\w\s.,;:'\"!?()\-—–«»„“”’…]", text)) / max(1, len(text))
    return dict(tokens=len(toks), function_word_share=round(fw, 3), junk_char_share=round(junk, 4),
                verdict='good' if fw >= GOOD.get(lang, .30) and junk < 0.01 else 'usable' if fw >= USABLE.get(lang, .22) and junk < 0.02 else 'reject')

GOOGLE_START = re.compile(r"This\s+is\s+a\s+digital\s+copy\s+of\s+a\s+book|Ceci\s+est\s+une\s+copie\s+numérique\s+d.un\s+ouvrage|Dies\s+ist\s+ein\s+digitales\s+Exemplar\s+eines\s+Buches|Questo\s+è\s+un\s+esemplare\s+digitale|Dit\s+is\s+een\s+digitale\s+kopie|Detta\s+är\s+en\s+digital\s+kopia|Dette\s+er\s+en\s+digital\s+kopi", re.I)
GOOGLE_END = re.compile(r"b\s*o\s*o\s*k\s*s?\s*\.\s*g\s*o\s*o\s*g\s*l\s*e\s*\.\s*\S+|google\s*\.\s*com\s*/?\S*", re.I)
GOOGLE_END2 = re.compile(r"Google\s+(?:Book\s+Search|Recherche\s+de\s+Livres|Buchsuche|Ricerca\s+Libri)[^\n]*", re.I)

def strip_google(text):
    """Вводный дисклеймер Google Books (бывает два подряд: англ. + франц./нем.): от первой фразы до последней
    ссылки books.google.* (или упоминания Google Book Search) в пределах 9 тыс. знаков."""
    n = 0
    for _ in range(3):
        m = GOOGLE_START.search(text[:25000])
        if not m: break
        win = text[m.start():m.start() + 9000]
        ends = list(GOOGLE_END.finditer(win)) or list(GOOGLE_END2.finditer(win))
        if not ends: break
        text = text[:m.start()] + '\n\n' + text[m.start() + ends[-1].end():]; n += 1
    return text, n

def clean(text, lang='en'):
    log = Counter()
    # вводный дисклеймер Google Books (несколько абзацев) — во всех копиях одинаков и даёт ложные «заимствования»
    text, ng = strip_google(text)
    if ng: log['google_disclaimer'] += ng
    blocks = [b.strip('\n') for b in re.split(r'\n\s*\n', norm(text))]
    blocks = [b for b in blocks if b.strip()]
    # колонтитулы и номера страниц
    reps = Counter(key(b) for b in blocks if len(b) <= 70 and b.count('\n') <= 1)
    heads = {k for k, c in reps.items() if c >= 4 and k and len(k) <= 60}
    kept = []
    for b in blocks:
        s = b.strip()
        if re.fullmatch(r'[\[\(]?\s*(\d{1,4}|[ivxlcdm]{1,7})\s*[\]\)]?\.?', s, re.I): log['page_number'] += 1; continue
        if len(s) <= 70 and s.count('\n') <= 1 and key(s) in heads: log['running_head'] += 1; continue
        lines = [l for l in s.split('\n') if not (BOILER.search(l) and len(l) < 120)]
        if len(lines) < len(s.split('\n')): log['boilerplate_line'] += len(s.split('\n')) - len(lines)
        # колонтитул первой строкой блока: «176 THROUGH SIBERIA.»
        while lines and (key(lines[0]) in heads or re.fullmatch(r'\s*\d{1,4}\s*', lines[0])) and len(lines) > 1:
            lines.pop(0); log['running_head_inline'] += 1
        if not lines: continue
        kept.append('\n'.join(lines))
    # переносы и склейка строк
    joined = []
    for b in kept:
        b2, n = re.subn(r'(\w)[-¬]\s*\n\s*([a-zàâäçéèêëîïôöùûüœæßåø])', r'\1\2', b)
        log['dehyphenated'] += n
        joined.append(re.sub(r'\s*\n\s*', ' ', b2).strip())
    # подписи к иллюстрациям
    out = []
    for b in joined:
        w = b.split()
        if 1 <= len(w) <= 7 and not b.endswith(TERMINAL) and not re.match(r'(CHAPTER|CHAPITRE|KAPITEL|HOOFDSTUK|[IVXLC]+\.?$)', b, re.I) and b[:1].isupper() and not b.isupper():
            out.append(f'[Illustration: {b}]'); log['caption'] += 1
        else:
            out.append(b)
    # сшивка абзацев через границу страницы (в т.ч. перенос слова на границе)
    merged = []
    for b in out:
        if merged and not merged[-1].startswith('[Illustration') and not b.startswith('[Illustration'):
            prev = merged[-1]
            if prev.endswith('-') and b[:1].islower():
                merged[-1] = prev[:-1] + b; log['page_join_hyphen'] += 1; continue
            if not prev.endswith(TERMINAL) and (b[:1].islower() or b[:1] in ',;') and len(prev.split()) > 8:
                merged[-1] = prev + ' ' + b; log['page_join'] += 1; continue
        merged.append(b)
    # реклама издательства в конце
    tail0 = int(len(merged) * 0.85)
    for i in range(tail0, len(merged)):
        win = merged[i:i+5]
        if len(win) >= 3 and sum(bool(ADS.search(x)) for x in win) >= 3:
            log['ads_blocks_cut'] = len(merged) - i; merged = merged[:i]; break
    text_out = '\n\n'.join(merged)
    q = quality(text_out, lang)
    return text_out, dict(log), q

if __name__ == '__main__':
    import sys, json
    t = open(sys.argv[1], encoding='utf-8').read(); lang = sys.argv[2] if len(sys.argv) > 2 else 'en'
    out, log, q = clean(t, lang); print(json.dumps(dict(log=log, quality=q), ensure_ascii=False)); print(out[:3000])
