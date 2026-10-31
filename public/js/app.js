import { h, mount, toast, field, input, busy, icon, actionSheet, autoLabelTables, confirmDialog, modal } from './ui.js';
import { api, netApi, state, loadContext, refreshContext, refreshLists, applyBranding, setViewCompany, isSuper, can, companyUrl, navigate, todayLocal } from './api.js';
import * as S from './store.js';
import { getTheme, setTheme, effectiveTheme } from './theme.js';
import { MODES, getMode, modeOrDefault, initMode, openModeSheet } from './mode.js';
import './device.js';

// Pages load on demand (code-split by the bundler) so the first screen only downloads what it needs.
const quickPage = (...a) => import('./pages/quick.js').then((m) => m.quickPage(...a));
const dashboardPage = (...a) => import('./pages/dashboard.js').then((m) => m.dashboardPage(...a));
const dayPage = (...a) => import('./pages/day.js').then((m) => m.dayPage(...a));
const productsPage = (...a) => import('./pages/products.js').then((m) => m.productsPage(...a));
const uploadsPage = (...a) => import('./pages/uploads.js').then((m) => m.uploadsPage(...a));
const reportsPage = (...a) => import('./pages/reports.js').then((m) => m.reportsPage(...a));
const ledgerPage = (...a) => import('./pages/ledger.js').then((m) => m.ledgerPage(...a));
const teamPage = (...a) => import('./pages/team.js').then((m) => m.teamPage(...a));
const settingsPage = (...a) => import('./pages/settings.js').then((m) => m.settingsPage(...a));
const auditPage = (...a) => import('./pages/audit.js').then((m) => m.auditPage(...a));
const adminOverviewPage = (...a) => import('./pages/admin.js').then((m) => m.adminOverviewPage(...a));
const adminCompaniesPage = (...a) => import('./pages/admin.js').then((m) => m.adminCompaniesPage(...a));
const adminCompanyPage = (...a) => import('./pages/admin.js').then((m) => m.adminCompanyPage(...a));
const adminPlansPage = (...a) => import('./pages/admin.js').then((m) => m.adminPlansPage(...a));
const adminActivityPage = (...a) => import('./pages/admin.js').then((m) => m.adminActivityPage(...a));
const adminBackupsPage = (...a) => import('./pages/admin.js').then((m) => m.adminBackupsPage(...a));

const counterPage = (...a) => import('./pages/counter.js').then((m) => m.counterPage(...a));
const notesPage = (...a) => import('./pages/notes.js').then((m) => m.notesPage(...a));
const chatPage = (...a) => import('./pages/chat.js').then((m) => m.chatPage(...a));
const billPage = (...a) => import('./pages/bill.js').then((m) => m.billPage(...a));
const dumpPage = (...a) => import('./pages/dump.js').then((m) => m.dumpPage(...a));

const app = document.getElementById('app');

const ALL = ['layman', 'smart', 'nerdy'], SMART_UP = ['smart', 'nerdy'];
// `modes` = which experience modes show the page. `laymanLabel` is the friendlier name used in Layman mode.
const companyRoutes = [
  { path: 'quick', label: 'Home', short: 'Home', icon: 'home', page: quickPage, perm: 'entries.write', modes: ALL },
  { path: 'day', label: 'Today’s khata', short: 'Khata', laymanLabel: 'Today’s khata', icon: 'pen', page: dayPage, perm: 'entries.view', modes: ALL },
  { path: 'chat', label: 'Chat khata', short: 'Chat', icon: 'chat', page: chatPage, perm: 'entries.write', modes: ALL },
  { path: 'bill', label: 'Make a bill', short: 'Bill', icon: 'receipt', page: billPage, perm: 'entries.write', modes: ALL },
  { path: 'dump', label: 'Write expenses', short: 'Write', icon: 'type', page: dumpPage, perm: 'entries.write', modes: ALL },
  { path: 'counter', label: 'Cash counter', short: 'Counter', icon: 'calculator', page: counterPage, perm: 'entries.view', modes: ALL },
  { path: 'notes', label: 'Notes', short: 'Notes', icon: 'book', page: notesPage, perm: 'entries.view', modes: ALL },
  { path: 'dashboard', label: 'Reports', icon: 'chart', page: dashboardPage, perm: 'reports.view', sep: 'Business', modes: SMART_UP },
  { path: 'ledger', label: 'Udhaar', icon: 'wallet', page: ledgerPage, perm: 'entries.view', modes: SMART_UP },
  { path: 'products', label: 'Products', icon: 'box', page: productsPage, perm: 'entries.view', modes: SMART_UP },
  { path: 'uploads', label: 'Photos & bills', short: 'Photos', icon: 'camera', page: uploadsPage, perm: 'entries.view', modes: SMART_UP },
  { path: 'reports', label: 'Download (Excel/PDF)', short: 'Download', icon: 'download', page: reportsPage, perm: 'reports.view', modes: SMART_UP },
  { path: 'team', label: 'Team', icon: 'users', page: teamPage, perm: 'team.manage', sep: 'Account', modes: SMART_UP },
  { path: 'settings', label: 'Settings', icon: 'sliders', page: settingsPage, perm: null, sep: 'Account', modes: ALL },
  { path: 'audit', label: 'Audit log', icon: 'clock', page: auditPage, perm: 'audit.view', modes: ['nerdy'] },
];
/** Pages this person may open in the current mode. */
const visibleCompanyRoutes = () => companyRoutes.filter((r) => (!r.perm || can(r.perm)) && r.modes.includes(modeOrDefault()));
const routeLabel = (r) => (modeOrDefault() === 'layman' && r.laymanLabel) || r.label;
/** Where "Home" goes: the simple add page, in every mode. */
function homeRoute() {
  const rs = visibleCompanyRoutes();
  let chat = false; try { chat = localStorage.getItem('dk_layout') === 'chat'; } catch { /* storage blocked */ }
  return (chat && rs.find((r) => r.path === 'chat')) || rs.find((r) => r.path === 'quick') || rs.find((r) => r.path === 'day') || rs[0];
}
const adminRoutes = [
  { path: 'admin', label: 'Overview', icon: 'chart', page: adminOverviewPage },
  { path: 'admin/companies', label: 'Companies', icon: 'building', page: adminCompaniesPage },
  { path: 'admin/plans', label: 'Plans & Limits', short: 'Plans', icon: 'layers', page: adminPlansPage },
  { path: 'admin/activity', label: 'Activity', icon: 'clock', page: adminActivityPage },
  { path: 'admin/backups', label: 'Backups', icon: 'database', page: adminBackupsPage },
];

// The signed-in user is remembered on the phone so the app opens instantly (and offline); /api/auth/me re-checks it in the background.
const SESSION_KEY = 'dk_session';
const saveSession = () => { try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user: state.user, company: state.company })); } catch { /* storage blocked */ } };
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };
const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem('dk_last_company'); } catch { /* ignore */ } };

async function logout() {
  await S.flushNow(3000); // upload anything still waiting before this phone forgets the data
  const st = S.status();
  const waiting = st.pending + st.failed;
  if (waiting > 0 && !(await confirmDialog(`${waiting} change${waiting > 1 ? 's' : ''} haven’t reached the server yet (no connection?). If you sign out now, they will be lost.`, { okText: 'Sign out anyway' }))) return;
  await netApi('/api/auth/logout', { method: 'POST' }).catch(() => {});
  await S.wipeAll(); // company data never stays on a phone that has signed out
  clearSession();
  state.user = null; state.company = null; setViewCompany(null); applyBranding(null);
  location.hash = '#/login';
}
async function verifySession() {
  try {
    const me = await netApi('/api/auth/me');
    const before = JSON.stringify([state.user, state.company]);
    state.user = me.user; if (me.company) state.company = me.company;
    saveSession();
    if (JSON.stringify([state.user, state.company]) !== before) route();
  } catch (e) {
    if (e.status === 401 || e.status === 403) { state.user = null; clearSession(); location.hash = '#/login'; route(); }
    // any other error = offline: keep working from the phone's copy
  }
}

// ---------- sync status ----------
const timeAgo = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 45 ? 'just now' : s < 3600 ? `${Math.round(s / 60)}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`; };
const chips = new Set();
function paintChip(el, st) {
  const kind = el.dataset.kind;
  let label, cls;
  if (!st.active) { el.hidden = true; return; }
  if (st.state === 'auth') { label = 'Sign in to sync'; cls = 'warn'; }
  else if (st.failed) { label = `${st.failed} not saved`; cls = 'bad'; }
  else if (st.state === 'offline') { label = st.pending ? `Offline · ${st.pending} waiting` : 'Offline'; cls = 'warn'; }
  else if (st.state === 'syncing' || st.pending) { label = st.pending ? `Syncing ${st.pending}…` : 'Syncing…'; cls = 'busy'; }
  else if (st.state === 'error') { label = 'Sync problem'; cls = 'bad'; }
  else { label = st.last ? `Synced ${timeAgo(st.last)}` : 'Synced'; cls = 'ok'; }
  el.className = `syncchip sync-${kind} ${cls}`; // not just "${kind}": a bare "side" class collided with the sidebar styles
  el.hidden = kind === 'bar' && cls === 'ok'; // the top bar only speaks up when something needs attention
  mount(el, h('i', { class: 'dot' }), label);
  el.title = st.error || 'Tap to sync now';
}
function syncChip(kind) {
  const el = h('button', { class: 'syncchip', dataset: { kind }, onclick: () => {
    const st = S.status();
    if (st.state === 'auth') return navigate('#/login');
    if (st.failed) return openSyncProblems();
    toast('Syncing…'); S.syncNow();
  } });
  chips.add(el); paintChip(el, S.status());
  return el;
}
window.addEventListener('dk:sync', (e) => { for (const el of [...chips]) { if (!el.isConnected && el.dataset.seen) { chips.delete(el); continue; } if (el.isConnected) el.dataset.seen = '1'; paintChip(el, e.detail); } });
setInterval(() => { const st = S.status(); for (const el of chips) if (el.isConnected) paintChip(el, st); }, 30000);
function openSyncProblems() {
  const render = () => {
    const ops = S.failedOps();
    if (!ops.length) { m.close(); return; }
    mount(body, h('p', { class: 'muted', style: { marginTop: 0 } }, 'The server refused these changes, so they are only on this phone. Fix the cause (for example a plan limit) and retry, or discard them.'),
      ops.map((o) => h('div', { class: 'card tint', style: { marginBottom: '10px' } }, h('div', { style: { fontWeight: 650 } }, o.label), h('div', { class: 'small', style: { color: 'var(--bad)', margin: '4px 0 8px' } }, o.error),
        h('div', { class: 'row' }, h('button', { class: 'small primary', onclick: async () => { await S.retryFailed(o.qid); render(); } }, 'Retry'), h('button', { class: 'small danger', onclick: async () => { await S.discardFailed(o.qid); render(); } }, 'Discard')))));
  };
  const body = h('div');
  const m = modal('Changes that did not save', body);
  render();
}
// Other devices (or a finished upload) changed our data: refresh what is on screen, without disturbing typing.
let dataTimer;
window.addEventListener('dk:data', () => {
  clearTimeout(dataTimer);
  dataTimer = setTimeout(async () => {
    if (document.querySelector('.modal-bg') || /^#\/(login|setup)/.test(location.hash)) return;
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && (a.value || a.type === 'date')) return;
    const y = scrollY; await route(); scrollTo(0, y);
  }, 200);
});
window.addEventListener('dk:syncfail', (e) => toast(`Couldn’t save: ${e.detail.message}`, true));
window.addEventListener('dk:unauthorized', () => { if (state.user) { state.user = null; clearSession(); } if (!/^#\/(login|setup)/.test(location.hash)) location.hash = '#/login'; });

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
  const quick = (type) => navigate(`#/quick?date=${date}&type=${type}`);
  actionSheet('Add', [
    { icon: 'receipt', title: 'Bill for a customer', desc: 'Items, total, share on WhatsApp', onclick: () => navigate('#/bill') },
    { icon: 'rupee', title: 'Sale', desc: 'Money you received', onclick: () => quick('collection') },
    { icon: 'receipt', title: 'Expense', desc: 'Money you spent — gas, rent, tea…', onclick: () => quick('expense') },
    { icon: 'bag', title: 'Stock bought', desc: 'Items you bought to sell', onclick: () => quick('purchase') },
    { icon: 'type', title: 'Write or paste notes', desc: 'Many entries at once, the way you talk', onclick: () => navigate('#/dump') },
    ...(can('uploads.write') ? [{ icon: 'camera', title: 'Photo of a bill or page', desc: 'We read it for you', onclick: () => pickPhoto(date) }] : []),
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
  const heads = new Set();
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' }, visible.map((r) => [
    r.sep && !heads.has(r.sep) ? (heads.add(r.sep), h('div', { class: 'sep' }, typeof r.sep === 'string' ? r.sep : '')) : null,
    h('a', { href: `#/${r.path}`, class: active === r.path ? 'active' : '', 'aria-current': active === r.path ? 'page' : null, onclick: closeMenu }, icon(r.icon), showCompany ? routeLabel(r) : r.label),
  ]));
  const initials = (state.user.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  mount(side, brand, nav,
    h('div', { class: 'foot' },
      portalOf ? h('button', { class: 'small block', onclick: () => { setViewCompany(null); state.company = null; applyBranding(null); location.hash = '#/admin/companies'; } }, icon('left', 16), 'Back to super admin') : null,
      showCompany && S.isActive() ? syncChip('side') : null,
      showCompany ? modeChip() : null,
      h('div', { class: 'me' }, h('div', { class: 'avatar' }, initials),
        h('div', { style: { minWidth: 0, flex: 1 } }, h('div', { class: 'small', style: { fontWeight: 650 } }, state.user.name), h('div', { class: 'small muted', style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, state.user.role.replace('_', ' '))),
        themeButton(),
        h('button', { class: 'ghost icon small', title: 'Sign out', 'aria-label': 'Sign out', onclick: logout }, icon('logout', 18)))));

  const top = h('header', { class: 'topbar' },
    h('button', { class: 'topmark', 'aria-label': 'Open menu', onclick: openMenu }, showCompany && company?.has_logo ? h('img', { src: companyUrl(`/api/c/logo?v=${encodeURIComponent(company.updated_at || '')}`), alt: '' }) : h('div', { class: 'brandmark' }, ((showCompany ? company?.name : 'D') || 'D')[0].toUpperCase())),
    h('div', { class: 'title' }, title || (showCompany ? company?.name : 'DailyKhata Admin') || 'DailyKhata'),
    showCompany ? syncChip('bar') : themeButton());

  // bottom tab bar (phones)
  let tabs;
  if (showCompany) {
    const vis = visibleCompanyRoutes();
    const home = homeRoute();
    const lay = modeOrDefault() === 'layman';
    const pick = (p) => vis.find((r) => r.path === p);
    const third = pick('counter') || (lay ? pick('settings') : pick('uploads')); // cash counter is used all day, so it gets a tab
    const tabRoutes = [home, home.path === 'day' ? null : pick('day'), third].filter(Boolean);
    const isHome = (r) => r === home;
    const link = (r) => h('a', { href: `#/${r.path}`, class: active === r.path ? 'active' : '' }, icon(isHome(r) ? 'home' : r.icon), isHome(r) ? 'Home' : r.short || r.label);
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
    const cached = !reloadUser && loadSession();
    if (cached?.user) { state.user = cached.user; state.company = cached.company; verifySession(); } // instant start; verified in the background
    else {
      try {
        const me = await netApi('/api/auth/me'); state.user = me.user; if (me.company) state.company = me.company;
        // a different company signing in on this phone must never see the previous one's data
        const last = localStorage.getItem('dk_last_company');
        if (me.user.role !== 'super_admin' && last && last !== String(me.user.company_id)) await S.wipeAll();
        try { if (me.user.company_id) localStorage.setItem('dk_last_company', String(me.user.company_id)); } catch { /* ignore */ }
        saveSession();
      } catch { state.user = null; const s = await api('/api/auth/setup').catch(() => ({ needed: false })); location.hash = s.needed ? '#/setup' : '#/login'; if (s.needed) setupPage(); else loginPage(); return; }
    }
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
  if (!S.isActive() || S.currentCompany() !== cid) {
    const opened = await S.openStore(cid); // the phone's copy of this company's books (null if the browser blocks local storage)
    if (opened?.first) {
      mount(app, h('div', { class: 'boot' }, h('div', { class: 'spinner' }), h('div', { style: { fontWeight: 650, marginTop: '14px' } }, 'Setting up your khata on this phone…'), h('div', { class: 'small muted' }, 'One-time download. After this, the app opens instantly and works offline.')));
      try { await S.pull(); } catch (e) { toast(`Couldn’t download your data yet (${e.message}). Using the online version for now.`, true); }
    }
    if (opened) { S.startSync(); if (!opened.first) S.syncNow(); }
  }
  if (reloadUser) S.resumeAuth();
  if (ctxLoadedFor !== cid || reloadUser) {
    try { await loadContext(); ctxLoadedFor = cid; } catch (e) { toast(e.message, true); if (state.viewCompanyId) { setViewCompany(null); location.hash = '#/admin'; } return; }
  }
  initMode(user);
  const seg = path.split('/')[0];
  // A page hidden by the current mode still opens when followed from a direct link.
  const r = visibleCompanyRoutes().find((x) => x.path === seg) || companyRoutes.find((x) => x.path === seg && (!x.perm || can(x.perm))) || homeRoute();
  if (r.path !== seg) { location.hash = '#/' + r.path; return; }
  const main = layout(companyRoutes, r.path, { portalOf: state.viewCompanyId, title: routeLabel(r) });
  try { await r.page(main, params, path.split('/').slice(1)); } catch (e) { toast(e.message, true); mount(main, h('div', { class: 'card empty' }, e.message)); }
}

let lastPath = '';
window.addEventListener('hashchange', () => {
  const p = location.hash.split('?')[0];
  const go = () => route().then(() => { if (p !== lastPath) window.scrollTo(0, 0); lastPath = p; });
  // View transitions snapshot the whole page: nice on flagship phones, janky on low-end ones, so skip them in lite mode.
  if (document.startViewTransition && !document.documentElement.classList.contains('lite') && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go();
});
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
window.addEventListener('themechange', () => route());
// Switching mode lands on that mode's home so people are never left on a page their mode hides.
window.addEventListener('modechange', () => { if (state.user && state.user.role !== 'super_admin') navigate('#/' + homeRoute().path); else route(); });
window.addEventListener('dk:reload-context', async () => { try { await refreshContext(); } catch { await loadContext(); } route(); });
document.documentElement.dataset.effective = effectiveTheme();
route();
// Developer hook for tests: add ?debug to the URL (or set localStorage.dk_debug) to inspect the local store.
try { if (location.search.includes('debug') || localStorage.getItem('dk_debug')) window.__dk = { api, netApi, S, state }; } catch { /* ignore */ }
