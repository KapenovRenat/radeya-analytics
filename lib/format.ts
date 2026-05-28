export function formatMoney(value: number | null | undefined, currency = "₸"): string {
  if (value == null || isNaN(value)) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}

export function formatCompactMoney(value: number | null | undefined, currency = "₸"): string {
  if (value == null || isNaN(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} B ${currency}`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} М ${currency}`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} К ${currency}`;
  return `${value.toFixed(0)} ${currency}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || isNaN(value)) return "—";
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}
