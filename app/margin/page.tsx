import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function MarginPage() {
  return (
    <ComingSoonPage
      title="Маржинальность"
      description="Расчёт чистой маржи после всех комиссий Kaspi, логистики, обратной доставки. Сравнение по категориям и SKU — где зарабатываем, где работаем «в ноль»."
      blocks={[
        "KPI: средняя маржа, gross profit, доля убыточных заказов",
        "Marжа по способам оплаты (prepaid vs Kaspi Kredit vs Gold)",
        "Топ-10 SKU по marže (в ₸ и %)",
        "Bottom-10 SKU — кандидаты на пересмотр цены",
        "Эффект комиссии Kaspi (5%/15%/20%) на разные категории",
        "AI-инсайты: где маржа протекает",
      ]}
    />
  );
}
