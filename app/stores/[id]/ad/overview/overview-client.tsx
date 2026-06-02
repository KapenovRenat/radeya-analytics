"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, CheckCircle, XCircle,
  Loader2, Trash2, RefreshCw, X, Search, ChevronDown,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyRow {
  id: string;
  date: string;
  impressions: number;
  clicks: number;
  ctrPct: number;
  avgClick: number;
  spent: number;
  revenue: number;
  orders: number;
  favorites: number;
  cart: number;
  drrPct: number;
}

interface WeekSummary {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  impressions: number;
  clicks: number;
  ctrPct: number;
  avgClick: number;
  spent: number;
  revenue: number;
  orders: number;
  favorites: number;
  cart: number;
  drrPct: number;
  days: DailyRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!n) return "0";
  return n.toLocaleString("ru-RU");
}
function fmtMoney(n: number) {
  if (!n) return "0 тг";
  return n.toLocaleString("ru-RU") + " тг";
}
function fmtPct(n: number) {
  if (!n) return "0%";
  return n.toFixed(1) + "%";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function getMondayISO(dateStr: string): string {
  const d = new Date(dateStr);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function buildWeekSummaries(rows: DailyRow[]): WeekSummary[] {
  const weekMap = new Map<string, DailyRow[]>();
  for (const r of rows) {
    const mon = getMondayISO(r.date);
    if (!weekMap.has(mon)) weekMap.set(mon, []);
    weekMap.get(mon)!.push(r);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mon, days]) => {
      const sumImpr = days.reduce((s, r) => s + r.impressions, 0);
      const sumClicks = days.reduce((s, r) => s + r.clicks, 0);
      const sumSpent = days.reduce((s, r) => s + r.spent, 0);
      const sumRevenue = days.reduce((s, r) => s + r.revenue, 0);
      const sumOrders = days.reduce((s, r) => s + r.orders, 0);
      const sumFav = days.reduce((s, r) => s + r.favorites, 0);
      const sumCart = days.reduce((s, r) => s + r.cart, 0);

      const sun = new Date(mon);
      sun.setUTCDate(sun.getUTCDate() + 6);

      const year = sun.getUTCFullYear();
      const startLabel = new Date(mon).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
      const endLabel   = sun.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });

      return {
        weekLabel: `${startLabel} — ${endLabel} ${year}`,
        weekStart: mon,
        weekEnd: sun.toISOString(),
        impressions: sumImpr,
        clicks: sumClicks,
        ctrPct: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : 0,
        avgClick: sumClicks > 0 ? sumSpent / sumClicks : 0,
        spent: sumSpent,
        revenue: sumRevenue,
        orders: sumOrders,
        favorites: sumFav,
        cart: sumCart,
        drrPct: sumRevenue > 0 ? (sumSpent / sumRevenue) * 100 : 0,
        days: days.sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-subtle)]">{label}</span>
      <span className={cn("text-[18px] font-bold tabular-nums", accent ? "text-[var(--accent)]" : "text-[var(--text)]")}>{value}</span>
      {sub && <span className="text-[11px] text-[var(--text-dim)]">{sub}</span>}
    </div>
  );
}

// ─── Chart metric selector ────────────────────────────────────────────────────

const CHART_METRICS = [
  { key: "impressions", label: "Просмотры",  color: "#8b5cf6" },
  { key: "clicks",      label: "Клики",      color: "#3b82f6" },
  { key: "spent",       label: "Расход",     color: "#f59e0b" },
  { key: "orders",      label: "Заказы",     color: "#10b981" },
  { key: "revenue",     label: "Выручка",    color: "#06b6d4" },
  { key: "drrPct",      label: "ДРР%",       color: "#ef4444" },
  { key: "ctrPct",      label: "CTR%",       color: "#a78bfa" },
] as const;

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OverviewClient({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<string>("impressions");

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ upserted: number; from: string; to: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected weeks for comparison
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  // Search inside the top dropdown (for active week selector)
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Search for the week cards below (comparison section)
  const [cardSearch, setCardSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kaspi/ad/${storeId}/overview`);
      const data = await res.json();
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
        setDropdownSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", pendingFile);
    try {
      const res = await fetch(`/api/kaspi/ad/${storeId}/overview`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { setUploadError(data.error); return; }
      setUploadResult(data);
      setPendingFile(null);
      load();
    } catch {
      setUploadError("Ошибка сети");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (weekStart: string, weekEnd: string) => {
    await fetch(`/api/kaspi/ad/${storeId}/overview?from=${encodeURIComponent(weekStart)}&to=${encodeURIComponent(weekEnd)}`, {
      method: "DELETE",
    });
    load();
  };

  const weeks = buildWeekSummaries(rows);

  // Active week for KPI + chart (default = latest week)
  const [activeWeek, setActiveWeek] = useState<string | null>(null);

  // Auto-select the latest week when data loads
  useEffect(() => {
    if (weeks.length > 0 && !activeWeek) {
      setActiveWeek(weeks[weeks.length - 1].weekStart);
    }
  }, [weeks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows for the active week (or all rows if no selection)
  const activeWeekObj = weeks.find((w) => w.weekStart === activeWeek) ?? null;
  const displayRows = activeWeekObj ? activeWeekObj.days : rows;

  // Totals for the displayed rows
  const totals = displayRows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      spent: acc.spent + r.spent,
      revenue: acc.revenue + r.revenue,
      orders: acc.orders + r.orders,
      favorites: acc.favorites + r.favorites,
      cart: acc.cart + r.cart,
    }),
    { impressions: 0, clicks: 0, spent: 0, revenue: 0, orders: 0, favorites: 0, cart: 0 },
  );
  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalDrr = totals.revenue > 0 ? (totals.spent / totals.revenue) * 100 : 0;
  const totalAvgClick = totals.clicks > 0 ? totals.spent / totals.clicks : 0;

  // Chart data — displayed rows sorted by date
  const chartData = [...displayRows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({
      date: fmtDate(r.date),
      impressions: r.impressions,
      clicks: r.clicks,
      spent: Math.round(r.spent),
      orders: r.orders,
      revenue: Math.round(r.revenue),
      drrPct: parseFloat(r.drrPct.toFixed(2)),
      ctrPct: parseFloat(r.ctrPct.toFixed(2)),
    }));

  // Selected week summaries for comparison
  // Dropdown (top) — filtered by dropdownSearch
  const dropdownWeeks = dropdownSearch.trim()
    ? weeks.filter((w) => w.weekLabel.toLowerCase().includes(dropdownSearch.toLowerCase()))
    : weeks;

  // Cards (bottom) — filtered by cardSearch
  const filteredWeeks = cardSearch.trim()
    ? weeks.filter((w) => w.weekLabel.toLowerCase().includes(cardSearch.toLowerCase()))
    : weeks;

  const selectedSummaries = weeks.filter((w) => selectedWeeks.includes(w.weekStart));

  const toggleWeek = (weekStart: string) => {
    setSelectedWeeks((prev) =>
      prev.includes(weekStart) ? prev.filter((s) => s !== weekStart) : [...prev, weekStart],
    );
  };

  const COMPARE_FIELDS: { key: keyof WeekSummary; label: string; fmt: (v: number) => string; higherIsBetter: boolean }[] = [
    { key: "impressions", label: "Просмотры",    fmt: (v) => fmt(v),        higherIsBetter: true  },
    { key: "clicks",      label: "Клики",         fmt: (v) => fmt(v),        higherIsBetter: true  },
    { key: "ctrPct",      label: "CTR%",          fmt: (v) => fmtPct(v),     higherIsBetter: true  },
    { key: "avgClick",    label: "Ср. клик",      fmt: (v) => fmtMoney(v),   higherIsBetter: false },
    { key: "spent",       label: "Расход",         fmt: (v) => fmtMoney(v),  higherIsBetter: false },
    { key: "revenue",     label: "Выручка",       fmt: (v) => fmtMoney(v),   higherIsBetter: true  },
    { key: "orders",      label: "Заказы",         fmt: (v) => fmt(v),        higherIsBetter: true  },
    { key: "favorites",   label: "В избранное",   fmt: (v) => fmt(v),        higherIsBetter: true  },
    { key: "cart",        label: "В корзину",     fmt: (v) => fmt(v),        higherIsBetter: true  },
    { key: "drrPct",      label: "ДРР%",           fmt: (v) => fmtPct(v),    higherIsBetter: false },
  ];

  const selectedMetric = CHART_METRICS.find((m) => m.key === chartMetric)!;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[var(--text)]">Обзор рекламы</h1>
          <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">
            {activeWeekObj ? activeWeekObj.weekLabel : "Все недели"} · {displayRows.length} дней · {weeks.length} недель в базе
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setUploadOpen((s) => !s); setUploadResult(null); setUploadError(null); }}>
            <Upload className="h-3.5 w-3.5" />
            Загрузить отчёт
          </Button>
        </div>
      </div>

      {/* Upload panel */}
      {uploadOpen && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elev)] p-4">
          <p className="mb-3 text-[12px] font-medium text-[var(--text)]">
            Загрузи «Обзорный отчёт» из Kaspi кабинета (один файл = один период)
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) { setPendingFile(f); setUploadResult(null); setUploadError(null); } }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed p-6 transition-colors",
              dragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] hover:border-[var(--accent)]",
            )}
          >
            <Upload className="h-5 w-5 text-[var(--text-dim)]" />
            <p className="text-[12px] text-[var(--text-dim)]">Перетащи CSV или кликни</p>
            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); setUploadResult(null); setUploadError(null); } }} />
          </div>

          {pendingFile && (
            <div className="mt-2 flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              <span className="flex-1 truncate text-[12px] font-medium">{pendingFile.name}</span>
              <button onClick={() => setPendingFile(null)} className="text-[var(--text-dim)] hover:text-[var(--text)]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {uploadResult && (
            <div className="mt-2 flex items-center gap-2 rounded bg-[var(--emerald-soft)]/30 px-3 py-2 text-[12px] text-[var(--emerald)]">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Загружено {uploadResult.upserted} дней ({uploadResult.from} — {uploadResult.to})
            </div>
          )}
          {uploadError && (
            <div className="mt-2 flex items-center gap-2 rounded bg-[var(--red-soft)] px-3 py-2 text-[12px] text-[var(--red)]">
              <XCircle className="h-4 w-4 shrink-0" />
              {uploadError}
            </div>
          )}

          {pendingFile && (
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setPendingFile(null); setUploadOpen(false); }}>Отмена</Button>
              <Button variant="primary" size="sm" onClick={handleUpload} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Загружаем..." : "Загрузить"}
              </Button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-12 text-[13px] text-[var(--text-dim)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center">
          <p className="text-[14px] font-medium text-[var(--text)]">Данных пока нет</p>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">Загрузи «Обзорный отчёт» из Kaspi кабинета</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {/* Week selector — custom dropdown with built-in search */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-subtle)] shrink-0">Неделя:</span>
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => { setDropdownOpen((s) => !s); setDropdownSearch(""); }}
                className="inline-flex h-7 min-w-[180px] items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2.5 text-[11px] font-medium text-[var(--text)] hover:border-[var(--border-strong)]"
              >
                <span className="truncate">{activeWeekObj?.weekLabel ?? "Выбери неделю"}</span>
                <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-60 transition-transform", dropdownOpen && "rotate-180")} />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-[240px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] py-1 shadow-lg">
                  {/* Search inside dropdown */}
                  <div className="px-2 pb-1 pt-1.5">
                    <div className="relative flex items-center">
                      <Search className="absolute left-2 h-3 w-3 text-[var(--text-subtle)]" />
                      <input
                        autoFocus
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        placeholder="Поиск недели..."
                        className="h-6 w-full rounded border border-[var(--border)] bg-[var(--surface)] pl-6 pr-2 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                  <div className="my-0.5 border-t border-[var(--border)]" />
                  <div className="max-h-[220px] overflow-y-auto">
                    {dropdownWeeks.length === 0 && (
                      <p className="px-3 py-2 text-[11px] text-[var(--text-subtle)]">Ничего не найдено</p>
                    )}
                    {dropdownWeeks.map((w) => (
                      <button
                        key={w.weekStart}
                        onClick={() => { setActiveWeek(w.weekStart); setDropdownOpen(false); setDropdownSearch(""); }}
                        className={cn(
                          "flex w-full items-center px-3 py-1.5 text-[11px] hover:bg-white/[0.06]",
                          activeWeek === w.weekStart ? "font-semibold text-[var(--accent)]" : "text-[var(--text)]",
                        )}
                      >
                        {w.weekLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[11px] text-[var(--text-subtle)]">{weeks.length} нед.</span>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <KpiCard label="Просмотры" value={fmt(totals.impressions)} accent />
            <KpiCard label="Клики" value={fmt(totals.clicks)} sub={`CTR ${fmtPct(totalCtr)}`} />
            <KpiCard label="В избранное" value={fmt(totals.favorites)} />
            <KpiCard label="В корзину" value={fmt(totals.cart)} />
            <KpiCard label="Заказы" value={fmt(totals.orders)} sub={fmtMoney(totals.revenue)} />
            <KpiCard label="Расход" value={fmtMoney(totals.spent)} sub={`Ср. клик ${fmtMoney(Math.round(totalAvgClick))}`} />
            <KpiCard label="ДРР%" value={fmtPct(totalDrr)} />
          </div>

          {/* Chart */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elev)] p-4">
            {/* Metric selector */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {CHART_METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setChartMetric(m.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                    chartMetric === m.key
                      ? "text-white"
                      : "bg-[var(--surface)] text-[var(--text-dim)] hover:text-[var(--text)]",
                  )}
                  style={chartMetric === m.key ? { backgroundColor: m.color } : {}}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-dim)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-dim)" }} width={60} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ background: "var(--surface-elev)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v) => [(v as number).toLocaleString("ru-RU"), selectedMetric.label]}
                />
                <Line
                  type="monotone"
                  dataKey={chartMetric}
                  stroke={selectedMetric.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: selectedMetric.color }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weeks list + comparison */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[14px] font-semibold text-[var(--text)]">
                Сравнение недель
                <span className="ml-2 text-[11px] font-normal text-[var(--text-dim)]">
                  Выбери недели
                </span>
              </h2>
              <div className="relative flex items-center">
                <Search className="absolute left-2 h-3.5 w-3.5 text-[var(--text-subtle)]" />
                <input
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                  placeholder="Поиск недели..."
                  className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-7 pr-2 text-[11px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
                  style={{ width: 160 }}
                />
                {cardSearch && (
                  <button onClick={() => setCardSearch("")} className="absolute right-2 text-[var(--text-dim)] hover:text-[var(--text)]">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Week cards — scrollable grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-h-[420px] overflow-y-auto pr-1">
              {filteredWeeks.length === 0 && (
                <p className="col-span-4 py-6 text-center text-[12px] text-[var(--text-subtle)]">Ничего не найдено</p>
              )}
              {filteredWeeks.map((w) => {
                const isSelected = selectedWeeks.includes(w.weekStart);
                return (
                  <div
                    key={w.weekStart}
                    onClick={() => toggleWeek(w.weekStart)}
                    className={cn(
                      "group relative cursor-pointer rounded-[var(--radius)] border p-3 transition-all",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-[var(--border)] bg-[var(--surface-elev)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold text-[var(--text)]">{w.weekLabel}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">{w.days.length} дней</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn(
                          "inline-flex h-4 w-4 items-center justify-center rounded border transition-colors",
                          isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-strong)]",
                        )}>
                          {isSelected && <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(w.weekStart, w.weekEnd); }}
                          className="opacity-0 transition-opacity group-hover:opacity-100 rounded p-0.5 text-[var(--text-subtle)] hover:text-[var(--red)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                      <span className="text-[var(--text-subtle)]">Расход</span>
                      <span className="text-right font-medium text-[var(--text)]">{fmtMoney(Math.round(w.spent))}</span>
                      <span className="text-[var(--text-subtle)]">Заказы</span>
                      <span className="text-right font-medium text-[var(--text)]">{w.orders}</span>
                      <span className="text-[var(--text-subtle)]">ДРР%</span>
                      <span className="text-right font-medium text-[var(--text)]">{fmtPct(w.drrPct)}</span>
                      <span className="text-[var(--text-subtle)]">CTR%</span>
                      <span className="text-right font-medium text-[var(--text)]">{fmtPct(w.ctrPct)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison table */}
            {selectedSummaries.length >= 2 && (
              <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">
                        Метрика
                      </th>
                      {selectedSummaries.map((w) => (
                        <th key={w.weekStart} className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)] whitespace-nowrap">
                          {w.weekLabel}
                        </th>
                      ))}
                      {selectedSummaries.length === 2 && (
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--accent)] whitespace-nowrap">
                          Δ
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map((field) => {
                      const values = selectedSummaries.map((w) => (w[field.key] as number) ?? 0);
                      const first = values[0];
                      const last = values[values.length - 1];
                      const diff = last - first;
                      const base = values.find((v) => v !== 0) ?? 0;
                      const pct = base !== 0 ? ((last - base) / base) * 100 : null;
                      const isPositive = diff !== 0 && (field.higherIsBetter ? diff > 0 : diff < 0);
                      const isNegative = diff !== 0 && (field.higherIsBetter ? diff < 0 : diff > 0);

                      return (
                        <tr key={field.key} className="border-b border-[var(--border)]/40 hover:bg-white/[0.02]">
                          <td className="px-4 py-2 font-medium text-[var(--text)]">{field.label}</td>
                          {values.map((v, i) => (
                            <td key={i} className="px-4 py-2 text-right tabular-nums text-[var(--text)]">
                              {field.fmt(v)}
                            </td>
                          ))}
                          {selectedSummaries.length === 2 && (
                            <td className={cn(
                              "px-4 py-2 text-right tabular-nums font-medium whitespace-nowrap",
                              isPositive ? "text-[var(--emerald)]"
                                : isNegative ? "text-[var(--red)]"
                                : "text-[var(--text-dim)]",
                            )}>
                              {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}${field.fmt(diff)}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}`}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedSummaries.length === 1 && (
              <p className="text-center text-[12px] text-[var(--text-subtle)]">
                Выбери ещё одну неделю для сравнения
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
