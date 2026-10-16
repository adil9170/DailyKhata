import { h, mount, toast, busy, modal, table, badge, confirmDialog, fmtDateTime } from '../ui.js';
import { api, state, navigate } from '../api.js';

export const PERM_LABELS = {
  'entries.view': 'View daily entries', 'entries.write': 'Add & edit entries', 'entries.delete': 'Delete entries', 'cash.close': 'Close day (cash count)',
  'products.manage': 'Manage products & categories', 'reports.view': 'View reports & profit', export: 'Export CSV / Excel', 'uploads.write': 'Upload photos & run OCR',
  'team.manage': 'Manage team', 'settings.manage': 'Branding & settings', 'audit.view': 'View audit log',
};
export const ROLE_LABELS = { company_admin: 'Admin', manager: 'Manager', staff: 'Staff (data entry)', viewer: 'Viewer (read only)' };

export async function teamPage(main) {
  const data = await api('/api/c/team');
  const rows = data.members.map((u) => h('tr', null,
    h('td', null, h('strong', null, u.name), h('div', { class: 'small muted' }, u.email)),
    h('td', null, ROLE_LABELS[u.role] || u.role, u.custom_permissions ? h('div', null, badge('custom permissions')) : null),
    h('td', null, badge(u.status, u.status === 'active' ? 'good' : 'bad')),
    h('td', { class: 'small muted' }, u.last_login_at ? fmtDateTime(u.last_login_at) : 'Never'),
    h('td', { class: 'right' }, h('span', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
      h('button', { class: 'small', onclick: () => memberForm(u, data, () => navigate('#/team')) }, 'Edit'),
      u.id !== state.user.id ? h('button', { class: 'small ghost danger', 'aria-label': 'Delete', onclick: async () => {
        if (!(await confirmDialog(`Remove ${u.name} from the team?`))) return;
        try { await api(`/api/c/team/${u.id}`, { method: 'DELETE' }); toast('Removed'); navigate('#/team'); } catch (e) { toast(e.message, true); }
      } }, '🗑') : null))));
  mount(main,
    h('div', { class: 'spread' }, h('div', null, h('h1', null, 'Team'), h('div', { class: 'muted' }, `${data.members.length} of ${state.company?.max_users ?? '∞'} users on your plan`)),
      h('button', { class: 'primary', onclick: () => memberForm(null, data, () => navigate('#/team')) }, '+ Add member')),
    h('div', { class: 'card' }, table(['Member', 'Role', 'Status', 'Last sign-in', ''], rows)));
}

export function memberForm(u, data, done, { endpoint } = {}) {
  const name = h('input', { required: true, value: u?.name ?? '' });
  const email = h('input', { type: 'email', required: !u, value: u?.email ?? '', disabled: !!u });
  const password = h('input', { type: 'password', autocomplete: 'new-password', required: !u, placeholder: u ? 'Leave blank to keep' : '' });
  const role = h('select', null, Object.entries(ROLE_LABELS).map(([v, l]) => h('option', { value: v, selected: (u?.role ?? 'staff') === v ? 'selected' : null }, l)));
  const status = h('select', null, ['active', 'disabled'].map((s) => h('option', { value: s, selected: (u?.status ?? 'active') === s ? 'selected' : null }, s)));
  const permBox = h('div', { class: 'grid g2', style: { gap: '6px' } });
  let current = new Set(u?.permissions ?? data.role_defaults[role.value] ?? []);
  const renderPerms = () => mount(permBox, data.all_permissions.map((p) => h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: role.value === 'company_admin' || current.has(p), disabled: role.value === 'company_admin', onchange: (e) => { e.target.checked ? current.add(p) : current.delete(p); } }), PERM_LABELS[p] || p)));
  role.addEventListener('change', () => { current = new Set(data.role_defaults[role.value] ?? []); renderPerms(); });
  renderPerms();
  const btn = h('button', { class: 'primary', type: 'submit' }, u ? 'Save' : 'Add member');
  const L = (t, el, hint) => h('div', { class: 'field' }, h('label', null, t, el), hint ? h('div', { class: 'small muted' }, hint) : null);
  const form = h('form', null, h('div', { class: 'fields' }, L('Name', name), L('Email (login)', email), L(u ? 'Reset password' : 'Password', password, '8+ characters, letters and numbers'), L('Role', role), u ? L('Status', status) : null),
    h('h3', null, 'Permissions'), h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Role sets the defaults; tick or untick to customise. Admins always have everything.'), permBox,
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, btn));
  const m = modal(u ? `Edit ${u.name}` : 'Add team member', form);
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    const body = { name: name.value, role: role.value, permissions: role.value === 'company_admin' ? null : [...current] };
    if (!u) Object.assign(body, { email: email.value, password: password.value });
    else { body.status = status.value; if (password.value) body.password = password.value; }
    const url = endpoint ? endpoint(u) : u ? `/api/c/team/${u.id}` : '/api/c/team';
    await api(url, { method: u ? 'PUT' : 'POST', body });
    m.close(); toast('Saved'); done();
  })(); });
}
