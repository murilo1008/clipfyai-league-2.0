"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  CalendarBlank,
  ChatCircle,
  Clock,
  Eye,
  Heart,
  MagnifyingGlass,
  Play,
  Plus,
  Pulse,
  ShareFat,
  Sparkle,
  Spinner,
  TrendUp,
  Trophy,
  VideoCamera,
} from "@phosphor-icons/react"

import { DarkScope } from "@/components/shared/dark-scope"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useMaskedCurrency } from "@/contexts/financial-visibility-context"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

import {
  EmptyState,
  formatNumber,
  IneligibilityReasonNotice,
} from "../../competitions/[slug]/shared"
import {
  getPlatformAccent,
  getPostEngagementRate,
  type CompetitionDetails,
  type MyPost,
} from "./shared"

const PLATFORM_TABS: PlatformKey[] = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "KWAI",
  "FACEBOOK",
]

/* ============================================================
   Card 9:16 de um post
   ============================================================ */

function PostCard({ post }: { post: MyPost }) {
  const { maskText } = useMaskedCurrency()
  const accent = getPlatformAccent(post.platform)
  const config = platformConfig[post.platform as PlatformKey]
  const PlatIcon = config?.icon
  const rankPosition = post.rankInCompetition || 0
  const isPending = post.status === "PENDING"
  const hasThumbnail = !!post.thumbnailUrl && post.thumbnailUrl.trim() !== ""
  const engagementRate = getPostEngagementRate(post)
  const hasEarnings = !!post.earnings && post.earnings !== "R$ 0,00"

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative aspect-[9/16] overflow-hidden rounded-xl border transition-all duration-300 hover:scale-[1.03] hover:shadow-xl",
        accent.card,
      )}
    >
      {isPending || !hasThumbnail ? (
        /* Placeholder "Processando..." / "Prévia indisponível" */
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br px-1",
            accent.pending,
          )}
        >
          {isPending ? (
            <Spinner
              aria-hidden
              className={cn(
                "mb-2 size-8 animate-spin motion-reduce:animate-none sm:size-10",
                accent.spinner,
              )}
            />
          ) : (
            <VideoCamera
              aria-hidden
              className="text-muted-foreground mb-2 size-8 sm:size-10"
            />
          )}
          <p className="text-muted-foreground text-[10px] font-medium sm:text-xs">
            {isPending ? "Processando..." : "Prévia indisponível"}
          </p>
          {isPending && (
            <Badge
              variant="outline"
              className="mt-2 gap-1 rounded-full text-[9px] sm:text-[10px]"
            >
              <Clock className="size-2.5" />
              Pendente
            </Badge>
          )}
          <IneligibilityReasonNotice
            status={post.status}
            reason={post.ineligibilityReason}
            className="mx-2 mt-3 self-stretch px-2 py-1.5"
          />
        </div>
      ) : (
        <>
          <Image
            src={post.thumbnailUrl}
            alt={`Post de @${post.username}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

          {/* Rank 1-10 (ouro/prata/bronze) */}
          {rankPosition > 0 && rankPosition <= 10 && (
            <div className="absolute top-2 left-2">
              <Badge
                className={cn(
                  "border-0 text-[9px] font-bold text-white shadow-lg sm:text-[10px]",
                  rankPosition === 1
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                    : rankPosition === 2
                      ? "bg-gradient-to-r from-gray-400 to-gray-500"
                      : rankPosition === 3
                        ? "bg-gradient-to-r from-orange-600 to-orange-700"
                        : accent.rank,
                )}
              >
                <Trophy className="mr-0.5 size-2.5 sm:size-3" weight="fill" />
                #{rankPosition}
              </Badge>
            </div>
          )}

          {/* Plataforma */}
          <div className="absolute top-2 right-2">
            <div className={cn("rounded-full p-1.5 shadow-lg sm:p-2", accent.chip)}>
              {PlatIcon && <PlatIcon className="size-3 text-white sm:size-3.5" />}
            </div>
          </div>

          {/* Conteúdo inferior */}
          <div className="absolute right-0 bottom-0 left-0 space-y-2 p-2.5 sm:p-3">
            {/* @username */}
            <div className="flex items-center gap-1.5">
              <div className={cn("rounded-full p-0.5", accent.chip)}>
                <div className="flex size-4 items-center justify-center rounded-full bg-black/30 sm:size-5">
                  <span className="text-[8px] font-bold text-white sm:text-[9px]">
                    {(post.username || "U").replace(/^@/, "").charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="line-clamp-1 text-[10px] font-semibold text-white sm:text-xs">
                @{(post.username || "usuário").replace(/^@/, "")}
              </p>
            </div>

            {/* Motivo da inelegibilidade / desqualificação */}
            <DarkScope className="contents">
              <IneligibilityReasonNotice
                status={post.status}
                reason={post.ineligibilityReason}
                className="my-2 border-red-400/50 bg-red-950/80 px-2 py-1.5 backdrop-blur-sm"
              />
            </DarkScope>

            {/* Métricas 2×2 */}
            <div className="grid grid-cols-2 gap-1.5 text-[9px] text-white/90 sm:gap-2 sm:text-[10px]">
              <div className="flex items-center gap-1">
                <Eye className="size-2.5 sm:size-3" weight="fill" />
                <span className="font-bold">{formatNumber(post.views)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="size-2.5 text-pink-400 sm:size-3" weight="fill" />
                <span className="font-bold">{formatNumber(post.likes)}</span>
              </div>
              <div className="flex items-center gap-1">
                <ChatCircle
                  className="size-2.5 text-blue-400 sm:size-3"
                  weight="fill"
                />
                <span className="font-bold">{formatNumber(post.comments)}</span>
              </div>
              <div className="flex items-center gap-1">
                <ShareFat
                  className="size-2.5 text-green-400 sm:size-3"
                  weight="fill"
                />
                <span className="font-bold">{formatNumber(post.shares || 0)}</span>
              </div>
            </div>

            {/* ER + ganhos */}
            <div className="flex items-center justify-between border-t border-white/20 pt-1">
              <div className="flex items-center gap-1 text-[9px] text-white/80 sm:text-[10px]">
                <TrendUp className="size-2.5 text-emerald-400 sm:size-3" weight="bold" />
                <span className="font-semibold">
                  {engagementRate.toFixed(1)}% ER
                </span>
              </div>
              {hasEarnings && (
                <Badge className="border-0 bg-emerald-500/90 px-1.5 py-0.5 text-[8px] font-bold text-white sm:text-[9px]">
                  {maskText(post.earnings)}
                </Badge>
              )}
            </div>
          </div>

          {/* Link externo no hover */}
          <div className="absolute right-2.5 bottom-2.5 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-full bg-white/20 p-1.5 backdrop-blur-sm">
              <ArrowSquareOut className="size-3 text-white sm:size-3.5" />
            </div>
          </div>
        </>
      )}
    </a>
  )
}

/* ============================================================
   Grid + CTA "Enviar Novo Post"
   ============================================================ */

const PAGE_SIZE = 24

function PostsGrid({
  posts,
  total,
  page,
  isLoading,
  onPageChange,
  onCreatePost,
  emptySubtitle,
}: {
  posts: MyPost[];
  total: number;
  page: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onCreatePost: () => void;
  emptySubtitle: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="bg-muted/30 aspect-[9/16] animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Play className="size-6" weight="fill" />}
          title="Nenhum post por aqui"
          subtitle={emptySubtitle}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Paginação dos posts"
          className="flex items-center justify-center gap-3"
        >
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground text-sm" aria-live="polite">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Próxima
          </Button>
        </nav>
      )}

      {/* CTA enviar mais posts */}
      <div className="glass-card flex flex-col items-center justify-center gap-3 rounded-3xl py-12 text-center sm:py-14">
        <span className="bg-gradient-custom flex size-14 items-center justify-center rounded-2xl text-[#04222A] sm:size-16">
          <Plus className="size-7 sm:size-8" weight="bold" />
        </span>
        <div className="px-4">
          <p className="text-lg font-bold sm:text-xl">Envie mais posts</p>
          <p className="text-muted-foreground mt-1 max-w-md text-xs sm:text-sm">
            Continue participando da competição enviando novos vídeos
          </p>
        </div>
        <Button
          size="lg"
          className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-6 font-semibold sm:h-11 sm:px-8"
          onClick={onCreatePost}
        >
          <Plus className="size-4 sm:size-5" weight="bold" />
          Enviar Novo Post
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
   Tab "Meus Posts"
   ============================================================ */

type StatusFilter = "all" | "PENDING" | "ELIGIBLE" | "INELIGIBLE" | "DISQUALIFIED"
type SortBy = "recent" | "views" | "engagement" | "earnings"

export function MyPostsTab({
  competition,
  onCreatePost,
}: {
  competition: CompetitionDetails
  onCreatePost: () => void
}) {
  const [platformTab, setPlatformTab] = React.useState("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const [dateFilter, setDateFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [sortBy, setSortBy] = React.useState<SortBy>("recent")

  /* Período sobre a data exibida do post (postedAt ou envio − 3h), no fuso
     do navegador — calculado quando o filtro muda (chave estável da query). */
  const timelineRange = React.useMemo(() => {
    if (dateFilter === "today") {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      return { timelineFrom: start, timelineTo: end }
    }
    if (dateFilter === "week") {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return { timelineFrom: weekAgo }
    }
    return {}
  }, [dateFilter])

  /* Página atual; volta para a 1ª quando aba/filtros mudam (sem render extra) */
  const filtersKey = [
    platformTab,
    debouncedSearch,
    dateFilter,
    statusFilter,
    sortBy,
  ].join("|")
  const [pageState, setPageState] = React.useState({ key: filtersKey, page: 1 })
  const page = pageState.key === filtersKey ? pageState.page : 1
  const setPage = (nextPage: number) =>
    setPageState({ key: filtersKey, page: nextPage })

  const platform = platformTab === "all" ? undefined : platformTab
  const { data, isLoading } = api.campaign.getMyCompetitionPosts.useQuery(
    {
      campaignId: competition.id,
      platform,
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      ...timelineRange,
      sortBy,
      page,
      pageSize: PAGE_SIZE,
    },
    {
      // Mantém a página anterior visível ao paginar/filtrar na mesma aba.
      placeholderData: (previousData, previousQuery) => {
        const previousInput = (
          previousQuery?.queryKey[1] as
            | { input?: { platform?: string } }
            | undefined
        )?.input
        return previousInput?.platform === platform ? previousData : undefined
      },
    },
  )

  /* Contadores das abas (todos os posts, sem filtros) */
  const countByPlatform = React.useMemo(
    () =>
      new Map(
        competition.myPostsByPlatform.map((group) => [
          group.platform as string,
          group.posts,
        ]),
      ),
    [competition.myPostsByPlatform],
  )

  const gridProps = {
    posts: data?.posts ?? [],
    total: data?.total ?? 0,
    page,
    isLoading: isLoading && !data,
    onPageChange: setPage,
    onCreatePost,
  }

  return (
    <Tabs value={platformTab} onValueChange={setPlatformTab} className="gap-4">
      {/* Sub-tabs por plataforma (scroll horizontal no mobile) */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList className="bg-muted/40 flex h-auto w-max gap-1 rounded-2xl p-1">
          <TabsTrigger
            value="all"
            className="cursor-pointer gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary/20 data-[state=active]:text-primary sm:px-4"
          >
            <Sparkle className="size-3.5" weight="fill" />
            Todos
            <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A] shadow-sm">
              {competition.postedVideoCount}
            </Badge>
          </TabsTrigger>
          {PLATFORM_TABS.map((platform) => {
            const config = platformConfig[platform]
            const accent = getPlatformAccent(platform)
            const PlatIcon = config.icon
            return (
              <TabsTrigger
                key={platform}
                value={platform}
                className={cn(
                  "cursor-pointer gap-1.5 rounded-full px-2.5 py-2 text-xs font-semibold whitespace-nowrap sm:px-4",
                  accent.tab,
                )}
              >
                <PlatIcon className="size-3.5" />
                <span className="hidden sm:inline">{config.label}</span>
                <Badge className="bg-gradient-custom border-0 px-1.5 py-0 text-[10px] font-bold text-[#04222A] shadow-sm">
                  {countByPlatform.get(platform) ?? 0}
                </Badge>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </div>

      {/* ===== Todos (com filtros) ===== */}
      <TabsContent value="all" className="flex flex-col gap-4">
        <div className="glass-card flex flex-col gap-2.5 rounded-3xl p-3.5 sm:gap-3 sm:p-4">
          <div className="relative">
            <MagnifyingGlass className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Buscar posts..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 rounded-xl pl-9 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-9 w-full cursor-pointer rounded-xl text-[11px] sm:h-10 sm:text-sm">
                <CalendarBlank className="size-3.5 shrink-0 sm:size-4" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-full cursor-pointer rounded-xl text-[11px] sm:h-10 sm:text-sm">
                <Pulse className="size-3.5 shrink-0 sm:size-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
                <SelectItem value="ELIGIBLE">Elegível</SelectItem>
                <SelectItem value="INELIGIBLE">Inelegível</SelectItem>
                <SelectItem value="DISQUALIFIED">Desqualificado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortBy)}
            >
              <SelectTrigger className="h-9 w-full cursor-pointer rounded-xl text-[11px] sm:h-10 sm:text-sm">
                <TrendUp className="size-3.5 shrink-0 sm:size-4" />
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="views">Mais views</SelectItem>
                <SelectItem value="engagement">Maior ER</SelectItem>
                <SelectItem value="earnings">Maiores ganhos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <PostsGrid
          {...gridProps}
          emptySubtitle="Ajuste os filtros ou envie seu primeiro post para vê-lo aqui"
        />
      </TabsContent>

      {/* ===== Sub-tabs por plataforma ===== */}
      {PLATFORM_TABS.map((platform) => (
        <TabsContent key={platform} value={platform}>
          <PostsGrid
            {...gridProps}
            emptySubtitle={`Você ainda não enviou posts no ${platformConfig[platform].label} para esta competição`}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
