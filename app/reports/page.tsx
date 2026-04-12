import Link from 'next/link';
import { ReportCard } from '@/components/report-card';
import type { WeeklyReport } from '@/lib/types';

async function getReports(): Promise<WeeklyReport[]> {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/report/list`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return data.reports ?? [];
  } catch {
    return [];
  }
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <main className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">历史周报</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          ← 返回首页
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-gray-500">暂无周报记录，请先生成周报</p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <ReportCard report={report} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
