# DailyKhata — progress log (read this first after any interruption)

Update this file at the end of every work step. Newest entries at the top of "Log".

## Quick facts
- Repo: https://github.com/adil9170/DailyKhata (`main` = deployed code; branch `claude/daily-accounts-inventory-app-8gfhbd` mirrors it)
- Live: https://dailykhata.adilshaikh.workers.dev  (Cloudflare account `ece0e93a89a4c641a032eea0f0cdf5aa`)
- Stack: Cloudflare Worker (Hono) + D1 `dailykhata-db` + R2 `dailykhata-files` + Workers AI; SPA in `public/` (vanilla JS, no build)
- Local path: `C:\Users\Asif Shaikh\Downloads\novus\claude\adil\daily-khata\DailyKhata`
- Deploy by hand: `npx wrangler deploy` (secrets persist). Full: `SETUP_TOKEN=... ./scripts/provision.sh --deploy`
- Git push from this machine needs gh credential helper:
  `git -c credential.helper= -c "credential.helper=!'/c/Program Files/GitHub CLI/gh.exe' auth git-credential" push origin HEAD:main`
- Checks: `npm run typecheck && npm test`
- Setup token (first super-admin signup) is stored as the Worker secret `SETUP_TOKEN`; the user has the value.
- No Python on this machine; use Node/bash/Edit tool for scripted edits.

## Product direction (from the owner)
- Paying customers (small shops, many first-time app users) => UI must feel premium and be dead simple on phones.
- Three experience modes so newbies are not overwhelmed: **Layman** (simplest), **Smart** (default-ish), **Nerdy** (everything).
- A **Quick** entry path a newbie can use in seconds.
- Optional logo upload that auto-derives the store's brand colours (must remain optional).
- UI brief (from owner screenshot): "mobile friendly, dark mode, super easy UX, inspiration: Stripe, Apple, NASA, yolk.coach, premium quality". Owner tests on Galaxy S24 Ultra, iPhone 17 Pro, Redmi 11. UX must be the USP.
- Original UI instructions lived in the cloud session "Daily Accounts & Inventory Management App" and are NOT available here; ask the owner if unsure.

## Optional/pending
- `GEMINI_API_KEY` Worker secret IS set (model alias `gemini-flash-latest`; `gemini-2.5-flash` was retired). The key was pasted in chat, so recommend rotating it in Google AI Studio and re-running `npx wrangler secret put GEMINI_API_KEY`.
- GitHub Actions secrets (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, SETUP_TOKEN) not set => the deploy job on `main` fails; manual deploy works.
- Super-admin account: owner must create it at the live URL.

## Log
- 2026-10-17 Premium redesign + device adaptation + speed:
  - `public/css/app.css` fully rewritten: self-hosted Inter (public/fonts), floating glass tab bar, 28px hero, tracked-caps data labels, soft shadows, dark/light. Brand tints are precomputed CSS vars (`tints()` in color.js, set in api.js applyBranding) - no color-mix (old MIUI browsers).
  - `public/js/device.js`: sets data-size (xs/s/m/l/tablet/desktop), data-os, data-input, .kb (keyboard open hides tab bar), Android haptics. Touch targets 48-50px on touch devices.
  - Speed: pages lazy-loaded (app.js `lazy()`), Chart.js loaded only on dashboard, modulepreload + font preload, service worker (public/sw.js, network-first, never caches /api), view transitions, count-up on hero number, draggable bottom sheets.
  - Test matrix: scratchpad matrix.mjs (puppeteer-core + Edge) at 360/393/402/412/820 widths x 3 modes x all pages: no horizontal overflow, no tap target under 36px. Re-run after any UI change.
- 2026-10-17 UI/UX pass (this entry = what changed + where):
  - Modes: `public/js/mode.js` (Layman / Smart / Nerdy, saved per user in localStorage `dk_mode_<userId>`; first-login picker; chip in top bar; Settings > Experience). Route visibility is the `modes` array in `public/js/app.js` `companyRoutes`. CSS helpers: `.smart-up` (hidden in Layman), `.nerd-only` (Nerdy only).
  - Quick add: `public/js/pages/quick.js` (#/quick) = Home in Layman; big amount + Sale / Bought stock / Expense; PWA shortcut in manifest. Uses existing POST /api/c/collections|expenses|purchases.
  - Logo -> brand colours: `public/js/color.js` (canvas, runs in browser), wired in `pages/settings.js`. Fully optional; "Reset colours" and "Remove logo" exist. `--on-brand` is now computed so text stays readable on light brand colours (api.js applyBranding).
  - Mobile bug fixed: dashboard was 571px wide on a 390px phone (grid track overflow) -> `.noprint` grid + overflow guards at end of app.css. Re-check with the puppeteer overflow script if new pages are added.
  - Quick add Save button is sticky above the tab bar on phones.
  - Known gap: new product bought through Quick add gets pieces=1 until its pieces-per-unit is set in Products.
  - How I tested: local `./scripts/dev-local.sh` + `./scripts/smoke-test.sh` seed (login ravi@sharma.in / RaviPass123), headless Edge via puppeteer-core at 390x844.
- 2026-10-17 Deployed to Cloudflare, added Gemini OCR fallback (commit a2548b3), pushed main.
- 2026-10-17 Imported cloud-session bundle into repo, pushed branch, created `main`.

## Cash counter, smart notes, receipt sharing
- Added `pages/counter.js`, `pages/notes.js`, `receipt.js`, pure libs `words.ts` and `notescalc.ts` (unit-tested). Reachable from Quick add tiles, the + sheet and the menu.
- `npm run deploy` now applies remote D1 migrations first (0002/0003 are required by the local-first sync).
