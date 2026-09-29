"use client";

import * as React from "react";
import {
  At,
  ArrowSquareOut,
  ChartLineUp,
  CheckCircle,
  Envelope,
  Eye,
  FloppyDisk,
  Globe,
  PencilSimple,
  Plus,
  Pulse,
  Spinner,
  Trash,
  TrendUp,
  UserCircle,
  VideoCamera,
  Wallet,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CpmComparisonChart } from "@/components/performance/cpm-comparison-chart";
import { ChartSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import {
  formatMetricFull,
  formatNumber,
  type CompetitionTabProps,
  useFormatCurrency,
} from "./shared";

type RecordValue = Record<string, unknown>;
type PerformancePlatform =
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "KWAI"
  | "FACEBOOK";
type ProfilePlatform = "INSTAGRAM" | "TIKTOK" | "YOUTUBE";
const PROFILE_PLATFORMS: ProfilePlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE"];
type Profile = {
  id: string;
  platform: string;
  handle: string;
  url: string;
  followers: number;
  initialFollowers: number;
  growth: number;
  growthPercent: number;
  lastCollectedAt: string | null;
  history: Array<{ date: string; followers: number }>;
};
type PerformanceVideo = {
  id: string;
  title: string;
  url: string;
  platform: string;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  baselineViews: number;
  lastCollectedAt: string | null;
  notifyClippers: boolean;
};

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value) || fallback;
}

function dateLabel(value: unknown) {
  if (!value) return "—";
  const raw =
    typeof value === "string" || typeof value === "number"
      ? value
      : value instanceof Date
        ? value.toISOString()
        : null;
  if (raw === null) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function platformLabel(platform: string) {
  return (
    {
      INSTAGRAM: "Instagram",
      TIKTOK: "TikTok",
      YOUTUBE: "YouTube",
      FACEBOOK: "Facebook",
      KWAI: "Kwai",
    }[platform] ?? platform
  );
}

function numericInputValue(value: unknown) {
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : "";
}

function toPlatform(value: string | undefined): PerformancePlatform {
  return ["INSTAGRAM", "TIKTOK", "YOUTUBE", "KWAI", "FACEBOOK"].includes(
    value ?? "",
  )
    ? (value as PerformancePlatform)
    : "INSTAGRAM";
}

function toProfilePlatform(value: string | undefined): ProfilePlatform {
  return PROFILE_PLATFORMS.includes(value as ProfilePlatform)
    ? (value as ProfilePlatform)
    : "INSTAGRAM";
}

function normalizeProfile(value: unknown): Profile {
  const item = record(value);
  const historyValue = Array.isArray(item.history)
    ? item.history
    : Array.isArray(item.snapshots)
      ? item.snapshots
      : [];
  const history = historyValue.map((snapshot) => {
    const entry = record(snapshot);
    return {
      date: stringValue(entry.date ?? entry.collectedAt ?? entry.createdAt),
      followers: numberValue(entry.followers ?? entry.followersCount),
    };
  });
  const followers = numberValue(
    item.followers ?? item.followersCount ?? item.currentFollowers,
  );
  const initialFollowers = numberValue(
    item.initialFollowers ?? item.startFollowers ?? history[0]?.followers,
  );
  return {
    id: stringValue(item.id),
    platform: stringValue(item.platform, "INSTAGRAM"),
    handle: stringValue(item.handle ?? item.username, "@perfil"),
    url: stringValue(item.url ?? item.profileUrl),
    followers,
    initialFollowers,
    growth: numberValue(item.growth, followers - initialFollowers),
    growthPercent: numberValue(
      item.growthPercent ?? item.growthPercentage,
      initialFollowers > 0
        ? ((followers - initialFollowers) / initialFollowers) * 100
        : 0,
    ),
    lastCollectedAt:
      stringValue(item.lastCollectedAt ?? item.updatedAt) || null,
    history,
  };
}

function normalizeVideo(value: unknown): PerformanceVideo {
  const item = record(value);
  return {
    id: stringValue(item.id),
    title: stringValue(item.title, "Vídeo obrigatório"),
    url: stringValue(item.url ?? item.videoUrl ?? item.originalUrl),
    platform: stringValue(item.platform, "—"),
    thumbnailUrl: stringValue(item.thumbnailUrl ?? item.thumbnail) || null,
    views: numberValue(item.views ?? item.viewsCount ?? item.currentViews),
    likes: numberValue(item.likes ?? item.likesCount ?? item.currentLikes),
    comments: numberValue(
      item.comments ?? item.commentsCount ?? item.currentComments,
    ),
    shares: numberValue(item.shares ?? item.sharesCount ?? item.currentShares),
    baselineViews: numberValue(item.baselineViews ?? item.initialViews),
    lastCollectedAt:
      stringValue(item.lastCollectedAt ?? item.updatedAt) || null,
    notifyClippers: Boolean(item.notifyClippers ?? item.notifyOnCreate),
  };
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "glass-card border-border/60 rounded-2xl border p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
          <Icon className="size-4" weight="fill" />
        </span>
        <div>
          <h3 className="font-bold tracking-tight">{title}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function PerformanceTab({
  campaignId,
  data,
  active,
  commentsSection,
}: CompetitionTabProps & { commentsSection?: React.ReactNode }) {
  const formatCurrency = useFormatCurrency();
  const [profileDialog, setProfileDialog] = React.useState<
    "create" | Profile | null
  >(null);
  const [videoDialog, setVideoDialog] = React.useState<
    "create" | PerformanceVideo | null
  >(null);
  const [investment, setInvestment] = React.useState("");
  const [benchmarkCpm, setBenchmarkCpm] = React.useState("");
  const [profilePlatform, setProfilePlatform] =
    React.useState<ProfilePlatform>("INSTAGRAM");
  const [profileHandle, setProfileHandle] = React.useState("");
  const [profileUrl, setProfileUrl] = React.useState("");
  const [videoTitle, setVideoTitle] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [videoPlatform, setVideoPlatform] =
    React.useState<PerformancePlatform>("INSTAGRAM");
  const [videoNotify, setVideoNotify] = React.useState(false);

  const query = api.admin.getCompetitionPerformance.useQuery(
    { campaignId },
    { enabled: active && Boolean(campaignId) },
  );
  const payload = record(query.data);
  const settings = record(payload.settings);
  const benchmarkSuggestion = record(payload.benchmarkSuggestion);
  const summary = record(payload.summary);
  const profiles = (
    Array.isArray(payload.profiles) ? payload.profiles : []
  ).map(normalizeProfile);
  const videos = (Array.isArray(payload.videos) ? payload.videos : []).map(
    normalizeVideo,
  );
  const cpmHistory = Array.isArray(payload.cpmHistory)
    ? payload.cpmHistory.map((entry) => {
        const item = record(entry);
        return {
          date: dateLabel(item.date ?? item.collectedAt),
          campaignCpm:
            (item.campaignCpm ?? item.cpm ?? item.effectiveCpm) === null
              ? null
              : numberValue(item.campaignCpm ?? item.cpm ?? item.effectiveCpm),
          adsCpm: numberValue(
            item.adsCpm ?? item.benchmarkCpm ?? item.referenceCpm,
          ),
          totalViews: numberValue(item.totalViews),
          investment: numberValue(item.investment),
          estimatedAdsCost: numberValue(item.estimatedAdsCost),
        };
      })
    : [];
  const currentTotalViews = numberValue(summary.totalViews);
  const totalInvestment = numberValue(summary.investedAmount);
  const currentEquivalentAdsCost = numberValue(summary.equivalentAdsCost);
  const formatCpm = React.useCallback(
    (value: number) => {
      const visibilityAwareValue = formatCurrency(value);
      if (visibilityAwareValue.includes("•")) return visibilityAwareValue;
      return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },
    [formatCurrency],
  );
  const profileLines = profiles.filter((profile) => profile.history.length > 1);
  const profileChartData = React.useMemo(() => {
    const points = new Map<string, Record<string, string | number>>();
    for (const profile of profiles) {
      for (const snapshot of profile.history) {
        const key = dateLabel(snapshot.date);
        const point = points.get(key) ?? { date: key };
        point[profile.id] = snapshot.followers;
        points.set(key, point);
      }
    }
    return [...points.values()];
  }, [profiles]);

  const saveSettings =
    api.admin.updateCompetitionPerformanceSettings.useMutation({
      onSuccess: () => {
        toast.success("Configuração de performance salva");
        void query.refetch();
      },
      onError: (error: { message?: string }) =>
        toast.error(error.message ?? "Não foi possível salvar a configuração"),
    });
  const createProfile = api.admin.createPerformanceProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil adicionado ao acompanhamento");
      setProfileDialog(null);
      void query.refetch();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível salvar o perfil"),
  });
  const updateProfile = api.admin.updatePerformanceProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado");
      setProfileDialog(null);
      void query.refetch();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível atualizar o perfil"),
  });
  const deleteProfile = api.admin.deletePerformanceProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil removido do acompanhamento");
      void query.refetch();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível remover o perfil"),
  });
  const createVideo = api.admin.createPerformanceVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo cadastrado para monitoramento");
      setVideoDialog(null);
      void query.refetch();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível salvar o vídeo"),
  });
  const updateVideo = api.admin.updatePerformanceVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo atualizado");
      setVideoDialog(null);
      void query.refetch();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível atualizar o vídeo"),
  });
  const deleteVideo = api.admin.deletePerformanceVideo.useMutation({
    onSuccess: () => {
      toast.success("Vídeo removido do acompanhamento");
      void query.refetch();
    },
    onError: (error: { message?: string }) =>
      toast.error(error.message ?? "Não foi possível remover o vídeo"),
  });

  React.useEffect(() => {
    setInvestment(numericInputValue(settings.investedAmount));
    setBenchmarkCpm(
      numericInputValue(
        settings.referenceCpm ?? benchmarkSuggestion.referenceCpm,
      ),
    );
  }, [payload.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const openProfile = (profile: Profile | "create") => {
    if (profile === "create") {
      setProfilePlatform(
        PROFILE_PLATFORMS.find((platform) =>
          data.campaign.platforms.includes(platform),
        ) ?? "INSTAGRAM",
      );
      setProfileHandle("");
      setProfileUrl("");
    } else {
      setProfilePlatform(toProfilePlatform(profile.platform));
      setProfileHandle(profile.handle);
      setProfileUrl(profile.url);
    }
    setProfileDialog(profile);
  };
  const openVideo = (video: PerformanceVideo | "create") => {
    setVideoTitle(video === "create" ? "" : video.title);
    setVideoUrl(video === "create" ? "" : video.url);
    setVideoPlatform(
      video === "create"
        ? toPlatform(data.campaign.platforms[0])
        : toPlatform(video.platform),
    );
    setVideoNotify(video === "create" ? false : video.notifyClippers);
    setVideoDialog(video);
  };

  if (query.isLoading) return <ChartSkeleton heightClass="h-96" />;

  const investmentAmount = numberValue(
    summary.investedAmount ?? settings.investedAmount,
  );
  const effectiveCpm = numberValue(summary.effectiveCpm ?? summary.campaignCpm);
  const referenceCpm = numberValue(
    summary.referenceCpm ?? settings.referenceCpm,
  );
  const adsEquivalent = numberValue(
    summary.equivalentAdsCost ?? summary.adsEquivalentCost,
  );
  const savings = numberValue(summary.estimatedSavings ?? summary.savings);
  const savingsPercent = numberValue(
    summary.savingsPercentage ?? summary.savingsPercent,
  );

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Pulse
            className="mt-0.5 size-5 shrink-0 text-cyan-500"
            weight="fill"
          />
          <div>
            <h2 className="font-bold">Performance da competição</h2>
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
              Acompanhe o valor gerado pelos cortes, o crescimento dos perfis
              oficiais e os vídeos obrigatórios.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <SectionHeading
          icon={Wallet}
          title="Eficiência do investimento"
          description="Compare o CPM real da campanha com o benchmark de anúncios configurado."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Investimento da campanha"
            value={formatCurrency(investmentAmount)}
            icon={Wallet}
          />
          <Metric
            label="CPM da competição"
            value={formatCurrency(effectiveCpm)}
            icon={ChartLineUp}
            hint="Investimento ÷ views × 1.000"
          />
          <Metric
            label="Custo equivalente em ADS"
            value={formatCurrency(adsEquivalent)}
            icon={Globe}
          />
          <Metric
            label="Economia estimada"
            value={formatCurrency(savings)}
            icon={TrendUp}
            accent
            hint={
              savingsPercent
                ? `${savingsPercent.toFixed(1)}% abaixo do ADS`
                : undefined
            }
          />
        </div>
        <div className="border-border/60 bg-muted/20 mt-5 grid gap-4 rounded-xl border p-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor investido (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={investment}
                onChange={(event) => setInvestment(event.target.value)}
                placeholder="Ex.: 50000"
              />
            </Field>
            <Field label="CPM de referência (R$)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={benchmarkCpm}
                onChange={(event) => setBenchmarkCpm(event.target.value)}
                placeholder="Ex.: 15"
              />
            </Field>
          </div>
          <Button
            className="btn-gradient-auth cursor-pointer rounded-xl"
            disabled={saveSettings.isPending}
            onClick={() =>
              saveSettings.mutate({
                campaignId,
                investedAmount: Number(investment) || 0,
                referenceCpm: Number(benchmarkCpm) || 0,
              })
            }
          >
            {saveSettings.isPending ? (
              <Spinner className="size-4 animate-spin" />
            ) : (
              <FloppyDisk className="size-4" />
            )}
            Salvar configuração
          </Button>
        </div>
      </Card>

      <Card>
        <SectionHeading
          icon={ChartLineUp}
          title="Acompanhamento comparativo de CPM"
          description="Evolução do custo efetivo dos cortes versus o valor estimado em mídia paga."
        />
        {cpmHistory.length > 1 ? (
          <CpmComparisonChart
            points={cpmHistory}
            totalViews={currentTotalViews}
            investment={totalInvestment}
            equivalentAdsCost={currentEquivalentAdsCost}
            referenceCpm={numberValue(
              summary.referenceCpm ?? settings.referenceCpm,
            )}
            formatMoney={formatCpm}
            formatViews={formatMetricFull}
          />
        ) : (
          <Empty message="Ainda não há histórico suficiente para desenhar o comparativo." />
        )}
      </Card>

      {commentsSection}

      <Card>
        <SectionHeading
          icon={UserCircle}
          title="Perfis oficiais acompanhados"
          description="Cadastre os @ obrigatórios para monitorar o crescimento de seguidores durante a campanha."
          action={
            <Button
              size="sm"
              className="cursor-pointer rounded-xl"
              onClick={() => openProfile("create")}
            >
              <Plus className="size-4" /> Adicionar perfil
            </Button>
          }
        />
        {profileLines.length > 0 && (
          <div className="mb-5 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={profileChartData}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border/50"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatNumber(Number(value))}
                />
                <ChartTooltip
                  formatter={(value) => formatNumber(Number(value) || 0)}
                />
                {profileLines.slice(0, 5).map((profile, index) => (
                  <Line
                    key={profile.id}
                    type="monotone"
                    dataKey={profile.id}
                    name={`@${profile.handle.replace(/^@/, "")}`}
                    stroke={
                      ["#22d3ee", "#34d399", "#a78bfa", "#fb7185", "#fbbf24"][
                        index
                      ]
                    }
                    strokeWidth={2.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {profiles.length === 0 ? (
          <Empty
            message="Nenhum perfil oficial cadastrado ainda."
            action={
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-xl"
                onClick={() => openProfile("create")}
              >
                <Plus className="size-4" /> Cadastrar primeiro perfil
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                onEdit={() => openProfile(profile)}
                onDelete={() => deleteProfile.mutate({ id: profile.id })}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeading
          icon={VideoCamera}
          title="Vídeos obrigatórios para corte"
          description="Monitore as métricas dos conteúdos oficiais e avise os clipadores quando um novo vídeo chegar."
          action={
            <Button
              size="sm"
              className="cursor-pointer rounded-xl"
              onClick={() => openVideo("create")}
            >
              <Plus className="size-4" /> Adicionar vídeo
            </Button>
          }
        />
        {videos.length === 0 ? (
          <Empty
            message="Nenhum vídeo obrigatório cadastrado ainda."
            action={
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer rounded-xl"
                onClick={() => openVideo("create")}
              >
                <Plus className="size-4" /> Cadastrar primeiro vídeo
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3">
            {videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                onEdit={() => openVideo(video)}
                onDelete={() => deleteVideo.mutate({ id: video.id })}
              />
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={profileDialog !== null}
        onOpenChange={(open) => !open && setProfileDialog(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {profileDialog === "create"
                ? "Adicionar perfil oficial"
                : "Editar perfil oficial"}
            </DialogTitle>
            <DialogDescription>
              O perfil será coletado automaticamente duas vezes ao dia durante a
              competição.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Plataforma">
              <Select
                value={profilePlatform}
                onValueChange={(value) =>
                  setProfilePlatform(toProfilePlatform(value))
                }
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platformLabel(platform)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="@ do perfil">
              <Input
                value={profileHandle}
                onChange={(event) => setProfileHandle(event.target.value)}
                placeholder="@perfiloficial"
              />
            </Field>
            <Field label="URL (opcional)">
              <Input
                type="url"
                value={profileUrl}
                onChange={(event) => setProfileUrl(event.target.value)}
                placeholder="https://instagram.com/perfiloficial"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setProfileDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl"
              disabled={
                !profileHandle.trim() ||
                createProfile.isPending ||
                updateProfile.isPending
              }
              onClick={() => {
                const input = {
                  campaignId,
                  platform: profilePlatform,
                  username: profileHandle.trim().replace(/^@/, ""),
                  profileUrl: profileUrl.trim() || null,
                };
                if (profileDialog === "create") createProfile.mutate(input);
                else if (profileDialog)
                  updateProfile.mutate({ id: profileDialog.id, ...input });
              }}
            >
              {createProfile.isPending || updateProfile.isPending ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <CheckCircle className="size-4" />
              )}{" "}
              Salvar perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={videoDialog !== null}
        onOpenChange={(open) => !open && setVideoDialog(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {videoDialog === "create"
                ? "Adicionar vídeo obrigatório"
                : "Editar vídeo obrigatório"}
            </DialogTitle>
            <DialogDescription>
              O conteúdo será monitorado às 10h e às 22h. A notificação é
              enviada uma única vez no cadastro.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label="Título (opcional)">
              <Input
                value={videoTitle}
                onChange={(event) => setVideoTitle(event.target.value)}
                placeholder="Ex.: Episódio 1 — entrevista"
              />
            </Field>
            <Field label="URL do vídeo">
              <Input
                type="url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </Field>
            <Field label="Plataforma">
              <Select
                value={videoPlatform}
                onValueChange={(value) => setVideoPlatform(toPlatform(value))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(data.campaign.platforms.length
                    ? data.campaign.platforms
                    : ["INSTAGRAM"]
                  ).map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {platformLabel(platform)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="border-border/60 bg-muted/20 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <input
                type="checkbox"
                checked={videoNotify}
                onChange={(event) => setVideoNotify(event.target.checked)}
                className="mt-0.5 size-4 accent-cyan-500"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Envelope className="size-4 text-cyan-500" /> Avisar
                  clipadores por e-mail
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  Envia para os clipadores aprovados nesta competição.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => setVideoDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              className="btn-gradient-auth cursor-pointer rounded-xl"
              disabled={
                !videoUrl.trim() ||
                createVideo.isPending ||
                updateVideo.isPending
              }
              onClick={() => {
                const input = {
                  campaignId,
                  platform: videoPlatform,
                  title: videoTitle.trim() || null,
                  originalUrl: videoUrl.trim(),
                  notifyClippers: videoNotify,
                };
                if (videoDialog === "create") createVideo.mutate(input);
                else if (videoDialog)
                  updateVideo.mutate({
                    id: videoDialog.id,
                    platform: videoPlatform,
                    title: videoTitle.trim() || null,
                    originalUrl: videoUrl.trim(),
                  });
              }}
            >
              {createVideo.isPending || updateVideo.isPending ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                <CheckCircle className="size-4" />
              )}{" "}
              Salvar vídeo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-border/60 bg-background/40 rounded-xl border p-3">
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p
        className={cn(
          "mt-1 text-lg font-bold tracking-tight",
          accent && "text-emerald-500",
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-muted-foreground mt-0.5 text-[10px]">{hint}</p>
      )}
    </div>
  );
}

function Empty({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border/70 bg-muted/10 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-9 text-center">
      <Pulse className="text-muted-foreground/60 size-7" />
      <p className="text-muted-foreground text-sm">{message}</p>
      {action}
    </div>
  );
}

function ProfileRow({
  profile,
  onEdit,
  onDelete,
}: {
  profile: Profile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-border/60 bg-background/30 rounded-xl border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
            <At className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              @{profile.handle.replace(/^@/, "")}
            </p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="rounded-full text-[10px]">
                {platformLabel(profile.platform)}
              </Badge>
              {profile.lastCollectedAt && (
                <span>Atualizado {dateLabel(profile.lastCollectedAt)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-lg"
            onClick={onEdit}
            aria-label="Editar perfil"
          >
            <PencilSimple className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 cursor-pointer rounded-lg text-red-500 hover:text-red-600"
            onClick={onDelete}
            aria-label="Remover perfil"
          >
            <Trash className="size-4" />
          </Button>
        </div>
      </div>
      {profile.lastCollectedAt ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric
            label="Seguidores"
            value={formatNumber(profile.followers)}
            icon={UserCircle}
          />
          <Metric
            label="Crescimento"
            value={`${profile.growth >= 0 ? "+" : ""}${formatNumber(profile.growth)}`}
            icon={TrendUp}
            accent={profile.growth >= 0}
          />
          <Metric
            label="Variação"
            value={`${profile.growthPercent >= 0 ? "+" : ""}${profile.growthPercent.toFixed(1)}%`}
            icon={ChartLineUp}
            accent={profile.growthPercent >= 0}
          />
        </div>
      ) : (
        <div className="border-border/50 bg-muted/20 text-muted-foreground mt-4 rounded-lg border px-3 py-2 text-xs">
          Aguardando a primeira coleta válida para exibir as métricas.
        </div>
      )}
    </div>
  );
}

function VideoRow({
  video,
  onEdit,
  onDelete,
}: {
  video: PerformanceVideo;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-border/60 bg-background/30 flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center">
      <div className="bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <VideoCamera className="text-muted-foreground size-6" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{video.title}</p>
          {video.notifyClippers && (
            <Badge
              variant="outline"
              className="gap-1 rounded-full border-cyan-500/30 bg-cyan-500/10 text-[10px] text-cyan-500"
            >
              <Envelope className="size-3" /> Aviso por e-mail
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {formatNumber(video.views)} views
          </span>
          <span>♥ {formatNumber(video.likes)}</span>
          <span>Atualizado {dateLabel(video.lastCollectedAt)}</span>
          {video.url && (
            <a
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-cyan-500 hover:underline"
            >
              Abrir <ArrowSquareOut className="size-3" />
            </a>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer rounded-lg"
          onClick={onEdit}
          aria-label="Editar vídeo"
        >
          <PencilSimple className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 cursor-pointer rounded-lg text-red-500 hover:text-red-600"
          onClick={onDelete}
          aria-label="Remover vídeo"
        >
          <Trash className="size-4" />
        </Button>
      </div>
    </div>
  );
}
