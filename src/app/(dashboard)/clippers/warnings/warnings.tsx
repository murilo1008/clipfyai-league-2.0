"use client";

import * as React from "react";
import Link from "next/link";
import type {
  ClipperInfractionType,
  ClipperWarningStatus,
} from "@prisma/client";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  ClipboardText,
  DotsThreeVertical,
  Eye,
  GearSix,
  Gavel,
  MagnifyingGlass,
  ShieldWarning,
  VideoCamera,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

import {
  ClippersHeroViz,
  ClippersHeroVizSkeleton,
} from "@/components/clippers/clippers-hero-viz";
import {
  DISCIPLINE_DISABLED_MESSAGE,
  InfractionTypeBadge,
  WarningStatusBadge,
  formatBrtDateTime,
  formatSanctionDuration,
  sanctionLabel,
  sanctionState,
  useNow,
} from "@/components/clippers/discipline-shared";
import { HomeHero } from "@/components/home/home-hero";
import { StatTile } from "@/components/home/stat-tile";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  INFRACTION_TYPE_LABELS,
  WARNING_STATUS_LABELS,
  warningLevelLabel,
} from "@/lib/clipper-discipline/levels";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DisciplineSettingsDialog } from "./settings-dialog";
import {
  RevokeWarningDialog,
  type RevokeWarningTarget,
} from "./revoke-warning-dialog";
import {
  BanReviewBadge,
  WarningDetailsDialog,
  clipperDisplayName,
  revokeTargetOf,
  type AdminWarning,
} from "./warning-details-dialog";

const PAGE_SIZE = 20;
const ALL = "ALL";
const NO_WARNINGS: AdminWarning[] = [];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Punições da advertência em badges curtas ("Suspensão 24 h", "Removido"). */
function SanctionChips({
  warning,
  now,
}: {
  warning: AdminWarning;
  now: Date;
}) {
  if (warning.sanctions.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1">
      {warning.sanctions.map((sanction) => {
        const state = sanctionState(sanction, now);
        const duration = formatSanctionDuration(
          sanction.startsAt,
          sanction.endsAt,
        );
        const label =
          sanction.type === "COMPETITION_REMOVAL"
            ? "Removido"
            : sanction.type === "POSTING_SUSPENSION"
              ? "Suspensão"
              : sanctionLabel(sanction);
        return (
          <Badge
            key={sanction.id}
            variant="outline"
            className={cn(
              "rounded-full text-[10px]",
              state === "active"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : "border-border bg-muted/40 text-muted-foreground",
              (state === "revoked" || state === "finished") && "line-through",
            )}
          >
            {label}
            {duration ? ` ${duration}` : ""}
          </Badge>
        );
      })}
    </div>
  );
}

function createColumns(
  now: Date,
  onView: (warning: AdminWarning) => void,
  onRevoke: (warning: AdminWarning) => void,
): ColumnDef<AdminWarning>[] {
  return [
    {
      id: "clipper",
      header: "Clipador",
      cell: ({ row }) => {
        const warning = row.original;
        const name = clipperDisplayName(warning.clipperProfile);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9 shrink-0 rounded-xl">
              <AvatarImage
                src={warning.clipperProfile.user.imageUrl ?? undefined}
                alt={name}
              />
              <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="max-w-[180px] truncate text-sm font-semibold">
                {name}
              </p>
              <p className="text-muted-foreground max-w-[180px] truncate text-xs">
                {warning.clipperProfile.user.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      id: "campaign",
      header: "Competição",
      cell: ({ row }) => (
        <span className="block max-w-[160px] truncate text-sm">
          {row.original.campaign?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "type",
      header: "Tipo",
      cell: ({ row }) => (
        <InfractionTypeBadge type={row.original.infractionType} />
      ),
    },
    {
      id: "level",
      header: "Nível",
      cell: ({ row }) => (
        <span className="text-sm font-medium whitespace-nowrap">
          {warningLevelLabel(row.original.infractionType, row.original.level)}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Motivo",
      cell: ({ row }) => (
        <p
          className="text-muted-foreground line-clamp-2 max-w-[220px] text-xs"
          title={row.original.reason}
        >
          {row.original.reason}
        </p>
      ),
    },
    {
      id: "sanctions",
      header: "Punições",
      cell: ({ row }) => <SanctionChips warning={row.original} now={now} />,
    },
    {
      id: "applied",
      header: "Aplicada em / por",
      cell: ({ row }) => (
        <div className="text-xs whitespace-nowrap">
          <p className="font-medium">
            {formatBrtDateTime(row.original.appliedAt)}
          </p>
          <p className="text-muted-foreground">
            {row.original.appliedByName ?? "—"}
          </p>
        </div>
      ),
    },
    {
      id: "expires",
      header: "Expira em",
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {row.original.effectiveStatus === "REVOKED"
            ? "—"
            : formatBrtDateTime(row.original.expiresAt)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <WarningStatusBadge status={row.original.effectiveStatus} />
          {row.original.banReviewStatus === "PENDING" &&
            row.original.status !== "REVOKED" && (
              <BanReviewBadge status="PENDING" />
            )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      cell: ({ row }) => (
        <WarningActions
          warning={row.original}
          onView={onView}
          onRevoke={onRevoke}
        />
      ),
    },
  ];
}

function WarningActions({
  warning,
  onView,
  onRevoke,
}: {
  warning: AdminWarning;
  onView: (warning: AdminWarning) => void;
  onRevoke: (warning: AdminWarning) => void;
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
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => onView(warning)}
        >
          <Eye className="size-4" />
          Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={warning.status === "REVOKED"}
          onClick={() => onRevoke(warning)}
        >
          <ArrowCounterClockwise className="size-4" />
          Revogar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Warnings() {
  const now = useNow(60_000);

  const [search, setSearch] = React.useState("");
  const [campaignFilter, setCampaignFilter] = React.useState(ALL);
  const [typeFilter, setTypeFilter] = React.useState<
    ClipperInfractionType | typeof ALL
  >(ALL);
  const [statusFilter, setStatusFilter] = React.useState<
    ClipperWarningStatus | typeof ALL
  >(ALL);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const filters = {
    search: debouncedSearch || undefined,
    campaignId: campaignFilter === ALL ? undefined : campaignFilter,
    infractionType: typeFilter === ALL ? undefined : typeFilter,
    status: statusFilter === ALL ? undefined : statusFilter,
  };

  // Filtro novo volta para a primeira página
  const listKey = JSON.stringify(filters);
  const [page, setPage] = React.useState({ key: listKey, index: 0 });
  const pageIndex = page.key === listKey ? page.index : 0;
  const goToPage = (index: number) => setPage({ key: listKey, index });

  const { data, isLoading } = api.clipperDiscipline.list.useQuery(
    { ...filters, page: pageIndex + 1, pageSize: PAGE_SIZE },
    { placeholderData: (prev) => prev },
  );
  const { data: campaigns } = api.clipperDiscipline.campaignOptions.useQuery();
  const { data: status } = api.clipperDiscipline.status.useQuery();

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (data && pageIndex > 0 && pageIndex >= pageCount) {
    goToPage(Math.max(pageCount - 1, 0));
  }

  const [detailsWarning, setDetailsWarning] =
    React.useState<AdminWarning | null>(null);
  const [revokeTarget, setRevokeTarget] =
    React.useState<RevokeWarningTarget | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  const openRevoke = (warning: AdminWarning) => {
    setDetailsWarning(null);
    setRevokeTarget(revokeTargetOf(warning));
  };

  const columns = React.useMemo(
    // openRevoke só usa setters estáveis
    () => createColumns(now, setDetailsWarning, openRevoke),
    [now],
  );

  const table = useReactTable({
    data: data?.items ?? NO_WARNINGS,
    columns,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const stats = data?.stats;
  const pendingReviews =
    (stats?.pendingBanReviews ?? 0) + (stats?.pendingObservationReviews ?? 0);
  const hasFilters =
    !!search ||
    campaignFilter !== ALL ||
    typeFilter !== ALL ||
    statusFilter !== ALL;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        eyebrow="Clipfy League · Clipadores"
        title={
          <>
            <span className="text-gradient">Advertências</span> dos clipadores
          </>
        }
        subtitle="Histórico de advertências e punições aplicadas, com filtros por clipador, competição, tipo e status. Para aplicar uma advertência, abra o perfil do clipador em Gerenciar."
        isLoading={isLoading}
        viz={<ClippersHeroViz />}
        vizSkeleton={<ClippersHeroVizSkeleton />}
        stats={[
          {
            icon: <ShieldWarning className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: stats?.active ?? 0,
            kind: "int",
          },
          {
            icon: <ClipboardText className="size-3.5" weight="fill" />,
            label: "Revisões pendentes",
            value: pendingReviews,
            kind: "int",
          },
          {
            icon: <Gavel className="size-3.5" weight="fill" />,
            label: "Registros no filtro",
            value: total,
            kind: "int",
          },
        ]}
      />

      {status && !status.enabled && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
          {DISCIPLINE_DISABLED_MESSAGE}. A consulta continua disponível.
        </div>
      )}

      {/* ===== Resumo ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            icon={<ShieldWarning className="size-4" weight="fill" />}
            label="Advertências ativas"
            value={stats?.active ?? 0}
            kind="int"
            hint="ainda não expiraram nem foram revogadas"
            accent="gradient"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Gavel className="size-4" weight="fill" />}
            label="Análises de ban"
            value={stats?.pendingBanReviews ?? 0}
            kind="int"
            hint="infrações graves aguardando decisão"
            accent="cyan"
            isLoading={isLoading}
          />
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Vídeos em observação"
            value={stats?.pendingObservationReviews ?? 0}
            kind="int"
            hint="aguardando aprovação manual"
            accent="green"
            isLoading={isLoading}
          />
        </div>
      </Reveal>

      {/* ===== Toolbar ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar clipador por nome ou e-mail..."
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
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-48">
                <SelectValue placeholder="Competição" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={ALL}>Todas as competições</SelectItem>
                {(campaigns ?? []).map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as ClipperInfractionType | typeof ALL)
              }
            >
              <SelectTrigger className="h-10 w-[calc(50%-5px)] cursor-pointer rounded-xl sm:w-36">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={ALL}>Todos os tipos</SelectItem>
                {(["LIGHT", "MEDIUM", "SEVERE"] as const).map((type) => (
                  <SelectItem key={type} value={type}>
                    {INFRACTION_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ClipperWarningStatus | typeof ALL)
              }
            >
              <SelectTrigger className="h-10 w-[calc(50%-5px)] cursor-pointer rounded-xl sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value={ALL}>Todos os status</SelectItem>
                {(["ACTIVE", "EXPIRED", "REVOKED"] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {WARNING_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              asChild
              variant="outline"
              className="h-10 cursor-pointer rounded-xl"
            >
              <Link href="/clippers/warnings/review">
                <ClipboardText className="size-4" weight="fill" />
                Revisões
                {pendingReviews > 0 && (
                  <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A]">
                    {pendingReviews}
                  </Badge>
                )}
              </Link>
            </Button>

            <Button
              variant="outline"
              className="h-10 cursor-pointer rounded-xl"
              onClick={() => setIsSettingsOpen(true)}
            >
              <GearSix className="size-4" weight="fill" />
              Configurações
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Lista ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card overflow-hidden rounded-3xl">
          <div className="border-border/60 border-b px-4 py-3.5 text-right">
            <p className="text-muted-foreground text-xs">
              <span className="text-foreground font-semibold">{total}</span>{" "}
              {total === 1 ? "advertência" : "advertências"}
            </p>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-3 p-3.5 lg:hidden">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Bone
                  key={index}
                  delay={index * 80}
                  className="h-32 w-full rounded-2xl"
                />
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <EmptyWarnings filtered={hasFilters} />
            ) : (
              table.getRowModel().rows.map((row) => {
                const warning = row.original;
                return (
                  <article
                    key={row.id}
                    className="border-border/60 bg-muted/10 flex flex-col gap-2.5 rounded-2xl border p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {clipperDisplayName(warning.clipperProfile)}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {warning.campaign?.name ?? "Sem competição"} ·{" "}
                          {formatBrtDateTime(warning.appliedAt)}
                        </p>
                      </div>
                      <WarningActions
                        warning={warning}
                        onView={setDetailsWarning}
                        onRevoke={openRevoke}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <InfractionTypeBadge type={warning.infractionType} />
                      <Badge variant="outline" className="rounded-full">
                        {warningLevelLabel(
                          warning.infractionType,
                          warning.level,
                        )}
                      </Badge>
                      <WarningStatusBadge status={warning.effectiveStatus} />
                    </div>
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {warning.reason}
                    </p>
                    <SanctionChips warning={warning} now={now} />
                  </article>
                );
              })
            )}
          </div>

          {/* Desktop: tabela */}
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
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <TableRow
                      key={index}
                      className="border-border/40 hover:bg-transparent"
                    >
                      {columns.map((column, cellIndex) => (
                        <TableCell
                          key={column.id ?? cellIndex}
                          className="px-4 py-3.5"
                        >
                          <Bone
                            delay={index * 90 + cellIndex * 40}
                            className="h-4 w-20"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-16">
                      <EmptyWarnings filtered={hasFilters} />
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setDetailsWarning(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className="px-4 py-3.5 align-middle"
                          onClick={
                            cell.column.id === "actions"
                              ? (event) => event.stopPropagation()
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
              Página{" "}
              <span className="text-foreground font-semibold">
                {pageIndex + 1}
              </span>{" "}
              de {Math.max(pageCount, 1)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => goToPage(pageIndex - 1)}
                disabled={pageIndex === 0}
              >
                <CaretLeft className="size-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 cursor-pointer rounded-xl"
                onClick={() => goToPage(pageIndex + 1)}
                disabled={pageIndex + 1 >= pageCount}
              >
                Próxima
                <CaretRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Reveal>

      <WarningDetailsDialog
        warning={detailsWarning}
        open={!!detailsWarning}
        onOpenChange={(open) => {
          if (!open) setDetailsWarning(null);
        }}
        onRevoke={openRevoke}
      />
      <RevokeWarningDialog
        warning={revokeTarget}
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      />
      <DisciplineSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
      />
    </div>
  );
}

function EmptyWarnings({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
      <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
        <ShieldWarning className="size-6" weight="fill" />
      </span>
      <div>
        <p className="text-sm font-bold">Nenhuma advertência encontrada</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {filtered
            ? "Tente ajustar os filtros"
            : "As advertências aplicadas aparecem aqui"}
        </p>
      </div>
    </div>
  );
}
