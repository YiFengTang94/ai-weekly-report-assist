import Link from 'next/link';
import { ReportCard } from '@/components/report-card';
import { listReports } from '@/lib/publishers/file-reader';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const reports = await listReports();

  return (
    <main className="workbench-shell">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ARCHIVE.NODE</p>
          <h1 className="cyber-glitch" data-text="历史周报">
            历史周报
          </h1>
        </div>
        <Link href="/" className="text-link">
          返回首页
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="empty-state">暂无周报记录，请先生成周报。</p>
      ) : (
        <div className="report-list">
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
