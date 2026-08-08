"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Repo = {
  github_repo: string;
};

const RepoFilterComponent = forwardRef<{ refetch: () => void }, {}>((_props, ref) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedRepoParam = searchParams.get("repo");

  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(selectedRepoParam);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllModal, setShowAllModal] = useState(false);
  const itemsPerPage = 10;
  const visibleLimit = 3;

  const fetchRepos = async () => {
    try {
      const res = await fetch("/api/repos");
      if (res.ok) {
        const data = await res.json();
        const repoList = data.repos || [];
        setRepos(repoList);
        setCurrentPage(1);

        if (!selectedRepoParam && repoList.length > 0) {
          setSelectedRepo(repoList[0].github_repo);
          const params = new URLSearchParams(searchParams);
          params.set("repo", repoList[0].github_repo);
          router.push(`?${params.toString()}`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch repos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, [selectedRepoParam, searchParams, router]);

  useImperativeHandle(ref, () => ({
    refetch: () => fetchRepos(),
  }));

  const handleSelectRepo = (repo: string) => {
    setSelectedRepo(repo);
    const params = new URLSearchParams(searchParams);
    params.set("repo", repo);
    router.push(`?${params.toString()}`);
  };

  if (loading) {
    return <div className="text-inkDim text-sm">Loading repositories...</div>;
  }

  if (repos.length === 0) {
    return (
      <div className="text-inkDim text-sm">
        No repositories tracked yet.{" "}
        <Link href="/analyze" className="underline hover:text-glow">
          Add one from Analyze
        </Link>
        .
      </div>
    );
  }

  // Bubble the selected repo to the top so it's always visible within the
  // 3-slot preview, even if it wasn't among the first 3 tracked repos.
  const ordered = selectedRepo
    ? [...repos.filter((r) => r.github_repo === selectedRepo), ...repos.filter((r) => r.github_repo !== selectedRepo)]
    : repos;
  const visibleRepos = ordered.slice(0, visibleLimit);
  const hiddenCount = repos.length - visibleRepos.length;

  // Modal pagination (full list, 10 per page)
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedRepos = repos.slice(startIdx, endIdx);
  const totalPages = Math.ceil(repos.length / itemsPerPage);

  const RepoRow = ({ repo }: { repo: Repo }) => (
    <button
      onClick={() => handleSelectRepo(repo.github_repo)}
      className={`w-full text-left px-3 py-2 rounded text-sm font-mono transition truncate ${
        selectedRepo === repo.github_repo
          ? "bg-glow text-card font-semibold"
          : "border border-inkLine hover:border-glow"
      }`}
    >
      {repo.github_repo}
    </button>
  );

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-left">
        {visibleRepos.map((r) => (
          <li key={r.github_repo}>
            <RepoRow repo={r} />
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAllModal(true)}
          className="text-xs text-inkDim hover:text-glow underline"
        >
          +{hiddenCount} more — select repo
        </button>
      )}

      {/* Full repo list modal — opened when there are more than visibleLimit repos tracked */}
      {showAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-inkLine rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-inkLine p-4">
              <h4 className="text-lg font-semibold">Select repository</h4>
              <button
                onClick={() => setShowAllModal(false)}
                className="text-inkDim hover:text-ink-text text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-2 overflow-y-auto">
              {paginatedRepos.map((r) => (
                <div key={r.github_repo} onClick={() => setShowAllModal(false)}>
                  <RepoRow repo={r} />
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs p-4 border-t border-inkLine">
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
        </div>
      )}
    </div>
  );
});

RepoFilterComponent.displayName = "RepoFilter";
export const RepoFilter = RepoFilterComponent;
