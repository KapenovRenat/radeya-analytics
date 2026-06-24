"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search, X, RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Eye, Copy, Check, Send, AlertTriangle, ImageOff, Settings, RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { useSync } from "@/lib/use-sync";
import { useEntriesSync } from "@/lib/use-entries-sync";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  orderCode: string;
  creationDate: string;
  totalPrice: number;
  statusKey: string;
  statusLabel: string;
  statusTone: "default" | "amber" | "emerald" | "red" | "blue" | "violet" | "orange" | "kaspi";
  state: string;
  customerName: string | null;
  city: string | null;
  dispatched: boolean;
}

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новый" },
  { value: "preorder", label: "Предзаказ" },
  { value: "packing", label: "Упаковка" },
  { value: "transfer", label: "Передача" },
  { value: "on_delivery", label: "Переданы на доставку" },
  { value: "cancelled_delivery", label: "Отменены при доставке" },
  { value: "completed", label: "Завершён" },
  { value: "cancelled", label: "Отменён" },
  { value: "returned", label: "Возврат" },
];

// Статусы, для которых имеет смысл слать заказ поставщику.
// Только предзаказ — обычные (в наличии) отгружаем сами, поставщику не шлём.
const DISPATCHABLE = new Set(["preorder"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function pageList(current: number, total: number): (number | "...")[] {
  const delta = 2;
  const range: number[] = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) range.push(i);
  const out: (number | "...")[] = [];
  if (range[0] > 1) { out.push(1); if (range[0] > 2) out.push("..."); }
  out.push(...range);
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) out.push("...");
    out.push(total);
  }
  return out;
}

// ─── Detail modal ───────────────────────────────────────────────────────────────

interface OrderDetail {
  order: Record<string, unknown> & {
    orderCode: string; statusLabel: string; statusTone: string; stateLabel: string;
    totalPrice: number; creationDate: string; approvedByBankDate: string | null;
    paymentMode: string | null; creditTerm: number | null; deliveryMode: string | null;
    isKaspiDelivery: boolean | null; deliveryCost: number | null; deliveryCostForSeller: number | null;
    deliveryAddressCity: string | null; deliveryAddressFormatted: string | null;
    originAddressCity: string | null; assembled: boolean | null; isExpress: boolean | null;
    customerName: string | null; customerCellPhone: string | null; waybillNumber: string | null;
  };
  entries: { entryNumber: number; offerCode: string | null; offerName: string | null; quantity: number; basePrice: number | null; totalPrice: number }[];
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/40 py-1.5 last:border-0">
      <span className="text-[11px] text-[var(--text-dim)]">{label}</span>
      <span className={cn("text-[12px] text-right", strong ? "font-semibold text-[var(--text)]" : "text-[var(--text)]")}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">{children}</p>;
}

function DetailModal({ storeId, orderId, onClose }: { storeId: string; orderId: string; onClose: () => void }) {
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/kaspi/stores/${storeId}/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d.error ? null : d);
        if (!d.error) {
          console.groupCollapsed(`🟦 Заказ №${d.order?.orderCode} — данные от Kaspi`);
          console.log("RAW (raw_data от Kaspi):", d.order?.rawData);
          console.log("attributes:", (d.order?.rawData as { attributes?: unknown })?.attributes);
          console.log("Состав заказа (entries):", d.entries);
          console.log("Полный ответ API:", d);
          console.groupEnd();
        }
      })
      .finally(() => setLoading(false));
  }, [storeId, orderId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const o = data?.order;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-[560px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[var(--text)]">№{o?.orderCode ?? "…"}</h2>
            {o && (
              <button
                onClick={() => { navigator.clipboard?.writeText(o.orderCode); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)]"
              >
                {copied ? <Check className="h-3 w-3 text-[var(--emerald)]" /> : <Copy className="h-3 w-3" />}
                копировать
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-[var(--text-dim)] hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && <div className="flex items-center gap-2 py-8 text-[12px] text-[var(--text-dim)]"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка...</div>}
          {!loading && !o && <div className="py-8 text-center text-[13px] text-[var(--text-dim)]">Заказ не найден</div>}
          {!loading && o && (
            <>
              <div className="flex items-center gap-2">
                <Badge tone={(o.statusTone as "amber") ?? "default"}>{o.statusLabel}</Badge>
                <span className="text-[11px] text-[var(--text-dim)]">{o.stateLabel}</span>
              </div>
              <p className="mt-2 text-[22px] font-bold text-[var(--text)]">{formatMoney(o.totalPrice)}</p>

              <SectionTitle>Состав заказа</SectionTitle>
              <div className="rounded-[var(--radius)] border border-[var(--border)]">
                {data!.entries.length === 0 && <p className="px-3 py-3 text-[11px] text-[var(--text-subtle)]">Позиции не загружены (нужна синхронизация позиций)</p>}
                {data!.entries.map((e) => (
                  <div key={e.entryNumber} className="flex items-center justify-between gap-3 border-b border-[var(--border)]/40 px-3 py-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] text-[var(--text)]" title={e.offerName ?? ""}>{e.offerName ?? "—"}</p>
                      <p className="text-[10px] text-[var(--text-subtle)]">{e.offerCode ?? "—"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12px] tabular-nums text-[var(--text)]">{e.quantity} × {formatMoney(e.totalPrice / Math.max(1, e.quantity))}</p>
                    </div>
                  </div>
                ))}
              </div>

              <SectionTitle>Заказ</SectionTitle>
              <Row label="Дата поступления" value={fmtDateTime(o.creationDate)} strong />
              <Row label="Одобрен банком" value={fmtDateTime(o.approvedByBankDate)} />
              <Row label="Оплата" value={o.paymentMode === "credit" ? "Кредит" : o.paymentMode ?? "—"} />
              {o.creditTerm ? <Row label="Срок кредита" value={`${o.creditTerm} мес`} /> : null}
              <Row label="Собран" value={o.assembled ? "да" : "нет"} />
              <Row label="Экспресс" value={o.isExpress ? "да" : "нет"} />

              <SectionTitle>Доставка</SectionTitle>
              <Row label="Способ" value={o.deliveryMode ?? "—"} strong />
              <Row label="Kaspi Доставка" value={o.isKaspiDelivery ? "да" : "нет"} />
              <Row label="Стоимость доставки" value={formatMoney(o.deliveryCost ?? 0)} />
              <Row label="Доставка для продавца" value={formatMoney(o.deliveryCostForSeller ?? 0)} />
              <Row label="Город" value={o.deliveryAddressCity ?? "—"} strong />
              <Row label="Адрес" value={o.deliveryAddressFormatted ?? "—"} />
              <Row label="Отгрузка (склад)" value={o.originAddressCity ?? "—"} />
              {o.waybillNumber ? <Row label="Накладная" value={o.waybillNumber} /> : null}

              <SectionTitle>Клиент</SectionTitle>
              <Row label="Имя" value={o.customerName ?? "—"} strong />
              <Row label="Телефон" value={o.customerCellPhone ?? "—"} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dispatch preview modal (2b — проверка матчинга, НЕ шлёт) ────────────────────

interface PreviewItem {
  offerCode: string | null;
  offerName: string | null;
  quantity: number;
  matched: {
    productName: string; code: string | null; displayName: string; fabric: string | null;
    imageUrl: string | null; supplier: string | null; hasContact: boolean; target: string | null;
  } | null;
}

function DispatchPreviewModal({ storeId, orderId, orderCode, onClose, onSent }: { storeId: string; orderId: string; orderCode: string; onClose: () => void; onSent: () => void }) {
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [originCity, setOriginCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; sentSuppliers: { supplier: string; items: number }[]; skipped: { reason: string; detail: string }[]; error?: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/kaspi/stores/${storeId}/orders/${orderId}/dispatch-preview`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setOriginCity(d.originCity ?? null); })
      .finally(() => setLoading(false));
  }, [storeId, orderId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const matchedCount = items.filter((i) => i.matched).length;
  const withContact = items.filter((i) => i.matched?.hasContact).length;
  // Можно отправить, если есть хоть одна позиция с товаром и контактом (картинка — своя или заглушка)
  const canSend = items.some((i) => i.matched?.hasContact);

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/kaspi/stores/${storeId}/orders/${orderId}/dispatch`, { method: "POST" });
      const data = await res.json();
      setSendResult(data);
      if (data.ok) onSent();
    } catch {
      setSendResult({ ok: false, sentSuppliers: [], skipped: [], error: "Ошибка сети" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-[640px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Превью отправки · №{orderCode}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
              Проверка матчинга (пока не отправляет) · отгрузка {originCity ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-[var(--text-dim)] hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && <div className="flex items-center gap-2 py-8 text-[12px] text-[var(--text-dim)]"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка...</div>}
          {!loading && items.length === 0 && <div className="py-8 text-center text-[13px] text-[var(--text-dim)]">Позиций нет (синхронизируй состав на странице или через «Обновить 14 дней»)</div>}

          {!loading && items.length > 0 && (
            <>
              <div className="mb-3 flex gap-2 text-[11px]">
                <Badge tone={matchedCount === items.length ? "emerald" : "amber"}>Найдено {matchedCount}/{items.length}</Badge>
                <Badge tone={withContact === items.length ? "emerald" : "amber"}>С контактом {withContact}/{items.length}</Badge>
              </div>

              <div className="flex flex-col gap-2.5">
                {items.map((it, i) => (
                  <div key={i} className="rounded-[var(--radius)] border border-[var(--border)] p-3">
                    {/* Позиция заказа */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] text-[var(--text)]">{it.offerName ?? "—"}</p>
                        <p className="text-[10px] text-[var(--text-subtle)]">артикул: <span className="font-mono">{it.offerCode ?? "—"}</span> · {it.quantity} шт</p>
                      </div>
                    </div>

                    {/* Матч */}
                    {it.matched ? (
                      <div className="mt-2 flex gap-3 rounded-[var(--radius)] bg-[var(--surface-elev)] p-2.5">
                        {it.matched.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.matched.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-[var(--bg)] text-[var(--red)]" title="Нет картинки">
                            <ImageOff className="h-5 w-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 text-[11px]">
                          <p className="font-medium text-[var(--text)]">{it.matched.displayName}</p>
                          {it.matched.fabric && <p className="text-[var(--text-dim)]">Ткань: {it.matched.fabric}</p>}
                          <p className="text-[var(--text-dim)]">Поставщик: {it.matched.supplier ?? "—"}</p>
                          <p className={it.matched.hasContact ? "text-[var(--emerald)]" : "text-[var(--red)]"}>
                            {it.matched.hasContact ? `✓ контакт: ${it.matched.target}` : "✕ нет контакта поставщика"}
                          </p>
                          {!it.matched.imageUrl && <p className="text-[var(--amber)]">⚠ нет своей картинки — будет заглушка</p>}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2 rounded-[var(--radius)] bg-[var(--red-soft)] px-2.5 py-2 text-[11px] text-[var(--red)]">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Товар с кодом «{it.offerCode ?? "—"}» не найден в базе ТОВАРЫ
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </>
          )}
        </div>

        {/* Footer — отправка */}
        {!loading && items.length > 0 && (
          <div className="border-t border-[var(--border)] px-5 py-3">
            {sendResult && (
              <div className={cn("mb-2 rounded-[var(--radius)] px-3 py-2 text-[11px]",
                sendResult.ok ? "bg-[var(--emerald-soft)]/30 text-[var(--emerald)]" : "bg-[var(--red-soft)] text-[var(--red)]")}>
                {sendResult.error
                  ? sendResult.error
                  : sendResult.ok
                  ? `✓ Отправлено: ${sendResult.sentSuppliers.map((s) => `${s.supplier} (${s.items})`).join(", ")}`
                  : "Не отправлено"}
                {sendResult.skipped.length > 0 && (
                  <div className="mt-1 opacity-80">{sendResult.skipped.map((s, i) => <div key={i}>• {s.reason}{s.detail ? `: ${s.detail}` : ""}</div>)}</div>
                )}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button onClick={onClose} className="rounded px-3 py-1.5 text-[11px] text-[var(--text-dim)] hover:bg-white/[0.06]">Закрыть</button>
              <button
                onClick={handleSend}
                disabled={sending || !canSend || (sendResult?.ok ?? false)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-1.5 text-[11px] font-medium",
                  sending || !canSend || sendResult?.ok
                    ? "cursor-not-allowed bg-[var(--surface-elev)] text-[var(--text-subtle)]"
                    : "bg-[var(--accent)] text-white hover:opacity-90",
                )}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {sendResult?.ok ? "Отправлено" : "Отправить поставщику"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dispatch settings modal (2a) ────────────────────────────────────────────────

function DispatchSettingsModal({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const [autoSend, setAutoSend] = useState(true);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [cronInterval, setCronInterval] = useState(2);
  const [dopText, setDopText] = useState("");
  const [dispatchFromAt, setDispatchFromAt] = useState<string | null>(null);
  const [dispatchAction, setDispatchAction] = useState<"none" | "now" | "clear">("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/kaspi/stores/${storeId}/dispatch-settings`)
      .then((r) => r.json())
      .then((d) => {
        setAutoSend(d.autoSendEnabled);
        setHours(Math.floor((d.delayMinutes ?? 60) / 60));
        setMinutes((d.delayMinutes ?? 60) % 60);
        setCronInterval(d.cronIntervalMin ?? 2);
        setDopText(d.dopText ?? "");
        setDispatchFromAt(d.dispatchFromAt ?? null);
      })
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      await fetch(`/api/kaspi/stores/${storeId}/dispatch-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoSendEnabled: autoSend,
          delayMinutes: hours * 60 + minutes,
          cronIntervalMin: cronInterval,
          dopText,
          dispatchFromNow: dispatchAction === "now",
          dispatchClear: dispatchAction === "clear",
        }),
      });
      // обновим отображение
      const r = await fetch(`/api/kaspi/stores/${storeId}/dispatch-settings`).then((x) => x.json());
      setDispatchFromAt(r.dispatchFromAt ?? null);
      setDispatchAction("none");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">⚙️ Настройки отправки</h2>
          <button onClick={onClose} className="rounded p-1.5 text-[var(--text-dim)] hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-[12px] text-[var(--text-dim)]"><Loader2 className="h-4 w-4 animate-spin" /> Загрузка...</div>
        ) : (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer items-center gap-2.5" onClick={() => setAutoSend((s) => !s)}>
              <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border", autoSend ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-strong)]")}>
                {autoSend && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <span className="text-[12px] text-[var(--text)]">Авто-отправка (cron) включена</span>
            </label>

            {/* Слать только новые с момента включения — защита от бэклога */}
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] p-3">
              <p className="text-[11px] font-medium text-[var(--text-dim)]">Авто-отправка только новых заказов</p>
              <p className="mt-1 text-[11px] text-[var(--text)]">
                {dispatchAction === "now"
                  ? <span className="text-[var(--accent)]">→ будет включено с текущего момента (после сохранения)</span>
                  : dispatchAction === "clear"
                  ? <span className="text-[var(--red)]">→ авто-отправка новых будет выключена</span>
                  : dispatchFromAt
                  ? <>Шлём заказы новее: <b>{fmtDateTime(dispatchFromAt)}</b></>
                  : <span className="text-[var(--amber)]">Выключено — cron не отправляет (защита от бэклога)</span>}
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setDispatchAction("now")}
                  className="rounded border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
                  Слать новые с этого момента
                </button>
                {dispatchFromAt && (
                  <button onClick={() => setDispatchAction("clear")}
                    className="rounded border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-dim)] hover:border-[var(--red)] hover:text-[var(--red)]">
                    Выключить
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-[var(--text-subtle)]">cron отправит только заказы, созданные позже этого момента. Старые (бэклог) не уйдут.</p>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--text-dim)]">Задержка перед отправкой</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={hours} onChange={(e) => setHours(Math.max(0, +e.target.value))}
                  className="h-8 w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] tabular-nums outline-none focus:border-[var(--accent)]" />
                <span className="text-[11px] text-[var(--text-dim)]">ч</span>
                <input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(Math.min(59, Math.max(0, +e.target.value)))}
                  className="h-8 w-16 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] tabular-nums outline-none focus:border-[var(--accent)]" />
                <span className="text-[11px] text-[var(--text-dim)]">мин (для теста 0ч 1мин)</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--text-dim)]">Интервал проверки cron (минуты)</label>
              <input type="number" min={1} value={cronInterval} onChange={(e) => setCronInterval(Math.max(1, +e.target.value))}
                className="h-8 w-24 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] tabular-nums outline-none focus:border-[var(--accent)]" />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--text-dim)]">Текст «Доп:» в сообщении</label>
              <textarea value={dopText} onChange={(e) => setDopText(e.target.value)} rows={2}
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none" />
            </div>

            <div className="flex items-center justify-end gap-2">
              {saved && <span className="text-[11px] text-[var(--emerald)]">✓ Сохранено</span>}
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main table ─────────────────────────────────────────────────────────────────

export function OrdersTable({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<{ id: string; code: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { status: syncStatus, running: syncing, startSync } = useSync(storeId);
  const { status: entriesStatus, running: entriesSyncing, start: startEntries } = useEntriesSync(storeId);
  const [refreshPhase, setRefreshPhase] = useState<"orders" | "entries" | null>(null);

  const handleRefresh = async () => {
    if (refreshPhase) return;
    setRefreshPhase("orders");
    await startSync(14);          // заказы за 14 дней
    setRefreshPhase("entries");
    await startEntries();         // позиции (состав) для заказов без позиций
    setRefreshPhase(null);
    load();
  };

  const refreshLabel = refreshPhase === "orders"
    ? `Заказы ${syncStatus ? Math.round((syncStatus.progress ?? 0) * 100) : 0}%`
    : refreshPhase === "entries"
    ? `Позиции ${entriesStatus ? Math.round((entriesStatus.progress ?? 0) * 100) : 0}%`
    : "Обновить за 14 дней";

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debounced) params.set("search", debounced);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/kaspi/stores/${storeId}/orders-list?${params}`);
      const data = await res.json();
      setRows(data.orders ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [storeId, page, debounced, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const resetDispatch = async (orderId: string) => {
    await fetch(`/api/kaspi/stores/${storeId}/orders/${orderId}/dispatch`, { method: "DELETE" });
    setRows((prev) => prev.map((r) => r.id === orderId ? { ...r, dispatched: false } : r));
  };

  const busy = refreshPhase !== null || syncing || entriesSyncing;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру или клиенту..."
            className="h-8 w-[260px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-8 pr-2 text-[12px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 text-[var(--text-dim)] hover:text-[var(--text)]"><X className="h-3.5 w-3.5" /></button>}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2 text-[12px] text-[var(--text)] outline-none hover:border-[var(--border-strong)]"
        >
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <button
          onClick={() => setSettingsOpen(true)}
          title="Настройки отправки поставщику"
          className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 py-2 text-[12px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Settings className="h-3.5 w-3.5" />
          Настройки отправки
        </button>

        <button
          onClick={handleRefresh}
          disabled={busy}
          title="Синхронизировать заказы и их состав за 14 дней"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[var(--radius)] px-3 py-2 text-[12px] font-medium transition-colors",
            busy ? "cursor-not-allowed bg-[var(--surface-elev)] text-[var(--text-subtle)]" : "bg-[var(--accent)] text-white hover:opacity-90",
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
          {refreshLabel}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-[10px] uppercase tracking-[0.05em] text-[var(--text-dim)]">
              <th className="px-3 py-2.5 text-left font-semibold">№ заказа</th>
              <th className="px-3 py-2.5 text-left font-semibold">Дата</th>
              <th className="px-3 py-2.5 text-right font-semibold">Сумма</th>
              <th className="px-3 py-2.5 text-left font-semibold">Статус</th>
              <th className="px-3 py-2.5 text-left font-semibold">Состояние</th>
              <th className="px-3 py-2.5 text-left font-semibold">Клиент</th>
              <th className="px-3 py-2.5 text-left font-semibold">Город</th>
              <th className="px-3 py-2.5 text-center font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--text-dim)]"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">Заказов нет</td></tr>}
            {!loading && rows.map((o, i) => (
              <tr key={o.id} className={cn("border-b border-[var(--border)] hover:bg-white/[0.02]", i % 2 !== 0 && "bg-white/[0.01]")}>
                <td className="px-3 py-2 whitespace-nowrap font-medium text-[var(--text)]">{o.orderCode}</td>
                <td className="px-3 py-2 whitespace-nowrap text-[var(--text-dim)]">{fmtDateTime(o.creationDate)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium text-[var(--text)]">{formatMoney(o.totalPrice)}</td>
                <td className="px-3 py-2"><Badge tone={o.statusTone}>{o.statusLabel}</Badge></td>
                <td className="px-3 py-2 whitespace-nowrap text-[var(--text-dim)]">{o.state}</td>
                <td className="px-3 py-2 max-w-[160px]"><span className="line-clamp-1">{o.customerName ?? "—"}</span></td>
                <td className="px-3 py-2 whitespace-nowrap text-[var(--text-dim)]">{o.city ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setDetailId(o.id)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Eye className="h-3 w-3" /> Подробно
                    </button>
                    {o.dispatched ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--emerald)]">
                          <Check className="h-3 w-3" /> Отправлено
                        </span>
                        <button
                          onClick={() => resetDispatch(o.id)}
                          title="Сбросить отправку (можно отправить заново)"
                          className="rounded p-1 text-[var(--text-subtle)] hover:text-[var(--red)]"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </span>
                    ) : DISPATCHABLE.has(o.statusKey) && (
                      <button
                        onClick={() => setDispatchOrder({ id: o.id, code: o.orderCode })}
                        title="Отправить поставщику"
                        className="inline-flex items-center gap-1 rounded border border-[var(--border-strong)] px-2 py-1 text-[10px] font-medium text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <Send className="h-3 w-3" /> Поставщику
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-dim)]">
          <span>Всего {total} · стр. {page} из {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
            {pageList(page, totalPages).map((p, i) =>
              p === "..." ? <span key={`e${i}`} className="px-1 text-[var(--text-subtle)]">…</span> : (
                <button key={p} onClick={() => setPage(p as number)}
                  className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-[var(--radius)] border px-2 font-medium tabular-nums",
                    p === page ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]")}>{p}</button>
              ),
            )}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {detailId && <DetailModal storeId={storeId} orderId={detailId} onClose={() => setDetailId(null)} />}
      {dispatchOrder && (
        <DispatchPreviewModal
          storeId={storeId}
          orderId={dispatchOrder.id}
          orderCode={dispatchOrder.code}
          onClose={() => setDispatchOrder(null)}
          onSent={load}
        />
      )}
      {settingsOpen && <DispatchSettingsModal storeId={storeId} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
