import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";
import { SettingsView } from "./view";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [store] = await getDb().select().from(kaspiStores).where(eq(kaspiStores.id, id)).limit(1);
  if (!store) notFound();
  return (
    <SettingsView
      storeId={id}
      store={{
        id: store.id,
        name: store.name,
        totalOrdersCount: store.totalOrdersCount,
        lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: store.lastSyncStatus ?? null,
        lastSyncError: store.lastSyncError ?? null,
        createdAt: store.createdAt.toISOString(),
      }}
    />
  );
}
