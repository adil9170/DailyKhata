import { onColor, tints } from './color.js';
// API client. Session lives in an HttpOnly cookie; super admins viewing a company portal send X-Company-Id.
export const state = {
  user: null,
  company: null,      // branding/context for the active company portal
  products: [],
  categories: [],
  today: null,
  viewCompanyId: null, // super admin "open portal"
};

try { state.viewCompanyId = Number(sessionStorage.getItem('dk_view_company')) || null; } catch { /* storage blocked */ }
export function setViewCompany(id) {
  state.viewCompanyId = id;
  try { id ? sessionStorage.setItem('dk_view_company', String(id)) : sessionStorage.removeItem('dk_view_company'); } catch { /* ignore */ }
}

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

export async function api(path, { method = 'GET', body, form, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (state.viewCompanyId && path.startsWith('/api/c/')) headers['x-company-id'] = String(state.viewCompanyId);
  const res = await fetch(path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), credentials: 'same-origin' });
  if (raw && res.ok) return res;
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) { location.hash = '#/login'; }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/** URL for <img>/<a> links to company files; adds ?company= for super admins. */
export function companyUrl(path) {
  if (!state.viewCompanyId) return path;
  return path + (path.includes('?') ? '&' : '?') + 'company=' + state.viewCompanyId;
}

export const can = (p) => !!state.user?.permissions?.includes(p);
export const isSuper = () => state.user?.role === 'super_admin';

export async function loadContext() {
  const ctx = await api('/api/c/context');
  state.company = ctx.company; state.products = ctx.products; state.categories = ctx.categories; state.today = ctx.today;
  applyBranding(ctx.company);
  return ctx;
}
export async function refreshLists() {
  const [p, k] = await Promise.all([api('/api/c/products'), api('/api/c/categories')]);
  state.products = p; state.categories = k;
}

export function applyBranding(company) {
  const root = document.documentElement.style;
  if (company) {
    root.setProperty('--brand', company.primary_color || '#0f766e');
    root.setProperty('--accent', company.accent_color || '#f59e0b');
    root.setProperty('--on-brand', onColor(company.primary_color || '#0f766e'));
    for (const [k, v] of Object.entries(tints(company.primary_color || '#0f766e'))) root.setProperty(k, v);
    document.title = `${company.name} · DailyKhata`;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', company.primary_color || '#0f766e');
  } else {
    root.removeProperty('--brand'); root.removeProperty('--accent'); root.removeProperty('--on-brand'); for (const k of Object.keys(tints('#635bff'))) root.removeProperty(k); document.title = 'DailyKhata';
  }
}

export function todayLocal() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10);
}

export async function download(path, fallbackName) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Navigate to a hash route; re-renders even when the hash is unchanged. */
export function navigate(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
