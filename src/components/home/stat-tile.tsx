"use client"

import { TrendDown, TrendUp } from "@phosphor-icons/react"

import { CountUp, type CountUpKind } from "@/components/shared/count-up"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatTileProps {
  icon: React.ReactNode
  label: string
  value: number
  kind?: CountUpKind
  /** Texto de apoio (ex.: "últimos 30 dias"). */
  hint?: string
  /** Variação percentual — renderizada com seta + texto (nunca só cor). */
  delta?: number
  /** Toque de cor da marca no chip do ícone (duotônico como a apresentação). */
  accent?: "cyan" | "green" | "gradient" | "purple"
  /** Valor com o gradiente da marca (como os valores dos cards do slide). */
  gradientValue?: boolean
  isLoading?: boolean
  className?: string
}

/** KPI tile da marca: chip gradiente, contador animado e delta com seta. */
export function StatTile({
  icon,
  label,
  value,
  kind = "compact",
  hint,
  delta,
  accent = "gradient",
  gradientValue = false,
  isLoading = false,
  className,
}: StatTileProps) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta)
  const isUp = (delta ?? 0) >= 0

  return (
    <div
      className={cn(
        "glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]",
            accent === "cyan" &&
              "bg-[var(--brand-cyan)] not-dark:bg-[#089eb8] not-dark:text-white",
            accent === "green" &&
              "bg-[var(--brand-green)] not-dark:bg-[#0eb981] not-dark:text-white",
            accent === "gradient" && "bg-gradient-custom",
            accent === "purple" && "bg-purple-500 text-white",
          )}
        >
          {icon}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <CountUp
          value={value}
          kind={kind}
          className={cn(
            "text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]",
            gradientValue && "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] w-fit",
          )}
        />
      )}

      {(hint ?? showDelta) ? (
        <div className="flex items-center gap-2 text-xs">
          {showDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold",
                isUp
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
            >
              {isUp ? (
                <TrendUp className="size-3" weight="bold" />
              ) : (
                <TrendDown className="size-3" weight="bold" />
              )}
              {isUp ? "+" : ""}
              {delta?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      ) : null}
    </div>
  )
}
