// GET/POST /api/repos
// The multi-repo registry: which repos this app knows about, persisted so
// the UI's repo selector remembers them across visits instead of re-asking.
import { NextResponse } from "next/server";
import { userInfo } from "node:os";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TrackedRepo = { github_repo: string; added_by: string | null; added_at: string };

export async function GET() {
  const repos = (await sql`
    SELECT github_repo, added_by, added_at FROM tracked_repos ORDER BY added_at ASC
  `) as unknown as TrackedRepo[];
  return NextResponse.json({ ok: true, repos });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { github_repo?: string };
  const repo = body.github_repo?.trim();
  // .git suffix rejected outright (not stripped) — a repo added with it once
  // silently broke sync since issues never landed against the .git-suffixed
  // name; see tracked_repos cleanup 2026-08-06.
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || /\.git$/i.test(repo)) {
    return NextResponse.json(
      { ok: false, message: "github_repo must look like owner/name (no .git suffix)" },
      { status: 400 },
    );
  }

  // No auth system exists in this app — added_by is the local OS username,
  // a best-effort attribution, not a secure audit trail.
  const addedBy = userInfo().username;

  await sql`
    INSERT INTO tracked_repos (github_repo, added_by)
    VALUES (${repo}, ${addedBy})
    ON CONFLICT (github_repo) DO NOTHING
  `;

  return NextResponse.json({ ok: true, repo, message: `tracking ${repo}` });
}
