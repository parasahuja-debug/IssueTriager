"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SuccessModal } from "@/components/SuccessModal";

type ProposedIssue = {
  id: number;
  github_repo: string;
  title: string;
  body: string | null;
  category_guess: string | null;
  priority_guess: string | null;
  kind: string;
  file_path: string | null;
  status: string;
  created_at: string;
  model: string | null;
};

// ProposedPage displays AI-proposed issues awaiting human approval or rejection.
// Users can view proposals grouped by status, approve them to make real issues,
// or reject them to archive as declined ideas.
export default function ProposedPage() {
  // Current tab/filter: all, pending, approved, or rejected
  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  // List of proposed issues, filtered by current tab
  const [issues, setIssues] = useState<ProposedIssue[]>([]);
  // Loading state while fetching
  const [loading, setLoading] = useState(true);
  // Error message if fetch fails
  const [error, setError] = useState<string | null>(null);
  // Popup shown after an approve/reject action completes
  const [showResult, setShowResult] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  // Fetch proposed issues when tab changes
  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParam = tab === "all" ? "" : `?status=${tab}`;
        const res = await fetch(`/api/proposed${queryParam}`);
        if (!res.ok) throw new Error("Failed to fetch proposed issues");
        const data = await res.json();
        setIssues(data.issues || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setIssues([]);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [tab]);

  // Handle approve action - POST to /api/proposed/[id]/approve
  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/proposed/${id}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to approve");
      // Remove from list after approval
      setIssues(issues.filter((i) => i.id !== id));
      setResultMessage(data.message || "Approved");
      setShowResult(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error approving proposal");
    }
  };

  // Handle reject action - POST to /api/proposed/[id]/reject
  const handleReject = async (id: number) => {
    try {
      const res = await fetch(`/api/proposed/${id}/reject`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to reject");
      // Remove from list after rejection
      setIssues(issues.filter((i) => i.id !== id));
      setResultMessage(data.message || "Rejected");
      setShowResult(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error rejecting proposal");
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header with info icon */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold">Proposed Issues</h1>
          <div className="relative group cursor-help">
            <span className="inline-flex items-center justify-center w-5 h-5 text-sm font-bold rounded-full bg-action-bg text-action-text">
              i
            </span>
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-action-bg text-action-text text-xs rounded px-2 py-1 w-48 z-10">
              <p>
                Issues discovered by the AI analyzer. Review each proposal and approve to make it a real issue
                or reject to archive it. Rejected proposals are kept as an audit trail.
              </p>
            </div>
          </div>
        </div>
        <p className="text-inkDim">AI-generated issue candidates awaiting your approval</p>
      </section>

      {/* Filter tabs: all, pending, approved, rejected */}
      <section className="flex gap-2 border-b border-inkLine">
        {(["all", "pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t
                ? "border-b-2 border-glow text-ink-text"
                : "text-inkDim hover:text-ink-text"
            }`}
          >
            {t}
          </button>
        ))}
      </section>

      {/* Content area: loading, error, or proposals list */}
      <section>
        {loading && <div className="text-inkDim">Loading proposals...</div>}

        {error && <div className="text-red-400">Error: {error}</div>}

        {!loading && !error && issues.length === 0 && (
          <div className="text-inkDim">
            {tab === "all"
              ? "No proposed issues yet. Run an analysis to discover candidates."
              : `No ${tab} proposals.`}
          </div>
        )}

        {/* List of proposed issues as cards */}
        {!loading && !error && issues.length > 0 && (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className="card space-y-3">
                {/* Issue title and repo */}
                <div>
                  <div className="font-semibold text-ink-text">{issue.title}</div>
                  <div className="text-xs text-inkDim mt-1 space-y-1">
                    <div>
                      <span className="font-mono">{issue.github_repo}</span>
                    </div>
                    <div>
                      Analyzed:{" "}
                      {issue.kind === "file"
                        ? issue.file_path
                          ? `${issue.file_path}`
                          : "Unknown file"
                        : "Repository Metadata"}
                    </div>
                    {issue.model && <div>Model: <span className="font-mono">{issue.model}</span></div>}
                  </div>
                </div>

                {/* Issue body preview (first 150 chars) */}
                {issue.body && (
                  <div className="text-sm text-inkDim">
                    {issue.body.length > 150 ? `${issue.body.substring(0, 150)}...` : issue.body}
                  </div>
                )}

                {/* Category and priority guesses as badges */}
                <div className="flex gap-2 flex-wrap">
                  {issue.category_guess && (
                    <span className={`badge badge-${issue.category_guess}`}>{issue.category_guess}</span>
                  )}
                  {issue.priority_guess && (
                    <span className={`badge badge-${issue.priority_guess}`}>{issue.priority_guess}</span>
                  )}
                </div>

                {/* Action buttons: approve or reject (for pending), or view status (for approved/rejected) */}
                <div className="flex gap-2 justify-end pt-2">
                  {issue.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleReject(issue.id)}
                        className="action text-red-400 border-red-400"
                      >
                        Reject
                      </button>
                      <button onClick={() => handleApprove(issue.id)} className="action action-primary">
                        Approve
                      </button>
                    </>
                  )}
                  {issue.status === "approved" && (
                    <div className="text-xs text-green-400">✓ Approved</div>
                  )}
                  {issue.status === "rejected" && (
                    <div className="text-xs text-red-400">✗ Rejected</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Popup confirming the approve/reject action completed */}
      <SuccessModal
        message={resultMessage}
        isOpen={showResult}
        onClose={() => setShowResult(false)}
      />
    </div>
  );
}
