"use client";

import * as React from "react";
import {
  Brain,
  CheckCircle,
  CircleNotch,
  Clock,
  CurrencyDollar,
  Prohibit,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";

import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { cn } from "@/lib/utils";

/* ============================================================
   PROGRESSO DA ANÁLISE DE IA DOS COMENTÁRIOS
   Fila → Analisando → Consolidando → Concluído. Barra animada,
   comentários processados e o CUSTO REAL quando termina.
   Alimentado por api.commentsAnalysis.getJob.
   ============================================================ */

export interface CommentsAnalysisJobProgress {
  phase?: string;
  percentage?: number;
  handledComments?: number;
  completedComments?: number;
  failedComments?: number;
  skippedComments?: number;
  processingComments?: number;
  pendingComments?: number;
  queuedComments?: number;
  totalComments?: number;
  lastProgressAt?: string | Date | null;
}

/**
 * Formato devolvido por `api.commentsAnalysis.getJob` (a API externa responde
 * um objeto solto, por isso todos os campos são opcionais e tolerantes).
 */
export interface CommentsAnalysisJob {
  id?: string;
  status?: string;
  errorMessage?: string | null;
  lastProgressAt?: string | Date | null;
  actualCostUsd?: number | null;
  estimatedCostUsd?: number | null;
  progress?: CommentsAnalysisJobProgress;
  itemsByStatus?: Record<string, number>;
  queuedComments?: number;
  processedComments?: number;
  failedComments?: number;
  skippedComments?: number;
  metadata?: {
    usageTelemetry?: {
      reusedComments?: number;
    } | null;
  } | null;
}

export interface CommentsAnalysisProgressProps {
  job: CommentsAnalysisJob;
  /** Título do bloco. Padrão: "Análise de comentários". */
  title?: string;
  /** Renderiza o skeleton no lugar do conteúdo. */
  isLoading?: boolean;
  /** Delay do Reveal, para cascatas com outros blocos. */
  revealDelayMs?: number;
  className?: string;
}

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
]);

interface PhaseVisual {
  label: string;
  description: string;
  Icon: React.ElementType;
  spin?: boolean;
  /** Índice da etapa ativa (0 fila, 1 analisando, 2 consolidando, 3 fim). */
  step: number;
  chip: string;
  text: string;
  ring: string;
  bar: string;
  dot: string;
}

const NEUTRAL_DOT = "bg-cyan-600 dark:bg-[var(--brand-cyan)]";

const PHASE_VISUALS: Record<string, PhaseVisual> = {
  QUEUED: {
    label: "Na fila",
    description: "Aguardando um worker disponível para iniciar a análise.",
    Icon: Clock,
    step: 0,
    chip: "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-500/20 dark:ring-cyan-400/25",
    bar: "from-cyan-500 to-teal-400 dark:from-[var(--brand-cyan)] dark:to-[var(--brand-mint)]",
    dot: NEUTRAL_DOT,
  },
  ANALYZING: {
    label: "Analisando comentários",
    description: "Classificando sentimento, opinião, tópicos e riscos.",
    Icon: CircleNotch,
    spin: true,
    step: 1,
    chip: "bg-purple-500/12 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300",
    text: "text-purple-700 dark:text-purple-300",
    ring: "ring-purple-500/25 dark:ring-purple-400/30",
    bar: "from-purple-500 to-cyan-400 dark:from-purple-400 dark:to-[var(--brand-cyan)]",
    dot: NEUTRAL_DOT,
  },
  AGGREGATING: {
    label: "Consolidando resultados",
    description: "Gerando o resumo, a percepção pública e os indicadores.",
    Icon: CircleNotch,
    spin: true,
    step: 2,
    chip: "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-500/25 dark:ring-cyan-400/30",
    bar: "from-cyan-500 to-emerald-400 dark:from-[var(--brand-cyan)] dark:to-[var(--brand-green)]",
    dot: NEUTRAL_DOT,
  },
  COMPLETED: {
    label: "Análise concluída",
    description: "Todos os resultados foram consolidados.",
    Icon: CheckCircle,
    step: 3,
    chip: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500/20 dark:ring-emerald-400/25",
    bar: "from-emerald-500 to-teal-400 dark:from-[var(--brand-green)] dark:to-[var(--brand-mint)]",
    dot: "bg-emerald-600 dark:bg-[var(--brand-green)]",
  },
  PARTIAL: {
    label: "Concluída parcialmente",
    description: "Parte dos comentários apresentou falha no processamento.",
    Icon: WarningCircle,
    step: 3,
    chip: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-400",
    ring: "ring-amber-500/20 dark:ring-amber-400/25",
    bar: "from-amber-500 to-orange-400 dark:from-amber-400 dark:to-orange-300",
    dot: "bg-amber-600 dark:bg-amber-400",
  },
  CANCELLED: {
    label: "Análise cancelada",
    description: "O processamento foi interrompido antes de terminar.",
    Icon: Prohibit,
    step: 1,
    chip: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    ring: "ring-border",
    bar: "from-slate-400 to-slate-300 dark:from-slate-500 dark:to-slate-400",
    dot: "bg-muted-foreground/60",
  },
  FAILED: {
    label: "Falha na análise",
    description: "Não foi possível concluir o processamento.",
    Icon: WarningCircle,
    step: 1,
    chip: "bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/20 dark:ring-red-400/25",
    bar: "from-red-500 to-rose-400 dark:from-red-400 dark:to-rose-300",
    dot: "bg-red-600 dark:bg-red-400",
  },
};

/** Aliases de status/fase que a API pode devolver. */
const PHASE_ALIASES: Record<string, string> = {
  PENDING: "QUEUED",
  WAITING: "QUEUED",
  QUEUED: "QUEUED",
  RUNNING: "ANALYZING",
  ANALYZING: "ANALYZING",
  AGGREGATING: "AGGREGATING",
  SUMMARIZING: "AGGREGATING",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
};

const STEPS = [
  { key: "queued", label: "Fila" },
  { key: "analyzing", label: "Analisando" },
  { key: "aggregating", label: "Consolidando" },
  { key: "done", label: "Concluído" },
] as const;

/**
 * Cartão de progresso da análise de IA. Já é um card completo — basta
 * renderizar onde o job estiver sendo acompanhado (com refetchInterval).
 */
export function CommentsAnalysisProgress({
  job,
  title = "Análise de comentários",
  isLoading = false,
  revealDelayMs = 0,
  className,
}: CommentsAnalysisProgressProps) {
  if (isLoading) {
    return <CommentsAnalysisProgressSkeleton className={className} />;
  }

  const progress = job.progress;
  const status = job.status ?? "PENDING";
  const isTerminal = TERMINAL_STATUSES.has(status);

  const completed =
    progress?.completedComments ??
    job.itemsByStatus?.COMPLETED ??
    job.processedComments ??
    0;
  const failed =
    progress?.failedComments ??
    job.itemsByStatus?.FAILED ??
    job.failedComments ??
    0;
  const skipped =
    progress?.skippedComments ??
    job.itemsByStatus?.SKIPPED ??
    job.skippedComments ??
    0;
  const processing =
    progress?.processingComments ?? job.itemsByStatus?.PROCESSING ?? 0;
  const reused = job.metadata?.usageTelemetry?.reusedComments ?? 0;
  const queued = progress?.queuedComments ?? job.queuedComments ?? 0;
  const handled = progress?.handledComments ?? completed + failed;

  const percentage = clampPercent(
    progress?.percentage ??
      (isTerminal
        ? 100
        : queued > 0
          ? Math.min(Math.round((handled / queued) * 100), 99)
          : 0),
  );

  const phaseKey =
    PHASE_ALIASES[(progress?.phase ?? status).toUpperCase()] ?? "QUEUED";
  const visual = PHASE_VISUALS[phaseKey] ?? PHASE_VISUALS.QUEUED!;
  const updatedAt = progress?.lastProgressAt ?? job.lastProgressAt;
  const hasActualCost = typeof job.actualCostUsd === "number";
  const hasEstimatedCost = typeof job.estimatedCostUsd === "number";

  return (
    <Reveal immediate delayMs={revealDelayMs}>
      <section
        aria-live="polite"
        className={cn(
          "glass-card glass-card-hover flex flex-col gap-4 rounded-2xl p-4 ring-1 sm:p-5",
          visual.ring,
          className,
        )}
      >
        {/* ── Cabeçalho ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl",
                visual.chip,
              )}
            >
              <visual.Icon
                className={cn(
                  "size-4.5",
                  visual.spin && "animate-spin motion-reduce:animate-none",
                )}
                weight={visual.spin ? "bold" : "fill"}
              />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold sm:text-[15px]">
                <Brain className="size-4 shrink-0 opacity-70" weight="fill" />
                <span className="truncate">{title}</span>
              </p>
              <p className={cn("text-xs font-semibold", visual.text)}>
                {visual.label}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px] sm:text-xs">
                {visual.description}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 text-xl font-bold tabular-nums sm:text-2xl",
              visual.text,
            )}
          >
            {percentage}%
          </span>
        </div>

        {/* ── Barra ── */}
        <div
          role="progressbar"
          aria-label={`Progresso da análise: ${percentage}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentage}
          className="bg-muted/70 relative h-2 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out motion-reduce:transition-none",
              visual.bar,
            )}
            style={{ width: `${Math.max(percentage, 2)}%` }}
          >
            {!isTerminal && (
              <span
                aria-hidden
                className="animate-shimmer block h-full w-full rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] bg-[length:200%_100%]"
              />
            )}
          </div>
        </div>

        {/* ── Etapas ── */}
        <ol
          aria-label="Etapas da análise"
          className="flex items-center gap-1.5 sm:gap-2.5"
        >
          {STEPS.map((step, index) => {
            const reached = index <= visual.step;
            const isActive = index === visual.step;
            return (
              <React.Fragment key={step.key}>
                {index > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      "h-px min-w-1.5 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none",
                      reached
                        ? "bg-cyan-500/60 dark:bg-[var(--brand-cyan)]/50"
                        : "bg-border",
                    )}
                  />
                )}
                <li
                  aria-current={isActive ? "step" : undefined}
                  className="flex min-w-0 items-center gap-1"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full transition-colors duration-500 motion-reduce:transition-none",
                      reached ? visual.dot : "bg-muted-foreground/35",
                      isActive &&
                        !isTerminal &&
                        "animate-pulse motion-reduce:animate-none",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-[10px] font-semibold sm:text-[11px]",
                      reached ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              </React.Fragment>
            );
          })}
        </ol>

        {/* ── Comentários processados ── */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          <JobStat
            label="Concluídos"
            value={completed}
            suffix={queued > 0 ? `de ${formatInt(queued)}` : undefined}
            isTerminal={isTerminal}
            tone="positive"
          />
          <JobStat
            label="Reutilizados"
            value={reused}
            suffix="do cache"
            isTerminal={isTerminal}
          />
          <JobStat
            label="Em andamento"
            value={processing}
            isTerminal={isTerminal}
          />
          <JobStat label="Ignorados" value={skipped} isTerminal={isTerminal} />
          <JobStat
            label="Falhas"
            value={failed}
            isTerminal={isTerminal}
            tone={failed > 0 ? "danger" : "default"}
          />
        </div>

        {/* ── Custo ── */}
        {(hasActualCost || hasEstimatedCost) && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {hasEstimatedCost && (
              <div className="border-border/60 bg-muted/25 flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5">
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Sparkle className="size-4" weight="fill" />
                </span>
                <div className="min-w-0">
                  <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.1em] uppercase">
                    Custo estimado
                  </p>
                  <p className="truncate text-sm font-bold tabular-nums">
                    {formatUsd(job.estimatedCostUsd ?? 0)}
                  </p>
                </div>
              </div>
            )}
            {hasActualCost && (
              <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 dark:border-emerald-400/25 dark:bg-emerald-400/10">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300">
                  <CurrencyDollar className="size-4" weight="bold" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.1em] text-emerald-700 uppercase dark:text-emerald-400">
                    Custo real
                  </p>
                  <UsdCountUp
                    value={job.actualCostUsd ?? 0}
                    className="block truncate text-sm font-bold text-emerald-700 tabular-nums sm:text-base dark:text-emerald-300"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Meta ── */}
        {updatedAt && (
          <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <Clock className="size-3.5 shrink-0" weight="bold" />
            <span className="truncate">
              Atualizado em {formatDateTime(updatedAt)}
            </span>
          </p>
        )}

        {/* ── Erro ── */}
        {job.errorMessage && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-xs leading-relaxed text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span className="min-w-0 break-words">{job.errorMessage}</span>
          </p>
        )}
      </section>
    </Reveal>
  );
}

/** Skeleton que espelha o layout real do progresso da análise. */
export function CommentsAnalysisProgressSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-4 rounded-2xl p-4 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Bone className="size-9 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={60} className="h-3.5 w-44 max-w-full" />
            <Bone delay={120} className="h-3 w-28 rounded-full" />
            <Bone delay={180} className="h-3 w-56 max-w-full rounded-full" />
          </div>
        </div>
        <Bone delay={80} className="h-6 w-14 shrink-0" />
      </div>
      <Bone delay={220} className="h-2 w-full rounded-full" />
      <div className="flex items-center gap-2.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <Bone
            key={index}
            delay={260 + index * 70}
            className="h-3 flex-1 rounded-full"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Bone
            key={index}
            delay={340 + index * 70}
            className="h-[58px] rounded-xl"
          />
        ))}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Bone delay={620} className="h-14 rounded-xl" />
        <Bone delay={690} className="h-14 rounded-xl" />
      </div>
    </div>
  );
}

function JobStat({
  label,
  value,
  suffix,
  isTerminal,
  tone = "default",
}: {
  label: string;
  value: number;
  suffix?: string;
  isTerminal: boolean;
  tone?: "default" | "positive" | "danger";
}) {
  return (
    <div className="border-border/60 bg-muted/25 min-w-0 rounded-xl border px-3 py-2">
      <p className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.1em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm font-bold tabular-nums sm:text-base",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "danger" && "text-red-600 dark:text-red-400",
        )}
      >
        {/* Enquanto roda o número muda a cada poll (sem animar do zero);
            ao terminar, o valor estabiliza e o CountUp entra em cena. */}
        {isTerminal ? (
          <CountUp
            key={`final-${label}-${value}`}
            value={value}
            kind="int"
            durationMs={800}
          />
        ) : (
          formatInt(value)
        )}
      </p>
      {suffix && (
        <p className="text-muted-foreground truncate text-[10px]">{suffix}</p>
      )}
    </div>
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Contador do custo em dólar. O `CountUp` compartilhado não conhece o
 * formato USD, então aqui repetimos apenas a curva de easing — dispara
 * uma vez por valor e respeita prefers-reduced-motion.
 */
function UsdCountUp({
  value,
  durationMs = 900,
  className,
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / durationMs, 0), 1);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return <span className={className}>{formatUsd(display)}</span>;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatInt(value: number) {
  return Math.round(value).toLocaleString("pt-BR");
}

/** Custos de IA são baixos: até 4 casas para não virar "US$ 0,00". */
export function formatUsd(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  });
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "horário desconhecido";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
