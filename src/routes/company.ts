import { Hono, type Context } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth, companyScope, perm } from '../middleware';
import { audit } from '../lib/audit';
import { fail, reqDate, isDate, toPaise, optPaise, reqStr, optStr, reqNum, oneOf, isColor, idParam, todayIST, addDays, daysBetween } from '../lib/util';
import { loadReport } from '../lib/report';
import { parseText } from '../lib/parser';
import { extractFromImage } from '../lib/ocr';
import { buildCsv, buildXlsx, type Cell } from '../lib/xlsx';
import { hashPassword, validatePassword } from '../lib/crypto';
import { PERMISSIONS, ROLE_DEFAULTS, effectivePermissions } from '../lib/permissions';

type C = Context<AppEnv>;
const co = new Hono<AppEnv>();
co.use('*', requireAuth, companyScope);

const PAY_MODES = ['cash', 'bank', 'credit'] as const;
const COLLECTION_MODES = ['cash', 'upi', 'card', 'credit'] as const;
const PAYMENT_MODES = ['cash', 'bank', 'upi'] as const;
const MAX_RANGE_DAYS = 400;

async function planLimits(c: C) {
  const p = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(c.get('company').plan_id).first<any>();
  return p ?? { max_users: 1000, max_products: 100000, max_storage_mb: 100000, ocr_enabled: 1, name: 'Unlimited' };
}

function range(c: C) {
  const to = c.req.query('to') || todayIST();
  const from = c.req.query('from') || to;
  reqDate(from, 'from'); reqDate(to, 'to');
  if (from > to) fail(422, '"from" must be on or before "to"');
  if (daysBetween(from, to) > MAX_RANGE_DAYS) fail(422, `Date range is limited to ${MAX_RANGE_DAYS} days`);
  return { from, to };
}

// ---------- context ----------
co.get('/context', async (c) => {
  const cid = c.get('companyId');
  const [company, products, categories] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT c.id, c.name, c.slug, c.status, c.primary_color, c.accent_color, c.business_type, c.address, c.phone, c.email, c.gstin,
                             (c.logo_key IS NOT NULL) AS has_logo, c.updated_at, p.name AS plan_name, p.ocr_enabled, p.max_users, p.max_products, p.max_storage_mb
                        FROM companies c LEFT JOIN plans p ON p.id = c.plan_id WHERE c.id = ?`).bind(cid),
    c.env.DB.prepare('SELECT * FROM products WHERE company_id = ? ORDER BY active DESC, name').bind(cid),
    c.env.DB.prepare('SELECT * FROM expense_categories WHERE company_id = ? ORDER BY name').bind(cid),
  ]);
  return c.json({ company: company.results[0], products: products.results, categories: categories.results, user: c.get('user'), today: todayIST() });
});

// ---------- products ----------
function productFields(body: any) {
  const ppu = reqNum(body.pieces_per_unit ?? 1, 'pieces per unit', { min: 1, max: 100000, int: true });
  return {
    name: reqStr(body.name, 'name', 80),
    category: optStr(body.category, 60),
    unit: (optStr(body.unit, 20) ?? 'box').toLowerCase(),
    pieces_per_unit: ppu,
    default_unit_cost_paise: optPaise(body.default_unit_cost, 'default cost'),
    sale_price_paise: optPaise(body.sale_price, 'sale price'),
    active: body.active === false || body.active === 0 ? 0 : 1,
  };
}
co.get('/products', perm('entries.view'), async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT p.*, (SELECT ROUND(SUM(total_cost_paise) * 1.0 / NULLIF(SUM(pieces), 0), 2) FROM purchases WHERE product_id = p.id) AS avg_cost_per_piece_paise,
            (SELECT MAX(entry_date) FROM purchases WHERE product_id = p.id) AS last_purchase
       FROM products p WHERE p.company_id = ? ORDER BY p.active DESC, p.name`).bind(c.get('companyId')).all();
  return c.json(r.results);
});
co.post('/products', perm('products.manage'), async (c) => {
  const cid = c.get('companyId');
  const f = productFields(await c.req.json());
  const limits = await planLimits(c);
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE company_id = ?').bind(cid).first<number>('n');
  if ((n ?? 0) >= limits.max_products) fail(403, `Your plan allows ${limits.max_products} products`);
  const dup = await c.env.DB.prepare('SELECT id FROM products WHERE company_id = ? AND name = ?').bind(cid, f.name).first();
  if (dup) fail(409, 'A product with this name already exists');
  const r = await c.env.DB.prepare(`INSERT INTO products (company_id, name, category, unit, pieces_per_unit, default_unit_cost_paise, sale_price_paise, active)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(cid, f.name, f.category, f.unit, f.pieces_per_unit, f.default_unit_cost_paise, f.sale_price_paise, f.active).first();
  await audit(c, 'create', 'product', (r as any).id, null, r);
  return c.json(r, 201);
});
co.put('/products/:id', perm('products.manage'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  const before = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?').bind(id, cid).first();
  if (!before) fail(404, 'Product not found');
  const f = productFields(await c.req.json());
  const dup = await c.env.DB.prepare('SELECT id FROM products WHERE company_id = ? AND name = ? AND id <> ?').bind(cid, f.name, id).first();
  if (dup) fail(409, 'A product with this name already exists');
  const r = await c.env.DB.prepare(`UPDATE products SET name=?, category=?, unit=?, pieces_per_unit=?, default_unit_cost_paise=?, sale_price_paise=?, active=?, updated_at=datetime('now')
                                    WHERE id = ? AND company_id = ? RETURNING *`)
    .bind(f.name, f.category, f.unit, f.pieces_per_unit, f.default_unit_cost_paise, f.sale_price_paise, f.active, id, cid).first();
  await audit(c, 'update', 'product', id, before, r);
  return c.json(r);
});
co.delete('/products/:id', perm('products.manage'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  const before = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?').bind(id, cid).first();
  if (!before) fail(404, 'Product not found');
  const used = await c.env.DB.prepare('SELECT 1 FROM purchases WHERE product_id = ? AND company_id = ? LIMIT 1').bind(id, cid).first();
  if (used) {
    await c.env.DB.prepare(`UPDATE products SET active = 0, updated_at = datetime('now') WHERE id = ? AND company_id = ?`).bind(id, cid).run();
    await audit(c, 'archive', 'product', id, before, null);
    return c.json({ archived: true });
  }
  await c.env.DB.prepare('DELETE FROM products WHERE id = ? AND company_id = ?').bind(id, cid).run();
  await audit(c, 'delete', 'product', id, before, null);
  return c.json({ deleted: true });
});

// ---------- expense categories ----------
co.get('/categories', perm('entries.view'), async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM expense_categories WHERE company_id = ? ORDER BY name').bind(c.get('companyId')).all();
  return c.json(r.results);
});
co.post('/categories', perm('products.manage'), async (c) => {
  const cid = c.get('companyId'); const name = reqStr((await c.req.json()).name, 'name', 60);
  const r = await c.env.DB.prepare('INSERT INTO expense_categories (company_id, name) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING *').bind(cid, name).first();
  if (!r) fail(409, 'Category already exists');
  await audit(c, 'create', 'expense_category', (r as any).id, null, r);
  return c.json(r, 201);
});
co.put('/categories/:id', perm('products.manage'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  const name = reqStr((await c.req.json()).name, 'name', 60);
  const before = await c.env.DB.prepare('SELECT * FROM expense_categories WHERE id = ? AND company_id = ?').bind(id, cid).first();
  if (!before) fail(404, 'Category not found');
  const r = await c.env.DB.prepare('UPDATE expense_categories SET name = ? WHERE id = ? AND company_id = ? RETURNING *').bind(name, id, cid).first();
  await audit(c, 'update', 'expense_category', id, before, r);
  return c.json(r);
});
co.delete('/categories/:id', perm('products.manage'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  const used = await c.env.DB.prepare('SELECT 1 FROM expenses WHERE category_id = ? AND company_id = ? LIMIT 1').bind(id, cid).first();
  if (used) fail(409, 'Category has expenses; rename it instead');
  const before = await c.env.DB.prepare('DELETE FROM expense_categories WHERE id = ? AND company_id = ? RETURNING *').bind(id, cid).first();
  if (!before) fail(404, 'Category not found');
  await audit(c, 'delete', 'expense_category', id, before, null);
  return c.json({ deleted: true });
});

// ---------- entry helpers ----------
async function productFor(c: C, body: any): Promise<{ id: number; pieces_per_unit: number; unit: string }> {
  const cid = c.get('companyId');
  if (body.product_id) {
    const p = await c.env.DB.prepare('SELECT id, pieces_per_unit, unit FROM products WHERE id = ? AND company_id = ?').bind(Number(body.product_id), cid).first<any>();
    if (!p) fail(422, 'Unknown product');
    return p;
  }
  const name = reqStr(body.product_name ?? body.item, 'product name', 80);
  const ex = await c.env.DB.prepare('SELECT id, pieces_per_unit, unit FROM products WHERE company_id = ? AND name = ?').bind(cid, name).first<any>();
  if (ex) return ex;
  if (!c.get('user').permissions.includes('products.manage') && !c.get('user').permissions.includes('entries.write')) fail(403, 'Cannot create products');
  const limits = await planLimits(c);
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE company_id = ?').bind(cid).first<number>('n');
  if ((n ?? 0) >= limits.max_products) fail(403, `Your plan allows ${limits.max_products} products`);
  const qty = Number(body.qty) || 1; const pieces = Number(body.pieces) || 0;
  const ppu = pieces > 0 && qty > 0 ? Math.max(1, Math.round(pieces / qty)) : 1;
  const unit = (optStr(body.unit, 20) ?? 'box').toLowerCase();
  const total = body.total !== undefined ? toPaise(body.total, 'total') : null;
  const p = await c.env.DB.prepare(`INSERT INTO products (company_id, name, unit, pieces_per_unit, default_unit_cost_paise) VALUES (?, ?, ?, ?, ?) RETURNING id, pieces_per_unit, unit`)
    .bind(cid, name, unit, ppu, total !== null && qty > 0 ? Math.round(total / qty) : null).first<any>();
  await audit(c, 'create', 'product', p.id, null, { name, unit, pieces_per_unit: ppu });
  return p;
}
async function categoryFor(c: C, body: any): Promise<number> {
  const cid = c.get('companyId');
  if (body.category_id) {
    const r = await c.env.DB.prepare('SELECT id FROM expense_categories WHERE id = ? AND company_id = ?').bind(Number(body.category_id), cid).first<number>('id');
    if (!r) fail(422, 'Unknown expense category');
    return r;
  }
  const name = reqStr(body.category, 'category', 60);
  const r = await c.env.DB.prepare('INSERT INTO expense_categories (company_id, name) VALUES (?, ?) ON CONFLICT (company_id, name) DO UPDATE SET name = name RETURNING id').bind(cid, name).first<number>('id');
  return r!;
}
async function docFor(c: C, v: unknown): Promise<number | null> {
  if (v === null || v === undefined || v === '') return null;
  const r = await c.env.DB.prepare('SELECT id FROM documents WHERE id = ? AND company_id = ?').bind(Number(v), c.get('companyId')).first<number>('id');
  if (!r) fail(422, 'Unknown document');
  return r;
}

type Normalizer = (c: C, body: any) => Promise<Record<string, unknown>>;
interface EntryCfg { table: string; entity: string; normalize: Normalizer; list: string }
const ENTRY: Record<string, EntryCfg> = {
  purchases: {
    table: 'purchases', entity: 'purchase',
    list: `SELECT e.*, p.name AS product_name, ROUND(e.total_cost_paise * 1.0 / NULLIF(e.pieces, 0), 2) AS cost_per_piece_paise, u.name AS created_by_name
             FROM purchases e JOIN products p ON p.id = e.product_id LEFT JOIN users u ON u.id = e.created_by`,
    normalize: async (c, b) => {
      const p = await productFor(c, b);
      const qty = reqNum(b.qty ?? 1, 'quantity', { min: 0.001, max: 1e6 });
      const pieces = b.pieces === null || b.pieces === undefined || b.pieces === '' ? Math.round(qty * p.pieces_per_unit) : reqNum(b.pieces, 'pieces', { min: 0, max: 1e7, int: true });
      return {
        entry_date: reqDate(b.date), product_id: p.id, qty_units: qty, unit: (optStr(b.unit, 20) ?? p.unit).toLowerCase(), pieces,
        total_cost_paise: toPaise(b.total, 'total cost'), payment_mode: oneOf(b.payment_mode, PAY_MODES, 'payment mode', 'cash'),
        supplier: optStr(b.supplier, 80), notes: optStr(b.notes, 500), document_id: await docFor(c, b.document_id),
      };
    },
  },
  expenses: {
    table: 'expenses', entity: 'expense',
    list: `SELECT e.*, k.name AS category, u.name AS created_by_name FROM expenses e JOIN expense_categories k ON k.id = e.category_id LEFT JOIN users u ON u.id = e.created_by`,
    normalize: async (c, b) => ({
      entry_date: reqDate(b.date), category_id: await categoryFor(c, b), amount_paise: toPaise(b.amount, 'amount', { allowZero: false }),
      payment_mode: oneOf(b.payment_mode, PAY_MODES, 'payment mode', 'cash'), notes: optStr(b.notes, 500), document_id: await docFor(c, b.document_id),
    }),
  },
  collections: {
    table: 'collections', entity: 'collection',
    list: `SELECT e.*, u.name AS created_by_name FROM collections e LEFT JOIN users u ON u.id = e.created_by`,
    normalize: async (c, b) => ({
      entry_date: reqDate(b.date), amount_paise: toPaise(b.amount, 'amount', { allowZero: false }), mode: oneOf(b.mode, COLLECTION_MODES, 'mode', 'cash'),
      customer: optStr(b.customer, 80), notes: optStr(b.notes, 500), document_id: await docFor(c, b.document_id),
    }),
  },
  payments: {
    table: 'payments', entity: 'payment',
    list: `SELECT e.*, u.name AS created_by_name FROM payments e LEFT JOIN users u ON u.id = e.created_by`,
    normalize: async (c, b) => ({
      entry_date: reqDate(b.date), direction: oneOf(b.direction, ['to_supplier', 'from_customer'] as const, 'direction'), party: optStr(b.party, 80),
      amount_paise: toPaise(b.amount, 'amount', { allowZero: false }), mode: oneOf(b.mode, PAYMENT_MODES, 'mode', 'cash'), notes: optStr(b.notes, 500),
    }),
  },
};

for (const [path, cfg] of Object.entries(ENTRY)) {
  co.get(`/${path}`, perm('entries.view'), async (c) => {
    const { from, to } = range(c);
    const r = await c.env.DB.prepare(`${cfg.list} WHERE e.company_id = ? AND e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date DESC, e.id DESC LIMIT 2000`)
      .bind(c.get('companyId'), from, to).all();
    return c.json(r.results);
  });
  co.post(`/${path}`, perm('entries.write'), async (c) => {
    const rec = await cfg.normalize(c, await c.req.json());
    const keys = Object.keys(rec);
    const r = await c.env.DB.prepare(`INSERT INTO ${cfg.table} (company_id, created_by, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')}) RETURNING *`)
      .bind(c.get('companyId'), c.get('user').id, ...Object.values(rec)).first();
    await audit(c, 'create', cfg.entity, (r as any).id, null, r);
    return c.json(r, 201);
  });
  co.put(`/${path}/:id`, perm('entries.write'), async (c) => {
    const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
    const before = await c.env.DB.prepare(`SELECT * FROM ${cfg.table} WHERE id = ? AND company_id = ?`).bind(id, cid).first();
    if (!before) fail(404, 'Entry not found');
    const rec = await cfg.normalize(c, await c.req.json());
    const r = await c.env.DB.prepare(`UPDATE ${cfg.table} SET ${Object.keys(rec).map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND company_id = ? RETURNING *`)
      .bind(...Object.values(rec), id, cid).first();
    await audit(c, 'update', cfg.entity, id, before, r);
    return c.json(r);
  });
  co.delete(`/${path}/:id`, perm('entries.delete'), async (c) => {
    const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
    const before = await c.env.DB.prepare(`DELETE FROM ${cfg.table} WHERE id = ? AND company_id = ? RETURNING *`).bind(id, cid).first();
    if (!before) fail(404, 'Entry not found');
    await audit(c, 'delete', cfg.entity, id, before, null);
    return c.json({ deleted: true });
  });
}

// ---------- day view ----------
co.get('/day/:date', perm('entries.view'), async (c) => {
  const cid = c.get('companyId'); const date = reqDate(c.req.param('date'));
  const db = c.env.DB;
  const [purchases, expenses, collections, payments, counts, closing] = await db.batch([
    db.prepare(`${ENTRY.purchases.list} WHERE e.company_id = ? AND e.entry_date = ? ORDER BY e.id`).bind(cid, date),
    db.prepare(`${ENTRY.expenses.list} WHERE e.company_id = ? AND e.entry_date = ? ORDER BY e.id`).bind(cid, date),
    db.prepare(`${ENTRY.collections.list} WHERE e.company_id = ? AND e.entry_date = ? ORDER BY e.id`).bind(cid, date),
    db.prepare(`${ENTRY.payments.list} WHERE e.company_id = ? AND e.entry_date = ? ORDER BY e.id`).bind(cid, date),
    db.prepare(`SELECT product_id, closing_pieces FROM stock_counts WHERE company_id = ? AND entry_date = ?`).bind(cid, date),
    db.prepare(`SELECT * FROM day_closings WHERE company_id = ? AND entry_date = ?`).bind(cid, date),
  ]);
  const showReport = c.get('user').permissions.includes('reports.view');
  const rep = await loadReport(db, cid, date, date, true);
  const day = rep.days[0];
  if (!showReport) { (day as any).profit = null; }
  return c.json({
    date, purchases: purchases.results, expenses: expenses.results, collections: collections.results, payments: payments.results,
    stock_counts: counts.results, closing: closing.results[0] ?? null, report: day,
  });
});

co.put('/day/:date/stock', perm('entries.write'), async (c) => {
  const cid = c.get('companyId'); const date = reqDate(c.req.param('date'));
  const body = await c.req.json();
  if (!Array.isArray(body.counts)) fail(422, 'counts must be a list');
  const stmts: D1PreparedStatement[] = [];
  const valid = new Set((await c.env.DB.prepare('SELECT id FROM products WHERE company_id = ?').bind(cid).all<{ id: number }>()).results.map((r) => r.id));
  for (const row of body.counts.slice(0, 2000)) {
    const pid = Number(row.product_id);
    if (!valid.has(pid)) fail(422, 'Unknown product in stock count');
    if (row.closing_pieces === null || row.closing_pieces === '' || row.closing_pieces === undefined) {
      stmts.push(c.env.DB.prepare('DELETE FROM stock_counts WHERE company_id = ? AND entry_date = ? AND product_id = ?').bind(cid, date, pid));
    } else {
      const n = reqNum(row.closing_pieces, 'closing pieces', { min: 0, max: 1e7, int: true });
      stmts.push(c.env.DB.prepare(`INSERT INTO stock_counts (company_id, entry_date, product_id, closing_pieces, created_by) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (company_id, entry_date, product_id) DO UPDATE SET closing_pieces = excluded.closing_pieces, created_by = excluded.created_by, updated_at = datetime('now')`)
        .bind(cid, date, pid, n, c.get('user').id));
    }
  }
  const before = await c.env.DB.prepare('SELECT product_id, closing_pieces FROM stock_counts WHERE company_id = ? AND entry_date = ?').bind(cid, date).all();
  if (stmts.length) await c.env.DB.batch(stmts);
  await audit(c, 'update', 'stock_count', null, { date, counts: before.results }, { date, counts: body.counts });
  return c.json({ ok: true });
});

co.put('/day/:date/closing', perm('cash.close'), async (c) => {
  const cid = c.get('companyId'); const date = reqDate(c.req.param('date'));
  const b = await c.req.json();
  const opening = optPaise(b.opening_cash, 'opening cash');
  const counted = toPaise(b.counted_cash, 'counted cash');
  const before = await c.env.DB.prepare('SELECT * FROM day_closings WHERE company_id = ? AND entry_date = ?').bind(cid, date).first();
  const r = await c.env.DB.prepare(`INSERT INTO day_closings (company_id, entry_date, opening_cash_paise, counted_cash_paise, notes, closed_by) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (company_id, entry_date) DO UPDATE SET opening_cash_paise = excluded.opening_cash_paise, counted_cash_paise = excluded.counted_cash_paise,
      notes = excluded.notes, closed_by = excluded.closed_by, updated_at = datetime('now') RETURNING *`)
    .bind(cid, date, opening, counted, optStr(b.notes, 500), c.get('user').id).first();
  await audit(c, before ? 'update' : 'create', 'day_closing', (r as any).id, before, r);
  return c.json(r);
});
co.delete('/day/:date/closing', perm('cash.close', 'entries.delete'), async (c) => {
  const cid = c.get('companyId'); const date = reqDate(c.req.param('date'));
  const before = await c.env.DB.prepare('DELETE FROM day_closings WHERE company_id = ? AND entry_date = ? RETURNING *').bind(cid, date).first();
  if (before) await audit(c, 'delete', 'day_closing', (before as any).id, before, null);
  return c.json({ ok: true });
});

// ---------- natural text parsing & bulk save ----------
async function parseCtx(c: C, date?: string) {
  const cid = c.get('companyId');
  const [p, k] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT id, name, pieces_per_unit FROM products WHERE company_id = ? AND active = 1').bind(cid),
    c.env.DB.prepare('SELECT name FROM expense_categories WHERE company_id = ?').bind(cid),
  ]);
  return { defaultYear: Number((date && isDate(date) ? date : todayIST()).slice(0, 4)), products: p.results as any[], categories: (k.results as any[]).map((r) => r.name) };
}
co.post('/parse', perm('entries.write'), async (c) => {
  const b = await c.req.json();
  const text = String(b.text ?? '').slice(0, 20000);
  return c.json(parseText(text, await parseCtx(c, b.date)));
});

co.post('/bulk', perm('entries.write'), async (c) => {
  const b = await c.req.json();
  const date = reqDate(b.date);
  const cid = c.get('companyId'); const uid = c.get('user').id;
  const documentId = await docFor(c, b.document_id);
  const purchases = Array.isArray(b.purchases) ? b.purchases.slice(0, 300) : [];
  const expenses = Array.isArray(b.expenses) ? b.expenses.slice(0, 300) : [];
  const collections = Array.isArray(b.collections) ? b.collections.slice(0, 300) : [];
  if (!purchases.length && !expenses.length && !collections.length) fail(422, 'Nothing to save');
  // validate everything first so a bad row doesn't leave a half-saved day
  const recs: { cfg: EntryCfg; rec: Record<string, unknown> }[] = [];
  for (const row of purchases) recs.push({ cfg: ENTRY.purchases, rec: await ENTRY.purchases.normalize(c, { ...row, date, document_id: documentId }) });
  for (const row of expenses) recs.push({ cfg: ENTRY.expenses, rec: await ENTRY.expenses.normalize(c, { ...row, date, document_id: documentId }) });
  for (const row of collections) recs.push({ cfg: ENTRY.collections, rec: await ENTRY.collections.normalize(c, { ...row, date, document_id: documentId }) });
  const stmts = recs.map(({ cfg, rec }) => {
    const keys = Object.keys(rec);
    return c.env.DB.prepare(`INSERT INTO ${cfg.table} (company_id, created_by, ${keys.join(', ')}) VALUES (?, ?, ${keys.map(() => '?').join(', ')}) RETURNING id`)
      .bind(cid, uid, ...Object.values(rec));
  });
  if (documentId) stmts.push(c.env.DB.prepare(`UPDATE documents SET ocr_status = 'confirmed', entry_date = ? WHERE id = ? AND company_id = ?`).bind(date, documentId, cid));
  const res = await c.env.DB.batch(stmts);
  await audit(c, 'bulk_create', 'entries', documentId, null, { date, document_id: documentId, purchases: purchases.length, expenses: expenses.length, collections: collections.length,
    ids: res.slice(0, recs.length).map((r) => (r.results[0] as any)?.id) });
  return c.json({ created: recs.length }, 201);
});

// ---------- reports ----------
function bucketKey(date: string, group: string) {
  if (group === 'month') return date.slice(0, 7);
  if (group === 'week') { const d = new Date(date + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; return addDays(date, -dow); }
  return date;
}
co.get('/reports/summary', perm('reports.view'), async (c) => {
  const { from, to } = range(c);
  const group = oneOf(c.req.query('group'), ['day', 'week', 'month'] as const, 'group', 'day');
  const rep = await loadReport(c.env.DB, c.get('companyId'), from, to);
  const buckets = new Map<string, any>();
  for (const d of rep.days) {
    const k = bucketKey(d.date, group);
    const b = buckets.get(k) ?? { period: k, purchases: 0, expenses: 0, collections: 0, net_cash_flow: 0, profit_net: 0, profit_days: 0, active_days: 0,
      purchased_pieces: 0, sold_pieces: 0, cash_difference: 0, stock_value: 0, payable: 0, receivable: 0 };
    b.purchases += d.purchases.total; b.expenses += d.expenses.total; b.collections += d.collections.total; b.net_cash_flow += d.net_cash_flow;
    b.purchased_pieces += d.stock.purchased_pieces; b.sold_pieces += d.stock.sold_pieces_known; b.cash_difference += d.cash.difference ?? 0;
    if (d.profit.status !== 'no_activity') b.active_days++;
    if (d.profit.status === 'actual') { b.profit_net += d.profit.net ?? 0; b.profit_days++; }
    b.stock_value = d.stock.stock_value; b.payable = d.outstanding.payable; b.receivable = d.outstanding.receivable;
    buckets.set(k, b);
  }
  const cats = await c.env.DB.prepare(`SELECT k.name AS category, SUM(e.amount_paise) AS amount FROM expenses e JOIN expense_categories k ON k.id = e.category_id
    WHERE e.company_id = ? AND e.entry_date BETWEEN ? AND ? GROUP BY k.name ORDER BY amount DESC`).bind(c.get('companyId'), from, to).all();
  const discrepancies = rep.days.flatMap((d) => d.discrepancies.filter((x) => x.severity !== 'info').map((x) => ({ date: d.date, ...x })));
  return c.json({ totals: rep.totals, series: [...buckets.values()], expenses_by_category: cats.results, discrepancies: discrepancies.slice(-100) });
});

co.get('/reports/day/:date', perm('reports.view'), async (c) => {
  const date = reqDate(c.req.param('date'));
  const rep = await loadReport(c.env.DB, c.get('companyId'), date, date, true);
  return c.json(rep.days[0]);
});

co.get('/reports/compare', perm('reports.view'), async (c) => {
  const q = (k: string) => reqDate(c.req.query(k), k);
  const a = { from: q('a_from'), to: q('a_to') }; const b = { from: q('b_from'), to: q('b_to') };
  for (const r of [a, b]) if (r.from > r.to || daysBetween(r.from, r.to) > MAX_RANGE_DAYS) fail(422, 'Invalid comparison range');
  const [ra, rb] = await Promise.all([loadReport(c.env.DB, c.get('companyId'), a.from, a.to), loadReport(c.env.DB, c.get('companyId'), b.from, b.to)]);
  return c.json({ a: ra.totals, b: rb.totals });
});

co.get('/reports/outstanding', perm('reports.view'), async (c) => {
  const cid = c.get('companyId');
  const [sup, cus] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT party, SUM(owed) AS owed, SUM(paid) AS paid, SUM(owed) - SUM(paid) AS balance FROM (
        SELECT COALESCE(NULLIF(supplier, ''), 'Unnamed supplier') AS party, total_cost_paise AS owed, 0 AS paid FROM purchases WHERE company_id = ?1 AND payment_mode = 'credit'
        UNION ALL SELECT COALESCE(NULLIF(party, ''), 'Unnamed supplier'), 0, amount_paise FROM payments WHERE company_id = ?1 AND direction = 'to_supplier'
        UNION ALL SELECT 'Expenses on credit', amount_paise, 0 FROM expenses WHERE company_id = ?1 AND payment_mode = 'credit'
      ) GROUP BY party HAVING balance <> 0 ORDER BY balance DESC`).bind(cid),
    c.env.DB.prepare(`SELECT party, SUM(owed) AS owed, SUM(paid) AS paid, SUM(owed) - SUM(paid) AS balance FROM (
        SELECT COALESCE(NULLIF(customer, ''), 'Unnamed customer') AS party, amount_paise AS owed, 0 AS paid FROM collections WHERE company_id = ?1 AND mode = 'credit'
        UNION ALL SELECT COALESCE(NULLIF(party, ''), 'Unnamed customer'), 0, amount_paise FROM payments WHERE company_id = ?1 AND direction = 'from_customer'
      ) GROUP BY party HAVING balance <> 0 ORDER BY balance DESC`).bind(cid),
  ]);
  return c.json({ payable: sup.results, receivable: cus.results });
});

// ---------- export ----------
const r2 = (p: unknown) => (typeof p === 'number' ? p / 100 : null);
co.get('/export', perm('export'), async (c) => {
  const { from, to } = range(c);
  const format = oneOf(c.req.query('format'), ['csv', 'xlsx'] as const, 'format', 'xlsx');
  const type = oneOf(c.req.query('type'), ['all', 'summary', 'purchases', 'expenses', 'collections', 'payments', 'stock'] as const, 'type', 'all');
  const cid = c.get('companyId'); const db = c.env.DB;
  const sheets: { name: string; rows: Cell[][] }[] = [];
  const want = (t: string) => type === 'all' || type === t;
  const rep = want('summary') || want('stock') ? await loadReport(db, cid, from, to, want('stock')) : null;
  if (rep && want('summary')) {
    sheets.push({ name: 'Daily Summary', rows: [
      ['Date', 'Purchases', 'Expenses', 'Collections', 'Credit sales', 'Net cash flow', 'Expected cash', 'Counted cash', 'Cash difference', 'Pieces bought', 'Pieces sold', 'Profit status', 'COGS', 'Net profit', 'Payable', 'Receivable'],
      ...rep.days.map((d) => [d.date, r2(d.purchases.total), r2(d.expenses.total), r2(d.collections.total), r2(d.collections.credit), r2(d.net_cash_flow), r2(d.cash.expected), r2(d.cash.counted), r2(d.cash.difference),
        d.stock.purchased_pieces, d.stock.sold_pieces, d.profit.status, r2(d.profit.cogs), r2(d.profit.net), r2(d.outstanding.payable), r2(d.outstanding.receivable)]),
      ['TOTAL', r2(rep.totals.purchases), r2(rep.totals.expenses), r2(rep.totals.collections), r2(rep.totals.credit_sales), r2(rep.totals.net_cash_flow), null, null, r2(rep.totals.cash_difference_total),
        rep.totals.purchased_pieces, rep.totals.sold_pieces_known, rep.totals.profit.status, r2(rep.totals.profit.cogs), r2(rep.totals.profit.net), r2(rep.totals.outstanding.payable), r2(rep.totals.outstanding.receivable)],
    ] });
  }
  if (want('purchases')) {
    const r = await db.prepare(`${ENTRY.purchases.list} WHERE e.company_id = ? AND e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date, e.id`).bind(cid, from, to).all<any>();
    sheets.push({ name: 'Purchases', rows: [['Date', 'Item', 'Qty', 'Unit', 'Pieces', 'Total cost', 'Cost per piece', 'Payment', 'Supplier', 'Notes', 'Entered by'],
      ...r.results.map((x) => [x.entry_date, x.product_name, x.qty_units, x.unit, x.pieces, r2(x.total_cost_paise), r2(x.cost_per_piece_paise), x.payment_mode, x.supplier, x.notes, x.created_by_name])] });
  }
  if (want('expenses')) {
    const r = await db.prepare(`${ENTRY.expenses.list} WHERE e.company_id = ? AND e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date, e.id`).bind(cid, from, to).all<any>();
    sheets.push({ name: 'Expenses', rows: [['Date', 'Category', 'Amount', 'Payment', 'Notes', 'Entered by'],
      ...r.results.map((x) => [x.entry_date, x.category, r2(x.amount_paise), x.payment_mode, x.notes, x.created_by_name])] });
  }
  if (want('collections')) {
    const r = await db.prepare(`${ENTRY.collections.list} WHERE e.company_id = ? AND e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date, e.id`).bind(cid, from, to).all<any>();
    sheets.push({ name: 'Collections', rows: [['Date', 'Amount', 'Mode', 'Customer', 'Notes', 'Entered by'],
      ...r.results.map((x) => [x.entry_date, r2(x.amount_paise), x.mode, x.customer, x.notes, x.created_by_name])] });
  }
  if (want('payments')) {
    const r = await db.prepare(`${ENTRY.payments.list} WHERE e.company_id = ? AND e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date, e.id`).bind(cid, from, to).all<any>();
    sheets.push({ name: 'Payments', rows: [['Date', 'Direction', 'Party', 'Amount', 'Mode', 'Notes'],
      ...r.results.map((x) => [x.entry_date, x.direction === 'to_supplier' ? 'Paid to supplier' : 'Received from customer', x.party, r2(x.amount_paise), x.mode, x.notes])] });
  }
  if (rep && want('stock')) {
    sheets.push({ name: 'Stock Movement', rows: [['Date', 'Item', 'Opening', 'Purchased', 'Sold', 'Closing', 'Counted', 'Avg cost/pc', 'COGS', 'Stock value'],
      ...rep.days.flatMap((d) => (d.products ?? []).map((p) => [d.date, p.name, p.opening, p.purchased, p.sold, p.closing, p.counted ? 'yes' : 'expected', r2(p.avg_cost_per_piece), r2(p.cogs), r2(p.stock_value)]))] });
  }
  await audit(c, 'export', 'report', null, null, { from, to, format, type });
  const base = `${c.get('company').name.replace(/[^a-z0-9]+/gi, '_')}_${type}_${from}_to_${to}`;
  if (format === 'csv') {
    const rows: Cell[][] = sheets.length === 1 ? sheets[0].rows : sheets.flatMap((s) => [[`# ${s.name}`], ...s.rows, []]);
    return new Response(buildCsv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${base}.csv"` } });
  }
  return new Response(buildXlsx(sheets), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${base}.xlsx"` } });
});

// ---------- documents (photos of hisaab, bills, receipts) ----------
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_UPLOAD = 10 * 1024 * 1024;

co.get('/documents', perm('entries.view'), async (c) => {
  const r = await c.env.DB.prepare(`SELECT d.id, d.filename, d.content_type, d.size_bytes, d.kind, d.entry_date, d.ocr_status, d.ocr_error, d.created_at, u.name AS uploaded_by_name
    FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.company_id = ? ORDER BY d.created_at DESC LIMIT 300`).bind(c.get('companyId')).all();
  return c.json(r.results);
});
co.post('/documents', perm('uploads.write'), async (c) => {
  const cid = c.get('companyId');
  const form = await c.req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') fail(422, 'No file uploaded');
  const f = file as File;
  if (!ALLOWED_TYPES.includes(f.type)) fail(422, 'Only JPG, PNG, WEBP, GIF images or PDF files are allowed');
  if (f.size > MAX_UPLOAD) fail(413, 'File is larger than 10 MB');
  const limits = await planLimits(c);
  const used = await c.env.DB.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS s FROM documents WHERE company_id = ?').bind(cid).first<number>('s');
  if ((used ?? 0) + f.size > limits.max_storage_mb * 1024 * 1024) fail(403, `Storage limit of ${limits.max_storage_mb} MB reached for your plan`);
  const kind = oneOf(form.get('kind') || 'hisaab', ['hisaab', 'bill', 'receipt', 'other'] as const, 'kind');
  const dateRaw = form.get('date');
  const date = dateRaw && isDate(dateRaw) ? (dateRaw as string) : null;
  const key = `companies/${cid}/docs/${crypto.randomUUID()}`;
  await c.env.FILES.put(key, f.stream(), { httpMetadata: { contentType: f.type }, customMetadata: { company: String(cid), name: f.name.slice(0, 200) } });
  const r = await c.env.DB.prepare(`INSERT INTO documents (company_id, r2_key, filename, content_type, size_bytes, kind, entry_date, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, filename, content_type, size_bytes, kind, entry_date, ocr_status, created_at`)
    .bind(cid, key, f.name.slice(0, 200) || 'upload', f.type, f.size, kind, date, c.get('user').id).first();
  await audit(c, 'upload', 'document', (r as any).id, null, r);
  return c.json(r, 201);
});
co.get('/documents/:id/file', perm('entries.view'), async (c) => {
  const d = await c.env.DB.prepare('SELECT r2_key, content_type, filename FROM documents WHERE id = ? AND company_id = ?').bind(idParam(c.req.param('id')), c.get('companyId')).first<any>();
  if (!d) fail(404, 'Document not found');
  const obj = await c.env.FILES.get(d.r2_key);
  if (!obj) fail(404, 'File missing');
  return new Response(obj.body, { headers: {
    'content-type': d.content_type, 'cache-control': 'private, max-age=300', 'x-content-type-options': 'nosniff',
    'content-disposition': `inline; filename="${String(d.filename).replace(/[^\w.\- ]/g, '_')}"`, 'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  } });
});
co.get('/documents/:id', perm('entries.view'), async (c) => {
  const d = await c.env.DB.prepare(`SELECT id, filename, content_type, size_bytes, kind, entry_date, ocr_status, ocr_result, ocr_error, created_at FROM documents WHERE id = ? AND company_id = ?`)
    .bind(idParam(c.req.param('id')), c.get('companyId')).first<any>();
  if (!d) fail(404, 'Document not found');
  const linked = await c.env.DB.prepare(`SELECT 'purchase' AS type, COUNT(*) AS n FROM purchases WHERE document_id = ?1 AND company_id = ?2
    UNION ALL SELECT 'expense', COUNT(*) FROM expenses WHERE document_id = ?1 AND company_id = ?2 UNION ALL SELECT 'collection', COUNT(*) FROM collections WHERE document_id = ?1 AND company_id = ?2`)
    .bind(d.id, c.get('companyId')).all();
  return c.json({ ...d, ocr_result: d.ocr_result ? JSON.parse(d.ocr_result) : null, linked: linked.results });
});
co.post('/documents/:id/extract', perm('uploads.write', 'entries.write'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  const limits = await planLimits(c);
  if (!limits.ocr_enabled) fail(403, 'Photo reading (OCR) is not included in your plan');
  const d = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ? AND company_id = ?').bind(id, cid).first<any>();
  if (!d) fail(404, 'Document not found');
  if (!d.content_type.startsWith('image/')) fail(422, 'Automatic reading works on photos (JPG/PNG/WEBP). For PDFs, enter the data manually.');
  const obj = await c.env.FILES.get(d.r2_key);
  if (!obj) fail(404, 'File missing');
  await c.env.DB.prepare(`UPDATE documents SET ocr_status = 'processing', ocr_error = NULL WHERE id = ?`).bind(id).run();
  try {
    const out = await extractFromImage(c.env, await obj.arrayBuffer(), d.content_type, await parseCtx(c, d.entry_date ?? undefined));
    // attach product ids for matched names
    const ctx = await parseCtx(c);
    for (const p of out.result.purchases) {
      const m = ctx.products.find((x) => x.name.toLowerCase() === p.item.toLowerCase());
      p.product_id = m?.id ?? null;
      if (p.pieces == null && m) p.pieces = Math.round(p.qty * m.pieces_per_unit);
    }
    await c.env.DB.prepare(`UPDATE documents SET ocr_status = 'extracted', ocr_result = ? WHERE id = ?`).bind(JSON.stringify(out), id).run();
    await audit(c, 'ocr', 'document', id, null, { engine: out.engine });
    return c.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await c.env.DB.prepare(`UPDATE documents SET ocr_status = 'failed', ocr_error = ? WHERE id = ?`).bind(msg.slice(0, 500), id).run();
    fail(422, `Could not read the photo: ${msg.slice(0, 200)}`);
  }
});
co.delete('/documents/:id', perm('uploads.write', 'entries.delete'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  const d = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ? AND company_id = ?').bind(id, cid).first<any>();
  if (!d) fail(404, 'Document not found');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE purchases SET document_id = NULL WHERE document_id = ? AND company_id = ?').bind(id, cid),
    c.env.DB.prepare('UPDATE expenses SET document_id = NULL WHERE document_id = ? AND company_id = ?').bind(id, cid),
    c.env.DB.prepare('UPDATE collections SET document_id = NULL WHERE document_id = ? AND company_id = ?').bind(id, cid),
    c.env.DB.prepare('DELETE FROM documents WHERE id = ? AND company_id = ?').bind(id, cid),
  ]);
  await c.env.FILES.delete(d.r2_key);
  await audit(c, 'delete', 'document', id, { filename: d.filename, kind: d.kind }, null);
  return c.json({ deleted: true });
});

// ---------- team ----------
const COMPANY_ROLES = ['company_admin', 'manager', 'staff', 'viewer'] as const;
co.get('/team', perm('team.manage'), async (c) => {
  const r = await c.env.DB.prepare(`SELECT id, email, name, role, permissions, status, last_login_at, created_at FROM users WHERE company_id = ? ORDER BY role, name`).bind(c.get('companyId')).all<any>();
  return c.json({
    members: r.results.map((u) => ({ ...u, permissions: effectivePermissions(u.role, u.permissions), custom_permissions: !!u.permissions })),
    all_permissions: PERMISSIONS, role_defaults: ROLE_DEFAULTS,
  });
});
function permList(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) fail(422, 'permissions must be a list');
  return JSON.stringify(v.filter((p) => (PERMISSIONS as readonly string[]).includes(p)));
}
co.post('/team', perm('team.manage'), async (c) => {
  const cid = c.get('companyId'); const b = await c.req.json();
  const limits = await planLimits(c);
  const n = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE company_id = ?').bind(cid).first<number>('n');
  if ((n ?? 0) >= limits.max_users) fail(403, `Your plan allows ${limits.max_users} users`);
  const email = reqStr(b.email, 'email', 120).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(422, 'Invalid email');
  const pwErr = validatePassword(b.password); if (pwErr) fail(422, pwErr);
  const role = oneOf(b.role, COMPANY_ROLES, 'role', 'staff');
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) fail(409, 'This email is already registered');
  const r = await c.env.DB.prepare(`INSERT INTO users (company_id, email, name, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, email, name, role, status`)
    .bind(cid, email, reqStr(b.name, 'name', 80), await hashPassword(b.password), role, role === 'company_admin' ? null : permList(b.permissions)).first();
  await audit(c, 'create', 'user', (r as any).id, null, r);
  return c.json(r, 201);
});
co.put('/team/:id', perm('team.manage'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id')); const b = await c.req.json();
  const before = await c.env.DB.prepare('SELECT id, email, name, role, permissions, status FROM users WHERE id = ? AND company_id = ?').bind(id, cid).first<any>();
  if (!before) fail(404, 'User not found');
  const role = oneOf(b.role ?? before.role, COMPANY_ROLES, 'role');
  const status = oneOf(b.status ?? before.status, ['active', 'disabled'] as const, 'status');
  if (id === c.get('user').id && (role !== before.role || status !== 'active')) fail(422, 'You cannot change your own role or disable yourself');
  if (before.role === 'company_admin' && (role !== 'company_admin' || status !== 'active')) {
    const admins = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'company_admin' AND status = 'active'`).bind(cid).first<number>('n');
    if ((admins ?? 0) <= 1) fail(422, 'A company must keep at least one active admin');
  }
  const permissions = role === 'company_admin' ? null : (b.permissions !== undefined ? permList(b.permissions) : before.permissions);
  const stmts = [c.env.DB.prepare('UPDATE users SET name = ?, role = ?, status = ?, permissions = ? WHERE id = ? AND company_id = ?')
    .bind(b.name ? reqStr(b.name, 'name', 80) : before.name, role, status, permissions, id, cid)];
  if (b.password) {
    const pwErr = validatePassword(b.password); if (pwErr) fail(422, pwErr);
    stmts.push(c.env.DB.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ? AND company_id = ?').bind(await hashPassword(b.password), id, cid));
  }
  if (b.password || status === 'disabled' || role !== before.role) stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  await c.env.DB.batch(stmts);
  await audit(c, 'update', 'user', id, before, { role, status, permissions, password_reset: !!b.password });
  return c.json({ ok: true });
});
co.delete('/team/:id', perm('team.manage'), async (c) => {
  const cid = c.get('companyId'); const id = idParam(c.req.param('id'));
  if (id === c.get('user').id) fail(422, 'You cannot delete yourself');
  const before = await c.env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ? AND company_id = ?').bind(id, cid).first<any>();
  if (!before) fail(404, 'User not found');
  if (before.role === 'company_admin') {
    const admins = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'company_admin' AND status = 'active'`).bind(cid).first<number>('n');
    if ((admins ?? 0) <= 1) fail(422, 'A company must keep at least one active admin');
  }
  await c.env.DB.prepare('DELETE FROM users WHERE id = ? AND company_id = ?').bind(id, cid).run();
  await audit(c, 'delete', 'user', id, before, null);
  return c.json({ deleted: true });
});

// ---------- settings / branding ----------
co.put('/settings', perm('settings.manage'), async (c) => {
  const cid = c.get('companyId'); const b = await c.req.json();
  const before = await c.env.DB.prepare('SELECT name, primary_color, accent_color, business_type, address, phone, email, gstin FROM companies WHERE id = ?').bind(cid).first();
  if (b.primary_color && !isColor(b.primary_color)) fail(422, 'Primary colour must be a hex value like #0f766e');
  if (b.accent_color && !isColor(b.accent_color)) fail(422, 'Accent colour must be a hex value like #f59e0b');
  const after = {
    name: reqStr(b.name, 'company name', 100), primary_color: b.primary_color || '#0f766e', accent_color: b.accent_color || '#f59e0b',
    business_type: optStr(b.business_type, 80), address: optStr(b.address, 300), phone: optStr(b.phone, 40), email: optStr(b.email, 120), gstin: optStr(b.gstin, 20),
  };
  await c.env.DB.prepare(`UPDATE companies SET name=?, primary_color=?, accent_color=?, business_type=?, address=?, phone=?, email=?, gstin=?, updated_at=datetime('now') WHERE id = ?`)
    .bind(after.name, after.primary_color, after.accent_color, after.business_type, after.address, after.phone, after.email, after.gstin, cid).run();
  await audit(c, 'update', 'company_settings', cid, before, after);
  return c.json({ ok: true });
});
co.post('/settings/logo', perm('settings.manage'), async (c) => {
  const cid = c.get('companyId');
  const form = await c.req.formData(); const f = form.get('file') as File | null;
  if (!f || typeof f === 'string') fail(422, 'No file uploaded');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) fail(422, 'Logo must be PNG, JPG or WEBP');
  if (f.size > 1024 * 1024) fail(413, 'Logo must be under 1 MB');
  const key = `companies/${cid}/logo`;
  await c.env.FILES.put(key, f.stream(), { httpMetadata: { contentType: f.type } });
  await c.env.DB.prepare(`UPDATE companies SET logo_key = ?, updated_at = datetime('now') WHERE id = ?`).bind(key, cid).run();
  await audit(c, 'update', 'company_logo', cid);
  return c.json({ ok: true });
});
co.delete('/settings/logo', perm('settings.manage'), async (c) => {
  const cid = c.get('companyId');
  await c.env.FILES.delete(`companies/${cid}/logo`);
  await c.env.DB.prepare(`UPDATE companies SET logo_key = NULL, updated_at = datetime('now') WHERE id = ?`).bind(cid).run();
  await audit(c, 'delete', 'company_logo', cid);
  return c.json({ ok: true });
});
co.get('/logo', async (c) => {
  const key = await c.env.DB.prepare('SELECT logo_key FROM companies WHERE id = ?').bind(c.get('companyId')).first<string>('logo_key');
  const obj = key ? await c.env.FILES.get(key) : null;
  if (!obj) fail(404, 'No logo');
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'image/png', 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' } });
});

// ---------- audit ----------
co.get('/audit', perm('audit.view'), async (c) => {
  const before = Number(c.req.query('before')) || 2 ** 52;
  const r = await c.env.DB.prepare(`SELECT id, user_name, action, entity, entity_id, before_json, after_json, ip, created_at FROM audit_logs WHERE company_id = ? AND id < ? ORDER BY id DESC LIMIT 100`)
    .bind(c.get('companyId'), before).all();
  return c.json(r.results);
});

export default co;
