import { h, mount, toast, busy, table, confirmDialog } from '../ui.js';
import { api, state, can, companyUrl, refreshLists, navigate, applyBranding } from '../api.js';
import { getTheme, setTheme } from '../theme.js';
import { icon } from '../ui.js';
import { modeCards, getMode, modeOrDefault } from '../mode.js';
import { brandFromImage } from '../color.js';

export async function settingsPage(main) {
  const c = state.company;
  const S = can('settings.manage'), M = can('products.manage');
  const sections = [];
  const cur0 = getTheme();
  sections.push(h('div', { class: 'card' }, h('h2', null, 'Experience'),
    h('p', { class: 'small muted', style: { marginTop: 0 } }, 'Choose how much of DailyKhata you want to see. Your data is the same in every mode.'),
    modeCards(getMode() || modeOrDefault())));
  sections.push(h('div', { class: 'card' }, h('h2', null, 'Appearance'),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Appearance' }, [['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([v, l, ic]) =>
      h('button', { class: cur0 === v ? 'on' : '', role: 'radio', 'aria-checked': cur0 === v ? 'true' : 'false', onclick: () => setTheme(v) }, icon(ic, 16), l))),
    h('p', { class: 'small muted' }, 'System follows your phone or computer setting. Saved on this device.'),
    h('h3', { style: { margin: '14px 0 8px', fontSize: '.95rem' } }, 'Style'),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Style' }, [['clean', 'Clean'], ['soft', 'Soft']].map(([v, l]) => {
      const cur = document.documentElement.dataset.style === 'soft' ? 'soft' : 'clean';
      return h('button', { class: cur === v ? 'on' : '', role: 'radio', 'aria-checked': cur === v ? 'true' : 'false', onclick: () => {
        try { if (v === 'soft') localStorage.setItem('dk_style', 'soft'); else localStorage.removeItem('dk_style'); } catch { /* storage blocked */ }
        if (v === 'soft') document.documentElement.dataset.style = 'soft'; else delete document.documentElement.dataset.style;
        window.dispatchEvent(new Event('themechange'));
      } }, l);
    })),
    h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'Soft: raised, pillow-like buttons and cards (neumorphism). Clean: flat and sharp.')));

  if (S) {
    const f = {
      name: h('input', { required: true, value: c.name }), business_type: h('input', { value: c.business_type ?? '', placeholder: 'e.g. Cold drinks shop' }),
      phone: h('input', { value: c.phone ?? '' }), email: h('input', { type: 'email', value: c.email ?? '' }), gstin: h('input', { value: c.gstin ?? '' }),
      address: h('textarea', { style: { minHeight: '70px' } }, c.address ?? ''),
      primary_color: h('input', { type: 'color', value: c.primary_color }), accent_color: h('input', { type: 'color', value: c.accent_color }),
    };
    f.primary_color.addEventListener('input', () => applyBranding({ ...c, primary_color: f.primary_color.value, accent_color: f.accent_color.value }));
    const btn = h('button', { class: 'primary', type: 'submit' }, 'Save branding & details');
    const L = (t, el) => h('div', { class: 'field' }, h('label', null, t, el));
    const form = h('form', null,
      h('div', { class: 'fields' }, L('Company name', f.name), L('Business type', f.business_type), L('Phone', f.phone), L('Email', f.email), L('GSTIN', f.gstin)),
      L('Address', f.address),
      h('div', { class: 'row' }, L('Brand colour', f.primary_color), L('Accent colour', f.accent_color)), btn);
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
      await api('/api/c/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) });
      toast('Saved'); window.dispatchEvent(new Event('dk:reload-context'));
    })(); });
    // Logo is optional. When one is added we can suggest store colours from it; the owner stays in control.
    const logoIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'hidden' });
    const pickBtn = h('button', { type: 'button' }, icon('camera', 18), c.has_logo ? 'Change logo' : 'Add your logo');
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
        c.has_logo ? h('button', { type: 'button', class: 'ghost danger', onclick: async () => { await api('/api/c/settings/logo', { method: 'DELETE' }); window.dispatchEvent(new Event('dk:reload-context')); } }, 'Remove logo') : null),
      h('h3', { style: { marginTop: '18px' } }, 'Business details'), form));
  }

  if (M) {
    const name = h('input', { placeholder: 'New category e.g. Electricity' });
    const add = h('button', null, 'Add');
    add.addEventListener('click', busy(add, async () => { if (!name.value.trim()) return; await api('/api/c/categories', { method: 'POST', body: { name: name.value } }); await refreshLists(); navigate('#/settings'); }));
    sections.push(h('div', { class: 'card' }, h('h2', null, 'Expense categories'),
      table(['Category', ''], state.categories.map((k) => h('tr', null, h('td', null, k.name), h('td', { class: 'right' },
        h('button', { class: 'small ghost', onclick: async () => { const n = prompt('Rename category', k.name); if (!n) return; try { await api(`/api/c/categories/${k.id}`, { method: 'PUT', body: { name: n } }); await refreshLists(); navigate('#/settings'); } catch (e) { toast(e.message, true); } } }, 'Rename'),
        h('button', { class: 'small ghost danger', onclick: async () => { if (!(await confirmDialog(`Delete “${k.name}”?`))) return; try { await api(`/api/c/categories/${k.id}`, { method: 'DELETE' }); await refreshLists(); navigate('#/settings'); } catch (e) { toast(e.message, true); } } }, 'Delete'))))),
      h('div', { class: 'row', style: { marginTop: '10px' } }, name, add)));
  }

  const cur = h('input', { type: 'password', autocomplete: 'current-password' }), nw = h('input', { type: 'password', autocomplete: 'new-password' });
  const pbtn = h('button', null, 'Change password');
  pbtn.addEventListener('click', busy(pbtn, async () => { await api('/api/auth/password', { method: 'POST', body: { current_password: cur.value, new_password: nw.value } }); cur.value = nw.value = ''; toast('Password changed; other devices signed out'); }));
  sections.push(h('div', { class: 'card' }, h('h2', null, 'My account'), h('p', { class: 'muted small' }, `${state.user.name} · ${state.user.email}`),
    h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', null, 'Current password', cur)), h('div', { class: 'field' }, h('label', null, 'New password', nw)), h('div', { class: 'field' }, pbtn))));

  mount(main, h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Settings'), h('div', { class: 'sub' }, 'Appearance, branding and your account'))), sections);
}
