"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Lightbulb } from "lucide-react";
import { PageShell } from "@/components/page/page-shell";
import { FilterBar } from "@/components/page/filter-bar";
import { KpiStrip, type KpiItem } from "@/components/page/kpi-strip";
import { AiInsightBlock, type Insight } from "@/components/page/ai-insight-block";
import { RecommendationBlock, type Recommendation } from "@/components/page/recommendation-block";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltip } from "@/components/chart-primitives";
import { useAnalytics } from "@/lib/use-analytics";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { PAYMENT_COLORS, PAYMENT_LABELS } from "@/lib/kaspi/labels";
import type { Period } from "@/lib/kaspi/aggregates";

interface CreditData {
  period: Period;
  split: Array<{ payment_mode: string | null; orders: number; revenue: number; avg_check: number }>;
  byTerm: Array<{ credit_term: number | null; orders: number; revenue: number; avg_check: number }>;
}

export function CreditView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { data, loading, error } = useAnalytics<CreditData>(storeId, "credit");

  const totals = useMemo(() => {
    if (!data) return { revenue: 0, creditRevenue: 0, prepaidAvg: 0, creditAvg: 0 };
    const revenue = data.split.reduce((s, r) => s + r.revenue, 0);
    const credit = data.split.find((r) => r.payment_mode === "PAY_WITH_CREDIT");
    const prepaid = data.split.find((r) => r.payment_mode === "PREPAID");
    return {
      revenue,
      creditRevenue: credit?.revenue ?? 0,
      prepaidAvg: prepaid?.avg_check ?? 0,
      creditAvg: credit?.avg_check ?? 0,
    };
  }, [data]);

  const creditSharePct = totals.revenue > 0 ? (totals.creditRevenue / totals.revenue) * 100 : 0;
  const avgDiff = totals.prepaidAvg > 0
    ? ((totals.creditAvg - totals.prepaidAvg) / totals.prepaidAvg) * 100
    : 0;

  const topTerm = useMemo(() => {
    if (!data) return null;
    const sorted = [...data.byTerm].filter((b) => b.credit_term != null).sort((a, b) => b.orders - a.orders);
    return sorted[0] ?? null;
  }, [data]);

  const kpis: KpiItem[] = [
    {
      label: "Доля Kaspi Kredit",
      value: formatPercent(creditSharePct),
      hint: formatCompactMoney(totals.creditRevenue),
    },
    {
      label: "Ср. чек Kredit vs Предоплата",
      value: formatPercent(avgDiff),
      hint: `${formatMoney(Math.round(totals.creditAvg))} vs ${formatMoney(Math.round(totals.prepaidAvg))}`,
      tone: avgDiff >= 20 ? "success" : "default",
    },
    {
      label: "Популярный срок",
      value: topTerm ? `${topTerm.credit_term} мес` : "—",
      hint: topTerm ? `${formatNumber(topTerm.orders)} заказов` : undefined,
    },
  ];

  const insights: Insight[] = data
    ? [
        creditSharePct > 50 && {
          kind: "trend" as const,
          title: `Kaspi Kredit — ${creditSharePct.toFixed(0)}% выручки`,
          body: "Половина и больше идёт через рассрочку. Это типично для электроники/мебели. Стоит мониторить процент одобрений банком, чтобы не упускать сделки.",
        },
        avgDiff > 20 && {
          kind: "trend" as const,
          title: `Чек в рассрочку на ${avgDiff.toFixed(0)}% выше`,
          body: "Покупатели готовы брать дороже под рассрочку. Премиум-ассортимент 50 000₸+ — потенциальный рост среднего чека.",
        },
        topTerm && {
          kind: "observation" as const,
          title: `Самый частый срок — ${topTerm.credit_term} месяцев`,
          body: `${formatNumber(topTerm.orders)} заказов на этом сроке. Имеет смысл подсвечивать его в карточке как «рекомендуемый».`,
        },
      ].filter(Boolean) as Insight[]
    : [];

  const recs: Recommendation[] = [
    {
      title: "Подсветить рекомендуемый срок",
      body: "Указать в карточке «рассрочка 12 мес — без удорожания» чётко в первом экране. Снимает фрикцию.",
    },
    {
      title: "Изучить премиум-сегмент",
      body: "Если разрыв чека Kredit/Предоплата большой — есть рост в дорогих SKU. Смотрите ABC/XYZ для кандидатов.",
      action: { label: "К ABC/XYZ", href: `/stores/${storeId}/sku` },
    },
  ];

  return (
    <PageShell
      title="Kaspi Kredit"
      subtitle={`${storeName} · оплата в рассрочку`}
      headline={`${formatPercent(creditSharePct)} выручки идёт через Kaspi Kredit · средний чек ${avgDiff >= 0 ? "+" : ""}${avgDiff.toFixed(0)}% к предоплате.`}
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка: {error}
        </div>
      )}

      <KpiStrip items={kpis} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Предоплата vs Kaspi Kredit</CardTitle>
                <CardDescription>Доля в выручке за период</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <SplitDonut rows={data?.split ?? []} loading={loading} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Заказы по срокам рассрочки</CardTitle>
                <CardDescription>Длиннее срок = обычно дороже товар</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <div className="h-[260px]">
                {data && data.byTerm.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.byTerm
                        .filter((b) => b.credit_term != null)
                        .map((b) => ({
                          label: `${b.credit_term} мес`,
                          orders: b.orders,
                          avg_check: b.avg_check,
                        }))}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="2 4" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(v) => formatNumber(v)} tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        content={(props) => <ChartTooltip {...props} valueFormatter="number" />}
                      />
                      <Bar dataKey="orders" name="Заказов" fill="var(--violet)" radius={[3, 3, 0, 0]} />
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

        {avgDiff > 20 && (
          <Card className="border-[var(--amber)]/30 bg-[var(--amber-soft)]/50 p-4">
            <div className="flex items-start gap-2.5 text-[12px]">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]" />
              <div>
                <div className="font-medium text-[var(--text)]">Ваш сегмент готов к премиуму</div>
                <div className="mt-1 text-[var(--text-dim)]">
                  Средний чек Kaspi Kredit на {formatPercent(avgDiff)} выше предоплаты —
                  покупатели охотно берут рассрочку на более дорогие товары. Попробуйте расширить
                  ассортимент в премиум-сегменте 50 000+ ₸.
                </div>
              </div>
            </div>
          </Card>
        )}

      {data && <AiInsightBlock insights={insights} isMock={false} />}
      <RecommendationBlock items={recs} />
    </PageShell>
  );
}

function SplitDonut({
  rows,
  loading,
}: {
  rows: Array<{ payment_mode: string | null; orders: number; revenue: number }>;
  loading: boolean;
}) {
  if (loading) return <div className="h-[180px] animate-pulse rounded-md bg-white/[0.03]" />;
  const enriched = rows
    .filter((r) => r.payment_mode && r.revenue > 0)
    .map((r) => ({
      name: PAYMENT_LABELS[r.payment_mode!] ?? r.payment_mode!,
      value: r.revenue,
      orders: r.orders,
      fill: PAYMENT_COLORS[r.payment_mode!] ?? "#6b7280",
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
      </div>
      <div className="flex-1 space-y-2 text-[12px]">
        {enriched.map((e) => {
          const pct = total > 0 ? (e.value / total) * 100 : 0;
          return (
            <div key={e.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: e.fill }} />
              <span className="flex-1 text-[var(--text-dim)]">{e.name}</span>
              <span className="font-medium tabular text-[var(--text)]">{formatCompactMoney(e.value)}</span>
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
