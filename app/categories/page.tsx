import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function CategoriesPage() {
  return (
    <ComingSoonPage
      title="Категории"
      description="Сравнение категорий между собой — где растём, где стагнируем. Какая категория тянет на дно по марже, какая — по отменам."
      blocks={[
        "Revenue / margin / cancel rate по категориям",
        "Тренды по последним 90 дням",
        "Доля каждой категории в общем обороте",
        "Drill-down — клик по категории → её SKU",
      ]}
    />
  );
}
