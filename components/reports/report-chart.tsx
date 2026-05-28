"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

type Point = Record<string, string | number | null>;

/**
 * Inline chart for use inside MDX reports.
 *
 * Usage in .mdx:
 *   <ReportChart
 *     kind="area"
 *     title="Выручка по месяцам"
 *     data={[{ label: "Янв", value: 920 }, ...]}
 *     yLabel="₸ млн"
 *     annotations={[{ x: "Апр", label: "Спад -22%" }]}
 *   />
 */
export function ReportChart({
  kind = "line",
  title,
  data,
  xKey = "label",
  yKey = "value",
  yLabel,
  height = 260,
  annotations,
  format,
}: {
  kind?: "line" | "area" | "bar";
  title?: string;
  data: Point[];
  xKey?: string;
  yKey?: string;
  yLabel?: string;
  height?: number;
  annotations?: { x: string | number; label: string }[];
  format?: "number" | "currency" | "percent";
}) {
  const formatValue = (v: number | string | null) => {
    if (v == null) return "—";
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isNaN(n)) return String(v);
    if (format === "currency") return `${n.toLocaleString("ru-RU")} ₸`;
    if (format === "percent") return `${n.toFixed(1)}%`;
    return n.toLocaleString("ru-RU");
  };

  const renderChart = () => {
    if (kind === "bar") {
      return (
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => String(v)} />
          <Tooltip
            cursor={{ fill: "var(--surface-hover)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => formatValue(v as number)}
          />
          <Bar dataKey={yKey} fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }
    if (kind === "area") {
      return (
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="reportAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => formatValue(v as number)}
          />
          {annotations?.map((a, i) => (
            <ReferenceLine
              key={i}
              x={a.x}
              stroke="var(--red)"
              strokeDasharray="3 3"
              label={{
                value: a.label,
                position: "top",
                fill: "var(--red)",
                fontSize: 10,
              }}
            />
          ))}
          <Area
            type="monotone"
            dataKey={yKey}
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#reportAreaFill)"
          />
        </AreaChart>
      );
    }
    return (
      <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => formatValue(v as number)}
        />
        {annotations?.map((a, i) => (
          <ReferenceLine
            key={i}
            x={a.x}
            stroke="var(--red)"
            strokeDasharray="3 3"
            label={{
              value: a.label,
              position: "top",
              fill: "var(--red)",
              fontSize: 10,
            }}
          />
        ))}
        <Line
          type="monotone"
          dataKey={yKey}
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    );
  };

  return (
    <figure className="my-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
      {title && (
        <figcaption className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium tracking-tight text-[var(--text)]">
            {title}
          </span>
          {yLabel && (
            <span className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-subtle)]">
              {yLabel}
            </span>
          )}
        </figcaption>
      )}
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
