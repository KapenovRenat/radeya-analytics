import { ArrowRight, CheckCircle2 } from "lucide-react";
import { type ReactNode } from "react";

export type Recommendation = {
  title: string;
  body: ReactNode;
  action?: { label: string; href?: string };
};

/**
 * "Что делать" — concrete next actions at the bottom of a page.
 * Different from AI-insights (those describe what IS) — these describe what TO DO.
 */
export function RecommendationBlock({
  title = "Что делать",
  items,
}: {
  title?: string;
  items: Recommendation[];
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-[var(--emerald)]" />
        <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text)]">
          {title}
        </h3>
      </div>
      <ol className="flex flex-col gap-3">
        {items.map((rec, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[10px] font-semibold text-[var(--text-dim)] tabular">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[var(--text)]">
                {rec.title}
              </div>
              <div className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
                {rec.body}
              </div>
              {rec.action && (
                <a
                  href={rec.action.href ?? "#"}
                  className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                >
                  {rec.action.label}
                  <ArrowRight className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
