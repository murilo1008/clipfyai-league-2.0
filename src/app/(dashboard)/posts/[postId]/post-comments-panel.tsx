"use client";

import * as React from "react";
import {
  ArrowBendUpLeft,
  ArrowsDownUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  ChatsCircle,
  CircleNotch,
  Clock,
  ClockCounterClockwise,
  Database,
  Funnel,
  Heart,
  Info,
  MagnifyingGlass,
  Smiley,
  TreeStructure,
  Warning,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { AnalysisNotice } from "@/components/comments-analysis/comments-analysis-cost-estimate";
import { CommentsExtractionProgress } from "@/components/comments-analysis/comments-extraction-progress";
import { SectionHeading } from "@/components/home/section-heading";
import { CountUp, formatCompact } from "@/components/shared/count-up";
import { Bone } from "@/components/shared/skeletons";
import { Reveal } from "@/components/shared/reveal";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

import { PostCommentsAnalysisPanel } from "./post-comments-analysis-panel";

/* ============================================================
   PAINEL ADMIN — COMENTÁRIOS CRUS DO POST
   Lista com threads (respostas aninhadas), busca, filtros,
   ordenação, paginação, coleta sob demanda e detalhes (raw JSON).
   ============================================================ */

type CommentsOutput = RouterOutputs["admin"]["getPostComments"];
type CommentItem = CommentsOutput["comments"][number];
type SortBy = "recent" | "oldest" | "likes" | "replies";
type FilterBy = "all" | "topLevel" | "replies";
type SentimentFilter = "all" | "positive" | "negative" | "neutral";

const PAGE_SIZE = 20;
const RUNNING_EXTRACTION_STATUSES = ["PENDING", "DELAYED", "RUNNING"];

interface PostCommentsPanelProps {
  postId: string;
}

export default function PostCommentsPanel({ postId }: PostCommentsPanelProps) {
  const [page, setPage] = React.useState(1);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<SortBy>("recent");
  const [filter, setFilter] = React.useState<FilterBy>("all");
  const [sentiment, setSentiment] = React.useState<SentimentFilter>("all");
  const [grouped, setGrouped] = React.useState(true);
  const [selectedCommentId, setSelectedCommentId] = React.useState<
    string | null
  >(null);
  const [expandedThreads, setExpandedThreads] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [extractionJobId, setExtractionJobId] = React.useState<string | null>(
    null,
  );
  const handledExtractionJobId = React.useRef<string | null>(null);
  const utils = api.useUtils();

  /* ── Busca com debounce (evita 1 request por tecla) ───────────────────── */
  React.useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  React.useEffect(() => {
    setPage(1);
  }, [search, sortBy, filter, sentiment, grouped]);

  /* ── Queries ─────────────────────────────────────────────────────────── */

  const commentsQuery = api.admin.getPostComments.useQuery({
    postId,
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    sortBy,
    filter,
    sentiment,
    grouped,
  });

  const extractionJob = api.admin.getPostCommentsExtractionJob.useQuery(
    { jobId: extractionJobId ?? "" },
    {
      enabled: Boolean(extractionJobId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status && RUNNING_EXTRACTION_STATUSES.includes(status)
          ? 2000
          : false;
      },
    },
  );

  const detailsQuery = api.admin.getPostCommentDetails.useQuery(
    { commentId: selectedCommentId ?? "" },
    { enabled: Boolean(selectedCommentId) },
  );

  /* ── Mutation: disparar coleta ───────────────────────────────────────── */

  const triggerExtraction = api.admin.triggerPostCommentsExtraction.useMutation(
    {
      onSuccess: (result) => {
        const queuedJobId = result.jobIds[0];
        if (result.queued > 0 && queuedJobId) {
          handledExtractionJobId.current = null;
          setExtractionJobId(queuedJobId);
          window.sessionStorage.setItem(
            extractionStorageKey(postId),
            queuedJobId,
          );
          toast.success("Coleta de comentários adicionada à fila");
          return;
        }
        toast.info(extractionSkipMessage(result.reason));
      },
      onError: (error) => {
        toast.error(error.message || "Não foi possível iniciar a coleta");
      },
    },
  );

  /* ── Efeitos da coleta ───────────────────────────────────────────────── */

  // Retoma o acompanhamento de uma coleta iniciada antes de recarregar a página.
  React.useEffect(() => {
    const storedJobId = window.sessionStorage.getItem(
      extractionStorageKey(postId),
    );
    if (storedJobId) setExtractionJobId(storedJobId);
  }, [postId]);

  const refetchComments = commentsQuery.refetch;
  React.useEffect(() => {
    const job = extractionJob.data;
    if (!extractionJobId || !job) return;
    if (job.status !== "COMPLETED" && job.status !== "FAILED") return;
    if (handledExtractionJobId.current === extractionJobId) return;
    handledExtractionJobId.current = extractionJobId;
    window.sessionStorage.removeItem(extractionStorageKey(postId));

    if (job.status === "COMPLETED") {
      toast.success(
        `Coleta concluída: ${job.result?.created ?? 0} novos e ${job.result?.updated ?? 0} atualizados`,
      );
      void Promise.all([
        refetchComments(),
        utils.commentsAnalysis.getPostAggregate.invalidate({ postId }),
        utils.commentsAnalysis.getRepresentativeComments.invalidate(),
        utils.commentsAnalysis.estimatePost.invalidate(),
        utils.commentsAnalysis.getCampaignAggregate.invalidate(),
        utils.commentsAnalysis.estimateCampaign.invalidate(),
      ]);
    } else {
      toast.error(job.failedReason ?? "A coleta de comentários falhou");
    }
  }, [extractionJob.data, extractionJobId, postId, refetchComments, utils]);

  React.useEffect(() => {
    if (!extractionJob.error) return;
    window.sessionStorage.removeItem(extractionStorageKey(postId));
  }, [extractionJob.error, postId]);

  /* ── Derivados ───────────────────────────────────────────────────────── */

  const data = commentsQuery.data;
  const comments = data?.comments ?? [];
  const stats = data?.stats;
  const pagination = data?.pagination;
  const isThreaded = grouped && filter !== "replies" && sentiment === "all";
  const hasFilters = Boolean(search) || filter !== "all" || sentiment !== "all";

  const extractionIsRunning =
    triggerExtraction.isPending ||
    RUNNING_EXTRACTION_STATUSES.includes(extractionJob.data?.status ?? "");

  const toggleThread = React.useCallback((commentId: string) => {
    setExpandedThreads((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }, []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 sm:gap-8">
      {/* ===== Análise de comentários (IA) ===== */}
      <PostCommentsAnalysisPanel postId={postId} />

      {/* ===== Lista de comentários ===== */}
      <Reveal immediate delayMs={60}>
        <section className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          {/* ── Cabeçalho + ação ── */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <SectionHeading
                icon={<ChatCircleDots className="size-4" weight="fill" />}
                title="Comentários do post"
                description={
                  stats
                    ? `${formatCompact(stats.storedTotal)} coletados de ${formatCompact(stats.platformComments)} na plataforma`
                    : "Carregando comentários coletados…"
                }
              />
              {stats && stats.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
                    Fontes
                  </span>
                  {stats.sources.map((source) => (
                    <Badge
                      key={source.name}
                      variant="outline"
                      className="gap-1 px-1.5 text-[10px]"
                    >
                      <Database className="size-3" weight="fill" />
                      <span className="max-w-[9rem] truncate">
                        {source.name}
                      </span>
                      <span className="tabular-nums opacity-70">
                        {formatCompact(source.count)}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 cursor-pointer rounded-xl border-cyan-500/40 bg-cyan-500/10 text-xs text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
              disabled={stats?.supported === false || extractionIsRunning}
              onClick={() => triggerExtraction.mutate({ postId })}
            >
              {extractionIsRunning ? (
                <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <ChatsCircle className="size-3.5" weight="fill" />
              )}
              {extractionIsRunning ? "Coletando…" : "Coletar comentários"}
            </Button>
          </div>

          {/* ── Números da coleta ── */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <CommentStat
              icon={Database}
              label="Armazenados"
              value={stats?.storedTotal ?? 0}
              accent="text-cyan-600 dark:text-cyan-400"
              isLoading={commentsQuery.isLoading}
              delayMs={0}
            />
            <CommentStat
              icon={ChatCircleDots}
              label="Principais"
              value={stats?.topLevelTotal ?? 0}
              accent="text-emerald-600 dark:text-emerald-400"
              isLoading={commentsQuery.isLoading}
              delayMs={70}
            />
            <CommentStat
              icon={ArrowBendUpLeft}
              label="Respostas"
              value={stats?.repliesTotal ?? 0}
              accent="text-violet-600 dark:text-violet-400"
              isLoading={commentsQuery.isLoading}
              delayMs={140}
            />
            <div className="border-border/60 bg-background/40 flex min-w-0 flex-col gap-1.5 rounded-2xl border p-3 sm:p-4">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
                  Última sync
                </span>
                <ClockCounterClockwise
                  className="text-muted-foreground size-4 shrink-0"
                  weight="fill"
                />
              </div>
              {commentsQuery.isLoading ? (
                <Bone className="h-5 w-24" delay={210} />
              ) : (
                <p className="truncate text-sm font-bold tabular-nums">
                  {stats?.latestSyncAt
                    ? formatShortDate(stats.latestSyncAt)
                    : "—"}
                </p>
              )}
            </div>
          </div>

          {/* ── Progresso da coleta ── */}
          {(triggerExtraction.isPending || extractionJob.data) && (
            <CommentsExtractionProgress
              title="Progresso da coleta deste post"
              status={extractionJob.data?.status ?? "PENDING"}
              progress={extractionJob.data?.progress ?? 0}
              platform={extractionJob.data?.platform}
              attemptsMade={extractionJob.data?.attemptsMade}
              maxAttempts={extractionJob.data?.maxAttempts}
              latestSyncAt={extractionJob.data?.latestSyncAt}
              errorMessage={extractionJob.data?.failedReason}
              stats={
                extractionJob.data
                  ? [
                      {
                        label: "Armazenados",
                        value: extractionJob.data.storedComments,
                        kind: "compact",
                      },
                      {
                        label: "Na plataforma",
                        value: extractionJob.data.platformComments,
                        kind: "compact",
                      },
                      {
                        label: "Novos",
                        value: extractionJob.data.result?.created ?? 0,
                        kind: "compact",
                        tone: "positive",
                      },
                      {
                        label: "Atualizados",
                        value: extractionJob.data.result?.updated ?? 0,
                        kind: "compact",
                      },
                    ]
                  : []
              }
            />
          )}

          {/* ── Avisos ── */}
          {extractionJob.error && (
            <AnalysisNotice tone="amber" icon={Warning}>
              {extractionJob.error.message}
            </AnalysisNotice>
          )}
          {commentsQuery.error && (
            <AnalysisNotice tone="rose" icon={Warning}>
              {commentsQuery.error.message}
            </AnalysisNotice>
          )}
          {stats?.supported === false && (
            <AnalysisNotice tone="amber" icon={Warning}>
              Comentários detalhados ainda não estão disponíveis para esta
              plataforma.
            </AnalysisNotice>
          )}
          {stats?.isPartial && (
            <AnalysisNotice tone="cyan" icon={Info}>
              Coleta parcial: existem mais comentários na plataforma do que
              registros salvos no Clipfy.
            </AnalysisNotice>
          )}

          {/* ── Filtros ── */}
          <div className="flex flex-col gap-2.5">
            <div className="relative min-w-0">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por texto ou autor…"
                aria-label="Buscar comentários"
                className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pr-10 pl-10"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Limpar busca"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              <Select
                value={filter}
                onValueChange={(value) => setFilter(value as FilterBy)}
              >
                <SelectTrigger
                  aria-label="Filtrar por tipo de comentário"
                  className="h-10 w-full rounded-xl text-xs"
                >
                  <Funnel className="text-muted-foreground mr-1 size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os comentários</SelectItem>
                  <SelectItem value="topLevel">Somente principais</SelectItem>
                  <SelectItem value="replies">Somente respostas</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sentiment}
                onValueChange={(value) =>
                  setSentiment(value as SentimentFilter)
                }
              >
                <SelectTrigger
                  aria-label="Filtrar por sentimento"
                  className="h-10 w-full rounded-xl text-xs"
                >
                  <Smiley className="text-muted-foreground mr-1 size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os sentimentos</SelectItem>
                  <SelectItem value="positive">Positivos</SelectItem>
                  <SelectItem value="negative">Negativos</SelectItem>
                  <SelectItem value="neutral">Neutros</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortBy)}
              >
                <SelectTrigger
                  aria-label="Ordenar comentários"
                  className="h-10 w-full rounded-xl text-xs"
                >
                  <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Mais recentes</SelectItem>
                  <SelectItem value="oldest">Mais antigos</SelectItem>
                  <SelectItem value="likes">Mais curtidos</SelectItem>
                  <SelectItem value="replies">Mais respondidos</SelectItem>
                </SelectContent>
              </Select>

              <label
                className={cn(
                  "border-border/60 bg-background/40 flex h-10 min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 text-xs",
                  (filter === "replies" || sentiment !== "all") &&
                    "cursor-not-allowed opacity-60",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <TreeStructure className="text-muted-foreground size-3.5 shrink-0" />
                  <span className="truncate">Agrupar em threads</span>
                </span>
                <Switch
                  checked={grouped}
                  onCheckedChange={setGrouped}
                  aria-label="Agrupar respostas em threads"
                  disabled={filter === "replies" || sentiment !== "all"}
                />
              </label>
            </div>

            {hasFilters && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground h-9 cursor-pointer rounded-xl text-xs"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setFilter("all");
                    setSentiment("all");
                  }}
                >
                  <X className="size-3.5" />
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>

          {/* ── Lista ── */}
          {commentsQuery.isLoading ? (
            <CommentsSkeleton />
          ) : comments.length > 0 ? (
            <div
              className={cn(
                "flex flex-col gap-2.5 transition-opacity duration-200 motion-reduce:transition-none",
                commentsQuery.isFetching ? "opacity-60" : "opacity-100",
              )}
            >
              {comments.map((comment, index) => (
                <Reveal key={comment.id} delayMs={Math.min(index, 6) * 60}>
                  <CommentRow
                    comment={comment}
                    depth={0}
                    threaded={isThreaded}
                    expanded={expandedThreads.has(comment.id)}
                    onToggleThread={() => toggleThread(comment.id)}
                    onOpenDetails={setSelectedCommentId}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="border-border/60 bg-muted/20 flex min-h-[180px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-8 text-center">
              <ChatCircleDots
                className="text-muted-foreground/40 size-10"
                weight="duotone"
              />
              <p className="text-sm font-semibold">
                Nenhum comentário encontrado
              </p>
              <p className="text-muted-foreground max-w-sm text-xs">
                {search
                  ? "Nenhum resultado para a busca atual."
                  : sentiment !== "all"
                    ? "Nenhum comentário com o sentimento selecionado."
                    : "Dispare a coleta para trazer os comentários da plataforma."}
              </p>
            </div>
          )}

          {/* ── Paginação ── */}
          {pagination && pagination.totalPages > 1 && (
            <div className="border-border/40 flex flex-col gap-2.5 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-xs">
                Página{" "}
                <strong className="text-foreground tabular-nums">
                  {pagination.page}
                </strong>{" "}
                de{" "}
                <strong className="text-foreground tabular-nums">
                  {pagination.totalPages}
                </strong>{" "}
                · {formatCompact(pagination.total)} registros
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 cursor-pointer rounded-xl text-xs sm:flex-none"
                  disabled={page <= 1 || commentsQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <CaretLeft className="size-3.5" weight="bold" />
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 flex-1 cursor-pointer rounded-xl text-xs sm:flex-none"
                  disabled={
                    page >= pagination.totalPages || commentsQuery.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                  <CaretRight className="size-3.5" weight="bold" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </Reveal>

      {/* ===== Detalhes do comentário ===== */}
      <Sheet
        open={Boolean(selectedCommentId)}
        onOpenChange={(open) => !open && setSelectedCommentId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Detalhes do comentário</SheetTitle>
            <SheetDescription className="truncate">
              {detailsQuery.data?.platformCommentId ?? "Carregando metadados…"}
            </SheetDescription>
          </SheetHeader>

          {detailsQuery.isLoading || !detailsQuery.data ? (
            <div className="flex flex-col gap-3 px-4">
              <Bone className="h-24 rounded-2xl" />
              <Bone className="h-48 rounded-2xl" delay={70} />
              <Bone className="h-32 rounded-2xl" delay={140} />
            </div>
          ) : (
            <div className="flex min-w-0 flex-col gap-4 px-4 pb-6">
              <div className="border-border/60 bg-background/40 flex flex-col gap-2 rounded-2xl border p-3.5">
                <p className="text-xs leading-relaxed break-words whitespace-pre-wrap">
                  {detailsQuery.data.text || "Comentário sem texto"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {platformConfig[detailsQuery.data.platform as PlatformKey]
                      ?.label ?? detailsQuery.data.platform}
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Heart className="size-3" weight="fill" />
                    {formatCompact(detailsQuery.data.likes)}
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <ArrowBendUpLeft className="size-3" weight="fill" />
                    {formatCompact(detailsQuery.data.replyCount)}
                  </Badge>
                </div>
              </div>

              <MetadataGrid
                rows={[
                  ["ID interno", detailsQuery.data.id],
                  ["ClipPost", detailsQuery.data.clipPostId],
                  [
                    "Comentário externo",
                    detailsQuery.data.platformCommentId || "—",
                  ],
                  ["Vídeo externo", detailsQuery.data.platformVideoId || "—"],
                  [
                    "Comentário pai",
                    detailsQuery.data.parentComment?.platformCommentId ||
                      detailsQuery.data.parentCommentId ||
                      "—",
                  ],
                  [
                    "Autor",
                    detailsQuery.data.displayName ||
                      detailsQuery.data.username ||
                      "—",
                  ],
                  ["Username", detailsQuery.data.username || "—"],
                  ["Canal do autor", detailsQuery.data.authorChannelId || "—"],
                  ["Fonte", detailsQuery.data.source || "—"],
                  [
                    "Criado na plataforma",
                    detailsQuery.data.createdAtPlatform
                      ? formatDate(detailsQuery.data.createdAtPlatform)
                      : "—",
                  ],
                  [
                    "Última sincronização",
                    detailsQuery.data.lastSyncAt
                      ? formatDate(detailsQuery.data.lastSyncAt)
                      : "—",
                  ],
                  ["Criado no Clipfy", formatDate(detailsQuery.data.createdAt)],
                  [
                    "Atualizado no Clipfy",
                    formatDate(detailsQuery.data.updatedAt),
                  ],
                ]}
              />

              <div className="min-w-0">
                <p className="text-muted-foreground mb-2 text-xs font-semibold">
                  Raw JSON
                </p>
                <pre className="border-border/60 max-h-[360px] overflow-auto rounded-2xl border bg-[#071321] p-3 text-[10px] leading-relaxed text-cyan-100/80">
                  {JSON.stringify(detailsQuery.data.raw ?? null, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ============================================================
   LINHA DE COMENTÁRIO (com thread aninhada)
   ============================================================ */

function CommentRow({
  comment,
  depth,
  threaded,
  expanded,
  onToggleThread,
  onOpenDetails,
}: {
  comment: CommentItem;
  depth: number;
  threaded: boolean;
  expanded: boolean;
  onToggleThread: () => void;
  onOpenDetails: (commentId: string) => void;
}) {
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  const hasReplies = replies.length > 0;
  const author =
    comment.displayName ?? comment.username ?? "Autor desconhecido";
  const platform = platformConfig[comment.platform as PlatformKey];
  const PlatformIcon = platform?.icon;

  return (
    <div
      className={cn(
        "min-w-0",
        depth > 0 && "border-border/50 ml-4 border-l pl-3 sm:ml-8 sm:pl-4",
      )}
    >
      <article className="border-border/60 bg-background/40 hover:border-brand-cyan/40 hover:bg-muted/20 flex min-w-0 gap-2.5 rounded-2xl border p-3 transition-colors duration-200 motion-reduce:transition-none sm:gap-3 sm:p-4">
        <Avatar className="size-8 shrink-0 sm:size-9">
          <AvatarFallback className="bg-cyan-500/15 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
            {getInitials(author)}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="max-w-full min-w-0 truncate text-xs font-bold sm:text-sm">
              {author}
            </p>
            {comment.username && (
              <span className="text-muted-foreground min-w-0 truncate text-[10px] sm:text-xs">
                @{comment.username.replace(/^@/, "")}
              </span>
            )}
            <Badge
              variant="outline"
              className="h-5 shrink-0 gap-1 px-1.5 text-[9px]"
            >
              {PlatformIcon && (
                <PlatformIcon className={cn("size-3", platform?.color)} />
              )}
              {platform?.label ?? comment.platform}
            </Badge>
          </div>

          <p className="text-xs leading-relaxed break-words whitespace-pre-wrap sm:text-sm">
            {comment.text || "Comentário sem texto"}
          </p>

          {comment.parentComment && (
            <p className="bg-muted/40 text-muted-foreground line-clamp-2 min-w-0 rounded-lg px-2 py-1 text-[10px] break-words">
              <ArrowBendUpLeft className="mr-1 inline size-3 align-[-1px]" />
              Resposta a{" "}
              <strong className="font-semibold">
                {comment.parentComment.displayName ??
                  comment.parentComment.username ??
                  comment.parentComment.platformCommentId ??
                  "comentário"}
              </strong>
              : {comment.parentComment.text}
            </p>
          )}

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              {comment.createdAtPlatform
                ? formatDate(comment.createdAtPlatform)
                : "Sem data"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3 shrink-0" weight="fill" />
              {formatCompact(comment.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowBendUpLeft className="size-3 shrink-0" weight="fill" />
              {formatCompact(comment.replyCount)}
            </span>
          </div>

          {threaded && hasReplies && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-brand-cyan not-dark:text-primary h-9 w-fit cursor-pointer rounded-xl px-2 text-[11px] font-semibold"
              aria-expanded={expanded}
              onClick={onToggleThread}
            >
              <CaretDown
                className={cn(
                  "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                  !expanded && "-rotate-90",
                )}
                weight="bold"
              />
              {expanded
                ? "Ocultar respostas"
                : `Ver ${replies.length} ${replies.length === 1 ? "resposta" : "respostas"}`}
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-9 shrink-0 cursor-pointer rounded-xl"
          onClick={() => onOpenDetails(comment.id)}
          aria-label="Abrir detalhes do comentário"
        >
          <Info className="size-4" />
        </Button>
      </article>

      {threaded && expanded && hasReplies && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              threaded={false}
              expanded={false}
              onToggleThread={() => undefined}
              onOpenDetails={onOpenDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PEÇAS AUXILIARES
   ============================================================ */

function CommentStat({
  icon: Icon,
  label,
  value,
  accent,
  isLoading,
  delayMs,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
  isLoading: boolean;
  delayMs: number;
}) {
  return (
    <div className="border-border/60 bg-background/40 flex min-w-0 flex-col gap-1.5 rounded-2xl border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
        <Icon className={cn("size-4 shrink-0", accent)} weight="fill" />
      </div>
      {isLoading ? (
        <Bone className="h-5 w-16" delay={delayMs} />
      ) : (
        <CountUp
          value={value}
          kind="compact"
          delayMs={delayMs}
          className={cn("text-lg font-bold tabular-nums sm:text-xl", accent)}
        />
      )}
    </div>
  );
}

function MetadataGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="border-border/60 divide-border/50 min-w-0 divide-y overflow-hidden rounded-2xl border">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[104px_minmax(0,1fr)] text-xs sm:grid-cols-[132px_minmax(0,1fr)]"
        >
          <div className="bg-muted/30 text-muted-foreground px-3 py-2 text-[11px]">
            {label}
          </div>
          <div className="min-w-0 px-3 py-2 font-mono text-[11px] break-all">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="border-border/60 bg-background/40 flex gap-3 rounded-2xl border p-3 sm:p-4"
        >
          <Bone className="size-9 shrink-0 rounded-full" delay={item * 70} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bone className="h-3 w-40 max-w-full" delay={item * 70 + 20} />
            <Bone className="h-4 w-full" delay={item * 70 + 40} />
            <Bone className="h-4 w-2/3" delay={item * 70 + 60} />
            <div className="flex flex-wrap gap-2">
              <Bone className="h-3 w-16" delay={item * 70 + 80} />
              <Bone className="h-3 w-16" delay={item * 70 + 100} />
              <Bone className="h-3 w-24" delay={item * 70 + 120} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function extractionSkipMessage(reason?: string) {
  const messages: Record<string, string> = {
    "comments extraction is disabled for this trigger":
      "A coleta de comentários está desativada no backend.",
    "ClipPost not found": "O post não foi encontrado.",
    "post has no comments":
      "A plataforma informa que este post ainda não possui comentários.",
  };
  if (!reason) return "A coleta não foi adicionada à fila.";
  if (reason.startsWith("platform ")) {
    return "A plataforma deste post ainda não possui coleta detalhada.";
  }
  return messages[reason] ?? reason;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function extractionStorageKey(postId: string) {
  return `comments-extraction:post:${postId}`;
}
