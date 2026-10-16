import { h, mount, money, rupees, toast, busy, modal, table, badge, confirmDialog, fmtDate, icon } from '../ui.js';
import { api, can, refreshLists, navigate } from '../api.js';

export async function productsPage(main) {
  const products = await api('/api/c/products');
  const M = can('products.manage');
  const search = h('input', { type: 'search', placeholder: 'Search products', style: { maxWidth: '260px' } });
  const body = h('tbody');
  const render = () => {
    const q = search.value.trim().toLowerCase();
    mount(body, products.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).map((p) => h('tr', { style: p.active ? null : { opacity: 0.55 } },
      h('td', null, p.name, p.category ? h('div', { class: 'small muted' }, p.category) : null, p.active ? null : badge('archived')),
      h('td', null, `${p.pieces_per_unit} pcs / ${p.unit}`),
      h('td', { class: 'num' }, money(p.default_unit_cost_paise)),
      h('td', { class: 'num' }, p.avg_cost_per_piece_paise != null ? money(Math.round(p.avg_cost_per_piece_paise)) : p.default_unit_cost_paise ? money(Math.round(p.default_unit_cost_paise / p.pieces_per_unit)) : '—'),
      h('td', { class: 'num' }, money(p.sale_price_paise)),
      h('td', { class: 'num' }, p.sale_price_paise && p.avg_cost_per_piece_paise ? `${Math.round(((p.sale_price_paise - p.avg_cost_per_piece_paise) / p.sale_price_paise) * 100)}%` : '—'),
      h('td', { class: 'small muted' }, p.last_purchase ? fmtDate(p.last_purchase) : '—'),
      h('td', { class: 'right' }, M ? h('span', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
        h('button', { class: 'ghost icon small', 'aria-label': 'Edit', title: 'Edit', onclick: () => productForm(p) }, icon('edit', 18)),
        h('button', { class: 'ghost icon small danger', 'aria-label': 'Delete', title: 'Delete', onclick: async () => {
          if (!(await confirmDialog(`Remove “${p.name}”? Products with purchases are archived instead of deleted.`))) return;
          const r = await api(`/api/c/products/${p.id}`, { method: 'DELETE' }); toast(r.archived ? 'Archived' : 'Deleted'); await refreshLists(); navigate('#/products');
        } }, icon('trash', 18))) : null))));
  };
  search.addEventListener('input', render);
  render();
  mount(main,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Products'), h('div', { class: 'muted' }, 'Reusable items for daily purchases. Set pieces per box and a sale price to get stock and profit estimates.')),
      M ? h('button', { class: 'primary', onclick: () => productForm(null) }, icon('plus', 17), 'New product') : null),
    h('div', { class: 'card' }, h('div', { class: 'row', style: { marginBottom: '8px' } }, search),
      h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Product', 'Pack', 'Cost / unit', 'Avg cost / pc', 'Sale price / pc', 'Margin', 'Last bought', ''].map((t) => h('th', null, t)))), body))));
}

function productForm(p) {
  const f = {
    name: h('input', { required: true, value: p?.name ?? '' }), category: h('input', { value: p?.category ?? '', placeholder: 'e.g. Soft drinks' }),
    unit: h('input', { value: p?.unit ?? 'box' }), pieces_per_unit: h('input', { type: 'number', min: '1', required: true, value: p?.pieces_per_unit ?? 1 }),
    default_unit_cost: h('input', { inputmode: 'decimal', value: rupees(p?.default_unit_cost_paise) }), sale_price: h('input', { inputmode: 'decimal', value: rupees(p?.sale_price_paise) }),
    active: h('input', { type: 'checkbox', checked: p ? !!p.active : true }),
  };
  const btn = h('button', { class: 'primary', type: 'submit' }, p ? 'Save' : 'Create product');
  const L = (t, el, hint) => h('div', { class: 'field' }, h('label', null, t, el), hint ? h('div', { class: 'small muted' }, hint) : null);
  const form = h('form', null, h('div', { class: 'fields' },
    L('Name', f.name), L('Category', f.category), L('Purchase unit', f.unit, 'box, crate, pack, kg…'), L('Pieces per unit', f.pieces_per_unit),
    L('Usual cost per unit ₹', f.default_unit_cost, 'Used when no purchase yet'), L('Sale price per piece ₹', f.sale_price, 'For expected-sales checks')),
    h('label', { class: 'check' }, f.active, 'Active (shown in daily entry)'), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn));
  const m = modal(p ? 'Edit product' : 'New product', form);
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    const body = { name: f.name.value, category: f.category.value, unit: f.unit.value, pieces_per_unit: Number(f.pieces_per_unit.value), default_unit_cost: f.default_unit_cost.value || null, sale_price: f.sale_price.value || null, active: f.active.checked };
    await api(p ? `/api/c/products/${p.id}` : '/api/c/products', { method: p ? 'PUT' : 'POST', body });
    m.close(); toast('Saved'); await refreshLists(); navigate('#/products');
  })(); });
}
