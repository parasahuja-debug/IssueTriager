# Day 6 — Applying large-codebase Claude Code practices

Source for this day's scope: PLAN.md's Day 6 section, itself sourced from
"How Claude Code works in large codebases" (claude.com/blog). See `README.md`
in this folder for why this whole directory is informative-only, not a
source of truth about current project state — `CLAUDE.md` and `PLAN.md` are.

## What / why

By the end of Day 5 the project had crossed from "small enough to hold in
one `CLAUDE.md`" into needing some large-codebase practices at a small
scale: more `lib/` files, more routes, 4 new tables. Day 6 adopted the
pieces actually load-bearing at this project's size and explicitly
documented (not silently skipped) the ones that aren't.

- **Subdirectory `CLAUDE.md` files** — added `app/api/CLAUDE.md` and
  `lib/CLAUDE.md`. Both went through multiple review rounds before landing:
  first drafts covered conventions only and missed the actual "what does
  each route/export do" map, which is the real point of a scoped doc file
  (root `CLAUDE.md` is already carrying a lot of bullets — a scoped file's
  job is to be the complete local reference next to the code it describes).
  Verified against every file in each directory via `grep` across all
  route/export signatures before writing a line, not from memory.
- **A Stop hook proposing `CLAUDE.md` updates** — `scripts/check-doc-drift.sh`,
  registered twice in `.claude/settings.json`: once on `Stop` (blocks ending
  the session, feeds a reason back) and once on `SessionStart` (backstop for
  a session that crashed/was force-quit instead of stopping cleanly, so
  `Stop` never fired for it). Deduped via a hash of the flagged file list
  cached in `.claude/.doc-drift-state` (gitignored) — without this, it would
  re-block every stop attempt for the same unreviewed change, since this
  project never auto-commits. **This hook fired for real, unprompted,
  during this same session** — flagged files changed under `app/`, `lib/`,
  `scripts/`, a specific `CLAUDE.md` addition was proposed (documenting the
  two-hooks-mechanisms gotcha below), reviewed, and only written after
  explicit approval. The propose-not-apply behavior was verified live, not
  staged.
- **A pre-commit hook enforcing `pnpm validate`** — `scripts/git-hooks/pre-commit`,
  designed to always run `tsc --noEmit` (blocking) and run `pnpm smoke`
  only if a dev server is already reachable (best-effort — a pre-commit
  hook can't reasonably boot `pnpm dev`, hit routes, and tear it down
  without slowing every commit). **Written but deliberately not activated**
  — `git config core.hooksPath scripts/git-hooks` was never run, and after
  a near-miss where a manual/direct invocation would have bypassed git
  entirely and run real checks, the script's body was commented out
  (dated, with why — not deleted) so even a direct call is a no-op.
  Confirmed local-only regardless: git hooks never protect a fresh clone,
  CI, or Vercel's deploy pipeline unless each one separately opts in.
  Revisit activation later.
- **Evaluated an MCP server for Postgres** — research only, recorded in
  `IDEAS.md` per explicit request (not `CLAUDE.md`/`PLAN.md`). Anthropic's
  official `@modelcontextprotocol/server-postgres` was read-only by design
  but deprecated/archived July 2025 after a SQL-injection finding — ruled
  out. Supabase's own `supabase-mcp` (official, Supabase-maintained,
  supports `--read-only`) is the better fit given this project already
  runs Supabase locally. Not configured — decision only, for a future day.
- **Day 4 subagent-registration gap doc** — dropped from this day's scope
  on request; not documented in `CLAUDE.md` today.
- **Explicitly out of scope, and why** — added to `CLAUDE.md`: org-wide
  plugin marketplaces, a dedicated infra-team/DRI role, LSP server
  integration. All three coordinate shared conventions across many
  engineers on multi-repo orgs; this is a single-developer, single-repo
  project, so adopting them now would be process for its own sake.

## Checkpoint

- Stop hook propose-not-apply behavior: **verified live** (see above) —
  not a staged test.
- Pre-commit hook blocking-a-real-failure behavior: **not verified** —
  deferred, since the script body is intentionally commented out pending a
  future decision on activation.

## Commands run (representative, not exhaustive)

```
grep -rn "export async function" app/api/          # verified every route method before documenting
grep -n "^export " lib/*.ts                         # verified every lib export before documenting
chmod +x scripts/check-doc-drift.sh
chmod +x scripts/git-hooks/pre-commit
jq -e '.hooks.Stop[] | ...'                         # validated settings.json hook schema
./scripts/check-doc-drift.sh Stop                   # pipe-tested block + dedup + SessionStart output shapes
```

## Directory tree (top-level, abbreviated)

```
.claude/
  agents/code-reviewer.md
  commands/{analyze-repo,idea,plan,review-pr}.md
  skills/idea/SKILL.md
  settings.json          # + Stop/SessionStart hooks (Day 6)
  .doc-drift-state       # gitignored, hook dedup cache (Day 6)
app/
  api/                   # + CLAUDE.md (Day 6)
  analyze/, issues/, proposed/, page.tsx, layout.tsx, globals.css
components/
lib/                     # + CLAUDE.md (Day 6)
  ai.ts, classify.ts, db.ts, github.ts, pricing.ts, tokens.ts
migrations/
  001_init.sql, 002_analyzer.sql
scripts/
  check-doc-drift.sh     # new (Day 6)
  git-hooks/pre-commit   # new (Day 6), inert
  db-check.ts, migrate.ts, seed.ts, smoke.ts, sync-issues.ts
supabase/
CLAUDE.md, PLAN.md, IDEAS.md, README.md
```
