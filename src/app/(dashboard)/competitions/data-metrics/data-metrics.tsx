"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretUpDown,
  ChartBar,
  ChatCircle,
  Check,
  Clock,
  Eye,
  Funnel,
  Heart,
  Lightning,
  Medal,
  Pulse,
  ShareNetwork,
  Stack,
  Trophy,
  VideoCamera,
} from "@phosphor-icons/react"

import { DataMetricsHeroViz, DataMetricsHeroVizSkeleton } from "@/components/competitions/data-metrics-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import { Bone, StatTilesGridSkeleton } from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

const STORAGE_KEY = "data-metrics-selected-campaigns"

/** Cores das 5 faixas de views: 10k cyan · 50k blue · 100k violet · 500k amber · 1M rose. */
const TIER_STYLES = [
  {
    border: "border-cyan-500/30",
    overlay: "from-cyan-500/15 via-cyan-500/[0.04] to-transparent",
    text: "text-cyan-600 dark:text-cyan-400",
    chip: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  },
  {
    border: "border-blue-500/30",
    overlay: "from-blue-500/15 via-blue-500/[0.04] to-transparent",
    text: "text-blue-600 dark:text-blue-400",
    chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    border: "border-violet-500/30",
    overlay: "from-violet-500/15 via-violet-500/[0.04] to-transparent",
    text: "text-violet-600 dark:text-violet-400",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    border: "border-amber-500/30",
    overlay: "from-amber-500/15 via-amber-500/[0.04] to-transparent",
    text: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    border: "border-rose-500/30",
    overlay: "from-rose-500/15 via-rose-500/[0.04] to-transparent",
    text: "text-rose-600 dark:text-rose-400",
    chip: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
] as const

/** Medalhas do top 3: ouro · prata · bronze. */
const MEDAL_STYLES = [
  "bg-gradient-to-br from-amber-400 to-yellow-600 shadow-md shadow-amber-500/30",
  "bg-gradient-to-br from-slate-300 to-slate-500 shadow-md shadow-slate-500/30",
  "bg-gradient-to-br from-amber-600 to-orange-800 shadow-md shadow-amber-700/30",
] as const

function getMonthOptions() {
  const options: { value: string; label: string }[] = [
    { value: "all", label: "Todos os meses" },
  ]
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const label = date.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    })
    options.push({
      value,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    })
  }
  return options
}

export default function DataMetrics() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth)
  const [monthComboOpen, setMonthComboOpen] = React.useState(false)
  const [selectedCampaignIds, setSelectedCampaignIds] = React.useState<
    string[]
  >([])
  const [initialized, setInitialized] = React.useState(false)

  const monthOptions = React.useMemo(() => getMonthOptions(), [])

  const { data: campaigns, isLoading: loadingCampaigns } =
    api.admin.getAllCampaignsWithStats.useQuery()

  // Hidrata a seleção do localStorage (mantendo só ids existentes);
  // fallback: todas as competições selecionadas.
  React.useEffect(() => {
    if (!campaigns || campaigns.length === 0 || initialized) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        const valid = parsed.filter((id) =>
          campaigns.some((campaign) => campaign.id === id),
        )
        if (valid.length > 0) {
          setSelectedCampaignIds(valid)
          setInitialized(true)
          return
        }
      }
    } catch {
      // localStorage indisponível — segue com todas selecionadas
    }
    setSelectedCampaignIds(campaigns.map((campaign) => campaign.id))
    setInitialized(true)
  }, [campaigns, initialized])

  // Persiste a seleção a cada mudança.
  React.useEffect(() => {
    if (initialized && selectedCampaignIds.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCampaignIds))
    }
  }, [selectedCampaignIds, initialized])

  const { data: metrics, isLoading: loadingMetrics } =
    api.admin.getDataMetrics.useQuery(
      { month: selectedMonth, campaignIds: selectedCampaignIds },
      { enabled: selectedCampaignIds.length > 0 },
    )

  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const selectAll = () => {
    if (campaigns) {
      setSelectedCampaignIds(campaigns.map((campaign) => campaign.id))
    }
  }

  const deselectAll = () => {
    const first = campaigns?.[0]
    if (first) setSelectedCampaignIds([first.id])
  }

  const summary = metrics?.summary
  const initializing = !initialized && (campaigns?.length ?? 0) > 0
  const heroLoading = loadingCampaigns || initializing || loadingMetrics
  const tabLoading = loadingMetrics || initializing

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero do observatório de dados ===== */}
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            Dados & <span className="text-gradient">métricas</span>
          </>
        }
        subtitle="Análise completa de vídeos aptos por faixa de views e engajamento — filtre por período e competição para observar cada faixa."
        isLoading={heroLoading}
        viz={<DataMetricsHeroViz />}
        vizSkeleton={<DataMetricsHeroVizSkeleton />}
        stats={[
          {
            icon: <VideoCamera className="size-3.5" weight="fill" />,
            label: "Vídeos",
            value: summary?.totalPosts ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views",
            value: summary?.totalViews ?? 0,
            kind: "compact",
          },
          {
            icon: <Pulse className="size-3.5" weight="fill" />,
            label: "ER médio",
            value: summary?.avgER ?? 0,
            kind: "percent",
          },
        ]}
      />

      {loadingCampaigns ? (
        <>
          {/* ===== Skeleton global (filtros + tabs + faixas) ===== */}
          <FiltersSkeleton />
          <div className="flex flex-col gap-6">
            <TabsPillSkeleton />
            <TiersTabSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* ===== Filtros: período + competições ===== */}
          <Reveal immediate>
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              {/* Período de Análise */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                    <ChartBar className="size-4" weight="fill" />
                  </span>
                  <p className="text-sm font-bold">Período de Análise</p>
                </div>

                <Popover open={monthComboOpen} onOpenChange={setMonthComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={monthComboOpen}
                      className="h-11 w-full cursor-pointer justify-between rounded-xl font-medium"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        {selectedMonth === "all" ? (
                          <span className="bg-gradient-custom flex size-6 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                            <Stack className="size-3.5" weight="fill" />
                          </span>
                        ) : (
                          <span className="bg-brand-cyan/10 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary flex size-6 shrink-0 items-center justify-center rounded-md">
                            <CalendarBlank className="size-3.5" weight="fill" />
                          </span>
                        )}
                        <span className="truncate">
                          {monthOptions.find(
                            (option) => option.value === selectedMonth,
                          )?.label ?? "Selecionar período"}
                        </span>
                      </span>
                      <CaretUpDown className="size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] rounded-xl p-0"
                    align="start"
                  >
                    <Command className="rounded-xl">
                      <CommandInput placeholder="Buscar mês..." />
                      <CommandList className="max-h-72">
                        <CommandEmpty>Nenhum mês encontrado</CommandEmpty>
                        <CommandGroup>
                          {monthOptions.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => {
                                setSelectedMonth(option.value)
                                setMonthComboOpen(false)
                              }}
                              className="cursor-pointer gap-2.5 rounded-lg px-3 py-2.5"
                            >
                              {option.value === "all" ? (
                                <span className="bg-gradient-custom flex size-6 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                                  <Stack className="size-3.5" weight="fill" />
                                </span>
                              ) : (
                                <span className="bg-brand-cyan/10 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary flex size-6 shrink-0 items-center justify-center rounded-md">
                                  <CalendarBlank
                                    className="size-3.5"
                                    weight="fill"
                                  />
                                </span>
                              )}
                              <span
                                className={cn(
                                  "flex-1 truncate text-sm",
                                  option.value === "all" &&
                                    "text-brand-cyan not-dark:text-primary font-semibold",
                                )}
                              >
                                {option.label}
                              </span>
                              <Check
                                weight="bold"
                                className={cn(
                                  "text-brand-cyan not-dark:text-primary ml-auto size-4 shrink-0",
                                  selectedMonth === option.value
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px]">
                  <Clock className="size-3" />
                  {selectedMonth === "all"
                    ? "Exibindo dados de todos os períodos"
                    : "Dados atualizados em tempo real"}
                </p>
              </div>

              {/* Competições */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                      <Trophy className="size-4" weight="fill" />
                    </span>
                    <p className="text-sm font-bold">Competições</p>
                    <Badge
                      variant="outline"
                      className="border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary rounded-full text-[10px] font-bold tabular-nums"
                    >
                      {selectedCampaignIds.length}/{campaigns?.length ?? 0}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAll}
                      className="text-muted-foreground hover:bg-brand-cyan/10 hover:text-brand-cyan not-dark:hover:bg-primary/10 not-dark:hover:text-primary h-7 cursor-pointer rounded-lg px-2.5 text-[10px] font-semibold"
                    >
                      Todas
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={deselectAll}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive h-7 cursor-pointer rounded-lg px-2.5 text-[10px] font-semibold"
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="grid max-h-60 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {campaigns?.map((campaign) => {
                    const isSelected = selectedCampaignIds.includes(campaign.id)
                    return (
                      <label
                        key={campaign.id}
                        className={cn(
                          "group flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all select-none",
                          isSelected
                            ? "border-brand-cyan/30 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5"
                            : "hover:border-border/60 hover:bg-muted/40 border-transparent",
                        )}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCampaign(campaign.id)}
                          className="shrink-0"
                        />
                        <span
                          className={cn(
                            "truncate text-xs font-medium transition-colors",
                            isSelected
                              ? "text-foreground"
                              : "text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          {campaign.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* ===== Tabs: faixas × top vídeos ===== */}
          <Reveal immediate delayMs={80}>
            <Tabs defaultValue="videos" className="gap-6">
              <TabsList className="bg-muted/40 ring-border/60 flex h-auto w-full snap-x flex-nowrap justify-start gap-1 overflow-x-auto rounded-full p-1.5 ring-1 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
                {(
                  [
                    {
                      value: "videos",
                      label: "Vídeos por Faixa",
                      icon: VideoCamera,
                    },
                    { value: "top", label: "Top Vídeos", icon: Trophy },
                  ] as const
                ).map((tab) => {
                  const TabIcon = tab.icon
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="[&[data-state=active]_svg]:text-primary h-10 flex-none cursor-pointer snap-start gap-1.5 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-all after:hidden sm:flex-1"
                    >
                      <TabIcon className="size-4 shrink-0" weight="fill" />
                      {tab.label}
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {/* ===== Aba: Vídeos por Faixa ===== */}
              <TabsContent value="videos" className="flex flex-col gap-6">
                {tabLoading ? (
                  <TiersTabSkeleton />
                ) : metrics && summary ? (
                  <>
                    {/* KPIs do período */}
                    <Reveal immediate>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatTile
                          icon={<VideoCamera className="size-4" weight="fill" />}
                          label="Total de Vídeos"
                          value={summary.totalPosts}
                          kind="int"
                          hint="no período"
                          accent="cyan"
                        />
                        <StatTile
                          icon={<Eye className="size-4" weight="fill" />}
                          label="Views Totais"
                          value={summary.totalViews}
                          kind="compact"
                          hint="todas as plataformas"
                          accent="green"
                          gradientValue
                        />
                        <StatTile
                          icon={<Heart className="size-4" weight="fill" />}
                          label="Engajamento Total"
                          value={summary.totalEngagement}
                          kind="compact"
                          hint="likes · comentários · shares"
                          accent="cyan"
                        />
                        <ErStatTile value={summary.avgER} />
                      </div>
                    </Reveal>

                    {/* Pills de plataforma */}
                    {Object.keys(summary.platformStats).length > 0 && (
                      <Reveal immediate delayMs={60}>
                        <div className="flex flex-wrap gap-2.5">
                          {Object.entries(summary.platformStats)
                            .sort(([, a], [, b]) => b.views - a.views)
                            .map(([platform, stats]) => {
                              const config =
                                platformConfig[platform as PlatformKey]
                              if (!config) return null
                              const PlatformIcon = config.icon
                              return (
                                <div
                                  key={platform}
                                  className={cn(
                                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-2",
                                    config.bgColor,
                                    config.borderColor,
                                  )}
                                >
                                  <PlatformIcon
                                    className={cn("size-4", config.color)}
                                  />
                                  <span className="text-sm font-semibold">
                                    {config.label}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary rounded-full text-[10px] font-bold tabular-nums"
                                  >
                                    {stats.count} vídeos
                                  </Badge>
                                  <span className="text-muted-foreground text-xs tabular-nums">
                                    {formatCompact(stats.views)} views
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </Reveal>
                    )}

                    {/* Cards de faixa */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                      {metrics.tiers.map((tier, index) => {
                        const style = TIER_STYLES[index] ?? TIER_STYLES[0]
                        const percentage =
                          summary.totalPosts > 0
                            ? ((tier.withER / summary.totalPosts) * 100).toFixed(
                                1,
                              )
                            : "0"
                        return (
                          <Reveal
                            immediate
                            key={tier.threshold}
                            delayMs={120 + index * 70}
                          >
                            <div
                              className={cn(
                                "glass-card relative flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-5",
                                style.border,
                              )}
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  "pointer-events-none absolute inset-0 bg-gradient-to-b",
                                  style.overlay,
                                )}
                              />

                              {/* Cabeçalho da faixa */}
                              <div className="relative flex items-center gap-2">
                                <span
                                  className={cn(
                                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                    style.chip,
                                  )}
                                >
                                  <Lightning className="size-4" weight="fill" />
                                </span>
                                <div className="leading-tight">
                                  <p
                                    className={cn(
                                      "text-lg font-bold tracking-tight",
                                      style.text,
                                    )}
                                  >
                                    ≥ {tier.label}
                                  </p>
                                  <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                                    views
                                  </p>
                                </div>
                              </div>

                              {/* Contagem */}
                              <div className="relative">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-3xl font-black tracking-tight tabular-nums">
                                    {tier.withER.toLocaleString("pt-BR")}
                                  </span>
                                  <span className="text-muted-foreground text-xs">
                                    vídeos
                                  </span>
                                </div>
                                <p className="text-muted-foreground mt-1 text-[10px]">
                                  com ER {">"} 1% · {percentage}% do total
                                </p>
                              </div>

                              {/* Métricas da faixa */}
                              <div className="border-border/60 relative flex flex-col gap-2 border-t pt-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium">
                                    <Pulse className="size-3" /> ER médio
                                  </span>
                                  <span className="text-xs font-semibold tabular-nums">
                                    {tier.avgER.toFixed(2)}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium">
                                    <Eye className="size-3" /> Views médias
                                  </span>
                                  <span className="text-xs font-semibold tabular-nums">
                                    {formatCompact(tier.avgViews)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] font-medium">
                                    <VideoCamera className="size-3" /> Sem ER
                                  </span>
                                  <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                                    {(tier.total - tier.withER).toLocaleString(
                                      "pt-BR",
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Plataformas da faixa */}
                              {Object.keys(tier.platformBreakdown).length >
                                0 && (
                                <div className="border-border/60 relative mt-auto flex flex-wrap gap-1.5 border-t pt-3">
                                  {Object.entries(tier.platformBreakdown)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([platform, count]) => {
                                      const config =
                                        platformConfig[platform as PlatformKey]
                                      if (!config) return null
                                      const PlatformIcon = config.icon
                                      return (
                                        <span
                                          key={platform}
                                          className="border-border/60 bg-muted/30 inline-flex items-center gap-1 rounded-md border px-2 py-0.5"
                                        >
                                          <PlatformIcon
                                            className={cn(
                                              "size-3",
                                              config.color,
                                            )}
                                          />
                                          <span className="text-[10px] font-semibold tabular-nums">
                                            {count}
                                          </span>
                                        </span>
                                      )
                                    })}
                                </div>
                              )}
                            </div>
                          </Reveal>
                        )
                      })}
                    </div>
                  </>
                ) : selectedCampaignIds.length === 0 ? (
                  <EmptyState
                    icon={<Funnel className="size-6" weight="fill" />}
                    title="Selecione ao menos uma competição"
                    description="Escolha as competições acima para visualizar os dados e métricas detalhadas."
                  />
                ) : null}
              </TabsContent>

              {/* ===== Aba: Top Vídeos ===== */}
              <TabsContent value="top" className="flex flex-col gap-3">
                {tabLoading ? (
                  <TopVideosSkeleton />
                ) : metrics && metrics.topVideos.length > 0 ? (
                  <>
                    <Reveal immediate>
                      <p className="text-muted-foreground text-sm">
                        Top 20 vídeos com ≥ 10k views e ER {">"} 1% no período
                        selecionado
                      </p>
                    </Reveal>
                    {metrics.topVideos.map((video, index) => {
                      const config =
                        platformConfig[video.platform as PlatformKey]
                      const PlatformIcon = config?.icon
                      const isTop3 = index < 3
                      return (
                        <Reveal
                          immediate
                          key={video.id}
                          delayMs={40 + Math.min(index, 8) * 60}
                        >
                          <div
                            className={cn(
                              "glass-card glass-card-hover relative flex items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4",
                              isTop3 && "border-amber-500/25",
                            )}
                          >
                            {isTop3 && (
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-500/[0.07] to-transparent"
                              />
                            )}

                            {/* Posição */}
                            {isTop3 ? (
                              <span
                                className={cn(
                                  "relative flex size-9 shrink-0 items-center justify-center rounded-xl text-white sm:size-10",
                                  MEDAL_STYLES[index] ?? MEDAL_STYLES[0],
                                )}
                              >
                                <Medal
                                  className="size-4.5 sm:size-5"
                                  weight="fill"
                                />
                              </span>
                            ) : (
                              <span className="bg-muted/50 text-muted-foreground relative flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-black tabular-nums sm:size-10">
                                {index + 1}
                              </span>
                            )}

                            {/* Thumbnail */}
                            {video.thumbnailUrl && (
                              <span className="bg-muted/30 relative block size-12 shrink-0 overflow-hidden rounded-xl sm:size-14">
                                <Image
                                  src={video.thumbnailUrl}
                                  alt=""
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                  unoptimized
                                />
                              </span>
                            )}

                            {/* Info */}
                            <div className="relative min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {PlatformIcon && (
                                  <PlatformIcon
                                    className={cn(
                                      "size-3.5 shrink-0",
                                      config.color,
                                    )}
                                  />
                                )}
                                <span className="truncate text-sm font-bold">
                                  @{video.username}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="hidden shrink-0 rounded-full text-[9px] sm:inline-flex"
                                >
                                  {video.campaignName}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Eye className="size-3" />
                                  {formatCompact(video.views)}
                                </span>
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Heart className="size-3" />
                                  {formatCompact(video.likes)}
                                </span>
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <ChatCircle className="size-3" />
                                  {formatCompact(video.comments)}
                                </span>
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <ShareNetwork className="size-3" />
                                  {formatCompact(video.shares)}
                                </span>
                              </div>
                            </div>

                            {/* ER + link externo */}
                            <div className="relative flex shrink-0 items-center gap-3">
                              <div className="hidden text-right sm:block">
                                <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                                  ER
                                </p>
                                <p
                                  className={cn(
                                    "text-sm font-bold tabular-nums",
                                    video.er >= 5
                                      ? "text-cyan-600 dark:text-cyan-400"
                                      : video.er >= 3
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-foreground",
                                  )}
                                >
                                  {video.er.toFixed(2)}%
                                </p>
                              </div>
                              {video.submittedUrl && (
                                <a
                                  href={video.submittedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label="Abrir vídeo"
                                  className="border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg border transition-colors"
                                >
                                  <ArrowSquareOut className="size-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </Reveal>
                      )
                    })}
                  </>
                ) : (
                  <EmptyState
                    icon={<Trophy className="size-6" weight="fill" />}
                    title="Nenhum vídeo encontrado"
                    description="Não há vídeos com mais de 10k views e ER acima de 1% no período selecionado."
                  />
                )}
              </TabsContent>
            </Tabs>
          </Reveal>
        </>
      )}
    </div>
  )
}

/* ============================================================
   Tile custom de ER médio — padrão do StatTile, mas com 2 casas
   decimais (o CountUp percent usa 1 casa).
   ============================================================ */
function ErStatTile({ value }: { value: number }) {
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          ER Médio
        </span>
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          <Pulse className="size-4" weight="fill" />
        </span>
      </div>
      <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
        {value.toFixed(2)}%
      </span>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">engajamento ÷ views</span>
      </div>
    </div>
  )
}

/* ============================================================
   Empty state da marca (chip gradiente + título + descrição).
   ============================================================ */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Reveal immediate>
      <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
        <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
          {icon}
        </span>
        <div>
          <p className="text-base font-bold">{title}</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            {description}
          </p>
        </div>
      </div>
    </Reveal>
  )
}

/* ============================================================
   Skeletons — espelham o layout real com o kit da marca.
   ============================================================ */

/** Fantasma dos cards de filtro (período + competições). */
function FiltersSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <Bone delay={60} className="h-4 w-36" />
        </div>
        <Bone delay={120} className="h-11 w-full rounded-xl" />
        <Bone delay={180} className="h-3 w-44 rounded-full" />
      </div>
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <Bone delay={60} className="h-4 w-28" />
            <Bone delay={120} className="h-5 w-10 rounded-full" />
          </div>
          <div className="flex gap-1.5">
            <Bone delay={180} className="h-7 w-14 rounded-lg" />
            <Bone delay={240} className="h-7 w-14 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            >
              <Bone delay={index * 70} className="size-4 rounded-[4px]" />
              <Bone
                delay={index * 70 + 50}
                className="h-3.5 max-w-40 flex-1 rounded-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Fantasma da barra de tabs em pill. */
function TabsPillSkeleton() {
  return (
    <div className="bg-muted/40 ring-border/60 flex w-full gap-1 rounded-full p-1.5 ring-1">
      <Bone className="h-10 flex-1 rounded-full" />
      <Bone delay={120} className="h-10 flex-1 rounded-full" />
    </div>
  )
}

/** Fantasma da aba de faixas: KPIs + pills de plataforma + tier cards. */
function TiersTabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatTilesGridSkeleton
        count={4}
        className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
      />
      <div className="flex flex-wrap gap-2.5">
        {["w-40", "w-44", "w-36"].map((width, index) => (
          <Bone
            key={index}
            delay={index * 100}
            className={cn("h-9 rounded-full", width)}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2">
              <Bone delay={index * 90} className="size-9 rounded-lg" />
              <div className="flex flex-col gap-1.5">
                <Bone delay={index * 90 + 40} className="h-4 w-14" />
                <Bone
                  delay={index * 90 + 80}
                  className="h-2.5 w-9 rounded-full"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Bone delay={index * 90 + 120} className="h-8 w-24" />
              <Bone
                delay={index * 90 + 160}
                className="h-2.5 w-32 rounded-full"
              />
            </div>
            <div className="border-border/60 flex flex-col gap-2 border-t pt-3">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between">
                  <Bone
                    delay={index * 90 + 200 + row * 40}
                    className="h-2.5 w-16 rounded-full"
                  />
                  <Bone
                    delay={index * 90 + 220 + row * 40}
                    className="h-2.5 w-10 rounded-full"
                  />
                </div>
              ))}
            </div>
            <div className="border-border/60 flex gap-1.5 border-t pt-3">
              {[0, 1, 2].map((pill) => (
                <Bone
                  key={pill}
                  delay={index * 90 + 340 + pill * 40}
                  className="h-5 w-10 rounded-md"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Fantasma da aba de top vídeos: legenda + linhas ranqueadas. */
function TopVideosSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Bone className="h-4 w-72 max-w-full rounded-full" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="glass-card flex items-center gap-3 rounded-2xl p-3 sm:gap-4 sm:p-4"
        >
          <Bone
            delay={index * 90}
            className="size-9 shrink-0 rounded-xl sm:size-10"
          />
          <Bone
            delay={index * 90 + 40}
            className="size-12 shrink-0 rounded-xl sm:size-14"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone delay={index * 90 + 80} className="h-3.5 w-1/3 max-w-36" />
            <Bone
              delay={index * 90 + 120}
              className="h-3 w-2/3 max-w-56 rounded-full"
            />
          </div>
          <div className="hidden flex-col items-end gap-1.5 sm:flex">
            <Bone delay={index * 90 + 160} className="h-2.5 w-6 rounded-full" />
            <Bone delay={index * 90 + 200} className="h-4 w-12" />
          </div>
          <Bone delay={index * 90 + 240} className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
