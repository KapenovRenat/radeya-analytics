import { type ReactNode } from "react";
import { Quote, Info, AlertTriangle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Editorial-grade MDX components for /reports.
 * Drop into <MDXRemote components={mdxComponents} />.
 */

/* ─── Base typography overrides ──────────────────────────────────────── */

function H1({ children }: { children?: ReactNode }) {
  return (
    <h1 className="mt-10 mb-3 text-[28px] font-semibold tracking-tight text-[var(--text)] leading-[1.15]">
      {children}
    </h1>
  );
}
function H2({ children }: { children?: ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-[20px] font-semibold tracking-tight text-[var(--text)]">
      {children}
    </h2>
  );
}
function H3({ children }: { children?: ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-[15px] font-semibold tracking-tight text-[var(--text)]">
      {children}
    </h3>
  );
}
function P({ children }: { children?: ReactNode }) {
  return (
    <p className="my-3 text-[14.5px] leading-[1.7] text-[var(--text)]">
      {children}
    </p>
  );
}
function UL({ children }: { children?: ReactNode }) {
  return (
    <ul className="my-3 ml-5 flex list-disc flex-col gap-1.5 text-[14.5px] leading-[1.65] text-[var(--text)] marker:text-[var(--text-subtle)]">
      {children}
    </ul>
  );
}
function OL({ children }: { children?: ReactNode }) {
  return (
    <ol className="my-3 ml-5 flex list-decimal flex-col gap-1.5 text-[14.5px] leading-[1.65] text-[var(--text)] marker:text-[var(--text-subtle)]">
      {children}
    </ol>
  );
}
function Strong({ children }: { children?: ReactNode }) {
  return <strong className="font-semibold text-[var(--text)]">{children}</strong>;
}
function Em({ children }: { children?: ReactNode }) {
  return <em className="italic text-[var(--text)]">{children}</em>;
}
function HR() {
  return <hr className="my-8 border-[var(--border)]" />;
}
function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className="mono rounded bg-[var(--surface)] px-1.5 py-0.5 text-[12.5px] text-[var(--text-dim)]">
      {children}
    </code>
  );
}
function CodeBlock({ children }: { children?: ReactNode }) {
  return (
    <pre className="mono my-4 overflow-x-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
      {children}
    </pre>
  );
}
function A({ href, children }: { href?: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      className="text-[var(--accent)] underline decoration-[var(--accent)]/30 underline-offset-2 hover:decoration-[var(--accent)]"
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

/* ─── Custom editorial components ────────────────────────────────────── */

export function PullQuote({ author, children }: { author?: string; children?: ReactNode }) {
  return (
    <figure className="my-8 border-l-2 border-[var(--accent)] pl-6">
      <Quote className="h-5 w-5 text-[var(--accent)]" />
      <blockquote className="mt-2 text-[20px] font-medium leading-[1.4] tracking-tight text-[var(--text)]">
        {children}
      </blockquote>
      {author && (
        <figcaption className="mt-3 text-[12px] uppercase tracking-[0.10em] text-[var(--text-subtle)]">
          — {author}
        </figcaption>
      )}
    </figure>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const toneColor: Record<typeof tone, string> = {
    default: "text-[var(--text)]",
    success: "text-[var(--emerald)]",
    warning: "text-[var(--amber)]",
    danger: "text-[var(--red)]",
    info: "text-[var(--blue)]",
  } as const;
  return (
    <span className="my-1 inline-flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-subtle)]">
        {label}
      </span>
      <span className={cn("text-[24px] font-semibold tabular leading-none", toneColor[tone])}>
        {value}
      </span>
      {hint && (
        <span className="text-[11px] text-[var(--text-dim)]">{hint}</span>
      )}
    </span>
  );
}

export function StatGrid({ children }: { children?: ReactNode }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3 md:grid-cols-4">
      {children}
    </div>
  );
}

type CalloutKind = "info" | "warning" | "danger" | "success";
const calloutMeta: Record<CalloutKind, { icon: LucideIcon; color: string; bg: string; border: string }> = {
  info: { icon: Info, color: "text-[var(--blue)]", bg: "bg-[var(--blue-soft)]", border: "border-[var(--blue)]/30" },
  warning: { icon: AlertTriangle, color: "text-[var(--amber)]", bg: "bg-[var(--amber-soft)]", border: "border-[var(--amber)]/30" },
  danger: { icon: AlertTriangle, color: "text-[var(--red)]", bg: "bg-[var(--red-soft)]", border: "border-[var(--red)]/30" },
  success: { icon: CheckCircle2, color: "text-[var(--emerald)]", bg: "bg-[var(--emerald-soft)]", border: "border-[var(--emerald)]/30" },
};

export function Callout({
  kind = "info",
  title,
  children,
}: {
  kind?: CalloutKind;
  title?: string;
  children?: ReactNode;
}) {
  const m = calloutMeta[kind];
  const Icon = m.icon;
  return (
    <div className={cn("my-5 rounded-[var(--radius-lg)] border p-4", m.border, m.bg)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 shrink-0", m.color)} />
        <div className="min-w-0 flex-1">
          {title && (
            <div className={cn("mb-1 text-[12px] font-semibold uppercase tracking-[0.10em]", m.color)}>
              {title}
            </div>
          )}
          <div className="text-[13.5px] leading-[1.65] text-[var(--text)] [&>p]:my-1.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Export map for MDXRemote ───────────────────────────────────────── */

export const mdxComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  p: P,
  ul: UL,
  ol: OL,
  strong: Strong,
  em: Em,
  hr: HR,
  code: InlineCode,
  pre: CodeBlock,
  a: A,
  PullQuote,
  Stat,
  StatGrid,
  Callout,
};
