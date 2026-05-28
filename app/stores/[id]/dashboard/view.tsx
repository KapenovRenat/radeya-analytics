"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell, Section } from "@/components/page/page-shell";
import { FilterBar, useFilters } from "@/components/page/filter-bar";
import { KpiStrip, type KpiItem } from "@/components/page/kpi-strip";
import { AiInsightBlock } from "@/components/page/ai-insight-block";
import { RecommendationBlock } from "@/components/page/recommendation-block";
import { ChartTooltip } from "@/components/chart-primitives";
import { useAnalytics } from "@/lib/use-analytics";
import {
  formatCompactMoney,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  generateDashboardInsights,
  generateDashboardRecommendations,
} from "@/lib/insights/dashboard";

interface DashboardData {
  kpis: {
    totalOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    uniqueCustomers: number;
    cancellationRate: number;
    returnRate: number;
    kaspiDeliveryShare: number;
    totalDeliveryCost: number;
  };
  compare: {
    changes: { revenue: number; orders: number; avgOrderValue: number; customers: number };
  };
  series: Array<{ period: string; revenue: number; orders: number }>;
  topDays: Array<{ day: string; orders: number; revenue: number; avg_check: number; dow: number }>;
}

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatPeriodLabel(date: string): string {
  return new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function periodSubtitle(from: string, to: string): string {
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  return `последние ${days} дн.`;
}

function buildHeadline(d: DashboardData | null): string {
  if (!d) return "Сводка магазина за выбранный период.";
  const k = d.kpis;
  const c = d.compare.changes;
  const revStr = `${formatCompactMoney(k.totalRevenue)} выручки`;
  const deltaStr = Math.abs(c.revenue) >= 1 ? ` (${c.revenue >= 0 ? "+" : ""}${c.revenue.toFixed(1)}% к прошлому окну)` : "";
  return `${revStr}${deltaStr}, ${formatNumber(k.completedOrders)} заказов, средний чек ${formatCompactMoney(k.avgOrderValue)}.`;
}

export function DashboardView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { data, loading, error } = useAnalytics<DashboardData>(storeId, "dashboard");
  const { from, to } = useFilters();
  const subtitle = `${storeName} · ${periodSubtitle(from, to)}`;

  const kpis: KpiItem[] = data
    ? [
        {
          label: "Выручка",
          value: formatCompactMoney(data.kpis.totalRevenue),
          hint: formatMoney(data.kpis.totalRevenue),
          delta: { value: data.compare.changes.revenue },
        },
        {
          label: "Заказов",
          value: formatNumber(data.kpis.completedOrders),
          hint: "выполнено",
          delta: { value: data.compare.changes.orders },
        },
        {
          label: "Средний чек",
          value: formatCompactMoney(data.kpis.avgOrderValue),
          hint: formatMoney(Math.round(data.kpis.avgOrderValue)),
          delta: { value: data.compare.changes.avgOrderValue },
        },
        {
          label: "% отмен",
          value: formatPercent(data.kpis.cancellationRate),
          hint: `${formatNumber(data.kpis.cancelledOrders)} отменено`,
          tone: data.kpis.cancellationRate >= 3 ? "danger" : data.kpis.cancellationRate >= 1.5 ? "warning" : "default",
        },
        {
          label: "% возвратов",
          value: formatPercent(data.kpis.returnRate),
          hint: `${formatNumber(data.kpis.returnedOrders)} возвратов`,
          tone: data.kpis.returnRate >= 2 ? "warning" : "default",
        },
        {
          label: "Клиентов",
          value: formatNumber(data.kpis.uniqueCustomers),
          hint: "уникальных",
          delta: { value: data.compare.changes.customers },
        },
      ]
    : [];

  const insights = data ? generateDashboardInsights(data.kpis, data.compare.changes) : [];
  const recs = generateDashboardRecommendations(
    data?.kpis ?? {
      totalOrders: 0, completedOrders: 0, cancelledOrders: 0, returnedOrders: 0,
      totalRevenue: 0, avgOrderValue: 0, uniqueCustomers: 0,
      cancellationRate: 0, returnRate: 0, kaspiDeliveryShare: 0,
    },
    `/stores/${storeId}`,
  );

  return (
    <PageShell title="Дашборд" subtitle={subtitle} headline={buildHeadline(data)}>
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка загрузки: {error}
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[96px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        data && <KpiStrip items={kpis} />
      )}

      <Section
        title="Выручка и заказы по периоду"
        hint="Площадь — выручка (₸), линия — количество заказов. Видны пики и провалы."
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="h-[280px]">
            {data && data.series.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={data.series.map((d) => ({ ...d, label: formatPeriodLabel(d.period) }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40} />
                  <YAxis
                    yAxisId="rev"
                    tickFormatter={(v) => formatCompactMoney(v)}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />
                  <YAxis
                    yAxisId="ord"
                    orientation="right"
                    tickFormatter={(v) => formatNumber(v)}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                    content={(props) => <ChartTooltip {...props} valueFormatter="money" />}
                  />
                  <Area
                    yAxisId="rev"
                    type="monotone"
                    dataKey="revenue"
                    name="Выручка"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill="url(#dashRev)"
                  />
                  <Line
                    yAxisId="ord"
                    type="monotone"
                    dataKey="orders"
                    name="Заказы"
                    stroke="var(--emerald)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : loading ? (
              <div className="h-full animate-pulse rounded-md bg-white/[0.03]" />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </Section>

      {data && <AiInsightBlock insights={insights} isMock={false} />}

      <Section title="Топ-10 дней по выручке" hint="Лучшие дни в выбранном периоде. Строки с выходными — приглушены.">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-[12px] tabular">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                <th className="px-4 py-2.5">Дата</th>
                <th className="px-4 py-2.5">День</th>
                <th className="px-4 py-2.5 text-right">Заказов</th>
                <th className="px-4 py-2.5 text-right">Ср. чек</th>
                <th className="px-4 py-2.5 text-right">Выручка</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-dim)]">
                    Загрузка…
                  </td>
                </tr>
              ) : !data || data.topDays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[var(--text-dim)]">
                    Нет данных
                  </td>
                </tr>
              ) : (
                data.topDays.map((d, i) => {
                  const isWeekend = d.dow === 6 || d.dow === 7;
                  return (
                    <tr
                      key={i}
                      className={"border-t border-[var(--border)] " + (isWeekend ? "bg-white/[0.015]" : "")}
                    >
                      <td className="px-4 py-2 font-medium text-[var(--text)]">
                        {new Date(d.day).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-dim)]">{DOW_LABELS[d.dow - 1]}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(d.orders)}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-dim)]">
                        {formatMoney(Math.round(d.avg_check))}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatMoney(d.revenue)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {data && <RecommendationBlock items={recs} />}
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-[12px] text-[var(--text-dim)]">
      <div className="font-medium text-[var(--text)]">Нет данных за период</div>
      <div>Измените фильтр или дождитесь синхронизации</div>
    </div>
  );
}
