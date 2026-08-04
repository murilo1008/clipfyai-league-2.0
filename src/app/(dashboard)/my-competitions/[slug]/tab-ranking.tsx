"use client"

import * as React from "react"
import Image from "next/image"
import {
  ChatCircle,
  Clock,
  Crown,
  CurrencyDollar,
  Eye,
  Heart,
  Lightning,
  Medal,
  Play,
  Pulse,
  ShareFat,
  Sparkle,
  Spinner,
  TrendUp,
  Trophy,
  Users,
  VideoCamera,
} from "@phosphor-icons/react"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"

import { ClanTagBadge } from "@/components/clan-tag-badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { getPrizeForPosition, parsePrizeTable } from "@/lib/daily-ranking-preview"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import {
  EmptyState,
  formatNumber,
  formatYmdToDmy,
} from "../../competitions/[slug]/shared"
import {
  formatDailyPostTime,
  type CompetitionDetails,
  type DailyRankingItem,
} from "./shared"

/* ============================================================
   Badge "Views × Engajamento" (cabeçalhos dos rankings)
   ============================================================ */

function ViewsXEngagementBadge() {
  return (
    <Badge
      variant="outline"
      className="gap-1 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/15 to-orange-500/15 px-1.5 py-0.5 text-[10px] sm:text-xs"
    >
      <Pulse className="size-3 text-pink-400" weight="bold" />
      <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text font-medium text-transparent">
        Views × Engajamento
      </span>
    </Badge>
  )
}

/* ============================================================
   Item do ranking diário
   ============================================================ */

function DailyRankingRow({
  post,
  isTopPosters,
  isEngagementMetric,
  proLocked,
}: {
  post: DailyRankingItem
  isTopPosters: boolean
  isEngagementMetric: boolean
  proLocked: boolean
}) {
  const { maskBRL } = useMaskedCurrency()
  const dailyPrize = Number(post.prize || 0)
  const topPostersTotal = Number(
    (post as unknown as { totalPosts?: number }).totalPosts ?? 0,
  )

  const prizeBadgeColor =
    post.position === 1
      ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900"
      : post.position === 2
        ? "bg-gradient-to-r from-gray-400 to-gray-500 text-gray-900"
        : post.position === 3
          ? "bg-gradient-to-r from-orange-500 to-amber-600 text-gray-900"
          : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 p-3 transition-all hover:scale-[1.01] sm:p-4",
        post.position === 1 &&
          "border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-amber-500/10",
        post.position === 2 &&
          "border-gray-400/40 bg-gradient-to-r from-gray-400/10 to-gray-500/10",
        post.position === 3 &&
          "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/10",
        post.position > 3 && post.isCurrentUser && "border-primary/40 bg-primary/5",
        post.position > 3 && !post.isCurrentUser && "border-border/60 bg-muted/10",
      )}
    >
      {/* Linha principal: posição, thumb, clipador, prêmio */}
      <div className="flex items-start gap-2 sm:items-center sm:gap-4">
        {/* Posição */}
        <div className="flex shrink-0 flex-col items-center gap-0.5 sm:gap-1">
          {post.position === 1 && (
            <Crown className="size-4 text-yellow-400 sm:size-6" weight="fill" />
          )}
          {post.position === 2 && (
            <Medal className="size-4 text-gray-400 sm:size-6" weight="fill" />
          )}
          {post.position === 3 && (
            <Medal className="size-4 text-orange-500 sm:size-6" weight="fill" />
          )}
          <Badge
            variant="outline"
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-sm font-bold sm:size-10 sm:text-lg",
              post.position === 1 &&
                "border-yellow-500 bg-yellow-500/20 text-yellow-500 dark:text-yellow-400",
              post.position === 2 &&
                "border-gray-400 bg-gray-400/20 text-gray-500 dark:text-gray-300",
              post.position === 3 &&
                "border-orange-500 bg-orange-500/20 text-orange-500 dark:text-orange-400",
              post.isCurrentUser &&
                post.position > 3 &&
                "border-primary bg-primary/20 text-primary",
            )}
          >
            {post.position}
          </Badge>
        </div>

        {/* Thumb vertical */}
        <div className="bg-muted relative h-16 w-12 shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-16 md:h-32 md:w-20">
          {post.thumbnailUrl ? (
            <Image
              src={post.thumbnailUrl}
              alt={`Post por ${post.clipperName}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 48px, (max-width: 768px) 64px, 80px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <VideoCamera className="text-muted-foreground size-5 sm:size-6" />
            </div>
          )}
        </div>

        {/* Clipador */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Avatar className="border-primary/20 size-8 shrink-0 border-2 sm:size-9 md:size-10">
            <AvatarImage src={post.clipperImageUrl || undefined} />
            <AvatarFallback className="text-xs sm:text-sm">
              {post.clipperName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p
                className={cn(
                  "truncate text-xs font-semibold sm:text-sm md:text-base",
                  post.isCurrentUser && "text-primary",
                )}
              >
                {post.clipperName}
              </p>
              {post.clanTag && (
                <ClanTagBadge
                  tag={post.clanTag}
                  emoji={post.clanEmoji ?? ""}
                  emojiColor={post.clanEmojiColor ?? "#8b5cf6"}
                  size="xs"
                  className="shrink-0"
                />
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px] sm:text-xs">
              <Clock className="size-2.5 sm:size-3" />
              {isTopPosters
                ? "Janela 20h-20h (BRT)"
                : formatDailyPostTime(post.postedAt)}
            </p>
          </div>
        </div>

        {/* Prêmio (desktop) */}
        {dailyPrize > 0 && (
          <Badge
            className={cn(
              "hidden shrink-0 gap-1.5 border-0 px-3 py-1.5 text-sm font-bold md:flex",
              prizeBadgeColor,
            )}
          >
            <CurrencyDollar className="size-3.5" weight="bold" />
            <span className={cn(proLocked && "blur-sm select-none")}>
              {maskBRL(dailyPrize)}
            </span>
          </Badge>
        )}
      </div>

      {/* Linha de métricas */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Métrica principal */}
        <Badge
          variant="outline"
          className="border-primary/40 bg-primary/10 text-primary gap-1 px-2 py-1"
        >
          {isTopPosters ? (
            <>
              <VideoCamera className="size-3 sm:size-3.5" weight="fill" />
              <span className="text-xs font-bold sm:text-sm">
                {formatNumber(topPostersTotal)}
              </span>
              <span className="text-primary/80 text-[10px] sm:text-xs">posts</span>
            </>
          ) : (
            <>
              <Eye className="size-3 sm:size-3.5" weight="fill" />
              <span className="text-xs font-bold sm:text-sm">
                {formatNumber(post.views)}
              </span>
            </>
          )}
        </Badge>

        {isTopPosters && (
          <Badge
            variant="outline"
            className="gap-1 border-blue-400/40 bg-blue-500/10 px-2 py-1 text-blue-500 dark:text-blue-300"
          >
            <Eye className="size-3 sm:size-3.5" weight="fill" />
            <span className="text-xs font-bold sm:text-sm">
              {formatNumber(post.views)}
            </span>
            <span className="text-[10px] opacity-80 sm:text-xs">views</span>
          </Badge>
        )}

        {/* ER */}
        {isEngagementMetric && !isTopPosters && (
          <Badge
            variant="outline"
            className="gap-1 border-pink-500/40 bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-2 py-1"
          >
            <TrendUp className="size-3 text-pink-400 sm:size-3.5" weight="bold" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-xs font-bold text-transparent sm:text-sm">
              {post.engagementRate.toFixed(2)}%
            </span>
          </Badge>
        )}

        {/* Score */}
        {isEngagementMetric && !isTopPosters && (
          <Badge
            variant="outline"
            className="gap-1 rounded-md border-fuchsia-500/40 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/15 to-orange-500/15 px-1.5 py-1 sm:gap-1.5 sm:px-2"
          >
            <Sparkle className="size-2.5 text-pink-400 sm:size-3" weight="fill" />
            <span className="flex flex-col items-start">
              <span className="text-muted-foreground text-[8px] leading-none sm:text-[9px]">
                Score
              </span>
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-[10px] font-bold text-transparent sm:text-xs">
                {Math.round(post.rankingScore).toLocaleString("pt-BR")}
              </span>
            </span>
          </Badge>
        )}

        {/* Likes + comments (desktop) */}
        <div className="ml-2 hidden items-center gap-3 lg:flex">
          <span className="flex items-center gap-1 text-xs">
            <Heart className="size-3 text-pink-400" weight="fill" />
            <span className="font-bold text-pink-400">
              {formatNumber(post.likes)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs">
            <ChatCircle className="size-3 text-cyan-400" weight="fill" />
            <span className="font-bold text-cyan-400">
              {formatNumber(post.comments)}
            </span>
          </span>
        </div>

        {/* Prêmio (mobile) */}
        {dailyPrize > 0 && (
          <Badge
            className={cn(
              "ml-auto gap-1 border-0 px-1.5 py-1 text-xs font-bold md:hidden",
              prizeBadgeColor,
            )}
          >
            <CurrencyDollar className="size-3" weight="bold" />
            <span className={cn(proLocked && "blur-sm select-none")}>
              {maskBRL(dailyPrize)}
            </span>
          </Badge>
        )}
      </div>

      {/* Métricas extras (mobile) */}
      <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-2 lg:hidden">
        <Badge
          variant="outline"
          className="gap-1 border-pink-500/30 bg-pink-500/10 text-[10px] text-pink-500 sm:text-xs dark:text-pink-400"
        >
          <Heart className="size-2.5 sm:size-3" weight="fill" />
          {formatNumber(post.likes)}
        </Badge>
        <Badge
          variant="outline"
          className="gap-1 border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-600 sm:text-xs dark:text-cyan-400"
        >
          <ChatCircle className="size-2.5 sm:size-3" weight="fill" />
          {formatNumber(post.comments)}
        </Badge>
        {!!post.shares && post.shares > 0 && (
          <Badge
            variant="outline"
            className="gap-1 border-green-500/30 bg-green-500/10 text-[10px] text-green-600 sm:text-xs dark:text-green-400"
          >
            <ShareFat className="size-2.5 sm:size-3" weight="fill" />
            {formatNumber(post.shares)}
          </Badge>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Item do ranking "Top Clipadores" (por vídeos postados)
   ============================================================ */

type TopClipperEntry =
  RouterOutputs["campaign"]["getDailyTopClippersByPostedVideos"]["entries"][number]

function TopClipperRow({
  entry,
  proLocked,
}: {
  entry: TopClipperEntry
  proLocked: boolean
}) {
  const { maskBRL } = useMaskedCurrency()
  const prize = Number(entry.prize || 0)

  const prizeBadgeColor =
    entry.position === 1
      ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900"
      : entry.position === 2
        ? "bg-gradient-to-r from-gray-400 to-gray-500 text-gray-900"
        : entry.position === 3
          ? "bg-gradient-to-r from-orange-500 to-amber-600 text-gray-900"
          : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 p-3 transition-all hover:scale-[1.01] motion-reduce:transition-none motion-reduce:hover:scale-100 sm:p-4",
        entry.position === 1 &&
          "border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-amber-500/10",
        entry.position === 2 &&
          "border-gray-400/40 bg-gradient-to-r from-gray-400/10 to-gray-500/10",
        entry.position === 3 &&
          "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/10",
        entry.position > 3 && entry.isCurrentUser && "border-primary/40 bg-primary/5",
        entry.position > 3 && !entry.isCurrentUser && "border-border/60 bg-muted/10",
      )}
    >
      <div className="flex items-start gap-2 sm:items-center sm:gap-4">
        {/* Posição */}
        <div className="flex shrink-0 flex-col items-center gap-0.5 sm:gap-1">
          {entry.position === 1 && (
            <Crown className="size-4 text-yellow-400 sm:size-6" weight="fill" />
          )}
          {entry.position === 2 && (
            <Medal className="size-4 text-gray-400 sm:size-6" weight="fill" />
          )}
          {entry.position === 3 && (
            <Medal className="size-4 text-orange-500 sm:size-6" weight="fill" />
          )}
          <Badge
            variant="outline"
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-sm font-bold sm:size-10 sm:text-lg",
              entry.position === 1 &&
                "border-yellow-500 bg-yellow-500/20 text-yellow-500 dark:text-yellow-400",
              entry.position === 2 &&
                "border-gray-400 bg-gray-400/20 text-gray-500 dark:text-gray-300",
              entry.position === 3 &&
                "border-orange-500 bg-orange-500/20 text-orange-500 dark:text-orange-400",
              entry.isCurrentUser &&
                entry.position > 3 &&
                "border-primary bg-primary/20 text-primary",
            )}
          >
            {entry.position}
          </Badge>
        </div>

        {/* Clipador */}
        <Avatar className="border-primary/20 size-9 shrink-0 border-2 sm:size-11">
          <AvatarImage src={entry.imageUrl || undefined} />
          <AvatarFallback className="text-xs font-bold sm:text-sm">
            {entry.clipperName.charAt(0)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className={cn(
                "truncate text-xs font-semibold sm:text-sm md:text-base",
                entry.isCurrentUser && "text-primary",
              )}
            >
              {entry.clipperName}
            </p>
            {entry.isCurrentUser && (
              <Badge
                variant="outline"
                className="border-primary/40 bg-primary/10 text-primary shrink-0 rounded-full px-1.5 py-0 text-[10px] font-semibold"
              >
                Você
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="gap-1 border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-300"
            >
              <VideoCamera className="size-3 sm:size-3.5" weight="fill" />
              <span className="text-xs font-bold sm:text-sm">
                {formatNumber(entry.totalPosts)}
              </span>
              <span className="text-[10px] opacity-80 sm:text-xs">vídeos</span>
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 border-blue-400/40 bg-blue-500/10 px-2 py-1 text-blue-600 dark:text-blue-300"
            >
              <Eye className="size-3 sm:size-3.5" weight="fill" />
              <span className="text-xs font-bold sm:text-sm">
                {formatNumber(entry.totalViews)}
              </span>
              <span className="text-[10px] opacity-80 sm:text-xs">views</span>
            </Badge>

            {/* Prêmio (mobile) */}
            {prize > 0 && (
              <Badge
                className={cn(
                  "gap-1 border-0 px-1.5 py-1 text-xs font-bold md:hidden",
                  prizeBadgeColor,
                )}
              >
                <CurrencyDollar className="size-3" weight="bold" />
                <span className={cn(proLocked && "blur-sm select-none")}>
                  {maskBRL(prize)}
                </span>
              </Badge>
            )}
          </div>
        </div>

        {/* Prêmio (desktop) */}
        {prize > 0 && (
          <Badge
            className={cn(
              "hidden shrink-0 gap-1.5 border-0 px-3 py-1.5 text-sm font-bold md:flex",
              prizeBadgeColor,
            )}
          >
            <CurrencyDollar className="size-3.5" weight="bold" />
            <span className={cn(proLocked && "blur-sm select-none")}>
              {maskBRL(prize)}
            </span>
          </Badge>
        )}
      </div>

      {/* Detalhamento por campanha (só quando houver mais de uma) */}
      {entry.campaigns.length > 1 && (
        <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-2">
          {entry.campaigns.map((campaign) => (
            <Badge
              key={campaign.campaignId}
              variant="outline"
              className="text-muted-foreground max-w-full gap-1.5 px-2 py-1 text-[10px] sm:text-xs"
            >
              <span className="min-w-0 truncate">{campaign.campaignName}</span>
              <span className="text-foreground shrink-0 font-semibold">
                {campaign.posts.toLocaleString("pt-BR")} vídeos
              </span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Tab "Ranking" (sub-tabs Diário / Top Clipadores / Mensal)
   ============================================================ */

export function RankingTab({
  competition,
  isProSubscriber,
}: {
  competition: CompetitionDetails
  isProSubscriber: boolean
}) {
  const { maskBRL } = useMaskedCurrency()
  const proLocked = competition.isProOnly && !isProSubscriber
  const isEngagementMetric =
    competition.rankingMetricType === "VIEWS_X_ENGAGEMENT"

  const [selectedDailyRankingDate, setSelectedDailyRankingDate] =
    React.useState("current")
  const [rankingTab, setRankingTab] = React.useState<
    "daily" | "topClippers" | "monthly"
  >("daily")

  /** Ranking "Top Clipadores" só existe quando a competição o habilita. */
  const topClippersEnabled = competition.topClippersRankingEnabled === true

  /* ===== Histórico de dias + ranking por data ===== */
  const { data: dailyRankingHistory } =
    api.campaign.getDailyRankingHistory.useQuery(
      { campaignId: competition.id },
      { enabled: !!competition.id },
    )

  const selectedDailyDateValue =
    selectedDailyRankingDate === "current"
      ? competition.dailyRankingReferenceDate
      : selectedDailyRankingDate

  const { data: dailyRankingByDate, isFetching: isFetchingDailyRankingByDate } =
    api.campaign.getDailyRankingByDate.useQuery(
      {
        campaignId: competition.id,
        date: selectedDailyDateValue || "",
      },
      {
        enabled:
          !!competition.id &&
          !!selectedDailyDateValue &&
          selectedDailyRankingDate !== "current",
      },
    )

  /* ===== Top Clipadores por vídeos postados (mesma janela 20h-20h) ===== */
  const { data: topClippersData, isFetching: isFetchingTopClippers } =
    api.campaign.getDailyTopClippersByPostedVideos.useQuery(
      {
        campaignId: competition.id,
        date: selectedDailyDateValue || "",
        limit: 50,
      },
      {
        enabled:
          rankingTab === "topClippers" &&
          topClippersEnabled &&
          !!competition.id &&
          !!selectedDailyDateValue,
        placeholderData: (prev) => prev,
      },
    )

  const historyDates = React.useMemo(() => {
    if (dailyRankingHistory && dailyRankingHistory.length > 0) {
      return dailyRankingHistory.map((item) => item.date)
    }
    return competition.dailyRankingDates ?? []
  }, [dailyRankingHistory, competition.dailyRankingDates])

  const rankingDailyPosts: DailyRankingItem[] =
    selectedDailyRankingDate === "current"
      ? (competition.topDailyPosts ?? [])
      : (dailyRankingByDate?.posts ?? [])

  const dailyRankingMode: string =
    selectedDailyRankingDate === "current"
      ? (competition.dailyRankingMode ?? "TOP_POSTS")
      : (dailyRankingByDate?.rankingMode ?? "TOP_POSTS")
  const isTopPosters = dailyRankingMode === "TOP_POSTERS"

  /* ===== Ranking mensal — prêmios cobrindo faixas ("4-10") ===== */
  const monthlyPrizeTable = React.useMemo(
    () => parsePrizeTable(competition.rankingRule?.monthlyPrizeTable ?? null),
    [competition.rankingRule?.monthlyPrizeTable],
  )
  const monthlyEnabled = !!competition.rankingRule?.monthlyEnabled

  return (
    <Tabs
      value={rankingTab}
      onValueChange={(value) =>
        setRankingTab(value as "daily" | "topClippers" | "monthly")
      }
      className="gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold sm:text-xl">Rankings</h3>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {topClippersEnabled
              ? "Confira os rankings diário, de clipadores e mensal da competição"
              : "Confira os rankings diário e mensal da competição"}
          </p>
        </div>
        <div className="-mx-4 w-full overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0 [&::-webkit-scrollbar]:hidden">
          <TabsList className="bg-muted/40 flex h-auto w-max gap-1 rounded-2xl p-1">
            <TabsTrigger
              value="daily"
              className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-500 sm:px-4 sm:text-sm dark:data-[state=active]:text-orange-400"
            >
              <Lightning className="size-3.5" weight="fill" />
              Diário
            </TabsTrigger>
            {topClippersEnabled && (
              <TabsTrigger
                value="topClippers"
                className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-600 sm:px-4 sm:text-sm dark:data-[state=active]:text-emerald-400"
              >
                <Users className="size-3.5" weight="fill" />
                Top Clipadores
              </TabsTrigger>
            )}
            <TabsTrigger
              value="monthly"
              className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-500 sm:px-4 sm:text-sm dark:data-[state=active]:text-violet-400"
            >
              <Trophy className="size-3.5" weight="fill" />
              Mensal
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* ===== Ranking Diário ===== */}
      <TabsContent value="daily">
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg">
                <Lightning className="size-5 text-orange-400" weight="fill" />
                {isTopPosters ? "Top Postadores do Dia" : "Top Posts do Dia"}
                {isEngagementMetric && <ViewsXEngagementBadge />}
              </p>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                {isTopPosters
                  ? "Top clipadores por quantidade de posts no período de 20h a 20h"
                  : isEngagementMetric
                    ? "Ranking por views multiplicado pela taxa de engajamento"
                    : "Vídeos desde 20h de ontem que mais performaram"}
              </p>
            </div>

            {/* Seletor de dia */}
            <Select
              value={selectedDailyRankingDate}
              onValueChange={setSelectedDailyRankingDate}
            >
              <SelectTrigger className="h-9 w-full cursor-pointer rounded-xl sm:w-52">
                <SelectValue placeholder="Selecionar dia" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="current">
                  Atual ({formatYmdToDmy(competition.dailyRankingReferenceDate)})
                </SelectItem>
                {historyDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {formatYmdToDmy(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            {isFetchingDailyRankingByDate ? (
              <div className="text-muted-foreground py-10 text-center">
                <Spinner className="mx-auto mb-2 size-6 animate-spin" />
                <p className="text-sm">Carregando ranking...</p>
              </div>
            ) : rankingDailyPosts.length === 0 ? (
              <EmptyState
                icon={<Lightning className="size-6" weight="fill" />}
                title={
                  isTopPosters
                    ? "Nenhum postador no ranking desta janela"
                    : "Nenhum post no ranking desta janela"
                }
                subtitle="Envie posts para aparecer no ranking do dia"
              />
            ) : (
              rankingDailyPosts.map((post) => (
                <DailyRankingRow
                  key={post.postId || `${post.position}-${post.clipperName}`}
                  post={post}
                  isTopPosters={isTopPosters}
                  isEngagementMetric={isEngagementMetric}
                  proLocked={proLocked}
                />
              ))
            )}
          </div>
        </div>
      </TabsContent>

      {/* ===== Top Clipadores por vídeos postados ===== */}
      {topClippersEnabled && (
        <TabsContent value="topClippers">
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg">
                  <Users
                    className="size-5 text-emerald-500 dark:text-emerald-400"
                    weight="fill"
                  />
                  Top Clipadores por Vídeos Postados
                  {topClippersData && (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 sm:text-xs dark:text-emerald-400"
                    >
                      <VideoCamera className="size-3" weight="fill" />
                      {topClippersData.stats.totalPostsInWindow.toLocaleString(
                        "pt-BR",
                      )}{" "}
                      vídeos
                    </Badge>
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                  Clipadores com mais vídeos elegíveis nesta competição, na janela
                  diária de 20h às 20h (BRT)
                </p>
              </div>

              {/* Seletor de dia */}
              <Select
                value={selectedDailyRankingDate}
                onValueChange={setSelectedDailyRankingDate}
              >
                <SelectTrigger
                  aria-label="Selecionar dia do ranking de clipadores"
                  className="h-9 w-full cursor-pointer rounded-xl sm:w-52"
                >
                  <SelectValue placeholder="Selecionar dia" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="current">
                    Atual ({formatYmdToDmy(competition.dailyRankingReferenceDate)})
                  </SelectItem>
                  {historyDates.map((date) => (
                    <SelectItem key={date} value={date}>
                      {formatYmdToDmy(date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isFetchingTopClippers && !topClippersData ? (
              <div className="text-muted-foreground py-10 text-center">
                <Spinner className="mx-auto mb-2 size-6 animate-spin motion-reduce:animate-none" />
                <p className="text-sm">Carregando top clipadores...</p>
              </div>
            ) : !topClippersData || topClippersData.entries.length === 0 ? (
              <EmptyState
                icon={<Users className="size-6" weight="fill" />}
                title="Nenhum vídeo elegível nesta janela"
                subtitle="Assim que os vídeos forem aprovados, os clipadores aparecem aqui"
              />
            ) : (
              <div
                aria-busy={isFetchingTopClippers}
                className={cn(
                  "flex flex-col gap-4 transition-opacity motion-reduce:transition-none",
                  isFetchingTopClippers && "opacity-60",
                )}
              >
                {/* Resumo da janela */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                  {[
                    {
                      label: "Clipadores",
                      value: topClippersData.stats.totalClippersWithPosts,
                    },
                    {
                      label: "Vídeos",
                      value: topClippersData.stats.totalPostsInWindow,
                    },
                    {
                      label: "Views",
                      value: topClippersData.stats.totalViewsInWindow,
                    },
                    {
                      label: "Campanhas",
                      value: topClippersData.stats.totalCampaigns,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="border-border/60 bg-muted/10 min-w-0 rounded-2xl border px-3 py-2.5 text-center"
                    >
                      <p className="truncate text-sm font-bold tabular-nums sm:text-base">
                        {stat.value.toLocaleString("pt-BR")}
                      </p>
                      <p className="text-muted-foreground truncate text-[9px] tracking-wider uppercase sm:text-[10px]">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[10px] sm:text-xs">
                  <Clock className="size-3 shrink-0" />
                  <span className="truncate">
                    Janela:{" "}
                    {formatInTimeZone(
                      new Date(topClippersData.windowStart),
                      "America/Sao_Paulo",
                      "dd/MM HH:mm",
                      { locale: ptBR },
                    )}{" "}
                    →{" "}
                    {formatInTimeZone(
                      new Date(topClippersData.windowEnd),
                      "America/Sao_Paulo",
                      "dd/MM HH:mm",
                      { locale: ptBR },
                    )}
                  </span>
                </p>

                <div className="flex flex-col gap-3">
                  {topClippersData.entries.map((entry) => (
                    <TopClipperRow
                      key={entry.clipperProfileId}
                      entry={entry}
                      proLocked={proLocked}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      )}

      {/* ===== Ranking Mensal ===== */}
      <TabsContent value="monthly">
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg">
              <Trophy className="size-5 text-violet-400" weight="fill" />
              Ranking Mensal
              {isEngagementMetric && <ViewsXEngagementBadge />}
            </p>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              {isEngagementMetric
                ? "Score = Views × Taxa de Engajamento"
                : "Os melhores clipadores do mês e suas premiações"}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {!competition.topRanking || competition.topRanking.length === 0 ? (
              <EmptyState
                icon={<Trophy className="size-6" weight="fill" />}
                title="Nenhum clipador no ranking ainda"
                subtitle="O ranking mensal aparece assim que os primeiros posts forem contabilizados"
              />
            ) : (
              competition.topRanking.map((entry) => {
                const prize = getPrizeForPosition(
                  monthlyPrizeTable,
                  entry.position,
                )
                const mainMetricLabel = isEngagementMetric ? "Score" : "Views"
                const mainMetricValue =
                  isEngagementMetric && entry.rankingScore !== undefined
                    ? Math.round(entry.rankingScore).toLocaleString("pt-BR")
                    : entry.totalViews.toLocaleString("pt-BR")

                return (
                  <div
                    key={entry.position}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border-2 p-2.5 transition-all hover:scale-[1.01] sm:p-4",
                      entry.position === 1 &&
                        "border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 shadow-lg shadow-yellow-500/10",
                      entry.position === 2 &&
                        "border-gray-400/40 bg-gradient-to-r from-gray-400/10 to-gray-500/10 shadow-lg shadow-gray-500/10",
                      entry.position === 3 &&
                        "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/10 shadow-lg shadow-orange-500/10",
                      entry.position > 3 &&
                        entry.isCurrentUser &&
                        "border-primary/40 bg-gradient-to-r from-primary/10 to-primary/5",
                      entry.position > 3 &&
                        !entry.isCurrentUser &&
                        "border-border/60 bg-muted/10",
                    )}
                  >
                    {entry.position <= 3 && (
                      <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    )}

                    <div className="relative z-10 flex items-center gap-2 sm:gap-3">
                      {/* Posição */}
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        {entry.position === 1 && (
                          <Crown
                            className="size-3 animate-pulse text-yellow-400 sm:size-5"
                            weight="fill"
                          />
                        )}
                        {entry.position === 2 && (
                          <Medal
                            className="size-3 text-gray-400 sm:size-5"
                            weight="fill"
                          />
                        )}
                        {entry.position === 3 && (
                          <Medal
                            className="size-3 text-orange-500 sm:size-5"
                            weight="fill"
                          />
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full text-xs font-bold shadow-lg sm:size-10 sm:text-base",
                            entry.position === 1 &&
                              "border-yellow-500 bg-yellow-500/30 text-yellow-500 shadow-yellow-500/50 dark:text-yellow-400",
                            entry.position === 2 &&
                              "border-gray-400 bg-gray-400/30 text-gray-500 shadow-gray-500/50 dark:text-gray-300",
                            entry.position === 3 &&
                              "border-orange-500 bg-orange-500/30 text-orange-500 shadow-orange-500/50 dark:text-orange-400",
                            entry.isCurrentUser &&
                              entry.position > 3 &&
                              "border-primary bg-primary/30 text-primary",
                            !entry.isCurrentUser &&
                              entry.position > 3 &&
                              "border-muted-foreground/40 bg-muted text-foreground",
                          )}
                        >
                          {entry.position}º
                        </Badge>
                      </div>

                      {/* Avatar + nome */}
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
                        <Avatar className="border-primary/20 size-8 shrink-0 border-2 shadow-lg sm:size-11">
                          <AvatarImage src={entry.imageUrl || undefined} />
                          <AvatarFallback className="text-[10px] font-bold sm:text-base">
                            {entry.username.replace(/^@/, "").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p
                              className={cn(
                                "max-w-[80px] truncate text-[11px] font-bold sm:max-w-none sm:text-sm md:text-base",
                                entry.isCurrentUser && "text-primary",
                              )}
                            >
                              {entry.username}
                            </p>
                            {entry.clanTag && (
                              <ClanTagBadge
                                tag={entry.clanTag}
                                emoji={entry.clanEmoji ?? ""}
                                emojiColor={entry.clanEmojiColor ?? "#8b5cf6"}
                                size="xs"
                                className="shrink-0"
                              />
                            )}
                          </div>

                          {/* Badges secundários (sm+) */}
                          <div className="mt-0.5 hidden flex-wrap items-center gap-1.5 sm:flex">
                            <Badge
                              variant="outline"
                              className="gap-0.5 rounded-full px-1 py-0 text-[9px]"
                            >
                              <Play className="size-2" weight="fill" />
                              {entry.totalPosts}{" "}
                              {entry.totalPosts === 1 ? "post" : "posts"}
                            </Badge>
                            {isEngagementMetric &&
                              entry.engagementRate !== undefined && (
                                <Badge
                                  variant="outline"
                                  className="gap-0.5 rounded-full border-pink-500/30 bg-pink-500/5 px-1 py-0 text-[9px]"
                                >
                                  <TrendUp
                                    className="size-2 text-pink-400"
                                    weight="bold"
                                  />
                                  <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text font-semibold text-transparent">
                                    {entry.engagementRate.toFixed(1)}%
                                  </span>
                                </Badge>
                              )}
                            {isEngagementMetric && (
                              <Badge
                                variant="outline"
                                className="gap-0.5 rounded-full border-blue-500/30 bg-blue-500/5 px-1 py-0 text-[9px]"
                              >
                                <Eye className="size-2 text-blue-400" weight="fill" />
                                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text font-semibold text-transparent">
                                  {entry.totalViews.toLocaleString("pt-BR")}
                                </span>
                              </Badge>
                            )}
                          </div>

                          {/* Mobile: resumo */}
                          <p className="text-muted-foreground mt-0.5 text-[9px] sm:hidden">
                            {entry.totalPosts}{" "}
                            {entry.totalPosts === 1 ? "post" : "posts"}
                            {isEngagementMetric &&
                              entry.engagementRate !== undefined &&
                              ` • ${entry.engagementRate.toFixed(1)}% ER`}
                          </p>
                        </div>
                      </div>

                      {/* Métrica principal + prêmio */}
                      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
                        <div className="flex flex-col items-end sm:items-start">
                          <span
                            className={cn(
                              "text-[7px] leading-none font-medium sm:text-[10px]",
                              isEngagementMetric
                                ? "bg-gradient-to-r from-purple-300 via-pink-300 to-orange-300 bg-clip-text text-transparent"
                                : "text-blue-400/80",
                            )}
                          >
                            {mainMetricLabel}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-black tracking-tight tabular-nums sm:text-lg md:text-xl",
                              isEngagementMetric
                                ? "bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent"
                                : "bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent",
                            )}
                          >
                            {mainMetricValue}
                          </span>
                        </div>

                        {monthlyEnabled && (
                          <>
                            <div className="bg-border/50 h-6 w-px shrink-0 sm:h-8" />
                            <div className="flex flex-col items-end sm:items-start">
                              <span
                                className={cn(
                                  "text-[7px] leading-none font-medium sm:text-[10px]",
                                  entry.position === 1 && "text-yellow-500/80",
                                  entry.position === 2 && "text-gray-400/80",
                                  entry.position === 3 && "text-orange-400/80",
                                  entry.position > 3 && "text-emerald-500/80",
                                )}
                              >
                                Prêmio
                              </span>
                              <span
                                className={cn(
                                  "text-xs font-black tracking-tight tabular-nums sm:text-lg md:text-xl",
                                  entry.position === 1 &&
                                    "bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent",
                                  entry.position === 2 &&
                                    "bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent",
                                  entry.position === 3 &&
                                    "bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent",
                                  entry.position > 3 &&
                                    "bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent",
                                  proLocked && "blur-sm select-none",
                                )}
                              >
                                {maskBRL(prize)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Premiação Total do Mês */}
          {monthlyEnabled && competition.rankingRule && (
            <div className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-pink-500/10 p-3 sm:p-4">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 p-2 sm:p-2.5">
                    <Trophy className="size-4 text-white sm:size-5" weight="fill" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[10px] sm:text-xs">
                      Premiação Total do Mês
                    </p>
                    <p
                      className={cn(
                        "text-lg font-bold text-violet-500 sm:text-xl md:text-2xl dark:text-violet-400",
                        proLocked && "blur-sm select-none",
                      )}
                    >
                      {maskBRL(competition.rankingRule.monthlyTotalPrize)}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-violet-500/40 bg-violet-500/10 text-[10px] text-violet-500 sm:text-xs dark:text-violet-400"
                >
                  <Medal className="size-2.5 sm:size-3" weight="fill" />
                  Top {competition.rankingRule.monthlyTopCount}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
