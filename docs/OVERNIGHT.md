# Overnight run: 15 hourly slots (2026-10-31 20:30 IST → 2026-11-01 10:30 IST)

Every slot is a fresh, unattended Claude session. It does **one** slot, leaves `main` green and deployed, and updates the ledger at the bottom.
Nobody is awake to answer questions: decide, write the decision in the ledger note, move on.

## Rules for every slot

**Be frugal.** Read this file, the top 25 lines of `PROGRESS.md`, and only the files your slot touches (use `grep -n` and `sed -n` ranges, never dump big files). Reuse the recipes below. No exploratory rewrites. Finish in about 50 minutes; if you are running long, cut scope, keep `main` green, and write what is left over in the ledger.

**Bootstrap.**
1. If `/home/user/DailyKhata` does not exist: call `mcp__claude-code-remote__add_repo` (owner `adil9170`, repo `DailyKhata`, access `push`), run the clone command it returns, then `mcp__claude-code-remote__register_repo_root`.
2. `cd /home/user/DailyKhata && git checkout main && git pull --rebase origin main`. Read the ledger: another slot may still be finishing, so pull often and never discard its work (merge, don't overwrite). Never force-push.
3. `npm ci --silent` if `node_modules` is missing.

**Recipes.**
- Build client: `node scripts/build-client.mjs`. Types: `npx tsc --noEmit`. Unit tests: `npx vitest run`.
- Local server on a throwaway DB: `rm -rf /tmp/dk && mkdir /tmp/dk && npx wrangler d1 migrations apply DB --local --config wrangler.local.toml --persist-to /tmp/dk && (nohup npx wrangler dev --config wrangler.local.toml --port 8788 --persist-to /tmp/dk >/tmp/dk.log 2>&1 &)`. If `wrangler.local.toml` is missing run `./scripts/dev-local.sh` once (it generates it), then stop it. Wait for `curl -s localhost:8788/`. Then `./scripts/smoke-test.sh http://127.0.0.1:8788` (creates shop "Sharma Cold Drinks", login `ravi@sharma.in` / `RaviPass123`).
- Browser tests: Playwright with `executablePath: '/opt/pw-browsers/chromium'` (install `playwright` into a scratch dir with `npm i playwright`, not into the repo). Use `http://localhost:<port>` (not 127.0.0.1: the service worker needs localhost). Log in, set `localStorage.dk_start_done=1`.
- A shop that already has data: after the smoke test, POST `/api/c/bulk` entries so migrations and new features are tested against existing rows.

**Safety (production serves real users and every push to `main` auto-deploys).**
- Migrations are **additive only**: `CREATE TABLE/INDEX`, `ALTER TABLE ... ADD COLUMN` with a default. Never `DROP`, `RENAME`, `DELETE FROM`, or change existing columns. Test them on a fresh DB **and** on a DB that already has data.
- Do not change existing API behavior or response shapes; add alongside. Keep the local-first store (`public/js/store.js`, `localapi.js`) working: offline writes, outbox, reconcile by `client_id`.
- No secrets in the repo, logs or commits. Do not touch `wrangler.toml` routes/bindings, `.github/workflows/deploy.yml` or Cloudflare settings unless your slot says so.
- Any change under `public/` bumps `VERSION` in `public/sw.js` and keeps the precache list valid. The landing page is for signed-out visitors only; the signed-in app must be unaffected.
- Match the surrounding code style, comment density and naming. Money is integer paise. Hindi text uses Eczar/Palanquin (already loaded).
- Edge cases are the point of this run: for every feature test empty input, huge input, offline, double-tap, slow network, 360px phone, dark mode, Soft style, lite mode, Hindi text, and a shop that already has data.

**Definition of done for a slot.**
1. `tsc`, `vitest`, smoke test and the Playwright checks for your slot pass locally. Add tests for new logic.
2. Commit (follow the attribution lines in your own system reminder), `git push origin main`, then also `git push origin main:claude/daily-accounts-inventory-app-8gfhbd`.
3. `gh run watch <id> -R adil9170/DailyKhata --exit-status` until the deploy succeeds; then `curl` the live site (`https://jakcrew.com`) for what you changed.
4. If CI or the live check fails: fix forward within 20 minutes; otherwise `git revert` your commit(s), push, and mark the slot `reverted` with the reason.
5. Update your ledger row (status, commit, one-line note, leftovers) and add one line to the `PROGRESS.md` log. Push.
6. Final message: at most 8 lines (what shipped, what is left, anything needing the owner).

## Slot specs

**1 · Reader hardening** (`src/lib/dump.ts`, `src/lib/parser.ts`, `src/lib/ocr.ts` cleanDump). Build `test/dump.corpus.test.ts` with at least 150 realistic notes: English, Hinglish, Hindi script, WhatsApp-style run-ons, `1,500`, `1,50,000`, `1.5k`, `2 lakh`, `500/-`, `rs`, `₹`, Devanagari digits, dates and "kal/yesterday", times, phone numbers, percentages, totals/balances/opening/closing, refunds/returns, names with se/ne, udhaar both directions, stock units (box/peti/crate/dozen), `a + b` sums, typos and emoji, Urdu/Arabic characters, empty and whitespace-only. Measure accuracy; fix misses without regressions; print the accuracy in the ledger. Also: never throws (fuzz 2,000 random strings), 20,000-character input under 50 ms, no catastrophic regex backtracking (adversarial strings), and unit-test `cleanDump` with malformed AI output (strings for numbers, huge arrays, missing fields, wrong enums). Document known limits in `docs/READER.md`.

**2 · Landing: Hindi / English switch.** `public/js/landing-i18n.js` with a dictionary and `data-i18n` attributes in `public/index.html`. A visible EN | हिं switch in the nav, remembered in `localStorage.dk_lang`, default Hindi if `navigator.language` starts with `hi`. Natural, short Hindi (not literal translation); the demo placeholder, sample buttons, steps, FAQ, finale, screenshot alt texts, and `<html lang>` all switch. No layout break at 320px with longer Devanagari strings; no flash of the wrong language; English stays default otherwise; the typing demo and "becomes" rotation keep working. A vitest check that every key used in `index.html` exists in both languages.

**3 · Landing: get-started CTA and a "say it" mic.** `public/js/site-config.js` exports `{ whatsapp: '', price_line: '' }` (the owner fills these later; never invent a number or price). Add a clear "Get your shop set up" button in the hero and nav: if `whatsapp` is set, a `wa.me` link with a prefilled message, otherwise `https://adilshaikh.in`; show `price_line` only if set. Add a mic button on the hero writing box (Web Speech API; `en-IN`, or `hi-IN` when the page is Hindi): hide it if unsupported; handle permission denied, no network, no speech heard, stop on blur and on tap, interim results, length cap, double-tap; stop the auto-typing demo when used; short privacy note ("your browser's speech service listens"). iOS Safari needs a user gesture.

**4 · Landing: screenshots and scroll section.** Re-shoot the five app screens from one consistent story (shop "Sharma Cold Drinks"; the numbers must match the strip: opening cash 3,303; Sting −1,020; Gas −820; Tea −60; Mehta udhaar +230; cash sales 6,290; drawer 7,693; bill number consistent). Export 2x WebP under 40 KB each, with `width`/`height`, lazy loading, alt text. Shorten the scroll section (`min-height` about 62vh), raise the contrast of inactive steps to at least AA, make the phone drawer bar show the step name, keep `prefers-reduced-motion` and the no-IntersectionObserver fallback. Check 360×640, 390×844, 412×915, 640×360 landscape, 820×1180, 1366×768, 1920×1080 and 200% zoom.

**5 · SEO and sharing.** `public/og.png` 1200×630 (generate with Playwright from a small HTML card: logo, the headline, the strip; under 150 KB); absolute `og:image`, `twitter:card=summary_large_image`; `public/sitemap.xml`, `public/robots.txt` (allow `/`, disallow `/api/`); JSON-LD `SoftwareApplication` (no ratings or invented numbers) and `FAQPage` matching the visible FAQ exactly. Generate `public/hi/index.html` in `scripts/build-client.mjs` (same page, `lang="hi"`, Hindi title and description, canonical, `hreflang` pair both ways) and check `/hi` and `/hi/` both serve with the current assets config. In `src/index.ts` add a `www.` → apex 301 redirect keyed on the Host header (code only; do not touch routes). Unit-test the redirect; verify `/api/*`, the signed-in app and `/` for signed-in users are unaffected.

**6 · Performance.** Measure the landing and the app shell after login with Playwright + CDP (Slow 4G, 4× CPU): FCP, LCP, CLS, TBT, bytes. Targets: landing first load at most 250 KB transferred (excluding lazy images), LCP at most 2.5 s, CLS under 0.05. Levers: `size-adjust` fallback fonts to avoid layout shift, preload only the faces used above the fold, keep Devanagari faces out of the service-worker precache, image dimensions, defer non-critical JS, cache headers. Do not regress offline start (test: load, go offline, reload). Record before/after numbers in `PROGRESS.md`.

**7 · Bills: server and sync.** Migration `0004_bills.sql` (additive): `bills` (company_id, client_id unique per company, series, bill_no, customer, phone, items_json, subtotal_paise, discount_paise, total_paise, pay_mode, collection_client_id, entry_date, voided, created_by, timestamps; unique `(company_id, series, bill_no)`) and `bill_counters`; sync-log triggers like `migrations/0003_sync_triggers.sql`; add to `SYNC_TABLES` and `store.js` `TABLES`; backup/restore includes it. API: idempotent `POST /api/c/bills` (by `client_id`), list/search (`q`, dates, customer, limit/offset), get, void, and `POST /api/c/bills/reserve {n}` that atomically hands a device a block of numbers. Offline: a device uses its reserved block; if exhausted offline it uses a provisional per-device series (`P`) that stays unique. `localapi.js` supports the routes (local-first write, outbox, reconcile by `client_id`). Wire `public/js/pages/bill.js` to save a bill record and use shared numbering. Validate sizes (at most 100 items), amounts, phone, permissions, audit log. Tests: numbering races, duplicate retries, block exhaustion, migration on fresh and on populated DB, smoke-test additions.

**8 · Bills: history, reprint, reminders.** `#/bills`: list with search (name, phone, bill number, date) and filters (all, udhaar due, paid, voided); detail sheet with reprint/share (reuse `receipt.js` with the stored items) and WhatsApp send; "Mark paid" for udhaar bills (records a customer payment so the udhaar list updates); "Void" with confirm (voids the bill and its linked sale; handle the sale already deleted); udhaar reminder on WhatsApp (needs a valid phone: default `+91` for 10 digits, ask for a phone if missing; properly encoded text with the shop name, bill number and amount). Customer outstanding totals link to the udhaar list. Add to menu and Home. Edge cases: 1,000+ bills (paginate, load more), zero-total, discount larger than subtotal, odd characters in names, offline, bills made before this feature (not listed, no crash), Hindi labels fall back to English.

**9 · App identity: the strip.** Bring the landing's receipt strip into the app: Today's khata shows entries as a printed strip (dotted leaders, in green, out ink, udhaar muted) with the In/Out/cash tally at the bottom, using shared CSS tokens in `app.css`. "Close the day" becomes the tally moment: expected vs counted, calm "Books match ✓" or "Short by ₹X". Keep every capability (tap to edit, delete, add), keyboard access, `#/day?add=...` deep links, Simple/Standard/Pro, Clean/Soft, dark, lite, offline. Performance with 500 entries (animate only the first 30). Empty state, very long names, one-day-only data.

**10 · App Hindi.** `public/js/i18n.js` with `t(key, english)`; language chooser in Settings (English / हिंदी), default from `localStorage.dk_lang`, then `navigator.language`. Translate the Simple-mode surfaces: menu, + sheet, Home/quick add, Today's khata labels, counter, bill, chat greeting and replies, Write expenses, bills list, settings basics, toasts for those flows. Short natural Hindi (बिक्री, खर्चा, माल, उधार, नकद, हिसाब). Dates via `Intl` `hi-IN`; amount-in-words follows the language. Missing keys fall back to English; no overflow at 360px (tab bar labels!); `lang` attribute set. A vitest check for key completeness. Leave admin/Pro-only screens in English.

**11 · Chat v2.** Scroll up to load earlier days; tap an entry bubble to edit or delete (reuse existing forms/sheets); undo history survives reload for the day; IME-safe sending (do not send on Enter while composing Hindi); duplicate guard (same text within 5 s asks to confirm); length cap; offline works; voice hardened like slot 3 and uses the app language; more questions answered: "kal ka total", "yesterday", "kitna udhaar", "<name> ka hisaab"; focus and scroll behaviour after send; `aria-live`.

**12 · Palette, logo files, contrast.** Share the landing tokens (ink, oat, brick, gold, night) in `app.css`; keep the green mark but align its green with the palette and check it at 16, 32, 180 px. Add real **PNG icons** (192, 512, maskable 512 with safe zone, `apple-touch-icon` 180 PNG; iOS ignores SVG) and use them in `manifest.webmanifest` and `index.html`; keep `brandicon.js` working for company logos. Run an automated WCAG contrast check (Playwright computed styles) over key pages in Clean/Soft × light/dark and fix to AA (4.5:1 text, 3:1 UI), especially Soft and the landing muted text. Record results.

**13 · Accessibility and low-end phones.** Emulate a low-end Android (4× CPU, 360×640, Slow 4G, `deviceMemory` 2: lite mode must turn on); check typing latency in Write expenses and Chat and fix jank. Accessibility: labels and names, focus order and trapping in modals/sheets, Escape and focus return, live regions for toasts, touch targets at least 44 px, 200% zoom and 130% text size without overflow, 640×360 landscape, `prefers-reduced-motion`, forced colors, keyboard-only through landing, login and the main flows. Add `scripts/a11y-check.mjs` (axe-core, run locally). Fix what it finds.

**14 · Security and operations.** Scan the working tree and git history for secrets (patterns for API keys and tokens); report counts only, never print values. CSP review. Login rate limit (D1 counter per IP+email, generous: 10 failures per 10 minutes then 429, reset on success, never locks out permanently, must not break the smoke test). `scripts/reset-superadmin.mjs` (uses `src/lib/crypto.ts` hashing; prints the `wrangler d1 execute` command, supports `--local`/`--remote`) and a SQL snippet to list super-admin emails. `GET /api/health` (no auth; returns ok and the build id). CI: a step that fails if a new migration contains `DROP`, `RENAME`, or `DELETE FROM`. `docs/OPERATIONS.md`: rollback (`wrangler rollback`), D1 Time Travel restore, restoring a nightly backup, a preview-deploy recipe, and an owner checklist to rotate the Cloudflare token and Gemini key (the old ones were pasted in chat). Do not change deploy behavior.

**15 · Final audit and report.** Pull everything. Run `tsc`, `vitest`, the smoke test on a fresh DB and on a populated DB after all migrations, and a Playwright matrix: every route × Simple/Standard/Pro × light/dark × Clean/Soft × widths 360/390/412/820/1366, checking no horizontal overflow, no error toasts, no console errors, no empty pages. Also: offline reload, signed-out landing (EN and Hindi), signed-in redirect, bills end to end, chat, counter. Live checks on `https://jakcrew.com` (landing, `/hi`, `sitemap.xml`, `og.png`, `/api/health`). Fix small leftovers. Write `docs/OVERNIGHT-REPORT.md`: per-slot status and commit, measured numbers (reader accuracy, performance before/after, contrast), what is left, known risks, and the owner-only list below. Budget 40 minutes.

## Owner-only (cannot be done by a session)
Real shopkeeper testing (10 real notes and a real bill photo through the live AI); real photos, a short video or a pilot shop as proof; brand imagery and any logo redesign decision; the WhatsApp number and price line in `public/js/site-config.js`; adding `www.jakcrew.com` as a custom domain in Cloudflare; rotating the Cloudflare token and Gemini key; trying voice on real phones.

## Ledger (each slot updates its own row)
| Slot | Planned start (IST) | Status | Commit | Note |
|---|---|---|---|---|
| 1 Reader hardening | 20:30 | pending | | |
| 2 Landing Hindi switch | 21:30 | pending | | |
| 3 Landing CTA + mic | 22:30 | pending | | |
| 4 Landing screenshots + scroll | 23:30 | pending | | |
| 5 SEO + sharing + www redirect | 00:30 | pending | | |
| 6 Performance | 01:30 | pending | | |
| 7 Bills server | 02:30 | pending | | |
| 8 Bills UI | 03:30 | pending | | |
| 9 Strip in the app | 04:30 | pending | | |
| 10 App Hindi | 05:30 | pending | | |
| 11 Chat v2 | 06:30 | pending | | |
| 12 Palette, icons, contrast | 07:30 | pending | | |
| 13 A11y + low-end | 08:30 | pending | | |
| 14 Security + ops | 09:30 | pending | | |
| 15 Final audit + report | 10:30 | pending | | |
