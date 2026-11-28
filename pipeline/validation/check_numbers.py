"""Сверка чисел, которые сайт сообщает читателю, с исходными данными.

Каждое число в тексте сайта, записанное вручную (а не подставленное из данных), пересчитывается здесь из
файлов выборки и корпуса. Скрипт печатает таблицу «на сайте / по данным» и завершается с ошибкой, если
хотя бы одно число расходится. Результат: pipeline/validation/numbers_check.md.

Запуск из корня репозитория: python3 pipeline/validation/check_numbers.py
"""
import json, re, sys, pathlib
import pandas as pd
ROOT = pathlib.Path(__file__).resolve().parents[2]
APP = (ROOT / 'assets/app.js').read_text(encoding='utf-8')
A = json.load(open(ROOT / 'data/analytics.json', encoding='utf-8'))
W = json.load(open(ROOT / 'data/works.json', encoding='utf-8'))
E = pd.read_csv(ROOT / 'pipeline/data/expert_annotations_v04.csv')
R = pd.read_csv(ROOT / 'pipeline/data/expert_relations_v04.csv')
V = E[E.pol != 'invalid']
rows = []

def site(rx, grp=1, cast=int):
    m = re.search(rx, APP)
    return cast(m.group(grp).replace(',', '.')) if m else None

def check(what, on_site, actual, note=''):
    rows.append((what, on_site, actual, on_site == actual, note))

# --- выборка описаний ---
check('Описаний в выборке (метод)', site(r'(\d+) описаний коренных народов и \d+ фрагментов'), len(E), 'pipeline/data/expert_annotations_v04.csv')
check('Исключено как не относящиеся к народам Сибири', site(r'(\d+) описаний признаны не относящимися'), int((E.pol == 'invalid').sum()), 'pol = invalid')
check('Описаний в расчётах (главная)', site(r'\((\d+) описаний из \d+ книги'), len(V))
check('Книг в расчётах (главная)', site(r'\(\d+ описаний из (\d+) книги'), V.work_id.nunique())
check('Описаний в расчётах (analytics.json)', A['expert'][0]['n'], len(V))
pers = V[V.obs_m == 'personal']; sec = V[V.obs_m != 'personal']
check('Положительные оценки при личном наблюдении, % (без весов)', site(r'встречаются в (\d+)% описаний'), round(100 * (pers.pol == 'pos').mean()), f'n = {len(pers)}')
check('То же при пересказе, книжном знании, обобщении, % (без весов)', site(r'и в (\d+)% — по пересказу'), round(100 * (sec.pol == 'pos').mean()), f'n = {len(sec)}')
check('Размечено экспертами (не моделью)', None, int((E.annotator != 'model').sum()), 'для сведения: разметка пока предварительная')
# --- выборка отношений ---
check('Фрагментов об отношениях в выборке (метод)', site(r'\d+ описаний коренных народов и (\d+) фрагментов'), len(R), 'pipeline/data/expert_relations_v04.csv')
check('Фрагментов без выраженных отношений', site(r'в (\d+) фрагментах отношения между группами не выражены'), int((R.true_type == 'none').sum()))
check('Предложений с отношениями (аналитика)', site(r'<p>(\d+) предложени'), int((R.true_type != 'none').sum()))
# числа корпуса (книги, страны, маршруты) подставляются на сайте из данных и здесь не сверяются
pc = ROOT / 'data/places_count.json'
if pc.exists():
    P = json.load(open(pc, encoding='utf-8'))
    L = json.load(open(ROOT / 'data/export/iter-sibiricum-places.lpf.jsonld', encoding='utf-8'))
    check('Мест в газеттире (экспорт LPF)', len(L['features']), P['attested'], 'pipeline/validation/check_places.py')

bad = [r for r in rows if r[1] is not None and not r[3]]
md = ['# Сверка чисел на сайте с данными', '', '| показатель | на сайте | по данным | | примечание |', '|---|---|---|---|---|']
md += [f"| {w} | {'—' if s is None else s} | {a} | {'' if s is None else ('✓' if ok else '✗')} | {n} |" for w, s, a, ok, n in rows]
md += ['', f'Расхождений: {len(bad)}.']
(ROOT / 'pipeline/validation/numbers_check.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
for w, s, a, ok, n in rows: print(f"{'  ' if s is None else ('OK' if ok else '!!')} {w}: сайт {s} / данные {a}")
sys.exit(1 if bad else 0)
