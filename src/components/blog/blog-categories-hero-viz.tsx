import {
  ChatCircle,
  FileText,
  FolderOpen,
  Sparkle,
  Tag,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Categorias do Blog — "ÍNDICE VIVO":
 * uma pilha organizada de linhas de categoria (cor, título fantasma e
 * contagem de posts) entrando em cascata, com um VÃO tracejado pulsando
 * onde a etiqueta nova — flutuando acima com anel pulsante e brilho —
 * está prestes a se encaixar. Abas de fichário coloridas na lateral,
 * aurora violeta+cyan, sparkles, partículas e cometa. Tudo ancorado num
 * container central com clamp() — responsivo por construção.
 */

const VIOLET = "#a855f7"

/** Linhas de categoria já arquivadas (cor da paleta do blog + contagem). */
const CATEGORY_ROWS = [
  { color: "#EF4444", barWidth: "w-[72%]", count: "24", rise: 0.15, floatDelay: 0.3, floatDur: 8.6 },
  { color: "#3B82F6", barWidth: "w-[58%]", count: "18", rise: 0.35, floatDelay: 1.2, floatDur: 9.4 },
  // ← o vão tracejado entra aqui (posição 3)
  { color: "#14B8A6", barWidth: "w-[64%]", count: "11", rise: 0.75, floatDelay: 2.1, floatDur: 8.9 },
  { color: "#F97316", barWidth: "w-[46%]", count: "7", rise: 0.95, floatDelay: 3, floatDur: 9.8 },
] as const

/** Abas de fichário na lateral esquerda da pilha. */
const SPINE_TABS = [
  { color: "#EF4444", top: "6%" },
  { color: VIOLET, top: "38%" },
  { color: "#14B8A6", top: "70%" },
] as const

const SPARKLES = [
  { left: "20%", top: "10%", size: 11, delay: 0.2, dur: 3.8, violet: true, lgOnly: false },
  { left: "48%", top: "6%", size: 9, delay: 1.4, dur: 4.4, violet: false, lgOnly: true },
  { left: "88%", top: "12%", size: 12, delay: 2.2, dur: 3.4, violet: false, lgOnly: false },
  { left: "28%", top: "74%", size: 9, delay: 0.8, dur: 4.6, violet: false, lgOnly: true },
  { left: "92%", top: "68%", size: 10, delay: 3, dur: 3.7, violet: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "24%", bottom: "16%", size: 3, delay: 0.5, dur: 5.8, x: 10, opacity: 0.8, violet: true },
  { left: "42%", bottom: "12%", size: 2, delay: 2.1, dur: 6.6, x: -12, opacity: 0.6, violet: false },
  { left: "64%", bottom: "18%", size: 3, delay: 1.1, dur: 5.4, x: 8, opacity: 0.85, violet: true },
  { left: "82%", bottom: "12%", size: 2, delay: 3.3, dur: 6.4, x: -8, opacity: 0.6, violet: false },
  { left: "94%", bottom: "20%", size: 3, delay: 2.5, dur: 5.9, x: 9, opacity: 0.75, violet: true },
] as const

export function BlogCategoriesHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora violeta + ciano */}
        <span
          className="arena-aurora absolute -top-16 right-[12%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${VIOLET} 30%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-6.5s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_52%,#000_28%,transparent_78%)]" />

        {/* feixe de luz */}
        <div className="absolute inset-y-0 left-[28%] w-24 overflow-visible">
          <span
            className="hero-sweep block h-full w-full"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${VIOLET} 15%, transparent), transparent)`,
            }}
          />
        </div>

        {/* cometa violeta */}
        <span
          className="arena-comet absolute top-[5%] right-[10%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${VIOLET} 70%, transparent), transparent)`,
              "--comet-dur": "10.5s",
              "--comet-delay": "2.4s",
              "--comet-x": "-310px",
              "--comet-y": "210px",
              "--comet-angle": "-34deg",
            } as React.CSSProperties
          }
        />

        {/* sparkles ambiente */}
        {SPARKLES.map((sparkle, index) => (
          <Sparkle
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              sparkle.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: sparkle.left,
                top: sparkle.top,
                width: sparkle.size,
                height: sparkle.size,
                color: sparkle.violet ? VIOLET : "var(--brand-cyan)",
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
            className="arena-particle absolute rounded-full"
            style={
              {
                left: particle.left,
                bottom: particle.bottom,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.violet
                  ? VIOLET
                  : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== O ÍNDICE — pilha central ancorada ===== */}
        <div className="absolute top-1/2 right-[9%] w-[clamp(230px,26vw,320px)] -translate-y-1/2 lg:right-[12%]">
          {/* abas de fichário na lateral esquerda */}
          <div className="absolute inset-y-[8%] -left-2.5 w-2.5">
            {SPINE_TABS.map((tab, index) => (
              <span
                key={index}
                className="hero-podium-glow absolute left-0 h-[18%] w-full rounded-l-md ring-1 ring-white/10"
                style={
                  {
                    top: tab.top,
                    backgroundColor: `color-mix(in oklab, ${tab.color} 55%, transparent)`,
                    "--podium-dur": "4.5s",
                    "--podium-delay": `${index * 1.1}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          {/* a etiqueta nova — flutuando, prestes a se encaixar no vão */}
          <div className="absolute -top-12 left-[16%] z-10 lg:-top-14">
            <div
              className="arena-tilt relative"
              style={{ "--float-dur": "6.4s" } as React.CSSProperties}
            >
              <span className="hero-pulse-ring absolute -inset-3.5 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_34%,transparent)]" />
              <span
                className="arena-ring absolute -inset-2 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
                style={{
                  background: `conic-gradient(from 0deg, transparent 12%, color-mix(in oklab, ${VIOLET} 70%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-mint) 65%, transparent) 72%, transparent 88%)`,
                }}
              />
              <span className="bg-gradient-custom relative flex h-9 w-[clamp(120px,13vw,160px)] items-center gap-2 overflow-hidden rounded-full px-3 text-[#04222A] shadow-[0_16px_46px_-12px_rgba(31,254,200,0.55)] lg:h-10">
                <Tag className="size-4 shrink-0" weight="fill" />
                <span className="h-1.5 min-w-0 flex-1 rounded-full bg-[#04222A]/25" />
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                  style={{ "--shine-delay": "1.2s" } as React.CSSProperties}
                />
              </span>
            </div>
          </div>

          {/* pilha de linhas de categoria */}
          <div className="flex flex-col gap-2.5">
            {CATEGORY_ROWS.map((row, index) => (
              <div key={row.color} className="contents">
                {/* o vão tracejado pulsando na 3ª posição */}
                {index === 2 && (
                  <div
                    className="hero-podium-glow flex h-11 items-center justify-center rounded-xl border border-dashed lg:h-12"
                    style={
                      {
                        borderColor: `color-mix(in oklab, var(--brand-mint) 45%, transparent)`,
                        backgroundColor:
                          "color-mix(in oklab, var(--brand-mint) 6%, transparent)",
                        "--podium-dur": "2.6s",
                      } as React.CSSProperties
                    }
                  >
                    <span className="text-[9px] font-bold tracking-[0.2em] text-[color-mix(in_oklab,var(--brand-mint)_75%,transparent)] uppercase">
                      Nova categoria
                    </span>
                  </div>
                )}
                <div
                  className="arena-podium"
                  style={{ "--rise-delay": `${row.rise}s` } as React.CSSProperties}
                >
                  <div
                    className="hero-float flex h-11 items-center gap-2.5 rounded-xl bg-[#0a1c2b]/85 px-3 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.85)] ring-1 ring-white/10 backdrop-blur-md lg:h-12"
                    style={
                      {
                        borderLeft: `3px solid ${row.color}`,
                        "--float-delay": `${row.floatDelay}s`,
                        "--float-dur": `${row.floatDur}s`,
                      } as React.CSSProperties
                    }
                  >
                    {/* chip do ícone tingido */}
                    <span
                      className="flex size-6.5 shrink-0 items-center justify-center rounded-lg lg:size-7"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${row.color} 20%, transparent)`,
                      }}
                    >
                      <Tag
                        className="size-3.5"
                        weight="fill"
                        style={{ color: row.color }}
                      />
                    </span>
                    {/* título fantasma */}
                    <span
                      className={cn(
                        "block h-1.5 rounded-full",
                        row.barWidth,
                      )}
                      style={{
                        backgroundColor: `color-mix(in oklab, ${row.color} 55%, transparent)`,
                      }}
                    />
                    {/* contagem de posts */}
                    <span className="text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-bold tabular-nums">
                      <FileText className="size-3 opacity-70" weight="fill" />
                      {row.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== chips glass ===== */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[10%] right-[36%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 backdrop-blur-md lg:right-[42%]"
          style={
            {
              "--float-delay": "0.6s",
              "--float-dur": "7.6s",
              // ring tingido de violeta
              boxShadow: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 0 0 1px color-mix(in oklab, ${VIOLET} 26%, transparent)`,
            } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <FolderOpen className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Organizadas
          </span>
          <span className="text-foreground text-xs font-bold">
            6 categorias ativas
          </span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[10%] left-[16%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:flex"
          style={
            { "--float-delay": "2.2s", "--float-dur": "8.4s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <TrendUp className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Mais popular
          </span>
          <span className="text-foreground inline-flex items-center gap-1 text-xs font-bold">
            <ChatCircle className="size-3 text-[var(--brand-mint)]" weight="fill" />
            Dicas de Viralização
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do índice de categorias: as abas do fichário, a etiqueta nova
 * flutuando sobre o vão tracejado e a pilha de linhas de categoria.
 */
export function BlogCategoriesHeroVizSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[9%] w-[clamp(230px,26vw,320px)] -translate-y-1/2 lg:right-[12%]">
        {/* abas do fichário */}
        <span className="absolute inset-y-[8%] -left-2.5 w-2.5">
          {[0, 1, 2].map((tab) => (
            <GBone
              key={tab}
              delay={tab * 120}
              className="absolute left-0 h-[18%] w-full rounded-l-md"
              style={{ top: `${12 + tab * 30}%` }}
            />
          ))}
        </span>

        {/* etiqueta nova flutuando */}
        <div className="hero-float absolute -top-12 left-[16%] z-10 lg:-top-14">
          <span className="hero-pulse-ring absolute -inset-3.5 rounded-full bg-white/8" />
          <GPanel float={false} className="flex w-[clamp(120px,13vw,160px)] items-center gap-2 px-2.5 py-2">
            <GBone className="size-4 shrink-0 rounded-md" />
            <GBone delay={80} className="h-2 flex-1 rounded-full" />
          </GPanel>
        </div>

        {/* pilha de categorias */}
        <GPanel floatDur={8.4} className="flex flex-col gap-2 p-3">
          {[0, 1, 2, 3].map((row) =>
            row === 2 ? (
              <span
                key={row}
                className="arena-podium h-9 w-full rounded-xl border border-dashed border-white/15"
              />
            ) : (
              <span key={row} className="flex items-center gap-2.5">
                <GBone delay={row * 110} className="size-6.5 shrink-0 rounded-lg lg:size-7" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <GBone delay={row * 110 + 60} className="h-2.5 w-[70%] rounded-full" />
                  <GBone delay={row * 110 + 120} className="h-2 w-[40%] rounded-full" />
                </span>
                <GBone delay={row * 110 + 180} className="h-2.5 w-6 rounded-full" />
              </span>
            ),
          )}
        </GPanel>
      </div>

      {/* chips */}
      <GChip
        className="absolute top-[10%] right-[36%] lg:right-[42%]"
        floatDelay={0.8}
        floatDur={7.2}
      />
      <GChip
        className="absolute bottom-[10%] left-[16%] hidden lg:flex"
        floatDelay={2.6}
        floatDur={8.4}
        delay={150}
      />
    </VizGhost>
  )
}
