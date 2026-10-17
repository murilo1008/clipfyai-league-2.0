"use client";

import * as React from "react";
import {
  Buildings,
  CaretUpDown,
  Check,
  Checks,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";

import { Bone } from "@/components/shared/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { initialsOf } from "@/lib/initials";
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

function labelOf(option: CsClientOption | null | undefined, fallback: string) {
  return option?.company ?? option?.name ?? option?.email ?? fallback;
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
  const selectVisible = () =>
    onChange(
      Array.from(new Set([...value, ...filtered.map((option) => option.id)])),
    );
  const clearAll = () => onChange([]);

  const selectedPreview = value
    .slice(0, 4)
    .map((clientId) => byId.get(clientId) ?? null);
  const allMode = value.length === 0;

  return (
    <div className="space-y-2.5">
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
            className={cn(
              "h-12 w-full cursor-pointer justify-between rounded-2xl px-3 font-normal transition-colors hover:border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]",
              !allMode &&
                "border-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]",
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              {allMode ? (
                <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                  <UsersThree className="size-4" weight="fill" />
                </span>
              ) : (
                <span className="flex shrink-0 -space-x-2">
                  {selectedPreview.map((option, index) => (
                    <Avatar
                      key={value[index]}
                      className="ring-background size-8 rounded-xl ring-2"
                    >
                      <AvatarImage src={option?.imageUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-gradient-custom rounded-xl text-[10px] font-bold text-[#04222A]">
                        {initialsOf(option?.name, option?.email ?? "")}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {value.length > 4 && (
                    <span className="bg-muted text-foreground/80 ring-background flex size-8 items-center justify-center rounded-xl text-[10px] font-bold ring-2">
                      +{value.length - 4}
                    </span>
                  )}
                </span>
              )}
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span className="truncate text-sm font-semibold">
                  {allMode
                    ? "Todos os clientes"
                    : `${value.length} cliente${value.length > 1 ? "s" : ""} selecionado${value.length > 1 ? "s" : ""}`}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {allMode
                    ? "Nenhum selecionado = acesso a todos os elegíveis"
                    : selectedPreview
                        .map((option, index) => labelOf(option, value[index]!))
                        .join(", ")}
                </span>
              </span>
            </span>
            <CaretUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl p-0"
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
            <div className="text-muted-foreground flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px]">
              <span>
                {value.length === 0
                  ? "Acesso a todos"
                  : `${value.length} selecionado${value.length > 1 ? "s" : ""}`}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={selectVisible}
                  disabled={filtered.length === 0}
                  className="hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold transition-colors disabled:opacity-40"
                >
                  <Checks className="size-3.5" />
                  Marcar visíveis
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={value.length === 0}
                  className="hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold transition-colors disabled:opacity-40"
                >
                  <X className="size-3.5" />
                  Limpar
                </button>
              </span>
            </div>
            <CommandList className="max-h-[min(20rem,50svh)]">
              {options.isLoading ? (
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
                      <Bone delay={index * 90} className="size-4 rounded-sm" />
                      <Bone
                        delay={index * 90 + 30}
                        className="size-8 shrink-0 rounded-lg"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Bone delay={index * 90 + 60} className="h-3 w-2/5" />
                        <Bone
                          delay={index * 90 + 110}
                          className="h-2.5 w-3/5 rounded-full"
                        />
                      </div>
                      <Bone
                        delay={index * 90 + 160}
                        className="h-4 w-12 rounded-full"
                      />
                    </div>
                  ))}
                </div>
              ) : options.error ? (
                <div
                  role="alert"
                  className="flex flex-col items-center gap-2 p-5 text-center"
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
                          className={cn(
                            "cursor-pointer gap-2.5 rounded-xl px-2 py-2",
                            checked &&
                              "bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)]",
                          )}
                          onSelect={() => toggle(option.id)}
                        >
                          <Checkbox
                            checked={checked}
                            tabIndex={-1}
                            aria-hidden
                            className="pointer-events-none"
                          />
                          <Avatar className="size-8 shrink-0 rounded-lg">
                            <AvatarImage
                              src={option.imageUrl ?? undefined}
                              alt=""
                            />
                            <AvatarFallback className="bg-gradient-custom rounded-lg text-[10px] font-bold text-[#04222A]">
                              {initialsOf(option.name, option.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className="truncate text-sm font-medium">
                              {option.company ?? option.name ?? option.email}
                            </span>
                            <span className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
                              {option.company && option.name && (
                                <>
                                  <Buildings className="size-3 shrink-0" />
                                  <span className="truncate">
                                    {option.name}
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
                              "h-5 shrink-0 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                              option.eligibleCampaigns > 0
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-border text-muted-foreground",
                            )}
                            title="Competições ativas ou concluídas"
                          >
                            {option.eligibleCampaigns} comp.
                          </Badge>
                          {checked && (
                            <Check
                              className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                              weight="bold"
                            />
                          )}
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
          {value.map((clientId) => {
            const option = byId.get(clientId);
            return (
              <span
                key={clientId}
                className="bg-background/60 inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-1 text-xs font-medium"
              >
                <Avatar className="size-5 rounded-full">
                  <AvatarImage src={option?.imageUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-gradient-custom rounded-full text-[8px] font-bold text-[#04222A]">
                    {initialsOf(option?.name, option?.email ?? "")}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[12rem] truncate">
                  {labelOf(option, clientId)}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(clientId)}
                  disabled={disabled}
                  aria-label={`Remover ${labelOf(option, clientId)}`}
                  className="hover:bg-muted flex size-5 cursor-pointer items-center justify-center rounded-full transition-colors"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <p
        className={cn(
          "flex items-start gap-1.5 text-xs",
          allMode ? "text-muted-foreground" : "text-foreground/80",
        )}
      >
        <UsersThree className="mt-0.5 size-3.5 shrink-0" weight="fill" />
        {allMode
          ? "Nenhum cliente selecionado = acesso a todos os clientes elegíveis (com competição ativa ou concluída)."
          : "O CS só poderá visualizar os clientes selecionados. Limpe a seleção para liberar todos."}
      </p>
    </div>
  );
}
