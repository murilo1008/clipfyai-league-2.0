"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  ArrowsDownUp,
  Cake,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  ChatCircle,
  CircleNotch,
  Clock,
  Crown,
  DownloadSimple,
  Eye,
  Funnel,
  Heart,
  MagnifyingGlass,
  MapPin,
  Play,
  TrendUp,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { toast } from "sonner"

import { ReportsHeroViz, CompetitionReportsHeroVizSkeleton } from "@/components/competitions/reports-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { PLATFORM_CHART_COLORS } from "@/components/home/platform-chart-meta"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  ChartSkeleton,
  DonutSkeleton,
  ListRowsSkeleton,
  StatTilesGridSkeleton,
  TableSkeleton,
} from "@/components/shared/skeletons"
import { StatTile } from "@/components/home/stat-tile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Map,
  MapMarker,
  MapPopup,
  MapTileLayer,
  MapZoomControl,
} from "@/components/ui/map"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SpBoundary from "@/components/SpBoundary"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import {
  CAMPAIGN_STATUS_CONFIG,
  PositionBadge,
  downloadTextFile,
  escapeCsvCell,
  formatNumber,
} from "../[slug]/shared"

/* ============================================================
   Tipos do contrato
   ============================================================ */

type ReportsData = RouterOutputs["campaign"]["getReports"]
type TopPost = ReportsData["topPostsByViews"][number]
type GrowthPoint = ReportsData["growthData"][number]
type PlatformStat = ReportsData["platformStats"][number]
type InfiniteAccount =
  RouterOutputs["campaign"]["getReportsAccounts"]["accounts"][number]

type SortPostsBy = "views" | "likes" | "comments"
type SortAccountsBy = "views" | "posts" | "engagement"

/* ============================================================
   Constantes
   ============================================================ */

const PLATFORM_OPTIONS = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
] as const

/** Séries do gráfico de crescimento — cores da marca theme-aware. */
const GROWTH_SERIES = [
  { key: "views", label: "Views", color: "var(--chart-1)" },
  { key: "likes", label: "Likes", color: "var(--chart-2)" },
  { key: "comments", label: "Comentários", color: "var(--chart-3)" },
] as const

const GROWTH_LABELS: Record<string, string> = {
  views: "Views",
  likes: "Likes",
  comments: "Comentários",
}

const PLATFORM_BAR_SERIES = [
  { key: "postsCount", label: "Posts", color: "var(--chart-1)" },
  { key: "totalLikes", label: "Likes", color: "var(--chart-2)" },
  { key: "totalComments", label: "Comentários", color: "var(--chart-3)" },
] as const

/** Demografia estimada — mesmos valores hardcoded do original. */
const GENDER_DATA = [
  { gender: "Masculino", value: 52, color: "var(--chart-1)" },
  { gender: "Feminino", value: 43, color: "var(--chart-2)" },
  { gender: "Outros", value: 5, color: "var(--chart-3)" },
] as const

const AGE_DATA = [
  { age: "13-17", value: 8, color: "var(--chart-3)" },
  { age: "18-24", value: 32, color: "var(--chart-1)" },
  { age: "25-34", value: 38, color: "var(--chart-2)" },
  { age: "35-44", value: 15, color: "var(--chart-4)" },
  { age: "45+", value: 7, color: "var(--chart-5)" },
] as const

/**
 * Marcadores do mapa de SP — todos os valores literais do original
 * (a Capital é o epicentro e tem popup especial fora deste array).
 */
const CITY_MARKERS = [
  { name: "Campinas", lat: -22.9099, lng: -47.0626, factor: 0.12, reach: "12%", engagement: "Médio-Alto" },
  { name: "Santos", lat: -23.9608, lng: -46.3339, factor: 0.08, reach: "8%", engagement: "Médio" },
  { name: "Ribeirão Preto", lat: -21.1775, lng: -47.8103, factor: 0.1, reach: "10%", engagement: "Médio-Alto" },
  { name: "São José dos Campos", lat: -23.1894, lng: -45.885, factor: 0.09, reach: "9%", engagement: "Médio" },
  { name: "Sorocaba", lat: -23.5015, lng: -47.4526, factor: 0.07, reach: "7%", engagement: "Médio" },
  { name: "Bauru", lat: -22.3149, lng: -49.0617, factor: 0.05, reach: "5%", engagement: "Baixo-Médio" },
  { name: "Presidente Prudente", lat: -22.1256, lng: -51.3886, factor: 0.04, reach: "4%", engagement: "Baixo-Médio" },
  { name: "São Carlos", lat: -22.0175, lng: -47.8908, factor: 0.06, reach: "6%", engagement: "Médio" },
  { name: "Araraquara", lat: -21.7944, lng: -48.1758, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Piracicaba", lat: -22.7253, lng: -47.6492, factor: 0.07, reach: "7%", engagement: "Médio" },
  { name: "Guarulhos", lat: -23.4538, lng: -46.5333, factor: 0.15, reach: "15%", engagement: "Alto" },
  { name: "Osasco", lat: -23.5329, lng: -46.7919, factor: 0.12, reach: "12%", engagement: "Alto" },
  { name: "Santo André", lat: -23.6636, lng: -46.5341, factor: 0.1, reach: "10%", engagement: "Médio-Alto" },
  { name: "Jundiaí", lat: -23.1864, lng: -46.8842, factor: 0.08, reach: "8%", engagement: "Médio" },
  { name: "Franca", lat: -20.5386, lng: -47.4008, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Marília", lat: -22.2139, lng: -49.9458, factor: 0.04, reach: "4%", engagement: "Baixo-Médio" },
  { name: "Araçatuba", lat: -21.2089, lng: -50.4328, factor: 0.04, reach: "4%", engagement: "Baixo-Médio" },
  { name: "Taubaté", lat: -23.0264, lng: -45.5553, factor: 0.07, reach: "7%", engagement: "Médio" },
  { name: "Limeira", lat: -22.5647, lng: -47.4017, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "São Vicente", lat: -23.9633, lng: -46.3925, factor: 0.06, reach: "6%", engagement: "Médio" },
  { name: "Mogi das Cruzes", lat: -23.5225, lng: -46.1883, factor: 0.08, reach: "8%", engagement: "Médio-Alto" },
  { name: "Diadema", lat: -23.6856, lng: -46.6228, factor: 0.09, reach: "9%", engagement: "Alto" },
  { name: "São Bernardo do Campo", lat: -23.6914, lng: -46.565, factor: 0.11, reach: "11%", engagement: "Alto" },
  { name: "São Caetano do Sul", lat: -23.6237, lng: -46.5547, factor: 0.07, reach: "7%", engagement: "Alto" },
  { name: "Mauá", lat: -23.6678, lng: -46.4611, factor: 0.06, reach: "6%", engagement: "Médio" },
  { name: "Carapicuíba", lat: -23.5225, lng: -46.8356, factor: 0.06, reach: "6%", engagement: "Médio" },
  { name: "Itaquaquecetuba", lat: -23.4864, lng: -46.3486, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Taboão da Serra", lat: -23.6086, lng: -46.7583, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Barueri", lat: -23.5106, lng: -46.8761, factor: 0.07, reach: "7%", engagement: "Médio-Alto" },
  { name: "Suzano", lat: -23.5425, lng: -46.3108, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Americana", lat: -22.7394, lng: -47.3314, factor: 0.06, reach: "6%", engagement: "Médio" },
  { name: "Indaiatuba", lat: -23.0903, lng: -47.2178, factor: 0.06, reach: "6%", engagement: "Médio-Alto" },
  { name: "Jacareí", lat: -23.3053, lng: -45.9658, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Praia Grande", lat: -24.0056, lng: -46.4128, factor: 0.07, reach: "7%", engagement: "Médio" },
  { name: "Itapevi", lat: -23.5489, lng: -46.9342, factor: 0.04, reach: "4%", engagement: "Baixo-Médio" },
  { name: "Cotia", lat: -23.6039, lng: -46.9192, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Hortolândia", lat: -22.8583, lng: -47.22, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Sumaré", lat: -22.8219, lng: -47.2669, factor: 0.05, reach: "5%", engagement: "Médio" },
  { name: "Embu das Artes", lat: -23.6489, lng: -46.8522, factor: 0.04, reach: "4%", engagement: "Baixo-Médio" },
  { name: "Catanduva", lat: -21.1378, lng: -48.9728, factor: 0.03, reach: "3%", engagement: "Baixo-Médio" },
  { name: "Botucatu", lat: -22.8858, lng: -48.445, factor: 0.03, reach: "3%", engagement: "Baixo-Médio" },
  { name: "Itapetininga", lat: -23.5917, lng: -48.0528, factor: 0.03, reach: "3%", engagement: "Baixo-Médio" },
  { name: "Guarujá", lat: -23.9933, lng: -46.2564, factor: 0.08, reach: "8%", engagement: "Médio-Alto" },
  { name: "Cubatão", lat: -23.895, lng: -46.425, factor: 0.04, reach: "4%", engagement: "Médio" },
] as const

/* ============================================================
   Helpers
   ============================================================ */

/** "YYYY-MM-DD" → "dd/MM" sem sofrer com fuso horário. */
const formatDayMonth = (ymd: string) => {
  const [, month, day] = ymd.split("-")
  return `${day}/${month}`
}

const formatFullDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

/** ER = (likes + comentários) / views — com guard de divisão por zero. */
const engagementRate = (likes: number, comments: number, views: number) =>
  views > 0 ? (((likes + comments) / views) * 100).toFixed(2) : "0.00"

const platformLabel = (platform: string) =>
  platformConfig[platform as PlatformKey]?.label ?? platform

/* ============================================================
   Página
   ============================================================ */

export default function Reports() {
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("")
  const [activeTab, setActiveTab] = React.useState("top-accounts")

  // Filtros das contas (tab "Todas as Contas")
  const [searchAccountInput, setSearchAccountInput] = React.useState("")
  const [searchAccount, setSearchAccount] = React.useState("")
  const [accountPlatform, setAccountPlatform] = React.useState("all")
  const [sortAccountsBy, setSortAccountsBy] =
    React.useState<SortAccountsBy>("views")

  // Filtros da tabela de posts (independentes dos da tab de contas)
  const [searchPost, setSearchPost] = React.useState("")
  const [postPlatform, setPostPlatform] = React.useState("all")
  const [sortPostsBy, setSortPostsBy] = React.useState<SortPostsBy>("views")

  // Debounce de 300ms na busca de contas
  React.useEffect(() => {
    const timer = setTimeout(() => setSearchAccount(searchAccountInput), 300)
    return () => clearTimeout(timer)
  }, [searchAccountInput])

  const observerTargetAccounts = React.useRef<HTMLDivElement | null>(null)

  const { data: campaigns, isLoading: isLoadingCampaigns } =
    api.campaign.getAll.useQuery()

  const { data: reports, isLoading: isLoadingReports } =
    api.campaign.getReports.useQuery(
      { campaignId: selectedCampaignId },
      { enabled: !!selectedCampaignId },
    )

  const {
    data: accountsData,
    fetchNextPage: fetchNextPageAccounts,
    hasNextPage: hasNextPageAccounts,
    isFetchingNextPage: isFetchingNextPageAccounts,
    isLoading: isLoadingAccounts,
  } = api.campaign.getReportsAccounts.useInfiniteQuery(
    {
      campaignId: selectedCampaignId,
      limit: 30,
      platform: accountPlatform,
      search: searchAccount,
      sortBy: sortAccountsBy,
    },
    {
      enabled: !!selectedCampaignId && activeTab === "all-accounts",
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  )

  const allAccounts = React.useMemo(
    () => accountsData?.pages.flatMap((page) => page.accounts) ?? [],
    [accountsData],
  )

  // Infinite scroll das contas (sentinela + IntersectionObserver)
  React.useEffect(() => {
    const target = observerTargetAccounts.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasNextPageAccounts &&
          !isFetchingNextPageAccounts
        ) {
          void fetchNextPageAccounts()
        }
      },
      { root: null, rootMargin: "100px", threshold: 0.1 },
    )

    observer.observe(target)
    return () => observer.unobserve(target)
  }, [
    hasNextPageAccounts,
    isFetchingNextPageAccounts,
    fetchNextPageAccounts,
    activeTab,
    allAccounts.length,
  ])

  // Posts filtrados/ordenados da tabela (e fonte do export CSV)
  const filteredPosts = React.useMemo(() => {
    const posts = reports?.allPosts ?? []
    const query = searchPost.trim().toLowerCase()
    return posts
      .filter((post) => {
        const matchesSearch = post.username.toLowerCase().includes(query)
        const matchesPlatform =
          postPlatform === "all" || post.platform === postPlatform
        return matchesSearch && matchesPlatform
      })
      .sort((a, b) => b[sortPostsBy] - a[sortPostsBy])
  }, [reports?.allPosts, searchPost, postPlatform, sortPostsBy])

  const totalStats = reports?.totalStats

  const handleExportCsv = () => {
    if (!selectedCampaignId) return
    if (filteredPosts.length === 0) {
      toast.error("Nada para exportar", {
        description: "Nenhum post encontrado com os filtros atuais.",
      })
      return
    }

    const header = [
      "Conta",
      "Plataforma",
      "Views",
      "Likes",
      "Comentários",
      "ER",
      "Data",
      "URL",
    ]
    const rows = filteredPosts.map((post) => [
      post.username,
      platformLabel(post.platform),
      String(post.views),
      String(post.likes),
      String(post.comments),
      `${engagementRate(post.likes, post.comments, post.views)}%`,
      formatFullDate(post.postedAt),
      post.url,
    ])
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n")

    const campaign = campaigns?.find((c) => c.id === selectedCampaignId)
    const slug =
      campaign?.slug ??
      campaign?.name.toLowerCase().replace(/\s+/g, "-") ??
      "competicao"
    downloadTextFile(
      `relatorio_${slug}_${format(new Date(), "dd-MM-yyyy")}.csv`,
      csv,
      "text/csv",
      true,
    )
    toast.success("CSV exportado!", {
      description: `${filteredPosts.length} posts exportados com sucesso.`,
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            Relatórios & <span className="text-gradient">analytics</span>
          </>
        }
        subtitle="Análise detalhada de performance das competições"
        viz={<ReportsHeroViz />}
        vizSkeleton={<CompetitionReportsHeroVizSkeleton />}
        isLoading={!!selectedCampaignId && isLoadingReports}
        stats={
          selectedCampaignId
            ? [
                {
                  icon: <Eye className="size-3.5" weight="fill" />,
                  label: "Views",
                  value: totalStats?.totalViews ?? 0,
                  kind: "compact",
                },
                {
                  icon: <Heart className="size-3.5" weight="fill" />,
                  label: "Likes",
                  value: totalStats?.totalLikes ?? 0,
                  kind: "compact",
                },
                {
                  icon: <Play className="size-3.5" weight="fill" />,
                  label: "Posts",
                  value: totalStats?.totalPosts ?? 0,
                  kind: "int",
                },
              ]
            : []
        }
      />

      {/* ===== Seletor de competição + export ===== */}
      <Reveal immediate>
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <CardHeading
            icon={<Trophy className="size-4" weight="fill" />}
            title="Selecionar Competição"
            description="Escolha uma competição para ver os relatórios detalhados"
          />

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {isLoadingCampaigns ? (
              <Bone className="h-10 w-full rounded-xl sm:w-72" />
            ) : (
              <Select
                value={selectedCampaignId}
                onValueChange={setSelectedCampaignId}
              >
                <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-72">
                  <SelectValue placeholder="Selecione uma competição..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {campaigns && campaigns.length > 0 ? (
                    campaigns.map((campaign) => {
                      const status =
                        CAMPAIGN_STATUS_CONFIG[campaign.status] ??
                        CAMPAIGN_STATUS_CONFIG.DRAFT!
                      return (
                        <SelectItem
                          key={campaign.id}
                          value={campaign.id}
                          className="cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Trophy
                              className="text-brand-mint not-dark:text-primary size-4 shrink-0"
                              weight="fill"
                            />
                            <span className="max-w-44 truncate">
                              {campaign.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1 rounded-full text-[10px]",
                                status.badge,
                              )}
                            >
                              <span
                                className={cn(
                                  "size-1.5 rounded-full",
                                  status.dot,
                                )}
                              />
                              {status.label}
                            </Badge>
                          </span>
                        </SelectItem>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                      Nenhuma competição disponível
                    </p>
                  )}
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2.5">
              <Button
                onClick={handleExportCsv}
                disabled={!selectedCampaignId}
                className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
              >
                <DownloadSimple className="size-4" weight="bold" />
                Exportar
              </Button>
              <Badge
                variant="outline"
                className="hidden h-10 items-center gap-1.5 rounded-xl px-3 sm:inline-flex"
              >
                <Clock className="size-3.5" />
                Atualizado agora
              </Badge>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Empty state ===== */}
      {!selectedCampaignId && (
        <Reveal immediate delayMs={60}>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <ChartBar className="size-6" weight="fill" />
            </span>
            <div className="px-4">
              <p className="text-base font-bold">Selecione uma Competição</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Escolha uma competição acima para visualizar relatórios
                detalhados, gráficos de crescimento e análises de performance.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Skeletons (relatório carregando) ===== */}
      {selectedCampaignId && isLoadingReports && <ReportsSkeleton />}

      {/* ===== Conteúdo ===== */}
      {selectedCampaignId && reports && totalStats && (
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* ---- KPIs ---- */}
          <Reveal immediate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<Eye className="size-4" weight="fill" />}
                label="Total de Views"
                value={totalStats.totalViews}
                kind="compact"
                gradientValue
                accent="cyan"
                hint={`${totalStats.totalPosts.toLocaleString("pt-BR")} posts`}
              />
              <StatTile
                icon={<Heart className="size-4" weight="fill" />}
                label="Total de Likes"
                value={totalStats.totalLikes}
                kind="compact"
                accent="green"
                hint={
                  totalStats.totalViews > 0
                    ? `taxa de curtidas ${(
                        (totalStats.totalLikes / totalStats.totalViews) *
                        100
                      ).toFixed(2)}%`
                    : "—"
                }
              />
              <StatTile
                icon={<ChatCircle className="size-4" weight="fill" />}
                label="Comentários"
                value={totalStats.totalComments}
                kind="compact"
                accent="cyan"
                hint={
                  totalStats.totalPosts > 0
                    ? `média ${(
                        totalStats.totalComments / totalStats.totalPosts
                      ).toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })} por post`
                    : "—"
                }
              />
              <EngagementTile
                likes={totalStats.totalLikes}
                comments={totalStats.totalComments}
                views={totalStats.totalViews}
              />
            </div>
          </Reveal>

          {/* ---- Crescimento diário ---- */}
          {reports.growthData.length > 0 && (
            <Reveal immediate delayMs={60}>
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <CardHeading
                  icon={<ChartLineUp className="size-4" weight="fill" />}
                  title="Crescimento Diário de Views"
                  description="Quantidade de views ganhas por dia"
                  aside={
                    <Badge variant="outline" className="gap-1.5 rounded-full">
                      <CalendarBlank className="size-3" />
                      {reports.growthData.length} dias
                    </Badge>
                  }
                />
                <div className="h-72 w-full sm:h-80 lg:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={reports.growthData}
                      margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="reports-growth-stroke"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--chart-growth-start)"
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--chart-growth-end)"
                          />
                        </linearGradient>
                        {GROWTH_SERIES.map((serie) => (
                          <linearGradient
                            key={serie.key}
                            id={`reports-fill-${serie.key}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor={serie.color}
                              stopOpacity={0.26}
                            />
                            <stop
                              offset="55%"
                              stopColor={serie.color}
                              stopOpacity={0.08}
                            />
                            <stop
                              offset="100%"
                              stopColor={serie.color}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        ))}
                      </defs>

                      <CartesianGrid
                        vertical={false}
                        stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                        strokeDasharray="0"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDayMonth}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={48}
                        tickMargin={10}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      />
                      <YAxis
                        tickFormatter={(value: number) => formatNumber(value)}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
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
                        formatter={(value: string) => (
                          <span className="text-muted-foreground text-xs">
                            {GROWTH_LABELS[value] ?? value}
                          </span>
                        )}
                        wrapperStyle={{ paddingTop: 12 }}
                      />

                      <Area
                        type="monotone"
                        dataKey="views"
                        name="views"
                        stroke="url(#reports-growth-stroke)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        fill="url(#reports-fill-views)"
                        animationDuration={650}
                        activeDot={{
                          r: 4.5,
                          fill: "var(--chart-1)",
                          stroke: "var(--card)",
                          strokeWidth: 2,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="likes"
                        name="likes"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        fill="url(#reports-fill-likes)"
                        animationDuration={650}
                        activeDot={{
                          r: 4,
                          fill: "var(--chart-2)",
                          stroke: "var(--card)",
                          strokeWidth: 2,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="comments"
                        name="comments"
                        stroke="var(--chart-3)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        fill="url(#reports-fill-comments)"
                        animationDuration={650}
                        activeDot={{
                          r: 4,
                          fill: "var(--chart-3)",
                          stroke: "var(--card)",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Reveal>
          )}

          {/* ---- Distribuição por plataforma ---- */}
          {reports.platformStats.length > 0 && (
            <Reveal immediate delayMs={80}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Pie */}
                <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                  <CardHeading
                    icon={<ChartPieSlice className="size-4" weight="fill" />}
                    title="Distribuição por Plataforma"
                    description="Views por plataforma"
                  />
                  <PlatformPie stats={reports.platformStats} />
                </div>

                {/* Barras comparativas */}
                <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                  <CardHeading
                    icon={<ChartBar className="size-4" weight="fill" />}
                    title="Comparativo de Plataformas"
                    description="Posts e engajamento por plataforma"
                  />
                  <div className="h-72 w-full sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={reports.platformStats}
                        margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid
                          vertical={false}
                          stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                          strokeDasharray="0"
                        />
                        <XAxis
                          dataKey="platform"
                          tickFormatter={platformLabel}
                          axisLine={false}
                          tickLine={false}
                          tickMargin={8}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <YAxis
                          tickFormatter={(value: number) => formatNumber(value)}
                          axisLine={false}
                          tickLine={false}
                          width={46}
                          tick={{
                            fill: "var(--muted-foreground)",
                            fontSize: 11,
                          }}
                        />
                        <Tooltip
                          content={<PlatformBarTooltip />}
                          cursor={{
                            fill: "color-mix(in oklab, var(--foreground) 5%, transparent)",
                          }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          formatter={(value: string) => (
                            <span className="text-muted-foreground text-xs">
                              {PLATFORM_BAR_SERIES.find(
                                (serie) => serie.key === value,
                              )?.label ?? value}
                            </span>
                          )}
                          wrapperStyle={{ paddingTop: 12 }}
                        />
                        {PLATFORM_BAR_SERIES.map((serie) => (
                          <Bar
                            key={serie.key}
                            dataKey={serie.key}
                            name={serie.key}
                            fill={serie.color}
                            radius={[8, 8, 0, 0]}
                            maxBarSize={28}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          {/* ---- Demografia (estimada) ---- */}
          <Reveal immediate delayMs={100}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Gênero */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <CardHeading
                  icon={<UsersThree className="size-4" weight="fill" />}
                  title="Distribuição por Gênero"
                  description="Gênero do público que mais assiste"
                  aside={<EstimateBadge />}
                />
                <div className="h-56 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={
                          <DemographicsTooltip
                            totalViews={totalStats.totalViews}
                          />
                        }
                      />
                      <Pie
                        data={GENDER_DATA.map((entry) => ({ ...entry }))}
                        dataKey="value"
                        nameKey="gender"
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="86%"
                        paddingAngle={2}
                        cornerRadius={4}
                        stroke="var(--card)"
                        strokeWidth={2}
                        labelLine={false}
                        label={(props: unknown) =>
                          `${(props as { value?: number }).value ?? 0}%`
                        }
                      >
                        {GENDER_DATA.map((entry) => (
                          <Cell key={entry.gender} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legenda manual em pills */}
                <div className="flex flex-col gap-2.5">
                  {GENDER_DATA.map((entry) => (
                    <div
                      key={entry.gender}
                      className="flex items-center justify-between rounded-xl border px-3 py-2.5"
                      style={{
                        borderColor: `color-mix(in oklab, ${entry.color} 25%, transparent)`,
                        background: `color-mix(in oklab, ${entry.color} 8%, transparent)`,
                      }}
                    >
                      <span className="inline-flex items-center gap-2 text-sm font-medium">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: entry.color }}
                        />
                        {entry.gender}
                      </span>
                      <span className="text-sm font-bold tabular-nums">
                        {entry.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Faixa etária */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <CardHeading
                  icon={<Cake className="size-4" weight="fill" />}
                  title="Distribuição por Faixa Etária"
                  description="Idade do público que mais assiste"
                  aside={<EstimateBadge />}
                />
                <div className="h-56 w-full sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={AGE_DATA.map((entry) => ({ ...entry }))}
                      margin={{ top: 12, right: 12, bottom: 16, left: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                        strokeDasharray="0"
                      />
                      <XAxis
                        dataKey="age"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        label={{
                          value: "Faixa Etária",
                          position: "insideBottom",
                          offset: -12,
                          fill: "var(--muted-foreground)",
                          fontSize: 11,
                        }}
                      />
                      <YAxis
                        tickFormatter={(value: number) => `${value}%`}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        label={{
                          value: "Porcentagem",
                          angle: -90,
                          position: "insideLeft",
                          fill: "var(--muted-foreground)",
                          fontSize: 11,
                        }}
                      />
                      <Tooltip
                        content={
                          <DemographicsTooltip
                            totalViews={totalStats.totalViews}
                          />
                        }
                        cursor={{
                          fill: "color-mix(in oklab, var(--foreground) 5%, transparent)",
                        }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={64}>
                        {AGE_DATA.map((entry) => (
                          <Cell key={entry.age} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Insights */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[color-mix(in_oklab,var(--chart-2)_30%,transparent)] bg-[color-mix(in_oklab,var(--chart-2)_10%,transparent)] p-3">
                    <p className="text-muted-foreground text-xs">
                      Faixa Principal
                    </p>
                    <p className="text-lg font-bold">25-34 anos</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      38% da audiência
                    </p>
                  </div>
                  <div className="rounded-xl border border-[color-mix(in_oklab,var(--chart-1)_30%,transparent)] bg-[color-mix(in_oklab,var(--chart-1)_10%,transparent)] p-3">
                    <p className="text-muted-foreground text-xs">
                      Segunda Maior
                    </p>
                    <p className="text-lg font-bold">18-24 anos</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      32% da audiência
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ---- Mapa de alcance geográfico ---- */}
          <Reveal immediate delayMs={120}>
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
              <CardHeading
                icon={<MapPin className="size-4" weight="fill" />}
                title="Distribuição Geográfica - São Paulo"
                description="Regiões com maior alcance no estado"
                aside={<EstimateBadge />}
              />

              <div className="relative h-[400px] overflow-hidden rounded-2xl sm:h-[500px]">
                <Map
                  center={[-23.5505, -46.6333]}
                  zoom={7}
                  className="h-full w-full"
                  style={{ height: "100%", width: "100%" }}
                >
                  <MapTileLayer />
                  <MapZoomControl />

                  {/* Contorno oficial do Estado de São Paulo (IBGE) */}
                  <SpBoundary variant="light" />

                  {/* Capital — epicentro */}
                  <MapMarker position={[-23.5505, -46.6333]}>
                    <MapPopup className="w-64">
                      <p className="mb-2 flex items-center gap-2 text-base font-bold">
                        <Crown
                          className="size-4 text-[var(--chart-1)]"
                          weight="fill"
                        />
                        São Paulo - Capital
                      </p>
                      <div className="flex flex-col gap-1.5 text-sm">
                        <div className="flex items-center justify-between rounded-lg bg-[color-mix(in_oklab,var(--chart-1)_10%,transparent)] px-2 py-1.5">
                          <span className="text-muted-foreground">Views:</span>
                          <span className="font-bold text-[var(--chart-1)] tabular-nums">
                            {formatNumber(totalStats.totalViews)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg bg-[color-mix(in_oklab,var(--chart-1)_10%,transparent)] px-2 py-1.5">
                          <span className="text-muted-foreground">
                            Alcance:
                          </span>
                          <span className="font-bold text-[var(--chart-1)]">
                            100%
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2">
                          <span className="text-muted-foreground">
                            Engajamento:
                          </span>
                          <span className="font-semibold text-[var(--chart-2)]">
                            Altíssimo
                          </span>
                        </div>
                      </div>
                    </MapPopup>
                  </MapMarker>

                  {/* Demais cidades */}
                  {CITY_MARKERS.map((city) => (
                    <MapMarker key={city.name} position={[city.lat, city.lng]}>
                      <MapPopup className="w-56">
                        <p className="mb-2 font-bold">{city.name}</p>
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Views:
                            </span>
                            <span className="font-bold text-[var(--chart-1)] tabular-nums">
                              {formatNumber(
                                Math.round(
                                  totalStats.totalViews * city.factor,
                                ),
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Alcance:
                            </span>
                            <span className="font-semibold">{city.reach}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Engajamento:
                            </span>
                            <span className="font-semibold text-[var(--chart-2)]">
                              {city.engagement}
                            </span>
                          </div>
                        </div>
                      </MapPopup>
                    </MapMarker>
                  ))}
                </Map>
              </div>

              {/* Legenda do contorno */}
              <div className="flex items-center gap-2 text-sm">
                <span className="size-4 rounded border-2 border-[var(--chart-1)] bg-[color-mix(in_oklab,var(--chart-1)_10%,transparent)]" />
                <span className="text-muted-foreground">
                  Contorno destacado do{" "}
                  <span className="font-semibold text-[var(--chart-1)]">
                    Estado de São Paulo
                  </span>
                </span>
              </div>

              {/* Tiles de resumo */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border-2 border-[color-mix(in_oklab,var(--chart-1)_40%,transparent)] bg-gradient-to-br from-[color-mix(in_oklab,var(--chart-1)_18%,transparent)] to-[color-mix(in_oklab,var(--chart-1)_5%,transparent)] p-3">
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Crown className="size-3" weight="fill" />
                    Epicentro
                  </p>
                  <p className="text-lg font-bold text-[var(--chart-1)]">
                    Capital SP
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-[var(--chart-1)]">
                    100% de alcance
                  </p>
                </div>
                <div className="rounded-xl border border-[color-mix(in_oklab,var(--chart-2)_25%,transparent)] bg-[color-mix(in_oklab,var(--chart-2)_10%,transparent)] p-3">
                  <p className="text-muted-foreground text-xs">Grande SP</p>
                  <p className="text-lg font-bold">24 cidades</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Região Metropolitana
                  </p>
                </div>
                <div className="rounded-xl border border-[color-mix(in_oklab,var(--chart-3)_25%,transparent)] bg-[color-mix(in_oklab,var(--chart-3)_10%,transparent)] p-3">
                  <p className="text-muted-foreground text-xs">Interior</p>
                  <p className="text-lg font-bold">22 cidades</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Principais regiões
                  </p>
                </div>
                <div className="rounded-xl border border-[color-mix(in_oklab,var(--chart-4)_25%,transparent)] bg-[color-mix(in_oklab,var(--chart-4)_10%,transparent)] p-3">
                  <p className="text-muted-foreground text-xs">Total</p>
                  <p className="text-lg font-bold">46 cidades</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    Mapeadas
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ---- Contas e Posts (tabs) ---- */}
          <Reveal immediate delayMs={140}>
            <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
              <CardHeading
                icon={<Crown className="size-4" weight="fill" />}
                title="Contas e Posts"
                description="Rankings e listagem completa"
              />

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-muted/40 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1">
                  <TabsTrigger
                    value="top-accounts"
                    className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
                  >
                    <Crown className="size-3.5" weight="fill" />
                    <span className="hidden sm:inline">Top 10 Contas</span>
                    <span className="sm:hidden">Top 10</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="top-posts"
                    className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
                  >
                    <Trophy className="size-3.5" weight="fill" />
                    <span className="hidden sm:inline">Top Posts</span>
                    <span className="sm:hidden">Posts</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="all-accounts"
                    className="cursor-pointer gap-1.5 rounded-full px-2 py-2 text-xs font-semibold"
                  >
                    <UsersThree className="size-3.5" weight="fill" />
                    <span className="hidden sm:inline">Todas as Contas</span>
                    <span className="sm:hidden">Contas</span>
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1: Top 10 contas */}
                <TabsContent value="top-accounts" className="mt-5">
                  {reports.topAccounts.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {reports.topAccounts.map((account, index) => {
                        const config =
                          platformConfig[account.platform as PlatformKey]
                        const PlatformIcon = config?.icon
                        return (
                          <div
                            key={account.username ?? index}
                            className="border-border/60 bg-muted/20 hover:bg-muted/30 flex flex-col gap-3 rounded-2xl border px-3.5 py-3 transition-colors sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <PositionBadge position={index + 1} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="max-w-52 truncate font-semibold">
                                    {account.username ?? "—"}
                                  </p>
                                  {PlatformIcon && (
                                    <a
                                      href={account.profileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      aria-label={`Perfil no ${config.label}`}
                                      className="transition-opacity hover:opacity-70"
                                    >
                                      <PlatformIcon
                                        className={cn("size-4", config.color)}
                                      />
                                    </a>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "rounded-full text-[10px]",
                                      config?.bgColor,
                                      config?.color,
                                      config?.borderColor,
                                    )}
                                  >
                                    {config?.label ?? account.platform}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground mt-0.5 text-xs">
                                  {account.postsCount} posts
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 pl-12 sm:flex-col sm:items-end sm:gap-1 sm:pl-0">
                              <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
                                <Eye
                                  className="text-brand-mint not-dark:text-primary size-4"
                                  weight="fill"
                                />
                                <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                                  {formatNumber(account.totalViews)}
                                </span>
                              </span>
                              <span className="text-muted-foreground flex items-center gap-3 text-xs tabular-nums">
                                <span className="inline-flex items-center gap-1">
                                  <Heart className="size-3" weight="fill" />
                                  {formatNumber(account.totalLikes)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <ChatCircle className="size-3" weight="fill" />
                                  {formatNumber(account.totalComments)}
                                </span>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <TabEmpty text="Nenhuma conta encontrada." />
                  )}
                </TabsContent>

                {/* Tab 2: Top posts */}
                <TabsContent value="top-posts" className="mt-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <TopPostsColumn
                      title="Top Posts · Views"
                      description="Posts com mais visualizações"
                      icon={<Eye className="size-4" weight="fill" />}
                      posts={reports.topPostsByViews}
                      highlight="views"
                      color="var(--chart-1)"
                    />
                    <TopPostsColumn
                      title="Top Posts · Likes"
                      description="Posts com mais curtidas"
                      icon={<Heart className="size-4" weight="fill" />}
                      posts={reports.topPostsByLikes}
                      highlight="likes"
                      color="var(--chart-2)"
                    />
                    <TopPostsColumn
                      title="Top Posts · Comentários"
                      description="Posts com mais comentários"
                      icon={<ChatCircle className="size-4" weight="fill" />}
                      posts={reports.topPostsByComments}
                      highlight="comments"
                      color="var(--chart-3)"
                    />
                  </div>
                </TabsContent>

                {/* Tab 3: Todas as contas (infinite scroll) */}
                <TabsContent value="all-accounts" className="mt-5">
                  <div className="flex flex-col gap-4">
                    {/* Filtros */}
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <div className="relative min-w-0 flex-1">
                        <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                        <Input
                          value={searchAccountInput}
                          onChange={(e) =>
                            setSearchAccountInput(e.target.value)
                          }
                          placeholder="Buscar por @username..."
                          className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
                        />
                      </div>
                      <Select
                        value={accountPlatform}
                        onValueChange={setAccountPlatform}
                      >
                        <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-48">
                          <Funnel className="text-muted-foreground mr-1 size-3.5" />
                          <SelectValue placeholder="Plataforma" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="all">Todas Plataformas</SelectItem>
                          {PLATFORM_OPTIONS.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {platformConfig[platform].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={sortAccountsBy}
                        onValueChange={(value) =>
                          setSortAccountsBy(value as SortAccountsBy)
                        }
                      >
                        <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-52">
                          <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5" />
                          <SelectValue placeholder="Ordenar por" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="views">
                            Ordenar por Views
                          </SelectItem>
                          <SelectItem value="posts">
                            Ordenar por Posts
                          </SelectItem>
                          <SelectItem value="engagement">
                            Ordenar por ER
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Lista */}
                    {isLoadingAccounts ? (
                      <ListRowsSkeleton rows={4} />
                    ) : allAccounts.length > 0 ? (
                      <>
                        <div className="flex flex-col gap-2.5">
                          {allAccounts.map((account, index) => (
                            <AccountRow
                              key={`${account.username}-${index}`}
                              account={account}
                              index={index}
                            />
                          ))}
                        </div>

                        {/* Sentinela do infinite scroll */}
                        <div ref={observerTargetAccounts} className="py-3">
                          {isFetchingNextPageAccounts && (
                            <div className="flex justify-center">
                              <CircleNotch className="text-brand-cyan not-dark:text-primary size-6 animate-spin" />
                            </div>
                          )}
                        </div>

                        {!hasNextPageAccounts && (
                          <p className="text-muted-foreground pb-1 text-center text-sm">
                            Todas as contas foram carregadas
                          </p>
                        )}
                      </>
                    ) : (
                      <TabEmpty text="Nenhuma conta encontrada com os filtros selecionados." />
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Reveal>

          {/* ---- Tabela: todos os posts ---- */}
          <Reveal immediate delayMs={160}>
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
              <CardHeading
                icon={<Play className="size-4" weight="fill" />}
                title="Todos os Posts"
                description="Lista completa de posts da competição"
                aside={
                  <Badge variant="outline" className="rounded-full">
                    {filteredPosts.length.toLocaleString("pt-BR")} posts
                  </Badge>
                }
              />

              {/* Filtros próprios da tabela */}
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                  <Input
                    value={searchPost}
                    onChange={(e) => setSearchPost(e.target.value)}
                    placeholder="Buscar por @username..."
                    className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
                  />
                </div>
                <Select value={postPlatform} onValueChange={setPostPlatform}>
                  <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-48">
                    <Funnel className="text-muted-foreground mr-1 size-3.5" />
                    <SelectValue placeholder="Plataforma" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todas Plataformas</SelectItem>
                    {PLATFORM_OPTIONS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platformConfig[platform].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={sortPostsBy}
                  onValueChange={(value) =>
                    setSortPostsBy(value as SortPostsBy)
                  }
                >
                  <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-56">
                    <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5" />
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="views">Ordenar por Views</SelectItem>
                    <SelectItem value="likes">Ordenar por Likes</SelectItem>
                    <SelectItem value="comments">
                      Ordenar por Comentários
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabela */}
              {filteredPosts.length > 0 ? (
                <div className="border-border/60 overflow-hidden rounded-2xl border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 hover:bg-transparent">
                          <TableHead className="w-12 font-bold">#</TableHead>
                          <TableHead className="font-bold">Conta</TableHead>
                          <TableHead className="font-bold">
                            Plataforma
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            Views
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            Likes
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            Comentários
                          </TableHead>
                          <TableHead className="text-right font-bold">
                            ER
                          </TableHead>
                          <TableHead className="font-bold">Data</TableHead>
                          <TableHead className="text-center font-bold">
                            Ações
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPosts.map((post, index) => {
                          const config =
                            platformConfig[post.platform as PlatformKey]
                          const PlatformIcon = config?.icon
                          return (
                            <TableRow
                              key={post.id}
                              className="border-border/40 hover:bg-muted/30 transition-colors"
                            >
                              <TableCell className="text-muted-foreground font-medium tabular-nums">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <span className="block max-w-48 truncate font-semibold">
                                  {post.username}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "gap-1.5 rounded-full text-[10px]",
                                    config?.bgColor,
                                    config?.color,
                                    config?.borderColor,
                                  )}
                                >
                                  {PlatformIcon && (
                                    <PlatformIcon className="size-3" />
                                  )}
                                  {config?.label ?? post.platform}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center gap-1 font-bold tabular-nums">
                                  <Eye
                                    className="text-brand-mint not-dark:text-primary size-3"
                                    weight="fill"
                                  />
                                  {formatNumber(post.views)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                                  <Heart className="text-muted-foreground size-3" />
                                  {formatNumber(post.likes)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                                  <ChatCircle className="text-muted-foreground size-3" />
                                  {formatNumber(post.comments)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className="rounded-full bg-emerald-500/10 text-[10px] tabular-nums"
                                >
                                  {engagementRate(
                                    post.likes,
                                    post.comments,
                                    post.views,
                                  )}
                                  %
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-muted-foreground text-sm whitespace-nowrap">
                                  {formatFullDate(post.postedAt)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  <a
                                    href={post.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Abrir post"
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50 flex size-8 items-center justify-center rounded-lg transition-colors"
                                  >
                                    <ArrowSquareOut className="size-4" />
                                  </a>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <TabEmpty text="Nenhum post encontrado com os filtros selecionados." />
              )}
            </div>
          </Reveal>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Blocos auxiliares
   ============================================================ */

function CardHeading({
  icon,
  title,
  description,
  aside,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  aside?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-2.5">
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          {icon}
        </span>
        <div className="leading-tight">
          <h2 className="text-base font-bold tracking-tight sm:text-lg">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground text-xs sm:text-[13px]">
              {description}
            </p>
          )}
        </div>
      </div>
      {aside}
    </div>
  )
}

function EstimateBadge() {
  return (
    <Badge
      variant="outline"
      className="border-border bg-muted/50 text-muted-foreground rounded-full text-[10px]"
    >
      Estimativa
    </Badge>
  )
}

function TabEmpty({ text }: { text: string }) {
  return (
    <div className="border-border/60 bg-muted/10 rounded-2xl border py-12 text-center">
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  )
}

/** Tile custom do Engagement Rate — (likes+comentários)/views com guard. */
function EngagementTile({
  likes,
  comments,
  views,
}: {
  likes: number
  comments: number
  views: number
}) {
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          Engagement Rate
        </span>
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          <TrendUp className="size-4" weight="fill" />
        </span>
      </div>
      <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
        {views > 0 ? `${engagementRate(likes, comments, views)}%` : "—"}
      </span>
      <span className="text-muted-foreground text-xs">
        taxa média de engajamento
      </span>
    </div>
  )
}

/* ---------- Tooltips glass (identidade) ---------- */

function TooltipShell({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border bg-popover/95 min-w-40 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      {label && (
        <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}

function GrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: GrowthPoint }>
  label?: string
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  return (
    <TooltipShell label={label ? formatDayMonth(label) : ""}>
      <div className="flex flex-col gap-1">
        {GROWTH_SERIES.map((serie) => (
          <div
            key={serie.key}
            className="flex items-center justify-between gap-6 text-xs"
          >
            <span className="text-muted-foreground inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: serie.color }}
              />
              {serie.label}
            </span>
            <span className="font-semibold tabular-nums">
              {Number(point[serie.key] ?? 0).toLocaleString("pt-BR")}
            </span>
          </div>
        ))}
      </div>
    </TooltipShell>
  )
}

function PlatformPieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{ payload?: PlatformStat }>
  total: number
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  const share = total > 0 ? (datum.totalViews / total) * 100 : 0

  return (
    <TooltipShell>
      <p className="mb-1 text-xs font-semibold">
        {platformLabel(datum.platform)}
      </p>
      <p className="text-muted-foreground text-xs">
        {datum.totalViews.toLocaleString("pt-BR")} views ·{" "}
        {share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </p>
      <p className="text-muted-foreground text-xs">
        {datum.postsCount.toLocaleString("pt-BR")} posts
      </p>
    </TooltipShell>
  )
}

function PlatformBarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <TooltipShell label={label ? platformLabel(label) : ""}>
      <div className="flex flex-col gap-1">
        {PLATFORM_BAR_SERIES.map((serie) => {
          const entry = payload.find((item) => item.dataKey === serie.key)
          if (!entry) return null
          return (
            <div
              key={serie.key}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: serie.color }}
                />
                {serie.label}
              </span>
              <span className="font-semibold tabular-nums">
                {formatNumber(Number(entry.value ?? 0))}
              </span>
            </div>
          )
        })}
      </div>
    </TooltipShell>
  )
}

function DemographicsTooltip({
  active,
  payload,
  totalViews,
}: {
  active?: boolean
  payload?: Array<{
    payload?: { gender?: string; age?: string; value?: number }
  }>
  totalViews: number
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  const pct = Number(datum.value ?? 0)
  const views = Math.round((totalViews * pct) / 100)

  return (
    <TooltipShell label={datum.gender ?? datum.age ?? ""}>
      <p className="text-xs">
        <span className="font-bold tabular-nums">{pct}%</span>{" "}
        <span className="text-muted-foreground">
          ({formatNumber(views)} views estimadas)
        </span>
      </p>
    </TooltipShell>
  )
}

/* ---------- Pie de plataformas + legenda custom ---------- */

function PlatformPie({ stats }: { stats: PlatformStat[] }) {
  const sorted = [...stats].sort((a, b) => b.totalViews - a.totalViews)
  const total = sorted.reduce((sum, entry) => sum + entry.totalViews, 0)

  if (total === 0) {
    return (
      <p className="text-muted-foreground flex h-56 items-center justify-center text-sm">
        Sem views registradas por enquanto
      </p>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<PlatformPieTooltip total={total} />} />
            <Pie
              data={sorted}
              dataKey="totalViews"
              nameKey="platform"
              cx="50%"
              cy="50%"
              outerRadius="86%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
              labelLine={false}
              label={(props: unknown) =>
                formatNumber(
                  Number((props as { totalViews?: number }).totalViews ?? 0),
                )
              }
            >
              {sorted.map((entry) => (
                <Cell
                  key={entry.platform}
                  fill={PLATFORM_CHART_COLORS[entry.platform] ?? "var(--chart-1)"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda custom: ícone + label + % + views + trilha */}
      <div className="flex flex-col gap-2.5">
        {sorted.map((entry) => {
          const config = platformConfig[entry.platform as PlatformKey]
          const PlatformIcon = config?.icon
          const color =
            PLATFORM_CHART_COLORS[entry.platform] ?? "var(--chart-1)"
          const pct = (entry.totalViews / total) * 100
          return (
            <div key={entry.platform} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-foreground/90 inline-flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[4px]"
                    style={{ background: color }}
                  />
                  {PlatformIcon && (
                    <PlatformIcon className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">
                    {config?.label ?? entry.platform}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold">
                    {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {formatNumber(entry.totalViews)}
                  </span>
                </span>
              </div>
              <div className="bg-muted/50 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(pct, 2)}%`, background: color }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Colunas de top posts ---------- */

function TopPostsColumn({
  title,
  description,
  icon,
  posts,
  highlight,
  color,
}: {
  title: string
  description: string
  icon: React.ReactNode
  posts: TopPost[]
  highlight: SortPostsBy
  color: string
}) {
  return (
    <div className="border-border/60 bg-muted/10 flex flex-col gap-3 rounded-2xl border p-3.5">
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            color,
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
          }}
        >
          {icon}
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold">{title}</p>
          <p className="text-muted-foreground text-[11px]">{description}</p>
        </div>
      </div>

      {posts.length > 0 ? (
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {posts.slice(0, 5).map((post, index) => {
            const config = platformConfig[post.platform as PlatformKey]
            const PlatformIcon = config?.icon
            return (
              <div
                key={post.id}
                className="group border-border/60 bg-card/50 hover:bg-card/80 flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors"
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                  style={{
                    color,
                    background: `color-mix(in oklab, ${color} 16%, transparent)`,
                  }}
                >
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">
                      {post.username ?? "—"}
                    </span>
                    {PlatformIcon && (
                      <PlatformIcon
                        className={cn("size-3 shrink-0", config.color)}
                      />
                    )}
                  </span>
                  <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3" />
                      <span
                        className={cn(highlight === "views" && "font-bold")}
                        style={
                          highlight === "views" ? { color } : undefined
                        }
                      >
                        {formatNumber(post.views)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Heart className="size-3" />
                      <span
                        className={cn(highlight === "likes" && "font-bold")}
                        style={
                          highlight === "likes" ? { color } : undefined
                        }
                      >
                        {formatNumber(post.likes)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ChatCircle className="size-3" />
                      <span
                        className={cn(
                          highlight === "comments" && "font-bold",
                        )}
                        style={
                          highlight === "comments" ? { color } : undefined
                        }
                      >
                        {formatNumber(post.comments)}
                      </span>
                    </span>
                  </span>
                  <a
                    href={post.submittedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-cyan not-dark:text-primary inline-flex w-fit items-center gap-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <ArrowSquareOut className="size-3" />
                    Ver Post
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-muted-foreground py-6 text-center text-xs">
          Nenhum post encontrado.
        </p>
      )}
    </div>
  )
}

/* ---------- Linha de conta (tab Todas as Contas) ---------- */

function AccountRow({
  account,
  index,
}: {
  account: InfiniteAccount
  index: number
}) {
  return (
    <div className="border-border/60 bg-muted/20 hover:bg-muted/30 flex flex-col gap-3 rounded-2xl border px-3.5 py-3 transition-colors sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="bg-muted/60 text-foreground/80 flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-black tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="max-w-52 truncate font-semibold">
              {account.username}
            </p>
            <span className="flex items-center gap-1">
              {account.platforms.map((platform) => {
                const config = platformConfig[platform as PlatformKey]
                const PlatformIcon = config?.icon
                return PlatformIcon ? (
                  <PlatformIcon
                    key={platform}
                    className={cn("size-3.5", config.color)}
                  />
                ) : null
              })}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {account.postsCount} posts
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 pl-12 sm:justify-end sm:pl-0">
        <span className="inline-flex items-center gap-1.5 font-bold tabular-nums">
          <Eye
            className="text-brand-mint not-dark:text-primary size-4"
            weight="fill"
          />
          {formatNumber(account.totalViews)}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
          <Heart className="size-3" weight="fill" />
          {formatNumber(account.totalLikes)}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
          <ChatCircle className="size-3" weight="fill" />
          {formatNumber(account.totalComments)}
        </span>
        <Badge
          variant="outline"
          className="rounded-full bg-emerald-500/10 text-[10px] tabular-nums"
        >
          {account.avgEngagement.toFixed(2)}%
        </Badge>
      </div>
    </div>
  )
}

/* ---------- Skeleton da página (kit da marca) ---------- */

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* KPIs */}
      <StatTilesGridSkeleton />

      {/* Crescimento */}
      <ChartSkeleton heightClass="h-72 sm:h-80" bars={14} />

      {/* Plataformas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutSkeleton />
        <ChartSkeleton heightClass="h-64" bars={8} />
      </div>

      {/* Demografia */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutSkeleton />
        <ChartSkeleton heightClass="h-64" bars={5} />
      </div>

      {/* Mapa */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-4 w-56" />
            <Bone delay={120} className="h-3 w-40 rounded-full" />
          </div>
        </div>
        <Bone delay={180} className="h-[400px] w-full rounded-2xl sm:h-[500px]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Bone
              key={index}
              delay={240 + index * 80}
              className="h-20 rounded-xl"
            />
          ))}
        </div>
      </div>

      {/* Contas e posts */}
      <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <Bone delay={60} className="h-4 w-40" />
        </div>
        <Bone delay={120} className="h-11 w-full rounded-2xl" />
        <ListRowsSkeleton rows={5} />
      </div>

      {/* Tabela de posts */}
      <TableSkeleton rows={6} />
    </div>
  )
}
