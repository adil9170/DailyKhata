import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { requireAuth, requireSuper } from '../middleware';
import { audit } from '../lib/audit';
import { fail, reqStr, optStr, reqNum, oneOf, isColor, idParam, slugify, toPaise, todayIST, addDays } from '../lib/util';
import { hashPassword, validatePassword } from '../lib/crypto';
import { backupCompany } from '../lib/backup';
import { PERMISSIONS } from '../lib/permissions';

const admin = new Hono<AppEnv>();
admin.use('*', requireAuth, requireSuper);

admin.get('/overview', async (c) => {
  const since = addDays(todayIST(), -29);
  const [counts, perCompany, recent] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT (SELECT COUNT(*) FROM companies) AS companies, (SELECT COUNT(*) FROM companies WHERE status = 'active') AS active_companies,
      (SELECT COUNT(*) FROM users WHERE role <> 'super_admin') AS users, (SELECT COALESCE(SUM(size_bytes), 0) FROM documents) AS storage_bytes,
      (SELECT COALESCE(SUM(amount_paise), 0) FROM collections WHERE entry_date >= ?1) AS collections_30d,
      (SELECT COALESCE(SUM(total_cost_paise), 0) FROM purchases WHERE entry_date >= ?1) AS purchases_30d,
      (SELECT COUNT(*) FROM audit_logs WHERE created_at >= datetime('now', '-1 day')) AS events_24h`).bind(since),
    c.env.DB.prepare(`SELECT c.id, c.name, c.status, p.name AS plan_name,
      (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users,
      (SELECT COALESCE(SUM(amount_paise), 0) FROM collections x WHERE x.company_id = c.id AND x.entry_date >= ?1) AS collections_30d,
      (SELECT MAX(created_at) FROM audit_logs a WHERE a.company_id = c.id) AS last_activity
      FROM companies c LEFT JOIN plans p ON p.id = c.plan_id ORDER BY collections_30d DESC LIMIT 50`).bind(since),
    c.env.DB.prepare(`SELECT a.id, a.company_id, co.name AS company_name, a.user_name, a.action, a.entity, a.entity_id, a.created_at
      FROM audit_logs a LEFT JOIN companies co ON co.id = a.company_id ORDER BY a.id DESC LIMIT 30`),
  ]);
  return c.json({ stats: counts.results[0], companies: perCompany.results, recent: recent.results });
});

// ---------- plans ----------
admin.get('/plans', async (c) => {
  const r = await c.env.DB.prepare(`SELECT p.*, (SELECT COUNT(*) FROM companies c WHERE c.plan_id = p.id) AS companies FROM plans p ORDER BY price_paise`).all();
  return c.json(r.results);
});
function planFields(b: any) {
  return {
    name: reqStr(b.name, 'name', 40),
    max_users: reqNum(b.max_users, 'max users', { min: 1, max: 100000, int: true }),
    max_products: reqNum(b.max_products, 'max products', { min: 1, max: 1000000, int: true }),
    max_storage_mb: reqNum(b.max_storage_mb, 'max storage', { min: 1, max: 10000000, int: true }),
    ocr_enabled: b.ocr_enabled ? 1 : 0,
    price_paise: toPaise(b.price ?? 0, 'price'),
  };
}
admin.post('/plans', async (c) => {
  const f = planFields(await c.req.json());
  const r = await c.env.DB.prepare(`INSERT INTO plans (name, max_users, max_products, max_storage_mb, ocr_enabled, price_paise) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(f.name, f.max_users, f.max_products, f.max_storage_mb, f.ocr_enabled, f.price_paise).first();
  await audit(c, 'create', 'plan', (r as any).id, null, r, null);
  return c.json(r, 201);
});
admin.put('/plans/:id', async (c) => {
  const id = idParam(c.req.param('id')); const f = planFields(await c.req.json());
  const before = await c.env.DB.prepare('SELECT * FROM plans WHERE id = ?').bind(id).first();
  if (!before) fail(404, 'Plan not found');
  const r = await c.env.DB.prepare(`UPDATE plans SET name=?, max_users=?, max_products=?, max_storage_mb=?, ocr_enabled=?, price_paise=? WHERE id = ? RETURNING *`)
    .bind(f.name, f.max_users, f.max_products, f.max_storage_mb, f.ocr_enabled, f.price_paise, id).first();
  await audit(c, 'update', 'plan', id, before, r, null);
  return c.json(r);
});
admin.delete('/plans/:id', async (c) => {
  const id = idParam(c.req.param('id'));
  if (await c.env.DB.prepare('SELECT 1 FROM companies WHERE plan_id = ?').bind(id).first()) fail(409, 'Plan is in use by companies');
  const before = await c.env.DB.prepare('DELETE FROM plans WHERE id = ? RETURNING *').bind(id).first();
  if (!before) fail(404, 'Plan not found');
  await audit(c, 'delete', 'plan', id, before, null, null);
  return c.json({ deleted: true });
});

// ---------- companies ----------
admin.get('/companies', async (c) => {
  const r = await c.env.DB.prepare(`SELECT c.*, p.name AS plan_name,
      (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id) AS users,
      (SELECT COUNT(*) FROM products x WHERE x.company_id = c.id) AS products,
      (SELECT COALESCE(SUM(size_bytes), 0) FROM documents d WHERE d.company_id = c.id) AS storage_bytes,
      (SELECT MAX(created_at) FROM audit_logs a WHERE a.company_id = c.id) AS last_activity
    FROM companies c LEFT JOIN plans p ON p.id = c.plan_id ORDER BY c.name`).all();
  return c.json(r.results);
});
admin.get('/companies/:id', async (c) => {
  const id = idParam(c.req.param('id'));
  const since = addDays(todayIST(), -29);
  const [company, users, stats, activity] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT c.*, p.name AS plan_name FROM companies c LEFT JOIN plans p ON p.id = c.plan_id WHERE c.id = ?').bind(id),
    c.env.DB.prepare('SELECT id, email, name, role, permissions, status, last_login_at, created_at FROM users WHERE company_id = ? ORDER BY role, name').bind(id),
    c.env.DB.prepare(`SELECT (SELECT COALESCE(SUM(amount_paise), 0) FROM collections WHERE company_id = ?1 AND entry_date >= ?2) AS collections_30d,
        (SELECT COALESCE(SUM(total_cost_paise), 0) FROM purchases WHERE company_id = ?1 AND entry_date >= ?2) AS purchases_30d,
        (SELECT COALESCE(SUM(amount_paise), 0) FROM expenses WHERE company_id = ?1 AND entry_date >= ?2) AS expenses_30d,
        (SELECT COUNT(*) FROM products WHERE company_id = ?1) AS products,
        (SELECT COUNT(*) FROM documents WHERE company_id = ?1) AS documents,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM documents WHERE company_id = ?1) AS storage_bytes,
        (SELECT COUNT(DISTINCT entry_date) FROM collections WHERE company_id = ?1 AND entry_date >= ?2) AS active_days_30d`).bind(id, since),
    c.env.DB.prepare('SELECT id, user_name, action, entity, entity_id, created_at FROM audit_logs WHERE company_id = ? ORDER BY id DESC LIMIT 50').bind(id),
  ]);
  if (!company.results[0]) fail(404, 'Company not found');
  const backups = await c.env.DB.prepare('SELECT id, size_bytes, kind, created_at FROM backups WHERE company_id = ? ORDER BY id DESC LIMIT 20').bind(id).all();
  return c.json({ company: company.results[0], users: users.results, stats: stats.results[0], activity: activity.results, backups: backups.results });
});

function companyFields(b: any) {
  if (b.primary_color && !isColor(b.primary_color)) fail(422, 'Invalid primary colour');
  if (b.accent_color && !isColor(b.accent_color)) fail(422, 'Invalid accent colour');
  return {
    name: reqStr(b.name, 'company name', 100),
    plan_id: b.plan_id ? Number(b.plan_id) : null,
    primary_color: b.primary_color || '#0f766e', accent_color: b.accent_color || '#f59e0b',
    business_type: optStr(b.business_type, 80), address: optStr(b.address, 300), phone: optStr(b.phone, 40), email: optStr(b.email, 120), gstin: optStr(b.gstin, 20),
  };
}
const DEFAULT_CATEGORIES = ['Gas', 'Wi-Fi', 'Water', 'Electricity', 'Rent', 'Salary', 'Transport', 'Maintenance', 'Miscellaneous'];

admin.post('/companies', async (c) => {
  const b = await c.req.json();
  const f = companyFields(b);
  if (f.plan_id && !(await c.env.DB.prepare('SELECT 1 FROM plans WHERE id = ?').bind(f.plan_id).first())) fail(422, 'Unknown plan');
  // first company admin
  const adminEmail = reqStr(b.admin_email, 'admin email', 120).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) fail(422, 'Invalid admin email');
  const pwErr = validatePassword(b.admin_password); if (pwErr) fail(422, pwErr);
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(adminEmail).first()) fail(409, 'Admin email is already registered');
  let slug = slugify(b.slug || f.name);
  if (await c.env.DB.prepare('SELECT 1 FROM companies WHERE slug = ?').bind(slug).first()) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const co = await c.env.DB.prepare(`INSERT INTO companies (name, slug, plan_id, primary_color, accent_color, business_type, address, phone, email, gstin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(f.name, slug, f.plan_id, f.primary_color, f.accent_color, f.business_type, f.address, f.phone, f.email, f.gstin).first<any>();
  const hash = await hashPassword(b.admin_password);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO users (company_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'company_admin')`).bind(co.id, adminEmail, reqStr(b.admin_name, 'admin name', 80), hash),
    ...DEFAULT_CATEGORIES.map((n) => c.env.DB.prepare('INSERT INTO expense_categories (company_id, name) VALUES (?, ?)').bind(co.id, n)),
  ]);
  await audit(c, 'create', 'company', co.id, null, { ...co, admin_email: adminEmail }, co.id);
  return c.json(co, 201);
});
admin.put('/companies/:id', async (c) => {
  const id = idParam(c.req.param('id')); const b = await c.req.json();
  const before = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first();
  if (!before) fail(404, 'Company not found');
  const f = companyFields(b);
  const status = oneOf(b.status ?? (before as any).status, ['active', 'suspended'] as const, 'status');
  const r = await c.env.DB.prepare(`UPDATE companies SET name=?, plan_id=?, primary_color=?, accent_color=?, business_type=?, address=?, phone=?, email=?, gstin=?, status=?, updated_at=datetime('now')
    WHERE id = ? RETURNING *`).bind(f.name, f.plan_id, f.primary_color, f.accent_color, f.business_type, f.address, f.phone, f.email, f.gstin, status, id).first();
  if (status === 'suspended') await c.env.DB.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)').bind(id).run();
  await audit(c, (before as any).status !== status ? (status === 'suspended' ? 'suspend' : 'reactivate') : 'update', 'company', id, before, r, id);
  return c.json(r);
});
admin.delete('/companies/:id', async (c) => {
  const id = idParam(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const co = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(id).first<any>();
  if (!co) fail(404, 'Company not found');
  if (b.confirm_name !== co.name) fail(422, 'Type the company name exactly to confirm deletion');
  // final safety backup, kept in R2 even after deletion
  const backup = await backupCompany(c.env, id, 'manual');
  // remove uploaded files
  let cursor: string | undefined;
  do {
    const list = await c.env.FILES.list({ prefix: `companies/${id}/`, cursor });
    if (list.objects.length) await c.env.FILES.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE company_id = ?)').bind(id),
    ...['stock_counts', 'day_closings', 'payments', 'collections', 'expenses', 'purchases', 'expense_categories', 'products', 'documents', 'users'].map((t) =>
      c.env.DB.prepare(`DELETE FROM ${t} WHERE company_id = ?`).bind(id)),
    c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(id),
  ]);
  await audit(c, 'delete', 'company', id, { name: co.name, slug: co.slug, final_backup: backup?.key }, null, null);
  return c.json({ deleted: true, final_backup: backup?.key });
});

// ---------- users of any company ----------
admin.post('/companies/:id/users', async (c) => {
  const cid = idParam(c.req.param('id')); const b = await c.req.json();
  if (!(await c.env.DB.prepare('SELECT 1 FROM companies WHERE id = ?').bind(cid).first())) fail(404, 'Company not found');
  const email = reqStr(b.email, 'email', 120).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(422, 'Invalid email');
  const pwErr = validatePassword(b.password); if (pwErr) fail(422, pwErr);
  if (await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) fail(409, 'Email is already registered');
  const role = oneOf(b.role, ['company_admin', 'manager', 'staff', 'viewer'] as const, 'role', 'company_admin');
  const r = await c.env.DB.prepare(`INSERT INTO users (company_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id, email, name, role, status`)
    .bind(cid, email, reqStr(b.name, 'name', 80), await hashPassword(b.password), role).first();
  await audit(c, 'create', 'user', (r as any).id, null, r, cid);
  return c.json(r, 201);
});
admin.put('/users/:id', async (c) => {
  const id = idParam(c.req.param('id')); const b = await c.req.json();
  const before = await c.env.DB.prepare('SELECT id, company_id, email, name, role, permissions, status FROM users WHERE id = ?').bind(id).first<any>();
  if (!before) fail(404, 'User not found');
  if (before.role === 'super_admin' && id !== c.get('user').id) fail(403, 'Super admin accounts can only be edited by themselves');
  const role = before.role === 'super_admin' ? 'super_admin' : oneOf(b.role ?? before.role, ['company_admin', 'manager', 'staff', 'viewer'] as const, 'role');
  const status = before.role === 'super_admin' ? 'active' : oneOf(b.status ?? before.status, ['active', 'disabled'] as const, 'status');
  let permissions = before.permissions;
  if (b.permissions !== undefined) permissions = b.permissions === null ? null : JSON.stringify((b.permissions as string[]).filter((p) => (PERMISSIONS as readonly string[]).includes(p)));
  if (role === 'company_admin') permissions = null;
  const stmts = [c.env.DB.prepare('UPDATE users SET name = ?, role = ?, status = ?, permissions = ? WHERE id = ?').bind(b.name ? reqStr(b.name, 'name', 80) : before.name, role, status, permissions, id)];
  if (b.password) {
    const pwErr = validatePassword(b.password); if (pwErr) fail(422, pwErr);
    stmts.push(c.env.DB.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').bind(await hashPassword(b.password), id));
  }
  if (b.password || status === 'disabled' || role !== before.role) stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND user_id <> ?').bind(id, c.get('user').id));
  await c.env.DB.batch(stmts);
  await audit(c, 'update', 'user', id, before, { role, status, permissions, password_reset: !!b.password }, before.company_id);
  return c.json({ ok: true });
});
admin.delete('/users/:id', async (c) => {
  const id = idParam(c.req.param('id'));
  const before = await c.env.DB.prepare('SELECT id, company_id, email, name, role FROM users WHERE id = ?').bind(id).first<any>();
  if (!before) fail(404, 'User not found');
  if (before.role === 'super_admin') fail(403, 'Super admin accounts cannot be deleted here');
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  await audit(c, 'delete', 'user', id, before, null, before.company_id);
  return c.json({ deleted: true });
});

// ---------- activity & backups ----------
admin.get('/activity', async (c) => {
  const before = Number(c.req.query('before')) || 2 ** 52;
  const company = Number(c.req.query('company')) || null;
  const r = await c.env.DB.prepare(`SELECT a.id, a.company_id, co.name AS company_name, a.user_name, a.action, a.entity, a.entity_id, a.before_json, a.after_json, a.ip, a.created_at
     FROM audit_logs a LEFT JOIN companies co ON co.id = a.company_id WHERE a.id < ? AND (? IS NULL OR a.company_id = ?) ORDER BY a.id DESC LIMIT 100`)
    .bind(before, company, company).all();
  return c.json(r.results);
});
admin.get('/backups', async (c) => {
  const r = await c.env.DB.prepare(`SELECT b.id, b.company_id, co.name AS company_name, b.size_bytes, b.kind, b.created_at FROM backups b LEFT JOIN companies co ON co.id = b.company_id ORDER BY b.id DESC LIMIT 200`).all();
  return c.json(r.results);
});
admin.post('/companies/:id/backup', async (c) => {
  const id = idParam(c.req.param('id'));
  const r = await backupCompany(c.env, id, 'manual');
  if (!r) fail(404, 'Company not found');
  await audit(c, 'backup', 'company', id, null, r, id);
  return c.json(r, 201);
});
admin.get('/backups/:id/download', async (c) => {
  const b = await c.env.DB.prepare('SELECT * FROM backups WHERE id = ?').bind(idParam(c.req.param('id'))).first<any>();
  if (!b) fail(404, 'Backup not found');
  const obj = await c.env.FILES.get(b.r2_key);
  if (!obj) fail(404, 'Backup file missing');
  await audit(c, 'download', 'backup', b.id, null, null, b.company_id);
  return new Response(obj.body, { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="backup-company-${b.company_id}-${b.id}.json"` } });
});

export default admin;
