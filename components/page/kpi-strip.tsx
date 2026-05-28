import { type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "success" | "warning" | "danger" | "info";

export type KpiDelta = {
  value: number; // percentage
  /** Inverse: green when negative (e.g. cancellation rate going down is good). */
  inverse?: boolean;
};

export type KpiItem = {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: KpiDelta;
  tone?: KpiTone;
};

const toneStyles: Record<KpiTone, { ring: string; bar: string; text: string }> = {
  default: {
    ring: "border-[var(--border)]",
    bar: "",
    text: "text-[var(--text)]",
  },
  success: {
    ring: "border-[var(--emerald)]/30",
    bar: "before:bg-[var(--emerald)]",
    text: "text-[var(--text)]",
  },
  warning: {
    ring: "border-[var(--amber)]/30",
    bar: "before:bg-[var(--amber)]",
    text: "text-[var(--text)]",
  },
  danger: {
    ring: "border-[var(--red)]/30",
    bar: "before:bg-[var(--red)]",
    text: "text-[var(--text)]",
  },
  info: {
    ring: "border-[var(--blue)]/30",
    bar: "before:bg-[var(--blue)]",
    text: "text-[var(--text)]",
  },
};

function DeltaBadge({ delta }: { delta: KpiDelta }) {
  const abs = Math.abs(delta.value);
  const positive = delta.value > 0;
  const stable = abs < 0.5;
  // direction "good" depends on inverse flag (e.g. cancel rate)
  const good = stable ? null : delta.inverse ? !positive : positive;

  let color: string;
  let Icon: typeof ArrowUp;
  if (stable) {
    color = "text-[var(--text-subtle)]";
    Icon = ArrowRight;
  } else if (good) {
    color = "text-[var(--emerald)]";
    Icon = positive ? ArrowUp : ArrowDown;
  } else {
    color = "text-[var(--red)]";
    Icon = positive ? ArrowUp : ArrowDown;
  }

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-[11px] font-medium",
        color
      )}
    >
      <Icon className="h-3 w-3" />
      {abs.toFixed(1)}%
    </span>
  );
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        items.length <= 3 && "grid-cols-1 sm:grid-cols-3",
        items.length === 4 && "grid-cols-2 lg:grid-cols-4",
        items.length === 5 && "grid-cols-2 lg:grid-cols-5",
        items.length >= 6 && "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      )}
    >
      {items.map((kpi, i) => {
        const t = toneStyles[kpi.tone ?? "default"];
        return (
          <div
            key={i}
            className={cn(
              "relative overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 transition-colors",
              t.ring,
              "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px]",
              t.bar
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-subtle)]">
                  {kpi.label}
                </div>
                <div className={cn("mt-1 text-[22px] font-semibold tabular leading-tight", t.text)}>
                  {kpi.value}
                </div>
                {kpi.hint && (
                  <div className="mt-1 text-[11px] text-[var(--text-dim)]">
                    {kpi.hint}
                  </div>
                )}
              </div>
              {kpi.delta && <DeltaBadge delta={kpi.delta} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
