/**
 * Kaspi /orders/{id}/entries endpoint client.
 * Fetches order line items (SKU, quantity, price, category).
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface KaspiEntryAttrs {
  entryNumber?: number;
  deliveryCost?: number;
  quantity?: number;
  weight?: number;
  basePrice?: number;
  totalPrice?: number;
  category?: { code?: string; title?: string };
  offer?: { code?: string; name?: string };
  isImeiRequired?: boolean;
}

export interface KaspiEntry {
  id?: string;
  type?: string;
  attributes?: KaspiEntryAttrs;
  relationships?: {
    product?: { data?: { id?: string; type?: string } };
  };
}

export interface KaspiEntriesResponse {
  data?: KaspiEntry[];
  included?: unknown[];
}

const BASE = process.env.KASPI_API_BASE ?? "https://kaspi.kz/shop/api/v2";

export async function fetchOrderEntries(
  token: string,
  kaspiOrderId: string,
): Promise<KaspiEntry[]> {
  const url = new URL(`${BASE}/orders/${encodeURIComponent(kaspiOrderId)}/entries`);
  url.searchParams.set("page[size]", "100");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Auth-Token": token,
      Accept: "application/vnd.api+json;charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kaspi entries ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as KaspiEntriesResponse;
  return json.data ?? [];
}
