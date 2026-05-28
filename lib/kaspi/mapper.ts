/**
 * Map Kaspi API order JSON → DB row shape.
 * Port of map_kaspi_order() from kaspi_sync_service.py.
 */
import type { KaspiApiOrder } from "./types";
import type { NewKaspiOrder } from "../db/schema";

export function mapKaspiOrder(apiOrder: KaspiApiOrder, storeId: string): NewKaspiOrder | null {
  const attrs = apiOrder.attributes ?? {};
  const customer = attrs.customer ?? {};
  const deliveryAddr = attrs.deliveryAddress ?? {};
  const originAddr = attrs.originAddress ?? {};
  const originInner = originAddr.address ?? {};
  const originCity = originAddr.city ?? {};
  const kaspiDelivery = attrs.kaspiDelivery ?? {};

  const code = attrs.code != null ? String(attrs.code) : null;
  if (!code) return null; // required

  const creationDate = attrs.creationDate ? new Date(attrs.creationDate) : null;
  if (!creationDate) return null;

  const approvedDate = attrs.approvedByBankDate ? new Date(attrs.approvedByBankDate) : null;

  const fullName =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || customer.name || null;

  return {
    storeId,
    orderCode: code,
    creationDate,
    totalPrice: attrs.totalPrice ?? 0,
    deliveryCostForSeller: attrs.deliveryCostForSeller ?? 0,
    deliveryCost: attrs.deliveryCost ?? 0,
    status: attrs.status ?? "UNKNOWN",
    state: attrs.state ?? null,
    cancellationReason: attrs.cancellationReason ?? null,
    paymentMode: attrs.paymentMode ?? null,
    creditTerm: attrs.creditTerm ?? null,
    deliveryMode: attrs.deliveryMode ?? null,
    isKaspiDelivery: attrs.isKaspiDelivery ?? false,
    waybillNumber: kaspiDelivery.waybillNumber ?? null,
    isExpress: kaspiDelivery.express ?? false,
    assembled: attrs.assembled ?? false,
    approvedByBankDate: approvedDate,
    customerName: fullName,
    customerCellPhone: customer.cellPhone ?? null,
    deliveryAddressCity: deliveryAddr.town ?? null,
    deliveryAddressTown: deliveryAddr.town ?? null,
    deliveryAddressFormatted: deliveryAddr.formattedAddress ?? null,
    originAddressCity: originCity.name ?? null,
    originAddressFormatted: originInner.formattedAddress ?? null,
    rawData: apiOrder as unknown as Record<string, unknown>,
  };
}
