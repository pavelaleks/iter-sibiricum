import json, sys, subprocess, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path('/home/claude/gh-repo')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8765'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
groups = [g['id'] for g in json.load(open(ROOT / 'data/groups.json'))]
works = [w['id'] for w in json.load(open(ROOT / 'data/works.json'))]
full = '--full' in sys.argv
routes = ['home', 'atlas', 'peoples', 'library', 'illustrations', 'links', 'analytics', 'publications', 'method'] + ['people-' + g.replace('_', '-') for g in groups] \
    + ['book-' + w.replace('_', '-') for w in (works if full else works[:6])]
miss = set(); per = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1400, 'height': 1000})
    pg.on('pageerror', lambda e: print('JS ERROR', e))
    pg.goto('http://localhost:8765/index.html?lang=en#home'); pg.wait_for_timeout(2500)
    for r in routes:
        pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1800 if not r.startswith('book-') else 1200)
        if r == 'illustrations':
            pg.evaluate("document.querySelector('.ill a[data-i]')?.click()"); pg.wait_for_timeout(800)
            pg.evaluate("document.getElementById('dlg')?.close()")
        if r == 'atlas':
            pg.evaluate("const s=document.getElementById('fWork'); if(s){s.value=s.options[5].value; s.dispatchEvent(new Event('change'))}"); pg.wait_for_timeout(1200)
        if r == 'analytics':
            for sec in pg.evaluate("[...document.querySelectorAll('a[href^=\"#analytics-\"]')].map(a=>a.getAttribute('href'))")[:20]:
                pg.evaluate(f"location.hash='{sec}'"); pg.wait_for_timeout(900)
        m = set(pg.evaluate('[...I18N.miss]')); per[r] = len(m - miss); miss |= m
    b.close()
srv.terminate()
json.dump(sorted(miss), open('/home/claude/i18n/miss.json', 'w'), ensure_ascii=False, indent=0)
print(len(miss), {k: v for k, v in per.items() if v})
