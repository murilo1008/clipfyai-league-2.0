"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  ArrowUpRight,
  CalendarBlank,
  Clock,
  Crown,
  Eye,
  Fire,
  Funnel,
  Hash,
  Lightning,
  MagnifyingGlass,
  Medal,
  Plus,
  Target,
  Timer,
  TrendUp,
  Trophy,
  VideoCamera,
  Wallet,
  X,
} from "@phosphor-icons/react"

import { ClipfyProPricingDialog } from "@/components/clippers/clipfy-pro-pricing-dialog"
import { CreatePostDialog } from "@/components/clippers/create-post-dialog"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { JourneyHeroViz, JourneyHeroVizSkeleton } from "@/components/my-competitions/journey-hero-viz"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  HeroSkeleton,
  StatTilesGridSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

/* ===== Ranking (top3 / top10 / top50 / demais) ===== */
const rankingConfig = {
  top3: {
    icon: Crown,
    color: "text-yellow-500 dark:text-yellow-400",
    badge: "border-yellow-500/40 bg-yellow-500/15",
    label: "TOP 3",
  },
  top10: {
    icon: Medal,
    color: "text-blue-500 dark:text-blue-400",
    badge: "border-blue-500/40 bg-blue-500/15",
    label: "TOP 10",
  },
  top50: {
    icon: Trophy,
    color: "text-emerald-500 dark:text-emerald-400",
    badge: "border-emerald-500/40 bg-emerald-500/15",
    label: "TOP 50",
  },
  other: {
    icon: Target,
    color: "text-zinc-300",
    badge: "border-border bg-muted/60",
    label: "Participando",
  },
} as const

const getRankingConfig = (ranking: number) => {
  if (ranking <= 3) return rankingConfig.top3
  if (ranking <= 10) return rankingConfig.top10
  if (ranking <= 50) return rankingConfig.top50
  return rankingConfig.other
}

/* ===== Helpers ===== */
const getDaysUntilStart = (startDate: string) => {
  const now = new Date()
  const start = new Date(startDate)
  const diffTime = start.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/** Converte strings tipo "R$ 5.000" (com espaço comum ou NBSP) em número. */
const getPrizeValue = (prizeStr: string | undefined) => {
  if (!prizeStr) return 0
  const value = parseFloat(prizeStr.replace(/[^\d,]/g, "").replace(",", "."))
  return isNaN(value) ? 0 : value
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(iso),
  )

const formatPercent = (value: number) =>
  `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`

export default function MyCompetitions() {
  const router = useRouter()
  const { user } = useUser()
  const { maskText } = useMaskedCurrency()

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [isCreatePostOpen, setIsCreatePostOpen] = React.useState(false)
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState<
    string | undefined
  >(undefined)
  const [isProDialogOpen, setIsProDialogOpen] = React.useState(false)

  // Status PRO do usuário
  const { data: userData } = api.user.getCurrentUser.useQuery()
  const isProSubscriber = userData?.subscriptionStatus === "ACTIVE"

  // TODAS as competições ativas (inscrito ou não)
  const { data: myCompetitions = [], isLoading } =
    api.campaign.getAllActiveCompetitions.useQuery()

  const filteredCompetitions = myCompetitions
    .filter((competition) => {
      const matchesSearch = competition.name
        .toLowerCase()
        .includes(search.toLowerCase())
      const matchesStatus =
        statusFilter === "all" || competition.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Já iniciadas primeiro
      const aStarted = getDaysUntilStart(a.startDate) <= 0
      const bStarted = getDaysUntilStart(b.startDate) <= 0
      if (aStarted && !bStarted) return -1
      if (!aStarted && bStarted) return 1
      // Depois, maior prêmio
      return getPrizeValue(b.prize) - getPrizeValue(a.prize)
    })

  const handleOpenCreatePost = (competitionId: string) => {
    setSelectedCompetitionId(competitionId)
    setIsCreatePostOpen(true)
  }

  // ===== Estatísticas =====
  const activeCompetitions = filteredCompetitions.filter(
    (c) => c.status === "ACTIVE",
  ).length
  const totalPosts = filteredCompetitions.reduce((sum, c) => sum + c.myPosts, 0)
  const totalEarned = filteredCompetitions
    .filter((c) => c.actualPrize)
    .reduce((sum, c) => sum + getPrizeValue(c.actualPrize), 0)

  const heroActive = myCompetitions.filter((c) => c.status === "ACTIVE").length
  const heroPosts = myCompetitions.reduce((sum, c) => sum + c.myPosts, 0)

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton stats={3} viz={<JourneyHeroVizSkeleton />} />
        <StatTilesGridSkeleton count={4} className="grid-cols-1 sm:grid-cols-2" />
        <ToolbarSkeleton buttons={1} />
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((index) => (
            <CompetitionCardSkeleton key={index} index={index} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Minhas Competições"
        title={
          <>
            Minhas <span className="text-gradient">competições</span>
          </>
        }
        subtitle="Acompanhe seu desempenho, envie posts e gerencie suas participações em todas as arenas da Clipfy League."
        viz={<JourneyHeroViz />}
        vizSkeleton={<JourneyHeroVizSkeleton />}
        stats={[
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Participando",
            value: myCompetitions.length,
            kind: "int",
          },
          {
            icon: <Lightning className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: heroActive,
            kind: "int",
          },
          {
            icon: <VideoCamera className="size-3.5" weight="fill" />,
            label: "Posts",
            value: heroPosts,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Total de Competições"
            value={filteredCompetitions.length}
            kind="int"
            hint="participando"
            accent="cyan"
          />
          <StatTile
            icon={<Lightning className="size-4" weight="fill" />}
            label="Ativas"
            value={activeCompetitions}
            kind="int"
            hint="em andamento"
            accent="green"
          />
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Posts Submetidos"
            value={totalPosts}
            kind="int"
            hint="total de vídeos"
            accent="cyan"
          />
          <StatTile
            icon={<Wallet className="size-4" weight="fill" />}
            label="Total Ganho"
            value={totalEarned}
            kind="brl"
            hint="em prêmios"
            accent="green"
            gradientValue
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca + status ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:flex-row sm:items-center sm:p-4">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar minhas competições..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10! w-full cursor-pointer rounded-xl sm:w-[200px]">
              <Funnel className="text-muted-foreground size-3.5" />
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="ACTIVE">Em Andamento</SelectItem>
              <SelectItem value="COMPLETED">Concluídas</SelectItem>
              <SelectItem value="PENDING">Pendentes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Reveal>

      {/* ===== Lista de competições ===== */}
      {filteredCompetitions.length === 0 ? (
        <Reveal immediate delayMs={120}>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <Trophy className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                Nenhuma competição encontrada
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {search || statusFilter !== "all"
                  ? "Tente ajustar seus filtros de busca"
                  : "Você ainda não está participando de nenhuma competição"}
              </p>
            </div>
            {myCompetitions.length === 0 && (
              <Button
                onClick={() => router.push("/my-competitions/schedule")}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                <Plus className="size-4" weight="bold" />
                Explorar Competições
              </Button>
            )}
          </div>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredCompetitions.map((competition, index) => {
            const rankConfig = getRankingConfig(competition.myRanking)
            const RankIcon = rankConfig.icon
            const rankPercentile =
              competition.totalParticipants > 0
                ? (competition.myRanking / competition.totalParticipants) * 100
                : 0
            const daysUntil = getDaysUntilStart(competition.startDate)
            const hasStarted = daysUntil <= 0
            const blurPrize = competition.isProOnly && !isProSubscriber

            return (
              <Reveal immediate key={competition.id} delayMs={120 + index * 80}>
                <article className="glass-card glass-card-hover group overflow-hidden rounded-3xl">
                  <div className="grid md:grid-cols-[350px_1fr]">
                    {/* ===== Capa ===== */}
                    <div className="relative aspect-video w-full overflow-hidden md:aspect-auto md:h-full md:min-h-[300px]">
                      <Image
                        src={competition.coverImageUrl}
                        alt={competition.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        priority={index === 0}
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/25" />

                      {/* Badges topo */}
                      <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hasStarted ? (
                            <Badge
                              variant="outline"
                              className="gap-1.5 rounded-full border-emerald-500/40 bg-emerald-500/15 text-emerald-400 backdrop-blur-md"
                            >
                              <Lightning className="size-3" weight="fill" />
                              Em andamento
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1.5 rounded-full border-sky-500/40 bg-sky-500/15 text-sky-400 backdrop-blur-md"
                            >
                              <Timer className="size-3" weight="fill" />
                              Começa em {daysUntil}{" "}
                              {daysUntil === 1 ? "dia" : "dias"}
                            </Badge>
                          )}
                          {competition.isProOnly && (
                            <Badge className="gap-1 rounded-full border-yellow-400/50 bg-gradient-to-r from-yellow-500 to-amber-500 font-black text-black shadow-lg shadow-amber-500/30">
                              <Crown className="size-3" weight="fill" />
                              PRO
                            </Badge>
                          )}
                        </div>
                        {competition.myRanking > 0 && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 rounded-full backdrop-blur-md",
                              rankConfig.badge,
                              rankConfig.color,
                            )}
                          >
                            <RankIcon className="size-3" weight="fill" />
                            <span className="font-bold tabular-nums">
                              #{competition.myRanking}
                            </span>
                          </Badge>
                        )}
                      </div>

                      {/* Posição sobre a capa */}
                      {competition.myRanking > 0 && (
                        <div className="absolute inset-x-3 bottom-3">
                          <div className="rounded-xl border border-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] bg-black/45 p-2.5 backdrop-blur-md">
                            <div className="mb-1.5 flex items-center justify-between text-[11px]">
                              <span className="font-medium text-white/85">
                                Posição
                              </span>
                              <span className="font-bold text-white tabular-nums">
                                {competition.myRanking}º /{" "}
                                {competition.totalParticipants}
                              </span>
                            </div>
                            <Progress
                              value={Math.max(0, 100 - rankPercentile)}
                              className="h-1.5 bg-white/15"
                            />
                            <p className="mt-1 text-[10px] text-white/70">
                              Top {rankPercentile.toFixed(0)}%
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ===== Conteúdo ===== */}
                    <div className="flex min-w-0 flex-col gap-3.5 p-4 sm:p-5 md:p-6">
                      <div>
                        <h3 className="text-base leading-tight font-bold tracking-tight sm:text-lg md:text-xl">
                          {competition.name}
                        </h3>
                        {competition.description && (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
                            {competition.description}
                          </p>
                        )}
                      </div>

                      {/* Plataformas */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {competition.platforms.map((platform) => {
                          const config =
                            platformConfig[platform as PlatformKey]
                          if (!config) return null
                          const PlatformIcon = config.icon
                          return (
                            <Badge
                              key={platform}
                              variant="outline"
                              className={cn(
                                "gap-1.5 rounded-full",
                                config.bgColor,
                                config.borderColor,
                              )}
                            >
                              <PlatformIcon
                                className={cn("size-3", config.color)}
                              />
                              <span className="hidden font-medium min-[420px]:inline">
                                {config.label}
                              </span>
                            </Badge>
                          )
                        })}
                      </div>

                      {/* Stats 2x2 → 4 colunas */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniStat
                          icon={<VideoCamera className="size-3" weight="fill" />}
                          value={String(competition.myPosts)}
                          label="posts"
                          valueClass="text-blue-600 dark:text-blue-400"
                        />
                        <MiniStat
                          icon={<Eye className="size-3" weight="fill" />}
                          value={formatCompact(competition.myTotalViews)}
                          label="views"
                          valueClass="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]"
                        />
                        <MiniStat
                          icon={<TrendUp className="size-3" weight="bold" />}
                          value={formatPercent(competition.myEngagementRate)}
                          label="ER"
                          valueClass="text-pink-600 dark:text-pink-400"
                        />
                        <MiniStat
                          icon={<Fire className="size-3" weight="fill" />}
                          value={formatCompact(competition.totalPosts)}
                          label="total"
                          valueClass="text-orange-600 dark:text-orange-400"
                        />
                      </div>

                      {/* Período */}
                      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs sm:text-[13px]">
                        <CalendarBlank className="size-3.5 shrink-0" />
                        {formatDate(competition.startDate)} –{" "}
                        {formatDate(competition.endDate)}
                      </p>

                      {/* Prêmio */}
                      {competition.status === "COMPLETED" &&
                      competition.actualPrize ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Medal className="size-3.5" weight="fill" />
                            Prêmio
                          </span>
                          <span
                            className={cn(
                              "text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400",
                              blurPrize && "blur-sm select-none",
                            )}
                          >
                            {maskText(competition.actualPrize)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Wallet className="size-3.5" weight="fill" />
                            Potencial
                          </span>
                          <span
                            className={cn(
                              "text-sm font-bold text-amber-600 tabular-nums dark:text-amber-400",
                              blurPrize && "blur-sm select-none",
                            )}
                          >
                            {maskText(competition.myPotentialPrize)}
                          </span>
                        </div>
                      )}

                      {/* Hashtags */}
                      {competition.requiredHashtags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Hash className="text-muted-foreground size-3.5 shrink-0" />
                          {competition.requiredHashtags
                            .slice(0, 2)
                            .map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary rounded-full font-mono text-[10px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          {competition.requiredHashtags.length > 2 && (
                            <span className="text-muted-foreground text-[10px] font-semibold">
                              +{competition.requiredHashtags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* CTAs por status de inscrição */}
                      {competition.applicationStatus === null ? (
                        <div className="mt-auto pt-1">
                          <Button
                            className="btn-gradient-auth h-10 w-full cursor-pointer rounded-xl font-semibold"
                            onClick={() => {
                              if (competition.isProOnly && !isProSubscriber) {
                                setIsProDialogOpen(true)
                              } else {
                                router.push(
                                  `/my-competitions/schedule?campaign=${competition.slug}`,
                                )
                              }
                            }}
                          >
                            {competition.isProOnly && !isProSubscriber ? (
                              <>
                                <Crown className="size-4" weight="fill" />
                                Assinar PRO
                              </>
                            ) : (
                              <>
                                <Plus className="size-4" weight="bold" />
                                Inscrever-se
                              </>
                            )}
                          </Button>
                        </div>
                      ) : competition.applicationStatus === "APPROVED" ? (
                        <div className="mt-auto flex flex-col gap-2 pt-1 min-[420px]:flex-row">
                          <Button
                            variant="outline"
                            className="h-10 flex-1 cursor-pointer rounded-xl font-semibold"
                            onClick={() =>
                              router.push(`/my-competitions/${competition.slug}`)
                            }
                          >
                            <ArrowUpRight className="size-4" weight="bold" />
                            Ver Detalhes
                          </Button>
                          {competition.status === "ACTIVE" && (
                            <Button
                              className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl font-semibold"
                              onClick={() =>
                                handleOpenCreatePost(competition.id)
                              }
                            >
                              <Plus className="size-4" weight="bold" />
                              Enviar Post
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-auto pt-1">
                          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
                            <Clock
                              className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
                              weight="fill"
                            />
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                              {competition.applicationStatus === "PENDING" &&
                                "Aguardando aprovação do admin"}
                              {competition.applicationStatus === "REJECTED" &&
                                "Inscrição rejeitada"}
                              {competition.applicationStatus ===
                                "UNDER_REVIEW" && "Inscrição em análise"}
                              {competition.applicationStatus === "REVOKED" &&
                                "Inscrição revogada"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Dialogs ===== */}
      <CreatePostDialog
        open={isCreatePostOpen}
        onOpenChange={setIsCreatePostOpen}
        preSelectedCampaignId={selectedCompetitionId}
      />
      <ClipfyProPricingDialog
        open={isProDialogOpen}
        onOpenChange={setIsProDialogOpen}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
      />
    </div>
  )
}

/* ===== Mini stat do card horizontal ===== */
function MiniStat({
  icon,
  value,
  label,
  valueClass,
}: {
  icon: React.ReactNode
  value: string
  label: string
  valueClass?: string
}) {
  return (
    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2">
      <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums">
        <span className="text-foreground/70">{icon}</span>
        <span className={valueClass}>{value}</span>
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

/* ===== Skeleton fantasma do card horizontal ===== */
function CompetitionCardSkeleton({ index }: { index: number }) {
  const base = index * 150
  return (
    <div className="glass-card overflow-hidden rounded-3xl">
      <div className="grid md:grid-cols-[350px_1fr]">
        {/* Capa fantasma */}
        <div className="relative aspect-video w-full md:aspect-square md:h-full">
          <Bone delay={base} className="h-full w-full rounded-none" />
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            <Bone delay={base + 60} className="h-6 w-28 rounded-full" />
            <Bone delay={base + 120} className="h-6 w-14 rounded-full" />
          </div>
          <div className="absolute inset-x-3 bottom-3">
            <Bone delay={base + 180} className="h-16 w-full rounded-xl" />
          </div>
        </div>
        {/* Conteúdo fantasma */}
        <div className="flex min-w-0 flex-col gap-3.5 p-4 sm:p-5 md:p-6">
          <div className="flex flex-col gap-2">
            <Bone delay={base + 80} className="h-5 w-3/4 max-w-sm" />
            <Bone delay={base + 140} className="h-4 w-full max-w-md rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[0, 1, 2].map((chip) => (
              <Bone
                key={chip}
                delay={base + 200 + chip * 60}
                className="h-6 w-20 rounded-full"
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((stat) => (
              <Bone
                key={stat}
                delay={base + 260 + stat * 60}
                className="h-[58px] rounded-xl"
              />
            ))}
          </div>
          <Bone delay={base + 420} className="h-4 w-44 rounded-full" />
          <Bone delay={base + 480} className="h-10 w-full rounded-xl" />
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            <Bone delay={base + 540} className="h-10 flex-1 rounded-xl" />
            <Bone delay={base + 600} className="h-10 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
