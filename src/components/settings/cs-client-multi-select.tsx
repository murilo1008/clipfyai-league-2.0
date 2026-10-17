"use client";

import * as React from "react";
import {
  Buildings,
  CaretUpDown,
  Check,
  UsersThree,
  X,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

export type CsClientOption =
  RouterOutputs["cs"]["admin"]["clientOptions"][number];

function matches(option: CsClientOption, term: string) {
  if (!term) return true;
  const haystack = [option.name, option.company, option.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(term.toLowerCase());
}

/**
 * Multi-select de clientes liberados para um usuário CS.
 * Nenhum selecionado = acesso a TODOS os clientes elegíveis.
 */
export function CsClientMultiSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const options = api.cs.admin.clientOptions.useQuery(undefined, {
    enabled: open || value.length > 0,
  });

  const byId = React.useMemo(
    () => new Map((options.data ?? []).map((option) => [option.id, option])),
    [options.data],
  );
  const selected = value.map((clientId) => byId.get(clientId) ?? null);
  const filtered = React.useMemo(
    () =>
      (options.data ?? []).filter((option) => matches(option, search.trim())),
    [options.data, search],
  );

  const toggle = (clientId: string) => {
    onChange(
      value.includes(clientId)
        ? value.filter((existing) => existing !== clientId)
        : [...value, clientId],
    );
  };

  return (
    <div className="space-y-2">
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open && !disabled}
            aria-label="Selecionar clientes liberados"
            disabled={disabled}
            className="h-11 w-full cursor-pointer justify-between rounded-xl font-normal transition-colors hover:border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <UsersThree className="size-4 shrink-0 opacity-70" />
              <span className="truncate">
                {value.length === 0
                  ? "Todos os clientes (nenhum selecionado)"
                  : `${value.length} cliente${value.length > 1 ? "s" : ""} selecionado${value.length > 1 ? "s" : ""}`}
              </span>
            </span>
            <CaretUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              maxLength={100}
              placeholder="Buscar por nome, empresa ou e-mail…"
              aria-label="Buscar cliente"
            />
            <CommandList>
              {options.isLoading ? (
                <p
                  role="status"
                  className="text-muted-foreground p-4 text-center text-sm"
                >
                  Carregando clientes…
                </p>
              ) : options.error ? (
                <div role="alert" className="p-4 text-center">
                  <p className="text-muted-foreground mb-2 text-xs">
                    Não foi possível carregar os clientes.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void options.refetch()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <>
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filtered.map((option) => {
                      const checked = value.includes(option.id);
                      return (
                        <CommandItem
                          key={option.id}
                          value={option.id}
                          className="cursor-pointer gap-2.5"
                          onSelect={() => toggle(option.id)}
                        >
                          <Checkbox
                            checked={checked}
                            tabIndex={-1}
                            aria-hidden
                            className="pointer-events-none"
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">
                              {option.name ?? option.email}
                            </span>
                            <span className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
                              {option.company && (
                                <>
                                  <Buildings className="size-3 shrink-0" />
                                  <span className="truncate">
                                    {option.company}
                                  </span>
                                  <span aria-hidden>·</span>
                                </>
                              )}
                              <span className="truncate">{option.email}</span>
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-4 shrink-0 rounded-full px-1.5 text-[10px] font-semibold",
                              option.eligibleCampaigns > 0
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-border text-muted-foreground",
                            )}
                            title="Competições ativas ou concluídas"
                          >
                            {option.eligibleCampaigns} comp.
                          </Badge>
                          {checked && <Check className="size-4 shrink-0" />}
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

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option, index) => {
            const clientId = value[index]!;
            return (
              <Badge
                key={clientId}
                variant="outline"
                className="h-6 gap-1 rounded-full pr-1 pl-2.5 text-xs font-medium"
              >
                <span className="max-w-[12rem] truncate">
                  {option?.company ?? option?.name ?? option?.email ?? clientId}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(clientId)}
                  disabled={disabled}
                  aria-label={`Remover ${option?.name ?? clientId}`}
                  className="hover:bg-muted flex size-4 cursor-pointer items-center justify-center rounded-full"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        {value.length === 0
          ? "Nenhum cliente selecionado = acesso a todos os clientes elegíveis."
          : "O CS só poderá visualizar os clientes selecionados. Limpe a seleção para liberar todos."}
      </p>
    </div>
  );
}
