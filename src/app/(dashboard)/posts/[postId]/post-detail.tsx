"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowsClockwise,
  ArrowSquareOut,
  At,
  BookmarkSimple,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  ChatCircle,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  Fire,
  Gauge,
  Globe,
  Hash,
  Heart,
  MapPin,
  Play,
  ShareFat,
  ShieldCheck,
  Timer,
  TrendDown,
  TrendUp,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CommentsAnalysisResultsPanel } from "@/components/comments-analysis/comments-analysis-results-panel";
import { SectionHeading } from "@/components/home/section-heading";
import { CountUp, formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { PostMetricsHistoryDialog } from "../post-metrics-history-dialog";

/*
 * Cores das séries do gráfico — views usa o degradê da marca; as demais usam
 * CSS vars de tema (--chart-*), validadas para os dois modos com separação
 * CVD entre pares adjacentes. Séries secundárias carregam codificação extra
 * (tracejado) para nunca depender só da cor.
 */
const SERIES = {
  likes: "var(--chart-youtube)",
  comments: "var(--chart-facebook)",
  shares: "var(--chart-kwai)",
} as const;

const CHART_LEGEND: Array<{ label: string; brand?: boolean; color?: string }> =
  [
    { label: "Views", brand: true },
    { label: "Likes", color: SERIES.likes },
    { label: "Comentários", color: SERIES.comments },
    { label: "Shares", color: SERIES.shares },
  ];

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  ELIGIBLE: {
    label: "Elegível",
    icon: CheckCircle,
    className:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  PENDING: {
    label: "Pendente",
    icon: Clock,
    className:
      "border-yellow-500/30 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  },
  INELIGIBLE: {
    label: "Inelegível",
    icon: XCircle,
    className: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
  },
  DISQUALIFIED: {
    label: "Desclassificado",
    icon: Warning,
    className: "border-red-600/30 bg-red-600/15 text-red-600 dark:text-red-400",
  },
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/*
 * formatCompact só compacta valores >= 1000; para deltas negativos, formata o
 * valor absoluto e devolve o sinal explícito ("-12,5K" em vez de "-12.500").
 */
const formatSignedCompact = (value: number) =>
  `${value < 0 ? "-" : "+"}${formatCompact(Math.abs(value))}`;

const formatDuration = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

/* ── Tooltip glass compartilhado pelos dois modos do gráfico ───────────── */
function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    stroke?: string;
    fill?: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border-border bg-popover/95 min-w-40 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => {
          const raw = entry.stroke ?? entry.fill ?? entry.color;
          const isBrand = !raw || raw.startsWith("url(");
          return (
            <div
              key={index}
              className="flex items-center justify-between gap-6 text-xs"
            >
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    isBrand && "bg-gradient-custom",
                  )}
                  style={isBrand ? undefined : { background: raw }}
                />
                {entry.name}
              </span>
              <span className="font-semibold tabular-nums">
                {Number(entry.value ?? 0).toLocaleString("pt-BR")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PostDetailProps {
  postId: string;
}

export default function PostDetail({ postId }: PostDetailProps) {
  const router = useRouter();
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [chartMode, setChartMode] = React.useState<"cumulative" | "delta">(
    "cumulative",
  );

  const { data: post, isLoading } = api.customers.getPostById.useQuery({
    postId,
  });

  const copyUrl = () => {
    if (!post) return;
    navigator.clipboard
      .writeText(post.url)
      .then(() => {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      })
      .catch(() => undefined);
  };

  if (isLoading) return <PostDetailSkeleton />;

  if (!post) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-20 text-center">
            <span className="bg-gradient-custom flex size-14 items-center justify-center rounded-2xl text-[#04222A]">
              <Play className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Post não encontrado</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Ele pode ter sido removido ou o link está incorreto.
              </p>
            </div>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => router.push("/posts")}
            >
              <ArrowLeft className="size-4" />
              Voltar para posts
            </Button>
          </div>
        </Reveal>
      </div>
    );
  }

  const status = STATUS_CONFIG[post.status] ?? {
    label: post.status,
    icon: Clock,
    className: "border-gray-500/30 bg-gray-500/15 text-gray-500",
  };
  const StatusIcon = status.icon;

  const config = platformConfig[post.platform as PlatformKey];
  const PlatformIcon = config?.icon ?? Play;

  const username = post.username.startsWith("@")
    ? post.username
    : `@${post.username}`;

  /* Histórico chega em ordem decrescente; o gráfico consome em ordem cronológica. */
  const chartData = post.metricsHistory
    .slice()
    .reverse()
    .map((metric) => ({
      date: new Date(metric.collectedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      views: metric.views,
      likes: metric.likes,
      comments: metric.comments,
      shares: metric.shares,
      viewsDelta: metric.viewsDelta,
    }));

  /*
   * Delta null vira 0 para não sumir coleta do gráfico; só a primeira coleta
   * cronológica (que legitimamente não tem delta) fica de fora. O badge de
   * "N coletas" segue contando chartData, igual ao gráfico de área.
   */
  const deltaData = chartData
    .filter((point, index) => index > 0 || point.viewsDelta !== null)
    .map((point) => ({ date: point.date, delta: point.viewsDelta ?? 0 }));

  const effectiveMode =
    chartMode === "delta" && deltaData.length >= 2 ? "delta" : "cumulative";

  const latestMetric = post.metricsHistory[0];
  const previousMetric = post.metricsHistory[1];
  const getDelta = (current: number, previous: number | undefined) => {
    if (previous === undefined || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  const velocity = latestMetric?.velocity24h ?? null;
  const daysLive = post.postedAt
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(post.postedAt).getTime()) / 86_400_000,
        ),
      )
    : null;
  const avgViewsPerDay = daysLive ? post.views / daysLive : null;
  const peakDelta = deltaData.length
    ? Math.max(...deltaData.map((point) => point.delta))
    : null;

  const miniTiles = [
    {
      key: "er",
      icon: <Fire className="size-4" weight="fill" />,
      label: "Engajamento",
      value: post.engagementRate,
      kind: "percent" as const,
      chipClass: "bg-gradient-custom text-[#04222A]",
      gradientValue: true,
    },
    ...(post.saves > 0
      ? [
          {
            key: "saves",
            icon: <BookmarkSimple className="size-4" weight="fill" />,
            label: "Saves",
            value: post.saves,
            kind: "compact" as const,
            chipClass: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
            gradientValue: false,
          },
        ]
      : []),
    ...(velocity !== null
      ? [
          {
            key: "velocity",
            icon: <Gauge className="size-4" weight="fill" />,
            label: "Views/dia (24h)",
            value: velocity,
            kind: "compact" as const,
            chipClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
            gradientValue: false,
          },
        ]
      : []),
  ];
  const miniGridClass =
    miniTiles.length === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : miniTiles.length === 2
        ? "grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2";

  const validations = [
    {
      label: "Hashtags obrigatórias",
      icon: Hash,
      value: post.hasRequiredHashtags,
    },
    {
      label: "Menções obrigatórias",
      icon: At,
      value: post.hasRequiredMentions,
    },
    { label: "Perfil público", icon: Globe, value: post.isPublicProfile },
    {
      label: "Sem duplicatas",
      icon: Copy,
      value:
        post.hasDuplicates === false
          ? true
          : post.hasDuplicates === true
            ? false
            : null,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 overflow-x-hidden px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
      {/* ===== Header ===== */}
      <Reveal immediate>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/posts")}
              aria-label="Voltar para posts"
              className="size-9 shrink-0 cursor-pointer rounded-xl"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                Media kit do{" "}
                <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                  post
                </span>
              </h1>
              <p className="text-muted-foreground mt-0.5 truncate text-xs sm:text-sm">
                {post.campaign.name}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                status.className,
              )}
            >
              <StatusIcon className="size-3.5" weight="fill" />
              {status.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                config?.borderColor,
                config?.bgColor,
                config?.color,
              )}
            >
              <PlatformIcon className="size-3.5" />
              {config?.label ?? post.platform}
            </Badge>
            {post.duration !== null && (
              <Badge
                variant="outline"
                className="text-muted-foreground gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              >
                <Timer className="size-3.5" weight="fill" />
                {formatDuration(post.duration)}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer rounded-full text-[11px]"
              asChild
            >
              <a href={post.url} target="_blank" rel="noopener noreferrer">
                <ArrowSquareOut className="size-3.5" />
                Abrir na plataforma
              </a>
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Conteúdo ===== */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* ── Coluna do vídeo: thumbnail + URL ── */}
        <div className="flex min-w-0 flex-col items-center gap-4 lg:items-stretch">
          <Reveal
            immediate
            delayMs={60}
            className="w-[72%] sm:w-[55%] md:w-[45%] lg:w-full"
          >
            <div className="relative">
              {/* halo da marca atrás da moldura */}
              <span
                aria-hidden
                className="bg-gradient-custom absolute -inset-2 rounded-[32px] opacity-15 blur-2xl"
              />
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir post de ${username} na plataforma`}
                className="glass-card animate-glow group relative block aspect-[9/16] w-full overflow-hidden rounded-3xl p-0"
              >
                {post.thumbnail ? (
                  <Image
                    src={post.thumbnail}
                    alt={`Thumbnail do post de ${username}`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 72vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="relative flex h-full w-full items-center justify-center bg-[#071321]">
                    <span
                      aria-hidden
                      className="hero-grid absolute inset-0 opacity-40"
                    />
                    <Play className="size-14 text-white/40" weight="fill" />
                  </div>
                )}

                {/* gradiente de leitura */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                {/* badge de plataforma flutuando */}
                <span className="animate-float absolute top-3 right-3 flex size-10 items-center justify-center rounded-2xl bg-black/50 ring-1 ring-white/20 backdrop-blur-md">
                  <PlatformIcon
                    className={cn("size-4.5", config?.color ?? "text-white")}
                  />
                </span>

                {/* play central no hover */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-14 scale-90 items-center justify-center rounded-full bg-white/15 opacity-0 ring-1 ring-white/30 backdrop-blur-md transition-all duration-500 group-hover:scale-100 group-hover:opacity-100">
                    <Play className="size-6 text-white" weight="fill" />
                  </span>
                </span>

                {/* duração */}
                {post.duration !== null && (
                  <span className="absolute right-3 bottom-[74px] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                    <Timer className="size-3" weight="fill" />
                    {formatDuration(post.duration)}
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="truncate text-base font-bold text-white sm:text-lg">
                    {username}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
                    {config?.label ?? post.platform}
                    <span aria-hidden>·</span>
                    <Eye className="size-3" weight="fill" />
                    {formatCompact(post.views)} views
                  </p>
                </div>
              </a>
            </div>
          </Reveal>

          {/* URL */}
          <Reveal immediate delayMs={200} className="w-full">
            <div className="glass-card flex flex-col gap-2 rounded-2xl p-4">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                URL do post
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <p className="text-muted-foreground bg-muted/50 min-w-0 flex-1 truncate rounded-lg px-3 py-2 font-mono text-[11px]">
                  {post.url}
                </p>
                <button
                  type="button"
                  onClick={copyUrl}
                  aria-label="Copiar URL do post"
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all duration-300",
                    copiedUrl
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  {copiedUrl ? (
                    <Check className="animate-scale-in size-4" weight="bold" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
                {copiedUrl && (
                  <span className="sr-only" role="status">
                    URL copiada
                  </span>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        {/* ── Coluna de métricas ── */}
        <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:col-span-2">
          {/* KPIs principais */}
          <Reveal immediate delayMs={120}>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <KpiTile
                icon={<Eye className="size-4" weight="fill" />}
                label="Views"
                value={post.views}
                delta={getDelta(post.views, previousMetric?.views)}
                chipClass="bg-[var(--brand-cyan)] text-[#04222A] not-dark:bg-[#089eb8] not-dark:text-white"
              />
              <KpiTile
                icon={<Heart className="size-4" weight="fill" />}
                label="Likes"
                value={post.likes}
                delta={getDelta(post.likes, previousMetric?.likes)}
                chipClass="bg-[color-mix(in_oklab,var(--chart-youtube)_15%,transparent)] text-[var(--chart-youtube)]"
              />
              <KpiTile
                icon={<ChatCircle className="size-4" weight="fill" />}
                label="Comentários"
                value={post.comments}
                delta={getDelta(post.comments, previousMetric?.comments)}
                chipClass="bg-[color-mix(in_oklab,var(--chart-facebook)_15%,transparent)] text-[var(--chart-facebook)]"
              />
              <KpiTile
                icon={<ShareFat className="size-4" weight="fill" />}
                label="Shares"
                value={post.shares}
                delta={getDelta(post.shares, previousMetric?.shares)}
                chipClass="bg-[color-mix(in_oklab,var(--chart-kwai)_15%,transparent)] text-[var(--chart-kwai)]"
              />
            </div>
          </Reveal>

          {/* KPIs secundários: ER, saves e velocidade */}
          <Reveal immediate delayMs={180}>
            <div className={cn("grid gap-3 sm:gap-4", miniGridClass)}>
              {miniTiles.map((tile) => (
                <MiniTile
                  key={tile.key}
                  icon={tile.icon}
                  label={tile.label}
                  value={tile.value}
                  kind={tile.kind}
                  chipClass={tile.chipClass}
                  gradientValue={tile.gradientValue}
                />
              ))}
            </div>
          </Reveal>

          {/* Crescimento */}
          <Reveal immediate delayMs={240}>
            <div className="glass-card relative flex flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:gap-5 sm:p-6">
              <div className="bg-grid-pattern pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_85%_0%,black,transparent_70%)] opacity-40" />
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-16 size-56 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
              />

              <div className="relative flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  icon={<ChartLineUp className="size-4" weight="fill" />}
                  title="Crescimento do post"
                  description={
                    post.postedAt && daysLive
                      ? `No ar desde ${new Date(
                          post.postedAt,
                        ).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })} · ${daysLive} ${daysLive === 1 ? "dia" : "dias"}`
                      : "Evolução das coletas de métricas"
                  }
                />
                <div className="flex flex-wrap items-center gap-2">
                  {chartData.length > 0 && (
                    <Badge
                      variant="outline"
                      className="border-brand-cyan/25 not-dark:border-primary/30 shrink-0 rounded-full text-[10px] font-bold"
                    >
                      <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                        {chartData.length}{" "}
                        {chartData.length === 1 ? "coleta" : "coletas"}
                      </span>
                    </Badge>
                  )}
                  {deltaData.length >= 2 && (
                    <div
                      role="group"
                      aria-label="Modo do gráfico"
                      className="border-border/60 bg-muted/40 flex items-center gap-0.5 rounded-full border p-0.5"
                    >
                      <button
                        type="button"
                        aria-pressed={effectiveMode === "cumulative"}
                        onClick={() => setChartMode("cumulative")}
                        className={cn(
                          "h-9 cursor-pointer rounded-full px-3.5 text-[11px] font-bold transition-all duration-300",
                          effectiveMode === "cumulative"
                            ? "bg-gradient-custom text-[#04222A] shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Acumulado
                      </button>
                      <button
                        type="button"
                        aria-pressed={effectiveMode === "delta"}
                        onClick={() => setChartMode("delta")}
                        className={cn(
                          "h-9 cursor-pointer rounded-full px-3.5 text-[11px] font-bold transition-all duration-300",
                          effectiveMode === "delta"
                            ? "bg-gradient-custom text-[#04222A] shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Por coleta
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {chartData.length > 1 ? (
                <div className="relative flex flex-col gap-3">
                  <div className="h-[240px] w-full sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {effectiveMode === "cumulative" ? (
                        <AreaChart
                          data={chartData}
                          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="post-views-stroke"
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="0"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--chart-growth-start)"
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--chart-growth-end)"
                              />
                            </linearGradient>
                            <linearGradient
                              id="post-views-fill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--chart-growth-end)"
                                stopOpacity={0.24}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--chart-growth-end)"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                          />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            minTickGap={40}
                            tickMargin={10}
                            tick={{
                              fill: "var(--muted-foreground)",
                              fontSize: 11,
                            }}
                          />
                          <YAxis
                            tickFormatter={(value: number) =>
                              formatCompact(value)
                            }
                            axisLine={false}
                            tickLine={false}
                            width={44}
                            tick={{
                              fill: "var(--muted-foreground)",
                              fontSize: 11,
                            }}
                          />
                          <RechartsTooltip
                            content={<GlassTooltip />}
                            cursor={{
                              stroke:
                                "color-mix(in oklab, var(--foreground) 22%, transparent)",
                              strokeDasharray: "4 4",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="views"
                            name="Views"
                            stroke="url(#post-views-stroke)"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            fill="url(#post-views-fill)"
                            animationDuration={650}
                            activeDot={{
                              r: 4.5,
                              fill: "var(--chart-growth-end)",
                              stroke: "var(--card)",
                              strokeWidth: 2,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="likes"
                            name="Likes"
                            stroke={SERIES.likes}
                            strokeWidth={1.5}
                            strokeDasharray="5 4"
                            fill="transparent"
                            animationDuration={650}
                            activeDot={{
                              r: 3.5,
                              fill: SERIES.likes,
                              stroke: "var(--card)",
                              strokeWidth: 2,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="comments"
                            name="Comentários"
                            stroke={SERIES.comments}
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            fill="transparent"
                            animationDuration={650}
                            activeDot={{
                              r: 3.5,
                              fill: SERIES.comments,
                              stroke: "var(--card)",
                              strokeWidth: 2,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="shares"
                            name="Shares"
                            stroke={SERIES.shares}
                            strokeWidth={1.5}
                            strokeDasharray="3 4"
                            fill="transparent"
                            animationDuration={650}
                            activeDot={{
                              r: 3.5,
                              fill: SERIES.shares,
                              stroke: "var(--card)",
                              strokeWidth: 2,
                            }}
                          />
                        </AreaChart>
                      ) : (
                        <BarChart
                          data={deltaData}
                          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="post-delta-fill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--chart-growth-start)"
                                stopOpacity={0.95}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--chart-growth-end)"
                                stopOpacity={0.55}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            vertical={false}
                            stroke="color-mix(in oklab, var(--foreground) 7%, transparent)"
                          />
                          <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            minTickGap={32}
                            tickMargin={10}
                            tick={{
                              fill: "var(--muted-foreground)",
                              fontSize: 11,
                            }}
                          />
                          <YAxis
                            tickFormatter={(value: number) =>
                              `${value < 0 ? "-" : ""}${formatCompact(
                                Math.abs(value),
                              )}`
                            }
                            axisLine={false}
                            tickLine={false}
                            width={44}
                            tick={{
                              fill: "var(--muted-foreground)",
                              fontSize: 11,
                            }}
                          />
                          <RechartsTooltip
                            content={<GlassTooltip />}
                            cursor={{
                              fill: "color-mix(in oklab, var(--foreground) 5%, transparent)",
                            }}
                          />
                          {/* radius simétrico: barras negativas arredondam para baixo sem lado errado */}
                          <Bar
                            dataKey="delta"
                            name="Novas views"
                            fill="url(#post-delta-fill)"
                            radius={[6, 6, 6, 6]}
                            maxBarSize={30}
                            animationDuration={650}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {effectiveMode === "cumulative" ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {CHART_LEGEND.map((item) => (
                        <span
                          key={item.label}
                          className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium sm:text-xs"
                        >
                          <span
                            className={cn(
                              "size-2 rounded-full",
                              item.brand && "bg-gradient-custom",
                            )}
                            style={
                              item.brand
                                ? undefined
                                : { background: item.color }
                            }
                          />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px] font-medium sm:text-xs">
                      <span className="bg-gradient-custom size-2 rounded-full" />
                      Novas views registradas entre uma coleta e a seguinte
                    </p>
                  )}

                  {/* resumo do desempenho */}
                  <div className="border-border/60 divide-border/60 mt-1 grid grid-cols-3 divide-x border-t pt-3">
                    <div className="min-w-0 pr-2 leading-tight">
                      {avgViewsPerDay !== null ? (
                        <CountUp
                          value={avgViewsPerDay}
                          kind="compact"
                          className="text-sm font-bold tabular-nums sm:text-base"
                        />
                      ) : (
                        <span className="text-sm font-bold sm:text-base">
                          —
                        </span>
                      )}
                      <p className="text-muted-foreground truncate text-[9px] font-semibold tracking-[0.1em] uppercase sm:text-[10px]">
                        Média/dia
                      </p>
                    </div>
                    <div className="min-w-0 px-2 leading-tight sm:px-3">
                      {peakDelta !== null && peakDelta > 0 ? (
                        <CountUp
                          value={peakDelta}
                          kind="compact"
                          className="text-sm font-bold tabular-nums sm:text-base"
                        />
                      ) : (
                        <span className="text-sm font-bold sm:text-base">
                          —
                        </span>
                      )}
                      <p className="text-muted-foreground truncate text-[9px] font-semibold tracking-[0.1em] uppercase sm:text-[10px]">
                        Pico entre coletas
                      </p>
                    </div>
                    <div className="min-w-0 pl-2 leading-tight sm:pl-3">
                      <span className="block truncate text-sm font-bold tabular-nums sm:text-base">
                        {latestMetric
                          ? new Date(
                              latestMetric.collectedAt,
                            ).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                      <p className="text-muted-foreground truncate text-[9px] font-semibold tracking-[0.1em] uppercase sm:text-[10px]">
                        Última coleta
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex h-[200px] flex-col items-center justify-center gap-3 text-center">
                  <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
                    <ChartLineUp className="size-5" weight="fill" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">
                      Ainda estamos coletando dados
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      O gráfico aparece a partir da segunda coleta de métricas.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          {/* Legenda & Tags + Validações */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            <Reveal immediate delayMs={300} className="min-w-0">
              <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<Hash className="size-4" weight="bold" />}
                  title="Legenda & Tags"
                  description="Conteúdo do post"
                />

                {post.caption && (
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                      Legenda
                    </p>
                    <div className="border-border/60 bg-muted/25 max-h-44 overflow-y-auto rounded-xl border p-3">
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {post.caption}
                      </p>
                    </div>
                  </div>
                )}

                {post.hashtags.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                      <Hash className="size-3" weight="bold" />
                      Hashtags ({post.hashtags.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {post.hashtags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="border-brand-cyan/25 bg-brand-cyan/5 hover:border-brand-cyan/50 hover:bg-brand-cyan/10 not-dark:border-primary/25 not-dark:bg-primary/5 not-dark:hover:border-primary/50 not-dark:hover:bg-primary/10 cursor-default rounded-full text-[10px] font-medium transition-all duration-300 hover:-translate-y-0.5"
                        >
                          #{tag.replace(/^#/, "")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {post.mentions.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase">
                      <At className="size-3" weight="bold" />
                      Menções ({post.mentions.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {post.mentions.map((mention, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="cursor-default rounded-full border-blue-500/25 bg-blue-500/5 text-[10px] font-medium text-blue-600 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-500/50 hover:bg-blue-500/10 dark:text-blue-400"
                        >
                          @{mention.replace(/^@/, "")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!post.caption &&
                  post.hashtags.length === 0 &&
                  post.mentions.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                      <span className="bg-gradient-custom flex size-11 items-center justify-center rounded-2xl text-[#04222A]">
                        <Hash className="size-5" weight="bold" />
                      </span>
                      <p className="text-muted-foreground text-xs">
                        Este post não tem legenda nem tags registradas.
                      </p>
                    </div>
                  )}
              </div>
            </Reveal>

            <Reveal immediate delayMs={360} className="min-w-0">
              <div className="glass-card flex h-full flex-col gap-3 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<ShieldCheck className="size-4" weight="fill" />}
                  title="Validações"
                  description="Status de elegibilidade"
                />

                <div className="flex flex-col gap-2">
                  {validations.map((validation, index) => (
                    <ValidationRow
                      key={validation.label}
                      label={validation.label}
                      icon={validation.icon}
                      status={validation.value}
                      delayMs={480 + index * 90}
                    />
                  ))}
                </div>

                {post.ineligibilityReason && (
                  <div
                    className="animate-fade-in-up rounded-xl border border-red-500/20 bg-red-500/5 p-3"
                    style={{ animationDelay: "880ms" }}
                  >
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                      <Warning className="size-3.5" weight="fill" />
                      Motivo da inelegibilidade
                    </p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/80">
                      {post.ineligibilityReason}
                    </p>
                  </div>
                )}

                <Separator className="my-1" />

                <div className="flex flex-col gap-2.5">
                  {post.postedAt && (
                    <span className="text-muted-foreground flex items-center gap-2 text-xs">
                      <CalendarBlank className="size-3.5 shrink-0" />
                      <span className="truncate">
                        Postado em {formatDateTime(post.postedAt)}
                      </span>
                    </span>
                  )}
                  <span className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Clock className="size-3.5 shrink-0" />
                    <span className="truncate">
                      Registrado em {formatDateTime(post.createdAt)}
                    </span>
                  </span>
                  {post.lastMetricsUpdate && (
                    <span className="text-muted-foreground flex items-center gap-2 text-xs">
                      <ArrowsClockwise className="size-3.5 shrink-0" />
                      <span className="truncate">
                        Atualizado em {formatDateTime(post.lastMetricsUpdate)}
                      </span>
                    </span>
                  )}
                  {post.locationName && (
                    <span className="text-muted-foreground flex items-center gap-2 text-xs">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{post.locationName}</span>
                    </span>
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Histórico de métricas */}
          {post.metricsHistory.length > 0 && (
            <Reveal>
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <SectionHeading
                    icon={<ChartBar className="size-4" weight="fill" />}
                    title="Histórico de métricas"
                    description="Evolução das últimas coletas"
                  />
                  <Badge
                    variant="outline"
                    className="border-brand-cyan/25 not-dark:border-primary/30 shrink-0 rounded-full text-[10px] font-bold"
                  >
                    <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                      {post.metricsHistory.length}{" "}
                      {post.metricsHistory.length === 1 ? "coleta" : "coletas"}
                    </span>
                  </Badge>
                </div>

                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        <th
                          scope="col"
                          className="px-3 py-2.5 text-left text-[10px] font-bold uppercase sm:px-4"
                        >
                          Data
                        </th>
                        <th
                          scope="col"
                          className="px-2 py-2.5 text-right text-[10px] font-bold uppercase sm:px-4"
                        >
                          Views
                        </th>
                        <th
                          scope="col"
                          className="px-2 py-2.5 text-right text-[10px] font-bold uppercase sm:px-4"
                        >
                          Likes
                        </th>
                        <th
                          scope="col"
                          className="px-2 py-2.5 text-right text-[10px] font-bold uppercase sm:px-4"
                        >
                          Coment.
                        </th>
                        <th
                          scope="col"
                          className="px-2 py-2.5 text-right text-[10px] font-bold uppercase sm:px-4"
                        >
                          Shares
                        </th>
                        <th
                          scope="col"
                          className="hidden px-3 py-2.5 text-right text-[10px] font-bold uppercase sm:table-cell sm:px-4"
                        >
                          ER
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {post.metricsHistory.slice(0, 10).map((metric, index) => (
                        <tr
                          key={metric.id}
                          className={cn(
                            "border-border/40 hover:bg-muted/20 border-t transition-colors",
                            index === 0 &&
                              "bg-[color-mix(in_oklab,var(--brand-cyan)_4%,transparent)]",
                          )}
                        >
                          <td className="text-muted-foreground px-3 py-2.5 whitespace-nowrap sm:px-4">
                            {new Date(metric.collectedAt).toLocaleDateString(
                              "pt-BR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                            {index === 0 && (
                              <span className="text-gradient ml-1.5 text-[9px] font-bold uppercase not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                                atual
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums sm:px-4">
                            {formatCompact(metric.views)}
                            <DeltaInline value={metric.viewsDelta} />
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums sm:px-4">
                            {formatCompact(metric.likes)}
                            <DeltaInline value={metric.likesDelta} />
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums sm:px-4">
                            {formatCompact(metric.comments)}
                            <DeltaInline value={metric.commentsDelta} />
                          </td>
                          <td className="px-2 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums sm:px-4">
                            {formatCompact(metric.shares)}
                            <DeltaInline value={metric.sharesDelta} />
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-semibold tabular-nums sm:table-cell sm:px-4">
                            {metric.engagementRate !== null
                              ? `${metric.engagementRate.toFixed(2)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {post.metricsHistory.length > 10 ? (
                    <p className="text-muted-foreground text-[11px]">
                      Mostrando 10 de {post.metricsHistory.length} coletas
                    </p>
                  ) : (
                    <span />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer rounded-xl text-xs"
                    onClick={() => setHistoryOpen(true)}
                  >
                    <ChartLineUp className="size-3.5" weight="fill" />
                    Ver histórico completo
                  </Button>
                </div>
              </div>
            </Reveal>
          )}

          {/* Análise de comentários (IA) — fecha a cascata da coluna direita.
              Esta rota é exclusiva do CLIENT: só leitura do resultado, sem
              estimativa de custo nem disparo (ambos são adminOnly). */}
          <CommentsAnalysisResultsPanel
            scope={{ type: "post", postId: post.id }}
            revealDelayMs={420}
            title="Análise de comentários"
            emptyDescription="Assim que a Clipfy League processar os comentários deste post, o resultado da análise aparece aqui."
          />
        </div>
      </div>

      <PostMetricsHistoryDialog
        postId={postId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}

/* ── KPI principal com delta vs. coleta anterior ───────────────────────── */
function KpiTile({
  icon,
  label,
  value,
  delta,
  chipClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta?: number;
  chipClass: string;
}) {
  const showDelta = typeof delta === "number" && Number.isFinite(delta);
  const isUp = (delta ?? 0) >= 0;

  return (
    <div className="glass-card glass-card-hover group flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110",
            chipClass,
          )}
        >
          {icon}
        </span>
      </div>
      <CountUp
        value={value}
        kind="compact"
        className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]"
      />
      {showDelta && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold",
              isUp
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400",
            )}
          >
            {isUp ? (
              <TrendUp className="size-3" weight="bold" />
            ) : (
              <TrendDown className="size-3" weight="bold" />
            )}
            {isUp ? "+" : ""}
            {delta?.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
          </span>
          <span className="text-muted-foreground">vs. coleta anterior</span>
        </div>
      )}
    </div>
  );
}

/* ── KPI compacto (ER, saves, velocidade) ──────────────────────────────── */
function MiniTile({
  icon,
  label,
  value,
  kind,
  chipClass,
  gradientValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  kind: "compact" | "percent";
  chipClass: string;
  gradientValue?: boolean;
}) {
  return (
    <div className="glass-card glass-card-hover group flex items-center gap-3 rounded-2xl p-3.5 sm:p-4">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
          chipClass,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <CountUp
          value={value}
          kind={kind}
          className={cn(
            "text-lg font-bold tracking-tight tabular-nums sm:text-xl",
            gradientValue &&
              "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
          )}
        />
        <p className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </p>
      </div>
    </div>
  );
}

/* ── Linha de validação com entrada em cascata ─────────────────────────── */
function ValidationRow({
  label,
  icon: Icon,
  status,
  delayMs,
}: {
  label: string;
  icon: React.ElementType;
  status: boolean | null | undefined;
  delayMs: number;
}) {
  const state = status === true ? "ok" : status === false ? "fail" : "pending";

  return (
    <div
      className={cn(
        "animate-fade-in-up flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors",
        state === "ok" && "border-emerald-500/20 bg-emerald-500/[0.06]",
        state === "fail" && "border-red-500/20 bg-red-500/[0.06]",
        state === "pending" && "border-border/60 bg-muted/20",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="text-foreground/90 flex min-w-0 items-center gap-2 text-sm">
        <Icon className="text-muted-foreground size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {state === "ok" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="size-3.5" weight="fill" />
          OK
        </span>
      ) : state === "fail" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
          <XCircle className="size-3.5" weight="fill" />
          Falhou
        </span>
      ) : (
        <span className="text-muted-foreground/80 bg-muted/40 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
          <Clock className="size-3.5" />
          Pendente
        </span>
      )}
    </div>
  );
}

/* ── Delta compacto nas células do histórico ───────────────────────────── */
function DeltaInline({ value }: { value: number | null }) {
  if (value === null || value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={cn(
        "ml-1 text-[10px] font-semibold",
        positive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
      )}
    >
      {formatSignedCompact(value)}
    </span>
  );
}

/* ── Skeleton espelhando o layout final ────────────────────────────────── */
function PostDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 overflow-x-hidden px-4 py-6 sm:gap-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-7 w-48 sm:w-64" />
            <Skeleton className="h-3.5 w-32 sm:w-40" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-9 w-40 rounded-full" />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col items-center gap-4 lg:items-stretch">
          <Skeleton className="aspect-[9/16] w-[72%] rounded-3xl sm:w-[55%] md:w-[45%] lg:w-full" />
          <Skeleton className="h-[84px] w-full rounded-2xl" />
          <Skeleton className="h-[92px] w-full rounded-2xl" />
        </div>

        <div className="flex min-w-0 flex-col gap-4 sm:gap-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                className={cn(
                  "h-[72px] rounded-2xl",
                  index === 2 && "hidden sm:block",
                )}
              />
            ))}
          </div>
          <Skeleton className="h-[420px] w-full rounded-3xl" />
          <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
            <Skeleton className="h-72 rounded-3xl" />
            <Skeleton className="h-72 rounded-3xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
