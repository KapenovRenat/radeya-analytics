import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";
import { PageShell } from "@/components/page/page-shell";
import { SyncClient } from "./sync-client";

export const dynamic = "force-dynamic";

async function getStores() {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: kaspiStores.id,
        name: kaspiStores.name,
        lastSyncAt: kaspiStores.lastSyncAt,
        lastSyncStatus: kaspiStores.lastSyncStatus,
        lastSyncError: kaspiStores.lastSyncError,
        totalOrdersCount: kaspiStores.totalOrdersCount,
      })
      .from(kaspiStores)
      .orderBy(desc(kaspiStores.createdAt));
    return rows.map((s) => ({
      ...s,
      lastSyncAt: s.lastSyncAt ? s.lastSyncAt.toISOString() : null,
    }));
  } catch {
    return [];
  }
}

export default async function SyncPage() {
  const stores = await getStores();
  return (
    <PageShell title="Синхронизация" subtitle="Статус и история синхронизации с Kaspi API">
      <SyncClient stores={stores} />
    </PageShell>
  );
}
