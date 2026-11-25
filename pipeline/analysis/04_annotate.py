"""Этап 4: автоматическая разметка описаний (пара «абзац × группа») по схеме аннотации v1.

Поля:
  themes      – тематические коды (несколько), по словарям в предложениях с упоминанием
  polarity    – positive / negative / ambivalent / neutral (оценочная лексика в тех же предложениях)
  obs_type    – reported / bookish / personal / generalization / unmarked
  relations   – (группа A, тип, группа B) при совместном упоминании в одном предложении + маркер типа
Метод 'auto_rules_v1'; качество измеряется на эталонной выборке (validation/gold_units.csv).
"""
import json, csv, re, pathlib
from collections import defaultdict, Counter
ROOT = pathlib.Path(__file__).resolve().parents[1]

def stems(*ws): return r'\b(?:' + '|'.join(ws) + r')'

# ---------- тематические словари (en / fr / de / fi) ----------
THEMES = {
 'appearance':   stems(r'fac(?:e|es|ial)\b', r'features\b', r'complexion', r'skin\b', r'eyes\b', r'hair\b', r'beard', r'stature', r'physiognom', r'cheek-?bones?', r'ugl[yi]', r'handsome', r'pretty', r'tall\b', r'short\b', r'stout', r'visage', r'traits', r'teint', r'cheveux', r'Gesicht', r'Augen\b', r'Haar', r'Gestalt', r'kasvo', r'silm[äi]', r'tukka', r'hiu[sk]', r'kaun[ii]', r'ruma'),
 'character':    stems(r'honest', r'dishonest', r'lazy', r'laziness', r'indolen', r'industrious', r'cunning', r'treacher', r'brave', r'coward', r'timid', r'cheerful', r'good-natured', r'kind(?:ly|ness)?\b', r'cruel', r'stupid', r'intelligen', r'clever', r'childlike', r'docile', r'peaceful', r'peaceable', r'quarrel', r'savage', r'wild\b', r'polite', r'thie(?:f|ves|ving)', r'liar', r'lying\b', r'faithful', r'loyal', r'honnête', r'paresse', r'courage', r'sauvage', r'ehrlich', r'faul\b', r'träge', r'tapfer', r'gutmütig', r'wild(?:e|en)?\b', r'rehelli', r'laiska', r'laiskuu', r'ystävälli', r'hyväluontoi', r'viekas', r'villi', r'tyhm', r'älykä', r'iloi', r'rauhalli', r'luotettav'),
 'hygiene':      stems(r'dirt', r'filth', r'squalor', r'stench', r'smell', r'unwashed', r'vermin', r'lice\b', r'clean(?:ly|liness)?\b', r'malpropre', r'saleté', r'sale\b', r'Schmutz', r'schmutzig', r'Gestank', r'lika', r'likai', r'siivo', r'puhta', r'haju'),
 'alcohol':      stems(r'vodka', r'brandy', r'spirits\b', r'drunk', r'intoxicat', r'liquor', r'alcohol', r'eau-de-vie', r'ivre', r'ivrogn', r'Branntwein', r'Schnaps', r'betrunken', r'Trunk', r'viina', r'humala', r'juoppo', r'juopu', r'väkijuom', r'alkoholi'),
 'religion':     stems(r'shaman', r'schaman', r'šaman', r'samaan', r'idol', r'pagan', r'heathen', r'Buddh', r'Bhuddh', r'lama\b', r'lamas\b', r'Christian', r'baptiz', r'baptis', r'convert', r'missionar', r'priest', r'church', r'chapel', r'icon', r'sacrific', r'Mohammedan', r'Mahometan', r'Mussulman', r'Moslem', r'mosque', r'superstiti', r'spirits of', r'païen', r'idolâtr', r'chrétien', r'prêtre', r'Heide', r'Götzen', r'Priester', r'Kirche', r'getauft', r'noita', r'noidu', r'pakana', r'jumal', r'kristi', r'kastet', r'pappi', r'kirkko', r'uhri', r'taikausko', r'muhamedilai', r'lähetys'),
 'economy_trade':stems(r'trad(?:e|er|ers|ing)\b', r'barter', r'merchant', r'bargain', r'market', r'fair\b', r'furs?\b', r'sable', r'skins\b', r'price', r'sell', r'sold\b', r'buy', r'bought', r'debt', r'credit', r'goods\b', r'commerce', r'marchand', r'fourrure', r'vendre', r'acheter', r'Handel', r'Kaufmann', r'Kaufleute', r'Pelz', r'verkauf', r'kauppa', r'kauppia', r'turki', r'myy', r'osta', r'velka', r'hinta'),
 'subsistence':  stems(r'reindeer', r'deer\b', r'herds?\b', r'cattle', r'horses\b', r'sheep', r'fish(?:ing|ermen)?\b', r'salmon', r'hunt', r'trap', r'nomad', r'pastur', r'agricultur', r'plough', r'harvest', r'crops?\b', r'renne', r'pêche', r'chasse', r'troupeau', r'Renntier', r'Herde', r'Fisch', r'Jagd', r'Ackerbau', r'poro', r'kalast', r'metsäst', r'paimen', r'karja', r'maanviljel', r'pyyn'),
 'dwelling':     stems(r'yourts?', r'yurts?', r'yarat', r'tents?\b', r'huts?\b', r'izba', r'chum\b', r'polog', r'balagan', r'dwelling', r'house(?:s)?\b', r'cabane', r'tente', r'Jurte', r'Zelt', r'Hütte', r'jurt', r'kota\b', r'kodan', r'maja', r'tupa', r'talo'),
 'clothing':     stems(r'dress(?:ed)?\b', r'cloth(?:es|ing)', r'costume', r'furs? coat', r'parka', r'kuklanka', r'boots', r'garment', r'vêtement', r'habit\b', r'Kleid', r'Tracht', r'puku', r'vaatte', r'turkki'),
 'language':     stems(r'language', r'speak', r'spoke', r'dialect', r'interpret', r'tongue\b', r'words?\b', r'langue', r'parler', r'Sprache', r'sprechen', r'kiel(?:i|en|tä)', r'puhu', r'tulkki'),
 'health_decline':stems(r'disease', r'small-?pox', r'syphilis', r'leprosy', r'lepers?', r'epidemic', r'famine', r'starv', r'dying out', r'dying race', r'extinct', r'decreas', r'diminish', r'die out', r'decline', r'maladie', r'disparaître', r'Krankheit', r'Seuche', r'aussterben', r'Hunger', r'tau(?:ti|di)', r'sairau', r'kuolevai', r'sukupuutto', r'vähent', r'nälkä', r'isorok', r'keuhkotau'),
 'administration':stems(r'yasak', r'iassak', r'tribute', r'tax(?:es)?\b', r'governor', r'ispravnik', r'official', r'chinovnik', r'law\b', r'laws\b', r'court\b', r'police', r'prince\b', r'starosta', r'elder\b', r'tribut', r'impôt', r'Tribut', r'Steuer', r'Beamte', r'jasak', r'vero', r'virkami', r'kuvernööri', r'laki\b', r'lait\b', r'pristavi', r'ruhtina'),
 'violence':     stems(r'murder', r'kill', r'war\b', r'wars\b', r'battle', r'fight', r'raid', r'attack', r'massacre', r'rob(?:bed|bery|bers)?\b', r'revolt', r'rebel', r'violence', r'guerre', r'tuer', r'massacr', r'Krieg', r'Kampf', r'Mord', r'überfall', r'sota', r'murha', r'tappo', r'tappa', r'ryöst', r'kapina'),
 'hospitality':  stems(r'hospitab', r'hospitality', r'welcome', r'guest', r'host\b', r'entertain', r'kindly received', r'hospitali', r'accueil', r'Gastfreund', r'Gast\b', r'vierasvarai', r'vieraanvarai', r'vieras', r'isäntä'),
 'gender_family':stems(r'wom[ae]n\b', r'wife', r'wives', r'marri', r'bride', r'polygam', r'children', r'girls?\b', r'femme', r'mariage', r'enfants', r'Frau', r'Weib', r'Ehe\b', r'heirat', r'Kinder', r'nai(?:nen|set|sia|ma)', r'vaimo', r'avioli', r'lapsi', r'lapset', r'morsian', r'häät'),
 'education_civ':stems(r'civili[sz]', r'barbar', r'primitive', r'educat', r'school', r'progress', r'enlighten', r'backward', r'culture\b', r'civilisé', r'école', r'Kultur', r'Schule', r'zivilis', r'sivisty', r'koulu', r'kulttuuri', r'alkeelli', r'raaka'),
}
THEME_RX = {k: re.compile(v, re.I) for k, v in THEMES.items()}

# ---------- оценочная лексика ----------
POS = re.compile(stems(r'honest', r'kind(?:ly|ness)?\b', r'good-natured', r'good-humou?red', r'hospitab', r'friendly', r'cheerful', r'brave', r'industrious', r'intelligent', r'clever', r'handsome', r'pretty', r'beautiful', r'excellent', r'fine\b', r'admir', r'charming', r'gentle', r'courteous', r'polite', r'peaceable', r'faithful', r'trustworthy', r'cleanly', r'skil(?:l|f)', r'generous', r'superior', r'sturdy', r'healthy', r'happy', r'merry', r'pleasant', r'respectab',
              r'honnête', r'bon(?:ne|s)?\b', r'hospitali', r'brave\b', r'aimable', r'doux', r'intelligen', r'beau\b', r'belle\b', r'ehrlich', r'gutmütig', r'freundlich', r'gastfreundlich', r'tapfer', r'fleißig', r'schön', r'klug', r'rehelli', r'ystävälli', r'hyväluontoi', r'vierasvarai', r'vieraanvarai', r'iloi', r'reipa', r'ahkera', r'älykä', r'kaun[ii]', r'terve', r'hyv[äi]', r'kelpo', r'siivo', r'luotettav', r'urhea', r'sävyisä'), re.I)
NEG = re.compile(stems(r'dirty', r'filth', r'squalid', r'lazy', r'indolen', r'cunning', r'treacher', r'cruel', r'stupid', r'savage', r'brutal', r'drunk', r'thie(?:f|ves|ving)', r'dishonest', r'liar', r'lying\b', r'coward', r'ugly', r'hideous', r'repulsive', r'disgust', r'wretched', r'miserable', r'degraded', r'debauch', r'vicious', r'sullen', r'surly', r'insolent', r'greedy', r'avaric', r'murderous', r'barbar', r'superstitious', r'idle\b', r'slovenly', r'unwashed', r'stench', r'stinking', r'lawless', r'scoundrel', r'rascal', r'villain', r'brut(?:e|es)\b', r'filthy', r'insanitary', r'gluttony', r'glutton',
              r'sale\b', r'malpropre', r'paresseu', r'cruel', r'stupide', r'sauvage', r'ivrogne', r'voleur', r'misérable', r'perfide', r'schmutzig', r'faul\b', r'träge', r'grausam', r'dumm', r'betrunken', r'diebisch', r'hässlich', r'elend', r'roh\b', r'likai', r'laiska', r'laiskuu', r'viekas', r'julma', r'tyhm', r'juoppo', r'varas', r'varka', r'ruma', r'kurja', r'raaka', r'villi', r'epärehelli', r'saita', r'ahne', r'inhottav', r'kehno', r'rähjäi'), re.I)

# ---------- тип наблюдения ----------
REPORTED = re.compile(r"\b(?:I was told|we were told|I am told|I have been told|I heard|we heard|they say|it is said|said to be|is reported|according to|I learned|we learned|informed me|assured me|on dit|on m'a dit|on raconte|man erzählt|man sagt|wie man mir|erzählte mir|sanottiin|kerrottiin|kerrotaan|sanotaan|kuulin|kertoi minulle|mukaan\b)", re.I)
BOOKISH = re.compile(r"\b(?:Gmelin|Pallas|Middendorff|Castr[ée]n|Erman|Atkinson|Lansdell|Kennan|Dittmar|Krasheninnikoff|Krascheninnikow|Steller|Cochrane|Hansteen|Humboldt|Radloff|Schrenck|Maack|Ahlqvist|Strahlenberg|Wrangell?|Sarytcheff|ethnolog|ethnograph|anthropolog|statistic|census|authorities|historians?|writers? on|travellers have|tutkija|tilasto|kirjoittaja|Statistik|statistique|recensement|selon les|d'après)", re.I)
FIRST_PERSON = {'en': re.compile(r"\b(?:I|we|me|us|my|our)\b"), 'fr': re.compile(r"\b(?:je|j'|nous|me|m'|mon|ma|mes|notre)\b", re.I),
                'de': re.compile(r"\b(?:ich|wir|mir|mich|uns|mein\w*|unser\w*)\b"), 'fi': re.compile(r"\b(?:minä|minun|minulle|minua|me\b|meidän|meille|meitä|näin\b|tapasin|saavuin|tulimme|olimme|oli meillä)\b|(?:imme|in)\b", re.I)}
FIRST_PERSON.update({'nl': re.compile(r"\b(?:ik|wij|we|mij|ons|mijn|onze)\b", re.I), 'it': re.compile(r"\b(?:io|noi|mi|ci|mio|mia|miei|nostr[oaie])\b", re.I),
    'da': re.compile(r"\b(?:jeg|vi|mig|os|min|mit|mine|vor|vort|vore)\b", re.I), 'no': re.compile(r"\b(?:jeg|vi|meg|oss|min|mitt|mine|vår|vårt|våre)\b", re.I),
    'pl': re.compile(r"\b(?:ja|my|mnie|nas|nam|mój|moja|moje|nasz\w*)\b", re.I), 'cs': re.compile(r"\b(?:já|my|mne|mě|nás|nám|můj|moje|náš|naše|jsem|jsme)\b", re.I)})
GENERIC = re.compile(r"\b(?:are|is|have|has|live|lives|never|always|generally|usually|as a rule|invariably|sont|ont|vivent|toujours|sind|haben|leben|immer|ovat|elävät|aina|yleensä|tavallisesti)\b", re.I)

# ---------- отношения ----------
REL = {
 'trade_exchange':  r'trad|barter|sell|sold|buy|bought|merchant|fair\b|exchange|commerce|vend|achet|Handel|kauf|kaupp|myy|osta|vaihta',
 'exploitation':    r'cheat|swindl|exploit|debt|usur|fleece|plunder|extort|oppress|rob\b|robbed|robbing|trompe|dupe|vole|ausbeut|betrüg|Schuld|lypsy|petk|riist|velka|nylk|sorta|hyväksikäy',
 'conflict':        r'war\b|fight|battle|raid|attack|kill|murder|massacre|feud|hostil|enem|revolt|guerre|combat|massacr|Krieg|Kampf|feind|sot(?:a|i)|taist|tappa|murha|vihollis|riida',
 'intermarriage_mixing': r'marri|half-?breed|half-?caste|mixed blood|mixture|crossed|intermarr|métis|mariage|Mischling|verheirat|naimisiin|avioli|sekarotu|sekaveri|puoliveri',
 'assimilation':    r'russif|adopt(?:ed)? the|forgott?en their|lost their (?:language|customs)|become russian|become like|imitat|borrow(?:ed)? from|assimil|russifi|venäläisty|samojedilaistu|omaksu|unohta|tatarisier',
 'administration_tribute': r'yasak|iassak|tribute|tax|governor|official|authorit|ispravnik|subject(?:ed)? to|rule[sd]?\b|conquer|tribut|impôt|soumis|Tribut|Steuer|beherrsch|jasak|vero|virkami|alamai|valloitt|hallit',
 'labour_service':  r'hire|hired|servant|labou?rer|work(?:ed|s)? for|employ|driver|guide|interpret|yemshik|yamshik|ouvrier|guide|Diener|Arbeiter|Führer|renki|palkka|ajuri|opas|tulkki',
 'religious_mission': r'convert|baptiz|baptis|missionar|christiani|priest|evangel|baptis|chrétien|bekehr|getauft|kastet|kääntä|lähetys|pappi',
 'coexistence_neighbourhood': r'live together|neighbou?r|side by side|among them|amongst|in company|mingle|alongside|voisin|Nachbar|naapur|yhdessä|keskuudessa|rinnakkain',
}
REL_RX = {k: re.compile(v, re.I) for k, v in REL.items()}

SENT_SPLIT = re.compile(r'(?<=[.!?;])\s+(?=[A-ZÀ-ÖØ-Þ„“"«(\[_])')

def sentences_with(text, spans):
    """Предложения, содержащие указанные смещения."""
    out, pos = [], 0
    for s in SENT_SPLIT.split(text):
        st = text.find(s, pos); en = st + len(s); pos = en
        if any(st <= a < en for a in spans): out.append((st, en, s))
    return out

def annotate():
    paras = {}
    for l in open(ROOT/'corpus/paragraphs.jsonl', encoding='utf-8'):
        r = json.loads(l); paras[r['pid']] = r
    lang = {r['work_id']: r['text_language'] for r in csv.DictReader(open(ROOT/'data/works.csv', encoding='utf-8'))}
    groups = {r['group_id']: r for r in csv.DictReader(open(ROOT/'data/groups.csv', encoding='utf-8'))}
    M = list(csv.DictReader(open(ROOT/'data/mentions.csv', encoding='utf-8')))
    by_pid = defaultdict(list)
    for m in M: by_pid[m['pid']].append(m)

    units, rels = [], []
    for pid, ms in by_pid.items():
        p = paras[pid]; t = p['text']; lg = lang[p['work_id']]
        by_group = defaultdict(list)
        for m in ms: by_group[m['group_id']].append(int(m['start']))
        # предложения → группы (для отношений)
        sent_groups = defaultdict(set)
        for g, sp in by_group.items():
            for st, en, s in sentences_with(t, sp): sent_groups[(st, en, s)].add(g)
        for g, sp in by_group.items():
            ss = sentences_with(t, sp); ctx = ' '.join(s for _, _, s in ss) or t
            themes = [k for k, rx in THEME_RX.items() if rx.search(ctx)]
            npos, nneg = len(POS.findall(ctx)), len(NEG.findall(ctx))
            pol = 'ambivalent' if npos and nneg else 'positive' if npos else 'negative' if nneg else 'neutral'
            if REPORTED.search(ctx): obs = 'reported'
            elif BOOKISH.search(ctx): obs = 'bookish'
            elif FIRST_PERSON.get(lg, FIRST_PERSON['en']).search(ctx): obs = 'personal'
            elif GENERIC.search(ctx): obs = 'generalization'
            else: obs = 'unmarked'
            units.append(dict(unit_id=f'{pid}__{g}', pid=pid, work_id=p['work_id'], chapter=p['chapter'], region=p['region'],
                              in_siberia=p['in_siberia'], group_id=g, category=groups[g]['category'], n_mentions=len(sp),
                              themes=';'.join(themes), pos_hits=npos, neg_hits=nneg, polarity=pol, obs_type=obs,
                              method='auto_rules_v1', context=ctx[:1500]))
        for (st, en, s), gs in sent_groups.items():
            gs = sorted(gs)
            if len(gs) < 2: continue
            types = [k for k, rx in REL_RX.items() if rx.search(s)] or ['co_mention']
            for i in range(len(gs)):
                for j in range(i+1, len(gs)):
                    for ty in types:
                        rels.append(dict(pid=pid, work_id=p['work_id'], region=p['region'], in_siberia=p['in_siberia'],
                                         group_a=gs[i], group_b=gs[j], rel_type=ty, sentence=s[:600], method='auto_rules_v1'))
    return units, rels

if __name__ == '__main__':
    units, rels = annotate()
    for path, rows in [('data/annotations.csv', units), ('data/relations.csv', rels)]:
        with open(ROOT/path, 'w', newline='', encoding='utf-8') as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    print('units', len(units), '| relations', len(rels))
    print(Counter(u['polarity'] for u in units)); print(Counter(u['obs_type'] for u in units))
    print(Counter(r['rel_type'] for r in rels).most_common())
