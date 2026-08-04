"use client";

import * as React from "react";
import {
  CurrencyDollar,
  Database,
  Lightning,
  Prohibit,
  Recycle,
  WarningCircle,
} from "@phosphor-icons/react";

import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ============================================================
   ESTIMATIVA DE CUSTO DA ANÁLISE (USD)
   Mostrada ANTES de disparar: quanto vai custar, quanto sobra
   do teto configurado e o que será reaproveitado do cache.
   Alimentada por api.commentsAnalysis.estimatePost /
   estimateCampaign (payload solto vindo da API externa).
   ============================================================ */

export interface CommentsAnalysisCostEstimateProps {
  /** Payload cru do endpoint de estimativa. */
  estimate: Record<string, unknown> | undefined;
  isLoading?: boolean;
  errorMessage?: string | null;
  /** Teto estourado: o disparo da análise fica bloqueado. */
  exceedsLimit: boolean;
  /** Delay do Reveal, para cascatas com outros blocos. */
  revealDelayMs?: number;
  className?: string;
}

/** Lê um número de um payload solto (a API de análise responde sem tipagem). */
export function toEstimateNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Formata dólares — o custo da análise de IA é cobrado em USD. */
export function formatCostUsd(value: unknown): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "US$ 0,00";
  if (numeric > 0 && numeric < 0.01) return "< US$ 0,01";
  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function CommentsAnalysisCostEstimate({
  estimate,
  isLoading = false,
  errorMessage,
  exceedsLimit,
  revealDelayMs = 0,
  className,
}: CommentsAnalysisCostEstimateProps) {
  const estimatedCost = toEstimateNumber(estimate?.estimatedCostUsd);
  const costLimit = toEstimateNumber(estimate?.costLimitUsd);
  const queued = toEstimateNumber(estimate?.queuedComments);
  const cached = toEstimateNumber(estimate?.cachedComments);
  const reusable = toEstimateNumber(estimate?.reusableComments);
  const usagePercent =
    costLimit > 0 ? Math.min(100, (estimatedCost / costLimit) * 100) : 0;

  return (
    <Reveal immediate delayMs={revealDelayMs}>
      <div
        className={cn(
          "flex flex-col gap-4 rounded-2xl border p-4",
          exceedsLimit
            ? "border-amber-500/30 bg-amber-500/8 dark:border-amber-400/30 dark:bg-amber-400/10"
            : "border-border/60 bg-muted/20",
          className,
        )}
      >
        {/* ── Cabeçalho ── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15">
              <CurrencyDollar
                className="size-4 text-cyan-600 dark:text-cyan-400"
                weight="bold"
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight">
                Estimativa de custo
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                Calculada antes de disparar a análise
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1 text-[11px]",
              isLoading
                ? "text-muted-foreground"
                : exceedsLimit
                  ? "border-amber-500/35 bg-amber-500/12 text-amber-700 dark:border-amber-400/35 dark:text-amber-300"
                  : "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/35 dark:text-emerald-300",
            )}
          >
            {!isLoading &&
              (exceedsLimit ? (
                <Prohibit className="size-3" weight="fill" />
              ) : (
                <Lightning className="size-3" weight="fill" />
              ))}
            {isLoading
              ? "Calculando…"
              : exceedsLimit
                ? "Acima do teto"
                : "Dentro do teto"}
          </Badge>
        </div>

        {/* ── Números ── */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <EstimateTile
            label="Custo estimado"
            value={formatCostUsd(estimatedCost)}
            hint="modelo + tokens"
            accent="text-cyan-600 dark:text-cyan-400"
            isLoading={isLoading}
            delayMs={0}
          />
          <EstimateTile
            label="Teto configurado"
            value={costLimit > 0 ? formatCostUsd(costLimit) : "Sem teto"}
            hint="limite do backend"
            accent="text-foreground"
            isLoading={isLoading}
            delayMs={70}
          />
          <EstimateTile
            label="Comentários cobrados"
            value={queued}
            hint="entram nesta rodada"
            accent="text-foreground"
            isLoading={isLoading}
            delayMs={140}
          />
          <EstimateTile
            label="Cache / reutilizáveis"
            value={`${cached.toLocaleString("pt-BR")} / ${reusable.toLocaleString("pt-BR")}`}
            hint="não são cobrados"
            accent="text-emerald-600 dark:text-emerald-400"
            icon={Recycle}
            isLoading={isLoading}
            delayMs={210}
          />
        </div>

        {/* ── Consumo do teto ── */}
        {costLimit > 0 && !isLoading && (
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-[11px]">
              <span>Consumo do teto</span>
              <span className="tabular-nums">
                {usagePercent.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </div>
            <div
              className="bg-muted/70 h-2 w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-label="Consumo do teto de custo da análise"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usagePercent)}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                  exceedsLimit
                    ? "bg-amber-500 dark:bg-amber-400"
                    : "bg-gradient-custom",
                )}
                style={{ width: `${Math.max(usagePercent, 2)}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Bloqueio por teto ── */}
        {exceedsLimit && (
          <AnalysisNotice tone="amber" icon={WarningCircle}>
            <strong className="font-bold">Análise bloqueada:</strong> a
            estimativa está acima do teto configurado. Reduza o volume de
            comentários ou aumente o limite no backend.
          </AnalysisNotice>
        )}

        {/* ── Erro ao estimar ── */}
        {errorMessage && (
          <AnalysisNotice tone="rose" icon={WarningCircle}>
            {errorMessage}
          </AnalysisNotice>
        )}
      </div>
    </Reveal>
  );
}

function EstimateTile({
  label,
  value,
  hint,
  accent,
  icon: Icon = Database,
  isLoading,
  delayMs,
}: {
  label: string;
  value: string | number;
  hint: string;
  accent: string;
  icon?: React.ElementType;
  isLoading: boolean;
  delayMs: number;
}) {
  return (
    <div className="border-border/60 bg-background/50 flex min-w-0 flex-col gap-1 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
        <Icon className={cn("size-3.5 shrink-0", accent)} weight="fill" />
      </div>

      {isLoading ? (
        <Bone className="h-5 w-20" delay={delayMs} />
      ) : typeof value === "number" ? (
        <CountUp
          value={value}
          kind="int"
          delayMs={delayMs}
          className={cn("truncate text-sm font-bold tabular-nums", accent)}
        />
      ) : (
        <p
          className={cn("truncate text-sm font-bold tabular-nums", accent)}
          title={value}
        >
          {value}
        </p>
      )}

      <span className="text-muted-foreground truncate text-[10px]">{hint}</span>
    </div>
  );
}

/* ============================================================
   AVISO (banner) reutilizado pelos painéis de comentários
   ============================================================ */

export function AnalysisNotice({
  tone,
  icon: Icon,
  children,
}: {
  tone: "amber" | "rose" | "cyan";
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  const toneClass = {
    amber:
      "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300",
    rose: "border-red-500/25 bg-red-500/8 text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300",
    cyan: "border-cyan-500/25 bg-cyan-500/8 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300",
  }[tone];

  return (
    <p
      role={tone === "rose" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-2xl border p-3 text-xs leading-relaxed",
        toneClass,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" weight="fill" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
