import { Eye, Play } from "@phosphor-icons/react/dist/ssr"

import { GBone, GPanel, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils"

/**
 * Visualização animada do hero — mercado de cortes:
 * clipes verticais 9:16 flutuando com progresso de reprodução, play button
 * gigante com glow da marca e o strip de vídeos reais rolando na base
 * (levemente inclinado, poucos vídeos visíveis por vez).
 */
export function ClipsHeroViz({
  className,
  ticker,
}: {
  className?: string
  /** Marquee de vídeos reais renderizado inclinado na base da animação. */
  ticker?: React.ReactNode
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] overflow-hidden lg:block xl:w-[54%]",
        className,
      )}
    >
      {/* fade à esquerda para fundir com a área de texto */}
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_38%)]">
        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 opacity-50" />

        {/* play button gigante com glow (marca) */}
        <svg
          viewBox="0 0 200 200"
          className="hero-area-breathe absolute top-1/2 right-[6%] h-[68%] -translate-y-[58%] opacity-25"
        >
          <defs>
            <linearGradient id="clips-play" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--brand-cyan)" />
              <stop offset="100%" stopColor="var(--brand-green)" />
            </linearGradient>
          </defs>
          <path
            d="M70 40 C64 36 56 40 56 48 L56 152 C56 160 64 164 70 160 L158 108 C165 104 165 96 158 92 Z"
            fill="none"
            stroke="url(#clips-play)"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>

        {/* clipes verticais flutuando */}
        <ClipCard
          accent="cyan"
          views="2,4M"
          label="@corte.viral"
          className="top-[6%] right-[30%] w-[104px] rotate-[-7deg] xl:w-[118px]"
          floatDelay={0}
          floatDur={7.5}
          progressDur={5.2}
        />
        <ClipCard
          accent="gradient"
          views="1,1M"
          label="@clipfy.cortes"
          className="top-[16%] right-[8%] z-10 w-[118px] rotate-[4deg] xl:w-[134px]"
          floatDelay={1.2}
          floatDur={8.4}
          progressDur={6.4}
        />
        <ClipCard
          accent="green"
          views="870K"
          label="@viral.br"
          className="top-[38%] right-[21%] w-[96px] rotate-[10deg] xl:w-[110px]"
          floatDelay={2.1}
          floatDur={6.8}
          progressDur={4.4}
        />

        {/* Strip de vídeos reais rolando na base, levemente inclinado */}
        {ticker && (
          <div className="absolute inset-x-[-4%] bottom-[5%] rotate-[-2deg]">
            {ticker}
          </div>
        )}
      </div>
    </div>
  )
}

function ClipCard({
  accent,
  views,
  label,
  className,
  floatDelay,
  floatDur,
  progressDur,
}: {
  accent: "cyan" | "green" | "gradient"
  views: string
  label: string
  className?: string
  floatDelay: number
  floatDur: number
  progressDur: number
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
      <div
        className={cn(
          "bg-card/80 relative flex aspect-[9/16] flex-col overflow-hidden rounded-2xl shadow-xl ring-1 backdrop-blur-md",
          accent === "cyan" &&
            "shadow-[0_16px_40px_-16px_rgba(20,247,254,0.4)] ring-[color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]",
          accent === "green" &&
            "shadow-[0_16px_40px_-16px_rgba(55,250,156,0.4)] ring-[color-mix(in_oklab,var(--brand-green)_45%,transparent)]",
          accent === "gradient" &&
            "shadow-[0_20px_50px_-16px_rgba(31,254,200,0.45)] ring-[color-mix(in_oklab,var(--brand-mint)_50%,transparent)]",
        )}
      >
        {/* linha de glow no topo (como os cards da apresentação) */}
        <span
          className={cn(
            "absolute inset-x-[14%] top-0 h-px",
            accent === "cyan" && "bg-[var(--brand-cyan)]",
            accent === "green" && "bg-[var(--brand-green)]",
            accent === "gradient" && "bg-gradient-custom",
          )}
        />

        {/* "thumbnail" com play */}
        <div className="relative flex flex-1 items-center justify-center">
          <span
            className={cn(
              "absolute size-9 rounded-full opacity-30 blur-md",
              accent === "green"
                ? "bg-[var(--brand-green)]"
                : "bg-[var(--brand-cyan)]",
            )}
          />
          <span
            className={cn(
              "relative flex size-9 items-center justify-center rounded-full text-[#04222A]",
              accent === "cyan" && "bg-[var(--brand-cyan)]",
              accent === "green" && "bg-[var(--brand-green)]",
              accent === "gradient" && "bg-gradient-custom",
            )}
          >
            <Play weight="fill" className="ml-0.5 size-4" />
          </span>
        </div>

        {/* rodapé do clipe */}
        <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">
          <span className="text-foreground/90 truncate text-[9px] font-semibold">
            {label}
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1 text-[9px] font-bold tabular-nums">
            <Eye className="size-2.5" weight="fill" />
            {views}
          </span>
          {/* barra de progresso animada */}
          <div className="bg-muted/70 h-[3px] w-full overflow-hidden rounded-full">
            <div
              className={cn(
                "hero-clip-progress h-full rounded-full",
                accent === "cyan" && "bg-[var(--brand-cyan)]",
                accent === "green" && "bg-[var(--brand-green)]",
                accent === "gradient" && "bg-gradient-custom",
              )}
              style={
                {
                  "--clip-dur": `${progressDur}s`,
                  "--clip-delay": `${floatDelay * 0.4}s`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}


/**
 * Fantasma do mural de clipes: os três cards verticais nas mesmas
 * inclinações/âncoras (play + rodapé + barra de progresso) e a tira de
 * vídeos na base. Sem o SVG do play gigante, que é só ambiente.
 */
export function ClipsHeroVizSkeleton({ className }: { className?: string }) {
  const CARDS = [
    {
      className: "top-[6%] right-[30%] w-[104px] rotate-[-7deg] xl:w-[118px]",
      floatDelay: 0,
      floatDur: 7.5,
      delay: 0,
    },
    {
      className:
        "top-[16%] right-[8%] z-10 w-[118px] rotate-[4deg] xl:w-[134px]",
      floatDelay: 1.2,
      floatDur: 8.4,
      delay: 140,
    },
    {
      className: "top-[38%] right-[21%] w-[96px] rotate-[10deg] xl:w-[110px]",
      floatDelay: 2.1,
      floatDur: 6.8,
      delay: 280,
    },
  ]

  return (
    <VizGhost
      className={className}
      show="lg:block"
      width="w-[58%] xl:w-[54%]"
      mask="38%"
      focus="72%"
    >
      {CARDS.map((card, index) => (
        <GPanel
          key={index}
          className={cn(
            "absolute flex aspect-[9/16] flex-col justify-end gap-2 p-2.5",
            card.className,
          )}
          floatDelay={card.floatDelay}
          floatDur={card.floatDur}
        >
          {/* play no centro do "thumbnail" */}
          <span className="absolute inset-x-0 top-0 bottom-[38%] flex items-center justify-center">
            <GBone delay={card.delay} className="size-9 rounded-full" />
          </span>
          <GBone delay={card.delay + 80} className="h-2 w-3/4 rounded-full" />
          <GBone delay={card.delay + 140} className="h-2 w-1/2 rounded-full" />
          <GBone delay={card.delay + 200} className="h-[3px] w-full rounded-full" />
        </GPanel>
      ))}

      {/* tira de vídeos na base, na mesma inclinação */}
      <div className="absolute inset-x-[-4%] bottom-[5%] flex gap-2 rotate-[-2deg]">
        {[0, 1, 2, 3, 4, 5].map((thumb) => (
          <GBone
            key={thumb}
            delay={thumb * 90}
            faint={thumb > 3}
            className="h-12 w-20 shrink-0 rounded-lg xl:h-14 xl:w-24"
          />
        ))}
      </div>
    </VizGhost>
  )
}
