// Outstanding: supplier credit (to pay) and customer udhaar (to receive), plus settlement payments.
import { h, mount, money, rupees, fmtDate, addDays, table, toast, busy, modal, confirmDialog, badge } from '../ui.js';
import { api, state, can, todayLocal, navigate } from '../api.js';

export async function ledgerPage(main) {
  const today = state.today || todayLocal();
  const [out, payments] = await Promise.all([
    can('reports.view') ? api('/api/c/reports/outstanding') : Promise.resolve(null),
    api(`/api/c/payments?from=${addDays(today, -365)}&to=${today}`),
  ]);
  const W = can('entries.write');
  const partyTable = (rows, dir) => table(['Party', 'Total credit', 'Paid', 'Balance', ''], rows.map((r) => h('tr', null,
    h('td', null, r.party), h('td', { class: 'num' }, money(r.owed)), h('td', { class: 'num' }, money(r.paid)), h('td', { class: 'num' }, h('strong', null, money(r.balance))),
    h('td', { class: 'right' }, W && r.balance > 0 ? h('button', { class: 'small', onclick: () => paymentForm(null, { direction: dir, party: r.party.startsWith('Unnamed') || r.party === 'Expenses on credit' ? '' : r.party, amount: r.balance }) }, dir === 'to_supplier' ? 'Pay' : 'Receive') : null))),
  { empty: 'Nothing outstanding' });
  mount(main,
    h('div', { class: 'spread' }, h('div', null, h('h1', null, 'Udhaar / Outstanding'), h('div', { class: 'muted' }, 'Credit purchases you must pay, and credit sales customers owe you.')),
      W ? h('button', { class: 'primary', onclick: () => paymentForm(null) }, '+ Record payment') : null),
    out ? h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', null, 'To pay — suppliers'), partyTable(out.payable, 'to_supplier')),
      h('div', { class: 'card' }, h('h2', null, 'To receive — customers'), partyTable(out.receivable, 'from_customer'))) : null,
    h('div', { class: 'card' }, h('h2', null, 'Payments (last 12 months)'),
      table(['Date', 'Type', 'Party', 'Amount', 'Mode', 'Notes', ''], payments.map((p) => h('tr', null,
        h('td', null, fmtDate(p.entry_date)), h('td', null, badge(p.direction === 'to_supplier' ? 'Paid to supplier' : 'Received', p.direction === 'to_supplier' ? '' : 'good')),
        h('td', null, p.party || '—'), h('td', { class: 'num' }, money(p.amount_paise)), h('td', null, p.mode), h('td', { class: 'small muted' }, p.notes || ''),
        h('td', { class: 'right' }, h('span', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
          W ? h('button', { class: 'small ghost', 'aria-label': 'Edit', onclick: () => paymentForm(p) }, '✎') : null,
          can('entries.delete') ? h('button', { class: 'small ghost danger', 'aria-label': 'Delete', onclick: async () => {
            if (!(await confirmDialog('Delete this payment?'))) return;
            await api(`/api/c/payments/${p.id}`, { method: 'DELETE' }); toast('Deleted'); navigate('#/ledger');
          } }, '🗑') : null)))), { empty: 'No payments recorded' })));

  function paymentForm(p, preset = {}) {
    const dir = h('select', null, [['to_supplier', 'Paid to supplier'], ['from_customer', 'Received from customer']].map(([v, l]) => h('option', { value: v, selected: (p?.direction ?? preset.direction) === v ? 'selected' : null }, l)));
    const party = h('input', { value: p?.party ?? preset.party ?? '', list: 'parties' });
    const amount = h('input', { inputmode: 'decimal', required: true, value: p ? rupees(p.amount_paise) : preset.amount ? rupees(preset.amount) : '' });
    const mode = h('select', null, ['cash', 'upi', 'bank'].map((m) => h('option', { value: m, selected: p?.mode === m ? 'selected' : null }, m)));
    const date = h('input', { type: 'date', value: p?.entry_date ?? today });
    const notes = h('input', { value: p?.notes ?? '' });
    const names = out ? [...out.payable, ...out.receivable].map((r) => r.party).filter((n) => !n.startsWith('Unnamed')) : [];
    const btn = h('button', { class: 'primary', type: 'submit' }, 'Save');
    const L = (t, el) => h('div', { class: 'field' }, h('label', null, t, el));
    const form = h('form', null, h('datalist', { id: 'parties' }, names.map((n) => h('option', { value: n }))),
      h('div', { class: 'fields' }, L('Type', dir), L('Party name', party), L('Amount ₹', amount), L('Mode', mode), L('Date', date)), L('Notes', notes),
      h('div', { class: 'small muted', style: { marginBottom: '10px' } }, 'Use the same party name as on the purchase/collection to settle that balance.'),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn));
    const m = modal(p ? 'Edit payment' : 'Record payment', form);
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
      await api(p ? `/api/c/payments/${p.id}` : '/api/c/payments', { method: p ? 'PUT' : 'POST', body: { direction: dir.value, party: party.value, amount: amount.value, mode: mode.value, date: date.value, notes: notes.value } });
      m.close(); toast('Saved'); navigate('#/ledger');
    })(); });
  }
}
