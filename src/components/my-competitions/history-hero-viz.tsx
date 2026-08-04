import {
  CheckCircle,
  Coins,
  Medal,
  Sparkle,
  Trophy,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Histórico — hall de conquistas:
 * aurora em deriva, duas prateleiras de vidro flutuantes segurando
 * troféu de ouro (com brilho varrendo e halo pulsante), medalhas de
 * prata e bronze, linha do tempo com pips cintilando em sequência e
 * traço fluindo, confetes residuais e sparkles.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "34%", top: "12%", size: 10, delay: 0.4, dur: 4, color: "cyan", lgOnly: true },
  { left: "56%", top: "8%", size: 12, delay: 1.6, dur: 3.6, color: "mint", lgOnly: false },
  { left: "88%", top: "10%", size: 9, delay: 0, dur: 4.4, color: "cyan", lgOnly: false },
  { left: "48%", top: "38%", size: 9, delay: 2.4, dur: 3.8, color: "mint", lgOnly: true },
  { left: "92%", top: "42%", size: 11, delay: 3.2, dur: 4.2, color: "mint", lgOnly: false },
] as const

const CONFETTI = [
  { left: "58%", top: "14%", w: 4, h: 8, delay: 0.6, dur: 7.4, x: 16, rot: 300, color: "var(--brand-mint)", opacity: 0.75 },
  { left: "70%", top: "10%", w: 5, h: 5, delay: 2.8, dur: 8, x: -14, rot: 240, color: "#facc15", opacity: 0.7 },
  { left: "82%", top: "16%", w: 4, h: 8, delay: 4.6, dur: 7.8, x: 12, rot: 320, color: "var(--brand-cyan)", opacity: 0.7 },
] as const

const PIPS = [
  { left: "8%", delay: 0, check: false },
  { left: "30%", delay: 0.7, check: false },
  { left: "52%", delay: 1.4, check: false },
  { left: "74%", delay: 2.1, check: true },
  { left: "94%", delay: 2.8, check: false },
] as const

export function HistoryHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-16 right-[34%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_24%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[6%] bottom-[10%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_18%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-8s" }}
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

        {/* confetes residuais caindo devagar */}
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
                "--confetti-opacity": confetti.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* prateleira principal — ouro e prata */}
        <div
          className="hero-float absolute top-[16%] right-[12%] w-[clamp(170px,20vw,240px)]"
          style={{ "--float-dur": "8.6s" } as React.CSSProperties}
        >
          <div className="flex items-end justify-center gap-3 pb-2 lg:gap-4">
            {/* medalha de prata */}
            <span
              className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 flex size-10 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/20 backdrop-blur-md lg:size-11"
              style={{ "--float-delay": "0.8s", "--float-dur": "5.8s" } as React.CSSProperties}
            >
              <Medal className="size-4.5 text-zinc-300 lg:size-5" weight="fill" />
            </span>
            {/* troféu de ouro */}
            <div className="relative">
              <span className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,0.26),transparent_68%)] blur-lg" />
              <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-[rgba(250,204,21,0.3)]" />
              <span className="relative flex size-13 items-center justify-center overflow-hidden rounded-2xl bg-yellow-400/12 shadow-[0_12px_36px_-10px_rgba(250,204,21,0.55)] ring-1 ring-yellow-400/40 backdrop-blur-md lg:size-14 xl:size-16">
                <Trophy className="size-6 text-yellow-400 lg:size-7 xl:size-8" weight="fill" />
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  style={{ "--shine-delay": "1.2s" } as React.CSSProperties}
                />
              </span>
            </div>
          </div>
          {/* prateleira de vidro */}
          <span className="block h-1.5 w-full rounded-full bg-gradient-to-r from-white/6 via-[color-mix(in_oklab,var(--brand-cyan)_50%,transparent)] to-white/6 shadow-[0_8px_22px_-6px_color-mix(in_oklab,var(--brand-cyan)_50%,transparent)]" />
          <span className="mx-auto mt-1 block h-2 w-3/4 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_16%,transparent)] blur-md" />
        </div>

        {/* prateleira secundária — bronze */}
        <div
          className="hero-float absolute top-[47%] right-[40%] w-[clamp(120px,14vw,170px)]"
          style={{ "--float-delay": "1.6s", "--float-dur": "9.4s" } as React.CSSProperties}
        >
          <div className="flex items-end justify-center gap-3 pb-2">
            <span
              className="hero-float flex size-9 items-center justify-center rounded-2xl bg-orange-400/10 shadow-lg ring-1 ring-orange-400/35 backdrop-blur-md lg:size-10"
              style={{ "--float-delay": "2.4s", "--float-dur": "6.4s" } as React.CSSProperties}
            >
              <Medal className="size-4 text-orange-400 lg:size-4.5" weight="fill" />
            </span>
            <span
              className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 hidden size-8 items-center justify-center rounded-2xl shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)] backdrop-blur-md xl:flex"
              style={{ "--float-delay": "1.2s", "--float-dur": "5.6s" } as React.CSSProperties}
            >
              <Coins className="size-3.5 text-[var(--brand-mint)]" weight="fill" />
            </span>
          </div>
          <span className="block h-1.5 w-full rounded-full bg-gradient-to-r from-white/6 via-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] to-white/6 shadow-[0_8px_22px_-6px_color-mix(in_oklab,var(--brand-mint)_45%,transparent)]" />
          <span className="mx-auto mt-1 block h-2 w-3/4 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)] blur-md" />
        </div>

        {/* linha do tempo na base */}
        <div className="absolute inset-x-[6%] bottom-[7%] h-8">
          <span className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <svg
            className="absolute top-1/2 left-0 h-2 w-full -translate-y-1/2 opacity-70"
            viewBox="0 0 400 8"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0 4 H400"
              className="hero-trace"
              stroke="color-mix(in oklab, var(--brand-mint) 55%, transparent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {PIPS.map((pip, index) =>
            pip.check ? (
              <span
                key={index}
                className="hero-podium-glow absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={
                  {
                    left: pip.left,
                    "--podium-delay": `${pip.delay}s`,
                  } as React.CSSProperties
                }
              >
                <CheckCircle
                  className="size-4 text-[var(--brand-green)] drop-shadow-[0_0_6px_color-mix(in_oklab,var(--brand-green)_70%,transparent)] lg:size-4.5"
                  weight="fill"
                />
              </span>
            ) : (
              <span
                key={index}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: pip.left }}
              >
                <span className="block size-1.5 rounded-full bg-white/20 lg:size-2" />
                <span
                  className="arena-twinkle absolute inset-0 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-cyan)_50%,transparent)]"
                  style={
                    {
                      "--twinkle-delay": `${pip.delay}s`,
                      "--twinkle-dur": "3.6s",
                      "--twinkle-opacity": 0.95,
                    } as React.CSSProperties
                  }
                />
              </span>
            ),
          )}
        </div>

        {/* chips flutuantes */}
        <FloatChip
          icon={<Trophy className="size-3 text-[#04222A]" weight="fill" />}
          label="Concluídas"
          value="Hall de conquistas"
          className="top-[6%] right-[3%]"
          delay={0.6}
          duration={7.6}
        />
        <FloatChip
          icon={<Coins className="size-3 text-[#04222A]" weight="fill" />}
          label="Prêmios recebidos"
          value="Direto na carteira"
          className="right-[8%] bottom-[24%] hidden lg:flex"
          delay={2.2}
          duration={8.4}
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
 * Fantasma da estante de conquistas: a prateleira principal (troféu de
 * ouro + medalha de prata), a prateleira do bronze e a linha do tempo.
 */
export function HistoryHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="66%">
      {/* prateleira principal */}
      <div className="hero-float absolute top-[16%] right-[12%] w-[clamp(170px,20vw,240px)]">
        <span className="flex items-end justify-center gap-4">
          <GBone delay={120} className="size-10 rounded-2xl lg:size-11" />
          <span className="relative">
            <span className="hero-pulse-ring absolute -inset-3 rounded-full bg-white/8" />
            <GBone className="size-13 rounded-2xl lg:size-14 xl:size-16" />
          </span>
        </span>
        {/* prateleira de vidro */}
        <span className="mt-2 block h-1 w-full rounded-full bg-white/12" />
      </div>

      {/* prateleira do bronze */}
      <div className="hero-float absolute top-[47%] right-[40%] w-[clamp(120px,14vw,170px)]">
        <span className="flex items-end justify-center gap-3">
          <GBone delay={220} className="size-9 rounded-2xl lg:size-10" />
          <GBone delay={280} faint className="size-8 rounded-2xl" />
        </span>
        <span className="mt-2 block h-1 w-full rounded-full bg-white/10" />
      </div>

      {/* linha do tempo na base */}
      <div className="absolute inset-x-[6%] bottom-[7%] h-8">
        <span className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/20 to-white/10" />
        {[14, 34, 54, 74, 92].map((left, index) => (
          <GBone
            key={index}
            delay={index * 100}
            faint={index > 2}
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${left}%` }}
          />
        ))}
      </div>

      {/* chip de resumo */}
      <GPanel
        className="absolute top-[8%] right-[46%] flex items-center gap-1.5 px-2.5 py-1.5"
        floatDelay={1.4}
        floatDur={7.6}
      >
        <GBone delay={160} className="size-3.5 shrink-0 rounded-full" />
        <GBone delay={220} className="h-2 w-14 rounded-full" />
      </GPanel>
    </VizGhost>
  )
}
