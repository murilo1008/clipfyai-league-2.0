"use client"

import {
  Bone,
  CardGridSkeleton,
  ChartSkeleton,
  StatTileSkeleton,
} from "@/components/shared/skeletons"

/**
 * Skeleton da página da competição do clipador — espelha o layout real
 * (hero dark, meta de views, bloco de views, quick stats, gráfico + post
 * viral, cards de visão geral e grid de posts 9:16) sem layout shift.
 */
export function CompetitionSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
      {/* ===== Hero dark ===== */}
      <section className="dark relative overflow-hidden rounded-3xl bg-[#050f1c] p-5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] sm:p-7 lg:p-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[6%] size-64 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-[18%] size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_8%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] to-transparent"
        />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row">
          {/* Capa 1:1 */}
          <Bone className="hidden aspect-square w-56 shrink-0 self-start rounded-2xl lg:block lg:w-64" />

          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            {/* Badges + ações */}
            <div className="flex flex-wrap items-center gap-2">
              <Bone className="h-6 w-20 rounded-full" />
              <Bone delay={80} className="h-6 w-32 rounded-full" />
              <div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
                <Bone delay={160} className="h-9 w-36" />
                <Bone delay={240} className="h-9 w-40" />
                <Bone delay={320} className="h-9 w-32" />
              </div>
            </div>

            {/* Título + descrição */}
            <Bone delay={200} className="h-9 w-4/5 max-w-lg sm:h-10 lg:h-11" />
            <div className="flex max-w-3xl flex-col gap-2">
              <Bone delay={300} className="h-4 w-full rounded-full" />
              <Bone delay={380} className="h-4 w-2/3 rounded-full" />
            </div>

            {/* Plataformas */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Bone
                  key={index}
                  delay={460 + index * 90}
                  className="h-6 w-24 rounded-full"
                />
              ))}
            </div>

            {/* Período + prêmio */}
            <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
              <Bone delay={640} className="h-5 w-56 rounded-full" />
              <Bone delay={720} className="h-7 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Meta de Views ===== */}
      <div className="glass-card flex flex-col gap-5 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bone className="size-11 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Bone delay={60} className="h-4 w-32" />
              <Bone delay={120} className="h-3 w-44 rounded-full" />
            </div>
          </div>
          <Bone delay={180} className="hidden h-7 w-44 rounded-full sm:block" />
        </div>
        <div className="flex flex-col gap-3 pt-4">
          <Bone delay={240} className="h-4 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Bone delay={300} className="h-3 w-16 rounded-full" />
            <Bone delay={360} className="h-3 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Bone delay={420} className="h-8 w-24 rounded-full" />
          <Bone delay={480} className="h-4 w-40 rounded-full" />
        </div>
      </div>

      {/* ===== Suas Views Totais / Score ===== */}
      <div className="glass-card grid gap-4 rounded-3xl p-4 sm:grid-cols-2 sm:p-6">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-2xl border border-border/50 p-4 sm:p-5"
          >
            <Bone delay={index * 150} className="size-14 rounded-xl" />
            <div className="flex flex-col gap-2">
              <Bone delay={index * 150 + 60} className="h-3 w-28 rounded-full" />
              <Bone delay={index * 150 + 120} className="h-8 w-32" />
              <Bone
                delay={index * 150 + 180}
                className="h-3 w-40 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>

      {/* ===== Quick stats (capa + 3 tiles) ===== */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bone className="aspect-square w-full rounded-2xl" />
        {Array.from({ length: 3 }).map((_, index) => (
          <StatTileSkeleton key={index} delay={120 + index * 100} />
        ))}
      </div>

      {/* ===== Gráfico + Post viral ===== */}
      <div className="grid gap-4 lg:grid-cols-7">
        <ChartSkeleton heightClass="h-64 sm:h-72" className="lg:col-span-5" />
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <Bone delay={60} className="h-4 w-32" />
          </div>
          <Bone delay={120} className="aspect-square w-full rounded-2xl" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <Bone
                  delay={180 + index * 70}
                  className="h-3 w-14 rounded-full"
                />
                <Bone
                  delay={220 + index * 70}
                  className="h-3 w-16 rounded-full"
                />
              </div>
            ))}
          </div>
          <Bone delay={460} className="h-9 w-full rounded-xl" />
        </div>
      </div>

      {/* ===== Visão geral + Conquistas ===== */}
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, cardIndex) => (
          <div
            key={cardIndex}
            className="glass-card flex flex-col gap-3 rounded-3xl p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <Bone delay={cardIndex * 120} className="size-8 rounded-lg" />
              <Bone delay={cardIndex * 120 + 60} className="h-4 w-36" />
            </div>
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <Bone
                key={rowIndex}
                delay={cardIndex * 120 + 140 + rowIndex * 90}
                className="h-14 w-full rounded-xl"
              />
            ))}
          </div>
        ))}
      </div>

      {/* ===== Tabs + grid de posts 9:16 ===== */}
      <Bone className="h-12 w-full rounded-2xl" />
      <CardGridSkeleton
        count={6}
        aspectClass="aspect-[9/16]"
        gridClass="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        withStats={false}
      />
    </div>
  )
}
