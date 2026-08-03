// POST /api/classify/[id]
// Takes one issue already synced into the DB and decides what it is: category,
// priority, complexity, plus a summary/reasoning. This is the route that actually
// calls into lib/ai.ts's classify() — real OpenAI call if OPENAI_API_KEY is set,
// rule-based fallback otherwise (see lib/ai.ts, that branch is the "happy path").
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { classify } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { id: number; title: string; body: string | null; labels: string[] };

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

  const rows = (await sql`
    SELECT id, title, body, labels FROM issues WHERE id = ${issueId} LIMIT 1
  `) as unknown as Row[];
  const issue = rows[0];
  if (!issue) return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });

  try {
    const c = await classify({ title: issue.title, body: issue.body, labels: issue.labels });
    // INSERT, not UPDATE: classifications is append-only history, one row per
    // classify call. The UI is expected to read the latest row per issue.
    await sql`
      INSERT INTO classifications (issue_id, category, priority, complexity, summary, reasoning, model)
      VALUES (${issue.id}, ${c.category}, ${c.priority}, ${c.complexity}, ${c.summary}, ${c.reasoning}, ${c.model})
    `;
    return NextResponse.json({
      ok: true,
      classification: c,
      message: `classified as ${c.category} / ${c.priority} / ${c.complexity}`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "classify failed" },
      { status: 500 },
    );
  }
}
