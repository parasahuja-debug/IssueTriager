// POST /api/proposed/[id]/reject
// Marks a proposed_issues row as rejected. Never deleted — stays as part of
// the permanent audit trail of "the analyzer suggested this, a human said no."
import { NextResponse } from "next/server";
import { userInfo } from "node:os";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProposedRow = {
  id: number;
  status: string;
};

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  }
  const proposedId = parseInt(id, 10);
  if (!Number.isSafeInteger(proposedId) || proposedId < 1 || proposedId > 2147483647) {
    return NextResponse.json({ ok: false, message: "bad id" }, { status: 400 });
  }

  const proposed = ((await sql`
    SELECT id, status FROM proposed_issues WHERE id = ${proposedId} LIMIT 1
  `) as unknown as ProposedRow[])[0];
  if (!proposed) return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });
  if (proposed.status !== "pending") {
    return NextResponse.json({ ok: false, message: `already ${proposed.status}` }, { status: 400 });
  }

  const reviewer = userInfo().username;

  await sql`
    UPDATE proposed_issues
    SET status = 'rejected', reviewed_by = ${reviewer}, reviewed_at = NOW()
    WHERE id = ${proposedId}
  `;

  return NextResponse.json({
    ok: true,
    message: "rejected — archived as declined proposal",
  });
}
