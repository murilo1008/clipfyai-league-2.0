"use client"

import * as React from "react"

import { useFinancialVisibility } from "@/contexts/financial-visibility-context"

export type CountUpKind = "int" | "compact" | "brl" | "compactBRL" | "percent"

const MONEY_KINDS: CountUpKind[] = ["brl", "compactBRL"]

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000)
    return `${(value / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}B`
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`
  if (value >= 1_000)
    return `${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`
  return Math.round(value).toLocaleString("pt-BR")
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  })
}

function format(value: number, kind: CountUpKind): string {
  switch (kind) {
    case "compact":
      return formatCompact(value)
    case "brl":
      return formatBRL(value)
    case "compactBRL":
      return `R$ ${formatCompact(value)}`
    case "percent":
      return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
    default:
      return Math.round(value).toLocaleString("pt-BR")
  }
}

interface CountUpProps {
  value: number
  kind?: CountUpKind
  durationMs?: number
  delayMs?: number
  className?: string
}

/**
 * Contador animado 0 → valor: dispara uma única vez ao entrar na viewport,
 * easing easeOutCubic via requestAnimationFrame. Respeita
 * prefers-reduced-motion (valor final direto).
 */
export function CountUp({
  value,
  kind = "int",
  durationMs = 1100,
  delayMs = 0,
  className,
}: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = React.useState(() => format(0, kind))
  const startedRef = React.useRef(false)
  const { isVisible: isFinancialVisible } = useFinancialVisibility()
  const isMasked = MONEY_KINDS.includes(kind) && !isFinancialVisible

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const run = () => {
      if (startedRef.current) return
      startedRef.current = true

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDisplay(format(value, kind))
        return
      }

      const start = performance.now() + delayMs
      const tick = (now: number) => {
        const t = Math.min(Math.max((now - start) / durationMs, 0), 1)
        setDisplay(format(value * easeOutCubic(t), kind))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          run()
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.2 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value, kind, durationMs, delayMs])

  return (
    <span ref={ref} className={className}>
      {isMasked ? "••••••" : display}
    </span>
  )
}
