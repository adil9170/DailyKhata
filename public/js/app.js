import { h, mount, toast, field, input, busy } from './ui.js';
import { api, state, loadContext, applyBranding, setViewCompany, isSuper, can, companyUrl } from './api.js';
import { dashboardPage } from './pages/dashboard.js';
import { dayPage } from './pages/day.js';
import { productsPage } from './pages/products.js';
import { uploadsPage } from './pages/uploads.js';
import { reportsPage } from './pages/reports.js';
import { ledgerPage } from './pages/ledger.js';
import { teamPage } from './pages/team.js';
import { settingsPage } from './pages/settings.js';
import { auditPage } from './pages/audit.js';
import { adminOverviewPage, adminCompaniesPage, adminCompanyPage, adminPlansPage, adminActivityPage, adminBackupsPage } from './pages/admin.js';

const app = document.getElementById('app');

// theme toggle (per-viewer convenience)
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
try { applyTheme(localStorage.getItem('dk_theme')); } catch { /* ignore */ }
function toggleTheme() {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next); try { localStorage.setItem('dk_theme', next); } catch { /* ignore */ }
  window.dispatchEvent(new Event('themechange'));
}

const companyRoutes = [
  { path: 'dashboard', label: 'Dashboard', icon: '📊', page: dashboardPage, perm: 'reports.view' },
  { path: 'day', label: 'Daily Entry', icon: '📝', page: dayPage, perm: 'entries.view' },
  { path: 'uploads', label: 'Photos & Bills', icon: '📷', page: uploadsPage, perm: 'entries.view' },
  { path: 'products', label: 'Products', icon: '📦', page: productsPage, perm: 'entries.view' },
  { path: 'reports', label: 'Reports & Export', icon: '📑', page: reportsPage, perm: 'reports.view' },
  { path: 'ledger', label: 'Udhaar / Outstanding', icon: '💳', page: ledgerPage, perm: 'entries.view' },
  { path: 'team', label: 'Team', icon: '👥', page: teamPage, perm: 'team.manage', sep: true },
  { path: 'settings', label: 'Settings', icon: '⚙️', page: settingsPage, perm: null },
  { path: 'audit', label: 'Audit Log', icon: '🕑', page: auditPage, perm: 'audit.view' },
];
const adminRoutes = [
  { path: 'admin', label: 'Overview', icon: '📊', page: adminOverviewPage },
  { path: 'admin/companies', label: 'Companies', icon: '🏢', page: adminCompaniesPage },
  { path: 'admin/plans', label: 'Plans & Limits', icon: '🎚️', page: adminPlansPage },
  { path: 'admin/activity', label: 'Activity', icon: '🕑', page: adminActivityPage },
  { path: 'admin/backups', label: 'Backups', icon: '💾', page: adminBackupsPage },
];

async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null; state.company = null; setViewCompany(null); applyBranding(null);
  location.hash = '#/login';
}

function layout(routes, active, content, { portalOf } = {}) {
  const side = h('aside', { class: 'side' });
  const company = state.company;
  const brand = portalOf || !isSuper()
    ? h('div', { class: 'brandbox' },
        company?.has_logo ? h('img', { src: companyUrl(`/api/c/logo?v=${encodeURIComponent(company.updated_at || '')}`), alt: '' }) : h('div', { class: 'brandmark' }, (company?.name || 'D')[0].toUpperCase()),
        h('div', null, h('div', { class: 'bname' }, company?.name || 'DailyKhata'), h('div', { class: 'small muted' }, company?.plan_name ? `${company.plan_name} plan` : '')))
    : h('div', { class: 'brandbox' }, h('div', { class: 'brandmark' }, 'D'), h('div', null, h('div', { class: 'bname' }, 'DailyKhata'), h('div', { class: 'small muted' }, 'Super admin')));
  const nav = h('nav', { class: 'nav' }, routes.filter((r) => !r.perm || can(r.perm)).map((r) => [
    r.sep ? h('div', { class: 'sep' }) : null,
    h('a', { href: `#/${r.path}`, class: active === r.path ? 'active' : '', onclick: () => side.classList.remove('open') }, h('span', { 'aria-hidden': 'true' }, r.icon), r.label),
  ]));
  mount(side, brand, nav,
    h('div', { class: 'foot' },
      portalOf ? h('button', { class: 'small', style: { width: '100%', marginBottom: '8px' }, onclick: () => { setViewCompany(null); state.company = null; applyBranding(null); location.hash = '#/admin/companies'; } }, '← Back to super admin') : null,
      h('div', { class: 'small' }, h('strong', null, state.user.name)),
      h('div', { class: 'small muted' }, state.user.email, ' · ', state.user.role.replace('_', ' ')),
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'small', onclick: toggleTheme, 'aria-label': 'Toggle dark mode' }, 'Theme'),
        h('button', { class: 'small', onclick: logout }, 'Sign out'))));
  const top = h('div', { class: 'topbar' },
    h('button', { class: 'small', 'aria-label': 'Menu', onclick: () => side.classList.toggle('open') }, '☰'),
    h('strong', null, (portalOf || !isSuper()) ? company?.name || 'DailyKhata' : 'DailyKhata Admin'));
  const main = h('main', { class: 'main' }, portalOf ? h('div', { class: 'banner' }, `Viewing ${company?.name} as super admin — changes are recorded in the audit log under your name.`) : null, content);
  mount(app, h('div', { class: 'shell' }, side, h('div', null, top, main)));
  return main;
}

function authPage(title, form) {
  mount(app, h('div', { class: 'auth' }, h('div', { class: 'card' },
    h('div', { class: 'logo' }, h('div', { class: 'brandmark' }, 'D'), h('div', null, h('div', { class: 'bname', style: { fontWeight: 700, fontSize: '1.15rem' } }, 'DailyKhata'), h('div', { class: 'small muted' }, 'Daily accounts & inventory'))),
    h('h2', null, title), form)));
}

function loginPage() {
  const email = input({ type: 'email', name: 'email', autocomplete: 'username', required: true });
  const pw = input({ type: 'password', name: 'password', autocomplete: 'current-password', required: true });
  const btn = h('button', { class: 'primary', type: 'submit', style: { width: '100%' } }, 'Sign in');
  const form = h('form', null, field('Email', email), field('Password', pw), btn);
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    await api('/api/auth/login', { method: 'POST', body: { email: email.value, password: pw.value } });
    await route(true);
  })(); });
  authPage('Sign in', form);
}

function setupPage() {
  const f = { setup_token: input({ name: 'setup_token', type: 'password', required: true }), name: input({ name: 'name', required: true }), email: input({ name: 'email', type: 'email', required: true }), password: input({ name: 'password', type: 'password', autocomplete: 'new-password', required: true }) };
  const btn = h('button', { class: 'primary', type: 'submit', style: { width: '100%' } }, 'Create super admin');
  const form = h('form', null,
    h('p', { class: 'small muted' }, 'First-time setup. Enter the SETUP_TOKEN configured on the server to create the super admin account.'),
    field('Setup token', f.setup_token), field('Your name', f.name), field('Email', f.email), field('Password', f.password, 'At least 8 characters with letters and numbers'), btn);
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    await api('/api/auth/setup', { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) });
    toast('Super admin created'); location.hash = '#/admin'; await route(true);
  })(); });
  authPage('Welcome', form);
}

let ctxLoadedFor = null;
async function route(reloadUser = false) {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');

  if (path === 'setup') return setupPage();
  if (path === 'login') {
    if (!reloadUser) {
      const s = await api('/api/auth/setup').catch(() => ({ needed: false }));
      if (s.needed) { location.hash = '#/setup'; return; }
      return loginPage();
    }
  }
  if (!state.user || reloadUser) {
    try { const me = await api('/api/auth/me'); state.user = me.user; if (me.company) state.company = me.company; }
    catch { state.user = null; const s = await api('/api/auth/setup').catch(() => ({ needed: false })); location.hash = s.needed ? '#/setup' : '#/login'; if (s.needed) setupPage(); else loginPage(); return; }
  }

  const user = state.user;
  if (user.role === 'super_admin' && !state.viewCompanyId) {
    const segs = path.split('/');
    if (segs[0] !== 'admin') { location.hash = '#/admin'; return; }
    if (segs[1] === 'company' && segs[2]) {
      const main = layout(adminRoutes, 'admin/companies', h('div', { class: 'boot' }, 'Loading…'));
      return adminCompanyPage(main, Number(segs[2]), { openPortal: async (id) => { setViewCompany(id); ctxLoadedFor = null; location.hash = '#/dashboard'; } });
    }
    const r = adminRoutes.find((x) => x.path === path) || adminRoutes[0];
    const main = layout(adminRoutes, r.path, h('div', { class: 'boot' }, 'Loading…'));
    try { await r.page(main, params); } catch (e) { toast(e.message, true); }
    return;
  }

  // company portal
  const cid = state.viewCompanyId || user.company_id;
  if (ctxLoadedFor !== cid || reloadUser) {
    try { await loadContext(); ctxLoadedFor = cid; } catch (e) { toast(e.message, true); if (state.viewCompanyId) { setViewCompany(null); location.hash = '#/admin'; } return; }
  }
  const allowed = companyRoutes.filter((r) => !r.perm || can(r.perm));
  const seg = path.split('/')[0];
  const r = allowed.find((x) => x.path === seg) || allowed[0];
  if (r.path !== seg) { location.hash = '#/' + r.path; return; }
  const main = layout(companyRoutes, r.path, h('div', { class: 'boot' }, 'Loading…'), { portalOf: state.viewCompanyId });
  try { await r.page(main, params, path.split('/').slice(1)); } catch (e) { toast(e.message, true); mount(main, h('div', { class: 'card empty' }, e.message)); }
}

window.addEventListener('hashchange', () => route());
window.addEventListener('themechange', () => route());
window.addEventListener('dk:reload-context', async () => { await loadContext(); route(); });
route();
