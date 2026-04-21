import { GenerateButton } from '@/components/generate-button';
import { HistoryGenerateSection } from '@/components/history-generate-section';
import { AuthButton } from '@/components/auth-button';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="workbench-shell">
      <header className="topbar">
        <div className="brand-block">
          <p>SPRAWL.FEED // WEEKLY_AI</p>
          <h1 className="cyber-glitch" data-text="AI 周报助手">
            AI 周报助手
          </h1>
        </div>
        <AuthButton />
      </header>

      <section className="dashboard-grid" aria-label="周报工作台">
        <div className="command-panel">
          <p className="eyebrow">UTC+8 / Monday to Friday</p>
          <h2 className="cyber-glitch" data-text="采集 GitHub 活动，生成这一周的中文周报。">
            采集 GitHub 活动，生成这一周的中文周报。
          </h2>
          <p>
            统计窗口固定为北京时间周一 00:00 到周五 23:59，减少跨时区遗漏
          </p>
          <GenerateButton />
        </div>

        <div className="command-panel">
          <p className="eyebrow">Backfill / History</p>
          <h2 className="cyber-glitch" data-text="回溯生成历史周报">
            回溯生成历史周报
          </h2>
          <p>选择过去任意一周，重新采集并生成对应周报</p>
          <HistoryGenerateSection />
        </div>

        <aside className="signal-board" aria-label="采集范围">
          <div>
            <span>01</span>
            <strong>GitHub commits</strong>
            <p>按北京时间工作周二次过滤</p>
          </div>
          <div>
            <span>02</span>
            <strong>Lark calendar</strong>
            <p>同步会议和日程线索</p>
          </div>
          <div>
            <span>03</span>
            <strong>AI summary</strong>
            <p>输出结构化中文周报</p>
          </div>
        </aside>
      </section>

      <section className="archive-strip">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>最近周报</h2>
        </div>
        <Link href="/reports" className="text-link">
          查看全部历史周报
        </Link>
      </section>
    </main>
  );
}
