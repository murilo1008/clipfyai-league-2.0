"use client"

import * as React from "react"
import {
  ArrowSquareOut,
  ArrowUpRight,
  ChartLineUp,
  ChatCircleDots,
  Clock,
  DeviceMobile,
  DeviceTablet,
  Eye,
  FileText,
  GlobeHemisphereWest,
  Heart,
  Lightning,
  Monitor,
  ShareNetwork,
  ShieldWarning,
  Sparkle,
  SquaresFour,
  Stack,
  Target,
  Trophy,
  UsersThree,
} from "@phosphor-icons/react"

import { BlogReportsHeroViz, BlogReportsHeroVizSkeleton } from "@/components/blog/blog-reports-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { CountUp, formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  ChartSkeleton,
  ListRowsSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

/* ============================================================
   Tipos do contrato
   ============================================================ */

type ReportsData = RouterOutputs["blog"]["getReportsData"]
type DayPoint = ReportsData["viewsByDay"][number]
type CategoryRow = ReportsData["categoryPerformance"][number]

type RankedPost = {
  id: string
  title: string
  slug: string
  viewsCount: number
  likesCount: number
  commentsCount: number
  category: { title: string; color: string | null } | null
}

type MetricKey = "views" | "likes" | "comments"

interface ActivityItem {
  key: string
  userName: string
  userImage: string | null
  postTitle: string
  createdAt: Date | string
  type: "like" | "comment"
}

/* ============================================================
   Configuração das séries
   ============================================================ */

const METRICS: Record<
  MetricKey,
  {
    label: string
    plural: string
    icon: React.ReactNode
    text: string
    bar: string
    soft: string
    active: string
  }
> = {
  views: {
    label: "Views",
    plural: "visualizações",
    icon: <Eye className="size-3.5" weight="fill" />,
    text: "text-brand-cyan not-dark:text-primary",
    bar: "bg-brand-cyan not-dark:bg-primary",
    soft: "bg-brand-cyan/12 not-dark:bg-primary/12",
    active:
      "border-brand-cyan/45 bg-brand-cyan/15 text-brand-cyan not-dark:border-primary/45 not-dark:bg-primary/10 not-dark:text-primary",
  },
  likes: {
    label: "Likes",
    plural: "curtidas",
    icon: <Heart className="size-3.5" weight="fill" />,
    text: "text-rose-500 dark:text-rose-400",
    bar: "bg-rose-500 dark:bg-rose-400",
    soft: "bg-rose-500/12",
    active:
      "border-rose-500/45 bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
  comments: {
    label: "Comentários",
    plural: "comentários",
    icon: <ChatCircleDots className="size-3.5" weight="fill" />,
    text: "text-violet-500 dark:text-violet-400",
    bar: "bg-violet-500 dark:bg-violet-400",
    soft: "bg-violet-500/12",
    active:
      "border-violet-500/45 bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
}

const METRIC_KEYS: MetricKey[] = ["views", "likes", "comments"]

const MEDALS = [
  "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  "bg-zinc-400/20 text-zinc-500 dark:text-zinc-300",
  "bg-orange-600/20 text-orange-600 dark:text-orange-400",
] as const

/* ============================================================
   Helpers
   ============================================================ */

/** "2026-07-28" → { day: "28", label: "28/07" } sem sofrer fuso horário. */
function splitDay(iso: string) {
  const [, month = "01", day = "01"] = iso.split("-")
  return { day, label: `${day}/${month}` }
}

function formatTimeAgo(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "agora"
  if (minutes < 60) return `${minutes}min atrás`
  if (hours < 24) return `${hours}h atrás`
  if (days < 7) return `${days}d atrás`
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || "?"
}

function metricOf(post: RankedPost, metric: MetricKey) {
  if (metric === "views") return post.viewsCount
  if (metric === "likes") return post.likesCount
  return post.commentsCount
}

/* ============================================================
   Página
   ============================================================ */

export default function Reports() {
  const { data, isLoading, error } = api.blog.getReportsData.useQuery()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        eyebrow="Clipfy League · Blog"
        title={
          <>
            As <span className="text-gradient">métricas</span> do blog
          </>
        }
        subtitle="Acompanhe o desempenho completo do seu blog"
        viz={<BlogReportsHeroViz />}
        vizSkeleton={<BlogReportsHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views",
            value: data?.totalViews ?? 0,
            kind: "compact",
          },
          {
            icon: <Heart className="size-3.5" weight="fill" />,
            label: "Likes",
            value: data?.totalLikes ?? 0,
            kind: "compact",
          },
          {
            icon: <ChatCircleDots className="size-3.5" weight="fill" />,
            label: "Comentários",
            value: data?.totalComments ?? 0,
            kind: "compact",
          },
        ]}
      />

      {error ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <ShieldWarning className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Erro ao carregar métricas</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Não foi possível buscar os dados do blog agora. Recarregue a
                página ou tente novamente em instantes.
              </p>
            </div>
          </div>
        </Reveal>
      ) : isLoading || !data ? (
        <ReportsSkeleton />
      ) : (
        <ReportsContent data={data} />
      )}
    </div>
  )
}

/* ============================================================
   Conteúdo
   ============================================================ */

function ReportsContent({ data }: { data: ReportsData }) {
  const [chartMetric, setChartMetric] = React.useState<MetricKey>("views")
  const [rankingTab, setRankingTab] = React.useState<MetricKey>("views")

  const chartData: DayPoint[] =
    chartMetric === "views"
      ? data.viewsByDay
      : chartMetric === "likes"
        ? data.likesByDay
        : data.commentsByDay

  const rankingData: RankedPost[] =
    rankingTab === "views"
      ? data.topPostsByViews
      : rankingTab === "likes"
        ? data.topPostsByLikes
        : data.topPostsByComments

  const totalDevices = data.devices.reduce((sum, item) => sum + item.count, 0)
  const totalBrowsers = data.browsers.reduce((sum, item) => sum + item.count, 0)
  const totalCountries = data.countries.reduce(
    (sum, item) => sum + item.count,
    0,
  )
  const totalReferrers = data.referrers.reduce(
    (sum, item) => sum + item.count,
    0,
  )

  const categories: CategoryRow[] = [...data.categoryPerformance].sort(
    (a, b) => b.totalViews - a.totalViews,
  )

  const recentActivity: ActivityItem[] = [
    ...data.recentLikes.map((like, index) => ({
      key: `like-${index}`,
      userName: like.userName,
      userImage: like.userImage,
      postTitle: like.postTitle,
      createdAt: like.createdAt,
      type: "like" as const,
    })),
    ...data.recentComments.map((comment, index) => ({
      key: `comment-${index}`,
      userName: comment.userName,
      userImage: comment.userImage,
      postTitle: comment.postTitle,
      createdAt: comment.createdAt,
      type: "comment" as const,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 6)

  return (
    <>
      {/* ===== KPIs principais ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Total de Views"
            value={data.totalViews}
            kind="compact"
            hint={`~${formatCompact(data.avgViews)} por post`}
            accent="cyan"
            gradientValue
          />
          <StatTile
            icon={<Heart className="size-4" weight="fill" />}
            label="Total de Likes"
            value={data.totalLikes}
            kind="compact"
            hint={`~${formatCompact(data.avgLikes)} por post`}
            accent="green"
          />
          <StatTile
            icon={<ChatCircleDots className="size-4" weight="fill" />}
            label="Comentários"
            value={data.totalComments}
            kind="compact"
            hint={`~${formatCompact(data.avgComments)} por post`}
            accent="cyan"
          />
          <StatTile
            icon={<Lightning className="size-4" weight="fill" />}
            label="Engajamento"
            value={Number(data.engagementRate) || 0}
            kind="percent"
            hint="likes + comentários por view"
            accent="gradient"
          />
        </div>
      </Reveal>

      {/* ===== KPIs secundários ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MiniStat
            icon={<ShareNetwork className="size-4" weight="fill" />}
            label="Compartilhamentos"
            value={data.totalShares}
            kind="compact"
          />
          <MiniStat
            icon={<FileText className="size-4" weight="fill" />}
            label="Publicados"
            value={data.publishedCount}
            kind="int"
            gradientValue
          />
          <MiniStat
            icon={<Clock className="size-4" weight="fill" />}
            label="Tempo Médio"
            value={data.avgReadTime}
            kind="int"
            suffix="min"
          />
          <MiniStat
            icon={<Stack className="size-4" weight="fill" />}
            label="Total de Posts"
            value={data.totalPosts}
            kind="int"
          />
        </div>
      </Reveal>

      {/* ===== Comparativo por período ===== */}
      <Reveal immediate delayMs={120}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PeriodCard
            metric="views"
            today={data.viewsToday}
            week={data.viewsLast7}
            month={data.viewsLast30}
          />
          <PeriodCard
            metric="likes"
            today={data.likesToday}
            week={data.likesLast7}
            month={data.likesLast30}
          />
          <PeriodCard
            metric="comments"
            today={data.commentsToday}
            week={data.commentsLast7}
            month={data.commentsLast30}
          />
        </div>
      </Reveal>

      {/* ===== Atividade diária ===== */}
      <Reveal immediate delayMs={180}>
        <SectionCard
          icon={<ChartLineUp className="size-4.5" weight="fill" />}
          title="Atividade Diária"
          hint="últimos 30 dias"
          action={
            <MetricToggle value={chartMetric} onChange={setChartMetric} />
          }
        >
          <DailyChart data={chartData} metric={chartMetric} />
        </SectionCard>
      </Reveal>

      {/* ===== Top posts + categorias ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-5">
        <Reveal immediate delayMs={240} className="xl:col-span-3">
          <SectionCard
            icon={<Trophy className="size-4.5" weight="fill" />}
            title="Top Posts"
            hint="ranking por métrica"
            action={
              <MetricToggle value={rankingTab} onChange={setRankingTab} />
            }
            className="h-full"
          >
            <TopPosts posts={rankingData} metric={rankingTab} />
          </SectionCard>
        </Reveal>

        <Reveal immediate delayMs={300} className="xl:col-span-2">
          <SectionCard
            icon={<SquaresFour className="size-4.5" weight="fill" />}
            title="Performance por Categoria"
            hint="ordenado por views"
            className="h-full"
          >
            <CategoryPerformance categories={categories} />
          </SectionCard>
        </Reveal>
      </div>

      {/* ===== Demografia ===== */}
      <Reveal immediate delayMs={340}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DemographicCard
            title="Dispositivos"
            icon={<DeviceMobile className="size-4" weight="fill" />}
            items={data.devices.map((item) => ({
              label:
                item.device === "mobile"
                  ? "Mobile"
                  : item.device === "desktop"
                    ? "Desktop"
                    : item.device === "tablet"
                      ? "Tablet"
                      : item.device,
              count: item.count,
              icon:
                item.device === "mobile" ? (
                  <DeviceMobile className="size-3.5" weight="fill" />
                ) : item.device === "desktop" ? (
                  <Monitor className="size-3.5" weight="fill" />
                ) : item.device === "tablet" ? (
                  <DeviceTablet className="size-3.5" weight="fill" />
                ) : (
                  <GlobeHemisphereWest className="size-3.5" weight="fill" />
                ),
            }))}
            total={totalDevices}
          />
          <DemographicCard
            title="Navegadores"
            icon={<GlobeHemisphereWest className="size-4" weight="fill" />}
            items={data.browsers.map((item) => ({
              label: item.browser,
              count: item.count,
            }))}
            total={totalBrowsers}
          />
          <DemographicCard
            title="Países"
            icon={<GlobeHemisphereWest className="size-4" weight="fill" />}
            items={data.countries.map((item) => ({
              label: item.country,
              count: item.count,
            }))}
            total={totalCountries}
          />
          <DemographicCard
            title="Origem do Tráfego"
            icon={<ArrowUpRight className="size-4" weight="bold" />}
            items={data.referrers.map((item) => ({
              label:
                item.referrer.length > 25
                  ? `${item.referrer.slice(0, 25)}...`
                  : item.referrer,
              count: item.count,
            }))}
            total={totalReferrers}
          />
        </div>
      </Reveal>

      {/* ===== Médias + atividade recente ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Reveal immediate delayMs={380}>
          <SectionCard
            icon={<Target className="size-4.5" weight="fill" />}
            title="Médias por Post"
            hint="considerando todos os posts"
            className="h-full"
          >
            <div className="grid grid-cols-2 gap-3">
              <AvgCard
                icon={<Eye className="size-4" weight="fill" />}
                label="Views/post"
                value={formatCompact(data.avgViews)}
                tone="views"
              />
              <AvgCard
                icon={<Heart className="size-4" weight="fill" />}
                label="Likes/post"
                value={formatCompact(data.avgLikes)}
                tone="likes"
              />
              <AvgCard
                icon={<ChatCircleDots className="size-4" weight="fill" />}
                label="Comentários/post"
                value={formatCompact(data.avgComments)}
                tone="comments"
              />
              <AvgCard
                icon={<Clock className="size-4" weight="fill" />}
                label="Tempo de leitura"
                value={`${data.avgReadTime} min`}
                tone="time"
              />
            </div>
          </SectionCard>
        </Reveal>

        <Reveal immediate delayMs={420}>
          <SectionCard
            icon={<Sparkle className="size-4.5" weight="fill" />}
            title="Atividade Recente"
            hint="últimas interações"
            className="h-full"
          >
            <RecentActivity items={recentActivity} />
          </SectionCard>
        </Reveal>
      </div>
    </>
  )
}

/* ============================================================
   Blocos
   ============================================================ */

function SectionCard({
  icon,
  title,
  hint,
  action,
  className,
  children,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
            {icon}
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate text-sm font-bold tracking-tight sm:text-base">
              {title}
            </h2>
            {hint && (
              <p className="text-muted-foreground truncate text-[11px] sm:text-xs">
                {hint}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function MetricToggle({
  value,
  onChange,
}: {
  value: MetricKey
  onChange: (metric: MetricKey) => void
}) {
  return (
    <div className="border-border/70 bg-muted/30 flex w-full items-center gap-1 overflow-x-auto rounded-full border p-1 sm:w-auto">
      {METRIC_KEYS.map((key) => {
        const config = METRICS[key]
        const isActive = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-3 text-[11px] font-semibold transition-all sm:text-xs",
              isActive
                ? config.active
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {config.icon}
            {config.label}
          </button>
        )
      })}
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  kind,
  suffix,
  gradientValue = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  kind: "int" | "compact"
  suffix?: string
  gradientValue?: boolean
}) {
  return (
    <div className="glass-card glass-card-hover flex items-center gap-3 rounded-2xl p-3.5 sm:p-4">
      <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="inline-flex items-baseline gap-1">
          <CountUp
            value={value}
            kind={kind}
            className={cn(
              "text-base font-bold tabular-nums sm:text-lg",
              gradientValue &&
                "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
            )}
          />
          {suffix && (
            <span className="text-muted-foreground text-[11px] font-medium">
              {suffix}
            </span>
          )}
        </span>
        <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}

function PeriodCard({
  metric,
  today,
  week,
  month,
}: {
  metric: MetricKey
  today: number
  week: number
  month: number
}) {
  const config = METRICS[metric]
  const max = Math.max(today, week, month, 1)
  const periods = [
    { label: "Hoje", value: today },
    { label: "7 dias", value: week },
    { label: "30 dias", value: month },
  ]

  return (
    <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          {config.icon}
        </span>
        <span className="truncate text-sm font-bold">
          {metric === "views"
            ? "Visualizações"
            : metric === "likes"
              ? "Curtidas"
              : "Comentários"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {periods.map((period) => (
          <div
            key={period.label}
            className="bg-muted/40 flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-2.5"
          >
            <CountUp
              value={period.value}
              kind="compact"
              className="text-base font-bold tabular-nums sm:text-lg"
            />
            <span className="bg-muted/60 block h-1 w-full overflow-hidden rounded-full">
              <span
                className={cn(
                  "block h-full rounded-full opacity-80 transition-all duration-700",
                  config.bar,
                )}
                style={{ width: `${(period.value / max) * 100}%` }}
              />
            </span>
            <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
              {period.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyChart({
  data,
  metric,
}: {
  data: DayPoint[]
  metric: MetricKey
}) {
  const config = METRICS[metric]
  const max = Math.max(...data.map((point) => point.count), 1)

  return (
    <TooltipProvider>
      <div className="flex h-48 items-end gap-[2px] sm:h-56 sm:gap-1 md:h-64">
        {data.map((point, index) => {
          const { day, label } = splitDay(point.date)
          const isLast = index === data.length - 1
          const height = (point.count / max) * 100

          return (
            <Tooltip key={point.date}>
              <TooltipTrigger asChild>
                <div className="flex h-full min-w-0 flex-1 cursor-default flex-col items-center justify-end gap-1">
                  <span
                    className={cn(
                      "w-full rounded-t-sm transition-all duration-300",
                      config.bar,
                      isLast
                        ? "opacity-100 shadow-md"
                        : "opacity-55 hover:opacity-90",
                      point.count === 0 && "opacity-20",
                    )}
                    style={{
                      height: `${Math.max(height, point.count > 0 ? 4 : 1)}%`,
                      minHeight: point.count > 0 ? 4 : 1,
                    }}
                  />
                  {(index % 5 === 0 || isLast) && (
                    <span
                      className={cn(
                        "text-[8px] tabular-nums sm:text-[9px]",
                        isLast
                          ? "text-foreground font-bold"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {day}
                    </span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-[11px] font-bold">{label}</p>
                <p className="text-[11px] opacity-80">
                  {point.count.toLocaleString("pt-BR")} {config.plural}
                </p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function TopPosts({
  posts,
  metric,
}: {
  posts: RankedPost[]
  metric: MetricKey
}) {
  const config = METRICS[metric]
  const max = Math.max(...posts.map((post) => metricOf(post, metric)), 1)

  if (posts.length === 0) {
    return (
      <EmptyBlock
        icon={<Trophy className="size-6" weight="fill" />}
        title="Nenhum post publicado ainda"
        description="Publique um post para ver o ranking por métrica."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {posts.map((post, index) => {
        const value = metricOf(post, metric)
        const width = (value / max) * 100
        const color = post.category?.color ?? "#888888"

        return (
          <div
            key={post.id}
            className="border-border/60 bg-muted/20 relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-0 opacity-40 transition-all duration-700",
                config.soft,
              )}
              style={{ width: `${width}%` }}
            />

            <span
              className={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                MEDALS[index] ?? "bg-muted/60 text-muted-foreground",
              )}
            >
              {index + 1}
            </span>

            <div className="relative flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-xs font-semibold sm:text-[13px]">
                {post.title}
              </p>
              {post.category && (
                <Badge
                  variant="outline"
                  className="h-4 w-fit max-w-full truncate rounded-full px-1.5 text-[9px]"
                  style={{
                    backgroundColor: `${color}18`,
                    color,
                    borderColor: `${color}40`,
                  }}
                >
                  {post.category.title}
                </Badge>
              )}
            </div>

            <div className="relative hidden shrink-0 items-center gap-3.5 sm:flex">
              <RowMetric
                icon={<Eye className="size-3" weight="fill" />}
                value={post.viewsCount}
                active={metric === "views"}
                tone={METRICS.views.text}
              />
              <RowMetric
                icon={<Heart className="size-3" weight="fill" />}
                value={post.likesCount}
                active={metric === "likes"}
                tone={METRICS.likes.text}
              />
              <RowMetric
                icon={<ChatCircleDots className="size-3" weight="fill" />}
                value={post.commentsCount}
                active={metric === "comments"}
                tone={METRICS.comments.text}
              />
            </div>

            <span
              className={cn(
                "relative shrink-0 text-sm font-bold tabular-nums sm:hidden",
                config.text,
              )}
            >
              {formatCompact(value)}
            </span>

            <a
              href={`/blog/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Abrir ${post.title}`}
              className="text-muted-foreground/50 hover:text-foreground relative shrink-0 cursor-pointer transition-colors"
            >
              <ArrowSquareOut className="size-4" weight="bold" />
            </a>
          </div>
        )
      })}
    </div>
  )
}

function RowMetric({
  icon,
  value,
  active,
  tone,
}: {
  icon: React.ReactNode
  value: number
  active: boolean
  tone: string
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={tone}>{icon}</span>
      <span
        className={cn(
          "text-xs font-bold tabular-nums",
          active ? tone : "text-foreground/70",
        )}
      >
        {formatCompact(value)}
      </span>
    </span>
  )
}

function CategoryPerformance({ categories }: { categories: CategoryRow[] }) {
  if (categories.length === 0) {
    return (
      <EmptyBlock
        icon={<SquaresFour className="size-6" weight="fill" />}
        title="Nenhuma categoria com posts"
        description="Crie categorias e publique posts para comparar o desempenho."
      />
    )
  }

  const max = Math.max(...categories.map((item) => item.totalViews), 1)

  return (
    <div className="flex flex-col gap-3.5">
      {categories.map((category) => {
        const color = category.color ?? "#888888"
        return (
          <div key={category.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-xs font-semibold">
                  {category.title}
                </span>
                <Badge
                  variant="outline"
                  className="border-border/60 text-muted-foreground h-4 shrink-0 rounded-full px-1.5 text-[9px]"
                >
                  {category.postsCount} post
                  {category.postsCount !== 1 ? "s" : ""}
                </Badge>
              </div>
              <span className="text-muted-foreground shrink-0 text-[10px] font-semibold tabular-nums">
                {formatCompact(category.totalViews)} views
              </span>
            </div>

            <span className="bg-muted/50 block h-2 w-full overflow-hidden rounded-full">
              <span
                className="block h-full rounded-full opacity-80 transition-all duration-700"
                style={{
                  width: `${(category.totalViews / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </span>

            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[10px] tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Heart
                  className="size-2.5 text-rose-500 dark:text-rose-400"
                  weight="fill"
                />
                {formatCompact(category.totalLikes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ChatCircleDots
                  className="size-2.5 text-violet-500 dark:text-violet-400"
                  weight="fill"
                />
                {formatCompact(category.totalComments)}
              </span>
              <span className="inline-flex items-center gap-1">
                <ShareNetwork
                  className="text-brand-mint not-dark:text-primary size-2.5"
                  weight="fill"
                />
                {formatCompact(category.totalShares)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DemographicCard({
  title,
  icon,
  items,
  total,
}: {
  title: string
  icon: React.ReactNode
  items: { label: string; count: number; icon?: React.ReactNode }[]
  total: number
}) {
  return (
    <div className="glass-card flex flex-col gap-3.5 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
          {icon}
        </span>
        <span className="truncate text-sm font-bold">{title}</span>
      </div>

      {items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-1.5 py-6 text-center">
          <span className="bg-muted/50 flex size-9 items-center justify-center rounded-xl opacity-70">
            {icon}
          </span>
          <p className="text-[11px] font-medium">Sem dados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item, index) => {
            const percent = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div key={`${item.label}-${index}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {item.icon && (
                      <span className="text-brand-mint not-dark:text-primary shrink-0">
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate text-[11px] font-semibold">
                      {item.label}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[10px] font-semibold tabular-nums">
                    {percent.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                </div>
                <span className="bg-muted/50 block h-1.5 w-full overflow-hidden rounded-full">
                  <span
                    className="bg-gradient-custom block h-full rounded-full transition-all duration-700"
                    style={{ width: `${percent}%` }}
                  />
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AvgCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: "views" | "likes" | "comments" | "time"
}) {
  const toneClass =
    tone === "views"
      ? "text-brand-cyan not-dark:text-primary"
      : tone === "likes"
        ? "text-rose-500 dark:text-rose-400"
        : tone === "comments"
          ? "text-violet-500 dark:text-violet-400"
          : "text-amber-500 dark:text-amber-400"

  return (
    <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-center">
      <span className={cn("bg-muted/50 rounded-lg p-1.5", toneClass)}>
        {icon}
      </span>
      <span className="text-base font-bold tabular-nums sm:text-lg">
        {value}
      </span>
      <span className="text-muted-foreground truncate text-[10px] font-semibold">
        {label}
      </span>
    </div>
  )
}

function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        icon={<Sparkle className="size-6" weight="fill" />}
        title="Nenhuma atividade recente"
        description="Curtidas e comentários dos leitores aparecem aqui."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="border-border/60 bg-muted/20 flex items-center gap-2.5 rounded-2xl border px-3 py-2.5"
        >
          <Avatar className="ring-border/40 size-8 shrink-0 ring-1">
            {item.userImage && (
              <AvatarImage src={item.userImage} alt={item.userName} />
            )}
            <AvatarFallback className="text-[10px] font-bold">
              {initials(item.userName)}
            </AvatarFallback>
          </Avatar>

          <p className="min-w-0 flex-1 truncate text-[11px] sm:text-xs">
            <span className="font-semibold">{item.userName}</span>{" "}
            <span
              className={cn(
                "font-semibold",
                item.type === "like"
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-violet-500 dark:text-violet-400",
              )}
            >
              {item.type === "like" ? "curtiu" : "comentou em"}
            </span>{" "}
            <span className="text-muted-foreground">{item.postTitle}</span>
          </p>

          <span className="flex shrink-0 items-center gap-1.5">
            {item.type === "like" ? (
              <Heart
                className="size-3 text-rose-500 dark:text-rose-400"
                weight="fill"
              />
            ) : (
              <ChatCircleDots
                className="size-3 text-violet-500 dark:text-violet-400"
                weight="fill"
              />
            )}
            <span className="text-muted-foreground/70 hidden text-[9px] font-semibold sm:inline">
              {formatTimeAgo(item.createdAt)}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function EmptyBlock({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="bg-gradient-custom flex size-11 items-center justify-center rounded-2xl text-[#04222A]">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs">
          {description}
        </p>
      </div>
    </div>
  )
}

/* ============================================================
   Skeleton — espelha o layout real
   ============================================================ */

function ReportsSkeleton() {
  return (
    <>
      <StatTilesGridSkeleton count={4} className="grid-cols-1 sm:grid-cols-2" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex items-center gap-3 rounded-2xl p-3.5 sm:p-4"
          >
            <Bone delay={index * 90} className="size-9 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bone delay={index * 90 + 60} className="h-4 w-14" />
              <Bone
                delay={index * 90 + 120}
                className="h-2.5 w-20 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <Bone delay={index * 100} className="size-8 rounded-lg" />
              <Bone delay={index * 100 + 60} className="h-4 w-28" />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 3 }).map((_, cell) => (
                <div
                  key={cell}
                  className="bg-muted/40 flex flex-col items-center gap-1.5 rounded-xl px-1.5 py-2.5"
                >
                  <Bone delay={index * 100 + cell * 60} className="h-5 w-10" />
                  <Bone
                    delay={index * 100 + cell * 60 + 40}
                    className="h-1 w-full rounded-full"
                  />
                  <Bone
                    delay={index * 100 + cell * 60 + 80}
                    className="h-2 w-10 rounded-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ChartSkeleton bars={30} heightClass="h-48 sm:h-56 md:h-64" />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-5">
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Bone className="size-9 rounded-xl" />
              <div className="flex flex-col gap-1.5">
                <Bone delay={60} className="h-4 w-28" />
                <Bone delay={120} className="h-3 w-24 rounded-full" />
              </div>
            </div>
            <Bone delay={180} className="h-10 w-full rounded-full sm:w-64" />
          </div>
          <ListRowsSkeleton rows={7} />
        </div>

        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 xl:col-span-2">
          <div className="flex items-center gap-2.5">
            <Bone className="size-9 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={60} className="h-4 w-40" />
              <Bone delay={120} className="h-3 w-24 rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Bone delay={index * 100} className="h-3 w-32 rounded-full" />
                  <Bone
                    delay={index * 100 + 50}
                    className="h-3 w-16 rounded-full"
                  />
                </div>
                <Bone
                  delay={index * 100 + 100}
                  className="h-2 w-full rounded-full"
                />
                <Bone
                  delay={index * 100 + 150}
                  className="h-2.5 w-40 rounded-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex flex-col gap-3.5 rounded-3xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <Bone delay={index * 80} className="size-8 rounded-lg" />
              <Bone delay={index * 80 + 50} className="h-4 w-28" />
            </div>
            {Array.from({ length: 3 }).map((_, row) => (
              <div key={row} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Bone
                    delay={index * 80 + row * 60}
                    className="h-3 w-20 rounded-full"
                  />
                  <Bone
                    delay={index * 80 + row * 60 + 40}
                    className="h-3 w-8 rounded-full"
                  />
                </div>
                <Bone
                  delay={index * 80 + row * 60 + 80}
                  className="h-1.5 w-full rounded-full"
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Bone className="size-9 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={60} className="h-4 w-36" />
              <Bone delay={120} className="h-3 w-28 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="border-border/60 bg-muted/20 flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5"
              >
                <Bone delay={index * 90} className="size-8 rounded-lg" />
                <Bone delay={index * 90 + 50} className="h-5 w-12" />
                <Bone delay={index * 90 + 100} className="h-2.5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Bone className="size-9 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={60} className="h-4 w-40" />
              <Bone delay={120} className="h-3 w-28 rounded-full" />
            </div>
          </div>
          <ListRowsSkeleton rows={6} />
        </div>
      </div>
    </>
  )
}
