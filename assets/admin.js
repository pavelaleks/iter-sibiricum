/* Рабочее место команды Iter Sibiricum.
   Сайт статический, поэтому админка пишет прямо в репозиторий GitHub через его API:
   каждое действие — коммит с именем сотрудника. Нужен личный токен GitHub с правом записи в репозиторий
   (fine-grained token: Repository access — iter-sibiricum, Permissions — Contents: Read and write).
   Токен хранится только в этом браузере (localStorage) и никуда, кроме api.github.com, не отправляется.
   Файлы решений:
     data/review/journeys_review.json — проверка маршрутов (статус, остановки, кто и когда)
     data/review/books_queue.json     — предложенные новые книги (обрабатывает конвейер при сборке)
     data/publications.json, data/project.json — публикации и сведения о проекте */
const REPO = 'pavelaleks/iter-sibiricum', BRANCH = 'main';
const A = document.getElementById('A');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const today = () => new Date().toISOString().slice(0, 10);
const LS = {get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }};
let TOKEN = LS.get('is_token'), WHO = LS.get('is_who');
const ST = {verified: ['подтверждён экспертом', 'rec'], checked: ['проверен по тексту', 'rec'], reconstructed: ['восстановлен по тексту', 'rec'], draft: ['черновик', 'draft'], no_journey: ['нет поездки', ''], none: ['нет черновика', '']};

// ---------- GitHub API ----------
const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));
async function gh(path, opt = {}) {
  const r = await fetch('https://api.github.com' + path, {...opt, headers: {Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + TOKEN, ...(opt.headers || {})}});
  if (!r.ok) { const t = await r.text(); const e = new Error(r.status + ': ' + t.slice(0, 200)); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
async function readJSON(path, fallback) {
  try { const f = await gh(`/repos/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`); return {data: JSON.parse(b64d(f.content)), sha: f.sha}; }
  catch (e) { if (e.status === 404) return {data: fallback, sha: null}; throw e; }
}
// Изменить JSON-файл в репозитории: прочитать свежую версию, применить mutate, записать; при конфликте — повторить.
async function commitJSON(path, mutate, message, fallback = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const {data, sha} = await readJSON(path, fallback);
    const next = mutate(structuredClone(data)) ?? data;
    try {
      await gh(`/repos/${REPO}/contents/${path}`, {method: 'PUT', body: JSON.stringify({message: `${message} — ${WHO}`, content: b64e(JSON.stringify(next, null, 2) + '\n'), branch: BRANCH, ...(sha ? {sha} : {})})});
      return next;
    } catch (e) { if (e.status !== 409 && e.status !== 422) throw e; }
  }
  throw new Error('Файл одновременно изменил кто-то ещё. Обновите страницу и повторите.');
}
const site = (n) => fetch(n + (n.includes('?') ? '&' : '?') + 't=' + Date.now()).then((r) => r.ok ? r.json() : Promise.reject(new Error(n)));
function toast(msg, bad) { const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 9000 : 4200); }

// ---------- вход ----------
async function login() {
  const team = (await site('data/project.json')).team || [];
  A.innerHTML = `<section class="band"><div class="wrap narrow">
    <h1>Рабочее место команды</h1>
    <p>Здесь сотрудники проекта проверяют маршруты, добавляют книги, публикации и сведения о проекте. Каждое изменение сохраняется в репозитории с вашим именем, и через одну-две минуты появляется на сайте.</p>
    <form id="lf" class="aform">
      <label>Кто вы<select id="lw" required><option value="">выберите</option>${team.map((t) => `<option ${t.name === WHO ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}<option value="other">другой сотрудник</option></select></label>
      <label id="lo" hidden>Фамилия и инициалы<input id="lon" type="text"></label>
      <label>Ключ доступа GitHub<input id="lt" type="password" required autocomplete="off" placeholder="github_pat_…"></label>
      <p class="small mute">Ключ создаёт владелец репозитория или вы сами в своём аккаунте GitHub: Settings → Developer settings → Fine-grained tokens → Generate. Repository access: только <code>${REPO}</code>; Permissions → Contents: Read and write. Ключ хранится только в этом браузере.</p>
      <button class="on" type="submit">Войти</button> <span id="lerr" class="neg small"></span>
    </form></div></section>`;
  const sel = document.getElementById('lw'); sel.addEventListener('change', () => { document.getElementById('lo').hidden = sel.value !== 'other'; });
  document.getElementById('lf').addEventListener('submit', async (e) => {
    e.preventDefault(); TOKEN = document.getElementById('lt').value.trim(); WHO = sel.value === 'other' ? document.getElementById('lon').value.trim() : sel.value;
    if (!WHO) { document.getElementById('lerr').textContent = 'Укажите, кто вы.'; return; }
    try { const r = await gh(`/repos/${REPO}`); if (!r.permissions || !r.permissions.push) throw new Error('У ключа нет права записи в репозиторий.');
      LS.set('is_token', TOKEN); LS.set('is_who', WHO); start(); }
    catch (err) { document.getElementById('lerr').textContent = err.status === 401 ? 'Ключ не принят GitHub: проверьте, что он скопирован целиком и не истёк.' : err.message; }
  });
}
function logout() { LS.set('is_token', null); TOKEN = null; location.hash = ''; login(); }

// ---------- каркас ----------
let D = null;
async function load() {
  const [works, routes, places, jw, rev, queue] = await Promise.all([site('data/works.json'), site('data/routes.json'), site('data/places.json'), site('data/journeys_works.json').catch(() => []),
    readJSON('data/review/journeys_review.json', {}), readJSON('data/review/books_queue.json', [])]);
  D = {works, routes, places, rev: rev.data, queue: queue.data, W: Object.fromEntries(works.map((w) => [w.id, w])), P: Object.fromEntries(places.map((p) => [p.id, p])), R: Object.fromEntries(routes.map((r) => [r.work, r])), texts: {}};
}
async function start() {
  if (!TOKEN || !WHO) return login();
  document.getElementById('who').innerHTML = `${esc(WHO)} · <a href="#" id="lout">выйти</a>`; document.getElementById('lout').onclick = (e) => { e.preventDefault(); logout(); };
  document.getElementById('atabs').hidden = false;
  A.innerHTML = '<div class="wrap loading">Загрузка данных…</div>';
  try { await load(); } catch (e) { if (e.status === 401) return logout(); A.innerHTML = `<div class="wrap band"><h2>Не удалось загрузить данные</h2><p>${esc(e.message)}</p></div>`; return; }
  window.addEventListener('hashchange', route); route();
}
function route() {
  const t = (location.hash.slice(1) || 'routes').split('/');
  document.querySelectorAll('#atabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === t[0]));
  ({routes, books, pubs, team, log}[t[0]] || routes)(t[1]);
}

// ---------- маршруты ----------
function statusOf(w) { const v = D.rev[w]; if (v) return v.status; const r = D.R[w]; return r ? r.status : 'none'; }
function routes(work) {
  if (work) return editRoute(work);
  const order = ['draft', 'none', 'checked', 'reconstructed', 'verified', 'no_journey'];
  const rows = D.works.map((w) => ({w, s: statusOf(w.id), n: (D.rev[w.id] ? D.rev[w.id].stops : (D.R[w.id] || {stops: []}).stops).length})).sort((a, b) => order.indexOf(a.s) - order.indexOf(b.s) || a.w.year - b.w.year);
  const cnt = (s) => rows.filter((r) => r.s === s).length;
  A.innerHTML = `<section class="band"><div class="wrap">
    <h1>Проверка маршрутов</h1>
    <p>Откройте книгу, сверьте остановки с абзацами и сохраните решение. Подтверждённый маршрут сразу рисуется на карте сайта линией с пометкой «подтверждён экспертом».</p>
    <div class="ctl"><input type="search" id="rf" placeholder="Автор или книга"> ${order.map((s) => `<button data-s="${s}">${ST[s][0]} · ${cnt(s)}</button>`).join('')}</div>
    <div class="scroll"><table><thead><tr><th>Книга</th><th>Автор</th><th class="n">Поездка</th><th class="n">Остановок</th><th>Статус</th><th>Кто проверил</th></tr></thead><tbody id="rt"></tbody></table></div>
  </div></section>`;
  let fs = '';
  const draw = () => { const q = document.getElementById('rf').value.toLowerCase();
    document.getElementById('rt').innerHTML = rows.filter((r) => (!fs || r.s === fs) && (!q || (r.w.label + r.w.author).toLowerCase().includes(q))).map((r) => `<tr class="click" data-w="${r.w.id}"><td><a href="#routes/${r.w.id}">${esc(r.w.label)}</a></td><td>${esc(r.w.author)}</td><td class="n">${r.w.j0 || '?'}${r.w.j1 && r.w.j1 !== r.w.j0 ? '–' + r.w.j1 : ''}</td><td class="n">${r.n}</td><td><span class="status ${ST[r.s][1]}">${ST[r.s][0]}</span></td><td class="small">${esc((D.rev[r.w.id] || {}).reviewer || '')} ${esc((D.rev[r.w.id] || {}).date || '')}</td></tr>`).join(''); };
  document.getElementById('rf').addEventListener('input', draw);
  document.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { fs = fs === b.dataset.s ? '' : b.dataset.s; document.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x.dataset.s === fs)); draw(); }));
  document.getElementById('rt').addEventListener('click', (e) => { const tr = e.target.closest('tr'); if (tr && e.target.tagName !== 'A') location.hash = 'routes/' + tr.dataset.w; });
  draw();
}
async function text(w) { return D.texts[w] ||= site(`texts/${w}.json`).then((T) => Object.fromEntries(T.p.map((p) => [p[0], p[4]]))); }
async function editRoute(w) {
  const wk = D.W[w]; if (!wk) return routes();
  const v = D.rev[w], r = D.R[w];
  let stops = v ? structuredClone(v.stops) : (r ? r.stops.map((s) => ({place: s[0], name: s[1], lon: s[2], lat: s[3], pid: s[4] ? s[4].split('_p')[1] : '', quote: '', journey: 1})) : []);
  const T = await text(w);
  A.innerHTML = `<section class="band"><div class="wrap">
    <p class="small"><a href="#routes">← все книги</a></p>
    <h1>${esc(wk.label)}</h1>
    <p class="mute">${esc(wk.author)} · ${esc(wk.nat_ru)} · ${esc(wk.stay_ru)} · поездка ${wk.j0 || '?'}${wk.j1 && wk.j1 !== wk.j0 ? '–' + wk.j1 : ''} · статус: <span class="status ${ST[statusOf(w)][1]}">${ST[statusOf(w)][0]}</span>${v ? ` · ${esc(v.reviewer)}, ${esc(v.date)}` : ''}</p>
    ${v && v.summary ? `<p>${esc(v.summary)}</p>` : ''}
    <div class="editor">
      <div><div class="mapbox" id="em"></div><p class="small mute">Линия соединяет остановки в текущем порядке. Пунктирные кружки — остановки без абзаца-доказательства.</p></div>
      <div>
        <ol class="stops" id="sl"></ol>
        <form id="addf" class="aform row">
          <input list="pl" id="ap" placeholder="Добавить место из справочника">
          <datalist id="pl">${D.places.map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>
          <button type="submit">Добавить</button>
        </form>
        <details class="small"><summary>Места нет в справочнике</summary>
          <form id="newf" class="aform row"><input id="nn" placeholder="Название"><input id="nlat" placeholder="широта, напр. 52.29" inputmode="decimal"><input id="nlon" placeholder="долгота, напр. 104.28" inputmode="decimal"><button type="submit">Добавить</button></form></details>
      </div>
    </div>
    <div id="para" class="para"></div>
    <form id="savef" class="aform">
      <label>Комментарий<textarea id="note" rows="2" placeholder="Что исправлено, что спорно">${esc(v ? v.note || '' : '')}</textarea></label>
      <div class="ctl">
        <button type="button" class="on" data-save="verified">Подтвердить маршрут</button>
        <button type="button" data-save="checked">Сохранить: проверен по тексту</button>
        <button type="button" data-save="draft">Сохранить как черновик</button>
        <button type="button" data-save="no_journey">В книге нет поездки автора</button>
      </div>
    </form>
  </div></section>`;
  const el = document.getElementById('em');
  const redraw = () => SibMap.draw(el, {geo: D.geo, places: [], works: D.works, routes: [{work: w, method: 'manual', status: 'edit', stops: stops.filter((s) => s.lat != null).map((s) => [s.place, s.name, +s.lon, +s.lat, s.pid ? w + '_p' + s.pid : null, s.pid ? 'text' : 'not_found_in_text'])}], focusWork: w, showPlaces: false});
  D.geo ||= await site('data/geo.json'); redraw();
  const list = () => {
    document.getElementById('sl').innerHTML = stops.map((s, i) => `<li data-i="${i}"><div class="sh"><b>${esc(s.name)}</b>
      <span class="sb"><button type="button" data-a="up" title="Выше" aria-label="Выше">↑</button><button type="button" data-a="down" title="Ниже" aria-label="Ниже">↓</button><button type="button" data-a="del" title="Убрать" aria-label="Убрать">✕</button></span></div>
      <div class="sp small">абзац <input class="pid" value="${esc(s.pid || '')}" size="6" aria-label="Номер абзаца"> <a href="#" data-a="show">показать</a>${String(s.place).startsWith('new:') ? ` · координаты <input class="crd" data-k="lat" value="${s.lat ?? ''}" size="6" aria-label="Широта" placeholder="шир."> <input class="crd" data-k="lon" value="${s.lon ?? ''}" size="6" aria-label="Долгота" placeholder="долг."> <span class="mute">${({geonames: 'GeoNames', wikidata: 'Wikidata', expert: 'эксперт', estimate: 'приблизительно', geonames_ctx: 'приблизительно (GeoNames)', wikidata_ctx: 'приблизительно (Wikidata)'})[s.coord_source] || 'не установлены'}</span>` : ''}${s.quote ? ` · <span class="mute">«${esc(s.quote)}»</span>` : ''}</div></li>`).join('') || '<li class="mute">Остановок нет.</li>';
    redraw();
  };
  const showPara = (pid) => { const t = T[pid]; document.getElementById('para').innerHTML = t ? `<h3>Абзац ${esc(+pid)}</h3><p class="src">${esc(t)}</p>` : '<p class="mute">Абзаца с таким номером нет.</p>'; };
  document.getElementById('sl').addEventListener('click', (e) => {
    const li = e.target.closest('li'); const a = e.target.dataset.a; if (!li || !a) return; e.preventDefault(); const i = +li.dataset.i;
    if (a === 'up' && i > 0) [stops[i - 1], stops[i]] = [stops[i], stops[i - 1]];
    if (a === 'down' && i < stops.length - 1) [stops[i + 1], stops[i]] = [stops[i], stops[i + 1]];
    if (a === 'del') stops.splice(i, 1);
    if (a === 'show') return showPara(stops[i].pid);
    list();
  });
  document.getElementById('sl').addEventListener('change', (e) => { if (e.target.classList.contains('crd')) { const i = +e.target.closest('li').dataset.i, v = parseFloat(e.target.value.replace(',', '.')); stops[i][e.target.dataset.k] = isNaN(v) ? null : v; stops[i].coord_source = 'expert'; return list(); } if (e.target.classList.contains('pid')) { const i = +e.target.closest('li').dataset.i; stops[i].pid = e.target.value.trim().padStart(5, '0'); showPara(stops[i].pid); } });
  document.getElementById('addf').addEventListener('submit', (e) => { e.preventDefault(); const nm = document.getElementById('ap').value.trim(); const p = D.places.find((x) => x.name === nm);
    if (!p) return toast('Такого места нет в справочнике. Добавьте его как новое.', true);
    stops.push({place: p.id, name: p.name, lat: p.lat, lon: p.lon, pid: '', quote: '', journey: 1}); document.getElementById('ap').value = ''; list(); });
  document.getElementById('newf').addEventListener('submit', (e) => { e.preventDefault(); const nm = document.getElementById('nn').value.trim(), la = parseFloat(document.getElementById('nlat').value.replace(',', '.')), lo = parseFloat(document.getElementById('nlon').value.replace(',', '.'));
    if (!nm) return; stops.push({place: 'new:' + nm.toLowerCase().replace(/\s+/g, '_'), name: nm, lat: isNaN(la) ? null : la, lon: isNaN(lo) ? null : lo, pid: '', quote: '', journey: 1, new_place: true}); e.target.reset(); list(); });
  document.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
    const status = b.dataset.save, note = document.getElementById('note').value.trim();
    if (status === 'verified' && stops.some((s) => !s.pid) && !confirm('У некоторых остановок нет абзаца-доказательства. Всё равно подтвердить?')) return;
    b.disabled = true;
    try {
      D.rev = await commitJSON('data/review/journeys_review.json', (R) => { R[w] = {...(R[w] || {}), status, stops: status === 'no_journey' ? [] : stops, reviewer: WHO, date: today(), note, history: [...((R[w] || {}).history || []), {status, by: WHO, date: today()}]}; return R; }, `Маршрут ${wk.label}: ${ST[status][0]}`);
      toast('Сохранено. На сайте появится через 1–2 минуты.'); location.hash = 'routes';
    } catch (e) { toast('Не сохранено: ' + e.message, true); b.disabled = false; }
  }));
  list(); if (stops[0] && stops[0].pid) showPara(stops[0].pid);
}

// ---------- книги ----------
function books() {
  A.innerHTML = `<section class="band"><div class="wrap">
    <h1>Новые книги</h1>
    <p>Предложите издание для корпуса. Конвейер при следующей сборке скачает текст по ссылке, очистит, разметит и добавит книгу в библиотеку; до этого она видна здесь в очереди.</p>
    <form id="bf" class="aform grid2">
      <label>Автор<input name="author" required placeholder="Lansdell, Henry"></label>
      <label>Заглавие<input name="title" required></label>
      <label>Год издания<input name="year" type="number" min="1700" max="1960" required></label>
      <label>Язык текста<select name="lang"><option>en</option><option>de</option><option>fr</option><option>it</option><option>nl</option><option>pl</option><option>cs</option><option>da</option><option>no</option><option>sv</option><option>fi</option><option>ru</option></select></label>
      <label>Страна автора<input name="nationality" placeholder="британец, француз…"></label>
      <label>Годы поездки<input name="journey" placeholder="1879 или 1879–1880"></label>
      <label>Тип пребывания<select name="stay"><option value="transit">транзит</option><option value="expedition">экспедиция</option><option value="service">служба</option><option value="exile">ссылка</option><option value="captivity">плен</option><option value="residence">жизнь в Сибири</option><option value="unknown">не ясно</option></select></label>
      <label>Ссылка на цифровую копию<input name="source" type="url" required placeholder="https://archive.org/details/…"></label>
      <label class="wide">Почему эта книга и где она в библиографии<textarea name="note" rows="2" placeholder="Cross № …; описывает поездку по Якутии…"></textarea></label>
      <div class="wide"><button class="on" type="submit">Добавить в очередь</button></div>
    </form>
    <h2 style="margin-top:40px">Очередь</h2>
    <div class="scroll"><table><thead><tr><th>Автор</th><th>Заглавие</th><th class="n">Год</th><th>Источник</th><th>Предложил</th><th>Статус</th></tr></thead><tbody>${D.queue.slice().reverse().map((b) => `<tr><td>${esc(b.author)}</td><td>${esc(b.title)}</td><td class="n">${esc(b.year)}</td><td><a href="${esc(b.source)}">ссылка</a></td><td class="small">${esc(b.by)}, ${esc(b.date)}</td><td><span class="status ${b.status === 'added' ? 'rec' : 'draft'}">${b.status === 'added' ? 'в корпусе' : 'в очереди'}</span></td></tr>`).join('') || '<tr><td colspan="6" class="mute">Очередь пуста.</td></tr>'}</tbody></table></div>
  </div></section>`;
  document.getElementById('bf').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector('button'); btn.disabled = true;
    try { D.queue = await commitJSON('data/review/books_queue.json', (Q) => { Q.push({...f, year: +f.year, by: WHO, date: today(), status: 'proposed'}); return Q; }, `Новая книга в очередь: ${f.author}, ${f.year}`, []); toast('Книга добавлена в очередь.'); books(); }
    catch (err) { toast('Не сохранено: ' + err.message, true); btn.disabled = false; }
  });
}

// ---------- публикации ----------
async function pubs() {
  const {data: P} = await readJSON('data/publications.json', []);
  const STP = {published: 'опубликовано', in_press: 'в печати', submitted: 'подано'}, TY = {article: 'статья', monograph: 'монография', chapter: 'глава', conference: 'тезисы / доклад', dataset: 'набор данных'};
  A.innerHTML = `<section class="band"><div class="wrap">
    <h1>Публикации</h1>
    <p>Список выводится на странице «Публикации». Если заполнено поле «Готовая ссылка», она показывается как есть; иначе ссылка собирается из полей.</p>
    <ol class="refs">${P.map((p, i) => `<li><span class="ref">${esc(p.cite || [p.authors, p.title, p.venue, p.year].filter(Boolean).join('. '))}</span> <span class="status">${esc(TY[p.type] || p.type || 'статья')}</span> <span class="status ${p.status === 'published' ? 'rec' : 'draft'}">${esc(STP[p.status] || p.status)}</span> <a href="#" data-e="${i}">изменить</a> · <a href="#" data-d="${i}">удалить</a></li>`).join('')}</ol>
    <h2 id="pfh">Добавить публикацию</h2>
    <form id="pf" class="aform grid2">
      <label>Тип<select name="type">${Object.entries(TY).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Статус<select name="status">${Object.entries(STP).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Авторы<input name="authors" placeholder="Алексеев П. В., Шарыпова В. С."></label>
      <label>Название<input name="title"></label>
      <label>Журнал, сборник, издательство<input name="venue"></label>
      <label>Год<input name="year" type="number" min="2020" max="2035"></label>
      <label>Страницы, том, номер<input name="pages"></label>
      <label>DOI<input name="doi" placeholder="10.xxxx/…"></label>
      <label>Ссылка на текст<input name="url" type="url"></label>
      <label>Народы (id через запятую)<input name="groups" placeholder="sakha, buryat"></label>
      <label class="wide">Готовая ссылка (необязательно)<textarea name="cite" rows="2"></textarea></label>
      <label class="wide">Аннотация<textarea name="abstract" rows="3"></textarea></label>
      <div class="wide"><button class="on" type="submit">Сохранить</button> <button type="reset">Очистить</button></div>
    </form></div></section>`;
  const form = document.getElementById('pf'); let edit = -1;
  A.querySelectorAll('[data-e]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); edit = +a.dataset.e; const p = P[edit];
    for (const el of form.elements) if (el.name) el.value = Array.isArray(p[el.name]) ? p[el.name].join(', ') : (p[el.name] ?? ''); document.getElementById('pfh').textContent = 'Изменить публикацию'; form.scrollIntoView({behavior: 'smooth'}); }));
  A.querySelectorAll('[data-d]').forEach((a) => a.addEventListener('click', async (e) => { e.preventDefault(); const i = +a.dataset.d; if (!confirm('Удалить публикацию из списка?')) return;
    try { await commitJSON('data/publications.json', (L) => { L.splice(i, 1); return L; }, 'Публикация удалена', []); toast('Удалено.'); pubs(); } catch (err) { toast(err.message, true); } }));
  form.addEventListener('reset', () => { edit = -1; document.getElementById('pfh').textContent = 'Добавить публикацию'; });
  form.addEventListener('submit', async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(form));
    const rec = Object.fromEntries(Object.entries(f).filter(([, v]) => String(v).trim() !== '')); if (rec.year) rec.year = +rec.year; if (rec.groups) rec.groups = rec.groups.split(',').map((x) => x.trim()).filter(Boolean);
    if (!rec.cite && !rec.title) return toast('Заполните название или готовую ссылку.', true);
    try { await commitJSON('data/publications.json', (L) => { edit >= 0 ? (L[edit] = rec) : L.push(rec); return L; }, edit >= 0 ? 'Публикация изменена' : 'Публикация добавлена', []); toast('Сохранено. На сайте — через 1–2 минуты.'); pubs(); }
    catch (err) { toast('Не сохранено: ' + err.message, true); } });
}

// ---------- проект ----------
async function team() {
  const {data: P} = await readJSON('data/project.json', {});
  A.innerHTML = `<section class="band"><div class="wrap">
    <h1>Сведения о проекте</h1>
    <p>Из этих сведений собираются строка о гранте, блок «Коллектив» и ссылка для цитирования.</p>
    <form id="tf" class="aform">
      <label>Строка о поддержке<textarea name="acknowledgment" rows="2">${esc(P.acknowledgment || '')}</textarea></label>
      <div class="grid2"><label>Номер гранта<input name="grant" value="${esc(P.grant || '')}"></label><label>Страница проекта на сайте РНФ<input name="grant_url" value="${esc(P.grant_url || '')}"></label></div>
      <h2>Коллектив</h2>
      <div id="tm">${(P.team || []).map((t) => member(t)).join('')}</div>
      <p><button type="button" id="addm">Добавить участника</button></p>
      <button class="on" type="submit">Сохранить</button>
    </form></div></section>`;
  function member(t = {}) { return `<fieldset class="grid2 mem"><label>ФИО<input data-k="name" value="${esc(t.name || '')}"></label><label>Роль<input data-k="role" value="${esc(t.role || 'исполнитель')}"></label><label>Степень, должность<input data-k="degree" value="${esc(t.degree || '')}"></label><label>Организация<input data-k="org" value="${esc(t.org || '')}"></label><label>Сайт организации<input data-k="org_url" value="${esc(t.org_url || '')}"></label><label>ORCID<input data-k="orcid" value="${esc(t.orcid || '')}" placeholder="0000-0000-0000-0000"></label><p class="wide"><a href="#" class="rm">убрать участника</a></p></fieldset>`; }
  document.getElementById('addm').addEventListener('click', () => document.getElementById('tm').insertAdjacentHTML('beforeend', member()));
  document.getElementById('tm').addEventListener('click', (e) => { if (e.target.classList.contains('rm')) { e.preventDefault(); e.target.closest('fieldset').remove(); } });
  document.getElementById('tf').addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target;
    const tm = [...f.querySelectorAll('.mem')].map((fs) => Object.fromEntries([...fs.querySelectorAll('[data-k]')].map((i) => [i.dataset.k, i.value.trim()]))).filter((t) => t.name);
    try { await commitJSON('data/project.json', (Q) => ({...Q, acknowledgment: f.acknowledgment.value.trim(), grant: f.grant.value.trim(), grant_url: f.grant_url.value.trim(), team: tm}), 'Сведения о проекте обновлены'); toast('Сохранено.'); }
    catch (err) { toast('Не сохранено: ' + err.message, true); } });
}

// ---------- журнал ----------
async function log() {
  A.innerHTML = '<div class="wrap loading">Загрузка журнала…</div>';
  const C = await gh(`/repos/${REPO}/commits?sha=${BRANCH}&per_page=40`);
  A.innerHTML = `<section class="band"><div class="wrap"><h1>Журнал изменений</h1><p>Последние 40 изменений в репозитории: из рабочего места и из конвейера.</p>
    <div class="scroll"><table><thead><tr><th>Когда</th><th>Что</th><th></th></tr></thead><tbody>${C.map((c) => `<tr><td class="small n">${esc(c.commit.author.date.slice(0, 16).replace('T', ' '))}</td><td>${esc(c.commit.message.split('\n')[0])}</td><td><a href="${esc(c.html_url)}">подробно</a></td></tr>`).join('')}</tbody></table></div></div></section>`;
}

start();
