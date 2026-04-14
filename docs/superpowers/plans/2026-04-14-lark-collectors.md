# 飞书数据采集扩展 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AI 周报助手新增飞书日历事件、会议纪要（妙记）、Wiki 文档三个数据采集器，通过 OAuth 认证访问用户个人资源。

**Architecture:** 在 NextAuth.js 中增加飞书自定义 OAuth Provider，用户先用 GitHub 登录再"连接飞书"。新增 `lib/lark/` 目录管理认证和 API 客户端，三个采集器各自独立实现后在 report-service 中并行调用。所有采集数据统一喂给智谱 AI 总结。

**Tech Stack:** Next.js 15 App Router, NextAuth.js 5 (beta.30), TypeScript, Lark Open Platform REST API (OIDC OAuth)

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `lib/types.ts` | 修改：新增 LarkMinutes、LarkWikiDoc，扩展 LarkMeeting 和 LarkCalendarData |
| `lib/config.ts` | 修改：新增 lark.wikiSpaceId，移除 lark.userId |
| `lib/lark/auth.ts` | 新建：app_access_token 获取 + user_access_token 刷新 |
| `lib/lark/client.ts` | 新建：带认证的飞书 API fetch 封装 |
| `lib/auth.ts` | 修改：增加飞书 OAuth Provider，JWT 存储多 provider token |
| `lib/collectors/lark-calendar.ts` | 改写：调用真实飞书日历 API |
| `lib/collectors/lark-minutes.ts` | 新建：VC 会议搜索 + 纪要获取 |
| `lib/collectors/lark-wiki.ts` | 新建：Wiki 空间节点遍历 + 文档内容获取 |
| `lib/summarizer/zhipu.ts` | 修改：prompt 增加纪要和文档数据段 |
| `lib/services/report-service.ts` | 修改：增加 Lark token 传入，调用新采集器 |
| `lib/lark-token.ts` | 新建：类似 github-token.ts，从 session 或环境变量解析 Lark token |
| `app/api/report/generate/route.ts` | 修改：传入 Lark token |
| `app/api/cron/route.ts` | 修改：传入 Lark token（环境变量回退） |

---

### Task 1: 扩展类型定义和配置

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/config.ts`

- [ ] **Step 1: 扩展类型定义**

在 `lib/types.ts` 中新增类型并扩展已有接口：

```typescript
// === 现有 LarkMeeting 增加 eventId 字段 ===
export interface LarkMeeting {
  title: string;
  startTime: string;
  endTime: string;
  eventId?: string;
}

// === 新增 ===
export interface LarkMinutes {
  meetingTitle: string;
  summary?: string;
  todos?: string[];
  duration?: number;
}

export interface LarkWikiDoc {
  title: string;
  content: string;
  updatedAt: string;
  url?: string;
}

// === 扩展 LarkCalendarData ===
export interface LarkCalendarData {
  meetings: LarkMeeting[];
  minutes: LarkMinutes[];
  wikiDocs: LarkWikiDoc[];
}
```

同时更新 `WeeklyReportData` 中 `calendar` 字段的默认空值（在 report-service 中处理）。

- [ ] **Step 2: 更新配置**

在 `lib/config.ts` 中修改 lark 配置段：

```typescript
lark: {
  appId: process.env.LARK_APP_ID ?? '',
  appSecret: process.env.LARK_APP_SECRET ?? '',
  botWebhook: process.env.LARK_BOT_WEBHOOK ?? '',
  wikiSpaceId: process.env.LARK_WIKI_SPACE_ID ?? '',
},
```

移除 `userId` 字段。

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功（LarkCalendarData 扩展可能导致部分文件报错，在后续 task 中修复）

注意：如果 `report-service.ts` 中的默认空值 `{ meetings: [] }` 不再满足 `LarkCalendarData`，暂时补上 `{ meetings: [], minutes: [], wikiDocs: [] }`。

- [ ] **Step 4: 提交**

```bash
git add lib/types.ts lib/config.ts lib/services/report-service.ts
git commit -m "feat: extend types for Lark minutes and wiki docs"
```

---

### Task 2: 飞书认证模块

**Files:**
- Create: `lib/lark/auth.ts`

- [ ] **Step 1: 创建 app_access_token 获取函数**

```typescript
// lib/lark/auth.ts
import { config } from '@/lib/config';

const LARK_BASE = 'https://open.feishu.cn/open-apis';

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
    expiresAt: Date.now() + (data.expire - 300) * 1000, // 提前 5 分钟过期
  };

  return cachedAppToken.token;
}
```

- [ ] **Step 2: 创建 user_access_token 刷新函数**

在同一文件中追加：

```typescript
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
```

- [ ] **Step 3: 导出 LARK_BASE 常量**

在文件顶部将 `LARK_BASE` 改为 export：

```typescript
export const LARK_BASE = 'https://open.feishu.cn/open-apis';
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
git add lib/lark/auth.ts
git commit -m "feat: add Lark auth module for app and user token management"
```

---

### Task 3: 飞书 API 客户端

**Files:**
- Create: `lib/lark/client.ts`

- [ ] **Step 1: 创建带认证的 fetch 封装**

```typescript
// lib/lark/client.ts
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
```

- [ ] **Step 2: 添加分页辅助函数**

在同一文件追加：

```typescript
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
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add lib/lark/client.ts
git commit -m "feat: add Lark API client with pagination support"
```

---

### Task 4: NextAuth 飞书 OAuth Provider

**Files:**
- Modify: `lib/auth.ts`
- Create: `lib/lark-token.ts`

- [ ] **Step 1: 定义飞书自定义 OAuth Provider**

改写 `lib/auth.ts`，在现有 GitHub provider 旁新增飞书 provider：

```typescript
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import type { OAuthConfig } from 'next-auth/providers';
import { config as appConfig } from '@/lib/config';
import { getAppAccessToken, refreshUserAccessToken } from '@/lib/lark/auth';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    larkAccessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    larkAccessToken?: string;
    larkRefreshToken?: string;
    larkExpiresAt?: number;
  }
}

const LARK_SCOPES = [
  'calendar:calendar:read',
  'calendar:calendar.event:read',
  'vc:meeting.search:read',
  'vc:note:read',
  'minutes:minutes:readonly',
  'minutes:minutes.artifacts:read',
  'wiki:node:read',
  'docx:document:readonly',
].join(' ');

function LarkProvider(): OAuthConfig<Record<string, unknown>> {
  return {
    id: 'lark',
    name: 'Lark',
    type: 'oauth',
    authorization: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/authorize',
      params: {
        app_id: appConfig.lark.appId,
        scope: LARK_SCOPES,
      },
    },
    token: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
      async request({ params }) {
        const appToken = await getAppAccessToken();
        const res = await fetch(
          'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${appToken}`,
            },
            body: JSON.stringify({
              grant_type: 'authorization_code',
              code: params.code,
            }),
          }
        );
        const json = await res.json();
        if (json.code !== 0) {
          throw new Error(`飞书 token 交换失败: ${json.msg}`);
        }
        return {
          tokens: {
            access_token: json.data.access_token,
            refresh_token: json.data.refresh_token,
            expires_in: json.data.expires_in,
            token_type: 'Bearer',
          },
        };
      },
    },
    userinfo: {
      url: 'https://open.feishu.cn/open-apis/authen/v1/user_info',
      async request({ tokens }) {
        const res = await fetch(
          'https://open.feishu.cn/open-apis/authen/v1/user_info',
          {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }
        );
        const json = await res.json();
        return json.data;
      },
    },
    profile(profile) {
      return {
        id: profile.open_id as string,
        name: profile.name as string,
        email: profile.email as string,
        image: profile.avatar_url as string,
      };
    },
    clientId: appConfig.lark.appId,
    clientSecret: appConfig.lark.appSecret,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      authorization: { params: { scope: 'repo read:user' } },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
    LarkProvider(),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === 'github') {
        token.accessToken = account.access_token;
      }
      if (account?.provider === 'lark') {
        token.larkAccessToken = account.access_token;
        token.larkRefreshToken = account.refresh_token;
        token.larkExpiresAt = Date.now() + (account.expires_in as number ?? 7200) * 1000;
      }
      // 自动刷新飞书 token
      if (
        token.larkRefreshToken &&
        token.larkExpiresAt &&
        Date.now() > token.larkExpiresAt - 300_000
      ) {
        try {
          const refreshed = await refreshUserAccessToken(
            token.larkRefreshToken as string
          );
          token.larkAccessToken = refreshed.access_token;
          token.larkRefreshToken = refreshed.refresh_token;
          token.larkExpiresAt = Date.now() + refreshed.expires_in * 1000;
        } catch {
          // 刷新失败，清除 token，用户需要重新授权
          token.larkAccessToken = undefined;
          token.larkRefreshToken = undefined;
          token.larkExpiresAt = undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.larkAccessToken = token.larkAccessToken as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: 创建 Lark token 解析器**

创建 `lib/lark-token.ts`，类似现有的 `lib/github-token.ts`：

```typescript
// lib/lark-token.ts
import { auth } from '@/lib/auth';

export async function resolveLarkToken(): Promise<string | null> {
  // 优先从 session 获取（交互式用户）
  const session = await auth();
  if (session?.larkAccessToken) {
    return session.larkAccessToken;
  }

  // 回退到环境变量（cron 场景，需要手动配置长期 token）
  const token = process.env.LARK_USER_ACCESS_TOKEN ?? '';
  return token || null;
}
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

注意：NextAuth 5 beta 的类型定义可能需要调整。如果 `OAuthConfig` 的 `token.request` 签名不匹配，根据实际 API 调整参数名。

- [ ] **Step 4: 提交**

```bash
git add lib/auth.ts lib/lark-token.ts
git commit -m "feat: add Lark OAuth provider and token resolver"
```

---

### Task 5: 日历事件采集器

**Files:**
- Modify: `lib/collectors/lark-calendar.ts`

- [ ] **Step 1: 实现日历事件采集**

改写 `lib/collectors/lark-calendar.ts`：

```typescript
import { larkFetch } from '@/lib/lark/client';
import type { LarkMeeting } from '@/lib/types';

interface CalendarEvent {
  event_id: string;
  summary: string;
  start_time?: { timestamp?: string; date?: string };
  end_time?: { timestamp?: string; date?: string };
  status?: string;
}

interface InstanceViewData {
  items?: CalendarEvent[];
  has_more?: boolean;
  page_token?: string;
}

export async function collectLarkCalendarEvents(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkMeeting[]> {
  // 获取用户主日历 ID
  const primaryCal = await larkFetch<{ calendars?: Array<{ calendar?: { calendar_id: string } }> }>(
    '/calendar/v4/calendars/primary',
    accessToken
  );
  const calendarId = primaryCal.calendars?.[0]?.calendar?.calendar_id;
  if (!calendarId) {
    console.warn('未找到用户主日历');
    return [];
  }

  // 时间转换为 Unix 秒
  const startTs = Math.floor(new Date(`${weekStart}T00:00:00+08:00`).getTime() / 1000).toString();
  const endTs = Math.floor(new Date(`${weekEnd}T23:59:59+08:00`).getTime() / 1000).toString();

  // 查询日程实例视图
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      start_time: startTs,
      end_time: endTs,
    };
    if (pageToken) params.page_token = pageToken;

    const data = await larkFetch<InstanceViewData>(
      `/calendar/v4/calendars/${calendarId}/events/instance_view`,
      accessToken,
      { params }
    );

    if (data.items) {
      events.push(...data.items);
    }
    if (!data.has_more || !data.page_token) break;
    pageToken = data.page_token;
  }

  return events
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      title: e.summary || '（无标题）',
      startTime: formatTimestamp(e.start_time?.timestamp),
      endTime: formatTimestamp(e.end_time?.timestamp),
      eventId: e.event_id,
    }));
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const ms = Number(ts) * 1000;
  if (isNaN(ms)) return ts;
  return new Date(ms).toISOString();
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add lib/collectors/lark-calendar.ts
git commit -m "feat: implement Lark calendar events collector"
```

---

### Task 6: 会议纪要采集器

**Files:**
- Create: `lib/collectors/lark-minutes.ts`

- [ ] **Step 1: 实现会议搜索 + 纪要获取**

```typescript
// lib/collectors/lark-minutes.ts
import { larkFetch } from '@/lib/lark/client';
import type { LarkMinutes } from '@/lib/types';

interface MeetingRecord {
  meeting_id: string;
  topic: string;
  start_time?: string;
  end_time?: string;
}

interface MeetingSearchData {
  meeting_list?: MeetingRecord[];
  has_more?: boolean;
  page_token?: string;
}

interface NoteInfo {
  notes?: Array<{
    note_doc_token?: string;
  }>;
}

interface MinuteArtifacts {
  minute?: {
    title?: string;
    duration?: number;
  };
  artifacts?: {
    summary?: string;
    todos?: Array<{ content?: string }>;
  };
}

export async function collectLarkMinutes(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkMinutes[]> {
  // 搜索本周的会议记录
  const startTs = Math.floor(new Date(`${weekStart}T00:00:00+08:00`).getTime() / 1000).toString();
  const endTs = Math.floor(new Date(`${weekEnd}T23:59:59+08:00`).getTime() / 1000).toString();

  const meetings: MeetingRecord[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const data = await larkFetch<MeetingSearchData>(
      '/vc/v1/meetings/search',
      accessToken,
      {
        method: 'POST',
        body: {
          start_time: startTs,
          end_time: endTs,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      }
    );

    if (data.meeting_list) {
      meetings.push(...data.meeting_list);
    }
    if (!data.has_more || !data.page_token) break;
    pageToken = data.page_token;
  }

  // 对每个会议获取纪要
  const results: LarkMinutes[] = [];

  for (const meeting of meetings) {
    try {
      const minutesData = await fetchMeetingNotes(meeting, accessToken);
      if (minutesData) {
        results.push(minutesData);
      } else {
        // 无纪要的会议，只记录标题
        results.push({
          meetingTitle: meeting.topic || '（无标题会议）',
        });
      }
    } catch {
      // 单个会议纪要获取失败不影响整体
      results.push({
        meetingTitle: meeting.topic || '（无标题会议）',
      });
    }
  }

  return results;
}

async function fetchMeetingNotes(
  meeting: MeetingRecord,
  accessToken: string
): Promise<LarkMinutes | null> {
  // 先尝试获取会议的 note 信息
  try {
    const noteData = await larkFetch<NoteInfo>(
      `/vc/v1/meetings/${meeting.meeting_id}/note`,
      accessToken
    );

    if (!noteData.notes?.length) return null;

    const noteDocToken = noteData.notes[0].note_doc_token;
    if (!noteDocToken) return null;

    // 获取纪要文档内容（总结和待办）
    const docContent = await fetchDocContent(noteDocToken, accessToken);

    return {
      meetingTitle: meeting.topic || '（无标题会议）',
      summary: docContent.summary,
      todos: docContent.todos,
      duration: meeting.end_time && meeting.start_time
        ? (Number(meeting.end_time) - Number(meeting.start_time)) * 1000
        : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchDocContent(
  docToken: string,
  accessToken: string
): Promise<{ summary?: string; todos?: string[] }> {
  try {
    const data = await larkFetch<{ content?: string }>(
      `/docx/v1/documents/${docToken}/raw_content`,
      accessToken
    );

    const content = data.content ?? '';
    // 提取纪要中的总结和待办（纪要文档通常有固定结构）
    const summaryMatch = content.match(/(?:总结|Summary)[：:]\s*([\s\S]*?)(?=(?:待办|Todo|$))/i);
    const todosMatch = content.match(/(?:待办|Todo)[：:]\s*([\s\S]*?)$/i);

    const summary = summaryMatch?.[1]?.trim();
    const todosText = todosMatch?.[1]?.trim();
    const todos = todosText
      ? todosText.split('\n').map((t) => t.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
      : undefined;

    return { summary, todos };
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add lib/collectors/lark-minutes.ts
git commit -m "feat: implement Lark meeting minutes collector"
```

---

### Task 7: Wiki 文档采集器

**Files:**
- Create: `lib/collectors/lark-wiki.ts`

- [ ] **Step 1: 实现 Wiki 空间文档采集**

```typescript
// lib/collectors/lark-wiki.ts
import { config } from '@/lib/config';
import { larkFetch, larkFetchAll } from '@/lib/lark/client';
import type { LarkWikiDoc } from '@/lib/types';

const MAX_CONTENT_LENGTH = 2000;

interface WikiNode {
  space_id: string;
  node_token: string;
  obj_token: string;
  obj_type: string;
  title: string;
  has_child?: boolean;
  node_create_time?: string;
  node_type?: string;
  obj_edit_time?: string;
  obj_create_time?: string;
}

export async function collectLarkWikiDocs(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkWikiDoc[]> {
  const spaceId = config.lark.wikiSpaceId;
  if (!spaceId) {
    console.warn('未配置 LARK_WIKI_SPACE_ID，跳过 Wiki 采集');
    return [];
  }

  const weekStartMs = new Date(`${weekStart}T00:00:00+08:00`).getTime();
  const weekEndMs = new Date(`${weekEnd}T23:59:59+08:00`).getTime();

  // 获取知识空间的所有节点
  const nodes = await larkFetchAll<WikiNode>(
    `/wiki/v2/spaces/${spaceId}/nodes`,
    accessToken,
    {
      params: { page_size: '50' },
      itemsKey: 'items',
      maxPages: 20,
    }
  );

  // 过滤本周修改的文档节点
  const recentDocs = nodes.filter((node) => {
    if (node.obj_type !== 'docx' && node.obj_type !== 'doc') return false;
    const editTime = Number(node.obj_edit_time ?? '0') * 1000;
    return editTime >= weekStartMs && editTime <= weekEndMs;
  });

  // 获取每个文档的内容（并行，最多 5 个）
  const results: LarkWikiDoc[] = [];
  const batchSize = 5;

  for (let i = 0; i < recentDocs.length; i += batchSize) {
    const batch = recentDocs.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((node) => fetchWikiDocContent(node, accessToken))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

async function fetchWikiDocContent(
  node: WikiNode,
  accessToken: string
): Promise<LarkWikiDoc | null> {
  try {
    const data = await larkFetch<{ content?: string }>(
      `/docx/v1/documents/${node.obj_token}/raw_content`,
      accessToken
    );

    const fullContent = data.content ?? '';
    const content = fullContent.length > MAX_CONTENT_LENGTH
      ? fullContent.slice(0, MAX_CONTENT_LENGTH) + '...（已截断）'
      : fullContent;

    return {
      title: node.title,
      content,
      updatedAt: node.obj_edit_time
        ? new Date(Number(node.obj_edit_time) * 1000).toISOString()
        : '',
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 3: 提交**

```bash
git add lib/collectors/lark-wiki.ts
git commit -m "feat: implement Lark Wiki docs collector"
```

---

### Task 8: 更新智谱 AI Prompt

**Files:**
- Modify: `lib/summarizer/zhipu.ts`

- [ ] **Step 1: 更新 System Prompt**

在 `zhipu.ts` 的 `SYSTEM_PROMPT` 中更新"会议与协作"相关指令：

```typescript
const SYSTEM_PROMPT = `你是一个专业的工作周报撰写助手。请根据提供的工作数据，生成一份结构化的中文周报。

要求：
1. 语言简洁专业，避免口语化
2. 将零散的 commit 信息归纳成有意义的工作项描述，而非简单罗列
3. 相关的 commit 和 PR 应合并归纳为同一工作项
4. 综合日历事件、会议纪要和会议总结，归纳本周的沟通协作情况。如有待办事项，单独列出
5. 如有本周编辑的文档，在相关工作项中引用，体现文档产出
6. 严格按照以下 Markdown 结构输出：

## 本周完成
（归纳已 merge 的 PR、已关闭的 Issue、关键 commit）

## 进行中
（归纳仍 open 的 PR 和 Issue）

## 会议与协作
（本周会议概要、纪要摘要及待办事项，如无会议数据则写"本周无会议记录"）

## 下周计划
（基于进行中的工作，推断下周重点方向）`;
```

- [ ] **Step 2: 扩展 buildPrompt 函数**

在 `buildPrompt` 函数末尾，追加会议纪要和文档数据段：

```typescript
function buildPrompt(data: WeeklyReportData): string {
  const lines: string[] = [];
  lines.push(`时间范围: ${data.weekStart} ~ ${data.weekEnd}`);
  lines.push('');

  // === 现有段落保持不变：Commits、PRs、Issues、会议 ===
  // ... (保留原有代码)

  // === 新增：会议纪要 ===
  lines.push('');
  lines.push(`=== 会议纪要 (${data.calendar.minutes.length}) ===`);
  if (data.calendar.minutes.length === 0) {
    lines.push('（无会议纪要）');
  } else {
    for (const m of data.calendar.minutes) {
      lines.push(`- ${m.meetingTitle}`);
      if (m.summary) lines.push(`  总结: ${m.summary}`);
      if (m.todos?.length) {
        lines.push(`  待办: ${m.todos.join('；')}`);
      }
    }
  }

  // === 新增：本周文档 ===
  lines.push('');
  lines.push(`=== 本周文档 (${data.calendar.wikiDocs.length}) ===`);
  if (data.calendar.wikiDocs.length === 0) {
    lines.push('（无文档更新）');
  } else {
    for (const doc of data.calendar.wikiDocs) {
      lines.push(`- ${doc.title} (更新于 ${doc.updatedAt})`);
      if (doc.content) {
        lines.push(`  内容摘要: ${doc.content}`);
      }
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 3: 验证构建**

Run: `pnpm build`
Expected: 构建成功

- [ ] **Step 4: 提交**

```bash
git add lib/summarizer/zhipu.ts
git commit -m "feat: extend AI prompt with meeting minutes and wiki docs"
```

---

### Task 9: 整合 Report Service

**Files:**
- Modify: `lib/services/report-service.ts`
- Modify: `app/api/report/generate/route.ts`
- Modify: `app/api/cron/route.ts`

- [ ] **Step 1: 更新 report-service 签名和调用**

```typescript
// lib/services/report-service.ts
import { collectGitHubData } from '@/lib/collectors/github';
import { collectLarkCalendarEvents } from '@/lib/collectors/lark-calendar';
import { collectLarkMinutes } from '@/lib/collectors/lark-minutes';
import { collectLarkWikiDocs } from '@/lib/collectors/lark-wiki';
import { getWeekRange } from '@/lib/date-utils';
import { generateMarkdown } from '@/lib/generators/markdown';
import { saveToFile } from '@/lib/publishers/file-saver';
import { summarizeWithZhipu } from '@/lib/summarizer/zhipu';
import type { WeeklyReport, WeeklyReportData } from '@/lib/types';

export async function generateWeeklyReport(
  token: string,
  username: string,
  larkToken?: string | null
): Promise<WeeklyReport> {
  const { weekStart, weekEnd } = getWeekRange();

  // 构建并行任务列表
  const tasks = [
    collectGitHubData(weekStart, weekEnd, token, username),
    larkToken
      ? collectLarkCalendarEvents(weekStart, weekEnd, larkToken)
      : Promise.resolve([]),
    larkToken
      ? collectLarkMinutes(weekStart, weekEnd, larkToken)
      : Promise.resolve([]),
    larkToken
      ? collectLarkWikiDocs(weekStart, weekEnd, larkToken)
      : Promise.resolve([]),
  ] as const;

  const [github, meetings, minutes, wikiDocs] = await Promise.allSettled(tasks);

  const data: WeeklyReportData = {
    weekStart,
    weekEnd,
    github:
      github.status === 'fulfilled'
        ? github.value
        : { commits: [], pullRequests: [], issues: [] },
    calendar: {
      meetings: meetings.status === 'fulfilled' ? meetings.value : [],
      minutes: minutes.status === 'fulfilled' ? minutes.value : [],
      wikiDocs: wikiDocs.status === 'fulfilled' ? wikiDocs.value : [],
    },
  };

  const summary = await summarizeWithZhipu(data);
  const report = generateMarkdown(data, summary);
  report.filePath = await saveToFile(report);

  return report;
}
```

- [ ] **Step 2: 更新 generate route**

```typescript
// app/api/report/generate/route.ts
import { NextResponse } from 'next/server';
import { resolveGitHubToken } from '@/lib/github-token';
import { resolveLarkToken } from '@/lib/lark-token';
import { generateWeeklyReport } from '@/lib/services/report-service';

export async function POST() {
  try {
    const { token, username } = await resolveGitHubToken();
    const larkToken = await resolveLarkToken();
    const report = await generateWeeklyReport(token, username, larkToken);
    return NextResponse.json({ report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '周报生成失败';
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 更新 cron route**

```typescript
// app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport } from '@/lib/services/report-service';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = process.env.GITHUB_TOKEN ?? '';
    const username = process.env.GITHUB_USERNAME ?? '';
    if (!token) {
      return NextResponse.json(
        { error: '未配置 GITHUB_TOKEN' },
        { status: 500 }
      );
    }

    // Cron 场景下的飞书 token（如有配置）
    const larkToken = process.env.LARK_USER_ACCESS_TOKEN || null;

    const report = await generateWeeklyReport(token, username, larkToken);
    return NextResponse.json({ report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '周报生成失败';
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 4: 验证构建**

Run: `pnpm build`
Expected: 构建成功，无类型错误

- [ ] **Step 5: 提交**

```bash
git add lib/services/report-service.ts app/api/report/generate/route.ts app/api/cron/route.ts
git commit -m "feat: integrate Lark collectors into report generation pipeline"
```

---

### Task 10: 构建验证与收尾

**Files:**
- No new files

- [ ] **Step 1: 完整构建**

Run: `pnpm build`
Expected: 构建成功，无错误

- [ ] **Step 2: Lint 检查**

Run: `pnpm lint`
Expected: 无 lint 错误（或仅有 warnings）

- [ ] **Step 3: 启动开发服务器验证**

Run: `pnpm dev`

手动验证项：
1. 打开首页，确认现有 GitHub 登录功能正常
2. 点击"生成周报"按钮，确认在没有飞书 token 时仅采集 GitHub 数据，纪要和文档段显示为空
3. 确认周报结构完整（四个板块）

- [ ] **Step 4: 更新 SPEC.md 后续扩展清单**

在 `SPEC.md` 的"后续扩展方向"中，将"飞书会议纪要/笔记内容采集"标记为已完成：

```markdown
- [x] 飞书会议纪要/笔记内容采集
```

- [ ] **Step 5: 最终提交**

```bash
git add SPEC.md
git commit -m "docs: mark Lark collectors as implemented in SPEC"
```
