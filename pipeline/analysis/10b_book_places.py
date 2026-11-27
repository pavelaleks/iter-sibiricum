"""Упоминания мест по абзацам каждой книги для чтения текста вместе с картой.
site/data/geo/<work>.json: {"m": [[номер абзаца, place_id, начало, конец], ...]} — смещения в тексте абзаца из texts/<work>.json."""
import json, pathlib
import pandas as pd
ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = ROOT.parent / 'site'; OUT = SITE / 'data' / 'geo'; OUT.mkdir(parents=True, exist_ok=True)
PM = pd.read_csv(ROOT / 'data/place_mentions.csv')
n = 0
for w, d in PM.groupby('work_id'):
    m = sorted([int(r.pid.split('_p')[1]), r.place_id, int(r.start), int(r.start) + len(r.form)] for r in d.itertuples())
    json.dump({'m': m}, open(OUT / f'{w}.json', 'w'), ensure_ascii=False, separators=(',', ':')); n += 1
print(n, 'книг')
