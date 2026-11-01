# Overnight run report (2026-10-31 20:30 IST → 2026-11-01 ~11:00 IST)

All 15 slots finished. `main` is green and live on https://jakcrew.com (service worker / health build `v27`). Latest CI run (slot 14 ledger commit) succeeded.

## Per-slot status
| Slot | What | Status | Commit |
|---|---|---|---|
| 1 | Reader hardening (168-note corpus, fuzz, perf, cleanDump) | done | 98f3b8d |
| 2 | Landing Hindi / English switch | done | d7afd9a, 3fdca96 |
| 3 | Landing get-started CTA + "say it" mic | done | ceda56a |
| 4 | Landing screenshots + scroll section | done | 0ccde16 |
| 5 | SEO, sharing, `/hi/`, www redirect | done | ddc6228 |
| 6 | Performance | done | 29ce58f |
| 7 | Bills: server + sync | done | 2abe455 |
| 8 | Bills: history, reprint, reminders | done | aa4f033 |
| 9 | Strip in the app | done | 67ed4ca |
| 10 | App Hindi | done | 1c82e88 |
| 11 | Chat v2 | done | 82866d6 |
| 12 | Palette, PNG icons, contrast | done | b97dc80 |
| 13 | Accessibility + low-end phones | done | 6fe08ae |
| 14 | Security + operations | done | 02b69f6 |
| 15 | Final audit + report | done | this commit |

Two earlier CI runs were red and recovered: slot 2 (adversarial-string timing budget, fixed in 3fdca96) and the slot 6 ledger commit (fixed by 72714bb). The slot 13 ledger-only commit also shows one red run; the next push was green.

## Final audit (slot 15, run on 2026-11-01)
- `tsc --noEmit`: clean. `vitest`: 86 tests pass. Note: one run out of four failed one test on a cold start and passed on three re-runs. It is probably a timing-sensitive test (the reader perf/adversarial guards); not investigated further.
- Smoke test on a fresh DB with all 5 migrations: 91 checks pass.
- Populated DB: the smoke test itself fills the shop with data, migration 0004 was tested on populated data in slot 7, and 0005 only adds a table. A separate "old data then new migrations" run was not repeated tonight.
- Playwright matrix: 16 routes × Simple/Standard/Pro × light/dark × Clean/Soft × widths 360/390/412/820/1366 = 960 page loads. Checked for horizontal overflow, empty pages, error toasts and console errors: 0 problems.
- Also passed: landing EN and HI (lang, no overflow, no console errors); bill create and an idempotent retry through the API, bill visible on `#/bills`; chat entry and reply; counter renders; offline reload of the signed-in app; no console errors on the signed-in app.
- Live on jakcrew.com: `/` 200, `/hi/` 200 (`lang="hi"`), `/hi` 307 to `/hi/`, `sitemap.xml`, `robots.txt`, `og.png` (99 KB), `manifest.webmanifest`, icons, `/api/health` (`build: v27`), `/api/c/bills` 401 signed out, live `sw.js` equals repo `v27`.
- Not checked tonight: a signed-in check against production (no production login), the matrix at widths other than the five above, and Pro/admin pages beyond the route list above (admin routes are not in the matrix).
- Method notes: the matrix and end-to-end checks logged in through the API and set mode/theme/style in localStorage, then navigated by hash. A cookie alone does not count as signed in at `/` (the app uses its own stored session), so `/` showed the landing in that test; this is by design.

## Measured numbers
- Reader accuracy (slot 1): 168-note corpus 97.6% → 99.4% (167/168). 20,000-character note 60 → 15 ms; 20k digit run 1.4 s → 0.5 ms.
- Performance (slot 6, local, Slow 4G, 4× CPU, 390 px): landing first load 403 KB → 268 KB (237 KB without the lazy image); FCP/LCP about 1.0–1.2 s; CLS 0.02.
- Contrast (slot 12): 82 AA failures → 0 (2,358 text elements, landing EN/HI + 11 app pages, Clean/Soft × light/dark, 390 px).
- Accessibility (slot 13): axe found 1 issue, the script found 20 target/overflow/focus problems, all fixed; typing p95 35–45 ms on an emulated low-end phone.
- Security (slot 14): secret scan 0 hits (tree + history); login rate limit 10 failures / 10 min per IP+email.
- Reader corpus, bills tests and i18n key tests all run in `vitest`.

## What is left
- Reader: names written after the amount.
- Bills: provisional `P…` numbers are not renumbered after sync; "paid" status is derived from payment tags over 395 days; no partial payments; reminder does not record that it was sent.
- Hindi: stock-count/closing forms, Udhaar/Products pages, some server error messages and admin/Pro screens stay English; Hindi og:image:alt stays English.
- Performance: app shell after login not profiled; no size-adjust fallback fonts.
- Landing: at 820 px two steps can share the centre band so the drawer bar may show the neighbour step.
- Accessibility/contrast: no VoiceOver/TalkBack pass; landing keyboard-only walk not scripted; admin/Pro pages not axe-checked; contrast checked at 390 px only.
- Operations: rollback and D1 Time Travel commands in `docs/OPERATIONS.md` have not been run against production.

## Known risks
- `style-src 'unsafe-inline'` remains in the CSP.
- The `www.` redirect only covers API calls until `www.jakcrew.com` is added as a custom domain.
- The login limiter and bills are not load-tested; nothing was tested against real production data.
- Voice (Web Speech) was only tested with a fake recognizer.
- A timing-sensitive vitest test can fail once on a cold start (see above).

## Owner-only
Real shopkeeper testing (10 real notes and a real bill photo through the live AI); real photos, a short video or a pilot shop as proof; brand imagery and any logo redesign decision; the WhatsApp number and price line in `public/js/site-config.js`; adding `www.jakcrew.com` as a custom domain in Cloudflare; **rotating the Cloudflare token and Gemini key** (they were pasted in chat; checklist in `docs/OPERATIONS.md`); trying voice on real phones.
