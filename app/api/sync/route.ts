// POST /api/sync
// HTTP wrapper around the same upsert logic as scripts/sync-issues.ts, so the
// dashboard's "Sync" button can trigger a GitHub -> DB pull without a terminal.
// Touches the `issues` table, and — 2026-08-06 — also auto-classifies any
// synced issue that has no classification row yet, via the same classifyIssue()
// the manual "Classify" button uses. Already-classified issues are left alone
// (classifications is append-only; re-classifying every sync would spam
// duplicate rows). Does not embed or plan anything.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { listIssues } from "@/lib/github";
import { classifyIssue } from "@/lib/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Repo comes from the dashboard's repo picker (user selects which tracked
  // repo to sync); GITHUB_REPO env var is the fallback for older callers/scripts.
  const body = (await req.json().catch(() => ({}))) as { repo?: string };
  const repo = body.repo?.trim() || process.env.GITHUB_REPO;
  if (!repo) {
    return NextResponse.json({ ok: false, message: "No repository specified and GITHUB_REPO not set" }, { status: 400 });
  }

  try {
    const issues = await listIssues(repo, 50);
    let classifiedCount = 0;
    for (const gh of issues) {
      // Upsert: re-running sync updates existing rows (title/body/labels/state)
      // instead of duplicating, keyed on the (repo, issue number) unique constraint.
      const [{ id: issueId }] = (await sql`
        INSERT INTO issues (
          github_repo, github_number, title, body, state, author, url, labels,
          github_created_at, github_updated_at, synced_at
        )
        VALUES (
          ${repo},
          ${gh.number},
          ${gh.title},
          ${gh.body || null},
          ${gh.state.toLowerCase()},
          ${gh.author?.login || null},
          ${gh.url},
          ${gh.labels.map((l) => l.name)},
          ${gh.createdAt},
          ${gh.updatedAt || null},
          NOW()
        )
        ON CONFLICT (github_repo, github_number) DO UPDATE SET
          title = EXCLUDED.title,
          body = EXCLUDED.body,
          state = EXCLUDED.state,
          labels = EXCLUDED.labels,
          synced_at = NOW()
        RETURNING id
      `) as unknown as { id: number }[];

      const [{ count: existingClassifications }] = (await sql`
        SELECT COUNT(*)::int AS count FROM classifications WHERE issue_id = ${issueId}
      `) as unknown as { count: number }[];

      if (existingClassifications === 0) {
        try {
          await classifyIssue(issueId);
          classifiedCount++;
        } catch {
          // A single issue's classification failing shouldn't fail the whole
          // sync — it just stays unclassified, same as before this feature.
        }
      }
    }
    return NextResponse.json({
      ok: true,
      repo,
      count: issues.length,
      message:
        issues.length === 0
          ? `No issues found in ${repo} — nothing to sync`
          : `synced ${issues.length} issue(s) from ${repo}, classified ${classifiedCount} new`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}
