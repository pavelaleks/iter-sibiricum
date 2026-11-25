/* Карта Сибири на d3-geo без внешних тайлов: суша, реки, озёра (Natural Earth), маршруты, места, ареалы.
   window.SibMap.draw(el, {geo, routes, places, works, areas, focusWork, focusGroup, showAuto, showManual, showPlaces, showAreas, filter, onWork, onPlace}) */
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
    if (o.routes) {
      const R = o.routes.filter((r) => (r.method === 'manual' ? o.showManual !== false : o.showAuto !== false) && (!o.filter || o.filter(workById[r.work] || {})))
        .map((r) => ({...r, stops: r.stops.filter(inBox)})).filter((r) => r.stops.length > 1);
      const line = (r) => path({type: 'LineString', coordinates: r.stops.map((s) => [s[2], s[3]])});
      g.append('g').selectAll('path').data(R.filter((r) => r.work !== o.focusWork)).join('path')
        .attr('class', (r) => 'route' + (r.method === 'auto' ? ' auto' : '')).attr('stroke-width', 1.6).attr('d', line).style('stroke-opacity', (r) => o.autoOpacity && r.method === 'auto' ? o.autoOpacity : null)
        .on('mousemove', (ev, r) => { const w = workById[r.work] || {}; show(ev, `<b>${esc(w.label || r.work)}</b>${esc(w.author || '')}<br>${esc(w.nat_ru || '')} · ${esc(w.stay_ru || '')}<br>${r.method === 'auto' ? 'автомаршрут (по порядку упоминаний), требует проверки' : 'маршрут с абзацами-доказательствами'}`); })
        .on('mouseleave', hide).on('click', (ev, r) => o.onWork && o.onWork(r.work));
      const F0 = R.find((r) => r.work === o.focusWork) || o.routes.find((r) => r.work === o.focusWork);
      const F = F0 && {...F0, stops: F0.stops.filter(inBox)};
      if (F) {
        g.append('path').attr('class', 'route hi').attr('d', line(F));
        g.append('g').selectAll('circle').data(F.stops).join('circle').attr('r', 3.6).attr('fill', 'var(--acc)').attr('stroke', 'var(--bg)')
          .attr('transform', (s) => `translate(${proj([s[2], s[3]])})`)
          .on('mousemove', (ev, s) => show(ev, `<b>${esc(s[1])}</b>${s[5] === 'not_found_in_text' ? 'в тексте не найдено' : 'абзац ' + esc(s[4] || '')}`)).on('mouseleave', hide);
        g.append('g').selectAll('text').data(F.stops.filter((s, i) => i % Math.max(1, Math.round(F.stops.length / 14)) === 0)).join('text').attr('class', 'mlabel')
          .attr('transform', (s) => { const p = proj([s[2], s[3]]); return `translate(${p[0] + 6},${p[1] - 5})`; }).text((s) => s[1]);
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
    const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', (ev) => { g.attr('transform', ev.transform); g.selectAll('.mlabel').attr('font-size', 11 / ev.transform.k); g.selectAll('.route').attr('stroke-width', function () { return (this.classList.contains('hi') ? 3 : 1.6) / ev.transform.k; }); });
    if (o.zoom !== false) svg.call(zoom);
    return {svg, proj};
  }
  return {draw, ellipse};
})();
