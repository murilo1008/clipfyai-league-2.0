import {
  Crown,
  Fire,
  Handshake,
  Shield,
  Sparkle,
  Sword,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Clãs — fortaleza dos clãs:
 * aurora violeta+ciano em deriva, escudo central com anel cônico,
 * dois estandartes cruzados atrás, emblemas de clã orbitando como
 * bolhas glass, partículas de reunião convergindo, sparkles, cometa
 * e chips de recrutamento. CSS puro, aria-hidden, fluido de md a xl.
 */

const VIOLET = "#8b5cf6"

const SPARKLES = [
  { left: "18%", top: "10%", size: 11, delay: 0, dur: 3.8, color: "violet", lgOnly: false },
  { left: "44%", top: "6%", size: 9, delay: 1.6, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "72%", top: "14%", size: 13, delay: 2.4, dur: 3.4, color: "violet", lgOnly: false },
  { left: "90%", top: "22%", size: 9, delay: 0.8, dur: 4.6, color: "cyan", lgOnly: false },
  { left: "30%", top: "30%", size: 8, delay: 3.2, dur: 3.9, color: "cyan", lgOnly: true },
] as const

/** Partículas de reunião: sobem convergindo para o escudo central. */
const PARTICLES = [
  { left: "16%", bottom: "24%", size: 3, delay: 0.3, dur: 5.8, x: 26, opacity: 0.8 },
  { left: "30%", bottom: "18%", size: 2, delay: 1.8, dur: 6.4, x: 18, opacity: 0.6 },
  { left: "46%", bottom: "26%", size: 3, delay: 1, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "70%", bottom: "20%", size: 2, delay: 2.8, dur: 6.2, x: -14, opacity: 0.65 },
  { left: "84%", bottom: "28%", size: 3, delay: 2.2, dur: 5.6, x: -22, opacity: 0.75 },
  { left: "92%", bottom: "18%", size: 2, delay: 3.6, dur: 6.6, x: -28, opacity: 0.55 },
] as const

/** Emblemas de clã orbitando como bolhas glass. */
const EMBLEMS = [
  { icon: Sword, color: "#E74C3C", className: "top-[15%] right-[40%]", delay: 0.5, dur: 7.2 },
  { icon: Crown, color: "#F1C40F", className: "top-[10%] right-[12%]", delay: 1.8, dur: 6.6 },
  { icon: Fire, color: "#9B59B6", className: "top-[52%] right-[44%] hidden lg:flex", delay: 2.9, dur: 8 },
] as const

/** Clip-path de bandeira: faixa comprida com corte em V embaixo. */
const FLAG_CLIP =
  "polygon(0% 0%, 100% 0%, 100% 100%, 50% 84%, 0% 100%)"

export function ClansHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora violeta + ciano em deriva */}
        <span
          className="arena-aurora absolute -top-14 right-[10%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${VIOLET} 30%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_70%_55%,#000_30%,transparent_80%)]" />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[7%] right-[8%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${VIOLET} 70%, transparent), transparent)`,
              "--comet-dur": "11s",
              "--comet-delay": "2.5s",
              "--comet-x": "-300px",
              "--comet-y": "210px",
              "--comet-angle": "-32deg",
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
              sparkle.color === "cyan" && "text-[var(--brand-cyan)]",
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                color: sparkle.color === "violet" ? VIOLET : undefined,
                "--twinkle-delay": `${sparkle.delay}s`,
                "--twinkle-dur": `${sparkle.dur}s`,
                "--twinkle-opacity": 0.9,
              } as React.CSSProperties
            }
          />
        ))}

        {/* partículas de reunião convergindo para o escudo */}
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
                backgroundColor:
                  index % 2 === 0 ? VIOLET : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* dois estandartes cruzados atrás do escudo */}
        <div className="absolute top-[8%] right-[16%] h-[58%] w-40 lg:right-[18%] xl:right-[20%]">
          <span
            className="absolute top-0 left-[22%] block h-full w-14 origin-top rotate-[-14deg] [animation:arena-breathe_7s_ease-in-out_infinite] motion-reduce:[animation:none] lg:w-16"
            style={{
              clipPath: FLAG_CLIP,
              transformOrigin: "top center",
              background: `linear-gradient(to bottom, color-mix(in oklab, ${VIOLET} 34%, transparent), color-mix(in oklab, ${VIOLET} 12%, transparent) 62%, transparent)`,
            }}
          />
          <span
            className="absolute top-0 right-[22%] block h-full w-14 origin-top rotate-[14deg] [animation:arena-breathe_8.5s_ease-in-out_-2s_infinite] motion-reduce:[animation:none] lg:w-16"
            style={{
              clipPath: FLAG_CLIP,
              transformOrigin: "top center",
              background:
                "linear-gradient(to bottom, color-mix(in oklab, var(--brand-cyan) 30%, transparent), color-mix(in oklab, var(--brand-cyan) 11%, transparent) 62%, transparent)",
            }}
          />
        </div>

        {/* escudo central da fortaleza */}
        <div
          className="arena-tilt absolute top-[27%] right-[22%] xl:right-[25%]"
          style={{ "--float-dur": "7.2s" } as React.CSSProperties}
        >
          <span
            className="hero-pulse-ring absolute -inset-5 rounded-full"
            style={{
              backgroundColor: `color-mix(in oklab, ${VIOLET} 38%, transparent)`,
            }}
          />
          <span
            className="arena-ring absolute -inset-2.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
            style={{
              background: `conic-gradient(from 0deg, transparent 10%, color-mix(in oklab, ${VIOLET} 75%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-cyan) 65%, transparent) 72%, transparent 90%)`,
            }}
          />
          <span className="bg-gradient-custom relative flex size-14 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(139,92,246,0.55)] lg:size-16 xl:size-18">
            <Shield className="size-7 lg:size-8 xl:size-9" weight="fill" />
          </span>
        </div>

        {/* emblemas de clã orbitando como bolhas glass */}
        {EMBLEMS.map(({ icon: EmblemIcon, color, className: posClass, delay, dur }) => (
          <span
            key={color}
            className={cn(
              "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex size-10 items-center justify-center rounded-xl shadow-lg backdrop-blur-md lg:size-11",
              posClass,
            )}
            style={
              {
                boxShadow: `0 8px 24px -10px ${color}66`,
                border: `1px solid color-mix(in oklab, ${color} 34%, transparent)`,
                "--float-delay": `${delay}s`,
                "--float-dur": `${dur}s`,
              } as React.CSSProperties
            }
          >
            <EmblemIcon
              className="size-4.5 lg:size-5"
              weight="fill"
              style={{ color }}
            />
          </span>
        ))}

        {/* chips glass flutuantes */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[60%] right-[8%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "1.2s", "--float-dur": "7.8s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--brand-green)]" />
            </span>
            Recrutando
          </span>
          <span className="text-foreground inline-flex items-center gap-1.5 text-xs font-bold">
            <UserPlus className="text-brand-mint size-3.5" weight="fill" />
            Vagas abertas
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[36%] right-[4%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg backdrop-blur-md ring-1 lg:flex"
          style={
            {
              borderColor: "transparent",
              "--tw-ring-color": `color-mix(in oklab, ${VIOLET} 30%, transparent)`,
              "--float-delay": "0.3s",
              "--float-dur": "7s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <Handshake className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Aliança formada
          </span>
          <span className="text-foreground text-xs font-bold">
            Clãs unidos na arena
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da fortaleza dos clãs: os dois estandartes cruzados, o escudo
 * central com anel orbitando, os emblemas em órbita e os chips.
 */
export function ClansHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="70%">
      {/* estandartes cruzados atrás do escudo */}
      <div className="absolute top-[8%] right-[16%] h-[58%] w-40 lg:right-[18%] xl:right-[20%]">
        <span
          className="absolute top-0 left-[22%] block h-full w-14 origin-top rotate-[-14deg] bg-white/[0.05] [animation:arena-breathe_7s_ease-in-out_infinite] motion-reduce:[animation:none] lg:w-16"
          style={{ clipPath: FLAG_CLIP, transformOrigin: "top center" }}
        />
        <span
          className="absolute top-0 right-[22%] block h-full w-14 origin-top rotate-[14deg] bg-white/[0.04] [animation:arena-breathe_8.5s_ease-in-out_-2s_infinite] motion-reduce:[animation:none] lg:w-16"
          style={{ clipPath: FLAG_CLIP, transformOrigin: "top center" }}
        />
      </div>

      {/* escudo central */}
      <div
        className="hero-float absolute top-[27%] right-[22%] xl:right-[25%]"
        style={{ "--float-dur": "7.2s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-white/15" />
        <GBone className="size-14 rounded-2xl lg:size-16 xl:size-18" />
      </div>

      {/* emblemas orbitando */}
      {EMBLEMS.map((emblem, index) => (
        <div
          key={emblem.color}
          className={cn(
            "hero-float absolute size-10 lg:size-11",
            emblem.className,
          )}
          style={
            {
              "--float-delay": `${emblem.delay}s`,
              "--float-dur": `${emblem.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 120} className="size-full rounded-xl" />
        </div>
      ))}

      {/* chips */}
      <GChip
        className="absolute top-[60%] right-[8%]"
        floatDelay={1.2}
        floatDur={7.8}
      />
      <GChip
        className="absolute top-[36%] right-[4%] hidden lg:flex"
        floatDelay={0.3}
        floatDur={7}
        delay={150}
      />
    </VizGhost>
  )
}
