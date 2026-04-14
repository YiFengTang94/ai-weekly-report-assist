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
    <main className="workbench-shell">
      <Link
        href="/reports"
        className="text-link"
      >
        返回列表
      </Link>

      {report ? (
        <ReportDetail report={report} />
      ) : (
        <p className="empty-state">周报 {id} 不存在</p>
      )}
    </main>
  );
}
