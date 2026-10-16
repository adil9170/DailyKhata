// Daily Entry: the simple everyday workflow — purchases, expenses, collection, closing stock and cash.
import { h, mount, money, num, cls, fmtDate, addDays, toast, busy, modal, confirmDialog, table, rupees, compressImage, badge, icon, iconBtn } from '../ui.js';
import { api, state, can, refreshLists, todayLocal, companyUrl, navigate } from '../api.js';
import { reviewEditor } from './review.js';

export async function dayPage(main, params) {
  const date = params.get('date') || state.today || todayLocal();
  const today = state.today || todayLocal();
  const go = (d) => navigate(`#/day?date=${d}`);
  const reload = () => go(date);

  const data = await api(`/api/c/day/${date}`);
  const rep = data.report;
  const W = can('entries.write'), DEL = can('entries.delete');

  // ---------- header with date navigation ----------
  const dateInput = h('input', { type: 'date', value: date, 'aria-label': 'Choose date', onchange: (e) => e.target.value && go(e.target.value) });
  const rel = date === today ? 'Today' : date === addDays(today, -1) ? 'Yesterday' : fmtDate(date, { weekday: 'long' });
  const header = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, rel), h('div', { class: 'sub' }, fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }))),
    h('div', { class: 'datebar' },
      iconBtn('left', 'Previous day', () => go(addDays(date, -1)), ''), dateInput, iconBtn('right', 'Next day', () => go(addDays(date, 1)), ''),
      date !== today ? h('button', { class: 'small', onclick: () => go(today) }, 'Today') : null));

  // ---------- hero: the one number that matters ----------
  const p = rep.profit;
  const profitPill = !p || p.status === 'no_activity' ? null
    : p.status === 'actual' ? h('span', { class: 'pill' }, icon('sparkles', 14), `Profit ${money(p.net)}`)
    : h('span', { class: 'pill' }, icon('info', 14), 'Count stock to see profit');
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'spread' }, h('div', { class: 'label' }, 'Collection'), profitPill),
    h('div', { class: 'big' }, money(rep.collections.total)),
    h('div', { class: 'stats' },
      h('div', null, h('div', { class: 'k' }, 'Purchases'), h('div', { class: 'v' }, money(rep.purchases.total))),
      h('div', null, h('div', { class: 'k' }, 'Expenses'), h('div', { class: 'v' }, money(rep.expenses.total))),
      h('div', null, h('div', { class: 'k' }, 'Net cash'), h('div', { class: 'v' }, money(rep.net_cash_flow, { sign: true })))));

  // ---------- step checklist ----------
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const needCount = rep.stock.products_needing_count;
  const steps = [
    { id: 'sec-purchases', ic: 'bag', t: 'Stock bought', d: data.purchases.length ? `${data.purchases.length} items · ${num(rep.purchases.pieces)} pieces` : 'Add what you purchased', amt: data.purchases.length ? money(rep.purchases.total) : null, done: data.purchases.length > 0, add: () => purchaseForm(date, null, reload) },
    { id: 'sec-expenses', ic: 'receipt', t: 'Expenses', d: data.expenses.length ? `${data.expenses.length} entries` : 'Gas, Wi-Fi, water…', amt: data.expenses.length ? money(rep.expenses.total) : null, done: data.expenses.length > 0, add: () => expenseForm(date, null, reload) },
    { id: 'sec-collections', ic: 'rupee', t: 'Collection', d: data.collections.length ? (rep.collections.credit ? `incl. ${money(rep.collections.credit)} udhaar` : 'Money from sales') : 'Add today’s sales money', amt: data.collections.length ? money(rep.collections.total) : null, done: data.collections.length > 0, add: () => collectionForm(date, null, reload) },
    { id: 'sec-stock', ic: 'box', t: 'Count stock left', d: needCount ? `${rep.stock.counted_products} of ${needCount} products counted` : 'Nothing in stock to count', amt: null, done: needCount > 0 && rep.stock.counted_products >= needCount },
    { id: 'sec-cash', ic: 'lock', t: 'Count cash & close day', d: rep.cash.counted === null ? 'Check cash in the drawer' : rep.cash.difference === null ? 'Counted' : rep.cash.difference === 0 ? 'Cash matches' : `${rep.cash.difference < 0 ? 'Short' : 'Excess'} ${money(Math.abs(rep.cash.difference))}`, amt: null, done: rep.cash.counted !== null },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const stepsCard = h('div', { class: 'card' },
    h('div', { class: 'spread', style: { marginBottom: '4px' } }, h('h2', { style: { margin: 0 } }, 'Close your day'), badge(`${doneCount}/5 done`, doneCount === 5 ? 'good' : '')),
    h('div', { class: 'steps' }, steps.map((s) => h('button', { class: 'step' + (s.done ? ' done' : ''), onclick: () => (!s.done && s.add && W ? s.add() : scrollTo(s.id)) },
      h('span', { class: 'dot' }, icon(s.done ? 'check' : s.ic)), h('span', null, h('span', { class: 't', style: { display: 'block' } }, s.t), h('span', { class: 'd', style: { display: 'block' } }, s.d)),
      s.amt ? h('span', { class: 'amt' }, s.amt) : h('span', { class: 'amt' }), h('span', { class: 'chev' }, icon(!s.done && s.add && W ? 'plus' : 'right', 18))))));

  const issues = rep.discrepancies.filter((d) => d.severity !== 'info').length || rep.discrepancies.length ? h('div', { class: 'card' }, h('h2', null, 'Checks'),
    rep.discrepancies.map((d) => h('div', { class: 'alert ' + d.severity }, icon(d.severity === 'info' ? 'info' : 'alert'), d.message))) : null;

  const quick = W ? quickEntryCard(date, reload) : null;
  const secHead = (ic, title, btn) => h('div', { class: 'sec-head' }, h('h2', null, h('span', { class: 'dot' }, icon(ic)), title), btn);
  const addBtn = (label, fn) => (W ? h('button', { class: 'small', onclick: fn }, icon('plus', 16), label) : null);

  // ---------- entry lists (tap a row to edit) ----------
  const initials = (t) => (t || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const li = ({ lead, title, sub, amt, amtSub, onEdit, kind, e }) => h('div', { class: 'li' + (W ? ' tap' : ''), onclick: W ? (ev) => { if (!ev.target.closest('button,a')) onEdit(); } : null, role: W ? 'button' : null, tabindex: W ? '0' : null,
      onkeydown: W ? (ev) => { if (ev.key === 'Enter') onEdit(); } : null },
    h('div', { class: 'lead' }, lead), h('div', { class: 'body' }, h('div', { class: 't' }, title), sub ? h('div', { class: 'd' }, sub) : null),
    h('div', { class: 'amt' }, amt, amtSub ? h('div', { class: 'd' }, amtSub) : null),
    DEL ? h('div', { class: 'acts' }, delBtn(kind, e)) : null);
  const list = (rows, empty, total) => h('div', null, h('div', { class: 'list' }, rows.length ? rows : h('div', { class: 'empty' }, empty)), rows.length && total ? total : null);
  const totalRow = (label, value, extra) => h('div', { class: 'li-total' }, h('span', null, label, extra ? h('span', { class: 'muted small' }, ` · ${extra}`) : null), h('span', null, value));
  const modeTxt = (m) => (m === 'credit' ? 'udhaar' : m === 'upi' ? 'UPI' : m);

  const purchasesCard = h('div', { class: 'card', id: 'sec-purchases' },
    secHead('bag', 'Stock bought', addBtn('Add', () => purchaseForm(date, null, reload))),
    list(data.purchases.map((e) => li({ kind: 'purchases', e, lead: initials(e.product_name), title: e.product_name,
      sub: `${num(e.qty_units)} ${e.unit} · ${num(e.pieces)} pcs · ${money(Math.round(e.cost_per_piece_paise))}/pc${e.payment_mode !== 'cash' ? ' · ' + modeTxt(e.payment_mode) : ''}${e.supplier ? ' · ' + e.supplier : ''}`,
      amt: money(e.total_cost_paise), onEdit: () => purchaseForm(date, e, reload) })), 'No purchases yet',
      totalRow('Total', money(rep.purchases.total), `${num(rep.purchases.units)} units · ${num(rep.purchases.pieces)} pcs`)));

  const expensesCard = h('div', { class: 'card', id: 'sec-expenses' },
    secHead('receipt', 'Expenses', addBtn('Add', () => expenseForm(date, null, reload))),
    list(data.expenses.map((e) => li({ kind: 'expenses', e, lead: icon('receipt', 18), title: e.category,
      sub: [modeTxt(e.payment_mode), e.notes].filter(Boolean).join(' · '),
      amt: money(e.amount_paise), amtSub: e.document_id ? h('a', { href: companyUrl(`/api/c/documents/${e.document_id}/file`), target: '_blank', rel: 'noopener' }, 'Receipt') : null,
      onEdit: () => expenseForm(date, e, reload) })), 'No expenses yet', totalRow('Total', money(rep.expenses.total))));

  const collectionsCard = h('div', { class: 'card', id: 'sec-collections' },
    secHead('rupee', 'Collection', addBtn('Add', () => collectionForm(date, null, reload))),
    list(data.collections.map((e) => li({ kind: 'collections', e, lead: icon(e.mode === 'credit' ? 'wallet' : 'rupee', 18), title: e.mode === 'credit' ? `Udhaar${e.customer ? ' — ' + e.customer : ''}` : `${modeTxt(e.mode).replace(/^./, (c) => c.toUpperCase())}${e.customer ? ' — ' + e.customer : ''}`,
      sub: e.notes || null, amt: money(e.amount_paise), onEdit: () => collectionForm(date, e, reload) })), 'No collection yet', totalRow('Total', money(rep.collections.total))));

  const stockCard = stockCountCard(date, rep, W, reload);
  const cashCard = cashCloseCard(date, rep, data.closing, can('cash.close'), reload);
  const profitCard = p && p.status === 'actual' ? h('div', { class: 'card' }, h('h2', null, 'Profit for the day'),
    h('div', { class: 'kv' }, h('div', null, 'Sales'), h('div', null, money(p.revenue)), h('div', null, '− Cost of stock sold'), h('div', null, money(p.cogs)),
      h('div', null, '− Expenses'), h('div', null, money(p.expenses)), h('div', { class: 'tot' }, 'Net profit'), h('div', { class: 'tot ' + cls(p.net) }, money(p.net)))) : null;

  mount(main, header, h('div', { class: 'grid g2' }, h('div', null, hero, issues), h('div', null, stepsCard)), quick,
    h('div', { class: 'grid g2' }, h('div', null, purchasesCard), h('div', null, expensesCard, collectionsCard)), stockCard, h('div', { class: 'grid g2' }, h('div', null, cashCard), h('div', null, profitCard)));

  // deep links from the "+" sheet
  const add = params.get('add');
  if (add && W) {
    history.replaceState(null, '', `#/day?date=${date}`);
    if (add === 'purchase') purchaseForm(date, null, reload);
    else if (add === 'expense') expenseForm(date, null, reload);
    else if (add === 'collection') collectionForm(date, null, reload);
    else if (add === 'text') { const ta = main.querySelector('textarea'); ta?.scrollIntoView({ behavior: 'smooth', block: 'center' }); ta?.focus(); }
  }

  function delBtn(kind, e) {
    return h('button', { class: 'ghost icon small danger', 'aria-label': 'Delete', title: 'Delete', onclick: async () => {
      if (!(await confirmDialog('Delete this entry? This is recorded in the audit log.'))) return;
      try { await api(`/api/c/${kind}/${e.id}`, { method: 'DELETE' }); toast('Deleted'); reload(); } catch (err) { toast(err.message, true); }
    } }, icon('trash', 18));
  }
}

function formFoot(kind, e, getModal, done, saveBtn) {
  const del = e && can('entries.delete') ? h('button', { type: 'button', class: 'ghost danger', onclick: async () => {
    if (!(await confirmDialog('Delete this entry? This is recorded in the audit log.'))) return;
    try { await api(`/api/c/${kind}/${e.id}`, { method: 'DELETE' }); getModal().close(); toast('Deleted'); done(); } catch (err) { toast(err.message, true); }
  } }, icon('trash', 17), 'Delete') : h('span');
  return h('div', { class: 'form-foot' }, del, saveBtn);
}

function modeBadge(m) { return badge(m === 'credit' ? 'udhaar' : m, m === 'credit' ? 'warn' : ''); }

function quickEntryCard(date, done) {
  const out = h('div');
  const ta = h('textarea', { placeholder: 'Type or paste your hisaab, one line each, e.g.\nSting 2 boxes 1020 60\nCampa Orange 1 box 240 30\nGas 820\nCollection 7544', 'aria-label': 'Hisaab text' });
  const readBtn = h('button', { class: 'primary' }, icon('sparkles', 18), 'Read entries');
  readBtn.addEventListener('click', busy(readBtn, async () => {
    if (!ta.value.trim()) return toast('Type some lines first', true);
    const parsed = await api('/api/c/parse', { method: 'POST', body: { text: ta.value, date } });
    if (!parsed.purchases.length && !parsed.expenses.length && !parsed.collections.length) return toast('Could not find any entries in this text', true);
    mount(out, h('div', { class: 'card tint', style: { marginTop: '14px' } }, h('h3', null, 'Check before saving'),
      reviewEditor({ parsed, date, onSaved: (d) => { ta.value = ''; navigate(`#/day?date=${d}`); }, onCancel: () => mount(out) })));
  }));
  const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  const photoBtn = h('button', { onclick: () => fileIn.click() }, icon('camera', 18), 'Scan photo');
  fileIn.addEventListener('change', busy(photoBtn, async () => {
    const f = fileIn.files[0]; if (!f) return;
    const doc = await uploadDoc(f, 'hisaab', date);
    location.hash = `#/uploads?review=${doc.id}`;
  }));
  return h('div', { class: 'card' },
    h('div', { class: 'sec-head' }, h('h2', null, h('span', { class: 'dot' }, icon('type')), 'Quick entry'), h('span', { class: 'small muted' }, 'Write it the way you write your register')),
    ta, h('div', { class: 'row', style: { marginTop: '8px' } }, readBtn, photoBtn, fileIn), out);
}

export async function uploadDoc(file, kind, date) {
  const f = await compressImage(file);
  const fd = new FormData(); fd.append('file', f); fd.append('kind', kind); if (date) fd.append('date', date);
  return api('/api/c/documents', { method: 'POST', form: fd });
}

function datalist(id, items) { return h('datalist', { id }, items.map((v) => h('option', { value: v }))); }

function purchaseForm(date, e, done) {
  const prods = state.products.filter((p) => p.active || p.id === e?.product_id);
  const byName = (n) => prods.find((p) => p.name.toLowerCase() === n.trim().toLowerCase());
  const item = h('input', { list: 'pf-products', required: true, value: e?.product_name ?? '', autocomplete: 'off' });
  const qty = h('input', { type: 'number', step: 'any', min: '0', value: e?.qty_units ?? 1, required: true });
  const unit = h('input', { value: e?.unit ?? 'box' });
  const pieces = h('input', { type: 'number', min: '0', value: e?.pieces ?? '' , placeholder: 'auto' });
  const total = h('input', { inputmode: 'decimal', required: true, value: e ? rupees(e.total_cost_paise) : '' });
  const mode = h('select', null, ['cash', 'bank', 'credit'].map((m) => h('option', { value: m, selected: (e?.payment_mode ?? 'cash') === m ? 'selected' : null }, m === 'credit' ? 'credit (udhaar)' : m)));
  const supplier = h('input', { value: e?.supplier ?? '', list: 'pf-sup' });
  const notes = h('input', { value: e?.notes ?? '' });
  const calc = h('div', { class: 'alert info' });
  const update = () => {
    const p = byName(item.value);
    if (p && document.activeElement === item) unit.value = p.unit;
    const q = Number(qty.value) || 0;
    const pcs = pieces.value !== '' ? Number(pieces.value) : p ? Math.round(q * p.pieces_per_unit) : null;
    const t = Number(total.value.replace(/,/g, '')) || 0;
    mount(calc, pcs ? `${num(pcs)} pieces · ${money(Math.round((t / pcs) * 100))} per piece · ${money(Math.round((t / (q || 1)) * 100))} per ${unit.value}` : 'Enter pieces to see per-piece cost', p ? '' : item.value ? ' · new product will be created' : '');
  };
  item.addEventListener('change', () => { const p = byName(item.value); if (p) { unit.value = p.unit; if (!total.value && p.default_unit_cost_paise) total.value = rupees(Math.round(p.default_unit_cost_paise * (Number(qty.value) || 1))); } update(); });
  [item, qty, pieces, total, unit].forEach((el) => el.addEventListener('input', update));
  const btn = h('button', { class: 'primary', type: 'submit' }, e ? 'Save changes' : 'Add purchase');
  const form = h('form', null, h('datalist', { id: 'pf-products' }, prods.map((p) => h('option', { value: p.name }))),
    h('div', { class: 'fields' }, lab('Item', item), lab('Quantity', qty), lab('Unit', unit), lab('Pieces', pieces), lab('Total cost ₹', total), lab('Paid by', mode), lab('Supplier', supplier), lab('Notes', notes)),
    calc, formFoot('purchases', e, () => m, done, btn));
  update();
  const m = modal(e ? 'Edit purchase' : 'Add purchase', form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(btn, async () => {
    const p = byName(item.value);
    const body = { date, product_id: p?.id, product_name: item.value.trim(), qty: qty.value, unit: unit.value, pieces: pieces.value === '' ? null : pieces.value, total: total.value, payment_mode: mode.value, supplier: supplier.value, notes: notes.value };
    await api(e ? `/api/c/purchases/${e.id}` : '/api/c/purchases', { method: e ? 'PUT' : 'POST', body });
    if (!p) await refreshLists();
    m.close(); toast('Saved'); done();
  })(); });
}

function expenseForm(date, e, done) {
  const cat = h('input', { list: 'ef-cats', required: true, value: e?.category ?? '' });
  const amount = h('input', { inputmode: 'decimal', required: true, value: e ? rupees(e.amount_paise) : '' });
  const mode = h('select', null, ['cash', 'bank', 'credit'].map((m) => h('option', { value: m, selected: (e?.payment_mode ?? 'cash') === m ? 'selected' : null }, m)));
  const notes = h('input', { value: e?.notes ?? '' });
  const d = h('input', { type: 'date', value: e?.entry_date ?? date });
  const photo = h('input', { type: 'file', accept: 'image/*,application/pdf' });
  const btn = h('button', { class: 'primary', type: 'submit' }, e ? 'Save changes' : 'Add expense');
  const form = h('form', null, datalist('ef-cats', state.categories.map((c) => c.name)),
    h('div', { class: 'fields' }, lab('Category', cat), lab('Amount ₹', amount), lab('Paid by', mode), lab('Date', d)), lab('Notes', notes),
    can('uploads.write') ? lab('Receipt photo (optional)', photo) : null, formFoot('expenses', e, () => m, done, btn));
  const m = modal(e ? 'Edit expense' : 'Add expense', form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(btn, async () => {
    let document_id = e?.document_id ?? null;
    if (photo.files?.[0]) document_id = (await uploadDoc(photo.files[0], 'receipt', d.value)).id;
    await api(e ? `/api/c/expenses/${e.id}` : '/api/c/expenses', { method: e ? 'PUT' : 'POST', body: { date: d.value, category: cat.value.trim(), amount: amount.value, payment_mode: mode.value, notes: notes.value, document_id } });
    await refreshLists(); m.close(); toast('Saved'); done();
  })(); });
}

function collectionForm(date, e, done) {
  const amount = h('input', { inputmode: 'decimal', required: true, value: e ? rupees(e.amount_paise) : '' });
  const mode = h('select', null, [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['credit', 'Udhaar (credit sale)']].map(([v, l]) => h('option', { value: v, selected: (e?.mode ?? 'cash') === v ? 'selected' : null }, l)));
  const customer = h('input', { value: e?.customer ?? '' });
  const notes = h('input', { value: e?.notes ?? '' });
  const btn = h('button', { class: 'primary', type: 'submit' }, e ? 'Save changes' : 'Add collection');
  const form = h('form', null, h('div', { class: 'fields' }, lab('Amount ₹', amount), lab('Mode', mode), lab('Customer', customer)), lab('Notes', notes),
    h('div', { class: 'small muted', style: { marginBottom: '10px' } }, 'Use “Udhaar” when goods were given on credit; record the money later under Udhaar / Outstanding.'),
    formFoot('collections', e, () => m, done, btn));
  const m = modal(e ? 'Edit collection' : 'Add collection', form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(btn, async () => {
    await api(e ? `/api/c/collections/${e.id}` : '/api/c/collections', { method: e ? 'PUT' : 'POST', body: { date, amount: amount.value, mode: mode.value, customer: customer.value, notes: notes.value } });
    m.close(); toast('Saved'); done();
  })(); });
}

function stockCountCard(date, rep, W, done) {
  const rows = rep.products || [];
  const all = state.products.filter((p) => p.active);
  const shown = new Map(rows.map((r) => [r.product_id, r]));
  // also allow counting products with no movement (e.g. opening stock)
  const extra = all.filter((p) => !shown.has(p.id));
  const inputs = new Map();
  const tr = (r) => {
    const inp = h('input', { type: 'number', inputmode: 'numeric', min: '0', value: r.counted ? r.closing : '', placeholder: String(r.closing), disabled: !W, 'aria-label': `Pieces left of ${r.name}` });
    inputs.set(r.product_id, inp);
    const sub = [`Had ${num(r.opening)}`, r.purchased ? `+${num(r.purchased)} bought` : null, `expect ${num(r.opening + r.purchased)}`].filter(Boolean).join(' · ');
    const sold = r.sold === null ? null : `Sold ${num(r.sold)}${r.cogs !== null ? ' · cost ' + money(r.cogs) : ''}`;
    return h('div', { class: 'li' }, h('div', { class: 'body' }, h('div', { class: 't' }, r.name), h('div', { class: 'd' }, sold ? h('span', { style: { color: 'var(--good)', fontWeight: 600 } }, sold + ' · ') : null, sub)), inp);
  };
  const extraSel = h('select', { style: { maxWidth: '260px' } }, h('option', { value: '' }, 'Count another product…'), extra.map((p) => h('option', { value: p.id }, p.name)));
  const tbody = h('div', { class: 'list' }, rows.map(tr));
  extraSel.addEventListener('change', () => {
    const p = extra.find((x) => String(x.id) === extraSel.value); if (!p) return;
    tbody.append(tr({ product_id: p.id, name: p.name, opening: 0, purchased: 0, closing: 0, counted: false, sold: null, cogs: null, stock_value: null }));
    extraSel.querySelector(`option[value="${p.id}"]`).remove(); extraSel.value = '';
  });
  const btn = h('button', { class: 'primary' }, 'Save stock count');
  btn.addEventListener('click', busy(btn, async () => {
    const counts = [...inputs].map(([product_id, inp]) => ({ product_id, closing_pieces: inp.value === '' ? null : Number(inp.value) }));
    await api(`/api/c/day/${date}/stock`, { method: 'PUT', body: { counts } });
    toast('Stock count saved'); done();
  }));
  const fillExpected = h('button', { class: 'small', onclick: () => { for (const inp of inputs.values()) if (inp.value === '') inp.value = inp.placeholder; } }, 'Fill expected');
  return h('div', { class: 'card', id: 'sec-stock' },
    h('div', { class: 'sec-head' }, h('div', null, h('h2', null, h('span', { class: 'dot' }, icon('box')), 'Stock left at closing'),
      h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'Enter pieces left on the shelf. We work out what was sold and your profit.')),
      badge(`${rep.stock.counted_products}/${rep.stock.products_needing_count} counted`, rep.stock.products_needing_count && rep.stock.counted_products >= rep.stock.products_needing_count ? 'good' : '')),
    rows.length || extra.length ? tbody : h('div', { class: 'empty' }, 'Add products or purchases first'),
    W ? h('div', { class: 'row', style: { marginTop: '12px' } }, extra.length ? extraSel : null, h('span', { class: 'grow' }), fillExpected, btn) : null);
}

function cashCloseCard(date, rep, closing, canClose, done) {
  const c = rep.cash;
  const opening = h('input', { inputmode: 'decimal', value: closing?.opening_cash_paise != null ? rupees(closing.opening_cash_paise) : '', placeholder: c.opening !== null && closing?.opening_cash_paise == null ? rupees(c.opening) + ' (carried forward)' : 'e.g. 2000' });
  const counted = h('input', { inputmode: 'decimal', value: closing ? rupees(closing.counted_cash_paise) : '' });
  const notes = h('input', { value: closing?.notes ?? '' });
  const btn = h('button', { class: 'primary' }, closing ? 'Update cash count' : 'Close day');
  btn.addEventListener('click', busy(btn, async () => {
    if (!counted.value) return toast('Enter the cash you counted', true);
    await api(`/api/c/day/${date}/closing`, { method: 'PUT', body: { opening_cash: opening.value === '' ? null : opening.value, counted_cash: counted.value, notes: notes.value } });
    toast('Cash closing saved'); done();
  }));
  return h('div', { class: 'card', id: 'sec-cash' },
    h('div', { class: 'sec-head' }, h('h2', null, h('span', { class: 'dot' }, icon('lock')), 'Cash in drawer')),
    h('div', { class: 'grid' },
      h('div', { class: 'kv' },
        h('div', null, 'Opening cash'), h('div', null, money(c.opening)),
        h('div', null, '+ Cash collected'), h('div', null, money(c.cash_in)),
        h('div', null, '− Cash paid out'), h('div', null, money(c.cash_out)),
        h('div', { class: 'tot' }, 'Expected in drawer'), h('div', { class: 'tot' }, money(c.expected)),
        h('div', null, 'Counted'), h('div', null, money(c.counted)),
        h('div', { class: 'tot' }, 'Difference'), h('div', { class: 'tot ' + cls(c.difference ?? 0) }, c.difference === null ? '—' : money(c.difference, { sign: true }))),
      canClose ? h('div', null,
        h('div', { class: 'fields' }, lab('Opening cash ₹', opening), lab('Cash counted now ₹', counted)), lab('Notes', notes),
        h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Leave opening empty to carry forward the previous counted cash. UPI/card/bank do not affect the drawer.'),
        btn) : null));
}

function lab(text, el) { return h('div', { class: 'field' }, h('label', null, text, el)); }
