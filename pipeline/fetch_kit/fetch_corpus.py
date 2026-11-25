#!/usr/bin/env python3
"""Загрузка текстов корпуса на ваш компьютер (только стандартная библиотека Python 3.8+).

Запуск в Терминале:
    python3 fetch_corpus.py corpus_plan.csv ~/Galllica/siberia_corpus

Что делает:
  * archive.org — для каждого id из колонки ia_ids качает распознанный текст (*_djvu.txt) и metadata.json;
  * Gallica — для каждого ark из колонки gallica_arks качает «texteBrut» (сырой OCR) в .html;
  * пропускает уже скачанное (можно перезапускать), пауза между запросами — чтобы не нагружать библиотеки;
  * пишет журнал download_log.csv (что скачано, размер, ошибки).
Если Gallica отвечает 403 (защита Cloudflare), откройте gallica.bnf.fr в обычном браузере, пройдите проверку
и запустите скрипт ещё раз; если не поможет — отметьте эти книги, мы скачаем их через браузер вручную.
"""
import csv, json, sys, time, pathlib, urllib.request, urllib.error

UA = {'User-Agent': 'SiberiaTravelogues-DH/0.2 (research corpus; contact: project PI)'}

def get(url, timeout=120):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def main(plan, out):
    out = pathlib.Path(out).expanduser(); (out/'ia').mkdir(parents=True, exist_ok=True); (out/'gallica').mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(open(plan, encoding='utf-8')))
    log = open(out/'download_log.csv', 'a', newline='', encoding='utf-8'); lw = csv.writer(log)
    for r in rows:
        for ia in filter(None, (r.get('ia_ids') or '').split(';')):
            dest = out/'ia'/f'{ia}_djvu.txt'
            if dest.exists() and dest.stat().st_size > 1000: continue
            try:
                meta = json.loads(get(f'https://archive.org/metadata/{ia}'))
                (out/'ia'/f'{ia}_meta.json').write_text(json.dumps(meta.get('metadata', {}), ensure_ascii=False, indent=1), encoding='utf-8')
                fn = next((f['name'] for f in meta.get('files', []) if f['name'].endswith('_djvu.txt')), None)
                if not fn: lw.writerow([r['work_id'], ia, 'no_djvu_txt', 0]); continue
                data = get(f'https://archive.org/download/{ia}/{urllib.request.quote(fn)}')
                dest.write_bytes(data); lw.writerow([r['work_id'], ia, 'ok', len(data)]); print('ok', r['work_id'], ia, len(data))
            except Exception as e:
                lw.writerow([r['work_id'], ia, f'error: {e}', 0]); print('ERR', ia, e)
            log.flush(); time.sleep(2)
        for ark in filter(None, (r.get('gallica_arks') or '').split(';')):
            dest = out/'gallica'/f"{ark.replace('/', '_')}.html"
            if dest.exists() and dest.stat().st_size > 1000: continue
            try:
                data = get(f'https://gallica.bnf.fr/ark:/12148/{ark}.texteBrut', timeout=300)
                dest.write_bytes(data); lw.writerow([r['work_id'], ark, 'ok', len(data)]); print('ok', r['work_id'], ark, len(data))
            except urllib.error.HTTPError as e:
                lw.writerow([r['work_id'], ark, f'http {e.code}', 0]); print('ERR', ark, e.code)
            except Exception as e:
                lw.writerow([r['work_id'], ark, f'error: {e}', 0]); print('ERR', ark, e)
            log.flush(); time.sleep(5)
    print('done →', out)

if __name__ == '__main__':
    if len(sys.argv) < 3: sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
