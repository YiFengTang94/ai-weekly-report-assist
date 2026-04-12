import { GenerateButton } from '@/components/generate-button';
import { AuthButton } from '@/components/auth-button';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="container mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI 周报助手</h1>
          <p className="text-gray-500">
            自动采集 GitHub 数据，AI 生成中文周报
          </p>
        </div>
        <AuthButton />
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">手动生成</h2>
        <GenerateButton />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">最近周报</h2>
        <Link href="/reports" className="text-blue-600 hover:underline">
          查看全部历史周报 →
        </Link>
      </section>
    </main>
  );
}
