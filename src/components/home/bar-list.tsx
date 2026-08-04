"use client"

import { formatCompact } from "@/components/shared/count-up"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface BarListItem {
  key: string
  /** Identidade da linha — ícone/emoji opcional + label (nunca só cor). */
  icon?: React.ReactNode
  label: string
  value: number
  /** Detalhe extra exibido no tooltip. */
  tooltip?: string
}

interface BarListProps {
  items: BarListItem[]
  /** Formata o valor à direita (default: compacto pt-BR). */
  formatValue?: (value: number) => string
  isLoading?: boolean
  emptyMessage?: string
  className?: string
}

/**
 * Lista de barras horizontais em tom único da marca (magnitude) —
 * identidade sempre por ícone + label; hover com tooltip.
 */
export function BarList({
  items,
  formatValue = formatCompact,
  isLoading = false,
  emptyMessage = "Sem dados por enquanto",
  className,
}: BarListProps) {
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        {emptyMessage}
      </p>
    )
  }

  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {items.map((item) => {
        const pct = Math.max((item.value / max) * 100, 2)
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <div className="group/bar flex cursor-default items-center gap-3">
                <div className="flex w-32 shrink-0 items-center gap-1.5 sm:w-40">
                  {item.icon}
                  <span className="text-foreground/90 truncate text-xs font-medium sm:text-[13px]">
                    {item.label}
                  </span>
                </div>
                <div className="bg-muted/60 relative h-2 flex-1 overflow-hidden rounded-full">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-foreground w-14 shrink-0 text-right text-xs font-semibold tabular-nums sm:text-[13px]">
                  {formatValue(item.value)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {item.tooltip ?? `${item.label}: ${item.value.toLocaleString("pt-BR")}`}
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
