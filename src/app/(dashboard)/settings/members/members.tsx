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
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CircleNotch,
  Crown,
  DotsThreeVertical,
  Envelope,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Megaphone,
  PencilSimple,
  Shield,
  SlidersHorizontal,
  Trash,
  UserGear,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { MembersHeroViz, MembersHeroVizSkeleton } from "@/components/settings/members-hero-viz"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  HeroSkeleton,
  StatTilesGridSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import type { RouterOutputs } from "@/trpc/react"

export type Member = RouterOutputs["admin"]["users"]["list"]["users"][number]

const ROLE_BADGE_CLASS =
  "gap-1.5 rounded-full border-purple-500/30 bg-purple-500/15 font-semibold text-purple-600 dark:text-purple-400"

const COLUMN_LABELS: Record<string, string> = {
  name: "Membro",
  role: "Função",
  organizations: "Organizações",
  createdCampaigns: "Campanhas",
  createdAt: "Cadastro",
}

function memberDisplayName(member: Member) {
  return member.name || member.email.split("@")[0] || "Admin"
}

function memberInitials(member: Member) {
  return memberDisplayName(member)
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatMemberDate(value: Member["createdAt"]) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
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

function MemberAvatar({
  member,
  className,
}: {
  member: Member
  className?: string
}) {
  return (
    <Avatar className={cn("size-10 shrink-0 rounded-xl", className)}>
      <AvatarImage
        src={member.imageUrl ?? undefined}
        alt={memberDisplayName(member)}
      />
      <AvatarFallback className="rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 text-xs font-bold text-white">
        {memberInitials(member)}
      </AvatarFallback>
    </Avatar>
  )
}

function RoleBadge() {
  return (
    <Badge variant="outline" className={cn(ROLE_BADGE_CLASS, "whitespace-nowrap")}>
      <Crown className="size-3" weight="fill" />
      Admin Clipfy
    </Badge>
  )
}

function OrganizationsBadge({ member }: { member: Member }) {
  const orgCount = member.organizations.length
  if (orgCount === 0) {
    return <span className="text-muted-foreground text-sm">Nenhuma</span>
  }
  return (
    <Badge variant="secondary" className="gap-1 rounded-full">
      <UsersThree className="size-3" />
      {orgCount} {orgCount === 1 ? "organização" : "organizações"}
    </Badge>
  )
}

function MemberActionsMenu({
  member,
  onEdit,
  onDelete,
}: {
  member: Member
  onEdit: (member: Member) => void
  onDelete: (id: string, email: string) => void
}) {
  return (
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
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onEdit(member)}
        >
          <PencilSimple className="size-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-500 focus:text-red-500"
          onClick={() => onDelete(member.id, member.email)}
        >
          <Trash className="size-4" />
          Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function createColumns(
  onEdit: (member: Member) => void,
  onDelete: (id: string, email: string) => void,
): ColumnDef<Member>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortHeader
          label="Membro"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => {
        const member = row.original
        return (
          <div className="flex min-w-0 items-center gap-3">
            <MemberAvatar member={member} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {memberDisplayName(member)}
              </span>
              <span className="text-muted-foreground truncate text-xs">
                {member.email}
              </span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: "Função",
      cell: () => <RoleBadge />,
    },
    {
      accessorKey: "organizations",
      header: "Organizações",
      cell: ({ row }) => <OrganizationsBadge member={row.original} />,
    },
    {
      id: "createdCampaigns",
      // accessorFn para a ordenação funcionar de verdade (o accessorKey
      // "createdCampaigns" do original não existia no objeto raiz).
      accessorFn: (row) => row._count.createdCampaigns,
      header: ({ column }) => (
        <SortHeader
          label="Campanhas"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ getValue }) => (
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-brand-mint not-dark:text-primary text-sm font-semibold tabular-nums">
            {getValue<number>()}
          </span>
          <span className="text-muted-foreground text-xs">criadas</span>
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortHeader
          label="Cadastro"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <CalendarBlank className="text-muted-foreground size-4" />
          <span className="text-sm whitespace-nowrap">
            {formatMemberDate(row.original.createdAt)}
          </span>
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      enableHiding: false,
      cell: ({ row }) => (
        <MemberActionsMenu
          member={row.original}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ]
}

/** Linha fantasma da tabela — um TableCell por coluna visível. */
function MemberRowSkeleton({
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
            {columnId === "name" ? (
              <div className="flex min-w-0 items-center gap-3">
                <Bone delay={cellDelay} className="size-10 shrink-0 rounded-xl" />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Bone delay={cellDelay + 60} className="h-3.5 w-32" />
                  <Bone
                    delay={cellDelay + 120}
                    className="h-2.5 w-40 rounded-full"
                  />
                </div>
              </div>
            ) : columnId === "role" ? (
              <Bone delay={cellDelay} className="h-[22px] w-28 rounded-full" />
            ) : columnId === "organizations" ? (
              <Bone delay={cellDelay} className="h-[22px] w-24 rounded-full" />
            ) : columnId === "actions" ? (
              <Bone delay={cellDelay} className="size-8 rounded-lg" />
            ) : (
              <Bone delay={cellDelay} className="h-4 w-20" />
            )}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

/** Cartão fantasma da lista mobile. */
function MemberCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className="border-border/40 flex flex-col gap-3 border-b p-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <Bone delay={delay} className="size-10 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Bone delay={delay + 60} className="h-3.5 w-2/5 max-w-36" />
          <Bone delay={delay + 120} className="h-2.5 w-3/5 max-w-48 rounded-full" />
        </div>
        <Bone delay={delay + 180} className="size-8 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Bone delay={delay + 240} className="h-[22px] w-28 rounded-full" />
        <Bone delay={delay + 300} className="h-[22px] w-24 rounded-full" />
      </div>
      <Bone delay={delay + 360} className="h-3 w-44 rounded-full" />
    </div>
  )
}

/** Skeleton completo da página com o kit da marca. */
function MembersPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HeroSkeleton stats={3} viz={<MembersHeroVizSkeleton />} />
      <StatTilesGridSkeleton
        count={3}
        className="grid-cols-1 sm:grid-cols-3 xl:grid-cols-3"
      />
      <ToolbarSkeleton buttons={2} />
      <TableSkeleton rows={6} />
    </div>
  )
}

function EmptyMembersState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-13 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-500 dark:text-purple-400">
        <Crown className="size-6" weight="fill" />
      </span>
      <div>
        <p className="text-base font-bold">Nenhum administrador encontrado</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Tente ajustar sua busca ou adicione um novo admin
        </p>
      </div>
    </div>
  )
}

export default function Members() {
  const utils = api.useUtils()

  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")

  // Debounce de 300ms na busca — evita uma query por tecla digitada.
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timeout)
  }, [search])

  // Dialogs
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null)
  const [memberToDelete, setMemberToDelete] = React.useState<{
    id: string
    email: string
  } | null>(null)

  // Queries — sempre filtrando apenas ADMINS
  const { data: membersData, isLoading: loadingMembers } =
    api.admin.users.list.useQuery({
      page: 1,
      limit: 100,
      role: "ADMIN",
      ...(debouncedSearch && { search: debouncedSearch }),
    })

  const { data: stats, isLoading: loadingStats } =
    api.admin.users.stats.useQuery()

  // Invalida lista E stats — o original nunca atualizava os KPIs.
  const invalidate = () => {
    void utils.admin.users.list.invalidate()
    void utils.admin.users.stats.invalidate()
  }

  const createMutation = api.admin.users.createAdmin.useMutation({
    onSuccess: () => {
      toast.success("Administrador criado com sucesso!")
      invalidate()
      setIsAddDialogOpen(false)
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar administrador")
    },
  })

  const updateMutation = api.admin.users.update.useMutation({
    onSuccess: () => {
      toast.success("Membro atualizado com sucesso!")
      invalidate()
      setIsEditDialogOpen(false)
      setSelectedMember(null)
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar membro")
    },
  })

  const deleteMutation = api.admin.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Membro removido com sucesso!")
      invalidate()
      setIsDeleteDialogOpen(false)
      setMemberToDelete(null)
    },
    onError: (error) => {
      // O servidor bloqueia deletar a si mesmo ("Cannot delete yourself").
      toast.error(error.message || "Erro ao remover membro")
    },
  })

  const columns = React.useMemo(
    () =>
      createColumns(
        (member) => {
          setSelectedMember(member)
          setIsEditDialogOpen(true)
        },
        (id, email) => {
          setMemberToDelete({ id, email })
          setIsDeleteDialogOpen(true)
        },
      ),
    [],
  )

  const tableData: Member[] = React.useMemo(
    () => membersData?.users ?? [],
    [membersData],
  )

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})

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

  const confirmDelete = () => {
    if (memberToDelete) {
      deleteMutation.mutate({ id: memberToDelete.id })
    }
  }

  const totalAdmins = stats?.byRole?.ADMIN ?? 0
  const pageRows = table.getRowModel().rows

  // Skeleton completo apenas no primeiro carregamento; buscas seguintes
  // trocam só as linhas por fantasmas (sem flash de página inteira).
  if (loadingStats && loadingMembers && !membersData) {
    return <MembersPageSkeleton />
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero dos admins ===== */}
      <HomeHero
        eyebrow="Clipfy League · Configurações"
        title={
          <>
            Os <span className="text-gradient">admins</span> da Clipfy
          </>
        }
        subtitle="Gerencie todos os administradores da plataforma Clipfy"
        isLoading={loadingStats}
        viz={<MembersHeroViz />}
        vizSkeleton={<MembersHeroVizSkeleton />}
        stats={[
          {
            icon: <Crown className="size-3.5" weight="fill" />,
            label: "Admins",
            value: totalAdmins,
            kind: "int",
          },
          {
            icon: <UserPlus className="size-3.5" weight="fill" />,
            label: "Novos (30d)",
            value: stats?.recentSignups ?? 0,
            kind: "int",
          },
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Total plataforma",
            value: stats?.total ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<Crown className="size-4" weight="fill" />}
            label="Total de Admins"
            value={totalAdmins}
            kind="int"
            hint="administradores ativos"
            accent="purple"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<UserPlus className="size-4" weight="fill" />}
            label="Novos (30 dias)"
            value={stats?.recentSignups ?? 0}
            kind="int"
            hint="cadastros recentes"
            accent="cyan"
            isLoading={loadingStats}
          />
          <StatTile
            icon={<UsersThree className="size-4" weight="fill" />}
            label="Total Plataforma"
            value={stats?.total ?? 0}
            kind="int"
            hint="todos os usuários"
            accent="green"
            isLoading={loadingStats}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar: busca, colunas, adicionar ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar admin por nome ou email..."
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
              onClick={() => setIsAddDialogOpen(true)}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <UserPlus className="size-4" weight="bold" />
              Adicionar Admin
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Lista de administradores ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card overflow-hidden rounded-3xl">
          {/* Tabela (lg+) */}
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
                {loadingMembers ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <MemberRowSkeleton
                      key={index}
                      delay={index * 90}
                      columnIds={table
                        .getVisibleLeafColumns()
                        .map((column) => column.id)}
                    />
                  ))
                ) : pageRows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length}>
                      <EmptyMembersState />
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => (
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

          {/* Cards (mobile/tablet) */}
          <div className="block lg:hidden">
            {loadingMembers ? (
              Array.from({ length: 4 }).map((_, index) => (
                <MemberCardSkeleton key={index} delay={index * 120} />
              ))
            ) : pageRows.length === 0 ? (
              <EmptyMembersState />
            ) : (
              pageRows.map((row) => {
                const member = row.original
                return (
                  <div
                    key={row.id}
                    className="border-border/40 flex flex-col gap-3 border-b p-4 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <MemberAvatar member={member} />
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-semibold">
                            {memberDisplayName(member)}
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {member.email}
                          </span>
                        </div>
                      </div>
                      <MemberActionsMenu
                        member={member}
                        onEdit={(m) => {
                          setSelectedMember(m)
                          setIsEditDialogOpen(true)
                        }}
                        onDelete={(id, email) => {
                          setMemberToDelete({ id, email })
                          setIsDeleteDialogOpen(true)
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge />
                      <OrganizationsBadge member={member} />
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <Megaphone className="size-3.5" />
                        {member._count.createdCampaigns}{" "}
                        {member._count.createdCampaigns === 1
                          ? "campanha criada"
                          : "campanhas criadas"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarBlank className="size-3.5" />
                        {formatMemberDate(member.createdAt)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Paginação */}
          <div className="border-border/60 flex flex-col items-center justify-between gap-3 border-t px-4 py-3.5 sm:flex-row">
            <p className="text-muted-foreground text-xs">
              {table.getFilteredRowModel().rows.length} admin(s) · Página{" "}
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

      {/* Add Member Dialog */}
      <AddMemberDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Member Dialog */}
      <EditMemberDialog
        member={selectedMember}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={(data) => {
          if (selectedMember) {
            updateMutation.mutate({ id: selectedMember.id, data })
          }
        }}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o membro{" "}
              <strong>{memberToDelete?.email}</strong>? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 text-white hover:bg-red-600"
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
    </div>
  )
}

// ============================================================================
// Add Member Dialog
// ============================================================================
// NOTA: o campo de foto de perfil do original foi REMOVIDO — ele criava um
// blob URL local (URL.createObjectURL) e persistia esse blob no banco, que
// quebra após reload. Não existe endpoint de avatar em src/server/uploadthing.ts
// para um upload real, então o campo foi retirado em vez de persistir um
// blob quebrado.
function AddMemberDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { email: string; password: string; name?: string }) => void
  isLoading: boolean
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error("E-mail é obrigatório")
      return
    }
    if (!password.trim()) {
      toast.error("Senha é obrigatória")
      return
    }
    if (password.length < 8) {
      toast.error("Senha deve ter no mínimo 8 caracteres")
      return
    }

    onSubmit({
      email: email.trim(),
      password: password.trim(),
      ...(name.trim() && { name: name.trim() }),
    })
  }

  const handleClose = () => {
    setName("")
    setEmail("")
    setPassword("")
    setShowPassword(false)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500">
              <UserPlus className="size-5 text-white" weight="fill" />
            </span>
            <span>Adicionar Novo Administrador</span>
          </DialogTitle>
          <DialogDescription>
            Crie um novo administrador com controle total do sistema Clipfy
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* E-mail */}
          <div className="space-y-2">
            <Label
              htmlFor="add-admin-email"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Envelope className="size-4 text-purple-400" weight="fill" />
              E-mail *
            </Label>
            <Input
              id="add-admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@clipfy.ai"
              className="h-11 rounded-xl"
              required
            />
            <p className="text-muted-foreground text-xs">
              E-mail do administrador (obrigatório)
            </p>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label
              htmlFor="add-admin-password"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Shield className="size-4 text-purple-400" weight="fill" />
              Senha *
            </Label>
            <div className="relative">
              <Input
                id="add-admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite uma senha forte"
                className="h-11 rounded-xl pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                {showPassword ? (
                  <EyeSlash className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p className="text-muted-foreground text-xs">
              Mínimo de 8 caracteres (será usada no primeiro acesso)
            </p>
          </div>

          {/* Nome */}
          <div className="space-y-2">
            <Label
              htmlFor="add-admin-name"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <UserGear className="size-4 text-purple-400" weight="fill" />
              Nome Completo
            </Label>
            <Input
              id="add-admin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              className="h-11 rounded-xl"
            />
            <p className="text-muted-foreground text-xs">
              Nome do administrador (opcional)
            </p>
          </div>

          {/* Função (readonly) */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Função</Label>
            <div className="flex items-center gap-3 rounded-xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500">
                <Crown className="size-5 text-white" weight="fill" />
              </span>
              <div className="flex-1">
                <div className="font-semibold text-purple-600 dark:text-purple-400">
                  Admin Clipfy
                </div>
                <div className="text-muted-foreground text-xs">
                  Controle total do sistema e todas as funcionalidades
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full cursor-pointer rounded-xl sm:w-auto"
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
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" weight="bold" />
                  Criar Administrador
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Edit Member Dialog
// ============================================================================
function EditMemberDialog({
  member,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  member: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name?: string; email?: string; role: "ADMIN" }) => void
  isLoading: boolean
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")

  React.useEffect(() => {
    if (member) {
      setName(member.name ?? "")
      setEmail(member.email)
    }
  }, [member])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...(name && { name }),
      ...(email && { email }),
      role: "ADMIN", // Sempre ADMIN
    })
  }

  if (!member) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-purple-400" weight="fill" />
            Editar Administrador
          </DialogTitle>
          <DialogDescription>
            Atualize as informações do administrador
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-admin-name">Nome</Label>
            <Input
              id="edit-admin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do administrador"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-admin-email">E-mail</Label>
            <Input
              id="edit-admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <div className="flex items-center gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
              <Crown className="size-5 text-purple-400" weight="fill" />
              <div>
                <div className="font-semibold text-purple-600 dark:text-purple-400">
                  Admin Clipfy
                </div>
                <div className="text-muted-foreground text-xs">
                  Controle total do sistema
                </div>
              </div>
            </div>
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
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
