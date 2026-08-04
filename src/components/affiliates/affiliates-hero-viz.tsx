import {
  SealCheck,
  ShareNetwork,
  Sparkle,
  UserPlus,
  Users,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Indicações — rede member-get-member:
 * aurora em deriva, campo de pontos, hub central com anel orbitando e
 * ondas de convite saindo, arestas com tracejado fluindo até os nós
 * indicados (que flutuam), sparkles, confetes e chips de contexto.
 * CSS puro (classes hero- e arena- do globals.css), aria-hidden.
 */

/** Nós indicados — posição em % do container (casa com as arestas do SVG). */
const NODES = [
  {
    icon: UserPlus,
    x: 26,
    y: 17,
    delay: 0.4,
    dur: 7,
    tone: "cyan" as const,
    lgOnly: false,
  },
  {
    icon: Users,
    x: 88,
    y: 24,
    delay: 2.1,
    dur: 8.2,
    tone: "mint" as const,
    lgOnly: false,
  },
  {
    icon: SealCheck,
    x: 24,
    y: 76,
    delay: 1.2,
    dur: 7.8,
    tone: "green" as const,
    lgOnly: false,
  },
  {
    icon: UserPlus,
    x: 88,
    y: 78,
    delay: 3.2,
    dur: 8.6,
    tone: "mint" as const,
    lgOnly: true,
  },
  {
    icon: Users,
    x: 52,
    y: 92,
    delay: 4.1,
    dur: 9,
    tone: "cyan" as const,
    lgOnly: true,
  },
] as const;

const HUB = { x: 58, y: 47 };

const TONE_CLASS = {
  cyan: "text-[var(--brand-cyan)]",
  mint: "text-[var(--brand-mint)]",
  green: "text-[var(--brand-green)]",
} as const;

const SPARKLES = [
  { left: "36%", top: "12%", size: 11, delay: 0, dur: 3.6, lgOnly: false },
  { left: "72%", top: "8%", size: 9, delay: 1.6, dur: 4.4, lgOnly: true },
  { left: "40%", top: "62%", size: 10, delay: 2.5, dur: 3.9, lgOnly: false },
  { left: "94%", top: "50%", size: 8, delay: 3.4, dur: 4.2, lgOnly: true },
] as const;

const CONFETTI = [
  { left: "50%", top: "2%", w: 5, h: 5, delay: 0, dur: 5.4, x: 22, rot: 240 },
  { left: "64%", top: "6%", w: 4, h: 8, delay: 1.7, dur: 6, x: -14, rot: 320 },
  {
    left: "80%",
    top: "3%",
    w: 5,
    h: 5,
    delay: 3.2,
    dur: 5.6,
    x: -32,
    rot: 210,
  },
] as const;

export function AffiliatesHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-12 right-[18%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[40%] bottom-[4%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* campo de pontos */}
        <div className="absolute inset-0 bg-[radial-gradient(color-mix(in_oklab,var(--brand-cyan)_22%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_60%_48%,#000_25%,transparent_75%)] [background-size:22px_22px] opacity-50" />

        {/* arestas da rede: hub → indicados, com tracejado fluindo */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          {NODES.map((node, index) => (
            <line
              key={index}
              x1={HUB.x}
              y1={HUB.y}
              x2={node.x}
              y2={node.y}
              stroke="color-mix(in oklab, var(--brand-mint) 55%, transparent)"
              strokeWidth={1.2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="hero-trace"
              style={{ animationDelay: `${index * -0.45}s` }}
            />
          ))}
        </svg>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[6%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-mint)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "12s",
              "--comet-delay": "4s",
              "--comet-x": "-300px",
              "--comet-y": "200px",
              "--comet-angle": "-34deg",
            } as React.CSSProperties
          }
        />

        {/* confetes de convite caindo */}
        {CONFETTI.map((confetti, index) => (
          <span
            key={index}
            className="arena-confetti absolute rounded-[2px] bg-[var(--brand-mint)]"
            style={
              {
                left: confetti.left,
                top: confetti.top,
                width: confetti.w,
                height: confetti.h,
                "--confetti-delay": `${confetti.delay}s`,
                "--confetti-dur": `${confetti.dur}s`,
                "--confetti-x": `${confetti.x}px`,
                "--confetti-rot": `${confetti.rot}deg`,
                "--confetti-opacity": 0.8,
              } as React.CSSProperties
            }
          />
        ))}

        {/* sparkles cintilando */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute text-[var(--brand-cyan)]",
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

        {/* nós indicados flutuando nas pontas das arestas */}
        {NODES.map(
          ({ icon: NodeIcon, x, y, delay, dur, tone, lgOnly }, index) => (
            // wrapper faz o centramento; o filho carrega a animação
            // (as keyframes sobrescrevem transform).
            <span
              key={index}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2",
                lgOnly && "hidden lg:block",
              )}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span
                className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 flex size-9 items-center justify-center rounded-xl shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:size-10"
                style={
                  {
                    "--float-delay": `${delay}s`,
                    "--float-dur": `${dur}s`,
                  } as React.CSSProperties
                }
              >
                <NodeIcon
                  className={cn("size-4.5 lg:size-5", TONE_CLASS[tone])}
                  weight="fill"
                />
              </span>
            </span>
          ),
        )}

        {/* hub central: você — ondas de convite + anel orbitando */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}
        >
          <div
            className="arena-tilt relative"
            style={{ "--float-dur": "6.8s" } as React.CSSProperties}
          >
            <span
              className="arena-ripple absolute -inset-6 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)]"
              style={{ "--ripple-dur": "4.4s" } as React.CSSProperties}
            />
            <span
              className="arena-ripple absolute -inset-6 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_22%,transparent)]"
              style={
                {
                  "--ripple-dur": "4.4s",
                  "--ripple-delay": "2.2s",
                } as React.CSSProperties
              }
            />
            <span className="arena-ring absolute -inset-3 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)]" />
            <span className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_38px_-10px_rgba(31,254,200,0.55)] lg:size-13">
              <ShareNetwork className="size-5.5 lg:size-6" weight="fill" />
            </span>
          </div>
        </div>

        {/* chips de contexto */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[4%] right-[3%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={
            {
              "--float-delay": "1.4s",
              "--float-dur": "8.2s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <UserPlus className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Convites
          </span>
          <span className="text-foreground text-xs font-bold">
            Um link, rede inteira
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[4%] bottom-[8%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={
            {
              "--float-delay": "2.8s",
              "--float-dur": "7.4s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <SealCheck className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Verificados
          </span>
          <span className="text-foreground text-xs font-bold">
            Indicações que viram clipador
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Fantasma da rede de convites: arestas hub → indicados, hub central
 * com ondas e os nós flutuando nas pontas, nas mesmas coordenadas.
 */
export function AffiliatesHeroVizSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <VizGhost className={className} focus="60%">
      {/* arestas da rede */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {NODES.map((node, index) => (
          <line
            key={index}
            x1={HUB.x}
            y1={HUB.y}
            x2={node.x}
            y2={node.y}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1.2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className={cn("hero-trace", node.lgOnly && "hidden lg:block")}
            style={{ animationDelay: `${index * -0.45}s` }}
          />
        ))}
      </svg>

      {/* nós indicados */}
      {NODES.map((node, index) => (
        <span
          key={index}
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2",
            node.lgOnly && "hidden lg:block",
          )}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <span
            className="hero-float block size-9 lg:size-10"
            style={
              {
                "--float-delay": `${node.delay}s`,
                "--float-dur": `${node.dur}s`,
              } as React.CSSProperties
            }
          >
            <GBone delay={index * 110} className="size-full rounded-xl" />
          </span>
        </span>
      ))}

      {/* hub central */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}
      >
        <div
          className="hero-float relative"
          style={{ "--float-dur": "6.8s" } as React.CSSProperties}
        >
          <span
            className="arena-ripple absolute -inset-6 rounded-full bg-white/8"
            style={{ "--ripple-dur": "4.4s" } as React.CSSProperties}
          />
          <span className="arena-ring absolute -inset-3 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <GBone className="size-12 rounded-full lg:size-13" />
        </div>
      </div>

      {/* chips de contexto */}
      <GChip
        className="absolute top-[4%] right-[3%] hidden lg:flex"
        floatDelay={1.4}
        floatDur={8.2}
      />
      <GChip
        className="absolute right-[4%] bottom-[8%]"
        floatDelay={2.8}
        floatDur={7.4}
        delay={160}
      />
    </VizGhost>
  );
}
