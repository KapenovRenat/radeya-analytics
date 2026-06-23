"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-picker";

export type Granularity = "daily" | "weekly" | "monthly";

const PRESETS = [
  { label: "7д", days: 7 },
  { label: "30д", days: 30 },
  { label: "90д", days: 90 },
  { label: "180д", days: 180 },
  { label: "365д", days: 365 },
];

function getDateFromDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function autoGranularity(fromIso: string, toIso: string): Granularity {
  const days = Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000,
  );
  if (days <= 31) return "daily";
  if (days <= 180) return "weekly";
  return "monthly";
}

/**
 * Reads canonical filter state from URL searchParams.
 * Shape: ?from=YYYY-MM-DD&to=YYYY-MM-DD&g=daily|weekly|monthly
 * Used by hooks (use-analytics) and by FilterBar itself.
 */
export function useFilters() {
  const sp = useSearchParams();
  const from = sp.get("from") ?? getDateFromDays(30);
  const to = sp.get("to") ?? getToday();
  const granularity = (sp.get("g") as Granularity | null) ?? autoGranularity(from, to);
  return { from, to, granularity };
}

/**
 * Sticky filter bar for the new page template.
 *
 * Owns the canonical ?from=&to=&g= search params:
 *   - Five preset chips (7/30/90/180/365 days)
 *   - Native date inputs for custom range
 *   - Granularity select (daily / weekly / monthly)
 *
 * Sync controls live elsewhere (per-store Settings tab) to keep this bar
 * page-agnostic.
 */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { from, to, granularity } = useFilters();

  const activeDays = useMemo(() => {
    const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
    return PRESETS.find((p) => p.days === days)?.days ?? null;
  }, [from, to]);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, sp],
  );

  return (
    <div className="sticky top-14 z-10 -mx-6 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/95 px-6 py-2.5 backdrop-blur-sm">
      {/* Date presets */}
      <div className="flex items-center">
        <Calendar className="mr-2 h-3.5 w-3.5 text-[var(--text-dim)]" />
        <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              onClick={() =>
                setParams({
                  from: getDateFromDays(p.days),
                  to: getToday(),
                  g: null, // let auto-detect pick the right bucket
                })
              }
              className={cn(
                "h-6 rounded-[5px] px-2 text-[11px] font-medium transition-colors tabular",
                activeDays === p.days
                  ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-strong)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      <div className="hidden md:block">
        <DateRangePicker
          from={from}
          to={to}
          max={getToday()}
          onChange={(f, t) => setParams({ from: f, to: t, g: null })}
        />
      </div>

      <div className="hidden h-4 w-px bg-[var(--border)] md:block" />

      {/* Granularity */}
      <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-0.5">
        {(["daily", "weekly", "monthly"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setParams({ g })}
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
    </div>
  );
}
