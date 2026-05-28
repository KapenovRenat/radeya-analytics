"use client";

/**
 * AdFilterBar — date-range filter for the Advertising section.
 *
 * Controlled component (no URL side-effects): parent manages state.
 * Props:
 *   from / to          — YYYY-MM-DD strings
 *   onChange(f, t)     — called when either date changes
 *   granularity?       — "daily" | "weekly" | "monthly" (show only if provided)
 *   onGranularity?(g)  — granularity change handler
 *   extra?             — slot for additional filters (e.g. campaign select)
 */

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export type Granularity = "daily" | "weekly" | "monthly";

const PRESETS = [
  { label: "7д",  days: 7 },
  { label: "30д", days: 30 },
  { label: "90д", days: 90 },
  { label: "180д", days: 180 },
  { label: "365д", days: 365 },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  granularity?: Granularity;
  onGranularity?: (g: Granularity) => void;
  /** Extra controls rendered after the separator (e.g. campaign select) */
  extra?: React.ReactNode;
}

export function AdFilterBar({ from, to, onChange, granularity, onGranularity, extra }: Props) {
  // Which preset (if any) matches the current range?
  const activePreset = useMemo(() => {
    const days = Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000,
    );
    return PRESETS.find((p) => p.days === days)?.days ?? null;
  }, [from, to]);

  const today = todayIso();

  return (
    <div className="sticky top-14 z-10 -mx-6 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-6 py-2.5 backdrop-blur-sm">
      {/* Calendar icon + preset chips */}
      <div className="flex items-center">
        <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />
        <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() => onChange(daysAgoIso(p.days), today)}
              className={cn(
                "h-6 rounded-[5px] px-2 text-[11px] font-medium tabular-nums transition-colors",
                activePreset === p.days
                  ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-strong)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => onChange(e.target.value, to)}
          className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] tabular-nums hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
        />
        <span className="text-[11px] text-[var(--text-dim)]">—</span>
        <input
          type="date"
          value={to}
          min={from}
          max={today}
          onChange={(e) => onChange(from, e.target.value)}
          className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] tabular-nums hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
        />
      </div>

      {/* Granularity (optional) */}
      {granularity && onGranularity && (
        <>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-0.5">
            {(["daily", "weekly", "monthly"] as const).map((g) => (
              <button
                key={g}
                onClick={() => onGranularity(g)}
                className={cn(
                  "h-6 rounded-[5px] px-2 text-[11px] font-medium transition-colors",
                  granularity === g
                    ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-strong)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text)]",
                )}
              >
                {g === "daily" ? "День" : g === "weekly" ? "Неделя" : "Месяц"}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Extra slot */}
      {extra && (
        <>
          <div className="h-4 w-px bg-[var(--border)]" />
          {extra}
        </>
      )}
    </div>
  );
}
