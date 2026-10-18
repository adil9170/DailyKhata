import { onColor, tints } from './color.js';
import { localRequest, NOT_LOCAL } from './localapi.js';
import * as S from './store.js';
import { pullSoon, flushNow } from './store.js';
// API client. Session lives in an HttpOnly cookie; super admins viewing a company portal send X-Company-Id.
export { state, setViewCompany, ApiError, can, isSuper } from './state.js';
import { state, ApiError } from './state.js';

/** Network request to the server (no local shortcut). */
export async function netApi(path, { method = 'GET', body, form, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (state.viewCompanyId && path.startsWith('/api/c/')) headers['x-company-id'] = String(state.viewCompanyId);
  const res = await fetch(path, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined), credentials: 'same-origin' });
  if (raw && res.ok) return res;
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) { window.dispatchEvent(new CustomEvent('dk:unauthorized')); }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/**
 * Every screen calls this. Company data (entries, products, reports…) is answered from the phone's own copy
 * and changes are queued for upload, so screens never wait for the network. Everything else goes to the server.
 */
export async function api(path, opts = {}) {
  if (!opts.form && !opts.raw && path.startsWith('/api/c/')) {
    const local = await localRequest(opts.method || 'GET', path, opts.body);
    if (local !== NOT_LOCAL) return local;
  }
  const res = await netApi(path, opts);
  if (path === '/api/c/bulk') pullSoon(); // photo-based saves go straight to the server; fetch the new rows
  return res;
}

/** URL for <img>/<a> links to company files; adds ?company= for super admins. */
export function companyUrl(path) {
  if (!state.viewCompanyId) return path;
  return path + (path.includes('?') ? '&' : '?') + 'company=' + state.viewCompanyId;
}


export async function loadContext() {
  const ctx = await api('/api/c/context');
  if (S.isActive() && !S.getContext()) S.setContext({ company: ctx.company }); // first run: remember branding for offline starts
  state.company = ctx.company; state.products = ctx.products; state.categories = ctx.categories; state.today = ctx.today;
  applyBranding(ctx.company);
  return ctx;
}
/** Ask the server for the latest company details (branding, plan, logo) and keep a copy for offline starts. */
export async function refreshContext() {
  const ctx = await netApi('/api/c/context');
  if (S.isActive()) await S.setContext({ company: ctx.company });
  state.company = ctx.company; state.today = ctx.today;
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
  await flushNow(4000); // exports are built on the server, so upload anything waiting first
  const res = await netApi(path, { raw: true });
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
