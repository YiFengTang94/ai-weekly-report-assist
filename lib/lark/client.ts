import { LARK_BASE } from '@/lib/lark/auth';

export interface LarkResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

export async function larkFetch<T = unknown>(
  path: string,
  accessToken: string,
  options: {
    method?: 'GET' | 'POST';
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  const { method = 'GET', params, body } = options;

  let url = `${LARK_BASE}${path}`;
  if (params) {
    const search = new URLSearchParams(params);
    url += `?${search.toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`飞书 API 调用失败 ${method} ${path} (${res.status}): ${text}`);
  }

  const json: LarkResponse<T> = await res.json();
  if (json.code !== 0) {
    throw new Error(`飞书 API 错误 ${path}: [${json.code}] ${json.msg}`);
  }

  return json.data;
}

export async function larkFetchAll<TItem>(
  path: string,
  accessToken: string,
  options: {
    method?: 'GET' | 'POST';
    params?: Record<string, string>;
    body?: unknown;
    itemsKey: string;
    maxPages?: number;
  }
): Promise<TItem[]> {
  const { method = 'GET', params = {}, body, itemsKey, maxPages = 10 } = options;
  const items: TItem[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const reqParams = { ...params };
    if (pageToken) reqParams.page_token = pageToken;

    const data = await larkFetch<Record<string, unknown>>(path, accessToken, {
      method,
      params: method === 'GET' ? reqParams : params,
      body: method === 'POST'
        ? { ...(body as Record<string, unknown> | undefined), page_token: pageToken }
        : undefined,
    });

    const pageItems = data[itemsKey];
    if (Array.isArray(pageItems)) {
      items.push(...pageItems);
    }

    if (!data.has_more || !data.page_token) break;
    pageToken = data.page_token as string;
  }

  return items;
}
