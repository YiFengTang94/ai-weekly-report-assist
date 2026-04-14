import { config } from '@/lib/config';

export const LARK_BASE = 'https://open.feishu.cn/open-apis';

let cachedAppToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt) {
    return cachedAppToken.token;
  }

  const res = await fetch(`${LARK_BASE}/auth/v3/app_access_token/internal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.lark.appId,
      app_secret: config.lark.appSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`获取 app_access_token 失败 (${res.status})`);
  }

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`获取 app_access_token 失败: ${data.msg}`);
  }

  cachedAppToken = {
    token: data.app_access_token,
    expiresAt: Date.now() + (data.expire - 300) * 1000,
  };

  return cachedAppToken.token;
}

export async function refreshUserAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const appToken = await getAppAccessToken();

  const res = await fetch(
    `${LARK_BASE}/authen/v1/oidc/refresh_access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${appToken}`,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`刷新 user_access_token 失败 (${res.status})`);
  }

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`刷新 user_access_token 失败: ${data.msg}`);
  }

  return {
    access_token: data.data.access_token,
    refresh_token: data.data.refresh_token,
    expires_in: data.data.expires_in,
  };
}
