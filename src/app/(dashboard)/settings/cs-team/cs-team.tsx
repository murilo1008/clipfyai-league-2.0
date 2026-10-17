"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowsDownUp,
  Buildings,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CheckCircle,
  CircleNotch,
  DotsThreeVertical,
  Envelope,
  Eye,
  EyeSlash,
  Headset,
  Key,
  LockKey,
  MagnifyingGlass,
  PencilSimple,
  Shield,
  ShieldCheck,
  Trash,
  UserGear,
  UserPlus,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  CsTeamHeroViz,
  CsTeamHeroVizSkeleton,
} from "@/components/cs/cs-hero-viz";
import { SegmentedFilter } from "@/components/cs/segmented-filter";
import { HomeHero } from "@/components/home/home-hero";
import { StatTile } from "@/components/home/stat-tile";
import { CsClientMultiSelect } from "@/components/settings/cs-client-multi-select";
import { Reveal } from "@/components/shared/reveal";
import {
  Bone,
  HeroSkeleton,
  StatTilesGridSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

export type CsUser = RouterOutputs["cs"]["admin"]["list"][number];
type AccessFilter = "all" | "unrestricted" | "restricted";

const STAGGER_MS = 55;

const ALL_BADGE_CLASS =
  "gap-1.5 rounded-full border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] font-semibold";
const RESTRICTED_BADGE_CLASS =
  "gap-1.5 rounded-full border-violet-500/35 bg-violet-500/12 font-semibold text-violet-600 dark:text-violet-400";

function displayName(user: Pick<CsUser, "name" | "email">) {
  return user.name || user.email.split("@")[0] || "CS";
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function clientLabel(client: CsUser["clients"][number]) {
  return client.company ?? client.name ?? client.email;
}

function staggerStyle(index: number): React.CSSProperties {
  return {
    animationDelay: `${Math.min(index, 12) * STAGGER_MS}ms`,
    animationFillMode: "both",
  };
}

/** Força simples de senha (0–4) só para orientar o admin; a regra real é do Clerk. */
function passwordScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 14 && score < 4) score++;
  return Math.min(4, score);
}

// ============================================================================
// Page
// ============================================================================
export default function CsTeam() {
  const utils = api.useUtils();

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const [filter, setFilter] = React.useState<AccessFilter>("all");

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CsUser | null>(null);
  const [passwordFor, setPasswordFor] = React.useState<CsUser | null>(null);
  const [deleting, setDeleting] = React.useState<CsUser | null>(null);

  const list = api.cs.admin.list.useQuery({ search: debouncedSearch });
  const stats = api.cs.admin.stats.useQuery();

  const invalidate = () => {
    void utils.cs.admin.list.invalidate();
    void utils.cs.admin.stats.invalidate();
  };

  const createMutation = api.cs.admin.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário de CS criado com sucesso!");
      invalidate();
      setIsAddOpen(false);
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao criar usuário de CS"),
  });
  const updateMutation = api.cs.admin.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário de CS atualizado!");
      invalidate();
      setEditing(null);
      setPasswordFor(null);
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao atualizar usuário de CS"),
  });
  const deleteMutation = api.cs.admin.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário de CS removido.");
      invalidate();
      setDeleting(null);
    },
    onError: (error) =>
      toast.error(error.message || "Erro ao remover usuário de CS"),
  });

  const users = React.useMemo(() => list.data ?? [], [list.data]);
  const counts = React.useMemo(
    () => ({
      all: users.length,
      unrestricted: users.filter((user) => user.allClients).length,
      restricted: users.filter((user) => !user.allClients).length,
    }),
    [users],
  );
  const filteredUsers = React.useMemo(
    () =>
      users.filter((user) =>
        filter === "all"
          ? true
          : filter === "unrestricted"
            ? user.allClients
            : !user.allClients,
      ),
    [users, filter],
  );

  const columns = React.useMemo(
    () =>
      createColumns({
        onEdit: setEditing,
        onPassword: setPasswordFor,
        onDelete: setDeleting,
      }),
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const table = useReactTable({
    data: filteredUsers,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    initialState: { pagination: { pageSize: 10 } },
  });
  const pageRows = table.getRowModel().rows;
  const isSearching = debouncedSearch.length > 0;
  const isFiltering = filter !== "all";

  if (list.isLoading && stats.isLoading && !list.data)
    return <CsTeamPageSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Configurações"
        title={
          <>
            A equipe de <span className="text-gradient">Customer Success</span>
          </>
        }
        subtitle="Usuários de CS enxergam e operam a conta dos clientes exatamente como o cliente, trocando de cliente pelo seletor no topo. Defina aqui quem tem acesso a quais clientes."
        isLoading={stats.isLoading}
        viz={<CsTeamHeroViz />}
        vizSkeleton={<CsTeamHeroVizSkeleton />}
        stats={[
          {
            icon: <Headset className="size-3.5" weight="fill" />,
            label: "Usuários CS",
            value: stats.data?.total ?? 0,
            kind: "int",
          },
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Acesso total",
            value: stats.data?.unrestricted ?? 0,
            kind: "int",
          },
          {
            icon: <LockKey className="size-3.5" weight="fill" />,
            label: "Acesso restrito",
            value: stats.data?.restricted ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          {
            icon: <Headset className="size-4" weight="fill" />,
            label: "Usuários CS",
            value: stats.data?.total ?? 0,
            hint: "contas de Customer Success",
            accent: "gradient" as const,
          },
          {
            icon: <UsersThree className="size-4" weight="fill" />,
            label: "Acesso total",
            value: stats.data?.unrestricted ?? 0,
            hint: "veem todos os clientes",
            accent: "cyan" as const,
          },
          {
            icon: <LockKey className="size-4" weight="fill" />,
            label: "Acesso restrito",
            value: stats.data?.restricted ?? 0,
            hint: "com lista de clientes",
            accent: "purple" as const,
          },
          {
            icon: <Buildings className="size-4" weight="fill" />,
            label: "Clientes elegíveis",
            value: stats.data?.eligibleClients ?? 0,
            hint: "com competição ativa ou concluída",
            accent: "green" as const,
          },
        ].map((tile, index) => (
          <Reveal key={tile.label} immediate delayMs={index * 70}>
            <StatTile
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
              kind="int"
              hint={tile.hint}
              accent={tile.accent}
              isLoading={stats.isLoading}
              className="h-full"
            />
          </Reveal>
        ))}
      </div>

      {/* ===== Toolbar ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar CS por nome ou e-mail..."
                aria-label="Buscar usuário de CS"
                className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl pr-10 pl-10"
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
            <Button
              onClick={() => setIsAddOpen(true)}
              className="btn-gradient-auth h-11 w-full cursor-pointer rounded-xl px-5 font-semibold lg:w-auto"
            >
              <UserPlus className="size-4" weight="bold" />
              Adicionar CS
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedFilter<AccessFilter>
              ariaLabel="Filtrar por tipo de acesso"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Todos", count: counts.all },
                {
                  value: "unrestricted",
                  label: "Acesso total",
                  count: counts.unrestricted,
                  icon: <UsersThree className="size-3.5" weight="fill" />,
                },
                {
                  value: "restricted",
                  label: "Restrito",
                  count: counts.restricted,
                  icon: <LockKey className="size-3.5" weight="fill" />,
                },
              ]}
            />
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {list.isFetching && !list.isLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <CircleNotch className="size-3 animate-spin" />
                  Atualizando…
                </span>
              ) : (
                `${filteredUsers.length} usuário${filteredUsers.length === 1 ? "" : "s"}${isSearching ? ` para “${debouncedSearch}”` : ""}`
              )}
            </p>
          </div>
        </div>
      </Reveal>

      {/* ===== Lista ===== */}
      <Reveal immediate delayMs={180}>
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
                {list.isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <CsRowSkeleton
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
                      <EmptyCsState
                        searching={isSearching}
                        filtered={isFiltering}
                        onAdd={() => setIsAddOpen(true)}
                        onClear={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      style={staggerStyle(index)}
                      className="border-border/40 hover:bg-muted/30 animate-fade-in-up transition-colors"
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
            {list.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <CsCardSkeleton key={index} delay={index * 120} />
              ))
            ) : pageRows.length === 0 ? (
              <EmptyCsState
                searching={isSearching}
                filtered={isFiltering}
                onAdd={() => setIsAddOpen(true)}
                onClear={() => {
                  setSearch("");
                  setFilter("all");
                }}
              />
            ) : (
              pageRows.map((row, index) => {
                const user = row.original;
                return (
                  <div
                    key={row.id}
                    style={staggerStyle(index)}
                    className="border-border/40 animate-fade-in-up flex flex-col gap-3 border-b p-4 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <UserIdentity user={user} />
                      <ActionsMenu
                        onEdit={() => setEditing(user)}
                        onPassword={() => setPasswordFor(user)}
                        onDelete={() => setDeleting(user)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AccessBadge user={user} />
                      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                        <CalendarBlank className="size-3.5" />
                        {formatDate(user.createdAt)}
                      </span>
                    </div>
                    {!user.allClients && <ClientsStack user={user} />}
                  </div>
                );
              })
            )}
          </div>

          {/* Paginação */}
          {filteredUsers.length > 0 && (
            <div className="border-border/60 flex flex-col items-center justify-between gap-3 border-t px-4 py-3.5 sm:flex-row">
              <p className="text-muted-foreground text-xs">
                {filteredUsers.length} usuário
                {filteredUsers.length === 1 ? "" : "s"} · Página{" "}
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
          )}
        </div>
      </Reveal>

      {/* ===== Dialogs ===== */}
      <AddCsDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        isLoading={createMutation.isPending}
        eligibleClients={stats.data?.eligibleClients ?? 0}
        onSubmit={(data) => createMutation.mutate(data)}
      />
      <EditCsDialog
        user={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        isLoading={updateMutation.isPending}
        eligibleClients={stats.data?.eligibleClients ?? 0}
        onSubmit={(data) =>
          editing && updateMutation.mutate({ id: editing.id, ...data })
        }
      />
      <PasswordDialog
        user={passwordFor}
        open={passwordFor !== null}
        onOpenChange={(open) => !open && setPasswordFor(null)}
        isLoading={updateMutation.isPending}
        onSubmit={(password) =>
          passwordFor && updateMutation.mutate({ id: passwordFor.id, password })
        }
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent className="rounded-3xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Warning className="size-5" weight="fill" />
              </span>
              Remover usuário de CS?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 pt-1 text-left">
                {deleting && (
                  <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
                    <CsAvatar user={deleting} className="size-10" />
                    <div className="min-w-0 leading-tight">
                      <p className="text-foreground truncate text-sm font-semibold">
                        {displayName(deleting)}
                      </p>
                      <p className="truncate text-xs">{deleting.email}</p>
                    </div>
                  </div>
                )}
                <ul className="space-y-1.5 text-sm">
                  <li className="flex gap-2">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red-400" />
                    Perde o acesso à plataforma imediatamente.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red-400" />
                    A conta é removida também do sistema de autenticação.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red-400" />
                    Os clientes não são afetados. Esta ação não pode ser
                    desfeita.
                  </li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (deleting) deleteMutation.mutate({ id: deleting.id });
              }}
              disabled={deleteMutation.isPending}
              className="cursor-pointer rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <Trash className="size-4" weight="bold" />
                  Remover
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Colunas
// ============================================================================
function SortHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
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
  );
}

function createColumns({
  onEdit,
  onPassword,
  onDelete,
}: {
  onEdit: (user: CsUser) => void;
  onPassword: (user: CsUser) => void;
  onDelete: (user: CsUser) => void;
}): ColumnDef<CsUser>[] {
  return [
    {
      id: "name",
      accessorFn: (row) => displayName(row).toLowerCase(),
      header: ({ column }) => (
        <SortHeader
          label="Usuário"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => <UserIdentity user={row.original} />,
    },
    {
      id: "access",
      accessorFn: (row) => (row.allClients ? 0 : 1),
      header: "Acesso",
      cell: ({ row }) => <AccessBadge user={row.original} />,
    },
    {
      id: "clients",
      accessorFn: (row) =>
        row.allClients ? Number.MAX_SAFE_INTEGER : row.clients.length,
      header: ({ column }) => (
        <SortHeader
          label="Clientes liberados"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) =>
        row.original.allClients ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <CheckCircle
              className="text-brand-mint not-dark:text-primary size-4"
              weight="fill"
            />
            Todos os clientes elegíveis
          </span>
        ) : (
          <ClientsStack user={row.original} />
        ),
    },
    {
      id: "createdAt",
      accessorFn: (row) => new Date(row.createdAt).getTime(),
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
            {formatDate(row.original.createdAt)}
          </span>
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ActionsMenu
            onEdit={() => onEdit(row.original)}
            onPassword={() => onPassword(row.original)}
            onDelete={() => onDelete(row.original)}
          />
        </div>
      ),
    },
  ];
}

// ============================================================================
// Peças
// ============================================================================
function CsAvatar({ user, className }: { user: CsUser; className?: string }) {
  return (
    <span className={cn("relative shrink-0", className)}>
      <Avatar className="ring-border size-full rounded-xl ring-1">
        <AvatarImage src={user.imageUrl ?? undefined} alt={displayName(user)} />
        <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
          {initialsOf(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <span className="bg-gradient-custom ring-background absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full text-[#04222A] ring-2">
        <Headset className="size-2.5" weight="fill" />
      </span>
    </span>
  );
}

function UserIdentity({ user }: { user: CsUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CsAvatar user={user} className="size-10" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold">{displayName(user)}</p>
        <p className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
          <Envelope className="size-3 shrink-0" />
          <span className="truncate">{user.email}</span>
        </p>
      </div>
    </div>
  );
}

function AccessBadge({ user }: { user: CsUser }) {
  return user.allClients ? (
    <Badge
      variant="outline"
      className={cn(ALL_BADGE_CLASS, "h-6 px-2.5 text-xs whitespace-nowrap")}
    >
      <UsersThree className="size-3.5" weight="fill" />
      Todos os clientes
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={cn(
        RESTRICTED_BADGE_CLASS,
        "h-6 px-2.5 text-xs whitespace-nowrap",
      )}
    >
      <LockKey className="size-3.5" weight="fill" />
      Restrito · {user.clients.length}
    </Badge>
  );
}

/** Avatares empilhados dos clientes liberados + nomes (truncados). */
function ClientsStack({ user }: { user: CsUser }) {
  const visible = user.clients.slice(0, 4);
  const rest = user.clients.length - visible.length;
  const names = user.clients.map(clientLabel);
  return (
    <div className="flex min-w-0 items-center gap-2.5" title={names.join(", ")}>
      <span className="flex shrink-0 -space-x-2">
        {visible.map((client) => (
          <Avatar
            key={client.id}
            className="ring-background size-7 rounded-lg ring-2"
          >
            <AvatarImage
              src={client.imageUrl ?? undefined}
              alt={clientLabel(client)}
            />
            <AvatarFallback className="bg-gradient-custom rounded-lg text-[9px] font-bold text-[#04222A]">
              {initialsOf(client.name, client.email)}
            </AvatarFallback>
          </Avatar>
        ))}
        {rest > 0 && (
          <span className="bg-muted text-foreground/80 ring-background flex size-7 items-center justify-center rounded-lg text-[10px] font-bold ring-2">
            +{rest}
          </span>
        )}
      </span>
      <span className="text-muted-foreground min-w-0 truncate text-xs">
        {names.slice(0, 2).join(", ")}
        {names.length > 2 ? ` e mais ${names.length - 2}` : ""}
      </span>
    </div>
  );
}

function ActionsMenu({
  onEdit,
  onPassword,
  onDelete,
}: {
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
}) {
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
      <DropdownMenuContent align="end" className="w-48 rounded-xl">
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <PencilSimple className="size-4" />
          Editar acesso
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPassword} className="cursor-pointer">
          <Key className="size-4" />
          Alterar senha
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={onDelete}
          className="cursor-pointer"
        >
          <Trash className="size-4" />
          Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyCsState({
  searching,
  filtered,
  onAdd,
  onClear,
}: {
  searching: boolean;
  filtered: boolean;
  onAdd: () => void;
  onClear: () => void;
}) {
  const narrowed = searching || filtered;
  return (
    <div className="relative flex flex-col items-center gap-4 overflow-hidden px-6 py-16 text-center">
      <span className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_18%,transparent),transparent_70%)] blur-2xl" />
      <span className="relative flex size-16 items-center justify-center">
        <span className="arena-ring absolute inset-0 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]" />
        <span className="bg-gradient-custom flex size-11 items-center justify-center rounded-2xl text-[#04222A]">
          <Headset className="size-5" weight="fill" />
        </span>
      </span>
      <div className="relative max-w-md">
        <p className="text-base font-bold">
          {narrowed
            ? "Nenhum usuário de CS encontrado"
            : "Nenhum usuário de CS ainda"}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {narrowed
            ? "Tente outro nome ou e-mail, ou limpe os filtros."
            : "Crie a primeira conta de Customer Success e escolha a quais clientes ela terá acesso."}
        </p>
      </div>
      <div className="relative flex flex-wrap justify-center gap-2">
        {narrowed && (
          <Button
            type="button"
            variant="outline"
            onClick={onClear}
            className="h-10 cursor-pointer rounded-xl"
          >
            <X className="size-4" />
            Limpar filtros
          </Button>
        )}
        <Button
          type="button"
          onClick={onAdd}
          className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-5 font-semibold"
        >
          <UserPlus className="size-4" weight="bold" />
          Adicionar CS
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Skeletons — espelham a tabela e os cards reais
// ============================================================================
function CsRowSkeleton({
  columnIds,
  delay,
}: {
  columnIds: string[];
  delay: number;
}) {
  return (
    <TableRow className="border-border/40 hover:bg-transparent">
      {columnIds.map((columnId, cellIndex) => {
        const cellDelay = delay + cellIndex * 60;
        return (
          <TableCell key={columnId} className="px-4 py-3.5 align-middle">
            {columnId === "name" ? (
              <div className="flex min-w-0 items-center gap-3">
                <Bone
                  delay={cellDelay}
                  className="size-10 shrink-0 rounded-xl"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Bone delay={cellDelay + 60} className="h-3.5 w-32" />
                  <Bone
                    delay={cellDelay + 120}
                    className="h-2.5 w-44 rounded-full"
                  />
                </div>
              </div>
            ) : columnId === "access" ? (
              <Bone delay={cellDelay} className="h-6 w-32 rounded-full" />
            ) : columnId === "clients" ? (
              <div className="flex items-center gap-2.5">
                <span className="flex -space-x-2">
                  {[0, 1, 2].map((avatar) => (
                    <Bone
                      key={avatar}
                      delay={cellDelay + avatar * 40}
                      className="size-7 rounded-lg"
                    />
                  ))}
                </span>
                <Bone
                  delay={cellDelay + 160}
                  className="h-3 w-28 rounded-full"
                />
              </div>
            ) : columnId === "actions" ? (
              <div className="flex justify-end">
                <Bone delay={cellDelay} className="size-8 rounded-lg" />
              </div>
            ) : (
              <Bone delay={cellDelay} className="h-4 w-24" />
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function CsCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className="border-border/40 flex flex-col gap-3 border-b p-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <Bone delay={delay} className="size-10 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Bone delay={delay + 60} className="h-3.5 w-2/5 max-w-36" />
          <Bone
            delay={delay + 120}
            className="h-2.5 w-3/5 max-w-48 rounded-full"
          />
        </div>
        <Bone delay={delay + 180} className="size-8 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Bone delay={delay + 240} className="h-6 w-32 rounded-full" />
        <Bone delay={delay + 300} className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="flex -space-x-2">
          {[0, 1, 2].map((avatar) => (
            <Bone
              key={avatar}
              delay={delay + 360 + avatar * 40}
              className="size-7 rounded-lg"
            />
          ))}
        </span>
        <Bone delay={delay + 480} className="h-3 w-32 rounded-full" />
      </div>
    </div>
  );
}

function CsTeamPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HeroSkeleton stats={3} viz={<CsTeamHeroVizSkeleton />} />
      <StatTilesGridSkeleton
        count={4}
        className="grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"
      />
      <ToolbarSkeleton buttons={1} />
      <TableSkeleton rows={5} />
    </div>
  );
}

// ============================================================================
// Dialogs
// ============================================================================
function DialogFrame({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl">
        <DialogHeader className="border-border/60 relative shrink-0 overflow-hidden border-b p-4 pr-12 text-left sm:p-6 sm:pr-14">
          <span className="pointer-events-none absolute -top-16 -right-10 size-44 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_20%,transparent),transparent_70%)] blur-2xl" />
          <div className="relative flex items-center gap-3.5">
            <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_12px_30px_-12px_var(--brand-cyan)]">
              {icon}
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold tracking-tight sm:text-lg">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {children}
        </div>
        <div className="border-border/60 bg-background/60 flex shrink-0 flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-gradient-custom flex size-6 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <h4 className="text-sm font-bold">{title}</h4>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
    </div>
  );
}

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  strength = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  strength?: boolean;
}) {
  const [show, setShow] = React.useState(false);
  const score = passwordScore(value);
  const labels = ["", "Fraca", "Razoável", "Boa", "Forte"];
  const tones = [
    "",
    "bg-red-400",
    "bg-amber-400",
    "bg-emerald-400",
    "bg-gradient-custom",
  ];
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-colors"
        >
          {show ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {strength && (
        <div className="flex items-center gap-2" aria-live="polite">
          <span className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  step <= score ? tones[score] : "bg-muted",
                )}
              />
            ))}
          </span>
          <span className="text-muted-foreground w-16 text-right text-[11px] font-semibold">
            {value ? labels[score] : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

function AccessSummary({
  count,
  eligibleClients,
}: {
  count: number;
  eligibleClients: number;
}) {
  const all = count === 0;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors",
        all
          ? "border-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_7%,transparent)]"
          : "border-violet-500/30 bg-violet-500/[0.07]",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          all
            ? "bg-gradient-custom text-[#04222A]"
            : "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        )}
      >
        {all ? (
          <ShieldCheck className="size-4.5" weight="fill" />
        ) : (
          <LockKey className="size-4.5" weight="fill" />
        )}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold">
          {all ? "Acesso total" : "Acesso restrito"}
        </p>
        <p className="text-muted-foreground text-xs">
          {all
            ? `Verá todos os clientes elegíveis (${eligibleClients} hoje).`
            : `Verá apenas ${count} cliente${count > 1 ? "s" : ""} selecionado${count > 1 ? "s" : ""}.`}
        </p>
      </div>
    </div>
  );
}

function AddCsDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  eligibleClients,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    clientIds: string[];
  }) => void;
  isLoading: boolean;
  eligibleClients: number;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [clientIds, setClientIds] = React.useState<string[]>([]);
  const formId = "add-cs-form";

  React.useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setPassword("");
      setClientIds([]);
    }
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return toast.error("Nome é obrigatório");
    if (!email.trim()) return toast.error("E-mail é obrigatório");
    if (password.length < 8)
      return toast.error("Senha deve ter no mínimo 8 caracteres");
    onSubmit({ name: name.trim(), email: email.trim(), password, clientIds });
  };

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      icon={<Headset className="size-5" weight="fill" />}
      title="Adicionar usuário de CS"
      description="A conta terá exatamente o acesso dos clientes liberados, trocando de cliente pelo seletor no topo da tela."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-11 cursor-pointer rounded-xl sm:h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isLoading}
            className="btn-gradient-auth h-11 cursor-pointer rounded-xl font-semibold sm:h-10"
          >
            {isLoading ? (
              <>
                <CircleNotch className="size-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <UserPlus className="size-4" weight="bold" />
                Criar usuário de CS
              </>
            )}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <SectionTitle
            icon={<UserGear className="size-3.5" weight="fill" />}
            title="Conta"
            hint="Dados de acesso do membro da equipe de CS"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="add-cs-name" className="text-sm font-semibold">
                Nome completo *
              </Label>
              <Input
                id="add-cs-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Maria Souza"
                className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-cs-email" className="text-sm font-semibold">
                E-mail *
              </Label>
              <Input
                id="add-cs-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="cs@clipfyai.com"
                className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
                autoComplete="off"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="add-cs-password"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Shield
                className="text-brand-cyan not-dark:text-primary size-4"
                weight="fill"
              />
              Senha *
            </Label>
            <PasswordField
              id="add-cs-password"
              value={password}
              onChange={setPassword}
              placeholder="Mínimo de 8 caracteres"
              autoComplete="new-password"
              strength
            />
            <p className="text-muted-foreground text-xs">
              Será usada no primeiro acesso. O CS pode trocá-la depois.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle
            icon={<UsersThree className="size-3.5" weight="fill" />}
            title="Clientes liberados"
            hint="Nenhum selecionado = acesso a todos os clientes elegíveis"
          />
          <CsClientMultiSelect
            id="add-cs-clients"
            value={clientIds}
            onChange={setClientIds}
            disabled={isLoading}
          />
          <AccessSummary
            count={clientIds.length}
            eligibleClients={eligibleClients}
          />
        </section>
      </form>
    </DialogFrame>
  );
}

function EditCsDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  eligibleClients,
}: {
  user: CsUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; clientIds: string[] }) => void;
  isLoading: boolean;
  eligibleClients: number;
}) {
  const [name, setName] = React.useState("");
  const [clientIds, setClientIds] = React.useState<string[]>([]);
  const formId = "edit-cs-form";

  React.useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setClientIds(user.clients.map((client) => client.id));
    }
  }, [user]);

  if (!user) return null;

  const dirty =
    name.trim() !== (user.name ?? "") ||
    clientIds.length !== user.clients.length ||
    clientIds.some((id) => !user.clients.some((client) => client.id === id));

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      icon={<PencilSimple className="size-5" weight="fill" />}
      title={`Editar ${displayName(user)}`}
      description={user.email}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-11 cursor-pointer rounded-xl sm:h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isLoading || !dirty}
            className="btn-gradient-auth h-11 cursor-pointer rounded-xl font-semibold sm:h-10"
          >
            {isLoading ? (
              <>
                <CircleNotch className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return toast.error("Nome é obrigatório");
          onSubmit({ name: name.trim(), clientIds });
        }}
        className="flex flex-col gap-6"
      >
        <section className="flex flex-col gap-4">
          <SectionTitle
            icon={<UserGear className="size-3.5" weight="fill" />}
            title="Conta"
          />
          <div className="space-y-2">
            <Label htmlFor="edit-cs-name" className="text-sm font-semibold">
              Nome
            </Label>
            <Input
              id="edit-cs-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do usuário de CS"
              className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
              required
            />
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <SectionTitle
            icon={<UsersThree className="size-3.5" weight="fill" />}
            title="Clientes liberados"
            hint="Nenhum selecionado = acesso a todos os clientes elegíveis"
          />
          <CsClientMultiSelect
            id="edit-cs-clients"
            value={clientIds}
            onChange={setClientIds}
            disabled={isLoading}
          />
          <AccessSummary
            count={clientIds.length}
            eligibleClients={eligibleClients}
          />
        </section>
      </form>
    </DialogFrame>
  );
}

function PasswordDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: {
  user: CsUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const formId = "cs-password-form";

  React.useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirm("");
    }
  }, [open]);

  if (!user) return null;

  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      icon={<Key className="size-5" weight="fill" />}
      title="Alterar senha"
      description={`Defina uma nova senha para ${displayName(user)}.`}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-11 cursor-pointer rounded-xl sm:h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={isLoading || password.length < 8 || password !== confirm}
            className="btn-gradient-auth h-11 cursor-pointer rounded-xl font-semibold sm:h-10"
          >
            {isLoading ? (
              <>
                <CircleNotch className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar senha"
            )}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length < 8)
            return toast.error("Senha deve ter no mínimo 8 caracteres");
          if (password !== confirm)
            return toast.error("As senhas não coincidem");
          onSubmit(password);
        }}
        className="flex flex-col gap-5"
      >
        <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3">
          <CsAvatar user={user} className="size-10" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">
              {displayName(user)}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {user.email}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cs-new-password" className="text-sm font-semibold">
            Nova senha
          </Label>
          <PasswordField
            id="cs-new-password"
            value={password}
            onChange={setPassword}
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
            strength
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="cs-confirm-password"
            className="text-sm font-semibold"
          >
            Confirmar senha
          </Label>
          <PasswordField
            id="cs-confirm-password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
          />
          <p
            className={cn(
              "text-xs transition-colors",
              mismatch ? "text-red-500" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {mismatch
              ? "As senhas não coincidem."
              : confirm && confirm === password
                ? "Senhas conferem."
                : "Digite a mesma senha nos dois campos."}
          </p>
        </div>
      </form>
    </DialogFrame>
  );
}
