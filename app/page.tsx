import Link from "next/link";
import { sql } from "@/lib/db";
import SyncButton from "@/components/SyncButton";
import { RepoFilter } from "@/components/RepoFilter";
import { RecentlyViewed } from "@/components/RecentlyViewed";

export const dynamic = "force-dynamic";

type Stats = {
  total: number;
  open: number;
  classified: number;
  planned: number;
  runs: number;
};

// One query, 5 subqueries bundled together — feeds the 5 stat cards at the
// top of the dashboard without 5 separate round-trips to Postgres.
async function getStats(): Promise<Stats> {
  const [r] = (await sql`
    SELECT
      (SELECT COUNT(*)::int FROM issues) AS total,
      (SELECT COUNT(*)::int FROM issues WHERE state = 'open') AS open,
      (SELECT COUNT(DISTINCT issue_id)::int FROM classifications) AS classified,
      (SELECT COUNT(DISTINCT issue_id)::int FROM plans) AS planned,
      (SELECT COUNT(*)::int FROM runs) AS runs
  `) as unknown as Stats[];
  return r;
}

type ByCategory = { category: string; count: number };

// Fixed display order — every category always renders, even at count 0, so the
// box never collapses to "no data" once a repo has at least some issues.
const ALL_CATEGORIES = ["bug", "feature", "question", "docs", "chore"] as const;
const ALL_PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

// getByCategory fetches issue counts grouped by category for a specific repo.
// Uses DISTINCT ON to get only the latest classification per issue (since classifications is append-only),
// then groups by category. Filters by github_repo if provided. Zero-fills categories with no rows.
async function getByCategory(repo?: string): Promise<ByCategory[]> {
  const rows = (await sql`
    SELECT category, COUNT(*)::int AS count
    FROM (
      SELECT DISTINCT ON (c.issue_id) c.issue_id, c.category
      FROM classifications c
      JOIN issues i ON c.issue_id = i.id
      WHERE ${repo ? sql`i.github_repo = ${repo}` : sql`1=1`}
      ORDER BY c.issue_id, c.created_at DESC
    ) latest
    GROUP BY category
  `) as unknown as ByCategory[];
  const counts = new Map(rows.map((r) => [r.category, r.count]));
  return ALL_CATEGORIES.map((category) => ({ category, count: counts.get(category) ?? 0 }));
}

type ByPriority = { priority: string; count: number };

// getByPriority fetches issue counts grouped by priority for a specific repo.
// Same DISTINCT ON pattern as getByCategory, but groups by priority instead. Filters by repo if provided. Zero-fills priorities with no rows.
async function getByPriority(repo?: string): Promise<ByPriority[]> {
  const rows = (await sql`
    SELECT priority, COUNT(*)::int AS count
    FROM (
      SELECT DISTINCT ON (c.issue_id) c.issue_id, c.priority
      FROM classifications c
      JOIN issues i ON c.issue_id = i.id
      WHERE ${repo ? sql`i.github_repo = ${repo}` : sql`1=1`}
      ORDER BY c.issue_id, c.created_at DESC
    ) latest
    GROUP BY priority
  `) as unknown as ByPriority[];
  const counts = new Map(rows.map((r) => [r.priority, r.count]));
  return ALL_PRIORITIES.map((priority) => ({ priority, count: counts.get(priority) ?? 0 }));
}

// COMMENTED 2026-08-06: getRecentIssues/RecentIssue backed the dashboard's old
// "Recent issues" box (most-recently-synced issues). Replaced below by the
// client-side RecentlyViewed component, which shows issues the user actually
// opened (via localStorage, written by RecordView on the issue detail page)
// instead of most-recently-synced. Left here, not deleted, in case
// recently-synced needs to come back as a separate box later.
//
// type RecentIssue = {
//   id: number;
//   github_number: number;
//   title: string;
//   state: string;
//   category: string | null;
//   priority: string | null;
// };
//
// async function getRecentIssues(): Promise<RecentIssue[]> {
//   return (await sql`
//     SELECT
//       i.id,
//       i.github_number,
//       i.title,
//       i.state,
//       latest.category,
//       latest.priority
//     FROM issues i
//     LEFT JOIN LATERAL (
//       SELECT category, priority FROM classifications c
//       WHERE c.issue_id = i.id
//       ORDER BY c.created_at DESC LIMIT 1
//     ) latest ON TRUE
//     ORDER BY i.github_created_at DESC
//     LIMIT 8
//   `) as unknown as RecentIssue[];
// }

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" data-testid={`stat-${label.toLowerCase()}`}>
      <div className="text-xs uppercase tracking-wider text-inkDim">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}

// Home dashboard component that displays issue stats, breakdowns by category/priority/repo, and recent issues.
// Accepts an optional 'repo' query parameter to filter all stats to a specific repository.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ repo?: string }>;
}) {
  // Extract selected repo from URL query param
  const sp = await searchParams;
  const selectedRepo = sp.repo;

  // Fetch all data functions concurrently, passing the selected repo for filtering
  const [stats, byCategory, byPriority] = await Promise.all([
    getStats(),
    getByCategory(selectedRepo),
    getByPriority(selectedRepo),
  ]);

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Triage Dashboard</h1>
          <p className="text-inkDim mt-2">
            AI-classified GitHub issues, stored on local Supabase Postgres with pgvector similarity search.
          </p>
        </div>
        {/* Nav links (Issues/Proposed/Analyze — go to a page) grouped separately from
            the one real action (Sync — mutates data right here), so only Sync gets
            the gradient/primary treatment. RESTORED 2026-08-06: Issues/Proposed back
            here per user request; the "View all" link that duplicated /issues down in
            the Recently viewed section was removed since it's redundant with this. */}
        <div className="flex items-center gap-2">
          <Link href="/issues" className="action">
            Issues
          </Link>
          <Link href="/proposed" className="action">
            Proposed
          </Link>
          <Link href="/analyze" className="action">
            Analyze
          </Link>
          <div className="w-px self-stretch bg-inkLine mx-1" />
          <SyncButton />
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="stats-row">
        <StatCard label="Issues" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="Classified" value={stats.classified} />
        <StatCard label="Planned" value={stats.planned} />
        <StatCard label="Runs" value={stats.runs} />
      </section>

      {/* Three-column breakdown: By Repository (selector), By Category, By Priority */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-lg font-bold mb-3">By Repository</h2>
          {/* RepoFilter shows tracked repos as clickable options to select which repo to view stats for */}
          <RepoFilter />
        </div>

        <div className="card">
          <h2 className="text-lg font-bold mb-3">By Category</h2>
          <ul className="space-y-2">
            {byCategory.map((r) => (
              <li key={r.category} className="flex justify-between items-center">
                <span className={`badge badge-${r.category}`}>{r.category}</span>
                <span className="text-lg font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold mb-3">By Priority</h2>
          <ul className="space-y-2">
            {byPriority.map((r) => (
              <li key={r.priority} className="flex justify-between items-center">
                <span className={`badge badge-${r.priority}`}>{r.priority}</span>
                <span className="text-lg font-semibold">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Recently viewed</h2>
          {/* COMMENTED 2026-08-06: "View all" link to /issues removed — redundant now
              that Issues is a top-level nav button beside Analyze.
          <Link href="/issues" className="text-sm no-underline">View all →</Link>
          */}
        </div>
        {/* Client-only: reads this browser's view history from localStorage, written by RecordView on the issue detail page */}
        <RecentlyViewed />
      </section>
    </div>
  );
}
