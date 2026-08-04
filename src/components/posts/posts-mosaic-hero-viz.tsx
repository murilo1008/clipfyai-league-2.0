import {
  ChatCircle,
  Eye,
  Heart,
  MagnifyingGlass,
  ShareNetwork,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Posts (cliente) — mural de cortes:
 * um mosaico 9:16 em três colunas com alturas alternadas respirando fora de
 * fase, um feixe de varredura percorrendo o mural (como se estivesse
 * filtrando), a peça em destaque com barra de reprodução e métricas saltando,
 * mais aurora, cometa, sparkles e partículas. CSS puro, aria-hidden.
 *
 * Deliberadamente distinta da viz da Home (leque de clipes + filmstrip):
 * aqui a leitura é de ACERVO EM GRADE sendo vasculhado, não de vitrine.
 */

const SPARKLES = [
  {
    left: "18%",
    top: "12%",
    size: 11,
    tone: "mint",
    delay: 0.4,
    dur: 3.9,
    lgOnly: false,
  },
  {
    left: "54%",
    top: "5%",
    size: 9,
    tone: "cyan",
    delay: 1.9,
    dur: 4.6,
    lgOnly: true,
  },
  {
    left: "84%",
    top: "16%",
    size: 12,
    tone: "mint",
    delay: 2.7,
    dur: 3.5,
    lgOnly: false,
  },
  {
    left: "30%",
    top: "84%",
    size: 9,
    tone: "cyan",
    delay: 1.2,
    dur: 4.2,
    lgOnly: true,
  },
  {
    left: "92%",
    top: "70%",
    size: 8,
    tone: "mint",
    delay: 3.4,
    dur: 3.7,
    lgOnly: false,
  },
] as const;

const PARTICLES = [
  {
    left: "22%",
    bottom: "16%",
    size: 3,
    delay: 0.5,
    dur: 6.2,
    x: 10,
    opacity: 0.8,
  },
  {
    left: "46%",
    bottom: "10%",
    size: 2,
    delay: 2.6,
    dur: 7,
    x: -10,
    opacity: 0.6,
  },
  {
    left: "68%",
    bottom: "18%",
    size: 3,
    delay: 1.5,
    dur: 5.8,
    x: 8,
    opacity: 0.85,
  },
  {
    left: "88%",
    bottom: "12%",
    size: 2,
    delay: 3.3,
    dur: 6.6,
    x: -8,
    opacity: 0.6,
  },
] as const;

/**
 * Colunas do mosaico. Cada peça tem altura própria (em % da coluna) para o
 * mural ficar irregular como um feed real; `hero` marca a peça em destaque.
 */
const COLUMNS = [
  {
    shift: "6%",
    lgOnly: false,
    tiles: [
      { h: 34, tone: "muted", delay: 0.2, dur: 7.4, hero: false },
      { h: 46, tone: "cyan", delay: 1.6, dur: 8.2, hero: false },
      { h: 20, tone: "muted", delay: 2.8, dur: 6.8, hero: false },
    ],
  },
  {
    shift: "0%",
    lgOnly: false,
    tiles: [
      { h: 26, tone: "mint", delay: 1.1, dur: 7.8, hero: false },
      { h: 52, tone: "hero", delay: 0.5, dur: 8.6, hero: true },
      { h: 22, tone: "cyan", delay: 2.2, dur: 7.1, hero: false },
    ],
  },
  {
    shift: "10%",
    lgOnly: true,
    tiles: [
      { h: 42, tone: "cyan", delay: 0.8, dur: 8, hero: false },
      { h: 30, tone: "muted", delay: 2.4, dur: 7.3, hero: false },
      { h: 28, tone: "mint", delay: 1.4, dur: 6.9, hero: false },
    ],
  },
] as const;

const TILE_TONES: Record<string, string> = {
  muted: "bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-transparent",
  cyan: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_24%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_9%,transparent)] to-transparent",
  mint: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-mint)_22%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_8%,transparent)] to-transparent",
  hero: "bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-cyan)_32%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_15%,transparent)] to-[color-mix(in_oklab,var(--brand-green)_9%,transparent)]",
};

/** Métricas que saltam do mural, cada uma no seu ritmo. */
const METRIC_BUBBLES = [
  {
    icon: Eye,
    color: "text-[var(--brand-cyan)]",
    className: "top-[14%] right-[6%]",
    delay: 0.7,
    dur: 7.2,
    lgOnly: false,
  },
  {
    icon: Heart,
    color: "text-rose-400",
    className: "top-[44%] right-[2%]",
    delay: 2.1,
    dur: 8.1,
    lgOnly: false,
  },
  {
    icon: ChatCircle,
    color: "text-[var(--brand-mint)]",
    className: "top-[70%] right-[14%]",
    delay: 3,
    dur: 7.6,
    lgOnly: true,
  },
  {
    icon: ShareNetwork,
    color: "text-violet-400",
    className: "top-[28%] right-[42%]",
    delay: 1.5,
    dur: 8.4,
    lgOnly: true,
  },
] as const;

export function PostsMosaicHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[50%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_46%)]">
        {/* aurora em deriva */}
        <span className="arena-aurora absolute -top-16 right-[10%] size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[46%] bottom-[4%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_18%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* cometa cruzando o mural */}
        <span
          className="arena-comet absolute top-[8%] right-[8%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-mint)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "11s",
              "--comet-delay": "3s",
              "--comet-x": "-300px",
              "--comet-y": "200px",
              "--comet-angle": "-32deg",
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

        {/* mural de cortes: 3 colunas irregulares respirando */}
        <div className="absolute inset-y-[12%] right-[6%] flex items-stretch gap-2 lg:gap-2.5 xl:right-[10%]">
          {COLUMNS.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className={cn(
                "flex w-[clamp(52px,5.6vw,78px)] flex-col gap-2 lg:gap-2.5",
                column.lgOnly && "hidden lg:flex",
              )}
              style={{ translate: `0 ${column.shift}` }}
            >
              {column.tiles.map((tile, tileIndex) => (
                <div
                  key={tileIndex}
                  className={cn(
                    "hero-float relative overflow-hidden rounded-lg shadow-xl ring-1 shadow-black/35 ring-white/10 backdrop-blur-[2px]",
                    TILE_TONES[tile.tone],
                    tile.hero &&
                      "ring-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]",
                  )}
                  style={
                    {
                      height: `${tile.h}%`,
                      "--float-delay": `${tile.delay}s`,
                      "--float-dur": `${tile.dur}s`,
                    } as React.CSSProperties
                  }
                >
                  {/* legendas fantasma */}
                  <span className="absolute inset-x-1.5 bottom-1.5 h-0.5 rounded-full bg-white/12" />
                  <span className="absolute bottom-2.5 left-1.5 h-0.5 w-1/2 rounded-full bg-white/8" />

                  {tile.hero && (
                    <>
                      {/* barra de reprodução preenchendo */}
                      <span className="absolute inset-x-1.5 bottom-4 h-[3px] overflow-hidden rounded-full bg-white/12">
                        <span
                          className="hero-clip-progress bg-gradient-custom block h-full rounded-full"
                          style={
                            {
                              "--clip-dur": "5.4s",
                              "--clip-delay": "0.8s",
                            } as React.CSSProperties
                          }
                        />
                      </span>
                      {/* brilho varrendo a peça em destaque */}
                      <span
                        className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/16 to-transparent"
                        style={
                          { "--shine-delay": "1.2s" } as React.CSSProperties
                        }
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* feixe de varredura percorrendo o mural (metáfora do filtro/busca) */}
        <span
          className="arena-comet absolute inset-y-[8%] right-[4%] w-px bg-gradient-to-b from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_75%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "9s",
              "--comet-delay": "1.4s",
              "--comet-x": "-360px",
              "--comet-y": "0px",
              "--comet-angle": "0deg",
            } as React.CSSProperties
          }
        />

        {/* lupa pulsando — a busca sobre o mural */}
        <span className="absolute top-[6%] right-[30%] hidden items-center justify-center lg:flex">
          <span
            className="arena-ripple absolute -inset-3 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_32%,transparent)]"
            style={
              {
                "--ripple-dur": "4.4s",
                "--ripple-delay": "0.6s",
              } as React.CSSProperties
            }
          />
          <span className="bg-gradient-custom relative flex size-8 items-center justify-center rounded-xl text-[#04222A] shadow-[0_10px_30px_-8px_rgba(31,254,200,0.55)]">
            <MagnifyingGlass className="size-4" weight="bold" />
          </span>
        </span>

        {/* bolhas de métrica saltando do mural */}
        {METRIC_BUBBLES.map(
          (
            {
              icon: MetricIcon,
              color,
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
                "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex size-8 items-center justify-center rounded-xl shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:size-9",
                lgOnly && "hidden lg:flex",
                posClass,
              )}
              style={
                {
                  "--float-delay": `${delay}s`,
                  "--float-dur": `${dur}s`,
                } as React.CSSProperties
              }
            >
              <MetricIcon
                className={cn("size-4 lg:size-4.5", color)}
                weight="fill"
              />
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/**
 * Fantasma do mural de cortes: as mesmas 3 colunas irregulares (com a
 * terceira só em lg+), a lupa da busca e as bolhas de métrica.
 */
export function PostsMosaicHeroVizSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <VizGhost
      className={className}
      width="w-[46%] lg:w-[54%] xl:w-[50%]"
      mask="46%"
      focus="66%"
    >
      {/* mural: 3 colunas irregulares respirando */}
      <div className="absolute inset-y-[12%] right-[6%] flex items-stretch gap-2 lg:gap-2.5 xl:right-[10%]">
        {COLUMNS.map((column, columnIndex) => (
          <div
            key={columnIndex}
            className={cn(
              "flex w-[clamp(52px,5.6vw,78px)] flex-col gap-2 lg:gap-2.5",
              column.lgOnly && "hidden lg:flex",
            )}
            style={{ translate: `0 ${column.shift}` }}
          >
            {column.tiles.map((tile, tileIndex) => (
              <span
                key={tileIndex}
                className="hero-float relative block"
                style={
                  {
                    height: `${tile.h}%`,
                    "--float-delay": `${tile.delay}s`,
                    "--float-dur": `${tile.dur}s`,
                  } as React.CSSProperties
                }
              >
                <GBone
                  delay={columnIndex * 120 + tileIndex * 90}
                  faint={!tile.hero && tileIndex === 2}
                  className="size-full rounded-lg"
                />
                {/* legendas fantasma dentro da peça */}
                <span className="absolute inset-x-1.5 bottom-1.5 h-0.5 rounded-full bg-white/12" />
                <span className="absolute bottom-2.5 left-1.5 h-0.5 w-1/2 rounded-full bg-white/8" />
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* lupa da busca */}
      <span className="absolute top-[6%] right-[30%] hidden items-center justify-center lg:flex">
        <span
          className="arena-ripple absolute -inset-3 rounded-full bg-white/10"
          style={
            {
              "--ripple-dur": "4.4s",
              "--ripple-delay": "0.6s",
            } as React.CSSProperties
          }
        />
        <GBone className="size-8 rounded-xl" />
      </span>

      {/* bolhas de métrica */}
      {METRIC_BUBBLES.map((bubble, index) => (
        <span
          key={index}
          className={cn(
            "hero-float absolute block size-8 lg:size-9",
            bubble.lgOnly && "hidden lg:block",
            bubble.className,
          )}
          style={
            {
              "--float-delay": `${bubble.delay}s`,
              "--float-dur": `${bubble.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 110} className="size-full rounded-xl" />
        </span>
      ))}
    </VizGhost>
  );
}
