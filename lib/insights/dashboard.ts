import type { Insight } from "@/components/page/ai-insight-block";
import type { Recommendation } from "@/components/page/recommendation-block";

export interface DashboardKpis {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  totalRevenue: number;
  grossRevenue?: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  cancellationRate: number;
  returnRate: number;
  kaspiDeliveryShare: number;
}

export interface PeriodChanges {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  customers: number;
}

/**
 * Rule-based insight generator for the store dashboard.
 *
 * Inputs come straight from the analytics API: real numbers, not mocks.
 * Output is consumed by <AiInsightBlock isMock={false} />.
 * When we wire an actual LLM, replace this with a call — the output shape stays.
 */
export function generateDashboardInsights(
  kpis: DashboardKpis,
  changes: PeriodChanges,
): Insight[] {
  const insights: Insight[] = [];

  // 1) Cancellation rate vs Kaspi 3% threshold
  if (kpis.cancellationRate > 3) {
    insights.push({
      kind: "anomaly",
      title: `Отмены ${kpis.cancellationRate.toFixed(1)}% — выше порога Kaspi`,
      body: `Kaspi считает порогом 3% отмен. Сейчас ${kpis.cancelledOrders.toLocaleString("ru-RU")} отмен из ${kpis.totalOrders.toLocaleString("ru-RU")}. Превышение бьёт по рейтингу и поисковой выдаче.`,
    });
  } else if (kpis.cancellationRate > 1.5) {
    insights.push({
      kind: "observation",
      title: `Отмены ${kpis.cancellationRate.toFixed(1)}% — в норме, но близко к порогу`,
      body: `Порог Kaspi — 3%. Запас тонкий, имеет смысл проактивно смотреть причины и собирать обратную связь по проблемным SKU.`,
    });
  }

  // 2) Revenue trend vs previous comparable period
  if (Math.abs(changes.revenue) > 10) {
    insights.push({
      kind: changes.revenue > 0 ? "trend" : "anomaly",
      title:
        changes.revenue > 0
          ? `Выручка ускоряется: +${changes.revenue.toFixed(1)}%`
          : `Выручка падает: ${changes.revenue.toFixed(1)}%`,
      body: `Сравнение с предыдущим равным окном. Проверьте таб «Выручка» — какие сегменты тянут показатель.`,
    });
  }

  // 3) Average check direction
  if (Math.abs(changes.avgOrderValue) > 5) {
    insights.push({
      kind: "trend",
      title:
        changes.avgOrderValue > 0
          ? `Средний чек растёт: +${changes.avgOrderValue.toFixed(1)}%`
          : `Средний чек снижается: ${changes.avgOrderValue.toFixed(1)}%`,
      body:
        changes.avgOrderValue > 0
          ? "Покупатели берут более дорогие позиции или больше единиц на чек."
          : "Возможно сместился спрос в нижний ценовой сегмент. Посмотрите топ-SKU.",
    });
  }

  // 4) Returns
  if (kpis.returnRate > 2) {
    insights.push({
      kind: "anomaly",
      title: `Возвраты ${kpis.returnRate.toFixed(1)}% выше нормы`,
      body: `${kpis.returnedOrders.toLocaleString("ru-RU")} возвратов. Соберите топ-SKU по возвратам — частая причина: расхождение карточки с реальностью.`,
    });
  }

  // 5) Customer growth
  if (changes.customers > 15) {
    insights.push({
      kind: "trend",
      title: `Новых клиентов +${changes.customers.toFixed(1)}%`,
      body: "Приток аудитории — момент усилить retention: Kaspi Bonus, follow-up по отзывам, кросс-продажи.",
    });
  } else if (changes.customers < -15) {
    insights.push({
      kind: "anomaly",
      title: `Уникальных клиентов ${changes.customers.toFixed(1)}%`,
      body: "Сильное падение базы. Проверьте видимость в поиске Kaspi, ценовую позицию топ-SKU.",
    });
  }

  // 6) Kaspi delivery share — operational hint
  if (kpis.kaspiDeliveryShare > 70) {
    insights.push({
      kind: "observation",
      title: `Доля Kaspi Delivery ${kpis.kaspiDeliveryShare.toFixed(0)}%`,
      body: "Логистика плотно завязана на Kaspi. Стоит держать запас рук на собственную/курьерскую доставку как fallback на пиках.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      kind: "observation",
      title: "Ключевые метрики в норме",
      body: "Отмены, возвраты, средний чек — без отклонений. Внимание можно сместить на ассортимент и маркетинг.",
    });
  }

  return insights.slice(0, 5);
}

/**
 * Concrete next actions for the dashboard footer.
 * Hrefs are relative to /stores/<id>/ — the page passes the prefix.
 */
export function generateDashboardRecommendations(
  kpis: DashboardKpis,
  storePathPrefix: string,
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (kpis.cancellationRate > 3) {
    recs.push({
      title: "Снизить долю отмен до 3%",
      body: "В табе «Заказы» посмотрите топ-причины отмен и спайки во времени — обычно проблема в нестыковке остатков и в лидтайме сборки.",
      action: { label: "К заказам", href: `${storePathPrefix}/orders` },
    });
  }

  if (kpis.returnRate > 2) {
    recs.push({
      title: "Разобрать причины возвратов",
      body: "В ABC/XYZ-матрице найдите SKU с высоким возвратом — это типичный сигнал «карточка ≠ товар».",
      action: { label: "К ABC/XYZ", href: `${storePathPrefix}/sku` },
    });
  }

  recs.push({
    title: "Понять, где деньги в ассортименте",
    body: "Матрица ABC/XYZ показывает, какие 20% SKU генерят 80% выручки и какие — кандидаты на вывод из остатков.",
    action: { label: "К ABC/XYZ", href: `${storePathPrefix}/sku` },
  });

  recs.push({
    title: "Свериться по географии",
    body: "Хитмапа по областям Казахстана: где плотнее всего клиентская база и стоит ли пробовать локальные акции.",
    action: { label: "К доставке", href: `${storePathPrefix}/delivery` },
  });

  return recs.slice(0, 4);
}
