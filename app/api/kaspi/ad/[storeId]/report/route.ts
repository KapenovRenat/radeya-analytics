/**
 * POST /api/kaspi/ad/[storeId]/report
 *
 * Generates a formatted Telegram report and sends it to specified recipients.
 *
 * Body (multipart/form-data):
 *   botToken        — Telegram bot token
 *   recipients      — comma-separated chat IDs
 *   overviewWeek    — ISO weekStart of the overview week (required)
 *   campaignWeek    — ISO weekStart of the campaign week (optional)
 *   dailyCsv        — File: yesterday's "Обзорный отчёт" CSV (required)
 *
 * Response: { sent: number, errors: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adStoreOverview, adCampaigns, adWeeklyStats } from "@/lib/db/schema";
import { parseOverviewCsv } from "@/lib/ad/csv-parser";
import { sendTelegramMessage, tgFmt, tgPct, tgMoney, tgDate, tgWeekRange } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

function sumRows(rows: { impressions: number | null; clicks: number | null; spent: number | null; revenue: number | null; orders: number | null; favorites: number | null; cart: number | null }[]) {
  let impressions = 0, clicks = 0, spent = 0, revenue = 0, orders = 0, favorites = 0, cart = 0;
  for (const r of rows) {
    impressions += r.impressions ?? 0;
    clicks      += r.clicks      ?? 0;
    spent       += r.spent       ?? 0;
    revenue     += r.revenue     ?? 0;
    orders      += r.orders      ?? 0;
    favorites   += r.favorites   ?? 0;
    cart        += r.cart        ?? 0;
  }
  const ctrPct = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const drrPct = revenue > 0 ? (spent / revenue) * 100 : 0;
  const avgClick = clicks > 0 ? spent / clicks : 0;
  return { impressions, clicks, spent, revenue, orders, favorites, cart, ctrPct, drrPct, avgClick };
}

// ── message builder ───────────────────────────────────────────────────────────

function buildMessage(data: {
  storeName: string;
  overview: ReturnType<typeof sumRows>;
  overviewRange: string;
  daily: ReturnType<typeof sumRows> | null;
  dailyDate: string | null;
  campaigns: { name: string; spent: number; orders: number; drrPct: number; rating: string | null }[] | null;
  campaignRange: string | null;
}): string {
  const { storeName, overview, overviewRange, daily, dailyDate, campaigns, campaignRange } = data;

  const ratingIcon = (r: string | null) =>
    r === "good" ? "🟢" : r === "normal" ? "🟡" : r === "bad" ? "🔴" : "⚪️";

  let msg = `📊 <b>Отчёт ${storeName} - Каспи Маркетинг</b>\n\n`;

  // ── Обзор недели ──
  msg += `📈 <b>ОБЗОР НЕДЕЛИ</b>\n`;
  msg += `🗓 ${overviewRange}\n\n`;
  msg += `👁 Просмотры: <b>${tgFmt(overview.impressions)}</b>\n`;
  msg += `🖱 Клики: <b>${tgFmt(overview.clicks)}</b> · CTR <b>${tgPct(overview.ctrPct)}</b>\n`;
  msg += `❤️ Избранное: <b>${tgFmt(overview.favorites)}</b> · 🛒 Корзина: <b>${tgFmt(overview.cart)}</b>\n`;
  msg += `📦 Заказы: <b>${tgFmt(overview.orders)}</b>`;
  if (overview.revenue > 0) msg += ` на <b>${tgMoney(overview.revenue)}</b>`;
  msg += `\n`;
  msg += `💸 Расход: <b>${tgMoney(overview.spent)}</b>\n`;
  msg += `📉 ДРР: <b>${tgPct(overview.drrPct)}</b> · Ср. клик: <b>${tgMoney(Math.round(overview.avgClick))}</b>\n`;

  // ── Активные кампании (опционально) ──
  if (campaigns && campaigns.length > 0 && campaignRange) {
    msg += `\n━━━━━━━━━━━━━━━\n\n`;
    msg += `📋 <b>АКТИВНЫЕ КАМПАНИИ</b>\n`;
    msg += `🗓 ${campaignRange}\n\n`;
    const top = campaigns.slice(0, 10);
    for (const c of top) {
      msg += `${ratingIcon(c.rating)} <b>${c.name}</b>\n`;
      msg += `   💸 ${tgMoney(c.spent)} · 📦 ${c.orders} зак.`;
      if (c.drrPct > 0) msg += ` · ДРР ${tgPct(c.drrPct)}`;
      msg += `\n`;
    }
    if (campaigns.length > 10) {
      msg += `<i>...и ещё ${campaigns.length - 10} кампаний</i>\n`;
    }
  }

  // ── Вчерашний день ──
  if (daily && dailyDate) {
    msg += `\n━━━━━━━━━━━━━━━\n\n`;
    msg += `📅 <b>ВЧЕРА</b> — ${dailyDate}\n\n`;
    msg += `👁 Просмотры: <b>${tgFmt(daily.impressions)}</b>\n`;
    msg += `🖱 Клики: <b>${tgFmt(daily.clicks)}</b> · CTR <b>${tgPct(daily.ctrPct)}</b>\n`;
    msg += `❤️ Избранное: <b>${tgFmt(daily.favorites)}</b> · 🛒 Корзина: <b>${tgFmt(daily.cart)}</b>\n`;
    msg += `📦 Заказы: <b>${tgFmt(daily.orders)}</b>`;
    if (daily.revenue > 0) msg += ` на <b>${tgMoney(daily.revenue)}</b>`;
    msg += `\n`;
    msg += `💸 Расход: <b>${tgMoney(daily.spent)}</b>\n`;
    msg += `📉 ДРР: <b>${tgPct(daily.drrPct)}</b> · Ср. клик: <b>${tgMoney(Math.round(daily.avgClick))}</b>\n`;
  }

  msg += `\n<i>Отправлено из Radeya Analytics</i>`;
  return msg;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN не задан в .env.local" }, { status: 500 });
  }

  const formData = await req.formData();
  const recipientIds = (formData.getAll("recipientIds") as string[]).filter(Boolean);
  const overviewWeek = (formData.get("overviewWeek") as string)?.trim();
  const campaignWeek = (formData.get("campaignWeek") as string | null)?.trim() || null;
  const dailyCsvFile = formData.get("dailyCsv") as File | null;

  if (recipientIds.length === 0) return NextResponse.json({ error: "Не выбраны получатели" }, { status: 400 });
  if (!overviewWeek)  return NextResponse.json({ error: "Не выбрана неделя обзора" }, { status: 400 });
  if (!dailyCsvFile)  return NextResponse.json({ error: "Не загружен CSV за вчера" }, { status: 400 });

  // Fetch chat IDs for selected recipient IDs
  const { tgRecipients } = await import("@/lib/db/schema");
  const { inArray } = await import("drizzle-orm");
  const db2 = getDb();
  const recipientRows = await db2
    .select({ chatId: tgRecipients.chatId, name: tgRecipients.name })
    .from(tgRecipients)
    .where(inArray(tgRecipients.id, recipientIds));

  const recipients = recipientRows.map((r) => r.chatId);
  if (recipients.length === 0) return NextResponse.json({ error: "Получатели не найдены в БД" }, { status: 400 });

  const db = getDb();

  // ── Fetch overview week from DB ──
  const weekStart = new Date(overviewWeek);
  // End = 7 days after start
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const overviewRows = await db
    .select()
    .from(adStoreOverview)
    .where(and(
      eq(adStoreOverview.storeId, storeId),
      gte(adStoreOverview.date, weekStart),
      lte(adStoreOverview.date, weekEnd),
    ))
    .orderBy(asc(adStoreOverview.date));

  if (overviewRows.length === 0) {
    return NextResponse.json({ error: "Нет данных обзора для выбранной недели" }, { status: 400 });
  }

  const overview = sumRows(overviewRows);
  const overviewRange = tgWeekRange(
    overviewRows[0].date.toISOString(),
    overviewRows[overviewRows.length - 1].date.toISOString(),
  );

  // ── Fetch campaign stats (optional) ──
  let campaigns: { name: string; spent: number; orders: number; drrPct: number; rating: string | null }[] | null = null;
  let campaignRange: string | null = null;

  if (campaignWeek) {
    const cWeekStart = new Date(campaignWeek);
    const cWeekEnd = new Date(cWeekStart);
    cWeekEnd.setUTCDate(cWeekEnd.getUTCDate() + 7);

    // Get active campaigns only
    const activeCampaigns = await db
      .select({ id: adCampaigns.id, name: adCampaigns.name })
      .from(adCampaigns)
      .where(and(eq(adCampaigns.storeId, storeId), eq(adCampaigns.status, "on")));

    const activeCampaignIds = new Set(activeCampaigns.map((c) => c.id));
    const campaignIdMap = new Map(activeCampaigns.map((c) => [c.id, c.name]));

    const stats = await db
      .select()
      .from(adWeeklyStats)
      .where(and(
        eq(adWeeklyStats.storeId, storeId),
        eq(adWeeklyStats.isMonthlyTotal, false),
        gte(adWeeklyStats.weekStart, cWeekStart),
        lte(adWeeklyStats.weekStart, cWeekEnd),
      ))
      .orderBy(desc(adWeeklyStats.spent));

    campaigns = stats
      .filter((s) => activeCampaignIds.has(s.campaignId) && (s.spent ?? 0) > 0)
      .map((s) => ({
        name: campaignIdMap.get(s.campaignId) ?? "—",
        spent: s.spent ?? 0,
        orders: s.orders ?? 0,
        drrPct: s.drrPct ?? 0,
        rating: s.rating,
      }));

    if (campaigns.length > 0) {
      campaignRange = tgWeekRange(cWeekStart.toISOString(), cWeekEnd.toISOString());
    }
  }

  // ── Parse daily CSV ──
  const csvContent = await dailyCsvFile.text();
  const dailyRows = parseOverviewCsv(csvContent);
  let daily: ReturnType<typeof sumRows> | null = null;
  let dailyDate: string | null = null;

  if (dailyRows.length > 0) {
    daily = sumRows(dailyRows.map((r) => ({
      impressions: r.impressions,
      clicks: r.clicks,
      spent: r.spent,
      revenue: r.revenue,
      orders: r.orders,
      favorites: r.favorites,
      cart: r.cart,
    })));
    dailyDate = tgDate(dailyRows[0].date.toISOString());
  }

  if (!daily) {
    return NextResponse.json({ error: "Не удалось распознать CSV за вчера" }, { status: 400 });
  }

  // ── Build message ──
  const message = buildMessage({
    storeName: "RADEYA",
    overview,
    overviewRange,
    daily,
    dailyDate,
    campaigns: campaigns && campaigns.length > 0 ? campaigns : null,
    campaignRange,
  });

  // ── Send to all recipients ──
  const errors: string[] = [];
  let sent = 0;

  for (const chatId of recipients) {
    const result = await sendTelegramMessage(botToken, chatId, message);
    if (result.ok) {
      sent++;
    } else {
      errors.push(`${chatId}: ${result.error}`);
    }
  }

  return NextResponse.json({ sent, total: recipients.length, errors });
}
