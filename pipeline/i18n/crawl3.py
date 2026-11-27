import json, subprocess, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765'], cwd='/home/claude/gh-repo', stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
R = ['home','scope','method','peoples','people-buryat','people-kazakh-kirghiz','people-tuvan','illustrations','publications','links','analytics','analytics-eval','analytics-ngram','analytics-disc','analytics-rel','book-kubalski1856','book-ossendowski1922','book-cipolla1919','book-sheepshanks1903','book-eden1879','book-johnson1907','book-felinska1854','book-lansdell1883','atlas']
errs=[]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg = b.new_page(viewport={'width':1400,'height':1000})
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://localhost:8765/index.html?lang=en#home'); pg.wait_for_timeout(2500)
    for r in R:
        pg.evaluate(f"location.hash='#{r}'"); pg.wait_for_timeout(1800)
        if r=='illustrations':
            pg.evaluate("document.querySelector('.ill a[data-i]')?.click()"); pg.wait_for_timeout(600); pg.evaluate("document.getElementById('dlg')?.close()")
    miss = sorted(pg.evaluate('[...I18N.miss]'))
    # русская версия: английские хвосты
    pg.goto('http://localhost:8765/index.html?lang=ru#home'); pg.wait_for_timeout(2000)
    eng=set()
    for r in ['book-felinska1854','book-lansdell1883','people-kazakh-kirghiz','scope','links']:
        pg.evaluate(f"location.hash='#{r}'"); pg.wait_for_timeout(2000)
        t=pg.evaluate("document.querySelector('main').innerText")
        import re
        for m in re.findall(r"(?:Left-click[^\n]*|\b(?:Polish|British|exile|traveller)\b[^\n]{0,30})",t): eng.add(m)
    b.close()
srv.terminate()
json.dump(miss, open('miss3.json','w'), ensure_ascii=False, indent=0)
print(len(miss), errs[:5]); print('RU english:', sorted(eng)[:10])
