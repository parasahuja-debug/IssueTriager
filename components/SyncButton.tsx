"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type TrackedRepo = { github_repo: string };

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [repos, setRepos] = useState<TrackedRepo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  // Auto-dismiss toast notification after 5 seconds
  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  // Open the repo picker — fetches tracked repos so the user can choose which one to sync
  const openPicker = async () => {
    setShowPicker(true);
    setReposLoading(true);
    try {
      const res = await fetch("/api/repos");
      const data = await res.json();
      setRepos(data.repos || []);
    } catch {
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  };

  // Trigger sync from GitHub for the chosen repo and refresh page data
  const run = async (repo: string) => {
    setShowPicker(false);
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      const data = await res.json();
      setMsg(data.message ?? (res.ok ? "synced" : "error"));
      // Re-run server component tree so page reflects newly synced rows without full reload
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Sync button — opens repo picker so the user chooses which tracked repo to sync.
          Fixed min-width + centered label so it doesn't jump in size between the idle
          "Sync Git" and loading "Syncing..." states, and lines up with the Analyze button. */}
      <button
        onClick={openPicker}
        disabled={loading}
        className="action action-primary min-w-[100px] justify-center"
        data-testid="sync-btn"
      >
        {loading ? "Syncing..." : "Sync Git"}
      </button>

      {/* Repo picker modal — lists tracked repos, clicking one starts sync for that repo */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-inkLine rounded-lg max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-inkLine p-4">
              <h4 className="text-lg font-semibold">Sync which repository?</h4>
              <button
                onClick={() => setShowPicker(false)}
                className="text-inkDim hover:text-ink-text text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {reposLoading ? (
                <p className="text-inkDim text-sm">Loading repositories...</p>
              ) : repos.length === 0 ? (
                <p className="text-inkDim text-sm">
                  No repositories tracked yet. Add one from the Analyze page first.
                </p>
              ) : (
                repos.map((r) => (
                  <button
                    key={r.github_repo}
                    onClick={() => run(r.github_repo)}
                    className="w-full text-left px-3 py-2 rounded text-sm font-mono border border-inkLine hover:border-glow transition truncate"
                  >
                    {r.github_repo}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification — appears at top center, highlighted, slides away after 5 seconds */}
      {msg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-glow border border-glow-bright rounded px-6 py-3 text-sm font-semibold text-ink-page shadow-lg animate-in slide-in-from-top-4 duration-300 z-40">
          {msg}
        </div>
      )}
    </>
  );
}
