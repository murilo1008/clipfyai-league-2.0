import {
  CheckCircle,
  Flame,
  GraduationCap,
  Play,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero da Academia do CLIPADOR — "MARATONA DE
 * AULAS": o binge de aprendizado. Uma fila de cards de aula onde o card
 * central está tocando (play pulsando, barra de progresso enchendo,
 * countdown de próxima aula), flanqueado por cards vizinhos já
 * concluídos (check verde "Concluída") rotacionados atrás, chip de
 * streak com Flame "3 aulas hoje" ancorado no canto e badge de
 * GraduationCap com anel orbital no topo. Composição horizontal/baixa,
 * ancorada num container central com clamp() — responsiva por
 * construção. Ambiente: aurora cyan+mint, grid, sweep, twinkles e um
 * cometa. CSS puro, aria-hidden.
 */

const AMBER = "#f5b73b"

const SPARKLES = [
  { left: "20%", top: "12%", size: 11, delay: 0.2, dur: 3.8, mint: false, lgOnly: false },
  { left: "46%", top: "6%", size: 9, delay: 1.4, dur: 4.4, mint: true, lgOnly: true },
  { left: "88%", top: "15%", size: 12, delay: 2.2, dur: 3.4, mint: false, lgOnly: false },
  { left: "30%", top: "80%", size: 9, delay: 0.8, dur: 4.6, mint: true, lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3.1, dur: 3.6, mint: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "24%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 12, opacity: 0.8, mint: true },
  { left: "44%", bottom: "10%", size: 2, delay: 2.1, dur: 6.8, x: -10, opacity: 0.6, mint: false },
  { left: "66%", bottom: "14%", size: 3, delay: 1.2, dur: 5.4, x: 8, opacity: 0.85, mint: true },
  { left: "88%", bottom: "10%", size: 2, delay: 3.3, dur: 6.4, x: -12, opacity: 0.6, mint: false },
] as const

/** Card fantasma de aula concluída (vizinhos da fila). */
function CompletedGhostCard({
  className,
  style,
  floatDur,
  floatDelay,
}: {
  className?: string
  style?: React.CSSProperties
  floatDur: string
  floatDelay?: string
}) {
  return (
    <div
      className={cn("arena-tilt absolute", className)}
      style={
        {
          ...style,
          "--float-dur": floatDur,
          "--float-delay": floatDelay ?? "0s",
        } as React.CSSProperties
      }
    >
      <div className="flex w-full flex-col gap-2 rounded-2xl bg-white/[0.05] p-2.5 ring-1 ring-white/10 backdrop-blur-sm">
        {/* mini capa assistida */}
        <div className="relative aspect-video overflow-hidden rounded-lg bg-[color-mix(in_oklab,var(--brand-cyan)_10%,#0a1c2b)]">
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[color-mix(in_oklab,var(--brand-mint)_70%,transparent)]" />
        </div>
        {/* título fantasma + selo concluída */}
        <div className="flex items-center justify-between gap-2">
          <span className="block h-1.5 w-3/5 rounded-full bg-white/12" />
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_18%,transparent)] px-1.5 py-0.5 text-[7px] font-bold tracking-[0.1em] text-emerald-300 uppercase">
            <CheckCircle className="size-2.5" weight="fill" />
            Concluída
          </span>
        </div>
      </div>
    </div>
  )
}

export function ClassesMarathonHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora cyan + mint em deriva */}
        <span className="arena-aurora absolute -top-16 right-[8%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_66%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[24%] w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10.5s",
              "--comet-delay": "2.2s",
              "--comet-x": "-300px",
              "--comet-y": "200px",
              "--comet-angle": "-34deg",
            } as React.CSSProperties
          }
        />

        {/* sparkles ambiente */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                color: sparkle.mint ? "var(--brand-mint)" : "var(--brand-cyan)",
                "--twinkle-delay": `${sparkle.delay}s`,
                "--twinkle-dur": `${sparkle.dur}s`,
                "--twinkle-opacity": 0.9,
              } as React.CSSProperties
            }
          />
        ))}

        {/* partículas subindo */}
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
                backgroundColor: particle.mint
                  ? "var(--brand-mint)"
                  : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== ÂNCORA — a fila da maratona ===== */}
        <div className="absolute top-1/2 right-[8%] w-[clamp(260px,30vw,370px)] -translate-y-1/2">
          {/* vizinho concluído (esquerda, atrás) */}
          <CompletedGhostCard
            className="top-1/2 left-0 w-[54%] -translate-x-[34%] -translate-y-1/2 opacity-75"
            style={{ rotate: "-8deg" }}
            floatDur="9.5s"
            floatDelay="1.2s"
          />
          {/* vizinho concluído (direita, atrás) — só lg+ */}
          <CompletedGhostCard
            className="top-1/2 right-0 hidden w-[54%] translate-x-[34%] -translate-y-1/2 opacity-75 lg:block"
            style={{ rotate: "7deg" }}
            floatDur="8.6s"
            floatDelay="2.4s"
          />

          {/* ===== card central — aula tocando ===== */}
          <div
            className="arena-tilt relative mx-auto w-[72%]"
            style={{ "--float-dur": "8.5s" } as React.CSSProperties}
          >
            <div className="relative flex flex-col gap-2.5 rounded-2xl bg-[#0a1c2b]/85 p-3 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] backdrop-blur-md lg:p-3.5">
              {/* hairline da marca */}
              <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] to-transparent" />

              {/* status: em reprodução */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-[var(--brand-cyan)] uppercase">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-cyan)] opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-[var(--brand-cyan)]" />
                  </span>
                  Aula 07
                </span>
                <span className="text-[8px] font-semibold tracking-[0.1em] text-white/45 uppercase">
                  12:36
                </span>
              </div>

              {/* capa 16:9 tocando */}
              <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/10">
                <span className="absolute inset-0 bg-[linear-gradient(125deg,color-mix(in_oklab,var(--brand-cyan)_26%,#0a1c2b),#0d2436_52%,color-mix(in_oklab,var(--brand-mint)_20%,#0a1c2b))]" />
                {/* holofote da capa */}
                <span className="absolute -top-4 right-4 size-12 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_40%,transparent)] blur-xl" />
                {/* silhuetas abstratas */}
                <span className="absolute -bottom-2 -left-2 h-9 w-[58%] rounded-tr-[100%] bg-black/30" />
                <span className="absolute -right-2 -bottom-3 h-7 w-[52%] rounded-tl-[100%] bg-black/20" />
                {/* brilho varrendo */}
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  style={{ "--shine-delay": "1.4s" } as React.CSSProperties}
                />
                {/* play pulsando */}
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_40%,transparent)]" />
                  <span className="bg-gradient-custom relative flex size-9 items-center justify-center rounded-full text-[#04222A] shadow-[0_10px_30px_-6px_rgba(20,247,254,0.5)] lg:size-10">
                    <Play className="size-4 lg:size-4.5" weight="fill" />
                  </span>
                </span>
              </div>

              {/* título fantasma */}
              <div className="flex flex-col gap-1.5">
                <span className="block h-2 w-full rounded-full bg-white/12" />
                <span className="block h-2 w-[58%] rounded-full bg-white/8" />
              </div>

              {/* progresso da aula enchendo */}
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className="hero-clip-progress bg-gradient-custom block h-full rounded-full"
                  style={
                    {
                      "--clip-dur": "5.5s",
                      "--clip-delay": "0.4s",
                    } as React.CSSProperties
                  }
                />
              </span>

              {/* rodapé: % do módulo + autoplay da próxima */}
              <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2">
                <span className="text-[9px] font-bold tracking-[0.08em] text-[var(--brand-mint)] uppercase">
                  68% do módulo
                </span>
                <span
                  className="hero-podium-glow inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-semibold tracking-[0.1em] text-white/70 uppercase ring-1 ring-white/10"
                  style={{ "--podium-dur": "2.6s" } as React.CSSProperties}
                >
                  <Play className="size-2 text-[var(--brand-cyan)]" weight="fill" />
                  Próxima em 5s
                </span>
              </div>
            </div>

            {/* badge de academia com anel orbital — canto superior */}
            <div className="absolute -top-5 -right-4 lg:-top-6 lg:-right-5">
              <span className="hero-pulse-ring absolute -inset-3.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_36%,transparent)]" />
              <span className="arena-ring absolute -inset-1.5 rounded-full bg-[conic-gradient(from_0deg,transparent_12%,color-mix(in_oklab,var(--brand-cyan)_75%,transparent)_30%,transparent_48%,color-mix(in_oklab,var(--brand-mint)_60%,transparent)_72%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
              <span className="bg-gradient-custom relative flex size-10 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-11">
                <GraduationCap className="size-5 lg:size-5.5" weight="fill" />
              </span>
            </div>
          </div>

          {/* chip de streak — canto inferior esquerdo */}
          <div
            className="hero-float absolute -bottom-9 left-[4%] flex items-center gap-2 rounded-xl bg-[#0a1c2b]/80 px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#f97316_36%,transparent)] backdrop-blur-md lg:-bottom-10"
            style={
              { "--float-delay": "0.8s", "--float-dur": "7.4s" } as React.CSSProperties
            }
          >
            <span className="relative flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/40">
              <Flame className="size-3.5" weight="fill" />
              <span
                className="absolute -top-1 -right-1 size-2 animate-ping rounded-full opacity-70"
                style={{ backgroundColor: AMBER }}
              />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] font-bold text-white/95">
                3 aulas hoje
              </span>
              <span className="text-[8px] font-semibold tracking-[0.14em] text-white/45 uppercase">
                Sequência
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da maratona de aulas: os vizinhos concluídos atrás, o card da
 * aula tocando (capa, play, título e progresso) e o badge da academia.
 */
export function ClassesMarathonHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="66%">
      <div className="absolute top-1/2 right-[8%] w-[clamp(260px,30vw,370px)] -translate-y-1/2">
        {/* vizinhos concluídos atrás */}
        <GBone
          faint
          className="absolute inset-0 rounded-2xl"
          style={{ transform: "rotate(-4deg) translate(-12px, 10px)" }}
        />
        <GBone
          faint
          delay={120}
          className="absolute inset-0 hidden rounded-2xl lg:block"
          style={{ transform: "rotate(-8deg) translate(-24px, 20px)" }}
        />

        {/* card central — aula tocando */}
        <GPanel floatDur={8.5} className="relative flex flex-col gap-2.5 p-3">
          <span className="flex items-center gap-1.5">
            <GBone className="size-1.5 shrink-0 rounded-full" />
            <GBone delay={60} className="h-2 w-16 rounded-full" />
          </span>

          {/* capa 16:9 com play */}
          <span className="relative block aspect-video w-full">
            <GBone delay={120} className="size-full rounded-xl" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="hero-pulse-ring absolute size-9 rounded-full bg-white/10" />
              <GBone className="size-9 rounded-full lg:size-10" />
            </span>
          </span>

          <GLines widths={["88%", "56%"]} delay={260} heightClass="h-2.5" />

          {/* progresso da aula */}
          <span className="block h-1 overflow-hidden rounded-full bg-white/12">
            <span
              className="hero-clip-progress block h-full rounded-full bg-white/35"
              style={{ "--clip-dur": "5.4s" } as React.CSSProperties}
            />
          </span>

          <span className="flex items-center justify-between">
            <GBone delay={420} className="h-2 w-14 rounded-full" />
            <GBone delay={480} className="h-2 w-10 rounded-full" />
          </span>
        </GPanel>

        {/* badge da academia */}
        <div className="absolute -top-5 -right-4 lg:-top-6 lg:-right-5">
          <span className="arena-ring absolute -inset-1.5 rounded-full border border-dashed border-white/15" />
          <GBone delay={180} className="size-10 rounded-2xl lg:size-11" />
        </div>
      </div>

      {/* chips */}
      <GChip className="absolute top-[10%] right-[42%]" floatDelay={0.6} floatDur={7.4} />
      <GChip
        className="absolute bottom-[12%] right-[46%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
