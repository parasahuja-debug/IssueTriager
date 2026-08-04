import Link from "next/link";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  github_number: number;
  title: string;
  state: string;
  category: string | null;
  priority: string | null;
  complexity: string | null;
};

// Same LEFT JOIN LATERAL pattern as the dashboard's getRecentIssues(), plus
// optional filtering. Each WHERE clause is written as
// "(filter IS NULL OR column = filter)" so an unset filter is a no-op instead
// of needing separate SQL branches per filter combination.
async function getIssues(filter: { category?: string; priority?: string; state?: string }): Promise<Row[]> {
  const rows = (await sql`
    SELECT
      i.id,
      i.github_number,
      i.title,
      i.state,
      latest.category,
      latest.priority,
      latest.complexity
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
    ORDER BY
      CASE latest.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
      i.github_created_at DESC
  `) as unknown as Row[];
  return rows;
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
}: {
  label: string;
  options: string[];
  current: string | undefined;
  param: string;
  sp: { category?: string; priority?: string; state?: string };
}) {
  const buildHref = (value: string | null) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== param) params.set(k, v);
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
        className={`badge no-underline ${!current ? "border-glow text-glow" : ""}`}
      >
        all
      </Link>
      {options.map((o) => (
        <Link
          key={o}
          href={buildHref(o)}
          className={`badge badge-${o} no-underline ${current === o ? "border-glow" : ""}`}
        >
          {o}
        </Link>
      ))}
    </div>
  );
}

// searchParams is a promise in the App Router (Next 15+) — must be awaited
// before reading category/priority/state off it.
export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; priority?: string; state?: string }>;
}) {
  const sp = await searchParams;
  const rows = await getIssues(sp);

  const categories = ["bug", "feature", "question", "docs", "chore"];
  const priorities = ["P0", "P1", "P2", "P3"];
  const states = ["open", "closed"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
        <p className="text-inkDim mt-2">Sorted by priority, then creation date.</p>
      </div>

      <div className="card space-y-3" data-testid="filter-bar">
        <FilterRow label="State" current={sp.state} options={states} param="state" sp={sp} />
        <FilterRow label="Category" current={sp.category} options={categories} param="category" sp={sp} />
        <FilterRow label="Priority" current={sp.priority} options={priorities} param="priority" sp={sp} />
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="text-inkDim">No issues match those filters.</p>
        ) : (
          <ul className="divide-y divide-inkLine">
            {rows.map((i) => (
              <li key={i.id} className="py-3 flex items-center gap-3" data-testid="issue-row">
                <span className="text-inkDim text-sm w-14">#{i.github_number}</span>
                <Link
                  href={`/issues/${i.github_number}`}
                  className="flex-1 no-underline text-foreground hover:text-glow"
                >
                  {i.title}
                </Link>
                {i.category && <span className={`badge badge-${i.category}`}>{i.category}</span>}
                {i.priority && <span className={`badge badge-${i.priority}`}>{i.priority}</span>}
                {i.complexity && <span className="badge">{i.complexity}</span>}
                <span className="text-xs text-inkDim w-14 text-right">{i.state}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
