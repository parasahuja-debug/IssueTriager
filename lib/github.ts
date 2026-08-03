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
