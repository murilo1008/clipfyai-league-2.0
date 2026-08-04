"use client"

import * as React from "react"

import {
  HomeHeroViz,
  HomeHeroVizSkeleton,
} from "@/components/home/home-hero-viz"
import { CountUp, type CountUpKind } from "@/components/shared/count-up"
import { DarkScope } from "@/components/shared/dark-scope"
import { Skeleton } from "@/components/ui/skeleton"

export interface HeroStatItem {
  icon: React.ReactNode
  label: string
  value: number
  kind: CountUpKind
}

interface HomeHeroProps {
  eyebrow: string
  title: React.ReactNode
  subtitle: string
  stats: HeroStatItem[]
  isLoading?: boolean
  /** Visualização animada à direita (default: HomeHeroViz). */
  viz?: React.ReactNode
  /**
   * Fantasma da visualização, exibido no lugar dela enquanto `isLoading`.
   * Cada *-hero-viz.tsx exporta o seu (ex.: <ArenaHeroVizSkeleton />).
   */
  vizSkeleton?: React.ReactNode
}

/**
 * Div de resumo da plataforma no topo da home — sempre no dark da marca
 * (mesmo no tema light), com a visualização animada à direita.
 */
export function HomeHero({
  eyebrow,
  title,
  subtitle,
  stats,
  isLoading = false,
  viz,
  vizSkeleton,
}: HomeHeroProps) {
  return (
    <DarkScope className="contents">
      <section className="animate-fade-in-up relative overflow-hidden rounded-3xl bg-[#050f1c] p-6 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-8 lg:p-10">
        {/* Glows da marca */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_12%,transparent)] blur-3xl"
        />
        {/* Hairline com o gradiente da marca no topo */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
        />

        {/* Visualização animada (direita, md+) — vira fantasma no loading,
            para o hero carregar junto com o resto da página */}
        {isLoading
          ? (vizSkeleton ?? <HomeHeroVizSkeleton />)
          : (viz ?? <HomeHeroViz />)}

        <div className="relative z-10 flex max-w-2xl flex-col gap-4">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">
            <span className="bg-gradient-custom size-1.5 rounded-full" />
            {eyebrow}
          </span>

          <h1 className="text-foreground text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
            {title}
          </h1>

          <p className="text-muted-foreground max-w-xl text-sm leading-relaxed sm:text-base">
            {subtitle}
          </p>

          <div className="mt-2 flex flex-wrap gap-2.5">
            {isLoading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-[52px] w-36 rounded-2xl" />
                ))
              : stats.map((stat, index) => (
                  <HeroStat key={stat.label} {...stat} delayMs={index * 120} />
                ))}
          </div>
        </div>
      </section>
    </DarkScope>
  )
}

function HeroStat({
  icon,
  label,
  value,
  kind,
  delayMs,
}: HeroStatItem & { delayMs: number }) {
  return (
    <div className="bg-background/60 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] backdrop-blur-sm">
      <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
        {icon}
      </span>
      <div className="flex flex-col leading-tight">
        <CountUp
          value={value}
          kind={kind}
          delayMs={delayMs}
          className="text-foreground text-sm font-semibold tabular-nums"
        />
        <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}
