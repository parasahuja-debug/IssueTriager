---
description: Analyze a remote repo for candidate issues (metadata or file-scoped), with cost estimation and human approval.
argument-hint: [repo] [kind] [path or "all"] [provider]
allowed-tools: ["Bash", "Read", "WebFetch"]
---

# Analyze Repo

Analyze a GitHub repository for candidate issues at two depths: metadata-level (README, commits, description, topics) or file-scoped (real code, scanning for TODOs/FIXMEs/HANGs). Runs the full staged flow: gathers the input, estimates cost, asks for confirmation, runs the analysis, and returns proposals.

**Arguments** (all required):

1. `repo` — owner/repo format (e.g., `parasahuja-debug/IssueTriager`)
2. `kind` — `"metadata"` or `"file"`
3. `path` — for kind="file", the exact file path (e.g., `src/lib/ai.ts`); for kind="metadata", use `"all"`
4. `provider` — `"openai"` | `"anthropic"` | `"gemini"` | `"fallback"`

**Optional argument:**

5. `model` — override the default model for the chosen provider (e.g., `gpt-5-mini` for OpenAI). Omit to use the default.

## Workflow

1. **Check provider availability.** If the chosen provider's key isn't set, tell the user the fallback will be used (free, no cost). If they chose `"fallback"` explicitly, skip straight to running (no estimation needed).

2. **Estimate cost** (if a real provider with a key):
   - Call `POST /api/analyze/estimate` with repo, kind, path, provider, model.
   - Display the estimate in currency format (`$X.YZ`), the approximation note, and the model being used.
   - Ask for explicit confirmation (`yes` / `no`) before proceeding.

3. **Run the analysis** (on confirmation):
   - Call `POST /api/analyze` with the same params **plus `confirmed: true`**.
   - Display the number of proposals and the model used.

4. **Show the proposals:**
   - Fetch the newly created `analysis_run_id` from the response.
   - Call `GET /api/proposed?analysis_run_id=<id>` to list the pending proposals (use `?` query param filtering).
   - For each proposal, display:
     - Title
     - Body (first 100 chars)
     - Category guess + priority guess
     - Kind (`metadata` or `file`)
     - Direct link to approve/reject: `/api/proposed/<id>/approve` or `/api/proposed/<id>/reject`

## Notes

- The fallback is always free (no API spend). Show this immediately so the user knows.
- Estimates are approximate; direct the user to verify against the provider's pricing page.
- Approved proposals become real issues (with a synthetic `github_number` starting at 1,000,000,000), immediately classifiable and planable like any other issue.
- Rejected proposals are kept forever as an audit trail.
