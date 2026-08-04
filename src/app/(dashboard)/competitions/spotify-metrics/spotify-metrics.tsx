"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  ChartLineUp,
  Clock,
  Info,
  Lightning,
  LinkSimple,
  MusicNote,
  MusicNotes,
  MusicNotesPlus,
  Play,
  Plus,
  SpotifyLogo,
  Trash,
  TrendUp,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { SpotifyHeroViz, SpotifyHeroVizSkeleton } from "@/components/competitions/spotify-hero-viz";
import { HomeHero } from "@/components/home/home-hero";
import { SectionHeading } from "@/components/home/section-heading";
import { StatTile } from "@/components/home/stat-tile";
import { CountUp, formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import { Bone, ListRowsSkeleton } from "@/components/shared/skeletons";
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
import { Switch } from "@/components/ui/switch";
import { parseSpotifyTrackId } from "@/lib/spotify-track";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

/* ── Constantes ────────────────────────────────────────────────────────── */

const RANGES = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const RANGE_HINT: Record<Range, string> = {
  "7d": "nos últimos 7 dias",
  "30d": "nos últimos 30 dias",
  "90d": "nos últimos 90 dias",
  all: "desde a primeira coleta",
};

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const chartDayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
});

/** Nome dos artistas a partir do JSON cru salvo pelo coletor. */
function artistsLabel(value: unknown): string {
  if (!Array.isArray(value)) return "Artista não identificado";
  const names = value
    .map((artist) => {
      if (typeof artist === "string") return artist;
      if (typeof artist === "object" && artist !== null && "name" in artist) {
        const name = (artist as { name?: unknown }).name;
        return typeof name === "string" ? name : "";
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
  return names || "Artista não identificado";
}

function trackShareUrl(track: {
  shareUrl: string | null;
  spotifyTrackId: string;
}) {
  return (
    track.shareUrl ?? `https://open.spotify.com/track/${track.spotifyTrackId}`
  );
}

/* ── Página ────────────────────────────────────────────────────────────── */

export default function SpotifyMetrics() {
  const utils = api.useUtils();

  const [campaignId, setCampaignId] = React.useState("");
  const [spotifyInput, setSpotifyInput] = React.useState("");
  const [selectedTrackId, setSelectedTrackId] = React.useState("");
  const [range, setRange] = React.useState<Range>("30d");
  const [refreshingTrackId, setRefreshingTrackId] = React.useState("");
  const [refreshingRunId, setRefreshingRunId] = React.useState("");
  const [removalTargetId, setRemovalTargetId] = React.useState("");

  /* ── Queries ── */
  const { data: campaigns, isLoading: campaignsLoading } =
    api.admin.spotifyMetrics.campaigns.useQuery({
      spotifyStatus: "ALL",
      status: "ACTIVE",
    });

  const selectedCampaign = campaigns?.find((item) => item.id === campaignId);
  const metricsEnabled = selectedCampaign?.spotifyMetricsEnabled === true;

  const {
    data: tracks,
    isLoading: tracksLoading,
    isFetching: tracksFetching,
  } = api.admin.spotifyMetrics.listTracks.useQuery(
    { campaignId, range },
    {
      enabled: Boolean(campaignId),
      refetchInterval: (query) =>
        query.state.data?.some(
          (item) =>
            item.isActive &&
            item.track.currentPlayCount == null &&
            !item.track.lastError,
        ) || Boolean(refreshingRunId)
          ? 3_000
          : false,
    },
  );

  const selectedTrack = tracks?.find((item) => item.id === selectedTrackId);
  const selectedTrackPending =
    (selectedTrack?.isActive === true &&
      selectedTrack.track.currentPlayCount == null &&
      !selectedTrack.track.lastError) ||
    Boolean(refreshingRunId);
  /*
   * Última coleta da faixa vinda da MESMA origem do gráfico
   * (spotifyTrackMetric.collectedAt, sem filtro de range). Comparar com
   * `spotifyTrack.lastCollectedAt` misturava origens e mantinha o polling
   * ligado para sempre em faixas cuja última coleta é anterior ao recorte.
   */
  const selectedTrackLatestCollectedAt =
    selectedTrack?.track.latestCollectedAt ?? null;

  const { data: evolution, isLoading: evolutionLoading } =
    api.admin.spotifyMetrics.evolution.useQuery(
      { campaignSpotifyTrackId: selectedTrackId, range },
      {
        enabled: Boolean(selectedTrackId),
        refetchInterval: (query) => {
          if (selectedTrackPending) return 3_000;
          if (!selectedTrackLatestCollectedAt) return false;
          const graphLatestCollectedAt =
            query.state.data?.summary.latestCollectedAt;
          // Só é "desatualizado" quando o gráfico já carregou e está atrás da
          // coleta mais recente. `null` nunca conta como desatualizado.
          const graphIsOutdated =
            graphLatestCollectedAt != null &&
            new Date(graphLatestCollectedAt).getTime() <
              new Date(selectedTrackLatestCollectedAt).getTime();
          return graphIsOutdated ? 3_000 : false;
        },
      },
    );

  const { data: runs } = api.admin.spotifyMetrics.runs.useQuery(
    { campaignId },
    {
      enabled: Boolean(campaignId && refreshingRunId),
      refetchInterval: refreshingRunId ? 2_000 : false,
    },
  );
  const refreshingRun = runs?.find((run) => run.id === refreshingRunId);

  /* ── Invalidação compartilhada ── */
  const invalidate = React.useCallback(async () => {
    await Promise.all([
      utils.admin.spotifyMetrics.campaigns.invalidate(),
      campaignId
        ? utils.admin.spotifyMetrics.listTracks.invalidate({
            campaignId,
            range,
          })
        : Promise.resolve(),
      selectedTrackId
        ? utils.admin.spotifyMetrics.evolution.invalidate({
            campaignSpotifyTrackId: selectedTrackId,
            range,
          })
        : Promise.resolve(),
    ]);
  }, [utils, campaignId, range, selectedTrackId]);

  /* ── Mutations ── */
  const setCampaignEnabled =
    api.admin.spotifyMetrics.setCampaignEnabled.useMutation({
      onSuccess: async (_result, variables) => {
        toast.success(
          variables.enabled
            ? "Acompanhamento de plays ativado nesta competição"
            : "Acompanhamento de plays pausado nesta competição",
        );
        await invalidate();
      },
      onError: (error) => toast.error(error.message),
    });

  const addTrack = api.admin.spotifyMetrics.addTrack.useMutation({
    onSuccess: async (result) => {
      setSpotifyInput("");
      setSelectedTrackId(result.id);
      toast.success(
        result.refreshQueued
          ? "Faixa vinculada e primeira coleta enfileirada"
          : "Faixa vinculada; a coleta começa quando a competição estiver ativa",
      );
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const setTrackActive = api.admin.spotifyMetrics.setTrackActive.useMutation({
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const removeTrack = api.admin.spotifyMetrics.removeTrack.useMutation({
    onSuccess: async () => {
      toast.success("Faixa desvinculada da competição");
      setRemovalTargetId("");
      await invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const refreshTrack = api.admin.spotifyMetrics.refreshTrack.useMutation({
    onMutate: ({ campaignSpotifyTrackId }) => {
      setSelectedTrackId(campaignSpotifyTrackId);
      setRefreshingTrackId(campaignSpotifyTrackId);
    },
    onSuccess: ({ runId }) => {
      setRefreshingRunId(runId);
      toast.success("Atualização manual enfileirada");
    },
    onError: (error) => {
      setRefreshingTrackId("");
      toast.error(error.message);
    },
  });

  /* ── Conclusão da coleta manual ── */
  React.useEffect(() => {
    if (!refreshingRun || refreshingRun.status === "RUNNING") return;

    setRefreshingRunId("");
    setRefreshingTrackId("");
    void invalidate();

    if (refreshingRun.status === "COMPLETED") {
      toast.success("Dados do Spotify atualizados");
    } else {
      toast.error(
        refreshingRun.errorMessage ??
          "Não foi possível atualizar os dados do Spotify",
      );
    }
  }, [refreshingRun, invalidate]);

  /* ── Seleção automática da faixa em foco ── */
  React.useEffect(() => {
    if (!tracks) return;
    if (tracks.some((item) => item.id === selectedTrackId)) return;
    setSelectedTrackId(tracks[0]?.id ?? "");
  }, [tracks, selectedTrackId]);

  /* ── Derivados ── */
  const parsedTrackId = spotifyInput.trim()
    ? parseSpotifyTrackId(spotifyInput)
    : null;
  const inputIsInvalid = spotifyInput.trim().length > 0 && !parsedTrackId;
  const alreadyLinked =
    parsedTrackId != null &&
    (tracks?.some((item) => item.track.spotifyTrackId === parsedTrackId) ??
      false);

  const totalTracks = tracks?.length ?? 0;
  const activeTracks = tracks?.filter((item) => item.isActive).length ?? 0;
  const totalPlays =
    tracks?.reduce(
      (sum, item) => sum + (item.track.currentPlayCount ?? 0),
      0,
    ) ?? 0;
  const totalGrowth =
    tracks?.reduce((sum, item) => {
      const { currentPlayCount, previousPlayCount } = item.track;
      if (currentPlayCount == null || previousPlayCount == null) return sum;
      return sum + (currentPlayCount - previousPlayCount);
    }, 0) ?? 0;

  const firstCollectPending =
    tracks?.some(
      (item) =>
        item.isActive &&
        item.track.currentPlayCount == null &&
        !item.track.lastError,
    ) ?? false;

  const removalTarget = tracks?.find((item) => item.id === removalTargetId);

  const submitTrack = () => {
    if (!campaignId || !metricsEnabled || !parsedTrackId || alreadyLinked)
      return;
    addTrack.mutate({ campaignId, spotifyInput });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Competições"
        title={
          <>
            Plays da faixa no{" "}
            <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
              Spotify
            </span>
          </>
        }
        subtitle="Vincule a música da campanha e acompanhe a evolução de plays coletada automaticamente às 00h, 08h e 16h (BRT)."
        viz={<SpotifyHeroViz />}
        vizSkeleton={<SpotifyHeroVizSkeleton />}
        isLoading={campaignsLoading || (Boolean(campaignId) && tracksLoading)}
        stats={[
          {
            icon: <MusicNotes className="size-3.5" weight="fill" />,
            label: "Faixas",
            value: totalTracks,
            kind: "int",
          },
          {
            icon: <Play className="size-3.5" weight="fill" />,
            label: "Plays",
            value: totalPlays,
            kind: "compact",
          },
          {
            icon: <TrendUp className="size-3.5" weight="fill" />,
            label: "No período",
            value: totalGrowth,
            kind: "compact",
          },
        ]}
      />

      {/* ===== Configuração: competição + vincular faixa ===== */}
      <Reveal immediate>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Competição */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
            <SectionHeading
              icon={<Trophy className="size-4" weight="fill" />}
              title="Competição"
              description="Campanhas ativas da Clipfy League"
            />

            {campaignsLoading ? (
              <div className="flex flex-col gap-3">
                <Bone className="h-11 w-full rounded-xl" />
                <Bone delay={80} className="h-12 w-full rounded-xl" />
              </div>
            ) : (
              <>
                <Select
                  value={campaignId}
                  onValueChange={(value) => {
                    setCampaignId(value);
                    setSelectedTrackId("");
                    setSpotifyInput("");
                  }}
                >
                  <SelectTrigger
                    aria-label="Selecionar competição"
                    className="h-11 w-full cursor-pointer rounded-xl"
                  >
                    <Trophy className="text-muted-foreground mr-1 size-3.5" />
                    <SelectValue placeholder="Selecione uma competição" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns?.length === 0 && (
                      <div className="text-muted-foreground px-2 py-3 text-sm">
                        Nenhuma competição ativa
                      </div>
                    )}
                    {campaigns?.map((campaign) => (
                      <SelectItem
                        key={campaign.id}
                        value={campaign.id}
                        className="cursor-pointer"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{campaign.name}</span>
                          {campaign.spotifyMetricsEnabled && (
                            <SpotifyLogo
                              weight="fill"
                              alt="Acompanhamento de plays ativo"
                              className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                            />
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {campaignId ? (
                  <div className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border p-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                        metricsEnabled
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <SpotifyLogo className="size-5" weight="fill" />
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-semibold">
                        Acompanhar plays
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {metricsEnabled
                          ? "Coleta ativa nesta competição"
                          : "Ative para vincular faixas"}
                      </p>
                    </div>
                    <Switch
                      checked={metricsEnabled}
                      onCheckedChange={(enabled) =>
                        setCampaignEnabled.mutate({ campaignId, enabled })
                      }
                      disabled={setCampaignEnabled.isPending}
                      aria-label="Acompanhar plays no Spotify nesta competição"
                      className="cursor-pointer"
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Escolha uma competição para ver e vincular as faixas
                    monitoradas.
                  </p>
                )}

                <Badge
                  variant="outline"
                  className="max-w-full gap-1.5 rounded-full text-[11px] font-medium"
                >
                  <Clock className="size-3 shrink-0" weight="fill" />
                  <span className="truncate">
                    Coleta automática: 00h, 08h e 16h (BRT)
                  </span>
                </Badge>
              </>
            )}
          </div>

          {/* Vincular faixa */}
          <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
            <SectionHeading
              icon={<MusicNotesPlus className="size-4" weight="fill" />}
              title="Vincular faixa"
              description="Cole a URL, a URI ou o ID da música no Spotify"
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <LinkSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  value={spotifyInput}
                  onChange={(event) => setSpotifyInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitTrack();
                  }}
                  placeholder="https://open.spotify.com/track/..."
                  aria-label="URL, URI ou ID da faixa no Spotify"
                  aria-invalid={inputIsInvalid}
                  disabled={
                    !campaignId || !metricsEnabled || addTrack.isPending
                  }
                  className={cn(
                    "focus-visible:ring-brand-cyan/40 h-11 rounded-xl pl-10",
                    inputIsInvalid &&
                      "border-red-500/60 focus-visible:ring-red-500/30",
                  )}
                />
              </div>
              <Button
                onClick={submitTrack}
                disabled={
                  !campaignId ||
                  !metricsEnabled ||
                  !parsedTrackId ||
                  alreadyLinked ||
                  addTrack.isPending
                }
                className="btn-gradient-auth h-11 cursor-pointer rounded-xl font-semibold sm:w-40"
              >
                {addTrack.isPending ? (
                  <ArrowsClockwise
                    className="size-4 animate-spin motion-reduce:animate-none"
                    weight="bold"
                  />
                ) : (
                  <Plus className="size-4" weight="bold" />
                )}
                Vincular
              </Button>
            </div>

            <div className="flex min-h-5 items-start gap-1.5 text-xs">
              {!campaignId ? (
                <p className="text-muted-foreground inline-flex items-start gap-1.5">
                  <Info className="mt-px size-3.5 shrink-0" weight="fill" />
                  Selecione uma competição para vincular faixas.
                </p>
              ) : !metricsEnabled ? (
                <p className="inline-flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                  <WarningCircle
                    className="mt-px size-3.5 shrink-0"
                    weight="fill"
                  />
                  Ative o acompanhamento de plays na competição antes de
                  vincular faixas.
                </p>
              ) : inputIsInvalid ? (
                <p className="inline-flex items-start gap-1.5 text-red-600 dark:text-red-400">
                  <WarningCircle
                    className="mt-px size-3.5 shrink-0"
                    weight="fill"
                  />
                  Link inválido. Use uma URL, URI (spotify:track:...) ou o ID de
                  22 caracteres.
                </p>
              ) : alreadyLinked ? (
                <p className="inline-flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                  <WarningCircle
                    className="mt-px size-3.5 shrink-0"
                    weight="fill"
                  />
                  Esta faixa já está vinculada a esta competição.
                </p>
              ) : parsedTrackId ? (
                <p className="inline-flex min-w-0 items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <MusicNote
                    className="mt-px size-3.5 shrink-0"
                    weight="fill"
                  />
                  <span className="min-w-0">
                    Faixa reconhecida:{" "}
                    <span className="font-mono break-all">{parsedTrackId}</span>
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground inline-flex items-start gap-1.5">
                  <Info className="mt-px size-3.5 shrink-0" weight="fill" />A
                  primeira coleta é enfileirada assim que a faixa é vinculada.
                </p>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {!campaignId ? (
        <Reveal immediate delayMs={60}>
          <EmptyState
            icon={<Trophy className="size-6" weight="fill" />}
            title="Selecione uma competição"
            description="Escolha uma campanha de música para ver as faixas vinculadas e a evolução de plays."
          />
        </Reveal>
      ) : (
        <>
          {/* ===== KPIs da competição ===== */}
          <Reveal immediate delayMs={60}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                icon={<MusicNotes className="size-4" weight="fill" />}
                label="Faixas vinculadas"
                value={totalTracks}
                kind="int"
                hint="nesta competição"
                accent="cyan"
                isLoading={tracksLoading}
              />
              <StatTile
                icon={<Lightning className="size-4" weight="fill" />}
                label="Faixas ativas"
                value={activeTracks}
                kind="int"
                hint={metricsEnabled ? "coletando plays" : "coleta pausada"}
                accent="green"
                isLoading={tracksLoading}
              />
              <StatTile
                icon={<Play className="size-4" weight="fill" />}
                label="Plays totais"
                value={totalPlays}
                kind="compact"
                hint="soma da última coleta"
                accent="gradient"
                gradientValue
                isLoading={tracksLoading}
              />
              <StatTile
                icon={<TrendUp className="size-4" weight="fill" />}
                label="Crescimento"
                value={totalGrowth}
                kind="compact"
                hint={RANGE_HINT[range]}
                accent="green"
                isLoading={tracksLoading}
              />
            </div>
          </Reveal>

          {/* ===== Aviso de coleta em andamento ===== */}
          {(firstCollectPending || Boolean(refreshingRunId)) && (
            <Reveal immediate delayMs={90}>
              <div
                role="status"
                className="glass-card text-muted-foreground flex items-center gap-2.5 rounded-2xl px-4 py-3 text-xs sm:text-sm"
              >
                <ArrowsClockwise
                  className={cn(
                    "size-4 shrink-0 text-emerald-600 dark:text-emerald-400",
                    (tracksFetching || Boolean(refreshingRunId)) &&
                      "animate-spin motion-reduce:animate-none",
                  )}
                  weight="bold"
                />
                <span className="min-w-0">
                  {refreshingRunId
                    ? "Atualização manual em andamento — os números aparecem em instantes."
                    : "Atualizando automaticamente enquanto a primeira coleta é concluída."}
                </span>
              </div>
            </Reveal>
          )}

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-5">
            {/* ===== Faixas vinculadas ===== */}
            <Reveal immediate delayMs={140} className="lg:col-span-2">
              <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-6">
                <SectionHeading
                  icon={<MusicNotes className="size-4" weight="fill" />}
                  title="Faixas vinculadas"
                  description={
                    totalTracks > 0
                      ? `${totalTracks} ${totalTracks === 1 ? "faixa" : "faixas"} · ${activeTracks} ativa${activeTracks === 1 ? "" : "s"}`
                      : "Nenhuma faixa nesta competição"
                  }
                />

                {tracksLoading ? (
                  <ListRowsSkeleton rows={3} />
                ) : totalTracks === 0 ? (
                  <EmptyState
                    compact
                    icon={<MusicNotesPlus className="size-6" weight="fill" />}
                    title="Nenhuma faixa vinculada"
                    description="Cole o link da música do Spotify no campo acima para começar a acompanhar os plays."
                  />
                ) : (
                  <div className="-mr-1 flex max-h-[560px] flex-col gap-2.5 overflow-y-auto pr-1">
                    {tracks?.map((item, index) => (
                      <TrackRow
                        key={item.id}
                        item={item}
                        index={index}
                        selected={item.id === selectedTrackId}
                        metricsEnabled={metricsEnabled}
                        refreshing={refreshingTrackId === item.id}
                        toggleDisabled={setTrackActive.isPending}
                        onSelect={() => setSelectedTrackId(item.id)}
                        onToggleActive={(isActive) =>
                          setTrackActive.mutate({
                            campaignSpotifyTrackId: item.id,
                            isActive,
                          })
                        }
                        onRefresh={() =>
                          refreshTrack.mutate({
                            campaignSpotifyTrackId: item.id,
                          })
                        }
                        onRemove={() => setRemovalTargetId(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Reveal>

            {/* ===== Faixa em foco + evolução ===== */}
            <Reveal immediate delayMs={200} className="lg:col-span-3">
              <div className="glass-card flex h-full flex-col gap-5 rounded-3xl p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <SectionHeading
                    icon={<ChartLineUp className="size-4" weight="fill" />}
                    title="Evolução de plays"
                    description={
                      selectedTrack?.track.name ??
                      "Selecione uma faixa para ver o histórico"
                    }
                  />
                  <RangePills value={range} onChange={setRange} />
                </div>

                {tracksLoading ? (
                  <>
                    <Bone className="h-[92px] w-full rounded-2xl" />
                    <ChartBones />
                  </>
                ) : !selectedTrack ? (
                  <EmptyState
                    compact
                    icon={<MusicNote className="size-6" weight="fill" />}
                    title="Nenhuma faixa em foco"
                    description="Vincule uma música e selecione-a na lista para acompanhar a curva de plays."
                  />
                ) : (
                  <>
                    {/* Card da faixa */}
                    <div className="border-border/60 bg-muted/20 flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                      <AlbumCover
                        url={selectedTrack.track.albumImageUrl}
                        name={selectedTrack.track.name}
                        className="size-16 shrink-0 rounded-xl sm:size-20"
                        sizes="80px"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-bold sm:text-base">
                          {selectedTrack.track.name ??
                            "Aguardando primeira coleta"}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {artistsLabel(selectedTrack.track.artists)}
                        </p>
                        {selectedTrack.track.albumName && (
                          <p className="text-muted-foreground/80 truncate text-[11px]">
                            {selectedTrack.track.albumName}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-9 cursor-pointer rounded-xl"
                          onClick={() =>
                            refreshTrack.mutate({
                              campaignSpotifyTrackId: selectedTrack.id,
                            })
                          }
                          disabled={
                            !metricsEnabled ||
                            !selectedTrack.isActive ||
                            refreshTrack.isPending ||
                            refreshingTrackId === selectedTrack.id
                          }
                          aria-label="Atualizar plays agora"
                          title="Atualizar plays agora"
                        >
                          <ArrowsClockwise
                            className={cn(
                              "size-4",
                              refreshingTrackId === selectedTrack.id &&
                                "animate-spin motion-reduce:animate-none",
                            )}
                            weight="bold"
                          />
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="icon"
                          className="size-9 cursor-pointer rounded-xl"
                        >
                          <a
                            href={trackShareUrl(selectedTrack.track)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Abrir ${selectedTrack.track.name ?? "faixa"} no Spotify`}
                            title="Abrir no Spotify"
                          >
                            <ArrowSquareOut className="size-4" weight="bold" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    {/* Números da faixa */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <MiniStat
                        icon={<Play className="size-3.5" weight="fill" />}
                        label="Plays atuais"
                      >
                        {evolution?.summary.currentPlayCount != null ||
                        selectedTrack.track.currentPlayCount != null ? (
                          <CountUp
                            value={
                              evolution?.summary.currentPlayCount ??
                              selectedTrack.track.currentPlayCount ??
                              0
                            }
                            kind="int"
                            className="text-lg font-bold tabular-nums sm:text-xl"
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm font-medium">
                            Coleta pendente
                          </span>
                        )}
                      </MiniStat>

                      <MiniStat
                        icon={<TrendUp className="size-3.5" weight="fill" />}
                        label={`Crescimento · ${RANGES.find((option) => option.value === range)?.label}`}
                      >
                        {evolution?.summary.growthInRange != null ? (
                          <span className="inline-flex items-baseline gap-1 text-emerald-600 dark:text-emerald-400">
                            <span className="text-lg font-bold sm:text-xl">
                              +
                            </span>
                            <CountUp
                              value={evolution.summary.growthInRange}
                              kind="int"
                              className="text-lg font-bold tabular-nums sm:text-xl"
                            />
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm font-medium">
                            —
                          </span>
                        )}
                      </MiniStat>

                      <MiniStat
                        icon={<Clock className="size-3.5" weight="fill" />}
                        label="Última coleta"
                      >
                        <span className="text-sm font-semibold tabular-nums">
                          {selectedTrack.track.lastCollectedAt
                            ? dateTimeFormat.format(
                                new Date(selectedTrack.track.lastCollectedAt),
                              )
                            : "—"}
                        </span>
                      </MiniStat>
                    </div>

                    {/* Gráfico */}
                    {evolutionLoading ? (
                      <ChartBones />
                    ) : (evolution?.points.length ?? 0) === 0 ? (
                      <EmptyState
                        compact
                        icon={<ChartLineUp className="size-6" weight="fill" />}
                        title="Ainda sem snapshots"
                        description="A primeira coleta desta faixa aparecerá aqui assim que for concluída."
                      />
                    ) : (
                      <PlaysEvolutionChart points={evolution?.points ?? []} />
                    )}

                    {selectedTrack.track.lastError && (
                      <p className="inline-flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <WarningCircle
                          className="mt-px size-3.5 shrink-0"
                          weight="fill"
                        />
                        <span className="min-w-0 break-words">
                          Última falha: {selectedTrack.track.lastError}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </Reveal>
          </div>
        </>
      )}

      {/* ===== Confirmação de desvinculação ===== */}
      <AlertDialog
        open={Boolean(removalTargetId)}
        onOpenChange={(open) => {
          if (!open) setRemovalTargetId("");
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular faixa?</AlertDialogTitle>
            <AlertDialogDescription>
              {removalTarget?.track.name
                ? `"${removalTarget.track.name}" deixará de ser monitorada nesta competição. O histórico de plays já coletado é mantido.`
                : "A faixa deixará de ser monitorada nesta competição. O histórico de plays já coletado é mantido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer rounded-xl bg-red-600 text-white hover:bg-red-600/90"
              disabled={removeTrack.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (!removalTargetId) return;
                removeTrack.mutate({ campaignSpotifyTrackId: removalTargetId });
              }}
            >
              {removeTrack.isPending ? "Desvinculando..." : "Desvincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Linha da faixa ────────────────────────────────────────────────────── */

type TrackItem = RouterOutputs["admin"]["spotifyMetrics"]["listTracks"][number];

function TrackRow({
  item,
  index,
  selected,
  metricsEnabled,
  refreshing,
  toggleDisabled,
  onSelect,
  onToggleActive,
  onRefresh,
  onRemove,
}: {
  item: TrackItem;
  index: number;
  selected: boolean;
  metricsEnabled: boolean;
  refreshing: boolean;
  toggleDisabled: boolean;
  onSelect: () => void;
  onToggleActive: (isActive: boolean) => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const { track } = item;
  const delta =
    track.currentPlayCount != null && track.previousPlayCount != null
      ? track.currentPlayCount - track.previousPlayCount
      : null;

  const statusText = refreshing
    ? "Atualização manual em andamento…"
    : !metricsEnabled
      ? "Coleta suspensa pela competição"
      : track.lastCollectedAt
        ? `Atualizada ${dateTimeFormat.format(new Date(track.lastCollectedAt))}`
        : (track.lastError ?? "Primeira coleta pendente");

  return (
    <Reveal immediate delayMs={index * 60}>
      <div
        className={cn(
          "rounded-2xl border p-3 transition-all duration-300",
          selected
            ? "border-brand-cyan/50 bg-brand-cyan/5 not-dark:border-primary/40 not-dark:bg-primary/5 shadow-[0_0_0_1px_color-mix(in_oklab,var(--brand-cyan)_18%,transparent)]"
            : "border-border/60 bg-muted/20 hover:border-brand-cyan/30 hover:bg-muted/40",
        )}
      >
        <button
          type="button"
          aria-pressed={selected}
          onClick={onSelect}
          className="focus-visible:ring-brand-cyan/40 flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-xl text-left outline-none focus-visible:ring-2"
        >
          <AlbumCover
            url={track.albumImageUrl}
            name={track.name}
            className="size-12 shrink-0 rounded-lg"
            sizes="48px"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                {track.name ?? "Aguardando primeira coleta"}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 rounded-full px-2 py-0 text-[10px] font-semibold",
                  item.isActive
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {item.isActive ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <p className="text-muted-foreground truncate text-xs">
              {artistsLabel(track.artists)}
            </p>
            <p className="text-[11px] font-medium tabular-nums sm:text-xs">
              {track.currentPlayCount == null ? (
                <span className="text-muted-foreground">Coleta pendente</span>
              ) : (
                <>
                  <span>
                    {track.currentPlayCount.toLocaleString("pt-BR")} plays
                  </span>
                  {delta != null && delta > 0 && (
                    <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">
                      +{formatCompact(delta)}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </button>

        <div className="border-border/50 mt-3 flex items-center gap-2 border-t pt-2.5">
          <Switch
            checked={item.isActive}
            onCheckedChange={onToggleActive}
            disabled={!metricsEnabled || toggleDisabled}
            aria-label={`${item.isActive ? "Pausar" : "Ativar"} coleta de ${track.name ?? "faixa"}`}
            className="shrink-0 cursor-pointer"
          />
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11px]">
            {statusText}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 cursor-pointer rounded-lg"
            onClick={onRefresh}
            disabled={!metricsEnabled || !item.isActive || refreshing}
            aria-label={`Atualizar plays de ${track.name ?? "faixa"} agora`}
            title="Atualizar plays agora"
          >
            <ArrowsClockwise
              className={cn(
                "size-4",
                refreshing && "animate-spin motion-reduce:animate-none",
              )}
              weight="bold"
            />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 cursor-pointer rounded-lg"
          >
            <a
              href={trackShareUrl(track)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir ${track.name ?? "faixa"} no Spotify`}
              title="Abrir no Spotify"
            >
              <ArrowSquareOut className="size-4" weight="bold" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 cursor-pointer rounded-lg text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
            onClick={onRemove}
            aria-label={`Desvincular ${track.name ?? "faixa"} da competição`}
            title="Desvincular faixa"
          >
            <Trash className="size-4" weight="bold" />
          </Button>
        </div>
      </div>
    </Reveal>
  );
}

/* ── Capa do álbum ─────────────────────────────────────────────────────── */

function AlbumCover({
  url,
  name,
  className,
  sizes,
}: {
  url: string | null;
  name: string | null;
  className?: string;
  sizes: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted relative flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={name ? `Capa de ${name}` : "Capa do álbum"}
          fill
          sizes={sizes}
          unoptimized
          className="object-cover"
        />
      ) : (
        <MusicNote className="text-muted-foreground size-5" weight="fill" />
      )}
    </span>
  );
}

/* ── Seletor de janela ─────────────────────────────────────────────────── */

function RangePills({
  value,
  onChange,
}: {
  value: Range;
  onChange: (value: Range) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Janela de tempo"
      className="border-border/60 bg-muted/30 flex shrink-0 items-center gap-1 self-start rounded-full border p-1"
    >
      {RANGES.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 cursor-pointer rounded-full px-2.5 text-[11px] font-semibold transition-all sm:px-3 sm:text-xs",
              active
                ? "bg-gradient-custom text-[#04222A] shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Gráfico de evolução ───────────────────────────────────────────────── */

function PlaysEvolutionChart({
  points,
}: {
  points: { collectedAt: Date | string; playCount: number }[];
}) {
  const data = points.map((point) => ({
    date: new Date(point.collectedAt).toISOString(),
    playCount: point.playCount,
  }));
  const lastPoint = data[data.length - 1];

  return (
    <div className="h-[240px] w-full sm:h-[300px] lg:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient
              id="spotify-plays-stroke"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="var(--chart-growth-start)" />
              <stop offset="100%" stopColor="var(--chart-growth-end)" />
            </linearGradient>
            <linearGradient id="spotify-plays-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0.28}
              />
              <stop
                offset="55%"
                stopColor="var(--chart-growth-end)"
                stopOpacity={0.08}
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
            strokeDasharray="0"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) =>
              chartDayFormat.format(new Date(value))
            }
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            tickMargin={10}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(value: number) => formatCompact(value)}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={["auto", "auto"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <RechartsTooltip
            content={<PlaysTooltip />}
            cursor={{
              stroke: "color-mix(in oklab, var(--foreground) 22%, transparent)",
              strokeDasharray: "4 4",
            }}
          />

          <Area
            type="monotone"
            dataKey="playCount"
            stroke="url(#spotify-plays-stroke)"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="url(#spotify-plays-fill)"
            animationDuration={650}
            activeDot={{
              r: 4.5,
              fill: "var(--chart-growth-end)",
              stroke: "var(--card)",
              strokeWidth: 2,
            }}
          />

          {lastPoint && (
            <ReferenceDot
              x={lastPoint.date}
              y={lastPoint.playCount}
              shape={<EndDot />}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function EndDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill="var(--chart-growth-end)"
        opacity={0.15}
      />
      <circle
        cx={cx}
        cy={cy}
        r={3.5}
        fill="var(--chart-growth-end)"
        stroke="var(--card)"
        strokeWidth={2}
      />
    </g>
  );
}

function PlaysTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="border-border bg-popover/95 min-w-44 rounded-xl border p-3 shadow-xl backdrop-blur-md">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        {dateTimeFormat.format(new Date(String(label)))}
      </p>
      <div className="flex items-center justify-between gap-6 text-xs">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: "var(--chart-growth-end)" }}
          />
          Plays
        </span>
        <span className="text-sm font-bold tabular-nums">
          {Number(payload[0]?.value ?? 0).toLocaleString("pt-BR")}
        </span>
      </div>
    </div>
  );
}

/* ── Blocos auxiliares ─────────────────────────────────────────────────── */

function MiniStat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-muted/20 flex flex-col gap-1.5 rounded-2xl border p-3">
      <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
        <span className="text-brand-cyan not-dark:text-primary shrink-0">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl px-4 text-center",
        compact ? "flex-1 py-10" : "glass-card py-14",
      )}
    >
      <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold sm:text-base">{title}</p>
        <p className="text-muted-foreground mx-auto max-w-md text-xs sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

/** Fantasma do gráfico: barras pulsando em onda, no ritmo do skeleton kit. */
function ChartBones() {
  return (
    <div className="flex h-[240px] items-end justify-between gap-1.5 sm:h-[300px] sm:gap-2.5">
      {Array.from({ length: 14 }).map((_, index) => {
        const height = 22 + ((index * 41) % 70);
        return (
          <span
            key={index}
            aria-hidden
            className="hero-bar skeleton-bone w-full rounded-t-lg"
            style={
              {
                height: `${height}%`,
                "--bar-delay": `${index * 0.12}s`,
                "--bar-dur": "2.6s",
                "--shimmer-delay": `${index * 90}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
