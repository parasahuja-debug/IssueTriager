> Archive snapshot — see `README.md` in this folder. Not documentation of
> current state; do not use this to reason about the project.

# Snapshot: end of Day 3

Directory tree (excluding `node_modules/`, `.git/`, `.next/`, the Python venv,
and this archive folder itself; unchanged-since-Day-2 entries noted, not
re-explained):

```
.
├── .claude/
├── .env
├── .env.example
├── .vscode/
├── CLAUDE.md
├── PLAN.md                    # Day 3 checkboxes closed out
├── README.md
├── app/
│   ├── api/
│   │   ├── sync/route.ts       # unchanged since Day 2
│   │   ├── classify/[id]/route.ts  # unchanged since Day 2
│   │   ├── similar/[id]/route.ts   # NEW — embed + pgvector cosine k-NN
│   │   ├── plan/[id]/route.ts      # NEW — calls generatePlan()
│   │   └── dispatch/[id]/route.ts  # NEW — simulated dispatch stub
│   ├── favicon.ico
│   ├── globals.css             # NEW — "Nebula" theme (violet/teal), .card/.badge/.action classes
│   ├── issues/
│   │   ├── page.tsx             # NEW — filterable issues list
│   │   └── [number]/
│   │       └── page.tsx         # NEW — issue detail page (5 queries, 4 panels)
│   ├── layout.tsx               # rewritten — header/nav/footer, "GitHub Checker" branding
│   └── page.tsx                 # rewritten — dashboard (stats, category/priority breakdown, recent issues)
├── components/                  # NEW directory
│   ├── IssueActions.tsx         # NEW — 4 action buttons (classify/embed/plan/dispatch)
│   ├── SyncButton.tsx           # NEW — triggers /api/sync from the dashboard
│   └── ThemeToggle.tsx          # NEW — dark/light switch, persisted to localStorage
├── eslint.config.mjs
├── lib/
│   ├── ai.ts                    # unchanged since Day 2
│   ├── db.ts                    # unchanged since Day 1
│   └── github.ts                # +createBranchName() for the dispatch stub
├── migrations/
│   └── 001_init.sql             # unchanged since Day 1
├── next-env.d.ts
├── next.config.ts
├── package.json                 # +smoke, +typecheck, +validate scripts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── public/
├── scripts/
│   ├── db-check.ts              # unchanged since Day 1
│   ├── migrate.ts               # unchanged since Day 1
│   ├── seed.ts                  # unchanged since Day 2
│   ├── smoke.ts                 # NEW — hits /, /issues, /issues/1, fails on 5xx
│   └── sync-issues.ts           # unchanged since Day 1
├── supabase/                    # unchanged since Day 1 (config.toml quirk still intentional)
└── tsconfig.json
```

## What each new thing does, and why

- **`lib/github.ts`'s `createBranchName()`** — slugifies an issue title into a
  fake branch name (`fix/<number>-<slug>`) for the simulated dispatch step.
  Never touches real git. This is the seam a real dispatch workflow plugs into
  later without changing anything around it.
- **`app/api/similar/[id]/route.ts`** — re-embeds one issue, upserts the vector
  into `similar_issues`, then finds the 3 closest other issues by cosine
  distance (pgvector's `<=>` operator). Decision-support only: it reports
  matches, it never auto-merges, closes, or tags anything as a duplicate.
- **`app/api/plan/[id]/route.ts`** — calls `generatePlan()` from `lib/ai.ts`
  and inserts markdown into `plans`. Fully separate from `classifications` —
  a plan doesn't require or update a classification.
- **`app/api/dispatch/[id]/route.ts`** — a stub: has the right shape (writes a
  `runs` row with a fake branch name and a "dispatched" status) but doesn't
  run any real agent or create any real git branch. Refuses to run without a
  plan already on file. Placeholder for the workflow layer intentionally out
  of scope this week.
- **`app/globals.css`** — "Nebula" theme: violet/teal duotone, with CSS
  variables and class names following an `--ink-*`/`--tag-*`/`--action-*`,
  `.card`/`.badge`/`.action` naming scheme throughout. Tailwind v4's
  `@theme inline` block does the color-name-to-variable mapping (no separate
  `tailwind.config.ts` file needed in this setup).
- **`app/layout.tsx`** — shared header/nav/footer shell every page renders
  inside; branded "GitHub Checker". Includes an inline, blocking `<script>`
  that sets `data-theme` before paint, so the page never flashes the wrong
  theme on load.
- **`app/page.tsx`** — the dashboard. 4 independent Postgres queries run
  concurrently via `Promise.all` (none depend on each other), rendered as 5
  stat cards, 2 breakdown panels, and a recent-issues list.
- **`app/issues/page.tsx`** — filterable issues list. Filters are plain
  `?state=&category=&priority=` URL params (not React state), so filtered
  views are shareable/bookmarkable links.
- **`app/issues/[number]/page.tsx`** — issue detail page. `[number]` is the
  GitHub issue number, not the DB id (only page in the app keyed this way).
  Runs 5 queries, renders 4 panels (classification, similar issues, plan,
  dispatch runs), each showing real data or a "click the button above"
  placeholder.
- **`components/IssueActions.tsx`** — the 4 buttons on the detail page, each
  POSTing to one of the API routes and calling `router.refresh()` afterward so
  the panels update without a full reload. Shares one `pending` state so only
  one action runs at a time; "Dispatch" stays disabled until a plan exists.
- **`components/SyncButton.tsx`** / **`ThemeToggle.tsx`** — small client
  components, same POST-then-refresh pattern (`SyncButton`) and
  localStorage-persisted dark/light toggle (`ThemeToggle`).
- **`scripts/smoke.ts`** — hits `/`, `/issues`, `/issues/1` against an already
  running `pnpm dev`, fails on any 5xx. `pnpm validate` chains this with
  `tsc --noEmit`.

## Bug hit and fixed during the Day 3 checkpoint

`pnpm validate` initially failed: `pnpm typecheck` passed clean, but
`pnpm smoke` reported all 3 routes returning 500. The dev server log showed a
`CssSyntaxError` in `app/globals.css` at line 4 — a prose comment happened to
contain a literal `*/` sequence in the middle of listing variable-name
patterns, which closed the CSS comment early. Everything after that point got
parsed as invalid CSS, breaking every page. Fixed by rewording the comment to
avoid any literal `*/` outside an intentional comment-closer. Caught
immediately by the smoke test rather than by manually clicking through the
browser — exactly the kind of regression `pnpm validate` exists to catch.

## Commands run today (chronological, roughly)
1. `lib/github.ts` — `createBranchName()` added by hand
2. `app/api/similar/[id]/route.ts`, `app/api/plan/[id]/route.ts`, `app/api/dispatch/[id]/route.ts` written by hand
3. `pnpm exec tsc --noEmit` after each new route — confirmed no type errors
4. `app/globals.css` written by hand (Nebula theme, renamed variables/classes)
5. `components/ThemeToggle.tsx`, `app/layout.tsx` rewritten
6. `app/page.tsx` (dashboard) + `components/SyncButton.tsx` written, function by function
7. `app/issues/page.tsx` (list + filters) written, function by function
8. `app/issues/[number]/page.tsx` + `components/IssueActions.tsx` written, query by query
9. `scripts/smoke.ts` written; `smoke`/`typecheck`/`validate` scripts added to `package.json`
10. `pnpm dev` started in the background; `pnpm validate` run — failed on the CSS bug above
11. `app/globals.css` comment fixed; `pnpm validate` re-run — passed (typecheck clean, all 3 routes 200)
12. Manual click-through in the browser — confirmed by the user
