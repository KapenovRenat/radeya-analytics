/**
 * Парсер Excel-выгрузки товаров из МойСклад.
 *
 * Маппинг по НАЗВАНИЯМ колонок (надёжнее чем по буквам — порядок может меняться).
 * Отображаемые поля вытаскиваем отдельно, всё остальное складываем в raw.
 */

import * as XLSX from "xlsx";

export interface ParsedProduct {
  externalUuid: string;
  code: string | null;
  name: string;
  salePrice: number;
  currency: string | null;
  barcode: string | null;
  kaspiUrl: string | null;
  brand: string | null;
  groupName: string | null;
  supplier: string | null;
  archived: boolean;
  whAstana: number;
  whPavlodar: number;
  whKostanay: number;
  whPetropavlovsk: number;
  whAlmaty: number;
  raw: Record<string, string>;
}

// Названия колонок в выгрузке МойСклад
const COL = {
  uuid: "UUID",
  code: "Код",
  name: "Наименование",
  price: "Цена: Цена продажи (реальная)",
  currency: "Валюта (Цена продажи (реальная))",
  barcode: "Штрихкод EAN13",
  kaspi: "Доп. поле: Ссылка на товар в Kaspi",
  brand: "Доп. поле: Бренд",
  group: "Группы",
  supplier: "Поставщик",
  archived: "Архивный",
  whAstana: "Доп. поле: Склад Астана",
  whPavlodar: "Доп. поле: Склад Павлодар",
  whKostanay: "Доп. поле: Склад Костанай",
  whPetropavlovsk: "Доп. поле: Склад Петропавловск",
  whAlmaty: "Доп. поле: Склад Алматы",
} as const;

/** "5" / "" → число дней (пусто → 0) */
function parseDays(s: string | undefined): number {
  if (!s) return 0;
  const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

/** "103 200,00" / "103200,00" → 103200 */
function parsePrice(s: string | undefined): number {
  if (!s) return 0;
  const clean = String(s).replace(/\s/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export function parseProductsXlsx(buffer: Buffer): ParsedProduct[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  // Array of objects keyed by header name
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const out: ParsedProduct[] = [];

  for (const row of rows) {
    const uuid = str(row[COL.uuid]);
    const name = str(row[COL.name]);
    if (!uuid || !name) continue; // пропускаем пустые/служебные строки

    // raw — все колонки как строки
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const val = str(v);
      if (val !== "") raw[k] = val;
    }

    out.push({
      externalUuid: uuid,
      code: str(row[COL.code]) || null,
      name,
      salePrice: parsePrice(str(row[COL.price])),
      currency: str(row[COL.currency]) || null,
      barcode: str(row[COL.barcode]) || null,
      kaspiUrl: str(row[COL.kaspi]) || null,
      brand: str(row[COL.brand]) || null,
      groupName: str(row[COL.group]) || null,
      supplier: str(row[COL.supplier]) || null,
      archived: str(row[COL.archived]).toLowerCase() === "да",
      whAstana: parseDays(str(row[COL.whAstana])),
      whPavlodar: parseDays(str(row[COL.whPavlodar])),
      whKostanay: parseDays(str(row[COL.whKostanay])),
      whPetropavlovsk: parseDays(str(row[COL.whPetropavlovsk])),
      whAlmaty: parseDays(str(row[COL.whAlmaty])),
      raw,
    });
  }

  return out;
}
