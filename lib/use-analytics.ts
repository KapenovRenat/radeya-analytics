"use client";

import { useEffect, useState } from "react";
import { useFilters } from "@/components/filters-bar";

export function useAnalytics<T>(storeId: string, endpoint: string) {
  const { from, to, granularity } = useFilters();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `/api/kaspi/analytics/${storeId}/${endpoint}?from=${from}&to=${to}&g=${granularity}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e?.error ?? `HTTP ${r.status}`)))))
      .then((j) => {
        if (!cancelled) setData(j as T);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, endpoint, from, to, granularity]);

  return { data, loading, error };
}
