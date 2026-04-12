import { Octokit } from '@octokit/rest';
import type { GitHubCommit, GitHubData, GitHubIssue, GitHubPR } from '@/lib/types';

type SearchIssueItem = Awaited<
  ReturnType<Octokit['rest']['search']['issuesAndPullRequests']>
>['data']['items'][number];
type PRStatus = GitHubPR['status'];

export async function collectGitHubData(
  weekStart: string,
  weekEnd: string,
  token: string,
  username: string
): Promise<GitHubData> {
  const octokit = new Octokit({ auth: token });

  // If username not provided, fetch from authenticated user
  let login = username;
  if (!login) {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    login = user.login;
  }

  const [commits, pullRequests, issues] = await Promise.allSettled([
    fetchCommits(octokit, login, weekStart, weekEnd),
    fetchPRs(octokit, login, weekStart, weekEnd),
    fetchIssues(octokit, login, weekStart, weekEnd),
  ]);

  return {
    commits: commits.status === 'fulfilled' ? commits.value : [],
    pullRequests: pullRequests.status === 'fulfilled' ? pullRequests.value : [],
    issues: issues.status === 'fulfilled' ? issues.value : [],
  };
}

async function fetchCommits(
  octokit: Octokit,
  username: string,
  weekStart: string,
  weekEnd: string
): Promise<GitHubCommit[]> {
  const q = `author:${username} committer-date:${weekStart}..${weekEnd}`;
  const { data } = await octokit.rest.search.commits({
    q,
    sort: 'committer-date',
    order: 'desc',
    per_page: 100,
  });

  return data.items.map((item) => ({
    sha: item.sha.slice(0, 7),
    message: item.commit.message.split('\n')[0],
    repo: item.repository?.full_name ?? '',
    timestamp: item.commit.committer?.date ?? '',
  }));
}

async function fetchPRs(
  octokit: Octokit,
  username: string,
  weekStart: string,
  weekEnd: string
): Promise<GitHubPR[]> {
  const queries = [
    {
      q: `author:${username} merged:${weekStart}..${weekEnd} type:pr`,
      status: 'merged' as const,
    },
    {
      q: `author:${username} closed:${weekStart}..${weekEnd} type:pr`,
      status: 'closed' as const,
    },
    {
      q: `author:${username} updated:${weekStart}..${weekEnd} state:open type:pr`,
    },
  ];

  const results = await Promise.all(
    queries.map(async ({ q, status }) =>
      (await searchIssues(octokit, q)).map((item) => mapPR(item, status))
    )
  );
  const prs = results.flat();
  return dedupeByUrl(prs, prStatusRank);
}

async function fetchIssues(
  octokit: Octokit,
  username: string,
  weekStart: string,
  weekEnd: string
): Promise<GitHubIssue[]> {
  const queries = [
    `author:${username} closed:${weekStart}..${weekEnd} type:issue`,
    `author:${username} updated:${weekStart}..${weekEnd} state:open type:issue`,
  ];

  const results = await Promise.all(queries.map((q) => searchIssues(octokit, q)));
  const issues = results.flat().map(mapIssue);
  return dedupeByUrl(issues, issueStatusRank);
}

async function searchIssues(
  octokit: Octokit,
  q: string
): Promise<SearchIssueItem[]> {
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q,
    sort: 'updated',
    order: 'desc',
    per_page: 100,
  });
  return data.items;
}

function mapPR(item: SearchIssueItem, status?: PRStatus): GitHubPR {
  return {
    title: item.title,
    status: status ?? getPRStatus(item),
    repo: getRepoName(item),
    url: item.html_url ?? '',
  };
}

function mapIssue(item: SearchIssueItem): GitHubIssue {
  return {
    title: item.title,
    status: item.state === 'closed' ? 'closed' : 'open',
    repo: getRepoName(item),
    url: item.html_url ?? '',
  };
}

function getPRStatus(item: SearchIssueItem): GitHubPR['status'] {
  if (item.pull_request?.merged_at) {
    return 'merged';
  }
  return item.state === 'closed' ? 'closed' : 'open';
}

function getRepoName(item: SearchIssueItem): string {
  const repoUrl = item.repository_url ?? '';
  return repoUrl.replace('https://api.github.com/repos/', '');
}

function dedupeByUrl<T extends { repo: string; title: string; url: string }>(
  items: T[],
  rank: (item: T) => number
): T[] {
  const byUrl = new Map<string, T>();
  for (const item of items) {
    const key = item.url || `${item.repo}:${item.title}`;
    const existing = byUrl.get(key);
    if (!existing || rank(item) > rank(existing)) {
      byUrl.set(key, item);
    }
  }
  return Array.from(byUrl.values());
}

function prStatusRank(pr: GitHubPR): number {
  return { merged: 3, closed: 2, open: 1 }[pr.status];
}

function issueStatusRank(issue: GitHubIssue): number {
  return { closed: 2, open: 1 }[issue.status];
}
