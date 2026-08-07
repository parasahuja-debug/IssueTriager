import Link from "next/link";
import { sql } from "@/lib/db";
import { SourceBadge, RepoLink } from "@/components/IssueBadges";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  github_number: number;
  title: string;
  state: string;
  category: string | null;
  priority: string | null;
  complexity: string | null;
  source: string;
  github_repo: string;
};

type Filters = { category?: string; priority?: string; state?: string; repo?: string; tag?: string };

const PAGE_SIZE = 10;

// getIssues fetches one page of issues with optional filtering by category, priority, state, repo, or tag.
// Uses LEFT JOIN LATERAL to get the latest classification for each issue in a single query.
// Each filter condition is written as "(filter IS NULL OR column = filter)" so unset filters are no-ops
// rather than needing separate SQL branches for every filter combination. Returns the total matching
// count alongside the page's rows so the UI can render Prev/Next without a second round-trip.
async function getIssues(filter: Filters, page: number): Promise<{ rows: Row[]; total: number }> {
  const rows = (await sql`
    SELECT
      i.id,
      i.github_number,
      i.title,
      i.state,
      i.source,
      i.github_repo,
      latest.category,
      latest.priority,
      latest.complexity,
      COUNT(*) OVER()::int AS total_count
    FROM issues i
    LEFT JOIN LATERAL (
      SELECT category, priority, complexity FROM classifications c
      WHERE c.issue_id = i.id
      ORDER BY c.created_at DESC LIMIT 1
    ) latest ON TRUE
    WHERE
      (${filter.state ?? null}::text IS NULL OR i.state = ${filter.state ?? null})
      AND (${filter.category ?? null}::text IS NULL OR latest.category = ${filter.category ?? null})
      AND (${filter.priority ?? null}::text IS NULL OR latest.priority = ${filter.priority ?? null})
      AND (${filter.repo ?? null}::text IS NULL OR i.github_repo = ${filter.repo ?? null})
      AND (${filter.tag ?? null}::text IS NULL OR ${filter.tag ?? null} = ANY(i.labels))
    ORDER BY
      CASE latest.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
      i.github_created_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `) as unknown as (Row & { total_count: number })[];
  const total = rows[0]?.total_count ?? 0;
  return { rows, total };
}

// Distinct repo/label values actually present on issues — used to populate
// the Repo and Tag filter rows dynamically, unlike the fixed category/
// priority/state option lists.
async function getDistinctRepos(): Promise<string[]> {
  const rows = (await sql`SELECT DISTINCT github_repo FROM issues ORDER BY github_repo`) as unknown as {
    github_repo: string;
  }[];
  return rows.map((r) => r.github_repo);
}

async function getDistinctLabels(): Promise<string[]> {
  const rows = (await sql`
    SELECT DISTINCT unnest(labels) AS label FROM issues WHERE array_length(labels, 1) > 0 ORDER BY label
  `) as unknown as { label: string }[];
  return rows.map((r) => r.label);
}

// Renders a row of clickable badges that navigate to different `?param=value`
// URLs rather than using React state — filters are shareable/bookmarkable
// links this way, and survive a page refresh. buildHref() keeps whichever
// other filters are already active while changing just this one param.
function FilterRow({
  label,
  options,
  current,
  param,
  sp,
  colorize = true,
}: {
  label: string;
  options: string[];
  current: string | undefined;
  param: string;
  sp: Filters;
  // Category/priority/state have badge-${value} CSS color classes; repo and
  // tag values don't (and repo names contain "/", not a safe class-name
  // character), so those two render as plain, uncolored badges.
  colorize?: boolean;
}) {
  const buildHref = (value: string | null) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      // "page" excluded deliberately: changing any filter resets back to
      // page 1, since the result set changed and the old page number could
      // now point past the new end.
      if (v && k !== param && k !== "page") params.set(k, v);
    }
    if (value) params.set(param, value);
    const q = params.toString();
    return q ? `?${q}` : "/issues";
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs uppercase tracking-wider text-inkDim w-20">{label}</span>
      <Link
        href={buildHref(null)}
        className={`badge no-underline ${!current ? "bg-glow text-card font-semibold" : ""}`}
      >
        all
      </Link>
      {options.map((o) => {
        const selected = current === o;
        // Colorized rows (category/priority/state) already carry their own
        // background via badge-${o} — a ring layers on top regardless of
        // which background wins the cascade, instead of fighting it with a
        // second background utility. Uncolorized rows (repo/tag) have no
        // competing background, so a solid fill is safe and unambiguous.
        const selectedClass = colorize
          ? "ring-2 ring-glow font-semibold"
          : "bg-glow text-card font-semibold";
        return (
          <Link
            key={o}
            href={buildHref(o)}
            className={`badge ${colorize ? `badge-${o}` : ""} no-underline ${selected ? selectedClass : ""}`}
          >
            {selected ? "✓ " : ""}
            {o}
          </Link>
        );
      })}
    </div>
  );
}

// Building blocks for the active-filters summary bar: one removable chip
// per currently-set filter, plus a "Clear all" link. Exists so the user can
// see everything currently filtered by in one place, instead of having to
// scan every FilterRow for a highlighted pill as more filters stack up.
const FILTER_LABELS: Record<keyof Filters, string> = {
  state: "State",
  category: "Category",
  priority: "Priority",
  repo: "Repo",
  tag: "Tag",
};

function ActiveFilters({ sp }: { sp: Filters }) {
  const active = (Object.keys(FILTER_LABELS) as (keyof Filters)[])
    .map((key) => ({ key, value: sp[key] }))
    .filter((f): f is { key: keyof Filters; value: string } => !!f.value);

  if (active.length === 0) return null;

  const hrefWithout = (key: keyof Filters) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      // "page" excluded deliberately: removing a filter resets back to
      // page 1, same reasoning as FilterRow's buildHref.
      if (v && k !== key && k !== "page") params.set(k, v);
    }
    const q = params.toString();
    return q ? `?${q}` : "/issues";
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="active-filters">
      <span className="text-xs uppercase tracking-wider text-inkDim">Active</span>
      {active.map(({ key, value }) => (
        <Link
          key={key}
          href={hrefWithout(key)}
          className="badge bg-glow text-card font-semibold no-underline"
        >
          {FILTER_LABELS[key]}: {value} ×
        </Link>
      ))}
      <Link href="/issues" className="text-xs text-inkDim hover:text-glow underline">
        Clear all
      </Link>
    </div>
  );
}

// searchParams is a promise in the App Router (Next 15+) — must be awaited
// before reading category/priority/state/repo/tag/page off it.
export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Filters & { page?: string }>;
}) {
  const sp = await searchParams;
  const pageParam = parseInt(sp.page ?? "1", 10);
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [{ rows, total }, repos, labels] = await Promise.all([
    getIssues(sp, page),
    getDistinctRepos(),
    getDistinctLabels(),
  ]);

  const categories = ["bug", "feature", "question", "docs", "chore"];
  const priorities = ["P0", "P1", "P2", "P3"];
  const states = ["open", "closed"];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Pagination links preserve every active filter, changing only `page`.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const q = params.toString();
    return q ? `?${q}` : "/issues";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
      </div>

      <ActiveFilters sp={sp} />

      <div className="card space-y-3" data-testid="filter-bar">
        <FilterRow label="State" current={sp.state} options={states} param="state" sp={sp} />
        <FilterRow label="Category" current={sp.category} options={categories} param="category" sp={sp} />
        <FilterRow label="Priority" current={sp.priority} options={priorities} param="priority" sp={sp} />
        {repos.length > 0 && (
          <FilterRow label="Repo" current={sp.repo} options={repos} param="repo" sp={sp} colorize={false} />
        )}
        {labels.length > 0 && (
          <FilterRow label="Tag" current={sp.tag} options={labels} param="tag" sp={sp} colorize={false} />
        )}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="text-inkDim">No issues match those filters.</p>
        ) : (
          <ul className="divide-y divide-inkLine">
            {rows.map((i) => (
              <li key={i.id} className="py-3 flex items-center gap-3 flex-wrap" data-testid="issue-row">
                <span className="text-inkDim text-sm w-14">#{i.github_number}</span>
                <Link
                  href={`/issues/${i.github_number}?repo=${encodeURIComponent(i.github_repo)}`}
                  className="flex-1 no-underline text-foreground hover:text-glow"
                >
                  {i.title}
                </Link>
                {/* Source badge (GitHub or AI Analyzer) and repo link */}
                <SourceBadge source={i.source} />
                <RepoLink repo={i.github_repo} />
                {/* Classification badges */}
                {i.category && <span className={`badge badge-${i.category}`}>{i.category}</span>}
                {i.priority && <span className={`badge badge-${i.priority}`}>{i.priority}</span>}
                {i.complexity && <span className="badge">{i.complexity}</span>}
                <span className="text-xs text-inkDim w-14 text-right">{i.state}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-inkDim">
            Page {page} of {totalPages} ({total} issue{total === 1 ? "" : "s"})
          </span>
          <div className="flex gap-2">
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={page === 1}
              className={`px-2 py-1 border border-inkLine rounded no-underline ${
                page === 1 ? "opacity-50 pointer-events-none" : "hover:border-glow"
              }`}
            >
              ← Prev
            </Link>
            <span className="px-2 py-1">
              {page}/{totalPages}
            </span>
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
              aria-disabled={page === totalPages}
              className={`px-2 py-1 border border-inkLine rounded no-underline ${
                page === totalPages ? "opacity-50 pointer-events-none" : "hover:border-glow"
              }`}
            >
              Next →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
