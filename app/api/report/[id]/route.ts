import { NextResponse } from 'next/server';
import { getReportById } from '@/lib/publishers/file-reader';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) {
    return NextResponse.json({ id, content: null }, { status: 404 });
  }
  return NextResponse.json({ report });
}
