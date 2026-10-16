// Editable review table for entries extracted from text or a photo. Nothing is saved until the user confirms.
import { h, mount, money, toast, busy, icon } from '../ui.js';
import { api, state } from '../api.js';

export function reviewEditor({ parsed, date, documentId = null, onSaved, onCancel }) {
  const data = {
    date: parsed.date || date,
    purchases: (parsed.purchases || []).map((p) => ({ item: p.item, qty: p.qty ?? 1, unit: p.unit || 'box', pieces: p.pieces ?? '', total: p.total ?? '', payment_mode: 'cash' })),
    expenses: (parsed.expenses || []).map((e) => ({ category: e.category, amount: e.amount ?? '', payment_mode: 'cash', notes: '' })),
    collections: (parsed.collections || []).map((c) => ({ amount: c.amount ?? '', mode: c.mode || 'cash', customer: '' })),
  };
  const root = h('div');
  const productList = h('datalist', { id: 'rv-products' }, state.products.filter((p) => p.active).map((p) => h('option', { value: p.name })));
  const catList = h('datalist', { id: 'rv-cats' }, state.categories.map((c) => h('option', { value: c.name })));

  const cell = (row, key, { oninput, ...attrs } = {}) => h('input', { value: row[key] ?? '', ...attrs, oninput: (e) => { row[key] = e.target.value; oninput?.(e); renderTotals(); } });
  const sel = (row, key, opts) => h('select', { onchange: (e) => { row[key] = e.target.value; } }, opts.map((o) => h('option', { value: o, selected: row[key] === o ? 'selected' : null }, o)));
  const rm = (list, i) => h('button', { class: 'ghost icon small danger', 'aria-label': 'Remove row', title: 'Remove', onclick: () => { list.splice(i, 1); render(); } }, icon('x', 16));
  const totals = h('div', { class: 'kv', style: { maxWidth: '360px', marginLeft: 'auto' } });

  function renderTotals() {
    const sum = (l, k) => l.reduce((s, r) => s + (Number(String(r[k]).replace(/,/g, '')) || 0), 0);
    const p = sum(data.purchases, 'total'), e = sum(data.expenses, 'amount'), c = sum(data.collections, 'amount');
    mount(totals, h('div', null, 'Purchases'), h('div', null, money(p * 100)), h('div', null, 'Expenses'), h('div', null, money(e * 100)),
      h('div', null, 'Collection'), h('div', null, money(c * 100)), h('div', { class: 'tot' }, 'Net cash'), h('div', { class: 'tot' }, money((c - p - e) * 100)));
  }

  function render() {
    const dateInput = h('input', { type: 'date', value: data.date, onchange: (e) => { data.date = e.target.value; } });
    const pRows = data.purchases.map((r, i) => {
      const per = h('td', { class: 'num small muted' });
      const upd = () => { const pcs = Number(r.pieces), t = Number(String(r.total).replace(/,/g, '')); per.textContent = pcs > 0 && t > 0 ? money(Math.round((t / pcs) * 100)) : '—'; };
      const tr = h('tr', null,
        h('td', null, cell(r, 'item', { list: 'rv-products', style: { minWidth: '130px' } })),
        h('td', null, cell(r, 'qty', { type: 'number', step: 'any', min: 0, style: { width: '70px' } })),
        h('td', null, cell(r, 'unit', { style: { width: '74px' } })),
        h('td', null, cell(r, 'pieces', { type: 'number', min: 0, style: { width: '80px' }, oninput: upd })),
        h('td', null, cell(r, 'total', { inputmode: 'decimal', style: { width: '96px' }, oninput: upd })),
        per,
        h('td', null, sel(r, 'payment_mode', ['cash', 'bank', 'credit'])),
        h('td', null, rm(data.purchases, i)));
      upd();
      return tr;
    });
    mount(root, productList, catList,
      h('div', { class: 'field', style: { maxWidth: '220px' } }, h('label', null, 'Date of these entries', dateInput)),
      h('h3', null, `Purchases (${data.purchases.length})`),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Item', 'Qty', 'Unit', 'Pieces', 'Total ₹', 'Per piece', 'Paid by', ''].map((t) => h('th', null, t)))),
        h('tbody', null, pRows))),
      h('button', { class: 'small', onclick: () => { data.purchases.push({ item: '', qty: 1, unit: 'box', pieces: '', total: '', payment_mode: 'cash' }); render(); } }, icon('plus', 17), 'Add purchase row'),
      h('h3', { style: { marginTop: '16px' } }, `Expenses (${data.expenses.length})`),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Category', 'Amount ₹', 'Paid by', 'Notes', ''].map((t) => h('th', null, t)))),
        h('tbody', null, data.expenses.map((r, i) => h('tr', null,
          h('td', null, cell(r, 'category', { list: 'rv-cats' })), h('td', null, cell(r, 'amount', { inputmode: 'decimal', style: { width: '110px' } })),
          h('td', null, sel(r, 'payment_mode', ['cash', 'bank', 'credit'])), h('td', null, cell(r, 'notes')), h('td', null, rm(data.expenses, i))))))),
      h('button', { class: 'small', onclick: () => { data.expenses.push({ category: '', amount: '', payment_mode: 'cash', notes: '' }); render(); } }, icon('plus', 17), 'Add expense row'),
      h('h3', { style: { marginTop: '16px' } }, `Collections (${data.collections.length})`),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Amount ₹', 'Mode', 'Customer (for udhaar)', ''].map((t) => h('th', null, t)))),
        h('tbody', null, data.collections.map((r, i) => h('tr', null,
          h('td', null, cell(r, 'amount', { inputmode: 'decimal', style: { width: '120px' } })), h('td', null, sel(r, 'mode', ['cash', 'upi', 'card', 'credit'])),
          h('td', null, cell(r, 'customer')), h('td', null, rm(data.collections, i))))))),
      h('button', { class: 'small', onclick: () => { data.collections.push({ amount: '', mode: 'cash', customer: '' }); render(); } }, icon('plus', 17), 'Add collection row'),
      parsed.unparsed?.length ? h('div', { class: 'alert warning', style: { marginTop: '12px' } }, h('span', { class: 'ic' }, '!'),
        h('div', null, h('strong', null, 'Could not understand these lines — add them manually if needed:'), h('ul', { style: { margin: '4px 0 0', paddingLeft: '18px' } }, parsed.unparsed.map((l) => h('li', null, l))))) : null,
      h('div', { style: { marginTop: '12px' } }, totals),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } },
        onCancel ? h('button', { onclick: onCancel }, 'Cancel') : null, saveBtn));
    renderTotals();
  }
  const saveBtn = h('button', { class: 'primary' }, 'Confirm & save');
  saveBtn.addEventListener('click', busy(saveBtn, async () => {
    const clean = (s) => String(s ?? '').replace(/,/g, '').trim();
    const body = {
      date: data.date, document_id: documentId,
      purchases: data.purchases.filter((r) => r.item.trim() && clean(r.total)).map((r) => ({ item: r.item.trim(), product_name: r.item.trim(), qty: Number(r.qty) || 1, unit: r.unit, pieces: clean(r.pieces) === '' ? null : Number(r.pieces), total: clean(r.total), payment_mode: r.payment_mode })),
      expenses: data.expenses.filter((r) => r.category.trim() && clean(r.amount)).map((r) => ({ category: r.category.trim(), amount: clean(r.amount), payment_mode: r.payment_mode, notes: r.notes })),
      collections: data.collections.filter((r) => clean(r.amount)).map((r) => ({ amount: clean(r.amount), mode: r.mode, customer: r.customer })),
    };
    const res = await api('/api/c/bulk', { method: 'POST', body });
    toast(`Saved ${res.created} entries`);
    onSaved?.(data.date);
  }));
  render();
  return root;
}
