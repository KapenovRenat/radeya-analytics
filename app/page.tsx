import { redirect } from "next/navigation";
import { PageShell, Section } from "@/components/page/page-shell";
import { KpiStrip } from "@/components/page/kpi-strip";
import { AiInsightBlock } from "@/components/page/ai-insight-block";
import { RecommendationBlock } from "@/components/page/recommendation-block";
import { ReportChart } from "@/components/reports/report-chart";
import { getActiveStore } from "@/lib/active-store";
import {
  MOCK_KPIS_DASHBOARD,
  MOCK_REVENUE_TIMESERIES,
  MOCK_INSIGHTS_DASHBOARD,
  MOCK_RECOMMENDATIONS_DASHBOARD,
} from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // If user has a connected Kaspi store — go straight to their real dashboard.
  // The mock-data demo below is only shown to fresh installs before any sync.
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/dashboard`);

  return (
    <PageShell
      title="Дашборд"
      subtitle="Мок-демо · 1 342 заказа · 30 дней · все цифры синтетические"
      headline="Выручка ₸ 44.7М (↑12%). Тревожный сигнал: отмены 16.9% — в 5× выше порога Kaspi 3%. Разбор причин — в отчёте «Апрельский всплеск отмен»."
    >
      <KpiStrip items={MOCK_KPIS_DASHBOARD} />

      <Section title="Выручка и заказы · апрель" hint="Площадной график — выручка, тонкая линия — кол-во заказов">
        <ReportChart
          kind="area"
          title="Динамика выручки"
          yLabel="₸ тыс"
          data={MOCK_REVENUE_TIMESERIES.map((d) => ({ label: d.date, value: d.revenue }))}
          format="number"
          height={300}
          annotations={[{ x: "19 апр", label: "Партия с браком" }]}
        />
      </Section>

      <AiInsightBlock insights={MOCK_INSIGHTS_DASHBOARD} isMock />

      <RecommendationBlock items={MOCK_RECOMMENDATIONS_DASHBOARD} />
    </PageShell>
  );
}
