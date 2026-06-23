"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, Upload, X, FileText, Loader2, CheckCircle, XCircle,
  Check, ExternalLink, ImagePlus, ChevronLeft, ChevronRight, Copy, Users,
} from "lucide-react";
import { PageShell } from "@/components/page/page-shell";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  externalUuid: string;
  code: string | null;
  name: string;
  salePrice: number;
  currency: string | null;
  barcode: string | null;
  kaspiUrl: string | null;
  brand: string | null;
  supplier: string | null;
  imageUrl: string | null;
}

interface SupplierRow {
  name: string;
  productCount: number;
  tgChatId: string | null;
  tgGroupId: string | null;
}

/** Список страниц с многоточиями: 1 … 4 5 [6] 7 8 … 75 */
function pageList(current: number, total: number): (number | "...")[] {
  const delta = 2;
  const range: number[] = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) range.push(i);
  const out: (number | "...")[] = [];
  if (range[0] > 1) {
    out.push(1);
    if (range[0] > 2) out.push("...");
  }
  out.push(...range);
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) out.push("...");
    out.push(total);
  }
  return out;
}

// ─── Image modal ───────────────────────────────────────────────────────────────

function ImageModal({
  storeId, product, onClose, onSaved,
}: {
  storeId: string;
  product: Product;
  onClose: () => void;
  onSaved: (imageUrl: string) => void;
}) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(product.imageUrl);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setFile = (f: File) => {
    setPendingFile(f); setPendingUrl(null);
    setPreview(URL.createObjectURL(f)); setError(null);
  };
  const setUrl = (u: string) => {
    setPendingUrl(u); setPendingFile(null);
    setPreview(u); setError(null);
  };

  // Esc + paste (image blob or URL)
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const paste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) { setFile(f); return; }
        }
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && /^https?:\/\/\S+/.test(text)) setUrl(text);
    };
    document.addEventListener("keydown", esc);
    document.addEventListener("paste", paste);
    return () => { document.removeEventListener("keydown", esc); document.removeEventListener("paste", paste); };
  }, [onClose]);

  const handleSave = async () => {
    if (!pendingFile && !pendingUrl) return;
    setUploading(true); setError(null);
    const fd = new FormData();
    if (pendingFile) fd.append("file", pendingFile);
    else if (pendingUrl) fd.append("imageUrl", pendingUrl);
    try {
      const res = await fetch(`/api/kaspi/stores/${storeId}/products/${product.id}/image`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      onSaved(data.imageUrl);
      onClose();
    } catch {
      setError("Ошибка сети");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-[var(--text)]">Картинка товара</h3>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]" title={product.name}>{product.name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--text-dim)] hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {/* Drop / paste zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) setFile(f); }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed p-4 transition-colors",
            dragging ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-strong)] hover:border-[var(--accent)]",
          )}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-[200px] rounded object-contain" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6 text-[var(--text-dim)]" />
              <p className="text-center text-[11px] text-[var(--text-dim)]">
                Перетащи, выбери файл<br/>или вставь из буфера (Ctrl+V)
              </p>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
        </div>

        <p className="mt-2 text-[10px] text-[var(--text-subtle)]">
          Можно скопировать картинку в интернете (правый клик → копировать) и вставить сюда Ctrl+V
        </p>

        {error && (
          <div className="mt-2 flex items-center gap-2 rounded bg-[var(--red-soft)] px-3 py-2 text-[11px] text-[var(--red)]">
            <XCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-[11px] text-[var(--text-dim)] hover:bg-white/[0.06]">Отмена</button>
          <button
            onClick={handleSave}
            disabled={uploading || (!pendingFile && !pendingUrl)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-[11px] font-medium",
              uploading || (!pendingFile && !pendingUrl)
                ? "cursor-not-allowed bg-[var(--surface-elev)] text-[var(--text-subtle)]"
                : "bg-[var(--accent)] text-white hover:opacity-90",
            )}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Suppliers modal ────────────────────────────────────────────────────────────

function SuppliersModal({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [chatId, setChatId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/kaspi/stores/${storeId}/suppliers`);
      const data = await res.json();
      setRows(data.suppliers ?? []);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { if (editing) setEditing(null); else onClose(); } };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, editing]);

  const openEdit = (s: SupplierRow) => {
    setEditing(s);
    setChatId(s.tgChatId ?? "");
    setGroupId(s.tgGroupId ?? "");
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`/api/kaspi/stores/${storeId}/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editing.name, tgChatId: chatId, tgGroupId: groupId }),
      });
      await load();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const filtered = search.trim()
    ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  const withContacts = rows.filter((r) => r.tgChatId || r.tgGroupId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[760px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Поставщики</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">{rows.length} поставщиков · с контактами: {withContacts}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-[var(--text-dim)] hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {/* Search */}
        <div className="border-b border-[var(--border)] px-5 py-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск поставщика..."
              className="h-8 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-8 pr-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center gap-2 p-8 text-[12px] text-[var(--text-dim)]"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка...</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[var(--bg-subtle)]">
                <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-dim)]">
                  <th className="px-4 py-2 text-left font-semibold">Поставщик</th>
                  <th className="px-3 py-2 text-right font-semibold">Товаров</th>
                  <th className="px-3 py-2 text-center font-semibold">Chat ID</th>
                  <th className="px-3 py-2 text-center font-semibold">Группа</th>
                  <th className="px-3 py-2 text-right font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-dim)]">Ничего не найдено</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.name} className="border-b border-[var(--border)] hover:bg-white/[0.02] cursor-pointer" onClick={() => openEdit(s)}>
                    <td className="px-4 py-2.5 text-[var(--text)] max-w-[340px]"><span className="line-clamp-1">{s.name}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--text-dim)]">{s.productCount}</td>
                    <td className="px-3 py-2.5 text-center">
                      {s.tgChatId ? <Check className="mx-auto h-4 w-4 text-[var(--emerald)]" /> : <span className="text-[var(--text-subtle)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.tgGroupId ? <Check className="mx-auto h-4 w-4 text-[var(--emerald)]" /> : <span className="text-[var(--text-subtle)]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-[11px] font-medium text-[var(--accent)]">{(s.tgChatId || s.tgGroupId) ? "Изменить" : "Указать"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit sub-modal */}
        {editing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}>
            <div className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[13px] font-semibold text-[var(--text)]">Контакты поставщика</h3>
              <p className="mt-0.5 mb-4 text-[11px] text-[var(--text-dim)] line-clamp-1" title={editing.name}>{editing.name}</p>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[var(--text-dim)]">Chat ID (личка)</label>
                  <input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="например 123456789"
                    className="h-8 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[var(--text-dim)]">ID группы Telegram</label>
                  <input
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    placeholder="например -1001234567890"
                    className="h-8 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] font-mono text-[var(--text)] outline-none focus:border-[var(--accent)]"
                  />
                  <p className="mt-1 text-[10px] text-[var(--text-subtle)]">Добавь бота в группу, узнай ID через @getidsbot. У групп ID отрицательный.</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setEditing(null)} className="rounded px-3 py-1.5 text-[11px] text-[var(--text-dim)] hover:bg-white/[0.06]">Отмена</button>
                <button onClick={handleSave} disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────────

export function ProductsView({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ upserted: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (code: string | null, id: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
  };

  // debounce search → reset to page 1
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debounced) params.set("search", debounced);
      const res = await fetch(`/api/kaspi/stores/${storeId}/products?${params}`);
      const data = await res.json();
      setRows(data.products ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [storeId, page, debounced]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true); setUploadError(null); setUploadResult(null);
    const fd = new FormData();
    fd.append("file", uploadFile);
    try {
      const res = await fetch(`/api/kaspi/stores/${storeId}/products/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.error) { setUploadError(data.error); return; }
      setUploadResult(data);
      setUploadFile(null);
      setPage(1);
      load();
    } catch {
      setUploadError("Ошибка сети");
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageShell title="Товары" subtitle={`${storeName} · ${total} товаров`}>
      {/* Toolbar — кнопка загрузки */}
      <div className="flex justify-end">
        <button
          onClick={() => { setUploadOpen((s) => !s); setUploadResult(null); setUploadError(null); }}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90"
        >
          <Upload className="h-3.5 w-3.5" />
          Загрузить Excel товаров
        </button>
      </div>

      {/* Upload panel */}
      {uploadOpen && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elev)] p-4">
          <p className="mb-3 text-[12px] text-[var(--text-dim)]">Выгрузка товаров из МойСклад (.xlsx). Повторная загрузка обновляет существующие (по UUID).</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.name.match(/\.xlsx?$/i)) { setUploadFile(f); setUploadResult(null); setUploadError(null); } }}
            onClick={() => uploadInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed p-6 transition-colors",
              dragging ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-strong)] hover:border-[var(--accent)]",
            )}
          >
            <Upload className="h-5 w-5 text-[var(--text-dim)]" />
            <p className="text-[12px] text-[var(--text-dim)]">Перетащи .xlsx или кликни</p>
            <input ref={uploadInputRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUploadFile(f); setUploadResult(null); setUploadError(null); } }} />
          </div>

          {uploadFile && (
            <div className="mt-2 flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-[var(--text-dim)]" />
              <span className="flex-1 truncate text-[12px] font-medium">{uploadFile.name}</span>
              <button onClick={() => setUploadFile(null)} className="text-[var(--text-dim)] hover:text-[var(--red)]"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {uploadResult && (
            <div className="mt-2 flex items-center gap-2 rounded bg-[var(--emerald-soft)]/30 px-3 py-2 text-[12px] text-[var(--emerald)]">
              <CheckCircle className="h-4 w-4 shrink-0" /> Загружено/обновлено {uploadResult.upserted} товаров
            </div>
          )}
          {uploadError && (
            <div className="mt-2 flex items-center gap-2 rounded bg-[var(--red-soft)] px-3 py-2 text-[12px] text-[var(--red)]">
              <XCircle className="h-4 w-4 shrink-0" /> {uploadError}
            </div>
          )}
          {uploadFile && (
            <div className="mt-3 flex justify-end">
              <button onClick={handleUpload} disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Загружаем..." : "Загрузить"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search + Поставщики — прямо над таблицей */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по коду или названию..."
            className="h-8 w-[320px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-8 pr-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 text-[var(--text-dim)] hover:text-[var(--text)]"><X className="h-3.5 w-3.5" /></button>
          )}
        </div>

        <button
          onClick={() => setSuppliersOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-elev)] px-3 py-2 text-[12px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Users className="h-3.5 w-3.5" />
          Поставщики
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-dim)]">
              <th className="px-3 py-2.5 text-left font-semibold w-[166px]">Фото</th>
              <th className="px-3 py-2.5 text-left font-semibold">Код</th>
              <th className="px-3 py-2.5 text-left font-semibold">Наименование</th>
              <th className="px-3 py-2.5 text-left font-semibold">Поставщик</th>
              <th className="px-3 py-2.5 text-right font-semibold">Цена</th>
              <th className="px-3 py-2.5 text-center font-semibold">Штрихкод</th>
              <th className="px-3 py-2.5 text-center font-semibold">Kaspi</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--text-dim)]"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">
                {debounced ? "Ничего не найдено" : "Товаров нет — загрузи Excel из МойСклад"}
              </td></tr>
            )}
            {!loading && rows.map((p, i) => (
              <tr key={p.id} className={cn("border-b border-[var(--border)] hover:bg-white/[0.02]", i % 2 !== 0 && "bg-white/[0.01]")}>
                {/* Фото */}
                <td className="px-3 py-2">
                  <button
                    onClick={() => setImageProduct(p)}
                    className="flex h-[150px] w-[150px] items-center justify-center overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-elev)] hover:border-[var(--accent)]"
                    title="Добавить/изменить картинку"
                  >
                    {p.imageUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      : <ImagePlus className="h-6 w-6 text-[var(--text-subtle)]" />}
                  </button>
                </td>
                {/* Код — клик копирует в буфер */}
                <td className="px-3 py-2 whitespace-nowrap">
                  {p.code ? (
                    <button
                      onClick={() => copyCode(p.code, p.id)}
                      className="inline-flex items-center gap-1.5 font-medium text-[var(--text)] hover:text-[var(--accent)]"
                      title="Кликни чтобы скопировать код"
                    >
                      {p.code}
                      {copiedId === p.id
                        ? <Check className="h-3 w-3 text-[var(--emerald)]" />
                        : <Copy className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : <span className="text-[var(--text-subtle)]">—</span>}
                </td>
                {/* Наименование */}
                <td className="px-3 py-2 text-[var(--text)] max-w-[420px]">
                  <span className="line-clamp-2">{p.name}</span>
                </td>
                {/* Поставщик */}
                <td className="px-3 py-2 text-[var(--text-dim)] max-w-[200px]">
                  <span className="line-clamp-2 text-[11px]">{p.supplier ?? "—"}</span>
                </td>
                {/* Цена */}
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium text-[var(--text)]">
                  {p.salePrice ? formatMoney(p.salePrice) : "—"}
                </td>
                {/* Штрихкод */}
                <td className="px-3 py-2 text-center">
                  {p.barcode
                    ? <Check className="mx-auto h-4 w-4 text-[var(--emerald)]" />
                    : <X className="mx-auto h-4 w-4 text-[var(--red)]" />}
                </td>
                {/* Kaspi */}
                <td className="px-3 py-2 text-center">
                  {p.kaspiUrl ? (
                    <a href={p.kaspiUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10">
                      <ExternalLink className="h-3 w-3" /> Открыть
                    </a>
                  ) : <span className="text-[var(--text-subtle)]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination — нумерованная */}
      {total > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-dim)]">
          <span>Всего {total} · стр. {page} из {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {pageList(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} className="px-1 text-[var(--text-subtle)]">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={cn(
                    "inline-flex h-7 min-w-7 items-center justify-center rounded-[var(--radius)] border px-2 font-medium tabular-nums transition-colors",
                    p === page
                      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                      : "border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]",
                  )}
                >
                  {p}
                </button>
              ),
            )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Image modal */}
      {imageProduct && (
        <ImageModal
          storeId={storeId}
          product={imageProduct}
          onClose={() => setImageProduct(null)}
          onSaved={(url) => {
            setRows((prev) => prev.map((r) => r.id === imageProduct.id ? { ...r, imageUrl: url } : r));
          }}
        />
      )}

      {/* Suppliers modal */}
      {suppliersOpen && (
        <SuppliersModal storeId={storeId} onClose={() => setSuppliersOpen(false)} />
      )}
    </PageShell>
  );
}
