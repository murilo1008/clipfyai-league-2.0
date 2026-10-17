import {
  Eye,
  Headset,
  ShieldCheck,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";

import {
  GBone,
  GChip,
  GLines,
  GPanel,
  VizGhost,
} from "@/components/shared/hero-viz-skeleton";
import { cn } from "@/lib/utils";

/* ============================================================
   VISUALIZAÇÕES DO HERO — CUSTOMER SUCCESS
   Duas composições na mesma linguagem do kit (vidro petróleo, hairline
   ciano, aurora, grid em pan, sparkles e partículas), ancoradas num
   container central com clamp() — responsivas por construção:

   • CsTeamHeroViz   — "A PONTE": o crachá CS à esquerda ligado por traços
     animados a três cartões de cliente à direita (quem vê quem).
   • CsPickerHeroViz — "A LENTE": um anel giratório emoldura o cartão de
     cliente em destaque, com o cursor-olho "Visualizar como".
   ============================================================ */

const CYAN = "var(--brand-cyan)";
const MINT = "var(--brand-mint)";
const GREEN = "var(--brand-green)";

const SPARKLES = [
  {
    left: "16%",
    top: "12%",
    size: 11,
    delay: 0.2,
    dur: 3.8,
    mint: true,
    lgOnly: false,
  },
  {
    left: "44%",
    top: "7%",
    size: 9,
    delay: 1.4,
    dur: 4.4,
    mint: false,
    lgOnly: true,
  },
  {
    left: "90%",
    top: "14%",
    size: 12,
    delay: 2.2,
    dur: 3.4,
    mint: false,
    lgOnly: false,
  },
  {
    left: "26%",
    top: "80%",
    size: 9,
    delay: 0.9,
    dur: 4.6,
    mint: true,
    lgOnly: true,
  },
  {
    left: "92%",
    top: "72%",
    size: 10,
    delay: 3,
    dur: 3.6,
    mint: true,
    lgOnly: false,
  },
] as const;

const PARTICLES = [
  {
    left: "20%",
    bottom: "16%",
    size: 3,
    delay: 0.5,
    dur: 5.8,
    x: 11,
    opacity: 0.8,
  },
  {
    left: "40%",
    bottom: "12%",
    size: 2,
    delay: 2.1,
    dur: 6.6,
    x: -10,
    opacity: 0.6,
  },
  {
    left: "60%",
    bottom: "18%",
    size: 3,
    delay: 1.2,
    dur: 5.4,
    x: 8,
    opacity: 0.85,
  },
  {
    left: "80%",
    bottom: "12%",
    size: 2,
    delay: 3.2,
    dur: 6.4,
    x: -9,
    opacity: 0.6,
  },
  {
    left: "94%",
    bottom: "22%",
    size: 3,
    delay: 2.6,
    dur: 6,
    x: 10,
    opacity: 0.7,
  },
] as const;

/** Ambiente comum: auroras, grid, feixe, cometa, sparkles e partículas. */
function Ambient({ focus = "68%" }: { focus?: string }) {
  return (
    <>
      <span
        className="arena-aurora absolute -top-16 right-[10%] size-64 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${CYAN} 26%, transparent), transparent 66%)`,
        }}
      />
      <span
        className="arena-aurora absolute right-[44%] bottom-[2%] size-72 rounded-full blur-2xl"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${GREEN} 18%, transparent), transparent 66%)`,
          animationDelay: "-6.8s",
        }}
      />
      <div
        className="hero-grid absolute inset-0 opacity-30"
        style={{
          maskImage: `radial-gradient(ellipse at ${focus} 50%, #000 28%, transparent 78%)`,
          WebkitMaskImage: `radial-gradient(ellipse at ${focus} 50%, #000 28%, transparent 78%)`,
        }}
      />
      <div className="absolute inset-y-0 left-[27%] w-24 overflow-visible">
        <span
          className="hero-sweep block h-full w-full"
          style={{
            background: `linear-gradient(to right, transparent, color-mix(in oklab, ${CYAN} 12%, transparent), transparent)`,
          }}
        />
      </div>
      <span
        className="arena-comet absolute top-[5%] right-[10%] h-px w-24 rounded-full"
        style={
          {
            background: `linear-gradient(to left, rgba(255,255,255,0.8), color-mix(in oklab, ${MINT} 70%, transparent), transparent)`,
            "--comet-dur": "10.8s",
            "--comet-delay": "2.2s",
            "--comet-x": "-300px",
            "--comet-y": "205px",
            "--comet-angle": "-35deg",
          } as React.CSSProperties
        }
      />
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
              color: sparkle.mint ? MINT : CYAN,
              "--twinkle-delay": `${sparkle.delay}s`,
              "--twinkle-dur": `${sparkle.dur}s`,
              "--twinkle-opacity": 0.9,
            } as React.CSSProperties
          }
        />
      ))}
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
              backgroundColor: index % 2 === 0 ? MINT : CYAN,
              "--particle-delay": `${particle.delay}s`,
              "--particle-dur": `${particle.dur}s`,
              "--particle-x": `${particle.x}px`,
              "--particle-opacity": particle.opacity,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

/** Três mini-barras pulsando — "métricas" do cartão de cliente. */
function MiniBars({
  heights,
  delay = 0,
}: {
  heights: number[];
  delay?: number;
}) {
  return (
    <span className="flex h-6 items-end gap-[3px]">
      {heights.map((height, index) => (
        <span
          key={index}
          className="hero-bar block w-[5px] rounded-t-[3px]"
          style={
            {
              height: `${height}%`,
              background: `linear-gradient(to top, color-mix(in oklab, ${CYAN} 55%, transparent), color-mix(in oklab, ${GREEN} 85%, transparent))`,
              "--bar-delay": `${delay + index * 0.18}s`,
              "--bar-dur": "2.8s",
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** Cartão fantasma de cliente: avatar, nome, status e mini-gráfico. */
function ClientCardGhost({
  className,
  floatDur,
  floatDelay,
  highlight = false,
  bars,
  style,
}: {
  className?: string;
  floatDur: number;
  floatDelay: number;
  highlight?: boolean;
  bars: number[];
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "arena-tilt relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 backdrop-blur-md",
        highlight
          ? "bg-[#13284a]/90"
          : "bg-[#0a1c2b]/80 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/10",
        className,
      )}
      style={
        {
          "--float-dur": `${floatDur}s`,
          "--float-delay": `${floatDelay}s`,
          ...(highlight
            ? {
                boxShadow: `0 26px 60px -20px color-mix(in oklab, ${CYAN} 45%, transparent), 0 0 0 1px color-mix(in oklab, ${CYAN} 42%, transparent)`,
              }
            : {}),
          ...style,
        } as React.CSSProperties
      }
    >
      {highlight && (
        <span
          className="pointer-events-none absolute inset-x-3 top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, color-mix(in oklab, ${CYAN} 70%, transparent), color-mix(in oklab, ${GREEN} 55%, transparent), transparent)`,
          }}
        />
      )}
      <span
        className="size-9 shrink-0 rounded-xl ring-1 ring-white/15"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${CYAN} 48%, transparent), rgba(255,255,255,0.1) 55%, color-mix(in oklab, ${GREEN} 40%, transparent))`,
        }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="h-1.5 w-[78%] rounded-full bg-white/30" />
        <span className="h-1.5 w-[52%] rounded-full bg-white/14" />
        <span className="mt-0.5 inline-flex items-center gap-1">
          <span
            className="size-1.5 rounded-full"
            style={{
              backgroundColor: GREEN,
              boxShadow: `0 0 8px color-mix(in oklab, ${GREEN} 80%, transparent)`,
            }}
          />
          <span
            className="h-1 w-9 rounded-full"
            style={{
              backgroundColor: `color-mix(in oklab, ${GREEN} 45%, transparent)`,
            }}
          />
        </span>
      </span>
      <MiniBars heights={bars} delay={floatDelay} />
    </div>
  );
}

/** Crachá do CS: avatar com anel cônico, nome e selo gradiente "CS". */
function CsCard({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-[100px] shrink-0 lg:w-[112px]", className)}>
      <span
        className="hero-pulse-ring absolute -inset-4 rounded-full"
        style={{
          backgroundColor: `color-mix(in oklab, ${CYAN} 32%, transparent)`,
        }}
      />
      <div
        className="relative flex w-full flex-col items-center gap-2.5 rounded-2xl bg-[#13284a]/90 px-3 pt-3 pb-3 backdrop-blur-md"
        style={{
          boxShadow: `0 26px 60px -20px color-mix(in oklab, ${CYAN} 45%, transparent), 0 0 0 1px color-mix(in oklab, ${CYAN} 42%, transparent)`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-3 top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, color-mix(in oklab, ${CYAN} 70%, transparent), color-mix(in oklab, ${GREEN} 55%, transparent), transparent)`,
          }}
        />
        <span className="relative mt-1">
          <span
            className="arena-ring absolute -inset-1.5 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2.5px),#000_calc(100%-2px))]"
            style={{
              background: `conic-gradient(from 0deg, transparent 10%, color-mix(in oklab, ${CYAN} 80%, transparent) 30%, transparent 48%, color-mix(in oklab, ${GREEN} 70%, transparent) 72%, transparent 90%)`,
            }}
          />
          <span
            className="relative block size-10 rounded-full ring-1 ring-white/20 lg:size-11"
            style={{
              background: `linear-gradient(135deg, color-mix(in oklab, ${CYAN} 55%, transparent), rgba(255,255,255,0.1) 55%, color-mix(in oklab, ${MINT} 45%, transparent))`,
            }}
          />
          <span className="bg-gradient-custom absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full text-[#04222A] ring-2 ring-[#13284a]">
            <Headset className="size-2.5" weight="fill" />
          </span>
        </span>
        <div className="flex w-full flex-col items-center gap-1">
          <span className="h-1.5 w-4/5 rounded-full bg-white/30" />
          <span className="h-1.5 w-1/2 rounded-full bg-white/15" />
        </div>
        <span className="bg-gradient-custom inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[7px] font-bold tracking-[0.16em] text-[#04222A] uppercase">
          <Headset className="size-2.5" weight="fill" />
          CS
        </span>
      </div>
    </div>
  );
}

function FloatChip({
  icon,
  iconChip = false,
  label,
  value,
  className,
  delay,
  duration,
}: {
  icon: React.ReactNode;
  iconChip?: boolean;
  label: string;
  value: string;
  className?: string;
  delay: number;
  duration: number;
}) {
  return (
    <div
      className={cn(
        "arena-tilt bg-card/70 supports-[backdrop-filter]:bg-card/45 absolute flex flex-col gap-1 rounded-xl px-2.5 py-1.5 shadow-lg ring-1 ring-[color-mix(in_oklab,var(--brand-cyan)_26%,transparent)] backdrop-blur-md",
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
        {iconChip ? (
          <span className="bg-gradient-custom inline-flex size-4 items-center justify-center rounded-full">
            {icon}
          </span>
        ) : (
          icon
        )}
        {label}
      </span>
      <span className="text-foreground text-xs font-bold">{value}</span>
    </div>
  );
}

/* ============================================================
   EQUIPE CS — "A PONTE"
   ============================================================ */

export function CsTeamHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        <Ambient />

        <div className="absolute top-1/2 right-[7%] w-[clamp(250px,29vw,350px)] -translate-y-1/2 lg:right-[10%]">
          <div className="relative flex items-center gap-4 lg:gap-6">
            {/* traços animados ligando o CS aos clientes */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="cs-trace" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={CYAN} stopOpacity="0.1" />
                  <stop offset="55%" stopColor={CYAN} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={GREEN} stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {[18, 50, 82].map((y) => (
                <path
                  key={y}
                  d={`M 36 50 C 48 50, 50 ${y}, 62 ${y}`}
                  className="hero-trace"
                  stroke="url(#cs-trace)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeDasharray: "5 4" }}
                />
              ))}
            </svg>

            <CsCard />

            <div className="relative flex min-w-0 flex-1 flex-col gap-2">
              <ClientCardGhost
                floatDur={7.2}
                floatDelay={0.2}
                bars={[45, 80, 60]}
                className="w-[92%] self-end"
              />
              <ClientCardGhost
                floatDur={8}
                floatDelay={1}
                highlight
                bars={[55, 95, 70]}
              />
              <ClientCardGhost
                floatDur={6.6}
                floatDelay={1.8}
                bars={[35, 65, 50]}
                className="w-[92%] self-end"
              />
            </div>
          </div>
        </div>

        <FloatChip
          icon={<ShieldCheck className="size-3 text-[#04222A]" weight="fill" />}
          iconChip
          label="Acesso"
          value="100% do cliente"
          className="top-[8%] right-[38%] lg:right-[44%]"
          delay={0.6}
          duration={7.6}
        />
        <FloatChip
          icon={
            <UsersThree
              className="size-3"
              weight="fill"
              style={{ color: MINT }}
            />
          }
          label="Equipe"
          value="Customer Success"
          className="bottom-[9%] left-[14%] hidden lg:flex"
          delay={2.2}
          duration={8.4}
        />
      </div>
    </div>
  );
}

/** Fantasma da ponte: crachá à esquerda, três cartões à direita, chips. */
export function CsTeamHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="68%">
      <div className="absolute top-1/2 right-[7%] w-[clamp(250px,29vw,350px)] -translate-y-1/2 lg:right-[10%]">
        <div className="flex items-center gap-4 lg:gap-6">
          <GPanel
            floatDur={8}
            className="flex w-[100px] shrink-0 flex-col items-center gap-2.5 p-3 lg:w-[112px]"
          >
            <GBone className="size-10 rounded-full lg:size-11" />
            <GLines
              widths={["80%", "50%"]}
              delay={80}
              className="w-full items-center"
            />
            <GBone delay={200} className="h-2.5 w-10 rounded-full" />
          </GPanel>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {[0, 1, 2].map((card) => (
              <GPanel
                key={card}
                floatDelay={card * 0.6}
                floatDur={7 + card * 0.5}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5",
                  card !== 1 && "w-[92%] self-end",
                )}
              >
                <GBone
                  delay={card * 110}
                  className="size-9 shrink-0 rounded-xl"
                />
                <GLines
                  widths={["78%", "52%"]}
                  delay={card * 110 + 60}
                  className="flex-1"
                />
                <GBone
                  delay={card * 110 + 160}
                  className="h-6 w-5 rounded-md"
                />
              </GPanel>
            ))}
          </div>
        </div>
      </div>
      <GChip
        className="absolute top-[8%] right-[38%] lg:right-[44%]"
        floatDelay={0.6}
        floatDur={7.4}
      />
      <GChip
        className="absolute bottom-[11%] left-[14%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  );
}

/* ============================================================
   SELEÇÃO DE CLIENTE — "A LENTE"
   ============================================================ */

export function CsPickerHeroViz({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] overflow-hidden md:block lg:w-[54%] xl:w-[48%]",
        className,
      )}
    >
      <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,#000_48%)]">
        <Ambient focus="70%" />

        <div className="absolute top-1/2 right-[9%] w-[clamp(240px,27vw,330px)] -translate-y-1/2 lg:right-[12%]">
          <div className="relative">
            {/* a lente: anel pulsante + anel cônico girando */}
            <span
              className="hero-pulse-ring absolute top-1/2 left-1/2 size-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                backgroundColor: `color-mix(in oklab, ${CYAN} 24%, transparent)`,
              }}
            />
            <span
              className="arena-ring absolute top-1/2 left-1/2 size-52 -translate-x-1/2 -translate-y-1/2 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_calc(100%-1.5px))]"
              style={{
                background: `conic-gradient(from 0deg, transparent 8%, color-mix(in oklab, ${CYAN} 85%, transparent) 26%, transparent 44%, color-mix(in oklab, ${GREEN} 70%, transparent) 70%, transparent 88%)`,
              }}
            />

            <div className="relative flex flex-col gap-2.5">
              <ClientCardGhost
                floatDur={7.4}
                floatDelay={0.3}
                bars={[40, 70, 55]}
                className="w-[84%] origin-right scale-[0.94] self-start opacity-70"
              />
              <ClientCardGhost
                floatDur={8.4}
                floatDelay={0.9}
                highlight
                bars={[55, 95, 70]}
              />
              <ClientCardGhost
                floatDur={6.8}
                floatDelay={1.6}
                bars={[35, 60, 48]}
                className="w-[84%] origin-left scale-[0.94] self-end opacity-70"
              />
            </div>

            {/* cursor-olho "visualizar como" sobre o cartão em destaque */}
            <span
              className="bg-gradient-custom hero-float absolute top-1/2 -right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-[#04222A] ring-2 ring-[#050f1c]"
              style={
                {
                  boxShadow: `0 0 28px -4px ${CYAN}`,
                  "--float-dur": "5.5s",
                  "--float-delay": "0.4s",
                } as React.CSSProperties
              }
            >
              <Eye className="size-4.5" weight="fill" />
            </span>
          </div>
        </div>

        <FloatChip
          icon={<Eye className="size-3 text-[#04222A]" weight="fill" />}
          iconChip
          label="Modo"
          value="Visualizar como cliente"
          className="top-[8%] right-[40%] lg:right-[46%]"
          delay={0.6}
          duration={7.6}
        />
        <FloatChip
          icon={
            <ShieldCheck
              className="size-3"
              weight="fill"
              style={{ color: MINT }}
            />
          }
          label="Acesso"
          value="100% do cliente"
          className="bottom-[9%] left-[16%] hidden lg:flex"
          delay={2.2}
          duration={8.4}
        />
      </div>
    </div>
  );
}

/** Fantasma da lente: três cartões (o do meio em destaque) e o cursor-olho. */
export function CsPickerHeroVizSkeleton({ className }: { className?: string }) {
  return (
    <VizGhost className={className} focus="70%">
      <div className="absolute top-1/2 right-[9%] w-[clamp(240px,27vw,330px)] -translate-y-1/2 lg:right-[12%]">
        <div className="relative flex flex-col gap-2.5">
          {[0, 1, 2].map((card) => (
            <GPanel
              key={card}
              floatDelay={card * 0.6}
              floatDur={7 + card * 0.6}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5",
                card === 0 && "w-[84%] self-start opacity-80",
                card === 2 && "w-[84%] self-end opacity-80",
              )}
            >
              <GBone
                delay={card * 110}
                className="size-9 shrink-0 rounded-xl"
              />
              <GLines
                widths={["78%", "52%"]}
                delay={card * 110 + 60}
                className="flex-1"
              />
              <GBone delay={card * 110 + 160} className="h-6 w-5 rounded-md" />
            </GPanel>
          ))}
          <GBone
            delay={360}
            className="absolute top-1/2 -right-3 size-10 -translate-y-1/2 rounded-full"
          />
        </div>
      </div>
      <GChip
        className="absolute top-[8%] right-[40%] lg:right-[46%]"
        floatDelay={0.6}
        floatDur={7.4}
      />
      <GChip
        className="absolute bottom-[11%] left-[16%] hidden lg:flex"
        floatDelay={2.4}
        floatDur={8.2}
        delay={150}
      />
    </VizGhost>
  );
}
