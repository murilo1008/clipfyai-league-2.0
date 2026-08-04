"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretRight,
  ChartDonut,
  ChartLineUp,
  ChatCircle,
  Crown,
  Eye,
  FilmStrip,
  Fire,
  Hash,
  Heart,
  Play,
  ShareNetwork,
  Sparkle,
  Timer,
  TrendUp,
  Trophy,
  Warning,
} from "@phosphor-icons/react";

import { ClipsHeroViz, ClipsHeroVizSkeleton } from "@/components/home/clips-hero-viz";
import {
  HeroClipsTicker,
  type TickerClip,
} from "@/components/home/hero-clips-ticker";
import { HomeHero } from "@/components/home/home-hero";
import { PlatformDonut } from "@/components/home/platform-donut";
import { SectionHeading } from "@/components/home/section-heading";
import { ViewsGrowthChart } from "@/components/home/views-growth-chart";
import { CountUp, formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
import {
  Bone,
  DonutSkeleton,
  HeroSkeleton,
  ListRowsSkeleton,
} from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api, type RouterOutputs } from "@/trpc/react";

/* ── Tipos ─────────────────────────────────────────────────────────────── */
type Campaign = RouterOutputs["customers"]["getDashboard"]["campaigns"][number];

type GrowthPoint = { date: string; total: number } & Record<
  string,
  number | string
>;

/** Recorte usado por toda a página — igual para 1 competição ou agregado. */
interface Selection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  platforms: string[];
  requiredHashtags: string[];
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
  recentViews: number;
  growthData: GrowthPoint[];
  growthPlatforms: string[];
  platformStats: {
    platform: string;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    postsCount: number;
  }[];
  topPosts: Campaign["topPosts"];
  topAccounts: Campaign["topAccounts"];
}

const ALL_ID = "__all__";

/* ── Status das competições ────────────────────────────────────────────── */
interface StatusConfig {
  label: string;
  dot: string;
  badge: string;
}

const FALLBACK_STATUS: StatusConfig = {
  label: "Concluída",
  dot: "bg-zinc-400",
  badge: "border-border bg-background/70 text-muted-foreground",
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  ACTIVE: {
    label: "Ativa",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  SCHEDULED: {
    label: "Agendada",
    dot: "bg-sky-500",
    badge: "border-sky-500/40 bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  COMPLETED: FALLBACK_STATUS,
};

const statusOf = (status: string) => STATUS_CONFIG[status] ?? FALLBACK_STATUS;

/* ── Helpers ───────────────────────────────────────────────────────────── */
const DAY_MS = 86_400_000;

/** "10 de nov. às 00:00" — mesma pontuação da janela fixa divulgada. */
const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${day} às ${time}`;
};

/** Lê um campo numérico de um ponto de crescimento sem depender de índice. */
const growthValue = (point: unknown, key: string): number =>
  Number((point as Record<string, unknown>)[key] ?? 0);

/** Data (YYYY-MM-DD) de um ponto de crescimento; vazia se ausente. */
const growthDate = (point: unknown): string => {
  const value = (point as Record<string, unknown>).date;
  return typeof value === "string" ? value : "";
};

/** Converte o growthData (acumulado) de uma competição para o formato do gráfico. */
const toGrowthPoints = (campaign: Campaign): GrowthPoint[] =>
  campaign.growthData.map((point) => {
    const entry: GrowthPoint = {
      date: growthDate(point),
      total: growthValue(point, "total"),
    };
    for (const platform of campaign.growthPlatforms) {
      entry[platform] = growthValue(point, platform);
    }
    return entry;
  });

/** Perfil público do criador na rede — null quando a plataforma é desconhecida. */
const profileUrl = (platform: string, username: string) => {
  const handle = username.replace(/^@/, "").trim();
  if (!handle) return null;
  switch (platform) {
    case "INSTAGRAM":
      return `https://instagram.com/${handle}`;
    case "TIKTOK":
      return `https://tiktok.com/@${handle}`;
    case "YOUTUBE":
      return `https://youtube.com/@${handle}`;
    case "KWAI":
      return `https://kwai.com/@${handle}`;
    case "FACEBOOK":
      return `https://facebook.com/${handle}`;
    default:
      return null;
  }
};

/* ── Página ────────────────────────────────────────────────────────────── */
export default function HomeClient() {
  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
  } = api.customers.getDashboard.useQuery();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [now] = React.useState(() => Date.now());

  const campaigns = React.useMemo(
    () => dashboard?.campaigns ?? [],
    [dashboard],
  );
  const mostRecent = campaigns[0];

  /* Seleção inicial: competição mais recente (igual ao fluxo antigo) */
  React.useEffect(() => {
    if (!selectedId && mostRecent) setSelectedId(mostRecent.id);
  }, [mostRecent, selectedId]);

  const isAll = selectedId === ALL_ID;

  /* Agregado de "Todas as competições" */
  const aggregated = React.useMemo<Selection | null>(() => {
    if (!isAll || campaigns.length === 0 || !mostRecent) return null;

    const sum = (pick: (campaign: Campaign) => number) =>
      campaigns.reduce((total, campaign) => total + pick(campaign), 0);

    /* Plataformas e hashtags — união sem repetição */
    const platforms = Array.from(
      new Set(campaigns.flatMap((campaign) => campaign.platforms)),
    );
    const requiredHashtags = Array.from(
      new Set(campaigns.flatMap((campaign) => campaign.requiredHashtags)),
    );

    /* Views por plataforma — soma entre competições */
    const platformMap = new Map<string, Selection["platformStats"][number]>();
    for (const campaign of campaigns) {
      for (const stat of campaign.platformStats) {
        const entry = platformMap.get(stat.platform);
        if (entry) {
          entry.totalViews += stat.totalViews;
          entry.totalLikes += stat.totalLikes;
          entry.totalComments += stat.totalComments;
          entry.totalShares += stat.totalShares;
          entry.postsCount += stat.postsCount;
        } else {
          platformMap.set(stat.platform, { ...stat });
        }
      }
    }

    /*
     * Crescimento: o growthData de cada competição é ACUMULADO, então
     * converte para deltas diários, soma por data/plataforma e reacumula na
     * união das datas — assim a curva da marca nunca cai quando uma
     * competição termina.
     */
    const growthPlatforms = Array.from(
      new Set(campaigns.flatMap((campaign) => campaign.growthPlatforms)),
    ).sort();

    const dailyByDate = new Map<string, Record<string, number>>();
    for (const campaign of campaigns) {
      const previous: Record<string, number> = {};
      const keys = ["total", ...campaign.growthPlatforms];
      for (const point of campaign.growthData) {
        const date = growthDate(point);
        if (!date) continue;
        const row = dailyByDate.get(date) ?? {};
        for (const key of keys) {
          const current = growthValue(point, key);
          const delta = Math.max(current - (previous[key] ?? 0), 0);
          row[key] = (row[key] ?? 0) + delta;
          previous[key] = current;
        }
        dailyByDate.set(date, row);
      }
    }

    const cumulative: Record<string, number> = { total: 0 };
    growthPlatforms.forEach((platform) => (cumulative[platform] = 0));

    const growthData: GrowthPoint[] = Array.from(dailyByDate.keys())
      .sort()
      .map((date) => {
        const row = dailyByDate.get(date) ?? {};
        const total = (cumulative.total ?? 0) + (row.total ?? 0);
        cumulative.total = total;
        const entry: GrowthPoint = { date, total };
        for (const platform of growthPlatforms) {
          const value = (cumulative[platform] ?? 0) + (row[platform] ?? 0);
          cumulative[platform] = value;
          entry[platform] = value;
        }
        return entry;
      });

    /* Top creators — mescla por plataforma + username */
    const accountMap = new Map<string, Campaign["topAccounts"][number]>();
    for (const campaign of campaigns) {
      for (const account of campaign.topAccounts) {
        const key = `${account.platform}-${account.username}`;
        const entry = accountMap.get(key);
        if (entry) {
          entry.totalViews += account.totalViews;
          entry.totalLikes += account.totalLikes;
          entry.totalComments += account.totalComments;
          entry.postsCount += account.postsCount;
        } else {
          accountMap.set(key, { ...account });
        }
      }
    }
    const topAccounts = Array.from(accountMap.values())
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5);

    /* Top vídeos — únicos por id */
    const postMap = new Map<string, Campaign["topPosts"][number]>();
    for (const campaign of campaigns) {
      for (const post of campaign.topPosts) {
        if (!postMap.has(post.id)) postMap.set(post.id, post);
      }
    }
    const topPosts = Array.from(postMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    const totalViews = sum((campaign) => campaign.totalViews);
    const totalLikes = sum((campaign) => campaign.totalLikes);
    const totalComments = sum((campaign) => campaign.totalComments);
    const totalShares = sum((campaign) => campaign.totalShares);
    /* Taxa ponderada por views — mesma fórmula usada por competição no router */
    const engagementRate =
      totalViews > 0
        ? ((totalLikes + totalComments + totalShares) / totalViews) * 100
        : 0;

    return {
      id: ALL_ID,
      name: "Todas as Competições",
      slug: ALL_ID,
      description: null,
      status: mostRecent.status,
      startDate: mostRecent.startDate,
      endDate: mostRecent.endDate,
      coverImageUrl: mostRecent.coverImageUrl,
      platforms,
      requiredHashtags,
      totalViews,
      totalPosts: sum((campaign) => campaign.totalPosts),
      totalLikes,
      totalComments,
      totalShares,
      engagementRate,
      recentViews: sum((campaign) => campaign.recentViews),
      growthData,
      growthPlatforms,
      platformStats: Array.from(platformMap.values()),
      topPosts,
      topAccounts,
    };
  }, [isAll, campaigns, mostRecent]);

  /* Competição única selecionada */
  const singleCampaign = React.useMemo(() => {
    if (isAll) return undefined;
    return (
      campaigns.find((campaign) => campaign.id === selectedId) ?? mostRecent
    );
  }, [isAll, campaigns, selectedId, mostRecent]);

  const selection = React.useMemo<Selection | null>(() => {
    if (isAll) return aggregated;
    if (!singleCampaign) return null;
    return {
      id: singleCampaign.id,
      name: singleCampaign.name,
      slug: singleCampaign.slug,
      description: singleCampaign.description,
      status: singleCampaign.status,
      startDate: singleCampaign.startDate,
      endDate: singleCampaign.endDate,
      coverImageUrl: singleCampaign.coverImageUrl,
      platforms: singleCampaign.platforms,
      requiredHashtags: singleCampaign.requiredHashtags,
      totalPosts: singleCampaign.totalPosts,
      totalViews: singleCampaign.totalViews,
      totalLikes: singleCampaign.totalLikes,
      totalComments: singleCampaign.totalComments,
      totalShares: singleCampaign.totalShares,
      engagementRate: singleCampaign.engagementRate,
      recentViews: singleCampaign.recentViews,
      growthData: toGrowthPoints(singleCampaign),
      growthPlatforms: singleCampaign.growthPlatforms,
      platformStats: singleCampaign.platformStats,
      topPosts: singleCampaign.topPosts,
      topAccounts: singleCampaign.topAccounts,
    };
  }, [isAll, aggregated, singleCampaign]);

  /* Ticker do hero — melhores thumbnails reais de toda a marca */
  const tickerClips = React.useMemo<TickerClip[]>(() => {
    const seen = new Set<string>();
    const clips: TickerClip[] = [];
    for (const campaign of campaigns) {
      for (const post of campaign.topPosts) {
        const thumbnail = post.thumbnailUrl;
        if (!thumbnail || thumbnail.trim() === "" || seen.has(thumbnail))
          continue;
        seen.add(thumbnail);
        clips.push({
          id: post.id,
          thumbnail,
          views: post.views,
          engagementRate:
            post.views > 0
              ? ((post.likes + post.comments + post.shares) / post.views) * 100
              : 0,
          username: post.username,
          platform: post.platform,
        });
      }
    }
    return clips.sort((a, b) => b.views - a.views).slice(0, 12);
  }, [campaigns]);

  /* Totais da marca — alimentam o hero */
  const brandTotals = React.useMemo(() => {
    const totals = campaigns.reduce(
      (acc, campaign) => ({
        views: acc.views + campaign.totalViews,
        posts: acc.posts + campaign.totalPosts,
        interactions:
          acc.interactions +
          campaign.totalLikes +
          campaign.totalComments +
          campaign.totalShares,
      }),
      { views: 0, posts: 0, interactions: 0 },
    );
    return {
      ...totals,
      engagement:
        totals.views > 0 ? (totals.interactions / totals.views) * 100 : 0,
    };
  }, [campaigns]);

  const interactions = selection
    ? selection.totalLikes + selection.totalComments + selection.totalShares
    : 0;
  const viewsPerPost =
    selection && selection.totalPosts > 0
      ? Math.floor(selection.totalViews / selection.totalPosts)
      : 0;

  const donutData = React.useMemo(
    () =>
      (selection?.platformStats ?? []).map((stat) => ({
        platform: stat.platform,
        views: stat.totalViews,
        posts: stat.postsCount,
        engagementRate:
          stat.totalViews > 0
            ? ((stat.totalLikes + stat.totalComments + stat.totalShares) /
                stat.totalViews) *
              100
            : 0,
      })),
    [selection],
  );

  /* Chave que re-dispara a coreografia de entrada ao trocar de competição */
  const selectionKey = selection?.id ?? "none";

  if (isLoading) return <HomeClientSkeleton />;

  if (isError) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <Warning className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                Não foi possível carregar seu painel
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                Houve uma falha ao buscar os dados das suas competições. Tente
                novamente em instantes.
              </p>
            </div>
            <Button
              variant="outline"
              className="cursor-pointer rounded-xl"
              onClick={() => void refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        </Reveal>
      </div>
    );
  }

  /* Sem competições vinculadas: nada de hero zerado — só a orientação. */
  if (campaigns.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-20 text-center">
            <span className="bg-gradient-custom flex size-12 items-center justify-center rounded-2xl text-[#04222A]">
              <Trophy className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                Nenhuma competição encontrada
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                Você ainda não possui competições vinculadas. Entre em contato
                com o administrador para vincular competições à sua conta.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da marca ===== */}
      <HomeHero
        eyebrow="Clipfy League · Painel da Marca"
        title={
          <>
            Sua marca em{" "}
            <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
              escala viral
            </span>
          </>
        }
        subtitle="Acompanhe em tempo real o desempenho das suas competições — views, vídeos, engajamento e os cortes que mais bombaram."
        viz={
          <ClipsHeroViz
            ticker={
              tickerClips.length > 0 ? (
                <HeroClipsTicker clips={tickerClips} />
              ) : undefined
            }
          />
        }
        stats={[
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views geradas",
            value: brandTotals.views,
            kind: "compact",
          },
          {
            icon: <FilmStrip className="size-3.5" weight="fill" />,
            label: "Vídeos publicados",
            value: brandTotals.posts,
            kind: "compact",
          },
          {
            icon: <Heart className="size-3.5" weight="fill" />,
            label: "Engajamento",
            value: brandTotals.engagement,
            kind: "percent",
          },
        ]}
      />

      <>
        {/* ===== Seletor de competição ===== */}
        <Reveal immediate delayMs={60}>
          <div className="glass-card flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <Trophy className="size-4" weight="fill" />
              </span>
              <div className="min-w-0 leading-tight">
                <h2 className="text-sm font-bold">Competição em análise</h2>
                <p className="text-muted-foreground truncate text-xs">
                  Todos os números abaixo seguem esta seleção
                </p>
              </div>
            </div>

            <Select
              value={selectedId ?? undefined}
              onValueChange={setSelectedId}
            >
              <SelectTrigger
                aria-label="Selecionar competição"
                className="h-11 w-full cursor-pointer rounded-xl sm:w-[300px] lg:w-[340px]"
              >
                <SelectValue placeholder="Selecione a competição" />
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl">
                {campaigns.length > 1 && (
                  <SelectItem value={ALL_ID} className="cursor-pointer">
                    <span className="flex items-center gap-2">
                      <ChartDonut
                        className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                        weight="fill"
                      />
                      <span className="font-semibold">
                        Todas as competições
                      </span>
                      <Badge
                        variant="outline"
                        className="border-brand-cyan/25 not-dark:border-primary/30 h-4 shrink-0 rounded-full px-1.5 text-[10px] font-bold tabular-nums"
                      >
                        <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                          {campaigns.length}
                        </span>
                      </Badge>
                    </span>
                  </SelectItem>
                )}
                {campaigns.map((campaign) => {
                  const status = statusOf(campaign.status);
                  return (
                    <SelectItem
                      key={campaign.id}
                      value={campaign.id}
                      className="cursor-pointer"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            status.dot,
                          )}
                        />
                        <span className="truncate">{campaign.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 shrink-0 rounded-full px-1.5 text-[10px] font-semibold",
                            status.badge,
                          )}
                        >
                          {status.label}
                        </Badge>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </Reveal>

        {selection && (
          <React.Fragment key={selectionKey}>
            {/* ===== Hero da competição selecionada ===== */}
            <Reveal immediate delayMs={120}>
              <CampaignSpotlight
                selection={selection}
                isAll={isAll}
                campaignCount={campaigns.length}
                now={now}
              />
            </Reveal>

            {/* ===== Métricas da seleção ===== */}
            <Reveal immediate delayMs={180}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricCard
                  accent="cyan"
                  icon={<Eye className="size-5" weight="fill" />}
                  label="Total de Views"
                  value={selection.totalViews}
                  hint={
                    <>
                      ~{formatCompact(viewsPerPost)} por vídeo ·{" "}
                      {isAll
                        ? `${campaigns.length} competições`
                        : selection.name}
                    </>
                  }
                />
                <MetricCard
                  accent="violet"
                  icon={<FilmStrip className="size-5" weight="fill" />}
                  label="Total de Vídeos"
                  value={selection.totalPosts}
                  hint="Conteúdos publicados na plataforma"
                />
                <MetricCard
                  accent="pink"
                  icon={<Heart className="size-5" weight="fill" />}
                  label="Engajamento"
                  value={selection.engagementRate}
                  kind="percent"
                  hint={`${formatCompact(interactions)} interações totais`}
                />
              </div>
            </Reveal>

            {/* ===== Crescimento + Resumo de engajamento ===== */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-7">
              <Reveal delayMs={60} className="min-w-0 lg:col-span-5">
                <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
                  <SectionHeading
                    icon={<ChartLineUp className="size-4" weight="fill" />}
                    title="Crescimento de Views"
                    description={
                      isAll
                        ? "Acumulado no período — toque numa rede para focar"
                        : "Acumulado durante a competição — toque numa rede para focar"
                    }
                  />
                  <ViewsGrowthChart
                    data={selection.growthData}
                    platforms={selection.growthPlatforms}
                  />
                </div>
              </Reveal>

              <Reveal delayMs={120} className="min-w-0 lg:col-span-2">
                <EngagementPanel selection={selection} />
              </Reveal>
            </div>

            {/* ===== Distribuição por plataforma + Top creators ===== */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              <Reveal className="min-w-0">
                <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
                  <SectionHeading
                    icon={<ChartDonut className="size-4" weight="fill" />}
                    title="Distribuição por Plataforma"
                    description="Views elegíveis por rede social"
                  />
                  <PlatformDonut data={donutData} />
                </div>
              </Reveal>

              <Reveal delayMs={60} className="min-w-0">
                <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
                  <SectionHeading
                    icon={<Crown className="size-4" weight="fill" />}
                    title="Top 5 Creators"
                    description="Contas com maior desempenho"
                  />
                  <CreatorsList accounts={selection.topAccounts} />
                </div>
              </Reveal>
            </div>

            {/* ===== Top 5 vídeos mais virais ===== */}
            <Reveal className="min-w-0">
              <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionHeading
                    icon={<Fire className="size-4" weight="fill" />}
                    title="Top 5 Vídeos Mais Virais"
                    description={
                      isAll
                        ? "Melhor desempenho entre todas as competições"
                        : "Melhor desempenho na competição"
                    }
                  />
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 cursor-pointer rounded-xl"
                  >
                    <Link
                      href={
                        isAll ? "/posts" : `/posts?campaignId=${selection.id}`
                      }
                    >
                      Ver todos
                      <CaretRight className="size-3.5" weight="bold" />
                    </Link>
                  </Button>
                </div>
                <ViralPostsGrid posts={selection.topPosts} />
              </div>
            </Reveal>

            {/* ===== Hashtags obrigatórias ===== */}
            {selection.requiredHashtags.length > 0 && (
              <Reveal className="min-w-0">
                <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:gap-5 sm:p-6">
                  <SectionHeading
                    icon={<Hash className="size-4" weight="bold" />}
                    title={
                      isAll
                        ? "Hashtags das Competições"
                        : "Hashtags da Competição"
                    }
                    description="Obrigatórias em todos os vídeos publicados"
                  />
                  <div className="flex flex-wrap gap-2">
                    {selection.requiredHashtags.map((hashtag, index) => (
                      <span
                        key={hashtag}
                        style={{ transitionDelay: `${index * 40}ms` }}
                        className="bg-gradient-custom inline-flex items-center rounded-full px-3 py-1.5 font-mono text-xs font-bold text-[#04222A] transition-transform duration-300 hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:text-sm"
                      >
                        #{hashtag.replace(/^#/, "")}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </React.Fragment>
        )}
      </>
    </div>
  );
}

/* ── Hero da competição selecionada ────────────────────────────────────── */
function CampaignSpotlight({
  selection,
  isAll,
  campaignCount,
  now,
}: {
  selection: Selection;
  isAll: boolean;
  campaignCount: number;
  now: number;
}) {
  const status = statusOf(selection.status);

  const start = new Date(selection.startDate).getTime();
  const end = new Date(selection.endDate).getTime();
  const hasWindow =
    Number.isFinite(start) && Number.isFinite(end) && end > start;
  const progress = hasWindow
    ? Math.min(Math.max(((now - start) / (end - start)) * 100, 0), 100)
    : 0;
  const daysLeft = hasWindow ? Math.ceil((end - now) / DAY_MS) : 0;
  const showProgress = !isAll && hasWindow && selection.status === "ACTIVE";

  /* Regra de negócio: janela fixa divulgada para esta competição */
  const period =
    selection.slug === "tarcisio-de-freitas-novembro"
      ? "10 de nov. às 00:00 — 09 de dez. às 23:59"
      : `${formatDateTime(selection.startDate)} — ${formatDateTime(selection.endDate)}`;

  return (
    <div className="glass-card relative overflow-hidden rounded-3xl p-4 sm:p-6 lg:p-8">
      {/* Glows da marca */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_10%,transparent)] blur-3xl"
      />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:gap-8">
        {/* Capa */}
        <div className="ring-brand-cyan/20 relative mx-auto aspect-square w-full max-w-[200px] shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-2 sm:max-w-[220px] lg:mx-0 lg:w-56 lg:max-w-none">
          {selection.coverImageUrl ? (
            <Image
              src={selection.coverImageUrl}
              alt={selection.name}
              fill
              sizes="(max-width: 1024px) 220px, 224px"
              className="object-cover transition-transform duration-500 hover:scale-[1.04] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#071321]">
              <Trophy className="size-16 text-white/25" weight="fill" />
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {isAll ? (
              <Badge
                variant="outline"
                className="border-brand-cyan/25 not-dark:border-primary/30 gap-1 rounded-full text-[11px] font-bold"
              >
                <ChartDonut className="size-3" weight="fill" />
                <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                  {campaignCount} competições
                </span>
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 rounded-full text-[11px] font-semibold",
                  status.badge,
                )}
              >
                <span className={cn("size-1.5 rounded-full", status.dot)} />
                {status.label}
              </Badge>
            )}

            {selection.platforms.map((platform) => {
              const config = platformConfig[platform as PlatformKey];
              if (!config) return null;
              const PlatformIcon = config.icon;
              return (
                <Badge
                  key={platform}
                  variant="outline"
                  className={cn(
                    "gap-1 rounded-full text-[11px] font-semibold",
                    config.borderColor,
                    config.bgColor,
                    config.color,
                    "not-dark:brightness-[0.75] not-dark:saturate-[1.3]",
                  )}
                >
                  <PlatformIcon className="size-3" />
                  {config.label}
                </Badge>
              );
            })}
          </div>

          {/* Nome */}
          <h2 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl lg:text-4xl">
            <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
              {selection.name}
            </span>
          </h2>

          {!isAll && selection.description && (
            <p className="text-muted-foreground line-clamp-3 max-w-3xl text-sm leading-relaxed sm:text-base">
              {selection.description}
            </p>
          )}

          {!isAll && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
              <CalendarBlank className="size-4 shrink-0" weight="fill" />
              <span className="min-w-0 truncate">{period}</span>
            </p>
          )}

          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-2.5">
            <QuickStat
              icon={<Eye className="size-4" weight="fill" />}
              value={selection.totalViews}
              label="views"
              className="border-[color-mix(in_oklab,var(--brand-cyan)_28%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] text-cyan-600 dark:text-[var(--brand-cyan)]"
            />
            <QuickStat
              icon={<FilmStrip className="size-4" weight="fill" />}
              value={selection.totalPosts}
              label="vídeos"
              className="border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
            />
            {selection.recentViews > 0 && (
              <QuickStat
                icon={<Fire className="size-4" weight="fill" />}
                value={selection.recentViews}
                label="views · 7 dias"
                prefix="+"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              />
            )}
          </div>

          {/* Progresso da competição ativa */}
          {showProgress && (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="text-muted-foreground flex items-center justify-between text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <Timer className="size-3.5" weight="fill" />
                  {progress >= 100
                    ? "Competição encerrada"
                    : `${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}`}
                </span>
                <span className="tabular-nums">{Math.round(progress)}%</span>
              </div>
              <div className="bg-muted/60 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981] motion-reduce:transition-none"
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  value,
  label,
  prefix,
  className,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  prefix?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2",
        className,
      )}
    >
      {icon}
      <span className="text-sm font-bold tabular-nums sm:text-base">
        {prefix}
        <CountUp value={value} kind="compact" />
      </span>
      <span className="text-muted-foreground text-[11px]">{label}</span>
    </span>
  );
}

/* ── Cards de métricas ─────────────────────────────────────────────────── */
const METRIC_ACCENTS = {
  cyan: {
    glow: "bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)]",
    chip: "bg-[color-mix(in_oklab,var(--brand-cyan)_15%,transparent)] text-cyan-600 dark:text-[var(--brand-cyan)]",
    value: "text-cyan-600 dark:text-[var(--brand-cyan)]",
  },
  violet: {
    glow: "bg-violet-500/10",
    chip: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
  },
  pink: {
    glow: "bg-pink-500/10",
    chip: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    value: "text-pink-600 dark:text-pink-400",
  },
} as const;

function MetricCard({
  accent,
  icon,
  label,
  value,
  kind = "compact",
  hint,
}: {
  accent: keyof typeof METRIC_ACCENTS;
  icon: React.ReactNode;
  label: string;
  value: number;
  kind?: "compact" | "percent";
  hint: React.ReactNode;
}) {
  const theme = METRIC_ACCENTS[accent];
  return (
    <div className="glass-card glass-card-hover group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-4 sm:p-5">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-12 -right-10 size-32 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-150 motion-reduce:transition-none",
          theme.glow,
        )}
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none",
            theme.chip,
          )}
        >
          {icon}
        </span>
      </div>
      <CountUp
        value={value}
        kind={kind}
        className={cn(
          "relative text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
          theme.value,
        )}
      />
      <p className="text-muted-foreground relative text-xs">{hint}</p>
    </div>
  );
}

/* ── Resumo de engajamento ─────────────────────────────────────────────── */
function EngagementPanel({ selection }: { selection: Selection }) {
  const viewsPerPost =
    selection.totalPosts > 0
      ? Math.floor(selection.totalViews / selection.totalPosts)
      : 0;

  const tiles = [
    {
      icon: <Heart className="size-4" weight="fill" />,
      value: selection.totalLikes,
      label: "Curtidas",
      className:
        "border-red-500/15 bg-red-500/5 text-red-600 dark:text-red-400",
    },
    {
      icon: <ChatCircle className="size-4" weight="fill" />,
      value: selection.totalComments,
      label: "Comentários",
      className:
        "border-emerald-500/15 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: <ShareNetwork className="size-4" weight="fill" />,
      value: selection.totalShares,
      label: "Compartilhamentos",
      className:
        "border-violet-500/15 bg-violet-500/5 text-violet-600 dark:text-violet-400",
    },
    {
      icon: <Eye className="size-4" weight="fill" />,
      value: viewsPerPost,
      label: "Views/Vídeo",
      className:
        "border-[color-mix(in_oklab,var(--brand-cyan)_20%,transparent)] bg-[color-mix(in_oklab,var(--brand-cyan)_6%,transparent)] text-cyan-600 dark:text-[var(--brand-cyan)]",
    },
  ];

  return (
    <div className="glass-card flex h-full flex-col gap-4 rounded-3xl p-4 sm:p-6">
      <SectionHeading
        icon={<Sparkle className="size-4" weight="fill" />}
        title="Engajamento"
        description="Métricas detalhadas"
      />

      {/* Taxa de engajamento */}
      <div className="rounded-2xl border border-pink-500/15 bg-gradient-to-r from-pink-500/10 to-transparent p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-semibold">
            Taxa de Engajamento
          </span>
          <Heart
            className="size-3.5 text-pink-600 dark:text-pink-400"
            weight="fill"
          />
        </div>
        <CountUp
          value={selection.engagementRate}
          kind="percent"
          className="text-2xl font-bold text-pink-600 tabular-nums sm:text-3xl dark:text-pink-400"
        />
        <div className="bg-muted/50 mt-2.5 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400 transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: `${Math.min(Math.max(selection.engagementRate * 10, 2), 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Grade de métricas */}
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              tile.className,
            )}
          >
            {tile.icon}
            <CountUp
              value={tile.value}
              kind="compact"
              className="text-lg font-bold tabular-nums sm:text-xl"
            />
            <span className="text-muted-foreground text-[10px] leading-tight">
              {tile.label}
            </span>
          </div>
        ))}
      </div>

      {/* Views recentes */}
      {selection.recentViews > 0 && (
        <div className="mt-auto flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-gradient-to-r from-emerald-500/10 to-transparent px-3 py-2.5">
          <TrendUp
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            weight="bold"
          />
          <span className="text-xs font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
            +<CountUp value={selection.recentViews} kind="compact" />
          </span>
          <span className="text-muted-foreground text-[11px]">
            nos últimos 7 dias
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Top creators ──────────────────────────────────────────────────────── */
function CreatorsList({ accounts }: { accounts: Campaign["topAccounts"] }) {
  if (accounts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <Crown className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">
          Nenhum criador encontrado
        </p>
      </div>
    );
  }

  const max = Math.max(...accounts.map((account) => account.totalViews), 1);

  return (
    <div className="flex flex-col gap-2">
      {accounts.map((account, index) => {
        const config = platformConfig[account.platform as PlatformKey];
        const PlatformIcon = config?.icon;
        const href = profileUrl(account.platform, account.username);
        const handle = account.username.startsWith("@")
          ? account.username
          : `@${account.username}`;
        const barPct = Math.max((account.totalViews / max) * 100, 3);

        const content = (
          <>
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-black tabular-nums transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none",
                index === 0
                  ? "bg-gradient-custom text-[#04222A]"
                  : index === 1
                    ? "bg-zinc-400/20 text-zinc-600 dark:text-zinc-300"
                    : index === 2
                      ? "bg-amber-700/20 text-amber-700 dark:text-amber-500"
                      : "bg-muted/60 text-muted-foreground",
              )}
            >
              #{index + 1}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-1.5">
                <span className="group-hover:text-brand-cyan not-dark:group-hover:text-primary truncate text-sm font-bold transition-colors">
                  {handle}
                </span>
                {href && (
                  <ArrowSquareOut className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </span>
              <span className="text-muted-foreground text-[11px]">
                {account.postsCount}{" "}
                {account.postsCount === 1 ? "vídeo" : "vídeos"} ·{" "}
                {formatCompact(account.totalViews)} views ·{" "}
                {formatCompact(account.totalLikes)} likes
              </span>
              <span className="bg-muted/50 h-1 w-full overflow-hidden rounded-full">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-[var(--brand-cyan)] to-[var(--brand-mint)] transition-[width] duration-700 ease-out not-dark:from-[#089eb8] not-dark:to-[#0eb981] motion-reduce:transition-none"
                  style={{ width: `${barPct}%` }}
                />
              </span>
            </span>

            {PlatformIcon && (
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  config.bgColor,
                )}
              >
                <PlatformIcon
                  className={cn(
                    "size-4",
                    config.color,
                    "not-dark:brightness-[0.75] not-dark:saturate-[1.3]",
                  )}
                />
              </span>
            )}
          </>
        );

        const rowClass =
          "group border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-brand-cyan/40 not-dark:hover:border-primary/40 flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-300 motion-reduce:transition-none";

        return href ? (
          <a
            key={`${account.platform}-${account.username}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir perfil de ${handle}${
              config?.label ? ` no ${config.label}` : ""
            }`}
            className={rowClass}
          >
            {content}
          </a>
        ) : (
          <div
            key={`${account.platform}-${account.username}`}
            className={rowClass}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

/* ── Top vídeos virais ─────────────────────────────────────────────────── */
function ViralPostsGrid({ posts }: { posts: Campaign["topPosts"] }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-muted/60 text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
          <FilmStrip className="size-6" weight="fill" />
        </span>
        <p className="text-muted-foreground text-sm">Nenhum vídeo encontrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {posts.map((post, index) => {
        const config = platformConfig[post.platform as PlatformKey];
        const PlatformIcon = config?.icon ?? Play;
        const handle = post.username.startsWith("@")
          ? post.username
          : `@${post.username}`;

        return (
          <a
            key={post.id}
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir vídeo de ${handle} ${
              config?.label ? `no ${config.label}` : "na plataforma"
            }`}
            className="group ring-border/60 hover:ring-brand-cyan/50 not-dark:hover:ring-primary/50 relative aspect-[9/16] overflow-hidden rounded-2xl ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {post.thumbnailUrl ? (
              <Image
                src={post.thumbnailUrl}
                alt={`Vídeo de ${handle}`}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transition-none"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#071321]">
                <Play className="size-10 text-white/40" weight="fill" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10 transition-opacity duration-300 group-hover:from-black/90" />

            {/* Posição */}
            <span
              className={cn(
                "absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-black shadow-md",
                index === 0
                  ? "from-yellow-400 to-amber-500 text-[#04222A]"
                  : index === 1
                    ? "from-zinc-300 to-zinc-400 text-[#04222A]"
                    : index === 2
                      ? "from-amber-600 to-amber-700 text-white"
                      : "from-zinc-700 to-zinc-800 text-white",
              )}
            >
              <Trophy className="size-2.5" weight="fill" />#{index + 1}
            </span>

            {/* Plataforma */}
            <span
              aria-hidden
              className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-full bg-black/45 backdrop-blur-md"
            >
              <PlatformIcon
                className={cn("size-3.5", config?.color ?? "text-white")}
              />
            </span>

            {/* Métricas */}
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-2.5">
              <p className="line-clamp-1 text-xs font-semibold text-white">
                {handle}
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-white/90">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" weight="fill" />
                  <span className="font-semibold tabular-nums">
                    {formatCompact(post.views)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3" weight="fill" />
                  <span className="font-semibold tabular-nums">
                    {formatCompact(post.likes)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ChatCircle className="size-3" weight="fill" />
                  <span className="font-semibold tabular-nums">
                    {formatCompact(post.comments)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShareNetwork className="size-3" weight="fill" />
                  <span className="font-semibold tabular-nums">
                    {formatCompact(post.shares)}
                  </span>
                </span>
              </div>
            </div>

            {/* Indicador de link externo */}
            <span className="absolute right-2.5 bottom-2.5 z-20 flex size-6 items-center justify-center rounded-lg border border-white/20 bg-white/15 text-white opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100">
              <ArrowSquareOut className="size-3" weight="bold" />
            </span>
          </a>
        );
      })}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────── */
function HomeClientSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HeroSkeleton stats={3} viz={<ClipsHeroVizSkeleton />} />

      {/* Seletor */}
      <div className="glass-card flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <div className="flex flex-col gap-1.5">
            <Bone delay={60} className="h-3.5 w-40" />
            <Bone delay={120} className="h-3 w-52" />
          </div>
        </div>
        <Bone delay={180} className="h-11 w-full rounded-xl sm:w-[300px]" />
      </div>

      {/* Hero da competição */}
      <div className="glass-card flex flex-col gap-5 rounded-3xl p-4 sm:p-6 lg:flex-row lg:gap-8 lg:p-8">
        <Bone className="mx-auto aspect-square w-full max-w-[200px] rounded-2xl sm:max-w-[220px] lg:mx-0 lg:w-56 lg:max-w-none" />
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Bone
                key={index}
                delay={index * 80}
                className="h-6 w-24 rounded-full"
              />
            ))}
          </div>
          <Bone delay={120} className="h-9 w-3/4 max-w-md" />
          <Bone delay={180} className="h-4 w-full max-w-2xl" />
          <Bone delay={220} className="h-4 w-1/2 max-w-sm" />
          <div className="flex flex-wrap gap-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Bone
                key={index}
                delay={260 + index * 60}
                className="h-10 w-32 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex flex-col gap-3 rounded-2xl p-4 sm:p-5"
          >
            <div className="flex items-center justify-between">
              <Bone delay={index * 100} className="h-3 w-28" />
              <Bone delay={index * 100 + 40} className="size-9 rounded-xl" />
            </div>
            <Bone delay={index * 100 + 80} className="h-8 w-32" />
            <Bone delay={index * 100 + 120} className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Gráfico + engajamento */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-7">
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 lg:col-span-5">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <Bone delay={60} className="h-4 w-48" />
          </div>
          <Bone
            delay={120}
            className="h-[240px] w-full rounded-2xl sm:h-[300px]"
          />
        </div>
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <Bone delay={60} className="h-4 w-32" />
          </div>
          <Bone delay={120} className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Bone
                key={index}
                delay={160 + index * 60}
                className="h-20 rounded-2xl"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Donut + creators */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <DonutSkeleton />
        <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Bone className="size-8 rounded-lg" />
            <Bone delay={60} className="h-4 w-36" />
          </div>
          <ListRowsSkeleton rows={5} />
        </div>
      </div>

      {/* Top vídeos */}
      <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Bone className="size-8 rounded-lg" />
          <Bone delay={60} className="h-4 w-52" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Bone
              key={index}
              delay={index * 90}
              className="aspect-[9/16] w-full rounded-2xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
