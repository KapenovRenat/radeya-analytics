"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Upload, FileText, CheckCircle, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdFilterBar } from "@/components/ad/ad-filter-bar";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekStat {
  id: string;
  weekStart: string;
  weekEnd: string;
  spent: number;
  targetClick: number;
  avgClick: number;
  orders: number;
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
  status: string;        // "active" | "inactive"
  improveCard: string;   // "yes" | "no" | "maybe"
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
  { value: "active", label: "● Активный", color: "text-[var(--emerald)]" },
  { value: "inactive", label: "○ Неактивный", color: "text-[var(--text-dim)]" },
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

// ─── Category Group ───────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  products,
  periods,
  storeId,
  onUpdate,
}: {
  category: string;
  products: Product[];
  periods: Period[];
  storeId: string;
  onUpdate: (productId: string, field: string, value: unknown) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

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
    // optimistic update handled by parent
    onUpdate(productId, `__stat__${statId}__${field}`, value);
  };

  return (
    <>
      {/* Category header row */}
      <tr className="border-b border-t border-[var(--border)] bg-[var(--bg-subtle)]">
        <td
          className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-1.5 cursor-pointer"
          colSpan={7 + periods.length * 7}
          onClick={() => setCollapsed((s) => !s)}
        >
          <div className="flex items-center gap-2">
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5 text-[var(--text-dim)]" />
              : <ChevronDown className="h-3.5 w-3.5 text-[var(--text-dim)]" />
            }
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">
              {category}
            </span>
            <span className="text-[11px] text-[var(--text-subtle)]">· {products.length} товаров</span>
          </div>
        </td>
      </tr>

      {!collapsed && products.map((p, pi) => {
        const statMap = new Map<string, WeekStat>();
        for (const w of p.weeks) statMap.set(w.weekStart, w);

        return (
          <tr key={p.id} className={cn("border-b border-[var(--border)] transition-colors hover:bg-white/[0.02]", pi % 2 !== 0 && "bg-white/[0.01]")}>
            {/* Product name */}
            <td className="sticky left-0 z-10 bg-[var(--bg)] px-4 py-2 min-w-[240px] max-w-[300px]">
              <span className="block truncate text-[12px] font-medium text-[var(--text)]" title={p.name}>{p.name}</span>
              <span className="block truncate text-[10px] text-[var(--text-subtle)]">{p.campaignName}</span>
            </td>

            {/* Status */}
            <td className="px-3 py-2 text-center">
              <InlineDropdown
                value={p.status ?? "active"}
                options={STATUS_OPTIONS}
                onSave={(v) => patchProduct(p.id, "status", v)}
              />
            </td>

            {/* improveCard */}
            <td className="px-3 py-2 text-center">
              <InlineDropdown
                value={p.improveCard ?? "no"}
                options={IMPROVE_OPTIONS}
                onSave={(v) => patchProduct(p.id, "improveCard", v)}
              />
            </td>

            {/* Bool flags */}
            {(["hasReviews", "hasDiscount", "inStock", "hasVideo"] as const).map((field) => (
              <td key={field} className="px-3 py-2 text-center">
                <InlineDropdown
                  value={String(p[field] ?? false)}
                  options={BOOL_OPTIONS}
                  onSave={(v) => patchProduct(p.id, field, v === "true")}
                />
              </td>
            ))}

            {/* Per-week stats */}
            {periods.map((period) => {
              const s = statMap.get(period.weekStart);
              const hasSpend = (s?.spent ?? 0) > 0;
              const hasOrders = (s?.orders ?? 0) > 0;
              return [
                // Расход — read-only (из CSV)
                <td key={`${period.weekStart}-spent`} className={cn("border-l border-[var(--border)] px-2 py-2 text-right whitespace-nowrap tabular-nums", hasSpend ? "font-medium text-[#60a5fa]" : "text-[var(--text-subtle)]")}>
                  {s ? (s.spent ? fmt(s.spent) : "—") : ""}
                </td>,
                // Уст.клик — редактируемый
                <td key={`${period.weekStart}-targetClick`} className="px-2 py-2 text-right whitespace-nowrap text-[var(--text-dim)]">
                  {s ? <EditableNum value={s.targetClick ?? 0} onSave={(v) => patchStat(s.id, p.id, "targetClick", v)} /> : ""}
                </td>,
                // Ср.клик — read-only (из CSV)
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
                <td key={`${period.weekStart}-rating`} className="px-2 py-2 whitespace-nowrap">
                  {s ? <RatingBadge rating={s.rating ?? "no_data"} /> : ""}
                </td>,
              ];
            })}
          </tr>
        );
      })}
    </>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ProductsClient({ storeId }: { storeId: string }) {
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Upload panel state
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
      if (!errors.size) load(); // refresh table on full success
    } catch { setUploadResults([{ filename: "—", error: "Ошибка сети" }]); }
    finally { setUploadUploading(false); }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set("campaignId", campaignId);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/kaspi/ad/${storeId}/products?${params}`);
      const data = await res.json();
      setCampaignOptions(data.campaigns ?? []);
      setProducts(data.products ?? []);
      setPeriods(data.periods ?? []);
    } catch { setError("Не удалось загрузить данные"); }
    finally { setLoading(false); }
  }, [storeId, campaignId, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  // Optimistic update for product fields and stats
  const handleUpdate = (productId: string, field: string, value: unknown) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      // stat update: __stat__{statId}__{field}
      const statMatch = field.match(/^__stat__(.+)__(.+)$/);
      if (statMatch) {
        const [, statId, statField] = statMatch;
        return { ...p, weeks: p.weeks.map((w) => w.id === statId ? { ...w, [statField]: value } : w) };
      }
      return { ...p, [field]: value };
    }));
  };

  // Group by category
  const grouped = new Map<string, Product[]>();
  for (const p of products) {
    const cat = p.category || "Другое";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }
  const categoryOrder = ["Диваны", "Кресла", "Кушетки", "Пуфы", "Стеллажи", "Обувницы", "Картины", "Другое"];
  const sortedCategories = [...grouped.keys()].sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, "ru");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <>
      {/* Filter bar */}
      <AdFilterBar
        from={fromDate}
        to={toDate}
        onChange={(f, t) => { setFromDate(f); setToDate(t); }}
        extra={
          <div className="flex flex-wrap items-center gap-3">
            {/* Campaign select */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">Кампания</label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="h-7 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[11px] text-[var(--text)] outline-none hover:border-[var(--border-strong)] focus:border-[var(--border-focus)]"
              >
                <option value="">Все кампании</option>
                {campaignOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {!loading && (
              <span className="text-[11px] text-[var(--text-dim)]">
                {products.length} товаров · {periods.length} недель
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Button
              variant={uploadOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={() => { setUploadOpen((s) => !s); setUploadResults(null); }}
            >
              <Upload className="h-3.5 w-3.5" />
              Загрузить
            </Button>
          </div>
        }
      />

      {/* Upload panel */}
      {uploadOpen && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-[var(--text)]">Загрузка «По товарам»</p>
              {!campaignId && (
                <p className="mt-0.5 text-[11px] text-[var(--amber)]">⚠ Выбери кампанию в фильтре выше</p>
              )}
              {campaignId && (
                <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                  Кампания: <span className="font-medium text-[var(--text)]">{campaignOptions.find((c) => c.id === campaignId)?.name}</span>
                </p>
              )}
            </div>
            <button onClick={() => setUploadOpen(false)} className="rounded p-1 text-[var(--text-dim)] hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={(e) => { e.preventDefault(); setUploadDragging(false); addUploadFiles(e.dataTransfer.files); }}
            onClick={() => uploadInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed p-8 transition-colors",
              uploadDragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-strong)] hover:border-[var(--accent)]",
            )}
          >
            <Upload className="h-6 w-6 text-[var(--text-dim)]" />
            <p className="text-[12px] text-[var(--text-dim)]">Перетащи CSV или кликни · можно несколько недель</p>
            <input ref={uploadInputRef} type="file" accept=".csv" multiple className="hidden"
              onChange={(e) => e.target.files && addUploadFiles(e.target.files)} />
          </div>

          {/* File list */}
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

          {/* Results */}
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

          {/* Upload button */}
          {uploadFiles.length > 0 && (
            <div className="mt-3 flex justify-end">
              <Button variant="primary" size="sm" onClick={handleUploadProducts}
                disabled={uploadUploading || !campaignId}>
                {uploadUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadUploading ? "Загружаем..." : `Загрузить ${uploadFiles.length} файл${uploadFiles.length > 1 ? "а" : ""}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-dim)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-4 text-[13px] text-[var(--red)]">
          {error}
        </div>
      )}
      {!loading && !error && !products.length && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] p-12 text-center text-[13px] text-[var(--text-dim)]">
          <p className="font-medium text-[var(--text)]">Товаров пока нет</p>
          <p className="mt-1">Выбери кампанию и нажми «Загрузить» чтобы добавить CSV</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
          <table className="w-full text-[12px]" style={{ minWidth: "max-content" }}>
            <thead>
              {/* Period header row */}
              <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] min-w-[240px]">
                  Товар
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Статус</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Улучшить карточку</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Отзывы</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Скидка</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Наличие</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap">Видео</th>

                {periods.map((p) => (
                  <th
                    key={p.weekStart}
                    colSpan={8}
                    className="border-l border-[var(--border)] px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)] whitespace-nowrap"
                  >
                    {fmtDate(p.weekStart)} — {fmtDate(p.weekEnd)}
                  </th>
                ))}
              </tr>

              {/* Sub-header: metric labels per period */}
              {periods.length > 0 && (
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                  <th className="sticky left-0 z-10 bg-[var(--bg-subtle)] px-4 py-1" />
                  <th colSpan={6} />
                  {periods.map((p) =>
                    ["Расход", "Уст.клик", "Ср.клик", "Заказы/ДРР%", "CTR%", "Конв→корз%", "Конв→изб%", "Оценка"].map((label) => (
                      <th
                        key={`${p.weekStart}-${label}`}
                        className={cn(
                          "px-2 py-1 text-[9px] font-medium uppercase tracking-[0.04em] text-[var(--text-subtle)] whitespace-nowrap",
                          label === "Расход" && "border-l border-[var(--border)]",
                        )}
                      >
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
