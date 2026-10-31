// Answers the app's /api/c/* requests from the phone's own copy of the books (store.js), so every screen is instant
// and works offline. Changes are applied locally first and queued for upload; the server re-validates everything.
//
// It deliberately reuses the server's own code, bundled for the browser:
//   calc.ts / ledger.ts / summary.ts  the financial engine and aggregation (identical numbers online and offline)
//   parser.ts                          the "type your hisaab" reader
//   util.ts                            the validators (same rules, same error messages)
import { state, can, ApiError, activeCompanyId } from './state.js';
import * as S from './store.js';
import { computeReport } from '../../src/lib/calc.ts';
import { buildReportInput, categoryTotals, partyBalances } from '../../src/lib/ledger.ts';
import { buildSummary } from '../../src/lib/summary.ts';
import { parseText } from '../../src/lib/parser.ts';
import { daysBetween, todayIST } from '../../src/lib/dates.ts';
import { normalizeBill } from '../../src/lib/bills.ts';
import { toPaise, optPaise, reqDate, isDate, reqStr, optStr, reqNum, oneOf } from '../../src/lib/util.ts';

export const NOT_LOCAL = Symbol('not-local');

const PAY_MODES = ['cash', 'bank', 'credit'];
const COLLECTION_MODES = ['cash', 'upi', 'card', 'credit'];
const PAYMENT_MODES = ['cash', 'bank', 'upi'];
const MAX_RANGE_DAYS = 400;
const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const bad = (msg, status = 422) => { throw new ApiError(msg, status); };
const need = (...perms) => { if (!perms.every((p) => can(p))) bad(`You don't have permission (${perms.join(', ')})`, 403); };
/** Creation order: saved rows by id, then rows still waiting to upload in the order they were added. */
const ord = (id) => (id > 0 ? id : 1e12 + Math.abs(id));
const byId = (a, b) => ord(a.id) - ord(b.id);
const lc = (s) => String(s ?? '').toLowerCase();
const nameCmp = (a, b) => (lc(a.name) < lc(b.name) ? -1 : lc(a.name) > lc(b.name) ? 1 : 0);
const company = () => S.currentCompany();

// ---------- reports (memoised until anything changes) ----------
let memo = { v: -1, map: new Map() };
function localReport(from, to, detail = false) {
  if (memo.v !== S.getVersion()) memo = { v: S.getVersion(), map: new Map() };
  const key = `${from}|${to}|${detail}`;
  let r = memo.map.get(key);
  if (!r) { r = computeReport(buildReportInput(S.snapshot(), from, to, detail)); memo.map.set(key, r); }
  return r;
}
function rangeOf(qs) {
  const to = qs.get('to') || todayIST();
  const from = qs.get('from') || to;
  reqDate(from, 'from'); reqDate(to, 'to');
  if (from > to) bad('"from" must be on or before "to"');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) bad(`Date range is limited to ${MAX_RANGE_DAYS} days`);
  return { from, to };
}

// ---------- row builders (mirror the server's normalisers) ----------
const baseRow = (extra) => ({ company_id: company(), created_by: state.user?.id ?? null, created_at: nowSql(), updated_at: nowSql(), ...extra });

function findProduct(b) {
  const prods = S.rows('products');
  if (b.product_id) return prods.find((p) => p.id === Number(b.product_id)) ?? bad('Unknown product');
  const name = reqStr(b.product_name ?? b.item, 'product name', 80);
  return prods.find((p) => lc(p.name) === lc(name)) ?? null;
}
function resolveProduct(b, puts) {
  const found = findProduct(b);
  if (found) return found;
  const name = reqStr(b.product_name ?? b.item, 'product name', 80);
  const pending = puts.find(([t, r]) => t === 'products' && lc(r.name) === lc(name)); // same new item twice in one save
  if (pending) return pending[1];
  const qty = Number(b.qty) || 1, pieces = Number(b.pieces) || 0;
  const total = b.total !== undefined && b.total !== null && b.total !== '' ? toPaise(b.total, 'total') : null;
  const row = baseRow({ id: S.nextTempId(), name, category: null, unit: (optStr(b.unit, 20) ?? 'box').toLowerCase(),
    pieces_per_unit: pieces > 0 && qty > 0 ? Math.max(1, Math.round(pieces / qty)) : 1,
    default_unit_cost_paise: total !== null && qty > 0 ? Math.round(total / qty) : null, sale_price_paise: null, active: 1 });
  puts.push(['products', row]); // the server creates the same product when it receives the purchase
  return row;
}
function resolveCategory(b, puts) {
  if (b.category_id) { const c = S.rows('expense_categories').find((x) => x.id === Number(b.category_id)); if (!c) bad('Unknown expense category'); return c; }
  const name = reqStr(b.category, 'category', 60);
  const found = S.rows('expense_categories').find((c) => lc(c.name) === lc(name)) || puts.find(([t, r]) => t === 'expense_categories' && lc(r.name) === lc(name))?.[1];
  if (found) return found;
  const row = { id: S.nextTempId(), company_id: company(), name };
  puts.push(['expense_categories', row]);
  return row;
}
const docId = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

const BUILD = {
  purchases(b, puts) {
    const p = resolveProduct(b, puts);
    const qty = reqNum(b.qty ?? 1, 'quantity', { min: 0.001, max: 1e6 });
    const pieces = b.pieces === null || b.pieces === undefined || b.pieces === '' ? Math.round(qty * p.pieces_per_unit) : reqNum(b.pieces, 'pieces', { min: 0, max: 1e7, int: true });
    return { entry_date: reqDate(b.date), product_id: p.id, qty_units: qty, unit: (optStr(b.unit, 20) ?? p.unit).toLowerCase(), pieces,
      total_cost_paise: toPaise(b.total, 'total cost'), payment_mode: oneOf(b.payment_mode, PAY_MODES, 'payment mode', 'cash'),
      supplier: optStr(b.supplier, 80), notes: optStr(b.notes, 500), document_id: docId(b.document_id) };
  },
  expenses(b, puts) {
    const c = resolveCategory(b, puts);
    return { entry_date: reqDate(b.date), category_id: c.id, amount_paise: toPaise(b.amount, 'amount', { allowZero: false }),
      payment_mode: oneOf(b.payment_mode, PAY_MODES, 'payment mode', 'cash'), notes: optStr(b.notes, 500), document_id: docId(b.document_id) };
  },
  collections(b) {
    return { entry_date: reqDate(b.date), amount_paise: toPaise(b.amount, 'amount', { allowZero: false }), mode: oneOf(b.mode, COLLECTION_MODES, 'mode', 'cash'),
      customer: optStr(b.customer, 80), notes: optStr(b.notes, 500), document_id: docId(b.document_id) };
  },
  payments(b) {
    return { entry_date: reqDate(b.date), direction: oneOf(b.direction, ['to_supplier', 'from_customer'], 'direction'), party: optStr(b.party, 80),
      amount_paise: toPaise(b.amount, 'amount', { allowZero: false }), mode: oneOf(b.mode, PAYMENT_MODES, 'mode', 'cash'), notes: optStr(b.notes, 500) };
  },
};
const WRITE_PERM = 'entries.write';
/** What we send to the server: the original request, minus ids that only exist on this phone (names are sent instead). */
function wireBody(b, clientId, rec) {
  const out = { ...b };
  if (out.product_id < 0) { delete out.product_id; if (!out.product_name && !out.item) out.product_name = S.getRow('products', rec.product_id)?.name; }
  if (out.category_id < 0) { delete out.category_id; if (!out.category) out.category = S.getRow('expense_categories', rec.category_id)?.name; }
  if (clientId) out.client_id = clientId;
  return out;
}

async function createEntry(table, b) {
  need(WRITE_PERM);
  const puts = [];
  const rec = BUILD[table](b, puts);
  const clientId = typeof b.client_id === 'string' && /^[\w-]{8,64}$/.test(b.client_id) && !S.rows(table).some((r) => r.client_id === b.client_id) ? b.client_id : S.newClientId();
  const row = baseRow({ id: S.nextTempId(), client_id: clientId, ...rec });
  await S.commit({ put: [...puts, [table, row]], queue: [S.q.create(table, row.id, wireBody(b, clientId, rec))] });
  return view(table, row);
}
async function updateEntry(table, id, b) {
  need(WRITE_PERM);
  const old = S.getRow(table, id);
  if (!old) bad('Entry not found', 404);
  const puts = [];
  const rec = BUILD[table](b, puts);
  const row = { ...old, ...rec, updated_at: nowSql() };
  await S.commit({ put: [...puts, [table, row]], queue: [S.q.update(table, id, wireBody(b, null, rec))] });
  return view(table, row);
}
async function deleteEntry(table, id) {
  need('entries.delete');
  if (!S.getRow(table, id)) bad('Entry not found', 404);
  await S.commit({ del: [[table, id]], queue: [S.q.remove(table, id)] });
  return { deleted: true };
}

// ---------- read shapes (same as the server's JSON) ----------
function view(table, r) {
  if (table === 'purchases') {
    const p = S.getRow('products', r.product_id);
    return { ...r, product_name: p?.name ?? 'Unknown', cost_per_piece_paise: r.pieces ? Math.round((r.total_cost_paise * 100) / r.pieces) / 100 : null, created_by_name: null };
  }
  if (table === 'expenses') return { ...r, category: S.getRow('expense_categories', r.category_id)?.name ?? 'Other', created_by_name: null };
  return { ...r, created_by_name: null };
}
function listEntries(table, qs) {
  need('entries.view');
  const { from, to } = rangeOf(qs);
  return S.rows(table).filter((r) => r.entry_date >= from && r.entry_date <= to)
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : ord(b.id) - ord(a.id))).slice(0, 2000).map((r) => view(table, r));
}
function productsList() {
  const agg = new Map();
  for (const r of S.rows('purchases')) {
    const a = agg.get(r.product_id) ?? { cost: 0, pieces: 0, last: '' };
    a.cost += r.total_cost_paise; a.pieces += r.pieces; if (r.entry_date > a.last) a.last = r.entry_date;
    agg.set(r.product_id, a);
  }
  return S.rows('products').sort((a, b) => (b.active - a.active) || nameCmp(a, b)).map((p) => {
    const a = agg.get(p.id);
    return { ...p, avg_cost_per_piece_paise: a && a.pieces ? Math.round((a.cost * 100) / a.pieces) / 100 : null, last_purchase: a?.last || null };
  });
}
function dayView(date) {
  need('entries.view');
  reqDate(date);
  const m = S.snapshot();
  const on = (arr) => arr.filter((r) => r.entry_date === date).sort(byId);
  const report = { ...localReport(date, date, true).days[0] };
  if (!can('reports.view')) report.profit = null;
  return {
    date,
    purchases: on(m.purchases).map((r) => view('purchases', r)), expenses: on(m.expenses).map((r) => view('expenses', r)),
    collections: on(m.collections).map((r) => view('collections', r)), payments: on(m.payments).map((r) => view('payments', r)),
    stock_counts: m.stock_counts.filter((r) => r.entry_date === date).map((r) => ({ product_id: r.product_id, closing_pieces: r.closing_pieces })),
    closing: m.day_closings.find((r) => r.entry_date === date) ?? null, report,
  };
}

// ---------- products & categories ----------
function productFields(b) {
  return {
    name: reqStr(b.name, 'name', 80), category: optStr(b.category, 60), unit: (optStr(b.unit, 20) ?? 'box').toLowerCase(),
    pieces_per_unit: reqNum(b.pieces_per_unit ?? 1, 'pieces per unit', { min: 1, max: 100000, int: true }),
    default_unit_cost_paise: optPaise(b.default_unit_cost, 'default cost'), sale_price_paise: optPaise(b.sale_price, 'sale price'),
    active: b.active === false || b.active === 0 ? 0 : 1,
  };
}
async function saveProduct(id, b) {
  need('products.manage');
  const f = productFields(b);
  const dup = S.rows('products').find((p) => lc(p.name) === lc(f.name) && p.id !== id);
  if (dup) bad('A product with this name already exists', 409);
  if (id) {
    const old = S.getRow('products', id); if (!old) bad('Product not found', 404);
    const row = { ...old, ...f, updated_at: nowSql() };
    await S.commit({ put: [['products', row]], queue: [S.q.update('products', id, b)] });
    return row;
  }
  const row = baseRow({ id: S.nextTempId(), ...f });
  await S.commit({ put: [['products', row]], queue: [S.q.create('products', row.id, b)] });
  return row;
}
async function deleteProduct(id) {
  need('products.manage');
  const old = S.getRow('products', id); if (!old) bad('Product not found', 404);
  const used = S.rows('purchases').some((p) => p.product_id === id);
  if (used) {
    const row = { ...old, active: 0, updated_at: nowSql() };
    // a product still waiting to upload keeps its create (now inactive); a saved one asks the server to archive it
    const queue = id < 0 ? [S.q.update('products', id, { name: old.name, category: old.category, unit: old.unit, pieces_per_unit: old.pieces_per_unit, active: false })] : [S.q.remove('products', id)];
    await S.commit({ put: [['products', row]], queue });
    return { archived: true };
  }
  await S.commit({ del: [['products', id]], queue: [S.q.remove('products', id)] });
  return { deleted: true };
}
async function saveCategory(id, b) {
  need('products.manage');
  const name = reqStr(b.name, 'name', 60);
  if (S.rows('expense_categories').some((c) => lc(c.name) === lc(name) && c.id !== id)) bad('Category already exists', 409);
  if (id) {
    const old = S.getRow('expense_categories', id); if (!old) bad('Category not found', 404);
    const row = { ...old, name };
    await S.commit({ put: [['expense_categories', row]], queue: [S.q.update('expense_categories', id, { name })] });
    return row;
  }
  const row = { id: S.nextTempId(), company_id: company(), name };
  await S.commit({ put: [['expense_categories', row]], queue: [S.q.create('expense_categories', row.id, { name })] });
  return row;
}
async function deleteCategory(id) {
  need('products.manage');
  if (!S.getRow('expense_categories', id)) bad('Category not found', 404);
  if (S.rows('expenses').some((e) => e.category_id === id)) bad('Category has expenses; rename it instead', 409);
  await S.commit({ del: [['expense_categories', id]], queue: [S.q.remove('expense_categories', id)] });
  return { deleted: true };
}

// ---------- day actions ----------
async function saveStock(date, b) {
  need(WRITE_PERM);
  reqDate(date);
  if (!Array.isArray(b?.counts)) bad('counts must be a list');
  const put = [], del = [], wire = [];
  for (const c of b.counts.slice(0, 2000)) {
    const pid = Number(c.product_id);
    if (!S.getRow('products', pid)) bad('Unknown product in stock count');
    const old = S.rows('stock_counts').find((r) => r.entry_date === date && r.product_id === pid);
    if (c.closing_pieces === null || c.closing_pieces === '' || c.closing_pieces === undefined) {
      if (old) del.push(['stock_counts', old.id]);
      wire.push({ product_id: pid, closing_pieces: null });
    } else {
      const n = reqNum(c.closing_pieces, 'closing pieces', { min: 0, max: 1e7, int: true });
      put.push(['stock_counts', old ? { ...old, closing_pieces: n, updated_at: nowSql() } : baseRow({ id: S.nextTempId(), entry_date: date, product_id: pid, closing_pieces: n })]);
      wire.push({ product_id: pid, closing_pieces: n });
    }
  }
  const merge = (oldBody, newBody) => {
    const m = new Map((oldBody?.counts || []).map((c) => [c.product_id, c]));
    for (const c of newBody.counts) m.set(c.product_id, c);
    return { counts: [...m.values()] };
  };
  await S.commit({ put, del, queue: [S.q.upsert(`stock:${date}`, 'PUT', `/api/c/day/${date}/stock`, { counts: wire }, merge)] });
  return { ok: true };
}
async function saveClosing(date, b) {
  need('cash.close');
  reqDate(date);
  const opening = optPaise(b.opening_cash, 'opening cash');
  const counted = toPaise(b.counted_cash, 'counted cash');
  const old = S.rows('day_closings').find((r) => r.entry_date === date);
  const row = { ...(old || baseRow({ id: S.nextTempId(), entry_date: date })), opening_cash_paise: opening, counted_cash_paise: counted, notes: optStr(b.notes, 500), closed_by: state.user?.id ?? null, updated_at: nowSql() };
  await S.commit({ put: [['day_closings', row]], queue: [S.q.upsert(`closing:${date}`, 'PUT', `/api/c/day/${date}/closing`, { opening_cash: b.opening_cash ?? null, counted_cash: b.counted_cash, notes: b.notes ?? '' })] });
  return row;
}
async function deleteClosing(date) {
  need('cash.close', 'entries.delete');
  reqDate(date);
  const old = S.rows('day_closings').find((r) => r.entry_date === date);
  if (old) await S.commit({ del: [['day_closings', old.id]], queue: [S.q.upsert(`closing:${date}`, 'DELETE', `/api/c/day/${date}/closing`, undefined)] });
  return { ok: true };
}
async function bulk(b) {
  need(WRITE_PERM);
  const date = reqDate(b.date);
  const lists = { purchases: (b.purchases || []).slice(0, 300), expenses: (b.expenses || []).slice(0, 300), collections: (b.collections || []).slice(0, 300) };
  const total = lists.purchases.length + lists.expenses.length + lists.collections.length;
  if (!total) bad('Nothing to save');
  const put = [], queue = [];
  // build everything first so one bad row does not leave a half-saved day
  for (const [table, items] of Object.entries(lists)) {
    for (const item of items) {
      const body = { ...item, date };
      const rec = BUILD[table](body, put);
      const clientId = S.newClientId();
      const row = baseRow({ id: S.nextTempId(), client_id: clientId, ...rec });
      put.push([table, row]);
      queue.push(S.q.create(table, row.id, wireBody(body, clientId, rec)));
    }
  }
  await S.commit({ put, queue });
  return { created: total };
}

// ---------- notes ----------
function noteFields(b) {
  return { title: optStr(b.title, 120) ?? '', body: typeof b.body === 'string' ? b.body.slice(0, 30000) : '', entry_date: b.entry_date ? reqDate(b.entry_date, 'date') : null, pinned: b.pinned ? 1 : 0 };
}
async function saveNote(clientId, b) {
  need(WRITE_PERM);
  if (!/^[\w-]{8,64}$/.test(clientId)) bad('Invalid note id');
  const f = noteFields(b);
  const old = S.rows('notes').find((n) => n.client_id === clientId);
  const row = { ...(old || baseRow({ id: S.nextTempId(), client_id: clientId })), ...f, updated_at: nowSql() };
  await S.commit({ put: [['notes', row]], queue: [S.q.upsert(`note:${clientId}`, 'PUT', `/api/c/notes/${clientId}`, { title: f.title, body: f.body, entry_date: f.entry_date, pinned: f.pinned })] });
  return row;
}
async function deleteNote(clientId) {
  need(WRITE_PERM);
  const old = S.rows('notes').find((n) => n.client_id === clientId);
  if (old) await S.commit({ del: [['notes', old.id]], queue: [S.q.upsert(`note:${clientId}`, 'DELETE', `/api/c/notes/${clientId}`, undefined)] });
  return { deleted: true };
}

// ---------- bills ----------
// Numbers come from a block reserved from the server (series A, shared by every device). If the block runs out while
// offline, the device falls back to its own provisional series "P<code>", which cannot collide with anyone else's.
const BLOCK = 20, LOW = 5;
let numLock = Promise.resolve();
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const legacyCounter = () => { try { return Number(JSON.parse(localStorage.getItem(`dk_billno_${company()}`))) || 0; } catch { return 0; } };
const remaining = (st) => (st.block ? Math.max(0, st.block.to - st.block.next + 1) : 0) + (st.spare ? st.spare.to - st.spare.from + 1 : 0);
async function reserveBlock() {
  const r = await S.reserveBills(BLOCK, legacyCounter());
  return r && Number.isInteger(r.from) && Number.isInteger(r.to) && r.to >= r.from ? { from: r.from, to: r.to, next: r.from } : null;
}
function topUp() {
  const st = S.getBillState();
  if (st.reserving || remaining(st) > LOW || navigator.onLine === false) return;
  st.reserving = true;
  reserveBlock().then(async (b) => {
    if (b) { if (!st.block || st.block.next > st.block.to) st.block = b; else st.spare = b; await S.saveBillState(); }
  }).finally(() => { st.reserving = false; });
}
export function warmBillNumbers() { try { if (S.isActive() && !S.needsFirstSync()) topUp(); } catch { /* best effort */ } }
/** The number the next bill will get, for display only (null until the device has one). */
export function peekBillNumber() {
  const st = S.getBillState();
  if (st.block && st.block.next <= st.block.to) return { series: 'A', no: st.block.next };
  if (st.spare) return { series: 'A', no: st.spare.from };
  return st.dev ? { series: 'P' + st.dev, no: (st.prov || 0) + 1 } : null;
}
function takeBillNumber() {
  const run = async () => {
    const st = S.getBillState();
    if (!st.dev) st.dev = Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
    if ((!st.block || st.block.next > st.block.to) && st.spare) { st.block = st.spare; st.spare = null; }
    if ((!st.block || st.block.next > st.block.to) && navigator.onLine !== false) {
      const b = await withTimeout(reserveBlock(), 2500);
      if (b) st.block = b;
    }
    let out;
    if (st.block && st.block.next <= st.block.to) out = { series: 'A', no: st.block.next++ };
    else out = { series: 'P' + st.dev, no: ++st.prov };
    await S.saveBillState();
    topUp();
    return out;
  };
  const p = numLock.then(run, run);
  numLock = p.catch(() => {});
  return p;
}
async function createBill(b) {
  need(WRITE_PERM);
  const rec = normalizeBill({ ...b, series: undefined, bill_no: undefined }, todayIST());
  const { series, no } = await takeBillNumber();
  const clientId = typeof b.client_id === 'string' && /^[\w-]{8,64}$/.test(b.client_id) ? b.client_id : S.newClientId();
  const old = S.rows('bills').find((r) => r.client_id === clientId);
  if (old) return old; // double-tap or retry
  const row = baseRow({ id: S.nextTempId(), client_id: clientId, ...rec, series, bill_no: no, voided: 0 });
  await S.commit({ put: [['bills', row]], queue: [S.q.create('bills', row.id, { ...b, client_id: clientId, series, bill_no: no })] });
  return row;
}
function listBills(qs) {
  need('entries.view');
  const q = lc(qs.get('q') || '').trim().replace(/^#/, '').slice(0, 80);
  const customer = lc(qs.get('customer') || '').trim();
  const from = qs.get('from'), to = qs.get('to'), voided = qs.get('voided');
  const limit = Math.min(200, Math.max(1, Math.floor(Number(qs.get('limit'))) || 50));
  const offset = Math.max(0, Math.floor(Number(qs.get('offset'))) || 0);
  const all = S.rows('bills').filter((r) =>
    (!q || lc(r.customer).includes(q) || lc(r.phone).includes(q) || lc(`${r.series}-${r.bill_no}`).includes(q) || String(r.bill_no) === q)
    && (!customer || lc(r.customer) === customer) && (!from || r.entry_date >= from) && (!to || r.entry_date <= to)
    && (voided !== '0' && voided !== '1' || r.voided === Number(voided)))
    .sort((a, b) => (a.entry_date < b.entry_date ? 1 : a.entry_date > b.entry_date ? -1 : ord(b.id) - ord(a.id)));
  return { bills: all.slice(offset, offset + limit), total: all.length, limit, offset };
}
async function voidBill(clientId) {
  need('entries.delete');
  const old = S.rows('bills').find((r) => r.client_id === clientId);
  if (!old) bad('Bill not found', 404);
  if (old.voided) return old;
  const row = { ...old, voided: 1, updated_at: nowSql() };
  const sale = old.collection_client_id ? S.rows('collections').find((r) => r.client_id === old.collection_client_id) : null; // may already be deleted
  const queue = [];
  if (sale) queue.push(S.q.remove('collections', sale.id));
  queue.push(S.q.upsert(`billvoid:${clientId}`, 'POST', `/api/c/bills/${clientId}/void`, {}));
  await S.commit({ put: [['bills', row]], del: sale ? [['collections', sale.id]] : [], queue });
  return row;
}

// ---------- router ----------
const ENTRY = '(purchases|expenses|collections|payments)';
function parseCtx(date) {
  return { defaultYear: Number((date && isDate(date) ? date : todayIST()).slice(0, 4)),
    products: S.rows('products').filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, pieces_per_unit: p.pieces_per_unit })),
    categories: S.rows('expense_categories').map((c) => c.name) };
}

export async function localRequest(method, path, body) {
  try { if (localStorage.getItem('dk_local') === '0') return NOT_LOCAL; } catch { /* storage blocked */ }
  if (!S.isActive() || S.needsFirstSync() || S.currentCompany() !== activeCompanyId()) return NOT_LOCAL;
  const u = new URL(path, location.origin);
  const p = u.pathname.replace(/^\/api\/c/, '');
  const qs = u.searchParams;
  let m;
  try {
    if (method === 'GET') {
      if (p === '/context') {
        const ctx = S.getContext()?.company || state.company;
        if (!ctx) return NOT_LOCAL;
        return { company: ctx, products: S.rows('products').sort((a, b) => (b.active - a.active) || nameCmp(a, b)), categories: S.rows('expense_categories').sort(nameCmp), user: state.user, today: todayIST() };
      }
      if (p === '/products') { need('entries.view'); return productsList(); }
      if (p === '/categories') { need('entries.view'); return S.rows('expense_categories').sort(nameCmp); }
      if ((m = p.match(new RegExp(`^/${ENTRY}$`)))) return listEntries(m[1], qs);
      if ((m = p.match(/^\/day\/([^/]+)$/))) return dayView(m[1]);
      if (p === '/bills') return listBills(qs);
      if ((m = p.match(/^\/bills\/([^/]+)$/))) { need('entries.view'); return S.rows('bills').find((r) => r.client_id === m[1]) ?? bad('Bill not found', 404); }
      if (p === '/notes') { need('entries.view'); return S.rows('notes').sort((a, b) => (b.pinned - a.pinned) || (a.updated_at < b.updated_at ? 1 : -1)); }
      if (p === '/reports/summary') {
        need('reports.view');
        const { from, to } = rangeOf(qs);
        const group = oneOf(qs.get('group'), ['day', 'week', 'month'], 'group', 'day');
        return buildSummary(localReport(from, to), categoryTotals(S.snapshot(), from, to), group);
      }
      if ((m = p.match(/^\/reports\/day\/([^/]+)$/))) { need('reports.view'); const d = reqDate(m[1]); return localReport(d, d, true).days[0]; }
      if (p === '/reports/compare') {
        need('reports.view');
        const q = (k) => reqDate(qs.get(k), k);
        const a = { from: q('a_from'), to: q('a_to') }, b2 = { from: q('b_from'), to: q('b_to') };
        for (const r of [a, b2]) if (r.from > r.to || daysBetween(r.from, r.to) > MAX_RANGE_DAYS) bad('Invalid comparison range');
        return { a: localReport(a.from, a.to).totals, b: localReport(b2.from, b2.to).totals };
      }
      if (p === '/reports/outstanding') { need('reports.view'); return partyBalances(S.snapshot()); }
      return NOT_LOCAL;
    }
    if (method === 'POST') {
      if ((m = p.match(new RegExp(`^/${ENTRY}$`)))) return await createEntry(m[1], body || {});
      if (p === '/bills') return await createBill(body || {});
      if ((m = p.match(/^\/bills\/([^/]+)\/void$/))) return await voidBill(m[1]);
      if (p === '/products') return await saveProduct(0, body || {});
      if (p === '/categories') return await saveCategory(0, body || {});
      if (p === '/parse') { need(WRITE_PERM); return parseText(String(body?.text ?? '').slice(0, 20000), parseCtx(body?.date)); }
      if (p === '/bulk') return body?.document_id ? NOT_LOCAL : await bulk(body || {});
      return NOT_LOCAL;
    }
    if (method === 'PUT') {
      if ((m = p.match(new RegExp(`^/${ENTRY}/(-?\\d+)$`)))) return await updateEntry(m[1], Number(m[2]), body || {});
      if ((m = p.match(/^\/products\/(-?\d+)$/))) return await saveProduct(Number(m[1]), body || {});
      if ((m = p.match(/^\/categories\/(-?\d+)$/))) return await saveCategory(Number(m[1]), body || {});
      if ((m = p.match(/^\/day\/([^/]+)\/stock$/))) return await saveStock(m[1], body || {});
      if ((m = p.match(/^\/day\/([^/]+)\/closing$/))) return await saveClosing(m[1], body || {});
      if ((m = p.match(/^\/notes\/([^/]+)$/))) return await saveNote(m[1], body || {});
      return NOT_LOCAL;
    }
    if (method === 'DELETE') {
      if ((m = p.match(new RegExp(`^/${ENTRY}/(-?\\d+)$`)))) return await deleteEntry(m[1], Number(m[2]));
      if ((m = p.match(/^\/products\/(-?\d+)$/))) return await deleteProduct(Number(m[1]));
      if ((m = p.match(/^\/categories\/(-?\d+)$/))) return await deleteCategory(Number(m[1]));
      if ((m = p.match(/^\/day\/([^/]+)\/closing$/))) return await deleteClosing(m[1]);
      if ((m = p.match(/^\/notes\/([^/]+)$/))) return await deleteNote(m[1]);
      return NOT_LOCAL;
    }
  } catch (e) {
    // the server-side validators throw HTTP-style errors; present them like any other API error
    if (e instanceof ApiError) throw e;
    if (e && typeof e.status === 'number' && e.message) throw new ApiError(e.message, e.status);
    throw e;
  }
  return NOT_LOCAL;
}
