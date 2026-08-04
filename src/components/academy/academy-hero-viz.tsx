import {
  CheckCircle,
  GraduationCap,
  Medal,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero da Academia — formatura do clipador:
 * aurora ciano + violeta, capelo de formatura central com tassel
 * balançando, anel cônico e pulso, diploma enrolado flutuando,
 * pilha de livros subindo com glow, estrelinhas de conquista,
 * chips de aula concluída/certificado, partículas e cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const VIOLET = "#8b5cf6"

const SPARKLES = [
  { left: "20%", top: "10%", size: 12, delay: 0, dur: 3.6, color: "mint", lgOnly: false },
  { left: "44%", top: "18%", size: 9, delay: 1.3, dur: 4.4, color: "violet", lgOnly: true },
  { left: "68%", top: "8%", size: 13, delay: 2.2, dur: 3.4, color: "cyan", lgOnly: false },
  { left: "88%", top: "22%", size: 9, delay: 0.7, dur: 4.6, color: "violet", lgOnly: false },
  { left: "32%", top: "30%", size: 8, delay: 3.1, dur: 3.8, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "24%", bottom: "28%", size: 3, delay: 0.4, dur: 5.6, x: 12, opacity: 0.8, tone: "mint" },
  { left: "40%", bottom: "24%", size: 2, delay: 2, dur: 6.6, x: -12, opacity: 0.6, tone: "violet" },
  { left: "56%", bottom: "32%", size: 3, delay: 1.2, dur: 5.4, x: 10, opacity: 0.85, tone: "cyan" },
  { left: "74%", bottom: "26%", size: 2, delay: 3.4, dur: 6.2, x: -8, opacity: 0.6, tone: "mint" },
  { left: "88%", bottom: "34%", size: 3, delay: 2.6, dur: 5.8, x: 8, opacity: 0.75, tone: "violet" },
] as const

const BOOKS = [
  {
    tone: "violet",
    className:
      "translate-x-1 -rotate-2 bg-gradient-to-r from-[color-mix(in_oklab,#8b5cf6_38%,transparent)] via-[color-mix(in_oklab,#8b5cf6_18%,transparent)] to-[color-mix(in_oklab,#8b5cf6_30%,transparent)]",
    delay: 0.65,
  },
  {
    tone: "mint",
    className:
      "-translate-x-1 rotate-1 bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-mint)_34%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_26%,transparent)]",
    delay: 0.45,
  },
  {
    tone: "cyan",
    className:
      "translate-x-0.5 bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_36%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_15%,transparent)] to-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)]",
    delay: 0.25,
  },
] as const

export function AcademyHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora ciano + violeta em deriva */}
        <span className="arena-aurora absolute -top-14 right-[8%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[38%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#8b5cf6_24%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6s" }}
        />

        {/* grid em pan, sutil */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_65%_55%,#000_28%,transparent_78%)]" />

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

        {/* estrelinhas de conquista */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.color === "mint" && "text-[var(--brand-mint)]",
              sparkle.color === "cyan" && "text-[var(--brand-cyan)]",
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                color: sparkle.color === "violet" ? VIOLET : undefined,
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
              particle.tone === "mint" && "bg-[var(--brand-mint)]",
              particle.tone === "cyan" && "bg-[var(--brand-cyan)]",
            )}
            style={
              {
                left: particle.left,
                bottom: particle.bottom,
                width: particle.size,
                height: particle.size,
                backgroundColor:
                  particle.tone === "violet" ? VIOLET : undefined,
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* capelo de formatura central com anéis e tassel */}
        <div
          className="arena-tilt absolute top-[24%] right-[24%] xl:right-[26%]"
          style={{ "--float-dur": "6.8s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-mint)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,#8b5cf6_65%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          <span className="bg-gradient-custom relative flex size-14 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-16 xl:size-18">
            <GraduationCap className="size-7 lg:size-8 xl:size-9" weight="fill" />
            {/* tassel: cordinha pendurada balançando */}
            <span
              className="arena-tilt absolute -top-1.5 -right-1 origin-top"
              style={
                {
                  "--float-dur": "9s",
                  "--float-delay": "0.8s",
                } as React.CSSProperties
              }
            >
              <span className="block h-7 w-[2px] rounded-full bg-gradient-to-b from-[var(--brand-mint)] via-[var(--brand-cyan)] to-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] lg:h-8" />
              <span className="-ml-[3px] block size-2 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_10px_2px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
            </span>
          </span>
        </div>

        {/* diploma enrolado flutuando */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[13%] right-[7%] flex items-center rounded-xl px-3 py-2.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={
            {
              "--float-delay": "1.2s",
              "--float-dur": "7.4s",
            } as React.CSSProperties
          }
        >
          <span className="relative h-2.5 w-16 rounded-full bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-mint)_80%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-[color-mix(in_oklab,#8b5cf6_70%,transparent)] lg:w-20">
            {/* laço central do rolinho */}
            <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-cyan)_55%,transparent)] ring-2 ring-[#050f1c]/70" />
          </span>
        </div>

        {/* pilha de livros subindo com glow no topo */}
        <div className="absolute right-[42%] bottom-[9%] flex flex-col items-center xl:right-[44%]">
          <span
            className="hero-podium-glow bg-gradient-custom relative z-10 mb-0.5 h-[3px] w-12 rounded-full"
            style={{ "--podium-delay": "0.9s" } as React.CSSProperties}
          />
          {BOOKS.map((book) => (
            <span
              key={book.tone}
              className={cn(
                "arena-podium mt-[3px] h-3 w-16 rounded-md ring-1 ring-white/10",
                book.className,
              )}
              style={{ "--rise-delay": `${book.delay}s` } as React.CSSProperties}
            />
          ))}
        </div>

        {/* chips de conquista */}
        <FloatChip
          icon={<CheckCircle className="size-3.5 text-emerald-400" weight="fill" />}
          label="Academia"
          value="Aula concluída"
          className="top-[58%] right-[9%]"
          delay={0.6}
          duration={7.8}
        />
        <FloatChip
          icon={<Medal className="size-3.5 text-amber-400" weight="fill" />}
          label="Conquista"
          value="+1 certificado"
          className="top-[10%] right-[40%] hidden lg:flex"
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
        {icon}
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  )
}

/**
 * Fantasma da formatura: o capelo central com anel orbitando, o diploma
 * flutuando, a pilha de livros subindo e os chips de conquista.
 */
export function AcademyHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="65%">
      {/* capelo central */}
      <div
        className="hero-float absolute top-[24%] right-[24%] xl:right-[26%]"
        style={{ "--float-dur": "7.2s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-white/15" />
        <GBone className="size-14 rounded-2xl lg:size-16 xl:size-18" />
        {/* tassel */}
        <GBone delay={200} className="absolute -top-1.5 -right-1 size-2 rounded-full" />
      </div>

      {/* diploma flutuando */}
      <GPanel
        className="absolute top-[13%] right-[7%] flex items-center gap-2 px-3 py-2.5"
        floatDelay={0.6}
        floatDur={7.8}
      >
        <GBone delay={120} className="h-6 w-16 rounded-md" />
        <GBone delay={180} className="size-2.5 rounded-full" />
      </GPanel>

      {/* pilha de livros */}
      <div className="absolute right-[42%] bottom-[9%] flex flex-col items-center gap-0.5 xl:right-[44%]">
        <span
          className="hero-podium-glow mb-0.5 h-[3px] w-12 rounded-full bg-white/25"
          style={{ "--podium-delay": "0.9s" } as React.CSSProperties}
        />
        {[0, 1, 2].map((book) => (
          <GBone
            key={book}
            delay={book * 140}
            faint={book === 2}
            className="arena-podium h-3 w-16 rounded-sm lg:h-3.5 lg:w-20"
            style={{ ["--rise-delay" as string]: `${0.3 + book * 0.2}s` }}
          />
        ))}
      </div>

      {/* chips de conquista */}
      <GChip className="absolute top-[62%] right-[8%]" floatDelay={1.2} floatDur={7.6} />
      <GChip
        className="absolute top-[42%] right-[3%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.4}
        delay={160}
      />
    </VizGhost>
  )
}
