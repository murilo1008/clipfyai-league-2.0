import {
  Bell,
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Clock,
  Sparkle,
  Timer,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero do Cronograma — contagem regressiva:
 * aurora em deriva, anel de countdown girando com relógio pulsando no
 * centro, mini calendário com dias de competição cintilando, chip de
 * sino com ping, setas de timeline avançando, chips de datas, sparkles,
 * partículas e cometa. CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "24%", top: "10%", size: 11, delay: 0.3, dur: 3.8, color: "mint", lgOnly: false },
  { left: "52%", top: "6%", size: 9, delay: 1.6, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "44%", top: "30%", size: 8, delay: 2.4, dur: 3.4, color: "cyan", lgOnly: false },
  { left: "90%", top: "44%", size: 12, delay: 0.9, dur: 4.2, color: "mint", lgOnly: false },
  { left: "30%", top: "58%", size: 9, delay: 3.1, dur: 3.6, color: "mint", lgOnly: true },
] as const

const PARTICLES = [
  { left: "26%", bottom: "24%", size: 3, delay: 0.6, dur: 5.8, x: 10, opacity: 0.8 },
  { left: "44%", bottom: "20%", size: 2, delay: 2.2, dur: 6.4, x: -12, opacity: 0.6 },
  { left: "60%", bottom: "26%", size: 3, delay: 1, dur: 5.6, x: 12, opacity: 0.85 },
  { left: "78%", bottom: "18%", size: 2, delay: 3.2, dur: 6.8, x: -8, opacity: 0.55 },
  { left: "90%", bottom: "26%", size: 3, delay: 2, dur: 5.4, x: 8, opacity: 0.75 },
] as const

/** 3 semanas do mini calendário; índices marcados = dias de competição. */
const CALENDAR_DAYS = Array.from({ length: 21 }, (_, index) => index)

const COMPETITION_DAYS: Record<number, { color: "mint" | "cyan"; delay: number }> = {
  3: { color: "mint", delay: 0 },
  8: { color: "cyan", delay: 1.1 },
  12: { color: "mint", delay: 2.2 },
  17: { color: "mint", delay: 3.3 },
}

const TIMELINE_CARETS = [0, 1, 2] as const

export function ScheduleHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-16 right-[6%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_18%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-5s" }}
        />

        {/* cometa cruzando */}
        <span
          className="arena-comet absolute top-[8%] right-[30%] h-px w-20 rounded-full bg-gradient-to-l from-white/75 via-[color-mix(in_oklab,var(--brand-mint)_65%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "3s",
              "--comet-x": "-280px",
              "--comet-y": "190px",
              "--comet-angle": "-32deg",
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

        {/* ===== anel de countdown central ===== */}
        <div
          className="absolute top-[12%] right-[8%] lg:right-[12%]"
          style={{
            width: "clamp(120px, 14vw, 180px)",
            height: "clamp(120px, 14vw, 180px)",
          }}
        >
          {/* halo difuso atrás do anel */}
          <span className="absolute -inset-5 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_16%,transparent),transparent_70%)] blur-md" />
          {/* trilho tracejado (marcas de minutos) */}
          <span className="absolute inset-0 rounded-full border border-dashed border-white/10" />
          <span className="absolute inset-[13%] rounded-full border border-white/5" />
          {/* arco de progresso girando lento */}
          <span
            className="arena-ring absolute inset-0 rounded-full [background:conic-gradient(from_0deg,color-mix(in_oklab,var(--brand-mint)_85%,transparent)_0deg,color-mix(in_oklab,var(--brand-cyan)_65%,transparent)_130deg,transparent_265deg)] [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))]"
            style={{ animationDuration: "14s" }}
          />
          {/* arco interno em contra-rotação */}
          <span
            className="arena-ring absolute inset-[9%] hidden rounded-full [background:conic-gradient(from_180deg,transparent_20%,color-mix(in_oklab,var(--brand-cyan)_45%,transparent)_50%,transparent_80%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))] lg:block"
            style={{ animationDuration: "22s", animationDirection: "reverse" }}
          />
          {/* marcadores 12 · 3 · 6 · 9 */}
          <span className="absolute top-[3%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-white/35" />
          <span className="absolute top-1/2 right-[3%] size-1 -translate-y-1/2 rounded-full bg-white/25" />
          <span className="absolute bottom-[3%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-white/25" />
          <span className="absolute top-1/2 left-[3%] size-1 -translate-y-1/2 rounded-full bg-white/25" />
          {/* relógio central flutuando */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="arena-tilt relative"
              style={{ "--float-dur": "6.6s" } as React.CSSProperties}
            >
              <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
              <span className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-14 xl:size-16">
                <Clock className="size-6 lg:size-7 xl:size-8" weight="fill" />
              </span>
            </div>
          </div>
        </div>

        {/* setas de timeline avançando em sequência */}
        <div className="absolute top-[47%] right-[34%] flex items-center gap-0.5 lg:right-[38%]">
          {TIMELINE_CARETS.map((index) => (
            <CaretRight
              key={index}
              weight="bold"
              className="arena-twinkle size-3.5 text-[var(--brand-cyan)] lg:size-4"
              style={
                {
                  "--twinkle-delay": `${index * 0.35}s`,
                  "--twinkle-dur": "2.1s",
                  "--twinkle-opacity": 0.85,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* mini calendário com dias de competição cintilando */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[34%] bottom-[12%] rounded-2xl p-3 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "0.6s", "--float-dur": "7.4s" } as React.CSSProperties}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <CalendarBlank
              className="size-3 text-[var(--brand-cyan)]"
              weight="fill"
            />
            <span className="h-1 w-9 rounded-full bg-white/15" />
          </div>
          <div className="grid grid-cols-7 gap-1">
            {CALENDAR_DAYS.map((day) => {
              const marked = COMPETITION_DAYS[day]
              if (!marked) {
                return (
                  <span key={day} className="size-1.5 rounded-[3px] bg-white/10" />
                )
              }
              return (
                <span
                  key={day}
                  className={cn(
                    "arena-twinkle size-1.5 rounded-[3px]",
                    marked.color === "mint"
                      ? "bg-[var(--brand-mint)] shadow-[0_0_6px_1px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]"
                      : "bg-[var(--brand-cyan)] shadow-[0_0_6px_1px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]",
                  )}
                  style={
                    {
                      "--twinkle-delay": `${marked.delay}s`,
                      "--twinkle-dur": "4.4s",
                      "--twinkle-opacity": 1,
                    } as React.CSSProperties
                  }
                />
              )
            })}
          </div>
        </div>

        {/* chip de sino com ping */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[8%] right-[40%] hidden items-center gap-2 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={{ "--float-delay": "1.8s", "--float-dur": "8.2s" } as React.CSSProperties}
        >
          <span className="relative flex size-6 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--brand-mint)_16%,transparent)]">
            <span className="absolute -top-0.5 -right-0.5 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-mint)] opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--brand-mint)]" />
            </span>
            <Bell className="size-3.5 text-[var(--brand-mint)]" weight="fill" />
          </span>
          <div className="flex flex-col">
            <span className="text-muted-foreground text-[9px] font-semibold tracking-[0.14em] uppercase">
              Lembrete
            </span>
            <span className="text-foreground text-xs font-bold">
              Não perca a estreia
            </span>
          </div>
        </div>

        {/* chip: começa em 3d */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[60%] right-[6%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "0.2s", "--float-dur": "7s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <Timer className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Contagem
          </span>
          <span className="text-foreground text-xs font-bold">Começa em 3d</span>
        </div>

        {/* chip: inscrições abertas */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[10%] bottom-[8%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md xl:flex"
          style={{ "--float-delay": "2.6s", "--float-dur": "8.6s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <CheckCircle
              className="size-3.5 text-[var(--brand-green)]"
              weight="fill"
            />
            Inscrições
          </span>
          <span className="text-foreground text-xs font-bold">
            Abertas agora
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da agenda: o anel de countdown com arco girando, o relógio
 * central, as setas da timeline e o mini calendário.
 */
export function ScheduleHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="72%">
      {/* anel de countdown */}
      <div
        className="absolute top-[12%] right-[8%] lg:right-[12%]"
        style={{
          width: "clamp(130px, 15vw, 190px)",
          height: "clamp(130px, 15vw, 190px)",
        }}
      >
        <span className="absolute inset-0 rounded-full border border-dashed border-white/10" />
        <span className="absolute inset-[13%] rounded-full border border-white/5" />
        <span className="arena-ring absolute inset-0 rounded-full [background:conic-gradient(from_0deg,rgba(255,255,255,0.3)_0deg,rgba(255,255,255,0.12)_130deg,transparent_265deg)] [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),#000_calc(100%-4px))]" />
        {/* marcadores */}
        <span className="absolute top-[3%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-white/35" />
        <span className="absolute top-1/2 right-[3%] size-1 -translate-y-1/2 rounded-full bg-white/25" />
        <span className="absolute bottom-[3%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-white/25" />
        <span className="absolute top-1/2 left-[3%] size-1 -translate-y-1/2 rounded-full bg-white/25" />
        {/* relógio central */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="hero-pulse-ring absolute size-12 rounded-full bg-white/8" />
          <GBone className="size-12 rounded-2xl lg:size-14 xl:size-16" />
        </span>
      </div>

      {/* setas de timeline */}
      <div className="absolute top-[47%] right-[34%] flex items-center gap-1 lg:right-[38%]">
        {[0, 1, 2].map((caret) => (
          <GBone
            key={caret}
            delay={caret * 120}
            faint={caret > 1}
            className="size-3.5 rounded-sm lg:size-4"
          />
        ))}
      </div>

      {/* mini calendário */}
      <GPanel
        className="absolute right-[34%] bottom-[12%] flex flex-col gap-2 p-3"
        floatDelay={1.2}
        floatDur={7.8}
      >
        <span className="flex items-center gap-1.5">
          <GBone className="size-3 shrink-0 rounded-sm" />
          <GBone delay={60} className="h-2 w-12 rounded-full" />
        </span>
        <span className="grid grid-cols-7 gap-1">
          {Array.from({ length: 21 }).map((_, day) => (
            <GBone
              key={day}
              delay={80 + day * 25}
              faint={day % 3 !== 0}
              className="size-1.5 rounded-full"
            />
          ))}
        </span>
      </GPanel>

      {/* chip de sino */}
      <GPanel
        className="absolute top-[8%] right-[40%] hidden items-center gap-2 px-2.5 py-1.5 lg:flex"
        floatDelay={0.5}
        floatDur={7.2}
      >
        <GBone delay={140} className="size-4 shrink-0 rounded-full" />
        <GBone delay={200} className="h-2 w-14 rounded-full" />
      </GPanel>
    </VizGhost>
  )
}
