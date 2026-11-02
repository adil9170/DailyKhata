import { h, mount, toast, busy, table, confirmDialog } from '../ui.js';
import { api, state, can, companyUrl, refreshLists, navigate, applyBranding } from '../api.js';
import { getTheme, setTheme, applyTheme, styleScheme } from '../theme.js';
import { STYLES, currentStyle, setStyle } from '../styles.js';
import { LAYOUTS, SECTIONS, SHORTCUTS, readHome, writeHome, homeParts, isQuickLayout, move } from '../home.js';
import { TEMPLATES, readReceiptPrefs, writeReceiptPrefs, DEFAULT_THANKS } from '../receiptprefs.js';
import { icon } from '../ui.js';
import { modeCards, getMode, modeOrDefault } from '../mode.js';
import { brandFromImage } from '../color.js';
import { t as tx, lang, setLang } from '../i18n.js';

// Settings > Style: a card per look, with four colours as a preview
function stylePicker() {
  const cur = currentStyle().id;
  const groups = [['basic', tx('Basics')], ['mix', tx('Mix of all')], ['art', tx('Art styles')]];
  const grid = (g) => h('div', { class: 'stylegrid' }, STYLES.filter((s) => s.group === g).map((s) => h('button', {
      type: 'button', class: 'stylecard' + (s.id === cur ? ' on' : ''), 'aria-pressed': s.id === cur ? 'true' : 'false',
      onclick: async (e) => {
        if (s.id === currentStyle().id) return;
        e.currentTarget.classList.add('loading');
        await setStyle(s.id);
        applyTheme();
        window.dispatchEvent(new Event('themechange'));
      },
    }, h('span', { class: 'sw4', 'aria-hidden': 'true' }, s.swatch.map((c) => h('i', { style: { background: c } }))),
      h('span', { class: 'nm' }, s.name), h('span', { class: 'bl' }, tx(s.blurb)))));
  // the 19 art styles fold away (open when one of them is in use) so Settings stays short
  const art = STYLES.filter((s) => s.group === 'art');
  return h('div', { role: 'group', 'aria-label': tx('Style') }, groups.map(([g, label]) => (g === 'art'
    ? h('details', { class: 'morefold', open: currentStyle().group === 'art' }, h('summary', null, h('span', null, label), h('span', { class: 'muted small' }, String(art.length))), grid(g))
    : [h('div', { class: 'stylegroup' }, label), grid(g)])).flat());
}

// Settings > Home screen: pick a layout (cards with a tiny sketch of it), then switch parts on or off and reorder them.
const SKETCH = {
  quick: ['bar', 'tri', 'field', 'btn', 'pair'],
  grid: ['bar', 'row3', 'row3', 'row3'],
  summary: ['big', 'line', 'line', 'line', 'pair'],
  minimal: ['bar', 'bigbtn', 'line'],
  day: ['strip'],
  chat: ['bub', 'bubr', 'bub', 'input'],
};
function homeSettings() {
  const card = h('div', { class: 'card', id: 'home-settings' });
  let home = readHome();
  const save = (next, rerouteAll = false) => {
    home = next; writeHome(home);
    if (rerouteAll) window.dispatchEvent(new Event('themechange')); // Home tab and the + sheet follow the new layout
    else draw();
  };
  const setPart = (kind, list) => save({ ...home, per: { ...home.per, [home.layout]: { ...homeParts(home), ...home.per[home.layout], [kind]: list.map(({ id, on }) => ({ id, on })) } } });
  function partList(kind, all, label) {
    const parts = homeParts(home)[kind].filter((x) => { const d = all.find((a) => a.id === x.id); return d && (!d.perm || can(d.perm)); });
    const full = homeParts(home)[kind];
    const name = (id) => tx(all.find((a) => a.id === id).name);
    const update = (fn) => { const idx = (id) => full.findIndex((x) => x.id === id); setPart(kind, fn(full, idx)); };
    return h('div', { class: 'homeparts', role: 'list', 'aria-label': label }, parts.map((x, i) => h('div', { class: 'homepart' + (x.on ? '' : ' off'), role: 'listitem' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: x.on, 'data-k': `${kind}:${x.id}:on`, onchange: (e) => update((f, idx) => f.map((y) => (y.id === x.id ? { ...y, on: e.target.checked } : y))) }), name(x.id)),
      h('button', { type: 'button', class: 'ghost icon', 'aria-label': `${tx('Move up')}: ${name(x.id)}`, 'data-k': `${kind}:${x.id}:up`, disabled: i === 0, onclick: () => update((f, idx) => move(f, idx(x.id), idx(parts[i - 1].id) - idx(x.id))) }, icon('up', 18)),
      h('button', { type: 'button', class: 'ghost icon', 'aria-label': `${tx('Move down')}: ${name(x.id)}`, 'data-k': `${kind}:${x.id}:down`, disabled: i === parts.length - 1, onclick: () => update((f, idx) => move(f, idx(x.id), idx(parts[i + 1].id) - idx(x.id))) }, icon('down', 18)))));
  }
  function draw() {
    const focusKey = document.activeElement?.dataset?.k;
    const quick = isQuickLayout(home.layout);
    mount(card,
      h('h2', null, tx('Home screen')),
      h('p', { class: 'small muted', style: { marginTop: 0 } }, tx('Pick how Home looks, then choose what it shows. Saved on this device.')),
      h('div', { class: 'stylegrid homegrid', role: 'group', 'aria-label': tx('Home screen') }, LAYOUTS.map((l) => h('button', {
        type: 'button', class: 'stylecard homecard' + (l.id === home.layout ? ' on' : ''), 'aria-pressed': l.id === home.layout ? 'true' : 'false',
        onclick: () => { if (l.id !== home.layout) save({ ...home, layout: l.id }, true); },
      }, h('span', { class: 'sketch', 'aria-hidden': 'true' }, SKETCH[l.id].map((k) => h('i', { class: 'sk-' + k }))), h('span', { class: 'nm' }, tx(l.name)), h('span', { class: 'bl' }, tx(l.desc))))),
      quick ? [
        h('h3', { class: 'homehead' }, tx('What Home shows')),
        partList('sections', SECTIONS, tx('What Home shows')),
        h('details', { class: 'morefold', open: !!card.querySelector('details.morefold[open]') || !!document.activeElement?.dataset?.k?.startsWith('shortcuts:') },
          h('summary', null, h('span', null, tx('Shortcuts')), h('span', { class: 'muted small' }, tx('{n} on', null, { n: homeParts(home).shortcuts.filter((x) => x.on && can(SHORTCUTS.find((d) => d.id === x.id)?.perm)).length }))),
          partList('shortcuts', SHORTCUTS, tx('Shortcuts'))),
        h('div', { class: 'row', style: { marginTop: '12px' } },
          h('button', { type: 'button', class: 'small', onclick: () => { const per = { ...home.per }; delete per[home.layout]; save({ ...home, per }); toast(tx('Back to the usual Home')); } }, tx('Reset this layout')),
          h('a', { class: 'btn small ghost', href: '#/' }, tx('See Home'))),
      ] : h('p', { class: 'small muted', style: { marginBottom: 0 } }, home.layout === 'chat' ? tx('Chat: type or speak what happened, like messaging a friend. It goes straight into your khata.') : tx('Khata strip: Home opens today’s khata, with every entry and the cash in the drawer.')));
    if (focusKey) { // keep keyboard and screen-reader focus on the row that moved (its other arrow if this one is now disabled)
      let el = card.querySelector(`[data-k="${focusKey}"]`);
      if (el?.disabled) el = el.parentElement.querySelector('button:not([disabled])') || el.parentElement.querySelector('input');
      el?.focus();
    }
  }
  draw();
  return card;
}

// Settings > Receipts: real thumbnails of each design (drawn with this shop's name, logo and colour), the default
// design, and the thank-you line printed at the bottom of bills.
let receiptThumbUrls = [];
function receiptSettings() {
  receiptThumbUrls.forEach((u) => URL.revokeObjectURL(u)); receiptThumbUrls = [];
  const card = h('div', { class: 'card', id: 'receipt-settings' });
  let prefs = readReceiptPrefs();
  const imgs = new Map(TEMPLATES.map((t) => [t.id, h('img', { class: 'rthumb', alt: '', loading: 'lazy' })]));
  const thanks = h('input', { value: prefs.thanks, maxlength: '80', placeholder: tx(DEFAULT_THANKS), 'aria-label': tx('Thank-you line') });
  thanks.addEventListener('change', () => { prefs = writeReceiptPrefs({ ...readReceiptPrefs(), thanks: thanks.value }); thanks.value = prefs.thanks; toast(tx('Saved')); });
  const grid = h('div', { class: 'stylegrid rgrid', role: 'group', 'aria-label': tx('Receipt design') });
  const drawGrid = () => mount(grid, TEMPLATES.map((t) => h('button', {
    type: 'button', class: 'stylecard rcard' + (t.id === prefs.tpl ? ' on' : ''), 'aria-pressed': t.id === prefs.tpl ? 'true' : 'false',
    onclick: () => { prefs = writeReceiptPrefs({ ...readReceiptPrefs(), tpl: t.id }); drawGrid(); },
  }, h('span', { class: 'rthumbwrap', 'aria-hidden': 'true' }, imgs.get(t.id)), h('span', { class: 'nm' }, tx(t.name)), h('span', { class: 'bl' }, tx(t.desc)))));
  drawGrid();
  const sample = h('button', { type: 'button', class: 'small' }, icon('share', 16), tx('See a sample'));
  sample.addEventListener('click', async () => { const r = await import('../receipt.js'); r.openReceiptSheet(r.sampleReceipt(state.company)); });
  mount(card,
    h('h2', null, tx('Receipts')),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, tx('Pick how shared bills, cash reports and notes look. Saved on this device.')),
    grid,
    h('div', { class: 'field', style: { marginTop: '16px' } }, h('label', null, tx('Thank-you line'), thanks)),
    h('p', { class: 'small muted', style: { marginTop: '-4px' } }, tx('Printed at the bottom of bills. Leave it empty for none.')),
    h('div', { class: 'row' }, sample));
  // draw the thumbnails one by one after the page is up, so Settings opens instantly
  (async () => {
    const { renderReceipt, sampleReceipt } = await import('../receipt.js');
    for (let i = 0; i < 30 && !card.isConnected; i++) await new Promise((r) => setTimeout(r, 100)); // wait for the page to be shown
    for (const t of TEMPLATES) {
      if (!card.isConnected) return; // left Settings: stop drawing
      try { const blob = await renderReceipt(sampleReceipt(state.company), { tpl: t.id, scale: 1 }); const u = URL.createObjectURL(blob); receiptThumbUrls.push(u); imgs.get(t.id).src = u; } catch { /* a thumbnail is optional */ }
    }
  })();
  return card;
}

export async function settingsPage(main) {
  const c = state.company;
  const S = can('settings.manage'), M = can('products.manage');
  const sections = [];
  const cur0 = getTheme();
  const curLang = lang();
  sections.push(h('div', { class: 'card' }, h('h2', null, tx('Language / भाषा')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': tx('App language') }, [['en', 'English'], ['hi', 'हिंदी']].map(([v, l]) =>
      h('button', { class: curLang === v ? 'on' : '', role: 'radio', 'aria-checked': curLang === v ? 'true' : 'false', lang: v, onclick: () => { if (v !== curLang) setLang(v); } }, l))),
    h('p', { class: 'small muted', style: { marginBottom: 0 } }, tx('Hindi or English. Saved on this device.'))));
  sections.push(h('div', { class: 'card' }, h('h2', null, tx('Experience')),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, tx('Choose how much of DailyKhata you want to see. Your data is the same in every mode.')),
    modeCards(getMode() || modeOrDefault())));
  sections.push(h('div', { class: 'card' }, h('h2', null, tx('Appearance')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': tx('Appearance') }, [['system', tx('System'), 'monitor'], ['light', tx('Light'), 'sun'], ['dark', tx('Dark'), 'moon']].map(([v, l, ic]) =>
      h('button', { class: cur0 === v ? 'on' : '', role: 'radio', 'aria-checked': cur0 === v ? 'true' : 'false', onclick: () => setTheme(v) }, icon(ic, 16), l))),
    h('p', { class: 'small muted' }, 'System follows your phone or computer setting. Saved on this device.'),
    styleScheme() ? h('p', { class: 'small muted' }, tx('Your style has its own colours, so Light and Dark do not change it. Pick Clean, Bento or Neumorphism to use them.')) : null,
    h('h3', { style: { margin: '12px 0 4px', fontSize: '.95rem' } }, tx('Style')),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, tx('Changes only how the app looks. Your data stays the same. Saved on this device.')),
    stylePicker()));
  sections.push(homeSettings());
  sections.push(receiptSettings());

  if (S) {
    const f = {
      name: h('input', { required: true, value: c.name }), business_type: h('input', { value: c.business_type ?? '', placeholder: 'e.g. Cold drinks shop' }),
      phone: h('input', { value: c.phone ?? '' }), email: h('input', { type: 'email', value: c.email ?? '' }), gstin: h('input', { value: c.gstin ?? '' }),
      address: h('textarea', { style: { minHeight: '70px' } }, c.address ?? ''),
      primary_color: h('input', { type: 'color', value: c.primary_color }), accent_color: h('input', { type: 'color', value: c.accent_color }),
    };
    f.primary_color.addEventListener('input', () => applyBranding({ ...c, primary_color: f.primary_color.value, accent_color: f.accent_color.value }));
    const btn = h('button', { class: 'primary', type: 'submit' }, tx('Save branding & details'));
    const L = (t, el) => h('div', { class: 'field' }, h('label', null, t, el));
    const form = h('form', null,
      h('div', { class: 'fields' }, L(tx('Company name'), f.name), L(tx('Business type'), f.business_type), L(tx('Phone'), f.phone), L(tx('Email'), f.email), L('GSTIN', f.gstin)),
      L(tx('Address'), f.address),
      h('div', { class: 'row' }, L('Brand colour', f.primary_color), L('Accent colour', f.accent_color)), btn);
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
      await api('/api/c/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) });
      toast(tx('Saved')); window.dispatchEvent(new Event('dk:reload-context'));
    })(); });
    // Logo is optional. When one is added we can suggest store colours from it; the owner stays in control.
    const logoIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden' });
    const pickBtn = h('button', { type: 'button' }, icon('camera', 18), c.has_logo ? 'Change logo' : tx('Add your logo'));
    pickBtn.addEventListener('click', () => logoIn.click());
    const matchBox = h('input', { type: 'checkbox', checked: true });
    const suggestion = h('div', { class: 'brandsuggest hidden' });
    let suggested = null;
    const saveColours = (cols) => api('/api/c/settings', { method: 'PUT', body: {
      name: c.name, business_type: c.business_type ?? '', phone: c.phone ?? '', email: c.email ?? '', gstin: c.gstin ?? '', address: c.address ?? '',
      primary_color: cols.primary, accent_color: cols.accent } });
    const showSuggestion = (cols) => {
      suggested = cols;
      suggestion.classList.remove('hidden');
      mount(suggestion,
        h('div', { class: 'swatches' }, [cols.primary, cols.accent].map((x, i) => h('span', { class: 'sw', style: { background: x }, title: i ? 'Accent' : 'Brand colour' }))),
        h('label', { class: 'check' }, matchBox, 'Match my store colours to this logo'),
        h('div', { class: 'small muted' }, 'Optional. You can change colours later or switch this off.'));
      f.primary_color.value = cols.primary; f.accent_color.value = cols.accent;
      applyBranding({ ...c, primary_color: cols.primary, accent_color: cols.accent });
    };
    logoIn.addEventListener('change', async () => {
      const file = logoIn.files[0]; if (!file) return;
      try { const cols = await brandFromImage(file); if (cols) showSuggestion(cols); else toast('Logo has no clear colour; keeping your current colours'); } catch { /* preview only */ }
      const fd = new FormData(); fd.append('file', file);
      pickBtn.disabled = true;
      try {
        await api('/api/c/settings/logo', { method: 'POST', form: fd });
        if (suggested && matchBox.checked) await saveColours(suggested);
        toast('Logo updated'); window.dispatchEvent(new Event('dk:reload-context'));
      } catch (e) { toast(e.message, true); } finally { pickBtn.disabled = false; }
    });
    matchBox.addEventListener('change', () => {
      applyBranding(matchBox.checked && suggested ? { ...c, primary_color: suggested.primary, accent_color: suggested.accent } : c);
    });
    const fromCurrent = c.has_logo ? h('button', { type: 'button', class: 'ghost' }, 'Match colours to my logo') : null;
    if (fromCurrent) fromCurrent.addEventListener('click', async () => {
      try {
        const res = await api('/api/c/logo', { raw: true });
        const cols = await brandFromImage(await res.blob());
        if (!cols) return toast('This logo has no clear colour', true);
        await saveColours(cols); toast('Store colours updated from your logo'); window.dispatchEvent(new Event('dk:reload-context'));
      } catch (e) { toast(e.message, true); }
    });
    const resetColours = h('button', { type: 'button', class: 'ghost', onclick: async () => { await saveColours({ primary: '#635bff', accent: '#f59e0b' }); toast('Colours reset'); window.dispatchEvent(new Event('dk:reload-context')); } }, 'Reset colours');
    sections.push(h('div', { class: 'card' }, h('h2', null, 'Your store branding'),
      h('p', { class: 'small muted' }, 'Optional. Add your logo and we will suggest colours that match it. Your name, logo and colours appear only in your own portal.'),
      h('div', { class: 'logorow' },
        c.has_logo ? h('img', { src: companyUrl(`/api/c/logo?v=${encodeURIComponent(c.updated_at)}`), alt: 'Current logo', class: 'logoprev' }) : h('div', { class: 'logoprev empty' }, icon('camera', 22)),
        h('div', { class: 'grow' }, pickBtn, logoIn, suggestion)),
      h('div', { class: 'row', style: { marginTop: '8px' } }, fromCurrent, resetColours,
        c.has_logo ? h('button', { type: 'button', class: 'ghost danger', onclick: async () => { await api('/api/c/settings/logo', { method: 'DELETE' }); window.dispatchEvent(new Event('dk:reload-context')); } }, tx('Remove logo')) : null),
      h('h3', { style: { marginTop: '16px' } }, tx('Business details')), form));
  }

  if (M) {
    const name = h('input', { placeholder: tx('New category, e.g. Electricity'), 'aria-label': tx('New category') });
    const add = h('button', null, tx('Add'));
    add.addEventListener('click', busy(add, async () => { if (!name.value.trim()) { name.focus(); return; } await api('/api/c/categories', { method: 'POST', body: { name: name.value } }); await refreshLists(); navigate('#/settings'); }));
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add.click(); } });
    // one line per category, actions on the right (it was a phone-squeezed table: three lines each)
    sections.push(h('div', { class: 'card' }, h('h2', null, tx('Expense categories')),
      h('div', { class: 'list catlist' }, state.categories.map((k) => h('div', { class: 'li' },
        h('div', { class: 'body' }, h('div', { class: 't' }, k.name)),
        h('div', { class: 'acts' },
          h('button', { class: 'small ghost', 'aria-label': `${tx('Rename')} ${k.name}`, onclick: async () => { const n = prompt(tx('Rename category'), k.name); if (!n || n.trim() === k.name) return; try { await api(`/api/c/categories/${k.id}`, { method: 'PUT', body: { name: n } }); await refreshLists(); navigate('#/settings'); } catch (e) { toast(e.message, true); } } }, tx('Rename')),
          h('button', { class: 'small ghost danger', 'aria-label': `${tx('Delete')} ${k.name}`, onclick: async () => { if (!(await confirmDialog(tx('Delete “{name}”?', null, { name: k.name })))) return; try { await api(`/api/c/categories/${k.id}`, { method: 'DELETE' }); await refreshLists(); navigate('#/settings'); } catch (e) { toast(e.message, true); } } }, tx('Delete')))))),
      h('div', { class: 'addrow' }, name, add)));
  }

  const cur = h('input', { type: 'password', autocomplete: 'current-password' }), nw = h('input', { type: 'password', autocomplete: 'new-password' });
  const pbtn = h('button', null, tx('Change password'));
  pbtn.addEventListener('click', busy(pbtn, async () => { await api('/api/auth/password', { method: 'POST', body: { current_password: cur.value, new_password: nw.value } }); cur.value = nw.value = ''; toast('Password changed; other devices signed out'); }));
  sections.push(h('div', { class: 'card' }, h('h2', null, tx('My account')), h('p', { class: 'muted small' }, `${state.user.name} · ${state.user.email}`),
    h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', null, tx('Current password'), cur)), h('div', { class: 'field' }, h('label', null, tx('New password'), nw)), h('div', { class: 'field' }, pbtn))));

  mount(main, h('div', { class: 'page-head' }, h('div', null, h('h1', null, tx('Settings')), h('div', { class: 'sub' }, tx('Appearance, branding and your account')))), sections);
}
