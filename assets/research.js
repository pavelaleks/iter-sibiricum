/* Инструменты для исследователей: подборка свидетельств (все абзацы о народе или месте, с фильтрами, сравнением и выгрузкой)
   и страница «Данные» (файлы, поля, лицензии, как открыть, как цитировать). window.Research.evidence(V, ctx), .data(V, ctx). */
window.Research = (() => {
  const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many;
  const cache = {};
  const getJ = (u) => (cache[u] ||= fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const WHG = {url: null}; // ссылка на опубликованный набор в World Historical Gazetteer (набор № 1796)

  async function evidence(V, C) {
    const {get, esc, toH, fmt, PER, NAT, EN, citeDialog, reportLinks, SITE_URL, pad5} = C;
    const T = (ru, en) => (EN ? en : ru);
    const nm = (s) => (EN && window.I18N && I18N.tr ? I18N.tr(String(s ?? '')) || s : s);
    V.innerHTML = `<div class="wrap loading">${T('Загрузка…', 'Loading…')}</div>`;
    const [works, groups, places, bookgeo] = await Promise.all([get('works.json'), get('groups.json'), get('places.json'), get('bookgeo.json')]);
    const W = Object.fromEntries(works.map((w) => [w.id, w])), G = Object.fromEntries(groups.map((g) => [g.id, g])), P = Object.fromEntries(places.map((p) => [p.id, p]));
    const gName = (id) => (G[id] ? (EN ? G[id].name_en : G[id].name) : id), pName = (id) => (P[id] ? nm(P[id].name) : id);
    const j0 = (w) => w.j0 || w.year, j1 = (w) => w.j1 || w.j0 || w.year;
    const NATS = [...new Set(works.map((w) => w.nat))], STAYS = [...new Set(works.map((w) => w.stay))];
    const stayRu = Object.fromEntries(works.map((w) => [w.stay, w.stay_ru]));
    const DIM = {per: [T('период поездки', 'period of the journey'), Object.keys(PER), (k) => PER[k], (w) => w.period], nat: [T('страна автора', 'author’s country'), NATS, (k) => NAT[k] || k, (w) => w.nat], stay: [T('тип поездки', 'type of journey'), STAYS, (k) => nm(stayRu[k]), (w) => w.stay]};

    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const st = {g: G[q.get('g')] ? q.get('g') : '', pl: P[q.get('pl')] ? q.get('pl') : '', w: W[q.get('w')] ? q.get('w') : '', per: PER[q.get('per')] ? q.get('per') : '', nat: NATS.includes(q.get('nat')) ? q.get('nat') : '',
      stay: STAYS.includes(q.get('stay')) ? q.get('stay') : '', sib: q.get('sib') === '1', s: q.get('s') || '', cmp: DIM[q.get('cmp')] ? q.get('cmp') : '', a: q.get('a') || '', b: q.get('b') || ''};
    const opt = (arr, cur) => arr.map(([v, t]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const CAT = {indigenous: T('Коренные народы', 'Indigenous peoples'), settler: T('Русские и переселенцы', 'Russians and settlers'), exile: T('Ссыльные', 'Exiles'), foreign: T('Иностранцы', 'Foreigners'), other: T('Другие', 'Other')};
    const gOpts = Object.entries(groups.reduce((a, g) => ((a[g.category] ||= []).push(g), a), {})).map(([c, L]) => `<optgroup label="${esc(CAT[c] || c)}">${opt(L.sort((x, y) => gName(x.id).localeCompare(gName(y.id), EN ? 'en' : 'ru')).map((g) => [g.id, gName(g.id)]), st.g)}</optgroup>`).join('');
    const pOpts = opt(places.slice().sort((a, b) => b.mentions - a.mentions).map((p) => [p.id, `${pName(p.id)} (${fmt(p.mentions)})`]), st.pl);

    V.innerHTML = `<section class="band ev" data-noi18n><div class="wrap">
      <h1>${T('Свидетельства', 'Evidence')}</h1>
      <p class="lede">${T('Все абзацы корпуса, где упомянут народ или место, — с фильтрами по книге, эпохе, стране автора и типу поездки. Подборку можно сравнить по двум группам книг, сослаться на неё одной ссылкой и выгрузить в CSV. Каждая строка ведёт к абзацу в тексте книги.', 'Every paragraph of the corpus that mentions a people or a place, filtered by book, period, author’s country and type of journey. A selection can be compared across two sets of books, shared as a link and downloaded as CSV. Each row leads to the paragraph in the book.')}</p>
      <div class="ctl ev-ctl">
        <label>${T('Народ, группа', 'People, group')} <select id="eG"><option value="">—</option>${gOpts}</select></label>
        <label>${T('Место', 'Place')} <select id="eP"><option value="">—</option>${pOpts}</select></label>
        <label>${T('Книга', 'Book')} <select id="eW"><option value="">${T('все', 'all')}</option>${opt(works.slice().sort((a, b) => a.year - b.year).map((w) => [w.id, w.label]), st.w)}</select></label>
      </div>
      <div class="ctl ev-ctl">
        <label>${T('Период', 'Period')} <select id="ePer"><option value="">${T('все', 'all')}</option>${opt(Object.entries(PER).map(([k, v]) => [k, nm(v)]), st.per)}</select></label>
        <label>${T('Страна автора', 'Author’s country')} <select id="eNat"><option value="">${T('все', 'all')}</option>${opt(NATS.map((n) => [n, nm(NAT[n] || n)]), st.nat)}</select></label>
        <label>${T('Тип поездки', 'Type of journey')} <select id="eStay"><option value="">${T('все', 'all')}</option>${opt(STAYS.map((x) => [x, nm(stayRu[x])]), st.stay)}</select></label>
        <label class="chk"><input type="checkbox" id="eSib"${st.sib ? ' checked' : ''}> ${T('только абзацы о Сибири', 'only paragraphs about Siberia')}</label>
        <label>${T('Слово во фрагменте', 'Word in the fragment')} <input type="search" id="eS" value="${esc(st.s)}" size="14"></label>
      </div>
      <div id="eOut"></div>
    </div></section>`;
    const out = V.querySelector('#eOut');
    let rows = [], lim = 50, io = null;

    function url() {
      const p = new URLSearchParams(); ['g', 'pl', 'w', 'per', 'nat', 'stay', 's', 'cmp', 'a', 'b'].forEach((k) => st[k] && p.set(k, st[k])); if (st.sib) p.set('sib', '1');
      history.replaceState(null, '', '#evidence' + (p.toString() ? '?' + p : ''));
    }
    const filt = (w, ex = {}) => !!w && (!st.w || w.id === st.w) && (ex.per !== undefined ? w.period === ex.per : !st.per || w.period === st.per) && (ex.nat !== undefined ? w.nat === ex.nat : !st.nat || w.nat === st.nat) && (ex.stay !== undefined ? w.stay === ex.stay : !st.stay || w.stay === st.stay);
    async function load() {
      const [g, p] = await Promise.all([st.g ? getJ(`data/evidence/g/${st.g}.json`) : null, st.pl ? getJ(`data/evidence/p/${st.pl}.json`) : null]);
      if (st.g && st.pl) {
        const inP = new Set(((p && p.r) || []).map((r) => r[0] + ':' + r[1]));
        return ((g && g.r) || []).filter((r) => r[5].includes(st.pl) || inP.has(r[0] + ':' + r[1])).map((r) => [...r, 'g']);
      }
      return st.g ? ((g && g.r) || []).map((r) => [...r, 'g']) : st.pl ? ((p && p.r) || []).map((r) => [...r, 'p']) : [];
    }
    const sel = (R, ex) => { const s = st.s.trim().toLowerCase(); return R.filter((r) => filt(W[r[0]], ex) && (!st.sib || r[2]) && (!s || r[3].toLowerCase().includes(s))); };
    const hl = (r) => { const s = r[3]; let o = '', pos = 0; for (const [a, b] of r[4].slice().sort((x, y) => x[0] - y[0])) { if (a < pos) continue; o += esc(s.slice(pos, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>'; pos = b; } return o + esc(s.slice(pos)); };
    const others = (r) => (r[6] === 'g' ? r[5].filter((x) => x !== st.pl).map((x) => `<a href="#evidence?pl=${esc(x)}">${esc(pName(x))}</a>`) : r[5].filter((x) => x !== st.g).map((x) => `<a href="#evidence?g=${esc(x)}">${esc(gName(x))}</a>`)).slice(0, 6).join(', ');
    const rowHtml = (r, i) => { const w = W[r[0]]; return `<li class="ev-row"><div class="ev-m"><a href="#book-${toH(w.id)}"><b>${esc(w.label)}</b></a> <span class="mute">${esc(w.title_short || '')}</span><br><span class="small mute">${T('поездка', 'journey')} ${j0(w)}${j1(w) !== j0(w) ? '–' + j1(w) : ''} · ${esc(nm(NAT[w.nat] || w.nat))} · ${esc(nm(w.stay_ru))}${r[2] ? '' : ' · ' + T('не о Сибири', 'not about Siberia')}</span></div>
      <p class="ev-s" lang="${esc(w.lang)}">${hl(r)}</p>
      <div class="ev-a small"><a href="#book-${toH(w.id)}-p${pad5(r[1])}">${T('абзац', 'paragraph')} ${r[1]} →</a><button class="lnk" data-c="${i}">${T('цитировать', 'cite')}</button>${others(r) ? `<span class="mute">${r[6] === 'g' ? T('места в абзаце: ', 'places in the paragraph: ') : T('группы в абзаце: ', 'groups in the paragraph: ')}</span>${others(r)}` : ''}</div></li>`; };
    // распределение по десятилетиям поездки (строки = абзацы)
    const decades = (R) => { const D = {}; R.forEach((r) => { const d = Math.floor(j0(W[r[0]]) / 10) * 10; D[d] = (D[d] || 0) + 1; }); return D; };
    const bars = (D, lab = (k) => k, max) => { const E = Object.entries(D); const m = max || Math.max(1, ...E.map((x) => x[1])); return `<ul class="ev-bars">${E.map(([k, v]) => `<li><span>${esc(lab(k))}</span><i style="width:${(100 * v / m).toFixed(1)}%"></i><b>${fmt(v)}</b></li>`).join('')}</ul>`; };
    const decHist = (D, m) => { const ks = []; for (let d = 1800; d <= 1920; d += 10) ks.push(d); const mx = m || Math.max(1, ...Object.values(D)); return `<div class="ev-dec" aria-hidden="true">${ks.map((d) => `<span title="${d}–${d + 9}: ${D[d] || 0}"><i style="height:${(100 * (D[d] || 0) / mx).toFixed(1)}%"></i></span>`).join('')}</div><div class="ev-dec-ax small mute"><span>1800</span><span>1860</span><span>1920</span></div>`; };
    const perTenK = (R, ex) => { const ws = works.filter((w) => filt(w, ex)); const words = ws.reduce((a, w) => a + (st.sib ? w.words_sib : w.words) || 0, 0); return words ? R.length / words * 1e4 : 0; };
    const topOther = (R, n = 8) => { const C = {}; R.forEach((r) => r[5].forEach((x) => { if (x !== st.pl && x !== st.g) C[x] = (C[x] || 0) + 1; })); return Object.entries(C).sort((a, b) => b[1] - a[1]).slice(0, n); };

    async function draw() {
      url();
      if (!st.g && !st.pl) {
        if (st.w) {
          const w = W[st.w]; const tg = (w.top_groups || []).map((g) => [groups.find((x) => x.name === g[0]), g[1]]).filter((x) => x[0]); const bg = (bookgeo[st.w] || []).slice(0, 24);
          out.innerHTML = `<h2>${esc(w.label)}: ${T('кого и что упоминает книга', 'who and what the book mentions')}</h2><p class="small mute">${T('Выберите народ или место, чтобы увидеть все абзацы книги о нём.', 'Pick a people or a place to see every paragraph of the book about it.')}</p>
            <div class="chips">${tg.map(([g, n]) => `<a class="chip" href="#evidence?w=${esc(st.w)}&g=${esc(g.id)}">${esc(gName(g.id))} · ${n}</a>`).join('')}</div>
            <div class="chips" style="margin-top:10px">${bg.map(([id, n]) => `<a class="chip" href="#evidence?w=${esc(st.w)}&pl=${esc(id)}">${esc(pName(id))} · ${n}</a>`).join('')}</div>`;
          return;
        }
        const top = groups.filter((g) => g.category === 'indigenous').sort((a, b) => b.mentions - a.mentions).slice(0, 16), tp = places.filter((p) => p.sib).sort((a, b) => b.mentions - a.mentions).slice(0, 16);
        out.innerHTML = `<h2>${T('С чего начать', 'Where to start')}</h2><div class="chips">${top.map((g) => `<a class="chip" href="#evidence?g=${esc(g.id)}">${esc(gName(g.id))} · ${fmt(g.mentions)}</a>`).join('')}</div>
          <div class="chips" style="margin-top:10px">${tp.map((p) => `<a class="chip" href="#evidence?pl=${esc(p.id)}">${esc(pName(p.id))} · ${fmt(p.mentions)}</a>`).join('')}</div>
          <p class="small mute" style="margin-top:14px">${T('Можно выбрать и народ, и место сразу: тогда останутся абзацы, где названы оба, например буряты и Кяхта.', 'You can pick both a people and a place: only paragraphs naming both remain, e.g. Buryats and Kyakhta.')}</p>`;
        return;
      }
      out.innerHTML = `<p class="mute">${T('Загрузка…', 'Loading…')}</p>`;
      const all = await load(); rows = sel(all);
      const title = [st.g && gName(st.g), st.pl && pName(st.pl)].filter(Boolean).join(' + ');
      const nb = new Set(rows.map((r) => r[0])).size;
      const byNat = {}; rows.forEach((r) => { const k = nm(NAT[W[r[0]].nat] || W[r[0]].nat); byNat[k] = (byNat[k] || 0) + 1; });
      out.innerHTML = `<div class="ev-head"><div><h2>${esc(title)}</h2><p class="ev-n">${fmt(rows.length)} ${T(plural(rows.length, 'абзац', 'абзаца', 'абзацев'), rows.length === 1 ? 'paragraph' : 'paragraphs')} ${T('в', 'in')} ${fmt(nb)} ${T(plural(nb, 'книге', 'книгах', 'книгах'), nb === 1 ? 'book' : 'books')}${rows.length ? ` · ${fmt(perTenK(rows), 2)} ${T('на 10 тыс. слов', 'per 10,000 words')}${st.sib ? T(' о Сибири', ' about Siberia') : ''}` : ''}</p></div>
        <div class="ev-tools"><button id="eCsv"${rows.length ? '' : ' disabled'}>${T('скачать CSV', 'download CSV')}</button><button id="eLink">${T('ссылка на подборку', 'link to the selection')}</button><button id="eCmpB" aria-expanded="${!!st.cmp}">${T('сравнить…', 'compare…')}</button></div></div>
        <div class="ev-cmpf"${st.cmp ? '' : ' hidden'}><label>${T('Сравнить по', 'Compare by')} <select id="eDim">${opt(Object.entries(DIM).map(([k, d]) => [k, d[0]]), st.cmp || 'nat')}</select></label><label>A <select id="eA"></select></label><label>B <select id="eB"></select></label></div>
        <div id="eCmp"></div>
        ${rows.length ? `<div class="ev-sum"><div><h3>${T('По десятилетиям поездки', 'By decade of the journey')}</h3>${decHist(decades(rows))}</div><div><h3>${T('По стране автора', 'By author’s country')}</h3>${bars(Object.fromEntries(Object.entries(byNat).sort((a, b) => b[1] - a[1])))}</div>
          <div><h3>${st.g ? T('Места в тех же абзацах', 'Places in the same paragraphs') : T('Группы в тех же абзацах', 'Groups in the same paragraphs')}</h3>${bars(Object.fromEntries(topOther(rows).map(([k, v]) => [st.g ? pName(k) : gName(k), v])))}</div></div>` : `<p>${T('Под эти условия абзацев нет. Ослабьте один из фильтров.', 'No paragraphs match. Relax one of the filters.')}</p>`}
        <ol class="ev-list" id="eList"></ol><p class="more"><button id="eMore" hidden>${T('Показать ещё', 'Show more')}</button></p>
        <p class="small mute ev-note">${T('Упоминания найдены автоматически по словарю форм названий; фрагмент — до 360 знаков вокруг первого упоминания в абзаце. Абзацы «не о Сибири» — те, что относятся к Европе, Китаю или пути до Урала.', 'Mentions are found automatically with a dictionary of name forms; the fragment is up to 360 characters around the first mention in the paragraph. Paragraphs “not about Siberia” concern Europe, China or the way to the Urals.')} ${reportLinks(T('Подборка свидетельств: ', 'Evidence selection: ') + title, [location.href])}</p>`;
      lim = 50; list();
      V.querySelector('#eCsv').onclick = csv; V.querySelector('#eLink').onclick = async (e) => { try { await navigator.clipboard.writeText(location.href); e.target.textContent = T('ссылка скопирована', 'link copied'); } catch (x) { prompt('', location.href); } };
      V.querySelector('#eCmpB').onclick = () => { const f = V.querySelector('.ev-cmpf'); f.hidden = !f.hidden; V.querySelector('#eCmpB').setAttribute('aria-expanded', String(!f.hidden)); if (!f.hidden) { st.cmp ||= 'nat'; cmpForm(); } else { st.cmp = st.a = st.b = ''; V.querySelector('#eCmp').innerHTML = ''; url(); } };
      if (st.cmp) cmpForm(all);
      V.querySelector('#eList').addEventListener('click', (e) => { const c = e.target.closest('[data-c]'); if (c) { const r = rows[+c.dataset.c]; citeDialog(W[r[0]], r[1]); } });
      const more = V.querySelector('#eMore'); more.onclick = () => { lim += 50; list(); };
      if (io) io.disconnect(); io = new IntersectionObserver((es) => { if (es[0].isIntersecting && !more.hidden && more.isConnected) { lim += 50; list(); } }, {rootMargin: '600px'}); io.observe(more);
      async function cmpForm(A0) {
        const all2 = A0 || all, d = DIM[st.cmp]; V.querySelector('#eDim').value = st.cmp;
        // по умолчанию — две самые частые категории в подборке
        const cnt = {}; sel(all2, {}).forEach((r) => { const k = d[3](W[r[0]]); cnt[k] = (cnt[k] || 0) + 1; }); const ord = d[1].slice().sort((x, y) => (cnt[y] || 0) - (cnt[x] || 0));
        if (!d[1].includes(st.a)) st.a = ord[0]; if (!d[1].includes(st.b) || st.b === st.a) st.b = ord.find((x) => x !== st.a);
        const o = d[1].map((k) => [k, `${d[2](k)} (${fmt(cnt[k] || 0)})`]);
        V.querySelector('#eA').innerHTML = opt(o, st.a); V.querySelector('#eB').innerHTML = opt(o, st.b);
        const ex = (v) => ({[st.cmp]: v});
        const side = (v) => { const R = sel(all2, ex(v)), books = [...new Set(R.map((r) => r[0]))];
          const pick = []; const seen = new Set(); for (const r of R.slice().sort((x, y) => (y[3].length >= 150) - (x[3].length >= 150))) { if (seen.has(r[0])) continue; seen.add(r[0]); pick.push(r); if (pick.length >= 4) break; }
          return {R, html: `<h3>${esc(d[2](v))}</h3><p class="ev-n">${fmt(R.length)} ${T(plural(R.length, 'абзац', 'абзаца', 'абзацев'), 'paragraphs')} · ${fmt(books.length)} ${T(plural(books.length, 'книга', 'книги', 'книг'), 'books')} · ${fmt(perTenK(R, ex(v)), 2)} ${T('на 10 тыс. слов', 'per 10,000 words')}</p>
            ${decHist(decades(R), 0)}<h4>${st.g ? T('Места рядом', 'Places alongside') : T('Группы рядом', 'Groups alongside')}</h4>${bars(Object.fromEntries(topOther(R, 6).map(([k, n]) => [st.g ? pName(k) : gName(k), n])))}
            <h4>${T('Примеры (по одному из книги)', 'Examples (one per book)')}</h4><ul class="ev-ex">${pick.map((r) => `<li><a href="#book-${toH(r[0])}-p${pad5(r[1])}">${esc(W[r[0]].label)}</a>: <span lang="${esc(W[r[0]].lang)}">${hl(r)}</span></li>`).join('')}</ul>
            <p class="small"><a href="#evidence?${new URLSearchParams(Object.entries({g: st.g, pl: st.pl, w: st.w, [st.cmp]: v, sib: st.sib ? '1' : ''}).filter(([, x]) => x)).toString()}">${T('вся подборка →', 'the whole selection →')}</a></p>`}; };
        const A = side(st.a), B = side(st.b);
        V.querySelector('#eCmp').innerHTML = `<div class="ev-cmp"><div>${A.html}</div><div>${B.html}</div></div><p class="small mute">${T('Частота на 10 тыс. слов считается по всем книгам группы, а не только по тем, где есть упоминания: так сравнение не зависит от числа книг.', 'Frequency per 10,000 words is computed over all books of the set, not only those with mentions, so it does not depend on the number of books.')}</p>`;
        url();
      }
      V.querySelector('#eDim').onchange = (e) => { st.cmp = e.target.value; st.a = st.b = ''; cmpForm(); };
      V.querySelector('#eA').onchange = (e) => { st.a = e.target.value; cmpForm(); }; V.querySelector('#eB').onchange = (e) => { st.b = e.target.value; cmpForm(); };
    }
    function list() { const L = V.querySelector('#eList'); if (!L) return; L.innerHTML = rows.slice(0, lim).map(rowHtml).join(''); V.querySelector('#eMore').hidden = rows.length <= lim; }
    function csv() {
      const H = ['work_id', 'author', 'title', 'edition_year', 'journey_start', 'journey_end', 'author_country', 'period', 'journey_type', 'paragraph', 'about_siberia', 'url', 'fragment', st.g ? 'places_in_paragraph' : 'groups_in_paragraph'];
      const qv = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const L = rows.map((r) => { const w = W[r[0]]; return [w.id, w.author, w.title || w.label, w.year, j0(w), j1(w), w.nationality || w.nat, w.period, w.stay, r[1], r[2], `${SITE_URL}#book-${toH(w.id)}-p${pad5(r[1])}`, r[3], r[5].join(' ')].map(qv).join(','); });
      const blob = new Blob(['﻿' + H.join(',') + '\n' + L.join('\n')], {type: 'text/csv;charset=utf-8'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `iter-sibiricum-evidence-${[st.g, st.pl, st.w, st.per, st.nat, st.stay].filter(Boolean).join('-').replace(/[^\w-]+/g, '_') || 'all'}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 300);
    }
    const bind = (id, k, ev = 'change') => V.querySelector('#' + id).addEventListener(ev, (e) => { st[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; draw(); });
    bind('eG', 'g'); bind('eP', 'pl'); bind('eW', 'w'); bind('ePer', 'per'); bind('eNat', 'nat'); bind('eStay', 'stay'); bind('eSib', 'sib');
    let sT = 0; V.querySelector('#eS').addEventListener('input', (e) => { clearTimeout(sT); sT = setTimeout(() => { st.s = e.target.value; draw(); }, 250); });
    draw();
  }

  async function data(V, C) {
    const {get, esc, fmt, EN, project} = C;
    const T = (ru, en) => (EN ? en : ru);
    const [P, works, groups, places] = await Promise.all([project(), get('works.json'), get('groups.json'), get('places.json')]);
    const v = P.version || '1.0', yr = P.year || new Date().getFullYear();
    const ds = P.datasets || [];
    const F = [
      ['data/works.json', T('Паспорта книг: автор, заглавие, издание, страна автора, тип и годы поездки, период, объём текста, число упоминаний народов', 'Book records: author, title, edition, author’s country, type and years of the journey, period, text size, mentions of peoples'), 'JSON', 'CC BY 4.0'],
      ['texts/<книга>.json', T('Тексты по абзацам: [номер, тип, регион, о Сибири, текст, упоминания групп [начало, конец, группа]]', 'Texts by paragraph: [number, type, region, about Siberia, text, group mentions [start, end, group]]'), 'JSON', T('тексты — общественное достояние; разметка — CC BY 4.0', 'texts public domain; annotation CC BY 4.0')],
      ['data/groups.json', T('Народы и группы: названия, формы в источниках, частоты, ряды по десятилетиям, окружение слов, книги (by_work), схематичные ареалы', 'Peoples and groups: names, forms in the sources, frequencies, decade series, collocations, books (by_work), schematic areas'), 'JSON', 'CC BY 4.0'],
      ['data/places.json', T('Места: координаты и их источник (GeoNames, Wikidata, вручную), упоминания, книги, народы в тех же абзацах', 'Places: coordinates and their source (GeoNames, Wikidata, manual), mentions, books, peoples in the same paragraphs'), 'JSON', 'CC BY-NC 4.0'],
      ['data/geo/<книга>.json', T('Упоминания мест по абзацам: [абзац, место, начало, конец]', 'Place mentions by paragraph: [paragraph, place, start, end]'), 'JSON', 'CC BY-NC 4.0'],
      ['data/evidence/g|p/<id>.json', T('Указатель свидетельств: все абзацы о группе или месте с фрагментом текста', 'Evidence index: all paragraphs about a group or a place with a text fragment'), 'JSON', 'CC BY 4.0'],
      ['data/routes.json, data/review/journeys_review.json', T('Маршруты: остановки с абзацем-доказательством и цитатой; правки и статус экспертной проверки', 'Routes: stops with the evidence paragraph and quotation; corrections and expert review status'), 'JSON', 'CC BY-NC 4.0'],
      ['data/export/iter-sibiricum-routes.geojson', T('Маршруты для ГИС (QGIS, ArcGIS)', 'Routes for GIS (QGIS, ArcGIS)'), 'GeoJSON', 'CC BY-NC 4.0'],
      ['data/export/iter-sibiricum-places.lpf.jsonld', T('Газеттир мест в формате Linked Places (для World Historical Gazetteer)', 'Gazetteer of places in Linked Places Format (for the World Historical Gazetteer)'), 'JSON-LD', 'CC BY-NC 4.0'],
      ['data/areas1914.geojson', T('Ареалы 12 народов, оцифрованные с «Этнографической карты Азиатской России» (1914)', 'Areas of 12 peoples digitised from the Ethnographic Map of Asiatic Russia (1914)'), 'GeoJSON', 'CC BY 4.0'],
      ['data/illustrations.json', T('Иллюстрации: книга, страница, тип, подпись, народы, регион', 'Illustrations: book, page, type, caption, peoples, region'), 'JSON', 'CC BY 4.0'],
      ['data/networks.json, data/reuse.json', T('Сети совместных упоминаний групп по периодам; межтекстовые заимствования', 'Co-mention networks of groups by period; text reuse between books'), 'JSON', 'CC BY 4.0'],
      ['data/oldmaps/, data/tiles/*.pmtiles', T('Сканы карт 1822 и 1914 гг., их привязка; тайлы подложек', 'Scans of the 1822 and 1914 maps, their georeferencing; base map tiles'), 'JPEG/PNG, PMTiles', T('общественное достояние; Natural Earth', 'public domain; Natural Earth')],
    ];
    const BASE = 'https://iter-sibiricum.ru/';
    const py = `import pandas as pd, requests
BASE = "${BASE}"
works = pd.DataFrame(requests.get(BASE + "data/works.json").json())
ev = requests.get(BASE + "data/evidence/g/buryat.json").json()["r"]
rows = pd.DataFrame(ev, columns=["work", "paragraph", "about_siberia", "fragment", "marks", "places"])
rows = rows.merge(works[["id", "author", "nat", "period", "j0"]], left_on="work", right_on="id")
print(rows.groupby("nat").size().sort_values(ascending=False))   # кто чаще писал о бурятах`;
    const r = `library(jsonlite); library(dplyr)
base  <- "${BASE}"
works <- fromJSON(paste0(base, "data/works.json"))
works %>% group_by(period) %>% summarise(books = n(), per10k = mean(per10k))`;
    const qgis = T('QGIS: «Слой → Добавить слой → Векторный слой», источник — адрес', 'QGIS: “Layer → Add Layer → Vector Layer”, source — the URL') + ` ${BASE}data/export/iter-sibiricum-routes.geojson`;
    const cite = `${T('Iter Sibiricum: европейские травелоги о Сибири, 1800–1930 : цифровой ресурс', 'Iter Sibiricum: European travelogues about Siberia, 1800–1930: digital resource')} / ${T('рук. П. В. Алексеев', 'led by P. Alekseev')}. — ${T('Версия', 'Version')} ${v}. — ${yr}. — URL: ${BASE} (${T('дата обращения', 'accessed')}: ${new Date().toLocaleDateString(EN ? 'en-GB' : 'ru-RU')}).`;
    const nb = `https://colab.research.google.com/github/pavelaleks/iter-sibiricum/blob/main/notebooks/iter_sibiricum_quickstart.ipynb`;
    V.innerHTML = `<section class="band data-pg" data-noi18n><div class="wrap">
      <h1>${T('Данные', 'Data')}</h1>
      <p class="lede">${T(`Всё, что показывает сайт, лежит в открытых файлах: ${works.length} книг, ${groups.length} групп, ${places.length} мест, тексты по абзацам, маршруты, иллюстрации. Их можно скачать целиком, открыть в Python, R или QGIS и сослаться на конкретную версию.`, `Everything the site shows is in open files: ${works.length} books, ${groups.length} groups, ${places.length} places, texts by paragraph, routes, illustrations. They can be downloaded in full, opened in Python, R or QGIS, and cited by version.`)}</p>
      <h2>${T('Наборы с DOI', 'Datasets with a DOI')}</h2>
      <ul class="data-ds">${ds.map((d) => `<li><a href="https://doi.org/${esc(d.doi)}">${esc(d.title)}</a> · doi:${esc(d.doi)} · ${esc(d.license)}</li>`).join('')}<li>${T('Код и все файлы сайта', 'Code and all site files')}: <a href="https://github.com/pavelaleks/iter-sibiricum">github.com/pavelaleks/iter-sibiricum</a> · ${T('код — MIT', 'code: MIT')}</li></ul>
      <h2>${T('Файлы', 'Files')}</h2>
      <div class="tbl"><table class="stack"><thead><tr><th>${T('Файл', 'File')}</th><th>${T('Что внутри', 'Contents')}</th><th>${T('Формат', 'Format')}</th><th>${T('Лицензия', 'Licence')}</th></tr></thead>
        <tbody>${F.map(([f, d, fm, l]) => `<tr><td><code>${/[<|,*]/.test(f) ? esc(f) : `<a href="${esc(f)}">${esc(f)}</a>`}</code></td><td>${esc(d)}</td><td>${esc(fm)}</td><td>${esc(l)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small mute">${T('Все файлы доступны по адресу сайта (например, ', 'All files are available at the site address (e.g. ')}<code>${BASE}data/works.json</code>${T(') без ключей и ограничений; так их можно читать прямо из кода.', ') with no keys or limits, so code can read them directly.')}</p>
      <h2>${T('Как открыть', 'How to open')}</h2>
      <div class="cols"><div><h3>Python</h3><pre class="code">${esc(py)}</pre></div><div><h3>R</h3><pre class="code">${esc(r)}</pre><h3>QGIS</h3><p class="small">${esc(qgis)}</p></div></div>
      <p><a class="btnlike" href="${nb}" target="_blank" rel="noopener">${T('Открыть тетрадку-пример в Google Colab', 'Open the example notebook in Google Colab')}</a> <span class="small mute">${T('без установки: загрузка данных, частоты по периодам, сравнение авторов разных стран, маршруты на карте', 'no installation: loading the data, frequencies by period, comparing authors from different countries, routes on a map')}</span></p>
      <h2 id="whg">${T('Во Всемирном историческом газеттире', 'In the World Historical Gazetteer')}</h2>
      <p>${T('<a href="https://whgazetteer.org/" target="_blank" rel="noopener">World Historical Gazetteer</a> (WHG) — открытый международный справочник исторических мест, который ведёт Питтсбургский университет. В нём собраны наборы мест из многих исследовательских проектов, связанные между собой и с Wikidata и GeoNames: по одному названию можно найти, где и когда так называли место и в каких источниках.', 'The <a href="https://whgazetteer.org/" target="_blank" rel="noopener">World Historical Gazetteer</a> (WHG) is an open international index of historical places run by the University of Pittsburgh. It brings together place datasets from many research projects, linked to each other and to Wikidata and GeoNames, so a single name leads to where and when a place was so called and in which sources.')}</p>
      <p>${T(`Мы передали в WHG ${fmt(699)} мест из корпуса: места, упомянутые во всех книгах, и остановки восстановленных маршрутов. Главное, что добавляет наш набор, — названия в том виде, в каком их записали европейские путешественники (Kaminskoi Zavod, Altin Kool; Kiachta, Kiahta, Kiakhta), с годом поездки и ссылкой на абзац книги в нашей библиотеке. По таким написаниям исследователь, читающий травелог или архивный документ, может опознать место, а из WHG попасть прямо в текст источника.`, `We contributed ${fmt(699)} places from the corpus to WHG: places mentioned across all the books and the stops of reconstructed routes. What our dataset adds above all is the names as European travellers wrote them (Kaminskoi Zavod, Altin Kool; Kiachta, Kiahta, Kiakhta), with the year of the journey and a link to the paragraph of the book in our library. A researcher reading a travelogue or an archival document can identify a place by such a spelling and go from WHG straight to the source text.`)}</p>
      <p class="small">${WHG.url ? `<a class="btnlike" href="${esc(WHG.url)}" target="_blank" rel="noopener">${T('Наш набор в WHG', 'Our dataset in WHG')}</a> ` : `${T('Состояние: набор загружен и проходит проверку редакции WHG; ссылка появится здесь после публикации.', 'Status: the dataset is uploaded and under review by the WHG editors; a link will appear here once it is published.')} `}${T('Тот же файл можно скачать и здесь', 'The same file can be downloaded here')}: <a href="data/export/iter-sibiricum-places.lpf.jsonld">iter-sibiricum-places.lpf.jsonld</a> (Linked Places Format, CC BY-NC 4.0). ${T('Тип места у остановок маршрутов (населённый пункт, река, станция и т. п.) определён по названию автоматически.', 'The place type of route stops (settlement, river, station, etc.) was assigned automatically from the name.')}</p>
      <h2>${T('Как цитировать', 'How to cite')}</h2>
      <pre class="code">${esc(cite)}</pre>
      <p class="small">${T('Для отдельной книги или абзаца — кнопка «цитировать» в читалке и в «Свидетельствах» (ГОСТ Р 7.0.100, Chicago, BibTeX). Машиночитаемое описание ресурса — ', 'For a single book or paragraph use the “cite” button in the reader and in Evidence (GOST R 7.0.100, Chicago, BibTeX). Machine-readable description of the resource: ')}<a href="CITATION.cff">CITATION.cff</a>.</p>
      <h2>${T('Версии', 'Versions')}</h2>
      <p class="small">${T(`Текущая версия данных — ${esc(v)}. Каждое изменение сайта и данных записано в истории репозитория; версии наборов на Zenodo неизменяемы, поэтому ссылка с DOI в статье всегда ведёт к тем данным, на которые вы опирались.`, `Current data version: ${esc(v)}. Every change of the site and data is recorded in the repository history; Zenodo versions are immutable, so a DOI in a paper always points to the data you used.`)} <a href="https://github.com/pavelaleks/iter-sibiricum/commits/main">${T('История изменений', 'Change history')}</a>.</p>
      <h2>${T('Нашли ошибку?', 'Found an error?')}</h2>
      <p class="small">${T('У каждого абзаца в читалке и у каждой подборки свидетельств есть ссылка «Сообщить об ошибке»: она открывает задачу на GitHub с уже заполненными книгой и абзацем или письмо, если учётной записи GitHub нет. Исправления попадают в следующую версию данных.', 'Each paragraph in the reader and each evidence selection has a “Report an error” link: it opens a GitHub issue with the book and paragraph filled in, or an e-mail if you have no GitHub account. Corrections go into the next data version.')}</p>
    </div></section>`;
  }
  return {evidence, data};
})();
