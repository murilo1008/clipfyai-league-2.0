import {
  Eye,
  FilmSlate,
  Play,
  SealCheck,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Clipadores — estúdio de clipes:
 * aurora em deriva, filmstrip rolando, badge de play com anéis
 * orbitando, bolhas de plataformas flutuando, waveform pulsando,
 * sparkles e cometa. CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "20%", top: "12%", size: 11, delay: 0, dur: 3.6, color: "mint", lgOnly: false },
  { left: "46%", top: "7%", size: 9, delay: 1.4, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "70%", top: "16%", size: 13, delay: 2.2, dur: 3.4, color: "mint", lgOnly: false },
  { left: "88%", top: "9%", size: 9, delay: 0.7, dur: 4.8, color: "cyan", lgOnly: false },
  { left: "34%", top: "22%", size: 8, delay: 3, dur: 3.8, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "22%", bottom: "30%", size: 3, delay: 0.4, dur: 5.6, x: 12, opacity: 0.8 },
  { left: "40%", bottom: "26%", size: 2, delay: 2, dur: 6.6, x: -12, opacity: 0.6 },
  { left: "58%", bottom: "32%", size: 3, delay: 1.2, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "76%", bottom: "28%", size: 2, delay: 3.4, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "88%", bottom: "34%", size: 3, delay: 2.6, dur: 5.8, x: 8, opacity: 0.75 },
] as const

const WAVEFORM = [
  { height: "34%", delay: 0, dur: 2.6 },
  { height: "62%", delay: 0.2, dur: 3 },
  { height: "88%", delay: 0.4, dur: 2.4 },
  { height: "52%", delay: 0.6, dur: 3.2 },
  { height: "74%", delay: 0.8, dur: 2.8 },
  { height: "40%", delay: 1, dur: 3.4 },
  { height: "66%", delay: 1.2, dur: 2.5 },
  { height: "30%", delay: 1.4, dur: 3.1 },
] as const

const ORBIT_PLATFORMS: {
  platform: PlatformKey
  className: string
  delay: number
  dur: number
}[] = [
  { platform: "INSTAGRAM", className: "top-[16%] right-[38%]", delay: 0.5, dur: 7.2 },
  { platform: "TIKTOK", className: "top-[42%] right-[8%]", delay: 1.8, dur: 8 },
  { platform: "YOUTUBE", className: "top-[10%] right-[12%]", delay: 0, dur: 6.8 },
  { platform: "KWAI", className: "top-[48%] right-[44%] hidden xl:flex", delay: 2.6, dur: 7.6 },
]

const FILM_FRAMES = [
  "cyan",
  "muted",
  "mint",
  "muted",
  "gradient",
  "muted",
  "cyan",
  "muted",
] as const

export function ClippersHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-14 right-[8%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[42%] bottom-[4%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_70%_60%,#000_30%,transparent_80%)]" />

        {/* feixe de luz */}
        <div className="absolute inset-y-0 left-1/4 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_13%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[10%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2s",
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

        {/* badge central de play com anéis orbitando */}
        <div
          className="arena-tilt absolute top-[24%] right-[22%] xl:right-[24%]"
          style={{ "--float-dur": "6.8s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-mint)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-cyan)_60%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          {/* satélites orbitando */}
          <span
            className="arena-ring absolute -inset-6 rounded-full"
            style={{ animationDuration: "13s" }}
          >
            <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--brand-mint)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]" />
            <span className="absolute bottom-[10%] left-[12%] size-1 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
          </span>
          <span className="bg-gradient-custom relative flex size-13 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-14 xl:size-16">
            <Play className="size-6 lg:size-7 xl:size-8" weight="fill" />
          </span>
        </div>

        {/* bolhas de plataformas flutuando */}
        {ORBIT_PLATFORMS.map(({ platform, className: posClass, delay, dur }) => {
          const config = platformConfig[platform]
          const PlatformIcon = config.icon
          return (
            <span
              key={platform}
              className={cn(
                "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex size-9 items-center justify-center rounded-xl shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:size-10",
                posClass,
              )}
              style={
                {
                  "--float-delay": `${delay}s`,
                  "--float-dur": `${dur}s`,
                } as React.CSSProperties
              }
            >
              <PlatformIcon className={cn("size-4.5 lg:size-5", config.color)} />
            </span>
          )
        })}

        {/* chips flutuantes */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[58%] right-[10%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "1.4s", "--float-dur": "7.8s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <SealCheck className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Verificados
          </span>
          <span className="text-foreground text-xs font-bold">
            Comunidade ativa
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[38%] right-[40%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md xl:flex"
          style={{ "--float-delay": "0.2s", "--float-dur": "7s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <Eye className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Views
          </span>
          <span className="text-foreground text-xs font-bold">
            Crescendo todo dia
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[12%] right-[26%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={{ "--float-delay": "2.4s", "--float-dur": "8.4s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <UsersThree className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Clipadores
          </span>
          <span className="text-foreground text-xs font-bold">
            Novos talentos
          </span>
        </div>

        {/* waveform pulsando */}
        <div className="absolute right-[52%] bottom-[12%] flex h-12 items-end gap-1 lg:h-14">
          {WAVEFORM.map((bar, index) => (
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

        {/* filmstrip rolando na base */}
        <div className="absolute -right-6 bottom-[-14px] left-[-10%] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_20%,#000_80%,transparent)]">
          <div
            className="hero-filmstrip flex w-max gap-2 py-3"
            style={{ "--strip-dur": "30s" } as React.CSSProperties}
          >
            {[...FILM_FRAMES, ...FILM_FRAMES].map((tone, index) => (
              <span
                key={index}
                className={cn(
                  "flex h-12 w-20 shrink-0 items-center justify-center rounded-xl ring-1 lg:h-14 lg:w-24",
                  tone === "gradient" &&
                    "bg-gradient-custom text-[#04222A] ring-transparent",
                  tone === "cyan" &&
                    "bg-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] text-[var(--brand-cyan)] ring-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]",
                  tone === "mint" &&
                    "bg-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)] text-[var(--brand-mint)] ring-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)]",
                  tone === "muted" &&
                    "bg-white/[0.04] text-white/25 ring-white/10",
                )}
              >
                {tone === "muted" ? (
                  <FilmSlate className="size-4" weight="fill" />
                ) : (
                  <Play className="size-4" weight="fill" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do palco dos clipadores: badge central com anel orbital,
 * bolhas das plataformas, chips, waveform pulsando e a filmstrip da base.
 */
export function ClippersHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="70%">
      {/* badge central */}
      <div
        className="hero-float absolute top-[24%] right-[22%] xl:right-[24%]"
        style={{ "--float-dur": "6.8s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]" />
        <GBone className="size-13 rounded-2xl lg:size-14 xl:size-16" />
      </div>

      {/* bolhas das plataformas orbitando */}
      {ORBIT_PLATFORMS.map((orbit, index) => (
        <div
          key={orbit.platform}
          className={cn(
            "hero-float absolute size-9 lg:size-10",
            orbit.className,
          )}
          style={
            {
              "--float-delay": `${orbit.delay}s`,
              "--float-dur": `${orbit.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 110} className="size-full rounded-xl" />
        </div>
      ))}

      {/* chips flutuantes */}
      <GChip
        className="absolute top-[58%] right-[10%]"
        floatDelay={1.4}
        floatDur={7.8}
      />
      <GChip
        className="absolute top-[38%] right-[40%] hidden xl:flex"
        floatDelay={0.2}
        floatDur={7}
        delay={120}
      />
      <GChip
        className="absolute top-[12%] right-[26%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.4}
        delay={240}
      />

      {/* waveform pulsando */}
      <div className="absolute right-[52%] bottom-[12%] flex h-12 items-end gap-1 lg:h-14">
        {WAVEFORM.map((bar, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-1.5 rounded-full"
            style={
              {
                height: bar.height,
                "--bar-delay": `${bar.delay}s`,
                "--bar-dur": `${bar.dur}s`,
                "--shimmer-delay": `${index * 80}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* filmstrip rolando na base */}
      <div className="absolute -right-6 bottom-[-14px] left-[-10%] overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_20%,#000_80%,transparent)]">
        <div
          className="hero-filmstrip flex w-max gap-2 py-3"
          style={{ "--strip-dur": "30s" } as React.CSSProperties}
        >
          {[...FILM_FRAMES, ...FILM_FRAMES].map((tone, index) => (
            <GBone
              key={index}
              faint={tone === "muted"}
              delay={(index % FILM_FRAMES.length) * 90}
              className="h-12 w-20 shrink-0 rounded-xl lg:h-14 lg:w-24"
            />
          ))}
        </div>
      </div>
    </VizGhost>
  )
}
