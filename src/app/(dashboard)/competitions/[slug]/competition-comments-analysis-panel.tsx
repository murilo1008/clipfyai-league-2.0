"use client";

import * as React from "react";
import {
  ChatsCircle,
  CircleNotch,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  AnalysisNotice,
  CommentsAnalysisCostEstimate,
} from "@/components/comments-analysis/comments-analysis-cost-estimate";
import {
  CommentsAnalysisProgress,
  type CommentsAnalysisJob,
} from "@/components/comments-analysis/comments-analysis-progress";
import {
  CommentsAnalysisResultsPanel,
  type CommentsAnalysisAggregateData,
} from "@/components/comments-analysis/comments-analysis-results-panel";
import {
  CommentsExtractionProgress,
  type CommentsExtractionStatus,
} from "@/components/comments-analysis/comments-extraction-progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/* ============================================================
   PAINEL ADMIN — OPINIÃO PÚBLICA DA COMPETIÇÃO
   Coleta os comentários dos posts da competição, estima o custo
   em USD (bloqueando acima do teto), dispara a análise de IA,
   acompanha o progresso ao vivo e mostra o resultado agregado.
   ============================================================ */

/** Teto de comentários enviados por rodada de análise da competição. */
const MAX_COMMENTS = 30_000;

const TERMINAL_JOB_STATUSES = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"];

interface CompetitionCommentsAnalysisPanelProps {
  campaignId: string;
  /** Delay do Reveal do painel, para cascatas com outros blocos da página. */
  revealDelayMs?: number;
}

export function CompetitionCommentsAnalysisPanel({
  campaignId,
  revealDelayMs = 0,
}: CompetitionCommentsAnalysisPanelProps) {
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [extractionBatchId, setExtractionBatchId] = React.useState<
    string | null
  >(null);
  const refreshedJobId = React.useRef<string | null>(null);
  const extractionFinished = React.useRef(false);
  const utils = api.useUtils();

  /* ── Queries ─────────────────────────────────────────────────────────── */

  // Mesma chave usada pelo painel de resultados: a query é compartilhada.
  const aggregateQuery = api.commentsAnalysis.getCampaignAggregate.useQuery({
    campaignId,
  });

  const estimateQuery = api.commentsAnalysis.estimateCampaign.useQuery(
    { campaignId, maxComments: MAX_COMMENTS },
    { refetchOnWindowFocus: false },
  );

  const jobQuery = api.commentsAnalysis.getJob.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: Boolean(jobId),
      refetchInterval: (query) => {
        const status = (query.state.data as CommentsAnalysisJob | undefined)
          ?.status;
        return status === "PENDING" || status === "RUNNING" ? 3000 : false;
      },
    },
  );

  const extractionStatus =
    api.admin.getCampaignCommentsExtractionStatus.useQuery(
      { batchId: extractionBatchId ?? "" },
      {
        enabled: Boolean(extractionBatchId),
        refetchInterval: (query) => {
          const status = query.state.data;
          return status && status.processedJobs >= status.totalJobs
            ? false
            : 2500;
        },
        refetchOnWindowFocus: false,
      },
    );

  /* ── Mutations ───────────────────────────────────────────────────────── */

  const trigger = api.commentsAnalysis.triggerCampaign.useMutation({
    onSuccess: async (job) => {
      const nextJobId = (job as { id?: string })?.id;
      refreshedJobId.current = null;
      if (nextJobId) setJobId(nextJobId);
      toast.success("Análise da competição adicionada à fila");
      await utils.commentsAnalysis.getCampaignAggregate.invalidate({
        campaignId,
      });
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível iniciar a análise");
    },
  });

  const triggerExtraction =
    api.admin.triggerCampaignCommentsExtraction.useMutation({
      onSuccess: (result) => {
        if (result.queued === 0 || !result.batchId) {
          toast.info(
            result.reason ??
              "Nenhum post elegível com comentários foi encontrado nesta competição.",
          );
          return;
        }
        extractionFinished.current = false;
        setExtractionBatchId(result.batchId);
        window.sessionStorage.setItem(
          extractionStorageKey(campaignId),
          result.batchId,
        );
        toast.success(
          `${result.queued} post(s) adicionado(s) à fila de comentários.`,
        );
      },
      onError: (error) => {
        toast.error(
          error.message || "Não foi possível iniciar a coleta da competição",
        );
      },
    });

  /* ── Efeitos ─────────────────────────────────────────────────────────── */

  // Retoma o acompanhamento de uma coleta iniciada antes de recarregar a página.
  React.useEffect(() => {
    const storedBatchId = window.sessionStorage.getItem(
      extractionStorageKey(campaignId),
    );
    if (storedBatchId) setExtractionBatchId(storedBatchId);
  }, [campaignId]);

  React.useEffect(() => {
    const status = extractionStatus.data;
    if (
      !extractionBatchId ||
      !status ||
      status.processedJobs < status.totalJobs ||
      extractionFinished.current
    ) {
      return;
    }
    extractionFinished.current = true;
    window.sessionStorage.removeItem(extractionStorageKey(campaignId));

    if (status.failedJobs > 0) {
      toast.warning(
        `Coleta finalizada com ${status.failedJobs} post(s) com falha e ${status.completedJobs} concluído(s).`,
      );
    } else {
      toast.success(`Coleta concluída em ${status.completedJobs} post(s).`);
    }

    void Promise.all([
      utils.commentsAnalysis.estimateCampaign.invalidate({
        campaignId,
        maxComments: MAX_COMMENTS,
      }),
      utils.commentsAnalysis.getCampaignAggregate.invalidate({ campaignId }),
      utils.commentsAnalysis.getRepresentativeComments.invalidate(),
    ]);
  }, [campaignId, extractionBatchId, extractionStatus.data, utils]);

  React.useEffect(() => {
    if (!extractionStatus.error) return;
    window.sessionStorage.removeItem(extractionStorageKey(campaignId));
  }, [campaignId, extractionStatus.error]);

  React.useEffect(() => {
    const job = jobQuery.data as CommentsAnalysisJob | undefined;
    if (!jobId || !job?.status) return;
    if (!TERMINAL_JOB_STATUSES.includes(job.status)) return;
    if (refreshedJobId.current === jobId) return;
    refreshedJobId.current = jobId;

    void Promise.all([
      utils.commentsAnalysis.getCampaignAggregate.invalidate({ campaignId }),
      utils.commentsAnalysis.getRepresentativeComments.invalidate(),
      utils.commentsAnalysis.estimateCampaign.invalidate({
        campaignId,
        maxComments: MAX_COMMENTS,
      }),
    ]);
  }, [campaignId, jobId, jobQuery.data, utils]);

  /* ── Derivados ───────────────────────────────────────────────────────── */

  const aggregate = aggregateQuery.data as
    | CommentsAnalysisAggregateData
    | null
    | undefined;
  const estimate = estimateQuery.data as Record<string, unknown> | undefined;
  const job = jobQuery.data as CommentsAnalysisJob | undefined;
  const batch = extractionStatus.data;

  const isRunning =
    job?.status === "PENDING" || job?.status === "RUNNING" || trigger.isPending;
  const exceedsLimit = Boolean(estimate?.exceedsLimit);
  const canTrigger = !isRunning && !estimateQuery.isLoading && !exceedsLimit;

  const extractionIsRunning =
    triggerExtraction.isPending ||
    (Boolean(extractionBatchId) &&
      !extractionStatus.error &&
      !extractionFinished.current &&
      (!batch || batch.processedJobs < batch.totalJobs));

  const actionErrorMessage =
    trigger.error?.message ??
    jobQuery.error?.message ??
    extractionStatus.error?.message ??
    null;

  return (
    <CommentsAnalysisResultsPanel
      scope={{ type: "campaign", campaignId }}
      revealDelayMs={revealDelayMs}
      title="Opinião pública da competição"
      emptyDescription="Colete os comentários dos posts e rode a análise para ver sentimento, críticas e sugestões consolidados desta competição."
      headerActions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 cursor-pointer rounded-xl border-cyan-500/40 bg-cyan-500/10 text-xs text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
            disabled={extractionIsRunning}
            onClick={() => triggerExtraction.mutate({ campaignId })}
          >
            {extractionIsRunning ? (
              <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <ChatsCircle className="size-3.5" weight="fill" />
            )}
            {extractionIsRunning ? "Coletando…" : "Coletar comentários"}
          </Button>

          <Button
            type="button"
            size="sm"
            variant={aggregate ? "outline" : "default"}
            className={cn(
              "h-9 cursor-pointer rounded-xl text-xs",
              !aggregate &&
                "bg-gradient-custom text-[#04222A] hover:brightness-105",
            )}
            disabled={!canTrigger}
            title={
              exceedsLimit
                ? "Bloqueado: a estimativa de custo está acima do teto configurado"
                : undefined
            }
            onClick={() =>
              trigger.mutate({ campaignId, maxComments: MAX_COMMENTS })
            }
          >
            {isRunning ? (
              <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkle className="size-3.5" weight="fill" />
            )}
            {isRunning
              ? "Analisando…"
              : aggregate
                ? "Reanalisar competição"
                : "Analisar competição"}
          </Button>
        </>
      }
    >
      {/* ── Estimativa de custo (antes de disparar) ── */}
      <CommentsAnalysisCostEstimate
        estimate={estimate}
        isLoading={estimateQuery.isLoading}
        errorMessage={estimateQuery.error?.message}
        exceedsLimit={exceedsLimit}
      />

      {/* ── Progresso da coleta dos posts ── */}
      {(triggerExtraction.isPending || batch) && (
        <CommentsExtractionProgress
          title="Coleta dos posts da competição"
          status={batch ? batchStatus(batch) : "PENDING"}
          progress={batch?.progressPercent ?? 0}
          revealDelayMs={60}
          stats={
            batch
              ? [
                  {
                    label: "Processados",
                    value: `${batch.processedJobs.toLocaleString("pt-BR")}/${batch.totalJobs.toLocaleString("pt-BR")}`,
                  },
                  {
                    label: "Em andamento",
                    value: batch.statusCounts.RUNNING ?? 0,
                  },
                  {
                    label: "Falhas",
                    value: batch.failedJobs,
                    tone: batch.failedJobs > 0 ? "danger" : "default",
                  },
                  {
                    label: "Novos salvos",
                    value: batch.totals.created,
                    tone: "positive",
                  },
                ]
              : []
          }
        />
      )}

      {/* ── Progresso da análise de IA ── */}
      {job && (
        <CommentsAnalysisProgress
          job={job}
          title="Análise da competição"
          revealDelayMs={90}
        />
      )}

      {/* ── Erros de disparo / acompanhamento ── */}
      {actionErrorMessage && (
        <AnalysisNotice tone="rose" icon={WarningCircle}>
          {actionErrorMessage}
        </AnalysisNotice>
      )}
    </CommentsAnalysisResultsPanel>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Converte o lote de coleta da campanha no status visual da barra. */
function batchStatus(status: {
  totalJobs: number;
  processedJobs: number;
  failedJobs: number;
  statusCounts: Record<string, number>;
}): CommentsExtractionStatus {
  if (status.processedJobs >= status.totalJobs) {
    return status.failedJobs > 0 ? "FAILED" : "COMPLETED";
  }
  if ((status.statusCounts.RUNNING ?? 0) > 0) return "RUNNING";
  if ((status.statusCounts.DELAYED ?? 0) > 0) return "DELAYED";
  return "PENDING";
}

function extractionStorageKey(campaignId: string) {
  return `comments-extraction:campaign:${campaignId}`;
}
