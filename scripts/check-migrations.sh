#!/usr/bin/env bash
# CI guard: migrations are additive only. Fails if a migration added since BASE (default origin/main~) uses DROP, RENAME or DELETE FROM.
# With no git history to compare (shallow clone) it checks every migration after 0004 plus any file given as an argument.
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${1:-}"
if [ -n "$BASE" ] && git rev-parse -q --verify "$BASE" >/dev/null; then
  files=$(git diff --name-only --diff-filter=A "$BASE"...HEAD -- migrations/ || true)
else
  files=$(ls migrations/*.sql | awk -F/ '{ if ($2 > "0004") print $0 }')
fi
bad=0
for f in $files; do
  [ -f "$f" ] || continue
  # strip -- comments before matching
  if sed 's/--.*$//' "$f" | grep -n -i -E '\bDROP\b|\bRENAME\b|DELETE[[:space:]]+FROM' ; then
    echo "::error file=$f::migration uses DROP/RENAME/DELETE FROM (additive only)"; bad=1
  fi
done
[ "$bad" = 0 ] && echo "migrations ok"
exit $bad
