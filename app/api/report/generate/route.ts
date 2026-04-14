import { NextResponse } from 'next/server';
import { resolveGitHubToken } from '@/lib/github-token';
import { resolveLarkToken } from '@/lib/lark-token';
import { generateWeeklyReport } from '@/lib/services/report-service';

export async function POST() {
  try {
    const { token, username } = await resolveGitHubToken();
    const larkToken = await resolveLarkToken();
    const report = await generateWeeklyReport(token, username, larkToken);
    return NextResponse.json({ report });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '周报生成失败';
    return NextResponse.json({ message }, { status: 500 });
  }
}
