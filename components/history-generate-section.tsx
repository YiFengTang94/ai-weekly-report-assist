'use client';

import { useState, useMemo } from 'react';
import { formatWeekLabel, getPastMondays } from '@/lib/date-utils';

interface ReportSourceStatus {
  source: string;
  label: string;
  status: 'collected' | 'failed' | 'skipped';
  count?: number;
  message: string;
}

interface ReportWarning {
  source: string;
  message: string;
  reconnectRequired?: boolean;
}

export function HistoryGenerateSection() {
  const mondays = useMemo(() => getPastMondays(12), []);
  const [selected, setSelected] = useState(mondays[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sourceStatuses, setSourceStatuses] = useState<ReportSourceStatus[]>([]);
  const [warnings, setWarnings] = useState<ReportWarning[]>([]);

  async function handleGenerate() {
    setLoading(true);
    setMessage('');
    setSourceStatuses([]);
    setWarnings([]);
    try {
      const res = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: selected }),
      });
      const data = await res.json();
      if (res.ok) {
        const nextWarnings: ReportWarning[] = Array.isArray(data.warnings)
          ? data.warnings
          : (data.report?.warnings ?? []);
        const nextStatuses: ReportSourceStatus[] = Array.isArray(data.sourceStatuses)
          ? data.sourceStatuses
          : (data.report?.sourceStatuses ?? []);
        setWarnings(nextWarnings);
        setSourceStatuses(nextStatuses);
        setMessage(
          nextWarnings.length
            ? `${selected} 周报已生成，部分数据源采集失败`
            : `${selected} 周报生成成功！`
        );
      } else {
        setMessage(data.message ?? '生成失败');
      }
    } catch {
      setMessage('生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="generate-control">
      <div className="history-picker">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loading}
          className="week-select"
          aria-label="选择历史周"
        >
          {mondays.map((monday) => (
            <option key={monday} value={monday}>
              {formatWeekLabel(monday)}
            </option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="primary-action"
        >
          {loading ? '正在生成' : '生成历史周报'}
        </button>
      </div>
      {message && <p className="status-note">{message}</p>}
      {sourceStatuses.length > 0 && (
        <div className="source-status-list" role="status">
          {sourceStatuses.map((status) => (
            <p
              className={
                status.status === 'collected'
                  ? 'source-status-ok'
                  : 'source-status-warning'
              }
              key={status.source}
            >
              {status.status === 'collected'
                ? `${status.label} ✓ 已采集 ${status.count ?? 0} 条`
                : status.message}
            </p>
          ))}
          {warnings.map((warning) => (
            <p
              className="source-status-warning"
              key={`${warning.source}-${warning.message}`}
            >
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
