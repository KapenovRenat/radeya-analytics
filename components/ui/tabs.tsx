"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Tab {
  href: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Linear/Vercel-style underline tabs.
 * Each tab is a <Link> for full-page-navigation routing.
 */
export function RouteTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <div className="relative border-b border-[var(--border)]">
      <div className="flex items-center gap-0 overflow-x-auto">
        {tabs.map((t) => {
          const active =
            pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href + "/"));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative inline-flex h-10 items-center gap-1.5 px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                active
                  ? "text-[var(--text)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text)]",
              )}
            >
              {t.icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{t.icon}</span>}
              {t.label}
              {active && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--text)]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
