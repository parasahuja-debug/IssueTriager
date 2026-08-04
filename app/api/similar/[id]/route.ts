// POST /api/similar/[id]
// Re-embeds one issue, upserts that vector into similar_issues, then finds the
// 3 closest other issues by cosine distance (pgvector's `<=>` operator).
// This is a decision-support signal, not an automatic action: it never merges,
// closes, or tags anything as a duplicate — it just reports what looks similar
// so a human (or a later automation) can decide what to do about it.
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { embed, vectorToSqlLiteral } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { id: number; title: string; body: string | null };
type SimilarRow = { github_number: number; title: string; similarity: number };

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  }
  const issueId = parseInt(id, 10);
  if (!Number.isSafeInteger(issueId) || issueId < 1 || issueId > 2147483647) {
    return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  }

  const rows = (await sql`SELECT id, title, body FROM issues WHERE id = ${issueId} LIMIT 1`) as unknown as Row[];
  const issue = rows[0];
  if (!issue) return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });

  try {
    const text = `${issue.title}\n\n${issue.body || ""}`;
    const { vector, model } = await embed(text);
    const lit = vectorToSqlLiteral(vector);
    // Upsert: one current embedding per issue, refreshed on every re-embed.
    await sql`
      INSERT INTO similar_issues (issue_id, embedding, model)
      VALUES (${issue.id}, ${lit}::vector, ${model})
      ON CONFLICT (issue_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model
    `;

    // Cosine distance (<=>) against every other stored vector; smallest
    // distance = most similar. `1 - distance` turns it into a similarity score.
    const matches = (await sql`
      SELECT
        i2.github_number,
        i2.title,
        1 - (s.embedding <=> ${lit}::vector) AS similarity
      FROM similar_issues s
      JOIN issues i2 ON i2.id = s.issue_id
      WHERE s.issue_id <> ${issue.id}
      ORDER BY s.embedding <=> ${lit}::vector ASC
      LIMIT 3
    `) as unknown as SimilarRow[];

    return NextResponse.json({
      ok: true,
      model,
      matches,
      message: `embedded (${model}), ${matches.length} neighbor(s)`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "similar failed" },
      { status: 500 },
    );
  }
}
