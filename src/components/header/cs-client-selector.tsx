"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Buildings,
  CaretUpDown,
  Check,
  CheckCircle,
  CircleNotch,
  Eye,
  Trophy,
  UserSwitch,
  Warning,
} from "@phosphor-icons/react";

import { Bone } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCsView, useSelectCsClient } from "@/hooks/use-cs-view";
import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/**
 * Seletor de cliente no header — só aparece para usuários de Customer Success.
 * É a única diferença visual entre a tela do CS e a tela do cliente.
 */
export function CsClientSelector() {
  const { user, isCs, csView, stale } = useCsView();
  const { select, pendingId } = useSelectCsClient();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Cookie obsoleto (acesso revogado, cliente sem competição…): a home mostra o aviso
  // e limpa o cookie. Fora da home, só levamos o CS até lá.
  React.useEffect(() => {
    if (stale && pathname !== "/") router.replace("/");
  }, [stale, pathname, router]);

  const clients = api.cs.view.clients.useQuery(
    { search: debouncedSearch },
    { enabled: isCs && open },
  );
  const loading = clients.isFetching || search.trim() !== debouncedSearch;

  if (!user || !isCs) return null;

  const current = csView?.client ?? null;
  const currentLabel = current
    ? (current.company ?? current.name ?? current.email)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span className="relative inline-flex">
          {!current && (
            <span
              aria-hidden
              className="hero-pulse-ring pointer-events-none absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]"
            />
          )}
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={
              currentLabel
                ? `Visualizando ${currentLabel}. Trocar cliente`
                : "Selecionar cliente para visualizar"
            }
            className={cn(
              "relative h-9 max-w-[16rem] cursor-pointer gap-2 rounded-full pr-2 pl-1 font-normal transition-all duration-200",
              current
                ? "bg-background/60 border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] hover:border-[color-mix(in_oklab,var(--brand-cyan)_65%,transparent)] hover:shadow-[0_8px_24px_-12px_var(--brand-cyan)]"
                : "bg-gradient-custom border-transparent pl-2.5 font-semibold text-[#04222A] hover:brightness-105",
            )}
          >
            {current ? (
              <span className="relative shrink-0">
                <Avatar className="size-7 rounded-full ring-1 ring-white/20">
                  <AvatarImage
                    src={current.imageUrl ?? undefined}
                    alt={current.name ?? current.email}
                  />
                  <AvatarFallback className="bg-gradient-custom rounded-full text-[10px] font-bold text-[#04222A]">
                    {initialsOf(current.name, current.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="bg-gradient-custom ring-background absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full text-[#04222A] ring-2">
                  <Eye className="size-2" weight="fill" />
                </span>
              </span>
            ) : (
              <UserSwitch className="size-4 shrink-0" weight="bold" />
            )}
            <span className="hidden min-w-0 flex-col items-start leading-none sm:flex">
              {current ? (
                <>
                  <span className="text-muted-foreground text-[9px] font-semibold tracking-[0.14em] uppercase">
                    Visualizando
                  </span>
                  <span className="max-w-[11rem] truncate text-xs font-semibold">
                    {currentLabel}
                  </span>
                </>
              ) : (
                <span className="text-xs">Selecionar cliente</span>
              )}
            </span>
            <CaretUpDown className="size-4 shrink-0 opacity-60" />
          </Button>
        </span>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-2xl p-0 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.5)]"
      >
        {/* cabeçalho: cliente atual ou convite para escolher */}
        <div className="relative overflow-hidden border-b px-4 py-3.5">
          <span className="pointer-events-none absolute -top-12 -right-10 size-36 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_70%)] blur-2xl" />
          {current ? (
            <div className="relative flex items-center gap-3">
              <Avatar className="size-11 rounded-xl ring-1 ring-white/15">
                <AvatarImage
                  src={current.imageUrl ?? undefined}
                  alt={current.name ?? current.email}
                />
                <AvatarFallback className="bg-gradient-custom rounded-xl text-sm font-bold text-[#04222A]">
                  {initialsOf(current.name, current.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-emerald-600 uppercase dark:text-emerald-400">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Visualizando agora
                </p>
                <p className="truncate text-sm font-bold">{currentLabel}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {current.company ? `${current.name ?? ""} · ` : ""}
                  {current.email}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative flex items-center gap-3">
              <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                <Eye className="size-5" weight="fill" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-sm font-bold">Visualizar como cliente</p>
                <p className="text-muted-foreground text-xs">
                  Você verá e operará a conta exatamente como o cliente.
                </p>
              </div>
            </div>
          )}
        </div>

        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            maxLength={100}
            placeholder="Buscar por nome, empresa ou e-mail…"
            aria-label="Buscar cliente"
          />
          <CommandList className="max-h-[min(22rem,55svh)]">
            {loading ? (
              <div
                role="status"
                aria-label="Carregando clientes"
                className="p-2"
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2.5 px-2 py-2"
                  >
                    <Bone
                      delay={index * 90}
                      className="size-9 shrink-0 rounded-xl"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Bone delay={index * 90 + 50} className="h-3 w-2/5" />
                      <Bone
                        delay={index * 90 + 100}
                        className="h-2.5 w-3/5 rounded-full"
                      />
                    </div>
                    <Bone
                      delay={index * 90 + 150}
                      className="h-5 w-14 rounded-full"
                    />
                  </div>
                ))}
              </div>
            ) : clients.error ? (
              <div
                role="alert"
                className="flex flex-col items-center gap-2 p-6 text-center"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                  <Warning className="size-4" weight="fill" />
                </span>
                <p className="text-sm font-semibold">
                  Não foi possível carregar os clientes.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer rounded-lg"
                  onClick={() => void clients.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-1.5 py-4">
                    <span className="bg-muted flex size-9 items-center justify-center rounded-xl">
                      <Buildings className="text-muted-foreground size-4" />
                    </span>
                    <p className="text-sm font-semibold">
                      Nenhum cliente encontrado
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Só aparecem clientes com competição ativa ou concluída.
                    </p>
                  </div>
                </CommandEmpty>
                <CommandGroup
                  heading={
                    clients.data && clients.data.length > 0
                      ? `${clients.data.length} cliente${clients.data.length > 1 ? "s" : ""}`
                      : undefined
                  }
                >
                  {clients.data?.map((client) => {
                    const isCurrent = current?.id === client.id;
                    const isPending = pendingId === client.id;
                    const hasActive = client.activeCampaigns > 0;
                    return (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        disabled={isCurrent || pendingId !== null}
                        className={cn(
                          "cursor-pointer gap-3 rounded-xl px-2 py-2",
                          isCurrent &&
                            "bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)]",
                        )}
                        onSelect={() => {
                          if (isCurrent) {
                            setOpen(false);
                            return;
                          }
                          void select(client.id);
                        }}
                      >
                        <span className="relative shrink-0">
                          <Avatar className="size-9 rounded-xl">
                            <AvatarImage
                              src={client.imageUrl ?? undefined}
                              alt={client.name ?? client.email}
                            />
                            <AvatarFallback className="bg-gradient-custom rounded-xl text-xs font-bold text-[#04222A]">
                              {initialsOf(client.name, client.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            aria-hidden
                            className={cn(
                              "ring-popover absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2",
                              hasActive ? "bg-emerald-400" : "bg-violet-400",
                            )}
                          />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-sm font-semibold">
                            {client.company ?? client.name ?? client.email}
                          </span>
                          <span className="text-muted-foreground truncate text-xs">
                            {client.company && client.name
                              ? `${client.name} · `
                              : ""}
                            {client.email}
                          </span>
                        </div>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {hasActive ? (
                            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                              <Trophy className="size-2.5" weight="fill" />
                              {client.activeCampaigns}
                            </span>
                          ) : (
                            <span className="inline-flex h-5 items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 text-[10px] font-bold text-violet-600 tabular-nums dark:text-violet-400">
                              <CheckCircle className="size-2.5" weight="fill" />
                              {client.completedCampaigns}
                            </span>
                          )}
                          {isPending ? (
                            <CircleNotch className="size-4 animate-spin" />
                          ) : isCurrent ? (
                            <Check
                              className="text-brand-cyan not-dark:text-primary size-4"
                              weight="bold"
                            />
                          ) : null}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
