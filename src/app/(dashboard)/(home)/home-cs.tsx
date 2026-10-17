"use client";

import * as React from "react";
import {
  ArrowRight,
  Buildings,
  CheckCircle,
  CircleNotch,
  Eye,
  MagnifyingGlass,
  Trophy,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { HomeHero } from "@/components/home/home-hero";
import { Reveal } from "@/components/shared/reveal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSelectCsClient } from "@/hooks/use-cs-view";
import { cn } from "@/lib/utils";
import { clearCsClient } from "@/server/cs-view/actions";
import { api, type RouterOutputs } from "@/trpc/react";

type ViewableClient = RouterOutputs["cs"]["view"]["clients"][number];

function initialsOf(name: string | null, fallback: string) {
  const source = (name ?? "").trim() || fallback;
  return (
    source
      .split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CL"
  );
}

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
        isLoading={clients.isLoading}
        stats={[
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Clientes disponíveis",
            value: list.length,
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
            className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
          >
            <Warning
              className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
              weight="fill"
            />
            <div className="min-w-0">
              <p className="font-semibold">
                O cliente que você estava visualizando não está mais disponível.
              </p>
              <p className="text-muted-foreground">
                O acesso pode ter sido alterado pelo administrador ou o cliente
                deixou de ter competições ativas ou concluídas. Escolha outro
                cliente abaixo.
              </p>
            </div>
          </div>
        </Reveal>
      )}

      {/* ===== Busca ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
              <Eye className="size-4" weight="fill" />
            </span>
            <div className="min-w-0 leading-tight">
              <h2 className="text-sm font-bold">Visualizar como cliente</h2>
              <p className="text-muted-foreground truncate text-xs">
                Só aparecem clientes com competições ativas ou concluídas
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
        </div>
      </Reveal>

      {/* ===== Clientes ===== */}
      <Reveal immediate delayMs={120}>
        {clients.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[132px] rounded-2xl" />
            ))}
          </div>
        ) : clients.error ? (
          <div
            role="alert"
            className="glass-card flex flex-col items-center gap-3 rounded-3xl p-10 text-center"
          >
            <p className="text-sm font-semibold">
              Não foi possível carregar os clientes.
            </p>
            <button
              type="button"
              onClick={() => void clients.refetch()}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold"
            >
              Tentar novamente
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 rounded-3xl p-10 text-center">
            <span className="bg-muted flex size-12 items-center justify-center rounded-2xl">
              <UsersThree className="text-muted-foreground size-6" />
            </span>
            <p className="text-sm font-semibold">
              {isSearching
                ? "Nenhum cliente encontrado para esta busca."
                : "Nenhum cliente disponível."}
            </p>
            <p className="text-muted-foreground max-w-md text-sm">
              {isSearching
                ? "Tente outro nome, empresa ou e-mail."
                : "Peça ao administrador para liberar clientes com competições ativas ou concluídas para o seu usuário."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((client, index) => (
              <li key={client.id}>
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
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-label={`Visualizar como ${client.company ?? displayName}`}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className={cn(
        "glass-card glass-card-hover animate-fade-in-up group flex w-full cursor-pointer flex-col gap-4 rounded-2xl p-4 text-left transition-all sm:p-5",
        "focus-visible:ring-brand-cyan/50 focus-visible:ring-2 focus-visible:outline-none",
        disabled && !pending && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="ring-border size-11 rounded-xl ring-1">
          <AvatarImage src={client.imageUrl ?? undefined} alt={displayName} />
          <AvatarFallback className="bg-gradient-custom rounded-xl text-sm font-semibold text-[#04222A]">
            {initialsOf(client.name, client.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-bold">{displayName}</p>
          {client.company && (
            <p className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
              <Buildings className="size-3 shrink-0" />
              <span className="truncate">{client.company}</span>
            </p>
          )}
          <p className="text-muted-foreground truncate text-xs">
            {client.email}
          </p>
        </div>
        {pending ? (
          <CircleNotch className="text-brand-cyan size-5 shrink-0 animate-spin" />
        ) : (
          <ArrowRight
            className="text-muted-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
            weight="bold"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {client.activeCampaigns > 0 && (
          <Badge
            variant="outline"
            className="h-5 gap-1.5 rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-emerald-400"
            />
            {plural(client.activeCampaigns, "ativa", "ativas")}
          </Badge>
        )}
        {client.completedCampaigns > 0 && (
          <Badge
            variant="outline"
            className="h-5 gap-1.5 rounded-full border-violet-500/40 bg-violet-500/10 px-2 text-[10px] font-semibold text-violet-600 dark:text-violet-400"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-violet-400" />
            {plural(client.completedCampaigns, "concluída", "concluídas")}
          </Badge>
        )}
        <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-xs font-semibold">
          <Eye className="size-3.5" weight="fill" />
          Visualizar
        </span>
      </div>
    </button>
  );
}
