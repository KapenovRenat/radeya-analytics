"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/kaspi/labels";
import type { Period } from "@/lib/kaspi/aggregates";

interface CustomersData {
  period: Period;
  repeats: { total_customers: number; repeat_customers: number; one_time_customers: number };
  top: Array<{ name: string | null; orders: number; revenue: number; avg_check: number; last_order_date: string }>;
  newReturning: Array<{ period: string; new_customers: number; returning_customers: number }>;
  distribution: Array<{ bucket: string; customers: number }>;
}

export function CustomersView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { granularity } = useFilters();
  const { data, loading, error } = useAnalytics<CustomersData>(storeId, "customers");

  const retentionPct = useMemo(() => {
    if (!data?.repeats.total_customers) return 0;
    return (data.repeats.repeat_customers / data.repeats.total_customers) * 100;
  }, [data]);

  const totalOrders = useMemo(() => {
    if (!data) return 0;
    return data.top.reduce((s, c) => s + c.orders, 0);
  }, [data]);

  const avgOrders =
    data?.repeats.total_customers && data.repeats.total_customers > 0
      ? totalOrders / data.repeats.total_customers
      : 0;

  const topCustomer = data?.top[0];
  const top10Revenue = data?.top.slice(0, 10).reduce((s, c) => s + c.revenue, 0) ?? 0;

  const kpis: KpiItem[] = [
    {
      label: "Клиентов",
      value: formatNumber(data?.repeats.total_customers ?? 0),
      hint: "уникальных",
    },
    {
      label: "Повторных",
      value: formatNumber(data?.repeats.repeat_customers ?? 0),
      hint: `${formatPercent(retentionPct)} retention`,
      tone: retentionPct >= 25 ? "success" : retentionPct >= 15 ? "default" : "warning",
    },
    {
      label: "Разовых",
      value: formatNumber(data?.repeats.one_time_customers ?? 0),
      hint: "купили 1 раз",
    },
    {
      label: "Заказов / клиент",
      value: avgOrders.toFixed(2),
      hint: "в среднем",
    },
  ];

  const insights: Insight[] = data
    ? [
        {
          kind: retentionPct >= 25 ? "trend" : retentionPct >= 15 ? "observation" : "anomaly",
          title: `Retention ${formatPercent(retentionPct)}`,
          body: retentionPct >= 25
            ? "Высокий retention — клиенты возвращаются. Это редкость на Kaspi (обычно 10-20%), сильный актив."
            : retentionPct >= 15
              ? "Retention в норме. Простор для роста — Kaspi Bonus + работа с отзывами."
              : "Retention низкий. Большинство клиентов покупают один раз — стоит изучить кросс-продажи и follow-up.",
        },
        topCustomer && {
          kind: "observation" as const,
          title: `Топ-клиент: ${topCustomer.name ?? "—"}`,
          body: `${formatNumber(topCustomer.orders)} заказов на ${formatCompactMoney(topCustomer.revenue)}. Стоит держать на контроле — большая часть выручки приходит от верха кривой.`,
        },
        top10Revenue > 0 && {
          kind: "trend" as const,
          title: `Топ-10 клиентов = ${formatCompactMoney(top10Revenue)}`,
          body: "Концентрация выручки в небольшой группе — VIP-сегмент. Персональные офферы и отдельный канал коммуникации повышают LTV.",
        },
      ].filter(Boolean) as Insight[]
    : [];

  const recs: Recommendation[] = [
    {
      title: "Активировать «однажды купивших»",
      body: "Большая база разовых — найдите долю по категории и запустите рекомендации «к вашему предыдущему заказу подходит ...».",
    },
    {
      title: "VIP-канал для топ-10",
      body: "Прямая коммуникация (Kaspi-чат, отзыв-фолоу-ап). Один лояльный клиент с 5 покупками выгоднее, чем 5 новых одноразовых.",
    },
    {
      title: "Свериться по географии VIP",
      body: "Где живут топ-клиенты — там стоит точечное локальное промо.",
      action: { label: "К доставке", href: `/stores/${storeId}/delivery` },
    },
  ];

  return (
    <PageShell
      title="Клиенты"
      subtitle={`${storeName} · группировка по ${granularity === "daily" ? "дням" : granularity === "weekly" ? "неделям" : "месяцам"}`}
      headline={`${formatNumber(data?.repeats.total_customers ?? 0)} уникальных клиентов · retention ${formatPercent(retentionPct)}.`}
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка: {error}
        </div>
      )}

      <KpiStrip items={kpis} />

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Новые vs возвращающиеся</CardTitle>
              <CardDescription>
                Grouped bars — видно и привлечение (новые), и удержание (возвращающиеся) отдельно.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-[260px]">
              {data && data.newReturning.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.newReturning.map((d) => ({
                      label: formatPeriodLabel(d.period, granularity),
                      new: d.new_customers,
                      returning: d.returning_customers,
                    }))}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    barGap={4}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="2 4" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={40} />
                    <YAxis tickFormatter={(v) => formatNumber(v)} tickLine={false} axisLine={false} width={32} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      content={(props) => <ChartTooltip {...props} valueFormatter="number" />}
                    />
                    <Bar dataKey="new" name="Новые" fill="var(--blue)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="returning" name="Возвращающиеся" fill="var(--emerald)" radius={[3, 3, 0, 0]} />
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Топ клиентов</CardTitle>
                <CardDescription>Отсортированы по суммарной выручке</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
                <table className="w-full text-[12px] tabular">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                      <th className="px-3 py-2">Клиент</th>
                      <th className="px-3 py-2 text-right">Заказов</th>
                      <th className="px-3 py-2 text-right">Ср. чек</th>
                      <th className="px-3 py-2 text-right">Выручка</th>
                      <th className="px-3 py-2 text-right">Послед.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-dim)]">
                          Загрузка…
                        </td>
                      </tr>
                    ) : !data || data.top.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-dim)]">
                          Нет данных
                        </td>
                      </tr>
                    ) : (
                      data.top.slice(0, 15).map((c, i) => (
                        <tr key={i} className="border-t border-[var(--border)]">
                          <td className="px-3 py-2 font-medium text-[var(--text)]">{c.name ?? "—"}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(c.orders)}</td>
                          <td className="px-3 py-2 text-right text-[var(--text-dim)]">
                            {formatMoney(Math.round(c.avg_check))}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatCompactMoney(c.revenue)}
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--text-dim)]">
                            {new Date(c.last_order_date).toLocaleDateString("ru-RU", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Распределение по заказам</CardTitle>
                <CardDescription>Сколько клиентов купили 1 раз, 2 раза, 3–5, …</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-[260px]">
                {data && data.distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.distribution}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="2 4" />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        content={(props) => <ChartTooltip {...props} valueFormatter="number" />}
                      />
                      <Bar dataKey="customers" name="Клиентов" fill="var(--accent)" radius={[3, 3, 0, 0]} />
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

      {data && <AiInsightBlock insights={insights} isMock={false} />}
      <RecommendationBlock items={recs} />
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 text-[12px] text-[var(--text-dim)]">
      <div className="font-medium text-[var(--text)]">Нет данных за период</div>
    </div>
  );
}
