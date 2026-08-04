"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Clock,
  Crown,
  CurrencyDollar,
  Eye,
  Fire,
  Medal,
  Pause,
  Ranking,
  Trophy,
  UsersThree,
  VideoCamera,
} from "@phosphor-icons/react"

import { RankingHallHeroViz, RankingHallHeroVizSkeleton } from "@/components/clippers/ranking-hall-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { SectionHeading } from "@/components/home/section-heading"
import { StatTile } from "@/components/home/stat-tile"
import { formatCompact } from "@/components/shared/count-up"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { Reveal } from "@/components/shared/reveal"
import { Bone, ListRowsSkeleton } from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

const RANK_BADGES = [
  "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  "bg-slate-400/25 text-slate-600 dark:text-slate-300",
  "bg-orange-500/20 text-orange-600 dark:text-orange-400",
] as const

const COMPETITION_STATUS: Record<
  string,
  { label: string; icon: React.ElementType; badge: string }
> = {
  ACTIVE: {
    label: "Ativa",
    icon: Fire,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
  },
  COMPLETED: {
    label: "Finalizada",
    icon: Trophy,
    badge:
      "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  PAUSED: {
    label: "Pausada",
    icon: Pause,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  SCHEDULED: {
    label: "Agendada",
    icon: Clock,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
}

const displayNameOf = (clipper: {
  fullName: string
  artisticName: string | null
}) => clipper.artisticName ?? clipper.fullName

const initialsOf = (name: string) => name.slice(0, 2).toUpperCase()

export default function RankingClippers() {
  const { maskBRL } = useMaskedCurrency()
  const { data, isLoading } = api.clipper.getRankingData.useQuery()

  const top3 = data?.topClippersByViews.slice(0, 3) ?? []

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Ranking"
        title={
          <>
            O hall da <span className="text-gradient">fama</span>
          </>
        }
        subtitle="Os clipadores que mais geraram resultados na Clipfy League — views, títulos e ganhos de todas as competições em um só ranking."
        viz={<RankingHallHeroViz />}
        vizSkeleton={<RankingHallHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clipadores",
            value: data?.stats.totalClippers ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: data?.stats.totalViewsAllTime ?? 0,
            kind: "compact",
          },
          {
            icon: <CurrencyDollar className="size-3.5" weight="fill" />,
            label: "Ganhos totais",
            value: data?.stats.totalEarningsAllTime ?? 0,
            kind: "compactBRL",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Views totais"
            value={data?.stats.totalViewsAllTime ?? 0}
            kind="compact"
            hint="todas as competições"
            accent="cyan"
            gradientValue
            isLoading={isLoading}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Clipadores"
            value={data?.stats.totalClippers ?? 0}
            kind="int"
            hint="com posts aprovados"
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Posts"
            value={data?.stats.totalPostsAllTime ?? 0}
            kind="compact"
            hint="enviados na plataforma"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<CurrencyDollar className="size-4" weight="fill" />}
            label="Ganhos"
            value={data?.stats.totalEarningsAllTime ?? 0}
            kind="compactBRL"
            hint="distribuídos aos clipadores"
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Fire className="size-4" weight="fill" />}
            label="Competições ativas"
            value={data?.stats.activeCompetitionsCount ?? 0}
            kind="int"
            hint={
              data
                ? `de ${data.stats.totalCompetitionsCount} no total`
                : "acontecendo agora"
            }
            accent="cyan"
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Conteúdo ===== */}
      {isLoading ? (
        <RankingSkeleton />
      ) : !data ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <Trophy className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Nenhum dado encontrado</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Ainda não há dados de ranking disponíveis.
              </p>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal immediate delayMs={80}>
          <Tabs defaultValue="geral" className="gap-6">
            <TabsList className="bg-muted/40 ring-border/60 flex h-auto w-full snap-x flex-nowrap justify-start gap-1 overflow-x-auto rounded-full p-1.5 ring-1 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { value: "geral", label: "Geral", icon: Ranking },
                  { value: "campeoes", label: "Campeões", icon: Crown },
                  {
                    value: "plataformas",
                    label: "Plataformas",
                    icon: VideoCamera,
                  },
                  { value: "competicoes", label: "Competições", icon: Fire },
                  { value: "ganhos", label: "Ganhos", icon: CurrencyDollar },
                ] as const
              ).map((tab) => {
                const TabIcon = tab.icon
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="h-10 flex-none cursor-pointer snap-start gap-1.5 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap transition-all after:hidden sm:flex-1 [&[data-state=active]_svg]:text-primary"
                  >
                    <TabIcon className="size-4 shrink-0" weight="fill" />
                    {tab.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {/* ===== Aba: Geral ===== */}
            <TabsContent value="geral" className="flex flex-col gap-6">
              {top3.length > 0 && (
                <div className="mx-auto grid w-full max-w-4xl grid-cols-1 items-end gap-4 sm:grid-cols-3">
                  {top3[1] && <PodiumCard clipper={top3[1]} position={2} />}
                  {top3[0] && <PodiumCard clipper={top3[0]} position={1} />}
                  {top3[2] && <PodiumCard clipper={top3[2]} position={3} />}
                </div>
              )}

              <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<Ranking className="size-4" weight="fill" />}
                  title="Ranking Completo por Views"
                  description="Todos os clipadores ordenados por total de visualizações"
                />
                {data.topClippersByViews.length === 0 ? (
                  <EmptyState
                    icon={<UsersThree className="size-6" weight="fill" />}
                    title="Nenhum participante ainda"
                    description="Assim que os primeiros posts forem aprovados, o ranking aparece aqui."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topClippersByViews.map((clipper) => (
                      <RankingRow
                        key={clipper.clipperProfileId}
                        rank={clipper.rank}
                        name={displayNameOf(clipper)}
                        imageUrl={clipper.imageUrl}
                        subtitle={`${formatCompact(clipper.totalPosts)} posts`}
                        value={formatCompact(clipper.totalViews)}
                        valueLabel="views"
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ===== Aba: Campeões ===== */}
            <TabsContent value="campeoes" className="flex flex-col gap-6">
              <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<Crown className="size-4" weight="fill" />}
                  title="Hall dos Campeões"
                  description="Clipadores com mais títulos na Clipfy League"
                />
                {data.topChampions.length === 0 ? (
                  <EmptyState
                    icon={<Crown className="size-6" weight="fill" />}
                    title="Nenhum campeão ainda"
                    description="Os vencedores das competições finalizadas aparecem aqui."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topChampions.slice(0, 10).map((champion, index) => {
                      const name = displayNameOf(champion)
                      return (
                        <div
                          key={champion.clipperProfileId}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                            index === 0
                              ? "border border-amber-500/25 bg-amber-500/10"
                              : "bg-muted/30",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                              index < 3
                                ? RANK_BADGES[index]
                                : "bg-muted/60 text-muted-foreground",
                            )}
                          >
                            {index === 0 ? (
                              <Crown className="size-4" weight="fill" />
                            ) : (
                              `${index + 1}º`
                            )}
                          </span>
                          <Avatar className="border-border/60 size-9 shrink-0 border">
                            <AvatarImage
                              src={champion.imageUrl ?? undefined}
                              alt={name}
                            />
                            <AvatarFallback className="bg-brand-cyan/15 text-[10px] font-semibold">
                              {initialsOf(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {champion.competitions
                                .map((competition) => competition.name)
                                .slice(0, 2)
                                .join(" · ")}
                              {champion.competitions.length > 2 &&
                                ` +${champion.competitions.length - 2}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={cn(
                                "inline-flex items-center gap-1 text-base font-bold tabular-nums",
                                index === 0
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-foreground",
                              )}
                            >
                              <Trophy className="size-4" weight="fill" />
                              {champion.titlesCount}
                            </p>
                            <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                              {champion.titlesCount === 1
                                ? "título"
                                : "títulos"}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<Trophy className="size-4" weight="fill" />}
                  title="Histórico de Campeões"
                  description="Vencedores de todas as competições finalizadas"
                />
                {data.champions.length === 0 ? (
                  <EmptyState
                    icon={<Trophy className="size-6" weight="fill" />}
                    title="Nenhuma competição finalizada ainda"
                    description="Quando uma competição terminar, o campeão entra para o histórico."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.champions.map((champion) => {
                      const name = displayNameOf(champion)
                      return (
                        <Link
                          key={`${champion.clipperProfileId}-${champion.competitionSlug}`}
                          href={`/competitions/${champion.competitionSlug}`}
                          className="group flex items-center gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 transition-colors hover:border-amber-500/35 hover:bg-amber-500/10"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Crown className="size-4.5" weight="fill" />
                          </span>
                          <Avatar className="size-9 shrink-0 border border-amber-500/30">
                            <AvatarImage
                              src={champion.imageUrl ?? undefined}
                              alt={name}
                            />
                            <AvatarFallback className="bg-amber-500/15 text-[10px] font-semibold">
                              {initialsOf(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {champion.competitionName} ·{" "}
                              {formatCompact(champion.totalViews)} views
                            </p>
                          </div>
                          {champion.titlesCount > 1 && (
                            <Badge
                              variant="outline"
                              className="hidden gap-1 rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 sm:inline-flex dark:text-amber-400"
                            >
                              <Trophy className="size-2.5" weight="fill" />
                              {champion.titlesCount}x campeão
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary hidden shrink-0 gap-1 rounded-full text-[10px] sm:inline-flex"
                          >
                            <Trophy className="size-2.5" weight="fill" />
                            Ver competição
                          </Badge>
                          <CaretRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" />
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ===== Aba: Plataformas ===== */}
            <TabsContent value="plataformas">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(data.platformRankings).map(
                  ([platform, ranking], index) => {
                    const config = platformConfig[platform as PlatformKey]
                    if (!config) return null
                    const PlatformIcon = config.icon
                    const distribution = data.platformDistribution.find(
                      (entry) => entry.platform === platform,
                    )
                    return (
                      <Reveal
                        immediate
                        key={platform}
                        delayMs={(index % 3) * 80}
                      >
                        <div className="glass-card glass-card-hover flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-5">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl border",
                                config.bgColor,
                                config.borderColor,
                              )}
                            >
                              <PlatformIcon
                                className={cn("size-5", config.color)}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold tracking-tight">
                                {config.label}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {distribution?.clippersCount ?? 0} clipadores
                              </p>
                            </div>
                            {distribution &&
                              distribution.engagementRate > 0 && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "shrink-0 rounded-full text-[10px]",
                                    config.borderColor,
                                    config.color,
                                  )}
                                >
                                  {distribution.engagementRate.toLocaleString(
                                    "pt-BR",
                                    { maximumFractionDigits: 1 },
                                  )}
                                  % ER
                                </Badge>
                              )}
                          </div>

                          {distribution && (
                            <div className="grid grid-cols-3 gap-2">
                              <MiniStat
                                value={formatCompact(distribution.totalViews)}
                                label="views"
                                highlight
                              />
                              <MiniStat
                                value={formatCompact(distribution.totalPosts)}
                                label="posts"
                              />
                              <MiniStat
                                value={formatCompact(
                                  Math.round(distribution.avgViewsPerPost),
                                )}
                                label="média/post"
                              />
                            </div>
                          )}

                          <div className="flex flex-1 flex-col gap-1.5">
                            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                              Top clipadores
                            </p>
                            {ranking.length === 0 ? (
                              <p className="text-muted-foreground py-6 text-center text-sm">
                                Nenhum clipador ainda
                              </p>
                            ) : (
                              ranking.slice(0, 5).map((clipper) => {
                                const name = displayNameOf(clipper)
                                return (
                                  <div
                                    key={clipper.clipperProfileId}
                                    className="bg-muted/30 flex items-center gap-2.5 rounded-xl px-2.5 py-2"
                                  >
                                    <span
                                      className={cn(
                                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                                        clipper.rank <= 3
                                          ? RANK_BADGES[clipper.rank - 1]
                                          : "bg-muted/60 text-muted-foreground",
                                      )}
                                    >
                                      {clipper.rank}
                                    </span>
                                    <Avatar className="size-7 shrink-0">
                                      <AvatarImage
                                        src={clipper.imageUrl ?? undefined}
                                        alt={name}
                                      />
                                      <AvatarFallback className="bg-brand-cyan/15 text-[9px] font-semibold">
                                        {initialsOf(name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold">
                                        {name}
                                      </p>
                                      <p className="text-muted-foreground text-[10px]">
                                        {formatCompact(clipper.posts)} posts
                                      </p>
                                    </div>
                                    <span
                                      className={cn(
                                        "shrink-0 text-xs font-bold tabular-nums",
                                        config.color,
                                      )}
                                    >
                                      {formatCompact(clipper.views)}
                                    </span>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </Reveal>
                    )
                  },
                )}
              </div>
            </TabsContent>

            {/* ===== Aba: Competições ===== */}
            <TabsContent value="competicoes" className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionHeading
                  icon={<Fire className="size-4" weight="fill" />}
                  title="Ranking por Competição"
                  description="Top 3 de cada competição da liga"
                />
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  >
                    <Fire className="size-3" weight="fill" />
                    {data.stats.activeCompetitionsCount} Ativas
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400"
                  >
                    <Trophy className="size-3" weight="fill" />
                    {data.stats.completedCompetitionsCount} Finalizadas
                  </Badge>
                </div>
              </div>

              {data.competitionRankings.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="size-6" weight="fill" />}
                  title="Nenhuma competição encontrada"
                  description="Não há competições cadastradas ainda."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {data.competitionRankings.map((competition, index) => {
                    const status =
                      COMPETITION_STATUS[competition.campaign.status] ??
                      COMPETITION_STATUS.ACTIVE!
                    const StatusIcon = status.icon
                    return (
                      <Reveal
                        immediate
                        key={competition.campaign.id}
                        delayMs={(index % 3) * 80}
                      >
                        <Link
                          href={`/competitions/${competition.campaign.slug}`}
                          className="glass-card glass-card-hover flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-5"
                        >
                          <div className="flex items-center gap-3">
                            {competition.campaign.coverImageUrl ? (
                              <span className="relative size-11 shrink-0 overflow-hidden rounded-xl">
                                <Image
                                  src={competition.campaign.coverImageUrl}
                                  alt={competition.campaign.name}
                                  fill
                                  sizes="44px"
                                  className="object-cover"
                                />
                              </span>
                            ) : (
                              <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                                <Trophy className="size-5" weight="fill" />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold tracking-tight">
                                {competition.campaign.name}
                              </p>
                              <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-xs">
                                <CalendarBlank className="size-3" />
                                {new Intl.DateTimeFormat("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                }).format(
                                  new Date(competition.campaign.endDate),
                                )}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 gap-1 rounded-full text-[10px]",
                                status.badge,
                              )}
                            >
                              <StatusIcon className="size-2.5" weight="fill" />
                              {status.label}
                            </Badge>
                          </div>

                          <div className="flex flex-1 flex-col gap-1.5">
                            {competition.ranking.length === 0 ? (
                              <p className="text-muted-foreground py-6 text-center text-sm">
                                Nenhum participante ainda
                              </p>
                            ) : (
                              competition.ranking
                                .slice(0, 3)
                                .map((clipper) => {
                                  const name = displayNameOf(clipper)
                                  return (
                                    <div
                                      key={clipper.clipperProfileId}
                                      className="bg-muted/30 flex items-center gap-2.5 rounded-xl px-2.5 py-2"
                                    >
                                      <span
                                        className={cn(
                                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                                          RANK_BADGES[clipper.rank - 1] ??
                                            "bg-muted/60 text-muted-foreground",
                                        )}
                                      >
                                        {clipper.rank === 1 ? (
                                          <Crown
                                            className="size-3"
                                            weight="fill"
                                          />
                                        ) : (
                                          clipper.rank
                                        )}
                                      </span>
                                      <Avatar className="size-7 shrink-0">
                                        <AvatarImage
                                          src={clipper.imageUrl ?? undefined}
                                          alt={name}
                                        />
                                        <AvatarFallback className="bg-brand-cyan/15 text-[9px] font-semibold">
                                          {initialsOf(name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold">
                                          {name}
                                        </p>
                                        <p className="text-muted-foreground text-[10px]">
                                          {formatCompact(clipper.postsCount)}{" "}
                                          posts
                                        </p>
                                      </div>
                                      <span className="text-brand-mint not-dark:text-primary shrink-0 text-xs font-bold tabular-nums">
                                        {formatCompact(clipper.totalViews)}
                                      </span>
                                    </div>
                                  )
                                })
                            )}
                          </div>

                          <span className="text-brand-cyan not-dark:text-primary mt-auto inline-flex items-center gap-0.5 text-xs font-semibold">
                            Ver ranking completo
                            <CaretRight className="size-3.5" weight="bold" />
                          </span>
                        </Link>
                      </Reveal>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ===== Aba: Ganhos ===== */}
            <TabsContent value="ganhos">
              <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<CurrencyDollar className="size-4" weight="fill" />}
                  title="Top Clipadores por Ganhos"
                  description="Quem mais recebeu prêmios na Clipfy League"
                />
                {data.topClippersByEarnings.length === 0 ? (
                  <EmptyState
                    icon={<CurrencyDollar className="size-6" weight="fill" />}
                    title="Nenhum prêmio distribuído ainda"
                    description="Os ganhos dos clipadores aparecem aqui após os primeiros pagamentos."
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.topClippersByEarnings.map((clipper) => (
                      <RankingRow
                        key={clipper.clipperProfileId}
                        rank={clipper.rank}
                        name={displayNameOf(clipper)}
                        imageUrl={clipper.imageUrl}
                        subtitle={`${formatCompact(clipper.totalPosts)} posts · ${formatCompact(clipper.totalViews)} views`}
                        value={maskBRL(clipper.totalEarned)}
                        valueLabel="ganhos"
                        valueClassName="text-emerald-600 dark:text-emerald-400"
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Reveal>
      )}
    </div>
  )
}

/* ===== Pódio (top 3) ===== */
function PodiumCard({
  clipper,
  position,
}: {
  clipper: {
    fullName: string
    artisticName: string | null
    imageUrl: string | null
    totalViews: number
    totalPosts: number
    totalEarned: number
  }
  position: 1 | 2 | 3
}) {
  const { maskBRL } = useMaskedCurrency()
  const name = displayNameOf(clipper)
  const isFirst = position === 1
  return (
    <div
      className={cn(
        "glass-card relative flex flex-col items-center gap-3 rounded-3xl p-5 text-center",
        isFirst
          ? "order-first py-7 ring-1 ring-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] sm:order-none"
          : "sm:mb-0",
        position === 2 && "sm:order-none",
        position === 3 && "order-last",
      )}
    >
      <span
        className={cn(
          "absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
          RANK_BADGES[position - 1],
        )}
      >
        {position}º
      </span>
      {isFirst && (
        <span className="bg-gradient-custom flex size-8 items-center justify-center rounded-full text-[#04222A]">
          <Crown className="size-4" weight="fill" />
        </span>
      )}
      {!isFirst && (
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            RANK_BADGES[position - 1],
          )}
        >
          <Medal className="size-4" weight="fill" />
        </span>
      )}
      <span
        className={cn(
          "rounded-full p-[3px]",
          isFirst ? "bg-gradient-custom" : "bg-border",
        )}
      >
        <Avatar
          className={cn(
            "border-background border-2",
            isFirst ? "size-20 sm:size-24" : "size-16 sm:size-18",
          )}
        >
          <AvatarImage src={clipper.imageUrl ?? undefined} alt={name} />
          <AvatarFallback
            className={cn(
              "bg-brand-cyan/15 font-bold",
              isFirst ? "text-lg" : "text-sm",
            )}
          >
            {initialsOf(name)}
          </AvatarFallback>
        </Avatar>
      </span>
      <p
        className={cn(
          "w-full truncate font-bold tracking-tight",
          isFirst ? "text-base sm:text-lg" : "text-sm",
        )}
      >
        {name}
      </p>
      <p
        className={cn(
          "inline-flex items-center gap-1.5 font-bold tabular-nums",
          isFirst
            ? "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] text-xl sm:text-2xl"
            : "text-foreground text-lg",
        )}
      >
        <Eye
          className={cn(
            "text-brand-mint not-dark:text-primary",
            isFirst ? "size-5" : "size-4",
          )}
          weight="fill"
        />
        {formatCompact(clipper.totalViews)}
      </p>
      <div className="grid w-full grid-cols-2 gap-2">
        <div className="bg-muted/40 flex flex-col rounded-xl px-2 py-1.5">
          <span className="text-[13px] font-bold tabular-nums">
            {formatCompact(clipper.totalPosts)}
          </span>
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            posts
          </span>
        </div>
        <div className="bg-muted/40 flex flex-col rounded-xl px-2 py-1.5">
          <span className="truncate text-[13px] font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            {maskBRL(clipper.totalEarned)}
          </span>
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            ganhos
          </span>
        </div>
      </div>
    </div>
  )
}

/* ===== Linha de ranking ===== */
function RankingRow({
  rank,
  name,
  imageUrl,
  subtitle,
  value,
  valueLabel,
  valueClassName,
}: {
  rank: number
  name: string
  imageUrl: string | null
  subtitle: string
  value: string
  valueLabel: string
  valueClassName?: string
}) {
  const isTop3 = rank <= 3
  return (
    <div
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
          isTop3 ? RANK_BADGES[rank - 1] : "bg-muted/60 text-muted-foreground",
        )}
      >
        {rank === 1 ? <Crown className="size-4" weight="fill" /> : `${rank}º`}
      </span>
      <Avatar className="border-border/60 size-9 shrink-0 border">
        <AvatarImage src={imageUrl ?? undefined} alt={name} />
        <AvatarFallback className="bg-brand-cyan/15 text-[10px] font-semibold">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-bold tabular-nums",
            valueClassName ??
              (isTop3 &&
                "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]"),
          )}
        >
          {value}
        </p>
        <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
          {valueLabel}
        </p>
      </div>
    </div>
  )
}

function MiniStat({
  value,
  label,
  highlight = false,
}: {
  value: string
  label: string
  highlight?: boolean
}) {
  return (
    <div className="bg-muted/40 flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-2 py-2">
      <span
        className={cn(
          "max-w-full truncate text-[13px] font-bold tabular-nums",
          highlight &&
            "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

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
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
        {icon}
      </span>
      <div>
        <p className="text-base font-bold">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </div>
  )
}

function RankingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* osso da barra de tabs */}
      <Bone className="h-12 w-full max-w-xl rounded-full" />

      {/* pódio fantasma (2º · 1º maior · 3º, como no layout real) */}
      <div className="mx-auto grid w-full max-w-4xl grid-cols-1 items-end gap-4 sm:grid-cols-3">
        <PodiumCardSkeleton position={2} />
        <PodiumCardSkeleton position={1} />
        <PodiumCardSkeleton position={3} />
      </div>

      {/* ranking completo fantasma */}
      <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-4 w-52 max-w-full" />
            <Bone delay={120} className="h-3 w-64 max-w-full rounded-full" />
          </div>
        </div>
        <ListRowsSkeleton rows={8} />
      </div>
    </div>
  )
}

function PodiumCardSkeleton({ position }: { position: 1 | 2 | 3 }) {
  const isFirst = position === 1
  const base = isFirst ? 0 : position === 2 ? 140 : 280
  return (
    <div
      className={cn(
        "glass-card relative flex flex-col items-center gap-3 rounded-3xl p-5 text-center",
        isFirst && "order-first py-7 sm:order-none",
        position === 3 && "order-last",
      )}
    >
      {/* selo de posição */}
      <Bone
        delay={base}
        className="absolute top-3 right-3 size-7 rounded-full"
      />
      {/* medalha/coroa */}
      <Bone delay={base + 70} className="size-8 rounded-full" />
      {/* avatar — o 1º é maior */}
      <Bone
        delay={base + 140}
        className={cn(
          "rounded-full",
          isFirst ? "size-20 sm:size-24" : "size-16 sm:size-18",
        )}
      />
      {/* nome */}
      <Bone
        delay={base + 210}
        className={cn("h-4", isFirst ? "w-32" : "w-28")}
      />
      {/* views */}
      <Bone
        delay={base + 280}
        className={cn(isFirst ? "h-7 w-28" : "h-6 w-24")}
      />
      {/* posts + ganhos */}
      <div className="grid w-full grid-cols-2 gap-2">
        <Bone delay={base + 350} className="h-12 rounded-xl" />
        <Bone delay={base + 420} className="h-12 rounded-xl" />
      </div>
    </div>
  )
}
