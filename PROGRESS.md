# DailyKhata — progress log (read this first after any interruption)

Update this file at the end of every work step. Newest entries at the top of "Log".

## Quick facts
- Repo: https://github.com/adil9170/DailyKhata (`main` = deployed code; branch `claude/daily-accounts-inventory-app-8gfhbd` mirrors it)
- Live: https://dailykhata.adilshaikh.workers.dev  (Cloudflare account `ece0e93a89a4c641a032eea0f0cdf5aa`)
- Stack: Cloudflare Worker (Hono) + D1 `dailykhata-db` + R2 `dailykhata-files` + Workers AI; SPA source in `public/js` (vanilla JS), bundled by esbuild via `scripts/build-client.mjs` into git-ignored `public/dist` (runs automatically before wrangler dev/deploy); local-first data in IndexedDB (store.js/localapi.js)
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
- Ideas not started: Hindi (and Hinglish) labels for Layman mode; load test with thousands of entries; test on real Redmi/iPhone/Galaxy; rotate the Cloudflare API token + Gemini key that were pasted in chat.
- `GEMINI_API_KEY` Worker secret IS set (default model gemini-3.1-flash-lite, backup gemini-flash-latest; override with GEMINI_MODEL; gemini-2.5-flash is retired). The key was pasted in chat, so recommend rotating it in Google AI Studio and re-running `npx wrangler secret put GEMINI_API_KEY`.
- Auto-deploy: DONE 2026-10-19. Every push to `main` runs tests then deploys (GitHub Actions secrets CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID are set; token has Workers Scripts/D1 Edit, R2 Read). The token was pasted in chat; rotate it in Cloudflare and re-run `gh secret set CLOUDFLARE_API_TOKEN -R adil9170/DailyKhata` (pipe the value on stdin).
- Super-admin account: owner must create it at the live URL.

## Log
- 2026-10-26 Cash counter gets the bottom tab-bar slot next to the + button in every mode (was Photos in Smart/Nerdy, Settings in Layman; both still in More) and is the first item in the + sheet. Receipts: no watermark; share text has total + date/time; company logo = tab/home-screen/install icon (public/js/brandicon.js, CSP manifest-src blob:). Counter tiles: one big +, minus appears once counted, note-coloured badges.
- 2026-10-19 Fixed sync chip in the menu stretching into a tall arch: its class was `side`, colliding with the sidebar `.side` rules; now `sync-side`/`sync-bar` (app.js paintChip + app.css). Lesson: never give a small component a generic class name like side/bar/card without checking app.css.
- 2026-10-19 Perf measured on live site (slow-4G + 4x CPU throttle, sign-in page): first visit FCP 1.3 s, usable 2.6 s, 173 KB / 11 requests; repeat visit 1.0 s, 0 KB. Entry bundle 19 KB, pages/charts lazy. NOT yet measured: post-login screens with thousands of entries (idea: load-test with fake data), Lighthouse, real devices.
- 2026-10-19 OCR tested on a real handwritten Hindi-store bill (Shri Krishna Store; lines 2450/760/88, total 3298): amounts all correct. Default Gemini model is now gemini-3.1-flash-lite (2.5 s) with gemini-flash-latest as backup (was 30-70 s). GEMINI_MODEL env var forces a model. Missing qty/unit no longer produce "null" in lines. Item names on messy handwriting can still be wrong (e.g. second Maida line may be qty 10 not 20) - the review screen is where the owner confirms.
- 2026-10-19 Simplicity pass: cash counter rewritten as a no-scroll 3x3 grid (500/200/100/50/20/10 notes + 5/2/1 coins, old loose-change box migrates into the 1-rupee coins; page height fitted in JS fitToScreen). Quick page gets a slim first-time hint (dk_start_done flag). Test matrix now also fails on error toasts / empty pages (an earlier edit once broke Quick add unnoticed).
- 2026-10-19 Pulled cloud-session work (local-first sync, bundling, cash counter, notes calculator, receipts), fixed build-client.mjs for paths with spaces, merged to main, deployed, enabled auto-deploy on push to main.
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
