"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddStoreForm() {
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/kaspi/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, apiToken: token }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setName("");
      setToken("");
      router.refresh();
      // No auto-redirect — user stays on home page and decides when to open the store.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
          Название магазина
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название магазина"
          required
          className="h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-3 text-[13px] text-[var(--text)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
          <KeyRound className="h-3 w-3" /> X-Auth-Token из Kaspi
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="••••••••••••••••••••••••"
          required
          className="mono h-9 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-elev)] px-3 text-[12px] text-[var(--text)] hover:border-[var(--border-strong)] focus:border-[var(--border-focus)] focus:outline-none"
        />
        <p className="mt-1.5 text-[11px] text-[var(--text-subtle)]">
          Kaspi Merchant Cabinet → Настройки → API. Токен шифруется Fernet-ключом перед записью в БД.
        </p>
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--red)]/30 bg-[var(--red-soft)] px-3 py-2 text-[12px] text-[var(--red)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" variant="primary" disabled={submitting}>
        {submitting ? "Проверяем токен…" : "Подключить магазин"}
      </Button>
    </form>
  );
}
