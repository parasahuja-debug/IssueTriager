"use client";

import { useState, useRef } from "react";
import { RepoSelector } from "@/components/RepoSelector";
import { AnalyzeForm } from "@/components/AnalyzeForm";
import { SuccessModal } from "@/components/SuccessModal";

export default function AnalyzePage() {
  const [selectedRepo, setSelectedRepo] = useState<string | undefined>();
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const repoSelectorRef = useRef<{ refetch: () => void } | null>(null);

  const handleRepoSelected = (repo: string) => {
    setSelectedRepo(repo);
    setShowAnalysisModal(true);
  };

  const handleCloseModal = () => {
    setShowAnalysisModal(false);
    setSelectedRepo(undefined);
  };

  const handleAddRepo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = (form.elements.namedItem("repoInput") as HTMLInputElement)?.value.trim();
    setAddError(null);

    if (!input) {
      setAddError("Repository name is required");
      return;
    }

    if (!/^[\w.-]+\/[\w.-]+$/.test(input) || /\.git$/i.test(input)) {
      setAddError("Format: username/repo, no .git suffix (e.g., parasahuja-debug/MyRepo)");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_repo: input }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to add repository");
      }

      (form.elements.namedItem("repoInput") as HTMLInputElement).value = "";
      setSuccessMessage(`${input} added to tracked repositories`);
      setShowSuccess(true);
      repoSelectorRef.current?.refetch();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page header with info icon and description — its own bordered box */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Analyze Repository</h1>
            {/* Info icon with tooltip explaining capabilities */}
            <div className="relative group cursor-help">
              <span className="inline-flex items-center justify-center w-5 h-5 text-sm font-bold rounded-full bg-action-bg text-action-text">
                i
              </span>
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-action-bg text-action-text text-xs rounded px-2 py-1 w-48 z-10">
                <p>
                  Analyze public GitHub repos to discover candidate issues. Choose repository metadata (README,
                  commits) or scan specific files for TODOs and FIXMEs. View estimated costs before running.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-inkDim">Track repositories and discover potential issues with AI assistance.</p>
        </div>

        {/* Add new repo form — validates format and shows errors before submitting */}
        <div className="card p-3 bg-action-bg border-action-line">
          <div className="text-xs font-semibold text-action-text mb-2">Add Repository</div>
          <form onSubmit={handleAddRepo} className="flex gap-2">
            <input
              name="repoInput"
              type="text"
              placeholder="username/repo"
              disabled={isAdding}
              className="flex-1 px-2 py-1 rounded text-xs border border-action-line bg-ink-card text-ink-text placeholder-inkDim focus:outline-none focus:border-glow"
            />
            <button type="submit" disabled={isAdding} className="action text-xs px-3 py-1">
              {isAdding ? "Adding..." : "Add"}
            </button>
          </form>
          {addError && <div className="text-xs text-red-400 mt-2">{addError}</div>}
        </div>

        {/* Tracked repositories list — its own bordered box wrapping the row cards */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">Tracked Repositories</h2>
            <span className="text-xs text-inkDim">Click a repo to analyze</span>
          </div>
          <RepoSelector ref={repoSelectorRef} onRepoSelected={handleRepoSelected} selectedRepo={selectedRepo} />
        </div>
      </div>

      {/* Modal overlay for analysis form — shown after repo is selected */}
      {showAnalysisModal && selectedRepo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-inkLine rounded-lg max-w-lg w-full">
            {/* Modal header with close button */}
            <div className="flex items-center justify-between border-b border-inkLine p-4">
              <h3 className="text-lg font-semibold">Configure Analysis</h3>
              <button
                onClick={handleCloseModal}
                className="text-inkDim hover:text-ink-text text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="p-4">
              <AnalyzeForm repo={selectedRepo} onCancel={handleCloseModal} />
            </div>

          </div>
        </div>
      )}

      {/* Success popup shown when a repo is added — auto-closes, does not block navigation */}
      <SuccessModal
        message={successMessage}
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </div>
  );
}
