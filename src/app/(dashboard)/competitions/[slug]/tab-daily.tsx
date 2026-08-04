"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  BookmarkSimple,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChatCircle,
  Check,
  Clock,
  Crown,
  CurrencyDollar,
  Eye,
  Heart,
  Lightning,
  Medal,
  Megaphone,
  Pulse,
  ShareNetwork,
  Spinner,
  TrendUp,
  Users,
  VideoCamera,
  X,
} from "@phosphor-icons/react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { ClanTagBadge } from "@/components/clan-tag-badge"
import { Bone, StatTileSkeleton } from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import {
  DailyRankResultModal,
  type DailyRankPreview,
} from "./daily-rank-result-modal"
import {
  EmptyState,
  MetricPill,
  formatIsoInstantBrasil,
  formatMetricFull,
  formatNumber,
  formatYmdToDmy,
  getDailyRankPickerDateBrasil,
  getDailyRankReferenceDateBrasil,
  useFormatCurrency,
  type CompetitionTabProps,
} from "./shared"

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const

type DailySubTab = "ranking" | "topClippers" | "cronograma"

export function DailyTab({
  slug,
  campaignId,
  data,
  active,
  refetch,
}: CompetitionTabProps) {
  const formatCurrency = useFormatCurrency()

  /* ===== Estado ===== */
  const [dailySubTab, setDailySubTab] = React.useState<DailySubTab>("ranking")
  const [adminDailyRankingDate, setAdminDailyRankingDate] =
    React.useState("current")
  const [scheduleMonth, setScheduleMonth] = React.useState(() => new Date())
  const [scheduleLoadingDate, setScheduleLoadingDate] = React.useState<
    string | null
  >(null)
  const [dailyRankDateModalOpen, setDailyRankDateModalOpen] =
    React.useState(false)
  const [dailyRankCalendarOpen, setDailyRankCalendarOpen] =
    React.useState(false)
  const [dailyRankPreviewDate, setDailyRankPreviewDate] = React.useState(() =>
    getDailyRankPickerDateBrasil(),
  )
  const [dailyRankResultModalOpen, setDailyRankResultModalOpen] =
    React.useState(false)
  const [dailyRankPreviewData, setDailyRankPreviewData] =
    React.useState<DailyRankPreview | null>(null)
  const [markAnnouncedOnPay, setMarkAnnouncedOnPay] = React.useState(true)

  /** Quando true, previewDailyRankByDate só atualiza dados (sem toast nem troca de modal). */
  const silentDailyRankPreviewRef = React.useRef(false)

  const currentDailyReferenceDate = React.useMemo(
    () => getDailyRankReferenceDateBrasil(),
    [],
  )
  const selectedAdminDailyDate =
    adminDailyRankingDate === "current"
      ? currentDailyReferenceDate
      : adminDailyRankingDate

  /**
   * A sub-aba "Top Clipadores" só existe para competições com o ranking
   * de Top Clipadores habilitado (flag da campanha — nada de ID chumbado).
   */
  const isTopClippersEnabled = data.campaign.topClippersRankingEnabled === true

  /* Se a flag for desligada com a sub-aba aberta, volta para "ranking". */
  React.useEffect(() => {
    if (dailySubTab === "topClippers" && !isTopClippersEnabled) {
      setDailySubTab("ranking")
    }
  }, [dailySubTab, isTopClippersEnabled])

  /* ===== Queries ===== */
  const { data: adminDailyRankingHistory } =
    api.campaign.getDailyRankingHistory.useQuery(
      { campaignId },
      {
        enabled:
          active &&
          !!campaignId &&
          (dailySubTab === "ranking" ||
            (dailySubTab === "topClippers" && isTopClippersEnabled)),
      },
    )

  const { data: dailyTopClippers, isLoading: isLoadingDailyTopClippers } =
    api.admin.getDailyTopClippersByPostedVideos.useQuery(
      {
        campaignId,
        date: selectedAdminDailyDate || currentDailyReferenceDate,
        limit: 50,
      },
      {
        enabled:
          active &&
          !!campaignId &&
          !!selectedAdminDailyDate &&
          dailySubTab === "topClippers" &&
          isTopClippersEnabled,
        placeholderData: (prev) => prev,
      },
    )

  const {
    data: adminDailyRankingByDate,
    isFetching: isFetchingAdminDailyRankingByDate,
  } = api.campaign.getDailyRankingByDate.useQuery(
    { campaignId, date: selectedAdminDailyDate || "" },
    {
      enabled:
        active &&
        !!campaignId &&
        !!selectedAdminDailyDate &&
        dailySubTab === "ranking" &&
        adminDailyRankingDate !== "current",
    },
  )

  const { data: calendarData, isLoading: isLoadingCalendar } =
    api.admin.getDailyRankingCalendar.useQuery(
      { campaignId },
      {
        enabled: active && !!campaignId,
        placeholderData: (prev) => prev,
      },
    )

  /* ===== Mutation: gerar preview do rank diário ===== */
  const previewDailyRankByDate = api.admin.previewDailyRankByDate.useMutation({
    onSuccess: (result) => {
      setScheduleLoadingDate(null)
      setDailyRankPreviewData(result)
      setMarkAnnouncedOnPay(result.announced)
      if (silentDailyRankPreviewRef.current) {
        silentDailyRankPreviewRef.current = false
        return
      }
      setDailyRankDateModalOpen(false)
      setDailyRankResultModalOpen(true)
      toast.success("Ranking gerado")
    },
    onError: (err) => {
      setScheduleLoadingDate(null)
      silentDailyRankPreviewRef.current = false
      toast.error(err.message || "Erro ao gerar ranking diário")
    },
  })

  /**
   * Re-preview SILENCIOSO (usado após pagar/estornar/PIX/desqualificar):
   * atualiza os dados do modal sem toast de sucesso nem troca de modal.
   */
  const refreshPreviewSilently = React.useCallback(
    (options?: { fallbackErrorMessage?: string }) => {
      const dateStr = dailyRankPreviewData?.date
      if (!campaignId || !dateStr) return
      silentDailyRankPreviewRef.current = true
      previewDailyRankByDate.mutate(
        { campaignId, date: dateStr },
        {
          onError: () => {
            silentDailyRankPreviewRef.current = false
            if (options?.fallbackErrorMessage) {
              toast.error(options.fallbackErrorMessage)
            }
          },
        },
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaignId, dailyRankPreviewData?.date],
  )

  /* ===== Dados da lista do dia ===== */
  const adminDailyRankingEntries = React.useMemo(() => {
    if (adminDailyRankingDate === "current") return data.topDailyRanking ?? []
    return adminDailyRankingByDate?.posts ?? []
  }, [
    adminDailyRankingDate,
    data.topDailyRanking,
    adminDailyRankingByDate?.posts,
  ])

  const isViewsXEngagement =
    data.campaign.rankingMetricType === "VIEWS_X_ENGAGEMENT"

  /* ============================================================
     Render
     ============================================================ */
  return (
    <div className="flex flex-col gap-4">
      {/* ===== Sub-tabs pill ===== */}
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
        <div
          role="group"
          aria-label="Seções do ranking diário"
          className="bg-muted/30 border-border/40 flex w-fit items-center gap-1 rounded-full border p-1"
        >
          <button
            type="button"
            aria-pressed={dailySubTab === "ranking"}
            onClick={() => setDailySubTab("ranking")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 sm:px-4",
              dailySubTab === "ranking"
                ? "border border-orange-500/40 bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-600 shadow-sm dark:text-orange-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent",
            )}
          >
            <Lightning className="size-4 shrink-0" weight="fill" />
            <span className="hidden sm:inline">Ranking Diário</span>
            <span className="sm:hidden">Ranking</span>
          </button>
          {isTopClippersEnabled && (
            <button
              type="button"
              aria-pressed={dailySubTab === "topClippers"}
              onClick={() => setDailySubTab("topClippers")}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 sm:px-4",
                dailySubTab === "topClippers"
                  ? "border border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-600 shadow-sm dark:text-emerald-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent",
              )}
            >
              <Users className="size-4 shrink-0" weight="fill" />
              <span className="hidden sm:inline">Top Clipadores</span>
              <span className="sm:hidden">Top</span>
            </button>
          )}
          <button
            type="button"
            aria-pressed={dailySubTab === "cronograma"}
            onClick={() => setDailySubTab("cronograma")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 sm:px-4",
              dailySubTab === "cronograma"
                ? "border border-cyan-500/40 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-600 shadow-sm dark:text-cyan-300"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent",
            )}
          >
            <CalendarBlank className="size-4 shrink-0" weight="fill" />
            <span className="hidden sm:inline">Cronograma</span>
            <span className="sm:hidden">Agenda</span>
          </button>
        </div>
      </div>

      {/* ===== SUB-TAB RANKING ===== */}
      {dailySubTab === "ranking" && (
        <section className="glass-card rounded-3xl p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 text-base font-bold">
                <Lightning
                  className="size-5 text-orange-500 dark:text-orange-400"
                  weight="fill"
                />
                Top Posts do Ranking Diário
                <Badge
                  variant="outline"
                  className="gap-1.5 rounded-full border-orange-500/40 bg-gradient-to-r from-orange-500/15 to-amber-500/15 px-2.5 py-1 text-xs"
                >
                  <TrendUp
                    className="size-3.5 animate-pulse text-orange-500 dark:text-orange-400"
                    weight="bold"
                  />
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {data.todayPostsCount}{" "}
                    {data.todayPostsCount === 1 ? "post hoje" : "posts hoje"}
                  </span>
                </Badge>
                {isViewsXEngagement && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-orange-500/20 text-fuchsia-600 dark:text-fuchsia-300"
                  >
                    <Lightning className="size-3" weight="fill" />
                    Views × Engajamento
                  </Badge>
                )}
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {isViewsXEngagement
                  ? "Ranking por views multiplicado pela taxa de engajamento"
                  : "Vídeos desde 20h de ontem que mais performaram"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Select
                value={adminDailyRankingDate}
                onValueChange={setAdminDailyRankingDate}
              >
                <SelectTrigger className="h-9 w-[190px] cursor-pointer rounded-xl">
                  <SelectValue placeholder="Selecionar dia" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="current">
                    Atual ({formatYmdToDmy(currentDailyReferenceDate)})
                  </SelectItem>
                  {(adminDailyRankingHistory ?? []).map((item) => (
                    <SelectItem key={item.date} value={item.date}>
                      {formatYmdToDmy(item.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
                onClick={() => setDailyRankDateModalOpen(true)}
              >
                <Lightning className="size-3.5" weight="fill" />
                Gerar rank diário
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className="mt-4">
            {isFetchingAdminDailyRankingByDate ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="border-border/60 bg-muted/10 flex items-center gap-2 rounded-2xl border-2 p-3 sm:gap-4 sm:p-4"
                  >
                    {/* posição */}
                    <Bone
                      delay={index * 110}
                      className="size-8 shrink-0 rounded-full sm:size-10"
                    />
                    {/* thumbnail do post */}
                    <Bone
                      delay={index * 110 + 40}
                      className="h-20 w-14 shrink-0 rounded-xl sm:h-32 sm:w-20"
                    />
                    {/* clipador */}
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                      <Bone
                        delay={index * 110 + 80}
                        className="size-8 shrink-0 rounded-full sm:size-10 md:size-12"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Bone
                          delay={index * 110 + 120}
                          className="h-3.5 w-2/5 max-w-40"
                        />
                        <Bone
                          delay={index * 110 + 160}
                          className="h-3 w-1/4 max-w-24 rounded-full"
                        />
                        <Bone
                          delay={index * 110 + 200}
                          className="h-3 w-1/3 max-w-28 rounded-full"
                        />
                      </div>
                    </div>
                    {/* prêmio + ver post (desktop) */}
                    <div className="hidden shrink-0 items-center gap-2 md:flex">
                      <Bone
                        delay={index * 110 + 240}
                        className="h-7 w-24 rounded-full"
                      />
                      <Bone
                        delay={index * 110 + 280}
                        className="h-9 w-28 rounded-xl"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : adminDailyRankingEntries.length === 0 ? (
              <EmptyState
                icon={<Lightning className="size-6" weight="fill" />}
                title="Nenhum post desde 20h de ontem ainda"
                subtitle="Os posts aparecem aqui conforme entram na janela do ranking diário."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {adminDailyRankingEntries.map((entry) => {
                  const platformInfo = entry.platform
                    ? platformConfig[entry.platform as PlatformKey]
                    : undefined
                  const PlatformIcon = platformInfo?.icon
                  const dailyPrize = Number(entry.prize ?? 0)
                  const postUrl =
                    (entry as { postUrl?: string }).postUrl ?? ""

                  return (
                    <div
                      key={`${entry.position}-${entry.postId}`}
                      className={cn(
                        "flex flex-col gap-3 rounded-2xl border-2 p-3 transition-all hover:scale-[1.01] sm:p-4",
                        entry.position === 1 &&
                          "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/10",
                        entry.position === 2 &&
                          "border-zinc-400/40 bg-gradient-to-r from-zinc-400/10 to-zinc-500/10",
                        entry.position === 3 &&
                          "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/10",
                        entry.position > 3 && "border-border/60 bg-muted/10",
                      )}
                    >
                      {/* Linha principal */}
                      <div className="flex items-start gap-2 sm:items-center sm:gap-4">
                        {/* Posição */}
                        <div className="flex shrink-0 flex-col items-center gap-0.5 sm:gap-1">
                          {entry.position === 1 && (
                            <Crown
                              className="size-4 text-amber-400 sm:size-6"
                              weight="fill"
                            />
                          )}
                          {entry.position === 2 && (
                            <Medal
                              className="size-4 text-zinc-400 sm:size-6"
                              weight="fill"
                            />
                          )}
                          {entry.position === 3 && (
                            <Medal
                              className="size-4 text-orange-500 sm:size-6"
                              weight="fill"
                            />
                          )}
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full border text-sm font-bold sm:size-10 sm:text-lg",
                              entry.position === 1 &&
                                "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400",
                              entry.position === 2 &&
                                "border-zinc-400 bg-zinc-400/20 text-zinc-600 dark:text-zinc-300",
                              entry.position === 3 &&
                                "border-orange-500 bg-orange-500/20 text-orange-600 dark:text-orange-400",
                              entry.position > 3 &&
                                "border-border/60 bg-muted/40 text-foreground/80",
                            )}
                          >
                            {entry.position}
                          </span>
                        </div>

                        {/* Thumbnail + plataforma */}
                        <div className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-20">
                          {entry.thumbnailUrl ? (
                            <Image
                              src={entry.thumbnailUrl}
                              alt={`Post por @${entry.username}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 56px, 80px"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <VideoCamera className="text-muted-foreground size-5 sm:size-6" />
                            </div>
                          )}
                          {PlatformIcon && platformInfo && (
                            <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1">
                              <span className="flex items-center justify-center rounded-md border border-white/20 bg-black/60 p-1 backdrop-blur-sm">
                                <PlatformIcon
                                  className={cn(
                                    "size-2 sm:size-2.5",
                                    platformInfo.color,
                                  )}
                                />
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Clipador */}
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                          <Avatar className="border-primary/20 size-8 shrink-0 border-2 sm:size-10 md:size-12">
                            <AvatarImage
                              src={entry.clipperImageUrl ?? undefined}
                            />
                            <AvatarFallback className="text-xs sm:text-sm">
                              {entry.clipperName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-semibold sm:text-base">
                                {entry.clipperName}
                              </p>
                              {entry.clanTag && (
                                <ClanTagBadge
                                  tag={entry.clanTag}
                                  emoji={entry.clanEmoji ?? "Shield"}
                                  emojiColor={
                                    entry.clanEmojiColor ?? "#6b7280"
                                  }
                                  size="xs"
                                />
                              )}
                            </div>
                            <p className="text-muted-foreground truncate text-xs sm:text-sm">
                              @{entry.username}
                            </p>
                            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-[10px] sm:gap-3 sm:text-xs">
                              <span className="flex items-center gap-0.5 sm:gap-1">
                                <CalendarBlank className="size-2.5 sm:size-3" />
                                {formatInTimeZone(
                                  new Date(entry.postedAt),
                                  "America/Sao_Paulo",
                                  "dd/MM",
                                  { locale: ptBR },
                                )}
                              </span>
                              <span className="text-primary flex items-center gap-0.5 font-semibold sm:gap-1">
                                <Clock className="size-2.5 sm:size-3" />
                                {formatInTimeZone(
                                  new Date(entry.postedAt),
                                  "America/Sao_Paulo",
                                  "HH:mm",
                                  { locale: ptBR },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Desktop: prêmio + ver post */}
                        <div className="hidden shrink-0 items-center gap-2 md:flex">
                          {dailyPrize > 0 && (
                            <Badge
                              className={cn(
                                "gap-1.5 border-0 px-2 py-1 text-sm font-bold",
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
                              <CurrencyDollar className="size-3.5" weight="bold" />
                              {formatCurrency(dailyPrize)}
                            </Badge>
                          )}
                          {postUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="cursor-pointer gap-2 rounded-xl"
                            >
                              <a
                                href={postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ArrowSquareOut className="size-4" />
                                <span className="hidden lg:inline">
                                  Ver Post
                                </span>
                              </a>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-2 rounded-xl"
                              disabled
                            >
                              <ArrowSquareOut className="size-4" />
                              <span className="hidden lg:inline">Ver Post</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Linha de métricas */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary gap-1 rounded-full px-2 py-1"
                        >
                          <Eye className="size-3 sm:size-3.5" weight="fill" />
                          <span className="text-xs font-bold sm:text-sm">
                            {formatNumber(entry.views)}
                          </span>
                        </Badge>

                        {isViewsXEngagement &&
                          entry.rankingScore !== undefined && (
                            <Badge
                              variant="outline"
                              className="gap-1.5 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/15 to-orange-500/15 px-2 py-1"
                            >
                              <Pulse
                                className="size-3 text-fuchsia-500 dark:text-fuchsia-400"
                                weight="bold"
                              />
                              <span className="flex flex-col items-start leading-none">
                                <span className="text-muted-foreground text-[8px] sm:text-[9px]">
                                  Score
                                </span>
                                <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-500 bg-clip-text text-[10px] font-bold text-transparent sm:text-xs dark:from-violet-400 dark:via-fuchsia-400 dark:to-orange-400">
                                  {Math.round(
                                    entry.rankingScore,
                                  ).toLocaleString("pt-BR")}
                                </span>
                              </span>
                            </Badge>
                          )}

                        {isViewsXEngagement &&
                          entry.engagementRate !== undefined && (
                            <Badge
                              variant="outline"
                              className="hidden gap-1 rounded-full border-violet-500/40 bg-violet-500/10 px-1.5 py-1 text-violet-600 sm:flex dark:text-violet-400"
                            >
                              <TrendUp className="size-3" weight="bold" />
                              <span className="text-xs font-semibold">
                                {entry.engagementRate.toFixed(2)}%
                              </span>
                            </Badge>
                          )}

                        {/* Stats inline — desktop */}
                        <div className="ml-2 hidden items-center gap-2 lg:flex">
                          <MetricPill
                            icon={<Heart className="size-3" weight="fill" />}
                            value={formatNumber(entry.likes)}
                          />
                          <MetricPill
                            icon={<ChatCircle className="size-3" weight="fill" />}
                            value={formatNumber(entry.comments)}
                          />
                          <MetricPill
                            icon={<ShareNetwork className="size-3" weight="fill" />}
                            value={formatNumber(entry.shares)}
                          />
                          <MetricPill
                            icon={
                              <BookmarkSimple className="size-3" weight="fill" />
                            }
                            value={formatNumber(entry.saves ?? 0)}
                          />
                        </div>

                        {/* Mobile: prêmio */}
                        {dailyPrize > 0 && (
                          <Badge
                            className={cn(
                              "gap-1 border-0 px-1.5 py-1 text-xs font-bold md:hidden",
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
                            {formatCurrency(dailyPrize)}
                          </Badge>
                        )}

                        {/* Mobile: ver post */}
                        {postUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="ml-auto h-7 cursor-pointer gap-1 rounded-lg px-2 md:hidden"
                          >
                            <a
                              href={postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ArrowSquareOut className="size-3" />
                              <span className="text-xs">Ver</span>
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto h-7 gap-1 rounded-lg px-2 md:hidden"
                            disabled
                          >
                            <ArrowSquareOut className="size-3" />
                            <span className="text-xs">Ver</span>
                          </Button>
                        )}
                      </div>

                      {/* Mobile: engajamento */}
                      <div className="border-border/50 flex flex-wrap items-center gap-2 border-t pt-2 lg:hidden">
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-pink-500/30 bg-pink-500/10 text-[10px] text-pink-600 sm:text-xs dark:text-pink-400"
                        >
                          <Heart className="size-2.5 sm:size-3" weight="fill" />
                          {formatNumber(entry.likes)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-600 sm:text-xs dark:text-cyan-400"
                        >
                          <ChatCircle
                            className="size-2.5 sm:size-3"
                            weight="fill"
                          />
                          {formatNumber(entry.comments)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 sm:text-xs dark:text-emerald-400"
                        >
                          <ShareNetwork
                            className="size-2.5 sm:size-3"
                            weight="fill"
                          />
                          {formatNumber(entry.shares)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 sm:text-xs dark:text-amber-400"
                        >
                          <BookmarkSimple
                            className="size-2.5 sm:size-3"
                            weight="fill"
                          />
                          {formatNumber(entry.saves ?? 0)}
                        </Badge>
                        {isViewsXEngagement &&
                          entry.engagementRate !== undefined && (
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-600 sm:hidden dark:text-violet-400"
                            >
                              <TrendUp className="size-2.5" weight="bold" />
                              {entry.engagementRate.toFixed(2)}%
                            </Badge>
                          )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Total de Premiação Diária */}
            {data.rankingRule?.dailyEnabled &&
              adminDailyRankingEntries.length > 0 && (
                <div className="mt-4 rounded-2xl border-2 border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-500/10 p-3 sm:mt-6 sm:p-4">
                  <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 p-2 sm:p-2.5">
                        <Lightning
                          className="size-4 text-white sm:size-5"
                          weight="fill"
                        />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-orange-600 sm:text-sm dark:text-orange-400">
                          Total em Premiação Diária
                        </p>
                        <p className="text-muted-foreground text-[10px] sm:text-xs">
                          Top {data.rankingRule.dailyTopCount} posições
                          premiadas
                        </p>
                      </div>
                    </div>
                    <div className="w-full text-left sm:w-auto sm:text-right">
                      <p className="text-xl font-bold text-orange-600 sm:text-2xl dark:text-orange-400">
                        {formatCurrency(data.rankingRule.dailyTotalPrize || 0)}
                      </p>
                      <p className="text-muted-foreground text-[10px] sm:text-xs">
                        distribuídos por dia
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </section>
      )}

      {/* ===== SUB-TAB TOP CLIPADORES ===== */}
      {dailySubTab === "topClippers" && isTopClippersEnabled && (
        <section className="glass-card rounded-3xl p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 text-base font-bold">
                <Users
                  className="size-5 shrink-0 text-emerald-500 dark:text-emerald-400"
                  weight="fill"
                />
                Top Clipadores por Vídeos Postados
                {dailyTopClippers && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 px-2.5 py-1 text-xs"
                  >
                    <VideoCamera
                      className="size-3.5 text-emerald-500 dark:text-emerald-400"
                      weight="fill"
                    />
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatMetricFull(
                        dailyTopClippers.stats.totalPostsInWindow,
                      )}{" "}
                      vídeos
                    </span>
                  </Badge>
                )}
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Clipadores com mais vídeos elegíveis nesta competição, na janela
                diária 20h-20h.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Select
                value={adminDailyRankingDate}
                onValueChange={setAdminDailyRankingDate}
              >
                <SelectTrigger
                  aria-label="Selecionar dia do Top Clipadores"
                  className="h-9 w-[190px] cursor-pointer rounded-xl"
                >
                  <SelectValue placeholder="Selecionar dia" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="current">
                    Atual ({formatYmdToDmy(currentDailyReferenceDate)})
                  </SelectItem>
                  {(adminDailyRankingHistory ?? []).map((item) => (
                    <SelectItem key={item.date} value={item.date}>
                      {formatYmdToDmy(item.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="mt-4">
            {isLoadingDailyTopClippers ? (
              <div className="animate-in fade-in flex flex-col gap-4 duration-500">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <StatTileSkeleton
                      key={`tc-stat-skel-${index}`}
                      delay={index * 100}
                    />
                  ))}
                </div>
                <Bone className="h-4 w-56 max-w-full rounded-full" />
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={`tc-row-skel-${index}`}
                      className="border-border/60 bg-muted/10 flex items-center gap-2 rounded-2xl border-2 p-3 sm:gap-4 sm:p-4"
                    >
                      <Bone
                        delay={index * 110}
                        className="size-8 shrink-0 rounded-full sm:size-10"
                      />
                      <Bone
                        delay={index * 110 + 40}
                        className="size-9 shrink-0 rounded-full sm:size-12"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Bone
                          delay={index * 110 + 80}
                          className="h-3.5 w-2/5 max-w-40"
                        />
                        <Bone
                          delay={index * 110 + 120}
                          className="h-3 w-1/3 max-w-28 rounded-full"
                        />
                      </div>
                      <Bone
                        delay={index * 110 + 160}
                        className="hidden h-7 w-24 rounded-full sm:block"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : !dailyTopClippers || dailyTopClippers.entries.length === 0 ? (
              <EmptyState
                icon={<Users className="size-6" weight="fill" />}
                title="Nenhum vídeo elegível nesta competição durante a janela"
                subtitle="Os clipadores aparecem aqui conforme postam vídeos elegíveis entre 20h e 20h."
              />
            ) : (
              <div className="flex flex-col gap-4">
                {/* Stats da janela */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
                  <div className="border-border/60 bg-muted/10 rounded-2xl border p-3 text-center">
                    <p className="text-foreground truncate text-lg font-bold sm:text-xl">
                      {formatMetricFull(
                        dailyTopClippers.stats.totalClippersWithPosts,
                      )}
                    </p>
                    <p className="text-muted-foreground text-[10px] tracking-wider uppercase sm:text-xs">
                      Clipadores
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-3 text-center">
                    <p className="truncate text-lg font-bold text-emerald-600 sm:text-xl dark:text-emerald-400">
                      {formatMetricFull(
                        dailyTopClippers.stats.totalPostsInWindow,
                      )}
                    </p>
                    <p className="text-muted-foreground text-[10px] tracking-wider uppercase sm:text-xs">
                      Vídeos
                    </p>
                  </div>
                  <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-3 text-center">
                    <p className="truncate text-lg font-bold text-cyan-600 sm:text-xl dark:text-cyan-400">
                      {formatMetricFull(
                        dailyTopClippers.stats.totalViewsInWindow,
                      )}
                    </p>
                    <p className="text-muted-foreground text-[10px] tracking-wider uppercase sm:text-xs">
                      Views
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-3 text-center">
                    <p className="truncate text-lg font-bold text-amber-600 sm:text-xl dark:text-amber-400">
                      {formatMetricFull(dailyTopClippers.stats.totalCampaigns)}
                    </p>
                    <p className="text-muted-foreground text-[10px] tracking-wider uppercase sm:text-xs">
                      Campanhas
                    </p>
                  </div>
                </div>

                {/* Janela considerada */}
                <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs">
                  <Clock className="size-3.5 shrink-0" />
                  <span>
                    {formatIsoInstantBrasil(dailyTopClippers.windowStart)} →{" "}
                    {formatIsoInstantBrasil(dailyTopClippers.windowEnd)}
                  </span>
                </p>

                {/* Pódio */}
                <div className="flex flex-col gap-3">
                  {dailyTopClippers.entries.map((entry) => (
                    <div
                      key={entry.clipperProfileId}
                      className={cn(
                        "flex flex-col gap-3 rounded-2xl border-2 p-3 transition-all motion-safe:hover:scale-[1.01] sm:p-4",
                        entry.position === 1 &&
                          "border-amber-500/40 bg-gradient-to-r from-amber-500/10 to-yellow-500/10",
                        entry.position === 2 &&
                          "border-zinc-400/40 bg-gradient-to-r from-zinc-400/10 to-zinc-500/10",
                        entry.position === 3 &&
                          "border-orange-500/40 bg-gradient-to-r from-orange-500/10 to-amber-700/10",
                        entry.position > 3 && "border-border/60 bg-muted/10",
                      )}
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-4">
                        {/* Posição */}
                        <div className="flex shrink-0 flex-col items-center gap-0.5 sm:gap-1">
                          {entry.position === 1 && (
                            <Crown
                              className="size-4 text-amber-400 sm:size-6"
                              weight="fill"
                            />
                          )}
                          {entry.position === 2 && (
                            <Medal
                              className="size-4 text-zinc-400 sm:size-6"
                              weight="fill"
                            />
                          )}
                          {entry.position === 3 && (
                            <Medal
                              className="size-4 text-orange-500 sm:size-6"
                              weight="fill"
                            />
                          )}
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-full border text-sm font-bold sm:size-10 sm:text-lg",
                              entry.position === 1 &&
                                "border-amber-500 bg-amber-500/20 text-amber-600 dark:text-amber-400",
                              entry.position === 2 &&
                                "border-zinc-400 bg-zinc-400/20 text-zinc-600 dark:text-zinc-300",
                              entry.position === 3 &&
                                "border-orange-500 bg-orange-500/20 text-orange-600 dark:text-orange-400",
                              entry.position > 3 &&
                                "border-border/60 bg-muted/40 text-foreground/80",
                            )}
                          >
                            {entry.position}
                          </span>
                        </div>

                        {/* Clipador */}
                        <Avatar className="border-primary/20 size-9 shrink-0 border-2 sm:size-12">
                          <AvatarImage src={entry.imageUrl ?? undefined} />
                          <AvatarFallback className="text-xs sm:text-sm">
                            {entry.clipperName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold sm:text-base">
                            {entry.clipperName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {entry.fullName}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-600 dark:text-emerald-400"
                            >
                              <VideoCamera
                                className="size-3 sm:size-3.5"
                                weight="fill"
                              />
                              <span className="text-xs font-bold sm:text-sm">
                                {formatMetricFull(entry.totalPosts)}
                              </span>
                              <span className="text-[10px] sm:text-xs">
                                vídeos
                              </span>
                            </Badge>
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-600 dark:text-cyan-400"
                            >
                              <Eye
                                className="size-3 sm:size-3.5"
                                weight="fill"
                              />
                              <span className="text-xs font-bold sm:text-sm">
                                {formatMetricFull(entry.totalViews)}
                              </span>
                              <span className="text-[10px] sm:text-xs">
                                views
                              </span>
                            </Badge>
                            {entry.prize > 0 && (
                              <Badge
                                className={cn(
                                  "gap-1 border-0 px-2 py-1 text-xs font-bold sm:text-sm",
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
                                <CurrencyDollar
                                  className="size-3 sm:size-3.5"
                                  weight="bold"
                                />
                                {formatCurrency(entry.prize)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Breakdown por competição */}
                      {entry.campaigns.length > 0 && (
                        <div className="border-border/50 flex flex-wrap gap-1.5 border-t pt-2">
                          {entry.campaigns.map((campaignBreakdown) => (
                            <Badge
                              key={campaignBreakdown.campaignId}
                              variant="outline"
                              className="border-border/60 bg-muted/20 text-muted-foreground flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] sm:text-xs"
                            >
                              <span className="min-w-0 truncate">
                                {campaignBreakdown.campaignName}
                              </span>
                              <span className="text-foreground shrink-0 font-semibold">
                                {formatMetricFull(campaignBreakdown.posts)}{" "}
                                vídeos
                              </span>
                              <span className="text-foreground/70 hidden shrink-0 font-medium sm:inline">
                                · {formatNumber(campaignBreakdown.views)} views
                              </span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== SUB-TAB CRONOGRAMA ===== */}
      {dailySubTab === "cronograma" && (
        <section className="glass-card rounded-3xl p-4 sm:p-6">
          {/* Header + legenda */}
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold">
                <CalendarBlank
                  className="size-5 text-cyan-500 dark:text-cyan-400"
                  weight="fill"
                />
                Cronograma Completo
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Visualize o status de pagamento de cada dia da competição
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                Pago
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full bg-amber-500" />
                Parcial
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full bg-rose-500" />
                Pgto Pendente
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="bg-muted-foreground/30 size-2.5 rounded-full" />
                Sem ranking
              </span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Megaphone
                  className="size-2.5 text-indigo-500 dark:text-indigo-400"
                  weight="fill"
                />
                Divulgado
              </span>
            </div>
          </div>

          <div className="mt-4">
            {isLoadingCalendar ? (
              <div className="animate-in fade-in space-y-4 duration-500">
                {/* Nav fantasma */}
                <div className="flex items-center justify-between px-1">
                  <Bone className="size-9 rounded-xl" />
                  <Bone delay={80} className="h-6 w-44" />
                  <Bone delay={160} className="size-9 rounded-xl" />
                </div>
                {/* Headers dos dias da semana */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {WEEK_DAYS.map((d) => (
                    <div
                      key={d}
                      className="text-muted-foreground/40 py-2 text-center text-[10px] font-semibold tracking-wider uppercase sm:text-xs"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {/* Células fantasma do calendário */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {Array.from({ length: 35 }).map((_, index) => (
                    <Bone
                      key={`skel-${index}`}
                      delay={index * 35}
                      className={cn(
                        "h-20 rounded-xl sm:h-24",
                        (index < 3 || index > 31) && "opacity-40",
                      )}
                    />
                  ))}
                </div>
                {/* Resumo fantasma */}
                <div className="grid grid-cols-2 gap-2 pt-2 sm:gap-3 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <StatTileSkeleton
                      key={`sum-skel-${index}`}
                      delay={index * 100}
                    />
                  ))}
                </div>
              </div>
            ) : (
              (() => {
                const calendarDays = calendarData?.days ?? []
                const dayMap = new Map(
                  calendarDays.map((d) => [d.dateStr, d]),
                )

                const monthStart = startOfMonth(scheduleMonth)
                const monthEnd = endOfMonth(scheduleMonth)
                const calStart = startOfWeek(monthStart, { locale: ptBR })
                const calEnd = endOfWeek(monthEnd, { locale: ptBR })
                const allDays = eachDayOfInterval({
                  start: calStart,
                  end: calEnd,
                })

                return (
                  <div className="space-y-3">
                    {/* Navegação do mês */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setScheduleMonth((prev) => subMonths(prev, 1))
                        }
                        aria-label="Mês anterior"
                        className="hover:bg-muted/60 size-9 cursor-pointer rounded-xl"
                      >
                        <CaretLeft className="size-4" />
                      </Button>
                      <h4 className="text-base font-semibold capitalize sm:text-lg">
                        {format(scheduleMonth, "MMMM 'de' yyyy", {
                          locale: ptBR,
                        })}
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setScheduleMonth((prev) => addMonths(prev, 1))
                        }
                        aria-label="Próximo mês"
                        className="hover:bg-muted/60 size-9 cursor-pointer rounded-xl"
                      >
                        <CaretRight className="size-4" />
                      </Button>
                    </div>

                    {/* Cabeçalho dos dias */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {WEEK_DAYS.map((d) => (
                        <div
                          key={d}
                          className="text-muted-foreground py-2 text-center text-[10px] font-semibold tracking-wider uppercase sm:text-xs"
                        >
                          {d}
                        </div>
                      ))}
                    </div>

                    {/* Grade do calendário */}
                    <div className="grid grid-cols-7 gap-1 sm:gap-2">
                      {allDays.map((day) => {
                        const dateStr = format(day, "yyyy-MM-dd")
                        const dayData = dayMap.get(dateStr)
                        const inMonth = isSameMonth(day, scheduleMonth)
                        const today = isToday(day)

                        let statusColor = "bg-muted/20 border-border/40"
                        let dotColor = ""
                        let statusLabel = ""

                        if (dayData) {
                          if (dayData.paymentStatus === "all_paid") {
                            statusColor =
                              "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60"
                            dotColor = "bg-emerald-500"
                            statusLabel = "Pago"
                          } else if (dayData.paymentStatus === "partial") {
                            statusColor =
                              "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60"
                            dotColor = "bg-amber-500"
                            statusLabel = "Parcial"
                          } else {
                            statusColor =
                              "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60"
                            dotColor = "bg-rose-500"
                            statusLabel = "Pgto Pendente"
                          }
                        }

                        return (
                          <div
                            key={dateStr}
                            className={cn(
                              "relative flex min-h-[72px] flex-col rounded-xl border p-1.5 transition-all duration-200 sm:min-h-[100px] sm:p-2",
                              inMonth
                                ? statusColor
                                : "border-transparent bg-transparent opacity-30",
                              today &&
                                "ring-primary/50 ring-offset-background ring-2 ring-offset-1",
                            )}
                          >
                            {/* Número do dia */}
                            <div className="mb-1 flex items-center justify-between">
                              <span
                                className={cn(
                                  "text-xs font-medium sm:text-sm",
                                  today
                                    ? "text-primary font-bold"
                                    : inMonth
                                      ? "text-foreground"
                                      : "text-muted-foreground",
                                )}
                              >
                                {format(day, "d")}
                              </span>
                              {dayData && dotColor && (
                                <span
                                  className={cn(
                                    "size-2 shrink-0 rounded-full",
                                    dotColor,
                                  )}
                                />
                              )}
                            </div>

                            {/* Conteúdo do dia */}
                            {dayData && inMonth && (
                              <div className="flex flex-1 flex-col justify-between gap-1">
                                <div className="space-y-0.5">
                                  <div className="text-muted-foreground flex items-center gap-1 text-[9px] sm:text-[11px]">
                                    <VideoCamera className="size-2.5 shrink-0 sm:size-3" />
                                    <span className="truncate">
                                      {dayData.totalPosts} posts
                                    </span>
                                  </div>
                                  <div className="text-muted-foreground hidden items-center gap-1 text-[9px] sm:flex sm:text-[11px]">
                                    <CurrencyDollar className="size-2.5 shrink-0 sm:size-3" />
                                    <span className="truncate">
                                      {formatCurrency(
                                        dayData.totalPrizeAmount,
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {/* Status + divulgado + PIX + ação */}
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={cn(
                                      "flex items-center gap-0.5 text-[8px] font-medium sm:text-[10px]",
                                      dayData.paymentStatus === "all_paid"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : dayData.paymentStatus === "partial"
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-rose-600 dark:text-rose-400",
                                    )}
                                  >
                                    <span className="truncate">
                                      {statusLabel}
                                    </span>
                                    {dayData.paymentStatus === "all_paid" ? (
                                      <Check
                                        className="size-2.5 shrink-0 sm:size-3"
                                        weight="bold"
                                      />
                                    ) : (
                                      <X
                                        className="size-2.5 shrink-0 sm:size-3"
                                        weight="bold"
                                      />
                                    )}
                                  </span>
                                  <span
                                    className={cn(
                                      "flex items-center gap-0.5 text-[8px] font-medium sm:text-[10px]",
                                      dayData.announced
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-500/70 dark:text-rose-400/70",
                                    )}
                                  >
                                    <span className="truncate">
                                      {dayData.announced
                                        ? "Divulgado"
                                        : "Não divulgado"}
                                    </span>
                                    {dayData.announced ? (
                                      <Check
                                        className="size-2.5 shrink-0 sm:size-3"
                                        weight="bold"
                                      />
                                    ) : (
                                      <X
                                        className="size-2.5 shrink-0 sm:size-3"
                                        weight="bold"
                                      />
                                    )}
                                  </span>
                                  {data.campaign.dailyPix ? (
                                    <span
                                      className={cn(
                                        "flex items-center gap-0.5 text-[8px] font-medium sm:text-[10px]",
                                        dayData.dailyPixPayoutCompleted
                                          ? "text-sky-600 dark:text-sky-400"
                                          : "text-amber-600/90 dark:text-amber-400/90",
                                      )}
                                    >
                                      <span className="truncate">
                                        {dayData.dailyPixPayoutCompleted
                                          ? "PIX realizado"
                                          : "PIX pendente"}
                                      </span>
                                      {dayData.dailyPixPayoutCompleted ? (
                                        <Check
                                          className="size-2.5 shrink-0 sm:size-3"
                                          weight="bold"
                                        />
                                      ) : (
                                        <X
                                          className="size-2.5 shrink-0 sm:size-3"
                                          weight="bold"
                                        />
                                      )}
                                    </span>
                                  ) : null}
                                  <button
                                    onClick={() => {
                                      setScheduleLoadingDate(dateStr)
                                      setDailyRankPreviewDate(dateStr)
                                      setDailyRankDateModalOpen(false)
                                      if (campaignId) {
                                        previewDailyRankByDate.mutate({
                                          campaignId,
                                          date: dateStr,
                                        })
                                      }
                                    }}
                                    disabled={previewDailyRankByDate.isPending}
                                    className={cn(
                                      "flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-0.5 text-[9px] font-medium transition-all sm:py-1 sm:text-[10px]",
                                      scheduleLoadingDate === dateStr
                                        ? "border-primary/40 bg-primary/20 text-primary border"
                                        : "border-border/50 bg-muted/40 text-foreground/80 hover:bg-muted/60 hover:text-foreground border",
                                      "disabled:cursor-not-allowed disabled:opacity-50",
                                    )}
                                  >
                                    {scheduleLoadingDate === dateStr ? (
                                      <>
                                        <Spinner className="size-2.5 animate-spin sm:size-3" />
                                        <span className="hidden sm:inline">
                                          Gerando...
                                        </span>
                                        <span className="sm:hidden">...</span>
                                      </>
                                    ) : (
                                      "Ver rank"
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}

                            {!dayData && inMonth && (
                              <div className="flex flex-1 items-center justify-center">
                                <span className="text-muted-foreground/40 text-[9px] sm:text-[10px]">
                                  —
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Cards resumo */}
                    {calendarDays.length > 0 && (
                      <div className="border-border/50 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-3 text-center sm:p-4">
                          <p className="text-lg font-bold text-cyan-600 sm:text-2xl dark:text-cyan-400">
                            {calendarDays.length}
                          </p>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">
                            dias com ranking
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-3 text-center sm:p-4">
                          <p className="text-lg font-bold text-emerald-600 sm:text-2xl dark:text-emerald-400">
                            {
                              calendarDays.filter(
                                (d) => d.paymentStatus === "all_paid",
                              ).length
                            }
                          </p>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">
                            dias pagos
                          </p>
                        </div>
                        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-pink-500/10 p-3 text-center sm:p-4">
                          <p className="text-lg font-bold text-rose-600 sm:text-2xl dark:text-rose-400">
                            {
                              calendarDays.filter(
                                (d) => d.paymentStatus === "none",
                              ).length
                            }
                          </p>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">
                            dias pendentes
                          </p>
                        </div>
                        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-3 text-center sm:p-4">
                          <p className="text-lg font-bold text-amber-600 sm:text-2xl dark:text-amber-400">
                            {formatCurrency(
                              calendarDays.reduce(
                                (s, d) => s + d.totalPrizeAmount,
                                0,
                              ),
                            )}
                          </p>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">
                            total em prêmios
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()
            )}
          </div>
        </section>
      )}

      {/* ===== Dialog: Gerar rank diário ===== */}
      <Dialog
        open={dailyRankDateModalOpen}
        onOpenChange={(open) => {
          if (!previewDailyRankByDate.isPending) {
            setDailyRankDateModalOpen(open)
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightning
                className="size-5 text-orange-500 dark:text-orange-400"
                weight="fill"
              />
              Gerar rank diário
            </DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">Informe a data do ranking</span>
              <span className="block">
                Contam posts entre 20h de ontem até 20h deste dia
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Data</Label>
              <Popover
                open={dailyRankCalendarOpen}
                onOpenChange={setDailyRankCalendarOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-11 w-full cursor-pointer justify-start rounded-xl text-left font-normal",
                      !dailyRankPreviewDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarBlank className="text-muted-foreground mr-2 size-4" />
                    {dailyRankPreviewDate
                      ? format(
                          parseISO(dailyRankPreviewDate),
                          "dd 'de' MMMM 'de' yyyy",
                          { locale: ptBR },
                        )
                      : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={
                      dailyRankPreviewDate
                        ? parseISO(dailyRankPreviewDate)
                        : undefined
                    }
                    onSelect={(date) => {
                      if (date) {
                        setDailyRankPreviewDate(format(date, "yyyy-MM-dd"))
                      }
                      setDailyRankCalendarOpen(false)
                    }}
                    locale={ptBR}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setDailyRankDateModalOpen(false)}
              disabled={previewDailyRankByDate.isPending}
            >
              Cancelar
            </Button>
            <Button
              disabled={!campaignId || previewDailyRankByDate.isPending}
              onClick={() => {
                if (!campaignId || !dailyRankPreviewDate) return
                previewDailyRankByDate.mutate({
                  campaignId,
                  date: dailyRankPreviewDate,
                })
              }}
              className="btn-gradient-auth cursor-pointer gap-2 rounded-xl font-semibold"
            >
              {previewDailyRankByDate.isPending ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <Lightning className="size-4" weight="fill" />
              )}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Modal Resultado do Rank Diário ===== */}
      <DailyRankResultModal
        open={dailyRankResultModalOpen}
        onOpenChange={(open) => {
          setDailyRankResultModalOpen(open)
          if (!open) {
            setDailyRankPreviewData(null)
          }
        }}
        slug={slug}
        campaignId={campaignId}
        data={data}
        preview={dailyRankPreviewData}
        markAnnouncedOnPay={markAnnouncedOnPay}
        onMarkAnnouncedChange={setMarkAnnouncedOnPay}
        refreshPreviewSilently={refreshPreviewSilently}
        refetch={refetch}
      />
    </div>
  )
}
