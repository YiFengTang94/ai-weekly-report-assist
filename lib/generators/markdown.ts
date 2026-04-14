import type { WeeklyReport, WeeklyReportData } from '@/lib/types';

export function generateMarkdown(
  data: WeeklyReportData,
  summary: string
): WeeklyReport {
  const id = `weekly-report-${data.weekStart}`;
  const header = `# 周报 - ${data.weekStart} ~ ${data.weekEnd}\n\n`;
  const sourceStatusBlock = data.sourceStatuses?.length
    ? `## 数据源状态\n\n${data.sourceStatuses.map((status) => `- ${status.message}`).join('\n')}\n\n`
    : '';
  const warningBlock = data.warnings?.length
    ? `${data.warnings.map((warning) => `- ${warning.message}`).join('\n')}\n\n`
    : '';
  const content = header + sourceStatusBlock + warningBlock + summary;

  return {
    id,
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    content,
    createdAt: new Date().toISOString(),
    warnings: data.warnings,
    sourceStatuses: data.sourceStatuses,
  };
}
