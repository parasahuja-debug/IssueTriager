// Shared classify-and-persist logic — extracted from /api/classify/[id]/route.ts
// so /api/sync's auto-classify-if-new path and the manual "Classify" button
// call the exact same code, instead of two copies drifting apart over time.
import { sql } from "@/lib/db";
import { classify, ClassifyResult } from "@/lib/ai";

type Row = { id: number; title: string; body: string | null; labels: string[] };

export async function classifyIssue(issueId: number): Promise<ClassifyResult> {
  const rows = (await sql`
    SELECT id, title, body, labels FROM issues WHERE id = ${issueId} LIMIT 1
  `) as unknown as Row[];
  const issue = rows[0];
  if (!issue) throw new Error("issue not found");

  const c = await classify({ title: issue.title, body: issue.body, labels: issue.labels });
  // INSERT, not UPDATE: classifications is append-only history, one row per
  // classify call. The UI is expected to read the latest row per issue.
  await sql`
    INSERT INTO classifications (issue_id, category, priority, complexity, summary, reasoning, model)
    VALUES (${issue.id}, ${c.category}, ${c.priority}, ${c.complexity}, ${c.summary}, ${c.reasoning}, ${c.model})
  `;
  return c;
}
