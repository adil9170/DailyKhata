// The company logo as the app's icon: browser tab, iPhone "Add to Home Screen", Android install, and on receipts.
// The logo is drawn once onto a white square, kept on the phone (works offline), and redrawn only when it changes.
import { companyUrl } from './api.js';

const KEY = 'dk_logoicon';
const DEFAULT_ICON = '/favicon.svg', DEFAULT_MANIFEST = '/manifest.webmanifest';
let applied = null, manifestUrl = null;

const keyOf = (c) => `${c.id}:${c.updated_at || ''}`;
const readCache = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const writeCache = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

function loadImage(src) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('logo')); img.src = src; });
}

/** Logo centred on a white square, as a PNG data URL. `pad` is the empty margin around it (0–0.5 of the size). */
function squareIcon(img, size, pad = 0.12) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  const box = size * (1 - pad * 2), w = img.naturalWidth || img.width || box, hh = img.naturalHeight || img.height || box;
  const k = Math.min(box / w, box / hh);
  ctx.drawImage(img, (size - w * k) / 2, (size - hh * k) / 2, w * k, hh * k);
  return c.toDataURL('image/png');
}

/** The company's logo as a loaded <img> (from the phone's copy when we have one), or null if there is none / it can't load. */
export async function logoImage(company) {
  if (!company?.has_logo) return null;
  const cached = readCache();
  if (cached?.key === keyOf(company) && cached.png) { try { return await loadImage(cached.png); } catch { /* fall through */ } }
  try {
    const res = await fetch(companyUrl(`/api/c/logo?v=${encodeURIComponent(company.updated_at || '')}`), { credentials: 'same-origin' });
    if (!res.ok) return null;
    const url = URL.createObjectURL(await res.blob());
    try {
      const img = await loadImage(url); // <img> (not createImageBitmap) so SVG logos work too
      writeCache({ key: keyOf(company), png: squareIcon(img, 256, 0.04) });
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  } catch { return null; } // offline and never cached: callers fall back to the company's initial
}

function setLink(rel, href, type) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.append(el); }
  el.href = href;
  if (type) el.type = type; else el.removeAttribute('type');
}

/** Swap the tab icon, home-screen icon and install manifest to the company's logo (or back to the default). */
export async function applyLogoIcon(company) {
  const k = company?.has_logo ? keyOf(company) : null;
  if (k === applied) return;
  applied = k;
  // swap the manifest link first, then free the old one, so the browser never points at a revoked URL
  const useManifest = (url) => { const old = manifestUrl; manifestUrl = url.startsWith('blob:') ? url : null; setLink('manifest', url); if (old && old !== url) URL.revokeObjectURL(old); };
  if (!k) {
    setLink('icon', DEFAULT_ICON, 'image/svg+xml'); setLink('apple-touch-icon', DEFAULT_ICON); useManifest(DEFAULT_MANIFEST);
    return;
  }
  const img = await logoImage(company);
  if (!img || applied !== k) return;
  const i192 = squareIcon(img, 192), i512 = squareIcon(img, 512);
  setLink('icon', squareIcon(img, 64, 0.06), 'image/png');
  setLink('apple-touch-icon', squareIcon(img, 180)); // iOS rounds the corners itself
  try {
    const base = await (await fetch(DEFAULT_MANIFEST)).json();
    const abs = (u) => new URL(u, location.origin).href; // a blob: manifest needs absolute URLs
    const m = { ...base, id: '/', name: company.name, short_name: company.name.slice(0, 12), start_url: abs(base.start_url || '/'), scope: abs('/'),
      theme_color: company.primary_color || base.theme_color,
      icons: [{ src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' }],
      shortcuts: (base.shortcuts || []).map((s) => ({ ...s, url: abs(s.url), icons: [{ src: i192, sizes: '192x192', type: 'image/png' }] })) };
    if (applied !== k) return;
    useManifest(URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })));
  } catch { /* offline before the manifest was cached: keep the default install icon */ }
}
