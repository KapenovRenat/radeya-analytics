import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const [store] = await db
    .select({
      id: kaspiStores.id,
      name: kaspiStores.name,
      isActive: kaspiStores.isActive,
      lastSyncAt: kaspiStores.lastSyncAt,
      lastSyncStatus: kaspiStores.lastSyncStatus,
      lastSyncError: kaspiStores.lastSyncError,
      totalOrdersCount: kaspiStores.totalOrdersCount,
      createdAt: kaspiStores.createdAt,
    })
    .from(kaspiStores)
    .where(eq(kaspiStores.id, id))
    .limit(1);

  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ store });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const result = await db.delete(kaspiStores).where(eq(kaspiStores.id, id)).returning({ id: kaspiStores.id });
  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
