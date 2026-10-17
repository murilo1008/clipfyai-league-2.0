"use client"

import * as React from "react"
import { Timer } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

/**
 * Contagem regressiva ao vivo (d/h/m/s) até `target`. Some quando o prazo
 * passa. Usada no início das competições e no fim de suspensões.
 */
export function CountdownTimer({
  target,
  className,
}: {
  target: string | Date
  className?: string
}) {
  // Timestamp numérico: um Date novo a cada render não reinicia o intervalo.
  const targetMs = new Date(target).getTime()

  const calcTimeLeft = React.useCallback(() => {
    const diff = targetMs - Date.now()
    if (!Number.isFinite(diff) || diff <= 0) return null
    return {
      d: Math.floor(diff / (1000 * 60 * 60 * 24)),
      h: Math.floor((diff / (1000 * 60 * 60)) % 24),
      m: Math.floor((diff / (1000 * 60)) % 60),
      s: Math.floor((diff / 1000) % 60),
    }
  }, [targetMs])

  const [timeLeft, setTimeLeft] = React.useState(calcTimeLeft)

  React.useEffect(() => {
    const interval = setInterval(() => setTimeLeft(calcTimeLeft()), 1000)
    return () => clearInterval(interval)
  }, [calcTimeLeft])

  if (!timeLeft) return null

  const units = [
    { label: "d", value: timeLeft.d },
    { label: "h", value: timeLeft.h },
    { label: "m", value: timeLeft.m },
    { label: "s", value: timeLeft.s },
  ]

  return (
    <div
      className={cn(
        "relative flex h-[22px] w-fit items-center gap-[3px] overflow-hidden rounded-full px-2.5 py-0.5",
        className,
      )}
    >
      <div className="absolute inset-0 rounded-full border border-[var(--brand-cyan)]/25 bg-gradient-to-r from-[#0d1117] via-[#111827] to-[#0d1117] shadow-[0_0_12px_rgba(20,247,255,0.15),inset_0_1px_1px_rgba(255,255,255,0.05)]" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.04] to-transparent" />
      <Timer
        className="relative size-3 shrink-0 animate-pulse text-[var(--brand-cyan)] drop-shadow-[0_0_4px_rgba(20,247,255,0.6)]"
        weight="fill"
      />
      {units.map((u, i) => (
        <span
          key={u.label}
          className="relative text-[11px] leading-none font-black tracking-tight tabular-nums"
        >
          <span className="bg-gradient-to-b from-[var(--brand-cyan)] via-[var(--brand-mint)] to-[var(--brand-green)] bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(20,247,255,0.4)]">
            {String(u.value).padStart(2, "0")}
          </span>
          <span className="text-[9px] font-semibold text-white/40">
            {u.label}
          </span>
          {i < units.length - 1 && (
            <span className="mx-[1px] text-[var(--brand-cyan)]/30">:</span>
          )}
        </span>
      ))}
    </div>
  )
}
