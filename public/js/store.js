// The phone's own copy of the company's books, plus the queue of changes waiting to be uploaded.
//
//   screens ──► localapi.js ──► store (memory + IndexedDB) ──► outbox ──► background upload ──► server
//                                  ▲                                                              │
//                                  └──────────────── background download of what changed ◄────────┘
//
// Every read is answered from memory; every write lands on the phone first (and survives closing the app or losing
// signal), then uploads in the background. The server stays the source of truth: it re-validates and re-calculates
// everything, and whatever it sends back replaces our provisional copy.
import { state, ApiError } from './state.js';

export const TABLES = ['products', 'expense_categories', 'purchases', 'expenses', 'collections', 'payments', 'stock_counts', 'day_closings', 'notes'];
const POLL_MS = 40_000;
const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const stripRuntime = (op) => { const { inflight, ...rest } = op; return rest; };

let db = null;
let data = emptyData();
let outbox = [];
let companyId = null;
let active = false;
let version = 0;
let tempSeq = 0;
let qidSeq = 0;
let meta = { seq: null, synced: false, lastSync: 0, context: null };
let syncState = 'idle'; // idle | syncing | offline | auth | error
let lastError = '';
let flushing = null;
let pulling = null;
let retryAt = 0;
let timer = null;
let channel = null;

function emptyData() { const d = {}; for (const t of TABLES) d[t] = new Map(); return d; }
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const emitStatus = () => emit('dk:sync', status());

// ---------- IndexedDB ----------
const dbName = (cid) => `dk-${cid}`;
function rememberDb(name) {
  try { const l = new Set(JSON.parse(localStorage.getItem('dk_dbs') || '[]')); l.add(name); localStorage.setItem('dk_dbs', JSON.stringify([...l])); } catch { /* ignore */ }
}
function openDb(cid) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(dbName(cid), 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const t of TABLES) d.createObjectStore(t, { keyPath: 'id' });
      d.createObjectStore('outbox', { keyPath: 'qid' });
      d.createObjectStore('kv', { keyPath: 'k' });
    };
    req.onsuccess = () => { rememberDb(dbName(cid)); resolve(req.result); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}
function readAll(d, names) {
  return new Promise((resolve, reject) => {
    const t = d.transaction(names, 'readonly'); const out = {};
    for (const n of names) { const r = t.objectStore(n).getAll(); r.onsuccess = () => { out[n] = r.result; }; }
    t.oncomplete = () => resolve(out); t.onerror = t.onabort = () => reject(t.error);
  });
}
/** One atomic write: rows, queue entries and settings together, so a crash can never leave them out of step. */
function persist({ put = [], del = [], ops = [], opsDel = [], kv = null } = {}) {
  if (!db) return Promise.resolve();
  const names = new Set();
  for (const [t] of put) names.add(t);
  for (const [t] of del) names.add(t);
  if (ops.length || opsDel.length) names.add('outbox');
  if (kv) names.add('kv');
  if (!names.size) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = db.transaction([...names], 'readwrite');
    for (const [tbl, row] of put) t.objectStore(tbl).put(row);
    for (const [tbl, id] of del) t.objectStore(tbl).delete(id);
    for (const op of ops) t.objectStore('outbox').put(stripRuntime(op));
    for (const q of opsDel) t.objectStore('outbox').delete(q);
    if (kv) t.objectStore('kv').put({ k: 'meta', ...kv });
    t.oncomplete = () => resolve(); t.onerror = t.onabort = () => reject(t.error);
  });
}
const saveMeta = () => persist({ kv: meta });

// ---------- open / close ----------
export async function openStore(cid) {
  if (active && companyId === cid) return { first: !meta.synced };
  closeStore();
  try { db = await openDb(cid); } catch { db = null; active = false; return null; }
  await load();
  companyId = cid; active = true;
  try { channel = new BroadcastChannel(`dk-${cid}`); channel.onmessage = async () => { await load(); emit('dk:data', { external: true }); }; } catch { /* no BroadcastChannel */ }
  navigator.storage?.persist?.().catch(() => {});
  emitStatus();
  return { first: !meta.synced };
}
async function load() {
  const names = [...TABLES, 'outbox', 'kv'];
  const all = await readAll(db, names);
  data = emptyData();
  for (const t of TABLES) for (const r of all[t]) data[t].set(r.id, r);
  outbox = all.outbox.sort((a, b) => a.qid - b.qid);
  const m = all.kv.find((x) => x.k === 'meta');
  meta = m ? { seq: m.seq ?? null, synced: !!m.synced, lastSync: m.lastSync || 0, context: m.context || null } : { seq: null, synced: false, lastSync: 0, context: null };
  tempSeq = 0; qidSeq = 0;
  for (const t of TABLES) for (const id of data[t].keys()) if (id < 0) tempSeq = Math.max(tempSeq, -id);
  for (const o of outbox) { qidSeq = Math.max(qidSeq, o.qid); if (o.tempId < 0) tempSeq = Math.max(tempSeq, -o.tempId); }
  version++;
}
export function closeStore() {
  clearInterval(timer); timer = null;
  try { channel?.close(); } catch { /* ignore */ }
  channel = null;
  try { db?.close(); } catch { /* ignore */ }
  db = null; active = false; companyId = null; data = emptyData(); outbox = []; meta = { seq: null, synced: false, lastSync: 0, context: null };
  version++;
}
export const isActive = () => active;
export const currentCompany = () => companyId;
export const getVersion = () => version;

/** Delete every local copy of company data on this phone (sign-out). */
export async function wipeAll() {
  closeStore();
  let names = [];
  try { names = JSON.parse(localStorage.getItem('dk_dbs') || '[]'); } catch { /* ignore */ }
  await Promise.all(names.map((n) => new Promise((res) => { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => res(); })));
  try { localStorage.removeItem('dk_dbs'); } catch { /* ignore */ }
}

// ---------- reading ----------
export const rows = (t) => [...data[t].values()];
export const getRow = (t, id) => data[t].get(id);
let snapVersion = -1, snap = null;
/** All tables as arrays (cached until something changes). */
export function snapshot() {
  if (snapVersion === version && snap) return snap;
  snap = {}; for (const t of TABLES) snap[t] = [...data[t].values()]; snapVersion = version;
  return snap;
}
export const nextTempId = () => -(++tempSeq);
export function newClientId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
}
export const getContext = () => meta.context;
export function setContext(ctx) { meta.context = ctx; return saveMeta(); }
export const needsFirstSync = () => !meta.synced;

// ---------- writing (always local first) ----------
const pathOf = { products: 'products', expense_categories: 'categories', purchases: 'purchases', expenses: 'expenses', collections: 'collections', payments: 'payments' };

function keyOf(table, id) { return `${table}:${id}`; }
function pendingOps() { return outbox.filter((o) => o.status !== 'failed'); }

/**
 * Apply a change on the phone and queue its upload. `put` = [[table,row]], `del` = [[table,id]].
 * `queue` = functions that add/merge queue entries (see helpers below).
 */
export async function commit({ put = [], del = [], queue = [] }) {
  const persistPut = [], persistDel = [], opsPut = [], opsDel = [];
  for (const [t, row] of put) { data[t].set(row.id, row); persistPut.push([t, row]); }
  for (const [t, id] of del) { data[t].delete(id); persistDel.push([t, id]); }
  const ctx = {
    add(op) { op.qid = ++qidSeq; op.status = 'pending'; op.tries = 0; op.at = Date.now(); outbox.push(op); opsPut.push(op); },
    change(op) { opsPut.push(op); },
    drop(op) { outbox = outbox.filter((o) => o !== op); opsDel.push(op.qid); },
  };
  for (const q of queue) q(ctx);
  version++;
  await persist({ put: persistPut, del: persistDel, ops: opsPut.filter((o) => outbox.includes(o)), opsDel });
  try { channel?.postMessage(1); } catch { /* ignore */ }
  emitStatus();
  flushSoon();
}

const findOp = (pred) => outbox.find((o) => pred(o) && !o.inflight && o.status !== 'failed');
/** Queue helpers: each returns a function for commit({queue:[…]}). */
export const q = {
  create: (table, tempId, body) => (ctx) => ctx.add({ method: 'POST', path: pathOf[table], table, tempId, body, key: null, label: `new ${table.replace('_', ' ')}` }),
  update: (table, id, body) => (ctx) => {
    if (id < 0) {
      const c = findOp((o) => o.method === 'POST' && o.table === table && o.tempId === id);
      if (c) { c.body = { ...c.body, ...body, client_id: c.body.client_id }; return ctx.change(c); }
      // the create is already on its way: send the edit right after it, once the real id is known
    }
    const key = keyOf(table, id);
    const ex = findOp((o) => o.key === key && o.method === 'PUT');
    if (ex) { ex.body = body; return ctx.change(ex); }
    ctx.add({ method: 'PUT', path: pathOf[table], table, rowId: id, body, key, label: `edit ${table.replace('_', ' ')}` });
  },
  remove: (table, id) => (ctx) => {
    if (id < 0) {
      const c = findOp((o) => o.method === 'POST' && o.table === table && o.tempId === id);
      if (c) { // never reached the server: just forget it
        for (const o of outbox.filter((x) => x.table === table && x.rowId === id && !x.inflight)) ctx.drop(o);
        return ctx.drop(c);
      }
    }
    const key = keyOf(table, id);
    for (const o of outbox.filter((x) => x.key === key && !x.inflight && x.method !== 'DELETE')) ctx.drop(o);
    ctx.add({ method: 'DELETE', path: pathOf[table], table, rowId: id, body: undefined, key, label: `delete ${table.replace('_', ' ')}` });
  },
  /** Idempotent PUT/DELETE with a fixed URL; the newest queued version for `key` wins. */
  upsert: (key, method, url, body, merge) => (ctx) => {
    const ex = findOp((o) => o.key === key);
    if (ex) { ex.method = method; ex.url = url; ex.body = merge ? merge(ex.body, body) : body; return ctx.change(ex); }
    ctx.add({ method, url, body, key, label: key.split(':')[0] });
  },
};

// ---------- uploading ----------
const isNetworkError = (e) => !(e instanceof ApiError);
function headersFor() {
  const h = { 'content-type': 'application/json' };
  if (state.user?.role === 'super_admin') h['x-company-id'] = String(companyId);
  return h;
}
async function send(method, url, body) {
  const res = await fetch(url, { method, headers: headersFor(), body: body !== undefined && method !== 'DELETE' ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let json = null; try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
  return json;
}
const urlOf = (op) => op.url || `/api/c/${op.path}${op.rowId !== undefined ? '/' + op.rowId : ''}`;

export function flushSoon() { setTimeout(() => flush().catch(() => {}), 30); }

export function flush() {
  if (!active || flushing) return flushing || Promise.resolve();
  if (syncState === 'auth') return Promise.resolve();
  const run = async () => {
    let did = false;
    for (;;) {
      const op = outbox.find((o) => o.status !== 'failed');
      if (!op) break;
      op.inflight = true; syncState = 'syncing'; emitStatus();
      try {
        const res = await send(op.method, urlOf(op), op.body);
        await onSuccess(op, res);
        did = true; retryAt = 0;
      } catch (e) {
        op.inflight = false;
        if (isNetworkError(e)) { syncState = 'offline'; lastError = ''; retryAt = Date.now() + 8000; break; }
        if (e.status === 401) { syncState = 'auth'; lastError = 'Sign in again to sync'; break; }
        if (e.status === 403 && /suspended|disabled/i.test(e.message)) { syncState = 'error'; lastError = e.message; break; }
        if (e.status === 429 || e.status >= 500) { op.tries++; syncState = 'error'; lastError = 'Server busy, will retry'; retryAt = Date.now() + Math.min(60000, 4000 * 2 ** op.tries); await persist({ ops: [stripRuntime(op)] }); break; }
        if (op.method === 'DELETE' && e.status === 404) { await onSuccess(op, null); continue; }
        if (op.method === 'POST' && e.status === 409 && /already exists/i.test(e.message)) { await onSuccess(op, null, true); did = true; continue; }
        // The server refused this change (validation, plan limit…). Keep it visible instead of losing it silently.
        op.status = 'failed'; op.error = e.message; op.inflight = false;
        await persist({ ops: [stripRuntime(op)] });
        syncState = 'error'; lastError = e.message; emitStatus(); emit('dk:syncfail', { op, message: e.message });
        continue;
      }
    }
    if (!outbox.some((o) => o.status !== 'failed') && syncState !== 'offline' && syncState !== 'auth') syncState = outbox.some((o) => o.status === 'failed') ? 'error' : 'idle';
    emitStatus();
    return did;
  };
  const withLock = navigator.locks ? () => navigator.locks.request(`dk-flush-${companyId}`, { ifAvailable: true }, (lock) => (lock ? run() : false)) : run;
  flushing = withLock().then(async (did) => { if (did) await pull(); return did; }).finally(() => { flushing = null; });
  return flushing;
}

async function onSuccess(op, res, conflict = false) {
  outbox = outbox.filter((o) => o !== op);
  const put = [], del = [];
  if (op.method === 'POST' && op.tempId !== undefined) {
    const old = data[op.table].get(op.tempId);
    if (res && res.id) {
      if (old) { data[op.table].delete(op.tempId); del.push([op.table, op.tempId]); }
      data[op.table].set(res.id, res); put.push([op.table, res]);
      // edits/deletes queued behind this create now know the real id
      for (const o of outbox) if (o.table === op.table && o.rowId === op.tempId) { o.rowId = res.id; o.key = keyOf(op.table, res.id); }
      if (op.table === 'products') remapProduct(op.tempId, res.id, put, del);
    }
    void conflict; // 409 = it already exists on the server; the next pull brings it and replaces our temporary row
  } else if (res && res.id && op.method === 'PUT') {
    const table = op.table || (op.url?.includes('/notes/') ? 'notes' : op.url?.includes('/closing') ? 'day_closings' : null);
    if (table && !outbox.some((o) => o.key === op.key)) {
      if (table === 'day_closings') for (const [id, r] of data.day_closings) if (r.entry_date === res.entry_date && id !== res.id) { data.day_closings.delete(id); del.push([table, id]); }
      if (table === 'notes') for (const [id, r] of data.notes) if (r.client_id === res.client_id && id !== res.id) { data.notes.delete(id); del.push([table, id]); }
      data[table].set(res.id, res); put.push([table, res]);
    }
  }
  version++;
  const rowOps = outbox.filter((o) => o.rowId !== undefined);
  await persist({ put, del, ops: rowOps, opsDel: [op.qid] });
  emitStatus();
}

function remapProduct(oldId, newId, put, del) {
  for (const [t, field] of [['purchases', 'product_id'], ['stock_counts', 'product_id']]) {
    for (const r of data[t].values()) if (r[field] === oldId) { r[field] = newId; put.push([t, r]); }
  }
  const changed = [];
  for (const o of outbox) {
    const cs = o.body?.counts;
    if (Array.isArray(cs)) { let hit = false; for (const c of cs) if (c.product_id === oldId) { c.product_id = newId; hit = true; } if (hit) changed.push(o); }
    if (o.body && o.body.product_id === oldId) { o.body.product_id = newId; changed.push(o); }
  }
  if (changed.length) persist({ ops: changed.map(stripRuntime) }).catch(() => {});
  if (data.products.has(oldId)) { data.products.delete(oldId); del.push(['products', oldId]); }
}

// ---------- downloading ----------
async function getJson(url) {
  const res = await fetch(url, { headers: headersFor(), credentials: 'same-origin' });
  let json = null; try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
  return json;
}

function dirtyKeys() {
  const s = new Set();
  for (const o of outbox) {
    if (o.key) s.add(o.key);
    if (o.body?.counts) for (const c of o.body.counts) s.add(`stock:${o.url?.match(/day\/([\d-]+)/)?.[1]}:${c.product_id}`);
  }
  return s;
}
const isDirty = (set, t, r) => set.has(keyOf(t, r.id)) || (t === 'stock_counts' && set.has(`stock:${r.entry_date}:${r.product_id}`)) || (t === 'day_closings' && set.has(`closing:${r.entry_date}`)) || (t === 'notes' && set.has(`note:${r.client_id}`));
const sameRow = (a, b) => { if (!a) return false; for (const k of Object.keys(b)) if (k !== 'updated_at' && k !== 'created_at' && a[k] !== b[k]) return false; return true; };

function applyPulled(res) {
  const dirty = dirtyKeys();
  const put = [], del = [];
  let changed = false;
  const drop = (t, id) => { if (data[t].delete(id)) { del.push([t, id]); changed = true; } };
  for (const t of TABLES) {
    const part = res.tables?.[t]; if (!part) continue;
    const m = data[t];
    if (res.reset) {
      const incoming = new Set(part.upsert.map((r) => r.id));
      for (const [id, r] of [...m]) if (id > 0 && !incoming.has(id) && !isDirty(dirty, t, r)) drop(t, id);
    }
    const temps = [...m.entries()].filter(([id]) => id < 0); // only provisional rows can duplicate an incoming one
    for (const r of part.upsert) {
      if (isDirty(dirty, t, r)) continue;
      // a provisional local copy of the same thing? replace it
      for (const [id, l] of temps) {
        if (id === r.id || !m.has(id)) continue;
        const sameClient = r.client_id && l.client_id === r.client_id;
        const sameDay = (t === 'day_closings' && l.entry_date === r.entry_date) || (t === 'stock_counts' && l.entry_date === r.entry_date && l.product_id === r.product_id);
        const sameName = (t === 'products' || t === 'expense_categories') && id < 0 && String(l.name).toLowerCase() === String(r.name).toLowerCase();
        if (sameClient || sameDay || sameName) { if (t === 'products' && id < 0) remapProduct(id, r.id, put, del); drop(t, id); }
      }
      if (!sameRow(m.get(r.id), r)) changed = true;
      m.set(r.id, r); put.push([t, r]);
    }
    for (const id of part.delete) { const l = m.get(id); if (l && !isDirty(dirty, t, l)) drop(t, id); }
  }
  return { put, del, changed };
}

export function pull({ full = false } = {}) {
  if (!active) return Promise.resolve(false);
  if (pulling) return pulling;
  if (syncState === 'auth') return Promise.resolve(false);
  pulling = (async () => {
    let any = false;
    if (syncState !== 'syncing') { syncState = 'syncing'; emitStatus(); }
    let since = full || meta.seq === null || !meta.synced ? null : meta.seq;
    // a device that has been away longer than the server keeps history for starts over
    if (since !== null && Date.now() - meta.lastSync > 30 * 86400000) since = null;
    const first = !meta.synced;
    try {
      for (;;) {
        const res = await getJson(`/api/c/sync${since !== null ? `?since=${since}` : ''}`);
        const { put, del, changed } = applyPulled(res);
        meta.seq = res.seq; meta.synced = true; meta.lastSync = Date.now();
        version++;
        await persist({ put, del, kv: meta });
        any = any || changed;
        if (res.more) since = res.seq; else break;
      }
      syncState = outbox.some((o) => o.status === 'failed') ? 'error' : 'idle'; lastError = '';
      if (any && !first) emit('dk:data', { external: true });
      if (first) emit('dk:data', { first: true });
    } catch (e) {
      if (e.status === 401) { syncState = 'auth'; lastError = 'Sign in again to sync'; }
      else if (isNetworkError(e)) { syncState = 'offline'; retryAt = Date.now() + 8000; }
      else { syncState = 'error'; lastError = e.message; }
      if (first) throw e;
    } finally { pulling = null; emitStatus(); }
    return any;
  })();
  return pulling;
}
let pullTimer = null;
export function pullSoon(ms = 400) { clearTimeout(pullTimer); pullTimer = setTimeout(() => pull().catch(() => {}), ms); }

/** Upload everything waiting, then fetch what changed. Used by the poll timer and the "sync now" button. */
export async function syncNow() {
  if (!active) return;
  if (syncState === 'auth') { emitStatus(); return; }
  if (syncState === 'offline' || syncState === 'error') syncState = 'idle';
  await flush().catch(() => {});
  await pull().catch(() => {});
}
/** Wait (up to `ms`) for the upload queue to drain, e.g. before sign-out or an export. */
export async function flushNow(ms = 3000) {
  if (!active || !outbox.some((o) => o.status !== 'failed')) return true;
  if (syncState === 'auth') return false;
  syncState = syncState === 'offline' ? 'idle' : syncState;
  await Promise.race([flush().catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
  return !outbox.some((o) => o.status !== 'failed');
}

export function startSync() {
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === 'visible' && Date.now() >= retryAt) syncNow(); }, POLL_MS);
}
addEventListener('online', () => { retryAt = 0; if (syncState === 'offline') syncState = 'idle'; syncNow(); });
addEventListener('offline', () => { if (active) { syncState = 'offline'; emitStatus(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && active && Date.now() >= retryAt) syncNow(); });
/** After signing in again: resume uploading. */
export function resumeAuth() { if (syncState === 'auth') syncState = 'idle'; retryAt = 0; if (active) syncNow(); }

// ---------- status & problems ----------
export function status() {
  const pending = outbox.filter((o) => o.status !== 'failed').length;
  const failed = outbox.filter((o) => o.status === 'failed').length;
  const offline = syncState === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false);
  return { state: offline && syncState !== 'auth' ? 'offline' : syncState, pending, failed, last: meta.lastSync, error: lastError, active };
}
export const failedOps = () => outbox.filter((o) => o.status === 'failed').map(({ qid, label, error, method, body }) => ({ qid, label, error, method, body }));
export async function retryFailed(qid) {
  const op = outbox.find((o) => o.qid === qid); if (!op) return;
  op.status = 'pending'; op.error = ''; await persist({ ops: [stripRuntime(op)] }); syncState = 'idle'; emitStatus(); flushSoon();
}
export async function discardFailed(qid) {
  const op = outbox.find((o) => o.qid === qid); if (!op) return;
  outbox = outbox.filter((o) => o !== op);
  await persist({ opsDel: [qid] });
  // our optimistic copy is now wrong: realign with the server
  if (op.method === 'POST' && op.tempId < 0 && data[op.table].has(op.tempId)) { data[op.table].delete(op.tempId); await persist({ del: [[op.table, op.tempId]] }); }
  version++; emitStatus(); emit('dk:data', { external: true });
  pull({ full: true }).catch(() => {});
}
