# CLAUDE.md

## What this is
"GitHub Checker" — an AI-assisted GitHub issue triage app: sync issues from a
repo, classify them, find similar past issues, generate fix plans, and
(currently simulated) dispatch them for work. Full roadmap and progress: see
`PLAN.md`.

## Human in the loop — standing rule
Any addition or change to any file — code, docs, config, migrations, hooks —
always goes through explicit human confirmation before it's written. This
applies everywhere, not just to application features: automation we build
*for* this project (hooks, scheduled tasks, auto-proposed `CLAUDE.md`
updates, the Day 5 analyzer's proposed issues) must itself never auto-apply
without a human approving first. A hook may *propose* a change; it must never
*commit* one on its own. This rule doesn't expire and doesn't get relaxed as
the project grows — note it here so it never slips off silently.

## No internal implementation details in user-facing text — standing rule
Any string a route/component actually sends to a browser or API caller
(`message` fields in JSON responses, UI copy, error text) must never mention
internal file paths, module names, or code structure — e.g. never say
"see lib/pricing.ts" or "check CLAUDE.md" in a response body. Comments and
internal docs are fine to reference those things; user-facing text is not.
Hit once already in `/api/analyze/estimate`'s approximation notice — caught
before it shipped, but easy to repeat, so it's recorded here.

## Comment out, don't delete — standing rule
When replacing or removing existing logic during a change, comment the old
code out in place rather than deleting it, with a comment above it stating
the date and *why* it was replaced/removed. Don't delete it outright unless
the user explicitly says to. This applies everywhere code changes — routes,
components, lib functions, queries. Example precedent: `getRecentIssues` in
`app/page.tsx` was commented out (not deleted) when replaced by
`RecentlyViewed`, with a note on why.

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
`pnpm seed` — full sync + classify + embed end to end.
`pnpm validate` — `tsc --noEmit` + `pnpm smoke` (hits `/`, `/issues`, `/issues/1`
against an already-running `pnpm dev`, fails on any 5xx). Run this before
believing a UI change works — see the CSS gotcha below for why.

## Where things live
`app/api/{sync,classify,similar,plan,dispatch}/[id]/route.ts` — all mutating
endpoints are POST; the `id` param is the DB primary key, **except**
`app/issues/[number]/page.tsx`, which is keyed by the GitHub issue number
instead (the only page in the app that is). `lib/db.ts` is the only module
that calls `postgres()` directly — everything else imports its `sql` export.
Migrations are append-only; never edit `001_init.sql`, add a new file instead.

## Non-obvious
- Local dev DB is Supabase's local stack (`supabase start`) — no
  `ssl: "require"` needed on the Postgres client, since it's local, not cloud.
- `supabase/config.toml` is currently misnamed on disk (left as-is intentionally
  for now) — `supabase stop`/`db reset` may not behave correctly until fixed.
- The classifier and embedder fall back silently when `OPENAI_API_KEY` is
  missing — don't wrap those call sites in try/catch; the fallback is the
  happy path for local dev, not an error case.
- `classifications` and `plans` are append-only (one row per call, history
  preserved); `similar_issues` is upsert (one current embedding per issue).
  If you add a classification field, write a view instead of mutating history.
- `/api/dispatch/[id]` is a stub — it writes a `runs` row and a fake branch
  name via `lib/github.ts`'s `createBranchName()`, but never runs a real agent
  or creates a real git branch. It's the seam a real dispatch workflow plugs
  into later; refuses to run without a plan on file.
- CSS comments must never contain a literal `*/` outside their own
  comment-closer — even inside prose. `/* --a-*/--b-* */` closes early at the
  first `*/`, and everything after gets parsed as invalid CSS, breaking every
  page with a silent 500. Caught by `pnpm validate`'s smoke test, not by
  `tsc --noEmit` — type-checking a `.ts` file doesn't validate `.css` syntax.
- Analyzer-sourced issues (`source = 'analyzer'`) get filed as real GitHub
  issues on approval, via `createIssue()` in `lib/github.ts` — the local
  `issues` row uses the real number/url `gh issue create` returns, and gets
  classified immediately (`classifyIssue()`, same function sync's
  auto-classify path and the manual "Classify" button use). COMMENTED
  2026-08-06 — previously approval only inserted a local-only row with a
  synthetic `github_number = 1,000,000,000 + proposed_issues.id`, since
  nothing was ever actually filed on GitHub; user asked for approval to file
  for real instead, so that scheme no longer applies:
  <!--
  Analyzer-sourced issues (`source = 'analyzer'`) get a synthetic
  `github_number` = `1,000,000,000 + proposed_issues.id` on approval, since
  they were never filed on GitHub and have no real number. Always positive
  (works with existing route validation), guaranteed unique (derived from an
  already-unique id) — not a bug if you see a billion-range issue number.
  -->
- Theme naming convention: `--ink-*`/`--tag-*`/`--action-*` CSS variables and
  `.card`/`.badge`/`.action` classes (see `app/globals.css`). Keep new UI
  code consistent with this naming — don't introduce `.panel`/`.chip`/`.btn`
  or `--color-*`/`--chip-*` alongside it.
