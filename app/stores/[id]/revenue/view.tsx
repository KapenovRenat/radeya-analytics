"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell, Section } from "@/components/page/page-shell";
import { FilterBar, useFilters } from "@/components/page/filter-bar";
import { KpiStrip, type KpiItem } from "@/components/page/kpi-strip";
import { AiInsightBlock, type Insight } from "@/components/page/ai-insight-block";
import { RecommendationBlock, type Recommendation } from "@/components/page/recommendation-block";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/chart-primitives";
import { useAnalytics } from "@/lib/use-analytics";
import {
  formatCompactMoney,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  DELIVERY_COLORS,
  DELIVERY_LABELS,
  PAYMENT_COLORS,
  PAYMENT_LABELS,
  formatPeriodLabel,
} from "@/lib/kaspi/labels";
import type { Period } from "@/lib/kaspi/aggregates";

interface RevenueData {
  period: Period;
  series: Array<{ period: string; revenue: number; orders: number }>;
  byPayment: Array<{ payment_mode: string | null; revenue: number; orders: number }>;
  byDelivery: Array<{ delivery_mode: string | null; revenue: number; orders: number }>;
  avgSeries: Array<{ period: string; avg_value: number }>;
}

export function RevenueView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { granularity } = useFilters();
  const { data, loading, error } = useAnalytics<RevenueData>(storeId, "revenue");

  // Totals derived from payment breakdown
  const totals = useMemo(() => {
    if (!data) return { revenue: 0, orders: 0 };
    const revenue = data.byPayment.reduce((s, r) => s + r.revenue, 0);
    const orders = data.byPayment.reduce((s, r) => s + r.orders, 0);
    return { revenue, orders };
  }, [data]);

  const avgCheck = totals.orders > 0 ? totals.revenue / totals.orders : 0;

  // Enrich series with payment split for stacked area
  const stackedSeries = useMemo(() => {
    if (!data) return [];
    // Build a per-date bucket from the primary series, split proportionally by payment mode share.
    // Since API returns byPayment as aggregate (not time series), we can only stack by mode if
    // we had per-period breakdown. MVP: show cumulative area per-period + use donut for split.
    return data.series.map((d) => ({
      label: formatPeriodLabel(d.period, granularity),
      revenue: d.revenue,
      orders: d.orders,
    }));
  }, [data, granularity]);

  const kpis: KpiItem[] = [
    {
      label: "Выручка",
      value: formatCompactMoney(totals.revenue),
      hint: formatMoney(totals.revenue),
    },
    {
      label: "Средний чек",
      value: formatCompactMoney(avgCheck),
      hint: "по всем статусам",
    },
    {
      label: "Заказов",
      value: totals.orders.toLocaleString("ru-RU"),
      hint: "учтены все статусы",
    },
  ];

  const topPayment = data?.byPayment.slice().sort((a, b) => b.revenue - a.revenue)[0];
  const creditShare = data && totals.revenue > 0
    ? ((data.byPayment.find((r) => r.payment_mode === "PAY_WITH_CREDIT")?.revenue ?? 0) / totals.revenue) * 100
    : 0;
  const kaspiDeliveryShare = data && totals.revenue > 0
    ? ((data.byDelivery.find((r) => r.delivery_mode?.startsWith("DELIVERY"))?.revenue ?? 0) / totals.revenue) * 100
    : 0;

  const insights: Insight[] = data
    ? [
        topPayment && {
          kind: "observation" as const,
          title: `Топ-канал оплаты: ${PAYMENT_LABELS[topPayment.payment_mode ?? ""] ?? topPayment.payment_mode}`,
          body: `Даёт ${formatCompactMoney(topPayment.revenue)} (${totals.revenue > 0 ? ((topPayment.revenue / totals.revenue) * 100).toFixed(1) : 0}% всей выручки).`,
        },
        creditShare > 50 && {
          kind: "trend" as const,
          title: `Kaspi Kredit — ${creditShare.toFixed(0)}% выручки`,
          body: "Большая доля рассрочки повышает чек, но создаёт зависимость от одобрений банка. Стоит вести второй канал оплаты как страховку.",
        },
        kaspiDeliveryShare > 50 && {
          kind: "observation" as const,
          title: `Kaspi Доставка несёт ${kaspiDeliveryShare.toFixed(0)}% оборота`,
          body: "Логистика сильно завязана на Kaspi. Резервный fallback (свой курьер / пункт самовывоза) полезно держать готовым.",
        },
      ].filter(Boolean) as Insight[]
    : [];

  const recs: Recommendation[] = [
    {
      title: "Сместить миксы в высокомаржинальные SKU",
      body: "Откройте ABC/XYZ — A-категория обычно даёт 80% выручки. Поднимите видимость и допродажи по ним.",
      action: { label: "К ABC/XYZ", href: `/stores/${storeId}/sku` },
    },
    {
      title: "Сравнить чек по каналам оплаты",
      body: "Kaspi Kredit обычно поднимает средний чек на 20-40%. Если разрыв меньше — стоит проверить, не мешает ли UX корзины.",
      action: { label: "К кредиту", href: `/stores/${storeId}/credit` },
    },
  ];

  return (
    <PageShell
      title="Выручка"
      subtitle={`${storeName} · группировка по ${granularity === "daily" ? "дням" : granularity === "weekly" ? "неделям" : "месяцам"}`}
      headline={`Совокупно ${formatCompactMoney(totals.revenue)} выручки за выбранный период, средний чек ${formatCompactMoney(avgCheck)}.`}
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка загрузки: {error}
        </div>
      )}

      <KpiStrip items={kpis} />

        {/* Revenue trend (P0 hero) */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Динамика выручки</CardTitle>
              <CardDescription>
                Потоковый график: видно сезонность, пики, недели роста и провала.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-[280px]">
              {data && stackedSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stackedSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--emerald)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--emerald)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tickFormatter={(v) => formatCompactMoney(v)} tickLine={false} axisLine={false} width={58} />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                      content={(props) => <ChartTooltip {...props} valueFormatter="money" />}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Выручка"
                      stroke="var(--emerald)"
                      strokeWidth={2}
                      fill="url(#revenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : loading ? (
                <div className="h-full animate-pulse rounded-md bg-white/[0.03]" />
              ) : (
                <EmptyState />
              )}
            </div>
          </CardBody>
        </Card>

        {/* 2 Donuts side by side (P1) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownDonut
            title="Способ оплаты"
            description="Предоплата vs Kaspi Kredit — доля в выручке"
            rows={data?.byPayment ?? []}
            loading={loading}
            keyField="payment_mode"
            labels={PAYMENT_LABELS}
            colors={PAYMENT_COLORS}
          />
          <BreakdownDonut
            title="Способ доставки"
            description="Как доставляются заказы и какую долю выручки даёт каждый канал"
            rows={data?.byDelivery ?? []}
            loading={loading}
            keyField="delivery_mode"
            labels={DELIVERY_LABELS}
            colors={DELIVERY_COLORS}
          />
        </div>

        {/* Avg order value trend (P2) */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Средний чек по периодам</CardTitle>
              <CardDescription>
                Рос или падал чек за период. Bar лучше показывает дискретные значения, чем линия.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-[240px]">
              {data && data.avgSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.avgSeries.map((d) => ({
                      label: formatPeriodLabel(d.period, granularity),
                      value: d.avg_value,
                    }))}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tickFormatter={(v) => formatCompactMoney(v)} tickLine={false} axisLine={false} width={58} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      content={(props) => <ChartTooltip {...props} valueFormatter="money" />}
                    />
                    <Bar dataKey="value" name="Средний чек" fill="var(--accent)" radius={[3, 3, 0, 0]} />
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

      {data && <AiInsightBlock insights={insights} isMock={false} />}
      <RecommendationBlock items={recs} />
    </PageShell>
  );
}

function BreakdownDonut({
  title,
  description,
  rows,
  loading,
  keyField,
  labels,
  colors,
}: {
  title: string;
  description: string;
  rows: Array<{ revenue: number; orders: number; [k: string]: unknown }>;
  loading: boolean;
  keyField: string;
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  const enriched = rows
    .filter((r) => (r[keyField] as string | null) != null && r.revenue > 0)
    .map((r) => ({
      key: r[keyField] as string,
      name: labels[r[keyField] as string] ?? (r[keyField] as string),
      value: r.revenue,
      orders: r.orders,
      fill: colors[r[keyField] as string] ?? "#6b7280",
    }));
  const total = enriched.reduce((s, r) => s + r.value, 0);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex items-center gap-6">
          <div className="relative h-[180px] w-[180px] shrink-0">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded-full bg-white/[0.03]" />
            ) : enriched.length > 0 ? (
              <>
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
                          valueFormatter="money"
                          extraLines={(rec) => {
                            const pct = total > 0 ? ((rec.value as number) / total) * 100 : 0;
                            const orders = typeof rec.orders === "number" ? (rec.orders as number) : null;
                            const lines = [`${pct.toFixed(1)}% от общей выручки`];
                            if (orders != null) lines.unshift(`${orders.toLocaleString("ru-RU")} заказов`);
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
                  <div className="text-[16px] font-semibold tabular">{formatCompactMoney(total)}</div>
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-[var(--text-dim)]">
                Нет данных
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 text-[12px]">
            {enriched.map((e) => {
              const pct = total > 0 ? (e.value / total) * 100 : 0;
              return (
                <div key={e.key} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.fill }} />
                  <span className="flex-1 text-[var(--text-dim)]">{e.name}</span>
                  <span className="font-medium tabular text-[var(--text)]">{formatCompactMoney(e.value)}</span>
                  <span className="w-12 text-right tabular text-[var(--text-dim)]">
                    {formatPercent(pct)}
                  </span>
                </div>
              );
            })}
            {enriched.length === 0 && !loading && (
              <div className="text-[var(--text-dim)]">Нет данных</div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-[12px] text-[var(--text-dim)]">
      <div className="font-medium text-[var(--text)]">Нет данных за период</div>
      <div>Измените фильтр или запустите синхронизацию</div>
    </div>
  );
}
