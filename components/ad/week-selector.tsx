"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Check, Trash2, Loader2, Plus, Calendar, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekOption {
  weekStart: string; // ISO string
  weekEnd: string;   // ISO string
  granularity: "week" | "day";
}

// Internal: a group shown in the dropdown (one week row, optionally with day children)
interface WeekGroup {
  weekStart: string; // container weekStart (Monday of the group)
  weekEnd: string;   // container weekEnd  (Sunday of the group)
  days: WeekOption[]; // [] → pure week period; non-empty → shows day children
  hasExplicitContainer: boolean; // true if there's an ad_periods / week-stats row for this range
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Return the ISO string for the Monday of the week containing dateStr */
function getMondayISO(dateStr: string): string {
  const d = new Date(dateStr);
  const dow = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

/** Return the ISO string for the Sunday of the week that starts on mondayISO */
function getSundayISO(mondayISO: string): string {
  const d = new Date(mondayISO);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

/** Build display groups: week containers + their day children */
function buildGroups(weeks: WeekOption[]): WeekGroup[] {
  const weekItems = weeks.filter((w) => w.granularity === "week");
  const dayItems  = weeks.filter((w) => w.granularity === "day");

  // Map monday-ISO → group
  const groups = new Map<string, WeekGroup>();

  // 1. Week containers (from ad_weekly_stats granularity=week or ad_periods)
  for (const w of weekItems) {
    const mon = getMondayISO(w.weekStart);
    groups.set(mon, {
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      days: [],
      hasExplicitContainer: true,
    });
  }

  // 2. Assign days to their Mon–Sun group
  for (const d of dayItems) {
    const mon = getMondayISO(d.weekStart);
    if (groups.has(mon)) {
      groups.get(mon)!.days.push(d);
    } else {
      // Auto-create group for this calendar week
      groups.set(mon, {
        weekStart: mon,
        weekEnd: getSundayISO(mon),
        days: [d],
        hasExplicitContainer: false,
      });
    }
  }

  // Sort days within each group Mon→Sun
  for (const g of groups.values()) {
    g.days.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  // Return groups sorted newest-first
  return Array.from(groups.values()).sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart),
  );
}

// ─── Label helper ─────────────────────────────────────────────────────────────

/**
 * Format a period label.
 * - Daily (granularity === "day" or weekStart === weekEnd): "пн, 26 мая 2026"
 * - Weekly: "26 мая — 1 июня 2026"
 */
export function fmtWeekLabel(
  weekStart: string,
  weekEnd: string,
  granularity?: string,
): string {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  const isDay = granularity === "day" || weekStart === weekEnd;

  if (isDay) {
    return startDate.toLocaleDateString("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  const year = endDate.getUTCFullYear();
  const startStr = startDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  const endStr   = endDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  return `${startStr} — ${endStr} ${year}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeekSelector({
  weeks,
  selected,
  onChange,
  loading = false,
  onDelete,
  onCreatePeriod,
}: {
  weeks: WeekOption[];
  selected: string[]; // ISO weekStart strings of individual periods
  onChange: (selected: string[]) => void;
  loading?: boolean;
  onDelete?: (weekStart: string) => Promise<void>;
  onCreatePeriod?: (weekStart: string, weekEnd: string, granularity: "week" | "day") => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Per-group expanded state (groups with days start expanded)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [confirmWeek, setConfirmWeek] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create period form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFrom, setCreateFrom] = useState("");
  const [createTo, setCreateTo]   = useState("");
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState("");

  const allGroups = buildGroups(weeks);

  // Filter groups by search query (matches week label or any day label)
  const groups = search.trim()
    ? allGroups.flatMap((g) => {
        const q = search.toLowerCase();
        const weekLabel = fmtWeekLabel(g.weekStart, g.weekEnd).toLowerCase();
        if (weekLabel.includes(q)) return [g]; // whole group matches
        // Filter to matching days only
        const matchingDays = g.days.filter((d) =>
          fmtWeekLabel(d.weekStart, d.weekEnd, "day").toLowerCase().includes(q),
        );
        if (matchingDays.length > 0) return [{ ...g, days: matchingDays }];
        return [];
      })
    : allGroups;

  // Auto-expand groups that have days on first render
  useEffect(() => {
    setExpandedGroups(new Set(groups.filter((g) => g.days.length > 0).map((g) => g.weekStart)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks.length]);

  useEffect(() => {
    if (!open) {
      setConfirmWeek(null);
      setShowCreateForm(false);
      setCreateError("");
      setSearch("");
    } else {
      // Focus search on open
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ─── Selection helpers ────────────────────────────────────────────────────

  const selectedSet = new Set(selected);

  const groupSelectionState = (g: WeekGroup): "all" | "partial" | "none" => {
    if (g.days.length === 0) {
      return selectedSet.has(g.weekStart) ? "all" : "none";
    }
    const n = g.days.filter((d) => selectedSet.has(d.weekStart)).length;
    if (n === 0) return "none";
    if (n === g.days.length) return "all";
    return "partial";
  };

  const toggleGroup = (g: WeekGroup) => {
    if (g.days.length === 0) {
      // Pure week period — toggle by weekStart
      if (selectedSet.has(g.weekStart)) {
        onChange(selected.filter((s) => s !== g.weekStart));
      } else {
        onChange([...selected, g.weekStart]);
      }
    } else {
      // Day-group — toggle all day weekStarts
      const state = groupSelectionState(g);
      const dayStarts = new Set(g.days.map((d) => d.weekStart));
      if (state === "all") {
        onChange(selected.filter((s) => !dayStarts.has(s)));
      } else {
        const existing = new Set(selected);
        onChange([...selected, ...g.days.map((d) => d.weekStart).filter((s) => !existing.has(s))]);
      }
    }
  };

  const toggleDay = (dayStart: string) => {
    if (selectedSet.has(dayStart)) {
      onChange(selected.filter((s) => s !== dayStart));
    } else {
      onChange([...selected, dayStart]);
    }
  };

  // All selectable weekStarts (days inside day-groups + week weekStarts)
  const allSelectableStarts: string[] = groups.flatMap((g) =>
    g.days.length > 0 ? g.days.map((d) => d.weekStart) : [g.weekStart],
  );
  const allSelected = allSelectableStarts.length > 0 &&
    allSelectableStarts.every((s) => selectedSet.has(s));
  const someSelected = !allSelected && allSelectableStarts.some((s) => selectedSet.has(s));

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(allSelectableStarts);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  const handleDelete = async (weekStart: string) => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(weekStart);
      onChange(selected.filter((s) => s !== weekStart));
    } finally {
      setDeleting(false);
      setConfirmWeek(null);
    }
  };

  // ─── Create period ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!onCreatePeriod || !createFrom) return;
    setCreateError("");
    const to = createTo || createFrom;
    if (isNaN(Date.parse(createFrom)) || isNaN(Date.parse(to))) {
      setCreateError("Неверный формат даты");
      return;
    }
    if (new Date(to) < new Date(createFrom)) {
      setCreateError("Дата окончания раньше начала");
      return;
    }
    const days = (new Date(to).getTime() - new Date(createFrom).getTime()) / 86_400_000;
    const granularity: "week" | "day" = days === 0 ? "day" : "week";
    setCreating(true);
    try {
      await onCreatePeriod(createFrom, to, granularity);
      setCreateFrom("");
      setCreateTo("");
      setShowCreateForm(false);
    } catch {
      setCreateError("Ошибка при создании периода");
    } finally {
      setCreating(false);
    }
  };

  // ─── Button label ─────────────────────────────────────────────────────────

  const totalGroups = groups.length;
  const selectedGroupCount = groups.filter((g) => groupSelectionState(g) !== "none").length;

  const label = loading
    ? "Загрузка..."
    : groups.length === 0
    ? "Нет периодов"
    : allSelected
    ? `Все ${totalGroups} нед.`
    : selected.length === 0
    ? "Не выбрано"
    : selectedGroupCount === 1
    ? (() => {
        const g = groups.find((g) => groupSelectionState(g) !== "none")!;
        if (g.days.length > 0) {
          const selDays = g.days.filter((d) => selectedSet.has(d.weekStart));
          if (selDays.length === 1) return fmtWeekLabel(selDays[0].weekStart, selDays[0].weekEnd, "day");
          return `${selDays.length} дн. · ${fmtWeekLabel(g.weekStart, g.weekEnd)}`;
        }
        return fmtWeekLabel(g.weekStart, g.weekEnd);
      })()
    : `${selectedGroupCount} из ${totalGroups} недель`;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        disabled={loading}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-3 text-[11px] font-medium transition-colors",
          loading
            ? "cursor-not-allowed text-[var(--text-subtle)]"
            : "text-[var(--text)] hover:border-[var(--border-strong)]",
        )}
      >
        <span className="max-w-[260px] truncate">{label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[320px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] py-1 shadow-lg">

          {/* Search */}
          <div className="px-2 pb-1 pt-1.5">
            <div className="relative flex items-center">
              <Search className="absolute left-2 h-3 w-3 text-[var(--text-subtle)]" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск периода..."
                className="h-6 w-full rounded border border-[var(--border)] bg-[var(--surface)] pl-6 pr-6 text-[11px] text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none focus:border-[var(--accent)]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-1.5 text-[var(--text-dim)] hover:text-[var(--text)]">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Select all */}
          {allGroups.length > 0 && (
            <>
              <div className="my-0.5 border-t border-[var(--border)]" />
              <button
                onClick={toggleAll}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[11px] text-[var(--text)] hover:bg-white/[0.06]"
              >
                <span className={cn(
                  "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                  allSelected ? "bg-[var(--accent)] border-[var(--accent)]"
                    : someSelected ? "bg-[var(--accent)]/40 border-[var(--accent)]"
                    : "border-[var(--border-strong)]",
                )}>
                  {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="font-medium">Выбрать все</span>
                <span className="ml-auto text-[10px] text-[var(--text-subtle)]">{totalGroups} нед.</span>
              </button>
              <div className="my-1 border-t border-[var(--border)]" />
            </>
          )}

          {/* Groups */}
          <div className="max-h-[340px] overflow-y-auto">
            {groups.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-[var(--text-subtle)]">
                {search ? "Ничего не найдено" : "Нет периодов — загрузи CSV или создай период"}
              </p>
            )}

            {groups.map((g) => {
              const state   = groupSelectionState(g);
              const hasDays = g.days.length > 0;
              const expanded = expandedGroups.has(g.weekStart);
              const isConfirming = confirmWeek === g.weekStart;

              return (
                <div key={g.weekStart}>
                  {/* ── Week/group header row ── */}
                  <div className={cn(
                    "group flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/[0.06]",
                    hasDays && "border-b border-[var(--border)]/30",
                  )}>
                    {/* Expand/collapse chevron */}
                    {hasDays ? (
                      <button
                        onClick={() => setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(g.weekStart)) next.delete(g.weekStart);
                          else next.add(g.weekStart);
                          return next;
                        })}
                        className="shrink-0 text-[var(--text-subtle)] hover:text-[var(--text)]"
                      >
                        {expanded
                          ? <ChevronDown className="h-3 w-3" />
                          : <ChevronRight className="h-3 w-3" />}
                      </button>
                    ) : (
                      <span className="w-3 shrink-0" />
                    )}

                    {/* Group checkbox + label */}
                    <button
                      onClick={() => { if (!isConfirming) toggleGroup(g); }}
                      className="flex flex-1 min-w-0 items-center gap-2 text-[11px]"
                    >
                      <span className={cn(
                        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                        state === "all"     ? "bg-[var(--accent)] border-[var(--accent)]"
                          : state === "partial" ? "bg-[var(--accent)]/40 border-[var(--accent)]"
                          : "border-[var(--border-strong)]",
                      )}>
                        {state === "all" && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className={cn(
                        "truncate font-medium",
                        state !== "none" ? "text-[var(--text)]" : "text-[var(--text-dim)]",
                      )}>
                        {fmtWeekLabel(g.weekStart, g.weekEnd)}
                      </span>
                      {hasDays && (
                        <span className="ml-1 shrink-0 rounded bg-[var(--accent)]/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                          {g.days.length} дн.
                        </span>
                      )}
                    </button>

                    {/* Delete */}
                    {onDelete && !hasDays && (
                      isConfirming ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-[10px] text-[var(--red)]">Удалить?</span>
                          <button onClick={() => handleDelete(g.weekStart)} disabled={deleting}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--red)] hover:bg-[var(--red-soft)]">
                            {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Да"}
                          </button>
                          <button onClick={() => setConfirmWeek(null)} disabled={deleting}
                            className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)] hover:bg-white/[0.06]">
                            Нет
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmWeek(g.weekStart); }}
                          className="shrink-0 rounded p-0.5 text-[var(--text-subtle)] opacity-0 transition-opacity hover:text-[var(--red)] group-hover:opacity-100"
                          title="Удалить неделю"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )
                    )}
                  </div>

                  {/* ── Day children ── */}
                  {hasDays && expanded && g.days.map((d) => {
                    const daySelected  = selectedSet.has(d.weekStart);
                    const isDayConfirm = confirmWeek === d.weekStart;

                    return (
                      <div key={d.weekStart} className="group flex items-center gap-1.5 py-1 pl-9 pr-3 hover:bg-white/[0.04]">
                        <button
                          onClick={() => { if (!isDayConfirm) toggleDay(d.weekStart); }}
                          className="flex flex-1 min-w-0 items-center gap-2 text-[11px]"
                        >
                          <span className={cn(
                            "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border",
                            daySelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-strong)]",
                          )}>
                            {daySelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          <span className={cn("truncate", daySelected ? "text-[var(--text)]" : "text-[var(--text-dim)]")}>
                            {fmtWeekLabel(d.weekStart, d.weekEnd, "day")}
                          </span>
                        </button>

                        {onDelete && (
                          isDayConfirm ? (
                            <div className="flex shrink-0 items-center gap-1">
                              <span className="text-[10px] text-[var(--red)]">Удалить?</span>
                              <button onClick={() => handleDelete(d.weekStart)} disabled={deleting}
                                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--red)] hover:bg-[var(--red-soft)]">
                                {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Да"}
                              </button>
                              <button onClick={() => setConfirmWeek(null)} disabled={deleting}
                                className="rounded px-1.5 py-0.5 text-[10px] text-[var(--text-dim)] hover:bg-white/[0.06]">
                                Нет
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmWeek(d.weekStart); }}
                              className="shrink-0 rounded p-0.5 text-[var(--text-subtle)] opacity-0 transition-opacity hover:text-[var(--red)] group-hover:opacity-100"
                              title="Удалить день"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Create period */}
          {onCreatePeriod && (
            <>
              <div className="my-1 border-t border-[var(--border)]" />
              {!showCreateForm ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--text-dim)] hover:bg-white/[0.06] hover:text-[var(--accent)]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Создать период</span>
                </button>
              ) : (
                <div className="px-3 py-2 space-y-2">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-wide">
                    <Calendar className="h-3 w-3" />
                    <span>Новый период</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--text-subtle)] mb-0.5">С</label>
                      <input type="date" value={createFrom}
                        onChange={(e) => { setCreateFrom(e.target.value); if (!createTo) setCreateTo(e.target.value); }}
                        className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--text-subtle)] mb-0.5">По</label>
                      <input type="date" value={createTo} min={createFrom}
                        onChange={(e) => setCreateTo(e.target.value)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                  {createFrom && (
                    <p className="text-[10px] text-[var(--text-subtle)]">
                      {createFrom === createTo || !createTo ? "→ Дневной период" : "→ Недельный период (дни будут группироваться внутри)"}
                    </p>
                  )}
                  {createError && <p className="text-[10px] text-[var(--red)]">{createError}</p>}
                  <div className="flex items-center gap-2">
                    <button onClick={handleCreate} disabled={creating || !createFrom}
                      className="flex-1 rounded bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40">
                      {creating ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Создать"}
                    </button>
                    <button onClick={() => { setShowCreateForm(false); setCreateError(""); }}
                      className="rounded px-2 py-1 text-[11px] text-[var(--text-dim)] hover:bg-white/[0.06]">
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
