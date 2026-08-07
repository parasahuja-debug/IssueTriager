# app/api/ — the map of this directory

This is the bible for `app/api/`: what every route does, and the
conventions to follow when touching or adding one. Checked against every
file currently here (`grep -rn "export async function" app/api/` across all
11 `route.ts` files, then each file read in full). Root `CLAUDE.md` still
applies everywhere else; this file is the detailed layer for routes
specifically.

**Keeping this current:** nothing auto-updates this table. If you add,
remove, or change the behavior of a route under `app/api/`, update the
table below in the same change — don't leave it to a future session to
notice the drift. (A Stop hook that *proposes* doc updates at session end
is planned — see root `CLAUDE.md`'s Day 6 notes — but until it exists,
this is a manual discipline, not an automated one.)

## What's here

| Route | Method | Does |
|---|---|---|
| `sync/route.ts` | POST | Pulls issues for a repo via `listIssues()`, upserts into `issues` (keyed on `github_repo, github_number`), auto-classifies any newly-synced issue that has no classification row yet (via `classifyIssue()`). Doesn't embed or plan. |
| `classify/[id]/route.ts` | POST | Runs `classifyIssue(id)` — category/priority/complexity/summary — appending a new `classifications` row. |
| `similar/[id]/route.ts` | POST | Re-embeds the issue, upserts its vector into `similar_issues`, returns the 3 nearest other issues by cosine distance. Decision-support only — never merges/closes/tags anything. |
| `plan/[id]/route.ts` | POST | Runs `generatePlan()`, appends a new `plans` row. Never touches `classifications`. |
| `dispatch/[id]/route.ts` | POST | **Simulated stub.** Refuses without a plan on file; otherwise fabricates a branch name via `createBranchName()` and inserts a `runs` row with `status = 'dispatched'`. No real agent or git branch. |
| `repos/route.ts` | GET / POST | GET lists `tracked_repos`. POST adds one — rejects a `.git`-suffixed name outright (see Non-obvious in root `CLAUDE.md`), records `added_by` as the local OS username. |
| `analyze/estimate/route.ts` | POST | Zero-spend pre-flight: gathers the real input (free GitHub reads), reports fallback-will-be-used or computes a token/cost estimate. Never calls a real model. |
| `analyze/route.ts` | POST | The route that actually spends money — calls `analyzeRepo()`, gated behind an explicit `confirmed: true` (a server-side backstop, not just a UI-level check). Writes one `analysis_runs` row and one `proposed_issues` row per proposal, all `status = 'pending'`. |
| `proposed/route.ts` | GET | Lists `proposed_issues`, optionally filtered by `?status=`, joined with `analysis_runs` for the model used. |
| `proposed/[id]/approve/route.ts` | POST | Files a real GitHub issue via `createIssue()`, inserts it into `issues` with `source = 'analyzer'`, marks the proposal `approved`, classifies the new issue immediately. The one action that turns a proposal into a real issue. |
| `proposed/[id]/reject/route.ts` | POST | Marks a proposal `rejected`. Row is kept forever, never deleted — a permanent audit trail. |

## Mostly POST, with two read-only GET exceptions
`repos` and `proposed` are the only `GET` handlers in this directory — both
read-only, no mutation. No `PUT`/`DELETE`/`PATCH` appears anywhere here.
Don't add a GET handler to a route that mutates anything; if a new route
only reads and that data isn't already needed by a route handler for
another reason, consider fetching straight from a server component instead
of adding a route at all.

`export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`
are set at the top of every route file — copy both when adding a new one.

## Verb-named subdirectories for sub-actions
Two spots nest an extra path segment under a resource to represent an
action, instead of a body-field switch on one handler:
- `analyze/estimate/` sits under `analyze/` — the free pre-flight check
  before `analyze/` itself spends money.
- `proposed/[id]/approve/` and `proposed/[id]/reject/` sit under
  `proposed/[id]/` — two separate action-routes scoped to one proposal,
  rather than a single `proposed/[id]/route.ts` branching on e.g.
  `{ action: "approve" }`.

Follow this shape for a new sub-action on an existing resource: a new
directory named after the verb, not a query param or body-field switch.

## `[id]` vs `[number]`
Every dynamic route segment under `app/api/` is `[id]` and means the DB
primary key (`issues.id`, `proposed_issues.id`, etc.) — **not** the GitHub
issue number. The one place in the whole app keyed by GitHub issue number
instead is `app/issues/[number]/page.tsx`, outside `app/api/` entirely.
Don't introduce a second numbering convention inside `app/api/`; if a route
needs the GitHub number, look it up from `id` inside the handler rather
than accepting `[number]` as the route param.

## `id` validation pattern
Route params arrive as strings straight from the URL. Every `[id]`-keyed
handler (`classify`, `plan`, `dispatch`, `similar`, `proposed/[id]/approve`,
`proposed/[id]/reject`) validates it the same way before it touches a
query — copy this shape rather than reinventing it:

```ts
if (!/^\d+$/.test(id)) {
  return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
}
const issueId = parseInt(id, 10);
if (!Number.isSafeInteger(issueId) || issueId < 1 || issueId > 2147483647) {
  return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
}
```

The upper bound matches Postgres `integer`'s max — a numeric-looking id
that overflows it should 400, not reach the DB as a truncated/wrapped
value. `approve`/`reject` additionally re-check the row's current `status`
after the id check and 400 if it's not `'pending'` (e.g. `"already
approved"`) — copy that too for any action-route that shouldn't fire twice.

## Response shape and error handling
Every response body is `{ ok: boolean, ... }`. On error: `{ ok: false,
message }`. Two error-handling shapes both appear here — match whichever
fits the route you're touching, don't mix them within one handler:
- **try/catch with message sniffing** (`classify`, `similar`, `sync`,
  `plan`, `proposed/[id]/approve`'s `createIssue()` call): catch broadly,
  derive `message` from `err instanceof Error ? err.message : "<fallback>"`,
  then pick a status by inspecting that message (e.g. `"issue not found"` →
  404, a failed external call → 502, else 500) rather than always 500ing.
- **upfront validation, no try/catch** (`repos` POST, `analyze` POST,
  `analyze/estimate` POST): reject bad input with an explicit 400 before
  doing any work, and let unexpected runtime errors surface as an
  unhandled 500 rather than being caught and reshaped. Used where the
  fallback-is-happy-path rule (root `CLAUDE.md`) means there's nothing to
  catch — `analyzeRepo()` doesn't throw for a missing API key, only for
  real failures worth a bare 500.
- A failure in one sub-step doesn't always fail the whole request: `sync`
  swallows a single issue's classification failure so the rest of the sync
  still completes; `approve` swallows a post-approval classification
  failure the same way, since the GitHub issue is already filed and the
  local row already recorded by that point — undoing either would be worse
  than leaving the issue unclassified. Reach for this pattern when a later
  optional step failing shouldn't roll back a completed earlier one.

Either way, `message` is user-facing — see root `CLAUDE.md`'s "No internal
implementation details in user-facing text" rule. Never let a file path,
module name, or internal function name leak into it.

## Business logic lives in `lib/`, not in the route
Routes are thin wrappers: validate params, call one or more `lib/`
functions, shape the response. `classify/[id]` delegates entirely to
`lib/classify.ts`'s `classifyIssue()` rather than reimplementing
fetch→classify→persist inline — see root `CLAUDE.md`'s "Where things live".
If a new route's logic would be more than a few lines, it likely belongs in
`lib/` so other call sites (sync's auto-classify, approve's auto-classify,
etc.) can reuse it instead of drifting.

## Not covered by `pnpm validate`
`scripts/smoke.ts` (run by `pnpm validate`) only hits page routes — `/`,
`/issues`, `/issues/1` — never anything under `app/api/` directly. A broken
API route (bad SQL, a thrown error, a wrong status code) will not fail
`pnpm validate` unless it happens to also break a page that calls it
server-side. Don't treat a green `pnpm validate` as proof an API change
works — hit the route by hand (`curl`/UI action) before believing it does.
