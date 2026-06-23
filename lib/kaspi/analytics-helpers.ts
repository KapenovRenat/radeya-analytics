import type { NextRequest } from "next/server";
import type { Period } from "./aggregates";

export interface RangeQuery {
  storeId: string;
  from: Date;
  to: Date;
  period: Period;
}

function autoPeriod(from: Date, to: Date): Period {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days <= 31) return "daily";
  if (days <= 180) return "weekly";
  return "monthly";
}

export function parseRange(req: NextRequest, storeId: string): RangeQuery {
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const toParam = sp.get("to");
  // Конец дня: "2026-06-21" → 21 июня 23:59:59.999 UTC, чтобы заказы
  // последнего дня периода не выпадали из выборки.
  const to = toParam ? new Date(toParam + "T23:59:59.999Z") : now;
  const fromParam = sp.get("from");
  const from = fromParam ? new Date(fromParam + "T00:00:00.000Z") : new Date(now.getTime() - 30 * 86_400_000);
  const periodParam = sp.get("g") as Period | null;
  const period: Period =
    periodParam && ["daily", "weekly", "monthly"].includes(periodParam)
      ? periodParam
      : autoPeriod(from, to);
  return { storeId, from, to, period };
}
