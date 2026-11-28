/* Вкладка «Связи»: две сети с доказательствами.
   1) «Кого видят вместе» — группы, названные в одном предложении абзаца о Сибири (data/net/groups.json, предложения — groups_ev.json).
   2) «На кого опираются» — ссылки на предшественников и текстовые заимствования между книгами (data/net/intertext.json).
   Сеть пересчитывается в браузере для любого периода, страны автора или одной книги; у каждой связи — предложения или
   абзацы, из которых она получена. Плоский граф (d3) по умолчанию, объёмный (3d-force-graph) — по кнопке.
   Данные собирает pipeline/tools/network_data.py. window.Links.render(V, ctx). */
window.Links = (() => {
  const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
  const cache = {};
  const getText = (w) => (cache['t:' + w] ||= fetch(`texts/${w}.json`).then((r) => r.json()).then((d) => Object.fromEntries(d.p.map((p) => [p[0], p[4]]))).catch(() => ({})));
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  async function render(V, C) {
    const {get, esc, toH, fmt, PER, NAT, EN, CATC} = C;
    const T = (ru, en) => (EN ? en : ru);
    const nm = (s) => (EN && window.I18N && I18N.tr ? I18N.tr(String(s ?? '')) || s : s);
    const CATN = (window.CATS || {})[EN ? 'en' : 'ru'] || {};
    const cap = (x) => x ? x[0].toUpperCase() + x.slice(1) : x;
    V.innerHTML = `<div class="wrap loading">${T('Загрузка…', 'Loading…')}</div>`;
    const [GN, IT, GR] = await Promise.all([get('net/groups.json'), get('net/intertext.json'), get('groups.json')]);
    const WK = GN.works, PERK = Object.keys(PER), NATK = [...new Set(Object.values(WK).map((w) => w.nat))];
    const GRP = Object.fromEntries(GN.nodes.map((n) => [n.id, n]));
    const gName = (id) => GRP[id] ? (EN ? GRP[id].name_en : GRP[id].name) : id;
    const wLab = (w) => WK[w] ? WK[w].label : w;
    const natName = (k) => nm(NAT[k] || k);
    const pLink = (w, pid) => `#book-${toH(w)}-p${pid}`;
    // формы названий групп в источниках — для подсветки в предложениях
    const FORMS = {};
    for (const g of GR) { const f = [...new Set([...(g.forms || []).map((x) => (Array.isArray(x) ? x[0] : x)), g.name_en].filter((x) => x && x.length > 2))].sort((a, b) => b.length - a.length);
      if (f.length) FORMS[g.id] = new RegExp('(^|[^\\p{L}])(' + f.map((x) => reEsc(x.slice(0, Math.max(4, x.length - 2)))).join('|') + ')(\\p{L}*)', 'giu'); }
    const mark = (txt, ids) => { let h = esc(txt); for (const id of ids) if (FORMS[id]) h = h.replace(FORMS[id], (m, a, b, c) => `${a}<mark>${b}${c}</mark>`); return h; };

    // ---------- состояние (в адресе: ссылку на вид можно переслать) ----------
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const st = {m: q.get('m') === 'i' ? 'i' : 'g', per: PER[q.get('per')] ? q.get('per') : '', cmp: PER[q.get('cmp')] ? q.get('cmp') : '', nat: NATK.includes(q.get('nat')) ? q.get('nat') : '',
      w: WK[q.get('w')] ? q.get('w') : '', ms: q.get('ms') === 's' ? 's' : 'n', min: Math.max(1, Math.min(20, +q.get('min') || (q.get('m') === 'i' ? 1 : 2))), hr: q.get('hr') === '1', v: q.get('v') === '3d' ? '3d' : '2d',
      ty: q.get('ty') || 'cr', sel: q.get('sel') || ''};
    const save = () => { const o = {m: st.m === 'i' ? 'i' : '', per: st.per, cmp: st.m === 'g' ? st.cmp : '', nat: st.nat, w: st.m === 'g' ? st.w : '', ms: st.ms === 's' ? 's' : '', min: st.min !== (st.m === 'i' ? 1 : 2) ? st.min : '', hr: st.hr ? '1' : '', v: st.v === '3d' ? '3d' : '', ty: st.m === 'i' && st.ty !== 'cr' ? st.ty : '', sel: st.sel};
      const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString(); history.replaceState(null, '', '#links' + (s ? '?' + s : '')); };

    // цвета из темы сайта (нужны и для 3D, где CSS-переменные недоступны)
    const probe = document.createElement('i'); probe.style.display = 'none'; document.body.appendChild(probe);
    const cssColor = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
    let PC = PERK.map((p, i) => cssColor('--p' + (i + 1))), ACC = cssColor('--acc'), ACC2 = cssColor('--acc2'), MUTE = cssColor('--mute');
    const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const worksSorted = Object.entries(WK).sort((a, b) => a[1].year - b[1].year);

    V.innerHTML = `<section class="band"><div class="wrap lk">
      <h1>${T('Связи', 'Networks')}</h1>
      <p class="lede">${T('Две сети, построенные по текстам корпуса. У каждой связи есть основание в тексте: щёлкните по ней, чтобы увидеть предложения или абзацы и перейти к ним в книге.', 'Two networks built from the texts of the corpus. Every link rests on the text: click it to see the sentences or paragraphs and go to them in the book.')}</p>
      <div class="lk-modes" role="tablist">
        <button role="tab" data-m="g"><b>${T('Кого видят вместе', 'Who is seen together')}</b><span>${T('народы и группы, названные в одном предложении о Сибири', 'peoples and groups named in the same sentence about Siberia')}</span></button>
        <button role="tab" data-m="i"><b>${T('На кого опираются', 'Whom authors rely on')}</b><span>${T('ссылки на предшественников и текстовые заимствования', 'references to predecessors and text reuse')}</span></button>
      </div>
      <div class="lk-ctl" id="lkc"></div>
      <div class="lk-grid">
        <div class="lk-graph" id="lkg"><div class="lk-tip" id="lktip" hidden></div><div class="lk-tools"><button id="lkFit" title="${T('Показать всю сеть', 'Fit the whole network')}">⤢</button><button id="lkV">${st.v === '3d' ? T('плоский вид', 'flat view') : T('объёмный вид', '3D view')}</button></div></div>
        <aside class="lk-panel" id="lkp" aria-live="polite"></aside>
      </div>
      <div class="lk-legend" id="lkl"></div>
      <div class="lk-foot small mute"><button class="lnk" id="lkLink">${T('Скопировать ссылку на этот вид', 'Copy a link to this view')}</button> · <button class="lnk" id="lkCsv">${T('Скачать сеть (CSV для Gephi, R, Python)', 'Download the network (CSV for Gephi, R, Python)')}</button></div>
    </div></section>`;
    const $ = (id) => document.getElementById(id);
    const box = $('lkg'), tip = $('lktip'), panel = $('lkp');

    // ================= расчёт сетей =================
    const inWorks = () => Object.keys(WK).filter((w) => st.w ? w === st.w : (!st.per || WK[w].period === st.per) && (!st.nat || WK[w].nat === st.nat));
    const worksOf = (per) => new Set(Object.keys(WK).filter((w) => WK[w].period === per && (!st.nat || WK[w].nat === st.nat)));
    function groupNet(WS) {
      const m = {}, mb = {};
      for (const n of GN.nodes) { let s = 0, b = 0; for (const [w, c] of Object.entries(n.w)) if (WS.has(w)) { s += c; b++; } m[n.id] = s; mb[n.id] = b; }
      const E = [];
      for (const e of GN.edges) {
        if (st.hr && (e.a === 'russian' || e.b === 'russian')) continue;
        let n = 0; const bw = []; for (const [w, c] of Object.entries(e.w)) if (WS.has(w)) { n += c; bw.push(w); }
        if (!n) continue;
        const ma = Math.max(m[e.a], n), mbb = Math.max(m[e.b], n);
        E.push({a: e.a, b: e.b, n, books: bw, s: n / Math.sqrt(ma * mbb), src: e});
      }
      return {m, mb, E};
    }
    // посредническая центральность (Брандес, без весов) — кто соединяет группы, которые иначе не встречаются вместе
    function betweenness(ids, adj) {
      const B = Object.fromEntries(ids.map((i) => [i, 0]));
      for (const s of ids) {
        const S = [], P = {}, sg = {}, d = {}; ids.forEach((v) => { P[v] = []; sg[v] = 0; d[v] = -1; }); sg[s] = 1; d[s] = 0; const Q = [s];
        while (Q.length) { const v = Q.shift(); S.push(v); for (const w of adj[v] || []) { if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; } if (d[w] === d[v] + 1) { sg[w] += sg[v]; P[w].push(v); } } }
        const dl = {}; ids.forEach((v) => (dl[v] = 0));
        while (S.length) { const w = S.pop(); for (const v of P[w]) dl[v] += (sg[v] / sg[w]) * (1 + dl[w]); if (w !== s) B[w] += dl[w]; }
      }
      const n = ids.length, k = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1; ids.forEach((i) => (B[i] *= k)); return B;
    }
    let NET = null;   // текущая сеть: {nodes, links, ...}
    function buildGroups() {
      const cmp = !!(st.cmp && st.per && st.cmp !== st.per && !st.w);
      const A = groupNet(cmp ? worksOf(st.per) : new Set(inWorks()));
      const B = cmp ? groupNet(worksOf(st.cmp)) : null;
      const val = (e) => (st.ms === 's' ? e.s : e.n);
      const L = new Map();
      for (const e of A.E) if (e.n >= st.min || cmp) L.set(e.a + '|' + e.b, {key: e.a + '|' + e.b, source: e.a, target: e.b, A: e, B: null});
      if (B) for (const e of B.E) { const k = e.a + '|' + e.b; if (L.has(k)) L.get(k).B = e; else L.set(k, {key: k, source: e.a, target: e.b, A: null, B: e}); }
      let links = [...L.values()];
      if (cmp) links = links.filter((l) => Math.max(l.A ? l.A.n : 0, l.B ? l.B.n : 0) >= st.min);
      links.forEach((l) => { l.v = Math.max(l.A ? val(l.A) : 0, l.B ? val(l.B) : 0); l.st = cmp ? (l.A && l.B ? 'ab' : l.A ? 'a' : 'b') : ''; });
      const ids = [...new Set(links.flatMap((l) => [l.source, l.target]))];
      const adj = {}; links.forEach((l) => { (adj[l.source] ||= []).push(l.target); (adj[l.target] ||= []).push(l.source); });
      const bt = betweenness(ids, adj);
      const m = (id) => A.m[id] + (B ? B.m[id] : 0);
      const nodes = ids.map((id) => ({id, label: gName(id), cat: GRP[id].cat, m: m(id), books: A.mb[id] + (B ? B.mb[id] : 0), deg: adj[id].length,
        wdeg: links.filter((l) => l.source === id || l.target === id).reduce((s, l) => s + (l.A ? l.A.n : 0) + (l.B ? l.B.n : 0), 0), bt: bt[id], color: CATC[GRP[id].cat] || MUTE}));
      const mx = Math.max(1, ...nodes.map((n) => n.m)), mv = Math.max(1e-9, ...links.map((l) => l.v));
      nodes.forEach((n) => (n.r = 4 + 17 * Math.sqrt(n.m / mx)));
      links.forEach((l) => { l.w = 0.7 + 5.5 * Math.sqrt(l.v / mv); l.k = l.v / mv; l.color = l.st === 'a' ? ACC2 : l.st === 'b' ? ACC : null; });
      const nW = cmp ? worksOf(st.per).size + worksOf(st.cmp).size : inWorks().length;
      NET = {kind: 'g', cmp, nodes, links, A, B, nWorks: nW, nSent: links.reduce((s, l) => s + (l.A ? l.A.n : 0) + (l.B ? l.B.n : 0), 0)};
    }
    function buildIntertext() {
      const ok = (w) => WK[w] && (!st.per || WK[w].period === st.per) && (!st.nat || WK[w].nat === st.nat);
      const links = IT.links.filter((l) => st.ty.includes(l.type === 'cites' ? 'c' : 'r') && ok(l.s) && (l.type !== 'cites' || l.n >= st.min))
        .map((l) => ({...l, key: `${l.s}>${l.t}>${l.type}`, source: l.s, target: l.t}));
      const ids = new Set(links.flatMap((l) => [l.s, l.t]));
      const NI = Object.fromEntries(IT.nodes.map((n) => [n.id, n]));
      const ind = {}, outd = {}; links.forEach((l) => { (ind[l.t] ||= new Set()).add(l.s); (outd[l.s] ||= new Set()).add(l.t); });
      const nodes = [...ids].map((id) => { const n = NI[id]; const yr = n.kind === 'work' ? n.year : (n.year || Math.min(...[...(ind[id] || [])].map((s) => WK[s].year)) - 8);
        return {id, kind: n.kind, label: n.label, year: yr, yearKnown: n.kind === 'work' || !!n.year, period: n.period, nat: n.nat, in: (ind[id] || new Set()).size, out: (outd[id] || new Set()).size,
          color: n.kind === 'work' ? PC[PERK.indexOf(n.period)] || MUTE : MUTE}; });
      nodes.forEach((n) => (n.r = 3.5 + 2.6 * Math.sqrt(n.in + n.out)));
      const mv = Math.max(1, ...links.map((l) => l.n));
      links.forEach((l) => { l.w = l.type === 'reuse' ? 1 + 2.4 * Math.sqrt(l.n / mv) : 0.7 + 2 * Math.sqrt(l.n / mv); l.color = l.type === 'reuse' ? ACC : MUTE; l.k = l.n / mv; });
      const isolated = Object.keys(WK).filter((w) => ok(w) && !ids.has(w)).length;
      NET = {kind: 'i', nodes, links, isolated, nWorks: Object.keys(WK).filter(ok).length};
    }
    const build = () => (st.m === 'g' ? buildGroups() : buildIntertext());

    // ================= элементы управления =================
    function controls() {
      document.querySelectorAll('[data-m]').forEach((b) => { b.classList.toggle('on', b.dataset.m === st.m); b.setAttribute('aria-selected', b.dataset.m === st.m); });
      const perOpts = [['', T('все периоды', 'all periods')], ...PERK.map((p) => [p, PER[p]])];
      const natOpts = [['', T('все страны', 'all countries')], ...NATK.map((k) => [k, natName(k)])];
      const one = !!st.w;
      $('lkc').innerHTML = st.m === 'g' ? `
        <label>${T('Период поездки', 'Period of journey')}<select id="cPer"${one ? ' disabled' : ''}>${opt(perOpts, st.per)}</select></label>
        <label>${T('сравнить с', 'compare with')}<select id="cCmp"${one || !st.per ? ' disabled' : ''}>${opt([['', '—'], ...PERK.filter((p) => p !== st.per).map((p) => [p, PER[p]])], st.cmp)}</select></label>
        <label>${T('Страна автора', 'Author’s country')}<select id="cNat"${one ? ' disabled' : ''}>${opt(natOpts, st.nat)}</select></label>
        <label class="wide">${T('Одна книга', 'One book')}<select id="cW">${opt([['', T('все книги', 'all books')], ...worksSorted.filter(([w]) => GN.edges.some((e) => e.w[w])).map(([w, m]) => [w, `${m.label} — ${m.author}`])], st.w)}</select></label>
        <label>${T('Толщина связи', 'Link weight')}<select id="cMs">${opt([['n', T('число предложений', 'number of sentences')], ['s', T('сила с поправкой на частоту', 'strength adjusted for frequency')]], st.ms)}</select></label>
        <label><span>${T('Не меньше', 'At least')} <b id="cMinV">${st.min}</b> ${T('предл. на связь', 'sent. per link')}</span><input type="range" id="cMin" min="1" max="15" value="${st.min}"></label>
        <label class="chk"><input type="checkbox" id="cHr"${st.hr ? ' checked' : ''}> ${T('без русских', 'without Russians')}</label>
        <label>${T('Найти', 'Find')}<input type="search" id="cQ" list="cQl" placeholder="${T('народ или группа', 'people or group')}"><datalist id="cQl">${GN.nodes.map((n) => `<option value="${esc(gName(n.id))}">`).join('')}</datalist></label>`
      : `
        <label>${T('Период книги', 'Period of the book')}<select id="cPer">${opt(perOpts, st.per)}</select></label>
        <label>${T('Страна автора', 'Author’s country')}<select id="cNat">${opt(natOpts, st.nat)}</select></label>
        <label class="chk"><input type="checkbox" id="cTc"${st.ty.includes('c') ? ' checked' : ''}> ${T('ссылки', 'references')}</label>
        <label class="chk"><input type="checkbox" id="cTr"${st.ty.includes('r') ? ' checked' : ''}> ${T('заимствования', 'text reuse')}</label>
        <label><span>${T('Упоминаний не меньше', 'Mentions at least')} <b id="cMinV">${st.min}</b></span><input type="range" id="cMin" min="1" max="10" value="${st.min}"></label>
        <label>${T('Найти', 'Find')}<input type="search" id="cQ" list="cQl" placeholder="${T('книга или автор', 'book or author')}"><datalist id="cQl">${IT.nodes.map((n) => `<option value="${esc(n.label)}">`).join('')}</datalist></label>`;
      const on = (id, ev, f) => { const e = $(id); if (e) e.addEventListener(ev, f); };
      on('cPer', 'change', (e) => { st.per = e.target.value; if (st.cmp === st.per || !st.per) st.cmp = ''; refresh(true); });
      on('cCmp', 'change', (e) => { st.cmp = e.target.value; refresh(true); });
      on('cNat', 'change', (e) => { st.nat = e.target.value; refresh(true); });
      on('cW', 'change', (e) => { st.w = e.target.value; st.cmp = ''; refresh(true); });
      on('cMs', 'change', (e) => { st.ms = e.target.value; refresh(false); });
      on('cMin', 'input', (e) => { $('cMinV').textContent = e.target.value; });
      on('cMin', 'change', (e) => { st.min = +e.target.value; refresh(false); });
      on('cHr', 'change', (e) => { st.hr = e.target.checked; refresh(false); });
      on('cTc', 'change', (e) => { st.ty = (e.target.checked ? 'c' : '') + (st.ty.includes('r') ? 'r' : ''); refresh(false); });
      on('cTr', 'change', (e) => { st.ty = (st.ty.includes('c') ? 'c' : '') + (e.target.checked ? 'r' : ''); refresh(false); });
      on('cQ', 'change', (e) => { const v = e.target.value.trim().toLowerCase(); if (!v) return;
        const n = NET.nodes.find((x) => x.label.toLowerCase() === v) || NET.nodes.find((x) => x.label.toLowerCase().includes(v) || (st.m === 'i' && x.kind === 'work' && (WK[x.id].author || '').toLowerCase().includes(v)));
        if (n) { select('n:' + n.id); G2 && G2.focus(n.id); } else panelMsg(T('В текущей сети такого узла нет: возможно, он скрыт фильтрами.', 'No such node in the current network; it may be hidden by the filters.')); });
    }

    // ================= граф: плоский (d3) =================
    let G2 = null, G3 = null;
    const nbr = () => { const A = {}; NET.links.forEach((l) => { const s = l.source.id || l.source, t = l.target.id || l.target; (A[s] ||= new Set()).add(t); (A[t] ||= new Set()).add(s); }); return A; };
    function flat() {
      const d3 = window.d3; const W = () => box.clientWidth, H = () => box.clientHeight;
      const svg = d3.select(box).insert('svg', ':first-child').attr('class', 'lk-svg').attr('role', 'img');
      const defs = svg.append('defs');
      const root = svg.append('g'), gAxis = root.append('g').attr('class', 'lk-axis'), gL = root.append('g'), gN = root.append('g');
      const zoom = d3.zoom().scaleExtent([0.25, 8]).on('zoom', (e) => { root.attr('transform', e.transform); labelVis(e.transform.k); });
      svg.call(zoom).on('dblclick.zoom', null);
      svg.on('click', (e) => { if (e.target === svg.node()) select(''); });
      let sim = null, pos = {}, nodeSel, linkSel, hitSel, labSel, AD = {}, fitted = false, kNow = 1;
      const mk = (c) => { const id = 'ar' + c.replace(/\W/g, ''); if (!defs.select('#' + id).size()) defs.append('marker').attr('id', id).attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('refY', 0).attr('markerWidth', 4).attr('markerHeight', 4).attr('orient', 'auto').append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', c); return `url(#${id})`; };
      function labelVis(k) {
        kNow = k; if (!labSel) return;
        const big = new Set(NET.nodes.slice().sort((a, b) => b.r - a.r).slice(0, NET.kind === 'g' ? 60 : Math.round(18 * k)).map((n) => n.id));
        const z = Math.max(0.8, k);   // подписи держат экранный размер ≈12 px при любом масштабе
        labSel.attr('display', (d) => (big.has(d.id) || d.r * k > 9 || hl.has(d.id) ? null : 'none')).style('font-size', (12 / z).toFixed(2) + 'px').style('stroke-width', (3.5 / z).toFixed(2) + 'px').attr('dy', (d) => d.r + 11 / z);
      }
      let hl = new Set();
      function draw() {
        AD = nbr();
        NET.nodes.forEach((n) => { const p = pos[n.id]; if (p) { n.x = p.x; n.y = p.y; } });
        const time = NET.kind === 'i';
        const yrs = time ? NET.nodes.map((n) => n.year) : [];
        const xs = time ? d3.scaleLinear().domain([Math.min(...yrs) - 3, Math.max(...yrs) + 3]).range([-W() * 0.55, W() * 0.55]) : null;
        gAxis.selectAll('*').remove();
        const axis = () => { gAxis.selectAll('*').remove(); if (!time || !NET.nodes.length) return; const ys = NET.nodes.map((n) => n.y), y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 20;
          const t0 = Math.ceil(xs.domain()[0] / 20) * 20; for (let y = t0; y <= xs.domain()[1]; y += 20) { gAxis.append('line').attr('x1', xs(y)).attr('x2', xs(y)).attr('y1', y0).attr('y2', y1); gAxis.append('text').attr('x', xs(y) + 4).attr('y', y0 + 12).text(y); } };
        linkSel = gL.selectAll('line.l').data(NET.links, (d) => d.key).join('line').attr('class', (d) => 'l' + (d.st ? ' s-' + d.st : '') + (d.type ? ' t-' + d.type : ''))
          .attr('stroke-width', (d) => d.w).style('stroke', (d) => d.color || null).style('--o', (d) => (0.12 + 0.6 * Math.sqrt(d.k || 0)).toFixed(2)).attr('marker-end', (d) => (time ? mk(d.color) : null));
        hitSel = gL.selectAll('line.hit').data(NET.links, (d) => d.key).join('line').attr('class', 'hit')
          .on('mousemove', (e, d) => showTip(e, linkTip(d))).on('mouseleave', hideTip).on('click', (e, d) => { e.stopPropagation(); select('e:' + d.key); });
        const ng = gN.selectAll('g.n').data(NET.nodes, (d) => d.id).join((en) => { const g = en.append('g').attr('class', 'n'); g.append('circle'); g.append('text'); return g; });
        nodeSel = ng.attr('class', (d) => 'n k-' + (d.kind || 'g')).attr('tabindex', 0).attr('aria-label', (d) => d.label)
          .on('mousemove', (e, d) => { showTip(e, nodeTip(d)); hover(d.id); }).on('mouseleave', () => { hideTip(); hover(null); })
          .on('click', (e, d) => { e.stopPropagation(); select('n:' + d.id); }).on('keydown', (e, d) => { if (e.key === 'Enter') select('n:' + d.id); })
          .call(d3.drag().on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.2).restart(); d.fx = d.x; d.fy = d.y; }).on('drag', (e, d) => { d.fx = d._fx ?? e.x; d.fy = e.y; }).on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = d._fx ?? null; d.fy = null; }));
        ng.select('circle').attr('r', (d) => d.r).attr('fill', (d) => d.color);
        labSel = ng.select('text').text((d) => d.label);
        if (sim) sim.stop();
        NET.nodes.forEach((n) => { n._fx = time && n.yearKnown ? xs(n.year) : null; n.fx = n._fx; if (n._fx != null) n.x = n._fx; });   // на шкале времени год задаёт положение по горизонтали
        const mv = Math.max(...NET.links.map((l) => l.k), 1e-9);
        sim = d3.forceSimulation(NET.nodes)
          .force('link', d3.forceLink(NET.links).id((d) => d.id).distance((l) => (time ? 40 : 55 + 150 * (1 - Math.sqrt(l.k / mv)))).strength((l) => (time ? 0.08 : 0.15 + 0.6 * Math.sqrt(l.k / mv))))
          .force('charge', d3.forceManyBody().strength(time ? -55 : -380))
          .force('collide', d3.forceCollide((d) => d.r + (time ? 4 : 16)))
          .force('x', time ? d3.forceX((d) => xs(d.year)).strength((d) => (d.yearKnown ? 1 : 0.3)) : d3.forceX(0).strength(0.04))
          .force('y', d3.forceY(0).strength(time ? 0.025 : 0.06))
          .stop();
        // раскладка считается заранее, чтобы граф появлялся сразу в окончательном виде, а не «расползался»
        sim.alpha(Object.keys(pos).length && fitted ? 0.4 : 1); for (let i = 0; i < 320; i++) sim.tick();
        tick(); axis(); if (!fitted) { fit(0); fitted = true; }
        sim.on('tick', tick).alpha(0).restart();
        labelVis(kNow); paintSel();
      }
      function tick() {
        const time = NET.kind === 'i';
        const ends = (d) => { if (!time) return [d.source.x, d.source.y, d.target.x, d.target.y]; const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, L = Math.hypot(dx, dy) || 1, r = d.target.r + 2; return [d.source.x, d.source.y, d.target.x - (dx / L) * r, d.target.y - (dy / L) * r]; };
        linkSel.each(function (d) { const [a, b, c, e] = ends(d); this.setAttribute('x1', a); this.setAttribute('y1', b); this.setAttribute('x2', c); this.setAttribute('y2', e); });
        hitSel.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
        nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`);
        NET.nodes.forEach((n) => (pos[n.id] = {x: n.x, y: n.y}));
      }
      function fit(ms = 600) {
        if (!NET.nodes.length) return; const xs = NET.nodes.map((n) => n.x), ys = NET.nodes.map((n) => n.y);
        const x0 = Math.min(...xs) - 90, x1 = Math.max(...xs) + 90, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 50;
        const k = Math.min(2, 0.95 * Math.min(W() / (x1 - x0), H() / (y1 - y0)));
        svg.transition().duration(ms).call(zoom.transform, d3.zoomIdentity.translate(W() / 2 - (k * (x0 + x1)) / 2, H() / 2 - (k * (y0 + y1)) / 2).scale(k));
      }
      function hover(id) { hl = id ? new Set([id, ...(AD[id] || [])]) : selSet(); paintSel(); }
      function selSet() { if (!st.sel) return new Set(); if (st.sel.startsWith('n:')) { const id = st.sel.slice(2); return new Set([id, ...(AD[id] || [])]); } const k = st.sel.slice(2); const l = NET.links.find((x) => x.key === k); return l ? new Set([l.source.id, l.target.id]) : new Set(); }
      function paintSel() {
        if (!nodeSel) return; const on = hl.size > 0, sk = st.sel.startsWith('e:') ? st.sel.slice(2) : null, sn = st.sel.startsWith('n:') ? st.sel.slice(2) : null;
        nodeSel.classed('dim', (d) => on && !hl.has(d.id)).classed('sel', (d) => d.id === sn);
        linkSel.classed('dim', (d) => on && !(hl.has(d.source.id) && hl.has(d.target.id) && (!sn || d.source.id === sn || d.target.id === sn) || d.key === sk)).classed('sel', (d) => d.key === sk);
        labelVis(kNow);
      }
      new ResizeObserver(() => svg.attr('width', W()).attr('height', H())).observe(box);
      return {draw: () => { fitted = false; draw(); }, redraw: draw, fit, paint: () => { hl = selSet(); paintSel(); }, focus: (id) => { const n = NET.nodes.find((x) => x.id === id); if (n) { const k = 1.6; svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(W() / 2 - k * n.x, H() / 2 - k * n.y).scale(k)); } }, destroy: () => { if (sim) sim.stop(); svg.remove(); }};
    }

    // ================= граф: объёмный (3d-force-graph) =================
    async function solid() {
      if (!window.ForceGraph3D) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'assets/vendor/3d-force-graph.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const el = document.createElement('div'); el.className = 'lk-3d'; box.insertBefore(el, box.firstChild);
      const FG = ForceGraph3D()(el).showNavInfo(false).backgroundColor('rgba(0,0,0,0)').width(box.clientWidth).height(box.clientHeight)
        .nodeLabel((n) => nodeTip(n)).linkLabel((l) => linkTip(l)).nodeColor('color').nodeVal((n) => n.r * n.r / 6).nodeOpacity(0.95).nodeRelSize(2)
        .linkWidth((l) => l.w / 2.2).linkOpacity(0.45).linkColor((l) => l.color || MUTE).linkDirectionalArrowLength((l) => (NET.kind === 'i' ? 3 : 0)).linkDirectionalArrowRelPos(1)
        .onNodeClick((n) => select('n:' + n.id)).onLinkClick((l) => select('e:' + l.key)).onBackgroundClick(() => select(''))
        .cooldownTicks(160).onEngineStop(() => { if (FG.__fit) { FG.__fit = false; FG.zoomToFit(500, 30); } });
      const ro = new ResizeObserver(() => FG.width(box.clientWidth).height(box.clientHeight)); ro.observe(box);
      // подписи крупных узлов: HTML-слой поверх сцены; подпись, которая наложилась бы на уже поставленную, скрывается
      const lab = document.createElement('div'); lab.className = 'g3lab'; lab.setAttribute('aria-hidden', 'true'); el.appendChild(lab);
      let big = [], live = true;
      const loop = () => { if (!live) return;
        const placed = [], sp = lab.children, Wd = el.clientWidth, Hd = el.clientHeight;
        big.forEach((n, i) => { const e = sp[i]; if (!e || n.x == null) return; const c = FG.graph2ScreenCoords(n.x, n.y, n.z), w = e._w || (e._w = e.offsetWidth), x0 = c.x - w / 2, y0 = c.y + 10;
          const bx = [x0 - 3, y0 - 2, x0 + w + 3, y0 + 17], free = !placed.some((q) => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1]), show = free && c.x > 0 && c.x < Wd && c.y > 0 && c.y < Hd;
          if (show) placed.push(bx); e.style.opacity = show ? 1 : 0; e.style.transform = `translate(${Math.round(x0)}px,${Math.round(y0)}px)`; });
        requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      const draw = () => { FG.__fit = true; const nodes = NET.nodes.map((n) => ({...n, fx: undefined, fy: undefined, x: undefined, y: undefined, vx: undefined, vy: undefined}));
        FG.graphData({nodes, links: NET.links.map((l) => ({...l, source: l.source.id || l.source, target: l.target.id || l.target}))});
        big = nodes.slice().sort((a, b) => b.r - a.r).slice(0, NET.kind === 'g' ? 22 : 16); lab.innerHTML = big.map((n) => `<span>${esc(n.label)}</span>`).join(''); };
      return {draw, redraw: draw, fit: () => FG.zoomToFit(500, 30), paint() {}, focus() {}, destroy: () => { live = false; ro.disconnect(); try { FG._destructor(); } catch (e) {} el.remove(); }};
    }
    async function mountView() {
      if (G2) { G2.destroy(); G2 = null; } if (G3) { G3.destroy(); G3 = null; }
      $('lkV').textContent = st.v === '3d' ? T('плоский вид', 'flat view') : T('объёмный вид', '3D view');
      if (st.v === '3d') { try { G3 = await solid(); G3.draw(); return; } catch (e) { st.v = '2d'; } }
      G2 = flat(); G2.draw();
    }
    const view = () => G3 || G2;

    // ================= подсказки =================
    function showTip(e, html) { tip.innerHTML = html; tip.hidden = false; const r = box.getBoundingClientRect(); let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if (x + tip.offsetWidth > r.width - 6) x = e.clientX - r.left - tip.offsetWidth - 10; if (y + tip.offsetHeight > r.height - 6) y = e.clientY - r.top - tip.offsetHeight - 10; tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px'; }
    function hideTip() { tip.hidden = true; }
    const partners = (id) => NET.links.filter((l) => (l.source.id || l.source) === id || (l.target.id || l.target) === id).map((l) => [(l.source.id || l.source) === id ? (l.target.id || l.target) : (l.source.id || l.source), l]).sort((a, b) => b[1].v - a[1].v);
    function nodeTip(d) {
      if (NET.kind === 'g') { const p = partners(d.id).slice(0, 3).map(([o, l]) => `${esc(gName(o))} (${(l.A ? l.A.n : 0) + (l.B ? l.B.n : 0)})`).join(', ');
        return `<b>${esc(d.label)}</b><span>${esc(cap(CATN[d.cat] || ''))}</span><span>${fmt(d.m)} ${T(plural(d.m, 'упоминание', 'упоминания', 'упоминаний'), 'mentions')} · ${d.books} ${T(plural(d.books, 'книга', 'книги', 'книг'), 'books')} · ${d.deg} ${T(plural(d.deg, 'связь', 'связи', 'связей'), 'links')}</span>${p ? `<span>${T('чаще всего вместе с', 'most often with')}: ${p}</span>` : ''}<em>${T('щёлкните — подробности и примеры', 'click for details and examples')}</em>`; }
      if (d.kind === 'work') { const w = WK[d.id]; return `<b>${esc(d.label)}</b><span>${esc(w.author)} · ${esc(natName(w.nat))}</span><span>${T('ссылается на', 'refers to')} ${d.out} · ${T('на неё ссылаются', 'referred to by')} ${d.in}</span><em>${T('щёлкните — подробности', 'click for details')}</em>`; }
      return `<b>${esc(d.label)}</b><span>${T('автор вне корпуса', 'author outside the corpus')}${d.yearKnown ? ` · ${T('известен с', 'known from')} ~${d.year}` : ''}</span><span>${T('упоминают', 'mentioned in')} ${d.in} ${T(plural(d.in, 'книга', 'книги', 'книг'), 'books')}</span><em>${T('щёлкните — подробности', 'click for details')}</em>`;
    }
    function linkTip(l) {
      const s = l.source.id || l.source, t = l.target.id || l.target;
      if (NET.kind === 'g') {
        const nA = l.A ? l.A.n : 0, nB = l.B ? l.B.n : 0;
        const cnt = NET.cmp ? `${PER[st.per]}: ${nA} · ${PER[st.cmp]}: ${nB}` : `${nA} ${T(plural(nA, 'предложение', 'предложения', 'предложений'), 'sentences')} · ${l.A.books.length} ${T(plural(l.A.books.length, 'книга', 'книги', 'книг'), 'books')}`;
        return `<b>${esc(gName(s))} — ${esc(gName(t))}</b><span>${cnt}</span>${st.ms === 's' && l.A ? `<span>${T('сила связи', 'strength')}: ${fmt(l.A.s * 100, 1)}</span>` : ''}<em>${T('щёлкните — предложения из книг', 'click for the sentences')}</em>`;
      }
      const lb = (id) => esc((NET.nodes.find((n) => n.id === id) || {}).label || id);
      return `<b>${lb(s)} → ${lb(t)}</b><span>${l.type === 'cites' ? `${T('упоминание', 'mentions')}: ${l.n}` : `${T('общих отрывков', 'shared passages')}: ${l.n}`}</span><em>${T('щёлкните — тексты', 'click for the texts')}</em>`;
    }

    // ================= панель =================
    function panelMsg(t) { const p = panel.querySelector('.lk-msg'); if (p) p.textContent = t; else panel.insertAdjacentHTML('afterbegin', `<p class="lk-msg small">${esc(t)}</p>`); }
    function select(s) { st.sel = s; save(); view() && view().paint(); renderPanel(); }
    const close = `<button class="lk-x" id="lkX" aria-label="${T('Закрыть', 'Close')}">×</button>`;
    const bar = (v, mx) => `<i class="lk-bar" style="width:${Math.max(2, Math.round((100 * v) / (mx || 1)))}%"></i>`;
    function renderPanel() {
      const s = st.sel;
      if (s.startsWith('n:') && NET.nodes.some((n) => n.id === s.slice(2))) return NET.kind === 'g' ? panelGroup(s.slice(2)) : panelBook(s.slice(2));
      if (s.startsWith('e:') && NET.links.some((l) => l.key === s.slice(2))) return NET.kind === 'g' ? panelPair(NET.links.find((l) => l.key === s.slice(2))) : panelCite(NET.links.find((l) => l.key === s.slice(2)));
      if (s) { st.sel = ''; save(); }
      NET.kind === 'g' ? overviewG() : overviewI();
    }
    const wire = () => { const x = $('lkX'); if (x) x.onclick = () => select(''); panel.querySelectorAll('[data-sel]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); select(a.dataset.sel); })); panel.scrollTop = 0; };
    const scopeTxt = () => st.w ? `${T('книга', 'book')} ${esc(wLab(st.w))}` : [st.per ? PER[st.per] + (NET.cmp ? ' ↔ ' + PER[st.cmp] : '') : T('все периоды', 'all periods'), st.nat ? natName(st.nat) : ''].filter(Boolean).join(', ');

    function overviewG() {
      const N = NET.nodes, L = NET.links;
      if (!L.length) { panel.innerHTML = `<h2>${T('Нет связей', 'No links')}</h2><p>${T('При этих фильтрах в текстах нет предложений, где названы сразу две группы. Ослабьте порог или выберите другой период.', 'With these filters no sentence names two groups at once. Lower the threshold or choose another period.')}</p>`; return; }
      const top = (arr, f, k = 5) => arr.slice().sort((a, b) => f(b) - f(a)).slice(0, k);
      const hubs = top(N, (n) => n.wdeg), brokers = top(N.filter((n) => n.bt > 0), (n) => n.bt), strong = top(L, (l) => l.v, 6);
      let cmpHtml = '';
      if (NET.cmp) {
        const only = (k) => top(L.filter((l) => l.st === k), (l) => (k === 'a' ? l.A.n : l.B.n), 6);
        const li = (l, k) => `<li><a href="#" data-sel="e:${esc(l.key)}">${esc(gName(l.source.id || l.source))} — ${esc(gName(l.target.id || l.target))}</a> <span class="mute">${k === 'a' ? l.A.n : l.B.n}</span></li>`;
        cmpHtml = `<h3>${T('Только в', 'Only in')} ${PER[st.per]} <i class="lk-sw" style="background:${ACC2}"></i></h3><ul class="lk-list">${only('a').map((l) => li(l, 'a')).join('') || '<li class="mute">—</li>'}</ul>
          <h3>${T('Только в', 'Only in')} ${PER[st.cmp]} <i class="lk-sw" style="background:${ACC}"></i></h3><ul class="lk-list">${only('b').map((l) => li(l, 'b')).join('') || '<li class="mute">—</li>'}</ul>
          <p class="small mute">${T(`В периодах разное число книг (${worksOf(st.per).size} и ${worksOf(st.cmp).size}), поэтому сравнивается наличие связи, а не её сила. Серые связи есть в обоих периодах.`, `The periods contain different numbers of books (${worksOf(st.per).size} and ${worksOf(st.cmp).size}), so the presence of a link is compared, not its strength. Grey links occur in both periods.`)}</p>`;
      }
      panel.innerHTML = `<h2>${T('Что показывает сеть', 'What the network shows')}</h2>
        <p class="small mute">${scopeTxt()} · ${NET.nWorks} ${T(plural(NET.nWorks, 'книга', 'книги', 'книг'), 'books')} · ${N.length} ${T(plural(N.length, 'группа', 'группы', 'групп'), 'groups')} · ${L.length} ${T(plural(L.length, 'связь', 'связи', 'связей'), 'links')} · ${fmt(NET.nSent)} ${T(plural(NET.nSent, 'предложение', 'предложения', 'предложений'), 'sentences')}</p>
        ${cmpHtml}
        <h3>${T('Чаще всего в паре с другими', 'Most often paired with others')}</h3><ul class="lk-list">${hubs.map((n) => `<li><a href="#" data-sel="n:${esc(n.id)}">${esc(n.label)}</a> <span class="mute">${fmt(n.wdeg)} ${T('предл.', 'sent.')}, ${n.deg} ${T('групп', 'groups')}</span></li>`).join('')}</ul>
        ${brokers.length ? `<h3>${T('Посредники', 'Brokers')} <span class="mute small" title="betweenness">(${T('посредническая центральность', 'betweenness centrality')})</span></h3><ul class="lk-list">${brokers.map((n) => `<li><a href="#" data-sel="n:${esc(n.id)}">${esc(n.label)}</a> <span class="mute">${fmt(n.bt, 2)}</span></li>`).join('')}</ul>
        <p class="small mute">${T('Через эти группы проходят кратчайшие пути между остальными: в текстах они связывают народы, которые сами вместе почти не называются.', 'Shortest paths between other groups run through these: in the texts they connect peoples that are rarely named together directly.')}</p>` : ''}
        <h3>${st.ms === 's' ? T('Самые сильные связи (с поправкой на частоту)', 'Strongest links (adjusted for frequency)') : T('Самые частые пары', 'Most frequent pairs')}</h3><ul class="lk-list">${strong.map((l) => `<li><a href="#" data-sel="e:${esc(l.key)}">${esc(gName(l.source.id || l.source))} — ${esc(gName(l.target.id || l.target))}</a> <span class="mute">${l.A ? l.A.n : l.B.n}</span></li>`).join('')}</ul>
        <details class="lk-how"><summary>${T('Как читать граф', 'How to read the graph')}</summary>
          <p>${T('Узел — народ или группа; размер — сколько раз группа упомянута в выбранных книгах. Цвет — рубрика (см. легенду). Связь проведена, если две группы названы в одном предложении абзаца о Сибири; толщина — число таких предложений или, если выбрано, сила связи.', 'A node is a people or group; its size is how often the group is mentioned in the selected books. Colour is the heading (see the legend). A link means two groups are named in the same sentence of a paragraph about Siberia; its width is the number of such sentences or, if chosen, the strength of the link.')}</p>
          <p>${T('Сила с поправкой на частоту = число общих предложений / √(упоминания A × упоминания B). Она поднимает пары, которые называют вместе чаще, чем можно ожидать по их общей частоте, и опускает связи «со всеми», как у русских.', 'Strength adjusted for frequency = shared sentences / √(mentions of A × mentions of B). It raises pairs named together more often than their overall frequency would suggest and lowers links “with everyone”, such as those of Russians.')}</p>
          <p>${T('Совместное упоминание — ещё не отношение: в предложении группы могут сравниваться, перечисляться или противопоставляться. Поэтому у каждой связи открываются сами предложения. Типы отношений (торговля, конфликт и т. п.) появятся после экспертной разметки.', 'Being named together is not yet a relationship: groups may be compared, listed or contrasted. That is why every link opens the sentences themselves. Types of relationship (trade, conflict, etc.) will be added after expert annotation.')}</p>
          <p>${T('Наведите на узел — подсветятся его соседи. Колесо мыши — масштаб, перетаскивание фона — сдвиг, узлы можно перетаскивать.', 'Hover over a node to highlight its neighbours. Scroll to zoom, drag the background to pan; nodes can be dragged.')}</p></details>`;
      wire();
    }
    function panelGroup(id) {
      const n = NET.nodes.find((x) => x.id === id), P = partners(id), mx = Math.max(...P.map(([, l]) => l.v));
      const nOf = (l) => (l.A ? l.A.n : 0) + (l.B ? l.B.n : 0);
      const ws = Object.entries(GRP[id].w).filter(([w]) => NET.cmp ? worksOf(st.per).has(w) || worksOf(st.cmp).has(w) : inWorks().includes(w)).sort((a, b) => b[1] - a[1]).slice(0, 8);
      panel.innerHTML = `${close}<p class="lk-kicker">${esc(cap(CATN[n.cat] || ''))}</p><h2>${esc(n.label)}</h2>
        <p class="small mute">${scopeTxt()}: ${fmt(n.m)} ${T(plural(n.m, 'упоминание', 'упоминания', 'упоминаний'), 'mentions')} ${T('в', 'in')} ${n.books} ${T(plural(n.books, 'книге', 'книгах', 'книгах'), 'books')}; ${T('посредническая центральность', 'betweenness')} ${fmt(n.bt, 2)}</p>
        <h3>${T('С кем называют в одном предложении', 'Named in the same sentence with')}</h3>
        <ul class="lk-list lk-bars">${P.slice(0, 14).map(([o, l]) => `<li><a href="#" data-sel="e:${esc(l.key)}">${esc(gName(o))}</a> <span class="mute">${nOf(l)}${st.ms === 's' && l.A ? ' · ' + fmt(l.A.s * 100, 1) : ''}</span>${bar(l.v, mx)}</li>`).join('')}</ul>
        ${P.length > 14 ? `<p class="small mute">${T('и ещё', 'and')} ${P.length - 14}</p>` : ''}
        <h3>${T('Кто из авторов пишет о них больше всего', 'Authors who write about them most')}</h3>
        <ul class="lk-list">${ws.map(([w, c]) => `<li><a href="#evidence?g=${esc(id)}&w=${esc(w)}">${esc(wLab(w))}</a> <span class="mute">${fmt(c)}</span></li>`).join('')}</ul>
        <p class="lk-go"><a href="#people-${toH(id)}">${T('Карточка народа →', 'Profile of the people →')}</a> <a href="#evidence?g=${esc(id)}">${T('Все абзацы →', 'All paragraphs →')}</a></p>`;
      wire();
    }
    async function panelPair(l) {
      const a = l.source.id || l.source, b = l.target.id || l.target;
      const perCount = PERK.map((p) => { let s = 0; for (const [w, c] of Object.entries((l.A || l.B).src.w)) if (WK[w].period === p) s += c; return s; });
      const mx = Math.max(...perCount, 1);
      const books = NET.cmp ? [...(l.A ? l.A.books : []), ...(l.B ? l.B.books : [])] : l.A.books;
      panel.innerHTML = `${close}<p class="lk-kicker">${T('Связь', 'Link')}</p><h2>${esc(gName(a))} — ${esc(gName(b))}</h2>
        <p class="small mute">${scopeTxt()}: ${(l.A ? l.A.n : 0) + (l.B ? l.B.n : 0)} ${T('предложений в', 'sentences in')} ${new Set(books).size} ${T(plural(new Set(books).size, 'книге', 'книгах', 'книгах'), 'books')}${l.A && st.ms === 's' ? ` · ${T('сила связи', 'strength')} ${fmt(l.A.s * 100, 1)}` : ''}</p>
        <h3>${T('По периодам (все книги)', 'By period (all books)')}</h3>
        <div class="lk-per">${PERK.map((p, i) => `<div title="${esc(PER[p])}: ${perCount[i]}"><i style="height:${Math.round((100 * perCount[i]) / mx)}%;background:${PC[i]}"></i><span>${esc(PER[p].replace('до ', '<').replace('–', '–​'))}</span><b>${perCount[i]}</b></div>`).join('')}</div>
        <h3>${T('Предложения', 'Sentences')}</h3><div id="lkEv" class="lk-ev">${T('Загрузка…', 'Loading…')}</div>
        <p class="lk-go"><a href="#" data-sel="n:${esc(a)}">${esc(gName(a))}</a> <a href="#" data-sel="n:${esc(b)}">${esc(gName(b))}</a></p>`;
      wire();
      const EV = await get('net/groups_ev.json');
      if (st.sel !== 'e:' + l.key) return;
      const keep = new Set(books);
      const S = (l.A || l.B).src.s.map((i) => EV[i]).filter((x) => keep.has(x[0])).sort((x, y) => WK[x[0]].year - WK[y[0]].year || x[1].localeCompare(y[1]));
      let shown = 25;
      const draw = () => {
        let last = '', h = '';
        for (const [w, pid, txt] of S.slice(0, shown)) {
          if (w !== last) { h += `<h4>${esc(wLab(w))} <span class="mute">${esc(WK[w].author)}</span></h4>`; last = w; }
          h += `<blockquote>${mark(txt, [a, b])} <a class="small" href="${pLink(w, pid)}">${T('абзац', 'para.')} ${+pid} →</a></blockquote>`;
        }
        if (S.length > shown) h += `<button class="lnk" id="lkMore">${T('показать ещё', 'show more')} (${S.length - shown})</button>`;
        $('lkEv').innerHTML = h || `<p class="mute">${T('Нет предложений.', 'No sentences.')}</p>`;
        const m = $('lkMore'); if (m) m.onclick = () => { shown += 50; draw(); };
      };
      draw();
    }

    function overviewI() {
      const N = NET.nodes, L = NET.links;
      const cited = N.filter((n) => n.in > 0).sort((a, b) => b.in - a.in).slice(0, 8);
      const reuse = L.filter((l) => l.type === 'reuse').sort((a, b) => b.n - a.n).slice(0, 6);
      const lb = (id) => esc((N.find((n) => n.id === id) || {}).label || id);
      panel.innerHTML = `<h2>${T('Что показывает сеть', 'What the network shows')}</h2>
        <p class="small mute">${scopeTxt()} · ${NET.nWorks - NET.isolated} ${T('из', 'of')} ${NET.nWorks} ${T('книг со связями', 'books with links')} · ${L.filter((l) => l.type === 'cites').length} ${T('ссылок', 'references')} · ${L.filter((l) => l.type === 'reuse').length} ${T('пар с заимствованиями', 'pairs with text reuse')}</p>
        <h3>${T('Чаще всего упоминают', 'Most often mentioned')} <span class="mute small">(${T('число книг', 'number of books')})</span></h3>
        <ul class="lk-list">${cited.map((n) => `<li><a href="#" data-sel="n:${esc(n.id)}">${esc(n.label)}</a> <span class="mute">${n.in}${n.kind === 'authority' ? ' · ' + T('вне корпуса', 'outside the corpus') : ''}</span></li>`).join('')}</ul>
        ${reuse.length ? `<h3>${T('Больше всего общих отрывков', 'Most shared passages')}</h3><ul class="lk-list">${reuse.map((l) => `<li><a href="#" data-sel="e:${esc(l.key)}">${lb(l.s)} ← ${lb(l.t)}</a> <span class="mute">${l.n}</span></li>`).join('')}</ul>` : ''}
        <details class="lk-how" open><summary>${T('Как читать граф', 'How to read the graph')}</summary>
          <p>${T('Книги стоят на шкале времени по году издания; цвет — период поездки. Серые узлы — учёные и путешественники вне корпуса (Паллас, Гмелин, Миддендорф…), их место на шкале — примерно начало их работы в Сибири или Азии.', 'Books are placed on the time axis by year of publication; colour is the period of the journey. Grey nodes are scholars and travellers outside the corpus (Pallas, Gmelin, Middendorff…), placed roughly where their work on Siberia or Asia began.')}</p>
          <p>${T('Серая стрелка — ссылка: фамилия предшественника названа в тексте (самоупоминания и совпадения фамилий с людьми, ещё не известными к году книги, исключены). Красная стрелка — заимствование: в двух книгах есть абзацы с общими фрагментами текста (не меньше четырёх общих 8-словных цепочек); стрелка идёт от более поздней книги к более ранней.', 'A grey arrow is a reference: the predecessor’s surname appears in the text (self-mentions and surnames of people not yet known by the book’s year are excluded). A red arrow is text reuse: two books contain paragraphs sharing fragments of text (at least four shared 8-word sequences); the arrow points from the later book to the earlier one.')}</p>
          <p>${T('Виды заимствований: «цитата с указанием автора» — источник назван в том же абзаце; «общая цитата» — обе книги цитируют один и тот же третий текст; «кандидат в заимствование» — совпадение без указания источника, требует проверки исследователем.', 'Kinds of reuse: “quotation with the author named” — the source is named in the same paragraph; “shared quotation” — both books quote the same third text; “candidate for borrowing” — a match without the source named, to be checked by a researcher.')}</p></details>`;
      wire();
    }
    const KIND_EN = {'цитата с указанием автора': 'quotation with the author named', 'общая цитата': 'shared quotation', 'кандидат в заимствование': 'candidate for borrowing'};
    function panelBook(id) {
      const n = NET.nodes.find((x) => x.id === id), L = NET.links;
      const lb = (x) => esc((NET.nodes.find((k) => k.id === x) || {}).label || x);
      const li = (l, other) => `<li><a href="#" data-sel="e:${esc(l.key)}">${lb(other)}</a> <span class="mute">${l.type === 'cites' ? l.n + ' ' + T('упом.', 'ment.') : l.n + ' ' + T('отр.', 'pass.')}</span></li>`;
      const sec = (title, arr, side) => arr.length ? `<h3>${title}</h3><ul class="lk-list">${arr.sort((a, b) => b.n - a.n).map((l) => li(l, side === 's' ? l.t : l.s)).join('')}</ul>` : '';
      const out = L.filter((l) => l.s === id), inn = L.filter((l) => l.t === id);
      const head = n.kind === 'work' ? `<p class="lk-kicker">${T('Книга корпуса', 'Book in the corpus')}</p><h2>${esc(n.label)}</h2><p class="small mute">${esc(WK[id].author)} · ${esc(natName(WK[id].nat))} · ${T('поездка', 'journey')} ${esc(PER[WK[id].period] || '')}</p>`
        : `<p class="lk-kicker">${T('Автор вне корпуса', 'Author outside the corpus')}</p><h2>${esc(n.label)}</h2>`;
      panel.innerHTML = `${close}${head}
        ${sec(T('Ссылается на', 'Refers to'), out.filter((l) => l.type === 'cites'), 's')}
        ${sec(T('На неё ссылаются', 'Referred to by'), inn.filter((l) => l.type === 'cites'), 't')}
        ${sec(T('Общие отрывки с более ранними книгами', 'Shared passages with earlier books'), out.filter((l) => l.type === 'reuse'), 's')}
        ${sec(T('Общие отрывки с более поздними книгами', 'Shared passages with later books'), inn.filter((l) => l.type === 'reuse'), 't')}
        ${n.kind === 'work' ? `<p class="lk-go"><a href="#book-${toH(id)}">${T('Открыть книгу →', 'Open the book →')}</a></p>` : ''}`;
      wire();
    }
    async function panelCite(l) {
      const lb = (x) => esc((NET.nodes.find((k) => k.id === x) || {}).label || x);
      if (l.type === 'reuse') {
        panel.innerHTML = `${close}<p class="lk-kicker">${T('Общие отрывки', 'Shared passages')}</p><h2>${lb(l.s)} ← ${lb(l.t)}</h2>
          <p class="small mute">${l.n} ${T(plural(l.n, 'пара абзацев', 'пары абзацев', 'пар абзацев'), 'paragraph pairs')}. ${T('Слева — более поздняя книга, справа — более ранняя.', 'Left: the later book; right: the earlier one.')}</p>
          ${l.x.map((x) => `<div class="lk-pair"><p class="lk-kind">${esc(EN ? KIND_EN[x.kind] || x.kind : x.kind)}</p><div><blockquote>${esc(x.bt)}… <a class="small" href="${pLink(l.s, x.bp)}">${esc(wLab(l.s))}, ${T('абз.', 'para.')} ${+x.bp} →</a></blockquote>
            <blockquote>${esc(x.st)}… <a class="small" href="${pLink(l.t, x.sp)}">${esc(wLab(l.t))}, ${T('абз.', 'para.')} ${+x.sp} →</a></blockquote></div></div>`).join('')}`;
        return wire();
      }
      const tn = NET.nodes.find((k) => k.id === l.t);
      const sur = tn.kind === 'work' ? (WK[l.t].author || '').replace(/\s*\(.*?\)/, '').split(/\s+/).pop() : tn.label.replace(/\s*\(.*\)/, '').split(/\s+/).pop();
      panel.innerHTML = `${close}<p class="lk-kicker">${T('Ссылка', 'Reference')}</p><h2>${lb(l.s)} → ${lb(l.t)}</h2>
        <p class="small mute">${T('Фамилия названа', 'Surname named')} ${l.n} ${T(plural(l.n, 'раз', 'раза', 'раз'), 'times')}</p><div id="lkEv" class="lk-ev">${T('Загрузка…', 'Loading…')}</div>`;
      wire();
      const P = await getText(l.s);
      if (st.sel !== 'e:' + l.key) return;
      const rx = new RegExp(reEsc(sur.slice(0, Math.max(4, sur.length - 1))), 'i');
      $('lkEv').innerHTML = (l.p || []).map((pid) => { const t = P[pid] || ''; const m = t.search(rx); const a = Math.max(0, m - 220), b = Math.min(t.length, m + 260);
        const snip = (a > 0 ? '…' : '') + t.slice(a, b) + (b < t.length ? '…' : '');
        return `<blockquote>${esc(snip).replace(new RegExp('(' + reEsc(sur.slice(0, Math.max(4, sur.length - 1))) + '\\p{L}*)', 'giu'), '<mark>$1</mark>')} <a class="small" href="${pLink(l.s, pid)}">${T('абзац', 'para.')} ${+pid} →</a></blockquote>`; }).join('') || `<p class="mute">${T('Абзацы не найдены.', 'No paragraphs found.')}</p>`;
    }

    // ================= легенда, выгрузка =================
    function legend() {
      if (st.m === 'g') {
        const cats = [...new Set(NET.nodes.map((n) => n.cat))];
        $('lkl').innerHTML = ((window.CATS || {}).order || cats).filter((c) => cats.includes(c)).map((c) => `<span><i style="background:${CATC[c]}"></i>${esc(cap(CATN[c] || c))}</span>`).join('')
          + (NET.cmp ? `<span><i class="ln" style="background:${ACC2}"></i>${T('только', 'only')} ${PER[st.per]}</span><span><i class="ln" style="background:${ACC}"></i>${T('только', 'only')} ${PER[st.cmp]}</span><span><i class="ln" style="background:${MUTE}"></i>${T('в обоих', 'in both')}</span>` : '')
          + `<span class="mute">${T('размер узла — число упоминаний; толщина связи — ', 'node size: mentions; link width: ')}${st.ms === 's' ? T('сила с поправкой на частоту', 'strength adjusted for frequency') : T('число общих предложений', 'shared sentences')}</span>`;
      } else {
        $('lkl').innerHTML = PERK.map((p, i) => `<span><i style="background:${PC[i]}"></i>${esc(PER[p])}</span>`).join('') + `<span><i style="background:${MUTE}"></i>${T('авторы вне корпуса', 'authors outside the corpus')}</span><span><i class="ln" style="background:${MUTE}"></i>${T('ссылка', 'reference')}</span><span><i class="ln" style="background:${ACC}"></i>${T('заимствование', 'text reuse')}</span>`;
      }
    }
    function csv() {
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      let nodes, edges;
      if (NET.kind === 'g') {
        nodes = [['id', 'label', 'category', 'mentions', 'books', 'degree', 'betweenness'], ...NET.nodes.map((n) => [n.id, n.label, n.cat, n.m, n.books, n.deg, n.bt.toFixed(4)])];
        edges = [['source', 'target', 'sentences', 'books', 'strength', 'status'], ...NET.links.map((l) => [l.source.id || l.source, l.target.id || l.target, (l.A ? l.A.n : 0) + (l.B ? l.B.n : 0), (l.A || l.B).books.length, l.A ? l.A.s.toFixed(4) : '', l.st])];
      } else {
        nodes = [['id', 'label', 'kind', 'year', 'in_degree', 'out_degree'], ...NET.nodes.map((n) => [n.id, n.label, n.kind, n.year, n.in, n.out])];
        edges = [['source', 'target', 'type', 'weight'], ...NET.links.map((l) => [l.s, l.t, l.type, l.n])];
      }
      const meta = `# Iter Sibiricum — ${st.m === 'g' ? 'co-mention network' : 'intertextual network'}; ${location.href}; CC BY-NC 4.0\n`;
      for (const [name, rows] of [['nodes', nodes], ['edges', edges]]) {
        const blob = new Blob(['﻿' + meta + rows.map((r) => r.map(q).join(',')).join('\n')], {type: 'text/csv'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `iter-sibiricum-${st.m === 'g' ? 'groups' : 'intertext'}-${name}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
    }

    // ================= сборка =================
    function refresh(full) { build(); save(); controls(); legend(); if (view()) full ? view().draw() : view().redraw(); renderPanel(); }
    document.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { if (st.m === b.dataset.m) return; st.m = b.dataset.m; st.sel = ''; st.min = st.m === 'i' ? 1 : 2; build(); save(); controls(); legend(); view().draw(); renderPanel(); }));
    $('lkV').addEventListener('click', async () => { st.v = st.v === '3d' ? '2d' : '3d'; save(); await mountView(); view().paint(); });
    $('lkFit').addEventListener('click', () => view() && view().fit());
    $('lkLink').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(location.href); e.target.textContent = T('Ссылка скопирована', 'Link copied'); } catch (x) { e.target.textContent = location.href; } });
    $('lkCsv').addEventListener('click', csv);
    const themeObs = new MutationObserver(() => { PC = PERK.map((p, i) => cssColor('--p' + (i + 1))); ACC = cssColor('--acc'); ACC2 = cssColor('--acc2'); MUTE = cssColor('--mute'); refresh(false); });
    themeObs.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    window.addEventListener('hashchange', () => { themeObs.disconnect(); if (view()) view().destroy(); probe.remove(); }, {once: true});
    build(); controls(); legend(); renderPanel();
    await mountView(); view().paint();
  }
  return {render};
})();
