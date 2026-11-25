# Сибирь в европейских травелогах XIX–XX вв.

Статический сайт по итогам проекта РНФ: атлас маршрутов и ареалов, карточки народов (коллокации, Ngram, дискурсы), электронная библиотека 109 изданий, 3D-графы связей, аналитика, публикации, метод.

Сайт: https://pavelaleks.github.io/siberia-travelogues/

## Публикация на GitHub Pages
1. Создайте репозиторий (например, `siberia-travelogues-site`) и загрузите в корень всё содержимое этой папки, включая `.nojekyll`.
2. Settings → Pages → Source: *Deploy from a branch*, ветка `main`, папка `/ (root)`.
3. Через 1–2 минуты сайт откроется по адресу `https://<логин>.github.io/<репозиторий>/`.

Сборка не нужна: всё — чистые HTML/JS/JSON, библиотеки (d3, 3d-force-graph) лежат в `assets/vendor`. Тексты — 72 МБ, в лимиты GitHub укладываются (файлы < 3 МБ).

## Публикации
Заполните `data/publications.json` по образцу `data/publications.example.json`.
`status`: `published` | `in_press` | `submitted`. Поля `groups` и `works` (id народов и книг) связывают публикацию с карточками на сайте. PDF можно положить в папку `pubs/`.

## Структура репозитория
- корень — сам сайт (`index.html`, `assets/`, `data/`, `texts/`), его публикует GitHub Pages;
- `pipeline/` — исследовательский конвейер: очистка OCR, сегментация, извлечение этнонимов и мест, экспертная разметка и её проверка, модели, коллокации, Ngram, сети, заимствования (`pipeline/analysis/01…10_*.py`), протоколы проверки (`pipeline/validation/`), отчёт (`pipeline/docs/research_report_v0.5.md`). Большие таблицы упоминаний лежат в `.csv.gz`; исходные тексты корпуса (264 МБ) не включены — их можно заново скачать скриптами из `pipeline/fetch_kit/`.

## Обновление данных
Файлы в `data/` и `texts/` генерирует `pipeline/analysis/10_build_site.py`. После изменения разметки: `bash pipeline/run_all.sh`, затем скопировать результат сборки в корень.

## Локальный просмотр
`python3 -m http.server` в этой папке → http://localhost:8000
