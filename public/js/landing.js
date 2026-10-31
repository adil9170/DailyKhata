// Landing page behaviour: the live note demo (the app's real reader, src/lib/dump.ts), the hero phone that
// types and answers by itself, scroll reveals, the journey phone that follows the steps, and the small bento animations.
import { readDump } from '../../src/lib/dump.ts';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rs = (n) => '₹' + inr.format(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date();
const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const read = (text) => readDump(text, { defaultYear: today.getFullYear(), today: iso, products: [], categories: [] });
const rowsOf = (r) => [
  ...r.expenses.map((e) => ({ c: 'ex', t: 'Expense', n: [e.category, e.notes, e.payment_mode === 'bank' ? 'UPI' : ''].filter(Boolean).join(' · '), v: -e.amount })),
  ...r.purchases.map((p) => ({ c: 'st', t: 'Stock', n: `${p.item} · ${p.qty} ${p.unit}`, v: -p.total })),
  ...r.collections.map((c) => ({ c: c.mode === 'credit' ? 'ud' : 'in', t: c.mode === 'credit' ? 'Udhaar' : 'Sale', n: [c.customer, c.mode === 'upi' ? 'UPI' : ''].filter(Boolean).join(' · ') || 'Cash sale', v: c.amount })),
];
const visible = (el, fn, opts = { threshold: 0.3 }) => { const io = new IntersectionObserver((es) => es.forEach((e) => fn(e, io)), opts); io.observe(el); return io; };

export function initLanding() {
  const yr = document.getElementById('lp-year'); if (yr) yr.textContent = String(today.getFullYear());
  noteDemo(); heroPhone(); reveals(); journey(); bento();
}

function noteDemo() {
  const note = document.getElementById('lp-note'), rows = document.getElementById('lp-rows');
  if (!note || !rows) return;
  const count = document.getElementById('lp-count'), inEl = document.getElementById('lp-in'), outEl = document.getElementById('lp-outv');
  document.getElementById('lp-date').textContent = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const grow = () => { note.style.height = 'auto'; note.style.height = Math.max(192, note.scrollHeight) + 'px'; };
  const paint = () => {
    const r = read(note.value), list = rowsOf(r);
    rows.innerHTML = list.length
      ? list.map((x) => `<li class="${x.c}"><span class="t">${x.t}</span><span class="n">${esc(x.n)}</span><b>${x.v < 0 ? '−' : '+'}${rs(Math.abs(x.v))}</b></li>`).join('')
      : '<li class="empty">Write something with an amount, like “gas 820”.</li>';
    count.textContent = `${list.length} ${list.length === 1 ? 'entry' : 'entries'}${r.skipped.length ? ` · ${r.skipped.length} total skipped` : ''}`;
    inEl.textContent = rs(list.filter((x) => x.v > 0).reduce((s, x) => s + x.v, 0));
    outEl.textContent = rs(-list.filter((x) => x.v < 0).reduce((s, x) => s + x.v, 0));
  };
  let t;
  note.addEventListener('input', () => { grow(); clearTimeout(t); t = setTimeout(paint, 120); });
  document.querySelectorAll('.lp-samples button').forEach((b) => b.addEventListener('click', () => { note.value = b.dataset.sample; grow(); paint(); }));
  grow(); paint();
}

// Hero phone: types a line, "sends" it, and the khata answers with what it understood (read by the real reader).
function heroPhone() {
  const log = document.getElementById('lp-chatlog'), typing = document.getElementById('lp-typing');
  if (!log || !typing) return;
  const lines = ['gas 820, chai 40', 'Sharma se 3000 mila upi', 'Sting 2 box 1020', 'Raju udhaar 450', 'auto 120, samosa 60'];
  let sales = 0, spent = 0, running = false, stop = false;
  const add = (cls, html) => { const b = document.createElement('div'); b.className = `lp-b ${cls}`; b.innerHTML = html; log.append(b); while (log.children.length > 6) log.firstElementChild.remove(); };
  async function loop() {
    if (running) return; running = true;
    for (let i = 0; !stop; i = (i + 1) % lines.length) {
      const line = lines[i];
      if (calm()) typing.textContent = line;
      else for (let k = 1; k <= line.length && !stop; k++) { typing.textContent = line.slice(0, k); await wait(55 + Math.random() * 45); }
      await wait(450);
      typing.textContent = '';
      add('me', esc(line));
      await wait(650);
      const list = rowsOf(read(line));
      for (const x of list) { if (x.v > 0) sales += x.v; else spent -= x.v; }
      add('bot', list.map((x) => `<div class="r${x.v > 0 ? ' g' : ''}"><span><i>${x.t}</i>${esc(x.n)}</span><b>${x.v < 0 ? '−' : '+'}${rs(Math.abs(x.v))}</b></div>`).join('')
        + `<div class="s"><span>Sales <b>${rs(sales)}</b></span><span>Spent <b>${rs(spent)}</b></span></div>`);
      await wait(calm() ? 4000 : 2200);
    }
    running = false;
  }
  visible(log.closest('.lp-phone'), (e) => { if (e.isIntersecting) { stop = false; loop(); } else stop = true; }, { threshold: 0.2 });
}

function reveals() {
  const els = document.querySelectorAll('#landing .reveal');
  if (calm() || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

// Journey: the step nearest the middle of the screen lights up, and the phone shows its screen.
function journey() {
  const steps = [...document.querySelectorAll('.lp-steps li')], shots = [...document.querySelectorAll('.lp-phone-shot img')];
  if (!steps.length) return;
  const show = (li) => {
    steps.forEach((s) => s.classList.toggle('on', s === li));
    shots.forEach((img) => img.classList.toggle('on', img.dataset.name === li.dataset.shot));
  };
  show(steps[0]);
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) show(e.target); }), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
}

function bento() {
  // cash total counts up once
  const c = document.querySelector('.lp-cashtot .count');
  if (c && !calm()) visible(c, (e, io) => {
    if (!e.isIntersecting) return; io.disconnect();
    const to = Number(c.dataset.to), t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1100); c.textContent = rs(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  // offline card: waiting → synced, over and over
  const box = document.querySelector('.lp-sync'), a = document.getElementById('lp-sync'), b = document.getElementById('lp-sync2');
  if (box && !calm()) {
    let ok = false;
    setInterval(() => {
      ok = !ok; box.classList.toggle('ok', ok);
      a.textContent = ok ? 'Back online · synced' : 'Saved on this phone';
      b.textContent = ok ? 'All 3 entries are safe on the server' : '3 entries will sync when online';
    }, 2600);
  }
  // language card: the same entry written three ways
  const lang = document.getElementById('lp-lang');
  if (lang && !calm()) {
    const ways = ['चाय ४०', 'chai 40', 'tea 40', '4 cup chai 40'];
    let i = 0;
    setInterval(() => { lang.style.opacity = '0'; setTimeout(() => { i = (i + 1) % ways.length; lang.textContent = ways[i]; lang.style.opacity = '1'; }, 300); }, 2000);
  }
}
