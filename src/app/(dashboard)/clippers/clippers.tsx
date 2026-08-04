"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowsDownUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Clock,
  Copy,
  Crown,
  CurrencyDollar,
  DotsThreeVertical,
  Eye,
  Funnel,
  MagnifyingGlass,
  MapPin,
  Prohibit,
  SealCheck,
  SlidersHorizontal,
  Sparkle,
  UserCircle,
  UsersThree,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { ClippersHeroViz, ClippersHeroVizSkeleton } from "@/components/clippers/clippers-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { Reveal } from "@/components/shared/reveal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Bone } from "@/components/shared/skeletons"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import type { RouterOutputs } from "@/trpc/react"

import { SeeClipperDialog } from "./see-clipper-dialog"

export type Clipper = RouterOutputs["clipper"]["getAll"][number]

export type ClipperStatus =
  | "VERIFIED"
  | "PENDING"
  | "UNVERIFIED"
  | "REJECTED"
  | "BANNED"

type SubscriptionKey =
  | "ACTIVE"
  | "TRIAL"
  | "CANCELLED"
  | "EXPIRED"
  | "NONE"

export const STATUS_CONFIG: Record<
  ClipperStatus,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  VERIFIED: {
    label: "Verificado",
    icon: SealCheck,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  PENDING: {
    label: "Pendente",
    icon: Clock,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  UNVERIFIED: {
    label: "Não Verificado",
    icon: UserCircle,
    badge: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-zinc-400",
  },
  REJECTED: {
    label: "Rejeitado",
    icon: XCircle,
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
  BANNED: {
    label: "Banido",
    icon: Prohibit,
    badge: "border-red-900/40 bg-red-900/25 text-red-700 dark:text-red-300",
    dot: "bg-red-700",
  },
}

const SUBSCRIPTION_CONFIG: Record<
  SubscriptionKey,
  { label: string; icon: React.ElementType; badge: string }
> = {
  ACTIVE: {
    label: "PRO",
    icon: Crown,
    badge:
      "border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400",
  },
  TRIAL: {
    label: "Trial",
    icon: Clock,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  CANCELLED: {
    label: "Cancelada",
    icon: XCircle,
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
  },
  EXPIRED: {
    label: "Expirada",
    icon: Clock,
    badge: "border-border bg-muted/50 text-muted-foreground",
  },
  NONE: {
    label: "Free",
    icon: UserCircle,
    badge: "border-border bg-muted/50 text-muted-foreground",
  },
}

const COLUMN_LABELS: Record<string, string> = {
  fullName: "Clipador",
  subscription: "Assinatura",
  platforms: "Plataformas / Local",
  verificationStatus: "Status",
  totalEarned: "Total Ganho",
  avgEngagementRate: "ER",
  autoScore: "Score",
}

function displayName(clipper: Clipper) {
  return clipper.artisticName?.trim() || clipper.fullName
}

function initials(clipper: Clipper) {
  return displayName(clipper)
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** Célula de ganhos — respeita o olhinho de valores financeiros da topbar. */
function EarnedCell({ value }: { value: number }) {
  const { maskBRL } = useMaskedCurrency()
  if (!value) {
    return (
      <span className="text-muted-foreground text-sm">{maskBRL(0)}</span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
      <CurrencyDollar className="size-3.5" weight="bold" />
      {maskBRL(value)}
    </span>
  )
}

function SortHeader({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 font-semibold transition-colors"
    >
      {label}
      <ArrowsDownUp className="size-3.5" />
    </button>
  )
}

function createColumns(
  onViewProfile: (clipper: Clipper) => void,
  onVerify: (id: string) => void,
  onReject: (id: string) => void,
): ColumnDef<Clipper>[] {
  return [
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <SortHeader
          label="Clipador"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const clipper = row.original
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10 shrink-0 rounded-xl">
              <AvatarImage
                src={clipper.user.imageUrl ?? undefined}
                alt={displayName(clipper)}
              />
              <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                {initials(clipper)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {displayName(clipper)}
              </p>
              {clipper.artisticName?.trim() && (
                <p className="text-muted-foreground truncate text-xs">
                  {clipper.fullName}
                </p>
              )}
              <p className="text-muted-foreground/70 truncate text-[11px]">
                Cadastro:{" "}
                {format(new Date(clipper.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      id: "subscription",
      accessorFn: (row) =>
        (row.user.subscriptionStatus ?? "NONE") as SubscriptionKey,
      header: "Assinatura",
      cell: ({ getValue }) => {
        const key = getValue<SubscriptionKey>()
        const config = SUBSCRIPTION_CONFIG[key] ?? SUBSCRIPTION_CONFIG.NONE
        const Icon = config.icon
        return (
          <Badge
            variant="outline"
            className={cn("gap-1 rounded-full", config.badge)}
          >
            <Icon className="size-3" weight="fill" />
            {config.label}
          </Badge>
        )
      },
    },
    {
      id: "platforms",
      header: "Plataformas / Local",
      cell: ({ row }) => {
        const clipper = row.original
        const counts = clipper.socialAccounts.reduce<Record<string, number>>(
          (acc, account) => {
            acc[account.platform] = (acc[account.platform] ?? 0) + 1
            return acc
          },
          {},
        )
        const hasLocation = clipper.city || clipper.state
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {Object.entries(counts).map(([platform, count]) => {
                const config = platformConfig[platform as PlatformKey]
                if (!config) return null
                const PlatformIcon = config.icon
                return (
                  <span
                    key={platform}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-semibold",
                      config.bgColor,
                      config.color,
                    )}
                  >
                    <PlatformIcon className="size-3.5" />
                    {count > 1 && count}
                  </span>
                )
              })}
              {clipper.socialAccounts.length === 0 && (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </div>
            {hasLocation && (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                <MapPin className="size-3" />
                {[clipper.city, clipper.state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "verificationStatus",
      header: "Status",
      cell: ({ row }) => {
        const status =
          STATUS_CONFIG[row.original.verificationStatus as ClipperStatus] ??
          STATUS_CONFIG.UNVERIFIED
        return (
          <Badge
            variant="outline"
            className={cn("gap-1.5 rounded-full", status.badge)}
          >
            <span
              className={cn(
                "size-1.5 animate-pulse rounded-full",
                status.dot,
              )}
            />
            {status.label}
          </Badge>
        )
      },
    },
    {
      id: "totalEarned",
      accessorFn: (row) => row.wallet?.totalEarned ?? 0,
      header: ({ column }) => (
        <SortHeader
          label="Total Ganho"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ getValue }) => <EarnedCell value={getValue<number>()} />,
    },
    {
      accessorKey: "avgEngagementRate",
      header: ({ column }) => (
        <SortHeader
          label="ER"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const er = row.original.avgEngagementRate
        if (er == null) {
          return <span className="text-muted-foreground text-xs">N/A</span>
        }
        return (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-pink-500 tabular-nums">
            <ChartLineUp className="size-3.5" weight="bold" />
            {er.toFixed(1)}%
          </span>
        )
      },
    },
    {
      accessorKey: "autoScore",
      header: ({ column }) => (
        <SortHeader
          label="Score"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const score = row.original.autoScore
        if (score == null) {
          return <span className="text-muted-foreground text-xs">N/A</span>
        }
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm font-bold tabular-nums",
              score >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : score >= 60
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400",
            )}
          >
            <Sparkle className="size-3.5" weight="fill" />
            {score.toFixed(1)}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const clipper = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ações"
                className="size-8 cursor-pointer rounded-lg"
              >
                <DotsThreeVertical className="size-4" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => onViewProfile(clipper)}
              >
                <Eye className="size-4" />
                Ver Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => onVerify(clipper.id)}
              >
                <CheckCircle className="size-4 text-emerald-500" />
                Verificar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-red-500 focus:text-red-500"
                onClick={() => onReject(clipper.id)}
              >
                <XCircle className="size-4" />
                Rejeitar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]
}

/**
 * Linha fantasma da tabela de clipadores: um TableCell por coluna visível,
 * espelhando o conteúdo real (avatar, nome + data, badges, ações) — assim o
 * mobile se comporta igual à tabela real (scroll horizontal + colunas
 * ocultadas via visibilidade) e não há layout shift.
 */
function ClipperRowSkeleton({
  columnIds,
  delay,
}: {
  columnIds: string[]
  delay: number
}) {
  return (
    <TableRow className="border-border/40 hover:bg-transparent">
      {columnIds.map((columnId, cellIndex) => {
        const cellDelay = delay + cellIndex * 60
        return (
          <TableCell key={columnId} className="px-4 py-3.5 align-middle">
            {columnId === "fullName" ? (
              <div className="flex min-w-0 items-center gap-3">
                <Bone
                  delay={cellDelay}
                  className="size-10 shrink-0 rounded-xl"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Bone delay={cellDelay + 60} className="h-3.5 w-32" />
                  <Bone
                    delay={cellDelay + 120}
                    className="h-2.5 w-24 rounded-full"
                  />
                </div>
              </div>
            ) : columnId === "subscription" ? (
              <Bone delay={cellDelay} className="h-[22px] w-16 rounded-full" />
            ) : columnId === "platforms" ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <Bone delay={cellDelay} className="h-6 w-7 rounded-lg" />
                  <Bone delay={cellDelay + 60} className="h-6 w-7 rounded-lg" />
                </div>
                <Bone
                  delay={cellDelay + 120}
                  className="h-3 w-20 rounded-full"
                />
              </div>
            ) : columnId === "verificationStatus" ? (
              <Bone delay={cellDelay} className="h-[22px] w-24 rounded-full" />
            ) : columnId === "actions" ? (
              <Bone delay={cellDelay} className="size-8 rounded-lg" />
            ) : (
              /* totalEarned / ER / Score: valor numérico curto */
              <Bone delay={cellDelay} className="h-4 w-16" />
            )}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

export default function Clippers() {
  const utils = api.useUtils()

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<
    ClipperStatus | "ALL"
  >("ALL")
  const [subscriptionFilter, setSubscriptionFilter] = React.useState<
    SubscriptionKey | "ALL"
  >("ALL")

  const { data: clippers, isLoading: loadingClippers } =
    api.clipper.getAll.useQuery({ status: statusFilter, search })
  const { data: stats, isLoading: loadingStats } =
    api.clipper.getStats.useQuery()

  const [selectedClipper, setSelectedClipper] = React.useState<Clipper | null>(
    null,
  )
  const [isProfileOpen, setIsProfileOpen] = React.useState(false)

  const invalidate = () => {
    void utils.clipper.getAll.invalidate()
    void utils.clipper.getStats.invalidate()
  }

  const verifyMutation = api.clipper.verify.useMutation({
    onSuccess: () => {
      toast.success("Clipador verificado com sucesso!")
      invalidate()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao verificar clipador"),
  })

  const rejectMutation = api.clipper.reject.useMutation({
    onSuccess: () => {
      toast.success("Clipador rejeitado")
      invalidate()
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao rejeitar clipador"),
  })

  const tableData = React.useMemo(() => {
    const list = clippers ?? []
    if (subscriptionFilter === "ALL") return list
    return list.filter(
      (clipper) =>
        ((clipper.user.subscriptionStatus ?? "NONE") as SubscriptionKey) ===
        subscriptionFilter,
    )
  }, [clippers, subscriptionFilter])

  const columns = React.useMemo(
    () =>
      createColumns(
        (clipper) => {
          setSelectedClipper(clipper)
          setIsProfileOpen(true)
        },
        (id) => verifyMutation.mutate({ id }),
        (id) => rejectMutation.mutate({ id }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      avgEngagementRate: false,
      autoScore: false,
    })

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters, columnVisibility },
    initialState: { pagination: { pageSize: 10 } },
  })

  const copyVerifiedClippers = () => {
    const verified = tableData.filter(
      (clipper) => clipper.verificationStatus === "VERIFIED",
    )
    if (verified.length === 0) {
      toast.error("Nenhum clipador aprovado encontrado")
      return
    }
    const text = verified
      .map((clipper) =>
        [
          `Nome: ${clipper.fullName}`,
          `Nome Artístico: ${clipper.artisticName ?? "—"}`,
          `Email: ${clipper.user.email}`,
          `CPF: ${clipper.cpf || "—"}`,
          `Chave PIX: ${clipper.pixKey || "—"}`,
        ].join("\n"),
      )
      .join("\n\n---\n\n")
    void navigator.clipboard.writeText(text)
    toast.success(`${verified.length} clipadores aprovados copiados!`)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero dos clipadores ===== */}
      <HomeHero
        eyebrow="Clipfy League · Clipadores"
        title={
          <>
            O elenco de <span className="text-gradient">clipadores</span>
          </>
        }
        subtitle="Gerencie, verifique e acompanhe todos os clipadores da liga — assinaturas, plataformas, desempenho e carteira em um só lugar."
        isLoading={loadingStats}
        viz={<ClippersHeroViz />}
        vizSkeleton={<ClippersHeroVizSkeleton />}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clipadores",
            value: stats?.total ?? 0,
            kind: "int",
          },
          {
            icon: <SealCheck className="size-3.5" weight="fill" />,
            label: "Verificados",
            value: stats?.verified ?? 0,
            kind: "int",
          },
          {
            icon: <Crown className="size-3.5" weight="fill" />,
            label: "Assinantes PRO",
            value: stats?.activeSubscribers ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <StatTile
            icon={<Crown className="size-4" weight="fill" />}
            label="Assinantes PRO"
            value={stats?.activeSubscribers ?? 0}
            kind="int"
            hint="Clipfy League PRO"
            accent="gradient"
            gradientValue
            isLoading={loadingStats}
          />
          <StatTile
            icon={<SealCheck className="size-4" weight="fill" />}
            label="Verificados"
            value={stats?.verified ?? 0}
            kind="int"
            hint="clipadores ativos"
            accent="green"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<Clock className="size-4" weight="fill" />}
            label="Pendentes"
            value={stats?.pending ?? 0}
            kind="int"
            hint="aguardando verificação"
            accent="cyan"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<UserCircle className="size-4" weight="fill" />}
            label="Não Verificados"
            value={stats?.unverified ?? 0}
            kind="int"
            hint="novos cadastros"
            accent="cyan"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Total"
            value={stats?.total ?? 0}
            kind="int"
            hint="clipadores cadastrados"
            accent="green"
            className="col-span-2 sm:col-span-1"
            isLoading={loadingStats}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca, filtros, colunas, copiar ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou @username..."
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
                  <Funnel className="size-4" />
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
                {(Object.keys(STATUS_CONFIG) as ClipperStatus[]).map(
                  (status) => (
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
                        <CheckCircle
                          className="ml-auto size-3.5"
                          weight="fill"
                        />
                      )}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filtro de assinatura */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 cursor-pointer rounded-xl"
                >
                  <Crown className="size-4" />
                  {subscriptionFilter === "ALL"
                    ? "Assinatura"
                    : SUBSCRIPTION_CONFIG[subscriptionFilter].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setSubscriptionFilter("ALL")}
                >
                  Todas as Assinaturas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(SUBSCRIPTION_CONFIG) as SubscriptionKey[]).map(
                  (key) => {
                    const config = SUBSCRIPTION_CONFIG[key]
                    const Icon = config.icon
                    return (
                      <DropdownMenuItem
                        key={key}
                        className="cursor-pointer"
                        onClick={() => setSubscriptionFilter(key)}
                      >
                        <Icon className="size-4" />
                        {key === "ACTIVE"
                          ? "PRO (Ativos)"
                          : key === "NONE"
                            ? "Free (Sem assinatura)"
                            : config.label}
                        {subscriptionFilter === key && (
                          <CheckCircle
                            className="ml-auto size-3.5"
                            weight="fill"
                          />
                        )}
                      </DropdownMenuItem>
                    )
                  },
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Visibilidade de colunas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 cursor-pointer rounded-xl"
                >
                  <SlidersHorizontal className="size-4" />
                  Colunas
                  <CaretDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(Boolean(value))
                      }
                      className="cursor-pointer"
                    >
                      {COLUMN_LABELS[column.id] ?? column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={copyVerifiedClippers}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <Copy className="size-4" weight="bold" />
              Copiar Aprovados
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Data Table ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-border/60 hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="text-muted-foreground h-12 px-4 text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loadingClippers ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <ClipperRowSkeleton
                      key={index}
                      delay={index * 90}
                      columnIds={table
                        .getVisibleLeafColumns()
                        .map((column) => column.id)}
                    />
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-16">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                          <UsersThree className="size-6" weight="fill" />
                        </span>
                        <div>
                          <p className="text-base font-bold">
                            Nenhum clipador encontrado
                          </p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Tente ajustar seus filtros de busca
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedClipper(row.original)
                        setIsProfileOpen(true)
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="px-4 py-3.5 align-middle"
                          onClick={
                            cell.column.id === "actions"
                              ? (e) => e.stopPropagation()
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
          <div className="border-border/60 flex flex-col items-center justify-between gap-3 border-t px-4 py-3.5 sm:flex-row">
            <p className="text-muted-foreground text-xs">
              {table.getFilteredRowModel().rows.length} clipadores ·{" "}
              Página{" "}
              <span className="text-foreground font-semibold">
                {table.getState().pagination.pageIndex + 1}
              </span>{" "}
              de {Math.max(table.getPageCount(), 1)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <CaretLeft className="size-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Próxima
                <CaretRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Reveal>

      <SeeClipperDialog
        clipper={selectedClipper}
        open={isProfileOpen}
        onOpenChange={(open) => {
          setIsProfileOpen(open)
          if (!open) setSelectedClipper(null)
        }}
      />
    </div>
  )
}
