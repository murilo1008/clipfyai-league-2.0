import {
  CheckCircle,
  CloudArrowDown,
  Gear,
  Sparkle,
  Stack,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Downloads (ADMIN) — usina de processamento:
 * um núcleo com engrenagem girando e anéis pulsando puxa os vídeos da nuvem,
 * enquanto uma coluna de barras verticais mostra o throughput da fila e chips
 * de estado (na fila / processando / pronto) orbitam. CSS puro, aria-hidden.
 *
 * Distinta da viz do CLIENTE (bandeja recebendo arquivos): aqui a leitura é de
 * OPERAÇÃO EM LOTE — capacidade e vazão, não entrega individual.
 */

const SPARKLES = [
  {
    left: "22%",
    top: "10%",
    size: 11,
    tone: "cyan",
    delay: 0.6,
    dur: 3.8,
    lgOnly: false,
  },
  {
    left: "58%",
    top: "6%",
    size: 9,
    tone: "mint",
    delay: 2,
    dur: 4.4,
    lgOnly: true,
  },
  {
    left: "86%",
    top: "20%",
    size: 12,
    tone: "cyan",
    delay: 1.2,
    dur: 3.5,
    lgOnly: false,
  },
  {
    left: "40%",
    top: "82%",
    size: 9,
    tone: "mint",
    delay: 3.2,
    dur: 4.1,
    lgOnly: true,
  },
] as const;

const PARTICLES = [
  {
    left: "28%",
    bottom: "12%",
    size: 3,
    delay: 0.5,
    dur: 6.1,
    x: 11,
    opacity: 0.8,
  },
  {
    left: "50%",
    bottom: "18%",
    size: 2,
    delay: 2.3,
    dur: 6.9,
    x: -9,
    opacity: 0.6,
  },
  {
    left: "72%",
    bottom: "10%",
    size: 3,
    delay: 1.4,
    dur: 5.7,
    x: 8,
    opacity: 0.85,
  },
] as const;

/** Barras de vazão da fila — alturas e ritmos distintos. */
const THROUGHPUT_BARS = [
  { h: 42, delay: 0, dur: 2.6 },
  { h: 68, delay: 0.35, dur: 2.2 },
  { h: 54, delay: 0.7, dur: 2.9 },
  { h: 86, delay: 0.2, dur: 2.4 },
  { h: 62, delay: 0.9, dur: 2.7 },
  { h: 74, delay: 0.5, dur: 2.1 },
  { h: 48, delay: 1.1, dur: 3 },
] as const;

/** Chips de estado orbitando o núcleo. */
const STATE_CHIPS = [
  {
    icon: Stack,
    color: "text-[var(--brand-cyan)]",
    label: "Na fila",
    className: "top-[12%] right-[38%]",
    delay: 0.8,
    dur: 7.4,
    lgOnly: false,
  },
  {
    icon: CloudArrowDown,
    color: "text-amber-400",
    label: "Baixando",
    className: "top-[52%] right-[52%]",
    delay: 2.2,
    dur: 8.2,
    lgOnly: true,
  },
  {
    icon: CheckCircle,
    color: "text-[var(--brand-mint)]",
    label: "Pronto",
    className: "top-[74%] right-[16%]",
    delay: 1.5,
    dur: 7.8,
    lgOnly: false,
  },
] as const;

export function DownloadsQueueHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[52%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_46%)]">
        {/* aurora */}
        <span className="arena-aurora absolute -top-14 right-[8%] size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[4%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_18%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-8s" }}
        />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[7%] right-[6%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10.5s",
              "--comet-delay": "1.8s",
              "--comet-x": "-320px",
              "--comet-y": "210px",
              "--comet-angle": "-33deg",
            } as React.CSSProperties
          }
        />

        {/* sparkles */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.tone === "mint"
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

        {/* partículas */}
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className={cn(
              "arena-particle absolute rounded-full",
              index % 2 === 0
                ? "bg-[var(--brand-cyan)]"
                : "bg-[var(--brand-mint)]",
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

        {/* núcleo da usina: anéis + engrenagem girando */}
        <span className="absolute top-[26%] right-[14%] flex items-center justify-center lg:right-[18%]">
          <span
            className="arena-ripple absolute -inset-6 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)]"
            style={
              {
                "--ripple-dur": "4.6s",
                "--ripple-delay": "0s",
              } as React.CSSProperties
            }
          />
          <span
            className="arena-ripple absolute -inset-6 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_20%,transparent)]"
            style={
              {
                "--ripple-dur": "4.6s",
                "--ripple-delay": "2.3s",
              } as React.CSSProperties
            }
          />
          {/* anel externo em rotação lenta */}
          <span className="arena-ring absolute -inset-3 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_38%,transparent)]" />
          <span className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_16px_40px_-10px_rgba(31,254,200,0.6)] lg:size-14">
            <Gear className="arena-ring size-6 lg:size-7" weight="fill" />
          </span>
        </span>

        {/* barras de vazão da fila */}
        <div className="absolute right-[10%] bottom-[14%] flex h-[22%] items-end gap-1.5 lg:right-[14%] lg:gap-2">
          {THROUGHPUT_BARS.map((bar, index) => (
            <span
              key={index}
              className="hero-bar w-1.5 origin-bottom rounded-full bg-gradient-to-t from-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_85%,transparent)] lg:w-2"
              style={
                {
                  height: `${bar.h}%`,
                  "--bar-delay": `${bar.delay}s`,
                  "--bar-dur": `${bar.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* chips de estado da fila */}
        {STATE_CHIPS.map(
          (
            {
              icon: ChipIcon,
              color,
              label,
              className: posClass,
              delay,
              dur,
              lgOnly,
            },
            index,
          ) => (
            <span
              key={index}
              className={cn(
                "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md",
                lgOnly && "hidden lg:inline-flex",
                posClass,
              )}
              style={
                {
                  "--float-delay": `${delay}s`,
                  "--float-dur": `${dur}s`,
                } as React.CSSProperties
              }
            >
              <ChipIcon className={cn("size-3.5", color)} weight="fill" />
              <span className="text-foreground text-[10px] font-bold">
                {label}
              </span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Fantasma da usina de downloads: o núcleo com anéis girando, as barras
 * de vazão da fila e os chips de estado.
 */
export function DownloadsQueueHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost
      className={className}
      width="w-[46%] lg:w-[52%] xl:w-[48%]"
      focus="70%"
    >
      {/* núcleo da usina */}
      <div className="absolute top-[26%] right-[14%] flex items-center justify-center lg:right-[18%]">
        <span
          className="arena-ripple absolute -inset-6 rounded-full bg-white/8"
          style={{ "--ripple-dur": "4.4s" } as React.CSSProperties}
        />
        <span className="arena-ring absolute -inset-3 rounded-full border border-dashed border-white/15" />
        <GBone className="size-12 rounded-2xl lg:size-14" />
      </div>

      {/* barras de vazão */}
      <div className="absolute right-[10%] bottom-[14%] flex h-[22%] items-end gap-1.5 lg:right-[14%] lg:gap-2">
        {[42, 78, 34, 92, 58, 70].map((height, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-2 rounded-t-md lg:w-2.5"
            style={
              {
                height: `${height}%`,
                "--bar-delay": `${index * 0.15}s`,
                "--bar-dur": "2.8s",
                "--shimmer-delay": `${index * 85}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* chips de estado da fila */}
      <GChip className="absolute top-[8%] right-[8%]" lines={1} floatDelay={0.6} floatDur={7.2} />
      <GChip
        className="absolute top-[52%] right-[46%] hidden lg:flex"
        lines={1}
        floatDelay={1.8}
        floatDur={8}
        delay={120}
      />
      <GChip
        className="absolute bottom-[8%] right-[52%] hidden xl:flex"
        lines={1}
        floatDelay={2.8}
        floatDur={7.6}
        delay={240}
      />
    </VizGhost>
  );
}
