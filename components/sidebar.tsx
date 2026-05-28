"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Store as StoreIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export type NavItem = {
  href: string;
  label: string;
  iconName: string; // resolved by client via getIcon()
  badge?: string;
};

export type NavGroup = {
  id: string;
  title: string;
  defaultOpen: boolean;
  items: NavItem[];
};

/**
 * Sidebar — left-rail navigation. Pure client component; receives a fully
 * resolved nav prop from a server wrapper (components/sidebar-server.tsx)
 * so paths can be prefixed per active store.
 *
 * `connectCta` is rendered in the footer when there is no active store
 * (returned as null from getActiveStore) so the user is nudged to add one.
 */

import * as Icons from "lucide-react";
function getIcon(name: string): LucideIcon {
  const Comp = (Icons as unknown as Record<string, LucideIcon>)[name];
  return Comp ?? Icons.Circle;
}

const LS_KEY = "niche-sidebar-collapsed-v1";

export function Sidebar({
  nav,
  connectCta,
}: {
  nav: NavGroup[];
  connectCta?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // Restore collapsed state from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist on change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated]);

  const toggle = (id: string) =>
    setCollapsed((s) => ({ ...s, [id]: !s[id] }));

  return (
    <aside className="hidden h-dvh w-[232px] shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] md:flex">
      {/* Brand */}
      <Link
        href="/"
        className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--sidebar-border)] px-4 transition-colors hover:bg-[var(--sidebar-accent)]/40"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#6c5ce7] to-[#f14635] text-[10px] font-bold text-white">
          N
        </div>
        <div className="text-[13px] font-semibold tracking-tight text-[var(--text)]">
          niche analytics
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pb-0">
        {nav.map((group) => {
          const open = hydrated
            ? collapsed[group.id] !== undefined
              ? !collapsed[group.id]
              : group.defaultOpen
            : group.defaultOpen;
          return (
            <div key={group.id} className="flex flex-col">
              {/* Group header */}
              <button
                onClick={() => toggle(group.id)}
                className="mt-1.5 flex items-center justify-between px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--text-subtle)] hover:text-[var(--text-dim)] transition-colors"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-150",
                    !open && "-rotate-90"
                  )}
                />
              </button>

              {/* Items */}
              {open && (
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ href, label, iconName, badge }) => {
                    const Icon = getIcon(iconName);
                    const active =
                      href === "/"
                        ? pathname === "/"
                        : pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                          active
                            ? "bg-[var(--sidebar-accent)] font-medium text-[var(--sidebar-accent-foreground)]"
                            : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/60 hover:text-[var(--sidebar-accent-foreground)]"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{label}</span>
                        {badge && (
                          <span className="mock-badge !px-1.5 !py-0 !text-[8px]">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--sidebar-border)] p-2">
        {connectCta && (
          <Link
            href="/stores"
            className="mb-2 flex items-center gap-2 rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
          >
            <StoreIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate font-medium">Подключите магазин</span>
          </Link>
        )}
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-subtle)]">
            Тема
          </span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
