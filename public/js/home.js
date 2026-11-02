// Home screen: which layout Home uses and what it shows. Saved per device in localStorage dk_home:
//   { layout: 'quick', per: { quick: { sections: [{ id, on }], shortcuts: [{ id, on }] }, grid: {...} } }
// Layouts with page 'quick' are drawn by pages/quick.js from sections; 'day' and 'chat' open those pages as Home.
// Pure helpers (no DOM) so test/home.test.ts can check them.

export const LAYOUTS = [
  { id: 'quick', name: 'Quick add', desc: 'Add a sale or expense right on Home', page: 'quick' },
  { id: 'grid', name: 'Shortcuts', desc: 'Big buttons for everything you use', page: 'quick' },
  { id: 'summary', name: 'Today first', desc: 'Today’s money and entries at the top', page: 'quick' },
  { id: 'minimal', name: 'One button', desc: 'Today’s total and one Add button', page: 'quick' },
  { id: 'day', name: 'Khata strip', desc: 'Today’s khata is your Home', page: 'day' },
  { id: 'chat', name: 'Chat', desc: 'Type or speak what happened', page: 'chat' },
];

export const SECTIONS = [
  { id: 'greeting', name: 'Greeting and date' },
  { id: 'totals', name: 'Today’s totals' },
  { id: 'add', name: 'Add form (sale, stock, expense)' },
  { id: 'bigadd', name: 'Big Add button' },
  { id: 'shortcuts', name: 'Shortcuts' },
  { id: 'recent', name: 'Added today' },
];

// perm: what the person must be allowed to do for the shortcut to show
export const SHORTCUTS = [
  { id: 'sale', href: '#/quick?type=collection', icon: 'rupee', name: 'Sale', desc: 'Money received', perm: 'entries.write' },
  { id: 'expense', href: '#/quick?type=expense', icon: 'receipt', name: 'Expense', desc: 'Gas, rent, wifi…', perm: 'entries.write' },
  { id: 'purchase', href: '#/quick?type=purchase', icon: 'bag', name: 'Bought stock', desc: 'Items for the shop', perm: 'entries.write' },
  { id: 'bill', href: '#/bill', icon: 'receipt', name: 'Make a bill', desc: 'For a customer', perm: 'entries.write' },
  { id: 'bills', href: '#/bills', icon: 'clock', name: 'Past bills', desc: 'Reprint, udhaar reminders', perm: 'entries.view' },
  { id: 'dump', href: '#/dump', icon: 'type', name: 'Paste notes', desc: 'Many at once', perm: 'entries.write' },
  { id: 'notes', href: '#/notes', icon: 'book', name: 'Notes', desc: 'Jot lines, auto total', perm: 'entries.view' },
  { id: 'counter', href: '#/counter', icon: 'calculator', name: 'Cash counter', desc: 'Count the drawer', perm: 'entries.view' },
  { id: 'day', href: '#/day', icon: 'pen', name: 'Today’s khata', desc: 'Every entry today', perm: 'entries.view' },
  { id: 'chat', href: '#/chat', icon: 'chat', name: 'Chat khata', desc: 'Type or speak', perm: 'entries.write' },
  { id: 'ledger', href: '#/ledger', icon: 'wallet', name: 'Udhaar', desc: 'Who owes what', perm: 'entries.view' },
  { id: 'dashboard', href: '#/dashboard', icon: 'chart', name: 'Reports', desc: 'Sales and profit', perm: 'reports.view' },
  { id: 'scan', href: null, icon: 'camera', name: 'Scan hisaab', desc: 'Photo of a page', perm: 'uploads.write' },
];

const DEFAULTS = {
  quick: { sections: ['greeting', 'totals', 'add', 'shortcuts', 'recent'], shortcuts: ['bill', 'bills', 'dump', 'notes'] },
  grid: { sections: ['greeting', 'totals', 'shortcuts', 'recent'], shortcuts: ['sale', 'expense', 'purchase', 'bill', 'counter', 'bills', 'dump', 'notes', 'day'] },
  summary: { sections: ['greeting', 'totals', 'recent', 'shortcuts'], shortcuts: ['bill', 'counter', 'day', 'bills'] },
  minimal: { sections: ['greeting', 'bigadd', 'totals'], shortcuts: ['bill', 'counter'] },
};

const KEY = 'dk_home';
const layoutById = (id) => LAYOUTS.find((l) => l.id === id);

/** Full ordered list for the Customise screen: saved order first (unknown ids dropped), then anything new, off unless a default. */
export function merged(all, saved, defaults) {
  const valid = new Set(all.map((x) => x.id));
  const seen = new Set();
  const out = [];
  for (const it of Array.isArray(saved) ? saved : []) {
    if (!it || !valid.has(it.id) || seen.has(it.id)) continue;
    seen.add(it.id); out.push({ id: it.id, on: !!it.on });
  }
  if (!out.length) for (const id of defaults) { seen.add(id); out.push({ id, on: true }); }
  for (const x of all) if (!seen.has(x.id)) out.push({ id: x.id, on: false });
  return out;
}

/** Reads dk_home (or the older dk_layout = chat), always returning something valid. */
export function readHome(storage = globalThis.localStorage) {
  let raw = null;
  try { raw = JSON.parse(storage?.getItem(KEY) || 'null'); } catch { raw = null; }
  let legacy = null;
  try { legacy = storage?.getItem('dk_layout'); } catch { legacy = null; }
  const layout = layoutById(raw?.layout)?.id || (legacy === 'chat' ? 'chat' : 'quick');
  return { layout, per: raw && typeof raw.per === 'object' && raw.per ? raw.per : {} };
}

export function writeHome(home, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(home));
    // keep the older key in step so an older cached app still opens Chat for people who chose it
    if (home.layout === 'chat') storage?.setItem('dk_layout', 'chat'); else storage?.removeItem('dk_layout');
  } catch { /* storage blocked: lasts until reload */ }
}

/** What a quick-drawn layout shows: sections and shortcuts in order, with the switches (for Settings). */
export function homeParts(home, layoutId = home.layout) {
  const d = DEFAULTS[layoutId] || DEFAULTS.quick;
  const per = home.per?.[layoutId] || {};
  return { sections: merged(SECTIONS, per.sections, d.sections), shortcuts: merged(SHORTCUTS, per.shortcuts, d.shortcuts) };
}

/** Moves item i up (-1) or down (+1); returns a new array. */
export function move(list, i, dir) {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list.slice();
  const out = list.slice(); [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** The page Home opens for this layout ('quick', 'day' or 'chat'). */
export const homePage = (home) => (layoutById(home.layout) || LAYOUTS[0]).page;
export const isQuickLayout = (id) => (layoutById(id) || LAYOUTS[0]).page === 'quick';
export const hasDefaults = (id) => !!DEFAULTS[id];
