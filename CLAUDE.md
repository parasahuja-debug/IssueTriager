# CLAUDE.md

## What this is
GitHub issue triager, rebuilt from scratch as a learning exercise, mirroring
`../GitHubIssueTriager` minus Archon. Full roadmap and progress: see `PLAN.md`.

## Do not read
`DaywiseDirectoryStructure/` is a historical archive of directory-tree
snapshots per day — informative only, not documentation of current state.
It is not a source of truth about this project's structure, contents, or
progress; ignore it when reasoning about the codebase. (Also enforced via a
deny rule in `.claude/settings.json`.)

## Stack
Next.js 15 (App Router) + TypeScript. Local Supabase Postgres with `pgvector`.
Raw `postgres` client — no ORM. OpenAI SDK optional; without `OPENAI_API_KEY`
the app must fall back to a rule-based classifier and a deterministic
hash-based embedding (this fallback is the happy path, not an error case).

## Run
`pnpm migrate` — apply every `.sql` in `migrations/` in order. Idempotent
(`IF NOT EXISTS` everywhere) — safe to re-run against a DB that already has
the schema. No rollback.
`pnpm dev` — Next.js dev server.

## Non-obvious
- Local dev DB is Supabase's local stack (`supabase start`), not Neon — no
  `ssl: "require"` on the Postgres client, unlike the cloud reference repo.
- `supabase/config.toml` is currently misnamed on disk (left as-is intentionally
  for now) — `supabase stop`/`db reset` may not behave correctly until fixed.
