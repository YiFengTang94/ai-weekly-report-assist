import { auth } from '@/lib/auth';

export async function resolveGitHubToken(): Promise<{
  token: string;
  username: string;
}> {
  // Try session OAuth token first (interactive user)
  const session = await auth();
  if (session?.accessToken) {
    return {
      token: session.accessToken,
      username: session.user?.name ?? '',
    };
  }

  // Fall back to env PAT (cron jobs / headless)
  const token = process.env.GITHUB_TOKEN ?? '';
  const username = process.env.GITHUB_USERNAME ?? '';
  if (!token) {
    throw new Error('未找到 GitHub 凭证，请先登录或配置 GITHUB_TOKEN');
  }
  return { token, username };
}
