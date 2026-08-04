"use client"

import * as React from "react"
import {
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  Check,
  Copy,
  Crown,
  DiscordLogo,
  FileText,
  Globe,
  InstagramLogo,
  Lightning,
  LinkSimple,
  MagnifyingGlass,
  Megaphone,
  PaperPlaneTilt,
  Phone,
  SealCheck,
  ShieldWarning,
  TiktokLogo,
  TrendUp,
  Trophy,
  UserPlus,
  Users,
  X,
} from "@phosphor-icons/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { toast } from "sonner"

import { AcquisitionHeroViz, AcquisitionHeroVizSkeleton } from "@/components/clippers/acquisition-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { formatChartDate } from "@/components/home/platform-chart-meta"
import { SectionHeading } from "@/components/home/section-heading"
import { StatTile } from "@/components/home/stat-tile"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import { Bone, ListRowsSkeleton } from "@/components/shared/skeletons"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

/* ── Canais conhecidos ─────────────────────────────────────────────────── */
type SlugCategory = "social" | "outreach" | "product"

interface SlugConfig {
  slug: string
  label: string
  category: SlugCategory
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
}

const KNOWN_SLUGS: SlugConfig[] = [
  // Redes Sociais
  {
    slug: "instagram-clipfy",
    label: "Instagram Clipfy",
    category: "social",
    icon: InstagramLogo,
    color: "text-pink-500 dark:text-pink-400",
    bgColor: "bg-pink-500/15",
    borderColor: "border-pink-500/30",
  },
  {
    slug: "tiktok-clipfy",
    label: "TikTok Clipfy",
    category: "social",
    icon: TiktokLogo,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-400/15",
    borderColor: "border-cyan-400/30",
  },
  {
    slug: "discord-clipfy",
    label: "Discord Clipfy",
    category: "social",
    icon: DiscordLogo,
    color: "text-indigo-500 dark:text-indigo-400",
    bgColor: "bg-indigo-400/15",
    borderColor: "border-indigo-400/30",
  },
  // Captação Ativa
  {
    slug: "mutirao-clipfy",
    label: "Mutirão",
    category: "outreach",
    icon: Phone,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-500/15",
    borderColor: "border-teal-500/30",
  },
  {
    slug: "link-direto-clipfy",
    label: "Link Direto",
    category: "outreach",
    icon: PaperPlaneTilt,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/30",
  },
  {
    slug: "indicacao-clipfy",
    label: "Indicação",
    category: "outreach",
    icon: UserPlus,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/15",
    borderColor: "border-emerald-500/30",
  },
  // Produtos
  {
    slug: "clipfy-pro",
    label: "Clipfy PRO",
    category: "product",
    icon: Crown,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/30",
  },
  {
    slug: "clipfy-manual",
    label: "Clipfy Manual",
    category: "product",
    icon: FileText,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/15",
    borderColor: "border-sky-500/30",
  },
  {
    slug: "clipfy-ultra",
    label: "Clipfy Ultra",
    category: "product",
    icon: Lightning,
    color: "text-violet-500 dark:text-violet-400",
    bgColor: "bg-violet-500/15",
    borderColor: "border-violet-500/30",
  },
]

const SLUG_MAP = new Map(KNOWN_SLUGS.map((entry) => [entry.slug, entry]))

const CATEGORY_LABELS: Record<
  SlugCategory,
  { label: string; description: string; icon: React.ElementType }
> = {
  social: {
    label: "Redes Sociais",
    description: "Canais de mídia social",
    icon: Users,
  },
  outreach: {
    label: "Captação Ativa",
    description: "Conversão direta via calls e mensagens",
    icon: Phone,
  },
  product: {
    label: "Produtos",
    description: "Compras e assinaturas",
    icon: Crown,
  },
}

/*
 * Cores dos gráficos via CSS vars da marca (mudam junto com o tema).
 * Séries que compartilham família de matiz (total × verificados) carregam
 * codificação secundária: tracejado, espessura e legenda com dot + label.
 */
const COLOR_ORGANIC = "var(--chart-tiktok)"
const COLOR_REFERRED = "var(--chart-growth)"
const COLOR_VERIFIED = "var(--chart-growth)"
const COLOR_UNVERIFIED = "var(--chart-kwai)"
const COLOR_CAMPAIGNS = "var(--chart-facebook)"
const COLOR_OTHERS = "var(--chart-kwai)"

interface SourceEntry {
  slug: string
  count: number
  isCampaign: boolean
  campaignName: string | null
}

interface GrowthPoint {
  date: string
  total: number
  organic: number
  referred: number
  cumulative: number
  cumulativeVerified: number
  cumulativeUnverified: number
}

interface WeeklyPoint {
  week: string
  total: number
  organic: number
  referred: number
}

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))

/* ── Página ────────────────────────────────────────────────────────────── */
export default function Acquisition() {
  const { data, isLoading, error } = api.admin.acquisition.getDashboard.useQuery()
  const [sourceSearch, setSourceSearch] = React.useState("")

  if (error) return <AccessDeniedCard />

  const stats = data?.stats
  const verifiedRate =
    stats && stats.totalClippers > 0
      ? Math.round((stats.verifiedClippers / stats.totalClippers) * 100)
      : 0

  const matchesSearch = (source: SourceEntry) => {
    const term = sourceSearch.trim().toLowerCase()
    if (!term) return true
    return (
      source.slug.toLowerCase().includes(term) ||
      (source.campaignName?.toLowerCase().includes(term) ?? false)
    )
  }

  const allSources = (data?.topSources ?? []).filter(matchesSearch)
  const campaignSources = (data?.campaignSources ?? []).filter(matchesSearch)
  const channelSources = (data?.otherSources ?? []).filter(
    (source) => SLUG_MAP.has(source.slug) && matchesSearch(source),
  )
  const otherSources = (data?.otherSources ?? []).filter(matchesSearch)

  const donutData = [
    {
      name: "Orgânico",
      value: stats?.organicClippers ?? 0,
      color: COLOR_ORGANIC,
    },
    {
      name: "Competições",
      value: stats?.campaignReferralCount ?? 0,
      color: COLOR_CAMPAIGNS,
    },
    {
      name: "Outros canais",
      value: stats?.otherReferralCount ?? 0,
      color: COLOR_OTHERS,
    },
  ].filter((entry) => entry.value > 0)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Captação"
        title={
          <>
            De onde vêm os <span className="text-gradient">clipadores</span>
          </>
        }
        subtitle="Análise de origem e crescimento da comunidade — canais, competições e indicações que trazem novos clipadores todos os dias."
        viz={<AcquisitionHeroViz />}
        vizSkeleton={<AcquisitionHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <Users className="size-3.5" weight="fill" />,
            label: "Clipadores",
            value: stats?.totalClippers ?? 0,
            kind: "int",
          },
          {
            icon: <UserPlus className="size-3.5" weight="fill" />,
            label: "Com indicação",
            value: stats?.clippersWithReferral ?? 0,
            kind: "int",
          },
          {
            icon: <Lightning className="size-3.5" weight="fill" />,
            label: "Hoje",
            value: stats?.todayCount ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Users className="size-4" weight="fill" />}
            label="Total com Perfil"
            value={stats?.totalClippers ?? 0}
            kind="int"
            hint="iniciaram o onboarding"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<SealCheck className="size-4" weight="fill" />}
            label="Verificados"
            value={stats?.verifiedClippers ?? 0}
            kind="int"
            hint={`${verifiedRate}% com onboarding completo`}
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<UserPlus className="size-4" weight="fill" />}
            label="Com Indicação"
            value={stats?.clippersWithReferral ?? 0}
            kind="int"
            hint="vieram de algum canal"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Globe className="size-4" weight="fill" />}
            label="Orgânicos"
            value={stats?.organicClippers ?? 0}
            kind="int"
            hint="chegaram sozinhos"
            accent="green"
            gradientValue
            isLoading={isLoading}
          />
        </div>
      </Reveal>
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<Lightning className="size-4" weight="fill" />}
            label="Hoje"
            value={stats?.todayCount ?? 0}
            kind="int"
            hint="novos clipadores hoje"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<TrendUp className="size-4" weight="fill" />}
            label="Últimos 7 dias"
            value={stats?.last7daysCount ?? 0}
            kind="int"
            hint="novos na semana"
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<CalendarBlank className="size-4" weight="fill" />}
            label="Últimos 30 dias"
            value={stats?.last30daysCount ?? 0}
            kind="int"
            hint="novos no mês"
            accent="cyan"
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Crescimento acumulado + Origem ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <Reveal immediate delayMs={120} className="lg:col-span-3">
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<ChartLineUp className="size-4" weight="fill" />}
              title="Crescimento Acumulado"
              description="Total, verificados e não verificados (90 dias)"
            />
            <CumulativeGrowthChart
              data={data?.growthData ?? []}
              isLoading={isLoading}
            />
          </div>
        </Reveal>

        <Reveal immediate delayMs={180} className="lg:col-span-2">
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<ChartPieSlice className="size-4" weight="fill" />}
              title="Origem dos Cadastros"
              description="Orgânico, competições e outros canais"
            />
            <OriginDonut
              data={donutData}
              total={stats?.totalClippers ?? 0}
              isLoading={isLoading}
            />
          </div>
        </Reveal>
      </div>

      {/* ===== Cadastros diários + Tendência semanal ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Reveal immediate delayMs={240}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<ChartBar className="size-4" weight="fill" />}
              title="Cadastros Diários"
              description="Orgânico × indicação (últimos 30 dias)"
            />
            <DailyBarChart
              data={(data?.growthData ?? []).slice(-30)}
              isLoading={isLoading}
            />
          </div>
        </Reveal>

        <Reveal immediate delayMs={300}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<TrendUp className="size-4" weight="fill" />}
              title="Tendência Semanal"
              description="Últimas 12 semanas"
            />
            <WeeklyLineChart
              data={data?.weeklyData ?? []}
              isLoading={isLoading}
            />
          </div>
        </Reveal>
      </div>

      {/* ===== Canais de captação ===== */}
      <Reveal immediate delayMs={360}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<Megaphone className="size-4" weight="fill" />}
            title="Canais de Captação"
            description="Slugs configurados para rastrear a origem dos clipadores"
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {(["social", "outreach", "product"] as SlugCategory[]).map(
              (category) => {
                const catConfig = CATEGORY_LABELS[category]
                const CatIcon = catConfig.icon
                return (
                  <div key={category} className="flex flex-col gap-3">
                    <div className="border-border/60 flex items-center gap-2.5 border-b pb-2.5">
                      <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                        <CatIcon className="size-3.5" weight="fill" />
                      </span>
                      <div className="leading-tight">
                        <p className="text-sm font-bold">{catConfig.label}</p>
                        <p className="text-muted-foreground text-[10px]">
                          {catConfig.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {KNOWN_SLUGS.filter(
                        (entry) => entry.category === category,
                      ).map((entry) => (
                        <SlugChannelRow
                          key={entry.slug}
                          config={entry}
                          count={
                            (data?.topSources ?? []).find(
                              (source) => source.slug === entry.slug,
                            )?.count ?? 0
                          }
                          isLoading={isLoading}
                        />
                      ))}
                    </div>
                  </div>
                )
              },
            )}
          </div>
        </div>
      </Reveal>

      {/* ===== Fontes ===== */}
      <Reveal immediate delayMs={420}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<MagnifyingGlass className="size-4" weight="bold" />}
            title="Fontes"
            description="Todas as origens rastreadas dos cadastros"
          />
          <Tabs defaultValue="all" className="flex w-full flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  value={sourceSearch}
                  onChange={(event) => setSourceSearch(event.target.value)}
                  placeholder="Buscar slug ou competição..."
                  className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
                />
                {sourceSearch && (
                  <button
                    type="button"
                    onClick={() => setSourceSearch("")}
                    aria-label="Limpar busca"
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <TabsList className="h-10 w-full rounded-xl lg:w-auto">
                <TabsTrigger value="all" className="flex-1 cursor-pointer text-xs">
                  Todas
                </TabsTrigger>
                <TabsTrigger
                  value="campaigns"
                  className="flex-1 cursor-pointer text-xs"
                >
                  Competições
                </TabsTrigger>
                <TabsTrigger
                  value="channels"
                  className="flex-1 cursor-pointer text-xs"
                >
                  Canais
                </TabsTrigger>
                <TabsTrigger
                  value="others"
                  className="flex-1 cursor-pointer text-xs"
                >
                  Outros
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all">
              <SourcesList
                sources={allSources}
                totalReferred={stats?.clippersWithReferral ?? 0}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="campaigns">
              <SourcesList
                sources={campaignSources}
                totalReferred={stats?.clippersWithReferral ?? 0}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="channels">
              <SourcesList
                sources={channelSources}
                totalReferred={stats?.clippersWithReferral ?? 0}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="others">
              <SourcesList
                sources={otherSources}
                totalReferred={stats?.clippersWithReferral ?? 0}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </div>
      </Reveal>

      {/* ===== Últimos captados ===== */}
      <Reveal immediate delayMs={480}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <SectionHeading
            icon={<UserPlus className="size-4" weight="fill" />}
            title="Últimos Clipadores Captados"
            description="Cadastros mais recentes que vieram de uma referência"
          />
          {isLoading ? (
            <ListRowsSkeleton rows={8} />
          ) : (data?.recentReferred ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
                <Users className="size-6" weight="fill" />
              </span>
              <p className="text-muted-foreground text-sm">
                Nenhum clipador captado ainda
              </p>
            </div>
          ) : (
            <div className="-mr-2 flex max-h-[460px] flex-col gap-1 overflow-y-auto pr-2">
              {(data?.recentReferred ?? []).map((clipper, index) => {
                const known = clipper.referralSlug
                  ? SLUG_MAP.get(clipper.referralSlug)
                  : undefined
                const KnownIcon = known?.icon
                return (
                  <div
                    key={clipper.id}
                    className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
                  >
                    <span className="text-muted-foreground w-6 shrink-0 text-right text-xs font-medium tabular-nums">
                      {index + 1}.
                    </span>
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage
                        src={clipper.imageUrl ?? undefined}
                        alt={clipper.name ?? "Clipador"}
                      />
                      <AvatarFallback className="bg-gradient-custom text-xs font-bold text-[#04222A]">
                        {(clipper.name ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {clipper.name ?? "Sem nome"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {clipper.email}
                      </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      {known && KnownIcon ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 rounded-full text-[10px]",
                            known.borderColor,
                            known.bgColor,
                            known.color,
                          )}
                        >
                          <KnownIcon className="size-3" />
                          {known.label}
                        </Badge>
                      ) : clipper.isCampaign ? (
                        <Badge
                          variant="outline"
                          className="max-w-40 gap-1 rounded-full border-cyan-500/30 bg-cyan-500/15 text-[10px] text-cyan-600 dark:text-cyan-400"
                        >
                          <Trophy className="size-3 shrink-0" weight="fill" />
                          <span className="truncate">
                            {clipper.campaignName ?? clipper.referralSlug}
                          </span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="max-w-40 gap-1 rounded-full border-violet-500/30 bg-violet-500/15 text-[10px] text-violet-600 dark:text-violet-400"
                        >
                          <LinkSimple className="size-3 shrink-0" />
                          <span className="truncate">{clipper.referralSlug}</span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground hidden shrink-0 text-[10px] lg:block">
                      {formatDate(clipper.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  )
}

/* ── Linha de canal conhecido com botão de copiar ──────────────────────── */
function SlugChannelRow({
  config,
  count,
  isLoading,
}: {
  config: SlugConfig
  count: number
  isLoading: boolean
}) {
  const [copied, setCopied] = React.useState(false)
  const Icon = config.icon

  const handleCopy = () => {
    const url = `${window.location.origin}/sign-up?slug=${config.slug}`
    void navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Link copiado!", { description: url })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        "bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        config.borderColor,
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          config.bgColor,
        )}
      >
        <Icon className={cn("size-4", config.color)} weight="fill" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{config.label}</p>
        <p className="text-muted-foreground truncate font-mono text-[10px]">
          {config.slug}
        </p>
      </div>
      {isLoading ? (
        <Bone className="h-5 w-14 shrink-0 rounded-full" />
      ) : (
        <Badge
          variant="outline"
          className="border-brand-cyan/25 not-dark:border-primary/30 shrink-0 rounded-full text-[10px] font-bold tabular-nums"
        >
          <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
            {count.toLocaleString("pt-BR")}
          </span>
        </Badge>
      )}
      <button
        type="button"
        onClick={handleCopy}
        title="Copiar link de captação"
        aria-label={`Copiar link de captação de ${config.label}`}
        className={cn(
          "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all",
          copied
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        )}
      >
        {copied ? (
          <Check className="size-3.5" weight="bold" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}

/* ── Lista de fontes com barra proporcional ────────────────────────────── */
function SourcesList({
  sources,
  totalReferred,
  isLoading,
}: {
  sources: SourceEntry[]
  totalReferred: number
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div aria-hidden className="flex flex-col gap-1.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-2 py-2">
            <Bone
              delay={index * 80}
              className="h-3 w-6 shrink-0 rounded-full"
            />
            <Bone
              delay={index * 80 + 40}
              className="size-8 shrink-0 rounded-lg"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Bone
                  delay={index * 80 + 80}
                  className="h-3 w-32 rounded-full"
                />
                <Bone
                  delay={index * 80 + 120}
                  className="h-3 w-10 rounded-full"
                />
              </div>
              <Bone
                delay={index * 80 + 160}
                className="h-1.5 w-full rounded-full"
              />
            </div>
            <Bone
              delay={index * 80 + 200}
              className="h-3 w-12 shrink-0 rounded-full"
            />
          </div>
        ))}
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <MagnifyingGlass className="size-6" weight="bold" />
        </span>
        <p className="text-muted-foreground text-sm">Nenhuma fonte encontrada</p>
      </div>
    )
  }

  const maxCount = Math.max(...sources.map((source) => source.count), 1)

  return (
    <div className="-mr-2 flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-2">
      {sources.map((source, index) => {
        const known = SLUG_MAP.get(source.slug)
        const Icon = known?.icon ?? (source.isCampaign ? Trophy : LinkSimple)
        const displayName =
          known?.label ?? source.campaignName ?? source.slug
        const pct =
          totalReferred > 0 ? (source.count / totalReferred) * 100 : 0
        const barPct = Math.max((source.count / maxCount) * 100, 2)
        return (
          <div
            key={source.slug}
            className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
          >
            <span className="text-muted-foreground w-6 shrink-0 text-right text-xs font-medium tabular-nums">
              {index + 1}.
            </span>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                known?.bgColor ??
                  (source.isCampaign ? "bg-cyan-500/15" : "bg-violet-500/15"),
              )}
            >
              <Icon
                className={cn(
                  "size-4",
                  known?.color ??
                    (source.isCampaign
                      ? "text-cyan-600 dark:text-cyan-400"
                      : "text-violet-600 dark:text-violet-400"),
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-[13px] font-semibold" title={source.slug}>
                  {displayName}
                </p>
                <span className="shrink-0 text-[13px] font-bold tabular-nums">
                  {source.count.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="bg-muted/60 h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
            <span className="text-muted-foreground w-12 shrink-0 text-right text-xs font-semibold tabular-nums">
              {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ── Ossos de gráfico: barras em onda + legenda fantasma ───────────────── */
function ChartBones({
  heightClass = "h-[260px]",
  bars = 14,
  legend = 0,
}: {
  heightClass?: string
  bars?: number
  legend?: number
}) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div
        className={cn(
          "flex w-full items-end justify-between gap-1.5 sm:gap-2.5",
          heightClass,
        )}
      >
        {Array.from({ length: bars }).map((_, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone w-full rounded-t-lg"
            style={
              {
                height: `${24 + ((index * 37) % 68)}%`,
                "--bar-delay": `${index * 0.12}s`,
                "--bar-dur": "2.6s",
                "--shimmer-delay": `${index * 90}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      {legend > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {Array.from({ length: legend }).map((_, index) => (
            <span key={index} className="inline-flex items-center gap-1.5">
              <Bone delay={index * 120} className="size-2 rounded-full" />
              <Bone
                delay={index * 120 + 60}
                className="h-3 w-16 rounded-full"
              />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Legenda com dots ──────────────────────────────────────────────────── */
function LegendDots({
  items,
}: {
  items: { label: string; color?: string; gradient?: boolean }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium sm:text-xs"
        >
          {item.gradient ? (
            <span className="bg-gradient-custom size-2 rounded-full" />
          ) : (
            <span
              className="size-2 rounded-full"
              style={{ background: item.color }}
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  )
}

/* ── Tooltip glass genérico ────────────────────────────────────────────── */
function GlassTooltip({
  active,
  payload,
  label,
  formatLabel,
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    stroke?: string
    fill?: string
  }>
  label?: string
  formatLabel?: (value: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border-border bg-popover/95 min-w-40 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label ? (formatLabel ? formatLabel(label) : label) : ""}
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
                style={{
                  background: entry.stroke ?? entry.fill ?? entry.color,
                }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums">
              {Number(entry.value ?? 0).toLocaleString("pt-BR")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Crescimento acumulado ─────────────────────────────────────────────── */
function CumulativeGrowthChart({
  data,
  isLoading,
}: {
  data: GrowthPoint[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <ChartBones heightClass="h-[260px] sm:h-[300px]" bars={16} legend={3} />
    )
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        Sem dados de captação por enquanto
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="acq-total-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--chart-growth-start)" />
                <stop offset="100%" stopColor="var(--chart-growth-end)" />
              </linearGradient>
              <linearGradient id="acq-total-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-growth-end)"
                  stopOpacity={0.24}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-growth-end)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              axisLine={false}
              tickLine={false}
              minTickGap={48}
              tickMargin={10}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value: number) => formatCompact(value)}
              axisLine={false}
              tickLine={false}
              width={44}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <RechartsTooltip
              content={<GlassTooltip formatLabel={formatChartDate} />}
              cursor={{
                stroke:
                  "color-mix(in oklab, var(--foreground) 22%, transparent)",
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="Total"
              stroke="url(#acq-total-stroke)"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="url(#acq-total-fill)"
              animationDuration={650}
              activeDot={{
                r: 4.5,
                fill: "var(--chart-growth-end)",
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeVerified"
              name="Verificados"
              stroke={COLOR_VERIFIED}
              strokeWidth={2}
              strokeDasharray="6 3"
              fill="transparent"
              animationDuration={650}
              activeDot={{
                r: 4,
                fill: COLOR_VERIFIED,
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeUnverified"
              name="Não verificados"
              stroke={COLOR_UNVERIFIED}
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="transparent"
              animationDuration={650}
              activeDot={{
                r: 4,
                fill: COLOR_UNVERIFIED,
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <LegendDots
        items={[
          { label: "Total", gradient: true },
          { label: "Verificados", color: COLOR_VERIFIED },
          { label: "Não verificados", color: COLOR_UNVERIFIED },
        ]}
      />
    </div>
  )
}

/* ── Donut de origem (estilo platform-donut) ───────────────────────────── */
interface DonutEntry {
  name: string
  value: number
  color: string
}

function OriginDonut({
  data,
  total,
  isLoading,
}: {
  data: DonutEntry[]
  total: number
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div
        aria-hidden
        className="flex flex-col items-center gap-5 lg:h-full lg:justify-center"
      >
        <span className="skeleton-bone block size-44 shrink-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-26px),#000_calc(100%-25px))] sm:size-48" />
        <div className="flex w-full flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  <Bone
                    delay={index * 110}
                    className="size-2.5 rounded-[4px]"
                  />
                  <Bone
                    delay={index * 110 + 50}
                    className="h-3 w-24 rounded-full"
                  />
                </span>
                <Bone
                  delay={index * 110 + 100}
                  className="h-3 w-16 rounded-full"
                />
              </div>
              <Bone delay={index * 110 + 150} className="h-1 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const sum = data.reduce((acc, entry) => acc + entry.value, 0)

  if (sum === 0) {
    return (
      <p className="text-muted-foreground flex h-44 items-center justify-center text-sm">
        Sem cadastros registrados por enquanto
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 lg:h-full lg:justify-center">
      <div className="relative size-44 shrink-0 sm:size-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <RechartsTooltip content={<DonutTooltip total={sum} />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="94%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums">
            {formatCompact(total)}
          </span>
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            cadastros
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        {data.map((entry) => {
          const pct = (entry.value / sum) * 100
          return (
            <div key={entry.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-foreground/90 inline-flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-[4px]"
                    style={{ background: entry.color }}
                  />
                  <span className="truncate">{entry.name}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-bold">
                    {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {entry.value.toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <div className="bg-muted/50 h-1 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: entry.color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: Array<{ payload?: DonutEntry }>
  total: number
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  return (
    <div className="border-border bg-popover/95 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1 font-semibold">{datum.name}</p>
      <p className="text-muted-foreground">
        {datum.value.toLocaleString("pt-BR")} cadastros ·{" "}
        {((datum.value / total) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        %
      </p>
    </div>
  )
}

/* ── Cadastros diários (barras empilhadas) ─────────────────────────────── */
function DailyBarChart({
  data,
  isLoading,
}: {
  data: GrowthPoint[]
  isLoading: boolean
}) {
  if (isLoading) {
    return <ChartBones heightClass="h-[260px]" bars={18} legend={2} />
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        Sem cadastros registrados por enquanto
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
              tickMargin={10}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <RechartsTooltip
              content={<GlassTooltip formatLabel={formatChartDate} />}
              cursor={{
                fill: "color-mix(in oklab, var(--foreground) 6%, transparent)",
              }}
            />
            <Bar
              dataKey="organic"
              name="Orgânico"
              stackId="daily"
              fill={COLOR_ORGANIC}
              maxBarSize={18}
            />
            <Bar
              dataKey="referred"
              name="Indicação"
              stackId="daily"
              fill={COLOR_REFERRED}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <LegendDots
        items={[
          { label: "Orgânico", color: COLOR_ORGANIC },
          { label: "Indicação", color: COLOR_REFERRED },
        ]}
      />
    </div>
  )
}

/* ── Tendência semanal (linhas) ────────────────────────────────────────── */
function WeeklyLineChart({
  data,
  isLoading,
}: {
  data: WeeklyPoint[]
  isLoading: boolean
}) {
  if (isLoading) {
    return <ChartBones heightClass="h-[260px]" bars={12} legend={3} />
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        Sem dados semanais por enquanto
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
            />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              minTickGap={32}
              tickMargin={10}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={32}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <RechartsTooltip
              content={<GlassTooltip />}
              cursor={{
                stroke:
                  "color-mix(in oklab, var(--foreground) 22%, transparent)",
                strokeDasharray: "4 4",
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Total"
              stroke={COLOR_UNVERIFIED}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLOR_UNVERIFIED, strokeWidth: 0 }}
              activeDot={{
                r: 5,
                stroke: "var(--card)",
                strokeWidth: 2,
              }}
            />
            <Line
              type="monotone"
              dataKey="organic"
              name="Orgânico"
              stroke={COLOR_ORGANIC}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 2.5, fill: COLOR_ORGANIC, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="referred"
              name="Indicação"
              stroke={COLOR_REFERRED}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 2.5, fill: COLOR_REFERRED, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <LegendDots
        items={[
          { label: "Total", color: COLOR_UNVERIFIED },
          { label: "Orgânico", color: COLOR_ORGANIC },
          { label: "Indicação", color: COLOR_REFERRED },
        ]}
      />
    </div>
  )
}

/* ── Card de acesso restrito ───────────────────────────────────────────── */
function AccessDeniedCard() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <Reveal immediate>
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
          <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
            <ShieldWarning className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-base font-bold">Acesso restrito a administradores</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
              Você não tem permissão para visualizar os dados de captação. Fale
              com um administrador da Clipfy League.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
