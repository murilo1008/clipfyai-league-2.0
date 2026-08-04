import {
  Check,
  CheckCircle,
  Clock,
  Heart,
  ShieldCheck,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Comentários do Blog — "conversa ao vivo":
 * aurora violeta + esmeralda em deriva, três balões de fala glass entrando
 * em sequência (arena-rise) e depois flutuando, barras de "texto" com uma
 * delas se escrevendo (hero-clip-progress), três pontinhos de "digitando"
 * no balão mais recente, selo de moderação com anel pulsante, corações
 * subindo, chips flutuantes, sparkles e cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

type BubbleLine = { width: string; writing?: boolean }

const BUBBLES: {
  key: string
  side: "left" | "right"
  accent: "violet" | "emerald"
  position: string
  riseDelay: number
  floatDelay: number
  floatDur: number
  lines: readonly BubbleLine[]
  typing?: boolean
}[] = [
  {
    key: "primeiro",
    side: "left",
    accent: "violet",
    position: "top-[13%] right-[30%]",
    riseDelay: 0.2,
    floatDelay: 0,
    floatDur: 7.2,
    lines: [{ width: "88%" }, { width: "58%" }],
  },
  {
    key: "resposta",
    side: "right",
    accent: "emerald",
    position: "top-[46%] right-[5%]",
    riseDelay: 1,
    floatDelay: 1.1,
    floatDur: 8.2,
    lines: [{ width: "82%", writing: true }, { width: "50%" }],
  },
  {
    key: "digitando",
    side: "left",
    accent: "violet",
    position: "bottom-[11%] right-[30%]",
    riseDelay: 1.8,
    floatDelay: 2.2,
    floatDur: 6.6,
    lines: [{ width: "72%" }],
    typing: true,
  },
]

/** Pontinhos de "digitando" — pulsam em sequência. */
const TYPING_DOTS = [0, 0.2, 0.4] as const

const HEARTS = [
  { left: "54%", bottom: "26%", size: 11, delay: 0.6, dur: 5.8, x: 14, opacity: 0.9 },
  { left: "65%", bottom: "32%", size: 9, delay: 2.4, dur: 6.6, x: -12, opacity: 0.7 },
  { left: "76%", bottom: "22%", size: 13, delay: 1.4, dur: 5.4, x: 10, opacity: 0.85 },
  { left: "86%", bottom: "30%", size: 9, delay: 3.6, dur: 6.2, x: -8, opacity: 0.65 },
] as const

const SPARKLES = [
  { left: "36%", top: "9%", size: 11, delay: 0.4, dur: 3.6, color: "mint", lgOnly: false },
  { left: "58%", top: "5%", size: 9, delay: 1.6, dur: 4.4, color: "cyan", lgOnly: true },
  { left: "80%", top: "34%", size: 12, delay: 2.4, dur: 3.4, color: "mint", lgOnly: false },
  { left: "48%", top: "66%", size: 9, delay: 1, dur: 4.8, color: "cyan", lgOnly: true },
  { left: "92%", top: "58%", size: 8, delay: 3.2, dur: 3.8, color: "mint", lgOnly: true },
] as const

export function BlogCommentsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora violeta + esmeralda em deriva */}
        <span className="arena-aurora absolute -top-16 right-[8%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#8b5cf6_36%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[38%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#10b981_26%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6.5s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_70%_55%,#000_28%,transparent_78%)]" />

        {/* feixe de luz varrendo a conversa */}
        <div className="absolute inset-y-0 left-1/3 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,#8b5cf6_16%,transparent)] to-transparent" />
        </div>

        {/* cometa */}
        <span
          className="arena-comet absolute top-[4%] right-[12%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,#8b5cf6_75%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10.5s",
              "--comet-delay": "2.6s",
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

        {/* corações subindo dos balões */}
        {HEARTS.map((heart, index) => (
          <Heart
            key={index}
            weight="fill"
            className={cn(
              "arena-particle absolute text-rose-400",
              index === 3 && "hidden lg:block",
            )}
            style={
              {
                left: heart.left,
                bottom: heart.bottom,
                width: heart.size,
                height: heart.size,
                "--particle-delay": `${heart.delay}s`,
                "--particle-dur": `${heart.dur}s`,
                "--particle-x": `${heart.x}px`,
                "--particle-opacity": heart.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* balões de fala entrando em sequência */}
        {BUBBLES.map(({ key, ...bubble }) => (
          <SpeechBubble key={key} {...bubble} />
        ))}

        {/* selo de moderação sobre o balão aprovado */}
        <div
          className="arena-tilt absolute top-[30%] right-[24%]"
          style={
            {
              "--float-dur": "6.4s",
              "--float-delay": "1.4s",
            } as React.CSSProperties
          }
        >
          <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
          <span className="bg-gradient-custom relative flex size-9 items-center justify-center rounded-xl text-[#04222A] shadow-[0_14px_40px_-10px_rgba(31,254,200,0.55)] lg:size-10 xl:size-11">
            <ShieldCheck className="size-5 xl:size-6" weight="fill" />
          </span>
          <span className="absolute -right-1.5 -bottom-1.5 flex size-4.5 items-center justify-center rounded-full bg-emerald-400 text-[#04222A] ring-2 ring-[#050f1c]">
            <Check className="size-2.5" weight="bold" />
          </span>
        </div>

        {/* chips flutuantes */}
        <FloatChip
          icon={<Clock className="size-3 text-[#04222A]" weight="fill" />}
          label="Moderação"
          value="12 pendentes"
          chipClass="bg-amber-400"
          className="top-[4%] right-[5%]"
          delay={0.6}
          duration={7.4}
        />
        <FloatChip
          icon={<CheckCircle className="size-3 text-[#04222A]" weight="fill" />}
          label="Comunidade"
          value="Aprovado"
          chipClass="bg-emerald-400"
          className="bottom-[6%] right-[4%] hidden lg:flex"
          delay={2.2}
          duration={8.6}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SpeechBubble({
  side,
  accent,
  position,
  riseDelay,
  floatDelay,
  floatDur,
  lines,
  typing = false,
}: {
  side: "left" | "right"
  accent: "violet" | "emerald"
  position: string
  riseDelay: number
  floatDelay: number
  floatDur: number
  lines: readonly BubbleLine[]
  typing?: boolean
}) {
  return (
    <div
      className={cn("arena-podium absolute", position)}
      style={{ "--rise-delay": `${riseDelay}s` } as React.CSSProperties}
    >
      <div
        className="hero-float relative w-[clamp(108px,13vw,180px)]"
        style={
          {
            "--float-delay": `${floatDelay}s`,
            "--float-dur": `${floatDur}s`,
          } as React.CSSProperties
        }
      >
        {/* corpo do balão */}
        <div
          className={cn(
            "bg-card/70 supports-[backdrop-filter]:bg-card/45 relative flex flex-col gap-2 rounded-2xl px-3 py-2.5 shadow-lg ring-1 backdrop-blur-md",
            accent === "violet"
              ? "ring-[color-mix(in_oklab,#8b5cf6_38%,transparent)]"
              : "ring-[color-mix(in_oklab,#10b981_38%,transparent)]",
          )}
        >
          {/* autor: avatar + nome */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-4 shrink-0 rounded-full",
                accent === "violet"
                  ? "bg-[color-mix(in_oklab,#8b5cf6_70%,transparent)]"
                  : "bg-gradient-custom",
              )}
            />
            <span className="block h-1.5 w-9 rounded-full bg-white/25" />
          </div>

          {/* barras de "texto" */}
          <div className="flex flex-col gap-1.5">
            {lines.map((line, index) =>
              line.writing ? (
                <span
                  key={index}
                  className="block h-1.5 overflow-hidden rounded-full bg-white/8"
                  style={{ width: line.width }}
                >
                  <span
                    className="hero-clip-progress bg-gradient-custom block h-full rounded-full"
                    style={
                      {
                        width: "6%",
                        "--clip-dur": "4.6s",
                        "--clip-delay": "1.4s",
                      } as React.CSSProperties
                    }
                  />
                </span>
              ) : (
                <span
                  key={index}
                  className="block h-1.5 rounded-full bg-white/14"
                  style={{ width: line.width }}
                />
              ),
            )}
          </div>

          {/* três pontinhos de "digitando" */}
          {typing && (
            <div className="flex items-center gap-1 pt-0.5">
              {TYPING_DOTS.map((delay, index) => (
                <span
                  key={index}
                  className="arena-twinkle size-1.5 rounded-full bg-[var(--brand-mint)]"
                  style={
                    {
                      "--twinkle-delay": `${delay}s`,
                      "--twinkle-dur": "1.4s",
                      "--twinkle-opacity": 0.95,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* rabinho do balão */}
        <span
          className={cn(
            "bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute -bottom-[7px] h-2 w-3 backdrop-blur-md",
            side === "left"
              ? "left-5 [clip-path:polygon(0_0,100%_0,0_100%)]"
              : "right-5 [clip-path:polygon(0_0,100%_0,100%_100%)]",
          )}
        />
      </div>
    </div>
  )
}

function FloatChip({
  icon,
  label,
  value,
  chipClass,
  className,
  delay,
  duration,
}: {
  icon: React.ReactNode
  label: string
  value: string
  chipClass: string
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
        <span
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-full",
            chipClass,
          )}
        >
          {icon}
        </span>
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  )
}

/**
 * Fantasma da conversa: os mesmos balões entrando em sequência (com as
 * larguras reais das linhas) e o selo de moderação sobre o aprovado.
 */
export function BlogCommentsHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="70%">
      {/* balões de fala */}
      {BUBBLES.map((bubble, index) => (
        <div
          key={bubble.key}
          className={cn("absolute w-[clamp(108px,13vw,180px)]", bubble.position)}
        >
          <GPanel
            floatDelay={bubble.floatDelay}
            floatDur={bubble.floatDur}
            className="flex flex-col gap-1.5 p-2.5"
          >
            <span className="flex items-center gap-1.5">
              <GBone delay={index * 140} className="size-4 shrink-0 rounded-full" />
              <GBone delay={index * 140 + 60} className="h-2 w-12 rounded-full" />
            </span>
            <GLines
              widths={bubble.lines.map((line) => line.width)}
              delay={index * 140 + 120}
            />
          </GPanel>
        </div>
      ))}

      {/* selo de moderação */}
      <div
        className="hero-float absolute top-[30%] right-[24%]"
        style={
          {
            "--float-dur": "6.4s",
            "--float-delay": "1.4s",
          } as React.CSSProperties
        }
      >
        <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-white/8" />
        <GBone className="size-9 rounded-xl lg:size-10 xl:size-11" />
      </div>

      {/* chips */}
      <GChip className="absolute top-[6%] right-[6%]" floatDelay={0.9} floatDur={7.6} />
      <GChip
        className="absolute bottom-[10%] right-[38%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
