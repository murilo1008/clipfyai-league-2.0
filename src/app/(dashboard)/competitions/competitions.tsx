"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Archive,
  CalendarBlank,
  Warning,
  CheckCircle,
  Clock,
  Copy,
  DotsThreeVertical,
  Eye,
  Globe,
  Hash,
  Heart,
  Lock,
  MagnifyingGlass,
  Pause,
  Play,
  Plus,
  Sparkle,
  Trophy,
  UsersThree,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { ArenaHeroViz, ArenaHeroVizSkeleton } from "@/components/competitions/arena-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import { CardGridSkeleton } from "@/components/shared/skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { CreateCompetitionDialog } from "./create-competition-dialog"

type StatusKey =
  | "ACTIVE"
  | "SCHEDULED"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED"
  | "DRAFT"

const STATUS_CONFIG: Record<
  StatusKey,
  {
    label: string
    icon: React.ElementType
    badge: string
    dot: string
    cta: string
  }
> = {
  ACTIVE: {
    label: "Ativa",
    icon: Play,
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    dot: "bg-emerald-400",
    cta: "Ver Ranking",
  },
  SCHEDULED: {
    label: "Agendada",
    icon: Clock,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-400",
    cta: "Ver Detalhes",
  },
  PAUSED: {
    label: "Pausada",
    icon: Pause,
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
    cta: "Retomar",
  },
  COMPLETED: {
    label: "Concluída",
    icon: CheckCircle,
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400",
    dot: "bg-violet-400",
    cta: "Ver Resultados",
  },
  ARCHIVED: {
    label: "Arquivada",
    icon: Archive,
    badge: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-zinc-400",
    cta: "Ver Arquivo",
  },
  DRAFT: {
    label: "Rascunho",
    icon: Warning,
    badge: "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-400",
    cta: "Ver Rascunho",
  },
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(iso),
  )

export default function Competitions() {
  const { maskText } = useMaskedCurrency()
  const { data: campaigns, isLoading: loadingCampaigns } =
    api.admin.getAllCampaignsWithStats.useQuery()
  const { data: stats, isLoading: loadingStats } =
    api.admin.getCampaignsStats.useQuery()

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusKey | "ALL">(
    "ALL",
  )
  const [visibility, setVisibility] = React.useState<"public" | "private">(
    "public",
  )
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  const filtered = (campaigns ?? []).filter((campaign) => {
    const matchesSearch = campaign.name
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === "ALL" || campaign.status === statusFilter
    const matchesVisibility =
      visibility === "public" ? !campaign.isPrivate : campaign.isPrivate
    return matchesSearch && matchesStatus && matchesVisibility
  })

  const copyInviteLink = (slug: string) => {
    void navigator.clipboard.writeText(
      `${window.location.origin}/sign-up?slug=${slug}`,
    )
    toast.success("Link copiado!", {
      description: "Link de convite copiado para a área de transferência",
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da arena ===== */}
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            A arena das <span className="text-gradient">competições</span>
          </>
        }
        subtitle="Gerencie e acompanhe todas as suas campanhas — públicas e privadas — com ranking, premiação e clipadores em um só lugar."
        isLoading={loadingStats}
        viz={<ArenaHeroViz />}
        vizSkeleton={<ArenaHeroVizSkeleton />}
        stats={[
          {
            icon: <Play className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: stats?.activeCampaigns ?? 0,
            kind: "int",
          },
          {
            icon: <Clock className="size-3.5" weight="fill" />,
            label: "Agendadas",
            value: stats?.scheduledCampaigns ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: stats?.totalViews ?? 0,
            kind: "compact",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Play className="size-4" weight="fill" />}
            label="Ativas"
            value={stats?.activeCampaigns ?? 0}
            kind="int"
            hint="em andamento"
            accent="cyan"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<Clock className="size-4" weight="fill" />}
            label="Agendadas"
            value={stats?.scheduledCampaigns ?? 0}
            kind="int"
            hint="a iniciar"
            accent="green"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Concluídas"
            value={stats?.completedCampaigns ?? 0}
            kind="int"
            hint="finalizadas"
            accent="cyan"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Total Views"
            value={stats?.totalViews ?? 0}
            kind="compact"
            hint="todas as campanhas"
            accent="green"
            gradientValue
            isLoading={loadingStats}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca, status, visibilidade, nova ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar competições por nome..."
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
            {/* Filtro de status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 cursor-pointer rounded-xl"
                >
                  {statusFilter === "ALL" ? (
                    "Todos os Status"
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          STATUS_CONFIG[statusFilter].dot,
                        )}
                      />
                      {STATUS_CONFIG[statusFilter].label}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setStatusFilter("ALL")}
                >
                  Todos os Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((status) => (
                  <DropdownMenuItem
                    key={status}
                    className="cursor-pointer"
                    onClick={() => setStatusFilter(status)}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        STATUS_CONFIG[status].dot,
                      )}
                    />
                    {STATUS_CONFIG[status].label}
                    {statusFilter === status && (
                      <CheckCircle className="ml-auto size-3.5" weight="fill" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Toggle público/privado */}
            <div className="border-border/70 bg-muted/30 flex h-10 items-center rounded-full border p-1">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  visibility === "public"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Globe className="size-3.5" weight="fill" />
                Públicas
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  visibility === "private"
                    ? "bg-red-500/15 text-red-600 dark:text-red-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Lock className="size-3.5" weight="fill" />
                Privadas
              </button>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <Plus className="size-4" weight="bold" />
              Nova Competição
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Grid de competições ===== */}
      {loadingCampaigns ? (
        <CardGridSkeleton
          count={6}
          aspectClass="aspect-square"
          gridClass="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
          withStats
        />
      ) : filtered.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <Trophy className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                Nenhuma competição encontrada
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {search
                  ? "Tente ajustar seus filtros de busca"
                  : "Crie sua primeira competição para começar"}
              </p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              <Plus className="size-4" weight="bold" />
              Nova Competição
            </Button>
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((campaign, index) => {
            const status =
              STATUS_CONFIG[campaign.status as StatusKey] ??
              STATUS_CONFIG.DRAFT
            const hasPrize =
              campaign.prize &&
              campaign.prize !== "R$ 0" &&
              campaign.prize !== "0"
            return (
              <Reveal immediate key={campaign.id} delayMs={(index % 3) * 80}>
                <Link
                  href={`/competitions/${campaign.slug}`}
                  className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl"
                >
                  {/* Capa sempre 1:1 */}
                  <div className="relative aspect-square w-full overflow-hidden">
                    {campaign.coverImageUrl ? (
                      <Image
                        src={campaign.coverImageUrl}
                        alt={campaign.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="dashboard-galaxy dark flex h-full w-full items-center justify-center">
                        <Trophy
                          className="size-20 text-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]"
                          weight="fill"
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />

                    {/* Badges topo */}
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 rounded-full backdrop-blur-md",
                          status.badge,
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 animate-pulse rounded-full",
                            status.dot,
                          )}
                        />
                        {status.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 rounded-full backdrop-blur-md",
                          campaign.isPrivate
                            ? "border-red-500/40 bg-red-500/15 text-red-400"
                            : "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                        )}
                      >
                        {campaign.isPrivate ? (
                          <Lock className="size-3" weight="fill" />
                        ) : (
                          <Globe className="size-3" weight="fill" />
                        )}
                        {campaign.isPrivate ? "Privada" : "Pública"}
                      </Badge>
                    </div>

                    {/* Plataformas sobre a capa */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1">
                      {campaign.platforms.slice(0, 5).map((platform) => {
                        const config = platformConfig[platform as PlatformKey]
                        if (!config) return null
                        const PlatformIcon = config.icon
                        return (
                          <span
                            key={platform}
                            className="flex size-6.5 items-center justify-center rounded-lg bg-black/55 backdrop-blur-sm"
                          >
                            <PlatformIcon
                              className={cn("size-3.5", config.color)}
                            />
                          </span>
                        )
                      })}
                    </div>

                    {/* Ações */}
                    <div className="absolute right-3 bottom-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.preventDefault()}
                        >
                          <button
                            type="button"
                            aria-label="Ações"
                            className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                          >
                            <DotsThreeVertical
                              className="size-4"
                              weight="bold"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="rounded-xl"
                          onClick={(e) => e.preventDefault()}
                        >
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/competitions/${campaign.slug}`}>
                              Ver Detalhes
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/competitions/${campaign.slug}`}>
                              Ver Ranking
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => copyInviteLink(campaign.slug)}
                          >
                            <Copy className="size-4" />
                            Copiar Link de Convite
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Corpo */}
                  <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                    <div>
                      <h3 className="truncate text-[15px] font-bold tracking-tight sm:text-base">
                        {campaign.name}
                      </h3>
                      {campaign.description && (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
                          {campaign.description}
                        </p>
                      )}
                    </div>

                    {/* Stats 2x2 */}
                    <div className="grid grid-cols-2 gap-2">
                      <CardStat
                        icon={<Eye className="size-3" weight="fill" />}
                        value={formatCompact(campaign.totalViews)}
                        label="views"
                        highlight
                      />
                      <CardStat
                        icon={<Play className="size-3" weight="fill" />}
                        value={formatCompact(campaign.totalPosts)}
                        label="posts"
                      />
                      <CardStat
                        icon={<UsersThree className="size-3" weight="fill" />}
                        value={String(campaign.activeClippers)}
                        label="clipadores"
                      />
                      <CardStat
                        icon={<Heart className="size-3" weight="fill" />}
                        value={`${campaign.engagementRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}
                        label="engajamento"
                      />
                    </div>

                    {/* Período */}
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <CalendarBlank className="size-3.5" />
                      {formatDate(campaign.startDate)} –{" "}
                      {formatDate(campaign.endDate)}
                    </p>

                    {/* Premiação */}
                    {hasPrize && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Sparkle className="size-3.5" weight="fill" />
                          Premiação
                        </span>
                        <span className="text-sm font-bold text-amber-600 tabular-nums dark:text-amber-400">
                          {maskText(formatPrizeLabel(campaign.prize ?? ""))}
                        </span>
                      </div>
                    )}

                    {/* Hashtags */}
                    {campaign.requiredHashtags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {campaign.requiredHashtags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-brand-cyan/25 text-brand-cyan not-dark:border-primary/30 not-dark:text-primary gap-0.5 rounded-full text-[10px]"
                          >
                            <Hash className="size-2.5" />
                            {tag}
                          </Badge>
                        ))}
                        {campaign.requiredHashtags.length > 2 && (
                          <span className="text-muted-foreground text-[10px] font-semibold">
                            +{campaign.requiredHashtags.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* CTA por status */}
                    <span className="border-brand-cyan/25 text-foreground group-hover:border-brand-cyan/50 group-hover:bg-brand-cyan/5 not-dark:border-primary/30 mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors">
                      <Trophy className="text-brand-mint not-dark:text-primary size-4" weight="fill" />
                      {status.cta}
                    </span>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      )}

      <CreateCompetitionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
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
    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2">
      <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums">
        <span
          className={cn(
            highlight
              ? "text-brand-mint not-dark:text-primary"
              : "text-foreground/70",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
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
