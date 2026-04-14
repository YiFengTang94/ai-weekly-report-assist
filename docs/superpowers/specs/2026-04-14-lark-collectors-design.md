# 飞书数据采集扩展设计

## 概述

为 AI 周报助手新增三个飞书数据源：日历事件、会议纪要（妙记）、Wiki 知识空间文档。采集到的内容统一喂给智谱 AI，由 AI 归纳到现有周报四板块结构中。

## 决策记录

| 问题 | 决策 | 原因 |
|------|------|------|
| 数据源范围 | 日历 + 妙记 + Wiki 文档 | 全面覆盖工程师工作场景 |
| 认证方式 | OAuth `user_access_token` | Bot 身份无法访问用户个人资源 |
| Wiki 采集范围 | 指定知识空间，按本周修改时间过滤 | 范围可控，自动化程度高 |
| 内容呈现方式 | 全部喂给 AI 统一归纳 | 保持现有四板块结构不变，AI 自行分配 |
| API 调用方式 | 直接 HTTP fetch() | 与现有代码风格一致，无外部依赖 |

## 1. 认证架构

### 现状

- NextAuth.js 已实现 GitHub OAuth
- 飞书配置仅有 `LARK_APP_ID`、`LARK_APP_SECRET`、`LARK_USER_ID`，无 OAuth 流程

### 方案

在 NextAuth.js 中增加飞书 OAuth Provider：

- **授权地址：** `https://open.feishu.cn/open-apis/authen/v1/authorize`
- **Token 交换：** `https://open.feishu.cn/open-apis/authen/v1/oidc/access_token`
- **Token 续期：** `https://open.feishu.cn/open-apis/authen/v1/oidc/refresh_access_token`

**所需 scope：**

| scope | 用途 |
|-------|------|
| `calendar:calendar:read` | 读取日历 |
| `calendar:calendar.event:read` | 读取日历事件 |
| `vc:meeting.search:read` | 搜索会议记录 |
| `vc:note:read` | 读取会议纪要 |
| `minutes:minutes:readonly` | 读取妙记基础信息 |
| `wiki:node:read` | 读取知识空间节点 |
| `minutes:minutes.artifacts:read` | 读取妙记纪要产物（总结、待办） |
| `docx:document:readonly` | 读取文档内容 |

### Token 管理

- NextAuth session 存储飞书 `user_access_token` 和 `refresh_token`
- 调用飞书 API 前检查 token 有效期，过期自动用 `refresh_token` 续期
- 同时保留 GitHub token（已有）

### 环境变量调整

- 保留：`LARK_APP_ID`、`LARK_APP_SECRET`、`LARK_BOT_WEBHOOK`
- 移除：`LARK_USER_ID`（OAuth 后从 token 获取用户身份）
- 新增：`LARK_WIKI_SPACE_ID`（指定采集的知识空间）

## 2. 数据模型

### 类型扩展（`lib/types.ts`）

```typescript
// 现有 LarkMeeting 扩展
interface LarkMeeting {
  title: string;
  startTime: string;
  endTime: string;
  eventId?: string;       // 日历事件 ID，用于关联会议纪要
}

// 新增
interface LarkMinutes {
  meetingTitle: string;
  summary?: string;        // AI 生成的会议总结
  todos?: string[];        // 待办事项
  duration?: number;       // 时长（毫秒）
}

// 新增
interface LarkWikiDoc {
  title: string;
  content: string;         // 文档正文（截取前 2000 字）
  updatedAt: string;
  url?: string;
}

// 扩展
interface LarkCalendarData {
  meetings: LarkMeeting[];
  minutes: LarkMinutes[];
  wikiDocs: LarkWikiDoc[];
}
```

## 3. 采集器设计

### 3.1 日历事件采集（改写现有 stub）

**文件：** `lib/collectors/lark-calendar.ts`

**流程：**
1. 获取用户主日历 ID
2. 调用 `events.instance_view` 按周时间范围查询
3. 返回 `LarkMeeting[]`，附带 `eventId` 用于后续关联

**API：**
- `GET /open-apis/calendar/v4/calendars/{calendar_id}/events/instance_view`

### 3.2 会议纪要采集（新建）

**文件：** `lib/collectors/lark-minutes.ts`

**流程：**
1. 通过 VC API 搜索本周已结束的会议
2. 对每个会议，获取 notes（纪要文档中的总结和待办）
3. 通过 `calendar_event_id` 与日历事件去重关联
4. 返回 `LarkMinutes[]`

**API：**
- `POST /open-apis/vc/v1/meeting_records/search`（搜索会议记录）
- `GET /open-apis/vc/v1/meetings/{meeting_id}`（获取会议详情）
- Notes 内容通过纪要文档 token 获取

### 3.3 Wiki 文档采集（新建）

**文件：** `lib/collectors/lark-wiki.ts`

**流程：**
1. 遍历 `LARK_WIKI_SPACE_ID` 指定的知识空间节点
2. 按修改时间过滤出本周更新的文档
3. 对每个文档获取内容（截取前 2000 字）
4. 返回 `LarkWikiDoc[]`

**API：**
- `GET /open-apis/wiki/v2/spaces/{space_id}/nodes`（列出节点）
- `GET /open-apis/docx/v1/documents/{document_id}/raw_content`（获取文档内容）

### 关键逻辑

- **去重：** 日历事件和 VC 会议可能是同一个会议，通过 `calendar_event_id` 关联避免重复
- **截断：** Wiki 文档内容截取前 2000 字，防止 AI prompt 过大
- **容错：** 三个采集器通过 `Promise.allSettled` 并行执行，单个失败不阻塞

## 4. AI 总结调整

### Prompt 数据段新增

在现有 Commits / PRs / Issues / 会议段之后，追加：

```
=== 会议纪要 (N) ===
- 会议标题 | AI 总结摘要 | 待办事项

=== 本周文档 (N) ===
- 文档标题 | 内容摘要（前2000字）
```

### System Prompt 指令调整

"会议与协作"板块指令更新为：
> 综合日历事件、会议纪要和会议总结，归纳本周的沟通协作情况。如有待办事项，单独列出。

新增指令：
> 如有本周编辑的文档，在相关工作项中引用，体现文档产出。

### 周报结构

保持不变：本周完成 / 进行中 / 会议与协作 / 下周计划。Wiki 文档由 AI 归入最相关板块。

## 5. Report Service 数据流

```
GitHub Collector ──┐
日历 Collector ────┤
妙记 Collector ────┤  Promise.allSettled
Wiki Collector ────┘         │
                             ▼
                    WeeklyReportData
                             │
                    智谱 AI 总结
                             │
                    Markdown 生成 + 保存 + 推送
```

## 6. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/lark/auth.ts` | 新建 | 飞书 token 管理（获取、缓存、续期） |
| `lib/lark/client.ts` | 新建 | 飞书 API 封装（带认证的 fetch） |
| `lib/auth.ts` | 修改 | 增加飞书 OAuth Provider |
| `lib/types.ts` | 修改 | 新增 LarkMinutes、LarkWikiDoc，扩展 LarkCalendarData |
| `lib/config.ts` | 修改 | 新增 LARK_WIKI_SPACE_ID，移除 LARK_USER_ID |
| `lib/collectors/lark-calendar.ts` | 改写 | 实现真实日历 API 调用 |
| `lib/collectors/lark-minutes.ts` | 新建 | 会议纪要采集 |
| `lib/collectors/lark-wiki.ts` | 新建 | Wiki 文档采集 |
| `lib/summarizer/zhipu.ts` | 修改 | prompt 增加纪要和文档数据段 |
| `lib/services/report-service.ts` | 修改 | 增加纪要和 Wiki 采集器调用 |
