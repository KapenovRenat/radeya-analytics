import { ComingSoonPage } from "@/components/page/coming-soon";

export const dynamic = "force-static";

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title="Настройки"
      description="Управление API-токенами, настройки уведомлений, пользователи, оформление дашборда."
      blocks={[
        "Управление Kaspi X-Auth-Token (rotate)",
        "Email-алерты при превышении threshold-ов",
        "Кастомизация sidebar (показать / скрыть пункты)",
        "Multi-user access (для команды)",
      ]}
    />
  );
}
