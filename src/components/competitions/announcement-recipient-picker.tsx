"use client";

import { useEffect, useState } from "react";
import { CaretUpDown, Check } from "@phosphor-icons/react";

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
import { api, type RouterOutputs } from "@/trpc/react";

export type AnnouncementRecipient =
  RouterOutputs["competitionAnnouncements"]["recipients"][number];

export function AnnouncementRecipientPicker({
  campaignId,
  value,
  onChange,
  disabled,
}: {
  campaignId: string;
  value: AnnouncementRecipient | null;
  onChange: (recipient: AnnouncementRecipient) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const recipients = api.competitionAnnouncements.recipients.useQuery(
    { campaignId, search: debouncedSearch },
    { enabled: open },
  );
  const loading = recipients.isFetching || search.trim() !== debouncedSearch;

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id="announcement-recipient"
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open && !disabled}
          aria-label="Selecionar clipador destinatário"
          disabled={disabled}
          className="w-full justify-between rounded-xl font-normal"
        >
          <span className="truncate">
            {value
              ? value.artisticName || value.fullName
              : "Selecione o clipador"}
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
            maxLength={200}
            placeholder="Buscar por nome ou e-mail…"
            aria-label="Buscar clipador destinatário"
          />
          <CommandList>
            {loading ? (
              <p
                role="status"
                className="text-muted-foreground p-4 text-center text-sm"
              >
                Carregando clipadores…
              </p>
            ) : recipients.error ? (
              <div role="alert" className="p-4 text-center">
                <p className="text-muted-foreground mb-2 text-xs">
                  Não foi possível carregar os clipadores.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void recipients.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <CommandEmpty>
                  Nenhum clipador aprovado encontrado.
                </CommandEmpty>
                <CommandGroup>
                  {recipients.data?.map((recipient) => (
                    <CommandItem
                      key={recipient.id}
                      value={recipient.id}
                      onSelect={() => {
                        onChange(recipient);
                        setOpen(false);
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">
                          {recipient.artisticName || recipient.fullName}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {recipient.user.email}
                        </span>
                      </div>
                      {value?.id === recipient.id && (
                        <Check className="size-4 shrink-0" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
