import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";
import { CreditView } from "./view";

export const dynamic = "force-dynamic";

export default async function CreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [store] = await getDb().select().from(kaspiStores).where(eq(kaspiStores.id, id)).limit(1);
  if (!store) notFound();
  return <CreditView storeId={id} storeName={store.name} />;
}
