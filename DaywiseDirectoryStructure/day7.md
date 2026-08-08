# Day 7 — Deployment to Vercel (free tier)

Snapshot informative-only, per this folder's `README.md` — not a source of
truth for current project state (see root `CLAUDE.md`'s "Do not read").

## Tree (top-level, excluding node_modules/.next/.git/this folder)

```
.
├── .claude/                      # settings.json, agents/, commands/, skills/
├── .env, .env.example, .env.neon # env files (all git-ignored via .env*)
├── CLAUDE.md, PLAN.md, IDEAS.md, README.md, SCRUB-NOTES.md
├── app/
│   ├── analyze/page.tsx
│   ├── api/                      # CLAUDE.md + sync, classify, similar, plan,
│   │                              # dispatch, repos, analyze, proposed routes
│   ├── issues/page.tsx, issues/[number]/
│   ├── proposed/page.tsx
│   ├── globals.css, layout.tsx, page.tsx
├── components/                   # AnalyzeForm, IssueActions, IssueBadges,
│                                  # RecentlyViewed, RepoFilter, RepoManager,
│                                  # RepoSelector, SuccessModal, SyncButton,
│                                  # ThemeToggle, RecordView
├── lib/
│   ├── CLAUDE.md
│   ├── ai.ts, classify.ts, db.ts, github.ts, pricing.ts, tokens.ts
├── migrations/                   # 001_init.sql, 002_analyzer.sql
├── scripts/                      # check-doc-drift.sh, migrate.ts, seed.ts,
│                                  # smoke.ts, sync-issues.ts, git-hooks/
├── supabase/                     # local Supabase stack config
└── localvenvissuetriager/        # unrelated stray Python venv, pre-existing
```

## What happened, and why

Every prior day only ran locally. Day 7's point was adding a real deployed
environment without taking anything away from local dev — every change is a
config-driven branch (env var present vs. absent), the same shape as
`lib/ai.ts`'s existing OpenAI-or-fallback pattern from Day 2.

**Code changes (all env-var-gated, local behavior unchanged when unset):**
- `lib/github.ts` — all 5 `gh`-shelling functions (`listIssues`,
  `getRepoContext`, `getFileContent`, `listRepoLabels`, `createIssue`) got a
  REST-API-or-`gh`-CLI dual path. `GITHUB_TOKEN` present → real GitHub REST
  API via `fetch()` (`ghApiFetch`/`ghApiFetchRaw` helpers); absent → `gh` CLI,
  unchanged. Converting all 5 (not just `listIssues`) and adding an explicit
  `GITHUB_API_MODE=rest|cli` override on top of that default were both
  scoped in by explicit request mid-session, not the original plan text.
- `lib/db.ts` — `DATABASE_SSL` env var, passed straight into `postgres()`'s
  `ssl` option. Unset locally (no change); `require` on Vercel, where
  `DATABASE_URL` points at Neon instead of local Supabase.
- `scripts/smoke.ts` — accepts a `$BASE_URL` override so the same 5xx check
  can target a deployed URL instead of always assuming `localhost`.
- `.env.example` — documented the three new vars (`DATABASE_SSL`,
  `GITHUB_TOKEN`, `GITHUB_API_MODE`), all blank/unset by default.
- Both `CLAUDE.md` and `lib/CLAUDE.md` updated with the new conventions —
  a third fallback shape (REST-API-or-CLI) alongside the two documented
  from Day 5, and the `DATABASE_SSL`/`$BASE_URL` additions.

**Infra provisioned (human-only steps, done outside this session's direct
control — Neon/Vercel account actions can't be automated by an assistant):**
- Neon free-tier Postgres project, `CREATE EXTENSION vector` run once,
  pooled connection string obtained. `pnpm migrate` run once manually
  against it (per the human-in-the-loop standing rule — not wired into an
  automatic deploy step). Verified via a one-off table listing: all 8
  tables present.
- Vercel Hobby project created, connected to this repo's GitHub remote, env
  vars set (`DATABASE_URL`, `DATABASE_SSL=require`, `GITHUB_TOKEN`,
  `GITHUB_API_MODE=rest`, optional `OPENAI_API_KEY`). Deployed at
  `https://issue-triager.vercel.app/`.

**Bug hit and fixed during the deploy checkpoint:** `GET /api/proposed`
selected `p.file_path`, a column that never existed on `proposed_issues`
(only `analysis_runs.file_paths`, plural, an array, does) — 500'd every
time the deployed `/proposed` page loaded. Pre-existing, not Neon-specific;
dormant because `pnpm validate`'s smoke test only hits page routes, never
`/api/*` directly (see `app/api/CLAUDE.md`'s "Not covered by `pnpm
validate`" note), and no proposed issue had been loaded through this exact
page locally before. Fixed the query (`a.file_paths`), wrapped the handler
in try/catch so a DB error returns `{ ok: false, message }` instead of a
raw crash, and improved empty/error-state copy in `app/proposed/page.tsx`
and `components/RepoFilter.tsx` to link to `/analyze` instead of
dead-ending — both flagged as real UX gaps during manual testing on the
deployed site.

Also hit and fixed along the way: a real GitHub PAT briefly landed in
`.env.example` (meant to stay a blank template) instead of a real-secret
file — caught before any commit, since `.env*` is git-ignored and the file
was never tracked; moved the pattern to a `.env.neon`-style file instead.

## Commands run

```
npx tsc --noEmit                                   # after every code edit
pnpm migrate                                        # once, manually, against Neon
BASE_URL=https://issue-triager.vercel.app pnpm smoke # 3/3 routes 200
curl https://issue-triager.vercel.app/api/proposed   # verified fix live
curl https://issue-triager.vercel.app/api/repos      # verified real data from Neon
git add / git commit / git push                      # two commits: "day7",
                                                       # "UI bugs - proposed api
                                                       #  and addition on front
                                                       #  page for new users."
```

## Checkpoint

Confirmed by manual click-through on the deployed site (dashboard, issues
list, issue detail, `/analyze`, `/proposed`) — everything worked, including
the `/api/proposed` fix. Real network calls (GitHub REST API via
`GITHUB_TOKEN`, Neon via pooled `DATABASE_URL`) confirmed working end to
end from the deployed environment, not just locally.
