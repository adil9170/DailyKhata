import { HTTPException } from 'hono/http-exception';

export function fail(status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 502, message: string): never {
  throw new HTTPException(status, { message });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function reqDate(s: unknown, field = 'date'): string {
  if (!isDate(s)) fail(422, `${field} must be a valid YYYY-MM-DD date`);
  return s;
}
export { addDays, daysBetween, todayIST } from './dates';

/** Convert a rupee amount (number or string like "1,020.50" / "₹820") to integer paise. */
export function toPaise(v: unknown, field = 'amount', { allowZero = true } = {}): number {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') n = Number(v.replace(/[₹,\s]|rs\.?/gi, ''));
  else n = NaN;
  if (!isFinite(n)) fail(422, `${field} must be a number`);
  if (n < 0) fail(422, `${field} cannot be negative`);
  if (!allowZero && n === 0) fail(422, `${field} must be greater than zero`);
  if (n > 1e10) fail(422, `${field} is too large`);
  return Math.round(n * 100);
}
export function optPaise(v: unknown, field: string): number | null {
  if (v === null || v === undefined || v === '') return null;
  return toPaise(v, field);
}
export function rupees(paise: number | null | undefined): number | null {
  return paise === null || paise === undefined ? null : Math.round(paise) / 100;
}

export function reqStr(v: unknown, field: string, max = 200): string {
  if (typeof v !== 'string' || !v.trim()) fail(422, `${field} is required`);
  const s = v.trim();
  if (s.length > max) fail(422, `${field} is too long (max ${max})`);
  return s;
}
export function optStr(v: unknown, max = 1000): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') fail(422, 'Invalid text value');
  const s = v.trim();
  if (!s) return null;
  return s.slice(0, max);
}
export function reqNum(v: unknown, field: string, { min = 0, max = 1e9, int = false } = {}): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !isFinite(n)) fail(422, `${field} must be a number`);
  if (n < min || n > max) fail(422, `${field} must be between ${min} and ${max}`);
  if (int && !Number.isInteger(n)) fail(422, `${field} must be a whole number`);
  return n;
}
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string, dflt?: T): T {
  if ((v === undefined || v === null || v === '') && dflt) return dflt;
  if (!allowed.includes(v as T)) fail(422, `${field} must be one of: ${allowed.join(', ')}`);
  return v as T;
}
export function isColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';
}
export function idParam(v: string | undefined): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) fail(400, 'Invalid id');
  return n;
}
