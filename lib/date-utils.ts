const CHINA_TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface WeekRange {
  weekStart: string;
  weekEnd: string;
  weekStartUtc: string;
  weekEndUtc: string;
}

export function getWeekRange(now = new Date()): WeekRange {
  const chinaNow = toChinaTime(now);
  const day = chinaNow.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(chinaNow);
  monday.setUTCDate(chinaNow.getUTCDate() - diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  friday.setUTCHours(23, 59, 59, 999);

  return {
    weekStart: formatChinaDate(monday),
    weekEnd: formatChinaDate(friday),
    weekStartUtc: formatUtcSecond(fromChinaTime(monday)),
    weekEndUtc: formatUtcSecond(fromChinaTime(friday)),
  };
}

export function isInChinaTimeRange(
  isoTimestamp: string,
  range: Pick<WeekRange, 'weekStartUtc' | 'weekEndUtc'>
): boolean {
  const timestamp = new Date(isoTimestamp).getTime();
  return (
    Number.isFinite(timestamp) &&
    timestamp >= new Date(range.weekStartUtc).getTime() &&
    timestamp <= new Date(range.weekEndUtc).getTime()
  );
}

function toChinaTime(date: Date): Date {
  return new Date(date.getTime() + CHINA_TIME_OFFSET_MS);
}

function fromChinaTime(date: Date): Date {
  return new Date(date.getTime() - CHINA_TIME_OFFSET_MS);
}

function formatChinaDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatUtcSecond(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
