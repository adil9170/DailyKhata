// Past bills: search, filter (all / udhaar due / paid / voided), open one to reprint or share it, send an udhaar
// reminder on WhatsApp, mark it paid, or void it. Works offline (the list comes from the phone's own copy).
import { h, mount, money, toast, icon, busy, pageHead, confirmDialog, modal, badge, fmtDate } from '../ui.js';
import { api, state, can, todayLocal } from '../api.js';
import { amountToWords } from '../../../src/lib/words.ts';
import { billLabel, waNumber, reminderText, billPaidTag, isBillPaidNote } from '../../../src/lib/bills.ts';
import { t as tx } from '../i18n.js';

const PAGE = 50;
const FILTERS = [['all', tx('All')], ['due', tx('Udhaar due')], ['paid', tx('Paid')], ['void', tx('Voided')]];
const MODE_NAME = { cash: tx('Cash'), upi: tx('UPI'), card: tx('Card'), credit: tx('Udhaar') };
const addDays = (d, n) => { const t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** Items stored with the bill; tolerates anything odd (old or hand-edited rows) instead of crashing. */
function itemsOf(b) {
  try { const a = JSON.parse(b.items_json || '[]'); return Array.isArray(a) ? a.filter((x) => x && typeof x === 'object') : []; } catch { return []; }
}
const whenOf = (b) => { const d = b.created_at ? new Date(String(b.created_at).replace(' ', 'T') + 'Z') : null; return d && !isNaN(d) ? d : new Date(`${b.entry_date}T12:00:00`); };

export async function billsPage(main) {
  const today = state.today || todayLocal();
  const W = can('entries.write'), D = can('entries.delete');
  const st = { filter: 'all', q: '', rows: [], offset: 0, total: 0, done: false, loading: false, gen: 0, payments: [] };

  const settledFor = (b) => st.payments.find((p) => isBillPaidNote(p.notes, billLabel(b.series, b.bill_no)));
  const isDue = (b) => !b.voided && b.pay_mode === 'credit' && b.total_paise > 0 && !settledFor(b);
  const keep = (b) => st.filter === 'due' ? isDue(b) : st.filter === 'paid' ? !b.voided && !isDue(b) : true;
  const voidedParam = () => (st.filter === 'void' ? '1' : st.filter === 'all' ? null : '0');

  const list = h('div', { class: 'bh-list', 'aria-live': 'polite' });
  const more = h('div', { class: 'bh-more' });
  const summary = h('div', { class: 'small muted bh-sum' });

  async function fetchPage(gen, want) {
    // client-side filters (due / paid) need payments, so keep pulling pages until a full screen is visible or the list ends
    let added = 0;
    while (!st.done && added < want) {
      const qs = new URLSearchParams({ limit: String(st.filter === 'all' || st.filter === 'void' ? PAGE : 100), offset: String(st.offset) });
      if (st.q) qs.set('q', st.q);
      if (voidedParam() !== null) qs.set('voided', voidedParam());
      const r = await api(`/api/c/bills?${qs}`);
      if (gen !== st.gen) return;
      const rows = Array.isArray(r.bills) ? r.bills : [];
      st.offset += rows.length; st.total = Number(r.total) || 0;
      if (!rows.length || st.offset >= st.total) st.done = true;
      const kept = rows.filter(keep);
      st.rows.push(...kept); added += kept.length;
    }
  }
  async function load(reset) {
    if (st.loading && !reset) return;
    if (reset) { st.gen++; st.rows = []; st.offset = 0; st.total = 0; st.done = false; }
    const gen = st.gen; st.loading = true; paint();
    try {
      if (reset || !st.payments.length) {
        const p = await api(`/api/c/payments?from=${addDays(today, -395)}&to=${today}`).catch(() => { toast('Could not check which bills are paid', true); return []; }); // the API allows 400 days at most
        if (gen !== st.gen) return;
        st.payments = (Array.isArray(p) ? p : []).filter((x) => x.direction === 'from_customer');
      }
      await fetchPage(gen, PAGE);
    } catch (e) { if (gen === st.gen) toast(e.message || tx('Could not load bills'), true); }
    if (gen === st.gen) { st.loading = false; paint(); }
  }

  function row(b) {
    const label = billLabel(b.series, b.bill_no);
    const n = itemsOf(b).length;
    const sub = [fmtDate(b.entry_date), MODE_NAME[b.pay_mode] || b.pay_mode, n ? `${n} item${n > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ');
    const tag = b.voided ? badge(tx('Voided'), 'bad') : isDue(b) ? badge(tx('Udhaar due'), 'warn') : b.pay_mode === 'credit' && b.total_paise > 0 ? badge(tx('Paid'), 'good') : null;
    return h('button', { type: 'button', class: 'bh-row' + (b.voided ? ' voided' : ''), onclick: () => openBill(b) },
      h('span', { class: 'bh-no' }, `#${label}`),
      h('span', { class: 'bh-main' }, h('span', { class: 'bh-who' }, b.customer || tx('Walk-in customer')), h('span', { class: 'bh-sub' }, sub)),
      h('span', { class: 'bh-side' }, h('span', { class: 'bh-amt' }, money(b.total_paise)), tag));
  }
  function paint() {
    mount(list, st.rows.length ? st.rows.map(row)
      : st.loading ? h('div', { class: 'boot', style: { padding: '28px 0' } }, h('div', { class: 'spinner' }))
      : h('div', { class: 'card empty' }, st.q || st.filter !== 'all' ? 'No bills match.' : tx('No bills yet. Bills you make from “Make a bill” show up here.')));
    mount(more, !st.done && st.rows.length ? h('button', { class: 'block', type: 'button', disabled: st.loading ? 'disabled' : null, onclick: () => load(false) }, st.loading ? 'Loading…' : tx('Load more')) : null);
    const dueTotal = st.filter === 'due' ? st.rows.reduce((s, b) => s + b.total_paise, 0) : 0;
    summary.textContent = st.loading && !st.rows.length ? '' : st.filter === 'due'
      ? `${st.rows.length} unpaid bill${st.rows.length === 1 ? '' : 's'}${st.done ? '' : ' so far'} · ${money(dueTotal)} to collect`
      : st.total ? (st.done ? tx('Showing {n}', null, { n: st.rows.length }) : tx('Showing {n} of {total}', null, { n: st.rows.length, total: st.total })) : '';
  }

  // ---------- one bill ----------
  function receiptFor(b) {
    const label = billLabel(b.series, b.bill_no);
    const items = itemsOf(b);
    const lines = items.map((it) => ({ label: String(it.name ?? tx('Item')), note: `${Number(it.qty) || 0} × ${money(Number(it.rate_paise) || 0)}`, value: money(Number(it.amount_paise) || 0) }));
    if (b.discount_paise > 0) lines.push({ label: tx('Discount'), value: '−' + money(b.discount_paise), negative: true });
    if (!lines.length) lines.push({ label: tx('Bill total'), value: money(b.total_paise) });
    const who = [b.customer, b.phone].filter(Boolean).join(' · ');
    const paid = b.voided ? 'VOIDED bill' : b.pay_mode === 'credit' ? (settledFor(b) ? 'Paid (udhaar settled)' : tx('Payment due (udhaar)')) : `Paid by ${MODE_NAME[b.pay_mode] || b.pay_mode}`;
    return { company: state.company, title: `Bill #${label}`, subtitle: who ? `To: ${who}` : null, lines, totalLabel: tx('TOTAL'), total: money(b.total_paise), when: whenOf(b),
      words: b.total_paise ? amountToWords(b.total_paise, 'en', true) : null, footer: `${paid} · Thank you, visit again!`, phone: b.phone || '', sheetTitle: tx('Share bill') };
  }
  function openWhatsApp(b, to) {
    const text = reminderText({ shop: state.company?.name, customer: b.customer, label: billLabel(b.series, b.bill_no), paise: b.total_paise });
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }
  function remind(b) {
    const to = waNumber(b.phone);
    if (to) return openWhatsApp(b, to);
    // no usable phone on the bill: ask for one (used for this reminder only)
    const input = h('input', { inputmode: 'tel', placeholder: '10-digit mobile number', autocomplete: 'off', 'aria-label': tx('Customer phone number') });
    const err = h('div', { class: 'small', style: { color: 'var(--bad, #c2371d)', minHeight: '1.2em' }, role: 'alert' });
    const go = h('button', { class: 'primary', type: 'submit' }, icon('share', 16), tx('Open WhatsApp'));
    const form = h('form', null, h('p', { class: 'small muted' }, `There is no phone number on this bill. Enter ${b.customer || 'the customer'}’s number to send the reminder.`), h('div', { class: 'field' }, input), err,
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, go));
    const m = modal(tx('Customer’s phone'), form);
    form.addEventListener('submit', (e) => { e.preventDefault(); const n = waNumber(input.value); if (!n) { err.textContent = tx('That does not look like a phone number'); input.focus(); return; } m.close(); openWhatsApp(b, n); });
  }
  function markPaid(b, detail) {
    const label = billLabel(b.series, b.bill_no);
    const mode = h('select', { 'aria-label': tx('How did they pay') }, [['cash', tx('Cash')], ['upi', tx('UPI')], ['bank', tx('Bank')]].map(([v, l]) => h('option', { value: v }, l)));
    const ok = h('button', { class: 'primary', type: 'submit' }, icon('check', 16), `Record ${money(b.total_paise)} received`);
    const form = h('form', null, h('p', null, `${b.customer || tx('Customer')} pays bill #${label}.`), h('div', { class: 'field' }, h('label', null, tx('Paid by'), mode)),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, ok));
    const m = modal(tx('Mark as paid'), form);
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(ok, async () => {
      const p = await api('/api/c/payments', { method: 'POST', body: { direction: 'from_customer', party: b.customer || '', amount: (b.total_paise / 100).toFixed(2), mode: mode.value, date: today, notes: billPaidTag(label) } });
      st.payments.unshift({ ...p, direction: 'from_customer', party: b.customer, amount_paise: b.total_paise, notes: billPaidTag(label) });
      m.close(); detail.close(); toast(tx('Bill #{no} marked paid', null, { no: label })); paint(); if (st.filter === 'due') load(true);
    })(); });
  }
  async function voidIt(b, detail) {
    const label = billLabel(b.series, b.bill_no);
    const paidP = settledFor(b);
    const msg = `Void bill #${label}? The bill stays in the list as voided and its sale is removed${paidP ? '; the payment recorded for it is removed too' : ''}. Its number is not reused.`;
    if (!(await confirmDialog(msg, { okText: tx('Void bill') }))) return;
    await api(`/api/c/bills/${b.client_id}/void`, { method: 'POST', body: {} });
    if (paidP?.id) await api(`/api/c/payments/${paidP.id}`, { method: 'DELETE' }).catch(() => {});
    detail.close(); toast(tx('Bill #{no} voided', null, { no: label })); load(true);
  }
  function openBill(b) {
    const label = billLabel(b.series, b.bill_no);
    const items = itemsOf(b);
    const paidP = settledFor(b);
    const kv = (k, v) => h('div', { class: 'bh-kv' }, h('span', { class: 'muted' }, k), h('span', null, v));
    const body = h('div', null,
      h('div', { class: 'bh-total' }, money(b.total_paise), b.voided ? badge(tx('Voided'), 'bad') : isDue(b) ? badge(tx('Udhaar due'), 'warn') : paidP ? badge(tx('Paid'), 'good') : null),
      kv(tx('Customer'), b.customer || tx('Walk-in customer')), b.phone ? kv(tx('Phone'), b.phone) : null, kv(tx('Date'), fmtDate(b.entry_date)), kv(tx('Paid by'), MODE_NAME[b.pay_mode] || b.pay_mode),
      h('div', { class: 'bh-items' }, items.length ? items.map((it) => h('div', { class: 'bh-it' }, h('span', null, String(it.name ?? tx('Item'))), h('span', { class: 'muted' }, `${Number(it.qty) || 0} × ${money(Number(it.rate_paise) || 0)}`), h('span', { class: 'num' }, money(Number(it.amount_paise) || 0)))) : h('div', { class: 'small muted' }, tx('No item details saved.'))),
      b.discount_paise > 0 ? kv(tx('Discount'), '−' + money(b.discount_paise)) : null);
    const detail = modal(`Bill #${label}`, body);
    const voidBtn = D && !b.voided ? h('button', { class: 'block ghost danger', type: 'button' }, icon('trash', 18), tx('Void bill')) : null;
    if (voidBtn) voidBtn.addEventListener('click', busy(voidBtn, () => voidIt(b, detail)));
    const row = h('div', { class: 'receipt-actions', style: { marginTop: '12px' } },
      h('button', { class: 'primary block', type: 'button', onclick: async () => (await import('../receipt.js')).openReceiptSheet(receiptFor(b)) }, icon('share', 18), tx('Reprint / share')),
      isDue(b) ? h('button', { class: 'block', type: 'button', onclick: () => remind(b) }, icon('share', 18), tx('Send udhaar reminder')) : null,
      W && isDue(b) ? h('button', { class: 'block', type: 'button', onclick: () => markPaid(b, detail) }, icon('check', 18), tx('Mark paid')) : null,
      voidBtn);
    body.append(row);
  }

  // ---------- page ----------
  const search = h('input', { type: 'search', class: 'bh-search', placeholder: tx('Search name, phone, bill number'), 'aria-label': tx('Search bills'), autocomplete: 'off', maxlength: '80' });
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = search.value.trim().slice(0, 80); load(true); }, 250); });
  const chips = FILTERS.map(([id, label]) => h('button', { type: 'button', class: 'chip' + (id === st.filter ? ' on' : ''), 'aria-pressed': id === st.filter ? 'true' : 'false', onclick: () => {
    st.filter = id; chips.forEach((c, i) => { c.classList.toggle('on', FILTERS[i][0] === id); c.setAttribute('aria-pressed', FILTERS[i][0] === id ? 'true' : 'false'); }); load(true);
  } }, label));

  // what customers owe in total (needs the reports permission); links to the udhaar list
  const owed = h('div');
  if (can('reports.view')) api('/api/c/reports/outstanding').then((o) => {
    const rec = Array.isArray(o?.receivable) ? o.receivable.filter((r) => r.balance > 0) : [];
    if (!rec.length) return;
    mount(owed, h('a', { class: 'card bh-owed', href: '#/ledger' }, h('span', null, h('span', { class: 'small muted' }, tx('Customers owe you')), h('b', { class: 'bh-owed-amt' }, money(rec.reduce((s, r) => s + r.balance, 0)))),
      h('span', { class: 'small' }, `${rec.length} customer${rec.length > 1 ? 's' : ''} · Udhaar list →`)));
  }).catch(() => {});

  mount(main, pageHead(tx('Bills'), tx('Past bills, reprint and reminders'), W ? h('a', { class: 'btn small', href: '#/bill' }, icon('plus', 16), tx('New bill')) : null),
    owed, search, h('div', { class: 'chips bh-chips' }, chips), summary, list, more);
  load(true);
}
