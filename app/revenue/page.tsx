import { redirect } from "next/navigation";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { getActiveStore } from "@/lib/active-store";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/revenue`);

  return (
    <ComingSoonPage
      title="Выручка · Динамика"
      description="Полный разбор того, откуда приходят деньги — по дням, способам оплаты, категориям, городам. Annotated-чарты с разметкой ключевых моментов."
      blocks={[
        "KPI: общая выручка, YoY-рост, ср.чек, доля топ-10 SKU",
        "Hero: area-chart выручки по дням с annotations на пиках и провалах",
        "Breakdown по категориям (горизонтальные бары)",
        "Sales velocity heatmap — день недели × час суток",
        "AI-инсайты: 3-5 наблюдений по трендам",
        "Drill-down таблица: топ-30 дней по выручке",
      ]}
      relatedReportSlug="2026-04-28-kaspi-credit-share-growth"
      relatedReportTitle="Kaspi Kredit даёт 67% оборота"
    />
  );
}
