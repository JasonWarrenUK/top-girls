#!/usr/bin/env zsh
# proposed-version.sh
#
# Informational preview: prints the version main WILL get once this branch merges.
# Called by the Claude Code PostToolUse hook when a "gh pr create" command runs.
#
# NEVER creates a tag. The authoritative tag is created by .github/workflows/tag.yml
# running on main after merge — that process is race-free and serial. This preview
# is computed on the current feature branch so it may over/under-estimate relative
# to the final on-main result if another PR merges first.

set -euo pipefail

# Fetch main so svu sees its tags even from a feature branch.
git fetch -q origin main 2>/dev/null || true

CURRENT="$(svu current --tag.mode current 2>/dev/null || echo v0.0.0)"
NEXT="$(svu next    --tag.mode current --v0 2>/dev/null || echo "$CURRENT")"

if [ "$NEXT" = "$CURRENT" ]; then
  echo "ℹ Version preview: no bump warranted yet (still $CURRENT)."
else
  echo "ℹ Version preview: this PR will likely bump $CURRENT -> $NEXT once merged."
  echo "  (Informational only — the real tag is created by CI on merge to main.)"
fi
