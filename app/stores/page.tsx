import Link from "next/link";
import { desc } from "drizzle-orm";
import { ArrowRight, Plus, Store as StoreIcon } from "lucide-react";
import { getDb } from "@/lib/db/client";
import { kaspiStores } from "@/lib/db/schema";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AddStoreForm } from "../_components/add-store-form";

export const dynamic = "force-dynamic";

async function getStores() {
  try {
    const db = getDb();
    return await db
      .select({
        id: kaspiStores.id,
        name: kaspiStores.name,
        isActive: kaspiStores.isActive,
        lastSyncAt: kaspiStores.lastSyncAt,
        lastSyncStatus: kaspiStores.lastSyncStatus,
        totalOrdersCount: kaspiStores.totalOrdersCount,
        createdAt: kaspiStores.createdAt,
      })
      .from(kaspiStores)
      .orderBy(desc(kaspiStores.createdAt));
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "done")
    return <Badge tone="emerald">● готово</Badge>;
  if (status === "running")
    return <Badge tone="amber">● синхронизация</Badge>;
  if (status === "failed")
    return <Badge tone="red">● ошибка</Badge>;
  return <Badge>— не синхронизирован</Badge>;
}

export default async function HomePage() {
  const stores = await getStores();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-dim)]">
          <StoreIcon className="h-3 w-3" />
          Niche Analytics
        </div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Магазины Kaspi</h1>
        <p className="mt-1.5 text-[13px] text-[var(--text-dim)]">
          Подключите Kaspi-кабинет — получите 8 аналитических секций с детальными графиками, KZ-хитмапой и отслеживанием операционного здоровья.
        </p>
      </header>

      {stores === null ? (
        <Card className="border-[var(--red)]/30 bg-[var(--red-soft)] p-5">
          <div className="text-[13px] font-medium text-[var(--red)]">База не подключена</div>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">
            Установите <code className="mono rounded bg-black/40 px-1">POSTGRES_URL</code> и выполните{" "}
            <code className="mono rounded bg-black/40 px-1">drizzle-kit push</code>.
          </p>
        </Card>
      ) : stores.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04]">
            <StoreIcon className="h-4 w-4 text-[var(--text-dim)]" />
          </div>
          <div className="text-[14px] font-medium">Нет подключённых магазинов</div>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">
            Добавьте первый магазин — через минуту увидите первые графики.
          </p>
        </Card>
      ) : (
        <div className="mb-8 grid gap-2">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/stores/${s.id}/dashboard`}
              className="group flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4 transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-white/[0.04] text-[12px] font-semibold">
                  {s.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{s.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--text-dim)] tabular">
                    <span>{formatNumber(s.totalOrdersCount)} заказов</span>
                    <span className="text-[var(--text-subtle)]">·</span>
                    <span>с {formatDate(s.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="hidden sm:block tabular text-[var(--text-dim)]">
                  {s.lastSyncAt ? formatDate(s.lastSyncAt) : "—"}
                </div>
                <StatusBadge status={s.lastSyncStatus} />
                <ArrowRight className="h-4 w-4 text-[var(--text-dim)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-3.5 w-3.5 text-[var(--text-dim)]" />
          <h2 className="text-[13px] font-medium">Добавить магазин</h2>
        </div>
        <AddStoreForm />
      </Card>
    </div>
  );
}
