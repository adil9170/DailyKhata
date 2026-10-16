// Appearance: 'system' | 'light' | 'dark' (per-viewer preference).
export function getTheme() { try { return localStorage.getItem('dk_theme') || 'system'; } catch { return 'system'; } }
export function effectiveTheme() {
  const t = getTheme();
  return t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
}
export function applyTheme() {
  const t = getTheme();
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
