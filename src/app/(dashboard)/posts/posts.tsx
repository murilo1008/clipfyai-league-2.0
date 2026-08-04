"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import {
  ArrowsDownUp,
  Broom,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  ChatCircle,
  Clock,
  Eye,
  FilmSlate,
  Funnel,
  Heart,
  MagnifyingGlass,
  Play,
  ShareFat,
  Sparkle,
  TrendUp,
  Trophy,
  X,
} from "@phosphor-icons/react";

import { HomeHero } from "@/components/home/home-hero";
import { PostsMosaicHeroViz, PostsMosaicHeroVizSkeleton } from "@/components/posts/posts-mosaic-hero-viz";
import { CountUp, formatCompact } from "@/components/shared/count-up";
import { Reveal } from "@/components/shared/reveal";
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
import { platformConfig, type PlatformKey } from "@/lib/platform-config";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { PostMetricsHistoryDialog } from "./post-metrics-history-dialog";

type Platform = PlatformKey;
type OrderBy = "views" | "likes" | "comments" | "shares" | "createdAt";

const ORDER_OPTIONS: {
  value: OrderBy;
  label: string;
  icon: React.ElementType;
  iconClass: string;
}[] = [
  {
    value: "views",
    label: "Mais views",
    icon: Eye,
    iconClass: "text-cyan-600 dark:text-cyan-400",
  },
  {
    value: "likes",
    label: "Mais likes",
    icon: Heart,
    iconClass: "text-red-500 dark:text-red-400",
  },
  {
    value: "comments",
    label: "Mais comentários",
    icon: ChatCircle,
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "shares",
    label: "Mais shares",
    icon: ShareFat,
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  {
    value: "createdAt",
    label: "Mais recentes",
    icon: Clock,
    iconClass: "text-orange-600 dark:text-orange-400",
  },
];

/* Ouro / prata / bronze do pódio — texto escuro sobre fundos claros (ouro/prata)
   para contraste adequado; branco só no bronze, escuro o suficiente. */
const RANK_STYLES = [
  "from-yellow-400 via-amber-400 to-orange-500 text-[#04222A] shadow-[0_6px_18px_-4px_rgba(245,158,11,0.55)]",
  "from-slate-300 via-slate-400 to-slate-500 text-[#04222A] shadow-[0_6px_18px_-4px_rgba(148,163,184,0.5)]",
  "from-amber-600 via-amber-700 to-amber-800 text-white shadow-[0_6px_18px_-4px_rgba(180,83,9,0.5)]",
] as const;

export default function Posts() {
  const searchParams = useSearchParams();
  const [page, setPage] = React.useState(1);
  const [platform, setPlatform] = React.useState<"ALL" | Platform>("ALL");
  const [campaignId, setCampaignId] = React.useState<string | undefined>(
    undefined,
  );
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [orderBy, setOrderBy] = React.useState<OrderBy>("views");
  const [hasAutoSelected, setHasAutoSelected] = React.useState(false);
  const [metricsPostId, setMetricsPostId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const urlCampaignId = searchParams.get("campaignId");
    if (urlCampaignId) {
      setCampaignId(urlCampaignId);
      setHasAutoSelected(true);
    }
  }, [searchParams]);

  // Debounce da busca: o input continua controlado/responsivo, mas a query
  // só recebe o valor ~300ms depois da última tecla.
  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data: dashboard, isLoading: isLoadingDashboard } =
    api.customers.getDashboard.useQuery();

  const { data, isLoading, isFetching } = api.customers.getAllPosts.useQuery(
    {
      page,
      limit: 24,
      platform,
      status: "ELIGIBLE",
      campaignId,
      search: debouncedSearch || undefined,
      orderBy,
      orderDirection: "desc",
    },
    { placeholderData: keepPreviousData },
  );

  // Auto-seleciona a primeira competição do cliente (mesmo fluxo do original)
  React.useEffect(() => {
    if (data?.campaigns?.length && !hasAutoSelected && !campaignId) {
      setCampaignId(data.campaigns[0]!.id);
      setHasAutoSelected(true);
    }
  }, [data, hasAutoSelected, campaignId]);

  const heroTotals = (dashboard?.campaigns ?? []).reduce(
    (acc, campaign) => ({
      views: acc.views + campaign.totalViews,
      posts: acc.posts + campaign.totalPosts,
    }),
    { views: 0, posts: 0 },
  );

  const activeFilterCount = [platform !== "ALL", !!campaignId, !!search].filter(
    Boolean,
  ).length;

  const clearFilters = () => {
    setPlatform("ALL");
    setCampaignId(undefined);
    setHasAutoSelected(true);
    setSearch("");
    setPage(1);
  };

  const showRankBadges = orderBy !== "createdAt";
  const activeOrder =
    ORDER_OPTIONS.find((option) => option.value === orderBy) ??
    ORDER_OPTIONS[0]!;
  const ActiveOrderIcon = activeOrder.icon;

  const activeCampaignName = campaignId
    ? (data?.campaigns.find((campaign) => campaign.id === campaignId)?.name ??
      "Competição")
    : null;

  // Muda a cada página/filtro para re-disparar a cascata de entrada dos cards
  const gridKey = `${page}|${platform}|${campaignId ?? "all"}|${orderBy}|${debouncedSearch}`;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Posts"
        title={
          <>
            Todos os cortes da sua <span className="text-gradient">marca</span>
          </>
        }
        subtitle="Explore cada vídeo publicado nas suas competições — com métricas, ranking e histórico completo de crescimento."
        isLoading={isLoadingDashboard}
        viz={<PostsMosaicHeroViz />}
        vizSkeleton={<PostsMosaicHeroVizSkeleton />}
        stats={[
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views geradas",
            value: heroTotals.views,
            kind: "compact",
          },
          {
            icon: <Play className="size-3.5" weight="fill" />,
            label: "Cortes publicados",
            value: heroTotals.posts,
            kind: "compact",
          },
          {
            icon: <Trophy className="size-3.5" weight="fill" />,
            label: "Competições",
            value: dashboard?.campaigns.length ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== Filtros ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card relative flex flex-col gap-4 overflow-hidden rounded-3xl p-4 sm:p-5">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-12 size-44 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] blur-3xl"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <Funnel className="size-4" weight="fill" />
              </span>
              <div className="flex items-center gap-2 leading-tight">
                <h2 className="text-base font-bold tracking-tight sm:text-lg">
                  Filtros
                </h2>
                {activeFilterCount > 0 && (
                  <span className="border-brand-cyan/25 not-dark:border-primary/30 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5">
                    <span className="relative flex size-1.5">
                      <span className="bg-gradient-custom absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none" />
                      <span className="bg-gradient-custom relative inline-flex size-1.5 rounded-full" />
                    </span>
                    <span className="text-gradient text-[10px] font-bold tabular-nums not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                      {activeFilterCount}{" "}
                      {activeFilterCount === 1 ? "ativo" : "ativos"}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground h-9 cursor-pointer rounded-xl text-xs"
              >
                <Broom className="size-3.5" />
                Limpar tudo
              </Button>
            )}
          </div>

          <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Busca */}
            <div className="relative">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar @username..."
                aria-label="Buscar por username"
                className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10 transition-shadow"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  aria-label="Limpar busca"
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center transition-colors"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Plataforma */}
            <Select
              value={platform}
              onValueChange={(value) => {
                setPlatform(value as "ALL" | Platform);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                <Play className="text-muted-foreground mr-1 size-3.5" />
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  <span className="flex items-center gap-2">
                    <span className="bg-gradient-custom size-3.5 rounded-full" />
                    Todas as plataformas
                  </span>
                </SelectItem>
                {(Object.keys(platformConfig) as Platform[]).map((key) => {
                  const config = platformConfig[key];
                  const PlatformIcon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon
                          className={cn("size-3.5", config.color)}
                        />
                        {config.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Competição */}
            <Select
              value={campaignId ?? "ALL"}
              onValueChange={(value) => {
                setCampaignId(value === "ALL" ? undefined : value);
                setHasAutoSelected(true);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                <Trophy className="text-muted-foreground mr-1 size-3.5" />
                <SelectValue placeholder="Competição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as competições</SelectItem>
                {data?.campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Ordenação */}
            <Select
              value={orderBy}
              onValueChange={(value) => {
                setOrderBy(value as OrderBy);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                <ArrowsDownUp className="text-muted-foreground mr-1 size-3.5" />
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_OPTIONS.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <OptionIcon
                          className={cn("size-3.5", option.iconClass)}
                          weight="fill"
                        />
                        {option.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Chips dos filtros aplicados (removíveis) */}
          {activeFilterCount > 0 && (
            <div className="border-border/60 relative flex flex-wrap items-center gap-2 border-t pt-3.5">
              <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
                Aplicados
              </span>
              {platform !== "ALL" && (
                <FilterChip
                  key={`chip-platform-${platform}`}
                  icon={(() => {
                    const config = platformConfig[platform];
                    const PlatformIcon = config.icon;
                    return (
                      <PlatformIcon className={cn("size-3.5", config.color)} />
                    );
                  })()}
                  label={platformConfig[platform].label}
                  removeLabel={`Remover filtro de plataforma ${platformConfig[platform].label}`}
                  onRemove={() => {
                    setPlatform("ALL");
                    setPage(1);
                  }}
                />
              )}
              {campaignId && (
                <FilterChip
                  key={`chip-campaign-${campaignId}`}
                  icon={
                    <Trophy
                      className="size-3.5 text-amber-600 dark:text-amber-400"
                      weight="fill"
                    />
                  }
                  label={activeCampaignName ?? "Competição"}
                  removeLabel="Remover filtro de competição"
                  onRemove={() => {
                    setCampaignId(undefined);
                    setHasAutoSelected(true);
                    setPage(1);
                  }}
                />
              )}
              {search && (
                <FilterChip
                  key="chip-search"
                  icon={
                    <MagnifyingGlass className="text-muted-foreground size-3.5" />
                  }
                  label={`"${search}"`}
                  removeLabel="Remover busca"
                  onRemove={() => {
                    setSearch("");
                    setPage(1);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </Reveal>

      {/* ===== Grid de posts ===== */}
      {isLoading ? (
        <PostsGridSkeleton />
      ) : data && data.posts.length > 0 ? (
        <>
          <Reveal immediate delayMs={100}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-muted-foreground flex items-baseline gap-1.5 text-xs sm:text-sm">
                <CountUp
                  key={`total-${gridKey}-${data.total}`}
                  value={data.total}
                  kind="int"
                  durationMs={800}
                  className="text-gradient text-base font-bold tabular-nums not-dark:brightness-[0.7] not-dark:saturate-[1.4] sm:text-lg"
                />
                {data.total === 1 ? "corte encontrado" : "cortes encontrados"}
              </p>
              <div className="flex items-center gap-2">
                <span className="border-border/60 bg-muted/30 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold">
                  <ActiveOrderIcon
                    className={cn("size-3", activeOrder.iconClass)}
                    weight="fill"
                  />
                  {activeOrder.label}
                </span>
                {data.totalPages > 1 && (
                  <span className="border-border/60 bg-muted/30 text-muted-foreground rounded-full border px-2.5 py-1 text-[10px] font-semibold tabular-nums">
                    Página {data.currentPage} de {data.totalPages}
                  </span>
                )}
              </div>
            </div>
          </Reveal>

          {/* Refetch com dados anteriores em tela: dimming sutil no lugar do skeleton */}
          <div
            className={cn(
              "grid grid-cols-2 gap-3 transition-opacity duration-300 motion-reduce:transition-none sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6",
              isFetching && "pointer-events-none opacity-60",
            )}
            aria-busy={isFetching || undefined}
          >
            {data.posts.map((post, index) => (
              <Reveal
                key={`${gridKey}::${post.id}`}
                immediate
                delayMs={Math.min(index * 45, 620)}
                className="h-full"
              >
                <PostCard
                  post={post}
                  rank={
                    showRankBadges && index < 3 && page === 1 ? index : null
                  }
                  onOpenMetrics={() => setMetricsPostId(post.id)}
                />
              </Reveal>
            ))}
          </div>

          {/* Paginação */}
          {data.totalPages > 1 && (
            <Reveal immediate delayMs={160}>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  className="h-9 cursor-pointer rounded-xl transition-all hover:-translate-x-0.5 motion-reduce:transition-none"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  <CaretLeft className="size-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.min(5, data.totalPages) },
                    (_, index) => {
                      let pageNumber: number;
                      if (data.totalPages <= 5) {
                        pageNumber = index + 1;
                      } else if (page <= 3) {
                        pageNumber = index + 1;
                      } else if (page >= data.totalPages - 2) {
                        pageNumber = data.totalPages - 4 + index;
                      } else {
                        pageNumber = page - 2 + index;
                      }
                      const isActive = page === pageNumber;
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setPage(pageNumber)}
                          aria-label={`Ir para página ${pageNumber}`}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "size-9 cursor-pointer rounded-xl text-sm font-semibold tabular-nums transition-all duration-300 motion-reduce:transition-none",
                            isActive
                              ? "bg-gradient-custom scale-105 text-[#04222A] shadow-[0_8px_20px_-8px_rgba(20,247,254,0.55)]"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-105",
                          )}
                        >
                          {pageNumber}
                        </button>
                      );
                    },
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Próxima página"
                  className="h-9 cursor-pointer rounded-xl transition-all hover:translate-x-0.5 motion-reduce:transition-none"
                  onClick={() =>
                    setPage((current) => Math.min(data.totalPages, current + 1))
                  }
                  disabled={page === data.totalPages}
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <CaretRight className="size-4" />
                </Button>
              </div>
            </Reveal>
          )}
        </>
      ) : (
        <Reveal immediate>
          <div className="glass-card relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20">
            <div className="bg-grid-pattern pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_60%_at_50%_0%,black,transparent_75%)] opacity-40" />
            <span
              aria-hidden
              className="pointer-events-none absolute -top-16 right-[14%] size-48 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_10%,transparent)] blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-20 left-[10%] size-52 rounded-full bg-[color-mix(in_oklab,var(--brand-green)_9%,transparent)] blur-3xl"
            />

            <div className="animate-float relative">
              <span className="bg-gradient-custom flex size-16 items-center justify-center rounded-3xl text-[#04222A] shadow-[0_20px_45px_-14px_rgba(20,247,254,0.5)]">
                <FilmSlate className="size-8" weight="fill" />
              </span>
              <Sparkle
                aria-hidden
                className="not-dark:text-primary absolute -top-2 -right-3 size-4 animate-pulse text-[var(--brand-cyan)] motion-reduce:animate-none"
                weight="fill"
              />
              <Sparkle
                aria-hidden
                className="not-dark:text-primary absolute -bottom-1.5 -left-3 size-3 animate-pulse text-[var(--brand-green)] [animation-delay:600ms] motion-reduce:animate-none"
                weight="fill"
              />
            </div>

            <div className="relative">
              <p className="text-lg font-bold">Nenhum corte por aqui</p>
              <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm leading-relaxed">
                Não encontramos vídeos com os filtros atuais. Ajuste a busca ou
                limpe os filtros para ver todos os cortes das suas competições.
              </p>
            </div>

            <Button
              variant="outline"
              className="relative h-10 cursor-pointer rounded-xl"
              onClick={clearFilters}
            >
              <Broom className="size-4" />
              Limpar filtros
            </Button>
          </div>
        </Reveal>
      )}

      {/* ===== Dialog de histórico de métricas ===== */}
      <PostMetricsHistoryDialog
        postId={metricsPostId}
        open={!!metricsPostId}
        onOpenChange={(open) => {
          if (!open) setMetricsPostId(null);
        }}
      />
    </div>
  );
}

/* ── Chip de filtro ativo (removível) ──────────────────────────────────── */
function FilterChip({
  icon,
  label,
  removeLabel,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={removeLabel}
      title={removeLabel}
      className="group/chip animate-scale-in border-brand-cyan/25 not-dark:border-primary/30 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border bg-[color-mix(in_oklab,var(--brand-cyan)_5%,transparent)] px-3 text-xs font-semibold transition-all hover:border-red-400/50 hover:bg-red-500/10 motion-reduce:transition-none"
    >
      {icon}
      <span className="max-w-40 truncate">{label}</span>
      <X className="text-muted-foreground size-3 transition-colors group-hover/chip:text-red-600 dark:group-hover/chip:text-red-400" />
    </button>
  );
}

/* ── Card de post (9:16) ───────────────────────────────────────────────── */
interface PostCardData {
  id: string;
  url: string;
  thumbnail: string | null;
  platform: string;
  username: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

function PostCard({
  post,
  rank,
  onOpenMetrics,
}: {
  post: PostCardData;
  rank: number | null;
  onOpenMetrics: () => void;
}) {
  const router = useRouter();
  const config = platformConfig[post.platform as Platform];
  const PlatformIcon = config?.icon ?? Play;

  const engagementRate =
    post.views > 0
      ? ((post.likes + post.comments + post.shares) / post.views) * 100
      : null;

  const username = post.username.startsWith("@")
    ? post.username
    : `@${post.username}`;

  return (
    <div className="group ring-border/60 hover:ring-brand-cyan/60 not-dark:hover:ring-primary/50 relative block aspect-[9/16] overflow-hidden rounded-2xl ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      {/* Thumbnail */}
      {post.thumbnail ? (
        <Image
          src={post.thumbnail}
          alt={`Corte de ${username}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 17vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[#071321]">
          <span className="animate-float flex size-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
            <Play className="size-5 text-white/70" weight="fill" />
          </span>
        </div>
      )}

      {/* Overlay que intensifica no hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5 transition-opacity duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Brilho varrendo no hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden"
      />

      {/* Ranking (top 3) */}
      {rank !== null && (
        <span
          className={cn(
            "absolute top-2 left-2 z-20 inline-flex items-center gap-1 rounded-full bg-gradient-to-br px-2 py-1 text-[10px] font-black ring-1 ring-white/40 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none",
            RANK_STYLES[rank],
          )}
        >
          <Trophy className="size-2.5" weight="fill" />#{rank + 1}
        </span>
      )}

      {/* Plataforma */}
      <span className="absolute top-2 right-2 z-20 flex size-7 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/15 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none">
        <PlatformIcon
          className={cn("size-3.5", config?.color ?? "text-white")}
        />
      </span>

      {/* Ações — sobem com transição no hover (sempre visíveis no touch) */}
      <div className="absolute top-11 right-2 z-30 flex flex-col gap-1.5 lg:translate-y-2 lg:opacity-0 lg:transition-all lg:duration-300 lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:motion-reduce:transition-none">
        <button
          type="button"
          title="Histórico de métricas"
          aria-label="Ver histórico de métricas"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenMetrics();
          }}
          className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-black/40 text-white backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] hover:bg-white/25 motion-reduce:transition-none"
        >
          <ChartLineUp className="size-4" weight="bold" />
        </button>
        <button
          type="button"
          title="Ver detalhes"
          aria-label="Ver detalhes do post"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            router.push(`/posts/${post.id}`);
          }}
          className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-white/20 bg-black/40 text-white backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-[color-mix(in_oklab,var(--brand-cyan)_60%,transparent)] hover:bg-white/25 motion-reduce:transition-none"
        >
          <Eye className="size-4" weight="bold" />
        </button>
      </div>

      {/* Infos */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 p-2.5 sm:p-3">
        {/* Conta que publicou */}
        <p className="truncate text-xs font-bold text-white">{username}</p>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-white/90">
          <span className="inline-flex min-w-0 items-center gap-1">
            <Eye
              className="size-3 shrink-0 text-[var(--brand-cyan)]"
              weight="fill"
            />
            <span className="truncate font-semibold tabular-nums">
              {formatCompact(post.views)}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <Heart className="size-3 shrink-0 text-rose-400" weight="fill" />
            <span className="truncate font-semibold tabular-nums">
              {formatCompact(post.likes)}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <ChatCircle
              className="size-3 shrink-0 text-emerald-300"
              weight="fill"
            />
            <span className="truncate font-semibold tabular-nums">
              {formatCompact(post.comments)}
            </span>
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <ShareFat
              className="size-3 shrink-0 text-violet-300"
              weight="fill"
            />
            <span className="truncate font-semibold tabular-nums">
              {formatCompact(post.shares)}
            </span>
          </span>
        </div>

        {/* Engagement */}
        {engagementRate !== null && (
          <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 ring-1 ring-emerald-300/30 backdrop-blur-sm">
            <TrendUp className="size-2.5" weight="bold" />
            {engagementRate.toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}
            % ER
          </span>
        )}
      </div>

      {/* Stretched link: cobre o card inteiro, abaixo das ações (z-30) */}
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir post de ${username} em nova aba`}
        className="absolute inset-0 z-20 rounded-2xl"
      />
    </div>
  );
}

/* ── Skeleton do grid (espelha o card real) ────────────────────────────── */
function PostsGridSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="animate-fade-in-up ring-border/60 relative aspect-[9/16] overflow-hidden rounded-2xl ring-1"
            style={{ animationDelay: `${index * 45}ms` }}
          >
            {/* Shimmer de fundo */}
            <div className="from-muted/70 via-muted/30 to-muted/70 animate-shimmer absolute inset-0 bg-gradient-to-r bg-[length:200%_100%]" />

            {/* Badges fantasma */}
            {index < 3 && (
              <Skeleton className="absolute top-2 left-2 h-5 w-10 rounded-full" />
            )}
            <Skeleton className="absolute top-2 right-2 size-7 rounded-full" />

            {/* Infos fantasma */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-2.5 sm:p-3">
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-2.5 w-3/4 rounded-full" />
                  <Skeleton className="h-2 w-1/2 rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Skeleton className="h-2.5 w-10 rounded-full" />
                <Skeleton className="h-2.5 w-8 rounded-full" />
                <Skeleton className="h-2.5 w-9 rounded-full" />
                <Skeleton className="h-2.5 w-7 rounded-full" />
              </div>
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
