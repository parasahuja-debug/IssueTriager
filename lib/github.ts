import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

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

export async function listIssues(
  repo: string,
  limit = 50,
): Promise<GitHubIssue[]> {
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

// Files a real GitHub issue via `gh issue create`. Used when a proposed
// (analyzer-suggested) issue gets approved — approval used to just insert a
// local DB row with a synthetic number, since nothing was ever actually
// filed; this makes it a real issue with a real number instead.
export async function createIssue(
  repo: string,
  title: string,
  body: string,
): Promise<{ number: number; url: string }> {
  const { stdout } = await execFileP("gh", [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    title,
    "--body",
    body,
  ]);
  const url = stdout.trim();
  const match = url.match(/\/issues\/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Unexpected output from gh issue create: ${url}`);
  }
  return { number: parseInt(match[1], 10), url };
}
