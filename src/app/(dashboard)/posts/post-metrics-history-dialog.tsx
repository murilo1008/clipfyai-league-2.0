"use client"

import * as React from "react"
import { ChartLineUp } from "@phosphor-icons/react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/trpc/react"

/* Cores das séries — views usa o cyan da marca; demais mantêm o mapa original. */
const SERIES = {
  views: "var(--brand-cyan)",
  likes: "#ef4444",
  comments: "#10b981",
  shares: "#8b5cf6",
  engagement: "#22c55e",
  score: "#f97316",
} as const

function MetricsTooltip({
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
    <div className="border-border bg-popover/95 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-semibold tabular-nums">
              {typeof entry.value === "number"
                ? entry.value.toLocaleString("pt-BR", {
                    maximumFractionDigits: 2,
                  })
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PostMetricsHistoryDialogProps {
  postId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Quando true, usa `admin.getPostMetricsHistory` (apenas ADMIN). */
  isAdmin?: boolean
}

/** Histórico de coletas de métricas (ClipPostMetrics) de um post. */
export function PostMetricsHistoryDialog({
  postId,
  open,
  onOpenChange,
  isAdmin = false,
}: PostMetricsHistoryDialogProps) {
  const clientQuery = api.customers.getPostMetricsHistory.useQuery(
    { postId: postId! },
    { enabled: open && !!postId && !isAdmin },
  )
  const adminQuery = api.admin.getPostMetricsHistory.useQuery(
    { postId: postId! },
    { enabled: open && !!postId && isAdmin },
  )

  const data = isAdmin ? adminQuery.data : clientQuery.data
  const isLoading = isAdmin ? adminQuery.isLoading : clientQuery.isLoading
  const isError = isAdmin ? adminQuery.isError : clientQuery.isError
  const error = isAdmin ? adminQuery.error : clientQuery.error

  const chartRows =
    data?.points.map((point) => ({
      ...point,
      date: new Date(point.collectedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2.5">
            <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
              <ChartLineUp className="size-4.5" weight="fill" />
            </span>
            Histórico de métricas
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {data
              ? `${data.campaignName} · @${
                  data.username.startsWith("@")
                    ? data.username.slice(1)
                    : data.username
                }`
              : "Carregando contexto do post…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="py-2">
            <Skeleton className="h-[300px] w-full rounded-2xl sm:h-[340px]" />
          </div>
        )}

        {isError && (
          <p className="text-destructive text-sm">
            {error?.message ?? "Não foi possível carregar o histórico."}
          </p>
        )}

        {!isLoading && !isError && data && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full text-xs">
                Ranking:{" "}
                {data.metricType === "VIEWS_X_ENGAGEMENT"
                  ? "Views × Engajamento"
                  : "Somente views"}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full text-xs tabular-nums"
              >
                {data.points.length} coleta{data.points.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {data.points.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Ainda não há coletas de métricas para este vídeo.
              </p>
            ) : (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Evolução: views, likes, comentários, shares, ER (%) e score
                  {data.metricType === "VIEWS"
                    ? " (em modo Views, score = views — linha de score omitida)"
                    : ""}
                </p>
                <div className="h-[280px] w-full sm:h-[320px]">
                  {chartRows.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartRows}
                        margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="pmhViews"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="var(--brand-cyan)"
                              stopOpacity={0.22}
                            />
                            <stop
                              offset="100%"
                              stopColor="var(--brand-mint)"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="pmhLikes"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={SERIES.likes}
                              stopOpacity={0.12}
                            />
                            <stop
                              offset="100%"
                              stopColor={SERIES.likes}
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="pmhComments"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={SERIES.comments}
                              stopOpacity={0.12}
                            />
                            <stop
                              offset="100%"
                              stopColor={SERIES.comments}
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="pmhShares"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={SERIES.shares}
                              stopOpacity={0.12}
                            />
                            <stop
                              offset="100%"
                              stopColor={SERIES.shares}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke="color-mix(in oklab, var(--foreground) 8%, transparent)"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={6}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                          interval={Math.max(
                            Math.floor(chartRows.length / 6),
                            0,
                          )}
                        />
                        <YAxis
                          yAxisId="main"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
                          tickFormatter={(value: number) =>
                            value >= 1_000_000
                              ? `${(value / 1_000_000).toFixed(1)}M`
                              : value >= 1000
                                ? `${(value / 1000).toFixed(0)}K`
                                : `${value}`
                          }
                          width={38}
                          label={{
                            value: "Contagens / score",
                            angle: -90,
                            position: "insideLeft",
                            fill: "var(--muted-foreground)",
                            fontSize: 9,
                            offset: 4,
                          }}
                        />
                        <YAxis
                          yAxisId="er"
                          orientation="right"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: SERIES.engagement, fontSize: 9 }}
                          width={34}
                          tickFormatter={(value: number) => `${value}%`}
                          label={{
                            value: "ER %",
                            angle: 90,
                            position: "insideRight",
                            fill: SERIES.engagement,
                            fontSize: 9,
                            offset: 4,
                          }}
                        />
                        <Tooltip content={<MetricsTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={6}
                          wrapperStyle={{ fontSize: "10px", paddingTop: 4 }}
                        />
                        <Area
                          yAxisId="main"
                          type="monotone"
                          dataKey="views"
                          name="Views"
                          stroke={SERIES.views}
                          strokeWidth={2}
                          fill="url(#pmhViews)"
                          dot={false}
                        />
                        <Area
                          yAxisId="main"
                          type="monotone"
                          dataKey="likes"
                          name="Likes"
                          stroke={SERIES.likes}
                          strokeWidth={1.5}
                          fill="url(#pmhLikes)"
                          dot={false}
                          strokeDasharray="4 3"
                        />
                        <Area
                          yAxisId="main"
                          type="monotone"
                          dataKey="comments"
                          name="Coment."
                          stroke={SERIES.comments}
                          strokeWidth={1.5}
                          fill="url(#pmhComments)"
                          dot={false}
                          strokeDasharray="4 3"
                        />
                        <Area
                          yAxisId="main"
                          type="monotone"
                          dataKey="shares"
                          name="Shares"
                          stroke={SERIES.shares}
                          strokeWidth={1.5}
                          fill="url(#pmhShares)"
                          dot={false}
                          strokeDasharray="4 3"
                        />
                        <Line
                          yAxisId="er"
                          type="monotone"
                          dataKey="engagementRate"
                          name="ER %"
                          stroke={SERIES.engagement}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                        {data.metricType === "VIEWS_X_ENGAGEMENT" && (
                          <Line
                            yAxisId="main"
                            type="monotone"
                            dataKey="rankingScore"
                            name="Score"
                            stroke={SERIES.score}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground flex h-full items-center justify-center px-2 text-center text-xs">
                      É necessário pelo menos duas coletas para exibir o gráfico
                      de tendência.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
