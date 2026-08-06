"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";

// RepoInfo represents a single tracked repository from the database, including
// who added it and when. Used to display repo metadata in the list.
type RepoInfo = {
  github_repo: string;
  added_by: string;
  added_at: string;
};

// RepoSelector displays a list of all repositories currently being tracked by the app.
// Fetches from GET /api/repos on mount and handles loading/error states while displaying
// each repo's metadata (who added it and when). Supports selection via clickable cards
// and calls onRepoSelected callback when a repo is picked. Supports refetch via ref so
// the parent can refresh the list after a new repo is added, without a full page reload.
type RepoSelectorProps = {
  onRepoSelected?: (repo: string) => void;
  selectedRepo?: string;
};

export const RepoSelector = forwardRef<{ refetch: () => void }, RepoSelectorProps>(
  ({ onRepoSelected, selectedRepo }, ref) => {
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | undefined>(selectedRepo);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Fetch the list of tracked repos from the database
  const fetchRepos = async () => {
    try {
      // Fetch the list of all tracked repos from the API
      const res = await fetch("/api/repos");
      if (!res.ok) {
        throw new Error(`Failed to fetch repos: ${res.status}`);
      }
      const data = await res.json();
      // Update state with fetched repos or empty array if none exist
      setRepos(data.repos || []);
      setError(null);
    } catch (err) {
      // If fetch fails, store the error message and clear repos list
      setError(err instanceof Error ? err.message : "Unknown error");
      setRepos([]);
    } finally {
      // Mark loading as complete regardless of success or failure
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchRepos();
  }, []);

  // Expose refetch method via ref so parent can trigger reload after adding a repo
  useImperativeHandle(ref, () => ({
    refetch: () => fetchRepos(),
  }));

  // Show loading state while repos are being fetched from the database
  if (loading) {
    return <div className="text-inkDim">Loading repositories...</div>;
  }

  // Show error message if fetch failed, preventing the user from proceeding
  if (error) {
    return <div className="text-red-400">Error: {error}</div>;
  }

  // Show empty state if no repos have been tracked yet, guiding user to add one
  if (repos.length === 0) {
    return <div className="text-inkDim">No repositories tracked yet. Add one to get started.</div>;
  }

  // Handle repo selection: update local state and notify parent via callback
  const handleSelectRepo = (repo: string) => {
    setSelected(repo);
    onRepoSelected?.(repo);
  };

  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedRepos = repos.slice(startIdx, endIdx);
  const totalPages = Math.ceil(repos.length / itemsPerPage);

  // Display list of tracked repos as cards, each laid out as three fixed-width columns
  // (repo name / added by / added at) with an explicit Select button, matching the
  // option-row style used in the Configure Analysis wizard (radio + labeled button).
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {paginatedRepos.map((repo) => (
          <div
            key={repo.github_repo}
            className={`card w-full flex items-center gap-3 ${
              selected === repo.github_repo
                ? 'ring-2 ring-glow bg-card border-glow'
                : ''
            }`}
          >
            <div className="grid grid-cols-3 gap-3 flex-1 min-w-0">
              <div className="font-semibold text-ink-text break-words">{repo.github_repo}</div>
              <div className="text-sm text-inkDim break-words">
                <span className="text-xs uppercase tracking-wider text-inkDim block mb-1">Added by</span>
                <span className="font-mono">{repo.added_by}</span>
              </div>
              <div className="text-sm text-inkDim break-words">
                <span className="text-xs uppercase tracking-wider text-inkDim block mb-1">Added at</span>
                <span className="font-mono">{new Date(repo.added_at).toLocaleString()}</span>
              </div>
            </div>
            <button
              onClick={() => handleSelectRepo(repo.github_repo)}
              className={`text-xs px-3 py-1.5 rounded transition whitespace-nowrap ${
                selected === repo.github_repo
                  ? 'bg-glow text-card'
                  : 'border border-inkLine hover:border-glow'
              }`}
            >
              {selected === repo.github_repo ? '✓ Selected' : 'Select'}
            </button>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-inkDim">
            {startIdx + 1}–{Math.min(endIdx, repos.length)} of {repos.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 border border-inkLine rounded hover:border-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="px-2 py-1">
              {currentPage}/{totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border border-inkLine rounded hover:border-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

RepoSelector.displayName = "RepoSelector";
