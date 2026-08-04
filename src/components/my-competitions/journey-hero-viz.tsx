import {
  Crown,
  Fire,
  Lightning,
  Sparkle,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Minhas Competições — a escalada do
 * ranking: aurora em deriva, piso em perspectiva, quatro degraus
 * ascendentes com glow no topo, trilha tracejada de subida, badge
 * escalador com anéis orbitando, chips de posição (#12 → #5 → #1)
 * subindo em diagonal, partículas, sparkles e cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const STEPS = [
  { height: "h-[16%]", accent: "cyan", delay: 0.1 },
  { height: "h-[26%]", accent: "mint", delay: 0.3 },
  { height: "h-[36%]", accent: "green", delay: 0.5 },
  { height: "h-[46%]", accent: "gradient", delay: 0.7 },
] as const

const PARTICLES = [
  { left: "38%", bottom: "20%", size: 3, delay: 0.2, dur: 5.6, x: 10, opacity: 0.8 },
  { left: "50%", bottom: "26%", size: 2, delay: 1.8, dur: 6.4, x: -10, opacity: 0.6 },
  { left: "62%", bottom: "34%", size: 3, delay: 0.9, dur: 5.8, x: 8, opacity: 0.85 },
  { left: "74%", bottom: "40%", size: 2, delay: 2.6, dur: 6.8, x: -12, opacity: 0.6 },
  { left: "84%", bottom: "48%", size: 3, delay: 1.4, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "92%", bottom: "42%", size: 2, delay: 3.4, dur: 6.2, x: -8, opacity: 0.55 },
] as const

const SPARKLES = [
  { left: "30%", top: "10%", size: 11, delay: 0, dur: 3.8, color: "mint", lgOnly: false },
  { left: "52%", top: "6%", size: 9, delay: 1.3, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "72%", top: "12%", size: 13, delay: 2.2, dur: 3.4, color: "mint", lgOnly: false },
  { left: "90%", top: "8%", size: 9, delay: 0.8, dur: 4.6, color: "cyan", lgOnly: false },
  { left: "44%", top: "20%", size: 8, delay: 3, dur: 3.6, color: "cyan", lgOnly: true },
] as const

export function JourneyHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-12 right-[14%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[52%] bottom-[8%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-5s" }}
        />

        {/* piso em perspectiva, sutil */}
        <div className="absolute inset-x-[-20%] bottom-[-6%] h-[58%] [transform:perspective(620px)_rotateX(58deg)] [transform-origin:bottom]">
          <div className="hero-grid absolute inset-0 opacity-45 [mask-image:radial-gradient(ellipse_at_60%_100%,#000_25%,transparent_78%)]" />
        </div>

        {/* trilha tracejada de subida */}
        <svg
          className="absolute right-[10%] bottom-[6%] left-[26%] h-[58%] opacity-70"
          viewBox="0 0 300 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M6 194 C 70 188, 132 156, 178 112 C 224 68, 262 36, 294 12"
            className="hero-trace"
            stroke="color-mix(in oklab, var(--brand-mint) 55%, transparent)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[5%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2.5s",
              "--comet-x": "-320px",
              "--comet-y": "210px",
              "--comet-angle": "-33deg",
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

        {/* partículas subindo ao longo dos degraus */}
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

        {/* degraus ascendentes da esquerda para a direita */}
        <div className="absolute right-[10%] bottom-0 flex items-end gap-2 lg:gap-2.5">
          {STEPS.map((step, index) => (
            <div
              key={index}
              className={cn(
                "arena-podium relative w-[clamp(44px,5vw,72px)] overflow-hidden rounded-t-2xl ring-1 ring-white/8",
                step.height,
                step.accent === "cyan" &&
                  "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_24%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_9%,transparent)] to-transparent",
                step.accent === "mint" &&
                  "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_22%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_9%,transparent)] to-transparent",
                step.accent === "green" &&
                  "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-green)_24%,transparent)] via-[color-mix(in_oklab,var(--brand-green)_9%,transparent)] to-transparent",
                step.accent === "gradient" &&
                  "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_12%,transparent)] to-transparent",
              )}
              style={{ "--rise-delay": `${step.delay}s` } as React.CSSProperties}
            >
              <span
                className={cn(
                  "hero-podium-glow absolute inset-x-0 top-0 h-[3px] rounded-full",
                  step.accent === "cyan" && "bg-[var(--brand-cyan)]",
                  step.accent === "mint" && "bg-[var(--brand-mint)]",
                  step.accent === "green" && "bg-[var(--brand-green)]",
                  step.accent === "gradient" && "bg-gradient-custom",
                )}
                style={{ "--podium-delay": `${step.delay}s` } as React.CSSProperties}
              />
              {step.accent === "gradient" && (
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
                  style={{ "--shine-delay": "2.2s" } as React.CSSProperties}
                />
              )}
            </div>
          ))}
        </div>

        {/* badge escalador flutuando sobre o degrau mais alto */}
        <div
          className="arena-tilt absolute bottom-[54%] translate-x-1/2"
          style={
            {
              right: "calc(10% + clamp(44px, 5vw, 72px) / 2)",
              "--float-dur": "6.6s",
            } as React.CSSProperties
          }
        >
          <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-mint)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-cyan)_60%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          <span
            className="arena-ring absolute -inset-5 hidden rounded-full lg:block"
            style={{ animationDuration: "14s" }}
          >
            <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
          </span>
          <span className="bg-gradient-custom relative flex size-11 items-center justify-center rounded-full text-[#04222A] shadow-[0_14px_40px_-10px_rgba(31,254,200,0.6)] lg:size-13 xl:size-14">
            <Lightning className="size-5 lg:size-6 xl:size-7" weight="fill" />
          </span>
        </div>

        {/* chips de posição subindo em diagonal */}
        <span
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[22%] left-[34%] flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold opacity-70 shadow-lg ring-1 ring-white/10 backdrop-blur-md"
          style={{ "--float-delay": "1.2s", "--float-dur": "7.6s" } as React.CSSProperties}
        >
          <TrendUp className="size-2.5 text-[var(--brand-green)]" weight="bold" />
          <span className="text-foreground/60 tabular-nums">#12</span>
        </span>
        <span
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[38%] left-[47%] flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "2.2s", "--float-dur": "8.2s" } as React.CSSProperties}
        >
          <TrendUp className="size-3 text-[var(--brand-green)]" weight="bold" />
          <span className="text-foreground/85 tabular-nums">#5</span>
        </span>
        <span
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[56%] left-[60%] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--brand-mint)_50%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "0.4s", "--float-dur": "7s" } as React.CSSProperties}
        >
          <Crown className="size-4 text-yellow-400" weight="fill" />
          <span className="text-foreground tabular-nums">#1</span>
        </span>

        {/* chips flutuantes */}
        <FloatChip
          icon={<Fire className="size-3 text-[#04222A]" weight="fill" />}
          label="Sequência"
          value="Subindo"
          className="top-[8%] right-[5%]"
          delay={0.8}
          duration={7.8}
        />
        <FloatChip
          icon={<TrendUp className="size-3 text-[#04222A]" weight="bold" />}
          label="Sua posição"
          value="Rumo ao topo"
          className="top-[20%] right-[38%] hidden lg:flex"
          delay={2}
          duration={8.6}
        />
      </div>
    </div>
  )
}

function FloatChip({
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
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  )
}

/**
 * Fantasma da jornada: o piso em perspectiva, os degraus ascendentes, o
 * escalador sobre o degrau mais alto e os chips de posição em diagonal.
 */
export function JourneyHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="62%">
      {/* piso em perspectiva */}
      <div className="absolute inset-x-[-20%] bottom-[-6%] h-[58%] [transform:perspective(620px)_rotateX(58deg)] [transform-origin:bottom]">
        <div className="hero-grid absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_60%_100%,#000_25%,transparent_78%)]" />
      </div>

      {/* degraus ascendentes */}
      <div className="absolute right-[10%] bottom-0 flex items-end gap-2 lg:gap-2.5">
        {[22, 34, 46, 60, 76].map((height, index) => (
          <GBone
            key={index}
            delay={index * 110}
            className="arena-podium w-[clamp(44px,5vw,72px)] rounded-t-xl"
            style={{
              height: `${height}%`,
              ["--rise-delay" as string]: `${0.15 + index * 0.12}s`,
            }}
          />
        ))}
      </div>

      {/* escalador sobre o degrau mais alto */}
      <div className="hero-float absolute right-[12%] bottom-[54%] translate-x-1/2">
        <span className="arena-ring absolute -inset-2 rounded-full border border-dashed border-white/15" />
        <GBone className="size-11 rounded-full lg:size-13 xl:size-14" />
      </div>

      {/* chips de posição subindo em diagonal */}
      <GPanel
        className="absolute bottom-[22%] left-[34%] flex items-center gap-1 px-2 py-0.5 opacity-70"
        floatDelay={0.4}
        floatDur={7}
      >
        <GBone className="size-2.5 shrink-0 rounded-full" />
        <GBone delay={60} className="h-1.5 w-6 rounded-full" />
      </GPanel>
      <GPanel
        className="absolute bottom-[38%] left-[47%] flex items-center gap-1 px-2.5 py-1"
        floatDelay={1.4}
        floatDur={7.8}
      >
        <GBone delay={120} className="size-3 shrink-0 rounded-full" />
        <GBone delay={180} className="h-2 w-7 rounded-full" />
      </GPanel>
      <GPanel
        className="absolute bottom-[56%] left-[60%] flex items-center gap-1.5 px-3 py-1.5"
        floatDelay={2.2}
        floatDur={8.4}
      >
        <GBone delay={240} className="size-4 shrink-0 rounded-full" />
        <GBone delay={300} className="h-2.5 w-9 rounded-full" />
      </GPanel>

      {/* chips de contexto */}
      <GChip className="absolute top-[10%] right-[8%]" floatDelay={1} floatDur={7.4} />
      <GChip
        className="absolute top-[34%] right-[42%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
