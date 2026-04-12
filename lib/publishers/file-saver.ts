import { promises as fs } from 'fs';
import path from 'path';
import { config } from '@/lib/config';
import type { WeeklyReport } from '@/lib/types';

export async function saveToFile(report: WeeklyReport): Promise<string> {
  const dir = path.resolve(config.report.outputDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${report.id}.md`);
  await fs.writeFile(filePath, report.content, 'utf-8');
  return filePath;
}
