"use client";

import { useState, useRef } from "react";
import { RepoFilter } from "./RepoFilter";
import { SuccessModal } from "./SuccessModal";

// UNUSED (2026-08-06) — imported nowhere in the app. Built while deciding
// whether /analyze should use a combined form+selector+modal (this
// component) versus its own custom add-form + RepoSelector; the latter was
// kept instead and this was never wired in. Left in place, not deleted,
// in case that decision gets revisited — it's a complete, working
// alternative, just not the one currently plugged in anywhere.
//
// RepoManager combines repo selection and repo addition in one component.
// Handles adding new repos and refreshing the list when successful.
export function RepoManager() {
  // State for add repo form
  const [newRepoInput, setNewRepoInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for success modal
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Ref to trigger RepoFilter refetch
  const repoFilterRef = useRef<{ refetch: () => void } | null>(null);

  // Handle adding a new repository
  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    const repo = newRepoInput.trim();

    // Validate repo format (username/repo)
    if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      setError("Invalid format. Use username/repo (e.g., parasahuja-debug/MyRepo)");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github_repo: repo }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to add repo");
      }

      // Success: clear form, show modal, and trigger refetch
      setNewRepoInput("");
      setSuccessMessage(`${repo} added to tracked repositories`);
      setShowSuccess(true);

      // Refetch the repo list after a short delay to ensure DB is updated
      setTimeout(() => {
        repoFilterRef.current?.refetch();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {/* Add Repository Form */}
      <div className="card p-3 bg-action-bg border-action-line mb-4">
        <div className="text-xs font-semibold text-action-text mb-2">Add Repository</div>
        <form onSubmit={handleAddRepo} className="flex gap-2">
          <input
            type="text"
            placeholder="username/repo"
            value={newRepoInput}
            onChange={(e) => setNewRepoInput(e.target.value)}
            disabled={adding}
            className="flex-1 px-2 py-1 rounded text-xs border border-action-line bg-ink-card text-ink-text placeholder-inkDim focus:outline-none focus:border-glow"
          />
          <button
            type="submit"
            disabled={adding || !newRepoInput.trim()}
            className="action text-xs px-3 py-1"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
        {/* Error message if add fails */}
        {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
      </div>

      {/* Tracked Repositories List */}
      <RepoFilter ref={repoFilterRef} />

      {/* Success Modal - shows when repo is added */}
      <SuccessModal
        message={successMessage}
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
    </>
  );
}
