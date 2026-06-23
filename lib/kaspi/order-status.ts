/**
 * Маппинг Kaspi статуса заказа в отображаемый статус (как в кабинете Kaspi).
 *
 * Гранулярные под-статусы Kaspi-доставки берутся из raw_data:
 *   preOrder, assembled, kaspiDelivery.courierTransmissionDate.
 */

export type DisplayStatusKey =
  | "new"                // Новый — не принят, нет накладной
  | "preorder"           // Предзаказ — preOrder=true
  | "packing"            // Упаковка — принят, assembled=false
  | "transfer"           // Передача — собран, курьеру не передан
  | "on_delivery"        // Переданы на доставку — courierTransmissionDate проставлен
  | "cancelled_delivery" // Отменены при доставке — CANCELLING
  | "completed"          // Завершён
  | "cancelled"          // Отменён
  | "returned";          // Возврат

export interface DisplayStatus {
  key: DisplayStatusKey;
  label: string;
  tone: "default" | "amber" | "emerald" | "red" | "blue" | "violet" | "orange" | "kaspi";
}

const META: Record<DisplayStatusKey, Omit<DisplayStatus, "key">> = {
  new:                { label: "Новый",                tone: "amber" },
  preorder:           { label: "Предзаказ",            tone: "violet" },
  packing:            { label: "Упаковка",             tone: "blue" },
  transfer:           { label: "Передача",             tone: "orange" },
  on_delivery:        { label: "Переданы на доставку", tone: "kaspi" },
  cancelled_delivery: { label: "Отменены при доставке", tone: "red" },
  completed:          { label: "Завершён",             tone: "emerald" },
  cancelled:          { label: "Отменён",              tone: "red" },
  returned:           { label: "Возврат",              tone: "red" },
};

export interface OrderStatusInput {
  status: string | null;
  state: string | null;
  waybillNumber: string | null;
  preOrder?: boolean;
  assembled?: boolean;
  courierTransmitted?: boolean; // courierTransmissionDate проставлен
}

export function mapOrderStatus(input: OrderStatusInput): DisplayStatus {
  const s = (input.status ?? "").toUpperCase();
  const hasWaybill = !!(input.waybillNumber && input.waybillNumber.trim());

  let key: DisplayStatusKey;

  if (s === "CANCELLED") key = "cancelled";
  else if (s === "RETURNED") key = "returned";
  else if (s === "CANCELLING") key = "cancelled_delivery";
  else if (s === "COMPLETED" || s === "DELIVERED") key = "completed";
  else if (s === "ACCEPTED_BY_MERCHANT" || hasWaybill) {
    // Принят мерчантом → стадии Kaspi-доставки
    if (input.preOrder) key = "preorder";
    else if (input.courierTransmitted) key = "on_delivery";
    else if (input.assembled) key = "transfer";
    else key = "packing";
  }
  else key = "new"; // APPROVED_BY_BANK / NEW / SIGN_REQUIRED без накладной

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
