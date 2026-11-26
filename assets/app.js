/* Iter Sibiricum — одностраничный статический сайт (GitHub Pages). Маршрутизация по #имени. */
{
const V = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const yr = (n) => n == null || isNaN(n) ? '—' : String(Math.round(n));
const inBox = (s) => s[2] >= 40 && s[2] <= 195 && s[3] >= 34 && s[3] <= 79;
const fmt = (n, d = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('ru-RU', {maximumFractionDigits: d, minimumFractionDigits: d});
const pl = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return fmt(n) + ' ' + (a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b > 1 && b < 5 ? f[1] : f[2]); };
const C = {};
const get = (n) => (C[n] ||= fetch('data/' + n, {cache: 'no-cache'}).then((r) => { if (!r.ok) throw new Error(n); return r.json(); }));
// Решения проверки маршрутов (админка) накладываются на маршруты конвейера: проверенное по тексту и подтверждённое экспертом рисуется линией.
const getRoutes = () => (C['routes+review'] ||= Promise.all([get('routes.json'), fetch('data/review/journeys_review.json', {cache: 'no-cache'}).then((r) => r.ok ? r.json() : {}).catch(() => ({}))]).then(([R, REV]) => {
  const out = R.filter((r) => !REV[r.work]);
  for (const [w, v] of Object.entries(REV)) {
    if (v.status === 'no_journey') continue;
    // Остановки без координат остаются: на карте они разрывают линию, чтобы не рисовать прямой отрезок через неизвестное.
    const stops = (v.stops || []).map((s) => [s.place, s.name, s.lon == null ? null : +s.lon, s.lat == null ? null : +s.lat, s.pid ? w + '_p' + s.pid : null, 'text', s.journey || 1, s.quote || '', s.coord_source || '']);
    if (stops.filter((x) => x[2] != null).length > 1) out.push({work: w, method: v.status === 'draft' ? 'draft' : 'manual', status: v.status, reviewer: v.reviewer, date: v.date, summary: v.summary, stops});
  }
  return out;
}));
// Правки иллюстраций из рабочего места (подпись, перевод, тип, поворот, отбор) накладываются на результат конвейера.
const getIll = () => (C['ill+review'] ||= Promise.all([get('illustrations.json'), fetch('data/review/illustrations_review.json', {cache: 'no-cache'}).then((r) => r.ok ? r.json() : {}).catch(() => ({}))]).then(([D, REV]) => {
  const items = D.items.filter((x) => !(REV[x.id] && REV[x.id].status === 'rejected')).map((x) => { const v = REV[x.id]; return v ? {...x, c: v.caption ?? x.c, ru: v.ru || x.ru || '', k: v.kind || x.k, rx: v.rot || 0, ok: v.status === 'checked'} : x; });
  const ids = new Set(items.map((x) => x.id));
  const hero = [...new Set([...D.hero.filter((id) => !(REV[id] && REV[id].hero === false)), ...Object.keys(REV).filter((id) => REV[id].hero)])].filter((id) => ids.has(id));
  return {...D, items, hero};
}));
// Изображение с учётом поворота, заданного при проверке (обрезка на диске пересоздаётся при следующей сборке).
const illImg = (x, lazy = true) => {
  const alt = esc(x.c || 'Иллюстрация без подписи'), L = lazy ? ' loading="lazy"' : '';
  if (!x.rx) return `<img src="${esc(x.t)}" width="${x.tw}" height="${x.th}"${L} decoding="async" alt="${alt}">`;
  if (x.rx === 180) return `<img src="${esc(x.t)}" width="${x.tw}" height="${x.th}"${L} decoding="async" alt="${alt}" style="transform:rotate(180deg)">`;
  return `<span class="rot" style="aspect-ratio:${x.th}/${x.tw}"><img src="${esc(x.t)}"${L} decoding="async" alt="${alt}" style="width:${(x.tw / x.th * 100).toFixed(2)}%;transform:translate(-50%,-50%) rotate(${x.rx}deg)"></span>`;
};
const toH = (id) => String(id).replace(/_/g, '-'); const fromH = (h) => h.replace(/-/g, '_');
const NAT = {british: 'Великобритания', french: 'Франция/Бельгия', german: 'Германия/Австрия', scandinavian: 'Скандинавия', finnish: 'Финляндия', polish: 'Польша', italian: 'Италия', central_european: 'Центральная Европа', dutch: 'Нидерланды'};
const PER = {'P1 до 1855': 'до 1855', 'P2 1856–1880': '1856–1880', 'P3 1881–1904': '1881–1904', 'P4 1905–1917': '1905–1917', 'P5 1918–1930': '1918–1930'};
const CAT = {indigenous: 'коренные народы', settler: 'русские и пришлые', social: 'социальные группы', neighbour: 'соседи', foreign: 'иностранцы', generic: 'обобщённые «туземцы»'};
const CATC = {indigenous: '#3f7296', settler: '#a3173a', social: '#9a6b1f', neighbour: '#6a5a9e', foreign: '#6b7785', generic: '#3c7a5a', work: '#a3173a', authority: '#8e9aa6'};
let mapRO = null;

function setMenu(r) { document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('on', r.startsWith(a.dataset.r) || (a.dataset.r === 'peoples' && r.startsWith('people')) || (a.dataset.r === 'library' && r.startsWith('book')))); }
async function route() {
  const h = (location.hash || '#home').slice(1) || 'home';
  setMenu(h.startsWith('analytics') ? 'analytics' : h.split('?')[0]); if (mapRO) { mapRO.disconnect(); mapRO = null; }
  V.innerHTML = '<div class="wrap loading">Загрузка…</div>';
  try {
    if (h === 'home') await home();
    else if (h === 'atlas' || h.startsWith('atlas?')) await atlas();
    else if (h === 'peoples') await peoples();
    else if (h.startsWith('people-')) await people(fromH(h.slice(7)));
    else if (h === 'library') await library();
    else if (h.startsWith('book-')) { const m = h.slice(5).match(/^(.*?)(?:-p(\d+))?$/); await book(fromH(m[1]), m[2]); }
    else if (h === 'illustrations' || h.startsWith('illustrations?')) await illustrations();
    else if (h === 'links') await links();
    else if (h.startsWith('analytics')) await analytics();
    else if (h === 'publications') await publications();
    else if (h === 'method') await method();
    else await home();
    const tk = Object.keys(TITLES).find((k) => h === k || h.startsWith(k + '-')); document.title = tk ? TITLES[tk] + ' — Iter Sibiricum' : 'Iter Sibiricum — европейские травелоги о Сибири, 1800–1930';
    if (!/^book-.*-p\d+$/.test(h) && !h.startsWith('analytics-')) window.scrollTo(0, 0);
  } catch (e) { V.innerHTML = `<div class="wrap band"><h2>Не удалось загрузить данные</h2><p class="mute">${esc(e.message)}. Сайт читает файлы из папки data/; откройте его через веб-сервер (GitHub Pages или python -m http.server).</p></div>`; }
}
window.addEventListener('hashchange', route);
const TITLES = {atlas: 'Атлас', peoples: 'Народы', people: 'Народы', library: 'Библиотека', book: 'Библиотека', illustrations: 'Иллюстрации', links: 'Связи', analytics: 'Аналитика', publications: 'Публикации', method: 'Метод и данные'};

function mapIn(el, opts) {
  const draw = () => SibMap.draw(el, opts());
  draw(); let last = el.clientWidth;
  mapRO = new ResizeObserver(() => { if (Math.abs(el.clientWidth - last) > 30) { last = el.clientWidth; draw(); } }); mapRO.observe(el);
  return draw;
}
function spark(series, w = 220, h = 34) {
  if (!series || !series.length) return '';
  const mx = Math.max(...series.map((s) => s[2]), 1), bw = w / series.length;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${series.map((s, i) => `<rect x="${i * bw + 1}" y="${h - (s[2] / mx) * (h - 2)}" width="${Math.max(1, bw - 2)}" height="${(s[2] / mx) * (h - 2)}" fill="var(--acc2)" opacity=".75"/>`).join('')}</svg>`;
}
function bars(rows, opt = {}) {
  const mx = Math.max(...rows.map((r) => r[1]), 1e-9);
  return `<div class="bars">${rows.map((r) => `<div class="bar"><div>${r[2] ? `<a href="${r[2]}">${esc(r[0])}</a>` : esc(r[0])}</div><div class="tr"><div class="fl" style="width:${(100 * r[1] / mx).toFixed(1)}%;${opt.color ? 'background:' + opt.color : ''}"></div></div><div class="v">${fmt(r[1], opt.d ?? 0)}${opt.unit || ''}</div></div>`).join('')}</div>`;
}

// ---------------- главная ----------------
const REPO = 'https://github.com/pavelaleks/iter-sibiricum';
async function project() { try { return await get('project.json'); } catch (e) { return {}; } }
function citation(P, extra = '') {
  const d = new Date(), dd = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  const team = (P.team || []).length ? ' / ' + P.team.map((t) => typeof t === 'string' ? t : t.name.replace(/^(\S+) (.+)$/, '$2 $1')).join(', ') : '';
  const grant = P.grant ? `. Грант РНФ № ${P.grant}` : '';
  const url = P.url || location.href.split('#')[0];
  return `Iter Sibiricum: европейские травелоги о Сибири и её народах, 1800–1930 : цифровой ресурс${team}${grant}. Версия ${P.version || '1.0'}. ${P.year || d.getFullYear()}. URL: ${url}${extra} (дата обращения: ${dd}).`;
}
// Профили участника в наукометрических базах (ID хранятся в data/project.json, правятся в рабочем месте → «Проект»).
const profiles = (t) => {
  const L = [t.scholar && ['Google Scholar', 'https://scholar.google.com/citations?user=' + encodeURIComponent(t.scholar)],
    t.academia && ['Academia.edu', t.academia],
    t.scopus && ['Scopus', 'https://www.scopus.com/authid/detail.uri?authorId=' + encodeURIComponent(t.scopus), 'Scopus Author ID ' + t.scopus],
    t.wos && ['Web of Science', 'https://www.webofscience.com/wos/author/record/' + encodeURIComponent(t.wos), 'Web of Science ResearcherID ' + t.wos]].filter(Boolean);
  return L.length ? `<span class="prof">${L.map(([n, u, title]) => `<a href="${esc(u)}"${title ? ` title="${esc(title)}"` : ''}>${n}</a>`).join('')}</span>` : '';
};
async function home() {
  const [A, works, routes, places, geo, groups, reuse, P] = await Promise.all([get('analytics.json'), get('works.json'), getRoutes(), get('places.json'), get('geo.json'), get('groups.json'), get('reuse.json'), project()]);
  const S = A.summary;
  const mod = A.models.find((m) => m.term === 'personal' && m.model.startsWith('pos'));
  const langs = new Set(works.map((w) => w.lang)).size;
  const manual = routes.filter((r) => r.method === 'manual').length;
  const ind = groups.filter((g) => g.category === 'indigenous');
  const top = ['khanty', 'sakha', 'buryat', 'evenki_even', 'chukchi', 'kazakh_kirghiz'].map((id) => groups.find((g) => g.id === id)).filter(Boolean);
  V.innerHTML = `
  <section class="wrap intro">
    ${P.grant ? `<p class="ack">Ресурс подготовлен при поддержке гранта Российского научного фонда № ${esc(P.grant)}, <a href="${esc(P.grant_url)}">${esc(P.grant_url)}</a>, и Правительства Республики Алтай.</p>` : ''}
    <div class="intro-grid"><div class="intro-text">
    <h1 class="name">Iter Sibiricum</h1>
    <p class="purpose">Цифровой ресурс о том, как европейские путешественники 1800–1930 годов описывали народы Сибири и отношения между ними: ${pl(works.length, ['книга', 'книги', 'книг'])} на ${langs} языках с полными текстами, маршруты на карте, карточки народов и проверяемые данные для исследований.</p>
    <div class="finder">
      <label for="q" class="sr">Поиск по ресурсу</label>
      <input id="q" type="search" placeholder="Автор, книга, народ или место — например, Lansdell, буряты, Иркутск" autocomplete="off">
      <ul id="qres" class="qres" hidden></ul>
    </div>
    <dl class="facts">
      <div><dt>книг</dt><dd>${fmt(S.works)}</dd></div>
      <div><dt>языков</dt><dd>${langs}</dd></div>
      <div><dt>слов о Сибири</dt><dd>${fmt(S.words_siberia / 1e6, 1)} млн</dd></div>
      <div><dt>упоминаний народов</dt><dd>${fmt(S.mentions_siberia)}</dd></div>
      <div><dt>групп и народов</dt><dd>${groups.length}</dd></div>
    </dl>
    </div>
    <figure class="plates" id="plates" hidden></figure></div>
  </section>
  <section class="wrap">
    <div class="doors">
      <div class="door"><a class="dt" href="#library">Читать источники</a><span class="dd">Полные тексты ${pl(works.length, ['книги', 'книг', 'книг'])} с подсветкой названий народов, поиском и постоянной ссылкой на каждый абзац.</span><span class="dn">Библиотека</span></div>
      <div class="door"><a class="dt" href="#atlas">Проследить маршруты</a><span class="dd">Пути путешественников по эпохам, места, о которых они писали, и ареалы народов.</span><span class="dn">Атлас</span></div>
      <div class="door"><a class="dt" href="#peoples">Узнать, как описывали народ</a><span class="dd">Кто и когда писал о народе, какими словами, в каких сюжетах; цитаты из источников.</span><span class="chips">${top.map((g) => `<a class="chip" href="#people-${toH(g.id)}">${esc(g.name.split(' (')[0].split(' /')[0])}</a>`).join('')}</span><span class="dn">Народы</span></div>
      <div class="door"><a class="dt" href="#analytics">Изучить закономерности</a><span class="dd">Оценки и рамки описания, частоты по десятилетиям, дискурсы, сети совместных упоминаний и заимствований.</span><span class="dn">Аналитика и связи</span></div>
    </div>
  </section>
  <section class="band"><div class="wrap">
    <div class="sechead"><h2>Маршруты путешественников</h2><a href="#atlas">Открыть атлас</a></div>
    <div class="mapbox heromap" id="homeMap"></div>
    <div class="mapnote"><span><i></i>${pl(manual, ['маршрут восстановлен', 'маршрута восстановлены', 'маршрутов восстановлено'])} по тексту книг, у каждой остановки — абзац-доказательство; цвет — эпоха поездки</span><span><i class="a"></i>ареалы коренных народов около 1900 года, схематично</span></div>
  </div></section>
  <section class="band alt"><div class="wrap">
    <h2>Что показывает корпус</h2>
    <div class="findings">
      <div><div class="k">×${fmt(mod.OR, 1)}</div><h3>Оценка зависит от встречи</h3><p>Автор, писавший по личному наблюдению, в ${fmt(mod.OR, 1)} раза чаще оценивает народ положительно (95% ДИ ${fmt(mod.lo, 1)}–${fmt(mod.hi, 1)}).</p><a href="#analytics">Модели и рамки описания</a></div>
      <div><div class="k">0,4 → 2,9%</div><h3>Мотив вымирания нарастает</h3><p>Такова его доля в абзацах о коренных народах до 1855 года и в 1905–1917 годах. В те же десятилетия внимание к каторге сменяется вниманием к переселенцам.</p><a href="#analytics-ngram">Ngram и дискурсы</a></div>
      <div><div class="k">${fmt(reuse.length)}</div><h3>Тексты переписывают друг друга</h3><p>Столько пар абзацев с общими фрагментами нашлось в корпусе: компиляции, самоповторы, заимствования без ссылки.</p><a href="#links">Сеть цитирований</a></div>
    </div>
  </div></section>
  <section class="band"><div class="wrap about">
    <div>
      <h2>О проекте</h2>
      <p>Ресурс создан по итогам исследования восприятия межнациональных отношений в Сибири в европейских травелогах XIX — начала XX века. Корпус сформирован по библиографическим справочникам и фондам электронных библиотек, размечен экспертами и обработан методами корпусной лингвистики; как именно — в разделе <a href="#method">«Метод и данные»</a>.</p>
      <p class="small mute"><i>Iter Sibiricum</i> — «сибирский путь»: латинским словом <i>iter</i> учёные XVIII века называли и путешествие, и его отчёт (<i>Iter Lapponicum</i> Линнея, 1732).</p>
    </div>
  </div>
  <div class="wrap">${(P.team || []).length ? `<div class="crew"><h3>Коллектив</h3><ul>${P.team.map((t) => `<li><span class="nm">${esc(t.name)}</span>${t.role && t.role !== 'исполнитель' ? `<span class="rl">${esc(t.role)}</span>` : ''}<span class="af">${esc(t.degree)}<br>${esc(t.org)}</span>${t.orcid ? `<a class="oid" href="https://orcid.org/${esc(t.orcid)}" aria-label="ORCID ${esc(t.name)}"><span class="orcid">iD</span>${esc(t.orcid)}</a>` : ''}${profiles(t)}</li>`).join('')}</ul></div>` : ''}
  </div></section>
  <section class="band"><div class="wrap research">
    <div>
      <h2>Как цитировать</h2>
      <div class="cite" id="citeBox">${esc(citation(P))}</div>
      <p class="small mute">У каждого абзаца в библиотеке постоянный номер: ссылка вида <code>#book-lansdell1883-p00502</code> откроет именно его.</p>
      <button id="copyCite">Скопировать ссылку</button>
    </div>
    <div>
      <h2>Данные и код</h2>
      <dl>
        ${(P.datasets || []).map((d, i) => `<dt>${i ? '' : 'Zenodo'}</dt><dd><a href="https://doi.org/${esc(d.doi)}">${esc(d.title)}</a><br><span class="small mute">DOI ${esc(d.doi)}, ${esc(d.license)}</span></dd>`).join('')}
        <dt>Тексты</dt><dd><a href="${REPO}/tree/main/texts">${fmt(works.length)} файлов JSON</a> с абзацами и разметкой</dd>
        <dt>Таблицы</dt><dd><a href="${REPO}/tree/main/pipeline/data">упоминания, места, маршруты, экспертная разметка</a> в CSV</dd>
        <dt>Конвейер</dt><dd><a href="${REPO}/tree/main/pipeline/analysis">скрипты на Python</a> от очистки OCR до сайта</dd>
        <dt>Проверки</dt><dd><a href="${REPO}/tree/main/pipeline/validation">выборки и протоколы</a> оценки качества</dd>
        <dt>Лицензии</dt><dd>каталог и разметка CC BY 4.0, атлас CC BY-NC 4.0, код MIT</dd>
      </dl>
    </div>
  </div></section>`;
  const IDX = [...works.map((w) => ({t: w.author + ' — ' + w.label, k: (w.author + ' ' + w.label + ' ' + (w.nat_ru || '')).toLowerCase(), h: '#book-' + toH(w.id), c: 'книга'})),
    ...groups.map((g) => ({t: g.name, k: (g.name + ' ' + g.name_en + ' ' + (g.forms || []).map((f) => f[0] || f).join(' ')).toLowerCase(), h: '#people-' + toH(g.id), c: 'народ'})),
    ...places.map((p) => ({t: p.name, k: p.name.toLowerCase(), h: '#atlas', c: 'место'}))];
  const qi = document.getElementById('q'), qr = document.getElementById('qres');
  qi.addEventListener('input', () => { const v = qi.value.trim().toLowerCase(); if (v.length < 2) { qr.hidden = true; return; }
    const R = IDX.filter((x) => x.k.includes(v)).slice(0, 8);
    qr.innerHTML = R.length ? R.map((x) => `<li><a href="${x.h}"><span>${esc(x.t)}</span><span class="mute small">${x.c}</span></a></li>`).join('') : '<li class="mute small" style="padding:10px 14px">Ничего не найдено. Полнотекстовый поиск по книгам — в библиотеке.</li>'; qr.hidden = false; });
  qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = qr.querySelector('a'); if (a) location.hash = a.getAttribute('href'); } });
  document.getElementById('copyCite').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(document.getElementById('citeBox').textContent); e.target.textContent = 'Ссылка скопирована'; } catch (err) { e.target.textContent = 'Выделите текст и скопируйте вручную'; } });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  heroPlates(works, reduce);
  let first = !reduce;
  mapIn(document.getElementById('homeMap'), () => { const o = {geo, routes, places, works, areas: ind, showPlaces: false, labels: false, zoom: false, showAuto: false, animate: first, routeWidth: 2, onWork: (w) => location.hash = 'book-' + toH(w), onGroup: (g) => location.hash = 'people-' + toH(g)}; first = false; return o; });
}

// ---------------- иллюстрации ----------------
const KIND = {people: 'Люди', portrait: 'Портреты', view: 'Виды', map: 'Карты', nature: 'Природа', object: 'Предметы', other: 'Прочее'};
const iaPage = (x) => `https://archive.org/details/${encodeURIComponent(x.ia)}/page/n${x.n}/mode/1up`;
const illBy = (w, W) => W[w] ? `${W[w].author}, ${W[w].year}` : w;

// Главная: сменяющиеся иллюстрации из книг корпуса справа от названия.
async function heroPlates(works, reduce) {
  const box = document.getElementById('plates'); if (!box) return;
  let D; try { D = await getIll(); } catch (e) { return; }
  const by = Object.fromEntries(D.items.map((x) => [x.id, x])), W = Object.fromEntries(works.map((w) => [w.id, w]));
  const L = (D.hero || []).map((id) => by[id]).filter(Boolean); if (!L.length) return;
  let i = Math.floor(Math.random() * L.length), timer = null;
  box.hidden = false;
  box.innerHTML = `<a class="pl-frame" id="plA" href="#illustrations" aria-live="polite"></a>
    <figcaption><a id="plCap" href="#illustrations"></a><span id="plBy" class="mute"></span></figcaption>
    <div class="pl-nav"><button type="button" data-d="-1" aria-label="Предыдущая иллюстрация">←</button><button type="button" data-d="1" aria-label="Следующая иллюстрация">→</button><a href="#illustrations">Все ${fmt(D.items.length)} иллюстраций</a></div>`;
  const fr = box.querySelector('#plA'), cap = box.querySelector('#plCap'), byl = box.querySelector('#plBy');
  const show = (k) => {
    i = (k + L.length) % L.length; const x = L[i], h = '#illustrations?i=' + encodeURIComponent(x.id);
    const im = new Image(); im.alt = x.c || 'Иллюстрация из книги ' + illBy(x.w, W); im.width = x.tw; im.height = x.th; im.decoding = 'async';
    if (x.rx) im.style.transform = `rotate(${x.rx}deg)`;
    im.onload = () => { fr.appendChild(im); requestAnimationFrame(() => im.classList.add('on')); [...fr.querySelectorAll('img')].slice(0, -1).forEach((o) => { o.classList.remove('on'); setTimeout(() => o.remove(), 1400); }); };
    im.src = x.t; fr.href = h; cap.href = h; cap.textContent = x.c || 'Без подписи'; byl.textContent = (x.ru ? x.ru + ' · ' : '') + illBy(x.w, W);
  };
  const play = () => { if (reduce) return; clearInterval(timer); timer = setInterval(() => { if (!document.body.contains(box)) return clearInterval(timer); if (!document.hidden) show(i + 1); }, 7000); };
  box.querySelectorAll('.pl-nav button').forEach((b) => b.addEventListener('click', () => { show(i + +b.dataset.d); play(); }));
  box.addEventListener('mouseenter', () => clearInterval(timer)); box.addEventListener('mouseleave', play);
  box.addEventListener('focusin', () => clearInterval(timer));
  show(i); play();
}

async function illustrations() {
  const [D, works, groups] = await Promise.all([getIll(), get('works.json'), get('groups.json')]);
  const W = Object.fromEntries(works.map((w) => [w.id, w])), G = Object.fromEntries(groups.map((g) => [g.id, g]));
  // сначала изображения с подписью (по году издания), затем без подписи
  const I = [...D.items].sort((a, b) => (!a.c) - (!b.c)), nb = new Set(I.map((x) => x.w)).size;
  const st = {k: '', w: '', g: '', per: '', rg: '', q: ''}; let lim = 96, cur = [];
  const RG = {sib: 'Сибирь и Дальний Восток', eur: 'Урал и Европейская Россия', casia: 'Средняя Азия и Туркестан', china: 'Монголия, Маньчжурия, Китай', other: 'Другие страны', '?': 'не определён'};
  const rgOf = (x) => x.rg || '?';
  const cnt = (f) => I.filter(f).length;
  const books = [...new Set(I.map((x) => x.w))].sort((a, b) => (W[a]?.year || 0) - (W[b]?.year || 0));
  const gids = [...new Set(I.flatMap((x) => x.g))].filter((g) => G[g]).sort((a, b) => G[a].name.localeCompare(G[b].name, 'ru'));
  const pers = [...new Set(books.map((w) => W[w]?.period).filter(Boolean))].sort();
  V.innerHTML = `<section class="band"><div class="wrap ill-head">
    <h1>Иллюстрации</h1>
    <p class="lede">${pl(I.length, ['изображение', 'изображения', 'изображений'])} из ${pl(nb, ['книги', 'книг', 'книг'])} корпуса: гравюры, фотографии и карты, которыми путешественники сопровождали свои описания Сибири.</p>
    <p class="small mute ill-note">Изображения найдены по сканам Internet Archive: программа отбирает страницы с графикой, вырезает её и поворачивает альбомные вклейки. Подписи — распознанный текст оригинала, в нём возможны ошибки; тип, народы и места определены по подписи; регион там, где в подписи нет места, — по абзацу рядом, предварительно. Каждое изображение ведёт на страницу скана и на абзац рядом с ним в библиотеке. Метод — в разделе <a href="#method">«Метод и данные»</a>.</p>
    <div class="ill-filters" role="group" aria-label="Фильтры">
      <div class="seg" id="fK"><button type="button" data-k="" class="on">Все <span>${fmt(I.length)}</span></button>${Object.entries(KIND).filter(([k]) => cnt((x) => x.k === k)).map(([k, t]) => `<button type="button" data-k="${k}">${t} <span>${fmt(cnt((x) => x.k === k))}</span></button>`).join('')}</div>
      <label>Книга<select id="fW"><option value="">все книги</option>${books.map((w) => `<option value="${esc(w)}">${esc(W[w] ? W[w].author + ', ' + W[w].year : w)} (${cnt((x) => x.w === w)})</option>`).join('')}</select></label>
      <label>Народ<select id="fG"><option value="">все</option>${gids.map((g) => `<option value="${esc(g)}">${esc(G[g].name)} (${cnt((x) => x.g.includes(g))})</option>`).join('')}</select></label>
      <label>Регион<select id="fR"><option value="">все</option>${Object.entries(RG).filter(([r]) => cnt((x) => rgOf(x) === r)).map(([r, t]) => `<option value="${r}">${t} (${fmt(cnt((x) => rgOf(x) === r))})</option>`).join('')}</select></label>
      <label>Период<select id="fP"><option value="">все</option>${pers.map((p) => `<option value="${esc(p)}">${esc(PER[p] || p)}</option>`).join('')}</select></label>
      <label class="q">Подпись<input id="fQ" type="search" placeholder="Например, Yakut, tent, Irkutsk"></label>
    </div>
    <p class="small mute" id="fN" aria-live="polite"></p>
  </div></section>
  <section><div class="wrap"><div class="ill-grid" id="grid"></div><p class="more"><button type="button" id="more" hidden>Показать ещё</button></p></div></section>
  <dialog class="ill-dlg" id="dlg" aria-label="Иллюстрация"></dialog>`;
  const grid = document.getElementById('grid'), more = document.getElementById('more'), dlg = document.getElementById('dlg');
  const card = (x) => `<figure class="ill"><a href="#illustrations?i=${encodeURIComponent(x.id)}" data-i="${esc(x.id)}">${illImg(x)}</a><figcaption><span class="c">${x.c ? esc(x.c) : '<span class="mute">без подписи</span>'}</span>${x.ru ? `<span class="ru">${esc(x.ru)}</span>` : ''}<span class="s">${esc(illBy(x.w, W))}</span></figcaption></figure>`;
  const draw = () => {
    const q = st.q.toLowerCase();
    cur = I.filter((x) => (!st.k || x.k === st.k) && (!st.w || x.w === st.w) && (!st.g || x.g.includes(st.g)) && (!st.per || W[x.w]?.period === st.per) && (!st.rg || rgOf(x) === st.rg) && (!q || ((x.c || '') + ' ' + (x.ru || '')).toLowerCase().includes(q)));
    grid.innerHTML = cur.slice(0, lim).map(card).join('') || '<p class="mute">Под эти условия иллюстраций нет. Сбросьте один из фильтров.</p>';
    more.hidden = cur.length <= lim;
    document.getElementById('fN').textContent = cur.length === I.length ? '' : `Показано: ${pl(cur.length, ['изображение', 'изображения', 'изображений'])}`;
  };
  document.querySelectorAll('#fK button').forEach((b) => b.addEventListener('click', () => { st.k = b.dataset.k; document.querySelectorAll('#fK button').forEach((o) => o.classList.toggle('on', o === b)); lim = 96; draw(); }));
  [['fW', 'w'], ['fG', 'g'], ['fP', 'per'], ['fR', 'rg']].forEach(([id, k]) => document.getElementById(id).addEventListener('change', (e) => { st[k] = e.target.value; lim = 96; draw(); }));
  let qt; document.getElementById('fQ').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); lim = 96; draw(); }, 200); });
  more.addEventListener('click', () => { lim += 96; draw(); });
  const open = (id) => {
    const k = cur.findIndex((x) => x.id === id), x = k >= 0 ? cur[k] : I.find((y) => y.id === id); if (!x) return;
    const w = W[x.w];
    dlg.innerHTML = `<div class="dlg-in">
      <div class="dlg-img">${illImg(x, false)}</div>
      <div class="dlg-meta">
        <p class="dlg-cap">${x.c ? esc(x.c) : '<span class="mute">Подпись не распознана</span>'}</p>${x.ru ? `<p class="dlg-ru">${esc(x.ru)}</p>` : ''}
        <dl>
          <dt>Книга</dt><dd><a href="#book-${toH(x.w)}">${esc(w ? w.author : x.w)}</a>${w ? `, ${w.year}` : ''}</dd>
          <dt>Тип</dt><dd>${KIND[x.k] || x.k}${x.r || x.rx ? ', альбомная вклейка (повёрнута)' : ''}</dd>
          <dt>Проверка</dt><dd>${x.ok ? 'подпись и тип проверены экспертом' : 'автоматически, не проверено'}</dd>
          ${x.g.length ? `<dt>Народы</dt><dd>${x.g.filter((g) => G[g]).map((g) => `<a href="#people-${toH(g)}">${esc(G[g].name)}</a>`).join(', ')}</dd>` : ''}
          <dt>Регион</dt><dd>${RG[rgOf(x)]}${x.rb === 'cap' ? ` — по подписи${x.pl.length ? ': ' + esc(x.pl.join(', ')) : ''}` : x.rb === 'par' ? ' — по тексту рядом (предварительно)' : ''}</dd>
          ${x.f ? `<dt>В книге</dt><dd>к странице ${esc(x.f)}</dd>` : ''}
        </dl>
        <p class="dlg-links">${x.p ? `<a href="#book-${toH(x.w)}-p${esc(x.p)}">Текст рядом с иллюстрацией</a>` : ''}<a href="${iaPage(x)}" target="_blank" rel="noopener">Страница скана в Internet Archive</a></p>
        <p class="small mute">Изображение из книги, перешедшей в общественное достояние; скан — Internet Archive.</p>
      </div>
      <div class="dlg-nav">${k >= 0 ? `<button type="button" data-d="-1" aria-label="Предыдущая" ${k ? '' : 'disabled'}>←</button><span class="small mute">${fmt(k + 1)} из ${fmt(cur.length)}</span><button type="button" data-d="1" aria-label="Следующая" ${k < cur.length - 1 ? '' : 'disabled'}>→</button>` : ''}<button type="button" class="x" aria-label="Закрыть">Закрыть</button></div>
    </div>`;
    dlg.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => open(cur[k + +b.dataset.d].id)));
    dlg.querySelector('.x').addEventListener('click', () => dlg.close());
    history.replaceState(null, '', '#illustrations?i=' + encodeURIComponent(x.id));
    if (!dlg.open) dlg.showModal();
  };
  dlg.addEventListener('close', () => history.replaceState(null, '', '#illustrations'));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const b = dlg.querySelector(`[data-d="${e.key === 'ArrowRight' ? 1 : -1}"]`); if (b && !b.disabled) b.click(); } });
  grid.addEventListener('click', (e) => { const a = e.target.closest('a[data-i]'); if (!a || e.metaKey || e.ctrlKey) return; e.preventDefault(); open(a.dataset.i); });
  draw();
  const m = location.hash.match(/[?&]i=([^&]+)/); if (m) open(decodeURIComponent(m[1]));
}

// ---------------- атлас ----------------
async function atlas() {
  const [works, routes, places, geo, groups, bookgeo] = await Promise.all([get('works.json'), getRoutes(), get('places.json'), get('geo.json'), get('groups.json'), get('bookgeo.json')]);
  const W = Object.fromEntries(works.map((w) => [w.id, w])), RT = Object.fromEntries(routes.map((r) => [r.work, r]));
  const ind = groups.filter((g) => g.category === 'indigenous');
  const nMan = routes.filter((r) => r.method === 'manual').length, nDraft = routes.filter((r) => r.method === 'draft').length;
  const st = {period: '', nat: '', stay: '', year: 1930, manual: true, places: true, areas: true, work: '', group: ''};
  const opt = (arr) => arr.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  const P = window.SibMap.PERC;
  V.innerHTML = `<section class="band"><div class="wrap">
    <h1>Атлас путешествий</h1>
    <p class="lede">Линией показаны маршруты, у каждой остановки которых есть абзац, где автор говорит, что был в этом месте. Сейчас их ${nMan}: ${routes.filter((r) => r.status === 'verified').length} подтверждены экспертами проекта, остальные проверены по тексту и ждут подтверждения. Цвет — эпоха поездки. Выберите книгу, чтобы увидеть её маршрут, остановки со ссылками на абзацы и все места, о которых она пишет.</p>
    <div class="ctl">
      <label>Книга <select id="fWork"><option value="">все</option>${opt(works.slice().sort((a, b) => a.year - b.year).map((w) => [w.id, w.label + (RT[w.id] ? (RT[w.id].method === 'manual' ? ' — маршрут' : ' — черновик') : '')]))}</select></label>
      <label>Эпоха <select id="fPer"><option value="">все</option>${opt(Object.entries(PER))}</select></label>
      <label>Страна автора <select id="fNat"><option value="">все</option>${opt([...new Set(works.map((w) => w.nat))].map((n) => [n, NAT[n] || n]))}</select></label>
      <label>Тип поездки <select id="fStay"><option value="">все</option>${opt([...new Set(works.map((w) => w.stay))].map((x) => [x, works.find((w) => w.stay === x).stay_ru]))}</select></label>
      <label>Народ <select id="fGr"><option value="">—</option>${opt(ind.map((g) => [g.id, g.name]))}</select></label>
    </div>
    <div class="ctl"><div class="yr"><label for="fYr">Поездки до</label><input type="range" id="fYr" min="1800" max="1930" step="1" value="1930"><output id="oYr">1930</output></div>
      <button id="tMan" class="on">маршруты</button><button id="tPl" class="on">места</button><button id="tAr" class="on">ареалы</button></div>
    <div class="mapbox big" id="atlasMap"></div>
    <div class="legend2">${Object.entries(PER).map(([k, v]) => `<span><i class="sw" style="background:${P[k]}"></i>${v}</span>`).join('')}<span><i class="dc"></i>остановка черновика</span><span><i class="bc"></i>место, упомянутое в книге</span></div>
    <div class="side" style="margin-top:26px"><div id="aInfo"><p class="mute">Нажмите на маршрут или выберите книгу.</p></div><div id="aPlace"><p class="mute">Нажмите на место или ареал.</p></div></div>
  </div></section>`;
  const el = document.getElementById('atlasMap');
  const filt = (w) => (!st.period || w.period === st.period) && (!st.nat || w.nat === st.nat) && (!st.stay || w.stay === st.stay) && (st.year >= 1930 || (w.j0 || w.year) <= st.year);
  const gr = () => ind.find((g) => g.id === st.group);
  const draw = mapIn(el, () => ({geo, routes, places, works, bookgeo, areas: st.areas ? ind : null, showAreas: st.areas, showManual: st.manual, showPlaces: st.places && !st.work, filter: filt,
    focusWork: st.work, focusGroup: st.group,
    placeValue: st.group ? ((p) => (p.groups.find((x) => x[0] === gr().name) || [0, 0])[1]) : null,
    onWork: (w) => { st.work = w; document.getElementById('fWork').value = w; draw(); info(); },
    onGroup: (g) => { st.group = g; document.getElementById('fGr').value = g; draw(); info(); },
    onPlace: (p) => placeInfo(p)}));
  const para = (w, pid) => pid ? ` <a href="#book-${toH(w)}-p${esc(pid.split('_p')[1])}">абзац ${esc(String(+pid.split('_p')[1]))}</a>` : '';
  function info() {
    const box = document.getElementById('aInfo'); let h = '';
    if (st.work) {
      const w = W[st.work], r = RT[st.work];
      const badge = !r ? '<span class="status">маршрут не определён</span>' : r.status === 'verified' ? '<span class="status rec">подтверждён экспертом</span>' : r.status === 'checked' ? '<span class="status rec">проверен по тексту</span>' : r.status === 'reconstructed' ? '<span class="status rec">восстановлен по тексту</span>' : '<span class="status draft">черновик, на проверке</span>';
      h += `<h3><a href="#book-${toH(w.id)}">${esc(w.label)}</a></h3><p class="small mute">${esc(w.author)} · ${esc(w.nat_ru)} · ${esc(w.stay_ru)} · поездка ${w.j0 ? yr(w.j0) : '?'}${w.j1 && w.j1 !== w.j0 ? '–' + yr(w.j1) : ''}</p><p>${badge}</p>`;
      if (r && r.summary) h += `<p class="small">${esc(r.summary)}</p>`;
      if (r && r.method === 'manual') h += `<ol class="small">${r.stops.map((s) => `<li>${esc(s[1])}${(s[8] === 'estimate' || String(s[8]).endsWith('_ctx')) ? ' <span class="mute" title="Координаты приблизительные">≈</span>' : s[2] == null ? ' <span class="mute">· нет на карте: координаты не установлены</span>' : ''}${s[5] === 'not_found_in_text' ? ' <span class="mute">— в тексте не найдено</span>' : para(w.id, s[4])}</li>`).join('')}</ol>${r.stops.some((s) => s[8] === 'estimate' || String(s[8]).endsWith('_ctx')) ? '<p class="small mute">≈ — координаты места приблизительные: пункт не найден однозначно ни в GeoNames, ни в Wikidata.</p>' : ''}`;
      else if (r) h += `<p class="small">Черновик составлен программой: в него попали места, о которых автор пишет как о посещённых («мы прибыли в…», «we left…»). Порядок предварительный. Номера на карте совпадают с номерами в списке; пунктирный кружок — одно свидетельство в тексте.</p><ol class="small">${r.stops.map((s) => `<li>${esc(s[1])}${para(w.id, s[4])}${s[5] === 'higher' ? '' : ' <span class="mute">· одно свидетельство</span>'}</li>`).join('')}</ol>`;
      else h += `<p class="small">Программа не нашла в книге мест, о которых автор пишет как о посещённых: это может быть обзор, компиляция или текст с плохим распознаванием. На карте показана география книги — все упомянутые места.</p>`;
    }
    if (st.group) { const g = gr(); h += `<h3 style="margin-top:18px"><a href="#people-${toH(g.id)}">${esc(g.name)}</a></h3><p class="small mute">Круги показывают, где этот народ упомянут в одном абзаце с названием места.</p>`; }
    box.innerHTML = h || '<p class="mute">Нажмите на маршрут или выберите книгу.</p>';
  }
  function placeInfo(p) {
    document.getElementById('aPlace').innerHTML = `<h3>${esc(p.name)}</h3><p class="small mute">${p.mentions} упоминаний в ${p.works} книгах · координаты: ${esc(p.coord)}</p>
      <h3 style="font-size:16px">Чаще всего упоминают</h3>${bars(p.top_works.map(([w, n]) => [W[w] ? W[w].label : w, n, '#book-' + toH(w)]))}
      ${p.groups.length ? `<h3 style="font-size:16px;margin-top:14px">Народы в тех же абзацах</h3>${bars(p.groups)}` : ''}`;
  }
  const bind = (id, k) => document.getElementById(id).addEventListener('change', (e) => { st[k] = e.target.value; draw(); info(); });
  bind('fPer', 'period'); bind('fNat', 'nat'); bind('fStay', 'stay'); bind('fWork', 'work'); bind('fGr', 'group');
  const yrI = document.getElementById('fYr'); yrI.addEventListener('input', () => { st.year = +yrI.value; document.getElementById('oYr').textContent = yrI.value; draw(); });
  [['tMan', 'manual'], ['tPl', 'places'], ['tAr', 'areas']].forEach(([id, k]) => document.getElementById(id).addEventListener('click', (e) => { st[k] = !st[k]; e.target.classList.toggle('on', st[k]); draw(); }));
  const q = new URLSearchParams(location.hash.split('?')[1] || ''); if (q.get('work') && W[q.get('work')]) { st.work = q.get('work'); document.getElementById('fWork').value = st.work; draw(); info(); }
}

// ---------------- народы ----------------
async function peoples() {
  const groups = await get('groups.json');
  const sec = (cat) => groups.filter((g) => g.category === cat);
  const card = (g) => `<a class="card" href="#people-${toH(g.id)}"><div class="t">${esc(g.name)}</div><div class="s">${fmt(g.mentions)} упоминаний · ${g.works} книг</div>${spark(g.series)}</a>`;
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Народы и группы</h1>
    <p>Слово источника («Ostiak», «Tartar», «Kirghiz») хранится отдельно от современного названия народа; у сопоставления есть степень уверенности. Столбики на карточке — частота упоминаний по десятилетиям поездок на миллион слов о Сибири.</p>
    ${['indigenous', 'generic', 'settler', 'social', 'neighbour', 'foreign'].filter((c) => sec(c).length).map((c) => `<h2 style="margin-top:28px">${CAT[c]}</h2><div class="cards">${sec(c).map(card).join('')}</div>`).join('')}
  </div></section>`;
}
async function people(id) {
  const [groups, works, places, geo] = await Promise.all([get('groups.json'), get('works.json'), get('places.json'), get('geo.json')]);
  const g = groups.find((x) => x.id === id); if (!g) return peoples();
  const W = Object.fromEntries(works.map((w) => [w.id, w]));
  const langs = ['en', 'fr', 'de'].filter((l) => (g.collocations[l] || []).length);
  V.innerHTML = `<section class="band"><div class="wrap">
    <p class="small"><a href="#peoples">← все народы</a></p>
    <h1>${esc(g.name)}</h1>
    <p class="mute">${esc(g.name_en)}${g.family ? ' · ' + esc(g.family) : ''} · ${CAT[g.category] || ''} · ${fmt(g.mentions)} упоминаний в Сибири, ${g.works} книг</p>
    ${g.note ? `<p class="small">${esc(g.note)}</p>` : ''}
    <div class="chips">${g.forms.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>
    <div class="side" style="margin-top:20px">
      <div><div class="mapbox" id="pMap"></div><p class="small mute">Пятно — схематичный ареал около 1900 г.; круги — места, рядом с которыми этот народ упоминается в тех же абзацах.</p></div>
      <div><h3>Упоминания во времени</h3><div class="chart" id="pSeries"></div><p class="small mute">На миллион слов о Сибири по десятилетию поездки; подпись — число упоминаний.</p></div>
    </div>
    <div class="cols" style="margin-top:20px">
      <div><h3>Кто описывал чаще всего</h3><p class="small mute">Упоминаний на 10 тыс. слов о Сибири в книге (книги, где о Сибири больше 5 тыс. слов).</p>${bars(g.authors.map(([w, n, p]) => [W[w] ? W[w].label : w, p, '#book-' + toH(w)]), {d: 1})}</div>
      <div><h3>Каким словами окружено название</h3>${langs.length ? `<div class="ctl">${langs.map((l, i) => `<button data-l="${l}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div><div id="pCol"></div><p class="small mute">Окно ±5 слов, мера logDice, только значимые (p &lt; 0,001); ссылка — абзац-пример.</p>` : '<p class="mute">Для значимых коллокаций слишком мало упоминаний.</p>'}</div>
      <div><h3>Дискурсы рядом с этим народом</h3>${g.discourses.length ? bars(g.discourses.filter((d) => d[1] > 0).map((d) => [d[0], d[1]]), {d: 1, unit: '%'}) + '<p class="small mute">Доля абзацев о народе, где встречается дискурс (точность поиска ≈0,75).</p>' : '<p class="mute">Мало данных.</p>'}</div>
    </div>
    ${g.quotes.length ? `<h2 style="margin-top:28px">Как о них писали: экспертная выборка</h2>${g.quotes.map((q) => `<div class="quote">${esc(q.text)}<div class="m">${esc(q.work)} · оценка: <span class="${q.pol === 'отрицательная' ? 'neg' : q.pol === 'положительная' ? 'pos' : ''}">${esc(q.pol)}</span>${q.stereotype ? ' · ' + esc(q.stereotype) : ''} · <a href="#book-${toH(q.pid.split('_p')[0])}-p${esc(q.pid.split('_p')[1])}">абзац</a></div></div>`).join('')}` : ''}
  </div></section>`;
  const val = (p) => (p.groups.find((x) => x[0] === g.name) || [0, 0])[1];
  const ext = g.areas.length ? {type: 'MultiPoint', coordinates: g.areas.flatMap((a) => [[a[0] - a[2] - 8, a[1] - a[3] - 5], [a[0] + a[2] + 8, a[1] + a[3] + 5]])} : null;
  mapIn(document.getElementById('pMap'), () => ({geo, places, areas: [g], focusGroup: g.id, placeValue: val, placeMax: 16, nLabels: 6, extent: ext, labels: true}));
  seriesChart(document.getElementById('pSeries'), g.series);
  const col = (l) => { const el = document.getElementById('pCol'); if (!el) return; const rows = g.collocations[l] || []; el.innerHTML = `<table><thead><tr><th>Слово</th><th class="n">раз</th><th class="n">logDice</th><th>пример</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td class="n">${r[1]}</td><td class="n">${fmt(r[2], 2)}</td><td><a href="#book-${toH(r[3].split('_p')[0])}-p${esc(r[3].split('_p')[1])}">${esc(r[3].split('_p')[0])}</a></td></tr>`).join('')}</tbody></table>`; };
  if (langs.length) { col(langs[0]); V.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => { V.querySelectorAll('[data-l]').forEach((x) => x.classList.toggle('on', x === b)); col(b.dataset.l); })); }
}
function seriesChart(el, s) {
  const draw = () => {
    const w = el.clientWidth || 500, h = 240, m = {l: 40, r: 8, t: 18, b: 26};
    const x = d3.scaleBand().domain(s.map((d) => d[0])).range([m.l, w - m.r]).padding(.18);
    const y = d3.scaleLinear().domain([0, d3.max(s, (d) => d[2]) || 1]).nice().range([h - m.b, m.t]);
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" height="${h}" role="img" aria-label="Упоминания по десятилетиям">
      ${y.ticks(4).map((t) => `<line x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end" class="axis" font-size="12" fill="var(--mute)">${fmt(t)}</text>`).join('')}
      ${s.map((d) => `<rect x="${x(d[0])}" y="${y(d[2])}" width="${x.bandwidth()}" height="${y(0) - y(d[2])}" fill="var(--acc2)" rx="2"><title>${d[0]}-е: ${fmt(d[2], 1)} на млн слов (${d[1]} упоминаний)</title></rect>${w > 420 && d[1] ? `<text x="${x(d[0]) + x.bandwidth() / 2}" y="${y(d[2]) - 4}" text-anchor="middle" font-size="11" fill="var(--mute)">${d[1]}</text>` : ''}`).join('')}
      ${s.map((d, i) => (w > 420 || i % 2 === 0) ? `<text x="${x(d[0]) + x.bandwidth() / 2}" y="${h - 8}" text-anchor="middle" font-size="12" fill="var(--mute)">${w > 420 ? d[0] : String(d[0]).slice(2)}</text>` : '').join('')}</svg>`;
  };
  draw(); const ro = new ResizeObserver(draw); ro.observe(el);
}

// ---------------- библиотека и чтение ----------------
async function library() {
  const works = await get('works.json');
  const st = {q: '', lang: '', nat: '', per: '', sort: 'year'};
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Библиотека</h1>
    <p>${works.length} изданий. Тексты очищены от колонтитулов, номеров страниц и переносов; в читалке подсвечены названия народов, а абзацы о Сибири отмечены синей чертой.</p>
    <div class="ctl"><input type="search" id="lq" placeholder="Автор, название, роль…" aria-label="Поиск"><select id="ll" aria-label="Язык"><option value="">все языки</option>${[...new Set(works.map((w) => w.lang))].map((l) => `<option>${l}</option>`).join('')}</select>
    <select id="ln" aria-label="Страна"><option value="">все страны</option>${[...new Set(works.map((w) => w.nat))].map((n) => `<option value="${n}">${NAT[n] || n}</option>`).join('')}</select>
    <select id="lp" aria-label="Период"><option value="">все периоды</option>${Object.entries(PER).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <select id="ls" aria-label="Сортировка"><option value="year">по году издания</option><option value="per10k">по частоте этнонимов</option><option value="words_sib">по объёму о Сибири</option></select></div>
    <div class="scroll"><table class="stack"><thead><tr><th>Книга</th><th>Автор</th><th>Страна</th><th>Поездка</th><th>Тип</th><th>Язык</th><th class="n">слов о Сибири</th><th class="n">этнонимов на 10 тыс.</th></tr></thead><tbody id="lb"></tbody></table></div>
    <p class="small mute" id="lc"></p></div></section>`;
  const render = () => {
    const q = st.q.toLowerCase();
    const rows = works.filter((w) => (!q || [w.label, w.author, w.role, w.nationality].join(' ').toLowerCase().includes(q)) && (!st.lang || w.lang === st.lang) && (!st.nat || w.nat === st.nat) && (!st.per || w.period === st.per))
      .sort((a, b) => st.sort === 'year' ? a.year - b.year : (b[st.sort] || 0) - (a[st.sort] || 0));
    document.getElementById('lb').innerHTML = rows.map((w) => `<tr class="click" data-id="${esc(w.id)}"><td><a href="#book-${toH(w.id)}">${esc(w.label)}</a>${w.core ? '' : ' <span class="small mute">на проверку</span>'}</td><td>${esc(w.author)}</td><td>${esc(w.nat_ru)}</td><td>${w.j0 ? yr(w.j0) : '—'}</td><td>${esc(w.stay_ru)}</td><td>${esc(w.lang)}${w.translation ? ' (пер.)' : ''}</td><td class="n">${fmt(w.words_sib)}</td><td class="n">${fmt(w.per10k, 1)}</td></tr>`).join('');
    document.getElementById('lc').textContent = `Показано ${rows.length} из ${works.length}.`;
  };
  document.getElementById('lq').addEventListener('input', (e) => { st.q = e.target.value; render(); });
  [['ll', 'lang'], ['ln', 'nat'], ['lp', 'per'], ['ls', 'sort']].forEach(([i, k]) => document.getElementById(i).addEventListener('change', (e) => { st[k] = e.target.value; render(); }));
  document.getElementById('lb').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.target.tagName !== 'A') location.hash = 'book-' + toH(tr.dataset.id); });
  render();
}
async function book(id, par) {
  const [works, groups, routes] = await Promise.all([get('works.json'), get('groups.json'), getRoutes()]);
  const w = works.find((x) => x.id === id); if (!w) return library();
  const GN = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  const r0 = routes.find((x) => x.work === id); const r = r0 && {...r0, stops: r0.stops.filter(inBox)};
  V.innerHTML = `<section class="band"><div class="wrap"><p class="small"><a href="#library">← библиотека</a></p>
    <div class="reader"><aside>
      <h2 style="font-size:24px">${esc(w.label)}</h2>
      <p><b>${esc(w.author)}</b><br><span class="small mute">${esc(w.nationality || '')}${w.role ? ' · ' + esc(w.role) : ''}${w.gender === 'f' ? ' · женщина-автор' : ''}</span></p>
      <p class="small">Издание: ${yr(w.year)}${w.place ? ', ' + esc(w.place) : ''} · язык текста: ${esc(w.lang)}${w.translation ? ' (перевод с ' + esc(w.orig_lang) + ')' : ''}<br>Поездка: ${w.j0 ? yr(w.j0) : '?'}${w.j1 && w.j1 !== w.j0 ? '–' + yr(w.j1) : ''} · ${esc(w.stay_ru)}<br>Период: ${esc(w.period_ru)}</p>
      <p class="small">${fmt(w.words)} слов, из них о Сибири ${fmt(w.words_sib)}; ${fmt(w.mentions)} упоминаний народов (${fmt(w.per10k, 1)} на 10 тыс.)</p>
      <div class="chips">${w.top_groups.map((g) => `<span class="chip">${esc(g[0])} · ${g[1]}</span>`).join('')}</div>
      <p class="small">${w.sources.map((s) => `<a href="${esc(s)}" rel="noopener">${esc(s.replace('https://', ''))}</a>`).join('<br>')}</p>
      ${r ? `<p class="small"><a href="#atlas?work=${esc(id)}">${r.method === 'draft' ? 'черновик маршрута на карте' : 'маршрут на карте'}</a> · ${r.method === 'draft' ? 'черновик, на проверке' : 'восстановлен по тексту'}: ${r.stops.map((s) => esc(s[1])).join(r.method === 'draft' ? ', ' : ' → ')}</p>` : `<p class="small"><a href="#atlas?work=${esc(id)}">география книги на карте</a></p>`}
      <div class="ctl"><button id="onlySib">только о Сибири</button></div>
      <label class="small mute">Найти в тексте <input type="search" id="tq" aria-label="Поиск в тексте"></label>
      <p class="small mute" id="tqn"></p>
      <label class="small mute">Подсветить народ <select id="tg"><option value="">все</option>${[...new Set(w.top_groups.map((g) => g[0]))].map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
      ${w.note ? `<p class="small mute">${esc(w.note)}</p>` : ''}
    </aside><div class="text" id="txt"><p class="mute">Загрузка текста…</p></div></div></div></section>`;
  let T;
  try { T = await (C['t:' + id] ||= fetch('texts/' + id + '.json').then((x) => x.json())); } catch (e) { document.getElementById('txt').innerHTML = '<p class="mute">Текст не найден.</p>'; return; }
  let only = false, q = '', hg = '';
  const render = () => {
    const re = q.length > 2 ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null; let hits = 0;
    const html = T.p.filter((p) => (p[4].match(/\p{L}/gu) || []).length >= 4 && (!only || p[3] || p[1] === 'h')).map((p) => {
      const [n, type, reg, sib, text, ms] = p; let out = '', pos = 0;
      ms.slice().sort((a, b) => a[0] - b[0]).forEach(([a, b, g]) => { if (a < pos) return; out += esc(text.slice(pos, a)) + `<mark class="${hg && GN[g] === hg ? 'sel' : ''}" title="${esc(GN[g] || g)}">${esc(text.slice(a, b))}</mark>`; pos = b; });
      out += esc(text.slice(pos));
      if (re) { const c = (text.match(re) || []).length; if (!c) return ''; hits += c; }
      return `<p id="p${n}" class="${type === 'h' ? 'h' : ''}${sib ? ' sib' : ''}"><a class="pid" href="#book-${toH(id)}-p${n}" title="Постоянная ссылка на абзац">${n}</a>${out}</p>`;
    }).join('');
    document.getElementById('txt').innerHTML = html || '<p class="mute">Ничего не найдено.</p>';
    document.getElementById('tqn').textContent = re ? `Совпадений: ${hits}` : '';
  };
  render();
  if (par) { const el = document.getElementById('p' + par); if (el) { el.scrollIntoView({block: 'center'}); el.style.background = 'color-mix(in srgb, var(--acc) 12%, transparent)'; } }
  document.getElementById('onlySib').addEventListener('click', (e) => { only = !only; e.target.classList.toggle('on', only); render(); });
  let tmr; document.getElementById('tq').addEventListener('input', (e) => { clearTimeout(tmr); tmr = setTimeout(() => { q = e.target.value.trim(); render(); }, 250); });
  document.getElementById('tg').addEventListener('change', (e) => { hg = e.target.value; render(); });
}

// ---------------- связи 3D ----------------
async function links() {
  const N = await get('networks.json');
  const pers = Object.keys(N.periods);
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Связи</h1>
    <p>Слева — сеть групп: ребро соединяет группы, названные в одном предложении абзаца о Сибири (толщина — число таких предложений). Справа по переключателю — интертекстуальная сеть: кто на кого ссылается и у кого заимствует. Граф трёхмерный: его можно вращать, приближать и перетаскивать узлы; щелчок по узлу открывает карточку.</p>
    <div class="ctl"><button id="mG" class="on">сеть групп</button><button id="mI">цитирования и заимствования</button></div>
    <div class="ctl" id="perCtl">${pers.map((p, i) => `<button data-p="${esc(p)}" class="${i === 2 ? 'on' : ''}">${esc(PER[p] || p)}</button>`).join('')}</div>
    <div class="graph3d" id="g3"></div>
    <div class="legend" id="g3l" style="margin-top:10px"></div>
    <div id="g3info" class="small" style="margin-top:12px"></div></div></section>`;
  const el = document.getElementById('g3');
  let FG = null;
  try { await loadScript('assets/vendor/3d-force-graph.min.js'); } catch (e) { el.innerHTML = '<p style="color:#ccc;padding:20px">Не удалось загрузить библиотеку 3D-графа.</p>'; return; }
  const ok = (() => { try { return !!document.createElement('canvas').getContext('webgl'); } catch (e) { return false; } })();
  if (!ok) { el.innerHTML = '<p style="color:#ccc;padding:20px">Браузер не поддерживает WebGL — 3D-граф недоступен.</p>'; return; }
  let mode = 'g', per = pers[2] || pers[0];
  const show = () => {
    let data, legend;
    if (mode === 'g') {
      const d = N.periods[per];
      data = {nodes: d.nodes.map((n) => ({...n, label: n.name, color: CATC[n.category] || '#999', val: Math.max(1, n.degree / 8)})), links: d.links.map((l) => ({...l}))};
      legend = Object.entries(CAT).map(([k, v]) => `<span><i style="background:${CATC[k]}"></i>${v}</span>`).join('') + `<span>${d.works} книг, ${d.nodes.length} групп</span>`;
      const top = d.nodes.slice().sort((a, b) => b.betweenness - a.betweenness).slice(0, 5);
      document.getElementById('g3info').innerHTML = 'Главные посредники (betweenness): ' + top.map((n) => `${esc(n.name)} ${fmt(n.betweenness, 2)}`).join(' · ');
    } else {
      const d = N.intertext;
      const deg = {}; d.links.forEach((l) => { deg[l.target] = (deg[l.target] || 0) + l.weight; });
      const nodes = d.nodes.filter((n) => n.kind === 'work' || (deg[n.id] || 0) >= 5);
      const ids = new Set(nodes.map((n) => n.id));
      data = {nodes: nodes.map((n) => ({...n, color: CATC[n.kind], val: Math.max(1, Math.sqrt(deg[n.id] || 1))})), links: d.links.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({...l, color: l.type === 'reuse' ? '#f0607a' : '#8597a8'}))};
      legend = `<span><i style="background:${CATC.work}"></i>книги корпуса</span><span><i style="background:${CATC.authority}"></i>авторитеты вне корпуса</span><span><i style="background:#f0607a"></i>заимствование</span><span><i style="background:#8597a8"></i>ссылка</span>`;
      document.getElementById('g3info').innerHTML = 'Чаще всего упоминают: Pallas, Atkinson, Castrén, Humboldt, Schrenck, Erman, Middendorff.';
    }
    document.getElementById('g3l').innerHTML = legend;
    document.getElementById('perCtl').hidden = mode !== 'g';
    if (!FG) {
      FG = ForceGraph3D()(el).backgroundColor('#0e1a26').width(el.clientWidth).height(el.clientHeight)
        .nodeLabel((n) => esc(n.label || n.name || n.id)).nodeColor('color').nodeVal('val').nodeOpacity(.92).nodeRelSize(3)
        .linkWidth((l) => Math.min(4, Math.sqrt(l.weight || 1) / 2)).linkOpacity(.35).linkColor((l) => l.color || '#8597a8')
        .linkDirectionalArrowLength((l) => mode === 'i' ? 3 : 0).linkDirectionalArrowRelPos(1).cooldownTicks(150)
        .onEngineStop(() => { if (FG.__fit) { FG.__fit = false; FG.zoomToFit(600, 40); } })
        .onNodeClick((n) => { if (mode === 'g') location.hash = 'people-' + toH(n.id); else if (n.kind === 'work') location.hash = 'book-' + toH(n.id); });
      mapRO = new ResizeObserver(() => FG && FG.width(el.clientWidth).height(el.clientHeight)); mapRO.observe(el);
    }
    FG.__fit = true; FG.graphData(data); FG.d3Force('charge').strength(-90); FG.cameraPosition({x: 0, y: 0, z: mode === 'g' ? 320 : 420});
  };
  show();
  document.getElementById('mG').addEventListener('click', (e) => { mode = 'g'; e.target.classList.add('on'); document.getElementById('mI').classList.remove('on'); show(); });
  document.getElementById('mI').addEventListener('click', (e) => { mode = 'i'; e.target.classList.add('on'); document.getElementById('mG').classList.remove('on'); show(); });
  document.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { per = b.dataset.p; document.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); show(); }));
}
function loadScript(src) { return new Promise((res, rej) => { if (window.ForceGraph3D) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

// ---------------- аналитика ----------------
async function analytics() {
  const [A, works, reuse] = await Promise.all([get('analytics.json'), get('works.json'), get('reuse.json')]);
  const W = Object.fromEntries(works.map((w) => [w.id, w]));
  const ex = (dim) => A.expert.filter((r) => r.dimension === dim);
  const FR = {ethno: 'этнографическое описание', contact: 'повседневный контакт', econ: 'хозяйство и торговля', decline: 'упадок, вымирание, болезни', civ: 'иерархия «цивилизованности»', relig: 'религия', conflict: 'конфликт', admin: 'власть и управление', other: 'прочее'};
  const TERM = {personal: 'личное наблюдение', brit: 'британский автор', transit: 'транзит, плавание, война', 'C(per3)[T.b_1881_1904]': '1881–1904 (к до 1880)', 'C(per3)[T.c_после1904]': 'после 1904 (к до 1880)'};
  const ci2 = (r, a) => `${fmt(100 * r[a], 1)}%<br><span class="mute small" style="white-space:nowrap">${fmt(100 * r[a + '_lo'], 0)}–${fmt(100 * r[a + '_hi'], 0)}</span>`;
  const ci = (r, a) => `${fmt(100 * r[a], 1)}% <span class="mute small">(${fmt(100 * r[a + '_lo'], 1)}–${fmt(100 * r[a + '_hi'], 1)})</span>`;
  V.innerHTML = `<section class="band"><div class="wrap">
    <h1>Аналитика</h1>
    <div class="ctl scroll"><a class="btn" href="#analytics-eval">Оценки</a><a class="btn" href="#analytics-ngram">Ngram</a><a class="btn" href="#analytics-disc">Дискурсы</a><a class="btn" href="#analytics-rel">Отношения</a><a class="btn" href="#analytics-topics">Темы</a><a class="btn" href="#analytics-reuse">Заимствования</a></div>
    <h2 id="analytics-eval">Отчего зависит оценка народа</h2>
    <p>Экспертная выборка: ${ex('all')[0].n} описаний коренных народов из ${ex('all')[0].works} книг, страты «страна автора × период», доли взвешены, интервалы — бутстреп по книгам. Результаты предварительные: запланирована независимая повторная разметка части выборки.</p>
    <div class="cols">
      <div><h3>Рамка описания</h3><table class="stack"><thead><tr><th>Рамка</th><th class="n">n</th><th class="n">отрицательных</th><th class="n">положительных</th></tr></thead><tbody>${ex('frame').sort((a, b) => b.n - a.n).map((r) => `<tr><td>${FR[r.key] || esc(r.key)}</td><td class="n">${r.n}</td><td class="n">${ci(r, 'neg')}</td><td class="n">${ci(r, 'pos')}</td></tr>`).join('')}</tbody></table></div>
      <div><h3>Модель (отношение шансов)</h3><table class="stack"><thead><tr><th>Исход</th><th>Фактор</th><th class="n">ОШ</th><th class="n">95% ДИ</th></tr></thead><tbody>${A.models.filter((m) => m.term !== 'Intercept').map((m) => `<tr><td>${m.model.startsWith('neg') ? 'отрицательная' : 'положительная'}</td><td>${TERM[m.term] || esc(m.term)}</td><td class="n"><b>${fmt(m.OR, 2)}</b></td><td class="n">${fmt(m.lo, 2)}–${fmt(m.hi, 2)}</td></tr>`).join('')}</tbody></table><p class="small mute">ОШ больше 1 — фактор повышает вероятность; интервал, не включающий 1, — устойчивый результат.</p></div>
    </div>
    <div class="cols" style="margin-top:18px">${['observer', 'period', 'stay'].map((dim) => `<div><h3>${{observer: 'Страна автора', period: 'Период поездки', stay: 'Тип поездки'}[dim]}</h3><table class="stack"><thead><tr><th></th><th class="n">n</th><th class="n">отриц.</th><th class="n">полож.</th></tr></thead><tbody>${ex(dim).map((r) => `<tr><td>${esc(r.key)}</td><td class="n">${r.n}</td><td class="n">${ci2(r, 'neg')}</td><td class="n">${ci2(r, 'pos')}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>

    <h2 id="analytics-ngram" style="margin-top:36px">Ngram: частоты слов по годам</h2>
    <p>Английские абзацы о Сибири, частота на миллион слов по году издания (сглаживание — скользящее окно). Введите слово или сочетание до трёх слов; доступны этнонимы, слова-маркеры и сочетания с этнонимами.</p>
    <div class="ctl"><input type="text" id="ngq" list="ngl" value="convicts, settlers, savages" aria-label="Слова через запятую" style="min-width:min(100%,420px)"><datalist id="ngl"></datalist><label>сглаживание <select id="ngs"><option value="0">нет</option><option value="5" selected>±5 лет</option><option value="10">±10 лет</option></select></label></div>
    <div class="chart" id="ngc"></div>

    <h2 id="analytics-disc" style="margin-top:36px">Дискурсы по периодам</h2>
    <p>Доля абзацев о коренных народах, где встречается дискурс (правила на 9 языках, точность ≈0,75 — доли занижены). Линия — 95% интервал по книгам.</p>
    <div class="chart" id="dc"></div>
    <details><summary>Примеры абзацев</summary>${A.discourse_examples.slice(0, 60).map((e) => `<div class="quote">${esc(e.quote)}<div class="m">${esc(e.discourse_ru)} · ${esc(e.work)} · <a href="#book-${toH(e.pid.split('_p')[0])}-p${esc(e.pid.split('_p')[1])}">абзац</a></div></div>`).join('')}</details>

    <h2 id="analytics-rel" style="margin-top:36px">Отношения: экспертная разметка</h2>
    <p>84 предложения, где коренная группа названа вместе с русскими, казаками, переселенцами или ссыльными и описано отношение. Маленькая выборка: это направление для проверки.</p>
    <div class="scroll" id="relT"></div>

    <h2 id="analytics-topics" style="margin-top:36px">Темы абзацев о коренных народах</h2>
    <p>Тематическая модель (NMF, 18 тем) по английским абзацам. Цвет клетки — доля темы в периоде.</p>
    <div class="scroll" id="topT"></div>

    <h2 id="analytics-reuse" style="margin-top:36px">Заимствования и общие цитаты</h2>
    <p>Пары абзацев из разных книг с четырьмя и более общими 8-словными фрагментами (английские тексты). Каждую пару нужно проверить: это может быть цитата, общий источник или пересказ.</p>
    <div class="scroll"><table class="stack"><thead><tr><th>Поздняя книга</th><th>Источник</th><th>Тип</th><th class="n">8-грамм</th><th>Фрагмент</th></tr></thead><tbody>${reuse.slice(0, 80).map((r) => `<tr><td><a href="#book-${toH(r.b)}-p${esc(r.bp.split('_p')[1])}">${esc(W[r.b] ? W[r.b].label : r.b)}</a></td><td><a href="#book-${toH(r.s)}-p${esc(r.sp.split('_p')[1])}">${esc(W[r.s] ? W[r.s].label : r.s)}</a></td><td>${esc(r.kind)}</td><td class="n">${r.n}</td><td class="small">${esc(r.bt)}…</td></tr>`).join('')}</tbody></table></div>
  </div></section>`;
  discChart(document.getElementById('dc'), A.discourse.filter((d) => d.dimension === 'period' && d.discourse !== 'civilizing_colonization'));
  // отношения
  const rel = A.relations_manual; const types = [...new Set(rel.map((r) => r.type_ru))];
  const v = (t, p) => (rel.find((r) => r.type_ru === t && r.per === p) || {share: 0}).share;
  types.sort((a, b) => (v(b, 'после 1880') + v(b, 'до 1880')) - (v(a, 'после 1880') + v(a, 'до 1880')));
  document.getElementById('relT').innerHTML = `<table><thead><tr><th>Тип отношения</th><th class="n">до 1880</th><th class="n">после 1880</th></tr></thead><tbody>${types.map((t) => `<tr><td>${esc(t)}</td><td class="n">${fmt(100 * v(t, 'до 1880'), 1)}%</td><td class="n">${fmt(100 * v(t, 'после 1880'), 1)}%</td></tr>`).join('')}</tbody></table>`;
  // темы
  const TP = A.topics; const pk = [...new Set(TP.shares.filter((s) => s.dimension === 'period').map((s) => s.key))];
  const ord = ['до 1855', '1856–1880', '1881–1904', '1905–1917', '1918–1930']; pk.sort((a, b) => ord.findIndex((o) => a.startsWith(o)) - ord.findIndex((o) => b.startsWith(o)));
  const sh = (k, t) => (TP.shares.find((s) => s.dimension === 'period' && s.key === k && s.topic === t) || {share: 0}).share;
  document.getElementById('topT').innerHTML = `<table><thead><tr><th>Тема</th><th>Ключевые слова</th>${pk.map((k) => `<th class="n">${esc(k.split(' (')[0])}</th>`).join('')}</tr></thead><tbody>${TP.labels.map((l, t) => `<tr><td><b>${esc(l)}</b></td><td class="small mute">${esc(TP.words[t].slice(0, 8).join(', '))}</td>${pk.map((k) => { const s = sh(k, t); return `<td class="n" style="background:color-mix(in srgb,var(--acc2) ${Math.min(80, s * 400).toFixed(0)}%,transparent)">${fmt(100 * s, 1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  // ngram
  const NG = await get('ngram_en.json');
  document.getElementById('ngl').innerHTML = Object.keys(NG.ngrams).slice(0, 2500).map((k) => `<option value="${esc(k)}">`).join('');
  const ngDraw = () => ngramChart(document.getElementById('ngc'), NG, document.getElementById('ngq').value, +document.getElementById('ngs').value);
  ngDraw(); document.getElementById('ngq').addEventListener('change', ngDraw); document.getElementById('ngs').addEventListener('change', ngDraw);
  const ngro = new ResizeObserver(() => ngDraw()); ngro.observe(document.getElementById('ngc'));
  if (location.hash.length > 11) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
}
function ngramChart(el, NG, q, sm) {
  const words = q.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 6);
  const years = Object.keys(NG.year_totals).map(Number).sort((a, b) => a - b);
  const y0 = years[0], y1 = years[years.length - 1];
  const series = words.map((wd) => {
    const c = NG.ngrams[wd] || {};
    const pts = [];
    for (let y = y0; y <= y1; y++) {
      let n = 0, t = 0; for (let k = y - sm; k <= y + sm; k++) { if (NG.year_totals[k]) { t += NG.year_totals[k]; n += c[k] || 0; } }
      if (t > 20000) pts.push([y, n / t * 1e6]);
    }
    return {wd, pts, found: !!NG.ngrams[wd]};
  });
  const w = el.clientWidth || 700, h = 300, m = {l: 46, r: 120, t: 12, b: 28};
  const x = d3.scaleLinear().domain([y0, y1]).range([m.l, w - m.r]);
  const ymax = d3.max(series.flatMap((s) => s.pts.map((p) => p[1]))) || 1;
  const y = d3.scaleLinear().domain([0, ymax]).nice().range([h - m.b, m.t]);
  const cols = ['#a3173a', '#3f7296', '#3c7a5a', '#9a6b1f', '#6a5a9e', '#6b7785'];
  const line = d3.line().x((p) => x(p[0])).y((p) => y(p[1]));
  const labs = series.filter((s) => s.pts.length).map((s, i) => ({s, i, y: y(s.pts[s.pts.length - 1][1])})).sort((a, b) => a.y - b.y);
  for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 15) labs[k].y = labs[k - 1].y + 15;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" height="${h}" role="img" aria-label="Частоты слов по годам">
    ${y.ticks(4).map((t) => `<line x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${m.l - 6}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--mute)">${fmt(t)}</text>`).join('')}
    ${x.ticks(Math.max(3, Math.floor(w / 90))).map((t) => `<text x="${x(t)}" y="${h - 8}" text-anchor="middle" font-size="12" fill="var(--mute)">${t}</text>`).join('')}
    ${series.map((s, i) => `<path d="${line(s.pts) || ''}" fill="none" stroke="${cols[i]}" stroke-width="2.2"/>`).join('')}
    ${labs.map((l) => `<text x="${w - m.r + 6}" y="${l.y + 4}" font-size="12.5" fill="${cols[series.indexOf(l.s)]}">${esc(l.s.wd)}</text>`).join('')}</svg>
    ${series.filter((s) => !s.found).length ? `<p class="small mute">Нет в словаре n-грамм: ${series.filter((s) => !s.found).map((s) => esc(s.wd)).join(', ')} (в нём n-граммы с частотой ≥ 30).</p>` : ''}`;
}
function discChart(el, rows) {
  const draw = () => {
    const ds = [...new Set(rows.map((r) => r.discourse_ru))];
    const ord = ['до 1855', '1856–1880', '1881–1904', '1905–1917', '1918–1930'];
    const pk = (k) => ord.findIndex((o) => k.startsWith(o));
    const w = el.clientWidth || 700, cols = w < 560 ? 1 : w < 900 ? 2 : 4, pw = w / cols, ph = 160;
    const out = ds.map((d, i) => {
      const R = rows.filter((r) => r.discourse_ru === d).sort((a, b) => pk(a.key) - pk(b.key));
      const ym = Math.max(1, ...R.map((r) => 100 * r.hi)); const x0 = 34, x1 = pw - 12, yb = ph - 30, yt = 26;
      const X = (j) => x0 + (j + .5) * (x1 - x0) / ord.length, Y = (v) => yb - (v / ym) * (yb - yt);
      return `<g transform="translate(${(i % cols) * pw},${Math.floor(i / cols) * ph})"><text x="4" y="14" font-size="13" font-weight="700" fill="var(--ink)">${esc(d)}</text>
        <line x1="${x0}" x2="${x1}" y1="${yb}" y2="${yb}" stroke="var(--line)"/><text x="${x0 - 4}" y="${yt + 4}" text-anchor="end" font-size="11" fill="var(--mute)">${fmt(ym, 0)}%</text>
        ${R.map((r) => { const j = pk(r.key); return `<line x1="${X(j)}" x2="${X(j)}" y1="${Y(100 * r.lo)}" y2="${Y(100 * r.hi)}" stroke="var(--acc2)" stroke-opacity=".5" stroke-width="2"/><circle cx="${X(j)}" cy="${Y(100 * r.share)}" r="4.5" fill="var(--acc2)"><title>${esc(r.key)}: ${fmt(100 * r.share, 1)}% (${fmt(100 * r.lo, 1)}–${fmt(100 * r.hi, 1)}), ${r.works} книг</title></circle>`; }).join('')}
        ${ord.map((o, j) => `<text x="${X(j)}" y="${ph - 12}" text-anchor="middle" font-size="10.5" fill="var(--mute)">${pw > 260 ? o.replace('1856–1880', '1856–80').replace('1905–1917', '1905–17').replace('1918–1930', '1918–30') : String(j + 1)}</text>`).join('')}</g>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${w} ${Math.ceil(ds.length / cols) * ph}" role="img" aria-label="Доли дискурсов по периодам">${out.join('')}</svg>`;
  };
  draw(); const ro = new ResizeObserver(draw); ro.observe(el);
}

// ---------------- публикации ----------------
async function publications() {
  let P = []; try { P = await get('publications.json'); } catch (e) { P = []; }
  const ds = P.filter((p) => p.type === 'dataset'), rest = P.filter((p) => p.type !== 'dataset');
  const pub = rest.filter((p) => !['in_press', 'submitted'].includes(p.status)), inp = rest.filter((p) => ['in_press', 'submitted'].includes(p.status));
  const link = (t) => esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;)])/g, '<a href="$1">$1</a>');
  const item = (p) => `<li>${p.cite ? `<span class="ref">${link(p.cite)}</span>` : `<span class="ref"><b>${esc(p.authors)}</b> ${esc(p.title)} // ${esc(p.venue)}. ${esc(p.year || '')}${p.pages ? '. ' + esc(p.pages) : ''}${p.doi ? `. <a href="https://doi.org/${esc(p.doi)}">https://doi.org/${esc(p.doi)}</a>` : ''}</span>`}${p.url ? ` <a href="${esc(p.url)}">текст</a>` : ''}${p.pdf ? ` <a href="${esc(p.pdf)}">PDF</a>` : ''}${p.abstract ? `<p class="small">${esc(p.abstract)}</p>` : ''}${(p.groups || []).length || (p.works || []).length ? `<p class="small">${(p.groups || []).map((g) => `<a href="#people-${toH(g)}">${esc(g)}</a>`).concat((p.works || []).map((w) => `<a href="#book-${toH(w)}">${esc(w)}</a>`)).join(', ')}</p>` : ''}${p.note ? `<p class="small mute">${esc(p.note)}</p>` : ''}</li>`;
  const sec = (h, L) => L.length ? `<h2>${h}</h2><ol class="refs">${L.map(item).join('')}</ol>` : '';
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Публикации проекта</h1>
    ${P.length ? sec('Статьи и монографии', pub) + sec('В печати', inp) + sec('Наборы данных', ds) :
    `<div class="empty"><p>Список публикаций ещё не заполнен.</p></div>`}
  </div></section>`;
}

// ---------------- метод ----------------
async function method() {
  const [A, P, works] = await Promise.all([get('analytics.json'), project(), get('works.json')]);
  const JE = A.journeys_eval || {n: 12, precision: 0.69, recall: 0.71}; const Q = A.quality, ok = (i) => Math.round(Q[i].value * Q[i].n), pct = (v) => fmt(100 * v, 0) + '%';
  const steps = [
    ['Формирование корпуса', 'экспертная работа и цифровой поиск', `Корпус формировался с опорой на библиографические справочники (прежде всего A. G. Cross, «In the Lands of the Romanovs»), национальные библиографии и каталоги, фонды электронных библиотек и репозиториев (Internet Archive, Project Gutenberg и др.) и исследовательскую литературу о травелогах. Каждый кандидат проверялся по критериям отбора: европейский автор, собственная поездка или пребывание в Сибири, 1800–1930 годы. Из 168 рассмотренных изданий отобрано ${works.length}; сверка с библиографией Cross показывает охват 76% её европейских позиций.`],
    ['Паспорт издания', 'экспертная работа', 'Для каждой книги вручную установлены автор, его страна и род занятий, тип пребывания в Сибири, годы поездки (отдельно от года издания) и надёжность датировки. На этих сведениях держатся все сравнения по эпохам и по странам.'],
    ['Подготовка текстов', 'цифровая обработка с выборочным контролем', 'Очистка распознанного текста от колонтитулов, номеров страниц, переносов, подписей к иллюстрациям и служебных страниц; деление на главы и абзацы. Каждый абзац получил постоянный номер, по которому на него можно сослаться.'],
    ['Названия народов и мест', 'экспертная работа и цифровая обработка', 'Словарь этнонимов на 10 языках составлен и выверен вручную: исторические и иноязычные формы (Ostiaken, Tongouses, Bratski) сведены к современным названиям народов, неоднозначные случаи разобраны по контексту. Справочник из 101 места с координатами. Поиск по всем текстам выполнялся программно.'],
    ['Маршруты', 'экспертная работа и цифровая обработка', 'Программа готовит черновик маршрута: места, о которых автор пишет как о посещённых, с абзацами-доказательствами. Затем каждая книга прочитывается: остаются только места, где автор действительно был, в порядке поездки, с дословной цитатой; цитаты и номера абзацев сверяются с текстом автоматически. Эксперты проекта подтверждают маршруты в рабочем месте команды; на карте видно, какие маршруты уже подтверждены.'],
    ['Иллюстрации', 'цифровая обработка с проверкой', 'По сканам Internet Archive программа отбирает страницы с графикой: по разметке распознанного текста ищет вклейки и просветы в наборе, по изображению страницы — связную графическую область. Альбомные вклейки поворачиваются: выбирается ориентация, при которой подпись читается увереннее. Подпись — строки под изображением; иллюстрация привязывается к абзацу библиотеки по совпадению текста соседних страниц. Подписи проверяются и переводятся, тип и названные народы уточняются; правки вносятся в рабочем месте. Скрипты 08a_illustrations.py и 08b_illustrations_site.py.'],
    ['Экспертная разметка', 'экспертная работа', 'Стратифицированная выборка по стране автора и эпохе: 250 описаний коренных народов и 100 фрагментов об отношениях между группами. Для каждого фрагмента определены оценка, рамка описания (иерархия «цивилизованности», хозяйство, контакт и т. д.), источник знания (личное наблюдение или пересказ) и тип отношения. Все выводы об оценках и отношениях на сайте построены на этой разметке.'],
    ['Корпусный анализ', 'цифровая обработка', 'Частоты по десятилетиям, коллокации, дискурсы, тематическое моделирование, сети совместных упоминаний и цитирования, поиск текстовых заимствований, статистические модели с учётом того, что фрагменты одной книги не независимы.'],
    ['Интерпретация', 'экспертная работа', 'Каждая закономерность проверялась чтением исходных фрагментов; любая цифра на сайте ведёт к абзацам, на которых она основана.']];
  const rows = [
    ['ok', 'Найденное слово действительно называет народ', `${Q[1].n} случайных упоминаний после доработки словаря`, `верно ${ok(1)} из ${Q[1].n}`, 'Используется для всех частот и сетей.'],
    ['ok', 'То же для текстов на итальянском, датском, норвежском, польском и чешском', `${Q[2].n} упоминаний`, `верно ${ok(2)} из ${Q[2].n}`, 'Прилагательные («tatarski», «kirgizský») исключены из поиска.'],
    ['ok', 'Дополнительные исторические формы названий (Buriats, cosaques, Ostiaken)', `${Q[3].n} упоминаний`, `верно ${ok(3)} из ${Q[3].n}`, 'Используются наравне с основными формами.'],
    ['ok', 'Абзац верно отнесён к Сибири', `${Q[9].n} абзацев`, `верно ${ok(9)} из ${Q[9].n}`, 'Анализ ведётся только по абзацам о Сибири.'],
    ['ok', 'Фрагмент экспертной выборки действительно описывает народ Сибири', `${Q[4].n} фрагментов`, `подходят ${ok(4)} из ${Q[4].n}`, 'Неподходящие фрагменты исключены из расчётов.'],
    ['mid', 'Отнесение к Сибири абзацев без собственных топонимов в книгах без деления на главы', `${Q[5].n} абзацев`, `верно ${ok(5)} из ${Q[5].n}`, 'Около пятой части таких абзацев на деле о других краях; доли по этим книгам приблизительны.'],
    ['mid', 'Черновики маршрутов: места, о которых автор пишет как о посещённых', `сравнение с ${JE.n} маршрутами, восстановленными по тексту`, `верных остановок ${pct(JE.precision)}, найдено ${pct(JE.recall)} остановок, порядок почти совпадает`, 'Черновики не рисуются линией: на карте это пронумерованные точки, пока маршрут не проверит эксперт.'],
    ['mid', 'Автоматический поиск дискурсов (вымирание, ссылка, обрусение и др.)', `${Q[7].n} абзацев`, `верно ${ok(7)} из ${Q[7].n}`, 'Надёжнее сравнивать изменения во времени, чем абсолютные доли; часть случаев поиск пропускает.'],
    ['low', 'Автоматическое выделение тем', `${Q[12].n} абзацев, сравнение с ручным определением`, 'совпадение примерно в половине случаев', 'Темы служат только для навигации, выводов по ним не делается.'],
    ['no', 'Автоматическое определение типа отношений между народами', `${Q[6].n} фрагментов, сравнение с экспертной разметкой`, `совпало ${ok(6)} из ${Q[6].n}`, 'Не используется: отношения описаны по экспертной разметке.'],
    ['no', 'Автоматическое определение оценки народа и источника знания', `${Q[10].n} фрагментов, сравнение с экспертной разметкой`, 'согласие слабое', 'Не используется: все оценки на сайте — по экспертной разметке.']];
  const ST = {ok: 'надёжно', mid: 'с оговорками', low: 'как ориентир', no: 'заменено экспертной разметкой'};
  V.innerHTML = `<section class="band"><div class="wrap">
    <h1>Метод и данные</h1>
    <p class="lede">Ресурс построен на сочетании экспертной филологической работы с источниками и цифровой обработки корпуса. Отбор книг, их описание, словарь названий народов, восстановление маршрутов, разметка оценок и отношений и интерпретация результатов выполнены исследователями; программы применялись там, где нужно пройти по всем 11 миллионам слов, и каждый их результат проверялся вручную.</p>
    <h2 style="margin-top:40px">Этапы работы</h2>
    <ol class="steps">${steps.map(([t, k, d]) => `<li><h3>${esc(t)}</h3><p class="kind">${esc(k)}</p><p>${esc(d)}</p></li>`).join('')}</ol>
    <h2 style="margin-top:48px">Проверка автоматической обработки</h2>
    <p>Каждый автоматический шаг проверялся вручную на случайной выборке: исследователь смотрел, верно ли сработала программа. В таблице — что проверялось, на скольких примерах, что получилось и как это учтено на сайте. Где программа ошибалась слишком часто, её результаты заменены экспертной разметкой.</p>
    <div class="scroll"><table class="stack qual"><thead><tr><th>Что проверяли</th><th>На чём</th><th>Результат</th><th>Как учтено</th><th>Итог</th></tr></thead><tbody>${rows.map(([st, a, b, c, d]) => `<tr><td data-l="Что проверяли">${esc(a)}</td><td data-l="На чём">${esc(b)}</td><td data-l="Результат">${esc(c)}</td><td data-l="Как учтено">${esc(d)}</td><td data-l="Итог"><span class="st ${st}">${ST[st]}</span></td></tr>`).join('')}</tbody></table></div>
    <h2 style="margin-top:48px">Ограничения</h2>
    <ul class="lim"><li>Экспертную разметку предстоит дополнить независимой повторной разметкой части выборки, чтобы оценить согласие между экспертами.</li>
    <li>В распознанных книгах без деления на главы отнесение отдельных абзацев к Сибири приблизительно (см. таблицу).</li>
    <li>Корпус включает издания, доступные в электронных библиотеках и репозиториях; часть известных травелогов (например, M. A. Czaplicka, J. Noble, P. Labbé) пока не оцифрована в пригодном виде. Корпус будет пополняться.</li>
    <li>Ареалы народов на карте схематичны и служат только для ориентира.</li></ul>
    <h2 style="margin-top:48px">Данные</h2>
    <p>Каталог изданий и атлас народов и мест опубликованы на Zenodo с DOI${(P.datasets || []).length ? ': ' + P.datasets.map((d) => `<a href="https://doi.org/${esc(d.doi)}">${esc(d.title)}</a> (${esc(d.license)})`).join('; ') : ''}. Наборы данных сайта лежат в папке <code>data/</code>, тексты — в <code>texts/</code>, код обработки — в <a href="${REPO}">репозитории на GitHub</a>.</p>
    <div class="cite">${esc(citation(P))}</div>
  </div></section>`;
}
route();
}
