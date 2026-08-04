"use client"

import * as React from "react"
import type {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowSquareOut,
  ArrowsDownUp,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChatCircle,
  ChatText,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  CurrencyDollar,
  DotsThreeVertical,
  Envelope,
  Eye,
  MagnifyingGlass,
  Phone,
  SlidersHorizontal,
  Sparkle,
  Target,
  Trash,
  TrendUp,
  User,
  Users,
  UsersThree,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  HeroSkeleton,
  StatTilesGridSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
import { LeadsHeroViz, LeadsHeroVizSkeleton } from "@/components/settings/leads-hero-viz"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import type { RouterOutputs } from "@/trpc/react"

export type Lead = RouterOutputs["interestList"]["getAll"][number]

export type LeadStatus =
  | "PENDING"
  | "CONTACTED"
  | "QUALIFIED"
  | "DISQUALIFIED"
  | "CONVERTED"

type UrgencyKey = "IMMEDIATE" | "SOON" | "PLANNING" | "EXPLORATORY"

type BudgetKey =
  | "RANGE_50_80"
  | "RANGE_80_200"
  | "RANGE_200_500"
  | "ABOVE_500"
  | "NOT_DEFINED"

type ForWhomKey = "MYSELF" | "REPRESENTING_PERSON" | "REPRESENTING_BRAND"

/* ===== Configs de status/urgência/orçamento na identidade ===== */

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; badge: string; dot: string }
> = {
  PENDING: {
    label: "Pendente",
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
  CONTACTED: {
    label: "Contatado",
    badge:
      "border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-400",
  },
  QUALIFIED: {
    label: "Qualificado",
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  DISQUALIFIED: {
    label: "Desqualificado",
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
  },
  CONVERTED: {
    label: "Convertido",
    badge:
      "border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400",
    dot: "bg-purple-400",
  },
}

const URGENCY_CONFIG: Record<
  UrgencyKey,
  { label: string; short: string; text: string }
> = {
  IMMEDIATE: {
    label: "Imediato (< 7 dias)",
    short: "Imediato",
    text: "text-red-600 dark:text-red-400",
  },
  SOON: {
    label: "Em breve (7-15 dias)",
    short: "Em breve",
    text: "text-orange-600 dark:text-orange-400",
  },
  PLANNING: {
    label: "Planejamento (legado)",
    short: "Planejando",
    text: "text-amber-600 dark:text-amber-400",
  },
  EXPLORATORY: {
    label: "Exploratório (> 15 dias)",
    short: "Explorando",
    text: "text-emerald-600 dark:text-emerald-400",
  },
}

const BUDGET_CONFIG: Record<BudgetKey, { label: string }> = {
  RANGE_50_80: { label: "R$ 50-80k" },
  RANGE_80_200: { label: "R$ 80-200k" },
  RANGE_200_500: { label: "R$ 200-500k" },
  ABOVE_500: { label: "R$ 500k+" },
  NOT_DEFINED: { label: "Não definido" },
}

const FOR_WHOM_CONFIG: Record<
  ForWhomKey,
  { label: string; icon: React.ElementType }
> = {
  MYSELF: { label: "Para mim", icon: User },
  REPRESENTING_PERSON: { label: "Pessoa", icon: Users },
  REPRESENTING_BRAND: { label: "Marca/Empresa", icon: Buildings },
}

/** Labels legíveis pt-BR do dropdown "Colunas". */
const COLUMN_LABELS: Record<string, string> = {
  fullName: "Nome",
  status: "Status",
  urgency: "Urgência",
  budget: "Orçamento",
  instagramHandle: "Redes",
  createdAt: "Data",
}

const whatsappLink = (whatsapp: string) =>
  `https://wa.me/${whatsapp.replace(/\D/g, "")}`

/** Redes preenchidas do lead, na ordem Instagram → TikTok → YouTube. */
function leadNetworks(lead: Lead): PlatformKey[] {
  const networks: PlatformKey[] = []
  if (lead.instagramHandle) networks.push("INSTAGRAM")
  if (lead.tiktokHandle) networks.push("TIKTOK")
  if (lead.youtubeUrl) networks.push("YOUTUBE")
  return networks
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

/* ===== Colunas ===== */

function createColumns(
  onView: (lead: Lead) => void,
  onDelete: (id: string, fullName: string) => void,
  onStatusChange: (lead: Lead) => void,
): ColumnDef<Lead>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) =>
            table.toggleAllPageRowsSelected(Boolean(value))
          }
          aria-label="Selecionar todos"
          className="translate-y-[2px] cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label="Selecionar linha"
          className="translate-y-[2px] cursor-pointer"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <SortHeader
          label="Nome"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const lead = row.original
        const Icon = FOR_WHOM_CONFIG[lead.forWhom].icon
        return (
          <div className="flex min-w-0 max-w-[220px] items-center gap-3">
            <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
              <Icon className="size-4" weight="fill" />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold">{lead.fullName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {lead.email}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const config = STATUS_CONFIG[row.original.status]
        return (
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer gap-1.5 rounded-full whitespace-nowrap transition-opacity hover:opacity-80",
              config.badge,
            )}
            onClick={() => onStatusChange(row.original)}
          >
            <span
              className={cn("size-1.5 animate-pulse rounded-full", config.dot)}
            />
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: "urgency",
      header: "Urgência",
      cell: ({ row }) => {
        const config = URGENCY_CONFIG[row.original.urgency]
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap",
              config.text,
            )}
          >
            <Clock className="size-3.5 shrink-0" weight="fill" />
            {config.short}
          </span>
        )
      },
    },
    {
      accessorKey: "budget",
      header: "Orçamento",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <CurrencyDollar
            className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
            weight="bold"
          />
          <span className="text-muted-foreground text-xs">
            {BUDGET_CONFIG[row.original.budget].label}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "instagramHandle",
      header: "Redes",
      cell: ({ row }) => {
        const networks = leadNetworks(row.original)
        if (networks.length === 0) {
          return <span className="text-muted-foreground text-xs">—</span>
        }
        return (
          <div className="flex items-center gap-1.5">
            {networks.map((platform) => {
              const config = platformConfig[platform]
              const PlatformIcon = config.icon
              return (
                <span
                  key={platform}
                  className={cn(
                    "inline-flex items-center justify-center rounded-lg p-1.5",
                    config.bgColor,
                    config.color,
                  )}
                >
                  <PlatformIcon className="size-3.5" />
                </span>
              )
            })}
          </div>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortHeader
          label="Data"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return (
          <div className="flex flex-col gap-0.5 whitespace-nowrap">
            <span className="text-xs">
              {date.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
            <span className="text-brand-mint not-dark:text-primary text-xs font-semibold tabular-nums">
              {date.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      enableHiding: false,
      cell: ({ row }) => {
        const lead = row.original
        const link = whatsappLink(lead.whatsapp)
        return (
          <div className="flex items-center gap-2">
            {/* WhatsApp rápido */}
            <Button
              variant="outline"
              size="icon"
              className="size-8 cursor-pointer rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
              asChild
            >
              <a href={link} target="_blank" rel="noopener noreferrer">
                <ChatCircle className="size-4" weight="fill" />
                <span className="sr-only">WhatsApp</span>
              </a>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Abrir menu"
                  className="size-8 cursor-pointer rounded-lg"
                >
                  <DotsThreeVertical className="size-4" weight="bold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuLabel className="font-semibold">
                  Ações
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => onView(lead)}
                >
                  <Eye className="size-4" />
                  Ver Detalhes
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                  asChild
                >
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <ChatCircle className="size-4" />
                    WhatsApp
                    <ArrowSquareOut className="ml-auto size-3" />
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => onStatusChange(lead)}
                >
                  <TrendUp className="size-4" />
                  Mudar Status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-500 focus:text-red-500"
                  onClick={() => onDelete(lead.id, lead.fullName)}
                >
                  <Trash className="size-4" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}

/* ===== Skeletons do refetch (espelham o corpo real) ===== */

/** Linha fantasma da tabela: um TableCell por coluna visível. */
function LeadRowSkeleton({
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
            {columnId === "select" ? (
              <Bone delay={cellDelay} className="size-4 rounded-md" />
            ) : columnId === "fullName" ? (
              <div className="flex min-w-0 items-center gap-3">
                <Bone
                  delay={cellDelay}
                  className="size-9 shrink-0 rounded-xl"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Bone delay={cellDelay + 60} className="h-3.5 w-28" />
                  <Bone
                    delay={cellDelay + 120}
                    className="h-2.5 w-36 rounded-full"
                  />
                </div>
              </div>
            ) : columnId === "status" ? (
              <Bone delay={cellDelay} className="h-[22px] w-24 rounded-full" />
            ) : columnId === "instagramHandle" ? (
              <div className="flex items-center gap-1.5">
                <Bone delay={cellDelay} className="size-6.5 rounded-lg" />
                <Bone delay={cellDelay + 60} className="size-6.5 rounded-lg" />
              </div>
            ) : columnId === "createdAt" ? (
              <div className="flex flex-col gap-1">
                <Bone delay={cellDelay} className="h-3 w-12 rounded-full" />
                <Bone
                  delay={cellDelay + 60}
                  className="h-3 w-9 rounded-full"
                />
              </div>
            ) : columnId === "actions" ? (
              <div className="flex items-center gap-2">
                <Bone delay={cellDelay} className="size-8 rounded-lg" />
                <Bone delay={cellDelay + 60} className="size-8 rounded-lg" />
              </div>
            ) : (
              /* urgency / budget: texto curto com ícone */
              <Bone delay={cellDelay} className="h-3.5 w-20 rounded-full" />
            )}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

/** Card fantasma da visão mobile. */
function LeadCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className="border-border/60 bg-muted/20 space-y-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Bone delay={delay} className="size-4 shrink-0 rounded-md" />
          <Bone delay={delay + 60} className="size-10 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={delay + 120} className="h-3.5 w-2/5 max-w-32" />
            <Bone
              delay={delay + 180}
              className="h-3 w-3/5 max-w-44 rounded-full"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Bone delay={delay + 240} className="size-8 rounded-lg" />
          <Bone delay={delay + 300} className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Bone delay={delay + 180} className="h-[22px] w-24 rounded-full" />
        <Bone delay={delay + 240} className="size-6.5 rounded-lg" />
        <Bone delay={delay + 300} className="size-6.5 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Bone delay={delay + 360} className="h-13 rounded-xl" />
        <Bone delay={delay + 420} className="h-13 rounded-xl" />
      </div>
      <Bone delay={delay + 480} className="h-3 w-28 rounded-full" />
    </div>
  )
}

/* ===== Página ===== */

export default function Leads() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<LeadStatus | "ALL">(
    "ALL",
  )
  const [urgencyFilter, setUrgencyFilter] = React.useState<
    "IMMEDIATE" | "SOON" | "EXPLORATORY" | "ALL"
  >("ALL")
  const [budgetFilter, setBudgetFilter] = React.useState<BudgetKey | "ALL">(
    "ALL",
  )

  // Dialogs
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isBulkStatusDialogOpen, setIsBulkStatusDialogOpen] =
    React.useState(false)
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null)
  const [leadToDelete, setLeadToDelete] = React.useState<{
    id: string
    fullName: string
  } | null>(null)

  // Controlar se já foi feito o primeiro carregamento
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = React.useState(false)

  /* Busca com debounce de 300ms — evita uma requisição por tecla. */
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const utils = api.useUtils()
  const {
    data: leads,
    isLoading: isLoadingLeads,
    isFetching: isFetchingLeads,
  } = api.interestList.getAll.useQuery({
    status: statusFilter,
    urgency: urgencyFilter,
    budget: budgetFilter,
    ...(search ? { search } : {}),
  })

  const { data: stats, isLoading: isLoadingStats } =
    api.interestList.getStats.useQuery()

  // Marcar como carregado após o primeiro carregamento
  React.useEffect(() => {
    if (!isLoadingLeads && !isLoadingStats) {
      setHasInitiallyLoaded(true)
    }
  }, [isLoadingLeads, isLoadingStats])

  // Limpar seleção de rows quando os filtros mudam (evita IDs stale)
  React.useEffect(() => {
    setRowSelection({})
  }, [statusFilter, urgencyFilter, budgetFilter, search])

  // Dados estáveis para o table — evita nova ref a cada render
  const tableData = React.useMemo(() => leads ?? [], [leads])

  // Loading inicial (primeira vez carregando a página)
  const isInitialLoading =
    !hasInitiallyLoaded && (isLoadingLeads || isLoadingStats)

  // Loading de filtros (refetch após mudanças nos filtros)
  const isFilterLoading = hasInitiallyLoaded && isFetchingLeads

  /* ===== Mutations ===== */
  const updateStatusMutation = api.interestList.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!")
      void utils.interestList.getAll.invalidate()
      void utils.interestList.getStats.invalidate()
      setIsStatusDialogOpen(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar status")
    },
  })

  const deleteMutation = api.interestList.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead removido com sucesso!")
      void utils.interestList.getAll.invalidate()
      void utils.interestList.getStats.invalidate()
      setIsDeleteDialogOpen(false)
      setLeadToDelete(null)
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover lead")
    },
  })

  const bulkUpdateStatusMutation = api.interestList.bulkUpdateStatus.useMutation(
    {
      onSuccess: (data) => {
        toast.success(
          `Status de ${data.count} lead(s) atualizado com sucesso!`,
        )
        void utils.interestList.getAll.invalidate()
        void utils.interestList.getStats.invalidate()
        setIsBulkStatusDialogOpen(false)
        setRowSelection({})
      },
      onError: (error) => {
        toast.error(error.message || "Erro ao atualizar status em massa")
      },
    },
  )

  const handleView = (lead: Lead) => {
    setSelectedLead(lead)
    setIsViewDialogOpen(true)
  }

  const handleStatusChange = (lead: Lead) => {
    setSelectedLead(lead)
    setIsStatusDialogOpen(true)
  }

  const handleDelete = (id: string, fullName: string) => {
    setLeadToDelete({ id, fullName })
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (leadToDelete) {
      deleteMutation.mutate({ id: leadToDelete.id })
    }
  }

  const columns = React.useMemo(
    () => createColumns(handleView, handleDelete, handleStatusChange),
    [],
  )

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: 10 } },
  })

  // Leads selecionados
  const selectedLeadIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  )
  const selectedLeadsCount = selectedLeadIds.length
  const hasSelection = selectedLeadsCount > 0
  const plural = selectedLeadsCount > 1 ? "s" : ""

  /* ===== Loading inicial: skeleton completo com o kit ===== */
  if (isInitialLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <HeroSkeleton viz={<LeadsHeroVizSkeleton />} />
        <StatTilesGridSkeleton
          count={5}
          className="sm:grid-cols-3 xl:grid-cols-5"
        />
        <ToolbarSkeleton buttons={4} />
        <TableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da esteira ===== */}
      <HomeHero
        eyebrow="Clipfy League · Configurações"
        title={
          <>
            A esteira de <span className="text-gradient">leads</span>
          </>
        }
        subtitle="Gerencie todos os leads da lista de interesse — contato, redes, urgência, orçamento e status em um só lugar."
        isLoading={isLoadingStats}
        viz={<LeadsHeroViz />}
        vizSkeleton={<LeadsHeroVizSkeleton />}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Leads",
            value: stats?.total ?? 0,
            kind: "int",
          },
          {
            icon: <Clock className="size-3.5" weight="fill" />,
            label: "Pendentes",
            value: stats?.byStatus?.PENDING ?? 0,
            kind: "int",
          },
          {
            icon: <Sparkle className="size-3.5" weight="fill" />,
            label: "Convertidos",
            value: stats?.byStatus?.CONVERTED ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Total"
            value={stats?.total ?? 0}
            kind="int"
            hint="todas as solicitações"
            accent="gradient"
            gradientValue
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<Clock className="size-4" weight="fill" />}
            label="Pendentes"
            value={stats?.byStatus?.PENDING ?? 0}
            kind="int"
            hint="aguardando"
            accent="cyan"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<ChatCircle className="size-4" weight="fill" />}
            label="Contatados"
            value={stats?.byStatus?.CONTACTED ?? 0}
            kind="int"
            hint="em progresso"
            accent="green"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<CheckCircle className="size-4" weight="fill" />}
            label="Qualificados"
            value={stats?.byStatus?.QUALIFIED ?? 0}
            kind="int"
            hint="aprovados"
            accent="cyan"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<Sparkle className="size-4" weight="fill" />}
            label="Convertidos"
            value={stats?.byStatus?.CONVERTED ?? 0}
            kind="int"
            hint="fechados"
            accent="green"
            className="col-span-2 sm:col-span-1"
            isLoading={isLoadingStats}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca + filtros + colunas ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome, email..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 items-center gap-2.5 sm:flex sm:flex-wrap">
            {/* Status */}
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as LeadStatus | "ALL")
              }
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-auto sm:min-w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="cursor-pointer">
                  Todos os Status
                </SelectItem>
                {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          STATUS_CONFIG[status].dot,
                        )}
                      />
                      {STATUS_CONFIG[status].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Urgência (sem PLANNING, como o original) */}
            <Select
              value={urgencyFilter}
              onValueChange={(value) =>
                setUrgencyFilter(
                  value as "IMMEDIATE" | "SOON" | "EXPLORATORY" | "ALL",
                )
              }
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-auto sm:min-w-36">
                <SelectValue placeholder="Urgência" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="cursor-pointer">
                  Todas as Urgências
                </SelectItem>
                <SelectItem value="IMMEDIATE" className="cursor-pointer">
                  Imediato ({"<"} 7 dias)
                </SelectItem>
                <SelectItem value="SOON" className="cursor-pointer">
                  Em breve (7-15 dias)
                </SelectItem>
                <SelectItem value="EXPLORATORY" className="cursor-pointer">
                  Exploratório ({">"} 15 dias)
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Orçamento */}
            <Select
              value={budgetFilter}
              onValueChange={(value) =>
                setBudgetFilter(value as BudgetKey | "ALL")
              }
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-auto sm:min-w-36">
                <SelectValue placeholder="Orçamento" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="ALL" className="cursor-pointer">
                  Todos os Orçamentos
                </SelectItem>
                {(Object.keys(BUDGET_CONFIG) as BudgetKey[]).map((budget) => (
                  <SelectItem
                    key={budget}
                    value={budget}
                    className="cursor-pointer"
                  >
                    {BUDGET_CONFIG[budget].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Visibilidade de colunas — labels pt-BR */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 w-full cursor-pointer rounded-xl sm:w-auto"
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
          </div>
        </div>
      </Reveal>

      {/* ===== Bulk bar (só com seleção) ===== */}
      {hasSelection && (
        <Reveal immediate>
          <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-full text-[#04222A] sm:size-10">
                <Check className="size-4 sm:size-5" weight="bold" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {selectedLeadsCount} lead{plural} selecionado{plural}
                </p>
                <p className="text-muted-foreground hidden text-xs sm:block">
                  Selecione uma ação para aplicar em massa
                </p>
              </div>
            </div>
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRowSelection({})}
                className="h-9 flex-1 cursor-pointer gap-1.5 rounded-xl sm:flex-initial"
              >
                <X className="size-4" />
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => setIsBulkStatusDialogOpen(true)}
                className="btn-gradient-auth h-9 flex-1 cursor-pointer gap-1.5 rounded-xl font-semibold sm:flex-initial"
              >
                <TrendUp className="size-4" weight="bold" />
                Status ({selectedLeadsCount})
              </Button>
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Lista de leads: cards no mobile, tabela no desktop ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card overflow-hidden rounded-3xl">
          {/* Cabeçalho da lista */}
          <div className="border-border/60 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-sm font-bold">Lista de Leads</p>
              <p className="text-muted-foreground text-xs">
                {tableData.length} lead(s) encontrado(s)
              </p>
            </div>
            {isFilterLoading && (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                <CircleNotch className="size-3.5 animate-spin" />
                Atualizando...
              </span>
            )}
          </div>

          {/* ===== Visão mobile em cards ===== */}
          <div className="block space-y-3 p-3.5 sm:p-4 lg:hidden">
            {/* Selecionar todos da página */}
            {!isFilterLoading && table.getRowModel().rows.length > 0 && (
              <div className="border-border/60 bg-muted/30 flex items-center justify-between gap-2 rounded-2xl border p-3">
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    checked={
                      table.getIsAllPageRowsSelected() ||
                      (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) =>
                      table.toggleAllPageRowsSelected(Boolean(value))
                    }
                    aria-label="Selecionar todos da página"
                    className="cursor-pointer"
                  />
                  <span className="text-muted-foreground text-sm">
                    Selecionar todos da página
                  </span>
                </div>
                {hasSelection && (
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {selectedLeadsCount} selecionado{plural}
                  </Badge>
                )}
              </div>
            )}

            {isFilterLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <LeadCardSkeleton key={index} delay={index * 90} />
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const lead = row.original
                const statusCfg = STATUS_CONFIG[lead.status]
                const urgencyCfg = URGENCY_CONFIG[lead.urgency]
                const budgetCfg = BUDGET_CONFIG[lead.budget]
                const Icon = FOR_WHOM_CONFIG[lead.forWhom].icon
                const link = whatsappLink(lead.whatsapp)
                const networks = leadNetworks(lead)

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "border-border/60 bg-muted/20 space-y-3 rounded-2xl border p-4 transition-colors",
                      row.getIsSelected() &&
                        "border-brand-cyan/50 bg-brand-cyan/5 not-dark:border-primary/40 not-dark:bg-primary/5",
                    )}
                  >
                    {/* Checkbox + avatar + info + ações */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) =>
                            row.toggleSelected(Boolean(value))
                          }
                          aria-label="Selecionar lead"
                          className="shrink-0 cursor-pointer"
                        />
                        <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                          <Icon className="size-5" weight="fill" />
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="truncate text-sm font-semibold">
                            {lead.fullName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {lead.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 cursor-pointer rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
                          asChild
                        >
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ChatCircle className="size-4" weight="fill" />
                            <span className="sr-only">WhatsApp</span>
                          </a>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Abrir menu"
                              className="size-8 cursor-pointer rounded-lg"
                            >
                              <DotsThreeVertical
                                className="size-4"
                                weight="bold"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 rounded-xl"
                          >
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleView(lead)}
                            >
                              <Eye className="size-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleStatusChange(lead)}
                            >
                              <TrendUp className="size-4" />
                              Mudar Status
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-500 focus:text-red-500"
                              onClick={() =>
                                handleDelete(lead.id, lead.fullName)
                              }
                            >
                              <Trash className="size-4" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Status + redes */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "cursor-pointer gap-1.5 rounded-full text-xs transition-opacity hover:opacity-80",
                          statusCfg.badge,
                        )}
                        onClick={() => handleStatusChange(lead)}
                      >
                        <span
                          className={cn(
                            "size-1.5 animate-pulse rounded-full",
                            statusCfg.dot,
                          )}
                        />
                        {statusCfg.label}
                      </Badge>
                      {networks.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {networks.map((platform) => {
                            const config = platformConfig[platform]
                            const PlatformIcon = config.icon
                            return (
                              <span
                                key={platform}
                                className={cn(
                                  "inline-flex items-center justify-center rounded-lg p-1.5",
                                  config.bgColor,
                                  config.color,
                                )}
                              >
                                <PlatformIcon className="size-3.5" />
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Urgência / Orçamento */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/40 flex items-center gap-2 rounded-xl p-2.5">
                        <Clock
                          className={cn("size-4 shrink-0", urgencyCfg.text)}
                          weight="fill"
                        />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                            Urgência
                          </p>
                          <p
                            className={cn(
                              "truncate text-xs font-semibold",
                              urgencyCfg.text,
                            )}
                          >
                            {urgencyCfg.short}
                          </p>
                        </div>
                      </div>
                      <div className="bg-muted/40 flex items-center gap-2 rounded-xl p-2.5">
                        <CurrencyDollar
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          weight="bold"
                        />
                        <div className="min-w-0">
                          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                            Orçamento
                          </p>
                          <p className="truncate text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {budgetCfg.label}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Data */}
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                      <CalendarBlank className="size-3.5" />
                      {new Date(lead.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center gap-4 py-12 text-center">
                <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                  <Sparkle className="size-6" weight="fill" />
                </span>
                <div>
                  <p className="text-base font-bold">Nenhum lead encontrado</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Tente ajustar os filtros de busca
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ===== Visão desktop em tabela ===== */}
          <div className="hidden overflow-x-auto lg:block">
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
                {isFilterLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <LeadRowSkeleton
                      key={index}
                      delay={index * 90}
                      columnIds={table
                        .getVisibleLeafColumns()
                        .map((column) => column.id)}
                    />
                  ))
                ) : table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
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
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-16">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                          <Sparkle className="size-6" weight="fill" />
                        </span>
                        <div>
                          <p className="text-base font-bold">
                            Nenhum lead encontrado
                          </p>
                          <p className="text-muted-foreground mt-1 text-sm">
                            Tente ajustar os filtros de busca
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* ===== Paginação ===== */}
          <div className="border-border/60 flex flex-col items-center justify-between gap-3 border-t px-4 py-3.5 sm:flex-row">
            <p className="text-muted-foreground text-xs">
              {isFilterLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <CircleNotch className="size-3 animate-spin" />
                  Atualizando...
                </span>
              ) : (
                <>
                  Mostrando{" "}
                  {table.getFilteredRowModel().rows.length === 0
                    ? 0
                    : table.getState().pagination.pageIndex *
                        table.getState().pagination.pageSize +
                      1}{" "}
                  a{" "}
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) *
                      table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length,
                  )}{" "}
                  de {table.getFilteredRowModel().rows.length} leads
                </>
              )}
            </p>

            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      table.previousPage()
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl",
                      (!table.getCanPreviousPage() || isFilterLoading) &&
                        "pointer-events-none opacity-50",
                    )}
                  />
                </PaginationItem>

                {(() => {
                  const pageIndex = table.getState().pagination.pageIndex
                  const pageCount = table.getPageCount()
                  const pages: (number | "ellipsis")[] = []

                  if (pageCount <= 5) {
                    for (let i = 0; i < pageCount; i++) {
                      pages.push(i)
                    }
                  } else {
                    pages.push(0)

                    if (pageIndex > 2) {
                      pages.push("ellipsis")
                    }

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
                          onClick={(event) => {
                            event.preventDefault()
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
                  <span className="flex h-9 min-w-9 items-center justify-center px-3 text-sm font-medium">
                    {table.getState().pagination.pageIndex + 1} /{" "}
                    {table.getPageCount() || 1}
                  </span>
                </PaginationItem>

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      table.nextPage()
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl",
                      (!table.getCanNextPage() || isFilterLoading) &&
                        "pointer-events-none opacity-50",
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </Reveal>

      {/* ===== Dialogs ===== */}
      <ViewLeadDialog
        lead={selectedLead}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />

      <StatusChangeDialog
        lead={selectedLead}
        open={isStatusDialogOpen}
        onOpenChange={setIsStatusDialogOpen}
        onSubmit={(status, notes) => {
          if (selectedLead) {
            updateStatusMutation.mutate({
              id: selectedLead.id,
              status,
              notes,
            })
          }
        }}
        isLoading={updateStatusMutation.isPending}
      />

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o lead{" "}
              <strong>{leadToDelete?.fullName}</strong>? Esta ação não pode ser
              desfeita.
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
              className="cursor-pointer rounded-xl bg-red-500 text-white hover:bg-red-600"
            >
              {deleteMutation.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkStatusChangeDialog
        selectedCount={selectedLeadsCount}
        open={isBulkStatusDialogOpen}
        onOpenChange={setIsBulkStatusDialogOpen}
        onSubmit={(status) => {
          bulkUpdateStatusMutation.mutate({
            ids: selectedLeadIds,
            status,
          })
        }}
        isLoading={bulkUpdateStatusMutation.isPending}
      />
    </div>
  )
}

/* ===== Dialog: Ver Detalhes ===== */

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode
  title: string
}) {
  return (
    <h3 className="flex items-center gap-2 text-base font-bold">
      <span className="bg-gradient-custom flex size-7 items-center justify-center rounded-lg text-[#04222A]">
        {icon}
      </span>
      {title}
    </h3>
  )
}

function ViewLeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!lead) return null

  const Icon = FOR_WHOM_CONFIG[lead.forWhom].icon
  const statusCfg = STATUS_CONFIG[lead.status]
  const urgencyCfg = URGENCY_CONFIG[lead.urgency]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl">
            <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-full text-[#04222A] sm:size-12">
              <Icon className="size-5 sm:size-6" weight="fill" />
            </span>
            <span className="min-w-0 truncate text-left">{lead.fullName}</span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("gap-1.5 rounded-full", statusCfg.badge)}
              >
                <span
                  className={cn(
                    "size-1.5 animate-pulse rounded-full",
                    statusCfg.dot,
                  )}
                />
                {statusCfg.label}
              </Badge>
              <span className="text-muted-foreground">•</span>
              <span>
                {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Informações de Contato */}
          <div className="flex flex-col gap-3">
            <SectionTitle
              icon={<User className="size-3.5" weight="fill" />}
              title="Informações de Contato"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                <p className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
                  <Envelope className="size-4" />
                  E-mail
                </p>
                <p className="text-sm font-medium break-all">{lead.email}</p>
              </div>
              <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                <p className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
                  <Phone className="size-4" />
                  WhatsApp
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{lead.whatsapp}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 cursor-pointer gap-2 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
                    asChild
                  >
                    <a
                      href={whatsappLink(lead.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ChatCircle className="size-4" weight="fill" />
                      Abrir
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Redes Sociais */}
          <div className="flex flex-col gap-3">
            <SectionTitle
              icon={<Sparkle className="size-3.5" weight="fill" />}
              title="Redes Sociais"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {lead.instagramHandle && (
                <a
                  href={`https://instagram.com/${lead.instagramHandle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border/60 bg-muted/20 rounded-2xl border p-4 transition-colors hover:border-pink-500/50"
                >
                  <p className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
                    <platformConfig.INSTAGRAM.icon className="size-4 text-pink-400" />
                    Instagram
                  </p>
                  <p className="truncate text-sm font-medium">
                    {lead.instagramHandle}
                  </p>
                </a>
              )}
              {lead.tiktokHandle && (
                <a
                  href={`https://tiktok.com/@${lead.tiktokHandle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border/60 bg-muted/20 rounded-2xl border p-4 transition-colors hover:border-cyan-500/50"
                >
                  <p className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
                    <platformConfig.TIKTOK.icon className="size-4 text-cyan-400" />
                    TikTok
                  </p>
                  <p className="truncate text-sm font-medium">
                    {lead.tiktokHandle}
                  </p>
                </a>
              )}
              {lead.youtubeUrl && (
                <a
                  href={lead.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border/60 bg-muted/20 rounded-2xl border p-4 transition-colors hover:border-red-500/50"
                >
                  <p className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
                    <platformConfig.YOUTUBE.icon className="size-4 text-red-400" />
                    YouTube
                  </p>
                  <p className="truncate text-sm font-medium">
                    {lead.youtubeUrl}
                  </p>
                </a>
              )}
            </div>
          </div>

          <Separator />

          {/* Objetivos e Planejamento */}
          <div className="flex flex-col gap-3">
            <SectionTitle
              icon={<Target className="size-3.5" weight="fill" />}
              title="Objetivos e Planejamento"
            />
            <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
              <p className="text-muted-foreground mb-2 text-sm">Objetivos</p>
              <p className="text-sm leading-relaxed">{lead.objectives}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                <p className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                  <Clock
                    className={cn("size-4", urgencyCfg.text)}
                    weight="fill"
                  />
                  Urgência
                </p>
                <p className={cn("text-sm font-medium", urgencyCfg.text)}>
                  {urgencyCfg.label}
                </p>
              </div>
              <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                <p className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
                  <CurrencyDollar
                    className="size-4 text-emerald-600 dark:text-emerald-400"
                    weight="bold"
                  />
                  Orçamento
                </p>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {BUDGET_CONFIG[lead.budget].label}
                </p>
              </div>
            </div>
          </div>

          {/* Métricas de Sucesso */}
          {lead.successMetrics.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <SectionTitle
                  icon={<TrendUp className="size-3.5" weight="bold" />}
                  title="Métricas de Sucesso"
                />
                <div className="flex flex-wrap gap-2">
                  {lead.successMetrics.map((metric, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-brand-cyan/25 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/30 not-dark:bg-primary/10 not-dark:text-primary rounded-full"
                    >
                      {metric}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Experiência e Comentários */}
          {(lead.hasExperience || lead.additionalComments) && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <SectionTitle
                  icon={<ChatText className="size-3.5" weight="fill" />}
                  title="Informações Adicionais"
                />
                {lead.hasExperience && lead.experienceFeedback && (
                  <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                    <p className="text-muted-foreground mb-2 text-sm">
                      Experiência Prévia
                    </p>
                    <p className="text-sm leading-relaxed">
                      {lead.experienceFeedback}
                    </p>
                  </div>
                )}
                {lead.additionalComments && (
                  <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                    <p className="text-muted-foreground mb-2 text-sm">
                      Comentários Adicionais
                    </p>
                    <p className="text-sm leading-relaxed">
                      {lead.additionalComments}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notas Internas */}
          {lead.notes && (
            <>
              <Separator />
              <div className="flex flex-col gap-3">
                <SectionTitle
                  icon={<Eye className="size-3.5" weight="fill" />}
                  title="Notas Internas"
                />
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-sm leading-relaxed">{lead.notes}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ===== Dialog: Mudar Status ===== */

function StatusChangeDialog({
  lead,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (status: LeadStatus, notes?: string) => void
  isLoading: boolean
}) {
  const [selectedStatus, setSelectedStatus] =
    React.useState<LeadStatus>("PENDING")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (lead) {
      setSelectedStatus(lead.status)
      setNotes(lead.notes ?? "")
    }
  }, [lead])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit(selectedStatus, notes.trim() || undefined)
  }

  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendUp
              className="text-brand-mint not-dark:text-primary size-5"
              weight="bold"
            />
            Atualizar Status
          </DialogTitle>
          <DialogDescription>
            Atualize o status do lead {lead.fullName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) =>
                setSelectedStatus(value as LeadStatus)
              }
            >
              <SelectTrigger className="w-full cursor-pointer rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          STATUS_CONFIG[status].dot,
                        )}
                      />
                      {STATUS_CONFIG[status].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Adicione notas internas sobre este lead..."
              className="min-h-[100px] resize-none rounded-xl"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth flex-1 cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ===== Dialog: Status em Massa ===== */

function BulkStatusChangeDialog({
  selectedCount,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  selectedCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (status: LeadStatus) => void
  isLoading: boolean
}) {
  const [selectedStatus, setSelectedStatus] =
    React.useState<LeadStatus>("CONTACTED")

  const plural = selectedCount > 1 ? "s" : ""

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSubmit(selectedStatus)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-full text-[#04222A]">
              <UsersThree className="size-5" weight="fill" />
            </span>
            <span className="text-left">
              Alterar Status em Massa
              <span className="text-muted-foreground mt-1 block text-sm font-normal">
                {selectedCount} lead{plural} selecionado{plural}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Visual dos leads selecionados */}
        <div className="border-border/60 bg-muted/20 my-2 rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-center">
            <div className="flex -space-x-2">
              {Array.from({ length: Math.min(selectedCount, 5) }).map(
                (_, index) => (
                  <span
                    key={index}
                    className="bg-gradient-custom border-background flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold text-[#04222A]"
                  >
                    {index + 1}
                  </span>
                ),
              )}
              {selectedCount > 5 && (
                <span className="bg-muted border-background text-muted-foreground flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold">
                  +{selectedCount - 5}
                </span>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-center text-sm">
            O novo status será aplicado a{" "}
            <strong className="text-foreground">{selectedCount}</strong> lead
            {plural} simultaneamente
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Novo Status</Label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((status) => {
                const config = STATUS_CONFIG[status]
                const isSelected = selectedStatus === status
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                      isSelected
                        ? "border-brand-cyan/70 bg-brand-cyan/10 not-dark:border-primary not-dark:bg-primary/10"
                        : "border-border/50 bg-card hover:border-brand-cyan/40 hover:bg-muted/30 not-dark:hover:border-primary/50",
                    )}
                  >
                    <span
                      className={cn("size-3 rounded-full", config.dot)}
                    />
                    <span className="text-sm font-medium">{config.label}</span>
                    {isSelected && (
                      <span className="bg-gradient-custom ml-auto flex size-5 items-center justify-center rounded-md text-[#04222A]">
                        <Check className="size-3" weight="bold" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <Separator />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1 cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-gradient-auth flex-1 cursor-pointer rounded-xl font-semibold"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Atualizando {selectedCount}...
                </>
              ) : (
                <>
                  <Check className="size-4" weight="bold" />
                  Aplicar a {selectedCount} lead{plural}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
