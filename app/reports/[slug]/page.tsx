import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArrowLeft, Clock, Tag } from "lucide-react";
import { getReport, listReports } from "@/lib/reports";
import { mdxComponents } from "@/components/reports/mdx-components";
import { ReportChart } from "@/components/reports/report-chart";
import { Topbar } from "@/components/topbar";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const reports = await listReports();
  return reports.map((r) => ({ slug: r.slug }));
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = await getReport(slug);
  if (!report) notFound();

  // Allow MDX to use <ReportChart /> in addition to typography overrides.
  const components = {
    ...mdxComponents,
    ReportChart,
  };

  return (
    <>
      <Topbar title="Отчёты" subtitle={report.title} />
      <article className="mx-auto w-full max-w-3xl px-6 py-8">
        <Link
          href="/reports"
          className="mb-6 inline-flex items-center gap-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Все отчёты
        </Link>

        <header className="mb-8 border-b border-[var(--border)] pb-6">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)] tabular">
            <time>{format(parseISO(report.date), "d MMMM yyyy", { locale: ru })}</time>
            <span className="text-[var(--text-subtle)]">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {report.readingTime}
            </span>
            {report.author && (
              <>
                <span className="text-[var(--text-subtle)]">·</span>
                <span>{report.author}</span>
              </>
            )}
          </div>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.15] tracking-tight text-[var(--text)]">
            {report.title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-dim)]">
            {report.summary}
          </p>
          {report.tags && report.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Tag className="h-3 w-3 text-[var(--text-subtle)]" />
              {report.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-[var(--text-dim)]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="report-body">
          <MDXRemote source={report.content} components={components} />
        </div>

        <footer className="mt-12 border-t border-[var(--border)] pt-6">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Вернуться ко всем отчётам
          </Link>
        </footer>
      </article>
    </>
  );
}
