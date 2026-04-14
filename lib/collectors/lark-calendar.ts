import { larkFetch } from '@/lib/lark/client';
import type { LarkCalendarData, LarkMeeting } from '@/lib/types';

interface CalendarEvent {
  event_id: string;
  summary: string;
  start_time?: { timestamp?: string; date?: string };
  end_time?: { timestamp?: string; date?: string };
  status?: string;
}

interface InstanceViewData {
  items?: CalendarEvent[];
  has_more?: boolean;
  page_token?: string;
}

export async function collectLarkCalendarEvents(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkMeeting[]> {
  // 获取用户主日历 ID
  const primaryCal = await larkFetch<{ calendars?: Array<{ calendar?: { calendar_id: string } }> }>(
    '/calendar/v4/calendars/primary',
    accessToken
  );
  const calendarId = primaryCal.calendars?.[0]?.calendar?.calendar_id;
  if (!calendarId) {
    console.warn('未找到用户主日历');
    return [];
  }

  // 时间转换为 Unix 秒
  const startTs = Math.floor(new Date(`${weekStart}T00:00:00+08:00`).getTime() / 1000).toString();
  const endTs = Math.floor(new Date(`${weekEnd}T23:59:59+08:00`).getTime() / 1000).toString();

  // 查询日程实例视图
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const params: Record<string, string> = {
      start_time: startTs,
      end_time: endTs,
    };
    if (pageToken) params.page_token = pageToken;

    const data = await larkFetch<InstanceViewData>(
      `/calendar/v4/calendars/${calendarId}/events/instance_view`,
      accessToken,
      { params }
    );

    if (data.items) {
      events.push(...data.items);
    }
    if (!data.has_more || !data.page_token) break;
    pageToken = data.page_token;
  }

  return events
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      title: e.summary || '（无标题）',
      startTime: formatTimestamp(e.start_time?.timestamp),
      endTime: formatTimestamp(e.end_time?.timestamp),
      eventId: e.event_id,
    }));
}

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  const ms = Number(ts) * 1000;
  if (isNaN(ms)) return ts;
  return new Date(ms).toISOString();
}

// Keep old export for backward compatibility until Task 9
export async function collectLarkCalendarData(
  _weekStart: string,
  _weekEnd: string
): Promise<LarkCalendarData> {
  return { meetings: [], minutes: [], wikiDocs: [] };
}
