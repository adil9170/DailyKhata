// Cash counter: one screen, no scrolling. Nine tiles (₹500 … ₹1) in a 3 × 3 grid; tap a tile to add one, − to remove one.
// The total sits on top and adds itself. Share it as a receipt or save it to today's khata.
import { h, mount, money, toast, icon, actionSheet, pageHead, confirmDialog } from '../ui.js';
import { api, state, can, todayLocal } from '../api.js';
import { amountToWords } from '../../../src/lib/words.ts';

// notes first, then coins - laid out left to right, top to bottom
const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];
const COINS = new Set([5, 2, 1]);
// each badge takes the colour of the real note/coin, so the eye finds ₹200 (yellow) or ₹50 (blue) without reading
const TINT = { 500: '#8d9399', 200: '#e9a400', 100: '#8b7fd0', 50: '#25aebd', 20: '#8fb52a', 10: '#a86b3c', 5: '#c9a227', 2: '#9aa3ad', 1: '#9aa3ad' };
const KEY = 'dk_counter';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const store = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };
const clampQty = (n) => Math.max(0, Math.min(99999, Math.floor(Number(n) || 0)));
const tick = () => { try { navigator.vibrate?.(5); } catch { /* not supported */ } };

export async function counterPage(main) {
  const saved = load();
  const qty = Object.fromEntries(DENOMS.map((d) => [d, clampQty(saved.qty?.[d])]));
  if (saved.extra && !saved.migrated) qty[1] += clampQty(saved.extra); // old "loose change" box becomes ₹1 coins so no total is lost
  let lang = saved.lang === 'hi' ? 'hi' : 'en';

  const totalEl = h('div', { class: 'ctotal' });
  const wordsEl = h('div', { class: 'cwords' });
  const countEl = h('span', { class: 'ccount' });
  const total = () => DENOMS.reduce((s, d) => s + d * qty[d], 0);
  const persist = () => store({ qty, lang, migrated: true });

  const tiles = new Map();
  const paintTotals = () => {
    const t = total();
    totalEl.textContent = money(t * 100);
    wordsEl.textContent = t ? amountToWords(t * 100, lang, true) : (lang === 'hi' ? 'हर नोट पर टैप करें' : 'Tap a note or coin to start');
    const notes = DENOMS.reduce((s, d) => s + (COINS.has(d) ? 0 : qty[d]), 0), coins = DENOMS.reduce((s, d) => s + (COINS.has(d) ? qty[d] : 0), 0);
    countEl.textContent = [notes ? `${notes} note${notes === 1 ? '' : 's'}` : '', coins ? `${coins} coin${coins === 1 ? '' : 's'}` : ''].filter(Boolean).map((x) => ' · ' + x).join('');
    persist();
  };
  const paintTile = (d) => { const t = tiles.get(d); t.sum.textContent = qty[d] ? '= ' + money(d * qty[d] * 100) : ''; t.el.classList.toggle('has', qty[d] > 0); };
  const paintAll = () => { DENOMS.forEach((d) => { tiles.get(d).input.value = qty[d] || ''; paintTile(d); }); paintTotals(); };
  const step = (d, by) => { qty[d] = clampQty(qty[d] + by); tiles.get(d).input.value = qty[d] || ''; paintTile(d); paintTotals(); tick(); };

  for (const d of DENOMS) {
    const input = h('input', { class: 'cqty', type: 'number', inputmode: 'numeric', min: '0', placeholder: '0', 'aria-label': `How many ₹${d} ${COINS.has(d) ? 'coins' : 'notes'}`,
      oninput: (e) => { qty[d] = clampQty(e.target.value); paintTile(d); paintTotals(); }, onfocus: (e) => e.target.select() });
    const sum = h('div', { class: 'csum' });
    const el = h('div', { class: 'ctile' + (COINS.has(d) ? ' coin' : ''), style: { '--nc': TINT[d] }, onclick: (e) => { if (!e.target.closest('button,input')) step(d, 1); } },
      h('div', { class: 'ctop' },
        h('span', { class: 'cden' }, '₹', h('b', null, String(d))),
        h('button', { type: 'button', class: 'cminus', 'aria-label': `One less ₹${d}`, onclick: () => step(d, -1) }, icon('minus', 16))),
      input,
      sum,
      h('button', { type: 'button', class: 'cplus', 'aria-label': `One more ₹${d}`, onclick: () => step(d, 1) }, icon('plus', 22)));
    tiles.set(d, { el, input, sum });
  }

  const langBtn = h('button', { class: 'chip small cl', type: 'button', 'aria-label': 'Switch language' }, lang === 'hi' ? 'हिंदी' : 'EN');
  langBtn.addEventListener('click', () => { lang = lang === 'hi' ? 'en' : 'hi'; langBtn.textContent = lang === 'hi' ? 'हिंदी' : 'EN'; paintTotals(); });
  const reset = () => { DENOMS.forEach((d) => { qty[d] = 0; }); paintAll(); };

  const share = async () => {
    const t = total(); if (!t) return toast('Count some notes first', true);
    const { openReceiptSheet } = await import('../receipt.js');
    const lines = DENOMS.filter((d) => qty[d]).map((d) => ({ label: `₹${d}  ×  ${qty[d]}`, value: money(d * qty[d] * 100) }));
    openReceiptSheet({ company: state.company, title: 'Cash report', lines, totalLabel: 'TOTAL CASH', total: money(t * 100), words: amountToWords(t * 100, lang, true) });
  };
  const saveTo = () => {
    const t = total(); if (!t) return toast('Count some notes first', true);
    const date = state.today || todayLocal();
    actionSheet(`Save ${money(t * 100)}`, [
      ...(can('entries.write') ? [{ icon: 'rupee', title: 'Add as today’s sale (cash)', desc: 'Money received in the shop', onclick: () => api('/api/c/collections', { method: 'POST', body: { date, amount: String(t), mode: 'cash', customer: '', notes: 'Cash counter' } }).then(() => toast('Added to today’s sales'), (e) => toast(e.message, true)) }] : []),
      ...(can('cash.close') ? [{ icon: 'banknote', title: 'Use as closing cash', desc: 'Cash counted in the drawer today', onclick: () => api(`/api/c/day/${date}/closing`, { method: 'PUT', body: { opening_cash: null, counted_cash: String(t), notes: 'Cash counter' } }).then(() => toast('Saved as closing cash'), (e) => toast(e.message, true)) }] : []),
    ]);
  };

  mount(main, h('div', { class: 'cpage' },
    h('div', { class: 'desk-only' }, pageHead('Cash counter', 'Tap a note or coin — the total adds itself')),
    h('div', { class: 'cpanel' },
      h('div', { class: 'cptop' }, h('div', null, h('div', { class: 'eyebrow muted' }, 'Total cash ', countEl), totalEl), h('div', { class: 'cpright' }, langBtn, h('button', { class: 'ghost icon small cclear', type: 'button', 'aria-label': 'Clear all', title: 'Clear all', onclick: async () => { if (total() && await confirmDialog('Clear the whole count?', { okText: 'Clear' })) reset(); } }, icon('trash', 18)))),
      wordsEl),
    h('div', { class: 'cgrid' }, DENOMS.map((d) => tiles.get(d).el)),
    h('div', { class: 'cbtns' }, h('button', { class: 'primary', onclick: share }, icon('share', 18), 'Share receipt'), h('button', { onclick: saveTo }, 'Save…'))));
  paintAll();
  fitToScreen(main);
}

/** Size the page to the visible screen (above the floating tab bar) so nothing scrolls; recalculates when the keyboard opens. */
function fitToScreen(main) {
  const page = main.querySelector('.cpage'); if (!page) return;
  const run = () => {
    if (!page.isConnected) { removeEventListener('resize', run); window.visualViewport?.removeEventListener('resize', run); return; }
    const tab = document.querySelector('.tabbar');
    if (!tab || getComputedStyle(tab).display === 'none') { page.style.height = ''; main.classList.remove('fit'); return; }
    main.classList.add('fit');
    const vv = window.visualViewport, kb = document.documentElement.classList.contains('kb');
    const bottom = kb ? (vv ? vv.height : innerHeight) : tab.getBoundingClientRect().top - 38; // 38px keeps the centre + button clear of the tab bar
    page.style.height = Math.max(420, Math.floor(bottom - page.getBoundingClientRect().top - 4)) + 'px';
  };
  run();
  addEventListener('resize', run);
  window.visualViewport?.addEventListener('resize', run);
  requestAnimationFrame(run);
}
