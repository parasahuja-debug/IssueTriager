# CLAUDE.md

## What this is
GitHub issue triager, rebuilt from scratch as a learning exercise, mirroring
`../GitHubIssueTriager` minus Archon. Full roadmap and progress: see `PLAN.md`.

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
