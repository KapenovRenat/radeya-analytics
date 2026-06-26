import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "default" | "emerald" | "red" | "orange" | "amber" | "blue" | "violet" | "kaspi" | "brown";

const TONE: Record<Tone, string> = {
  default: "bg-white/[0.06] text-[var(--text-dim)]",
  emerald: "bg-[var(--emerald-soft)] text-[var(--emerald)]",
  red: "bg-[var(--red-soft)] text-[var(--red)]",
  orange: "bg-[var(--orange-soft)] text-[var(--orange)]",
  amber: "bg-[var(--amber-soft)] text-[var(--amber)]",
  blue: "bg-[var(--blue-soft)] text-[var(--blue)]",
  violet: "bg-[var(--violet-soft)] text-[var(--violet)]",
  kaspi: "bg-[var(--kaspi)]/12 text-[var(--kaspi)]",
  brown: "bg-[#4a3424]/40 text-[#c79a6b]",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center gap-1 rounded-full px-2 text-[10px] font-medium tabular leading-none",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
