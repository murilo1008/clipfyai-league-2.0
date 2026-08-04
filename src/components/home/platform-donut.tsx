"use client"

import * as React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { platformMeta } from "@/components/home/platform-chart-meta"
import { formatCompact } from "@/components/shared/count-up"
import { Skeleton } from "@/components/ui/skeleton"

interface PlatformDatum {
  platform: string
  views: number
  posts: number
  /** Opcional: nem toda visão tem contagem por plataforma. */
  clippers?: number
  engagementRate: number
}

interface PlatformDonutProps {
  data: PlatformDatum[]
  isLoading?: boolean
}

/** Donut de distribuição de views por plataforma, com legenda direta. */
export function PlatformDonut({ data, isLoading = false }: PlatformDonutProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <Skeleton className="size-44 rounded-full" />
        <div className="flex w-full flex-1 flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-5 w-full rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  const withViews = data.filter((entry) => entry.views > 0)
  const total = withViews.reduce((sum, entry) => sum + entry.views, 0)

  if (total === 0) {
    return (
      <p className="text-muted-foreground flex h-44 items-center justify-center text-sm">
        Sem views registradas por enquanto
      </p>
    )
  }

  const sorted = [...withViews].sort((a, b) => b.views - a.views)

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-44 shrink-0 sm:size-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<DonutTooltip total={total} />} />
            <Pie
              data={sorted}
              dataKey="views"
              nameKey="platform"
              innerRadius="68%"
              outerRadius="94%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {sorted.map((entry) => (
                <Cell
                  key={entry.platform}
                  fill={platformMeta(entry.platform).color}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Total no centro */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">
            {formatCompact(total)}
          </span>
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            views
          </span>
        </div>
      </div>

      {/* Legenda direta: ícone + label + % + views + trilha proporcional */}
      <div className="flex w-full flex-1 flex-col gap-2.5">
        {sorted.map((entry) => {
          const { label, Icon, color } = platformMeta(entry.platform)
          const pct = (entry.views / total) * 100
          return (
            <div key={entry.platform} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-foreground/90 inline-flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[4px]"
                    style={{ background: color }}
                  />
                  {Icon && <Icon className="size-3.5 shrink-0" />}
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold">
                    {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {formatCompact(entry.views)}
                  </span>
                </span>
              </div>
              <div className="bg-muted/50 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(pct, 2)}%`, background: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{ payload?: PlatformDatum }>
  total: number
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  const { label } = platformMeta(datum.platform)
  return (
    <div className="border-border bg-popover/95 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="text-muted-foreground">
        {datum.views.toLocaleString("pt-BR")} views ·{" "}
        {((datum.views / total) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        %
      </p>
      <p className="text-muted-foreground">
        {datum.posts.toLocaleString("pt-BR")} vídeos ·{" "}
        {datum.engagementRate.toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        % eng.
      </p>
    </div>
  )
}
