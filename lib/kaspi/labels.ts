/**
 * Shared Russian labels and brand colors for Kaspi enums.
 * Used across all dashboard tabs for consistent categorical color coding.
 */

export const PAYMENT_LABELS: Record<string, string> = {
  PREPAID: "Предоплата",
  PAY_WITH_CREDIT: "Kaspi Кредит",
  PAY_WITH_INSTALLMENT: "Kaspi Рассрочка",
  CARD: "Картой",
};

export const PAYMENT_COLORS: Record<string, string> = {
  PREPAID: "var(--emerald)",
  PAY_WITH_CREDIT: "var(--violet)",
  PAY_WITH_INSTALLMENT: "var(--blue)",
  CARD: "var(--amber)",
};

export const DELIVERY_LABELS: Record<string, string> = {
  PICKUP: "Самовывоз",
  LOCAL: "Локальная",
  REGIONAL_TODOOR: "Региональная",
  REGIONAL_PICKUP: "Региональный пункт выдачи",
};

export const DELIVERY_COLORS: Record<string, string> = {
  PICKUP: "#6b7280",
  LOCAL: "var(--blue)",
  REGIONAL_TODOOR: "var(--orange)",
  REGIONAL_PICKUP: "var(--violet)",
};

export const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Выполнен",
  CANCELLED: "Отменён",
  RETURNED: "Возврат",
  ACCEPTED_BY_MERCHANT: "Принят",
  NEW: "Новый",
  APPROVED_BY_BANK: "Одобрен банком",
  KASPI_DELIVERY_RETURNED_TO_WAREHOUSE: "Возвращён на склад",
};

export const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "var(--emerald)",
  CANCELLED: "var(--red)",
  RETURNED: "var(--orange)",
  ACCEPTED_BY_MERCHANT: "#6b7280",
  NEW: "#6b7280",
  APPROVED_BY_BANK: "var(--blue)",
};

export const CANCELLATION_REASON_LABELS: Record<string, string> = {
  BUYER_CANCELLATION_HIMSELF: "Клиент отменил сам",
  BUYER_CANCELLATION_BY_COURIER: "Отказ курьеру",
  MERCHANT_OUT_OF_STOCK: "Нет в наличии",
  RFO_REJECTED: "Отклонён по RFO",
  TIMEOUT_BUYER_SIGNATURE: "Таймаут подписи покупателя",
  TIMEOUT_MERCHANT_DELIVERY: "Таймаут доставки продавца",
  TECHNICAL_PROBLEM_CANCELLATION: "Техническая проблема",
};

export const DOW_LABELS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const DOW_LABELS_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

export function formatPeriodLabel(isoDate: string, period: "daily" | "weekly" | "monthly"): string {
  const d = new Date(isoDate);
  if (period === "monthly") {
    return d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
