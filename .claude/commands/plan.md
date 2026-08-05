---
description: Research a task in this codebase and write an implementation plan to .claude/plans/ — never touches application code.
argument-hint: [task description]
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Write"]
---

# Plan

Research the task below in this codebase and write a plan file describing how
you'd implement it. Do not write or edit any application code — this command
exists specifically to separate "figuring out the approach" from "doing the
work," so the plan can be reviewed before anything changes.

**Task:** "$ARGUMENTS"

## Workflow

1. **Read `CLAUDE.md` and `PLAN.md`** first, so the plan is grounded in this
   project's actual conventions (naming, fallback patterns, table shapes,
   route structure) instead of generic advice.
2. **Research the relevant code.** Use `Grep`/`Glob`/`Read` to find the files,
   functions, routes, or tables the task would touch. Read enough to be
   specific — file paths and function names, not vague area names.
3. **Write the plan** to `.claude/plans/<short-slug>.md` (create the
   `.claude/plans/` folder if it doesn't exist yet). Use a short kebab-case
   slug derived from the task, e.g. `.claude/plans/add-labels-filter.md`.

## Plan file format

```markdown
# Plan: <task title>

## Goal
One or two sentences: what should be true when this is done.

## Relevant files
- `path/to/file.ts` — why it's relevant, what's there now

## Approach
Numbered steps, concrete enough that someone unfamiliar with the task could
follow them. Reference real function/route names, not placeholders.

## Open questions
Anything genuinely ambiguous that should be resolved before implementing —
skip this section if there isn't anything.
```

## Rules

- **Never edit or create any file outside `.claude/plans/`.** No exceptions,
  even if the task seems small enough to "just do." This command's whole job
  is planning, not implementing.
- If the task is too vague to plan concretely (no clear scope, contradicts
  something in `CLAUDE.md`), say so in the plan's "Open questions" section
  rather than guessing.
- Keep the plan proportional to the task — a one-file change doesn't need
  ten steps.
