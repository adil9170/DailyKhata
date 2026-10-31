// Landing page behaviour. Everything the page shows is real: the writing box and the "becomes" line use the same text
// reader as the app (src/lib/dump.ts), and the receipt strip is built from what it understood.
import { readDump } from '../../src/lib/dump.ts';
import { t, lang, initLangSwitch } from './landing-i18n.js';
import { SITE } from './site-config.js';

const loc = () => (lang() === 'hi' ? 'hi-IN' : 'en-IN');
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rs = (n) => '₹' + inr.format(n);
const sgn = (v) => (v < 0 ? '−' : '+') + rs(Math.abs(v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date();
const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const read = (text) => readDump(text, { defaultYear: today.getFullYear(), today: iso, products: [], categories: [] });
const entries = (r) => [
  ...r.expenses.map((e) => ({ c: 'ex', n: [e.category, e.notes, e.payment_mode === 'bank' ? 'UPI' : ''].filter(Boolean).join(' · '), v: -e.amount })),
  ...r.purchases.map((p) => ({ c: 'ex', n: `${p.item} · ${p.qty} ${p.unit}`, v: -p.total })),
  ...r.collections.map((c) => ({ c: c.mode === 'credit' ? 'ud' : 'in', n: [c.customer || (c.mode === 'credit' ? '' : t('tape_sale')), c.mode === 'credit' ? t('tape_udhaar') : c.mode === 'upi' ? 'UPI' : ''].filter(Boolean).join(' · '), v: c.amount })),
];
const line = (x) => `<li class="${x.c}"><span class="n">${esc(x.n)}</span><i class="d"></i><b>${sgn(x.v)}</b></li>`;

export function initLanding() {
  const yr = document.getElementById('lp-year'); if (yr) yr.textContent = String(today.getFullYear());
  initLangSwitch(); // paints the page in the chosen language first, then the live parts read it
  setup(); writing(); day(); words();
}

// "Get your shop set up": a wa.me link with a prefilled message when the owner has set a number, otherwise the owner's site.
// The price line is shown only when it is set.
function setup() {
  const digits = String(SITE.whatsapp || '').replace(/\D/g, '');
  const href = () => (digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(t('wa_msg'))}` : 'https://adilshaikh.in');
  const paint = () => document.querySelectorAll('[data-setup]').forEach((a) => { a.href = href(); a.target = '_blank'; a.rel = 'noopener'; });
  paint(); window.addEventListener('dk:lang', paint);
  const price = document.getElementById('lp-price'), line = String(SITE.price_line || '').trim().slice(0, 140);
  if (price && line) { price.textContent = line; price.hidden = false; }
}

// "Say it": the browser's speech service (Web Speech API) fills the writing box. Hidden where it is not supported.
const MAX_SPOKEN = 600;
function mic(note, touch) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const row = document.getElementById('lp-mic-row'), btn = document.getElementById('lp-mic');
  if (!SR || !row || !btn) return;
  const label = document.getElementById('lp-mic-label'), status = document.getElementById('lp-mic-status');
  row.hidden = false;
  let rec = null, on = false, heard = false, failed = false, base = '', finals = '';
  const say = (key) => { status.textContent = key ? t(key) : ''; status.dataset.k = key || ''; };
  const idle = () => { on = false; btn.classList.remove('on'); btn.setAttribute('aria-pressed', 'false'); label.textContent = t('mic_start'); if (!failed && !heard && status.dataset.k === 'mic_listening') say('mic_none'); else if (status.dataset.k === 'mic_listening') say('mic_priv'); };
  const stop = () => { if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } } };
  const put = (interim) => {
    let v = (base + finals + interim).slice(0, MAX_SPOKEN);
    note.value = v; note.dispatchEvent(new Event('input'));
    if ((base + finals).length >= MAX_SPOKEN) { say('mic_full'); failed = true; stop(); }
  };
  const start = () => {
    touch(); // the auto-typing demo yields to the visitor
    base = note.value && !/\s$/.test(note.value) ? note.value + ' ' : note.value; finals = ''; heard = false; failed = false;
    rec = new SR(); rec.lang = loc(); rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], tx = r[0] ? r[0].transcript : '';
        if (r.isFinal) finals += tx.trim() + ' '; else interim += tx;
      }
      if (finals || interim) heard = true;
      put(interim);
    };
    rec.onerror = (e) => {
      const k = e.error;
      if (k === 'aborted') return;
      failed = true;
      say(k === 'not-allowed' || k === 'service-not-allowed' ? 'mic_denied' : k === 'network' ? 'mic_offline' : k === 'no-speech' ? 'mic_none' : 'mic_fail');
    };
    rec.onend = () => { rec = null; idle(); };
    try { rec.start(); } catch (e) { rec = null; say('mic_fail'); return; }
    on = true; btn.classList.add('on'); btn.setAttribute('aria-pressed', 'true'); label.textContent = t('mic_stop'); say('mic_listening');
  };
  // a tap while it is starting or stopping is ignored, so a double tap cannot throw or open two sessions
  let busy = false;
  btn.addEventListener('click', () => { if (busy) return; busy = true; setTimeout(() => { busy = false; }, 350); if (on) stop(); else start(); });
  note.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  const words = () => { label.textContent = t(on ? 'mic_stop' : 'mic_start'); const k = status.dataset.k; if (k) say(k); };
  window.addEventListener('dk:lang', () => { if (on) stop(); words(); });
  label.textContent = t('mic_start'); say('mic_priv');
}

// Hero: a writing box that types a few lines by itself until the visitor touches it; the strip fills in as it reads.
function writing() {
  const note = document.getElementById('lp-note'), rows = document.getElementById('lp-rows');
  if (!note || !rows) return;
  const count = document.getElementById('lp-count'), inEl = document.getElementById('lp-in'), outEl = document.getElementById('lp-outv');
  const dateEl = document.getElementById('lp-date');
  const grow = () => { note.style.height = 'auto'; note.style.height = Math.max(200, note.scrollHeight + 4) + 'px'; };
  const paint = () => {
    dateEl.textContent = today.toLocaleDateString(loc(), { day: 'numeric', month: 'short' });
    const r = read(note.value), list = entries(r);
    rows.innerHTML = list.length ? list.map(line).join('') : `<li class="empty">${esc(t('tape_empty'))}</li>`;
    inEl.textContent = rs(list.filter((x) => x.v > 0).reduce((s, x) => s + x.v, 0));
    outEl.textContent = rs(-list.filter((x) => x.v < 0).reduce((s, x) => s + x.v, 0));
    count.textContent = list.length ? t(list.length === 1 ? 'tape_one' : 'tape_many', { n: list.length }) + (r.skipped.length ? ` · ${t('tape_skipped', { n: r.skipped.length })}` : '') : t('tape_none');
  };
  let timer, touched = false;
  const touch = () => { touched = true; };
  note.addEventListener('pointerdown', touch); note.addEventListener('keydown', touch); note.addEventListener('focus', touch);
  note.addEventListener('input', () => { grow(); clearTimeout(timer); timer = setTimeout(paint, 100); });
  document.querySelectorAll('.lp-try button').forEach((b) => b.addEventListener('click', () => { touched = true; note.value = b.dataset.sample; grow(); paint(); }));
  window.addEventListener('dk:lang', paint);
  mic(note, touch);
  grow(); paint();
  const script = ['gas 820, chai 40', 'Sharma se 3000 mila upi', 'Sting 2 box 1020', 'Raju udhaar 450'];
  (async () => {
    await wait(700);
    for (const ln of script) {
      if (touched) return;
      const base = note.value ? note.value + '\n' : '';
      if (calm()) note.value = base + ln;
      else for (let k = 1; k <= ln.length && !touched; k++) { note.value = base + ln.slice(0, k); await wait(48 + Math.random() * 50); }
      if (touched) return;
      grow(); paint(); await wait(600);
    }
  })();
}

// One day: the step in the middle of the screen prints its lines on the strip; the drawer total follows.
const DAY = [
  { lines: [{ n: 'd_open', v: 3303, c: 'in', cash: 1 }] },
  { lines: [{ n: 'd_sting', v: -1020, c: 'ex', cash: 1 }] },
  { lines: [{ n: 'd_gas', v: -820, c: 'ex', cash: 1 }, { n: 'd_tea', v: -60, c: 'ex', cash: 1 }] },
  { lines: [{ n: 'd_mehta', v: 230, c: 'ud', cash: 0 }] },
  { lines: [{ n: 'd_cash', v: 6290, c: 'in', cash: 1 }, { n: 'd_upi', v: 1180, c: 'quiet', cash: 0 }], rule: true,
    close: [{ n: 'd_should', v: '₹7,693', c: 'total' }, { n: 'd_counted', v: '₹7,693', c: 'total' }] },
];
function day() {
  const ol = document.getElementById('lp-day-lines'), drawer = document.getElementById('lp-drawer');
  const moments = [...document.querySelectorAll('.lp-moments li')];
  if (!ol || !moments.length) return;
  const mini = document.createElement('div'); mini.className = 'lp-mini'; mini.innerHTML = '<span></span><b></b>';
  document.getElementById('day').append(mini);
  let shown = -1, cur = 0;
  const html = (s) => DAY[s].lines.map((x) => `<li class="${x.c}" data-s="${s}"><span class="n">${esc(t(x.n))}</span><i class="d"></i><b>${sgn(x.v)}</b></li>`).join('')
    + (DAY[s].rule ? `<li class="rule" data-s="${s}"></li>` + DAY[s].close.map((x) => `<li class="${x.c}" data-s="${s}"><span class="n">${esc(t(x.n))}</span><i class="d"></i><b>${x.v}</b></li>`).join('') + `<li class="ok" data-s="${s}">✓ ${esc(t('d_match'))}</li>` : '');
  const cashAt = (s) => DAY.slice(0, s + 1).reduce((t, d) => t + d.lines.filter((x) => x.cash).reduce((a, x) => a + x.v, 0), 0);
  const tween = (el, to) => {
    const from = Number(el.dataset.v || 0); el.dataset.v = to;
    if (calm()) { el.textContent = rs(to); return; }
    const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / 600); el.textContent = rs(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const show = (s) => {
    cur = s;
    moments.forEach((m, i) => m.classList.toggle('on', i === s));
    if (s > shown) for (let k = shown + 1; k <= s; k++) ol.insertAdjacentHTML('beforeend', html(k));
    else for (let k = shown; k > s; k--) ol.querySelectorAll(`[data-s="${k}"]`).forEach((e) => e.remove());
    shown = s;
    tween(drawer, cashAt(s));
    
    mini.firstChild.textContent = t(['m0_h', 'm1_h', 'm2_h', 'm3_h', 'm4_h'][s]); tween(mini.lastChild, cashAt(s));
  };
  show(0);
  // language switch: reprint the lines that are already on the strip, in the new language
  window.addEventListener('dk:lang', () => { const s = shown; ol.innerHTML = ''; shown = -1; for (let k = 0; k <= s; k++) ol.insertAdjacentHTML('beforeend', html(k)); shown = s; show(s); });
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) show(moments.indexOf(e.target)); }), { rootMargin: '-42% 0px -42% 0px' });
  moments.forEach((m) => io.observe(m));
}

// "Write how you write": real inputs, real output from the reader.
function words() {
  const inEl = document.getElementById('lp-w-in'), outEl = document.getElementById('lp-w-out');
  if (!inEl) return;
  const samples = ['चाय ४०', 'chai 40', 'bijli bill 1450', 'Sharma se 3000 mila', 'Raju udhaar 450', 'rent 15,000/-'];
  const name = (s) => { const x = entries(read(s))[0]; return x ? `${x.n} · ${rs(Math.abs(x.v))}` : ''; };
  const outs = samples.map(name);
  let i = 0; inEl.textContent = samples[0]; outEl.textContent = outs[0];
  if (calm()) return;
  const wrap = outEl.parentElement;
  const io = new IntersectionObserver((es) => { running = es[0].isIntersecting; }, { threshold: 0.4 });
  let running = false; io.observe(inEl);
  setInterval(() => {
    if (!running) return;
    inEl.classList.add('fade'); wrap.classList.add('fade');
    setTimeout(() => { i = (i + 1) % samples.length; inEl.textContent = samples[i]; outEl.textContent = outs[i]; inEl.classList.remove('fade'); wrap.classList.remove('fade'); }, 450);
  }, 3000);
}
