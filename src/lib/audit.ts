import type { Context } from 'hono';
import type { AppEnv } from '../types';

export async function audit(
  c: Context<AppEnv>,
  action: string,
  entity: string,
  entityId: number | null,
  before: unknown = null,
  after: unknown = null,
  companyId?: number | null,
) {
  const user = c.get('user');
  const cid = companyId !== undefined ? companyId : (c.get('companyId') ?? user?.company_id ?? null);
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (company_id, user_id, user_name, action, entity, entity_id, before_json, after_json, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      cid,
      user?.id ?? null,
      user?.name ?? null,
      action,
      entity,
      entityId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      c.req.header('cf-connecting-ip') ?? null,
    )
    .run();
}
