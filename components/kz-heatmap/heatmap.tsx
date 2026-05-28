"use client";

import { useCallback, useMemo, useState } from "react";
import { kazakhstanRegionPaths } from "./kazakhstan-paths";
import { OBLAST_NAMES, type OblastCode } from "@/lib/kaspi/kz-oblasts";
import { formatCompactMoney, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface OblastDatum {
  oblast_code: string;
  oblast_name: string;
  count: number;
  revenue: number;
  avg_check: number;
  cities: { city: string; orders: number; revenue: number }[];
}

type Metric = "revenue" | "count" | "avg_check";

const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Выручка",
  count: "Заказы",
  avg_check: "Средний чек",
};

/**
 * Linear-style heatmap scale: dim neutral (data = 0) → accent.
 * Using a single-hue luminance ramp — readable on dark background.
 */
function interpolateFill(t: number): string {
  if (t <= 0) return "rgba(255,255,255,0.04)";
  // Use Violet → Red mixed for heat feel (low → soft violet, high → saturated red)
  const stops: [number, number, number][] = [
    [30, 30, 50], // near-bg
    [74, 60, 140],
    [139, 92, 246], // violet
    [239, 68, 68], // red
    [185, 28, 28], // deep red
  ];
  const idx = Math.min(t * (stops.length - 1), stops.length - 1.0001);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, stops.length - 1);
  const f = idx - lo;
  const r = Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * f);
  const g = Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * f);
  const b = Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * f);
  return `rgb(${r},${g},${b})`;
}

export function KZHeatmap({ data, loading }: { data: OblastDatum[]; loading?: boolean }) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [hovered, setHovered] = useState<string | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const statMap = useMemo(() => {
    const m: Record<string, OblastDatum> = {};
    for (const d of data) m[d.oblast_code] = d;
    return m;
  }, [data]);

  const { min, max } = useMemo(() => {
    const vals = data.map((d) => d[metric]).filter((v) => v > 0);
    if (vals.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [data, metric]);

  const getFill = useCallback(
    (code: string) => {
      const s = statMap[code];
      if (!s || s[metric] === 0) return "rgba(255,255,255,0.03)";
      const t = max === min ? 0.5 : (s[metric] - min) / (max - min);
      return interpolateFill(t);
    },
    [statMap, metric, min, max],
  );

  const total = data.reduce((s, d) => s + d[metric], 0);
  const hoveredStat = hovered ? statMap[hovered] : null;

  return (
    <div>
      {/* Metric toggle */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-0.5">
          {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "h-6 rounded-[5px] px-2.5 text-[11px] font-medium transition-colors",
                metric === m
                  ? "bg-[var(--surface-hover)] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--border-strong)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]",
              )}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
        }}
      >
        {loading ? (
          <div className="aspect-[2/1] w-full animate-pulse rounded-[var(--radius)] bg-white/[0.03]" />
        ) : (
          <svg
            viewBox="0 0 1000 500"
            preserveAspectRatio="xMidYMid meet"
            className="h-auto w-full"
            role="img"
            aria-label="Карта Казахстана"
          >
            {Object.entries(kazakhstanRegionPaths).map(([code, d]) => {
              // Map old 14-oblast codes to new 20-region codes (best effort)
              const canonicalCode = code === "almaty_region" ? "almaty_oblast" : code;
              return (
                <path
                  key={code}
                  d={d}
                  fill={getFill(canonicalCode)}
                  stroke={hovered === canonicalCode ? "var(--accent)" : "rgba(255,255,255,0.12)"}
                  strokeWidth={hovered === canonicalCode ? 1.4 : 0.6}
                  onMouseEnter={() => setHovered(canonicalCode)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer", transition: "stroke 120ms ease" }}
                />
              );
            })}
          </svg>
        )}

        {/* Tooltip */}
        {hovered && hoveredStat && (
          <div
            className="pointer-events-none absolute z-10 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-elev)]/95 px-3 py-2 text-[11px] shadow-xl backdrop-blur-sm"
            style={{
              left: Math.min(mouse.x + 12, 800),
              top: Math.max(mouse.y - 10, 0),
              minWidth: 180,
            }}
          >
            <div className="mb-1 text-[12px] font-medium">
              {OBLAST_NAMES[hoveredStat.oblast_code as OblastCode] ?? hoveredStat.oblast_name}
            </div>
            <div className="space-y-0.5 text-[var(--text-dim)]">
              <div className="flex justify-between gap-3">
                <span>Выручка</span>
                <span className="font-medium tabular text-[var(--text)]">
                  {formatCompactMoney(hoveredStat.revenue)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Заказов</span>
                <span className="font-medium tabular text-[var(--text)]">
                  {formatNumber(hoveredStat.count)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Ср. чек</span>
                <span className="font-medium tabular text-[var(--text)]">
                  {formatMoney(Math.round(hoveredStat.avg_check))}
                </span>
              </div>
              {total > 0 && (
                <div className="mt-1 border-t border-[var(--border)] pt-1 text-[10px]">
                  {((hoveredStat[metric] / total) * 100).toFixed(1)}% от всех
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {!loading && (
        <div className="mt-3 flex items-center justify-between text-[10px] text-[var(--text-dim)] tabular">
          <span>
            {metric === "revenue"
              ? formatCompactMoney(min)
              : metric === "count"
                ? formatNumber(min)
                : formatCompactMoney(min)}
          </span>
          <div className="mx-3 h-2 flex-1 rounded-full bg-gradient-to-r from-[rgb(30,30,50)] via-[rgb(139,92,246)] to-[rgb(185,28,28)]" />
          <span>
            {metric === "revenue"
              ? formatCompactMoney(max)
              : metric === "count"
                ? formatNumber(max)
                : formatCompactMoney(max)}
          </span>
        </div>
      )}
    </div>
  );
}
