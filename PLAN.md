# Build Plan — GitHub Issue Triager (from scratch)

Rebuilding the pipeline from `GitHubIssueTriager` without Archon. This file is the
source of truth for the roadmap — if you open a fresh Claude Code session in this
folder, point it at this file (or just say "read PLAN.md, what's next") and it
has full context. `CLAUDE.md` stays short on purpose; this file carries the detail.

**Progress log** — update the checkbox when a step is actually done, not planned.
A fresh session should trust this list over anything else.

**Standing step:** every day ends with an archive snapshot at
`DaywiseDirectoryStructure/dayN.md` (tree + what/why + commands run). That
folder is informative-only — see its `README.md` — never treat it as current
project state.

---

## Day 1 — Environment + data layer

**Why this order:** you can't classify or embed an issue that isn't in a table yet.
Data layer first means every later day has something real to read/write against.

- [x] **1.1 Install pnpm and gh** (via `brew install pnpm gh`)
      *Why:* pnpm installs JS dependencies; gh is how we'll pull real GitHub issues in Day 2. Not blocking today's DB work.
- [x] **1.2 `supabase init` inside this folder**
      *Why:* creates a local `supabase/` config scoped to this project. **Known issue:** `supabase/config.toml` ended up misnamed on disk — left as-is for now, may need fixing before `supabase stop`/`db reset` are used.
- [x] **1.3 `supabase start`**
      *Why:* boots a local Postgres in Docker plus a local API/Studio UI. Gives us a real connection string to develop against, offline.
- [x] **1.4 `CREATE EXTENSION IF NOT EXISTS vector;`**
      *Why:* pgvector adds the `vector` column type and similarity operators (`<=>` for cosine distance) we'll use in Day 3. Confirmed present via `\dx` (v0.8.0).
- [x] **1.5 Scaffold Next.js 15 + TypeScript + Tailwind** (`pnpm create next-app`)
      *Why:* the reference repo is a Next.js App Router app — server components read straight from Postgres, no separate backend needed. Note: landed on Next 16 / React 19.2, newer than the reference repo's Next 15 — fine, no pin needed. Project was initially scaffolded into a nested `issuetriager/` subfolder; flattened into project root so `migrations/`, `scripts/`, and the app tree are siblings as the plan assumes.
- [x] **1.6 Write `migrations/001_init.sql` by hand**
      *Why "by hand" and not an ORM migration tool:* the original repo uses raw SQL on purpose — one less abstraction between you and the schema while you're learning it. Tables: `issues`, `classifications` (append-only — keeps history, latest row wins in UI), `similar_issues` (vector(1536) + HNSW cosine index), `plans`, `runs`. Applied once manually via Supabase Studio, then also formalized as a script (1.7) for reproducibility.
- [x] **1.7 `scripts/migrate.ts`**
      *Why a script instead of `psql -f` or Studio's SQL editor:* it's repeatable, runs every `.sql` file in order, and becomes a `pnpm migrate` command any teammate (or fresh session) can run without knowing file paths. Idempotent (`IF NOT EXISTS` everywhere) — confirmed safe to re-run against the tables already created via Studio. No `ssl: "require"` (unlike the Neon-based reference repo) since local Supabase doesn't need it.
- [x] **1.8 First `CLAUDE.md`**
      *Why now, not later:* writing it after just two real decisions (schema shape, why raw SQL) means every line in it is something you actually learned today, not boilerplate copied from the reference repo. `Run` now has `pnpm migrate` and `pnpm dev`; `Non-obvious` notes the Supabase-vs-Neon SSL difference and the config.toml naming issue.
- [x] **1.9 Checkpoint:** `pnpm migrate` runs clean against local Supabase Postgres — confirmed via `\dt`, all 5 tables present in `public` schema (plus an unrelated `test_vectors` table from manual pgvector testing, harmless).
- [x] **1.10 Archive snapshot:** `DaywiseDirectoryStructure/day1.md` written.

---

## Day 2 — The pipeline core (outline — will get step-by-step detail at start of Day 2)

**Why this order:** sync has to work before classify has anything to classify.

- [ ] `src/lib/db.ts` — one shared Postgres client, reused everywhere (avoids connection-pool exhaustion from creating a new client per request)
- [ ] `src/lib/github.ts` — wraps `gh issue list --json ...`
- [ ] `src/lib/ai.ts` — `classify()` and `embed()`, each with a **fallback that runs when `OPENAI_API_KEY` is unset** — this is the core "why" of Day 2: the fallback is the happy path for local dev, not an error case
- [ ] `POST /api/sync` and `POST /api/classify/[id]`
- [ ] `scripts/sync-issues.ts`, `scripts/seed.ts`
- [ ] Checkpoint: `pnpm seed` populates real rows end to end
- [ ] Archive snapshot: `DaywiseDirectoryStructure/day2.md`

## Day 3 — Similarity, plans, dispatch, UI (outline)

- [ ] `POST /api/similar/[id]` — embed + `ORDER BY embedding <=> $1 LIMIT 3` (cosine k-NN)
- [ ] `POST /api/plan/[id]` — markdown plan, mock template fallback
- [ ] `POST /api/dispatch/[id]` — simulated only (this is the Archon hook point we're intentionally stubbing)
- [ ] Dashboard, issues list + filters, issue detail page, action buttons
- [ ] `scripts/smoke.ts`, `pnpm validate`
- [ ] Checkpoint: click through the full flow in the browser
- [ ] Archive snapshot: `DaywiseDirectoryStructure/day3.md`

## Day 4 — The Claude Code tooling layer (outline)

- [ ] Refine `CLAUDE.md` with real gotchas hit in Days 1–3
- [ ] `.claude/commands/plan.md` — a slash command that writes a plan file without touching code
- [ ] `.claude/agents/code-reviewer.md` — a subagent with fresh, isolated context
- [ ] `.claude/commands/review-pr.md` — fans the subagent(s) out over a diff
- [ ] Checkpoint: run `/review-pr` on your own Day 3 diff, see it flag something real
- [ ] Archive snapshot: `DaywiseDirectoryStructure/day4.md`

---

## Explicitly out of scope this week
- Archon (agent dispatch / adversarial-dev workflow)
- Neon branching, git worktree lifecycle scripts — same idea as pgvector cosine search, just infra we're not standing up
