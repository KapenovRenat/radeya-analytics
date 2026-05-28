"use client";

import { useMemo, useState } from "react";
import { Download, RefreshCw, Package, BookOpen, ChevronDown } from "lucide-react";
import { PageShell } from "@/components/page/page-shell";
import { FilterBar } from "@/components/page/filter-bar";
import { KpiStrip, type KpiItem } from "@/components/page/kpi-strip";
import { AiInsightBlock, type Insight } from "@/components/page/ai-insight-block";
import { RecommendationBlock, type Recommendation } from "@/components/page/recommendation-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalytics } from "@/lib/use-analytics";
import { useEntriesSync } from "@/lib/use-entries-sync";
import { cn } from "@/lib/utils";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";

// ABC-XYZ specific types (match server response)
interface SkuRow {
  offer_code: string;
  offer_name: string;
  category: string | null;
  units_sold: number;
  orders: number;
  revenue: number;
  avg_price: number;
  first_sale: string;
  last_sale: string;
  weeks_active: number;
  weekly_mean: number;
  weekly_stdev: number;
  cv: number;
  abc: "A" | "B" | "C";
  xyz: "X" | "Y" | "Z";
  revenue_share_pct: number;
  cumulative_share_pct: number;
}

interface MatrixCell {
  abc: "A" | "B" | "C";
  xyz: "X" | "Y" | "Z";
  sku_count: number;
  revenue: number;
  units: number;
}

interface SkuData {
  from: string;
  to: string;
  summary: {
    total_sku: number;
    total_revenue: number;
    total_units: number;
    matrix: MatrixCell[];
    abc_totals: Array<{ abc: "A" | "B" | "C"; sku_count: number; revenue: number; share_pct: number }>;
    xyz_totals: Array<{ xyz: "X" | "Y" | "Z"; sku_count: number; revenue: number; share_pct: number }>;
    top_categories: Array<{ category: string; sku_count: number; revenue: number }>;
  };
  skus: SkuRow[];
  truncated: boolean;
  total_skus: number;
}

const CELL_GUIDANCE: Record<string, { label: string; tone: "emerald" | "amber" | "red" | "blue" | "violet" | "default" }> = {
  AX: { label: "Cash cows · поддерживать сток", tone: "emerald" },
  AY: { label: "Валютные, но сезонные", tone: "emerald" },
  AZ: { label: "Risky stars · буферный сток", tone: "amber" },
  BX: { label: "Системный reorder", tone: "blue" },
  BY: { label: "Стандарт", tone: "blue" },
  BZ: { label: "Watch list", tone: "amber" },
  CX: { label: "Автоматизировать", tone: "default" },
  CY: { label: "Пересмотреть необходимость", tone: "amber" },
  CZ: { label: "Dead stock · снять с ассортимента", tone: "red" },
};

type Filter = "all" | "A" | "B" | "C" | "X" | "Y" | "Z" | `${"A" | "B" | "C"}${"X" | "Y" | "Z"}`;

export function SkuView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const { data, loading, error } = useAnalytics<SkuData>(storeId, "sku");
  const { status: entriesStatus, start: startEntriesSync, running: entriesRunning } = useEntriesSync(storeId);
  const [filter, setFilter] = useState<Filter>("all");

  const filteredSkus = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data.skus;
    if (filter.length === 1) {
      return data.skus.filter((s) => s.abc === filter || s.xyz === filter);
    }
    return data.skus.filter((s) => s.abc === filter[0] && s.xyz === filter[1]);
  }, [data, filter]);

  const entriesReady = entriesStatus?.status === "done" && (entriesStatus?.entriesSynced ?? 0) > 0;
  const needEntriesSync = (entriesStatus?.totalOrders ?? 0) > (entriesStatus?.ordersProcessed ?? 0);

  function exportCsv() {
    if (!data) return;
    const header = [
      "SKU",
      "Название",
      "Категория",
      "Продано шт",
      "Заказов",
      "Выручка",
      "Средняя цена",
      "Недель активности",
      "CV %",
      "ABC",
      "XYZ",
      "Доля в выручке %",
    ];
    const lines = [header.join(";")];
    for (const s of data.skus) {
      lines.push(
        [
          s.offer_code,
          `"${(s.offer_name ?? "").replace(/"/g, '""')}"`,
          `"${(s.category ?? "").replace(/"/g, '""')}"`,
          s.units_sold,
          s.orders,
          Math.round(s.revenue),
          Math.round(s.avg_price),
          s.weeks_active,
          s.cv.toFixed(1),
          s.abc,
          s.xyz,
          s.revenue_share_pct.toFixed(2),
        ].join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abc-xyz-${storeId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const aShare = data?.summary.abc_totals.find((t) => t.abc === "A");
  const czCount = data?.summary.matrix.find((c) => c.abc === "C" && c.xyz === "Z")?.sku_count ?? 0;
  const axCount = data?.summary.matrix.find((c) => c.abc === "A" && c.xyz === "X")?.sku_count ?? 0;
  const azCount = data?.summary.matrix.find((c) => c.abc === "A" && c.xyz === "Z")?.sku_count ?? 0;
  const topCategory = data?.summary.top_categories[0];

  const kpis: KpiItem[] = [
    { label: "Всего SKU", value: formatNumber(data?.summary.total_sku ?? 0), hint: "с продажами за период" },
    {
      label: "A-класс выручка",
      value: formatPercent(aShare?.share_pct ?? 0),
      hint: `${aShare?.sku_count ?? 0} SKU`,
      tone: "success",
    },
    {
      label: "CZ риск",
      value: formatNumber(czCount),
      hint: "dead-stock кандидаты",
      tone: czCount > 0 ? "warning" : "default",
    },
    { label: "Всего продано", value: formatNumber(data?.summary.total_units ?? 0), hint: "единиц" },
  ];

  const insights: Insight[] = data
    ? [
        aShare && {
          kind: "observation" as const,
          title: `A-класс — ${aShare.sku_count} SKU генерят ${aShare.share_pct.toFixed(0)}% выручки`,
          body: "Классика Парето. Эти SKU — приоритет №1 на сток, видимость карточки и контроль остатков.",
        },
        axCount > 0 && {
          kind: "trend" as const,
          title: `Cash cows (AX): ${axCount} SKU`,
          body: "Стабильно высокая выручка, низкая вариативность. Должны быть на максимальной видимости и никогда не уходить в out-of-stock.",
        },
        azCount > 0 && {
          kind: "anomaly" as const,
          title: `Risky stars (AZ): ${azCount} SKU`,
          body: "Высокая выручка, но непредсказуемый спрос. Держите буферный сток, чтобы не упустить пиковые недели.",
        },
        czCount > 0 && {
          kind: "anomaly" as const,
          title: `Dead-stock кандидаты (CZ): ${czCount} SKU`,
          body: "Низкая выручка + эрратичный спрос. Кандидаты к выводу из ассортимента или закрытию-распродаже.",
        },
        topCategory && {
          kind: "observation" as const,
          title: `Топ-категория: ${topCategory.category}`,
          body: `${topCategory.sku_count} SKU, ${formatCompactMoney(topCategory.revenue)} выручки. Стоит расширять глубину линейки в этой категории.`,
        },
      ].filter(Boolean) as Insight[]
    : [];

  const recs: Recommendation[] = [
    {
      title: "Защитить AX-cash-cows от out-of-stock",
      body: "Поставьте alerts на остатки этих SKU. Один день без товара — потерянная выручка.",
    },
    czCount > 0 && {
      title: `Вывести ${czCount} CZ-SKU из ассортимента`,
      body: "Списать в распродажу или вывести из карточек. Эти позиции занимают слот в выдаче и не приносят выручки.",
    },
    {
      title: "Расширить топ-категорию",
      body: "В категории с самой высокой выручкой — глубже линейка / больше вариантов = пропорционально больше выручки при том же трафике.",
      action: { label: "К доставке", href: `/stores/${storeId}/delivery` },
    },
  ].filter(Boolean) as Recommendation[];

  return (
    <PageShell
      title="SKU · ABC / XYZ"
      subtitle={`${storeName} · ассортиментная матрица`}
      headline={
        data
          ? `${formatNumber(data.summary.total_sku)} SKU дают ${formatCompactMoney(data.summary.total_revenue)} выручки · ${aShare?.sku_count ?? 0} SKU класса A несут ${formatPercent(aShare?.share_pct ?? 0)} оборота.`
          : "Загрузка ассортиментной аналитики…"
      }
    >
      <FilterBar />

      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[12px] text-[var(--red)]">
          Ошибка: {error}
        </div>
      )}

        <AbcXyzExplainer />


        {/* Entries sync banner */}
        {(!entriesReady || needEntriesSync) && (
          <Card className="border-[var(--amber)]/30 bg-[var(--amber-soft)]/40 p-4">
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]" />
              <div className="flex-1 text-[12px]">
                <div className="font-medium text-[var(--text)]">Нужна синхронизация позиций заказа</div>
                <div className="mt-0.5 text-[var(--text-dim)]">
                  Kaspi API возвращает SKU отдельным endpoint. Для ABC/XYZ нужно подгрузить позиции
                  по каждому заказу ({formatNumber(entriesStatus?.totalOrders ?? 0)} заказов).
                  Обработано: {formatNumber(entriesStatus?.ordersProcessed ?? 0)}.
                </div>
                {entriesStatus?.status === "running" && (
                  <div className="mt-2">
                    <div className="mb-1 flex justify-between text-[11px] tabular">
                      <span className="text-[var(--text-dim)]">
                        {formatNumber(entriesStatus.ordersProcessed)} /{" "}
                        {formatNumber(entriesStatus.totalOrders)} заказов ·{" "}
                        {formatNumber(entriesStatus.entriesSynced)} SKU-строк
                      </span>
                      <span className="font-semibold">
                        {(entriesStatus.progress * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full bg-[var(--amber)] transition-all"
                        style={{ width: `${entriesStatus.progress * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <Button variant="primary" onClick={startEntriesSync} disabled={entriesRunning} size="sm">
                <RefreshCw className={cn("h-3.5 w-3.5", entriesRunning && "animate-spin")} />
                {entriesRunning ? "Идёт…" : "Запустить"}
              </Button>
            </div>
          </Card>
        )}

        <KpiStrip items={kpis} />

        {/* ABC × XYZ matrix */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Матрица ABC × XYZ</CardTitle>
              <CardDescription>
                9 сегментов: A/B/C — доля в выручке (Парето 80/15/5), X/Y/Z — стабильность спроса (CV &lt; 10% / 10–25% / &gt; 25%). Кликните ячейку чтобы отфильтровать список ниже.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <AbcXyzMatrix
              matrix={data?.summary.matrix ?? []}
              totalRevenue={data?.summary.total_revenue ?? 0}
              selected={filter}
              onSelect={setFilter}
              loading={loading}
            />
          </CardBody>
        </Card>

        {/* Marginal totals */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Разрез ABC</CardTitle>
                <CardDescription>Парето-классификация по выручке</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <MarginalBar rows={data?.summary.abc_totals ?? []} keyField="abc" loading={loading} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Разрез XYZ</CardTitle>
                <CardDescription>Стабильность недельного спроса</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <MarginalBar rows={data?.summary.xyz_totals ?? []} keyField="xyz" loading={loading} />
            </CardBody>
          </Card>
        </div>

        {/* Top categories */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Топ категорий</CardTitle>
              <CardDescription>По выручке за период</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <CategoryList rows={data?.summary.top_categories ?? []} loading={loading} />
          </CardBody>
        </Card>

        {/* SKU table with filter + export */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>
                SKU{" "}
                {filter !== "all" && (
                  <span className="ml-2 text-[11px] font-normal text-[var(--text-dim)]">
                    фильтр: {filter}
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {formatNumber(filteredSkus.length)} / {formatNumber(data?.total_skus ?? 0)} SKU
                {data?.truncated && " (показаны топ 500)"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {filter !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setFilter("all")}>
                  Сбросить
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardBody>
            <SkuTable rows={filteredSkus} loading={loading} />
          </CardBody>
        </Card>

      {data && <AiInsightBlock insights={insights} isMock={false} />}
      {data && <RecommendationBlock items={recs} />}
    </PageShell>
  );
}

function AbcXyzExplainer() {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Как читать этот отчёт</CardTitle>
          <CardDescription>
            ABC-XYZ — классический инструмент управления ассортиментом. Две оси · девять ячеек · каждая
            диктует свою стратегию работы с товарами.
          </CardDescription>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          {open ? "Скрыть ▲" : "Показать ▼"}
        </button>
      </CardHeader>
      {open && (
        <CardBody className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* ABC */}
            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--emerald-soft)] text-[10px] font-bold text-[var(--emerald)]">
                  A
                </span>
                <span className="text-[12px] font-semibold">ABC — классификация по выручке</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">
                Принцип Парето: небольшая часть товаров даёт большую часть выручки.
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 font-semibold text-[var(--emerald)]">A</span>
                  <span className="text-[var(--text-dim)]">
                    топ-<span className="text-[var(--text)]">80%</span> кумулятивной выручки · ~20% SKU
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 font-semibold text-[var(--blue)]">B</span>
                  <span className="text-[var(--text-dim)]">
                    следующие <span className="text-[var(--text)]">15%</span> · ~30% SKU
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 font-semibold text-[var(--red)]">C</span>
                  <span className="text-[var(--text-dim)]">
                    последние <span className="text-[var(--text)]">5%</span> · ~50% SKU — длинный хвост
                  </span>
                </div>
              </div>
            </div>

            {/* XYZ */}
            <div className="space-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--emerald-soft)] text-[10px] font-bold text-[var(--emerald)]">
                  X
                </span>
                <span className="text-[12px] font-semibold">XYZ — стабильность спроса</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">
                Коэффициент вариации (CV) недельной выручки — насколько продажи предсказуемы.
              </p>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 font-semibold text-[var(--emerald)]">X</span>
                  <span className="text-[var(--text-dim)]">
                    CV &lt; <span className="text-[var(--text)]">10%</span> · стабильно, предсказуемо
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 font-semibold text-[var(--amber)]">Y</span>
                  <span className="text-[var(--text-dim)]">
                    CV <span className="text-[var(--text)]">10–25%</span> · сезонно, вариативно
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 font-semibold text-[var(--red)]">Z</span>
                  <span className="text-[var(--text-dim)]">
                    CV &gt; <span className="text-[var(--text)]">25%</span> · эрратично, трудно прогнозировать
                  </span>
                </div>
              </div>
              <div className="pt-1 text-[10px] italic text-[var(--text-subtle)]">
                SKU с &lt; 3 недель продаж автоматически = Z (недостаточно данных для классификации).
              </div>
            </div>
          </div>

          {/* Matrix guidance */}
          <div>
            <div className="mb-2 text-[11px] font-medium text-[var(--text-dim)]">
              Что делать в каждой ячейке:
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <CellHint
                code="AX"
                tone="emerald"
                label="Cash cows"
                hint="Главные деньги + предсказуемо. Никогда не допускать стокаутов, инвестировать в позиционирование."
              />
              <CellHint
                code="AY"
                tone="emerald"
                label="Сезонные лидеры"
                hint="Высокая выручка, но сезонность. Календарь запасов по сезонам."
              />
              <CellHint
                code="AZ"
                tone="amber"
                label="Risky stars"
                hint="Большие деньги + непредсказуемый спрос. Увеличенный страховой запас."
              />
              <CellHint
                code="BX"
                tone="blue"
                label="Backbone"
                hint="Автоматический reorder по правилам. Основа ассортимента."
              />
              <CellHint code="BY" tone="blue" label="Стандарт" hint="Стандартное управление, пересмотр раз в квартал." />
              <CellHint
                code="BZ"
                tone="amber"
                label="Watch list"
                hint="Возможно заменить более стабильной альтернативой. Мониторить тренд."
              />
              <CellHint
                code="CX"
                tone="default"
                label="Long tail"
                hint="Предсказуемо, но приносит мало. Автоматизировать, минимизировать затраты на управление."
              />
              <CellHint
                code="CY"
                tone="amber"
                label="Маргинальные"
                hint="Проверить: окупается ли работа с ними? Часто кандидаты на отказ."
              />
              <CellHint
                code="CZ"
                tone="red"
                label="Dead stock"
                hint="Мало денег + непредсказуемо. Снимать с ассортимента или распродавать."
              />
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-3 text-[11px] text-[var(--text-dim)]">
            <strong className="text-[var(--text)]">Как работать:</strong> начните с AX / AZ — это 80%
            выручки, на них сфокусировано управление. Затем CZ — чистка ассортимента. Кликните ячейку в
            матрице ниже, чтобы отфильтровать список SKU и выгрузить в CSV для анализа.
          </div>
        </CardBody>
      )}
    </Card>
  );
}

function CellHint({
  code,
  tone,
  label,
  hint,
}: {
  code: string;
  tone: "emerald" | "amber" | "red" | "blue" | "default";
  label: string;
  hint: string;
}) {
  const toneClass = {
    emerald: "border-[var(--emerald)]/30 bg-[var(--emerald-soft)]/40",
    amber: "border-[var(--amber)]/30 bg-[var(--amber-soft)]/40",
    red: "border-[var(--red)]/30 bg-[var(--red-soft)]/40",
    blue: "border-[var(--blue)]/30 bg-[var(--blue-soft)]/40",
    default: "border-[var(--border)] bg-white/[0.02]",
  }[tone];
  return (
    <div className={cn("rounded-[var(--radius-sm)] border p-2", toneClass)}>
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="mono font-bold text-[var(--text)]">{code}</span>
        <span className="text-[var(--text-dim)]">· {label}</span>
      </div>
      <div className="leading-snug text-[var(--text-subtle)]">{hint}</div>
    </div>
  );
}

function AbcXyzMatrix({
  matrix,
  totalRevenue,
  selected,
  onSelect,
  loading,
}: {
  matrix: MatrixCell[];
  totalRevenue: number;
  selected: Filter;
  onSelect: (f: Filter) => void;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-[280px] animate-pulse rounded-[var(--radius)] bg-white/[0.03]" />;
  }
  const byKey = new Map(matrix.map((c) => [`${c.abc}${c.xyz}`, c]));
  const maxRevenue = Math.max(...matrix.map((c) => c.revenue), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-[12px]">
        <thead>
          <tr>
            <th className="w-12" />
            {(["X", "Y", "Z"] as const).map((x) => (
              <th
                key={x}
                className="cursor-pointer rounded-[var(--radius-sm)] px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] hover:text-[var(--text)]"
                onClick={() => onSelect(selected === x ? "all" : x)}
              >
                {x} — {x === "X" ? "стабильный" : x === "Y" ? "переменный" : "эрратичный"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["A", "B", "C"] as const).map((a) => (
            <tr key={a}>
              <td
                className="cursor-pointer rounded-[var(--radius-sm)] px-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] hover:text-[var(--text)]"
                onClick={() => onSelect(selected === a ? "all" : a)}
              >
                {a}
              </td>
              {(["X", "Y", "Z"] as const).map((x) => {
                const cell = byKey.get(`${a}${x}`);
                const key = `${a}${x}`;
                const guidance = CELL_GUIDANCE[key];
                const share = totalRevenue > 0 ? ((cell?.revenue ?? 0) / totalRevenue) * 100 : 0;
                const bgOpacity = cell && cell.revenue > 0 ? 0.15 + (cell.revenue / maxRevenue) * 0.35 : 0.02;
                const active = selected === key;
                const toneBg: Record<string, string> = {
                  emerald: "var(--emerald)",
                  amber: "var(--amber)",
                  red: "var(--red)",
                  blue: "var(--blue)",
                  violet: "var(--violet)",
                  default: "rgba(255,255,255,0.3)",
                };
                return (
                  <td
                    key={x}
                    className={cn(
                      "relative cursor-pointer rounded-[var(--radius)] border p-3 transition-all min-w-[180px]",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--accent)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]",
                    )}
                    style={{
                      backgroundColor: active
                        ? undefined
                        : `rgba(${toneBg[guidance.tone]
                            .replace("var(--", "")
                            .replace(")", "")
                            .split("")
                            .join("")},${bgOpacity})`,
                      background: active
                        ? undefined
                        : `color-mix(in oklab, ${toneBg[guidance.tone]} ${(bgOpacity * 100).toFixed(0)}%, transparent)`,
                    }}
                    onClick={() => onSelect(active ? "all" : (key as Filter))}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[var(--text)]">{key}</span>
                      <Badge tone={guidance.tone}>{cell?.sku_count ?? 0}</Badge>
                    </div>
                    <div className="text-[14px] font-semibold tabular text-[var(--text)]">
                      {formatCompactMoney(cell?.revenue ?? 0)}
                    </div>
                    <div className="mt-0.5 text-[10px] tabular text-[var(--text-dim)]">
                      {formatPercent(share)} · {formatNumber(cell?.units ?? 0)} шт
                    </div>
                    <div className="mt-1 text-[10px] leading-tight text-[var(--text-subtle)]">
                      {guidance.label}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarginalBar({
  rows,
  keyField,
  loading,
}: {
  rows: Array<{ sku_count: number; revenue: number; share_pct: number } & Record<string, unknown>>;
  keyField: "abc" | "xyz";
  loading: boolean;
}) {
  if (loading) return <div className="h-[140px] animate-pulse rounded-md bg-white/[0.03]" />;
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const label = r[keyField] as string;
        const total = rows.reduce((s, x) => s + x.revenue, 0);
        const pct = total > 0 ? (r.revenue / total) * 100 : 0;
        return (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-[0.06em] text-[var(--text)]">{label}</span>
                <span className="text-[var(--text-dim)]">{r.sku_count} SKU</span>
              </span>
              <span className="font-medium tabular">{formatCompactMoney(r.revenue)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-0.5 text-right text-[10px] text-[var(--text-dim)] tabular">
              {formatPercent(pct)} от общей выручки
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryList({
  rows,
  loading,
}: {
  rows: Array<{ category: string; sku_count: number; revenue: number }>;
  loading: boolean;
}) {
  if (loading) return <div className="h-[140px] animate-pulse rounded-md bg-white/[0.03]" />;
  if (rows.length === 0)
    return <div className="text-[12px] text-[var(--text-dim)]">Нет данных</div>;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.category} className="flex items-center gap-3 text-[12px]">
          <div className="w-48 truncate text-[var(--text)]">{r.category}</div>
          <div className="flex-1">
            <div className="h-5 rounded-sm bg-white/[0.03]">
              <div
                className="h-full rounded-sm bg-[var(--accent)]/70"
                style={{ width: `${(r.revenue / max) * 100}%` }}
              />
            </div>
          </div>
          <div className="w-14 text-right text-[var(--text-dim)] tabular">{formatNumber(r.sku_count)}</div>
          <div className="w-24 text-right font-medium tabular">{formatCompactMoney(r.revenue)}</div>
        </div>
      ))}
    </div>
  );
}

function SkuTable({ rows, loading }: { rows: SkuRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-white/[0.03]" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-[12px] text-[var(--text-dim)]">
        Нет данных. Возможно нужно запустить синхронизацию позиций (баннер выше).
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px] tabular">
        <thead>
          <tr className="bg-[var(--bg-subtle)] text-left text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Название</th>
            <th className="px-3 py-2">Категория</th>
            <th className="px-3 py-2 text-right">Шт</th>
            <th className="px-3 py-2 text-right">Выручка</th>
            <th className="px-3 py-2 text-right">Доля</th>
            <th className="px-3 py-2 text-right">CV %</th>
            <th className="px-3 py-2 text-center">Класс</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((s) => (
            <tr key={s.offer_code} className="border-t border-[var(--border)] hover:bg-white/[0.02]">
              <td className="mono px-3 py-2 text-[var(--text-dim)]">{s.offer_code}</td>
              <td className="px-3 py-2 font-medium text-[var(--text)] max-w-xs truncate" title={s.offer_name}>
                {s.offer_name}
              </td>
              <td className="px-3 py-2 text-[var(--text-dim)] max-w-[180px] truncate" title={s.category ?? ""}>
                {s.category ?? "—"}
              </td>
              <td className="px-3 py-2 text-right">{formatNumber(s.units_sold)}</td>
              <td className="px-3 py-2 text-right font-medium">{formatMoney(s.revenue)}</td>
              <td className="px-3 py-2 text-right text-[var(--text-dim)]">
                {s.revenue_share_pct.toFixed(2)}%
              </td>
              <td className="px-3 py-2 text-right text-[var(--text-dim)]">{s.cv.toFixed(0)}%</td>
              <td className="px-3 py-2 text-center">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold tabular">
                  <span className={s.abc === "A" ? "text-[var(--emerald)]" : s.abc === "B" ? "text-[var(--blue)]" : "text-[var(--red)]"}>
                    {s.abc}
                  </span>
                  <span className="text-[var(--text-subtle)]">·</span>
                  <span className={s.xyz === "X" ? "text-[var(--emerald)]" : s.xyz === "Y" ? "text-[var(--amber)]" : "text-[var(--red)]"}>
                    {s.xyz}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 && (
        <div className="mt-2 text-center text-[11px] text-[var(--text-dim)]">
          Показано 100 из {formatNumber(rows.length)}. Для полной выгрузки — кнопка CSV выше.
        </div>
      )}
    </div>
  );
}
