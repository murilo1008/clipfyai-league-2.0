"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowsDownUp,
  CaretDown,
  Check,
  CheckCircle,
  CircleNotch,
  Crown,
  DotsThreeVertical,
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Shield,
  SlidersHorizontal,
  Sword,
  Trash,
  TrendUp,
  Users,
  UsersThree,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  CLAN_ICON_MAP,
  ClanTagBadge,
  getClanIcon,
} from "@/components/clan-tag-badge"
import { ClansHeroViz, ClansHeroVizSkeleton } from "@/components/clans/clans-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import { CardGridSkeleton, ListRowsSkeleton } from "@/components/shared/skeletons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import { CreateClanDialog } from "./create-clan-dialog"

/* ========================================================================
   Tipos e constantes
   ======================================================================== */

type ClanItem = {
  id: string
  name: string
  tag: string
  emoji: string
  emojiColor: string
  imageUrl: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  memberCount: number
  totalViews: number
  topMembers: { id: string; name: string; imageUrl: string | null }[]
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos", dotClass: "bg-foreground/50" },
  { value: "active", label: "Ativos", dotClass: "bg-emerald-400" },
  { value: "inactive", label: "Inativos", dotClass: "bg-red-400" },
] as const

const SORT_OPTIONS = [
  { value: "members", label: "Mais Membros", icon: Users },
  { value: "views", label: "Mais Views", icon: Eye },
  { value: "name", label: "Nome (A-Z)", icon: ArrowsDownUp },
  { value: "recent", label: "Mais Recentes", icon: TrendUp },
] as const

const COLOR_PRESETS = [
  { hex: "#FF5733", label: "Vermelho" },
  { hex: "#E74C3C", label: "Rubi" },
  { hex: "#9B59B6", label: "Roxo" },
  { hex: "#8E44AD", label: "Púrpura" },
  { hex: "#3498DB", label: "Azul" },
  { hex: "#2980B9", label: "Cobalto" },
  { hex: "#1ABC9C", label: "Esmeralda" },
  { hex: "#27AE60", label: "Verde" },
  { hex: "#F1C40F", label: "Amarelo" },
  { hex: "#E67E22", label: "Laranja" },
  { hex: "#F39C12", label: "Âmbar" },
  { hex: "#E91E63", label: "Pink" },
]

const formatMonthYear = (date: Date | string) =>
  new Date(date).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  })

/* ========================================================================
   Dialog de membros
   ======================================================================== */

type MembersClan = {
  id: string
  name: string
  tag: string
  emoji: string
  emojiColor: string
  imageUrl: string | null
  members: {
    id: string
    fullName: string
    artisticName: string | null
    user: { id: string; imageUrl: string | null; email: string | null }
    applications: { clipPosts: { views: bigint }[] }[]
  }[]
}

function MembersDialog({
  open,
  onOpenChange,
  clan,
  clanListItem,
  isLoading,
  search,
  onSearchChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clan: MembersClan | null
  clanListItem: ClanItem | null
  isLoading: boolean
  search: string
  onSearchChange: (value: string) => void
}) {
  const members = React.useMemo(() => {
    if (!clan?.members) return []
    const processed = clan.members.map((member) => {
      const totalViews = member.applications.reduce(
        (sum, app) =>
          sum + app.clipPosts.reduce((s, p) => s + Number(p.views), 0),
        0,
      )
      return { ...member, totalViews }
    })
    if (!search.trim())
      return processed.sort((a, b) => b.totalViews - a.totalViews)
    const query = search.toLowerCase()
    return processed
      .filter(
        (member) =>
          member.fullName.toLowerCase().includes(query) ||
          (member.artisticName?.toLowerCase().includes(query) ?? false),
      )
      .sort((a, b) => b.totalViews - a.totalViews)
  }, [clan?.members, search])

  const ClanIcon = getClanIcon(clan?.emoji ?? clanListItem?.emoji ?? "")
  const accentColor = clan?.emojiColor ?? clanListItem?.emojiColor ?? "#8b5cf6"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85svh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        {/* Header */}
        <div className="relative shrink-0 px-5 pt-5 pb-4">
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 size-32 rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
          <div className="relative flex items-center gap-3.5">
            {clan?.imageUrl ? (
              <div className="border-border/60 relative size-12 shrink-0 overflow-hidden rounded-xl border">
                <Image
                  src={clan.imageUrl}
                  alt={clan.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ) : (
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accentColor}20` }}
              >
                <ClanIcon className="size-5" style={{ color: accentColor }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-bold tracking-tight">
                {clan?.name ?? clanListItem?.name ?? "Carregando..."}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Lista de membros do clã
              </DialogDescription>
              <div className="mt-1 flex items-center gap-2">
                <ClanTagBadge
                  tag={clan?.tag ?? clanListItem?.tag ?? "..."}
                  emoji={clan?.emoji ?? clanListItem?.emoji ?? ""}
                  emojiColor={accentColor}
                  size="xs"
                />
                <span className="text-muted-foreground text-xs">
                  {isLoading
                    ? "..."
                    : `${members.length} membro${members.length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
            >
              <X className="size-4" weight="bold" />
            </button>
          </div>
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-px"
            style={{
              background: `linear-gradient(to right, transparent, ${accentColor}30, transparent)`,
            }}
          />
        </div>

        {/* Busca */}
        <div className="shrink-0 px-5 pt-3 pb-3">
          <div className="relative">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar membro..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {isLoading ? (
            <ListRowsSkeleton rows={6} />
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="bg-muted/50 mb-3 flex size-13 items-center justify-center rounded-2xl">
                <Users className="text-muted-foreground/50 size-6" weight="fill" />
              </span>
              <p className="text-muted-foreground text-sm font-medium">
                {search ? "Nenhum membro encontrado" : "Nenhum membro"}
              </p>
              {search && (
                <p className="text-muted-foreground/60 mt-1 text-xs">
                  Tente buscar com outro nome
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="group border-border/60 bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors"
                >
                  <div className="relative shrink-0">
                    <Avatar className="border-border/40 size-10 border">
                      <AvatarImage src={member.user.imageUrl ?? undefined} />
                      <AvatarFallback className="bg-muted text-xs">
                        {member.fullName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {index === 0 && (
                      <span
                        className="ring-background absolute -top-1 -right-1 flex size-4.5 items-center justify-center rounded-full ring-2"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Crown className="size-2.5 text-white" weight="fill" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {member.artisticName ?? member.fullName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {member.fullName}
                      {member.user.email && (
                        <span className="hidden sm:inline">
                          {" · "}
                          {member.user.email}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Eye className="text-brand-mint not-dark:text-primary size-3.5" weight="fill" />
                    <span className="text-sm font-bold tabular-nums">
                      {formatCompact(member.totalViews)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ========================================================================
   Página — visão ADMIN
   ======================================================================== */

export default function ClansAdmin() {
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<string>("members")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [membersClanId, setMembersClanId] = React.useState<string | null>(null)
  const [memberSearch, setMemberSearch] = React.useState("")
  const [editClan, setEditClan] = React.useState<ClanItem | null>(null)
  const [editFormData, setEditFormData] = React.useState({
    name: "",
    description: "",
    tag: "",
    emoji: "Flame",
    emojiColor: "#FF5733",
    imageUrl: "",
  })
  const [deleteClan, setDeleteClan] = React.useState<ClanItem | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("")

  const utils = api.useUtils()

  const updateClan = api.clan.update.useMutation({
    onSuccess: () => {
      toast.success("Clã atualizado com sucesso!")
      void utils.clan.list.invalidate()
      void utils.clan.getStats.invalidate()
      setEditClan(null)
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar clã")
    },
  })

  const deleteClanMutation = api.clan.delete.useMutation({
    onSuccess: () => {
      toast.success("Clã excluído com sucesso!")
      void utils.clan.list.invalidate()
      void utils.clan.getStats.invalidate()
      setDeleteClan(null)
      setDeleteConfirmText("")
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir clã")
    },
  })

  const { data: clans, isLoading } = api.clan.list.useQuery({
    search: search || undefined,
    status: statusFilter as "all" | "active" | "inactive",
    sortBy: sortBy as "members" | "views" | "name" | "recent",
  })

  const { data: stats, isLoading: statsLoading } = api.clan.getStats.useQuery()

  const { data: membersClan, isLoading: membersLoading } =
    api.clan.getById.useQuery(
      { id: membersClanId! },
      { enabled: !!membersClanId },
    )

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === statusFilter)
  const currentSort = SORT_OPTIONS.find((s) => s.value === sortBy)

  const openEdit = (clan: ClanItem) => {
    setEditClan(clan)
    setEditFormData({
      name: clan.name,
      description: clan.description ?? "",
      tag: clan.tag,
      emoji: clan.emoji,
      emojiColor: clan.emojiColor,
      imageUrl: clan.imageUrl ?? "",
    })
  }

  const hasFilters = !!search || statusFilter !== "all"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da fortaleza ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clãs"
        title={
          <>
            A força dos <span className="text-gradient">clãs</span>
          </>
        }
        subtitle="Gerencie os clãs da plataforma — tags, emblemas, membros e desempenho — e fortaleça as alianças da liga."
        isLoading={statsLoading}
        viz={<ClansHeroViz />}
        vizSkeleton={<ClansHeroVizSkeleton />}
        stats={[
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
            icon: <Sword className="size-3.5" weight="fill" />,
            label: "Ativos",
            value: stats?.activeClans ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Shield className="size-4" weight="fill" />}
            label="Total de Clãs"
            value={stats?.totalClans ?? 0}
            kind="int"
            hint="na plataforma"
            accent="cyan"
            isLoading={statsLoading}
          />
          <StatTile
            icon={<Sword className="size-4" weight="fill" />}
            label="Clãs Ativos"
            value={stats?.activeClans ?? 0}
            kind="int"
            hint="em atividade"
            accent="green"
            isLoading={statsLoading}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Total de Membros"
            value={stats?.totalMembers ?? 0}
            kind="int"
            hint="clipadores em clãs"
            accent="cyan"
            isLoading={statsLoading}
          />
          <StatTile
            icon={<TrendUp className="size-4" weight="fill" />}
            label="Média por Clã"
            value={stats?.avgMembers ?? 0}
            kind="int"
            hint="membros por clã"
            accent="green"
            gradientValue
            isLoading={statsLoading}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca, status, ordenação, criar ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar clãs por nome ou tag..."
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
                  <SlidersHorizontal className="text-muted-foreground size-3.5" />
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        currentStatus?.dotClass,
                      )}
                    />
                    {currentStatus?.label}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {STATUS_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className="cursor-pointer"
                    onClick={() => setStatusFilter(option.value)}
                  >
                    <span
                      className={cn("size-2 rounded-full", option.dotClass)}
                    />
                    {option.label}
                    {statusFilter === option.value && (
                      <CheckCircle className="ml-auto size-3.5" weight="fill" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Ordenação */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 cursor-pointer rounded-xl"
                >
                  <ArrowsDownUp className="text-muted-foreground size-3.5" />
                  <span className="hidden sm:inline">{currentSort?.label}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className="cursor-pointer"
                    onClick={() => setSortBy(option.value)}
                  >
                    <option.icon className="text-muted-foreground size-3.5" />
                    {option.label}
                    {sortBy === option.value && (
                      <CheckCircle className="ml-auto size-3.5" weight="fill" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <Plus className="size-4" weight="bold" />
              Criar Clã
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Grid de clãs ===== */}
      {isLoading ? (
        <CardGridSkeleton
          count={8}
          aspectClass="aspect-square"
          gridClass="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          withStats
        />
      ) : !clans || clans.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <Shield className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Nenhum clã encontrado</p>
              <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                {hasFilters
                  ? "Tente ajustar os filtros de busca."
                  : "Crie o primeiro clã da plataforma para começar."}
              </p>
            </div>
            {!hasFilters && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                <Plus className="size-4" weight="bold" />
                Criar Primeiro Clã
              </Button>
            )}
          </div>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(clans as ClanItem[]).map((clan, index) => (
            <Reveal immediate key={clan.id} delayMs={(index % 4) * 80}>
              <div className="glass-card glass-card-hover group relative flex h-full flex-col overflow-hidden rounded-3xl">
                {/* Capa 1:1 */}
                <div className="relative aspect-square w-full overflow-hidden">
                  {clan.imageUrl ? (
                    <Image
                      src={clan.imageUrl}
                      alt={clan.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="dashboard-galaxy dark flex h-full w-full items-center justify-center">
                      <Shield
                        className="size-20"
                        weight="fill"
                        style={{
                          color: `color-mix(in oklab, ${clan.emojiColor} 45%, transparent)`,
                        }}
                      />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />

                  {/* Badges + ações no topo */}
                  <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 rounded-full backdrop-blur-md",
                        clan.isActive
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                          : "border-red-500/40 bg-red-500/15 text-red-400",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 animate-pulse rounded-full",
                          clan.isActive ? "bg-emerald-400" : "bg-red-400",
                        )}
                      />
                      {clan.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="Ações do clã"
                          className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                        >
                          <DotsThreeVertical className="size-4" weight="bold" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={`/clans/${clan.tag}`}>
                            <Eye className="size-4" />
                            Ver Detalhes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => openEdit(clan)}
                        >
                          <PencilSimple className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-red-500 focus:text-red-500 dark:text-red-400 dark:focus:text-red-400"
                          onClick={() => {
                            setDeleteClan(clan)
                            setDeleteConfirmText("")
                          }}
                        >
                          <Trash className="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Nome em overlay */}
                  <div className="absolute inset-x-4 bottom-3">
                    <h3 className="truncate text-lg font-bold tracking-tight text-white drop-shadow-lg sm:text-xl">
                      {clan.name}
                    </h3>
                  </div>
                </div>

                {/* Corpo */}
                <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClanTagBadge
                      tag={clan.tag}
                      emoji={clan.emoji}
                      emojiColor={clan.emojiColor}
                    />
                    <Badge
                      variant="outline"
                      className="text-muted-foreground rounded-full text-[10px]"
                    >
                      {formatMonthYear(clan.createdAt)}
                    </Badge>
                  </div>

                  {clan.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
                      {clan.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2">
                      <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums">
                        <Users className="text-foreground/70 size-3" weight="fill" />
                        {clan.memberCount}
                      </span>
                      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                        membros
                      </span>
                    </div>
                    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl px-2 py-2">
                      <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums">
                        <Eye className="text-brand-mint not-dark:text-primary size-3" weight="fill" />
                        <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                          {formatCompact(clan.totalViews)}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                        views
                      </span>
                    </div>
                  </div>

                  {/* Membros */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center">
                      {clan.memberCount === 0 ? (
                        <span className="text-muted-foreground text-xs">
                          Nenhum membro
                        </span>
                      ) : (
                        <div className="flex -space-x-2">
                          {clan.topMembers.slice(0, 4).map((member) => (
                            <Avatar
                              key={member.id}
                              className="border-card size-7 border-2 transition-transform hover:z-10 hover:scale-110"
                            >
                              <AvatarImage
                                src={member.imageUrl ?? undefined}
                                alt={member.name}
                              />
                              <AvatarFallback className="bg-muted text-[10px]">
                                {member.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {clan.memberCount > 4 && (
                            <span className="border-card bg-muted flex size-7 items-center justify-center rounded-full border-2">
                              <span className="text-muted-foreground text-[9px] font-semibold">
                                +{clan.memberCount - 4}
                              </span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {clan.memberCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMembersClanId(clan.id)
                          setMemberSearch("")
                        }}
                        className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1 text-xs font-semibold transition-colors"
                      >
                        Ver todos
                        <CaretDown className="size-3" weight="bold" />
                      </button>
                    )}
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/clans/${clan.tag}`}
                    className="border-brand-cyan/25 text-foreground group-hover:border-brand-cyan/50 group-hover:bg-brand-cyan/5 not-dark:border-primary/30 mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors"
                  >
                    <Eye className="text-brand-mint not-dark:text-primary size-4" weight="fill" />
                    Ver Clã
                  </Link>
                </div>

                {/* Linha de acento na cor do clã */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${clan.emojiColor}, transparent)`,
                  }}
                />
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {/* ===== Dialog: editar clã ===== */}
      <Dialog
        open={!!editClan}
        onOpenChange={(open) => {
          if (!open) setEditClan(null)
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[90svh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl"
        >
          {/* Header */}
          <div className="border-border/60 relative shrink-0 border-b px-5 pt-5 pb-4 sm:px-6">
            <div
              aria-hidden
              className="bg-gradient-custom pointer-events-none absolute -top-24 -right-16 size-48 rounded-full opacity-10 blur-3xl"
            />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A] shadow-[0_8px_24px_-8px_var(--brand-cyan)] sm:size-11">
                  <PencilSimple className="size-5" weight="fill" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg font-bold tracking-tight">
                    Editar <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">Clã</span>
                  </DialogTitle>
                  <DialogDescription className="truncate text-xs sm:text-sm">
                    Atualize as informações do clã
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setEditClan(null)}
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>
          </div>

          {/* Formulário */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5">
              {/* Preview ao vivo */}
              <div className="flex items-center justify-center py-2">
                <div className="relative">
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl opacity-20 blur-xl"
                    style={{ backgroundColor: editFormData.emojiColor }}
                  />
                  <div className="border-border/60 bg-card/60 relative flex items-center gap-3 rounded-2xl border p-4 backdrop-blur-sm">
                    {editFormData.imageUrl ? (
                      <div className="border-border/60 relative size-12 shrink-0 overflow-hidden rounded-xl border">
                        <Image
                          src={editFormData.imageUrl}
                          alt={editFormData.name}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      </div>
                    ) : (
                      <div
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: `${editFormData.emojiColor}20`,
                        }}
                      >
                        {(() => {
                          const Icon = getClanIcon(editFormData.emoji)
                          return (
                            <Icon
                              className="size-5"
                              style={{ color: editFormData.emojiColor }}
                            />
                          )
                        })()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {editFormData.name || "Nome do Clã"}
                      </p>
                      <div className="mt-1">
                        <ClanTagBadge
                          tag={editFormData.tag || "TAG"}
                          emoji={editFormData.emoji}
                          emojiColor={editFormData.emojiColor}
                          size="xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nome & Tag */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="edit-clan-name"
                    className="text-sm font-semibold"
                  >
                    Nome do Clã
                  </Label>
                  <Input
                    id="edit-clan-name"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ex: Alpha Squad"
                    className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label
                    htmlFor="edit-clan-tag"
                    className="text-sm font-semibold"
                  >
                    Tag{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      (máx. 4 letras)
                    </span>
                  </Label>
                  <Input
                    id="edit-clan-tag"
                    value={editFormData.tag}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        tag: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z]/g, "")
                          .slice(0, 4),
                      }))
                    }
                    placeholder="Ex: ALFA"
                    maxLength={4}
                    className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl font-mono font-bold tracking-widest uppercase"
                  />
                </div>
              </div>

              {/* Grade de ícones */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-semibold">Ícone</Label>
                <div className="border-border/60 bg-muted/20 grid grid-cols-8 gap-1.5 rounded-2xl border p-3 sm:grid-cols-10">
                  {Object.entries(CLAN_ICON_MAP).map(([name, Icon]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setEditFormData((prev) => ({ ...prev, emoji: name }))
                      }
                      className={cn(
                        "flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border transition-all duration-200",
                        editFormData.emoji === name
                          ? "border-brand-cyan/50 bg-brand-cyan/10 not-dark:border-primary/50 not-dark:bg-primary/10 scale-110 shadow-sm"
                          : "hover:bg-muted/50 border-transparent",
                      )}
                    >
                      <Icon
                        className="size-4"
                        style={{
                          color:
                            editFormData.emoji === name
                              ? editFormData.emojiColor
                              : undefined,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor do ícone */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-semibold">Cor do Ícone</Label>
                <div className="border-border/60 bg-muted/20 flex flex-wrap gap-2 rounded-2xl border p-3">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() =>
                        setEditFormData((prev) => ({
                          ...prev,
                          emojiColor: color.hex,
                        }))
                      }
                      title={color.label}
                      className={cn(
                        "ring-offset-background relative size-8 cursor-pointer rounded-full transition-all duration-200",
                        editFormData.emojiColor === color.hex
                          ? "scale-110 ring-2 ring-offset-2"
                          : "hover:scale-110",
                      )}
                      style={
                        {
                          backgroundColor: color.hex,
                          "--tw-ring-color": color.hex,
                        } as React.CSSProperties
                      }
                    >
                      {editFormData.emojiColor === color.hex && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="size-2 rounded-full bg-white" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Label className="text-muted-foreground shrink-0 text-xs">
                    Cor customizada:
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editFormData.emojiColor}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          emojiColor: e.target.value,
                        }))
                      }
                      aria-label="Selecionar cor customizada"
                      className="border-border/60 size-8 cursor-pointer rounded-lg border bg-transparent"
                    />
                    <Input
                      value={editFormData.emojiColor}
                      onChange={(e) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          emojiColor: e.target.value,
                        }))
                      }
                      placeholder="#FF5733"
                      className="focus-visible:ring-brand-cyan/40 h-8 w-24 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* URL da imagem */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-clan-image"
                  className="text-sm font-semibold"
                >
                  URL da Imagem
                </Label>
                <Input
                  id="edit-clan-image"
                  value={editFormData.imageUrl}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      imageUrl: e.target.value,
                    }))
                  }
                  placeholder="https://exemplo.com/imagem.png"
                  className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl"
                />
              </div>

              {/* Descrição */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-clan-desc"
                  className="text-sm font-semibold"
                >
                  Descrição
                </Label>
                <Textarea
                  id="edit-clan-desc"
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descreva o clã..."
                  rows={3}
                  className="focus-visible:ring-brand-cyan/40 resize-none rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/60 bg-background/85 flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3.5 backdrop-blur-md sm:px-6">
            <Button
              variant="ghost"
              onClick={() => setEditClan(null)}
              className="h-10 cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editClan) return
                updateClan.mutate({
                  id: editClan.id,
                  name: editFormData.name,
                  tag: editFormData.tag,
                  emoji: editFormData.emoji,
                  emojiColor: editFormData.emojiColor,
                  imageUrl: editFormData.imageUrl || undefined,
                  description: editFormData.description || undefined,
                })
              }}
              disabled={
                updateClan.isPending ||
                !editFormData.name.trim() ||
                !editFormData.tag.trim()
              }
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              {updateClan.isPending && (
                <CircleNotch className="size-4 animate-spin" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: excluir clã ===== */}
      <Dialog
        open={!!deleteClan}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteClan(null)
            setDeleteConfirmText("")
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[90svh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md"
        >
          {/* Header */}
          <div className="relative shrink-0 border-b border-red-500/20 px-5 pt-5 pb-4 sm:px-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-40 rounded-full bg-gradient-to-br from-red-500 to-rose-500 opacity-15 blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25 sm:size-11">
                <Warning className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg font-bold tracking-tight text-red-500 dark:text-red-400">
                  Excluir Clã
                </DialogTitle>
                <DialogDescription className="truncate text-xs sm:text-sm">
                  Esta ação é permanente e irreversível
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Conteúdo */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5">
              {deleteClan && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/5 p-3.5">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${deleteClan.emojiColor}20` }}
                  >
                    {(() => {
                      const Icon = getClanIcon(deleteClan.emoji)
                      return (
                        <Icon
                          className="size-4"
                          style={{ color: deleteClan.emojiColor }}
                        />
                      )
                    })()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {deleteClan.name}
                    </p>
                    <div className="mt-0.5">
                      <ClanTagBadge
                        tag={deleteClan.tag}
                        emoji={deleteClan.emoji}
                        emojiColor={deleteClan.emojiColor}
                        size="xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Avisos */}
              <div className="flex flex-col gap-2.5">
                <div className="text-muted-foreground flex items-start gap-2.5 text-sm">
                  <Trash className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400" />
                  <span>Todos os membros serão removidos do clã</span>
                </div>
                <div className="text-muted-foreground flex items-start gap-2.5 text-sm">
                  <Warning className="mt-0.5 size-4 shrink-0 text-red-500 dark:text-red-400" />
                  <span>
                    Todos os dados do clã serão perdidos permanentemente
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-sm font-semibold text-red-500 dark:text-red-400">
                  <XCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
                  <span>Esta ação é IRREVERSÍVEL</span>
                </div>
              </div>

              {/* Confirmação */}
              <div className="flex flex-col gap-2.5">
                <Label
                  htmlFor="delete-clan-confirm"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Digite{" "}
                  <span className="text-foreground font-bold">
                    {deleteClan?.name}
                  </span>{" "}
                  para confirmar:
                </Label>
                <Input
                  id="delete-clan-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteClan?.name ?? ""}
                  className="h-10 rounded-xl focus-visible:ring-red-500/30"
                />
                {deleteConfirmText && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Digitado:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        deleteConfirmText === deleteClan?.name
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400",
                      )}
                    >
                      {deleteConfirmText}
                    </span>
                    <span className="text-muted-foreground/50">|</span>
                    <span className="text-muted-foreground">Esperado:</span>
                    <span className="text-foreground font-semibold">
                      {deleteClan?.name}
                    </span>
                    {deleteConfirmText === deleteClan?.name && (
                      <Check
                        className="size-3.5 text-emerald-500 dark:text-emerald-400"
                        weight="bold"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/60 bg-background/85 flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3.5 backdrop-blur-md sm:px-6">
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteClan(null)
                setDeleteConfirmText("")
              }}
              className="h-10 cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteClan) return
                deleteClanMutation.mutate({ id: deleteClan.id })
              }}
              disabled={
                deleteClanMutation.isPending ||
                deleteConfirmText !== deleteClan?.name
              }
              className="h-10 cursor-pointer rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-4 font-semibold text-white shadow-lg shadow-red-500/25 hover:from-red-700 hover:to-rose-700"
            >
              {deleteClanMutation.isPending && (
                <CircleNotch className="size-4 animate-spin" />
              )}
              <Trash className="size-4" />
              Excluir Clã
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateClanDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      <MembersDialog
        open={!!membersClanId}
        onOpenChange={(open) => {
          if (!open) setMembersClanId(null)
        }}
        clan={(membersClan as MembersClan | undefined) ?? null}
        clanListItem={
          (clans as ClanItem[] | undefined)?.find(
            (clan) => clan.id === membersClanId,
          ) ?? null
        }
        isLoading={membersLoading}
        search={memberSearch}
        onSearchChange={setMemberSearch}
      />
    </div>
  )
}
