"use client";

import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";

type ValueFormatter = "money" | "money-compact" | "number" | "percent";

type TooltipPayloadItem = {
  readonly color?: string;
  readonly fill?: string;
  readonly value?: unknown;
  readonly name?: unknown;
  readonly dataKey?: unknown;
  readonly payload?: unknown;
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipPayloadItem>;
  label?: unknown;
  valueFormatter?: ValueFormatter;
  /** Secondary metric shown to the right of the primary value — e.g. "% от всего" */
  secondaryKey?: string;
  secondaryFormatter?: ValueFormatter;
  /** Optional per-item extra text (shown below) */
  extraLines?: (payload: Record<string, unknown>) => string[];
}

/**
 * Vercel-style tooltip — minimal, high-contrast, tabular.
 *
 * Designed to answer: WHAT is highlighted, HOW MUCH, and in CONTEXT (share / relative).
 * Never a bare number without label.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = "money",
  secondaryKey,
  secondaryFormatter,
  extraLines,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const fmt = (v: unknown, which: ValueFormatter = valueFormatter) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return "—";
    if (which === "money") return formatMoney(n);
    if (which === "money-compact") return formatCompactMoney(n);
    if (which === "percent") return formatPercent(n);
    return formatNumber(n);
  };

  const toText = (v: unknown): string =>
    v == null ? "" : typeof v === "string" || typeof v === "number" ? String(v) : "";

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-elev)]/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm min-w-[180px]">
      {label != null && label !== "" && (
        <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
          {toText(label)}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => {
          const rec = (p.payload as Record<string, unknown> | undefined) ?? {};
          const extras = extraLines?.(rec) ?? [];
          const secondary =
            secondaryKey && rec[secondaryKey] != null
              ? fmt(rec[secondaryKey], secondaryFormatter ?? "number")
              : null;
          return (
            <div key={i}>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[var(--text-dim)]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: (p.color || p.fill) as string }}
                  />
                  {toText(p.name ?? p.dataKey)}
                </span>
                <span className="font-medium tabular text-[var(--text)]">{fmt(p.value)}</span>
              </div>
              {secondary && (
                <div className="pl-3.5 text-[10px] text-[var(--text-subtle)] tabular">
                  {secondary}
                </div>
              )}
              {extras.map((line, j) => (
                <div key={j} className="pl-3.5 text-[10px] text-[var(--text-subtle)]">
                  {line}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const axisTickStyle = {
  fontSize: 10,
  fill: "var(--text-dim)",
};
