import {
  CheckCircle,
  DownloadSimple,
  FileVideo,
  Sparkle,
  Tray,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Downloads do CLIENTE — esteira de arquivos:
 * cartões de vídeo empilhados descendo em direção a uma bandeja iluminada,
 * cada um com sua barra de progresso preenchendo em ritmo próprio; o do topo
 * já concluído exibe o selo verde. Ao redor: aurora, cometa, sparkles e
 * partículas subindo. CSS puro, aria-hidden.
 *
 * Metáfora distinta da Home (vitrine de clipes) e de Posts (mural em grade):
 * aqui a leitura é de TRANSFERÊNCIA — algo saindo da nuvem e chegando na mão.
 */

const SPARKLES = [
  {
    left: "20%",
    top: "14%",
    size: 11,
    tone: "mint",
    delay: 0.5,
    dur: 4,
    lgOnly: false,
  },
  {
    left: "62%",
    top: "8%",
    size: 9,
    tone: "cyan",
    delay: 2.2,
    dur: 4.5,
    lgOnly: true,
  },
  {
    left: "88%",
    top: "26%",
    size: 12,
    tone: "mint",
    delay: 1.3,
    dur: 3.6,
    lgOnly: false,
  },
  {
    left: "34%",
    top: "80%",
    size: 9,
    tone: "cyan",
    delay: 3.1,
    dur: 4.3,
    lgOnly: true,
  },
] as const;

const PARTICLES = [
  {
    left: "30%",
    bottom: "14%",
    size: 3,
    delay: 0.4,
    dur: 6,
    x: 9,
    opacity: 0.85,
  },
  {
    left: "52%",
    bottom: "10%",
    size: 2,
    delay: 2.4,
    dur: 6.8,
    x: -9,
    opacity: 0.6,
  },
  {
    left: "74%",
    bottom: "16%",
    size: 3,
    delay: 1.6,
    dur: 5.6,
    x: 7,
    opacity: 0.8,
  },
  {
    left: "90%",
    bottom: "8%",
    size: 2,
    delay: 3.5,
    dur: 6.4,
    x: -6,
    opacity: 0.55,
  },
] as const;

/**
 * Fila de arquivos descendo para a bandeja. O primeiro (topo) está concluído;
 * os demais preenchem em ritmos diferentes para a fila parecer viva.
 */
const FILE_CARDS = [
  {
    tone: "done",
    scale: 1,
    offsetX: 0,
    delay: 0.3,
    dur: 7.6,
    clipDur: 4.6,
    clipDelay: 0,
    done: true,
    lgOnly: false,
  },
  {
    tone: "cyan",
    scale: 0.94,
    offsetX: -10,
    delay: 1.4,
    dur: 8.3,
    clipDur: 5.8,
    clipDelay: 0.9,
    done: false,
    lgOnly: false,
  },
  {
    tone: "mint",
    scale: 0.88,
    offsetX: 8,
    delay: 2.5,
    dur: 7.1,
    clipDur: 6.6,
    clipDelay: 1.8,
    done: false,
    lgOnly: false,
  },
  {
    tone: "muted",
    scale: 0.82,
    offsetX: -6,
    delay: 3.4,
    dur: 8.8,
    clipDur: 7.4,
    clipDelay: 2.6,
    done: false,
    lgOnly: true,
  },
] as const;

const CARD_TONES: Record<(typeof FILE_CARDS)[number]["tone"], string> = {
  done: "bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-green)_26%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_12%,transparent)] to-transparent ring-[color-mix(in_oklab,var(--brand-green)_38%,transparent)]",
  cyan: "bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_24%,transparent)] via-[color-mix(in_oklab,var(--brand-cyan)_9%,transparent)] to-transparent ring-white/10",
  mint: "bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-mint)_20%,transparent)] via-[color-mix(in_oklab,var(--brand-mint)_8%,transparent)] to-transparent ring-white/10",
  muted:
    "bg-gradient-to-r from-white/[0.08] via-white/[0.03] to-transparent ring-white/8",
};

export function DownloadsTrayHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-12 right-[14%] size-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_24%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[38%] bottom-[6%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-5s" }}
        />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[10%] right-[10%] h-px w-20 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "12s",
              "--comet-delay": "2s",
              "--comet-x": "-280px",
              "--comet-y": "190px",
              "--comet-angle": "-34deg",
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

        {/* trilho vertical por onde os arquivos descem */}
        <span className="absolute inset-y-[16%] right-[30%] hidden w-px bg-gradient-to-b from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] to-transparent lg:block" />

        {/* fila de arquivos descendo */}
        <div className="absolute inset-x-[6%] top-[14%] flex flex-col items-end gap-2.5 lg:gap-3">
          {FILE_CARDS.map((card, index) => (
            <div
              key={index}
              className={cn(
                "hero-float relative flex w-[clamp(128px,15vw,196px)] items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 shadow-xl ring-1 shadow-black/35 backdrop-blur-[2px]",
                CARD_TONES[card.tone],
                card.lgOnly && "hidden lg:flex",
              )}
              style={
                {
                  scale: `${card.scale}`,
                  translate: `${card.offsetX}px 0`,
                  "--float-delay": `${card.delay}s`,
                  "--float-dur": `${card.dur}s`,
                } as React.CSSProperties
              }
            >
              {/* ícone do arquivo */}
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg",
                  card.done
                    ? "bg-[color-mix(in_oklab,var(--brand-green)_30%,transparent)]"
                    : "bg-white/10",
                )}
              >
                {card.done ? (
                  <CheckCircle
                    className="size-4 text-[var(--brand-mint)]"
                    weight="fill"
                  />
                ) : (
                  <FileVideo
                    className="size-4 text-[var(--brand-cyan)]"
                    weight="fill"
                  />
                )}
              </span>

              {/* nome fantasma + barra de progresso */}
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="h-1 w-3/4 rounded-full bg-white/14" />
                <span className="h-[3px] w-full overflow-hidden rounded-full bg-white/10">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      card.done
                        ? "bg-gradient-custom w-full"
                        : "hero-clip-progress bg-gradient-custom",
                    )}
                    style={
                      card.done
                        ? undefined
                        : ({
                            "--clip-dur": `${card.clipDur}s`,
                            "--clip-delay": `${card.clipDelay}s`,
                          } as React.CSSProperties)
                    }
                  />
                </span>
              </span>

              {/* brilho varrendo o cartão concluído */}
              {card.done && (
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/16 to-transparent"
                  style={{ "--shine-delay": "0.9s" } as React.CSSProperties}
                />
              )}
            </div>
          ))}
        </div>

        {/* bandeja de destino, pulsando ao receber os arquivos */}
        <span className="absolute right-[16%] bottom-[10%] flex items-center justify-center">
          <span
            className="arena-ripple absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_28%,transparent)]"
            style={
              {
                "--ripple-dur": "4.2s",
                "--ripple-delay": "0.4s",
              } as React.CSSProperties
            }
          />
          <span
            className="arena-ripple absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)]"
            style={
              {
                "--ripple-dur": "4.2s",
                "--ripple-delay": "2.1s",
              } as React.CSSProperties
            }
          />
          <span className="bg-gradient-custom relative flex size-11 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_36px_-10px_rgba(31,254,200,0.6)] lg:size-12">
            <Tray className="size-5 lg:size-6" weight="fill" />
          </span>
        </span>

        {/* seta de download pulsando acima da bandeja */}
        <span
          className="hero-float absolute right-[19%] bottom-[26%] hidden lg:block"
          style={
            {
              "--float-delay": "1.1s",
              "--float-dur": "3.4s",
            } as React.CSSProperties
          }
        >
          <DownloadSimple
            className="size-5 text-[var(--brand-mint)]"
            weight="bold"
          />
        </span>
      </div>
    </div>
  );
}

/**
 * Fantasma da bandeja: os cartões de arquivo descendo pelo trilho e a
 * bandeja de destino pulsando ao recebê-los.
 */
export function DownloadsTrayHeroVizSkeleton({
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
      {/* trilho vertical */}
      <span className="absolute inset-y-[16%] right-[30%] hidden w-px bg-gradient-to-b from-transparent via-white/20 to-transparent lg:block" />

      {/* fila de arquivos descendo */}
      <div className="absolute inset-x-[6%] top-[14%] flex flex-col items-end gap-2.5 lg:gap-3">
        {[0, 1, 2].map((file) => (
          <GPanel
            key={file}
            floatDelay={file * 0.8}
            floatDur={7 + file * 0.6}
            className="flex w-[clamp(128px,15vw,196px)] items-center gap-2 p-2"
          >
            <GBone delay={file * 120} className="size-7 shrink-0 rounded-lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <GBone delay={file * 120 + 60} className="h-2 w-[80%] rounded-full" />
              <span className="block h-1 overflow-hidden rounded-full bg-white/12">
                <span
                  className="hero-clip-progress block h-full rounded-full bg-white/35"
                  style={
                    {
                      "--clip-dur": `${4.4 + file * 0.6}s`,
                      "--clip-delay": `${file * 0.5}s`,
                    } as React.CSSProperties
                  }
                />
              </span>
            </span>
          </GPanel>
        ))}
      </div>

      {/* bandeja de destino */}
      <div className="absolute right-[16%] bottom-[10%] flex items-center justify-center">
        <span
          className="arena-ripple absolute -inset-4 rounded-full bg-white/8"
          style={{ "--ripple-dur": "4.2s" } as React.CSSProperties}
        />
        <GBone delay={200} className="size-11 rounded-2xl lg:size-12" />
      </div>

      {/* seta de download */}
      <GBone
        delay={280}
        className="hero-float absolute right-[19%] bottom-[26%] hidden size-5 rounded-md lg:block"
      />
    </VizGhost>
  );
}
