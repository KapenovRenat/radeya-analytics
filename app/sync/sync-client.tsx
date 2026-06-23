"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw, CalendarClock, CalendarDays, AlertTriangle,
  CheckCircle2, Loader2, Store as StoreIcon, History, Plus, Trash2,
} from "lucide-react";
import { useSync } from "@/lib/use-sync";
import { useEntriesSync } from "@/lib/use-entries-sync";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreRow {
  id: string;
  name: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  totalOrdersCount: number;
}

interface HistoryRow {
  id: string;
  periodFrom: string | null;
  periodTo: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationSec: number | null;
  ordersSynced: number | null;
  status: string;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null | undefined): string {
  if (!sec || sec < 1) return "< 1 сек";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} сек`;
  return `${m} мин ${s} сек`;
}

function fmtPeriod(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const f = new Date(from).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const t = new Date(to).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${f} — ${t}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "done") return <Badge tone="emerald">● готово</Badge>;
  if (status === "running") return <Badge tone="amber">● синхронизация</Badge>;
  if (status === "failed") return <Badge tone="red">● ошибка</Badge>;
  return <Badge>— не синхронизирован</Badge>;
}

// ─── Per-store card ───────────────────────────────────────────────────────────

function StoreSyncCard({ store }: { store: StoreRow }) {
  const router = useRouter();
  const { status, running, startSync } = useSync(store.id);
  const { status: entriesStatus, running: entriesRunning, start: startEntries } = useEntriesSync(store.id);
  const [phase, setPhase] = useState<"orders" | "entries" | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try {
      await fetch(`/api/kaspi/stores/${store.id}/orders-reset`, { method: "DELETE" });
      setHistory([]);
      router.refresh();
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  // Синк заказов → потом синк состава (позиций)
  const handleSync = async (days: number) => {
    if (phase) return;
    setPhase("orders");
    await startSync(days);
    setPhase("entries");
    await startEntries();
    setPhase(null);
  };
  const busy = phase !== null || running || entriesRunning;

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/kaspi/stores/${store.id}/sync-history`);
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch {
      /* ignore */
    }
  }, [store.id]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Refresh history once a sync finishes
  useEffect(() => {
    if (status && (status.status === "done" || status.status === "failed")) {
      loadHistory();
    }
  }, [status, loadHistory]);

  // Effective status: live sync status takes priority, else last saved
  const liveStatus = status?.status;
  const effectiveStatus = liveStatus ?? store.lastSyncStatus;
  const showError = (liveStatus === "failed" && status?.error) || (!liveStatus && store.lastSyncStatus === "failed" && store.lastSyncError);
  const errorText = status?.error ?? store.lastSyncError;

  return (
    <Card className="flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <StoreIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-[var(--text)]">{store.name}</p>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
              {formatNumber(store.totalOrdersCount)} заказов · последняя синхр.: {store.lastSyncAt ? formatDate(store.lastSyncAt) : "никогда"}
            </p>
          </div>
        </div>
        <StatusBadge status={effectiveStatus} />
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSync(365)}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-[12px] font-medium transition-colors",
            busy
              ? "cursor-not-allowed bg-[var(--surface-elev)] text-[var(--text-subtle)]"
              : "bg-[var(--accent)] text-white hover:opacity-90",
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Синхронизация за год
        </button>
        <button
          onClick={() => handleSync(14)}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-3 py-2 text-[12px] font-medium transition-colors",
            busy
              ? "cursor-not-allowed border-[var(--border)] text-[var(--text-subtle)]"
              : "border-[var(--border-strong)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          За последние 14 дней
        </button>

        {/* Очистить заказы — danger, с подтверждением */}
        {confirmClear ? (
          <div className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--red)]/40 bg-[var(--red-soft)] px-2.5 py-2 text-[11px]">
            <span className="text-[var(--red)]">Удалить все заказы?</span>
            <button onClick={handleClear} disabled={clearing}
              className="rounded px-1.5 py-0.5 font-medium text-[var(--red)] hover:bg-[var(--red)]/15">
              {clearing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Да, очистить"}
            </button>
            <button onClick={() => setConfirmClear(false)} disabled={clearing}
              className="rounded px-1.5 py-0.5 text-[var(--text-dim)] hover:bg-white/[0.06]">Нет</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={busy}
            title="Удалить все заказы и состояние синхронизации, чтобы синхронизировать заново"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] px-3 py-2 text-[12px] font-medium text-[var(--text-dim)] hover:border-[var(--red)]/50 hover:text-[var(--red)] disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Очистить заказы
          </button>
        )}
      </div>

      {/* Live progress — заказы */}
      {(phase === "orders" || (running && !phase)) && status && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-elev)]">
            <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.round((status.progress ?? 0) * 100)}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Заказы · чанк {status.chunksDone}/{status.totalChunks} · {formatNumber(status.ordersSynced)} загружено
          </p>
        </div>
      )}

      {/* Live progress — позиции (состав) */}
      {phase === "entries" && entriesStatus && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-elev)]">
            <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${Math.round((entriesStatus.progress ?? 0) * 100)}%` }} />
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Состав заказов · {entriesStatus.ordersProcessed}/{entriesStatus.totalOrders} · {formatNumber(entriesStatus.entriesSynced)} позиций
          </p>
        </div>
      )}

      {/* Done flash */}
      {!busy && liveStatus === "done" && status && (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--emerald)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Готово — синхронизировано {formatNumber(status.ordersSynced)} заказов
        </p>
      )}

      {/* Error */}
      {showError && errorText && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-[11px] text-[var(--red)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{errorText}</span>
        </div>
      )}

      {/* History toggle */}
      <div className="border-t border-[var(--border)] pt-3">
        <button
          onClick={() => setHistoryOpen((s) => !s)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <History className="h-3.5 w-3.5" />
          История синков {history.length > 0 && `(${history.length})`}
          <span className="text-[var(--text-subtle)]">{historyOpen ? "▲" : "▼"}</span>
        </button>

        {historyOpen && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            {history.length === 0 && (
              <p className="text-[11px] text-[var(--text-subtle)]">Синков ещё не было</p>
            )}
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[11px]"
              >
                <span className="shrink-0">
                  {h.status === "done"
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--emerald)]" />
                    : <AlertTriangle className="h-3.5 w-3.5 text-[var(--red)]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--text)]">{fmtPeriod(h.periodFrom, h.periodTo)}</p>
                  <p className="text-[10px] text-[var(--text-subtle)]">
                    {fmtDateTime(h.finishedAt)} · {fmtDuration(h.durationSec)}
                    {h.error && <span className="text-[var(--red)]"> · {h.error}</span>}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums text-[var(--text-dim)]">
                  {formatNumber(h.ordersSynced)} зак.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SyncClient({ stores }: { stores: StoreRow[] }) {
  if (stores.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center">
        <p className="text-[14px] font-medium text-[var(--text)]">Магазинов пока нет</p>
        <p className="mt-1 text-[12px] text-[var(--text-dim)]">Добавь магазин с Kaspi-токеном, чтобы синхронизировать заказы</p>
        <Link
          href="/stores"
          className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Перейти к магазинам
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
        <RefreshCw className="h-3.5 w-3.5" />
        Синхронизация тянет заказы из Kaspi API за выбранный период и сохраняет в базу
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {stores.map((s) => (
          <StoreSyncCard key={s.id} store={s} />
        ))}
      </div>
    </div>
  );
}
