#!/usr/bin/env bash
# Idempotently creates the Cloudflare resources (D1 database + private R2 bucket), writes the
# D1 id into wrangler.toml, applies migrations and sets secrets. Needs CLOUDFLARE_API_TOKEN
# (and CLOUDFLARE_ACCOUNT_ID if the token can see several accounts) or `wrangler login`.
set -euo pipefail
cd "$(dirname "$0")/.."
DB_NAME=dailykhata-db
BUCKET=dailykhata-files

id=$(npx wrangler d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).find(x=>x.name===process.argv[1]);console.log(r?r.uuid:"")})' "$DB_NAME")
if [ -z "$id" ]; then
  echo "Creating D1 database $DB_NAME"
  npx wrangler d1 create "$DB_NAME" >/dev/null
  id=$(npx wrangler d1 list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{console.log(JSON.parse(s).find(x=>x.name===process.argv[1]).uuid)})' "$DB_NAME")
fi
echo "D1 database id: $id"
sed -i.bak -E "s/^database_id = \".*\"/database_id = \"$id\"/" wrangler.toml && rm -f wrangler.toml.bak

if ! npx wrangler r2 bucket list 2>/dev/null | grep -q "^name:[[:space:]]*$BUCKET\$"; then
  echo "Creating R2 bucket $BUCKET (private; no public access is enabled)"
  npx wrangler r2 bucket create "$BUCKET" || true
fi

npx wrangler d1 migrations apply DB --remote

if [ "${1:-}" = "--deploy" ]; then
  npx wrangler deploy
  if [ -n "${SETUP_TOKEN:-}" ]; then printf '%s' "$SETUP_TOKEN" | npx wrangler secret put SETUP_TOKEN; fi
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then printf '%s' "$ANTHROPIC_API_KEY" | npx wrangler secret put ANTHROPIC_API_KEY; fi
  if [ -n "${GEMINI_API_KEY:-}" ]; then printf '%s' "$GEMINI_API_KEY" | npx wrangler secret put GEMINI_API_KEY; fi
fi
