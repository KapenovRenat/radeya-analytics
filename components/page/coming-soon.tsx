import { Sparkles, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/page/page-shell";

/**
 * Stub-страница для пунктов sidebar, которые ещё не реализованы.
 * Показывает заголовок + список планируемых блоков + CTA в VS Code.
 */
export function ComingSoonPage({
  title,
  subtitle,
  description,
  blocks,
  relatedReportSlug,
  relatedReportTitle,
}: {
  title: string;
  subtitle?: string;
  description: string;
  blocks: string[];
  relatedReportSlug?: string;
  relatedReportTitle?: string;
}) {
  return (
    <PageShell title={title} subtitle={subtitle ?? "Скоро · мок-режим"}>
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">
              Эта страница — следующий шаг
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-dim)]">
              {description}
            </p>

            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.10em] text-[var(--text-subtle)]">
                Что здесь будет
              </div>
              <ul className="flex flex-col gap-1.5">
                {blocks.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--text)]"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[var(--text-subtle)]">
                Сделать сейчас своими руками
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
                Открой VS Code, попроси Claude:{" "}
                <span className="mono rounded bg-[var(--surface)] px-1.5 py-0.5 text-[12px] text-[var(--text)]">
                  «построй страницу {title.toLowerCase()} по шаблону»
                </span>{" "}
                — он напишет её за 3-5 минут на твоих данных.
              </p>
            </div>

            {relatedReportSlug && relatedReportTitle && (
              <a
                href={`/reports/${relatedReportSlug}`}
                className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--accent)] hover:underline"
              >
                Связанный отчёт · {relatedReportTitle}
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
