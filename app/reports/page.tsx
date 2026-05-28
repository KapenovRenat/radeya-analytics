import Link from "next/link";
import { BookOpen, Clock, Tag, ArrowRight } from "lucide-react";
import { listReports } from "@/lib/reports";
import { PageShell } from "@/components/page/page-shell";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export const dynamic = "force-static";

export default async function ReportsPage() {
  const reports = await listReports();

  return (
    <PageShell
      title="Отчёты"
      subtitle={`${reports.length} материалов · разборы и инсайты от Claude`}
      headline="Длинные аналитические разборы — то что не помещается в дашборд. Каждый отчёт написан Claude в VS Code на твоих данных и опубликован в один git push."
    >
      {reports.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-6 w-6 text-[var(--text-dim)]" />
          <div className="text-[14px] font-medium text-[var(--text)]">
            Пока нет отчётов
          </div>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">
            Открой VS Code → попроси Claude сделать отчёт по данным → запушь в репо
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <Link
              key={r.slug}
              href={`/reports/${r.slug}`}
              className="group flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            >
              <div className="flex items-start gap-4">
                {r.icon && (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--accent-soft)] text-[18px]">
                    {r.icon}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] tabular">
                    <time>{format(parseISO(r.date), "d MMMM yyyy", { locale: ru })}</time>
                    <span className="text-[var(--text-subtle)]">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {r.readingTime}
                    </span>
                    {r.author && (
                      <>
                        <span className="text-[var(--text-subtle)]">·</span>
                        <span>{r.author}</span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-[16px] font-semibold leading-tight tracking-tight text-[var(--text)] group-hover:underline">
                    {r.title}
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--text-dim)]">
                    {r.summary}
                  </p>
                  {r.hook && (
                    <p className="mt-2 border-l-2 border-[var(--accent)] pl-3 text-[12.5px] font-medium leading-[1.5] text-[var(--text)]">
                      {r.hook}
                    </p>
                  )}
                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Tag className="h-3 w-3 text-[var(--text-subtle)]" />
                      {r.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-dim)]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}
