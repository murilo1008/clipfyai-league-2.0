import {
  CheckCircle,
  Coins,
  HandCoins,
  PixLogo,
  Sparkle,
  Wallet,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero do Financeiro — cofre da liga:
 * aurora mint+dourada, cofre/carteira central com anéis orbitando,
 * pilhas de moedas subindo com brilho, moedas caindo, fluxo de PIX
 * com traço animado, gráfico de dinheiro pulsando e chips de
 * pagamento. CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "22%", top: "12%", size: 11, delay: 0, dur: 3.6, gold: true, lgOnly: false },
  { left: "50%", top: "8%", size: 9, delay: 1.4, dur: 4.4, gold: false, lgOnly: true },
  { left: "72%", top: "18%", size: 13, delay: 2.2, dur: 3.4, gold: true, lgOnly: false },
  { left: "88%", top: "10%", size: 9, delay: 0.7, dur: 4.8, gold: false, lgOnly: false },
  { left: "36%", top: "26%", size: 8, delay: 3, dur: 3.8, gold: false, lgOnly: true },
] as const

const PARTICLES = [
  { left: "24%", bottom: "26%", size: 3, delay: 0.4, dur: 5.6, x: 12, gold: true },
  { left: "44%", bottom: "22%", size: 2, delay: 2, dur: 6.6, x: -12, gold: false },
  { left: "62%", bottom: "30%", size: 3, delay: 1.2, dur: 5.4, x: 10, gold: true },
  { left: "80%", bottom: "24%", size: 2, delay: 3.4, dur: 6.2, x: -8, gold: false },
  { left: "92%", bottom: "32%", size: 3, delay: 2.6, dur: 5.8, x: 8, gold: true },
] as const

/** Moedas caindo em direção ao cofre (confetti circular dourado/mint). */
const FALLING_COINS = [
  { left: "30%", top: "18%", size: 7, delay: 0, dur: 6.4, x: 16, opacity: 0.85 },
  { left: "38%", top: "12%", size: 5, delay: 2.2, dur: 7.2, x: 10, opacity: 0.6 },
  { left: "48%", top: "16%", size: 6, delay: 4.1, dur: 6.8, x: -12, opacity: 0.75 },
  { left: "56%", top: "10%", size: 5, delay: 1.3, dur: 7.6, x: -8, opacity: 0.6 },
] as const

const MONEY_BARS = [
  { height: "36%", delay: 0, dur: 2.8 },
  { height: "58%", delay: 0.25, dur: 3.2 },
  { height: "44%", delay: 0.5, dur: 2.6 },
  { height: "82%", delay: 0.75, dur: 3.4 },
  { height: "64%", delay: 1, dur: 2.9 },
] as const

const GOLD = "#f5b73b"

export function FinancialHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora mint + dourada (assinatura do financeiro) */}
        <span className="arena-aurora absolute -top-14 right-[10%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[42%] bottom-[6%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f59e0b_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* grid sutil em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_70%_55%,#000_30%,transparent_78%)]" />

        {/* feixe de luz */}
        <div className="absolute inset-y-0 left-1/4 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-mint)_12%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,#f5b73b_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2.5s",
              "--comet-x": "-320px",
              "--comet-y": "220px",
              "--comet-angle": "-34deg",
            } as React.CSSProperties
          }
        />

        {/* sparkles ouro + mint */}
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

        {/* partículas subindo (dinheiro circulando) */}
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
                backgroundColor: particle.gold ? GOLD : "var(--brand-mint)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": 0.8,
              } as React.CSSProperties
            }
          />
        ))}

        {/* moedas caindo em direção ao cofre */}
        {FALLING_COINS.map((coin, index) => (
          <span
            key={index}
            className="arena-confetti absolute rounded-full ring-1 ring-[#f5b73b]/60"
            style={
              {
                left: coin.left,
                top: coin.top,
                width: coin.size,
                height: coin.size,
                background:
                  "radial-gradient(circle at 35% 30%, #ffe9b0, #f5b73b 60%, #b97e12)",
                "--confetti-delay": `${coin.delay}s`,
                "--confetti-dur": `${coin.dur}s`,
                "--confetti-x": `${coin.x}px`,
                "--confetti-rot": "220deg",
                "--confetti-opacity": coin.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* fluxo de PIX: traços fluindo do cofre para os chips */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 44 44 C 58 40, 66 30, 80 24"
            fill="none"
            stroke="color-mix(in oklab, var(--brand-mint) 45%, transparent)"
            strokeWidth="0.5"
            strokeDasharray="3 2.4"
            className="hero-trace"
          />
          <path
            d="M 44 50 C 60 54, 70 62, 84 64"
            fill="none"
            stroke="color-mix(in oklab, #f5b73b 45%, transparent)"
            strokeWidth="0.5"
            strokeDasharray="3 2.4"
            className="hero-trace"
            style={{ animationDelay: "-1.2s" }}
          />
        </svg>

        {/* cofre/carteira central com anéis */}
        <div
          className="arena-tilt absolute top-[38%] right-[48%] xl:right-[50%]"
          style={{ "--float-dur": "6.8s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,#f5b73b_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,#f5b73b_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-mint)_65%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          <span
            className="arena-ring absolute -inset-6 rounded-full"
            style={{ animationDuration: "13s" }}
          >
            <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#f5b73b] shadow-[0_0_8px_2px_color-mix(in_oklab,#f5b73b_60%,transparent)]" />
            <span className="absolute bottom-[10%] left-[12%] size-1 rounded-full bg-[var(--brand-mint)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]" />
          </span>
          <span className="bg-gradient-custom relative flex size-13 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(245,183,59,0.55)] lg:size-14 xl:size-16">
            <Wallet className="size-6 lg:size-7 xl:size-8" weight="fill" />
          </span>
        </div>

        {/* onda de impacto sob o cofre */}
        <div className="absolute bottom-[8%] left-[46%]">
          {[0, 1].map((index) => (
            <span
              key={index}
              className="arena-ripple absolute bottom-0 left-0 h-[clamp(28px,3.5vw,44px)] w-[clamp(130px,16vw,200px)] rounded-[100%] border border-[color-mix(in_oklab,#f5b73b_40%,transparent)]"
              style={
                {
                  marginLeft: "calc(clamp(130px, 16vw, 200px) / -2)",
                  "--ripple-dur": "4.5s",
                  "--ripple-delay": `${index * 2.2}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* pilhas de moedas subindo */}
        <div className="absolute bottom-[10%] left-[18%] flex items-end gap-3 lg:gap-4">
          {[
            { coins: 3, delay: 0.3 },
            { coins: 5, delay: 0.55 },
            { coins: 4, delay: 0.8 },
          ].map((stack, stackIndex) => (
            <div
              key={stackIndex}
              className="arena-podium flex flex-col-reverse items-center"
              style={{ "--rise-delay": `${stack.delay}s` } as React.CSSProperties}
            >
              {Array.from({ length: stack.coins }).map((_, coinIndex) => {
                const isTop = coinIndex === stack.coins - 1
                return (
                  <span
                    key={coinIndex}
                    className={cn(
                      "relative -mt-1 block h-2.5 w-10 overflow-hidden rounded-full ring-1 ring-[#b97e12]/60 first:mt-0 lg:h-3 lg:w-12",
                    )}
                    style={{
                      background:
                        "linear-gradient(180deg, #ffe9b0 0%, #f5b73b 55%, #cf9418 100%)",
                      opacity: 0.55 + coinIndex * 0.1,
                    }}
                  >
                    {isTop && (
                      <span
                        className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                        style={
                          {
                            "--shine-delay": `${1.6 + stackIndex * 0.9}s`,
                          } as React.CSSProperties
                        }
                      />
                    )}
                  </span>
                )
              })}
            </div>
          ))}
        </div>

        {/* gráfico de dinheiro pulsando */}
        <div className="absolute right-[8%] bottom-[12%] flex h-14 items-end gap-1.5 lg:h-16">
          {MONEY_BARS.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "hero-bar w-2 rounded-t-md lg:w-2.5",
                index % 2 === 0
                  ? "bg-[color-mix(in_oklab,var(--brand-mint)_55%,transparent)]"
                  : "bg-[color-mix(in_oklab,#f5b73b_55%,transparent)]",
              )}
              style={
                {
                  height: bar.height,
                  "--bar-delay": `${bar.delay}s`,
                  "--bar-dur": `${bar.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* chips de pagamento */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[16%] right-[10%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-mint)_25%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "0.6s", "--float-dur": "7.4s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <PixLogo className="size-3 text-[#04222A]" weight="fill" />
            </span>
            PIX enviado
            <CheckCircle
              className="size-3 text-emerald-500 dark:text-emerald-400"
              weight="fill"
            />
          </span>
          <span className="text-foreground text-xs font-bold">
            Pagamento confirmado
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[6%] bottom-[36%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#f5b73b_30%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "2s", "--float-dur": "8.2s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffe9b0,#f5b73b)]">
              <HandCoins className="size-3 text-[#3b2a00]" weight="fill" />
            </span>
            Prêmios pagos
          </span>
          <span className="text-foreground text-xs font-bold">
            Carteiras abastecidas
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[54%] right-[38%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md xl:flex"
          style={{ "--float-delay": "3.2s", "--float-dur": "7s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <Coins className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Saldo da liga
          </span>
          <span className="text-foreground text-xs font-bold">
            Sob controle
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do caixa: o cofre central com anel orbitando, as pilhas de
 * moedas subindo, o gráfico de dinheiro pulsando e os chips de pagamento.
 */
export function FinancialCompetitionHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="70%">
      {/* cofre central */}
      <div
        className="hero-float absolute top-[38%] right-[48%] xl:right-[50%]"
        style={{ "--float-dur": "7s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-white/15" />
        <GBone className="size-13 rounded-2xl lg:size-14 xl:size-16" />
      </div>

      {/* pilhas de moedas */}
      <div className="absolute bottom-[10%] left-[18%] flex items-end gap-3 lg:gap-4">
        {[3, 5, 2].map((coins, stack) => (
          <span key={stack} className="flex flex-col-reverse gap-0.5">
            {Array.from({ length: coins }).map((_, coin) => (
              <GBone
                key={coin}
                delay={stack * 120 + coin * 70}
                className="arena-podium h-1.5 w-7 rounded-full lg:h-2 lg:w-9"
                style={{ ["--rise-delay" as string]: `${0.2 + coin * 0.12}s` }}
              />
            ))}
          </span>
        ))}
      </div>

      {/* gráfico de dinheiro */}
      <div className="absolute right-[8%] bottom-[12%] flex h-14 items-end gap-1.5 lg:h-16">
        {[38, 64, 48, 88, 56].map((height, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-2 rounded-t-md lg:w-2.5"
            style={
              {
                height: `${height}%`,
                "--bar-delay": `${index * 0.16}s`,
                "--bar-dur": "2.9s",
                "--shimmer-delay": `${index * 90}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* chips de pagamento */}
      <GChip className="absolute top-[16%] right-[10%]" floatDelay={0.9} floatDur={7.6} />
      <GChip
        className="absolute right-[6%] bottom-[36%]"
        floatDelay={2.4}
        floatDur={8.4}
        delay={150}
      />
    </VizGhost>
  )
}
