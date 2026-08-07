#!/usr/bin/env bash
# Detects uncommitted changes under app/, lib/, migrations/, scripts/ and
# asks Claude to consider a CLAUDE.md update — never writes one itself.
# Run by two hooks (see .claude/settings.json): Stop (normal case, blocks
# ending the session) and SessionStart (backstop for a session that crashed
# or was force-quit instead of stopping cleanly, so Stop never fired for it).
#
# Dedup: without this, the Stop hook would re-block every single stop
# attempt for the same unreviewed changes, since this project never
# auto-commits (human-in-the-loop rule) — the files stay "changed" forever
# until a human commits them. A hash of the flagged file list is cached in
# .claude/.doc-drift-state (gitignored); only a *changed* hash re-triggers.
set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

EVENT_NAME="${1:-Stop}"
STATE_FILE=".claude/.doc-drift-state"

CHANGED=$(git status --porcelain -- app lib migrations scripts 2>/dev/null \
  | awk '{print $2}' \
  | grep -vE '(^|/)(CLAUDE|PLAN|IDEAS)\.md$' \
  | sort || true)

if [ -z "$CHANGED" ]; then
  exit 0
fi

NEW_HASH=$(printf '%s' "$CHANGED" | shasum -a 256 | awk '{print $1}')
OLD_HASH=""
[ -f "$STATE_FILE" ] && OLD_HASH=$(cat "$STATE_FILE")

if [ "$NEW_HASH" = "$OLD_HASH" ]; then
  exit 0
fi

mkdir -p .claude
printf '%s' "$NEW_HASH" > "$STATE_FILE"

FILE_LIST=$(printf '%s' "$CHANGED" | tr '\n' ' ')
MESSAGE="Files changed this session under app/, lib/, migrations/, or scripts/: ${FILE_LIST}. Before continuing, consider whether any of this introduced a new convention or gotcha worth documenting. If so, propose a specific addition to the root CLAUDE.md or the nearest scoped one (app/api/CLAUDE.md, lib/CLAUDE.md) for human review — never write it without explicit confirmation. If nothing here is worth documenting, say so and continue."

if [ "$EVENT_NAME" = "SessionStart" ]; then
  jq -n --arg msg "$MESSAGE" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $msg}}'
else
  jq -n --arg msg "$MESSAGE" '{decision: "block", reason: $msg}'
fi
