"use client"

import * as React from "react"
import {
  Buildings,
  CalendarBlank,
  ChartLineUp,
  Clock,
  Crown,
  Eye,
  FilmSlate,
  Hash,
  MapPin,
  SealCheck,
  ShieldWarning,
  Trophy,
  UserPlus,
  Users,
  UsersThree,
  XCircle,
} from "@phosphor-icons/react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"

import { OverviewHeroViz, OverviewHeroVizSkeleton } from "@/components/clippers/overview-hero-viz"
import { BarList } from "@/components/home/bar-list"
import { HomeHero } from "@/components/home/home-hero"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

/* ── Nomes de estados ──────────────────────────────────────────────────── */
const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
}

const MONTHS_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
]

/** "YYYY-MM" → "Jan", "Fev"… */
function formatMonth(month: string): string {
  const mm = Number(month.split("-")[1])
  return MONTHS_PT[mm - 1] ?? month
}

const VERIFICATION_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  VERIFIED: {
    label: "Verificado",
    className:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  PENDING: {
    label: "Pendente",
    className:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  UNVERIFIED: {
    label: "Não Verificado",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
  REJECTED: {
    label: "Rejeitado",
    className:
      "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
  },
  BANNED: {
    label: "Banido",
    className:
      "border-red-800/40 bg-red-900/20 text-red-700 dark:text-red-500",
  },
}

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value))

/* ── Página ────────────────────────────────────────────────────────────── */
export default function ClippersOverview() {
  const { data, isLoading, error } = api.clipper.getOverviewData.useQuery()
  const [isCityRankingOpen, setIsCityRankingOpen] = React.useState(false)
  const { data: cityRanking, isLoading: isLoadingCityRanking } =
    api.clipper.getCityViewsRanking.useQuery(undefined, {
      enabled: isCityRankingOpen,
    })

  if (error) return <AccessDeniedCard />

  const verificationRate =
    data && data.totalClippers > 0
      ? Math.round((data.verifiedClippers / data.totalClippers) * 100)
      : 0

  const totalPlatformAccounts = (data?.platformDistribution ?? []).reduce(
    (sum, p) => sum + p.count,
    0,
  )

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clipadores"
        title={
          <>
            Visão geral dos <span className="text-gradient">clipadores</span>
          </>
        }
        subtitle="Panorama completo da comunidade — verificações, plataformas, nichos e onde os clipadores estão em todo o Brasil."
        viz={<OverviewHeroViz />}
        vizSkeleton={<OverviewHeroVizSkeleton />}
        isLoading={isLoading}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clipadores",
            value: data?.totalClippers ?? 0,
            kind: "int",
          },
          {
            icon: <SealCheck className="size-3.5" weight="fill" />,
            label: "Verificados",
            value: data?.verifiedClippers ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: data?.totalViews ?? 0,
            kind: "compact",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Users className="size-4" weight="fill" />}
            label="Total"
            value={data?.totalClippers ?? 0}
            kind="int"
            hint="cadastrados na plataforma"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<SealCheck className="size-4" weight="fill" />}
            label="Verificados"
            value={data?.verifiedClippers ?? 0}
            kind="int"
            hint={`${verificationRate}% de taxa de verificação`}
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Clock className="size-4" weight="fill" />}
            label="Pendentes"
            value={data?.pendingClippers ?? 0}
            kind="int"
            hint="aguardando aprovação"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Crown className="size-4" weight="fill" />}
            label="Assinantes PRO"
            value={data?.proSubscribers ?? 0}
            kind="int"
            hint="com assinatura ativa"
            accent="green"
            isLoading={isLoading}
          />
        </div>
      </Reveal>
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<FilmSlate className="size-4" weight="fill" />}
            label="Posts"
            value={data?.totalPosts ?? 0}
            kind="compact"
            hint="vídeos enviados"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Views"
            value={data?.totalViews ?? 0}
            kind="compact"
            hint="acumuladas"
            accent="green"
            gradientValue
            isLoading={isLoading}
          />
          <StatTile
            icon={<XCircle className="size-4" weight="fill" />}
            label="Rejeitados"
            value={data?.rejectedClippers ?? 0}
            kind="int"
            hint="não aprovados"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<MapPin className="size-4" weight="fill" />}
            label="Estados ativos"
            value={data?.stateDistribution.length ?? 0}
            kind="int"
            hint="com clipadores"
            accent="green"
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Crescimento mensal + Plataformas ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
        <Reveal immediate delayMs={120} className="lg:col-span-3">
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<ChartLineUp className="size-4" weight="fill" />}
              title="Crescimento Mensal"
              description="Novos clipadores por mês (últimos 6 meses)"
            />
            <MonthlyGrowthChart
              data={data?.monthlyGrowth ?? []}
              isLoading={isLoading}
            />
          </div>
        </Reveal>

        <Reveal immediate delayMs={180} className="lg:col-span-2">
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<UsersThree className="size-4" weight="fill" />}
              title="Distribuição por Plataforma"
              description="Contas conectadas por rede social"
            />
            {isLoading ? (
              <div aria-hidden className="flex flex-col gap-3.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Bone
                      delay={index * 90}
                      className="size-8 shrink-0 rounded-lg"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Bone
                          delay={index * 90 + 40}
                          className="h-3 w-24 rounded-full"
                        />
                        <Bone
                          delay={index * 90 + 80}
                          className="h-3 w-10 rounded-full"
                        />
                      </div>
                      <Bone
                        delay={index * 90 + 120}
                        className="h-1.5 w-full rounded-full"
                      />
                    </div>
                    <Bone
                      delay={index * 90 + 160}
                      className="h-3 w-10 shrink-0 rounded-full"
                    />
                  </div>
                ))}
              </div>
            ) : (data?.platformDistribution ?? []).length === 0 ? (
              <p className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-sm">
                Sem contas conectadas por enquanto
              </p>
            ) : (
              <div className="flex flex-col gap-3.5">
                {(data?.platformDistribution ?? []).map((entry) => {
                  const config = platformConfig[entry.platform as PlatformKey]
                  if (!config) return null
                  const PlatformIcon = config.icon
                  const pct =
                    totalPlatformAccounts > 0
                      ? (entry.count / totalPlatformAccounts) * 100
                      : 0
                  return (
                    <div key={entry.platform} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg",
                          config.bgColor,
                        )}
                      >
                        <PlatformIcon className={cn("size-4", config.color)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium">
                            {config.label}
                          </span>
                          <span className="text-[13px] font-bold tabular-nums">
                            {entry.count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <div className="bg-muted/60 h-1.5 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-muted-foreground w-10 shrink-0 text-right text-xs font-semibold tabular-nums">
                        {pct.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* ===== Nichos + Estados + Recentes ===== */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <Reveal immediate delayMs={240}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<Hash className="size-4" weight="bold" />}
              title="Top Nichos"
              description="Nichos mais populares"
            />
            <BarList
              isLoading={isLoading}
              emptyMessage="Sem nichos cadastrados por enquanto"
              items={(data?.nicheDistribution ?? [])
                .slice(0, 8)
                .map((entry) => ({
                  key: entry.niche,
                  label: entry.niche,
                  value: entry.count,
                  tooltip: `${entry.niche}: ${entry.count.toLocaleString("pt-BR")} contas`,
                }))}
              formatValue={(value) => value.toLocaleString("pt-BR")}
            />
          </div>
        </Reveal>

        <Reveal immediate delayMs={300}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<MapPin className="size-4" weight="fill" />}
              title="Ranking por Estado"
              description="Estados com mais clipadores"
            />
            <BarList
              isLoading={isLoading}
              emptyMessage="Sem estados registrados por enquanto"
              items={(data?.stateDistribution ?? [])
                .slice(0, 10)
                .map((entry, index) => ({
                  key: entry.state,
                  icon: (
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums",
                        index === 0
                          ? "bg-gradient-custom text-[#04222A]"
                          : "bg-muted/60 text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                  ),
                  label: STATE_NAMES[entry.state] ?? entry.state,
                  value: entry.count,
                  tooltip: `${STATE_NAMES[entry.state] ?? entry.state}: ${entry.count.toLocaleString("pt-BR")} clipadores`,
                }))}
              formatValue={(value) => value.toLocaleString("pt-BR")}
            />
            <Button
              variant="outline"
              onClick={() => setIsCityRankingOpen(true)}
              className="border-brand-cyan/25 hover:border-brand-cyan/50 hover:bg-brand-cyan/5 not-dark:border-primary/30 mt-auto h-10 w-full cursor-pointer rounded-xl font-semibold"
            >
              <Trophy
                className="text-brand-mint not-dark:text-primary size-4"
                weight="fill"
              />
              Ranking de Cidades
            </Button>
          </div>
        </Reveal>

        <Reveal immediate delayMs={360}>
          <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
            <SectionHeading
              icon={<UserPlus className="size-4" weight="fill" />}
              title="Clipadores Recentes"
              description="Últimos cadastros"
            />
            {isLoading ? (
              <ListRowsSkeleton rows={5} />
            ) : (data?.recentClippers ?? []).length === 0 ? (
              <p className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-sm">
                Nenhum clipador cadastrado ainda
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {(data?.recentClippers ?? []).map((clipper) => {
                  const badge =
                    VERIFICATION_BADGE[clipper.verificationStatus] ??
                    VERIFICATION_BADGE.UNVERIFIED!
                  const displayName =
                    clipper.artisticName || clipper.fullName || "Sem nome"
                  return (
                    <div
                      key={clipper.id}
                      className="hover:bg-muted/40 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage
                          src={clipper.user.imageUrl ?? undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="bg-gradient-custom text-xs font-bold text-[#04222A]">
                          {displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {displayName}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {clipper.city && clipper.state
                            ? `${clipper.city}, ${clipper.state}`
                            : clipper.state || "—"}
                          {" · "}
                          {formatDate(clipper.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-full text-[10px]",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {/* ===== Dialog: Ranking de Cidades ===== */}
      <Dialog open={isCityRankingOpen} onOpenChange={setIsCityRankingOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b p-4 text-left sm:p-6">
            <div className="flex items-center gap-3">
              <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <Buildings className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold sm:text-lg">
                  Ranking de Cidades
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Top 20 cidades por visualizações de clipadores
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingCityRanking ? (
              <div aria-hidden className="flex flex-col gap-4 p-4 sm:p-6">
                {/* pódio fantasma (2º · 1º · 3º) */}
                <div className="grid grid-cols-3 items-end gap-2 pt-2 sm:gap-3">
                  <Bone delay={120} className="h-32 rounded-2xl sm:h-36" />
                  <Bone className="h-40 rounded-2xl sm:h-44" />
                  <Bone delay={240} className="h-28 rounded-2xl sm:h-32" />
                </div>
                <ListRowsSkeleton rows={6} avatar={false} />
              </div>
            ) : !cityRanking || cityRanking.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
                  <Buildings className="size-6" weight="fill" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Nenhuma cidade encontrada
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Os dados aparecerão conforme clipadores se cadastrem
                  </p>
                </div>
              </div>
            ) : (
              <CityRankingBody ranking={cityRanking} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Corpo do ranking de cidades: pódio + lista ────────────────────────── */
interface CityRankingEntry {
  position: number
  city: string
  state: string
  clipperCount: number
  totalViews: number
  totalPosts: number
}

function CityRankingBody({ ranking }: { ranking: CityRankingEntry[] }) {
  const maxViews = ranking[0]?.totalViews ?? 1

  return (
    <div className="flex flex-col">
      {/* Pódio top 3 (2º · 1º · 3º) */}
      <div className="grid grid-cols-3 items-end gap-2 p-4 pt-6 sm:gap-3 sm:p-6">
        {[1, 0, 2].map((index) => {
          const entry = ranking[index]
          if (!entry) return <div key={index} />
          const isFirst = entry.position === 1
          return (
            <div
              key={`${entry.city}-${entry.state}`}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center sm:gap-2 sm:p-4",
                isFirst
                  ? "border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_7%,transparent)] pb-4 sm:pb-6"
                  : "border-border/70 bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "absolute -top-3 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full text-[11px] font-black",
                  isFirst
                    ? "bg-gradient-custom text-[#04222A]"
                    : "bg-muted text-muted-foreground border-border border",
                )}
              >
                {entry.position}
              </span>
              <span
                className={cn(
                  "mt-2 flex items-center justify-center rounded-xl",
                  isFirst
                    ? "bg-gradient-custom size-11 text-[#04222A] sm:size-12"
                    : "bg-muted/70 text-muted-foreground size-9 sm:size-10",
                )}
              >
                <Buildings
                  className={isFirst ? "size-5 sm:size-6" : "size-4 sm:size-5"}
                  weight="fill"
                />
              </span>
              <div className="w-full min-w-0">
                <p className="truncate text-[11px] font-bold sm:text-xs">
                  {entry.city}
                </p>
                <p className="text-muted-foreground text-[9px] sm:text-[10px]">
                  {STATE_NAMES[entry.state] ?? entry.state}
                </p>
              </div>
              <p
                className={cn(
                  "text-sm font-black tabular-nums sm:text-lg",
                  isFirst &&
                    "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
                )}
              >
                {formatCompact(entry.totalViews)}
              </p>
              <div className="text-muted-foreground flex items-center gap-2 text-[9px] sm:text-[10px]">
                <span className="inline-flex items-center gap-0.5">
                  <UsersThree className="size-2.5" weight="fill" />
                  {entry.clipperCount}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <FilmSlate className="size-2.5" weight="fill" />
                  {entry.totalPosts}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 4º em diante */}
      {ranking.length > 3 && (
        <div className="border-border/60 flex flex-col gap-1.5 border-t p-4 sm:p-6">
          {ranking.slice(3).map((entry) => {
            const pct = Math.max((entry.totalViews / maxViews) * 100, 2)
            return (
              <div
                key={`${entry.city}-${entry.state}`}
                className="border-border/50 bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-xl border p-2.5 transition-colors sm:p-3"
              >
                <span className="bg-muted/70 text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums">
                  {entry.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold sm:text-sm">
                    {entry.city}
                    <span className="text-muted-foreground ml-1.5 text-[10px] font-medium">
                      {entry.state}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="bg-muted/60 h-1 max-w-40 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                      {entry.clipperCount}{" "}
                      {entry.clipperCount === 1 ? "clipador" : "clipadores"} ·{" "}
                      {entry.totalPosts} posts
                    </span>
                  </div>
                </div>
                <span className="text-brand-mint not-dark:text-primary shrink-0 text-xs font-bold tabular-nums sm:text-sm">
                  {formatCompact(entry.totalViews)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Gráfico de crescimento mensal (estilo views-growth-chart) ─────────── */
interface MonthlyPoint {
  month: string
  count: number
}

function MonthlyGrowthChart({
  data,
  isLoading,
}: {
  data: MonthlyPoint[]
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div
        aria-hidden
        className="flex h-[260px] w-full items-end justify-between gap-1.5 sm:h-[300px] sm:gap-2.5"
      >
        {Array.from({ length: 14 }).map((_, index) => (
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
    )
  }

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        Sem dados de crescimento por enquanto
      </p>
    )
  }

  const chartData = data.map((entry) => ({
    month: entry.month,
    count: Number(entry.count),
  }))

  return (
    <div className="h-[260px] w-full sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="monthly-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-growth-start)" />
              <stop offset="100%" stopColor="var(--chart-growth-end)" />
            </linearGradient>
            <linearGradient id="monthly-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0.28}
              />
              <stop
                offset="55%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0.08}
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
            dataKey="month"
            tickFormatter={formatMonth}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompact(value)}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <RechartsTooltip
            content={<MonthlyTooltip />}
            cursor={{
              stroke: "color-mix(in oklab, var(--foreground) 22%, transparent)",
              strokeDasharray: "4 4",
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="url(#monthly-stroke)"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="url(#monthly-fill)"
            animationDuration={650}
            activeDot={{
              r: 4.5,
              fill: "var(--chart-growth-end)",
              stroke: "var(--card)",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: MonthlyPoint }>
  label?: string
}) {
  const datum = payload?.[0]?.payload
  if (!active || !datum) return null
  const [year] = (label ?? "").split("-")
  return (
    <div className="border-border bg-popover/95 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
        <CalendarBlank className="size-3" weight="fill" />
        {label ? formatMonth(label) : ""} {year}
      </p>
      <p className="font-bold tabular-nums">
        {Number(datum.count).toLocaleString("pt-BR")} novos clipadores
      </p>
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
              Você não tem permissão para visualizar os dados dos clipadores.
              Fale com um administrador da Clipfy League.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
