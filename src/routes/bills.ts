// Customer bills: idempotent create (by client_id), search, get, void, and atomic number-block reservation.
import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { perm } from '../middleware';
import { audit } from '../lib/audit';
import { fail, optStr, todayIST } from '../lib/util';
import { normalizeBill, reserveCount } from '../lib/bills';

const bills = new Hono<AppEnv>();
const CLIENT_ID_RE = /^[\w-]{8,64}$/;

/** Hands out `n` consecutive numbers in one atomic statement; returns the first. */
async function takeNumbers(db: D1Database, cid: number, series: string, n: number, after = 0): Promise<number> {
  // `after`: numbers at or below it are already used on a phone (bills made before shared numbering existed)
  const r = await db.prepare(`INSERT INTO bill_counters (company_id, series, next_no) VALUES (?1, ?2, ?4 + 1 + ?3)
    ON CONFLICT (company_id, series) DO UPDATE SET next_no = MAX(next_no, ?4 + 1) + ?3 RETURNING next_no`).bind(cid, series, n, after).first<{ next_no: number }>();
  return (r?.next_no ?? n + 1) - n;
}

bills.post('/reserve', perm('entries.write'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const n = reserveCount(body?.n);
  const after = Math.min(1e6, Math.max(0, Math.floor(Number(body?.after)) || 0));
  const from = await takeNumbers(c.env.DB, c.get('companyId'), 'A', n, after);
  return c.json({ series: 'A', from, to: from + n - 1, n });
});

bills.post('/', perm('entries.write'), async (c) => {
  const cid = c.get('companyId'); const db = c.env.DB;
  const body = await c.req.json().catch(() => null);
  const clientId = optStr(body?.client_id, 64);
  if (!clientId || !CLIENT_ID_RE.test(clientId)) fail(422, 'client_id is required');
  const existing = () => db.prepare('SELECT * FROM bills WHERE company_id = ? AND client_id = ?').bind(cid, clientId).first();
  const dup = await existing(); if (dup) return c.json(dup, 200);
  const rec = normalizeBill(body, todayIST());
  const insert = (series: string, no: number) => db.prepare(`INSERT INTO bills (company_id, client_id, series, bill_no, customer, phone, items_json, subtotal_paise, discount_paise, total_paise, pay_mode, collection_client_id, entry_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(cid, clientId, series, no, rec.customer, rec.phone, rec.items_json, rec.subtotal_paise, rec.discount_paise, rec.total_paise, rec.pay_mode, rec.collection_client_id, rec.entry_date, c.get('user').id).first();
  let row: any = null;
  let series = rec.series, no = rec.bill_no;
  if (no === null) { series = 'A'; no = await takeNumbers(db, cid, 'A', 1); }
  for (let attempt = 0; attempt < 3 && !row; attempt++) {
    try { row = await insert(series, no!); }
    catch (e) {
      if (!/UNIQUE constraint failed/i.test(String((e as Error).message))) throw e;
      const ex = await existing(); if (ex) return c.json(ex, 200); // a retry that raced us
      // that number is already taken by a different bill: give this one the next free server number instead of failing a sale
      series = 'A'; no = await takeNumbers(db, cid, 'A', 1);
    }
  }
  if (!row) fail(409, 'Could not allocate a bill number, please retry');
  await audit(c, 'create', 'bill', row.id, null, { series: row.series, bill_no: row.bill_no, total_paise: row.total_paise, pay_mode: row.pay_mode });
  return c.json(row, 201);
});

bills.get('/', perm('entries.view'), async (c) => {
  const cid = c.get('companyId');
  const where = ['company_id = ?']; const args: unknown[] = [cid];
  const q = (c.req.query('q') || '').trim().slice(0, 80);
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(`(customer LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR (series || '-' || bill_no) LIKE ? ESCAPE '\\' OR CAST(bill_no AS TEXT) = ?)`);
    args.push(like, like, like, q.replace(/^#/, ''));
  }
  const customer = (c.req.query('customer') || '').trim().slice(0, 80);
  if (customer) { where.push('customer = ? COLLATE NOCASE'); args.push(customer); }
  const from = c.req.query('from'), to = c.req.query('to');
  if (from) { where.push('entry_date >= ?'); args.push(from); }
  if (to) { where.push('entry_date <= ?'); args.push(to); }
  const voided = c.req.query('voided');
  if (voided === '0' || voided === '1') { where.push('voided = ?'); args.push(Number(voided)); }
  const limit = Math.min(200, Math.max(1, Math.floor(Number(c.req.query('limit'))) || 50));
  const offset = Math.max(0, Math.floor(Number(c.req.query('offset'))) || 0);
  const w = where.join(' AND ');
  const [rows, cnt] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT * FROM bills WHERE ${w} ORDER BY entry_date DESC, id DESC LIMIT ? OFFSET ?`).bind(...args, limit, offset),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM bills WHERE ${w}`).bind(...args),
  ]);
  return c.json({ bills: rows.results, total: Number((cnt.results[0] as any)?.n ?? 0), limit, offset });
});

bills.get('/:clientId', perm('entries.view'), async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM bills WHERE company_id = ? AND client_id = ?').bind(c.get('companyId'), c.req.param('clientId')).first();
  if (!r) fail(404, 'Bill not found');
  return c.json(r);
});

// Voiding keeps the bill (numbers are never reused) and removes the sale it created, if that sale still exists.
bills.post('/:clientId/void', perm('entries.delete'), async (c) => {
  const cid = c.get('companyId'); const db = c.env.DB;
  const before = await db.prepare('SELECT * FROM bills WHERE company_id = ? AND client_id = ?').bind(cid, c.req.param('clientId')).first<any>();
  if (!before) fail(404, 'Bill not found');
  if (before.voided) return c.json(before);
  const [row, sale] = await db.batch([
    db.prepare(`UPDATE bills SET voided = 1, updated_at = datetime('now') WHERE id = ? AND company_id = ? RETURNING *`).bind(before.id, cid),
    db.prepare(`DELETE FROM collections WHERE company_id = ? AND client_id = ? AND ? IS NOT NULL RETURNING id`).bind(cid, before.collection_client_id, before.collection_client_id),
  ]);
  const saleId = (sale.results[0] as any)?.id ?? null;
  await audit(c, 'void', 'bill', before.id, { voided: 0 }, { voided: 1, deleted_sale_id: saleId });
  return c.json(row.results[0]);
});

export default bills;
