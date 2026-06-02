"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, ShoppingCart, Wallet, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdFilterBar, type Granularity } from "@/components/ad/ad-filter-bar";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyPoint {
  weekStart: string;
  weekEnd: string;
  spent: number;
  impressions: number;
  orders: number;
  revenue: number;
  drrPct: number | null;
}

interface TopCampaign {
  name: string;
  spent: number;
  orders: number;
  drrPct: number | null;
  rating: string;
}

interface RatingDist {
  rating: string;
  count: number;
}

interface Kpi {
  totalSpent: number;
  totalImpressions: number;
  totalOrders: number;
  totalRevenue: number;
  avgDrr: number | null;
  activeCampaigns: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

const RATING_LABELS: Record<string, string> = {
  good: "Хорошо",
  normal: "Норм.",
  bad: "Плохо",
  no_data: "Нет данных",
};
const RATING_COLORS: Record<string, string> = {
  good: "var(--emerald)",
  normal: "var(--amber)",
  bad: "var(--red)",
  no_data: "var(--text-subtle)",
};

function RatingDot({ rating }: { rating: string }) {
  const color = RATING_COLORS[rating] ?? RATING_COLORS.no_data;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: `var(${color.replace("var(", "").replace(")", "")})` }}>
      ● {RATING_LABELS[rating] ?? rating}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string; // css var name like "--emerald"
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-[var(--radius)] bg-white/[0.06]")}>
          <Icon className="h-3.5 w-3.5 text-[var(--text-dim)]" />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">{label}</span>
      </div>
      <span
        className="text-[26px] font-semibold tabular-nums leading-none"
        style={accent ? { color: `var(${accent})` } : undefined}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-[var(--text-subtle)]">{sub}</span>}
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-3 py-2 text-[12px] shadow-lg">
      <p className="mb-1.5 font-medium text-[var(--text-dim)]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tabular-nums">
          {p.name}: {p.value?.toLocaleString("ru-RU")}
        </p>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SummaryClient({ storeId }: { storeId: string }) {
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [weekly, setWeekly] = useState<WeeklyPoint[]>([]);
  const [topCampaigns, setTopCampaigns] = useState<TopCampaign[]>([]);
  const [ratingDist, setRatingDist] = useState<RatingDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [granularity, setGranularity] = useState<Granularity>("weekly");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/kaspi/ad/${storeId}/summary?${params}`);
      const data = await res.json();
      setKpi(data.kpi);
      setWeekly(data.weekly ?? []);
      setTopCampaigns(data.topCampaigns ?? []);
      setRatingDist(data.ratingDist ?? []);
    } catch { setError("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [storeId, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Format weekly data for recharts
  const chartData = weekly.map((w) => ({
    label: fmtDate(w.weekStart),
    Расход: w.spent,
    Показы: w.impressions,
    Заказы: w.orders,
    "ДРР%": w.drrPct,
  }));

  const pieData = ratingDist.map((r) => ({
    name: RATING_LABELS[r.rating] ?? r.rating,
    value: r.count,
    color: `var(${RATING_COLORS[r.rating] ?? "--text-subtle"})`,
  }));

  return (
    <>
      {/* Filter bar */}
      <AdFilterBar
        from={fromDate}
        to={toDate}
        onChange={(f, t) => { setFromDate(f); setToDate(t); }}
        granularity={granularity}
        onGranularity={setGranularity}
        extra={
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-dim)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[13px] text-[var(--red)]">
          {error}
        </div>
      )}

      {!loading && !error && kpi && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Активных кампаний" value={String(kpi.activeCampaigns)} icon={BarChart2} />
            <KpiCard label="Расход" value={fmt(kpi.totalSpent) + " ₸"} icon={Wallet} accent="--accent" />
            <KpiCard label="Показы" value={fmt(kpi.totalImpressions)} icon={BarChart2} />
            <KpiCard label="Заказы" value={fmt(kpi.totalOrders)} icon={ShoppingCart} accent="--emerald" />
            <KpiCard
              label="Средний ДРР%"
              value={kpi.avgDrr != null ? kpi.avgDrr.toFixed(1) + "%" : "—"}
              sub={kpi.avgDrr != null ? (kpi.avgDrr <= 8 ? "Хороший результат" : kpi.avgDrr <= 15 ? "В норме" : "Высокий ДРР") : undefined}
              icon={TrendingUp}
              accent={kpi.avgDrr == null ? undefined : kpi.avgDrr <= 8 ? "--emerald" : kpi.avgDrr <= 15 ? "--amber" : "--red"}
            />
            <KpiCard label="Выручка" value={kpi.totalRevenue > 0 ? fmt(kpi.totalRevenue) + " ₸" : "—"} icon={TrendingUp} />
          </div>

          {/* Charts row */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Spend bar */}
              <div className="col-span-1 lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="mb-4 text-[12px] font-semibold text-[var(--text-dim)] uppercase tracking-[0.06em]">Расход по неделям, ₸</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Расход" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Rating pie */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="mb-4 text-[12px] font-semibold text-[var(--text-dim)] uppercase tracking-[0.06em]">Оценки кампаний</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend
                        formatter={(value) => <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{value}</span>}
                      />
                      <Tooltip formatter={(value, name) => [value + " кампаний", name]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-[12px] text-[var(--text-subtle)]">Нет данных</div>
                )}
              </div>
            </div>
          )}

          {/* Orders + DRR% + Impressions charts */}
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="mb-4 text-[12px] font-semibold text-[var(--text-dim)] uppercase tracking-[0.06em]">Показы по неделям</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Показы" fill="var(--text-dim)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="mb-4 text-[12px] font-semibold text-[var(--text-dim)] uppercase tracking-[0.06em]">Заказы по неделям</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Заказы" fill="var(--emerald)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
                <h3 className="mb-4 text-[12px] font-semibold text-[var(--text-dim)] uppercase tracking-[0.06em]">ДРР% по неделям</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="ДРР%" stroke="var(--amber)" strokeWidth={2} dot={{ r: 3, fill: "var(--amber)" }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top campaigns table */}
          {topCampaigns.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border)] px-5 py-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">
                  Топ кампаний по расходу
                </h3>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                    <th className="px-5 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">#</th>
                    <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">Кампания</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">Расход, ₸</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">Заказы</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">ДРР%</th>
                    <th className="px-4 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">Оценка</th>
                  </tr>
                </thead>
                <tbody>
                  {topCampaigns.map((c, i) => (
                    <tr key={i} className={cn("border-b border-[var(--border)] hover:bg-white/[0.02]", i % 2 !== 0 && "bg-white/[0.01]")}>
                      <td className="px-5 py-2 text-[var(--text-subtle)] tabular-nums">{i + 1}</td>
                      <td className="max-w-[280px] px-4 py-2">
                        <span className="block truncate font-medium text-[var(--text)]" title={c.name}>{c.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-[#60a5fa]">{fmt(c.spent)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        <span className={c.orders > 0 ? "font-medium text-[var(--emerald)]" : "text-[var(--red)]"}>
                          {c.orders}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-[var(--text-dim)]">
                        {c.drrPct != null ? c.drrPct.toFixed(1) + "%" : "—"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <RatingDot rating={c.rating} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {chartData.length === 0 && topCampaigns.length === 0 && (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center text-[13px] text-[var(--text-dim)]">
              <p className="font-medium text-[var(--text)]">Данных пока нет</p>
              <p className="mt-1">
                Загрузи CSV на странице{" "}
                <a href={`/stores/${storeId}/ad/upload`} className="text-[var(--accent)] underline">Загрузка CSV</a>
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
