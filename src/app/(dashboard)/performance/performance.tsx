"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChartLineUp,
  ChatsCircle,
  Clock,
  CurrencyCircleDollar,
  Eye,
  InstagramLogo,
  LinkSimple,
  PlayCircle,
  TrendUp,
  Trophy,
  TiktokLogo,
  UsersThree,
  VideoCamera,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { HomeHero } from "@/components/home/home-hero";
import { CpmComparisonChart } from "@/components/performance/cpm-comparison-chart";
import { Reveal } from "@/components/shared/reveal";
import {
  Bone,
  ChartSkeleton,
  StatTilesGridSkeleton,
} from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/*
 * Contrato lido de customers.getPerformance:
 *
 * O endpoint aceita { campaignId?: string } e retorna
 * { campaigns, selected, aggregate }. `selected` usa o shape de
 * getCampaignPerformance; `aggregate` traz o resumo consolidado. A camada de
 * normalização abaixo deixa a apresentação independente desses nomes de API.
 */
export type ClientPerformanceResponse = {
  campaigns: PerformanceCampaign[];
  summary: PerformanceSummary;
  cpmHistory: CpmPoint[];
  profiles: OfficialProfile[];
  videos: RequiredVideo[];
  lastUpdated: string | null;
};

type PerformanceCampaign = {
  id: string;
  name: string;
  slug?: string | null;
  status?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

type PerformanceSummary = {
  investment: number;
  referenceCpm: number;
  totalViews: number;
  effectiveCpm: number;
  estimatedAdsCost: number;
  savings: number;
  savingsPercent: number;
};

type RawSummary = {
  totalViews?: number;
  investedAmount?: number;
  referenceCpm?: number;
  effectiveCpm?: number;
  equivalentAdsCost?: number;
  estimatedSavings?: number;
  savingsPercentage?: number;
};

type RawPerformance = {
  campaign?: PerformanceCampaign;
  summary?: RawSummary | null;
  cpmHistory?: CpmPoint[];
  profiles?: Array<{
    id: string;
    platform: string;
    username: string;
    campaignName?: string;
    label?: string | null;
    currentFollowers?: number | null;
    initialFollowers?: number | null;
    growth?: number | null;
    growthPercentage?: number | null;
    profileUrl?: string | null;
    lastCollectedAt?: string | null;
    history?: Array<{ followers?: number; collectedAt: string }>;
  }>;
  videos?: Array<{
    id: string;
    platform?: string | null;
    originalUrl: string;
    campaignName?: string;
    title?: string | null;
    thumbnailUrl?: string | null;
    currentViews?: number;
    currentLikes?: number;
    currentComments?: number;
    currentShares?: number;
    viewsGrowth?: number;
    lastCollectedAt?: string | null;
    history?: Array<{
      views?: number;
      likes?: number;
      comments?: number;
      shares?: number;
      collectedAt: string;
    }>;
  }>;
};

type PerformanceApiResponse = {
  campaigns: PerformanceCampaign[];
  selected: RawPerformance | null;
  overall: RawPerformance | null;
  aggregate: RawSummary | null;
};

type CpmPoint = {
  date: string;
  investment?: number;
  totalViews?: number;
  effectiveCpm?: number | null;
  estimatedAdsCost?: number;
  referenceCpm?: number;
  savings?: number;
};

type HistoryPoint = {
  date: string;
  followers?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
};

type OfficialProfile = {
  id: string;
  platform: string;
  username: string;
  campaignName?: string;
  displayName?: string | null;
  profileUrl?: string | null;
  lastCollectedAt?: string | null;
  followersStart?: number | null;
  followersCurrent?: number | null;
  growth?: number | null;
  growthPercent?: number | null;
  history?: HistoryPoint[];
};

type RequiredVideo = {
  id: string;
  title?: string | null;
  url: string;
  campaignName?: string;
  platform?: string | null;
  thumbnailUrl?: string | null;
  lastCollectedAt?: string | null;
  latest?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  } | null;
  growth?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  } | null;
  history?: HistoryPoint[];
};

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const asNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const currency = (value: unknown) => BRL.format(asNumber(value));
const compact = (value: unknown) => COMPACT.format(asNumber(value));

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Ainda não coletado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Ainda não coletado"
    : date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function normalizeSummary(
  summary: RawSummary | null | undefined,
): PerformanceSummary {
  return {
    investment: asNumber(summary?.investedAmount),
    referenceCpm: asNumber(summary?.referenceCpm),
    totalViews: asNumber(summary?.totalViews),
    effectiveCpm: asNumber(summary?.effectiveCpm),
    estimatedAdsCost: asNumber(summary?.equivalentAdsCost),
    savings: asNumber(summary?.estimatedSavings),
    savingsPercent: asNumber(summary?.savingsPercentage),
  };
}

function normalizeResponse(
  raw: PerformanceApiResponse | undefined,
  selectedId: string,
): ClientPerformanceResponse | undefined {
  if (!raw) return undefined;
  const selected =
    raw.campaigns.length > 1 && !selectedId ? raw.overall : raw.selected;
  const selectedProfiles = selected?.profiles ?? [];
  const selectedVideos = selected?.videos ?? [];
  const lastUpdated =
    [...selectedProfiles, ...selectedVideos]
      .map((item) => item.lastCollectedAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    campaigns: raw.campaigns ?? [],
    summary: normalizeSummary(selected?.summary),
    cpmHistory: selected?.cpmHistory ?? [],
    lastUpdated,
    profiles: selectedProfiles.map((profile) => ({
      id: profile.id,
      platform: profile.platform,
      username: profile.username,
      campaignName: profile.campaignName,
      displayName: profile.label,
      profileUrl: profile.profileUrl,
      lastCollectedAt: profile.lastCollectedAt,
      followersStart: profile.initialFollowers,
      followersCurrent: profile.currentFollowers,
      growth: profile.growth,
      growthPercent: profile.growthPercentage,
      history: profile.history?.map((point) => ({
        date: point.collectedAt,
        followers: point.followers,
      })),
    })),
    videos: selectedVideos.map((video) => ({
      id: video.id,
      title: video.title,
      url: video.originalUrl,
      campaignName: video.campaignName,
      platform: video.platform,
      thumbnailUrl: video.thumbnailUrl,
      lastCollectedAt: video.lastCollectedAt,
      latest: {
        views: video.currentViews,
        likes: video.currentLikes,
        comments: video.currentComments,
        shares: video.currentShares,
      },
      growth: { views: video.viewsGrowth },
      history: video.history?.map((point) => ({
        date: point.collectedAt,
        views: point.views,
        likes: point.likes,
        comments: point.comments,
        shares: point.shares,
      })),
    })),
  };
}

function platformIcon(platform: string) {
  const normalized = platform.toUpperCase();
  if (normalized === "INSTAGRAM") return InstagramLogo;
  if (normalized === "YOUTUBE") return YoutubeLogo;
  if (normalized === "TIKTOK") return TiktokLogo;
  return VideoCamera;
}

function platformLabel(platform: string) {
  return (
    (
      {
        INSTAGRAM: "Instagram",
        TIKTOK: "TikTok",
        YOUTUBE: "YouTube",
      } as Record<string, string>
    )[platform.toUpperCase()] ?? platform
  );
}

function changeLabel(value: unknown, unit: string) {
  const change = asNumber(value);
  if (change === 0) return `Sem variação de ${unit}`;
  return `${change > 0 ? "+" : "−"}${compact(Math.abs(change))} ${unit}`;
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
        <Icon className="size-5" weight="fill" />
      </span>
      <div>
        <h2 className="text-base font-bold tracking-tight sm:text-lg">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-border/60 text-muted-foreground flex min-h-36 items-center justify-center rounded-2xl border border-dashed p-6 text-center text-sm">
      {message}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone?: "default" | "positive" | "negative" | "highlight";
}) {
  return (
    <div
      className={cn(
        "glass-card flex min-w-0 flex-col gap-3 rounded-2xl border p-4 sm:p-5",
        tone === "highlight" && "border-cyan-500/30 bg-cyan-500/[0.06]",
        tone === "positive" && "border-emerald-500/25",
        tone === "negative" && "border-amber-500/25",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        <span
          className={cn(
            "bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg",
            tone === "highlight" &&
              "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
            tone === "positive" &&
              "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
            tone === "negative" &&
              "bg-amber-500/15 text-amber-600 dark:text-amber-300",
          )}
        >
          <Icon className="size-4" weight="fill" />
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight break-words tabular-nums sm:text-[1.7rem]">
        {value}
      </p>
      <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
    </div>
  );
}

export default function ClientPerformance() {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState("");
  const performanceRouter = api.customers as unknown as {
    getPerformance: {
      useQuery: (
        input: { campaignId?: string },
        options?: { refetchInterval?: number },
      ) => { data: unknown; isLoading: boolean; isError: boolean };
    };
  };
  const query = performanceRouter.getPerformance.useQuery(
    { campaignId: selectedId || undefined },
    { refetchInterval: 60_000 },
  );
  const data = normalizeResponse(
    query.data as PerformanceApiResponse | undefined,
    selectedId,
  );
  const campaigns = React.useMemo(
    () => data?.campaigns ?? [],
    [data?.campaigns],
  );
  const summary = data?.summary;
  const profiles = data?.profiles ?? [];
  const videos = data?.videos ?? [];
  const isLoading = query.isLoading;

  React.useEffect(() => {
    if (query.isError && selectedId) {
      setSelectedId("");
    } else if (
      data &&
      selectedId &&
      !campaigns.some((item) => item.id === selectedId)
    ) {
      setSelectedId("");
    }
  }, [campaigns, data, query.isError, selectedId]);

  const hasNoCampaigns = data !== undefined && campaigns.length === 0;
  React.useEffect(() => {
    if (hasNoCampaigns) router.replace("/");
  }, [hasNoCampaigns, router]);

  const isOverview = campaigns.length > 1 && !selectedId;

  const profileCount = profiles.length;
  const hasCpmConfiguration = campaigns.length > 0;
  const hasViews = asNumber(summary?.totalViews) > 0;
  const hasComparison = hasViews && asNumber(summary?.estimatedAdsCost) > 0;
  const savings = asNumber(summary?.savings);
  const cpmPoints = (data?.cpmHistory ?? []).map((point) => ({
    date: new Date(point.date).toLocaleDateString("pt-BR"),
    campaignCpm:
      typeof point.effectiveCpm === "number" && point.effectiveCpm > 0
        ? point.effectiveCpm
        : null,
    adsCpm: asNumber(point.referenceCpm),
    totalViews: asNumber(point.totalViews),
    investment: asNumber(point.investment),
    estimatedAdsCost: asNumber(point.estimatedAdsCost),
  }));
  const heroHistory = (data?.cpmHistory ?? []).slice(-12);
  const heroMaxViews = Math.max(
    1,
    ...heroHistory.map((point) => asNumber(point.totalViews)),
  );
  const videoViews = videos.reduce(
    (sum, video) => sum + asNumber(video.latest?.views),
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HomeHero
        key={`${selectedId || "all"}-${asNumber(summary?.totalViews)}-${profileCount}-${campaigns.length}`}
        eyebrow="Clipfy League · Performance"
        title={
          <>
            O impacto da sua campanha{" "}
            <span className="text-gradient">em números</span>
          </>
        }
        subtitle="Acompanhe o alcance dos cortes, compare o custo com mídia paga e veja a evolução dos perfis e vídeos oficiais."
        viz={
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] items-end overflow-hidden px-8 pt-12 pb-9 lg:flex"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/[0.03] to-emerald-400/[0.08]" />
            <div className="relative flex h-full w-full items-end gap-1.5 border-b border-cyan-200/20 pb-1">
              {heroHistory.length > 0 ? (
                heroHistory.map((point, index) => (
                  <span
                    key={`${point.date}-${index}`}
                    className="min-w-0 flex-1 rounded-t-md bg-gradient-to-t from-cyan-500/20 via-cyan-400/50 to-emerald-300/90"
                    style={{
                      height: `${Math.max(8, (asNumber(point.totalViews) / heroMaxViews) * 100)}%`,
                    }}
                  />
                ))
              ) : (
                <ChartLineUp
                  className="mb-8 size-24 text-cyan-300/25"
                  weight="thin"
                />
              )}
            </div>
            <span className="absolute right-8 bottom-3 text-[10px] font-semibold tracking-[0.18em] text-cyan-100/60 uppercase">
              Alcance acumulado
            </span>
          </div>
        }
        vizSkeleton={<Bone className="h-24 w-full rounded-2xl sm:h-32" />}
        isLoading={isLoading}
        stats={[
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições",
            value: campaigns.length,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views dos cortes",
            value: asNumber(summary?.totalViews),
            kind: "compact",
          },
          {
            icon: <UsersThree className="size-3.5" weight="fill" />,
            label: "Perfis com dados",
            value: profileCount,
            kind: "int",
          },
        ]}
      />

      <Reveal immediate delayMs={80}>
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-gradient-custom flex size-10 items-center justify-center rounded-xl text-[#04222A]">
                <Trophy className="size-5" weight="fill" />
              </span>
              <div className="leading-tight">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                  {isOverview ? "Visão geral" : "Visão da competição"}
                </p>
                <p className="text-base font-bold tracking-tight sm:text-lg">
                  {isOverview
                    ? "Todas as competições"
                    : (campaigns.find((item) => item.id === selectedId)?.name ??
                      campaigns[0]?.name ??
                      "Competição")}
                </p>
              </div>
            </div>
            {campaigns.length > 1 && (
              <Select
                value={selectedId || "all"}
                onValueChange={(value) =>
                  setSelectedId(value === "all" ? "" : value)
                }
              >
                <SelectTrigger
                  className="h-10 w-full min-w-0 rounded-xl lg:w-[340px]"
                  aria-label="Selecionar competição"
                >
                  <ChatsCircle className="text-muted-foreground mr-1 size-4 shrink-0" />
                  <SelectValue placeholder="Selecione a competição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Visão geral · Todas as competições
                  </SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="border-border/60 text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-3.5 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" weight="fill" />
              Última coleta de perfis e vídeos:{" "}
              {formatDateTime(data?.lastUpdated)}
            </span>
            <span className="bg-border hidden h-3 w-px sm:block" />
            <span>Coletas programadas duas vezes ao dia</span>
          </div>
        </div>
      </Reveal>

      {isLoading ? (
        <LoadingState />
      ) : !data ? (
        <EmptyState message="Não foi possível carregar os dados de performance." />
      ) : campaigns.length === 0 ? (
        <EmptyState message="Nenhuma competição vinculada à sua conta." />
      ) : (
        <>
          {hasCpmConfiguration && (
            <section className="flex flex-col gap-4">
              <SectionTitle
                icon={ChartLineUp}
                title="Alcance e eficiência"
                description="Compare as visualizações dos cortes com o investimento e uma estimativa de mídia paga."
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  label="Visualizações dos cortes"
                  value={NUMBER.format(asNumber(summary?.totalViews))}
                  hint={
                    isOverview
                      ? "Soma das competições selecionadas"
                      : "Alcance acumulado da competição"
                  }
                  icon={Eye}
                  tone="highlight"
                />
                <SummaryCard
                  label="Investimento"
                  value={currency(summary?.investment)}
                  hint={
                    isOverview
                      ? "Soma das competições"
                      : "Valor informado pelo administrador"
                  }
                  icon={CurrencyCircleDollar}
                />
                <SummaryCard
                  label="CPM efetivo"
                  value={hasViews ? currency(summary?.effectiveCpm) : "—"}
                  hint="Custo por mil visualizações dos cortes"
                  icon={ChartLineUp}
                />
                <SummaryCard
                  label={
                    !hasComparison
                      ? "Diferença estimada"
                      : savings >= 0
                        ? "Economia estimada"
                        : "Acima da referência"
                  }
                  value={hasComparison ? currency(Math.abs(savings)) : "—"}
                  hint={
                    !hasViews
                      ? "Disponível após as primeiras visualizações"
                      : !hasComparison
                        ? "Aguardando CPM de referência"
                        : savings > 0
                          ? `${Math.abs(asNumber(summary?.savingsPercent)).toFixed(1)}% abaixo do custo estimado em anúncios`
                          : savings < 0
                            ? `${Math.abs(asNumber(summary?.savingsPercent)).toFixed(1)}% acima do custo estimado em anúncios`
                            : "Mesmo custo estimado em anúncios"
                  }
                  icon={TrendUp}
                  tone={
                    !hasComparison
                      ? "default"
                      : savings >= 0
                        ? "positive"
                        : "negative"
                  }
                />
              </div>
              <div>
                <h3 className="font-semibold">
                  Acompanhamento comparativo de CPM
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Evolução do custo efetivo dos cortes versus o valor estimado
                  em mídia paga.
                </p>
              </div>
              {hasComparison && cpmPoints.length > 1 ? (
                <CpmComparisonChart
                  points={cpmPoints}
                  totalViews={asNumber(summary?.totalViews)}
                  investment={asNumber(summary?.investment)}
                  equivalentAdsCost={asNumber(summary?.estimatedAdsCost)}
                  referenceCpm={asNumber(summary?.referenceCpm)}
                  formatMoney={currency}
                  formatViews={(value) => NUMBER.format(value)}
                  scope={isOverview ? "all" : "single"}
                />
              ) : (
                <EmptyState message="Ainda não há histórico suficiente para desenhar o comparativo." />
              )}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <SectionTitle
              icon={UsersThree}
              title="Crescimento dos perfis oficiais"
              description={
                isOverview
                  ? "Perfis oficiais de todas as competições."
                  : "A evolução dos seguidores dos perfis principais vinculados à competição."
              }
            />
            {profiles.length === 0 ? (
              <EmptyState message="Os perfis oficiais aparecerão aqui após a primeira coleta de seguidores." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {profiles.map((profile) => {
                  const Icon = platformIcon(profile.platform);
                  const handle = `@${profile.username.replace(/^@/, "")}`;
                  const hasCustomName = Boolean(
                    profile.displayName && profile.displayName !== handle,
                  );
                  return (
                    <div
                      key={profile.id}
                      className="glass-card rounded-3xl p-4 sm:p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
                            <Icon className="size-5" weight="fill" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {profile.displayName || handle}
                            </p>
                            {isOverview && (
                              <p className="text-muted-foreground truncate text-xs">
                                {profile.campaignName}
                              </p>
                            )}
                            <p className="text-muted-foreground truncate text-xs">
                              {hasCustomName && <>{handle} · </>}
                              {platformLabel(profile.platform)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "w-fit max-w-full text-[11px] sm:shrink-0",
                            asNumber(profile.growth) > 0 &&
                              "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            asNumber(profile.growth) < 0 &&
                              "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {changeLabel(profile.growth, "seguidores")}
                        </Badge>
                      </div>
                      <div className="mt-5 flex items-end justify-between">
                        <div>
                          <p className="text-muted-foreground text-xs">
                            Seguidores atuais
                          </p>
                          <p className="mt-1 text-2xl font-bold tabular-nums">
                            {NUMBER.format(asNumber(profile.followersCurrent))}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Base:{" "}
                            {NUMBER.format(asNumber(profile.followersStart))} ·{" "}
                            {asNumber(profile.growthPercent) > 0 ? "+" : ""}
                            {asNumber(profile.growthPercent).toFixed(1)}%
                          </p>
                        </div>
                        {(profile.profileUrl ||
                          profileUrl(profile.platform, profile.username)) && (
                          <a
                            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                            href={
                              profile.profileUrl ||
                              profileUrl(profile.platform, profile.username) ||
                              undefined
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver perfil <ArrowUpRight className="size-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="mt-4 h-24">
                        {(profile.history ?? []).length < 2 ? (
                          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                            Aguardando próxima coleta para mostrar a evolução
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={profile.history}>
                              <defs>
                                <linearGradient
                                  id={`profile-${profile.id}`}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#14b8a6"
                                    stopOpacity={0.28}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#14b8a6"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <Area
                                type="monotone"
                                dataKey="followers"
                                stroke="#14b8a6"
                                fill={`url(#profile-${profile.id})`}
                                strokeWidth={2}
                                dot={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-3 text-[11px]">
                        Última coleta: {formatDateTime(profile.lastCollectedAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle
              icon={VideoCamera}
              title="Vídeos obrigatórios"
              description={
                videos.length > 0
                  ? `${videos.length} ${videos.length === 1 ? "vídeo monitorado" : "vídeos monitorados"} · ${compact(videoViews)} views dos vídeos oficiais`
                  : "Acompanhe o alcance dos conteúdos oficiais monitorados nesta competição."
              }
            />
            {videos.length === 0 ? (
              <EmptyState message="Ainda não há vídeos oficiais monitorados nesta competição." />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: RequiredVideo }) {
  const latest = video.latest ?? {};
  const growth = video.growth ?? {};
  return (
    <div className="glass-card overflow-hidden rounded-3xl">
      <div className="flex gap-4 p-4 sm:p-5">
        <div className="bg-muted relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl sm:size-24">
          {video.thumbnailUrl ? (
            <Image
              src={video.thumbnailUrl}
              alt=""
              fill
              sizes="(min-width: 640px) 96px, 80px"
              className="object-cover"
              unoptimized={video.thumbnailUrl.startsWith("http://")}
            />
          ) : (
            <PlayCircle
              className="text-muted-foreground size-9"
              weight="duotone"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {video.title || "Vídeo obrigatório"}
              </p>
              {video.campaignName && (
                <p className="text-muted-foreground mt-1 truncate text-xs">
                  {video.campaignName}
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {video.platform
                  ? platformLabel(video.platform)
                  : "Plataforma não informada"}
              </p>
            </div>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir ${video.title || "vídeo oficial"}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <LinkSimple className="size-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-border/60 grid grid-cols-2 gap-3 border-t px-4 py-4 sm:grid-cols-4 sm:px-5">
        <Metric label="Views" value={latest.views} growth={growth.views} />
        <Metric label="Curtidas" value={latest.likes} />
        <Metric label="Comentários" value={latest.comments} />
        <Metric label="Compartilhamentos" value={latest.shares} />
      </div>
      <div className="border-border/60 border-t px-4 py-3 sm:px-5">
        <p className="text-muted-foreground text-xs">
          {video.lastCollectedAt
            ? `Última coleta: ${formatDateTime(video.lastCollectedAt)}`
            : "Aguardando primeira coleta de métricas"}
        </p>
        <div className="mt-3 h-20">
          {(video.history ?? []).length < 2 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
              Aguardando próxima coleta para mostrar a evolução
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={video.history}>
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#8b5cf6"
                  fill="#8b5cf622"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  growth,
}: {
  label: string;
  value?: number;
  growth?: number;
}) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums">
        {NUMBER.format(asNumber(value))}
      </p>
      {growth !== undefined && (
        <p
          className={cn(
            "mt-0.5 text-[11px]",
            growth > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
        >
          {changeLabel(growth, "views")}
        </p>
      )}
    </div>
  );
}

function profileUrl(platform: string, username: string) {
  const handle = username.replace(/^@/, "").trim();
  if (!handle) return null;
  switch (platform.toUpperCase()) {
    case "INSTAGRAM":
      return `https://instagram.com/${handle}`;
    case "TIKTOK":
      return `https://tiktok.com/@${handle}`;
    case "YOUTUBE":
      return `https://youtube.com/@${handle}`;
    default:
      return null;
  }
}

function LoadingState() {
  return (
    <>
      <StatTilesGridSkeleton count={4} />
      <div className="glass-card rounded-3xl p-4 sm:p-6">
        <ChartSkeleton className="h-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bone className="h-56 rounded-3xl" />
        <Bone className="h-56 rounded-3xl" />
      </div>
    </>
  );
}
