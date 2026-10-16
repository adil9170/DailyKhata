const ICONS = {
  home: 'M3 10.5 12 3l9 7.5 M5 9v11h5v-6h4v6h5V9',
  chart: 'M3 3v18h18 M7 16v-5 M12 16V7 M17 16v-8',
  pen: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  box: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.3 7 12 12l8.7-5 M12 22V12',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  wallet: 'M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v3a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2',
  building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z M6 12H4a2 2 0 0 0-2 2v8 M18 9h2a2 2 0 0 1 2 2v11 M10 6h4 M10 10h4 M10 14h4 M10 18h4',
  layers: 'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  database: 'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z M21 12c0 1.66-4 3-9 3s-9-1.34-9-3 M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5',
  plus: 'M12 5v14 M5 12h14',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  x: 'M18 6 6 18 M6 6l12 12',
  left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  monitor: 'M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z M8 21h8 M12 17v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  edit: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0',
  receipt: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8 M12 18V6',
  rupee: 'M6 3h12 M6 8h12 M6 13l8.5 8 M6 13h3 M9 13c6.667 0 6.667-10 0-10',
  type: 'M4 7V4h16v3 M9 20h6 M12 4v16',
  check: 'M20 6 9 17l-5-5',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z M7 11V7a5 5 0 0 1 10 0v4',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 16v-4 M12 8h.01',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  print: 'M6 9V2h12v7 M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2 M6 14h12v8H6z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
};
const SVGNS = 'http://www.w3.org/2000/svg';
/** Inline SVG icon (stroke style). */
export function icon(name, size) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'ico'); svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
  const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', ICONS[name] || ICONS.info); svg.append(p);
  return svg;
}

/** Give every cell its column label so tables can reflow into cards on phones. */
export function labelTable(t) {
  const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
  if (!heads.length) return;
  t.classList.add('stack');
  for (const tr of t.querySelectorAll('tbody tr, tfoot tr')) {
    let i = 0;
    for (const td of tr.children) { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] ?? ''); i += Number(td.getAttribute('colspan') || 1); }
  }
}
export function autoLabelTables(root) {
  const run = () => root.querySelectorAll('table').forEach(labelTable);
  run();
  const obs = new MutationObserver(() => { obs.disconnect(); run(); obs.observe(root, { childList: true, subtree: true }); });
  obs.observe(root, { childList: true, subtree: true });
  return obs;
}

// Small DOM toolkit. All user data goes through textContent (never innerHTML) to prevent XSS.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
export function mount(el, ...children) { clear(el); append(el, children); return el; }

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
/** paise → "₹1,020" */
export function money(paise, { sign = false } = {}) {
  if (paise === null || paise === undefined) return '—';
  const r = paise / 100;
  const s = '₹' + inr.format(Math.abs(r));
  if (r < 0) return '−' + s;
  return sign && r > 0 ? '+' + s : s;
}
export const rupees = (paise) => (paise === null || paise === undefined ? '' : String(Math.round(paise) / 100));
export const num = (n) => (n === null || n === undefined ? '—' : inr.format(n));
export const cls = (n) => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');

export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', opts);
}
export function fmtDateTime(s) {
  if (!s) return '';
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function bytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export function toast(msg, err = false) {
  const t = h('div', { class: 'toast' + (err ? ' err' : ''), role: err ? 'alert' : 'status' }, icon(err ? 'alert' : 'check', 18), msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3000);
}

export function modal(title, body, { wide = false } = {}) {
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grab' }),
    h('div', { class: 'spread', style: { marginBottom: '14px' } }, h('h2', { style: { margin: 0, fontSize: '1.15rem' } }, title), h('button', { class: 'ghost icon', 'aria-label': 'Close', onclick: () => close() }, icon('x'))),
    body);
  autoLabelTables(box);
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, box);
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  const first = box.querySelector('input:not([type=file]),select,textarea'); if (first && matchMedia('(min-width: 641px)').matches) first.focus();
  return { close, box };
}

export function confirmDialog(message, { danger = true, okText = 'Delete' } = {}) {
  return new Promise((resolve) => {
    const m = modal('Please confirm', h('div', null,
      h('p', null, message),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
        h('button', { onclick: () => { m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: danger ? 'danger solid' : 'primary', onclick: () => { m.close(); resolve(true); } }, okText))));
  });
}

export function field(labelText, input, hint) {
  return h('div', { class: 'field' }, h('label', null, labelText, input), hint ? h('div', { class: 'small muted' }, hint) : null);
}
export function input(attrs) { return h('input', attrs); }
export function select(options, value, attrs = {}) {
  return h('select', attrs, options.map((o) => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: String(v) === String(value) ? 'selected' : null }, l);
  }));
}
export function formData(form) {
  const out = {};
  for (const el of form.querySelectorAll('[name]')) {
    if (el.type === 'checkbox') { if (el.dataset.group) { (out[el.dataset.group] ??= []); if (el.checked) out[el.dataset.group].push(el.value); } else out[el.name] = el.checked; }
    else if (el.type !== 'file') out[el.name] = el.value;
  }
  return out;
}
export function badge(text, kind = '') { return h('span', { class: 'badge ' + kind }, text); }
export function tile(k, v, s, extra = '') { return h('div', { class: 'tile ' + extra }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), s ? h('div', { class: 's' }, s) : null); }
export function table(head, rows, { foot = null, empty = 'Nothing here yet' } = {}) {
  return h('div', { class: 'tablewrap' }, h('table', null,
    h('thead', null, h('tr', null, head.map((c) => (typeof c === 'string' ? h('th', null, c) : c)))),
    h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: head.length, class: 'empty' }, empty))),
    foot ? h('tfoot', null, foot) : null));
}

/** Busy-state wrapper for async button handlers. */
export function busy(btn, fn) {
  return async (...args) => {
    if (btn.disabled) return;
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Please wait…';
    try { await fn(...args); } catch (e) { toast(e.message || String(e), true); } finally { btn.disabled = false; btn.textContent = label; }
  };
}

/** Downscale large photos in the browser before upload (faster on mobile data, fits OCR limits). */
export async function compressImage(file, maxDim = 2000, quality = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (file.size < 1.2 * 1024 * 1024) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/** Action sheet: a list of large tappable choices. items: [{icon, title, desc, onclick}] */
export function actionSheet(title, items) {
  const m = modal(title, h('div', { class: 'actions' }, items.map((it) => h('button', { class: 'action', onclick: () => { m.close(); it.onclick(); } },
    h('span', { class: 'dot' }, icon(it.icon)), h('span', null, h('span', { class: 't' }, it.title), it.desc ? h('span', { class: 'd' }, it.desc) : null)))));
  return m;
}
export function pageHead(title, sub, ...actions) {
  return h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('div', { class: 'sub' }, sub) : null), actions.length ? h('div', { class: 'row' }, actions) : null);
}
export function iconBtn(name, label, onclick, cls = 'ghost') {
  return h('button', { class: `${cls} icon small`, 'aria-label': label, title: label, onclick }, icon(name, 18));
}
