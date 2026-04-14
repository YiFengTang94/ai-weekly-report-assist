// lib/collectors/lark-minutes.ts
import { config } from '@/lib/config';
import {
  LarkAuthExpiredError,
  larkFetch,
  larkFetchText,
} from '@/lib/lark/client';
import type { LarkMinutes } from '@/lib/types';

const MAX_TRANSCRIPT_LENGTH = 2000;

interface MeetingRecord {
  meeting_id: string;
  topic: string;
  start_time?: string;
  end_time?: string;
}

interface MeetingSearchData {
  meeting_list?: MeetingRecord[];
  has_more?: boolean;
  page_token?: string;
}

interface MinuteInfo {
  token?: string;
  title?: string;
  url?: string;
  duration?: string;
  create_time?: string;
}

export async function collectLarkMinutes(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkMinutes[]> {
  const startMs = new Date(`${weekStart}T00:00:00+08:00`).getTime();
  const endMs = new Date(`${weekEnd}T23:59:59+08:00`).getTime();
  const startTs = Math.floor(startMs / 1000).toString();
  const endTs = Math.floor(endMs / 1000).toString();

  const meetings: MeetingRecord[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const data = await larkFetch<MeetingSearchData>(
      '/vc/v1/meetings/search',
      accessToken,
      {
        method: 'POST',
        body: {
          start_time: startTs,
          end_time: endTs,
          ...(pageToken ? { page_token: pageToken } : {}),
        },
      }
    );

    if (data.meeting_list) {
      meetings.push(...data.meeting_list);
    }
    if (!data.has_more || !data.page_token) break;
    pageToken = data.page_token;
  }

  const results: LarkMinutes[] = [];

  for (const meeting of meetings) {
    try {
      const minutesData = await fetchMeetingNotes(meeting, accessToken);
      if (minutesData) {
        results.push(minutesData);
      } else {
        results.push({
          meetingTitle: meeting.topic || '（无标题会议）',
          source: 'vc',
        });
      }
    } catch {
      results.push({
        meetingTitle: meeting.topic || '（无标题会议）',
        source: 'vc',
      });
    }
  }

  const configuredMinuteTokens = parseMinuteTokens(config.lark.minuteTokens);
  for (const token of configuredMinuteTokens) {
    try {
      const minute = await fetchConfiguredMinute(token, accessToken);
      if (isMinuteInRange(minute, startMs, endMs)) {
        results.push(minute);
      }
    } catch (error) {
      if (error instanceof LarkAuthExpiredError) {
        throw error;
      }
      console.warn(`飞书妙记 ${token} 采集失败`, error);
    }
  }

  return results;
}

function parseMinuteTokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,，]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          const match = item.match(/\/minutes\/([^/?#]+)/);
          return match?.[1] ?? item;
        })
    )
  );
}

function isMinuteInRange(
  minute: LarkMinutes & { createTime?: number },
  weekStartMs: number,
  weekEndMs: number
): boolean {
  if (!minute.createTime) {
    return true;
  }

  return minute.createTime >= weekStartMs && minute.createTime <= weekEndMs;
}

async function fetchConfiguredMinute(
  minuteToken: string,
  accessToken: string
): Promise<LarkMinutes & { createTime?: number }> {
  const data = await larkFetch<{ minute?: MinuteInfo }>(
    `/minutes/v1/minutes/${minuteToken}`,
    accessToken
  );
  const minute = data.minute;
  const transcript = await fetchMinuteTranscript(minuteToken, accessToken);

  return {
    meetingTitle: minute?.title ?? '（未命名妙记）',
    summary: transcript,
    duration: minute?.duration ? Number(minute.duration) : undefined,
    url: minute?.url,
    source: 'minutes',
    createTime: minute?.create_time ? Number(minute.create_time) : undefined,
  };
}

async function fetchMinuteTranscript(
  minuteToken: string,
  accessToken: string
): Promise<string | undefined> {
  try {
    const transcript = await larkFetchText(
      `/minutes/v1/minutes/${minuteToken}/transcript`,
      accessToken,
      {
        file_format: 'txt',
        need_speaker: 'true',
        need_timestamp: 'true',
      }
    );
    const normalized = transcript.trim();
    return normalized.length > MAX_TRANSCRIPT_LENGTH
      ? normalized.slice(0, MAX_TRANSCRIPT_LENGTH) + '...（已截断）'
      : normalized;
  } catch (error) {
    if (error instanceof LarkAuthExpiredError) {
      throw error;
    }
    return undefined;
  }
}

async function fetchMeetingNotes(
  meeting: MeetingRecord,
  accessToken: string
): Promise<LarkMinutes | null> {
  try {
    const noteData = await larkFetch<{ notes?: Array<{ note_doc_token?: string }> }>(
      `/vc/v1/meetings/${meeting.meeting_id}/note`,
      accessToken
    );

    if (!noteData.notes?.length) return null;

    const noteDocToken = noteData.notes[0].note_doc_token;
    if (!noteDocToken) return null;

    const docContent = await fetchDocContent(noteDocToken, accessToken);

    return {
      meetingTitle: meeting.topic || '（无标题会议）',
      summary: docContent.summary,
      todos: docContent.todos,
      duration: meeting.end_time && meeting.start_time
        ? (Number(meeting.end_time) - Number(meeting.start_time)) * 1000
        : undefined,
      source: 'vc',
    };
  } catch {
    return null;
  }
}

async function fetchDocContent(
  docToken: string,
  accessToken: string
): Promise<{ summary?: string; todos?: string[] }> {
  try {
    const data = await larkFetch<{ content?: string }>(
      `/docx/v1/documents/${docToken}/raw_content`,
      accessToken
    );

    const content = data.content ?? '';
    const summaryMatch = content.match(/(?:总结|Summary)[：:]\s*([\s\S]*?)(?=(?:待办|Todo|$))/i);
    const todosMatch = content.match(/(?:待办|Todo)[：:]\s*([\s\S]*?)$/i);

    const summary = summaryMatch?.[1]?.trim();
    const todosText = todosMatch?.[1]?.trim();
    const todos = todosText
      ? todosText.split('\n').map((t) => t.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
      : undefined;

    return { summary, todos };
  } catch {
    return {};
  }
}
