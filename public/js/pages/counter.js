// Cash counter: nine tiles (₹500 … ₹1) in a 3 × 3 grid; tap a tile to add one, − to remove one. Below them, one box for
// money that came in online (Paytm / UPI / any app). The total (cash + online) stays pinned on top and adds itself.
// Share it as a receipt or save it to today's khata (cash as a cash sale, online as a UPI sale).
import { h, mount, money, toast, icon, actionSheet, pageHead, confirmDialog } from '../ui.js';
import { api, state, can, todayLocal } from '../api.js';
import { amountToWords } from '../../../src/lib/words.ts';
import { t as tx, lang as appLang } from '../i18n.js';

// notes first, then coins - laid out left to right, top to bottom
const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
const COINS = new Set([5, 2, 1]);
// each badge takes the colour of the real note/coin, so the eye finds ₹200 (yellow) or ₹50 (blue) without reading
const TINT = { 500: '#8d9399', 200: '#e9a400', 100: '#8b7fd0', 50: '#25aebd', 20: '#8fb52a', 10: '#a86b3c', 5: '#c9a227', 2: '#9aa3ad', 1: '#9aa3ad' };
const KEY = 'dk_counter';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const store = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };
const clampQty = (n) => Math.max(0, Math.min(99999, Math.floor(Number(n) || 0)));
/** Online money typed as rupees ("249.5", "1,200") -> whole paise, never negative or absurd. */
export const toPaise = (v) => { const n = Number(String(v ?? '').replace(/[,\s₹]/g, '')); return Number.isFinite(n) ? Math.max(0, Math.min(99999999999, Math.round(n * 100))) : 0; };
const tick = () => { try { navigator.vibrate?.(5); } catch { /* not supported */ } };

export async function counterPage(main) {
  const saved = load();
  const qty = Object.fromEntries(DENOMS.map((d) => [d, clampQty(saved.qty?.[d])]));
  if (saved.extra && !saved.migrated) qty[1] += clampQty(saved.extra); // old "loose change" box becomes ₹1 coins so no total is lost
  let online = Math.max(0, Math.round(Number(saved.online) || 0)); // paise received on Paytm / UPI
  let lang = saved.lang === 'hi' || saved.lang === 'en' ? saved.lang : appLang(); // the counter keeps its own toggle; first use follows the app language

  const totalEl = h('div', { class: 'ctotal' });
  const wordsEl = h('div', { class: 'cwords' });
  const countEl = h('span', { class: 'ccount' });
  const cashEl = h('b', null), onlineEl = h('b', null);
  const cash = () => DENOMS.reduce((s, d) => s + d * qty[d], 0); // whole rupees
  const grand = () => cash() * 100 + online;                       // paise
  const persist = () => store({ qty, online, lang, migrated: true });

  const tiles = new Map();
  const paintTotals = () => {
    const g = grand();
    totalEl.textContent = money(g);
    wordsEl.textContent = g ? amountToWords(g, lang, true) : (lang === 'hi' ? 'हर नोट पर टैप करें' : tx('Tap a note or coin to start'));
    const notes = DENOMS.reduce((s, d) => s + (COINS.has(d) ? 0 : qty[d]), 0), coins = DENOMS.reduce((s, d) => s + (COINS.has(d) ? qty[d] : 0), 0);
    countEl.textContent = [notes ? `${notes} ${tx(notes === 1 ? 'note' : 'notes')}` : '', coins ? `${coins} ${tx(coins === 1 ? 'coin' : 'coins')}` : ''].filter(Boolean).map((x) => ' · ' + x).join('');
    cashEl.textContent = money(cash() * 100); onlineEl.textContent = money(online);
    persist();
  };
  const paintTile = (d) => { const t = tiles.get(d); t.sum.textContent = qty[d] ? '= ' + money(d * qty[d] * 100) : ''; t.el.classList.toggle('has', qty[d] > 0); };
  const step = (d, by) => { qty[d] = clampQty(qty[d] + by); tiles.get(d).input.value = qty[d] || ''; paintTile(d); paintTotals(); tick(); };

  for (const d of DENOMS) {
    const input = h('input', { class: 'cqty', type: 'number', inputmode: 'numeric', min: '0', placeholder: '0', 'aria-label': tx(COINS.has(d) ? 'How many ₹{d} coins' : 'How many ₹{d} notes', null, { d }),
      oninput: (e) => { qty[d] = clampQty(e.target.value); paintTile(d); paintTotals(); }, onfocus: (e) => e.target.select() });
    const sum = h('div', { class: 'csum' });
    const el = h('div', { class: 'ctile' + (COINS.has(d) ? ' coin' : ''), style: { '--nc': TINT[d] }, onclick: (e) => { if (!e.target.closest('button,input')) step(d, 1); } },
      h('div', { class: 'ctop' },
        h('span', { class: 'cden' }, '₹', h('b', null, String(d))),
        h('button', { type: 'button', class: 'cminus', 'aria-label': tx('One less ₹{d}', null, { d }), onclick: () => step(d, -1) }, icon('minus', 16))),
      input, sum,
      h('button', { type: 'button', class: 'cplus', 'aria-label': tx('One more ₹{d}', null, { d }), onclick: () => step(d, 1) }, icon('plus', 22)));
    tiles.set(d, { el, input, sum });
  }

  // Paytm / UPI: one amount, typed in rupees (paise allowed). Kept apart from the cash tiles so the drawer count stays honest.
  const onlineIn = h('input', { class: 'conin', inputmode: 'decimal', autocomplete: 'off', placeholder: '0', 'aria-label': tx('Received on Paytm / UPI (₹)'), enterkeyhint: 'done',
    value: online ? String(online / 100) : '', oninput: (e) => { online = toPaise(e.target.value); paintTotals(); }, onfocus: (e) => e.target.select() });
  onlineIn.addEventListener('blur', () => { onlineIn.value = online ? String(online / 100) : ''; }); // tidy what was typed ("1,200 " -> 1200)

  const langBtn = h('button', { class: 'chip small cl', type: 'button', 'aria-label': (lang === 'hi' ? 'हिंदी' : 'EN') + ' · ' + tx('Switch language') }, lang === 'hi' ? 'हिंदी' : 'EN');
  langBtn.addEventListener('click', () => { lang = lang === 'hi' ? 'en' : 'hi'; langBtn.textContent = lang === 'hi' ? 'हिंदी' : 'EN'; paintTotals(); });
  const reset = () => { DENOMS.forEach((d) => { qty[d] = 0; tiles.get(d).input.value = ''; paintTile(d); }); online = 0; onlineIn.value = ''; paintTotals(); };

  const share = async () => {
    if (!grand()) return toast(tx('Count some notes first'), true);
    const { openReceiptSheet } = await import('../receipt.js');
    const lines = DENOMS.filter((d) => qty[d]).map((d) => ({ label: `₹${d}  ×  ${qty[d]}`, value: money(d * qty[d] * 100) }));
    if (online) {
      if (cash()) lines.push({ label: tx('Cash'), value: money(cash() * 100), kind: 'sub' });
      lines.push({ label: tx('Paytm / UPI'), value: money(online), kind: cash() ? undefined : 'sub' });
    }
    openReceiptSheet({ company: state.company, title: tx('Cash report'), lines, totalLabel: online ? tx('TOTAL RECEIVED') : tx('TOTAL CASH'), total: money(grand()), words: amountToWords(grand(), lang, true) });
  };
  let saving = false;
  const saveTo = () => {
    if (!grand()) return toast(tx('Count some notes first'), true);
    const date = state.today || todayLocal();
    const c = cash(), o = online;
    const ids = [crypto.randomUUID?.() || 'cc-' + Date.now() + '-a' + Math.random().toString(36).slice(2), crypto.randomUUID?.() || 'cc-' + Date.now() + '-b' + Math.random().toString(36).slice(2)];
    const addSale = async () => {
      if (saving) return; saving = true;
      try {
        if (c) await api('/api/c/collections', { method: 'POST', body: { date, amount: String(c), mode: 'cash', customer: '', notes: 'Cash counter', client_id: ids[0] } });
        if (o) await api('/api/c/collections', { method: 'POST', body: { date, amount: (o / 100).toFixed(2), mode: 'upi', customer: '', notes: 'Cash counter (Paytm / UPI)', client_id: ids[1] } });
        toast(tx('Added to today’s sales'));
      } catch (e) { toast(e.message, true); } finally { saving = false; }
    };
    actionSheet(tx('Save {amount}', null, { amount: money(grand()) }), [
      ...(can('entries.write') ? [{ icon: 'rupee', title: tx('Add as today’s sale'), desc: c && o ? tx('Cash {c} and Paytm / UPI {o}', null, { c: money(c * 100), o: money(o) }) : o ? tx('Paytm / UPI money received') : tx('Money received in the shop'), onclick: addSale }] : []),
      ...(can('cash.close') && c ? [{ icon: 'banknote', title: tx('Use as closing cash'), desc: tx('Cash counted in the drawer today (not the Paytm / UPI part)'), onclick: () => api(`/api/c/day/${date}/closing`, { method: 'PUT', body: { opening_cash: null, counted_cash: String(c), notes: 'Cash counter' } }).then(() => toast(tx('Saved as closing cash')), (e) => toast(e.message, true)) }] : []),
    ]);
  };

  mount(main, h('div', { class: 'cpage' },
    h('div', { class: 'desk-only' }, pageHead(tx('Cash counter'), tx('Tap a note or coin — the total adds itself'))),
    h('div', { class: 'cpanel' },
      h('div', { class: 'cptop' },
        h('div', { class: 'cpmain' }, h('div', { class: 'eyebrow muted' }, tx('Total received'), countEl), totalEl),
        h('div', { class: 'cpright' }, langBtn, h('button', { class: 'ghost icon small cclear', type: 'button', 'aria-label': tx('Clear all'), title: tx('Clear all'), onclick: async () => { if (grand() && await confirmDialog(tx('Clear the whole count?'), { okText: tx('Clear') })) reset(); } }, icon('trash', 18)))),
      h('div', { class: 'cparts' },
        h('div', null, h('span', null, tx('Cash')), cashEl),
        h('div', null, h('span', null, tx('Paytm / UPI')), onlineEl)),
      wordsEl),
    h('h2', { class: 'csec' }, tx('Cash in the drawer')),
    h('div', { class: 'cgrid' }, DENOMS.map((d) => tiles.get(d).el)),
    h('h2', { class: 'csec' }, tx('Paytm / UPI')),
    h('label', { class: 'conline' },
      h('span', { class: 'conlbl' }, tx('Money received online today'), h('small', null, tx('Paytm, GPay, PhonePe or any UPI. Type the total.'))),
      h('span', { class: 'conbox' }, h('span', { class: 'rs' }, '₹'), onlineIn)),
    h('div', { class: 'cbtns' }, h('button', { class: 'primary', onclick: share }, icon('share', 18), tx('Share receipt')), can('entries.write') || can('cash.close') ? h('button', { onclick: saveTo }, tx('Save…')) : null)));
  for (const d of DENOMS) { tiles.get(d).input.value = qty[d] || ''; paintTile(d); }
  paintTotals();
}
