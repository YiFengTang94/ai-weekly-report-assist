import Link from 'next/link';
import { ReportDetail } from '@/components/report-detail';
import { getReportById } from '@/lib/publishers/file-reader';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReportById(id);

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
