import { CheckCircle, Play, Sparkle, Star } from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Aulas — aula em reprodução:
 * aurora cyan + rose em deriva, tela de player 16:9 central com
 * botão de play pulsando, legendas fantasma preenchendo
 * dessincronizadas, barra de progresso com capítulos acendendo em
 * sequência, controles fantasma, estrela de avaliação saltando da
 * tela, sparkles, partículas e cometa. CSS puro, aria-hidden,
 * fluido de md a xl.
 */

const SPARKLES = [
  { left: "22%", top: "10%", size: 11, delay: 0, dur: 3.8, color: "mint", lgOnly: false },
  { left: "48%", top: "6%", size: 9, delay: 1.5, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "74%", top: "12%", size: 13, delay: 2.3, dur: 3.4, color: "mint", lgOnly: false },
  { left: "90%", top: "24%", size: 9, delay: 0.8, dur: 4.8, color: "cyan", lgOnly: false },
  { left: "34%", top: "80%", size: 8, delay: 3.1, dur: 3.6, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "24%", bottom: "26%", size: 3, delay: 0.5, dur: 5.8, x: 12, opacity: 0.8 },
  { left: "42%", bottom: "20%", size: 2, delay: 2.1, dur: 6.6, x: -12, opacity: 0.6 },
  { left: "60%", bottom: "28%", size: 3, delay: 1.3, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "78%", bottom: "22%", size: 2, delay: 3.5, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "90%", bottom: "30%", size: 3, delay: 2.7, dur: 5.6, x: 8, opacity: 0.75 },
] as const

/** Capítulos no track do player, acendendo em sequência com o progresso. */
const CHAPTERS = [
  { left: "25%", delay: 2 },
  { left: "50%", delay: 4 },
  { left: "75%", delay: 6 },
] as const

export function LessonsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora cyan + rose em deriva */}
        <span className="arena-aurora absolute -top-14 right-[8%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[42%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#fb7185_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[14%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2.4s",
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

        {/* tela do player em reprodução */}
        <div
          className="arena-tilt absolute top-[24%] right-[7%] xl:right-[10%]"
          style={
            { "--float-dur": "8.4s", "--float-delay": "0.3s" } as React.CSSProperties
          }
        >
          <div className="bg-card/70 supports-[backdrop-filter]:bg-card/45 relative aspect-video w-[clamp(220px,25vw,330px)] overflow-hidden rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_32%,transparent)] backdrop-blur-md">
            {/* brilho interno do topo */}
            <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] to-transparent" />

            {/* timestamp da aula */}
            <span className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums ring-1 ring-white/10 backdrop-blur-sm">
              12:34
            </span>

            {/* botão de play pulsando */}
            <span className="absolute inset-0 flex items-center justify-center pb-6">
              <span className="relative flex items-center justify-center">
                <span className="hero-pulse-ring absolute -inset-3.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
                <span className="bg-gradient-custom relative flex size-10 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_36px_-8px_rgba(31,254,200,0.6)] lg:size-11 xl:size-12">
                  <Play className="size-4.5 lg:size-5 xl:size-5.5" weight="fill" />
                </span>
              </span>
            </span>

            {/* legendas fantasma preenchendo dessincronizadas */}
            <div className="absolute inset-x-3 bottom-7 flex flex-col gap-1.5">
              <span className="h-1 overflow-hidden rounded-full bg-white/8">
                <span
                  className="hero-clip-progress block h-full rounded-full bg-white/30"
                  style={
                    { "--clip-dur": "5.2s", "--clip-delay": "0.4s" } as React.CSSProperties
                  }
                />
              </span>
              <span className="h-1 w-2/3 overflow-hidden rounded-full bg-white/8">
                <span
                  className="hero-clip-progress block h-full rounded-full bg-white/20"
                  style={
                    { "--clip-dur": "6.6s", "--clip-delay": "1.6s" } as React.CSSProperties
                  }
                />
              </span>
            </div>

            {/* barra de progresso do player com capítulos */}
            <div className="absolute inset-x-3 bottom-3">
              <span className="relative block h-1 rounded-full bg-white/12">
                <span
                  className="hero-clip-progress absolute inset-y-0 left-0 rounded-full bg-gradient-custom"
                  style={{ "--clip-dur": "8s" } as React.CSSProperties}
                >
                  {/* dot na ponta do progresso */}
                  <span className="absolute top-1/2 -right-1 size-2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]" />
                </span>
                {/* capítulos acendendo em sequência com o progresso */}
                {CHAPTERS.map((chapter, index) => (
                  <span
                    key={index}
                    className="arena-twinkle absolute top-1/2 z-10 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-mint)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]"
                    style={
                      {
                        left: chapter.left,
                        "--twinkle-delay": `${chapter.delay}s`,
                        "--twinkle-dur": "8s",
                        "--twinkle-opacity": 1,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
            </div>
          </div>

          {/* controles fantasma abaixo da barra */}
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="size-5 rounded-full bg-white/[0.06] ring-1 ring-white/12 backdrop-blur-sm" />
            <span className="size-6 rounded-full bg-white/[0.09] ring-1 ring-white/15 backdrop-blur-sm" />
            <span className="size-5 rounded-full bg-white/[0.06] ring-1 ring-white/12 backdrop-blur-sm" />
          </div>
        </div>

        {/* estrela de avaliação saltando da tela */}
        <Star
          weight="fill"
          className="arena-twinkle absolute top-[18%] right-[34%] size-4 text-amber-400 lg:size-4.5"
          style={
            {
              "--twinkle-delay": "1.2s",
              "--twinkle-dur": "4.6s",
              "--twinkle-opacity": 1,
            } as React.CSSProperties
          }
        />

        {/* chips flutuantes */}
        <FloatChip
          icon={<Play className="size-3 text-[#04222A]" weight="fill" />}
          label="Aula 04"
          value="Publicada"
          className="top-[8%] right-[5%]"
          delay={0.9}
          duration={7.6}
        />
        <FloatChip
          icon={<CheckCircle className="size-3 text-white" weight="fill" />}
          iconWrapClassName="bg-emerald-500"
          label="Academia"
          value="1,2 mil conclusões"
          className="top-[74%] right-[36%] hidden lg:flex"
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
  iconWrapClassName = "bg-gradient-custom",
  delay,
  duration,
}: {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
  iconWrapClassName?: string
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
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full",
            iconWrapClassName,
          )}
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  )
}

/**
 * Fantasma do player da aula: a tela 16:9 com play no centro, legendas,
 * barra de progresso com capítulos, controles e os chips ao redor.
 */
export function LessonsHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div
        className="hero-float absolute top-[24%] right-[7%] xl:right-[10%]"
        style={{ "--float-dur": "7.4s" } as React.CSSProperties}
      >
        <GPanel
          float={false}
          className="relative aspect-video w-[clamp(220px,25vw,330px)] overflow-hidden"
        >
          {/* timestamp */}
          <GBone delay={60} className="absolute top-2 right-2 h-3.5 w-10 rounded-md" />

          {/* play central */}
          <span className="absolute inset-0 flex items-center justify-center pb-6">
            <span className="hero-pulse-ring absolute size-10 rounded-full bg-white/10" />
            <GBone className="size-10 rounded-full lg:size-11 xl:size-12" />
          </span>

          {/* legendas fantasma */}
          <GLines
            widths={["72%", "48%"]}
            delay={140}
            className="absolute inset-x-3 bottom-7"
          />

          {/* barra de progresso */}
          <span className="absolute inset-x-3 bottom-3 block h-1 overflow-hidden rounded-full bg-white/12">
            <span
              className="hero-clip-progress block h-full rounded-full bg-white/35"
              style={
                {
                  "--clip-dur": "5.6s",
                  "--clip-delay": "0.6s",
                } as React.CSSProperties
              }
            />
          </span>
        </GPanel>
      </div>

      {/* chips flutuantes */}
      <GChip className="absolute top-[8%] right-[34%]" floatDelay={0.5} floatDur={7.2} />
      <GChip
        className="absolute bottom-[12%] right-[14%] hidden lg:flex"
        floatDelay={2.2}
        floatDur={8.4}
        delay={160}
      />
    </VizGhost>
  )
}
