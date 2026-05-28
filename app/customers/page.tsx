import { redirect } from "next/navigation";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { getActiveStore } from "@/lib/active-store";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/customers`);

  return (
    <ComingSoonPage
      title="RFM-сегментация"
      description="Recency / Frequency / Monetary — 9 сегментов клиентов. От 'Чемпионов' до 'Спящих'. Под каждый — своя стратегия удержания / реактивации."
      blocks={[
        "9 RFM-сегментов в виде матрицы",
        "Champions / Loyal / At Risk / Lost — основные группы",
        "Размер сегмента, средний LTV, ср.чек",
        "Win-back-рекомендации для каждого сегмента",
        "Drill-down — список клиентов с экспортом для рассылки",
      ]}
    />
  );
}
