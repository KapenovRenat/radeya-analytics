"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/page/page-shell";
import { FilterBar, useFilters } from "@/components/page/filter-bar";
import { KpiStrip, type KpiItem } from "@/components/page/kpi-strip";
import { AiInsightBlock, type Insight } from "@/components/page/ai-insight-block";
import { RecommendationBlock, type Recommendation } from "@/components/page/recommendation-block";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/chart-primitives";
import { useAnalytics } from "@/lib/use-analytics";
import { OrdersTable } from "./orders-table";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import { DOW_LABELS_SHORT, STATUS_COLORS, STATUS_LABELS, formatPeriodLabel } from "@/lib/kaspi/labels";
import type { Period } from "@/lib/kaspi/aggregates";

interface OrdersData {
  period: Period;
  byStatus: Array<{ status: string; count: number; revenue: number }>;
  cancelSeries: Array<{ period: string; total: number; cancelled: number; rate: number }>;
  returnSeries: Array<{ period: string; total: number; returned: number; rate: number }>;
  byDow: Array<{ dow: number; count: number; revenue: number }>;
  byHour: Array<{ hour: number; count: number; revenue: number }>;
}

export function OrdersView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { granularity } = useFilters();
  const { data, loading, error } = useAnalytics<OrdersData>(storeId, "orders");

  const totalOrders = useMemo(
    () => (data?.byStatus ?? []).reduce((s, r) => s + r.count, 0),
    [data],
  );

  // Merge cancel + return series on date axis
  const healthSeries = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { period: string; cancel: number; ret: number }>();
    for (const r of data.cancelSeries) map.set(r.period, { period: r.period, cancel: r.rate, ret: 0 });
    for (const r of data.returnSeries) {
      const e = map.get(r.period) ?? { period: r.period, cancel: 0, ret: 0 };
      e.ret = r.rate;
      map.set(r.period, e);
    }
    return Array.from(map.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((d) => ({ ...d, label: formatPeriodLabel(d.period, granularity) }));
  }, [data, granularity]);

  const hourData = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    for (const r of data?.byHour ?? []) arr[r.hour].count = r.count;
    return arr;
  }, [data]);

  const dowData = useMemo(() => {
    const arr = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      dow: d,
      label: DOW_LABELS_SHORT[d - 1],
      count: 0,
    }));
    for (const r of data?.byDow ?? []) {
      const e = arr.find((x) => x.dow === r.dow);
      if (e) e.count = r.count;
    }
    return arr;
  }, [data]);
  const maxDow = Math.max(...dowData.map((d) => d.count), 1);

  const cancelled = data?.byStatus.find((s) => s.status === "CANCELLED")?.count ?? 0;
  const returned = data?.byStatus.find((s) => s.status === "RETURNED")?.count ?? 0;
  const completed = data?.byStatus.find((s) => s.status === "COMPLETED")?.count ?? 0;
  const cancelRate = totalOrders > 0 ? (cancelled / totalOrders) * 100 : 0;
  const returnRate = totalOrders > 0 ? (returned / totalOrders) * 100 : 0;

  const kpis: KpiItem[] = [
    { label: "Всего заказов", value: formatNumber(totalOrders), hint: "все статусы" },
    { label: "Выполнено", value: formatNumber(completed), hint: `${totalOrders > 0 ? ((completed / totalOrders) * 100).toFixed(1) : 0}% от общего` },
    {
      label: "% отмен",
      value: formatPercent(cancelRate),
      hint: `${formatNumber(cancelled)} отменено`,
      tone: cancelRate >= 3 ? "danger" : cancelRate >= 1.5 ? "warning" : "default",
    },
    {
      label: "% возвратов",
      value: formatPercent(returnRate),
      hint: `${formatNumber(returned)} возвратов`,
      tone: returnRate >= 2 ? "warning" : "default",
    },
  ];

  const peakDow = dowData.slice().sort((a, b) => b.count - a.count)[0];
  const peakHour = hourData.slice().sort((a, b) => b.count - a.count)[0];

  const insights: Insight[] = data
    ? [
        cancelRate >= 3 && {
          kind: "anomaly" as const,
          title: `Отмены ${cancelRate.toFixed(1)}% превышают порог Kaspi`,
          body: `Kaspi блокирует продавцов при систематических отменах от 3%. Сейчас ${formatNumber(cancelled)} отмен — нужно копать топ-причины и спайки на графике здоровья.`,
        },
        returnRate >= 2 && {
          kind: "anomaly" as const,
          title: `Возвраты ${returnRate.toFixed(1)}% — на уровне предупреждения`,
          body: `${formatNumber(returned)} возвратов. Чаще всего возвращают конкретные SKU — проверьте карточки на расхождения.`,
        },
        peakDow && {
          kind: "trend" as const,
          title: `Пик заказов — ${peakDow.label}`,
          body: `${formatNumber(peakDow.count)} заказов в этот день недели. Стоит держать запас рук на сборку именно в эту смену.`,
        },
        peakHour && peakHour.count > 0 && {
          kind: "observation" as const,
          title: `Пик часа — ${peakHour.hour}:00`,
          body: `Большая часть заказов оформляется в этот час. Уведомления и пуши «в окно покупки» работают лучше всего.`,
        },
      ].filter(Boolean) as Insight[]
    : [];

  const recs: Recommendation[] = [
    cancelRate >= 3 && {
      title: "Снизить отмены до 3%",
      body: "Топ-3 причины обычно: остатки рассинхронизировались, сборка не уложилась в SLA, ошибки в карточке. Начните с остатков.",
    },
    {
      title: "Дайте «в окно покупки» промо",
      body: "На графике «по часам» — пиковый час. Стоит запустить дневную акцию или пуш именно туда: конверсия выше.",
    },
    {
      title: "Свериться по топ-SKU",
      body: "Часть отмен/возвратов идёт по одним и тем же SKU. Найдите их в матрице ABC/XYZ.",
      action: { label: "К ABC/XYZ", href: `/stores/${storeId}/sku` },
    },
  ].filter(Boolean) as Recommendation[];

  return (
    <PageShell
      title="Заказы"
      subtitle={`${storeName} · группировка по ${granularity === "daily" ? "дням" : granularity === "weekly" ? "неделям" : "месяцам"}`}
      headline={`${formatNumber(totalOrders)} заказов за период · отмены ${formatPercent(cancelRate)}, возвраты ${formatPercent(returnRate)}.`}
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка: {error}
        </div>
      )}

      <KpiStrip items={kpis} />

        {/* P0 — status pill grid */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Статусы заказов</CardTitle>
              <CardDescription>
                Цвет красный для отмен ≥ 3%, оранжевый для возвратов ≥ 2% — пороги блокировки Kaspi.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {data ? (
                data.byStatus.map((s) => {
                  const pct = totalOrders > 0 ? (s.count / totalOrders) * 100 : 0;
                  const color = STATUS_COLORS[s.status] ?? "#6b7280";
                  const tone =
                    s.status === "CANCELLED" && pct >= 3
                      ? "red"
                      : s.status === "RETURNED" && pct >= 2
                        ? "orange"
                        : "default";
                  return (
                    <div
                      key={s.status}
                      className={cn(
                        "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-3 transition-colors",
                        tone === "red" && "border-[var(--red)]/40 bg-[var(--red-soft)]/40",
                        tone === "orange" && "border-[var(--orange)]/40 bg-[var(--orange-soft)]/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                          <span className="text-[11px] font-medium text-[var(--text-dim)]">
                            {STATUS_LABELS[s.status] ?? s.status}
                          </span>
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-[20px] font-semibold tabular">
                          {formatNumber(s.count)}
                        </span>
                        <span className="text-[11px] text-[var(--text-dim)] tabular">
                          {formatPercent(pct)}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-[var(--radius)] bg-white/[0.03]" />
                ))
              ) : (
                <div className="col-span-full text-[11px] text-[var(--text-dim)]">Нет данных</div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* P0 hero — health chart with reference lines */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Операционное здоровье</CardTitle>
              <CardDescription>
                Пунктирные линии — пороги Kaspi (3% для отмен, 2% для возвратов). Превышение → ограничения магазина.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-[260px]">
              {data && healthSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={healthSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(0)}%`}
                      tickLine={false}
                      axisLine={false}
                      width={42}
                      domain={[0, (max: number) => Math.max(max + 2, 6)]}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                      content={(props) => <ChartTooltip {...props} valueFormatter="percent" />}
                    />
                    <ReferenceLine y={3} stroke="var(--red)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Порог 3%", fill: "var(--red)", fontSize: 10, position: "insideTopRight" }} />
                    <ReferenceLine y={2} stroke="var(--orange)" strokeDasharray="4 4" strokeWidth={1} label={{ value: "Порог 2%", fill: "var(--orange)", fontSize: 10, position: "insideTopRight" }} />
                    <Line
                      type="monotone"
                      dataKey="cancel"
                      name="% отмен"
                      stroke="var(--red)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ret"
                      name="% возвратов"
                      stroke="var(--orange)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : loading ? (
                <div className="h-full animate-pulse rounded-md bg-white/[0.03]" />
              ) : (
                <EmptyState />
              )}
            </div>
          </CardBody>
        </Card>

        {/* Timing grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>По дням недели</CardTitle>
                <CardDescription>Лучший день подсвечен — когда больше всего заказов.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={32} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      content={(props) => <ChartTooltip {...props} valueFormatter="number" />}
                    />
                    <Bar dataKey="count" name="Заказов" radius={[3, 3, 0, 0]}>
                      {dowData.map((d) => (
                        <Cell
                          key={d.dow}
                          fill={d.count === maxDow ? "var(--emerald)" : "var(--accent)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>По часам</CardTitle>
                <CardDescription>Почасовое распределение — когда пик спроса.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v % 3 === 0 ? `${v}:00` : "")}
                    />
                    <YAxis tickLine={false} axisLine={false} width={32} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      content={(props) => <ChartTooltip {...props} valueFormatter="number" />}
                    />
                    <Bar dataKey="count" name="Заказов" fill="var(--accent)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </div>

      {/* Таблица всех заказов */}
      <div className="mt-2">
        <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-[var(--text)]">Все заказы</h2>
        <OrdersTable storeId={storeId} />
      </div>

      {data && <AiInsightBlock insights={insights} isMock={false} />}
      <RecommendationBlock items={recs} />
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-[12px] text-[var(--text-dim)]">
      <div className="font-medium text-[var(--text)]">Нет данных за период</div>
    </div>
  );
}
