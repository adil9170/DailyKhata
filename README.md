# DailyKhata — daily accounts & inventory on Cloudflare

A password-protected, multi-company web app for shops and small businesses to record daily
stock purchases, expenses, collections and hisaab photos. The server calculates daily totals,
per-piece costs, stock movement, cash differences, outstanding amounts and profit.

**Stack:** Cloudflare Workers (Hono API + static SPA via Workers Assets) · D1 (SQL) · R2 (private files)
· Workers AI or Claude for photo OCR · Cron trigger for nightly backups.

## Features

| Area | What it does |
|---|---|
| **Daily entry** | Purchases (item, qty, unit, pieces, total → per-piece cost), expenses with categories and receipt photos, collections (cash/UPI/card/udhaar), end-of-day closing stock count and cash count. A quick-entry box takes lines like `Sting 2 boxes ₹1,020 60` or `16 October Collection: ₹7,544`. |
| **Photos & OCR** | Upload photos of handwritten hisaab, bills or receipts (resized on the phone first). The server reads dates, items, quantities and amounts; the user reviews and edits everything before saving. |
| **Calculations** (server only) | Totals, net cash flow, drawer cash (opening + cash in − cash out vs counted), stock opening/bought/sold/closing, weighted-average cost, cost of goods sold, payables/receivables, discrepancy checks. |
| **Profit vs cash** | Kept separate. *Net cash flow* is money in − money out. *Profit* (sales − cost of sold stock − expenses) is shown **only** for days where closing stock was counted for every product in stock; otherwise the app explains what is missing. Period profit states how many days it covers. |
| **Dashboard** | Date presets, daily/weekly/monthly grouping, KPI tiles, charts for collections/purchases/expenses, profit & loss, inventory movement and expenses by category, with a table view. |
| **Reports** | Printable single-day report, period comparison, outstanding by party, CSV and real `.xlsx` exports. |
| **Super admin** | Create/edit/suspend/delete companies, manage any company's users, plans with enforced limits (users, products, storage, OCR), cross-company stats and activity, backups, and "open portal" to support a company. |
| **Company portal** | Team members with roles (admin, manager, staff, viewer) plus per-user permission overrides; products; expense categories; branding (name, logo, colours, business details) that applies only to that company. |
| **Security** | PBKDF2 password hashing, HttpOnly SameSite=Strict session cookies (only a SHA-256 of the token is stored), login lockout after 5 failures, origin check on writes, strict CSP, every query scoped by `company_id` from the session (never from the request), private R2 files served only through authenticated, company-checked routes, audit log of every change with before/after values. |
| **Backups** | Nightly JSON snapshot of every company to R2 (30-day retention), manual backup button, a final backup before a company is deleted. D1 Time Travel also gives 30-day point-in-time restore. |

## Design

- **Mobile first:** bottom tab bar with a central **+** button (purchase, expense, collection, type hisaab, scan photo),
  bottom-sheet forms, iOS-style list rows (tap to edit), large touch targets, safe-area aware, installable (web app manifest).
- **Close your day** checklist on the daily screen: stock bought → expenses → collection → count stock → count cash.
- **Light, dark and system themes** (Settings → Appearance, or the theme button), with charts re-themed to match.
- Company branding drives the accent colour, hero card and buttons; everything else stays neutral.

## Deploy

### Option A — GitHub Actions (recommended)

1. In Cloudflare, create an API token with **Workers Scripts:Edit, D1:Edit, Workers R2 Storage:Edit,
   Workers AI:Read** (and Account Settings:Read).
2. In this GitHub repo → Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
   - `SETUP_TOKEN` — any long random string; you'll type it once to create the super admin
   - `ANTHROPIC_API_KEY` *(optional)* — uses Claude for OCR (best for handwriting). Without it, Workers AI is used.
3. Push to `main` (or run the workflow manually). The workflow tests, creates the D1 database and
   R2 bucket if missing, applies migrations and deploys.
4. Open `https://dailykhata.<your-subdomain>.workers.dev`, enter the setup token and create the super admin.

### Option B — from your machine

```bash
npm ci
npx wrangler login
SETUP_TOKEN=your-long-random-token ./scripts/provision.sh --deploy
```

## Local development

```bash
npm ci
echo 'SETUP_TOKEN="dev-setup-token"' > .dev.vars   # add ANTHROPIC_API_KEY=... to test OCR locally
./scripts/dev-local.sh                             # local D1 + R2, http://localhost:8787
./scripts/smoke-test.sh                            # 41 end-to-end API checks against a fresh DB
npm test && npm run typecheck                      # unit tests for the parser and the financial engine
```

## How the numbers are calculated

All money is stored as integer paise. `src/lib/calc.ts` is the only place figures are computed.

- **Per-piece cost** = total cost ÷ pieces. **Average cost** of a product = all purchase cost ÷ all pieces bought.
- **Sold** (on a counted day) = opening stock + bought − counted closing. Uncounted days carry stock forward;
  the next count absorbs the sales since the last count (flagged in the day's checks). A product's first
  count with no earlier purchases is taken as its opening stock.
- **Cost of goods sold** = sold × average cost. **Net profit** = collections (incl. udhaar sales) − COGS − expenses.
- **Expected drawer cash** = opening (entered, or carried forward from the last count) + cash collections +
  cash received from customers − cash purchases − cash expenses − cash paid to suppliers.
- **Payable** = credit purchases + credit expenses − payments to suppliers. **Receivable** = udhaar sales − payments from customers.

## Project layout

```
src/index.ts            Worker entry: security headers, routing, cron backups
src/routes/auth.ts      setup, login/logout, session, password change
src/routes/company.ts   company portal API (entries, day view, reports, exports, uploads, team, branding, audit)
src/routes/admin.ts     super admin API (companies, users, plans, activity, backups)
src/lib/calc.ts         financial engine (pure, unit-tested)
src/lib/parser.ts       natural-language hisaab parser
src/lib/ocr.ts          Claude / Workers AI photo extraction
migrations/             D1 schema
public/                 SPA (vanilla JS modules, no build step)
```
