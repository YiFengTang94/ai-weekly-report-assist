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

  const [github, meetings, minutes, wikiDocs] = await Promise.allSettled([
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
  ]);

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

  // Summarize with ZHIPU AI
  const summary = await summarizeWithZhipu(data);

  // Generate markdown report
  const report = generateMarkdown(data, summary);

  // Save to filesystem
  report.filePath = await saveToFile(report);

  return report;
}
