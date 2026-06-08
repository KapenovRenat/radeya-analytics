"use client";

import { PageShell } from "@/components/page/page-shell";
import { FilterBar } from "@/components/page/filter-bar";
import { KpiStrip, type KpiItem } from "@/components/page/kpi-strip";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalytics } from "@/lib/use-analytics";
import { formatCompactMoney, formatMoney, formatNumber } from "@/lib/format";
import { CANCELLATION_REASON_LABELS } from "@/lib/kaspi/labels";

interface ProductRow {
  offer_code: string | null;
  offer_name: string | null;
  category: string | null;
  quantity: number;
  amount: number;
  orders: number;
}

interface ReasonRow {
  reason: string;
  orders: number;
  quantity: number;
  amount: number;
}

interface CancellationsData {
  summary: { orders: number; quantity: number; amount: number };
  products: ProductRow[];
  byReason: ReasonRow[];
}

export function CancellationsView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { data, loading, error } = useAnalytics<CancellationsData>(storeId, "cancellations");

  const summary = data?.summary ?? { orders: 0, quantity: 0, amount: 0 };

  const kpis: KpiItem[] = [
    {
      label: "Сумма товаров",
      value: formatCompactMoney(summary.amount),
      hint: "отменено в пути за период",
    },
    {
      label: "Единиц товара",
      value: formatNumber(summary.quantity),
      hint: "штук в отменённых заказах",
    },
    {
      label: "Заказов",
      value: formatNumber(summary.orders),
      hint: "отменено после выдачи в отгрузку",
    },
  ];

  return (
    <PageShell
      title="Отмены и возвраты"
      subtitle={`${storeName} · отменены клиентом после выдачи в отгрузку`}
      headline={`${formatCompactMoney(summary.amount)} в ${formatNumber(summary.quantity)} ед. товара — заказы, которые клиент отменил уже после того, как они были выданы в отгрузку («отмены в пути»).`}
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка: {error}
        </div>
      )}

      <KpiStrip items={kpis} />

      {/* Reason breakdown */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Причины отмены</CardTitle>
            <CardDescription>
              Кто и как инициировал отмену уже выданного в отгрузку заказа
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <ReasonBreakdown rows={data?.byReason ?? []} loading={loading} />
        </CardBody>
      </Card>

      {/* Products table — core deliverable */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Товары, отменённые в пути</CardTitle>
            <CardDescription>
              Сумма и количество по каждому SKU. Сортировка по сумме.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <ProductsTable rows={data?.products ?? []} loading={loading} />
        </CardBody>
      </Card>
    </PageShell>
  );
}

function ReasonBreakdown({ rows, loading }: { rows: ReasonRow[]; loading: boolean }) {
  if (loading) {
    return <div className="h-16 animate-pulse rounded-md bg-white/[0.03]" />;
  }
  if (rows.length === 0) return <EmptyState />;
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0;
        return (
          <div key={r.reason} className="flex items-center gap-3 text-[12px]">
            <div className="w-44 truncate text-[var(--text)]">
              {CANCELLATION_REASON_LABELS[r.reason] ?? r.reason}
            </div>
            <div className="flex-1">
              <div className="h-5 rounded-sm bg-white/[0.03]">
                <div
                  className="h-full rounded-sm bg-[var(--red)]/60"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
            <div className="w-20 text-right text-[var(--text-dim)] tabular">
              {formatNumber(r.orders)} зак.
            </div>
            <div className="w-16 text-right text-[var(--text-dim)] tabular">
              {formatNumber(r.quantity)} ед.
            </div>
            <div className="w-24 text-right font-medium tabular">{formatCompactMoney(r.amount)}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProductsTable({ rows, loading }: { rows: ProductRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded bg-white/[0.03]" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState />;

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-subtle)]">
            <th className="px-2 py-2 text-left font-medium">Товар</th>
            <th className="px-2 py-2 text-left font-medium">Категория</th>
            <th className="px-2 py-2 text-right font-medium">Заказов</th>
            <th className="px-2 py-2 text-right font-medium">Кол-во</th>
            <th className="px-2 py-2 text-right font-medium">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.offer_code ?? i}
              className="border-b border-[var(--border)]/50 hover:bg-white/[0.02]"
            >
              <td className="px-2 py-2">
                <div className="font-medium text-[var(--text)]">{r.offer_name ?? "—"}</div>
                {r.offer_code && (
                  <div className="text-[10px] text-[var(--text-subtle)] tabular">{r.offer_code}</div>
                )}
              </td>
              <td className="px-2 py-2 text-[var(--text-dim)]">{r.category ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular text-[var(--text-dim)]">
                {formatNumber(r.orders)}
              </td>
              <td className="px-2 py-2 text-right tabular text-[var(--text)]">
                {formatNumber(r.quantity)}
              </td>
              <td className="px-2 py-2 text-right font-medium tabular">{formatMoney(r.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[var(--border-strong)] font-semibold">
            <td className="px-2 py-2 text-[var(--text)]" colSpan={2}>
              Итого · {formatNumber(rows.length)} SKU
            </td>
            <td className="px-2 py-2 text-right tabular">{formatNumber(totalOrders)}</td>
            <td className="px-2 py-2 text-right tabular">{formatNumber(totalQty)}</td>
            <td className="px-2 py-2 text-right tabular">{formatMoney(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 text-[12px] text-[var(--text-dim)]">
      <div className="font-medium text-[var(--text)]">Нет отмен в пути за период</div>
      <div>Попробуйте расширить диапазон дат в фильтре выше.</div>
    </div>
  );
}
