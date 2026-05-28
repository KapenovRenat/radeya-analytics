import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function GeographyPage() {
  return (
    <ComingSoonPage
      title="География (KZ)"
      description="Тепловая карта Казахстана по областям. Где растёт спрос, где теряем долю. Cost-per-order по регионам с учётом логистики."
      blocks={[
        "KZ heatmap с интерактивными областями",
        "Топ-10 городов по выручке",
        "Тренд по областям за 90 дней",
        "Cost-per-order по регионам",
      ]}
    />
  );
}
