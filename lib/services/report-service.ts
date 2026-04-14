import { collectGitHubData } from '@/lib/collectors/github';
import { collectLarkCalendarData } from '@/lib/collectors/lark-calendar';
import { getWeekRange } from '@/lib/date-utils';
import { generateMarkdown } from '@/lib/generators/markdown';
import { saveToFile } from '@/lib/publishers/file-saver';
import { summarizeWithZhipu } from '@/lib/summarizer/zhipu';
import type { WeeklyReport, WeeklyReportData } from '@/lib/types';

export async function generateWeeklyReport(
  token: string,
  username: string
): Promise<WeeklyReport> {
  const { weekStart, weekEnd } = getWeekRange();

  // Collect data in parallel — individual failures don't block the pipeline
  const [github, calendar] = await Promise.allSettled([
    collectGitHubData(weekStart, weekEnd, token, username),
    collectLarkCalendarData(weekStart, weekEnd),
  ]);

  const data: WeeklyReportData = {
    weekStart,
    weekEnd,
    github:
      github.status === 'fulfilled'
        ? github.value
        : { commits: [], pullRequests: [], issues: [] },
    calendar:
      calendar.status === 'fulfilled'
        ? calendar.value
        : { meetings: [], minutes: [], wikiDocs: [] },
  };

  // Summarize with ZHIPU AI
  const summary = await summarizeWithZhipu(data);

  // Generate markdown report
  const report = generateMarkdown(data, summary);

  // Save to filesystem
  report.filePath = await saveToFile(report);

  return report;
}
