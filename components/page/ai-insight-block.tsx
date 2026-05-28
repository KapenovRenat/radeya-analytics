import { Sparkles, AlertTriangle, TrendingUp, Lightbulb } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type InsightKind = "observation" | "anomaly" | "trend" | "suggestion";

export type Insight = {
  kind: InsightKind;
  title: string;
  body: ReactNode;
};

const kindMeta: Record<
  InsightKind,
  { icon: typeof Sparkles; color: string; bg: string; label: string }
> = {
  observation: {
    icon: Sparkles,
    color: "text-[var(--accent)]",
    bg: "bg-[var(--accent-soft)]",
    label: "Замечает",
  },
  anomaly: {
    icon: AlertTriangle,
    color: "text-[var(--red)]",
    bg: "bg-[var(--red-soft)]",
    label: "Аномалия",
  },
  trend: {
    icon: TrendingUp,
    color: "text-[var(--blue)]",
    bg: "bg-[var(--blue-soft)]",
    label: "Тренд",
  },
  suggestion: {
    icon: Lightbulb,
    color: "text-[var(--amber)]",
    bg: "bg-[var(--amber-soft)]",
    label: "Идея",
  },
};

/**
 * AI Insight block — 1-5 takeaways from "Claude" for the page.
 *
 * Currently uses MOCK data — that's stamped clearly on the header.
 * When we wire to real LLM, just remove the mock badge and replace `insights` source.
 */
export function AiInsightBlock({
  insights,
  isMock = true,
}: {
  insights: Insight[];
  isMock?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--surface)] to-[var(--surface)] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent)] text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text)]">
            AI-инсайты
          </h3>
          <span className="text-[11px] text-[var(--text-dim)]">
            · что Claude заметил по этой странице
          </span>
        </div>
        {isMock && (
          <span className="mock-badge" title="Это мок-данные. Реальная интеграция с Claude — на следующей итерации.">
            Mock-данные
          </span>
        )}
      </div>

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {insights.map((ins, i) => {
          const m = kindMeta[ins.kind];
          const Icon = m.icon;
          return (
            <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded", m.bg)}>
                <Icon className={cn("h-3 w-3", m.color)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-[10px] uppercase tracking-[0.10em] font-medium", m.color)}>
                    {m.label}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--text)]">
                    {ins.title}
                  </span>
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
                  {ins.body}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
