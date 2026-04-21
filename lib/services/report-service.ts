import { collectGitHubData } from '@/lib/collectors/github';
import { collectLarkCalendarEvents } from '@/lib/collectors/lark-calendar';
import { collectLarkMinutes } from '@/lib/collectors/lark-minutes';
import { collectLarkWikiDocs } from '@/lib/collectors/lark-wiki';
import { getWeekRange } from '@/lib/date-utils';
import { generateMarkdown } from '@/lib/generators/markdown';
import { LarkAuthExpiredError } from '@/lib/lark/client';
import { saveToFile } from '@/lib/publishers/file-saver';
import { summarizeWithZhipu } from '@/lib/summarizer/zhipu';
import type {
  ReportDataSource,
  ReportSourceStatus,
  ReportWarning,
  WeeklyReport,
  WeeklyReportData,
} from '@/lib/types';

type Settled<T> = PromiseSettledResult<T>;

const SOURCE_LABELS: Record<ReportDataSource, string> = {
  github: 'GitHub',
  'lark-calendar': '飞书日历',
  'lark-minutes': '飞书妙记',
  'lark-wiki': '飞书 Wiki',
};

function getErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function buildCollectionWarning(
  source: ReportDataSource,
  reason: unknown
): ReportWarning {
  const label = SOURCE_LABELS[source];

  if (reason instanceof LarkAuthExpiredError) {
    return {
      source,
      code: 'lark-token-expired',
      message: `${label}采集失败：飞书授权已过期，请重新连接飞书。`,
      reconnectRequired: true,
    };
  }

  return {
    source,
    code: 'source-collection-failed',
    message: `${label}采集失败：${getErrorMessage(reason)}`,
  };
}

function valueOrFallback<T>(
  result: Settled<T>,
  source: ReportDataSource,
  fallback: T,
  warnings: ReportWarning[]
): T {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  warnings.push(buildCollectionWarning(source, result.reason));
  return fallback;
}

function getCollectedCount(source: ReportDataSource, value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (source === 'github' && value && typeof value === 'object') {
    const github = value as {
      commits?: unknown[];
      pullRequests?: unknown[];
      issues?: unknown[];
    };
    return (
      (github.commits?.length ?? 0) +
      (github.pullRequests?.length ?? 0) +
      (github.issues?.length ?? 0)
    );
  }

  return 0;
}

function buildSourceStatus<T>(
  result: Settled<T>,
  source: ReportDataSource,
  skipped: boolean
): ReportSourceStatus {
  const label = SOURCE_LABELS[source];

  if (skipped) {
    return {
      source,
      label,
      status: 'skipped',
      message: `${label}已跳过`,
    };
  }

  if (result.status === 'rejected') {
    return {
      source,
      label,
      status: 'failed',
      message: `${label}采集失败`,
    };
  }

  const count = getCollectedCount(source, result.value);
  return {
    source,
    label,
    status: 'collected',
    count,
    message: `${label}已采集 ${count} 条`,
  };
}

export async function generateWeeklyReport(
  token: string,
  username: string,
  larkToken?: string | null,
  initialWarnings: ReportWarning[] = [],
  targetDate?: Date
): Promise<WeeklyReport> {
  const weekRange = getWeekRange(targetDate);
  const warnings = [...initialWarnings];

  const [github, meetings, minutes, wikiDocs] = await Promise.allSettled([
    collectGitHubData(weekRange, token, username),
    larkToken
      ? collectLarkCalendarEvents(
          weekRange.weekStart,
          weekRange.weekEnd,
          larkToken
        )
      : Promise.resolve([]),
    larkToken
      ? collectLarkMinutes(weekRange.weekStart, weekRange.weekEnd, larkToken)
      : Promise.resolve([]),
    larkToken
      ? collectLarkWikiDocs(weekRange.weekStart, weekRange.weekEnd, larkToken)
      : Promise.resolve([]),
  ]);

  const data: WeeklyReportData = {
    weekStart: weekRange.weekStart,
    weekEnd: weekRange.weekEnd,
    github: valueOrFallback(
      github,
      'github',
      { commits: [], pullRequests: [], issues: [] },
      warnings
    ),
    calendar: {
      meetings: valueOrFallback(meetings, 'lark-calendar', [], warnings),
      minutes: valueOrFallback(minutes, 'lark-minutes', [], warnings),
      wikiDocs: valueOrFallback(wikiDocs, 'lark-wiki', [], warnings),
    },
    warnings,
    sourceStatuses: [
      buildSourceStatus(github, 'github', false),
      buildSourceStatus(meetings, 'lark-calendar', !larkToken),
      buildSourceStatus(minutes, 'lark-minutes', !larkToken),
      buildSourceStatus(wikiDocs, 'lark-wiki', !larkToken),
    ],
  };

  const summary = await summarizeWithZhipu(data);
  const report = generateMarkdown(data, summary);
  report.filePath = await saveToFile(report);

  return report;
}
