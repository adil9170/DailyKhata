import { h, mount, toast, busy, table, confirmDialog } from '../ui.js';
import { api, state, can, companyUrl, refreshLists, navigate, applyBranding } from '../api.js';
import { getTheme, setTheme } from '../theme.js';
import { icon } from '../ui.js';

export async function settingsPage(main) {
  const c = state.company;
  const S = can('settings.manage'), M = can('products.manage');
  const sections = [];
  const cur0 = getTheme();
  sections.push(h('div', { class: 'card' }, h('h2', null, 'Appearance'),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Appearance' }, [['system', 'System', 'monitor'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([v, l, ic]) =>
      h('button', { class: cur0 === v ? 'on' : '', role: 'radio', 'aria-checked': cur0 === v ? 'true' : 'false', onclick: () => setTheme(v) }, icon(ic, 16), l))),
    h('p', { class: 'small muted', style: { marginBottom: 0 } }, 'System follows your phone or computer setting. Saved on this device.')));

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
    const logoIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' });
    const up = h('button', null, 'Upload logo');
    up.addEventListener('click', busy(up, async () => {
      if (!logoIn.files[0]) return toast('Choose an image', true);
      const fd = new FormData(); fd.append('file', logoIn.files[0]);
      await api('/api/c/settings/logo', { method: 'POST', form: fd }); toast('Logo updated'); window.dispatchEvent(new Event('dk:reload-context'));
    }));
    sections.push(h('div', { class: 'card' }, h('h2', null, 'Branding & business details'),
      h('p', { class: 'small muted' }, 'Your name, logo and colours appear only in your company portal.'), form,
      h('h3', { style: { marginTop: '16px' } }, 'Logo'),
      h('div', { class: 'row' }, c.has_logo ? h('img', { src: companyUrl(`/api/c/logo?v=${encodeURIComponent(c.updated_at)}`), alt: 'Current logo', style: { height: '56px', borderRadius: '8px', border: '1px solid var(--border)' } }) : h('span', { class: 'muted' }, 'No logo yet'),
        logoIn, up, c.has_logo ? h('button', { class: 'ghost danger', onclick: async () => { await api('/api/c/settings/logo', { method: 'DELETE' }); window.dispatchEvent(new Event('dk:reload-context')); } }, 'Remove') : null)));
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
