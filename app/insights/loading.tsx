import { Sparkles } from "lucide-react";
import { PageShell } from "@/components/page/page-shell";

/**
 * Server-rendered skeleton shown by Next.js while the real /insights page
 * (which makes a synchronous Claude Opus 4.7 call, ~20-25s on a cold cache)
 * is streaming in. Without this, navigation looks frozen after the click.
 */
export default function InsightsLoading() {
  return (
    <PageShell
      title="AI-инсайты"
      subtitle="Claude Opus 4.7 читает ваши данные…"
      headline="Анализ KPI, сезонности, концентрационных рисков и каналов оплаты — занимает 20-30 секунд на первый запрос."
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
          />
        ))}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--surface)] to-[var(--surface)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent)] text-white">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          </div>
          <span className="text-[13px] font-semibold text-[var(--text)]">AI-инсайты</span>
          <span className="text-[11px] text-[var(--text-dim)]">· думает…</span>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-full animate-pulse rounded bg-white/[0.04]" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
