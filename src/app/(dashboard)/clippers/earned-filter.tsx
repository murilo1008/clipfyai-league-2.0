"use client";

import * as React from "react";
import { CheckCircle, CurrencyDollar } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseBRLNumber } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { RouterInputs } from "@/trpc/react";

export type EarnedRange = Pick<
  RouterInputs["clipper"]["getAll"],
  "minTotalEarned" | "maxTotalEarned"
>;

export function EarnedFilter({
  value,
  onChange,
}: {
  value: EarnedRange;
  onChange: (value: EarnedRange) => void;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [minimum, setMinimum] = React.useState("");
  const [maximum, setMaximum] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const active =
    value.minTotalEarned !== undefined || value.maxTotalEarned !== undefined;

  const apply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const min = minimum.trim() ? parseBRLNumber(minimum) : undefined;
    const max = maximum.trim() ? parseBRLNumber(maximum) : undefined;
    if (
      min === null ||
      max === null ||
      (min !== undefined && (!Number.isFinite(min) || min < 0)) ||
      (max !== undefined && (!Number.isFinite(max) || max < 0))
    ) {
      setError("Informe valores válidos em reais, como 1.000,50.");
      return;
    }
    if (min !== undefined && max !== undefined && min >= max) {
      setError("O limite superior deve ser maior que o limite inferior.");
      return;
    }
    onChange({ minTotalEarned: min, maxTotalEarned: max });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setMinimum(value.minTotalEarned?.toString().replace(".", ",") ?? "");
          setMaximum(value.maxTotalEarned?.toString().replace(".", ",") ?? "");
          setError(null);
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 cursor-pointer rounded-xl",
            active && "border-brand-cyan/50 bg-brand-cyan/10",
          )}
          aria-label={
            active ? "Total ganho: filtro ativo" : "Filtrar por total ganho"
          }
        >
          <CurrencyDollar className="size-4" />
          Total ganho
          {active && <CheckCircle className="size-3.5" weight="fill" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] rounded-xl"
      >
        <form onSubmit={apply} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Filtrar por total ganho</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Preencha um ou ambos os limites. Os valores exatos dos limites
              ficam fora da faixa.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-min`}>Maior que (R$)</Label>
            <Input
              id={`${id}-min`}
              inputMode="decimal"
              value={minimum}
              onChange={(event) => {
                setMinimum(event.target.value);
                setError(null);
              }}
              placeholder="Sem limite inferior"
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-max`}>Menor que (R$)</Label>
            <Input
              id={`${id}-max`}
              inputMode="decimal"
              value={maximum}
              onChange={(event) => {
                setMaximum(event.target.value);
                setError(null);
              }}
              placeholder="Sem limite superior"
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              className="rounded-xl"
            />
          </div>
          {error && (
            <p
              id={`${id}-error`}
              role="alert"
              className="text-destructive text-xs"
            >
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => {
                onChange({});
                setOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              type="submit"
              className="btn-gradient-auth cursor-pointer rounded-xl"
            >
              Aplicar
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
