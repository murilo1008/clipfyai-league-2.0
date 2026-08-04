import {
  CheckCircle,
  Coins,
  Handshake,
  SealCheck,
  Sparkle,
  Trophy,
  User,
  UserCheck,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Clientes — "PARCERIA FECHADA":
 * dois cartões de visita glass (um com tint emerald, outro com o tint
 * da marca) vindo de lados opostos e se encontrando ao centro, onde o
 * badge de aperto de mãos pulsa com anel cônico e satélites orbitando;
 * o cartão da direita tem a linha de assinatura se preenchendo com o
 * carimbo SealCheck, o selo "Contrato ativo" confirma o acordo e o
 * mini-troféu de campanhas fica pendurado no cartão do cliente.
 * Aurora emerald+cyan, sparkles, partículas e cometa. Tudo ancorado
 * num container central com clamp() — responsivo por construção.
 */

/** Verde-esmeralda do contrato — âncora cromática desta viz. */
const EMERALD = "#10b981"

const SPARKLES = [
  { left: "18%", top: "12%", size: 11, delay: 0.2, dur: 3.8, emerald: true, lgOnly: false },
  { left: "46%", top: "6%", size: 9, delay: 1.5, dur: 4.4, emerald: false, lgOnly: true },
  { left: "88%", top: "14%", size: 12, delay: 2.3, dur: 3.4, emerald: false, lgOnly: false },
  { left: "28%", top: "78%", size: 9, delay: 0.9, dur: 4.6, emerald: false, lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3, dur: 3.6, emerald: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "22%", bottom: "18%", size: 3, delay: 0.5, dur: 5.8, x: 12, opacity: 0.8, emerald: true },
  { left: "40%", bottom: "12%", size: 2, delay: 2.1, dur: 6.8, x: -10, opacity: 0.6, emerald: false },
  { left: "62%", bottom: "16%", size: 3, delay: 1.3, dur: 5.4, x: 8, opacity: 0.85, emerald: true },
  { left: "82%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -12, opacity: 0.6, emerald: false },
  { left: "94%", bottom: "22%", size: 3, delay: 2.6, dur: 6, x: 10, opacity: 0.7, emerald: true },
] as const

export function ClientsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora emerald + halo ciano */}
        <span
          className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${EMERALD} 28%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[42%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[26%] w-24 overflow-visible">
          <span
            className="hero-sweep block h-full w-full"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${EMERALD} 13%, transparent), transparent)`,
            }}
          />
        </div>

        {/* cometa emerald */}
        <span
          className="arena-comet absolute top-[5%] right-[10%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${EMERALD} 70%, transparent), transparent)`,
              "--comet-dur": "11s",
              "--comet-delay": "2.2s",
              "--comet-x": "-300px",
              "--comet-y": "210px",
              "--comet-angle": "-36deg",
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
                color: sparkle.emerald ? EMERALD : "var(--brand-cyan)",
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
                backgroundColor: particle.emerald
                  ? EMERALD
                  : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== A PARCERIA — composição central ancorada ===== */}
        <div className="absolute top-1/2 right-[8%] h-[clamp(180px,20vw,240px)] w-[clamp(250px,28vw,340px)] -translate-y-1/2 lg:right-[11%]">
          {/* cartão de visita do cliente — tint emerald, vindo da esquerda */}
          <div className="absolute top-0 left-0 w-[60%]">
            <div
              className="hero-float relative"
              style={
                {
                  "--float-delay": "0.3s",
                  "--float-dur": "7.6s",
                } as React.CSSProperties
              }
            >
              <div
                className="relative -rotate-6 rounded-xl bg-[#0a1c2b]/85 p-3 shadow-[0_22px_54px_-20px_rgba(0,0,0,0.85)] ring-1 backdrop-blur-md"
                style={{
                  boxShadow: `0 22px 54px -20px rgba(0,0,0,0.85), 0 0 0 1px color-mix(in oklab, ${EMERALD} 30%, transparent)`,
                }}
              >
                {/* hairline emerald no topo */}
                <span
                  className="pointer-events-none absolute inset-x-3 top-0 h-px"
                  style={{
                    background: `linear-gradient(to right, transparent, color-mix(in oklab, ${EMERALD} 60%, transparent), transparent)`,
                  }}
                />
                <div className="flex items-center gap-2.5">
                  {/* avatar fantasma */}
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full ring-1"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${EMERALD} 18%, transparent)`,
                      boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${EMERALD} 35%, transparent)`,
                    }}
                  >
                    <User
                      className="size-4"
                      weight="fill"
                      style={{ color: EMERALD }}
                    />
                  </span>
                  {/* linhas de nome/empresa */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="block h-2 w-[72%] rounded-full bg-white/25" />
                    <span className="block h-1.5 w-[48%] rounded-full bg-white/12" />
                  </div>
                </div>
              </div>
              {/* troféuzinho de campanhas pendurado no cartão */}
              <span className="absolute -bottom-3 left-4 z-10 inline-flex -rotate-3 items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-amber-300 uppercase ring-1 ring-amber-400/30 backdrop-blur-sm">
                <Trophy className="size-2.5" weight="fill" />3 campanhas
              </span>
            </div>
          </div>

          {/* cartão de visita da liga — tint da marca, vindo da direita */}
          <div className="absolute right-0 bottom-0 w-[60%]">
            <div
              className="hero-float relative"
              style={
                {
                  "--float-delay": "1.8s",
                  "--float-dur": "8.6s",
                } as React.CSSProperties
              }
            >
              <div className="relative rotate-6 rounded-xl bg-[#0a1c2b]/85 p-3 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] shadow-[0_22px_54px_-20px_rgba(0,0,0,0.85)] backdrop-blur-md">
                {/* hairline da marca no topo */}
                <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_55%,transparent)] to-transparent" />
                <div className="flex items-center gap-2.5">
                  {/* avatar fantasma */}
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]">
                    <User
                      className="size-4 text-[var(--brand-cyan)]"
                      weight="fill"
                    />
                  </span>
                  {/* linhas de nome/empresa */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="block h-2 w-[64%] rounded-full bg-white/25" />
                    <span className="block h-1.5 w-[42%] rounded-full bg-white/12" />
                  </div>
                </div>
                {/* linha de assinatura se preenchendo + carimbo */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span className="block h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="hero-clip-progress block h-full rounded-full"
                      style={
                        {
                          background: `linear-gradient(to right, ${EMERALD}, var(--brand-cyan))`,
                          "--clip-dur": "4.6s",
                          "--clip-delay": "0.8s",
                        } as React.CSSProperties
                      }
                    />
                  </span>
                  <SealCheck
                    className="size-3.5 shrink-0 rotate-12"
                    weight="fill"
                    style={{ color: EMERALD }}
                  />
                </div>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.2em] text-white/35 uppercase">
                  Assinatura
                </span>
              </div>
            </div>
          </div>

          {/* selo de contrato */}
          <div
            className="hero-podium-glow absolute -left-2 bottom-[2%] z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold tracking-[0.14em] uppercase ring-1"
            style={
              {
                backgroundColor: `color-mix(in oklab, ${EMERALD} 16%, transparent)`,
                color: "#6ee7b7",
                boxShadow: `0 0 0 1px color-mix(in oklab, ${EMERALD} 35%, transparent)`,
                "--podium-dur": "3.8s",
              } as React.CSSProperties
            }
          >
            <CheckCircle className="size-3" weight="fill" />
            Contrato ativo
          </div>

          {/* ===== o aperto de mãos — badge central ===== */}
          <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div
              className="arena-tilt relative"
              style={{ "--float-dur": "6.6s" } as React.CSSProperties}
            >
              <span
                className="hero-pulse-ring absolute -inset-4 rounded-full"
                style={{
                  backgroundColor: `color-mix(in oklab, ${EMERALD} 36%, transparent)`,
                }}
              />
              {/* anel cônico emerald → cyan */}
              <span
                className="arena-ring absolute -inset-2 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
                style={{
                  background: `conic-gradient(from 0deg, transparent 12%, color-mix(in oklab, ${EMERALD} 75%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-cyan) 60%, transparent) 72%, transparent 88%)`,
                }}
              />
              {/* satélites orbitando */}
              <span
                className="arena-ring absolute -inset-6 rounded-full"
                style={{ animationDuration: "13s" }}
              >
                <span
                  className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full"
                  style={{
                    backgroundColor: EMERALD,
                    boxShadow: `0 0 8px 2px color-mix(in oklab, ${EMERALD} 60%, transparent)`,
                  }}
                />
                <span className="absolute bottom-[10%] left-[12%] size-1 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
              </span>
              <span
                className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-2xl text-[#04222A] lg:size-13 xl:size-14"
                style={{
                  boxShadow: `0 14px 44px -10px color-mix(in oklab, ${EMERALD} 55%, transparent)`,
                }}
              >
                <Handshake className="size-6 lg:size-6.5 xl:size-7" weight="fill" />
              </span>
            </div>
          </div>
        </div>

        {/* ===== chips glass ===== */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[9%] right-[34%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 backdrop-blur-md lg:right-[40%]"
          style={
            {
              "--float-delay": "0.6s",
              "--float-dur": "7.4s",
              boxShadow: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 0 0 1px color-mix(in oklab, ${EMERALD} 26%, transparent)`,
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span
              className="inline-flex size-4 items-center justify-center rounded-full"
              style={{ backgroundColor: EMERALD }}
            >
              <UserCheck className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Parceria
          </span>
          <span className="text-foreground text-xs font-bold">
            Cliente ativo
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[12%] left-[16%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-amber-400/25 backdrop-blur-md lg:flex"
          style={
            {
              "--float-delay": "2.3s",
              "--float-dur": "8.2s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-amber-400">
              <Coins className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Financeiro
          </span>
          <span className="text-foreground text-xs font-bold">
            Investimento em dia
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da parceria: os dois cartões de visita se encontrando em
 * diagonal e o aperto de mãos no centro.
 */
export function ClientsHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[8%] h-[clamp(180px,20vw,240px)] w-[clamp(250px,28vw,340px)] -translate-y-1/2 lg:right-[11%]">
        {/* cartão do cliente */}
        <GPanel
          floatDur={7.8}
          className="absolute top-0 left-0 flex w-[60%] flex-col gap-2 p-2.5"
        >
          <span className="flex items-center gap-2">
            <GBone className="size-9 shrink-0 rounded-xl" />
            <GLines widths={["100%", "62%"]} delay={70} className="min-w-0 flex-1" />
          </span>
          <GBone delay={200} className="h-2 w-[70%] rounded-full" />
        </GPanel>

        {/* cartão da liga */}
        <GPanel
          floatDelay={1.2}
          floatDur={8.4}
          className="absolute right-0 bottom-0 flex w-[60%] flex-col gap-2 p-2.5"
        >
          <span className="flex items-center gap-2">
            <GBone delay={140} className="size-9 shrink-0 rounded-xl" />
            <GLines widths={["100%", "58%"]} delay={200} className="min-w-0 flex-1" />
          </span>
          {/* linha de assinatura se preenchendo */}
          <span className="block h-1 overflow-hidden rounded-full bg-white/12">
            <span
              className="hero-clip-progress block h-full rounded-full bg-white/35"
              style={{ "--clip-dur": "5.4s" } as React.CSSProperties}
            />
          </span>
        </GPanel>

        {/* aperto de mãos no centro */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-white/8" />
          <GBone delay={260} className="size-10 rounded-2xl lg:size-11" />
        </span>
      </div>
    </VizGhost>
  )
}
