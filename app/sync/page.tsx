import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function SyncPage() {
  return (
    <ComingSoonPage
      title="Синхронизация"
      description="Статус синхронизации с Kaspi API. Когда последний раз тянули данные, сколько чанков обработано, есть ли ошибки."
      blocks={[
        "Last-sync timestamp по каждому магазину",
        "История синков с длительностью",
        "Кнопка ручного запуска / pause / resume",
        "Логи ошибок (если есть)",
      ]}
    />
  );
}
