// POST /api/proposed/[id]/approve
// Files the proposed issue as a real GitHub issue (gh issue create), copies
// it into the local issues table with the real number/url (source =
// 'analyzer' — still traceable to its origin), and classifies it immediately
// via the same classifyIssue() the manual "Classify" button and sync's
// auto-classify path use. Nothing before this point was ever a real issue —
// this is the one action that makes it one.
//
// COMMENTED 2026-08-06: previously this inserted a local-only issues row
// with a synthetic github_number (1,000,000,000 + proposed.id) and no
// classification, since nothing was ever actually filed on GitHub. User
// wanted approval to file a real issue instead, so the synthetic-number
// scheme and CLAUDE.md's note about it are no longer accurate — see
// createIssue() in lib/github.ts for the replacement.
import { NextResponse } from "next/server";
import { userInfo } from "node:os";
import { sql } from "@/lib/db";
import { createIssue, listRepoLabels } from "@/lib/github";
import { classifyIssue } from "@/lib/classify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProposedRow = {
  id: number;
  github_repo: string;
  title: string;
  body: string | null;
  status: string;
  // ADDED 2026-08-07: needed to match against the repo's existing labels.
  category_guess: string | null;
  priority_guess: string | null;
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
    SELECT id, github_repo, title, body, status, category_guess, priority_guess
    FROM proposed_issues WHERE id = ${proposedId} LIMIT 1
  `) as unknown as ProposedRow[])[0];
  if (!proposed) return NextResponse.json({ ok: false, message: "not found" }, { status: 404 });
  if (proposed.status !== "pending") {
    return NextResponse.json({ ok: false, message: `already ${proposed.status}` }, { status: 400 });
  }

  const reviewer = userInfo().username;

  // ADDED 2026-08-07: only apply labels that already exist on the target
  // repo — never create a missing one (see CLAUDE.md's labels-gap note).
  // category_guess/priority_guess (e.g. "bug", "P1") are the candidates;
  // a repo with no matching label just gets no label for that slot.
  const existingLabels = await listRepoLabels(proposed.github_repo).catch(() => [] as string[]);
  const candidateGuesses = [proposed.category_guess, proposed.priority_guess].filter(
    (g): g is string => !!g,
  );
  const matchedLabels = candidateGuesses
    .map((guess) => existingLabels.find((l) => l.toLowerCase() === guess.toLowerCase()))
    .filter((l): l is string => !!l);

  let created: { number: number; url: string };
  try {
    created = await createIssue(
      proposed.github_repo,
      proposed.title,
      proposed.body || "(no description provided)",
      matchedLabels,
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Failed to create GitHub issue" },
      { status: 502 },
    );
  }

  const [newIssue] = (await sql`
    INSERT INTO issues (github_repo, github_number, title, body, state, url, labels, github_created_at, source)
    VALUES (
      ${proposed.github_repo},
      ${created.number},
      ${proposed.title},
      ${proposed.body},
      'open',
      ${created.url},
      ${matchedLabels},
      NOW(),
      'analyzer'
    )
    RETURNING id, github_number
  `) as unknown as { id: number; github_number: number }[];

  await sql`
    UPDATE proposed_issues
    SET status = 'approved', reviewed_by = ${reviewer}, reviewed_at = NOW()
    WHERE id = ${proposedId}
  `;

  try {
    await classifyIssue(newIssue.id);
  } catch {
    // A classification failure shouldn't undo the approval — the issue is
    // already filed on GitHub and recorded locally either way.
  }

  return NextResponse.json({
    ok: true,
    issueId: newIssue.id,
    githubNumber: newIssue.github_number,
    url: created.url,
    message: `approved — filed as GitHub issue #${newIssue.github_number}`,
  });
}
