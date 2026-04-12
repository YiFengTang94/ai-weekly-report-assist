import Link from 'next/link';
import { ReportDetail } from '@/components/report-detail';
import type { WeeklyReport } from '@/lib/types';

async function getReport(id: string): Promise<WeeklyReport | null> {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/report/${id}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.report ?? null;
  } catch {
    return null;
  }
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);

  return (
    <main className="container mx-auto p-8">
      <Link
        href="/reports"
        className="text-blue-600 hover:underline mb-4 inline-block"
      >
        ← 返回列表
      </Link>

      {report ? (
        <ReportDetail report={report} />
      ) : (
        <p className="text-gray-500">周报 {id} 不存在</p>
      )}
    </main>
  );
}
