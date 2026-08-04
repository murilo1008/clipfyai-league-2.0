import {
  Confetti,
  Crown,
  Lightning,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react/dist/ssr"

import { GBars, GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Competições — arena/pódio:
 * aurora em deriva, piso em perspectiva, holofotes pulsando, pódio
 * subindo com brilho varrendo, partículas e confetes, sparkles
 * cintilando, cometas, ondas no piso e troféu com anéis orbitando.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const PARTICLES = [
  { left: "16%", bottom: "30%", size: 3, delay: 0, dur: 5.2, x: 10, opacity: 0.85 },
  { left: "28%", bottom: "26%", size: 2, delay: 1.6, dur: 6.4, x: -14, opacity: 0.6 },
  { left: "40%", bottom: "34%", size: 4, delay: 0.8, dur: 5.8, x: 8, opacity: 0.9 },
  { left: "50%", bottom: "28%", size: 2, delay: 2.4, dur: 7, x: -8, opacity: 0.55 },
  { left: "60%", bottom: "36%", size: 3, delay: 3.2, dur: 6, x: 12, opacity: 0.8 },
  { left: "70%", bottom: "30%", size: 2, delay: 1.2, dur: 6.8, x: -10, opacity: 0.6 },
  { left: "80%", bottom: "34%", size: 3, delay: 4, dur: 5.6, x: 6, opacity: 0.75 },
] as const

const SPARKLES = [
  { left: "22%", top: "14%", size: 12, delay: 0, dur: 3.4, color: "mint", lgOnly: false },
  { left: "48%", top: "8%", size: 9, delay: 1.2, dur: 4.2, color: "cyan", lgOnly: true },
  { left: "66%", top: "20%", size: 14, delay: 2.1, dur: 3.8, color: "mint", lgOnly: false },
  { left: "84%", top: "12%", size: 10, delay: 0.6, dur: 4.6, color: "cyan", lgOnly: false },
  { left: "36%", top: "26%", size: 8, delay: 2.8, dur: 3.2, color: "cyan", lgOnly: true },
  { left: "90%", top: "30%", size: 9, delay: 1.8, dur: 4, color: "mint", lgOnly: true },
] as const

const CONFETTI = [
  { left: "34%", top: "32%", w: 4, h: 8, delay: 0, dur: 5.4, x: 18, rot: 300, color: "var(--brand-mint)", opacity: 0.85 },
  { left: "42%", top: "36%", w: 5, h: 5, delay: 1.8, dur: 6.2, x: -16, rot: 220, color: "var(--brand-cyan)", opacity: 0.7 },
  { left: "50%", top: "30%", w: 4, h: 9, delay: 3.4, dur: 5.8, x: 12, rot: 340, color: "var(--brand-green)", opacity: 0.8 },
  { left: "58%", top: "34%", w: 5, h: 5, delay: 0.9, dur: 6.6, x: -20, rot: 260, color: "var(--brand-mint)", opacity: 0.65 },
  { left: "66%", top: "31%", w: 4, h: 8, delay: 2.6, dur: 5.2, x: 14, rot: 310, color: "var(--brand-cyan)", opacity: 0.85 },
  { left: "74%", top: "35%", w: 5, h: 5, delay: 4.2, dur: 6, x: -10, rot: 230, color: "var(--brand-green)", opacity: 0.7 },
] as const

export function ArenaHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-14 right-[10%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_30%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[40%] bottom-[6%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* piso da arena em perspectiva */}
        <div className="absolute inset-x-[-24%] bottom-[-8%] h-[70%] [transform:perspective(620px)_rotateX(58deg)] [transform-origin:bottom]">
          <div className="hero-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_50%_100%,#000_30%,transparent_80%)]" />
        </div>

        {/* holofotes */}
        <span
          className="arena-spot absolute -top-8 left-[24%] h-[82%] w-28 bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] to-transparent [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]"
          style={{ rotate: "-8deg" }}
        />
        <span
          className="arena-spot absolute -top-8 right-[14%] h-[82%] w-28 bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_26%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_10%,transparent)] to-transparent [clip-path:polygon(44%_0,56%_0,100%_100%,0_100%)]"
          style={{ rotate: "9deg", "--spot-delay": "-3.5s" } as React.CSSProperties}
        />

        {/* feixe de luz varrendo a arena */}
        <div className="absolute inset-y-0 left-1/4 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] to-transparent" />
        </div>

        {/* cometas cruzando o céu da arena */}
        <span
          className="arena-comet absolute top-[5%] right-[8%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "9s",
              "--comet-delay": "1.5s",
              "--comet-x": "-340px",
              "--comet-y": "230px",
              "--comet-angle": "-34deg",
            } as React.CSSProperties
          }
        />
        <span
          className="arena-comet absolute top-[16%] right-[32%] hidden h-px w-16 rounded-full bg-gradient-to-l from-white/60 via-[color-mix(in_oklab,var(--brand-mint)_60%,transparent)] to-transparent lg:block"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "6s",
              "--comet-x": "-260px",
              "--comet-y": "170px",
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

        {/* confetes caindo sobre o pódio */}
        {CONFETTI.map((confetti, index) => (
          <span
            key={index}
            className="arena-confetti absolute rounded-[2px]"
            style={
              {
                left: confetti.left,
                top: confetti.top,
                width: confetti.w,
                height: confetti.h,
                backgroundColor: confetti.color,
                "--confetti-delay": `${confetti.delay}s`,
                "--confetti-dur": `${confetti.dur}s`,
                "--confetti-x": `${confetti.x}px`,
                "--confetti-rot": `${confetti.rot}deg`,
                "--confetti-opacity": confetti.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ondas de choque no piso, sob o pódio */}
        <div className="absolute bottom-[-3%] left-1/2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="arena-ripple absolute bottom-0 left-0 h-[clamp(40px,5vw,64px)] w-[clamp(180px,24vw,300px)] rounded-[100%] border border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]"
              style={
                {
                  marginLeft: "calc(clamp(180px, 24vw, 300px) / -2)",
                  "--ripple-dur": "4.5s",
                  "--ripple-delay": `${index * 1.5}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* troféu flutuando sobre o pódio */}
        <div
          className="arena-tilt absolute right-[26%] bottom-[54%] xl:right-[28%]"
          style={{ "--float-dur": "6.5s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-mint)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-cyan)_60%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          {/* satélites orbitando o troféu */}
          <span
            className="arena-ring absolute -inset-6 rounded-full"
            style={{ animationDuration: "12s" }}
          >
            <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--brand-mint)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]" />
            <span className="absolute bottom-[12%] left-[10%] size-1 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
          </span>
          <span className="bg-gradient-custom relative flex size-13 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-14 xl:size-16">
            <Trophy className="size-6 lg:size-7 xl:size-8" weight="fill" />
          </span>
        </div>

        {/* pódio 2º · 1º · 3º */}
        <div className="absolute inset-x-[6%] bottom-0 flex items-end justify-center gap-2 lg:gap-2.5">
          <PodiumColumn place={2} heightClass="h-[30%]" accent="cyan" delay={0.35} />
          <PodiumColumn place={1} heightClass="h-[46%]" accent="gradient" delay={0.15} />
          <PodiumColumn place={3} heightClass="h-[21%]" accent="green" delay={0.55} />
        </div>

        {/* chips flutuantes */}
        <FloatChip
          icon={
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--brand-green)]" />
            </span>
          }
          label="Ao vivo"
          value="Arena aberta"
          className="top-[10%] right-[6%]"
          delay={0.8}
          duration={7.6}
        />
        <FloatChip
          icon={<Lightning className="size-3 text-[#04222A]" weight="fill" />}
          iconChip
          label="Premiação"
          value="Ranking diário"
          className="top-[32%] right-[4%] hidden lg:flex"
          delay={2}
          duration={8.4}
        />
        <FloatChip
          icon={<Confetti className="size-3 text-[#04222A]" weight="fill" />}
          iconChip
          label="Nova temporada"
          value="Inscrições abertas"
          className="top-[15%] right-[38%] hidden xl:flex"
          delay={0}
          duration={7}
        />
      </div>
    </div>
  )
}

function PodiumColumn({
  place,
  heightClass,
  accent,
  delay,
}: {
  place: 1 | 2 | 3
  heightClass: string
  accent: "cyan" | "green" | "gradient"
  delay: number
}) {
  return (
    <div
      className={cn(
        "arena-podium relative w-[clamp(64px,7vw,104px)] overflow-hidden rounded-t-2xl ring-1 ring-white/8",
        heightClass,
        accent === "cyan" &&
          "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] to-transparent",
        accent === "green" &&
          "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-green)_24%,transparent)] via-[color-mix(in_oklab,var(--brand-green)_9%,transparent)] to-transparent",
        accent === "gradient" &&
          "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_12%,transparent)] to-transparent",
      )}
      style={{ "--rise-delay": `${delay}s` } as React.CSSProperties}
    >
      {/* topo com glow pulsante */}
      <span
        className={cn(
          "hero-podium-glow absolute inset-x-0 top-0 h-[3px] rounded-full",
          accent === "cyan" && "bg-[var(--brand-cyan)]",
          accent === "green" && "bg-[var(--brand-green)]",
          accent === "gradient" && "bg-gradient-custom",
        )}
        style={{ "--podium-delay": `${delay}s` } as React.CSSProperties}
      />
      {/* brilho varrendo a coluna */}
      <span
        className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
        style={{ "--shine-delay": `${1.4 + delay * 2}s` } as React.CSSProperties}
      />
      <span className="absolute inset-x-0 top-3 flex justify-center">
        {place === 1 ? (
          <Crown className="size-5 text-[var(--brand-mint)]" weight="fill" />
        ) : (
          <span className="text-foreground/50 text-sm font-black tabular-nums">
            {place}º
          </span>
        )}
      </span>
    </div>
  )
}

function FloatChip({
  icon,
  iconChip = false,
  label,
  value,
  className,
  delay,
  duration,
}: {
  icon: React.ReactNode
  iconChip?: boolean
  label: string
  value: string
  className?: string
  delay: number
  duration: number
}) {
  return (
    <div
      className={cn(
        "arena-tilt bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md",
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
        {iconChip ? (
          <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
            {icon}
          </span>
        ) : (
          icon
        )}
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  )
}

/**
 * Fantasma da arena: o pódio 2º·1º·3º subindo na mesma proporção, o
 * troféu flutuando com anel orbital sobre ele e os chips ao redor.
 */
export function ArenaHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className}>
      {/* piso em perspectiva, como na viz real */}
      <div className="absolute inset-x-[-24%] bottom-[-8%] h-[70%] [transform:perspective(620px)_rotateX(58deg)] [transform-origin:bottom]">
        <div className="hero-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_100%,#000_30%,transparent_80%)]" />
      </div>

      {/* troféu sobre o pódio */}
      <div
        className="hero-float absolute right-[26%] bottom-[54%] xl:right-[28%]"
        style={{ "--float-dur": "6.5s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]" />
        <GBone className="size-13 rounded-2xl lg:size-14 xl:size-16" />
      </div>

      {/* pódio */}
      <GBars
        heights={[30, 46, 21]}
        className="absolute inset-x-[6%] bottom-0 h-full items-end justify-center gap-2 lg:gap-2.5"
        barClass="w-[clamp(64px,7vw,104px)] rounded-t-2xl"
      />

      {/* chips flutuantes */}
      <GChip className="absolute top-[10%] right-[6%]" floatDelay={0.8} floatDur={7.6} />
      <GChip
        className="absolute top-[32%] right-[4%] hidden lg:flex"
        floatDelay={2}
        floatDur={8.4}
        delay={140}
      />
      <GChip
        className="absolute top-[15%] right-[38%] hidden xl:flex"
        floatDur={7}
        delay={280}
      />
    </VizGhost>
  )
}
