import json, subprocess, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path('/home/claude/gh-repo')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
works = [w['id'] for w in json.load(open(ROOT / 'data/works.json'))]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1400, 'height': 1000})
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('http://localhost:8765/index.html?lang=en#atlas'); pg.wait_for_timeout(3000)
    # атлас: все книги по очереди
    opts = pg.evaluate("[...document.querySelectorAll('#fWork option')].map(o=>o.value).filter(Boolean)")
    for v in opts:
        pg.evaluate(f"(()=>{{const s=document.getElementById('fWork'); s.value='{v}'; s.dispatchEvent(new Event('change'))}})()"); pg.wait_for_timeout(350)
    for sel in ['fPer', 'fNat', 'fStay', 'fGr']:
        vals = pg.evaluate(f"[...document.querySelectorAll('#{sel} option')].map(o=>o.value).filter(Boolean)")
        for v in vals[:8]:
            pg.evaluate(f"(()=>{{const s=document.getElementById('{sel}'); if(!s) return; s.value='{v}'; s.dispatchEvent(new Event('change'))}})()"); pg.wait_for_timeout(250)
    # анализ: все вкладки
    for sec in ['eval', 'ngram', 'disc', 'rel', 'topics', 'reuse']:
        pg.evaluate(f"location.hash='#analytics-{sec}'"); pg.wait_for_timeout(1500)
    pg.evaluate("location.hash='#links'"); pg.wait_for_timeout(2000)
    pg.evaluate("document.getElementById('mI')?.click()"); pg.wait_for_timeout(1500)
    # иллюстрации: фильтры и окна
    pg.evaluate("location.hash='#illustrations'"); pg.wait_for_timeout(2500)
    for sel in ['fR', 'fG', 'fP']:
        vals = pg.evaluate(f"[...document.querySelectorAll('#{sel} option')].map(o=>o.value).filter(Boolean)")
        for v in vals[:3]:
            pg.evaluate(f"(()=>{{const s=document.getElementById('{sel}'); s.value='{v}'; s.dispatchEvent(new Event('change'))}})()"); pg.wait_for_timeout(300)
    ids = pg.evaluate("[...document.querySelectorAll('.ill a[data-i]')].slice(0,15).map(a=>a.dataset.i)")
    for i in ids:
        pg.evaluate(f"document.querySelector('.ill a[data-i=\"{i}\"]').click()"); pg.wait_for_timeout(250)
        pg.evaluate("document.getElementById('dlg')?.close()")
    # книга со сканом
    pg.evaluate("location.hash='#book-lansdell1883'"); pg.wait_for_timeout(2500)
    pg.evaluate("document.getElementById('scanBtn')?.click()"); pg.wait_for_timeout(1500)
    pg.evaluate("document.getElementById('onlySib')?.click()"); pg.wait_for_timeout(800)
    pg.evaluate("location.hash='#peoples'"); pg.wait_for_timeout(1500)
    for b2 in pg.evaluate("[...document.querySelectorAll('button')].map((x,i)=>i)")[:12]:
        pg.evaluate(f"document.querySelectorAll('button')[{b2}]?.click()"); pg.wait_for_timeout(250)
    pg.evaluate("location.hash='#home'"); pg.wait_for_timeout(2000)
    pg.evaluate("document.querySelector('.pl-nav button')?.click()"); pg.wait_for_timeout(500)
    miss = sorted(pg.evaluate('[...I18N.miss]'))
    pg.screenshot(path='/home/claude/i18n/home_en.png')
    b.close()
srv.terminate()
json.dump(miss, open('/home/claude/i18n/miss2.json', 'w'), ensure_ascii=False, indent=0)
print(len(miss), 'errors:', errs[:10])
