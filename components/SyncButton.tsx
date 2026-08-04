"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setMsg(data.message ?? (res.ok ? "synced" : "error"));
      // Re-runs the server component tree (Home's 4 queries) so the page
      // reflects the newly synced rows, without a full browser reload.
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-inkDim">{msg}</span>}
      <button onClick={run} disabled={loading} className="action action-primary" data-testid="sync-btn">
        {loading ? "Syncing..." : "Sync from GitHub"}
      </button>
    </div>
  );
}
