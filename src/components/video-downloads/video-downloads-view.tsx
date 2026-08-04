"use client";

import * as React from "react";
import {
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsDownUp,
  ChatCircle,
  CheckCircle,
  CircleNotch,
  CloudArrowDown,
  DownloadSimple,
  Eye,
  FilmSlate,
  Funnel,
  Hourglass,
  MagnifyingGlass,
  Play,
  Prohibit,
  Queue,
  SlidersHorizontal,
  Sparkle,
  ThumbsUp,
  Trophy,
  Video,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { HomeHero } from "@/components/home/home-hero";
import {
  DownloadsQueueHeroViz,
  DownloadsQueueHeroVizSkeleton,
} from "@/components/video-downloads/downloads-queue-hero-viz";
import {
  DownloadsTrayHeroViz,
  DownloadsTrayHeroVizSkeleton,
} from "@/components/video-downloads/downloads-tray-hero-viz";
import { SectionHeading } from "@/components/home/section-heading";
import { StatTile } from "@/components/home/stat-tile";
import { CountUp } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import {
  CardGridSkeleton,
  ListRowsSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

/* ── Tipos ─────────────────────────────────────────────────────────────── */
type Mode = "admin" | "client";
type PlatformFilter = "ALL" | PlatformKey;
type SortBy = "newest" | "views" | "likes" | "comments";
type DownloadStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";
type DownloadStatusFilter = "ALL" | DownloadStatus;
/** "NONE" = post ainda sem registro de download criado. */
type VideoStatusFilter = "ALL" | DownloadStatus | "NONE";

type PostItem = RouterOutputs["videoDownloads"]["admin"]["posts"][number];
type DownloadItem =
  RouterOutputs["videoDownloads"]["admin"]["downloads"][number];
type CampaignItem =
  RouterOutputs["videoDownloads"]["admin"]["campaigns"][number];

/** Teto do router (`limit` aceita no máximo 100). */
const RESULTS_LIMIT = 100;

/* ── Configuração visual por status do download ────────────────────────── */
const STATUS_CONFIG: Record<
  DownloadStatus | "NONE",
  {
    label: string;
    short: string;
    icon: React.ElementType;
    /** Chip sobre fundo de card (respeita tema claro/escuro). */
    className: string;
    /** Chip sobre a miniatura — o scrim é sempre escuro nos dois temas. */
    overlay: string;
    bar: string;
    progress: number;
    spin?: boolean;
  }
> = {
  SUCCEEDED: {
    label: "Pronto para baixar",
    short: "Pronto",
    icon: CheckCircle,
    className:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    overlay: "text-emerald-300",
    bar: "bg-emerald-500",
    progress: 100,
  },
  PROCESSING: {
    label: "Processando o vídeo",
    short: "Processando",
    icon: CircleNotch,
    className:
      "border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    overlay: "text-cyan-300",
    bar: "bg-cyan-500",
    progress: 66,
    spin: true,
  },
  QUEUED: {
    label: "Aguardando na fila",
    short: "Na fila",
    icon: Hourglass,
    className:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    overlay: "text-amber-300",
    bar: "bg-amber-500",
    progress: 28,
  },
  FAILED: {
    label: "Falhou ao baixar",
    short: "Com erro",
    icon: WarningCircle,
    className: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    overlay: "text-red-300",
    bar: "bg-red-500",
    progress: 100,
  },
  NONE: {
    label: "Ainda não enfileirado",
    short: "Sem download",
    icon: Prohibit,
    className:
      "border-slate-500/30 bg-slate-500/15 text-slate-600 dark:text-slate-300",
    overlay: "text-slate-200",
    bar: "bg-slate-400",
    progress: 0,
  },
};

const statusMeta = (status: string | null | undefined) =>
  STATUS_CONFIG[(status as DownloadStatus) ?? "NONE"] ?? STATUS_CONFIG.NONE;

/* ── Plataformas ───────────────────────────────────────────────────────── */
const PLATFORM_LABELS: Record<PlatformFilter, string> = {
  ALL: "Todas as plataformas",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  KWAI: "Kwai",
  FACEBOOK: "Facebook",
};

/** Cor do ícone da rede em fundo claro/escuro (o platformConfig só traz o tom dark). */
const PLATFORM_TEXT: Record<PlatformKey, string> = {
  INSTAGRAM: "text-pink-600 dark:text-pink-400",
  TIKTOK: "text-[#c4123a] dark:text-[#f1204a]",
  YOUTUBE: "text-red-600 dark:text-red-400",
  KWAI: "text-[#b35300] dark:text-[#ff7705]",
  FACEBOOK: "text-[#0f5bc4] dark:text-[#1877f2]",
};

const SORT_LABELS: Record<SortBy, string> = {
  views: "Mais views",
  likes: "Mais likes",
  comments: "Mais comentários",
  newest: "Mais recentes",
};

const VIDEO_STATUS_TABS: { value: VideoStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "SUCCEEDED", label: "Prontos" },
  { value: "PROCESSING", label: "Processando" },
  { value: "QUEUED", label: "Na fila" },
  { value: "FAILED", label: "Com erro" },
  { value: "NONE", label: "Sem download" },
];

const DOWNLOAD_STATUS_TABS: { value: DownloadStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "SUCCEEDED", label: "Prontos" },
  { value: "PROCESSING", label: "Processando" },
  { value: "QUEUED", label: "Na fila" },
  { value: "FAILED", label: "Com erro" },
];

const formatDateTime = (value: string | Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/* ══════════════════════════════════════════════════════════════════════════
   VIEW COMPARTILHADA — admin liga o recurso e acompanha a fila,
   cliente baixa os .mp4 liberados nas competições dele.
   ══════════════════════════════════════════════════════════════════════════ */
export function VideoDownloadsView({ mode }: { mode: Mode }) {
  const isAdmin = mode === "admin";
  const utils = api.useUtils();

  /* ── Estado de filtros/seleção ───────────────────────────────────────── */
  const [campaignId, setCampaignId] = React.useState("");
  const [enableCampaignId, setEnableCampaignId] = React.useState("");
  const [platform, setPlatform] = React.useState<PlatformFilter>("ALL");
  const [sortBy, setSortBy] = React.useState<SortBy>("views");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [minViews, setMinViews] = React.useState("");
  const [minLikes, setMinLikes] = React.useState("");
  const [minComments, setMinComments] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [videoStatus, setVideoStatus] =
    React.useState<VideoStatusFilter>("ALL");
  const [downloadStatus, setDownloadStatus] =
    React.useState<DownloadStatusFilter>("ALL");
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [enqueueingId, setEnqueueingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  /* ── Competições ─────────────────────────────────────────────────────── */
  const adminEnabledCampaigns = api.videoDownloads.admin.campaigns.useQuery(
    { downloadStatus: "ENABLED", status: "ACTIVE" },
    { enabled: isAdmin },
  );
  const adminDisabledCampaigns = api.videoDownloads.admin.campaigns.useQuery(
    { downloadStatus: "DISABLED", status: "ACTIVE" },
    { enabled: isAdmin },
  );
  const clientCampaigns = api.videoDownloads.client.campaigns.useQuery(
    undefined,
    { enabled: !isAdmin },
  );

  const campaigns: CampaignItem[] | undefined = isAdmin
    ? adminEnabledCampaigns.data
    : clientCampaigns.data;
  const campaignsLoading = isAdmin
    ? adminEnabledCampaigns.isLoading
    : clientCampaigns.isLoading;

  const selectedCampaign = React.useMemo(
    () => campaigns?.find((item) => item.id === campaignId),
    [campaigns, campaignId],
  );

  /* Competição que o admin acabou de habilitar — só selecionável quando a lista atualiza. */
  const pendingSelectRef = React.useRef<string | null>(null);

  /* Seleciona a primeira competição — e corrige a seleção se ela sair da lista. */
  React.useEffect(() => {
    if (!campaigns?.length) return;
    const desired = pendingSelectRef.current;
    if (desired) {
      if (!campaigns.some((item) => item.id === desired)) return;
      pendingSelectRef.current = null;
      setCampaignId(desired);
      return;
    }
    if (!campaigns.some((item) => item.id === campaignId)) {
      setCampaignId(campaigns[0]!.id);
    }
  }, [campaigns, campaignId]);

  /* ── Vídeos e downloads ──────────────────────────────────────────────── */
  const postsInput = {
    campaignId,
    platform,
    sortBy,
    search: debouncedSearch || undefined,
    minViews: minViews ? Number(minViews) : undefined,
    minLikes: minLikes ? Number(minLikes) : undefined,
    minComments: minComments ? Number(minComments) : undefined,
    limit: RESULTS_LIMIT,
  } as const;

  const hasCampaign = Boolean(campaignId);

  /*
   * Enquanto houver item na fila/processando, as listas ficam em polling
   * (5s); quando tudo assenta o polling para sozinho.
   */
  const pollWhilePending = (items: PostItem[] | undefined) =>
    items?.some(
      (item) =>
        item.bucketVideo?.status === "QUEUED" ||
        item.bucketVideo?.status === "PROCESSING",
    )
      ? 5_000
      : (false as const);

  const adminPosts = api.videoDownloads.admin.posts.useQuery(postsInput, {
    enabled: isAdmin && hasCampaign,
    refetchInterval: (query) => pollWhilePending(query.state.data),
  });
  const clientPosts = api.videoDownloads.client.posts.useQuery(postsInput, {
    enabled: !isAdmin && hasCampaign,
    refetchInterval: (query) => pollWhilePending(query.state.data),
  });
  const postsQuery = isAdmin ? adminPosts : clientPosts;
  const posts: PostItem[] = React.useMemo(
    () => postsQuery.data ?? [],
    [postsQuery.data],
  );

  /* Contagens por status — base dos KPIs e dos chips de filtro. */
  const counts = React.useMemo(() => {
    const base = {
      ALL: posts.length,
      SUCCEEDED: 0,
      PROCESSING: 0,
      QUEUED: 0,
      FAILED: 0,
      NONE: 0,
    };
    for (const post of posts) {
      const key = (post.bucketVideo?.status ?? "NONE") as keyof typeof base;
      if (key in base) base[key] += 1;
    }
    return base;
  }, [posts]);

  const pending = counts.QUEUED + counts.PROCESSING;
  const pollInterval = pending > 0 ? 5_000 : (false as const);

  const adminDownloads = api.videoDownloads.admin.downloads.useQuery(
    { campaignId, status: downloadStatus, limit: RESULTS_LIMIT },
    { enabled: isAdmin && hasCampaign, refetchInterval: pollInterval },
  );
  const clientDownloads = api.videoDownloads.client.downloads.useQuery(
    { campaignId, status: "SUCCEEDED", limit: RESULTS_LIMIT },
    { enabled: !isAdmin && hasCampaign, refetchInterval: pollInterval },
  );
  const downloadsQuery = isAdmin ? adminDownloads : clientDownloads;
  const downloads: DownloadItem[] = downloadsQuery.data ?? [];

  const filteredPosts = React.useMemo(() => {
    if (videoStatus === "ALL") return posts;
    return posts.filter(
      (post) => (post.bucketVideo?.status ?? "NONE") === videoStatus,
    );
  }, [posts, videoStatus]);

  const readyRate = counts.ALL > 0 ? (counts.SUCCEEDED / counts.ALL) * 100 : 0;

  /* ── Mutations ───────────────────────────────────────────────────────── */
  const invalidateAll = React.useCallback(async () => {
    await Promise.all([
      utils.videoDownloads.admin.campaigns.invalidate(),
      utils.videoDownloads.client.campaigns.invalidate(),
      utils.videoDownloads.admin.posts.invalidate(),
      utils.videoDownloads.client.posts.invalidate(),
      utils.videoDownloads.admin.downloads.invalidate(),
      utils.videoDownloads.client.downloads.invalidate(),
    ]);
  }, [utils]);

  const setCampaignEnabled =
    api.videoDownloads.admin.setCampaignEnabled.useMutation({
      onSuccess: async (_result, variables) => {
        if (variables.enabled) {
          setEnableCampaignId("");
          pendingSelectRef.current = variables.campaignId;
        } else if (variables.campaignId === campaignId) {
          setCampaignId("");
        }
        await invalidateAll();
        toast.success(
          variables.enabled
            ? "Downloads ativados nesta competição"
            : "Downloads desativados nesta competição",
        );
      },
      onError: (error) => toast.error(error.message),
    });

  const adminEnqueue = api.videoDownloads.admin.enqueue.useMutation({
    onSuccess: async () => {
      toast.success("Vídeo adicionado à fila de download");
      await invalidateAll();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setEnqueueingId(null),
  });
  const clientEnqueue = api.videoDownloads.client.enqueue.useMutation({
    onSuccess: async () => {
      toast.success("Vídeo adicionado à fila de download");
      await invalidateAll();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setEnqueueingId(null),
  });

  const processQueue = api.videoDownloads.admin.processQueue.useMutation({
    onSuccess: async (result) => {
      toast.success(
        `${result.processed} item(ns) enviado(s) para processamento`,
      );
      await invalidateAll();
    },
    onError: (error) => toast.error(error.message),
  });

  const enqueuePost = (clipPostId: string) => {
    setEnqueueingId(clipPostId);
    if (isAdmin) adminEnqueue.mutate({ clipPostId });
    else clientEnqueue.mutate({ clipPostId });
  };

  /* ── Download do .mp4 (rota /api/video-downloads/[downloadId]/download) ── */
  const downloadVideo = React.useCallback(async (downloadId: string) => {
    setDownloadingId(downloadId);
    try {
      const response = await fetch(
        `/api/video-downloads/${downloadId}/download`,
      );
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Não foi possível baixar o vídeo");
      }

      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        /filename="([^"]+)"/i.exec(disposition)?.[1] ?? "video.mp4";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar o vídeo",
      );
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const hasFilters =
    platform !== "ALL" ||
    sortBy !== "views" ||
    Boolean(search) ||
    Boolean(minViews) ||
    Boolean(minLikes) ||
    Boolean(minComments) ||
    videoStatus !== "ALL";

  const clearFilters = () => {
    setPlatform("ALL");
    setSortBy("views");
    setSearch("");
    setMinViews("");
    setMinLikes("");
    setMinComments("");
    setVideoStatus("ALL");
  };

  const postsLoading = hasCampaign && postsQuery.isLoading;
  const downloadsLoading = hasCampaign && downloadsQuery.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ═══ Hero ═══ */}
      <HomeHero
        eyebrow={`Clipfy League · ${isAdmin ? "Downloads (admin)" : "Meus downloads"}`}
        title={
          <>
            Baixe os{" "}
            <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
              vídeos
            </span>{" "}
            publicados pelos clipadores
          </>
        }
        subtitle={
          isAdmin
            ? "Ative o recurso por competição, acompanhe a fila de processamento e baixe os arquivos .mp4 originais de cada publicação."
            : "Todos os vídeos liberados nas suas competições, prontos para baixar em .mp4 e reaproveitar onde você quiser."
        }
        isLoading={campaignsLoading}
        viz={isAdmin ? <DownloadsQueueHeroViz /> : <DownloadsTrayHeroViz />}
        vizSkeleton={
          isAdmin ? (
            <DownloadsQueueHeroVizSkeleton />
          ) : (
            <DownloadsTrayHeroVizSkeleton />
          )
        }
        stats={[
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições",
            value: campaigns?.length ?? 0,
            kind: "int",
          },
          {
            icon: <FilmSlate className="size-3.5" weight="fill" />,
            label: "Vídeos",
            value: selectedCampaign?._count.clipPosts ?? 0,
            kind: "int",
          },
          {
            icon: <CloudArrowDown className="size-3.5" weight="fill" />,
            label: "Prontos",
            value: counts.SUCCEEDED,
            kind: "int",
          },
        ]}
      />

      {/* ═══ Seleção de competição (+ controle do recurso no admin) ═══ */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading
              icon={<Trophy className="size-4" weight="fill" />}
              title="Competição"
              description={
                isAdmin
                  ? "Escolha a competição habilitada para ver os vídeos e a fila."
                  : "Somente competições com downloads liberados aparecem aqui."
              }
            />
            {isAdmin && (
              <Button
                variant="outline"
                className="h-10 cursor-pointer rounded-xl"
                onClick={() => processQueue.mutate()}
                disabled={processQueue.isPending}
              >
                {processQueue.isPending ? (
                  <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <ArrowsClockwise className="size-4" weight="bold" />
                )}
                Processar fila
              </Button>
            )}
          </div>

          <div
            className={cn("grid gap-4", isAdmin && "lg:grid-cols-2 lg:gap-6")}
          >
            {/* Competição em exibição */}
            <div className="flex min-w-0 flex-col gap-3">
              {campaignsLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : campaigns?.length ? (
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="h-10 w-full min-w-0 rounded-xl">
                    <FilmSlate className="text-muted-foreground mr-1 size-3.5 shrink-0" />
                    <SelectValue placeholder="Selecione uma competição" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item._count.clipPosts} vídeo(s)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground rounded-xl border border-dashed px-3.5 py-3 text-sm">
                  {isAdmin
                    ? "Nenhuma competição ativa com downloads habilitados."
                    : "Nenhuma competição liberada para download no momento."}
                </p>
              )}

              {selectedCampaign && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground font-semibold tracking-[0.12em] uppercase">
                      Progresso do processamento
                    </span>
                    <span className="font-semibold tabular-nums">
                      {counts.SUCCEEDED}/{counts.ALL} prontos
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-gradient-custom h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                      style={{ width: `${Math.min(readyRate, 100)}%` }}
                    />
                  </div>
                  {isAdmin && (
                    <div className="mt-1 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          Downloads ativos
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          Desligue para esconder esta competição do cliente.
                        </p>
                      </div>
                      <Switch
                        checked
                        aria-label={`Desativar downloads em ${selectedCampaign.name}`}
                        disabled={setCampaignEnabled.isPending}
                        onCheckedChange={(enabled) => {
                          if (!enabled)
                            setCampaignEnabled.mutate({
                              campaignId: selectedCampaign.id,
                              enabled: false,
                            });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ativar o recurso em outra competição (admin) */}
            {isAdmin && (
              <div className="border-border/60 flex min-w-0 flex-col gap-3 rounded-2xl border border-dashed p-3.5">
                <div className="flex items-center gap-2">
                  <span className="bg-gradient-custom flex size-7 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                    <Sparkle className="size-3.5" weight="fill" />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-bold">
                      Ativar downloads
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      Competições ativas ainda sem o recurso.
                    </p>
                  </div>
                </div>
                {adminDisabledCampaigns.isLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : adminDisabledCampaigns.data?.length ? (
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Select
                      value={enableCampaignId}
                      onValueChange={setEnableCampaignId}
                    >
                      <SelectTrigger className="h-10 w-full min-w-0 rounded-xl">
                        <SelectValue placeholder="Selecione uma competição" />
                      </SelectTrigger>
                      <SelectContent>
                        {adminDisabledCampaigns.data.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item._count.clipPosts} vídeo(s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      className="bg-gradient-custom h-10 shrink-0 cursor-pointer rounded-xl font-semibold text-[#04222A] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none"
                      disabled={
                        !enableCampaignId || setCampaignEnabled.isPending
                      }
                      onClick={() =>
                        setCampaignEnabled.mutate({
                          campaignId: enableCampaignId,
                          enabled: true,
                        })
                      }
                    >
                      {setCampaignEnabled.isPending ? (
                        <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <CheckCircle className="size-4" weight="fill" />
                      )}
                      Ativar
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Todas as competições ativas já estão com downloads
                    habilitados.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {!hasCampaign ? (
        <Reveal immediate delayMs={120}>
          <EmptyState
            icon={<Video className="size-6" weight="fill" />}
            title={
              isAdmin
                ? "Ative uma competição para começar"
                : "Nenhuma competição liberada"
            }
            description={
              isAdmin
                ? "Habilite o recurso de download em uma competição ativa para enfileirar e baixar os vídeos publicados."
                : "Assim que a Clipfy liberar os downloads de uma competição sua, os vídeos aparecem aqui."
            }
          />
        </Reveal>
      ) : (
        <>
          {/* ═══ KPIs ═══ */}
          <Reveal immediate delayMs={120}>
            {postsLoading ? (
              <StatTilesGridSkeleton count={4} />
            ) : (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatTile
                  icon={<FilmSlate className="size-4" weight="fill" />}
                  label="Total de vídeos"
                  value={counts.ALL}
                  kind="int"
                  hint={`de ${selectedCampaign?._count.clipPosts ?? 0} na competição`}
                  accent="gradient"
                  gradientValue
                />
                <StatTile
                  icon={<CheckCircle className="size-4" weight="fill" />}
                  label="Prontos"
                  value={counts.SUCCEEDED}
                  kind="int"
                  hint={`${readyRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos carregados`}
                  accent="green"
                />
                <StatTile
                  icon={<Queue className="size-4" weight="fill" />}
                  label="Na fila"
                  value={pending}
                  kind="int"
                  hint="aguardando processamento"
                  accent="cyan"
                />
                <StatTile
                  icon={<WarningCircle className="size-4" weight="fill" />}
                  label="Com erro"
                  value={counts.FAILED}
                  kind="int"
                  hint="podem ser reenfileirados"
                  accent="gradient"
                />
              </div>
            )}
          </Reveal>

          {/* ═══ Vídeos + Downloads ═══ */}
          <Reveal immediate delayMs={180}>
            <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
              <SectionHeading
                icon={<CloudArrowDown className="size-4" weight="fill" />}
                title="Vídeos da competição"
                description={
                  isAdmin
                    ? "Enfileire, acompanhe o processamento e baixe cada arquivo."
                    : "Baixe em .mp4 os vídeos já processados pela Clipfy."
                }
              />

              <Tabs
                defaultValue="videos"
                className="flex w-full flex-col gap-4"
              >
                <TabsList className="h-10 w-full rounded-xl">
                  <TabsTrigger
                    value="videos"
                    className="flex-1 cursor-pointer gap-1.5 text-xs"
                  >
                    <Video className="size-3.5" />
                    Vídeos
                  </TabsTrigger>
                  <TabsTrigger
                    value="downloads"
                    className="flex-1 cursor-pointer gap-1.5 text-xs"
                  >
                    <DownloadSimple className="size-3.5" />
                    Downloads
                  </TabsTrigger>
                </TabsList>

                {/* ─── Aba Vídeos ─── */}
                <TabsContent value="videos" className="flex flex-col gap-4">
                  {/* Filtros */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="relative min-w-0 flex-1">
                        <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                        <Input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Buscar perfil, legenda ou URL..."
                          className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pr-10 pl-10"
                        />
                        {search && (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="Limpar busca"
                            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg transition-colors"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      <Select
                        value={platform}
                        onValueChange={(value) =>
                          setPlatform(value as PlatformFilter)
                        }
                      >
                        <SelectTrigger className="h-10 w-full min-w-0 rounded-xl lg:w-[190px]">
                          <Funnel className="text-muted-foreground mr-1 size-3.5 shrink-0" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(PLATFORM_LABELS) as PlatformFilter[]
                          ).map((value) => (
                            <SelectItem key={value} value={value}>
                              {PLATFORM_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={sortBy}
                        onValueChange={(value) => setSortBy(value as SortBy)}
                      >
                        <SelectTrigger className="h-10 w-full min-w-0 rounded-xl lg:w-[180px]">
                          <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5 shrink-0" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(SORT_LABELS) as SortBy[]).map(
                            (value) => (
                              <SelectItem key={value} value={value}>
                                {SORT_LABELS[value]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        aria-pressed={showAdvanced}
                        onClick={() => setShowAdvanced((value) => !value)}
                        className={cn(
                          "h-10 shrink-0 cursor-pointer rounded-xl",
                          showAdvanced &&
                            "border-brand-cyan/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
                        )}
                      >
                        <SlidersHorizontal className="size-4" weight="bold" />
                        Mínimos
                      </Button>
                    </div>

                    {showAdvanced && (
                      <div className="animate-fade-in grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <NumberFilter
                          label="Views mínimas"
                          value={minViews}
                          onChange={setMinViews}
                        />
                        <NumberFilter
                          label="Likes mínimos"
                          value={minLikes}
                          onChange={setMinLikes}
                        />
                        <NumberFilter
                          label="Comentários mínimos"
                          value={minComments}
                          onChange={setMinComments}
                        />
                      </div>
                    )}

                    {/* Chips de status */}
                    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                      {VIDEO_STATUS_TABS.map((tab) => (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => setVideoStatus(tab.value)}
                          aria-pressed={videoStatus === tab.value}
                          className={cn(
                            "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-all",
                            videoStatus === tab.value
                              ? "bg-gradient-custom border-transparent text-[#04222A] shadow-sm"
                              : "border-border/70 text-muted-foreground hover:text-foreground hover:border-brand-cyan/40",
                          )}
                        >
                          {tab.label}
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                              videoStatus === tab.value
                                ? "bg-[#04222A]/15"
                                : "bg-muted",
                            )}
                          >
                            {counts[tab.value]}
                          </span>
                        </button>
                      ))}
                      {hasFilters && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="text-muted-foreground hover:text-foreground flex h-9 shrink-0 cursor-pointer items-center gap-1 px-2 text-xs font-semibold"
                        >
                          <X className="size-3.5" />
                          Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid */}
                  {postsLoading ? (
                    <CardGridSkeleton
                      count={6}
                      aspectClass="aspect-video"
                      withStats={false}
                    />
                  ) : filteredPosts.length ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredPosts.map((post, index) => (
                          <Reveal
                            key={post.id}
                            delayMs={Math.min(index, 8) * 60}
                            className="h-full"
                          >
                            <VideoCard
                              post={post}
                              isDownloading={
                                downloadingId === post.bucketVideo?.id
                              }
                              isEnqueueing={enqueueingId === post.id}
                              onDownload={downloadVideo}
                              onEnqueue={enqueuePost}
                            />
                          </Reveal>
                        ))}
                      </div>
                      {posts.length >= RESULTS_LIMIT && (
                        <p className="text-muted-foreground text-center text-xs">
                          Exibindo os {RESULTS_LIMIT} primeiros vídeos — refine
                          os filtros para ver os demais.
                        </p>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={
                        <MagnifyingGlass className="size-6" weight="bold" />
                      }
                      title="Nenhum vídeo com esses filtros"
                      description="Ajuste a plataforma, o status ou os valores mínimos para ver mais resultados."
                    />
                  )}
                </TabsContent>

                {/* ─── Aba Downloads ─── */}
                <TabsContent value="downloads" className="flex flex-col gap-4">
                  {isAdmin ? (
                    <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                      {DOWNLOAD_STATUS_TABS.map((tab) => (
                        <button
                          key={tab.value}
                          type="button"
                          onClick={() => setDownloadStatus(tab.value)}
                          aria-pressed={downloadStatus === tab.value}
                          className={cn(
                            "h-9 shrink-0 cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition-all",
                            downloadStatus === tab.value
                              ? "bg-gradient-custom border-transparent text-[#04222A] shadow-sm"
                              : "border-border/70 text-muted-foreground hover:text-foreground hover:border-brand-cyan/40",
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground flex items-center gap-2 text-xs">
                      <CheckCircle
                        className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                        weight="fill"
                      />
                      Somente os vídeos já processados aparecem nesta aba.
                    </p>
                  )}

                  {downloadsLoading ? (
                    <ListRowsSkeleton rows={6} />
                  ) : downloads.length ? (
                    <>
                      <div className="flex flex-col gap-3">
                        {downloads.map((item, index) => (
                          <Reveal
                            key={item.id}
                            delayMs={Math.min(index, 8) * 50}
                          >
                            <DownloadRow
                              item={item}
                              isDownloading={downloadingId === item.id}
                              onDownload={downloadVideo}
                            />
                          </Reveal>
                        ))}
                      </div>
                      {downloads.length >= RESULTS_LIMIT && (
                        <p className="text-muted-foreground text-center text-xs">
                          Exibindo os {RESULTS_LIMIT} downloads mais recentes.
                        </p>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={<DownloadSimple className="size-6" weight="bold" />}
                      title="Nenhum download por aqui"
                      description={
                        isAdmin
                          ? "Enfileire vídeos na aba anterior para que eles apareçam nesta lista."
                          : "Assim que a Clipfy processar os vídeos desta competição eles ficam disponíveis aqui."
                      }
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

/* ── Card de vídeo ─────────────────────────────────────────────────────── */
function VideoCard({
  post,
  isDownloading,
  isEnqueueing,
  onDownload,
  onEnqueue,
}: {
  post: PostItem;
  isDownloading: boolean;
  isEnqueueing: boolean;
  onDownload: (downloadId: string) => void | Promise<void>;
  onEnqueue: (clipPostId: string) => void;
}) {
  const status = post.bucketVideo?.status ?? "NONE";
  const meta = statusMeta(status);
  const StatusIcon = meta.icon;
  const platformKey = post.platform as PlatformKey;
  const platform = platformConfig[platformKey];
  const PlatformIcon = platform?.icon;
  const username = post.username ?? "perfil";
  const isReady =
    status === "SUCCEEDED" && Boolean(post.bucketVideo?.publicUrl);
  const isBusy = status === "QUEUED" || status === "PROCESSING";

  return (
    <div className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl">
      {/* Miniatura */}
      <div className="bg-muted/50 relative aspect-video w-full overflow-hidden">
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnailUrl}
            alt={`Miniatura do vídeo de @${username}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <ThumbFallback />
          </div>
        )}

        {/* Scrim para os chips ficarem legíveis nos dois temas */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/35"
        />

        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {PlatformIcon && <PlatformIcon className="size-3.5" />}
          {PLATFORM_LABELS[platformKey] ?? post.platform}
        </span>

        <span
          className={cn(
            "absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[11px] font-semibold backdrop-blur-sm",
            meta.overlay,
          )}
        >
          <StatusIcon
            className={cn(
              "size-3.5",
              meta.spin && "animate-spin motion-reduce:animate-none",
            )}
            weight="fill"
          />
          {meta.short}
        </span>

        <a
          href={post.submittedUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir publicação de @${username} em nova aba`}
          className="absolute right-2.5 bottom-2.5 flex size-9 items-center justify-center rounded-xl bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          <ArrowSquareOut className="size-4" weight="bold" />
        </a>
      </div>

      {/* Barra de progresso do processamento */}
      <div className="bg-muted h-1 w-full">
        <div
          className={cn(
            "h-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            meta.bar,
          )}
          style={{ width: `${meta.progress}%` }}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              platform?.bgColor ?? "bg-muted",
              PLATFORM_TEXT[platformKey],
            )}
          >
            {PlatformIcon ? (
              <PlatformIcon className="size-4" />
            ) : (
              <Video className="size-4" />
            )}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">@{username}</p>
            <p className="text-muted-foreground truncate text-[11px]">
              {meta.label}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <MetricCell icon={Eye} label="Views" value={post.views} />
          <MetricCell icon={ThumbsUp} label="Likes" value={post.likes} />
          <MetricCell icon={ChatCircle} label="Coment." value={post.comments} />
        </div>

        {post.bucketVideo?.errorMessage && status === "FAILED" && (
          <p className="line-clamp-2 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-600 dark:text-red-400">
            {post.bucketVideo.errorMessage}
          </p>
        )}

        <div className="mt-auto pt-1">
          {isReady ? (
            <Button
              onClick={() => void onDownload(post.bucketVideo!.id)}
              disabled={isDownloading}
              className="bg-gradient-custom h-10 w-full cursor-pointer rounded-xl font-semibold text-[#04222A] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none"
            >
              {isDownloading ? (
                <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <DownloadSimple className="size-4" weight="bold" />
              )}
              Baixar .mp4
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => onEnqueue(post.id)}
              disabled={isBusy || isEnqueueing}
              className="h-10 w-full cursor-pointer rounded-xl"
            >
              {isBusy || isEnqueueing ? (
                <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
              ) : status === "FAILED" ? (
                <ArrowsClockwise className="size-4" weight="bold" />
              ) : (
                <Play className="size-4" weight="fill" />
              )}
              {isBusy
                ? meta.short
                : status === "FAILED"
                  ? "Tentar novamente"
                  : "Adicionar à fila"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Linha da lista de downloads ───────────────────────────────────────── */
function DownloadRow({
  item,
  isDownloading,
  onDownload,
}: {
  item: DownloadItem;
  isDownloading: boolean;
  onDownload: (downloadId: string) => void | Promise<void>;
}) {
  const meta = statusMeta(item.status);
  const StatusIcon = meta.icon;
  const platformKey = item.clipPost.platform as PlatformKey;
  const platform = platformConfig[platformKey];
  const PlatformIcon = platform?.icon;
  const username = item.clipPost.username ?? "perfil";

  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-3.5">
      <div className="bg-muted/50 relative h-24 w-full shrink-0 overflow-hidden rounded-xl sm:h-16 sm:w-28">
        {item.clipPost.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.clipPost.thumbnailUrl}
            alt={`Miniatura do vídeo de @${username}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <Video className="size-5" weight="fill" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("gap-1 font-semibold", meta.className)}
          >
            <StatusIcon
              className={cn(
                "size-3",
                meta.spin && "animate-spin motion-reduce:animate-none",
              )}
              weight="fill"
            />
            {meta.short}
          </Badge>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {formatDateTime(item.updatedAt)}
          </span>
        </div>
        <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
          {PlatformIcon && (
            <PlatformIcon
              className={cn("size-3.5 shrink-0", PLATFORM_TEXT[platformKey])}
            />
          )}
          <span className="truncate">@{username}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            · {PLATFORM_LABELS[platformKey] ?? item.clipPost.platform}
          </span>
        </p>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" weight="fill" />
            <CountUp
              value={item.clipPost.views}
              kind="compact"
              className="tabular-nums"
            />
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="size-3" weight="fill" />
            <CountUp
              value={item.clipPost.likes}
              kind="compact"
              className="tabular-nums"
            />
          </span>
          <span className="inline-flex items-center gap-1">
            <ChatCircle className="size-3" weight="fill" />
            <CountUp
              value={item.clipPost.comments}
              kind="compact"
              className="tabular-nums"
            />
          </span>
        </p>
        {item.errorMessage && (
          <p className="line-clamp-2 text-[11px] text-red-600 dark:text-red-400">
            {item.errorMessage}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={item.clipPost.submittedUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir publicação de @${username} em nova aba`}
          className="border-border/70 text-muted-foreground hover:text-foreground hover:border-brand-cyan/40 flex size-10 items-center justify-center rounded-xl border transition-colors"
        >
          <ArrowSquareOut className="size-4" weight="bold" />
        </a>
        {item.publicUrl && item.status === "SUCCEEDED" ? (
          <Button
            onClick={() => void onDownload(item.id)}
            disabled={isDownloading}
            className="bg-gradient-custom h-10 flex-1 cursor-pointer rounded-xl font-semibold text-[#04222A] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none sm:flex-none"
          >
            {isDownloading ? (
              <CircleNotch className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <DownloadSimple className="size-4" weight="bold" />
            )}
            Baixar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Peças auxiliares ──────────────────────────────────────────────────── */
function MetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="border-border/60 bg-muted/30 flex min-w-0 flex-col gap-0.5 rounded-xl border px-2 py-1.5">
      <span className="text-muted-foreground inline-flex items-center gap-1 truncate text-[10px] font-semibold tracking-[0.08em] uppercase">
        <Icon className="size-3 shrink-0" weight="fill" />
        {label}
      </span>
      <CountUp
        value={value}
        kind="compact"
        className="truncate text-sm font-bold tabular-nums"
      />
    </div>
  );
}

function NumberFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="0"
        className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl"
      />
    </label>
  );
}

function ThumbFallback() {
  return (
    <span className="flex flex-col items-center gap-1.5">
      <Video className="size-8" weight="fill" />
      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">
        Sem capa
      </span>
    </span>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center sm:py-16">
      <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
        {icon}
      </span>
      <div className="max-w-sm">
        <p className="text-base font-bold">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}
