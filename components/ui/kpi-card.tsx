import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  deltaPct?: number | null;
  /** Reverse color for metrics where lower is better (cancellation rate, returns) */
  lowerIsBetter?: boolean;
  tone?: "default" | "emerald" | "red" | "orange" | "amber";
  loading?: boolean;
  icon?: ReactNode;
}

function deltaColor(pct: number, lowerIsBetter: boolean): "emerald" | "red" | "dim" {
  if (Math.abs(pct) < 2) return "dim";
  const growing = pct > 0;
  const good = lowerIsBetter ? !growing : growing;
  return good ? "emerald" : "red";
}

export function KpiCard({
  label,
  value,
  hint,
  deltaPct,
  lowerIsBetter = false,
  tone = "default",
  loading,
  icon,
}: KpiCardProps) {
  const deltaTone = deltaPct != null ? deltaColor(deltaPct, lowerIsBetter) : null;
  const Arrow =
    deltaTone === "emerald" ? TrendingUp : deltaTone === "red" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "group relative rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)]",
        tone === "red" && "border-[var(--red)]/25",
        tone === "emerald" && "border-[var(--emerald)]/25",
        tone === "orange" && "border-[var(--orange)]/25",
        tone === "amber" && "border-[var(--amber)]/25",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-[var(--text-dim)] [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
            {label}
          </div>
        </div>
        {deltaPct != null && !loading && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular",
              deltaTone === "emerald" && "bg-[var(--emerald-soft)] text-[var(--emerald)]",
              deltaTone === "red" && "bg-[var(--red-soft)] text-[var(--red)]",
              deltaTone === "dim" && "bg-white/[0.06] text-[var(--text-dim)]",
            )}
          >
            <Arrow className="h-2.5 w-2.5" strokeWidth={2.5} />
            {Math.abs(deltaPct).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="h-7 w-24 animate-pulse rounded-md bg-white/[0.06]" />
        ) : (
          <div
            className={cn(
              "text-[22px] font-semibold tabular leading-none tracking-tight text-[var(--text)]",
              tone === "red" && "text-[var(--red)]",
              tone === "orange" && "text-[var(--orange)]",
              tone === "emerald" && "text-[var(--emerald)]",
            )}
          >
            {value}
          </div>
        )}
        {hint && !loading && (
          <div className="mt-1.5 text-[11px] text-[var(--text-subtle)]">{hint}</div>
        )}
      </div>
    </div>
  );
}
