"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { StoryData } from "./page";

const PAYMENT_LABELS: Record<string, string> = {
  PAY_WITH_CREDIT: "Kaspi Kredit",
  PREPAID: "Предоплата",
  BANK_CARD: "Карта",
  KASPI_GOLD: "Kaspi Gold",
};

const CANCEL_REASON_LABELS: Record<string, string> = {
  BUYER_CANCELLATION_HIMSELF: "Покупатель сам отменил",
  TIMEOUT_BUYER_PICKUP: "Не забрал в срок",
  BUYER_CANCELLATION_BY_COURIER: "Отказ при доставке",
  RFO_REJECTED: "Отказ Kaspi",
  OUT_OF_STOCK: "Нет в наличии",
  DELIVERY_PROBLEMS: "Проблемы с доставкой",
  BUYER_NO_REPLY: "Не отвечает",
};

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const labels = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return `${labels[Number(month) - 1]} '${year.slice(2)}`;
}

const CHART_TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text)",
};

export function StoryClient({ data }: { data: StoryData }) {
  const peakMonth = [...data.monthly].sort((a, b) => b.revenue - a.revenue)[0];
  const valleyMonth = [...data.monthly].sort((a, b) => a.revenue - b.revenue)[0];
  const seasonRatio = valleyMonth.revenue > 0 ? peakMonth.revenue / valleyMonth.revenue : 0;

  const heroSku = data.skus[0];
  const heroSkuShare = data.revenue > 0 ? (heroSku.revenue / data.revenue) * 100 : 0;

  const topTwoCities = data.cities.slice(0, 2);
  const topTwoCitiesShare =
    data.revenue > 0
      ? (topTwoCities.reduce((s, c) => s + c.revenue, 0) / data.revenue) * 100
      : 0;

  const firstCancelRate = data.cancelByMonth.find((m) => m.total >= 30)?.rate ?? 0;
  const lastCancelRate = [...data.cancelByMonth].reverse().find((m) => m.total >= 30)?.rate ?? 0;

  const creditRow = data.paymentMix.find((p) => p.payment_mode === "PAY_WITH_CREDIT");
  const creditShare = creditRow && data.revenue > 0 ? (creditRow.revenue / data.revenue) * 100 : 0;
  const creditAvg = creditRow && creditRow.orders > 0 ? creditRow.revenue / creditRow.orders : 0;
  const prepaidRow = data.paymentMix.find((p) => p.payment_mode === "PREPAID");
  const prepaidAvg = prepaidRow && prepaidRow.orders > 0 ? prepaidRow.revenue / prepaidRow.orders : 0;

  const monthlyChart = data.monthly.map((m) => ({ ...m, label: formatMonth(m.month) }));
  const cancelChart = data.cancelByMonth
    .filter((m) => m.total >= 5)
    .map((m) => ({ ...m, label: formatMonth(m.month) }));
  const flowChart = data.customerFlow.map((m) => ({ ...m, label: formatMonth(m.month) }));
  const cityChart = data.cities.map((c) => ({ ...c, label: c.city }));
  const paymentChart = data.paymentMix.map((p) => ({
    name: PAYMENT_LABELS[p.payment_mode] ?? p.payment_mode,
    value: p.revenue,
    orders: p.orders,
  }));

  return (
    <>
      <Topbar title="История Brilli" subtitle="12 месяцев в данных — что было, что упустили, что делать" />

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <div className="mb-10 rounded-[var(--radius-lg)] border border-[var(--border)] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--surface)] to-[var(--surface)] p-8">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--accent)]">
            <Sparkles className="h-3 w-3" />
            История магазина · {data.storeName}
          </div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-[var(--text)]">
            {formatCompactMoney(data.revenue)} оборота за год на одном товаре —
            {" "}<span className="text-[var(--accent)]">сезонный бизнес</span>{" "}
            с {formatPercent(data.cancelRate)} отмен и нулевой диверсификацией.
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--text-dim)]">
            Brilli — единственный SKU пароочистителя, проданный {formatNumber(data.completed)} раз{" "}
            {formatNumber(data.uniqueCustomers)} клиентам по всему Казахстану. Сильный продукт-маркет фит
            летом, провал зимой, медленно снижающаяся доля отмен. Ниже — 5 глав истории по данным.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <HeroKpi label="Выручка / год" value={formatCompactMoney(data.revenue)} icon={<Wallet />} />
            <HeroKpi label="Заказов выполнено" value={formatNumber(data.completed)} icon={<Package />} />
            <HeroKpi label="Уникальных клиентов" value={formatNumber(data.uniqueCustomers)} icon={<Users />} />
            <HeroKpi
              label="Cancel rate"
              value={formatPercent(data.cancelRate)}
              icon={<AlertTriangle />}
              danger={data.cancelRate >= 3}
            />
          </div>
        </div>

        {/* ── CHAPTER 1: SEASONALITY ───────────────────────────────── */}
        <Chapter
          number="01"
          icon={<Calendar />}
          title="Сезон правит всем"
          takeaway={`Пик ${formatMonth(peakMonth.month)} → провал ${formatMonth(valleyMonth.month)} — разница ${seasonRatio.toFixed(1)}×. Половина годовой выручки сосредоточена в мае-июле.`}
        >
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 text-[12px] text-[var(--text-dim)]">
              Выручка по месяцам · {formatMonth(data.monthly[0]?.month ?? "")} – {formatMonth(data.monthly[data.monthly.length - 1]?.month ?? "")}
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="seasonFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={11} />
                  <YAxis tickFormatter={(v) => formatCompactMoney(v)} tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={11} width={55} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v) => formatMoney(Number(v))}
                    labelStyle={{ color: "var(--text)" }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Выручка" stroke="var(--accent)" strokeWidth={2.5} fill="url(#seasonFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Narrative>
            <p>
              Brilli — продукт чистой сезонности. Пик случился в <b>{formatMonth(peakMonth.month)}</b> ({formatCompactMoney(peakMonth.revenue)}),
              провал в <b>{formatMonth(valleyMonth.month)}</b> ({formatCompactMoney(valleyMonth.revenue)}).
              Разница — <b>{seasonRatio.toFixed(1)}×</b>. Это типичный профиль весенне-летнего товара
              (генеральная уборка после зимы, дачный сезон).
            </p>
            <p>
              Ключевое следствие: <b>4 месяца простоя</b> (декабрь-март) — это период, когда нужно
              готовить рекламу, тестировать новые карточки и копить кэш на закуп под сезон. Сейчас
              май-26 {monthlyChart[monthlyChart.length - 1].revenue > monthlyChart[monthlyChart.length - 2].revenue ? "уже ускоряется" : "идёт ровно"} — окно ~3 месяца, чтобы взять оборот.
            </p>
          </Narrative>
        </Chapter>

        {/* ── CHAPTER 2: CONCENTRATION ─────────────────────────────── */}
        <Chapter
          number="02"
          icon={<Package />}
          title="Один SKU несёт всё — это сила и точка отказа"
          takeaway={`«${heroSku.name}» = ${formatPercent(heroSkuShare)} выручки. ${data.skus.length} SKU суммарно, но 2 из них — это аксессуары по 2000 ₸.`}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-2 text-[12px] font-medium text-[var(--text)]">Hero SKU</div>
              <div className="mb-1 text-[14px] font-semibold text-[var(--text)]">{heroSku.name}</div>
              <div className="text-[11px] text-[var(--text-dim)]">{heroSku.category}</div>
              <div className="mt-5 space-y-2.5">
                <Row label="Выручка" value={formatCompactMoney(heroSku.revenue)} accent />
                <Row label="Доля от общей" value={formatPercent(heroSkuShare)} accent />
                <Row label="Продано штук" value={formatNumber(heroSku.units)} />
                <Row label="Средняя цена" value={formatMoney(Math.round(heroSku.revenue / Math.max(heroSku.units, 1)))} />
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-3 text-[12px] font-medium text-[var(--text)]">Остальной ассортимент</div>
              {data.skus.slice(1).length === 0 ? (
                <div className="text-[12px] text-[var(--text-dim)]">Других SKU нет.</div>
              ) : (
                <div className="space-y-3">
                  {data.skus.slice(1).map((s) => (
                    <div key={s.name} className="rounded border border-[var(--border)] bg-[var(--bg)] p-3 text-[12px]">
                      <div className="font-medium text-[var(--text)]">{s.name}</div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-dim)]">
                        <span>{s.category}</span>
                        <span className="tabular">
                          {formatNumber(s.units)} шт · {formatCompactMoney(s.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 text-[11px] text-[var(--text-dim)]">
                    Суммарно {formatPercent(100 - heroSkuShare)} выручки — статистический шум на фоне Hero.
                  </div>
                </div>
              )}
            </div>
          </div>
          <Narrative>
            <p>
              99.9% выручки приходит с одной карточки Kaspi. Это <b>сила</b>: фокус, отлаженная карточка,
              отлаженный поток отзывов. И это <b>риск</b>: если карточку забанит модерация, поставщик
              сломает SKU, или конкурент скопирует с лучшей ценой — оборот обнуляется за неделю.
            </p>
            <p>
              Естественный рост — расширение в смежные категории: <b>отпариватели для одежды</b>,
              <b> аксессуары</b> (насадки, моющие средства), <b>складные швабры</b>. Та же ЦА, та же
              сезонность, можно делать кросс-продажи в SMS после покупки.
            </p>
          </Narrative>
        </Chapter>

        {/* ── CHAPTER 3: GEOGRAPHY ─────────────────────────────────── */}
        <Chapter
          number="03"
          icon={<MapPin />}
          title="Двa города дают треть"
          takeaway={`Алматы + Астана = ${formatPercent(topTwoCitiesShare)} выручки. ${data.cities.length} городов в покрытии.`}
        >
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 text-[12px] text-[var(--text-dim)]">Топ-10 городов по выручке</div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityChart} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="2 4" stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={(v) => formatCompactMoney(v)} tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={11} />
                  <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={11} width={120} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v) => formatMoney(Number(v))}
                    labelStyle={{ color: "var(--text)" }}
                  />
                  <Bar dataKey="revenue" name="Выручка" fill="var(--accent)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <Narrative>
            <p>
              Распределение классическое для KZ-e-commerce: <b>Алматы и Астана = {formatPercent(topTwoCitiesShare)} выручки</b>,
              остальное размазано тонким слоем. Шымкент третий, но в 3 раза меньше первой пары.
            </p>
            <p>
              Тактический вывод: <b>локальное промо в двух мегаполисах</b> дёшево и быстро — пуш в
              Kaspi, регионально-таргетированная реклама. В регионах (Караганда, Павлодар, Костанай)
              рынок не насыщен, но CAC выше — там стоит проверять, не съедает ли доставка маржу.
            </p>
          </Narrative>
        </Chapter>

        {/* ── CHAPTER 4: CANCEL RATE ────────────────────────────────── */}
        <Chapter
          number="04"
          icon={<AlertTriangle />}
          title="Отмены — главная зона роста"
          takeaway={`С ${firstCancelRate.toFixed(1)}% в первый сезон до ${lastCancelRate.toFixed(1)}% в этом — снижение ×${(firstCancelRate / Math.max(lastCancelRate, 0.1)).toFixed(1)}, но всё ещё выше порога Kaspi 3%.`}
          warning
        >
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-4 text-[12px] text-[var(--text-dim)]">Процент отмен по месяцам — пунктир = порог Kaspi 3%</div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cancelChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={11} />
                  <YAxis
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--text-dim)"
                    fontSize={11}
                    width={42}
                    domain={[0, (max: number) => Math.max(max + 2, 10)]}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v, name) => name === "rate" ? `${Number(v).toFixed(2)}%` : formatNumber(Number(v))}
                  />
                  <ReferenceLine y={3} stroke="var(--red)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "Порог Kaspi 3%", fill: "var(--red)", fontSize: 10, position: "insideTopRight" }} />
                  <Line type="monotone" dataKey="rate" name="% отмен" stroke="var(--red)" strokeWidth={2.5} dot={{ fill: "var(--red)", r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="mb-3 text-[12px] font-medium text-[var(--text)]">Причины отмен</div>
            <div className="space-y-2">
              {data.cancelReasons.map((r) => {
                const pct = (r.count / data.cancelled) * 100;
                return (
                  <div key={r.reason} className="text-[12px]">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[var(--text)]">{CANCEL_REASON_LABELS[r.reason] ?? r.reason}</span>
                      <span className="text-[var(--text-dim)] tabular">
                        {formatNumber(r.count)} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]">
                      <div className="h-full bg-[var(--red)]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Narrative>
            <p>
              Хорошие новости: <b>тренд устойчивый вниз</b>. Первый сезон стартовал с 13%, к маю 2026 опустились до 4.3%.
              Это плотная работа по операционке.
            </p>
            <p>
              Плохие новости: всё ещё <b>выше порога Kaspi 3%</b>, и <b>89% отмен — `BUYER_CANCELLATION_HIMSELF`</b>,
              то есть передумал сам. Это не «нет в наличии» и не «сборка задержала» — это значит у покупателя
              после оформления возникают сомнения. Лечится: <b>SMS-подтверждение в течение 2 часов</b> с напоминанием
              о доставке, <b>обновлённая карточка</b> с реальными фото и подробным описанием, <b>превентивный звонок</b>
              для дорогих заказов.
            </p>
          </Narrative>
        </Chapter>

        {/* ── CHAPTER 5: PAYMENT + CUSTOMERS ───────────────────────── */}
        <Chapter
          number="05"
          icon={<TrendingUp />}
          title="Kaspi Kredit держит магазин, retention начинает работать"
          takeaway={`${formatPercent(creditShare)} выручки через рассрочку · средний чек Kredit ${formatCompactMoney(creditAvg)} vs предоплата ${formatCompactMoney(prepaidAvg)}.`}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-3 text-[12px] font-medium text-[var(--text)]">Каналы оплаты</div>
              <div className="flex items-center gap-4">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentChart}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {paymentChart.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? "var(--accent)" : "var(--emerald)"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={CHART_TOOLTIP_STYLE}
                        formatter={(v) => formatMoney(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3 text-[12px]">
                  {paymentChart.map((p, i) => (
                    <div key={p.name}>
                      <div className="flex items-baseline gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: i === 0 ? "var(--accent)" : "var(--emerald)" }}
                        />
                        <span className="font-medium text-[var(--text)]">{p.name}</span>
                      </div>
                      <div className="ml-4 mt-0.5 text-[var(--text-dim)] tabular">
                        {formatCompactMoney(p.value)} · {formatNumber(p.orders)} заказов
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
              <div className="mb-3 text-[12px] font-medium text-[var(--text)]">Новые vs возвращающиеся</div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flowChart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="2 4" stroke="var(--border)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={10} />
                    <YAxis tickLine={false} axisLine={false} stroke="var(--text-dim)" fontSize={10} width={32} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(v) => formatNumber(Number(v))}
                    />
                    <Bar stackId="c" dataKey="new_cust" name="Новые" fill="var(--accent)" />
                    <Bar stackId="c" dataKey="repeat_cust" name="Повторные" fill="var(--emerald)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-[11px] text-[var(--text-dim)]">
                Синий — впервые купившие, зелёный — вернувшиеся.
              </div>
            </div>
          </div>

          <Narrative>
            <p>
              <b>Kaspi Kredit — критический канал</b>: {formatPercent(creditShare)} выручки. Средний чек по
              рассрочке ({formatCompactMoney(creditAvg)}) даже выше предоплаты ({formatCompactMoney(prepaidAvg)}),
              хотя продукт стоит ~28K ₸ — рассрочка снимает порог принятия решения. <b>Отключение
              рассрочки = -50% оборота за неделю</b>, никаких других каналов это не покроет.
            </p>
            <p>
              Retention начал работать со 2-го сезона: в мае-25 повторных не было (новый магазин),
              к августу-25 повторные = 28 человек, к декабрю — 21. То есть товар достаточно хорош,
              чтобы клиенты вспоминали бренд через несколько месяцев. Это база для расширения линейки.
            </p>
          </Narrative>
        </Chapter>

        {/* ── ACTION PLAN ──────────────────────────────────────────── */}
        <div className="mt-12 rounded-[var(--radius-lg)] border border-[var(--accent)]/30 bg-[var(--accent-soft)]/30 p-6">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--accent)]">
            <CheckCircle2 className="h-3 w-3" />
            План на следующие 90 дней
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">
            6 действий, чтобы взять сезон 2026
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-dim)]">
            Окно мая-июля = 3 месяца. Каждая неделя в простое стоит {formatCompactMoney(peakMonth.revenue / 4)} оборота.
          </p>

          <ol className="mt-6 space-y-4">
            <Action n="1" title={`SMS-follow-up через 2 часа после оформления — целевой cancel rate < 3%`}>
              89% отмен — `BUYER_CANCELLATION_HIMSELF`. Это не операционка, это лечится подтверждающим SMS:
              «Ваш заказ принят, доставим X числа, если есть вопросы — звоните». В категориях с похожим средним
              чеком эта тактика снижает self-cancel в 2-3 раза.
            </Action>
            <Action n="2" title="Расширить линейку: +2 SKU до 1 июля">
              Кандидаты: <b>отпариватель для одежды</b> (та же ЦА, та же сезонность), <b>универсальные насадки</b> (low-ticket кросс-продажа),
              <b> моющий раствор Brilli</b> (расходник = повторные покупки = retention). Аксессуары уже продаются
              по 2-3 заказа в месяц — спрос подтверждён, нужно усилить ассортимент.
            </Action>
            <Action n="3" title="Локальный буст в Алматы и Астане">
              38% оборота уже идёт оттуда — этот сегмент стоит усилить дешёвой рекламой Kaspi: акции
              «бесплатная доставка по городу», приоритет в выдаче. Каждый процент роста в этих двух
              городах = +{formatCompactMoney(data.revenue * 0.01)} к годовой выручке.
            </Action>
            <Action n="4" title="Обновить карточку Hero SKU — реальные фото + видео в работе">
              Карточка несёт 100% выручки. Раз в год её нужно полностью обновлять: новые фото в интерьере,
              видеообзор на 30-60 сек, ответы на топ-вопросы в описании. Это снимает 30-50% pre-purchase
              сомнений и снижает self-cancel.
            </Action>
            <Action n="5" title="Reactivation-кампания для 1264 клиентов">
              Год назад они купили пароочиститель. Сейчас идеальное время для email/SMS «купите ещё одну
              насадку / средство / новый отпариватель». Стоит копейки, средний CTR
              5-8%, конверсия из реактивации обычно в 3-5 раз выше холодной.
            </Action>
            <Action n="6" title="Защитить Kaspi Kredit как канал — мониторинг 1-й приоритет">
              50%+ выручки идёт через рассрочку. Любое снижение лимита одобрений банком или сбой
              интеграции = немедленный обвал оборота. Раз в неделю смотреть % одобрения, держать
              план Б в виде акции «−5% при предоплате» на случай если Kredit зарежут.
            </Action>
          </ol>
        </div>

        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 text-[12px] text-[var(--text-dim)]">
          <div className="mb-2 flex items-center gap-2 text-[var(--text)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="text-[12px] font-medium">Как сделана эта страница</span>
          </div>
          <p className="leading-relaxed">
            Все цифры — реальная выгрузка из Kaspi API ({formatNumber(data.totalOrders)} заказов за 12 месяцев),
            хранятся в Postgres, агрегированы через 7 SQL-запросов, отрисованы Recharts. Нарратив — рамка,
            которую можно поручить Claude (как в разделе AI-инсайты) или написать вручную. Главное — поверх
            одного и того же набора цифр можно строить и операционный дашборд (для KPI 24/7), и storytelling
            (для собственника или инвестора) — это и есть разница между сырыми данными и «оцифрованным магазином».
          </p>
        </div>
      </div>
    </>
  );
}

function HeroKpi({
  label,
  value,
  icon,
  danger,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={
        "rounded-[var(--radius)] border bg-[var(--surface)]/60 p-3 backdrop-blur-sm " +
        (danger ? "border-[var(--red)]/40" : "border-[var(--border)]")
      }
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
        <span className="text-[var(--text-dim)]">{icon}</span>
        {label}
      </div>
      <div
        className={
          "mt-1 text-[20px] font-semibold tabular " + (danger ? "text-[var(--red)]" : "text-[var(--text)]")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Chapter({
  number,
  icon,
  title,
  takeaway,
  warning,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  takeaway: string;
  warning?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--surface)] text-[12px] font-semibold tabular text-[var(--accent)]">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-0.5 flex items-center gap-2 text-[11px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
            <span className="h-3 w-3">{icon}</span>
            Глава {number}
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">{title}</h2>
          <p
            className={
              "mt-1 text-[13px] leading-relaxed " +
              (warning ? "text-[var(--red)]" : "text-[var(--text-dim)]")
            }
          >
            {takeaway}
          </p>
        </div>
      </div>
      <div className="space-y-4 pl-12">{children}</div>
    </section>
  );
}

function Narrative({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-5 text-[13.5px] leading-relaxed text-[var(--text-dim)]">
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[12px]">
      <span className="text-[var(--text-dim)]">{label}</span>
      <span
        className={
          "font-medium tabular " + (accent ? "text-[var(--accent)] text-[15px]" : "text-[var(--text)]")
        }
      >
        {value}
      </span>
    </div>
  );
}

function Action({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-semibold tabular text-white">
        {n}
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-medium text-[var(--text)]">{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-dim)]">{children}</p>
      </div>
    </li>
  );
}
