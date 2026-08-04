import { Eye, MagnifyingGlass, Pulse, Sparkle } from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Dados & Métricas — observatório de
 * dados: aurora cyan+green, grid em pan, linha de gráfico serpenteando
 * com stroke fluindo e área respirando, pontos de dados acendendo em
 * sequência ao longo da curva, lupa flutuante com anéis, chips de KPI,
 * mini cluster de barras, sparkles, partículas e cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

/** Linha serpenteante em zigue-zague ascendente (esq → dir). */
const LINE =
  "M0 228 C 26 220 48 196 72 184 C 96 172 102 202 124 204 C 148 206 164 158 188 142 C 210 127 224 166 244 168 C 266 170 288 112 312 94 C 330 80 342 112 358 112 C 375 112 390 60 400 42"
const AREA = `${LINE} L400 260 L0 260 Z`

/** Pontos de dados nas dobras do path (coords % do viewBox 400×260). */
const DATA_POINTS = [
  { left: "18%", top: "70.8%", delay: 0.2 },
  { left: "31%", top: "78.5%", delay: 0.8 },
  { left: "47%", top: "54.6%", delay: 1.4 },
  { left: "61%", top: "64.6%", delay: 2 },
  { left: "78%", top: "36.2%", delay: 2.6 },
] as const

const SPARKLES = [
  { left: "24%", top: "10%", size: 11, delay: 0, dur: 3.6, color: "mint", lgOnly: false },
  { left: "50%", top: "6%", size: 9, delay: 1.3, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "68%", top: "18%", size: 13, delay: 2.2, dur: 3.4, color: "mint", lgOnly: false },
  { left: "88%", top: "8%", size: 9, delay: 0.7, dur: 4.6, color: "cyan", lgOnly: false },
  { left: "38%", top: "24%", size: 8, delay: 3, dur: 3.8, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "20%", bottom: "28%", size: 3, delay: 0.4, dur: 5.6, x: 12, opacity: 0.8 },
  { left: "38%", bottom: "24%", size: 2, delay: 2, dur: 6.6, x: -12, opacity: 0.6 },
  { left: "56%", bottom: "32%", size: 3, delay: 1.2, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "74%", bottom: "26%", size: 2, delay: 3.4, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "88%", bottom: "34%", size: 3, delay: 2.6, dur: 5.8, x: 8, opacity: 0.75 },
] as const

/** Mini cluster de barras (leituras do observatório). */
const BARS = [
  { height: "42%", delay: 0, dur: 2.6 },
  { height: "70%", delay: 0.25, dur: 3 },
  { height: "54%", delay: 0.5, dur: 2.4 },
  { height: "86%", delay: 0.75, dur: 3.2 },
  { height: "62%", delay: 1, dur: 2.8 },
] as const

export function DataMetricsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora em deriva */}
        <span className="arena-aurora absolute -top-14 right-[6%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[4%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* grid do observatório em pan */}
        <div className="hero-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_70%_60%,#000_30%,transparent_80%)]" />

        {/* feixe de luz varrendo */}
        <div className="absolute inset-y-0 left-1/4 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2.5s",
              "--comet-x": "-320px",
              "--comet-y": "220px",
              "--comet-angle": "-34deg",
            } as React.CSSProperties
          }
        />

        {/* sparkles cintilando */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.color === "mint"
                ? "text-[var(--brand-mint)]"
                : "text-[var(--brand-cyan)]",
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                "--twinkle-delay": `${sparkle.delay}s`,
                "--twinkle-dur": `${sparkle.dur}s`,
                "--twinkle-opacity": 0.9,
              } as React.CSSProperties
            }
          />
        ))}

        {/* partículas ascendentes */}
        {PARTICLES.map((particle, index) => (
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
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== gráfico central: linha serpenteando + área + pontos ===== */}
        <div className="absolute inset-x-0 bottom-0 h-[74%]">
          <svg
            viewBox="0 0 400 260"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient
                id="data-metrics-viz-stroke"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="var(--brand-cyan)" />
                <stop offset="100%" stopColor="var(--brand-mint)" />
              </linearGradient>
            </defs>

            {/* linhas-guia do observatório */}
            {[70, 135, 200].map((y) => (
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

            {/* área sob a linha, respirando */}
            <path
              d={AREA}
              fill="color-mix(in oklab, var(--brand-cyan) 8%, transparent)"
              className="hero-area-breathe"
            />

            {/* linha base (constante, mais suave) */}
            <path
              d={LINE}
              fill="none"
              stroke="url(#data-metrics-viz-stroke)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* linha fluindo (stroke tracejado correndo pela curva) */}
            <path
              d={LINE}
              fill="none"
              stroke="url(#data-metrics-viz-stroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="hero-trace"
            />
          </svg>

          {/* pontos de dados acendendo em sequência ao longo da linha */}
          {DATA_POINTS.map((point, index) => (
            <span
              key={index}
              className="absolute"
              style={{ left: point.left, top: point.top }}
            >
              <span
                className={cn(
                  "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40",
                  index % 2 === 0
                    ? "bg-[var(--brand-cyan)]"
                    : "bg-[var(--brand-mint)]",
                )}
              />
              <span
                className={cn(
                  "arena-twinkle absolute size-2.5 rounded-full",
                  index % 2 === 0
                    ? "bg-[var(--brand-cyan)] shadow-[0_0_10px_2px_color-mix(in_oklab,var(--brand-cyan)_55%,transparent)]"
                    : "bg-[var(--brand-mint)] shadow-[0_0_10px_2px_color-mix(in_oklab,var(--brand-mint)_55%,transparent)]",
                )}
                style={
                  {
                    marginLeft: -5,
                    marginTop: -5,
                    "--twinkle-delay": `${point.delay}s`,
                    "--twinkle-dur": "3.4s",
                    "--twinkle-opacity": 1,
                  } as React.CSSProperties
                }
              />
            </span>
          ))}
        </div>

        {/* badge lupa do observatório com anéis */}
        <div
          className="arena-tilt absolute top-[18%] right-[22%] xl:right-[24%]"
          style={{ "--float-dur": "6.8s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-mint)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-cyan)_60%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          <span className="bg-gradient-custom relative flex size-13 items-center justify-center rounded-full text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-14 xl:size-16">
            <MagnifyingGlass className="size-6 lg:size-7 xl:size-8" weight="fill" />
          </span>
        </div>

        {/* chips de KPI flutuantes */}
        <KpiChip
          icon={<Pulse className="size-3 text-[#04222A]" weight="fill" />}
          label="ER médio"
          value="4,2%"
          className="top-[52%] right-[6%]"
          delay={1.2}
          duration={7.6}
        />
        <KpiChip
          icon={<Eye className="size-3 text-[#04222A]" weight="fill" />}
          label="Views"
          value="1M+ views"
          className="top-[10%] right-[42%] hidden xl:flex"
          delay={0.3}
          duration={7}
        />

        {/* mini cluster de barras */}
        <div className="absolute right-[58%] bottom-[10%] flex h-10 items-end gap-1 lg:h-12">
          {BARS.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "hero-bar w-1.5 rounded-full",
                index % 2 === 0
                  ? "bg-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]"
                  : "bg-[color-mix(in_oklab,var(--brand-mint)_55%,transparent)]",
              )}
              style={
                {
                  height: bar.height,
                  "--bar-delay": `${bar.delay}s`,
                  "--bar-dur": `${bar.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiChip({
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
      <span className="text-foreground text-xs font-bold tabular-nums">
        {value}
      </span>
    </div>
  )
}

/**
 * Fantasma do observatório: a curva de dados com o traço correndo, a
 * lupa com anel orbitando, o cluster de barras e os chips de KPI.
 */
export function DataMetricsHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="70%">
      {/* curva de dados */}
      <div className="absolute inset-x-0 bottom-0 h-[74%]">
        <svg
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M0 150 C 60 120, 90 170, 140 130 S 220 60, 280 90 S 350 40, 400 30 L400 200 L0 200 Z"
            fill="rgba(255,255,255,0.045)"
            className="hero-area-breathe"
          />
          <path
            d="M0 150 C 60 120, 90 170, 140 130 S 220 60, 280 90 S 350 40, 400 30"
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 150 C 60 120, 90 170, 140 130 S 220 60, 280 90 S 350 40, 400 30"
            fill="none"
            stroke="color-mix(in oklab, var(--brand-cyan) 28%, transparent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="hero-trace"
          />
        </svg>
      </div>

      {/* badge lupa */}
      <div
        className="hero-float absolute top-[18%] right-[22%] xl:right-[24%]"
        style={{ "--float-dur": "6.8s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-white/15" />
        <GBone className="size-13 rounded-full lg:size-14 xl:size-16" />
      </div>

      {/* mini cluster de barras */}
      <div className="absolute right-[58%] bottom-[10%] flex h-10 items-end gap-1 lg:h-12">
        {[44, 76, 32, 88, 56, 68].map((height, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-1.5 rounded-full"
            style={
              {
                height: `${height}%`,
                "--bar-delay": `${index * 0.15}s`,
                "--bar-dur": "2.7s",
                "--shimmer-delay": `${index * 85}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* chips de KPI */}
      <GChip className="absolute top-[8%] right-[6%]" floatDelay={0.7} floatDur={7.4} />
      <GChip
        className="absolute right-[8%] bottom-[16%] hidden lg:flex"
        floatDelay={2.3}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
