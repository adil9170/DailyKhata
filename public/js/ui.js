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
  const t = h('div', { class: 'toast' + (err ? ' err' : ''), role: err ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3000);
}

export function modal(title, body, { wide = false } = {}) {
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'spread', style: { marginBottom: '12px' } }, h('h2', { style: { margin: 0 } }, title), h('button', { class: 'ghost', 'aria-label': 'Close', onclick: () => close() }, '✕')),
    body);
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, box);
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  const first = box.querySelector('input,select,textarea'); if (first) first.focus();
  return { close, box };
}

export function confirmDialog(message, { danger = true, okText = 'Delete' } = {}) {
  return new Promise((resolve) => {
    const m = modal('Please confirm', h('div', null,
      h('p', null, message),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
        h('button', { onclick: () => { m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: danger ? 'primary danger' : 'primary', style: danger ? { background: 'var(--bad)', borderColor: 'var(--bad)' } : null, onclick: () => { m.close(); resolve(true); } }, okText))));
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
