# lib/ — the map of this directory

The bible for `lib/`: what every file/export does, and the conventions to
follow when touching or adding one. Checked against every file currently
here (`grep -n "^export " lib/*.ts`, then each file read in full — 6 files,
778 lines total). Root `CLAUDE.md` still applies everywhere else; this file
is the detailed layer for `lib/` specifically.

**Keeping this current:** nothing auto-updates this table. If you add,
remove, or change the behavior of an export in `lib/`, update the table
below in the same change — see `app/api/CLAUDE.md`'s identical note for why
(a Stop hook to *propose* this kind of update is planned, not built yet).

## What's here

| File | Exports | Does |
|---|---|---|
| `db.ts` | `sql` | The one shared Postgres client. Singleton cached on `globalThis.__sql` outside production so Next.js dev hot-reload doesn't open a new pool on every reload. Throws at import time if `DATABASE_URL` is unset — this is the one file allowed to do that (see "Single DB client" below). |
| `github.ts` | `listIssues`, `createBranchName`, `getRepoContext`, `getFileContent`, `listRepoLabels`, `createIssue` | Every GitHub interaction in the app. Day 7 gave all 5 `gh`-shelling functions a REST-API-or-`gh`-CLI dual path (see "Third fallback shape" below) — CLI calls go via `execFile` (never `exec`/string-shelled), REST calls via `fetch()`. `createBranchName` fabricates a name for the simulated dispatch stub — no real branch created. `getRepoContext` gathers metadata-depth analyzer input (description/topics/README/commits/open-issue-titles). `getFileContent` gathers file-depth analyzer input, returns `null` on a missing path rather than throwing. `createIssue` files a real issue (used by proposal approval); `listRepoLabels` supports it by finding which guessed labels actually exist on the target repo. |
| `ai.ts` | `classify`, `embed`, `generatePlan`, `vectorToSqlLiteral`, `AnalyzeProvider`, `isProviderAvailable`, `buildAnalyzePromptText`, `resolveAnalyzeModel`, `analyzeRepo` | Every real-or-fallback model call. `classify`/`embed`/`generatePlan` are the Day 2/3 single-provider shape (OpenAI-or-fallback, auto-detected from `OPENAI_API_KEY`). `analyzeRepo` is the Day 5 multi-provider shape (OpenAI/Anthropic/Gemini/fallback, explicit human choice — never auto-detected). `vectorToSqlLiteral` formats an embedding for a raw `::vector` SQL cast. |
| `classify.ts` | `classifyIssue` | The one place fetch→classify→persist logic lives (see root `CLAUDE.md`'s "Where things live"). Throws `"issue not found"` if the id doesn't exist — the exact string `/api/classify/[id]`'s route sniffs to return 404 instead of 500. |
| `tokens.ts` | `estimateTokens`, `estimateCost`, `formatUsd`, `CostEstimate` | Pure arithmetic (char-count / 4, then rate lookup) — no AI call, no network. Used by `/api/analyze/estimate` to show a cost *before* anything is spent. `estimateCost` returns `null` for a model missing from `pricing.ts`, rather than throwing or guessing a rate. |
| `pricing.ts` | `MODEL_PRICING`, `TokenPricing` | Static per-model $/1M-token table, checked live against provider pricing pages on 2026-08-06 — not a live lookup, so it drifts. Re-verify before trusting it for real budgeting. |

## Single DB client — one file calls `postgres()` directly
`db.ts` is the only file in the entire app that imports `postgres` and
calls `postgres(connectionString, ...)`. Every other file — routes,
scripts, other `lib/` files — imports `sql` from `@/lib/db` and uses it.
Never instantiate a second client anywhere, even for a one-off script;
extra clients exhaust the connection pool, which is exactly what this
singleton exists to prevent (see root `CLAUDE.md`'s Day 2 note). If a new
script needs the DB, `import { sql } from "@/lib/db"` — don't reach for
`postgres` directly.

## Two fallback shapes — pick the one that matches what you're extending
`lib/ai.ts` contains two genuinely different fallback patterns; know which
one a given function follows before copying it:
- **Auto-detected, single-provider** (`classify`, `embed`, `generatePlan`):
  checks `process.env.OPENAI_API_KEY` internally via `getOpenAI()`, silently
  uses the rule-based/hash-based/template mock if it's unset. The caller
  never chooses — there's exactly one provider, present or absent. This is
  the Day 2 shape; the fallback is the happy path for local dev, not an
  error case, so **don't wrap these call sites in try/catch** hoping to
  catch a "no key" condition — there's nothing to catch.
- **Explicit, multi-provider** (`analyzeRepo`): the caller passes a
  `provider` (`"openai" | "anthropic" | "gemini" | "fallback"`) chosen by a
  human up front — never auto-detected from whichever key happens to be
  set. `isProviderAvailable(provider)` lets the caller check and surface
  "no key configured, will use fallback" *before* calling `analyzeRepo()`
  at all (see `/api/analyze/estimate`'s use of it). This is the Day 5
  shape, used because *which* provider matters for the cost estimate shown
  before spending — auto-detection would make that estimate a guess.

If you add a new AI-backed capability, pick whichever shape matches: no
real per-call cost worth surfacing up front → single-provider
auto-detected; user should see and confirm a cost/provider first →
explicit multi-provider.

## Third fallback shape — REST-API-or-`gh`-CLI (`github.ts`, Day 7)
All 5 `gh`-shelling functions in `github.ts` follow a third
present/absent-env-var shape, alongside the two above: `usingRestApi()`
checks `process.env.GITHUB_TOKEN` — if set, the function calls GitHub's
REST API directly via `fetch()` (`ghApiFetch`/`ghApiFetchRaw` helpers); if
unset, it shells out to `gh` exactly as before. `GITHUB_TOKEN` is set only
in Vercel's project settings, since no `gh` binary or `gh auth login`
session exists in a serverless deploy — local dev never sets it, so
behavior there is unchanged. `GITHUB_API_MODE` (`"rest" | "cli"`) is an
optional explicit override on top of that default, checked first inside
`usingRestApi()` — set it to force one path regardless of `GITHUB_TOKEN`
presence (e.g. to exercise the REST path locally). Leave it unset and
nothing changes. Unlike the two shapes above, the branch point here isn't
"real call vs. mock" — both branches call the real GitHub API, just via
different transports. If you add a 6th `gh`-shelling function, give it the
same `usingRestApi()` branch rather than leaving it `gh`-only.

## `gh` CLI via `execFile`, never `exec` (and REST via `fetch`, never templated)
Every GitHub interaction in `github.ts` shells out via
`execFile("gh", [...argsArray])`, not `exec("gh " + userInput)`. Passing
args as an array (not a concatenated string) is what keeps a repo name,
file path, or issue title from ever being interpreted by a shell — don't
switch to `exec`/template-string invocation even for a "quick" addition;
that reintroduces shell-injection risk from a value that ultimately traces
back to user input (the repo name typed into `/api/repos`, a file path
typed into the analyze UI, etc.). The REST branch added in Day 7 carries
the same care forward differently: repo/path values are interpolated into
the request URL, but auth always goes through the `Authorization` header,
never appended to a URL or logged — don't add a code path that puts
`GITHUB_TOKEN` anywhere but that header.

## Expected-absence vs. real error
Two different failure-handling shapes appear in `github.ts`, and the
difference is intentional, not inconsistent:
- **Returns `null`/empty on an expected "not found"**: `getFileContent`
  returns `null` for a missing path — a mistyped path is a normal,
  expected outcome for a human picking a file in the analyze UI, not a bug.
  `getRepoContext`'s README fetch similarly catches and falls back to
  `null` — plenty of repos just don't have one.
- **Throws on everything else**: `getRepoContext`'s repo-info/commits/
  issues calls, `listRepoLabels`, `createIssue` — a missing repo, a bad
  token, or an unexpected `gh` output shape (see `createIssue`'s explicit
  "Unexpected output" throw) means something is actually wrong, and the
  caller's try/catch (see `app/api/CLAUDE.md`'s error-handling section)
  is what turns that into a proper error response.

When adding a new `gh`-backed function, ask whether the failure is a
normal outcome a human caused (mistyped input → return `null`/empty) or an
unexpected condition (→ let it throw).
