"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdFilterBar } from "@/components/ad/ad-filter-bar";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekStat {
  id: string;
  weekStart: string;
  weekEnd: string;
  isMonthlyTotal: boolean;
  spent: number;
  dailyBudget: number;
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

interface Campaign {
  id: string;
  name: string;
  status: string;          // "on" | "off"
  improveCard: string;     // "yes" | "no" | "maybe"
  hasReviews: boolean;
  hasDiscount: boolean;
  inStock: boolean;
  hasVideo: boolean;
  weeks: WeekStat[];
}

interface Period {
  weekStart: string;
  weekEnd: string;
  isMonthlyTotal: boolean;
}

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
  if (rating === "good") return <span className="text-[11px] font-medium text-[var(--emerald)]">● Хорошо</span>;
  if (rating === "normal") return <span className="text-[11px] font-medium text-[var(--amber)]">● Норм.</span>;
  if (rating === "bad") return <span className="text-[11px] font-medium text-[var(--red)]">● Плохо</span>;
  return <span className="text-[11px] text-[var(--text-subtle)]">— Нет данных</span>;
}

// ─── Inline Dropdown ──────────────────────────────────────────────────────────

interface DropdownOption {
  value: string;
  label: string;
  color?: string;
}

function InlineDropdown({
  value,
  options,
  onSave,
}: {
  value: string;
  options: DropdownOption[];
  onSave: (v: string) => void;
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
            <button
              key={o.value}
              onClick={() => { onSave(o.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-[12px] hover:bg-white/[0.06]",
                o.value === value ? "font-medium" : "",
                o.color ?? "text-[var(--text)]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "on", label: "● Вкл", color: "text-[var(--emerald)]" },
  { value: "off", label: "○ Выкл", color: "text-[var(--text-dim)]" },
];
const IMPROVE_OPTIONS: DropdownOption[] = [
  { value: "yes", label: "Да", color: "text-[var(--emerald)]" },
  { value: "maybe", label: "Возможно", color: "text-[var(--amber)]" },
  { value: "no", label: "Нет", color: "text-[var(--text-dim)]" },
];
const BOOL_OPTIONS: DropdownOption[] = [
  { value: "true", label: "Да", color: "text-[var(--emerald)]" },
  { value: "false", label: "Нет", color: "text-[var(--text-dim)]" },
];

// ─── Inline editable number cell ──────────────────────────────────────────────

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
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="w-20 rounded border border-[var(--accent)] bg-[var(--surface-elev)] px-1.5 py-0.5 text-right text-[12px] tabular-nums outline-none"
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(String(value || "")); setEditing(true); }}
      className="cursor-text rounded px-1 py-0.5 tabular-nums hover:bg-white/10"
      title="Кликни чтобы изменить"
    >
      {value ? fmt(value) : <span className="text-[var(--text-subtle)]">—</span>}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignsClient({ storeId }: { storeId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/kaspi/ad/${storeId}/campaigns?${params}`);
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
      setPeriods(data.periods ?? []);
    } catch { setError("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [storeId, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const patchCampaign = async (campaignId: string, field: string, value: unknown) => {
    await fetch(`/api/kaspi/ad/${storeId}/campaigns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "campaign", id: campaignId, field, value }),
    });
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, [field]: value } : c));
  };

  const patchStat = async (statId: string, campaignId: string, field: string, value: unknown) => {
    await fetch(`/api/kaspi/ad/${storeId}/campaigns`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "stat", id: statId, field, value }),
    });
    setCampaigns((prev) => prev.map((c) =>
      c.id === campaignId ? { ...c, weeks: c.weeks.map((w) => w.id === statId ? { ...w, [field]: value } : w) } : c
    ));
  };

  const weekPeriods = periods.filter((p) => !p.isMonthlyTotal);
  const monthPeriods = periods.filter((p) => p.isMonthlyTotal);

  return (
    <>
      {/* Filter bar */}
      <AdFilterBar
        from={fromDate}
        to={toDate}
        onChange={(f, t) => { setFromDate(f); setToDate(t); }}
        extra={
          <div className="flex items-center gap-2">
            {!loading && <span className="text-[11px] text-[var(--text-dim)]">{campaigns.length} кампаний · {weekPeriods.length} недель</span>}
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        }
      />

      {loading && <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-dim)]"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка...</div>}
      {error && <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[13px] text-[var(--red)]">{error}</div>}
      {!loading && !error && !campaigns.length && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center text-[13px] text-[var(--text-dim)]">
          <p className="font-medium text-[var(--text)]">Кампаний пока нет</p>
          <p className="mt-1">Загрузи CSV на странице <a href={`/stores/${storeId}/ad/upload`} className="text-[var(--accent)] underline">Загрузка CSV</a></p>
        </div>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
          <table className="w-full text-[12px]" style={{ minWidth: "max-content" }}>
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] min-w-[220px]">Кампания</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Статус</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Улучшить карточку</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Отзывы</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Скидка</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Наличие</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Видео</th>

                {weekPeriods.map((p) => (
                  <th key={p.weekStart} colSpan={9} className="border-l border-[var(--border)] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">
                    {fmtDate(p.weekStart)} — {fmtDate(p.weekEnd)}
                  </th>
                ))}
                {monthPeriods.map((p) => (
                  <th key={p.weekStart} colSpan={9} className="border-l border-[var(--border)] bg-white/[0.02] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)] whitespace-nowrap">
                    📊 Итого {fmtDate(p.weekStart)} — {fmtDate(p.weekEnd)}
                  </th>
                ))}
              </tr>

              {periods.length > 0 && (
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                  <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-1" />
                  <th colSpan={6} />
                  {periods.map((p) =>
                    ["Расход", "Бюджет/д", "Уст.клик", "Ср.клик", "Заказы/ДРР%", "CTR%", "Конв→корз%", "Выручка", "Оценка"].map((label) => (
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
              {campaigns.map((c, ci) => {
                const statMap = new Map<string, WeekStat>();
                for (const w of c.weeks) statMap.set(`${w.weekStart}_${w.isMonthlyTotal}`, w);

                return (
                  <tr key={c.id} className={cn("border-b border-[var(--border)] transition-colors hover:bg-white/[0.02]", ci % 2 !== 0 && "bg-white/[0.01]")}>
                    {/* Name */}
                    <td className="sticky left-0 z-10 bg-[var(--bg)] px-4 py-2 font-medium text-[var(--text)] min-w-[220px] max-w-[280px]">
                      <span className="block truncate" title={c.name}>{c.name}</span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 text-center">
                      <InlineDropdown
                        value={c.status}
                        options={STATUS_OPTIONS}
                        onSave={(v) => patchCampaign(c.id, "status", v)}
                      />
                    </td>

                    {/* improveCard */}
                    <td className="px-3 py-2 text-center">
                      <InlineDropdown
                        value={c.improveCard ?? "no"}
                        options={IMPROVE_OPTIONS}
                        onSave={(v) => patchCampaign(c.id, "improveCard", v)}
                      />
                    </td>

                    {/* Boolean flags */}
                    {(["hasReviews", "hasDiscount", "inStock", "hasVideo"] as const).map((field) => (
                      <td key={field} className="px-3 py-2 text-center">
                        <InlineDropdown
                          value={String(c[field] ?? false)}
                          options={BOOL_OPTIONS}
                          onSave={(v) => patchCampaign(c.id, field, v === "true")}
                        />
                      </td>
                    ))}

                    {/* Per-period stats */}
                    {periods.map((p) => {
                      const s = statMap.get(`${p.weekStart}_${p.isMonthlyTotal}`);
                      const hasSpend = (s?.spent ?? 0) > 0;
                      const hasOrders = (s?.orders ?? 0) > 0;
                      return [
                        // Расход — read-only (из CSV)
                        <td key={`${p.weekStart}-spent`} className={cn("border-l border-[var(--border)] px-2 py-2 text-right whitespace-nowrap tabular-nums", hasSpend ? "font-medium text-[#60a5fa]" : "text-[var(--text-subtle)]")}>
                          {s ? (s.spent ? fmt(s.spent) : "—") : ""}
                        </td>,
                        // Бюджет/д — редактируемый
                        <td key={`${p.weekStart}-budget`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? <EditableNum value={s.dailyBudget} onSave={(v) => patchStat(s.id, c.id, "dailyBudget", v)} /> : ""}
                        </td>,
                        // Уст.клик — установленная цена за клик, редактируемая
                        <td key={`${p.weekStart}-targetClick`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? <EditableNum value={s.targetClick ?? 0} onSave={(v) => patchStat(s.id, c.id, "targetClick", v)} /> : ""}
                        </td>,
                        // Ср.клик — из CSV, read-only
                        <td key={`${p.weekStart}-click`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? (s.avgClick ? fmt(s.avgClick) : "—") : ""}
                        </td>,
                        <td key={`${p.weekStart}-orders`} className={cn("px-2 py-2 text-right whitespace-nowrap", s && !hasOrders && hasSpend ? "text-[var(--red)]" : "text-[var(--text)]")}>
                          {s ? <><span className={hasOrders ? "text-[var(--emerald)] font-medium" : ""}>{s.orders ?? 0} зак.</span>{" / "}<span>{s.drrPct ? s.drrPct.toFixed(1) + "%" : "—"}</span></> : ""}
                        </td>,
                        <td key={`${p.weekStart}-ctr`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? fmtPct(s.ctrPct) : ""}
                        </td>,
                        <td key={`${p.weekStart}-conv`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                          {s ? fmtPct(s.convCartPct) : ""}
                        </td>,
                        <td key={`${p.weekStart}-revenue`} className={cn("px-2 py-2 text-right whitespace-nowrap", p.isMonthlyTotal ? "font-medium text-[var(--amber)]" : "text-[var(--text-subtle)]")}>
                          {s && p.isMonthlyTotal ? <EditableNum value={s.revenue} onSave={(v) => patchStat(s.id, c.id, "revenue", v)} /> : "—"}
                        </td>,
                        <td key={`${p.weekStart}-rating`} className="px-2 py-2 whitespace-nowrap">
                          {s ? <RatingBadge rating={s.rating ?? "no_data"} /> : ""}
                        </td>,
                      ];
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
