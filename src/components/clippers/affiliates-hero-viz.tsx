import {
  LinkSimple,
  SealCheck,
  ShareNetwork,
  Sparkle,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Afiliados — rede de indicações:
 * aurora em deriva, campo de pontos, hub central da marca com anéis
 * pulsando, arestas com fluxo de tracejado saindo do hub para os nós
 * indicados (flutuando), sparkles e chips de apoio. CSS puro,
 * aria-hidden e reduced-motion respeitado pelas classes globais.
 */

/* Coordenadas em % do container — o SVG usa viewBox 0..100 com
   preserveAspectRatio="none", então x/y batem com left/top dos nós. */
const HUB = { x: 62, y: 48 };

const NODES = [
  {
    x: 40,
    y: 15,
    icon: UserPlus,
    size: "size-9 lg:size-10",
    iconSize: "size-4.5 lg:size-5",
    delay: 0.2,
    dur: 6.8,
    lgOnly: false,
  },
  {
    x: 89,
    y: 19,
    icon: SealCheck,
    size: "size-9 lg:size-10",
    iconSize: "size-4.5 lg:size-5",
    delay: 1.4,
    dur: 7.6,
    lgOnly: false,
  },
  {
    x: 93,
    y: 58,
    icon: UsersThree,
    size: "size-8 lg:size-9",
    iconSize: "size-4 lg:size-4.5",
    delay: 2.6,
    dur: 8.2,
    lgOnly: true,
  },
  {
    x: 71,
    y: 87,
    icon: LinkSimple,
    size: "size-8 lg:size-9",
    iconSize: "size-4 lg:size-4.5",
    delay: 0.9,
    dur: 7.2,
    lgOnly: false,
  },
  {
    x: 37,
    y: 78,
    icon: UserPlus,
    size: "size-8 lg:size-9",
    iconSize: "size-4 lg:size-4.5",
    delay: 3.2,
    dur: 8.6,
    lgOnly: true,
  },
] as const;

const SPARKLES = [
  { left: "50%", top: "8%", size: 11, delay: 0, dur: 3.6, tone: "mint" },
  { left: "80%", top: "40%", size: 9, delay: 1.5, dur: 4.4, tone: "cyan" },
  { left: "58%", top: "72%", size: 10, delay: 2.4, dur: 3.4, tone: "mint" },
  { left: "94%", top: "82%", size: 8, delay: 3.4, dur: 4.2, tone: "cyan" },
] as const;

const RIPPLES = [
  { delay: 0, dur: 4.2 },
  { delay: 1.4, dur: 4.2 },
  { delay: 2.8, dur: 4.2 },
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
        <span className="arena-aurora absolute -top-16 right-[14%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[38%] bottom-[-8%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* campo de pontos */}
        <div className="absolute inset-0 bg-[radial-gradient(color-mix(in_oklab,var(--brand-cyan)_22%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_64%_48%,#000_28%,transparent_74%)] [background-size:22px_22px] opacity-50" />

        {/* cometa */}
        <span
          className="arena-comet absolute top-[6%] right-[6%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-mint)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "12s",
              "--comet-delay": "4s",
              "--comet-x": "-300px",
              "--comet-y": "220px",
              "--comet-angle": "-35deg",
            } as React.CSSProperties
          }
        />

        {/* arestas da rede: do hub para cada indicado */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="aff-edge" x1="0" y1="0" x2="1" y2="1">
              <stop
                offset="0%"
                stopColor="color-mix(in oklab, var(--brand-cyan) 85%, transparent)"
              />
              <stop
                offset="100%"
                stopColor="color-mix(in oklab, var(--brand-green) 20%, transparent)"
              />
            </linearGradient>
          </defs>
          {NODES.map((node, index) => (
            <line
              key={index}
              x1={HUB.x}
              y1={HUB.y}
              x2={node.x}
              y2={node.y}
              stroke="url(#aff-edge)"
              strokeWidth={1.25}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className={cn("hero-trace", node.lgOnly && "hidden lg:block")}
              style={{ animationDelay: `${index * 0.35}s` }}
            />
          ))}
        </svg>

        {/* halo do hub */}
        <span
          className="absolute size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_18%,transparent),transparent_68%)] blur-xl"
          style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}
        />

        {/* hub central: anéis pulsando + chip gradiente */}
        <div
          className="arena-tilt absolute -translate-x-1/2 -translate-y-1/2"
          style={
            {
              left: `${HUB.x}%`,
              top: `${HUB.y}%`,
              "--float-dur": "7.2s",
            } as React.CSSProperties
          }
        >
          {RIPPLES.map((ripple, index) => (
            <span
              key={index}
              className="arena-ripple absolute -inset-5 rounded-full ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]"
              style={
                {
                  "--ripple-delay": `${ripple.delay}s`,
                  "--ripple-dur": `${ripple.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
          <span className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_38px_-10px_rgba(31,254,200,0.55)] lg:size-13 xl:size-14">
            <ShareNetwork className="size-6 lg:size-7" weight="fill" />
          </span>
        </div>

        {/* nós indicados */}
        {NODES.map(
          (
            { x, y, icon: NodeIcon, size, iconSize, delay, dur, lgOnly },
            index,
          ) => (
            <span
              key={index}
              className={cn(
                "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] backdrop-blur-md",
                size,
                lgOnly && "hidden lg:flex",
              )}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  "--float-delay": `${delay}s`,
                  "--float-dur": `${dur}s`,
                } as React.CSSProperties
              }
            >
              <NodeIcon
                className={cn("text-[var(--brand-mint)]", iconSize)}
                weight="fill"
              />
            </span>
          ),
        )}

        {/* sparkles cintilando */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.tone === "mint"
                ? "text-[var(--brand-mint)]"
                : "text-[var(--brand-cyan)]",
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

        {/* chips flutuantes */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[64%] right-[4%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={
            {
              "--float-delay": "1.2s",
              "--float-dur": "7.6s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <UserPlus className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Indicações
          </span>
          <span className="text-foreground text-xs font-bold">
            Clipador trazendo clipador
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[6%] right-[2%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md xl:flex"
          style={
            {
              "--float-delay": "2.8s",
              "--float-dur": "8.4s",
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <SealCheck className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Conversão
          </span>
          <span className="text-foreground text-xs font-bold">
            Cadastro vira clipador
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Fantasma da rede de indicações: arestas do hub para cada nó, hub
 * central com ondas e os nós indicados nas mesmas coordenadas.
 */
export function AffiliatesAdminHeroVizSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <VizGhost className={className} focus="64%">
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
            strokeWidth={1.25}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className={cn("hero-trace", node.lgOnly && "hidden lg:block")}
            style={{ animationDelay: `${index * 0.35}s` }}
          />
        ))}
      </svg>

      {/* hub central */}
      <div
        className="hero-float absolute -translate-x-1/2 -translate-y-1/2"
        style={
          {
            left: `${HUB.x}%`,
            top: `${HUB.y}%`,
            "--float-dur": "7.2s",
          } as React.CSSProperties
        }
      >
        <span
          className="arena-ripple absolute -inset-5 rounded-full ring-1 ring-white/15"
          style={{ "--ripple-dur": "4.4s" } as React.CSSProperties}
        />
        <GBone className="size-12 rounded-full lg:size-13 xl:size-14" />
      </div>

      {/* nós indicados */}
      {NODES.map((node, index) => (
        <div
          key={index}
          className={cn(
            "hero-float absolute -translate-x-1/2 -translate-y-1/2",
            node.size,
            node.lgOnly && "hidden lg:block",
          )}
          style={
            {
              left: `${node.x}%`,
              top: `${node.y}%`,
              "--float-delay": `${node.delay}s`,
              "--float-dur": `${node.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 110} className="size-full rounded-full" />
        </div>
      ))}

      {/* chips */}
      <GChip
        className="absolute top-[64%] right-[4%]"
        floatDelay={1.2}
        floatDur={7.6}
      />
      <GChip
        className="absolute top-[6%] right-[2%] hidden xl:flex"
        floatDelay={2.8}
        floatDur={8.4}
        delay={150}
      />
    </VizGhost>
  );
}
