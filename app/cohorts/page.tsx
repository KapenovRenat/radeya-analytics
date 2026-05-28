import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function CohortsPage() {
  return (
    <ComingSoonPage
      title="Когорты и LTV"
      description="Retention по месяцам входа клиента. Кто из 'январских' клиентов всё ещё активен в апреле? Прогноз LTV на 12 месяцев вперёд."
      blocks={[
        "Cohort heatmap: месяц входа × месяц активности",
        "Repeat purchase rate по когортам",
        "Время между покупками",
        "Предсказательный LTV на 6/12 мес",
      ]}
    />
  );
}
