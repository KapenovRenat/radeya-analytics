"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative inline-block">
      <select
        className={cn(
          "h-8 appearance-none rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] pl-3 pr-8 text-[12px] text-[var(--text)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]" />
    </div>
  );
}
