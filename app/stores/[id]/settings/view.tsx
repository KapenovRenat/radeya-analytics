"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSync } from "@/lib/use-sync";
import { formatDate, formatNumber } from "@/lib/format";

interface StoreInfo {
  id: string;
  name: string;
  totalOrdersCount: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export function SettingsView({ storeId, store }: { storeId: string; store: StoreInfo }) {
  const router = useRouter();
  const { status: syncStatus, running: syncing, startSync } = useSync(storeId);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Удалить магазин? Все заказы и история будут удалены.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/kaspi/stores/${storeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <PageShell title="Настройки магазина" subtitle={store.name}>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Информация о магазине</CardTitle>
            <CardDescription>Статус подключения, статистика и управление токеном</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-4 text-[12px] md:grid-cols-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                Название
              </div>
              <div className="mt-1 font-medium text-[var(--text)]">{store.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                Заказов в БД
              </div>
              <div className="mt-1 font-medium tabular text-[var(--text)]">
                {formatNumber(store.totalOrdersCount)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                Подключён
              </div>
              <div className="mt-1 font-medium tabular text-[var(--text)]">
                {formatDate(store.createdAt)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                Последняя синхронизация
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-medium tabular text-[var(--text)]">
                  {store.lastSyncAt ? formatDate(store.lastSyncAt) : "—"}
                </span>
                {store.lastSyncStatus === "done" && <Badge tone="emerald">готово</Badge>}
                {store.lastSyncStatus === "running" && <Badge tone="amber">синхронизация</Badge>}
                {store.lastSyncStatus === "failed" && <Badge tone="red">ошибка</Badge>}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Синхронизация</CardTitle>
            <CardDescription>
              Chunked sync обрабатывает по 3 дня за раз. Полная история за 365 дней занимает 2–10 минут в зависимости от плотности заказов.
            </CardDescription>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {syncStatus?.status === "running" && (
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-3 text-[12px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[var(--text-dim)]">
                  Чанк {syncStatus.chunksDone} / {syncStatus.totalChunks} ·{" "}
                  {formatNumber(syncStatus.ordersSynced)} заказов
                </span>
                <span className="font-semibold tabular">
                  {(syncStatus.progress * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${syncStatus.progress * 100}%` }}
                />
              </div>
            </div>
          )}
          {syncStatus?.status === "done" && (
            <div className="rounded-[var(--radius)] border border-[var(--emerald)]/30 bg-[var(--emerald-soft)]/40 px-3 py-2 text-[12px] text-[var(--emerald)]">
              ✓ Синхронизировано {formatNumber(syncStatus.ordersSynced)} заказов
            </div>
          )}
          {syncStatus?.status === "failed" && (
            <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--red)]/30 bg-[var(--red-soft)]/40 px-3 py-2 text-[12px] text-[var(--red)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{syncStatus.error ?? "Ошибка синхронизации"}</span>
            </div>
          )}
          {store.lastSyncError && !syncStatus && (
            <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--red)]/30 bg-[var(--red-soft)]/40 px-3 py-2 text-[12px] text-[var(--red)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Последняя ошибка: {store.lastSyncError}</span>
            </div>
          )}
          <Button variant="primary" onClick={() => startSync(365)} disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Синхронизация…" : "Запустить полную синхронизацию (365 дней)"}
          </Button>
        </CardBody>
      </Card>

      <Card className="border-[var(--red)]/25">
        <CardHeader>
          <div>
            <CardTitle>Опасная зона</CardTitle>
            <CardDescription>Удаление магазина — безвозвратная операция</CardDescription>
          </div>
        </CardHeader>
        <CardBody>
          {deleteError && (
            <div className="mb-3 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--red)]/30 bg-[var(--red-soft)]/40 px-3 py-2 text-[12px] text-[var(--red)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Удаляем…" : "Удалить магазин и всю историю"}
          </Button>
        </CardBody>
      </Card>
    </PageShell>
  );
}
