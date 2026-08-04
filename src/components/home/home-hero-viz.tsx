import { Play, TrendUp } from "@phosphor-icons/react/dist/ssr"

import { GBars, GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/** Alturas base das barras de views (silhueta crescente, esq → dir). */
const BARS = [
  0.3, 0.42, 0.36, 0.5, 0.44, 0.58, 0.5, 0.66, 0.56, 0.72, 0.62, 0.8, 0.7,
  0.86, 0.78, 0.92, 0.84, 0.98,
]

/** Curva de views em ascensão, compartilhada pela área e pelas linhas. */
const LINE =
  "M0 200 C 40 196 64 176 100 170 C 140 163 150 138 196 138 C 236 138 248 104 292 96 C 332 89 356 60 400 44"
const AREA = `${LINE} L400 240 L0 240 Z`

/**
 * Visualização animada do hero — vocabulário Clipfy (views virais subindo):
 * composição CSS/SVG pura, sem JS, aria-hidden, com o gradiente da marca.
 */
export function HomeHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[60%] overflow-hidden lg:block xl:w-[56%]",
        className,
      )}
    >
      {/* fade à esquerda para fundir com a área de texto */}
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_40%)]">
        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-60" />

        {/* barras de views pulsando (atrás do gráfico) */}
        <div className="absolute inset-x-0 bottom-0 flex h-[44%] items-end gap-[3px] px-2 opacity-40">
          {BARS.map((height, index) => (
            <span
              key={index}
              className="hero-bar flex-1 rounded-t-[2px]"
              style={
                {
                  height: `${height * 100}%`,
                  background:
                    "linear-gradient(to top, var(--brand-cyan), color-mix(in oklab, var(--brand-green) 10%, transparent))",
                  "--bar-delay": `${index * 0.11}s`,
                  "--bar-dur": `${2.6 + (index % 5) * 0.2}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* área + linhas */}
        <svg
          viewBox="0 0 400 240"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="clipfy-hero-area" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--brand-cyan)"
                stopOpacity="0.38"
              />
              <stop
                offset="55%"
                stopColor="var(--brand-mint)"
                stopOpacity="0.1"
              />
              <stop
                offset="100%"
                stopColor="var(--brand-green)"
                stopOpacity="0"
              />
            </linearGradient>
            <linearGradient id="clipfy-hero-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--brand-cyan)" />
              <stop offset="55%" stopColor="var(--brand-mint)" />
              <stop offset="100%" stopColor="var(--brand-green)" />
            </linearGradient>
          </defs>

          {/* linhas-guia (hairlines) */}
          {[80, 140, 200].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="400"
              y2={y}
              stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* área */}
          <path
            d={AREA}
            fill="url(#clipfy-hero-area)"
            className="hero-area-breathe"
          />

          {/* linha base (constante, mais suave) */}
          <path
            d={LINE}
            fill="none"
            stroke="url(#clipfy-hero-stroke)"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* linha "fluindo" (stroke animado correndo pela curva) */}
          <path
            d={LINE}
            fill="none"
            stroke="url(#clipfy-hero-stroke)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="hero-trace"
          />
        </svg>

        {/* dot de "agora" com halo pulsante (no topo da curva) */}
        <span className="absolute top-[14%] right-[5%]">
          <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_40%,transparent)]" />
          <span className="ring-background block size-2.5 rounded-full bg-[var(--brand-green)] ring-2" />
        </span>

        {/* chips flutuantes — vocabulário de competição de cortes */}
        <ViralChip
          icon={<Play weight="fill" className="size-3 text-[#04222A]" />}
          label="Corte viral"
          value="2,4M views"
          className="top-[20%] right-[13%]"
          delay={0}
          duration={7}
        />
        <ViralChip
          icon={<TrendUp weight="bold" className="size-3 text-[#04222A]" />}
          label="Ranking diário"
          value="#1 · R$ 350"
          className="top-[54%] right-[32%]"
          delay={1.4}
          duration={8.2}
        />
      </div>
    </div>
  )
}

function ViralChip({
  icon,
  label,
  value,
  className,
  delay,
  duration,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
  delay: number
  duration: number
}) {
  return (
    <div
      className={cn(
        "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md",
        className,
      )}
      style={
        {
          "--float-delay": `${delay}s`,
          "--float-dur": `${duration}s`,
        } as React.CSSProperties
      }
    >
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
        <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-foreground text-sm font-bold tabular-nums">
        {value}
      </span>
    </div>
  )
}

/**
 * Fantasma da curva de crescimento: as barras de views na base (mesma
 * onda), a curva desenhada em osso com o traço correndo, o ponto de
 * "agora" e os dois chips flutuantes nas mesmas âncoras.
 */
export function HomeHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost
      className={className}
      show="lg:block"
      width="w-[60%] xl:w-[56%]"
      mask="40%"
      focus="70%"
    >
      {/* barras de views pulsando na base */}
      <GBars
        heights={BARS.map((bar) => Math.round(bar * 100))}
        className="absolute inset-x-0 bottom-0 h-[44%] gap-[3px] px-2 opacity-45"
        barClass="flex-1 rounded-t-[2px]"
      />

      {/* curva fantasma com o traço correndo */}
      <svg
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={AREA}
          fill="rgba(255,255,255,0.045)"
          className="hero-area-breathe"
        />
        <path
          d={LINE}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={LINE}
          fill="none"
          stroke="color-mix(in oklab, var(--brand-cyan) 30%, transparent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="hero-trace"
        />
      </svg>

      {/* ponto de "agora" */}
      <span className="absolute top-[14%] right-[5%]">
        <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-white/10" />
        <GBone className="size-2.5 rounded-full" />
      </span>

      {/* chips flutuantes */}
      <GChip
        className="absolute top-[20%] right-[13%]"
        floatDur={7}
        delay={120}
      />
      <GChip
        className="absolute top-[54%] right-[32%]"
        floatDelay={1.4}
        floatDur={8.2}
        delay={260}
      />
    </VizGhost>
  )
}
