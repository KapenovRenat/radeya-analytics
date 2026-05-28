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
  const to = sp.get("to") ? new Date(sp.get("to")!) : now;
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(now.getTime() - 30 * 86_400_000);
  const periodParam = sp.get("g") as Period | null;
  const period: Period =
    periodParam && ["daily", "weekly", "monthly"].includes(periodParam)
      ? periodParam
      : autoPeriod(from, to);
  return { storeId, from, to, period };
}
