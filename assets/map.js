/* Карта Сибири на d3-geo без внешних тайлов: суша, реки, озёра (Natural Earth), маршруты, места, ареалы.
   window.SibMap.draw(el, {geo, routes, places, works, bookgeo, areas, focusWork, focusGroup, showManual, showPlaces, showAreas, filter, onWork, onPlace})
   Линией рисуются только маршруты, восстановленные по тексту или проверенные (method 'manual'); черновики — пронумерованными точками. */
window.SibMap = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function ellipse(lon, lat, rx, ry) {
    const pts = []; for (let a = 0; a <= 360; a += 10) { const t = a * Math.PI / 180; pts.push([lon + rx * Math.cos(t), lat + ry * Math.sin(t)]); }
    return {type: 'Polygon', coordinates: [pts.reverse()]};
  }
  function draw(el, o) {
    el.querySelectorAll('svg,.tip').forEach((n) => n.remove());
    const W = el.clientWidth || 800, H = el.clientHeight || 500;
    const pts = []; for (let lo = 52; lo <= 182; lo += 5) { pts.push([lo, 43]); pts.push([lo, 73]); }
    const frame = {type: 'MultiPoint', coordinates: pts};
    const inBox = (s) => s[2] >= 40 && s[2] <= 195 && s[3] >= 34 && s[3] <= 79;
    const proj = d3.geoConicEqualArea().parallels([50, 68]).rotate([-105, 0]).fitExtent([[8, 8], [W - 8, H - 8]], o.extent || frame);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', o.label || 'Карта Сибири');
    const g = svg.append('g');
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.appendChild(tip);
    const show = (ev, html) => { tip.innerHTML = html; tip.hidden = false; const r = el.getBoundingClientRect(); let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14; if (x + tip.offsetWidth > W) x = W - tip.offsetWidth - 6; if (y + tip.offsetHeight > H) y = ev.clientY - r.top - tip.offsetHeight - 10; tip.style.left = x + 'px'; tip.style.top = y + 'px'; };
    const hide = () => { tip.hidden = true; };
    g.append('path').datum(d3.geoGraticule().step([10, 10])()).attr('class', 'grat').attr('d', path);
    g.append('g').selectAll('path').data(o.geo.land.features).join('path').attr('class', 'land').attr('d', path);
    g.append('g').selectAll('path').data(o.geo.lakes.features).join('path').attr('class', 'lake').attr('d', path);
    g.append('g').selectAll('path').data(o.geo.rivers.features).join('path').attr('class', 'river')
      .attr('stroke-width', (f) => Math.max(.5, 2.2 - .3 * (f.properties.scalerank || 5))).attr('d', path);
    const k0 = {k: 1};
    if (o.showAreas !== false && o.areas) {
      const A = [];
      o.areas.forEach((gr) => (gr.areas || []).forEach((a) => A.push({gr, geom: ellipse(...a)})));
      g.append('g').selectAll('path').data(A).join('path').attr('class', (d) => 'area' + (o.focusGroup === d.gr.id ? ' hi' : '')).attr('d', (d) => path(d.geom))
        .on('mousemove', (ev, d) => show(ev, `<b>${esc(d.gr.name)}</b>${esc(d.gr.name_en)}<br>ареал схематично, около 1900 г.<br>${d.gr.mentions} упоминаний в ${d.gr.works} книгах`))
        .on('mouseleave', hide).on('click', (ev, d) => o.onGroup && o.onGroup(d.gr.id));
    }
    const workById = Object.fromEntries((o.works || []).map((w) => [w.id, w]));
    const placeById = Object.fromEntries((o.places || []).map((p) => [p.id, p]));
    // Цвет маршрута — эпоха поездки (светлее — раньше, темнее — позже); один тон, чтобы маршруты читались как один слой.
    const PERC = {'P1 до 1855': 'var(--p1)', 'P2 1856–1880': 'var(--p2)', 'P3 1881–1904': 'var(--p3)', 'P4 1905–1917': 'var(--p4)', 'P5 1918–1930': 'var(--p5)'};
    const col = (w) => PERC[(workById[w] || {}).period] || 'var(--acc)';
    // Разные поездки одной книги (s[6]) — отдельные линии: между концом одной и началом другой автор не ехал.
    // Линия рвётся при смене поездки (s[6]), на остановке без координат и за пределами карты: прямой отрезок через неизвестное — ложный путь.
    const line = (r) => { const segs = []; let cur = [], jj = null; (r.all || r.stops).forEach((s) => { const ok = s[2] != null && s[3] != null && inBox(s); if (!ok || (s[6] || 1) !== jj) { if (cur.length > 1) segs.push(cur); cur = []; } jj = s[6] || 1; if (ok) cur.push([s[2], s[3]]); }); if (cur.length > 1) segs.push(cur); return path({type: 'MultiLineString', coordinates: segs}); };
    if (o.routes) {
      // Линией рисуются только маршруты, восстановленные по тексту или проверенные; черновики — никогда.
      const R = o.routes.filter((r) => r.method === 'manual' && o.showManual !== false && (!o.filter || o.filter(workById[r.work] || {})))
        .map((r) => ({...r, all: r.stops, stops: r.stops.filter((s) => s[2] != null && inBox(s))})).filter((r) => r.stops.length > 1);
      const many = R.length > 30;
      g.append('g').selectAll('path').data(R.filter((r) => r.work !== o.focusWork)).join('path')
        .attr('class', 'route' + (o.animate ? ' draw' : '')).attr('stroke', (r) => col(r.work)).attr('stroke-width', o.routeWidth || 1.8).attr('d', line)
        .attr('pathLength', o.animate ? 1 : null).style('animation-delay', (r, i, a) => o.animate ? (300 + i * Math.min(140, 2400 / Math.max(1, a.length))) + 'ms' : null)
        .style('stroke-opacity', o.focusWork ? .14 : many ? .38 : null).attr('stroke-width', many ? 1.25 : (o.routeWidth || 1.8))
        .on('mousemove', (ev, r) => { const w = workById[r.work] || {}; show(ev, `<b>${esc(w.label || r.work)}</b>${esc(w.author || '')}<br>поездка ${w.j0 || '?'}${w.j1 && w.j1 !== w.j0 ? '–' + w.j1 : ''} · ${esc(w.stay_ru || '')}<br>${r.status === 'verified' ? 'маршрут подтверждён экспертом' : r.status === 'checked' ? 'маршрут проверен по тексту' : 'маршрут восстановлен по тексту'}`); })
        .on('mouseleave', hide).on('click', (ev, r) => o.onWork && o.onWork(r.work));
      const F0 = o.routes.find((r) => r.work === o.focusWork);
      // География выбранной книги: все упомянутые места, круг — число упоминаний. Это не путь.
      if (o.focusWork && o.bookgeo && o.bookgeo[o.focusWork]) {
        const BG = o.bookgeo[o.focusWork].map(([id, n]) => ({p: placeById[id], n})).filter((d) => d.p && inBox([0, 0, d.p.lon, d.p.lat]));
        const r = d3.scaleSqrt().domain([0, d3.max(BG, (d) => d.n) || 1]).range([2, 16]);
        g.append('g').selectAll('circle').data(BG).join('circle').attr('class', 'bgeo').attr('r', (d) => r(d.n))
          .attr('transform', (d) => `translate(${proj([d.p.lon, d.p.lat])})`)
          .on('mousemove', (ev, d) => show(ev, `<b>${esc(d.p.name)}</b>${d.n} упоминаний в этой книге`)).on('mouseleave', hide).on('click', (ev, d) => o.onPlace && o.onPlace(d.p));
      }
      if (F0 && F0.method === 'manual') {
        const F = {...F0, all: F0.stops, stops: F0.stops.filter((s) => s[2] != null && inBox(s))};
        g.append('path').attr('class', 'route hi').attr('stroke', col(F.work)).attr('d', line(F));
        g.append('g').selectAll('circle').data(F.stops).join('circle').attr('r', 3.6).attr('fill', col(F.work)).attr('stroke', 'var(--bg)')
          .attr('transform', (s) => `translate(${proj([s[2], s[3]])})`)
          .on('mousemove', (ev, s) => show(ev, `<b>${esc(s[1])}</b>${s[5] === 'not_found_in_text' ? 'в тексте не найдено' : 'абзац ' + esc(String(+((s[4] || '').split('_p')[1] || 0)))}${(s[8] === 'estimate' || String(s[8]).endsWith('_ctx')) ? '<br>координаты приблизительные' : ''}${s[7] ? '<br>«' + esc(s[7]) + '»' : ''}`)).on('mouseleave', hide);
        g.append('g').selectAll('text').data(F.stops.filter((s, i) => i % Math.max(1, Math.round(F.stops.length / 14)) === 0)).join('text').attr('class', 'mlabel')
          .attr('transform', (s) => { const p = proj([s[2], s[3]]); return `translate(${p[0] + 6},${p[1] - 5})`; }).text((s) => s[1]);
      } else if (F0 && F0.method === 'draft') {
        // Черновик: пронумерованные остановки без соединяющей линии — порядок предполагаемый.
        const F = F0.stops.filter((s) => s[2] != null && inBox(s));
        const gg = g.append('g').selectAll('g').data(F).join('g').attr('class', 'dstop').attr('transform', (s) => `translate(${proj([s[2], s[3]])})`)
          .on('mousemove', (ev, s) => show(ev, `<b>${esc(s[1])}</b>черновик: посещение по тексту ${s[5] === 'higher' ? '(несколько свидетельств)' : '(одно свидетельство)'}`)).on('mouseleave', hide);
        gg.append('circle').attr('r', 7).attr('class', (s) => s[5] === 'higher' ? 'hi' : '');
        gg.append('text').attr('dy', 3.2).attr('text-anchor', 'middle').text((s, i) => i + 1);
      }
    }
    if (o.showPlaces !== false && o.places) {
      const P = o.places.filter((p) => p.sib || ['kazakh_steppe', 'mongolia', 'manchuria', 'urals'].includes(p.region));
      const val = o.placeValue || ((p) => p.mentions);
      const mx = d3.max(P, val) || 1; const r = d3.scaleSqrt().domain([0, mx]).range([1.5, o.placeMax || 14]);
      g.append('g').selectAll('circle').data(P.filter((p) => val(p) > 0)).join('circle').attr('class', 'pcirc').attr('r', (p) => r(val(p)))
        .attr('transform', (p) => `translate(${proj([p.lon, p.lat])})`)
        .on('mousemove', (ev, p) => show(ev, `<b>${esc(p.name)}</b>${p.mentions} упоминаний в ${p.works} книгах` + (p.groups.length ? '<br>рядом описаны: ' + p.groups.slice(0, 4).map((x) => esc(x[0]) + ' (' + x[1] + ')').join(', ') : '')))
        .on('mouseleave', hide).on('click', (ev, p) => o.onPlace && o.onPlace(p));
      if (o.labels !== false) {
        const top = P.slice().sort((a, b) => b.mentions - a.mentions).slice(0, o.nLabels || 16);
        g.append('g').selectAll('text').data(top).join('text').attr('class', 'mlabel').attr('transform', (p) => { const q = proj([p.lon, p.lat]); return `translate(${q[0] + 5},${q[1] + 3})`; }).text((p) => p.name);
      }
    }
    const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', (ev) => { g.attr('transform', ev.transform); g.selectAll('.mlabel').attr('font-size', 11 / ev.transform.k); g.selectAll('.route').attr('stroke-width', function () { return (this.classList.contains('hi') ? 3 : (o.routeWidth || 1.8)) / ev.transform.k; }); g.selectAll('.dstop').attr('transform', function (s) { const p = proj([s[2], s[3]]); return `translate(${p})scale(${1 / ev.transform.k})`; }); });
    if (o.zoom !== false) svg.call(zoom);
    return {svg, proj};
  }
  return {draw, ellipse, PERC: {'P1 до 1855': 'var(--p1)', 'P2 1856–1880': 'var(--p2)', 'P3 1881–1904': 'var(--p3)', 'P4 1905–1917': 'var(--p4)', 'P5 1918–1930': 'var(--p5)'}};
})();
