"use client";

import * as React from "react";
import {
  ArrowsClockwise,
  ChatsCircle,
  CircleNotch,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  AnalysisNotice,
  CommentsAnalysisCostEstimate,
  formatCostUsd,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBoundedPolling } from "@/hooks/use-bounded-polling";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import {
  campaignAnalysisEstimateSummary,
  campaignAnalysisInput,
} from "./competition-comments-analysis";

/* ============================================================
   PAINEL ADMIN — OPINIÃO PÚBLICA DA COMPETIÇÃO
   Coleta os comentários dos posts da competição, estima o custo
   em USD (bloqueando acima do teto), dispara a análise de IA,
   acompanha o progresso ao vivo e mostra o resultado agregado.
   ============================================================ */

const TERMINAL_JOB_STATUSES = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"];

/**
 * Polling do job de análise: 3 s, recuando até 1 min, por no máximo 6 h. A
 * análise da competição roda em lote no League e costuma passar de 30 min;
 * depois do prazo, voltar para a aba consulta o job de novo.
 */
const JOB_POLLING = {
  initialMs: 3_000,
  maxIntervalMs: 60_000,
  maxDurationMs: 6 * 60 * 60_000,
};

/**
 * Polling da coleta da competição (muitos posts): 2,5 s, recuando até 30 s,
 * por no máximo 1 h. Depois disso a tela pede para recarregar.
 */
const EXTRACTION_POLLING = {
  initialMs: 2_500,
  maxIntervalMs: 30_000,
  stepMs: 2 * 60_000,
  maxDurationMs: 60 * 60_000,
};

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
  const [isFullReanalysisOpen, setIsFullReanalysisOpen] = React.useState(false);
  const refreshedJobId = React.useRef<string | null>(null);
  const extractionFinished = React.useRef(false);
  const utils = api.useUtils();

  /* ── Queries ─────────────────────────────────────────────────────────── */

  // Mesma chave usada pelo painel de resultados: a query é compartilhada.
  const aggregateQuery = api.commentsAnalysis.getCampaignAggregate.useQuery({
    campaignId,
  });

  const incrementalEstimateInput = React.useMemo(
    () => campaignAnalysisInput(campaignId, false),
    [campaignId],
  );
  const fullEstimateInput = React.useMemo(
    () => campaignAnalysisInput(campaignId, true),
    [campaignId],
  );

  const incrementalEstimateQuery =
    api.commentsAnalysis.estimateCampaign.useQuery(incrementalEstimateInput, {
      refetchOnWindowFocus: false,
      // Cada tentativa é uma carga pesada no League: sem repetição automática.
      retry: false,
    });

  const fullEstimateQuery = api.commentsAnalysis.estimateCampaign.useQuery(
    fullEstimateInput,
    {
      enabled: isFullReanalysisOpen,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  // Os dois pollings param em erro e depois do prazo: um job travado (ou
  // um lote que o League não conhece mais) não fica sendo consultado para
  // sempre — antes, um erro na primeira leitura da coleta deixava `data`
  // vazio e o polling seguia a cada 2,5 s indefinidamente.
  const jobPolling = useBoundedPolling(jobId, JOB_POLLING);
  const jobQuery = api.commentsAnalysis.getJob.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: Boolean(jobId),
      refetchOnWindowFocus: true,
      refetchInterval: (query) => {
        const status = (query.state.data as CommentsAnalysisJob | undefined)
          ?.status;
        return jobPolling.interval(
          query,
          status === "PENDING" || status === "RUNNING",
        );
      },
    },
  );

  const extractionPolling = useBoundedPolling(
    extractionBatchId,
    EXTRACTION_POLLING,
  );
  const extractionStatus =
    api.admin.getCampaignCommentsExtractionStatus.useQuery(
      { batchId: extractionBatchId ?? "" },
      {
        enabled: Boolean(extractionBatchId),
        refetchInterval: (query) => {
          const status = query.state.data;
          return extractionPolling.interval(
            query,
            !status || status.processedJobs < status.totalJobs,
          );
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
      setIsFullReanalysisOpen(false);
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
        ...incrementalEstimateInput,
      }),
      utils.commentsAnalysis.estimateCampaign.invalidate(fullEstimateInput),
      utils.commentsAnalysis.getCampaignAggregate.invalidate({ campaignId }),
      utils.commentsAnalysis.getRepresentativeComments.invalidate(),
    ]);
  }, [
    campaignId,
    extractionBatchId,
    extractionStatus.data,
    fullEstimateInput,
    incrementalEstimateInput,
    utils,
  ]);

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
        ...incrementalEstimateInput,
      }),
      utils.commentsAnalysis.estimateCampaign.invalidate(fullEstimateInput),
    ]);
  }, [
    campaignId,
    fullEstimateInput,
    incrementalEstimateInput,
    jobId,
    jobQuery.data,
    utils,
  ]);

  /* ── Derivados ───────────────────────────────────────────────────────── */

  const aggregate = aggregateQuery.data as
    | CommentsAnalysisAggregateData
    | null
    | undefined;
  const incrementalEstimate = incrementalEstimateQuery.data as
    | Record<string, unknown>
    | undefined;
  const fullEstimate = fullEstimateQuery.data as
    | Record<string, unknown>
    | undefined;
  const fullEstimateSummary = campaignAnalysisEstimateSummary(fullEstimate);
  const job = jobQuery.data as CommentsAnalysisJob | undefined;
  const batch = extractionStatus.data;

  // Depois do prazo do polling o job pode seguir rodando no League: os botões
  // voltam e a tela avisa, em vez de ficar em "Analisando…" para sempre.
  const jobActive = job?.status === "PENDING" || job?.status === "RUNNING";
  const isRunning = (jobActive && !jobPolling.expired) || trigger.isPending;
  const incrementalExceedsLimit = Boolean(incrementalEstimate?.exceedsLimit);
  const canTriggerIncremental =
    !isRunning &&
    !incrementalEstimateQuery.isFetching &&
    !incrementalEstimateQuery.error &&
    Boolean(incrementalEstimate) &&
    !incrementalExceedsLimit;
  const canTriggerFull =
    !isRunning &&
    !fullEstimateQuery.isFetching &&
    !fullEstimateQuery.error &&
    Boolean(fullEstimate) &&
    !fullEstimateSummary.exceedsLimit;

  const extractionIsRunning =
    triggerExtraction.isPending ||
    (Boolean(extractionBatchId) &&
      !extractionStatus.error &&
      !extractionPolling.expired &&
      !extractionFinished.current &&
      (!batch || batch.processedJobs < batch.totalJobs));

  const actionErrorMessage =
    trigger.error?.message ??
    jobQuery.error?.message ??
    extractionStatus.error?.message ??
    (extractionPolling.expired
      ? "A coleta ainda não terminou. Recarregue a página para conferir o andamento."
      : null) ??
    (jobActive && jobPolling.expired
      ? "A análise ainda está em processamento. Volte mais tarde ou recarregue a página."
      : null);

  return (
    <CommentsAnalysisResultsPanel
      scope={{ type: "campaign", campaignId }}
      revealDelayMs={revealDelayMs}
      title="Inteligência de audiência"
      description={
        aggregate
          ? `${aggregate.analyzedComments.toLocaleString("pt-BR")} comentários analisados · insights consolidados da audiência`
          : "Entenda como a audiência reage aos conteúdos da competição"
      }
      emptyDescription="Colete e analise os comentários para acompanhar sentimento, elogios, críticas e oportunidades percebidas pela audiência."
      className="border-cyan-500/15 bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,0.08),transparent_28%),var(--card)]"
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
            {extractionIsRunning ? "Coletando…" : "Atualizar comentários"}
          </Button>

          {aggregate ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="bg-gradient-custom h-9 cursor-pointer rounded-xl text-xs text-[#04222A] hover:brightness-105"
                disabled={!canTriggerIncremental}
                title={
                  incrementalExceedsLimit
                    ? "Bloqueado: a estimativa incremental está acima do teto configurado"
                    : undefined
                }
                onClick={() => trigger.mutate(incrementalEstimateInput)}
              >
                {isRunning ? (
                  <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <Sparkle className="size-3.5" weight="fill" />
                )}
                {isRunning ? "Analisando…" : "Analisar novidades"}
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 cursor-pointer rounded-xl text-xs"
                disabled={isRunning}
                onClick={() => setIsFullReanalysisOpen(true)}
              >
                <ArrowsClockwise className="size-3.5" weight="bold" />
                Reprocessar tudo
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="default"
              className={cn(
                "h-9 cursor-pointer rounded-xl text-xs",
                "bg-gradient-custom text-[#04222A] hover:brightness-105",
              )}
              disabled={!canTriggerIncremental}
              title={
                incrementalExceedsLimit
                  ? "Bloqueado: a estimativa de custo está acima do teto configurado"
                  : undefined
              }
              onClick={() => trigger.mutate(incrementalEstimateInput)}
            >
              {isRunning ? (
                <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Sparkle className="size-3.5" weight="fill" />
              )}
              {isRunning ? "Analisando…" : "Analisar competição"}
            </Button>
          )}
        </>
      }
    >
      {/* ── Estimativa de custo (antes de disparar) ── */}
      <CommentsAnalysisCostEstimate
        estimate={incrementalEstimate}
        isLoading={incrementalEstimateQuery.isFetching}
        errorMessage={incrementalEstimateQuery.error?.message}
        exceedsLimit={incrementalExceedsLimit}
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

      <AlertDialog
        open={isFullReanalysisOpen}
        onOpenChange={setIsFullReanalysisOpen}
      >
        <AlertDialogContent className="rounded-3xl sm:max-w-md">
          <AlertDialogHeader className="text-left sm:text-left">
            <AlertDialogTitle>Reanalisar competição completa?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Todos os comentários serão processados novamente, inclusive os
                  que já possuem uma análise válida.
                </p>

                {fullEstimateQuery.isFetching ? (
                  <p className="flex items-center gap-2 font-medium">
                    <CircleNotch className="size-4 animate-spin" />
                    Calculando estimativa da reanálise completa…
                  </p>
                ) : fullEstimateQuery.error ? (
                  <AnalysisNotice tone="rose" icon={WarningCircle}>
                    {fullEstimateQuery.error.message}
                  </AnalysisNotice>
                ) : (
                  <div className="border-border/60 bg-muted/30 grid grid-cols-2 gap-3 rounded-2xl border p-4">
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Comentários a processar
                      </p>
                      <p className="text-foreground text-lg font-bold tabular-nums">
                        {fullEstimateSummary.queuedComments.toLocaleString(
                          "pt-BR",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        Custo estimado
                      </p>
                      <p className="text-foreground text-lg font-bold tabular-nums">
                        {formatCostUsd(fullEstimateSummary.estimatedCostUsd)}
                      </p>
                    </div>
                  </div>
                )}

                {!fullEstimateQuery.isFetching &&
                  !fullEstimateQuery.error &&
                  fullEstimateSummary.ignoredComments > 0 && (
                    <AnalysisNotice tone="amber" icon={WarningCircle}>
                      {fullEstimateSummary.ignoredComments.toLocaleString(
                        "pt-BR",
                      )}{" "}
                      comentários sem texto serão ignorados antes do
                      processamento. Foram encontrados{" "}
                      {fullEstimateSummary.loadedComments.toLocaleString(
                        "pt-BR",
                      )}{" "}
                      comentários no total.
                    </AnalysisNotice>
                  )}

                {fullEstimateSummary.exceedsLimit && (
                  <AnalysisNotice tone="amber" icon={WarningCircle}>
                    A reanálise completa está acima do teto de custo
                    configurado.
                  </AnalysisNotice>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer rounded-xl"
              disabled={!canTriggerFull}
              onClick={() => trigger.mutate(fullEstimateInput)}
            >
              Confirmar reanálise completa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CommentsAnalysisResultsPanel>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Converte o lote de coleta da campanha no status visual da barra. */
function batchStatus(status: {
  totalJobs: number;
  processedJobs: number;
  completedJobs: number;
  failedJobs: number;
  statusCounts: Record<string, number>;
}): CommentsExtractionStatus {
  if (status.processedJobs >= status.totalJobs) {
    if (status.failedJobs === 0) return "COMPLETED";
    return status.completedJobs > 0 ? "PARTIAL" : "FAILED";
  }
  if ((status.statusCounts.RUNNING ?? 0) > 0) return "RUNNING";
  if ((status.statusCounts.DELAYED ?? 0) > 0) return "DELAYED";
  return "PENDING";
}

function extractionStorageKey(campaignId: string) {
  return `comments-extraction:campaign:${campaignId}`;
}
