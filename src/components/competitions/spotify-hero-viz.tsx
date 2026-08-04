import {
  MusicNote,
  MusicNotes,
  Play,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";

import { GBone, GChip, VizGhost } from "@/components/shared/hero-viz-skeleton"
import { cn } from "@/lib/utils";

/**
 * Visualização animada do hero de Músicas do Spotify — estúdio de plays:
 * aurora da marca em deriva, grid em pan, disco de vinil girando com anel
 * cônico e halo pulsante, equalizador em onda, curva de plays com stroke
 * fluindo e área respirando, notas musicais cintilando, partículas subindo
 * e chips de KPI flutuando. CSS puro, aria-hidden, fluido de md a xl.
 */

/** Curva ascendente de plays (viewBox 400×260). */
const LINE =
  "M0 236 C 30 230 54 214 80 206 C 108 197 122 208 148 196 C 176 183 190 152 216 140 C 242 128 258 142 284 122 C 310 102 326 74 352 58 C 372 46 388 40 400 34";
const AREA = `${LINE} L400 260 L0 260 Z`;

/** Barras do equalizador (onda contínua). */
const EQ_BARS = [
  { height: "38%", delay: 0, dur: 2.4 },
  { height: "72%", delay: 0.2, dur: 2.8 },
  { height: "52%", delay: 0.4, dur: 2.2 },
  { height: "88%", delay: 0.6, dur: 3 },
  { height: "60%", delay: 0.8, dur: 2.6 },
  { height: "78%", delay: 1, dur: 3.2 },
  { height: "44%", delay: 1.2, dur: 2.4 },
] as const;

const NOTES = [
  {
    left: "26%",
    top: "12%",
    size: 13,
    delay: 0.2,
    dur: 3.8,
    tone: "mint",
    lgOnly: false,
  },
  {
    left: "52%",
    top: "7%",
    size: 10,
    delay: 1.4,
    dur: 4.4,
    tone: "cyan",
    lgOnly: true,
  },
  {
    left: "72%",
    top: "20%",
    size: 15,
    delay: 2.4,
    dur: 3.4,
    tone: "mint",
    lgOnly: false,
  },
  {
    left: "88%",
    top: "10%",
    size: 10,
    delay: 0.8,
    dur: 4.6,
    tone: "cyan",
    lgOnly: false,
  },
  {
    left: "40%",
    top: "26%",
    size: 9,
    delay: 3.1,
    dur: 3.6,
    tone: "cyan",
    lgOnly: true,
  },
] as const;

const PARTICLES = [
  {
    left: "22%",
    bottom: "26%",
    size: 3,
    delay: 0.5,
    dur: 5.6,
    x: 10,
    opacity: 0.8,
  },
  {
    left: "40%",
    bottom: "22%",
    size: 2,
    delay: 2.1,
    dur: 6.4,
    x: -10,
    opacity: 0.6,
  },
  {
    left: "58%",
    bottom: "30%",
    size: 3,
    delay: 1.3,
    dur: 5.2,
    x: 12,
    opacity: 0.85,
  },
  {
    left: "76%",
    bottom: "24%",
    size: 2,
    delay: 3.3,
    dur: 6.2,
    x: -8,
    opacity: 0.6,
  },
  {
    left: "90%",
    bottom: "32%",
    size: 3,
    delay: 2.7,
    dur: 5.8,
    x: 8,
    opacity: 0.75,
  },
] as const;

export function SpotifyHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        {/* aurora da marca em deriva */}
        <span className="arena-aurora absolute -top-16 right-[8%] size-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-green)_26%,transparent),transparent_66%)] blur-2xl" />
        <span
          className="arena-aurora absolute right-[46%] bottom-[2%] size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_20%,transparent),transparent_66%)] blur-2xl"
          style={{ animationDelay: "-7s" }}
        />

        {/* grid em pan */}
        <div className="hero-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_60%,#000_30%,transparent_80%)] opacity-40" />

        {/* feixe varrendo */}
        <div className="absolute inset-y-0 left-[22%] w-24 overflow-visible">
          <span className="hero-sweep block h-full w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--brand-green)_12%,transparent)] to-transparent" />
        </div>

        {/* notas musicais cintilando */}
        {NOTES.map((note, index) => (
          <MusicNote
            key={index}
            weight="fill"
            className={cn(
              "arena-twinkle absolute",
              note.tone === "mint"
                ? "text-[var(--brand-mint)]"
                : "text-[var(--brand-cyan)]",
              note.lgOnly && "hidden lg:block",
            )}
            style={
              {
                left: note.left,
                top: note.top,
                width: note.size,
                height: note.size,
                "--twinkle-delay": `${note.delay}s`,
                "--twinkle-dur": `${note.dur}s`,
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

        {/* curva de plays: área respirando + stroke fluindo */}
        <div className="absolute inset-x-0 bottom-0 h-[72%]">
          <svg
            viewBox="0 0 400 260"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient
                id="spotify-viz-stroke"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="var(--brand-cyan)" />
                <stop offset="100%" stopColor="var(--brand-green)" />
              </linearGradient>
            </defs>

            {[74, 140, 204].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="400"
                y2={y}
                stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <path
              d={AREA}
              fill="color-mix(in oklab, var(--brand-green) 9%, transparent)"
              className="hero-area-breathe"
            />
            <path
              d={LINE}
              fill="none"
              stroke="url(#spotify-viz-stroke)"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={LINE}
              fill="none"
              stroke="url(#spotify-viz-stroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="hero-trace"
            />
          </svg>
        </div>

        {/* disco de vinil girando */}
        <div
          className="hero-float absolute top-[16%] right-[24%] xl:right-[26%]"
          style={{ "--float-dur": "7.4s" } as React.CSSProperties}
        >
          <span className="hero-pulse-ring absolute -inset-5 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_32%,transparent)]" />
          <span className="arena-ring absolute -inset-2.5 rounded-full [background:conic-gradient(from_0deg,transparent_10%,color-mix(in_oklab,var(--brand-green)_75%,transparent)_28%,transparent_46%,color-mix(in_oklab,var(--brand-cyan)_60%,transparent)_70%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]" />
          <span className="relative flex size-14 items-center justify-center rounded-full bg-[radial-gradient(circle,#0b2430_38%,#04141c_100%)] shadow-[0_14px_44px_-10px_rgba(55,250,156,0.55)] lg:size-16 xl:size-[4.5rem]">
            {/* sulcos do vinil girando */}
            <span className="absolute inset-1.5 animate-spin rounded-full border border-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] [animation-duration:9s] motion-reduce:animate-none" />
            <span className="absolute inset-3 animate-spin rounded-full border border-[color-mix(in_oklab,var(--brand-mint)_22%,transparent)] [animation-duration:14s] motion-reduce:animate-none" />
            <span className="bg-gradient-custom relative flex size-6 items-center justify-center rounded-full text-[#04222A] lg:size-7">
              <MusicNotes className="size-3.5 lg:size-4" weight="fill" />
            </span>
          </span>
        </div>

        {/* equalizador em onda */}
        <div className="absolute right-[56%] bottom-[12%] flex h-10 items-end gap-1 lg:h-12">
          {EQ_BARS.map((bar, index) => (
            <span
              key={index}
              className={cn(
                "hero-bar w-1.5 rounded-full",
                index % 2 === 0
                  ? "bg-[color-mix(in_oklab,var(--brand-green)_62%,transparent)]"
                  : "bg-[color-mix(in_oklab,var(--brand-cyan)_55%,transparent)]",
              )}
              style={
                {
                  height: bar.height,
                  "--bar-delay": `${bar.delay}s`,
                  "--bar-dur": `${bar.dur}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* chips de KPI flutuantes */}
        <KpiChip
          icon={<Play className="size-3 text-[#04222A]" weight="fill" />}
          label="Plays"
          value="1,2M"
          className="top-[54%] right-[6%]"
          delay={1.1}
          duration={7.6}
        />
        <KpiChip
          icon={<TrendUp className="size-3 text-[#04222A]" weight="fill" />}
          label="No período"
          value="+128K"
          className="top-[12%] right-[44%] hidden xl:flex"
          delay={0.4}
          duration={7}
        />
      </div>
    </div>
  );
}

function KpiChip({
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
        "hero-float bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-green)_22%,transparent)] backdrop-blur-md",
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
      <span className="text-foreground text-xs font-bold tabular-nums">
        {value}
      </span>
    </div>
  );
}

/**
 * Fantasma do palco musical: a curva de plays, o disco de vinil girando
 * com os sulcos, o equalizador em onda e os chips de KPI.
 */
export function SpotifyHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="70%">
      {/* curva de plays */}
      <div className="absolute inset-x-0 bottom-0 h-[72%]">
        <svg
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M0 160 C 70 140, 110 90, 170 110 S 260 40, 320 70 S 370 30, 400 20 L400 200 L0 200 Z"
            fill="rgba(255,255,255,0.045)"
            className="hero-area-breathe"
          />
          <path
            d="M0 160 C 70 140, 110 90, 170 110 S 260 40, 320 70 S 370 30, 400 20"
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* disco de vinil */}
      <div className="hero-float absolute top-[16%] right-[24%] xl:right-[26%]">
        <span className="arena-ring absolute -inset-2.5 rounded-full border border-dashed border-white/15" />
        <span className="relative block size-14 lg:size-16 xl:size-18">
          <GBone className="size-full rounded-full" />
          <span className="absolute inset-1.5 animate-spin rounded-full border border-white/12 [animation-duration:9s] motion-reduce:animate-none" />
          <span className="absolute inset-3 animate-spin rounded-full border border-white/10 [animation-duration:14s] motion-reduce:animate-none" />
          <span className="absolute inset-0 m-auto size-6 rounded-full bg-white/15 lg:size-7" />
        </span>
      </div>

      {/* equalizador */}
      <div className="absolute right-[56%] bottom-[12%] flex h-10 items-end gap-1 lg:h-12">
        {[38, 70, 52, 90, 44, 66, 34].map((height, index) => (
          <span
            key={index}
            className="hero-bar skeleton-bone skeleton-bone-strong block w-1.5 rounded-full"
            style={
              {
                height: `${height}%`,
                "--bar-delay": `${index * 0.13}s`,
                "--bar-dur": "2.6s",
                "--shimmer-delay": `${index * 80}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* chips de KPI */}
      <GChip className="absolute top-[10%] right-[6%]" floatDelay={0.9} floatDur={7.4} />
      <GChip
        className="absolute right-[8%] bottom-[18%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  );
}
