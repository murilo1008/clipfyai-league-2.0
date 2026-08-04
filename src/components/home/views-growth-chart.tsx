"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  PLATFORM_ORDER,
  formatChartDate,
  platformMeta,
} from "@/components/home/platform-chart-meta"
import { formatCompact } from "@/components/shared/count-up"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type GrowthPoint = { date: string; total: number } & Record<string, number | string>

interface ViewsGrowthChartProps {
  data: GrowthPoint[]
  platforms: string[]
  isLoading?: boolean
}

/** "TOTAL" ou o nome de uma plataforma vinda de `platforms`. */
type Focus = string

/**
 * Crescimento acumulado de views (90 dias) — focus + context.
 * Por padrão, uma única área com o degradê da marca mostra o total;
 * as pills embaixo focam uma plataforma por vez, na cor dela.
 */
export function ViewsGrowthChart({
  data,
  platforms,
  isLoading = false,
}: ViewsGrowthChartProps) {
  const [focus, setFocus] = React.useState<Focus>("TOTAL")

  const ordered = PLATFORM_ORDER.filter((platform) =>
    platforms.includes(platform),
  )
  const activeFocus: Focus =
    focus !== "TOTAL" && !ordered.includes(focus as never) ? "TOTAL" : focus

  if (isLoading) {
    return <Skeleton className="h-[280px] w-full rounded-2xl sm:h-[320px]" />
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        Sem dados de crescimento por enquanto
      </p>
    )
  }

  const lastPoint = data[data.length - 1]
  const dataKey = activeFocus === "TOTAL" ? "total" : activeFocus
  const lastValue = Number(lastPoint?.[dataKey] ?? 0)
  const focusColor =
    activeFocus === "TOTAL"
      ? "var(--chart-growth-end)"
      : platformMeta(activeFocus).color

  return (
    <div className="flex flex-col gap-4">
      <div className="h-[240px] w-full sm:h-[300px] lg:h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              {/* Traço com degradê da marca (só no total) */}
              <linearGradient id="growth-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--chart-growth-start)" />
                <stop offset="100%" stopColor="var(--chart-growth-end)" />
              </linearGradient>
              {/* Preenchimento vertical que desvanece até o transparente */}
              <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={
                    activeFocus === "TOTAL"
                      ? "var(--chart-growth-end)"
                      : focusColor
                  }
                  stopOpacity={0.28}
                />
                <stop offset="55%" stopColor={focusColor} stopOpacity={0.08} />
                <stop offset="100%" stopColor={focusColor} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
              tickMargin={10}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value)}
              axisLine={false}
              tickLine={false}
              width={46}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              content={
                <GrowthTooltip ordered={ordered} focus={activeFocus} />
              }
              cursor={{
                stroke: "color-mix(in oklab, var(--foreground) 22%, transparent)",
                strokeDasharray: "4 4",
              }}
            />

            <Area
              key={dataKey}
              type="monotone"
              dataKey={dataKey}
              stroke={
                activeFocus === "TOTAL" ? "url(#growth-stroke)" : focusColor
              }
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="url(#growth-fill)"
              animationDuration={650}
              activeDot={{
                r: 4.5,
                fill: focusColor,
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />

            {/* Ponto final destacado — ancora o valor do header na curva */}
            {lastPoint && (
              <ReferenceDot
                x={lastPoint.date}
                y={lastValue}
                shape={<EndDot color={focusColor} />}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Pills de foco — identidade por ícone + label, valor acumulado à direita */}
      <div className="flex flex-wrap items-center gap-2">
        <FocusPill
          active={activeFocus === "TOTAL"}
          onClick={() => setFocus("TOTAL")}
          dot={<span className="bg-gradient-custom size-2 rounded-full" />}
          label="Todas"
          value={formatCompact(Number(lastPoint?.total ?? 0))}
        />
        {ordered.map((platform) => {
          const { label, Icon, color } = platformMeta(platform)
          return (
            <FocusPill
              key={platform}
              active={activeFocus === platform}
              onClick={() =>
                setFocus((current) =>
                  current === platform ? "TOTAL" : platform,
                )
              }
              dot={
                <span
                  className="size-2 rounded-full"
                  style={{ background: color }}
                />
              }
              icon={Icon && <Icon className="size-3.5" />}
              label={label}
              value={formatCompact(Number(lastPoint?.[platform] ?? 0))}
            />
          )
        })}
      </div>
    </div>
  )
}

function FocusPill({
  active,
  onClick,
  dot,
  icon,
  label,
  value,
}: {
  active: boolean
  onClick: () => void
  dot: React.ReactNode
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all sm:text-xs",
        active
          ? "border-[color-mix(in_oklab,var(--chart-growth-end)_45%,transparent)] bg-[color-mix(in_oklab,var(--chart-growth-end)_8%,transparent)] text-foreground"
          : "border-border/60 bg-muted/30 text-foreground/70 hover:border-border hover:text-foreground",
      )}
    >
      {dot}
      {icon}
      {label}
      <span
        className={cn(
          "tabular-nums",
          active ? "text-foreground/80 font-semibold" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </button>
  )
}

/** Ponto final da curva: halo suave + dot com anel na cor do card. */
function EndDot({
  cx,
  cy,
  color,
}: {
  cx?: number
  cy?: number
  color: string
}) {
  if (cx === undefined || cy === undefined) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} opacity={0.15} />
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill={color}
        stroke="var(--card)"
        strokeWidth={2}
      />
    </g>
  )
}

function GrowthTooltip({
  active,
  payload,
  label,
  ordered,
  focus,
}: {
  active?: boolean
  payload?: Array<{ payload?: GrowthPoint }>
  label?: string
  ordered: string[]
  focus: Focus
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  const total = Number(point.total ?? 0)

  return (
    <div className="border-border bg-popover/95 min-w-44 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label ? formatChartDate(label) : ""}
      </p>

      {focus === "TOTAL" ? (
        <div className="flex flex-col gap-1">
          <div className="mb-1 flex items-center justify-between gap-6 text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className="text-sm font-bold tabular-nums">
              {total.toLocaleString("pt-BR")}
            </span>
          </div>
          {[...ordered]
            .map((platform) => ({
              platform,
              value: Number(point[platform] ?? 0),
            }))
            .filter(({ value }) => value > 0)
            .sort((a, b) => b.value - a.value)
            .map(({ platform, value }) => {
              const { label: platformLabel, color } = platformMeta(platform)
              return (
                <div
                  key={platform}
                  className="flex items-center justify-between gap-6 text-xs"
                >
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: color }}
                    />
                    {platformLabel}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCompact(value)}
                  </span>
                </div>
              )
            })}
        </div>
      ) : (
        <FocusedTooltipBody point={point} focus={focus} total={total} />
      )}
    </div>
  )
}

function FocusedTooltipBody({
  point,
  focus,
  total,
}: {
  point: GrowthPoint
  focus: string
  total: number
}) {
  const { label: platformLabel, color } = platformMeta(focus)
  const value = Number(point[focus] ?? 0)
  const share = total > 0 ? (value / total) * 100 : 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {platformLabel}
        </span>
        <span className="text-sm font-bold tabular-nums">
          {value.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="border-border/60 mt-1 flex items-center justify-between gap-6 border-t pt-1.5 text-[11px]">
        <span className="text-muted-foreground">Participação no total</span>
        <span className="font-semibold tabular-nums">
          {share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
        </span>
      </div>
    </div>
  )
}
