/**
 * Маппинг Kaspi статуса заказа в отображаемый статус (как в Kaspi / МойСкладе).
 *
 * Статус = комбинация:
 *   - стадия жизненного цикла (status/state/waybill/assembled/courierTransmission)
 *   - флаг preOrder (предзаказ / наличие)
 *   - тип доставки (Kaspi / самовывоз / своя) — для не-Kaspi заказов
 *
 * Подробная модель: Brain/wiki/orders-statuses.md
 */

export type DisplayStatusKey =
  | "new"                // Новый — пришёл, не принят
  | "signing"            // На подписании — state=SIGN_REQUIRED
  | "preorder"           // Предзаказ — принят + preOrder=true
  | "packing"            // Упаковка — принят, наличие, не собран
  | "transfer"           // Передача — собран, курьеру не передан
  | "on_delivery"        // Переданы на доставку — courierTransmissionDate проставлен
  | "pickup"             // Самовывоз — клиент забирает сам
  | "own_delivery"       // Своя доставка — продавец везёт сам
  | "cancelled_delivery" // Ожидают возврата/отмены — CANCELLING
  | "return_pending"     // Ожидают решения по возврату
  | "completed"          // Доставлен
  | "cancelled"          // Отменён
  | "returned";          // Возврат

export type StatusTone =
  | "default" | "amber" | "emerald" | "red" | "blue" | "violet" | "orange" | "kaspi" | "brown";

export interface DisplayStatus {
  key: DisplayStatusKey;
  label: string;
  tone: StatusTone;
}

// Цвета приближены к МойСкладу (зелёный=Новый/Доставлен, синий=Предзаказ, серый=Самовывоз/Отменён …)
const META: Record<DisplayStatusKey, Omit<DisplayStatus, "key">> = {
  new:                { label: "Новый",                     tone: "emerald" },
  signing:            { label: "На подписании",             tone: "orange" },
  preorder:           { label: "Предзаказ",                 tone: "blue" },
  packing:            { label: "Упаковка",                  tone: "amber" },
  transfer:           { label: "Передача",                  tone: "violet" },
  on_delivery:        { label: "Переданы на доставку",      tone: "kaspi" },
  pickup:             { label: "Самовывоз",                 tone: "default" },
  own_delivery:       { label: "Своя доставка",             tone: "brown" },
  cancelled_delivery: { label: "Ожидают возврата/отмены",   tone: "red" },
  return_pending:     { label: "Ожидают решения по возврату", tone: "orange" },
  completed:          { label: "Доставлен",                 tone: "emerald" },
  cancelled:          { label: "Отменён",                   tone: "default" },
  returned:           { label: "Возврат",                   tone: "red" },
};

// ── Тип доставки (отдельное измерение, нужно для маршрутизации) ─────────────────
export type DeliveryType = "kaspi" | "pickup" | "own";

export interface DeliveryTypeInput {
  state?: string | null;
  deliveryMode?: string | null;
  isKaspiDelivery?: boolean | null;
}

/**
 * Kaspi Доставка / Самовывоз / Своя доставка.
 * ⚠️ Точные значения `deliveryMode` уточнить на реальных данных Radeya
 *    (DELIVERY_PICKUP — самовывоз клиентом; DELIVERY_REGIONAL_PICKUP — это всё ещё Kaspi-доставка в ПВЗ!).
 */
export function deliveryType(input: DeliveryTypeInput): DeliveryType {
  const st = (input.state ?? "").toUpperCase();
  // Самовывоз клиентом — только явный state=PICKUP (не путать с regional pickup point Kaspi)
  if (st === "PICKUP") return "pickup";
  if (st === "KASPI_DELIVERY" || input.isKaspiDelivery === true) return "kaspi";
  // Не Kaspi и не самовывоз → своя доставка продавца
  if (input.isKaspiDelivery === false) return "own";
  return "kaspi"; // дефолт
}

export interface OrderStatusInput {
  status: string | null;
  state: string | null;
  waybillNumber: string | null;
  preOrder?: boolean;
  assembled?: boolean;
  courierTransmitted?: boolean; // courierTransmissionDate проставлен
  deliveryMode?: string | null;
  isKaspiDelivery?: boolean | null;
}

export function mapOrderStatus(input: OrderStatusInput): DisplayStatus {
  const s = (input.status ?? "").toUpperCase();
  const st = (input.state ?? "").toUpperCase();
  const hasWaybill = !!(input.waybillNumber && input.waybillNumber.trim());
  const dtype = deliveryType(input);

  let key: DisplayStatusKey;

  if (s === "CANCELLED") key = "cancelled";
  else if (s === "RETURNED") key = "returned";
  else if (s === "RETURN_REQUESTED" || s === "KASPI_DELIVERY_RETURN_REQUESTED") key = "return_pending";
  else if (s === "CANCELLING") key = "cancelled_delivery";
  else if (s === "COMPLETED" || s === "DELIVERED") key = "completed";
  else if (s === "ACCEPTED_BY_MERCHANT" || hasWaybill) {
    // Принят мерчантом → стадии
    if (input.preOrder) key = "preorder";          // изготавливается
    else if (dtype === "pickup") key = "pickup";   // самовывоз
    else if (dtype === "own") key = "own_delivery"; // своя доставка
    else if (input.courierTransmitted) key = "on_delivery";
    else if (input.assembled) key = "transfer";
    else key = "packing";                          // наличие, пакуется (Kaspi-доставка)
  }
  else if (st === "SIGN_REQUIRED") key = "signing";
  else key = "new"; // APPROVED_BY_BANK / NEW без накладной

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
