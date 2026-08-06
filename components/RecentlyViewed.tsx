"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ViewedIssue = {
  repo: string;
  number: number;
  title: string;
  state: string;
  category: string | null;
  priority: string | null;
  viewedAt: string;
};

const STORAGE_KEY = "recentlyViewedIssues";
const UPDATE_EVENT = "recently-viewed-updated";

// RecentlyViewed reads the browser's local view history (written by RecordView
// on the issue detail page) and renders it. Client-only — there is no server
// component fallback, since view history only exists in this browser.
export function RecentlyViewed() {
  const [issues, setIssues] = useState<ViewedIssue[] | null>(null);

  useEffect(() => {
    const readFromStorage = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setIssues(raw ? JSON.parse(raw) : []);
      } catch {
        setIssues([]);
      }
    };

    readFromStorage();

    // Re-read on: (1) the custom event RecordView fires right after writing
    // — covers this component staying mounted/alive across client-side
    // navigation (Next.js router cache), where a mount-only effect never
    // reruns; (2) pageshow/visibilitychange — covers real browser
    // back/forward-cache restores, a different mechanism than router caching.
    window.addEventListener(UPDATE_EVENT, readFromStorage);
    window.addEventListener("pageshow", readFromStorage);
    document.addEventListener("visibilitychange", readFromStorage);
    return () => {
      window.removeEventListener(UPDATE_EVENT, readFromStorage);
      window.removeEventListener("pageshow", readFromStorage);
      document.removeEventListener("visibilitychange", readFromStorage);
    };
  }, []);

  if (issues === null) {
    return <p className="text-inkDim text-sm">Loading...</p>;
  }

  if (issues.length === 0) {
    return (
      <p className="text-inkDim text-sm">
        No issues viewed yet. Open an issue from the list to see it here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-inkLine">
      {issues.map((i) => (
        <li key={`${i.repo}-${i.number}`} className="py-3 flex items-center gap-3">
          <span className="text-inkDim text-sm w-12">#{i.number}</span>
          <div className="flex-1 min-w-0">
            <Link
              href={`/issues/${i.number}?repo=${encodeURIComponent(i.repo)}`}
              className="no-underline text-foreground hover:text-glow block truncate"
            >
              {i.title}
            </Link>
            <span className="text-xs text-inkDim font-mono">{i.repo}</span>
          </div>
          {i.category && <span className={`badge badge-${i.category}`}>{i.category}</span>}
          {i.priority && <span className={`badge badge-${i.priority}`}>{i.priority}</span>}
          <span className="text-xs text-inkDim w-12 text-right">{i.state}</span>
        </li>
      ))}
    </ul>
  );
}
