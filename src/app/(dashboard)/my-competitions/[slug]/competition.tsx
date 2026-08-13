"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowDownRight,
  ArrowSquareOut,
  ArrowUpRight,
  CalendarBlank,
  ChartBar,
  CheckCircle,
  Clock,
  Crown,
  Eye,
  Fire,
  Heart,
  Info,
  Lightning,
  LinkSimple,
  Play,
  Plus,
  Pulse,
  ShieldWarning,
  Sparkle,
  Target,
  TrendUp,
  Trophy,
  UsersThree,
  VideoCamera,
  Wallet,
} from "@phosphor-icons/react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"

import { CreatePostDialog } from "@/components/clippers/create-post-dialog"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import {
  CAMPAIGN_STATUS_CONFIG,
  EmptyState,
  formatDateLong,
  formatNumber,
} from "../../competitions/[slug]/shared"
import { AddAccountsDialog, CreateAccountDialog } from "./add-accounts-dialog"
import { AffiliateLinksDialog } from "./affiliate-links-dialog"
import { CompetitionSkeleton } from "./competition-skeleton"
import { RulesDialog } from "./rules-dialog"
import { parseBrlNumber } from "./shared"
import { AccountsTab } from "./tab-accounts"
import { MyPostsTab } from "./tab-my-posts"
import { RankingTab } from "./tab-ranking"
import { StatsTab } from "./tab-stats"

/* ============================================================
   Backdrop animado do hero (mesmo padrão do competition-admin)
   ============================================================ */

const HERO_SPARKLES = [
  { left: "58%", top: "16%", size: 11, delay: 0, dur: 3.6 },
  { left: "78%", top: "10%", size: 9, delay: 1.4, dur: 4.4 },
  { left: "88%", top: "34%", size: 13, delay: 2.2, dur: 3.4 },
  { left: "68%", top: "58%", size: 8, delay: 0.8, dur: 4.8 },
] as const

const HERO_PARTICLES = [
  { left: "62%", bottom: "18%", size: 3, delay: 0.4, dur: 5.6, x: 12 },
  { left: "74%", bottom: "12%", size: 2, delay: 2, dur: 6.6, x: -12 },
  { left: "86%", bottom: "20%", size: 3, delay: 1.2, dur: 5.4, x: 10 },
  { left: "94%", bottom: "14%", size: 2, delay: 3.4, dur: 6.2, x: -8 },
] as const

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span className="arena-aurora absolute -top-20 right-[6%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
      <span
        className="arena-aurora absolute -bottom-24 left-[18%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_18%,transparent),transparent_66%)] blur-2xl"
        style={{ animationDelay: "-6s" }}
      />
      <div className="hero-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_75%_40%,#000_25%,transparent_75%)] opacity-35" />
      <div className="absolute inset-y-0 left-1/3 w-28 overflow-visible">
        <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
      </div>
      <span
        className="arena-comet absolute top-[8%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/70 via-[color-mix(in_oklab,var(--brand-cyan)_65%,transparent)] to-transparent"
        style={
          {
            "--comet-dur": "10s",
            "--comet-delay": "2.5s",
            "--comet-x": "-300px",
            "--comet-y": "200px",
            "--comet-angle": "-33deg",
          } as React.CSSProperties
        }
      />
      {HERO_SPARKLES.map((sparkle, index) => (
        <Sparkle
          key={index}
          weight="fill"
          className={cn(
            "arena-twinkle absolute",
            index % 2 === 0
              ? "text-[var(--brand-mint)]"
              : "text-[var(--brand-cyan)]",
          )}
          style={
            {
              left: sparkle.left,
              top: sparkle.top,
              width: sparkle.size,
              height: sparkle.size,
              "--twinkle-delay": `${sparkle.delay}s`,
              "--twinkle-dur": `${sparkle.dur}s`,
              "--twinkle-opacity": 0.85,
            } as React.CSSProperties
          }
        />
      ))}
      {HERO_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className={cn(
            "arena-particle absolute rounded-full",
            index % 2 === 0
              ? "bg-[var(--brand-mint)]"
              : "bg-[var(--brand-cyan)]",
          )}
          style={
            {
              left: particle.left,
              bottom: particle.bottom,
              width: particle.size,
              height: particle.size,
              "--particle-delay": `${particle.delay}s`,
              "--particle-dur": `${particle.dur}s`,
              "--particle-x": `${particle.x}px`,
              "--particle-opacity": 0.75,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent" />
    </div>
  )
}

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

/* ============================================================
   Página da competição do clipador
   ============================================================ */

export default function Competition({ slug }: { slug: string }) {
  const { maskText } = useMaskedCurrency()
  const utils = api.useUtils()

  /* ===== Queries ===== */
  const { data: userData } = api.user.getCurrentUser.useQuery()
  const isProSubscriber = userData?.subscriptionStatus === "ACTIVE"

  const {
    data: competition,
    isLoading,
    error,
  } = api.campaign.getCompetitionDetails.useQuery({ slug }, { retry: 1 })

  const { data: allSocialAccounts, refetch: refetchAllAccounts } =
    api.clipper.getMySocialAccounts.useQuery()

  const { data: applicationAccounts, refetch: refetchApplicationAccounts } =
    api.campaign.getApplicationAccounts.useQuery(
      { applicationId: competition?.applicationId || "" },
      { enabled: !!competition?.applicationId },
    )

  /* ===== Dialogs ===== */
  const [isCreatePostOpen, setIsCreatePostOpen] = React.useState(false)
  const [isRulesDialogOpen, setIsRulesDialogOpen] = React.useState(false)
  const [isAffiliateLinksDialogOpen, setIsAffiliateLinksDialogOpen] =
    React.useState(false)
  const [isAddAccountsDialogOpen, setIsAddAccountsDialogOpen] =
    React.useState(false)
  const [isCreateAccountDialogOpen, setIsCreateAccountDialogOpen] =
    React.useState(false)

  /* ===== Loading ===== */
  if (isLoading) {
    return <CompetitionSkeleton />
  }

  /* ===== Erro (ex.: não participa desta competição) ===== */
  if (error || !competition) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-20 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-500 dark:text-red-400">
            <ShieldWarning className="size-7" weight="fill" />
          </span>
          <div className="max-w-md">
            <p className="text-lg font-bold">
              Não foi possível abrir a competição
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {error?.message ||
                "A competição que você está procurando não está disponível."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              asChild
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              <Link href="/my-competitions/schedule">
                <Trophy className="size-4" weight="fill" />
                Ver Competições Disponíveis
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="cursor-pointer rounded-xl"
            >
              <Link href="/my-competitions">Minhas Competições</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ===== Derivados ===== */
  const status = CAMPAIGN_STATUS_CONFIG[competition.status]
  const hasAffiliateLinks = !!(
    competition.affiliateLinkInstagram ||
    competition.affiliateLinkTiktok ||
    competition.affiliateLinkYoutube ||
    competition.affiliateLinkFacebook ||
    competition.affiliateLinkKwai
  )
  const isEngagementMetric =
    competition.rankingMetricType === "VIEWS_X_ENGAGEMENT"
  const proLocked = competition.isProOnly && !isProSubscriber

  const rankingChange =
    competition.myPreviousRanking - competition.myMonthlyRanking

  /* Meta de views: 2000× a premiação total */
  const prizeNumeric = parseBrlNumber(competition.totalPrize)
  const viewsGoal = prizeNumeric * 2000
  const currentViews = competition.competitionTotalViews || 0
  const goalProgress =
    viewsGoal > 0 ? Math.min((currentViews / viewsGoal) * 100, 100) : 0
  const goalReached = viewsGoal > 0 && goalProgress >= 100

  /* Score total (VIEWS_X_ENGAGEMENT) */
  const myEngagementRateTotal =
    competition.myTotalViews > 0
      ? ((competition.myTotalLikes +
          competition.myTotalComments +
          competition.myTotalShares) /
          competition.myTotalViews) *
        100
      : 0
  const myScoreTotal = Math.round(
    competition.myTotalViews * myEngagementRateTotal,
  )

  /* Post mais viral (maior número de views) */
  const topViralPost =
    competition.myPosts.length > 0
      ? [...competition.myPosts].sort((a, b) => b.views - a.views)[0]
      : undefined
  const topViralConfig = topViralPost
    ? platformConfig[topViralPost.platform as PlatformKey]
    : undefined

  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (new Date(competition.endDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  )

  const bestViews =
    competition.myPosts.length > 0
      ? Math.max(...competition.myPosts.map((post) => post.views))
      : 0
  const bestEngagementRate =
    competition.myPosts.length > 0
      ? Math.max(...competition.myPosts.map((post) => post.engagementRate))
      : 0

  const growthData = competition.growthData ?? []

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
      {/* ===== Hero animado ===== */}
      <DarkScope className="contents">
        <Reveal immediate>
          <section className="relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7 lg:p-8">
            <HeroBackdrop />

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row">
              {/* Capa 1:1 */}
              {competition.coverImageUrl && (
                <div className="relative aspect-square w-full shrink-0 self-start overflow-hidden rounded-2xl ring-2 ring-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] sm:w-56 lg:w-64">
                  <Image
                    src={competition.coverImageUrl}
                    alt={competition.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 256px"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-3.5">
                {/* Badges + ações */}
                <div className="flex flex-wrap items-center gap-2">
                  {status && (
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
                  )}

                  {/* Badge "Views × Engajamento" com dialog explicativo */}
                  {isEngagementMetric && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="cursor-pointer transition-transform hover:scale-[1.03]"
                        >
                          <Badge
                            variant="outline"
                            className="gap-1 rounded-full border-fuchsia-500/40 bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-orange-500/20 text-fuchsia-300"
                          >
                            <Lightning className="size-3" weight="fill" />
                            Views × Engajamento
                            <Info className="size-3 opacity-80" weight="bold" />
                          </Badge>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <span className="rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 p-1.5">
                              <Pulse
                                className="size-4 text-white"
                                weight="bold"
                              />
                            </span>
                            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                              Como funciona?
                            </span>
                          </DialogTitle>
                        </DialogHeader>

                        <div className="flex flex-col gap-3 py-2">
                          {/* Fórmula */}
                          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 p-3 text-center">
                            <p className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                              Score = Views × Engajamento%
                            </p>
                          </div>

                          {/* Exemplo */}
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                              <Sparkle className="size-3.5" weight="fill" />
                              Exemplo:
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                              <div className="bg-card/60 rounded-lg px-3 py-2 text-center">
                                <p className="text-lg font-bold text-blue-500 sm:text-xl dark:text-blue-400">
                                  100K
                                </p>
                                <p className="text-muted-foreground text-[10px]">
                                  views
                                </p>
                              </div>
                              <span className="text-muted-foreground text-xl font-bold">
                                ×
                              </span>
                              <div className="bg-card/60 rounded-lg px-3 py-2 text-center">
                                <p className="text-lg font-bold text-pink-500 sm:text-xl dark:text-pink-400">
                                  3%
                                </p>
                                <p className="text-muted-foreground text-[10px]">
                                  engajamento
                                </p>
                              </div>
                              <span className="text-muted-foreground text-xl font-bold">
                                =
                              </span>
                              <div className="rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-green-500/20 px-3 py-2 text-center">
                                <p className="text-lg font-black text-emerald-500 sm:text-xl dark:text-emerald-400">
                                  300K
                                </p>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-300">
                                  score
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Dica */}
                          <div className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                            <CheckCircle
                              className="mt-0.5 size-4 shrink-0 text-blue-500 dark:text-blue-400"
                              weight="fill"
                            />
                            <p className="text-muted-foreground text-xs">
                              <span className="font-medium text-blue-500 dark:text-blue-400">
                                Quanto maior o engajamento
                              </span>
                              , maior seu score! Vídeos com muita interação
                              ganham mais pontos.
                            </p>
                          </div>
                        </div>

                        <DialogFooter>
                          <DialogClose asChild>
                            <Button
                              size="sm"
                              className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 font-semibold text-white hover:opacity-90"
                            >
                              <CheckCircle className="size-4" weight="fill" />
                              Entendi
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}

                  {competition.isProOnly && (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-violet-500/40 bg-violet-500/15 text-violet-400"
                    >
                      <Crown className="size-3" weight="fill" />
                      Exclusivo PRO
                    </Badge>
                  )}

                  {competition.dailyPix && (
                    <Badge
                      variant="outline"
                      className="gap-1 rounded-full border-emerald-400/45 bg-emerald-500/15 text-emerald-300"
                    >
                      <Wallet className="size-3" weight="fill" />
                      Pix Diário
                    </Badge>
                  )}

                  {/* Ações */}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 cursor-pointer rounded-xl border-white/12 bg-white/[0.06] text-[#ecf7f9] hover:bg-white/12 hover:text-white"
                      onClick={() => setIsRulesDialogOpen(true)}
                    >
                      <Trophy
                        className="size-3.5 text-amber-400"
                        weight="fill"
                      />
                      <span className="hidden sm:inline">Regras & Prêmios</span>
                      <span className="sm:hidden">Regras</span>
                    </Button>

                    {hasAffiliateLinks && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="relative h-9 cursor-pointer rounded-xl border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-300"
                        onClick={() => setIsAffiliateLinksDialogOpen(true)}
                      >
                        <LinkSimple className="size-3.5" weight="bold" />
                        <span className="hidden sm:inline">
                          Links de Afiliado
                        </span>
                        <span className="sm:hidden">Links</span>
                        <Badge className="ml-1 animate-pulse border-0 bg-red-500 px-1.5 py-0 text-[9px] text-white">
                          Obrigatório
                        </Badge>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
                      onClick={() => setIsCreatePostOpen(true)}
                    >
                      <Plus className="size-3.5" weight="bold" />
                      <span className="hidden sm:inline">Enviar Post</span>
                      <span className="sm:hidden">Enviar</span>
                    </Button>
                  </div>
                </div>

                <h1 className="text-gradient w-fit text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
                  {competition.name}
                </h1>

                {competition.description && (
                  <p className="max-w-3xl text-sm leading-relaxed text-[#8aa3b3] sm:text-base">
                    {competition.description}
                  </p>
                )}

                {/* Plataformas */}
                {competition.platforms.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {competition.platforms.map((platform) => {
                      const config = platformConfig[platform as PlatformKey]
                      if (!config) return null
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

                {/* Período + prêmio */}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
                  <span className="inline-flex items-center gap-1.5 text-sm text-[#8aa3b3]">
                    <CalendarBlank className="size-4" />
                    {formatDateLong(competition.startDate)} –{" "}
                    {formatDateLong(competition.endDate)}
                  </span>
                  {prizeNumeric > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-3 py-1 text-sm font-bold text-amber-400">
                      <Sparkle className="size-4" weight="fill" />
                      <span className={cn(proLocked && "blur-sm select-none")}>
                        {maskText(formatPrizeLabel(competition.totalPrize))}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </DarkScope>

      {/* ===== Meta de Views ===== */}
      {viewsGoal > 0 && (
        <Reveal immediate delayMs={60}>
          <section className="relative overflow-hidden rounded-3xl border-2 border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-orange-500/15 p-5 shadow-lg shadow-amber-500/10 backdrop-blur-sm sm:p-6">
            <div
              aria-hidden
              className="absolute top-0 left-1/4 size-32 rounded-full bg-amber-400/25 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute right-1/4 bottom-0 size-24 rounded-full bg-orange-400/20 blur-2xl"
            />
            <div
              aria-hidden
              className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            />

            {goalReached ? (
              /* ===== Meta atingida — celebração ===== */
              <div className="relative">
                <span
                  className="absolute top-0 left-[6%] animate-bounce text-base opacity-80"
                  style={{ animationDelay: "0.2s" }}
                >
                  🎉
                </span>
                <span
                  className="absolute top-1 right-[12%] hidden animate-bounce text-sm opacity-80 sm:block"
                  style={{ animationDelay: "0.8s" }}
                >
                  ⭐
                </span>
                <span
                  className="absolute right-[6%] bottom-0 animate-bounce text-base opacity-80"
                  style={{ animationDelay: "0.5s" }}
                >
                  🏆
                </span>

                <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 animate-pulse rounded-xl bg-yellow-400/40 blur-md" />
                      <span className="relative flex size-11 items-center justify-center rounded-xl border border-yellow-400/50 bg-gradient-to-br from-yellow-400/30 to-orange-500/30 shadow-lg shadow-yellow-500/20">
                        <Trophy
                          className="size-5 text-yellow-500 dark:text-yellow-300"
                          weight="fill"
                        />
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-black text-amber-700 dark:text-yellow-100">
                        Meta de Views
                      </p>
                      <p className="text-[11px] text-amber-700/70 dark:text-yellow-200/80">
                        Alcance coletivo da competição
                      </p>
                    </div>
                  </div>
                  <Badge className="animate-pulse gap-1.5 border border-yellow-400/50 bg-yellow-500/20 px-3 py-1.5 text-amber-700 shadow-lg shadow-yellow-500/20 dark:text-yellow-200">
                    <Fire
                      className="size-4 text-amber-500 dark:text-yellow-300"
                      weight="fill"
                    />
                    <span className="font-bold">Meta Atingida!</span>
                  </Badge>
                </div>

                {/* Barra 100% + marcador central */}
                <div className="relative mt-10 mb-3">
                  <div
                    className="absolute -top-9 z-10 flex flex-col items-center"
                    style={{ left: "50%", transform: "translateX(-50%)" }}
                  >
                    <div className="flex items-center gap-1.5 rounded-xl border-2 border-yellow-400/70 bg-gradient-to-r from-yellow-500/60 to-amber-500/60 px-3 py-1.5 shadow-lg shadow-yellow-500/40 backdrop-blur-md">
                      <Eye className="size-3.5 text-white" weight="fill" />
                      <span className="text-sm font-black text-white">
                        {formatNumber(currentViews)}
                      </span>
                    </div>
                    <div className="size-0 border-t-[8px] border-r-[8px] border-l-[8px] border-t-yellow-400/70 border-r-transparent border-l-transparent" />
                  </div>

                  <div className="bg-background/40 h-4 overflow-hidden rounded-full border-2 border-yellow-500/30 shadow-inner backdrop-blur-sm">
                    <div className="relative h-full w-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 shadow-[0_0_20px_rgba(250,204,21,0.6)]">
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/40 to-white/20" />
                      <div className="animate-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700/70 dark:text-yellow-200/80">
                      0 views
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-yellow-200">
                      <Trophy
                        className="size-3.5 text-amber-500 dark:text-yellow-300"
                        weight="fill"
                      />
                      {formatNumber(viewsGoal)} views
                    </span>
                  </div>
                </div>

                {/* Mensagem de parabéns */}
                <div className="mt-5 flex flex-col items-center gap-3">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Badge className="gap-2 border-2 border-yellow-400/50 bg-gradient-to-r from-yellow-500/30 to-amber-500/30 px-4 py-1.5 text-amber-700 shadow-lg shadow-yellow-500/20 dark:text-yellow-200">
                      <TrendUp className="size-4" weight="bold" />
                      <span className="text-base font-black">
                        {goalProgress.toFixed(1)}%
                      </span>
                    </Badge>
                    <span className="text-sm font-bold text-amber-700/90 dark:text-yellow-200/90">
                      Parabéns, mandaram muito! 🏆
                    </span>
                  </div>
                  <div className="rounded-xl border border-yellow-400/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-orange-500/10 px-4 py-2.5 backdrop-blur-sm sm:px-6">
                    <p className="text-center text-[11px] leading-relaxed text-amber-800/80 sm:text-xs dark:text-yellow-200/80">
                      A meta foi batida graças ao esforço de{" "}
                      <span className="font-bold text-amber-800 dark:text-yellow-200">
                        cada clipador
                      </span>
                      ! Isso aumenta a chance da competição ser{" "}
                      <span className="font-bold text-amber-900 dark:text-yellow-100">
                        renovada com premiação ainda maior
                      </span>
                      ! 🚀
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* ===== Meta em progresso ===== */
              <div className="relative">
                {/* Badge informativo */}
                <div className="absolute -top-2 -right-2 z-20 sm:top-0 sm:right-0">
                  <div className="group relative">
                    <div className="flex cursor-help items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-green-500/20 px-2.5 py-1.5 backdrop-blur-sm transition-all hover:border-emerald-400/60">
                      <Sparkle
                        className="size-3.5 text-emerald-500 dark:text-emerald-400"
                        weight="fill"
                      />
                      <span className="hidden text-[10px] font-semibold text-emerald-700 sm:inline sm:text-xs dark:text-emerald-300">
                        Meta = Renovação com mais premiação!
                      </span>
                      <Info className="size-3 text-emerald-500/70 sm:hidden" />
                    </div>
                    <div className="border-border/60 bg-popover/95 invisible absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border p-3 opacity-0 shadow-xl backdrop-blur-md transition-all duration-200 group-hover:visible group-hover:opacity-100 sm:w-64">
                      <div className="flex items-start gap-2">
                        <Trophy
                          className="mt-0.5 size-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                          weight="fill"
                        />
                        <div>
                          <p className="mb-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                            Bata a meta!
                          </p>
                          <p className="text-muted-foreground text-[10px] leading-relaxed">
                            Quando a meta de views é atingida, a chance do
                            expert{" "}
                            <span className="font-semibold text-emerald-500 dark:text-emerald-400">
                              renovar a competição
                            </span>{" "}
                            com uma{" "}
                            <span className="font-semibold text-amber-500 dark:text-yellow-400">
                              premiação ainda maior
                            </span>{" "}
                            aumenta muito!
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header */}
                <div className="mb-8 flex items-center gap-3 pr-24 sm:pr-32">
                  <span className="flex size-11 items-center justify-center rounded-xl border border-yellow-400/50 bg-gradient-to-br from-yellow-400/30 to-orange-500/30 shadow-lg shadow-yellow-500/20">
                    <Target
                      className="size-5 text-amber-500 dark:text-yellow-300"
                      weight="fill"
                    />
                  </span>
                  <div>
                    <p className="text-base font-black text-amber-700 dark:text-yellow-100">
                      Meta de Views
                    </p>
                    <p className="text-[11px] text-amber-700/70 dark:text-yellow-200/80">
                      Alcance coletivo da competição
                    </p>
                  </div>
                </div>

                {/* Barra com marcador flutuante */}
                <div className="relative mt-10 mb-3">
                  <div
                    className="absolute -top-9 z-10 flex flex-col items-center transition-all duration-1000"
                    style={{
                      left: `${Math.min(Math.max(goalProgress, 5), 95)}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 rounded-xl border-2 border-yellow-400/70 bg-gradient-to-r from-yellow-500/60 to-amber-500/60 px-3 py-1.5 shadow-lg shadow-yellow-500/40 backdrop-blur-md">
                      <Eye className="size-3.5 text-white" weight="fill" />
                      <span className="text-sm font-black text-white">
                        {formatNumber(currentViews)}
                      </span>
                    </div>
                    <div className="size-0 border-t-[8px] border-r-[8px] border-l-[8px] border-t-yellow-400/70 border-r-transparent border-l-transparent" />
                  </div>

                  <div className="bg-background/40 h-4 overflow-hidden rounded-full border-2 border-yellow-500/30 shadow-inner backdrop-blur-sm">
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 shadow-[0_0_20px_rgba(250,204,21,0.6)] transition-all duration-1000 ease-out"
                      style={{ width: `${goalProgress}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/40 to-white/20" />
                      <div className="animate-shimmer absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)]" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700/70 dark:text-yellow-200/80">
                      0 views
                    </span>
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-yellow-200">
                      <Trophy
                        className="size-3.5 text-amber-500 dark:text-yellow-300"
                        weight="fill"
                      />
                      {formatNumber(viewsGoal)} views
                    </span>
                  </div>
                </div>

                {/* Percentual + frase motivacional */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  <Badge className="gap-2 border-2 border-yellow-400/50 bg-gradient-to-r from-yellow-500/30 to-amber-500/30 px-4 py-1.5 text-amber-700 shadow-lg shadow-yellow-500/20 dark:text-yellow-200">
                    <TrendUp className="size-4" weight="bold" />
                    <span className="text-base font-black">
                      {goalProgress.toFixed(1)}%
                    </span>
                  </Badge>
                  <span className="text-sm font-semibold text-amber-700/90 dark:text-yellow-200/90">
                    {goalProgress < 25
                      ? "Começando a jornada! 🚀"
                      : goalProgress < 50
                        ? "Evoluindo forte! 💪"
                        : goalProgress < 75
                          ? "A meta está próxima! 🔥"
                          : "Quase lá, time! ⚡"}
                  </span>
                </div>
              </div>
            )}
          </section>
        </Reveal>
      )}

      {/* ===== Suas Views Totais + Score ===== */}
      <Reveal immediate delayMs={120}>
        <section className="relative overflow-hidden rounded-3xl border-2 border-blue-500/40 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-violet-500/10 p-4 shadow-lg backdrop-blur-sm sm:p-6">
          <div
            aria-hidden
            className="absolute top-0 left-0 size-40 rounded-full bg-blue-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute right-0 bottom-0 size-32 rounded-full bg-violet-500/20 blur-3xl"
          />

          <div className="relative z-10">
            <div
              className={cn(
                "grid gap-4 sm:gap-6",
                isEngagementMetric
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1",
              )}
            >
              {/* Suas Views Totais */}
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-4 sm:flex-row sm:gap-4 sm:p-5">
                <span className="rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 p-3 shadow-lg shadow-blue-500/40 sm:p-4">
                  <Eye className="size-6 text-white sm:size-8" weight="fill" />
                </span>
                <div className="text-center sm:text-left">
                  <p className="mb-0.5 text-xs font-medium text-blue-600 sm:text-sm dark:text-blue-300">
                    Suas Views Totais
                  </p>
                  <p className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-2xl font-black text-transparent sm:text-3xl md:text-4xl dark:from-blue-400 dark:to-cyan-400">
                    {formatNumber(competition.myTotalViews)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[10px] sm:text-xs">
                    Soma de todos os vídeos elegíveis
                  </p>
                </div>
              </div>

              {/* Seu Score Total (só VIEWS_X_ENGAGEMENT) */}
              {isEngagementMetric && (
                <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-orange-500/20 p-4 sm:flex-row sm:gap-4 sm:p-5">
                  <span className="relative rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-3 shadow-lg shadow-purple-500/40 sm:p-4">
                    <Pulse
                      className="size-6 text-white sm:size-8"
                      weight="bold"
                    />
                  </span>
                  <div className="relative text-center sm:text-left">
                    <p className="mb-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-xs font-medium text-transparent sm:text-sm dark:from-purple-300 dark:via-pink-300 dark:to-orange-300">
                      Seu Score Total
                    </p>
                    <p className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-2xl font-black text-transparent sm:text-3xl md:text-4xl dark:from-purple-400 dark:via-pink-400 dark:to-orange-400">
                      {myScoreTotal.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-muted-foreground mt-1 text-[10px] sm:text-xs">
                      Views × Taxa de Engajamento
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center">
              <Badge
                variant="outline"
                className="bg-background/50 gap-1.5 rounded-full border-blue-500/30 px-3 py-1.5 text-blue-600 backdrop-blur-sm dark:text-blue-300"
              >
                <Sparkle className="size-3" weight="fill" />
                <span className="text-[10px] sm:text-xs">
                  {isEngagementMetric
                    ? "Ranking calculado por Views × Engajamento"
                    : "Ranking calculado pelo total de views"}
                </span>
              </Badge>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ===== Quick stats ===== */}
      <Reveal immediate delayMs={180}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Capa */}
          <div className="group relative aspect-square overflow-hidden rounded-2xl">
            {competition.coverImageUrl ? (
              <Image
                src={competition.coverImageUrl}
                alt={competition.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 300px"
              />
            ) : (
              <div className="from-primary/20 to-primary/10 absolute inset-0 bg-gradient-to-br via-transparent" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute right-0 bottom-0 left-0 p-3 sm:p-4">
              <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-medium text-white/90 sm:text-xs">
                <Sparkle
                  className="size-3 text-[var(--brand-mint)] sm:size-3.5"
                  weight="fill"
                />
                Competição
              </p>
              <p className="line-clamp-2 text-xs leading-tight font-bold text-white sm:text-sm">
                {competition.name}
              </p>
            </div>
          </div>

          {/* Posição Atual */}
          <div className="glass-card glass-card-hover flex flex-col gap-2 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Posição Atual
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <Trophy className="size-4" weight="fill" />
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-500 tabular-nums sm:text-[1.7rem]">
              {competition.myMonthlyRanking > 0
                ? `#${competition.myMonthlyRanking}`
                : "—"}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {rankingChange !== 0 && competition.myMonthlyRanking > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold",
                    rankingChange > 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  {rankingChange > 0 ? (
                    <ArrowUpRight className="size-3" weight="bold" />
                  ) : (
                    <ArrowDownRight className="size-3" weight="bold" />
                  )}
                  {Math.abs(rankingChange)} posições
                </span>
              )}
              <span className="text-muted-foreground">
                {competition.myMonthlyRanking > 0
                  ? "Ranking Mensal"
                  : "Aguardando ranking"}
              </span>
            </div>
          </div>

          {/* Meus Posts */}
          <div className="glass-card glass-card-hover flex flex-col gap-2 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Meus Posts
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500 dark:text-blue-400">
                <VideoCamera className="size-4" weight="fill" />
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-500 tabular-nums sm:text-[1.7rem] dark:text-blue-400">
              {competition.myTotalPosts}
            </p>
            <p className="text-muted-foreground text-xs">
              Total de vídeos enviados
            </p>
          </div>

          {/* Ganhos Atuais */}
          <div className="glass-card glass-card-hover flex flex-col gap-2 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Ganhos Atuais
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-400">
                <Wallet className="size-4" weight="fill" />
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-500 tabular-nums sm:text-[1.7rem] dark:text-emerald-400">
              {maskText(competition.myCurrentEarnings)}
            </p>
            <p className="text-muted-foreground text-xs">
              Ganhos acumulados na competição
            </p>
          </div>
        </div>
      </Reveal>

      {/* ===== Gráfico + Post Mais Viral ===== */}
      <Reveal delayMs={60}>
        <div className="grid gap-4 lg:grid-cols-7">
          {/* Gráfico de crescimento */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 lg:col-span-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                  <TrendUp className="size-4" weight="bold" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-bold sm:text-base">
                    Crescimento de Views & Engajamento
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Evolução diária na competição
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1.5 rounded-full">
                <Clock className="size-3.5" />
                Últimos 7 dias
              </Badge>
            </div>

            {growthData.length > 0 ? (
              <>
                <div className="h-56 w-full flex-1 sm:h-64">
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
                </div>
                <div className="text-muted-foreground flex items-center justify-center gap-5 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[var(--brand-cyan)]" />
                    Views
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[#ec4899]" />
                    Engajamento
                  </span>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendUp className="size-6" weight="bold" />}
                title="Dados de crescimento em breve"
                subtitle="Continue enviando posts para ver o crescimento das suas views e engajamento ao longo do tempo"
                className="flex-1"
              />
            )}
          </div>

          {/* Post Mais Viral */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5 lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <Fire className="size-4" weight="fill" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold sm:text-base">
                  Post Mais Viral
                </p>
                <p className="text-muted-foreground text-xs">
                  Seu melhor desempenho
                </p>
              </div>
            </div>

            {topViralPost ? (
              <>
                <a
                  href={topViralPost.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link block"
                >
                  <div className="bg-muted relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl">
                    {topViralPost.thumbnailUrl ? (
                      <Image
                        src={topViralPost.thumbnailUrl}
                        alt="Post mais viral"
                        fill
                        className="object-cover transition-transform duration-300 group-hover/link:scale-105"
                        sizes="(max-width: 1024px) 100vw, 320px"
                      />
                    ) : (
                      <VideoCamera className="text-muted-foreground size-16" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/link:opacity-100">
                      <div className="rounded-full bg-white/90 p-3 backdrop-blur-sm">
                        <ArrowSquareOut className="size-6 text-gray-900" />
                      </div>
                    </div>

                    <div className="absolute right-2 bottom-2 left-2">
                      <Badge className="mb-2 border-0 bg-yellow-500/90 text-gray-900">
                        <Sparkle className="mr-1 size-3" weight="fill" />#
                        {topViralPost.rankInCompetition || 1} Seu melhor
                      </Badge>
                      <div className="flex items-center gap-2 text-white">
                        <Eye className="size-3.5" weight="fill" />
                        <span className="text-sm font-bold">
                          {formatNumber(topViralPost.views)}
                        </span>
                      </div>
                    </div>
                  </div>
                </a>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Likes</span>
                    <span className="font-bold">
                      {formatNumber(topViralPost.likes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">ER</span>
                    <span className="text-brand-cyan not-dark:text-primary font-bold">
                      {topViralPost.engagementRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Ganhos</span>
                    <span className="font-bold text-emerald-500 dark:text-emerald-400">
                      {maskText(topViralPost.earnings)}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto w-full cursor-pointer rounded-xl"
                  asChild
                >
                  <a
                    href={topViralPost.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {topViralConfig && (
                      <topViralConfig.icon className="size-4" />
                    )}
                    Ver no {topViralConfig?.label ?? topViralPost.platform}
                  </a>
                </Button>
              </>
            ) : (
              <EmptyState
                icon={<VideoCamera className="size-6" weight="fill" />}
                title="Nenhum post ainda"
                subtitle="Envie seu primeiro post para ver suas métricas aqui"
                className="flex-1"
              />
            )}
          </div>
        </div>
      </Reveal>

      {/* ===== Visão Geral + Suas Conquistas ===== */}
      <Reveal delayMs={60}>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Visão Geral */}
          <div className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <ChartBar className="size-4" weight="fill" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold sm:text-base">Visão Geral</p>
                <p className="text-muted-foreground text-xs">
                  Métricas da competição
                </p>
              </div>
            </div>

            <div className="bg-muted/20 hover:bg-muted/40 flex items-center justify-between rounded-xl p-3 transition-colors">
              <div className="flex items-center gap-3">
                <span className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-lg">
                  <UsersThree className="size-4" weight="fill" />
                </span>
                <span className="text-sm font-medium">Participantes</span>
              </div>
              <span className="text-base font-bold tabular-nums">
                {competition.totalParticipants}
              </span>
            </div>

            <div className="bg-muted/20 hover:bg-muted/40 flex items-center justify-between rounded-xl p-3 transition-colors">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500 dark:text-violet-400">
                  <Play className="size-4" weight="fill" />
                </span>
                <span className="text-sm font-medium">Total Posts</span>
              </div>
              <span className="text-base font-bold tabular-nums">
                {competition.totalPosts}
              </span>
            </div>

            <div className="bg-muted/20 hover:bg-muted/40 flex items-center justify-between rounded-xl p-3 transition-colors">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-500 dark:text-blue-400">
                  <CalendarBlank className="size-4" weight="fill" />
                </span>
                <span className="text-sm font-medium">Dias Restantes</span>
              </div>
              <span className="text-base font-bold text-orange-500 tabular-nums dark:text-orange-400">
                {daysRemaining}
              </span>
            </div>
          </div>

          {/* Suas Conquistas */}
          <div className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-400">
                <Trophy className="size-4" weight="fill" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold sm:text-base">
                  Suas Conquistas
                </p>
                <p className="text-muted-foreground text-xs">
                  Destaques nesta competição
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Post Mais Visto
                </span>
                <Eye className="size-4 text-blue-400" weight="fill" />
              </div>
              <p className="text-2xl font-bold text-blue-500 tabular-nums dark:text-blue-400">
                {formatNumber(bestViews)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Views no melhor vídeo
              </p>
            </div>

            <div className="rounded-xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-rose-500/10 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Melhor ER</span>
                <TrendUp className="size-4 text-pink-400" weight="bold" />
              </div>
              <p className="text-2xl font-bold text-pink-500 tabular-nums dark:text-pink-400">
                {bestEngagementRate.toFixed(1)}%
              </p>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Maior engajamento
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Total de Likes
                </span>
                <Heart className="size-4 text-emerald-400" weight="fill" />
              </div>
              <p className="text-2xl font-bold text-emerald-500 tabular-nums dark:text-emerald-400">
                {formatNumber(competition.myTotalLikes)}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                Likes acumulados
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Tabs =====
          `immediate`: é o conteúdo principal da página (ranking, posts,
          contas) e não pode depender de scroll para aparecer — mesmo
          padrão das demais telas do dashboard. */}
      <Reveal immediate delayMs={60}>
        <Tabs defaultValue="posts" className="gap-4 sm:gap-5">
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <TabsList className="bg-muted/40 flex h-auto w-max gap-1 rounded-2xl p-1 sm:w-full">
              <TabsTrigger
                value="posts"
                className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap sm:flex-1"
              >
                <VideoCamera className="size-3.5" weight="fill" />
                <span className="hidden sm:inline">Meus Posts</span>
                <span className="sm:hidden">Posts</span>
                <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A] shadow-sm">
                  {competition.myTotalPosts}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="ranking"
                className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap sm:flex-1"
              >
                <Trophy className="size-3.5" weight="fill" />
                Ranking
                {competition.myMonthlyRanking > 0 && (
                  <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A] shadow-sm">
                    #{competition.myMonthlyRanking}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap sm:flex-1"
              >
                <ChartBar className="size-3.5" weight="fill" />
                <span className="hidden sm:inline">Estatísticas</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger
                value="accounts"
                className="cursor-pointer gap-1.5 rounded-full px-3 py-2 text-xs font-semibold whitespace-nowrap sm:flex-1"
              >
                <UsersThree className="size-3.5" weight="fill" />
                <span className="hidden sm:inline">Minhas Contas</span>
                <span className="sm:hidden">Contas</span>
                <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A] shadow-sm">
                  {applicationAccounts?.length || 0}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="posts">
            <MyPostsTab
              competition={competition}
              onCreatePost={() => setIsCreatePostOpen(true)}
            />
          </TabsContent>

          <TabsContent value="ranking">
            <RankingTab
              competition={competition}
              isProSubscriber={isProSubscriber}
            />
          </TabsContent>

          <TabsContent value="stats">
            <StatsTab competition={competition} viewsGoal={viewsGoal} />
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsTab
              accounts={applicationAccounts}
              onAddAccounts={() => setIsAddAccountsDialogOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </Reveal>

      {/* ===== Dialogs ===== */}
      <RulesDialog
        open={isRulesDialogOpen}
        onOpenChange={setIsRulesDialogOpen}
        competition={competition}
        isProSubscriber={isProSubscriber}
      />

      <AffiliateLinksDialog
        open={isAffiliateLinksDialogOpen}
        onOpenChange={setIsAffiliateLinksDialogOpen}
        competition={competition}
      />

      <AddAccountsDialog
        open={isAddAccountsDialogOpen}
        onOpenChange={setIsAddAccountsDialogOpen}
        applicationId={competition.applicationId}
        allSocialAccounts={allSocialAccounts}
        applicationAccounts={applicationAccounts}
        onCreateAccount={() => {
          setIsAddAccountsDialogOpen(false)
          setIsCreateAccountDialogOpen(true)
        }}
        onAdded={() => void refetchApplicationAccounts()}
      />

      <CreateAccountDialog
        open={isCreateAccountDialogOpen}
        onOpenChange={setIsCreateAccountDialogOpen}
        onCreated={() => {
          setIsAddAccountsDialogOpen(true)
          void refetchAllAccounts()
        }}
      />

      <CreatePostDialog
        open={isCreatePostOpen}
        onOpenChange={setIsCreatePostOpen}
        preSelectedCampaignId={competition.id}
        onSuccess={() => {
          void utils.campaign.getCompetitionDetails.invalidate({ slug })
        }}
      />
    </div>
  )
}
