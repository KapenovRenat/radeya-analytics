import { type ReactNode } from "react";
import { Topbar } from "@/components/topbar";

/**
 * Data-journalism page shell.
 *
 * Layout:
 *   [Topbar — sticky · title + subtitle + theme toggle]
 *   [Headline — bold insight, 3-second read]
 *   [KpiStrip   ────────────────  above fold]
 *   [HeroChart  with annotations  ───────────]
 *   [AiInsightBlock — 3 takeaways · MOCK badge]
 *   [Supporting charts grid]
 *   [DrillDown table]
 *   [RecommendationBlock — "Что делать"]
 */
export function PageShell({
  title,
  subtitle,
  headline,
  children,
}: {
  title: string;
  subtitle?: string;
  headline?: string;
  children: ReactNode;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className="mx-auto w-full max-w-6xl px-6 py-6">
        {headline && (
          <p className="mb-6 text-[15px] leading-relaxed text-[var(--text-dim)]">
            <span className="font-medium text-[var(--text)]">{headline}</span>
          </p>
        )}
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    </>
  );
}

/**
 * Section block — title + optional info icon + children.
 * Used to group related content with consistent typography.
 */
export function Section({
  title,
  hint,
  action,
  children,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold tracking-tight text-[var(--text)]">
                {title}
              </h2>
            )}
            {hint && (
              <p className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{hint}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
