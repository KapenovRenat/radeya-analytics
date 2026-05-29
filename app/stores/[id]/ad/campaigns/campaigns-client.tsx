"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, RefreshCw, ChevronDown, Search, X,
  ArrowUpDown, GitCompareArrows,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeekSelector, fmtWeekLabel, type WeekOption } from "@/components/ad/week-selector";
import {
  LineChart, Line, ResponsiveContainer, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekStat {
  id: string;
  weekStart: string;
  weekEnd: string;
  isMonthlyTotal: boolean;
  impressions: number;
  spent: number;
  dailyBudget: number;
  targetClick: number;
  avgClick: number;
  orders: number;
  revenue: number;
  drrPct: number;
  ctrPct: number;
  convCartPct: number;
  convFavPct: number;
  rating: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;        // "on" | "off"
  improveCard: string;   // "yes" | "no" | "maybe"
  hasReviews: boolean;
  hasDiscount: boolean;
  inStock: boolean;
  hasVideo: boolean;
  weeks: WeekStat[];
}

interface Period {
  weekStart: string;
  weekEnd: string;
  isMonthlyTotal: boolean;
}

type SortKey = "" | "spent" | "impressions" | "orders" | "ctrPct" | "drrPct" | "dailyBudget" | "convCartPct";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return n.toLocaleString("ru-RU");
}
function fmtPct(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return n.toFixed(2) + "%";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

function RatingBadge({ rating }: { rating: string }) {
  if (rating === "good") return <span className="text-[11px] font-medium text-[var(--emerald)]">● Хорошо</span>;
  if (rating === "normal") return <span className="text-[11px] font-medium text-[var(--amber)]">● Норм.</span>;
  if (rating === "bad") return <span className="text-[11px] font-medium text-[var(--red)]">● Плохо</span>;
  return <span className="text-[11px] text-[var(--text-subtle)]">— Нет данных</span>;
}

// ─── Inline Dropdown ──────────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string; color?: string; }

function InlineDropdown({ value, options, onSave }: {
  value: string; options: DropdownOption[]; onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-white/10",
          current?.color ?? "text-[var(--text-dim)]",
        )}
      >
        {current?.label ?? value}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[110px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onSave(o.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-[12px] hover:bg-white/[0.06]",
                o.value === value ? "font-medium" : "",
                o.color ?? "text-[var(--text)]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "on",  label: "● Вкл",  color: "text-[var(--emerald)]" },
  { value: "off", label: "○ Выкл", color: "text-[var(--text-dim)]" },
];
const IMPROVE_OPTIONS: DropdownOption[] = [
  { value: "yes",   label: "Да",       color: "text-[var(--emerald)]" },
  { value: "maybe", label: "Возможно", color: "text-[var(--amber)]" },
  { value: "no",    label: "Нет",      color: "text-[var(--text-dim)]" },
];
const BOOL_OPTIONS: DropdownOption[] = [
  { value: "true",  label: "Да",  color: "text-[var(--emerald)]" },
  { value: "false", label: "Нет", color: "text-[var(--text-dim)]" },
];

// ─── Editable number ──────────────────────────────────────────────────────────

function EditableNum({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 rounded border border-[var(--accent)] bg-[var(--surface-elev)] px-1.5 py-0.5 text-right text-[12px] tabular-nums outline-none"
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(String(value || "")); setEditing(true); }}
      className="cursor-text rounded px-1 py-0.5 tabular-nums hover:bg-white/10"
      title="Кликни чтобы изменить"
    >
      {value ? fmt(value) : <span className="text-[var(--text-subtle)]">—</span>}
    </span>
  );
}

// ─── Comparison Modal ─────────────────────────────────────────────────────────

type WeekTotal = {
  weekStart: string; weekEnd: string;
  spent: number; impressions: number; orders: number;
  drrPct: number; ctrPct: number; convCartPct: number; convFavPct: number; avgClick: number;
};

interface CompareMetric {
  key: keyof WeekTotal;
  label: string;
  fmt: (v: number) => string;
  higherIsBetter: boolean;
}

const COMPARE_METRICS: CompareMetric[] = [
  { key: "spent",       label: "Расход",          fmt: (v) => v.toLocaleString("ru-RU") + " тг", higherIsBetter: false },
  { key: "impressions", label: "Показы",           fmt: (v) => v.toLocaleString("ru-RU"),          higherIsBetter: true  },
  { key: "orders",      label: "Заказы",           fmt: (v) => String(v),                          higherIsBetter: true  },
  { key: "drrPct",      label: "ДРР%",             fmt: (v) => v.toFixed(1) + "%",                 higherIsBetter: false },
  { key: "ctrPct",      label: "CTR%",             fmt: (v) => v.toFixed(2) + "%",                 higherIsBetter: true  },
  { key: "convCartPct", label: "Конв→корзину%",    fmt: (v) => v.toFixed(2) + "%",                 higherIsBetter: true  },
  { key: "convFavPct",  label: "Конв→избранное%",  fmt: (v) => v.toFixed(2) + "%",                 higherIsBetter: true  },
  { key: "avgClick",    label: "Ср. клик",         fmt: (v) => v.toFixed(0) + " тг",              higherIsBetter: false },
];

function CompareModal({
  campaigns,
  periods,
  onClose,
}: {
  campaigns: Campaign[];
  periods: Period[];
  onClose: () => void;
}) {
  // Aggregate totals per week across all campaigns
  const weekPeriods = periods.filter((p) => !p.isMonthlyTotal);

  const totals: WeekTotal[] = weekPeriods.map((p) => {
    let spent = 0, impressions = 0, orders = 0, drrSum = 0, ctrSum = 0, convCartSum = 0, convFavSum = 0, avgClickSum = 0, count = 0;
    for (const c of campaigns) {
      const s = c.weeks.find((w) => w.weekStart === p.weekStart && !w.isMonthlyTotal);
      if (s) {
        spent += s.spent ?? 0;
        impressions += s.impressions ?? 0;
        orders += s.orders ?? 0;
        drrSum += s.drrPct ?? 0;
        ctrSum += s.ctrPct ?? 0;
        convCartSum += s.convCartPct ?? 0;
        convFavSum += s.convFavPct ?? 0;
        avgClickSum += s.avgClick ?? 0;
        count++;
      }
    }
    const avg = (v: number) => (count > 0 ? v / count : 0);
    return {
      weekStart: p.weekStart,
      weekEnd: p.weekEnd,
      spent,
      impressions,
      orders,
      drrPct: avg(drrSum),
      ctrPct: avg(ctrSum),
      convCartPct: avg(convCartSum),
      convFavPct: avg(convFavSum),
      avgClick: avg(avgClickSum),
    };
  });

  const delta = (metric: keyof typeof totals[0], first: number, last: number) => {
    const diff = last - first;
    if (diff === 0) return null;
    return { diff, pct: first !== 0 ? (diff / first) * 100 : 0 };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-[900px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Сравнение недель</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">
              Суммарные показатели по {campaigns.length} кампаниям
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-[var(--text-dim)] hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] min-w-[120px]">
                  Метрика
                </th>
                {weekPeriods.map((p) => (
                  <th key={p.weekStart} className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)] whitespace-nowrap">
                    {fmtDate(p.weekStart)} — {fmtDate(p.weekEnd)}
                  </th>
                ))}
                {weekPeriods.length >= 2 && (
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--accent)] whitespace-nowrap">
                    Δ нед 1→{weekPeriods.length}
                  </th>
                )}
                <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)]">
                  Тренд
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map((metric) => {
                const values = totals.map((t) => (t[metric.key] as number) ?? 0);
                const first = values[0] ?? 0;
                const last = values[values.length - 1] ?? 0;
                const d = weekPeriods.length >= 2 ? delta(metric.key, first, last) : null;
                const isPositive = d && (metric.higherIsBetter ? d.diff > 0 : d.diff < 0);
                const isNegative = d && (metric.higherIsBetter ? d.diff < 0 : d.diff > 0);

                const sparkData = values.map((v, i) => ({ i, v }));

                return (
                  <tr key={metric.key} className="border-b border-[var(--border)]/40 hover:bg-white/[0.02]">
                    <td className="py-2 pr-4 font-medium text-[var(--text)]">{metric.label}</td>
                    {values.map((v, vi) => (
                      <td key={vi} className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
                        {metric.fmt(v)}
                      </td>
                    ))}
                    {weekPeriods.length >= 2 && (
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap",
                        isPositive ? "text-[var(--emerald)]" : isNegative ? "text-[var(--red)]" : "text-[var(--text-dim)]")}>
                        {d
                          ? `${d.diff > 0 ? "+" : ""}${metric.fmt(d.diff)} (${d.pct > 0 ? "+" : ""}${d.pct.toFixed(1)}%)`
                          : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {values.length >= 2 && (
                        <ResponsiveContainer width={80} height={24}>
                          <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                            <Line
                              type="monotone"
                              dataKey="v"
                              dot={false}
                              strokeWidth={1.5}
                              stroke={isPositive ? "var(--emerald)" : isNegative ? "var(--red)" : "var(--text-dim)"}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="rounded border border-[var(--border)] bg-[var(--surface-elev)] px-2 py-1 text-[10px]">
                                    {metric.fmt(payload[0].value as number)}
                                  </div>
                                );
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignsClient({ storeId }: { storeId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<WeekOption[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("");
  const [compareOpen, setCompareOpen] = useState(false);

  // Load available weeks (extracted to useCallback so handleDeleteWeek can call it)
  const loadWeeks = useCallback(() => {
    setWeeksLoading(true);
    fetch(`/api/kaspi/ad/${storeId}/weeks`)
      .then((r) => r.json())
      .then((data) => {
        const weeks: WeekOption[] = data.weeks ?? [];
        setAvailableWeeks(weeks);
        setSelectedWeeks((prev) => {
          // Keep valid selections, default to latest 4 if none remain
          const valid = prev.filter((s) => weeks.some((w) => w.weekStart === s));
          return valid.length > 0 ? valid : weeks.slice(0, 4).map((w) => w.weekStart);
        });
      })
      .catch(() => setError("Не удалось загрузить список недель"))
      .finally(() => setWeeksLoading(false));
  }, [storeId]);

  useEffect(() => { loadWeeks(); }, [loadWeeks]);

  const handleDeleteWeek = useCallback(async (weekStart: string) => {
    await fetch(
      `/api/kaspi/ad/${storeId}/reset?target=week&weekStart=${encodeURIComponent(weekStart)}`,
      { method: "DELETE" },
    );
    loadWeeks(); // reloads weeks list, which triggers load() via the effect
  }, [storeId, loadWeeks]);

  // Load campaigns whenever selected weeks change
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedWeeks.length > 0 && selectedWeeks.length < availableWeeks.length) {
        selectedWeeks.forEach((w) => params.append("weeks", w));
      }
      const res = await fetch(`/api/kaspi/ad/${storeId}/campaigns?${params}`);
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
      setPeriods(data.periods ?? []);
    } catch {
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [storeId, selectedWeeks, availableWeeks.length]);

  // Load campaigns whenever selected weeks change (after weeks are loaded)
  useEffect(() => {
    if (!weeksLoading) load();
  }, [load, weeksLoading]);

  // Patch helpers
  const patchCampaign = async (campaignId: string, field: string, value: unknown) => {
    await fetch(`/api/kaspi/ad/${storeId}/campaigns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "campaign", id: campaignId, field, value }),
    });
    setCampaigns((prev) =>
      prev.map((c) => c.id === campaignId ? { ...c, [field]: value } : c),
    );
  };

  const patchStat = async (statId: string, campaignId: string, field: string, value: unknown) => {
    await fetch(`/api/kaspi/ad/${storeId}/campaigns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stat", id: statId, field, value }),
    });
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? { ...c, weeks: c.weeks.map((w) => w.id === statId ? { ...w, [field]: value } : w) }
          : c,
      ),
    );
  };

  // Derived data
  const weekPeriods = periods.filter((p) => !p.isMonthlyTotal);
  const monthPeriods = periods.filter((p) => p.isMonthlyTotal);

  // Last weekly period for sort reference
  const lastWeek = weekPeriods[weekPeriods.length - 1];

  // Client-side search + sort
  const filtered = campaigns
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!sortBy || !lastWeek) return 0;
      const getStat = (c: Campaign) =>
        c.weeks.find((w) => w.weekStart === lastWeek.weekStart && !w.isMonthlyTotal);
      const aVal = (getStat(a)?.[sortBy] as number) ?? -Infinity;
      const bVal = (getStat(b)?.[sortBy] as number) ?? -Infinity;
      // DRR: ascending (lower is better); rest: descending
      return sortBy === "drrPct" ? aVal - bVal : bVal - aVal;
    });

  // Total row computation (weekly periods only)
  const totals = weekPeriods.map((p) => {
    let spent = 0, impressions = 0, orders = 0;
    for (const c of filtered) {
      const s = c.weeks.find((w) => w.weekStart === p.weekStart && !w.isMonthlyTotal);
      if (s) { spent += s.spent ?? 0; impressions += s.impressions ?? 0; orders += s.orders ?? 0; }
    }
    return { weekStart: p.weekStart, spent, impressions, orders };
  });

  const allPeriods = [...weekPeriods, ...monthPeriods];

  return (
    <>
      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week selector */}
          <WeekSelector
            weeks={availableWeeks}
            selected={selectedWeeks}
            onChange={setSelectedWeeks}
            loading={weeksLoading}
            onDelete={handleDeleteWeek}
          />

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск кампании..."
              className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-8 pr-2 text-[11px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none hover:border-[var(--border-strong)] focus:border-[var(--border-focus)]"
              style={{ width: 180 }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 text-[var(--text-dim)] hover:text-[var(--text)]">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] outline-none hover:border-[var(--border-strong)]"
            >
              <option value="">Без сортировки</option>
              <option value="spent">Расход ↓ (посл. нед.)</option>
              <option value="impressions">Показы ↓</option>
              <option value="orders">Заказы ↓</option>
              <option value="ctrPct">CTR% ↓</option>
              <option value="drrPct">ДРР% ↑ (лучшие)</option>
              <option value="dailyBudget">Бюджет/д ↓</option>
              <option value="convCartPct">Конв→корз% ↓</option>
            </select>
          </div>

          {/* Compare button */}
          {weekPeriods.length >= 2 && (
            <Button variant="ghost" size="sm" onClick={() => setCompareOpen(true)}>
              <GitCompareArrows className="h-3.5 w-3.5" />
              Сравнить {weekPeriods.length} нед.
            </Button>
          )}

          {/* Refresh */}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>

          {/* Stats */}
          {!loading && !weeksLoading && (
            <span className="ml-auto text-[11px] text-[var(--text-dim)]">
              {filtered.length} из {campaigns.length} кампаний
              {weekPeriods.length > 0 && ` · ${weekPeriods.length} ${weekPeriods.length === 1 ? "неделя" : "недели"}`}
            </span>
          )}
        </div>
      </div>

      {/* Loading / Error / Empty states */}
      {(loading || weeksLoading) && (
        <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-dim)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[13px] text-[var(--red)]">
          {error}
        </div>
      )}
      {!loading && !weeksLoading && !error && availableWeeks.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center text-[13px] text-[var(--text-dim)]">
          <p className="font-medium text-[var(--text)]">Кампаний пока нет</p>
          <p className="mt-1">
            Загрузи CSV на странице{" "}
            <a href={`/stores/${storeId}/ad/upload`} className="text-[var(--accent)] underline">Загрузка CSV</a>
          </p>
        </div>
      )}
      {!loading && !weeksLoading && !error && availableWeeks.length > 0 && selectedWeeks.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-8 text-center text-[12px] text-[var(--text-dim)]">
          Выбери хотя бы одну неделю в фильтре выше
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!loading && !weeksLoading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
          <table className="w-full text-[12px]" style={{ minWidth: "max-content" }}>
            <thead>
              {/* Period header row */}
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] min-w-[220px]">
                  Кампания
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Статус</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Улучшить карточку</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Отзывы</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Скидка</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Наличие</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Видео</th>

                {weekPeriods.map((p) => (
                  <th key={p.weekStart} colSpan={11} className="border-l border-[var(--border)] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">
                    {fmtWeekLabel(p.weekStart, p.weekEnd)}
                  </th>
                ))}
                {monthPeriods.map((p) => (
                  <th key={p.weekStart} colSpan={11} className="border-l border-[var(--border)] bg-white/[0.02] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)] whitespace-nowrap">
                    📊 Итого {fmtDate(p.weekStart)} — {fmtDate(p.weekEnd)}
                  </th>
                ))}
              </tr>

              {/* Sub-header row */}
              {allPeriods.length > 0 && (
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                  <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-1" />
                  <th colSpan={6} />
                  {allPeriods.map((p) =>
                    ["Расход", "Показы", "Бюджет/д", "Целев. клик", "Ср. клик", "Заказы/ДРР%", "CTR%", "Конв→корз%", "Конв→изб%", "Выручка", "Оценка"].map((label) => (
                      <th
                        key={`${p.weekStart}-${label}`}
                        className={cn(
                          "px-2 py-1 text-[9px] font-medium uppercase tracking-[0.04em] text-[var(--text-subtle)] whitespace-nowrap",
                          label === "Расход" && "border-l border-[var(--border)]",
                        )}
                      >
                        {label}
                      </th>
                    ))
                  )}
                </tr>
              )}
            </thead>

            <tbody>
              {filtered.map((c, ci) => {
                const statMap = new Map<string, WeekStat>();
                for (const w of c.weeks) statMap.set(`${w.weekStart}_${w.isMonthlyTotal}`, w);

                return (
                  <tr key={c.id} className={cn("border-b border-[var(--border)] transition-colors hover:bg-white/[0.02]", ci % 2 !== 0 && "bg-white/[0.01]")}>
                    {/* Name */}
                    <td className="sticky left-0 z-10 bg-[var(--bg)] px-4 py-2 font-medium text-[var(--text)] min-w-[220px] max-w-[280px]">
                      <span className="block truncate" title={c.name}>{c.name}</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 text-center">
                      <InlineDropdown value={c.status} options={STATUS_OPTIONS}
                        onSave={(v) => patchCampaign(c.id, "status", v)} />
                    </td>

                    {/* improveCard */}
                    <td className="px-3 py-2 text-center">
                      <InlineDropdown value={c.improveCard ?? "no"} options={IMPROVE_OPTIONS}
                        onSave={(v) => patchCampaign(c.id, "improveCard", v)} />
                    </td>

                    {/* Bool flags */}
                    {(["hasReviews", "hasDiscount", "inStock", "hasVideo"] as const).map((field) => (
                      <td key={field} className="px-3 py-2 text-center">
                        <InlineDropdown value={String(c[field] ?? false)} options={BOOL_OPTIONS}
                          onSave={(v) => patchCampaign(c.id, field, v === "true")} />
                      </td>
                    ))}

                    {/* Per-period stats */}
                    {allPeriods.map((p) => {
                      const s = statMap.get(`${p.weekStart}_${p.isMonthlyTotal}`);
                      const hasSpend = (s?.spent ?? 0) > 0;
                      const hasOrders = (s?.orders ?? 0) > 0;
                      return [
                        // Расход — read-only
                        <td key={`${p.weekStart}-spent`} className={cn("border-l border-[var(--border)] px-2 py-2 text-right whitespace-nowrap tabular-nums", hasSpend ? "font-medium text-[#60a5fa]" : "text-[var(--text-subtle)]")}>
                          {s ? (s.spent ? fmt(s.spent) : "—") : ""}
                        </td>,
                        // Показы — read-only
                        <td key={`${p.weekStart}-impr`} className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-[var(--text-dim)]">
                          {s ? (s.impressions ? fmt(s.impressions) : "—") : ""}
                        </td>,
                        // Бюджет/д
                        <td key={`${p.weekStart}-budget`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? <EditableNum value={s.dailyBudget} onSave={(v) => patchStat(s.id, c.id, "dailyBudget", v)} /> : ""}
                        </td>,
                        // Уст.клик
                        <td key={`${p.weekStart}-targetClick`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? <EditableNum value={s.targetClick ?? 0} onSave={(v) => patchStat(s.id, c.id, "targetClick", v)} /> : ""}
                        </td>,
                        // Ср.клик — read-only
                        <td key={`${p.weekStart}-click`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? (s.avgClick ? fmt(s.avgClick) : "—") : ""}
                        </td>,
                        // Заказы / ДРР%
                        <td key={`${p.weekStart}-orders`} className={cn("px-2 py-2 text-right whitespace-nowrap", s && !hasOrders && hasSpend ? "text-[var(--red)]" : "text-[var(--text)]")}>
                          {s
                            ? <><span className={hasOrders ? "text-[var(--emerald)] font-medium" : ""}>{s.orders ?? 0} зак.</span>{" / "}<span>{s.drrPct ? s.drrPct.toFixed(1) + "%" : "—"}</span></>
                            : ""}
                        </td>,
                        // CTR%
                        <td key={`${p.weekStart}-ctr`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? fmtPct(s.ctrPct) : ""}
                        </td>,
                        // Конв→корз%
                        <td key={`${p.weekStart}-conv`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? fmtPct(s.convCartPct) : ""}
                        </td>,
                        // Конв→изб%
                        <td key={`${p.weekStart}-convfav`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? fmtPct(s.convFavPct) : ""}
                        </td>,
                        // Выручка — из CSV для всех периодов (monthly редактируемая, weekly readonly)
                        <td key={`${p.weekStart}-revenue`} className={cn("px-2 py-2 text-right whitespace-nowrap font-medium", s?.revenue ? "text-[var(--amber)]" : "text-[var(--text-subtle)]")}>
                          {s
                            ? p.isMonthlyTotal
                              ? <EditableNum value={s.revenue} onSave={(v) => patchStat(s.id, c.id, "revenue", v)} />
                              : (s.revenue ? fmt(s.revenue) : "—")
                            : ""}
                        </td>,
                        // Оценка
                        <td key={`${p.weekStart}-rating`} className="px-2 py-2 whitespace-nowrap">
                          {s ? <RatingBadge rating={s.rating ?? "no_data"} /> : ""}
                        </td>,
                      ];
                    })}
                  </tr>
                );
              })}
            </tbody>

            {/* Total row (weekly periods only) */}
            {weekPeriods.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-subtle)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-dim)]">
                    Итого ({filtered.length})
                  </td>
                  <td colSpan={6} />
                  {allPeriods.map((p) => {
                    const t = totals.find((x) => x.weekStart === p.weekStart);
                    if (!t || p.isMonthlyTotal) {
                      // Pad monthly periods with empty cells (11 columns per period)
                      return Array.from({ length: 11 }).map((_, i) => (
                        <td key={`${p.weekStart}-total-${i}`} className={i === 0 ? "border-l border-[var(--border)]" : ""} />
                      ));
                    }
                    return [
                      <td key={`${p.weekStart}-tot-spent`} className="border-l border-[var(--border)] px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-[#60a5fa]">
                        {fmt(t.spent)}
                      </td>,
                      <td key={`${p.weekStart}-tot-impr`} className="px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-[var(--text-dim)]">
                        {fmt(t.impressions)}
                      </td>,
                      <td key={`${p.weekStart}-tot-budget`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-target`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-click`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-orders`} className="px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-[var(--emerald)]">
                        {t.orders} зак.
                      </td>,
                      <td key={`${p.weekStart}-tot-ctr`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-conv`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-convfav`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-rev`} className="px-2 py-2" />,
                      <td key={`${p.weekStart}-tot-rating`} className="px-2 py-2" />,
                    ];
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Comparison modal */}
      {compareOpen && (
        <CompareModal
          campaigns={filtered}
          periods={periods}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  );
}
