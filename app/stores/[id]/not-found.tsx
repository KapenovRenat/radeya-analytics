import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-dim)]">404</div>
      <h1 className="text-[22px] font-semibold">Магазин не найден</h1>
      <p className="mt-2 text-[13px] text-[var(--text-dim)]">Возможно, он был удалён или вы перешли по устаревшей ссылке.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-8 items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[12px] hover:border-[var(--border-strong)]"
      >
        ← К списку магазинов
      </Link>
    </div>
  );
}
