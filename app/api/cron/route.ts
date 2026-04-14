import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport } from '@/lib/services/report-service';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Cron uses env PAT directly (no session)
    const token = process.env.GITHUB_TOKEN ?? '';
    const username = process.env.GITHUB_USERNAME ?? '';
    if (!token) {
      return NextResponse.json(
        { error: '未配置 GITHUB_TOKEN' },
        { status: 500 }
      );
    }

    const larkToken = process.env.LARK_USER_ACCESS_TOKEN || null;
    const report = await generateWeeklyReport(token, username, larkToken);
    return NextResponse.json({ report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '周报生成失败';
    return NextResponse.json({ message }, { status: 500 });
  }
}
