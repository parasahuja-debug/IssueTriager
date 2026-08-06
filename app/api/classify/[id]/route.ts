// POST /api/classify/[id]
// Takes one issue already synced into the DB and decides what it is: category,
// priority, complexity, plus a summary/reasoning. Delegates to lib/classify.ts's
// classifyIssue(), the same function /api/sync's auto-classify-if-new path uses,
// so the manual "Classify" button and sync can never drift out of sync with
// each other. That function calls into lib/ai.ts's classify() — real OpenAI
// call if OPENAI_API_KEY is set, rule-based fallback otherwise (see lib/ai.ts,
// that branch is the "happy path").
import { NextResponse } from "next/server";
import { classifyIssue } from "@/lib/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // [id] is a route param (string) straight from the URL, so validate it's a
  // plain positive integer before it ever touches a SQL query or parseInt.
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  }
  const issueId = parseInt(id, 10);
  if (!Number.isSafeInteger(issueId) || issueId < 1 || issueId > 2147483647) {
    return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  }

  try {
    const c = await classifyIssue(issueId);
    return NextResponse.json({
      ok: true,
      classification: c,
      message: `classified as ${c.category} / ${c.priority} / ${c.complexity}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "classify failed";
    return NextResponse.json({ ok: false, message }, { status: message === "issue not found" ? 404 : 500 });
  }
}
