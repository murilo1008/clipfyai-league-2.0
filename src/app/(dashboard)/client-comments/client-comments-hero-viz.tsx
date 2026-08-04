import {
  ChatCircleDots,
  ChatsCircle,
  Smiley,
  SmileyMeh,
  SmileySad,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Comentários (cliente) — "a audiência
 * falando": aurora em deriva, balões de comentário flutuando com linhas que
 * se escrevem, painel glass de percepção com as barras de sentimento
 * enchendo, carinhas de sentimento, sparkles, partículas e um cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  {
    left: "22%",
    top: "14%",
    size: 12,
    delay: 0,
    dur: 3.6,
    tone: "mint",
    lgOnly: false,
  },
  {
    left: "56%",
    top: "7%",
    size: 9,
    delay: 1.6,
    dur: 4.4,
    tone: "cyan",
    lgOnly: true,
  },
  {
    left: "82%",
    top: "22%",
    size: 13,
    delay: 2.4,
    dur: 3.9,
    tone: "mint",
    lgOnly: false,
  },
  {
    left: "90%",
    top: "52%",
    size: 9,
    delay: 0.9,
    dur: 4.2,
    tone: "cyan",
    lgOnly: false,
  },
  {
    left: "36%",
    top: "34%",
    size: 8,
    delay: 3.1,
    dur: 3.4,
    tone: "cyan",
    lgOnly: true,
  },
] as const;

const PARTICLES = [
  {
    left: "20%",
    bottom: "22%",
    size: 3,
    delay: 0,
    dur: 5.4,
    x: 10,
    opacity: 0.8,
  },
  {
    left: "38%",
    bottom: "16%",
    size: 2,
    delay: 1.9,
    dur: 6.6,
    x: -12,
    opacity: 0.55,
  },
  {
    left: "56%",
    bottom: "26%",
    size: 4,
    delay: 0.8,
    dur: 5.8,
    x: 8,
    opacity: 0.85,
  },
  {
    left: "74%",
    bottom: "18%",
    size: 2,
    delay: 2.7,
    dur: 6.2,
    x: -8,
    opacity: 0.6,
  },
  {
    left: "88%",
    bottom: "30%",
    size: 3,
    delay: 3.5,
    dur: 5.6,
    x: 12,
    opacity: 0.75,
  },
] as const;

/** Barras de sentimento do painel — enchem em loop com hero-clip-progress. */
const SENTIMENT_BARS = [
  { width: "w-full", tone: "positive", dur: 5.2, delay: 0.3 },
  { width: "w-3/5", tone: "neutral", dur: 6.4, delay: 1.4 },
  { width: "w-2/5", tone: "negative", dur: 7.2, delay: 2.6 },
] as const;

export function ClientCommentsHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-16 right-[14%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_28%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[46%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* cometa cruzando o topo */}
        <span
          className="arena-comet absolute top-[7%] right-[8%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2.5s",
              "--comet-x": "-320px",
              "--comet-y": "210px",
              "--comet-angle": "-33deg",
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

        {/* ===== painel de percepção + balões ===== */}
        <div className="absolute top-1/2 right-[14%] -translate-y-1/2 lg:right-[18%] xl:right-[21%]">
          {/* balão de comentário à esquerda */}
          <CommentBubble
            className="-top-2 -left-[clamp(76px,8.5vw,116px)] w-[clamp(104px,11vw,138px)] -rotate-[7deg]"
            floatDelay={1.4}
            floatDur={8.4}
            lines={["w-full", "w-3/5"]}
          />
          {/* balão de comentário à direita (lg+) */}
          <CommentBubble
            className="-right-[clamp(52px,6vw,86px)] bottom-2 hidden w-[clamp(96px,10vw,126px)] rotate-[8deg] lg:block"
            floatDelay={2.9}
            floatDur={7.2}
            lines={["w-4/5", "w-full", "w-1/2"]}
          />

          {/* painel central — percepção pública consolidada */}
          <div
            className="hero-float relative w-[clamp(168px,17vw,214px)] rotate-[2deg]"
            style={
              {
                "--float-delay": "0.4s",
                "--float-dur": "7.8s",
              } as React.CSSProperties
            }
          >
            <div className="bg-card/70 supports-[backdrop-filter]:bg-card/55 relative flex flex-col gap-3 rounded-2xl p-3.5 shadow-[0_22px_54px_-18px_rgba(20,247,254,0.4)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_40%,transparent)] backdrop-blur-md">
              {/* hairline da marca no topo */}
              <span className="bg-gradient-custom absolute inset-x-[14%] top-0 h-px" />

              {/* cabeçalho */}
              <div className="flex items-center gap-1.5">
                <span className="bg-gradient-custom flex size-5 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                  <ChatsCircle className="size-3" weight="fill" />
                </span>
                <span className="block h-1.5 w-14 rounded-full bg-white/25" />
              </div>

              {/* barras de sentimento enchendo */}
              <div className="flex flex-col gap-2">
                {SENTIMENT_BARS.map((bar, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        bar.tone === "positive" && "bg-[var(--brand-green)]",
                        bar.tone === "neutral" && "bg-white/45",
                        bar.tone === "negative" && "bg-rose-400",
                      )}
                    />
                    <span className="block min-w-0 flex-1">
                      <span
                        className={cn(
                          "block h-1.5 overflow-hidden rounded-full bg-white/10",
                          bar.width,
                        )}
                      >
                        <span
                          className={cn(
                            "hero-clip-progress block h-full rounded-full",
                            bar.tone === "positive" &&
                              "bg-gradient-custom opacity-90",
                            bar.tone === "neutral" && "bg-white/30",
                            bar.tone === "negative" && "bg-rose-400/70",
                          )}
                          style={
                            {
                              "--clip-dur": `${bar.dur}s`,
                              "--clip-delay": `${bar.delay}s`,
                            } as React.CSSProperties
                          }
                        />
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              {/* carinhas de sentimento */}
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5">
                <Smiley
                  className="size-4 text-[var(--brand-mint)]"
                  weight="fill"
                />
                <SmileyMeh className="size-4 text-white/45" weight="fill" />
                <SmileySad className="size-4 text-rose-400/80" weight="fill" />
              </div>

              {/* resumo em linhas estáticas */}
              <div className="flex flex-col gap-1.5">
                <span className="block h-1 w-full rounded-full bg-white/15" />
                <span className="block h-1 w-4/5 rounded-full bg-white/12" />
                <span className="block h-1 w-2/3 rounded-full bg-white/10" />
              </div>

              {/* selo de sentimento com anel pulsante */}
              <div
                className="arena-tilt absolute -right-3.5 -bottom-3.5"
                style={{ "--float-dur": "6.5s" } as React.CSSProperties}
              >
                <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
                <span className="bg-gradient-custom relative flex size-9 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_32px_-8px_rgba(31,254,200,0.6)] lg:size-10">
                  <Smiley className="size-5 lg:size-5.5" weight="fill" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* chips glass flutuantes */}
        <FloatChip
          icon={
            <ChatCircleDots className="size-3 text-[#04222A]" weight="fill" />
          }
          label="Comentários"
          value="Lidos pela IA"
          className="top-[9%] right-[4%]"
          delay={0.9}
          duration={7.6}
        />
        <FloatChip
          icon={<Smiley className="size-3 text-[#04222A]" weight="fill" />}
          label="Percepção"
          value="Positiva"
          className="right-[38%] bottom-[11%] hidden lg:flex"
          delay={2.3}
          duration={8.4}
        />
      </div>
    </div>
  );
}

/** Balão de comentário flutuante com linhas de "texto". */
function CommentBubble({
  className,
  floatDelay,
  floatDur,
  lines,
}: {
  className?: string;
  floatDelay: number;
  floatDur: number;
  lines: readonly string[];
}) {
  return (
    <div
      className={cn("hero-float absolute", className)}
      style={
        {
          "--float-delay": `${floatDelay}s`,
          "--float-dur": `${floatDur}s`,
        } as React.CSSProperties
      }
    >
      <div className="bg-card/40 relative flex flex-col gap-1.5 rounded-2xl rounded-bl-md p-3 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-sm">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="size-3.5 shrink-0 rounded-full bg-white/20" />
          <span className="block h-1 w-8 rounded-full bg-white/20" />
        </div>
        {lines.map((widthClass, index) => (
          <span
            key={index}
            className={cn("block h-1 rounded-full bg-white/12", widthClass)}
          />
        ))}
      </div>
    </div>
  );
}

/** Chip glass flutuante (vocabulário compartilhado das vizzes). */
function FloatChip({
  icon,
  label,
  value,
  className,
  delay,
  duration,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
  delay: number;
  duration: number;
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
        <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  );
}

/**
 * Fantasma do painel de percepção: os dois balões de comentário, o
 * painel central com as barras de sentimento e o selo no canto.
 */
export function ClientCommentsHeroVizSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <VizGhost className={className} focus="66%">
      <div className="absolute top-1/2 right-[14%] -translate-y-1/2 lg:right-[18%] xl:right-[21%]">
        {/* balão à esquerda */}
        <GPanel
          floatDur={7.4}
          className="absolute -top-8 -left-[70%] flex w-[clamp(104px,11vw,138px)] flex-col gap-1.5 p-2.5"
        >
          <GLines widths={["88%", "56%"]} delay={80} />
        </GPanel>

        {/* balão à direita (lg+) */}
        <GPanel
          floatDelay={1.4}
          floatDur={8.2}
          className="absolute -right-[52%] -bottom-10 hidden w-[clamp(96px,10vw,126px)] flex-col gap-1.5 p-2.5 lg:flex"
        >
          <GLines widths={["82%", "50%"]} delay={200} />
        </GPanel>

        {/* painel central */}
        <GPanel
          floatDur={8.6}
          className="relative flex w-[clamp(168px,17vw,214px)] flex-col gap-2.5 p-3"
        >
          <span className="flex items-center gap-2">
            <GBone className="size-5 shrink-0 rounded-md" />
            <GBone delay={70} className="h-2.5 w-20 rounded-full" />
          </span>

          {/* barras de sentimento */}
          {[82, 54, 26].map((width, index) => (
            <span key={index} className="flex items-center gap-1.5">
              <GBone delay={140 + index * 90} className="size-1.5 shrink-0 rounded-full" />
              <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <GBone
                  delay={180 + index * 90}
                  className="h-full rounded-full"
                  style={{ width: `${width}%` }}
                />
              </span>
            </span>
          ))}

          {/* carinhas de sentimento */}
          <span className="flex items-center gap-2">
            {[0, 1, 2].map((face) => (
              <GBone key={face} delay={420 + face * 70} className="size-4 rounded-full" />
            ))}
          </span>

          <GLines widths={["100%", "72%"]} delay={560} />
        </GPanel>

        {/* selo de sentimento */}
        <div className="hero-float absolute -right-3.5 -bottom-3.5">
          <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-white/8" />
          <GBone delay={240} className="size-9 rounded-full lg:size-10" />
        </div>
      </div>

      {/* chips */}
      <GChip className="absolute top-[10%] right-[8%]" floatDelay={0.8} floatDur={7.4} />
      <GChip
        className="absolute bottom-[10%] right-[44%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  );
}
