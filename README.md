# Day1 in Plan.md

Create virtual env - yourself
Install dependencies and run steps yourself - 1.1 to 1.6 (refer Supabase README.md for detailed commands)

----

# Day2 in Plan.md

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
    Takes one issue already in the DB (looked up by its id), and decides what kind of issue it is: category (bug/feature/question/docs/chore), priority (P0–P3), complexity, plus a summary/reasoning. Yes — it calls classify() straight from lib/ai.ts (line 3, 27 above), so this is exactly where our OpenAI-or-fallback branching gets exercised for real. The result gets INSERTed as a new row in classifications — note it's an INSERT, never UPDATE: every classify call adds a new history row rather than overwriting, which is why classifications is one-to-many per issue (the dashboard just reads the latest one).

Create seeds.ts in scripts - 
    seed.ts chains all three steps we've built — sync, classify, embed — into one script, so pnpm seed populates real rows end to end without clicking three separate buttons. It's the Day 2 checkpoint script.
 the run pnpm seed.ys post adding it in package.json and see what happened.
----

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
