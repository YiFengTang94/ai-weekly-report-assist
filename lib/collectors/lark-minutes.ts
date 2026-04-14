// lib/collectors/lark-minutes.ts
import { larkFetch } from '@/lib/lark/client';
import type { LarkMinutes } from '@/lib/types';

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

export async function collectLarkMinutes(
  weekStart: string,
  weekEnd: string,
  accessToken: string
): Promise<LarkMinutes[]> {
  const startTs = Math.floor(new Date(`${weekStart}T00:00:00+08:00`).getTime() / 1000).toString();
  const endTs = Math.floor(new Date(`${weekEnd}T23:59:59+08:00`).getTime() / 1000).toString();

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
        });
      }
    } catch {
      results.push({
        meetingTitle: meeting.topic || '（无标题会议）',
      });
    }
  }

  return results;
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
