/**
 * POST /api/kaspi/ad/[storeId]/upload/products
 *
 * Accepts multipart/form-data with:
 *   - files[]: CSV files (one per campaign per week)
 *   - campaignIds[]: campaign UUID for each file (same order as files)
 *
 * Date range is parsed from each filename.
 *
 * Returns: { results: [{ filename, campaignId, weekStart, weekEnd, upserted }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { parseProductsCsv, parseDateFromFilename } from "@/lib/ad/csv-parser";
import { ingestProducts } from "@/lib/ad/ingest";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const campaignIds = formData.getAll("campaignIds") as string[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length !== campaignIds.length) {
    return NextResponse.json(
      { error: "files and campaignIds must have the same length" },
      { status: 400 },
    );
  }

  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const campaignId = campaignIds[i];

    try {
      if (!campaignId) {
        results.push({ filename: file.name, error: "Не выбрана кампания" });
        continue;
      }

      const dates = parseDateFromFilename(file.name);
      if (!dates) {
        results.push({
          filename: file.name,
          error: "Не удалось определить период из названия файла. Формат: YYYY-MM-DD - YYYY-MM-DD ...",
        });
        continue;
      }

      const content = await file.text();
      const rows = parseProductsCsv(content);

      if (rows.length === 0) {
        results.push({ filename: file.name, error: "Файл пустой или неверный формат" });
        continue;
      }

      const days = (dates.weekEnd.getTime() - dates.weekStart.getTime()) / 86_400_000;
      const granularity: "week" | "day" = days === 0 ? "day" : "week";

      const result = await ingestProducts(storeId, campaignId, rows, dates.weekStart, dates.weekEnd, granularity);

      results.push({
        filename: file.name,
        campaignId,
        weekStart: dates.weekStart,
        weekEnd: dates.weekEnd,
        granularity,
        upserted: result.upserted,
      });
    } catch (err) {
      results.push({
        filename: file.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
