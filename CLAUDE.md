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
`lib/classify.ts`'s `classifyIssue(issueId)` is the one place fetch→classify→
persist logic lives — used by the manual "Classify" button
(`/api/classify/[id]`), sync's auto-classify-if-new path, and approve's
auto-classify. Add a fourth call site by importing it, not by reimplementing
the insert-a-classification-row logic inline again.

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
- `github_number` is NOT globally unique once more than one repo is tracked
  — every repo's first issue is `#1`. Any link or query keyed by
  `github_number` alone is ambiguous and can silently resolve to the wrong
  repo's issue. `app/issues/[number]/page.tsx` takes an optional `?repo=`
  query param for exactly this reason; every internal link to it
  (`app/issues/page.tsx`, `components/RecentlyViewed.tsx`, the similar-issues
  panel inside the detail page itself) passes `?repo=` — a new link site
  must too, or it inherits the ambiguity.
- Multi-repo tracking has bitten this project twice via *silent* failures,
  not errors: the `github_number` collision above, and earlier a repo added
  with a trailing `.git` (e.g. `owner/name.git`) synced 0 issues with no
  error surfaced, since GitHub's API just returned nothing for the
  mismatched name. Both happened because single-repo-era assumptions
  (global uniqueness, exact-string repo matching) silently stopped holding
  once multi-repo tracking landed. Treat this as a class of risk, not two
  isolated bugs — any new repo-scoped feature should be checked against it.
- The approve flow (`app/api/proposed/[id]/approve/route.ts`) labels a
  filed issue with `category_guess`/`priority_guess` (e.g. `bug`, `P1`) —
  but only if a label with that exact name (case-insensitive) already
  exists on the target repo, via `listRepoLabels()` in `lib/github.ts`. It
  never creates a missing label; a repo with no matching label just gets no
  label for that slot. COMMENTED 2026-08-07 — previously `issues.labels`
  was never populated by anything this app created at all (neither manual
  `gh issue create` calls nor the approve flow passed `--label`):
  <!--
  `issues.labels` is currently never populated by anything this app
  creates — only issues synced from *pre-existing* real GitHub issues carry
  real labels. Both manual `gh issue create` calls and the approve flow's
  `createIssue()` (`lib/github.ts`) don't pass `--label`. Known gap, not yet
  scheduled to a specific day.
  -->
- Don't highlight a "selected" state by adding a second `background`
  utility (e.g. Tailwind's `bg-*`) on an element that already has its own
  hand-written `background` via a `.badge-*` class (`app/globals.css`) —
  both are single-class selectors of equal specificity, so which one wins
  depends on source order in the generated CSS, not on JSX/class order.
  Use `ring-2 ring-glow` instead (a box-shadow layer, not a competing
  background) on already-colored elements; a solid `bg-glow text-card` fill
  is safe only on elements with no competing background class. See the
  selected-filter-pill styling in `app/issues/page.tsx`'s `FilterRow`.
- Pagination is implemented two different ways on purpose, not by
  inconsistency: `RepoFilter`/`RepoSelector` fetch their entire (small,
  bounded) tracked-repos list once and paginate client-side via
  `.slice()`; `app/issues/page.tsx` paginates at the SQL level
  (`LIMIT`/`OFFSET` + `COUNT(*) OVER()` for the total, one round-trip) since
  the `issues` table can grow much larger. Match the new list's likely size
  when adding another paginated list — don't copy whichever pattern is
  physically closest.
- Two unrelated "hooks" mechanisms exist in this project (Day 6) — easy to
  conflate, so don't: (1) **Claude Code hooks** (`Stop`, `SessionStart`)
  registered in `.claude/settings.json`, both calling
  `scripts/check-doc-drift.sh` — proposes a `CLAUDE.md` addition when
  session-changed files under `app/`/`lib/`/`migrations/`/`scripts/` look
  undocumented, never writes one itself. Deduped via a hash cached in
  `.claude/.doc-drift-state` (gitignored) so it doesn't re-block every stop
  attempt for the same unreviewed change — only a *new* set of changes
  re-triggers it. (2) A plain **git pre-commit hook** at
  `scripts/git-hooks/pre-commit` — unrelated to Claude Code entirely,
  would only activate via `git config core.hooksPath scripts/git-hooks`,
  which has **not been run** — the script is written and tracked but
  inert, pending a decision on whether to enable it. Neither script lives
  inside `.claude/`; both live in the project's existing top-level
  `scripts/` folder, referenced by relative path from wherever they're
  registered.

## Explicitly out of scope (Day 6), and why
Deliberately not adopted, not overlooked: org-wide plugin marketplaces, a
dedicated infra-team/DRI role, LSP server integration. All three exist to
help multi-team, multi-repo organizations coordinate shared conventions
across many engineers. This is a single-developer, single-repo project —
adopting any of them now would be process for its own sake, with no one
else to coordinate with. Revisit if that stops being true (a second
contributor joins, or this grows into multiple repos sharing conventions).
