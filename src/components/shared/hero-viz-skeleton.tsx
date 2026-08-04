import { cn } from "@/lib/utils"

/* ============================================================
   KIT DO FANTASMA DAS VISUALIZAÇÕES DO HERO
   Cada *-hero-viz.tsx exporta o seu próprio fantasma montado
   com estas peças, espelhando a composição real da animação
   (mesma geometria, mesma máscara, mesmos pontos de ancoragem)
   — então não há salto de layout quando os dados chegam.

   Os heros são #050f1c NOS DOIS TEMAS: por isso os ossos aqui
   usam .skeleton-bone-strong (véu branco) em vez do --muted,
   que sumiria no light.
   ============================================================ */

/**
 * Container do fantasma — replica a caixa das vizzes: faixa à direita
 * do hero, escondida no mobile, com máscara que dissolve à esquerda.
 */
export function VizGhost({
  children,
  className,
  /** Largura da faixa (algumas vizzes usam faixas mais largas). */
  width = "w-[46%] lg:w-[54%] xl:w-[48%]",
  /** Breakpoint em que a faixa aparece — igual ao da viz real. */
  show = "md:block",
  /** Onde a máscara termina de dissolver (igual ao da viz real). */
  mask = "48%",
  /** Ponto de foco da aurora/grid — acompanha a âncora da composição. */
  focus = "68%",
}: {
  children: React.ReactNode
  className?: string
  width?: string
  show?: string
  mask?: string
  focus?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden overflow-hidden",
        show,
        width,
        className,
      )}
    >
      <div
        className="relative h-full w-full"
        style={{
          maskImage: `linear-gradient(to right, transparent, #000 ${mask})`,
          WebkitMaskImage: `linear-gradient(to right, transparent, #000 ${mask})`,
        }}
      >
        {/* Auroras da marca — mais discretas que na viz real */}
        <span className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_16%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[40%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_12%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />
        {/* Grid em pan — o "chão" de todas as vizzes */}
        <div
          className="hero-grid absolute inset-0 opacity-25"
          style={{
            maskImage: `radial-gradient(ellipse at ${focus} 50%, #000 28%, transparent 78%)`,
            WebkitMaskImage: `radial-gradient(ellipse at ${focus} 50%, #000 28%, transparent 78%)`,
          }}
        />
        {children}
      </div>
    </div>
  )
}

/** Osso do fantasma (véu branco + shimmer ciano). `delay` em ms. */
export function GBone({
  className,
  delay = 0,
  style,
  faint = false,
}: {
  className?: string
  delay?: number
  style?: React.CSSProperties
  /** Camadas de fundo (cards empilhados atrás) ficam mais apagadas. */
  faint?: boolean
}) {
  return (
    <span
      className={cn(
        "skeleton-bone block",
        faint ? "skeleton-bone-faint" : "skeleton-bone-strong",
        className,
      )}
      style={{ ["--shimmer-delay" as string]: `${delay}ms`, ...style }}
    />
  )
}

/**
 * Painel fantasma — o "card" central da maioria das vizzes: vidro
 * petróleo, hairline ciano no topo e flutuação suave.
 */
export function GPanel({
  children,
  className,
  float = true,
  floatDelay = 0,
  floatDur = 8,
  style,
}: {
  children?: React.ReactNode
  className?: string
  float?: boolean
  floatDelay?: number
  floatDur?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn(
        "skeleton-panel relative rounded-2xl",
        float && "hero-float",
        className,
      )}
      style={{
        ["--float-delay" as string]: `${floatDelay}s`,
        ["--float-dur" as string]: `${floatDur}s`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/**
 * Chip flutuante fantasma — os balões de métrica que orbitam as vizzes.
 * `lines` controla quantas linhas de texto fantasma aparecem.
 */
export function GChip({
  className,
  lines = 2,
  icon = true,
  delay = 0,
  floatDelay = 0,
  floatDur = 7,
  style,
}: {
  className?: string
  lines?: number
  icon?: boolean
  delay?: number
  floatDelay?: number
  floatDur?: number
  style?: React.CSSProperties
}) {
  return (
    <GPanel
      className={cn("flex items-center gap-2 px-2.5 py-2", className)}
      floatDelay={floatDelay}
      floatDur={floatDur}
      style={style}
    >
      {icon && <GBone delay={delay} className="size-5 shrink-0 rounded-lg" />}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <GBone delay={delay + 60} className="h-2 w-12 rounded-full" />
        {lines > 1 && (
          <GBone delay={delay + 120} className="h-2.5 w-16 rounded-full" />
        )}
        {lines > 2 && (
          <GBone delay={delay + 180} className="h-2 w-10 rounded-full" />
        )}
      </span>
    </GPanel>
  )
}

/** Anel fantasma (troféu/avatar/medidor com órbita). */
export function GRing({
  className,
  delay = 0,
  dashed = true,
}: {
  className?: string
  delay?: number
  dashed?: boolean
}) {
  return (
    <span className={cn("relative block", className)}>
      <span
        className={cn(
          "arena-ring absolute -inset-2 rounded-full border",
          dashed ? "border-dashed" : "",
          "border-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)]",
        )}
      >
        <span className="bg-gradient-custom absolute top-1/2 -right-1 size-1.5 -translate-y-1/2 rounded-full opacity-70" />
      </span>
      <GBone delay={delay} className="size-full rounded-full" />
    </span>
  )
}

/**
 * Barras fantasma pulsando em onda (reusa .hero-bar) — para as vizzes
 * de gráfico/pódio. `heights` em % da caixa.
 */
export function GBars({
  heights,
  className,
  barClass = "flex-1 rounded-t-lg",
  delay = 0,
}: {
  heights: number[]
  className?: string
  barClass?: string
  delay?: number
}) {
  return (
    <div className={cn("flex items-end gap-1.5", className)}>
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            "hero-bar skeleton-bone skeleton-bone-strong block",
            barClass,
          )}
          style={
            {
              height: `${height}%`,
              "--bar-delay": `${index * 0.14}s`,
              "--bar-dur": "2.8s",
              "--shimmer-delay": `${delay + index * 110}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** Linhas de texto fantasma empilhadas (títulos/legendas dentro dos cards). */
export function GLines({
  widths,
  className,
  delay = 0,
  heightClass = "h-2",
}: {
  widths: string[]
  className?: string
  delay?: number
  heightClass?: string
}) {
  return (
    <span className={cn("flex flex-col gap-1.5", className)}>
      {widths.map((width, index) => (
        <GBone
          key={index}
          delay={delay + index * 70}
          className={cn("rounded-full", heightClass)}
          style={{ width }}
        />
      ))}
    </span>
  )
}
