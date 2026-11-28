/* Iter Sibiricum — одностраничный статический сайт (GitHub Pages). Маршрутизация по #имени. */
{
const V = document.getElementById('view');
// узкий экран: таблицы .stack показываются карточками, подпись каждой ячейки берётся из заголовка столбца
// (после перевода интерфейса, поэтому с небольшой задержкой)
let stackT = null;
new MutationObserver(() => { clearTimeout(stackT); stackT = setTimeout(() => document.querySelectorAll('table.stack').forEach((t) => {
  const h = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-l') || td.dataset.auto) { td.dataset.l = h[i] || ''; td.dataset.auto = 1; } }));
}), 120); }).observe(V, {childList: true, subtree: true});
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const yr = (n) => n == null || isNaN(n) ? '—' : String(Math.round(n));
const inBox = (s) => s[2] >= 40 && s[2] <= 195 && s[3] >= 34 && s[3] <= 79;
const EN = !!(window.I18N && I18N.en);
const ROLE_RU = {"HBC governor": "губернатор Компании Гудзонова залива", "POW": "военнопленный", "POW (German army)": "военнопленный (германская армия)", "anthropologist": "антрополог", "archaeologist": "археолог", "aristocrat/politician": "аристократ, политик", "army officer": "армейский офицер", "army officer/MP": "армейский офицер, член парламента", "army officer/hunter": "армейский офицер, охотник", "army officers": "армейские офицеры", "artist-correspondent": "художник-корреспондент", "artist/architect": "художник, архитектор", "biographer (Wiggins journals)": "биограф (дневники Уиггинса)", "botanist/anthropologist": "ботаник, антрополог", "clergyman": "священнослужитель", "clergyman (Catholic prelate)": "священнослужитель (католический прелат)", "clergyman (pastor)": "священнослужитель (пастор)", "clergyman/missionary": "священнослужитель, миссионер", "colonial administrator/journalist": "колониальный чиновник, журналист", "compiler": "компилятор", "cyclist/journalist": "велосипедист, журналист", "deputy/officer": "депутат, офицер", "economist/publicist": "экономист, публицист", "engineer": "инженер", "ethnographer/traveller": "этнограф, путешественник", "exile": "ссыльный", "explorer/naturalist": "исследователь, натуралист", "farmer/politician": "фермер, политик", "geographer": "географ", "hunter": "охотник", "hunter/explorer": "охотник, исследователь", "journalist": "журналист", "journalist (communist)": "журналист (коммунист)", "journalist/politician": "журналист, политик", "journalist/relief worker": "журналист, сотрудник помощи голодающим", "merchant/Russian official": "купец, чиновник русской службы", "merchant/journalist": "купец, журналист", "mining engineer": "горный инженер", "missionary (medical)": "миссионер (врач)", "mountaineer/businessman": "альпинист, предприниматель", "naturalist": "натуралист", "naturalist (ornithologist)": "натуралист (орнитолог)", "naval officer": "морской офицер", "naval officer (blind traveller)": "морской офицер (слепой путешественник)", "nurse/missionary": "сестра милосердия, миссионер", "politician (exile)": "политик (ссыльный)", "scholar (linguist)": "учёный (лингвист)", "scholar (linguist/ethnographer)": "учёный (лингвист, этнограф)", "scholar (orientalist)": "учёный (востоковед)", "scholar (slavist)": "учёный (славист)", "scholar (turkologist; Russian service)": "учёный (тюрколог; на русской службе)", "scientist": "учёный", "scientist (astronomer)": "учёный (астроном)", "scientist (botanist; Dorpat)": "учёный (ботаник; Дерпт)", "scientist (mineralogist)": "учёный (минералог)", "scientist (physicist)": "учёный (физик)", "scientist (zoologist)": "учёный (зоолог)", "scientist/adventurer": "учёный, искатель приключений", "scientist/explorer": "учёный, исследователь", "ship's surgeon/whaler": "судовой врач китобоя", "traveller": "путешественник", "traveller (wife of T. W. Atkinson)": "путешественница (жена Т. У. Аткинсона)", "traveller/later journalist": "путешественник, позднее журналист", "traveller/writer": "путешественник, писатель", "war correspondent/scholar": "военный корреспондент, учёный", "writer": "писатель", "writer/dramatist": "писатель, драматург", "zoologist": "зоолог"};
const NAT_RU = {"British": "британец", "German": "немец", "French": "француз", "Polish": "поляк", "Finnish": "финн", "Italian": "итальянец", "Norwegian": "норвежец", "Austrian": "австриец", "Swedish": "швед", "Irish": "ирландец", "Belgian": "бельгиец", "Dutch": "голландец", "Australian-British": "австралиец британского происхождения", "Hungarian": "венгр", "Faroese": "фаререц", "Danish": "датчанин", "Hungarian-French": "венгр, французский автор"};
const ruOf = (m, v) => (EN ? String(v ?? '').replace(/\s*\/\s*/g, ', ') : m[v] || v);
const fmt = (n, d = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString(window.I18N ? I18N.locale : 'ru-RU', {maximumFractionDigits: d, minimumFractionDigits: d});
const pl = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return fmt(n) + ' ' + (a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b > 1 && b < 5 ? f[1] : f[2]); };
const C = {};
const get = (n) => (C[n] ||= fetch('data/' + n, {cache: 'no-cache'}).then((r) => { if (!r.ok) throw new Error(n); return r.json(); }));
// Решения проверки маршрутов (админка) накладываются на маршруты конвейера: проверенное по тексту и подтверждённое экспертом рисуется линией.
let AGEO = null; get('areas1914.geojson').then((x) => { AGEO = x; }).catch(() => {});
// Белый список проверки (pipeline/validation/verify_all.py): показывается только то, что сверено с текстами книг.
const getV = () => (C['verif'] ||= get('verification.json').catch(() => ({})));
const getRoutes = () => (C['routes+review'] ||= Promise.all([get('routes.json'), fetch('data/review/journeys_review.json', {cache: 'no-cache'}).then((r) => r.ok ? r.json() : {}).catch(() => ({})), getV()]).then(([R, REV, VF]) => {
  const okStop = new Set(VF.route_stops || []), okSum = VF.route_summaries || {};
  const out = [];  // маршруты без проверки по тексту не показываются
  for (const [w, v] of Object.entries(REV)) {
    if (v.status === 'no_journey') continue;
    // Остановки без координат остаются: на карте они разрывают линию, чтобы не рисовать прямой отрезок через неизвестное.
    const stops = (v.stops || []).filter((s) => okStop.has(`${w}:${s.pid}:${s.place}`)).map((s) => [s.place, s.name, s.lon == null ? null : +s.lon, s.lat == null ? null : +s.lat, s.pid ? w + '_p' + s.pid : null, 'text', s.journey || 1, s.quote || '', s.coord_source || '']);
    if (stops.filter((x) => x[2] != null).length > 1) out.push({work: w, method: v.status === 'draft' ? 'draft' : 'manual', status: v.status, reviewer: v.reviewer, date: v.date, summary: okSum[w] === v.summary ? v.summary : '', stops});
  }
  return out;
}));
// Правки иллюстраций из рабочего места (подпись, перевод, тип, поворот, отбор) накладываются на результат конвейера.
const getIll = () => (C['ill+review'] ||= Promise.all([get('illustrations.json'), fetch('data/review/illustrations_review.json', {cache: 'no-cache'}).then((r) => r.ok ? r.json() : {}).catch(() => ({})), getV()]).then(([D, REV, VF]) => {
  const TG = VF.ill_tags || {};  // народы и места — только названные в подписи источника
  const items = D.items.map((x) => ({...x, g: (TG[x.id] || {}).g || [], pl: (TG[x.id] || {}).pl || []})).filter((x) => !(REV[x.id] && REV[x.id].status === 'rejected')).map((x) => { const v = REV[x.id]; return v ? {...x, c: v.caption ?? x.c, ru: v.ru || x.ru || '', k: v.kind || x.k, rx: v.rot || 0, ok: v.status === 'checked'} : x; });
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
// Рубрики народов — единый список для страницы «Народы», сети связей и «Свидетельств» (порядок важен)
const CAT_RU = {indigenous: 'коренные народы Сибири и Степного края', generic: 'обобщённые названия коренного населения', settler: 'русские и другие переселенцы', social: 'социально-правовые группы', neighbour: 'соседние народы', foreign: 'иностранцы'};
const CAT_EN = {indigenous: 'Indigenous peoples of Siberia and the Steppe', generic: 'Generic terms for the indigenous population', settler: 'Russians and other settlers', social: 'Social and legal groups', neighbour: 'Neighbouring peoples', foreign: 'Foreigners'};
const CAT = CAT_RU; window.CATS = {ru: CAT_RU, en: CAT_EN, order: Object.keys(CAT_RU)};
const CATC = {indigenous: '#3f7296', settler: '#a3173a', social: '#9a6b1f', neighbour: '#6a5a9e', foreign: '#6b7785', generic: '#3c7a5a', work: '#a3173a', authority: '#8e9aa6'};
let mapRO = null;

function setMenu(r) { document.querySelectorAll('#menu a').forEach((a) => a.classList.toggle('on', r.startsWith(a.dataset.r) || (a.dataset.r === 'peoples' && r.startsWith('people')) || (a.dataset.r === 'library' && r.startsWith('book'))));
  const mb = document.querySelector('.more-btn'); if (mb) mb.classList.toggle('on', !!document.querySelector('.more-list a.on'));
  closeMenus(); }
// меню: на узких экранах — кнопка-бургер, «О ресурсе» — выпадающий список
const hdr = document.querySelector('header.top'), burger = document.getElementById('burger'), more = document.getElementById('more');
function closeMenus() {
  hdr?.classList.remove('open'); burger?.setAttribute('aria-expanded', 'false');
  more?.classList.remove('open'); more?.querySelector('.more-btn')?.setAttribute('aria-expanded', 'false');
}
burger?.addEventListener('click', () => { const o = !hdr.classList.contains('open'); hdr.classList.toggle('open', o); burger.setAttribute('aria-expanded', o); });
more?.querySelector('.more-btn').addEventListener('click', (e) => { e.stopPropagation(); const o = !more.classList.contains('open'); more.classList.toggle('open', o); e.currentTarget.setAttribute('aria-expanded', o); });
document.addEventListener('click', (e) => { if (more && !more.contains(e.target)) { more.classList.remove('open'); more.querySelector('.more-btn').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
document.getElementById('menu')?.addEventListener('click', (e) => { if (e.target.closest('a[href^="#"]')) closeMenus(); });
// Откуда пришёл читатель: при переходе в книгу или к народу с карты, из иллюстраций, связей и т. п.
// запоминается полный адрес исходного вида (с фильтрами и масштабом), чтобы вернуться туда одной кнопкой.
let atlasDestroy = null;
const ORIG = [['atlas', 'к карте', 'to the map'], ['evidence', 'к свидетельствам', 'to the evidence'], ['people-', 'к народу', 'to the people'], ['peoples', 'к народам', 'to the peoples'], ['illustrations', 'к иллюстрациям', 'to the illustrations'], ['links', 'к связям', 'to the networks'], ['analytics', 'к аналитике', 'to the analytics'], ['publications', 'к публикациям', 'to the publications'], ['home', 'на главную', 'to the home page']];
function noteOrigin(e) {
  const h = location.hash.slice(1), old = e && e.oldURL ? (new URL(e.oldURL).hash || '#home').slice(1) : '';
  const key = h.startsWith('book-') ? 'book-' + h.slice(5).replace(/-p\d+$/, '') : h.startsWith('people-') ? h.split('?')[0] : '';
  if (!key || !old) return;
  const oldKey = old.startsWith('book-') ? 'book-' + old.slice(5).replace(/-p\d+$/, '') : old.split('?')[0];
  if (oldKey === key) return; // листание абзацев той же книги — источник не меняется
  if (ORIG.some(([p]) => old.startsWith(p)) || old.startsWith('book-')) { try { sessionStorage.setItem('from:' + key, '#' + old); } catch (x) {} }
  else { try { sessionStorage.removeItem('from:' + key); } catch (x) {} }
}
function crumbs(trail, key) {
  let back = ''; let from = null; try { from = sessionStorage.getItem('from:' + key); } catch (x) {}
  if (from) {
    const f = from.slice(1), o = ORIG.find(([p]) => f.startsWith(p));
    const lbl = o ? (EN ? o[2] : o[1]) : f.startsWith('book-') ? (EN ? 'to the book' : 'к книге') : (EN ? 'back' : 'назад');
    back = `<a class="crumb-back" href="${esc(from)}" data-noi18n>← ${EN ? 'Back ' : 'Вернуться '}${lbl}</a>`;
  }
  return `<nav class="crumbs" aria-label="${EN ? 'Breadcrumbs' : 'Навигационная цепочка'}">${back}<ol>${trail.map(([t, href], i) => `<li>${href && i < trail.length - 1 ? `<a href="${href}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}</li>`).join('')}</ol></nav>`;
}
async function route(e) {
  noteOrigin(e);
  if (!AGEO) { try { AGEO = await get('areas1914.geojson'); } catch (x) {} }
  if (atlasDestroy) { try { atlasDestroy(); } catch (x) {} atlasDestroy = null; }
  const h = (location.hash || '#home').slice(1) || 'home';
  setMenu(h.startsWith('analytics') ? 'analytics' : h.split('?')[0]); if (mapRO) { mapRO.disconnect(); mapRO = null; }
  V.innerHTML = '<div class="wrap loading">Загрузка…</div>';
  try {
    if (h === 'home') await home();
    else if (h === 'atlas2' || h.startsWith('atlas2?')) { history.replaceState(null, '', '#atlas' + h.slice(6)); await atlas2(); }
    else if (h === 'atlas' || h.startsWith('atlas?')) await atlas2();
    else if (h === 'atlas-classic' || h.startsWith('atlas-classic?')) await atlas();
    else if (h === 'peoples') await peoples();
    else if (h.startsWith('people-')) await people(fromH(h.slice(7)));
    else if (h === 'library') await library();
    else if (h.startsWith('book-')) { const m = h.slice(5).match(/^(.*?)(?:-p(\d+))?$/); await book(fromH(m[1]), m[2]); }
    else if (h === 'illustrations' || h.startsWith('illustrations?')) await illustrations();
    else if (h === 'links' || h.startsWith('links?')) await links();
    else if (h.startsWith('analytics')) await analytics();
    else if (h === 'publications') await publications();
    else if (h === 'evidence' || h.startsWith('evidence?')) await research('evidence');
    else if (h === 'data') await research('data');
    else if (h === 'method') await method();
    else if (h === 'scope') await scope();
    else await home();
    const hb = h.split('?')[0], tk = Object.keys(TITLES).find((k) => hb === k || hb.startsWith(k + '-')); document.title = tk ? TITLES[tk] + ' — Iter Sibiricum' : 'Iter Sibiricum — европейские травелоги о Сибири, 1800–1930';
    if (!/^book-.*-p\d+$/.test(h) && !h.startsWith('analytics-')) window.scrollTo(0, 0);
  } catch (e) { V.innerHTML = `<div class="wrap band"><h2>Не удалось загрузить данные</h2><p class="mute">${esc(e.message)}. Сайт читает файлы из папки data/; откройте его через веб-сервер (GitHub Pages или python -m http.server).</p></div>`; }
}
window.addEventListener('hashchange', route);
const TITLES = {evidence: 'Свидетельства', data: 'Данные', atlas: 'Атлас', peoples: 'Народы', people: 'Народы', library: 'Библиотека', book: 'Библиотека', illustrations: 'Иллюстрации', links: 'Связи', analytics: 'Аналитика', publications: 'Публикации', scope: 'Границы и категории', method: 'Метод и данные'};

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
  const [A, works, routes, places, geo, groups, reuse, P, VF] = await Promise.all([get('analytics.json'), get('works.json'), getRoutes(), get('places.json'), get('geo.json'), get('groups.json'), get('reuse.json'), project(), getV()]);
  const SA = !!(VF.sample_annotation && VF.sample_annotation.verified);  // результаты разметки выборки — только после проверки
  const S = A.summary;
  const mod = A.models.find((m) => m.term === 'personal' && m.model.startsWith('pos'));
  const ext = A.discourse.filter((r) => r.discourse === 'extinction' && r.dimension === 'period'), e0 = ext[0], e1 = ext.find((r) => r.key.startsWith('1905'));
  const langs = new Set(works.map((w) => w.lang)).size;
  const manual = routes.filter((r) => r.method === 'manual').length;
  const ind = groups.filter((g) => g.category === 'indigenous');
  const top = ['khanty', 'sakha', 'buryat', 'evenki_even', 'chukchi', 'kazakh_kirghiz'].map((id) => groups.find((g) => g.id === id)).filter(Boolean);
  V.innerHTML = `
  <section class="wrap intro">
    <div class="intro-grid"><div class="intro-text">
    ${P.grant ? `${EN ? `<p class="ack" data-noi18n>Prepared with the support of the Russian Science Foundation, grant <span class="nw">No. ${esc(P.grant)}</span>, <a href="${esc(P.grant_url)}">${esc(P.grant_url)}</a>, and the Government of the Altai Republic.</p>` : `<p class="ack">Ресурс подготовлен при поддержке гранта Российского научного фонда <span style="white-space:nowrap">${EN ? 'No.' : '№'} ${esc(P.grant)}</span>, <a href="${esc(P.grant_url)}">${esc(P.grant_url)}</a>, и Правительства Республики Алтай.</p>`}` : ''}
    <h1 class="name">Iter Sibiricum<span class="ast" aria-hidden="true">*</span></h1>
    <p class="purpose">Цифровой ресурс посвящён тому, как европейские путешественники 1800–1930 годов описывали народы Сибири и отношения между ними. В нём собраны полные тексты ${pl(works.length, ['книги', 'книг', 'книг'])} на ${langs} языках, карты маршрутов, карточки народов и открытые данные со ссылками на абзацы источников.</p>
    ${EN ? `<p class="name-note" data-noi18n><span class="ast" aria-hidden="true">*</span> <i>Iter Sibiricum</i> means “Siberian journey”: eighteenth-century scholars used the Latin word <i>iter</i> both for a journey and for its written account (cf. Linnaeus’s <i>Iter Lapponicum</i>, 1732).</p>` : `<p class="name-note"><span class="ast" aria-hidden="true">*</span> <i>Iter Sibiricum</i> — «сибирское путешествие»: латинским словом <i>iter</i> учёные XVIII века называли и путешествие, и его описание (ср. «Лапландское путешествие» — <i>Iter Lapponicum</i> К. Линнея, 1732).</p>`}
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
      <div class="door"><a class="dt" href="#atlas">Проследить маршруты</a><span class="dd">Пути путешественников по периодам, места, о которых они писали, и ареалы народов.</span><span class="dn">Атлас</span></div>
      <div class="door"><a class="dt" href="#peoples">Как описывали народы</a><span class="dd">Кто и когда писал о каждом народе, в каких выражениях и в связи с какими сюжетами; цитаты из источников.</span><span class="chips">${top.map((g) => `<a class="chip" href="#people-${toH(g.id)}">${esc(g.name.split(' (')[0].split(' /')[0])}</a>`).join('')}</span><span class="dn">Народы</span></div>
      <div class="door"><a class="dt" href="#analytics">Закономерности в корпусе</a><span class="dd">Частоты по десятилетиям, дискурсы, сети совместных упоминаний, ссылки на предшественников и общие отрывки текста.</span><span class="dn">Аналитика и связи</span></div>
    </div>
  </section>
  <section class="band"><div class="wrap">
    <div class="sechead"><h2>Маршруты путешественников</h2><a href="#atlas">Открыть атлас</a></div>
    <div class="mapbox heromap" id="homeMap"></div>
    <div class="mapnote" data-noi18n><span class="pv-per">${['--p1', '--p2', '--p3', '--p4', '--p5'].map((v, k) => `<span><i style="background:var(${v})"></i>${esc(EN ? ['before 1855', '1856–1880', '1881–1904', '1905–1917', '1918–1930'][k] : ['до 1855', '1856–1880', '1881–1904', '1905–1917', '1918–1930'][k])}</span>`).join('')}</span><span>${EN ? `${manual} routes reconstructed from the texts; each stop is supported by a paragraph of the source. Line colour indicates the period of the journey. Hover over a route to see the book; click to open it.` : `${pl(manual, ['маршрут восстановлен', 'маршрута восстановлены', 'маршрутов восстановлено'])} по тексту книг; каждая остановка подтверждена абзацем источника. Цвет линии обозначает период поездки. При наведении на маршрут появляется название книги, щелчок открывает её текст.`}</span><span><i class="g"></i>${EN ? 'dashed: a stretch of more than 800 km where the author names no places' : 'пунктир — перегон длиннее 800 км, на котором автор не называет мест'}</span><span><i class="a"></i>${EN ? 'areas of indigenous peoples after the Ethnographic Map of Asiatic Russia (1914)' : 'ареалы коренных народов по «Этнографической карте Азиатской России» (1914)'}</span></div>
  </div></section>
  <section class="band alt"><div class="wrap">
    <h2>Что показывает корпус</h2>
    <div class="findings">
      ${SA ? `<div><div class="k">24 и 6%</div><h3>Оценка связана с личным наблюдением</h3><p>Положительные оценки встречаются в 24% описаний, сделанных по личному наблюдению, и в 6% — по пересказу, книгам или обобщениям (230 описаний из 61 книги; с поправкой на период, страну и тип поездки отношение шансов ${fmt(mod.OR, 1)}, 95% ДИ ${fmt(mod.lo, 1)}–${fmt(mod.hi, 1)}). Речь идёт о статистической связи, а не о причинной зависимости; разметка выборки предварительная.</p><a href="#analytics">Модели и рамки описания</a></div>` : ''}
      <div><div class="k">${fmt(100 * e0.share, 1)} → ${fmt(100 * e1.share, 1)}%</div><h3>Мотив вымирания становится частотнее</h3><p>Такова его доля в абзацах о коренных народах до 1855 года и в 1905–1917 годах (у второй цифры широкий интервал: ${fmt(100 * e1.lo, 1)}–${fmt(100 * e1.hi, 1)}%, ${e1.works} книг). В те же десятилетия внимание к каторге сменяется вниманием к переселенцам.</p><a href="#analytics-ngram">Ngram и дискурсы</a></div>
      <div><div class="k">${fmt(reuse.length)}</div><h3>Общие отрывки в разных книгах</h3><p>Число пар абзацев из разных книг с общими фрагментами текста: цитаты с указанием автора, цитаты в кавычках, самоповторы и совпадения без указания источника.</p><a href="#links?m=i">Сеть ссылок и общих отрывков</a></div>
    </div>
  </div></section>
  <section class="band"><div class="wrap about">
    <div>
      <h2>О проекте</h2>
      <p>Ресурс создан по итогам исследования восприятия межнациональных отношений в Сибири в европейских травелогах XIX — начала XX века. Корпус сформирован по библиографическим справочникам и фондам электронных библиотек и обработан методами корпусной лингвистики. Подробнее — в разделе <a href="#method">«Метод и данные»</a>.</p>
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
        <dt>Таблицы</dt><dd><a href="${REPO}/tree/main/pipeline/data">упоминания, места, маршруты, разметка выборки</a> в CSV</dd>
        <dt>Код</dt><dd><a href="${REPO}/tree/main/pipeline/analysis">скрипты на Python</a>: от очистки распознанного текста до сборки сайта</dd>
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
    qr.innerHTML = R.length ? R.map((x) => `<li><a href="${x.h}"><span>${esc(x.t)}</span><span class="mute small">${x.c}</span></a></li>`).join('') : '<li class="mute small" style="padding:10px 14px">Ничего не найдено. Поиск по тексту отдельной книги доступен в режиме чтения.</li>'; qr.hidden = false; });
  qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const a = qr.querySelector('a'); if (a) location.hash = a.getAttribute('href'); } });
  document.getElementById('copyCite').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(document.getElementById('citeBox').textContent); e.target.textContent = 'Ссылка скопирована'; } catch (err) { e.target.textContent = 'Выделите текст и скопируйте вручную'; } });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  heroPlates(works, reduce);
  let first = !reduce;
  (async () => {
    const el = document.getElementById('homeMap'); if (!el) return;
    if (!window.Atlas2) { try { await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'assets/atlas2.js?v=70'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); } catch (x) { return; } }
    if (!el.isConnected) return;
    const pv = await Atlas2.preview(el, {routes, works, ind, areaGeo: AGEO, onWork: (w) => location.hash = 'book-' + toH(w)});
    if (!el.isConnected) { pv.destroy(); return; }
    atlasDestroy = pv.destroy;
  })();
}

// ---------------- иллюстрации ----------------
const KIND = {people: 'Люди', portrait: 'Портреты', view: 'Виды', map: 'Карты', nature: 'Природа', object: 'Предметы', other: 'Прочее'};
const iaPage = (x) => x.src === 'pg' ? x.u : `https://archive.org/details/${encodeURIComponent(x.ia)}/page/n${x.n}/mode/1up`;
// подпись по книге-источнику: рисовальщики и граверы, указанные на гравюрах, пока не внесены
const illBy = (w, W) => W[w] ? `${EN ? 'from the book' : 'из книги'}: ${W[w].author}, ${W[w].year}` : w;

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
    // подпись меняется в тот же момент, когда начинает проявляться новое изображение
    im.onload = () => { if (L[i] !== x) return; fr.appendChild(im); fr.href = h; const fc = cap.parentElement, put = () => { cap.href = h; cap.textContent = x.c || 'Без подписи'; byl.textContent = (x.ru && !EN ? x.ru + ' · ' : '') + illBy(x.w, W); fc.classList.remove('sw'); }; if (reduce || !cap.textContent) put(); else { fc.classList.add('sw'); setTimeout(put, 600); } requestAnimationFrame(() => im.classList.add('on')); [...fr.querySelectorAll('img')].slice(0, -1).forEach((o) => { o.classList.remove('on'); setTimeout(() => o.remove(), 1400); }); };
    im.src = x.t;
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
    <p class="small mute ill-note">Изображения извлечены из сканов Internet Archive (страницы с графикой отбираются автоматически, иллюстрации вырезаются, альбомные вклейки поворачиваются) и из HTML-изданий Project Gutenberg, где подписи набраны текстом. Подписи к сканам — распознанный текст оригинала, в нём возможны ошибки. Тип изображения, народы и места определены по подписи; если места в подписи нет, регион предварительно определён по соседнему абзацу. Для каждого изображения даны ссылки на источник и на соседний абзац в библиотеке. В подписи указана книга, из которой взято изображение; имена рисовальщиков, граверов и фотографов, обозначенные на листах, пока не приведены. О различии рубрик «портреты» и «люди», а также о том, почему фотографии каторжных и антропологические «типы» представлены как исторические документы, см. на странице <a href="#scope">«Границы и категории»</a>. Подробнее о методе — в разделе <a href="#method">«Метод и данные»</a>.</p>
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
  <section><div class="wrap"><div class="ill-grid" id="grid"></div><p class="more"><button type="button" id="illMore" hidden>Показать ещё</button></p></div></section>
  <dialog class="ill-dlg" id="dlg" aria-label="Иллюстрация"></dialog>`;
  const grid = document.getElementById('grid'), more = document.getElementById('illMore'), dlg = document.getElementById('dlg');
  const card = (x) => `<figure class="ill"><a href="#illustrations?i=${encodeURIComponent(x.id)}" data-i="${esc(x.id)}">${illImg(x)}</a><figcaption><span class="c">${x.c ? esc(x.c) : '<span class="mute">без подписи</span>'}</span>${x.ru && !EN ? `<span class="ru">${esc(x.ru)}</span>` : ''}<span class="s">${esc(illBy(x.w, W))}</span></figcaption></figure>`;
  const draw = () => {
    const q = st.q.toLowerCase();
    cur = I.filter((x) => (!st.k || x.k === st.k) && (!st.w || x.w === st.w) && (!st.g || x.g.includes(st.g)) && (!st.per || W[x.w]?.period === st.per) && (!st.rg || rgOf(x) === st.rg) && (!q || ((x.c || '') + ' ' + (x.ru || '')).toLowerCase().includes(q)));
    grid.innerHTML = cur.slice(0, lim).map(card).join('') || '<p class="mute">Иллюстраций, отвечающих выбранным условиям, нет. Попробуйте снять один из фильтров.</p>';
    more.hidden = cur.length <= lim;
    document.getElementById('fN').textContent = cur.length === I.length ? '' : `Показано: ${pl(cur.length, ['изображение', 'изображения', 'изображений'])}`;
  };
  document.querySelectorAll('#fK button').forEach((b) => b.addEventListener('click', () => { st.k = b.dataset.k; document.querySelectorAll('#fK button').forEach((o) => o.classList.toggle('on', o === b)); lim = 96; draw(); }));
  [['fW', 'w'], ['fG', 'g'], ['fP', 'per'], ['fR', 'rg']].forEach(([id, k]) => document.getElementById(id).addEventListener('change', (e) => { st[k] = e.target.value; lim = 96; draw(); }));
  let qt; document.getElementById('fQ').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { st.q = e.target.value.trim(); lim = 96; draw(); }, 200); });
  more.addEventListener('click', () => { lim += 96; draw(); });
  // дальше подгружается само, когда кнопка показывается на экране
  const ioM = new IntersectionObserver((es) => { if (es[0].isIntersecting && !more.hidden && grid.isConnected) { lim += 96; draw(); } }, {rootMargin: '600px'}); ioM.observe(more);
  const open = (id) => {
    const k = cur.findIndex((x) => x.id === id), x = k >= 0 ? cur[k] : I.find((y) => y.id === id); if (!x) return;
    const w = W[x.w];
    dlg.innerHTML = `<div class="dlg-in">
      <div class="dlg-img">${illImg(x, false)}</div>
      <div class="dlg-meta">
        <p class="dlg-cap">${x.c ? esc(x.c) : '<span class="mute">Подпись не распознана</span>'}</p>${x.ru && !EN ? `<p class="dlg-ru">${esc(x.ru)}</p>` : ''}
        <dl>
          <dt>Книга</dt><dd><a href="#book-${toH(x.w)}">${esc(w ? w.author : x.w)}</a>${w ? `, ${w.year}` : ''}</dd>
          <dt>Тип</dt><dd>${KIND[x.k] || x.k}${x.r || x.rx ? ', альбомная вклейка (повёрнута)' : ''}</dd>
          ${x.g.length ? `<dt>Народы</dt><dd>${x.g.filter((g) => G[g]).map((g) => `<a href="#people-${toH(g)}">${esc(G[g].name)}</a>`).join(', ')}</dd>` : ''}
          <dt>Регион</dt><dd>${RG[rgOf(x)]}${x.rb === 'cap' ? ` — по подписи${x.pl.length ? ': ' + esc(x.pl.join(', ')) : ''}` : x.rb === 'par' ? ' — по соседнему абзацу' : ''}</dd>
          ${x.f ? `<dt>В книге</dt><dd>к странице ${esc(x.f)}</dd>` : ''}
        </dl>
        <p class="dlg-links">${x.p ? `<a href="#book-${toH(x.w)}-p${esc(x.p)}">Текст рядом с иллюстрацией</a>` : ''}<a href="${iaPage(x)}" target="_blank" rel="noopener">${x.src === 'pg' ? 'Издание в Project Gutenberg' : 'Страница скана в Internet Archive'}</a></p>
        <p class="small mute">Изображение из книги, перешедшей в общественное достояние; ${x.src === 'pg' ? 'электронное издание — Project Gutenberg' : 'скан — Internet Archive'}.</p>
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
async function research(page) {
  if (!window.Research) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'assets/research.js?v=70'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  await window.Research[page](V, {get, esc, toH, fmt, PER, NAT, EN, cites, citeDialog, reportLinks, SITE_URL, pad5, project});
}
async function atlas2() {
  await new Promise((res, rej) => { if (window.Atlas2) return res(); const s = document.createElement('script'); s.src = 'assets/atlas2.js?v=70'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  const d = await window.Atlas2.render(V, {get, getRoutes, esc, toH, PER, NAT});
  if (/^#atlas(\?|$)/.test(location.hash)) atlasDestroy = d; else d();
}
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
    <p class="lede">Линиями показаны маршруты, каждая остановка которых подтверждена абзацем, где автор сообщает о своём пребывании в этом месте. Сейчас их ${nMan}. Цвет линии обозначает период поездки. Если выбрать книгу, на карте появятся её маршрут, остановки со ссылками на абзацы и все упомянутые в ней места.</p>
    <div class="ctl">
      <label>Книга <select id="fWork"><option value="">все</option>${opt(works.slice().sort((a, b) => a.year - b.year).map((w) => [w.id, w.label + (RT[w.id] ? (RT[w.id].method === 'manual' ? ' (маршрут)' : ' (черновик маршрута)') : '')]))}</select></label>
      <label>Период <select id="fPer"><option value="">все</option>${opt(Object.entries(PER))}</select></label>
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
  const draw = mapIn(el, () => ({geo, routes, places, works, bookgeo, areas: st.areas ? ind : null, areaGeo: AGEO, showAreas: st.areas, showManual: st.manual, showPlaces: st.places && !st.work, filter: filt,
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
      const badge = !r ? '<span class="status">маршрут не определён</span>' : r.method === 'draft' ? '<span class="status draft">черновик маршрута</span>' : '';
      h += `<h3><a href="#book-${toH(w.id)}">${esc(w.label)}</a></h3><p class="small mute">${esc(w.author)} · ${esc(w.nat_ru)} · ${esc(w.stay_ru)} · поездка ${w.j0 ? yr(w.j0) : '?'}${w.j1 && w.j1 !== w.j0 ? '–' + yr(w.j1) : ''}</p>${badge ? `<p>${badge}</p>` : ''}`;
      if (r && r.summary) h += `<p class="small">${esc(r.summary)}</p>`;
      if (r && r.method === 'manual') h += `<ol class="small">${r.stops.map((s) => `<li>${esc(s[1])}${(String(s[8]).startsWith('estimate') || String(s[8]).endsWith('_ctx')) ? ` <span class="mute" title="${s[8] === 'estimate_manual' ? 'Координаты оценены по историческим картам и ходу маршрута; требуют проверки' : 'Координаты приблизительные'}">≈</span>` : s[2] == null ? ' <span class="mute">· нет на карте: координаты не установлены</span>' : ''}${s[5] === 'not_found_in_text' ? ' <span class="mute">— в тексте не найдено</span>' : para(w.id, s[4])}</li>`).join('')}</ol>${r.stops.some((s) => String(s[8]).startsWith('estimate') || String(s[8]).endsWith('_ctx')) ? '<p class="small mute">≈ — координаты места приблизительные: пункт не найден однозначно ни в GeoNames, ни в Wikidata.</p>' : ''}`;
      else if (r) h += `<p class="small">Черновик маршрута составлен автоматически: в него включены места, о посещении которых пишет автор («мы прибыли в…», «we left…»); порядок остановок предварительный. Номера на карте соответствуют номерам в списке; пунктирным кружком отмечены места, посещение которых упомянуто в тексте лишь однажды.</p><ol class="small">${r.stops.map((s) => `<li>${esc(s[1])}${para(w.id, s[4])}${s[5] === 'higher' ? '' : ' <span class="mute">· одно свидетельство</span>'}</li>`).join('')}</ol>`;
      else h += `<p class="small">Автоматический поиск не выявил в книге мест, о посещении которых пишет автор; возможно, это обзорное сочинение, компиляция или текст с некачественным распознаванием. На карте показаны все места, упомянутые в книге.</p>`;
    }
    if (st.group) { const g = gr(); h += `<h3 style="margin-top:18px"><a href="#people-${toH(g.id)}">${esc(g.name)}</a></h3><p class="small mute">Кругами отмечены места, упомянутые в одних абзацах с этим народом.</p>`; }
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
    <p>Этнонимы источников («Ostiak», «Tartar», «Kirghiz») приводятся в авторском написании и соотнесены с современными названиями народов; спорные отождествления отмечены особо. Диаграмма на карточке показывает частоту упоминаний народа по десятилетиям поездок (на миллион слов о Сибири). Рубрики, по которым сгруппированы народы, носят рабочий характер и воспроизводят взгляд источников из имперского центра; их обоснование и принятые границы Сибири изложены на странице <a href="#scope">«Границы и категории»</a>.</p>
    ${window.CATS.order.filter((c) => sec(c).length).map((c) => `<h2 class="cap" style="margin-top:28px">${CAT[c]}</h2><div class="cards">${sec(c).map(card).join('')}</div>`).join('')}
  </div></section>`;
}
async function people(id) {
  const [groups, works, places, geo, VF] = await Promise.all([get('groups.json'), get('works.json'), get('places.json'), get('geo.json'), getV()]);
  const g = groups.find((x) => x.id === id); if (!g) return peoples();
  const SA = !!(VF.sample_annotation && VF.sample_annotation.verified), okQ = new Set(VF.group_quotes || []);
  const quotes = (g.quotes || []).filter((q) => okQ.has(q.pid));  // только цитаты, найденные в тексте книги
  const W = Object.fromEntries(works.map((w) => [w.id, w]));
  const langs = ['en', 'fr', 'de'].filter((l) => (g.collocations[l] || []).length);
  V.innerHTML = `<section class="band"><div class="wrap">
    ${crumbs([['Народы и группы', '#peoples'], [EN ? g.name_en : g.name]], 'people-' + toH(id))}
    <h1>${esc(g.name)}</h1>
    <p class="mute">${EN ? '' : esc(g.name_en) + ' · '}${g.family ? esc(g.family) + ' · ' : ''}${CAT[g.category] || ''} · ${fmt(g.mentions)} упоминаний в Сибири, ${g.works} книг</p>
    ${g.note && EN ? `<p class="small">${esc(g.note)}</p>` : ''}
    <div class="chips">${g.forms.map((f) => `<span class="chip">${esc(f)}</span>`).join('')}</div>
    <div class="side" style="margin-top:20px">
      <div><p><a class="btnlike" href="#evidence?g=${esc(g.id)}">${EN ? 'All paragraphs about them' : 'Все абзацы о них'} (${fmt(g.mentions)}) →</a></p><div class="mapbox" id="pMap"></div><p class="small mute" data-noi18n>${(() => { const f = ((AGEO && AGEO.features) || []).find((x) => x.properties.groups.includes(g.id)); return EN ? (f ? `Hatching shows the area as drawn on the Ethnographic Map of Asiatic Russia (1914), where this people is named “${esc(f.properties.term)}”` : 'The Ethnographic Map of Asiatic Russia (1914) does not show an area for this people') + '; circles mark places named in the same paragraphs as this people.' : (f ? `Штриховкой показан ареал по «Этнографической карте Азиатской России» (1914), где народ назван «${esc(f.properties.term)}»` : 'На «Этнографической карте Азиатской России» (1914) ареал этого народа не обозначен') + '; кругами отмечены места, упомянутые в одних абзацах с этим народом.'; })()}</p></div>
      <div><h3>Упоминания во времени</h3><div class="chart" id="pSeries"></div><p class="small mute">Частота на миллион слов о Сибири по десятилетиям поездок; над столбцами указано число упоминаний.</p></div>
    </div>
    <div class="cols" style="margin-top:20px">
      <div><h3>Кто описывал чаще всего</h3><p class="small mute">Упоминаний на 10 тыс. слов о Сибири в книге (книги, где о Сибири больше 5 тыс. слов).</p>${bars(g.authors.map(([w, n, p]) => [W[w] ? W[w].label : w, p, '#book-' + toH(w)]), {d: 1})}</div>
      <div><h3>Коллокации</h3>${langs.length ? `<div class="ctl">${langs.map((l, i) => `<button data-l="${l}" class="${i ? '' : 'on'}">${l}</button>`).join('')}</div><div id="pCol"></div><p class="small mute">Окно ±5 слов, мера logDice; показаны только значимые сочетания (p &lt; 0,001). По ссылке — пример употребления в тексте.</p>` : '<p class="mute">Упоминаний недостаточно для выявления значимых коллокаций.</p>'}</div>
      <div><h3>Дискурсы в абзацах о народе</h3>${g.discourses.length ? bars(g.discourses.filter((d) => d[1] > 0).map((d) => [d[0], d[1]]), {d: 1, unit: '%'}) + '<p class="small mute">Доля абзацев о народе, в которых встречаются слова-маркеры дискурса (поиск по правилам).</p>' : '<p class="mute">Данных недостаточно.</p>'}</div>
    </div>
    ${quotes.length ? `<h2 style="margin-top:28px">${SA ? 'Оценки в источниках: примеры из размеченной выборки' : 'Фрагменты из источников'}</h2>${quotes.map((q) => `<div class="quote">${esc(q.text)}<div class="m">${esc(q.work)}${SA ? ` · оценка: <span class="${q.pol === 'отрицательная' ? 'neg' : q.pol === 'положительная' ? 'pos' : ''}">${esc(q.pol)}</span>${q.stereotype ? ' · ' + esc(q.stereotype) : ''}` : ''} · <a href="#book-${toH(q.pid.split('_p')[0])}-p${esc(q.pid.split('_p')[1])}">абзац</a></div></div>`).join('')}` : ''}
  </div></section>`;
  const val = (p) => (p.groups.find((x) => x[0] === g.name) || [0, 0])[1];
  const gf = ((AGEO && AGEO.features) || []).filter((f) => f.properties.groups.includes(g.id));
  const flat = (c) => (typeof c[0] === 'number' ? [c] : c.flatMap(flat));
  const ext = gf.length ? (() => { const P = gf.flatMap((f) => flat(f.geometry.coordinates)), lo = P.map((p) => p[0]), la = P.map((p) => p[1]); return {type: 'MultiPoint', coordinates: [[Math.min(...lo) - 6, Math.min(...la) - 4], [Math.max(...lo) + 6, Math.max(...la) + 4]]}; })()
    : g.areas.length ? {type: 'MultiPoint', coordinates: g.areas.flatMap((a) => [[a[0] - a[2] - 8, a[1] - a[3] - 5], [a[0] + a[2] + 8, a[1] + a[3] + 5]])} : null;
  mapIn(document.getElementById('pMap'), () => ({geo, places, areas: [g], areaGeo: AGEO, focusGroup: g.id, placeValue: val, placeMax: 16, nLabels: 6, extent: ext, labels: true}));
  seriesChart(document.getElementById('pSeries'), g.series);
  const col = (l) => { const el = document.getElementById('pCol'); if (!el) return; const rows = g.collocations[l] || []; el.innerHTML = `<table><thead><tr><th>Слово</th><th class="n">Частота</th><th class="n">logDice</th><th>Пример</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td class="n">${r[1]}</td><td class="n">${fmt(r[2], 2)}</td><td><a href="#book-${toH(r[3].split('_p')[0])}-p${esc(r[3].split('_p')[1])}">${esc(r[3].split('_p')[0])}</a></td></tr>`).join('')}</tbody></table>`; };
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
    <p>${works.length} изданий. Тексты очищены от колонтитулов, номеров страниц и переносов; в режиме чтения выделены названия народов, абзацы о Сибири отмечены синей чертой.</p>
    <div class="ctl"><input type="search" id="lq" placeholder="Автор, название, роль…" aria-label="Поиск"><select id="ll" aria-label="Язык"><option value="">все языки</option>${[...new Set(works.map((w) => w.lang))].map((l) => `<option>${l}</option>`).join('')}</select>
    <select id="ln" aria-label="Страна"><option value="">все страны</option>${[...new Set(works.map((w) => w.nat))].map((n) => `<option value="${n}">${NAT[n] || n}</option>`).join('')}</select>
    <select id="lp" aria-label="Период"><option value="">все периоды</option>${Object.entries(PER).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <select id="ls" aria-label="Сортировка"><option value="year">по году издания</option><option value="per10k">по частоте этнонимов</option><option value="words_sib">по объёму текста о Сибири</option></select></div>
    <div class="scroll"><table class="stack"><thead><tr><th>Книга</th><th>Автор</th><th>Страна</th><th>Поездка</th><th>Тип</th><th>Язык</th><th class="n">Слов о Сибири</th><th class="n">Этнонимов на 10 тыс.</th></tr></thead><tbody id="lb"></tbody></table></div>
    <p class="small mute" id="lc"></p></div></section>`;
  const render = () => {
    const q = st.q.toLowerCase();
    const rows = works.filter((w) => (!q || [w.label, w.author, w.role, w.nationality, w.title || ''].join(' ').toLowerCase().includes(q)) && (!st.lang || w.lang === st.lang) && (!st.nat || w.nat === st.nat) && (!st.per || w.period === st.per))
      .sort((a, b) => st.sort === 'year' ? a.year - b.year : (b[st.sort] || 0) - (a[st.sort] || 0));
    document.getElementById('lb').innerHTML = rows.map((w) => `<tr class="click" data-id="${esc(w.id)}"><td><a href="#book-${toH(w.id)}">${esc(w.label)}</a>${w.core ? '' : ' <span class="small mute">на проверке</span>'}${w.title_short ? `<br><span class="small mute lib-t" lang="${esc(w.lang)}" data-noi18n>${esc(w.title_short)}</span>` : ''}</td><td>${esc(w.author)}</td><td>${esc(w.nat_ru)}</td><td>${w.j0 ? yr(w.j0) : '—'}</td><td>${esc(w.stay_ru)}</td><td>${esc(w.lang)}${w.translation ? ' (пер.)' : ''}</td><td class="n">${fmt(w.words_sib)}</td><td class="n">${fmt(w.per10k, 1)}</td></tr>`).join('');
    document.getElementById('lc').textContent = `Показано ${rows.length} из ${works.length}.`;
  };
  document.getElementById('lq').addEventListener('input', (e) => { st.q = e.target.value; render(); });
  [['ll', 'lang'], ['ln', 'nat'], ['lp', 'per'], ['ls', 'sort']].forEach(([i, k]) => document.getElementById(i).addEventListener('change', (e) => { st[k] = e.target.value; render(); }));
  document.getElementById('lb').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr && e.target.tagName !== 'A') location.hash = 'book-' + toH(tr.dataset.id); });
  render();
}
// ---------- цитирование, сообщение об ошибке ----------
const SITE_URL = 'https://iter-sibiricum.ru/';
const REPO_ISSUES = 'https://github.com/pavelaleks/iter-sibiricum/issues/new';
const pad5 = (n) => String(n).padStart(5, '0');
function nameParts(a) { const t = String(a || '').trim().split(/\s+/); const last = t.pop() || ''; const first = t.join(' '); const PART = /^(von|van|de|du|der|den|la|le|di|da|af|zu)$/i;
  const ini = t.filter((x) => !PART.test(x)).map((x) => x.split('-').map((y) => y[0] + '.').join('-')).join(' '); const parts = t.filter((x) => PART.test(x)).join(' ');
  return {last, first, ini: (ini + (parts ? ' ' + parts : '')).trim()}; }
function cites(w, n) {
  const N = nameParts(w.author), url = SITE_URL + '#book-' + toH(w.id) + (n ? '-p' + pad5(n) : ''), t = w.title || w.label, d = new Date().toLocaleDateString('ru-RU');
  const pub = w.publisher || '', imprint = pub && w.place && pub.toLowerCase().includes(String(w.place).toLowerCase()) ? pub : [w.place, pub].filter(Boolean).join(' : ');
  const pubName = pub.replace(/^[^:,]*[:,]\s*/, '') || pub;
  const resEn = 'Iter Sibiricum: European travelogues about Siberia, 1800–1930', res = EN ? resEn : 'Iter Sibiricum: европейские травелоги о Сибири, 1800–1930';
  return {
    'ГОСТ Р 7.0.100': `${N.last} ${N.ini} ${t} / ${w.author}. — ${imprint || '[Б. м.]'}, ${w.year}. — Текст : электронный // ${res} : [сайт]. — URL: ${url} (дата обращения: ${d})${n ? '. — Абз. ' + n : ''}.`,
    'Chicago': `${N.last}, ${N.first}. ${t}. ${[w.place, pubName].filter(Boolean).join(': ')}, ${w.year}. ${n ? `Para. ${n}. ` : ''}Digital text in ${resEn}. ${url}.`,
    'BibTeX': `@book{${w.id},\n  author    = {${N.last}, ${N.first}},\n  title     = {${t}},\n  address   = {${w.place || ''}},\n  publisher = {${pubName}},\n  year      = {${w.year}},\n  note      = {Digital text in ${resEn}${n ? `, para.~${n}` : ''}},\n  url       = {${url}}\n}`,
  };
}
function citeDialog(w, n) {
  let dlg = document.getElementById('citeDlg'); if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'citeDlg'; dlg.className = 'cite-dlg'; document.body.appendChild(dlg); }
  const C = cites(w, n);
  dlg.innerHTML = `<div class="cite-in" data-noi18n><button class="x" aria-label="${EN ? 'Close' : 'Закрыть'}">×</button><h3>${EN ? 'Cite' : 'Цитировать'}: ${esc(w.label)}${n ? (EN ? ', paragraph ' : ', абзац ') + n : ''}</h3>
    ${Object.entries(C).map(([k, v], i) => `<div class="cite-row"><div class="cite-h"><b>${k}</b><button data-i="${i}">${EN ? 'Copy' : 'Копировать'}</button></div><pre>${esc(v)}</pre></div>`).join('')}
    <p class="small mute">${EN ? 'Annotation data: ' : 'Данные разметки: '}<a href="https://doi.org/10.5281/zenodo.24531924">doi:10.5281/zenodo.24531924</a>, <a href="https://doi.org/10.5281/zenodo.24532195">doi:10.5281/zenodo.24532195</a>. ${EN ? 'How to cite the resource itself: ' : 'Как цитировать сам ресурс — '}<a href="#data">${EN ? 'Data' : 'раздел «Данные»'}</a>.</p></div>`;
  dlg.querySelector('.x').onclick = () => dlg.close();
  dlg.querySelectorAll('[data-i]').forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(Object.values(C)[+b.dataset.i]); b.textContent = EN ? 'Copied' : 'Скопировано'; } catch (e) {} }));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
}
// ссылка на новую задачу в GitHub с уже заполненным описанием; почта — для тех, у кого нет учётной записи GitHub
function reportLinks(title, lines) {
  const body = lines.filter(Boolean).join('\n') + '\n\n' + (EN ? 'What is wrong and how it should be:' : 'Что не так и как должно быть:') + '\n';
  const gh = `${REPO_ISSUES}?labels=${encodeURIComponent('данные')}&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  const ml = `mailto:pavel.alekseev.gasu@gmail.com?subject=${encodeURIComponent('Iter Sibiricum: ' + title)}&body=${encodeURIComponent(body)}`;
  return `<a href="${esc(gh)}" target="_blank" rel="noopener">${EN ? 'Report an error (GitHub)' : 'Сообщить об ошибке (GitHub)'}</a> <span class="mute">${EN ? 'or' : 'или'}</span> <a href="${esc(ml)}">${EN ? 'by e-mail' : 'письмом'}</a>`;
}

window.__reportLinks = (...a) => reportLinks(...a);
async function book(id, par) {
  const [works, groups, routes, SN] = await Promise.all([get('works.json'), get('groups.json'), getRoutes(), get('source_notes.json').catch(() => ({}))]);
  const w = works.find((x) => x.id === id); if (!w) return library();
  const GN = Object.fromEntries(groups.map((g) => [g.id, g.name])), GE = Object.fromEntries(groups.map((g) => [g.id, EN ? g.name_en : g.name]));
  const r0 = routes.find((x) => x.work === id); const r = r0 && {...r0, stops: r0.stops.filter(inBox)};
  V.innerHTML = `<section class="band"><div class="wrap">${crumbs([['Библиотека', '#library'], [w.label]], 'book-' + toH(id))}
    <div class="reader"><aside>
      <h2 style="font-size:24px">${esc(w.label)}</h2>${w.title ? `<p class="book-title" lang="${esc(w.lang)}" data-noi18n>${esc(w.title)}</p>` : ''}
      <span class="Z3988" title="${esc('ctx_ver=Z39.88-2004&rft_val_fmt=info:ofi/fmt:kev:mtx:book&rft.genre=book&rft.btitle=' + encodeURIComponent(w.title || w.label) + '&rft.au=' + encodeURIComponent(w.author) + '&rft.date=' + w.year + '&rft.place=' + encodeURIComponent(w.place || '') + '&rft.pub=' + encodeURIComponent(w.publisher || '') + '&rft_id=' + encodeURIComponent(SITE_URL + '#book-' + toH(w.id)))}"></span>
      <p><b>${esc(w.author)}</b><br><span class="small mute">${esc(ruOf(NAT_RU, w.nationality || ''))}${w.role ? ' · ' + esc(ruOf(ROLE_RU, w.role)) : ''}${w.gender === 'f' ? ' · женщина-автор' : ''}</span></p>
      <p class="small">Издание: ${yr(w.year)}${w.place ? ', ' + esc(w.place) : ''} · язык текста: ${esc(w.lang)}${w.translation ? ' (перевод с ' + esc(w.orig_lang) + ')' : ''}<br>Поездка: ${w.j0 ? yr(w.j0) : '?'}${w.j1 && w.j1 !== w.j0 ? '–' + yr(w.j1) : ''} · ${esc(w.stay_ru)}<br>Период: ${esc(w.period_ru)}</p>
      <p class="small">${fmt(w.words)} слов, из них о Сибири ${fmt(w.words_sib)}; ${fmt(w.mentions)} упоминаний народов (${fmt(w.per10k, 1)} на 10 тыс.)</p>
      <div class="chips">${w.top_groups.map((g) => `<span class="chip"><span>${esc(g[0])}</span> · ${g[1]}</span>`).join('')}</div>
      <p class="small">${w.sources.map((s) => `<a href="${esc(s)}" rel="noopener">${esc(s.replace('https://', ''))}</a>`).join('<br>')}</p>
      ${r ? `<p class="small"><span>${r.method === 'draft' ? 'Черновик маршрута, на проверке' : 'Маршрут, восстановленный по тексту'}</span>: ${r.stops.map((s) => esc(s[1])).join(r.method === 'draft' ? ', ' : ' → ')}. <a href="#atlas?work=${esc(id)}">Показать на карте</a></p>` : `<p class="small"><a href="#atlas?work=${esc(id)}">география книги на карте</a></p>`}
      <div class="ctl"><button id="onlySib">только о Сибири</button><button id="scanBtn" hidden aria-pressed="false">скан рядом с текстом</button><button id="mapBtn" aria-pressed="false">карта рядом с текстом</button></div>
      <div class="ctl"><button id="citeBtn" title="${EN ? 'Citation of the book and of the paragraph being read' : 'Библиографическая ссылка на книгу и текущий абзац'}">цитировать</button><a class="btnlike" href="#evidence?w=${esc(id)}">свидетельства</a></div>
      <p class="small" id="repLn"></p>
      <label class="small mute">Найти в тексте <input type="search" id="tq" aria-label="Поиск в тексте"></label>
      <p class="small mute" id="tqn"></p>
      <label class="small mute">Подсветить народ <select id="tg"><option value="">все</option>${[...new Set(w.top_groups.map((g) => g[0]))].map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
      ${SN[w.id] ? `<p class="small src-note"><b>Критика источника.</b> ${esc(SN[w.id])}</p>` : ''}
    </aside><div class="text" id="txt"><p class="mute">${EN ? 'Loading the text…' : 'Загрузка текста…'}</p></div><figure class="scan" id="scan" hidden aria-live="polite"></figure><figure class="bookmap" id="bmap" hidden data-noi18n></figure></div></div></section>
    <button class="fab-map" id="mapFab" type="button" aria-label="${EN ? 'Show the map beside the text' : 'Показать карту рядом с текстом'}" data-noi18n>${EN ? 'Map' : 'Карта'}</button>`;
  let T;
  try { T = await (C['t:' + id] ||= fetch('texts/' + id + '.json').then((x) => x.json())); } catch (e) { document.getElementById('txt').innerHTML = EN ? '<p class="mute">Text not found.</p>' : '<p class="mute">Текст не найден.</p>'; return; }
  let only = false, q = '', hg = '';
  // страницы сканов Internet Archive: [номер абзаца, том, страница] — с каких абзацев начинается новая страница (08d)
  let PG = null; try { const r = await fetch('data/pages/' + id + '.json', {cache: 'no-cache'}); if (r.ok) PG = await r.json(); } catch (e) { PG = null; }
  const pageOf = (n) => { if (!PG) return null; const k = +n; let lo = 0, hi = PG.s.length - 1, a = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (PG.s[m][0] <= k) { a = m; lo = m + 1; } else hi = m - 1; } return a == null ? PG.s[0] : PG.s[a]; };
  const starts = new Set(PG ? PG.s.map((x) => x[0]) : []);
  // упоминания мест по абзацам (10b): номер абзаца → [[начало, конец, место]]
  const PM = {}; try { const r = await fetch('data/geo/' + id + '.json'); if (r.ok) (await r.json()).m.forEach(([n, pl, a, b]) => (PM[n] ||= []).push([a, b, pl])); } catch (e) {}
  let scanOn = false, shown = '';
  const scanEl = document.getElementById('scan'), btn = document.getElementById('scanBtn');
  const showScan = (v, n) => {
    if (!scanOn || !PG) return; const key = v + ':' + n; if (key === shown) return; shown = key;
    const ia = PG.v[v], url = `https://archive.org/details/${encodeURIComponent(ia)}/page/n${n}/mode/1up`;
    scanEl.innerHTML = `<div class="scan-bar"><button type="button" data-s="-1" aria-label="Предыдущая страница">←</button><span class="small">страница скана ${n + 1}${PG.v.length > 1 ? ', том ' + (v + 1) : ''}</span><button type="button" data-s="1" aria-label="Следующая страница">→</button><button type="button" class="x" aria-label="Закрыть скан">×</button></div>
      <a href="${url}" target="_blank" rel="noopener" class="scan-img"><span class="small mute">Загрузка скана…</span><img alt="Скан страницы ${n + 1}" src="https://archive.org/download/${encodeURIComponent(ia)}/page/n${n}_w900.jpg" onload="this.previousElementSibling.remove()" onerror="this.previousElementSibling.textContent='Скан не загрузился — откройте страницу в Internet Archive'"></a>
      <figcaption class="small mute"><a href="${url}" target="_blank" rel="noopener">Открыть в Internet Archive</a> · соответствие страницы тексту установлено автоматически</figcaption>`;
    scanEl.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => showScan(v, Math.max(0, n + +b.dataset.s))));
    scanEl.querySelector('.x').addEventListener('click', () => toggleScan(false));
  };
  let io = null;
  const watch = () => {
    if (io) io.disconnect(); if (!scanOn) return;
    io = new IntersectionObserver((es) => { const e = es.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (e) { const pg = pageOf(e.target.id.slice(1)); if (pg) showScan(pg[1], pg[2]); } }, {rootMargin: '-20% 0px -60% 0px'});
    document.querySelectorAll('#txt p[id]').forEach((el) => io.observe(el));
  };
  const anchorP = () => { const ps = [...document.querySelectorAll('#txt p[id]')]; const y = innerHeight * 0.3; return ps.find((el) => el.getBoundingClientRect().bottom > y) || ps[0]; };
  const toggleScan = (on) => {
    // абзац, который читатель видит сейчас, остаётся на месте после перестройки колонок
    const a = anchorP(); scanOn = on; shown = ''; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); scanEl.hidden = !on;
    document.querySelector('.reader').classList.toggle('with-scan', on);
    if (a) a.scrollIntoView({block: 'center'});
    if (on) { const pg = pageOf(a ? a.id.slice(1) : (PG.s[0] || [0])[0]); if (pg) showScan(pg[1], pg[2]); setTimeout(watch, 400); } else watch();
  };
  if (PG) { btn.hidden = false; btn.addEventListener('click', () => { if (!scanOn && mapOn) toggleMap(false); toggleScan(!scanOn); }); }
  // ---- карта рядом с текстом: путь доезжает до абзаца, который читается сейчас; места абзаца подсвечены ----
  let mapOn = false, RD = null, vis = new Set(), io2 = null, rafR = 0, curP = null;
  const mapEl = document.getElementById('bmap'), mbtn = document.getElementById('mapBtn');
  const plOf = (el) => [...new Set((PM[+el.id.slice(1)] || []).map((x) => x[2]))];
  const track = () => { cancelAnimationFrame(rafR); rafR = requestAnimationFrame(() => {
    if (!mapOn || !RD) return; const y = innerWidth <= 960 ? mapEl.getBoundingClientRect().bottom + 48 : innerHeight * 0.4; // на телефоне карта сверху: читается то, что под ней
    const ps = [...vis].filter((el) => el.isConnected).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const cur = ps.find((el) => el.getBoundingClientRect().bottom > y) || ps[ps.length - 1]; if (!cur) return;
    if (curP !== cur) { curP && curP.classList.remove('cur'); cur.classList.add('cur'); curP = cur; }
    RD.setPara(+cur.id.slice(1), plOf(cur));
  }); };
  const watchMap = () => { if (io2) io2.disconnect(); vis = new Set(); if (!mapOn) return;
    io2 = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))); track(); });
    document.querySelectorAll('#txt p[id]').forEach((el) => io2.observe(el)); };
  addEventListener('scroll', track, {passive: true});
  const goPara = (n, pl) => { const el = document.getElementById('p' + String(n).padStart(5, '0')); if (!el) return; el.scrollIntoView({block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    if (pl) el.querySelectorAll(`.plm[data-pl="${CSS.escape(pl)}"]`).forEach((m) => { m.classList.add('flash'); setTimeout(() => m.classList.remove('flash'), 1600); }); };
  const toggleMap = async (on) => {
    const a = anchorP(); mapOn = on; mbtn.classList.toggle('on', on); mbtn.setAttribute('aria-pressed', on); mapEl.hidden = !on; document.getElementById('mapFab').hidden = on;
    document.querySelector('.reader').classList.toggle('with-map', on); try { localStorage.setItem('bookmap', on ? '1' : '0'); } catch (e) {}
    if (a) a.scrollIntoView({block: 'center'});
    if (!on) { if (RD) { RD.destroy(); RD = null; } if (curP) { curP.classList.remove('cur'); curP = null; } watchMap(); return; }
    if (scanOn) toggleScan(false);
    if (!window.Atlas2) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'assets/atlas2.js?v=70'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    if (!mapOn) return;
    RD = await window.Atlas2.reader(mapEl, {work: id, route: r0, PL: Object.fromEntries((await get('places.json')).map((p) => [p.id, p])), bookgeo: (await get('bookgeo.json'))[id], period: w.period,
      onClose: () => toggleMap(false),
      onStop: (i) => { const s = r0.stops[i]; if (s && s[4]) goPara(+s[4].split('_p')[1], s[0]); },
      onPlace: (pl) => { const ns = Object.keys(PM).map(Number).filter((k) => PM[k].some((x) => x[2] === pl)).sort((a, b) => a - b); if (!ns.length) return; const c = curP ? +curP.id.slice(1) : 0; goPara(ns.find((k) => k > c) ?? ns[0], pl); }});
    if (!mapOn) { RD.destroy(); RD = null; return; }
    watchMap(); track();
  };
  mbtn.addEventListener('click', () => toggleMap(!mapOn));
  const curPara = () => { const a = curP || anchorP(); return a ? +a.id.slice(1) : 0; };
  document.getElementById('citeBtn').addEventListener('click', () => citeDialog(w, curPara()));
  const repUpd = () => { const n = curPara(); document.getElementById('repLn').innerHTML = reportLinks(`${w.label}, ${EN ? 'para.' : 'абз.'} ${n}`, [`${EN ? 'Book' : 'Книга'}: ${w.label} (${w.id})`, `${EN ? 'Paragraph' : 'Абзац'}: ${n}`, `${SITE_URL}#book-${toH(w.id)}-p${pad5(n)}`]); };
  let repT = 0; const repS = () => { clearTimeout(repT); repT = setTimeout(repUpd, 400); }; addEventListener('scroll', repS, {passive: true}); setTimeout(repUpd, 600);
  // на телефоне кнопка карты всегда под рукой, читатель не листает к началу книги
  document.getElementById('mapFab').addEventListener('click', () => toggleMap(true));
  document.getElementById('txt').addEventListener('mouseover', (e) => { if (!RD) return; const m = e.target.closest('.plm'); RD.hover(m ? m.dataset.pl : null); });
  atlasDestroy = () => { removeEventListener('scroll', track); removeEventListener('scroll', repS); if (io2) io2.disconnect(); if (RD) RD.destroy(); };
  let fromMap = null; try { fromMap = sessionStorage.getItem('from:book-' + toH(id)); } catch (e) {}
  const wantMap = (fromMap && /^#atlas(\?|$)/.test(fromMap)) || (() => { try { return localStorage.getItem('bookmap') === '1'; } catch (e) { return false; } })();
  const render = () => {
    const re = q.length > 2 ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') : null; let hits = 0;
    const html = T.p.filter((p) => (p[4].match(/\p{L}/gu) || []).length >= 4 && (!only || p[3] || p[1] === 'h')).map((p) => {
      const [n, type, reg, sib, text, ms] = p; let out = '', pos = 0;
      ms.map(([a, b, g]) => [a, b, 0, g]).concat((PM[+n] || []).map(([a, b, pl]) => [a, b, 1, pl])).sort((x, y) => x[0] - y[0] || x[2] - y[2]).forEach(([a, b, k, g]) => { if (a < pos) return;
        out += esc(text.slice(pos, a)) + (k ? `<span class="plm" data-pl="${esc(g)}">${esc(text.slice(a, b))}</span>` : `<mark class="${hg && GN[g] === hg ? 'sel' : ''}" title="${esc(GE[g] || GN[g] || g)}">${esc(text.slice(a, b))}</mark>`); pos = b; });
      out += esc(text.slice(pos));
      if (re) { const c = (text.match(re) || []).length; if (!c) return ''; hits += c; }
      const pg = starts.has(+n) ? pageOf(n) : null;
      const mk = pg ? `<a class="pgm" href="https://archive.org/details/${encodeURIComponent(PG.v[pg[1]])}/page/n${pg[2]}/mode/1up" target="_blank" rel="noopener" data-v="${pg[1]}" data-n="${pg[2]}" title="${EN ? 'Scanned page in the Internet Archive' : 'Страница скана в Internet Archive'}">${EN ? 'scan' : 'скан'} ${pg[2] + 1}</a>` : '';
      return `<p id="p${n}" class="${type === 'h' ? 'h' : ''}${sib ? ' sib' : ''}">${mk}<a class="pid" href="#book-${toH(id)}-p${n}" title="${EN ? 'Permanent link to this paragraph' : 'Постоянная ссылка на абзац'}">${n}</a>${out}</p>`;
    }).join('');
    document.getElementById('txt').innerHTML = html || (EN ? '<p class="mute">No matches.</p>' : '<p class="mute">Ничего не найдено.</p>');
    document.getElementById('tqn').textContent = re ? `Совпадений: ${hits}` : '';
    watch(); if (mapOn) { curP = null; watchMap(); }
  };
  document.getElementById('txt').addEventListener('click', (e) => { const a = e.target.closest('a.pgm'); if (a && scanOn && !e.metaKey && !e.ctrlKey) { e.preventDefault(); showScan(+a.dataset.v, +a.dataset.n); } });
  render();
  if (par) par = String(par).padStart(5, '0'); // ссылки вида -p163 и -p00163 ведут к одному абзацу
  if (par) { const el = document.getElementById('p' + par); if (el) { el.scrollIntoView({block: 'center'}); el.style.background = 'color-mix(in srgb, var(--acc) 12%, transparent)'; } }
  if (wantMap && innerWidth > 960) toggleMap(true);
  document.getElementById('onlySib').addEventListener('click', (e) => { only = !only; e.target.classList.toggle('on', only); render(); });
  let tmr; document.getElementById('tq').addEventListener('input', (e) => { clearTimeout(tmr); tmr = setTimeout(() => { q = e.target.value.trim(); render(); }, 250); });
  document.getElementById('tg').addEventListener('change', (e) => { hg = e.target.value; render(); });
}

// ---------------- связи (assets/links.js) ----------------
async function links() {
  if (!window.Links) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'assets/links.js?v=70'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  await window.Links.render(V, {get, esc, toH, fmt, PER, NAT, EN, CATC});
}
function loadScript(src) { return new Promise((res, rej) => { if (window.ForceGraph3D) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }

// ---------------- аналитика ----------------
async function analytics() {
  const [A, works, reuse, VF] = await Promise.all([get('analytics.json'), get('works.json'), get('reuse.json'), getV()]);
  const W = Object.fromEntries(works.map((w) => [w.id, w]));
  const SA = !!(VF.sample_annotation && VF.sample_annotation.verified);  // оценки и отношения — только после проверки разметки
  const ex = (dim) => A.expert.filter((r) => r.dimension === dim);
  const FR = {ethno: 'этнографическое описание', contact: 'повседневный контакт', econ: 'хозяйство и торговля', decline: 'упадок, вымирание, болезни', civ: 'иерархия «цивилизованности»', relig: 'религия', conflict: 'конфликт', admin: 'власть и управление', other: 'прочее'};
  const TERM = {personal: 'личное наблюдение', brit: 'британский автор', transit: 'транзит, плавание, война', 'C(per3)[T.b_1881_1904]': '1881–1904 (относительно 1800–1880)', 'C(per3)[T.c_после1904]': 'после 1904 (относительно 1800–1880)'};
  // при нуле случаев бутстреп даёт вырожденный интервал 0–0: показываем «нет случаев», а не ложную точность
  const ci2 = (r, a) => r[a] === 0 && r[a + '_hi'] === 0 ? `0%<br><span class="mute small" style="white-space:nowrap">нет случаев</span>` : `${fmt(100 * r[a], 1)}%<br><span class="mute small" style="white-space:nowrap">${fmt(100 * r[a + '_lo'], 0)}–${fmt(100 * r[a + '_hi'], 0)}</span>`;
  const ci = (r, a) => r[a] === 0 && r[a + '_hi'] === 0 ? `0% <span class="mute small">(нет случаев)</span>` : `${fmt(100 * r[a], 1)}% <span class="mute small">(${fmt(100 * r[a + '_lo'], 1)}–${fmt(100 * r[a + '_hi'], 1)})</span>`;
  V.innerHTML = `<section class="band"><div class="wrap">
    <h1>Аналитика</h1>
    <div class="ctl scroll">${SA ? '<a class="btn" href="#analytics-eval">Оценки</a>' : ''}<a class="btn" href="#analytics-ngram">Ngram</a><a class="btn" href="#analytics-disc">Дискурсы</a>${SA ? '<a class="btn" href="#analytics-rel">Отношения</a>' : ''}<a class="btn" href="#analytics-topics">Темы</a><a class="btn" href="#analytics-reuse">Совпадения</a></div>
    ${SA ? `<h2 id="analytics-eval">Факторы, связанные с оценкой народа</h2>
    <p>В расчёты вошли ${ex('all')[0].n} описаний коренных народов из ${pl(ex('all')[0].works, ['книги', 'книг', 'книг'])} (из 250 описаний выборки 20 при разметке признаны не относящимися к народам Сибири). Выборка стратифицирована по стране автора и периоду, доли взвешены, доверительные интервалы получены бутстрепом по книгам. Разметка выполнена по протоколу проекта и проверена экспертами.</p>
    <div class="cols">
      <div><h3>Рамка описания</h3><table class="stack"><thead><tr><th>Рамка</th><th class="n">n</th><th class="n">Отрицательные</th><th class="n">Положительные</th></tr></thead><tbody>${ex('frame').sort((a, b) => b.n - a.n).map((r) => `<tr><td>${FR[r.key] || esc(r.key)}</td><td class="n">${r.n}</td><td class="n">${ci(r, 'neg')}</td><td class="n">${ci(r, 'pos')}</td></tr>`).join('')}</tbody></table></div>
      <div><h3>Модель (отношение шансов)</h3><table class="stack"><thead><tr><th>Исход</th><th>Фактор</th><th class="n">ОШ</th><th class="n">95% ДИ</th></tr></thead><tbody>${A.models.filter((m) => m.term !== 'Intercept').map((m) => `<tr><td>${m.model.startsWith('neg') ? 'отрицательная' : 'положительная'}</td><td>${TERM[m.term] || esc(m.term)}</td><td class="n"><b>${fmt(m.OR, 2)}</b></td><td class="n">${fmt(m.lo, 2)}–${fmt(m.hi, 2)}</td></tr>`).join('')}</tbody></table><p class="small mute">ОШ больше 1 означает, что фактор связан с более высокой вероятностью исхода. Если интервал не включает 1, связь статистически значима для данной выборки (n = 230), но не доказывает причинной зависимости.</p></div>
    </div>
    <div class="cols" style="margin-top:18px">${['observer', 'period', 'stay'].map((dim) => `<div><h3>${{observer: 'Страна автора', period: 'Период поездки', stay: 'Тип поездки'}[dim]}</h3><table class="stack"><thead><tr><th></th><th class="n">n</th><th class="n">Отриц.</th><th class="n">Полож.</th></tr></thead><tbody>${ex(dim).map((r) => `<tr><td>${esc(r.key)}</td><td class="n">${r.n}</td><td class="n">${ci2(r, 'neg')}</td><td class="n">${ci2(r, 'pos')}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div>` : ''}

    <h2 id="analytics-ngram" style="margin-top:36px">Ngram: частоты слов по годам</h2>
    <p>Частота на миллион слов в англоязычных абзацах о Сибири по году издания; кривые сглажены скользящим окном. Можно ввести слово или сочетание длиной до трёх слов: этнонимы, слова-маркеры или сочетания с этнонимами.</p>
    <div class="ctl"><input type="text" id="ngq" list="ngl" value="convicts, settlers, savages" aria-label="Слова через запятую" style="min-width:min(100%,420px)"><datalist id="ngl"></datalist><label>сглаживание <select id="ngs"><option value="0">нет</option><option value="5" selected>±5 лет</option><option value="10">±10 лет</option></select></label></div>
    <div class="chart" id="ngc"></div>

    <h2 id="analytics-disc" style="margin-top:36px">Дискурсы по периодам</h2>
    <p>Доля абзацев о коренных народах, в которых встречаются слова-маркеры дискурса (поиск по правилам для 9 языков; маркеры указывают на тему, а не на позицию автора). Вертикальные отрезки — 95%-е интервалы, рассчитанные по книгам.</p>
    <div class="chart" id="dc"></div>
    <details><summary>Примеры абзацев</summary>${A.discourse_examples.slice(0, 60).map((e) => `<div class="quote">${esc(e.quote)}<div class="m">${esc(e.discourse_ru)} · ${esc(e.work)} · <a href="#book-${toH(e.pid.split('_p')[0])}-p${esc(e.pid.split('_p')[1])}">абзац</a></div></div>`).join('')}</details>

    ${SA ? `<h2 id="analytics-rel" style="margin-top:36px">Отношения: разметка выборки</h2>
    <p>84 предложения из 100 фрагментов выборки (в остальных 16 отношения не выражены), в которых коренная группа названа вместе с русскими, казаками, переселенцами или ссыльными и охарактеризованы отношения между ними. Выборка невелика, поэтому цифры лишь намечают вопросы для дальнейшей проверки.</p>
    <div class="scroll" id="relT"></div>` : ''}

    <h2 id="analytics-topics" style="margin-top:36px">Темы абзацев о коренных народах</h2>
    <p>Тематическая модель (NMF, 18 тем) по английским абзацам. Насыщенность цвета клетки соответствует доле темы в данном периоде.</p>
    <div class="scroll" id="topT"></div>

    <h2 id="analytics-reuse" style="margin-top:36px">Текстовые совпадения между книгами</h2>
    <p>Пары абзацев из разных книг с четырьмя и более общими 8-словными фрагментами (англоязычные тексты). Тип указывает, назван ли в абзаце автор более ранней книги и взят ли отрывок в кавычки; объясняется ли совпадение прямой цитатой, общим источником или пересказом, устанавливается чтением обоих отрывков.</p>
    <div class="scroll"><table class="stack"><thead><tr><th>Более поздняя книга</th><th>Источник</th><th>Тип</th><th class="n">Общих 8-грамм</th><th>Фрагмент</th></tr></thead><tbody>${reuse.slice(0, 80).map((r) => `<tr><td><a href="#book-${toH(r.b)}-p${esc(r.bp.split('_p')[1])}">${esc(W[r.b] ? W[r.b].label : r.b)}</a></td><td><a href="#book-${toH(r.s)}-p${esc(r.sp.split('_p')[1])}">${esc(W[r.s] ? W[r.s].label : r.s)}</a></td><td>${esc(r.kind)}</td><td class="n">${r.n}</td><td class="small">${esc(r.bt)}…</td></tr>`).join('')}</tbody></table></div>
  </div></section>`;
  discChart(document.getElementById('dc'), A.discourse.filter((d) => d.dimension === 'period' && d.discourse !== 'civilizing_colonization'));
  // отношения
  const rel = A.relations_manual; const types = [...new Set(rel.map((r) => r.type_ru))];
  const v = (t, p) => (rel.find((r) => r.type_ru === t && r.per === p) || {share: 0}).share;
  types.sort((a, b) => (v(b, 'после 1880') + v(b, 'до 1880')) - (v(a, 'после 1880') + v(a, 'до 1880')));
  if (document.getElementById('relT')) document.getElementById('relT').innerHTML = `<table><thead><tr><th>Тип отношения</th><th class="n">до 1880</th><th class="n">после 1880</th></tr></thead><tbody>${types.map((t) => `<tr><td>${esc(t)}</td><td class="n">${fmt(100 * v(t, 'до 1880'), 1)}%</td><td class="n">${fmt(100 * v(t, 'после 1880'), 1)}%</td></tr>`).join('')}</tbody></table>`;
  // темы
  const TP = A.topics; const pk = [...new Set(TP.shares.filter((s) => s.dimension === 'period').map((s) => s.key))];
  const ord = ['до 1855', '1856–1880', '1881–1904', '1905–1917', '1918–1930']; pk.sort((a, b) => ord.findIndex((o) => a.startsWith(o)) - ord.findIndex((o) => b.startsWith(o)));
  const sh = (k, t) => (TP.shares.find((s) => s.dimension === 'period' && s.key === k && s.topic === t) || {share: 0}).share;
  document.getElementById('topT').innerHTML = `<table><thead><tr><th>Тема</th><th>Ключевые слова</th>${pk.map((k) => `<th class="n">${esc(k.split(' (')[0])}</th>`).join('')}</tr></thead><tbody>${TP.labels.map((l, t) => `<tr><td><b>${esc(l)}</b></td><td class="small mute">${esc(TP.words[t].slice(0, 8).join(', '))}</td>${pk.map((k) => { const s = sh(k, t); return `<td class="n" style="background:color-mix(in srgb,var(--acc2) ${Math.min(80, s * 400).toFixed(0)}%,transparent)">${fmt(100 * s, 1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  // ngram
  const NG = await get('ngram_en.json');
  document.getElementById('ngl').innerHTML = Object.keys(NG.ngrams).slice(0, 2500).map((k) => `<option value="${esc(k)}">`).join('');
  let ngro = null;
  const ngDraw = () => { const q = document.getElementById('ngq'); if (!q) { ngro?.disconnect(); return; } ngramChart(document.getElementById('ngc'), NG, q.value, +document.getElementById('ngs').value); };
  ngDraw(); document.getElementById('ngq').addEventListener('change', ngDraw); document.getElementById('ngs').addEventListener('change', ngDraw);
  ngro = new ResizeObserver(() => ngDraw()); ngro.observe(document.getElementById('ngc'));
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
    ${series.filter((s) => !s.found).length ? `<p class="small mute">Нет в словаре n-грамм: ${series.filter((s) => !s.found).map((s) => esc(s.wd)).join(', ')} (в словарь включены n-граммы с частотой не менее 30).</p>` : ''}`;
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
  const ST = (p) => p.status === 'in_press' ? 'accepted' : p.status || 'published';
  const pub = rest.filter((p) => ST(p) === 'published'), acc = rest.filter((p) => ST(p) === 'accepted'), rev = rest.filter((p) => ST(p) === 'submitted');
  const dmy = (d) => { const m = String(d || '').match(/^(\d{4})-(\d\d)-(\d\d)$/); return m ? (EN ? new Date(d + 'T12:00').toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}) : `${m[3]}.${m[2]}.${m[1]}`) : esc(d || ''); };
  const note = (p) => { if (ST(p) !== 'accepted' || !(p.accepted || p.issue)) return ''; const a = [p.accepted && (EN ? 'acceptance letter dated ' + dmy(p.accepted) : 'справка о принятии от ' + dmy(p.accepted)), p.issue && (EN ? 'to appear in ' + esc(p.issue).replace(/№\s*/g, 'no. ') : 'выйдет в ' + esc(p.issue))].filter(Boolean); return ` <span class="pst">${a.join('; ')}</span>`; };
  const link = (t) => esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;)])/g, '<a href="$1">$1</a>');
  const item = (p) => `<li>${p.cite ? `<span class="ref">${link(p.cite)}</span>` : `<span class="ref"><b>${esc(p.authors)}</b> ${esc(p.title)}${EN && p.title_en ? ` <span lang="en">[${esc(p.title_en).replace(/\*([^*]+)\*/g, '<i>$1</i>')}]</span>` : ''} // ${esc(p.venue)}. ${esc(p.year || '')}${p.pages ? '. ' + esc(p.pages) : ''}${p.doi ? `. <a href="https://doi.org/${esc(p.doi)}">https://doi.org/${esc(p.doi)}</a>` : ''}${EN && p.title_en ? ' <span lang="en">(In Russian)</span>' : ''}</span>`}${p.url ? ` <a href="${esc(p.url)}">${EN ? 'full text' : 'текст'}</a>` : ''}${p.pdf ? ` <a href="${esc(p.pdf)}">PDF</a>` : ''}${p.abstract ? `<p class="small">${esc(p.abstract)}</p>` : ''}${(p.groups || []).length || (p.works || []).length ? `<p class="small">${(p.groups || []).map((g) => `<a href="#people-${toH(g)}">${esc(g)}</a>`).concat((p.works || []).map((w) => `<a href="#book-${toH(w)}">${esc(w)}</a>`)).join(', ')}</p>` : ''}${p.note ? `<p class="small mute">${esc(p.note)}</p>` : ''}${note(p)}</li>`;
  const sec = (h, L) => L.length ? `<h2>${h}</h2><ol class="refs" data-noi18n lang="ru">${L.map(item).join('')}</ol>` : '';
  V.innerHTML = `<section class="band"><div class="wrap"><h1>Публикации проекта</h1>
    ${P.length ? sec('Опубликовано', pub) + sec('Принято к печати', acc) + sec('На рецензировании', rev) + sec('Наборы данных', ds) :
    `<div class="empty"><p>Список публикаций готовится.</p></div>`}
  </div></section>`;
}

// ---------------- границы и категории ----------------
async function scope() {
  const [G, W] = await Promise.all([get('groups.json'), get('works.json')]);
  const g = (id) => G.find((x) => x.id === id);
  const nat = (n) => W.filter((w) => w.nat_ru === n).length;
  const T = (t, d) => `<dt>${t}</dt><dd>${d}</dd>`;
  V.innerHTML = `<section class="band"><div class="wrap scope">
    <h1>Границы и категории</h1>
    <p class="lede">На этой странице изложены принятые в проекте решения: какие территории отнесены к Сибири, кто считается европейским автором и как передаются названия народов. От этих решений зависят все частотные показатели ресурса.</p>

    <h2>Что считается Сибирью</h2>
    <p>Абзац относится к Сибири, если в нём названо место из справочника проекта, расположенное в одном из следующих регионов: Западная и Восточная Сибирь, арктическое побережье, Якутия и Северо-Восток, Приамурье, Приморье и Сахалин, Камчатка и Чукотка, а также Степной край (Акмолинская и Семипалатинская области). Абзац без названий мест относится к тому же региону, что и предыдущий абзац той же главы.</p>
    <p>Степной край включён в соответствии с административным делением XIX века: до 1882 года эти области входили в Западно-Сибирское генерал-губернаторство, затем — в Степное, с центром в Омске. Это граница имперской администрации, а не этнографическая или природная. На абзацы о Степном крае приходится около 2% всех «сибирских» упоминаний народов, но 14% упоминаний казахов; поэтому от этой границы существенно зависят данные о казахах и почти не зависят данные о других народах.</p>
    <p>К Сибири не отнесены Урал и Европейская Россия, Туркестан и Семиречье, Монголия, Маньчжурия и остальной Китай. Урянхайский край (Тува) до 1914 года был владением Цинской империи, и в справочнике проекта его пункты отсутствуют. Поэтому упоминания тувинцев учитываются как «сибирские», когда описание Урянхая входит в главу о Минусинске или Саянах (${fmt(g('tuvan')?.mentions || 0)} упоминаний); эти цифры следует читать как приблизительные.</p>

    <h2>Кто считается европейским автором</h2>
    <p>В корпус вошли книги европейских авторов, не принадлежавших к русской культуре, основанные на собственной поездке автора или его жизни в Сибири. Сюда отнесены и подданные империи с нерусской идентичностью: польские ссыльные (${nat('Польша')} книг) и финские учёные из Великого княжества Финляндского (${nat('Финляндия')}). В фильтре «Страна автора» учитывается культурная и языковая принадлежность автора, а не подданство: в 1800–1918 годах они могли не совпадать. Русские травелоги — предмет отдельного корпуса; голосов самих сибирских народов в корпусе нет, и это главное ограничение любых выводов о «восприятии».</p>
    <p>Корпус неоднороден: ${nat('Великобритания')} книг из ${W.length} — британские. Поэтому Ngram, темы и поиск заимствований, которые рассчитаны только по англоязычным текстам, отражают прежде всего британскую точку зрения. Две книги требуют осторожности: «Сибирь» Кубальского (1856) — компиляция без собственной поездки автора, а достоверность ряда эпизодов книги Оссендовского «Звери, люди и боги» (1922) давно оспаривается.</p>

    <h2>Названия народов</h2>
    <p>Этнонимы приводятся в написании источников («Ostiak», «Tartar», «Kirghiz») и соотнесены с современными названиями народов. Соответствие исторических имён современным не всегда однозначно; спорные отождествления отмечены особо. Рубрики на странице «Народы» («коренные народы Сибири и Степного края», «обобщённые названия коренного населения», «русские и другие переселенцы», «социально-правовые группы», «соседние народы», «иностранцы») носят рабочий характер: они воспроизводят взгляд из имперского центра, который сам является предметом исследования, и будут пересмотрены. Узел «туземцы, инородцы (обобщённо)» в сети связей соединён со всеми коренными группами, поскольку путешественники применяли эти слова к любым из них.</p>

    <h2>Глоссарий исторических терминов</h2>
    <dl class="gloss">
      ${T('Инородцы', 'Правовой статус, а не этническое понятие: введён «Уставом об управлении инородцев» 1822 года (реформа М. М. Сперанского). Устав делил коренное население Сибири на оседлых, кочевых и бродячих, с разными податями и самоуправлением. В английской версии ресурса термин передаётся транслитерацией inorodtsy, а не словом aliens.')}
      ${T('Туземцы, natives, indigènes', 'Обобщающее название коренного населения у путешественников. Подразумевает «нецивилизованность» обозначаемых и в источниках часто противопоставляется «русским» и «европейцам».')}
      ${T('Ясак', 'Натуральная подать пушниной, которую платили коренные народы Сибири; основа отношений «ясачных» людей с государством.')}
      ${T('Киргизы, киргиз-кайсаки, Kirghiz', 'В русском и европейском употреблении XIX века — казахи. Киргизов Тянь-Шаня и Памира называли «кара-киргизами» или «дикокаменными киргизами»; в ресурсе они выделены в отдельную группу (' + fmt(135) + ' упоминаний, почти все вне Сибири).')}
      ${T('Остяки', 'Общее имя для ханты, а также селькупов («остяко-самоеды») и кетов («енисейские остяки»). Конкретный народ определяется по контексту и месту действия.')}
      ${T('Самоеды', 'Ненцы, энцы, нганасаны и селькупы вместе; если по тексту народ определить нельзя, упоминание отнесено к самодийским народам в целом.')}
      ${T('Тунгусы, ламуты', 'Эвенки и эвены. «Ламутами» обычно называли эвенов Охотского побережья и Камчатки.')}
      ${T('Калмыки (алтайские), «белые калмыки»', 'Алтайцы и телеуты; не путать с калмыками Поволжья.')}
      ${T('Сойоты, урянхайцы', 'Тувинцы (на Саянах так называли и тофаларов).')}
      ${T('Гиляки, гольды', 'Нивхи и нанайцы Амура и Сахалина.')}
      ${T('Камчадалы', 'Ительмены и смешанное с ними русское население Камчатки.')}
      ${T('Старожилы, переселенцы', 'Русское крестьянство Сибири, осевшее до XIX века, и крестьяне-переселенцы пореформенной эпохи, особенно после 1905 года.')}
      ${T('Ссыльные, каторжные', 'Сосланные на поселение и осуждённые на каторжные работы; в травелогах — одна из главных тем, особенно после книг Дж. Кеннана.')}
    </dl>

    <h2>Периодизация</h2>
    <p>Периоды поездок (до 1855, 1856–1880, 1881–1904, 1905–1917, 1918–1930) соотнесены с событиями, которые меняли условия путешествия и то, что мог увидеть путешественник: присоединение Приамурья и реформы, споры о ссылке и Транссибирская магистраль, массовое переселение после 1905 года, война и плен. Такая периодизация служит рабочим инструментом и не предполагает смены «эпох восприятия».</p>

    <h2>Иллюстрации</h2>
    <p>Подпись к иллюстрации воспроизводит подпись источника; название народа в переводе — интерпретация проекта и может быть ошибочной. Деление на «портреты» и «людей» повторяет практику изданий: названные по имени (часто европейцы и чиновники) и безымянные «типы». Это деление сохранено как свидетельство взгляда источников и не является классификацией проекта. Фотографии каторжных и антропологические «типы» представлены как исторические документы; изображённые на них люди не могли повлиять на то, как их представят.</p>
  </div></section>`;
}

// ---------------- метод ----------------
async function method() {
  const [A, P, works, PC, VF, CL] = await Promise.all([get('analytics.json'), project(), get('works.json'), get('places_count.json').catch(() => ({attested: 0})), getV(), get('changelog.json').catch(() => [])]);
  const SA = !!(VF.sample_annotation && VF.sample_annotation.verified);
  const steps = [
    ['Формирование корпуса', 'экспертная работа и цифровой поиск', `Корпус формировался с опорой на библиографические справочники (прежде всего A. G. Cross, «In the Lands of the Romanovs»), национальные библиографии и каталоги, фонды электронных библиотек и репозиториев (Internet Archive, Project Gutenberg и др.) и исследовательскую литературу о травелогах. Каждое издание проверялось на соответствие критериям отбора: европейский автор, собственная поездка или пребывание в Сибири, 1800–1930 годы. Из 168 рассмотренных изданий отобрано ${works.length}; сверка с библиографией Cross показывает охват 76% её европейских позиций.`],
    ['Паспорт издания', 'экспертная работа', 'Для каждой книги установлены автор, его страна и род занятий, тип пребывания в Сибири, годы поездки (отдельно от года издания) и надёжность датировки. На этих сведениях основаны все сравнения по периодам и странам.'],
    ['Подготовка текстов', 'цифровая обработка с выборочным контролем', 'Распознанный текст очищен от колонтитулов, номеров страниц, переносов, подписей к иллюстрациям и служебных страниц и разделён на главы и абзацы. Каждый абзац получил постоянный номер, по которому на него можно сослаться.'],
    ['Названия народов и мест', 'экспертная работа и цифровая обработка', `Словарь этнонимов на 10 языках составлен и выверен по текстам: исторические и иноязычные формы (Ostiaken, Tongouses, Bratski) сведены к современным названиям народов, неоднозначные случаи разобраны по контексту. Для автоматического поиска упоминаний составлен справочник из 101 места с координатами; по нему и по словарю этнонимов упоминания выявлены во всех текстах. Вместе с остановками маршрутов газеттир проекта включает ${fmt(PC.attested)} мест: в него входят только места, названные хотя бы в одном абзаце корпуса (проверка повторяется автоматически при каждом обновлении данных).`],
    ['Маршруты', 'цифровая обработка с автоматической проверкой', 'Маршрут восстанавливается по тексту книги. Сначала автоматически отбираются места, о посещении которых пишет автор; затем языковая модель прочитывает книгу целиком и оставляет в маршруте лишь места, где автор действительно побывал, в порядке следования и с дословной цитатой. На карте показываются только остановки, для которых проверка нашла эту цитату в указанном абзаце и название места в ней.'],
    ['Иллюстрации', 'цифровая обработка с проверкой', 'Страницы с графикой отбираются в сканах Internet Archive автоматически: вклейки и пробелы в наборе определяются по разметке распознанного текста, графическая область — по изображению страницы. Альбомные вклейки поворачиваются так, чтобы подпись распознавалась наиболее надёжно. Подписью считаются строки под изображением; иллюстрация привязывается к абзацу библиотеки по совпадению текста соседних страниц. Для книг из Project Gutenberg изображения и набранные подписи берутся прямо из HTML-издания, а сканы целых вклеек делятся на отдельные снимки. Подписи переведены на русский язык. Народы и места указываются, только если они названы в подписи источника; регион определяется по местам из подписи, а если их нет — по соседнему абзацу.'],
    ...(SA ? [['Разметка выборки', 'экспертная разметка', 'Выборка стратифицирована по стране автора и периоду: 250 описаний коренных народов и 100 фрагментов об отношениях между группами. При разметке 20 описаний признаны не относящимися к народам Сибири (топоним, другой регион или ошибочно опознанная группа) и исключены из расчётов, поэтому оценки строятся по 230 описаниям из 61 книги; в 16 фрагментах отношения между группами не выражены, и анализ отношений опирается на остальные 84. Для каждого фрагмента определены оценка, рамка описания (иерархия «цивилизованности», хозяйство, контакт и т. д.), источник знания (личное наблюдение или пересказ) и тип отношения. Разметка выполнена по протоколу проекта и проверена экспертами; на ней построены все выводы об оценках и отношениях.']] : []),
    ['Корпусный анализ', 'цифровая обработка', 'Частоты по десятилетиям, коллокации, дискурсы, тематическое моделирование, сети совместных упоминаний и цитирования, поиск текстовых заимствований, статистические модели с учётом того, что фрагменты одной книги не независимы.'],
    ['Интерпретация', 'экспертная работа', 'Закономерности интерпретируются по исходным фрагментам: от частот, подборок цитат и маршрутов можно перейти к абзацам, на которых они основаны; для статистических показателей указаны выборка и способ расчёта.']];
  const VS = VF.summary || [];
  V.innerHTML = `<section class="band"><div class="wrap">
    <h1>Метод и данные</h1>
    <p class="lede">Ресурс сочетает экспертную филологическую работу с источниками и цифровую обработку корпуса. Отбор книг, их описание, словарь названий народов и интерпретацию результатов выполнили исследователи. Автоматические методы применялись там, где требовалась обработка всего корпуса (11 млн слов). Сведения, которые показывает сайт, автоматически сверяются с текстами книг; данные, не прошедшие проверку, не публикуются.</p>
    <p>Границы Сибири, критерии отнесения авторов к европейским и принципы передачи названий народов изложены на странице <a href="#scope">«Границы и категории»</a>; там же приведён глоссарий исторических терминов.</p>
    <h2 style="margin-top:40px">Этапы работы</h2>
    <ol class="steps">${steps.map(([t, k, d]) => `<li><h3>${esc(t)}</h3><p class="kind">${esc(k)}</p><p>${esc(d)}</p></li>`).join('')}</ol>
    <h2 style="margin-top:48px">Проверка данных</h2>
    <p>Сведения, которые показывает сайт, при каждом обновлении автоматически сверяются с текстами книг: названия мест и цитаты должны найтись в указанных абзацах, ссылки на предшественников — в тексте другого автора, народы и места на иллюстрациях — в подписи источника. Данные, не прошедшие проверку, на сайте не показываются.</p>
    ${VS.length ? `<div class="scroll"><table class="stack"><thead><tr><th>Данные</th><th class="n">Подтверждено текстом</th></tr></thead><tbody>${VS.map((r) => `<tr><td data-l="Данные">${esc(EN ? r.en : r.ru)}</td><td class="n" data-l="Подтверждено текстом">${fmt(r.ok)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <h2 style="margin-top:48px">Ограничения</h2>
    <ul class="lim"><li>В распознанных книгах без деления на главы отнесение отдельных абзацев к Сибири приблизительно: около пятой части таких абзацев относится к другим регионам.</li>
    <li>Корпус включает издания, доступные в электронных библиотеках и репозиториях; часть известных травелогов (например, M. A. Czaplicka, J. Noble, P. Labbé) пока не оцифрована в пригодном виде. Корпус будет пополняться.</li>
    <li>Ареалы народов показаны только по «Этнографической карте Азиатской России» (1914) — так, как их обозначили составители карты; для народов, не отмеченных на ней, ареал не показывается.</li></ul>
    <h2 style="margin-top:48px">Данные</h2>
    <p>Каталог изданий и атлас народов и мест опубликованы на Zenodo с DOI${(P.datasets || []).length ? ': ' + P.datasets.map((d) => `<a href="https://doi.org/${esc(d.doi)}">${esc(d.title)}</a> (${esc(d.license)})`).join('; ') : ''}. Данные сайта размещены в каталоге <code>data/</code>, тексты — в каталоге <code>texts/</code>, программный код — в <a href="${REPO}">репозитории на GitHub</a>.</p>
    <p>Места и маршруты выгружены в открытых форматах исторической географии: <a href="data/export/iter-sibiricum-places.lpf.jsonld" download>газеттир в Linked Places Format</a> (для World Historical Gazetteer: формы названий из книг со ссылками на абзацы, годы, точность координат, ссылки на GeoNames и Wikidata) и <a href="data/export/iter-sibiricum-routes.geojson" download>маршруты в GeoJSON</a> (по поездкам, со статусом проверки). Выгрузки входят в атлас и распространяются, как и он, по лицензии CC BY-NC 4.0.</p>
    ${CL.length ? `<h2 style="margin-top:48px">Развитие ресурса</h2>
    <p>Iter Sibiricum — развивающийся ресурс: корпус пополняется, методы обработки и проверки данных совершенствуются, и каждое изменение фиксируется в истории репозитория.</p>
    <ul class="changelog">${CL.map((c) => `<li><span class="mute small">${esc(c.date)}</span> ${esc(EN ? c.en : c.ru)}</li>`).join('')}</ul>` : ''}
    <div class="cite">${esc(citation(P))}</div>
  </div></section>`;
}
route();
}
