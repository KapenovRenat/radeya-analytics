import { redirect } from "next/navigation";
import { ComingSoonPage } from "@/components/page/coming-soon";
import { getActiveStore } from "@/lib/active-store";

export const dynamic = "force-dynamic";

export default async function CreditPage() {
  const store = await getActiveStore();
  if (store) redirect(`/stores/${store.id}/credit`);

  return (
    <ComingSoonPage
      title="Kaspi Kredit"
      description="Как кредитные продажи влияют на бизнес. Доля Kredit, средний чек, доля отмен, эффект на выручку и маржу."
      blocks={[
        "KPI: % Kredit в заказах, ср.чек prepaid vs Kredit, отмены",
        "Тренд: рост доли Kredit за квартал",
        "Сравнение по срокам (3/6/12/24 мес)",
        "Эффект на категории — где Kredit особенно сильно влияет",
      ]}
      relatedReportSlug="2026-04-28-kaspi-credit-share-growth"
      relatedReportTitle="Kaspi Kredit даёт 67% оборота"
    />
  );
}
