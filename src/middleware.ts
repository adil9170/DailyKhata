import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { AppEnv, AuthUser, CompanyCtx, Role } from './types';
import { sha256Hex } from './lib/crypto';
import { effectivePermissions } from './lib/permissions';
import { fail } from './lib/util';

export const SESSION_COOKIE = 'dk_session';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) fail(401, 'Not signed in');
  const sid = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.company_id, u.email, u.name, u.role, u.permissions, u.status, c.status AS company_status
       FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN companies c ON c.id = u.company_id
      WHERE s.id = ? AND s.expires_at > datetime('now')`,
  ).bind(sid).first<{ id: number; company_id: number | null; email: string; name: string; role: Role; permissions: string | null; status: string; company_status: string | null }>();
  if (!row) fail(401, 'Session expired');
  if (row.status !== 'active') fail(403, 'Your account is disabled');
  if (row.role !== 'super_admin' && row.company_status !== 'active') fail(403, 'This company account is suspended. Contact support.');
  const user: AuthUser = { id: row.id, company_id: row.company_id, email: row.email, name: row.name, role: row.role, permissions: effectivePermissions(row.role, row.permissions) };
  c.set('user', user);
  await next();
});

export const requireSuper = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'super_admin') fail(403, 'Super admin only');
  await next();
});

/**
 * Resolves the company every /api/c/* request operates on. Company users are pinned to their own
 * company; nothing in the request can change that. A super admin may open a company portal by
 * sending X-Company-Id or ?company= for <img> links (all actions are audit-logged under their name).
 */
export const companyScope = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  let companyId: number;
  if (user.role === 'super_admin') {
    companyId = Number(c.req.header('x-company-id') ?? c.req.query('company'));
    if (!Number.isInteger(companyId) || companyId <= 0) fail(400, 'Select a company');
  } else {
    companyId = user.company_id!;
  }
  const company = await c.env.DB.prepare('SELECT id, name, status, plan_id FROM companies WHERE id = ?').bind(companyId).first<CompanyCtx>();
  if (!company) fail(404, 'Company not found');
  c.set('companyId', company.id);
  c.set('company', company);
  await next();
});

export const perm = (...needed: string[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const have = c.get('user').permissions;
    if (!needed.every((p) => have.includes(p))) fail(403, `You don't have permission (${needed.join(', ')})`);
    await next();
  });
