"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type Granularity = "daily" | "weekly" | "monthly";

const PRESETS = [
  { label: "7д", days: 7 },
  { label: "30д", days: 30 },
  { label: "90д", days: 90 },
  { label: "180д", days: 180 },
  { label: "365д", days: 365 },
];

interface FiltersBarProps {
  storeId: string;
  storeName: string;
  /** Available stores for multi-store selector (optional — if only 1, hidden) */
  stores?: { id: string; name: string }[];
  onSync?: () => void;
  syncing?: boolean;
  syncLabel?: string;
}

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

export function useFilters() {
  const sp = useSearchParams();
  const from = sp.get("from") ?? getDateFromDays(30);
  const to = sp.get("to") ?? getToday();
  const granularity = (sp.get("g") as Granularity | null) ?? autoGranularity(from, to);
  return { from, to, granularity };
}

export function FiltersBar({
  storeId: _storeId,
  storeName,
  stores,
  onSync,
  syncing,
  syncLabel,
}: FiltersBarProps) {
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

  const multiStore = stores && stores.length > 1;

  return (
    <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)]/95 px-4 py-2.5 backdrop-blur-sm md:-mx-6 md:px-6">
      {/* Store name / selector */}
      {multiStore ? (
        <Select
          value={_storeId}
          onChange={(e) => router.push(`/stores/${e.target.value}${pathname.replace(/^\/stores\/[^/]+/, "")}`)}
        >
          {stores!.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      ) : (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-medium text-[var(--text)]">{storeName}</span>
        </div>
      )}

      <div className="h-4 w-px bg-[var(--border)]" />

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
                  g: null, // let auto-detect
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

      {/* Custom date inputs */}
      <div className="hidden items-center gap-1 md:flex">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setParams({ from: e.target.value })}
          className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] tabular hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
        />
        <span className="text-[11px] text-[var(--text-dim)]">—</span>
        <input
          type="date"
          value={to}
          min={from}
          max={getToday()}
          onChange={(e) => setParams({ to: e.target.value })}
          className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] tabular hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
        />
      </div>

      <div className="h-4 w-px bg-[var(--border)]" />

      {/* Granularity */}
      <Select
        value={granularity}
        onChange={(e) => setParams({ g: e.target.value })}
        className="h-7 text-[11px]"
      >
        <option value="daily">По дням</option>
        <option value="weekly">По неделям</option>
        <option value="monthly">По месяцам</option>
      </Select>

      {/* Sync button */}
      {onSync && (
        <div className="ml-auto">
          <Button variant="secondary" size="sm" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncLabel ?? "Синхронизировать"}
          </Button>
        </div>
      )}
    </div>
  );
}
