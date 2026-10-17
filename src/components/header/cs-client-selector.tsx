"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Buildings,
  CaretUpDown,
  Check,
  CircleNotch,
  UserSwitch,
} from "@phosphor-icons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

function initialsOf(name: string | null | undefined, fallback: string) {
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
    : "Selecionar cliente";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={
            current
              ? `Visualizando ${currentLabel}. Trocar cliente`
              : "Selecionar cliente para visualizar"
          }
          className={cn(
            "h-9 max-w-[16rem] cursor-pointer gap-2 rounded-xl px-2 font-normal transition-colors sm:px-2.5",
            "border-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)] hover:border-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]",
            !current &&
              "bg-gradient-custom border-transparent font-semibold text-[#04222A] hover:opacity-90",
          )}
        >
          {current ? (
            <Avatar className="size-6 rounded-md">
              <AvatarImage
                src={current.imageUrl ?? undefined}
                alt={current.name ?? current.email}
              />
              <AvatarFallback className="bg-gradient-custom rounded-md text-[10px] font-semibold text-[#04222A]">
                {initialsOf(current.name, current.email)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserSwitch className="size-4 shrink-0" weight="bold" />
          )}
          <span className="hidden min-w-0 items-center gap-1.5 sm:flex">
            {current && (
              <Badge
                variant="outline"
                className="border-brand-cyan/30 h-4 shrink-0 rounded-full px-1.5 text-[10px] font-bold tracking-wide"
              >
                CS
              </Badge>
            )}
            <span className="truncate text-sm">{currentLabel}</span>
          </span>
          <CaretUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[22rem] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold tracking-wide uppercase">
            Visualizar como cliente
          </p>
          <p className="text-muted-foreground text-xs">
            Você verá e operará a conta exatamente como o cliente.
          </p>
        </div>
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            maxLength={100}
            placeholder="Buscar por nome, empresa ou e-mail…"
            aria-label="Buscar cliente"
          />
          <CommandList>
            {loading ? (
              <p
                role="status"
                className="text-muted-foreground p-4 text-center text-sm"
              >
                Carregando clientes…
              </p>
            ) : clients.error ? (
              <div role="alert" className="p-4 text-center">
                <p className="text-muted-foreground mb-2 text-xs">
                  Não foi possível carregar os clientes.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void clients.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  Nenhum cliente com competição ativa ou concluída encontrado.
                </CommandEmpty>
                <CommandGroup>
                  {clients.data?.map((client) => {
                    const isCurrent = current?.id === client.id;
                    const isPending = pendingId === client.id;
                    return (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        disabled={isCurrent || pendingId !== null}
                        className="cursor-pointer gap-2.5"
                        onSelect={() => {
                          if (isCurrent) {
                            setOpen(false);
                            return;
                          }
                          void select(client.id);
                        }}
                      >
                        <Avatar className="size-8 rounded-lg">
                          <AvatarImage
                            src={client.imageUrl ?? undefined}
                            alt={client.name ?? client.email}
                          />
                          <AvatarFallback className="bg-gradient-custom rounded-lg text-xs font-semibold text-[#04222A]">
                            {initialsOf(client.name, client.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              aria-hidden
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                client.activeCampaigns > 0
                                  ? "bg-emerald-400"
                                  : "bg-violet-400",
                              )}
                            />
                            <span className="truncate font-medium">
                              {client.name ?? client.email}
                            </span>
                          </span>
                          <span className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
                            {client.company && (
                              <>
                                <Buildings className="size-3 shrink-0" />
                                <span className="truncate">
                                  {client.company}
                                </span>
                                <span aria-hidden>·</span>
                              </>
                            )}
                            <span className="truncate">
                              {client.activeCampaigns > 0
                                ? `${client.activeCampaigns} ativa${client.activeCampaigns > 1 ? "s" : ""}`
                                : `${client.completedCampaigns} concluída${client.completedCampaigns > 1 ? "s" : ""}`}
                            </span>
                          </span>
                        </div>
                        {isPending ? (
                          <CircleNotch className="size-4 shrink-0 animate-spin" />
                        ) : isCurrent ? (
                          <Check className="size-4 shrink-0" weight="bold" />
                        ) : null}
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
