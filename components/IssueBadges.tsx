// SourceBadge shows whether an issue came from GitHub (synced) or AI Analyzer (proposed & approved)
export function SourceBadge({ source }: { source: string }) {
  const isAnalyzer = source === "analyzer";
  const bgColor = isAnalyzer ? "bg-action-bg" : "bg-tag-bg";
  const textColor = isAnalyzer ? "text-action-text" : "text-tag-text";
  const borderColor = isAnalyzer ? "border-action-line" : "border-tag-line";
  const label = isAnalyzer ? "AI Analyzer" : "GitHub";

  return (
    <span className={`badge ${bgColor} ${textColor} ${borderColor}`}>
      {label}
    </span>
  );
}

// RepoLink shows the repository (owner/repo) that an issue belongs to
export function RepoLink({ repo }: { repo: string }) {
  return (
    <span className="badge text-xs">
      {repo}
    </span>
  );
}
