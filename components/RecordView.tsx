"use client";

import { useEffect } from "react";

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
const MAX_ENTRIES = 5;

type RecordViewProps = {
  repo: string;
  number: number;
  title: string;
  state: string;
  category?: string | null;
  priority?: string | null;
};

// RecordView is a headless client component mounted on the issue detail page.
// On mount, it records this issue into localStorage's recently-viewed list so
// the dashboard's "Recently viewed" box can read it back — no server/DB
// tracking exists since the app has no auth/session system.
export function RecordView({ repo, number, title, state, category, priority }: RecordViewProps) {
  useEffect(() => {
    // Parsed separately from the write: a corrupted/unparseable existing
    // value must not silently block recording this view too — start fresh
    // instead of aborting the whole write.
    let existing: ViewedIssue[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      existing = raw ? JSON.parse(raw) : [];
    } catch {
      existing = [];
    }

    try {
      const filtered = existing.filter((v) => !(v.repo === repo && v.number === number));
      const next: ViewedIssue[] = [
        {
          repo,
          number,
          title,
          state,
          category: category ?? null,
          priority: priority ?? null,
          viewedAt: new Date().toISOString(),
        },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Same-tab notification: the 'storage' event only fires in OTHER tabs,
      // so a component still mounted in this tab (e.g. RecentlyViewed kept
      // alive by Next.js's router cache across navigation) needs this to
      // know new data landed.
      window.dispatchEvent(new Event(UPDATE_EVENT));
    } catch {
      // localStorage unavailable (private mode, quota, etc) — recently viewed
      // is a nice-to-have, so fail silently rather than break the issue page.
    }
  }, [repo, number, title, state, category, priority]);

  return null;
}
