import {
  CheckCircle,
  Medal,
  Sparkle,
  TrendUp,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero da Academia (Métricas) — curva de
 * aprendizado: aurora violeta + esmeralda, card de checklist glass
 * flutuante com tarefas sendo concluídas em sequência (checks acendendo
 * um a um e barras de texto se preenchendo dessincronizadas), medalhinha
 * âmbar no topo com anel pulsante, anel de progresso girando lento com
 * porcentagem no centro, chips glass, sparkles, partículas e um cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const VIOLET = "#8b5cf6"
const VIOLET_SOFT = "#a78bfa"
const EMERALD = "#34d399"
const AMBER = "#f59e0b"

const SPARKLES = [
  { left: "20%", top: "12%", size: 11, delay: 0, dur: 3.6, tone: "emerald", lgOnly: false },
  { left: "48%", top: "7%", size: 9, delay: 1.4, dur: 4.4, tone: "violet", lgOnly: true },
  { left: "72%", top: "16%", size: 13, delay: 2.2, dur: 3.4, tone: "emerald", lgOnly: false },
  { left: "88%", top: "10%", size: 9, delay: 0.7, dur: 4.8, tone: "violet", lgOnly: false },
  { left: "34%", top: "26%", size: 8, delay: 3, dur: 3.8, tone: "violet", lgOnly: true },
] as const

const PARTICLES = [
  { left: "20%", bottom: "28%", size: 3, delay: 0.4, dur: 5.6, x: 12, opacity: 0.8 },
  { left: "38%", bottom: "22%", size: 2, delay: 2, dur: 6.6, x: -12, opacity: 0.6 },
  { left: "56%", bottom: "30%", size: 3, delay: 1.2, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "74%", bottom: "24%", size: 2, delay: 3.4, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "88%", bottom: "32%", size: 3, delay: 2.6, dur: 5.8, x: 8, opacity: 0.75 },
] as const

/**
 * Itens do checklist: os checks acendem em sequência (0.5s → 3.5s,
 * efeito de lista sendo concluída) e as barras de texto fantasma se
 * preenchem dessincronizadas com o hero-clip-progress.
 */
const TASKS = [
  { checkDelay: 0.5, clipDur: 5.2, clipDelay: 0.3, width: "w-full" },
  { checkDelay: 1.5, clipDur: 6.4, clipDelay: 1.2, width: "w-4/5" },
  { checkDelay: 2.5, clipDur: 5.8, clipDelay: 2.1, width: "w-11/12" },
  { checkDelay: 3.5, clipDur: 7, clipDelay: 2.9, width: "w-3/4" },
] as const

export function LearningCurveHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora violeta + esmeralda em deriva */}
        <span
          className="arena-aurora absolute -top-14 right-[10%] size-60 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${VIOLET} 30%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[42%] bottom-[4%] size-72 rounded-full blur-2xl"
          style={{
            animationDelay: "-6s",
            background: `radial-gradient(circle, color-mix(in oklab, ${EMERALD} 22%, transparent), transparent 66%)`,
          }}
        />

        {/* cometa cruzando o topo */}
        <span
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,#a78bfa_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2.4s",
              "--comet-x": "-320px",
              "--comet-y": "215px",
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
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                color: sparkle.tone === "emerald" ? EMERALD : VIOLET_SOFT,
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
            className="arena-particle absolute rounded-full"
            style={
              {
                left: particle.left,
                bottom: particle.bottom,
                width: particle.size,
                height: particle.size,
                backgroundColor: index % 2 === 0 ? EMERALD : VIOLET_SOFT,
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== card de checklist central — lista sendo concluída ===== */}
        <div
          className="arena-tilt absolute top-[14%] right-[28%] xl:right-[32%]"
          style={{ "--float-dur": "7.6s" } as React.CSSProperties}
        >
          <div className="bg-card/70 supports-[backdrop-filter]:bg-card/55 relative flex w-[clamp(150px,15vw,188px)] flex-col gap-2.5 rounded-2xl p-3.5 shadow-[0_22px_54px_-18px_rgba(139,92,246,0.45)] ring-1 ring-[color-mix(in_oklab,#8b5cf6_38%,transparent)] backdrop-blur-md">
            {/* hairline violeta→esmeralda no topo */}
            <span
              className="absolute inset-x-[14%] top-0 h-px"
              style={{
                background: `linear-gradient(to right, ${VIOLET}, ${EMERALD})`,
              }}
            />

            {/* medalhinha âmbar no topo com anel pulsante */}
            <div className="flex items-center gap-2">
              <span className="relative flex size-6 shrink-0 items-center justify-center">
                <span
                  className="hero-pulse-ring absolute -inset-1 rounded-full"
                  style={{
                    backgroundColor: `color-mix(in oklab, ${AMBER} 40%, transparent)`,
                  }}
                />
                <Medal
                  className="relative size-5"
                  weight="fill"
                  style={{ color: AMBER }}
                />
              </span>
              <span className="block h-1.5 w-16 rounded-full bg-white/25" />
            </div>

            {/* itens de tarefa: check acende + barra se preenche */}
            <div className="flex flex-col gap-2.5">
              {TASKS.map((task, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="relative flex size-3.5 shrink-0 items-center justify-center rounded-[5px] bg-white/5 ring-1 ring-white/20">
                    <CheckCircle
                      weight="fill"
                      className="arena-twinkle absolute size-4.5"
                      style={
                        {
                          color: EMERALD,
                          "--twinkle-delay": `${task.checkDelay}s`,
                          "--twinkle-dur": "4.6s",
                          "--twinkle-opacity": 1,
                        } as React.CSSProperties
                      }
                    />
                  </span>
                  <span
                    className={cn(
                      "block h-1.5 overflow-hidden rounded-full bg-white/10",
                      task.width,
                    )}
                  >
                    <span
                      className="hero-clip-progress block h-full rounded-full opacity-75"
                      style={
                        {
                          background: `linear-gradient(to right, ${VIOLET}, ${EMERALD})`,
                          "--clip-dur": `${task.clipDur}s`,
                          "--clip-delay": `${task.clipDelay}s`,
                        } as React.CSSProperties
                      }
                    />
                  </span>
                </div>
              ))}
            </div>

            {/* rodapé fantasma */}
            <span className="block h-1 w-3/5 rounded-full bg-white/10" />
          </div>
        </div>

        {/* ===== anel de progresso girando lento ===== */}
        <div
          className="hero-float absolute top-[46%] right-[7%] lg:top-[42%] xl:right-[11%]"
          style={
            {
              "--float-delay": "0.8s",
              "--float-dur": "7.2s",
            } as React.CSSProperties
          }
        >
          <div className="relative flex size-20 items-center justify-center lg:size-24">
            {/* trilho do anel */}
            <span className="absolute inset-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))] bg-white/10" />
            {/* arco conic esmeralda→ciano girando (16s) */}
            <span
              className="arena-ring absolute inset-0 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))]"
              style={{
                animationDuration: "16s",
                background: `conic-gradient(from 0deg, transparent 8%, ${EMERALD} 34%, var(--brand-cyan) 62%, transparent 88%)`,
              }}
            />
            <span className="absolute inset-2.5 rounded-full bg-white/[0.04] ring-1 ring-white/10 backdrop-blur-sm" />
            <span className="text-foreground relative text-base font-bold tabular-nums lg:text-lg">
              78%
            </span>
          </div>
        </div>

        {/* chips glass flutuantes */}
        <FloatChip
          icon={<UsersThree className="size-3 text-[#04222A]" weight="fill" />}
          label="Alunos ativos"
          value="Turma crescendo"
          className="right-[24%] bottom-[9%] xl:right-[30%]"
          delay={1.4}
          duration={7.8}
        />
        <FloatChip
          icon={<TrendUp className="size-3 text-[#04222A]" weight="fill" />}
          label="Taxa de conclusão"
          value="Em alta"
          className="top-[10%] right-[5%] hidden lg:flex"
          delay={2.4}
          duration={8.4}
        />
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
        "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#8b5cf6_26%,transparent)] backdrop-blur-md",
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
 * Fantasma da curva de aprendizado: o card de checklist sendo concluído
 * e o anel de progresso girando, nas mesmas âncoras.
 */
export function LearningCurveHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="64%">
      {/* card de checklist */}
      <div
        className="hero-float absolute top-[14%] right-[28%] xl:right-[32%]"
        style={{ "--float-dur": "7.4s" } as React.CSSProperties}
      >
        <GPanel float={false} className="flex w-[clamp(150px,15vw,188px)] flex-col gap-2.5 p-3">
          <span className="flex items-center gap-2">
            <GBone className="size-6 shrink-0 rounded-full" />
            <GBone delay={70} className="h-2.5 w-16 rounded-full" />
          </span>
          {[0, 1, 2].map((task) => (
            <span key={task} className="flex items-center gap-2">
              <GBone delay={140 + task * 90} className="size-3.5 shrink-0 rounded-full" />
              <GBone
                delay={180 + task * 90}
                className="h-2 flex-1 rounded-full"
                style={{ width: `${80 - task * 12}%` }}
              />
            </span>
          ))}
          <GBone delay={460} className="h-2 w-2/3 rounded-full" />
        </GPanel>
      </div>

      {/* anel de progresso */}
      <div className="hero-float absolute top-[46%] right-[7%] lg:top-[42%] xl:right-[11%]">
        <span className="relative flex size-20 items-center justify-center lg:size-24">
          <span className="absolute inset-0 rounded-full bg-white/10 [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))]" />
          <span className="arena-ring absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent_20%,rgba(255,255,255,0.28)_58%,transparent_82%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))]" />
          <GBone className="absolute inset-2.5 rounded-full" />
        </span>
      </div>

      {/* chips */}
      <GChip className="absolute top-[8%] right-[6%]" floatDelay={1} floatDur={7.6} />
      <GChip
        className="absolute bottom-[10%] right-[34%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
