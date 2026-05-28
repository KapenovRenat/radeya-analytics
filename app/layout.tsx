import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarServer } from "@/components/sidebar-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niche Analytics",
  description: "Marketplace niche analytics platform — Kaspi, Wildberries",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {/*
            Sidebar | Content
            Sidebar: 232px fixed, hidden on mobile (<md).
            Content: flex-1, scrolls vertically. Topbar sticks inside.
          */}
          <div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--text)]">
            <SidebarServer />
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
