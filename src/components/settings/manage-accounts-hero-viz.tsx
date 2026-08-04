import { PlugsConnected, Plus, SealCheck, Sparkle } from "@phosphor-icons/react/dist/ssr"

import { platformConfig } from "@/lib/platform-config"
import { GBone, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Minhas Contas (clipador) — "O PLUG DA
 * CONTA": um card de conta social (handle fantasma, selo de verificação,
 * badge de nicho e status "Conectada" com ping) plugado por um cabo de
 * energia ao dock da liga; o pulso de energia percorre o cabo (hero-trace),
 * o dock pulsa com anel cônico girando, o pill de switch "Ativa" confirma o
 * estado e, abaixo, a fila de plataformas aguarda conexão com stagger ao
 * lado de um slot vazio tracejado. Diferente da constelação radial da visão
 * admin de contas: aqui é UMA conexão horizontal, com fila e switch.
 * Aurora, grid, cometa, sparkles e partículas de ambiente. Tudo ancorado
 * num container central com clamp() — responsivo por construção. CSS puro,
 * aria-hidden.
 */

/** Plataformas aguardando na fila de conexão (a TikTok já está plugada). */
const QUEUE = [
  { platform: "INSTAGRAM", delay: 0.6, dur: 6.8 },
  { platform: "YOUTUBE", delay: 1.4, dur: 7.4 },
  { platform: "KWAI", delay: 2.2, dur: 7 },
] as const

const SPARKLES = [
  { left: "20%", top: "13%", size: 11, delay: 0.2, dur: 3.8, mint: true, lgOnly: false },
  { left: "48%", top: "7%", size: 9, delay: 1.5, dur: 4.4, mint: false, lgOnly: true },
  { left: "88%", top: "15%", size: 12, delay: 2.3, dur: 3.4, mint: false, lgOnly: false },
  { left: "28%", top: "78%", size: 9, delay: 0.9, dur: 4.6, mint: false, lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3, dur: 3.6, mint: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "24%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 12, mint: true },
  { left: "44%", bottom: "10%", size: 2, delay: 2.1, dur: 6.8, x: -10, mint: false },
  { left: "66%", bottom: "14%", size: 3, delay: 1.3, dur: 5.4, x: 8, mint: true },
  { left: "90%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -12, mint: false },
] as const

export function ManageAccountsHeroViz({ className }: { className?: string }) {
  const TikTokIcon = platformConfig.TIKTOK.icon

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora da marca */}
        <span className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_24%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[42%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_16%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_66%_50%,#000_28%,transparent_78%)]" />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "2.6s",
              "--comet-x": "-320px",
              "--comet-y": "220px",
              "--comet-angle": "-33deg",
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
              sparkle.mint ? "text-[var(--brand-mint)]" : "text-[var(--brand-cyan)]",
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

        {/* partículas ambiente */}
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
                "--particle-opacity": 0.8,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== O PLUG — âncora central ===== */}
        <div className="absolute top-1/2 right-[8%] w-[clamp(250px,28vw,360px)] -translate-y-1/2">
          {/* fileira: card da conta → cabo → dock da liga */}
          <div className="flex items-center">
            {/* card da conta conectada */}
            <div
              className="arena-tilt relative w-[58%] shrink-0"
              style={{ "--float-dur": "8.2s" } as React.CSSProperties}
            >
              <div className="relative overflow-hidden rounded-2xl bg-[#0a1c2b]/90 p-3 shadow-[0_28px_60px_-22px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] backdrop-blur-md">
                {/* hairline da marca */}
                <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] to-transparent" />
                {/* brilho varrendo o card */}
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  style={{ "--shine-delay": "2.2s" } as React.CSSProperties}
                />

                <div className="flex items-center gap-2.5">
                  {/* ícone da plataforma + selo de verificação */}
                  <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f1204a]/15 ring-1 ring-[#f1204a]/30">
                    <TikTokIcon className="size-4.5 text-[#f1204a]" />
                    <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-blue-500 text-white ring-2 ring-[#0a1c2b]">
                      <SealCheck className="size-2.5" weight="fill" />
                    </span>
                  </span>
                  {/* handle fantasma */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="block h-2 w-[82%] rounded-full bg-white/25" />
                    <span className="block h-1.5 w-[52%] rounded-full bg-white/12" />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  {/* badge de nicho */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[8px] font-bold text-white/70">
                    <span>😂</span>
                    Meme
                  </span>
                  {/* status conectada com ping */}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-70" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-[var(--brand-green)]" />
                    </span>
                    <span className="text-[8px] font-bold tracking-[0.12em] text-[var(--brand-green)] uppercase">
                      Conectada
                    </span>
                  </span>
                </div>
              </div>

              {/* pill de switch "Ativa" — ancorado no pé do card */}
              <div
                className="hero-float absolute -bottom-3.5 left-3 flex items-center gap-1.5 rounded-full bg-[#0a1c2b]/90 px-2 py-1 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-green)_30%,transparent)] backdrop-blur-md"
                style={
                  { "--float-delay": "0.8s", "--float-dur": "7.4s" } as React.CSSProperties
                }
              >
                <span className="relative h-3.5 w-6 rounded-full bg-[var(--brand-green)]">
                  <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-white" />
                </span>
                <span className="text-foreground text-[9px] font-bold tracking-[0.1em] uppercase">
                  Ativa
                </span>
              </div>
            </div>

            {/* cabo de energia com pulso percorrendo */}
            <div className="relative h-12 min-w-0 flex-1">
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 48"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d="M0 24 C 32 8, 68 40, 100 24"
                  stroke="color-mix(in oklab, var(--brand-cyan) 22%, transparent)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d="M0 24 C 32 8, 68 40, 100 24"
                  className="hero-trace"
                  stroke="color-mix(in oklab, var(--brand-mint) 75%, transparent)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* dock da liga */}
            <div className="relative shrink-0">
              <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_32%,transparent)]" />
              <span
                className="arena-ring absolute -inset-1.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 12%, color-mix(in oklab, var(--brand-cyan) 75%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-mint) 60%, transparent) 72%, transparent 88%)",
                }}
              />
              <span className="bg-gradient-custom relative flex size-11 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_40px_-10px_rgba(31,254,200,0.55)] lg:size-12">
                <PlugsConnected className="size-5.5 lg:size-6" weight="fill" />
              </span>
            </div>
          </div>

          {/* fila de plataformas aguardando conexão */}
          <div className="mt-7 flex items-center gap-2.5">
            <span className="text-muted-foreground text-[9px] font-semibold tracking-[0.16em] uppercase">
              Na fila
            </span>
            {QUEUE.map(({ platform, delay, dur }) => {
              const config = platformConfig[platform]
              const PlatformIcon = config.icon
              return (
                <span
                  key={platform}
                  className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 flex size-9 items-center justify-center rounded-xl shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
                  style={
                    {
                      "--float-delay": `${delay}s`,
                      "--float-dur": `${dur}s`,
                    } as React.CSSProperties
                  }
                >
                  <PlatformIcon className={cn("size-4.5", config.color)} />
                </span>
              )
            })}
            {/* slot vazio esperando a próxima conta */}
            <span
              className="hero-float flex size-9 items-center justify-center rounded-xl border border-dashed border-white/20"
              style={
                { "--float-delay": "3s", "--float-dur": "7.6s" } as React.CSSProperties
              }
            >
              <Plus className="size-4 text-white/40" weight="bold" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do plug: o card da conta conectada, o cabo com o pulso
 * percorrendo e o dock da liga com anel orbitando.
 */
export function ManageAccountsHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="66%">
      <div className="absolute top-1/2 right-[8%] flex w-[clamp(250px,28vw,360px)] -translate-y-1/2 items-center gap-3">
        {/* card da conta */}
        <GPanel floatDur={8} className="relative flex flex-1 flex-col gap-2 p-3">
          <span className="flex items-center gap-2">
            <span className="relative shrink-0">
              <GBone className="size-9 rounded-xl" />
              <GBone delay={80} className="absolute -top-1.5 -right-1.5 size-4 rounded-full" />
            </span>
            <GLines widths={["100%", "60%"]} delay={120} className="min-w-0 flex-1" />
          </span>
          <GBone delay={240} className="h-2.5 w-16 rounded-full" />
          <span className="flex items-center gap-1.5">
            <GBone delay={300} className="size-1.5 shrink-0 rounded-full" />
            <GBone delay={340} className="h-2 w-14 rounded-full" />
          </span>

          {/* pill de switch no pé do card */}
          <GPanel
            className="absolute -bottom-3.5 left-3 flex items-center gap-1.5 rounded-full px-2 py-1"
            floatDelay={0.6}
            floatDur={7.2}
          >
            <GBone delay={400} className="h-2 w-8 rounded-full" />
            <GBone delay={440} className="size-2.5 rounded-full" />
          </GPanel>
        </GPanel>

        {/* cabo */}
        <span className="relative h-px w-8 shrink-0 bg-gradient-to-r from-white/10 via-white/30 to-white/10 lg:w-10">
          <span
            className="hero-clip-progress absolute inset-y-0 left-0 block rounded-full bg-white/50"
            style={{ "--clip-dur": "4.2s" } as React.CSSProperties}
          />
        </span>

        {/* dock da liga */}
        <span className="relative shrink-0">
          <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-white/8" />
          <span className="arena-ring absolute -inset-1.5 rounded-full border border-dashed border-white/15" />
          <GBone delay={180} className="size-11 rounded-2xl lg:size-12" />
        </span>
      </div>
    </VizGhost>
  )
}
