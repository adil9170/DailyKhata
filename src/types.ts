export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ASSETS: Fetcher;
  AI?: Ai;
  APP_NAME: string;
  SESSION_DAYS: string;
  BACKUP_RETENTION_DAYS: string;
  SETUP_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
}

export type Role = 'super_admin' | 'company_admin' | 'manager' | 'staff' | 'viewer';

export interface AuthUser {
  id: number;
  company_id: number | null;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
}

export interface CompanyCtx {
  id: number;
  name: string;
  status: string;
  plan_id: number | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
    companyId: number;
    company: CompanyCtx;
  };
};
