// Chat khata: the whole app as one conversation. Type (or say) what happened — "chai 40, auto 120",
// "Sharma se 3000 mila" — and it is saved at once. Ask "aaj kitna?" for the day's numbers. Undo with one tap.
// Reading happens on the phone (src/lib/dump.ts), so it is instant and works offline.
// v2: scroll up for earlier days, tap an entry to edit or delete it, undo survives a reload, and it answers
// "kal ka total", "kitna udhaar", "Sharma ka hisaab".
import { h, mount, money, toast, icon, confirmDialog, addDays, fmtDate } from '../ui.js';
import { api, state, can, todayLocal, navigate } from '../api.js';
import { rowOrder } from '../state.js';
import { readDump } from '../../../src/lib/dump.ts';
import { readQuestion, findParty } from '../../../src/lib/chatq.ts';
import { purchaseForm, expenseForm, collectionForm } from './day.js';
import { t as tx, locale, isHindi } from '../i18n.js';

const KINDS = { purchases: tx('Stock'), expenses: tx('Expense'), collections: tx('Sale') };
const time = (sql) => { if (!sql) return ''; const d = new Date(sql.replace(' ', 'T') + 'Z'); return isNaN(d) ? '' : d.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }); };
// entries get a new id when they reach the server; client_id never changes, so we track that
const keyOf = (k, e) => `${k}:${e.client_id || e.id}`;
const ids = (day) => new Set(['purchases', 'expenses', 'collections'].flatMap((k) => day[k].map((e) => keyOf(k, e))));

function describe(kind, e) {
  if (kind === 'collections') return { t: [e.mode === 'credit' ? tx('Udhaar') : e.mode === 'cash' ? tx('Cash') : e.mode.toUpperCase(), e.customer].filter(Boolean).join(' · '), amt: e.amount_paise, sign: '+' };
  if (kind === 'expenses') return { t: `${e.category}${e.notes ? ' · ' + e.notes : ''}`, amt: e.amount_paise, sign: '−' };
  return { t: `${e.product_name} · ${e.qty_units} ${e.unit}`, amt: e.total_cost_paise, sign: '−' };
}

const MAX = 600; // characters per message
const DUP_MS = 5000; // the same text again within this asks first
const MAX_BACK = 90; // how far "earlier days" looks for a day with entries
const KS = ['purchases', 'expenses', 'collections'];
const FORMS = { purchases: purchaseForm, expenses: expenseForm, collections: collectionForm };
const undoKey = (d) => `dk_chat_undo:${d}`;
const loadUndo = (d) => { try { const v = JSON.parse(localStorage.getItem(undoKey(d)) || '[]'); return Array.isArray(v) ? v.filter((x) => Array.isArray(x) && x.every((k) => typeof k === 'string')).slice(-20) : []; } catch { return []; } };
const saveUndo = (d, v) => { try { v.length ? localStorage.setItem(undoKey(d), JSON.stringify(v.slice(-20))) : localStorage.removeItem(undoKey(d)); } catch { /* private mode */ } };

export async function chatPage(main) {
  const date = state.today || todayLocal();
  const W = can('entries.write');
  let day = await api(`/api/c/day/${date}`);
  const log = h('div', { class: 'chatlog', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  const lastAdded = loadUndo(date); // stack of entry keys (kind:client_id) per message, for undo; kept for the day
  const cards = new Set(); // every entry card on screen, so an edit or delete updates all of them
  const dayData = new Map([[date, day]]);

  const nearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
  const scroll = (force = true) => { if (force || nearBottom()) requestAnimationFrame(() => log.lastElementChild?.scrollIntoView({ block: 'end', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })); };
  const bubble = (side, ...kids) => { const stick = side === 'me' || nearBottom(); const b = h('div', { class: `bub bub-${side}` }, ...kids); log.append(b); scroll(stick); return b; };

  // an entry card; tap it (or Enter) to edit — the form has Delete too
  const cardBody = (kind, e) => { const d = describe(kind, e); return [h('span', { class: 'et' }, h('span', { class: 'ek' }, KINDS[kind]), d.t), h('b', { class: 'ea' }, d.sign + money(d.amt))]; };
  const entryCard = (kind, e, d = date) => {
    const el = h('div', { class: `ent ${kind}` }, ...cardBody(kind, e));
    const rec = { el, kind, key: keyOf(kind, e), date: d };
    if (W) {
      el.classList.add('tap'); el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.setAttribute('aria-label', `${tx('Edit')} ${describe(kind, e).t} ${money(describe(kind, e).amt)}`);
      const open = () => { if (rec.gone) return; const cur = (dayData.get(d)?.[kind] || []).find((x) => keyOf(kind, x) === rec.key) || e; FORMS[kind](d, cur, () => changed(d, rec)); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === el) { ev.preventDefault(); open(); } });
    }
    cards.add(rec);
    return el;
  };
  // after an edit or delete: reload that day, refresh every card for it, and say so
  async function changed(d, rec) {
    try { const fresh = await api(`/api/c/day/${d}`); dayData.set(d, fresh); if (d === date) day = fresh; } catch (e) { return toast(e.message, true); }
    const fresh = dayData.get(d);
    for (const c of cards) {
      if (c.date !== d) continue;
      const e = fresh[c.kind].find((x) => keyOf(c.kind, x) === c.key);
      if (!e) { c.gone = true; c.el.classList.add('gone'); c.el.classList.remove('tap'); c.el.removeAttribute('role'); c.el.tabIndex = -1; c.el.setAttribute('aria-label', tx('Deleted')); c.el.title = tx('Deleted'); }
      else { c.el.replaceChildren(...cardBody(c.kind, e)); }
    }
    const gone = rec?.gone;
    bubble('bot', h('div', null, gone ? tx('Deleted. ') : tx('Updated. '), h('span', { class: 'muted' }, d === date ? '' : fmtDate(d))), summary(fresh));
  }

  const summary = (src = day) => {
    const r = src.report;
    return h('div', { class: 'sumcard' },
      h('div', null, h('span', null, 'Sales'), h('b', { class: 'pos' }, money(r.collections.total))),
      h('div', null, h('span', null, 'Spent'), h('b', null, money(r.purchases.total + r.expenses.total))),
      h('div', null, h('span', null, 'Cash left'), h('b', null, money(r.net_cash_flow, { sign: true }))));
  };
  const chips = (list) => h('div', { class: 'bubchips' }, list.map(([label, fn]) => h('button', { type: 'button', class: 'chip small', onclick: fn }, label)));
  const entriesOf = (d) => KS.flatMap((k) => d[k].map((e) => [k, e])).sort((a, b) => rowOrder(a[1].id) - rowOrder(b[1].id));

  // ---- history: today's entries, oldest first, as if you had sent them ----
  const all = entriesOf(day);
  const first = (state.user?.name || '').split(/\s+/)[0];
  const earlier = h('div', { class: 'chatearlier', 'aria-live': 'off' });
  log.append(earlier);
  bubble('bot', h('div', null, tx('Namaste{name}! Tell me what happened — like ', null, { name: first ? ' ' + first : '' }), h('i', null, '“chai 40, auto 120”'), tx(' or '), h('i', null, '“Sharma se 3000 mila”'), tx('. I’ll write it in your khata.')),
    all.length ? null : chips([[tx('How do I use this?'), () => help()]]));
  if (all.length) {
    const shown = all.slice(-8);
    bubble('me', all.length > shown.length ? h('div', { class: 'bt', style: { textAlign: 'left', marginTop: 0 } }, tx('+{n} earlier', null, { n: all.length - shown.length })) : null,
      shown.map(([k, e]) => entryCard(k, e)), h('div', { class: 'bt' }, tx('Today · {n} entries', null, { n: all.length })));
    bubble('bot', h('div', null, tx('So far today:')), summary());
  }

  // ---- earlier days: scroll to the top (or tap) to load the previous day that has entries ----
  let oldest = date, back = 0, loadingEarlier = false, exhausted = false;
  const moreBtn = h('button', { type: 'button', class: 'chip small chatmore', onclick: () => loadEarlier() }, tx('Earlier days'));
  earlier.append(moreBtn);
  async function loadEarlier() {
    if (loadingEarlier || exhausted) return;
    loadingEarlier = true; moreBtn.disabled = true; moreBtn.textContent = tx('Loading…');
    const before = document.documentElement.scrollHeight;
    try {
      let found = null;
      while (!found && back < MAX_BACK) {
        oldest = addDays(oldest, -1); back += 1;
        const d = await api(`/api/c/day/${oldest}`); dayData.set(oldest, d);
        if (entriesOf(d).length) found = { date: oldest, data: d };
      }
      if (found) {
        const list = entriesOf(found.data);
        const blk = h('div', { class: 'chatday' }, h('div', { class: 'dayhead' }, fmtDate(found.date, { weekday: 'short', day: 'numeric', month: 'short' })),
          h('div', { class: 'bub bub-me' }, list.map(([k, e]) => entryCard(k, e, found.date)), h('div', { class: 'bt' }, tx('{n} entries', null, { n: list.length }))),
          h('div', { class: 'bub bub-bot' }, summary(found.data)));
        moreBtn.after(blk);
        window.scrollTo(0, window.scrollY + (document.documentElement.scrollHeight - before)); // keep what you were reading in place
      } else { exhausted = true; }
    } catch (e) { toast(e.message, true); }
    loadingEarlier = false; moreBtn.disabled = false;
    if (exhausted) { moreBtn.textContent = tx('No earlier entries'); moreBtn.disabled = true; } else moreBtn.textContent = tx('Earlier days');
    // the button sits above the days just loaded, so keep it first
    earlier.prepend(moreBtn);
  }
  let userScrolled = false;
  const onScroll = () => { userScrolled = true; };
  window.addEventListener('scroll', onScroll, { passive: true, once: true });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (userScrolled && es.some((x) => x.isIntersecting)) loadEarlier(); }, { rootMargin: '80px 0px 0px 0px' });
    io.observe(moreBtn);
    window.addEventListener('hashchange', () => io.disconnect(), { once: true });
  }

  function help() {
    bubble('bot', h('div', null, tx('Just write it the way you talk:')),
      h('ul', null, h('li', null, '“gas 820, chai 40” → expenses'), h('li', null, '“sale 1500 upi” → money in'), h('li', null, '“Raju udhaar 300” → udhaar sale'), h('li', null, '“Sting 2 box 1020” → stock bought'), h('li', null, '“aaj kitna?” · “kal ka total” · “kitna udhaar” · “Sharma ka hisaab”')),
      chips([[tx('Today’s total'), () => ask('aaj kitna')], [tx('Make a bill'), () => navigate('#/bill')], [tx('Count cash'), () => navigate('#/counter')]]));
  }
  async function refresh() { day = await api(`/api/c/day/${date}`); dayData.set(date, day); }

  async function undo(btn) {
    const last = lastAdded.pop(); if (!last) return;
    saveUndo(date, lastAdded);
    if (btn) btn.disabled = true;
    try {
      await refresh(); // ids may have changed since the entry was added
      for (const key of last) { const k = key.split(':')[0]; const e = day[k]?.find((x) => keyOf(k, x) === key); if (e) await api(`/api/c/${k}/${e.id}`, { method: 'DELETE' }); }
      await refresh();
      for (const c of cards) if (c.date === date && last.includes(c.key)) { c.gone = true; c.el.classList.add('gone'); c.el.classList.remove('tap'); c.el.removeAttribute('role'); c.el.tabIndex = -1; }
      syncUndoChip();
      bubble('bot', h('div', null, 'Removed. ', h('span', { class: 'muted' }, `Sales ${money(day.report.collections.total)} · Spent ${money(day.report.purchases.total + day.report.expenses.total)}`))); }
    catch (e) { toast(e.message, true); lastAdded.push(last); saveUndo(date, lastAdded); if (btn) btn.disabled = false; syncUndoChip(); }
  }

  // ---- answers (nothing is written) ----
  const owed = async () => (can('reports.view') ? (await api('/api/c/reports/outstanding')).receivable || [] : null);
  const personRow = (p) => h('div', { class: 'ent' }, h('span', { class: 'et' }, p.party), h('b', { class: 'ea' }, money(p.balance)));
  async function answer(q) {
    if (q.type === 'day') {
      const d = addDays(date, q.offset);
      if (q.offset === 0) { await refresh(); return bubble('bot', h('div', null, tx('Today so far:')), summary(), chips([[tx('Open khata'), () => navigate(`#/day?date=${date}`)]])); }
      const data = await api(`/api/c/day/${d}`); dayData.set(d, data);
      if (!entriesOf(data).length) return bubble('bot', h('div', null, tx('Nothing was written for {date}.', null, { date: fmtDate(d) })));
      return bubble('bot', h('div', null, tx('{date}:', null, { date: q.offset === -1 ? tx('Yesterday') + ' · ' + fmtDate(d) : fmtDate(d) })), summary(data), chips([[tx('Open khata'), () => navigate(`#/day?date=${d}`)]]));
    }
    const list = await owed();
    if (list === null) return bubble('bot', h('div', null, tx('You don’t have access to udhaar totals.')));
    const open = chips([[tx('Open udhaar list'), () => navigate('#/ledger')]]);
    if (q.type === 'udhaar') {
      const due = list.filter((p) => p.balance > 0);
      if (!due.length) return bubble('bot', h('div', null, tx('No udhaar pending. 🎉')));
      return bubble('bot', h('div', null, tx('Udhaar to collect: {amt} from {n} customers', null, { amt: money(due.reduce((a, p) => a + p.balance, 0)), n: due.length })), due.slice(0, 5).map(personRow), due.length > 5 ? h('div', { class: 'muted small' }, tx('+{n} more', null, { n: due.length - 5 })) : null, open);
    }
    const hit = findParty(list, q.name);
    if (!hit.length) return bubble('bot', h('div', null, tx('No udhaar found for “{name}”.', null, { name: q.name })), open);
    return bubble('bot', h('div', null, hit.length === 1 ? (hit[0].balance >= 0 ? tx('{name} owes you {amt}', null, { name: hit[0].party, amt: money(hit[0].balance) }) : tx('You owe {name} {amt}', null, { name: hit[0].party, amt: money(-hit[0].balance) })) : tx('Matches for “{name}”:', null, { name: q.name })), hit.length > 1 ? hit.slice(0, 5).map(personRow) : null, open);
  }

  let lastSent = { text: '', at: 0 };
  async function ask(text) {
    const ctx = { defaultYear: Number(date.slice(0, 4)), today: date, products: (state.products || []).filter((p) => p.active !== 0).map((p) => ({ id: p.id, name: p.name, pieces_per_unit: p.pieces_per_unit || 1 })), categories: (state.categories || []).map((c) => c.name) };
    const r = readDump(text, ctx);
    const found = r.expenses.length + r.purchases.length + r.collections.length;
    // the same entry text twice in a few seconds is usually a double tap: ask first
    const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
    if (found && W && norm === lastSent.text && Date.now() - lastSent.at < DUP_MS) {
      if (!(await confirmDialog(tx('You just sent this. Add it again?'), { danger: false, okText: tx('Add again') }))) { if (!ta.value) { ta.value = text; grow(); } return; }
    }
    bubble('me', h('div', { class: 'mt' }, text));
    const low = text.toLowerCase();
    if (!found) {
      const q = readQuestion(text);
      if (q) { try { return await answer(q); } catch (e) { return bubble('bot', h('div', { class: 'neg' }, e.message)); } }
      if (/kitna|total|hisab|hisaab|summary|kaisa|today|aaj|din/.test(low)) { await refresh(); return bubble('bot', h('div', null, tx('Today so far:')), summary(), chips([[tx('Open khata'), () => navigate(`#/day?date=${date}`)]])); }
      if (/bill|invoice/.test(low)) return bubble('bot', h('div', null, tx('Let’s make a bill.')), chips([[tx('Make a bill'), () => navigate('#/bill')]]));
      if (/cash|gin|count|galla|drawer/.test(low)) return bubble('bot', h('div', null, tx('Count the notes in the drawer:')), chips([[tx('Count cash'), () => navigate('#/counter')]]));
      if (/help|kaise|how|\?$/.test(low)) return help();
      return bubble('bot', h('div', null, tx('I couldn’t find an amount there. Put the amount next to what it was for, like “gas 820”.')), chips([[tx('Show examples'), () => help()]]));
    }
    if (!W) return bubble('bot', h('div', null, tx('You can view this shop but not add entries.')));
    lastSent = { text: norm, at: Date.now() };
    const groups = new Map();
    const put = (d) => { const k = d || date; if (!groups.has(k)) groups.set(k, { date: k, purchases: [], expenses: [], collections: [] }); return groups.get(k); };
    r.expenses.forEach((e) => put(e.date).expenses.push({ category: e.category, amount: String(e.amount), payment_mode: e.payment_mode, notes: e.notes }));
    r.purchases.forEach((p) => put(p.date).purchases.push({ item: p.item, product_name: p.item, qty: p.qty, unit: p.unit, pieces: p.pieces, total: String(p.total), payment_mode: p.payment_mode }));
    r.collections.forEach((c) => put(c.date).collections.push({ amount: String(c.amount), mode: c.mode, customer: c.customer }));
    const before = ids(day);
    try {
      for (const g of groups.values()) await api('/api/c/bulk', { method: 'POST', body: g });
      await refresh();
    } catch (e) { lastSent = { text: '', at: 0 }; return bubble('bot', h('div', { class: 'neg' }, e.message)); }
    const added = KS.flatMap((k) => day[k].filter((e) => !before.has(keyOf(k, e))).map((e) => [k, e]));
    lastAdded.push(added.map(([k, e]) => keyOf(k, e))); saveUndo(date, lastAdded); syncUndoChip();
    const other = [...groups.keys()].filter((d) => d !== date);
    const undoBtn = h('button', { type: 'button', class: 'chip small', onclick: (ev) => undo(ev.currentTarget) }, tx('Undo'));
    bubble('bot', h('div', null, tx('Added {n} entries', null, { n: found }), other.length ? ` (${other.length === 1 ? 'one on ' + other[0] : 'some on other days'})` : '', ':'),
      added.map(([k, e]) => entryCard(k, e)), summary(), h('div', { class: 'bubchips' }, undoBtn));
  }

  // ---- composer ----
  const ta = h('textarea', { rows: '1', placeholder: tx('Type what happened…'), 'aria-label': tx('Message'), enterkeyhint: 'send', maxlength: String(MAX), autocomplete: 'off', autocapitalize: 'sentences' });
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; };
  let sending = false;
  const send = async () => {
    if (sending) return; // double tap
    let t = ta.value.trim(); if (!t) return;
    if (t.length > MAX) { t = t.slice(0, MAX); toast(tx('Long message: only the first {n} characters were used', null, { n: MAX })); }
    sending = true; ta.value = ''; grow(); sendBtn.disabled = true;
    try { await ask(t); } catch (e) { toast(e.message, true); } finally { sending = false; sendBtn.disabled = false; ta.focus({ preventScroll: true }); }
  };
  ta.addEventListener('input', grow);
  // Hindi/Japanese keyboards use Enter to pick a word: never send while composing
  let composing = false, compEnd = 0;
  ta.addEventListener('compositionstart', () => { composing = true; });
  ta.addEventListener('compositionend', () => { composing = false; compEnd = Date.now(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || composing || e.keyCode === 229 || Date.now() - compEnd < 40) return;
    if (matchMedia('(hover: hover)').matches) { e.preventDefault(); send(); }
  });
  const sendBtn = h('button', { class: 'send', type: 'button', 'aria-label': tx('Send'), onclick: send }, icon('right', 22));

  // voice: Indian English understands Hinglish numbers well ("chai 40" works); Hindi when the app is Hindi.
  // Same care as the landing mic: denied, offline, nothing heard, stop on tap / leaving / tab hidden, double tap ignored.
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let mic = null, stopMic = () => {};
  if (SR) {
    mic = h('button', { class: 'mic', type: 'button', 'aria-label': tx('Speak'), 'aria-pressed': 'false' }, icon('mic', 20));
    let rec = null, heard = false, lastTap = 0;
    stopMic = () => { try { rec?.stop(); } catch { /* already stopped */ } };
    mic.addEventListener('click', () => {
      const now = Date.now(); if (now - lastTap < 350) return; lastTap = now;
      if (rec) { stopMic(); return; }
      if (navigator.onLine === false) return toast(tx('Voice needs the internet. You can type instead.'), true);
      let r; try { r = new SR(); } catch { return toast(tx('Voice is not available here'), true); }
      rec = r; heard = false; r.lang = isHindi() ? 'hi-IN' : 'en-IN'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      const startText = ta.value ? ta.value.trim() + ' ' : '';
      r.onresult = (e) => { heard = true; ta.value = (startText + [...e.results].map((x) => x[0].transcript).join(' ')).slice(0, MAX); grow(); };
      r.onend = () => { if (rec === r) rec = null; mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); if (!heard && !r._err) toast(tx('Didn’t hear anything. Tap the mic and try again.')); if (heard) ta.focus({ preventScroll: true }); };
      r.onerror = (e) => {
        r._err = e.error;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast(tx('Allow the microphone to speak entries'), true);
        else if (e.error === 'network') toast(tx('Voice needs the internet. You can type instead.'), true);
        else if (e.error === 'no-speech') toast(tx('Didn’t hear anything. Tap the mic and try again.'));
        else if (e.error !== 'aborted') toast(tx('Voice did not work. You can type instead.'), true);
      };
      try { mic.classList.add('on'); mic.setAttribute('aria-pressed', 'true'); r.start(); } catch { rec = null; mic.classList.remove('on'); mic.setAttribute('aria-pressed', 'false'); }
    });
    const quiet = () => { if (document.hidden) stopMic(); };
    document.addEventListener('visibilitychange', quiet);
    window.addEventListener('pagehide', stopMic);
    window.addEventListener('langchange', stopMic, { once: true });
    window.addEventListener('hashchange', function off() { window.removeEventListener('hashchange', off); stopMic(); document.removeEventListener('visibilitychange', quiet); window.removeEventListener('pagehide', stopMic); });
  }
  const undoChip = h('button', { type: 'button', class: 'chip small', onclick: (ev) => undo(ev.currentTarget) }, tx('Undo last'));
  function syncUndoChip() { undoChip.hidden = !lastAdded.length || !W; }
  const quick = h('div', { class: 'chatquick' },
    undoChip,
    [[tx('Today’s total'), () => ask('aaj kitna')], [tx('Make a bill'), () => navigate('#/bill')], [tx('Count cash'), () => navigate('#/counter')], [tx('Help'), () => help()]]
      .map(([l, fn]) => h('button', { type: 'button', class: 'chip small', onclick: fn }, l)));
  syncUndoChip();

  mount(main, h('div', { class: 'chat' }, log, h('div', { class: 'composer' }, quick, h('div', { class: 'cbox' }, mic, ta, sendBtn))));
  main.classList.add('chatmain');
  window.addEventListener('hashchange', function off() { window.removeEventListener('hashchange', off); main.classList.remove('chatmain'); });
  scroll();
}
