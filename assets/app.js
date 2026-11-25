/* Сибирь в травелогах — одностраничный статический сайт (GitHub Pages). Маршрутизация по #имени. */
{
const V = document.getElementById('view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const yr = (n) => n == null || isNaN(n) ? '—' : String(Math.round(n));
const inBox = (s) => s[2] >= 40 && s[2] <= 195 && s[3] >= 34 && s[3] <= 79;
const fmt = (n, d = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('ru-RU', {maximumFractionDigits: d, minimumFractionDigits: d});
const C = {};
const get = (n) => (C[n] ||= fetch('data/' + n).then((r) => { if (!r.ok) throw new Error(n); return r.json(); }));
const toH = (id) => String(id).replace(/_/g, '-'); const fromH = (h) => h.replace(/-/g, '_');
const NAT = {british: 'Великобритания', french: 'Франция/Бельгия', german: 'Германия/Австрия', scandinavian: 'Скандинавия', finnish: 'Финляндия', polish: 'Польша', italian: 'Италия', central_european: 'Центральная Европа', dutch: 'Нидерланды'};
const PER = {'P1 до 1855': 'до 1855', 'P2 1856–1880': '1856–1880', 'P3 1881–1904': '1881–1904', 'P4 1905–1917': '1905–1917', 'P5 1918–1930': '1918–1930'};
const CAT = {indigenous: 'коренные народы', settler: 'русские и пришлые', social: 'социальные группы', neighbour: 'соседи', foreign: 'иностранцы', generic: 'обобщённые «туземцы»'};
const CATC = {indigenous: '#2b6a9a', settler: '#c4361c', social: '#8a5a00', neighbour: '#6b5bb5', foreign: '#5b636b', generic: '#2f7d4f', work: '#c4361c', authority: '#8a8f96'};
let mapRO = null;

function setMenu(r) { document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('on', r.startsWith(a.dataset.r) || (a.dataset.r === 'peoples' && r.startsWith('people')) || (a.dataset.r === 'library' && r.startsWith('book')))); }
async function route() {
  const h = (location.hash || '#home').slice(1) || 'home';
  setMenu(h.startsWith('analytics') ? 'analytics' : h); if (mapRO) { mapRO.disconnect(); mapRO = null; }
  V.innerHTML = '<div class="wrap loading">Загрузка…</div>';
  try {
    if (h === 'home') await home();
    else if (h === 'atlas') await atlas();
    else if (h === 'peoples') await peoples();
    else if (h.startsWith('people-')) await people(fromH(h.slice(7)));
    else if (h === 'library') await library();
    else if (h.startsWith('book-')) { const m = h.slice(5).match(/^(.*?)(?:-p(\d+))?$/); await book(fromH(m[1]), m[2]); }
    else if (h === 'links') await links();
    else if (h.startsWith('analytics')) await analytics();
    else if (h === 'publications') await publications();
    else if (h === 'method') await method();
    else await home();
    if (!/^book-.*-p\d+$/.test(h) && !h.startsWith('analytics-')) window.scrollTo(0, 0);
  } catch (e) { V.innerHTML = `<div class="wrap band"><h2>Не удалось загрузить данные</h2><p class="mute">${esc(e.message)}. Сайт читает файлы из папки data/; откройте его через веб-сервер (GitHub Pages или python -m http.server).</p></div>`; }
}
window.addEventListener('hashchange', route);

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
async function home() {
  const [A, works, routes, places, geo, groups, reuse] = await Promise.all([get('analytics.json'), get('works.json'), get('routes.json'), get('places.json'), get('geo.json'), get('groups.json'), get('reuse.json')]);
  const S = A.summary;
  const ex = A.expert.find((r) => r.dimension === 'all');
  const mod = A.models.find((m) => m.term === 'personal' && m.model.startsWith('pos'));
  V.innerHTML = `
  <section class="band"><div class="wrap hero">
    <div>
      <h1>Сибирь глазами европейских путешественников, 1800–1930</h1>
      <p>Как европейцы видели народы Сибири и отношения между ними — с русскими, казаками, ссыльными, переселенцами и друг с другом. Каждая цифра здесь ведёт к абзацу источника.</p>
      <div class="figs">
        <div><div class="fig-n">${fmt(S.works)}</div><div class="fig-l">изданий 9 языков</div></div>
        <div><div class="fig-n">${fmt(S.words_total / 1e6, 1)} млн</div><div class="fig-l">слов, из них ${fmt(S.words_siberia / 1e6, 1)} млн о Сибири</div></div>
        <div><div class="fig-n">${fmt(S.mentions_siberia)}</div><div class="fig-l">упоминаний народов в Сибири</div></div>
        <div><div class="fig-n">${fmt(S.indigenous_groups)}</div><div class="fig-l">коренных групп из ${fmt(S.groups_found)}</div></div>
      </div>
      <p class="small mute">Красные линии — маршруты, восстановленные вручную по абзацам-доказательствам; остальные (автоматические) — в атласе. Синие пятна — схематичные ареалы народов около 1900 г.</p>
    </div>
    <div class="mapbox" id="homeMap"></div>
  </div></section>
  <section class="band alt"><div class="wrap">
    <h2>Что показывает корпус</h2>
    <div class="cols">
      <div><h3>Оценка зависит от опыта встречи</h3><p>В ручной выборке отрицательно оценены ${fmt(100 * ex.neg, 1)}% описаний коренных народов, положительно — ${fmt(100 * ex.pos, 1)}%. Личное наблюдение повышает шансы положительной оценки в ${fmt(mod.OR, 1)} раза (95% ДИ ${fmt(mod.lo, 1)}–${fmt(mod.hi, 1)}).</p><a href="#analytics">Аналитика →</a></div>
      <div><h3>Мотив «вымирания» нарастает</h3><p>Его доля в абзацах о коренных народах растёт от 0,4% до 1855 года к 2,9% в 1905–1917 годах, а внимание к каторге в 1890-е сменяется вниманием к переселенцам.</p><a href="#analytics-ngram">Ngram и дискурсы →</a></div>
      <div><h3>Тексты переписывают друг друга</h3><p>Найдено ${fmt(reuse.length)} пар абзацев с общими фрагментами: компиляции, самоповторы, неатрибутированные заимствования. Самый цитируемый авторитет — Паллас.</p><a href="#links">Связи →</a></div>
    </div>
  </div></section>
  <section class="band"><div class="wrap">
    <h2>Разделы</h2>
    <div class="cards">
      <a class="card" href="#atlas"><div class="t">Атлас</div><div class="s">${routes.length} маршрутов, ${places.length} мест, ареалы народов, фильтры по эпохе и стране автора</div></a>
      <a class="card" href="#peoples"><div class="t">Народы</div><div class="s">${groups.length} карточек: кто описывал, какими словами, когда, цитаты</div></a>
      <a class="card" href="#library"><div class="t">Библиотека</div><div class="s">${works.length} текстов с подсветкой этнонимов и абзацами о Сибири</div></a>
      <a class="card" href="#links"><div class="t">Связи 3D</div><div class="s">сети групп по периодам и сеть цитирований</div></a>
      <a class="card" href="#analytics"><div class="t">Аналитика</div><div class="s">дискурсы, Ngram, рамки, модели, темы, заимствования</div></a>
      <a class="card" href="#publications"><div class="t">Публикации</div><div class="s">статьи и монографии проекта</div></a>
      <a class="card" href="#method"><div class="t">Метод</div><div class="s">конвейер, проверки качества, данные для загрузки</div></a>
    </div>
  </div></section>`;
  const ind = groups.filter((g) => g.category === 'indigenous');
  mapIn(document.getElementById('homeMap'), () => ({geo, routes, places, works, areas: ind, showPlaces: false, labels: false, zoom: false, showAuto: false, onWork: (w) => location.hash = 'book-' + toH(w), onGroup: (g) => location.hash = 'people-' + toH(g)}));
}

// ---------------- атлас ----------------
async function atlas() {
  const [works, routes, places, geo, groups] = await Promise.all([get('works.json'), get('routes.json'), get('places.json'), get('geo.json'), get('groups.json')]);
  const W = Object.fromEntries(works.map((w) => [w.id, w]));
  const ind = groups.filter((g) => g.category === 'indigenous');
  const st = {period: '', nat: '', stay: '', manual: true, auto: false, places: true, areas: true, work: '', group: ''};
  const opt = (arr, lab) => arr.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  V.innerHTML = `<section class="band"><div class="wrap">
    <h1>Атлас маршрутов и ареалов</h1>
    <p>Маршруты ${routes.filter((r) => r.method === 'manual').length} книг восстановлены вручную по паспорту источника, у каждой остановки — абзац-доказательство. Для остальных ${routes.filter((r) => r.method === 'auto').length} — автоматически по порядку упоминаний мест (совпадение с ручными маршрутами: 84% остановок). Колёсиком или щипком карту можно приблизить.</p>
    <div class="ctl">
      <label>Период <select id="fPer"><option value="">все</option>${opt(Object.entries(PER), '')}</select></label>
      <label>Страна автора <select id="fNat"><option value="">все</option>${opt([...new Set(works.map((w) => w.nat))].map((n) => [n, NAT[n] || n]))}</select></label>
      <label>Тип поездки <select id="fStay"><option value="">все</option>${opt([...new Set(works.map((w) => w.stay))].map((s) => [s, works.find((w) => w.stay === s).stay_ru]))}</select></label>
      <label>Книга <select id="fWork"><option value="">—</option>${opt(works.slice().sort((a, b) => a.year - b.year).map((w) => [w.id, w.label]))}</select></label>
      <label>Народ <select id="fGr"><option value="">—</option>${opt(ind.map((g) => [g.id, g.name]))}</select></label>
    </div>
    <div class="ctl">
      <button id="tMan" class="on">ручные маршруты</button><button id="tAuto">автомаршруты</button><button id="tPl" class="on">места</button><button id="tAr" class="on">ареалы</button>
    </div>
    <div class="mapbox big" id="atlasMap"></div>
    <div class="side" style="margin-top:22px"><div id="aInfo"></div><div id="aPlace"><p class="mute">Нажмите на место, маршрут или ареал.</p></div></div>
  </div></section>`;
  const el = document.getElementById('atlasMap');
  const filt = (w) => (!st.period || w.period === st.period) && (!st.nat || w.nat === st.nat) && (!st.stay || w.stay === st.stay);
  const gr = () => ind.find((g) => g.id === st.group);
  const draw = mapIn(el, () => ({geo, routes, places, works, areas: st.areas ? ind : null, showAreas: st.areas, showManual: st.manual, showAuto: st.auto, showPlaces: st.places, filter: filt,
    focusWork: st.work, focusGroup: st.group,
    placeValue: st.group ? ((p) => (p.groups.find((x) => x[0] === gr().name) || [0, 0])[1]) : null,
    onWork: (w) => { st.work = w; document.getElementById('fWork').value = w; draw(); info(); },
    onGroup: (g) => { st.group = g; document.getElementById('fGr').value = g; draw(); info(); },
    onPlace: (p) => placeInfo(p)}));
  function info() {
    const box = document.getElementById('aInfo'); let h = '';
    if (st.work) {
      const w = W[st.work], r = routes.find((x) => x.work === st.work);
      h += `<h3><a href="#book-${toH(w.id)}">${esc(w.label)}</a> · ${esc(w.author)}</h3><p class="small mute">${esc(w.nat_ru)} · ${esc(w.stay_ru)} · поездка ${w.j0 ? yr(w.j0) : '?'}${w.j1 && w.j1 !== w.j0 ? '–' + yr(w.j1) : ''} · ${r ? (r.method === 'auto' ? 'автомаршрут' : 'ручной маршрут') : ''}</p>`;
      if (r) h += `<ol class="small">${r.stops.filter(inBox).map((s) => `<li>${esc(s[1])}${s[4] ? ` — <a href="#book-${toH(w.id)}-p${esc(s[4].split('_p')[1])}">абзац</a>` : ' — <span class="mute">в тексте не найдено</span>'}</li>`).join('')}</ol>`;
    }
    if (st.group) { const g = gr(); h += `<h3><a href="#people-${toH(g.id)}">${esc(g.name)}</a></h3><p class="small mute">Круги показывают, где упоминания этого народа стоят в одном абзаце с названием места.</p>`; }
    box.innerHTML = h;
  }
  function placeInfo(p) {
    document.getElementById('aPlace').innerHTML = `<h3>${esc(p.name)}</h3><p class="small mute">${p.mentions} упоминаний в ${p.works} книгах · координаты: ${esc(p.coord)}</p>
      <h3 style="font-size:16px">Чаще всего упоминают</h3>${bars(p.top_works.map(([w, n]) => [W[w] ? W[w].label : w, n, '#book-' + toH(w)]))}
      ${p.groups.length ? `<h3 style="font-size:16px;margin-top:14px">Народы в тех же абзацах</h3>${bars(p.groups)}` : ''}`;
  }
  const bind = (id, k, num) => document.getElementById(id).addEventListener('change', (e) => { st[k] = e.target.value; draw(); info(); });
  bind('fPer', 'period'); bind('fNat', 'nat'); bind('fStay', 'stay'); bind('fWork', 'work'); bind('fGr', 'group');
  [['tMan', 'manual'], ['tAuto', 'auto'], ['tPl', 'places'], ['tAr', 'areas']].forEach(([id, k]) => document.getElementById(id).addEventListener('click', (e) => { st[k] = !st[k]; e.target.classList.toggle('on', st[k]); draw(); }));
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
    ${g.quotes.length ? `<h2 style="margin-top:28px">Как о них писали: ручная выборка</h2>${g.quotes.map((q) => `<div class="quote">${esc(q.text)}<div class="m">${esc(q.work)} · оценка: <span class="${q.pol === 'отрицательная' ? 'neg' : q.pol === 'положительная' ? 'pos' : ''}">${esc(q.pol)}</span>${q.stereotype ? ' · ' + esc(q.stereotype) : ''} · <a href="#book-${toH(q.pid.split('_p')[0])}-p${esc(q.pid.split('_p')[1])}">абзац</a></div></div>`).join('')}` : ''}
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
  const [works, groups, routes] = await Promise.all([get('works.json'), get('groups.json'), get('routes.json')]);
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
      ${r ? `<p class="small"><a href="#atlas" id="toAtlas">маршрут на карте</a> · ${r.method === 'auto' ? 'автомаршрут' : 'ручной'}: ${r.stops.map((s) => esc(s[1])).join(' → ')}</p>` : ''}
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
      return `<p id="p${n}" class="${type === 'h' ? 'h' : ''}${sib ? ' sib' : ''}"><span class="pid">${n}</span>${out}</p>`;
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
      data = {nodes: nodes.map((n) => ({...n, color: CATC[n.kind], val: Math.max(1, Math.sqrt(deg[n.id] || 1))})), links: d.links.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({...l, color: l.type === 'reuse' ? '#ff6b4f' : '#7f8b95'}))};
      legend = `<span><i style="background:${CATC.work}"></i>книги корпуса</span><span><i style="background:${CATC.authority}"></i>авторитеты вне корпуса</span><span><i style="background:#ff6b4f"></i>заимствование</span><span><i style="background:#7f8b95"></i>ссылка</span>`;
      document.getElementById('g3info').innerHTML = 'Чаще всего упоминают: Pallas, Atkinson, Castrén, Humboldt, Schrenck, Erman, Middendorff.';
    }
    document.getElementById('g3l').innerHTML = legend;
    document.getElementById('perCtl').hidden = mode !== 'g';
    if (!FG) {
      FG = ForceGraph3D()(el).backgroundColor('#0d1114').width(el.clientWidth).height(el.clientHeight)
        .nodeLabel((n) => esc(n.label || n.name || n.id)).nodeColor('color').nodeVal('val').nodeOpacity(.92).nodeRelSize(3)
        .linkWidth((l) => Math.min(4, Math.sqrt(l.weight || 1) / 2)).linkOpacity(.35).linkColor((l) => l.color || '#7f8b95')
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
    <p>Ручная выборка: ${ex('all')[0].n} описаний коренных народов из ${ex('all')[0].works} книг, страты «страна автора × период», доли взвешены, интервалы — бутстреп по книгам. Разметчик один (Claude), поэтому результаты предварительные.</p>
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

    <h2 id="analytics-rel" style="margin-top:36px">Отношения: ручная разметка</h2>
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
  const cols = ['#c4361c', '#2b6a9a', '#2f7d4f', '#8a5a00', '#6b5bb5', '#5b636b'];
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
  const pub = P.filter((p) => !['in_press', 'submitted'].includes(p.status)), inp = P.filter((p) => ['in_press', 'submitted'].includes(p.status));
  const item = (p) => `<li><b>${esc(p.authors)}</b> ${esc(p.title)} // ${esc(p.venue)}. ${esc(p.year || '')}${p.pages ? '. ' + esc(p.pages) : ''}${p.doi ? ` · <a href="https://doi.org/${esc(p.doi)}">doi:${esc(p.doi)}</a>` : ''}${p.url ? ` · <a href="${esc(p.url)}">текст</a>` : ''}${p.pdf ? ` · <a href="${esc(p.pdf)}">PDF</a>` : ''}${p.abstract ? `<br><span class="small">${esc(p.abstract)}</span>` : ''}${(p.groups || []).length || (p.works || []).length ? `<br><span class="small">${(p.groups || []).map((g) => `<a href="#people-${toH(g)}">${esc(g)}</a>`).concat((p.works || []).map((w) => `<a href="#book-${toH(w)}">${esc(w)}</a>`)).join(' · ')}</span>` : ''}${p.note ? `<br><span class="small mute">${esc(p.note)}</span>` : ''}</li>`;
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Публикации проекта</h1>
    ${P.length ? `<h2>Опубликовано</h2><ol>${pub.map(item).join('')}</ol>${inp.length ? `<h2>В печати</h2><ol>${inp.map(item).join('')}</ol>` : ''}` :
    `<div class="empty"><p>Список публикаций ещё не заполнен.</p><p class="small">Добавьте записи в файл <code>data/publications.json</code> — массив объектов с полями
    <code>authors, title, venue, year, pages, doi, url, pdf, abstract, groups, works, status</code> (<code>published</code>, <code>in_press</code> или <code>submitted</code>); образец — <code>data/publications.example.json</code>. Раздел построится автоматически.</p></div>`}
  </div></section>`;
}

// ---------------- метод ----------------
async function method() {
  const A = await get('analytics.json');
  const steps = [['Поиск корпуса', 'Опорная библиография (Cross, «In the Lands of the Romanovs»; национальные каталоги), затем поиск каждой книги и широкий многоязычный поиск по archive.org. Полнота по Cross: 76% европейских позиций.'],
    ['Очистка OCR', 'Колонтитулы, номера страниц, переносы, подписи к иллюстрациям, рекламные страницы и дисклеймеры Google Books; контроль качества по доле служебных слов.'],
    ['Сегментация и TEI', 'Главы и абзацы с постоянными ID; оглавления, указатели и аннотации глав не считаются текстом; TEI P5 для каждой книги.'],
    ['Этнонимы и места', 'Словарь из 207 правил на 10 языках: слово источника отдельно от народа, с уверенностью сопоставления; газеттир из 101 места с координатами GeoNames.'],
    ['Регион абзаца', 'По собственным топонимам абзаца, иначе перенос по главе с ограничением; анализ — по абзацам о Сибири, включая Степной край.'],
    ['Маршруты', 'Ручные — по паспорту источника с абзацами-доказательствами; автоматические — по порядку упоминаний.'],
    ['Отношения, дискурсы, коллокации, n-граммы, темы', 'Правила и статистика по всему корпусу; там, где правила ненадёжны, выводы делаются по ручной выборке.'],
    ['Ручная выборка и модели', '250 описаний и 100 предложений, стратификация по стране автора и периоду, веса страт, бутстреп по книгам, логистическая регрессия.']];
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Метод</h1>
    <p>Каждая цифра на сайте восходит к абзацу с постоянным ID. Ниже — шаги конвейера и проверки качества на случайных выборках.</p>
    <ol>${steps.map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join('')}</ol>
    <h2 style="margin-top:28px">Насколько можно доверять</h2>
    <div class="scroll"><table class="stack"><thead><tr><th>Проверка</th><th>Метрика</th><th class="n">n</th><th class="n">значение</th><th class="n">95% ДИ</th><th>Вывод</th></tr></thead><tbody>${A.quality.map((q) => `<tr><td>${esc(q.check)}</td><td>${esc(q.metric)}</td><td class="n">${esc(q.n)}</td><td class="n">${fmt(q.value, 2)}</td><td class="n">${q.lo != null ? fmt(q.lo, 2) + '–' + fmt(q.hi, 2) : '—'}</td><td>${esc(q.verdict)}</td></tr>`).join('')}</tbody></table></div>
    <h2 style="margin-top:28px">Ограничения</h2>
    <ul><li>Ручную выборку размечал один разметчик (модель Claude); нужен второй, человек, и расчёт α Криппендорфа.</li>
    <li>В OCR-книгах без распознанных глав регион «Сибирь» у абзацев без своих топонимов верен примерно в 77% случаев.</li>
    <li>Корпус открытый и неполный: нет Czaplicka, Noble, Labbé и других книг, которых нет на archive.org; это не корпус проекта РНФ.</li>
    <li>Ареалы народов на карте схематичны и служат только для ориентира.</li></ul>
    <h2 style="margin-top:28px">Данные</h2>
    <p>Все наборы данных лежат в папке <code>data/</code> этого сайта (JSON), тексты — в <code>texts/</code>. Полный конвейер с CSV-таблицами, TEI и ручной разметкой — в репозитории проекта.</p>
  </div></section>`;
}
route();
}
