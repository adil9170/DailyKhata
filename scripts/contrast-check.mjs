// WCAG contrast audit: computed styles over key pages in every Settings > Style (x light/dark where the style follows it).
// ONLY=psych,vapor limits the run to some styles.
// Usage: BASE=http://localhost:8788 node scripts/contrast-check.mjs   (needs `playwright` installed elsewhere,
// e.g. `npm i playwright` in a scratch dir and NODE_PATH pointing at its node_modules; shop from the smoke test).
// Text must reach 4.5:1 (3:1 for large text); input borders 3:1. Elements on gradients/images are counted as skipped.
import { chromium } from 'playwright';
import { STYLES } from '../public/js/styles.js';
const BASE = process.env.BASE || 'http://localhost:8788';
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium';
const APP = (process.env.APP || 'quick,day,chat,bill,bills,dump,counter,dashboard,ledger,products,settings').split(','); // APP=chat,day limits the pages
const LAND = ['/', '/hi/'];

function audit() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const bgOf = (el) => { // composite ancestors' backgrounds bottom-up; null when an image/gradient is involved
    const layers = []; let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      // a pattern or sheen drawn over a solid colour: judge against the colour; a gradient with no solid colour under it: skip
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !(c && c.a === 1)) return null;
      if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
      n = n.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  };
  const sel = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const out = []; let checked = 0, skipped = 0;
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT'].includes(el.tagName.toUpperCase())) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    if (el.closest(':disabled,[aria-disabled="true"],[hidden],[inert]')) continue;
    const txt = [...el.childNodes].filter((x) => x.nodeType === 3 && x.textContent.trim()).map((x) => x.textContent.trim()).join(' ');
    const bg = bgOf(el);
    if (txt) {
      if (!bg) { skipped++; continue; }
      let op = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= +getComputedStyle(n).opacity;
      const fg0 = parse(cs.color); const fg = over({ ...fg0, a: fg0.a * op }, bg);
      const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = px >= 24 || (px >= 18.66 && bold);
      const need = large ? 3 : 4.5, rt = ratio(fg, bg); checked++;
      if (rt < need) out.push({ kind: 'text', sel: sel(el), text: txt.slice(0, 28), fg: hex(fg), bg: hex(bg), ratio: +rt.toFixed(2), need });
    }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !['checkbox', 'radio', 'hidden', 'file'].includes(el.type)) {
      const pbg = bgOf(el.parentElement || el); const b = parse(cs.borderTopColor);
      if (!pbg || !b || parseFloat(cs.borderTopWidth) < 1) continue;
      const ebg = bgOf(el) || pbg; const rt = ratio(over(b, ebg), pbg);
      // Soft style shows fields by inset shadow, not a border; only flag when there is neither
      if (rt < 3 && (!cs.boxShadow || cs.boxShadow === 'none') && ebg.r === pbg.r && ebg.g === pbg.g && ebg.b === pbg.b) out.push({ kind: 'ui', sel: sel(el), fg: hex(over(b, ebg)), bg: hex(pbg), ratio: +rt.toFixed(2), need: 3 });
    }
  }
  return { out, checked, skipped };
}

const b = await chromium.launch({ executablePath: EXE });
const results = []; const seen = new Set(); let total = 0;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const combos = STYLES.filter((s) => !ONLY || ONLY.includes(s.id)).flatMap((s) => (s.scheme === 'any' ? ['light', 'dark'] : [s.scheme]).map((t) => [s.id, t, s.css === 'app']));
for (const [style, theme, landing] of combos) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
  await ctx.addInitScript(([s, t]) => { try { localStorage.setItem('dk_theme', t); localStorage.setItem('dk_start_done', '1'); if (s !== 'clean') localStorage.setItem('dk_style', s); } catch {} }, [style, theme]);
  const page = await ctx.newPage();
  const pages = landing ? LAND.map((p) => ({ name: 'landing ' + p, go: () => page.goto(BASE + p) })) : []; // styles in css/themes/ never touch the landing page
  for (const p of pages) { await p.go(); await page.waitForTimeout(900); const r = await page.evaluate(audit); total += r.checked; add(r, `${style}/${theme}`, p.name); }
  await page.request.post(BASE + '/api/auth/login', { data: { email: 'ravi@sharma.in', password: 'RaviPass123' } });
  for (const p of APP) {
    await page.goto(BASE + '/#/' + p); await page.waitForTimeout(1100);
    const r = await page.evaluate(audit); total += r.checked; add(r, `${style}/${theme}`, '#/' + p);
  }
  await ctx.close();
}
function add(r, combo, name) { for (const f of r.out) { const k = [f.kind, f.sel, f.fg, f.bg, combo].join('|'); if (seen.has(k)) continue; seen.add(k); results.push({ combo, page: name, ...f }); } }
await b.close();
console.log(`checked ${total} text elements; ${results.length} unique failures`);
for (const f of results) console.log(`${f.combo.padEnd(11)} ${f.page.padEnd(14)} ${f.kind} ${f.sel} ${f.text ? JSON.stringify(f.text) : ''} ${f.fg} on ${f.bg} = ${f.ratio} (need ${f.need})`);
process.exitCode = results.length ? 1 : 0;
