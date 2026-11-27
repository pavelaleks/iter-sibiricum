/* Атлас на MapLibre GL: векторная подложка из собственного архива PMTiles (Natural Earth 10m), глобус или Меркатор,
   слои маршрутов, мест и ареалов с явной степенью неопределённости. Подписи — HTML поверх карты, шрифтом сайта,
   с отбором по важности. window.Atlas2.render(V, ctx) возвращает destroy(); роутер вызывает его при любом переходе. */
window.Atlas2 = (() => {
  const EN = !!(window.I18N && I18N.en);
  const T = (ru, en) => (EN ? en : ru);
  const nm = (s) => (EN && window.I18N.tr ? (I18N.tr(String(s ?? '')) || s) : s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
  const books = (n) => EN ? `${n} book${n === 1 ? '' : 's'}` : `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'книге' : 'книгах'}`;
  const ment = (n) => EN ? `${n} mention${n === 1 ? '' : 's'}` : `${n} ${plural(n, 'упоминание', 'упоминания', 'упоминаний')}`;
  const routesN = (n) => EN ? `${n} route${n === 1 ? '' : 's'}` : `${n} ${plural(n, 'маршрут', 'маршрута', 'маршрутов')}`;
  const PERK = ['P1 до 1855', 'P2 1856–1880', 'P3 1881–1904', 'P4 1905–1917', 'P5 1918–1930'];
  const PERV = ['--p1', '--p2', '--p3', '--p4', '--p5'];
  const OUTER = ['kazakh_steppe', 'mongolia', 'manchuria', 'urals'];
  const DEF = {lng: 96, lat: 58, z: 2.35};
  const GAP = 800;
  const UKM = [0, 60, 220]; // радиус неопределённости в километрах: точно / приблизительно / центр объекта
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const km = (a, b) => { const r = Math.PI / 180, d = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(d)); };
  // круг заданного радиуса в км: пикселей на км на широте 58° при zoom 0, дальше — ×2 на каждый уровень
  const PX0 = 1000 / (156543 * Math.cos(58 * Math.PI / 180));
  const kmR = (k) => ['interpolate', ['exponential', 2], ['zoom'], 0, k * PX0, 10, k * PX0 * 1024];
  const wrap = (lo) => ((lo + 540) % 360) - 180;
  const ulon = (lon) => (lon < -100 ? lon + 360 : lon); // Чукотка: 180…200, чтобы линии и подписи не прыгали через весь мир

  function palette(el) {
    const probe = document.createElement('i'); probe.style.display = 'none'; el.appendChild(probe);
    const c = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    const p = {sea: c('--sea'), land: c('--land'), land2: c('--land2'), river: c('--river'), line: c('--line'), ink: c('--ink'), mute: c('--mute'), paper: c('--paper'), acc: c('--acc'), bg: c('--bg'), per: PERV.map(c)};
    probe.remove(); return p;
  }
  const loadJS = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const loadCSS = (href) => new Promise((res) => { if (document.querySelector(`link[href="${href}"]`)) return res(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res; document.head.appendChild(l); });
  const hasGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } };
  function ellipse(lon, lat, rx, ry) {
    const pts = []; for (let a = 0; a <= 360; a += 10) { const t = a * Math.PI / 180; pts.push([lon + rx * Math.cos(t), lat + ry * Math.sin(t)]); }
    return {type: 'Polygon', coordinates: [pts]};
  }
  const graticule = () => {
    const f = [];
    for (let lo = -180; lo <= 180; lo += 10) { const c = []; for (let la = -80; la <= 80; la += 2) c.push([lo, la]); f.push({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: c}}); }
    for (let la = -80; la <= 80; la += 10) { const c = []; for (let lo = -180; lo <= 180; lo += 2) c.push([lo, la]); f.push({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: c}}); }
    return {type: 'FeatureCollection', features: f};
  };
  // GeoJSON по RFC 7946: долготы в [−180, 180], линия режется на антимеридиане
  function splitAM(line) {
    const out = []; let cur = [];
    line.forEach((p, i) => {
      const q = [wrap(p[0]), p[1]];
      if (i && Math.abs(q[0] - cur[cur.length - 1][0]) > 180) {
        const a = cur[cur.length - 1], east = a[0] > 0, bx = q[0] + (east ? 360 : -360), edge = east ? 180 : -180;
        const t = (edge - a[0]) / (bx - a[0]), la = a[1] + t * (q[1] - a[1]);
        cur.push([edge, la]); out.push(cur); cur = [[-edge, la]];
      }
      cur.push(q);
    });
    out.push(cur); return out.filter((l) => l.length > 1);
  }
  let tok = 0;

  async function render(V, ctx) {
    const my = ++tok; const alive = () => my === tok && V.isConnected;
    const {get, getRoutes, toH, PER, NAT} = ctx;
    V.innerHTML = `<div class="wrap loading">${T('Загрузка карты…', 'Loading the map…')}</div>`;
    const [works, routes, places, groups, bookgeo] = await Promise.all([get('works.json'), getRoutes(), get('places.json'), get('groups.json'), get('bookgeo.json'),
      loadCSS('assets/vendor/maplibre-gl.css?v=57'), loadJS('assets/vendor/maplibre-gl.js?v=57'), loadJS('assets/vendor/pmtiles.js?v=57')]);
    if (!alive()) return () => {};
    const W = Object.fromEntries(works.map((w) => [w.id, w])), RT = Object.fromEntries(routes.map((r) => [r.work, r]));
    const PL = Object.fromEntries(places.map((p) => [p.id, p]));
    const ind = groups.filter((g) => g.category === 'indigenous'), GR = Object.fromEntries(ind.map((g) => [g.id, g]));
    const nMan = routes.filter((r) => r.method === 'manual').length, nDraft = routes.filter((r) => r.method === 'draft').length;
    const nNF = routes.reduce((a, r) => a + (r.method === 'manual' ? r.stops.filter((s) => s[5] === 'not_found_in_text').length : 0), 0);
    const per = (w) => PERK.indexOf((W[w] || {}).period);
    const j0 = (w) => w.j0 || w.year, j1 = (w) => w.j1 || w.j0 || w.year;
    const Y0 = Math.min(...works.map(j0).filter(Boolean)), Y1 = Math.max(...works.map(j1).filter(Boolean));
    const NATS = [...new Set(works.map((w) => w.nat))], STAYS = [...new Set(works.map((w) => w.stay))];

    // ---------- состояние; всё, что влияет на вид, лежит в адресе; испорченные значения отбрасываются ----------
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const yv = (x, d) => { const n = parseInt(x, 10); return isFinite(n) ? Math.max(Y0, Math.min(Y1, n)) : d; };
    const st = {work: W[q.get('work')] ? q.get('work') : '', group: GR[q.get('g')] ? q.get('g') : '', period: PERK.includes(q.get('per')) ? q.get('per') : '',
      nat: NATS.includes(q.get('nat')) ? q.get('nat') : '', stay: STAYS.includes(q.get('stay')) ? q.get('stay') : '',
      y0: yv(q.get('y0'), Y0), y1: yv(q.get('y1'), Y1), lay: q.has('l') ? (q.get('l') || '').replace(/[^rpad]/g, '') : 'rpa', globe: q.get('p') !== 'flat'};
    if (st.y0 > st.y1) [st.y0, st.y1] = [st.y1, st.y0];
    if (st.work && st.group) st.group = '';
    let v0 = (q.get('v') || '').split(',').map(Number);
    v0 = v0.length === 3 && v0.every(isFinite) ? [wrap(v0[0]), Math.max(-80, Math.min(85, v0[1])), Math.max(.5, Math.min(9, v0[2]))] : null;
    const on = (k) => st.lay.includes(k);
    const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const mobQ = matchMedia('(max-width: 860px)').matches;

    V.innerHTML = `<section class="band a2"><div class="wrap">
      <h1>Атлас путешествий</h1>
      <p class="lede" data-noi18n>${EN ? `${nMan} routes reconstructed from the texts: for each stop there is a paragraph in which the author says they were there${nNF ? ` (${nNF} stops were not found in the text; they are shown as hollow circles)` : ''}. The line colour gives the period of the journey; a dashed line marks a stretch of more than ${GAP} km where the author names no places. The better a location is known, the sharper its circle.` : `${nMan} маршрутов, восстановленных по текстам: у каждой остановки есть абзац, где автор пишет, что был в этом месте${nNF ? ` (${nNF} ${plural(nNF, 'остановка', 'остановки', 'остановок')} в тексте не ${nNF === 1 ? 'найдена' : 'найдены'}, они показаны пустыми кружками)` : ''}. Цвет линии — период поездки; пунктир — перегон длиннее ${GAP} км, на котором автор не называет ни одного места. Чем точнее известно место, тем чётче его круг.`}</p>
      <div class="ctl a2-ctl">
        <label>Книга <select id="fWork"><option value="">все</option>${opt(works.slice().sort((a, b) => a.year - b.year).map((w) => [w.id, w.label + (RT[w.id] ? '' : ' (без маршрута)')]), st.work)}</select></label>
        <label>Народ <select id="fGr"><option value="">—</option>${opt(ind.map((g) => [g.id, g.name]), st.group)}</select></label>
        <span class="a2-lay" role="group" aria-label="${T('Слои', 'Layers')}"><button data-l="r">маршруты</button>${nDraft ? '<button data-l="d">черновики</button>' : ''}<button data-l="p">места</button><button data-l="a">ареалы</button></span>
      </div>
      <details class="a2-more"${st.period || st.nat || st.stay || st.y0 !== Y0 || st.y1 !== Y1 ? ' open' : ''}><summary>Фильтры: период, страна, годы</summary><div class="ctl a2-ctl">
        <label>Период <select id="fPer"><option value="">все</option>${opt(Object.entries(PER), st.period)}</select></label>
        <label>Страна автора <select id="fNat"><option value="">все</option>${opt(NATS.map((n) => [n, NAT[n] || n]), st.nat)}</select></label>
        <label>Тип поездки <select id="fStay"><option value="">все</option>${opt(STAYS.map((x) => [x, works.find((w) => w.stay === x).stay_ru]), st.stay)}</select></label>
        <div class="yr2"><span>Годы поездки</span><span class="dual"><i></i><input type="range" id="fY0" min="${Y0}" max="${Y1}" value="${st.y0}" aria-label="${T('Поездки не раньше', 'Journeys from')}"><input type="range" id="fY1" min="${Y0}" max="${Y1}" value="${st.y1}" aria-label="${T('Поездки не позже', 'Journeys until')}"></span><output id="oYr"></output></div>
      </div></details>
    </div>
    <div class="a2-stage" data-noi18n>
      <div class="a2-map" id="a2map"></div>
      <div class="a2-labels" aria-hidden="true"></div>
      <div class="tip" hidden></div>
      <p class="sr-only" aria-live="polite" id="a2status"></p>
      <div class="a2-tools" role="toolbar" aria-label="${T('Инструменты карты', 'Map tools')}">
        <button id="bIn" title="${T('Крупнее', 'Zoom in')}" aria-label="${T('Крупнее', 'Zoom in')}">+</button>
        <button id="bOut" title="${T('Мельче', 'Zoom out')}" aria-label="${T('Мельче', 'Zoom out')}">−</button>
        <button id="bHome" title="${T('Вся Сибирь', 'Whole of Siberia')}" aria-label="${T('Вся Сибирь', 'Whole of Siberia')}">⌂</button>
        <button id="bProj" aria-pressed="${!st.globe}" title="${T('Глобус или проекция Меркатора (сильно увеличивает север)', 'Globe or Mercator projection (strongly enlarges the north)')}">${st.globe ? T('Меркатор', 'Mercator') : T('глобус', 'globe')}</button>
        <button id="bMore" class="mob" aria-expanded="false" title="${T('Ещё', 'More')}" aria-label="${T('Ещё', 'More')}">⋯</button>
        <button id="bLink" class="x" title="${T('Скопировать ссылку на этот вид', 'Copy a link to this view')}">${T('ссылка', 'link')}</button>
        <button id="bPng" class="x" title="${T('Скачать изображение этого вида с легендой', 'Download an image of this view with the legend')}">PNG</button>
        <button id="bGeo" class="x" title="${T('Скачать показанные данные', 'Download the data shown')}">GeoJSON</button>
      </div>
      <aside class="a2-panel${mobQ ? ' shut' : ''}" id="a2panel"><button class="a2-grip" aria-expanded="${!mobQ}" aria-controls="a2body">${T('Маршруты и места', 'Routes and places')}</button><div id="a2body"></div></aside>
      <div class="a2-legend${mobQ ? ' shut' : ''}">
        <button class="a2-lgbtn" aria-expanded="${!mobQ}">${T('Легенда', 'Legend')}</button>
        <div class="a2-lg">
          <div class="a2-per"><b>${T('Цвет линии — период поездки', 'Line colour: period of the journey')}</b>${PERK.map((k, i) => `<span><i style="background:var(${PERV[i]})"></i>${esc(EN && I18N.tr ? I18N.tr(PER[k]) || PER[k] : PER[k])}</span>`).join('')}</div>
          <div class="a2-unc"><b>${T('Круг — место; чем больше, тем чаще упоминается', 'Circle: a place; the larger, the more often mentioned')}</b><span><i class="u0"></i>${T('координаты точные', 'exact coordinates')}</span><span><i class="u1"></i>${T('приблизительные', 'approximate')}</span><span><i class="u2"></i>${T('центр реки, озера, области', 'centre of a river, lake or region')}</span></div>
          <div class="a2-unc"><span><i class="gap"></i>${T('перегон без названных мест', 'stretch with no places named')}</span><span><i class="nf"></i>${T('остановка не найдена в тексте', 'stop not found in the text')}</span><span><i class="ar"></i>${T('ареал народа, схематично, около 1900 г.', 'area of a people, schematic, c. 1900')}</span></div>
          <div class="a2-src">${T('Прямые соединяют остановки и не повторяют дорогу. Подложка: Natural Earth.', 'Straight lines join stops; they do not trace the road. Base map: Natural Earth.')}</div>
        </div>
      </div>
    </div>
    <div class="wrap"><p class="small mute a2-note">${T('Новая версия атласа, на проверке. Прежняя карта:', 'New version of the atlas, under review. The previous map:')} <a href="#atlas">${T('атлас', 'atlas')}</a>.</p></div></section>`;

    const stage = V.querySelector('.a2-stage'), labEl = V.querySelector('.a2-labels'), tip = V.querySelector('.tip'), body = V.querySelector('#a2body');
    const panelEl = V.querySelector('#a2panel'), grip = V.querySelector('.a2-grip'), legEl = V.querySelector('.a2-legend'), status = V.querySelector('#a2status');
    let C = palette(stage);
    const cleanup = []; let map = null, urlT = 0, raf = 0, dead = false;
    const destroy = () => { if (dead) return; dead = true; if (my === tok) tok++; clearTimeout(urlT); cancelAnimationFrame(raf); cleanup.forEach((f) => { try { f(); } catch (e) {} }); try { map && map.remove(); } catch (e) {} };

    // без WebGL — объяснение и прежняя карта вместо падения страницы
    const noMap = (msg) => { stage.innerHTML = `<div class="a2-nogl"><p>${msg}</p><p><a href="#atlas">${T('Открыть прежнюю версию атласа', 'Open the previous version of the atlas')}</a></p></div>`; return destroy; };
    if (!hasGL()) return noMap(T('Этот браузер не поддерживает WebGL, поэтому новая карта не может отрисоваться.', 'This browser does not support WebGL, so the new map cannot be drawn.'));
    if (!window.__a2proto) { window.__a2proto = new pmtiles.Protocol(); maplibregl.addProtocol('pmtiles', window.__a2proto.tile); }
    const base = new URL('data/tiles/basemap.pmtiles', location.href).href;
    const mob = () => stage.clientWidth <= 860;
    const pad = () => {
      if (mob()) return {top: legEl.classList.contains('shut') ? 54 : Math.min(stage.clientHeight * .45, legEl.offsetHeight + 20), bottom: panelEl.classList.contains('shut') ? 54 : Math.round(stage.clientHeight * .46) + 10, left: 16, right: 60};
      return {top: 24, bottom: legEl.classList.contains('shut') ? 54 : Math.min(170, legEl.offsetHeight + 24), left: 64, right: Math.min(372, stage.clientWidth * .34 + 12) + 12};
    };
    const homeZ = () => { const p = pad(), w = stage.clientWidth - p.left - p.right, h = stage.clientHeight - p.top - p.bottom; return Math.max(.6, 2.3 + Math.log2(Math.max(.05, Math.min(w / 980, h / 600)))); };
    try {
      map = new maplibregl.Map({
        container: 'a2map', attributionControl: false, dragRotate: false, pitchWithRotate: false, maxPitch: 0, renderWorldCopies: true, cooperativeGestures: true,
        locale: {'CooperativeGesturesHandler.WindowsHelpText': T('Чтобы менять масштаб, прокручивайте с нажатой Ctrl', 'Use Ctrl + scroll to zoom the map'),
          'CooperativeGesturesHandler.MacHelpText': T('Чтобы менять масштаб, прокручивайте с нажатой ⌘', 'Use ⌘ + scroll to zoom the map'),
          'CooperativeGesturesHandler.MobileHelpText': T('Двигайте карту двумя пальцами', 'Use two fingers to move the map')},
        center: v0 ? [v0[0], v0[1]] : [DEF.lng, DEF.lat], zoom: v0 ? v0[2] : 1.5, minZoom: .5, maxZoom: 9,
        style: {version: 8, projection: {type: st.globe ? 'globe' : 'mercator'}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': C.sea}}]},
      });
    } catch (e) { return noMap(`${T('Карту не удалось создать', 'The map could not be created')}: ${esc(e.message)}.`); }
    map.touchZoomRotate.disableRotation();
    const ro = new ResizeObserver(() => { if (!dead) { map.resize(); map.setPadding(pad()); place(); } }); ro.observe(stage); cleanup.push(() => ro.disconnect());

    // ---------- данные слоёв ----------
    const defaultF = () => !st.period && !st.nat && !st.stay && st.y0 === Y0 && st.y1 === Y1;
    const filt = (w) => !!w && (!st.period || w.period === st.period) && (!st.nat || w.nat === st.nat) && (!st.stay || w.stay === st.stay) && j0(w) <= st.y1 && j1(w) >= st.y0;
    const coordQ = (src) => /^(geonames|wikidata)/.test(src || '') ? 0 : /centroid|area/.test(src || '') ? 2 : 1;
    const stopQ = (s) => { const p = PL[s[0]], cs = String(s[8] || ''); if (p && coordQ(p.coord) === 2) return 2; if (cs.startsWith('estimate') || cs.endsWith('_ctx')) return 1; if (/^(geonames|wikidata)/.test(cs)) return 0; return p ? coordQ(p.coord) : 0; };
    const gWorks = () => st.group ? Object.fromEntries(GR[st.group].by_work || GR[st.group].authors.map((a) => [a[0], a[1]])) : null;
    // нормализованные координаты остановок: одна и та же долгота у линии, точки и подписи
    const NC = {};
    const normStops = (r) => NC[r.work] ||= (() => { let prev = null; return r.stops.map((s) => { if (s[2] == null || s[3] == null) return null; let lo = ulon(s[2]); if (prev != null) { while (lo - prev > 180) lo -= 360; while (prev - lo > 180) lo += 360; } prev = lo; return [lo, s[3]]; }); })();
    function routeLines(forExport) {
      const F = [], GW = gWorks();
      for (const r of routes) {
        if (r.method !== 'manual' || !filt(W[r.work])) continue;
        if (forExport && st.work && r.work !== st.work) continue;
        const N = normStops(r), segs = []; let cur = [], jj = null;
        r.stops.forEach((s, i) => {
          // разрыв: смена поездки или остановка без координат; условный центр реки или области вершиной не служит — линия идёт мимо
          if (!N[i] || (s[6] || 1) !== jj) { if (cur.length > 1) segs.push(cur); cur = []; }
          jj = s[6] || 1; if (!N[i] || stopQ(s) === 2) return; cur.push(N[i]);
        });
        if (cur.length > 1) segs.push(cur);
        const near = [], far = [];
        for (const sg of segs) { let run = [sg[0]]; for (let i = 1; i < sg.length; i++) { if (km(sg[i - 1], sg[i]) > GAP) { if (run.length > 1) near.push(run); far.push([sg[i - 1], sg[i]]); run = [sg[i]]; } else run.push(sg[i]); } if (run.length > 1) near.push(run); }
        const pr = {work: r.work, per: per(r.work), focus: r.work === st.work ? 1 : 0, grp: GW ? (GW[r.work] ? 1 : 0) : 1};
        if (near.length) F.push({type: 'Feature', properties: {...pr, gap: 0}, geometry: {type: 'MultiLineString', coordinates: near}});
        if (far.length) F.push({type: 'Feature', properties: {...pr, gap: 1}, geometry: {type: 'MultiLineString', coordinates: far}});
      }
      return {type: 'FeatureCollection', features: F};
    }
    function stopPoints() {
      const F = []; const r = RT[st.work];
      if (r) { const N = normStops(r); r.stops.forEach((s, i) => { if (N[i]) F.push({type: 'Feature', properties: {i: i + 1, k: i, name: s[1], flag: s[5], q: r.method === 'draft' ? 3 : stopQ(s), per: per(r.work)}, geometry: {type: 'Point', coordinates: N[i]}}); }); }
      if (on('d')) for (const d of routes) {
        if (d.method !== 'draft' || d.work === st.work || !filt(W[d.work])) continue;
        d.stops.forEach((s, i) => { if (s[2] != null) F.push({type: 'Feature', properties: {i: i + 1, k: 10000 + F.length, name: s[1], work: d.work, flag: s[5], q: 3, per: per(d.work)}, geometry: {type: 'Point', coordinates: [ulon(s[2]), s[3]]}}); });
      }
      return {type: 'FeatureCollection', features: F};
    }
    // значение места: упоминания в книгах, прошедших фильтр; для народа — абзацы, где место названо рядом с ним (по всему корпусу)
    let PV = {};
    function placeVals() {
      const R = {};
      if (st.work) { for (const [id, n] of bookgeo[st.work] || []) R[id] = n; return R; }
      if (st.group) { const g = GR[st.group]; for (const p of places) { const x = p.groups.find((y) => y[0] === g.name); if (x) R[p.id] = x[1]; } return R; }
      if (defaultF()) { for (const p of places) R[p.id] = p.mentions; return R; }
      for (const w of works) if (filt(w)) for (const [id, n] of bookgeo[w.id] || []) R[id] = (R[id] || 0) + n;
      return R;
    }
    function placePoints() {
      PV = placeVals(); const F = [];
      for (const [id, v] of Object.entries(PV)) {
        const p = PL[id]; if (!p || !(v > 0)) continue; if (!st.work && !(p.sib || OUTER.includes(p.region))) continue;
        F.push({type: 'Feature', properties: {id, v, q: coordQ(p.coord), book: st.work ? 1 : 0}, geometry: {type: 'Point', coordinates: [ulon(p.lon), p.lat]}});
      }
      const mx = Math.max(1, ...F.map((f) => f.properties.v)); F.forEach((f) => { f.properties.r = Math.sqrt(f.properties.v / mx); });
      F.sort((a, b) => b.properties.v - a.properties.v); return {type: 'FeatureCollection', features: F};
    }
    function areaPolys() {
      const F = []; ind.forEach((g) => (g.areas || []).forEach((a) => F.push({type: 'Feature', properties: {g: g.id, hi: g.id === st.group ? 1 : 0}, geometry: ellipse(...a)})));
      return {type: 'FeatureCollection', features: F};
    }

    // ---------- стиль; все выражения цвета собираются заново при смене темы ----------
    const PC = () => ['match', ['get', 'per'], 0, C.per[0], 1, C.per[1], 2, C.per[2], 3, C.per[3], 4, C.per[4], C.acc];
    const RC = () => st.work ? ['case', ['==', ['get', 'focus'], 1], PC(), C.land2] : st.group ? ['case', ['==', ['get', 'grp'], 1], PC(), C.land2] : PC();
    const ROP = (a) => ['case', ['boolean', ['feature-state', 'hover'], false], 1, st.work ? ['case', ['==', ['get', 'focus'], 1], 1, .6] : st.group ? ['case', ['==', ['get', 'grp'], 1], .9, .5] : a];
    const RW = (b) => ['interpolate', ['linear'], ['zoom'], 2, ['case', ['==', ['get', 'focus'], 1], b * 2.2, ['boolean', ['feature-state', 'hover'], false], b * 2.2, b], 6, ['case', ['==', ['get', 'focus'], 1], b * 2.8, ['boolean', ['feature-state', 'hover'], false], b * 2.4, b * 1.5]];
    function hatch() {
      const n = 8, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
      g.strokeStyle = C.mute; g.globalAlpha = .6; g.lineWidth = 1; g.beginPath(); g.moveTo(0, n); g.lineTo(n, 0); g.moveTo(-1, 1); g.lineTo(1, -1); g.moveTo(n - 1, n + 1); g.lineTo(n + 1, n - 1); g.stroke();
      return g.getImageData(0, 0, n, n);
    }
    const paint = () => ({
      'bg': {'background-color': C.sea},
      'grat': {'line-color': C.line, 'line-width': .6, 'line-opacity': .8},
      'land': {'fill-color': C.land},
      'coast': {'line-color': C.land2, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, .4, 7, 1]},
      'lakes': {'fill-color': C.sea, 'fill-outline-color': C.river},
      'rivers': {'line-color': C.river, 'line-opacity': .7, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, ['max', .35, ['-', 1.5, ['*', .16, ['coalesce', ['get', 'scalerank'], 9]]]], 7, ['max', .8, ['-', 3.4, ['*', .3, ['coalesce', ['get', 'scalerank'], 9]]]]]},
      // ареал — штриховка: не путается с водой; граница расселения не была линией
      'area-fill': {'fill-pattern': 'hatch', 'fill-opacity': ['case', ['==', ['get', 'hi'], 1], 1, ['boolean', ['feature-state', 'hover'], false], .9, .45]},
      'area-edge': {'line-color': C.mute, 'line-opacity': ['case', ['==', ['get', 'hi'], 1], .8, .3], 'line-width': ['case', ['==', ['get', 'hi'], 1], 1.4, .8], 'line-dasharray': [3, 2]},
      'routes-case': {'line-color': C.paper, 'line-opacity': .9, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 6, 6, 8]},
      'routes-gap': {'line-color': RC(), 'line-dasharray': [1.5, 2.5], 'line-width': RW(.8), 'line-opacity': ROP(.5)},
      'routes': {'line-color': RC(), 'line-width': RW(1.3), 'line-opacity': ROP(.78)},
      'dstops': {'circle-color': PC(), 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 7, 16], 'circle-blur': 1, 'circle-opacity': .55},
      // неопределённость координат — ореол постоянного радиуса в километрах, не связанный с числом упоминаний
      'places-unc': {'circle-color': C.ink, 'circle-blur': .85, 'circle-opacity': ['case', ['==', ['get', 'q'], 2], .1, .13], 'circle-radius': ['case', ['==', ['get', 'q'], 2], kmR(UKM[2]), kmR(UKM[1])]},
      'places': {'circle-color': C.ink, 'circle-opacity': ['case', ['==', ['get', 'q'], 0], .28, .12],
        'circle-stroke-color': C.ink, 'circle-stroke-opacity': ['case', ['==', ['get', 'q'], 0], .85, .35],
        'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.2, ['==', ['get', 'q'], 0], 1.1, .6],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['+', 1.8, ['*', 12, ['get', 'r']]], 7, ['+', 3, ['*', 22, ['get', 'r']]]]},
      'stops-unc': {'circle-color': PC(), 'circle-blur': .85, 'circle-opacity': .25, 'circle-radius': ['case', ['==', ['get', 'q'], 2], kmR(UKM[2]), kmR(UKM[1])]},
      'stops': {'circle-color': ['case', ['==', ['get', 'flag'], 'not_found_in_text'], C.paper, PC()], 'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 6.5, 4.6],
        'circle-stroke-color': ['case', ['==', ['get', 'flag'], 'not_found_in_text'], PC(), C.paper], 'circle-stroke-width': ['case', ['==', ['get', 'flag'], 'not_found_in_text'], 1.8, 1.2]},
    });
    function addLayers() {
      map.addImage('hatch', hatch(), {pixelRatio: 1});
      map.addSource('base', {type: 'vector', url: 'pmtiles://' + base, attribution: 'Natural Earth'});
      map.addSource('grat', {type: 'geojson', data: graticule()});
      map.addSource('areas', {type: 'geojson', data: areaPolys(), generateId: true});
      map.addSource('routes', {type: 'geojson', data: routeLines(), promoteId: 'work'});
      map.addSource('stops', {type: 'geojson', data: stopPoints(), promoteId: 'k'});
      map.addSource('places', {type: 'geojson', data: placePoints(), promoteId: 'id'});
      const P = paint();
      const L = [
        ['grat', 'line', 'grat'], ['land', 'fill', 'base', {'source-layer': 'land'}], ['coast', 'line', 'base', {'source-layer': 'land'}],
        ['lakes', 'fill', 'base', {'source-layer': 'lakes', filter: ['<=', ['coalesce', ['get', 'scalerank'], 9], ['+', 2, ['*', 1.2, ['zoom']]]]}],
        ['rivers', 'line', 'base', {'source-layer': 'rivers', filter: ['<=', ['coalesce', ['get', 'scalerank'], 9], ['+', 3.2, ['*', .9, ['zoom']]]], layout: {'line-cap': 'round', 'line-join': 'round'}}],
        ['area-fill', 'fill', 'areas'], ['area-edge', 'line', 'areas'],
        ['places-unc', 'circle', 'places', {filter: ['>=', ['get', 'q'], 1]}],
        ['routes-case', 'line', 'routes', {filter: ['all', ['==', ['get', 'focus'], 1], ['==', ['get', 'gap'], 0]], layout: {'line-cap': 'round', 'line-join': 'round'}}],
        ['routes-gap', 'line', 'routes', {filter: ['==', ['get', 'gap'], 1]}],
        ['routes', 'line', 'routes', {filter: ['==', ['get', 'gap'], 0], layout: {'line-cap': 'round', 'line-join': 'round'}}],
        ['places', 'circle', 'places'],
        ['dstops', 'circle', 'stops', {filter: ['==', ['get', 'q'], 3]}],
        ['stops-unc', 'circle', 'stops', {filter: ['all', ['>=', ['get', 'q'], 1], ['<', ['get', 'q'], 3]]}],
        ['stops', 'circle', 'stops', {filter: ['<', ['get', 'q'], 3]}],
      ];
      for (const [id, type, source, extra = {}] of L) map.addLayer({id, type, source, paint: P[id], ...extra});
    }
    function restyle() {
      if (dead) return; C = palette(stage); if (!map.getLayer('land')) return;
      if (map.hasImage('hatch')) map.updateImage('hatch', hatch());
      for (const [id, pp] of Object.entries(paint())) if (map.getLayer(id)) for (const [k, v] of Object.entries(pp)) map.setPaintProperty(id, k, v);
      labels();
    }
    function vis() {
      const s = (ids, v) => ids.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none'));
      s(['routes', 'routes-gap', 'routes-case'], on('r')); s(['area-fill', 'area-edge'], on('a')); s(['places', 'places-unc'], on('p') || !!st.work);
    }

    // ---------- подписи ----------
    function labelCands() {
      const out = [];
      if (st.work && RT[st.work]) {
        const r = RT[st.work], N = normStops(r);
        r.stops.forEach((s, i) => { if (N[i]) out.push({ll: N[i], t: r.method === 'draft' ? `${i + 1}` : nm(s[1]), w: 1000 - i, cls: r.method === 'draft' ? 'num' : stopQ(s) === 2 ? 'reg' : 'stop', dx: r.method === 'draft' ? 0 : 8}); });
      }
      if (on('p') || st.work) placePoints().features.slice(0, 70).forEach((f, i) => { const p = PL[f.properties.id]; out.push({ll: f.geometry.coordinates, t: nm(p.name), w: 200 - i, cls: f.properties.q === 2 ? 'reg' : 'pl', dx: 6 + 12 * f.properties.r}); });
      return out;
    }
    let cands = [];
    function labels() { cands = labelCands(); place(); }
    const rectOf = (el) => { if (!el || !el.offsetWidth) return null; const a = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return [a.left - s.left - 4, a.top - s.top - 4, a.right - s.left + 4, a.bottom - s.top + 4]; };
    function place() {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
        if (dead) return;
        const Wd = stage.clientWidth, Hd = stage.clientHeight, ctr = map.getCenter(), placed = [rectOf(panelEl), rectOf(legEl), rectOf(V.querySelector('.a2-tools'))].filter(Boolean);
        const occl = (ll) => { if (!st.globe || map.getZoom() > 5.5) return false; const r = Math.PI / 180; return Math.sin(ctr.lat * r) * Math.sin(ll[1] * r) + Math.cos(ctr.lat * r) * Math.cos(ll[1] * r) * Math.cos((ll[0] - ctr.lng) * r) < .3; };
        const html = []; let n = 0;
        for (const c of cands.slice().sort((a, b) => b.w - a.w)) {
          if (occl(c.ll)) continue;
          const p = map.project(c.ll); if (p.x < 4 || p.y < 4 || p.x > Wd - 4 || p.y > Hd - 4) continue;
          const wch = c.cls === 'num' ? 14 : 6.7 * String(c.t).length + 6, h = c.cls === 'num' ? 14 : 15;
          const x = c.cls === 'num' ? p.x - wch / 2 : p.x + c.dx, y = p.y - h / 2, box = [x - 2, y - 1, x + wch + 2, y + h + 1];
          if (box[2] > Wd - 2) continue;
          if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
          placed.push(box); html.push(`<span class="${c.cls}" style="transform:translate(${Math.round(x)}px,${Math.round(y)}px)">${esc(c.t)}</span>`);
          if (++n > 70) break;
        }
        labEl.innerHTML = html.join('');
      });
    }

    // ---------- подсказки и панель ----------
    const show = (pt, html) => { tip.innerHTML = html; tip.hidden = false; const Wd = stage.clientWidth, Hd = stage.clientHeight; let x = pt.x + 14, y = pt.y + 14; if (x + tip.offsetWidth > Wd) x = pt.x - tip.offsetWidth - 10; if (y + tip.offsetHeight > Hd) y = pt.y - tip.offsetHeight - 10; tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px'; };
    const hide = () => { tip.hidden = true; };
    const stTxt = (r) => r.status === 'verified' ? T('маршрут подтверждён экспертом', 'route confirmed by an expert') : r.status === 'checked' ? T('маршрут проверен по тексту', 'route checked against the text') : r.method === 'draft' ? T('черновик: порядок и посещения не проверены', 'draft: order and visits not yet checked') : T('маршрут восстановлен по тексту', 'route reconstructed from the text');
    const qTxt = (q) => [T('координаты по справочнику (GeoNames, Wikidata)', 'coordinates from a gazetteer (GeoNames, Wikidata)'), T('координаты приблизительные', 'approximate coordinates'), T('точка — условный центр реки, озера или области', 'the point is a nominal centre of a river, lake or region'), T('черновик: посещение выведено из текста', 'draft: visit inferred from the text')][q];
    const jour = (w) => `${j0(w) || '?'}${j1(w) && j1(w) !== j0(w) ? '–' + j1(w) : ''}`;
    const pnum = (pid) => +String(pid || '').split('_p')[1] || 0;
    const quote = (s) => { const t = String(s[7] || '').trim(); return t ? `<i class="q">«${esc(t.length > 180 ? t.slice(0, 177).replace(/\s+\S*$/, '') + '…' : t)}»</i>` : ''; };
    const visRoutes = () => routes.filter((r) => r.method === 'manual' && filt(W[r.work]));
    function panel() {
      let h = '';
      const vr = visRoutes();
      if (st.group) {
        const g = GR[st.group], GW = gWorks(), rows = Object.entries(GW).filter(([w]) => W[w] && filt(W[w])).sort((a, b) => b[1] - a[1]);
        h += `<h3><a href="#people-${toH(g.id)}">${esc(EN ? g.name_en : g.name)}</a></h3><p class="small mute">${T(`Описывают ${rows.length} ${plural(rows.length, 'книга', 'книги', 'книг')} из выборки; число — абзацы с упоминанием. Маршруты этих книг выделены цветом. Круги — места, названные в одних абзацах с этим народом (по всему корпусу). Штриховка — схематичный ареал около 1900 г.`, `${rows.length} book${rows.length === 1 ? '' : 's'} in the selection describe this people; the number is paragraphs that mention them. Routes of these books are coloured. Circles are places named in the same paragraphs as this people (whole corpus). Hatching is a schematic area, c. 1900.`)}</p>
          <ul class="a2-list">${rows.slice(0, 50).map(([w, n]) => `<li><button data-work="${esc(w)}">${RT[w] ? `<i style="background:var(${PERV[per(w)]})"></i>` : '<i class="none"></i>'}<span>${esc(W[w].label)}</span><span class="mute">${n}</span></button></li>`).join('')}</ul>
          <p class="small"><a href="#" data-clear="group">${T('← без народа', '← no people selected')}</a></p>`;
        body.innerHTML = h; return;
      }
      if (st.work) {
        const w = W[st.work], r = RT[st.work];
        h += `<h3><a href="#book-${toH(w.id)}">${esc(w.label)}</a></h3><p class="small mute">${esc(w.author)} · ${esc(nm(w.nat_ru))} · ${esc(nm(w.stay_ru))} · ${T('поездка', 'journey')} ${jour(w)}</p>`;
        h += r ? `<p><span class="status${r.method === 'manual' ? ' rec' : ''}">${stTxt(r)}</span></p>` : `<p class="small">${T('Маршрут по этой книге не восстановлен. На карте — места, упомянутые в книге; круг тем больше, чем чаще упоминание.', 'No route has been reconstructed for this book. The map shows the places it mentions; the larger the circle, the more often mentioned.')}</p>`;
        if (r && r.summary && !EN) h += `<p class="small">${esc(r.summary)}</p>`;
        if (r) h += `<ol class="small a2-stops">${r.stops.map((s, i) => `<li><button class="lnk" data-stop="${i}"${s[2] == null ? ' disabled' : ''}>${esc(nm(s[1]))}</button>${s[4] ? ` <a class="mute" href="#book-${toH(st.work)}-p${pnum(s[4])}">${T('абзац', 'para.')} ${pnum(s[4])}</a>` : ''}${s[2] == null ? ` <span class="mute">${T('без координат', 'no coordinates')}</span>` : stopQ(s) === 2 ? ` <span class="mute">${T('в районе объекта', 'somewhere in the area')}</span>` : stopQ(s) ? ' <span class="mute">≈</span>' : ''}${s[5] === 'not_found_in_text' ? ` <span class="mute">${T('в тексте не найдено', 'not found in the text')}</span>` : ''}</li>`).join('')}</ol>`;
        h += `<p class="small"><a href="#" data-clear="work">${T('← все маршруты', '← all routes')}</a></p>`;
        body.innerHTML = h; return;
      }
      if (!vr.length) { body.innerHTML = `<h3>${T('Ничего не найдено', 'Nothing found')}</h3><p class="small">${T('Ни одна поездка не подходит под выбранные условия.', 'No journey matches the selected filters.')}</p><p><button class="lnk" data-reset="1">${T('Сбросить фильтры', 'Reset filters')}</button></p>`; return; }
      vr.sort((a, b) => j0(W[a.work]) - j0(W[b.work]));
      h += `<h3>${T('Маршруты на карте', 'Routes on the map')}: ${vr.length}</h3><ul class="a2-list">${vr.map((r) => { const w = W[r.work]; return `<li><button data-work="${esc(r.work)}"><i style="background:var(${PERV[per(r.work)]})"></i><span>${esc(w.label)}</span><span class="mute">${jour(w)}</span></button></li>`; }).join('')}</ul>`;
      const P = placePoints().features.slice(0, 20);
      if (P.length) h += `<h4>${T('Чаще всего упоминаемые места', 'Most mentioned places')}${defaultF() ? '' : T(' (в выборке)', ' (in the selection)')}</h4><ul class="a2-bars">${P.map((f) => `<li><button class="lnk" data-place="${esc(f.properties.id)}">${esc(nm(PL[f.properties.id].name))}</button><span>${f.properties.v}</span></li>`).join('')}</ul>`;
      body.innerHTML = h;
    }
    function placePanel(id) {
      const p = PL[id]; if (!p) return;
      const bar = (rows) => `<ul class="a2-bars">${rows.map(([t, n, href]) => `<li>${href ? `<a href="${href}">${esc(t)}</a>` : esc(t)}<span>${n}</span></li>`).join('')}</ul>`;
      const tw = p.top_works.filter(([w]) => W[w] && filt(W[w]));
      body.innerHTML = `<h3 tabindex="-1">${esc(nm(p.name))}</h3><p class="small mute">${ment(p.mentions)} ${T('в', 'in')} ${books(p.works)} ${T('по всему корпусу', 'across the corpus')}${!defaultF() && !st.work && !st.group ? `; ${T('в выборке', 'in the selection')}: ${PV[id] || 0}` : ''} · ${qTxt(coordQ(p.coord))}</p>
        <h4>${T('Чаще всего упоминают', 'Mentioned most often in')}</h4>${bar(tw.slice(0, 8).map(([w, n]) => [W[w].label, n, '#book-' + toH(w)]))}
        ${p.groups.length ? `<h4>${T('Народы в тех же абзацах', 'Peoples in the same paragraphs')}</h4>${bar(p.groups.slice(0, 8).map(([g, n]) => [nm(g), n]))}` : ''}
        <p class="small"><a href="#" data-back="1">${T('← назад', '← back')}</a></p>`;
      openPanel(); body.querySelector('h3').focus({preventScroll: true});
    }
    const openPanel = () => { if (panelEl.classList.contains('shut')) { panelEl.classList.remove('shut'); grip.setAttribute('aria-expanded', 'true'); map.setPadding(pad()); } };
    grip.addEventListener('click', () => { const o = panelEl.classList.toggle('shut'); grip.setAttribute('aria-expanded', String(!o)); map.setPadding(pad()); place(); });
    V.querySelector('.a2-lgbtn').addEventListener('click', (e) => { const o = legEl.classList.toggle('shut'); e.currentTarget.setAttribute('aria-expanded', String(!o)); map.setPadding(pad()); place(); });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-work]'); if (b) { st.group = ''; V.querySelector('#fGr').value = ''; setWork(b.dataset.work); return; }
      const sp = e.target.closest('[data-stop]'); if (sp) { const r = RT[st.work], i = +sp.dataset.stop, N = normStops(r); if (N[i]) { map.easeTo({center: N[i], zoom: Math.max(map.getZoom(), 5), duration: reduce() ? 0 : 600}); hl('stops', i); setTimeout(() => !dead && show(map.project(N[i]), stopTip(r.stops[i], stopQ(r.stops[i]))), reduce() ? 30 : 650); } return; }
      const pl = e.target.closest('[data-place]'); if (pl) { const p = PL[pl.dataset.place]; placePanel(p.id); map.easeTo({center: [ulon(p.lon), p.lat], duration: reduce() ? 0 : 600}); hl('places', p.id); return; }
      const c = e.target.closest('[data-clear]'); if (c) { e.preventDefault(); if (c.dataset.clear === 'work') setWork(''); else { st.group = ''; V.querySelector('#fGr').value = ''; refresh(); } return; }
      if (e.target.closest('[data-reset]')) { Object.assign(st, {period: '', nat: '', stay: '', y0: Y0, y1: Y1}); ['fPer', 'fNat', 'fStay'].forEach((id) => (V.querySelector('#' + id).value = '')); V.querySelector('#fY0').value = Y0; V.querySelector('#fY1').value = Y1; refresh(); return; }
      if (e.target.closest('[data-back]')) { e.preventDefault(); panel(); }
    });
    // связь списка и карты: наведение на строку подсвечивает маршрут
    body.addEventListener('mouseover', (e) => { const b = e.target.closest('[data-work]'); hl('routes', b ? b.dataset.work : null); });
    body.addEventListener('mouseleave', () => hl('routes', null));

    // ---------- обновление ----------
    function url() {
      clearTimeout(urlT); urlT = setTimeout(() => {
        if (dead || !stage.isConnected || !location.hash.startsWith('#atlas2')) return;
        const c = map.getCenter(), p = new URLSearchParams();
        if (st.work) p.set('work', st.work); if (st.group) p.set('g', st.group); if (st.period) p.set('per', st.period); if (st.nat) p.set('nat', st.nat); if (st.stay) p.set('stay', st.stay);
        if (st.y0 !== Y0) p.set('y0', st.y0); if (st.y1 !== Y1) p.set('y1', st.y1); if (st.lay !== 'rpa') p.set('l', st.lay); if (!st.globe) p.set('p', 'flat');
        p.set('v', [wrap(c.lng).toFixed(2), c.lat.toFixed(2), map.getZoom().toFixed(2)].join(','));
        history.replaceState(null, '', '#atlas2?' + p.toString().replace(/%2C/g, ','));
      }, 300);
    }
    function refresh() {
      if (dead) return;
      const n = visRoutes().length;
      V.querySelectorAll('.a2-lay button').forEach((b) => { b.classList.toggle('on', on(b.dataset.l)); b.setAttribute('aria-pressed', String(on(b.dataset.l))); });
      V.querySelector('#oYr').textContent = `${st.y0}–${st.y1}`;
      ['fY0', 'fY1'].forEach((id) => { const el = V.querySelector('#' + id); el.setAttribute('aria-valuetext', T(`${el.value} год`, `${el.value}`)); });
      const bar = V.querySelector('.dual i'), f = (y) => (y - Y0) / (Y1 - Y0); bar.style.left = `calc(9px + (100% - 18px) * ${f(st.y0)})`; bar.style.width = `calc((100% - 18px) * ${f(st.y1) - f(st.y0)})`;
      status.textContent = st.work ? W[st.work].label : st.group ? (EN ? GR[st.group].name_en : GR[st.group].name) : `${T('Показано', 'Showing')} ${routesN(n)}`;
      panel();
      if (!map.getSource('routes')) return;
      map.getSource('routes').setData(routeLines()); map.getSource('stops').setData(stopPoints()); map.getSource('places').setData(placePoints()); map.getSource('areas').setData(areaPolys());
      for (const [id, pp] of Object.entries(paint())) if (/^routes/.test(id)) for (const [k, v] of Object.entries(pp)) map.setPaintProperty(id, k, v);
      vis(); labels(); url();
    }
    const fitTo = (coords, mz = 6) => {
      if (!coords.length) return; const lo = coords.map((c) => c[0]), la = coords.map((c) => c[1]);
      map.setPadding(pad()); map.fitBounds([[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]], {padding: 20, maxZoom: mz, duration: reduce() ? 0 : 900});
    };
    const home = (dur) => { map.setPadding(pad()); const o = {center: [DEF.lng, DEF.lat], zoom: homeZ()}; dur && !reduce() ? map.flyTo({...o, duration: dur}) : map.jumpTo(o); };
    const fitWork = (w) => { const r = RT[w]; fitTo(r ? normStops(r).filter(Boolean) : (bookgeo[w] || []).map(([id]) => PL[id]).filter((p) => p && (p.sib || OUTER.includes(p.region))).map((p) => [ulon(p.lon), p.lat])); };
    const fitGroup = (g) => { const a = GR[g].areas || []; if (a.length) fitTo(a.flatMap(([lo, la, rx, ry]) => [[lo - rx * 1.8, la - ry * 1.8], [lo + rx * 1.8, la + ry * 1.8]]), 4); };
    function setWork(w) { st.work = w; V.querySelector('#fWork').value = w; refresh(); if (w) { openPanel(); fitWork(w); } }
    function setGroup(g) { st.group = g; V.querySelector('#fGr').value = g; if (g && st.work) { st.work = ''; V.querySelector('#fWork').value = ''; } refresh(); if (g) { openPanel(); fitGroup(g); } }

    // наведение и щелчок выбирают один и тот же объект: ближайший к курсору, точки важнее линий
    const HOV = {};
    const hl = (src, id) => { if (dead || !map.getSource(src)) return; if (HOV[src] != null && HOV[src] !== id) map.setFeatureState({source: src, id: HOV[src]}, {hover: false}); HOV[src] = id; if (id != null) map.setFeatureState({source: src, id}, {hover: true}); };
    const stopTip = (s, q) => `<b>${esc(nm(s[1]))}</b>${s[5] === 'not_found_in_text' ? T('в тексте не найдено', 'not found in the text') : s[4] ? T('абзац ', 'paragraph ') + pnum(s[4]) + T(' — щёлкните, чтобы открыть', ' — click to open') : ''}<br><span class="mute">${qTxt(q)}</span>${quote(s)}`;
    const routeTip = (f) => { const w = W[f.properties.work] || {}; return `<b>${esc(w.label)}</b>${esc(w.author || '')}<br>${T('поездка', 'journey')} ${jour(w)} · ${esc(nm(w.stay_ru || ''))}<br>${stTxt(RT[w.id] || {})}${f.properties.gap ? '<br><span class="mute">' + T('пунктир: между этими остановками автор не называет мест', 'dashed: the author names no places between these stops') + '</span>' : ''}`; };
    const placeTip = (f) => { const p = PL[f.properties.id]; return `<b>${esc(nm(p.name))}</b>${f.properties.book ? ment(f.properties.v) + ' ' + T('в этой книге', 'in this book') : st.group ? T(`${f.properties.v} ${plural(f.properties.v, 'абзац', 'абзаца', 'абзацев')} рядом с этим народом`, `${f.properties.v} paragraph${f.properties.v === 1 ? '' : 's'} next to this people`) : defaultF() ? ment(p.mentions) + ' ' + T('в', 'in') + ' ' + books(p.works) : ment(f.properties.v) + ' ' + T('в выборке', 'in the selection')}<br><span class="mute">${qTxt(f.properties.q)}</span>`; };
    function pick(pt) {
      const L = ['stops', 'places', 'dstops', 'routes', 'routes-gap', 'area-fill'].filter((l) => map.getLayer(l) && map.getLayoutProperty(l, 'visibility') !== 'none');
      const F = map.queryRenderedFeatures([[pt.x - 6, pt.y - 6], [pt.x + 6, pt.y + 6]], {layers: L}); if (!F.length) return null;
      const rank = {stops: 0, dstops: 1, places: 2, routes: 3, 'routes-gap': 4, 'area-fill': 5};
      const d = (f) => { if (f.geometry.type !== 'Point') return 0; const p = map.project(f.geometry.coordinates); return Math.hypot(p.x - pt.x, p.y - pt.y); };
      // мелкий кружок над крупным: выбирается тот, чей центр ближе к курсору
      F.sort((a, b) => rank[a.layer.id] - rank[b.layer.id] || d(a) - d(b)); return F[0];
    }
    let cur = null;
    function onMove(e) {
      const f = pick(e.point); cur = f;
      ['routes', 'places', 'stops'].forEach((s) => { const want = f && f.source === s ? f.id : null; if (HOV[s] !== want) hl(s, want); });
      if (!f) { map.getCanvas().style.cursor = ''; return hide(); }
      map.getCanvas().style.cursor = 'pointer';
      const id = f.layer.id;
      if (id === 'routes' || id === 'routes-gap') show(e.point, routeTip(f));
      else if (id === 'places') show(e.point, placeTip(f));
      else if (id === 'stops') show(e.point, stopTip(RT[st.work].stops[f.properties.k], f.properties.q));
      else if (id === 'dstops') show(e.point, `<b>${esc(nm(f.properties.name))}</b>${esc((W[f.properties.work || st.work] || {}).label || '')}<br><span class="mute">${qTxt(3)}</span>`);
      else if (id === 'area-fill') { const g = GR[f.properties.g]; show(e.point, `<b>${esc(EN ? g.name_en : g.name)}</b>${EN ? '' : esc(g.name_en) + '<br>'}${T('схематичный ареал около 1900 г.', 'schematic area, c. 1900')}<br>${ment(g.mentions)} ${T('в', 'in')} ${books(g.works)}`); }
    }
    function onClick(e) {
      const f = pick(e.point); if (!f) return;
      const id = f.layer.id;
      if (id === 'stops') { const s = RT[st.work].stops[f.properties.k]; if (s[4]) location.hash = `#book-${toH(st.work)}-p${pnum(s[4])}`; }
      else if (id === 'places') placePanel(f.properties.id);
      else if (id === 'routes' || id === 'routes-gap') { st.group = ''; V.querySelector('#fGr').value = ''; setWork(f.properties.work); }
      else if (id === 'dstops' && f.properties.work) setWork(f.properties.work);
      else if (id === 'area-fill') setGroup(f.properties.g);
    }

    map.on('load', () => {
      if (dead) return;
      map.getCanvas().setAttribute('aria-label', T('Карта маршрутов. Стрелки двигают карту, плюс и минус меняют масштаб. Те же маршруты и места — списком в панели «Маршруты и места».', 'Route map. Arrow keys pan, plus and minus zoom. The same routes and places are listed in the “Routes and places” panel.'));
      addLayers(); vis(); refresh(); map.setPadding(pad());
      map.on('mousemove', onMove); map.on('mouseout', () => { cur = null; hide(); ['routes', 'places', 'stops'].forEach((s) => hl(s, null)); }); map.on('click', onClick);
      if (!v0) { if (st.work) fitWork(st.work); else if (st.group) fitGroup(st.group); else home(); }
    });
    map.on('move', place); map.on('moveend', url);
    map.on('error', (e) => console.warn('map', e && e.error && e.error.message));

    // ---------- элементы управления ----------
    const bind = (id, k, fn) => V.querySelector('#' + id).addEventListener('change', (e) => (fn ? fn(e.target.value) : (st[k] = e.target.value, refresh())));
    bind('fWork', 'work', (w) => { st.group = ''; V.querySelector('#fGr').value = ''; setWork(w); }); bind('fGr', 'group', (g) => setGroup(g)); bind('fPer', 'period'); bind('fNat', 'nat'); bind('fStay', 'stay');
    const y0 = V.querySelector('#fY0'), y1 = V.querySelector('#fY1');
    const yr = () => { let a = +y0.value, b = +y1.value; if (a > b) [a, b] = [b, a]; st.y0 = a; st.y1 = b; refresh(); };
    y0.addEventListener('input', yr); y1.addEventListener('input', yr);
    V.querySelectorAll('.a2-lay button').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.l; st.lay = on(k) ? st.lay.replace(k, '') : st.lay + k; refresh(); }));
    V.querySelector('#bIn').onclick = () => map.zoomIn(); V.querySelector('#bOut').onclick = () => map.zoomOut();
    V.querySelector('#bHome').onclick = () => home(800);
    V.querySelector('#bMore').onclick = (e) => { const o = V.querySelector('.a2-tools').classList.toggle('more'); e.currentTarget.setAttribute('aria-expanded', String(o)); };
    V.querySelector('#bProj').onclick = (e) => { st.globe = !st.globe; map.setProjection({type: st.globe ? 'globe' : 'mercator'}); e.currentTarget.textContent = st.globe ? T('Меркатор', 'Mercator') : T('глобус', 'globe'); e.currentTarget.setAttribute('aria-pressed', String(!st.globe)); url(); place(); };
    const toast = (t) => { const n = document.createElement('div'); n.className = 'a2-toast'; n.setAttribute('role', 'status'); n.textContent = t; stage.appendChild(n); setTimeout(() => n.remove(), 2200); };
    V.querySelector('#bLink').onclick = async () => { url(); await new Promise((r) => setTimeout(r, 350)); try { await navigator.clipboard.writeText(location.href); toast(T('Ссылка скопирована', 'Link copied')); } catch (e) { prompt(T('Ссылка на этот вид', 'Link to this view'), location.href); } };
    const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    const perTxt = (k) => (EN && I18N.tr ? I18N.tr(PER[k]) || PER[k] : PER[k]);
    const filtTxt = () => [st.work && W[st.work].label, st.group && (EN ? GR[st.group].name_en : GR[st.group].name), st.period && perTxt(st.period), st.nat && nm(NAT[st.nat] || st.nat), st.stay && nm(works.find((w) => w.stay === st.stay).stay_ru), (st.y0 !== Y0 || st.y1 !== Y1) && `${st.y0}–${st.y1}`].filter(Boolean).join(' · ') || T('все маршруты', 'all routes');
    const enName = (s) => (window.I18N_EN || {})[s] || null;
    V.querySelector('#bGeo').onclick = () => {
      const LS = (g) => { const parts = g.coordinates.flatMap(splitAM); return parts.length === 1 ? {type: 'LineString', coordinates: parts[0]} : {type: 'MultiLineString', coordinates: parts}; };
      const pt = (c) => ({type: 'Point', coordinates: [wrap(c[0]), c[1]]});
      const QN = ['exact', 'approximate', 'area_centre'];
      const F = routeLines(true).features.map((f) => { const w = W[f.properties.work]; return {type: 'Feature', properties: {kind: f.properties.gap ? 'route_gap' : 'route', work: w.id, label: w.label, author: w.author, journey_start: j0(w), journey_end: j1(w), period: w.period, status: RT[w.id].status}, geometry: LS(f.geometry)}; });
      if (st.work && RT[st.work]) { const r = RT[st.work], N = normStops(r); r.stops.forEach((s, i) => { if (N[i]) F.push({type: 'Feature', properties: {kind: 'stop', work: st.work, order: i + 1, name: s[1], name_en: enName(s[1]), paragraph: s[4] || null, quote: s[7] || null, found_in_text: s[5] !== 'not_found_in_text', coord_source: s[8] || (PL[s[0]] || {}).coord || null, coord_quality: QN[stopQ(s)]}, geometry: pt(N[i])}); }); }
      placePoints().features.forEach((f) => { const p = PL[f.properties.id]; F.push({type: 'Feature', properties: {kind: 'place', id: p.id, name: p.name, name_en: enName(p.name), value: f.properties.v, mentions_corpus: p.mentions, works_corpus: p.works, coord_source: p.coord, coord_quality: QN[coordQ(p.coord)]}, geometry: pt(f.geometry.coordinates)}); });
      const fc = {type: 'FeatureCollection', name: 'iter-sibiricum-atlas-view', metadata: {source: 'Iter Sibiricum — https://iter-sibiricum.ru', view: location.href, selection: filtTxt(), generated: new Date().toISOString().slice(0, 10), license: 'CC BY 4.0', datasets: ['https://doi.org/10.5281/zenodo.24531924', 'https://doi.org/10.5281/zenodo.24532195'], note: 'Straight segments join stops named in the text; they do not trace the road. route_gap: a stretch of more than 800 km with no places named. Stops at a nominal centre of a river, lake or region are not used as route vertices.'}, features: F};
      save(new Blob([JSON.stringify(fc)], {type: 'application/geo+json'}), `iter-sibiricum-atlas${st.work ? '-' + st.work : ''}.geojson`);
    };
    V.querySelector('#bPng').onclick = () => {
      map.once('render', () => {
        const src = map.getCanvas(), w = src.clientWidth, h = src.clientHeight, dpr = src.width / w, LH = 100;
        const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height + LH * dpr;
        const g = cv.getContext('2d'); g.fillStyle = C.paper; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(src, 0, 0); g.scale(dpr, dpr);
        const sans = getComputedStyle(stage).getPropertyValue('--sans') || 'sans-serif';
        labEl.querySelectorAll('span').forEach((s) => {
          const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(s.style.transform); if (!m) return; const k = getComputedStyle(s);
          g.font = `${k.fontStyle} ${k.fontWeight} ${k.fontSize} ${k.fontFamily}`; g.textBaseline = 'top'; g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = C.paper; g.fillStyle = k.color;
          g.strokeText(s.textContent, +m[1] + 1, +m[2] + 1); g.fillText(s.textContent, +m[1] + 1, +m[2] + 1);
        });
        // легенда и подпись под картой: картинку можно ставить в статью
        let x = 14, y = h + 18; g.textBaseline = 'middle';
        g.font = `600 13px ${sans}`; g.fillStyle = C.ink; g.fillText(`Iter Sibiricum — ${T('атлас путешествий', 'atlas of journeys')}: ${filtTxt()}`, x, y);
        y += 24; g.font = `12px ${sans}`; g.fillStyle = C.mute; const lab = T('Период поездки:', 'Journey period:'); g.fillText(lab, x, y); x += g.measureText(lab).width + 10;
        PERK.forEach((k, i) => { g.fillStyle = C.per[i]; g.fillRect(x, y - 1.5, 18, 3); x += 24; g.fillStyle = C.mute; g.fillText(perTxt(k), x, y); x += g.measureText(perTxt(k)).width + 14; });
        g.setLineDash([3, 3]); g.strokeStyle = C.per[2]; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y); g.stroke(); g.setLineDash([]); x += 24; g.fillText(T(`перегон > ${GAP} км без названных мест`, `> ${GAP} km with no places named`), x, y);
        y += 22; x = 14; g.fillText(T('Круг — место (размер — число упоминаний; размытый ореол — неточные координаты). Штриховка — схематичный ареал народа. Прямые соединяют остановки и не повторяют дорогу.', 'Circle: a place (size: mentions; blurred halo: inexact coordinates). Hatching: schematic area of a people. Straight lines join stops; they do not trace the road.'), x, y);
        y += 20; g.fillText(`${location.href.split('#')[0].replace(/\/$/, '')} · ${new Date().toISOString().slice(0, 10)} · ${T('подложка', 'base map')}: Natural Earth · CC BY 4.0`, x, y);
        cv.toBlob((b) => save(b, `iter-sibiricum-atlas${st.work ? '-' + st.work : ''}.png`), 'image/png');
      });
      map.triggerRepaint();
    };

    const mo = new MutationObserver(restyle); mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']}); cleanup.push(() => mo.disconnect());
    const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', restyle); cleanup.push(() => mq.removeEventListener('change', restyle));
    refresh();
    return destroy;
  }
  return {render};
})();
