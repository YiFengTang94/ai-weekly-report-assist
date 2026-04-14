'use client';

import { useState } from 'react';

interface ReportWarning {
  source: string;
  message: string;
  reconnectRequired?: boolean;
}

interface ReportSourceStatus {
  source: string;
  label: string;
  status: 'collected' | 'failed' | 'skipped';
  count?: number;
  message: string;
}

export function GenerateButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<ReportWarning[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<ReportSourceStatus[]>([]);

  async function handleGenerate() {
    setLoading(true);
    setMessage('');
    setWarnings([]);
    setSourceStatuses([]);
    try {
      const res = await fetch('/api/report/generate', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const nextWarnings = Array.isArray(data.warnings)
          ? data.warnings
          : data.report?.warnings ?? [];
        const nextSourceStatuses = Array.isArray(data.sourceStatuses)
          ? data.sourceStatuses
          : data.report?.sourceStatuses ?? [];
        setWarnings(nextWarnings);
        setSourceStatuses(nextSourceStatuses);
        setMessage(
          nextWarnings.length
            ? '周报已生成，但部分数据源采集失败'
            : '周报生成成功！'
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
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="primary-action"
      >
        {loading ? '正在生成' : '生成本周周报'}
      </button>
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
