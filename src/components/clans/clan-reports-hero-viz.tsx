import {
  Crown,
  Lightning,
  Shield,
  Sparkle,
  Sword,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Relatórios de Clãs — duelo de clãs:
 * aurora violeta + âmbar, dois emblemas frente a frente respirando
 * dessincronizados, faísca "VS" cintilando, cabo de guerra com brilho
 * varrendo, torres de barras em corrida, chips glass, partículas nas
 * duas cores e um cometa. CSS puro, aria-hidden, fluido de md a xl.
 */

const VIOLET = "#8b5cf6"
const AMBER = "#f59e0b"

const LEFT_BARS = [
  { height: "52%", delay: 0, dur: 2.4 },
  { height: "78%", delay: 0.3, dur: 2.9 },
  { height: "60%", delay: 0.6, dur: 2.2 },
  { height: "92%", delay: 0.9, dur: 3.1 },
] as const

const RIGHT_BARS = [
  { height: "88%", delay: 0.15, dur: 3.4 },
  { height: "56%", delay: 0.45, dur: 2.1 },
  { height: "74%", delay: 0.75, dur: 2.7 },
  { height: "46%", delay: 1.05, dur: 3.2 },
] as const

const PARTICLES = [
  { left: "18%", bottom: "26%", size: 3, delay: 0.6, dur: 5.8, x: 10, opacity: 0.8, tone: "violet" },
  { left: "30%", bottom: "22%", size: 2, delay: 2.2, dur: 6.4, x: -10, opacity: 0.6, tone: "violet" },
  { left: "46%", bottom: "30%", size: 2, delay: 3.6, dur: 5.2, x: 8, opacity: 0.7, tone: "amber" },
  { left: "64%", bottom: "24%", size: 3, delay: 1.4, dur: 5.6, x: -8, opacity: 0.85, tone: "amber" },
  { left: "80%", bottom: "28%", size: 2, delay: 2.8, dur: 6.2, x: 10, opacity: 0.65, tone: "amber" },
  { left: "88%", bottom: "34%", size: 3, delay: 0.2, dur: 5.4, x: -6, opacity: 0.75, tone: "violet" },
] as const

export function ClanReportsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora violeta + âmbar em deriva */}
        <span className="arena-aurora absolute -top-16 right-[34%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#8b5cf6_30%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[2%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f59e0b_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_65%_50%,#000_28%,transparent_78%)]" />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[7%] right-[6%] h-px w-24 rounded-full bg-gradient-to-l from-white/85 via-[color-mix(in_oklab,#f59e0b_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "3s",
              "--comet-x": "-300px",
              "--comet-y": "210px",
              "--comet-angle": "-32deg",
            } as React.CSSProperties
          }
        />

        {/* partículas subindo nas duas cores */}
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="arena-particle absolute rounded-full"
            style={
              {
                left: particle.left,
                bottom: particle.bottom,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.tone === "violet" ? VIOLET : AMBER,
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== arena do duelo ===== */}
        <div className="absolute top-[18%] right-[7%] flex w-[clamp(220px,26vw,320px)] flex-col gap-6 lg:top-[20%] xl:right-[11%]">
          {/* emblemas frente a frente + faísca VS */}
          <div className="flex items-center justify-between px-1">
            {/* emblema violeta (Shield) */}
            <div
              className="arena-tilt relative"
              style={{ "--float-dur": "7.6s" } as React.CSSProperties}
            >
              <span className="hero-pulse-ring absolute -inset-4 rounded-2xl bg-[color-mix(in_oklab,#8b5cf6_35%,transparent)]" />
              <span className="bg-card/70 supports-[backdrop-filter]:bg-card/45 relative flex size-13 items-center justify-center rounded-2xl shadow-[0_14px_40px_-12px_rgba(139,92,246,0.55)] ring-1 ring-[color-mix(in_oklab,#8b5cf6_40%,transparent)] backdrop-blur-md lg:size-14 xl:size-16">
                <Shield
                  className="size-6 text-[#8b5cf6] lg:size-7 xl:size-8"
                  weight="fill"
                />
              </span>
            </div>

            {/* faísca "VS" */}
            <div className="relative flex flex-col items-center gap-0.5">
              <Sparkle
                weight="fill"
                className="arena-twinkle absolute -top-3 -left-4 size-2.5 text-[#8b5cf6]"
                style={
                  {
                    "--twinkle-delay": "0.6s",
                    "--twinkle-dur": "2.6s",
                    "--twinkle-opacity": 0.85,
                  } as React.CSSProperties
                }
              />
              <Sparkle
                weight="fill"
                className="arena-twinkle absolute -right-4 -bottom-2 size-2 text-[#f59e0b]"
                style={
                  {
                    "--twinkle-delay": "1.5s",
                    "--twinkle-dur": "3s",
                    "--twinkle-opacity": 0.85,
                  } as React.CSSProperties
                }
              />
              <Lightning
                weight="fill"
                className="arena-twinkle size-5 text-white drop-shadow-[0_0_10px_rgba(245,158,11,0.85)] lg:size-6"
                style={
                  {
                    "--twinkle-dur": "1.8s",
                    "--twinkle-opacity": 1,
                  } as React.CSSProperties
                }
              />
              <span className="text-[9px] font-black tracking-[0.2em] text-white/70 lg:text-[10px]">
                VS
              </span>
            </div>

            {/* emblema âmbar (Sword) */}
            <div
              className="arena-tilt relative"
              style={
                {
                  "--float-dur": "6.2s",
                  "--float-delay": "0.8s",
                } as React.CSSProperties
              }
            >
              <span
                className="hero-pulse-ring absolute -inset-4 rounded-2xl bg-[color-mix(in_oklab,#f59e0b_35%,transparent)]"
                style={{ animationDelay: "1.2s" }}
              />
              <span className="bg-card/70 supports-[backdrop-filter]:bg-card/45 relative flex size-13 items-center justify-center rounded-2xl shadow-[0_14px_40px_-12px_rgba(245,158,11,0.55)] ring-1 ring-[color-mix(in_oklab,#f59e0b_42%,transparent)] backdrop-blur-md lg:size-14 xl:size-16">
                <Sword
                  className="size-6 text-[#f59e0b] lg:size-7 xl:size-8"
                  weight="fill"
                />
              </span>
            </div>
          </div>

          {/* cabo de guerra */}
          <div className="relative h-2.5 w-full rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-y-0 left-0 w-[53%] rounded-l-full bg-gradient-to-r from-[color-mix(in_oklab,#8b5cf6_30%,transparent)] to-[#8b5cf6]" />
              <span className="absolute inset-y-0 right-0 w-[47%] rounded-r-full bg-gradient-to-l from-[color-mix(in_oklab,#f59e0b_30%,transparent)] to-[#f59e0b]" />
              <span
                className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ "--shine-delay": "1.2s" } as React.CSSProperties}
              />
            </div>
            {/* dot central pulsante no ponto de encontro */}
            <span className="absolute top-1/2 left-[53%] -translate-x-1/2 -translate-y-1/2">
              <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-white/45" />
              <span className="relative block size-3 animate-pulse rounded-full bg-white shadow-[0_0_12px_3px_rgba(255,255,255,0.55)]" />
            </span>
          </div>

          {/* torres de barras — corrida violeta × âmbar */}
          <div className="flex items-end justify-between px-1">
            <div className="flex h-14 items-end gap-1.5 lg:h-16">
              {LEFT_BARS.map((bar, index) => (
                <span
                  key={index}
                  className="hero-bar w-3 rounded-t-md bg-gradient-to-t from-[color-mix(in_oklab,#8b5cf6_35%,transparent)] to-[#8b5cf6] lg:w-3.5"
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
            <div className="flex h-14 items-end gap-1.5 lg:h-16">
              {RIGHT_BARS.map((bar, index) => (
                <span
                  key={index}
                  className="hero-bar w-3 rounded-t-md bg-gradient-to-t from-[color-mix(in_oklab,#f59e0b_35%,transparent)] to-[#f59e0b] lg:w-3.5"
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

        {/* chip glass: clã líder */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[8%] right-[38%] flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#8b5cf6_30%,transparent)] backdrop-blur-md lg:top-[9%]"
          style={
            {
              "--float-delay": "0.4s",
              "--float-dur": "7.4s",
            } as React.CSSProperties
          }
        >
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,#8b5cf6_22%,transparent)]">
            <Crown className="size-2.5 text-[#8b5cf6]" weight="fill" />
          </span>
          <span className="text-foreground text-[10px] font-bold">
            Clã líder
          </span>
        </div>

        {/* chip glass: novos membros */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[6%] bottom-[14%] flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#f59e0b_32%,transparent)] backdrop-blur-md"
          style={
            {
              "--float-delay": "1.8s",
              "--float-dur": "8.2s",
            } as React.CSSProperties
          }
        >
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-[color-mix(in_oklab,#f59e0b_22%,transparent)]">
            <UsersThree className="size-2.5 text-[#f59e0b]" weight="fill" />
          </span>
          <span className="text-foreground text-[10px] font-bold">
            +12 membros na semana
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do duelo de clãs: os dois emblemas frente a frente com o VS,
 * o cabo de guerra e as duas torres de barras correndo.
 */
export function ClanReportsHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="65%">
      <div className="absolute top-[18%] right-[7%] flex w-[clamp(220px,26vw,320px)] flex-col gap-6 lg:top-[20%] xl:right-[11%]">
        {/* emblemas + VS */}
        <div className="flex items-center justify-between px-1">
          <span
            className="hero-float block size-13 lg:size-14 xl:size-16"
            style={{ "--float-dur": "7.6s" } as React.CSSProperties}
          >
            <GBone className="size-full rounded-2xl" />
          </span>
          <span className="flex flex-col items-center gap-1">
            <GBone delay={120} className="size-4 rounded-full" />
            <GBone delay={180} className="h-2 w-5 rounded-full" />
          </span>
          <span
            className="hero-float block size-13 lg:size-14 xl:size-16"
            style={
              {
                "--float-dur": "6.2s",
                "--float-delay": "0.8s",
              } as React.CSSProperties
            }
          >
            <GBone delay={240} className="size-full rounded-2xl" />
          </span>
        </div>

        {/* cabo de guerra */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10">
          <GBone delay={300} className="absolute inset-y-0 left-0 w-[53%] rounded-l-full" />
          <span
            className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            style={{ "--shine-delay": "1.2s" } as React.CSSProperties}
          />
        </div>

        {/* torres de barras */}
        <div className="flex items-end justify-between px-1">
          <div className="flex h-14 items-end gap-1.5 lg:h-16">
            {LEFT_BARS.map((bar, index) => (
              <span
                key={index}
                className="hero-bar skeleton-bone skeleton-bone-strong block w-3 rounded-t-md lg:w-3.5"
                style={
                  {
                    height: bar.height,
                    "--bar-delay": `${bar.delay}s`,
                    "--bar-dur": `${bar.dur}s`,
                    "--shimmer-delay": `${index * 90}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="flex h-14 items-end gap-1.5 lg:h-16">
            {RIGHT_BARS.map((bar, index) => (
              <span
                key={index}
                className="hero-bar skeleton-bone skeleton-bone-strong block w-3 rounded-t-md lg:w-3.5"
                style={
                  {
                    height: bar.height,
                    "--bar-delay": `${bar.delay}s`,
                    "--bar-dur": `${bar.dur}s`,
                    "--shimmer-delay": `${200 + index * 90}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* chips do duelo */}
      <GPanel
        className="absolute top-[8%] right-[38%] flex items-center gap-1.5 px-2.5 py-1.5 lg:top-[9%]"
        floatDelay={0.4}
        floatDur={7.4}
      >
        <GBone className="size-4 shrink-0 rounded-full" />
        <GBone delay={80} className="h-2 w-16 rounded-full" />
      </GPanel>
      <GPanel
        className="absolute right-[6%] bottom-[14%] flex items-center gap-1.5 px-2.5 py-1.5"
        floatDelay={2.2}
        floatDur={8}
      >
        <GBone delay={140} className="size-4 shrink-0 rounded-full" />
        <GBone delay={200} className="h-2 w-14 rounded-full" />
      </GPanel>
    </VizGhost>
  )
}
