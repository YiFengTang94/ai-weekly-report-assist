import { config } from '@/lib/config';
import type { WeeklyReportData } from '@/lib/types';

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

export async function summarizeWithZhipu(
  data: WeeklyReportData
): Promise<string> {
  const apiKey = config.zhipu.apiKey;
  if (!apiKey) {
    throw new Error('未配置 ZHIPU_API_KEY');
  }

  const userMessage = buildPrompt(data);

  const response = await fetch(
    'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.zhipu.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`智谱 API 调用失败 (${response.status}): ${text}`);
  }

  const json = await response.json();
  const choice = json.choices?.[0]?.message;
  // Handle both standard and reasoning model response formats
  const content = choice?.content || choice?.reasoning_content || '';
  if (!content) {
    throw new Error('智谱 API 返回了空内容');
  }
  return content;
}

function buildPrompt(data: WeeklyReportData): string {
  const lines: string[] = [];
  lines.push(`时间范围: ${data.weekStart} ~ ${data.weekEnd}`);
  lines.push('');

  if (data.sourceStatuses?.length) {
    lines.push('=== 数据源状态 ===');
    for (const status of data.sourceStatuses) {
      lines.push(`- ${status.message}`);
    }
    lines.push('');
  }

  if (data.warnings?.length) {
    lines.push('=== 数据源告警 ===');
    for (const warning of data.warnings) {
      lines.push(`- ${warning.message}`);
    }
    lines.push('');
  }

  // Commits
  lines.push(`=== Commits (${data.github.commits.length}) ===`);
  if (data.github.commits.length === 0) {
    lines.push('（无 commit 记录）');
  } else {
    for (const c of data.github.commits) {
      lines.push(`- [${c.repo}] ${c.message} (${c.sha}, ${c.timestamp})`);
    }
  }
  lines.push('');

  // Pull Requests
  lines.push(`=== Pull Requests (${data.github.pullRequests.length}) ===`);
  if (data.github.pullRequests.length === 0) {
    lines.push('（无 PR 记录）');
  } else {
    for (const pr of data.github.pullRequests) {
      lines.push(`- [${pr.repo}] ${pr.title} (${pr.status}, ${pr.url})`);
    }
  }
  lines.push('');

  // Issues
  lines.push(`=== Issues (${data.github.issues.length}) ===`);
  if (data.github.issues.length === 0) {
    lines.push('（无 Issue 记录）');
  } else {
    for (const issue of data.github.issues) {
      lines.push(
        `- [${issue.repo}] ${issue.title} (${issue.status}, ${issue.url})`
      );
    }
  }
  lines.push('');

  // Meetings
  lines.push(`=== 会议 (${data.calendar.meetings.length}) ===`);
  if (data.calendar.meetings.length === 0) {
    lines.push('（无会议记录）');
  } else {
    for (const m of data.calendar.meetings) {
      lines.push(`- ${m.title} (${m.startTime} ~ ${m.endTime})`);
    }
  }

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
