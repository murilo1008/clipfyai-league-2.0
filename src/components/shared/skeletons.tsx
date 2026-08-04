import { DarkScope } from "@/components/shared/dark-scope"
import { GBars, GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/* ============================================================
   KIT DE SKELETON DA MARCA
   "Ossos" com shimmer ciano varrendo (classe .skeleton-bone do
   globals.css), stagger automático e fantasmas que espelham o
   layout real de cada página — sem layout shift ao carregar.
   ============================================================ */

/**
 * Osso base: bloco com shimmer da marca. Use `delay` (ms) para stagger e
 * `strong` quando o osso ficar sobre uma faixa escura da marca (#050f1c),
 * onde o --muted do dark é escuro demais para ler.
 */
export function Bone({
  className,
  delay = 0,
  strong = false,
}: {
  className?: string
  delay?: number
  strong?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "skeleton-bone block rounded-xl",
        strong && "skeleton-bone-strong",
        className,
      )}
      style={
        delay
          ? ({ "--shimmer-delay": `${delay}ms` } as React.CSSProperties)
          : undefined
      }
    />
  )
}

/**
 * Fantasma padrão da viz — pódio + chip, usado quando a página não passa
 * o fantasma específico da sua animação.
 */
export function DefaultVizGhost() {
  return (
    <VizGhost>
      <div className="absolute top-1/2 right-[10%] w-[clamp(200px,26vw,300px)] -translate-y-1/2">
        <GPanel className="flex items-center gap-3 p-3">
          <GBone className="size-12 shrink-0 rounded-xl" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <GBone delay={80} className="h-2.5 w-[80%] rounded-full" />
            <GBone delay={160} className="h-2 w-[55%] rounded-full" />
          </span>
        </GPanel>
        <GBars
          heights={[52, 92, 38]}
          delay={240}
          className="mt-4 h-24 items-end justify-center gap-2.5 px-4"
          barClass="w-[clamp(40px,5vw,68px)] rounded-t-2xl"
        />
      </div>
    </VizGhost>
  )
}

/**
 * Skeleton do hero dark (HomeHero/heróis de página): faixa escura com
 * eyebrow, título, subtítulo, pills de stats e o fantasma da visualização
 * animada da própria página à direita (prop `viz`).
 *
 * Fica sempre em DarkScope — o hero é #050f1c nos dois temas, então os
 * ossos precisam dos tokens do dark mesmo com o tema light ativo.
 */
export function HeroSkeleton({
  stats = 3,
  className,
  viz,
}: {
  stats?: number
  className?: string
  /** Fantasma da animação desta página (ex.: <ArenaHeroVizSkeleton />). */
  viz?: React.ReactNode
}) {
  return (
    <DarkScope className="contents">
      <section
        className={cn(
          "relative overflow-hidden rounded-3xl bg-[#050f1c] p-6 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] sm:p-8 lg:p-10",
          className,
        )}
      >
        {/* glows fixos, como no hero real */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_10%,transparent)] blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)] to-transparent"
        />

        {/* fantasma da viz à direita */}
        {viz ?? <DefaultVizGhost />}

        <div className="relative z-10 flex max-w-2xl flex-col gap-4">
          <Bone strong className="h-3.5 w-44 rounded-full" />
          <div className="flex flex-col gap-2.5">
            <Bone strong delay={80} className="h-9 w-4/5 max-w-md sm:h-11" />
            <Bone strong delay={160} className="h-9 w-3/5 max-w-sm sm:h-11" />
          </div>
          <div className="flex flex-col gap-2">
            <Bone strong delay={240} className="h-4 w-full max-w-xl" />
            <Bone strong delay={300} className="h-4 w-2/3 max-w-md" />
          </div>
          <div className="mt-2 flex flex-wrap gap-2.5">
            {Array.from({ length: stats }).map((_, index) => (
              <Bone
                strong
                key={index}
                delay={360 + index * 120}
                className="h-[52px] w-36 rounded-2xl"
              />
            ))}
          </div>
        </div>
      </section>
    </DarkScope>
  )
}

/** Skeleton de um StatTile (glass-card com label, chip, valor e hint). */
export function StatTileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="glass-card flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Bone delay={delay} className="h-3 w-24 rounded-full" />
        <Bone delay={delay + 60} className="size-8 rounded-lg" />
      </div>
      <Bone delay={delay + 120} className="h-8 w-24" />
      <Bone delay={delay + 180} className="h-3 w-28 rounded-full" />
    </div>
  )
}

/** Grid responsivo de StatTiles fantasmas. */
export function StatTilesGridSkeleton({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <StatTileSkeleton key={index} delay={index * 100} />
      ))}
    </div>
  )
}

/** Skeleton da toolbar de filtros (busca + botões). */
export function ToolbarSkeleton({
  buttons = 3,
  className,
}: {
  buttons?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center",
        className,
      )}
    >
      <Bone className="h-10 min-w-0 flex-1 rounded-xl" />
      <div className="flex flex-wrap items-center gap-2.5">
        {Array.from({ length: buttons }).map((_, index) => (
          <Bone
            key={index}
            delay={100 + index * 100}
            className="h-10 w-28 rounded-xl sm:w-32"
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton de tabela (glass-card): header + linhas com avatar,
 * textos e badges, escondendo colunas no mobile como a tabela real.
 */
export function TableSkeleton({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn("glass-card overflow-hidden rounded-3xl", className)}>
      <div className="border-border/60 flex items-center gap-4 border-b px-4 py-4">
        <Bone className="h-3 w-24 rounded-full" />
        <Bone delay={80} className="hidden h-3 w-20 rounded-full sm:block" />
        <Bone delay={160} className="hidden h-3 w-24 rounded-full md:block" />
        <Bone delay={240} className="ml-auto h-3 w-16 rounded-full" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border-border/40 flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
        >
          <Bone delay={index * 90} className="size-10 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={index * 90 + 40} className="h-3.5 w-2/5 max-w-40" />
            <Bone
              delay={index * 90 + 80}
              className="h-3 w-1/4 max-w-24 rounded-full"
            />
          </div>
          <Bone
            delay={index * 90 + 120}
            className="hidden h-6 w-20 rounded-full sm:block"
          />
          <Bone
            delay={index * 90 + 160}
            className="hidden h-6 w-24 rounded-full lg:block"
          />
          <Bone delay={index * 90 + 200} className="size-8 rounded-lg" />
        </div>
      ))}
      <div className="border-border/60 flex items-center justify-between border-t px-4 py-3.5">
        <Bone className="h-3 w-32 rounded-full" />
        <div className="flex gap-2">
          <Bone delay={100} className="h-9 w-24 rounded-xl" />
          <Bone delay={200} className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton de grid de cards (competições/posts/contas):
 * capa + textos + mini-grid de stats.
 */
export function CardGridSkeleton({
  count = 6,
  aspectClass = "aspect-square",
  className,
  gridClass = "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  withStats = true,
}: {
  count?: number
  aspectClass?: string
  className?: string
  gridClass?: string
  withStats?: boolean
}) {
  return (
    <div className={cn("grid gap-4", gridClass, className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="glass-card flex flex-col gap-4 rounded-3xl p-4">
          <Bone
            delay={index * 120}
            className={cn("w-full rounded-2xl", aspectClass)}
          />
          <div className="flex flex-col gap-2">
            <Bone delay={index * 120 + 60} className="h-4 w-3/4" />
            <Bone
              delay={index * 120 + 120}
              className="h-3 w-full rounded-full"
            />
          </div>
          {withStats && (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, statIndex) => (
                <Bone
                  key={statIndex}
                  delay={index * 120 + 180 + statIndex * 60}
                  className="h-14 rounded-xl"
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Skeleton "vivo" de gráfico: barras fantasma pulsando em onda
 * (reusa a animação hero-bar) dentro de um glass-card.
 */
export function ChartSkeleton({
  heightClass = "h-64",
  bars = 12,
  title = true,
  className,
}: {
  heightClass?: string
  bars?: number
  title?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6",
        className,
      )}
    >
      {title && (
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-4 w-40" />
            <Bone delay={120} className="h-3 w-28 rounded-full" />
          </div>
        </div>
      )}
      <div
        className={cn(
          "flex items-end justify-between gap-1.5 sm:gap-2.5",
          heightClass,
        )}
      >
        {Array.from({ length: bars }).map((_, index) => {
          const height = 24 + ((index * 37) % 68)
          return (
            <span
              key={index}
              aria-hidden
              className="hero-bar skeleton-bone w-full rounded-t-lg"
              style={
                {
                  height: `${height}%`,
                  "--bar-delay": `${index * 0.12}s`,
                  "--bar-dur": "2.6s",
                  "--shimmer-delay": `${index * 90}ms`,
                } as React.CSSProperties
              }
            />
          )
        })}
      </div>
    </div>
  )
}

/** Skeleton de lista (avatar + linhas + valor à direita). */
export function ListRowsSkeleton({
  rows = 5,
  avatar = true,
  className,
}: {
  rows?: number
  avatar?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3.5 py-3"
        >
          {avatar && (
            <Bone delay={index * 100} className="size-10 shrink-0 rounded-xl" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={index * 100 + 50} className="h-3.5 w-1/3 max-w-36" />
            <Bone
              delay={index * 100 + 100}
              className="h-3 w-1/2 max-w-48 rounded-full"
            />
          </div>
          <Bone
            delay={index * 100 + 150}
            className="h-6 w-16 rounded-full sm:w-20"
          />
        </div>
      ))}
    </div>
  )
}

/** Skeleton do donut (círculo com furo + legenda). */
export function DonutSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <Bone className="size-8 rounded-lg" />
        <Bone delay={60} className="h-4 w-44" />
      </div>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
        <span className="skeleton-bone size-40 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-26px),#000_calc(100%-25px))] sm:size-48" />
        <div className="flex w-full max-w-56 flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <Bone delay={index * 110} className="size-2.5 rounded-full" />
              <Bone
                delay={index * 110 + 50}
                className="h-3 flex-1 rounded-full"
              />
              <Bone delay={index * 110 + 100} className="h-3 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
