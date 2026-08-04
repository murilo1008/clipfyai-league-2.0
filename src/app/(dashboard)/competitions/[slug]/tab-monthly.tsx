"use client"

import * as React from "react"
import {
  BookmarkSimple,
  CaretDown,
  CaretUp,
  ChartBar,
  ChartLineUp,
  ChatCircle,
  CurrencyDollar,
  Equals,
  Eye,
  Heart,
  Lightning,
  Play,
  ShareFat,
  Spinner,
  TrendUp,
  Trophy,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getPrizeForPosition,
  parsePrizeTable,
} from "@/lib/daily-ranking-preview"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { ApplicationDetailsDialog } from "./application-details-dialog"
import { ClipperMetricsDialog } from "./clipper-metrics-dialog"
import {
  MonthlyRankResultModal,
  type MonthlyRankPreview,
} from "./monthly-rank-result-modal"
import {
  type AdminApplication,
  type CompetitionDetails,
  type CompetitionTabProps,
  EmptyState,
  formatMetricFull,
  formatNumber,
  PositionBadge,
  useFormatCurrency,
} from "./shared"

type MonthlyRankingEntry = CompetitionDetails["topMonthlyRanking"][number]

export function MonthlyTab(props: CompetitionTabProps) {
  const { slug, campaignId, data, active, refetch } = props
  const formatCurrency = useFormatCurrency()

  const entries = React.useMemo(
    () => data.topMonthlyRanking ?? [],
    [data.topMonthlyRanking],
  )
  const isViewsXEngagement =
    data.campaign.rankingMetricType === "VIEWS_X_ENGAGEMENT"
  const postsInWindow = data.todayPostsCount ?? 0

  const monthlyPrizeTable = React.useMemo(
    () => parsePrizeTable(data.rankingRule?.monthlyPrizeTable ?? null),
    [data.rankingRule?.monthlyPrizeTable],
  )

  /** Soma dos prêmios das posições listadas. */
  const totalMonthlyPrize = React.useMemo(
    () =>
      entries.reduce(
        (sum, entry) =>
          sum + getPrizeForPosition(monthlyPrizeTable, entry.position),
        0,
      ),
    [entries, monthlyPrizeTable],
  )

  /* ===== Preview do rank mensal (modal resultado) ===== */
  const [previewData, setPreviewData] =
    React.useState<MonthlyRankPreview | null>(null)
  const [resultOpen, setResultOpen] = React.useState(false)
  const silentPreviewRef = React.useRef(false)

  const previewMonthlyRank =
    api.admin.previewMonthlyRankByPeriod.useMutation({
      onSuccess: (result) => {
        setPreviewData(result)
        if (silentPreviewRef.current) {
          silentPreviewRef.current = false
          return
        }
        setResultOpen(true)
        toast.success("Ranking mensal gerado")
      },
      onError: (error) => {
        silentPreviewRef.current = false
        toast.error(error.message || "Erro ao gerar ranking mensal")
      },
    })

  /** Re-preview silencioso (pós-pagamento): atualiza os dados sem toast/reabrir. */
  const handleSilentRepreview = () => {
    if (!campaignId) return
    silentPreviewRef.current = true
    previewMonthlyRank.mutate(
      { campaignId },
      {
        onError: () => {
          silentPreviewRef.current = false
        },
      },
    )
  }

  /* ===== Métricas detalhadas do clipador ===== */
  const [metricsEntry, setMetricsEntry] =
    React.useState<MonthlyRankingEntry | null>(null)
  const [metricsOpen, setMetricsOpen] = React.useState(false)

  /* ===== Ver Aplicação ===== */
  const { data: applicationsData } =
    api.admin.getCompetitionApplicationsAdmin.useQuery(
      { slug, page: 1, pageSize: 200 },
      { enabled: active },
    )
  const [selectedApplication, setSelectedApplication] =
    React.useState<AdminApplication | null>(null)
  const [isApplicationOpen, setIsApplicationOpen] = React.useState(false)

  const handleOpenApplication = (entry: MonthlyRankingEntry) => {
    const application = applicationsData?.applications.find(
      (app) =>
        app.clipperName === entry.clipperName ||
        app.clipperArtisticName === entry.clipperUsername,
    )
    if (application) {
      setSelectedApplication(application)
      setIsApplicationOpen(true)
    }
  }

  return (
    <>
      <section className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
        {/* ===== Header ===== */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/15 text-violet-500 dark:text-violet-400">
                <Trophy className="size-4.5" weight="fill" />
              </span>
              <h2 className="text-base font-bold tracking-tight sm:text-lg">
                Ranking Mensal Geral da Competição
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1.5 rounded-full border-orange-500/40 bg-gradient-to-r from-orange-500/20 to-amber-500/15 font-semibold text-orange-600 dark:text-orange-400"
              >
                <TrendUp className="size-3 animate-pulse" weight="bold" />
                {postsInWindow}{" "}
                {postsInWindow === 1 ? "post na janela" : "posts na janela"}
              </Badge>
              {isViewsXEngagement && (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-orange-500/20 text-fuchsia-500 dark:text-fuchsia-300"
                >
                  <Lightning className="size-3" weight="fill" />
                  Views × Engajamento
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {isViewsXEngagement
                ? "Score = Views × Taxa de Engajamento (melhor engajamento = mais pontos)"
                : "Desempenho acumulado de todos os clipadores"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 cursor-pointer gap-2 rounded-xl border-violet-500/40 bg-violet-500/10 font-semibold text-violet-600 hover:bg-violet-500/20 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-200"
            disabled={!campaignId || previewMonthlyRank.isPending}
            onClick={() => {
              if (!campaignId) return
              previewMonthlyRank.mutate({ campaignId })
            }}
          >
            {previewMonthlyRank.isPending ? (
              <Spinner className="size-4 animate-spin" />
            ) : (
              <Trophy className="size-4" weight="fill" />
            )}
            Gerar rank mensal
          </Button>
        </div>

        {/* ===== Lista ===== */}
        {entries.length === 0 ? (
          <EmptyState
            icon={<Trophy className="size-6" weight="fill" />}
            title="Nenhum clipper no ranking ainda"
            subtitle="Os clipadores aparecem aqui conforme os posts elegíveis são agregados"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry) => {
              const totalPosts = entry.postsCount ?? 0
              const engagementRate = entry.engagementRate ?? 0
              const avgViewsPerPost =
                totalPosts > 0
                  ? Math.round(entry.totalViews / totalPosts)
                  : 0
              const monthlyPrize = getPrizeForPosition(
                monthlyPrizeTable,
                entry.position,
              )

              return (
                <div
                  key={entry.position}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors sm:p-4",
                    entry.position === 1 &&
                      "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/5",
                    entry.position === 2 &&
                      "border-zinc-400/40 bg-gradient-to-r from-zinc-400/10 to-zinc-500/5",
                    entry.position === 3 &&
                      "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/5",
                    entry.position > 3 && "border-border/60 bg-muted/20",
                  )}
                >
                  {/* Header: posição, avatar, nome e badges */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <PositionBadge position={entry.position} />
                      <Avatar className="border-border/60 size-11 shrink-0 rounded-2xl border-2 sm:size-12">
                        <AvatarImage
                          src={entry.clipperImageUrl ?? undefined}
                          alt={entry.clipperName}
                        />
                        <AvatarFallback className="bg-gradient-custom rounded-2xl text-sm font-bold text-[#04222A]">
                          {entry.clipperName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold sm:text-base">
                          {entry.clipperName}
                        </p>
                        {entry.clipperUsername && (
                          <p className="text-muted-foreground truncate text-xs">
                            @{entry.clipperUsername}
                          </p>
                        )}
                        {/* Mudança de posição */}
                        {entry.previousPosition != null &&
                          (entry.previousPosition > entry.position ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CaretUp className="size-3" weight="bold" />+
                              {entry.previousPosition - entry.position}{" "}
                              posições
                            </span>
                          ) : entry.previousPosition < entry.position ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                              <CaretDown className="size-3" weight="bold" />-
                              {entry.position - entry.previousPosition}{" "}
                              posições
                            </span>
                          ) : (
                            <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold">
                              <Equals className="size-3" weight="bold" />
                              manteve
                            </span>
                          ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {/* Prêmio */}
                      {monthlyPrize > 0 && (
                        <Badge
                          className={cn(
                            "gap-1 rounded-full border-0 font-bold",
                            entry.position === 1 &&
                              "bg-gradient-to-r from-amber-400 to-yellow-600 text-[#3b2a00]",
                            entry.position === 2 &&
                              "bg-gradient-to-r from-zinc-300 to-zinc-500 text-zinc-900",
                            entry.position === 3 &&
                              "bg-gradient-to-r from-orange-400 to-amber-700 text-[#3b1d00]",
                            entry.position > 3 &&
                              "bg-gradient-to-r from-emerald-500 to-green-600 text-white",
                          )}
                        >
                          <CurrencyDollar className="size-3" weight="bold" />
                          {formatCurrency(monthlyPrize)}
                        </Badge>
                      )}

                      {/* Views (número exato) */}
                      <Badge
                        variant="outline"
                        className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary gap-1.5 rounded-full px-2.5 py-1"
                      >
                        <Eye className="size-3.5" weight="fill" />
                        <span className="text-sm font-bold tabular-nums">
                          {formatMetricFull(entry.totalViews)}
                        </span>
                      </Badge>

                      {/* Ranking Score (só Views × Engajamento) */}
                      {isViewsXEngagement && entry.rankingScore != null && (
                        <Badge
                          variant="outline"
                          className="gap-1.5 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/15 to-orange-500/15 px-2.5 py-1 text-fuchsia-600 dark:text-fuchsia-300"
                        >
                          <Lightning className="size-3.5" weight="fill" />
                          <span className="flex flex-col items-start leading-none">
                            <span className="text-[8px] tracking-wide uppercase opacity-70">
                              Score
                            </span>
                            <span className="text-xs font-bold tabular-nums sm:text-sm">
                              {formatMetricFull(
                                Math.round(entry.rankingScore),
                              )}
                            </span>
                          </span>
                        </Badge>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                        onClick={() => {
                          setMetricsEntry(entry)
                          setMetricsOpen(true)
                        }}
                      >
                        <ChartBar className="size-3.5" weight="fill" />
                        Ver Métricas
                      </Button>
                    </div>
                  </div>

                  {/* Grid de 7 stats */}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
                    <StatCell
                      icon={<Play className="size-3" weight="fill" />}
                      label="Posts"
                      value={String(totalPosts)}
                      className="text-cyan-600 dark:text-cyan-400"
                    />
                    <StatCell
                      icon={<ChartLineUp className="size-3" weight="bold" />}
                      label="Média Views/Post"
                      value={formatNumber(avgViewsPerPost)}
                      className="text-brand-cyan not-dark:text-primary"
                    />
                    <StatCell
                      icon={<Heart className="size-3" weight="fill" />}
                      label="Likes"
                      value={formatNumber(entry.totalLikes)}
                      className="text-pink-600 dark:text-pink-400"
                    />
                    <StatCell
                      icon={<ChatCircle className="size-3" weight="fill" />}
                      label="Coment."
                      value={formatNumber(entry.totalComments)}
                      className="text-cyan-600 dark:text-cyan-400"
                    />
                    <StatCell
                      icon={<ShareFat className="size-3" weight="fill" />}
                      label="Compart."
                      value={formatNumber(entry.totalShares ?? 0)}
                      className="text-emerald-600 dark:text-emerald-400"
                    />
                    <StatCell
                      icon={
                        <BookmarkSimple className="size-3" weight="fill" />
                      }
                      label="Saves"
                      value={formatNumber(entry.totalSaves ?? 0)}
                      className="text-amber-600 dark:text-amber-400"
                    />
                    <StatCell
                      icon={<TrendUp className="size-3" weight="bold" />}
                      label="ER"
                      value={`${engagementRate.toFixed(2)}%`}
                      className="text-violet-600 dark:text-violet-400"
                    />
                  </div>

                  {/* Footer: Ver Aplicação */}
                  <div className="border-border/60 flex items-center border-t pt-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground ml-auto h-7 cursor-pointer gap-1.5 rounded-lg text-xs"
                      onClick={() => handleOpenApplication(entry)}
                    >
                      <Eye className="size-3" />
                      Ver Aplicação
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ===== Total em Premiação Mensal ===== */}
        {data.rankingRule?.monthlyEnabled && entries.length > 0 && (
          <div className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 p-3.5 sm:p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                  <Trophy className="size-5" weight="fill" />
                </span>
                <div>
                  <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                    Total em Premiação Mensal
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Top {data.rankingRule.monthlyTopCount} posições premiadas
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-xl font-bold text-violet-600 tabular-nums sm:text-2xl dark:text-violet-400">
                  {formatCurrency(totalMonthlyPrize)}
                </p>
                <p className="text-muted-foreground text-xs">
                  distribuídos este mês
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ===== Modal: resultado do rank mensal ===== */}
      <MonthlyRankResultModal
        open={resultOpen}
        onOpenChange={(open) => {
          setResultOpen(open)
          if (!open) setPreviewData(null)
        }}
        data={previewData}
        slug={slug}
        refetch={refetch}
        onSilentRepreview={handleSilentRepreview}
      />

      {/* ===== Dialog: métricas detalhadas ===== */}
      <ClipperMetricsDialog
        entry={metricsEntry}
        open={metricsOpen}
        onOpenChange={setMetricsOpen}
        campaignId={campaignId}
      />

      {/* ===== Dialog: detalhes da aplicação ===== */}
      <ApplicationDetailsDialog
        application={selectedApplication}
        open={isApplicationOpen}
        onOpenChange={setIsApplicationOpen}
        slug={slug}
        campaignId={campaignId}
      />
    </>
  )
}

/* ===== Blocos auxiliares ===== */

function StatCell({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="border-border/60 bg-muted/30 rounded-xl border px-2.5 py-2">
      <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium">
        <span className={cn("shrink-0", className)}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold tabular-nums sm:text-base",
          className,
        )}
      >
        {value}
      </p>
    </div>
  )
}
