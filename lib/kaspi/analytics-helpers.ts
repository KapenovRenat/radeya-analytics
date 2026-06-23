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
  // Границы дня в местном времени Казахстана (UTC+5), как в Kaspi-кабинете:
  // "2026-06-21" → конец дня 21 июня по Алматы (= 18:59:59 UTC), а не по UTC.
  // Иначе UTC-границы захватывают лишние 5 часов следующего дня → расхождение.
  const to = toParam ? new Date(toParam + "T23:59:59.999+05:00") : now;
  const fromParam = sp.get("from");
  const from = fromParam ? new Date(fromParam + "T00:00:00.000+05:00") : new Date(now.getTime() - 30 * 86_400_000);
  const periodParam = sp.get("g") as Period | null;
  const period: Period =
    periodParam && ["daily", "weekly", "monthly"].includes(periodParam)
      ? periodParam
      : autoPeriod(from, to);
  return { storeId, from, to, period };
}
