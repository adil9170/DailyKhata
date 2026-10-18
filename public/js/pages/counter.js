// Cash counter: tap + / − on each note, the total adds itself. Share it as a receipt or save it to today's khata.
import { h, mount, money, toast, icon, busy, modal, actionSheet, pageHead } from '../ui.js';
import { api, state, can, todayLocal } from '../api.js';
import { amountToWords } from '../../../src/lib/words.ts';

const NOTES = [500, 200, 100, 50, 20, 10];
const KEY = 'dk_counter';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const store = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };

export async function counterPage(main) {
  const saved = load();
  const qty = Object.fromEntries(NOTES.map((n) => [n, Math.max(0, Math.floor(Number(saved.qty?.[n]) || 0))]));
  let extra = Number(saved.extra) || 0;       // coins / loose change
  let lang = saved.lang === 'hi' ? 'hi' : 'en';

  const totalEl = h('div', { class: 'ctotal' });
  const wordsEl = h('div', { class: 'cwords' });
  const countEl = h('div', { class: 'small muted' });
  const total = () => NOTES.reduce((s, n) => s + n * qty[n], 0) + extra;
  const persist = () => store({ qty, extra, lang });

  const rows = new Map();
  const paint = () => {
    const t = total();
    totalEl.textContent = money(t * 100);
    wordsEl.textContent = t ? amountToWords(t * 100, lang, true) : (lang === 'hi' ? 'गिनती शुरू करें' : 'Tap + to start counting');
    const pieces = NOTES.reduce((s, n) => s + qty[n], 0);
    countEl.textContent = pieces ? `${pieces} note${pieces === 1 ? '' : 's'}${extra ? ' + coins' : ''}` : '';
    for (const [n, r] of rows) { r.input.value = qty[n] || ''; r.sum.textContent = qty[n] ? money(n * qty[n] * 100) : ''; r.row.classList.toggle('has', qty[n] > 0); }
    persist();
  };

  const step = (n, d) => { qty[n] = Math.max(0, Math.min(99999, qty[n] + d)); paint(); };
  for (const n of NOTES) {
    const input = h('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: '0', 'aria-label': `Number of ₹${n} notes`,
      oninput: (e) => { qty[n] = Math.max(0, Math.min(99999, Math.floor(Number(e.target.value) || 0))); paint2(n); }, onfocus: (e) => e.target.select() });
    const sum = h('div', { class: 'csum' });
    const row = h('div', { class: 'crow' },
      h('div', { class: 'cnote' }, '₹', h('b', null, String(n))),
      h('div', { class: 'stepper' },
        h('button', { class: 'ghost', type: 'button', 'aria-label': `One less ₹${n}`, onclick: () => step(n, -1) }, icon('minus', 20)),
        input,
        h('button', { type: 'button', 'aria-label': `One more ₹${n}`, onclick: () => step(n, 1) }, icon('plus', 20))),
      sum);
    rows.set(n, { row, input, sum });
  }
  // typing in a field must not rebuild the field being typed in
  const paint2 = (n) => { const r = rows.get(n); r.sum.textContent = qty[n] ? money(n * qty[n] * 100) : ''; r.row.classList.toggle('has', qty[n] > 0); const t = total(); totalEl.textContent = money(t * 100); wordsEl.textContent = t ? amountToWords(t * 100, lang, true) : ''; persist(); };

  const coins = h('input', { type: 'number', inputmode: 'decimal', min: '0', placeholder: '0', 'aria-label': 'Coins and loose change', value: extra || '',
    oninput: (e) => { extra = Math.max(0, Number(e.target.value) || 0); const t = total(); totalEl.textContent = money(t * 100); wordsEl.textContent = t ? amountToWords(t * 100, lang, true) : ''; persist(); }, onfocus: (e) => e.target.select() });
  const coinRow = h('div', { class: 'crow has' }, h('div', { class: 'cnote small' }, 'Coins'), h('div', { class: 'cextra' }, h('span', { class: 'rs' }, '₹'), coins), h('div', { class: 'csum' }));

  const langBtns = [['en', 'English'], ['hi', 'हिंदी']].map(([id, label]) => h('button', { class: 'chip small' + (lang === id ? ' on' : ''), type: 'button', onclick: () => { lang = id; langBtns.forEach((b, i) => b.classList.toggle('on', ['en', 'hi'][i] === id)); paint(); } }, label));

  const share = async () => {
    const t = total(); if (!t) return toast('Count some notes first', true);
    const { openReceiptSheet } = await import('../receipt.js');
    const lines = NOTES.filter((n) => qty[n]).map((n) => ({ label: `₹${n}  ×  ${qty[n]}`, value: money(n * qty[n] * 100) }));
    if (extra) lines.push({ label: 'Coins / change', value: money(extra * 100) });
    openReceiptSheet({ company: state.company, title: 'Cash count', lines, totalLabel: 'TOTAL CASH', total: money(t * 100), words: amountToWords(t * 100, lang, true) });
  };
  const saveTo = () => {
    const t = total(); if (!t) return toast('Count some notes first', true);
    const date = state.today || todayLocal();
    actionSheet(`Save ${money(t * 100)}`, [
      ...(can('entries.write') ? [{ icon: 'rupee', title: 'Add as today’s sale (cash)', desc: 'Money received in the shop', onclick: () => api('/api/c/collections', { method: 'POST', body: { date, amount: String(t), mode: 'cash', customer: '', notes: 'Cash counter' } }).then(() => toast('Added to today’s sales'), (e) => toast(e.message, true)) }] : []),
      ...(can('cash.close') ? [{ icon: 'banknote', title: 'Use as closing cash', desc: 'Cash counted in the drawer today', onclick: () => api(`/api/c/day/${date}/closing`, { method: 'PUT', body: { opening_cash: null, counted_cash: String(t), notes: 'Cash counter' } }).then(() => toast('Saved as closing cash'), (e) => toast(e.message, true)) }] : []),
    ]);
  };
  const reset = () => { NOTES.forEach((n) => { qty[n] = 0; }); extra = 0; coins.value = ''; paint(); };

  mount(main,
    pageHead('Cash counter', 'Tap + for each note — the total adds itself'),
    h('div', { class: 'card ccard' },
      h('div', { class: 'crows' }, [...rows.values()].map((r) => r.row), coinRow)),
    h('div', { class: 'cbar' },
      h('div', { class: 'cbar-top' }, h('div', null, h('div', { class: 'k small muted' }, 'Total'), totalEl, countEl), h('div', { class: 'row' }, langBtns, h('button', { class: 'ghost small', type: 'button', onclick: reset }, 'Clear'))),
      wordsEl,
      h('div', { class: 'cbtns' }, h('button', { class: 'primary', onclick: share }, icon('share', 18), 'Share receipt'), h('button', { onclick: saveTo }, 'Save…'))));
  paint();
}
