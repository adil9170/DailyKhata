// Write expenses: type or paste anything (WhatsApp messages, a diary page, voice typing) and the money in it
// is picked out while you type. The reading happens on the phone, so it is instant and works offline.
// Untick anything wrong, fix a name or amount, tap Add. "Read with AI" is there for text the quick reader gets wrong.
import { h, mount, money, toast, icon, busy, fmtDate, pageHead } from '../ui.js';
import { api, state, can, todayLocal, navigate } from '../api.js';
import { readDump } from '../../../src/lib/dump.ts';

const HANDOFF = 'dk_dump_in'; // Notes → "Find expenses" passes its text here
const EXAMPLE = 'aaj gas 820, chai 40, auto 120\nRamesh salary 5000 gpay\nbijli bill 1450 paid\nSharma se 3000 mila';
const draftKey = () => `dk_dump_${state.company?.id || 0}`;
const readDraft = () => { try { const v = sessionStorage.getItem(HANDOFF); if (v !== null) { sessionStorage.removeItem(HANDOFF); return v; } return localStorage.getItem(draftKey()) || ''; } catch { return ''; } };
const writeDraft = (v) => { try { if (v) localStorage.setItem(draftKey(), v); else localStorage.removeItem(draftKey()); } catch { /* storage blocked */ } };

/** Open this page with some text already in it (used by Notes). */
export function openDumpWith(text) {
  try { sessionStorage.setItem(HANDOFF, text); } catch { /* storage blocked */ }
  navigate('#/dump');
}

export async function dumpPage(main) {
  if (!can('entries.write')) { mount(main, pageHead('Write expenses'), h('div', { class: 'card empty' }, 'You can view this shop but not add entries.')); return; }
  const today = state.today || todayLocal();
  let date = today;
  let ai = null;              // { text, result } from "Read with AI"; dropped as soon as the text changes
  const off = new Set();      // unticked items
  const edits = new Map();    // key -> changed fields
  let items = [], skipped = [], timer = null;

  const ta = h('textarea', { class: 'dump-ta', spellcheck: 'false', autocapitalize: 'sentences', 'aria-label': 'Your notes',
    placeholder: `Type or paste anything…\n\n${EXAMPLE}` });
  ta.value = readDraft();
  const list = h('div', { class: 'dlist' });
  const head = h('div', { class: 'dhead' });
  const addBtn = h('button', { class: 'primary dadd' });
  const dateInput = h('input', { type: 'date', value: date, max: today, 'aria-label': 'Date for these entries' });
  const dateLbl = h('span');
  const paintDate = () => { dateLbl.textContent = date === today ? 'Today' : fmtDate(date, { day: 'numeric', month: 'short' }); };
  dateInput.addEventListener('change', () => { if (dateInput.value) { date = dateInput.value; paintDate(); paint(); } });
  paintDate();

  const ctx = () => ({ defaultYear: Number(date.slice(0, 4)), today: date,
    products: (state.products || []).filter((p) => p.active !== 0).map((p) => ({ id: p.id, name: p.name, pieces_per_unit: p.pieces_per_unit || 1 })),
    categories: (state.categories || []).map((c) => c.name) });
  const known = () => new Set((state.categories || []).map((c) => c.name.toLowerCase()));

  function read() {
    const r = ai && ai.text === ta.value ? ai.result : readDump(ta.value, ctx());
    if (ai && ai.text !== ta.value) ai = null;
    const seen = new Map();
    const key = (kind, src) => { const k = `${kind}|${src}`; const n = (seen.get(k) || 0) + 1; seen.set(k, n); return `${k}|${n}`; };
    items = [
      ...r.expenses.map((e) => ({ kind: 'expense', name: e.category, amount: e.amount, notes: e.notes, mode: e.payment_mode, date: e.date, source: e.source })),
      ...r.purchases.map((p) => ({ kind: 'purchase', name: p.item, amount: p.total, qty: p.qty, unit: p.unit, pieces: p.pieces, mode: p.payment_mode, date: p.date, source: p.source })),
      ...r.collections.map((c) => ({ kind: 'collection', name: c.customer, amount: c.amount, mode: c.mode, date: c.date, source: c.source })),
    ].map((it) => { const k = key(it.kind, it.source); return { ...it, ...(edits.get(k) || {}), key: k }; });
    skipped = r.skipped || [];
  }

  const chosen = () => items.filter((it) => !off.has(it.key) && Number(it.amount) > 0);
  function paintTotals() {
    const c = chosen();
    const out = c.filter((i) => i.kind !== 'collection').reduce((s, i) => s + Number(i.amount), 0);
    const inn = c.filter((i) => i.kind === 'collection').reduce((s, i) => s + Number(i.amount), 0);
    mount(head,
      h('div', null, h('div', { class: 'eyebrow muted' }, items.length ? `Found ${items.length}` : 'Found'),
        h('div', { class: 'dsum' }, out ? h('span', null, 'Spent ', h('b', null, money(Math.round(out * 100)))) : null, inn ? h('span', { class: 'pos' }, 'Received ', h('b', null, money(Math.round(inn * 100)))) : null,
          !out && !inn ? h('span', { class: 'muted' }, ta.value.trim() ? 'Nothing yet' : 'Start typing') : null)),
      aiButton());
    addBtn.disabled = !c.length;
    addBtn.textContent = c.length ? `Add ${c.length} to khata` : 'Add to khata';
  }

  function aiButton() {
    if (!state.company?.ocr_enabled || !ta.value.trim()) return null;
    if (ai && ai.text === ta.value) return h('button', { class: 'ghost small', type: 'button', onclick: () => { ai = null; edits.clear(); off.clear(); paint(); } }, 'Undo AI');
    const b = h('button', { class: 'small dai', type: 'button' }, icon('sparkles', 16), 'Read with AI');
    b.addEventListener('click', busy(b, async () => {
      if (!navigator.onLine) return toast('AI reading needs internet. The quick reader works offline.', true);
      const text = ta.value;
      const result = await api('/api/c/parse-ai', { method: 'POST', body: { text, date } });
      ai = { text, result }; edits.clear(); off.clear(); paint();
      toast(result.expenses.length + result.purchases.length + result.collections.length ? 'Read by AI — check and add' : 'AI found no amounts either');
    }));
    return b;
  }

  function row(it) {
    const isNew = it.kind === 'expense' && it.name && !known().has(it.name.toLowerCase());
    const set = (k, v) => { edits.set(it.key, { ...(edits.get(it.key) || {}), [k]: v }); it[k] = v; paintTotals(); };
    const tick = h('input', { type: 'checkbox', checked: !off.has(it.key), 'aria-label': 'Include this' });
    const el = h('div', { class: 'ditem ' + it.kind + (off.has(it.key) ? ' off' : '') });
    tick.addEventListener('change', () => { if (tick.checked) off.delete(it.key); else off.add(it.key); el.classList.toggle('off', !tick.checked); paintTotals(); });
    const name = h('input', { class: 'dname', value: it.name || '', list: it.kind === 'expense' ? 'dk-cats' : it.kind === 'purchase' ? 'dk-prods' : null,
      placeholder: it.kind === 'collection' ? 'Sale' : it.kind === 'purchase' ? 'Item' : 'What for', 'aria-label': it.kind === 'collection' ? 'Customer' : 'Name',
      oninput: (e) => set('name', e.target.value) });
    const amount = h('input', { class: 'damt', value: String(it.amount ?? ''), inputmode: 'decimal', 'aria-label': 'Amount in rupees',
      oninput: (e) => set('amount', e.target.value.replace(/[^\d.]/g, '')) });
    const tag = it.kind === 'collection' ? (it.mode === 'credit' ? 'Udhaar sale' : it.mode === 'upi' ? 'Money in · UPI' : it.mode === 'card' ? 'Money in · Card' : 'Money in')
      : it.kind === 'purchase' ? `Stock · ${it.qty} ${it.unit}${it.pieces ? ` · ${it.pieces} pcs` : ''}`
      : it.mode === 'bank' ? 'Expense · UPI/bank' : it.mode === 'credit' ? 'Expense · udhaar' : 'Expense';
    return mount(el,
      h('label', { class: 'dcheck' }, tick),
      h('div', { class: 'dmain' },
        h('div', { class: 'dtop' }, name, h('span', { class: 'drs' }, it.kind === 'collection' ? '+₹' : '₹'), amount),
        h('div', { class: 'dsub' },
          h('span', { class: 'dtag' }, tag),
          isNew ? h('span', { class: 'dtag new' }, 'new') : null,
          it.notes ? h('span', null, it.notes) : null,
          it.date && it.date !== date ? h('span', { class: 'dtag' }, fmtDate(it.date, { day: 'numeric', month: 'short' })) : null,
          h('span', { class: 'dsrc' }, '“', it.source, '”'))));
  }

  function paint() {
    read();
    if (!ta.value.trim()) {
      mount(list, h('div', { class: 'dempty' },
        h('div', { class: 'small muted' }, 'Write the way you talk. One thing per line, or all in one go:'),
        h('ul', { class: 'small muted' }, h('li', null, '“gas 820, chai 40, auto 120”'), h('li', null, '“paid 500 for gas”, “Ramesh salary 5000 gpay”'), h('li', null, '“Sharma se 3000 mila” → money in'), h('li', null, '“Sting 2 box 1020” → stock bought')),
        h('button', { class: 'small', type: 'button', onclick: () => { ta.value = EXAMPLE; onType(true); } }, 'Try an example')));
    } else if (!items.length) {
      mount(list, h('div', { class: 'dempty small muted' }, 'No amounts yet. Put the amount next to what it was for, like “gas 820”.'));
    } else {
      mount(list, items.map(row), skipped.length ? h('details', { class: 'dskip small muted' }, h('summary', null, `Skipped ${skipped.length} (totals, balances…)`), h('ul', null, skipped.map((s) => h('li', null, s)))) : null);
    }
    paintTotals();
  }

  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(Math.max(ta.scrollHeight + 2, 150), Math.round(innerHeight * 0.45)) + 'px'; };
  function onType(now = false) {
    grow(); clearTimeout(timer);
    const run = () => { writeDraft(ta.value); paint(); };
    if (now) run(); else timer = setTimeout(run, 180);
  }
  ta.addEventListener('input', () => onType());
  window.addEventListener('hashchange', function save() { window.removeEventListener('hashchange', save); writeDraft(ta.value); }); // never lose typing

  addBtn.addEventListener('click', busy(addBtn, async () => {
    const pick = chosen();
    const bad = pick.find((i) => i.kind !== 'collection' && !String(i.name || '').trim());
    if (bad) return toast('Give every ticked item a name', true);
    const groups = new Map();
    for (const it of pick) {
      const d = it.date || date;
      if (!groups.has(d)) groups.set(d, { date: d, purchases: [], expenses: [], collections: [] });
      const g = groups.get(d), name = String(it.name || '').trim();
      if (it.kind === 'expense') g.expenses.push({ category: name, amount: String(it.amount), payment_mode: it.mode || 'cash', notes: it.notes || '' });
      else if (it.kind === 'purchase') g.purchases.push({ item: name, product_name: name, qty: Number(it.qty) || 1, unit: it.unit || 'box', pieces: it.pieces ?? null, total: String(it.amount), payment_mode: it.mode || 'cash' });
      else g.collections.push({ amount: String(it.amount), mode: it.mode || 'cash', customer: name });
    }
    let n = 0;
    for (const g of groups.values()) n += (await api('/api/c/bulk', { method: 'POST', body: g })).created;
    const days = [...groups.keys()];
    ta.value = ''; ai = null; off.clear(); edits.clear(); writeDraft(''); grow();
    paint();
    mount(list, h('div', { class: 'dempty ddone' }, icon('check', 22),
      h('div', null, h('b', null, `Added ${n} ${n === 1 ? 'entry' : 'entries'}`), h('div', { class: 'small muted' }, days.length === 1 ? `to ${days[0] === today ? 'today' : fmtDate(days[0], { day: 'numeric', month: 'short' })}` : `across ${days.length} days`)),
      h('a', { class: 'small', href: `#/day?date=${days[days.length - 1]}` }, 'See khata →')));
    toast(`Added ${n} ${n === 1 ? 'entry' : 'entries'}`);
  }));

  mount(main,
    pageHead('Write expenses', 'Type or paste anything — the money is picked out for you'),
    h('datalist', { id: 'dk-cats' }, (state.categories || []).map((c) => h('option', { value: c.name }))),
    h('datalist', { id: 'dk-prods' }, (state.products || []).filter((p) => p.active !== 0).map((p) => h('option', { value: p.name }))),
    h('div', { class: 'card dcard' }, ta),
    h('div', { class: 'card dfound' }, head, list),
    h('div', { class: 'dbar' },
      h('label', { class: 'ddate' }, icon('clock', 16), dateLbl, dateInput),
      addBtn));
  paint();
  requestAnimationFrame(grow);
  if (!ta.value) ta.focus();
}
