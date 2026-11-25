#!/usr/bin/env python3
"""
00_discover.py — research-first discovery of European travelogues about Siberia.

Pipeline (stdlib only; needs network access to archive.org — run it on your own
machine: `python3 analysis/00_discover.py --stage all`):

  A. SEEDS     data/seed_bibliography.csv — known items harvested BEFORE searching:
               * Cross, "In the Lands of the Romanovs" (annotated bibliography of
                 English-language first-hand accounts, codes like K292);
               * Lansdell, "Through Siberia" (1882), Appendix G (bibliography);
               * citations found inside corpus texts (05_analyze citations.csv);
               * secondary literature (Moussa & Stroev; Broc's dictionary of French
                 travellers; Schweitzer for German; Polish exile literature);
               * national bibliographies: DDB/BSB "Reisebericht" + Sibirien,
                 BnF/Gallica "Sibérie -- Descriptions et voyages", Runeberg.
               Each seed has author_origin and an a-priori decision
               (include / check / exclude_us / exclude_russian / exclude_genre).
  B. RESOLVE   known-item search per seed on archive.org with surname + title
               keywords AND stem-variants (siberia* / siberian, sibéri*, sibiri*),
               because title-only "siberia" misses "Siberian steppe" (Lethbridge).
  C. SWEEP     broad multilingual stem + toponym/ethnonym sweep 1800–1940
               (en/fr/de/nl/it/sv/da/no/pl/cs/fi), minus authors already in the plan.
  D. SCREEN    download *_djvu.txt; OCR quality (function-word share, junk share),
               genre signals (first-person rate per 1000 words) and Siberia density
               (toponyms/ethnonyms per 10k words). Verdict rules below.
  E. REPORT    data/discovery/recall_report.csv — every seed with its status:
               in_plan / found_public / found_restricted / not_on_ia (→ HathiTrust,
               Gallica, BSB/MDZ, Polona, Digi.kansalliskirjasto, Runeberg, Delpher).

Screening verdict (stage D):
  ocr:   good fw>=0.30 & junk<0.01; usable fw>=0.22 & junk<0.02; else reject
  genre: travelogue fp>=10; travel+analysis fp>=3; else non-first-person (check)
  scope: core sib>=40; partial 10..40 (only Siberian chapters are used); else off
"""
import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "discovery"
IA_SEARCH = "https://archive.org/advancedsearch.php"
UA = {"User-Agent": "siberia-travelogues-discovery/0.3 (research; contact repo owner)"}

STEMS = ["siberia*", "siberian", "siberie*", "sibérie*", "sibirien*", "sibirisch*",
         "siberië", "siberische", "siperia*", "syberi*", "sybir*", "sibiř*", "sibiri"]
TOPO = ["kamtschat*", "kamtchat*", "kamchat*", "amoor", "amur", "baikal", "yenisei*",
        "jenissei*", "yakut*", "jakut*", "tobolsk", "irkutsk", "irkoutsk", "sakhalin*",
        "saghalien", "chukch*", "tschuktsch*", "ostjak*", "ostiak*", "samoyed*",
        "samojed*", "tungus*", "kirghiz", "kirgisen", "buriat*", "bouriate*", "altai",
        '"trans-siberian"', "transsibérien", "transsibirisch*"]
LANGS = {"en": "eng OR english", "fr": "fre OR french", "de": "ger OR german OR deu",
         "nl": "dut OR dutch OR nld", "it": "ita OR italian", "sv": "swe OR swedish",
         "da": "dan OR danish", "no": "nor OR norwegian", "pl": "pol OR polish",
         "cs": "cze OR czech", "fi": "fin OR finnish"}
NOT_COLL = "NOT collection:(pubmed OR jstor_ejc OR arxiv OR periodicals OR serials)"

FW = {"en": r"the|and|of|to|in|a|was|is|that|we|it|with|for|as|which",
      "fr": r"le|la|les|de|des|et|à|un|une|en|du|que|est|nous|il|qui|dans",
      "de": r"der|die|das|und|in|zu|den|von|mit|ist|ein|eine|sich|wir|nicht|auf",
      "it": r"il|la|di|e|che|le|in|un|una|per|del|della|si|non|è|con",
      "da": r"og|i|at|det|en|af|til|er|som|på|de|med|den|han|vi|ikke",
      "sv": r"och|i|att|det|som|en|på|är|av|för|med|till|den|vi|de|han",
      "nl": r"de|het|een|en|van|in|is|dat|op|te|zijn|met|voor|niet|wij|die",
      "pl": r"i|w|na|z|się|nie|do|to|że|jest|o|jak|po|a|od|przez",
      "cs": r"a|v|se|na|je|že|to|s|z|do|o|jak|po|k|ve|jsme"}
FP = {"en": r"I|we|my|our|us|me", "fr": r"je|nous|mon|ma|mes|notre|nos|j",
      "de": r"ich|wir|mein|meine|unser|unsere|uns|mich|mir",
      "it": r"io|noi|mio|mia|nostro|nostra|ci", "da": r"jeg|vi|min|mit|vor|vort|os|mig",
      "sv": r"jag|vi|min|mitt|vår|vårt|oss|mig", "nl": r"ik|wij|we|mijn|ons|onze|mij",
      "pl": r"ja|my|mój|moja|nasz|nasza|nas|mnie", "cs": r"já|my|můj|moje|náš|naše|nás|jsem|jsme"}
SIB = re.compile(r"sib[ei]r|sibér|syber|sibiř|siperi|irk[ou]tsk|tomsk|tobolsk|ja?k[ou]tsk|"
                 r"yakutsk|amoo?r|baika|y?jeniss?e|yenise|krasno[jy]ars|omsk|kamt?s?ch?at|"
                 r"tschukt|chukch|ostja|ostia|samoj|samoy|tungus|toungous|bur[ij]at|bouriat|"
                 r"kirghi|kirgis|semipalat|barnaul|nert?s?chinsk|kiakhta|kjachta|kiachta", re.I)


def get(url, params=None, tries=3):
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def ia_search(q, rows=100, page=1):
    fl = ["identifier", "title", "date", "creator", "publisher", "language", "imagecount", "volume"]
    data = json.loads(get(IA_SEARCH, {"q": q, "fl[]": fl, "rows": rows, "page": page, "output": "json"}))
    return data["response"]["numFound"], data["response"]["docs"]


def flat(v):
    return "; ".join(v) if isinstance(v, list) else str(v or "")


def plan_authors():
    names, ids = set(), set()
    with open(ROOT / "data" / "corpus_plan.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["author"]:
                names.add(r["author"].split()[-1].lower()[:6])
            ids.update(x for x in r["ia_ids"].split(";") if x)
    return names, ids


# ---------------------------------------------------------------- B. resolve
def title_query(words):
    """Expand each title word to stem variants so 'siberia' also hits 'siberian'."""
    parts = []
    for w in words:
        w = w.lower()
        if w.startswith("siberia") or w.startswith("sibéri") or w.startswith("sibiri"):
            parts.append("(" + " OR ".join(STEMS) + ")")
        elif len(w) > 3:
            parts.append(w[:-1] + "*" if len(w) > 6 else w)
    return " AND ".join(f"title:{p}" if p.startswith("(") else f"title:({p})" for p in parts)


def stage_resolve():
    seeds = list(csv.DictReader(open(ROOT / "data" / "seed_bibliography.csv", encoding="utf-8")))
    out = []
    for s in seeds:
        if s["decision"].startswith("exclude"):
            continue
        sur = s["author"].split(",")[0].split()[-1]
        tq = title_query(s["title_keywords"].split())
        qs = [f"creator:({sur}) AND {tq}", f"creator:({sur}) AND ({' OR '.join('title:'+x for x in STEMS)})", tq]
        hits = {}
        for q in qs:
            try:
                n, docs = ia_search(f"({q}) AND mediatype:texts AND date:[1790 TO 1945]", rows=20)
            except Exception as e:
                print("ERR", s["seed_id"], e, file=sys.stderr); continue
            for d in docs:
                hits.setdefault(d["identifier"], d)
            if hits:
                break
        for d in hits.values():
            out.append({"seed_id": s["seed_id"], "identifier": d["identifier"], "title": flat(d.get("title"))[:120],
                        "date": str(d.get("date", ""))[:4], "creator": flat(d.get("creator"))[:60],
                        "publisher": flat(d.get("publisher"))[:60], "language": flat(d.get("language"))})
        if not hits:
            out.append({"seed_id": s["seed_id"], "identifier": "", "title": "NOT FOUND ON IA"})
        time.sleep(0.5)
    write(OUT / "candidates_known.csv", out)


# ---------------------------------------------------------------- C. sweep
def stage_sweep():
    known, plan_ids = plan_authors()
    title = "title:(" + " OR ".join(STEMS + TOPO) + ")"
    out = []
    for lang, lq in LANGS.items():
        q = f"{title} AND language:({lq}) AND mediatype:texts AND date:[1800 TO 1940] AND {NOT_COLL}"
        page = 1
        while True:
            n, docs = ia_search(q, rows=500, page=page)
            for d in docs:
                cr = flat(d.get("creator")).lower()
                if d["identifier"] in plan_ids or any(k in cr for k in known):
                    continue
                if int(d.get("imagecount") or 0) and int(d["imagecount"]) < 120:
                    continue  # pamphlets, offprints
                out.append({"lang": lang, "identifier": d["identifier"], "date": str(d.get("date", ""))[:4],
                            "creator": flat(d.get("creator"))[:60], "title": flat(d.get("title"))[:140],
                            "publisher": flat(d.get("publisher"))[:60], "imagecount": d.get("imagecount", "")})
            if page * 500 >= n:
                break
            page += 1
        print(lang, n, file=sys.stderr)
    write(OUT / "candidates_sweep.csv", out)


# ---------------------------------------------------------------- D. screen
def screen_text(t):
    s = t[int(len(t) * .1):int(len(t) * .9)]
    words = max(1, len(s.split()))
    head = s[:60000]
    lang = max(FW, key=lambda k: len(re.findall(rf"\b({FW[k]})\b", head)))
    fw = len(re.findall(rf"\b({FW[lang]})\b", s)) / words
    junk = len(re.findall(r"[^\w\s.,;:!?'\"()\-—–]", s)) / max(1, len(s))
    fp = len(re.findall(rf"\b({FP[lang]})\b", s, flags=0 if lang == "en" else re.I)) / words * 1000
    sib = len(SIB.findall(s)) / words * 10000
    ocr = "good" if fw >= .30 and junk < .01 else "usable" if fw >= .22 and junk < .02 else "reject"
    genre = "travelogue" if fp >= 10 else "travel+analysis" if fp >= 3 else "check"
    scope = "core" if sib >= 40 else "partial" if sib >= 10 else "off"
    return dict(lang=lang, words=words, fw=round(fw, 3), junk=round(junk, 4), fp=round(fp, 1),
                sib=round(sib, 1), ocr=ocr, genre=genre, scope=scope)


def stage_screen(ids):
    out = []
    for i in ids:
        row = {"identifier": i}
        try:
            meta = json.loads(get(f"https://archive.org/metadata/{i}"))
            files = meta.get("files", [])
            restricted = meta.get("metadata", {}).get("access-restricted-item") == "true"
            txt = next((f["name"] for f in files if f["name"].endswith("_djvu.txt")), None)
            row["access"] = "restricted" if restricted else ("public" if txt else "no_text")
            if txt and not restricted:
                row.update(screen_text(get(f"https://archive.org/download/{i}/{urllib.parse.quote(txt)}")
                                       .decode("utf-8", "replace")))
        except Exception as e:
            row["access"] = f"error: {e}"
        out.append(row); time.sleep(0.5)
    write(OUT / "screening.csv", out)


# ---------------------------------------------------------------- E. report
def stage_report():
    seeds = list(csv.DictReader(open(ROOT / "data" / "seed_bibliography.csv", encoding="utf-8")))
    plan = {r["work_id"]: r for r in csv.DictReader(open(ROOT / "data" / "corpus_plan.csv", encoding="utf-8"))}
    rows, counts = [], {}
    for s in seeds:
        st = ("in_plan" if s["work_id"] in plan else
              s["decision"] if s["decision"].startswith("exclude") else
              "found_public" if s["ia_id"] else "not_on_ia")
        counts[st] = counts.get(st, 0) + 1
        rows.append({**{k: s[k] for k in ("seed_id", "seed_source", "author", "year", "origin", "decision")},
                     "status": st, "ia_id": s["ia_id"], "next_library": s.get("next_library", "")})
    write(OUT / "recall_report.csv", rows)
    eligible = sum(v for k, v in counts.items() if not k.startswith("exclude"))
    print(json.dumps({"counts": counts, "eligible_seeds": eligible,
                      "recall_in_plan": round(counts.get("in_plan", 0) / max(1, eligible), 3)}, indent=1))


def write(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, keys); w.writeheader(); w.writerows(rows)
    print("wrote", path, len(rows), file=sys.stderr)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", choices=["resolve", "sweep", "screen", "report", "all"], default="report")
    ap.add_argument("--ids", nargs="*", help="identifiers for --stage screen")
    a = ap.parse_args()
    if a.stage in ("resolve", "all"): stage_resolve()
    if a.stage in ("sweep", "all"): stage_sweep()
    if a.stage in ("screen",): stage_screen(a.ids or [])
    if a.stage in ("report", "all"): stage_report()
