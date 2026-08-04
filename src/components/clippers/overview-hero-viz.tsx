import {
  MapPin,
  Sparkle,
  TrendUp,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Visão Geral (admin) — radar de
 * clipadores: aurora em deriva, grade de mapa, radar com varredura
 * girando e blips acendendo pelo caminho, pins de UF flutuando, mini
 * gráfico de barras fantasma, chips de comunidade, sparkles e
 * partículas. CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  { left: "26%", top: "12%", size: 10, delay: 0.4, dur: 3.8, color: "cyan", lgOnly: false },
  { left: "50%", top: "70%", size: 12, delay: 1.5, dur: 4.4, color: "mint", lgOnly: false },
  { left: "88%", top: "8%", size: 9, delay: 2.6, dur: 3.4, color: "mint", lgOnly: false },
  { left: "36%", top: "40%", size: 8, delay: 3.4, dur: 4.1, color: "cyan", lgOnly: true },
  { left: "68%", top: "84%", size: 9, delay: 0.9, dur: 3.6, color: "cyan", lgOnly: true },
] as const

const PARTICLES = [
  { left: "24%", bottom: "26%", size: 3, delay: 0.2, dur: 5.6, x: 10, opacity: 0.8 },
  { left: "40%", bottom: "20%", size: 2, delay: 1.8, dur: 6.6, x: -10, opacity: 0.6 },
  { left: "58%", bottom: "28%", size: 3, delay: 1, dur: 5.8, x: 12, opacity: 0.85 },
  { left: "74%", bottom: "22%", size: 2, delay: 3, dur: 6.2, x: -8, opacity: 0.6 },
  { left: "88%", bottom: "30%", size: 3, delay: 2.2, dur: 5.4, x: 8, opacity: 0.75 },
] as const

/** Blips do radar — delays espalhados pelo ciclo de 6s da varredura. */
const RADAR_BLIPS = [
  { left: "70%", top: "16%", size: 7, delay: 0.6, color: "mint", lgOnly: false },
  { left: "22%", top: "34%", size: 6, delay: 1.8, color: "cyan", lgOnly: false },
  { left: "78%", top: "58%", size: 6, delay: 3, color: "cyan", lgOnly: false },
  { left: "36%", top: "72%", size: 7, delay: 4.2, color: "mint", lgOnly: false },
  { left: "56%", top: "38%", size: 5, delay: 5.4, color: "mint", lgOnly: true },
] as const

const MAP_PINS = [
  { uf: "SP", color: "text-[var(--brand-cyan)]", className: "top-[20%] right-[42%]", delay: 0.4, dur: 7.2 },
  { uf: "RJ", color: "text-[var(--brand-mint)]", className: "top-[64%] right-[12%]", delay: 1.6, dur: 8 },
  { uf: "MG", color: "text-[var(--brand-green)]", className: "top-[5%] right-[30%] hidden xl:flex", delay: 2.8, dur: 7.6 },
] as const

const GHOST_BARS = [
  { height: "38%", delay: 0, dur: 2.8, color: "cyan" },
  { height: "70%", delay: 0.25, dur: 3.2, color: "mint" },
  { height: "52%", delay: 0.5, dur: 2.6, color: "green" },
  { height: "88%", delay: 0.75, dur: 3, color: "cyan" },
  { height: "60%", delay: 1, dur: 3.4, color: "mint" },
  { height: "42%", delay: 1.25, dur: 2.7, color: "green" },
] as const

export function OverviewHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-14 right-[10%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[46%] bottom-[4%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_18%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-8s" }}
        />

        {/* grade de mapa concentrada em volta do radar */}
        <div className="hero-grid absolute inset-0 opacity-35 [mask-image:radial-gradient(circle_at_74%_36%,#000_18%,transparent_68%)]" />

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

        {/* ===== radar central ===== */}
        <div
          className="absolute top-[10%] right-[6%] lg:right-[10%]"
          style={{
            width: "clamp(140px, 16vw, 200px)",
            height: "clamp(140px, 16vw, 200px)",
          }}
        >
          {/* brilho de fundo do visor */}
          <span className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_14%,transparent),transparent_70%)] blur-lg" />
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_10%,transparent),transparent_78%)]" />
          {/* anéis concêntricos */}
          <span className="absolute inset-0 rounded-full border border-dashed border-white/10" />
          <span className="absolute inset-[16%] rounded-full border border-dashed border-white/10" />
          <span className="absolute inset-[32%] rounded-full border border-dashed border-white/10" />
          {/* retículo em cruz */}
          <span className="absolute top-1/2 right-[3%] left-[3%] h-px bg-white/5" />
          <span className="absolute top-[3%] bottom-[3%] left-1/2 w-px bg-white/5" />
          {/* varredura girando com cauda */}
          <span
            className="arena-ring absolute inset-0 overflow-hidden rounded-full"
            style={{ animationDuration: "6s" }}
          >
            <span className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent_0deg,transparent_296deg,color-mix(in_oklab,var(--brand-cyan)_10%,transparent)_312deg,color-mix(in_oklab,var(--brand-cyan)_42%,transparent)_360deg)]" />
            {/* agulha da varredura */}
            <span className="absolute top-0 bottom-1/2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_85%,transparent)] to-transparent" />
            <span className="absolute top-[2%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
          </span>
          {/* blips acendendo conforme a varredura passa */}
          {RADAR_BLIPS.map((blip, index) => (
            <span
              key={index}
              className={cn(
                "arena-twinkle absolute rounded-full",
                blip.color === "mint"
                  ? "bg-[var(--brand-mint)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-mint)_55%,transparent)]"
                  : "bg-[var(--brand-cyan)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-cyan)_55%,transparent)]",
                blip.lgOnly && "hidden lg:block",
              )}
              style={
                {
                  left: blip.left,
                  top: blip.top,
                  width: blip.size,
                  height: blip.size,
                  "--twinkle-delay": `${blip.delay}s`,
                  "--twinkle-dur": "6s",
                  "--twinkle-opacity": 1,
                } as React.CSSProperties
              }
            />
          ))}
          {/* pulso de sonar a partir do centro */}
          <span className="hero-pulse-ring absolute inset-[38%] rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]" />
          {/* base do radar */}
          <span className="bg-gradient-custom absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl text-[#04222A] shadow-[0_10px_30px_-8px_rgba(31,254,200,0.6)] lg:size-9">
            <MapPin className="size-4 lg:size-4.5" weight="fill" />
          </span>
        </div>

        {/* pins de UF flutuando */}
        {MAP_PINS.map((pin) => (
          <span
            key={pin.uf}
            className={cn(
              "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex items-center gap-1.5 rounded-xl px-2 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md",
              pin.className,
            )}
            style={
              {
                "--float-delay": `${pin.delay}s`,
                "--float-dur": `${pin.dur}s`,
              } as React.CSSProperties
            }
          >
            <MapPin className={cn("size-3.5", pin.color)} weight="fill" />
            <span className="text-foreground text-[10px] font-black tracking-wide">
              {pin.uf}
            </span>
          </span>
        ))}

        {/* mini gráfico fantasma */}
        <div className="absolute right-[46%] bottom-[10%] flex h-10 items-end gap-1 lg:h-12">
          {GHOST_BARS.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "hero-bar w-1.5 rounded-full",
                bar.color === "cyan" &&
                  "bg-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]",
                bar.color === "mint" &&
                  "bg-[color-mix(in_oklab,var(--brand-mint)_55%,transparent)]",
                bar.color === "green" &&
                  "bg-[color-mix(in_oklab,var(--brand-green)_55%,transparent)]",
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

        {/* chip: clipadores mapeados */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[6%] bottom-[10%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "0.8s", "--float-dur": "7.6s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <UsersThree className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Radar ativo
          </span>
          <span className="text-foreground text-xs font-bold">
            Clipadores mapeados
          </span>
        </div>

        {/* chip: novos hoje */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[44%] right-[38%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={{ "--float-delay": "2.2s", "--float-dur": "8.2s" } as React.CSSProperties}
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <TrendUp className="size-3.5 text-[var(--brand-mint)]" weight="bold" />
            Novos hoje
          </span>
          <span className="text-foreground text-xs font-bold">
            Comunidade crescendo
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do radar: o visor com anéis concêntricos e varredura girando,
 * os pins de UF, o mini-gráfico e os dois chips — mesmas âncoras.
 */
export function OverviewHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="74%">
      {/* visor do radar */}
      <div
        className="absolute top-[10%] right-[6%] lg:right-[10%]"
        style={{
          width: "clamp(140px, 16vw, 200px)",
          height: "clamp(140px, 16vw, 200px)",
        }}
      >
        <span className="absolute inset-0 rounded-full border border-dashed border-white/10" />
        <span className="absolute inset-[16%] rounded-full border border-dashed border-white/10" />
        <span className="absolute inset-[32%] rounded-full border border-dashed border-white/10" />
        <span className="absolute top-1/2 right-[3%] left-[3%] h-px bg-white/5" />
        <span className="absolute top-[3%] bottom-[3%] left-1/2 w-px bg-white/5" />
        {/* varredura girando */}
        <span
          className="arena-ring absolute inset-0 overflow-hidden rounded-full"
          style={{ animationDuration: "6s" }}
        >
          <span className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent_0deg,transparent_300deg,rgba(255,255,255,0.05)_320deg,rgba(255,255,255,0.14)_360deg)]" />
          <span className="absolute top-0 bottom-1/2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-white/35 to-transparent" />
        </span>
        {/* base do radar */}
        <span className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 lg:size-9">
          <GBone className="size-full rounded-xl" />
        </span>
      </div>

      {/* pins de UF */}
      {MAP_PINS.map((pin, index) => (
        <div
          key={pin.uf}
          className={cn(
            "hero-float absolute h-7 w-12 lg:h-8 lg:w-14",
            pin.className,
          )}
          style={
            {
              "--float-delay": `${pin.delay}s`,
              "--float-dur": `${pin.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 120} className="size-full rounded-xl" />
        </div>
      ))}

      {/* mini gráfico fantasma */}
      <div className="absolute right-[46%] bottom-[10%] flex h-10 items-end gap-1 lg:h-12">
        {GHOST_BARS.map((bar, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-1.5 rounded-full"
            style={
              {
                height: bar.height,
                "--bar-delay": `${bar.delay}s`,
                "--bar-dur": `${bar.dur}s`,
                "--shimmer-delay": `${index * 80}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* chips */}
      <GChip
        className="absolute right-[6%] bottom-[10%]"
        floatDelay={0.8}
        floatDur={7.6}
      />
      <GChip
        className="absolute top-[44%] right-[38%] hidden lg:flex"
        floatDelay={2.2}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
