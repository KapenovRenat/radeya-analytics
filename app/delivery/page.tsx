import { redirect } from "next/navigation";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { getActiveStore } from "@/lib/active-store";

export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/delivery`);

  return (
    <ComingSoonPage
      title="Доставка"
      description="Что мы платим Kaspi за доставку, какие регионы дороже всех обходятся, доля Kaspi Delivery vs самовывоз."
      blocks={[
        "KPI: % Kaspi Delivery, ср.стоимость доставки, доля экспресс",
        "Cost-per-order по регионам",
        "Доля самовывоза vs Kaspi Delivery vs Pickup",
        "Топ-10 самых дорогих маршрутов",
      ]}
    />
  );
}
