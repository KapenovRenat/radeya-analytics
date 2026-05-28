/**
 * POST /api/kaspi/ad/[storeId]/upload/campaigns
 *
 * Accepts multipart/form-data with multiple CSV files.
 * Each file = one week's «Отчёт по кампаниям».
 * Date range is parsed from the filename.
 *
 * Returns: { results: [{ filename, weekStart, weekEnd, upserted }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { parseCampaignsCsv, parseDateFromFilename } from "@/lib/ad/csv-parser";
import { ingestCampaigns } from "@/lib/ad/ingest";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const results = [];

  for (const file of files) {
    try {
      const dates = parseDateFromFilename(file.name);
      if (!dates) {
        results.push({
          filename: file.name,
          error: "Не удалось определить период из названия файла. Формат: YYYY-MM-DD - YYYY-MM-DD ...",
        });
        continue;
      }

      const content = await file.text();
      const rows = parseCampaignsCsv(content);

      if (rows.length === 0) {
        results.push({ filename: file.name, error: "Файл пустой или неверный формат" });
        continue;
      }

      // Detect monthly total: period > 10 days
      const days = (dates.weekEnd.getTime() - dates.weekStart.getTime()) / 86_400_000;
      const isMonthlyTotal = days > 10;

      const result = await ingestCampaigns(storeId, rows, dates.weekStart, dates.weekEnd, isMonthlyTotal);

      results.push({
        filename: file.name,
        weekStart: dates.weekStart,
        weekEnd: dates.weekEnd,
        isMonthlyTotal,
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
