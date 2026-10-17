"use client";

import * as React from "react";
import {
  ArrowRight,
  ArrowsDownUp,
  Buildings,
  CheckCircle,
  CircleNotch,
  Envelope,
  Eye,
  MagnifyingGlass,
  Trophy,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  CsPickerHeroViz,
  CsPickerHeroVizSkeleton,
} from "@/components/cs/cs-hero-viz";
import { SegmentedFilter } from "@/components/cs/segmented-filter";
import { HomeHero } from "@/components/home/home-hero";
import { Reveal } from "@/components/shared/reveal";
import {
  Bone,
  HeroSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSelectCsClient } from "@/hooks/use-cs-view";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { clearCsClient } from "@/server/cs-view/actions";
import { api, type RouterOutputs } from "@/trpc/react";

type ViewableClient = RouterOutputs["cs"]["view"]["clients"][number];
type Filter = "all" | "active" | "completed";
type Sort = "active" | "name" | "campaigns";

const GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Home do usuário Customer Success SEM cliente selecionado: escolha de cliente.
 * Com um cliente selecionado, a home renderiza `HomeClient` (a mesma do cliente).
 */
export default function HomeCs({ stale }: { stale: boolean }) {
  const utils = api.useUtils();
  const { select, pendingId } = useSelectCsClient();

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [sort, setSort] = React.useState<Sort>("active");
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const clients = api.cs.view.clients.useQuery({ search: debouncedSearch });
  const list = React.useMemo(() => clients.data ?? [], [clients.data]);
  const isSearching = debouncedSearch.length > 0;

  // Cookie obsoleto: limpa uma única vez e atualiza o usuário atual no cache.
  const clearedStaleRef = React.useRef(false);
  React.useEffect(() => {
    if (!stale || clearedStaleRef.current) return;
    clearedStaleRef.current = true;
    void clearCsClient()
      .catch(() => undefined)
      .then(() => utils.user.getCurrentUser.invalidate());
  }, [stale, utils]);

  // Exatamente um cliente disponível → entra direto nele.
  const autoSelectedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoSelectedRef.current || stale || isSearching) return;
    if (!clients.isSuccess || list.length !== 1) return;
    const only = list[0]!;
    autoSelectedRef.current = true;
    toast.info(`Abrindo ${only.company ?? only.name ?? only.email}…`);
    void select(only.id);
  }, [clients.isSuccess, list, stale, isSearching, select]);

  const counts = React.useMemo(
    () => ({
      all: list.length,
      active: list.filter((client) => client.activeCampaigns > 0).length,
      completed: list.filter(
        (client) =>
          client.activeCampaigns === 0 && client.completedCampaigns > 0,
      ).length,
    }),
    [list],
  );

  const totals = React.useMemo(
    () =>
      list.reduce(
        (acc, client) => ({
          active: acc.active + client.activeCampaigns,
          completed: acc.completed + client.completedCampaigns,
        }),
        { active: 0, completed: 0 },
      ),
    [list],
  );

  const visible = React.useMemo(() => {
    const filtered = list.filter((client) => {
      if (filter === "active") return client.activeCampaigns > 0;
      if (filter === "completed")
        return client.activeCampaigns === 0 && client.completedCampaigns > 0;
      return true;
    });
    const byName = (a: ViewableClient, b: ViewableClient) =>
      (a.company ?? a.name ?? a.email).localeCompare(
        b.company ?? b.name ?? b.email,
        "pt-BR",
      );
    return [...filtered].sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "campaigns")
        return b.eligibleCampaigns - a.eligibleCampaigns || byName(a, b);
      return (
        b.activeCampaigns - a.activeCampaigns ||
        b.completedCampaigns - a.completedCampaigns ||
        byName(a, b)
      );
    });
  }, [list, filter, sort]);

  if (clients.isLoading && !clients.data) return <HomeCsSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        eyebrow="Clipfy League · Customer Success"
        title={
          <>
            Selecione um <span className="text-gradient">cliente</span> para
            visualizar
          </>
        }
        subtitle="Você verá e operará a conta exatamente como o cliente. A única diferença é o seletor no topo da tela, para trocar de cliente quando quiser."
        isLoading={clients.isFetching && !clients.data}
        viz={<CsPickerHeroViz />}
        vizSkeleton={<CsPickerHeroVizSkeleton />}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clientes disponíveis",
            value: counts.all,
            kind: "int",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições ativas",
            value: totals.active,
            kind: "int",
          },
          {
            icon: <CheckCircle className="size-3.5" weight="fill" />,
            label: "Concluídas",
            value: totals.completed,
            kind: "int",
          },
        ]}
      />

      {stale && (
        <Reveal immediate>
          <div
            role="alert"
            className="relative flex items-start gap-3.5 overflow-hidden rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm sm:p-5"
          >
            <span className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-amber-400/15 blur-2xl" />
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Warning className="size-5" weight="fill" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold">
                O cliente que você estava visualizando não está mais disponível.
              </p>
              <p className="text-muted-foreground mt-0.5">
                O acesso pode ter sido alterado pelo administrador ou o cliente
                deixou de ter competições ativas ou concluídas. Escolha outro
                cliente abaixo.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Busca, filtros e ordenação ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-2.5 lg:w-72 lg:shrink-0">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <Eye className="size-4" weight="fill" />
              </span>
              <div className="min-w-0 leading-tight">
                <h2 className="text-sm font-bold">Visualizar como cliente</h2>
                <p className="text-muted-foreground truncate text-xs">
                  {isSearching
                    ? `${plural(visible.length, "resultado", "resultados")} para “${debouncedSearch}”`
                    : "Só clientes com competições ativas ou concluídas"}
                </p>
              </div>
            </div>
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, empresa ou e-mail…"
                aria-label="Buscar cliente"
                maxLength={100}
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
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedFilter<Filter>
              ariaLabel="Filtrar clientes"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "Todos", count: counts.all },
                {
                  value: "active",
                  label: "Com ativas",
                  count: counts.active,
                  icon: (
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                  ),
                },
                {
                  value: "completed",
                  label: "Só concluídas",
                  count: counts.completed,
                  icon: (
                    <span className="size-1.5 rounded-full bg-violet-400" />
                  ),
                },
              ]}
            />
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as Sort)}
            >
              <SelectTrigger
                aria-label="Ordenar clientes"
                className="h-9 w-full cursor-pointer rounded-xl sm:w-[190px]"
              >
                <span className="flex items-center gap-2">
                  <ArrowsDownUp className="text-muted-foreground size-3.5" />
                  <SelectValue placeholder="Ordenar" />
                </span>
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                <SelectItem value="active" className="cursor-pointer">
                  Mais ativas primeiro
                </SelectItem>
                <SelectItem value="campaigns" className="cursor-pointer">
                  Mais competições
                </SelectItem>
                <SelectItem value="name" className="cursor-pointer">
                  Nome (A–Z)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Reveal>

      {/* ===== Clientes ===== */}
      <Reveal immediate delayMs={120}>
        {clients.error ? (
          <ErrorState onRetry={() => void clients.refetch()} />
        ) : clients.isFetching && !clients.data ? (
          <ClientGridSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            searching={isSearching}
            filtered={filter !== "all" && list.length > 0}
            onClear={() => {
              setSearch("");
              setFilter("all");
            }}
          />
        ) : (
          <ul className={GRID_CLASS}>
            {visible.map((client, index) => (
              <li key={client.id} className="min-w-0">
                <ClientCard
                  client={client}
                  index={index}
                  pending={pendingId === client.id}
                  disabled={pendingId !== null}
                  onSelect={() => void select(client.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}

/* ============================================================
   Cartão de cliente
   ============================================================ */
function ClientCard({
  client,
  index,
  pending,
  disabled,
  onSelect,
}: {
  client: ViewableClient;
  index: number;
  pending: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const displayName = client.name ?? client.email;
  const headline = client.company ?? displayName;
  const hasActive = client.activeCampaigns > 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-busy={pending}
      aria-label={`Visualizar como ${headline}`}
      style={{ animationDelay: `${Math.min(index, 11) * 55}ms` }}
      className={cn(
        "glass-card glass-card-hover animate-fade-in-up group relative flex h-full w-full cursor-pointer flex-col rounded-3xl p-4 text-left transition-all sm:p-5",
        "focus-visible:ring-brand-cyan/50 focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        disabled && !pending && "cursor-not-allowed opacity-50",
        pending && "ring-brand-cyan/50 ring-2",
      )}
    >
      {/* brilho que acompanha o hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_70%)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative flex items-start gap-3.5">
        <span className="relative shrink-0">
          <span
            aria-hidden
            className="bg-gradient-custom absolute -inset-[2px] rounded-2xl opacity-40 blur-[3px] transition-opacity duration-300 group-hover:opacity-90"
          />
          <Avatar className="relative size-12 rounded-2xl ring-1 ring-white/20 sm:size-14">
            <AvatarImage src={client.imageUrl ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-gradient-custom rounded-2xl text-sm font-bold text-[#04222A] sm:text-base">
              {initialsOf(client.name, client.email)}
            </AvatarFallback>
          </Avatar>
        </span>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-bold tracking-tight sm:text-base">
            {headline}
          </p>
          {client.company && (
            <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs">
              <Buildings className="size-3 shrink-0" />
              <span className="truncate">{displayName}</span>
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs">
            <Envelope className="size-3 shrink-0" />
            <span className="truncate">{client.email}</span>
          </p>
        </div>

        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
            pending
              ? "bg-gradient-custom border-transparent text-[#04222A]"
              : "border-border/70 text-muted-foreground group-hover:bg-gradient-custom group-hover:border-transparent group-hover:text-[#04222A]",
          )}
        >
          {pending ? (
            <CircleNotch className="size-4 animate-spin" />
          ) : (
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
              weight="bold"
            />
          )}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <StatPill
          tone="emerald"
          icon={<Trophy className="size-3.5" weight="fill" />}
          value={client.activeCampaigns}
          label={client.activeCampaigns === 1 ? "ativa" : "ativas"}
          live={hasActive}
        />
        <StatPill
          tone="violet"
          icon={<CheckCircle className="size-3.5" weight="fill" />}
          value={client.completedCampaigns}
          label={client.completedCampaigns === 1 ? "concluída" : "concluídas"}
        />
      </div>

      <div className="relative mt-3.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 font-semibold">
          <Eye className="size-3.5" weight="fill" />
          {pending ? "Abrindo a conta…" : "Visualizar como cliente"}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-semibold",
            hasActive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-violet-600 dark:text-violet-400",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              hasActive
                ? "bg-emerald-400 shadow-[0_0_8px_var(--color-emerald-400)]"
                : "bg-violet-400",
            )}
          />
          {hasActive ? "Em competição" : "Histórico"}
        </span>
      </div>
    </button>
  );
}

function StatPill({
  tone,
  icon,
  value,
  label,
  live = false,
}: {
  tone: "emerald" | "violet";
  icon: React.ReactNode;
  value: number;
  label: string;
  live?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border px-3 py-2",
        tone === "emerald"
          ? "border-emerald-500/25 bg-emerald-500/[0.07]"
          : "border-violet-500/25 bg-violet-500/[0.07]",
      )}
    >
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-lg",
          tone === "emerald"
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        )}
      >
        {icon}
        {live && (
          <span className="absolute -top-0.5 -right-0.5 flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="text-base font-bold tabular-nums">{value}</span>
        <span className="text-muted-foreground mt-0.5 truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
      </span>
    </span>
  );
}

/* ============================================================
   Estados
   ============================================================ */
function EmptyState({
  searching,
  filtered,
  onClear,
}: {
  searching: boolean;
  filtered: boolean;
  onClear: () => void;
}) {
  const canClear = searching || filtered;
  return (
    <div className="glass-card relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-14 text-center">
      <span className="pointer-events-none absolute -top-20 left-1/2 size-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_18%,transparent),transparent_70%)] blur-2xl" />
      <span className="relative flex size-16 items-center justify-center">
        <span className="arena-ring absolute inset-0 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]" />
        <span className="bg-gradient-custom flex size-11 items-center justify-center rounded-2xl text-[#04222A]">
          <UsersThree className="size-5" weight="fill" />
        </span>
      </span>
      <div className="relative max-w-md">
        <p className="text-base font-bold">
          {canClear
            ? "Nenhum cliente encontrado"
            : "Nenhum cliente disponível ainda"}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {canClear
            ? "Tente outro nome, empresa ou e-mail, ou limpe os filtros."
            : "Peça ao administrador para liberar clientes com competições ativas ou concluídas para o seu usuário."}
        </p>
      </div>
      {canClear && (
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          className="relative h-10 cursor-pointer rounded-xl"
        >
          <X className="size-4" />
          Limpar busca e filtros
        </Button>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
        <Warning className="size-6" weight="fill" />
      </span>
      <div>
        <p className="text-base font-bold">
          Não foi possível carregar os clientes.
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Verifique sua conexão e tente novamente.
        </p>
      </div>
      <Button
        type="button"
        onClick={onRetry}
        className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-5 font-semibold"
      >
        Tentar novamente
      </Button>
    </div>
  );
}

/* ============================================================
   Skeletons — espelham o layout real (sem salto ao carregar)
   ============================================================ */
function ClientCardSkeleton({ delay }: { delay: number }) {
  return (
    <div className="glass-card flex flex-col rounded-3xl p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <Bone
          delay={delay}
          className="size-12 shrink-0 rounded-2xl sm:size-14"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <Bone delay={delay + 60} className="h-4 w-3/4" />
          <Bone delay={delay + 120} className="h-3 w-1/2 rounded-full" />
          <Bone delay={delay + 180} className="h-3 w-2/3 rounded-full" />
        </div>
        <Bone delay={delay + 240} className="size-9 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Bone delay={delay + 300} className="h-[52px] rounded-2xl" />
        <Bone delay={delay + 360} className="h-[52px] rounded-2xl" />
      </div>
      <div className="mt-3.5 flex items-center justify-between">
        <Bone delay={delay + 420} className="h-3 w-32 rounded-full" />
        <Bone delay={delay + 480} className="h-3 w-20 rounded-full" />
      </div>
    </div>
  );
}

function ClientGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }).map((_, index) => (
        <ClientCardSkeleton key={index} delay={index * 110} />
      ))}
    </div>
  );
}

function HomeCsSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HeroSkeleton stats={3} viz={<CsPickerHeroVizSkeleton />} />
      <ToolbarSkeleton buttons={3} />
      <ClientGridSkeleton />
    </div>
  );
}
