import { getActiveStore } from "@/lib/active-store";
import { Sidebar, type NavGroup } from "@/components/sidebar";

/**
 * Server wrapper around <Sidebar/>.
 *
 * Resolves the active store and builds the nav with paths prefixed to
 * /stores/<id>/... for tabs that have a store-scoped implementation
 * (dashboard / revenue / orders / delivery / customers / credit / sku).
 *
 * Top-level pages without a store-scoped equivalent yet (insights, margin,
 * seasonality, cancellations, top-sku, slow-movers, categories, cohorts,
 * geography) keep their bare paths and render <ComingSoonPage/> stubs.
 *
 * /reports, /reports/archive, /stores, /sync, /settings always stay top-level.
 */
export async function SidebarServer() {
  const store = await getActiveStore();
  const prefix = store ? `/stores/${store.id}` : "";

  // Helper: prefix a path when an active store exists, else fall through to
  // the top-level stub. Stub pages then redirect into the store-scoped page
  // automatically (see Task 7).
  const p = (sub: string) => (store ? `${prefix}${sub}` : sub);

  const nav: NavGroup[] = [
    {
      id: "overview",
      title: "Обзор",
      defaultOpen: true,
      items: [
        { href: store ? `${prefix}/dashboard` : "/", label: "Дашборд", iconName: "LayoutDashboard" },
        { href: "/insights", label: "AI-инсайты", iconName: "Sparkles" },
      ],
    },
    {
      id: "revenue",
      title: "Выручка",
      defaultOpen: true,
      items: [
        { href: p("/revenue"), label: "Динамика", iconName: "TrendingUp" },
        { href: "/margin", label: "Маржинальность", iconName: "Wallet" },
        { href: "/seasonality", label: "Сезонность", iconName: "CalendarRange" },
        { href: p("/credit"), label: "Kaspi Kredit", iconName: "CreditCard" },
      ],
    },
    {
      id: "operations",
      title: "Операционка",
      defaultOpen: true,
      items: [
        { href: p("/orders"), label: "Заказы", iconName: "ShoppingBag" },
        { href: "/cancellations", label: "Отмены и возвраты", iconName: "XCircle" },
        { href: p("/delivery"), label: "Доставка", iconName: "Truck" },
      ],
    },
    {
      id: "assortment",
      title: "Ассортимент",
      defaultOpen: false,
      items: [
        { href: p("/sku"), label: "ABC / XYZ матрица", iconName: "Layers" },
        { href: "/top-sku", label: "Топ-SKU", iconName: "Trophy" },
        { href: "/slow-movers", label: "Slow movers", iconName: "Snowflake" },
        { href: "/categories", label: "Категории", iconName: "FolderTree" },
      ],
    },
    {
      id: "customers",
      title: "Клиенты",
      defaultOpen: false,
      items: [
        { href: p("/customers"), label: "RFM-сегментация", iconName: "Users" },
        { href: "/cohorts", label: "Когорты и LTV", iconName: "Activity" },
        { href: "/geography", label: "География (KZ)", iconName: "Map" },
      ],
    },
    {
      id: "advertising",
      title: "Реклама",
      defaultOpen: true,
      items: [
        { href: p("/ad"), label: "Сводка", iconName: "BarChart2" },
        { href: p("/ad/overview"), label: "Обзор", iconName: "LineChart" },
        { href: p("/ad/campaigns"), label: "По кампаниям", iconName: "Megaphone" },
        { href: p("/ad/upload"), label: "Загрузка CSV", iconName: "Upload" },
      ],
    },
    {
      id: "reports",
      title: "Отчёты",
      defaultOpen: false,
      items: [
        { href: "/reports", label: "Свежие за неделю", iconName: "BookOpen" },
        { href: "/reports/archive", label: "Архив", iconName: "Archive" },
      ],
    },
    {
      id: "system",
      title: "Система",
      defaultOpen: false,
      items: [
        { href: "/stores", label: "Магазины", iconName: "Store" },
        { href: "/sync", label: "Синхронизация", iconName: "RefreshCw" },
        { href: "/settings", label: "Настройки", iconName: "Settings" },
      ],
    },
  ];

  return <Sidebar nav={nav} connectCta={!store} />;
}
