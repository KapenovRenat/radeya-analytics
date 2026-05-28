import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Store as StoreIcon } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * Store-scoped layout — thin context strip only.
 *
 * The global sidebar (SidebarServer) handles section navigation, so we no
 * longer render a per-store top-bar with route tabs. A compact 40px strip
 * just confirms which store the user is inside.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [store] = await db.select().from(kaspiStores).where(eq(kaspiStores.id, id)).limit(1);
  if (!store) notFound();

  return (
    <>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-6">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-white/[0.04] text-[9px] font-semibold">
          {store.name.slice(0, 2).toUpperCase()}
        </div>
        <span className="text-[12px] font-medium text-[var(--text)]">{store.name}</span>
        <span className="text-[10px] text-[var(--text-subtle)]">Kaspi</span>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
          <StoreIcon className="h-3 w-3" />
          <span className="tabular">{store.totalOrdersCount.toLocaleString("ru-RU")} заказов</span>
        </div>
      </div>
      {children}
    </>
  );
}
