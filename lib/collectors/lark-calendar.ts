import type { LarkCalendarData } from '@/lib/types';

export async function collectLarkCalendarData(
  _weekStart: string,
  _weekEnd: string
): Promise<LarkCalendarData> {
  return {
    meetings: [],
  };
}
