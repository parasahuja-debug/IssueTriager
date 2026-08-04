"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  issueId: number;
  issueNumber: number;
  hasClassification: boolean;
  hasPlan: boolean;
};

export default function IssueActions({ issueId, issueNumber, hasClassification, hasPlan }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Shared by all 4 buttons: hitting POST /api/<kind>/<issueId>, then
  // router.refresh() so the panels below re-fetch and show the new result.
  const call = async (kind: "classify" | "similar" | "plan" | "dispatch") => {
    setPending(kind);
    setStatus(null);
    try {
      const res = await fetch(`/api/${kind}/${issueId}`, { method: "POST" });
      const data = await res.json();
      setStatus(data.message ?? (res.ok ? `${kind} ok` : `${kind} failed`));
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "error");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="card flex items-center gap-3 flex-wrap" data-testid="issue-actions">
      <button
        onClick={() => call("classify")}
        disabled={pending !== null}
        className="action action-primary"
        data-testid="classify-btn"
      >
        {pending === "classify" ? "Classifying..." : hasClassification ? "Re-classify" : "Classify"}
      </button>
      <button
        onClick={() => call("similar")}
        disabled={pending !== null}
        className="action"
        data-testid="embed-btn"
      >
        {pending === "similar" ? "Embedding..." : "Update embedding"}
      </button>
      <button
        onClick={() => call("plan")}
        disabled={pending !== null}
        className="action"
        data-testid="plan-btn"
      >
        {pending === "plan" ? "Planning..." : hasPlan ? "Re-generate plan" : "Generate plan"}
      </button>
      <button
        onClick={() => call("dispatch")}
        disabled={pending !== null || !hasPlan}
        className="action"
        data-testid="dispatch-btn"
      >
        {pending === "dispatch" ? "Dispatching..." : "Dispatch to agent"}
      </button>
      <span className="text-xs text-inkDim ml-auto" data-testid="action-status">
        {status ?? `Issue #${issueNumber}`}
      </span>
    </div>
  );
}
