"use client";

import * as React from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  CircleNotch,
  Clock,
  DownloadSimple,
  WarningCircle,
} from "@phosphor-icons/react";

import { CountUp, type CountUpKind } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { cn } from "@/lib/utils";

/* ============================================================
   PROGRESSO DA COLETA DE COMENTÁRIOS
   Fila → Coletando → Concluído. Barra animada, contadores vivos
   e tratamento de erro. Alimentado por
   api.admin.getPostCommentsExtractionJob (post) ou
   api.admin.getCampaignCommentsExtractionStatus (lote da campanha).
   ============================================================ */

export type CommentsExtractionStatus =
  | "PENDING"
  | "DELAYED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface CommentsExtractionStat {
  /** Rótulo curto (ex.: "Armazenados"). */
  label: string;
  /** Número (anima com CountUp ao concluir) ou texto pronto (ex.: uma data). */
  value: number | string;
  /** Formato do CountUp quando `value` é número. Padrão: `int`. */
  kind?: CountUpKind;
  /** Realce semântico do valor — nunca só cor, o rótulo sempre explica. */
  tone?: "default" | "positive" | "warning" | "danger";
}

export interface CommentsExtractionProgressProps {
  /** Título do bloco. Padrão: "Coleta de comentários". */
  title?: string;
  status: CommentsExtractionStatus;
  /** Percentual de 0 a 100 (valores fora da faixa são normalizados). */
  progress: number;
  /** Contadores exibidos na grade inferior. */
  stats?: CommentsExtractionStat[];
  /** Plataforma de origem (INSTAGRAM, TIKTOK…) exibida como meta. */
  platform?: string | null;
  attemptsMade?: number;
  maxAttempts?: number;
  /** Última sincronização conhecida do post/lote. */
  latestSyncAt?: string | Date | null;
  /** Mensagem de erro da fila (failedReason). */
  errorMessage?: string | null;
  /** Renderiza o skeleton no lugar do conteúdo. */
  isLoading?: boolean;
  /** Delay do Reveal, para cascatas com outros blocos. */
  revealDelayMs?: number;
  className?: string;
}

interface StatusVisual {
  label: string;
  description: string;
  Icon: React.ElementType;
  spin?: boolean;
  /** Índice da etapa ativa (0 = fila, 1 = coletando, 2 = concluído). */
  step: number;
  chip: string;
  text: string;
  ring: string;
  bar: string;
}

const STATUS_VISUALS: Record<CommentsExtractionStatus, StatusVisual> = {
  PENDING: {
    label: "Na fila",
    description: "Aguardando um worker disponível para iniciar a coleta.",
    Icon: Clock,
    step: 0,
    chip: "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-500/20 dark:ring-cyan-400/25",
    bar: "from-cyan-500 to-teal-400 dark:from-[var(--brand-cyan)] dark:to-[var(--brand-mint)]",
  },
  DELAYED: {
    label: "Reagendada",
    description: "Aguardando uma nova tentativa automática da plataforma.",
    Icon: ArrowsClockwise,
    step: 0,
    chip: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/20 dark:ring-amber-400/25",
    bar: "from-amber-500 to-orange-400 dark:from-amber-400 dark:to-orange-300",
  },
  RUNNING: {
    label: "Coletando comentários",
    description: "Buscando comentários e respostas direto na plataforma.",
    Icon: CircleNotch,
    spin: true,
    step: 1,
    chip: "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300",
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-500/25 dark:ring-cyan-400/30",
    bar: "from-cyan-500 to-emerald-400 dark:from-[var(--brand-cyan)] dark:to-[var(--brand-green)]",
  },
  COMPLETED: {
    label: "Coleta concluída",
    description: "Comentários coletados e armazenados com sucesso.",
    Icon: CheckCircle,
    step: 2,
    chip: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "ring-emerald-500/20 dark:ring-emerald-400/25",
    bar: "from-emerald-500 to-teal-400 dark:from-[var(--brand-green)] dark:to-[var(--brand-mint)]",
  },
  FAILED: {
    label: "Falha na coleta",
    description: "A coleta foi interrompida antes de terminar.",
    Icon: WarningCircle,
    step: 1,
    chip: "bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/20 dark:ring-red-400/25",
    bar: "from-red-500 to-rose-400 dark:from-red-400 dark:to-rose-300",
  },
};

const STEPS = [
  { key: "queued", label: "Na fila" },
  { key: "running", label: "Coletando" },
  { key: "done", label: "Concluído" },
] as const;

const TONE_CLASSES: Record<
  NonNullable<CommentsExtractionStat["tone"]>,
  string
> = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

/**
 * Cartão de progresso da coleta de comentários de um post ou de um lote
 * de campanha. Use dentro de qualquer página — ele já é um card completo.
 */
export function CommentsExtractionProgress({
  title = "Coleta de comentários",
  status,
  progress,
  stats = [],
  platform,
  attemptsMade,
  maxAttempts,
  latestSyncAt,
  errorMessage,
  isLoading = false,
  revealDelayMs = 0,
  className,
}: CommentsExtractionProgressProps) {
  if (isLoading) {
    return (
      <CommentsExtractionProgressSkeleton
        statCount={Math.max(stats.length, 4)}
        className={className}
      />
    );
  }

  const visual = STATUS_VISUALS[status] ?? STATUS_VISUALS.PENDING;
  const isTerminal = status === "COMPLETED" || status === "FAILED";
  const percentage = clampPercent(status === "COMPLETED" ? 100 : progress);
  const showRetries =
    typeof attemptsMade === "number" && typeof maxAttempts === "number";

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
        {/* ── Cabeçalho: status + percentual ── */}
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
              <p className="truncate text-sm font-bold sm:text-[15px]">
                {title}
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
          aria-label={`Progresso da coleta: ${percentage}%`}
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
            {status === "RUNNING" && (
              <span
                aria-hidden
                className="animate-shimmer block h-full w-full rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)] bg-[length:200%_100%]"
              />
            )}
          </div>
        </div>

        {/* ── Etapas ── */}
        <ol
          aria-label="Etapas da coleta"
          className="flex items-center gap-1.5 sm:gap-2.5"
        >
          {STEPS.map((step, index) => {
            const reached = index <= visual.step;
            const isActive = index === visual.step;
            const isErrorStep = status === "FAILED" && isActive;
            return (
              <React.Fragment key={step.key}>
                {index > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      "h-px min-w-2 flex-1 rounded-full transition-colors duration-500 motion-reduce:transition-none",
                      reached
                        ? "bg-cyan-500/60 dark:bg-[var(--brand-cyan)]/50"
                        : "bg-border",
                    )}
                  />
                )}
                <li
                  aria-current={isActive ? "step" : undefined}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full transition-colors duration-500 motion-reduce:transition-none",
                      isErrorStep
                        ? "bg-red-500 dark:bg-red-400"
                        : reached
                          ? "bg-cyan-600 dark:bg-[var(--brand-cyan)]"
                          : "bg-muted-foreground/35",
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

        {/* ── Contadores ── */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="border-border/60 bg-muted/25 min-w-0 rounded-xl border px-3 py-2"
              >
                <p className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.1em] uppercase">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    "mt-0.5 truncate text-sm font-bold tabular-nums sm:text-base",
                    TONE_CLASSES[stat.tone ?? "default"],
                  )}
                >
                  {typeof stat.value === "number" ? (
                    isTerminal ? (
                      /* Ao terminar o valor é estável: comemora com CountUp. */
                      <CountUp
                        key={`final-${stat.label}-${stat.value}`}
                        value={stat.value}
                        kind={stat.kind ?? "int"}
                        durationMs={800}
                      />
                    ) : (
                      formatCounter(stat.value, stat.kind)
                    )
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Meta ── */}
        {platform || showRetries || latestSyncAt ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {platform && (
              <span className="inline-flex items-center gap-1">
                <DownloadSimple className="size-3.5 shrink-0" weight="bold" />
                {platform}
              </span>
            )}
            {showRetries && (
              <span className="inline-flex items-center gap-1">
                <ArrowsClockwise className="size-3.5 shrink-0" weight="bold" />
                Tentativa {attemptsMade} de {maxAttempts}
              </span>
            )}
            {latestSyncAt && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <Clock className="size-3.5 shrink-0" weight="bold" />
                <span className="truncate">
                  Sync {formatDateTime(latestSyncAt)}
                </span>
              </span>
            )}
          </div>
        ) : null}

        {/* ── Erro ── */}
        {errorMessage && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-xs leading-relaxed text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span className="min-w-0 break-words">{errorMessage}</span>
          </p>
        )}
      </section>
    </Reveal>
  );
}

/** Skeleton que espelha o layout real do progresso de coleta. */
export function CommentsExtractionProgressSkeleton({
  statCount = 4,
  className,
}: {
  statCount?: number;
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
            <Bone delay={60} className="h-3.5 w-40 max-w-full" />
            <Bone delay={120} className="h-3 w-24 rounded-full" />
            <Bone delay={180} className="h-3 w-52 max-w-full rounded-full" />
          </div>
        </div>
        <Bone delay={80} className="h-6 w-14 shrink-0" />
      </div>
      <Bone delay={220} className="h-2 w-full rounded-full" />
      <div className="flex items-center gap-2.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <Bone
            key={index}
            delay={260 + index * 80}
            className="h-3 flex-1 rounded-full"
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: statCount }).map((_, index) => (
          <Bone
            key={index}
            delay={320 + index * 80}
            className="h-[54px] rounded-xl"
          />
        ))}
      </div>
    </div>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatCounter(value: number, kind?: CountUpKind) {
  if (kind === "percent") {
    return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return Math.round(value).toLocaleString("pt-BR");
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "horário desconhecido";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
