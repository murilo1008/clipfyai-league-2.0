import {
  CheckCircle,
  Lightning,
  PixLogo,
  Sparkle,
  Trophy,
  TrendUp,
  Wallet,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero do Financeiro do CLIPADOR — "DIA DE PAGAMENTO":
 * a carteira do clipador no exato momento em que o dinheiro cai. Card de saldo
 * central (valor ghost em gradiente com barra de crescimento se preenchendo),
 * três notificações de PIX subindo empilhadas com stagger, moeda-raio dourada
 * com anel orbital ancorada no canto e chip "Pagamento processado" pulsando no
 * rodapé. Ambiente com aurora cyan+mint, grid sutil, feixe varrendo, moedas
 * flutuando e um cometa. Composição horizontal e baixa — cabe na faixa do hero.
 * Padrão ANCORADO: tudo que é temático é filho do âncora central com clamp().
 * CSS puro (vocabulário do globals), aria-hidden, reduced-motion ok.
 */

const GOLD = "#f5b73b"

/** Notificações de pagamento caindo na carteira (rise com stagger). */
const NOTIFICATIONS = [
  { icon: PixLogo, label: "PIX recebido", amount: "+R$ 350", delay: 0.45 },
  { icon: Trophy, label: "Prêmio diário", amount: "+R$ 120", delay: 0.75 },
  { icon: Sparkle, label: "Bônus", amount: "+R$ 80", delay: 1.05 },
] as const

const SPARKLES = [
  { left: "20%", top: "14%", size: 11, delay: 0.2, dur: 3.8, gold: false, lgOnly: false },
  { left: "46%", top: "8%", size: 9, delay: 1.4, dur: 4.4, gold: true, lgOnly: true },
  { left: "88%", top: "12%", size: 12, delay: 2.3, dur: 3.4, gold: false, lgOnly: false },
  { left: "28%", top: "78%", size: 9, delay: 0.9, dur: 4.6, gold: true, lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3, dur: 3.6, gold: false, lgOnly: false },
] as const

const PARTICLES = [
  { left: "24%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 12, mint: true },
  { left: "46%", bottom: "10%", size: 2, delay: 2.1, dur: 6.8, x: -10, mint: false },
  { left: "70%", bottom: "14%", size: 3, delay: 1.3, dur: 5.4, x: 8, mint: true },
] as const

/** Moedas douradas flutuando no ambiente (hero-float). */
const FLOATING_COINS = [
  { left: "18%", top: "26%", size: 10, delay: 0.6, dur: 7.6, lgOnly: false },
  { left: "38%", top: "64%", size: 8, delay: 2.4, dur: 8.4, lgOnly: true },
  { left: "90%", top: "44%", size: 9, delay: 1.5, dur: 7 },
] as const

export function WalletPaydayHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora cyan + mint (assinatura da carteira) */}
        <span className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_20%,transparent),transparent_66%)] blur-2xl"
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
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10.5s",
              "--comet-delay": "2.6s",
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

        {/* moedas douradas flutuando */}
        {FLOATING_COINS.map((coin, index) => (
          <span
            key={index}
            className={cn(
              "hero-float absolute rounded-full ring-1 ring-[#f5b73b]/60",
              "lgOnly" in coin && coin.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: coin.left,
                top: coin.top,
                width: coin.size,
                height: coin.size,
                background:
                  "radial-gradient(circle at 35% 30%, #ffe9b0, #f5b73b 60%, #b97e12)",
                "--float-delay": `${coin.delay}s`,
                "--float-dur": `${coin.dur}s`,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== A CARTEIRA NO DIA DE PAGAMENTO — âncora central ===== */}
        <div className="absolute top-1/2 right-[8%] w-[clamp(250px,28vw,360px)] -translate-y-1/2">
          {/* extrato fantasma atrás (profundidade) */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-white/[0.04] ring-1 ring-white/8"
            style={{ transform: "rotate(-4deg) translate(-12px, 12px)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden rounded-2xl bg-white/[0.025] ring-1 ring-white/5 lg:block"
            style={{ transform: "rotate(-8deg) translate(-24px, 22px)" }}
          />

          {/* card de saldo flutuando */}
          <div
            className="arena-tilt relative"
            style={{ "--float-dur": "8.5s" } as React.CSSProperties}
          >
            <div className="relative flex rotate-1 flex-col gap-2.5 rounded-2xl bg-[#0a1c2b]/90 p-3.5 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] backdrop-blur-md lg:p-4">
              {/* hairline da marca no topo */}
              <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] to-transparent" />

              {/* cabeçalho: saldo disponível */}
              <div className="flex items-center gap-2.5">
                <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-xl text-[#04222A] lg:size-9">
                  <Wallet className="size-4 lg:size-4.5" weight="fill" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="text-muted-foreground text-[8px] font-semibold tracking-[0.16em] uppercase">
                    Saldo disponível
                  </span>
                  <span className="text-gradient font-mono text-lg font-black tracking-tight tabular-nums lg:text-xl">
                    R$ 1.550
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_18%,transparent)] px-2 py-0.5 text-[8px] font-bold tracking-[0.08em] text-emerald-300 uppercase">
                  <TrendUp className="size-2.5" weight="bold" />
                  +R$ 550 hoje
                </span>
              </div>

              {/* barra de crescimento do saldo */}
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className="hero-clip-progress bg-gradient-custom block h-full rounded-full"
                  style={
                    {
                      "--clip-dur": "4.6s",
                      "--clip-delay": "0.3s",
                    } as React.CSSProperties
                  }
                />
              </span>

              {/* notificações de pagamento subindo com stagger */}
              <div className="flex flex-col gap-1.5">
                {NOTIFICATIONS.map((notification, index) => {
                  const NotificationIcon = notification.icon
                  return (
                    <div
                      key={index}
                      className="arena-podium flex items-center gap-2 rounded-lg bg-white/[0.05] px-2 py-1.5 ring-1 ring-white/10"
                      style={
                        {
                          "--rise-delay": `${notification.delay}s`,
                        } as React.CSSProperties
                      }
                    >
                      <span className="bg-gradient-custom flex size-5 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                        <NotificationIcon className="size-3" weight="fill" />
                      </span>
                      <span className="text-muted-foreground min-w-0 flex-1 truncate text-[9px] font-semibold tracking-[0.1em] uppercase">
                        {notification.label}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-emerald-300 tabular-nums lg:text-[11px]">
                        {notification.amount}
                      </span>
                      <CheckCircle
                        className="size-3 shrink-0 text-emerald-400"
                        weight="fill"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* moeda-raio dourada com anel orbital — ancorada no canto */}
            <div className="absolute -top-4 -right-3 lg:-top-5 lg:-right-4">
              <span
                className="hero-pulse-ring absolute -inset-3 rounded-full"
                style={{
                  backgroundColor: `color-mix(in oklab, ${GOLD} 36%, transparent)`,
                }}
              />
              <span
                className="arena-ring absolute -inset-1.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]"
                style={{
                  background: `conic-gradient(from 0deg, transparent 12%, color-mix(in oklab, ${GOLD} 75%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-mint) 60%, transparent) 72%, transparent 88%)`,
                }}
              />
              <span className="relative flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ffe9b0,#f5b73b)] text-[#3b2a00] shadow-[0_14px_40px_-10px_rgba(245,183,59,0.6)] ring-1 ring-[#ffe9b0]/70 lg:size-10">
                <Lightning className="size-4.5 lg:size-5" weight="fill" />
              </span>
            </div>

            {/* chip de pagamento processado — ancorado no pé do card */}
            <div
              className="hero-float absolute -bottom-4 left-4 flex items-center gap-1.5 rounded-xl bg-[#0a1c2b]/90 px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-green)_30%,transparent)] backdrop-blur-md"
              style={
                {
                  "--float-delay": "0.8s",
                  "--float-dur": "7.2s",
                } as React.CSSProperties
              }
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--brand-green)]" />
              </span>
              <span className="text-[9px] font-bold tracking-[0.12em] text-emerald-300 uppercase">
                Pagamento processado
              </span>
            </div>
          </div>
        </div>

        {/* chip ambiente — PIX na conta */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[10%] right-[42%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:right-[48%]"
          style={
            {
              "--float-delay": "0.4s",
              "--float-dur": "7.6s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <PixLogo className="size-3 text-[#04222A]" weight="fill" />
            </span>
            PIX na conta
          </span>
          <span className="text-foreground text-xs font-bold">Em até 2 dias úteis</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da carteira no dia de pagamento: extratos empilhados atrás,
 * card de saldo com as notificações subindo, a moeda-raio no canto e o
 * chip de pagamento processado no pé.
 */
export function WalletPaydayHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[8%] w-[clamp(250px,28vw,360px)] -translate-y-1/2">
        {/* extratos fantasma atrás */}
        <GBone
          faint
          className="absolute inset-0 rounded-2xl"
          style={{ transform: "rotate(-3deg) translate(-10px, 10px)" }}
        />
        <GBone
          faint
          delay={120}
          className="absolute inset-0 hidden rounded-2xl lg:block"
          style={{ transform: "rotate(-7deg) translate(-20px, 20px)" }}
        />

        {/* card de saldo */}
        <GPanel floatDur={8.4} className="relative flex flex-col gap-3 p-3.5">
          <span className="flex items-center gap-2.5">
            <GBone className="size-8 shrink-0 rounded-xl lg:size-9" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <GBone delay={70} className="h-2 w-20 rounded-full" />
              <GBone delay={130} className="h-3 w-28 rounded-full" />
            </span>
          </span>

          {/* barra de crescimento do saldo */}
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
            <span
              className="hero-clip-progress block h-full rounded-full bg-white/35"
              style={{ "--clip-dur": "5.2s" } as React.CSSProperties}
            />
          </span>

          {/* notificações de pagamento */}
          {[0, 1, 2].map((row) => (
            <span
              key={row}
              className="arena-podium flex items-center gap-2"
              style={
                { "--rise-delay": `${0.3 + row * 0.25}s` } as React.CSSProperties
              }
            >
              <GBone delay={row * 110} className="size-5 shrink-0 rounded-md" />
              <GLines
                widths={["100%", "56%"]}
                delay={row * 110 + 60}
                className="min-w-0 flex-1"
              />
              <GBone delay={row * 110 + 160} className="h-2.5 w-10 rounded-full" />
            </span>
          ))}
        </GPanel>

        {/* moeda-raio dourada */}
        <div className="absolute -top-4 -right-3 lg:-top-5 lg:-right-4">
          <span className="arena-ring absolute -inset-1.5 rounded-full border border-dashed border-white/15" />
          <GBone delay={180} className="size-9 rounded-full lg:size-10" />
        </div>

        {/* chip de pagamento processado */}
        <GPanel
          className="absolute -bottom-4 left-4 flex items-center gap-1.5 px-2.5 py-1.5"
          floatDelay={0.8}
          floatDur={7.2}
        >
          <GBone delay={220} className="size-3.5 shrink-0 rounded-full" />
          <GBone delay={280} className="h-2 w-20 rounded-full" />
        </GPanel>
      </div>
    </VizGhost>
  )
}
