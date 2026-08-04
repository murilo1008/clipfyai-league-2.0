"use client"

import * as React from "react"
import {
  ChartPieSlice,
  Coins,
  Copy,
  LinkSimple,
  Medal,
  Pulse,
  TrendUp,
  Trophy,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ChartSkeleton, DonutSkeleton } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import {
  PLATFORM_CHART_COLORS,
  PLATFORM_GROWTH_COLORS,
  formatMetricFull,
  formatNumber,
  useFormatCurrency,
  type CompetitionTabProps,
} from "./shared"

/* ============================================================
   Links de afiliados — cores por rede
   ============================================================ */

const AFFILIATE_LINKS: Array<{
  key:
    | "affiliateLinkInstagram"
    | "affiliateLinkTiktok"
    | "affiliateLinkYoutube"
    | "affiliateLinkFacebook"
    | "affiliateLinkKwai"
  platform: PlatformKey
  label: string
  row: string
  chip: string
  code: string
  copy: string
}> = [
  {
    key: "affiliateLinkInstagram",
    platform: "INSTAGRAM",
    label: "Instagram",
    row: "border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/10",
    chip: "bg-pink-500/15 text-pink-500 dark:text-pink-400",
    code: "text-pink-700 dark:text-pink-200",
    copy: "text-pink-500 hover:bg-pink-500/15 dark:text-pink-400",
  },
  {
    key: "affiliateLinkTiktok",
    platform: "TIKTOK",
    label: "TikTok",
    row: "border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10",
    chip: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    code: "text-cyan-700 dark:text-cyan-200",
    copy: "text-cyan-600 hover:bg-cyan-500/15 dark:text-cyan-400",
  },
  {
    key: "affiliateLinkYoutube",
    platform: "YOUTUBE",
    label: "YouTube",
    row: "border-red-500/20 bg-red-500/5 hover:bg-red-500/10",
    chip: "bg-red-500/15 text-red-500 dark:text-red-400",
    code: "text-red-700 dark:text-red-200",
    copy: "text-red-500 hover:bg-red-500/15 dark:text-red-400",
  },
  {
    key: "affiliateLinkFacebook",
    platform: "FACEBOOK",
    label: "Facebook",
    row: "border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10",
    chip: "bg-blue-500/15 text-blue-500 dark:text-blue-400",
    code: "text-blue-700 dark:text-blue-200",
    copy: "text-blue-500 hover:bg-blue-500/15 dark:text-blue-400",
  },
  {
    key: "affiliateLinkKwai",
    platform: "KWAI",
    label: "Kwai",
    row: "border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10",
    chip: "bg-orange-500/15 text-orange-500 dark:text-orange-400",
    code: "text-orange-700 dark:text-orange-200",
    copy: "text-orange-500 hover:bg-orange-500/15 dark:text-orange-400",
  },
]

/* ============================================================
   Tooltips glass
   ============================================================ */

interface PieDatum {
  platform: string
  name: string
  value: number
  posts: number
  likes: number
  fill: string
}

function DonutTooltip({
  active,
  payload,
  totalViews,
}: {
  active?: boolean
  payload?: Array<{ payload?: PieDatum }>
  totalViews: number
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  const pct = totalViews > 0 ? (datum.value / totalViews) * 100 : 0
  return (
    <div className="border-border bg-popover/95 min-w-40 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
        <span
          className="size-2 rounded-full"
          style={{ background: datum.fill }}
        />
        {datum.name}
      </p>
      <div className="text-muted-foreground flex flex-col gap-1">
        <p className="flex justify-between gap-6">
          <span>Views</span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatMetricFull(datum.value)}
          </span>
        </p>
        <p className="flex justify-between gap-6">
          <span>Posts</span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatMetricFull(datum.posts)}
          </span>
        </p>
        <p className="flex justify-between gap-6">
          <span>Curtidas</span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatMetricFull(datum.likes)}
          </span>
        </p>
        <p className="flex justify-between gap-6">
          <span>Participação</span>
          <span className="text-foreground font-bold tabular-nums">
            {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
        </p>
      </div>
    </div>
  )
}

const formatGrowthDate = (value: string) => {
  const [, month, day] = value.split("-")
  return day && month ? `${day}/${month}` : value
}

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
        {label ? formatGrowthDate(String(label)) : ""}
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
            <span
              className={cn(
                "font-semibold tabular-nums",
                entry.name === "Total" && "text-sm font-bold",
              )}
            >
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

/* ============================================================
   Tab "Visão Geral"
   ============================================================ */

export function OverviewTab({ slug, data, active }: CompetitionTabProps) {
  const formatCurrency = useFormatCurrency()

  const { data: chartsData, isLoading: isLoadingCharts } =
    api.admin.getCompetitionChartsAdmin.useQuery(
      { slug },
      { enabled: active && !!data },
    )

  const hasAffiliateLinks = AFFILIATE_LINKS.some(
    ({ key }) => !!data.campaign[key],
  )

  /* ===== Distribuição por plataforma ===== */
  const pieData = React.useMemo<PieDatum[]>(() => {
    if (!chartsData?.platformDistribution) return []
    return chartsData.platformDistribution
      .map((entry) => ({
        platform: entry.platform,
        name:
          platformConfig[entry.platform as PlatformKey]?.label ??
          entry.platform,
        value: Number(entry.views ?? 0),
        posts: Number(entry.posts ?? 0),
        likes: Number(entry.likes ?? 0),
        fill: PLATFORM_CHART_COLORS[entry.platform] ?? "#6b7280",
      }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [chartsData])

  /* ===== Engajamento por plataforma ===== */
  const engagementRows = React.useMemo(() => {
    if (!chartsData?.platformDistribution) return []
    return chartsData.platformDistribution
      .filter((entry) => Number(entry.views ?? 0) > 0)
      .map((entry) => {
        const views = Number(entry.views ?? 0)
        const interactions =
          Number(entry.likes ?? 0) +
          Number(entry.comments ?? 0) +
          Number(entry.shares ?? 0) +
          Number(entry.saves ?? 0)
        return {
          platform: entry.platform,
          views,
          interactions,
          rate: views > 0 ? (interactions / views) * 100 : 0,
        }
      })
      .sort((a, b) => b.rate - a.rate)
  }, [chartsData])

  const totals = React.useMemo(() => {
    const distribution = chartsData?.platformDistribution ?? []
    const sum = (picker: (entry: (typeof distribution)[number]) => number) =>
      distribution.reduce((acc, entry) => acc + picker(entry), 0)
    const views = sum((entry) => Number(entry.views ?? 0))
    const interactions =
      sum((entry) => Number(entry.likes ?? 0)) +
      sum((entry) => Number(entry.comments ?? 0)) +
      sum((entry) => Number(entry.shares ?? 0)) +
      sum((entry) => Number(entry.saves ?? 0))
    return {
      views,
      interactions,
      posts: sum((entry) => Number(entry.posts ?? 0)),
    }
  }, [chartsData])

  const maxEngagementRate = engagementRows.reduce(
    (max, row) => Math.max(max, row.rate),
    0,
  )

  const growthData = chartsData?.platformGrowthData ?? []
  const growthPlatforms = chartsData?.growthPlatforms ?? []
  const growthInterval = Math.max(Math.floor((growthData.length || 1) / 8), 1)

  const rule = data.rankingRule

  return (
    <div className="flex flex-col gap-5">
      {/* ===== Links de Afiliados ===== */}
      {hasAffiliateLinks && (
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
              <LinkSimple className="size-4" weight="bold" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold">Links de Afiliados</p>
              <p className="text-muted-foreground text-xs">
                Links oficiais de divulgação por rede social
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {AFFILIATE_LINKS.map((entry) => {
              const value = data.campaign[entry.key]
              if (!value) return null
              const PlatformIcon = platformConfig[entry.platform]?.icon
              return (
                <div
                  key={entry.key}
                  className={cn(
                    "group flex items-center gap-2 rounded-xl border p-2 transition-colors sm:gap-3 sm:p-3",
                    entry.row,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-8",
                      entry.chip,
                    )}
                  >
                    {PlatformIcon && (
                      <PlatformIcon className="size-3.5 sm:size-4" />
                    )}
                  </span>
                  <code
                    className={cn(
                      "bg-background/50 min-w-0 flex-1 truncate rounded-lg px-2 py-1 font-mono text-[10px] sm:px-3 sm:py-1.5 sm:text-xs",
                      entry.code,
                    )}
                  >
                    {value}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "size-7 shrink-0 cursor-pointer rounded-lg p-0 sm:size-8",
                      entry.copy,
                    )}
                    onClick={() => {
                      void navigator.clipboard.writeText(value)
                      toast.success(`Link ${entry.label} copiado!`)
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ===== Gráficos (lazy) ===== */}
      {isLoadingCharts ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <DonutSkeleton />
            <ChartSkeleton heightClass="h-64 sm:h-80" bars={8} />
          </div>
          <ChartSkeleton heightClass="h-[280px] sm:h-[340px]" />
        </>
      ) : chartsData ? (
        <>
          {pieData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* ===== Distribuição por Plataforma ===== */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                    <ChartPieSlice className="size-4" weight="fill" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-bold sm:text-base">
                      Distribuição por Plataforma
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Views por rede social
                    </p>
                  </div>
                </div>

                <div className="relative mx-auto size-44 shrink-0 sm:size-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={<DonutTooltip totalViews={totals.views} />}
                      />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="66%"
                        outerRadius="94%"
                        paddingAngle={2}
                        cornerRadius={4}
                        stroke="var(--card)"
                        strokeWidth={2}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.platform} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold tabular-nums">
                      {formatNumber(totals.views)}
                    </span>
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                      views
                    </span>
                  </div>
                </div>

                {/* Legenda: dot + ícone + % + views + trilha proporcional */}
                <div className="flex flex-col gap-2.5">
                  {pieData.map((entry) => {
                    const pct =
                      totals.views > 0 ? (entry.value / totals.views) * 100 : 0
                    const PlatformIcon =
                      platformConfig[entry.platform as PlatformKey]?.icon
                    return (
                      <div key={entry.platform} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="text-foreground/90 inline-flex min-w-0 items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-[4px]"
                              style={{ background: entry.fill }}
                            />
                            {PlatformIcon && (
                              <PlatformIcon className="size-3.5 shrink-0" />
                            )}
                            <span className="truncate">{entry.name}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            <span className="font-bold">
                              {pct.toLocaleString("pt-BR", {
                                maximumFractionDigits: 1,
                              })}
                              %
                            </span>
                            <span className="text-muted-foreground ml-1.5 text-xs">
                              {formatNumber(entry.value)}
                            </span>
                          </span>
                        </div>
                        <div className="bg-muted/50 h-1 w-full overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              background: entry.fill,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ===== Taxa de Engajamento ===== */}
              <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                    <Pulse className="size-4" weight="bold" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-bold sm:text-base">
                      Taxa de Engajamento
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Desempenho por plataforma
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-5 text-center">
                  <p className="text-muted-foreground text-xs">
                    Engajamento Geral
                  </p>
                  <p className="text-4xl font-bold text-emerald-500 tabular-nums sm:text-5xl dark:text-emerald-400">
                    {data.stats.engagementRate.toFixed(2)}%
                  </p>
                  <p className="text-muted-foreground/70 mt-2 text-xs">
                    {formatMetricFull(totals.interactions)} interações /{" "}
                    {formatMetricFull(totals.views)} views
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Por plataforma
                  </p>
                  {engagementRows.map((row) => {
                    const config = platformConfig[row.platform as PlatformKey]
                    const PlatformIcon = config?.icon
                    const color =
                      PLATFORM_CHART_COLORS[row.platform] ?? "#6b7280"
                    const barWidth =
                      maxEngagementRate > 0
                        ? Math.max(5, (row.rate / maxEngagementRate) * 100)
                        : 0
                    return (
                      <div key={row.platform} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2">
                            {PlatformIcon && (
                              <PlatformIcon
                                className="size-4"
                                style={{ color }}
                              />
                            )}
                            <span className="text-xs font-medium sm:text-sm">
                              {config?.label ?? row.platform}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span className="text-muted-foreground/70 text-[10px] tabular-nums sm:text-xs">
                              {formatMetricFull(row.interactions)} /{" "}
                              {formatMetricFull(row.views)}
                            </span>
                            <span
                              className="text-xs font-bold tabular-nums sm:text-sm"
                              style={{ color }}
                            >
                              {row.rate.toFixed(2)}%
                            </span>
                          </span>
                        </div>
                        <div className="bg-muted/40 h-2 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="border-border/40 mt-auto grid grid-cols-3 gap-3 border-t pt-3">
                  <div className="text-center">
                    <p className="text-muted-foreground/70 mb-0.5 text-[10px] sm:text-xs">
                      Total Posts
                    </p>
                    <p className="text-sm font-bold tabular-nums sm:text-lg">
                      {formatMetricFull(totals.posts)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground/70 mb-0.5 text-[10px] sm:text-xs">
                      Total Views
                    </p>
                    <p className="text-sm font-bold text-violet-500 tabular-nums sm:text-lg dark:text-violet-400">
                      {formatMetricFull(totals.views)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground/70 mb-0.5 text-[10px] sm:text-xs">
                      Interações
                    </p>
                    <p className="text-sm font-bold text-pink-500 tabular-nums sm:text-lg dark:text-pink-400">
                      {formatMetricFull(totals.interactions)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== Crescimento de Views ===== */}
          {growthData.length > 0 && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                  <TrendUp className="size-4" weight="bold" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold sm:text-base">
                    Crescimento de Views
                  </p>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">
                    Crescimento acumulado por rede social durante a competição
                  </p>
                </div>
              </div>

              <div className="h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={growthData}
                    margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="ovTotalGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--brand-cyan)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--brand-mint)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      {growthPlatforms.map((platform) => {
                        const stroke =
                          PLATFORM_GROWTH_COLORS[platform]?.stroke ?? "#888"
                        return (
                          <linearGradient
                            key={platform}
                            id={`ovGrad-${platform}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={stroke}
                              stopOpacity={0.15}
                            />
                            <stop
                              offset="100%"
                              stopColor={stroke}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        )
                      })}
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      tickFormatter={formatGrowthDate}
                      interval={growthInterval}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                      tickFormatter={(value: number) =>
                        value >= 1_000_000
                          ? `${(value / 1_000_000).toFixed(1)}M`
                          : value >= 1000
                            ? `${(value / 1000).toFixed(0)}K`
                            : String(value)
                      }
                      width={45}
                    />
                    <Tooltip
                      content={<GrowthTooltip />}
                      cursor={{
                        stroke:
                          "color-mix(in oklab, var(--foreground) 22%, transparent)",
                        strokeDasharray: "4 4",
                      }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        fontSize: "11px",
                        paddingTop: "8px",
                        color: "var(--muted-foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="var(--brand-cyan)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      fill="url(#ovTotalGrad)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        strokeWidth: 2,
                        fill: "var(--brand-mint)",
                        stroke: "var(--card)",
                      }}
                    />
                    {growthPlatforms.map((platform) => {
                      const config = PLATFORM_GROWTH_COLORS[platform] ?? {
                        stroke: "#888",
                        label: platform,
                      }
                      return (
                        <Area
                          key={platform}
                          type="monotone"
                          dataKey={platform}
                          name={config.label}
                          stroke={config.stroke}
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          fill={`url(#ovGrad-${platform})`}
                          dot={false}
                          activeDot={{
                            r: 4,
                            strokeWidth: 1.5,
                            fill: config.stroke,
                            stroke: "var(--card)",
                          }}
                        />
                      )
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* ===== Premiações ===== */}
      {rule && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rule.dailyEnabled && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                  <Coins className="size-4.5" weight="fill" />
                </span>
                <p className="text-base font-bold">Premiação Diária</p>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-muted-foreground text-sm">Top Posições</p>
                  <p className="text-brand-cyan not-dark:text-primary text-2xl font-bold tabular-nums">
                    {rule.dailyTopCount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Prêmio Diário</p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatCurrency(rule.dailyTotalPrize)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {rule.monthlyEnabled && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500 dark:text-violet-400">
                  <Trophy className="size-4.5" weight="fill" />
                </span>
                <p className="text-base font-bold">Premiação Mensal</p>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-muted-foreground text-sm">Top Posições</p>
                  <p className="text-2xl font-bold text-violet-500 tabular-nums dark:text-violet-400">
                    {rule.monthlyTopCount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Prêmio Mensal</p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatCurrency(rule.monthlyTotalPrize)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {rule.bonusEnabled && (
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 dark:text-amber-400">
                  <Medal className="size-4.5" weight="fill" />
                </span>
                <p className="text-base font-bold">Bônus por Marco</p>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-muted-foreground text-sm">Milestone</p>
                  <p className="text-2xl font-bold text-amber-500 tabular-nums dark:text-amber-400">
                    {formatNumber(rule.bonusMilestone)} views
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Bônus</p>
                  <p className="text-xl font-bold tabular-nums">
                    {formatCurrency(rule.bonusAmount)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
