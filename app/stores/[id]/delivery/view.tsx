"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
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
import { KZHeatmap, type OblastDatum } from "@/components/kz-heatmap/heatmap";
import { useAnalytics } from "@/lib/use-analytics";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/kaspi/labels";
import type { Period } from "@/lib/kaspi/aggregates";

interface DeliveryData {
  period: Period;
  avgCost: { avg_seller_cost: number; avg_buyer_cost: number };
  costSeries: Array<{ period: string; seller_cost: number; buyer_cost: number }>;
  expressSplit: Array<{ is_express: boolean; count: number; revenue: number }>;
  cities: Array<{ city: string | null; count: number; revenue: number }>;
  oblasts: OblastDatum[];
}

export function DeliveryView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { granularity } = useFilters();
  const { data, loading, error } = useAnalytics<DeliveryData>(storeId, "delivery");

  const totals = useMemo(() => {
    if (!data) return { orders: 0, totalSellerCost: 0, expressOrders: 0 };
    const orders = data.cities.reduce((s, c) => s + c.count, 0);
    const totalSellerCost = data.costSeries.reduce((s, c) => s + c.seller_cost, 0);
    const expressOrders = data.expressSplit.find((s) => s.is_express)?.count ?? 0;
    return { orders, totalSellerCost, expressOrders };
  }, [data]);

  const expressPct = totals.orders > 0 ? (totals.expressOrders / totals.orders) * 100 : 0;

  const topCity = data?.cities.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const topOblast = data?.oblasts.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const totalCityRevenue = data?.cities.reduce((s, c) => s + c.revenue, 0) ?? 0;
  const topCityShare = topCity && totalCityRevenue > 0 ? (topCity.revenue / totalCityRevenue) * 100 : 0;

  const kpis: KpiItem[] = [
    {
      label: "Расходы на доставку",
      value: formatCompactMoney(totals.totalSellerCost),
      hint: "продавец за период",
    },
    {
      label: "Средняя стоимость",
      value: formatMoney(Math.round(data?.avgCost.avg_seller_cost ?? 0)),
      hint: "продавец / заказ",
    },
    {
      label: "Экспресс доставка",
      value: formatPercent(expressPct),
      hint: `${formatNumber(totals.expressOrders)} заказов`,
    },
    {
      label: "Городов покрытия",
      value: formatNumber(data?.cities.length ?? 0),
      hint: "в выбранном периоде",
    },
  ];

  const insights: Insight[] = data
    ? [
        topCity && {
          kind: "observation" as const,
          title: `Главный город — ${topCity.city ?? "—"}`,
          body: `${formatCompactMoney(topCity.revenue)} выручки (${topCityShare.toFixed(1)}% от всех городов). Концентрация спроса — частая зона для локальных промо.`,
        },
        topOblast && {
          kind: "trend" as const,
          title: `Регион №1 — ${topOblast.oblast_name}`,
          body: `${formatNumber(topOblast.count)} заказов, средний чек ${formatMoney(Math.round(topOblast.avg_check))}. Сильный кандидат для пробы своей логистики (помимо Kaspi Delivery).`,
        },
        expressPct > 15 && {
          kind: "observation" as const,
          title: `Экспресс — ${expressPct.toFixed(0)}% заказов`,
          body: "Доля экспресса высокая. Это удорожает логистику, но обычно повышает конверсию для дорогих SKU. Проверьте, окупается ли по марже.",
        },
      ].filter(Boolean) as Insight[]
    : [];

  const recs: Recommendation[] = [
    {
      title: "Локальное промо в топ-городе",
      body: "Где плотнее всего клиенты — там же дешевле и быстрее доставлять. Скидка на самовывоз / fast delivery работает хорошо.",
    },
    {
      title: "Сверить себестоимость доставки",
      body: "Среднюю стоимость продавца сравнить с маржой по топ-категории. Если съедает > 5% — пересмотреть пороги бесплатной доставки.",
    },
  ];

  return (
    <PageShell
      title="Доставка"
      subtitle={`${storeName} · группировка по ${granularity === "daily" ? "дням" : granularity === "weekly" ? "неделям" : "месяцам"}`}
      headline={`${formatCompactMoney(totals.totalSellerCost)} на доставку, ${formatNumber(data?.cities.length ?? 0)} городов в покрытии.`}
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка: {error}
        </div>
      )}

      <KpiStrip items={kpis} />

        {/* P0 hero — KZ Heatmap */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Карта Казахстана</CardTitle>
              <CardDescription>
                Где ваши покупатели. Hover на регион — разбивка по выручке, заказам и среднему чеку.
                Переключите метрику для другой картины.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <KZHeatmap data={data?.oblasts ?? []} loading={loading} />
          </CardBody>
        </Card>

        {/* City ranking + cost series */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Топ городов</CardTitle>
                <CardDescription>Ранжирование по выручке за период</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <CitiesList cities={data?.cities ?? []} loading={loading} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Расходы на доставку</CardTitle>
                <CardDescription>Для продавца (серый) и оплаченная покупателем (голубой)</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-[260px]">
                {data && data.costSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.costSeries.map((d) => ({
                        label: formatPeriodLabel(d.period, granularity),
                        seller_cost: d.seller_cost,
                        buyer_cost: d.buyer_cost,
                      }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="2 4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40} />
                      <YAxis
                        tickFormatter={(v) => formatCompactMoney(v)}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        content={(props) => <ChartTooltip {...props} valueFormatter="money" />}
                      />
                      <Bar
                        stackId="cost"
                        dataKey="seller_cost"
                        name="Продавец"
                        fill="#6b7280"
                        radius={[0, 0, 0, 0]}
                      />
                      <Bar
                        stackId="cost"
                        dataKey="buyer_cost"
                        name="Покупатель"
                        fill="var(--blue)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : loading ? (
                  <div className="h-full animate-pulse rounded-md bg-white/[0.03]" />
                ) : (
                  <EmptyState />
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Express split donut */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Экспресс vs обычная доставка</CardTitle>
              <CardDescription>Доля заказов в экспрессе по количеству и выручке</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ExpressSplit data={data?.expressSplit ?? []} loading={loading} />
          </CardBody>
        </Card>

      {data && <AiInsightBlock insights={insights} isMock={false} />}
      <RecommendationBlock items={recs} />
    </PageShell>
  );
}

function CitiesList({
  cities,
  loading,
}: {
  cities: Array<{ city: string | null; count: number; revenue: number }>;
  loading: boolean;
}) {
  const max = Math.max(...cities.map((c) => c.revenue), 1);
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-white/[0.03]" />
        ))}
      </div>
    );
  }
  if (cities.length === 0) return <EmptyState />;
  return (
    <div className="space-y-1.5">
      {cities.slice(0, 15).map((c) => {
        const pct = (c.revenue / max) * 100;
        return (
          <div key={c.city} className="flex items-center gap-3 text-[12px]">
            <div className="w-28 truncate text-[var(--text)]">{c.city ?? "—"}</div>
            <div className="flex-1">
              <div className="h-5 rounded-sm bg-white/[0.03]">
                <div
                  className="h-full rounded-sm bg-[var(--accent)]/70"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
            <div className="w-16 text-right text-[var(--text-dim)] tabular">{formatNumber(c.count)}</div>
            <div className="w-20 text-right font-medium tabular">{formatCompactMoney(c.revenue)}</div>
          </div>
        );
      })}
    </div>
  );
}

function ExpressSplit({
  data,
  loading,
}: {
  data: Array<{ is_express: boolean; count: number; revenue: number }>;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-[180px] animate-pulse rounded-md bg-white/[0.03]" />;
  }
  const enriched = data.map((d) => ({
    name: d.is_express ? "Экспресс" : "Обычная",
    value: d.count,
    revenue: d.revenue,
    fill: d.is_express ? "var(--amber)" : "var(--blue)",
  }));
  const total = enriched.reduce((s, e) => s + e.value, 0);
  if (total === 0) return <EmptyState />;
  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={86}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {enriched.map((e, i) => (
                <Cell key={i} fill={e.fill} />
              ))}
            </Pie>
            <Tooltip
              content={(props) => (
                <ChartTooltip
                  {...props}
                  valueFormatter="number"
                  extraLines={(rec) => {
                    const pct = total > 0 ? ((rec.value as number) / total) * 100 : 0;
                    const rev = typeof rec.revenue === "number" ? (rec.revenue as number) : null;
                    const lines = [`${pct.toFixed(1)}% от общего`];
                    if (rev != null)
                      lines.push(`${formatCompactMoney(rev)} выручки`);
                    return lines;
                  }}
                />
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
            Всего
          </div>
          <div className="text-[16px] font-semibold tabular">{formatNumber(total)}</div>
        </div>
      </div>
      <div className="flex-1 space-y-2 text-[12px]">
        {enriched.map((e) => {
          const pct = total > 0 ? (e.value / total) * 100 : 0;
          return (
            <div key={e.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: e.fill }} />
              <span className="flex-1 text-[var(--text-dim)]">{e.name}</span>
              <span className="font-medium tabular text-[var(--text)]">{formatNumber(e.value)}</span>
              <span className="w-12 text-right tabular text-[var(--text-dim)]">
                {formatPercent(pct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 text-[12px] text-[var(--text-dim)]">
      <div className="font-medium text-[var(--text)]">Нет данных за период</div>
    </div>
  );
}
