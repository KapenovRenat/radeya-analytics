import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function SlowMoversPage() {
  return (
    <ComingSoonPage
      title="Slow movers"
      description="Товары которые лежат на складе и не продаются. Сколько денег заморожено, сколько стоит хранение, что выгоднее — скидка или утилизация."
      blocks={[
        "Список SKU с < 3 продаж за 60 дней",
        "Стоимость заморозки капитала (₸ и %)",
        "Дни на складе vs нормa оборачиваемости",
        "Рекомендация: скидка / акция / снять с витрины",
      ]}
      relatedReportSlug="2026-04-22-abc-xyz-matrix-quick-wins"
      relatedReportTitle="ABC/XYZ-матрица: 80 SKU, 4 быстрых решения"
    />
  );
}
