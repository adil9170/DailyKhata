// Chat khata: the whole app as one conversation. Type (or say) what happened — "chai 40, auto 120",
// "Sharma se 3000 mila" — and it is saved at once. Ask "aaj kitna?" for the day's numbers. Undo with one tap.
// Reading happens on the phone (src/lib/dump.ts), so it is instant and works offline.
import { h, mount, money, toast, icon } from '../ui.js';
import { api, state, can, todayLocal, navigate } from '../api.js';
import { rowOrder } from '../state.js';
import { readDump } from '../../../src/lib/dump.ts';

const KINDS = { purchases: 'Stock', expenses: 'Expense', collections: 'Sale' };
const time = (sql) => { if (!sql) return ''; const d = new Date(sql.replace(' ', 'T') + 'Z'); return isNaN(d) ? '' : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); };
// entries get a new id when they reach the server; client_id never changes, so we track that
const keyOf = (k, e) => `${k}:${e.client_id || e.id}`;
const ids = (day) => new Set(['purchases', 'expenses', 'collections'].flatMap((k) => day[k].map((e) => keyOf(k, e))));

function describe(kind, e) {
  if (kind === 'collections') return { t: [e.mode === 'credit' ? 'Udhaar' : e.mode === 'cash' ? 'Cash' : e.mode.toUpperCase(), e.customer].filter(Boolean).join(' · '), amt: e.amount_paise, sign: '+' };
  if (kind === 'expenses') return { t: `${e.category}${e.notes ? ' · ' + e.notes : ''}`, amt: e.amount_paise, sign: '−' };
  return { t: `${e.product_name} · ${e.qty_units} ${e.unit}`, amt: e.total_cost_paise, sign: '−' };
}

export async function chatPage(main) {
  const date = state.today || todayLocal();
  const W = can('entries.write');
  let day = await api(`/api/c/day/${date}`);
  const log = h('div', { class: 'chatlog', role: 'log', 'aria-live': 'polite' });
  const lastAdded = []; // stack of entry keys (kind:client_id) per message, for undo

  const scroll = () => requestAnimationFrame(() => log.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' }));
  const bubble = (side, ...kids) => { const b = h('div', { class: `bub bub-${side}` }, ...kids); log.append(b); scroll(); return b; };
  const entryCard = (kind, e) => { const d = describe(kind, e); return h('div', { class: `ent ${kind}` }, h('span', { class: 'et' }, h('span', { class: 'ek' }, KINDS[kind]), d.t), h('b', { class: 'ea' }, d.sign + money(d.amt))); };
  const summary = () => {
    const r = day.report;
    return h('div', { class: 'sumcard' },
      h('div', null, h('span', null, 'Sales'), h('b', { class: 'pos' }, money(r.collections.total))),
      h('div', null, h('span', null, 'Spent'), h('b', null, money(r.purchases.total + r.expenses.total))),
      h('div', null, h('span', null, 'Cash left'), h('b', null, money(r.net_cash_flow, { sign: true }))));
  };
  const chips = (list) => h('div', { class: 'bubchips' }, list.map(([label, fn]) => h('button', { type: 'button', class: 'chip small', onclick: fn }, label)));

  // ---- history: today's entries, oldest first, as if you had sent them ----
  const all = ['purchases', 'expenses', 'collections'].flatMap((k) => day[k].map((e) => [k, e])).sort((a, b) => rowOrder(a[1].id) - rowOrder(b[1].id));
  const first = (state.user?.name || '').split(/\s+/)[0];
  bubble('bot', h('div', null, `Namaste${first ? ' ' + first : ''}! Tell me what happened — like `, h('i', null, '“chai 40, auto 120”'), ' or ', h('i', null, '“Sharma se 3000 mila”'), '. I’ll write it in your khata.'),
    all.length ? null : chips([['How do I use this?', () => help()]]));
  if (all.length) {
    const shown = all.slice(-8);
    bubble('me', all.length > shown.length ? h('div', { class: 'bt', style: { textAlign: 'left', marginTop: 0 } }, `+${all.length - shown.length} earlier`) : null,
      shown.map(([k, e]) => entryCard(k, e)), h('div', { class: 'bt' }, `Today · ${all.length} ${all.length === 1 ? 'entry' : 'entries'}`));
    bubble('bot', h('div', null, 'So far today:'), summary());
  }

  function help() {
    bubble('bot', h('div', null, 'Just write it the way you talk:'),
      h('ul', null, h('li', null, '“gas 820, chai 40” → expenses'), h('li', null, '“sale 1500 upi” → money in'), h('li', null, '“Raju udhaar 300” → udhaar sale'), h('li', null, '“Sting 2 box 1020” → stock bought'), h('li', null, '“aaj kitna?” → today’s numbers')),
      chips([['Today’s total', () => ask('aaj kitna')], ['Make a bill', () => navigate('#/bill')], ['Count cash', () => navigate('#/counter')]]));
  }
  async function refresh() { day = await api(`/api/c/day/${date}`); }

  async function undo(btn) {
    const last = lastAdded.pop(); if (!last) return;
    btn.disabled = true;
    try {
      await refresh(); // ids may have changed since the entry was added
      for (const key of last) { const k = key.split(':')[0]; const e = day[k].find((x) => keyOf(k, x) === key); if (e) await api(`/api/c/${k}/${e.id}`, { method: 'DELETE' }); }
      await refresh(); bubble('bot', h('div', null, 'Removed. ', h('span', { class: 'muted' }, `Sales ${money(day.report.collections.total)} · Spent ${money(day.report.purchases.total + day.report.expenses.total)}`))); }
    catch (e) { toast(e.message, true); lastAdded.push(last); btn.disabled = false; }
  }

  async function ask(text) {
    bubble('me', h('div', { class: 'mt' }, text));
    const low = text.toLowerCase();
    const ctx = { defaultYear: Number(date.slice(0, 4)), today: date, products: (state.products || []).filter((p) => p.active !== 0).map((p) => ({ id: p.id, name: p.name, pieces_per_unit: p.pieces_per_unit || 1 })), categories: (state.categories || []).map((c) => c.name) };
    const r = readDump(text, ctx);
    const found = r.expenses.length + r.purchases.length + r.collections.length;
    if (!found) {
      if (/kitna|total|hisab|hisaab|summary|kaisa|today|aaj|din/.test(low)) { await refresh(); return bubble('bot', h('div', null, 'Today so far:'), summary(), chips([['Open khata', () => navigate(`#/day?date=${date}`)]])); }
      if (/bill|invoice/.test(low)) return bubble('bot', h('div', null, 'Let’s make a bill.'), chips([['Make a bill', () => navigate('#/bill')]]));
      if (/cash|gin|count|galla|drawer/.test(low)) return bubble('bot', h('div', null, 'Count the notes in the drawer:'), chips([['Count cash', () => navigate('#/counter')]]));
      if (/help|kaise|how|\?$/.test(low)) return help();
      return bubble('bot', h('div', null, 'I couldn’t find an amount there. Put the amount next to what it was for, like “gas 820”.'), chips([['Show examples', () => help()]]));
    }
    if (!W) return bubble('bot', h('div', null, 'You can view this shop but not add entries.'));
    const groups = new Map();
    const put = (d) => { const k = d || date; if (!groups.has(k)) groups.set(k, { date: k, purchases: [], expenses: [], collections: [] }); return groups.get(k); };
    r.expenses.forEach((e) => put(e.date).expenses.push({ category: e.category, amount: String(e.amount), payment_mode: e.payment_mode, notes: e.notes }));
    r.purchases.forEach((p) => put(p.date).purchases.push({ item: p.item, product_name: p.item, qty: p.qty, unit: p.unit, pieces: p.pieces, total: String(p.total), payment_mode: p.payment_mode }));
    r.collections.forEach((c) => put(c.date).collections.push({ amount: String(c.amount), mode: c.mode, customer: c.customer }));
    const before = ids(day);
    try {
      for (const g of groups.values()) await api('/api/c/bulk', { method: 'POST', body: g });
      await refresh();
    } catch (e) { return bubble('bot', h('div', { class: 'neg' }, e.message)); }
    const added = ['purchases', 'expenses', 'collections'].flatMap((k) => day[k].filter((e) => !before.has(keyOf(k, e))).map((e) => [k, e]));
    lastAdded.push(added.map(([k, e]) => keyOf(k, e)));
    const other = [...groups.keys()].filter((d) => d !== date);
    const undoBtn = h('button', { type: 'button', class: 'chip small', onclick: (ev) => undo(ev.currentTarget) }, 'Undo');
    bubble('bot', h('div', null, `Added ${found} ${found === 1 ? 'entry' : 'entries'}`, other.length ? ` (${other.length === 1 ? 'one on ' + other[0] : 'some on other days'})` : '', ':'),
      added.map(([k, e]) => entryCard(k, e)), summary(), h('div', { class: 'bubchips' }, undoBtn));
  }

  // ---- composer ----
  const ta = h('textarea', { rows: '1', placeholder: 'Type what happened…', 'aria-label': 'Message', enterkeyhint: 'send' });
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  const send = async () => { const t = ta.value.trim(); if (!t) return; ta.value = ''; grow(); sendBtn.disabled = true; try { await ask(t); } finally { sendBtn.disabled = false; ta.focus(); } };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover: hover)').matches) { e.preventDefault(); send(); } });
  const sendBtn = h('button', { class: 'send', type: 'button', 'aria-label': 'Send', onclick: send }, icon('right', 22));

  // voice: Indian English understands Hinglish numbers well ("chai chalis" stays words, "chai 40" works)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let mic = null;
  if (SR) {
    mic = h('button', { class: 'mic', type: 'button', 'aria-label': 'Speak' }, icon('mic', 20));
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = true;
      const startText = ta.value ? ta.value.trim() + ' ' : '';
      rec.onresult = (e) => { ta.value = startText + [...e.results].map((x) => x[0].transcript).join(' '); grow(); };
      rec.onend = () => { rec = null; mic.classList.remove('on'); };
      rec.onerror = (e) => { if (e.error === 'not-allowed') toast('Allow the microphone to speak entries', true); };
      mic.classList.add('on'); rec.start();
    });
  }
  const quick = h('div', { class: 'chatquick' },
    [['Today’s total', () => ask('aaj kitna')], ['Make a bill', () => navigate('#/bill')], ['Count cash', () => navigate('#/counter')], ['Help', () => help()]]
      .map(([l, fn]) => h('button', { type: 'button', class: 'chip small', onclick: fn }, l)));

  mount(main, h('div', { class: 'chat' }, log, h('div', { class: 'composer' }, quick, h('div', { class: 'cbox' }, mic, ta, sendBtn))));
  main.classList.add('chatmain');
  window.addEventListener('hashchange', function off() { window.removeEventListener('hashchange', off); main.classList.remove('chatmain'); });
  scroll();
}
