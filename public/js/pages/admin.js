import { h, mount, money, rupees, num, bytes, fmtDateTime, tile, table, badge, toast, busy, modal, confirmDialog, icon } from '../ui.js';
import { api, download, navigate } from '../api.js';
import { auditRows } from './audit.js';
import { memberForm, ROLE_LABELS, PERM_LABELS } from './team.js';

const L = (t, el, hint) => h('div', { class: 'field' }, h('label', null, t, el), hint ? h('div', { class: 'small muted' }, hint) : null);

export async function adminOverviewPage(main) {
  const d = await api('/api/admin/overview');
  const s = d.stats;
  mount(main, h('h1', null, 'Super admin'), h('p', { class: 'muted' }, 'All companies at a glance (last 30 days).'),
    h('div', { class: 'tiles' }, tile('Companies', num(s.companies), `${s.active_companies} active`), tile('Users', num(s.users)),
      tile('Collections (30d)', money(s.collections_30d)), tile('Purchases (30d)', money(s.purchases_30d)), tile('Storage used', bytes(s.storage_bytes)), tile('Events (24h)', num(s.events_24h))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', null, 'Companies'), table(['Company', 'Plan', 'Users', 'Collections 30d', 'Last activity'], d.companies.map((c) => h('tr', null,
        h('td', null, h('a', { href: `#/admin/company/${c.id}` }, c.name), c.status !== 'active' ? h('span', null, ' ', badge(c.status, 'bad')) : null), h('td', null, c.plan_name || '—'),
        h('td', { class: 'num' }, c.users), h('td', { class: 'num' }, money(c.collections_30d)), h('td', { class: 'small muted' }, fmtDateTime(c.last_activity)))), { empty: 'No companies yet' })),
      h('div', { class: 'card' }, h('h2', null, 'Recent activity'), table(['When', 'Company', 'Who', 'Action', 'Record', ''], auditRows(d.recent, { showCompany: true })))));
}

export async function adminCompaniesPage(main) {
  const [companies, plans] = await Promise.all([api('/api/admin/companies'), api('/api/admin/plans')]);
  const search = h('input', { type: 'search', placeholder: 'Search companies', style: { maxWidth: '260px' } });
  const body = h('tbody');
  const render = () => { const q = search.value.toLowerCase(); mount(body, companies.filter((c) => c.name.toLowerCase().includes(q)).map((c) => h('tr', null,
    h('td', null, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', background: c.primary_color, marginRight: '8px' } }), h('a', { href: `#/admin/company/${c.id}` }, c.name), h('div', { class: 'small muted' }, c.slug)),
    h('td', null, badge(c.status, c.status === 'active' ? 'good' : 'bad')), h('td', null, c.plan_name || '—'), h('td', { class: 'num' }, c.users), h('td', { class: 'num' }, c.products),
    h('td', { class: 'num' }, bytes(c.storage_bytes)), h('td', { class: 'small muted' }, fmtDateTime(c.last_activity)),
    h('td', { class: 'right' }, h('a', { class: 'btn small', href: `#/admin/company/${c.id}` }, 'Manage'))))); };
  search.addEventListener('input', render); render();
  mount(main, h('div', { class: 'page-head' }, h('h1', null, 'Companies'), h('button', { class: 'primary', onclick: () => companyForm(null, plans) }, icon('plus', 17), 'New company')),
    h('div', { class: 'card' }, h('div', { class: 'row', style: { marginBottom: '8px' } }, search),
      h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['Company', 'Status', 'Plan', 'Users', 'Products', 'Storage', 'Last activity', ''].map((t) => h('th', null, t)))), body))));
}

function companyForm(c, plans, done) {
  const f = {
    name: h('input', { required: true, value: c?.name ?? '' }), business_type: h('input', { value: c?.business_type ?? '' }),
    plan_id: h('select', null, h('option', { value: '' }, 'No plan (unlimited)'), plans.map((p) => h('option', { value: p.id, selected: c?.plan_id === p.id ? 'selected' : null }, `${p.name} — ${money(p.price_paise)}/mo`))),
    phone: h('input', { value: c?.phone ?? '' }), email: h('input', { type: 'email', value: c?.email ?? '' }), gstin: h('input', { value: c?.gstin ?? '' }), address: h('input', { value: c?.address ?? '' }),
    primary_color: h('input', { type: 'color', value: c?.primary_color ?? '#0f766e' }), accent_color: h('input', { type: 'color', value: c?.accent_color ?? '#f59e0b' }),
  };
  const adm = c ? null : { admin_name: h('input', { required: true }), admin_email: h('input', { type: 'email', required: true }), admin_password: h('input', { type: 'password', required: true, autocomplete: 'new-password' }) };
  const btn = h('button', { class: 'primary', type: 'submit' }, c ? 'Save' : 'Create company');
  const form = h('form', null,
    h('div', { class: 'fields' }, L('Company name', f.name), L('Business type', f.business_type), L('Plan', f.plan_id), L('Phone', f.phone), L('Email', f.email), L('GSTIN', f.gstin)),
    L('Address', f.address), h('div', { class: 'row' }, L('Brand colour', f.primary_color), L('Accent', f.accent_color)),
    adm ? [h('h3', null, 'First company admin'), h('div', { class: 'fields' }, L('Name', adm.admin_name), L('Email (login)', adm.admin_email), L('Password', adm.admin_password, '8+ chars, letters & numbers'))] : null,
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '10px' } }, btn));
  const m = modal(c ? `Edit ${c.name}` : 'New company', form, { wide: true });
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    const body = Object.fromEntries(Object.entries({ ...f, ...(adm || {}) }).map(([k, el]) => [k, el.value]));
    if (c) body.status = c.status;
    const r = await api(c ? `/api/admin/companies/${c.id}` : '/api/admin/companies', { method: c ? 'PUT' : 'POST', body });
    m.close(); toast(c ? 'Saved' : 'Company created'); done ? done() : navigate(`#/admin/company/${r.id}`);
  })(); });
}

export async function adminCompanyPage(main, id, { openPortal }) {
  const [d, plans] = await Promise.all([api(`/api/admin/companies/${id}`), api('/api/admin/plans')]);
  const c = d.company, s = d.stats;
  const reload = () => navigate(`#/admin/company/${id}`);
  const setStatus = async (status) => {
    if (status === 'suspended' && !(await confirmDialog(`Suspend ${c.name}? All its users will be signed out and blocked until reactivated.`, { okText: 'Suspend' }))) return;
    await api(`/api/admin/companies/${id}`, { method: 'PUT', body: { ...c, status } }); toast(status === 'active' ? 'Reactivated' : 'Suspended'); reload();
  };
  const del = () => {
    const conf = h('input', { placeholder: c.name });
    const btn = h('button', { class: 'primary', style: { background: 'var(--bad)', borderColor: 'var(--bad)' } }, 'Delete permanently');
    const m = modal('Delete company', h('div', null, h('p', null, 'This deletes all of the company’s users, entries, products and uploaded files. A final backup is kept in storage.'),
      L(`Type “${c.name}” to confirm`, conf), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn)));
    btn.addEventListener('click', busy(btn, async () => { await api(`/api/admin/companies/${id}`, { method: 'DELETE', body: { confirm_name: conf.value } }); m.close(); toast('Company deleted'); navigate('#/admin/companies'); }));
  };
  const fakeTeam = { all_permissions: Object.keys(PERM_LABELS), role_defaults: { company_admin: [], manager: ['entries.view', 'entries.write', 'entries.delete', 'cash.close', 'products.manage', 'reports.view', 'export', 'uploads.write', 'audit.view'], staff: ['entries.view', 'entries.write', 'cash.close', 'uploads.write'], viewer: ['entries.view', 'reports.view'] } };
  const addUser = () => {
    const f = { name: h('input', { required: true }), email: h('input', { type: 'email', required: true }), password: h('input', { type: 'password', required: true, autocomplete: 'new-password' }),
      role: h('select', null, Object.entries(ROLE_LABELS).map(([v, l]) => h('option', { value: v }, l))) };
    const btn = h('button', { class: 'primary', type: 'submit' }, 'Add user');
    const form = h('form', null, h('div', { class: 'fields' }, L('Name', f.name), L('Email', f.email), L('Password', f.password), L('Role', f.role)), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn));
    const m = modal(`Add user to ${c.name}`, form);
    form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
      await api(`/api/admin/companies/${id}/users`, { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) }); m.close(); toast('User added'); reload();
    })(); });
  };
  const backupBtn = h('button', null, icon('database', 17), 'Back up now');
  backupBtn.addEventListener('click', busy(backupBtn, async () => { await api(`/api/admin/companies/${id}/backup`, { method: 'POST' }); toast('Backup saved'); reload(); }));

  mount(main,
    h('div', { class: 'spread' }, h('div', null, h('a', { href: '#/admin/companies', class: 'small' }, '← Companies'), h('h1', null, c.name, ' ', badge(c.status, c.status === 'active' ? 'good' : 'bad')),
      h('div', { class: 'muted' }, [c.business_type, c.phone, c.email].filter(Boolean).join(' · ') || c.slug)),
      h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => openPortal(id) }, 'Open portal →'),
        h('button', { onclick: () => companyForm(c, plans, reload) }, 'Edit'),
        c.status === 'active' ? h('button', { onclick: () => setStatus('suspended') }, 'Suspend') : h('button', { onclick: () => setStatus('active') }, 'Reactivate'),
        h('button', { class: 'danger', onclick: del }, 'Delete'))),
    h('div', { class: 'tiles' }, tile('Plan', c.plan_name || 'Unlimited'), tile('Collections (30d)', money(s.collections_30d), `${s.active_days_30d} active days`), tile('Purchases (30d)', money(s.purchases_30d)),
      tile('Expenses (30d)', money(s.expenses_30d)), tile('Products', num(s.products)), tile('Files', num(s.documents), bytes(s.storage_bytes))),
    h('div', { class: 'card' }, h('div', { class: 'sec-head' }, h('h2', { style: { margin: 0 } }, 'Users & access'), h('button', { class: 'small primary', onclick: addUser }, icon('plus', 17), 'Add user')),
      table(['User', 'Role', 'Status', 'Last sign-in', ''], d.users.map((u) => h('tr', null,
        h('td', null, h('strong', null, u.name), h('div', { class: 'small muted' }, u.email)), h('td', null, ROLE_LABELS[u.role] || u.role), h('td', null, badge(u.status, u.status === 'active' ? 'good' : 'bad')),
        h('td', { class: 'small muted' }, u.last_login_at ? fmtDateTime(u.last_login_at) : 'Never'),
        h('td', { class: 'right' }, h('span', { class: 'row', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
          h('button', { class: 'small', onclick: () => memberForm({ ...u, permissions: u.permissions ? JSON.parse(u.permissions) : null }, fakeTeam, reload, { endpoint: (x) => `/api/admin/users/${x.id}` }) }, 'Edit'),
          h('button', { class: 'ghost icon small danger', 'aria-label': 'Delete', title: 'Delete', onclick: async () => { if (!(await confirmDialog(`Delete ${u.name}?`))) return; await api(`/api/admin/users/${u.id}`, { method: 'DELETE' }); toast('Deleted'); reload(); } }, icon('trash', 18)))))))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', null, 'Recent activity'), table(['When', 'Who', 'Action', 'Record', ''], auditRows(d.activity))),
      h('div', { class: 'card' }, h('div', { class: 'sec-head' }, h('h2', { style: { margin: 0 } }, 'Backups'), backupBtn),
        table(['When', 'Type', 'Size', ''], d.backups.map((b) => h('tr', null, h('td', null, fmtDateTime(b.created_at)), h('td', null, b.kind), h('td', null, bytes(b.size_bytes)),
          h('td', { class: 'right' }, h('button', { class: 'small', onclick: () => download(`/api/admin/backups/${b.id}/download`, 'backup.json') }, icon('download', 17))))), { empty: 'Nightly backups appear here' }))));
}

export async function adminPlansPage(main) {
  const plans = await api('/api/admin/plans');
  const form = (p) => {
    const f = { name: h('input', { required: true, value: p?.name ?? '' }), price: h('input', { inputmode: 'decimal', value: p ? rupees(p.price_paise) : '0' }),
      max_users: h('input', { type: 'number', min: 1, value: p?.max_users ?? 5 }), max_products: h('input', { type: 'number', min: 1, value: p?.max_products ?? 200 }),
      max_storage_mb: h('input', { type: 'number', min: 1, value: p?.max_storage_mb ?? 500 }), ocr_enabled: h('input', { type: 'checkbox', checked: p ? !!p.ocr_enabled : true }) };
    const btn = h('button', { class: 'primary', type: 'submit' }, 'Save');
    const el = h('form', null, h('div', { class: 'fields' }, L('Plan name', f.name), L('Price ₹ / month', f.price), L('Max users', f.max_users), L('Max products', f.max_products), L('Storage (MB)', f.max_storage_mb)),
      h('label', { class: 'check' }, f.ocr_enabled, 'Photo reading (OCR) included'), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, btn));
    const m = modal(p ? `Edit ${p.name}` : 'New plan', el);
    el.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
      await api(p ? `/api/admin/plans/${p.id}` : '/api/admin/plans', { method: p ? 'PUT' : 'POST', body: { name: f.name.value, price: f.price.value, max_users: Number(f.max_users.value), max_products: Number(f.max_products.value), max_storage_mb: Number(f.max_storage_mb.value), ocr_enabled: f.ocr_enabled.checked } });
      m.close(); toast('Saved'); navigate('#/admin/plans');
    })(); });
  };
  mount(main, h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Plans & limits'), h('div', { class: 'muted' }, 'Limits are enforced on the server for every company on the plan.')), h('button', { class: 'primary', onclick: () => form(null) }, icon('plus', 17), 'New plan')),
    h('div', { class: 'card' }, table(['Plan', 'Price', 'Users', 'Products', 'Storage', 'OCR', 'Companies', ''], plans.map((p) => h('tr', null,
      h('td', null, h('strong', null, p.name)), h('td', { class: 'num' }, money(p.price_paise)), h('td', { class: 'num' }, p.max_users), h('td', { class: 'num' }, p.max_products), h('td', { class: 'num' }, `${p.max_storage_mb} MB`),
      h('td', null, p.ocr_enabled ? badge('yes', 'good') : badge('no')), h('td', { class: 'num' }, p.companies),
      h('td', { class: 'right' }, h('button', { class: 'small', onclick: () => form(p) }, 'Edit'),
        h('button', { class: 'ghost icon small danger', 'aria-label': 'Delete', title: 'Delete', onclick: async () => { if (!(await confirmDialog(`Delete plan ${p.name}?`))) return; try { await api(`/api/admin/plans/${p.id}`, { method: 'DELETE' }); navigate('#/admin/plans'); } catch (e) { toast(e.message, true); } } }, icon('trash', 18))))))));
}

export async function adminActivityPage(main) {
  const body = h('tbody'); const more = h('button', null, 'Load more'); let last = null;
  const load = async () => { const rows = await api('/api/admin/activity' + (last ? `?before=${last}` : '')); body.append(...auditRows(rows, { showCompany: true })); if (rows.length) last = rows[rows.length - 1].id; more.classList.toggle('hidden', rows.length < 100); };
  more.addEventListener('click', load);
  mount(main, h('h1', null, 'Activity across all companies'), h('div', { class: 'card' }, h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, ['When', 'Company', 'Who', 'Action', 'Record', 'IP'].map((t) => h('th', null, t)))), body)), more));
  await load();
}

export async function adminBackupsPage(main) {
  const rows = await api('/api/admin/backups');
  mount(main, h('h1', null, 'Backups'), h('p', { class: 'muted' }, 'Every company is backed up to private R2 storage nightly (kept 30 days). Final backups of deleted companies are retained. D1 also keeps 30 days of point-in-time recovery (Time Travel).'),
    h('div', { class: 'card' }, table(['When', 'Company', 'Type', 'Size', ''], rows.map((b) => h('tr', null, h('td', null, fmtDateTime(b.created_at)), h('td', null, b.company_name || `#${b.company_id} (deleted)`),
      h('td', null, b.kind), h('td', null, bytes(b.size_bytes)), h('td', { class: 'right' }, h('button', { class: 'small', onclick: () => download(`/api/admin/backups/${b.id}/download`, 'backup.json') }, icon('download', 17), 'Download')))), { empty: 'No backups yet — the first runs tonight' })));
}
