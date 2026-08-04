import { Crown, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Membros — "CRACHÁS DA EQUIPE":
 * três crachás de administrador pendurados em cordões (cordinha com
 * gradiente descendo do topo, clipe, furo, avatar fantasma, linhas de
 * nome e badge roxa "ADMIN" com Crown), balançando em durações e fases
 * diferentes como cordões reais. O crachá do meio é maior e está em
 * destaque: fundo mais claro, anel pulsante roxo atrás, anel cônico
 * roxo→cyan girando ao redor do avatar e Crown dourada no topo do
 * cordão. Chips glass, sparkles roxo/cyan, partículas e cometa. Tudo
 * ancorado num container central com clamp() — responsivo por
 * construção.
 */

/** Roxo dos admins — âncora cromática desta viz. */
const PURPLE = "#a855f7"

const SPARKLES = [
  { left: "18%", top: "11%", size: 11, delay: 0.2, dur: 3.8, purple: true, lgOnly: false },
  { left: "46%", top: "6%", size: 9, delay: 1.4, dur: 4.4, purple: false, lgOnly: true },
  { left: "88%", top: "13%", size: 12, delay: 2.2, dur: 3.4, purple: false, lgOnly: false },
  { left: "28%", top: "76%", size: 9, delay: 0.9, dur: 4.6, purple: true, lgOnly: true },
  { left: "92%", top: "70%", size: 10, delay: 3, dur: 3.6, purple: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "22%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 11, opacity: 0.8, purple: true },
  { left: "42%", bottom: "12%", size: 2, delay: 2.1, dur: 6.6, x: -10, opacity: 0.6, purple: false },
  { left: "62%", bottom: "18%", size: 3, delay: 1.2, dur: 5.4, x: 8, opacity: 0.85, purple: true },
  { left: "82%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -9, opacity: 0.6, purple: false },
  { left: "94%", bottom: "22%", size: 3, delay: 2.6, dur: 6, x: 10, opacity: 0.7, purple: true },
] as const

export function MembersHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora roxa + halo ciano */}
        <span
          className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${PURPLE} 30%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6.8s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[27%] w-24 overflow-visible">
          <span
            className="hero-sweep block h-full w-full"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${PURPLE} 14%, transparent), transparent)`,
            }}
          />
        </div>

        {/* cometa roxo */}
        <span
          className="arena-comet absolute top-[5%] right-[10%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${PURPLE} 70%, transparent), transparent)`,
              "--comet-dur": "10.8s",
              "--comet-delay": "2.2s",
              "--comet-x": "-300px",
              "--comet-y": "205px",
              "--comet-angle": "-35deg",
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
                color: sparkle.purple ? PURPLE : "var(--brand-cyan)",
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
                backgroundColor: particle.purple
                  ? PURPLE
                  : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== OS CRACHÁS — trio central ancorado ===== */}
        <div className="absolute top-1/2 right-[8%] w-[clamp(240px,27vw,330px)] -translate-y-1/2 lg:right-[11%]">
          <div className="flex items-start justify-center gap-2.5 lg:gap-3">
            <HangingBadge cordHeightClass="h-9" floatDur={7} floatDelay={0} />
            <CenterBadge />
            <HangingBadge
              cordHeightClass="h-12"
              floatDur={6.2}
              floatDelay={1.2}
              className="hidden lg:flex"
            />
          </div>
        </div>

        {/* ===== chips glass ===== */}
        <FloatChip
          icon={<Crown className="size-3" weight="fill" style={{ color: PURPLE }} />}
          label="Equipe"
          value="Admin Clipfy"
          className="top-[9%] right-[36%] lg:right-[43%]"
          delay={0.6}
          duration={7.6}
        />
        <FloatChip
          icon={<ShieldCheck className="size-3 text-[#04222A]" weight="fill" />}
          iconChip
          label="Permissão"
          value="Acesso total"
          className="bottom-[10%] left-[15%] hidden lg:flex"
          delay={2.2}
          duration={8.4}
        />
      </div>
    </div>
  )
}

/** Crachá lateral: cordão + clipe + cartão glass com furo, avatar e badge. */
function HangingBadge({
  cordHeightClass,
  floatDur,
  floatDelay,
  className,
}: {
  cordHeightClass: string
  floatDur: number
  floatDelay: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "arena-tilt flex w-[76px] origin-top flex-col items-center lg:w-[86px]",
        className,
      )}
      style={
        {
          "--float-dur": `${floatDur}s`,
          "--float-delay": `${floatDelay}s`,
        } as React.CSSProperties
      }
    >
      {/* cordinha */}
      <span
        className={cn("w-[3px] rounded-full", cordHeightClass)}
        style={{
          background: `linear-gradient(to bottom, transparent, color-mix(in oklab, ${PURPLE} 38%, transparent) 30%, color-mix(in oklab, ${PURPLE} 68%, transparent))`,
        }}
      />
      {/* clipe */}
      <span className="z-10 -mb-1 h-2.5 w-4 rounded-[4px] bg-[#0a1c2b] ring-1 ring-white/20" />
      {/* cartão */}
      <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-[#0a1c2b]/80 px-2.5 pt-2 pb-2.5 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/10 backdrop-blur-md">
        {/* furo */}
        <span className="size-2 rounded-full bg-[#050f1c] ring-1 ring-white/15" />
        {/* avatar fantasma */}
        <span
          className="size-8 rounded-full ring-1 ring-white/15"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklab, ${PURPLE} 42%, transparent), rgba(255,255,255,0.08) 55%, color-mix(in oklab, var(--brand-cyan) 36%, transparent))`,
          }}
        />
        {/* 2 linhas de nome */}
        <div className="flex w-full flex-col items-center gap-1">
          <span className="h-1.5 w-3/4 rounded-full bg-white/25" />
          <span className="h-1.5 w-1/2 rounded-full bg-white/12" />
        </div>
        {/* badge de função */}
        <RoleBadge />
      </div>
    </div>
  )
}

/** Crachá do meio — maior e em destaque, com Crown dourada no cordão. */
function CenterBadge() {
  return (
    <div
      className="arena-tilt flex w-[104px] origin-top flex-col items-center lg:w-[118px]"
      style={
        {
          "--float-dur": "8.5s",
          "--float-delay": "0.5s",
        } as React.CSSProperties
      }
    >
      {/* Crown dourada no topo do cordão */}
      <Crown
        weight="fill"
        className="-mb-0.5 size-4 text-amber-400 drop-shadow-[0_2px_6px_rgba(251,191,36,0.55)] lg:size-4.5"
      />
      {/* cordinha */}
      <span
        className="h-6 w-[3px] rounded-full"
        style={{
          background: `linear-gradient(to bottom, transparent, color-mix(in oklab, ${PURPLE} 45%, transparent) 25%, color-mix(in oklab, ${PURPLE} 75%, transparent))`,
        }}
      />
      {/* clipe */}
      <span className="z-10 -mb-1 h-2.5 w-4.5 rounded-[4px] bg-[#0a1c2b] ring-1 ring-white/25" />

      <div className="relative w-full">
        {/* anel pulsante roxo atrás do cartão */}
        <span
          className="hero-pulse-ring absolute -inset-4 rounded-full"
          style={{
            backgroundColor: `color-mix(in oklab, ${PURPLE} 36%, transparent)`,
          }}
        />
        {/* cartão em destaque (bg mais claro) */}
        <div
          className="relative flex w-full flex-col items-center gap-2.5 rounded-xl bg-[#13284a]/90 px-3 pt-2.5 pb-3 shadow-[0_26px_60px_-20px_rgba(168,85,247,0.45)] backdrop-blur-md"
          style={{
            boxShadow: `0 26px 60px -20px rgba(168,85,247,0.45), 0 0 0 1px color-mix(in oklab, ${PURPLE} 38%, transparent)`,
          }}
        >
          {/* hairline roxo→cyan no topo */}
          <span
            className="pointer-events-none absolute inset-x-3 top-0 h-px"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${PURPLE} 60%, transparent), color-mix(in oklab, var(--brand-cyan) 50%, transparent), transparent)`,
            }}
          />
          {/* furo */}
          <span className="size-2.5 rounded-full bg-[#050f1c] ring-1 ring-white/20" />
          {/* avatar fantasma com anel cônico roxo→cyan */}
          <span className="relative">
            <span
              className="arena-ring absolute -inset-1.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
              style={{
                background: `conic-gradient(from 0deg, transparent 10%, color-mix(in oklab, ${PURPLE} 78%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-cyan) 62%, transparent) 72%, transparent 90%)`,
              }}
            />
            <span
              className="relative block size-10 rounded-full ring-1 ring-white/20 lg:size-11"
              style={{
                background: `linear-gradient(135deg, color-mix(in oklab, ${PURPLE} 52%, transparent), rgba(255,255,255,0.1) 55%, color-mix(in oklab, var(--brand-cyan) 42%, transparent))`,
              }}
            />
          </span>
          {/* 2 linhas de nome */}
          <div className="flex w-full flex-col items-center gap-1">
            <span className="h-1.5 w-4/5 rounded-full bg-white/30" />
            <span className="h-1.5 w-1/2 rounded-full bg-white/15" />
          </div>
          {/* badge de função */}
          <RoleBadge highlight />
        </div>
      </div>
    </div>
  )
}

/** Badge roxa de função "ADMIN" com Crown. */
function RoleBadge({ highlight = false }: { highlight?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[7px] font-bold tracking-[0.16em] text-purple-300 uppercase ring-1"
      style={{
        backgroundColor: `color-mix(in oklab, ${PURPLE} ${highlight ? 26 : 18}%, transparent)`,
        borderColor: "transparent",
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${PURPLE} ${highlight ? 45 : 30}%, transparent)`,
      }}
    >
      <Crown className="size-2.5" weight="fill" />
      Admin
    </span>
  )
}

function FloatChip({
  icon,
  iconChip = false,
  label,
  value,
  className,
  delay,
  duration,
}: {
  icon: React.ReactNode
  iconChip?: boolean
  label: string
  value: string
  className?: string
  delay: number
  duration: number
}) {
  return (
    <div
      className={cn(
        "arena-tilt bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,#a855f7_26%,transparent)] backdrop-blur-md",
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
        {iconChip ? (
          <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
            {icon}
          </span>
        ) : (
          icon
        )}
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  )
}

/**
 * Fantasma do trio de crachás: os três cartões lado a lado (o terceiro
 * só em lg+) com avatar, nome e função, mais os chips de contexto.
 */
export function MembersHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[8%] w-[clamp(240px,27vw,330px)] -translate-y-1/2 lg:right-[11%]">
        <div className="flex items-start justify-center gap-2.5 lg:gap-3">
          {[0, 1, 2].map((badge) => (
            <GPanel
              key={badge}
              floatDelay={badge * 0.7}
              floatDur={7.2 + badge * 0.6}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 p-2.5",
                badge === 1 && "-translate-y-2",
                badge === 2 && "hidden lg:flex",
              )}
            >
              <GBone delay={badge * 120} className="size-9 rounded-full lg:size-10" />
              <GLines
                widths={["100%", "62%"]}
                delay={badge * 120 + 80}
                className="w-full items-center"
              />
              <GBone delay={badge * 120 + 220} className="h-2.5 w-12 rounded-full" />
            </GPanel>
          ))}
        </div>
      </div>

      {/* chips */}
      <GChip
        className="absolute top-[9%] right-[36%] lg:right-[43%]"
        floatDelay={0.6}
        floatDur={7.4}
      />
      <GChip
        className="absolute bottom-[12%] right-[10%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
