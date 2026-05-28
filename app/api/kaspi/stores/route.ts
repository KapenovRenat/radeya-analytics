import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";
import { encryptToken } from "@/lib/kaspi/fernet";
import { testToken } from "@/lib/kaspi/client";

export async function GET() {
  const db = getDb();
  const stores = await db
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
    .orderBy(desc(kaspiStores.createdAt));
  return NextResponse.json({ stores });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const apiToken = typeof body?.apiToken === "string" ? body.apiToken.trim() : "";

  if (!name || !apiToken) {
    return NextResponse.json({ error: "name and apiToken required" }, { status: 400 });
  }

  const test = await testToken(apiToken);
  if (!test.valid) {
    return NextResponse.json({ error: `Token validation failed: ${test.error}` }, { status: 400 });
  }

  const db = getDb();
  const encrypted = encryptToken(apiToken);
  const [created] = await db
    .insert(kaspiStores)
    .values({ name, encryptedToken: encrypted, isActive: true })
    .returning({
      id: kaspiStores.id,
      name: kaspiStores.name,
      createdAt: kaspiStores.createdAt,
    });

  return NextResponse.json({ store: created, kaspiTotalCount: test.totalCount }, { status: 201 });
}
