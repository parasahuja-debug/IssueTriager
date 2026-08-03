> Archive snapshot — see `README.md` in this folder. Not documentation of
> current state; do not use this to reason about the project.

# Snapshot: end of Day 2

Directory tree (excluding `node_modules/`, `.git/`, the Python venv, and this
archive folder itself; unchanged-since-Day-1 entries noted, not re-explained):

```
.
├── .claude/
│   └── settings.json          # unchanged since Day 1
├── .env                       # unchanged shape; still local-only, gitignored
├── .env.example
├── .vscode/
├── CLAUDE.md                  # unchanged since Day 1
├── PLAN.md                    # Day 2 checkboxes closed out
├── README.md
├── app/
│   ├── api/                   # NEW — HTTP routes
│   │   ├── sync/
│   │   │   └── route.ts       # POST /api/sync — GitHub -> issues table, no AI
│   │   └── classify/
│   │       └── [id]/
│   │           └── route.ts   # POST /api/classify/[id] — calls lib/ai.ts's classify()
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── eslint.config.mjs
├── lib/
│   ├── ai.ts                  # NEW — classify()/embed()/generatePlan(), each OpenAI-or-fallback
│   ├── db.ts                  # unchanged since Day 1
│   └── github.ts              # unchanged since Day 1
├── migrations/
│   └── 001_init.sql           # unchanged since Day 1
├── next-env.d.ts
├── next.config.ts
├── package.json                # +openai dependency, +seed script
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── public/
├── scripts/
│   ├── db-check.ts             # unchanged since Day 1
│   ├── migrate.ts              # unchanged since Day 1
│   ├── seed.ts                 # NEW — sync + classify + embed chained, `pnpm seed`
│   └── sync-issues.ts          # unchanged since Day 1
├── supabase/                   # unchanged since Day 1 (config.toml quirk still intentional)
└── tsconfig.json
```

## What each new thing does, and why

- **`lib/ai.ts`** — the AI layer. `classify()`, `embed()`, and `generatePlan()` each
  branch once at the top: real OpenAI call if `OPENAI_API_KEY` is set, deterministic
  fallback otherwise. The fallback is not error handling — it's the default local-dev
  path, so the app works fully offline for free. Fallback details: `classify()` uses
  keyword/label pattern matching (`mock-rule-based-v1`); `embed()` hashes tokens with
  SHA256 into a stable 1536-dim vector (`mock-hash-v1`) so cosine similarity behaves
  consistently even without a real embedding model. The `openai` package is installed
  and the real-call code path is fully written — just dormant until a key is added.
- **`app/api/sync/route.ts`** — same upsert logic as `scripts/sync-issues.ts`, exposed
  over HTTP so a future dashboard button can trigger a sync from the browser instead
  of a terminal. Touches only `issues`; no AI calls.
- **`app/api/classify/[id]/route.ts`** — looks up one issue by its DB `id` (validated
  as a plain positive integer first), calls `classify()` from `lib/ai.ts`, and
  `INSERT`s the result into `classifications`. This is the first piece of code in the
  project that actually calls the AI layer. `INSERT`, not `UPDATE`: `classifications`
  is append-only history, one row per classify call — the future UI reads the latest.
- **`scripts/seed.ts`** — chains sync -> classify -> embed into one `pnpm seed`
  command, for a single end-to-end checkpoint run. Reuses `lib/db.ts`'s shared
  Postgres client (unlike the reference repo's `seed.ts`, which opens its own
  connection) to stay consistent with how `scripts/sync-issues.ts` already does it.

## Day 2 checkpoint result

Ran `pnpm seed` against the 5 real GitHub issues synced on Day 2:
- All 5 synced into `issues` (upsert, no duplicates).
- All 5 classified via the rule-based fallback (`classify_model = mock-rule-based-v1`).
  Two issues ("Add reusable helper functions...", "Add Gemini API connection
  settings") were tagged `bug` by the keyword rules where a human might call them
  `feature` — a known rough edge of keyword matching vs. real language understanding,
  worth re-checking once a real model is wired in.
- All 5 embedded via the hash fallback (`embed_model = mock-hash-v1`), confirmed
  1536 dimensions each via `vector_dims()` — same shape a real OpenAI embedding
  would produce, so nothing downstream (Day 3's cosine similarity query) needs to
  change when a real key is added later.
- Total cost: $0, zero external API calls made.

## Commands run today (chronological, roughly)
1. `lib/ai.ts` written by hand, mirroring the reference repo's `classify()`/`embed()`/`generatePlan()` structure
2. `pnpm add openai` — needed even with the fallback path active, since the import is static
3. `app/api/sync/route.ts` written by hand
4. `app/api/classify/[id]/route.ts` written by hand
5. `pnpm exec tsc --noEmit` — confirmed no type errors after each new file
6. `scripts/seed.ts` written by hand, `"seed"` script added to `package.json`
7. `pnpm seed` — full pipeline run, checked via `psql` queries against `classifications` and `similar_issues`
