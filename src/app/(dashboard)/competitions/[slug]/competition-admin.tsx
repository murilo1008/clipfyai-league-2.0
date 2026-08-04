"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowLeft,
  At,
  CalendarBlank,
  ChartBar,
  CheckCircle,
  Crosshair,
  Crown,
  Eye,
  FileXls,
  FilePdf,
  GearSix,
  Globe,
  Hash,
  Heart,
  Lightning,
  Lock,
  PencilSimple,
  Play,
  Sparkle,
  Spinner,
  Trophy,
  UserCheck,
  UsersThree,
  Wallet,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { generateCompetitionExcel } from "@/components/excel/competition-excel-generator"
import { generateCompetitionReport } from "@/components/pdf/competition-report-generator"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import { DarkScope } from "@/components/shared/dark-scope"
import {
  Bone,
  ChartSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { ApplicationsTab } from "./tab-applications"
import { CompetitionCommentsAnalysisPanel } from "./competition-comments-analysis-panel"
import { DailyTab } from "./tab-daily"
import { EditCompetitionDialog } from "./edit-competition-dialog"
import { FinancialTab } from "./tab-financial"
import { MonthlyTab } from "./tab-monthly"
import { OverviewTab } from "./tab-overview"
import { PostsTab } from "./tab-posts"
import { PrizesDialog } from "./prizes-dialog"
import {
  CAMPAIGN_STATUS_CONFIG,
  formatDateLong,
  formatNumber,
  useFormatCurrency,
} from "./shared"

const TABS = [
  { value: "overview", icon: ChartBar, label: "Visão Geral", short: "Geral" },
  { value: "applications", icon: UserCheck, label: "Aplicações", short: "Apps" },
  { value: "financeiro", icon: Wallet, label: "Financeiro", short: "R$" },
  { value: "monthly", icon: Trophy, label: "Ranking Mensal", short: "Mensal" },
  { value: "daily", icon: Crosshair, label: "Ranking Diário", short: "Diário" },
  { value: "posts", icon: Play, label: "Posts Recentes", short: "Posts" },
] as const

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

export default function CompetitionAdmin({ slug }: { slug: string }) {
  const formatCurrency = useFormatCurrency()
  const { maskText } = useMaskedCurrency()

  const {
    data,
    isLoading,
    refetch: refetchDetails,
  } = api.admin.getCompetitionDetailsAdmin.useQuery({ slug })
  const { data: chartsData } = api.admin.getCompetitionChartsAdmin.useQuery(
    { slug },
    { enabled: !!data },
  )

  const [activeTab, setActiveTab] = React.useState("overview")

  /* ===== Dialog: mudar status ===== */
  const [isStatusDialogOpen, setIsStatusDialogOpen] = React.useState(false)
  const [newStatus, setNewStatus] = React.useState<string>("")
  const updateCampaign = api.admin.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Status da competição atualizado!")
      setIsStatusDialogOpen(false)
      void refetchDetails()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao atualizar status"),
  })

  /* ===== Dialogs: editar e prêmios ===== */
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isPrizesOpen, setIsPrizesOpen] = React.useState(false)

  /* ===== Exports ===== */
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false)
  const [isGeneratingExcel, setIsGeneratingExcel] = React.useState(false)

  const buildExportPayload = React.useCallback(() => {
    if (!data) return null
    const avgViews =
      data.stats.totalPosts > 0
        ? Math.round(data.stats.totalViews / data.stats.totalPosts)
        : 0
    return {
      campaign: {
        id: data.campaign.id,
        name: data.campaign.name,
        slug: data.campaign.slug,
        description: data.campaign.description,
        status: data.campaign.status,
        coverImageUrl: data.campaign.coverImageUrl,
        startDate: new Date(data.campaign.startDate),
        endDate: new Date(data.campaign.endDate),
        platforms: data.campaign.platforms,
        requiredHashtags: data.campaign.requiredHashtags,
        requiredMentions: data.campaign.requiredMentions,
        prizePool: data.campaign.totalPrize,
        rankingMetricType: data.campaign.rankingMetricType,
      },
      analytics: {
        totalViews: data.stats.totalViews,
        totalLikes: data.stats.totalLikes,
        totalComments: data.stats.totalComments,
        totalShares: data.stats.totalShares,
        totalPosts: data.stats.totalPosts,
        totalParticipants: data.stats.totalClippers,
        avgViews,
        engagementRate: data.stats.engagementRate,
        recentViews: 0,
        recentPosts: 0,
        dailyStats:
          chartsData?.growthData?.map((d) => ({
            date: d.date || "",
            views: Number(d.views) || 0,
            posts: 0,
          })) ?? [],
        platformStats:
          chartsData?.platformDistribution?.map((p) => ({
            platform: p.platform || "",
            views: Number(p.views) || 0,
            likes: Number(p.likes) || 0,
            comments: Number(p.comments) || 0,
            shares: Number(p.shares) || 0,
            posts: Number(p.posts) || 0,
          })) ?? [],
      },
      ranking: (data.topAccountsRanking ?? []).map(
        (r: Record<string, unknown>, index: number) => ({
          userId: "",
          position: index + 1,
          previousPosition: null,
          username: (r.username as string | undefined) ?? "",
          platform: (r.platform as string | undefined) ?? "INSTAGRAM",
          totalViews: Number(r.totalViews) || 0,
          totalLikes: Number(r.totalLikes) || 0,
          totalComments: Number(r.totalComments) || 0,
          totalShares: Number(r.totalShares) || 0,
          totalPosts: Number(r.postsCount) || 0,
          engagementRate: Number(r.engagementRate) || 0,
          rankingScore: Number(r.rankingScore) || 0,
          profileImageUrl: null,
          artisticName: null,
        }),
      ),
      topPosts: (data.topPostsForReport ?? []).map(
        (p: Record<string, unknown>) => ({
          id: (p.id as string | undefined) ?? "",
          url: (p.url as string | undefined) ?? "",
          thumbnailUrl: (p.thumbnail ?? p.thumbnailUrl ?? null) as
            | string
            | null,
          platform: (p.platform as string | undefined) ?? "",
          username: (p.username as string | undefined) ?? "",
          views: Number(p.views) || 0,
          likes: Number(p.likes) || 0,
          comments: Number(p.comments) || 0,
          shares: Number(p.shares) || 0,
          postedAt: p.postedAt ? new Date(p.postedAt as string) : new Date(),
        }),
      ),
    }
  }, [data, chartsData])

  const handleExportPDF = async () => {
    const payload = buildExportPayload()
    if (!payload) return
    setIsGeneratingPDF(true)
    try {
      await generateCompetitionReport(payload)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleExportExcel = async () => {
    const payload = buildExportPayload()
    if (!payload) return
    setIsGeneratingExcel(true)
    try {
      await generateCompetitionExcel(payload)
    } finally {
      setIsGeneratingExcel(false)
    }
  }

  /* ===== Loading ===== */
  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
        {/* Botão voltar */}
        <Bone className="h-9 w-56" />

        {/* Hero fantasma da competição (faixa dark com capa + textos) */}
        <section className="dark relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7 lg:p-8">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-24 right-[6%] size-64 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-28 left-[18%] size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
          />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row">
            {/* Capa quadrada à esquerda em lg */}
            <Bone className="hidden aspect-square w-56 shrink-0 self-start rounded-2xl lg:block lg:w-64" />

            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              {/* Badges + ações */}
              <div className="flex flex-wrap items-center gap-2">
                <Bone className="h-6 w-20 rounded-full" />
                <Bone delay={80} className="h-6 w-24 rounded-full" />
                <Bone delay={160} className="h-6 w-28 rounded-full" />
                <div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
                  <Bone delay={240} className="h-9 w-28" />
                  <Bone delay={320} className="h-9 w-36" />
                  <Bone delay={400} className="h-9 w-24" />
                </div>
              </div>

              {/* Título */}
              <Bone delay={200} className="h-9 w-4/5 max-w-lg sm:h-10 lg:h-11" />

              {/* Descrição */}
              <div className="flex max-w-3xl flex-col gap-2">
                <Bone delay={300} className="h-4 w-full rounded-full" />
                <Bone delay={380} className="h-4 w-2/3 rounded-full" />
              </div>

              {/* Plataformas */}
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Bone
                    key={index}
                    delay={460 + index * 90}
                    className="h-6 w-24 rounded-full"
                  />
                ))}
              </div>

              {/* Período + prêmio */}
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
                <Bone delay={640} className="h-5 w-56 rounded-full" />
                <Bone delay={720} className="h-7 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <StatTilesGridSkeleton
          count={4}
          className="grid-cols-2 gap-4 lg:grid-cols-4"
        />

        {/* Barra de tabs */}
        <Bone className="h-12 w-full rounded-2xl" />

        {/* Gráfico */}
        <ChartSkeleton heightClass="h-72" />
      </div>
    )
  }

  /* ===== Não encontrada ===== */
  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
            <Trophy className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-lg font-bold">Competição não encontrada</p>
            <p className="text-muted-foreground mt-1 text-sm">
              A competição que você está procurando não existe.
            </p>
          </div>
          <Button asChild variant="outline" className="cursor-pointer rounded-xl">
            <Link href="/competitions">
              <ArrowLeft className="size-4" />
              Voltar para Competições
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const { campaign, stats } = data
  const status =
    CAMPAIGN_STATUS_CONFIG[campaign.status] ?? CAMPAIGN_STATUS_CONFIG.DRAFT!
  const hasPrize =
    campaign.totalPrize &&
    campaign.totalPrize !== "R$ 0" &&
    campaign.totalPrize !== "0"

  const tabProps = {
    slug,
    campaignId: campaign.id,
    data,
    refetch: () => void refetchDetails(),
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
      {/* ===== Voltar ===== */}
      <Reveal immediate>
        <Button
          asChild
          variant="ghost"
          className="text-muted-foreground hover:text-foreground -ml-2 w-fit cursor-pointer rounded-xl"
        >
          <Link href="/competitions">
            <ArrowLeft className="size-4" />
            Voltar para Competições
          </Link>
        </Button>
      </Reveal>

      {/* ===== Hero animado da competição ===== */}
      <DarkScope className="contents">
        <Reveal immediate>
          <section className="relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7 lg:p-8">
            {/* backdrop animado */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <span className="arena-aurora absolute -top-20 right-[6%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
              <span
                className="arena-aurora absolute -bottom-24 left-[18%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_18%,transparent),transparent_66%)] blur-2xl"
                style={{ animationDelay: "-6s" }}
              />
              <div className="hero-grid absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_75%_40%,#000_25%,transparent_75%)]" />
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

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row">
              {/* Capa */}
              {campaign.coverImageUrl && (
                <div className="relative aspect-square w-full shrink-0 self-start overflow-hidden rounded-2xl ring-2 ring-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] sm:w-56 lg:w-64">
                  <Image
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
                {/* Badges + ações */}
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

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 cursor-pointer rounded-xl border-white/12 bg-white/[0.06] text-[#ecf7f9] hover:bg-white/12 hover:text-white"
                      onClick={() => {
                        setNewStatus(campaign.status)
                        setIsStatusDialogOpen(true)
                      }}
                    >
                      <GearSix className="size-3.5" />
                      <span className="hidden sm:inline">Mudar Status</span>
                      <span className="sm:hidden">Status</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 cursor-pointer rounded-xl border-white/12 bg-white/[0.06] text-[#ecf7f9] hover:bg-white/12 hover:text-white"
                      onClick={() => setIsEditOpen(true)}
                    >
                      <PencilSimple className="size-3.5" />
                      <span className="hidden sm:inline">
                        Editar Competição
                      </span>
                      <span className="sm:hidden">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 cursor-pointer rounded-xl border-white/12 bg-white/[0.06] text-[#ecf7f9] hover:bg-white/12 hover:text-white"
                      onClick={() => setIsPrizesOpen(true)}
                    >
                      <Trophy
                        className="size-3.5 text-amber-500"
                        weight="fill"
                      />
                      Prêmios
                    </Button>
                    <Button
                      size="sm"
                      className="btn-gradient-auth h-9 cursor-pointer rounded-xl font-semibold"
                      onClick={handleExportPDF}
                      disabled={isGeneratingPDF}
                    >
                      {isGeneratingPDF ? (
                        <Spinner className="size-3.5 animate-spin" />
                      ) : (
                        <FilePdf className="size-3.5" weight="fill" />
                      )}
                      {isGeneratingPDF ? "Gerando..." : "PDF"}
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white hover:opacity-90"
                      onClick={handleExportExcel}
                      disabled={isGeneratingExcel}
                    >
                      {isGeneratingExcel ? (
                        <Spinner className="size-3.5 animate-spin" />
                      ) : (
                        <FileXls className="size-3.5" weight="fill" />
                      )}
                      {isGeneratingExcel ? "Gerando..." : "Excel"}
                    </Button>
                  </div>
                </div>

                <h1 className="text-gradient w-fit text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
                  {campaign.name}
                </h1>

                {campaign.description && (
                  <p className="max-w-3xl text-sm leading-relaxed text-[#8aa3b3] sm:text-base">
                    {campaign.description}
                  </p>
                )}

                {/* Plataformas */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {campaign.platforms.map((platform) => {
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
                        {campaign.requiredHashtags.map((tag) => (
                          <Badge
                            key={tag}
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
                        {campaign.requiredMentions.map((mention) => (
                          <Badge
                            key={mention}
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
                    {formatDateLong(campaign.startDate)} –{" "}
                    {formatDateLong(campaign.endDate)}
                  </span>
                  {hasPrize && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-3 py-1 text-sm font-bold text-amber-500 dark:text-amber-400">
                      <Sparkle className="size-4" weight="fill" />
                      {typeof campaign.totalPrize === "number"
                        ? formatCurrency(campaign.totalPrize)
                        : maskText(formatPrizeLabel(String(campaign.totalPrize)))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </DarkScope>

      {/* ===== KPIs ===== */}
      <Reveal immediate delayMs={60}>
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
      </Reveal>

      {/* ===== Tabs ===== */}
      <Reveal immediate delayMs={120}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
          <TabsList className="bg-muted/40 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1 lg:grid-cols-6">
            {TABS.map((tab) => {
              const TabIcon = tab.icon
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
                >
                  <TabIcon className="size-3.5" weight="fill" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab {...tabProps} active={activeTab === "overview"} />
          </TabsContent>
          <TabsContent value="applications">
            <ApplicationsTab
              {...tabProps}
              active={activeTab === "applications"}
            />
          </TabsContent>
          <TabsContent value="financeiro">
            <FinancialTab {...tabProps} active={activeTab === "financeiro"} />
          </TabsContent>
          <TabsContent value="monthly">
            <MonthlyTab {...tabProps} active={activeTab === "monthly"} />
          </TabsContent>
          <TabsContent value="daily">
            <DailyTab {...tabProps} active={activeTab === "daily"} />
          </TabsContent>
          <TabsContent value="posts">
            <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
              <PostsTab {...tabProps} active={activeTab === "posts"} />
              {/* Opinião pública: coleta + análise de IA dos comentários */}
              <CompetitionCommentsAnalysisPanel
                campaignId={campaign.id}
                revealDelayMs={120}
              />
            </div>
          </TabsContent>
        </Tabs>
      </Reveal>

      {/* ===== Dialog: mudar status ===== */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GearSix className="size-5" weight="fill" />
              Mudar Status da Competição
            </DialogTitle>
            <DialogDescription>
              Atualize o status da competição &quot;{campaign.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Novo Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {Object.entries(CAMPAIGN_STATUS_CONFIG).map(
                  ([value, config]) => (
                    <SelectItem key={value} value={value}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn("size-2 rounded-full", config.dot)}
                        />
                        {config.label}
                      </span>
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setIsStatusDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              disabled={!newStatus || updateCampaign.isPending}
              onClick={() =>
                updateCampaign.mutate({
                  id: campaign.id,
                  data: {
                    status: newStatus as
                      | "DRAFT"
                      | "SCHEDULED"
                      | "ACTIVE"
                      | "PAUSED"
                      | "COMPLETED"
                      | "ARCHIVED",
                  },
                })
              }
            >
              {updateCampaign.isPending ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <CheckCircle className="size-4" weight="fill" />
              )}
              Atualizar Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialogs: editar + prêmios ===== */}
      <EditCompetitionDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        campaign={campaign}
        onSuccess={() => void refetchDetails()}
      />
      <PrizesDialog
        open={isPrizesOpen}
        onOpenChange={setIsPrizesOpen}
        campaignId={campaign.id}
      />
    </div>
  )
}
