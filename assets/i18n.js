/* Iter Sibiricum — английская версия интерфейса.
   Язык выбирается переключателем RU / EN (запоминается в браузере) или параметром ?lang=en.
   Перевод накладывается на отрисованную страницу: каждый текстовый узел и атрибуты title / placeholder /
   aria-label / alt ищутся в словаре assets/i18n-en.js. Ключи словаря — русские строки; числа в ключе
   заменены на «#», в переводе «#» подставляются по порядку, «{s}» — окончание множественного числа.
   Если строка целиком не найдена, она делится по разделителям (« · », «, », « → » …) и переводится по частям.
   Тексты книг (#txt) не переводятся: это оригиналы источников. */
window.I18N = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  let lang = q || (() => { try { return localStorage.getItem('lang'); } catch (e) { return null; } })() || 'ru';
  if (q) { try { localStorage.setItem('lang', q); } catch (e) { /* хранилище недоступно */ } }
  if (lang !== 'en') lang = 'ru';
  document.documentElement.lang = lang;
  const CYR = /[А-Яа-яЁё]/, NUM = /\d+(?:[   ,.]\d+)*/g;
  const miss = new Set();
  let D = null, T = null;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const prep = () => {
    if (D) return; D = window.I18N_EN || {}; T = {};
    for (const [k, v] of Object.entries(D)) if (k.includes('#')) T[k] = v;
  };
  // «0,75» → «0.75»: десятичная запятая в литералах русского текста (числа из fmt уже в английском формате)
  const dec = (n) => (n && /^0,\d+$/.test(n) ? n.replace(',', '.') : n);
  const fill = (v, nums) => { let i = 0; return v.replace(/#|\{s\}/g, (m) => { if (m === '#') return dec(nums[i++]) ?? ''; const n = nums[i - 1]; return n && n.replace(/\D/g, '') === '1' ? '' : 's'; }); };
  const SPLIT = /( · | → | — | – |, |; |: | \/ | \| |\(|\)|«|»)/;
  function one(k) {
    if (D[k] !== undefined) return D[k];
    const nums = k.match(NUM);
    if (nums) { const tk = k.replace(NUM, '#'); if (T[tk] !== undefined) return fill(T[tk], nums); }
    return null;
  }
  const EDGE = /^([\s·•→—–:;,.(«»"]*)(.*?)([\s·•→—–:;,.)«»"]*)$/s;
  function tr(s) {
    const k0 = norm(s); if (!k0 || !CYR.test(k0)) return null;
    let r = one(k0); if (r !== null) return r;
    // знаки по краям (« · …», «…:») переносятся как есть
    const e = k0.match(EDGE); const k = e ? e[2] : k0;
    if (e && k !== k0) { r = one(k); if (r !== null) return e[1] + r + e[3]; }
    // по частям
    const parts = k.split(SPLIT); let ok = true;
    const core = (x) => { let t = one(x); if (t !== null) return t; const m = x.match(EDGE); if (m && m[2] !== x) { t = one(m[2]); if (t !== null) return m[1] + t + m[3]; } return null; };
    const out = parts.map((p) => { if (!p || !CYR.test(p)) return p; const t = core(p.trim()); if (t === null) { ok = false; miss.add(p.trim()); return p; } return p.replace(p.trim(), t); });
    if (ok && parts.length > 1) return (e && k !== k0 ? e[1] : '') + out.join('') + (e && k !== k0 ? e[3] : '');
    miss.add(k); return null;
  }
  const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
  function walk(root) {
    if (lang !== 'en' || !root) return; prep();
    if (root.nodeType === 3) { node(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName) || root.closest?.('#txt, [data-noi18n]')) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => n.nodeType === 1 ? (SKIP.has(n.nodeName) || n.id === 'txt' || n.hasAttribute('data-noi18n') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT});
    root.querySelectorAll?.('[title],[placeholder],[aria-label],[alt]').forEach((el) => { if (!el.closest('#txt, [data-noi18n]')) attrs(el); });
    let n; const L = []; while ((n = w.nextNode())) L.push(n); L.forEach(node);
  }
  function node(t) {
    const v = t.nodeValue; if (!v || !CYR.test(v)) return;
    const r = tr(v); if (r === null) return;
    const lead = v.match(/^\s*/)[0], tail = v.match(/\s*$/)[0];
    t.nodeValue = lead + quo(r) + tail;
  }
  // русские кавычки-ёлочки в английском тексте → “ ” (ключи словаря хранятся без краевых знаков, поэтому возможное удвоение схлопывается)
  const quo = (s) => s.replace(/«/g, '“').replace(/»/g, '”').replace(/““/g, '“').replace(/””/g, '”');
  function attrs(el) { for (const a of ATTR) { const v = el.getAttribute?.(a); if (v && CYR.test(v)) { const r = tr(v); if (r !== null) el.setAttribute(a, quo(r)); } } }
  function start() {
    if (lang !== 'en') return;
    walk(document.body); if (document.title && CYR.test(document.title)) { const r = tr(document.title); if (r) document.title = r; }
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'characterData') { if (!m.target.parentElement?.closest('#txt, [data-noi18n]')) node(m.target); continue; }
        if (m.type === 'attributes') { attrs(m.target); continue; }
        m.addedNodes.forEach((x) => walk(x));
      }
    }).observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR});
  }
  // переключатель языка в шапке
  function toggle() {
    const nav = document.getElementById('menu'); if (!nav || document.getElementById('langSw')) return;
    const a = document.createElement('a'); a.id = 'langSw'; a.href = '#'; a.className = 'lang-sw'; a.setAttribute('data-noi18n', '');
    a.textContent = lang === 'en' ? 'RU' : 'EN'; a.lang = lang === 'en' ? 'ru' : 'en';
    a.title = lang === 'en' ? 'Русская версия' : 'English version';
    a.addEventListener('click', (e) => { e.preventDefault(); try { localStorage.setItem('lang', lang === 'en' ? 'ru' : 'en'); } catch (er) { /* */ }
      const u = new URL(location.href); u.searchParams.delete('lang'); if (lang !== 'en') u.searchParams.set('lang', 'en'); location.replace(u.toString()); });
    nav.appendChild(a);
  }
  document.addEventListener('DOMContentLoaded', () => { toggle(); start(); });
  return {lang, tr, walk, miss, en: lang === 'en', locale: lang === 'en' ? 'en-GB' : 'ru-RU'};
})();
if (window.I18N.en) document.write('<script src="assets/i18n-en.js?v=46"><\/script>');
