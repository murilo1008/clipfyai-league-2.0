"use client"

import * as React from "react"
import {
  CalendarBlank,
  ChartLineUp,
  Clock,
  Crown,
  Shield,
  ShieldWarning,
  Target,
  TrendUp,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { ClanReportsHeroViz, ClanReportsHeroVizSkeleton } from "@/components/clans/clan-reports-hero-viz"
import { ClanTagBadge, getClanIcon } from "@/components/clan-tag-badge"
import { HomeHero } from "@/components/home/home-hero"
import { SectionHeading } from "@/components/home/section-heading"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  ChartSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { api, type RouterOutputs } from "@/trpc/react"

/* ============================================================
   Tipos do contrato
   ============================================================ */

type ReportsData = RouterOutputs["clan"]["getReports"]
type ClanCard = ReportsData["clanCards"][number]

/* ============================================================
   Constantes
   ============================================================ */

/** Fallback de cores por clã (mesma paleta de 12 HSL do original). */
const CLAN_COLORS = [
  "hsl(172, 80%, 45%)",
  "hsl(262, 80%, 55%)",
  "hsl(199, 90%, 50%)",
  "hsl(38, 90%, 55%)",
  "hsl(330, 80%, 55%)",
  "hsl(142, 70%, 45%)",
  "hsl(220, 80%, 55%)",
  "hsl(15, 85%, 55%)",
  "hsl(280, 70%, 55%)",
  "hsl(350, 80%, 50%)",
  "hsl(60, 80%, 45%)",
  "hsl(190, 80%, 45%)",
] as const

const STAT_GRID_CLASS =
  "grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4"

/* ============================================================
   Helpers
   ============================================================ */

/** "YYYY-MM-DD" → "dd/MM" sem sofrer com fuso horário. */
const formatDayMonth = (ymd: string) => {
  const [, month, day] = ymd.split("-")
  return `${day}/${month}`
}

/** Eixo Y compacto: 1200 → "1.2k". */
const formatAxisValue = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)

/* ============================================================
   Página
   ============================================================ */

export default function ClanReports() {
  const { data, isLoading, error } = api.clan.getReports.useQuery(undefined, {
    // Clipador sem permissão recebe FORBIDDEN — não adianta re-tentar.
    retry: (failureCount, err) =>
      err.data?.code !== "FORBIDDEN" &&
      err.data?.code !== "UNAUTHORIZED" &&
      failureCount < 2,
  })

  const clanColorMap = React.useMemo(() => {
    const map = new Map<string, string>()
    data?.clansForChart.forEach((clan, index) => {
      map.set(clan.id, clan.emojiColor || CLAN_COLORS[index % CLAN_COLORS.length]!)
    })
    return map
  }, [data])

  const stats = data?.stats
  const avgMembersPerClan =
    stats && stats.totalClans > 0
      ? Math.round(stats.totalMembers / stats.totalClans)
      : 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero do duelo ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clãs"
        title={
          <>
            O duelo dos <span className="text-gradient">clãs</span>
          </>
        }
        subtitle="Crescimento, membros e visão geral dos clãs na plataforma"
        viz={<ClanReportsHeroViz />}
        vizSkeleton={<ClanReportsHeroVizSkeleton />}
        isLoading={!error && isLoading}
        stats={
          error
            ? []
            : [
                {
                  icon: <Shield className="size-3.5" weight="fill" />,
                  label: "Clãs",
                  value: stats?.totalClans ?? 0,
                  kind: "int",
                },
                {
                  icon: <UsersThree className="size-3.5" weight="fill" />,
                  label: "Membros",
                  value: stats?.totalMembers ?? 0,
                  kind: "int",
                },
                {
                  icon: <UserPlus className="size-3.5" weight="fill" />,
                  label: "Novos na semana",
                  value: stats?.last7dApproved ?? 0,
                  kind: "int",
                },
              ]
        }
      />

      {/* ===== Acesso restrito (melhoria: o original prendia no skeleton) ===== */}
      {error ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldWarning className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                Acesso restrito a administradores
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Você não tem permissão para ver os relatórios de clãs. Fale com
                um administrador se acredita que isso é um engano.
              </p>
            </div>
          </div>
        </Reveal>
      ) : isLoading || !data ? (
        <ReportsSkeleton />
      ) : (
        <div className="flex flex-col gap-6 sm:gap-8">
          {/* ---- KPIs ---- */}
          <Reveal immediate>
            <div className={STAT_GRID_CLASS}>
              <StatTile
                icon={<Shield className="size-4" weight="fill" />}
                label="Total de Clãs"
                value={data.stats.totalClans}
                kind="int"
                hint="clãs ativos na plataforma"
                accent="cyan"
              />
              <StatTile
                icon={<UsersThree className="size-4" weight="fill" />}
                label="Total de Membros"
                value={data.stats.totalMembers}
                kind="int"
                hint="clipadores em clãs"
                accent="green"
                gradientValue
              />
              <StatTile
                icon={<TrendUp className="size-4" weight="fill" />}
                label="Últimos 7 dias"
                value={data.stats.last7dApproved}
                kind="int"
                hint="novos membros na semana"
                accent="cyan"
              />
              <StatTile
                icon={<CalendarBlank className="size-4" weight="fill" />}
                label="Últimos 30 dias"
                value={data.stats.last30dApproved}
                kind="int"
                hint="novos membros no mês"
                accent="green"
              />
              <StatTile
                icon={<UserPlus className="size-4" weight="fill" />}
                label="Aprovados Hoje"
                value={data.stats.todayApproved}
                kind="int"
                hint="novos membros hoje"
                accent="green"
              />
              <StatTile
                icon={<Clock className="size-4" weight="fill" />}
                label="Pendentes"
                value={data.stats.totalPending}
                kind="int"
                hint="aguardando aprovação"
                accent="cyan"
              />
              <StatTile
                icon={<Target className="size-4" weight="fill" />}
                label="Média Membros/Clã"
                value={avgMembersPerClan}
                kind="int"
                hint="por clã na plataforma"
                accent="gradient"
              />
            </div>
          </Reveal>

          {/* ---- Gráficos ---- */}
          <Reveal immediate delayMs={60}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Crescimento de membros por clã */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 lg:col-span-2">
                <CardHeading
                  icon={<ChartLineUp className="size-4" weight="fill" />}
                  title="Crescimento de Membros por Clã"
                  description="Membros acumulados nos últimos 90 dias"
                />
                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.memberGrowthData}
                      margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                    >
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
                        tickMargin={10}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        interval={Math.max(
                          Math.floor(data.memberGrowthData.length / 8),
                          1,
                        )}
                      />
                      <YAxis
                        tickFormatter={formatAxisValue}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      />
                      <Tooltip
                        content={<MemberGrowthTooltip />}
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
                            {value}
                          </span>
                        )}
                        wrapperStyle={{ paddingTop: 12 }}
                      />
                      {data.clansForChart.map((clan, index) => (
                        <Line
                          key={clan.id}
                          type="monotone"
                          dataKey={clan.id}
                          name={clan.tag}
                          stroke={
                            clanColorMap.get(clan.id) ??
                            CLAN_COLORS[index % CLAN_COLORS.length]
                          }
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          dot={false}
                          animationDuration={650}
                          activeDot={{
                            r: 5,
                            stroke: "var(--card)",
                            strokeWidth: 2,
                          }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Crescimento de clãs */}
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <CardHeading
                  icon={<Shield className="size-4" weight="fill" />}
                  title="Crescimento de Clãs"
                  description="Total de clãs ao longo do tempo"
                />
                <div className="h-72 w-full sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.clanCreationGrowth}
                      margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="clan-growth-stroke"
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
                        <linearGradient
                          id="clan-growth-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
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
                        strokeDasharray="0"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDayMonth}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        interval={Math.max(
                          Math.floor(data.clanCreationGrowth.length / 6),
                          1,
                        )}
                      />
                      <YAxis
                        tickFormatter={formatAxisValue}
                        axisLine={false}
                        tickLine={false}
                        width={46}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        content={<ClanGrowthTooltip />}
                        cursor={{
                          stroke:
                            "color-mix(in oklab, var(--foreground) 22%, transparent)",
                          strokeDasharray: "4 4",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        name="Total de Clãs"
                        stroke="url(#clan-growth-stroke)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        fill="url(#clan-growth-fill)"
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
              </div>
            </div>
          </Reveal>

          {/* ---- Visão por Clã ---- */}
          <Reveal immediate delayMs={100}>
            <div className="flex flex-col gap-4">
              <SectionHeading
                icon={<Crown className="size-4" weight="fill" />}
                title="Visão por Clã"
                description="Membros e crescimento recente de cada clã"
              />

              {data.clanCards.length === 0 ? (
                <div className="glass-card rounded-3xl py-12 text-center">
                  <p className="text-muted-foreground text-sm">
                    Nenhum clã ativo por enquanto.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {data.clanCards.map((clan, index) => (
                    <Reveal
                      immediate
                      key={clan.id}
                      delayMs={(index % 4) * 60}
                    >
                      <ClanOverviewCard clan={clan} />
                    </Reveal>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Card de clã
   ============================================================ */

function ClanOverviewCard({ clan }: { clan: ClanCard }) {
  const ClanIcon = getClanIcon(clan.emoji)

  return (
    <div className="glass-card glass-card-hover flex h-full flex-col gap-3 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-[11px] font-semibold tracking-[0.14em] uppercase">
          {clan.name}
        </p>
        {clan.imageUrl ? (
          <Avatar className="size-10 shrink-0 rounded-xl">
            <AvatarImage
              src={clan.imageUrl}
              alt={clan.name}
              className="object-cover"
            />
            <AvatarFallback className="bg-muted/40 rounded-xl">
              <ClanIcon
                className="size-5"
                style={{ color: clan.emojiColor }}
              />
            </AvatarFallback>
          </Avatar>
        ) : (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: `color-mix(in oklab, ${clan.emojiColor} 15%, transparent)`,
            }}
          >
            <ClanIcon className="size-5" style={{ color: clan.emojiColor }} />
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
          {clan.memberCount.toLocaleString("pt-BR")}
        </span>
        <span className="text-muted-foreground text-xs">membros</span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <ClanTagBadge
          tag={clan.tag}
          emoji={clan.emoji}
          emojiColor={clan.emojiColor}
          size="xs"
        />
        {clan.last7dApproved > 0 && (
          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            +{clan.last7dApproved} 7d
          </span>
        )}
        {clan.last30dApproved > 0 && (
          <span className="rounded-md bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            +{clan.last30dApproved} 30d
          </span>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   Heading de card (padrão da identidade)
   ============================================================ */

function CardHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
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
  )
}

/* ============================================================
   Tooltips glass (identidade)
   ============================================================ */

function TooltipShell({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-border bg-popover/95 min-w-44 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      {label && (
        <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
          {label}
        </p>
      )}
      {children}
    </div>
  )
}

function MemberGrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <TooltipShell label={label ? formatDayMonth(label) : ""}>
      <div className="flex flex-col gap-1">
        {[...payload]
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .map((entry, index) => (
            <div
              key={`${entry.name}-${index}`}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums">
                {Number(entry.value ?? 0).toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
      </div>
    </TooltipShell>
  )
}

function ClanGrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <TooltipShell label={label ? formatDayMonth(label) : ""}>
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--chart-growth-end)]" />
          Total de clãs
        </span>
        <span className="text-sm font-bold tabular-nums">
          {Number(payload[0]?.value ?? 0).toLocaleString("pt-BR")}
        </span>
      </div>
    </TooltipShell>
  )
}

/* ============================================================
   Skeleton da página (kit da marca)
   ============================================================ */

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <StatTilesGridSkeleton count={7} className={STAT_GRID_CLASS} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartSkeleton heightClass="h-72 sm:h-80" className="lg:col-span-2" />
        <ChartSkeleton heightClass="h-72 sm:h-80" bars={8} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-4 w-32" />
            <Bone delay={120} className="h-3 w-48 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <Bone delay={index * 100} className="h-3 w-24 rounded-full" />
                <Bone delay={index * 100 + 60} className="size-10 rounded-xl" />
              </div>
              <Bone delay={index * 100 + 120} className="h-8 w-20" />
              <div className="flex items-center gap-1.5">
                <Bone
                  delay={index * 100 + 180}
                  className="h-6 w-16 rounded-md"
                />
                <Bone
                  delay={index * 100 + 240}
                  className="h-5 w-12 rounded-md"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
