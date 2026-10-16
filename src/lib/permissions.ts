import type { Role } from '../types';

export const PERMISSIONS = [
  'entries.view',      // see daily entries
  'entries.write',     // add / edit purchases, expenses, collections, stock counts
  'entries.delete',    // delete entries
  'cash.close',        // record end-of-day cash count
  'products.manage',   // create / edit products, expense categories
  'reports.view',      // dashboard & reports (incl. profit)
  'export',            // CSV / Excel export
  'uploads.write',     // upload photos & run OCR
  'team.manage',       // add / edit team members
  'settings.manage',   // branding & business details
  'audit.view',        // audit log
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_DEFAULTS: Record<Exclude<Role, 'super_admin'>, Permission[]> = {
  company_admin: [...PERMISSIONS],
  manager: ['entries.view', 'entries.write', 'entries.delete', 'cash.close', 'products.manage', 'reports.view', 'export', 'uploads.write', 'audit.view'],
  staff: ['entries.view', 'entries.write', 'cash.close', 'uploads.write'],
  viewer: ['entries.view', 'reports.view'],
};

export function effectivePermissions(role: Role, stored: string | null): string[] {
  if (role === 'super_admin') return [...PERMISSIONS];
  if (role === 'company_admin') return [...PERMISSIONS]; // admins can never lock themselves out
  if (stored) {
    try {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) return arr.filter((p) => (PERMISSIONS as readonly string[]).includes(p));
    } catch { /* fall through */ }
  }
  return [...ROLE_DEFAULTS[role]];
}
