// Renders public/og.png (1200x630 share card) from a small HTML card. Run locally: node scripts/make-og.mjs
// Needs Playwright (not a repo dependency): `require('playwright')` from a scratch install, Chromium at /opt/pw-browsers/chromium if present.
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(process.env.PW_DIR ? process.env.PW_DIR + '/' : import.meta.url);
const { chromium } = require('playwright');
const font = (f) => 'file://' + root + 'public/fonts/' + f;
const logo = readFileSync(root + 'public/logo.svg', 'utf8');

// the strip is the same one-day story as the landing page (Sharma Cold Drinks)
const rows = [['Opening cash', '3,303', ''], ['Cash sales', '+ 6,290', 'in'], ['Sting', '− 1,020', 'out'], ['Gas', '− 820', 'out'], ['Tea', '− 60', 'out'], ['Mehta udhaar', '230', 'ud']];
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Eczar;src:url(${font('eczar-latin-400.woff2')});font-weight:400}
@font-face{font-family:EczarD;src:url(${font('eczar-deva-400.woff2')});font-weight:400}
@font-face{font-family:Pal;src:url(${font('palanquin-latin-700.woff2')});font-weight:700}
@font-face{font-family:Pal;src:url(${font('palanquin-latin-400.woff2')});font-weight:400}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f1ebdd;font-family:Pal,sans-serif;color:#1c1a2b;display:flex;align-items:center;padding:0 72px;gap:56px;overflow:hidden}
.l{flex:1}.logo{width:76px;height:76px;margin-bottom:34px}.logo svg{width:100%;height:100%}
h1{font-family:Eczar,serif;font-weight:400;font-size:84px;line-height:1.02;letter-spacing:-1px}
h1 b{display:block;font-family:EczarD,Eczar,serif;font-weight:400;color:#a9372d;font-size:70px;margin-top:10px}
p{margin-top:28px;font-size:28px;color:#4f4b63;line-height:1.35}
.n{margin-top:34px;font-size:26px;font-weight:700;letter-spacing:.3px}
.s{width:400px;background:#fbf8f0;border:2px solid #d9d0ba;border-radius:6px;padding:30px 30px 24px;box-shadow:0 18px 40px rgba(28,26,43,.14);transform:rotate(2deg)}
.s h3{font-size:19px;letter-spacing:2px;text-transform:uppercase;color:#6f6a80;font-weight:700;margin-bottom:14px}
.r{display:flex;align-items:baseline;gap:8px;font-size:25px;padding:7px 0}.r i{flex:1;border-bottom:3px dotted #cfc6ad;transform:translateY(-5px)}
.in b{color:#2e6f4f}.out b{color:#1c1a2b}.ud{color:#6f6a80}.r b{font-weight:700}
.t{margin-top:16px;border-top:3px double #1c1a2b;padding-top:14px;display:flex;justify-content:space-between;font-size:26px;font-weight:700}
</style><div class="l"><div class="logo">${logo}</div><h1>Just write it down.<b>हिसाब हम कर लेंगे।</b></h1><p>Type or say it. DailyKhata keeps the shop khata.</p><div class="n">jakcrew.com</div></div>
<div class="s"><h3>Sharma Cold Drinks</h3>${rows.map(([a, v, c]) => `<div class="r ${c}">${a}<i></i><b>${v}</b></div>`).join('')}<div class="t"><span>In the drawer</span><span>7,693</span></div></div>`;

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: root + 'public/og.png' });
await browser.close();
console.log('og.png', (statSync(root + 'public/og.png').size / 1024).toFixed(1) + ' KB');
