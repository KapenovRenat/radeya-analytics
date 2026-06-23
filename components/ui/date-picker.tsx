"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Date helpers (UTC, string-based YYYY-MM-DD) ───────────────────────────────

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function parseISO(s: string): Date {
  return new Date(s + "T00:00:00.000Z");
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtLabel(iso: string): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** 42 days (6 weeks) for the month grid, starting Monday. */
function buildMonthDays(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const firstDow = (first.getUTCDay() + 6) % 7; // Mon = 0
  const start = new Date(first);
  start.setUTCDate(1 - firstDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push(d);
  }
  return days;
}

// ─── Calendar grid (shared) ────────────────────────────────────────────────────

function CalendarGrid({
  visible,
  setVisible,
  isSelected,
  isRangeMiddle,
  isRangeStart,
  isRangeEnd,
  isDisabled,
  onPick,
  onHover,
}: {
  visible: { year: number; month: number };
  setVisible: (v: { year: number; month: number }) => void;
  isSelected: (iso: string) => boolean;
  isRangeMiddle: (iso: string) => boolean;
  isRangeStart: (iso: string) => boolean;
  isRangeEnd: (iso: string) => boolean;
  isDisabled: (iso: string) => boolean;
  onPick: (iso: string) => void;
  onHover?: (iso: string | null) => void;
}) {
  const days = useMemo(() => buildMonthDays(visible.year, visible.month), [visible]);
  const today = todayISO();

  const prevMonth = () => {
    const m = visible.month - 1;
    setVisible(m < 0 ? { year: visible.year - 1, month: 11 } : { year: visible.year, month: m });
  };
  const nextMonth = () => {
    const m = visible.month + 1;
    setVisible(m > 11 ? { year: visible.year + 1, month: 0 } : { year: visible.year, month: m });
  };

  return (
    <div className="w-[244px] select-none p-2">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button onClick={prevMonth} className="rounded p-1 text-[var(--text-dim)] hover:bg-white/[0.06] hover:text-[var(--text)]">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[12px] font-semibold text-[var(--text)]">
          {MONTHS_NOM[visible.month]} {visible.year}
        </span>
        <button onClick={nextMonth} className="rounded p-1 text-[var(--text-dim)] hover:bg-white/[0.06] hover:text-[var(--text)]">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-medium text-[var(--text-subtle)]">{w}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => onHover?.(null)}>
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getUTCMonth() === visible.month;
          const disabled = isDisabled(iso);
          const selected = isSelected(iso);
          const start = isRangeStart(iso);
          const end = isRangeEnd(iso);
          const middle = isRangeMiddle(iso);
          const isToday = iso === today;

          return (
            <button
              key={iso}
              disabled={disabled}
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover?.(iso)}
              className={cn(
                "relative h-7 rounded text-[11px] tabular-nums transition-colors",
                disabled && "cursor-not-allowed text-[var(--text-subtle)] opacity-40",
                !disabled && !selected && !middle && (inMonth ? "text-[var(--text)] hover:bg-white/[0.08]" : "text-[var(--text-subtle)] hover:bg-white/[0.05]"),
                middle && !selected && "bg-[var(--accent)]/15 text-[var(--text)]",
                (selected || start || end) && "bg-[var(--accent)] font-semibold text-white",
                start && "rounded-r-none",
                end && "rounded-l-none",
              )}
            >
              {d.getUTCDate()}
              {isToday && !selected && !middle && (
                <span className="absolute bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DateRangePicker ───────────────────────────────────────────────────────────

export function DateRangePicker({
  from,
  to,
  onChange,
  max,
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  /** Max selectable date (default: today) */
  max?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const maxDate = max ?? todayISO();

  const [visible, setVisible] = useState(() => {
    const d = parseISO(to || todayISO());
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  useEffect(() => {
    if (!open) { setPendingStart(null); setHovered(null); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [open]);

  // Effective range for highlighting (during selection use pendingStart + hovered)
  const rangeStart = pendingStart ?? from;
  const rangeEnd = pendingStart ? (hovered ?? pendingStart) : to;
  const lo = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
  const hi = rangeStart <= rangeEnd ? rangeEnd : rangeStart;

  const handlePick = (iso: string) => {
    if (!pendingStart) {
      setPendingStart(iso);
      setHovered(iso);
    } else {
      const a = pendingStart;
      if (iso >= a) { onChange(a, iso); } else { onChange(iso, a); }
      setPendingStart(null);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-2.5 text-[11px] font-medium text-[var(--text)] tabular-nums hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
      >
        <Calendar className="h-3.5 w-3.5 text-[var(--text-dim)]" />
        <span>{fmtLabel(from)}</span>
        <span className="text-[var(--text-dim)]">—</span>
        <span>{fmtLabel(to)}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] shadow-lg">
          <CalendarGrid
            visible={visible}
            setVisible={setVisible}
            isDisabled={(iso) => iso > maxDate}
            isSelected={(iso) => iso === lo && iso === hi}
            isRangeStart={(iso) => iso === lo && lo !== hi}
            isRangeEnd={(iso) => iso === hi && lo !== hi}
            isRangeMiddle={(iso) => iso > lo && iso < hi}
            onPick={handlePick}
            onHover={(iso) => pendingStart && setHovered(iso)}
          />
          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--border)] px-2 py-1.5">
            <button
              onClick={() => { setPendingStart(null); }}
              className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {pendingStart ? "Сброс выбора" : ""}
            </button>
            <button
              onClick={() => { const t = todayISO(); onChange(t, t); setOpen(false); }}
              className="text-[10px] font-medium text-[var(--accent)] hover:underline"
            >
              Сегодня
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DatePicker (single) ───────────────────────────────────────────────────────

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Выбрать дату",
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [visible, setVisible] = useState(() => {
    const d = parseISO(value || todayISO());
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="inline-flex h-7 w-full items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] font-medium text-[var(--text)] tabular-nums hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:outline-none"
      >
        <Calendar className="h-3 w-3 text-[var(--text-dim)]" />
        <span className={value ? "" : "text-[var(--text-subtle)]"}>{value ? fmtLabel(value) : placeholder}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] shadow-lg">
          <CalendarGrid
            visible={visible}
            setVisible={setVisible}
            isDisabled={(iso) => (min ? iso < min : false) || (max ? iso > max : false)}
            isSelected={(iso) => iso === value}
            isRangeStart={() => false}
            isRangeEnd={() => false}
            isRangeMiddle={() => false}
            onPick={(iso) => { onChange(iso); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}
