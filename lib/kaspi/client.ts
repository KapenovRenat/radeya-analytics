/**
 * Kaspi Seller Orders API HTTP client (TypeScript port of kaspi_api_service.py).
 *
 * - Endpoint: GET https://kaspi.kz/shop/api/v2/orders
 * - Auth: X-Auth-Token header (persistent token from Kaspi Merchant Cabinet)
 * - Pagination: page[number] + page[size], date filter in ms
 * - Chunk size: 3 days (Kaspi docs 14d, but pagination caps ~10k items)
 *
 * Differs from Python original:
 * - Parallelism dialed down from 50 → 8 (Vercel function resource budget)
 * - No asyncio.sleep between pages (fetch parallelism is enough)
 */
import type { KaspiApiOrder, KaspiApiOrdersResponse, KaspiTokenTestResult, SyncChunk } from "./types";

export const KASPI_API_BASE = process.env.KASPI_API_BASE ?? "https://kaspi.kz/shop/api/v2";
export const KASPI_ORDERS_URL = `${KASPI_API_BASE}/orders`;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const MAX_KASPI_DATE_RANGE_DAYS = 3;
export const DEFAULT_PARALLEL_LIMIT = 8;
export const DEFAULT_PAGE_SIZE = 100;

export async function fetchOrdersPage(params: {
  token: string;
  pageNumber: number;
  pageSize: number;
  dateFromMs: number;
  dateToMs: number;
  signal?: AbortSignal;
}): Promise<KaspiApiOrdersResponse> {
  const { token, pageNumber, pageSize, dateFromMs, dateToMs, signal } = params;

  const url = new URL(KASPI_ORDERS_URL);
  url.searchParams.set("page[number]", String(pageNumber));
  url.searchParams.set("page[size]", String(pageSize));
  url.searchParams.set("filter[orders][creationDate][$ge]", String(dateFromMs));
  url.searchParams.set("filter[orders][creationDate][$le]", String(dateToMs));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Auth-Token": token,
      Accept: "application/vnd.api+json;charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
    signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kaspi API ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as KaspiApiOrdersResponse;
}

async function fetchChunkOrders(
  token: string,
  dateFromMs: number,
  dateToMs: number,
  pageSize = DEFAULT_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<KaspiApiOrder[]> {
  const first = await fetchOrdersPage({ token, pageNumber: 0, pageSize, dateFromMs, dateToMs, signal });
  const pageCount = first.meta?.pageCount ?? 1;
  const orders: KaspiApiOrder[] = first.data ?? [];

  for (let page = 1; page < pageCount; page++) {
    const resp = await fetchOrdersPage({ token, pageNumber: page, pageSize, dateFromMs, dateToMs, signal });
    orders.push(...(resp.data ?? []));
  }
  return orders;
}

export function buildChunks(dateFrom: Date, dateTo: Date, chunkDays = MAX_KASPI_DATE_RANGE_DAYS): SyncChunk[] {
  const chunks: SyncChunk[] = [];
  let start = new Date(dateFrom);
  while (start < dateTo) {
    const end = new Date(Math.min(start.getTime() + chunkDays * 86_400_000, dateTo.getTime()));
    chunks.push({ from: new Date(start), to: end });
    start = new Date(end.getTime() + 1000);
  }
  return chunks;
}

/**
 * Fetch one chunk's orders (used by sync endpoint per Vercel invocation).
 * Keeps each call bounded to <60s Vercel function timeout.
 */
export async function fetchOrdersForChunk(
  token: string,
  chunk: SyncChunk,
  pageSize = DEFAULT_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<KaspiApiOrder[]> {
  const fromMs = chunk.from.getTime();
  const toMs = chunk.to.getTime();
  return fetchChunkOrders(token, fromMs, toMs, pageSize, signal);
}

/**
 * Fetch multiple chunks in parallel (for admin/CLI use — not recommended inside
 * Vercel function; prefer one-chunk-per-invocation for sync endpoint).
 */
export async function fetchAllOrders(
  token: string,
  dateFrom: Date,
  dateTo: Date,
  opts: {
    pageSize?: number;
    parallelism?: number;
    onChunkComplete?: (done: number, total: number, chunk: SyncChunk) => void | Promise<void>;
    signal?: AbortSignal;
  } = {},
): Promise<KaspiApiOrder[]> {
  const { pageSize = DEFAULT_PAGE_SIZE, parallelism = DEFAULT_PARALLEL_LIMIT, onChunkComplete, signal } = opts;
  const chunks = buildChunks(dateFrom, dateTo);
  const results: KaspiApiOrder[][] = new Array(chunks.length);
  let done = 0;

  const queue = [...chunks.entries()];
  const workers = Array.from({ length: Math.min(parallelism, chunks.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      const [idx, chunk] = next;
      const orders = await fetchOrdersForChunk(token, chunk, pageSize, signal);
      results[idx] = orders;
      done++;
      if (onChunkComplete) await onChunkComplete(done, chunks.length, chunk);
    }
  });

  await Promise.all(workers);
  return results.flat();
}

export async function testToken(token: string): Promise<KaspiTokenTestResult> {
  try {
    const now = Date.now();
    const twoWeeksAgo = now - 14 * 86_400_000;
    const resp = await fetchOrdersPage({
      token,
      pageNumber: 0,
      pageSize: 1,
      dateFromMs: twoWeeksAgo,
      dateToMs: now,
    });
    return { valid: true, totalCount: resp.meta?.totalCount ?? 0, error: null };
  } catch (err) {
    return { valid: false, totalCount: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
