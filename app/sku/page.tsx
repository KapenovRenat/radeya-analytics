import { redirect } from "next/navigation";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { getActiveStore } from "@/lib/active-store";

export const dynamic = "force-dynamic";

export default async function SkuPage() {
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/sku`);

  return (
    <ComingSoonPage
      title="ABC / XYZ матрица"
      description="Классификация всего ассортимента по выручке (ABC) и стабильности спроса (XYZ). 9 ячеек — звёзды, лошади, балласт. Где растим, где удаляем."
      blocks={[
        "9-ячеечная матрица с heat-разметкой",
        "Топ-9 'звёзд' с CSV-экспортом",
        "Бот 14 'балластов' — кандидаты на удаление",
        "Доля выручки по A / B / C",
        "Trend: как SKU мигрируют между ячейками месяц-к-месяцу",
      ]}
      relatedReportSlug="2026-04-22-abc-xyz-matrix-quick-wins"
      relatedReportTitle="ABC/XYZ-матрица: 80 SKU, 4 быстрых решения"
    />
  );
}
