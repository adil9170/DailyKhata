// Customer bill: pick items (prices fill in from Products), see the total, tap once to save it as a sale
// and share the bill as a picture — or send it to the customer's WhatsApp.
import { h, mount, money, toast, icon, busy, pageHead, confirmDialog } from '../ui.js';
import { api, state, can, todayLocal } from '../api.js';
import { amountToWords } from '../../../src/lib/words.ts';

const draftKey = () => `dk_bill_${state.company?.id || 0}`;
const noKey = () => `dk_billno_${state.company?.id || 0}`;
const ratesKey = () => `dk_billrates_${state.company?.id || 0}`; // last rate used per item, for items with no sale price in Products
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const keep = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const num = (v) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(n * 100) / 100;
const blank = () => ({ customer: '', phone: '', items: [], discount: '', mode: 'cash' });

export async function billPage(main) {
  if (!can('entries.write')) { mount(main, pageHead('Make a bill'), h('div', { class: 'card empty' }, 'You can view this shop but not make bills.')); return; }
  const bill = { ...blank(), ...load(draftKey(), {}) };
  const products = (state.products || []).filter((p) => p.active !== 0);
  const rates = load(ratesKey(), {});
  const priceOf = (name) => {
    const n = String(name).trim().toLowerCase();
    const p = products.find((x) => x.name.toLowerCase() === n);
    return p?.sale_price_paise ? p.sale_price_paise / 100 : rates[n]?.rate ?? null;
  };
  const nextNo = () => load(noKey(), 0) + 1;

  const subtotal = () => r2(bill.items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0));
  const total = () => Math.max(0, r2(subtotal() - num(bill.discount)));
  const save = () => keep(draftKey(), bill);

  const rows = h('div', { class: 'blist' });
  const totalEl = h('div', { class: 'btotal' });
  const wordsEl = h('div', { class: 'small muted' });
  const subEl = h('div', { class: 'small muted' });

  function paintTotals() {
    const t = total();
    totalEl.textContent = money(Math.round(t * 100));
    wordsEl.textContent = t ? amountToWords(Math.round(t * 100), 'en', true) : 'Add items to start';
    subEl.textContent = num(bill.discount) ? `${money(Math.round(subtotal() * 100))} − ${money(Math.round(num(bill.discount) * 100))} discount` : '';
    save();
  }
  function itemRow(it) {
    const line = h('div', { class: 'bline' });
    const paintLine = () => { const v = num(it.qty) * num(it.rate); line.textContent = v ? money(Math.round(v * 100)) : ''; };
    const name = h('input', { class: 'bname', value: it.name, list: 'dk-bill-prods', placeholder: 'Item', 'aria-label': 'Item name',
      oninput: (e) => { it.name = e.target.value; const p = priceOf(it.name); if (p !== null && !it.rateTouched) { it.rate = String(p); rate.value = it.rate; paintLine(); } paintTotals(); } });
    const qty = h('input', { class: 'bqty', value: it.qty, inputmode: 'decimal', 'aria-label': 'Quantity', onfocus: (e) => e.target.select(), oninput: (e) => { it.qty = e.target.value; paintLine(); paintTotals(); } });
    const rate = h('input', { class: 'brate', value: it.rate, inputmode: 'decimal', placeholder: 'Rate', 'aria-label': 'Rate in rupees', onfocus: (e) => e.target.select(), oninput: (e) => { it.rate = e.target.value; it.rateTouched = true; paintLine(); paintTotals(); } });
    const rm = h('button', { class: 'ghost icon small', type: 'button', 'aria-label': 'Remove item', onclick: () => { bill.items.splice(bill.items.indexOf(it), 1); paintRows(); paintTotals(); } }, icon('x', 16));
    paintLine();
    return h('div', { class: 'brow' }, name, h('div', { class: 'bnums' }, qty, h('span', { class: 'muted' }, '×'), h('span', { class: 'muted' }, '₹'), rate, line, rm));
  }
  function paintRows() {
    mount(rows, bill.items.length ? bill.items.map(itemRow) : h('div', { class: 'small muted', style: { padding: '6px 2px 10px' } }, 'Tap an item below, or add one.'));
  }
  const addItem = (name = '', focus = true) => {
    const existing = name && bill.items.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (existing) { existing.qty = String(num(existing.qty) + 1); paintRows(); paintTotals(); return; }
    const p = priceOf(name);
    bill.items.push({ name, qty: '1', rate: p !== null ? String(p) : '' });
    paintRows(); paintTotals();
    if (focus) { const ins = rows.querySelectorAll(name ? '.brate' : '.bname'); const el = ins[ins.length - 1]; if (el && (!name || p === null)) el.focus(); }
  };

  // one-tap items: most-billed first, then products that have a sale price
  const picks = h('div', { class: 'bpicks' });
  function paintPicks() {
    const seen = new Set();
    const list = [
      ...Object.values(rates).sort((a, b) => b.n - a.n).map((r) => ({ name: r.name, rate: r.rate })),
      ...products.filter((p) => p.sale_price_paise).map((p) => ({ name: p.name, rate: p.sale_price_paise / 100 })),
    ].filter((x) => { const k = x.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
    mount(picks, list.map((x) => h('button', { type: 'button', class: 'chip small', onclick: () => addItem(x.name, false) }, x.name, h('span', { class: 'muted' }, ` ${money(Math.round(x.rate * 100))}`))));
  }

  const customer = h('input', { value: bill.customer, placeholder: 'Customer name (optional)', autocomplete: 'off', 'aria-label': 'Customer name', oninput: (e) => { bill.customer = e.target.value; save(); } });
  const phone = h('input', { value: bill.phone, placeholder: 'Phone (optional)', inputmode: 'tel', autocomplete: 'off', 'aria-label': 'Customer phone', oninput: (e) => { bill.phone = e.target.value; save(); } });
  const discount = h('input', { value: bill.discount, inputmode: 'decimal', placeholder: '0', 'aria-label': 'Discount in rupees', oninput: (e) => { bill.discount = e.target.value; paintTotals(); } });
  const modes = [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['credit', 'Udhaar']];
  const modeBtns = modes.map(([id, label]) => h('button', { type: 'button', class: 'chip' + (bill.mode === id ? ' on' : ''), onclick: () => { bill.mode = id; modeBtns.forEach((b, i) => b.classList.toggle('on', modes[i][0] === id)); save(); } }, label));

  const receiptOpts = (no) => {
    const items = bill.items.filter((it) => it.name.trim() && num(it.qty) && num(it.rate));
    const lines = items.map((it) => ({ label: it.name.trim(), note: `${num(it.qty)} × ${money(Math.round(num(it.rate) * 100))}`, value: money(Math.round(num(it.qty) * num(it.rate) * 100)) }));
    if (num(bill.discount)) lines.push({ label: 'Discount', value: '−' + money(Math.round(num(bill.discount) * 100)), negative: true });
    const who = [bill.customer.trim(), bill.phone.trim()].filter(Boolean).join(' · ');
    const paid = bill.mode === 'credit' ? 'Payment due (udhaar)' : `Paid by ${modes.find((m) => m[0] === bill.mode)[1]}`;
    return { company: state.company, title: `Bill #${no}`, subtitle: who ? `To: ${who}` : null, lines, totalLabel: 'TOTAL', total: money(Math.round(total() * 100)),
      words: amountToWords(Math.round(total() * 100), 'en', true), footer: `${paid} · Thank you, visit again!`, phone: bill.phone, sheetTitle: 'Share bill' };
  };
  const valid = () => {
    const bad = bill.items.find((it) => it.name.trim() && !num(it.rate));
    if (bad) { toast(`Add a rate for ${bad.name}`, true); return false; }
    if (!total()) { toast('Add at least one item with a rate', true); return false; }
    if (bill.mode === 'credit' && !bill.customer.trim()) { toast('Udhaar needs the customer’s name', true); customer.focus(); return false; }
    return true;
  };
  const shareOnly = async () => { if (!valid()) return; (await import('../receipt.js')).openReceiptSheet(receiptOpts(nextNo())); };
  const saveBtn = h('button', { class: 'primary bsave' }, icon('check', 18), 'Save & share bill');
  saveBtn.addEventListener('click', busy(saveBtn, async () => {
    if (!valid()) return;
    const no = nextNo();
    const opts = receiptOpts(no);
    const itemsText = opts.lines.filter((l) => l.label !== 'Discount').map((l) => `${l.label} ${l.note}`).join(', ');
    await api('/api/c/collections', { method: 'POST', body: { date: state.today || todayLocal(), amount: String(total()), mode: bill.mode, customer: bill.customer.trim(), notes: `Bill #${no}: ${itemsText}`.slice(0, 500) } });
    keep(noKey(), no);
    for (const it of bill.items) if (it.name.trim() && num(it.rate)) { const k = it.name.trim().toLowerCase(); rates[k] = { name: it.name.trim(), rate: num(it.rate), n: (rates[k]?.n || 0) + 1 }; }
    keep(ratesKey(), rates);
    paintPicks();
    main.querySelector('.page-head .sub').textContent = `Bill #${nextNo()}`;
    Object.assign(bill, blank()); keep(draftKey(), null);
    customer.value = ''; phone.value = ''; discount.value = ''; modeBtns.forEach((b, i) => b.classList.toggle('on', i === 0));
    paintRows(); paintTotals();
    toast(`Bill #${no} saved as a sale`);
    (await import('../receipt.js')).openReceiptSheet(opts);
  }));
  const clearBtn = h('button', { class: 'ghost small', type: 'button', onclick: async () => {
    if (!bill.items.length && !bill.customer || await confirmDialog('Start a new bill? This one is not saved.', { okText: 'New bill' })) {
      Object.assign(bill, blank()); keep(draftKey(), null); customer.value = ''; phone.value = ''; discount.value = ''; modeBtns.forEach((b, i) => b.classList.toggle('on', i === 0)); paintRows(); paintTotals();
    } } }, 'New bill');

  mount(main,
    pageHead('Make a bill', `Bill #${nextNo()}`, clearBtn),
    h('datalist', { id: 'dk-bill-prods' }, products.map((p) => h('option', { value: p.name }))),
    h('div', { class: 'card bcard' }, h('div', { class: 'bcust' }, customer, phone)),
    h('div', { class: 'card bcard' },
      h('div', { class: 'spread' }, h('h2', { style: { margin: 0 } }, 'Items'), h('button', { class: 'small', type: 'button', onclick: () => addItem() }, icon('plus', 16), 'Add item')),
      rows, picks,
      h('label', { class: 'bdisc' }, h('span', null, 'Discount ₹'), discount)),
    h('div', { class: 'card bcard' }, h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'Paid by'), h('div', { class: 'chips', style: { marginBottom: 0 } }, modeBtns)),
    h('div', { class: 'bbar' },
      h('div', { class: 'spread' }, h('div', null, h('div', { class: 'small muted' }, 'Total'), totalEl), h('button', { class: 'ghost small', type: 'button', onclick: shareOnly }, 'Preview')),
      subEl, wordsEl, saveBtn));
  paintRows(); paintTotals(); paintPicks();
}
