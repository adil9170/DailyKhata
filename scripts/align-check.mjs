// Layout audit against Apple's Human Interface Guidelines: every app page at phone width.
// Usage: BASE=http://localhost:8788 node scripts/align-check.mjs   (needs `playwright` installed elsewhere, see contrast-check.mjs;
// shop from the smoke test). Options: W=390 (viewport width), STYLE=landing, PAGES=quick,day, JSON=1 for raw output.
// Checks, per page:
//  - edges:   top-level blocks in .main start on the page's side margin (16 pt on phones) unless they are meant to bleed
//  - gaps:    vertical space between top-level blocks (should be one rhythm, on the 4 pt grid)
//  - offgrid: padding / margin / gap values that are not multiples of 4 (1-3 px hairlines ignored)
//  - targets: tappable things smaller than 44 x 44 pt (inline text links inside sentences are allowed)
//  - fonts:   text sizes in use (HIG ramp: 34 28 22 20 17 16 15 13 12 11) and anything under 11 px
//  - overflow: page wider than the screen
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8788';
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium';
const W = +(process.env.W || 390), STYLE = process.env.STYLE || 'landing';
const PAGES = (process.env.PAGES || 'quick,day,chat,bill,bills,dump,counter,notes,dashboard,ledger,products,uploads,reports,team,settings,audit').split(',');

function audit() {
  const main = document.querySelector('.main'); if (!main) return { error: 'no .main' };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const mcs = getComputedStyle(main), mr = main.getBoundingClientRect();
  const left = Math.round(mr.left + parseFloat(mcs.paddingLeft)), right = Math.round(mr.right - parseFloat(mcs.paddingRight));
  // unwrap single wrappers (pages often render one container) so we look at the real blocks
  let blocks = [...main.children].filter(vis);
  while (blocks.length === 1 && blocks[0].children.length > 1 && !/card|strip|qsum|daysum/.test(blocks[0].className)) blocks = [...blocks[0].children].filter(vis);
  const edges = [], gaps = [];
  blocks.forEach((el, i) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'absolute') return;
    const dl = Math.round(r.left) - left, dr = right - Math.round(r.right);
    if (Math.abs(dl) > 1 || (Math.abs(dr) > 1 && r.width > (right - left) * 0.6)) edges.push({ el: name(el), dl, dr });
    const prev = blocks.slice(0, i).reverse().find((p) => !['fixed', 'absolute'].includes(getComputedStyle(p).position));
    if (prev) gaps.push({ a: name(prev), b: name(el), gap: Math.round(r.top - prev.getBoundingClientRect().bottom) });
  });
  const offgrid = {}; const add = (el, prop, v) => { const k = `${name(el)} ${prop} ${v}`; offgrid[k] = (offgrid[k] || 0) + 1; };
  for (const el of main.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = parseFloat(cs[p]); if (!(v > 3) || Number.isNaN(v)) continue;
      if (Math.abs(v / 4 - Math.round(v / 4)) > 0.01) add(el, p, Math.round(v * 10) / 10);
    }
  }
  const targets = [];
  for (const el of document.querySelectorAll('.main a[href], .main button, .main input:not([type=hidden]), .main select, .main textarea, .main summary, .main [role=button], .topbar button, .topbar a, .tabbar a, .tabbar button')) {
    if (!vis(el) || el.closest('[hidden],[inert]')) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && /P|LI|SPAN|DIV|LABEL/.test(el.parentElement.tagName) && (el.parentElement.textContent || '').trim().length > (el.textContent || '').trim().length + 8) continue;
    if (el.type === 'checkbox' || el.type === 'radio') { const lab = el.closest('label'); if (lab && lab.getBoundingClientRect().height >= 44) continue; }
    if (el.closest('.ctile')) continue; // counter: the whole note tile is the tap target (tap = one more)
    if (r.height < 43.5 || r.width < 43.5) targets.push({ el: name(el), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
  }
  const fonts = {}; const tiny = [];
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
    const px = Math.round(parseFloat(getComputedStyle(n.parentElement).fontSize) * 10) / 10;
    fonts[px] = (fonts[px] || 0) + 1;
    if (px < 11) tiny.push({ el: name(n.parentElement), px, text: n.textContent.trim().slice(0, 20) });
  }
  const tb = document.querySelector('.topbar'), title = document.querySelector('.topbar .title');
  return {
    margin: left, contentWidth: right - left, edges, gaps, offgrid, targets, fonts, tiny: tiny.slice(0, 12),
    overflow: document.documentElement.scrollWidth - innerWidth,
    topbar: tb && vis(tb) ? { h: Math.round(tb.getBoundingClientRect().height), titleLeft: title ? Math.round(title.getBoundingClientRect().left) : null } : null,
  };
}

const b = await chromium.launch({ executablePath: EXE });
const ctx = await b.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => { try { localStorage.setItem('dk_start_done', '1'); localStorage.setItem('dk_perf', 'full'); localStorage.setItem('dk_style', s); } catch {} }, STYLE);
const page = await ctx.newPage();
await page.goto(BASE + '/');
await page.request.post(BASE + '/api/auth/login', { data: { email: 'ravi@sharma.in', password: 'RaviPass123' } });
const out = {};
for (const p of PAGES) {
  await page.goto(BASE + '/#/' + p); await page.waitForTimeout(1100);
  out[p] = await page.evaluate(audit);
}
await b.close();
if (process.env.JSON) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
let problems = 0;
for (const [p, r] of Object.entries(out)) {
  if (r.error) { console.log(`#/${p}: ${r.error}`); continue; }
  const og = Object.entries(r.offgrid).sort((a, b) => b[1] - a[1]);
  const gapList = r.gaps.map((g) => g.gap);
  problems += r.edges.length + og.length + r.targets.length + r.tiny.length + (r.overflow > 0 ? 1 : 0);
  console.log(`\n#/${p}  margin ${r.margin}  width ${r.contentWidth}  topbar ${r.topbar ? `${r.topbar.h}h title@${r.topbar.titleLeft}` : '-'}  overflow ${r.overflow}`);
  console.log(`  gaps: ${gapList.join(' ')}`);
  if (r.edges.length) console.log(`  edges: ${r.edges.map((e) => `${e.el}(${e.dl}/${e.dr})`).join('  ')}`);
  if (og.length) console.log(`  offgrid: ${og.slice(0, 14).map(([k, n]) => `${k}${n > 1 ? ` x${n}` : ''}`).join(' | ')}${og.length > 14 ? ` | +${og.length - 14} more` : ''}`);
  if (r.targets.length) console.log(`  small targets: ${r.targets.slice(0, 10).map((t) => `${t.el} "${t.text}" ${t.w}x${t.h}`).join(' | ')}${r.targets.length > 10 ? ` | +${r.targets.length - 10}` : ''}`);
  if (r.tiny.length) console.log(`  text under 11px: ${r.tiny.map((t) => `${t.el} ${t.px}px "${t.text}"`).join(' | ')}`);
  console.log(`  font sizes: ${Object.entries(r.fonts).sort((a, b) => +b[0] - +a[0]).map(([k, n]) => `${k}px x${n}`).join(', ')}`);
}
console.log(`\n${problems} items to look at`);
