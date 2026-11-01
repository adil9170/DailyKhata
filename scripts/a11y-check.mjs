// Accessibility + low-end phone audit (run locally, not in CI).
// Usage: BASE=http://localhost:8788 AXE=/path/to/axe.min.js node scripts/a11y-check.mjs
// Needs `playwright` and `axe-core` installed outside the repo (npm i playwright axe-core in a scratch dir, NODE_PATH to it),
// and a shop from scripts/smoke-test.sh (ravi@sharma.in / RaviPass123).
// Emulates a low-end Android (360x640, touch, 4x CPU, Slow 4G, deviceMemory 2 so lite mode must turn on), then checks:
//   axe-core (WCAG 2.1 A/AA) on the landing (EN/HI) and the main app pages, touch targets >= 44 px on the app,
//   horizontal overflow at 360 px, at 200% zoom (180 px CSS width is unrealistic; we use 320 px) and 130% text,
//   640x360 landscape, forced colors, reduced motion, Escape + focus return on sheets, toast live region.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:8788';
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium';
const require = createRequire(import.meta.url);
const AXE = readFileSync(process.env.AXE || require.resolve('axe-core/axe.min.js'), 'utf8');
const APP = ['quick', 'day', 'chat', 'bill', 'bills', 'dump', 'counter', 'dashboard', 'ledger', 'products', 'settings'];
const LAND = ['/', '/hi/'];
const problems = [];
const bad = (where, what) => problems.push(`${where}: ${what}`);

const b = await chromium.launch({ executablePath: EXE });
async function ctxFor(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, ...opts });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
    try { localStorage.setItem('dk_start_done', '1'); } catch {}
  });
  return ctx;
}
async function throttle(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
  return cdp;
}
const settle = (page, ms = 1200) => page.waitForTimeout(ms);
const overflow = (page) => page.evaluate(() => {
  const w = document.documentElement.clientWidth; const o = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || cs.position === 'fixed' || el.closest('[hidden]') || cs.display === 'none') continue;
    if (r.right > w + 1 && !el.closest('.scroll-x, .tabs, table, pre, .lp-tape, .lp-marquee, .chatquick')) { o.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 24)); if (o.length > 3) break; }
  }
  return { scrollW: document.documentElement.scrollWidth, w, over: o };
});
async function axe(page, where) {
  await page.evaluate(AXE);
  const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
  for (const v of r.violations) bad(where, `axe ${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].target.join(' ')} — ${v.help}`);
}
async function targets(page, where) {
  const small = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], summary')) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden],[inert]') || el.disabled) continue;
      if (r.bottom < 0 || r.top > innerHeight * 4) continue;
      if (el.matches('input[type=checkbox],input[type=radio]') && el.closest('label')) { const l = el.closest('label').getBoundingClientRect(); if (l.width >= 44 && l.height >= 44) continue; }
      if (el.closest('.sr-only, .visually-hidden')) continue;
      if (cs.display === 'inline' && el.tagName === 'A') continue; // inline links in running text (WCAG 2.5.8 exception)
      if (el.matches('.cplus, .cminus, .cqty')) continue; // counter: the whole tile steps too, and the grid must fit a 640 px screen
      if (r.width < 44 || r.height < 44) out.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : '') + ` ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}"`);
    }
    return [...new Set(out)];
  });
  if (small.length) bad(where, `touch targets <44px (${small.length}): ${small.slice(0, 6).join(' | ')}`);
}

// 1) low-end emulation: lite mode turns on, landing + app audit
{
  const ctx = await ctxFor(); const page = await ctx.newPage(); await throttle(page);
  for (const p of LAND) {
    await page.goto(BASE + p); await settle(page, 2000);
    if (!(await page.evaluate(() => document.documentElement.classList.contains('lite')))) bad('lite', 'deviceMemory 2 did not turn on lite mode on ' + p);
    await axe(page, 'landing ' + p);
    const o = await overflow(page); if (o.scrollW > o.w + 1 || o.over.length) bad('landing ' + p + ' 360', `overflow ${o.scrollW}>${o.w} ${o.over.join(',')}`);
  }
  await ctx.close();
}
{
  const ctx = await ctxFor(); const page = await ctx.newPage();
  await page.request.post(BASE + '/api/auth/login', { data: { email: 'ravi@sharma.in', password: 'RaviPass123' } });
  await throttle(page);
  for (const p of APP) {
    await page.goto(BASE + '/#/' + p); await settle(page, 1800);
    if (p === 'quick' && !(await page.evaluate(() => document.documentElement.classList.contains('lite')))) bad('lite', 'app did not enter lite mode');
    await axe(page, '#/' + p); await targets(page, '#/' + p);
    const o = await overflow(page); if (o.scrollW > o.w + 1 || o.over.length) bad('#/' + p + ' 360', `overflow ${o.scrollW}>${o.w} ${o.over.join(',')}`);
  }
  // typing latency: input event -> next frame, on the throttled phone
  for (const p of ['quick', 'chat']) {
    await page.goto(BASE + '/#/' + p); await settle(page, 1500);
    const sel = 'textarea:visible, input[type=text]:visible, input:not([type]):visible';
    const el = page.locator(sel).first(); if (!(await el.count())) { bad('typing #/' + p, 'no visible text field found'); continue; }
    await el.click();
    const ms = await page.evaluate(async () => {
      const f = document.activeElement; const t = [];
      for (let i = 0; i < 25; i++) {
        const s = performance.now();
        f.value += 'a'; f.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'a', inputType: 'insertText' }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        t.push(performance.now() - s);
      }
      t.sort((a, b) => a - b); return { med: Math.round(t[12]), p95: Math.round(t[23]) };
    });
    console.log(`typing #/${p}: median ${ms.med} ms, p95 ${ms.p95} ms (4x CPU)`);
    if (ms.p95 > 100) bad('typing #/' + p, `p95 ${ms.p95} ms > 100`);
  }
  await ctx.close();
}

// 2) zoom / text size / landscape / reduced motion / forced colors on the app (no throttling needed)
async function appPage(opts, extra) {
  const ctx = await ctxFor(opts); const page = await ctx.newPage();
  await page.request.post(BASE + '/api/auth/login', { data: { email: 'ravi@sharma.in', password: 'RaviPass123' } });
  if (extra) await extra(page);
  return { ctx, page };
}
for (const [name, opts, extra] of [
  ['200% zoom (320 css px)', { viewport: { width: 320, height: 568 } }],
  ['640x360 landscape', { viewport: { width: 640, height: 360 } }],
  ['130% text', {}, async (p) => p.addInitScript(() => addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '130%'; }))],
  ['forced colors', { forcedColors: 'active' }],
  ['reduced motion', { reducedMotion: 'reduce' }],
]) {
  const { ctx, page } = await appPage(opts, extra);
  for (const p of ['quick', 'day', 'chat', 'bill', 'bills', 'settings']) {
    await page.goto(BASE + '/#/' + p); await settle(page, 1200);
    const o = await overflow(page); if (o.scrollW > o.w + 1 || o.over.length) bad(`${name} #/${p}`, `overflow ${o.scrollW}>${o.w} ${o.over.join(',')}`);
  }
  if (name === 'reduced motion') {
    const anim = await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => { const c = getComputedStyle(e); return c.animationName !== 'none' && parseFloat(c.animationDuration) > 0.05 && c.animationIterationCount === 'infinite'; }).length);
    if (anim) bad('reduced motion', anim + ' elements still run infinite animations');
  }
  await ctx.close();
}

// 3) dialogs: Escape closes, focus returns to the opener, toasts are a live region
{
  const { ctx, page } = await appPage({}); await page.goto(BASE + '/#/quick'); await settle(page, 1500);
  const live = await page.evaluate(() => { const t = document.getElementById('toasts'); return t && (t.getAttribute('aria-live') || t.getAttribute('role')); });
  if (!live) bad('toasts', 'container has no aria-live / role');
  const fab = page.locator('.fab, [aria-label*="Add" i], [data-add]').first();
  if (await fab.count()) {
    await fab.focus(); await fab.press('Enter'); await settle(page, 600);
    const dlg = await page.evaluate(() => { const d = document.querySelector('[role=dialog], dialog[open], .sheet.open, .sheet:not([hidden])'); return d ? { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') } : null; });
    if (!dlg) bad('sheet', 'opening + did not show a recognizable dialog/sheet');
    else {
      if (dlg.role !== 'dialog' && dlg.role !== null) bad('sheet', 'role=' + dlg.role);
      if (!dlg.label) bad('sheet', 'dialog has no accessible name');
      const inside = []; for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); inside.push(await page.evaluate(() => !!document.activeElement.closest('[role=dialog], dialog[open], .sheet'))); }
      if (inside.includes(false)) bad('sheet', 'Tab leaves the open sheet (focus not trapped)');
      await page.keyboard.press('Escape'); await settle(page, 500);
      const still = await page.evaluate(() => !!document.querySelector('[role=dialog], dialog[open], .sheet.open'));
      if (still) bad('sheet', 'Escape does not close it');
      const back = await page.evaluate(() => document.activeElement && (document.activeElement.className + ' ' + (document.activeElement.getAttribute('aria-label') || '')));
      console.log('focus after Escape:', back);
      if (!/fab|add/i.test(back || '')) bad('sheet', 'focus not returned to the opener (' + back + ')');
    }
  } else bad('sheet', 'no add button found to test dialogs');
  await ctx.close();
}

await b.close();
console.log(problems.length ? `${problems.length} problem(s):\n` + problems.map((p) => ' - ' + p).join('\n') : 'a11y check passed');
process.exitCode = problems.length ? 1 : 0;
