import {
  EnvelopeSimple,
  Megaphone,
  PaperPlaneTilt,
  PushPin,
  Sparkle,
  Target,
} from "@phosphor-icons/react/dist/ssr";

import {
  GBone,
  GChip,
  GLines,
  GPanel,
  VizGhost,
} from "@/components/shared/hero-viz-skeleton";
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero do Mural de avisos — "o quadro de avisos
 * da competição": aurora em deriva, grid ao fundo, um painel glass com
 * recados fixados (pins da marca, faixa de categoria e linhas de texto,
 * o último ainda "sendo escrito"), selo de megafone com ondas sonoras
 * se propagando, recados soltos flutuando ao redor, aviãozinho de e-mail
 * cruzando o céu, sparkles, partículas e um cometa.
 * CSS puro, aria-hidden, fluido de md a xl.
 */

const SPARKLES = [
  {
    left: "20%",
    top: "12%",
    size: 12,
    delay: 0,
    dur: 3.6,
    tone: "mint",
    lgOnly: false,
  },
  {
    left: "54%",
    top: "6%",
    size: 9,
    delay: 1.5,
    dur: 4.3,
    tone: "cyan",
    lgOnly: true,
  },
  {
    left: "84%",
    top: "18%",
    size: 13,
    delay: 2.3,
    dur: 3.9,
    tone: "mint",
    lgOnly: false,
  },
  {
    left: "92%",
    top: "58%",
    size: 9,
    delay: 0.8,
    dur: 4.1,
    tone: "cyan",
    lgOnly: false,
  },
  {
    left: "34%",
    top: "40%",
    size: 8,
    delay: 3,
    dur: 3.3,
    tone: "cyan",
    lgOnly: true,
  },
  {
    left: "66%",
    top: "88%",
    size: 10,
    delay: 1.9,
    dur: 4.6,
    tone: "mint",
    lgOnly: true,
  },
] as const;

const PARTICLES = [
  {
    left: "18%",
    bottom: "20%",
    size: 3,
    delay: 0,
    dur: 5.4,
    x: 10,
    opacity: 0.8,
  },
  {
    left: "32%",
    bottom: "14%",
    size: 2,
    delay: 1.8,
    dur: 6.6,
    x: -12,
    opacity: 0.55,
  },
  {
    left: "48%",
    bottom: "24%",
    size: 4,
    delay: 0.7,
    dur: 5.8,
    x: 8,
    opacity: 0.85,
  },
  {
    left: "62%",
    bottom: "16%",
    size: 2,
    delay: 2.6,
    dur: 6.2,
    x: -8,
    opacity: 0.6,
  },
  {
    left: "78%",
    bottom: "28%",
    size: 3,
    delay: 3.4,
    dur: 5.6,
    x: 12,
    opacity: 0.75,
  },
  {
    left: "90%",
    bottom: "20%",
    size: 2,
    delay: 1.1,
    dur: 6.9,
    x: -10,
    opacity: 0.6,
  },
] as const;

/** Recados fixados no painel central — faixa de categoria + linhas. */
const PINNED_NOTES = [
  { tone: "cyan", lines: ["w-full", "w-3/4"], typing: false },
  { tone: "amber", lines: ["w-5/6", "w-1/2"], typing: false },
  { tone: "mint", lines: ["w-2/3"], typing: true },
] as const;

export function AnnouncementsHeroViz({ className }: { className?: string }) {
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
        <span className="arena-aurora absolute -top-16 right-[12%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_30%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid do quadro de avisos, em pan */}
        <div className="hero-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_26%,transparent_76%)] opacity-50" />

        {/* feixe de luz varrendo o quadro */}
        <div className="absolute inset-y-0 left-1/4 w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] to-transparent" />
        </div>

        {/* cometa cruzando o topo */}
        <span
          className="arena-comet absolute top-[6%] right-[6%] h-px w-24 rounded-full bg-gradient-to-l from-white/80 via-[color-mix(in_oklab,var(--brand-cyan)_70%,transparent)] to-transparent"
          style={
            {
              "--comet-dur": "10s",
              "--comet-delay": "2s",
              "--comet-x": "-330px",
              "--comet-y": "220px",
              "--comet-angle": "-33deg",
            } as React.CSSProperties
          }
        />

        {/* aviãozinho de e-mail decolando do mural */}
        <span
          className="arena-comet absolute bottom-[22%] left-[30%] text-[var(--brand-mint)] drop-shadow-[0_0_8px_color-mix(in_oklab,var(--brand-mint)_70%,transparent)]"
          style={
            {
              "--comet-dur": "9s",
              "--comet-delay": "4s",
              "--comet-x": "260px",
              "--comet-y": "-190px",
              "--comet-angle": "0deg",
            } as React.CSSProperties
          }
        >
          <PaperPlaneTilt className="size-4 lg:size-5" weight="fill" />
        </span>

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

        {/* ===== quadro de avisos + recados soltos ===== */}
        <div className="absolute top-1/2 right-[12%] -translate-y-1/2 lg:right-[16%] xl:right-[20%]">
          {/* recado solto à esquerda */}
          <LooseNote
            className="-top-6 -left-[clamp(78px,8.5vw,118px)] w-[clamp(100px,10.5vw,132px)] -rotate-[7deg]"
            floatDelay={1.3}
            floatDur={8.2}
            tone="blue"
            lines={["w-full", "w-3/5"]}
          />
          {/* recado solto à direita (lg+) */}
          <LooseNote
            className="-right-[clamp(56px,6.5vw,92px)] bottom-0 hidden w-[clamp(96px,10vw,124px)] rotate-[8deg] lg:block"
            floatDelay={2.8}
            floatDur={7.4}
            tone="violet"
            lines={["w-4/5", "w-full", "w-1/2"]}
            icon={
              <Target
                className="size-3 text-[var(--brand-mint)]"
                weight="fill"
              />
            }
          />

          {/* painel central — o mural */}
          <div
            className="hero-float relative w-[clamp(176px,18vw,228px)] rotate-[1.5deg]"
            style={
              {
                "--float-delay": "0.4s",
                "--float-dur": "7.8s",
              } as React.CSSProperties
            }
          >
            <div className="bg-card/70 supports-[backdrop-filter]:bg-card/55 relative flex flex-col gap-2.5 rounded-2xl p-3.5 shadow-[0_22px_54px_-18px_rgba(20,247,254,0.4)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_40%,transparent)] backdrop-blur-md">
              {/* hairline da marca no topo */}
              <span className="bg-gradient-custom absolute inset-x-[14%] top-0 h-px" />

              {/* cabeçalho do mural */}
              <div className="flex items-center gap-1.5">
                <span className="bg-gradient-custom flex size-5 shrink-0 items-center justify-center rounded-md text-[#04222A]">
                  <Megaphone className="size-3" weight="fill" />
                </span>
                <span className="block h-1.5 w-14 rounded-full bg-white/25" />
                <span className="relative ml-auto flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand-green)] opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[var(--brand-green)]" />
                </span>
              </div>

              {/* recados fixados */}
              <div className="flex flex-col gap-2">
                {PINNED_NOTES.map((note, index) => (
                  <div
                    key={index}
                    className="relative flex gap-2 rounded-lg bg-white/[0.06] p-2 ring-1 ring-white/[0.07]"
                  >
                    {/* pin */}
                    <span className="bg-gradient-custom absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full shadow-[0_0_8px_1px_color-mix(in_oklab,var(--brand-mint)_55%,transparent)]" />
                    {/* faixa da categoria */}
                    <span
                      className={cn(
                        "w-1 shrink-0 rounded-full",
                        note.tone === "cyan" && "bg-[var(--brand-cyan)]",
                        note.tone === "amber" && "bg-amber-400/80",
                        note.tone === "mint" && "bg-[var(--brand-mint)]",
                      )}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
                      <span className="block h-1.5 w-2/5 rounded-full bg-white/30" />
                      {note.lines.map((widthClass, lineIndex) => (
                        <span
                          key={lineIndex}
                          className={cn(
                            "block h-1 rounded-full bg-white/12",
                            widthClass,
                          )}
                        />
                      ))}
                      {note.typing && (
                        <span className="block h-1 w-full overflow-hidden rounded-full bg-white/8">
                          <span
                            className="hero-clip-progress bg-gradient-custom block h-full rounded-full opacity-90"
                            style={
                              {
                                "--clip-dur": "5.6s",
                                "--clip-delay": "0.8s",
                              } as React.CSSProperties
                            }
                          />
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* selo do megafone com ondas sonoras */}
              <div
                className="arena-tilt absolute -right-4 -bottom-4"
                style={{ "--float-dur": "6.5s" } as React.CSSProperties}
              >
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="arena-ripple absolute -inset-1 rounded-full border border-[color-mix(in_oklab,var(--brand-mint)_55%,transparent)]"
                    style={
                      {
                        "--ripple-dur": "4.2s",
                        "--ripple-delay": `${index * 1.4}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
                <span className="hero-pulse-ring absolute -inset-2.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_35%,transparent)]" />
                <span className="bg-gradient-custom relative flex size-9 items-center justify-center rounded-full text-[#04222A] shadow-[0_12px_32px_-8px_rgba(31,254,200,0.6)] lg:size-10">
                  <Megaphone className="size-5 lg:size-5.5" weight="fill" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* chips glass flutuantes */}
        <FloatChip
          icon={<PushPin className="size-3 text-[#04222A]" weight="fill" />}
          label="Publicado"
          value="Agora mesmo"
          className="top-[9%] right-[4%]"
          delay={0.9}
          duration={7.6}
        />
        <FloatChip
          icon={
            <EnvelopeSimple className="size-3 text-[#04222A]" weight="fill" />
          }
          label="E-mail"
          value="Enviado aos clipadores"
          className="right-[36%] bottom-[10%] hidden lg:flex"
          delay={2.3}
          duration={8.4}
        />
        <FloatChip
          icon={<Target className="size-3 text-[#04222A]" weight="fill" />}
          label="Direcionamento"
          value="Clipador específico"
          className="top-[14%] right-[42%] hidden xl:flex"
          delay={0}
          duration={7}
        />
      </div>
    </div>
  );
}

/** Recado solto flutuando ao redor do mural, com pin e linhas de "texto". */
function LooseNote({
  className,
  floatDelay,
  floatDur,
  tone,
  lines,
  icon,
}: {
  className?: string;
  floatDelay: number;
  floatDur: number;
  tone: "blue" | "violet";
  lines: readonly string[];
  icon?: React.ReactNode;
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
      <div className="bg-card/45 relative flex flex-col gap-1.5 rounded-xl p-3 ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-sm">
        <span className="bg-gradient-custom absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full shadow-[0_0_8px_1px_color-mix(in_oklab,var(--brand-cyan)_55%,transparent)]" />
        <div className="mb-0.5 flex items-center gap-1.5">
          {icon ?? (
            <span
              className={cn(
                "size-3 shrink-0 rounded-sm",
                tone === "blue" ? "bg-sky-400/70" : "bg-violet-400/70",
              )}
            />
          )}
          <span className="block h-1 w-9 rounded-full bg-white/22" />
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
 * Fantasma do mural: os dois recados soltos, o painel central com os
 * três recados fixados e o selo do megafone no canto — mesma geometria
 * da viz real, para não haver salto quando os dados chegam.
 */
export function AnnouncementsHeroVizSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[12%] -translate-y-1/2 lg:right-[16%] xl:right-[20%]">
        {/* recado à esquerda */}
        <GPanel
          floatDelay={1.3}
          floatDur={8.2}
          className="absolute -top-6 -left-[70%] flex w-[clamp(100px,10.5vw,132px)] flex-col gap-1.5 p-2.5"
        >
          <GLines widths={["88%", "56%"]} delay={80} />
        </GPanel>

        {/* recado à direita (lg+) */}
        <GPanel
          floatDelay={2.8}
          floatDur={7.4}
          className="absolute -right-[54%] bottom-0 hidden w-[clamp(96px,10vw,124px)] flex-col gap-1.5 p-2.5 lg:flex"
        >
          <GLines widths={["80%", "100%", "48%"]} delay={200} />
        </GPanel>

        {/* painel central */}
        <GPanel
          floatDelay={0.4}
          floatDur={7.8}
          className="relative flex w-[clamp(176px,18vw,228px)] flex-col gap-2.5 p-3.5"
        >
          <span className="flex items-center gap-1.5">
            <GBone className="size-5 shrink-0 rounded-md" />
            <GBone delay={70} className="h-2 w-14 rounded-full" />
          </span>
          {[0, 1, 2].map((index) => (
            <GPanel
              key={index}
              float={false}
              className="flex gap-2 rounded-lg p-2"
            >
              <GBone
                faint
                delay={140 + index * 90}
                className="w-1 shrink-0 rounded-full"
              />
              <GLines
                widths={["40%", "100%", index === 2 ? "66%" : "72%"]}
                delay={180 + index * 90}
                className="flex-1 py-0.5"
              />
            </GPanel>
          ))}

          {/* selo do megafone */}
          <span
            className="hero-float absolute -right-4 -bottom-4 block size-9 lg:size-10"
            style={{ "--float-dur": "6.5s" } as React.CSSProperties}
          >
            <span className="arena-ring absolute -inset-2 rounded-full border border-dashed border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]" />
            <GBone delay={420} className="size-full rounded-full" />
          </span>
        </GPanel>
      </div>

      {/* chips flutuantes */}
      <GChip
        className="absolute top-[9%] right-[4%]"
        floatDelay={0.9}
        floatDur={7.6}
      />
      <GChip
        className="absolute right-[36%] bottom-[10%] hidden lg:flex"
        floatDelay={2.3}
        floatDur={8.4}
        delay={140}
      />
      <GChip
        className="absolute top-[14%] right-[42%] hidden xl:flex"
        floatDur={7}
        delay={280}
      />
    </VizGhost>
  );
}
