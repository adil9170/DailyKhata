// Bento landing (/bento/): the same real text reader as the app (src/lib/dump.ts) behind a page of tiles.
import { readDump } from '../../src/lib/dump.ts';
import { SITE } from './site-config.js';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rs = (n) => '₹' + inr.format(n);
const sgn = (v) => (v < 0 ? '−' : '+') + rs(Math.abs(v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const today = new Date();
const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const read = (text) => readDump(text, { defaultYear: today.getFullYear(), today: iso, products: [], categories: [] });
const entries = (r) => [
  ...r.expenses.map((e) => ({ c: 'ex', n: [e.category, e.notes, e.payment_mode === 'bank' ? 'UPI' : ''].filter(Boolean).join(' · '), v: -e.amount })),
  ...r.purchases.map((p) => ({ c: 'ex', n: `${p.item} · ${p.qty} ${p.unit}`, v: -p.total })),
  ...r.collections.map((c) => ({ c: c.mode === 'credit' ? 'ud' : 'in', n: [c.customer || (c.mode === 'credit' ? '' : 'Sale'), c.mode === 'credit' ? 'udhaar' : c.mode === 'upi' ? 'UPI' : ''].filter(Boolean).join(' · '), v: c.amount })),
];
const line = (x) => `<li class="${x.c}"><span class="n">${esc(x.n)}</span><i class="d"></i><b>${sgn(x.v)}</b></li>`;
const visibleOnce = (el, fn) => { if (!('IntersectionObserver' in window)) return fn(); const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.4 }); io.observe(el); };

$('bn-year').textContent = String(today.getFullYear());
// "Get your shop set up": WhatsApp if the owner has set a number in site-config.js, otherwise the owner's site
{ const d = String(SITE.whatsapp || '').replace(/\D/g, ''); if (d.length >= 8) $('bn-setup').href = `https://wa.me/${d}?text=${encodeURIComponent('Hi, I would like DailyKhata set up for my shop.')}`; }

// hero: the writing box types a few lines by itself until touched; the slip prints what the reader understood
{
  const note = $('bn-note'), rows = $('bn-rows');
  $('bn-date').textContent = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const grow = () => { note.style.height = 'auto'; note.style.height = Math.max(130, note.scrollHeight + 4) + 'px'; };
  const paint = () => {
    const r = read(note.value), list = entries(r);
    rows.innerHTML = list.length ? list.map(line).join('') : '<li class="empty">Your lines will print here.</li>';
    $('bn-in').textContent = rs(list.filter((x) => x.v > 0).reduce((s, x) => s + x.v, 0));
    $('bn-out').textContent = rs(-list.filter((x) => x.v < 0).reduce((s, x) => s + x.v, 0));
    $('bn-count').textContent = list.length ? `${list.length} ${list.length === 1 ? 'entry' : 'entries'}${r.skipped.length ? ` · ${r.skipped.length} total skipped` : ''}` : 'Nothing yet';
  };
  let t, touched = false;
  const touch = () => { touched = true; };
  note.addEventListener('pointerdown', touch); note.addEventListener('keydown', touch); note.addEventListener('focus', touch);
  note.addEventListener('input', () => { grow(); clearTimeout(t); t = setTimeout(paint, 100); });
  document.querySelectorAll('.bn-try button').forEach((b) => b.addEventListener('click', () => { touched = true; note.value = b.dataset.sample; grow(); paint(); }));
  grow(); paint();
  (async () => {
    await wait(700);
    for (const ln of ['gas 820, chai 40', 'Sharma se 3000 mila upi', 'Sting 2 box 1020', 'Raju udhaar 450']) {
      if (touched) return;
      const base = note.value ? note.value + '\n' : '';
      if (calm()) note.value = base + ln;
      else for (let k = 1; k <= ln.length && !touched; k++) { note.value = base + ln.slice(0, k); await wait(48 + Math.random() * 50); }
      if (touched) return;
      grow(); paint(); await wait(600);
    }
  })();
}

// drawer total counts up when it scrolls into view
{
  const el = $('bn-cash');
  if (el && !calm()) visibleOnce(el, () => {
    const to = Number(el.dataset.to), t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1100); el.textContent = rs(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

// "write how you write": real inputs, real reader output
{
  const samples = ['चाय ४०', 'chai 40', 'bijli bill 1450', 'Sharma se 3000 mila', 'Raju udhaar 450', 'rent 15,000/-'];
  const outs = samples.map((s) => { const x = entries(read(s))[0]; return x ? `${x.n} · ${rs(Math.abs(x.v))}` : ''; });
  const inEl = $('bn-w-in'), outEl = $('bn-w-out'), wrap = outEl.parentElement;
  let i = 0; inEl.textContent = samples[0]; outEl.textContent = outs[0];
  if (!calm()) setInterval(() => {
    if (document.hidden) return;
    inEl.classList.add('fade'); wrap.classList.add('fade');
    setTimeout(() => { i = (i + 1) % samples.length; inEl.textContent = samples[i]; outEl.textContent = outs[i]; inEl.classList.remove('fade'); wrap.classList.remove('fade'); }, 450);
  }, 3000);
}

// offline tile: saved on the phone, then synced
{
  const box = $('bn-sync'), a = $('bn-sync-a'), b = $('bn-sync-b');
  if (box && !calm()) { let ok = false; setInterval(() => {
    if (document.hidden) return;
    ok = !ok; box.classList.toggle('ok', ok);
    a.textContent = ok ? 'Back online · synced' : 'Saved on this phone';
    b.textContent = ok ? 'All 3 entries are safe on the server' : '3 entries will sync when online';
  }, 2600); }
}
