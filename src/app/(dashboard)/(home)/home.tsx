"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  ChartDonut,
  ChartLineUp,
  Crown,
  Eye,
  Fire,
  Heart,
  Play,
  TrendUp,
  Trophy,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react"

import { AcquisitionChart } from "@/components/home/acquisition-chart"
import { BarList, type BarListItem } from "@/components/home/bar-list"
import {
  ClipsHeroViz,
  ClipsHeroVizSkeleton,
} from "@/components/home/clips-hero-viz"
import {
  HeroClipsTicker,
  type TickerClip,
} from "@/components/home/hero-clips-ticker"
import { HomeHero } from "@/components/home/home-hero"
import { PlatformDonut } from "@/components/home/platform-donut"
import { SectionHeading } from "@/components/home/section-heading"
import { StatTile } from "@/components/home/stat-tile"
import { ViewsGrowthChart } from "@/components/home/views-growth-chart"
import { platformMeta } from "@/components/home/platform-chart-meta"
import { CountUp, formatCompact } from "@/components/shared/count-up"
import { DarkScope } from "@/components/shared/dark-scope"
import { Reveal } from "@/components/shared/reveal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

export default function Home() {
  const { data: dashboard, isLoading: loadingDashboard } =
    api.admin.dashboard.useQuery()
  const { data: viewsGrowth, isLoading: loadingGrowth } =
    api.admin.getViewsByPlatformGrowth.useQuery()
  const { data: topClippers, isLoading: loadingTopClippers } =
    api.admin.getTopClippers.useQuery()
  const { data: platformData, isLoading: loadingPlatforms } =
    api.admin.getPlatformData.useQuery()
  const { data: acquisition, isLoading: loadingAcquisition } =
    api.admin.acquisition.getDashboard.useQuery()
  const { data: topCampaigns, isLoading: loadingTopCampaigns } =
    api.admin.getTopCampaigns.useQuery()

  // Ticker do hero: 20 vídeos mais vistos das competições ATIVAS.
  // Busca o top de CADA competição ativa e intercala (round-robin) para
  // garantir vídeos diferentes de competições diferentes.
  const { data: activeCampaigns } = api.campaign.getActive.useQuery()
  const topPostsPerCampaign = api.useQueries((t) =>
    (activeCampaigns ?? []).map((campaign) =>
      t.admin.getAllPosts({
        page: 1,
        limit: 10,
        status: "ELIGIBLE",
        orderBy: "views",
        orderDirection: "desc",
        campaignId: campaign.id,
      }),
    ),
  )

  const tickerClips: TickerClip[] = React.useMemo(() => {
    const perCampaign = topPostsPerCampaign.map((query) =>
      (query.data?.posts ?? []).filter(
        (post) => post.thumbnail && post.thumbnail.trim() !== "",
      ),
    )

    const seenThumbnails = new Set<string>()
    const clips: TickerClip[] = []

    // Round-robin: 1º mais visto de cada competição, depois o 2º de cada, etc.
    for (let round = 0; round < 10 && clips.length < 20; round++) {
      for (const posts of perCampaign) {
        if (clips.length >= 20) break
        const post = posts[round]
        if (!post?.thumbnail) continue
        if (seenThumbnails.has(post.thumbnail)) continue
        seenThumbnails.add(post.thumbnail)
        clips.push({
          id: post.id,
          thumbnail: post.thumbnail,
          views: post.views,
          engagementRate:
            post.views > 0
              ? ((post.likes + post.comments + post.shares) / post.views) * 100
              : 0,
          username: post.username,
          platform: post.platform,
        })
      }
    }
    return clips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topPostsPerCampaign.map((query) => query.dataUpdatedAt).join(",")])

  const kpis = dashboard?.overview

  // Resumo do período do gráfico de crescimento
  const growthPoints = (viewsGrowth?.data ?? []) as Array<{
    date: string
    total: number
  }>
  const firstPoint = growthPoints[0]
  const lastPoint = growthPoints[growthPoints.length - 1]
  const periodGain =
    lastPoint && firstPoint ? lastPoint.total - firstPoint.total : 0

  const engagementItems: BarListItem[] =
    platformData
      ?.slice()
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .map((entry) => {
        const { label, Icon } = platformMeta(entry.platform)
        return {
          key: entry.platform,
          icon: Icon ? <Icon className="size-3.5" /> : undefined,
          label,
          value: entry.engagementRate,
          tooltip: `${label}: ${entry.engagementRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de engajamento · ${entry.posts.toLocaleString("pt-BR")} vídeos · ${entry.clippers.toLocaleString("pt-BR")} clipadores`,
        }
      }) ?? []

  const clippers =
    topClippers?.filter(
      (entry): entry is NonNullable<typeof entry> => entry != null,
    ) ?? []
  const maxClipperViews = Math.max(...clippers.map((c) => c.views), 1)

  const organicCount = acquisition?.stats.organicClippers ?? 0
  const referredCount = acquisition?.stats.clippersWithReferral ?? 0
  const organicPct =
    organicCount + referredCount > 0
      ? (organicCount / (organicCount + referredCount)) * 100
      : 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero: resumo da plataforma (animação do mercado de cortes) ===== */}
      <HomeHero
        eyebrow="Clipfy League · Painel Administrativo"
        title={
          <>
            A arena que transforma cortes em{" "}
            <span className="text-gradient">views que pagam</span>
          </>
        }
        subtitle="Competições de cortes multi-plataforma com ranking diário, premiação automática e uma comunidade de clipadores crescendo todos os dias."
        isLoading={loadingDashboard}
        viz={<ClipsHeroViz ticker={<HeroClipsTicker clips={tickerClips} />} />}
        vizSkeleton={<ClipsHeroVizSkeleton />}
        stats={[
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: kpis?.totalViews ?? 0,
            kind: "compact",
          },
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clipadores",
            value: kpis?.totalClippers ?? 0,
            kind: "int",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições ativas",
            value: kpis?.activeCampaigns ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Total de Views"
            value={kpis?.totalViews ?? 0}
            kind="compact"
            delta={kpis?.viewsGrowth}
            hint="vs. mês anterior"
            accent="cyan"
            isLoading={loadingDashboard}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Clipadores Ativos"
            value={kpis?.activeClippers ?? 0}
            kind="int"
            hint="clipadores na plataforma"
            accent="green"
            isLoading={loadingDashboard}
          />
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Competições Ativas"
            value={kpis?.activeCampaigns ?? 0}
            kind="int"
            hint="competições em andamento"
            accent="cyan"
            isLoading={loadingDashboard}
          />
          <StatTile
            icon={<Heart className="size-4" weight="fill" />}
            label="Engagement Rate"
            value={kpis?.engagementRate ?? 0}
            kind="percent"
            delta={kpis?.engagementGrowth}
            hint="likes / views"
            accent="green"
            isLoading={loadingDashboard}
          />
        </div>
      </Reveal>

      {/* ===== Crescimento de Views ===== */}
      <Reveal delayMs={80}>
        <div className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-7">
          {/* Toques da identidade: grid sutil + glow de canto */}
          <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_80%_0%,black,transparent_70%)]" />
          <span
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
          />

          <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <SectionHeading
              icon={<ChartLineUp className="size-4" weight="bold" />}
              title="Crescimento de Views"
              description="Crescimento acumulado por rede social nos últimos 90 dias"
            />
            <div className="flex items-center gap-3">
              {loadingGrowth ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <>
                  <div className="text-right leading-tight">
                    <p className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] text-xl font-bold tabular-nums sm:text-2xl">
                      {formatCompact(lastPoint?.total ?? 0)}
                    </p>
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                      views acumuladas
                    </p>
                  </div>
                  {periodGain > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <TrendUp className="size-3" weight="bold" />+
                      {formatCompact(periodGain)} · 90d
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="relative mt-5">
            <ViewsGrowthChart
              data={(viewsGrowth?.data ?? []) as never}
              platforms={viewsGrowth?.platforms ?? []}
              isLoading={loadingGrowth}
            />
          </div>
        </div>
      </Reveal>

      {/* ===== Top Clipadores + Distribuição de Views ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-5">
        <Reveal className="xl:col-span-2">
          <div className="glass-card relative h-full overflow-hidden rounded-3xl p-5 sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 -left-12 size-44 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_9%,transparent)] blur-3xl"
            />
            <div className="relative">
              <SectionHeading
                icon={<Crown className="size-4" weight="fill" />}
                title="Top Clipadores"
                description="Ranking do mês por views"
                href="/clippers/ranking"
              />
              <div className="mt-5 flex flex-col gap-2">
                {loadingTopClippers
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                    ))
                  : clippers.map((clipper, index) => (
                      <div
                        key={`${clipper.username}-${index}`}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border p-3 transition-colors",
                          index === 0
                            ? "border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_6%,transparent)]"
                            : "border-border/60 hover:border-brand-cyan/30 not-dark:hover:border-primary/40",
                        )}
                      >
                        {/* hairline de glow no topo do 1º lugar */}
                        {index === 0 && (
                          <span className="bg-gradient-custom absolute inset-x-[16%] top-0 h-px" />
                        )}
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums",
                              index === 0 &&
                                "bg-gradient-custom text-[#04222A]",
                              index === 1 &&
                                "bg-zinc-400/20 text-zinc-500 dark:text-zinc-300",
                              index === 2 &&
                                "bg-amber-700/20 text-amber-700 dark:text-amber-500",
                              index > 2 && "bg-muted text-muted-foreground",
                            )}
                          >
                            {index === 0 ? (
                              <Crown className="size-3.5" weight="fill" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <Avatar
                            className={cn(
                              "size-9 rounded-xl ring-1",
                              index === 0
                                ? "ring-[color-mix(in_oklab,var(--brand-cyan)_50%,transparent)]"
                                : "ring-border",
                            )}
                          >
                            <AvatarImage
                              src={clipper.imageUrl ?? undefined}
                              alt={clipper.name}
                            />
                            <AvatarFallback className="rounded-xl text-[10px]">
                              {(clipper.artisticName || clipper.name)
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1 leading-tight">
                            <p className="truncate text-[13px] font-semibold">
                              {clipper.artisticName || clipper.name}
                              {clipper.clanTag && (
                                <span
                                  className="ml-1.5 text-[10px] font-bold"
                                  style={{
                                    color: clipper.clanEmojiColor ?? undefined,
                                  }}
                                >
                                  {clipper.clanEmoji} {clipper.clanTag}
                                </span>
                              )}
                            </p>
                            <p className="text-muted-foreground truncate text-[11px]">
                              {clipper.posts} vídeos · {clipper.engagementRate}{" "}
                              eng.
                            </p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 text-sm font-bold tabular-nums",
                              index === 0
                                ? "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]"
                                : "text-foreground",
                            )}
                          >
                            {clipper.viewsFormatted}
                          </span>
                        </div>
                        {/* trilha proporcional ao líder */}
                        <div className="bg-muted/50 mt-2.5 h-1 w-full overflow-hidden rounded-full">
                          <div
                            className="bg-gradient-custom h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{
                              width: `${Math.max((clipper.views / maxClipperViews) * 100, 3)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                {!loadingTopClippers && clippers.length === 0 && (
                  <p className="text-muted-foreground py-8 text-center text-sm">
                    Sem dados de ranking neste mês
                  </p>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delayMs={80} className="xl:col-span-3">
          <div className="glass-card relative h-full overflow-hidden rounded-3xl p-5 sm:p-6">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-14 -bottom-16 size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-3xl"
            />
            <div className="relative">
              <SectionHeading
                icon={<ChartDonut className="size-4" weight="fill" />}
                title="Distribuição de Views"
                description="Views por rede social — todas as competições"
              />
              <div className="mt-6">
                <PlatformDonut
                  data={platformData ?? []}
                  isLoading={loadingPlatforms}
                />
              </div>

              {/* Engagement por Plataforma */}
              <div className="border-border/60 bg-muted/20 mt-6 rounded-2xl border p-4 sm:p-5">
                <p className="text-muted-foreground mb-4 text-[11px] font-semibold tracking-[0.14em] uppercase">
                  Engagement por plataforma
                </p>
                <BarList
                  items={engagementItems}
                  isLoading={loadingPlatforms}
                  formatValue={(value) =>
                    `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                  }
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ===== Captação de Clipadores ===== */}
      <Reveal>
        <div className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-7">
          <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_15%_100%,black,transparent_70%)]" />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-14 size-56 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_10%,transparent)] blur-3xl"
          />

          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0">
              <SectionHeading
                icon={<UserPlus className="size-4" weight="fill" />}
                title="Captação de Clipadores"
                description="Crescimento acumulado nos últimos 90 dias"
                href="/clippers/acquisition"
              />
              <div className="mt-5">
                <AcquisitionChart
                  data={acquisition?.growthData ?? []}
                  isLoading={loadingAcquisition}
                />
              </div>
            </div>

            {/* Painel lateral: janelas + origem */}
            <div className="flex flex-col gap-3 lg:border-l lg:border-border/60 lg:pl-6">
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                <AcquisitionWindow
                  label="Hoje"
                  value={acquisition?.stats.todayCount ?? 0}
                  isLoading={loadingAcquisition}
                />
                <AcquisitionWindow
                  label="Últimos 7 dias"
                  value={acquisition?.stats.last7daysCount ?? 0}
                  isLoading={loadingAcquisition}
                />
                <AcquisitionWindow
                  label="Últimos 30 dias"
                  value={acquisition?.stats.last30daysCount ?? 0}
                  isLoading={loadingAcquisition}
                />
              </div>

              {/* Origem: orgânico vs indicado */}
              <div className="border-border/60 bg-muted/20 mt-auto rounded-2xl border p-4">
                <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
                  Origem da base
                </p>
                {loadingAcquisition ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <>
                    <div className="bg-muted/60 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-gradient-custom h-full rounded-full"
                        style={{ width: `${Math.max(organicPct, 2)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-col gap-1.5 text-xs">
                      <span className="flex items-center justify-between">
                        <span className="text-muted-foreground inline-flex items-center gap-1.5">
                          <span className="bg-gradient-custom size-2 rounded-full" />
                          Orgânicos
                        </span>
                        <span className="font-bold tabular-nums">
                          {organicCount.toLocaleString("pt-BR")}
                        </span>
                      </span>
                      <span className="flex items-center justify-between">
                        <span className="text-muted-foreground inline-flex items-center gap-1.5">
                          <span className="bg-muted-foreground/40 size-2 rounded-full" />
                          Indicados
                        </span>
                        <span className="font-bold tabular-nums">
                          {referredCount.toLocaleString("pt-BR")}
                        </span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Top Competições ===== */}
      <Reveal delayMs={80}>
        <div className="flex flex-col gap-4">
          <SectionHeading
            icon={<Fire className="size-4" weight="fill" />}
            title="Top Competições"
            description="Melhores performances ativas"
            href="/competitions"
          />
          {loadingTopCampaigns ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-44 rounded-3xl" />
              ))}
            </div>
          ) : (
            <DarkScope className="contents">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {topCampaigns?.map((campaign, index) => (
                  <Link
                    key={campaign.id}
                    href={`/competitions/${campaign.slug}`}
                    className="glass-card glass-card-hover text-foreground group relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-[#0a1c2b]! p-5 sm:p-6"
                  >
                    {/* marca d'água do rank */}
                    <span className="text-foreground/[0.05] pointer-events-none absolute -right-2 -bottom-6 text-[110px] leading-none font-black select-none">
                      0{index + 1}
                    </span>
                    {/* hairline superior alternando as cores da marca */}
                    <span
                      className={cn(
                        "absolute inset-x-[12%] top-0 h-px",
                        index === 0 && "bg-gradient-custom",
                        index === 1 && "bg-[var(--brand-cyan)]",
                        index === 2 && "bg-[var(--brand-green)]",
                      )}
                    />

                    <div className="relative flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase",
                          index === 0
                            ? "bg-gradient-custom text-[#04222A]"
                            : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        <Trophy className="size-3" weight="fill" />
                        {index === 0 ? "Líder" : `Top ${index + 1}`}
                      </span>
                      <ArrowUpRight className="text-muted-foreground group-hover:text-brand-cyan size-4 transition-colors" />
                    </div>

                    <h3 className="relative line-clamp-2 text-base font-bold tracking-tight sm:text-[17px]">
                      {campaign.name}
                    </h3>

                    <div className="relative mt-auto flex items-end justify-between gap-2">
                      <div className="leading-tight">
                        <p className="text-gradient text-2xl font-bold tabular-nums sm:text-[1.7rem]">
                          {campaign.viewsFormatted}
                        </p>
                        <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                          views
                        </p>
                      </div>
                      <span className="border-border/60 bg-muted/30 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
                        <Play className="size-3" weight="fill" />
                        {formatCompact(campaign.posts)} vídeos
                      </span>
                    </div>
                  </Link>
                ))}
                {topCampaigns?.length === 0 && (
                  <p className="text-muted-foreground col-span-full py-8 text-center text-sm">
                    Nenhuma competição ativa no momento
                  </p>
                )}
              </div>
            </DarkScope>
          )}
        </div>
      </Reveal>

      {/* ===== Totais da plataforma ===== */}
      <Reveal>
        <div className="glass-card relative overflow-hidden rounded-3xl px-5 py-5 sm:px-8">
          <span
            aria-hidden
            className="bg-gradient-custom pointer-events-none absolute inset-x-[20%] top-0 h-px"
          />
          <div className="divide-border/60 grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x">
            <FooterTotal
              icon={<Play className="size-3.5" weight="fill" />}
              label="Total de Vídeos"
              value={kpis?.totalClipPosts ?? 0}
              accent="cyan"
              isLoading={loadingDashboard}
            />
            <FooterTotal
              icon={<Heart className="size-3.5" weight="fill" />}
              label="Total de Likes"
              value={kpis?.totalLikes ?? 0}
              accent="green"
              isLoading={loadingDashboard}
            />
            <FooterTotal
              icon={<Trophy className="size-3.5" weight="fill" />}
              label="Competições Totais"
              value={kpis?.totalCampaigns ?? 0}
              accent="cyan"
              isLoading={loadingDashboard}
            />
            <FooterTotal
              icon={<UsersThree className="size-3.5" weight="fill" />}
              label="Total Clipadores"
              value={kpis?.totalClippers ?? 0}
              accent="green"
              isLoading={loadingDashboard}
            />
          </div>
        </div>
      </Reveal>
    </div>
  )
}

function AcquisitionWindow({
  label,
  value,
  isLoading,
}: {
  label: string
  value: number
  isLoading: boolean
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-0.5 rounded-2xl border p-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
      {isLoading ? (
        <Skeleton className="h-6 w-12" />
      ) : (
        <CountUp
          value={value}
          kind="int"
          className="text-brand-mint not-dark:text-primary order-1 text-lg font-bold tabular-nums lg:order-2"
        />
      )}
      <span className="text-muted-foreground order-2 text-[10px] leading-tight font-semibold tracking-[0.1em] uppercase lg:order-1">
        {label}
      </span>
    </div>
  )
}

function FooterTotal({
  icon,
  label,
  value,
  accent,
  isLoading,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent: "cyan" | "green"
  isLoading: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-2.5 sm:justify-start sm:pl-6 sm:first:pl-0">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]",
          accent === "cyan"
            ? "bg-[var(--brand-cyan)] not-dark:bg-[#089eb8] not-dark:text-white"
            : "bg-[var(--brand-green)] not-dark:bg-[#0eb981] not-dark:text-white",
        )}
      >
        {icon}
      </span>
      <div className="flex flex-col leading-tight">
        {isLoading ? (
          <Skeleton className="h-4 w-14" />
        ) : (
          <CountUp
            value={value}
            kind="compact"
            className="text-base font-bold tabular-nums"
          />
        )}
        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}
