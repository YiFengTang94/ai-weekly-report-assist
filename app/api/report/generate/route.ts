import { NextResponse } from 'next/server';
import { resolveGitHubToken } from '@/lib/github-token';
import { resolveLarkTokenState } from '@/lib/lark-token';
import { parseMondayDate } from '@/lib/date-utils';
import { generateWeeklyReport } from '@/lib/services/report-service';
import type { ReportWarning } from '@/lib/types';

function getLarkWarnings(reason: string | undefined): ReportWarning[] {
  if (reason === 'expired' || reason === 'refresh_failed') {
    return [
      {
        source: 'lark-calendar',
        code: 'lark-token-expired',
        message: '飞书日历采集失败：飞书授权已过期，请重新连接飞书。',
        reconnectRequired: true,
      },
      {
        source: 'lark-minutes',
        code: 'lark-token-expired',
        message: '飞书妙记采集失败：飞书授权已过期，请重新连接飞书。',
        reconnectRequired: true,
      },
      {
        source: 'lark-wiki',
        code: 'lark-token-expired',
        message: '飞书 Wiki 采集失败：飞书授权已过期，请重新连接飞书。',
        reconnectRequired: true,
      },
    ];
  }

  if (reason === 'not_connected') {
    return [
      {
        source: 'lark-calendar',
        code: 'lark-not-connected',
        message: '飞书未连接，已跳过飞书数据采集。',
      },
    ];
  }

  return [];
}

export async function POST(request: Request) {
  try {
    let targetDate: Date | undefined;
    let body: { weekStart?: string } | null = null;
    try {
      body = await request.json();
    } catch {
      // no body — current week
    }
    if (body?.weekStart) {
      try {
        targetDate = parseMondayDate(body.weekStart);
      } catch (e) {
        return NextResponse.json(
          { message: e instanceof Error ? e.message : '日期参数无效' },
          { status: 400 }
        );
      }
    }

    const { token, username } = await resolveGitHubToken();
    const larkTokenState = await resolveLarkTokenState();
    const larkWarnings = getLarkWarnings(larkTokenState.reason);
    const report = await generateWeeklyReport(
      token,
      username,
      larkTokenState.token,
      larkWarnings,
      targetDate
    );
    return NextResponse.json({
      report,
      warnings: report.warnings ?? [],
      sourceStatuses: report.sourceStatuses ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '周报生成失败';
    return NextResponse.json({ message }, { status: 500 });
  }
}
