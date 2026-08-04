"use client"

import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowsDownUp,
  Briefcase,
  Buildings,
  ChartBar,
  CheckCircle,
  CircleNotch,
  Clock,
  DotsThreeVertical,
  Envelope,
  Eye,
  Funnel,
  Globe,
  Key,
  MagnifyingGlass,
  MapPin,
  PencilSimple,
  Phone,
  ShoppingBag,
  Sparkle,
  Storefront,
  Trash,
  TrendUp,
  Trophy,
  UserCircle,
  UserPlus,
  UsersThree,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { ClientsHeroViz, ClientsHeroVizSkeleton } from "@/components/settings/clients-hero-viz"
import { Reveal } from "@/components/shared/reveal"
import { Bone } from "@/components/shared/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import type { RouterOutputs } from "@/trpc/react"

export type Client = RouterOutputs["customers"]["getAll"][number]

type ClientStatus = "ACTIVE" | "INACTIVE" | "PENDING"

type ClientFormData = {
  name: string
  email: string
  phone: string
  password: string
  company: string
  position: string
  website: string
  country: string
  city: string
  status: ClientStatus
  notes: string
  campaignIds: string[]
  hasStore: boolean
  hasKiwifyStore: boolean
}

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  ACTIVE: {
    label: "Ativo",
    icon: CheckCircle,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  INACTIVE: {
    label: "Inativo",
    icon: XCircle,
    badge: "border-border bg-muted/50 text-muted-foreground",
    dot: "bg-zinc-400",
  },
  PENDING: {
    label: "Pendente",
    icon: Clock,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
}

const CAMPAIGN_STATUS_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Ativa",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  SCHEDULED: {
    label: "Agendada",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  COMPLETED: {
    label: "Concluída",
    className:
      "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  DRAFT: {
    label: "Rascunho",
    className:
      "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  PAUSED: {
    label: "Pausada",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  ARCHIVED: {
    label: "Arquivada",
    className: "border-border bg-muted/50 text-muted-foreground",
  },
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

function StatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full", config.badge)}>
      <Icon className="size-3" weight="fill" />
      {config.label}
    </Badge>
  )
}

/** Célula de investimento — respeita o olhinho de valores financeiros. */
function InvestedCell({ value }: { value: number }) {
  const { maskBRL } = useMaskedCurrency()
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 tabular-nums dark:text-amber-400">
      <Sparkle className="size-3.5" weight="fill" />
      {maskBRL(value)}
    </span>
  )
}

function ClientActionsMenu({
  client,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  onPasswordChange,
}: {
  client: Client
  onView: (client: Client) => void
  onEdit: (client: Client) => void
  onDelete: (id: string, name: string) => void
  onStatusChange: (client: Client) => void
  onPasswordChange: (client: Client) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ações"
          className="size-8 shrink-0 cursor-pointer rounded-lg"
        >
          <DotsThreeVertical className="size-4" weight="bold" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px] rounded-xl">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onView(client)}
        >
          <Eye className="size-4" />
          Ver Detalhes
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onEdit(client)}
        >
          <PencilSimple className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onStatusChange(client)}
        >
          <TrendUp className="size-4" />
          Alterar Status
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onPasswordChange(client)}
        >
          <Key className="size-4" />
          Alterar Senha
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-500 focus:text-red-500"
          onClick={() => onDelete(client.id, client.name ?? client.email)}
        >
          <Trash className="size-4" />
          Deletar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function createColumns(
  onView: (client: Client) => void,
  onEdit: (client: Client) => void,
  onDelete: (id: string, name: string) => void,
  onStatusChange: (client: Client) => void,
  onPasswordChange: (client: Client) => void,
): ColumnDef<Client>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => `${row.name ?? ""} ${row.email}`,
      header: ({ column }) => (
        <SortHeader
          label="Cliente"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const client = row.original
        return (
          <div className="flex min-w-0 max-w-[280px] items-center gap-3">
            <Avatar className="size-10 shrink-0 rounded-xl">
              <AvatarImage
                src={client.imageUrl ?? undefined}
                alt={client.name ?? client.email}
              />
              <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                {client.name?.charAt(0) || client.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {client.name ?? "Sem nome"}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {client.email}
              </p>
              {client.company && (
                <Badge
                  variant="outline"
                  className="mt-1 max-w-full truncate rounded-full px-1.5 py-0 text-[10px]"
                >
                  {client.company}
                </Badge>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status as ClientStatus} />
      ),
    },
    {
      accessorKey: "totalCampaigns",
      header: ({ column }) => (
        <SortHeader
          label="Campanhas"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const total = row.original.totalCampaigns
        const active = row.original.activeCampaigns
        return (
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums">
              <Trophy
                className="text-brand-cyan not-dark:text-primary size-3.5"
                weight="fill"
              />
              {total}
            </span>
            {active > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                {active} ativa{active !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "totalSpent",
      header: ({ column }) => (
        <SortHeader
          label="Investido"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => <InvestedCell value={row.original.totalSpent} />,
    },
    {
      accessorKey: "lastActivity",
      header: "Última Atividade",
      cell: ({ row }) => {
        const lastActivity = row.original.lastActivity
        if (!lastActivity) {
          return <span className="text-muted-foreground text-xs">Nunca</span>
        }
        return (
          <span className="text-muted-foreground text-xs">
            {format(new Date(lastActivity), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        )
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <ClientActionsMenu
          client={row.original}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          onPasswordChange={onPasswordChange}
        />
      ),
    },
  ]
}

/** Linha fantasma da tabela de clientes — espelha as 6 colunas reais. */
function ClientRowSkeleton({ delay }: { delay: number }) {
  return (
    <TableRow className="border-border/40 hover:bg-transparent">
      <TableCell className="px-4 py-3.5 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <Bone delay={delay} className="size-10 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <Bone delay={delay + 60} className="h-3.5 w-32" />
            <Bone delay={delay + 120} className="h-2.5 w-40 rounded-full" />
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <Bone delay={delay + 180} className="h-[22px] w-20 rounded-full" />
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <Bone delay={delay + 240} className="h-4 w-10" />
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <Bone delay={delay + 300} className="h-4 w-20" />
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <Bone delay={delay + 360} className="h-3 w-16 rounded-full" />
      </TableCell>
      <TableCell className="px-4 py-3.5 align-middle">
        <Bone delay={delay + 420} className="size-8 rounded-lg" />
      </TableCell>
    </TableRow>
  )
}

/** Card fantasma da visão mobile — espelha o card real de cliente. */
function ClientCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className="glass-card flex flex-col gap-3 rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Bone delay={delay} className="size-12 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={delay + 60} className="h-3.5 w-32" />
            <Bone delay={delay + 120} className="h-3 w-44 rounded-full" />
          </div>
        </div>
        <Bone delay={delay + 180} className="size-8 shrink-0 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <Bone delay={delay + 240} className="h-[22px] w-20 rounded-full" />
        <Bone delay={delay + 300} className="h-[22px] w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Bone delay={delay + 360} className="h-14 rounded-xl" />
        <Bone delay={delay + 420} className="h-14 rounded-xl" />
      </div>
    </div>
  )
}

function EmptyClients() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
        <Briefcase className="size-6" weight="fill" />
      </span>
      <div>
        <p className="text-base font-bold">Nenhum cliente encontrado</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Tente ajustar seus filtros de busca
        </p>
      </div>
    </div>
  )
}

export default function Clients() {
  const { maskBRL } = useMaskedCurrency()
  const utils = api.useUtils()

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<
    ClientStatus | "all"
  >("all")

  // Dialogs
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(
    null,
  )
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = React.useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false)
  const [clientToDelete, setClientToDelete] = React.useState<{
    id: string
    name: string
  } | null>(null)

  const { data: clientsData, isLoading } = api.customers.getAll.useQuery()

  // Mutations — invalidate (e não refetch) para manter a paginação
  const createMutation = api.customers.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente criado com sucesso!")
      setIsCreateDialogOpen(false)
      void utils.customers.getAll.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar cliente")
    },
  })

  const updateMutation = api.customers.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!")
      setIsEditDialogOpen(false)
      setIsStatusDialogOpen(false)
      setIsPasswordDialogOpen(false)
      setSelectedClient(null)
      void utils.customers.getAll.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar cliente")
    },
  })

  const deleteMutation = api.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente deletado com sucesso!")
      setIsDeleteDialogOpen(false)
      setClientToDelete(null)
      void utils.customers.getAll.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao deletar cliente")
    },
  })

  const linkCampaignsMutation = api.customers.linkCampaigns.useMutation({
    onSuccess: () => {
      void utils.customers.getAll.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao vincular campanhas")
    },
  })

  const unlinkCampaignsMutation = api.customers.unlinkCampaigns.useMutation({
    onSuccess: () => {
      void utils.customers.getAll.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desvincular campanhas")
    },
  })

  // Handlers
  const handleView = (client: Client) => {
    setSelectedClient(client)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (client: Client) => {
    setSelectedClient(client)
    setIsEditDialogOpen(true)
  }

  const handleStatusChange = (client: Client) => {
    setSelectedClient(client)
    setIsStatusDialogOpen(true)
  }

  const handlePasswordChange = (client: Client) => {
    setSelectedClient(client)
    setIsPasswordDialogOpen(true)
  }

  const handleDelete = (id: string, name: string) => {
    setClientToDelete({ id, name })
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteMutation.mutate({ id: clientToDelete.id })
    }
  }

  // Filtro de status client-side
  const filteredData = React.useMemo(() => {
    if (!clientsData) return []
    if (statusFilter === "all") return clientsData
    return clientsData.filter((client) => client.status === statusFilter)
  }, [clientsData, statusFilter])

  const columns = React.useMemo<ColumnDef<Client>[]>(
    () =>
      createColumns(
        handleView,
        handleEdit,
        handleDelete,
        handleStatusChange,
        handlePasswordChange,
      ),
    [],
  )

  const table = useReactTable<Client>({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, columnFilters, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
  })

  // Stats derivados client-side
  const stats = React.useMemo(() => {
    if (!clientsData) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        pending: 0,
        totalSpent: 0,
        totalCampaigns: 0,
      }
    }
    return {
      total: clientsData.length,
      active: clientsData.filter((c) => c.status === "ACTIVE").length,
      inactive: clientsData.filter((c) => c.status === "INACTIVE").length,
      pending: clientsData.filter((c) => c.status === "PENDING").length,
      totalSpent: clientsData.reduce((sum, c) => sum + c.totalSpent, 0),
      totalCampaigns: clientsData.reduce((sum, c) => sum + c.totalCampaigns, 0),
    }
  }, [clientsData])

  const totalRows = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da carteira ===== */}
      <HomeHero
        eyebrow="Clipfy League · Configurações"
        title={
          <>
            A carteira de <span className="text-gradient">clientes</span>
          </>
        }
        subtitle="Gerencie seus clientes e acompanhe suas campanhas"
        isLoading={isLoading}
        viz={<ClientsHeroViz />}
        vizSkeleton={<ClientsHeroVizSkeleton />}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clientes",
            value: stats.total,
            kind: "int",
          },
          {
            icon: <CheckCircle className="size-3.5" weight="fill" />,
            label: "Ativos",
            value: stats.active,
            kind: "int",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Campanhas",
            value: stats.totalCampaigns,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Total de Clientes"
            value={stats.total}
            kind="int"
            hint={`${stats.active} ativos`}
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<CheckCircle className="size-4" weight="fill" />}
            label="Clientes Ativos"
            value={stats.active}
            kind="int"
            hint={`${
              stats.total > 0
                ? Math.round((stats.active / stats.total) * 100)
                : 0
            }% do total`}
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Trophy className="size-4" weight="fill" />}
            label="Total de Campanhas"
            value={stats.totalCampaigns}
            kind="int"
            hint="criadas pelos clientes"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Sparkle className="size-4" weight="fill" />}
            label="Total Investido"
            value={stats.totalSpent}
            kind="brl"
            hint="em todas as campanhas"
            accent="gradient"
            gradientValue
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca, status, novo cliente ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
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
                  {statusFilter === "all" ? (
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
                  onClick={() => setStatusFilter("all")}
                >
                  Todos os Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(Object.keys(STATUS_CONFIG) as ClientStatus[]).map(
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

            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <UserPlus className="size-4" weight="bold" />
              Novo Cliente
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Lista de clientes ===== */}
      <Reveal immediate delayMs={120}>
        <div className="flex flex-col gap-4">
          {/* Visão mobile em cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <ClientCardSkeleton key={index} delay={index * 120} />
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <div className="glass-card rounded-3xl">
                <EmptyClients />
              </div>
            ) : (
              table.getRowModel().rows.map((row) => {
                const client = row.original
                return (
                  <div
                    key={row.id}
                    className="glass-card glass-card-hover flex flex-col gap-3 rounded-3xl p-4"
                  >
                    {/* Header: avatar + info + ações */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="size-12 shrink-0 rounded-xl">
                          <AvatarImage
                            src={client.imageUrl ?? undefined}
                            alt={client.name ?? client.email}
                          />
                          <AvatarFallback className="bg-gradient-custom rounded-xl text-base font-bold text-[#04222A]">
                            {client.name?.charAt(0) ||
                              client.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="truncate text-sm font-semibold">
                            {client.name ?? "Sem nome"}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {client.email}
                          </p>
                          {client.company && (
                            <Badge
                              variant="outline"
                              className="mt-1 max-w-full truncate rounded-full px-1.5 py-0 text-[10px]"
                            >
                              {client.company}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ClientActionsMenu
                        client={client}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                        onPasswordChange={handlePasswordChange}
                      />
                    </div>

                    {/* Status + campanhas */}
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={client.status as ClientStatus} />
                      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                        <Trophy
                          className="text-brand-cyan not-dark:text-primary size-3"
                          weight="fill"
                        />
                        <span className="text-foreground font-semibold tabular-nums">
                          {client.totalCampaigns}
                        </span>
                        campanhas
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/40 flex items-center gap-2 rounded-xl px-2.5 py-2">
                        <Sparkle
                          className="size-4 shrink-0 text-amber-500 dark:text-amber-400"
                          weight="fill"
                        />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                            Investido
                          </p>
                          <p className="truncate text-sm font-semibold text-amber-600 tabular-nums dark:text-amber-400">
                            {maskBRL(client.totalSpent)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/40 flex items-center gap-2 rounded-xl px-2.5 py-2">
                        <Clock
                          className="text-muted-foreground size-4 shrink-0"
                          weight="fill"
                        />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                            Última Atividade
                          </p>
                          <p className="truncate text-sm font-medium tabular-nums">
                            {client.lastActivity
                              ? format(
                                  new Date(client.lastActivity),
                                  "dd/MM/yy",
                                  { locale: ptBR },
                                )
                              : "Nunca"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Visão desktop em tabela */}
          <div className="hidden lg:block">
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
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, index) => (
                        <ClientRowSkeleton key={index} delay={index * 90} />
                      ))
                    ) : table.getRowModel().rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="py-4">
                          <EmptyClients />
                        </TableCell>
                      </TableRow>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="border-border/40 hover:bg-muted/30 transition-colors"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className="px-4 py-3.5 align-middle"
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
            </div>
          </div>

          {/* Paginação */}
          {!isLoading && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted-foreground text-center text-sm">
                {totalRows === 0
                  ? "Nenhum cliente"
                  : `Mostrando ${pageIndex * pageSize + 1} a ${Math.min(
                      (pageIndex + 1) * pageSize,
                      totalRows,
                    )} de ${totalRows} ${
                      totalRows === 1 ? "cliente" : "clientes"
                    }`}
              </p>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        table.previousPage()
                      }}
                      className={cn(
                        "cursor-pointer rounded-xl",
                        !table.getCanPreviousPage() &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>

                  {(() => {
                    const pageCount = table.getPageCount()
                    const pages: (number | "ellipsis")[] = []

                    if (pageCount <= 5) {
                      // Mostrar todas as páginas se forem 5 ou menos
                      for (let i = 0; i < pageCount; i++) {
                        pages.push(i)
                      }
                    } else {
                      // Sempre mostrar primeira página
                      pages.push(0)

                      if (pageIndex > 2) {
                        pages.push("ellipsis")
                      }

                      // Páginas ao redor da atual
                      const start = Math.max(1, pageIndex - 1)
                      const end = Math.min(pageCount - 2, pageIndex + 1)

                      for (let i = start; i <= end; i++) {
                        if (!pages.includes(i)) {
                          pages.push(i)
                        }
                      }

                      if (pageIndex < pageCount - 3) {
                        pages.push("ellipsis")
                      }

                      // Sempre mostrar última página
                      if (!pages.includes(pageCount - 1)) {
                        pages.push(pageCount - 1)
                      }
                    }

                    return pages.map((page, index) => (
                      <PaginationItem key={index} className="hidden sm:block">
                        {page === "ellipsis" ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href="#"
                            isActive={pageIndex === page}
                            onClick={(e) => {
                              e.preventDefault()
                              table.setPageIndex(page)
                            }}
                            className="cursor-pointer rounded-xl"
                          >
                            {page + 1}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))
                  })()}

                  {/* Mobile: apenas página atual */}
                  <PaginationItem className="sm:hidden">
                    <span className="flex h-9 min-w-9 items-center justify-center px-3 text-sm font-medium tabular-nums">
                      {pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
                    </span>
                  </PaginationItem>

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        table.nextPage()
                      }}
                      className={cn(
                        "cursor-pointer rounded-xl",
                        !table.getCanNextPage() &&
                          "pointer-events-none opacity-50",
                      )}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Dialogs ===== */}
      <ViewClientDialog
        client={selectedClient}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />

      <CreateEditClientDialog
        client={isEditDialogOpen ? selectedClient : null}
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          setIsEditDialogOpen(open)
          if (!open) setSelectedClient(null)
        }}
        onSubmit={async (data) => {
          const { campaignIds = [], ...clientData } = data

          if (isEditDialogOpen && selectedClient) {
            // Atualizar cliente
            await updateMutation.mutateAsync({
              id: selectedClient.id,
              ...clientData,
            })

            // Gerenciar vinculação de campanhas (diff client-side)
            const currentCampaignIds =
              selectedClient.campaigns?.map((c) => c.id) ?? []
            const campaignsToLink = campaignIds.filter(
              (id) => !currentCampaignIds.includes(id),
            )
            const campaignsToUnlink = currentCampaignIds.filter(
              (id) => !campaignIds.includes(id),
            )

            // Vincular novas campanhas
            if (campaignsToLink.length > 0) {
              await linkCampaignsMutation.mutateAsync({
                clientId: selectedClient.id,
                campaignIds: campaignsToLink,
              })
            }

            // Desvincular campanhas removidas
            if (campaignsToUnlink.length > 0) {
              await unlinkCampaignsMutation.mutateAsync({
                clientId: selectedClient.id,
                campaignIds: campaignsToUnlink,
              })
            }
          } else {
            // Criar cliente
            const result = await createMutation.mutateAsync(clientData)

            // Vincular campanhas ao novo cliente
            if (result?.clientId && campaignIds.length > 0) {
              await linkCampaignsMutation.mutateAsync({
                clientId: result.clientId,
                campaignIds,
              })
            }
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <StatusChangeDialog
        client={selectedClient}
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        onSubmit={(status, notes) => {
          if (selectedClient) {
            updateMutation.mutate({
              id: selectedClient.id,
              status,
              notes: notes || selectedClient.notes || undefined,
            })
          }
        }}
        isLoading={updateMutation.isPending}
      />

      <PasswordChangeDialog
        client={selectedClient}
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
        onSubmit={(password) => {
          if (selectedClient) {
            updateMutation.mutate({
              id: selectedClient.id,
              password,
            })
          }
        }}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="text-destructive size-5" weight="fill" />
              Deletar Cliente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar{" "}
              <strong>{clientToDelete?.name}</strong>? Esta ação não pode ser
              desfeita e todas as campanhas associadas serão mantidas, mas o
              acesso do cliente será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
            >
              {deleteMutation.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Deletando...
                </>
              ) : (
                <>
                  <Trash className="size-4" />
                  Deletar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ============================================================
   Ver Detalhes
   ============================================================ */
function ViewClientDialog({
  client,
  open,
  onOpenChange,
}: {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { maskBRL } = useMaskedCurrency()

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
        {/* Header */}
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <Avatar className="size-16 shrink-0 rounded-2xl sm:size-20">
              <AvatarImage
                src={client.imageUrl ?? undefined}
                alt={client.name ?? client.email}
              />
              <AvatarFallback className="bg-gradient-custom rounded-2xl text-2xl font-bold text-[#04222A]">
                {client.name?.charAt(0) || client.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold tracking-tight sm:text-xl">
                <span className="truncate">{client.name ?? "Sem nome"}</span>
                <StatusBadge status={client.status as ClientStatus} />
              </DialogTitle>
              <DialogDescription className="truncate text-xs sm:text-sm">
                {client.email}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo scrollável */}
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
          {/* Contato */}
          <div className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-sm font-bold">
              <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                <Envelope className="size-3.5" weight="fill" />
              </span>
              Informações de Contato
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {client.phone && (
                <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
                  <Phone className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Telefone
                    </p>
                    <p className="truncate text-sm font-medium">
                      {client.phone}
                    </p>
                  </div>
                </div>
              )}
              <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
                <Envelope className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                    Email
                  </p>
                  <p className="truncate text-sm font-medium">{client.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Empresa */}
          {(client.company ?? client.position ?? client.website) && (
            <div className="flex flex-col gap-3">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <Buildings className="size-3.5" weight="fill" />
                </span>
                Informações da Empresa
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {client.company && (
                  <div className="border-border/60 bg-muted/20 rounded-2xl border px-3.5 py-3">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Empresa
                    </p>
                    <p className="truncate text-sm font-medium">
                      {client.company}
                    </p>
                  </div>
                )}
                {client.position && (
                  <div className="border-border/60 bg-muted/20 rounded-2xl border px-3.5 py-3">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Cargo
                    </p>
                    <p className="truncate text-sm font-medium">
                      {client.position}
                    </p>
                  </div>
                )}
                {client.website && (
                  <div className="border-border/60 bg-muted/20 col-span-full rounded-2xl border px-3.5 py-3">
                    <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Website
                    </p>
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-cyan not-dark:text-primary flex items-center gap-2 truncate text-sm font-medium hover:underline"
                    >
                      <Globe className="size-3.5 shrink-0" weight="fill" />
                      <span className="truncate">{client.website}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Localização */}
          {(client.country ?? client.city) && (
            <div className="flex flex-col gap-3">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <MapPin className="size-3.5" weight="fill" />
                </span>
                Localização
              </h4>
              <div className="border-border/60 bg-muted/20 rounded-2xl border px-3.5 py-3">
                <p className="text-sm font-medium">
                  {[client.city, client.country].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Loja */}
          {(client.hasStore || client.hasKiwifyStore) && (
            <div className="flex flex-col gap-3">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <Storefront className="size-3.5" weight="fill" />
                </span>
                Loja
              </h4>
              <div className="flex flex-wrap gap-2">
                {client.hasStore && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  >
                    <Storefront className="size-3" weight="fill" />
                    Possui Loja
                  </Badge>
                )}
                {client.hasKiwifyStore && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400"
                  >
                    <ShoppingBag className="size-3" weight="fill" />
                    Kiwify
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Estatísticas */}
          <div className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-sm font-bold">
              <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                <ChartBar className="size-3.5" weight="fill" />
              </span>
              Estatísticas
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-1 rounded-2xl border p-3.5 text-center sm:p-4">
                <Trophy
                  className="text-brand-cyan not-dark:text-primary size-5"
                  weight="fill"
                />
                <p className="text-xl font-bold tabular-nums sm:text-2xl">
                  {client.totalCampaigns}
                </p>
                <p className="text-muted-foreground text-xs">Campanhas</p>
              </div>
              <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-1 rounded-2xl border p-3.5 text-center sm:p-4">
                <CheckCircle
                  className="size-5 text-emerald-500 dark:text-emerald-400"
                  weight="fill"
                />
                <p className="text-xl font-bold text-emerald-600 tabular-nums sm:text-2xl dark:text-emerald-400">
                  {client.activeCampaigns}
                </p>
                <p className="text-muted-foreground text-xs">Ativas</p>
              </div>
              <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-1 rounded-2xl border p-3.5 text-center sm:p-4">
                <Sparkle
                  className="size-5 text-amber-500 dark:text-amber-400"
                  weight="fill"
                />
                <p className="truncate text-base font-bold text-amber-600 tabular-nums sm:text-xl dark:text-amber-400">
                  {maskBRL(client.totalSpent)}
                </p>
                <p className="text-muted-foreground text-xs">Investido</p>
              </div>
            </div>
          </div>

          {/* Notas */}
          {client.notes && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold">Notas Internas</h4>
              <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {client.notes}
                </p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-border/60 grid grid-cols-2 gap-3 border-t pt-4">
            <div className="text-muted-foreground text-xs">
              <p className="mb-1">Criado em:</p>
              <p className="text-foreground font-medium">
                {format(new Date(client.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
            </div>
            {client.lastActivity && (
              <div className="text-muted-foreground text-xs">
                <p className="mb-1">Última atividade:</p>
                <p className="text-foreground font-medium">
                  {format(
                    new Date(client.lastActivity),
                    "dd/MM/yyyy 'às' HH:mm",
                    { locale: ptBR },
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-border/60 shrink-0 border-t p-4 sm:p-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer rounded-xl"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
   Criar / Editar Cliente
   ============================================================ */
const EMPTY_FORM: ClientFormData = {
  name: "",
  email: "",
  phone: "",
  password: "",
  company: "",
  position: "",
  website: "",
  country: "",
  city: "",
  status: "PENDING",
  notes: "",
  campaignIds: [],
  hasStore: false,
  hasKiwifyStore: false,
}

function CreateEditClientDialog({
  client,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ClientFormData) => Promise<void>
  isLoading: boolean
}) {
  const [formData, setFormData] = React.useState<ClientFormData>(EMPTY_FORM)

  // Buscar campanhas disponíveis
  const { data: availableCampaigns = [] } =
    api.customers.getAvailableCampaigns.useQuery(
      { clientId: client?.id },
      { enabled: open },
    )

  // Preencher/resetar o form quando o cliente ou o open mudarem
  React.useEffect(() => {
    if (client && open) {
      setFormData({
        name: client.name ?? "",
        email: client.email,
        phone: client.phone ?? "",
        password: "", // Não mostrar senha existente por segurança
        company: client.company ?? "",
        position: client.position ?? "",
        website: client.website ?? "",
        country: client.country ?? "",
        city: client.city ?? "",
        status: client.status as ClientStatus,
        notes: client.notes ?? "",
        campaignIds: client.campaigns?.map((c) => c.id) ?? [],
        hasStore: client.hasStore || false,
        hasKiwifyStore: client.hasKiwifyStore || false,
      })
    } else if (!client && open) {
      setFormData(EMPTY_FORM)
    }
  }, [client, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void onSubmit(formData).catch(() => undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-border/60 shrink-0 border-b p-4 text-left sm:p-6">
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg">
            <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
              {client ? (
                <PencilSimple className="size-4" weight="fill" />
              ) : (
                <UserPlus className="size-4" weight="fill" />
              )}
            </span>
            {client ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {client
              ? "Atualize as informações do cliente"
              : "Preencha os dados para criar um novo cliente"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
            {/* Informações Básicas */}
            <div className="flex flex-col gap-4">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <UserCircle className="size-3.5" weight="fill" />
                </span>
                Informações Básicas
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="João Silva"
                    required
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="joao@empresa.com"
                    required
                    disabled={!!client}
                    className="rounded-xl"
                  />
                </div>
              </div>

              {/* Senha - apenas na criação */}
              {!client && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Senha *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      placeholder="Mínimo 8 caracteres"
                      required
                      minLength={8}
                      className="rounded-xl"
                    />
                    <p className="text-muted-foreground text-xs">
                      Esta senha será usada pelo cliente para acessar o sistema
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+55 11 99999-9999"
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: ClientStatus) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger
                      id="status"
                      className="w-full cursor-pointer rounded-xl"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="INACTIVE">Inativo</SelectItem>
                      <SelectItem value="PENDING">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Informações da Empresa */}
            <div className="flex flex-col gap-4">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <Buildings className="size-3.5" weight="fill" />
                </span>
                Informações da Empresa
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    placeholder="Empresa LTDA"
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="position">Cargo</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    placeholder="CEO, Gerente, etc."
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  placeholder="https://www.empresa.com.br"
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Configurações de Loja */}
            <div className="flex flex-col gap-4">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <Storefront className="size-3.5" weight="fill" />
                </span>
                Configurações de Loja
              </h4>
              <div className="border-border/60 bg-muted/20 flex flex-col gap-4 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="hasStore" className="text-sm font-medium">
                      Possui Loja
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      Ative se o cliente possui uma loja online
                    </p>
                  </div>
                  <Switch
                    id="hasStore"
                    className="cursor-pointer"
                    checked={formData.hasStore}
                    onCheckedChange={(checked) => {
                      setFormData({
                        ...formData,
                        hasStore: checked,
                        // Se desativar hasStore, também desativa hasKiwifyStore
                        hasKiwifyStore: checked
                          ? formData.hasKiwifyStore
                          : false,
                      })
                    }}
                  />
                </div>

                {formData.hasStore && (
                  <div className="border-border/60 flex items-center justify-between gap-3 border-t pt-4">
                    <div className="flex flex-col gap-0.5">
                      <Label
                        htmlFor="hasKiwifyStore"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <ShoppingBag
                          className="size-4 text-emerald-500"
                          weight="fill"
                        />
                        Loja Kiwify
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Ative se a loja é integrada com a Kiwify
                      </p>
                    </div>
                    <Switch
                      id="hasKiwifyStore"
                      className="cursor-pointer"
                      checked={formData.hasKiwifyStore}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, hasKiwifyStore: checked })
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Localização */}
            <div className="flex flex-col gap-4">
              <h4 className="flex items-center gap-2 text-sm font-bold">
                <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                  <MapPin className="size-3.5" weight="fill" />
                </span>
                Localização
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    placeholder="São Paulo"
                    className="rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    placeholder="Brasil"
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Competições Vinculadas */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-sm font-bold">
                  <span className="bg-gradient-custom flex size-6 items-center justify-center rounded-lg text-[#04222A]">
                    <Trophy className="size-3.5" weight="fill" />
                  </span>
                  Competições Vinculadas
                </h4>
                <Badge variant="outline" className="gap-1 rounded-full">
                  {formData.campaignIds.length} selecionada
                  {formData.campaignIds.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                Selecione as competições que o cliente poderá visualizar
              </p>
              <div className="border-border/60 flex max-h-[300px] flex-col gap-1 overflow-y-auto rounded-2xl border p-3">
                {availableCampaigns.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Nenhuma competição disponível
                  </p>
                ) : (
                  availableCampaigns.map((campaign) => {
                    const badge = CAMPAIGN_STATUS_BADGES[campaign.status] ?? {
                      label: campaign.status,
                      className: "border-border bg-muted/50 text-muted-foreground",
                    }
                    return (
                      <div
                        key={campaign.id}
                        className="hover:bg-muted/40 flex items-start gap-3 rounded-xl p-3 transition-colors"
                      >
                        <Checkbox
                          id={`campaign-${campaign.id}`}
                          className="mt-0.5 cursor-pointer"
                          checked={formData.campaignIds.includes(campaign.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({
                                ...formData,
                                campaignIds: [
                                  ...formData.campaignIds,
                                  campaign.id,
                                ],
                              })
                            } else {
                              setFormData({
                                ...formData,
                                campaignIds: formData.campaignIds.filter(
                                  (id) => id !== campaign.id,
                                ),
                              })
                            }
                          }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Label
                            htmlFor={`campaign-${campaign.id}`}
                            className="cursor-pointer text-sm font-medium"
                          >
                            {campaign.name}
                          </Label>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-xs",
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {format(
                                new Date(campaign.startDate),
                                "dd/MM/yyyy",
                              )}{" "}
                              -{" "}
                              {format(new Date(campaign.endDate), "dd/MM/yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Notas Internas */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="notes">Notas Internas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Observações sobre o cliente..."
                rows={4}
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="border-border/60 shrink-0 gap-2 border-t p-4 sm:p-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  {client ? "Salvando..." : "Criando..."}
                </>
              ) : (
                <>
                  {client ? (
                    <PencilSimple className="size-4" weight="fill" />
                  ) : (
                    <UserPlus className="size-4" weight="fill" />
                  )}
                  {client ? "Salvar Alterações" : "Criar Cliente"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
   Alterar Status
   ============================================================ */
function StatusChangeDialog({
  client,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (status: ClientStatus, notes?: string) => void
  isLoading: boolean
}) {
  const [status, setStatus] = React.useState<ClientStatus>("ACTIVE")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (client && open) {
      setStatus(client.status as ClientStatus)
      setNotes(client.notes ?? "")
    }
  }, [client, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(status, notes)
  }

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg">
            <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
              <TrendUp className="size-4" weight="fill" />
            </span>
            Alterar Status
          </DialogTitle>
          <DialogDescription>
            Atualize o status de{" "}
            <strong>{client.name ?? client.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-status">Novo Status</Label>
            <Select
              value={status}
              onValueChange={(value: ClientStatus) => setStatus(value)}
            >
              <SelectTrigger
                id="new-status"
                className="w-full cursor-pointer rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-green-500" />
                    Ativo
                  </div>
                </SelectItem>
                <SelectItem value="INACTIVE">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-gray-500" />
                    Inativo
                  </div>
                </SelectItem>
                <SelectItem value="PENDING">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-yellow-500" />
                    Pendente
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="status-notes">Notas (opcional)</Label>
            <Textarea
              id="status-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre a mudança de status..."
              rows={3}
              className="rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" weight="fill" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
   Alterar Senha
   ============================================================ */
function PasswordChangeDialog({
  client,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (password: string) => void
  isLoading: boolean
}) {
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setPassword("")
      setConfirmPassword("")
      setError("")
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    onSubmit(password)
  }

  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base font-bold tracking-tight sm:text-lg">
            <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
              <Key className="size-4" weight="fill" />
            </span>
            Alterar Senha
          </DialogTitle>
          <DialogDescription>
            Defina uma nova senha para{" "}
            <strong>{client.name ?? client.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              minLength={8}
              className="rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirmar Senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite a senha novamente"
              required
              minLength={8}
              className="rounded-xl"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <Warning className="size-4" weight="fill" />
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Key className="size-4" weight="fill" />
                  Alterar Senha
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
