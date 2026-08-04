import {
  ChartLineUp,
  Crown,
  Medal,
  Sparkle,
  Star,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Ranking — estrela em ascensão /
 * hall da fama: aurora dourada-cyan, holofotes cruzados, estrela
 * central subindo com cauda de partículas, trio de medalhas
 * flutuando, arcos de louros, confetes, ondas no chão e sparkles.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "18%", top: "10%", size: 11, delay: 0, dur: 3.6, tone: "amber", lgOnly: false },
  { left: "44%", top: "6%", size: 9, delay: 1.3, dur: 4.4, tone: "cyan", lgOnly: true },
  { left: "68%", top: "13%", size: 13, delay: 2.4, dur: 3.4, tone: "amber", lgOnly: false },
  { left: "88%", top: "22%", size: 9, delay: 0.8, dur: 4.8, tone: "mint", lgOnly: false },
  { left: "30%", top: "28%", size: 8, delay: 3.1, dur: 3.8, tone: "cyan", lgOnly: true },
  { left: "80%", top: "44%", size: 10, delay: 1.9, dur: 4.1, tone: "amber", lgOnly: true },
] as const

/* cauda de subida da estrela: partículas nascendo logo abaixo dela */
const STAR_TRAIL = [
  { left: "60%", bottom: "34%", size: 4, delay: 0, dur: 3.6, x: 4, opacity: 0.9 },
  { left: "63%", bottom: "30%", size: 3, delay: 0.9, dur: 4.2, x: -5, opacity: 0.75 },
  { left: "57%", bottom: "31%", size: 3, delay: 1.7, dur: 3.9, x: 6, opacity: 0.8 },
  { left: "66%", bottom: "27%", size: 2, delay: 2.6, dur: 4.6, x: -4, opacity: 0.6 },
  { left: "54%", bottom: "26%", size: 2, delay: 3.4, dur: 4.4, x: 5, opacity: 0.6 },
] as const

const CONFETTI = [
  { left: "30%", top: "18%", w: 4, h: 8, delay: 0.4, dur: 5.6, x: 16, rot: 300, color: "#fbbf24", opacity: 0.85 },
  { left: "40%", top: "14%", w: 5, h: 5, delay: 2, dur: 6.4, x: -14, rot: 240, color: "var(--brand-cyan)", opacity: 0.7 },
  { left: "72%", top: "16%", w: 4, h: 9, delay: 1.1, dur: 5.8, x: 12, rot: 330, color: "var(--brand-mint)", opacity: 0.8 },
  { left: "82%", top: "20%", w: 5, h: 5, delay: 3.2, dur: 6, x: -18, rot: 260, color: "#f59e0b", opacity: 0.7 },
  { left: "52%", top: "12%", w: 4, h: 8, delay: 4.1, dur: 5.4, x: 10, rot: 310, color: "var(--brand-cyan)", opacity: 0.75 },
] as const

const MEDALS = [
  {
    /* ouro — maior, na frente */
    className:
      "right-[38%] bottom-[16%] size-12 bg-gradient-to-br from-amber-400 to-yellow-600 text-amber-950 ring-amber-300/50 shadow-[0_12px_36px_-10px_rgba(245,158,11,0.65)] lg:size-14",
    iconClass: "size-6 lg:size-7",
    delay: 0,
    dur: 6.6,
    lgOnly: false,
  },
  {
    /* prata */
    className:
      "right-[54%] bottom-[10%] size-9 bg-gradient-to-br from-zinc-200 to-zinc-500 text-zinc-800 ring-white/40 shadow-[0_10px_28px_-10px_rgba(161,161,170,0.6)] lg:size-11",
    iconClass: "size-4.5 lg:size-5.5",
    delay: 0.8,
    dur: 7.4,
    lgOnly: false,
  },
  {
    /* bronze */
    className:
      "right-[22%] bottom-[8%] size-8 bg-gradient-to-br from-orange-300 to-orange-700 text-orange-950 ring-orange-300/40 shadow-[0_10px_28px_-10px_rgba(234,88,12,0.55)] lg:size-10",
    iconClass: "size-4 lg:size-5",
    delay: 1.6,
    dur: 8,
    lgOnly: false,
  },
] as const

export function RankingHallHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora dourada-cyan em deriva */}
        <span className="arena-aurora absolute -top-16 right-[26%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f59e0b_20%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[2%] top-[24%] size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-5s" }}
        />
        <span
          className="arena-aurora absolute right-[46%] bottom-[-6%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_16%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-9s" }}
        />

        {/* holofotes cruzados vindos do topo */}
        <span
          className="arena-spot absolute -top-10 left-[30%] h-[88%] w-24 bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] to-transparent [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)] lg:w-32"
          style={{ rotate: "-10deg" }}
        />
        <span
          className="arena-spot absolute -top-10 right-[18%] h-[88%] w-24 bg-gradient-to-b from-[color-mix(in_oklab,#f59e0b_30%,transparent)] via-[color-mix(in_oklab,#f59e0b_10%,transparent)] to-transparent [clip-path:polygon(42%_0,58%_0,100%_100%,0_100%)] lg:w-32"
          style={{ rotate: "10deg", "--spot-delay": "-3.5s" } as React.CSSProperties}
        />

        {/* cometa dourado riscando o alto */}
        <span
          className="arena-comet absolute top-[7%] right-[6%] hidden h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,#fbbf24_75%,transparent)] to-transparent lg:block"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "3s",
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
              sparkle.tone === "amber" && "text-amber-400",
              sparkle.tone === "cyan" && "text-[var(--brand-cyan)]",
              sparkle.tone === "mint" && "text-[var(--brand-mint)]",
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

        {/* confetes caindo dos holofotes */}
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

        {/* cauda de subida: partículas nascendo abaixo da estrela */}
        {STAR_TRAIL.map((particle, index) => (
          <span
            key={index}
            className={cn(
              "arena-particle absolute rounded-full",
              index % 2 === 0 ? "bg-amber-400" : "bg-[var(--brand-cyan)]",
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

        {/* arcos de louros ladeando a estrela */}
        <span
          className="hero-area-breathe absolute top-[30%] right-[46%] h-[clamp(80px,11vw,140px)] w-[clamp(40px,5.5vw,70px)] rounded-[100%] border-b-2 border-[color-mix(in_oklab,var(--brand-mint)_55%,transparent)]"
          style={{ rotate: "24deg" }}
        />
        <span
          className="hero-area-breathe absolute top-[30%] right-[16%] h-[clamp(80px,11vw,140px)] w-[clamp(40px,5.5vw,70px)] rounded-[100%] border-b-2 border-[color-mix(in_oklab,var(--brand-mint)_55%,transparent)]"
          style={{ rotate: "-24deg", animationDelay: "-2.5s" }}
        />

        {/* estrela central em ascensão */}
        <div
          className="arena-tilt absolute top-[26%] right-[30%] xl:right-[32%]"
          style={{ "--float-dur": "6.4s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-6 rounded-full bg-[color-mix(in_oklab,#fbbf24_35%,transparent)]" />
          <span className="arena-ring absolute -inset-3 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,#fbbf24_80%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-cyan)_65%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          {/* satélites orbitando a estrela */}
          <span
            className="arena-ring absolute -inset-7 rounded-full"
            style={{ animationDuration: "14s" }}
          >
            <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]" />
            <span className="absolute bottom-[10%] right-[12%] size-1 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
          </span>
          <span className="bg-gradient-custom relative flex size-16 items-center justify-center rounded-full text-[#04222A] shadow-[0_16px_50px_-10px_rgba(31,254,200,0.6)] lg:size-20">
            <Star className="size-8 lg:size-10" weight="fill" />
          </span>
        </div>

        {/* trio de medalhas flutuando */}
        {MEDALS.map((medal, index) => (
          <span
            key={index}
            className={cn(
              "hero-float absolute flex items-center justify-center rounded-full ring-2 backdrop-blur-md",
              medal.className,
              medal.lgOnly && "hidden lg:flex",
            )}
            style={
              {
                "--float-delay": `${medal.delay}s`,
                "--float-dur": `${medal.dur}s`,
              } as React.CSSProperties
            }
          >
            <Medal className={medal.iconClass} weight="fill" />
          </span>
        ))}

        {/* ondas no chão sob a estrela */}
        <div className="absolute bottom-[-2%] left-[62%]">
          {[0, 1].map((index) => (
            <span
              key={index}
              className="arena-ripple absolute bottom-0 left-0 h-[clamp(34px,4.5vw,56px)] w-[clamp(160px,20vw,260px)] rounded-[100%] border border-[color-mix(in_oklab,#fbbf24_45%,transparent)]"
              style={
                {
                  marginLeft: "calc(clamp(160px, 20vw, 260px) / -2)",
                  "--ripple-dur": "5s",
                  "--ripple-delay": `${index * 2.5}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* chips flutuantes */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[10%] right-[8%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#f59e0b_28%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "1.2s", "--float-dur": "7.8s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-600">
              <Crown className="size-3 text-amber-950" weight="fill" />
            </span>
            Hall da fama
          </span>
          <span className="text-foreground text-xs font-bold">
            Lendas da liga
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[54%] right-[4%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={{ "--float-delay": "2.6s", "--float-dur": "8.6s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <ChartLineUp className="size-3 text-[#04222A]" weight="bold" />
            </span>
            Recordes do mês
          </span>
          <span className="text-foreground text-xs font-bold">
            Novas marcas
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do hall da fama: a estrela central com anel orbital, os arcos
 * de louros, o trio de medalhas na base e os dois chips.
 */
export function RankingHallHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  const MEDAL_GHOSTS = [
    { className: "right-[38%] bottom-[16%] size-12 lg:size-14", delay: 0, dur: 6.6 },
    { className: "right-[54%] bottom-[10%] size-9 lg:size-11", delay: 0.8, dur: 7.4 },
    { className: "right-[22%] bottom-[8%] size-8 lg:size-10", delay: 1.6, dur: 8 },
  ]

  return (
    <VizGhost className={className} focus="64%">
      {/* arcos de louros */}
      <span
        className="hero-area-breathe absolute top-[30%] right-[46%] h-[clamp(80px,11vw,140px)] w-[clamp(40px,5.5vw,70px)] rounded-[100%] border-b-2 border-white/12"
        style={{ rotate: "24deg" }}
      />
      <span
        className="hero-area-breathe absolute top-[30%] right-[16%] h-[clamp(80px,11vw,140px)] w-[clamp(40px,5.5vw,70px)] rounded-[100%] border-b-2 border-white/12"
        style={{ rotate: "-24deg", animationDelay: "-2.5s" }}
      />

      {/* estrela central */}
      <div
        className="hero-float absolute top-[26%] right-[30%] xl:right-[32%]"
        style={{ "--float-dur": "6.4s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-3 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]" />
        <GBone className="size-16 rounded-full lg:size-20" />
      </div>

      {/* trio de medalhas */}
      {MEDAL_GHOSTS.map((medal, index) => (
        <div
          key={index}
          className={cn("hero-float absolute", medal.className)}
          style={
            {
              "--float-delay": `${medal.delay}s`,
              "--float-dur": `${medal.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 130} className="size-full rounded-full" />
        </div>
      ))}

      {/* chips flutuantes */}
      <GChip
        className="absolute top-[10%] right-[8%]"
        floatDelay={1.2}
        floatDur={7.8}
      />
      <GChip
        className="absolute top-[54%] right-[4%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.6}
        delay={160}
      />
    </VizGhost>
  )
}
