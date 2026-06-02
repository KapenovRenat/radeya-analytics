"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Upload, X, FileText, CheckCircle,
  XCircle, Loader2, Plus, Trash2, UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipient { id: string; name: string; chatId: string; }
interface WeekOption { weekStart: string; weekLabel: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayISO(iso: string): string {
  const d = new Date(iso);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function buildWeekLabel(iso: string): string {
  const d = new Date(iso);
  const sun = new Date(d);
  sun.setUTCDate(d.getUTCDate() + 6);
  const s = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
  const e = sun.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${s} — ${e}`;
}

function Section({
  title, badge, children,
}: { title: string; badge?: "required" | "optional"; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elev)] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
        {title}
        {badge === "required" && (
          <span className="rounded bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">обязательно</span>
        )}
        {badge === "optional" && (
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-subtle)]">опционально</span>
        )}
      </h3>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ReportClient({ storeId }: { storeId: string }) {
  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChatId, setNewChatId] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  // Overview week
  const [overviewWeeks, setOverviewWeeks] = useState<WeekOption[]>([]);
  const [selectedOverviewWeek, setSelectedOverviewWeek] = useState("");

  // Campaign week (optional)
  const [campaignWeeks, setCampaignWeeks] = useState<WeekOption[]>([]);
  const [selectedCampaignWeek, setSelectedCampaignWeek] = useState("");
  const [includeCampaigns, setIncludeCampaigns] = useState(false);

  // Daily CSV
  const [dailyFile, setDailyFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Send
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number; errors: string[] } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadRecipients = useCallback(async () => {
    const res = await fetch(`/api/kaspi/ad/${storeId}/tg-recipients`);
    const data = await res.json();
    setRecipients(data.recipients ?? []);
  }, [storeId]);

  const loadOverviewWeeks = useCallback(async () => {
    const res = await fetch(`/api/kaspi/ad/${storeId}/overview`);
    const data = await res.json();
    const rows: { date: string }[] = data.rows ?? [];
    const weekMap = new Map<string, string>();
    for (const r of rows) {
      const mon = getMondayISO(r.date);
      if (!weekMap.has(mon)) weekMap.set(mon, buildWeekLabel(mon));
    }
    const weeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([weekStart, weekLabel]) => ({ weekStart, weekLabel }));
    setOverviewWeeks(weeks);
    if (weeks.length > 0) setSelectedOverviewWeek(weeks[0].weekStart);
  }, [storeId]);

  const loadCampaignWeeks = useCallback(async () => {
    const res = await fetch(`/api/kaspi/ad/${storeId}/weeks`);
    const data = await res.json();
    const weeks = ((data.weeks ?? []) as { weekStart: string; granularity: string }[])
      .filter((w) => w.granularity === "week")
      .map((w) => ({ weekStart: w.weekStart, weekLabel: buildWeekLabel(w.weekStart) }));
    setCampaignWeeks(weeks);
    if (weeks.length > 0) setSelectedCampaignWeek(weeks[0].weekStart);
  }, [storeId]);

  useEffect(() => {
    loadRecipients();
    loadOverviewWeeks();
    loadCampaignWeeks();
  }, [loadRecipients, loadOverviewWeeks, loadCampaignWeeks]);

  // ── Recipient management ──────────────────────────────────────────────────

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddRecipient = async () => {
    if (!newName.trim() || !newChatId.trim()) return;
    setAddingLoading(true);
    try {
      const res = await fetch(`/api/kaspi/ad/${storeId}/tg-recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), chatId: newChatId.trim() }),
      });
      const data = await res.json();
      if (!data.error) {
        await loadRecipients();
        if (data.recipient) setSelectedIds((prev) => new Set([...prev, data.recipient.id]));
        setNewName("");
        setNewChatId("");
        setAddingNew(false);
      }
    } finally {
      setAddingLoading(false);
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    await fetch(`/api/kaspi/ad/${storeId}/tg-recipients?id=${id}`, { method: "DELETE" });
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    await loadRecipients();
  };

  // ── Send ──────────────────────────────────────────────────────────────────

  const canSend = selectedIds.size > 0 && selectedOverviewWeek && dailyFile;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    setSendError(null);

    const formData = new FormData();
    [...selectedIds].forEach((id) => formData.append("recipientIds", id));
    formData.append("overviewWeek", selectedOverviewWeek);
    if (includeCampaigns && selectedCampaignWeek) formData.append("campaignWeek", selectedCampaignWeek);
    formData.append("dailyCsv", dailyFile!);

    try {
      const res = await fetch(`/api/kaspi/ad/${storeId}/report`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) setSendError(data.error);
      else setResult(data);
    } catch {
      setSendError("Ошибка сети");
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[720px]">
      <div>
        <h1 className="text-[18px] font-semibold text-[var(--text)]">Отчёт в Telegram</h1>
        <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">
          Сформируй и отправь еженедельный отчёт прямо из приложения
        </p>
      </div>

      {/* ── Recipients ── */}
      <Section title="👥 Получатели" badge="required">
        <div className="flex flex-col gap-2">
          {recipients.length === 0 && !addingNew && (
            <p className="text-[12px] text-[var(--text-subtle)]">Нет получателей — добавь первого</p>
          )}

          {recipients.map((r) => {
            const isSelected = selectedIds.has(r.id);
            return (
              <div
                key={r.id}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5 transition-colors",
                  isSelected
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]",
                )}
                onClick={() => toggleRecipient(r.id)}
              >
                <span className={cn(
                  "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-strong)]",
                )}>
                  {isSelected && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-[var(--text)]">{r.name}</p>
                  <p className="text-[10px] text-[var(--text-subtle)]">chat ID: {r.chatId}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteRecipient(r.id); }}
                  className="shrink-0 rounded p-1 text-[var(--text-subtle)] opacity-0 transition-opacity hover:text-[var(--red)] group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {/* Add new form */}
          {addingNew ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3">
              <p className="text-[11px] font-medium text-[var(--text-dim)]">Новый получатель</p>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Имя (напр. Ренат)"
                  className="h-7 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                <input
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="Chat ID"
                  className="h-7 w-32 rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text)] font-mono outline-none focus:border-[var(--accent)]"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddRecipient(); if (e.key === "Escape") setAddingNew(false); }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-subtle)]">
                Узнать chat ID → написать боту{" "}
                <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">@userinfobot</a>
              </p>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleAddRecipient} disabled={addingLoading || !newName.trim() || !newChatId.trim()}>
                  {addingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Добавить
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setAddingNew(false); setNewName(""); setNewChatId(""); }}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-1.5 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] px-3 py-2 text-[11px] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Добавить получателя
            </button>
          )}

          {selectedIds.size > 0 && (
            <p className="text-[11px] text-[var(--accent)]">
              ✓ Выбрано: {selectedIds.size} из {recipients.length}
            </p>
          )}
        </div>
      </Section>

      {/* ── Overview week ── */}
      <Section title="📈 Обзор — неделя" badge="required">
        {overviewWeeks.length === 0 ? (
          <p className="text-[12px] text-[var(--text-subtle)]">
            Нет данных. Загрузи «Обзорный отчёт» в{" "}
            <a href={`/stores/${storeId}/ad/overview`} className="text-[var(--accent)] underline">разделе Обзор</a>.
          </p>
        ) : (
          <select
            value={selectedOverviewWeek}
            onChange={(e) => setSelectedOverviewWeek(e.target.value)}
            className="h-8 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            {overviewWeeks.map((w) => (
              <option key={w.weekStart} value={w.weekStart}>{w.weekLabel}</option>
            ))}
          </select>
        )}
      </Section>

      {/* ── Campaign week (optional) ── */}
      <Section title="📋 Топ кампаний" badge="optional">
        <label className="mb-3 flex cursor-pointer items-center gap-2.5" onClick={() => setIncludeCampaigns((s) => !s)}>
          <span className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
            includeCampaigns ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-strong)]",
          )}>
            {includeCampaigns && (
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.5L4 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="text-[12px] text-[var(--text)]">Включить топ активных кампаний в отчёт</span>
        </label>

        {includeCampaigns && (
          campaignWeeks.length === 0 ? (
            <p className="text-[12px] text-[var(--text-subtle)]">
              Нет данных. Загрузи CSV кампаний в{" "}
              <a href={`/stores/${storeId}/ad/upload`} className="text-[var(--accent)] underline">разделе Загрузка</a>.
            </p>
          ) : (
            <select
              value={selectedCampaignWeek}
              onChange={(e) => setSelectedCampaignWeek(e.target.value)}
              className="h-8 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              {campaignWeeks.map((w) => (
                <option key={w.weekStart} value={w.weekStart}>{w.weekLabel}</option>
              ))}
            </select>
          )
        )}
      </Section>

      {/* ── Daily CSV ── */}
      <Section title="📅 Вчерашний день — CSV" badge="required">
        <p className="mb-3 text-[11px] text-[var(--text-dim)]">
          Скачай «Обзорный отчёт» из Kaspi за вчерашний день и загрузи сюда
        </p>
        {!dailyFile ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.name.endsWith(".csv")) setDailyFile(f); }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius)] border-2 border-dashed p-6 transition-colors",
              dragging ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-strong)] hover:border-[var(--accent)]",
            )}
          >
            <Upload className="h-5 w-5 text-[var(--text-dim)]" />
            <p className="text-[12px] text-[var(--text-dim)]">Перетащи CSV или кликни</p>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setDailyFile(f); }} />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-2.5">
            <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <span className="flex-1 truncate text-[12px] font-medium text-[var(--text)]">{dailyFile.name}</span>
            <button onClick={() => setDailyFile(null)} className="text-[var(--text-dim)] hover:text-[var(--red)]">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </Section>

      {/* ── Send ── */}
      <div className="flex flex-col gap-3">
        {sendError && (
          <div className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--red-soft)] px-4 py-3 text-[12px] text-[var(--red)]">
            <XCircle className="h-4 w-4 shrink-0" />
            {sendError}
          </div>
        )}
        {result && (
          <div className={cn(
            "flex items-start gap-2 rounded-[var(--radius)] px-4 py-3 text-[12px]",
            result.errors.length === 0 ? "bg-[var(--emerald-soft)]/30 text-[var(--emerald)]" : "bg-[var(--amber)]/10 text-[var(--amber)]",
          )}>
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Отправлено {result.sent} из {result.total} получателей 🎉</p>
              {result.errors.map((e, i) => <p key={i} className="mt-0.5 text-[11px] opacity-80">{e}</p>)}
            </div>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-[var(--radius)] py-3 text-[13px] font-semibold transition-all",
            canSend && !sending
              ? "bg-[var(--accent)] text-white hover:opacity-90"
              : "bg-[var(--surface-elev)] text-[var(--text-subtle)] cursor-not-allowed",
          )}
        >
          {sending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Отправляем...</>
            : <><Send className="h-4 w-4" /> Отправить отчёт в Telegram</>}
        </button>

        {!canSend && !sending && (
          <p className="text-center text-[11px] text-[var(--text-subtle)]">
            {selectedIds.size === 0 && "· Выбери получателей "}
            {!selectedOverviewWeek && "· Выбери неделю обзора "}
            {!dailyFile && "· Загрузи CSV за вчера"}
          </p>
        )}
      </div>
    </div>
  );
}
