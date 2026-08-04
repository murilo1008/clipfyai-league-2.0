import {
  BookmarkSimple,
  Clock,
  FilmSlate,
  Play,
  Scissors,
  Sparkle,
  Tag,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero da Biblioteca — acervo em leque:
 * aurora em deriva, quatro capas 9:16 abertas em leque respirando
 * (hero-float dessincronizado), capa frontal com badge de play e
 * brilho varrendo, etiquetas de organização flutuando, sparkles,
 * partículas e cometa. CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "24%", top: "10%", size: 11, delay: 0, dur: 3.8, color: "mint", lgOnly: false },
  { left: "50%", top: "6%", size: 9, delay: 1.6, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "72%", top: "14%", size: 13, delay: 2.4, dur: 3.4, color: "mint", lgOnly: false },
  { left: "90%", top: "22%", size: 9, delay: 0.8, dur: 4.8, color: "cyan", lgOnly: false },
  { left: "38%", top: "78%", size: 8, delay: 3.2, dur: 3.6, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "26%", bottom: "24%", size: 3, delay: 0.6, dur: 5.8, x: 12, opacity: 0.8 },
  { left: "42%", bottom: "18%", size: 2, delay: 2.2, dur: 6.6, x: -12, opacity: 0.6 },
  { left: "58%", bottom: "26%", size: 3, delay: 1.4, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "76%", bottom: "20%", size: 2, delay: 3.6, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "90%", bottom: "28%", size: 3, delay: 2.8, dur: 5.6, x: 8, opacity: 0.75 },
] as const

/** Capas do acervo abertas em leque — a última é a da frente. */
const FAN_CARDS = [
  { tone: "muted", rotate: -12, lift: 14, z: 10, delay: 0.6, dur: 7.6 },
  { tone: "cyan", rotate: -4, lift: 4, z: 20, delay: 1.6, dur: 8.4 },
  { tone: "mint", rotate: 4, lift: 4, z: 30, delay: 0.2, dur: 7 },
  { tone: "front", rotate: 12, lift: 14, z: 40, delay: 1, dur: 7.9 },
] as const

const CARD_TONES: Record<(typeof FAN_CARDS)[number]["tone"], string> = {
  muted: "bg-gradient-to-b from-white/[0.09] via-white/[0.04] to-transparent",
  cyan: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] to-transparent",
  mint: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_24%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_9%,transparent)] to-transparent",
  front:
    "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)] to-[color-mix(in_oklab,var(--brand-green)_8%,transparent)]",
}

/** Etiquetas de organização do acervo flutuando ao redor do leque. */
const LABEL_CHIPS = [
  {
    icon: BookmarkSimple,
    color: "text-amber-400",
    className: "top-[10%] right-[36%]",
    delay: 0.4,
    dur: 7.2,
    lgOnly: false,
  },
  {
    icon: Tag,
    color: "text-[var(--brand-cyan)]",
    className: "top-[56%] right-[46%]",
    delay: 1.8,
    dur: 8,
    lgOnly: true,
  },
  {
    icon: Scissors,
    color: "text-violet-400",
    className: "top-[68%] right-[8%]",
    delay: 2.6,
    dur: 7.4,
    lgOnly: false,
  },
] as const

export function LibraryHeroViz({ className }: { className?: string }) {
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
          className="arena-aurora absolute right-[40%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

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

        {/* acervo em leque: 4 capas 9:16 respirando */}
        <div className="absolute top-[22%] right-[8%] flex items-end lg:top-[24%] xl:right-[12%]">
          {FAN_CARDS.map((card, index) => {
            const isFront = card.tone === "front"
            return (
              <div
                key={index}
                className={cn(
                  "hero-float relative aspect-[9/16] w-[clamp(58px,6.6vw,92px)] overflow-hidden rounded-xl shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-[2px]",
                  CARD_TONES[card.tone],
                  index > 0 && "-ml-6 lg:-ml-7",
                )}
                style={
                  {
                    rotate: `${card.rotate}deg`,
                    translate: `0 ${card.lift}px`,
                    transformOrigin: "50% 100%",
                    zIndex: card.z,
                    "--float-delay": `${card.delay}s`,
                    "--float-dur": `${card.dur}s`,
                  } as React.CSSProperties
                }
              >
                {/* legendas fantasma da capa */}
                <span className="absolute inset-x-2 bottom-2.5 h-1 rounded-full bg-white/12" />
                <span className="absolute bottom-4.5 left-2 h-1 w-1/2 rounded-full bg-white/8" />

                {isFront && (
                  <>
                    {/* badge central de play */}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="relative flex items-center justify-center">
                        <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
                        <span className="bg-gradient-custom relative flex size-8 items-center justify-center rounded-full text-[#04222A] shadow-[0_10px_30px_-8px_rgba(31,254,200,0.6)] lg:size-9">
                          <Play className="size-4 lg:size-4.5" weight="fill" />
                        </span>
                      </span>
                    </span>
                    {/* brilho varrendo a capa frontal */}
                    <span
                      className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/14 to-transparent"
                      style={{ "--shine-delay": "1.6s" } as React.CSSProperties}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* etiquetas do acervo flutuando */}
        {LABEL_CHIPS.map(({ icon: LabelIcon, color, className: posClass, delay, dur, lgOnly }, index) => (
          <span
            key={index}
            className={cn(
              "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex size-9 items-center justify-center rounded-xl shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:size-10",
              lgOnly && "hidden lg:flex",
              posClass,
            )}
            style={
              {
                "--float-delay": `${delay}s`,
                "--float-dur": `${dur}s`,
              } as React.CSSProperties
            }
          >
            <LabelIcon className={cn("size-4.5 lg:size-5", color)} weight="fill" />
          </span>
        ))}

        {/* chips de resumo do acervo */}
        <FloatChip
          icon={<FilmSlate className="size-3 text-[#04222A]" weight="fill" />}
          label="Acervo"
          value="1,2 mil vídeos"
          className="top-[12%] right-[4%]"
          delay={0.9}
          duration={7.6}
        />
        <FloatChip
          icon={<Clock className="size-3 text-[#04222A]" weight="fill" />}
          label="Duração"
          value="48h de conteúdo"
          className="top-[72%] right-[30%] hidden lg:flex"
          delay={2.2}
          duration={8.2}
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
 * Fantasma do acervo: as quatro capas 9:16 em leque com o play na capa
 * da frente, as etiquetas flutuando e os chips de resumo.
 */
export function LibraryHeroVizSkeleton({ className }: { className?: string }) {
  const COVERS = [
    { rotate: "-10deg", translate: "10px", delay: 0, dur: 7.2, faint: true },
    { rotate: "-4deg", translate: "4px", delay: 0.6, dur: 7.8, faint: true },
    { rotate: "3deg", translate: "0px", delay: 1.2, dur: 8.4, faint: false },
    { rotate: "9deg", translate: "8px", delay: 1.8, dur: 7, faint: true },
  ]

  return (
    <VizGhost className={className} focus="70%">
      <div className="absolute top-[22%] right-[8%] flex items-end -space-x-2 lg:top-[24%] xl:right-[12%]">
        {COVERS.map((cover, index) => (
          <span
            key={index}
            className="hero-float relative block aspect-[9/16] w-[clamp(58px,6.6vw,92px)]"
            style={
              {
                rotate: cover.rotate,
                translate: `0 ${cover.translate}`,
                "--float-delay": `${cover.delay}s`,
                "--float-dur": `${cover.dur}s`,
              } as React.CSSProperties
            }
          >
            <GBone
              faint={cover.faint}
              delay={index * 110}
              className="size-full rounded-xl"
            />
            {/* legendas fantasma da capa */}
            <span className="absolute inset-x-2 bottom-2.5 h-1 rounded-full bg-white/12" />
            <span className="absolute bottom-4.5 left-2 h-1 w-1/2 rounded-full bg-white/8" />
            {!cover.faint && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="hero-pulse-ring absolute size-8 rounded-full bg-white/10" />
                <GBone className="size-8 rounded-full lg:size-9" />
              </span>
            )}
          </span>
        ))}
      </div>

      {/* etiquetas do acervo */}
      {[
        { className: "top-[12%] right-[42%]", delay: 0.5, dur: 7.2 },
        { className: "top-[62%] right-[6%]", delay: 1.9, dur: 8 },
        { className: "top-[38%] right-[52%] hidden lg:block", delay: 2.8, dur: 7.6 },
      ].map((tag, index) => (
        <div
          key={index}
          className={cn("hero-float absolute size-9 lg:size-10", tag.className)}
          style={
            {
              "--float-delay": `${tag.delay}s`,
              "--float-dur": `${tag.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 120} className="size-full rounded-xl" />
        </div>
      ))}

      {/* chips de resumo */}
      <GChip className="absolute top-[6%] right-[10%]" floatDelay={1} floatDur={7.4} />
      <GChip
        className="absolute bottom-[10%] right-[36%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
