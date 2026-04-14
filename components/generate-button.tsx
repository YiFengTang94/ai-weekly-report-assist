'use client';

import { useState } from 'react';

export function GenerateButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/report/generate', { method: 'POST' });
      const data = await res.json();
      setMessage(res.ok ? '周报生成成功！' : data.message ?? '生成失败');
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
    </div>
  );
}
