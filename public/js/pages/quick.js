// Quick add: one big screen for the three things a shop does all day.
// Pick what happened, type the amount, tap Save. Used as Home in Layman mode.
import { h, mount, money, num, toast, icon, busy, fmtDate } from '../ui.js';
import { api, state, can, refreshLists, todayLocal, navigate } from '../api.js';
import { rowOrder } from '../state.js';
import { getMode } from '../mode.js';
import { uploadDoc } from './day.js';
import { t as tx } from '../i18n.js';

const TYPES = [
  { id: 'collection', label: tx('Sale'), sub: tx('Money received'), icon: 'rupee' },
  { id: 'purchase', label: tx('Bought stock'), sub: tx('Items for the shop'), icon: 'bag' },
  { id: 'expense', label: tx('Expense'), sub: tx('Gas, rent, wifi…'), icon: 'receipt' },
];

export async function quickPage(main, params) {
  const date = params.get('date') || state.today || todayLocal();
  let type = TYPES.some((t) => t.id === params.get('type')) ? params.get('type') : 'collection';
  const W = can('entries.write');
  const data = await api(`/api/c/day/${date}`);
  const rep = data.report;
  const isToday = date === (state.today || todayLocal());

  const summary = h('div', { class: 'qsum' },
    h('div', { class: 'qcell' }, h('div', { class: 'k' }, tx('Sales')), h('div', { class: 'v' }, money(rep.collections.total))),
    h('div', { class: 'qcell' }, h('div', { class: 'k' }, tx('Bought')), h('div', { class: 'v' }, money(rep.purchases.total))),
    h('div', { class: 'qcell' }, h('div', { class: 'k' }, tx('Expenses')), h('div', { class: 'v' }, money(rep.expenses.total))));

  const greeting = h('div', { class: 'qhead' },
    h('div', { class: 'small muted' }, isToday ? tx('Today') : fmtDate(date, { weekday: 'long' }), ' · ', fmtDate(date, { day: 'numeric', month: 'short' })),
    h('h1', null, state.user?.name ? tx('Hi {name}', null, { name: state.user.name.split(/\s+/)[0] }) : tx('Quick add')),
    h('div', { class: 'sub' }, tx('What happened in the shop?')));

  if (!W) {
    mount(main, greeting, summary, h('div', { class: 'card empty' }, tx('You can view this shop but not add entries.')));
    return;
  }

  // ----- form state -----
  const amount = h('input', { class: 'bigamt', inputmode: 'decimal', autocomplete: 'off', placeholder: '0', 'aria-label': tx('Amount in rupees'), enterkeyhint: 'done' });
  const amountBox = h('label', { class: 'amtbox' }, h('span', { class: 'rs' }, '₹'), amount);
  const detail = h('div', { class: 'qdetail' });
  const saveBtn = h('button', { class: 'primary savebtn', type: 'submit' });
  const typeSeg = h('div', { class: 'qtypes', role: 'tablist' });
  let chosen = { mode: 'cash', category: '', product: '', qty: 1, customer: '' };

  const chips = (items, current, onPick, { allowOther = false } = {}) => {
    const wrap = h('div', { class: 'chips' });
    const draw = () => mount(wrap, items.map((it) => h('button', { type: 'button', class: 'chip' + (current() === it.value ? ' on' : ''), onclick: () => { onPick(it.value); draw(); } }, it.label)));
    draw();
    return wrap;
  };

  function drawDetail() {
    const t = type;
    if (t === 'collection') {
      const cust = h('input', { placeholder: tx('Customer name (optional)'), value: chosen.customer, oninput: (e) => { chosen.customer = e.target.value; } });
      const custWrap = h('div', { class: 'field', style: { display: chosen.mode === 'credit' ? '' : 'none' } }, cust);
      mount(detail,
        h('div', { class: 'lbl' }, tx('How was it paid?')),
        chips([{ value: 'cash', label: tx('Cash') }, { value: 'upi', label: tx('UPI') }, { value: 'card', label: tx('Card') }, { value: 'credit', label: tx('Udhaar') }], () => chosen.mode, (v) => { chosen.mode = v; custWrap.style.display = v === 'credit' ? '' : 'none'; }),
        custWrap);
      saveBtn.textContent = tx('Save sale');
    } else if (t === 'expense') {
      const names = state.categories.map((c) => c.name);
      const other = h('input', { placeholder: tx('Or type what it was for'), value: names.includes(chosen.category) ? '' : chosen.category, oninput: (e) => { chosen.category = e.target.value; chipsEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); } });
      const chipsEl = chips(names.slice(0, 10).map((n) => ({ value: n, label: n })), () => chosen.category, (v) => { chosen.category = v; other.value = ''; });
      mount(detail, h('div', { class: 'lbl' }, tx('What was it for?')), chipsEl, h('div', { class: 'field' }, other));
      saveBtn.textContent = tx('Save expense');
    } else {
      const prods = state.products.filter((p) => p.active);
      const name = h('input', { placeholder: tx('Item name, e.g. Sting'), value: chosen.product, list: 'q-prods', autocomplete: 'off', oninput: (e) => { chosen.product = e.target.value; chipsEl?.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.textContent === chosen.product)); } });
      const chipsEl = prods.length ? chips(prods.slice(0, 8).map((p) => ({ value: p.name, label: p.name })), () => chosen.product, (v) => { chosen.product = v; name.value = v; }) : null;
      const qty = h('input', { type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: chosen.qty, oninput: (e) => { chosen.qty = e.target.value; } });
      const step = (d) => { qty.value = Math.max(0, (Number(qty.value) || 0) + d); chosen.qty = qty.value; };
      mount(detail, h('div', { class: 'lbl' }, tx('What did you buy?')), chipsEl, h('datalist', { id: 'q-prods' }, prods.map((p) => h('option', { value: p.name }))), h('div', { class: 'field' }, name),
        h('div', { class: 'lbl' }, tx('How many boxes / packs?')),
        h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': tx('Less'), onclick: () => step(-1) }, '−'), qty, h('button', { type: 'button', 'aria-label': tx('More'), onclick: () => step(1) }, '+')),
        h('div', { class: 'small muted', style: { marginTop: '8px' } }, tx('Enter the total you paid in the big box above.')));
      saveBtn.textContent = tx('Save purchase');
    }
  }

  function drawTypes() {
    mount(typeSeg, TYPES.map((t) => h('button', { type: 'button', class: 'qtype' + (type === t.id ? ' on' : ''), role: 'tab', 'aria-selected': type === t.id ? 'true' : 'false', onclick: () => { type = t.id; drawTypes(); drawDetail(); amount.focus({ preventScroll: true }); } },
      h('span', { class: 'dot' }, icon(t.icon)), h('span', { class: 't' }, t.label), h('span', { class: 's' }, t.sub))));
  }

  const form = h('form', { class: 'qform' }, typeSeg, amountBox, detail,
    h('div', { class: 'qactions' }, saveBtn, can('uploads.write') ? photoButton(date) : null));
  drawTypes(); drawDetail();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(saveBtn, async () => {
      const amt = amount.value.replace(/,/g, '').trim();
      if (!amt || !(Number(amt) > 0)) { amount.focus(); throw new Error(tx('Enter the amount first')); }
      if (type === 'collection') await api('/api/c/collections', { method: 'POST', body: { date, amount: amt, mode: chosen.mode, customer: chosen.mode === 'credit' ? chosen.customer : '', notes: '' } });
      else if (type === 'expense') {
        if (!chosen.category.trim()) throw new Error(tx('Tap what the expense was for'));
        await api('/api/c/expenses', { method: 'POST', body: { date, category: chosen.category.trim(), amount: amt, payment_mode: 'cash', notes: '' } });
        await refreshLists();
      } else {
        const name = chosen.product.trim(); if (!name) throw new Error(tx('Tell us which item you bought'));
        const p = state.products.find((x) => x.name.toLowerCase() === name.toLowerCase());
        await api('/api/c/purchases', { method: 'POST', body: { date, product_id: p?.id, product_name: name, qty: chosen.qty || 1, unit: p?.unit || 'box', pieces: null, total: amt, payment_mode: 'cash', supplier: '', notes: '' } });
        await refreshLists();
      }
      toast(tx('Saved ✓'));
      chosen = { mode: 'cash', category: '', product: '', qty: 1, customer: '' };
      navigate(`#/quick?date=${date}&type=${type}`);
    })();
  });

  // ----- today's entries so mistakes are easy to spot -----
  const recent = [
    ...data.collections.map((e) => ({ ic: 'rupee', t: e.mode === 'credit' ? 'Udhaar sale' : tx('Sale'), d: e.mode === 'credit' ? e.customer : e.mode.toUpperCase(), amt: e.amount_paise, id: e.id, kind: 'collections', sign: '+' })),
    ...data.purchases.map((e) => ({ ic: 'bag', t: e.product_name, d: `${num(e.qty_units)} ${e.unit}`, amt: e.total_cost_paise, id: e.id, kind: 'purchases', sign: '−' })),
    ...data.expenses.map((e) => ({ ic: 'receipt', t: e.category, d: tx('Expense'), amt: e.amount_paise, id: e.id, kind: 'expenses', sign: '−' })),
  ].sort((a, b) => rowOrder(b.id) - rowOrder(a.id)).slice(0, 6);
  const recentCard = recent.length ? h('div', { class: 'card' },
    h('div', { class: 'spread' }, h('h2', { style: { margin: 0 } }, isToday ? 'Added today' : tx('Added')), h('a', { href: `#/day?date=${date}`, class: 'small' }, getMode() === 'layman' ? 'See my day' : tx('Full day view'))),
    h('div', { class: 'list', style: { marginTop: '8px' } }, recent.map((r) => h('div', { class: 'li' }, h('div', { class: 'lead' }, icon(r.ic, 18)), h('div', { class: 'body' }, h('div', { class: 't' }, r.t), r.d ? h('div', { class: 'd' }, r.d) : null), h('div', { class: 'amt ' + (r.sign === '+' ? 'pos' : '') }, r.sign + money(r.amt)))))) : null;

  const tools = h('div', { class: 'qtools' },
    h('a', { class: 'qtool', href: '#/bill' }, h('span', { class: 'dot' }, icon('receipt', 22)), h('span', null, h('b', null, tx('Make a bill')), h('span', { class: 'd' }, tx('For a customer')))),
    h('a', { class: 'qtool', href: '#/bills' }, h('span', { class: 'dot' }, icon('clock', 22)), h('span', null, h('b', null, tx('Past bills')), h('span', { class: 'd' }, tx('Reprint, udhaar reminders')))),
    h('a', { class: 'qtool', href: '#/dump' }, h('span', { class: 'dot' }, icon('type', 22)), h('span', null, h('b', null, tx('Paste notes')), h('span', { class: 'd' }, tx('Many at once')))),
    h('a', { class: 'qtool', href: '#/notes' }, h('span', { class: 'dot' }, icon('book', 22)), h('span', null, h('b', null, tx('Notes')), h('span', { class: 'd' }, tx('Jot lines, auto total')))));
  mount(main, greeting, startCard(data, isToday), summary, form, tools, recentCard);
}

/** First-minute hint for new users: one slim line with three dots that tick off by themselves. Hidden once done or dismissed. */
function startCard(data, isToday) {
  const KEY = 'dk_start_done';
  try { if (localStorage.getItem(KEY)) return null; } catch { /* storage blocked: show it */ }
  if (!isToday) return null;
  const done = [data.collections.length > 0, data.purchases.length > 0, data.expenses.length > 0];
  const all = done.every(Boolean);
  const hide = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } card.remove(); };
  const card = h('div', { class: 'startcard' },
    h('div', { class: 'st-dots', 'aria-hidden': 'true' }, done.map((d) => h('i', { class: d ? 'on' : '' }))),
    h('div', { class: 'st-text' }, all ? 'Nice! You have added all three kinds of entry.' : h('span', null, h('b', null, 'New here? '), tx('Pick Sale, type the amount, tap Save.'))),
    h('button', { class: 'ghost small', type: 'button', onclick: hide }, all ? 'Done' : tx('Hide')));
  return card;
}

function photoButton(date) {
  const f = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  const b = h('button', { type: 'button', class: 'photobtn' }, icon('camera', 20), tx('Scan my handwritten hisaab'));
  b.addEventListener('click', () => f.click());
  f.addEventListener('change', busy(b, async () => {
    const file = f.files[0]; if (!file) return;
    const doc = await uploadDoc(file, 'hisaab', date);
    navigate(`#/uploads?review=${doc.id}`);
  }));
  return h('div', null, b, f);
}
