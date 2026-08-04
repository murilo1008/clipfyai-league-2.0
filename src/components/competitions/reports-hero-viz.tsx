import {
  ChartBar,
  FileCsv,
  SealCheck,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Relatórios — "relatório sendo gerado":
 * aurora em deriva, folhas A4 glass empilhadas flutuando, linhas de texto
 * que se preenchem (relatório sendo escrito), mini gráfico e mini donut
 * embutidos na folha, selo de aprovado carimbado com anel pulsante,
 * chips de exportação/analytics, sparkles, partículas e um cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "20%", top: "12%", size: 12, delay: 0, dur: 3.6, color: "mint", lgOnly: false },
  { left: "52%", top: "8%", size: 9, delay: 1.4, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "78%", top: "18%", size: 13, delay: 2.2, dur: 3.8, color: "mint", lgOnly: false },
  { left: "88%", top: "44%", size: 9, delay: 0.8, dur: 4.2, color: "cyan", lgOnly: false },
  { left: "34%", top: "30%", size: 8, delay: 3, dur: 3.4, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "18%", bottom: "24%", size: 3, delay: 0, dur: 5.4, x: 10, opacity: 0.8 },
  { left: "34%", bottom: "18%", size: 2, delay: 1.8, dur: 6.6, x: -12, opacity: 0.55 },
  { left: "52%", bottom: "26%", size: 4, delay: 0.9, dur: 5.8, x: 8, opacity: 0.85 },
  { left: "70%", bottom: "20%", size: 2, delay: 2.6, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "86%", bottom: "28%", size: 3, delay: 3.4, dur: 5.6, x: 12, opacity: 0.75 },
] as const

/** Linhas estáticas de "texto" das folhas de trás. */
const BACK_LINES = ["w-full", "w-4/5", "w-11/12", "w-3/5", "w-4/6"] as const

/** Mini gráfico embutido na folha da frente. */
const MINI_BARS = [
  { height: 42, delay: 0, dur: 2.8 },
  { height: 68, delay: 0.25, dur: 3.2 },
  { height: 54, delay: 0.5, dur: 2.6 },
  { height: 88, delay: 0.75, dur: 3.4 },
  { height: 72, delay: 1, dur: 3 },
] as const

export function ReportsHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-14 right-[12%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[4%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* cometa cruzando o topo */}
        <span
          className="arena-comet absolute top-[6%] right-[10%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2s",
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

        {/* ===== pilha de folhas de relatório ===== */}
        <div className="absolute top-1/2 right-[13%] -translate-y-1/2 lg:right-[17%] xl:right-[20%]">
          {/* folha de trás (esquerda) */}
          <BackSheet
            className="top-8 -left-[clamp(72px,8vw,104px)] w-[clamp(96px,10vw,124px)] rotate-[-11deg]"
            floatDelay={1.6}
            floatDur={8.6}
            lines={4}
          />
          {/* folha de trás (direita, lg+) */}
          <BackSheet
            className="top-14 -right-[clamp(56px,6.5vw,88px)] hidden w-[clamp(88px,9vw,112px)] rotate-[9deg] lg:block"
            floatDelay={2.8}
            floatDur={7.4}
            lines={5}
          />

          {/* folha da frente — relatório sendo escrito */}
          <div
            className="hero-float relative w-[clamp(148px,15vw,190px)] rotate-[3deg]"
            style={
              {
                "--float-delay": "0.4s",
                "--float-dur": "7.8s",
              } as React.CSSProperties
            }
          >
            <div className="bg-card/70 supports-[backdrop-filter]:bg-card/55 relative flex aspect-[210/297] flex-col gap-2.5 rounded-2xl p-3.5 shadow-[0_22px_54px_-18px_rgba(20,247,254,0.4)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_40%,transparent)] backdrop-blur-md">
              {/* hairline da marca no topo */}
              <span className="bg-gradient-custom absolute inset-x-[14%] top-0 h-px" />

              {/* cabeçalho do relatório */}
              <div className="flex items-center gap-1.5">
                <span className="bg-gradient-custom flex size-5 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                  <ChartBar className="size-3" weight="fill" />
                </span>
                <span className="block h-1.5 w-12 rounded-full bg-white/25" />
              </div>

              {/* linhas de texto que se preenchem (relatório sendo escrito) */}
              <div className="flex flex-col gap-1.5">
                <WritingLine dur={4.8} delay={0.3} accent />
                <WritingLine dur={5.8} delay={1.5} />
                <span className="block h-1.5 w-4/5 rounded-full bg-white/15" />
                <WritingLine dur={6.6} delay={2.8} width="w-11/12" />
              </div>

              {/* mini gráfico de barras */}
              <div className="flex h-10 flex-1 items-end gap-1 rounded-lg bg-white/5 p-1.5">
                {MINI_BARS.map((bar, index) => (
                  <span
                    key={index}
                    className="hero-bar w-full flex-1 rounded-t-[3px] bg-gradient-to-t from-[var(--brand-cyan)] to-[color-mix(in_oklab,var(--brand-green)_30%,transparent)]"
                    style={
                      {
                        height: `${bar.height}%`,
                        "--bar-delay": `${bar.delay}s`,
                        "--bar-dur": `${bar.dur}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>

              {/* mini donut estático + linhas de resumo */}
              <div className="flex items-center gap-2">
                <span className="size-8 shrink-0 -rotate-45 rounded-full border-4 border-[var(--brand-cyan)] border-t-[var(--brand-mint)] border-r-[var(--brand-green)] opacity-90" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="block h-1 w-full rounded-full bg-white/15" />
                  <span className="block h-1 w-3/4 rounded-full bg-white/15" />
                  <span className="block h-1 w-1/2 rounded-full bg-white/10" />
                </div>
              </div>

              {/* selo de aprovado carimbado no canto */}
              <div
                className="arena-tilt absolute -right-3.5 -bottom-3.5"
                style={{ "--float-dur": "6.5s" } as React.CSSProperties}
              >
                <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
                <span className="bg-gradient-custom relative flex size-9 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_32px_-8px_rgba(31,254,200,0.6)] lg:size-10">
                  <SealCheck className="size-5 lg:size-5.5" weight="fill" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* chips glass flutuantes */}
        <FloatChip
          icon={<FileCsv className="size-3 text-[#04222A]" weight="fill" />}
          label="Exportar CSV"
          value="Todos os posts"
          className="top-[10%] right-[5%]"
          delay={0.8}
          duration={7.6}
        />
        <FloatChip
          icon={<ChartBar className="size-3 text-[#04222A]" weight="fill" />}
          label="Analytics"
          value="Tempo real"
          className="bottom-[12%] right-[36%] hidden lg:flex"
          delay={2.2}
          duration={8.4}
        />
      </div>
    </div>
  )
}

/** Linha de texto que se preenche com o vocabulário hero-clip-progress. */
function WritingLine({
  dur,
  delay,
  width = "w-full",
  accent = false,
}: {
  dur: number
  delay: number
  width?: string
  accent?: boolean
}) {
  return (
    <span
      className={cn("block h-1.5 overflow-hidden rounded-full bg-white/10", width)}
    >
      <span
        className={cn(
          "hero-clip-progress block h-full rounded-full",
          accent ? "bg-gradient-custom opacity-80" : "bg-white/25",
        )}
        style={
          {
            "--clip-dur": `${dur}s`,
            "--clip-delay": `${delay}s`,
          } as React.CSSProperties
        }
      />
    </span>
  )
}

/** Folha A4 de trás — mais discreta, só linhas estáticas. */
function BackSheet({
  className,
  floatDelay,
  floatDur,
  lines,
}: {
  className?: string
  floatDelay: number
  floatDur: number
  lines: number
}) {
  return (
    <div
      className={cn("hero-float absolute", className)}
      style={
        {
          "--float-delay": `${floatDelay}s`,
          "--float-dur": `${floatDur}s`,
        } as React.CSSProperties
      }
    >
      <div className="bg-card/40 flex aspect-[210/297] flex-col gap-1.5 rounded-2xl p-3 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-sm">
        <span className="mb-1 block h-1.5 w-2/5 rounded-full bg-white/20" />
        {BACK_LINES.slice(0, lines).map((widthClass, index) => (
          <span
            key={index}
            className={cn("block h-1 rounded-full bg-white/12", widthClass)}
          />
        ))}
        <span className="mt-auto block h-6 rounded-lg bg-white/5" />
      </div>
    </div>
  )
}

/** Chip glass flutuante (vocabulário compartilhado das vizzes). */
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
 * Fantasma do relatório: as folhas empilhadas, a folha da frente sendo
 * escrita (cabeçalho, linhas, mini-barras e donut) e o selo de aprovado.
 */
export function CompetitionReportsHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="66%">
      <div className="absolute top-1/2 right-[13%] -translate-y-1/2 lg:right-[17%] xl:right-[20%]">
        {/* folhas de trás */}
        <GBone
          faint
          className="absolute inset-y-2 -left-6 w-[clamp(96px,10vw,124px)] rounded-2xl"
          style={{ transform: "rotate(-7deg)" }}
        />
        <GBone
          faint
          delay={120}
          className="absolute inset-y-3 -right-6 hidden w-[clamp(88px,9vw,112px)] rounded-2xl lg:block"
          style={{ transform: "rotate(6deg)" }}
        />

        {/* folha da frente */}
        <GPanel
          floatDur={8}
          className="relative flex w-[clamp(148px,15vw,190px)] flex-col gap-2.5 p-3"
        >
          <span className="flex items-center gap-2">
            <GBone className="size-5 shrink-0 rounded-md" />
            <GBone delay={70} className="h-2.5 w-20 rounded-full" />
          </span>
          <GLines widths={["100%", "82%", "64%"]} delay={140} />
          {/* mini gráfico */}
          <span className="flex h-10 items-end gap-1">
            {[40, 72, 30, 86, 54].map((height, index) => (
              <span
                key={index}
                className="hero-bar skeleton-bone skeleton-bone-strong block flex-1 rounded-t-sm"
                style={
                  {
                    height: `${height}%`,
                    "--bar-delay": `${index * 0.14}s`,
                    "--bar-dur": "2.7s",
                    "--shimmer-delay": `${300 + index * 80}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
          {/* donut + resumo */}
          <span className="flex items-center gap-2">
            <GBone delay={420} className="size-8 shrink-0 rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <GBone delay={480} className="h-2 w-[80%] rounded-full" />
              <GBone delay={540} className="h-2 w-[55%] rounded-full" />
            </span>
          </span>
        </GPanel>

        {/* selo de aprovado */}
        <div className="hero-float absolute -right-3.5 -bottom-3.5">
          <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-white/8" />
          <GBone delay={200} className="size-9 rounded-full lg:size-10" />
        </div>
      </div>

      {/* chips */}
      <GChip className="absolute top-[10%] right-[8%]" floatDelay={0.8} floatDur={7.4} />
      <GChip
        className="absolute bottom-[12%] right-[42%] hidden lg:flex"
        floatDelay={2.5}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
