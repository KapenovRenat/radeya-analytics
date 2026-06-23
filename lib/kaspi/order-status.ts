/**
 * Маппинг Kaspi статуса заказа в отображаемый статус.
 * Учитывает status + state + наличие накладной (waybillNumber).
 *
 * Используется и на сервере (orders-list API), и в UI.
 */

export type DisplayStatusKey =
  | "new"        // Новый — нет накладной
  | "accepted"   // Принят — накладная появилась
  | "delivery"   // На доставке — доехал/в ПВЗ
  | "completed"  // Завершён
  | "cancelling" // Отмена (в процессе)
  | "cancelled"  // Отменён
  | "returned";  // Возврат

export interface DisplayStatus {
  key: DisplayStatusKey;
  label: string;
  tone: "default" | "amber" | "emerald" | "red" | "blue";
}

const META: Record<DisplayStatusKey, Omit<DisplayStatus, "key">> = {
  new:        { label: "Новый",      tone: "amber" },
  accepted:   { label: "Принят",     tone: "blue" },
  delivery:   { label: "На доставке", tone: "blue" },
  completed:  { label: "Завершён",   tone: "emerald" },
  cancelling: { label: "Отмена",     tone: "red" },
  cancelled:  { label: "Отменён",    tone: "red" },
  returned:   { label: "Возврат",    tone: "red" },
};

export function mapOrderStatus(
  status: string | null,
  state: string | null,
  waybillNumber: string | null,
): DisplayStatus {
  const s = (status ?? "").toUpperCase();
  const st = (state ?? "").toUpperCase();
  const hasWaybill = !!(waybillNumber && waybillNumber.trim());

  let key: DisplayStatusKey;

  if (s === "CANCELLED") key = "cancelled";
  else if (s === "RETURNED") key = "returned";
  else if (s === "CANCELLING") key = "cancelling";
  else if (s === "COMPLETED" || s === "DELIVERED") key = "completed";
  else if (s === "ARRIVED" || s === "ON_DELIVERY" || st === "KASPI_DELIVERY" || st === "DELIVERY" || st === "PICKUP") {
    // доставка — но если ещё не приняли мерчантом и нет накладной → Новый/Принят
    key = hasWaybill || s === "ACCEPTED_BY_MERCHANT" ? "delivery" : "new";
  }
  else if (s === "ACCEPTED_BY_MERCHANT" || hasWaybill) key = "accepted";
  else key = "new"; // NEW / APPROVED_BY_BANK / SIGN_REQUIRED без накладной

  return { key, ...META[key] };
}

/** «Состояние» — человекочитаемый state. */
export function mapOrderState(state: string | null, isKaspiDelivery: boolean | null): string {
  const st = (state ?? "").toUpperCase();
  if (st === "KASPI_DELIVERY") return "Kaspi Доставка";
  if (st === "DELIVERY") return "Доставка";
  if (st === "PICKUP") return "Самовывоз";
  if (st === "ARCHIVE") return "Архив";
  if (isKaspiDelivery) return "Kaspi Доставка";
  return state ?? "—";
}
