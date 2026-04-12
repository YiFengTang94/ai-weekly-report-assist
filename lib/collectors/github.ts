import { Octokit } from '@octokit/rest';
import type { GitHubCommit, GitHubData, GitHubIssue, GitHubPR } from '@/lib/types';

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
  const q = `author:${username} created:${weekStart}..${weekEnd} type:pr`;
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q,
    sort: 'created',
    order: 'desc',
    per_page: 100,
  });

  return data.items.map((item) => {
    const repoUrl = item.repository_url ?? '';
    const repo = repoUrl.replace('https://api.github.com/repos/', '');
    let status: 'merged' | 'open' | 'closed' = 'open';
    if (item.pull_request?.merged_at) {
      status = 'merged';
    } else if (item.state === 'closed') {
      status = 'closed';
    }
    return {
      title: item.title,
      status,
      repo,
      url: item.html_url ?? '',
    };
  });
}

async function fetchIssues(
  octokit: Octokit,
  username: string,
  weekStart: string,
  weekEnd: string
): Promise<GitHubIssue[]> {
  const q = `author:${username} created:${weekStart}..${weekEnd} type:issue`;
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q,
    sort: 'created',
    order: 'desc',
    per_page: 100,
  });

  return data.items.map((item) => {
    const repoUrl = item.repository_url ?? '';
    const repo = repoUrl.replace('https://api.github.com/repos/', '');
    return {
      title: item.title,
      status: item.state === 'closed' ? 'closed' as const : 'open' as const,
      repo,
      url: item.html_url ?? '',
    };
  });
}
