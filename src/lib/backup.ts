import type { Env } from '../types';

const TABLES = ['products', 'expense_categories', 'purchases', 'expenses', 'collections', 'payments', 'stock_counts', 'day_closings', 'documents'] as const;

/** Writes a full JSON snapshot of one company's financial data to R2 (private bucket). */
export async function backupCompany(env: Env, companyId: number, kind: 'scheduled' | 'manual' = 'scheduled') {
  const company = await env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(companyId).first();
  if (!company) return null;
  const data: Record<string, unknown[]> = {};
  const res = await env.DB.batch(TABLES.map((t) => env.DB.prepare(`SELECT * FROM ${t} WHERE company_id = ?`).bind(companyId)));
  TABLES.forEach((t, i) => { data[t] = res[i].results; });
  const users = await env.DB.prepare('SELECT id, email, name, role, permissions, status, created_at FROM users WHERE company_id = ?').bind(companyId).all();
  const body = JSON.stringify({ version: 1, created_at: new Date().toISOString(), company, users: users.results, data });
  const key = `backups/${companyId}/${new Date().toISOString().replace(/[:.]/g, '-')}-${kind}.json`;
  await env.FILES.put(key, body, { httpMetadata: { contentType: 'application/json' } });
  await env.DB.prepare('INSERT INTO backups (company_id, r2_key, size_bytes, kind) VALUES (?, ?, ?, ?)').bind(companyId, key, body.length, kind).run();
  return { key, size: body.length };
}

export async function runScheduledBackups(env: Env) {
  const companies = await env.DB.prepare('SELECT id FROM companies').all<{ id: number }>();
  for (const c of companies.results) {
    try { await backupCompany(env, c.id, 'scheduled'); } catch (e) { console.error('backup failed', c.id, e); }
  }
  // retention
  const days = Number(env.BACKUP_RETENTION_DAYS || '30');
  const old = await env.DB.prepare(`SELECT id, r2_key FROM backups WHERE kind = 'scheduled' AND created_at < datetime('now', ?)`).bind(`-${days} days`).all<{ id: number; r2_key: string }>();
  for (const b of old.results) {
    await env.FILES.delete(b.r2_key);
    await env.DB.prepare('DELETE FROM backups WHERE id = ?').bind(b.id).run();
  }
  // expired sessions
  await env.DB.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
}
