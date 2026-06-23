"use client";

import { useCallback, useState } from "react";

interface SyncStatus {
  status: "idle" | "running" | "done" | "failed";
  progress: number;
  chunksDone: number;
  totalChunks: number;
  ordersSynced: number;
  error?: string;
}

/**
 * Drives chunked sync via repeated POST /sync calls. Each call processes one 3-day chunk.
 */
export function useSync(storeId: string) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [running, setRunning] = useState(false);

  /**
   * Запустить синхронизацию. `days` — за сколько последних дней тянуть
   * (365 = год, 14 = две недели). Без аргумента — дефолт сервера (год).
   */
  const startSync = useCallback(async (days?: number) => {
    if (running) return;
    setRunning(true);
    setStatus({ status: "running", progress: 0, chunksDone: 0, totalChunks: 0, ordersSynced: 0 });
    try {
      const startBody: Record<string, unknown> = { action: "start", force: true };
      if (days) {
        const to = new Date();
        const from = new Date(to.getTime() - days * 86_400_000);
        startBody.from = from.toISOString();
        startBody.to = to.toISOString();
      }
      await fetch(`/api/kaspi/stores/${storeId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startBody),
      });
      let current: SyncStatus["status"] = "running";
      while (current === "running") {
        await new Promise((r) => setTimeout(r, 300));
        const res = await fetch(`/api/kaspi/stores/${storeId}/sync`, { method: "POST" });
        const j = (await res.json()) as SyncStatus;
        setStatus(j);
        current = j.status;
      }
    } catch (err) {
      setStatus({
        status: "failed",
        progress: 0,
        chunksDone: 0,
        totalChunks: 0,
        ordersSynced: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
    }
  }, [storeId, running]);

  return { status, running, startSync };
}
