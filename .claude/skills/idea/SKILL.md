---
name: idea
description: Append a "good to have" feature idea to IDEAS.md — a running backlog, not committed work.
disable-model-invocation: true
allowed-tools: Read, Edit, Write, Bash
---

# Idea

Append the idea below to `IDEAS.md` as a new entry. Do not implement it, plan
it, or touch any other file — this skill's only job is capturing the thought
before it's lost, quickly, without derailing whatever's currently being
worked on.

**Idea:** "$ARGUMENTS"

## Workflow

1. Get today's date via `date "+%Y-%m-%d"` — never guess it.
2. If `IDEAS.md` doesn't exist at the repo root, create it first with a short
   header explaining what it is (a running backlog, separate from `PLAN.md`).
3. Append one new line at the end of the list, in this exact format:
   `- $ARGUMENTS (YYYY-MM-DD)`
4. Confirm back in one short sentence what was added — don't summarize the
   whole file, don't ask follow-up questions about the idea, don't propose
   scoping or implementation details.

## Rules

- Never edit or remove existing entries — this file is append-only, same
  spirit as this project's other standing "comment/append, don't delete"
  convention.
- Never touch any file other than `IDEAS.md`.
- If `$ARGUMENTS` is empty, ask what idea to add instead of guessing or
  appending a blank entry.
