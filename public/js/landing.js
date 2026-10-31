// Landing page demo: the same text reader the app uses (src/lib/dump.ts), running live on the visitor's note.
import { readDump } from '../../src/lib/dump.ts';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const rs = (n) => '₹' + inr.format(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initLanding() {
  const note = document.getElementById('lp-note');
  const rows = document.getElementById('lp-rows');
  if (!note || !rows) return;
  const count = document.getElementById('lp-count'), inEl = document.getElementById('lp-in'), outEl = document.getElementById('lp-outv');
  const today = new Date();
  const iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById('lp-date').textContent = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const yr = document.getElementById('lp-year'); if (yr) yr.textContent = String(today.getFullYear());

  const grow = () => { note.style.height = 'auto'; note.style.height = Math.max(192, note.scrollHeight) + 'px'; };
  function paint() {
    const r = readDump(note.value, { defaultYear: today.getFullYear(), today: iso, products: [], categories: [] });
    const list = [
      ...r.expenses.map((e) => ({ c: 'ex', t: 'Expense', n: [e.category, e.notes, e.payment_mode === 'bank' ? 'UPI' : ''].filter(Boolean).join(' · '), v: -e.amount })),
      ...r.purchases.map((p) => ({ c: 'st', t: 'Stock', n: `${p.item} · ${p.qty} ${p.unit}`, v: -p.total })),
      ...r.collections.map((c) => ({ c: c.mode === 'credit' ? 'ud' : 'in', t: c.mode === 'credit' ? 'Udhaar' : 'Sale', n: [c.customer, c.mode === 'upi' ? 'UPI' : ''].filter(Boolean).join(' · ') || 'Cash sale', v: c.amount })),
    ];
    rows.innerHTML = list.length
      ? list.map((x) => `<li class="${x.c}"><span class="t">${x.t}</span><span class="n">${esc(x.n)}</span><b>${x.v < 0 ? '−' : '+'}${rs(Math.abs(x.v))}</b></li>`).join('')
      : '<li class="empty">Write something with an amount, like “gas 820”.</li>';
    count.textContent = `${list.length} ${list.length === 1 ? 'entry' : 'entries'}${r.skipped.length ? ` · skipped ${r.skipped.length} total` : ''}`;
    inEl.textContent = rs(list.filter((x) => x.v > 0).reduce((s, x) => s + x.v, 0));
    outEl.textContent = rs(-list.filter((x) => x.v < 0).reduce((s, x) => s + x.v, 0));
  }
  let t;
  note.addEventListener('input', () => { grow(); clearTimeout(t); t = setTimeout(paint, 120); });
  document.querySelectorAll('.lp-samples button').forEach((b) => b.addEventListener('click', () => { note.value = b.dataset.sample; grow(); paint(); }));
  grow(); paint();
}
