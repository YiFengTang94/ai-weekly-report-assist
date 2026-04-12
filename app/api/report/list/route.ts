import { NextResponse } from 'next/server';
import { listReports } from '@/lib/publishers/file-reader';

export async function GET() {
  try {
    const reports = await listReports();
    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ reports: [] });
  }
}
