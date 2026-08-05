# Build Plan — GitHub Checker

Build plan for GitHub Checker, an AI-assisted GitHub issue triage app: sync
issues from a repo, classify them, find similar past issues, generate fix
plans, and (currently simulated) dispatch them for work. This file is the
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
      *Why:* Next.js App Router lets server components read straight from Postgres, no separate backend needed. Landed on Next 16 / React 19.2. Project was initially scaffolded into a nested `issuetriager/` subfolder; flattened into project root so `migrations/`, `scripts/`, and the app tree are siblings as the plan assumes.
- [x] **1.6 Write `migrations/001_init.sql` by hand**
      *Why "by hand" and not an ORM migration tool:* raw SQL on purpose — one less abstraction between you and the schema while you're learning it. Tables: `issues`, `classifications` (append-only — keeps history, latest row wins in UI), `similar_issues` (vector(1536) + HNSW cosine index), `plans`, `runs`. Applied once manually via Supabase Studio, then also formalized as a script (1.7) for reproducibility.
- [x] **1.7 `scripts/migrate.ts`**
      *Why a script instead of `psql -f` or Studio's SQL editor:* it's repeatable, runs every `.sql` file in order, and becomes a `pnpm migrate` command any teammate (or fresh session) can run without knowing file paths. Idempotent (`IF NOT EXISTS` everywhere) — confirmed safe to re-run against the tables already created via Studio. No `ssl: "require"` since local Supabase doesn't need it.
- [x] **1.8 First `CLAUDE.md`**
      *Why now, not later:* writing it after just two real decisions (schema shape, why raw SQL) means every line in it is something you actually learned today, not boilerplate. `Run` now has `pnpm migrate` and `pnpm dev`; `Non-obvious` notes the local-Postgres SSL setting and the config.toml naming issue.
- [x] **1.9 Checkpoint:** `pnpm migrate` runs clean against local Supabase Postgres — confirmed via `\dt`, all 5 tables present in `public` schema (plus an unrelated `test_vectors` table from manual pgvector testing, harmless).
- [x] **1.10 Archive snapshot:** `DaywiseDirectoryStructure/day1.md` written.

---

## Day 2 — The pipeline core (outline — will get step-by-step detail at start of Day 2)

**Why this order:** sync has to work before classify has anything to classify.

- [x] `lib/db.ts` — one shared Postgres client, reused everywhere (avoids connection-pool exhaustion from creating a new client per request). Path is `lib/`, not `src/lib/`, since this scaffold has no `src/` dir (`tsconfig.json`'s `@/*` alias maps to project root). Singleton cached on `globalThis` so Next.js dev hot-reload doesn't leak connections. No `ssl: "require"` needed, since it's local Supabase. Verified with `scripts/db-check.ts` (`npx tsx scripts/db-check.ts`) — connected, returned `current_database()`/`now()`.
- [x] `lib/github.ts` — wraps `gh issue list --json ...`. Test data: 5 real issues created via `gh issue create` on `parasahuja-debug/AI_Feedback_Solution_WebCrawl` (repo standardization, request helpers, directory structure, Gemini API config, .env conventions).
- [x] `lib/ai.ts` — `classify()` and `embed()`, each with a **fallback that runs when `OPENAI_API_KEY` is unset** — this is the core "why" of Day 2: the fallback is the happy path for local dev, not an error case. Real-call branch is dormant (no key set yet) but the `openai` package is installed and the code compiles, so flipping it on later is just adding a key.
- [x] `POST /api/sync` and `POST /api/classify/[id]` — HTTP wrappers so the future dashboard can trigger sync/classify from a button instead of a terminal. `/api/classify/[id]` is the first route that actually calls into `lib/ai.ts`.
- [x] `scripts/sync-issues.ts` — checked, `pnpm sync` upserted all 5 issues into `issues` table, confirmed via `psql`
- [x] `scripts/seed.ts` — chains sync + classify + embed into one script/command (`pnpm seed`), reusing `lib/db.ts`'s shared client rather than opening a second connection
- [x] Checkpoint: `pnpm seed` populates real rows end to end — confirmed via `psql`: all 5 issues classified (`mock-rule-based-v1`) and embedded (`mock-hash-v1`, 1536 dims each) with zero API cost, since `OPENAI_API_KEY` is still unset
- [x] Archive snapshot: `DaywiseDirectoryStructure/day2.md` written

## Day 3 — Similarity, plans, dispatch, UI

- [x] `lib/github.ts` — added `createBranchName()` (fake branch name for the simulated dispatch step; the seam a real dispatch workflow plugs into later)
- [x] `POST /api/similar/[id]` — embed + `ORDER BY embedding <=> $1 LIMIT 3` (cosine k-NN). Decision-support only: never auto-merges/closes, just reports matches.
- [x] `POST /api/plan/[id]` — markdown plan, mock template fallback. Writes only to `plans`, never touches `classifications`.
- [x] `POST /api/dispatch/[id]` — simulated only (stub for the future dispatch step). Refuses to dispatch without a plan on file.
- [x] Dashboard, issues list + filters, issue detail page, action buttons — full UI built. "Nebula" violet/teal theme (`--ink-*`/`--tag-*`/`--action-*` CSS variables, `.card`/`.badge`/`.action` classes), app branded "GitHub Checker".
- [x] `scripts/smoke.ts`, `pnpm validate` (`typecheck` + `smoke` chained) — smoke hits `/`, `/issues`, `/issues/1` against a running `pnpm dev`, fails on any 5xx.
- [x] Checkpoint: click through the full flow in the browser — confirmed working after fixing a real bug (see below).
- [x] Archive snapshot: `DaywiseDirectoryStructure/day3.md` written

**Bug hit and fixed:** `app/globals.css` had a comment containing `--color-*/--chip-*/--btn-*` — the `*/` inside that text closed the CSS comment early, so everything after it got parsed as invalid CSS and crashed every page with a 500. Caught immediately by `pnpm validate`'s smoke test rather than by clicking around manually. Fixed by rewording the comment to avoid any literal `*/` sequence outside an intended comment-closer. Worth remembering: never write `*/` inside a CSS comment body, even as part of prose.

## Day 4 — The Claude Code tooling layer

- [x] Refine `CLAUDE.md` with real gotchas hit in Days 1–3 — added "Where things live", 8 new "Non-obvious" bullets (SSL, fallback-is-happy-path, append-only vs upsert, dispatch stub, CSS `*/` gotcha, theme naming)
- [x] `.claude/commands/plan.md` — a slash command that writes a plan file without touching code. Restricted `allowed-tools` to exclude `Edit` entirely, so it's structurally incapable of modifying existing files, not just instructed not to.
- [x] `.claude/agents/code-reviewer.md` — a subagent with fresh, isolated context. Adapted from a completeness-first brief on request: reports every issue found (Critical/Important/High/Medium/Low), nothing discarded, rather than filtering to high-confidence-only.
- [x] `.claude/commands/review-pr.md` — precise scoping added on request: `/review-pr` (current branch's PR, or working-tree fallback) or `/review-pr <number>` (a specific PR regardless of branch) — never "all PRs."
- [x] Checkpoint: attempted via the `Agent` tool with `subagent_type: "code-reviewer"` — **failed**, this environment's `Agent` tool only recognizes a fixed built-in agent roster and doesn't pick up project-defined `.claude/agents/*.md` files. Worth remembering: a real local Claude Code CLI session would invoke `code-reviewer` as a genuinely isolated process; this environment can't. Did a manual review instead, following the same file's process by hand.
- [x] Archive snapshot: `DaywiseDirectoryStructure/day4.md` written

---

## Day 5 — Repo analyzer, human-in-the-loop approval, multi-repo tracking (outline)

**Why this exists:** every prior day assumed issues already exist, filed by a
human. This closes that gap — the app can also look at a repo itself and
propose candidate issues, at two depths (process-level signals, or a specific
file's real content), always staged for human approval before becoming a real
issue, and always with a token/cost estimate shown *before* anything is spent.

- [ ] `migrations/002_analyzer.sql` (new file — `001_init.sql` stays untouched):
  - `issues.source` column (`'github' | 'analyzer'`, default `'github'`) — every issue traceable to its origin
  - `tracked_repos` table (`github_repo` PK, `added_by`, `added_at`) — the multi-repo registry, addable from the UI, persisted across visits
  - `analysis_runs` table (`id, github_repo, scope 'metadata'|'file', file_paths TEXT[], requested_by, model, created_at`) — one row per analysis ever run, found-anything-or-not
  - `proposed_issues` table (`id, analysis_run_id, github_repo, title, body, category_guess, priority_guess, kind 'metadata'|'file', status 'pending'|'approved'|'rejected', reviewed_by, reviewed_at`) — the staging area; nothing here is a real issue until approved
- [ ] `lib/github.ts` additions:
  - `getRepoContext(repo)` — description/topics, README, last ~20 commit messages, existing open issue titles (for de-dup)
  - `getFileContent(repo, path)` — one file's real content, via `gh api repos/{repo}/contents/{path}`, for the file-scoped depth
- [ ] `lib/tokens.ts` (new) — `estimateTokens(text)` (char count / ~4) and `estimateCost(tokens, model)` (pure arithmetic against the pricing table). No AI call involved — this runs on text we already have in hand, before deciding whether to spend anything on a real model call.
- [ ] `lib/ai.ts` addition: `analyzeRepo(context, kind, existingTitles)` — same OpenAI-or-fallback shape as `classify()`. Real call proposes 3-5 candidate issues from the given context; fallback is rule-based (no README, no LICENSE, no CI config, etc.) for the metadata kind.
- [ ] Routes:
  - `POST /api/repos` — add a repo to `tracked_repos`; `GET /api/repos` — list tracked repos
  - `POST /api/analyze/estimate` — given repo + kind (+ file paths), returns a token/cost estimate, spends nothing
  - `POST /api/analyze` — given repo + kind (+ file paths) + explicit confirmation, runs `analyzeRepo()`, writes `analysis_runs` + `proposed_issues` rows
  - `POST /api/proposed/[id]/approve` — copies a proposal into real `issues` (`source = 'analyzer'`), logs `reviewed_by` (local OS username — no real auth system exists yet, flagged honestly as best-effort, not a secure audit trail) and `reviewed_at`
  - `POST /api/proposed/[id]/reject` — marks rejected, same logging; row is kept forever, never deleted
- [ ] `.claude/commands/analyze-repo.md` — the CLI entry point into the same capability, for any remote repo/branch, same estimate-then-confirm flow as the UI
- [ ] UI additions:
  - Repo selector on the dashboard — tracked repos + "add repo" input, persisted via `/api/repos`, remembered on future visits until changed
  - Staged analyze flow: check existing `issues` first → offer metadata vs file-scoped → show cost estimate → require explicit confirm → run
  - Proposed-issues panel — pending proposals with `Metadata-considered` / `Code-level` badges (never blurred together), Approve/Reject buttons
  - `source` badge (`github` vs `analyzer`) and repo badge added to every issue row/detail view across the app
- [ ] Checkpoint: add a second real repo via the UI, run a metadata-level analyze on it, confirm the cost estimate appears before anything is spent, approve one proposed issue, verify it becomes a real row in `issues` and is classifiable/plannable like any other issue
- [ ] Archive snapshot: `DaywiseDirectoryStructure/day5.md`

---

## Day 6 — Applying large-codebase Claude Code practices (outline)

**Source:** [How Claude Code works in large codebases](https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start).
**Why this exists:** by the end of Day 5 the project has crossed from "small
enough to hold in one `CLAUDE.md`" into needing some of the practices that
guide meant for larger codebases — more lib files, more routes, 4 new tables.
This day adopts the pieces that are actually load-bearing at our current
scale and explicitly documents (not silently skips) the pieces that aren't.

**Standing constraint carried over from `CLAUDE.md`:** every item below that
proposes automation (hooks especially) must only ever *propose* a change —
never auto-apply one. A Stop hook suggesting a `CLAUDE.md` addition still
requires a human to say yes before it's written, same as everything else in
this project.

- [ ] **Subdirectory `CLAUDE.md` files** — add scoped ones for `app/api/`
  (route conventions: POST-only, `[id]` vs `[number]`, validation pattern)
  and `lib/` (fallback pattern, single-db-client rule). *Why:* the root
  `CLAUDE.md` is already carrying a lot of "Non-obvious" bullets; layered
  files let local rules live next to the code they actually describe, and
  keep the root file lean as the project keeps growing.
- [ ] **A Stop hook proposing `CLAUDE.md` updates** — fires when a session
  ends, checks whether anything changed that looks like a new gotcha, and
  *proposes* a `CLAUDE.md` addition for a human to accept or reject — never
  writes it directly. *Why:* this is literally how we've built `CLAUDE.md`
  so far, by hand, after hitting a gotcha (the CSS `*/` bug, the SSL
  difference). A hook catches the "should this be recorded?" question
  automatically; a human still decides the answer.
- [ ] **A pre-commit hook enforcing `pnpm validate`** — blocks a commit if
  `tsc --noEmit` or `pnpm smoke` fails; it can refuse an action, but it does
  not write or change any file itself, so it doesn't conflict with the
  human-in-the-loop rule. *Why:* the Day 3 CSS bug is exactly what this
  would have caught before it ever reached a commit.
- [ ] **Evaluate an MCP server for Postgres** — lets Claude introspect the
  live schema directly instead of only ever reasoning from migration files.
  *Why:* Day 5 alone adds 4 new tables; the schema is no longer small enough
  to hold entirely from memory across sessions, and migration files can
  drift from what's actually running. (Introspection is read-only — no
  tension with the human-in-the-loop rule, which only governs writes.)
- [ ] **Document the Day 4 subagent-registration gap in `CLAUDE.md`** — the
  `Agent` tool not picking up `.claude/agents/*.md` in this environment,
  plus the manual-review workaround, so a future session doesn't waste time
  rediscovering it.
- [ ] **Explicitly out of scope, and why**: org-wide plugin marketplaces, a
  dedicated infra-team/DRI, LSP server integration — all aimed at
  multi-team, multi-repo organizations coordinating shared conventions
  across many engineers. This is a single-developer, single-repo project;
  adopting those now would be process for its own sake. Revisit if that
  changes.
- [ ] Checkpoint: trigger the Stop hook once, confirm it *proposes* a
  `CLAUDE.md` addition rather than writing it directly, and that a human
  approval step is actually required before it lands; trigger the
  pre-commit hook with a deliberately broken file, confirm it blocks the
  commit without modifying anything itself.
- [ ] Archive snapshot: `DaywiseDirectoryStructure/day6.md`

---

## Day 7 — Deployment to Vercel (free tier), additive not replacing local dev (outline)

**Why this order:** every prior day only ran locally. This day adds a real
deployed environment without taking anything away from local dev — every
change below is a config-driven *branch* (env var present vs. absent), the
same shape as `lib/ai.ts`'s existing OpenAI-or-fallback pattern, not a
replacement of how local dev already works.

**Facts checked live, not from memory** (pricing/limits change):
- Neon free tier: 500 MB storage, pgvector on all plans, compute **scales to
  zero after 5 min idle and auto-resumes on the next query** — no manual
  action needed. Preferred over Supabase's free tier, which instead **pauses
  entirely after 1 week of inactivity** and needs a manual dashboard
  un-pause — a worse fit for a low-traffic serverless deployment.
- Vercel Hobby: function duration 10s default / 60s max (without Fluid
  compute), 45 min build time, 100 GB fast data transfer, 1M invocations —
  all comfortably above what this app needs. Licensed for personal,
  non-commercial use per Vercel's terms.
- Vercel does not run `pnpm dev`/`pnpm start` as a persistent process — it
  builds once (`next build`) and deploys each route as an on-demand
  serverless function. This matters for `lib/db.ts`'s `globalThis`-cached
  connection singleton, which doesn't behave the same way across separate
  serverless invocations — Neon's pooled connection string (built for this
  exact pattern) is the mitigation, not a rewrite of the singleton itself.

- [ ] `lib/github.ts` — give `listIssues()` (and any other `gh`-shelling
  function) a dual path, same shape as `classify()`/`embed()`:
  - **If `GITHUB_TOKEN` is set** → real GitHub REST API via `fetch()`. This
    is what Vercel's env vars would set, since no `gh` binary or local
    `gh auth login` session exists there.
  - **If `GITHUB_TOKEN` is unset** → unchanged: shell out to the `gh` CLI,
    exactly as it does today. Local dev is untouched.
- [ ] `lib/db.ts` — add a `DATABASE_SSL` env var. Unset locally (current
  no-SSL behavior unchanged); set to `"require"` only in Vercel's project
  settings, where `DATABASE_URL` points at Neon instead of local Supabase.
- [ ] Provision a Neon free-tier project, get its pooled connection string
  (the one meant for serverless use).
- [ ] Run `pnpm migrate` **once, manually**, from a local machine, pointed at
  the Neon `DATABASE_URL` — not wired into an automatic build/deploy step.
  *Why manual:* consistent with the human-in-the-loop standing rule in
  `CLAUDE.md` — a broken migration auto-run on every deploy could silently
  break every future deployment; a manual run keeps a human in that loop.
- [ ] Create the Vercel project (free Hobby tier), connect it to this repo's
  git remote, set env vars: `DATABASE_URL` (Neon, pooled), `DATABASE_SSL=require`,
  `GITHUB_TOKEN` (new — a personal access token), `OPENAI_API_KEY` (optional,
  same as local).
- [ ] Deploy. Confirm `pnpm validate`-equivalent checks pass against the
  deployed URL (adapt `scripts/smoke.ts` to accept a `$BASE_URL` override
  instead of always assuming `localhost:3000`).
- [ ] Checkpoint: click through the deployed app exactly as done for the Day
  3 local checkpoint — dashboard, issues list, an issue detail page, all 4
  action buttons — confirm real network calls (GitHub REST API, Neon) work
  end to end from the deployed environment, not just locally.
- [ ] Archive snapshot: `DaywiseDirectoryStructure/day7.md`

---

## Explicitly out of scope this week
- Real automated dispatch / agent-driven workflow execution — `/api/dispatch` is a simulated stub, not a live integration yet
- Any git branch/worktree lifecycle automation — not needed for this app's current scope
