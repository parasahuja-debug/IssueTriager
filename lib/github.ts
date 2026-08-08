import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// DAY 7: dual path added — GITHUB_TOKEN set (Vercel, where no `gh` binary
// exists) hits GitHub's REST API directly via fetch(); GITHUB_TOKEN unset
// (local dev) keeps shelling out to `gh` exactly as before. Same
// present/absent-env-var shape as lib/ai.ts's classify()/embed() fallback.
// GITHUB_API_MODE ("rest" | "cli") is an optional explicit override on top
// of that default — set it to force one path regardless of GITHUB_TOKEN
// presence (e.g. to test the REST path locally). Leave it unset and nothing
// changes: local dev still infers CLI from a missing token, Vercel still
// infers REST from a present one.
const GITHUB_API = "https://api.github.com";

function usingRestApi(): boolean {
  const mode = process.env.GITHUB_API_MODE;
  if (mode === "rest") return true;
  if (mode === "cli") return false;
  return !!process.env.GITHUB_TOKEN;
}

async function ghApiFetch(path: string): Promise<unknown> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json();
}

// Same as ghApiFetch, but requests raw file/text content (README, file
// contents) instead of JSON metadata. Returns null on a 404 rather than
// throwing — mirrors the expected-absence handling the gh-CLI paths already
// use for a missing README/file.
async function ghApiFetchRaw(path: string): Promise<string | null> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.text();
}

export type GitHubIssue = {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  author: { login: string } | null;
  labels: { name: string }[];
  createdAt: string;
  updatedAt: string;
};

// The GitHub REST issues endpoint also returns pull requests mixed in;
// `pull_request` is only present on those, so filter them out to match what
// `gh issue list` already only returns (issues, never PRs).
type RestIssue = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  labels: (string | { name: string })[];
  created_at: string;
  updated_at: string;
  pull_request?: unknown;
};

function toGitHubIssue(i: RestIssue): GitHubIssue {
  return {
    number: i.number,
    title: i.title,
    body: i.body ?? "",
    state: i.state,
    url: i.html_url,
    author: i.user ? { login: i.user.login } : null,
    labels: i.labels.map((l) => (typeof l === "string" ? { name: l } : { name: l.name })),
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

export async function listIssues(
  repo: string,
  limit = 50,
): Promise<GitHubIssue[]> {
  if (usingRestApi()) {
    const data = (await ghApiFetch(
      `/repos/${repo}/issues?state=all&per_page=${limit}`,
    )) as RestIssue[];
    return data.filter((i) => !i.pull_request).map(toGitHubIssue);
  }
  const { stdout } = await execFileP(
    "gh",
    [
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "all",
      "--limit",
      String(limit),
      "--json",
      "number,title,body,state,url,author,labels,createdAt,updatedAt",
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as GitHubIssue[];
}

// Fake branch name for the simulated dispatch step — we never actually create
// a git branch, just record what one would plausibly be called. This is the
// seam a real dispatch workflow would plug into later.
export async function createBranchName(
  repo: string,
  issueNumber: number,
  slug: string,
): Promise<string> {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `fix/${issueNumber}-${safe || "issue"}`;
}

export type RepoContext = {
  description: string | null;
  topics: string[];
  readme: string | null;
  recentCommitMessages: string[];
  existingIssueTitles: string[];
};

// Metadata-level signal for the analyzer: repo description/topics, README
// text, recent commit messages, and existing open issue titles (for
// de-duplication — don't propose issues that already exist).
export async function getRepoContext(repo: string): Promise<RepoContext> {
  if (usingRestApi()) {
    const repoInfo = (await ghApiFetch(`/repos/${repo}`)) as {
      description: string | null;
      topics?: string[];
    };
    const readme = await ghApiFetchRaw(`/repos/${repo}/readme`);
    const commits = ((await ghApiFetch(`/repos/${repo}/commits?per_page=20`)) as {
      commit: { message: string };
    }[]).map((c) => c.commit.message);
    const openIssues = ((await ghApiFetch(
      `/repos/${repo}/issues?state=open&per_page=50`,
    )) as RestIssue[])
      .filter((i) => !i.pull_request)
      .map((i) => i.title);
    return {
      description: repoInfo.description,
      topics: repoInfo.topics ?? [],
      readme,
      recentCommitMessages: commits,
      existingIssueTitles: openIssues,
    };
  }

  const repoInfo = JSON.parse(
    (await execFileP("gh", ["api", `repos/${repo}`])).stdout,
  ) as { description: string | null; topics?: string[] };

  let readme: string | null = null;
  try {
    readme = (
      await execFileP("gh", [
        "api",
        `repos/${repo}/readme`,
        "-H",
        "Accept: application/vnd.github.raw+json",
      ])
    ).stdout;
  } catch {
    readme = null;
  }

  const commits = JSON.parse(
    (
      await execFileP("gh", [
        "api",
        `repos/${repo}/commits`,
        "--jq",
        ".[0:20] | map(.commit.message)",
      ])
    ).stdout,
  ) as string[];

  const openIssues = JSON.parse(
    (
      await execFileP("gh", [
        "issue",
        "list",
        "--repo",
        repo,
        "--state",
        "open",
        "--limit",
        "50",
        "--json",
        "title",
      ])
    ).stdout,
  ) as { title: string }[];

  return {
    description: repoInfo.description,
    topics: repoInfo.topics ?? [],
    readme,
    recentCommitMessages: commits,
    existingIssueTitles: openIssues.map((i) => i.title),
  };
}

// Code-level signal, scoped to exactly one human-chosen file — never a full
// repo scan. Returns null if the path doesn't exist rather than throwing,
// since a mistyped path is an expected outcome here, not a real error.
export async function getFileContent(
  repo: string,
  path: string,
): Promise<string | null> {
  if (usingRestApi()) {
    return ghApiFetchRaw(`/repos/${repo}/contents/${path}`);
  }
  try {
    const { stdout } = await execFileP("gh", [
      "api",
      `repos/${repo}/contents/${path}`,
      "-H",
      "Accept: application/vnd.github.raw+json",
    ]);
    return stdout;
  } catch {
    return null;
  }
}

// Existing label names on a repo. Used to only ever apply labels a repo
// already has — never creates new ones (see createIssue()'s labels param).
export async function listRepoLabels(repo: string): Promise<string[]> {
  if (usingRestApi()) {
    const labels = (await ghApiFetch(`/repos/${repo}/labels?per_page=100`)) as {
      name: string;
    }[];
    return labels.map((l) => l.name);
  }
  const { stdout } = await execFileP("gh", [
    "label",
    "list",
    "--repo",
    repo,
    "--json",
    "name",
  ]);
  const labels = JSON.parse(stdout) as { name: string }[];
  return labels.map((l) => l.name);
}

// Files a real GitHub issue via `gh issue create`. Used when a proposed
// (analyzer-suggested) issue gets approved — approval used to just insert a
// local DB row with a synthetic number, since nothing was ever actually
// filed; this makes it a real issue with a real number instead.
export async function createIssue(
  repo: string,
  title: string,
  body: string,
  // ADDED 2026-08-07: already filtered to label names that exist on the
  // repo (see listRepoLabels()) — this function never creates a missing one.
  labels: string[] = [],
): Promise<{ number: number; url: string }> {
  if (usingRestApi()) {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, body, labels }),
    });
    if (!res.ok) {
      throw new Error(
        `Unexpected response from GitHub API creating issue: ${res.status} ${await res.text()}`,
      );
    }
    const created = (await res.json()) as { number: number; html_url: string };
    return { number: created.number, url: created.html_url };
  }
  // COMMENTED 2026-08-07: no labels were ever passed to `gh issue create`,
  // so every approved issue got filed with zero labels.
  // const { stdout } = await execFileP("gh", [
  //   "issue",
  //   "create",
  //   "--repo",
  //   repo,
  //   "--title",
  //   title,
  //   "--body",
  //   body,
  // ]);
  const args = ["issue", "create", "--repo", repo, "--title", title, "--body", body];
  for (const label of labels) {
    args.push("--label", label);
  }
  const { stdout } = await execFileP("gh", args);
  const url = stdout.trim();
  const match = url.match(/\/issues\/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Unexpected output from gh issue create: ${url}`);
  }
  return { number: parseInt(match[1], 10), url };
}
