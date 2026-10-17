// Brand colours from a logo, computed in the browser (the image never leaves the device for this step).

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return [99, 91, 255];
  const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let hue = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue, s, l];
}
export function hslToRgb(hue, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function luminance(hex) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexToRgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Text colour that stays readable on top of a brand colour. */
export const onColor = (hex) => (contrast(hex, '#ffffff') >= 3.2 ? '#ffffff' : '#0a2540');

/** Keep the logo's hue but tame extremes so it works as a button colour (text colour is chosen by onColor). */
function usable(hex) {
  let [hh, s, l] = rgbToHsl(...hexToRgb(hex));
  s = Math.min(Math.max(s, 0.5), 0.92);
  l = Math.min(Math.max(l, 0.32), 0.6);
  return rgbToHex(...hslToRgb(hh, s, l));
}

/**
 * Pick a primary and an accent colour from an image file or blob.
 * Returns { primary, accent, swatches } or null when the image has no usable colour (e.g. black-and-white logo).
 */
export async function brandFromImage(file) {
  const bmp = await createImageBitmap(file);
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map(); // 24 hue sectors
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 140) continue;
    const [hh, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    if (s < 0.22 || l < 0.12 || l > 0.92) continue; // skip white / black / grey backgrounds
    const k = Math.floor(hh / 15) % 24;
    const b = buckets.get(k) || { w: 0, r: 0, g: 0, b: 0 };
    const w = s * (1 - Math.abs(l - 0.5)); // favour vivid, mid-tone pixels
    b.w += w; b.r += px[i] * w; b.g += px[i + 1] * w; b.b += px[i + 2] * w;
    buckets.set(k, b);
  }
  const ranked = [...buckets.entries()].filter(([, b]) => b.w > 0).sort((a, b) => b[1].w - a[1].w);
  if (!ranked.length) return null;
  const avg = (b) => rgbToHex(b.r / b.w, b.g / b.w, b.b / b.w);
  const primary = usable(avg(ranked[0][1]));
  const far = ranked.slice(1).find(([k, b]) => { const d = Math.abs(k - ranked[0][0]); return Math.min(d, 24 - d) >= 4 && b.w >= ranked[0][1].w * 0.25; });
  const [ph, ps, pl] = rgbToHsl(...hexToRgb(primary));
  const accent = far ? rgbToHex(...hslToRgb(rgbToHsl(...hexToRgb(avg(far[1])))[0], 0.85, 0.55)) : rgbToHex(...hslToRgb((ph + 35) % 360, Math.max(ps, 0.7), 0.55));
  return { primary, accent, swatches: ranked.slice(0, 4).map(([, b]) => avg(b)) };
}
