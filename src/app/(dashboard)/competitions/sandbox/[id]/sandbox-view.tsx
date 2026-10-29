"use client"

import {
  ArrowSquareOut,
  At,
  BookmarkSimple,
  CalendarBlank,
  ChartLineUp,
  ChatCircle,
  Crown,
  CurrencyDollar,
  Eye,
  Globe,
  Hash,
  Heart,
  Lightning,
  Lock,
  Play,
  Pulse,
  ShareFat,
  Sparkle,
  TrendUp,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import { StatTile } from "@/components/home/stat-tile"
import { DarkScope } from "@/components/shared/dark-scope"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ClipThumbnail } from "@/components/ui/clip-thumbnail"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import {
  sandboxRankingScore,
  type SandboxCampaign,
  type SandboxData,
  type SandboxStats,
} from "@/lib/competition-sandbox"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig } from "@/lib/platform-config"
import { cn } from "@/lib/utils"

import { CompetitionHeroBackdrop } from "../../[slug]/hero-backdrop"
import {
  CAMPAIGN_STATUS_CONFIG,
  EmptyState,
  PositionBadge,
  PostPreviewFallback,
  StatCell,
  formatMetricFull,
  formatNumber,
  formatYmdToDmy,
  useFormatCurrency,
} from "../../[slug]/shared"
import { PlatformCharts, PrizeCards } from "../../[slug]/tab-overview"

/*
 * A visualização é o modo exibição: não pode mostrar nada que entregue o
 * sandbox, então os estados vazios usam os textos da página real.
 */

/** "AAAA-MM-DD" como data local (sem o deslocamento de fuso do `new Date`). */
function formatYmd(ymd: string, pattern: string) {
  if (!ymd) return ""
  const date = parseISO(ymd)
  return Number.isNaN(date.getTime())
    ? ymd
    : format(date, pattern, { locale: ptBR })
}

/* ============================================================
   Hero
   ============================================================ */

export function SandboxHero({ campaign }: { campaign: SandboxCampaign }) {
  const { maskText } = useMaskedCurrency()
  const status =
    CAMPAIGN_STATUS_CONFIG[campaign.status] ?? CAMPAIGN_STATUS_CONFIG.DRAFT!
  const prize = campaign.totalPrize.trim()

  return (
    <DarkScope className="contents">
      <section className="relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7 lg:p-8">
        <CompetitionHeroBackdrop />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row">
          {/* Capa */}
          {campaign.coverImageUrl && (
            <div className="relative aspect-square w-full shrink-0 self-start overflow-hidden rounded-2xl ring-2 ring-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] sm:w-56 lg:w-64">
              <ClipThumbnail
                src={campaign.coverImageUrl}
                alt={campaign.name}
                fill
                sizes="(max-width: 640px) 100vw, 256px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("gap-1.5 rounded-full", status.badge)}
              >
                <span
                  className={cn(
                    "size-1.5 animate-pulse rounded-full",
                    status.dot,
                  )}
                />
                {status.label}
              </Badge>
              {campaign.rankingMetricType === "VIEWS_X_ENGAGEMENT" && (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-orange-500/20 text-fuchsia-500 dark:text-fuchsia-300"
                >
                  <Lightning className="size-3" weight="fill" />
                  Views × Engajamento
                </Badge>
              )}
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 rounded-full",
                  campaign.isPrivate
                    ? "border-red-500/40 bg-red-500/15 text-red-400"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                )}
              >
                {campaign.isPrivate ? (
                  <Lock className="size-3" weight="fill" />
                ) : (
                  <Globe className="size-3" weight="fill" />
                )}
                {campaign.isPrivate ? "Privada" : "Pública"}
              </Badge>
              {campaign.isProOnly && (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-violet-500/40 bg-violet-500/15 text-violet-400"
                >
                  <Crown className="size-3" weight="fill" />
                  Exclusivo PRO
                </Badge>
              )}
            </div>

            <h1 className="text-gradient w-fit text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
              {campaign.name}
            </h1>

            {campaign.description && (
              <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-line text-[#8aa3b3] sm:text-base">
                {campaign.description}
              </p>
            )}

            {/* Plataformas */}
            {campaign.platforms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {campaign.platforms.map((platform) => {
                  const config = platformConfig[platform]
                  const PlatformIcon = config.icon
                  return (
                    <Badge
                      key={platform}
                      variant="outline"
                      className={cn(
                        "gap-1 rounded-full",
                        config.borderColor,
                        config.bgColor,
                        config.color,
                      )}
                    >
                      <PlatformIcon className="size-3" />
                      {config.label}
                    </Badge>
                  )
                })}
              </div>
            )}

            {/* Hashtags e menções */}
            {(campaign.requiredHashtags.length > 0 ||
              campaign.requiredMentions.length > 0) && (
              <div className="flex flex-col gap-1.5">
                {campaign.requiredHashtags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8aa3b3]">
                      <Hash className="size-3.5 text-violet-400" />
                      Hashtags obrigatórias:
                    </span>
                    {campaign.requiredHashtags.map((tag, index) => (
                      <Badge
                        key={`${tag}-${index}`}
                        variant="outline"
                        className="rounded-full border-violet-500/30 bg-violet-500/10 text-[11px] text-violet-400"
                      >
                        #{tag.replace(/^#/, "")}
                      </Badge>
                    ))}
                  </div>
                )}
                {campaign.requiredMentions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8aa3b3]">
                      <At className="size-3.5 text-cyan-400" />
                      Menções obrigatórias:
                    </span>
                    {campaign.requiredMentions.map((mention, index) => (
                      <Badge
                        key={`${mention}-${index}`}
                        variant="outline"
                        className="rounded-full border-cyan-500/30 bg-cyan-500/10 text-[11px] text-cyan-400"
                      >
                        @{mention.replace(/^@/, "")}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Período + prêmio */}
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
              <span className="inline-flex items-center gap-1.5 text-sm text-[#8aa3b3]">
                <CalendarBlank className="size-4" />
                {formatYmd(campaign.startDate, "dd 'de' MMMM 'de' yyyy")} –{" "}
                {formatYmd(campaign.endDate, "dd 'de' MMMM 'de' yyyy")}
              </span>
              {prize && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-3 py-1 text-sm font-bold text-amber-500 dark:text-amber-400">
                  <Sparkle className="size-4" weight="fill" />
                  {maskText(formatPrizeLabel(prize))}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
    </DarkScope>
  )
}

/* ============================================================
   KPIs
   ============================================================ */

export function SandboxKpis({ stats }: { stats: SandboxStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatTile
        icon={<Eye className="size-4" weight="fill" />}
        label="Total de Views"
        value={stats.totalViews}
        kind="compact"
        hint={`${formatNumber(stats.totalPosts)} posts submetidos`}
        accent="gradient"
        gradientValue
      />
      <StatTile
        icon={<UsersThree className="size-4" weight="fill" />}
        label="Clipadores Ativos"
        value={stats.totalClippers}
        kind="int"
        hint="participantes aprovados"
        accent="green"
      />
      <StatTile
        icon={<Heart className="size-4" weight="fill" />}
        label="Total de Likes"
        value={stats.totalLikes}
        kind="compact"
        hint="engajamento total"
        accent="cyan"
      />
      <StatTile
        icon={<Play className="size-4" weight="fill" />}
        label="Total de Posts"
        value={stats.totalPosts}
        kind="compact"
        hint="posts submetidos"
        accent="cyan"
      />
    </div>
  )
}

/* ============================================================
   Visão Geral
   ============================================================ */

export function SandboxOverview({ data }: { data: SandboxData }) {
  const { prizes } = data
  const hasPrizes =
    prizes.dailyEnabled || prizes.monthlyEnabled || prizes.bonusEnabled
  const hasCharts =
    data.platformDistribution.some((row) => row.views > 0) ||
    data.growth.length > 0

  return (
    <div className="flex flex-col gap-5">
      {/* A página real só omite os gráficos quando não há dados */}
      {hasCharts && (
        <PlatformCharts
          platformDistribution={data.platformDistribution}
          growthData={data.growth}
          growthPlatforms={data.growthPlatforms}
          engagementRate={data.stats.engagementRate}
        />
      )}
      {hasPrizes && <PrizeCards rule={prizes} />}
    </div>
  )
}

/* ============================================================
   Ranking Mensal
   ============================================================ */

function podiumRowClass(position: number) {
  return cn(
    "flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors sm:p-4",
    position === 1 &&
      "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/5",
    position === 2 &&
      "border-zinc-400/40 bg-gradient-to-r from-zinc-400/10 to-zinc-500/5",
    position === 3 &&
      "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/5",
    position > 3 && "border-border/60 bg-muted/20",
  )
}

function ViewsXEngagementBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-orange-500/20 text-fuchsia-500 dark:text-fuchsia-300"
    >
      <Lightning className="size-3" weight="fill" />
      Views × Engajamento
    </Badge>
  )
}

function ScoreBadge({ score }: { score: number }) {
  return (
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
          {formatMetricFull(score)}
        </span>
      </span>
    </Badge>
  )
}

function ViewsBadge({ views }: { views: number }) {
  return (
    <Badge
      variant="outline"
      className="border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary gap-1.5 rounded-full px-2.5 py-1"
    >
      <Eye className="size-3.5" weight="fill" />
      <span className="text-sm font-bold tabular-nums">
        {formatMetricFull(views)}
      </span>
    </Badge>
  )
}

export function SandboxMonthlyRanking({ data }: { data: SandboxData }) {
  const formatCurrency = useFormatCurrency()
  const rows = data.monthlyRanking
  const metricType = data.campaign.rankingMetricType
  const isViewsXEngagement = metricType === "VIEWS_X_ENGAGEMENT"
  const totalPrize = rows.reduce((sum, row) => sum + row.prize, 0)

  return (
    <section className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/15 text-violet-500 dark:text-violet-400">
            <Trophy className="size-4.5" weight="fill" />
          </span>
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            Ranking Mensal Geral da Competição
          </h2>
          {isViewsXEngagement && <ViewsXEngagementBadge />}
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {isViewsXEngagement
            ? "Score = Views × Taxa de Engajamento (melhor engajamento = mais pontos)"
            : "Desempenho acumulado de todos os clipadores"}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Trophy className="size-6" weight="fill" />}
          title="Nenhum clipper no ranking ainda"
          subtitle="Os clipadores aparecem aqui conforme os posts elegíveis são agregados"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const position = index + 1
            const avgViewsPerPost =
              row.postsCount > 0
                ? Math.round(row.totalViews / row.postsCount)
                : 0
            return (
              <div key={row.id} className={podiumRowClass(position)}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PositionBadge position={position} />
                    <Avatar className="border-border/60 size-11 shrink-0 rounded-2xl border-2 sm:size-12">
                      <AvatarImage
                        src={row.clipperImageUrl || undefined}
                        alt={row.clipperName}
                      />
                      <AvatarFallback className="bg-gradient-custom rounded-2xl text-sm font-bold text-[#04222A]">
                        {row.clipperName.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:text-base">
                        <span className="truncate">{row.clipperName}</span>
                        {row.clanTag && (
                          <span className="text-muted-foreground shrink-0 text-xs font-semibold">
                            [{row.clanTag}]
                          </span>
                        )}
                      </p>
                      {row.clipperUsername && (
                        <p className="text-muted-foreground truncate text-xs">
                          @{row.clipperUsername.replace(/^@/, "")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {row.prize > 0 && (
                      <Badge
                        className={cn(
                          "gap-1 rounded-full border-0 font-bold",
                          position === 1 &&
                            "bg-gradient-to-r from-amber-400 to-yellow-600 text-[#3b2a00]",
                          position === 2 &&
                            "bg-gradient-to-r from-zinc-300 to-zinc-500 text-zinc-900",
                          position === 3 &&
                            "bg-gradient-to-r from-orange-400 to-amber-700 text-[#3b1d00]",
                          position > 3 &&
                            "bg-gradient-to-r from-emerald-500 to-green-600 text-white",
                        )}
                      >
                        <CurrencyDollar className="size-3" weight="bold" />
                        {formatCurrency(row.prize)}
                      </Badge>
                    )}
                    <ViewsBadge views={row.totalViews} />
                    {isViewsXEngagement && (
                      <ScoreBadge
                        score={sandboxRankingScore(metricType, row)}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
                  <StatCell
                    icon={<Play className="size-3" weight="fill" />}
                    label="Posts"
                    value={formatMetricFull(row.postsCount)}
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
                    value={formatNumber(row.totalLikes)}
                    className="text-pink-600 dark:text-pink-400"
                  />
                  <StatCell
                    icon={<ChatCircle className="size-3" weight="fill" />}
                    label="Coment."
                    value={formatNumber(row.totalComments)}
                    className="text-cyan-600 dark:text-cyan-400"
                  />
                  <StatCell
                    icon={<ShareFat className="size-3" weight="fill" />}
                    label="Compart."
                    value={formatNumber(row.totalShares)}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  <StatCell
                    icon={<BookmarkSimple className="size-3" weight="fill" />}
                    label="Saves"
                    value={formatNumber(row.totalSaves)}
                    className="text-amber-600 dark:text-amber-400"
                  />
                  <StatCell
                    icon={<TrendUp className="size-3" weight="bold" />}
                    label="ER"
                    value={`${row.engagementRate.toFixed(2)}%`}
                    className="text-violet-600 dark:text-violet-400"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {data.prizes.monthlyEnabled && rows.length > 0 && (
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
                  Top {data.prizes.monthlyTopCount} posições premiadas
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xl font-bold text-violet-600 tabular-nums sm:text-2xl dark:text-violet-400">
                {formatCurrency(totalPrize)}
              </p>
              <p className="text-muted-foreground text-xs">
                distribuídos este mês
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* ============================================================
   Ranking de Contas
   ============================================================ */

export function SandboxAccountsRanking({ data }: { data: SandboxData }) {
  const rows = data.accountsRanking
  const metricType = data.campaign.rankingMetricType
  const isViewsXEngagement = metricType === "VIEWS_X_ENGAGEMENT"

  return (
    <section className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
            <Pulse className="size-4.5" weight="bold" />
          </span>
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            Ranking de Contas
          </h2>
          {isViewsXEngagement && <ViewsXEngagementBadge />}
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Desempenho de cada perfil por rede social na competição
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Pulse className="size-6" weight="bold" />}
          title="Nenhuma conta no ranking"
          subtitle="As contas aparecem aqui conforme os posts elegíveis são agregados"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const position = index + 1
            const config = platformConfig[row.platform]
            const PlatformIcon = config.icon
            return (
              <div key={row.id} className={podiumRowClass(position)}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <PositionBadge position={position} />
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-2xl border sm:size-12",
                        config.borderColor,
                        config.bgColor,
                        config.color,
                      )}
                    >
                      <PlatformIcon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold sm:text-base">
                        @{row.username.replace(/^@/, "")}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {config.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <ViewsBadge views={row.totalViews} />
                    {isViewsXEngagement && (
                      <ScoreBadge
                        score={sandboxRankingScore(metricType, row)}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
                  <StatCell
                    icon={<Play className="size-3" weight="fill" />}
                    label="Posts"
                    value={formatMetricFull(row.postsCount)}
                    className="text-cyan-600 dark:text-cyan-400"
                  />
                  <StatCell
                    icon={<Heart className="size-3" weight="fill" />}
                    label="Likes"
                    value={formatNumber(row.totalLikes)}
                    className="text-pink-600 dark:text-pink-400"
                  />
                  <StatCell
                    icon={<ChatCircle className="size-3" weight="fill" />}
                    label="Coment."
                    value={formatNumber(row.totalComments)}
                    className="text-cyan-600 dark:text-cyan-400"
                  />
                  <StatCell
                    icon={<ShareFat className="size-3" weight="fill" />}
                    label="Compart."
                    value={formatNumber(row.totalShares)}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  <StatCell
                    icon={<BookmarkSimple className="size-3" weight="fill" />}
                    label="Saves"
                    value={formatNumber(row.totalSaves)}
                    className="text-amber-600 dark:text-amber-400"
                  />
                  <StatCell
                    icon={<TrendUp className="size-3" weight="bold" />}
                    label="ER"
                    value={`${row.engagementRate.toFixed(2)}%`}
                    className="text-violet-600 dark:text-violet-400"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/* ============================================================
   Top Posts
   ============================================================ */

export function SandboxTopPosts({
  data,
  liveThumbnails = {},
}: {
  data: SandboxData
  /** Thumbnail atual de cada post de origem (as do CDN expiram). */
  liveThumbnails?: Record<string, string>
}) {
  const posts = data.topPosts

  return (
    <section className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
      <div className="flex min-w-0 items-center gap-2">
        <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
          <Play className="size-4.5" weight="fill" />
        </span>
        <div className="leading-tight">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            Top Posts
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Os posts com mais views da competição
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          icon={<Play className="size-6" weight="fill" />}
          title="Nenhum post"
          subtitle="Os posts aparecem aqui conforme são enviados"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {posts.map((post, index) => {
            const config = platformConfig[post.platform]
            const PlatformIcon = config.icon
            return (
              <div
                key={post.id}
                className="glass-card glass-card-hover flex flex-col overflow-hidden rounded-2xl"
              >
                <div className="bg-muted/60 relative aspect-[9/16] w-full shrink-0 overflow-hidden">
                  <ClipThumbnail
                    src={
                      post.thumbnailUrl ||
                      liveThumbnails[post.sourcePostId] ||
                      null
                    }
                    alt={`Post de ${post.clipperName}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw"
                    className="object-cover"
                    fallback={<PostPreviewFallback />}
                  />
                  <div className="pointer-events-none absolute top-2 left-2 z-10">
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-white/20 bg-black/60 backdrop-blur-sm"
                    >
                      <PlatformIcon className={cn("size-3", config.color)} />
                    </Badge>
                  </div>
                  <span className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-xs font-black text-white tabular-nums backdrop-blur-md">
                    {index + 1}º
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="text-foreground truncate text-sm font-bold">
                    {post.clipperName || "Clipador"}
                  </p>
                  <p className="text-muted-foreground -mt-1.5 truncate text-xs">
                    @{post.username.replace(/^@/, "")}
                  </p>

                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-lg p-1.5">
                      <Pulse
                        className="text-brand-mint not-dark:text-primary size-3"
                        weight="bold"
                      />
                      <span className="text-brand-mint not-dark:text-primary font-bold tabular-nums">
                        {formatNumber(post.views)}
                      </span>
                    </div>
                    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-lg p-1.5">
                      <Heart className="size-3 text-pink-400" weight="fill" />
                      <span className="font-bold tabular-nums">
                        {formatNumber(post.likes)}
                      </span>
                    </div>
                    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-lg p-1.5">
                      <ChatCircle
                        className="size-3 text-cyan-400"
                        weight="fill"
                      />
                      <span className="font-bold tabular-nums">
                        {formatNumber(post.comments)}
                      </span>
                    </div>
                  </div>

                  {post.postedAt && (
                    <p className="text-muted-foreground text-center text-[10px]">
                      {formatYmdToDmy(post.postedAt)}
                    </p>
                  )}

                  {post.url && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-auto h-8 min-w-0 cursor-pointer rounded-lg px-2 text-xs"
                    >
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ArrowSquareOut className="size-3 shrink-0" />
                        <span className="truncate">Abrir</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
