"use client"

import type * as React from "react"
import { Sparkle } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

const HERO_SPARKLES = [
  { left: "58%", top: "16%", size: 11, delay: 0, dur: 3.6 },
  { left: "78%", top: "10%", size: 9, delay: 1.4, dur: 4.4 },
  { left: "88%", top: "34%", size: 13, delay: 2.2, dur: 3.4 },
  { left: "68%", top: "58%", size: 8, delay: 0.8, dur: 4.8 },
] as const

const HERO_PARTICLES = [
  { left: "62%", bottom: "18%", size: 3, delay: 0.4, dur: 5.6, x: 12 },
  { left: "74%", bottom: "12%", size: 2, delay: 2, dur: 6.6, x: -12 },
  { left: "86%", bottom: "20%", size: 3, delay: 1.2, dur: 5.4, x: 10 },
  { left: "94%", bottom: "14%", size: 2, delay: 3.4, dur: 6.2, x: -8 },
] as const

/** Fundo animado do hero da competição (aurora, grade, cometa e brilhos). */
export function CompetitionHeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <span className="arena-aurora absolute -top-20 right-[6%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
      <span
        className="arena-aurora absolute -bottom-24 left-[18%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_18%,transparent),transparent_66%)] blur-2xl"
        style={{ animationDelay: "-6s" }}
      />
      <div className="hero-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_75%_40%,#000_25%,transparent_75%)] opacity-35" />
      <div className="absolute inset-y-0 left-1/3 w-28 overflow-visible">
        <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
      </div>
      <span
        className="arena-comet absolute top-[8%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/70 via-[color-mix(in_oklab,var(--brand-cyan)_65%,transparent)] to-transparent"
        style={
          {
            "--comet-dur": "10s",
            "--comet-delay": "2.5s",
            "--comet-x": "-300px",
            "--comet-y": "200px",
            "--comet-angle": "-33deg",
          } as React.CSSProperties
        }
      />
      {HERO_SPARKLES.map((sparkle, index) => (
        <Sparkle
          key={index}
          weight="fill"
          className={cn(
            "arena-twinkle absolute",
            index % 2 === 0
              ? "text-[var(--brand-mint)]"
              : "text-[var(--brand-cyan)]",
          )}
          style={
            {
              left: sparkle.left,
              top: sparkle.top,
              width: sparkle.size,
              height: sparkle.size,
              "--twinkle-delay": `${sparkle.delay}s`,
              "--twinkle-dur": `${sparkle.dur}s`,
              "--twinkle-opacity": 0.85,
            } as React.CSSProperties
          }
        />
      ))}
      {HERO_PARTICLES.map((particle, index) => (
        <span
          key={index}
          className={cn(
            "arena-particle absolute rounded-full",
            index % 2 === 0
              ? "bg-[var(--brand-mint)]"
              : "bg-[var(--brand-cyan)]",
          )}
          style={
            {
              left: particle.left,
              bottom: particle.bottom,
              width: particle.size,
              height: particle.size,
              "--particle-delay": `${particle.delay}s`,
              "--particle-dur": `${particle.dur}s`,
              "--particle-x": `${particle.x}px`,
              "--particle-opacity": 0.75,
            } as React.CSSProperties
          }
        />
      ))}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent" />
    </div>
  )
}
