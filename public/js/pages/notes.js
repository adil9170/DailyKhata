// Smart notes: write lines like a notebook, the numbers add up as you type. Saved on the phone first, synced later.
import { h, mount, money, num, toast, icon, pageHead, confirmDialog, fmtDate } from '../ui.js';
import { api, state, can, navigate, todayLocal } from '../api.js';
import { calcNote } from '../../../src/lib/notescalc.ts';
import { amountToWords } from '../../../src/lib/words.ts';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const fmt = (v) => money(Math.round(v * 100));
const preview = (b) => String(b || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' · ');

export async function notesPage(main, params) {
  const id = params.get('id');
  if (id) return editor(main, id);
  const W = can('entries.write');
  const notes = await api('/api/c/notes');
  const items = notes.map((n) => {
    const r = calcNote(n.body || '');
    return h('a', { class: 'notecard', href: `#/notes?id=${n.client_id}` },
      h('div', { class: 'nc-main' },
        h('div', { class: 'nc-title' }, n.pinned ? icon('pin', 14) : null, n.title || preview(n.body).slice(0, 40) || 'Untitled note'),
        h('div', { class: 'small muted nc-sub' }, preview(n.body) || 'Empty'),
        h('div', { class: 'tiny muted' }, fmtDate((n.updated_at || '').slice(0, 10) || todayLocal(), { day: 'numeric', month: 'short' }))),
      h('div', { class: 'nc-total' }, fmt(r.total)));
  });
  mount(main,
    pageHead('Notes', 'Type lines — the total adds itself', W ? h('button', { class: 'primary small', onclick: () => navigate(`#/notes?id=${newId()}&new=1`) }, icon('plus', 16), 'New note') : null),
    items.length ? h('div', { class: 'notelist' }, items)
      : h('div', { class: 'card empty' }, h('div', null, 'No notes yet.'), W ? h('button', { class: 'primary', style: { marginTop: '12px' }, onclick: () => navigate(`#/notes?id=${newId()}&new=1`) }, 'Write your first note') : null,
        h('div', { class: 'small muted', style: { marginTop: '12px' } }, 'Try: “Chai 3 x 12”, “Milk 2 x 35”, “Rent 5000 - 10%”')));
}

async function editor(main, clientId) {
  const W = can('entries.write');
  const existing = (await api('/api/c/notes')).find((n) => n.client_id === clientId);
  const note = { title: existing?.title || '', body: existing?.body || '', entry_date: existing?.entry_date || null, pinned: existing?.pinned ? 1 : 0 };
  let dirty = false, timer = null, saving = Promise.resolve(), lang = 'en';

  const title = h('input', { class: 'ntitle', placeholder: 'Title (optional)', maxlength: '120', value: note.title, disabled: !W, 'aria-label': 'Note title' });
  const ta = h('textarea', { class: 'nta', wrap: 'off', spellcheck: 'false', autocapitalize: 'sentences', rows: '10', disabled: !W, 'aria-label': 'Note lines',
    placeholder: 'Chai 3 x 12\nMilk 2 x 35\nSugar 1020 - 10%\ntotal' });
  ta.value = note.body;
  const results = h('div', { class: 'nres', 'aria-hidden': 'true' });
  const totalEl = h('div', { class: 'ctotal' });
  const wordsEl = h('div', { class: 'cwords' });
  const saveEl = h('span', { class: 'tiny muted' }, existing ? 'Saved' : '');

  const paint = () => {
    const r = calcNote(ta.value);
    results.replaceChildren(...r.lines.map((l) => h('div', { class: 'nl ' + l.kind },
      l.kind === 'amount' ? fmt(l.value) : l.kind === 'subtotal' ? 'Σ ' + fmt(l.value) : l.kind === 'error' ? '?' : ' ')));
    totalEl.textContent = fmt(r.total);
    wordsEl.textContent = r.total > 0 ? amountToWords(Math.round(r.total * 100), lang, true) : '';
    results.style.transform = `translateY(${-ta.scrollTop}px)`;
    return r;
  };
  const save = () => {
    dirty = false; clearTimeout(timer);
    const body = { title: title.value.trim(), body: ta.value, entry_date: note.entry_date, pinned: note.pinned };
    saveEl.textContent = 'Saving…';
    saving = api(`/api/c/notes/${clientId}`, { method: 'PUT', body }).then(() => { if (!dirty) saveEl.textContent = 'Saved'; }, (e) => { toast(e.message, true); saveEl.textContent = 'Not saved'; });
    return saving;
  };
  const touch = () => { dirty = true; saveEl.textContent = 'Typing…'; clearTimeout(timer); timer = setTimeout(save, 700); };
  ta.addEventListener('input', () => { paint(); touch(); });
  ta.addEventListener('scroll', () => { results.style.transform = `translateY(${-ta.scrollTop}px)`; });
  title.addEventListener('input', touch);
  window.addEventListener('hashchange', function once() { window.removeEventListener('hashchange', once); if (dirty) save(); }); // never lose typing when leaving

  const shareNote = async () => {
    const r = paint(); if (!r.total && !ta.value.trim()) return toast('Write something first', true);
    const { openReceiptSheet } = await import('../receipt.js');
    const src = ta.value.split('\n');
    const lines = src.map((raw, i) => ({ raw: raw.trim(), r: r.lines[i] })).filter((x) => x.raw)
      .map((x) => x.r.kind === 'subtotal' ? { label: 'Subtotal', value: fmt(x.r.value), kind: 'sub' }
        : { label: x.raw, value: x.r.kind === 'amount' ? fmt(x.r.value) : '', negative: x.r.kind === 'amount' && x.r.value < 0, kind: x.r.kind === 'label' && !/\d/.test(x.raw) ? 'muted' : undefined });
    openReceiptSheet({ company: state.company, title: title.value.trim() || 'Notes', lines, total: fmt(r.total), words: r.total > 0 ? amountToWords(Math.round(r.total * 100), lang, true) : '' });
  };
  const addToDay = async () => {
    await (dirty ? save() : saving);
    navigate(`#/day?date=${state.today || todayLocal()}&add=text&text=${encodeURIComponent(ta.value)}`);
  };
  const del = async () => {
    if (!(await confirmDialog('Delete this note?'))) return;
    clearTimeout(timer); dirty = false;
    try { await api(`/api/c/notes/${clientId}`, { method: 'DELETE' }); navigate('#/notes'); } catch (e) { toast(e.message, true); }
  };
  const pinBtn = h('button', { class: 'ghost icon small', 'aria-label': 'Pin note', onclick: () => { note.pinned = note.pinned ? 0 : 1; pinBtn.classList.toggle('on', !!note.pinned); touch(); } }, icon('pin', 18));
  pinBtn.classList.toggle('on', !!note.pinned);
  const langBtn = h('button', { class: 'chip small', type: 'button', onclick: () => { lang = lang === 'en' ? 'hi' : 'en'; langBtn.textContent = lang === 'en' ? 'हिंदी' : 'English'; paint(); } }, 'हिंदी');

  mount(main,
    pageHead('Notes', null, h('a', { class: 'ghost small', href: '#/notes', role: 'button' }, icon('left', 16), 'All notes'), W && existing ? h('button', { class: 'ghost icon small', 'aria-label': 'Delete note', onclick: del }, icon('trash', 18)) : null),
    h('div', { class: 'card ncard' },
      h('div', { class: 'ntrow' }, title, W ? pinBtn : null),
      h('div', { class: 'nwrap' }, results, ta),
      h('div', { class: 'small muted nhint' }, 'One line per item · “3 x 12” multiplies · “- 10%” discounts · “total” gives a subtotal · starting with “-” deducts')),
    h('div', { class: 'cbar' },
      h('div', { class: 'cbar-top' }, h('div', null, h('div', { class: 'k small muted' }, 'Total'), totalEl, saveEl), langBtn),
      wordsEl,
      h('div', { class: 'cbtns' }, h('button', { class: 'primary', onclick: shareNote }, icon('share', 18), 'Share receipt'),
        W ? h('button', { onclick: addToDay }, 'Add to my day') : null)));
  paint();
  if (W && !existing) ta.focus();
}
