#!/usr/bin/env bash
# Полный перезапуск конвейера v0.5. Требует: python>=3.10, pandas, numpy, scipy, networkx, scikit-learn, statsmodels, reverse_geocoder.
# Тексты: GITenberg-клоны в ../raw_repos и OCR с archive.org в $CORPUS_DIR (tools/fetch_corpus.py).
set -euo pipefail
export CORPUS_DIR=${CORPUS_DIR:-../siberia_corpus}
python3 analysis/01_clean.py          # очистка OCR/PG, контроль качества
python3 analysis/02_segment.py        # главы/абзацы, паратекст, TEI P5
python3 analysis/lexicon.py           # словарь этнонимов (10 языков)
python3 analysis/gazetteer.py         # газеттир
python3 analysis/03_extract.py        # упоминания, регион абзаца, ручные маршруты
python3 analysis/04_annotate.py       # правила v1 (только как кандидаты)
python3 analysis/05_analyze.py        # базовая аналитика → site_data
cd analysis
python3 07a_routes_auto.py            # автомаршруты всех книг + проверка по ручным
python3 07b_relations.py              # диады, профили, сети по периодам
python3 07c_discourse.py              # дискурсы (вымирание, цивилизационная иерархия, …)
python3 07d_colloc_ngram.py           # коллокации по этносам, Ngram-датасеты
python3 07e_intertext.py              # сеть цитирований и заимствований
python3 07f_topics_keyness.py         # NMF-темы и ключевые слова
python3 07g_journeys.py               # путешествия: восстановленные маршруты + черновики с доказательствами, проверка
python3 07h_review_import.py          # импорт проверки маршрутов по тексту с контролем цитат и абзацев
python3 07i_geocode_new_places.py     # координаты новых мест маршрутов: сверка с GeoNames
python3 07j_manual_coords.py          # ручные оценки координат для мест, не найденных в справочниках (≈, ждут проверки)
python3 08a_illustrations.py          # иллюстрации и карты по сканам Internet Archive (долго; кэш томов в $ILL_CACHE)
# python3 08_expert_sample.py         # ВНИМАНИЕ: пересоздаёт выборку — запускать только для новой разметки
python3 09_expert_models.py           # оценки по ручной выборке, модели, точность правил
cd ..
python3 analysis/06_dashboard_data.py && python3 analysis/06b_dashboard_research.py
python3 analysis/08d_page_index.py          # абзацы библиотеки ↔ страницы сканов IA
python3 analysis/08c_illustrations_gutenberg.py   # иллюстрации из HTML-изданий Gutenberg
python3 analysis/10_build_site.py && python3 analysis/08b_illustrations_site.py   # данные сайта, иллюстрации с учётом проверки
python3 analysis/11_export_lpf.py           # газеттир в Linked Places Format (WHG) и маршруты в GeoJSON
