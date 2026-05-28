"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg)]/85 px-6 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/60">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="shrink-0 text-[15px] font-semibold leading-none tracking-tight text-[var(--text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="min-w-0 truncate text-[11.5px] leading-none text-[var(--text-dim)]">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
