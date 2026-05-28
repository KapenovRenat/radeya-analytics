import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function SeasonalityPage() {
  return (
    <ComingSoonPage
      title="Сезонность"
      description="Как заказы распределяются по неделям, месяцам, дням недели и часам суток. Чтобы знать когда поднимать рекламные ставки и когда заказывать товар на склад."
      blocks={[
        "Heatmap день недели × час — где плотность заказов",
        "Месячные тренды по последнему году (если есть данные)",
        "Доля выходных vs будней в выручке",
        "Топ-3 «горячих окна» по часам — где запускать рекламу",
        "AI-инсайты: 'среды слабее вторников на 31%'",
      ]}
    />
  );
}
