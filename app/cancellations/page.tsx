import { PageShell, Section } from "@/components/page/page-shell";
import { KpiStrip } from "@/components/page/kpi-strip";
import { AiInsightBlock } from "@/components/page/ai-insight-block";
import { RecommendationBlock } from "@/components/page/recommendation-block";
import { ReportChart } from "@/components/reports/report-chart";
import { MOCK_KPIS_CANCELLATIONS, MOCK_CANCELLATION_REASONS } from "@/lib/mock-data";

export const dynamic = "force-static";

const CANCELLATION_TIMESERIES = [
  { label: "10 мар", value: 8.2 },
  { label: "17 мар", value: 9.8 },
  { label: "24 мар", value: 9.1 },
  { label: "31 мар", value: 10.4 },
  { label: "7 апр", value: 12.1 },
  { label: "14 апр", value: 15.7 },
  { label: "21 апр", value: 18.2 },
  { label: "28 апр", value: 16.9 },
];

const INSIGHTS = [
  {
    kind: "anomaly" as const,
    title: "82% отмен — на 3 SKU",
    body: "ACC-CHRG-AP-USBC (38% отмен), ACC-CABL-USBC-USBC (29%), ACC-MOUSE-MX3S (24%). Все три — от одного поставщика, поставка 14 апреля.",
  },
  {
    kind: "trend" as const,
    title: "Спайк начался 14 апреля",
    body: "До этого momentum держался на 9-10%. Точка перелома совпадает с приёмкой проблемной партии — это одна причина, не общая деградация.",
  },
  {
    kind: "observation" as const,
    title: "77% отмен — качество товара",
    body: "По 247 отзывам: 77% жалоб на брак / несоответствие / подделку. Только 23% «передумал» или проблемы доставки. Это работа с поставкой, не с клиентом.",
  },
];

const RECOMMENDATIONS = [
  {
    title: "Сегодня — снять с витрины 3 SKU",
    body: "ACC-CHRG-AP-USBC, ACC-CABL-USBC-USBC, ACC-MOUSE-MX3S — каждая новая отмена ухудшает рейтинг магазина (-8% видимости на 0.1 пункта).",
  },
  {
    title: "На этой неделе — претензия поставщику X",
    body: "Запросить акт возврата остатка партии. При отказе — комплайнс через Kaspi-партнёр.",
  },
  {
    title: "Через 2 недели — альтернативный поставщик",
    body: "Тестовая партия 20 шт через нового поставщика по тем же SKU. Если <5% отмен — переход на полный объём.",
  },
];

export default function CancellationsPage() {
  return (
    <PageShell
      title="Отмены и возвраты"
      subtitle="Mock-режим · последние 60 дней"
      headline="Доля отмен 16.9% — в 5.5× выше порога Kaspi 3% и в 2× выше марта. 82% всех отмен — на 3 SKU из одной партии. Это локализованная проблема, не деградация магазина."
    >
      <KpiStrip items={MOCK_KPIS_CANCELLATIONS} />

      <Section
        title="Динамика по неделям"
        hint="Спайк начался на неделе 14 апреля — точка приёмки проблемной партии"
      >
        <ReportChart
          kind="area"
          title="Доля отмен по неделям"
          yLabel="%"
          data={CANCELLATION_TIMESERIES}
          format="percent"
          height={280}
          annotations={[{ x: "14 апр", label: "Партия X на складе" }]}
        />
      </Section>

      <Section
        title="Причины отмен · апрельская партия"
        hint="Категоризация по 247 отзывам"
      >
        <ReportChart
          kind="bar"
          title="Распределение причин"
          data={MOCK_CANCELLATION_REASONS.map((r) => ({ label: r.reason, value: r.count }))}
          height={260}
        />
      </Section>

      <AiInsightBlock insights={INSIGHTS} isMock />

      <RecommendationBlock items={RECOMMENDATIONS} />

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[var(--text-subtle)]">
          Полный разбор
        </div>
        <a
          href="/reports/2026-05-02-april-cancellations-spike"
          className="mt-1.5 inline-flex text-[14px] font-semibold text-[var(--accent)] hover:underline"
        >
          → «Апрельский всплеск отмен — расследование»
        </a>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
          Длинный отчёт Claude по этой странице: финансовый эффект, отзывы клиентов, план восстановления на 4 недели.
        </p>
      </div>
    </PageShell>
  );
}
