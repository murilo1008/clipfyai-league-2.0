import {
  Clock,
  Globe,
  Hash,
  MagicWand,
  PenNib,
  Robot,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

import { GBone, GChip, GLines, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero de Posts do Blog — "O ARTIGO GANHANDO VIDA":
 * um card de post glass sendo composto em tempo real (capa com brilho
 * varrendo e selo de IA, título preenchendo em gradiente, corpo se
 * escrevendo com cursor piscando, tags pulsando), com a caneta assinando
 * ancorada no canto do card, rascunhos fantasma atrás para profundidade,
 * aurora rose+cyan, faíscas, partículas e cometa. Tudo ancorado num
 * container central com clamp() — responsivo por construção.
 */

/** Rosa da tinta — âncora cromática desta viz. */
const ROSE = "#f43f5e"

/** Linhas do corpo do artigo se escrevendo (dessincronizadas). */
const BODY_LINES = [
  { width: "w-full", dur: 5, delay: 0.4 },
  { width: "w-[88%]", dur: 6.2, delay: 1.2 },
  { width: "w-[64%]", dur: 7.4, delay: 2, cursor: true },
] as const

/** Faíscas de IA ao redor da caneta (offsets relativos ao badge). */
const PEN_SPARKS = [
  { className: "-top-5 -left-4", size: 12, delay: 0.3, dur: 2.6 },
  { className: "-right-5 top-0", size: 9, delay: 1.1, dur: 3.2 },
  { className: "-bottom-4 -left-6", size: 10, delay: 1.9, dur: 2.9 },
] as const

const SPARKLES = [
  { left: "18%", top: "12%", size: 11, delay: 0.2, dur: 3.8, rose: true, lgOnly: false },
  { left: "44%", top: "6%", size: 9, delay: 1.5, dur: 4.4, rose: false, lgOnly: true },
  { left: "88%", top: "14%", size: 12, delay: 2.3, dur: 3.4, rose: false, lgOnly: false },
  { left: "30%", top: "78%", size: 9, delay: 0.9, dur: 4.6, rose: false, lgOnly: true },
  { left: "90%", top: "72%", size: 10, delay: 3, dur: 3.6, rose: true, lgOnly: false },
] as const

const PARTICLES = [
  { left: "22%", bottom: "18%", size: 3, delay: 0.5, dur: 5.8, x: 12, opacity: 0.8, rose: true },
  { left: "40%", bottom: "12%", size: 2, delay: 2.1, dur: 6.8, x: -10, opacity: 0.6, rose: false },
  { left: "62%", bottom: "16%", size: 3, delay: 1.3, dur: 5.4, x: 8, opacity: 0.85, rose: true },
  { left: "82%", bottom: "12%", size: 2, delay: 3.2, dur: 6.4, x: -12, opacity: 0.6, rose: false },
  { left: "94%", bottom: "22%", size: 3, delay: 2.6, dur: 6, x: 10, opacity: 0.7, rose: true },
] as const

export function BlogPostsHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora de tinta rose + halo ciano */}
        <span
          className="arena-aurora absolute -top-16 right-[8%] size-64 rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, color-mix(in oklab, ${ROSE} 28%, transparent), transparent 66%)`,
          }}
        />
        <span
          className="arena-aurora absolute right-[42%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_22%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_68%_50%,#000_28%,transparent_78%)]" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[26%] w-24 overflow-visible">
          <span
            className="hero-sweep block h-full w-full"
            style={{
              background: `linear-gradient(to right, transparent, color-mix(in oklab, ${ROSE} 13%, transparent), transparent)`,
            }}
          />
        </div>

        {/* cometa rose */}
        <span
          className="arena-comet absolute top-[5%] right-[10%] h-px w-24 rounded-full"
          style={
            {
              background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${ROSE} 70%, transparent), transparent)`,
              "--comet-dur": "11s",
              "--comet-delay": "2.4s",
              "--comet-x": "-300px",
              "--comet-y": "210px",
              "--comet-angle": "-36deg",
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
                color: sparkle.rose ? ROSE : "var(--brand-cyan)",
                "--twinkle-delay": `${sparkle.delay}s`,
                "--twinkle-dur": `${sparkle.dur}s`,
                "--twinkle-opacity": 0.9,
              } as React.CSSProperties
            }
          />
        ))}

        {/* partículas de tinta subindo */}
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
                backgroundColor: particle.rose ? ROSE : "var(--brand-cyan)",
                "--particle-delay": `${particle.delay}s`,
                "--particle-dur": `${particle.dur}s`,
                "--particle-x": `${particle.x}px`,
                "--particle-opacity": particle.opacity,
              } as React.CSSProperties
            }
          />
        ))}

        {/* ===== O ARTIGO — card central ancorado ===== */}
        <div className="absolute top-1/2 right-[9%] w-[clamp(230px,26vw,320px)] -translate-y-1/2 lg:right-[12%]">
          {/* rascunhos fantasma atrás (profundidade) */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-white/[0.04] ring-1 ring-white/8"
            style={{ transform: "rotate(-6deg) translate(-14px, 10px)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 hidden rounded-2xl bg-white/[0.025] ring-1 ring-white/5 lg:block"
            style={{ transform: "rotate(-11deg) translate(-26px, 22px)" }}
          />

          {/* card principal */}
          <div
            className="arena-tilt relative"
            style={{ "--float-dur": "8.5s" } as React.CSSProperties}
          >
            <div className="relative flex rotate-2 flex-col gap-3 rounded-2xl bg-[#0a1c2b]/85 p-3.5 shadow-[0_30px_70px_-24px_rgba(0,0,0,0.85)] ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] backdrop-blur-md lg:p-4">
              {/* hairline da marca no topo */}
              <span
                className="pointer-events-none absolute inset-x-4 top-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, color-mix(in oklab, ${ROSE} 60%, transparent), color-mix(in oklab, var(--brand-cyan) 50%, transparent), transparent)`,
                }}
              />

              {/* capa 16:9 gerada por IA */}
              <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-white/10">
                <span
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(125deg, color-mix(in oklab, ${ROSE} 34%, #0a1c2b), color-mix(in oklab, #a855f7 22%, #0a1c2b) 48%, color-mix(in oklab, var(--brand-cyan) 30%, #0a1c2b))`,
                  }}
                />
                {/* sol/holofote da capa */}
                <span className="absolute -top-4 right-3 size-12 rounded-full bg-[color-mix(in_oklab,var(--brand-mint)_45%,transparent)] blur-xl" />
                {/* montanhas abstratas */}
                <span className="absolute -bottom-2 -left-2 h-10 w-[60%] rounded-tr-[100%] bg-black/30" />
                <span className="absolute -right-2 -bottom-3 h-8 w-[55%] rounded-tl-[100%] bg-black/20" />
                {/* brilho varrendo a capa */}
                <span
                  className="arena-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  style={{ "--shine-delay": "1.6s" } as React.CSSProperties}
                />
                {/* selo de IA */}
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[8px] font-bold tracking-[0.12em] text-white/90 uppercase ring-1 ring-white/15 backdrop-blur-sm">
                  <MagicWand className="size-2.5 text-[var(--brand-mint)]" weight="fill" />
                  IA · 16:9
                </span>
              </div>

              {/* chips de categoria + leitura */}
              <div className="flex items-center gap-1.5">
                <span
                  className="hero-podium-glow inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold tracking-[0.1em] uppercase"
                  style={
                    {
                      backgroundColor: `color-mix(in oklab, ${ROSE} 22%, transparent)`,
                      color: "#fda4af",
                      "--podium-dur": "4.2s",
                    } as React.CSSProperties
                  }
                >
                  <Hash className="size-2.5" weight="bold" />
                  Viralização
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1 text-[8px] font-semibold tracking-[0.1em] uppercase">
                  <Clock className="size-2.5" weight="fill" />8 min
                </span>
              </div>

              {/* título preenchendo em gradiente */}
              <div className="flex flex-col gap-1.5">
                <span className="block h-2.5 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="hero-clip-progress bg-gradient-custom block h-full rounded-full"
                    style={
                      {
                        "--clip-dur": "4.2s",
                        "--clip-delay": "0.2s",
                      } as React.CSSProperties
                    }
                  />
                </span>
                <span className="block h-2.5 w-[62%] overflow-hidden rounded-full bg-white/10">
                  <span
                    className="hero-clip-progress bg-gradient-custom block h-full rounded-full opacity-70"
                    style={
                      {
                        "--clip-dur": "5s",
                        "--clip-delay": "0.9s",
                      } as React.CSSProperties
                    }
                  />
                </span>
              </div>

              {/* corpo do artigo se escrevendo */}
              <div className="flex flex-col gap-1.5">
                {BODY_LINES.map((line, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "block h-1.5 overflow-hidden rounded-full bg-white/8",
                        line.width,
                      )}
                    >
                      <span
                        className="hero-clip-progress block h-full rounded-full bg-white/30"
                        style={
                          {
                            "--clip-dur": `${line.dur}s`,
                            "--clip-delay": `${line.delay}s`,
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    {"cursor" in line && line.cursor && (
                      <span
                        className="hero-podium-glow block h-3 w-[2px] shrink-0 rounded-full"
                        style={
                          {
                            backgroundColor: ROSE,
                            "--podium-dur": "1.1s",
                          } as React.CSSProperties
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* rodapé: tags pulsando + status */}
              <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-2.5">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="hero-podium-glow block h-3.5 rounded-full bg-white/10 ring-1 ring-white/10"
                      style={
                        {
                          width: `${26 + index * 8}px`,
                          "--podium-dur": "3.6s",
                          "--podium-delay": `${index * 0.6}s`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_18%,transparent)] px-2 py-0.5 text-[8px] font-bold tracking-[0.1em] text-emerald-300 uppercase">
                  <Globe className="size-2.5" weight="fill" />
                  No ar
                </span>
              </div>
            </div>

            {/* a caneta assinando — ancorada no canto do card */}
            <div className="absolute -right-4 -bottom-4 lg:-right-5 lg:-bottom-5">
              <span
                className="hero-pulse-ring absolute -inset-4 rounded-full"
                style={{
                  backgroundColor: `color-mix(in oklab, ${ROSE} 38%, transparent)`,
                }}
              />
              <span
                className="arena-ring absolute -inset-2 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
                style={{
                  background: `conic-gradient(from 0deg, transparent 12%, color-mix(in oklab, ${ROSE} 75%, transparent) 30%, transparent 48%, color-mix(in oklab, var(--brand-cyan) 60%, transparent) 72%, transparent 88%)`,
                }}
              />
              <span className="bg-gradient-custom relative flex size-11 items-center justify-center rounded-2xl text-[#04222A] shadow-[0_14px_44px_-10px_rgba(244,63,94,0.55)] lg:size-12 xl:size-13">
                <PenNib className="size-5.5 lg:size-6" weight="fill" />
              </span>
              {/* faíscas de IA ao redor da caneta */}
              {PEN_SPARKS.map((spark, index) => (
                <Sparkle
                  key={index}
                  weight="fill"
                  className={cn("arena-twinkle absolute", spark.className)}
                  style={
                    {
                      width: spark.size,
                      height: spark.size,
                      color: index % 2 === 0 ? "var(--brand-mint)" : ROSE,
                      "--twinkle-delay": `${spark.delay}s`,
                      "--twinkle-dur": `${spark.dur}s`,
                      "--twinkle-opacity": 1,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        </div>

        {/* ===== chips glass ===== */}
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute top-[9%] right-[34%] flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] backdrop-blur-md lg:right-[40%]"
          style={
            { "--float-delay": "0.6s", "--float-dur": "7.4s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
              <Robot className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Gerado por IA
          </span>
          <span className="text-foreground text-xs font-bold">Texto + capa</span>
        </div>
        <div
          className="hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute bottom-[12%] left-[16%] hidden flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-green)_26%,transparent)] backdrop-blur-md lg:flex"
          style={
            { "--float-delay": "2.3s", "--float-dur": "8.2s" } as React.CSSProperties
          }
        >
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.14em] uppercase">
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-[var(--brand-green)]">
              <Globe className="size-3 text-[#04222A]" weight="fill" />
            </span>
            Publicado
          </span>
          <span className="text-foreground text-xs font-bold">No ar agora</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Fantasma do artigo: os rascunhos empilhados atrás, o card com capa,
 * chips, título e corpo se escrevendo, a caneta ancorada e os chips.
 */
export function BlogPostsHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[9%] w-[clamp(230px,26vw,320px)] -translate-y-1/2 lg:right-[12%]">
        {/* rascunhos fantasma atrás */}
        <GBone
          faint
          className="absolute inset-0 rounded-2xl"
          style={{ transform: "rotate(-4deg) translate(-10px, 10px)" }}
        />
        <GBone
          faint
          delay={120}
          className="absolute inset-0 hidden rounded-2xl lg:block"
          style={{ transform: "rotate(-8deg) translate(-20px, 20px)" }}
        />

        {/* card do artigo */}
        <GPanel floatDur={8.2} className="relative flex flex-col gap-2.5 p-3">
          <GBone className="aspect-video w-full rounded-xl" />
          <span className="flex items-center gap-1.5">
            <GBone delay={80} className="h-3 w-14 rounded-full" />
            <GBone delay={140} className="h-3 w-10 rounded-full" />
          </span>
          <GLines widths={["92%", "64%"]} delay={200} heightClass="h-2.5" />
          <GLines widths={["100%", "88%", "72%"]} delay={320} />
          <span className="flex items-center gap-1.5">
            {[0, 1, 2].map((tag) => (
              <GBone key={tag} delay={520 + tag * 70} className="h-2.5 w-9 rounded-full" />
            ))}
          </span>
        </GPanel>

        {/* a caneta assinando */}
        <div className="absolute -right-4 -bottom-4 lg:-right-5 lg:-bottom-5">
          <span className="arena-ring absolute -inset-2 rounded-full border border-dashed border-white/15" />
          <GBone delay={180} className="size-11 rounded-2xl lg:size-12 xl:size-13" />
        </div>
      </div>

      {/* chips */}
      <GChip
        className="absolute top-[9%] right-[34%] lg:right-[40%]"
        floatDelay={0.6}
        floatDur={7.4}
      />
      <GChip
        className="absolute bottom-[12%] left-[16%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  )
}
