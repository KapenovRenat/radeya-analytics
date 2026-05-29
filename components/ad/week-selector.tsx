"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekOption {
  weekStart: string; // ISO string
  weekEnd: string;   // ISO string
}

// ─── Label helper ─────────────────────────────────────────────────────────────

export function fmtWeekLabel(weekStart: string, weekEnd: string): string {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  const year = endDate.getUTCFullYear();
  const startStr = startDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const endStr = endDate.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${startStr} — ${endStr} ${year}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeekSelector({
  weeks,
  selected,
  onChange,
  loading = false,
  onDelete,
}: {
  weeks: WeekOption[];
  selected: string[]; // ISO weekStart strings
  onChange: (selected: string[]) => void;
  loading?: boolean;
  /** When provided, each week row shows a delete button with inline confirm */
  onDelete?: (weekStart: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [confirmWeek, setConfirmWeek] = useState<string | null>(null); // weekStart being confirmed
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) { setConfirmWeek(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const allSelected = selected.length === weeks.length;

  const toggle = (weekStart: string) => {
    if (selected.includes(weekStart)) {
      onChange(selected.filter((s) => s !== weekStart));
    } else {
      onChange([...selected, weekStart]);
    }
  };

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(weeks.map((w) => w.weekStart));
  };

  const handleDelete = async (weekStart: string) => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(weekStart);
      // Remove from selection if it was selected
      onChange(selected.filter((s) => s !== weekStart));
    } finally {
      setDeleting(false);
      setConfirmWeek(null);
    }
  };

  const label = loading
    ? "Загрузка недель..."
    : weeks.length === 0
    ? "Нет данных"
    : allSelected
    ? `Все ${weeks.length} нед.`
    : selected.length === 0
    ? "Не выбрано"
    : selected.length === 1
    ? fmtWeekLabel(
        weeks.find((w) => w.weekStart === selected[0])?.weekStart ?? selected[0],
        weeks.find((w) => w.weekStart === selected[0])?.weekEnd ?? selected[0],
      )
    : `${selected.length} из ${weeks.length} недель`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        disabled={loading || weeks.length === 0}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-3 text-[11px] font-medium transition-colors",
          loading || weeks.length === 0
            ? "cursor-not-allowed text-[var(--text-subtle)]"
            : "text-[var(--text)] hover:border-[var(--border-strong)]",
        )}
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[300px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] py-1 shadow-lg">
          {/* Select all */}
          <button
            onClick={toggleAll}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[11px] text-[var(--text)] hover:bg-white/[0.06]"
          >
            <span
              className={cn(
                "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                allSelected
                  ? "bg-[var(--accent)] border-[var(--accent)]"
                  : selected.length > 0
                  ? "bg-[var(--accent)]/40 border-[var(--accent)]"
                  : "border-[var(--border-strong)]",
              )}
            >
              {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
            </span>
            <span className="font-medium">Выбрать все</span>
            <span className="ml-auto text-[10px] text-[var(--text-subtle)]">{weeks.length} нед.</span>
          </button>
          <div className="my-1 border-t border-[var(--border)]" />

          <div className="max-h-[320px] overflow-y-auto">
            {weeks.map((w) => {
              const isSelected = selected.includes(w.weekStart);
              const isConfirming = confirmWeek === w.weekStart;

              return (
                <div key={w.weekStart} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06]">
                  {/* Checkbox + label */}
                  <button
                    onClick={() => { if (!isConfirming) toggle(w.weekStart); }}
                    className="flex flex-1 min-w-0 items-center gap-2.5 text-[11px]"
                  >
                    <span
                      className={cn(
                        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                        isSelected
                          ? "bg-[var(--accent)] border-[var(--accent)]"
                          : "border-[var(--border-strong)]",
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span className={cn("truncate", isSelected ? "text-[var(--text)]" : "text-[var(--text-dim)]")}>
                      {fmtWeekLabel(w.weekStart, w.weekEnd)}
                    </span>
                  </button>

                  {/* Delete area */}
                  {onDelete && (
                    isConfirming ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-[10px] text-[var(--red)]">Удалить?</span>
                        <button
                          onClick={() => handleDelete(w.weekStart)}
                          disabled={deleting}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--red)] hover:bg-[var(--red-soft)]"
                        >
                          {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Да"}
                        </button>
                        <button
                          onClick={() => setConfirmWeek(null)}
                          disabled={deleting}
                          className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)] hover:bg-white/[0.06]"
                        >
                          Нет
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmWeek(w.weekStart); }}
                        className="shrink-0 rounded p-0.5 text-[var(--text-subtle)] opacity-0 transition-opacity hover:text-[var(--red)] group-hover:opacity-100"
                        title="Удалить неделю"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
