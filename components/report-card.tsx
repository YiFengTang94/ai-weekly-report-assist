import type { WeeklyReport } from '@/lib/types';

interface ReportCardProps {
  report: WeeklyReport;
}

export function ReportCard({ report }: ReportCardProps) {
  return (
    <div className="report-card">
      <p className="report-card-label">周报归档</p>
      <h2>
        {report.weekStart} ~ {report.weekEnd}
      </h2>
      <p>{report.createdAt}</p>
    </div>
  );
}
