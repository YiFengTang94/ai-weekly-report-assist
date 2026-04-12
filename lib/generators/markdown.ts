import type { WeeklyReport, WeeklyReportData } from '@/lib/types';

export function generateMarkdown(
  data: WeeklyReportData,
  summary: string
): WeeklyReport {
  const id = `weekly-report-${data.weekStart}`;
  const header = `# 周报 - ${data.weekStart} ~ ${data.weekEnd}\n\n`;
  const content = header + summary;

  return {
    id,
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    content,
    createdAt: new Date().toISOString(),
  };
}
