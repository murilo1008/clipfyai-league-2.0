"use client"

import * as React from "react"
import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  ArrowBendUpLeft,
  ArrowSquareOut,
  ArrowsDownUp,
  CaretDown,
  ChartBar,
  ChatCircle,
  ChatCircleDots,
  Check,
  CheckCircle,
  Checks,
  CircleNotch,
  Clock,
  Crown,
  DotsThreeVertical,
  FunnelSimple,
  Heart,
  type Icon,
  MagnifyingGlass,
  PencilSimple,
  Prohibit,
  PushPin,
  ShieldCheck,
  ShieldSlash,
  ShieldWarning,
  Trash,
  TrendUp,
  Trophy,
  UsersThree,
  X,
  XCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { BlogCommentsHeroViz, BlogCommentsHeroVizSkeleton } from "@/components/blog/blog-comments-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import { Bone, ToolbarSkeleton } from "@/components/shared/skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

/* ========================================================================
   Tipos e configurações
   ======================================================================== */

type AdminComment =
  RouterOutputs["blog"]["getAdminComments"]["comments"][number]

type StatusKey = "APPROVED" | "PENDING" | "REJECTED" | "SPAM"
type FilterStatus = "ALL" | StatusKey
type SortKey = "recent" | "oldest" | "likes"
type BulkAction = "APPROVE" | "REJECT" | "SPAM" | "DELETE"

const COMMENT_STATUS_CONFIG: Record<
  StatusKey,
  {
    label: string
    icon: Icon
    badge: string
    dot: string
    ring: string
    tint: string
  }
> = {
  APPROVED: {
    label: "Aprovado",
    icon: ShieldCheck,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/30",
    tint: "",
  },
  PENDING: {
    label: "Pendente",
    icon: Clock,
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
    ring: "ring-amber-500/30",
    tint: "bg-amber-500/[0.04]",
  },
  REJECTED: {
    label: "Rejeitado",
    icon: ShieldSlash,
    badge: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-400",
    ring: "ring-red-500/30",
    tint: "",
  },
  SPAM: {
    label: "Spam",
    icon: ShieldWarning,
    badge:
      "border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-400",
    ring: "ring-orange-500/30",
    tint: "",
  },
}

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "PENDING", label: "Pendentes" },
  { value: "REJECTED", label: "Rejeitados" },
  { value: "SPAM", label: "Spam" },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "likes", label: "Mais curtidos" },
]

/** Página de comentários por requisição — paginação real com "Carregar mais". */
const PAGE_SIZE = 50

const relativeDate = (value: Date | string) =>
  formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })

const fullDate = (value: Date | string) =>
  format(new Date(value), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

const authorName = (comment: AdminComment) =>
  comment.author?.name ??
  comment.author?.email?.split("@")[0] ??
  "Anônimo"

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?"

/* ========================================================================
   Página
   ======================================================================== */

export default function BlogComments() {
  const utils = api.useUtils()

  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("ALL")
  const [filterPostId, setFilterPostId] = React.useState("all")
  const [sortBy, setSortBy] = React.useState<SortKey>("recent")
  const [pageCount, setPageCount] = React.useState(1)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = React.useState<BulkAction | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [deletingComment, setDeletingComment] =
    React.useState<AdminComment | null>(null)
  const [editingComment, setEditingComment] =
    React.useState<AdminComment | null>(null)
  const [editContent, setEditContent] = React.useState("")

  /* Busca com debounce — evita uma requisição por tecla. */
  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  /* Filtros/busca/ordenação mudaram: volta à primeira página e limpa seleção. */
  React.useEffect(() => {
    setPageCount(1)
    setSelectedIds(new Set())
  }, [search, filterStatus, filterPostId, sortBy])

  /* ===== Queries ===== */
  // Paginação real: uma query por página acumulada (offset), todas
  // revalidadas juntas nas invalidações das mutations.
  const pageQueries = api.useQueries((t) =>
    Array.from({ length: pageCount }, (_, index) =>
      t.blog.getAdminComments({
        status: filterStatus,
        search: search || undefined,
        postId: filterPostId !== "all" ? filterPostId : undefined,
        sortBy,
        limit: PAGE_SIZE,
        offset: index * PAGE_SIZE,
      }),
    ),
  )

  const { data: stats, isLoading: isLoadingStats } =
    api.blog.getCommentsStats.useQuery()
  const { data: posts } = api.blog.getPosts.useQuery()

  const firstPage = pageQueries[0]
  const lastPage = pageQueries[pageQueries.length - 1]
  const isLoadingComments = firstPage?.isPending ?? true
  const commentsError = pageQueries.find((query) => query.error)?.error ?? null
  const comments = pageQueries.flatMap((query) => query.data?.comments ?? [])
  const total = firstPage?.data?.total ?? 0
  const hasMore = lastPage?.data?.hasMore ?? false
  const isLoadingMore = pageCount > 1 && (lastPage?.isPending ?? false)

  /* ===== Mutations ===== */
  const updateStatus = api.blog.adminUpdateCommentStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!")
      void utils.blog.getAdminComments.invalidate()
      void utils.blog.getCommentsStats.invalidate()
      void utils.blog.getPosts.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
  })

  const editComment = api.blog.adminEditComment.useMutation({
    onSuccess: () => {
      toast.success("Comentário editado!")
      setEditingComment(null)
      setEditContent("")
      void utils.blog.getAdminComments.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
  })

  const deleteCommentMut = api.blog.adminDeleteComment.useMutation({
    onSuccess: () => {
      toast.success("Comentário excluído!")
      setIsDeleteOpen(false)
      setDeletingComment(null)
      void utils.blog.getAdminComments.invalidate()
      void utils.blog.getCommentsStats.invalidate()
      void utils.blog.getPosts.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
  })

  const togglePinned = api.blog.adminToggleCommentPinned.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.isPinned ? "Comentário fixado!" : "Comentário desfixado!",
      )
      void utils.blog.getAdminComments.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
  })

  const bulkAction = api.blog.adminBulkCommentAction.useMutation({
    onSuccess: (data) => {
      toast.success(`Ação aplicada em ${data.count} comentário(s)!`)
      setSelectedIds(new Set())
      setIsBulkDeleteOpen(false)
      void utils.blog.getAdminComments.invalidate()
      void utils.blog.getCommentsStats.invalidate()
      void utils.blog.getPosts.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
    onSettled: () => setBulkPending(null),
  })

  /* ===== Handlers ===== */
  const allSelected = comments.length > 0 && selectedIds.size === comments.length

  const handleSelectAll = () => {
    setSelectedIds(
      allSelected ? new Set() : new Set(comments.map((comment) => comment.id)),
    )
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkAction = (action: BulkAction) => {
    if (selectedIds.size === 0) return
    setBulkPending(action)
    bulkAction.mutate({ commentIds: Array.from(selectedIds), action })
  }

  const hasActiveFilters =
    search.length > 0 || filterStatus !== "ALL" || filterPostId !== "all"

  const pendingCount = stats?.pending ?? 0

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        {/* ===== Hero da moderação ===== */}
        <HomeHero
          eyebrow="Clipfy League · Blog"
          title={
            <>
              A <span className="text-gradient">moderação</span> dos comentários
            </>
          }
          subtitle="Modere e gerencie os comentários dos posts — aprove, rejeite, marque spam, fixe destaques e responda ao que a comunidade está falando."
          isLoading={isLoadingStats}
          viz={<BlogCommentsHeroViz />}
          vizSkeleton={<BlogCommentsHeroVizSkeleton />}
          stats={[
            {
              icon: <ChatCircleDots className="size-3.5" weight="fill" />,
              label: "Total",
              value: stats?.total ?? 0,
              kind: "int",
            },
            {
              icon: <Clock className="size-3.5" weight="fill" />,
              label: "Pendentes",
              value: pendingCount,
              kind: "int",
            },
            {
              icon: <ShieldCheck className="size-3.5" weight="fill" />,
              label: "Aprovados",
              value: stats?.approved ?? 0,
              kind: "int",
            },
          ]}
        />

        {/* ===== KPIs ===== */}
        <Reveal immediate>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            <StatTile
              icon={<ChatCircleDots className="size-4" weight="fill" />}
              label="Total"
              value={stats?.total ?? 0}
              kind="int"
              hint="comentários no blog"
              accent="gradient"
              gradientValue
              isLoading={isLoadingStats}
            />
            <StatTile
              icon={<ShieldCheck className="size-4" weight="fill" />}
              label="Aprovados"
              value={stats?.approved ?? 0}
              kind="int"
              hint="visíveis no blog"
              accent="green"
              isLoading={isLoadingStats}
            />
            <StatTile
              icon={<Clock className="size-4" weight="fill" />}
              label="Pendentes"
              value={pendingCount}
              kind="int"
              hint={pendingCount > 0 ? "aguardando moderação" : "tudo em dia"}
              accent="cyan"
              isLoading={isLoadingStats}
              className={cn(
                pendingCount > 0 && "ring-1 ring-amber-500/40",
              )}
            />
            <StatTile
              icon={<ShieldSlash className="size-4" weight="fill" />}
              label="Rejeitados"
              value={stats?.rejected ?? 0}
              kind="int"
              hint="fora do blog"
              accent="cyan"
              isLoading={isLoadingStats}
            />
            <StatTile
              icon={<ShieldWarning className="size-4" weight="fill" />}
              label="Spam"
              value={stats?.spam ?? 0}
              kind="int"
              hint="bloqueados"
              accent="green"
              isLoading={isLoadingStats}
            />
            <StatTile
              icon={<ArrowBendUpLeft className="size-4" weight="fill" />}
              label="Respostas"
              value={stats?.repliesCount ?? 0}
              kind="int"
              hint="em threads"
              accent="cyan"
              isLoading={isLoadingStats}
            />
            <StatTile
              icon={<TrendUp className="size-4" weight="fill" />}
              label="Hoje"
              value={stats?.today ?? 0}
              kind="int"
              hint="nas últimas horas"
              accent="green"
              isLoading={isLoadingStats}
            />
            <StatTile
              icon={<ChartBar className="size-4" weight="fill" />}
              label="Semana"
              value={stats?.thisWeek ?? 0}
              kind="int"
              hint="últimos 7 dias"
              accent="gradient"
              gradientValue
              isLoading={isLoadingStats}
            />
          </div>
        </Reveal>

        {/* ===== Rankings ===== */}
        <Reveal immediate delayMs={60}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Posts com mais comentários */}
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                  <Trophy className="size-4.5" weight="fill" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    Posts com mais comentários
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    Top 5 por volume de conversa
                  </p>
                </div>
              </div>

              {isLoadingStats ? (
                <RankingSkeleton avatar={false} />
              ) : stats?.topPosts && stats.topPosts.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {stats.topPosts.map((post, index) => (
                    <div
                      key={post.id}
                      className="border-border/60 bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors"
                    >
                      <MedalBadge index={index} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">
                          {post.title}
                        </p>
                        {post.category && (
                          <Badge
                            variant="outline"
                            className="mt-1 max-w-full truncate rounded-full text-[9px]"
                            style={{
                              backgroundColor: `${post.category.color ?? "#888888"}15`,
                              color: post.category.color ?? "#888888",
                              borderColor: `${post.category.color ?? "#888888"}40`,
                            }}
                          >
                            {post.category.title}
                          </Badge>
                        )}
                      </div>
                      <span className="text-brand-mint not-dark:text-primary inline-flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums">
                        <ChatCircleDots className="size-3.5" weight="fill" />
                        {post.commentsCount}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  icon={<ChatCircleDots className="size-5" weight="fill" />}
                  title="Nenhum post com comentários"
                  description="Os posts aparecem aqui assim que receberem conversas."
                />
              )}
            </div>

            {/* Quem mais comenta */}
            <div className="glass-card flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center gap-2.5">
                <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]">
                  <Crown className="size-4.5" weight="fill" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">Quem mais comenta</p>
                  <p className="text-muted-foreground truncate text-xs">
                    Top 5 da comunidade
                  </p>
                </div>
              </div>

              {isLoadingStats ? (
                <RankingSkeleton avatar />
              ) : stats?.topCommenters && stats.topCommenters.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {stats.topCommenters.map((commenter, index) => (
                    <div
                      key={commenter.userId}
                      className="border-border/60 bg-muted/20 hover:bg-muted/40 flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors"
                    >
                      <MedalBadge index={index} />
                      <Avatar className="size-8 shrink-0 rounded-xl">
                        <AvatarImage
                          src={commenter.imageUrl ?? undefined}
                          alt={commenter.name}
                        />
                        <AvatarFallback className="bg-gradient-custom rounded-xl text-[10px] font-bold text-[#04222A]">
                          {initials(commenter.name)}
                        </AvatarFallback>
                      </Avatar>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                        {commenter.name}
                      </p>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-rose-500 tabular-nums dark:text-rose-400">
                        <ChatCircle className="size-3.5" weight="fill" />
                        {commenter.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  icon={<UsersThree className="size-5" weight="fill" />}
                  title="Nenhum comentarista ainda"
                  description="Quando a comunidade comentar, o ranking aparece aqui."
                />
              )}
            </div>
          </div>
        </Reveal>

        {/* ===== Toolbar de filtros + ações em massa ===== */}
        <Reveal immediate delayMs={120}>
          {isLoadingComments ? (
            <ToolbarSkeleton buttons={3} />
          ) : (
            <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                {/* Busca */}
                <div className="relative min-w-0 flex-1">
                  <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Buscar por conteúdo, autor..."
                    className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput("")}
                      aria-label="Limpar busca"
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex lg:items-center">
                  {/* Status */}
                  <Select
                    value={filterStatus}
                    onValueChange={(value) =>
                      setFilterStatus(value as FilterStatus)
                    }
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl data-[size=default]:h-10 lg:w-40">
                      <span className="flex min-w-0 items-center gap-2">
                        <FunnelSimple
                          className="text-muted-foreground size-4 shrink-0"
                          weight="fill"
                        />
                        <SelectValue placeholder="Status" />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {STATUS_FILTERS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="cursor-pointer"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Post */}
                  <Select value={filterPostId} onValueChange={setFilterPostId}>
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl data-[size=default]:h-10 lg:w-52">
                      <span className="flex min-w-0 items-center gap-2">
                        <ChatCircleDots
                          className="text-muted-foreground size-4 shrink-0"
                          weight="fill"
                        />
                        <SelectValue placeholder="Todos os posts" />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="max-w-[min(20rem,90vw)] rounded-xl">
                      <SelectItem value="all" className="cursor-pointer">
                        Todos os posts
                      </SelectItem>
                      {posts?.map((post) => (
                        <SelectItem
                          key={post.id}
                          value={post.id}
                          className="cursor-pointer"
                        >
                          <span className="block max-w-[16rem] truncate">
                            {post.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Ordenação */}
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as SortKey)}
                  >
                    <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl data-[size=default]:h-10 lg:w-44">
                      <span className="flex min-w-0 items-center gap-2">
                        <ArrowsDownUp
                          className="text-muted-foreground size-4 shrink-0"
                          weight="bold"
                        />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="cursor-pointer"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Barra de ações em massa */}
              {selectedIds.size > 0 && (
                <div className="border-border/60 flex flex-col gap-2.5 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground text-xs">
                    <span className="text-foreground font-bold tabular-nums">
                      {selectedIds.size}
                    </span>{" "}
                    selecionado(s)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <BulkButton
                      icon={<ShieldCheck className="size-3.5" weight="fill" />}
                      label="Aprovar"
                      tone="emerald"
                      onClick={() => handleBulkAction("APPROVE")}
                      isPending={bulkPending === "APPROVE"}
                      disabled={bulkAction.isPending}
                    />
                    <BulkButton
                      icon={<ShieldSlash className="size-3.5" weight="fill" />}
                      label="Rejeitar"
                      tone="red"
                      onClick={() => handleBulkAction("REJECT")}
                      isPending={bulkPending === "REJECT"}
                      disabled={bulkAction.isPending}
                    />
                    <BulkButton
                      icon={<Prohibit className="size-3.5" weight="bold" />}
                      label="Spam"
                      tone="orange"
                      onClick={() => handleBulkAction("SPAM")}
                      isPending={bulkPending === "SPAM"}
                      disabled={bulkAction.isPending}
                    />
                    <BulkButton
                      icon={<Trash className="size-3.5" weight="fill" />}
                      label="Excluir"
                      tone="red"
                      onClick={() => setIsBulkDeleteOpen(true)}
                      isPending={bulkPending === "DELETE"}
                      disabled={bulkAction.isPending}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Reveal>

        {/* ===== Lista de comentários ===== */}
        {commentsError ? (
          <Reveal immediate>
            <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
              <span className="bg-destructive/10 text-destructive flex size-13 items-center justify-center rounded-2xl">
                <ShieldWarning className="size-6" weight="fill" />
              </span>
              <div>
                <p className="text-base font-bold">
                  Erro ao carregar comentários
                </p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                  {commentsError.message}
                </p>
              </div>
              <Button
                onClick={() => void utils.blog.getAdminComments.invalidate()}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                Tentar novamente
              </Button>
            </div>
          </Reveal>
        ) : isLoadingComments ? (
          <CommentsListSkeleton />
        ) : comments.length === 0 ? (
          <Reveal immediate>
            <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
              <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
                <ChatCircleDots className="size-6" weight="fill" />
              </span>
              <div>
                <p className="text-base font-bold">
                  Nenhum comentário encontrado
                </p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
                  {hasActiveFilters
                    ? "Tente ajustar os filtros de busca."
                    : "Os comentários aparecerão aqui quando seus leitores interagirem."}
                </p>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchInput("")
                    setFilterStatus("ALL")
                    setFilterPostId("all")
                    setSortBy("recent")
                  }}
                  className="cursor-pointer rounded-xl font-semibold"
                >
                  <X className="size-4" weight="bold" />
                  Limpar filtros
                </Button>
              )}
            </div>
          </Reveal>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* Cabeçalho da lista */}
            <div className="flex flex-wrap items-center gap-3 px-1">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Selecionar todos os comentários carregados"
                  className="cursor-pointer"
                />
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors"
                >
                  {allSelected ? "Limpar seleção" : "Selecionar todos"}
                </button>
              </div>
              <span className="text-muted-foreground ml-auto text-[10px] font-semibold tracking-[0.14em] uppercase tabular-nums">
                {comments.length} de {total} comentário(s)
              </span>
            </div>

            {comments.map((comment, index) => (
              <Reveal immediate key={comment.id} delayMs={(index % 8) * 50}>
                <CommentRow
                  comment={comment}
                  isSelected={selectedIds.has(comment.id)}
                  onToggleSelect={() => handleToggleSelect(comment.id)}
                  onUpdateStatus={(status) =>
                    updateStatus.mutate({ commentId: comment.id, status })
                  }
                  onEdit={() => {
                    setEditingComment(comment)
                    setEditContent(comment.content)
                  }}
                  onDelete={() => {
                    setDeletingComment(comment)
                    setIsDeleteOpen(true)
                  }}
                  onTogglePinned={() =>
                    togglePinned.mutate({ commentId: comment.id })
                  }
                  isUpdating={
                    updateStatus.isPending &&
                    updateStatus.variables?.commentId === comment.id
                  }
                  isPinning={
                    togglePinned.isPending &&
                    togglePinned.variables?.commentId === comment.id
                  }
                />
              </Reveal>
            ))}

            {/* Paginação real */}
            {hasMore && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPageCount((current) => current + 1)}
                  disabled={isLoadingMore}
                  className="h-10 cursor-pointer rounded-xl font-semibold"
                >
                  {isLoadingMore ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <CaretDown className="size-4" weight="bold" />
                      Carregar mais
                    </>
                  )}
                </Button>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  Mostrando {comments.length} de {total}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ===== AlertDialog "Excluir comentário" ===== */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash className="text-destructive size-5" weight="fill" />
                Excluir Comentário
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este comentário de{" "}
                <strong>
                  {deletingComment ? authorName(deletingComment) : "Anônimo"}
                </strong>
                ? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="flex flex-col gap-3">
              {(deletingComment?._count.replies ?? 0) > 0 && (
                <p className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
                  <ShieldWarning
                    className="mt-0.5 size-4 shrink-0"
                    weight="fill"
                  />
                  Este comentário possui{" "}
                  {deletingComment?._count.replies} resposta(s) que também serão
                  excluídas.
                </p>
              )}
              <p className="border-border/60 bg-muted/30 text-foreground/90 max-h-32 overflow-y-auto rounded-xl border px-3 py-2.5 text-sm italic">
                &ldquo;{deletingComment?.content.slice(0, 200)}
                {(deletingComment?.content.length ?? 0) > 200 ? "..." : ""}
                &rdquo;
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={deleteCommentMut.isPending}
                className="cursor-pointer rounded-xl"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deletingComment &&
                  deleteCommentMut.mutate({ commentId: deletingComment.id })
                }
                disabled={deleteCommentMut.isPending}
                className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
              >
                {deleteCommentMut.isPending ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash className="size-4" weight="fill" />
                    Excluir
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===== AlertDialog "Excluir selecionados" ===== */}
        <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash className="text-destructive size-5" weight="fill" />
                Excluir {selectedIds.size} comentário(s)
              </AlertDialogTitle>
              <AlertDialogDescription>
                Os comentários selecionados e todas as respostas vinculadas a
                eles serão excluídos permanentemente. Esta ação não pode ser
                desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={bulkAction.isPending}
                className="cursor-pointer rounded-xl"
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleBulkAction("DELETE")}
                disabled={bulkAction.isPending}
                className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
              >
                {bulkAction.isPending ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash className="size-4" weight="fill" />
                    Excluir
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ===== Dialog "Editar comentário" ===== */}
        <Dialog
          open={!!editingComment}
          onOpenChange={(open) => {
            if (!open) {
              setEditingComment(null)
              setEditContent("")
            }
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[90svh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
          >
            {/* Header */}
            <div className="border-border/60 relative shrink-0 border-b px-4 pt-4 pb-4 sm:px-6 sm:pt-5">
              <div
                aria-hidden
                className="bg-gradient-custom pointer-events-none absolute -top-24 -right-16 size-48 rounded-full opacity-10 blur-3xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-xl text-[#04222A] shadow-[0_8px_24px_-8px_var(--brand-cyan)] sm:size-11">
                    <PencilSimple className="size-5" weight="fill" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-lg font-bold tracking-tight sm:text-xl">
                      Editar{" "}
                      <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                        Comentário
                      </span>
                    </DialogTitle>
                    <DialogDescription className="truncate text-xs sm:text-sm">
                      Comentário de{" "}
                      {editingComment ? authorName(editingComment) : "Anônimo"}
                    </DialogDescription>
                  </div>
                </div>
                <DialogClose asChild>
                  <button
                    type="button"
                    aria-label="Fechar"
                    className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
                  >
                    <X className="size-4" weight="bold" />
                  </button>
                </DialogClose>
              </div>
            </div>

            {/* Corpo rolável */}
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
              <div className="flex flex-col gap-4">
                {editingComment?.post && (
                  <div className="border-border/60 bg-muted/25 flex items-center gap-2 rounded-xl border px-3 py-2">
                    <ChatCircleDots
                      className="text-muted-foreground size-4 shrink-0"
                      weight="fill"
                    />
                    <span className="text-muted-foreground min-w-0 truncate text-[11px]">
                      Post:{" "}
                      <span className="text-foreground font-semibold">
                        {editingComment.post.title}
                      </span>
                    </span>
                  </div>
                )}

                {editingComment?.parent && (
                  <div className="flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                    <ArrowBendUpLeft
                      className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
                      weight="bold"
                    />
                    <span className="text-muted-foreground min-w-0 truncate text-[11px]">
                      Em resposta a{" "}
                      <span className="text-foreground font-semibold">
                        {editingComment.parent.author?.name ?? "Anônimo"}
                      </span>
                      {" — "}
                      {editingComment.parent.content.slice(0, 60)}
                      {editingComment.parent.content.length > 60 ? "..." : ""}
                    </span>
                  </div>
                )}

                <Textarea
                  value={editContent}
                  onChange={(event) => setEditContent(event.target.value)}
                  maxLength={2000}
                  placeholder="Conteúdo do comentário..."
                  className="focus-visible:ring-brand-cyan/40 min-h-32 resize-none rounded-xl text-sm"
                />

                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-muted-foreground text-[11px] tabular-nums",
                      editContent.length > 1900 &&
                        "font-semibold text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {editContent.length}/2000 caracteres
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="border-border/60 flex shrink-0 flex-col gap-2.5 border-t px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingComment(null)
                  setEditContent("")
                }}
                disabled={editComment.isPending}
                className="h-10 cursor-pointer rounded-xl font-semibold"
              >
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  editingComment &&
                  editComment.mutate({
                    commentId: editingComment.id,
                    content: editContent.trim(),
                  })
                }
                disabled={
                  !editContent.trim() ||
                  editContent.trim() === editingComment?.content ||
                  editComment.isPending
                }
                className="btn-gradient-auth h-10 cursor-pointer rounded-xl font-semibold"
              >
                {editComment.isPending ? (
                  <>
                    <CircleNotch className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="size-4" weight="bold" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

/* ========================================================================
   Linha de comentário
   ======================================================================== */

function CommentRow({
  comment,
  isSelected,
  onToggleSelect,
  onUpdateStatus,
  onEdit,
  onDelete,
  onTogglePinned,
  isUpdating,
  isPinning,
}: {
  comment: AdminComment
  isSelected: boolean
  onToggleSelect: () => void
  onUpdateStatus: (status: StatusKey) => void
  onEdit: () => void
  onDelete: () => void
  onTogglePinned: () => void
  isUpdating: boolean
  isPinning: boolean
}) {
  const status =
    COMMENT_STATUS_CONFIG[comment.status as StatusKey] ??
    COMMENT_STATUS_CONFIG.PENDING
  const StatusIcon = status.icon
  const name = authorName(comment)

  const openPost = () => {
    if (!comment.post?.slug) return
    window.open(`/blog/${comment.post.slug}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div
      className={cn(
        "glass-card group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-3.5 transition-colors sm:p-4",
        isSelected
          ? "ring-brand-cyan/45 bg-brand-cyan/5 ring-1"
          : comment.isPinned
            ? "ring-1 ring-amber-500/30"
            : comment.status === "PENDING" && status.tint,
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Selecionar comentário de ${name}`}
          className="mt-1 shrink-0 cursor-pointer"
        />

        <Avatar className="size-9 shrink-0 rounded-xl">
          <AvatarImage
            src={comment.author?.imageUrl ?? undefined}
            alt={name}
          />
          <AvatarFallback className="bg-gradient-custom rounded-xl text-[11px] font-bold text-[#04222A]">
            {initials(name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Autor + badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="max-w-[10rem] truncate text-sm font-bold sm:max-w-[14rem]">
              {name}
            </span>

            <Badge
              variant="outline"
              className={cn("gap-1 rounded-full text-[9px]", status.badge)}
            >
              <StatusIcon className="size-2.5" weight="fill" />
              {status.label}
            </Badge>

            {comment.isPinned && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-amber-500/30 bg-amber-500/15 text-[9px] text-amber-600 dark:text-amber-400"
              >
                <PushPin className="size-2.5" weight="fill" />
                Fixado
              </Badge>
            )}

            {comment.parentId && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-sky-500/30 bg-sky-500/10 text-[9px] text-sky-600 dark:text-sky-400"
              >
                <ArrowBendUpLeft className="size-2.5" weight="bold" />
                Resposta
              </Badge>
            )}

            {comment.editedAt && (
              <span className="text-muted-foreground/70 text-[9px] italic">
                editado
              </span>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground ml-auto hidden shrink-0 cursor-default text-[10px] sm:block">
                  {relativeDate(comment.createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {fullDate(comment.createdAt)}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Contexto de resposta */}
          {comment.parent && (
            <p className="bg-muted/40 text-muted-foreground line-clamp-2 rounded-lg px-2 py-1 text-[10px]">
              <ArrowBendUpLeft
                className="mr-1 inline size-2.5 align-[-1px]"
                weight="bold"
              />
              Respondendo{" "}
              <span className="text-foreground/80 font-semibold">
                {comment.parent.author?.name ?? "Anônimo"}
              </span>
              {": "}
              <span className="italic">
                {comment.parent.content.slice(0, 80)}
                {comment.parent.content.length > 80 ? "..." : ""}
              </span>
            </p>
          )}

          {/* Conteúdo */}
          <p className="text-foreground/90 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Rodapé: post + métricas */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {comment.post && (
              <button
                type="button"
                onClick={openPost}
                className="text-muted-foreground hover:text-brand-cyan not-dark:hover:text-primary inline-flex min-w-0 cursor-pointer items-center gap-1.5 text-[10px] transition-colors"
              >
                <ArrowSquareOut className="size-2.5 shrink-0" weight="bold" />
                <span className="max-w-[12rem] truncate">
                  {comment.post.title}
                </span>
              </button>
            )}

            <span className="text-muted-foreground/40 hidden text-[10px] sm:inline">
              •
            </span>

            <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] tabular-nums">
              <Heart className="size-2.5 text-rose-500" weight="fill" />
              {comment.likesCount}
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] tabular-nums">
              <ArrowBendUpLeft
                className="size-2.5 text-sky-500"
                weight="bold"
              />
              {comment._count.replies}
            </span>

            <span className="text-muted-foreground ml-auto text-[10px] sm:hidden">
              {relativeDate(comment.createdAt)}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex shrink-0 items-center gap-1">
          {comment.status === "PENDING" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus("APPROVED")}
                    disabled={isUpdating}
                    aria-label="Aprovar comentário"
                    className="hidden size-8 cursor-pointer items-center justify-center rounded-lg text-emerald-500/60 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
                  >
                    {isUpdating ? (
                      <CircleNotch className="size-4 animate-spin" />
                    ) : (
                      <Checks className="size-4" weight="bold" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Aprovar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onUpdateStatus("REJECTED")}
                    disabled={isUpdating}
                    aria-label="Rejeitar comentário"
                    className="hidden size-8 cursor-pointer items-center justify-center rounded-lg text-red-500/60 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
                  >
                    <XCircle className="size-4" weight="fill" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Rejeitar</TooltipContent>
              </Tooltip>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Ações do comentário"
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
              >
                <DotsThreeVertical className="size-4" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                <PencilSimple className="size-4" weight="fill" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={onTogglePinned}
                disabled={isPinning}
              >
                {isPinning ? (
                  <CircleNotch className="size-4 animate-spin" />
                ) : (
                  <PushPin className="size-4" weight="fill" />
                )}
                {comment.isPinned ? "Desfixar" : "Fixar"}
              </DropdownMenuItem>
              {comment.post?.slug && (
                <DropdownMenuItem className="cursor-pointer" onClick={openPost}>
                  <ArrowSquareOut className="size-4" weight="bold" />
                  Ver no Blog
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {comment.status !== "APPROVED" && (
                <DropdownMenuItem
                  className="cursor-pointer text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                  onClick={() => onUpdateStatus("APPROVED")}
                >
                  <ShieldCheck className="size-4" weight="fill" />
                  Aprovar
                </DropdownMenuItem>
              )}
              {comment.status !== "PENDING" && (
                <DropdownMenuItem
                  className="cursor-pointer text-amber-600 focus:text-amber-600 dark:text-amber-400 dark:focus:text-amber-400"
                  onClick={() => onUpdateStatus("PENDING")}
                >
                  <Clock className="size-4" weight="fill" />
                  Marcar como Pendente
                </DropdownMenuItem>
              )}
              {comment.status !== "REJECTED" && (
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                  onClick={() => onUpdateStatus("REJECTED")}
                >
                  <ShieldSlash className="size-4" weight="fill" />
                  Rejeitar
                </DropdownMenuItem>
              )}
              {comment.status !== "SPAM" && (
                <DropdownMenuItem
                  className="cursor-pointer text-orange-600 focus:text-orange-600 dark:text-orange-400 dark:focus:text-orange-400"
                  onClick={() => onUpdateStatus("SPAM")}
                >
                  <Prohibit className="size-4" weight="bold" />
                  Marcar como Spam
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={onDelete}
              >
                <Trash className="size-4" weight="fill" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   Auxiliares de UI
   ======================================================================== */

function BulkButton({
  icon,
  label,
  tone,
  onClick,
  isPending,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  tone: "emerald" | "red" | "orange"
  onClick: () => void
  isPending: boolean
  disabled: boolean
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 cursor-pointer rounded-xl px-2.5 text-[11px] font-semibold",
        tone === "emerald" &&
          "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400",
        tone === "red" &&
          "border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400",
        tone === "orange" &&
          "border-orange-500/30 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-400",
      )}
    >
      {isPending ? <CircleNotch className="size-3.5 animate-spin" /> : icon}
      {label}
    </Button>
  )
}

function MedalBadge({ index }: { index: number }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black tabular-nums",
        index === 0 && "bg-amber-500/20 text-amber-600 dark:text-amber-400",
        index === 1 && "bg-zinc-400/20 text-zinc-600 dark:text-zinc-300",
        index === 2 && "bg-orange-600/20 text-orange-600 dark:text-orange-400",
        index > 2 && "bg-muted/60 text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  )
}

function EmptyBlock({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="border-border/60 flex flex-col items-center gap-2.5 rounded-2xl border border-dashed px-4 py-10 text-center">
      <span className="bg-muted/60 text-muted-foreground flex size-10 items-center justify-center rounded-xl">
        {icon}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-xs text-xs">{description}</p>
    </div>
  )
}

/* ========================================================================
   Skeletons — espelham o layout real (sem layout shift)
   ======================================================================== */

function RankingSkeleton({ avatar }: { avatar: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="border-border/60 bg-muted/20 flex items-center gap-3 rounded-2xl border px-3 py-2.5"
        >
          <Bone delay={index * 90} className="size-6 shrink-0 rounded-full" />
          {avatar && (
            <Bone delay={index * 90 + 40} className="size-8 shrink-0 rounded-xl" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Bone delay={index * 90 + 80} className="h-3 w-2/3 max-w-44" />
            {!avatar && (
              <Bone
                delay={index * 90 + 120}
                className="h-3 w-16 rounded-full"
              />
            )}
          </div>
          <Bone delay={index * 90 + 160} className="h-4 w-8 rounded-full" />
        </div>
      ))}
    </div>
  )
}

const SKELETON_ROWS = [
  { lines: 2, reply: false, quick: false },
  { lines: 1, reply: false, quick: true },
  { lines: 2, reply: true, quick: false },
  { lines: 1, reply: false, quick: false },
  { lines: 2, reply: false, quick: true },
  { lines: 1, reply: true, quick: false },
] as const

function CommentsListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Cabeçalho da lista */}
      <div className="flex items-center gap-3 px-1">
        <Bone className="size-4 rounded-[4px]" />
        <Bone delay={60} className="h-3 w-32 rounded-full" />
        <Bone delay={120} className="ml-auto h-3 w-28 rounded-full" />
      </div>

      {SKELETON_ROWS.map((row, index) => (
        <div
          key={index}
          className="glass-card flex flex-col gap-3 rounded-2xl p-3.5 sm:p-4"
        >
          <div className="flex items-start gap-2.5 sm:gap-3">
            <Bone
              delay={index * 110}
              className="mt-1 size-4 shrink-0 rounded-[4px]"
            />
            <Bone
              delay={index * 110 + 40}
              className="size-9 shrink-0 rounded-xl"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Bone delay={index * 110 + 80} className="h-4 w-24" />
                <Bone
                  delay={index * 110 + 120}
                  className="h-4 w-16 rounded-full"
                />
                {row.reply && (
                  <Bone
                    delay={index * 110 + 160}
                    className="h-4 w-16 rounded-full"
                  />
                )}
                <Bone
                  delay={index * 110 + 200}
                  className="ml-auto hidden h-3 w-20 rounded-full sm:block"
                />
              </div>

              {row.reply && (
                <Bone
                  delay={index * 110 + 240}
                  className="h-5 w-full max-w-sm rounded-lg"
                />
              )}

              <div className="flex flex-col gap-1.5">
                <Bone delay={index * 110 + 280} className="h-3.5 w-11/12" />
                {row.lines > 1 && (
                  <Bone delay={index * 110 + 320} className="h-3.5 w-3/5" />
                )}
              </div>

              <div className="flex items-center gap-3">
                <Bone
                  delay={index * 110 + 360}
                  className="h-3 w-32 rounded-full"
                />
                <Bone
                  delay={index * 110 + 400}
                  className="h-3 w-8 rounded-full"
                />
                <Bone
                  delay={index * 110 + 440}
                  className="h-3 w-8 rounded-full"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {row.quick && (
                <>
                  <Bone
                    delay={index * 110 + 480}
                    className="hidden size-8 rounded-lg sm:block"
                  />
                  <Bone
                    delay={index * 110 + 520}
                    className="hidden size-8 rounded-lg sm:block"
                  />
                </>
              )}
              <Bone delay={index * 110 + 560} className="size-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
