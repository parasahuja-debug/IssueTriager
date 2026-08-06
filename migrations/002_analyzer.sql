-- Adds the repo analyzer + human-in-the-loop approval + multi-repo tracking
-- layer. Additive only — 001_init.sql is never edited.

ALTER TABLE issues ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'github';

CREATE TABLE IF NOT EXISTS tracked_repos (
  github_repo TEXT PRIMARY KEY,
  added_by TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id SERIAL PRIMARY KEY,
  github_repo TEXT NOT NULL,
  scope TEXT NOT NULL,
  file_paths TEXT[],
  requested_by TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_runs_github_repo_idx ON analysis_runs(github_repo);

-- Staging area: a row here is never a real issue on its own. Only an
-- explicit approval (status -> 'approved') copies it into the issues table,
-- with source = 'analyzer'. Rejected rows are kept, never deleted.
CREATE TABLE IF NOT EXISTS proposed_issues (
  id SERIAL PRIMARY KEY,
  analysis_run_id INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  github_repo TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  category_guess TEXT,
  priority_guess TEXT,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proposed_issues_status_idx ON proposed_issues(status);
CREATE INDEX IF NOT EXISTS proposed_issues_analysis_run_id_idx ON proposed_issues(analysis_run_id);
