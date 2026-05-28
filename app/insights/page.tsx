import Link from "next/link";
import { Sparkles, Zap } from "lucide-react";
import { PageShell } from "@/components/page/page-shell";
import { AiInsightBlock, type Insight } from "@/components/page/ai-insight-block";
import { RecommendationBlock } from "@/components/page/recommendation-block";
import { getActiveStore } from "@/lib/active-store";
import { buildStoreContext, generateInsights } from "@/lib/insights/llm";
import { formatCompactMoney, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAYS = 30;

async function getInsights(storeId: string) {
  const to = new Date();
  const from = new Date(to.getTime() - DAYS * 86_400_000);
  const context = await buildStoreContext(storeId, from, to);
  const result = await generateInsights(context);
  return { context, result };
}

export default async function InsightsPage() {
  const store = await getActiveStore();

  if (!store) {
    return (
      <PageShell
        title="AI-инсайты"
        subtitle="нет подключённого магазина"
        headline="Подключите магазин, чтобы получать сводки от Claude по своим реальным данным."
      >
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-[13px] text-[var(--text-dim)]">
          Откройте раздел <Link href="/stores" className="font-medium text-[var(--accent)] hover:underline">Магазины</Link> и добавьте Kaspi-токен.
        </div>
      </PageShell>
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return (
      <PageShell
        title="AI-инсайты"
        subtitle={store.name}
        headline="Чтобы получать живые инсайты от Claude — добавьте ANTHROPIC_API_KEY в окружение."
      >
        <div className="rounded-[var(--radius-lg)] border border-[var(--amber)]/30 bg-[var(--amber-soft)]/40 p-5 text-[13px] text-[var(--text)]">
          <div className="font-medium">Не настроен ANTHROPIC_API_KEY</div>
          <p className="mt-1 text-[var(--text-dim)]">
            Получите ключ на <a className="font-medium text-[var(--accent)] hover:underline" href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a>,
            добавьте в Vercel env как <span className="mono">ANTHROPIC_API_KEY</span> и переразверните.
          </p>
        </div>
      </PageShell>
    );
  }

  let payload: Awaited<ReturnType<typeof getInsights>> | null = null;
  let error: string | null = null;
  try {
    payload = await getInsights(store.id);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !payload) {
    return (
      <PageShell title="AI-инсайты" subtitle={store.name}>
        <div className="rounded-[var(--radius-lg)] border border-[var(--red)]/30 bg-[var(--red-soft)] p-5 text-[13px] text-[var(--red)]">
          Ошибка: {error ?? "неизвестная ошибка"}
        </div>
      </PageShell>
    );
  }

  const { context, result } = payload;
  const insights: Insight[] = result.insights.map((i) => ({
    kind: i.kind,
    title: i.title,
    body: i.body,
  }));

  return (
    <PageShell
      title="AI-инсайты"
      subtitle={`${store.name} · последние ${DAYS} дней · ${result.meta.model}`}
      headline={result.headline}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetaCard label="Заказов" value={formatNumber(context.kpis.total_orders)} />
        <MetaCard
          label="Выручка"
          value={formatCompactMoney(context.kpis.revenue_completed_kzt)}
          hint={`${context.comparison_vs_previous.revenue_change_pct >= 0 ? "+" : ""}${context.comparison_vs_previous.revenue_change_pct.toFixed(1)}% к прошлому`}
        />
        <MetaCard
          label="% отмен"
          value={`${context.kpis.cancel_rate_pct.toFixed(1)}%`}
          danger={context.kpis.cancel_rate_pct >= 3}
        />
        <MetaCard label="Клиентов" value={formatNumber(context.kpis.unique_customers)} />
      </div>

      <AiInsightBlock insights={insights} isMock={false} />

      <RecommendationBlock
        items={result.recommendations.map((r) => ({ title: r.title, body: r.body }))}
      />

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-[12px] text-[var(--text-dim)]">
        <div className="mb-2 flex items-center gap-2 text-[var(--text)]">
          <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span className="text-[12px] font-medium">Как это работает</span>
        </div>
        <p className="leading-relaxed">
          Бэкенд собирает компактную сводку (~3 КБ JSON: KPI, top-SKU, города, payment mix, тренд по месяцам)
          и шлёт её в Claude Opus 4.7 с adaptive thinking. Системный промпт закэширован — повторные вызовы в течение 5 минут
          платят ~10% от его стоимости. На этом запросе:
          {" "}кэш-чтение {formatNumber(result.meta.cache_read_tokens)} токенов · кэш-запись {formatNumber(result.meta.cache_write_tokens)} ·
          ввод {formatNumber(result.meta.input_tokens)} · вывод {formatNumber(result.meta.output_tokens)}.
        </p>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text)]">
            Хочешь глубже — спроси Claude в VS Code
          </h3>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-dim)]">
          Эта страница — короткая сводка. Для разбора по конкретной гипотезе («почему упал октябрь?», «как
          поднять чек на 20%?») открой проект в VS Code: Claude видит ту же БД, может строить SQL и графики на лету.
        </p>
      </div>
    </PageShell>
  );
}

function MetaCard({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div
      className={
        "rounded-[var(--radius-lg)] border bg-[var(--surface)] p-4 " +
        (danger ? "border-[var(--red)]/30" : "border-[var(--border)]")
      }
    >
      <div className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-subtle)]">{label}</div>
      <div
        className={
          "mt-1 text-[20px] font-semibold tabular leading-tight " +
          (danger ? "text-[var(--red)]" : "text-[var(--text)]")
        }
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-[var(--text-dim)]">{hint}</div>}
    </div>
  );
}
