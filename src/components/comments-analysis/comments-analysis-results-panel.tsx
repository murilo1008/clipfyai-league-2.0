"use client";

import * as React from "react";
import {
  Brain,
  ChatCircleText,
  ChatsCircle,
  Clock,
  Funnel,
  Heart,
  Lightbulb,
  Quotes,
  Scales,
  Smiley,
  SmileyMeh,
  SmileySad,
  ThumbsDown,
  ThumbsUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { SectionHeading } from "@/components/home/section-heading";
import { CountUp, formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/* ============================================================
   PAINEL DE RESULTADO DA ANÁLISE DE COMENTÁRIOS
   Sentimento (donut + barras), resumo, percepção pública,
   pontos positivos, críticas, sugestões e os comentários
   representativos. Funciona no escopo de um post ou de uma
   campanha inteira.
   ============================================================ */

/** Escopo do painel: um post específico ou a campanha consolidada. */
export type CommentsAnalysisScope =
  | { type: "post"; postId: string }
  | { type: "campaign"; campaignId: string };

export type SentimentFilter =
  | "all"
  | "positive"
  | "negative"
  | "neutral"
  | "mixed";

/** Agregado devolvido por `getPostAggregate` / `getCampaignAggregate`. */
export interface CommentsAnalysisAggregateData {
  analyzedComments: number;
  sentimentCounts: unknown;
  topPositivePoints: unknown;
  topCriticisms: unknown;
  topSuggestions: unknown;
  summary: string;
  publicPerception: string;
  generatedAt: string | Date;
  newCommentsSinceGeneratedAt?: number;
  isStale?: boolean;
  /** Só vem para ADMIN. */
  storedComments?: number;
}

/** Comentário representativo devolvido por `getRepresentativeComments`. */
export interface CommentsAnalysisComment {
  id: string;
  platform: string;
  text: string | null;
  username: string | null;
  displayName: string | null;
  likes: number | null;
  analyses?: readonly { sentiment: string | null }[];
}

interface PanelChromeProps {
  /** Título do card. Padrão depende do escopo. */
  title?: string;
  /** Linha de apoio do cabeçalho. Padrão: resumo do agregado. */
  description?: string;
  /** Texto do estado vazio. */
  emptyDescription?: string;
  /** Ações à direita do cabeçalho (ex.: botão "Reanalisar"). */
  headerActions?: React.ReactNode;
  /** Conteúdo extra logo abaixo do cabeçalho (ex.: progresso do job). */
  children?: React.ReactNode;
  /** Delay do Reveal externo, para cascatas com outros blocos. */
  revealDelayMs?: number;
  className?: string;
}

export interface CommentsAnalysisResultsPanelProps extends PanelChromeProps {
  scope: CommentsAnalysisScope;
  /** Quantidade de comentários representativos buscados. Padrão: 30. */
  commentsLimit?: number;
}

export interface CommentsAnalysisResultsProps extends PanelChromeProps {
  scope: CommentsAnalysisScope["type"];
  aggregate: CommentsAnalysisAggregateData | null | undefined;
  comments: readonly CommentsAnalysisComment[];
  isLoading?: boolean;
  isLoadingComments?: boolean;
  errorMessage?: string | null;
  sentimentFilter: SentimentFilter;
  onSentimentFilterChange: (value: SentimentFilter) => void;
}

/* ── Sentimentos ───────────────────────────────────────────────────────── */

type SentimentKey = "positive" | "neutral" | "mixed" | "negative";

interface SentimentMeta {
  key: SentimentKey;
  label: string;
  /** Adjetivo usado na percepção pública ("percepção positiva"). */
  adjective: string;
  Icon: React.ElementType;
  /** Cor do donut — legível nos dois temas. */
  color: string;
  text: string;
  chip: string;
  bar: string;
}

const SENTIMENTS: SentimentMeta[] = [
  {
    key: "positive",
    label: "Positivos",
    adjective: "positiva",
    Icon: Smiley,
    color: "#10b981",
    text: "text-emerald-600 dark:text-emerald-400",
    chip: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    bar: "bg-emerald-500 dark:bg-emerald-400",
  },
  {
    key: "neutral",
    label: "Neutros",
    adjective: "neutra",
    Icon: SmileyMeh,
    color: "#94a3b8",
    text: "text-slate-600 dark:text-slate-300",
    chip: "bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
    bar: "bg-slate-500 dark:bg-slate-400",
  },
  {
    key: "mixed",
    label: "Mistos",
    adjective: "mista",
    Icon: Scales,
    color: "#f59e0b",
    text: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    bar: "bg-amber-500 dark:bg-amber-400",
  },
  {
    key: "negative",
    label: "Negativos",
    adjective: "negativa",
    Icon: SmileySad,
    color: "#ef4444",
    text: "text-red-600 dark:text-red-400",
    chip: "bg-red-500/12 text-red-700 dark:bg-red-400/15 dark:text-red-300",
    bar: "bg-red-500 dark:bg-red-400",
  },
];

const SENTIMENT_MAP = new Map(SENTIMENTS.map((item) => [item.key, item]));

/* ── Painel conectado (busca os dados) ─────────────────────────────────── */

/**
 * Painel completo de resultado — já faz as queries do escopo informado.
 * Para reaproveitar com dados próprios, use `CommentsAnalysisResults`.
 */
export function CommentsAnalysisResultsPanel({
  scope,
  commentsLimit = 30,
  ...chrome
}: CommentsAnalysisResultsPanelProps) {
  const [sentimentFilter, setSentimentFilter] =
    React.useState<SentimentFilter>("all");

  const isPost = scope.type === "post";
  const postId = scope.type === "post" ? scope.postId : undefined;
  const campaignId = scope.type === "campaign" ? scope.campaignId : undefined;

  const postAggregateQuery = api.commentsAnalysis.getPostAggregate.useQuery(
    { postId: postId ?? "" },
    { enabled: isPost, refetchOnWindowFocus: true },
  );
  const campaignAggregateQuery =
    api.commentsAnalysis.getCampaignAggregate.useQuery(
      { campaignId: campaignId ?? "" },
      { enabled: !isPost, refetchOnWindowFocus: true },
    );

  const aggregateQuery = isPost ? postAggregateQuery : campaignAggregateQuery;

  const representativeQuery =
    api.commentsAnalysis.getRepresentativeComments.useQuery(
      isPost
        ? { postId, sentiment: sentimentFilter, limit: commentsLimit }
        : { campaignId, sentiment: sentimentFilter, limit: commentsLimit },
      {
        enabled: Boolean(aggregateQuery.data),
        refetchOnWindowFocus: true,
      },
    );

  return (
    <CommentsAnalysisResults
      {...chrome}
      scope={scope.type}
      aggregate={aggregateQuery.data}
      comments={representativeQuery.data?.comments ?? []}
      isLoading={aggregateQuery.isLoading}
      isLoadingComments={representativeQuery.isLoading}
      errorMessage={
        aggregateQuery.error?.message ?? representativeQuery.error?.message
      }
      sentimentFilter={sentimentFilter}
      onSentimentFilterChange={setSentimentFilter}
    />
  );
}

/* ── Painel apresentacional ────────────────────────────────────────────── */

/** Versão sem fetch: receba os dados prontos e apenas apresente. */
export function CommentsAnalysisResults({
  scope,
  aggregate,
  comments,
  isLoading = false,
  isLoadingComments = false,
  errorMessage,
  sentimentFilter,
  onSentimentFilterChange,
  title,
  description,
  emptyDescription,
  headerActions,
  children,
  revealDelayMs = 0,
  className,
}: CommentsAnalysisResultsProps) {
  const isCampaign = scope === "campaign";
  const resolvedTitle =
    title ??
    (isCampaign ? "Opinião pública da campanha" : "Análise de comentários");
  const resolvedEmpty =
    emptyDescription ??
    (isCampaign
      ? "A análise consolidada dos comentários da campanha aparece aqui quando estiver pronta."
      : "A análise dos comentários deste post aparece aqui quando estiver pronta.");

  const counts = toSentimentCounts(aggregate?.sentimentCounts);
  const total = SENTIMENTS.reduce((sum, item) => sum + counts[item.key], 0);
  const perceptionKey = normalizeSentiment(aggregate?.publicPerception);
  const perception = perceptionKey
    ? SENTIMENT_MAP.get(perceptionKey)
    : undefined;

  const resolvedDescription =
    description ??
    (aggregate
      ? `${aggregate.analyzedComments.toLocaleString("pt-BR")} comentários analisados · percepção ${perception?.adjective ?? aggregate.publicPerception}`
      : isCampaign
        ? "Sentimento consolidado de todos os posts da campanha"
        : "Sentimento, críticas e sugestões extraídos dos comentários");

  return (
    <Reveal immediate delayMs={revealDelayMs}>
      <section
        className={cn(
          "glass-card flex flex-col gap-5 rounded-3xl p-4 sm:gap-6 sm:p-6",
          className,
        )}
      >
        {/* ── Cabeçalho ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SectionHeading
              icon={<Brain className="size-4" weight="fill" />}
              title={resolvedTitle}
              description={resolvedDescription}
            />
          </div>
          {headerActions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>

        {children}

        {isLoading ? (
          <CommentsAnalysisResultsSkeleton />
        ) : errorMessage ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-red-500/25 bg-red-500/8 p-3 text-xs leading-relaxed text-red-700 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-300"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span className="min-w-0 break-words">{errorMessage}</span>
          </p>
        ) : aggregate ? (
          <div className="flex flex-col gap-5 sm:gap-6">
            {/* ── Aviso de análise desatualizada ── */}
            {aggregate.isStale && (
              <Reveal immediate delayMs={60}>
                <p className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3 text-xs leading-relaxed text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
                  <Clock className="mt-0.5 size-4 shrink-0" weight="fill" />
                  <span className="min-w-0">
                    A análise ainda não inclui{" "}
                    <strong className="font-bold">
                      {aggregate.newCommentsSinceGeneratedAt === 1
                        ? "1 comentário novo"
                        : `${(aggregate.newCommentsSinceGeneratedAt ?? 0).toLocaleString("pt-BR")} comentários novos`}
                    </strong>
                    . Rode uma nova análise para atualizar os números.
                  </span>
                </p>
              </Reveal>
            )}

            {/* ── Sentimento + percepção/resumo ── */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-5">
              <Reveal immediate delayMs={120} className="lg:col-span-2">
                <div className="border-border/60 bg-muted/20 flex h-full flex-col gap-4 rounded-2xl border p-4">
                  <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                    Sentimento
                  </p>
                  <SentimentBreakdown counts={counts} total={total} />
                </div>
              </Reveal>

              <Reveal immediate delayMs={180} className="lg:col-span-3">
                <div className="border-border/60 bg-muted/20 flex h-full flex-col gap-4 rounded-2xl border p-4">
                  <PublicPerception
                    perception={perception}
                    rawPerception={aggregate.publicPerception}
                    analyzedComments={aggregate.analyzedComments}
                    storedComments={aggregate.storedComments}
                    generatedAt={aggregate.generatedAt}
                  />
                  <div className="min-w-0">
                    <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase">
                      Resumo
                    </p>
                    <p className="text-foreground/85 text-sm leading-relaxed break-words">
                      {aggregate.summary ||
                        "Sem resumo gerado para este recorte."}
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* ── Pontos positivos, críticas e sugestões ── */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Reveal immediate delayMs={240}>
                <PointList
                  title="Top pontos positivos"
                  emptyMessage="Sem elogios recorrentes o bastante."
                  icon={<ThumbsUp className="size-3.5" weight="fill" />}
                  accent="positive"
                  items={toPoints(aggregate.topPositivePoints)}
                />
              </Reveal>
              <Reveal immediate delayMs={300}>
                <PointList
                  title="Top críticas"
                  emptyMessage="Sem críticas recorrentes o bastante."
                  icon={<ThumbsDown className="size-3.5" weight="fill" />}
                  accent="negative"
                  items={toPoints(aggregate.topCriticisms)}
                />
              </Reveal>
              <Reveal immediate delayMs={360}>
                <PointList
                  title="Top sugestões"
                  emptyMessage="Sem sugestões recorrentes o bastante."
                  icon={<Lightbulb className="size-3.5" weight="fill" />}
                  accent="neutral"
                  items={toPoints(aggregate.topSuggestions)}
                />
              </Reveal>
            </div>

            {/* ── Comentários representativos ── */}
            <Reveal immediate delayMs={420}>
              <RepresentativeComments
                comments={comments}
                counts={counts}
                isLoading={isLoadingComments}
                sentimentFilter={sentimentFilter}
                onSentimentFilterChange={onSentimentFilterChange}
              />
            </Reveal>
          </div>
        ) : (
          <EmptyState description={resolvedEmpty} />
        )}
      </section>
    </Reveal>
  );
}

/* ── Blocos ────────────────────────────────────────────────────────────── */

function SentimentBreakdown({
  counts,
  total,
}: {
  counts: Record<SentimentKey, number>;
  total: number;
}) {
  if (total === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Nenhum comentário classificado ainda.
      </p>
    );
  }

  /* Só os campos primitivos vão para o recharts — nada de componentes
     no payload, senão viram props inválidas no <path> do sector. */
  const donutData = SENTIMENTS.filter((item) => counts[item.key] > 0).map(
    (item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      value: counts[item.key],
    }),
  );

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Donut */}
      <div className="relative size-36 shrink-0 sm:size-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<SentimentTooltip total={total} />} />
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="label"
              innerRadius="66%"
              outerRadius="94%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive
              animationDuration={800}
            >
              {donutData.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <CountUp
            value={total}
            kind="compact"
            className="text-xl font-bold tabular-nums"
          />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
            comentários
          </span>
        </div>
      </div>

      {/* Barras */}
      <div className="flex w-full min-w-0 flex-col gap-2.5">
        {SENTIMENTS.map((item) => {
          const value = counts[item.key];
          const pct = total > 0 ? (value / total) * 100 : 0;
          return (
            <div key={item.key} className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <item.Icon
                    className={cn("size-4 shrink-0", item.text)}
                    weight="fill"
                  />
                  <span className="text-foreground/90 truncate">
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className={cn("font-bold", item.text)}>
                    {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {value.toLocaleString("pt-BR")}
                  </span>
                </span>
              </div>
              <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                    item.bar,
                  )}
                  style={{ width: `${value > 0 ? Math.max(pct, 2) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SentimentTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { label?: string; value?: number } }>;
  total: number;
}) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  const value = datum.value ?? 0;
  return (
    <div className="border-border bg-popover/95 rounded-xl border p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1 font-semibold">{datum.label}</p>
      <p className="text-muted-foreground">
        {value.toLocaleString("pt-BR")} comentários ·{" "}
        {((value / Math.max(total, 1)) * 100).toLocaleString("pt-BR", {
          maximumFractionDigits: 1,
        })}
        %
      </p>
    </div>
  );
}

function PublicPerception({
  perception,
  rawPerception,
  analyzedComments,
  storedComments,
  generatedAt,
}: {
  perception?: SentimentMeta;
  rawPerception: string;
  analyzedComments: number;
  storedComments?: number;
  generatedAt: string | Date;
}) {
  const Icon = perception?.Icon ?? Brain;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
        Percepção pública
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            perception?.chip ?? "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-6" weight="fill" />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-lg font-bold capitalize sm:text-xl",
              perception?.text ?? "text-foreground",
            )}
          >
            {perception?.adjective ?? rawPerception}
          </p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <ChatsCircle className="size-3.5 shrink-0" weight="fill" />
              {analyzedComments.toLocaleString("pt-BR")} analisados
              {typeof storedComments === "number" &&
                ` de ${storedComments.toLocaleString("pt-BR")}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5 shrink-0" weight="fill" />
              {formatDateTime(generatedAt)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

interface AnalysisPoint {
  point: string;
  count?: number;
}

function PointList({
  title,
  items,
  icon,
  accent,
  emptyMessage,
}: {
  title: string;
  items: AnalysisPoint[];
  icon: React.ReactNode;
  accent: "positive" | "negative" | "neutral";
  emptyMessage: string;
}) {
  const meta = SENTIMENT_MAP.get(accent);
  const list = items.slice(0, 5);
  const max = Math.max(...list.map((item) => item.count ?? 0), 1);

  return (
    <div className="border-border/60 bg-muted/20 flex h-full min-w-0 flex-col gap-3 rounded-2xl border p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg",
            meta?.chip,
          )}
        >
          {icon}
        </span>
        <p className="truncate text-sm font-bold">{title}</p>
      </div>

      {list.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {list.map((item, index) => {
            const pct =
              item.count != null ? Math.max((item.count / max) * 100, 6) : 100;
            return (
              <li
                key={`${item.point}-${index}`}
                className="flex min-w-0 flex-col gap-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-xs leading-snug break-words">
                    {item.point}
                  </span>
                  {item.count != null && (
                    <Badge
                      variant="outline"
                      className="shrink-0 tabular-nums"
                      aria-label={`${item.count} menções`}
                    >
                      {item.count.toLocaleString("pt-BR")}
                    </Badge>
                  )}
                </div>
                <div className="bg-muted/60 h-1 w-full overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                      meta?.bar,
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground py-4 text-center text-xs">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}

function RepresentativeComments({
  comments,
  counts,
  isLoading,
  sentimentFilter,
  onSentimentFilterChange,
}: {
  comments: readonly CommentsAnalysisComment[];
  counts: Record<SentimentKey, number>;
  isLoading: boolean;
  sentimentFilter: SentimentFilter;
  onSentimentFilterChange: (value: SentimentFilter) => void;
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex min-w-0 flex-col gap-3 rounded-2xl border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
            <Quotes className="size-3.5" weight="fill" />
          </span>
          <p className="truncate text-sm font-bold">
            Comentários representativos
          </p>
        </div>
        <Select
          value={sentimentFilter}
          onValueChange={(value) =>
            onSentimentFilterChange(value as SentimentFilter)
          }
        >
          <SelectTrigger
            aria-label="Filtrar comentários por sentimento"
            className="h-10 w-full rounded-xl sm:w-[210px]"
          >
            <Funnel className="text-muted-foreground mr-1 size-3.5" />
            <SelectValue placeholder="Filtrar sentimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os sentimentos</SelectItem>
            {SENTIMENTS.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {item.label} ({counts[item.key].toLocaleString("pt-BR")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Bone key={index} delay={index * 90} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {comments.map((comment, index) => (
            <Reveal key={comment.id} delayMs={Math.min(index, 8) * 60}>
              <CommentCard comment={comment} />
            </Reveal>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground border-border/60 rounded-xl border border-dashed px-3 py-6 text-center text-xs">
          {sentimentFilter === "all"
            ? "Nenhum comentário representativo encontrado."
            : `Nenhum comentário ${SENTIMENT_MAP.get(sentimentFilter)?.label.toLowerCase() ?? sentimentFilter} encontrado.`}
        </p>
      )}
    </div>
  );
}

function CommentCard({ comment }: { comment: CommentsAnalysisComment }) {
  const sentimentKey = normalizeSentiment(comment.analyses?.[0]?.sentiment);
  const sentiment = sentimentKey ? SENTIMENT_MAP.get(sentimentKey) : undefined;
  const displayName = comment.displayName?.trim();
  const username = comment.username?.trim();
  const author = displayName
    ? displayName
    : username
      ? `@${username}`
      : "Autor desconhecido";
  const platform = platformConfig[comment.platform as PlatformKey];
  const PlatformIcon = platform?.icon;

  return (
    <article className="border-border/50 bg-background/50 hover:border-brand-cyan/35 flex h-full min-w-0 flex-col gap-2 rounded-xl border p-3 transition-colors duration-200">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            sentiment?.chip ?? "bg-muted text-muted-foreground",
          )}
        >
          {sentiment ? (
            <sentiment.Icon className="size-3" weight="fill" />
          ) : (
            <Brain className="size-3" weight="fill" />
          )}
          {sentiment?.label.replace(/s$/, "") ?? "Sem classificação"}
        </span>
        {platform && (
          <Badge variant="outline" className="shrink-0 gap-1 text-[10px]">
            {PlatformIcon && <PlatformIcon className="size-3" />}
            {platform.label}
          </Badge>
        )}
        <span className="text-muted-foreground min-w-0 truncate text-[11px]">
          {author}
        </span>
        {typeof comment.likes === "number" && comment.likes > 0 && (
          <span className="text-muted-foreground ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums">
            <Heart className="size-3" weight="fill" />
            {formatCompact(comment.likes)}
          </span>
        )}
      </div>
      <p className="text-foreground/80 line-clamp-4 text-xs leading-relaxed break-words">
        {comment.text?.trim() ? comment.text.trim() : "Comentário sem texto"}
      </p>
    </article>
  );
}

function EmptyState({ description }: { description: string }) {
  return (
    <div className="border-border/60 flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center">
      <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
        <ChatCircleText className="size-6" weight="fill" />
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-bold">Nenhuma análise disponível</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

/** Skeleton que espelha o layout real do painel de resultado. */
export function CommentsAnalysisResultsSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 sm:gap-6", className)}>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-5">
        <div className="border-border/60 bg-muted/20 flex flex-col items-center gap-4 rounded-2xl border p-4 lg:col-span-2">
          <Bone className="h-3 w-24 self-start rounded-full" />
          <span
            aria-hidden
            className="skeleton-bone size-36 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-24px),#000_calc(100%-23px))] sm:size-40"
          />
          <div className="flex w-full flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Bone
                key={index}
                delay={index * 100}
                className="h-6 w-full rounded-lg"
              />
            ))}
          </div>
        </div>
        <div className="border-border/60 bg-muted/20 flex flex-col gap-4 rounded-2xl border p-4 lg:col-span-3">
          <Bone className="h-3 w-32 rounded-full" />
          <div className="flex items-center gap-3">
            <Bone delay={80} className="size-11 rounded-2xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bone delay={140} className="h-5 w-32" />
              <Bone delay={200} className="h-3 w-48 max-w-full rounded-full" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Bone
                key={index}
                delay={260 + index * 70}
                className="h-3 w-full rounded-full"
              />
            ))}
            <Bone delay={540} className="h-3 w-2/3 rounded-full" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4"
          >
            <div className="flex items-center gap-2">
              <Bone delay={index * 120} className="size-7 rounded-lg" />
              <Bone delay={index * 120 + 60} className="h-3.5 w-32" />
            </div>
            {Array.from({ length: 4 }).map((_, row) => (
              <Bone
                key={row}
                delay={index * 120 + 120 + row * 60}
                className="h-6 w-full rounded-lg"
              />
            ))}
          </div>
        ))}
      </div>

      <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Bone className="size-7 rounded-lg" />
            <Bone delay={60} className="h-3.5 w-44" />
          </div>
          <Bone delay={120} className="h-10 w-full rounded-xl sm:w-[210px]" />
        </div>
        <div className="grid gap-2.5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Bone key={index} delay={index * 90} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Normalizadores ────────────────────────────────────────────────────── */

const SENTIMENT_KEYS: SentimentKey[] = [
  "positive",
  "neutral",
  "mixed",
  "negative",
];

/** Aceita qualquer string da API e devolve a chave conhecida, ou null. */
function normalizeSentiment(value?: string | null): SentimentKey | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return SENTIMENT_KEYS.includes(normalized as SentimentKey)
    ? (normalized as SentimentKey)
    : null;
}

/** `sentimentCounts` vem como Json: normaliza para um mapa seguro. */
export function toSentimentCounts(
  value: unknown,
): Record<SentimentKey, number> {
  const source =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return SENTIMENT_KEYS.reduce(
    (acc, key) => {
      const raw = Number(source[key]);
      acc[key] = Number.isFinite(raw) ? raw : 0;
      return acc;
    },
    { positive: 0, neutral: 0, mixed: 0, negative: 0 } as Record<
      SentimentKey,
      number
    >,
  );
}

/**
 * Os "top pontos" vêm como Json: aceita tanto `["texto"]` quanto
 * `[{ point, count }]` e devolve sempre a forma normalizada.
 */
export function toPoints(value: unknown): AnalysisPoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): AnalysisPoint | null => {
      if (typeof item === "string") {
        return item.trim() ? { point: item.trim() } : null;
      }
      if (typeof item === "object" && item !== null && "point" in item) {
        const point = (item as { point: unknown }).point;
        if (typeof point !== "string" || !point.trim()) return null;
        const count = (item as { count?: unknown }).count;
        return {
          point: point.trim(),
          count:
            typeof count === "number" && Number.isFinite(count)
              ? count
              : undefined,
        };
      }
      return null;
    })
    .filter((item): item is AnalysisPoint => item !== null);
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "horário desconhecido";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
