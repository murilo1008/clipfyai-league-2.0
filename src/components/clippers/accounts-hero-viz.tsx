import { At, Crown, Sparkle, Users } from "@phosphor-icons/react/dist/ssr"

import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Contas — constelação de contas:
 * céu escuro com aurora e nebulosa, hub central de arroba com anéis,
 * cinco nós de plataforma como estrelas de uma constelação ligadas por
 * linhas traçadas em SVG, estrelas cintilando, chips de métricas e
 * cometa. CSS puro, aria-hidden, fluido de md a xl.
 */

const CONSTELLATION_NODES: {
  platform: PlatformKey
  className: string
  delay: number
  dur: number
  x: number
  y: number
  hiddenLg?: boolean
}[] = [
  { platform: "YOUTUBE", className: "top-[8%] right-[9%]", delay: 0, dur: 6.8, x: 87, y: 16 },
  { platform: "INSTAGRAM", className: "top-[6%] right-[46%]", delay: 1.2, dur: 7.6, x: 50, y: 14 },
  { platform: "TIKTOK", className: "top-[54%] right-[6%]", delay: 2.1, dur: 7.2, x: 90, y: 62 },
  { platform: "KWAI", className: "top-[66%] right-[44%]", delay: 3, dur: 8, x: 52, y: 74 },
  { platform: "FACEBOOK", className: "top-[78%] right-[18%] hidden lg:flex", delay: 0.8, dur: 7, x: 78, y: 86, hiddenLg: true },
]

const HUB = { x: 65, y: 49 } as const

const STARS = [
  { left: "26%", top: "14%", size: 3, delay: 0.2, dur: 3.4, color: "white", lgOnly: false },
  { left: "38%", top: "38%", size: 2, delay: 1.4, dur: 4.2, color: "cyan", lgOnly: false },
  { left: "58%", top: "6%", size: 2, delay: 2.6, dur: 3.8, color: "white", lgOnly: false },
  { left: "72%", top: "30%", size: 3, delay: 0.9, dur: 4.6, color: "mint", lgOnly: false },
  { left: "84%", top: "44%", size: 2, delay: 3.4, dur: 3.6, color: "white", lgOnly: false },
  { left: "48%", top: "58%", size: 2, delay: 1.9, dur: 4.4, color: "cyan", lgOnly: false },
  { left: "30%", top: "72%", size: 3, delay: 2.9, dur: 3.9, color: "white", lgOnly: true },
  { left: "94%", top: "12%", size: 2, delay: 4.1, dur: 4.8, color: "mint", lgOnly: true },
] as const

const SPARKLE_STARS = [
  { left: "44%", top: "24%", size: 10, delay: 0.6, dur: 4 },
  { left: "80%", top: "70%", size: 9, delay: 2.4, dur: 3.5 },
] as const

export function AccountsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* céu profundo: nebulosa estática + vinheta */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_26%,color-mix(in_oklab,var(--brand-cyan)_10%,transparent),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_45%_80%,color-mix(in_oklab,var(--brand-green)_7%,transparent),transparent_55%)]" />

        {/* aurora escura em deriva */}
        <span className="arena-aurora absolute -top-16 right-[24%] size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_18%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[6%] bottom-[-10%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-mint)_13%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-9s" }}
        />

        {/* cometa cruzando o céu */}
        <span
          className="arena-comet absolute top-[4%] right-[14%] h-px w-28 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "12s",
              "--comet-delay": "2.5s",
              "--comet-x": "-340px",
              "--comet-y": "240px",
              "--comet-angle": "-35deg",
            } as React.CSSProperties
          }
        />

        {/* estrelas cintilando */}
        {STARS.map((star, index) => (
          <span
            key={index}
            className={cn(
              "arena-twinkle absolute rounded-full",
              star.color === "white" && "bg-white/80",
              star.color === "cyan" && "bg-[var(--brand-cyan)]",
              star.color === "mint" && "bg-[var(--brand-mint)]",
              star.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                boxShadow: "0 0 6px 1px color-mix(in oklab, currentColor 40%, transparent)",
                "--twinkle-delay": `${star.delay}s`,
                "--twinkle-dur": `${star.dur}s`,
                "--twinkle-opacity": 0.85,
              } as React.CSSProperties
            }
          />
        ))}
        {SPARKLE_STARS.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className="arena-twinkle absolute hidden text-[var(--brand-mint)] lg:block"
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

        {/* linhas da constelação */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
        >
          {CONSTELLATION_NODES.map((node, index) => (
            <line
              key={node.platform}
              x1={HUB.x}
              y1={HUB.y}
              x2={node.x}
              y2={node.y}
              className={cn("hero-trace", node.hiddenLg && "hidden lg:block")}
              stroke="color-mix(in oklab, var(--brand-cyan) 30%, transparent)"
              strokeWidth={1}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${index * -0.5}s` }}
            />
          ))}
          {/* arestas secundárias entre nós, mais tênues */}
          <line
            x1={50}
            y1={14}
            x2={87}
            y2={16}
            className="hero-trace"
            stroke="color-mix(in oklab, var(--brand-mint) 18%, transparent)"
            strokeWidth={1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: "-1.2s" }}
          />
          <line
            x1={90}
            y1={62}
            x2={78}
            y2={86}
            className="hero-trace hidden lg:block"
            stroke="color-mix(in oklab, var(--brand-mint) 18%, transparent)"
            strokeWidth={1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: "-2.1s" }}
          />
        </svg>

        {/* hub central de arroba */}
        <div
          className="arena-tilt absolute top-[36%] right-[27%] xl:right-[29%]"
          style={{ "--float-dur": "7.2s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-cyan)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-mint)_60%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          {/* satélite orbitando o hub */}
          <span
            className="arena-ring absolute -inset-6 rounded-full"
            style={{ animationDuration: "14s" }}
          >
            <span className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[var(--brand-cyan)] shadow-[0_0_8px_2px_color-mix(in_oklab,var(--brand-cyan)_60%,transparent)]" />
            <span className="absolute right-[10%] bottom-[12%] size-1 rounded-full bg-[var(--brand-mint)] shadow-[0_0_6px_1.5px_color-mix(in_oklab,var(--brand-mint)_60%,transparent)]" />
          </span>
          <span className="bg-gradient-custom relative flex size-12 items-center justify-center rounded-full text-[#04222A] shadow-[0_14px_44px_-10px_rgba(31,254,200,0.55)] lg:size-13 xl:size-14">
            <At className="size-6 lg:size-6.5 xl:size-7" weight="bold" />
          </span>
        </div>

        {/* nós de plataforma da constelação */}
        {CONSTELLATION_NODES.map(({ platform, className: posClass, delay, dur }) => {
          const config = platformConfig[platform]
          const PlatformIcon = config.icon
          return (
            <span
              key={platform}
              className={cn(
                "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex size-9 items-center justify-center rounded-full shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] backdrop-blur-md lg:size-10",
                posClass,
              )}
              style={
                {
                  "--float-delay": `${delay}s`,
                  "--float-dur": `${dur}s`,
                } as React.CSSProperties
              }
            >
              <PlatformIcon className={cn("size-4.5 lg:size-5", config.color)} />
            </span>
          )
        })}

        {/* mini chips de métricas */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute right-[34%] bottom-[8%] inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md"
          style={{ "--float-delay": "1.6s", "--float-dur": "7.8s" } as React.CSSProperties}
        >
          <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
            <Users className="size-3 text-[#04222A]" weight="fill" />
          </span>
          <span className="text-foreground text-[11px] font-bold whitespace-nowrap">
            12,4K seguidores
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[24%] right-[4%] hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:inline-flex"
          style={{ "--float-delay": "0.4s", "--float-dur": "8.6s" } as React.CSSProperties}
        >
          <Crown className="size-3.5 text-amber-400" weight="fill" />
          <span className="text-foreground text-[11px] font-bold whitespace-nowrap">
            Conta principal
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma da constelação de contas: as mesmas arestas saindo do hub,
 * o hub de arroba com anel orbitando, os nós de plataforma e as pílulas.
 */
export function AccountsHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="72%">
      {/* arestas da constelação */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {CONSTELLATION_NODES.map((node, index) => (
          <line
            key={node.platform}
            x1={HUB.x}
            y1={HUB.y}
            x2={node.x}
            y2={node.y}
            className={cn("hero-trace", node.hiddenLg && "hidden lg:block")}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ animationDelay: `${index * -0.5}s` }}
          />
        ))}
      </svg>

      {/* hub central */}
      <div
        className="hero-float absolute top-[36%] right-[27%] xl:right-[29%]"
        style={{ "--float-dur": "7.2s" } as React.CSSProperties}
      >
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]" />
        <GBone className="size-12 rounded-full lg:size-13 xl:size-14" />
      </div>

      {/* nós de plataforma */}
      {CONSTELLATION_NODES.map((node, index) => (
        <div
          key={node.platform}
          className={cn(
            "hero-float absolute size-9 lg:size-10",
            node.className,
          )}
          style={
            {
              "--float-delay": `${node.delay}s`,
              "--float-dur": `${node.dur}s`,
            } as React.CSSProperties
          }
        >
          <GBone delay={index * 100} className="size-full rounded-full" />
        </div>
      ))}

      {/* pílulas de métrica */}
      <GPanel
        className="absolute right-[34%] bottom-[8%] flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
        floatDelay={1.6}
        floatDur={7.8}
      >
        <GBone className="size-4 shrink-0 rounded-full" />
        <GBone delay={80} className="h-2 w-20 rounded-full" />
      </GPanel>
      <GPanel
        className="absolute top-[24%] right-[4%] hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 lg:flex"
        floatDelay={0.4}
        floatDur={8.6}
      >
        <GBone delay={140} className="size-4 shrink-0 rounded-full" />
        <GBone delay={200} className="h-2 w-16 rounded-full" />
      </GPanel>
    </VizGhost>
  )
}
