import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { AppEnv } from '../types';
import { hashPassword, verifyPassword, randomToken, sha256Hex, validatePassword } from '../lib/crypto';
import { requireAuth, SESSION_COOKIE } from '../middleware';
import { fail, reqStr } from '../lib/util';
import { audit } from '../lib/audit';

const auth = new Hono<AppEnv>();

const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

async function startSession(c: any, userId: number) {
  const token = randomToken();
  const days = Number(c.env.SESSION_DAYS || '7');
  await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?, ?, datetime('now', ?), ?, ?)`)
    .bind(await sha256Hex(token), userId, `+${days} days`, c.req.header('cf-connecting-ip') ?? null, (c.req.header('user-agent') ?? '').slice(0, 200))
    .run();
  const secure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'Strict', path: '/', maxAge: days * 86400 });
}

auth.get('/setup', async (c) => {
  const n = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'`).first<number>('n');
  return c.json({ needed: !n });
});

// First-run: create the super admin. Requires the SETUP_TOKEN secret and only works once.
auth.post('/setup', async (c) => {
  const body = await c.req.json();
  if (!c.env.SETUP_TOKEN) fail(403, 'SETUP_TOKEN secret is not configured on the server');
  if (body.setup_token !== c.env.SETUP_TOKEN) fail(403, 'Invalid setup token');
  const n = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin'`).first<number>('n');
  if (n) fail(409, 'Setup has already been completed');
  const pwErr = validatePassword(body.password); if (pwErr) fail(422, pwErr);
  const email = reqStr(body.email, 'email').toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(422, 'Invalid email');
  const res = await c.env.DB.prepare(`INSERT INTO users (company_id, email, name, password_hash, role) VALUES (NULL, ?, ?, ?, 'super_admin')`)
    .bind(email, reqStr(body.name, 'name'), await hashPassword(body.password)).run();
  const id = res.meta.last_row_id;
  await startSession(c, id);
  await c.env.DB.prepare(`INSERT INTO audit_logs (company_id, user_id, user_name, action, entity, entity_id) VALUES (NULL, ?, ?, 'setup', 'user', ?)`).bind(id, body.name, id).run();
  return c.json({ ok: true });
});

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const user = await c.env.DB.prepare(
    `SELECT u.*, c.status AS company_status FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.email = ?`,
  ).bind(email).first<any>();
  if (user?.locked_until && user.locked_until > new Date().toISOString().replace('T', ' ').slice(0, 19)) {
    fail(429, `Too many failed attempts. Try again after ${LOCK_MINUTES} minutes.`);
  }
  const ok = user ? await verifyPassword(password, user.password_hash) : (await hashPassword(password), false);
  if (!user || !ok) {
    if (user) {
      const fails = user.failed_logins + 1;
      await c.env.DB.prepare(`UPDATE users SET failed_logins = ?, locked_until = CASE WHEN ? >= ? THEN datetime('now', ?) ELSE NULL END WHERE id = ?`)
        .bind(fails >= LOCK_AFTER ? 0 : fails, fails, LOCK_AFTER, `+${LOCK_MINUTES} minutes`, user.id).run();
      await c.env.DB.prepare(`INSERT INTO audit_logs (company_id, user_id, user_name, action, entity, entity_id, ip) VALUES (?, ?, ?, 'login_failed', 'user', ?, ?)`)
        .bind(user.company_id, user.id, user.name, user.id, c.req.header('cf-connecting-ip') ?? null).run();
    }
    fail(401, 'Incorrect email or password');
  }
  if (user.status !== 'active') fail(403, 'Your account is disabled');
  if (user.role !== 'super_admin' && user.company_status !== 'active') fail(403, 'This company account is suspended. Contact support.');
  await c.env.DB.prepare(`UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = datetime('now') WHERE id = ?`).bind(user.id).run();
  await startSession(c, user.id);
  await c.env.DB.prepare(`INSERT INTO audit_logs (company_id, user_id, user_name, action, entity, entity_id, ip) VALUES (?, ?, ?, 'login', 'user', ?, ?)`)
    .bind(user.company_id, user.id, user.name, user.id, c.req.header('cf-connecting-ip') ?? null).run();
  return c.json({ ok: true });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  // Sliding session: the app calls /me every time it opens, so people who use it stay signed in, while idle sessions still expire.
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const days = Number(c.env.SESSION_DAYS || '7');
    const res = await c.env.DB.prepare(`UPDATE sessions SET expires_at = datetime('now', ?) WHERE id = ? AND expires_at < datetime('now', ?)`)
      .bind(`+${days} days`, await sha256Hex(token), `+${Math.floor(days / 2)} days`).run();
    if (res.meta.changes > 0) {
      const secure = new URL(c.req.url).protocol === 'https:';
      setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'Strict', path: '/', maxAge: days * 86400 });
    }
  }
  let company = null;
  if (user.company_id) {
    company = await c.env.DB.prepare(
      `SELECT c.id, c.name, c.slug, c.status, c.primary_color, c.accent_color, c.business_type, c.address, c.phone, c.email, c.gstin,
              (c.logo_key IS NOT NULL) AS has_logo, c.updated_at, p.name AS plan_name, p.ocr_enabled
         FROM companies c LEFT JOIN plans p ON p.id = c.plan_id WHERE c.id = ?`,
    ).bind(user.company_id).first();
  }
  return c.json({ user, company });
});

auth.post('/password', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(String(body.current_password ?? ''), row.password_hash))) fail(403, 'Current password is incorrect');
  const pwErr = validatePassword(body.new_password); if (pwErr) fail(422, pwErr);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(body.new_password), user.id).run();
  // sign out all other sessions
  const current = await sha256Hex(getCookie(c, SESSION_COOKIE)!);
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').bind(user.id, current).run();
  await audit(c, 'password_change', 'user', user.id, null, null, user.company_id);
  return c.json({ ok: true });
});

export default auth;
