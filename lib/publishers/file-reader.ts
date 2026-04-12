import { promises as fs } from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import type { WeeklyReport } from '@/lib/types';

const REPORT_ID_PATTERN = /^weekly-report-\d{4}-\d{2}-\d{2}$/;

export async function listReports(): Promise<WeeklyReport[]> {
  const dir = path.resolve(config.report.outputDir);

  try {
    const files = await fs.readdir(dir);
    const mdFiles = files
      .filter((f) => f.startsWith('weekly-report-') && f.endsWith('.md'))
      .sort()
      .reverse();

    const reports: WeeklyReport[] = [];
    for (const file of mdFiles) {
      const report = await readReportFile(dir, file);
      if (report) reports.push(report);
    }
    return reports;
  } catch {
    return [];
  }
}

export async function getReportById(
  id: string
): Promise<WeeklyReport | null> {
  const dir = path.resolve(config.report.outputDir);
  if (!REPORT_ID_PATTERN.test(id)) {
    return null;
  }

  try {
    return await readReportFile(dir, `${id}.md`);
  } catch {
    return null;
  }
}

async function readReportFile(
  dir: string,
  filename: string
): Promise<WeeklyReport | null> {
  const filePath = path.resolve(dir, filename);
  if (!isPathInsideDirectory(filePath, dir)) {
    return null;
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const stat = await fs.stat(filePath);
    const id = filename.replace('.md', '');
    // Extract date from filename: weekly-report-YYYY-MM-DD
    const dateMatch = id.match(/weekly-report-(\d{4}-\d{2}-\d{2})/);
    const weekStart = dateMatch?.[1] ?? '';
    // Friday = Monday + 4 days
    let weekEnd = weekStart;
    if (weekStart) {
      const monday = new Date(weekStart);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      const y = friday.getFullYear();
      const m = String(friday.getMonth() + 1).padStart(2, '0');
      const d = String(friday.getDate()).padStart(2, '0');
      weekEnd = `${y}-${m}-${d}`;
    }

    return {
      id,
      weekStart,
      weekEnd,
      content,
      createdAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

function isPathInsideDirectory(filePath: string, dir: string): boolean {
  const relative = path.relative(dir, filePath);
  return (
    Boolean(relative) &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  );
}
