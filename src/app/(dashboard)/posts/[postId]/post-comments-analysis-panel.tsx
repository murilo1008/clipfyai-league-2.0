"use client";

import * as React from "react";
import { CircleNotch, Sparkle, WarningCircle } from "@phosphor-icons/react";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/* ============================================================
   PAINEL ADMIN — ANÁLISE DE COMENTÁRIOS DO POST
   Estima o custo em USD (bloqueando acima do teto), dispara a
   análise de IA, acompanha o progresso ao vivo e mostra o
   resultado agregado. A coleta dos comentários crus vive no
   painel de comentários do post.
   ============================================================ */

/** Teto de comentários enviados por rodada de análise de um post. */
const MAX_COMMENTS = 3_000;

const TERMINAL_JOB_STATUSES = ["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"];

interface PostCommentsAnalysisPanelProps {
  postId: string;
  /** Delay do Reveal do painel, para cascatas com outros blocos da página. */
  revealDelayMs?: number;
}

export function PostCommentsAnalysisPanel({
  postId,
  revealDelayMs = 0,
}: PostCommentsAnalysisPanelProps) {
  const [jobId, setJobId] = React.useState<string | null>(null);
  const refreshedJobId = React.useRef<string | null>(null);
  const utils = api.useUtils();

  /* ── Queries ─────────────────────────────────────────────────────────── */

  // Mesma chave usada pelo painel de resultados: a query é compartilhada.
  const aggregateQuery = api.commentsAnalysis.getPostAggregate.useQuery({
    postId,
  });

  const estimateQuery = api.commentsAnalysis.estimatePost.useQuery(
    { postId, maxComments: MAX_COMMENTS },
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

  /* ── Mutation ────────────────────────────────────────────────────────── */

  const trigger = api.commentsAnalysis.triggerPost.useMutation({
    onSuccess: async (job) => {
      const nextJobId = (job as { id?: string })?.id;
      refreshedJobId.current = null;
      if (nextJobId) setJobId(nextJobId);
      toast.success("Análise do post adicionada à fila");
      await Promise.all([
        utils.commentsAnalysis.getPostAggregate.invalidate({ postId }),
        utils.commentsAnalysis.getRepresentativeComments.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Não foi possível iniciar a análise");
    },
  });

  /* ── Efeito: recarrega os dados quando o job encerra ──────────────────── */

  React.useEffect(() => {
    const job = jobQuery.data as CommentsAnalysisJob | undefined;
    if (!jobId || !job?.status) return;
    if (!TERMINAL_JOB_STATUSES.includes(job.status)) return;
    if (refreshedJobId.current === jobId) return;
    refreshedJobId.current = jobId;

    void Promise.all([
      utils.commentsAnalysis.getPostAggregate.invalidate({ postId }),
      utils.commentsAnalysis.getRepresentativeComments.invalidate(),
      utils.commentsAnalysis.estimatePost.invalidate({
        postId,
        maxComments: MAX_COMMENTS,
      }),
    ]);
  }, [jobId, jobQuery.data, postId, utils]);

  /* ── Derivados ───────────────────────────────────────────────────────── */

  const aggregate = aggregateQuery.data as
    | CommentsAnalysisAggregateData
    | null
    | undefined;
  const estimate = estimateQuery.data as Record<string, unknown> | undefined;
  const job = jobQuery.data as CommentsAnalysisJob | undefined;

  const isRunning =
    job?.status === "PENDING" || job?.status === "RUNNING" || trigger.isPending;
  const exceedsLimit = Boolean(estimate?.exceedsLimit);
  const canTrigger = !isRunning && !estimateQuery.isLoading && !exceedsLimit;

  const actionErrorMessage =
    trigger.error?.message ?? jobQuery.error?.message ?? null;

  return (
    <CommentsAnalysisResultsPanel
      scope={{ type: "post", postId }}
      revealDelayMs={revealDelayMs}
      title="Análise de comentários"
      emptyDescription="Colete os comentários deste post e rode a análise para classificar sentimento, tópicos recorrentes, críticas e sugestões."
      headerActions={
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
          onClick={() => trigger.mutate({ postId, maxComments: MAX_COMMENTS })}
        >
          {isRunning ? (
            <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <Sparkle className="size-3.5" weight="fill" />
          )}
          {isRunning
            ? "Analisando…"
            : aggregate
              ? "Reanalisar post"
              : "Analisar post"}
        </Button>
      }
    >
      {/* ── Estimativa de custo (antes de disparar) ── */}
      <CommentsAnalysisCostEstimate
        estimate={estimate}
        isLoading={estimateQuery.isLoading}
        errorMessage={estimateQuery.error?.message}
        exceedsLimit={exceedsLimit}
      />

      {/* ── Progresso da análise de IA ── */}
      {job && (
        <CommentsAnalysisProgress
          job={job}
          title="Análise deste post"
          revealDelayMs={60}
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
