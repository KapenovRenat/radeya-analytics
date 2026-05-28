"use client";

import { useCallback, useEffect, useState } from "react";

export interface EntriesSyncStatus {
  status: "idle" | "running" | "done" | "failed";
  progress: number;
  ordersProcessed: number;
  totalOrders: number;
  entriesSynced: number;
  error?: string;
}

export function useEntriesSync(storeId: string) {
  const [status, setStatus] = useState<EntriesSyncStatus | null>(null);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/kaspi/stores/${storeId}/sync-entries`);
    if (res.ok) setStatus(await res.json());
  }, [storeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const start = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      await fetch(`/api/kaspi/stores/${storeId}/sync-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      let state: EntriesSyncStatus["status"] = "running";
      while (state === "running") {
        await new Promise((r) => setTimeout(r, 300));
        const res = await fetch(`/api/kaspi/stores/${storeId}/sync-entries`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as EntriesSyncStatus;
        setStatus(j);
        state = j.status;
      }
    } catch (err) {
      setStatus((s) =>
        s
          ? { ...s, status: "failed", error: err instanceof Error ? err.message : String(err) }
          : null,
      );
    } finally {
      setRunning(false);
    }
  }, [storeId, running]);

  return { status, running, start, refresh };
}
