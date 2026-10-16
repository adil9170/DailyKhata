// Daily Entry: the simple everyday workflow — purchases, expenses, collection, closing stock and cash.
import { h, mount, money, num, cls, fmtDate, addDays, toast, busy, modal, confirmDialog, tile, table, rupees, compressImage, badge } from '../ui.js';
import { api, state, can, refreshLists, todayLocal, companyUrl, navigate } from '../api.js';
import { reviewEditor } from './review.js';

export async function dayPage(main, params) {
  let date = params.get('date') || state.today || todayLocal();
  const root = h('div');
  mount(main, root);
  const go = (d) => navigate(`#/day?date=${d}`);

  const data = await api(`/api/c/day/${date}`);
  const rep = data.report;
  const W = can('entries.write'), DEL = can('entries.delete');

  // ---------- header ----------
  const dateInput = h('input', { type: 'date', value: date, onchange: (e) => e.target.value && go(e.target.value) });
  const header = h('div', { class: 'spread' },
    h('div', null, h('h1', null, 'Daily Entry'), h('div', { class: 'muted' }, fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
    h('div', { class: 'datebar' },
      h('button', { 'aria-label': 'Previous day', onclick: () => go(addDays(date, -1)) }, '‹'), dateInput,
      h('button', { 'aria-label': 'Next day', onclick: () => go(addDays(date, 1)) }, '›'),
      h('button', { onclick: () => go(state.today || todayLocal()) }, 'Today')));

  // ---------- summary ----------
  const p = rep.profit;
  const profitTile = !p ? null
    : p.status === 'actual' ? tile('Profit (actual)', h('span', { class: cls(p.net) }, money(p.net)), `Sales ${money(p.revenue)} − cost ${money(p.cogs)} − exp ${money(p.expenses)}`, 'hl')
    : p.status === 'no_activity' ? tile('Profit', '—', 'No entries yet')
    : tile('Profit', h('span', { class: 'muted', style: { fontSize: '1rem' } }, 'Count stock'), p.reason);
  const summary = h('div', { class: 'tiles' },
    tile('Purchases', money(rep.purchases.total), `${num(rep.purchases.pieces)} pcs · ${num(rep.purchases.units)} units`),
    tile('Expenses', money(rep.expenses.total)),
    tile('Collection', money(rep.collections.total), rep.collections.credit ? `incl. ${money(rep.collections.credit)} udhaar` : null),
    tile('Net cash flow', h('span', { class: cls(rep.net_cash_flow) }, money(rep.net_cash_flow)), 'Money in − money out (not profit)'),
    profitTile,
    tile('Cash difference', rep.cash.difference === null ? '—' : h('span', { class: cls(rep.cash.difference) }, money(rep.cash.difference, { sign: true })),
      rep.cash.difference === null ? 'Close the day to check cash' : rep.cash.difference < 0 ? 'Short' : rep.cash.difference > 0 ? 'Excess' : 'Matches'));

  const issues = rep.discrepancies.length ? h('div', { class: 'card' }, h('h3', null, 'Checks'),
    rep.discrepancies.map((d) => h('div', { class: 'alert ' + d.severity }, h('span', { class: 'ic' }, d.severity === 'info' ? 'i' : '!'), d.message))) : null;

  // ---------- quick entry ----------
  const quick = W ? quickEntryCard(date, () => go(date)) : null;

  // ---------- purchases ----------
  const pRows = data.purchases.map((e) => h('tr', null,
    h('td', null, e.product_name, e.supplier ? h('div', { class: 'small muted' }, e.supplier) : null),
    h('td', { class: 'num' }, `${num(e.qty_units)} ${e.unit}`), h('td', { class: 'num' }, num(e.pieces)),
    h('td', { class: 'num' }, money(e.total_cost_paise)), h('td', { class: 'num small' }, money(Math.round(e.cost_per_piece_paise))),
    h('td', null, modeBadge(e.payment_mode)), h('td', { class: 'right' }, rowActions('purchases', e, () => purchaseForm(date, e, () => go(date)), () => go(date)))));
  const purchasesCard = h('div', { class: 'card' },
    h('div', { class: 'sec-head' }, h('h2', { style: { margin: 0 } }, 'Purchases (stock bought)'), W ? h('button', { class: 'primary small', onclick: () => purchaseForm(date, null, () => go(date)) }, '+ Add purchase') : null),
    table(['Item', 'Qty', 'Pieces', 'Total', 'Per piece', 'Paid', ''], pRows, {
      empty: 'No purchases for this day',
      foot: data.purchases.length ? h('tr', null, h('td', null, 'Total'), h('td', { class: 'num' }, num(rep.purchases.units)), h('td', { class: 'num' }, num(rep.purchases.pieces)), h('td', { class: 'num' }, money(rep.purchases.total)), h('td', { colspan: 3 })) : null,
    }));

  // ---------- expenses ----------
  const eRows = data.expenses.map((e) => h('tr', null,
    h('td', null, e.category, e.notes ? h('div', { class: 'small muted' }, e.notes) : null), h('td', { class: 'num' }, money(e.amount_paise)), h('td', null, modeBadge(e.payment_mode)),
    h('td', null, e.document_id ? h('a', { href: companyUrl(`/api/c/documents/${e.document_id}/file`), target: '_blank', rel: 'noopener' }, 'Receipt') : ''),
    h('td', { class: 'right' }, rowActions('expenses', e, () => expenseForm(date, e, () => go(date)), () => go(date)))));
  const expensesCard = h('div', { class: 'card' },
    h('div', { class: 'sec-head' }, h('h2', { style: { margin: 0 } }, 'Expenses'), W ? h('button', { class: 'primary small', onclick: () => expenseForm(date, null, () => go(date)) }, '+ Add expense') : null),
    table(['Category', 'Amount', 'Paid', 'Receipt', ''], eRows, { empty: 'No expenses for this day',
      foot: data.expenses.length ? h('tr', null, h('td', null, 'Total'), h('td', { class: 'num' }, money(rep.expenses.total)), h('td', { colspan: 3 })) : null }));

  // ---------- collections ----------
  const cRows = data.collections.map((e) => h('tr', null,
    h('td', { class: 'num' }, money(e.amount_paise)), h('td', null, modeBadge(e.mode)), h('td', null, e.customer || '', e.notes ? h('div', { class: 'small muted' }, e.notes) : null),
    h('td', { class: 'right' }, rowActions('collections', e, () => collectionForm(date, e, () => go(date)), () => go(date)))));
  const collectionsCard = h('div', { class: 'card' },
    h('div', { class: 'sec-head' }, h('h2', { style: { margin: 0 } }, 'Collection (sales)'), W ? h('button', { class: 'primary small', onclick: () => collectionForm(date, null, () => go(date)) }, '+ Add collection') : null),
    table(['Amount', 'Mode', 'Customer / notes', ''], cRows, { empty: 'No collection for this day',
      foot: data.collections.length ? h('tr', null, h('td', { class: 'num' }, money(rep.collections.total)), h('td', { colspan: 3 }, 'Total')) : null }));

  // ---------- closing stock ----------
  const stockCard = stockCountCard(date, rep, W, () => go(date));
  const cashCard = cashCloseCard(date, rep, data.closing, can('cash.close'), () => go(date));

  mount(root, header, summary, issues, quick, h('div', { class: 'grid g2' }, h('div', null, purchasesCard), h('div', null, expensesCard, collectionsCard)), stockCard, cashCard);

  function rowActions(kind, e, onEdit, onDone) {
    return h('span', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
      W ? h('button', { class: 'small ghost', onclick: onEdit, 'aria-label': 'Edit' }, '✎') : null,
      DEL ? h('button', { class: 'small ghost danger', 'aria-label': 'Delete', onclick: async () => {
        if (!(await confirmDialog('Delete this entry? This is recorded in the audit log.'))) return;
        try { await api(`/api/c/${kind}/${e.id}`, { method: 'DELETE' }); toast('Deleted'); onDone(); } catch (err) { toast(err.message, true); }
      } }, '🗑') : null);
  }
}

function modeBadge(m) { return badge(m === 'credit' ? 'udhaar' : m, m === 'credit' ? 'warn' : ''); }

function quickEntryCard(date, done) {
  const out = h('div');
  const ta = h('textarea', { placeholder: 'Type or paste your hisaab, one line each, e.g.\nSting 2 boxes 1020 60\nCampa Orange 1 box 240 30\nGas 820\nCollection 7544', 'aria-label': 'Hisaab text' });
  const readBtn = h('button', { class: 'primary' }, 'Read entries');
  readBtn.addEventListener('click', busy(readBtn, async () => {
    if (!ta.value.trim()) return toast('Type some lines first', true);
    const parsed = await api('/api/c/parse', { method: 'POST', body: { text: ta.value, date } });
    if (!parsed.purchases.length && !parsed.expenses.length && !parsed.collections.length) return toast('Could not find any entries in this text', true);
    mount(out, h('div', { class: 'card', style: { background: 'var(--surface-2)' } }, h('h3', null, 'Check before saving'),
      reviewEditor({ parsed, date, onSaved: (d) => { ta.value = ''; navigate(`#/day?date=${d}`); }, onCancel: () => mount(out) })));
  }));
  const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  const photoBtn = h('button', { onclick: () => fileIn.click() }, '📷 Photo of hisaab');
  fileIn.addEventListener('change', busy(photoBtn, async () => {
    const f = fileIn.files[0]; if (!f) return;
    const doc = await uploadDoc(f, 'hisaab', date);
    location.hash = `#/uploads?review=${doc.id}`;
  }));
  return h('div', { class: 'card' },
    h('div', { class: 'sec-head' }, h('h2', { style: { margin: 0 } }, 'Quick entry'), h('span', { class: 'small muted' }, 'Write it the way you write your register')),
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
    calc, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn));
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
    can('uploads.write') ? lab('Receipt photo (optional)', photo) : null, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn));
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
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn));
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
    const inp = h('input', { type: 'number', min: '0', style: { width: '90px' }, value: r.counted ? r.closing : '', placeholder: String(r.closing), disabled: !W, 'aria-label': `Closing pieces for ${r.name}` });
    inputs.set(r.product_id, inp);
    return h('tr', null, h('td', null, r.name), h('td', { class: 'num' }, num(r.opening)), h('td', { class: 'num' }, num(r.purchased)),
      h('td', { class: 'num' }, num(r.opening + r.purchased)), h('td', null, inp),
      h('td', { class: 'num' }, r.sold === null ? '—' : num(r.sold)), h('td', { class: 'num small' }, r.cogs === null ? '—' : money(r.cogs)),
      h('td', { class: 'num small' }, r.stock_value === null ? '—' : money(r.stock_value)));
  };
  const extraSel = h('select', null, h('option', { value: '' }, 'Count another product…'), extra.map((p) => h('option', { value: p.id }, p.name)));
  const tbody = h('tbody', null, rows.map(tr));
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
  return h('div', { class: 'card' },
    h('div', { class: 'sec-head' }, h('div', null, h('h2', { style: { margin: 0 } }, 'Closing stock count'),
      h('div', { class: 'small muted' }, 'Count pieces left at the end of the day. Sold = opening + bought − counted. Needed for actual profit.')),
      h('span', null, `${rep.stock.counted_products}/${rep.stock.products_needing_count} counted`)),
    h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Item', 'Opening', 'Bought', 'Expected', 'Counted', 'Sold', 'Cost of sold', 'Stock value'].map((t) => h('th', null, t)))),
      rows.length || extra.length ? tbody : h('tbody', null, h('tr', null, h('td', { colspan: 8, class: 'empty' }, 'Add products or purchases first'))))),
    W ? h('div', { class: 'row', style: { marginTop: '10px' } }, extra.length ? extraSel : null, h('span', { class: 'grow' }), fillExpected, btn) : null);
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
  return h('div', { class: 'card' },
    h('h2', null, 'Cash in drawer'),
    h('div', { class: 'grid g2' },
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
