import {
  InstagramLogo,
  LinkSimple,
  Magnet,
  Sparkle,
  TiktokLogo,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Captação — funil de captação:
 * aurora em deriva, campo de pontos estático, funil de 3 estágios
 * respirando com arestas brilhando, confetes-leads convergindo para a
 * boca do funil, partículas-clipadores saindo por baixo, ímã com halo,
 * bolhas de entrada em arco, sparkles e cometa. CSS puro, aria-hidden.
 */

const LEAD_CONFETTI = [
  { left: "52%", top: "1%", w: 5, h: 5, delay: 0, dur: 5.2, x: 36, rot: 260, color: "var(--brand-cyan)", opacity: 0.8, lgOnly: false },
  { left: "60%", top: "5%", w: 4, h: 8, delay: 1.6, dur: 5.8, x: 18, rot: 320, color: "var(--brand-mint)", opacity: 0.85, lgOnly: false },
  { left: "68%", top: "2%", w: 5, h: 5, delay: 3.1, dur: 5, x: 0, rot: 220, color: "var(--brand-green)", opacity: 0.75, lgOnly: false },
  { left: "76%", top: "6%", w: 4, h: 8, delay: 0.8, dur: 6.2, x: -18, rot: 300, color: "var(--brand-cyan)", opacity: 0.7, lgOnly: true },
  { left: "84%", top: "1%", w: 5, h: 5, delay: 2.3, dur: 5.5, x: -36, rot: 240, color: "var(--brand-mint)", opacity: 0.8, lgOnly: false },
] as const

const OUTPUT_PARTICLES = [
  { left: "64%", bottom: "18%", size: 3, delay: 0.6, dur: 5.4, x: -10, opacity: 0.85 },
  { left: "69%", bottom: "14%", size: 4, delay: 2, dur: 6, x: 6, opacity: 0.9 },
  { left: "74%", bottom: "17%", size: 3, delay: 3.4, dur: 5.6, x: 12, opacity: 0.75 },
  { left: "67%", bottom: "10%", size: 2, delay: 4.4, dur: 6.6, x: -6, opacity: 0.6 },
] as const

const SPARKLES = [
  { left: "30%", top: "10%", size: 11, delay: 0, dur: 3.6, color: "mint", lgOnly: false },
  { left: "46%", top: "30%", size: 9, delay: 1.5, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "88%", top: "24%", size: 12, delay: 2.4, dur: 3.4, color: "mint", lgOnly: false },
  { left: "54%", top: "70%", size: 9, delay: 0.9, dur: 4.6, color: "cyan", lgOnly: false },
  { left: "90%", top: "58%", size: 8, delay: 3.2, dur: 3.8, color: "cyan", lgOnly: true },
] as const

const FUNNEL_STAGES = [
  {
    accent: "cyan",
    width: "100%",
    clip: "polygon(0 0, 100% 0, 84% 100%, 16% 100%)",
    rise: 0.15,
    glow: "bg-[var(--brand-cyan)]",
    gradient:
      "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_14%,transparent)] to-[color-mix(in_oklab,var(--brand-cyan)_5%,transparent)]",
  },
  {
    accent: "mint",
    width: "66%",
    clip: "polygon(0 0, 100% 0, 76% 100%, 24% 100%)",
    rise: 0.4,
    glow: "bg-[var(--brand-mint)]",
    gradient:
      "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_5%,transparent)]",
  },
  {
    accent: "green",
    width: "40%",
    clip: "polygon(0 0, 100% 0, 66% 100%, 34% 100%)",
    rise: 0.65,
    glow: "bg-[var(--brand-green)]",
    gradient:
      "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-green)_32%,transparent)] via-[color-mix(in_oklab,var(--brand-green)_15%,transparent)] to-[color-mix(in_oklab,var(--brand-green)_6%,transparent)]",
  },
] as const

const ENTRY_BUBBLES = [
  { icon: InstagramLogo, className: "top-[6%] right-[46%] text-pink-400", delay: 0.4, dur: 7 },
  { icon: TiktokLogo, className: "top-[32%] right-[52%] hidden text-[#f1204a] xl:flex", delay: 1.8, dur: 8.2 },
  { icon: UserPlus, className: "top-[56%] right-[46%] hidden text-[var(--brand-mint)] lg:flex", delay: 2.8, dur: 7.4 },
] as const

export function AcquisitionHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-14 right-[16%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-8s" }}
        />

        {/* campo de pontos estático (distinto do grid) */}
        <div className="absolute inset-0 bg-[radial-gradient(color-mix(in_oklab,var(--brand-cyan)_22%,transparent)_1px,transparent_1px)] [background-size:22px_22px] opacity-50 [mask-image:radial-gradient(ellipse_at_68%_45%,#000_25%,transparent_75%)]" />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[8%] right-[4%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-mint)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "3s",
              "--comet-x": "-300px",
              "--comet-y": "210px",
              "--comet-angle": "-35deg",
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

        {/* confetes-leads convergindo para a boca do funil */}
        {LEAD_CONFETTI.map((confetti, index) => (
          <span
            key={index}
            className={cn(
              "arena-confetti absolute rounded-[2px]",
              confetti.lgOnly && "hidden lg:block",
            )}
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

        {/* halo estático atrás do funil */}
        <span className="absolute top-[18%] right-[6%] h-[58%] w-[52%] rounded-full bg-[radial-gradient(ellipse,color-mix(in_oklab,var(--brand-mint)_14%,transparent),transparent_68%)] blur-xl" />

        {/* funil de 3 estágios */}
        <div className="absolute top-[16%] right-[10%] flex w-[clamp(160px,20vw,236px)] flex-col items-center gap-1.5 xl:right-[14%]">
          {FUNNEL_STAGES.map((stage, index) => (
            <div
              key={stage.accent}
              className={cn(
                "arena-podium relative h-[clamp(30px,4vw,46px)] overflow-hidden",
                stage.gradient,
              )}
              style={
                {
                  width: stage.width,
                  clipPath: stage.clip,
                  "--rise-delay": `${stage.rise}s`,
                } as React.CSSProperties
              }
            >
              {/* aresta superior com glow pulsante */}
              <span
                className={cn(
                  "hero-podium-glow absolute inset-x-0 top-0 h-[3px]",
                  stage.glow,
                )}
                style={{ "--podium-delay": `${stage.rise}s` } as React.CSSProperties}
              />
              {/* brilho varrendo o estágio */}
              <span
                className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                style={
                  { "--shine-delay": `${1.6 + index * 1.1}s` } as React.CSSProperties
                }
              />
            </div>
          ))}
          {/* fio de saída na boca inferior */}
          <span className="h-[clamp(18px,3vw,30px)] w-px bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-green)_70%,transparent)] to-transparent" />
        </div>

        {/* partículas-clipadores saindo por baixo do funil */}
        {OUTPUT_PARTICLES.map((particle, index) => (
          <span
            key={index}
            className={cn(
              "arena-particle absolute rounded-full",
              index % 2 === 0
                ? "bg-[var(--brand-green)]"
                : "bg-[var(--brand-mint)]",
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

        {/* badge ímã com halo pulsante */}
        <div
          className="arena-tilt absolute top-[34%] right-[42%] xl:right-[44%]"
          style={{ "--float-dur": "6.6s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]" />
          <span className="bg-gradient-custom relative flex size-11 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_38px_-10px_rgba(31,254,200,0.55)] lg:size-12 xl:size-13">
            <Magnet className="size-5 lg:size-6" weight="fill" />
          </span>
        </div>

        {/* bolhas de entrada derivando em arco na direção do funil */}
        {ENTRY_BUBBLES.map(({ icon: BubbleIcon, className: posClass, delay, dur }, index) => (
          <span
            key={index}
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
            <BubbleIcon className="size-4.5 lg:size-5" weight="fill" />
          </span>
        ))}

        {/* chips flutuantes */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[62%] right-[4%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "1.2s", "--float-dur": "7.6s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <UserPlus className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Novos cadastros
          </span>
          <span className="text-foreground text-xs font-bold">
            Chegando todo dia
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[8%] right-[3%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={{ "--float-delay": "2.6s", "--float-dur": "8.4s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <LinkSimple className="size-3 text-[#04222A]" weight="bold" />
            </span>
            Canais ativos
          </span>
          <span className="text-foreground text-xs font-bold">
            Origens mapeadas
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do funil de aquisição: os três estágios com o mesmo recorte
 * subindo, o fio de saída, o ímã, as bolhas de origem e os chips.
 */
export function AcquisitionHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="68%">
      {/* funil de 3 estágios */}
      <div className="absolute top-[16%] right-[10%] flex w-[clamp(160px,20vw,236px)] flex-col items-center gap-1.5 xl:right-[14%]">
        {FUNNEL_STAGES.map((stage) => (
          <span
            key={stage.accent}
            className="arena-podium skeleton-bone skeleton-bone-strong block h-[clamp(30px,4vw,46px)]"
            style={
              {
                width: stage.width,
                clipPath: stage.clip,
                "--rise-delay": `${stage.rise}s`,
                "--shimmer-delay": `${stage.rise * 1000}ms`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* fio de saída */}
        <span className="h-[clamp(18px,3vw,30px)] w-px bg-gradient-to-b from-white/25 to-transparent" />
      </div>

      {/* ímã */}
      <div
        className="hero-float absolute top-[34%] right-[42%] xl:right-[44%]"
        style={{ "--float-dur": "6.6s" } as React.CSSProperties}
      >
        <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-white/8" />
        <GBone className="size-11 rounded-full lg:size-12 xl:size-13" />
      </div>

      {/* bolhas de origem */}
      {ENTRY_BUBBLES.map((bubble, index) => (
        <div
          key={index}
          className={cn(
            "hero-float absolute size-9 lg:size-10",
            bubble.className,
          )}
          style={
            {
              "--float-delay": `${bubble.delay}s`,
              "--float-dur": `${bubble.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 120} className="size-full rounded-xl" />
        </div>
      ))}

      {/* chips */}
      <GChip
        className="absolute top-[62%] right-[4%]"
        floatDelay={1.2}
        floatDur={7.6}
      />
      <GChip
        className="absolute top-[8%] right-[3%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.4}
        delay={150}
      />
    </VizGhost>
  )
}
