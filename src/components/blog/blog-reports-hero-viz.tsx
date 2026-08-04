import {
  Broadcast,
  Eye,
  Sparkle,
  TrendUp,
  User,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Métricas do Blog — torre de audiência:
 * aurora ciano + âmbar, uma antena/torre transmitindo, arcos de alcance
 * se propagando, leitores chegando em bolhas, contador de views enchendo,
 * barras de audiência por dia, sparkles, partículas e um cometa âmbar.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const AMBER = "#fbbf24"

/** Arcos concêntricos de transmissão (ondas de alcance). */
const ARCS = [
  { size: "clamp(84px,11vw,136px)", delay: 0, dur: 3.6, strength: 60 },
  { size: "clamp(128px,17vw,206px)", delay: 1.2, dur: 3.6, strength: 46 },
  { size: "clamp(172px,23vw,276px)", delay: 2.4, dur: 3.6, strength: 34 },
] as const

/** Leitores chegando ao alcance da antena. */
const READERS = [
  {
    className: "top-[22%] right-[16%]",
    rise: 0.4,
    floatDelay: 0.2,
    floatDur: 6.6,
    tone: "mint",
    lgOnly: false,
  },
  {
    className: "top-[48%] right-[5%]",
    rise: 1.1,
    floatDelay: 1.6,
    floatDur: 7.4,
    tone: "cyan",
    lgOnly: false,
  },
  {
    className: "top-[35%] right-[27%]",
    rise: 1.8,
    floatDelay: 2.8,
    floatDur: 8,
    tone: "amber",
    lgOnly: true,
  },
] as const

/** Audiência por dia — cluster de barras na base. */
const AUDIENCE_BARS = [
  { height: "42%", delay: 0, dur: 2.8 },
  { height: "68%", delay: 0.25, dur: 3.2 },
  { height: "92%", delay: 0.5, dur: 2.6 },
  { height: "58%", delay: 0.75, dur: 3.4 },
  { height: "78%", delay: 1, dur: 3 },
] as const

const SPARKLES = [
  { left: "26%", top: "10%", size: 11, delay: 0.4, dur: 3.6, tone: "cyan", lgOnly: false },
  { left: "54%", top: "6%", size: 9, delay: 1.6, dur: 4.4, tone: "amber", lgOnly: true },
  { left: "78%", top: "14%", size: 13, delay: 2.4, dur: 3.4, tone: "mint", lgOnly: false },
  { left: "92%", top: "40%", size: 9, delay: 0.9, dur: 4.8, tone: "cyan", lgOnly: true },
  { left: "40%", top: "20%", size: 8, delay: 3.1, dur: 3.8, tone: "amber", lgOnly: true },
] as const

const PARTICLES = [
  { left: "34%", bottom: "16%", size: 3, delay: 0.5, dur: 5.6, x: 12, opacity: 0.8 },
  { left: "52%", bottom: "12%", size: 2, delay: 2.1, dur: 6.6, x: -10, opacity: 0.6 },
  { left: "68%", bottom: "18%", size: 3, delay: 1.3, dur: 5.4, x: 9, opacity: 0.85 },
  { left: "84%", bottom: "14%", size: 2, delay: 3.5, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "44%", bottom: "20%", size: 3, delay: 4.2, dur: 5.9, x: 14, opacity: 0.7 },
] as const

export function BlogReportsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora ciano + âmbar em deriva */}
        <span className="arena-aurora absolute -top-16 right-[26%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[2%] bottom-[8%] size-60 rounded-full blur-2xl"
          style={{
            backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${AMBER} 22%, transparent), transparent 66%)`,
            animationDelay: "-6s",
          }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_66%_58%,#000_28%,transparent_80%)]" />

        {/* feixe de luz varrendo */}
        <div className="absolute inset-y-0 left-[30%] w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
        </div>

        {/* cometa âmbar */}
        <span
          className="arena-comet absolute top-[4%] right-[8%] h-px w-24 rounded-full"
          style={
            {
              backgroundImage: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${AMBER} 70%, transparent), transparent)`,
              "--comet-dur": "10s",
              "--comet-delay": "2.4s",
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
              sparkle.tone === "mint" && "text-[var(--brand-mint)]",
              sparkle.tone === "cyan" && "text-[var(--brand-cyan)]",
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                color: sparkle.tone === "amber" ? AMBER : undefined,
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

        {/* linha do solo */}
        <span className="absolute inset-x-[6%] bottom-[7%] h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_38%,transparent)] to-transparent" />

        {/* ===== TORRE DE AUDIÊNCIA ===== */}
        <div className="absolute right-[38%] bottom-[7%] flex flex-col items-center xl:right-[40%]">
          {/* topo: badge transmitindo + arcos de alcance */}
          <div className="relative">
            {/* arcos concêntricos saindo do topo para a direita */}
            <div className="absolute top-1/2 left-1/2 size-0 [transform:rotate(112deg)]">
              {ARCS.map((arc, index) => (
                <span
                  key={index}
                  className="arena-ripple absolute top-0 left-0 rounded-full border-2 border-r-transparent border-b-transparent"
                  style={
                    {
                      width: arc.size,
                      height: arc.size,
                      marginLeft: `calc(${arc.size} / -2)`,
                      marginTop: `calc(${arc.size} / -2)`,
                      borderColor: `color-mix(in oklab, var(--brand-cyan) ${arc.strength}%, transparent)`,
                      borderRightColor: "transparent",
                      borderBottomColor: "transparent",
                      "--ripple-dur": `${arc.dur}s`,
                      "--ripple-delay": `${arc.delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>

            <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_34%,transparent)]" />
            <span className="bg-gradient-custom relative flex size-11 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-12 xl:size-14">
              <Broadcast className="size-5 lg:size-6 xl:size-7" weight="fill" />
            </span>
          </div>

          {/* haste da antena com travessas */}
          <div className="relative h-[clamp(56px,8vw,104px)] w-[3px] rounded-full bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)]">
            {[28, 54, 78].map((top, index) => (
              <span
                key={index}
                className="absolute left-1/2 h-px -translate-x-1/2 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_40%,transparent)]"
                style={{ top: `${top}%`, width: `${10 + index * 6}px` }}
              />
            ))}
          </div>

          {/* base triangular em glass com ring ciano */}
          <div className="relative h-[clamp(38px,5.5vw,68px)] w-[clamp(52px,7vw,92px)]">
            <span className="absolute inset-0 bg-[color-mix(in_oklab,var(--brand-cyan)_42%,transparent)] [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            <span className="absolute inset-[1.5px] bg-[#050f1c] [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            <span className="absolute inset-[1.5px] bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] to-transparent [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
            <span className="absolute inset-x-[18%] bottom-[34%] h-px bg-[color-mix(in_oklab,var(--brand-cyan)_32%,transparent)]" />
            <span className="absolute inset-x-[9%] bottom-[12%] h-px bg-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)]" />
          </div>
        </div>

        {/* ===== LEITORES CHEGANDO ===== */}
        {READERS.map((reader, index) => (
          <div
            key={index}
            className={cn(
              "arena-podium absolute",
              reader.className,
              reader.lgOnly && "hidden lg:block",
            )}
            style={{ "--rise-delay": `${reader.rise}s` } as React.CSSProperties}
          >
            <span
              className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 flex size-8 items-center justify-center rounded-full shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_24%,transparent)] backdrop-blur-md lg:size-9"
              style={
                {
                  "--float-delay": `${reader.floatDelay}s`,
                  "--float-dur": `${reader.floatDur}s`,
                } as React.CSSProperties
              }
            >
              <User
                className={cn(
                  "size-4 lg:size-4.5",
                  reader.tone === "mint" && "text-[var(--brand-mint)]",
                  reader.tone === "cyan" && "text-[var(--brand-cyan)]",
                )}
                weight="fill"
                style={
                  reader.tone === "amber" ? { color: AMBER } : undefined
                }
              />
            </span>
          </div>
        ))}

        {/* ===== CONTADOR DE VIEWS ===== */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[6%] bottom-[24%] flex w-[clamp(112px,14vw,158px)] flex-col gap-1.5 rounded-xl px-2.5 py-2 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={
            { "--float-delay": "0.8s", "--float-dur": "7.6s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <Eye className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Views
          </span>
          <span className="text-foreground text-xs font-bold">
            Audiência ao vivo
          </span>
          <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <span
              className="hero-clip-progress bg-gradient-custom absolute inset-y-0 left-0 rounded-full"
              style={
                {
                  "--clip-dur": "5.2s",
                  "--clip-delay": "0.4s",
                } as React.CSSProperties
              }
            />
          </span>
        </div>

        {/* chip flutuante de crescimento */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[12%] right-[30%] hidden items-center gap-1.5 rounded-full px-2.5 py-1 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={
            { "--float-delay": "2.2s", "--float-dur": "8.2s" } as React.CSSProperties
          }
        >
          <TrendUp className="size-3" weight="bold" style={{ color: AMBER }} />
          <span className="text-foreground text-[11px] font-bold">+1,2 mil</span>
        </div>

        {/* ===== AUDIÊNCIA POR DIA (cluster de barras) ===== */}
        <div className="absolute right-[9%] bottom-[8%] flex h-[clamp(28px,4.5vw,52px)] items-end gap-1.5">
          {AUDIENCE_BARS.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "hero-bar w-1.5 rounded-full lg:w-2",
                index % 2 === 0
                  ? "bg-[color-mix(in_oklab,var(--brand-cyan)_62%,transparent)]"
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

/**
 * Fantasma da torre de audiência: a antena com base triangular, os
 * leitores chegando, o contador de views e o cluster de barras do dia.
 */
export function BlogReportsHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="66%">
      {/* linha do solo */}
      <span className="absolute inset-x-[6%] bottom-[7%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {/* torre */}
      <div className="absolute right-[38%] bottom-[7%] flex flex-col items-center xl:right-[40%]">
        <span className="relative">
          <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-white/8" />
          <GBone className="size-11 rounded-2xl lg:size-12 xl:size-13" />
        </span>
        {/* haste */}
        <span className="relative h-[clamp(56px,8vw,104px)] w-px bg-white/20">
          {[0, 1].map((cross) => (
            <span
              key={cross}
              className="absolute left-1/2 h-px w-6 -translate-x-1/2 rounded-full bg-white/15"
              style={{ top: `${30 + cross * 30}%` }}
            />
          ))}
        </span>
        {/* base triangular */}
        <span
          className="skeleton-bone skeleton-bone-strong block h-[clamp(38px,5.5vw,68px)] w-[clamp(52px,7vw,92px)]"
          style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
        />
      </div>

      {/* leitores chegando */}
      {READERS.map((reader, index) => (
        <div
          key={index}
          className={cn(
            "hero-float absolute size-8 lg:size-9",
            reader.className,
            reader.lgOnly && "hidden lg:block",
          )}
          style={
            {
              "--float-delay": `${reader.floatDelay}s`,
              "--float-dur": `${reader.floatDur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 120} className="size-full rounded-full" />
        </div>
      ))}

      {/* contador de views */}
      <GPanel
        className="absolute right-[6%] bottom-[24%] flex w-[clamp(112px,14vw,158px)] flex-col gap-1.5 px-2.5 py-2"
        floatDelay={1.4}
        floatDur={7.8}
      >
        <span className="flex items-center gap-1.5">
          <GBone className="size-4 shrink-0 rounded-full" />
          <GBone delay={70} className="h-2 w-12 rounded-full" />
        </span>
        <GBone delay={140} className="h-2.5 w-16 rounded-full" />
        <span className="block h-1 overflow-hidden rounded-full bg-white/12">
          <span
            className="hero-clip-progress block h-full rounded-full bg-white/35"
            style={{ "--clip-dur": "5s" } as React.CSSProperties}
          />
        </span>
      </GPanel>

      {/* chip de crescimento */}
      <GPanel
        className="absolute top-[12%] right-[30%] hidden items-center gap-1.5 rounded-full px-2.5 py-1 lg:flex"
        floatDelay={2.2}
        floatDur={8.4}
      >
        <GBone delay={180} className="size-3 shrink-0 rounded-full" />
        <GBone delay={240} className="h-2 w-12 rounded-full" />
      </GPanel>

      {/* audiência por dia */}
      <div className="absolute right-[9%] bottom-[8%] flex h-[clamp(28px,4.5vw,52px)] items-end gap-1.5">
        {[46, 72, 34, 90, 58].map((height, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-1.5 rounded-full"
            style={
              {
                height: `${height}%`,
                "--bar-delay": `${index * 0.16}s`,
                "--bar-dur": "2.8s",
                "--shimmer-delay": `${index * 90}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </VizGhost>
  )
}
