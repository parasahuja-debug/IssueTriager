import "dotenv/config";
import { sql } from "../lib/db";
import { listIssues } from "../lib/github";

async function main() {
  const repo = process.env.GITHUB_REPO;
  if (!repo) throw new Error("GITHUB_REPO not set");

  console.log(`[sync] fetching issues from ${repo}`);
  const issues = await listIssues(repo);
  console.log(`[sync] got ${issues.length} issue(s)`);

  for (const gh of issues) {
    await sql`
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
        author = EXCLUDED.author,
        url = EXCLUDED.url,
        labels = EXCLUDED.labels,
        github_updated_at = EXCLUDED.github_updated_at,
        synced_at = NOW()
    `;
  }

  console.log(`[sync] upserted ${issues.length} issue(s)`);
  await sql.end();
}

main().catch((err) => {
  console.error("[sync] FAILED:", err);
  process.exit(1);
});
