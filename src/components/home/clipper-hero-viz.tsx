import {
  Lightning,
  Play,
  Sparkle,
  Timer,
  Trophy,
} from "@phosphor-icons/react/dist/ssr"

import {
  GBone,
  GChip,
  GLines,
  GPanel,
  VizGhost,
} from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada da home do CLIPADOR — "O CONVITE PARA A ARENA":
 * o card da competição em destaque (capa com brilho varrendo, prêmio em
 * gradiente e CTA "Inscrever-se" pulsando), troféu com anel orbital
 * ancorado no canto, chip de countdown, confete caindo e cards fantasma
 * atrás. Composição HORIZONTAL e baixa — cabe na faixa do hero em
 * qualquer altura. Ancorada num container central com clamp(),
 * responsiva por construção. CSS puro, aria-hidden.
 */

/** Confete da premiação caindo sobre o card. */
const CONFETTI = [
  { left: "18%", top: "-14%", w: 4, h: 8, delay: 0.4, dur: 5.8, x: 14, rot: 300, color: "var(--brand-mint)" },
  { left: "46%", top: "-18%", w: 5, h: 5, delay: 2.2, dur: 6.6, x: -12, rot: 240, color: "#f5b73b" },
  { left: "70%", top: "-12%", w: 4, h: 8, delay: 3.8, dur: 6, x: 10, rot: 320, color: "var(--brand-cyan)" },
] as const

const SPARKLES = [
  { left: "20%", top: "14%", size: 11, delay: 0.2, dur: 3.8, gold: false, lgOnly: false },
  { left: "48%", top: "7%", size: 9, delay: 1.5, dur: 4.4, gold: true, lgOnly: true },
  { left: "88%", top: "16%", size: 12, delay: 2.3, dur: 3.4, gold: false, lgOnly: false },
  { left: "28%", top: "76%", size: 9, delay: 0.9, dur: 4.6, gold: true, lgOnly: true },
  { left: "92%", top: "68%", size: 10, delay: 3, dur: 3.6, gold: false, lgOnly: false },
] as const

const PARTICLES = [
  { left: "22%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 12, mint: true },
  { left: "44%", bottom: "10%", size: 2, delay: 2.1, dur: 6.8, x: -10, mint: false },
  { left: "68%", bottom: "14%", size: 3, delay: 1.3, dur: 5.4, x: 8, mint: true },
  { left: "90%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -12, mint: false },
] as const

/** Plataformas aceitas (dots coloridos no card). */
const PLATFORM_DOTS = ["#ec4899", "#22d3ee", "#ef4444", "#f97316"] as const

export function ClipperHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora da marca + dourada do prêmio */}
        <span className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f5b73b_16%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[26%] w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-mint)_13%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[10%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
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
              sparkle.gold ? "text-[#f5b73b]" : "text-[var(--brand-mint)]",
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

        {/* ===== O CONVITE — card horizontal ancorado ===== */}
        <div className="absolute top-1/2 right-[7%] w-[clamp(260px,30vw,370px)] -translate-y-1/2 lg:right-[10%]">
          {/* confete da premiação */}
          {CONFETTI.map((confetti, index) => (
            <span
              key={index}
              className="arena-confetti absolute rounded-[2px]"
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
                  "--confetti-opacity": 0.85,
                } as React.CSSProperties
              }
            />
          ))}

          {/* cards fantasma atrás (as outras competições) */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-white/[0.045] ring-1 ring-white/8"
            style={{ transform: "rotate(-4deg) translate(-12px, 12px)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden rounded-2xl bg-white/[0.025] ring-1 ring-white/5 lg:block"
            style={{ transform: "rotate(-8deg) translate(-24px, 24px)" }}
          />

          {/* o card da competição em destaque */}
          <div
            className="arena-tilt relative"
            style={{ "--float-dur": "8.5s" } as React.CSSProperties}
          >
            <div className="relative flex rotate-1 items-stretch gap-3 rounded-2xl bg-[#0a1c2b]/90 p-3 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] backdrop-blur-md lg:p-3.5">
              {/* hairline da marca no topo */}
              <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] to-transparent" />

              {/* capa da competição */}
              <div className="relative aspect-square w-[34%] shrink-0 self-center overflow-hidden rounded-xl ring-1 ring-white/10">
                <span
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(140deg, color-mix(in oklab, var(--brand-cyan) 32%, #0a1c2b), color-mix(in oklab, #a855f7 22%, #0a1c2b) 50%, color-mix(in oklab, var(--brand-green) 28%, #0a1c2b))",
                  }}
                />
                <span className="absolute -top-3 right-1 size-8 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] blur-lg" />
                {/* play discreto na capa */}
                <span className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-sm">
                  <Play className="size-3" weight="fill" />
                </span>
                {/* brilho varrendo a capa */}
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  style={{ "--shine-delay": "1.6s" } as React.CSSProperties}
                />
                {/* selo AO VIVO */}
                <span className="absolute top-1 left-1 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 backdrop-blur-sm">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-[var(--brand-green)]" />
                  </span>
                  <span className="text-[7px] font-bold tracking-[0.1em] text-white/90 uppercase">
                    Ativa
                  </span>
                </span>
              </div>

              {/* conteúdo do card */}
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                {/* título fantasma */}
                <div className="flex flex-col gap-1.5">
                  <span className="block h-2 w-[85%] rounded-full bg-white/25" />
                  <span className="block h-2 w-[55%] rounded-full bg-white/12" />
                </div>

                {/* prêmio em destaque */}
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-3.5 text-[#f5b73b]" weight="fill" />
                  <span className="text-gradient font-mono text-sm font-black tracking-tight tabular-nums lg:text-base">
                    R$ 50.000
                  </span>
                  <span className="text-muted-foreground text-[8px] font-semibold tracking-[0.12em] uppercase">
                    em prêmios
                  </span>
                </div>

                {/* plataformas aceitas */}
                <div className="flex items-center gap-1">
                  {PLATFORM_DOTS.map((color, index) => (
                    <span
                      key={index}
                      className="size-2 rounded-full ring-1 ring-white/20"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="text-muted-foreground ml-1 text-[8px] font-semibold">
                    +2
                  </span>
                </div>

                {/* CTA pulsando — o foco da composição */}
                <div className="relative mt-0.5 w-fit">
                  <span className="hero-pulse-ring absolute -inset-2 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_32%,transparent)]" />
                  <span className="bg-gradient-custom relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black tracking-[0.08em] text-[#04222A] uppercase shadow-[0_10px_30px_-8px_rgba(31,254,200,0.6)] lg:text-[11px]">
                    <Lightning className="size-3 lg:size-3.5" weight="fill" />
                    Inscrever-se
                  </span>
                </div>
              </div>
            </div>

            {/* troféu com anel orbital — ancorado no canto do card */}
            <div className="absolute -top-4 -right-3 lg:-top-5 lg:-right-4">
              <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-[color-mix(in_oklab,#f5b73b_36%,transparent)]" />
              <span
                className="arena-ring absolute -inset-1.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 12%, color-mix(in oklab, #f5b73b 75%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-mint) 60%, transparent) 72%, transparent 88%)",
                }}
              />
              <span className="relative flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ffe9b0,#f5b73b)] text-[#3b2a00] shadow-[0_14px_40px_-10px_rgba(245,183,59,0.6)] lg:size-10">
                <Trophy className="size-4.5 lg:size-5" weight="fill" />
              </span>
            </div>

            {/* countdown — ancorado no pé do card */}
            <div
              className="hero-float absolute -bottom-4 left-4 flex items-center gap-1.5 rounded-xl bg-[#0a1c2b]/90 px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] backdrop-blur-md"
              style={
                { "--float-delay": "0.8s", "--float-dur": "7.2s" } as React.CSSProperties
              }
            >
              <Timer className="size-3.5 text-[var(--brand-cyan)]" weight="fill" />
              <span className="text-foreground font-mono text-[10px] font-bold tabular-nums">
                02
                <span className="text-muted-foreground mx-px">:</span>
                14
                <span className="text-muted-foreground mx-px">:</span>
                36
              </span>
              <span className="text-muted-foreground text-[8px] font-semibold tracking-[0.12em] uppercase">
                p/ encerrar
              </span>
            </div>
          </div>
        </div>

        {/* chip ambiente — inscrições abertas */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[12%] right-[40%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-green)_26%,transparent)] backdrop-blur-md lg:right-[46%]"
          style={
            { "--float-delay": "0.4s", "--float-dur": "7.6s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--brand-green)]" />
            </span>
            Inscrições abertas
          </span>
          <span className="text-foreground text-xs font-bold">
            Vagas limitadas
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da mesma composição: os cards empilhados, o card do convite
 * (capa + títulos + prêmio + plataformas + CTA), o troféu ancorado, o
 * countdown no pé e o chip de inscrições. Mesmas âncoras da viz real,
 * então nada salta quando os dados chegam.
 */
export function ClipperHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className}>
      <div className="absolute top-1/2 right-[7%] w-[clamp(260px,30vw,370px)] -translate-y-1/2 lg:right-[10%]">
        {/* cards fantasma atrás (as outras competições) */}
        <GBone
          faint
          className="absolute inset-0 rounded-2xl"
          style={{ transform: "rotate(-4deg) translate(-12px, 12px)" }}
        />
        <GBone
          faint
          delay={120}
          className="absolute inset-0 hidden rounded-2xl lg:block"
          style={{ transform: "rotate(-8deg) translate(-24px, 24px)" }}
        />

        {/* o card do convite */}
        <GPanel
          floatDur={8.5}
          className="relative flex rotate-1 items-stretch gap-3 p-3 lg:p-3.5"
        >
          <GBone className="aspect-square w-[34%] shrink-0 self-center rounded-xl" />
          <span className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <GLines widths={["85%", "55%"]} delay={80} />
            <GBone delay={240} className="h-3.5 w-[64%] rounded-full" />
            <span className="flex items-center gap-1">
              {[0, 1, 2, 3].map((dot) => (
                <GBone
                  key={dot}
                  delay={340 + dot * 60}
                  className="size-2 rounded-full"
                />
              ))}
            </span>
            <GBone delay={600} className="h-5 w-24 rounded-full" />
          </span>
        </GPanel>

        {/* troféu ancorado no canto */}
        <GBone
          delay={160}
          className="absolute -top-4 -right-3 size-9 rounded-xl lg:-top-5 lg:-right-4 lg:size-10"
        />

        {/* countdown no pé do card */}
        <GChip
          className="absolute -bottom-4 left-4"
          lines={1}
          delay={220}
          floatDelay={0.8}
          floatDur={7.2}
        />
      </div>

      {/* chip ambiente — inscrições abertas */}
      <GChip
        className="absolute top-[12%] right-[40%] lg:right-[46%]"
        icon={false}
        delay={320}
        floatDelay={0.4}
        floatDur={7.6}
      />
    </VizGhost>
  )
}
