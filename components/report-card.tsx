import type { WeeklyReport } from '@/lib/types';

interface ReportCardProps {
  report: WeeklyReport;
}

export function ReportCard({ report }: ReportCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <h2 className="font-semibold text-lg">
        {report.weekStart} ~ {report.weekEnd}
      </h2>
      <p className="text-sm text-gray-500 mt-1">{report.createdAt}</p>
    </div>
  );
}
