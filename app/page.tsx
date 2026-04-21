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
        <div className="command-panel command-panel-hub">
          <div className="command-panel-main">
            <p className="eyebrow">UTC+8 / Monday to Friday</p>
            <p className="command-panel-copy">
              统计窗口固定为北京时间周一 00:00 到周五 23:59
            </p>
            <div className="command-panel-actions">
              <GenerateButton />
            </div>
          </div>

          <aside className="signal-board signal-board-embedded" aria-label="采集范围">
            <article className="signal-board-card">
              <span>01</span>
              <strong>GitHub commits</strong>
              <p>同步 GitHub 代码改动</p>
            </article>
            <article className="signal-board-card">
              <span>02</span>
              <strong>Lark calendar</strong>
              <p>同步会议、日程和文档</p>
            </article>
            <article className="signal-board-card">
              <span>03</span>
              <strong>AI summary</strong>
              <p>输出结构化中文周报</p>
            </article>
          </aside>
        </div>

        <div className="command-panel command-panel-history">
          <p className="eyebrow">Backfill / History</p>
          <h2
            className="cyber-glitch command-panel-history-title"
            data-text="回溯周报"
          >
            回溯周报
          </h2>
          <p>选择过去任意一周，重新采集并生成对应周报</p>
          <HistoryGenerateSection />
        </div>
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
