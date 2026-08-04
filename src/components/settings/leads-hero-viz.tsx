import {
  ChatCircle,
  Clock,
  Sparkle,
  User,
  UserPlus,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Leads — "ESTEIRA DE CONVERSÃO":
 * um trilho horizontal com fluxo tracejado correndo da esquerda para a
 * direita e 3 estações glass em cima (Pendente âmbar → Contatado azul →
 * Convertido roxo) acendendo em sequência; atrás do trilho, uma fileira
 * de mini-cards de lead passando em loop; à frente, um card de lead em
 * destaque sob a estação do meio com avatar gradiente, badge "Contatado"
 * e botão WhatsApp pulsando. Aurora âmbar+roxa, sparkles, partículas e
 * cometa ao redor. Tudo ancorado num container central com clamp() —
 * responsivo por construção.
 */

/** Âncoras cromáticas da esteira — os status de lead. */
const AMBER = "#f59e0b"
const BLUE = "#3b82f6"
const PURPLE = "#a855f7"
const GREEN = "#22c55e"

/** As 3 estações da esteira, acendendo em sequência coordenada. */
const STATIONS = [
  { label: "Pendente", icon: Clock, color: AMBER, delay: 0.5 },
  { label: "Contatado", icon: ChatCircle, color: BLUE, delay: 1.5 },
  { label: "Convertido", icon: Sparkle, color: PURPLE, delay: 2.5 },
] as const

/** Mini-cards de lead passando atrás do trilho (tints alternando). */
const MINI_CARDS = ["amber", "blue", "purple", "amber", "blue", "purple"] as const

const MINI_TINTS: Record<
  (typeof MINI_CARDS)[number],
  { card: string; avatar: string }
> = {
  amber: { card: "bg-amber-500/10 ring-amber-500/25", avatar: "bg-amber-500/35" },
  blue: { card: "bg-blue-500/10 ring-blue-500/25", avatar: "bg-blue-500/35" },
  purple: { card: "bg-purple-500/10 ring-purple-500/25", avatar: "bg-purple-500/35" },
}

const SPARKLES = [
  { left: "20%", top: "11%", size: 11, delay: 0.2, dur: 3.8, color: AMBER, lgOnly: false },
  { left: "46%", top: "6%", size: 9, delay: 1.4, dur: 4.4, color: "var(--brand-cyan)", lgOnly: true },
  { left: "88%", top: "13%", size: 12, delay: 2.2, dur: 3.4, color: PURPLE, lgOnly: false },
  { left: "28%", top: "76%", size: 9, delay: 0.8, dur: 4.6, color: "var(--brand-cyan)", lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3, dur: 3.6, color: PURPLE, lgOnly: false },
] as const

const PARTICLES = [
  { left: "22%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 12, opacity: 0.8, color: AMBER },
  { left: "40%", bottom: "12%", size: 2, delay: 2.1, dur: 6.6, x: -10, opacity: 0.6, color: BLUE },
  { left: "62%", bottom: "18%", size: 3, delay: 1.2, dur: 5.4, x: 8, opacity: 0.85, color: PURPLE },
  { left: "82%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -12, opacity: 0.6, color: BLUE },
  { left: "94%", bottom: "22%", size: 3, delay: 2.6, dur: 6, x: 10, opacity: 0.75, color: AMBER },
] as const

export function LeadsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora âmbar + roxa */}
        <span
          className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${AMBER} 26%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${PURPLE} 22%, transparent), transparent 66%)`,
            animationDelay: "-6.5s",
          }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[26%] w-24 overflow-visible">
          <span
            className="hero-sweep block h-full w-full"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${BLUE} 13%, transparent), transparent)`,
            }}
          />
        </div>

        {/* cometa roxo */}
        <span
          className="arena-comet absolute top-[5%] right-[10%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${PURPLE} 70%, transparent), transparent)`,
              "--comet-dur": "10.5s",
              "--comet-delay": "2.4s",
              "--comet-x": "-310px",
              "--comet-y": "210px",
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
                color: sparkle.color,
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
                backgroundColor: particle.color,
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== A ESTEIRA — container central ancorado ===== */}
        <div className="absolute top-1/2 right-[9%] w-[clamp(230px,26vw,320px)] -translate-y-1/2 lg:right-[12%]">
          {/* fileira de mini-cards de lead passando ATRÁS do trilho */}
          <div className="absolute inset-x-[-16%] -top-3 opacity-60 [mask-image:linear-gradient(to_right,transparent,#000_18%,#000_82%,transparent)] overflow-hidden">
            <div
              className="hero-filmstrip flex w-max gap-2"
              style={{ "--strip-dur": "24s" } as React.CSSProperties}
            >
              {[...MINI_CARDS, ...MINI_CARDS].map((tint, index) => (
                <span
                  key={index}
                  className={cn(
                    "flex h-11 w-24 shrink-0 items-center gap-1.5 rounded-xl px-2 ring-1 backdrop-blur-sm",
                    MINI_TINTS[tint].card,
                  )}
                >
                  {/* avatar fantasma */}
                  <span
                    className={cn(
                      "size-5 shrink-0 rounded-full",
                      MINI_TINTS[tint].avatar,
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="block h-1.5 w-full rounded-full bg-white/20" />
                    <span className="block h-1 w-2/3 rounded-full bg-white/10" />
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* trilho + estações */}
          <div className="relative z-10">
            {/* linha do trilho com gradiente dos status */}
            <div className="absolute inset-x-1 top-[18px] lg:top-[20px]">
              <span
                className="block h-px"
                style={{
                  background: `linear-gradient(to right, transparent, color-mix(in oklab, ${AMBER} 55%, transparent) 18%, color-mix(in oklab, ${BLUE} 55%, transparent) 50%, color-mix(in oklab, ${PURPLE} 60%, transparent) 82%, transparent)`,
                }}
              />
              {/* fluxo tracejado correndo da esquerda para a direita */}
              <svg
                className="absolute inset-x-0 -top-[3px] h-1.5 w-full overflow-visible"
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d="M 0 3 H 100"
                  className="hero-trace"
                  stroke="color-mix(in oklab, var(--brand-cyan) 55%, transparent)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* estações acendendo em sequência */}
            <div className="relative flex items-start justify-between px-1">
              {STATIONS.map((station) => {
                const StationIcon = station.icon
                return (
                  <div
                    key={station.label}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="relative">
                      {/* halo acendendo */}
                      <span
                        className="arena-twinkle absolute -inset-2.5 rounded-full blur-md"
                        style={
                          {
                            backgroundColor: `color-mix(in oklab, ${station.color} 45%, transparent)`,
                            "--twinkle-delay": `${station.delay}s`,
                            "--twinkle-dur": "3s",
                            "--twinkle-opacity": 0.95,
                          } as React.CSSProperties
                        }
                      />
                      <span
                        className="relative flex size-9 items-center justify-center rounded-full bg-[#0a1c2b]/85 backdrop-blur-md lg:size-10"
                        style={{
                          boxShadow: `0 0 0 1px color-mix(in oklab, ${station.color} 40%, transparent), 0 12px 34px -14px rgba(0,0,0,0.85)`,
                        }}
                      >
                        <StationIcon
                          className="size-4 lg:size-4.5"
                          weight="fill"
                          style={{ color: station.color }}
                        />
                      </span>
                    </div>
                    <span
                      className="hero-podium-glow text-[8px] font-bold tracking-[0.16em] uppercase"
                      style={
                        {
                          color: `color-mix(in oklab, ${station.color} 75%, white)`,
                          "--podium-dur": "3s",
                          "--podium-delay": `${station.delay}s`,
                        } as React.CSSProperties
                      }
                    >
                      {station.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* card de lead em destaque — ancorado sob a estação do meio */}
          <div className="relative z-20 mx-auto mt-4 w-[78%] lg:mt-5">
            <div
              className="arena-tilt relative"
              style={{ "--float-dur": "8.5s" } as React.CSSProperties}
            >
              <div className="relative flex flex-col gap-2.5 rounded-2xl bg-[#0a1c2b]/90 p-3 ring-1 ring-blue-500/30 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)] backdrop-blur-md lg:p-3.5">
                {/* hairline da esteira no topo */}
                <span
                  className="pointer-events-none absolute inset-x-4 top-0 h-px"
                  style={{
                    background: `linear-gradient(to right, transparent, color-mix(in oklab, ${AMBER} 55%, transparent), color-mix(in oklab, ${BLUE} 55%, transparent), color-mix(in oklab, ${PURPLE} 55%, transparent), transparent)`,
                  }}
                />

                {/* avatar gradiente + nome/email fantasma */}
                <div className="flex items-center gap-2.5">
                  <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-full text-[#04222A]">
                    <User className="size-4.5" weight="fill" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="block h-2 w-24 rounded-full bg-white/25" />
                    <span className="block h-1.5 w-32 max-w-full rounded-full bg-white/10" />
                  </span>
                </div>

                {/* status + WhatsApp */}
                <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-blue-300 uppercase ring-1 ring-blue-500/30">
                    <span className="size-1.5 animate-pulse rounded-full bg-blue-400" />
                    Contatado
                  </span>
                  <span className="relative">
                    <span
                      className="hero-pulse-ring absolute -inset-2 rounded-full"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${GREEN} 38%, transparent)`,
                      }}
                    />
                    <span className="relative flex size-7 items-center justify-center rounded-lg bg-emerald-500 text-[#052e16] shadow-[0_10px_30px_-8px_rgba(34,197,94,0.6)]">
                      <ChatCircle className="size-4" weight="fill" />
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== chips glass ===== */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[9%] right-[36%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:right-[42%]"
          style={
            { "--float-delay": "0.6s", "--float-dur": "7.6s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <UserPlus className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Novo lead
          </span>
          <span className="text-foreground text-xs font-bold">
            Entrou na esteira
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[11%] left-[15%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-purple-500/30 backdrop-blur-md lg:flex"
          style={
            { "--float-delay": "2.2s", "--float-dur": "8.4s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-purple-500/25">
              <Sparkle
                className="size-3"
                weight="fill"
                style={{ color: PURPLE }}
              />
            </span>
            Convertido
          </span>
          <span className="text-foreground text-xs font-bold">
            Cliente fechado
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da esteira de leads: a fileira passando atrás, o trilho com
 * as estações acendendo e o card do lead em destaque embaixo.
 */
export function LeadsHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[9%] w-[clamp(230px,26vw,320px)] -translate-y-1/2 lg:right-[12%]">
        {/* fileira de mini-cards passando atrás */}
        <div className="absolute inset-x-[-16%] -top-3 overflow-hidden opacity-60 [mask-image:linear-gradient(to_right,transparent,#000_18%,#000_82%,transparent)]">
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map((mini) => (
              <span
                key={mini}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.04] px-1.5 py-1"
              >
                <GBone delay={mini * 80} className="size-5 shrink-0 rounded-full" />
                <GBone delay={mini * 80 + 40} className="h-1.5 w-8 rounded-full" />
              </span>
            ))}
          </div>
        </div>

        {/* trilho + estações */}
        <div className="relative mt-6 flex items-center justify-between">
          <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/10 via-white/25 to-white/10" />
          {[0, 1, 2, 3].map((station) => (
            <GBone
              key={station}
              delay={station * 130}
              faint={station > 2}
              className="relative size-9 rounded-full lg:size-10"
            />
          ))}
        </div>

        {/* card do lead em destaque */}
        <GPanel floatDur={8.2} className="mt-4 flex flex-col gap-2 p-3">
          <span className="flex items-center gap-2">
            <GBone delay={160} className="size-9 shrink-0 rounded-full" />
            <GLines widths={["100%", "58%"]} delay={220} className="min-w-0 flex-1" />
            <GBone delay={320} className="size-7 shrink-0 rounded-lg" />
          </span>
          <span className="flex items-center gap-1.5">
            <GBone delay={380} className="size-1.5 shrink-0 rounded-full" />
            <GBone delay={420} className="h-2 w-16 rounded-full" />
          </span>
        </GPanel>
      </div>
    </VizGhost>
  )
}
