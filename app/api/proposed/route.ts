// GET /api/proposed
// Fetches proposed issues from the staging area, with optional filtering by status.
// Returns all proposed issues (pending, approved, rejected) as a list for the UI to display.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProposedIssue = {
  id: number;
  analysis_run_id: number;
  github_repo: string;
  title: string;
  body: string | null;
  category_guess: string | null;
  priority_guess: string | null;
  kind: string;
  // FIXED 2026-08-08: was p.file_path, a column that has never existed on
  // proposed_issues — only analysis_runs.file_paths (plural, array) does.
  // Broke every call to this route with a 500 ("column p.file_path does not
  // exist"), caught when the deployed proposed-issues page failed to load.
  file_paths: string[] | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  model: string | null;
};

export async function GET(req: Request) {
  // Parse query parameters: ?status=pending or ?status=approved, etc.
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    let issues: ProposedIssue[];

    if (status) {
      // Filter by status and join with analysis_runs to get model info
      issues = (await sql`
        SELECT
          p.id,
          p.analysis_run_id,
          p.github_repo,
          p.title,
          p.body,
          p.category_guess,
          p.priority_guess,
          p.kind,
          a.file_paths,
          p.status,
          p.reviewed_by,
          p.reviewed_at,
          p.created_at,
          a.model
        FROM proposed_issues p
        LEFT JOIN analysis_runs a ON p.analysis_run_id = a.id
        WHERE p.status = ${status}
        ORDER BY p.created_at DESC
      `) as unknown as ProposedIssue[];
    } else {
      // Fetch all proposed issues and join with analysis_runs to get model info
      issues = (await sql`
        SELECT
          p.id,
          p.analysis_run_id,
          p.github_repo,
          p.title,
          p.body,
          p.category_guess,
          p.priority_guess,
          p.kind,
          a.file_paths,
          p.status,
          p.reviewed_by,
          p.reviewed_at,
          p.created_at,
          a.model
        FROM proposed_issues p
        LEFT JOIN analysis_runs a ON p.analysis_run_id = a.id
        ORDER BY p.created_at DESC
      `) as unknown as ProposedIssue[];
    }

    return NextResponse.json({ ok: true, issues });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not load proposed issues. Try again in a moment." },
      { status: 500 },
    );
  }
}
