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
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '生成中...' : '生成本周周报'}
      </button>
      {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
