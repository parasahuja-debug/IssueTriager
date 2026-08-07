
# About Project 

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

------
------
------

# Daywise Plan -

## Day1 in Plan.md

Create virtual env - yourself
Install dependencies and run steps yourself - 1.1 to 1.6 (refer Supabase README.md for detailed commands)

----

## Day2 in Plan.md

Create db.ts in /lib folder for portgres connection - As Postgres has a hard cap on concurrent connections. If every API route created postgres(url) itself, you'd open a new connection pool per request 
    Then change scripts/db-check.ts to use the same connection from lib
    Then test - npx tsx scripts/db-check.ts

Create lib/github.ts - reusing that means zero token management in our code, instead of REST API.
    make sure to login. gh auth login - (Pick GitHub.com → HTTPS → Login with a web browser, and follow the prompt.)
    Select a repo and create the issues.

Create script/sync-issues.ts to list down all the check of how the issues would function. 
    adding its entry in package.json. 
        (Right now, running sync-issues.ts requires typing 
        npx tsx scripts/sync-issues.ts from memory every time. Adding a "sync": "tsx scripts/sync-issues.ts" entry to package.json's scripts block turns that into pnpm sync — a short, memorable, documented command. It's the exact same reasoning we used for pnpm migrate on Day 1:)
    run - pnpm sync and it adds the rows to the DB. in Issues table.

Create ai.ts in lib - for three things mainly classify(issues), generation(issues) and embedding(issues)
    All three have there part to play - 
    1. classify(issue) — reads an issue's title/body/labels and decides: is this a bug, a feature request, a question? How urgent (P0–P3)? How hard to fix (small/medium/large)? Like a human triager skimming a ticket and slapping tags on it.
    2. embed(issue) — converts the issue's text into a list of numbers (a "fingerprint"). We don't build this to read — we build it so the computer can compare two issues mathematically and say "these two fingerprints are close together, so these issues are probably about the same thing." That's what powers "similar issues" later.
    3. generatePlan(issue) (Day 3, not today) — writes a short suggested implementation plan.

    And there is fallback to do it using the script only.

    No Api key needed till you have build the entire application.

Create app/api/sync - to sync the issues from the UI expose it as an API call.
    kind of similar to the script/sync-issues.ts, where insert is added to the db post sync.

Create app/api/classify/[id] to -
    Takes one issue already in the DB (looked up by its id), and decides what kind of issue it is: category (bug/feature/question/docs/chore), priority (P0–P3), complexity, plus a summary/reasoning. Yes — it calls classify() straight from lib/ai.ts (line 3, 27 above), so this is exactly where our OpenAI-or-fallback branching gets exercised for real. The result gets INSERTed as a new row in **classifications** — note it's an INSERT, never UPDATE: every classify call adds a new history row rather than overwriting, which is why **classifications** is one-to-many per issue (the dashboard just reads the latest one).

Create seeds.ts in scripts - 
    seed.ts chains all three steps we've built — sync, classify, embed — into one script, so pnpm seed populates real rows end to end without clicking three separate buttons. It's the Day 2 checkpoint script.
 the run pnpm seed.ys post adding it in package.json and see what happened.

------

## Day3 in Plan.md

Adding createbranchname in github.ts - the only reason where we would be actually initiating the worktrees for each issue that would be reported. Real harness would come where we would be implementing - would spin up an isolated git branch/worktree to actually attempt the fix. 

> Type check is something we would be doing whenerver we are going to add any piece of code - cd /Users/parasahuja/github/IssueTriagerFromScratch && pnpm exec tsc --noEmit 2>&1 | head -50

Adding route.ts in api - similar issues for specific ID, 
    - reason one for similarity search, every issue is embedded and checked into the database containing the 
    issues
    - returning the similar issues if found and adding the issues in db if none returned based on the similarity searh and score.

Create plans - 
    POST /api/plan/[id]. It's the simplest of the remaining three routes — takes an issue by id, calls 
    generatePlan() from lib/ai.ts (real OpenAI call or the mock-template fallback), and INSERTs the markdown result into **plans table**. structured as ## Context / ## Approach / ## Files to touch / ## Validation / ## Risks

Create dispatch -  POST /api/dispatch/[id]
    It reads the issue and its latest plan (refuses to dispatch if no plan exists yet — you can't work a fix without a plan), calls createBranchName(), and inserts a **runs table** row with status: 'dispatched'.
    /api/dispatch/[id] looks like it dispatches an issue to an autonomous coding agent (records a branch name, a "dispatched" status, timestamps), but nothing actually runs — no agent spins up, no code gets written, no branch gets created in git. It's there so the rest of the app (the runs table, the UI's "Dispatch" button, the workflow shape) is complete and testable now, and later

Create global.css in app folder.
    For the formating of the UI page.

Create layout.tsx 
    layout of the page with the naming convention, themetoggle, nav links ( Dashboard/Issues)
    component folder - Themetoggle.tsx

Create page.tsx - 
    Data fetching functions-
        adding get stats - to get the status of the issues from multiple queries.
        get category - 
            since classifications is append-only (one row per classify call, history preserved), we can't    just GROUP BY category directly — that would double-count an issue classified twice. So it first picks the latest classification per issue (DISTINCT ON (issue_id) ... ORDER BY issue_id, created_at DESC), then groups that by category to get counts. This feeds the "By Category" panel.
        getByPriority() — 
            same exact pattern as getByCategory(), just grouping on priority instead of category, for the "By Priority" panel.
        getRecentIssues() — 
            this one's a bit different. It needs both issue fields and that issue's latest classification together in one row, so instead of DISTINCT ON it uses a LEFT JOIN LATERAL: for each issue row, it runs a correlated subquery ("give me this specific issue's latest classification") and joins the result alongside it. LEFT JOIN (not JOIN) means unclassified issues still show up, just with null category/priority. Feeds the "Recent issues" list — top 8 by creation date.
    
    components -
        StatCard, since Home will use it.
            What it does: a tiny reusable card — label on top, big number below. Renders once per stat (Issues, Open, Classified, Planned, Runs). Uses our .card class from globals.css.

        Last component: Home, the actual page. It calls all four data functions in parallel (Promise.all, so they run concurrently instead of one after another), then renders: a header with a SyncButton, the 5 StatCards, the category/priority breakdown panels, and the recent-issues list. SyncButton itself doesn't exist yet — I'll stub the import now and we'll build that component next, right after this.
        
        Promis.all()-
            Promise.all([...]) takes an array of promises (here, the 4 async calls to getStats(), getByCategory(), getByPriority(), getRecentIssues()) and runs them concurrently — it kicks off all 4 Postgres queries at roughly the same time instead of waiting for each one to finish before starting the next. 
        
        Syncbutton.tsx. - 
            page.tsx imports SyncButton, which we haven't built yet. Let's do that now.
            What it does: a small client component with a button. On click, it fetches POST /api/sync, shows the returned message (e.g. "synced 5 issue(s)..."), then calls router.refresh() — that re-runs the server component (Home, including all 4 data queries) so the stats/lists update with the newly synced data, without a full page reload.
        
Create - the issues list page (app/issues/page.tsx) with filters. - get issues()
    FilterRow - import Link from "next/link";
    Last piece for this file: IssuesPage, the default export. It reads searchParams (the URL's query string — Next.js gives it as a promise you await), calls getIssues() with it, and renders the filter bar (3 FilterRows) plus the filtered list.

Create- the issue detail page (app/issues/[number]/page.tsx) 
    the biggest remaining piece, showing the issue itself plus classification, similar issues, plan, and dispatch runs, each in their own panel.

    component - 
        [number] is the GitHub issue number, not the DB primary key — so this queries WHERE github_number = ..., unlike the classify/plan/similar/dispatch routes which take the DB id. Same integer-validation pattern as before, but calls notFound() (Next.js's built-in 404 page trigger) instead of returning JSON, since this is a page, not an API route.

    IssueDetail runs 5 queries (issue, classification, plan, similar, runs) and stores each result in a variable, then renders all of them together in one page.
        - the latest classification for this issue (same "one row, most recent" pattern we've used throughout).
        classification is just a local variable inside the same IssueDetail component, holding the result of one query. This whole file is really one component (IssueDetail); the "Classification", "Similar issues", "Plan", and "Dispatch runs" sections you'll see are just JSX blocks rendered one after another inside that single component's return, not separate React components.

        - the similar-issues query — this one's different from /api/similar's logic. It doesn't call embed() at all; it just reads whichever embedding is already stored for this issue (from the last time /api/similar or pnpm seed ran) and compares it against all other stored embeddings via a CROSS JOIN on a one-row subquery (target.embedding). If this issue has never been embedded, target is empty and similar comes back empty too.

        - the plan query — same "latest row" pattern.

        - dispatch runs — up to 5 most recent, newest first.

create page.tsx- the actual JSX — issue header, the (not-yet-built) IssueActions buttons, then the 4 panels (Classification, Similar issues, Plan, Dispatch runs), each showing either real data or a "not yet done, click the button above" placeholder message.

create IssueActions.tsx - in components called in issues/number/page.tsx

create - scripts/smoke.ts — a basic health check: it starts from the assumption the dev server is already running, then hits a few key routes (/, /issues, /issues/1) and fails loudly if any return a 5xx server error. I

update package.json - 
    "smoke": "tsx scripts/smoke.ts",
    "typecheck": "tsc --noEmit",
    "validate": "pnpm typecheck && pnpm smoke"

start dev server - 
cd /Users/parasahuja/github/IssueTriagerFromScratch && pnpm dev > /tmp/nextdev.log 2>&1 &
echo "started with PID $!"

------

## Day4 in Plan.md

Update the Claude.md file in Project root - 
    Containing - **Run** what has the system need to run and commands , and why you'd use to run them.
    **Non Obvious** what is not regular - A file name, fallback of Open API, how tables are functioning.

Then lets move to plan.md - slash command - 
    Generally to build the plan around something that we want to build - we will type /plan and the argument of what is needed, then there would be the plan created for us to edit and that's how we can leverage it/edit it to actually implement the functionality.

code-reviewer.md in .claude/agents - 
    Mainly to actually have a separate mind and report for any issues, invoked by the slash command review-pr.md
    this is needed so that there is fresh mind looking at the issues with the model categorisation that everything is fine.

review-pr.md - which invokes code reviewer. A major point to note is it is confined to this repo only. To find the bugs on this worktree and or review the already raised PR.


--------

## Day 5 in Plan.md

002_analyzer.sql - 
    - issues.source : tags every issue 'github' (synced from a real reporter) or 'analyzer' (self-generated), defaulting existing rows to 'github'.
    - tracked_repos : the multi-repo registry: which repos this app knows about, who added each one, when.
    - analysis_runs : one row per analysis ever triggered (metadata-level or file-scoped), regardless of what it found.
    - proposed_issues : the human-in-the-loop staging area. Nothing here is a real issue yet; only an explicit approval copies a row into issues.

pnpm migrate - to run all the .sql. The existing 001_init.sql runs without changes.

Run to validate - psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d issues" -c "\dt tracked_repos" -c "\dt analysis_runs" -c "\dt proposed_issues"

Edits in lib/github.ts - Two new functions in lib/github.ts, both using gh api. gh api would be editted with new API
for cloud migrations in Day7. **These additions are mainly to suggest issues basis content, if any basis just metadata traversal** -
    - getRepoContext(repo)   : repo description/topics, the README's raw text, the last 20 commit messages, and existing open issue titles (for de-duplication)
    - getFileContent(repo, path) : the file-scoped depth: fetches one specific file's real raw content, same raw-media-type trick.

Create lib/token.ts - Mainly to find out the tokens going to be used if you want to investigate the issues.
    Calls pricing.ts for the prices.

pricing.ts - only prices for the different models.

pnpm add @anthropic-ai/sdk @google/genai - before writing Editing lib/ai.ts
    cd /Users/parasahuja/github/IssueTriagerFromScratch && pnpm add @anthropic-ai/sdk @google/genai
    cd /Users/parasahuja/github/IssueTriagerFromScratch && pnpm approve-builds 2>&1  ------Approve pending build scripts for the new packages
    pnpm approve-builds @google/genai protobufjs 2>&1 ----------Approve build scripts non-interactively
    pnpm exec tsc --noEmit 2>&1 | head -50  -------(typcheck)

Editing lib/ai.ts - Multiproviders added to check the issues as per the suggestion.
    function - analyzeRepo()

app/api/repos/route.ts — the multi-repo registry, POST to add, GET to list. 
    this is to check what are the tracked repos, add if is not in the list and get if there.

app/api/analyze/estimate/route.ts - to provide the estimates to the user before prociding for the issue analysis.

POST /api/analyze - run the analysis on the issue - real spend is happenning as ai calls are made to analyse.

POST /api/proposed/[id]/approve
    analyzeRepo() generates candidate issues and they get written to proposed_issues with status = 'pending'. At this point, nothing is a real issue yet — it's just sitting in the staging table, visible for a human to review.
    "Giving new" (creating a real issue + assigning the synthetic github_number) only happens here, at approval time — this POST /api/proposed/[id]/approve route. A human looks at a specific pending proposal and explicitly approves it; only then does a row get copied into the real issues table.

POST /api/proposed/[id]/reject - simpler: just marks as rejected, same logging. Never deleted, always kept as audit record.

.claude/commands/analyze-repo.md — the slash command entry point for running analysis from the CLI.
----
UI components - 

RepoSelector.tsx - RepoSelector fetches the list of tracked repos from the database and displays each with metadata (who added it, when).

app/analyze/page.tsx - analyze page to select the repo

add RepoSelectorProps in RepoSelector.tsx - for select
    What we're adding:
        Track which repo is selected with state
        Make repo cards clickable
        Highlight the selected repo with different styling
        Call onRepoSelected callback so parent knows which repo was picked


update page.tsx - once selector added

create components/AnalyzeForm.tsx
    Add "Add New Repo" Form - in RepoSelector.tsx - to select any New repo
    Step 1 of AnalyzeForm: Build the kind picker (metadata vs file)
        What it does:
        Two radio buttons or toggle: "Repository Metadata" or "Specific File"
        Switching changes which fields show below
        Stores choice in state
    
    import in page.tsx

app/page.tsx - add analyze form to main page.

/api/proposed - page to list and manage proposed issues

/api/layout.tsx - entry for proposed

IssueBadges.tsx - to show the issues is the already reported issue on git or tracked from analyzer.

Change issues/page.tsx to get the badge and issues number page as well.

Repo filter.tsx -  and add it in /app/page.tsx for main page rendering

SuccessModal.tsx - for the add repo button on analyze page

Repomanager.tsx - 
    Add Repository form — user enters "username/repo" and adds it
    RepoFilter list — shows all tracked repos to select from
    SuccessModal — pops up when repo is added successfully, then refreshes the list

Add repofilter in main page - /app/page.tsx - for by repository filter

RecordView/Recent view - on main page to display the recent items.

-------------
# Day6 in Plan.md

stop and start hooks - seetings.json file update
and a skill to - 
    the exact JSON field names Claude Code expects for "block the stop and feed this text back" vs. "inject this as context at session start" — that's the part the skill is needed for, so code don't get the schema wrong and end up with a hook that silently never fires.
