import { h, mount, toast, field, input, busy, icon, actionSheet, autoLabelTables } from './ui.js';
import { api, state, loadContext, applyBranding, setViewCompany, isSuper, can, companyUrl, navigate, todayLocal } from './api.js';
import { getTheme, setTheme, effectiveTheme } from './theme.js';
import { MODES, getMode, modeOrDefault, initMode, openModeSheet, welcomeModePicker } from './mode.js';
import './device.js';

// Pages load on demand so the first screen only downloads what it needs (fast on a Redmi over mobile data).
const lazy = (file, name) => (...args) => import(file).then((m) => m[name](...args));
const quickPage = lazy('./pages/quick.js', 'quickPage');
const dashboardPage = lazy('./pages/dashboard.js', 'dashboardPage');
const dayPage = lazy('./pages/day.js', 'dayPage');
const productsPage = lazy('./pages/products.js', 'productsPage');
const uploadsPage = lazy('./pages/uploads.js', 'uploadsPage');
const reportsPage = lazy('./pages/reports.js', 'reportsPage');
const ledgerPage = lazy('./pages/ledger.js', 'ledgerPage');
const teamPage = lazy('./pages/team.js', 'teamPage');
const settingsPage = lazy('./pages/settings.js', 'settingsPage');
const auditPage = lazy('./pages/audit.js', 'auditPage');
const adminOverviewPage = lazy('./pages/admin.js', 'adminOverviewPage');
const adminCompaniesPage = lazy('./pages/admin.js', 'adminCompaniesPage');
const adminCompanyPage = lazy('./pages/admin.js', 'adminCompanyPage');
const adminPlansPage = lazy('./pages/admin.js', 'adminPlansPage');
const adminActivityPage = lazy('./pages/admin.js', 'adminActivityPage');
const adminBackupsPage = lazy('./pages/admin.js', 'adminBackupsPage');

const app = document.getElementById('app');

const ALL = ['layman', 'smart', 'nerdy'], SMART_UP = ['smart', 'nerdy'];
// `modes` = which experience modes show the page. `laymanLabel` is the friendlier name used in Layman mode.
const companyRoutes = [
  { path: 'quick', label: 'Quick add', short: 'Home', laymanLabel: 'Home', icon: 'zap', page: quickPage, perm: 'entries.write', modes: ALL },
  { path: 'dashboard', label: 'Dashboard', icon: 'chart', page: dashboardPage, perm: 'reports.view', modes: SMART_UP },
  { path: 'day', label: 'Daily Entry', short: 'Entry', laymanLabel: 'My day', icon: 'pen', page: dayPage, perm: 'entries.view', modes: ALL },
  { path: 'uploads', label: 'Photos & Bills', short: 'Photos', icon: 'camera', page: uploadsPage, perm: 'entries.view', modes: SMART_UP },
  { path: 'products', label: 'Products', icon: 'box', page: productsPage, perm: 'entries.view', modes: SMART_UP },
  { path: 'reports', label: 'Reports & Export', icon: 'file', page: reportsPage, perm: 'reports.view', modes: SMART_UP },
  { path: 'ledger', label: 'Udhaar / Outstanding', icon: 'wallet', page: ledgerPage, perm: 'entries.view', modes: SMART_UP },
  { path: 'team', label: 'Team', icon: 'users', page: teamPage, perm: 'team.manage', sep: true, modes: SMART_UP },
  { path: 'settings', label: 'Settings', icon: 'sliders', page: settingsPage, perm: null, modes: ALL },
  { path: 'audit', label: 'Audit Log', icon: 'clock', page: auditPage, perm: 'audit.view', modes: ['nerdy'] },
];
/** Pages this person may open in the current mode. */
const visibleCompanyRoutes = () => companyRoutes.filter((r) => (!r.perm || can(r.perm)) && r.modes.includes(modeOrDefault()));
const routeLabel = (r) => (modeOrDefault() === 'layman' && r.laymanLabel) || r.label;
/** Where "Home" goes: Quick add for Layman, the dashboard for everyone else who may see it. */
function homeRoute() {
  const rs = visibleCompanyRoutes();
  return (modeOrDefault() !== 'layman' && rs.find((r) => r.path === 'dashboard')) || rs.find((r) => r.path === 'quick') || rs[0];
}
const adminRoutes = [
  { path: 'admin', label: 'Overview', icon: 'chart', page: adminOverviewPage },
  { path: 'admin/companies', label: 'Companies', icon: 'building', page: adminCompaniesPage },
  { path: 'admin/plans', label: 'Plans & Limits', short: 'Plans', icon: 'layers', page: adminPlansPage },
  { path: 'admin/activity', label: 'Activity', icon: 'clock', page: adminActivityPage },
  { path: 'admin/backups', label: 'Backups', icon: 'database', page: adminBackupsPage },
];

async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  state.user = null; state.company = null; setViewCompany(null); applyBranding(null);
  location.hash = '#/login';
}

function themeButton() {
  const next = { system: 'light', light: 'dark', dark: 'system' };
  const ic = { system: 'monitor', light: 'sun', dark: 'moon' };
  const t = getTheme();
  return h('button', { class: 'ghost icon small', title: `Appearance: ${t} (tap to change)`, 'aria-label': `Appearance: ${t}. Change`, onclick: () => setTheme(next[t]) }, icon(ic[t], 18));
}

function modeChip() {
  const m = MODES.find((x) => x.id === modeOrDefault());
  return h('button', { class: 'modechip', title: 'Change mode', 'aria-label': `Mode: ${m.label}. Change`, onclick: openModeSheet }, icon(m.icon, 15), m.label);
}

/** Quick-add sheet behind the mobile "+" button. */
export function openQuickAdd() {
  const today = state.today || todayLocal();
  const date = (location.hash.match(/date=(\d{4}-\d{2}-\d{2})/) || [])[1] || today;
  if (modeOrDefault() === 'layman') return navigate(`#/quick?date=${date}`);
  const go = (what) => navigate(`#/day?date=${date}&add=${what}`);
  actionSheet('Add to today’s khata', [
    { icon: 'zap', title: 'Quick add', desc: 'Big-button entry: amount, then tap', onclick: () => navigate(`#/quick?date=${date}`) },
    { icon: 'bag', title: 'Purchase', desc: 'Stock you bought — boxes, pieces, cost', onclick: () => go('purchase') },
    { icon: 'receipt', title: 'Expense', desc: 'Gas, Wi-Fi, water, rent…', onclick: () => go('expense') },
    { icon: 'rupee', title: 'Collection', desc: 'Money from sales — cash, UPI, udhaar', onclick: () => go('collection') },
    { icon: 'type', title: 'Type hisaab', desc: 'Write lines like “Sting 2 boxes 1020 60”', onclick: () => go('text') },
    ...(can('uploads.write') ? [{ icon: 'camera', title: 'Scan a photo', desc: 'We read your handwritten page for you', onclick: () => pickPhoto(date) }] : []),
  ]);
}
function pickPhoto(date) {
  const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  document.body.append(inp);
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; inp.remove(); if (!f) return;
    toast('Uploading photo…');
    try { const { uploadDoc } = await import('./pages/day.js'); const doc = await uploadDoc(f, 'hisaab', date); navigate(`#/uploads?review=${doc.id}`); } catch (e) { toast(e.message, true); }
  });
  inp.click();
}

function layout(routes, active, { portalOf, title } = {}) {
  const company = state.company;
  const showCompany = portalOf || !isSuper();
  const side = h('aside', { class: 'side' });
  const scrim = h('div', { class: 'scrim', onclick: () => { side.classList.remove('open'); scrim.classList.remove('open'); } });
  const openMenu = () => { side.classList.add('open'); scrim.classList.add('open'); };
  const closeMenu = () => { side.classList.remove('open'); scrim.classList.remove('open'); };
  const mark = showCompany && company?.has_logo
    ? h('img', { src: companyUrl(`/api/c/logo?v=${encodeURIComponent(company.updated_at || '')}`), alt: '' })
    : h('div', { class: 'brandmark' }, ((showCompany ? company?.name : 'D') || 'D')[0].toUpperCase());
  const brand = h('div', { class: 'brandbox' }, mark,
    h('div', { style: { minWidth: 0 } }, h('div', { class: 'bname' }, showCompany ? company?.name || 'DailyKhata' : 'DailyKhata'),
      h('div', { class: 'small muted' }, showCompany ? (company?.plan_name ? `${company.plan_name} plan` : 'Daily khata') : 'Super admin')));
  const visible = showCompany ? visibleCompanyRoutes() : routes.filter((r) => !r.perm || can(r.perm));
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' }, visible.map((r) => [
    r.sep ? h('div', { class: 'sep' }) : null,
    h('a', { href: `#/${r.path}`, class: active === r.path ? 'active' : '', 'aria-current': active === r.path ? 'page' : null, onclick: closeMenu }, icon(r.icon), showCompany ? routeLabel(r) : r.label),
  ]));
  const initials = (state.user.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  mount(side, brand, nav,
    h('div', { class: 'foot' },
      portalOf ? h('button', { class: 'small block', onclick: () => { setViewCompany(null); state.company = null; applyBranding(null); location.hash = '#/admin/companies'; } }, icon('left', 16), 'Back to super admin') : null,
      showCompany ? modeChip() : null,
      h('div', { class: 'me' }, h('div', { class: 'avatar' }, initials),
        h('div', { style: { minWidth: 0, flex: 1 } }, h('div', { class: 'small', style: { fontWeight: 650 } }, state.user.name), h('div', { class: 'small muted', style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, state.user.role.replace('_', ' '))),
        themeButton(),
        h('button', { class: 'ghost icon small', title: 'Sign out', 'aria-label': 'Sign out', onclick: logout }, icon('logout', 18)))));

  const top = h('header', { class: 'topbar' },
    h('button', { class: 'topmark', 'aria-label': 'Open menu', onclick: openMenu }, showCompany && company?.has_logo ? h('img', { src: companyUrl(`/api/c/logo?v=${encodeURIComponent(company.updated_at || '')}`), alt: '' }) : h('div', { class: 'brandmark' }, ((showCompany ? company?.name : 'D') || 'D')[0].toUpperCase())),
    h('div', { class: 'title' }, title || (showCompany ? company?.name : 'DailyKhata Admin') || 'DailyKhata'),
    showCompany ? modeChip() : themeButton());

  // bottom tab bar (phones)
  let tabs;
  if (showCompany) {
    const vis = visibleCompanyRoutes();
    const home = homeRoute();
    const lay = modeOrDefault() === 'layman';
    const pick = (p) => vis.find((r) => r.path === p);
    const third = lay ? pick('settings') : pick('uploads');
    const tabRoutes = [home, home.path === 'day' ? null : pick('day'), third].filter(Boolean);
    const isHome = (r) => r.path === 'dashboard' || r.path === 'quick';
    const link = (r) => h('a', { href: `#/${r.path}`, class: active === r.path ? 'active' : '' }, icon(isHome(r) ? 'home' : r.icon), isHome(r) ? 'Home' : (lay && r.laymanLabel) || r.short || r.label);
    tabs = h('nav', { class: 'tabbar', 'aria-label': 'Quick navigation' },
      link(tabRoutes[0]),
      tabRoutes[1] ? link(tabRoutes[1]) : null,
      can('entries.write') ? h('button', { class: 'fab', 'aria-label': 'Add entry', onclick: openQuickAdd }, h('span', { class: 'ring' }, icon('plus')), '') : null,
      tabRoutes[2] && tabRoutes[2] !== tabRoutes[1] ? link(tabRoutes[2]) : null,
      h('button', { onclick: openMenu, 'aria-label': 'More' }, icon('grid'), 'More'));
  } else {
    tabs = h('nav', { class: 'tabbar', 'aria-label': 'Quick navigation' },
      routes.slice(0, 4).map((r) => h('a', { href: `#/${r.path}`, class: active === r.path ? 'active' : '' }, icon(r.icon), r.short || r.label)),
      h('button', { onclick: openMenu, 'aria-label': 'More' }, icon('grid'), 'More'));
  }

  const main = h('main', { class: 'main', id: 'main' }, h('div', { class: 'skeleton' }), h('div', { class: 'skeleton', style: { height: '260px' } }));
  mount(app, h('div', { class: 'shell' }, side, scrim, h('div', { style: { minWidth: 0 } }, top,
    portalOf ? h('div', { style: { padding: '12px 16px 0' } }, h('div', { class: 'banner', style: { margin: 0 } }, `Viewing ${company?.name} as super admin — your changes are audit-logged.`)) : null,
    main)), tabs);
  autoLabelTables(main);
  return main;
}

function authShell(title, sub, form) {
  mount(app, h('div', { class: 'auth' },
    h('section', { class: 'auth-hero' }, h('div', { class: 'mesh' }),
      h('div', { class: 'logo' }, h('div', { class: 'brandmark', style: { background: 'rgba(255,255,255,.18)' } }, 'D'), 'DailyKhata'),
      h('div', null,
        h('h1', null, 'Your daily hisaab, done in minutes.'),
        h('p', null, 'Purchases, expenses, collections and stock — with profit and cash checks calculated for you.'),
        h('ul', null,
          h('li', null, icon('camera'), 'Snap your register, we read it'),
          h('li', null, icon('box'), 'Stock bought, sold and left — automatically'),
          h('li', null, icon('lock'), 'Private to your company, backed up nightly'))),
      h('div', { class: 'small', style: { opacity: 0.75 } }, '© DailyKhata')),
    h('section', { class: 'auth-form' }, h('div', { class: 'inner' },
      h('h2', null, title), h('p', { class: 'muted', style: { marginTop: 0, marginBottom: '22px' } }, sub), form))));
}

function loginPage() {
  const email = input({ type: 'email', name: 'email', autocomplete: 'username', required: true, placeholder: 'you@business.com', inputmode: 'email' });
  const pw = input({ type: 'password', name: 'password', autocomplete: 'current-password', required: true, placeholder: '••••••••' });
  const btn = h('button', { class: 'primary block', type: 'submit', style: { minHeight: '48px', marginTop: '6px' } }, 'Sign in');
  const form = h('form', null, field('Email', email), field('Password', pw), btn,
    h('p', { class: 'small muted', style: { marginTop: '18px' } }, 'Forgot your password? Ask your company admin to reset it from Team.'));
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    await api('/api/auth/login', { method: 'POST', body: { email: email.value, password: pw.value } });
    await route(true);
  })(); });
  authShell('Welcome back', 'Sign in to your khata.', form);
}

function setupPage() {
  const f = { setup_token: input({ name: 'setup_token', type: 'password', required: true }), name: input({ name: 'name', required: true }), email: input({ name: 'email', type: 'email', required: true }), password: input({ name: 'password', type: 'password', autocomplete: 'new-password', required: true }) };
  const btn = h('button', { class: 'primary block', type: 'submit', style: { minHeight: '48px' } }, 'Create super admin');
  const form = h('form', null, field('Setup token', f.setup_token, 'The SETUP_TOKEN secret configured on the server'), field('Your name', f.name), field('Email', f.email), field('Password', f.password, 'At least 8 characters with letters and numbers'), btn);
  form.addEventListener('submit', (e) => { e.preventDefault(); busy(btn, async () => {
    await api('/api/auth/setup', { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value])) });
    toast('Super admin created'); location.hash = '#/admin'; await route(true);
  })(); });
  authShell('Set up DailyKhata', 'Create the super admin account. This works only once.', form);
}

let ctxLoadedFor = null;
async function route(reloadUser = false) {
  const hash = location.hash.replace(/^#\/?/, '') || '';
  const [path, query] = hash.split('?');
  const params = new URLSearchParams(query || '');
  document.querySelectorAll('.modal-bg').forEach((m) => m.remove());

  if (path === 'setup') return setupPage();
  if (path === 'login' && !reloadUser) {
    const s = await api('/api/auth/setup').catch(() => ({ needed: false }));
    if (s.needed) { location.hash = '#/setup'; return; }
    return loginPage();
  }
  if (!state.user || reloadUser) {
    try { const me = await api('/api/auth/me'); state.user = me.user; if (me.company) state.company = me.company; }
    catch { state.user = null; const s = await api('/api/auth/setup').catch(() => ({ needed: false })); location.hash = s.needed ? '#/setup' : '#/login'; if (s.needed) setupPage(); else loginPage(); return; }
  }

  const user = state.user;
  if (user.role === 'super_admin' && !state.viewCompanyId) {
    applyBranding(null);
    const segs = path.split('/');
    if (segs[0] !== 'admin') { location.hash = '#/admin'; return; }
    if (segs[1] === 'company' && segs[2]) {
      const main = layout(adminRoutes, 'admin/companies');
      return adminCompanyPage(main, Number(segs[2]), { openPortal: async (id) => { setViewCompany(id); ctxLoadedFor = null; location.hash = '#/dashboard'; } }).catch((e) => toast(e.message, true));
    }
    const r = adminRoutes.find((x) => x.path === path) || adminRoutes[0];
    const main = layout(adminRoutes, r.path);
    try { await r.page(main, params); } catch (e) { toast(e.message, true); }
    window.scrollTo(0, 0);
    return;
  }

  // company portal
  const cid = state.viewCompanyId || user.company_id;
  if (ctxLoadedFor !== cid || reloadUser) {
    try { await loadContext(); ctxLoadedFor = cid; } catch (e) { toast(e.message, true); if (state.viewCompanyId) { setViewCompany(null); location.hash = '#/admin'; } return; }
  }
  initMode(user);
  const seg = path.split('/')[0];
  // A page hidden by the current mode still opens when followed from a direct link.
  const r = visibleCompanyRoutes().find((x) => x.path === seg) || companyRoutes.find((x) => x.path === seg && (!x.perm || can(x.perm))) || homeRoute();
  if (r.path !== seg) { location.hash = '#/' + r.path; return; }
  const main = layout(companyRoutes, r.path, { portalOf: state.viewCompanyId, title: routeLabel(r) });
  if (!getMode() && !state.viewCompanyId) welcomeModePicker(() => route());
  try { await r.page(main, params, path.split('/').slice(1)); } catch (e) { toast(e.message, true); mount(main, h('div', { class: 'card empty' }, e.message)); }
}

let lastPath = '';
window.addEventListener('hashchange', () => {
  const p = location.hash.split('?')[0];
  const go = () => route().then(() => { if (p !== lastPath) window.scrollTo(0, 0); lastPath = p; });
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
});
if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
window.addEventListener('themechange', () => route());
// Switching mode lands on that mode's home so people are never left on a page their mode hides.
window.addEventListener('modechange', () => { if (state.user && state.user.role !== 'super_admin') navigate('#/' + homeRoute().path); else route(); });
window.addEventListener('dk:reload-context', async () => { await loadContext(); route(); });
document.documentElement.dataset.effective = effectiveTheme();
route();
