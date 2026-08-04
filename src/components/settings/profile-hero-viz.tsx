import {
  Camera,
  DiscordLogo,
  EnvelopeSimple,
  LockKey,
  PencilSimple,
  SealCheck,
  ShieldCheck,
  Sparkle,
  User,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero do Perfil — "IDENTIDADE EM EDIÇÃO":
 * um painel de perfil PAISAGEM (deitado, nada pendurado — os crachás em
 * cordões são dos admins em Membros) sendo lapidado ao vivo: avatar
 * fantasma com anel cônico girando (upload em progresso) e badge de
 * câmera com ping, linhas ghost de nome/email com o lápis de edição,
 * chip de função "CLIPADOR" em text-gradient, selo "Verificado" com
 * ping esmeralda, régua de senha com pontos acendendo em sequência e
 * barra de upload completando. Satélites: chip do Discord (blurple,
 * âncora cromática única desta viz) e chip de senha protegida. Painel
 * fantasma atrás para profundidade. Aurora blurple+cyan, grid, feixe,
 * sparkles, partículas e cometa. Tudo ancorado num container central
 * com clamp() — responsivo por construção. CSS puro, aria-hidden.
 */

/** Blurple do Discord — âncora cromática desta viz. */
const BLURPLE = "#5865F2"

/** Pontos da senha acendendo em sequência. */
const PASSWORD_DOTS = [0, 0.35, 0.7, 1.05, 1.4, 1.75] as const

const SPARKLES = [
  { left: "18%", top: "12%", size: 11, delay: 0.2, dur: 3.8, blurple: true, lgOnly: false },
  { left: "45%", top: "6%", size: 9, delay: 1.5, dur: 4.4, blurple: false, lgOnly: true },
  { left: "88%", top: "14%", size: 12, delay: 2.3, dur: 3.4, blurple: false, lgOnly: false },
  { left: "28%", top: "78%", size: 9, delay: 0.9, dur: 4.6, blurple: false, lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3, dur: 3.6, blurple: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "22%", bottom: "18%", size: 3, delay: 0.5, dur: 5.8, x: 12, opacity: 0.8, blurple: true },
  { left: "40%", bottom: "12%", size: 2, delay: 2.1, dur: 6.8, x: -10, opacity: 0.6, blurple: false },
  { left: "62%", bottom: "16%", size: 3, delay: 1.3, dur: 5.4, x: 8, opacity: 0.85, blurple: true },
  { left: "82%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -12, opacity: 0.6, blurple: false },
  { left: "94%", bottom: "22%", size: 3, delay: 2.6, dur: 6, x: 10, opacity: 0.7, blurple: true },
] as const

export function ProfileHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora blurple + halo ciano */}
        <span
          className="arena-aurora absolute -top-16 right-[8%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${BLURPLE} 30%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[42%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6.4s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[26%] w-24 overflow-visible">
          <span
            className="hero-sweep block h-full w-full"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${BLURPLE} 14%, transparent), transparent)`,
            }}
          />
        </div>

        {/* cometa blurple */}
        <span
          className="arena-comet absolute top-[5%] right-[12%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${BLURPLE} 70%, transparent), transparent)`,
              "--comet-dur": "11.4s",
              "--comet-delay": "2.4s",
              "--comet-x": "-310px",
              "--comet-y": "215px",
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
                color: sparkle.blurple ? BLURPLE : "var(--brand-cyan)",
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
                backgroundColor: particle.blurple
                  ? BLURPLE
                  : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== O PAINEL DE IDENTIDADE — âncora central ===== */}
        <div className="absolute top-1/2 right-[8%] w-[clamp(250px,28vw,360px)] -translate-y-1/2">
          {/* painel fantasma atrás (profundidade) */}
          <div className="absolute -top-3 right-[-4%] h-full w-[92%] rotate-2 rounded-2xl bg-white/[0.045] ring-1 ring-white/8" />

          {/* painel principal */}
          <div
            className="arena-tilt relative rounded-2xl bg-[#0a1c2b]/85 p-3.5 shadow-[0_26px_70px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/10 backdrop-blur-md lg:p-4"
            style={{ "--float-dur": "8.5s" } as React.CSSProperties}
          >
            {/* hairline blurple→cyan no topo */}
            <span
              className="pointer-events-none absolute inset-x-4 top-0 h-px"
              style={{
                background: `linear-gradient(to right, transparent, color-mix(in oklab, ${BLURPLE} 60%, transparent), color-mix(in oklab, var(--brand-cyan) 55%, transparent), transparent)`,
              }}
            />

            <div className="flex items-center gap-3 lg:gap-3.5">
              {/* avatar com anel cônico girando + badge de câmera */}
              <div className="relative shrink-0">
                <span
                  className="arena-ring absolute -inset-1.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 8%, color-mix(in oklab, ${BLURPLE} 80%, transparent) 28%, transparent 46%, color-mix(in oklab, var(--brand-cyan) 65%, transparent) 72%, transparent 90%)`,
                  }}
                />
                <span
                  className="relative flex size-12 items-center justify-center rounded-full ring-1 ring-white/15 lg:size-13"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in oklab, ${BLURPLE} 45%, transparent), rgba(255,255,255,0.09) 55%, color-mix(in oklab, var(--brand-cyan) 38%, transparent))`,
                  }}
                >
                  <User className="size-5.5 text-white/45 lg:size-6" weight="fill" />
                </span>
                {/* badge de câmera com ping */}
                <span className="absolute -right-1 -bottom-1">
                  <span className="hero-pulse-ring absolute -inset-1.5 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_38%,transparent)]" />
                  <span className="relative flex size-5.5 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-cyan)] to-[var(--brand-mint)] text-[#04222A] ring-2 ring-[#0a1c2b]">
                    <Camera className="size-3" weight="fill" />
                  </span>
                </span>
              </div>

              {/* linhas ghost de identidade */}
              <div className="min-w-0 flex-1">
                {/* nome sendo editado */}
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-3/5 rounded-full bg-white/30" />
                  <PencilSimple
                    className="size-3 shrink-0 text-[var(--brand-cyan)]"
                    weight="fill"
                  />
                </div>
                {/* email */}
                <div className="mt-2 flex items-center gap-1.5">
                  <EnvelopeSimple
                    className="size-3 shrink-0 text-white/35"
                    weight="fill"
                  />
                  <span className="h-1.5 w-4/5 rounded-full bg-white/12" />
                </div>
                {/* função + selo verificado */}
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="rounded-full bg-white/6 px-2 py-0.5 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_32%,transparent)]">
                    <span className="text-gradient text-[8px] font-black tracking-[0.18em] uppercase">
                      Clipador
                    </span>
                  </span>
                  <span className="relative inline-flex">
                    <span className="hero-pulse-ring absolute -inset-1 rounded-full bg-emerald-400/35" />
                    <span className="relative inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                      <SealCheck className="size-2.5" weight="fill" />
                      Verificado
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* régua de senha + barra de upload */}
            <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.05] px-2.5 py-2 ring-1 ring-white/8">
              <LockKey
                className="size-3.5 shrink-0"
                style={{ color: BLURPLE }}
                weight="fill"
              />
              <span className="flex items-center gap-1">
                {PASSWORD_DOTS.map((delay, index) => (
                  <span
                    key={index}
                    className="arena-twinkle size-1 rounded-full bg-white/80"
                    style={
                      {
                        "--twinkle-delay": `${delay}s`,
                        "--twinkle-dur": "2.6s",
                        "--twinkle-opacity": 0.9,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
              {/* upload da foto completando */}
              <span className="ml-auto h-1 w-full max-w-16 overflow-hidden rounded-full bg-white/10">
                <span
                  className="hero-clip-progress block h-full rounded-full"
                  style={
                    {
                      background: "var(--brand-gradient)",
                      "--clip-dur": "5.5s",
                    } as React.CSSProperties
                  }
                />
              </span>
            </div>
          </div>

          {/* satélite: Discord conectado (blurple) */}
          <div
            className="arena-tilt absolute -top-9 -right-2 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-lg backdrop-blur-md"
            style={
              {
                backgroundColor: `color-mix(in oklab, ${BLURPLE} 18%, rgba(10,28,43,0.7))`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${BLURPLE} 45%, transparent), 0 14px 34px -14px rgba(0,0,0,0.8)`,
                "--float-delay": "0.8s",
                "--float-dur": "7.4s",
              } as React.CSSProperties
            }
          >
            <DiscordLogo
              className="size-3.5"
              style={{ color: "#a5b0ff" }}
              weight="fill"
            />
            <span className="text-[10px] font-bold whitespace-nowrap text-white/90">
              Discord conectado
            </span>
          </div>

          {/* satélite: senha protegida */}
          <div
            className="arena-tilt bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute -bottom-9 left-[4%] hidden items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] backdrop-blur-md lg:flex"
            style={
              {
                "--float-delay": "2.1s",
                "--float-dur": "8.2s",
              } as React.CSSProperties
            }
          >
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <ShieldCheck className="size-3 text-[#04222A]" weight="fill" />
            </span>
            <span className="text-foreground text-[10px] font-bold whitespace-nowrap">
              Senha protegida
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do painel de identidade: o painel atrás, o avatar com anel
 * girando e badge de câmera, as linhas de identidade, a régua de senha
 * e a barra de upload.
 */
export function ProfileHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[8%] w-[clamp(250px,28vw,360px)] -translate-y-1/2">
        {/* painel fantasma atrás */}
        <GBone
          faint
          className="absolute -top-3 right-[-4%] h-full w-[92%] rotate-2 rounded-2xl"
        />

        {/* painel principal */}
        <GPanel floatDur={8.2} className="relative flex flex-col gap-3 p-3.5">
          <span className="flex items-center gap-3">
            <span className="relative shrink-0">
              <span className="arena-ring absolute -inset-1.5 rounded-full border border-dashed border-white/15" />
              <GBone className="size-12 rounded-full lg:size-13" />
              {/* badge de câmera */}
              <span className="absolute -right-1 -bottom-1">
                <span className="hero-pulse-ring absolute -inset-1.5 rounded-full bg-white/10" />
                <GBone delay={140} className="size-5.5 rounded-full" />
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <GBone delay={80} className="h-2.5 w-28 rounded-full" />
              <GBone delay={140} className="h-2 w-20 rounded-full" />
            </span>
          </span>

          {/* linhas de identidade */}
          {[0, 1].map((row) => (
            <span key={row} className="flex items-center gap-2">
              <GBone delay={200 + row * 90} className="size-3 shrink-0 rounded-sm" />
              <GBone
                delay={240 + row * 90}
                className="h-2 rounded-full"
                style={{ width: `${72 - row * 18}%` }}
              />
            </span>
          ))}

          {/* régua de senha */}
          <span className="flex items-center gap-2">
            <GBone delay={400} className="size-3.5 shrink-0 rounded-sm" />
            <span className="flex items-center gap-1">
              {Array.from({ length: 6 }).map((_, dot) => (
                <GBone key={dot} delay={430 + dot * 40} className="size-1 rounded-full" />
              ))}
            </span>
          </span>

          {/* upload da foto */}
          <span className="block h-1 overflow-hidden rounded-full bg-white/12">
            <span
              className="hero-clip-progress block h-full rounded-full bg-white/35"
              style={{ "--clip-dur": "5s" } as React.CSSProperties}
            />
          </span>

          <GLines widths={["58%"]} delay={520} />
        </GPanel>
      </div>

      {/* satélite conectado */}
      <GPanel
        className="absolute top-[16%] right-[44%] flex items-center gap-1.5 px-2.5 py-1.5"
        floatDelay={1.6}
        floatDur={7.8}
      >
        <GBone delay={180} className="size-4 shrink-0 rounded-full" />
        <GBone delay={240} className="h-2 w-14 rounded-full" />
      </GPanel>
    </VizGhost>
  )
}
