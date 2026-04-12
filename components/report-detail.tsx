import ReactMarkdown from 'react-markdown';
import type { WeeklyReport } from '@/lib/types';

interface ReportDetailProps {
  report: WeeklyReport;
}

export function ReportDetail({ report }: ReportDetailProps) {
  return (
    <article className="prose max-w-none">
      <ReactMarkdown>{report.content}</ReactMarkdown>
    </article>
  );
}
