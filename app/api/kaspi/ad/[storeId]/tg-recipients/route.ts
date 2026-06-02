/**
 * GET  /api/kaspi/ad/[storeId]/tg-recipients  — list all
 * POST /api/kaspi/ad/[storeId]/tg-recipients  — add { name, chatId }
 * DELETE with ?id=uuid                         — remove one
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { tgRecipients } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const db = getDb();
  const rows = await db
    .select()
    .from(tgRecipients)
    .where(eq(tgRecipients.storeId, storeId))
    .orderBy(asc(tgRecipients.createdAt));
  return NextResponse.json({ recipients: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const { name, chatId } = await req.json() as { name: string; chatId: string };

  if (!name?.trim() || !chatId?.trim()) {
    return NextResponse.json({ error: "Имя и Chat ID обязательны" }, { status: 400 });
  }

  const db = getDb();
  const inserted = await db
    .insert(tgRecipients)
    .values({ storeId, name: name.trim(), chatId: chatId.trim() })
    .onConflictDoUpdate({
      target: [tgRecipients.storeId, tgRecipients.chatId],
      set: { name: name.trim() },
    })
    .returning();

  return NextResponse.json({ recipient: inserted[0] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  await db
    .delete(tgRecipients)
    .where(and(eq(tgRecipients.id, id), eq(tgRecipients.storeId, storeId)));

  return NextResponse.json({ ok: true });
}
