"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, RefreshCw, ChevronDown, ChevronRight,
  Upload, FileText, CheckCircle, XCircle, X,
  Search, ArrowUpDown, GitCompareArrows,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeekSelector, fmtWeekLabel, type WeekOption } from "@/components/ad/week-selector";
import {
  LineChart, Line, ResponsiveContainer, Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekStat {
  id: string;
  weekStart: string;
  weekEnd: string;
  impressions: number;
  spent: number;
  targetClick: number;
  avgClick: number;
  orders: number;
  revenue: number;
  drrPct: number;
  ctrPct: number;
  convCartPct: number;
  convFavPct: number;
  rating: string;
}

interface Product {
  id: string;
  campaignId: string;
  campaignName: string;
  name: string;
  category: string;
  status: string;       // "active" | "inactive"
  improveCard: string;  // "yes" | "no" | "maybe"
  hasReviews: boolean;
  hasDiscount: boolean;
  inStock: boolean;
  hasVideo: boolean;
  weeks: WeekStat[];
}

interface Period {
  weekStart: string;
  weekEnd: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

type SortKey = "" | "spent" | "impressions" | "orders" | "ctrPct" | "drrPct" | "convCartPct";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return n.toLocaleString("ru-RU");
}
function fmtPct(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return n.toFixed(2) + "%";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}

function RatingBadge({ rating }: { rating: string }) {
  if (rating === "good")   return <span className="text-[11px] font-medium text-[var(--emerald)]">● Хорошо</span>;
  if (rating === "normal") return <span className="text-[11px] font-medium text-[var(--amber)]">● Норм.</span>;
  if (rating === "bad")    return <span className="text-[11px] font-medium text-[var(--red)]">● Плохо</span>;
  return <span className="text-[11px] text-[var(--text-subtle)]">— Нет данных</span>;
}

// ─── Inline Dropdown ──────────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string; color?: string; }

function InlineDropdown({ value, options, onSave }: {
  value: string; options: DropdownOption[]; onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((s) => !s)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-white/10",
          current?.color ?? "text-[var(--text-dim)]",
        )}
      >
        {current?.label ?? value}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[110px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] py-1 shadow-lg">
          {options.map((o) => (
            <button key={o.value}
              onClick={() => { onSave(o.value); setOpen(false); }}
              className={cn("flex w-full items-center px-3 py-1.5 text-[12px] hover:bg-white/[0.06]",
                o.value === value ? "font-medium" : "", o.color ?? "text-[var(--text)]")}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "active",   label: "● Активный",   color: "text-[var(--emerald)]" },
  { value: "inactive", label: "○ Неактивный", color: "text-[var(--text-dim)]" },
];
const IMPROVE_OPTIONS: DropdownOption[] = [
  { value: "yes",   label: "Да",       color: "text-[var(--emerald)]" },
  { value: "maybe", label: "Возможно", color: "text-[var(--amber)]" },
  { value: "no",    label: "Нет",      color: "text-[var(--text-dim)]" },
];
const BOOL_OPTIONS: DropdownOption[] = [
  { value: "true",  label: "Да",  color: "text-[var(--emerald)]" },
  { value: "false", label: "Нет", color: "text-[var(--text-dim)]" },
];

// ─── Editable number ──────────────────────────────────────────────────────────

function EditableNum({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const n = parseFloat(draft.replace(",", "."));
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input ref={inputRef} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 rounded border border-[var(--accent)] bg-[var(--surface-elev)] px-1.5 py-0.5 text-right text-[12px] tabular-nums outline-none"
      />
    );
  }
  return (
    <span onClick={() => { setDraft(String(value || "")); setEditing(true); }}
      className="cursor-text rounded px-1 py-0.5 tabular-nums hover:bg-white/10"
      title="Кликни чтобы изменить">
      {value ? fmt(value) : <span className="text-[var(--text-subtle)]">—</span>}
    </span>
  );
}

// ─── Comparison Modal ─────────────────────────────────────────────────────────

type WeekTotal = {
  weekStart: string; weekEnd: string;
  spent: number; impressions: number; orders: number;
  drrPct: number; ctrPct: number; convCartPct: number; convFavPct: number; avgClick: number;
};

interface CompareMetric { key: keyof WeekTotal; label: string; fmt: (v: number) => string; higherIsBetter: boolean; }

const COMPARE_METRICS: CompareMetric[] = [
  { key: "spent",       label: "Расход",          fmt: (v) => v.toLocaleString("ru-RU") + " тг", higherIsBetter: false },
  { key: "impressions", label: "Показы",           fmt: (v) => v.toLocaleString("ru-RU"),          higherIsBetter: true  },
  { key: "orders",      label: "Заказы",           fmt: (v) => String(v),                          higherIsBetter: true  },
  { key: "drrPct",      label: "ДРР%",             fmt: (v) => v.toFixed(1) + "%",                 higherIsBetter: false },
  { key: "ctrPct",      label: "CTR%",             fmt: (v) => v.toFixed(2) + "%",                 higherIsBetter: true  },
  { key: "convCartPct", label: "Конв→корзину%",    fmt: (v) => v.toFixed(2) + "%",                 higherIsBetter: true  },
  { key: "convFavPct",  label: "Конв→избранное%",  fmt: (v) => v.toFixed(2) + "%",                 higherIsBetter: true  },
  { key: "avgClick",    label: "Ср. клик",         fmt: (v) => v.toFixed(0) + " тг",              higherIsBetter: false },
];

function CompareModal({ products, periods, onClose }: {
  products: Product[]; periods: Period[]; onClose: () => void;
}) {
  const totals: WeekTotal[] = periods.map((p) => {
    let spent = 0, impressions = 0, orders = 0, drrSum = 0, ctrSum = 0, convCartSum = 0, convFavSum = 0, avgClickSum = 0, count = 0;
    for (const prod of products) {
      const s = prod.weeks.find((w) => w.weekStart === p.weekStart);
      if (s) {
        spent += s.spent ?? 0; impressions += s.impressions ?? 0; orders += s.orders ?? 0;
        drrSum += s.drrPct ?? 0; ctrSum += s.ctrPct ?? 0; convCartSum += s.convCartPct ?? 0;
        convFavSum += s.convFavPct ?? 0; avgClickSum += s.avgClick ?? 0; count++;
      }
    }
    const avg = (v: number) => (count > 0 ? v / count : 0);
    return { weekStart: p.weekStart, weekEnd: p.weekEnd, spent, impressions, orders,
      drrPct: avg(drrSum), ctrPct: avg(ctrSum), convCartPct: avg(convCartSum),
      convFavPct: avg(convFavSum), avgClick: avg(avgClickSum) };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-h-[85vh] w-full max-w-[900px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text)]">Сравнение недель</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">Суммарные показатели по {products.length} товарам</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-[var(--text-dim)] hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="py-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] min-w-[120px]">Метрика</th>
                {periods.map((p) => (
                  <th key={p.weekStart} className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)] whitespace-nowrap">
                    {fmtDate(p.weekStart)} — {fmtDate(p.weekEnd)}
                  </th>
                ))}
                {periods.length >= 2 && (
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--accent)] whitespace-nowrap">Δ нед 1→{periods.length}</th>
                )}
                <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-dim)]">Тренд</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map((metric) => {
                const values = totals.map((t) => (t[metric.key] as number) ?? 0);
                const first = values[0] ?? 0;
                const last = values[values.length - 1] ?? 0;
                const diff = last - first;
                const pct = first !== 0 ? (diff / first) * 100 : 0;
                const isPositive = periods.length >= 2 && (metric.higherIsBetter ? diff > 0 : diff < 0);
                const isNegative = periods.length >= 2 && (metric.higherIsBetter ? diff < 0 : diff > 0);
                const sparkData = values.map((v, i) => ({ i, v }));
                return (
                  <tr key={metric.key} className="border-b border-[var(--border)]/40 hover:bg-white/[0.02]">
                    <td className="py-2 pr-4 font-medium text-[var(--text)]">{metric.label}</td>
                    {values.map((v, vi) => (
                      <td key={vi} className="px-3 py-2 text-right tabular-nums text-[var(--text)]">{metric.fmt(v)}</td>
                    ))}
                    {periods.length >= 2 && (
                      <td className={cn("px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap",
                        isPositive ? "text-[var(--emerald)]" : isNegative ? "text-[var(--red)]" : "text-[var(--text-dim)]")}>
                        {diff !== 0 ? `${diff > 0 ? "+" : ""}${metric.fmt(diff)} (${pct > 0 ? "+" : ""}${pct.toFixed(1)}%)` : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {values.length >= 2 && (
                        <ResponsiveContainer width={80} height={24}>
                          <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                            <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5}
                              stroke={isPositive ? "var(--emerald)" : isNegative ? "var(--red)" : "var(--text-dim)"} />
                            <Tooltip content={({ active, payload }) =>
                              active && payload?.length
                                ? <div className="rounded border border-[var(--border)] bg-[var(--surface-elev)] px-2 py-1 text-[10px]">{metric.fmt(payload[0].value as number)}</div>
                                : null} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Category Group ───────────────────────────────────────────────────────────

function CategoryGroup({ category, products, periods, storeId, onUpdate, sortBy }: {
  category: string; products: Product[]; periods: Period[];
  storeId: string; onUpdate: (productId: string, field: string, value: unknown) => void;
  sortBy: SortKey;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lastPeriod = periods[periods.length - 1];

  const sorted = [...products].sort((a, b) => {
    if (!sortBy || !lastPeriod) return 0;
    const getVal = (p: Product) => {
      const s = p.weeks.find((w) => w.weekStart === lastPeriod.weekStart);
      return (s?.[sortBy] as number) ?? -Infinity;
    };
    return sortBy === "drrPct" ? getVal(a) - getVal(b) : getVal(b) - getVal(a);
  });

  const patchProduct = async (productId: string, field: string, value: unknown) => {
    await fetch(`/api/kaspi/ad/${storeId}/products`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "product", id: productId, field, value }),
    });
    onUpdate(productId, field, value);
  };

  const patchStat = async (statId: string, productId: string, field: string, value: unknown) => {
    await fetch(`/api/kaspi/ad/${storeId}/products`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stat", id: statId, field, value }),
    });
    onUpdate(productId, `__stat__${statId}__${field}`, value);
  };

  // Category totals
  const catTotals = periods.map((p) => {
    let spent = 0, impressions = 0, orders = 0;
    for (const prod of products) {
      const s = prod.weeks.find((w) => w.weekStart === p.weekStart);
      if (s) { spent += s.spent ?? 0; impressions += s.impressions ?? 0; orders += s.orders ?? 0; }
    }
    return { weekStart: p.weekStart, spent, impressions, orders };
  });

  const COLS = 10; // per period

  return (
    <>
      {/* Category header */}
      <tr className="border-b border-t border-[var(--border)] bg-[var(--bg-subtle)]">
        <td className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-1.5 cursor-pointer"
          colSpan={7 + periods.length * COLS}
          onClick={() => setCollapsed((s) => !s)}>
          <div className="flex items-center gap-2">
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              : <ChevronDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />}
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{category}</span>
            <span className="text-[11px] text-[var(--text-subtle)]">· {products.length} товаров</span>
          </div>
        </td>
      </tr>

      {!collapsed && sorted.map((p, pi) => {
        const statMap = new Map<string, WeekStat>();
        for (const w of p.weeks) statMap.set(w.weekStart, w);

        return (
          <tr key={p.id} className={cn("border-b border-[var(--border)] transition-colors hover:bg-white/[0.02]", pi % 2 !== 0 && "bg-white/[0.01]")}>
            {/* Product name */}
            <td className="sticky left-0 z-10 bg-[var(--bg)] px-4 py-2 min-w-[240px] max-w-[300px]">
              <span className="block truncate text-[12px] font-medium text-[var(--text)]" title={p.name}>{p.name}</span>
              <span className="block truncate text-[10px] text-[var(--text-subtle)]">{p.campaignName}</span>
            </td>
            <td className="px-3 py-2 text-center">
              <InlineDropdown value={p.status ?? "active"} options={STATUS_OPTIONS}
                onSave={(v) => patchProduct(p.id, "status", v)} />
            </td>
            <td className="px-3 py-2 text-center">
              <InlineDropdown value={p.improveCard ?? "no"} options={IMPROVE_OPTIONS}
                onSave={(v) => patchProduct(p.id, "improveCard", v)} />
            </td>
            {(["hasReviews", "hasDiscount", "inStock", "hasVideo"] as const).map((field) => (
              <td key={field} className="px-3 py-2 text-center">
                <InlineDropdown value={String(p[field] ?? false)} options={BOOL_OPTIONS}
                  onSave={(v) => patchProduct(p.id, field, v === "true")} />
              </td>
            ))}

            {/* Per-week stats */}
            {periods.map((period) => {
              const s = statMap.get(period.weekStart);
              const hasSpend = (s?.spent ?? 0) > 0;
              const hasOrders = (s?.orders ?? 0) > 0;
              return [
                <td key={`${period.weekStart}-spent`} className={cn("border-l border-[var(--border)] px-2 py-2 text-right whitespace-nowrap tabular-nums", hasSpend ? "font-medium text-[#60a5fa]" : "text-[var(--text-subtle)]")}>
                  {s ? (s.spent ? fmt(s.spent) : "—") : ""}
                </td>,
                <td key={`${period.weekStart}-impr`} className="px-2 py-2 text-right whitespace-nowrap tabular-nums text-[var(--text-dim)]">
                  {s ? (s.impressions ? fmt(s.impressions) : "—") : ""}
                </td>,
                <td key={`${period.weekStart}-targetClick`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                  {s ? <EditableNum value={s.targetClick ?? 0} onSave={(v) => patchStat(s.id, p.id, "targetClick", v)} /> : ""}
                </td>,
                <td key={`${period.weekStart}-click`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                  {s ? (s.avgClick ? fmt(s.avgClick) : "—") : ""}
                </td>,
                <td key={`${period.weekStart}-orders`} className={cn("px-2 py-2 text-right whitespace-nowrap", s && !hasOrders && hasSpend ? "text-[var(--red)]" : "text-[var(--text)]")}>
                  {s
                    ? <><span className={hasOrders ? "text-[var(--emerald)] font-medium" : ""}>{s.orders ?? 0} зак.</span>{" / "}<span>{s.drrPct ? s.drrPct.toFixed(1) + "%" : "—"}</span></>
                    : ""}
                </td>,
                <td key={`${period.weekStart}-ctr`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                  {s ? fmtPct(s.ctrPct) : ""}
                </td>,
                <td key={`${period.weekStart}-conv`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                  {s ? fmtPct(s.convCartPct) : ""}
                </td>,
                <td key={`${period.weekStart}-convfav`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                  {s ? fmtPct(s.convFavPct) : ""}
                </td>,
                <td key={`${period.weekStart}-revenue`} className={cn("px-2 py-2 text-right whitespace-nowrap tabular-nums font-medium", s?.revenue ? "text-[var(--amber)]" : "text-[var(--text-subtle)]")}>
                  {s ? (s.revenue ? fmt(s.revenue) : "—") : ""}
                </td>,
                <td key={`${period.weekStart}-rating`} className="px-2 py-2 whitespace-nowrap">
                  {s ? <RatingBadge rating={s.rating ?? "no_data"} /> : ""}
                </td>,
              ];
            })}
          </tr>
        );
      })}

      {/* Category total row */}
      {!collapsed && catTotals.length > 0 && (
        <tr className="border-b border-[var(--border)] bg-white/[0.01]">
          <td className="sticky left-0 z-10 bg-[var(--surface)]/80 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-subtle)]">
            Итого по категории
          </td>
          <td colSpan={6} />
          {catTotals.map((t) => [
            <td key={`${t.weekStart}-tot-spent`} className="border-l border-[var(--border)] px-2 py-1.5 text-right text-[10px] font-semibold tabular-nums text-[#60a5fa]">
              {fmt(t.spent)}
            </td>,
            <td key={`${t.weekStart}-tot-impr`} className="px-2 py-1.5 text-right text-[10px] font-semibold tabular-nums text-[var(--text-dim)]">
              {fmt(t.impressions)}
            </td>,
            <td key={`${t.weekStart}-tot-tc`} className="px-2 py-1.5" />,
            <td key={`${t.weekStart}-tot-cl`} className="px-2 py-1.5" />,
            <td key={`${t.weekStart}-tot-orders`} className="px-2 py-1.5 text-right text-[10px] font-semibold tabular-nums text-[var(--emerald)]">
              {t.orders} зак.
            </td>,
            <td key={`${t.weekStart}-tot-ctr`} className="px-2 py-1.5" />,
            <td key={`${t.weekStart}-tot-conv`} className="px-2 py-1.5" />,
            <td key={`${t.weekStart}-tot-cf`} className="px-2 py-1.5" />,
            <td key={`${t.weekStart}-tot-rev`} className="px-2 py-1.5" />,
            <td key={`${t.weekStart}-tot-rating`} className="px-2 py-1.5" />,
          ])}
        </tr>
      )}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProductsClient({ storeId }: { storeId: string }) {
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<WeekOption[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [weeksLoading, setWeeksLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("");
  const [compareOpen, setCompareOpen] = useState(false);

  // Upload panel
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<{ file: File; dateRange: string | null }[]>([]);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploadUploading, setUploadUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ filename: string; upserted?: number; error?: string }[] | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const parseDateLabel = (name: string): string | null => {
    const m = name.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
    return m ? `${m[1]} — ${m[2]}` : null;
  };

  const addUploadFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    setUploadFiles((prev) => {
      const existing = new Set(prev.map((f) => f.file.name));
      return [...prev, ...arr.filter((f) => !existing.has(f.name)).map((f) => ({ file: f, dateRange: parseDateLabel(f.name) }))];
    });
    setUploadResults(null);
  };

  const handleUploadProducts = async () => {
    if (!uploadFiles.length || !campaignId) return;
    setUploadUploading(true);
    const formData = new FormData();
    uploadFiles.forEach(({ file }) => formData.append("files", file));
    uploadFiles.forEach(() => formData.append("campaignIds", campaignId));
    try {
      const res = await fetch(`/api/kaspi/ad/${storeId}/upload/products`, { method: "POST", body: formData });
      const data = await res.json();
      setUploadResults(data.results ?? []);
      const errors = new Set((data.results as { filename: string; error?: string }[]).filter((r) => r.error).map((r) => r.filename));
      setUploadFiles((prev) => prev.filter((f) => errors.has(f.file.name)));
      if (!errors.size) {
        // Reload weeks + data after successful upload
        loadWeeks();
        load();
      }
    } catch { setUploadResults([{ filename: "—", error: "Ошибка сети" }]); }
    finally { setUploadUploading(false); }
  };

  const loadWeeks = useCallback(() => {
    setWeeksLoading(true);
    fetch(`/api/kaspi/ad/${storeId}/weeks`)
      .then((r) => r.json())
      .then((data) => {
        const weeks: WeekOption[] = data.weeks ?? [];
        setAvailableWeeks(weeks);
        setSelectedWeeks((prev) => {
          const valid = prev.filter((s) => weeks.some((w) => w.weekStart === s));
          return valid.length > 0 ? valid : weeks.slice(0, 4).map((w) => w.weekStart);
        });
      })
      .catch(() => setError("Не удалось загрузить список недель"))
      .finally(() => setWeeksLoading(false));
  }, [storeId]);

  const handleDeleteWeek = useCallback(async (weekStart: string) => {
    await fetch(
      `/api/kaspi/ad/${storeId}/reset?target=week&weekStart=${encodeURIComponent(weekStart)}`,
      { method: "DELETE" },
    );
    loadWeeks();
  }, [storeId, loadWeeks]);

  // Load available weeks once on mount
  useEffect(() => { loadWeeks(); }, [loadWeeks]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set("campaignId", campaignId);
      if (selectedWeeks.length > 0 && selectedWeeks.length < availableWeeks.length) {
        selectedWeeks.forEach((w) => params.append("weeks", w));
      }
      const res = await fetch(`/api/kaspi/ad/${storeId}/products?${params}`);
      const data = await res.json();
      setCampaignOptions(data.campaigns ?? []);
      setProducts(data.products ?? []);
      setPeriods(data.periods ?? []);
    } catch { setError("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [storeId, campaignId, selectedWeeks, availableWeeks.length]);

  useEffect(() => { if (!weeksLoading) load(); }, [load, weeksLoading]);

  const handleUpdate = (productId: string, field: string, value: unknown) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      const statMatch = field.match(/^__stat__(.+)__(.+)$/);
      if (statMatch) {
        const [, statId, statField] = statMatch;
        return { ...p, weeks: p.weeks.map((w) => w.id === statId ? { ...w, [statField]: value } : w) };
      }
      return { ...p, [field]: value };
    }));
  };

  // Search filter
  const filteredProducts = products.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.campaignName.toLowerCase().includes(search.toLowerCase()),
  );

  // Group by category
  const grouped = new Map<string, Product[]>();
  for (const p of filteredProducts) {
    const cat = p.category || "Другое";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }
  const categoryOrder = ["Диваны", "Кресла", "Кушетки", "Пуфы", "Стеллажи", "Обувницы", "Картины", "Другое"];
  const sortedCategories = [...grouped.keys()].sort((a, b) => {
    const ai = categoryOrder.indexOf(a), bi = categoryOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, "ru");
    if (ai === -1) return 1; if (bi === -1) return -1;
    return ai - bi;
  });

  // Grand total row
  const grandTotals = periods.map((p) => {
    let spent = 0, impressions = 0, orders = 0;
    for (const prod of filteredProducts) {
      const s = prod.weeks.find((w) => w.weekStart === p.weekStart);
      if (s) { spent += s.spent ?? 0; impressions += s.impressions ?? 0; orders += s.orders ?? 0; }
    }
    return { weekStart: p.weekStart, spent, impressions, orders };
  });

  const COLS = 10;

  return (
    <>
      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week selector */}
          <WeekSelector
            weeks={availableWeeks}
            selected={selectedWeeks}
            onChange={setSelectedWeeks}
            loading={weeksLoading}
            onDelete={handleDeleteWeek}
          />

          {/* Campaign filter */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">Кампания</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
              className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] outline-none hover:border-[var(--border-strong)]">
              <option value="">Все</option>
              {campaignOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск товара..."
              className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-8 pr-2 text-[11px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none hover:border-[var(--border-strong)] focus:border-[var(--border-focus)]"
              style={{ width: 160 }} />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 text-[var(--text-dim)] hover:text-[var(--text)]">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] outline-none hover:border-[var(--border-strong)]">
              <option value="">Без сортировки</option>
              <option value="spent">Расход ↓</option>
              <option value="impressions">Показы ↓</option>
              <option value="orders">Заказы ↓</option>
              <option value="ctrPct">CTR% ↓</option>
              <option value="drrPct">ДРР% ↑</option>
              <option value="convCartPct">Конв→корз% ↓</option>
            </select>
          </div>

          {/* Compare */}
          {periods.length >= 2 && (
            <Button variant="ghost" size="sm" onClick={() => setCompareOpen(true)}>
              <GitCompareArrows className="h-3.5 w-3.5" />
              Сравнить {periods.length} нед.
            </Button>
          )}

          {/* Refresh */}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>

          {/* Upload toggle */}
          <Button variant={uploadOpen ? "secondary" : "ghost"} size="sm"
            onClick={() => { setUploadOpen((s) => !s); setUploadResults(null); }}>
            <Upload className="h-3.5 w-3.5" />
            Загрузить
          </Button>

          {/* Stats */}
          {!loading && !weeksLoading && (
            <span className="ml-auto text-[11px] text-[var(--text-dim)]">
              {filteredProducts.length} из {products.length} товаров · {periods.length} нед.
            </span>
          )}
        </div>
      </div>

      {/* ── Upload panel ─────────────────────────────────────────────────── */}
      {uploadOpen && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text)]">Загрузка «По товарам»</p>
              {!campaignId
                ? <p className="mt-0.5 text-[11px] text-[var(--amber)]">⚠ Выбери кампанию в фильтре выше</p>
                : <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Кампания: <span className="font-medium text-[var(--text)]">{campaignOptions.find((c) => c.id === campaignId)?.name}</span></p>
              }
            </div>
            <button onClick={() => setUploadOpen(false)} className="rounded p-1 text-[var(--text-dim)] hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={(e) => { e.preventDefault(); setUploadDragging(false); addUploadFiles(e.dataTransfer.files); }}
            onClick={() => uploadInputRef.current?.click()}
            className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed p-8 transition-colors",
              uploadDragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] hover:border-[var(--accent)]")}>
            <Upload className="h-6 w-6 text-[var(--text-dim)]" />
            <p className="text-[12px] text-[var(--text-dim)]">Перетащи CSV или кликни · можно несколько недель</p>
            <input ref={uploadInputRef} type="file" accept=".csv" multiple className="hidden"
              onChange={(e) => e.target.files && addUploadFiles(e.target.files)} />
          </div>

          {uploadFiles.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {uploadFiles.map(({ file, dateRange }) => (
                <div key={file.name} className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{file.name}</p>
                    {dateRange
                      ? <p className="text-[10px] text-[var(--text-dim)]">📅 {dateRange}</p>
                      : <p className="text-[10px] text-[var(--red)]">⚠ Нет дат в названии</p>}
                  </div>
                  <button onClick={() => setUploadFiles((p) => p.filter((f) => f.file.name !== file.name))}
                    className="text-[var(--text-dim)] hover:text-[var(--text)]">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadResults && (
            <div className="mt-3 flex flex-col gap-1">
              {uploadResults.map((r, i) => (
                <div key={i} className={cn("flex items-center gap-2 rounded px-3 py-1.5 text-[12px]",
                  r.error ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--emerald-soft)]/30 text-[var(--emerald)]")}>
                  {r.error ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate font-medium">{r.filename}</span>
                  {!r.error && <span className="text-[var(--text-dim)]">· {r.upserted} товаров</span>}
                  {r.error && <span>{r.error}</span>}
                </div>
              ))}
            </div>
          )}

          {uploadFiles.length > 0 && (
            <div className="mt-3 flex justify-end">
              <Button variant="primary" size="sm" onClick={handleUploadProducts} disabled={uploadUploading || !campaignId}>
                {uploadUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadUploading ? "Загружаем..." : `Загрузить ${uploadFiles.length} файл${uploadFiles.length > 1 ? "а" : ""}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* States */}
      {(loading || weeksLoading) && (
        <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-dim)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[13px] text-[var(--red)]">{error}</div>
      )}
      {!loading && !weeksLoading && !error && availableWeeks.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center text-[13px] text-[var(--text-dim)]">
          <p className="font-medium text-[var(--text)]">Товаров пока нет</p>
          <p className="mt-1">Выбери кампанию и нажми «Загрузить» чтобы добавить CSV</p>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {!loading && !weeksLoading && !error && filteredProducts.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
          <table className="w-full text-[12px]" style={{ minWidth: "max-content" }}>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] min-w-[240px]">Товар</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Статус</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Улучшить карточку</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Отзывы</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Скидка</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Наличие</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Видео</th>
                {periods.map((p) => (
                  <th key={p.weekStart} colSpan={COLS}
                    className="border-l border-[var(--border)] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">
                    {fmtWeekLabel(p.weekStart, p.weekEnd)}
                  </th>
                ))}
              </tr>
              {periods.length > 0 && (
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                  <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-1" />
                  <th colSpan={6} />
                  {periods.map((p) =>
                    ["Расход", "Показы", "Целев. клик", "Ср. клик", "Заказы/ДРР%", "CTR%", "Конв→корз%", "Конв→изб%", "Выручка", "Оценка"].map((label) => (
                      <th key={`${p.weekStart}-${label}`}
                        className={cn("px-2 py-1 text-[9px] font-medium uppercase tracking-[0.04em] text-[var(--text-subtle)] whitespace-nowrap",
                          label === "Расход" && "border-l border-[var(--border)]")}>
                        {label}
                      </th>
                    ))
                  )}
                </tr>
              )}
            </thead>

            <tbody>
              {sortedCategories.map((cat) => (
                <CategoryGroup
                  key={cat}
                  category={cat}
                  products={grouped.get(cat)!}
                  periods={periods}
                  storeId={storeId}
                  onUpdate={handleUpdate}
                  sortBy={sortBy}
                />
              ))}
            </tbody>

            {/* Grand total row */}
            {grandTotals.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-subtle)]">
                  <td className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-dim)]">
                    Итого ({filteredProducts.length})
                  </td>
                  <td colSpan={6} />
                  {grandTotals.map((t) => [
                    <td key={`${t.weekStart}-gt-spent`} className="border-l border-[var(--border)] px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-[#60a5fa]">
                      {fmt(t.spent)}
                    </td>,
                    <td key={`${t.weekStart}-gt-impr`} className="px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-[var(--text-dim)]">
                      {fmt(t.impressions)}
                    </td>,
                    <td key={`${t.weekStart}-gt-tc`} className="px-2 py-2" />,
                    <td key={`${t.weekStart}-gt-cl`} className="px-2 py-2" />,
                    <td key={`${t.weekStart}-gt-orders`} className="px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-[var(--emerald)]">
                      {t.orders} зак.
                    </td>,
                    <td key={`${t.weekStart}-gt-ctr`} className="px-2 py-2" />,
                    <td key={`${t.weekStart}-gt-conv`} className="px-2 py-2" />,
                    <td key={`${t.weekStart}-gt-cf`} className="px-2 py-2" />,
                    <td key={`${t.weekStart}-gt-rev`} className="px-2 py-2" />,
                    <td key={`${t.weekStart}-gt-rating`} className="px-2 py-2" />,
                  ])}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Comparison modal */}
      {compareOpen && (
        <CompareModal
          products={filteredProducts}
          periods={periods}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </>
  );
}
