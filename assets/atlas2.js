/* Атлас на MapLibre GL: векторная подложка из собственного архива PMTiles (Natural Earth 10m), глобус или плоская карта,
   слои маршрутов, мест, ареалов и черновиков с явной степенью неопределённости. Подписи — HTML поверх карты,
   шрифтом сайта, с отбором по важности, чтобы не наползали друг на друга.
   window.Atlas2.render(V, ctx), ctx = {get, getRoutes, esc, toH, PER, NAT} из app.js. */
window.Atlas2 = (() => {
  const EN = !!(window.I18N && I18N.en);
  const T = (ru, en) => (EN ? en : ru);
  const nm = (s) => (EN && window.I18N.tr ? (I18N.tr(String(s ?? '')) || s) : s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
  const books = (n) => EN ? `${n} book${n === 1 ? '' : 's'}` : `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'книге' : 'книгах'}`;
  const ment = (n) => EN ? `${n} mention${n === 1 ? '' : 's'}` : `${n} ${plural(n, 'упоминание', 'упоминания', 'упоминаний')}`;
  const PERK = ['P1 до 1855', 'P2 1856–1880', 'P3 1881–1904', 'P4 1905–1917', 'P5 1918–1930'];
  const PERV = ['--p1', '--p2', '--p3', '--p4', '--p5'];
  const OUTER = ['kazakh_steppe', 'mongolia', 'manchuria', 'urals'];
  const DEF = {lng: 96, lat: 58, z: 2.35};
  const GAP = 800;
  const km = (a, b) => { const r = Math.PI / 180, d = Math.sin((b[1] - a[1]) * r / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(d)); };
  // длинный перегон — по дуге большого круга, а не по прямой проекции
  const densify = (a, b) => { const r = Math.PI / 180, n = Math.max(2, Math.ceil(km(a, b) / 150)), [l1, p1, l2, p2] = [a[0] * r, a[1] * r, b[0] * r, b[1] * r];
    const d = 2 * Math.asin(Math.sqrt(Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2)); if (!d) return [a, b];
    const out = []; for (let i = 0; i <= n; i++) { const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
      const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
      let lo = Math.atan2(y, x) / r; if (out.length) { const pv = out[out.length - 1][0]; while (lo - pv > 180) lo -= 360; while (pv - lo > 180) lo += 360; } else { while (lo - a[0] > 180) lo -= 360; while (a[0] - lo > 180) lo += 360; }
      out.push([lo, Math.atan2(z, Math.sqrt(x * x + y * y)) / r]); }
    return out; };

  // Цвета берутся из переменных сайта: так карта следует светлой и тёмной теме.
  function palette(el) {
    const probe = document.createElement('i'); probe.style.display = 'none'; el.appendChild(probe);
    const c = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    const p = {sea: c('--sea'), land: c('--land'), land2: c('--land2'), river: c('--river'), line: c('--line'), ink: c('--ink'), mute: c('--mute'), paper: c('--paper'), acc: c('--acc'), acc2: c('--acc2'), bg: c('--bg'), per: PERV.map(c)};
    probe.remove(); return p;
  }
  const loadJS = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const loadCSS = (href) => new Promise((res) => { if (document.querySelector(`link[href="${href}"]`)) return res(); const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = res; l.onerror = res; document.head.appendChild(l); });

  function ellipse(lon, lat, rx, ry) {
    const pts = []; for (let a = 0; a <= 360; a += 8) { const t = a * Math.PI / 180; pts.push([lon + rx * Math.cos(t), lat + ry * Math.sin(t)]); }
    return {type: 'Polygon', coordinates: [pts]};
  }
  // Долготы за 180° (Чукотка) переводим в 180…200, чтобы линии и подписи не прыгали через весь мир.
  const ulon = (lon) => (lon < -100 ? lon + 360 : lon);
  const graticule = () => {
    const f = [];
    for (let lo = -180; lo <= 180; lo += 10) { const c = []; for (let la = -80; la <= 80; la += 2) c.push([lo, la]); f.push({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: c}}); }
    for (let la = -80; la <= 80; la += 10) { const c = []; for (let lo = -180; lo <= 180; lo += 2) c.push([lo, la]); f.push({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: c}}); }
    return {type: 'FeatureCollection', features: f};
  };

  async function render(V, ctx) {
    const {get, getRoutes, toH, PER, NAT} = ctx;
    V.innerHTML = `<div class="wrap loading">${T('Загрузка карты…', 'Loading the map…')}</div>`;
    const [works, routes, places, groups, bookgeo] = await Promise.all([get('works.json'), getRoutes(), get('places.json'), get('groups.json'), get('bookgeo.json'), loadCSS('assets/vendor/maplibre-gl.css?v=56'),
      loadJS('assets/vendor/maplibre-gl.js?v=56'), loadJS('assets/vendor/pmtiles.js?v=56')]);
    const W = Object.fromEntries(works.map((w) => [w.id, w])), RT = Object.fromEntries(routes.map((r) => [r.work, r]));
    const PL = Object.fromEntries(places.map((p) => [p.id, p]));
    const ind = groups.filter((g) => g.category === 'indigenous'), GR = Object.fromEntries(ind.map((g) => [g.id, g]));
    const nMan = routes.filter((r) => r.method === 'manual').length, nDraft = routes.filter((r) => r.method === 'draft').length;
    const per = (w) => PERK.indexOf((W[w] || {}).period);
    const years = works.map((w) => w.j0 || w.year).filter(Boolean), Y0 = Math.min(...years), Y1 = Math.max(...years);

    // ---------- состояние; всё, что влияет на вид, лежит в адресе страницы ----------
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const st = {work: W[q.get('work')] ? q.get('work') : '', group: GR[q.get('g')] ? q.get('g') : '', period: q.get('per') || '', nat: q.get('nat') || '', stay: q.get('stay') || '',
      y0: +q.get('y0') || Y0, y1: +q.get('y1') || Y1, lay: q.get('l') || 'rpa', globe: q.get('p') !== 'flat'};
    const v0 = (q.get('v') || '').split(',').map(Number);
    const on = (k) => st.lay.includes(k);
    const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');

    V.innerHTML = `<section class="band a2"><div class="wrap">
      <h1>Атлас путешествий</h1>
      <p class="lede" data-noi18n>${EN ? `Lines show ${nMan} routes; each stop is backed by a paragraph in which the author says they were there.${nDraft ? ` Another ${nDraft} books have draft routes: their stops appear as blurred spots with no line, because the order and the visits have not been checked yet.` : ''} A dashed line marks a stretch of more than ${GAP} km where the author names no places. The better a location is known, the sharper its dot.` : `Линией показаны ${nMan} маршрутов; каждая остановка подтверждена абзацем, где автор пишет, что был в этом месте.${nDraft ? ` Ещё у ${nDraft} книг есть черновики маршрутов: их остановки показаны размытыми пятнами без линии, потому что порядок и сами посещения ещё не проверены.` : ''} Пунктир — перегон длиннее ${GAP} км, на котором автор не называет ни одного места. Чем точнее известно место, тем чётче точка.`}</p>
      <div class="ctl a2-ctl">
        <label>Книга <select id="fWork"><option value="">все</option>${opt(works.slice().sort((a, b) => a.year - b.year).map((w) => [w.id, w.label + (RT[w.id] ? (RT[w.id].method === 'manual' ? ' (маршрут)' : ' (черновик маршрута)') : '')]), st.work)}</select></label>
        <label>Период <select id="fPer"><option value="">все</option>${opt(Object.entries(PER), st.period)}</select></label>
        <label>Страна автора <select id="fNat"><option value="">все</option>${opt([...new Set(works.map((w) => w.nat))].map((n) => [n, NAT[n] || n]), st.nat)}</select></label>
        <label>Тип поездки <select id="fStay"><option value="">все</option>${opt([...new Set(works.map((w) => w.stay))].map((x) => [x, works.find((w) => w.stay === x).stay_ru]), st.stay)}</select></label>
        <label>Народ <select id="fGr"><option value="">—</option>${opt(ind.map((g) => [g.id, g.name]), st.group)}</select></label>
      </div>
      <div class="ctl a2-ctl"><div class="yr2"><span>Годы поездки</span>
        <span class="dual"><i></i><input type="range" id="fY0" min="${Y0}" max="${Y1}" value="${st.y0}" aria-label="${T('Не раньше', 'From')}"><input type="range" id="fY1" min="${Y0}" max="${Y1}" value="${st.y1}" aria-label="${T('Не позже', 'To')}"></span><output id="oYr"></output></div>
        <span class="a2-lay" role="group" aria-label="Слои"><button data-l="r">маршруты</button>${nDraft ? '<button data-l="d">черновики</button>' : ''}<button data-l="p">места</button><button data-l="a">ареалы</button></span></div>
    </div>
    <div class="a2-stage" data-noi18n>
      <div class="a2-map" id="a2map" role="region" aria-label="${T('Карта: стрелки двигают карту, плюс и минус меняют масштаб', 'Map: arrow keys pan, plus and minus zoom')}"></div>
      <div class="a2-labels" aria-hidden="true"></div>
      <div class="tip" hidden></div>
      <div class="a2-tools" role="toolbar" aria-label="${T('Инструменты карты', 'Map tools')}">
        <button id="bIn" title="${T('Крупнее', 'Zoom in')}" aria-label="${T('Крупнее', 'Zoom in')}">+</button>
        <button id="bOut" title="${T('Мельче', 'Zoom out')}" aria-label="${T('Мельче', 'Zoom out')}">−</button>
        <button id="bHome" title="${T('Вся Сибирь', 'Whole of Siberia')}" aria-label="${T('Вся Сибирь', 'Whole of Siberia')}">⌂</button>
        <button id="bProj" aria-pressed="${st.globe}" title="${T('Глобус или плоская карта', 'Globe or flat map')}">${st.globe ? T('плоская', 'flat') : T('глобус', 'globe')}</button>
        <button id="bMore" class="mob" aria-expanded="false" title="${T('Ещё', 'More')}" aria-label="${T('Ещё', 'More')}">⋯</button>
        <button id="bLink" class="x" title="${T('Скопировать ссылку на этот вид', 'Copy a link to this view')}">${T('ссылка', 'link')}</button>
        <button id="bPng" class="x" title="${T('Скачать изображение этого вида', 'Download an image of this view')}">PNG</button>
        <button id="bGeo" class="x" title="${T('Скачать показанные данные', 'Download the data shown')}">GeoJSON</button>
      </div>
      <aside class="a2-panel${matchMedia('(max-width: 860px)').matches ? ' shut' : ''}" id="a2panel" aria-live="polite"><button class="a2-grip" aria-expanded="${!matchMedia('(max-width: 860px)').matches}" aria-controls="a2body">${T('Сведения', 'Details')}</button><div id="a2body"></div></aside>
      <div class="a2-legend">
        <div class="a2-per">${PERK.map((k, i) => `<span><i style="background:var(${PERV[i]})"></i>${esc(EN ? PER[k] && I18N.tr ? I18N.tr(PER[k]) || PER[k] : PER[k] : PER[k])}</span>`).join('')}</div>
        <div class="a2-unc"><span><i class="u0"></i>${T('место известно точно', 'exact location')}</span><span><i class="u1"></i>${T('приблизительно', 'approximate')}</span><span><i class="u2"></i>${T('центр области', 'centre of a region')}</span>${nDraft ? `<span><i class="u3"></i>${T('остановка черновика', 'draft stop')}</span>` : ''}<span><i class="gap"></i>${T('места между остановками не названы', 'no places named between stops')}</span></div>
        <div class="a2-src">${T('Подложка: Natural Earth. Ареалы схематичны, около 1900 г.', 'Base map: Natural Earth. Areas are schematic, c. 1900.')}</div>
      </div>
    </div>
    <div class="wrap"><p class="small mute a2-note">${T('Новая версия атласа, на проверке. Прежняя карта:', 'New version of the atlas, under review. The previous map:')} <a href="#atlas">${T('атлас', 'atlas')}</a>.</p></div></section>`;

    const stage = V.querySelector('.a2-stage'), labEl = V.querySelector('.a2-labels'), tip = V.querySelector('.tip'), body = V.querySelector('#a2body');
    let C = palette(stage);

    const protocol = new pmtiles.Protocol(); maplibregl.addProtocol('pmtiles', protocol.tile);
    const base = new URL('data/tiles/basemap.pmtiles', location.href).href;
    const map = new maplibregl.Map({
      container: 'a2map', attributionControl: false, dragRotate: false, pitchWithRotate: false, maxPitch: 0, renderWorldCopies: true,
      center: v0.length === 3 && v0.every(isFinite) ? [v0[0], v0[1]] : [DEF.lng, DEF.lat], zoom: v0.length === 3 && v0.every(isFinite) ? v0[2] : (stage.clientWidth < 600 ? 1.5 : DEF.z), minZoom: .5, maxZoom: 9,
      style: {version: 8, projection: {type: st.globe ? 'globe' : 'mercator'}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': C.sea}}]},
    });
    map.touchZoomRotate.disableRotation();
    const mob = () => stage.clientWidth <= 860;
    const pad = () => mob() ? {top: 64, bottom: 56, left: 20, right: 20} : {top: 30, bottom: 30, left: 70, right: Math.min(372, stage.clientWidth * .34 + 12) + 10};
    const homeZ = () => { const p = pad(), w = stage.clientWidth - p.left - p.right, h = stage.clientHeight - p.top - p.bottom; return Math.max(.6, 2.3 + Math.log2(Math.min(w / 980, h / 640))); };
    const home = (dur) => { map.setPadding(pad()); dur ? map.flyTo({center: [DEF.lng, DEF.lat], zoom: homeZ(), duration: dur}) : map.jumpTo({center: [DEF.lng, DEF.lat], zoom: homeZ()}); };
    new ResizeObserver(() => { map.resize(); map.setPadding(pad()); }).observe(stage);
    window.__a2map = map;

    // ---------- данные для слоёв ----------
    const filt = (w) => !!w && (!st.period || w.period === st.period) && (!st.nat || w.nat === st.nat) && (!st.stay || w.stay === st.stay) && ((w.j0 || w.year) >= st.y0 && (w.j0 || w.year) <= st.y1);
    const coordQ = (src) => /^geonames/.test(src || '') ? 0 : /centroid|area/.test(src || '') ? 2 : 1; // 0 — точно, 1 — приблизительно, 2 — центр области
    const stopQ = (s) => { const cs = String(s[8] || ''); return cs.startsWith('estimate') || cs.endsWith('_ctx') ? 1 : (PL[s[0]] ? coordQ(PL[s[0]].coord) : 0); };
    function routeLines() {
      const F = [];
      for (const r of routes) {
        if (r.method !== 'manual' || !filt(W[r.work])) continue;
        // линия рвётся при смене поездки и на остановке без координат: прямой отрезок через неизвестное был бы ложным путём
        const segs = []; let cur = [], jj = null, prev = null;
        for (const s of r.stops) {
          const ok = s[2] != null && s[3] != null;
          if (!ok || (s[6] || 1) !== jj) { if (cur.length > 1) segs.push(cur); cur = []; prev = null; }
          jj = s[6] || 1; if (!ok) continue;
          let lo = ulon(s[2]); if (prev != null) { while (lo - prev > 180) lo -= 360; while (prev - lo > 180) lo += 360; } prev = lo; cur.push([lo, s[3]]);
        }
        if (cur.length > 1) segs.push(cur);
        // перегон длиннее GAP км, где автор не называет ни одного места, рисуется пунктиром: что было между остановками, текст не говорит
        const near = [], far = [];
        for (const sg of segs) { let run = [sg[0]]; for (let i = 1; i < sg.length; i++) { if (km(sg[i - 1], sg[i]) > GAP) { if (run.length > 1) near.push(run); far.push(densify(sg[i - 1], sg[i])); run = [sg[i]]; } else run.push(sg[i]); } if (run.length > 1) near.push(run); }
        const pr = {work: r.work, per: per(r.work), focus: r.work === st.work ? 1 : 0};
        if (near.length) F.push({type: 'Feature', properties: {...pr, gap: 0}, geometry: {type: 'MultiLineString', coordinates: near}});
        if (far.length) F.push({type: 'Feature', properties: {...pr, gap: 1}, geometry: {type: 'MultiLineString', coordinates: far}});
      }
      return {type: 'FeatureCollection', features: F};
    }
    function stopPoints() {
      const F = []; const r = RT[st.work];
      if (r) r.stops.forEach((s, i) => { if (s[2] == null) return; F.push({type: 'Feature', properties: {i: i + 1, name: s[1], pid: s[4] || '', flag: s[5], q: r.method === 'draft' ? 3 : stopQ(s), per: per(r.work), draft: r.method === 'draft' ? 1 : 0}, geometry: {type: 'Point', coordinates: [ulon(s[2]), s[3]]}}); });
      if (on('d')) for (const d of routes) {
        if (d.method !== 'draft' || d.work === st.work || !filt(W[d.work])) continue;
        d.stops.forEach((s, i) => { if (s[2] != null) F.push({type: 'Feature', properties: {i: i + 1, name: s[1], work: d.work, flag: s[5], q: 3, per: per(d.work), draft: 1, bg: 1}, geometry: {type: 'Point', coordinates: [ulon(s[2]), s[3]]}}); });
      }
      return {type: 'FeatureCollection', features: F};
    }
    const gval = (p) => { if (!st.group) return p.mentions; const g = GR[st.group]; return (p.groups.find((x) => x[0] === g.name) || [0, 0])[1]; };
    function placePoints() {
      const F = [];
      if (st.work && bookgeo[st.work]) {
        for (const [id, n] of bookgeo[st.work]) { const p = PL[id]; if (p) F.push({type: 'Feature', properties: {id, v: n, q: coordQ(p.coord), book: 1}, geometry: {type: 'Point', coordinates: [ulon(p.lon), p.lat]}}); }
      } else for (const p of places) {
        if (!(p.sib || OUTER.includes(p.region))) continue; const v = gval(p); if (!(v > 0)) continue;
        F.push({type: 'Feature', properties: {id: p.id, v, q: coordQ(p.coord)}, geometry: {type: 'Point', coordinates: [ulon(p.lon), p.lat]}});
      }
      const mx = Math.max(1, ...F.map((f) => f.properties.v)); F.forEach((f) => { f.properties.r = Math.sqrt(f.properties.v / mx); });
      F.sort((a, b) => b.properties.v - a.properties.v); return {type: 'FeatureCollection', features: F};
    }
    function areaPolys() {
      const F = []; ind.forEach((g) => (g.areas || []).forEach((a) => F.push({type: 'Feature', properties: {g: g.id, hi: g.id === st.group ? 1 : 0}, geometry: ellipse(...a)})));
      return {type: 'FeatureCollection', features: F};
    }

    // ---------- стиль ----------
    const PC = () => ['match', ['get', 'per'], 0, C.per[0], 1, C.per[1], 2, C.per[2], 3, C.per[3], 4, C.per[4], C.acc];
    const ROP = (a) => st.work ? ['case', ['==', ['get', 'focus'], 1], 1, .12] : ['case', ['boolean', ['feature-state', 'hover'], false], 1, st.group ? a * .4 : a];
    function addLayers() {
      map.addSource('base', {type: 'vector', url: 'pmtiles://' + base, attribution: 'Natural Earth'});
      map.addSource('grat', {type: 'geojson', data: graticule()});
      map.addSource('areas', {type: 'geojson', data: areaPolys()});
      map.addSource('routes', {type: 'geojson', data: routeLines(), promoteId: 'work'});
      map.addSource('stops', {type: 'geojson', data: stopPoints()});
      map.addSource('places', {type: 'geojson', data: placePoints(), promoteId: 'id'});
      const L = [
        {id: 'grat', type: 'line', source: 'grat', paint: {'line-color': C.line, 'line-width': .6, 'line-opacity': .8}},
        {id: 'land', type: 'fill', source: 'base', 'source-layer': 'land', paint: {'fill-color': C.land, 'fill-antialias': true}},
        {id: 'coast', type: 'line', source: 'base', 'source-layer': 'land', paint: {'line-color': C.land2, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, .4, 7, 1]}},
        {id: 'lakes', type: 'fill', source: 'base', 'source-layer': 'lakes', filter: ['<=', ['coalesce', ['get', 'scalerank'], 9], ['+', 2, ['*', 1.2, ['zoom']]]], paint: {'fill-color': C.sea, 'fill-outline-color': C.river}},
        {id: 'rivers', type: 'line', source: 'base', 'source-layer': 'rivers', filter: ['<=', ['coalesce', ['get', 'scalerank'], 9], ['+', 3.2, ['*', .9, ['zoom']]]],
          layout: {'line-cap': 'round', 'line-join': 'round'},
          paint: {'line-color': C.river, 'line-opacity': .75, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, ['max', .35, ['-', 1.5, ['*', .16, ['coalesce', ['get', 'scalerank'], 9]]]], 7, ['max', .8, ['-', 3.4, ['*', .3, ['coalesce', ['get', 'scalerank'], 9]]]]]}},
        // ареал: бледная заливка и размытый край — граница расселения не была линией
        {id: 'area-fill', type: 'fill', source: 'areas', layout: {visibility: on('a') ? 'visible' : 'none'}, paint: {'fill-color': C.acc2, 'fill-opacity': ['case', ['==', ['get', 'hi'], 1], .2, ['boolean', ['feature-state', 'hover'], false], .14, .07]}},
        {id: 'area-edge', type: 'line', source: 'areas', layout: {visibility: on('a') ? 'visible' : 'none'}, paint: {'line-color': C.acc2, 'line-opacity': ['case', ['==', ['get', 'hi'], 1], .38, .2], 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 6, 6, 12], 'line-blur': ['interpolate', ['linear'], ['zoom'], 2, 6, 6, 12]}},
        {id: 'routes-gap', type: 'line', source: 'routes', filter: ['==', ['get', 'gap'], 1], layout: {visibility: on('r') ? 'visible' : 'none', 'line-cap': 'butt'},
          paint: {'line-color': PC(), 'line-dasharray': [2, 3], 'line-width': ['case', ['==', ['get', 'focus'], 1], 2, ['boolean', ['feature-state', 'hover'], false], 1.8, 1], 'line-opacity': ROP(.5)}},
        {id: 'routes', type: 'line', source: 'routes', filter: ['==', ['get', 'gap'], 0], layout: {visibility: on('r') ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round'},
          paint: {'line-color': PC(), 'line-width': ['interpolate', ['linear'], ['zoom'], 2, ['case', ['==', ['get', 'focus'], 1], 3.2, ['boolean', ['feature-state', 'hover'], false], 3, 1.3], 6, ['case', ['==', ['get', 'focus'], 1], 4, ['boolean', ['feature-state', 'hover'], false], 3.4, 2.2]], 'line-opacity': ROP(.62)}},
        // черновики: размытые пятна без линии
        {id: 'dstops', type: 'circle', source: 'stops', filter: ['==', ['get', 'q'], 3],
          paint: {'circle-color': ['match', ['get', 'per'], 0, C.per[0], 1, C.per[1], 2, C.per[2], 3, C.per[3], 4, C.per[4], C.acc],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['case', ['==', ['coalesce', ['get', 'bg'], 0], 1], 5, 9], 7, ['case', ['==', ['coalesce', ['get', 'bg'], 0], 1], 12, 18]],
            'circle-blur': 1, 'circle-opacity': ['case', ['==', ['coalesce', ['get', 'bg'], 0], 1], .32, ['==', ['get', 'flag'], 'higher'], .75, .5]}},
        // место: точное — чёткий круг, приблизительное — размытое, центр области — широкий ореол
        {id: 'places-halo', type: 'circle', source: 'places', layout: {visibility: on('p') || st.work ? 'visible' : 'none'}, filter: ['>=', ['get', 'q'], 1],
          paint: {'circle-color': C.acc, 'circle-blur': 1, 'circle-opacity': ['case', ['==', ['get', 'q'], 2], .22, .3],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['+', ['case', ['==', ['get', 'q'], 2], 14, 7], ['*', 16, ['get', 'r']]], 7, ['*', 2.2, ['+', ['case', ['==', ['get', 'q'], 2], 14, 7], ['*', 16, ['get', 'r']]]]]}},
        {id: 'places', type: 'circle', source: 'places', layout: {visibility: on('p') || st.work ? 'visible' : 'none'},
          paint: {'circle-color': C.acc, 'circle-opacity': ['case', ['==', ['get', 'q'], 0], .5, .28],
            'circle-stroke-color': C.acc, 'circle-stroke-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2, ['==', ['get', 'q'], 0], 1, 0],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['+', 1.6, ['*', 13, ['get', 'r']]], 7, ['*', 2.2, ['+', 1.6, ['*', 13, ['get', 'r']]]]]}},
        {id: 'stops', type: 'circle', source: 'stops', filter: ['<', ['get', 'q'], 3],
          paint: {'circle-color': ['case', ['==', ['get', 'flag'], 'not_found_in_text'], C.paper, ['match', ['get', 'per'], 0, C.per[0], 1, C.per[1], 2, C.per[2], 3, C.per[3], 4, C.per[4], C.acc]],
            'circle-radius': ['case', ['==', ['get', 'q'], 0], 4.6, 6.5], 'circle-blur': ['case', ['==', ['get', 'q'], 0], 0, .55],
            'circle-stroke-color': ['match', ['get', 'per'], 0, C.per[0], 1, C.per[1], 2, C.per[2], 3, C.per[3], 4, C.per[4], C.acc], 'circle-stroke-width': ['case', ['==', ['get', 'flag'], 'not_found_in_text'], 1.6, 0]}},
      ];
      L.forEach((l) => map.addLayer(l));
    }
    function restyle() {
      C = palette(stage); if (!map.getLayer('land')) return;
      map.setPaintProperty('bg', 'background-color', C.sea); map.setPaintProperty('land', 'fill-color', C.land); map.setPaintProperty('coast', 'line-color', C.land2);
      map.setPaintProperty('lakes', 'fill-color', C.sea); map.setPaintProperty('lakes', 'fill-outline-color', C.river); map.setPaintProperty('rivers', 'line-color', C.river);
      map.setPaintProperty('grat', 'line-color', C.line);
      ['area-fill', 'area-edge'].forEach((id) => map.setPaintProperty(id, id === 'area-fill' ? 'fill-color' : 'line-color', C.acc2));
      const pc = ['match', ['get', 'per'], 0, C.per[0], 1, C.per[1], 2, C.per[2], 3, C.per[3], 4, C.per[4], C.acc];
      map.setPaintProperty('routes', 'line-color', pc); map.setPaintProperty('routes-gap', 'line-color', pc); map.setPaintProperty('dstops', 'circle-color', pc); map.setPaintProperty('stops', 'circle-stroke-color', pc);
      ['places', 'places-halo'].forEach((id) => map.setPaintProperty(id, 'circle-color', C.acc)); map.setPaintProperty('places', 'circle-stroke-color', C.acc);
      map.setSky && map.setSky({'atmosphere-blend': 0}); labels();
    }

    // ---------- подписи: HTML, шрифт сайта, жадный отбор по важности без наложений ----------
    function labelCands() {
      const out = [];
      if (st.work && RT[st.work]) {
        const r = RT[st.work], S = r.stops.filter((s) => s[2] != null);
        S.forEach((s, i) => out.push({ll: [ulon(s[2]), s[3]], t: r.method === 'draft' ? `${i + 1}` : nm(s[1]), w: 1000 - i, cls: r.method === 'draft' ? 'num' : 'stop', dx: r.method === 'draft' ? 0 : 8}));
        if (r.method === 'draft') S.forEach((s, i) => out.push({ll: [ulon(s[2]), s[3]], t: nm(s[1]), w: 400 - i, cls: 'sub', dx: 14}));
      }
      if (on('p') || st.work) {
        const P = map.getSource('places') ? placePoints().features : [];
        P.slice(0, 60).forEach((f, i) => { const p = PL[f.properties.id]; out.push({ll: f.geometry.coordinates, t: nm(p.name), w: 200 - i, cls: f.properties.q === 2 ? 'reg' : 'pl', dx: 6 + 13 * f.properties.r}); });
      }
      return out;
    }
    let cands = [], raf = 0;
    function labels() { cands = labelCands(); place(); }
    function place() {
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
        const Wd = stage.clientWidth, Hd = stage.clientHeight, ctr = map.getCenter(), placed = [];
        const occl = (ll) => { if (!st.globe || map.getZoom() > 5.5) return false; const r = Math.PI / 180; const c = Math.sin(ctr.lat * r) * Math.sin(ll[1] * r) + Math.cos(ctr.lat * r) * Math.cos(ll[1] * r) * Math.cos((ll[0] - ctr.lng) * r); return c < .12; };
        const html = [];
        for (const c of cands.slice().sort((a, b) => b.w - a.w)) {
          if (occl(c.ll)) continue;
          const p = map.project(c.ll); if (p.x < -40 || p.y < -20 || p.x > Wd + 40 || p.y > Hd + 20) continue;
          const wch = c.cls === 'num' ? 14 : 6.6 * String(c.t).length + 6, h = c.cls === 'num' ? 14 : 15;
          const x = c.cls === 'num' ? p.x - wch / 2 : p.x + c.dx, y = p.y - h / 2;
          const box = [x - 2, y - 1, x + wch + 2, y + h + 1];
          if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
          placed.push(box); html.push(`<span class="${c.cls}" style="transform:translate(${Math.round(x)}px,${Math.round(y)}px)">${esc(c.t)}</span>`);
          if (placed.length > 70) break;
        }
        labEl.innerHTML = html.join('');
      });
    }

    // ---------- подсказки и панель ----------
    const show = (ev, html) => { tip.innerHTML = html; tip.hidden = false; const Wd = stage.clientWidth, Hd = stage.clientHeight; let x = ev.point.x + 14, y = ev.point.y + 14; if (x + tip.offsetWidth > Wd) x = ev.point.x - tip.offsetWidth - 10; if (y + tip.offsetHeight > Hd) y = ev.point.y - tip.offsetHeight - 10; tip.style.left = x + 'px'; tip.style.top = y + 'px'; };
    const hide = () => { tip.hidden = true; };
    const stTxt = (r) => r.status === 'verified' ? T('маршрут подтверждён экспертом', 'route confirmed by an expert') : r.status === 'checked' ? T('маршрут проверен по тексту', 'route checked against the text') : r.method === 'draft' ? T('черновик: порядок и посещения не проверены', 'draft: order and visits not yet checked') : T('маршрут восстановлен по тексту', 'route reconstructed from the text');
    const qTxt = (q) => [T('координаты точные (GeoNames)', 'exact coordinates (GeoNames)'), T('координаты приблизительные', 'approximate coordinates'), T('точка — центр области', 'the point is the centre of a region'), T('черновик: посещение выведено из текста', 'draft: visit inferred from the text')][q];
    const jour = (w) => `${w.j0 || '?'}${w.j1 && w.j1 !== w.j0 ? '–' + w.j1 : ''}`;
    const pnum = (pid) => +String(pid || '').split('_p')[1] || 0;
    function panel() {
      let h = '';
      if (st.work) {
        const w = W[st.work], r = RT[st.work];
        h += `<h3><a href="#book-${toH(w.id)}">${esc(w.label)}</a></h3><p class="small mute">${esc(w.author)} · ${esc(nm(w.nat_ru))} · ${esc(nm(w.stay_ru))} · ${T('поездка', 'journey')} ${jour(w)}</p>`;
        h += r ? `<p><span class="status${r.method === 'manual' ? ' rec' : ''}">${stTxt(r)}</span></p>` : `<p class="small">${T('Программа не нашла в книге мест, о которых автор пишет как о посещённых. На карте — все места, упомянутые в книге; круг тем больше, чем чаще упоминание.', 'No places the author describes as visited were found in this book. The map shows every place the book mentions; the larger the circle, the more often it is mentioned.')}</p>`;
        if (r && r.summary && !EN) h += `<p class="small">${esc(r.summary)}</p>`;
        if (r) h += `<ol class="small a2-stops">${r.stops.map((s) => `<li>${s[4] ? `<a href="#book-${toH(st.work)}-p${pnum(s[4])}">${esc(nm(s[1]))}</a>` : esc(nm(s[1]))}${s[2] == null ? ` <span class="mute">${T('без координат', 'no coordinates')}</span>` : stopQ(s) ? ` <span class="mute">${T('≈ координаты', '≈ coordinates')}</span>` : ''}${s[5] === 'not_found_in_text' ? ` <span class="mute">${T('в тексте не найдено', 'not found in the text')}</span>` : ''}</li>`).join('')}</ol>`;
        h += `<p class="small"><a href="#" data-clear="work">${T('← все маршруты', '← all routes')}</a></p>`;
      } else {
        const vis = routes.filter((r) => r.method === 'manual' && filt(W[r.work])).sort((a, b) => (W[a.work].j0 || 0) - (W[b.work].j0 || 0));
        const dr = routes.filter((r) => r.method === 'draft' && filt(W[r.work]));
        h += `<h3>${T('Маршруты на карте', 'Routes on the map')}: ${vis.length}</h3><ul class="a2-list">${vis.map((r) => { const w = W[r.work]; return `<li><button data-work="${esc(r.work)}"><i style="background:var(${PERV[per(r.work)]})"></i><span>${esc(w.label)}</span><span class="mute">${jour(w)}</span></button></li>`; }).join('')}</ul>`;
        if (dr.length) h += `<p class="small mute">${T(`Ещё ${dr.length} черновиков: выберите книгу в списке или включите слой «черновики».`, `${dr.length} more drafts: pick a book from the list or turn on the “drafts” layer.`)}</p>`;
      }
      if (st.group) { const g = GR[st.group]; h = `<h3><a href="#people-${toH(g.id)}">${esc(EN ? g.name_en : g.name)}</a></h3><p class="small mute">${T('Круги — места, названные в одних абзацах с этим народом; размер — число таких абзацев. Пятно — схематичный ареал около 1900 г.', 'Circles are places named in the same paragraphs as this people; size is the number of such paragraphs. The shaded patch is a schematic area, c. 1900.')}</p><p class="small"><a href="#" data-clear="group">${T('← без народа', '← no people selected')}</a></p><hr class="a2-hr">` + h; }
      body.innerHTML = h;
    }
    function placePanel(id) {
      const p = PL[id]; if (!p) return;
      const bar = (rows) => `<ul class="a2-bars">${rows.map(([t, n, href]) => `<li>${href ? `<a href="${href}">${esc(t)}</a>` : esc(t)}<span>${n}</span></li>`).join('')}</ul>`;
      body.innerHTML = `<h3>${esc(nm(p.name))}</h3><p class="small mute">${ment(p.mentions)} ${T('в', 'in')} ${books(p.works)} · ${qTxt(coordQ(p.coord))}</p>
        <h4>${T('Чаще всего упоминают', 'Mentioned most often in')}</h4>${bar(p.top_works.slice(0, 8).map(([w, n]) => [W[w] ? W[w].label : w, n, '#book-' + toH(w)]))}
        ${p.groups.length ? `<h4>${T('Народы в тех же абзацах', 'Peoples in the same paragraphs')}</h4>${bar(p.groups.slice(0, 8).map(([g, n]) => [nm(g), n]))}` : ''}
        <p class="small"><a href="#" data-back="1">${T('← назад', '← back')}</a></p>`;
      openPanel();
    }
    const panelEl = V.querySelector('#a2panel'), grip = V.querySelector('.a2-grip');
    const openPanel = () => { panelEl.classList.remove('shut'); grip.setAttribute('aria-expanded', 'true'); };
    grip.addEventListener('click', () => { const o = panelEl.classList.toggle('shut'); grip.setAttribute('aria-expanded', String(!o)); });
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-work]'); if (b) { setWork(b.dataset.work); return; }
      const c = e.target.closest('[data-clear]'); if (c) { e.preventDefault(); if (c.dataset.clear === 'work') setWork(''); else setGroup(''); return; }
      if (e.target.closest('[data-back]')) { e.preventDefault(); panel(); }
    });

    // ---------- обновление ----------
    let urlT = 0;
    function url() {
      clearTimeout(urlT); urlT = setTimeout(() => {
        const c = map.getCenter(), p = new URLSearchParams();
        if (st.work) p.set('work', st.work); if (st.group) p.set('g', st.group); if (st.period) p.set('per', st.period); if (st.nat) p.set('nat', st.nat); if (st.stay) p.set('stay', st.stay);
        if (st.y0 !== Y0) p.set('y0', st.y0); if (st.y1 !== Y1) p.set('y1', st.y1); if (st.lay !== 'rpa') p.set('l', st.lay || '-'); if (!st.globe) p.set('p', 'flat');
        p.set('v', [c.lng.toFixed(2), c.lat.toFixed(2), map.getZoom().toFixed(2)].join(','));
        history.replaceState(null, '', '#atlas2?' + p.toString().replace(/%2C/g, ','));
      }, 250);
    }
    function refresh() {
      if (!map.getSource('routes')) return;
      map.getSource('routes').setData(routeLines()); map.getSource('stops').setData(stopPoints()); map.getSource('places').setData(placePoints()); map.getSource('areas').setData(areaPolys());
      map.setPaintProperty('routes', 'line-opacity', ROP(.62)); map.setPaintProperty('routes-gap', 'line-opacity', ROP(.5));
      ['routes', 'routes-gap'].forEach((id) => map.setLayoutProperty(id, 'visibility', on('r') ? 'visible' : 'none'));
      ['area-fill', 'area-edge'].forEach((id) => map.setLayoutProperty(id, 'visibility', on('a') ? 'visible' : 'none'));
      ['places', 'places-halo'].forEach((id) => map.setLayoutProperty(id, 'visibility', on('p') || st.work ? 'visible' : 'none'));
      V.querySelectorAll('.a2-lay button').forEach((b) => { b.classList.toggle('on', on(b.dataset.l)); b.setAttribute('aria-pressed', String(on(b.dataset.l))); });
      V.querySelector('#oYr').textContent = `${st.y0}–${st.y1}`;
      const bar = V.querySelector('.dual i'), f = (y) => (y - Y0) / (Y1 - Y0); bar.style.left = `calc(9px + (100% - 18px) * ${f(st.y0)})`; bar.style.width = `calc((100% - 18px) * ${f(st.y1) - f(st.y0)})`;
      panel(); labels(); url();
    }
    const fitTo = (coords, mz = 6) => {
      if (!coords.length) return; const lo = coords.map((c) => c[0]), la = coords.map((c) => c[1]);
      const p = pad(); if (mob()) p.bottom = Math.round(stage.clientHeight * .46) + 10; else p.bottom = 110;
      map.fitBounds([[Math.min(...lo), Math.min(...la)], [Math.max(...lo), Math.max(...la)]], {padding: p, maxZoom: mz, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900});
    };
    function setWork(w) {
      st.work = w; V.querySelector('#fWork').value = w; refresh(); openPanel();
      if (w) { const r = RT[w]; const cs = r ? r.stops.filter((s) => s[2] != null).map((s) => [ulon(s[2]), s[3]]) : (bookgeo[w] || []).map(([id]) => PL[id]).filter((p) => p && (p.sib || OUTER.includes(p.region))).map((p) => [ulon(p.lon), p.lat]); fitTo(cs); }
    }
    function setGroup(g) {
      st.group = g; V.querySelector('#fGr').value = g; refresh(); openPanel();
      if (g) { const a = GR[g].areas || []; if (a.length) fitTo(a.flatMap(([lo, la, rx, ry]) => [[lo - rx * 1.6, la - ry * 1.6], [lo + rx * 1.6, la + ry * 1.6]]), 4.2); }
    }

    map.on('load', () => {
      map.getCanvas().setAttribute('aria-label', T('Карта маршрутов. Стрелки двигают карту, плюс и минус меняют масштаб; список маршрутов — в панели справа.', 'Route map. Arrow keys pan, plus and minus zoom; the list of routes is in the panel on the right.'));
      addLayers(); refresh();
      const hov = {};
      const hover = (layer, src, html) => {
        map.on('mousemove', layer, (e) => { const f = e.features[0]; map.getCanvas().style.cursor = 'pointer'; if (hov[src] != null && hov[src] !== f.id) map.setFeatureState({source: src, id: hov[src]}, {hover: false}); if (f.id != null) { hov[src] = f.id; map.setFeatureState({source: src, id: f.id}, {hover: true}); } show(e, html(f)); });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; if (hov[src] != null) map.setFeatureState({source: src, id: hov[src]}, {hover: false}); hov[src] = null; hide(); });
      };
      const rtip = (f) => { const w = W[f.properties.work] || {}; return `<b>${esc(w.label)}</b>${esc(w.author || '')}<br>${T('поездка', 'journey')} ${jour(w)} · ${esc(nm(w.stay_ru || ''))}<br>${stTxt(RT[w.id] || {})}${f.properties.gap ? '<br><span class="mute">' + T('пунктир: между этими остановками автор не называет мест', 'dashed: the author names no places between these stops') + '</span>' : ''}`; };
      hover('routes', 'routes', rtip); hover('routes-gap', 'routes', rtip);
      hover('places', 'places', (f) => { const p = PL[f.properties.id]; return `<b>${esc(nm(p.name))}</b>${f.properties.book ? ment(f.properties.v) + ' ' + T('в этой книге', 'in this book') : ment(p.mentions) + ' ' + T('в', 'in') + ' ' + books(p.works)}<br><span class="mute">${qTxt(f.properties.q)}</span>${!f.properties.book && p.groups.length ? '<br>' + T('в тех же абзацах: ', 'in the same paragraphs: ') + p.groups.slice(0, 4).map((x) => esc(nm(x[0])) + ' (' + x[1] + ')').join(', ') : ''}`; });
      hover('stops', 'stops', (f) => `<b>${esc(nm(f.properties.name))}</b>${f.properties.flag === 'not_found_in_text' ? T('в тексте не найдено', 'not found in the text') : f.properties.pid ? T('абзац ', 'paragraph ') + pnum(f.properties.pid) : ''}<br><span class="mute">${qTxt(f.properties.q)}</span>`);
      hover('dstops', 'stops', (f) => { const w = W[f.properties.work || st.work] || {}; return `<b>${esc(nm(f.properties.name))}</b>${esc(w.label || '')}<br><span class="mute">${qTxt(3)}${f.properties.flag === 'higher' ? T(', несколько свидетельств', ', several mentions') : ''}</span>`; });
      map.on('mousemove', 'area-fill', (e) => {
        if (map.queryRenderedFeatures(e.point, {layers: ['routes', 'routes-gap', 'places', 'stops', 'dstops']}).length) return;
        const g = GR[e.features[0].properties.g]; map.getCanvas().style.cursor = 'pointer';
        show(e, `<b>${esc(EN ? g.name_en : g.name)}</b>${EN ? '' : esc(g.name_en) + '<br>'}${T('схематичный ареал около 1900 г.', 'schematic area, c. 1900')}<br>${ment(g.mentions)} ${T('в', 'in')} ${books(g.works)}`);
      });
      map.on('mouseleave', 'area-fill', () => { map.getCanvas().style.cursor = ''; hide(); });
      map.on('click', (e) => {
        const F = map.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], {layers: ['stops', 'places', 'routes', 'routes-gap', 'dstops', 'area-fill'].filter((l) => map.getLayoutProperty(l, 'visibility') !== 'none')});
        const f = F[0]; if (!f) return;
        if (f.layer.id === 'stops' && f.properties.pid) location.hash = `#book-${toH(st.work)}-p${pnum(f.properties.pid)}`;
        else if (f.layer.id === 'places') placePanel(f.properties.id);
        else if (f.layer.id === 'routes' || f.layer.id === 'routes-gap') setWork(f.properties.work);
        else if (f.layer.id === 'dstops' && f.properties.work) setWork(f.properties.work);
        else if (f.layer.id === 'area-fill') setGroup(f.properties.g);
      });
      map.setPadding(pad()); if (st.work && !v0[2]) setWork(st.work); else if (!v0[2]) home();
    });
    map.on('move', place); map.on('moveend', url); map.on('resize', place);
    map.on('error', (e) => console.warn('map', e && e.error && e.error.message));

    // ---------- элементы управления ----------
    const bind = (id, k, fn) => V.querySelector('#' + id).addEventListener('change', (e) => (fn ? fn(e.target.value) : (st[k] = e.target.value, refresh())));
    bind('fWork', 'work', setWork); bind('fGr', 'group', setGroup); bind('fPer', 'period'); bind('fNat', 'nat'); bind('fStay', 'stay');
    const y0 = V.querySelector('#fY0'), y1 = V.querySelector('#fY1');
    const yr = () => { let a = +y0.value, b = +y1.value; if (a > b) [a, b] = [b, a]; st.y0 = a; st.y1 = b; refresh(); };
    y0.addEventListener('input', yr); y1.addEventListener('input', yr);
    V.querySelectorAll('.a2-lay button').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.l; st.lay = on(k) ? st.lay.replace(k, '') : st.lay + k; refresh(); }));
    V.querySelector('#bIn').onclick = () => map.zoomIn(); V.querySelector('#bOut').onclick = () => map.zoomOut();
    V.querySelector('#bHome').onclick = () => home(800);
    V.querySelector('#bMore').onclick = (e) => { const o = V.querySelector('.a2-tools').classList.toggle('more'); e.target.setAttribute('aria-expanded', String(o)); };
    V.querySelector('#bProj').onclick = (e) => { st.globe = !st.globe; map.setProjection({type: st.globe ? 'globe' : 'mercator'}); e.target.textContent = st.globe ? T('плоская', 'flat') : T('глобус', 'globe'); e.target.setAttribute('aria-pressed', String(st.globe)); url(); place(); };
    const toast = (t) => { const n = document.createElement('div'); n.className = 'a2-toast'; n.textContent = t; stage.appendChild(n); setTimeout(() => n.remove(), 2200); };
    V.querySelector('#bLink').onclick = async () => { url(); await new Promise((r) => setTimeout(r, 300)); try { await navigator.clipboard.writeText(location.href); toast(T('Ссылка скопирована', 'Link copied')); } catch (e) { prompt(T('Ссылка на этот вид', 'Link to this view'), location.href); } };
    const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
    V.querySelector('#bGeo').onclick = () => {
      const fc = {type: 'FeatureCollection', name: 'iter-sibiricum-atlas-view', features: [
        ...routeLines().features.map((f) => ({type: 'Feature', properties: {kind: 'route', work: f.properties.work, label: W[f.properties.work].label, author: W[f.properties.work].author, journey: jour(W[f.properties.work]), status: RT[f.properties.work].status}, geometry: f.geometry})),
        ...stopPoints().features.map((f) => ({type: 'Feature', properties: {kind: f.properties.draft ? 'draft_stop' : 'stop', work: f.properties.work || st.work, order: f.properties.i, name: f.properties.name, paragraph: f.properties.pid || null, coord_quality: ['exact', 'approximate', 'region_centre', 'draft'][f.properties.q]}, geometry: f.geometry})),
        ...placePoints().features.map((f) => { const p = PL[f.properties.id]; return {type: 'Feature', properties: {kind: 'place', id: p.id, name: p.name, value: f.properties.v, mentions: p.mentions, works: p.works, coord_source: p.coord}, geometry: f.geometry}; })]};
      save(new Blob([JSON.stringify(fc)], {type: 'application/geo+json'}), 'iter-sibiricum-atlas.geojson');
    };
    V.querySelector('#bPng').onclick = () => {
      map.once('render', () => {
        const src = map.getCanvas(), dpr = src.width / src.clientWidth, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height + 34 * dpr;
        const g = cv.getContext('2d'); g.fillStyle = C.bg; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(src, 0, 0);
        g.scale(dpr, dpr); const cs = getComputedStyle(labEl.firstElementChild || labEl);
        labEl.querySelectorAll('span').forEach((s) => {
          const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(s.style.transform); if (!m) return; const k = getComputedStyle(s);
          g.font = `${k.fontStyle} ${k.fontWeight} ${k.fontSize} ${k.fontFamily}`; g.textBaseline = 'top'; g.lineWidth = 3; g.strokeStyle = C.paper; g.fillStyle = k.color;
          g.strokeText(s.textContent, +m[1] + 1, +m[2] + 1); g.fillText(s.textContent, +m[1] + 1, +m[2] + 1);
        });
        g.font = `13px ${cs.fontFamily}`; g.fillStyle = C.mute; g.textBaseline = 'middle';
        g.fillText(`Iter Sibiricum — ${location.href.split('#')[0].replace(/\/$/, '')} · ${T('подложка', 'base map')}: Natural Earth · CC BY 4.0`, 12, src.clientHeight + 17);
        cv.toBlob((b) => save(b, 'iter-sibiricum-atlas.png'), 'image/png');
      });
      map.triggerRepaint();
    };

    const mo = new MutationObserver(restyle); mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', restyle);
    // при уходе со страницы карта освобождает WebGL и обработчики
    const off = () => { if (!location.hash.startsWith('#atlas2')) { window.removeEventListener('hashchange', off); mo.disconnect(); mq.removeEventListener('change', restyle); try { map.remove(); } catch (e) {} maplibregl.removeProtocol && maplibregl.removeProtocol('pmtiles'); } };
    window.addEventListener('hashchange', off);
    panel();
  }
  return {render};
})();
