"use client"

import * as React from "react"

import { REVEAL_OBSERVER_OPTIONS } from "@/components/shared/reveal-options"
import { cn } from "@/lib/utils"

interface RevealProps {
  children: React.ReactNode
  /** Delay em ms (use para stagger: index * 80). */
  delayMs?: number
  /** Anima já na montagem, sem esperar entrar na viewport. */
  immediate?: boolean
  className?: string
}

/**
 * Entrada suave ao entrar na viewport: fade + slide-up + scale.
 * Dispara uma única vez; respeita prefers-reduced-motion.
 * Com `immediate`, dispara na montagem independente de scroll.
 */
export function Reveal({
  children,
  delayMs = 0,
  immediate = false,
  className,
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (immediate) {
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }

    // Sem IntersectionObserver (browser antigo, ambiente de teste), o
    // conteúdo tem que aparecer mesmo assim — nunca ficar em opacity-0.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }

    // threshold 0 = basta 1px visível. Ver reveal-options.ts: com valor
    // fracionário, bloco mais alto que a viewport nunca atinge a fração.
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, REVEAL_OBSERVER_OPTIONS)
    observer.observe(el)
    return () => observer.disconnect()
  }, [immediate])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-4 scale-[0.98] opacity-0 motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  )
}
