"use client"

/* Gráfico de crescimento (recharts) da página da competição do clipador.
   Carregado sob demanda (next/dynamic, sem SSR) para não pesar o bundle inicial. */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

/* ============================================================
   Tooltip glass do gráfico de crescimento
   ============================================================ */

function GrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border-border bg-popover/95 min-w-44 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div
            key={index}
            className="flex items-center justify-between gap-6 text-xs"
          >
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString("pt-BR")
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GrowthChart({
  data: growthData,
}: {
  data: Array<{ date: string; views: number; engagement: number }>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={growthData}
        margin={{ left: 12, right: 12, top: 8, bottom: 0 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
        />
        <Tooltip
          content={<GrowthTooltip />}
          cursor={{
            stroke:
              "color-mix(in oklab, var(--foreground) 22%, transparent)",
            strokeDasharray: "4 4",
          }}
        />
        <Line
          dataKey="views"
          name="Views"
          type="monotone"
          stroke="var(--brand-cyan)"
          strokeWidth={2.5}
          strokeLinecap="round"
          dot={false}
          activeDot={{
            r: 5,
            strokeWidth: 2,
            fill: "var(--brand-mint)",
            stroke: "var(--card)",
          }}
        />
        <Line
          dataKey="engagement"
          name="Engajamento"
          type="monotone"
          stroke="#ec4899"
          strokeWidth={2}
          strokeLinecap="round"
          dot={false}
          activeDot={{
            r: 4,
            strokeWidth: 2,
            fill: "#ec4899",
            stroke: "var(--card)",
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
