import { redirect } from "next/navigation";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { getActiveStore } from "@/lib/active-store";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/orders`);

  return (
    <ComingSoonPage
      title="Заказы"
      description="Операционная эффективность: распределение по статусам, время сборки, скорость обработки, доля выполненных в срок (OTIF)."
      blocks={[
        "KPI: всего заказов, выполнено, в работе, отменено",
        "Status mix — donut по статусам",
        "Время сборки — среднее, p50, p95",
        "OTIF (On-Time In-Full) по дням",
        "Топ-5 проблемных дней с лагом сборки",
      ]}
    />
  );
}
