"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";

/**
 * Wrap the app once in `app/layout.tsx`.
 *
 * Class strategy: next-themes adds/removes `.dark` on <html>.
 * Default = dark (matches existing UI), but user can toggle to light.
 * Preference persists in localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
