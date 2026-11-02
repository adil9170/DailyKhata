// Daily Entry: the simple everyday workflow — purchases, expenses, collection, closing stock and cash.
import { countUp, h, mount, money, num, cls, fmtDate, addDays, toast, busy, modal, confirmDialog, table, rupees, compressImage, badge, icon, iconBtn } from '../ui.js';
import { api, state, can, refreshLists, todayLocal, companyUrl, navigate } from '../api.js';
import { reviewEditor } from './review.js';
import { t as tx } from '../i18n.js';

export async function dayPage(main, params) {
  const date = params.get('date') || state.today || todayLocal();
  const today = state.today || todayLocal();
  const go = (d) => navigate(`#/day?date=${d}`);
  const reload = () => go(date);

  const data = await api(`/api/c/day/${date}`);
  const rep = data.report;
  const W = can('entries.write'), DEL = can('entries.delete');

  // ---------- header with date navigation ----------
  const dateInput = h('input', { type: 'date', value: date, 'aria-label': tx('Choose date'), class: 'datepick', onchange: (e) => e.target.value && go(e.target.value) });
  const rel = date === today ? tx('Today') : date === addDays(today, -1) ? tx('Yesterday') : fmtDate(date, { weekday: 'long' });
  const header = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, rel), h('div', { class: 'sub' }, fmtDate(date, { day: 'numeric', month: 'long', year: 'numeric' }))),
    h('div', { class: 'datebar' },
      iconBtn('left', tx('Previous day'), () => go(addDays(date, -1)), ''), h('label', { class: 'datechip' }, icon('clock', 15), fmtDate(date, { day: 'numeric', month: 'short' }), dateInput), iconBtn('right', tx('Next day'), () => go(addDays(date, 1)), ''),
      date !== today ? h('button', { class: 'small', onclick: () => go(today) }, tx('Today')) : null));

  // ---------- hero: the one number that matters ----------
  const p = rep.profit;
  const hasProfit = p && p.status === 'actual';
  const hero = h('div', { class: 'daysum' },
    h('div', null, h('div', { class: 'k' }, tx('Sales')), h('div', { class: 'v pos' }, money(rep.collections.total))),
    h('div', null, h('div', { class: 'k' }, tx('Spent')), h('div', { class: 'v' }, money(rep.purchases.total + rep.expenses.total))),
    h('div', null, h('div', { class: 'k' }, hasProfit ? 'Profit' : tx('Cash left')), h('div', { class: 'v ' + cls(hasProfit ? p.net : rep.net_cash_flow) }, money(hasProfit ? p.net : rep.net_cash_flow))));

  const issues = rep.discrepancies.filter((d) => d.severity !== 'info').length || rep.discrepancies.length ? h('div', { class: 'card smart-up' }, h('h2', null, tx('Checks')),
    rep.discrepancies.map((d) => h('div', { class: 'alert ' + d.severity }, icon(d.severity === 'info' ? 'info' : 'alert'), d.message))) : null;

  const pasteLink = W ? h('a', { class: 'pastelink', href: '#/dump' }, icon('type', 18), h('span', null, h('b', null, tx('Write or paste notes')), h('span', { class: 'muted' }, tx(' — add many entries at once'))), icon('right', 16)) : null;
  const addBtn = (label, fn) => (W ? h('button', { class: 'small', onclick: fn }, icon('plus', 16), label) : null);

  // ---------- the strip: today's khata as a printed slip (tap a line to edit) ----------
  const modeTxt = (m) => (m === 'credit' ? 'udhaar' : m === 'upi' ? 'UPI' : m);
  const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
  const lines = [
    ...data.collections.map((e) => ({ kind: 'collections', e, dir: e.mode === 'credit' ? 'ud' : 'in', amt: e.amount_paise, sign: '+',
      name: e.mode === 'credit' ? `${tx('Udhaar')}${e.customer ? ' — ' + e.customer : ''}` : `${tx(cap(modeTxt(e.mode)))}${e.customer ? ' — ' + e.customer : ''}`,
      sub: e.notes || '', edit: () => collectionForm(date, e, reload) })),
    ...data.expenses.map((e) => ({ kind: 'expenses', e, dir: e.payment_mode === 'credit' ? 'ud' : 'out', amt: e.amount_paise, sign: '−',
      name: e.category, sub: [e.payment_mode !== 'cash' ? modeTxt(e.payment_mode) : '', e.notes].filter(Boolean).join(' · '),
      doc: e.document_id, edit: () => expenseForm(date, e, reload) })),
    ...data.purchases.map((e) => ({ kind: 'purchases', e, dir: e.payment_mode === 'credit' ? 'ud' : 'out', amt: e.total_cost_paise, sign: '−',
      name: e.product_name, sub: `${num(e.qty_units)} ${e.unit}${e.payment_mode !== 'cash' ? ' · ' + modeTxt(e.payment_mode) : ''}${e.supplier ? ' · ' + e.supplier : ''}`,
      edit: () => purchaseForm(date, e, reload) })),
  ].sort((a, b) => String(a.e.created_at || '').localeCompare(String(b.e.created_at || '')) || (a.e.id > b.e.id) - (a.e.id < b.e.id));
  // one row: the name … amount part is the edit button; receipt and delete sit beside it (not nested inside it)
  const stripLine = (l, i) => {
    const body = [h('span', { class: 'n' }, l.name, l.sub ? h('span', { class: 'sub' }, l.sub) : null), h('span', { class: 'dots', 'aria-hidden': 'true' }), h('b', null, `${l.sign}${money(l.amt)}`)];
    return h('li', { class: `sl ${l.dir}` + (i < 30 ? ' anim' : ''), style: i < 30 ? { animationDelay: `${i * 25}ms` } : null },
      W ? h('button', { type: 'button', class: 'slbtn', 'aria-label': `${tx('Edit')} ${l.name} ${money(l.amt)}`, onclick: () => l.edit() }, body) : body,
      l.doc ? h('a', { class: 'rc', href: companyUrl(`/api/c/documents/${l.doc}/file`), target: '_blank', rel: 'noopener' }, tx('Receipt')) : null,
      DEL ? delBtn(l.kind, l.e) : null);
  };
  const outTotal = rep.purchases.total + rep.expenses.total;
  const stripCard = h('section', { class: 'strip', id: 'sec-strip', 'aria-label': tx('Day strip') },
    h('div', { class: 'strip-top' }, h('b', null, tx('KHATA')), h('span', null, fmtDate(date, { day: 'numeric', month: 'short' }))),
    h('ul', { class: 'strip-lines' }, lines.length ? lines.map(stripLine) : h('li', { class: 'sl empty' }, W ? 'Nothing written yet. Tap + Sale to start the strip.' : tx('Nothing written yet.'))),
    h('div', { class: 'strip-sum' },
      h('div', null, h('span', null, 'In'), h('b', { class: 'pos' }, money(rep.collections.total))),
      h('div', null, h('span', null, tx('Out')), h('b', null, money(outTotal))),
      h('div', null, h('span', null, tx('Cash in drawer')), h('b', null, rep.cash.expected === null ? '—' : money(rep.cash.expected)))),
    W ? h('div', { class: 'strip-add' }, addBtn(tx('Sale'), () => collectionForm(date, null, reload)), addBtn(tx('Expense'), () => expenseForm(date, null, reload)), addBtn(tx('Stock bought'), () => purchaseForm(date, null, reload))) : null);
  const stockCard = stockCountCard(date, rep, W, reload);
  const cashCard = cashCloseCard(date, rep, data.closing, can('cash.close'), reload);
  const profitCard = p && p.status === 'actual' ? h('div', { class: 'card smart-up' }, h('h2', null, tx('Profit for the day')),
    h('div', { class: 'kv' }, h('div', null, tx('Sales')), h('div', null, money(p.revenue)), h('div', null, '− Cost of stock sold'), h('div', null, money(p.cogs)),
      h('div', null, '− Expenses'), h('div', null, money(p.expenses)), h('div', { class: 'tot' }, tx('Net profit')), h('div', { class: 'tot ' + cls(p.net) }, money(p.net)))) : null;

  const closeHead = h('div', { class: 'closehead smart-up' }, h('h2', null, tx('Close the day')), h('div', { class: 'small muted' }, 'At night: count the stock left and the cash in the drawer. The strip tells you if the books match.'));
  mount(main, header, hero, pasteLink, issues,
    stripCard,
    closeHead, stockCard, h('div', { class: 'grid g2' }, h('div', null, cashCard), h('div', null, profitCard)));


  // deep links from the "+" sheet
  const add = params.get('add');
  if (add && W) {
    history.replaceState(null, '', `#/day?date=${date}`);
    if (add === 'purchase') purchaseForm(date, null, reload);
    else if (add === 'expense') expenseForm(date, null, reload);
    else if (add === 'collection') collectionForm(date, null, reload);
    else if (add === 'text') navigate('#/dump');
  }

  function delBtn(kind, e) {
    return h('button', { class: 'ghost icon small danger', 'aria-label': tx('Delete'), title: tx('Delete'), onclick: async () => {
      if (!(await confirmDialog(tx('Delete this entry? This is recorded in the audit log.')))) return;
      try { await api(`/api/c/${kind}/${e.id}`, { method: 'DELETE' }); toast(tx('Deleted')); reload(); } catch (err) { toast(err.message, true); }
    } }, icon('trash', 18));
  }
}

function formFoot(kind, e, getModal, done, saveBtn) {
  const del = e && can('entries.delete') ? h('button', { type: 'button', class: 'ghost danger', onclick: async () => {
    if (!(await confirmDialog(tx('Delete this entry? This is recorded in the audit log.')))) return;
    try { await api(`/api/c/${kind}/${e.id}`, { method: 'DELETE' }); getModal().close(); toast(tx('Deleted')); done(); } catch (err) { toast(err.message, true); }
  } }, icon('trash', 17), tx('Delete')) : h('span');
  return h('div', { class: 'form-foot' }, del, saveBtn);
}

function modeBadge(m) { return badge(m === 'credit' ? 'udhaar' : m, m === 'credit' ? 'warn' : ''); }

function quickEntryCard(date, done) {
  const out = h('div');
  const ta = h('textarea', { placeholder: 'Type or paste your hisaab, one line each, e.g.\nSting 2 boxes 1020 60\nCampa Orange 1 box 240 30\nGas 820\nCollection 7544', 'aria-label': tx('Hisaab text') });
  const readBtn = h('button', { class: 'primary' }, icon('sparkles', 18), tx('Read entries'));
  readBtn.addEventListener('click', busy(readBtn, async () => {
    if (!ta.value.trim()) return toast('Type some lines first', true);
    const parsed = await api('/api/c/parse', { method: 'POST', body: { text: ta.value, date } });
    if (!parsed.purchases.length && !parsed.expenses.length && !parsed.collections.length) return toast('Could not find any entries in this text', true);
    mount(out, h('div', { class: 'card tint', style: { marginTop: '12px' } }, h('h3', null, 'Check before saving'),
      reviewEditor({ parsed, date, onSaved: (d) => { ta.value = ''; navigate(`#/day?date=${d}`); }, onCancel: () => mount(out) })));
  }));
  const fileIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  const photoBtn = h('button', { onclick: () => fileIn.click() }, icon('camera', 18), tx('Scan photo'));
  fileIn.addEventListener('change', busy(photoBtn, async () => {
    const f = fileIn.files[0]; if (!f) return;
    const doc = await uploadDoc(f, 'hisaab', date);
    location.hash = `#/uploads?review=${doc.id}`;
  }));
  return h('div', { class: 'card smart-up' },
    h('div', { class: 'sec-head' }, h('h2', null, h('span', { class: 'dot' }, icon('type')), tx('Type or paste hisaab')), h('span', { class: 'small muted' }, 'Write it the way you write your register')),
    ta, h('div', { class: 'row', style: { marginTop: '8px' } }, readBtn, photoBtn, fileIn), out);
}

export async function uploadDoc(file, kind, date) {
  const f = await compressImage(file);
  const fd = new FormData(); fd.append('file', f); fd.append('kind', kind); if (date) fd.append('date', date);
  return api('/api/c/documents', { method: 'POST', form: fd });
}

function datalist(id, items) { return h('datalist', { id }, items.map((v) => h('option', { value: v }))); }

export function purchaseForm(date, e, done) {
  const prods = state.products.filter((p) => p.active || p.id === e?.product_id);
  const byName = (n) => prods.find((p) => p.name.toLowerCase() === n.trim().toLowerCase());
  const item = h('input', { list: 'pf-products', required: true, value: e?.product_name ?? '', autocomplete: 'off' });
  const qty = h('input', { type: 'number', step: 'any', min: '0', value: e?.qty_units ?? 1, required: true });
  const unit = h('input', { value: e?.unit ?? 'box' });
  const pieces = h('input', { type: 'number', min: '0', value: e?.pieces ?? '' , placeholder: 'auto' });
  const total = h('input', { inputmode: 'decimal', required: true, value: e ? rupees(e.total_cost_paise) : '' });
  const mode = h('select', null, [['cash', tx('Cash')], ['bank', tx('Bank')], ['credit', tx('Udhaar (credit)')]].map(([m, l]) => h('option', { value: m, selected: (e?.payment_mode ?? 'cash') === m ? 'selected' : null }, l)));
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
  const btn = h('button', { class: 'primary', type: 'submit' }, e ? 'Save changes' : tx('Add purchase'));
  const form = h('form', null, h('datalist', { id: 'pf-products' }, prods.map((p) => h('option', { value: p.name }))),
    h('div', { class: 'fields' }, lab(tx('Item'), item), lab(tx('Quantity'), qty), lab(tx('Unit'), unit), lab('Pieces', pieces), lab(tx('Total cost ₹'), total), lab(tx('Paid by'), mode), lab(tx('Supplier'), supplier), lab(tx('Notes'), notes)),
    calc, formFoot('purchases', e, () => m, done, btn));
  update();
  const m = modal(e ? tx('Edit stock bought') : tx('Add stock bought'), form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(btn, async () => {
    const p = byName(item.value);
    const body = { date, product_id: p?.id, product_name: item.value.trim(), qty: qty.value, unit: unit.value, pieces: pieces.value === '' ? null : pieces.value, total: total.value, payment_mode: mode.value, supplier: supplier.value, notes: notes.value };
    await api(e ? `/api/c/purchases/${e.id}` : '/api/c/purchases', { method: e ? 'PUT' : 'POST', body });
    if (!p) await refreshLists();
    m.close(); toast(tx('Saved')); done();
  })(); });
}

export function expenseForm(date, e, done) {
  const cat = h('input', { list: 'ef-cats', required: true, value: e?.category ?? '' });
  const amount = h('input', { inputmode: 'decimal', required: true, value: e ? rupees(e.amount_paise) : '' });
  const mode = h('select', null, [['cash', tx('Cash')], ['bank', tx('Bank')], ['credit', tx('Udhaar (credit)')]].map(([m, l]) => h('option', { value: m, selected: (e?.payment_mode ?? 'cash') === m ? 'selected' : null }, l)));
  const notes = h('input', { value: e?.notes ?? '' });
  const d = h('input', { type: 'date', value: e?.entry_date ?? date });
  const photo = h('input', { type: 'file', accept: 'image/*,application/pdf' });
  const btn = h('button', { class: 'primary', type: 'submit' }, e ? 'Save changes' : tx('Add expense'));
  const form = h('form', null, datalist('ef-cats', state.categories.map((c) => c.name)),
    h('div', { class: 'fields' }, lab(tx('Category'), cat), lab(tx('Amount ₹'), amount), lab(tx('Paid by'), mode), lab(tx('Date'), d)), lab(tx('Notes'), notes),
    can('uploads.write') ? lab('Receipt photo (optional)', photo) : null, formFoot('expenses', e, () => m, done, btn));
  const m = modal(e ? tx('Edit expense') : tx('Add expense'), form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(btn, async () => {
    let document_id = e?.document_id ?? null;
    if (photo.files?.[0]) document_id = (await uploadDoc(photo.files[0], 'receipt', d.value)).id;
    await api(e ? `/api/c/expenses/${e.id}` : '/api/c/expenses', { method: e ? 'PUT' : 'POST', body: { date: d.value, category: cat.value.trim(), amount: amount.value, payment_mode: mode.value, notes: notes.value, document_id } });
    await refreshLists(); m.close(); toast(tx('Saved')); done();
  })(); });
}

export function collectionForm(date, e, done) {
  const amount = h('input', { inputmode: 'decimal', required: true, value: e ? rupees(e.amount_paise) : '' });
  const mode = h('select', null, [['cash', tx('Cash')], ['upi', tx('UPI')], ['card', tx('Card')], ['credit', tx('Udhaar (credit sale)')]].map(([v, l]) => h('option', { value: v, selected: (e?.mode ?? 'cash') === v ? 'selected' : null }, l)));
  const customer = h('input', { value: e?.customer ?? '' });
  const notes = h('input', { value: e?.notes ?? '' });
  const btn = h('button', { class: 'primary', type: 'submit' }, e ? tx('Save changes') : tx('Add sale'));
  const form = h('form', null, h('div', { class: 'fields' }, lab(tx('Amount ₹'), amount), lab(tx('Mode'), mode), lab(tx('Customer'), customer)), lab(tx('Notes'), notes),
    h('div', { class: 'small muted', style: { marginBottom: '12px' } }, 'Use “Udhaar” when goods were given on credit; record the money later under Udhaar / Outstanding.'),
    formFoot('collections', e, () => m, done, btn));
  const m = modal(e ? tx('Edit sale') : tx('Add sale'), form);
  form.addEventListener('submit', (ev) => { ev.preventDefault(); busy(btn, async () => {
    await api(e ? `/api/c/collections/${e.id}` : '/api/c/collections', { method: e ? 'PUT' : 'POST', body: { date, amount: amount.value, mode: mode.value, customer: customer.value, notes: notes.value } });
    m.close(); toast(tx('Saved')); done();
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
  return h('div', { class: 'card smart-up', id: 'sec-stock' },
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
  const btn = h('button', { class: 'primary' }, closing ? 'Update cash count' : tx('Close day'));
  btn.addEventListener('click', busy(btn, async () => {
    if (!counted.value) return toast(tx('Enter the cash you counted'), true);
    await api(`/api/c/day/${date}/closing`, { method: 'PUT', body: { opening_cash: opening.value === '' ? null : opening.value, counted_cash: counted.value, notes: notes.value } });
    toast(tx('Cash closing saved')); done();
  }));
  return h('div', { class: 'card smart-up', id: 'sec-cash' },
    h('div', { class: 'sec-head' }, h('h2', null, h('span', { class: 'dot' }, icon('lock')), tx('Cash in drawer'))),
    h('div', { class: 'grid' },
      tallyResult(c),
      h('div', { class: 'kv' },
        h('div', null, tx('Opening cash')), h('div', null, money(c.opening)),
        h('div', null, '+ Cash collected'), h('div', null, money(c.cash_in)),
        h('div', null, '− Cash paid out'), h('div', null, money(c.cash_out)),
        h('div', { class: 'tot' }, tx('Expected in drawer')), h('div', { class: 'tot' }, money(c.expected)),
        h('div', null, tx('Counted')), h('div', null, money(c.counted)),
        h('div', { class: 'tot' }, tx('Difference')), h('div', { class: 'tot ' + cls(c.difference ?? 0) }, c.difference === null ? '—' : money(c.difference, { sign: true }))),
      canClose ? h('div', null,
        h('div', { class: 'fields' }, lab(tx('Opening cash ₹'), opening), lab(tx('Cash counted now ₹'), counted)), lab(tx('Notes'), notes),
        h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Leave opening empty to carry forward the previous counted cash. UPI/card/bank do not affect the drawer.'),
        btn) : null));
}

// the tally moment: calm when it matches, plain when it does not
function tallyResult(c) {
  if (c.difference === null || c.difference === undefined) return null;
  const ok = c.difference === 0;
  return h('div', { class: 'tally ' + (ok ? 'ok' : 'off'), role: 'status' }, ok ? 'Books match ✓' : c.difference < 0 ? tx('Short by ') + money(-c.difference) : tx('Over by ') + money(c.difference),
    h('span', null, tx('Expected ') + money(c.expected) + ' · Counted ' + money(c.counted)));
}

function lab(text, el) { return h('div', { class: 'field' }, h('label', null, text, el)); }
