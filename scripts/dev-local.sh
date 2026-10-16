#!/usr/bin/env bash
# Runs the app fully offline (local D1 + R2). Workers AI has no local mode, so the
# AI binding is stripped; OCR then needs ANTHROPIC_API_KEY in .dev.vars.
set -euo pipefail
cd "$(dirname "$0")/.."
awk 'BEGIN{skip=0} /^\[ai\]/{skip=1; next} /^\[/{skip=0} !skip' wrangler.toml > wrangler.local.toml
npx wrangler d1 migrations apply DB --local --config wrangler.local.toml
exec npx wrangler dev --config wrangler.local.toml "$@"
