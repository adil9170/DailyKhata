// Appearance: 'system' | 'light' | 'dark' (per-viewer preference). Art styles (Settings > Style) bring their own
// light or dark colours, so inside the app their scheme wins over this setting.
import { currentStyle } from './styles.js';

export function getTheme() { try { return localStorage.getItem('dk_theme') || 'system'; } catch { return 'system'; } }
/** 'light' | 'dark' when the current style fixes the scheme (app pages only), else null */
export function styleScheme() {
  const s = currentStyle().scheme;
  return s !== 'any' && document.documentElement.classList.contains('app-mode') ? s : null;
}
export function effectiveTheme() {
  const t = styleScheme() || getTheme();
  return t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
}
export function applyTheme() {
  const t = styleScheme() || getTheme();
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=color-scheme]')?.setAttribute('content', t === 'system' ? 'light dark' : t);
}
export function setTheme(t) {
  try { t === 'system' ? localStorage.removeItem('dk_theme') : localStorage.setItem('dk_theme', t); } catch { /* storage blocked */ }
  applyTheme();
  window.dispatchEvent(new Event('themechange'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getTheme() === 'system') window.dispatchEvent(new Event('themechange')); });
applyTheme();
