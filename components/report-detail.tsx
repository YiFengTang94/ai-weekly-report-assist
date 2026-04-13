import ReactMarkdown from 'react-markdown';
import type { WeeklyReport } from '@/lib/types';

interface ReportDetailProps {
  report: WeeklyReport;
}

export function ReportDetail({ report }: ReportDetailProps) {
  return (
    <article className="prose prose-headings:mt-6 prose-headings:mb-4 prose-p:my-3 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg max-w-none dark:prose-invert">
      <ReactMarkdown>{report.content}</ReactMarkdown>
    </article>
  );
}
