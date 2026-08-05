> Archive snapshot — see `README.md` in this folder. Not documentation of
> current state; do not use this to reason about the project.

# Snapshot: end of Day 4

Directory tree (excluding `node_modules/`, `.git/`, `.next/`, the Python venv,
and this archive folder itself; unchanged-since-Day-3 entries noted, not
re-explained):

```
.
├── .claude/
│   ├── agents/                  # NEW directory
│   │   └── code-reviewer.md     # NEW — completeness-first review subagent
│   ├── commands/                # NEW directory
│   │   ├── plan.md              # NEW — /plan, research + write a plan file only
│   │   └── review-pr.md         # NEW — /review-pr [pr-number]
│   └── settings.json            # unchanged since Day 1
├── .env
├── .env.example
├── .vscode/
├── CLAUDE.md                    # refined — real gotchas from Days 1-3
├── PLAN.md                      # Day 4 checkboxes closed out, Day 5 outline added
├── README.md
├── SCRUB-NOTES.md               # NEW, gitignored — not part of this snapshot's tree in spirit, but present on disk
├── app/                         # unchanged since Day 3
├── components/                  # unchanged since Day 3
├── eslint.config.mjs
├── lib/                         # unchanged since Day 3
├── migrations/
│   └── 001_init.sql             # unchanged since Day 1
├── next-env.d.ts
├── next.config.ts
├── package.json                 # unchanged since Day 3
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── public/
├── scripts/                     # unchanged since Day 3
├── supabase/                    # unchanged since Day 1
└── tsconfig.json
```

## What each new thing does, and why

- **`CLAUDE.md` refinements** — added a "Where things live" section (the
  `[id]` vs `[number]` routing distinction, `lib/db.ts` as the only module
  calling `postgres()` directly) and 8 new "Non-obvious" bullets covering
  everything actually learned the hard way in Days 1-3: local-vs-cloud SSL,
  the fallback-is-happy-path pattern, append-only (`classifications`/`plans`)
  vs upsert (`similar_issues`) table semantics, the dispatch stub's real
  behavior, the CSS `*/`-in-comment bug class, and the Nebula theme naming
  convention. Written now, not on Day 1, specifically so every line reflects
  something actually hit rather than guessed in advance.
- **`.claude/commands/plan.md`** — `/plan <task>` researches a task against
  this project's real files (`CLAUDE.md`, `PLAN.md`, relevant source) and
  writes a plan to `.claude/plans/<slug>.md`. `allowed-tools` deliberately
  excludes `Edit`, so it is structurally unable to modify any existing file —
  not just told not to. Separates "decide the approach" from "do the work."
- **`.claude/agents/code-reviewer.md`** — a subagent, meaning a separate,
  blank-context Claude instance invoked to review code with no memory of why
  it was written that way. Adapted on request to be completeness-first:
  every issue found gets reported and categorized (Critical/Important/High/
  Medium/Low), none discarded for being minor — a deliberate change from a
  more typical "high-confidence only" reviewer. `tools` restricted to
  read-only (`Bash`, `Glob`, `Grep`, `Read`) — it can report, never edit.
- **`.claude/commands/review-pr.md`** — `/review-pr` (current branch's PR, or
  the working-tree diff if none exists) or `/review-pr <number>` (a specific
  PR regardless of current branch). Always exactly one diff per run, never
  "all PRs." Delegates the actual review to `code-reviewer`.

## Checkpoint result — a real limitation hit

Attempted to run the Day 4 checkpoint (`/review-pr` against the Day 3 diff)
by invoking the `Agent` tool with `subagent_type: "code-reviewer"`. This
**failed**: `Agent type 'code-reviewer' not found. Available agents:
general-purpose, statusline-setup, claude, Explore, Plan, claude-code-guide`.

This environment's `Agent` tool only recognizes a fixed, built-in roster of
agent types — it does not automatically discover project-defined subagents
from `.claude/agents/*.md`, unlike how a real local Claude Code CLI session
would wire them up. Worth remembering: in this environment, `/review-pr`'s
described behavior (launch a genuinely isolated `code-reviewer` process) is
not actually achievable end-to-end. The review was still completed, but by
manually following `code-reviewer.md`'s process inline in the same session —
which loses the actual point of the subagent (fresh eyes, no bias from
having written the code). The command and agent files themselves are correct
and would work as designed in a real local CLI session; the gap is specific
to this hosted environment's tool surface.

## Commands run today (chronological, roughly)
1. `CLAUDE.md` refined by hand — "Where things live" section added, 8 new "Non-obvious" bullets
2. `.claude/commands/plan.md` written by hand, `allowed-tools` scoped to exclude `Edit`
3. `.claude/agents/code-reviewer.md` — first drafted close to a reference structure, then revised twice on request: project-specific review table instead of generic categories, then switched from "discard below 80" to "report everything, categorize Critical/Important/High/Medium/Low"
4. `.claude/commands/review-pr.md` — first drafted, then revised to precisely scope `/review-pr` vs `/review-pr <number>`, explicitly never "all PRs"
5. Full scrub pass: removed every mention of the other codebase this project was built alongside (and "Archon"/"Neon" naming) from `lib/github.ts`, `app/api/dispatch/[id]/route.ts`, `scripts/smoke.ts`, `app/globals.css` (x3), `CLAUDE.md`, `PLAN.md`, `DaywiseDirectoryStructure/day2.md`, `day3.md` — detailed before/after + reasoning for every change written to `SCRUB-NOTES.md` (gitignored, not committed)
6. Attempted `/review-pr` checkpoint via the `Agent` tool — failed (custom subagent not recognized in this environment); completed the review manually instead
7. `PLAN.md` — Day 4 checkboxes corrected from unchecked to `[x]` (they'd been built but never marked done), checkpoint entry written up honestly with the limitation noted
8. `DaywiseDirectoryStructure/day4.md` (this file) written
