/**
 * Внутренние получатели заказов (не реальные поставщики товара).
 * Засеиваются автоматически при открытии модалки «Поставщики» (suppliers GET),
 * дальше владелец вписывает им ID Telegram-групп.
 *
 * Маршрутизация (Brain/wiki/orders-statuses.md):
 *   - warehouse       — наличие + Kaspi доставка → упаковывает и везёт на Zammler
 *   - local_delivery  — наличие + своя доставка → развозит по городу (газелист)
 */

export type RecipientRole = "supplier" | "warehouse" | "local_delivery";

export interface InternalRecipientDef {
  name: string;
  role: Exclude<RecipientRole, "supplier">;
  city: string;
}

export const INTERNAL_RECIPIENTS: InternalRecipientDef[] = [
  { name: "[Астана] Кладовщик",      role: "warehouse",      city: "Астана" },
  { name: "[Астана] Своя доставка",  role: "local_delivery", city: "Астана" },
];

/** Человекочитаемая подпись роли (для UI). */
export function roleLabel(role: string): string {
  if (role === "warehouse") return "Склад (наличие → Zammler)";
  if (role === "local_delivery") return "Своя доставка (по городу)";
  return "Поставщик";
}
