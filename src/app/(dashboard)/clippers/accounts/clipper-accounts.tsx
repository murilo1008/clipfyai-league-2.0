"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  ArrowsDownUp,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
  CaretUpDown,
  Check,
  CheckCircle,
  Crown,
  Eye,
  Globe,
  MagnifyingGlass,
  Pulse,
  ShieldWarning,
  Tag,
  Trophy,
  UsersThree,
  VideoCamera,
  X,
  XCircle,
} from "@phosphor-icons/react"

import { AccountsHeroViz, AccountsHeroVizSkeleton } from "@/components/clippers/accounts-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { SectionHeading } from "@/components/home/section-heading"
import { StatTile } from "@/components/home/stat-tile"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import { Bone, ListRowsSkeleton } from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

const nicheConfig: Record<string, { label: string; emoji: string }> = {
  MOTIVATIONAL: { label: "Motivacional", emoji: "💪" }, GOSSIP: { label: "Fofoca", emoji: "🗣️" }, MEME: { label: "Meme", emoji: "😂" }, ENTREPRENEURSHIP: { label: "Empreendedorismo", emoji: "🚀" }, HUMOR: { label: "Humor", emoji: "🤣" }, GAMING: { label: "Gaming", emoji: "🎮" }, SPORTS: { label: "Esportes", emoji: "⚽" }, MUSIC: { label: "Música", emoji: "🎵" }, EDUCATION: { label: "Educação", emoji: "📚" }, NEWS: { label: "Notícias", emoji: "📰" }, POLITICS: { label: "Política", emoji: "🏛️" }, LIFESTYLE: { label: "Lifestyle", emoji: "✨" }, FITNESS: { label: "Fitness", emoji: "🏋️" }, FASHION: { label: "Moda", emoji: "👗" }, BEAUTY: { label: "Beleza", emoji: "💄" }, FOOD: { label: "Comida", emoji: "🍕" }, TRAVEL: { label: "Viagem", emoji: "✈️" }, TECH: { label: "Tecnologia", emoji: "💻" }, FINANCE: { label: "Finanças", emoji: "💰" }, RELIGION: { label: "Religião", emoji: "🙏" }, ENTERTAINMENT: { label: "Entretenimento", emoji: "🎬" }, HOT: { label: "Hot", emoji: "🔥" }, FAMILY: { label: "Família", emoji: "👨‍👩‍👧‍👦" }, MATERNITY: { label: "Maternidade", emoji: "🤱" }, PATERNITY: { label: "Paternidade", emoji: "👨‍👧" }, MARRIAGE: { label: "Casamento", emoji: "💍" }, BODYBUILDING: { label: "Maromba", emoji: "💪🏋️" }, WOMEN: { label: "Mulher", emoji: "👩" }, MEN: { label: "Homem", emoji: "👨" }, COUPLE: { label: "Casal", emoji: "💑" }, PETS: { label: "Pets", emoji: "🐾" }, CARS: { label: "Carros", emoji: "🚗" }, MOTORCYCLES: { label: "Motos", emoji: "🏍️" }, ANIME: { label: "Anime", emoji: "🎌" }, KPOP: { label: "K-Pop", emoji: "🇰🇷" }, DANCE: { label: "Dança", emoji: "💃" }, COMEDY: { label: "Comédia", emoji: "😆" }, DRAMA: { label: "Drama", emoji: "🎭" }, ASTROLOGY: { label: "Astrologia", emoji: "♈" }, PSYCHOLOGY: { label: "Psicologia", emoji: "🧠" }, SELF_HELP: { label: "Autoajuda", emoji: "📖" }, PRODUCTIVITY: { label: "Produtividade", emoji: "⏱️" }, MARKETING: { label: "Marketing", emoji: "📢" }, SALES: { label: "Vendas", emoji: "🛒" }, REAL_ESTATE: { label: "Imobiliário", emoji: "🏠" }, CRYPTO: { label: "Cripto", emoji: "₿" }, INVESTING: { label: "Investimentos", emoji: "📈" }, DIY: { label: "Faça Você Mesmo", emoji: "🔨" }, ART: { label: "Arte", emoji: "🎨" }, PHOTOGRAPHY: { label: "Fotografia", emoji: "📷" }, CINEMA: { label: "Cinema", emoji: "🎥" }, SERIES: { label: "Séries", emoji: "📺" }, BOOKS: { label: "Livros", emoji: "📚" }, PODCAST: { label: "Podcast", emoji: "🎙️" }, ASMR: { label: "ASMR", emoji: "🎧" }, NATURE: { label: "Natureza", emoji: "🌿" }, SUSTAINABILITY: { label: "Sustentabilidade", emoji: "♻️" }, HEALTH: { label: "Saúde", emoji: "🏥" }, MENTAL_HEALTH: { label: "Saúde Mental", emoji: "🧘" }, NUTRITION: { label: "Nutrição", emoji: "🥗" }, VEGAN: { label: "Vegano", emoji: "🌱" }, COOKING: { label: "Culinária", emoji: "👨‍🍳" }, CONFECTIONERY: { label: "Confeitaria", emoji: "🎂" }, DECORATION: { label: "Decoração", emoji: "🏡" }, PARENTING: { label: "Parentalidade", emoji: "👪" }, BABY: { label: "Bebê", emoji: "👶" }, KIDS: { label: "Crianças", emoji: "🧒" }, UNIVERSITY: { label: "Universidade", emoji: "🎓" }, LAW: { label: "Direito", emoji: "⚖️" }, MEDICINE: { label: "Medicina", emoji: "🩺" }, SCIENCE: { label: "Ciência", emoji: "🔬" }, CROSSFIT: { label: "CrossFit", emoji: "🏋️‍♂️" }, YOGA: { label: "Yoga", emoji: "🧘‍♀️" }, RUNNING: { label: "Corrida", emoji: "🏃" }, MARTIAL_ARTS: { label: "Artes Marciais", emoji: "🥋" }, SOCCER: { label: "Futebol", emoji: "⚽" }, ESPORTS: { label: "E-Sports", emoji: "🕹️" }, STREAMER: { label: "Streamer", emoji: "📡" }, COSPLAY: { label: "Cosplay", emoji: "🎭" }, TATTOO: { label: "Tatuagem", emoji: "💉" }, NAILS: { label: "Unhas", emoji: "💅" }, HAIR: { label: "Cabelo", emoji: "💇" }, SKINCARE: { label: "Skincare", emoji: "🧴" }, MAKEUP: { label: "Maquiagem", emoji: "💄" }, LUXURY: { label: "Luxo", emoji: "👑" }, STREETWEAR: { label: "Streetwear", emoji: "🧢" }, SNEAKERS: { label: "Sneakers", emoji: "👟" }, WEDDING: { label: "Casamentos", emoji: "👰" }, PARTY: { label: "Festas", emoji: "🎉" }, FUNK: { label: "Funk", emoji: "🎶" }, SERTANEJO: { label: "Sertanejo", emoji: "🤠" }, RAP: { label: "Rap", emoji: "🎤" }, ROCK: { label: "Rock", emoji: "🎸" }, GOSPEL: { label: "Gospel", emoji: "✝️" }, LGBTQ: { label: "LGBTQ+", emoji: "🏳️‍🌈" }, ACTIVISM: { label: "Ativismo", emoji: "✊" }, SPIRITUAL: { label: "Espiritualidade", emoji: "🕊️" }, TAROT: { label: "Tarot", emoji: "🃏" }, TRUE_CRIME: { label: "True Crime", emoji: "🔍" }, HORROR: { label: "Terror", emoji: "👻" }, CHALLENGES: { label: "Desafios", emoji: "🏆" }, PRANKS: { label: "Pegadinhas", emoji: "😜" }, REACTIONS: { label: "Reações", emoji: "😱" }, UNBOXING: { label: "Unboxing", emoji: "📦" }, REVIEWS: { label: "Reviews", emoji: "⭐" }, TUTORIALS: { label: "Tutoriais", emoji: "📝" }, TIPS: { label: "Dicas", emoji: "💡" }, STORYTIME: { label: "Storytime", emoji: "📖" }, RELATIONSHIPS: { label: "Relacionamentos", emoji: "❤️‍🔥" }, DATING: { label: "Paquera", emoji: "💘" }, THERAPY: { label: "Terapia", emoji: "🛋️" }, OTHER: { label: "Outro", emoji: "📌" },
}

const sortedNiches = Object.entries(nicheConfig).sort((a, b) =>
  a[1].label.localeCompare(b[1].label, "pt-BR"),
)

type SortKey =
  | "newest"
  | "oldest"
  | "followers_desc"
  | "followers_asc"
  | "totalViews_desc"
  | "totalPosts_desc"

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Mais recente",
  oldest: "Mais antiga",
  totalViews_desc: "Mais views (posts)",
  totalPosts_desc: "Mais posts",
  followers_desc: "Mais seguidores",
  followers_asc: "Menos seguidores",
}

const fmtOrDash = (value: number | null | undefined) =>
  value == null || value === 0 ? "—" : formatCompact(value)

const RANK_STYLES = [
  "bg-gradient-custom text-[#04222A]",
  "bg-slate-400/25 text-slate-600 dark:text-slate-300",
  "bg-orange-500/20 text-orange-600 dark:text-orange-400",
] as const

export default function ClipperAccounts() {
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [platform, setPlatform] = React.useState<PlatformKey | "all">("all")
  const [status, setStatus] = React.useState<"all" | "active" | "inactive">(
    "all",
  )
  const [niche, setNiche] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<SortKey>("newest")
  const [page, setPage] = React.useState(1)
  const [showNicheAnalysis, setShowNicheAnalysis] = React.useState(false)
  const [platformOpen, setPlatformOpen] = React.useState(false)
  const [nicheOpen, setNicheOpen] = React.useState(false)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [search])

  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = api.admin.getSocialAccountsStats.useQuery(undefined, { retry: false })

  const { data: topViewsData, isLoading: isLoadingTopViews } =
    api.admin.getAllSocialAccounts.useQuery(
      { sortBy: "totalViews_desc", perPage: 10, page: 1 },
      { retry: false },
    )

  const { data: accountsData, isLoading: isLoadingAccounts } =
    api.admin.getAllSocialAccounts.useQuery(
      {
        platform: platform !== "all" ? platform : undefined,
        search: debouncedSearch || undefined,
        isActive: status === "all" ? undefined : status === "active",
        niche: niche !== "all" ? niche : undefined,
        page,
        perPage: 30,
        sortBy,
      },
      { retry: false },
    )

  const topViewsAccounts = topViewsData?.accounts ?? []
  const accounts = accountsData?.accounts ?? []
  const totalCount = accountsData?.totalCount ?? 0
  const totalPages = accountsData?.totalPages ?? 1

  const topNiches = React.useMemo(() => {
    if (!stats?.nicheCounts) return []
    return stats.nicheCounts
      .filter((entry) => entry.niche !== null)
      .slice(0, 15)
  }, [stats])

  const maxNicheCount = React.useMemo(
    () =>
      topNiches.length > 0
        ? Math.max(...topNiches.map((entry) => entry.count))
        : 1,
    [topNiches],
  )

  const hasActiveFilters =
    platform !== "all" ||
    status !== "all" ||
    niche !== "all" ||
    debouncedSearch !== ""

  const activePct =
    stats && stats.totalAccounts > 0
      ? (stats.activeAccounts / stats.totalAccounts) * 100
      : null

  // ===== Acesso restrito =====
  if (statsError) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-500 dark:text-red-400">
              <ShieldWarning className="size-7" weight="fill" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">
                Acesso restrito a administradores
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm leading-relaxed">
                Você não tem permissão para visualizar o mapeamento de contas.
                Fale com um administrador se acredita que isso é um engano.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clipadores"
        title={
          <>
            O mapa das <span className="text-gradient">contas sociais</span>
          </>
        }
        subtitle="Visão completa de todas as contas dos clipadores — plataformas, nichos, seguidores e performance de posts em um só lugar."
        viz={<AccountsHeroViz />}
        vizSkeleton={<AccountsHeroVizSkeleton />}
        isLoading={isLoadingStats}
        stats={[
          {
            icon: <Globe className="size-3.5" weight="fill" />,
            label: "Contas",
            value: stats?.totalAccounts ?? 0,
            kind: "int",
          },
          {
            icon: <CheckCircle className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: stats?.activeAccounts ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: stats?.clipPostStats.totalViews ?? 0,
            kind: "compact",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            icon={<Globe className="size-4" weight="fill" />}
            label="Total de Contas"
            value={stats?.totalAccounts ?? 0}
            kind="int"
            hint="contas cadastradas"
            accent="cyan"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<CheckCircle className="size-4" weight="fill" />}
            label="Ativas"
            value={stats?.activeAccounts ?? 0}
            kind="int"
            hint={
              activePct != null
                ? `${activePct.toFixed(0)}% do total`
                : "em operação"
            }
            accent="green"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Views (posts)"
            value={stats?.clipPostStats.totalViews ?? 0}
            kind="compact"
            hint="de todos os posts"
            accent="cyan"
            gradientValue
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Posts"
            value={stats?.clipPostStats.totalPosts ?? 0}
            kind="compact"
            hint={
              stats
                ? `${formatCompact(stats.clipPostStats.clippersWithPosts)} clipadores com posts`
                : "enviados"
            }
            accent="green"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Seguidores"
            value={stats?.followersStats.total ?? 0}
            kind="compact"
            hint="somando todas as contas"
            accent="cyan"
            isLoading={isLoadingStats}
          />
        </div>
      </Reveal>

      {/* ===== Análise por nicho ===== */}
      <Reveal immediate delayMs={60}>
        <div className="flex flex-col gap-4">
          <div>
            <Button
              variant="outline"
              onClick={() => setShowNicheAnalysis((open) => !open)}
              className={cn(
                "h-10 cursor-pointer rounded-xl",
                showNicheAnalysis &&
                  "border-brand-cyan/40 bg-brand-cyan/10 not-dark:border-primary/40 not-dark:bg-primary/5",
              )}
            >
              <Tag className="size-4" weight="fill" />
              {showNicheAnalysis
                ? "Ocultar Análise por Nicho"
                : "Análise por Nicho"}
            </Button>
          </div>

          {showNicheAnalysis && (
            <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
              <SectionHeading
                icon={<Tag className="size-4" weight="fill" />}
                title="Top 15 Nichos"
                description="Clique em um nicho para filtrar a listagem de contas"
              />
              {isLoadingStats ? (
                <div className="flex flex-col gap-2.5">
                  {[
                    "w-[92%]",
                    "w-[76%]",
                    "w-[64%]",
                    "w-[55%]",
                    "w-[46%]",
                    "w-[37%]",
                    "w-[29%]",
                    "w-[21%]",
                  ].map((barWidth, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 px-1.5 py-1"
                    >
                      <div className="flex w-32 shrink-0 items-center gap-1.5 sm:w-40">
                        <Bone
                          delay={index * 70}
                          className="size-4 rounded-md"
                        />
                        <Bone
                          delay={index * 70 + 60}
                          className="h-3 w-20 rounded-full sm:w-24"
                        />
                      </div>
                      <div className="bg-muted/40 h-2 flex-1 overflow-hidden rounded-full">
                        <Bone
                          delay={index * 70 + 120}
                          className={cn("h-full rounded-full", barWidth)}
                        />
                      </div>
                      <Bone
                        delay={index * 70 + 180}
                        className="h-3 w-14 shrink-0 rounded-full"
                      />
                    </div>
                  ))}
                </div>
              ) : topNiches.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  Nenhum dado de nicho disponível
                </p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {topNiches.map((entry) => {
                    const key = entry.niche as string
                    const config = nicheConfig[key]
                    const pct = Math.max(
                      (entry.count / maxNicheCount) * 100,
                      2,
                    )
                    const isSelected = niche === key
                    return (
                      <Tooltip key={key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setNiche(isSelected ? "all" : key)
                              setPage(1)
                            }}
                            className={cn(
                              "group/bar flex w-full cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors",
                              isSelected
                                ? "bg-brand-cyan/10 not-dark:bg-primary/5"
                                : "hover:bg-muted/40",
                            )}
                          >
                            <div className="flex w-32 shrink-0 items-center gap-1.5 sm:w-40">
                              <span className="text-sm leading-none">
                                {config?.emoji ?? "📌"}
                              </span>
                              <span className="text-foreground/90 truncate text-xs font-medium sm:text-[13px]">
                                {config?.label ?? key}
                              </span>
                            </div>
                            <div className="bg-muted/60 relative h-2 flex-1 overflow-hidden rounded-full">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-foreground w-14 shrink-0 text-right text-xs font-semibold tabular-nums sm:text-[13px]">
                              {formatCompact(entry.count)}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {`${config?.label ?? key} · ${entry.count.toLocaleString("pt-BR")} contas · ${fmtOrDash(entry.totalViews)} views · ${fmtOrDash(entry.totalFollowers)} seguidores`}
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Top 10 contas por views ===== */}
      <Reveal immediate delayMs={100}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<Trophy className="size-4" weight="fill" />}
            title="Top 10 Contas por Views"
            description="As contas que mais geraram visualizações em posts"
          />
          {isLoadingTopViews ? (
            <ListRowsSkeleton rows={10} />
          ) : topViewsAccounts.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nenhuma conta com dados de views ainda
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {topViewsAccounts.map((account, index) => {
                const config = platformConfig[account.platform as PlatformKey]
                const PlatformIcon = config?.icon
                const isTop3 = index < 3
                const displayName =
                  account.clipperProfile.artisticName ??
                  account.clipperProfile.fullName ??
                  "—"
                return (
                  <div
                    key={account.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                      isTop3
                        ? "border border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_6%,transparent)]"
                        : "bg-muted/30 hover:bg-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                        isTop3
                          ? RANK_STYLES[index]
                          : "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      {index + 1}º
                    </span>
                    <Avatar className="border-border/60 size-8 shrink-0 border">
                      <AvatarImage
                        src={account.clipperProfile.user.imageUrl ?? undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-brand-cyan/15 text-[10px] font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {displayName}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        {PlatformIcon && (
                          <PlatformIcon
                            className={cn("size-3 shrink-0", config.color)}
                          />
                        )}
                        <span className="truncate">@{account.username}</span>
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-[10px] font-semibold tracking-wide uppercase">
                        <span className="text-muted-foreground">Posts</span>
                      </p>
                      <p className="text-xs font-semibold tabular-nums">
                        {formatCompact(account.totalPosts)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                        Views
                      </p>
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          isTop3 &&
                            "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
                        )}
                      >
                        {formatCompact(account.totalViews)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Toolbar de filtros ===== */}
      <Reveal immediate delayMs={140}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por username ou nome do clipador..."
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

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Plataforma */}
              <Popover open={platformOpen} onOpenChange={setPlatformOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={platformOpen}
                    className="h-10 cursor-pointer rounded-xl"
                  >
                    {platform !== "all" ? (
                      <span className="inline-flex items-center gap-2">
                        {(() => {
                          const PlatformIcon = platformConfig[platform].icon
                          return (
                            <PlatformIcon
                              className={cn(
                                "size-4",
                                platformConfig[platform].color,
                              )}
                            />
                          )
                        })()}
                        {platformConfig[platform].label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Globe className="size-4" />
                        Plataforma
                      </span>
                    )}
                    <CaretUpDown className="size-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 rounded-xl p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma plataforma.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Todas as plataformas"
                          className="cursor-pointer"
                          onSelect={() => {
                            setPlatform("all")
                            setPage(1)
                            setPlatformOpen(false)
                          }}
                        >
                          <Globe className="text-muted-foreground size-4" />
                          Todas as plataformas
                          {platform === "all" && (
                            <Check className="ml-auto size-3.5" />
                          )}
                        </CommandItem>
                        {(
                          Object.keys(platformConfig) as PlatformKey[]
                        ).map((key) => {
                          const config = platformConfig[key]
                          const PlatformIcon = config.icon
                          return (
                            <CommandItem
                              key={key}
                              value={config.label}
                              className="cursor-pointer"
                              onSelect={() => {
                                setPlatform(key)
                                setPage(1)
                                setPlatformOpen(false)
                              }}
                            >
                              <PlatformIcon
                                className={cn("size-4", config.color)}
                              />
                              {config.label}
                              {platform === key && (
                                <Check className="ml-auto size-3.5" />
                              )}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Nicho */}
              <Popover open={nicheOpen} onOpenChange={setNicheOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={nicheOpen}
                    className="h-10 max-w-44 cursor-pointer rounded-xl"
                  >
                    {niche !== "all" && nicheConfig[niche] ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span>{nicheConfig[niche].emoji}</span>
                        <span className="truncate">
                          {nicheConfig[niche].label}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Tag className="size-4" />
                        Nicho
                      </span>
                    )}
                    <CaretUpDown className="size-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 rounded-xl p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Buscar..." />
                    <CommandList className="max-h-64">
                      <CommandEmpty>Nenhum nicho encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Todos os nichos"
                          className="cursor-pointer"
                          onSelect={() => {
                            setNiche("all")
                            setPage(1)
                            setNicheOpen(false)
                          }}
                        >
                          <span>🌐</span>
                          Todos os nichos
                          {niche === "all" && (
                            <Check className="ml-auto size-3.5" />
                          )}
                        </CommandItem>
                        {sortedNiches.map(([key, { label, emoji }]) => (
                          <CommandItem
                            key={key}
                            value={label}
                            className="cursor-pointer"
                            onSelect={() => {
                              setNiche(key)
                              setPage(1)
                              setNicheOpen(false)
                            }}
                          >
                            <span>{emoji}</span>
                            {label}
                            {niche === key && (
                              <Check className="ml-auto size-3.5" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Status */}
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as typeof status)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-10! cursor-pointer rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">
                    <CheckCircle className="size-4 text-emerald-500" />
                    Ativa
                  </SelectItem>
                  <SelectItem value="inactive">
                    <XCircle className="size-4 text-red-400" />
                    Inativa
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Ordenação */}
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  setSortBy(value as SortKey)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-10! cursor-pointer rounded-xl">
                  <ArrowsDownUp className="text-muted-foreground size-3.5" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent className="rounded-xl" align="end">
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chips de filtros ativos */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                Filtros ativos
              </span>
              {debouncedSearch && (
                <FilterChip
                  label={`"${debouncedSearch}"`}
                  icon={<MagnifyingGlass className="size-3" />}
                  onClear={() => setSearch("")}
                />
              )}
              {platform !== "all" && (
                <FilterChip
                  label={platformConfig[platform].label}
                  icon={(() => {
                    const PlatformIcon = platformConfig[platform].icon
                    return (
                      <PlatformIcon
                        className={cn(
                          "size-3",
                          platformConfig[platform].color,
                        )}
                      />
                    )
                  })()}
                  onClear={() => {
                    setPlatform("all")
                    setPage(1)
                  }}
                />
              )}
              {status !== "all" && (
                <FilterChip
                  label={status === "active" ? "Ativas" : "Inativas"}
                  icon={
                    status === "active" ? (
                      <CheckCircle className="size-3 text-emerald-500" />
                    ) : (
                      <XCircle className="size-3 text-red-400" />
                    )
                  }
                  onClear={() => {
                    setStatus("all")
                    setPage(1)
                  }}
                />
              )}
              {niche !== "all" && (
                <FilterChip
                  label={nicheConfig[niche]?.label ?? niche}
                  icon={<span>{nicheConfig[niche]?.emoji ?? "📌"}</span>}
                  onClear={() => {
                    setNiche("all")
                    setPage(1)
                  }}
                />
              )}
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {totalCount.toLocaleString("pt-BR")} resultado
                {totalCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Listagem de contas ===== */}
      {isLoadingAccounts ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => {
            const base = (index % 3) * 120
            return (
              <div
                key={index}
                className="glass-card flex h-full flex-col gap-3.5 rounded-3xl p-4 sm:p-5"
              >
                {/* cabeçalho fantasma: avatar + nome/username + badge */}
                <div className="flex items-start gap-3">
                  <Bone
                    delay={base}
                    className="size-10 shrink-0 rounded-full"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Bone delay={base + 60} className="h-4 w-3/5 max-w-36" />
                    <Bone
                      delay={base + 120}
                      className="h-3 w-2/5 max-w-28 rounded-full"
                    />
                  </div>
                  <Bone delay={base + 180} className="h-5 w-14 rounded-full" />
                </div>

                {/* mini-grid de métricas fantasma */}
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, statIndex) => (
                    <Bone
                      key={statIndex}
                      delay={base + 240 + statIndex * 60}
                      className="h-14 rounded-xl"
                    />
                  ))}
                </div>

                {/* badges fantasma de nicho e plataforma */}
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <Bone delay={base + 300} className="h-5 w-24 rounded-full" />
                  <Bone delay={base + 360} className="h-5 w-20 rounded-full" />
                </div>
              </div>
            )
          })}
        </div>
      ) : accounts.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <MagnifyingGlass className="size-6" weight="bold" />
            </span>
            <div>
              <p className="text-base font-bold">Nenhuma conta encontrada</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {hasActiveFilters
                  ? "Tente ajustar seus filtros ou termos de busca"
                  : "Ainda não há contas sociais cadastradas"}
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account, index) => {
            const config = platformConfig[account.platform as PlatformKey]
            const PlatformIcon = config?.icon
            const nicheEntry = account.niche
              ? nicheConfig[account.niche]
              : null
            const displayName =
              account.clipperProfile.artisticName ??
              account.clipperProfile.fullName ??
              "—"
            return (
              <Reveal immediate key={account.id} delayMs={(index % 3) * 80}>
                <div
                  className={cn(
                    "glass-card glass-card-hover flex h-full flex-col gap-3.5 rounded-3xl p-4 sm:p-5",
                    !account.isActive && "opacity-70",
                  )}
                >
                  {/* Cabeçalho */}
                  <div className="flex items-start gap-3">
                    <Avatar className="border-border/60 size-10 shrink-0 border">
                      <AvatarImage
                        src={account.clipperProfile.user.imageUrl ?? undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-brand-cyan/15 text-xs font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold tracking-tight">
                        {displayName}
                      </p>
                      {account.profileUrl ? (
                        <a
                          href={account.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground inline-flex max-w-full items-center gap-1.5 text-xs transition-colors"
                        >
                          {PlatformIcon && (
                            <PlatformIcon
                              className={cn("size-3.5 shrink-0", config.color)}
                            />
                          )}
                          <span className="truncate">@{account.username}</span>
                          <ArrowSquareOut className="size-3 shrink-0" />
                        </a>
                      ) : (
                        <p className="text-muted-foreground inline-flex max-w-full items-center gap-1.5 text-xs">
                          {PlatformIcon && (
                            <PlatformIcon
                              className={cn("size-3.5 shrink-0", config.color)}
                            />
                          )}
                          <span className="truncate">@{account.username}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full text-[10px]",
                          account.isActive
                            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400",
                        )}
                      >
                        {account.isActive ? "Ativa" : "Inativa"}
                      </Badge>
                      {account.isPrimary && (
                        <Badge
                          variant="outline"
                          className="gap-1 rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          <Crown className="size-2.5" weight="fill" />
                          Principal
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-4 gap-2">
                    <CardStat
                      icon={<Eye className="size-3" weight="fill" />}
                      value={formatCompact(account.totalViews)}
                      label="views"
                      highlight
                    />
                    <CardStat
                      icon={<VideoCamera className="size-3" weight="fill" />}
                      value={formatCompact(account.totalPosts)}
                      label="posts"
                    />
                    <CardStat
                      icon={<UsersThree className="size-3" weight="fill" />}
                      value={fmtOrDash(account.followers)}
                      label="seguid."
                    />
                    <CardStat
                      icon={<Pulse className="size-3" weight="fill" />}
                      value={
                        account.avgEngagementRate
                          ? `${account.avgEngagementRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                          : "—"
                      }
                      label="ER"
                    />
                  </div>

                  {/* Badges de nicho e plataforma */}
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {nicheEntry ? (
                      <Badge
                        variant="outline"
                        className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary gap-1 rounded-full text-[10px]"
                      >
                        <span>{nicheEntry.emoji}</span>
                        {nicheEntry.label}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground rounded-full text-[10px]"
                      >
                        Sem nicho
                      </Badge>
                    )}
                    {config && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 rounded-full text-[10px]",
                          config.borderColor,
                          config.bgColor,
                          config.color,
                        )}
                      >
                        {PlatformIcon && <PlatformIcon className="size-3" />}
                        {config.label}
                      </Badge>
                    )}
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Paginação ===== */}
      {!isLoadingAccounts && totalPages > 1 && (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center justify-between gap-3 rounded-3xl p-3.5 sm:flex-row sm:p-4">
            <p className="text-muted-foreground text-xs sm:text-sm">
              Página{" "}
              <span className="text-foreground font-semibold">{page}</span> de{" "}
              <span className="text-foreground font-semibold">
                {totalPages}
              </span>
              {" · "}
              {totalCount.toLocaleString("pt-BR")} contas
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                aria-label="Primeira página"
                className="hidden h-9 w-9 cursor-pointer rounded-xl p-0 sm:flex"
              >
                <CaretDoubleLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="h-9 w-9 cursor-pointer rounded-xl p-0"
              >
                <CaretLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, index) => {
                    let pageNumber: number
                    if (totalPages <= 5) {
                      pageNumber = index + 1
                    } else if (page <= 3) {
                      pageNumber = index + 1
                    } else if (page >= totalPages - 2) {
                      pageNumber = totalPages - 4 + index
                    } else {
                      pageNumber = page - 2 + index
                    }
                    return (
                      <Button
                        key={pageNumber}
                        variant={page === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNumber)}
                        className={cn(
                          "h-9 w-9 cursor-pointer rounded-xl p-0 text-xs tabular-nums",
                          page === pageNumber && "btn-gradient-auth font-bold",
                        )}
                      >
                        {pageNumber}
                      </Button>
                    )
                  },
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={page >= totalPages}
                aria-label="Próxima página"
                className="h-9 w-9 cursor-pointer rounded-xl p-0"
              >
                <CaretRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                aria-label="Última página"
                className="hidden h-9 w-9 cursor-pointer rounded-xl p-0 sm:flex"
              >
                <CaretDoubleRight className="size-4" />
              </Button>
            </div>
          </div>
        </Reveal>
      )}
    </div>
  )
}

function FilterChip({
  label,
  icon,
  onClear,
}: {
  label: string
  icon: React.ReactNode
  onClear: () => void
}) {
  return (
    <Badge
      variant="outline"
      className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/30 gap-1.5 rounded-full py-1 pr-1.5 pl-2.5 text-xs"
    >
      {icon}
      <span className="max-w-36 truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remover filtro ${label}`}
        className="text-muted-foreground hover:text-foreground flex size-4 cursor-pointer items-center justify-center rounded-full transition-colors"
      >
        <X className="size-3" />
      </button>
    </Badge>
  )
}

function CardStat({
  icon,
  value,
  label,
  highlight = false,
}: {
  icon: React.ReactNode
  value: string
  label: string
  highlight?: boolean
}) {
  return (
    <div className="bg-muted/40 flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1.5 py-2">
      <span className="inline-flex max-w-full items-center gap-1 text-[13px] font-bold tabular-nums">
        <span
          className={cn(
            "shrink-0",
            highlight
              ? "text-brand-mint not-dark:text-primary"
              : "text-foreground/70",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "truncate",
            highlight &&
              "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
          )}
        >
          {value}
        </span>
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}
