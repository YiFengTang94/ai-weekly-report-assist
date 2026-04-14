import { config } from '@/lib/config';

export const LARK_BASE = 'https://open.feishu.cn/open-apis';
export const LARK_OAUTH_TOKEN_URL = `${LARK_BASE}/authen/v2/oauth/token`;

interface LarkOAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface LarkUserInfo {
  name?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  en_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  avatar_thumb?: string | null;
  avatar_middle?: string | null;
  avatar_big?: string | null;
}

type LarkOAuthTokenPayload =
  | {
      code?: number;
      msg?: string;
      data?: LarkOAuthToken;
    }
  | (LarkOAuthToken & {
      error?: string;
      error_description?: string;
    });

function normalizeOAuthTokenPayload(
  payload: LarkOAuthTokenPayload
): LarkOAuthToken {
  if ('data' in payload) {
    if (payload.code !== undefined && payload.code !== 0) {
      throw new Error(payload.msg ?? `飞书 OAuth token 接口错误: ${payload.code}`);
    }
    if (!payload.data?.access_token) {
      throw new Error('飞书 OAuth token 响应缺少 access_token');
    }
    return {
      token_type: 'Bearer',
      ...payload.data,
    };
  }

  if ('error' in payload && payload.error) {
    throw new Error(
      payload.error_description ?? `飞书 OAuth token 接口错误: ${payload.error}`
    );
  }

  if ('access_token' in payload && payload.access_token) {
    return {
      token_type: 'Bearer',
      ...payload,
    };
  }

  if ('error_description' in payload && payload.error_description) {
    throw new Error(payload.error_description);
  }

  throw new Error('飞书 OAuth token 响应缺少 access_token');
}

export async function requestLarkOAuthToken(
  params: Record<string, string | undefined>
): Promise<LarkOAuthToken> {
  const requestBody = Object.fromEntries(
    Object.entries({
      client_id: config.lark.appId,
      client_secret: config.lark.appSecret,
      ...params,
    }).filter(([, value]) => value)
  );

  const res = await fetch(LARK_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const payload = (await res.json()) as LarkOAuthTokenPayload;
  if (!res.ok) {
    const message =
      'msg' in payload
        ? payload.msg
        : 'error_description' in payload
          ? payload.error_description
          : undefined;
    throw new Error(
      `飞书 OAuth token 请求失败 (${res.status})${message ? `: ${message}` : ''}`
    );
  }

  return normalizeOAuthTokenPayload(payload);
}

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
): Promise<LarkOAuthToken> {
  return requestLarkOAuthToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

export async function fetchLarkUserInfo(
  accessToken: string
): Promise<LarkUserInfo> {
  const res = await fetch(`${LARK_BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`获取飞书用户信息失败 (${res.status})`);
  }

  const json = await res.json();
  if (json.code !== undefined && json.code !== 0) {
    throw new Error(`获取飞书用户信息失败: ${json.msg}`);
  }

  return (json.data ?? json) as LarkUserInfo;
}
