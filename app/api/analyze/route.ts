// POST /api/analyze
// The route that actually spends money: calls analyzeRepo(), which makes a
// real model call if a real provider + key was chosen (skips straight to
// the free fallback otherwise). Gated behind an explicit confirmed:true in
// the body — a server-side safety net alongside the UI's own confirm step,
// forcing /api/analyze/estimate to have been called first. Logs an
// analysis_runs row, then inserts every proposal into proposed_issues as
// 'pending'. Nothing here becomes a real issue yet.
import { NextResponse } from "next/server";
import { userInfo } from "node:os";
import { sql } from "@/lib/db";
import { getRepoContext, getFileContent } from "@/lib/github";
import { analyzeRepo, type AnalyzeInput, type AnalyzeProvider } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  repo?: string;
  kind?: "metadata" | "file";
  path?: string;
  provider?: AnalyzeProvider;
  model?: string;
  confirmed?: boolean;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { repo, kind, path, provider, model, confirmed } = body;

  if (!repo || (kind !== "metadata" && kind !== "file") || !provider) {
    return NextResponse.json(
      { ok: false, message: "repo, kind ('metadata' | 'file'), and provider are required" },
      { status: 400 },
    );
  }
  if (kind === "file" && !path) {
    return NextResponse.json({ ok: false, message: "path is required for kind='file'" }, { status: 400 });
  }
  if (confirmed !== true) {
    return NextResponse.json(
      { ok: false, message: "confirmed:true is required — call /api/analyze/estimate first and get explicit confirmation" },
      { status: 400 },
    );
  }

  let input: AnalyzeInput;
  if (kind === "metadata") {
    const context = await getRepoContext(repo);
    input = { kind: "metadata", context };
  } else {
    const content = await getFileContent(repo, path!);
    if (content === null) {
      return NextResponse.json({ ok: false, message: `file not found: ${path}` }, { status: 404 });
    }
    input = { kind: "file", path: path!, content };
  }

  const { proposals, model: usedModel } = await analyzeRepo(input, provider, model);

  const [run] = (await sql`
    INSERT INTO analysis_runs (github_repo, scope, file_paths, requested_by, model)
    VALUES (${repo}, ${kind}, ${kind === "file" ? [path!] : null}, ${userInfo().username}, ${usedModel})
    RETURNING id
  `) as unknown as { id: number }[];

  for (const p of proposals) {
    await sql`
      INSERT INTO proposed_issues (analysis_run_id, github_repo, title, body, category_guess, priority_guess, kind, status)
      VALUES (${run.id}, ${repo}, ${p.title}, ${p.body}, ${p.categoryGuess}, ${p.priorityGuess}, ${kind}, 'pending')
    `;
  }

  return NextResponse.json({
    ok: true,
    analysisRunId: run.id,
    model: usedModel,
    proposedCount: proposals.length,
    message: `${proposals.length} issue(s) proposed (${usedModel}), pending review`,
  });
}
