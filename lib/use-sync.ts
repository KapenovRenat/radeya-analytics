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

  const startSync = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      await fetch(`/api/kaspi/stores/${storeId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
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
