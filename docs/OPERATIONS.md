# DailyKhata — operations runbook

Production = Cloudflare Worker `dailykhata` + D1 `dailykhata-db` + R2 `dailykhata-files`. Every push to `main` runs CI and, if green, deploys (`.github/workflows/deploy.yml`).
Live checks: `curl https://jakcrew.com/api/health` → `{"ok":true,"app":"DailyKhata","build":"vNN"}` (build = service-worker `VERSION`; compare with `public/sw.js`).

## 1. Roll back a bad deploy
Fastest (code only, seconds):
```
npx wrangler deployments list
npx wrangler rollback            # previous version; or: npx wrangler rollback <version-id>
```
Then fix forward on `main` (or `git revert <sha>` and push; CI redeploys). Rollback does **not** undo D1 migrations. Migrations are additive only (CI blocks `DROP`/`RENAME`/`DELETE FROM`), so older code keeps working against newer tables.

## 2. Restore the database (D1 Time Travel)
D1 keeps point-in-time history (30 days on paid plans).
```
npx wrangler d1 time-travel info dailykhata-db
npx wrangler d1 time-travel restore dailykhata-db --timestamp=2026-11-01T03:00:00Z   # or --bookmark=<id>
```
The restore prints the bookmark from *before* the restore; keep it, so you can undo by restoring to it. Everyone's data after the timestamp is lost, so announce first. Try it on a copy first when time allows (export with `npx wrangler d1 export dailykhata-db --remote --output=dk.sql`).

## 3. Restore from a nightly backup (one shop)
A cron (02:15 IST) writes one JSON snapshot per shop to R2 under `backups/<company_id>/…json` (30 days kept, rows in table `backups`).
1. Super-admin → Backups → Download the snapshot you want (or `npx wrangler r2 object get dailykhata-files/backups/<company_id>/<file>.json --remote --file backup.json`).
2. Inspect it (`node -e "const b=require('./backup.json');console.log(Object.keys(b))"`). It is a per-shop copy of the financial tables, not a full DB image.
3. Re-import the rows you need (entries, collections, customers…) through `POST /api/c/bulk` as that shop's admin (idempotent by `client_id`), or with `wrangler d1 execute … --file` for a bulk repair. For a whole-database problem use Time Travel instead.

## 4. Preview deploy (try a change without touching production)
```
npm ci
npx wrangler versions upload              # uploads a version without making it live; prints a preview URL
# or run everything locally on a throwaway DB:
./scripts/dev-local.sh --port 8788        # local D1 + R2, applies all migrations
./scripts/smoke-test.sh http://127.0.0.1:8788   # needs a fresh DB; SETUP_TOKEN="dev-setup-token" in .dev.vars
```
Promote a previewed version with `npx wrangler versions deploy`. Pull requests run tests but never deploy.

## 5. Locked out / reset a super-admin
```
npx wrangler d1 execute DB --remote --file scripts/list-superadmins.sql      # who are the super-admins
RESET_PASSWORD='New-pass-123' node scripts/reset-superadmin.mjs you@example.com --remote   # prints the command; run it
```
The printed SQL also clears login lockouts and signs that user out everywhere. Use `--local` for the dev DB. Do not leave the password in shell history (use a prompt: omit `RESET_PASSWORD`).

## 6. Login rate limit
10 failed logins per IP + email in 10 minutes → HTTP 429 with `Retry-After`; a successful login clears it; the window expires on its own (table `login_attempts`). Clear by hand: `DELETE FROM login_attempts;` via `wrangler d1 execute`. A per-account lock (5 wrong passwords → 15 minutes) already existed.

## 7. Owner checklist: rotate secrets (the old ones were pasted in chat — treat them as leaked)
- [ ] **Cloudflare API token**: dash.cloudflare.com → My Profile → API Tokens → create a new token (same template/permissions as before: Workers Scripts, D1, R2, Workers AI edit on this account) → roll or delete the old one. Update GitHub → repo Settings → Secrets → Actions → `CLOUDFLARE_API_TOKEN`. Re-run the deploy workflow to prove it works.
- [ ] **Gemini key**: aistudio.google.com/apikey → create a new key, delete the old one. Update the GitHub secret `GEMINI_API_KEY`, then `npx wrangler secret put GEMINI_API_KEY` (or re-run the deploy workflow if it pushes secrets).
- [ ] **Anthropic key** (if used for OCR): same, secret `ANTHROPIC_API_KEY`.
- [ ] **SETUP_TOKEN**: only needed for first-run signup; rotate with `npx wrangler secret put SETUP_TOKEN` and the GitHub secret.
- [ ] Check GitHub → Settings → Security → secret scanning alerts, and Cloudflare → Audit log for unfamiliar activity since the paste.
- [ ] Verify afterwards: `curl https://jakcrew.com/api/health`, sign in, add a test entry.

## 8. Security notes (slot 14 review)
- Secret scan: working tree and full git history, patterns for Google/Anthropic/AWS/GitHub keys and private keys, and `*_TOKEN`/`*_KEY` assignments: **0 hits** (counts only; no values printed). No `.dev.vars` is tracked.
- CSP (`public/_headers`): `default-src 'self'`, scripts `'self'` only (no inline script, no eval), `style-src` allows inline styles (the app sets styles from JS), images `self blob: data:`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'`. Also HSTS (1 year, no preload/subdomains), `nosniff`, `X-Frame-Options: DENY`, camera/mic only for self. Known gap: `'unsafe-inline'` for styles (would need nonces/hashes and a style refactor).
- API responses are `no-store`, cross-site writes are rejected (Origin/Sec-Fetch-Site), cookies are `HttpOnly; SameSite=Strict; Secure` on https.
