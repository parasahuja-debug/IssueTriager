---
description: Fresh-context review of a specific PR, the current branch's PR, or the working-tree diff — via the code-reviewer subagent.
argument-hint: [pr-number]
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task"]
---

# Review PR

Run a review using the `code-reviewer` subagent. Exactly one diff is
reviewed per run — never "all PRs."

**Principle:** The session that wrote the code should not be the session that
reviews it. `code-reviewer` starts with a blank context window — it has not
seen any of the reasoning that went into this diff, so it evaluates it cold.

**Target:** "$ARGUMENTS"

## Workflow

1. **Resolve exactly one diff to review**, in this order:
   - **If `$ARGUMENTS` is a PR number** (e.g. `42`): use that specific PR,
     regardless of which branch is currently checked out —
     `gh pr view $ARGUMENTS --json number,url,title,headRefName,body` and
     `gh pr diff $ARGUMENTS` for the actual diff.
   - **If `$ARGUMENTS` is empty**: resolve the PR tied to the *current* git
     branch — `gh pr view --json number,url,title,headRefName,body`.
   - **If no PR exists for the current branch either**: fall back to the
     uncommitted working-tree diff (`git diff` for unstaged, `git status` to
     confirm there's something to review). This is the only case where
     there's no PR at all — still exactly one diff, just not a PR's.
   - Note the files changed and, if a PR exists, its stated intent from the
     PR body.

2. **Launch `code-reviewer`** (via the `Task` tool) with:
   - The list of changed files
   - The diff itself, or clear instructions on how to obtain it (`gh pr diff
     <number>`, `git diff`, `git diff --staged`, or `git diff main...HEAD`)
   - A one-paragraph summary of intent, if available from a PR body
   - An instruction to focus on the diff, not the rest of the repo

3. **Present the subagent's findings as-is.** `code-reviewer` already reports
   every issue it finds, categorized Critical/Important/High/Medium/Low with
   a verdict — don't summarize it down or drop any severity tier.

4. **Do not apply fixes automatically.** This command's job is review, not
   edits. If you want fixes applied, address them in a normal session after
   reading the report.

## Usage

```
/review-pr
# Reviews the current branch's PR, or the working-tree diff if no PR exists.

/review-pr 42
# Reviews PR #42 specifically, regardless of the current branch.
```

## Notes

- `code-reviewer` is described in `.claude/agents/code-reviewer.md` — it has
  its own system prompt and is restricted to read-only tools (`Bash`, `Glob`,
  `Grep`, `Read`), so it can report issues but never edit code itself.
- If the diff is trivial (docs-only, single-line fix), still run the full
  review — `code-reviewer` reports everything it finds regardless of size,
  so a trivial diff should just come back with a short, mostly-empty report.
