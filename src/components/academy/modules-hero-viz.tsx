import {
  ArrowsDownUp,
  Sparkle,
  SquaresFour,
  Stack,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Módulos — "empilhando conhecimento":
 * aurora cyan + âmbar, parede de blocos de módulo subindo em cascata
 * (3 níveis em pirâmide), um bloco flutuante descendo do guindaste para
 * se encaixar no vão do topo, numerinhos de ordem na base, sparkles,
 * partículas e cometa. CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "18%", top: "12%", size: 11, delay: 0, dur: 3.6, color: "cyan", lgOnly: false },
  { left: "44%", top: "7%", size: 9, delay: 1.4, dur: 4.4, color: "amber", lgOnly: true },
  { left: "68%", top: "18%", size: 13, delay: 2.2, dur: 3.4, color: "cyan", lgOnly: false },
  { left: "88%", top: "10%", size: 9, delay: 0.7, dur: 4.8, color: "amber", lgOnly: false },
  { left: "32%", top: "24%", size: 8, delay: 3, dur: 3.8, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "20%", bottom: "30%", size: 3, delay: 0.4, dur: 5.6, x: 12, opacity: 0.8 },
  { left: "38%", bottom: "26%", size: 2, delay: 2, dur: 6.6, x: -12, opacity: 0.6 },
  { left: "56%", bottom: "32%", size: 3, delay: 1.2, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "74%", bottom: "28%", size: 2, delay: 3.4, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "88%", bottom: "34%", size: 3, delay: 2.6, dur: 5.8, x: 8, opacity: 0.75 },
] as const

type BlockTone = "cyan" | "mint" | "violet"

const TONE_CLASSES: Record<BlockTone, string> = {
  cyan: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] to-[color-mix(in_oklab,var(--brand-cyan)_7%,transparent)]",
  mint: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_24%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_7%,transparent)]",
  violet:
    "bg-gradient-to-b from-[color-mix(in_oklab,#8b5cf6_26%,transparent)] to-[color-mix(in_oklab,#8b5cf6_8%,transparent)]",
}

export function ModulesHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora cyan + âmbar em deriva */}
        <span className="arena-aurora absolute -top-14 right-[10%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[42%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#fbbf24_18%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_60%_70%,#000_30%,transparent_80%)]" />

        {/* feixe de luz */}
        <div className="absolute inset-y-0 left-1/4 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
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

        {/* sparkles cintilando */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.color === "amber"
                ? "text-amber-300"
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

        {/* partículas ascendentes */}
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className={cn(
              "arena-particle absolute rounded-full",
              index % 2 === 0
                ? "bg-[var(--brand-mint)]"
                : "bg-[var(--brand-cyan)]",
            )}
            style={
              {
                left: particle.left,
                bottom: particle.bottom,
                width: particle.size,
                height: particle.size,
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== parede de blocos de módulo (3 níveis, pirâmide) ===== */}
        <div className="absolute inset-x-[6%] bottom-0 flex flex-col items-center gap-1.5 lg:gap-2">
          {/* nível do topo: 1 bloco + vão esperando a peça */}
          <div className="flex items-end gap-1.5 lg:gap-2">
            <ModuleBlock
              tone="mint"
              delay={1.2}
              glow
              className="h-9 w-[clamp(70px,8.5vw,112px)] lg:h-11"
            />
            {/* vão do encaixe */}
            <div
              className="arena-podium relative h-9 w-[clamp(70px,8.5vw,112px)] rounded-xl border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_6%,transparent)] lg:h-11"
              style={{ "--rise-delay": "1.2s" } as React.CSSProperties}
            >
              {/* bloco flutuante se encaixando, pendurado no guindaste */}
              <div className="arena-tilt absolute bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2 lg:bottom-[calc(100%+20px)]">
                {/* guindaste: linha vertical fina + gancho */}
                <span className="absolute bottom-full left-1/2 h-[clamp(48px,10vh,110px)] w-px -translate-x-1/2 bg-gradient-to-t from-[color-mix(in_oklab,var(--brand-cyan)_55%,transparent)] to-transparent" />
                <span className="absolute bottom-[calc(100%-5px)] left-1/2 size-2.5 -translate-x-1/2 rounded-b-[4px] border-x border-b border-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
                {/* anel pulsante do encaixe */}
                <span className="hero-pulse-ring absolute -inset-3 rounded-2xl bg-[color-mix(in_oklab,var(--brand-mint)_30%,transparent)]" />
                <span className="bg-gradient-custom relative flex h-8 w-[clamp(60px,7vw,96px)] items-center justify-center rounded-xl text-[#04222A] shadow-[0_14px_40px_-10px_rgba(31,254,200,0.55)] lg:h-10">
                  <SquaresFour className="size-4 lg:size-5" weight="fill" />
                </span>
              </div>
            </div>
          </div>

          {/* nível do meio: 2 blocos */}
          <div className="flex items-end gap-1.5 lg:gap-2">
            <ModuleBlock
              tone="violet"
              delay={0.8}
              glow
              glowTone="violet"
              className="h-10 w-[clamp(84px,10.5vw,140px)] lg:h-12"
            />
            <ModuleBlock
              tone="cyan"
              delay={1}
              glow
              glowTone="cyan"
              className="h-10 w-[clamp(84px,10.5vw,140px)] lg:h-12"
            />
          </div>

          {/* base: 3 blocos com numerinhos de ordem */}
          <div className="flex items-end gap-1.5 lg:gap-2">
            <ModuleBlock
              tone="cyan"
              delay={0.2}
              chip="#1"
              className="h-12 w-[clamp(58px,7vw,94px)] lg:h-14"
            />
            <ModuleBlock
              tone="mint"
              delay={0.4}
              chip="#2"
              className="h-12 w-[clamp(58px,7vw,94px)] lg:h-14"
            />
            <ModuleBlock
              tone="violet"
              delay={0.6}
              chip="#3"
              className="h-12 w-[clamp(58px,7vw,94px)] lg:h-14"
            />
          </div>
        </div>

        {/* chips flutuantes */}
        <FloatChip
          icon={<Stack className="size-3 text-[#04222A]" weight="fill" />}
          label="Academia"
          value="6 módulos"
          className="top-[12%] right-[6%]"
          delay={0.8}
          duration={7.6}
        />
        <FloatChip
          icon={<ArrowsDownUp className="size-3 text-[#04222A]" weight="bold" />}
          label="Reordenação"
          value="Ordem atualizada"
          className="top-[38%] right-[4%] hidden lg:flex"
          delay={2}
          duration={8.4}
        />
      </div>
    </div>
  )
}

function ModuleBlock({
  tone,
  delay,
  className,
  glow = false,
  glowTone = "gradient",
  chip,
}: {
  tone: BlockTone
  delay: number
  className?: string
  glow?: boolean
  glowTone?: "gradient" | "cyan" | "violet"
  chip?: string
}) {
  return (
    <div
      className={cn(
        "arena-podium relative overflow-hidden rounded-xl ring-1 ring-white/10",
        TONE_CLASSES[tone],
        className,
      )}
      style={{ "--rise-delay": `${delay}s` } as React.CSSProperties}
    >
      {glow && (
        <span
          className={cn(
            "hero-podium-glow absolute inset-x-1 top-0 h-[3px] rounded-full",
            glowTone === "gradient" && "bg-gradient-custom",
            glowTone === "cyan" && "bg-[var(--brand-cyan)]",
            glowTone === "violet" && "bg-[#a78bfa]",
          )}
          style={{ "--podium-delay": `${delay}s` } as React.CSSProperties}
        />
      )}
      {/* brilho varrendo o bloco */}
      <span
        className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{ "--shine-delay": `${1.6 + delay * 2}s` } as React.CSSProperties}
      />
      {chip && (
        <span className="absolute bottom-1 left-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-black text-white/75 ring-1 ring-white/10 backdrop-blur-sm">
          {chip}
        </span>
      )}
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
        "arena-tilt bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md",
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
 * Fantasma da parede de módulos: os três níveis da pirâmide (com o vão
 * do topo esperando a peça), o bloco pendurado no guindaste e os chips.
 */
export function ModulesHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="60%">
      <div className="absolute inset-x-[6%] bottom-0 flex flex-col items-center gap-1.5 lg:gap-2">
        {/* topo: bloco + vão do encaixe */}
        <div className="flex items-end gap-1.5 lg:gap-2">
          <GBone className="h-9 w-[clamp(70px,8.5vw,112px)] rounded-xl lg:h-11" />
          <span className="arena-podium h-9 w-[clamp(70px,8.5vw,112px)] rounded-xl border border-dashed border-white/15 lg:h-11" />
        </div>

        {/* meio: 2 blocos */}
        <div className="flex items-end gap-1.5 lg:gap-2">
          <GBone delay={120} className="h-10 w-[clamp(84px,10.5vw,140px)] rounded-xl lg:h-12" />
          <GBone delay={200} className="h-10 w-[clamp(84px,10.5vw,140px)] rounded-xl lg:h-12" />
        </div>

        {/* base: 3 blocos */}
        <div className="flex items-end gap-1.5 lg:gap-2">
          {[0, 1, 2].map((block) => (
            <GBone
              key={block}
              delay={280 + block * 90}
              className="h-12 w-[clamp(58px,7vw,94px)] rounded-xl lg:h-14"
            />
          ))}
        </div>
      </div>

      {/* bloco pendurado no guindaste */}
      <div className="hero-float absolute bottom-[36%] left-1/2 -translate-x-1/2">
        <span className="absolute bottom-full left-1/2 h-[clamp(48px,10vh,110px)] w-px -translate-x-1/2 bg-gradient-to-t from-white/25 to-transparent" />
        <span className="hero-pulse-ring absolute -inset-3 rounded-2xl bg-white/8" />
        <GBone className="h-8 w-[clamp(60px,7vw,96px)] rounded-xl lg:h-10" />
      </div>

      {/* chips */}
      <GChip className="absolute top-[12%] right-[8%]" floatDelay={0.8} floatDur={7.4} />
      <GChip
        className="absolute top-[38%] right-[38%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
