/**
 * Kaspi Advertising CSV parser.
 *
 * Handles two report types exported from Kaspi Merchant Cabinet:
 *  1. «Отчёт по кампаниям» — one row per campaign, all campaigns
 *  2. «Отчёт по товарам»   — one row per SKU, single campaign
 *
 * Both files use semicolon delimiter, UTF-8 BOM, comma as decimal separator.
 * Date range is parsed from the filename: "2026-05-18 - 2026-05-24 Отчёт..."
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedCampaignRow {
  name: string;
  status: "on" | "off";
  impressions: number;
  clicks: number;
  ctrPct: number;
  avgClick: number;
  spent: number;
  revenue: number;
  orders: number;
  favorites: number;
  cart: number;
  drrPct: number | null;        // null = "Нет заказов"
  convCartPct: number;          // calculated: cart / clicks * 100
  convFavPct: number;           // calculated: favorites / clicks * 100
  rating: "good" | "normal" | "bad" | "no_data";
}

export interface ParsedProductRow {
  kaspiProductId: string;
  name: string;
  category: string;
  status: "active" | "inactive";
  impressions: number;
  clicks: number;
  ctrPct: number;
  avgClick: number;
  spent: number;
  revenue: number;
  orders: number;
  favorites: number;
  cart: number;
  drrPct: number | null;
  convCartPct: number;
  convFavPct: number;
  rating: "good" | "normal" | "bad" | "no_data";
}

export interface FileDateRange {
  weekStart: Date;
  weekEnd: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "2026-05-18 - 2026-05-24 Отчёт по кампаниям.csv" → { weekStart, weekEnd } */
export function parseDateFromFilename(filename: string): FileDateRange | null {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return {
    weekStart: new Date(match[1] + "T00:00:00Z"),
    weekEnd: new Date(match[2] + "T00:00:00Z"),
  };
}

/** "1,77" → 1.77 */
function parseNum(s: string): number {
  if (!s || s.trim() === "" || s.trim() === "-") return 0;
  return parseFloat(s.replace(",", ".")) || 0;
}

/** "Нет заказов" or "0" or "7,1" → number | null */
function parseDrr(s: string): number | null {
  if (!s || s.trim() === "Нет заказов" || s.trim() === "") return null;
  return parseNum(s);
}

/** Calculate rating based on Kaspi mebel niche norms */
function calcRating(
  spent: number,
  orders: number,
  drrPct: number | null,
): "good" | "normal" | "bad" | "no_data" {
  if (spent === 0) return "no_data";
  if (drrPct === null) {
    // no orders — bad if spent > 3000
    return spent > 3000 ? "bad" : "no_data";
  }
  if (orders > 0 && drrPct <= 8) return "good";
  if (drrPct <= 15) return "normal";
  return "bad";
}

/** Extract category from product name: "RADEYA диван Симпл..." → "Диваны" */
export function extractCategory(productName: string): string {
  const clean = productName.replace(/^RADEYA\s+/i, "").toLowerCase();
  if (clean.startsWith("диван") || clean.startsWith("мини-диван")) return "Диваны";
  if (clean.startsWith("кресло")) return "Кресла";
  if (clean.startsWith("кушетка")) return "Кушетки";
  if (clean.startsWith("пуф")) return "Пуфы";
  if (clean.startsWith("стеллаж") || clean.startsWith("полк") || clean.startsWith("шкаф")) return "Стеллажи";
  if (clean.startsWith("обувниц") || clean.startsWith("обувница")) return "Обувницы";
  if (clean.startsWith("картин")) return "Картины";
  return "Другое";
}

/** Strip UTF-8 BOM if present */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Split CSV line respecting semicolons */
function splitLine(line: string): string[] {
  return line.split(";").map((c) => c.trim());
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse «Отчёт по кампаниям» CSV content.
 * Skips header row, returns one entry per campaign.
 */
export function parseCampaignsCsv(content: string): ParsedCampaignRow[] {
  const lines = stripBom(content).split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows: ParsedCampaignRow[] = [];

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 12) continue;

    const name = cols[0];
    if (!name) continue;

    const statusRaw = cols[1].toLowerCase();
    const status: "on" | "off" = statusRaw === "активная" ? "on" : "off";

    const impressions = parseNum(cols[2]);
    const clicks = parseNum(cols[3]);
    const ctrPct = parseNum(cols[4]);
    const avgClick = parseNum(cols[5]);
    const spent = parseNum(cols[6]);
    const revenue = parseNum(cols[7]);
    const orders = parseNum(cols[8]);
    const favorites = parseNum(cols[9]);
    const cart = parseNum(cols[10]);
    const drrPct = parseDrr(cols[11]);

    const convCartPct = clicks > 0 ? (cart / clicks) * 100 : 0;
    const convFavPct = clicks > 0 ? (favorites / clicks) * 100 : 0;
    const rating = calcRating(spent, orders, drrPct);

    rows.push({
      name,
      status,
      impressions,
      clicks,
      ctrPct,
      avgClick,
      spent,
      revenue,
      orders,
      favorites,
      cart,
      drrPct,
      convCartPct,
      convFavPct,
      rating,
    });
  }

  return rows;
}

/**
 * Parse «Отчёт по товарам» CSV content.
 * Skips header row, returns one entry per SKU.
 */
export function parseProductsCsv(content: string): ParsedProductRow[] {
  const lines = stripBom(content).split(/\r?\n/).filter((l) => l.trim() !== "");
  const rows: ParsedProductRow[] = [];

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 16) continue;

    const kaspiProductId = cols[0];
    const name = cols[1];
    if (!name) continue;

    const statusRaw = cols[2].toLowerCase();
    const status: "active" | "inactive" = statusRaw === "активный" ? "active" : "inactive";

    const impressions = parseNum(cols[3]);
    const clicks = parseNum(cols[4]);
    const ctrPct = parseNum(cols[5]);
    const avgClick = parseNum(cols[6]);
    const spent = parseNum(cols[7]);
    const revenue = parseNum(cols[8]);
    const orders = parseNum(cols[9]);
    const favorites = parseNum(cols[14]);
    const cart = parseNum(cols[15]);
    const drrPct = parseDrr(cols[16]);

    const convCartPct = clicks > 0 ? (cart / clicks) * 100 : 0;
    const convFavPct = clicks > 0 ? (favorites / clicks) * 100 : 0;
    const rating = calcRating(spent, orders, drrPct);
    const category = extractCategory(name);

    rows.push({
      kaspiProductId,
      name,
      category,
      status,
      impressions,
      clicks,
      ctrPct,
      avgClick,
      spent,
      revenue,
      orders,
      favorites,
      cart,
      drrPct,
      convCartPct,
      convFavPct,
      rating,
    });
  }

  return rows;
}
