"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatChartDate } from "@/components/home/platform-chart-meta"
import { formatCompact } from "@/components/shared/count-up"
import { Skeleton } from "@/components/ui/skeleton"

interface AcquisitionPoint {
  date: string
  total: number
  organic: number
  referred: number
  cumulative: number
}

interface AcquisitionChartProps {
  data: AcquisitionPoint[]
  isLoading?: boolean
}

/** Série única (verde da marca): crescimento acumulado de clipadores. */
export function AcquisitionChart({
  data,
  isLoading = false,
}: AcquisitionChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[240px] w-full rounded-2xl" />
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
        Sem dados de captação por enquanto
      </p>
    )
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fill-acquisition" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-growth)"
                stopOpacity={0.32}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-growth)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="color-mix(in oklab, var(--foreground) 8%, transparent)"
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompact(value)}
            axisLine={false}
            tickLine={false}
            width={40}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            content={<AcquisitionTooltip />}
            cursor={{
              stroke: "color-mix(in oklab, var(--foreground) 25%, transparent)",
              strokeDasharray: "4 4",
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="var(--chart-growth)"
            strokeWidth={2}
            fill="url(#fill-acquisition)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function AcquisitionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: AcquisitionPoint }>
  label?: string
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="border-border bg-popover/95 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-wide uppercase">
        {label ? formatChartDate(label) : ""}
      </p>
      <p className="font-bold tabular-nums">
        {datum.cumulative.toLocaleString("pt-BR")} clipadores
      </p>
      {datum.total > 0 && (
        <p className="text-muted-foreground mt-0.5">
          +{datum.total} no dia · {datum.organic} orgânicos · {datum.referred}{" "}
          indicados
        </p>
      )}
    </div>
  )
}
