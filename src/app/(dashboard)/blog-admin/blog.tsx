"use client"

import * as React from "react"
import Image from "next/image"
import {
  Archive,
  ArrowLeft,
  ArrowSquareOut,
  ArrowsClockwise,
  BookOpen,
  CalendarBlank,
  CaretRight,
  ChatCircle,
  Check,
  CircleNotch,
  Clock,
  DotsThreeVertical,
  Eye,
  FileText,
  FloppyDisk,
  Globe,
  Heart,
  ImageSquare,
  Lightbulb,
  Lightning,
  ListBullets,
  MagicWand,
  MagnifyingGlass,
  Newspaper,
  PencilSimple,
  PushPin,
  Robot,
  ShareNetwork,
  ShieldWarning,
  Sparkle,
  SquaresFour,
  Star,
  Tag,
  Trash,
  TrendUp,
  User,
  X,
} from "@phosphor-icons/react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"

import { BlogPostsHeroViz, BlogPostsHeroVizSkeleton } from "@/components/blog/blog-posts-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { CountUp, formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  CardGridSkeleton,
  HeroSkeleton,
  StatTilesGridSkeleton,
  ToolbarSkeleton,
} from "@/components/shared/skeletons"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

/* ============================================================
   TIPOS
   ============================================================ */

type BlogPost = RouterOutputs["blog"]["getPosts"][number]
type BlogCategory = RouterOutputs["blog"]["getCategories"][number]
type TopicSuggestion = RouterOutputs["blog"]["generateTopicSuggestions"][number]
type PostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"

/* ============================================================
   STATUS CONFIG — badges translúcidos com dot, nas cores da marca
   ============================================================ */

const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  PUBLISHED: {
    label: "Publicado",
    icon: Globe,
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-400",
  },
  DRAFT: {
    label: "Rascunho",
    icon: FileText,
    badge: "border-border bg-muted/60 text-muted-foreground",
    dot: "bg-zinc-400",
  },
  SCHEDULED: {
    label: "Agendado",
    icon: CalendarBlank,
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-400",
  },
  ARCHIVED: {
    label: "Arquivado",
    icon: Archive,
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-400",
  },
}

const STATUS_KEYS = Object.keys(STATUS_CONFIG) as PostStatus[]

const DEFAULT_CATEGORY_COLOR = "#22d3ee"

const relativeDate = (value: Date | string) =>
  formatDistanceToNow(new Date(value), { addSuffix: true, locale: ptBR })

const countWords = (text: string) =>
  text.trim() ? text.trim().split(/\s+/).length : 0

const readTimeFrom = (text: string) => Math.max(1, Math.ceil(countWords(text) / 200))

/* ============================================================
   PÁGINA
   ============================================================ */

export default function Blog() {
  const utils = api.useUtils()

  const {
    data: posts,
    isLoading: isLoadingPosts,
    error: postsError,
    refetch: refetchPosts,
  } = api.blog.getPosts.useQuery()
  const {
    data: stats,
    isLoading: isLoadingStats,
    error: statsError,
  } = api.blog.getPostsStats.useQuery()
  const { data: categories } = api.blog.getCategories.useQuery()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [filterStatus, setFilterStatus] = React.useState<string>("all")
  const [filterCategory, setFilterCategory] = React.useState<string>("all")
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [selectedPost, setSelectedPost] = React.useState<BlogPost | null>(null)
  const [featuringId, setFeaturingId] = React.useState<string | null>(null)
  const [pinningId, setPinningId] = React.useState<string | null>(null)
  const [isAIDialogOpen, setIsAIDialogOpen] = React.useState(false)
  const [isAIEditDialogOpen, setIsAIEditDialogOpen] = React.useState(false)
  const [editingPost, setEditingPost] = React.useState<BlogPost | null>(null)

  const toggleFeatured = api.blog.togglePostFeatured.useMutation({
    onSuccess: (data) => {
      toast.success(data.isFeatured ? "Post em destaque!" : "Destaque removido!")
      void utils.blog.getPosts.invalidate()
      void utils.blog.getPostsStats.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
    onSettled: () => setFeaturingId(null),
  })

  const togglePinned = api.blog.togglePostPinned.useMutation({
    onSuccess: (data) => {
      toast.success(data.isPinned ? "Post fixado!" : "Post desfixado!")
      void utils.blog.getPosts.invalidate()
      void utils.blog.getPostsStats.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
    onSettled: () => setPinningId(null),
  })

  const updateStatus = api.blog.updatePostStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!")
      void utils.blog.getPosts.invalidate()
      void utils.blog.getPostsStats.invalidate()
    },
    onError: (error) => toast.error("Erro", { description: error.message }),
  })

  const deletePost = api.blog.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post excluído com sucesso!")
      void utils.blog.getPosts.invalidate()
      void utils.blog.getPostsStats.invalidate()
      setIsDeleteOpen(false)
      setSelectedPost(null)
    },
    onError: (error) =>
      toast.error("Erro ao excluir", { description: error.message }),
  })

  const filteredPosts = React.useMemo(() => {
    if (!posts) return []
    const term = searchQuery.trim().toLowerCase()
    return posts.filter((post) => {
      const matchesSearch =
        !term ||
        post.title.toLowerCase().includes(term) ||
        post.slug.toLowerCase().includes(term) ||
        (post.excerpt ?? "").toLowerCase().includes(term) ||
        post.tags.some((tag) => tag.toLowerCase().includes(term))
      const matchesStatus = filterStatus === "all" || post.status === filterStatus
      const matchesCategory =
        filterCategory === "all" ||
        (filterCategory === "none" && !post.category) ||
        post.category?.id === filterCategory
      return matchesSearch && matchesStatus && matchesCategory
    })
  }, [posts, searchQuery, filterStatus, filterCategory])

  const hasFilters =
    searchQuery.trim() !== "" || filterStatus !== "all" || filterCategory !== "all"

  const handleOpenArticle = (slug: string) => {
    window.open(`/blog/${slug}`, "_blank", "noopener,noreferrer")
  }

  const handleEditAI = (post: BlogPost) => {
    setEditingPost(post)
    setIsAIEditDialogOpen(true)
  }

  const invalidatePosts = () => {
    void utils.blog.getPosts.invalidate()
    void utils.blog.getPostsStats.invalidate()
  }

  const engagement = (stats?.totalLikes ?? 0) + (stats?.totalComments ?? 0)

  /* ---------- erro ---------- */
  if (postsError ?? statsError) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-4 py-14 text-center sm:py-16">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <ShieldWarning className="size-6" weight="fill" />
            </span>
            <div className="max-w-md">
              <p className="text-base font-bold">Erro ao carregar posts</p>
              <p className="text-muted-foreground mt-1 text-sm break-words">
                {postsError?.message ??
                  statsError?.message ??
                  "Não foi possível carregar os dados do blog."}
              </p>
            </div>
            <Button
              onClick={() => void refetchPosts()}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              <ArrowsClockwise className="size-4" weight="bold" />
              Tentar novamente
            </Button>
          </div>
        </Reveal>
      </div>
    )
  }

  /* ---------- skeleton ---------- */
  if (isLoadingPosts || isLoadingStats) {
    return <BlogSkeleton />
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero ===== */}
      <HomeHero
        eyebrow="Clipfy League · Blog"
        title={
          <>
            Os <span className="text-gradient">posts</span> do blog
          </>
        }
        subtitle="Gerencie todos os posts do blog — crie, edite e acompanhe métricas."
        isLoading={isLoadingStats}
        viz={<BlogPostsHeroViz />}
        vizSkeleton={<BlogPostsHeroVizSkeleton />}
        stats={[
          {
            icon: <Newspaper className="size-3.5" weight="fill" />,
            label: "Posts",
            value: stats?.totalPosts ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Views totais",
            value: stats?.totalViews ?? 0,
            kind: "compact",
          },
          {
            icon: <Heart className="size-3.5" weight="fill" />,
            label: "Engajamento",
            value: engagement,
            kind: "compact",
          },
        ]}
      />

      {/* ===== KPIs grandes ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Newspaper className="size-4" weight="fill" />}
            label="Total de Posts"
            value={stats?.totalPosts ?? 0}
            kind="int"
            hint={`${stats?.publishedLast7 ?? 0} publicados na semana`}
            accent="gradient"
            gradientValue
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<Globe className="size-4" weight="fill" />}
            label="Publicados"
            value={stats?.publishedPosts ?? 0}
            kind="int"
            hint={`${stats?.draftPosts ?? 0} rascunhos · ${stats?.scheduledPosts ?? 0} agendados`}
            accent="green"
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Total de Views"
            value={stats?.totalViews ?? 0}
            kind="compact"
            hint={`~${formatCompact(stats?.avgViews ?? 0)} por post`}
            accent="cyan"
            gradientValue
            isLoading={isLoadingStats}
          />
          <StatTile
            icon={<TrendUp className="size-4" weight="fill" />}
            label="Engajamento Total"
            value={engagement}
            kind="compact"
            hint={`${formatCompact(stats?.totalLikes ?? 0)} likes · ${formatCompact(stats?.totalComments ?? 0)} comentários`}
            accent="cyan"
            isLoading={isLoadingStats}
          />
        </div>
      </Reveal>

      {/* ===== KPIs menores ===== */}
      <Reveal immediate delayMs={60}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <MiniStat
            icon={<Star className="size-4" weight="fill" />}
            label="Destaques"
            value={stats?.featuredPosts ?? 0}
            kind="int"
            accent="gradient"
            gradientValue
          />
          <MiniStat
            icon={<PushPin className="size-4" weight="fill" />}
            label="Fixados"
            value={stats?.pinnedPosts ?? 0}
            kind="int"
            accent="cyan"
          />
          <MiniStat
            icon={<Clock className="size-4" weight="fill" />}
            label="Tempo Médio"
            value={stats?.avgReadTime ?? 0}
            kind="int"
            suffix="min"
            accent="green"
          />
          <MiniStat
            icon={<ShareNetwork className="size-4" weight="fill" />}
            label="Compartilhamentos"
            value={stats?.totalShares ?? 0}
            kind="compact"
            accent="cyan"
          />
        </div>
      </Reveal>

      {/* ===== Toolbar ===== */}
      <Reveal immediate delayMs={120}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por título, slug, tag..."
              className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl pl-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-10 w-full min-w-0 cursor-pointer rounded-xl sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="cursor-pointer">
                  Todos os status
                </SelectItem>
                {STATUS_KEYS.map((status) => (
                  <SelectItem
                    key={status}
                    value={status}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          STATUS_CONFIG[status].dot,
                        )}
                      />
                      {STATUS_CONFIG[status].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-10 w-full min-w-0 cursor-pointer rounded-xl sm:w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="cursor-pointer">
                  Todas as categorias
                </SelectItem>
                <SelectItem value="none" className="cursor-pointer">
                  Sem categoria
                </SelectItem>
                {(categories ?? []).map((category) => (
                  <SelectItem
                    key={category.id}
                    value={category.id}
                    className="cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            category.color ?? DEFAULT_CATEGORY_COLOR,
                        }}
                      />
                      <span className="truncate">{category.title}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="border-border/70 bg-muted/30 flex h-10 items-center rounded-full border p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Ver em grade"
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                  viewMode === "grid"
                    ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <SquaresFour className="size-4" weight="fill" />
                <span className="hidden sm:inline">Grade</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="Ver em lista"
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                  viewMode === "list"
                    ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ListBullets className="size-4" weight="bold" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>

            <Button
              onClick={() => setIsAIDialogOpen(true)}
              className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl px-4 font-semibold sm:flex-none"
            >
              <MagicWand className="size-4" weight="fill" />
              Novo Post com IA
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Contador ===== */}
      {posts && (
        <p className="text-muted-foreground -mt-2 text-xs sm:-mt-4">
          Exibindo{" "}
          <span className="text-foreground font-semibold">
            {filteredPosts.length}
          </span>{" "}
          de{" "}
          <span className="text-foreground font-semibold">{posts.length}</span>{" "}
          posts
        </p>
      )}

      {/* ===== Grid / Lista ===== */}
      {filteredPosts.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-4 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <Newspaper className="size-6" weight="fill" />
            </span>
            <div className="max-w-sm">
              <p className="text-base font-bold">
                {hasFilters ? "Nenhum post encontrado" : "Nenhum post criado"}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {hasFilters
                  ? "Tente ajustar os filtros ou a busca."
                  : "Comece criando seu primeiro post para o blog."}
              </p>
            </div>
            {!hasFilters && (
              <Button
                onClick={() => setIsAIDialogOpen(true)}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                <MagicWand className="size-4" weight="fill" />
                Criar Primeiro Post com IA
              </Button>
            )}
          </div>
        </Reveal>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <Reveal immediate key={post.id} delayMs={(index % 3) * 80}>
              <PostCard
                post={post}
                onToggleFeatured={() => {
                  setFeaturingId(post.id)
                  toggleFeatured.mutate({ id: post.id })
                }}
                onTogglePinned={() => {
                  setPinningId(post.id)
                  togglePinned.mutate({ id: post.id })
                }}
                onUpdateStatus={(status) =>
                  updateStatus.mutate({ id: post.id, status })
                }
                onDelete={() => {
                  setSelectedPost(post)
                  setIsDeleteOpen(true)
                }}
                onOpenArticle={() => handleOpenArticle(post.slug)}
                onEditAI={() => handleEditAI(post)}
                isFeatureLoading={featuringId === post.id}
                isPinLoading={pinningId === post.id}
              />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPosts.map((post, index) => (
            <Reveal immediate key={post.id} delayMs={Math.min(index, 6) * 50}>
              <PostListItem
                post={post}
                onToggleFeatured={() => {
                  setFeaturingId(post.id)
                  toggleFeatured.mutate({ id: post.id })
                }}
                onTogglePinned={() => {
                  setPinningId(post.id)
                  togglePinned.mutate({ id: post.id })
                }}
                onUpdateStatus={(status) =>
                  updateStatus.mutate({ id: post.id, status })
                }
                onDelete={() => {
                  setSelectedPost(post)
                  setIsDeleteOpen(true)
                }}
                onOpenArticle={() => handleOpenArticle(post.slug)}
                onEditAI={() => handleEditAI(post)}
                isFeatureLoading={featuringId === post.id}
                isPinLoading={pinningId === post.id}
              />
            </Reveal>
          ))}
        </div>
      )}

      {/* ===== Exclusão ===== */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
                <Trash className="size-4.5" weight="fill" />
              </span>
              Excluir Post
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o post{" "}
              <strong className="text-foreground break-words">
                &quot;{selectedPost?.title}&quot;
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                selectedPost && deletePost.mutate({ id: selectedPost.id })
              }
              disabled={deletePost.isPending}
              className="cursor-pointer rounded-xl bg-red-500 text-white hover:bg-red-600"
            >
              {deletePost.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" weight="bold" />
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

      {/* ===== Dialogs de IA ===== */}
      <AIBlogDialog
        open={isAIDialogOpen}
        onOpenChange={setIsAIDialogOpen}
        categories={categories ?? []}
        onPostSaved={invalidatePosts}
      />

      {editingPost && (
        <AIEditPostDialog
          open={isAIEditDialogOpen}
          onOpenChange={(value) => {
            setIsAIEditDialogOpen(value)
            if (!value) setEditingPost(null)
          }}
          post={editingPost}
          onPostUpdated={invalidatePosts}
        />
      )}
    </div>
  )
}

/* ============================================================
   SKELETON — espelha o layout real (zero layout shift)
   ============================================================ */

function BlogSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <HeroSkeleton stats={3} viz={<BlogPostsHeroVizSkeleton />} />
      <StatTilesGridSkeleton count={4} className="grid-cols-1 sm:grid-cols-2" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="glass-card flex items-center gap-3 rounded-2xl p-3.5 sm:p-4"
          >
            <Bone delay={index * 90} className="size-9 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Bone delay={index * 90 + 60} className="h-5 w-14" />
              <Bone
                delay={index * 90 + 120}
                className="h-2.5 w-20 rounded-full"
              />
            </div>
          </div>
        ))}
      </div>
      <ToolbarSkeleton buttons={4} />
      <Bone className="h-3 w-40 rounded-full" />
      <CardGridSkeleton
        count={6}
        aspectClass="aspect-video"
        gridClass="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        withStats
      />
    </div>
  )
}

/* ============================================================
   MINI STAT — tiles menores da segunda faixa
   ============================================================ */

function MiniStat({
  icon,
  label,
  value,
  kind = "compact",
  suffix,
  accent = "gradient",
  gradientValue = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  kind?: "int" | "compact"
  suffix?: string
  accent?: "cyan" | "green" | "gradient"
  gradientValue?: boolean
}) {
  return (
    <div className="glass-card glass-card-hover flex items-center gap-3 rounded-2xl p-3.5 sm:p-4">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl text-[#04222A]",
          accent === "cyan" &&
            "bg-[var(--brand-cyan)] not-dark:bg-[#089eb8] not-dark:text-white",
          accent === "green" &&
            "bg-[var(--brand-green)] not-dark:bg-[#0eb981] not-dark:text-white",
          accent === "gradient" && "bg-gradient-custom",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="inline-flex items-baseline gap-1">
          <CountUp
            value={value}
            kind={kind}
            className={cn(
              "text-lg font-bold tabular-nums",
              gradientValue &&
                "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
            )}
          />
          {suffix && (
            <span className="text-muted-foreground text-[11px] font-medium">
              {suffix}
            </span>
          )}
        </span>
        <span className="text-muted-foreground truncate text-[10px] font-semibold tracking-[0.12em] uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}

/* ============================================================
   POST CARD (GRID)
   ============================================================ */

interface PostActions {
  post: BlogPost
  onToggleFeatured: () => void
  onTogglePinned: () => void
  onUpdateStatus: (status: PostStatus) => void
  onDelete: () => void
  onOpenArticle: () => void
  onEditAI: () => void
  isFeatureLoading: boolean
  isPinLoading: boolean
}

function PostCard({
  post,
  onToggleFeatured,
  onTogglePinned,
  onUpdateStatus,
  onDelete,
  onOpenArticle,
  onEditAI,
  isFeatureLoading,
  isPinLoading,
}: PostActions) {
  const status = STATUS_CONFIG[post.status as PostStatus] ?? STATUS_CONFIG.DRAFT
  const categoryColor = post.category?.color ?? DEFAULT_CATEGORY_COLOR

  return (
    <div className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl">
      {/* capa 16:9 */}
      <div className="relative aspect-video w-full overflow-hidden">
        {post.coverImageUrl ? (
          <Image
            src={post.coverImageUrl}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="dashboard-galaxy dark flex h-full w-full items-center justify-center">
            <Newspaper
              className="size-16 text-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]"
              weight="fill"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {post.isFeatured && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-amber-500/40 bg-amber-500/20 text-[10px] text-amber-300 backdrop-blur-md"
              >
                <Star className="size-2.5" weight="fill" />
                Destaque
              </Badge>
            )}
            {post.isPinned && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-sky-500/40 bg-sky-500/20 text-[10px] text-sky-300 backdrop-blur-md"
              >
                <PushPin className="size-2.5" weight="fill" />
                Fixado
              </Badge>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 gap-1.5 rounded-full backdrop-blur-md",
              status.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", status.dot)} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* corpo */}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {post.category && (
            <Badge
              variant="outline"
              className="gap-1 rounded-full text-[10px] font-semibold"
              style={{
                backgroundColor: `${categoryColor}22`,
                color: categoryColor,
                borderColor: `${categoryColor}55`,
              }}
            >
              <Tag className="size-2.5" weight="fill" />
              <span className="max-w-28 truncate">{post.category.title}</span>
            </Badge>
          )}
          {post.readTimeMinutes ? (
            <Badge
              variant="outline"
              className="text-muted-foreground gap-1 rounded-full text-[10px]"
            >
              <Clock className="size-2.5" weight="fill" />
              {post.readTimeMinutes} min
            </Badge>
          ) : null}
        </div>

        <div>
          <h3 className="line-clamp-2 text-[15px] leading-snug font-bold tracking-tight">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
              {post.excerpt}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {post.author?.imageUrl ? (
              <Image
                src={post.author.imageUrl}
                alt={post.author.name ?? "Autor"}
                width={20}
                height={20}
                className="size-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="bg-muted flex size-5 shrink-0 items-center justify-center rounded-full">
                <User className="text-muted-foreground size-3" weight="fill" />
              </span>
            )}
            <span className="text-muted-foreground truncate text-[11px]">
              {post.author?.name ?? post.author?.email?.split("@")[0] ?? "—"}
            </span>
          </span>
          <span className="text-muted-foreground shrink-0 text-[10px]">
            {relativeDate(post.publishedAt ?? post.createdAt)}
          </span>
        </div>

        <p className="text-muted-foreground/70 truncate font-mono text-[10px]">
          /{post.slug}
        </p>

        <div className="border-border/40 grid grid-cols-4 gap-2 border-t pt-3">
          <MetricCell
            icon={<Eye className="size-3" weight="fill" />}
            value={post.viewsCount}
            label="Views"
            color={categoryColor}
          />
          <MetricCell
            icon={<Heart className="size-3" weight="fill" />}
            value={post.likesCount}
            label="Likes"
            color={categoryColor}
          />
          <MetricCell
            icon={<ChatCircle className="size-3" weight="fill" />}
            value={post.commentsCount}
            label="Coment."
            color={categoryColor}
          />
          <MetricCell
            icon={<ShareNetwork className="size-3" weight="fill" />}
            value={post.sharesCount}
            label="Shares"
            color={categoryColor}
          />
        </div>

        <div className="mt-auto flex items-center justify-end gap-1 pt-1">
          <IconToggle
            active={post.isFeatured}
            loading={isFeatureLoading}
            onClick={onToggleFeatured}
            label={post.isFeatured ? "Remover destaque" : "Destacar"}
            activeClass="text-amber-500"
            icon={
              <Star
                className="size-4"
                weight={post.isFeatured ? "fill" : "regular"}
              />
            }
          />
          <IconToggle
            active={post.isPinned}
            loading={isPinLoading}
            onClick={onTogglePinned}
            label={post.isPinned ? "Desfixar" : "Fixar"}
            activeClass="text-sky-500"
            icon={
              <PushPin
                className="size-4"
                weight={post.isPinned ? "fill" : "regular"}
              />
            }
          />
          <PostActionsMenu
            post={post}
            onUpdateStatus={onUpdateStatus}
            onDelete={onDelete}
            onOpenArticle={onOpenArticle}
            onEditAI={onEditAI}
          />
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   POST LIST ITEM (LISTA)
   ============================================================ */

function PostListItem({
  post,
  onToggleFeatured,
  onTogglePinned,
  onUpdateStatus,
  onDelete,
  onOpenArticle,
  onEditAI,
  isFeatureLoading,
  isPinLoading,
}: PostActions) {
  const status = STATUS_CONFIG[post.status as PostStatus] ?? STATUS_CONFIG.DRAFT
  const categoryColor = post.category?.color ?? DEFAULT_CATEGORY_COLOR

  return (
    <div className="glass-card glass-card-hover group overflow-hidden rounded-3xl p-3.5 sm:p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* thumb */}
        <div className="hidden shrink-0 sm:block">
          {post.coverImageUrl ? (
            <div className="relative h-20 w-32 overflow-hidden rounded-2xl">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                sizes="128px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ) : (
            <div className="dashboard-galaxy dark flex h-20 w-32 items-center justify-center rounded-2xl">
              <Newspaper
                className="size-7 text-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]"
                weight="fill"
              />
            </div>
          )}
        </div>

        {/* conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("gap-1.5 rounded-full text-[10px]", status.badge)}
            >
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {status.label}
            </Badge>
            {post.category && (
              <Badge
                variant="outline"
                className="rounded-full text-[10px] font-semibold"
                style={{
                  backgroundColor: `${categoryColor}22`,
                  color: categoryColor,
                  borderColor: `${categoryColor}55`,
                }}
              >
                <span className="max-w-24 truncate">{post.category.title}</span>
              </Badge>
            )}
            {post.isFeatured && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-600 dark:text-amber-400"
              >
                <Star className="size-2.5" weight="fill" />
                Destaque
              </Badge>
            )}
            {post.isPinned && (
              <Badge
                variant="outline"
                className="gap-1 rounded-full border-sky-500/30 bg-sky-500/15 text-[10px] text-sky-600 dark:text-sky-400"
              >
                <PushPin className="size-2.5" weight="fill" />
                Fixado
              </Badge>
            )}
            {post.readTimeMinutes ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px]">
                <Clock className="size-2.5" weight="fill" />
                {post.readTimeMinutes} min
              </span>
            ) : null}
          </div>

          <h3 className="truncate text-sm font-bold tracking-tight">
            {post.title}
          </h3>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {post.author?.imageUrl ? (
                <Image
                  src={post.author.imageUrl}
                  alt={post.author.name ?? "Autor"}
                  width={16}
                  height={16}
                  className="size-4 shrink-0 rounded-full object-cover"
                />
              ) : (
                <User className="size-3 shrink-0" weight="fill" />
              )}
              <span className="max-w-28 truncate">
                {post.author?.name ?? post.author?.email?.split("@")[0] ?? "—"}
              </span>
            </span>
            <span aria-hidden>•</span>
            <span>{relativeDate(post.publishedAt ?? post.createdAt)}</span>
            <span className="text-muted-foreground/60 hidden max-w-[200px] truncate font-mono md:inline">
              /{post.slug}
            </span>
          </div>
        </div>

        {/* métricas desktop */}
        <div className="hidden items-center gap-5 lg:flex">
          <MetricPill
            icon={<Eye className="size-3" weight="fill" />}
            value={post.viewsCount}
            label="Views"
          />
          <MetricPill
            icon={<Heart className="size-3" weight="fill" />}
            value={post.likesCount}
            label="Likes"
          />
          <MetricPill
            icon={<ChatCircle className="size-3" weight="fill" />}
            value={post.commentsCount}
            label="Coment."
          />
          <MetricPill
            icon={<ShareNetwork className="size-3" weight="fill" />}
            value={post.sharesCount}
            label="Shares"
          />
        </div>

        {/* ações */}
        <div className="flex shrink-0 items-center gap-1">
          <IconToggle
            active={post.isFeatured}
            loading={isFeatureLoading}
            onClick={onToggleFeatured}
            label={post.isFeatured ? "Remover destaque" : "Destacar"}
            activeClass="text-amber-500"
            icon={
              <Star
                className="size-4"
                weight={post.isFeatured ? "fill" : "regular"}
              />
            }
          />
          <IconToggle
            active={post.isPinned}
            loading={isPinLoading}
            onClick={onTogglePinned}
            label={post.isPinned ? "Desfixar" : "Fixar"}
            activeClass="text-sky-500"
            className="hidden sm:inline-flex"
            icon={
              <PushPin
                className="size-4"
                weight={post.isPinned ? "fill" : "regular"}
              />
            }
          />
          <PostActionsMenu
            post={post}
            onUpdateStatus={onUpdateStatus}
            onDelete={onDelete}
            onOpenArticle={onOpenArticle}
            onEditAI={onEditAI}
            onTogglePinned={onTogglePinned}
            isPinLoading={isPinLoading}
          />
        </div>
      </div>

      {/* métricas mobile */}
      <div className="mt-3 grid grid-cols-4 gap-2 lg:hidden">
        <MetricCell
          icon={<Eye className="size-3" weight="fill" />}
          value={post.viewsCount}
          label="Views"
          color={categoryColor}
        />
        <MetricCell
          icon={<Heart className="size-3" weight="fill" />}
          value={post.likesCount}
          label="Likes"
          color={categoryColor}
        />
        <MetricCell
          icon={<ChatCircle className="size-3" weight="fill" />}
          value={post.commentsCount}
          label="Coment."
          color={categoryColor}
        />
        <MetricCell
          icon={<ShareNetwork className="size-3" weight="fill" />}
          value={post.sharesCount}
          label="Shares"
          color={categoryColor}
        />
      </div>
    </div>
  )
}

/* ============================================================
   PEÇAS COMPARTILHADAS DOS CARDS
   ============================================================ */

function MetricCell({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode
  value: number
  label: string
  color: string
}) {
  return (
    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-2">
      <span className="inline-flex items-center gap-1 text-[13px] font-bold tabular-nums">
        <span style={{ color }}>{icon}</span>
        <span>{formatCompact(value)}</span>
      </span>
      <span className="text-muted-foreground truncate text-[9px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

function MetricPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums">
        <span className="text-brand-mint not-dark:text-primary">{icon}</span>
        {formatCompact(value)}
      </span>
      <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

function IconToggle({
  active,
  loading,
  onClick,
  label,
  icon,
  activeClass,
  className,
}: {
  active: boolean
  loading: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
  activeClass: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={label}
      aria-label={label}
      className={cn(
        "hover:bg-muted/60 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors disabled:cursor-wait",
        active ? activeClass : "text-muted-foreground/60 hover:text-foreground",
        className,
      )}
    >
      {loading ? (
        <CircleNotch className="size-4 animate-spin" weight="bold" />
      ) : (
        icon
      )}
    </button>
  )
}

function PostActionsMenu({
  post,
  onUpdateStatus,
  onDelete,
  onOpenArticle,
  onEditAI,
  onTogglePinned,
  isPinLoading,
}: {
  post: BlogPost
  onUpdateStatus: (status: PostStatus) => void
  onDelete: () => void
  onOpenArticle: () => void
  onEditAI: () => void
  onTogglePinned?: () => void
  isPinLoading?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Ações do post"
          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors"
        >
          <DotsThreeVertical className="size-4" weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        <DropdownMenuItem className="cursor-pointer" onClick={onOpenArticle}>
          <ArrowSquareOut className="size-4" />
          Abrir Artigo
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={onEditAI}>
          <MagicWand className="size-4 text-rose-500" weight="fill" />
          Editar com IA
        </DropdownMenuItem>
        {onTogglePinned && (
          <DropdownMenuItem
            className="cursor-pointer sm:hidden"
            onClick={onTogglePinned}
            disabled={isPinLoading}
          >
            {isPinLoading ? (
              <CircleNotch className="size-4 animate-spin" weight="bold" />
            ) : (
              <PushPin className="size-4" weight="fill" />
            )}
            {post.isPinned ? "Desfixar" : "Fixar"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {post.status !== "PUBLISHED" && (
          <DropdownMenuItem
            className="cursor-pointer text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
            onClick={() => onUpdateStatus("PUBLISHED")}
          >
            <Globe className="size-4" weight="fill" />
            Publicar
          </DropdownMenuItem>
        )}
        {post.status !== "DRAFT" && (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onUpdateStatus("DRAFT")}
          >
            <FileText className="size-4" weight="fill" />
            Rascunho
          </DropdownMenuItem>
        )}
        {post.status !== "ARCHIVED" && (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onUpdateStatus("ARCHIVED")}
          >
            <Archive className="size-4" weight="fill" />
            Arquivar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-red-500 focus:text-red-500"
          onClick={onDelete}
        >
          <Trash className="size-4" weight="fill" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ============================================================
   MARKDOWN — preview com prose na paleta pedida
   ============================================================ */

function MarkdownView({
  content,
  accent,
}: {
  content: string
  accent: "rose" | "cyan"
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2",
        "prose-p:leading-relaxed prose-p:text-muted-foreground",
        "prose-strong:text-foreground prose-em:text-muted-foreground",
        "prose-pre:bg-card prose-pre:border prose-pre:border-border/30 prose-pre:rounded-xl",
        "prose-ul:text-muted-foreground prose-ol:text-muted-foreground prose-li:text-muted-foreground",
        "prose-img:rounded-xl prose-hr:border-border/30 prose-table:text-sm",
        "prose-th:text-foreground prose-th:font-semibold prose-th:border-border/40",
        "prose-td:border-border/30 prose-td:text-muted-foreground",
        accent === "rose"
          ? "prose-a:text-rose-500 hover:prose-a:underline prose-a:no-underline prose-code:text-rose-500 prose-code:bg-rose-500/10 prose-blockquote:border-l-rose-500 prose-blockquote:bg-rose-500/5 prose-li:marker:text-rose-500"
          : "prose-a:text-[var(--brand-cyan)] hover:prose-a:underline prose-a:no-underline prose-code:text-[var(--brand-cyan)] prose-code:bg-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] prose-blockquote:border-l-[var(--brand-cyan)] prose-blockquote:bg-[color-mix(in_oklab,var(--brand-cyan)_6%,transparent)] prose-li:marker:text-[var(--brand-cyan)]",
        "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:font-normal prose-code:before:content-[''] prose-code:after:content-['']",
        "prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}

/* ============================================================
   DIALOG DE IA — CRIAÇÃO
   ============================================================ */

type AIStep = "input" | "generating" | "review" | "editing" | "saving"

interface GeneratedPost {
  title: string
  slug: string
  excerpt: string
  content: string
  tags: string[]
  metaTitle: string
  metaDescription: string
  readTimeMinutes: number
  categoryId: string | null
  categoryTitle: string | null
  categoryColor: string | null
  coverImageUrl: string | null
}

function AIBlogDialog({
  open,
  onOpenChange,
  categories,
  onPostSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: BlogCategory[]
  onPostSaved: () => void
}) {
  const [step, setStep] = React.useState<AIStep>("input")
  const [prompt, setPrompt] = React.useState("")
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("")
  const [generatedPost, setGeneratedPost] = React.useState<GeneratedPost | null>(
    null,
  )
  const [editInstruction, setEditInstruction] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<TopicSuggestion[]>([])
  const [generationProgress, setGenerationProgress] = React.useState("")
  const [isGeneratingImage, setIsGeneratingImage] = React.useState(false)
  const [showPreview, setShowPreview] = React.useState(true)

  const generateSuggestions = api.blog.generateTopicSuggestions.useMutation({
    onSuccess: (data) => setSuggestions(data),
    onError: (error) =>
      toast.error("Erro ao gerar sugestões", { description: error.message }),
  })

  const generateImage = api.blog.generateBlogImage.useMutation({
    onSuccess: (data) => {
      setGeneratedPost((prev) =>
        prev ? { ...prev, coverImageUrl: data.imageUrl } : null,
      )
      setStep("review")
      setGenerationProgress("")
    },
    onError: (error) => {
      toast.error("Erro ao gerar imagem", { description: error.message })
      setStep("review")
      setGenerationProgress("")
    },
  })

  const generatePost = api.blog.generateBlogPost.useMutation({
    onSuccess: (data) => {
      setGeneratedPost({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        content: data.content,
        tags: data.tags,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        readTimeMinutes: data.readTimeMinutes,
        categoryId: data.categoryId,
        categoryTitle: data.categoryTitle,
        categoryColor: data.categoryColor,
        coverImageUrl: null,
      })
      setGenerationProgress("Gerando imagem de capa com IA...")
      generateImage.mutate({
        title: data.title,
        excerpt: data.excerpt,
        categoryTitle: data.categoryTitle ?? undefined,
        userPrompt: prompt.trim() || undefined,
      })
    },
    onError: (error) => {
      toast.error("Erro ao gerar post", { description: error.message })
      setStep("input")
      setGenerationProgress("")
    },
  })

  const editText = api.blog.editBlogText.useMutation({
    onSuccess: (data) => {
      setGeneratedPost((prev) =>
        prev
          ? {
              ...prev,
              content: data.content,
              readTimeMinutes: data.readTimeMinutes,
            }
          : null,
      )
      setEditInstruction("")
      setStep("review")
      toast.success("Texto editado com sucesso!")
    },
    onError: (error) => {
      toast.error("Erro ao editar texto", { description: error.message })
      setStep("review")
    },
  })

  const savePost = api.blog.saveAIGeneratedPost.useMutation({
    onSuccess: (data) => {
      // MELHORIA: o toast reflete o status real do post salvo.
      toast.success("Post criado com sucesso!", {
        description:
          data.status === "PUBLISHED"
            ? "O post foi publicado."
            : "O post foi salvo como rascunho.",
      })
      onPostSaved()
      handleReset()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error("Erro ao salvar post", { description: error.message })
      setStep("review")
    },
  })

  const handleReset = React.useCallback(() => {
    setStep("input")
    setPrompt("")
    setSelectedCategoryId("")
    setGeneratedPost(null)
    setEditInstruction("")
    setSuggestions([])
    setGenerationProgress("")
    setIsGeneratingImage(false)
    setShowPreview(true)
  }, [])

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Digite uma ideia para o blog")
      return
    }
    setStep("generating")
    setGenerationProgress("Gerando texto do artigo com IA...")
    generatePost.mutate({
      prompt: prompt.trim(),
      categoryId:
        selectedCategoryId && selectedCategoryId !== "auto"
          ? selectedCategoryId
          : undefined,
    })
  }

  const handleEdit = () => {
    if (!editInstruction.trim() || !generatedPost) return
    setStep("editing")
    editText.mutate({
      currentContent: generatedPost.content,
      editInstruction: editInstruction.trim(),
      title: generatedPost.title,
    })
  }

  const handleSave = (status: "DRAFT" | "PUBLISHED") => {
    if (!generatedPost) return
    setStep("saving")
    savePost.mutate({
      title: generatedPost.title,
      slug: generatedPost.slug,
      excerpt: generatedPost.excerpt,
      content: generatedPost.content,
      coverImageUrl: generatedPost.coverImageUrl ?? undefined,
      tags: generatedPost.tags,
      categoryId: generatedPost.categoryId ?? undefined,
      metaTitle: generatedPost.metaTitle,
      metaDescription: generatedPost.metaDescription,
      readTimeMinutes: generatedPost.readTimeMinutes,
      status,
    })
  }

  const handleRegenerateImage = () => {
    if (!generatedPost) return
    setIsGeneratingImage(true)
    generateImage.mutate(
      {
        title: generatedPost.title,
        excerpt: generatedPost.excerpt,
        categoryTitle: generatedPost.categoryTitle ?? undefined,
      },
      { onSettled: () => setIsGeneratingImage(false) },
    )
  }

  const handleSelectSuggestion = (title: string, categoryId?: string | null) => {
    setPrompt(title)
    if (categoryId) setSelectedCategoryId(categoryId)
  }

  const isGenerating = step === "generating"
  const isEditing = step === "editing"
  const isSaving = step === "saving"
  const isBusy = isGenerating || isSaving

  const stepTitle: Record<AIStep, string> = {
    input: "Criar Post com IA",
    generating: "Gerando Post...",
    review: "Revisar Post Gerado",
    editing: "Editando Texto...",
    saving: "Salvando Post...",
  }
  const stepDescription: Record<AIStep, string> = {
    input: "Descreva sua ideia ou selecione uma sugestão da IA",
    generating: generationProgress,
    review: "Revise o conteúdo, edite se necessário, e salve",
    editing: "A IA está editando o texto conforme suas instruções",
    saving: "Salvando o post no banco de dados...",
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (isBusy) return
        onOpenChange(value)
        if (!value) handleReset()
      }}
    >
      <DialogContent
        showCloseButton={!isBusy}
        className="flex h-[90vh] max-h-[90vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-5xl"
      >
        {/* header */}
        <div className="border-border/40 relative shrink-0 border-b px-4 py-4 sm:px-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-rose-500/10 via-transparent to-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/25 to-rose-500/10 text-rose-500">
                <MagicWand className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-bold sm:text-lg">
                  {stepTitle[step]}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {stepDescription[step]}
                </DialogDescription>
              </div>
            </div>

            {/* indicador de etapas */}
            <div className="mr-8 hidden shrink-0 items-center gap-1.5 sm:flex">
              {(["input", "generating", "review"] as const).map((item) => {
                const done =
                  step === item ||
                  (item === "input" && step !== "input") ||
                  (item === "generating" &&
                    (step === "review" || step === "editing" || step === "saving"))
                return (
                  <span
                    key={item}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      done
                        ? "bg-gradient-custom w-8"
                        : "bg-muted-foreground/25 w-1.5",
                    )}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* corpo */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* ---------- INPUT ---------- */}
          {step === "input" && (
            <div className="flex flex-col gap-6 p-4 sm:p-6">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Robot className="size-4 text-rose-500" weight="fill" />
                  Sua ideia para o blog
                </label>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ex: Como usar o algoritmo do TikTok para viralizar seus cortes nas redes sociais..."
                  className="min-h-[100px] resize-none rounded-2xl text-sm focus-visible:ring-rose-500/30"
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <Tag className="text-brand-cyan size-4" weight="fill" />
                  Categoria
                  <span className="text-muted-foreground text-xs font-normal">
                    (opcional — a IA pode inferir)
                  </span>
                </label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={setSelectedCategoryId}
                >
                  <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                    <SelectValue placeholder="Deixe a IA escolher automaticamente" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="auto" className="cursor-pointer">
                      IA escolhe automaticamente
                    </SelectItem>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        className="cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                category.color ?? DEFAULT_CATEGORY_COLOR,
                            }}
                          />
                          <span className="truncate">{category.title}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!prompt.trim()}
                className="btn-gradient-auth h-12 w-full cursor-pointer rounded-2xl text-sm font-semibold"
              >
                <MagicWand className="size-4" weight="fill" />
                Gerar Post Completo com IA
              </Button>

              <div className="relative">
                <span className="border-border/50 absolute inset-x-0 top-1/2 border-t" />
                <span className="bg-background text-muted-foreground relative mx-auto block w-fit px-3 text-[10px] font-semibold tracking-[0.14em] uppercase">
                  ou selecione uma sugestão
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="size-4 text-amber-500" weight="fill" />
                    Sugestões da IA
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateSuggestions.mutate({ count: 5 })}
                    disabled={generateSuggestions.isPending}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    {generateSuggestions.isPending ? (
                      <CircleNotch className="size-3 animate-spin" weight="bold" />
                    ) : (
                      <Sparkle className="size-3 text-amber-500" weight="fill" />
                    )}
                    {generateSuggestions.isPending
                      ? "Gerando..."
                      : suggestions.length > 0
                        ? "Gerar novas"
                        : "Gerar sugestões"}
                  </Button>
                </div>

                {generateSuggestions.isPending && (
                  <div className="flex flex-col gap-2.5">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="border-border/40 flex flex-col gap-2 rounded-2xl border p-4"
                      >
                        <Bone delay={index * 90} className="h-4 w-3/4" />
                        <Bone
                          delay={index * 90 + 60}
                          className="h-3 w-full rounded-full"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {!generateSuggestions.isPending && suggestions.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {suggestions.map((suggestion, index) => {
                      const category = suggestion.categoryId
                        ? categories.find((c) => c.id === suggestion.categoryId)
                        : suggestion.categorySlug
                          ? categories.find(
                              (c) => c.slug === suggestion.categorySlug,
                            )
                          : undefined
                      const color = category?.color ?? DEFAULT_CATEGORY_COLOR
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() =>
                            handleSelectSuggestion(
                              suggestion.title,
                              category?.id ?? suggestion.categoryId,
                            )
                          }
                          className={cn(
                            "group border-border/40 hover:border-brand-cyan/40 hover:bg-muted/40 cursor-pointer rounded-2xl border p-4 text-left transition-all",
                            prompt === suggestion.title &&
                              "border-rose-500/50 bg-rose-500/5",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 transition-colors group-hover:bg-rose-500/15 group-hover:text-rose-500">
                              <Lightning className="size-3.5" weight="fill" />
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <p className="line-clamp-2 text-sm leading-snug font-semibold transition-colors group-hover:text-rose-500">
                                {suggestion.title}
                              </p>
                              <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
                                {suggestion.description}
                              </p>
                              {category && (
                                <Badge
                                  variant="outline"
                                  className="mt-1 w-fit rounded-full text-[10px]"
                                  style={{
                                    backgroundColor: `${color}22`,
                                    color,
                                    borderColor: `${color}55`,
                                  }}
                                >
                                  {category.title}
                                </Badge>
                              )}
                            </div>
                            <CaretRight className="text-muted-foreground/40 mt-0.5 size-4 shrink-0 transition-colors group-hover:text-rose-500" />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {!generateSuggestions.isPending && suggestions.length === 0 && (
                  <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
                    <Lightbulb className="size-8 opacity-30" weight="fill" />
                    <p className="max-w-xs text-sm">
                      Clique em &quot;Gerar sugestões&quot; para a IA recomendar
                      tópicos relevantes
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------- GENERATING ---------- */}
          {step === "generating" && (
            <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
              <div className="relative">
                <span className="hero-pulse-ring absolute -inset-4 rounded-full bg-rose-500/30" />
                <span className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-500/25 to-rose-500/10 text-rose-500 ring-1 ring-rose-500/20">
                  <MagicWand className="size-9 animate-pulse" weight="fill" />
                </span>
              </div>

              <div className="flex max-w-md flex-col gap-2 text-center">
                <h3 className="text-lg font-bold">Criando seu artigo...</h3>
                <p className="text-muted-foreground text-sm">
                  {generationProgress}
                </p>
              </div>

              <div className="flex w-full max-w-sm flex-col gap-3">
                <GenerationStep
                  pending={generatePost.isPending}
                  done={Boolean(generatedPost)}
                  idleIcon={<BookOpen className="size-3.5" weight="fill" />}
                  label="Gerando texto do artigo"
                />
                <GenerationStep
                  pending={generateImage.isPending}
                  done={Boolean(generatedPost?.coverImageUrl)}
                  idleIcon={<ImageSquare className="size-3.5" weight="fill" />}
                  label="Gerando imagem de capa"
                />
              </div>

              <p className="text-muted-foreground/60 text-[11px]">
                Isso pode levar até 1-2 minutos...
              </p>
            </div>
          )}

          {/* ---------- REVIEW ---------- */}
          {step === "review" && generatedPost && (
            <div className="flex flex-col">
              {/* toolbar */}
              <div className="border-border/40 bg-muted/20 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur-md sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    {showPreview ? (
                      <PencilSimple className="size-3" weight="fill" />
                    ) : (
                      <Eye className="size-3" weight="fill" />
                    )}
                    {showPreview ? "Markdown" : "Preview"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateImage}
                    disabled={isGeneratingImage || generateImage.isPending}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    {isGeneratingImage || generateImage.isPending ? (
                      <CircleNotch className="size-3 animate-spin" weight="bold" />
                    ) : (
                      <ArrowsClockwise className="size-3" weight="bold" />
                    )}
                    Nova imagem
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("input")}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    <ArrowLeft className="size-3" weight="bold" />
                    Voltar
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSave("DRAFT")}
                    disabled={isSaving}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    {isSaving ? (
                      <CircleNotch className="size-3 animate-spin" weight="bold" />
                    ) : (
                      <FloppyDisk className="size-3" weight="fill" />
                    )}
                    Rascunho
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSave("PUBLISHED")}
                    disabled={isSaving}
                    className="btn-gradient-auth h-8 cursor-pointer gap-1.5 rounded-xl text-xs font-semibold"
                  >
                    {isSaving ? (
                      <CircleNotch className="size-3 animate-spin" weight="bold" />
                    ) : (
                      <Globe className="size-3" weight="fill" />
                    )}
                    Publicar
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-6 p-4 sm:p-6">
                {/* capa */}
                {generatedPost.coverImageUrl && (
                  <div className="border-border/40 relative aspect-video w-full overflow-hidden rounded-2xl border">
                    <Image
                      src={generatedPost.coverImageUrl}
                      alt={generatedPost.title}
                      fill
                      sizes="(max-width: 1024px) 90vw, 900px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {(isGeneratingImage || generateImage.isPending) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                        <CircleNotch
                          className="size-8 animate-spin text-rose-400"
                          weight="bold"
                        />
                        <p className="text-sm font-medium text-white/85">
                          Gerando nova imagem...
                        </p>
                      </div>
                    )}
                    <Badge className="absolute right-3 bottom-3 gap-1 rounded-full border-0 bg-black/55 text-[10px] text-white/85 backdrop-blur-sm">
                      <ImageSquare className="size-2.5" weight="fill" />
                      Imagem gerada por IA · 16:9
                    </Badge>
                  </div>
                )}

                {/* meta */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {generatedPost.categoryTitle && (
                      <Badge
                        variant="outline"
                        className="gap-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${generatedPost.categoryColor ?? DEFAULT_CATEGORY_COLOR}22`,
                          color:
                            generatedPost.categoryColor ??
                            DEFAULT_CATEGORY_COLOR,
                          borderColor: `${generatedPost.categoryColor ?? DEFAULT_CATEGORY_COLOR}55`,
                        }}
                      >
                        <Tag className="size-3" weight="fill" />
                        {generatedPost.categoryTitle}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-muted-foreground gap-1 rounded-full text-xs"
                    >
                      <Clock className="size-3" weight="fill" />
                      {generatedPost.readTimeMinutes} min de leitura
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground gap-1 rounded-full text-xs"
                    >
                      <MagicWand className="size-3" weight="fill" />
                      Gerado por IA
                    </Badge>
                  </div>

                  <Input
                    value={generatedPost.title}
                    onChange={(event) =>
                      setGeneratedPost({
                        ...generatedPost,
                        title: event.target.value,
                      })
                    }
                    className="border-border/40 h-auto rounded-none border-0 border-b bg-transparent px-0 py-2 text-lg font-bold focus-visible:border-rose-500/60 focus-visible:ring-0 sm:text-2xl"
                  />

                  <Input
                    value={generatedPost.excerpt}
                    onChange={(event) =>
                      setGeneratedPost({
                        ...generatedPost,
                        excerpt: event.target.value,
                      })
                    }
                    placeholder="Resumo do post..."
                    className="border-border/30 text-muted-foreground h-auto rounded-none border-0 border-b bg-transparent px-0 py-1.5 text-sm focus-visible:border-rose-500/40 focus-visible:ring-0"
                  />

                  {generatedPost.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {generatedPost.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-muted-foreground rounded-full text-[10px]"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* pedir edição à IA */}
                <div className="rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-500/8 to-transparent p-4">
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <PencilSimple className="size-3.5 text-rose-500" weight="fill" />
                    Pedir à IA para editar o texto
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={editInstruction}
                      onChange={(event) => setEditInstruction(event.target.value)}
                      placeholder="Ex: Torne o texto mais informal e adicione mais exemplos práticos..."
                      className="h-10 min-w-0 flex-1 rounded-xl text-sm focus-visible:ring-rose-500/30"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && editInstruction.trim()) {
                          handleEdit()
                        }
                      }}
                    />
                    <Button
                      onClick={handleEdit}
                      disabled={!editInstruction.trim() || isEditing}
                      size="sm"
                      className="h-10 shrink-0 cursor-pointer rounded-xl bg-rose-500 px-3 text-white hover:bg-rose-600"
                    >
                      {isEditing ? (
                        <CircleNotch
                          className="size-3.5 animate-spin"
                          weight="bold"
                        />
                      ) : (
                        <MagicWand className="size-3.5" weight="fill" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* conteúdo */}
                <div className="border-border/40 overflow-hidden rounded-2xl border">
                  <div className="border-border/30 bg-muted/25 flex items-center gap-2 border-b px-4 py-2">
                    <BookOpen
                      className="text-muted-foreground size-3.5"
                      weight="fill"
                    />
                    <span className="text-muted-foreground text-xs font-medium">
                      {showPreview ? "Preview" : "Markdown"}
                    </span>
                    <span className="text-muted-foreground/60 ml-auto text-[10px] tabular-nums">
                      ~{countWords(generatedPost.content)} palavras
                    </span>
                  </div>
                  <div className="overflow-x-auto p-4 sm:p-6">
                    {showPreview ? (
                      <MarkdownView
                        content={generatedPost.content}
                        accent="rose"
                      />
                    ) : (
                      <Textarea
                        value={generatedPost.content}
                        onChange={(event) =>
                          setGeneratedPost({
                            ...generatedPost,
                            content: event.target.value,
                          })
                        }
                        className="min-h-[400px] resize-none border-0 bg-transparent p-0 font-mono text-xs focus-visible:ring-0"
                      />
                    )}
                  </div>
                </div>

                {/* SEO */}
                <div className="border-border/40 bg-muted/20 rounded-2xl border p-4">
                  <label className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                    <Globe className="size-3.5 text-emerald-500" weight="fill" />
                    SEO &amp; Metadados
                  </label>
                  <div className="mt-3 flex flex-col gap-2">
                    <Input
                      value={generatedPost.metaTitle}
                      onChange={(event) =>
                        setGeneratedPost({
                          ...generatedPost,
                          metaTitle: event.target.value,
                        })
                      }
                      placeholder="Meta título (SEO)"
                      className="h-9 rounded-xl text-xs"
                    />
                    <Input
                      value={generatedPost.metaDescription}
                      onChange={(event) =>
                        setGeneratedPost({
                          ...generatedPost,
                          metaDescription: event.target.value,
                        })
                      }
                      placeholder="Meta descrição (SEO)"
                      className="h-9 rounded-xl text-xs"
                    />
                    <Input
                      value={generatedPost.slug}
                      onChange={(event) =>
                        setGeneratedPost({
                          ...generatedPost,
                          slug: event.target.value,
                        })
                      }
                      placeholder="slug-url-amigavel"
                      className="h-9 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------- EDITING ---------- */}
          {step === "editing" && (
            <StatusScreen
              tone="rose"
              icon={<PencilSimple className="size-9 animate-pulse" weight="fill" />}
              title="Editando o texto..."
              description={`A IA está aplicando suas instruções: "${editInstruction}"`}
              hint="Isso pode levar alguns segundos..."
            />
          )}

          {/* ---------- SAVING ---------- */}
          {step === "saving" && (
            <StatusScreen
              tone="green"
              icon={<FloppyDisk className="size-9 animate-pulse" weight="fill" />}
              title="Salvando post..."
              description="Seu post está sendo salvo no banco de dados."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GenerationStep({
  pending,
  done,
  idleIcon,
  label,
}: {
  pending: boolean
  done: boolean
  idleIcon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-all",
          pending
            ? "bg-rose-500/15 text-rose-500"
            : done
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-muted/40 text-muted-foreground",
        )}
      >
        {pending ? (
          <CircleNotch className="size-3.5 animate-spin" weight="bold" />
        ) : done ? (
          <Check className="size-3.5" weight="bold" />
        ) : (
          idleIcon
        )}
      </span>
      <span
        className={cn(
          "truncate",
          done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  )
}

function StatusScreen({
  tone,
  icon,
  title,
  description,
  hint,
}: {
  tone: "rose" | "cyan" | "green"
  icon: React.ReactNode
  title: string
  description: string
  hint?: string
}) {
  const toneClasses = {
    rose: "bg-gradient-to-br from-rose-500/25 to-rose-500/10 text-rose-500 ring-rose-500/20",
    cyan: "bg-[color-mix(in_oklab,var(--brand-cyan)_18%,transparent)] text-[var(--brand-cyan)] ring-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)]",
    green:
      "bg-emerald-500/15 text-emerald-500 ring-emerald-500/20",
  } as const
  const ringClasses = {
    rose: "bg-rose-500/30",
    cyan: "bg-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]",
    green: "bg-emerald-500/30",
  } as const

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
      <div className="relative">
        <span
          className={cn(
            "hero-pulse-ring absolute -inset-4 rounded-full",
            ringClasses[tone],
          )}
        />
        <span
          className={cn(
            "relative flex size-20 items-center justify-center rounded-3xl ring-1",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex max-w-md flex-col gap-2 text-center">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-muted-foreground text-sm break-words">{description}</p>
      </div>
      {hint && (
        <p className="text-muted-foreground/60 text-[11px]">{hint}</p>
      )}
    </div>
  )
}

/* ============================================================
   DIALOG DE IA — EDIÇÃO DE POST EXISTENTE
   ============================================================ */

type AIEditStep = "review" | "editing" | "saving"

const EDIT_SHORTCUTS = [
  "Torne mais informal",
  "Adicione exemplos práticos",
  "Resuma em menos palavras",
  "Melhore o SEO",
  "Torne mais persuasivo",
  "Adicione dados e estatísticas",
] as const

interface EditBaseline {
  content: string
  title: string
  excerpt: string
  coverImageUrl: string
}

function AIEditPostDialog({
  open,
  onOpenChange,
  post,
  onPostUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: BlogPost
  onPostUpdated: () => void
}) {
  const [step, setStep] = React.useState<AIEditStep>("review")
  const [content, setContent] = React.useState("")
  const [title, setTitle] = React.useState(post.title)
  const [excerpt, setExcerpt] = React.useState(post.excerpt ?? "")
  const [coverImageUrl, setCoverImageUrl] = React.useState(
    post.coverImageUrl ?? "",
  )
  const [editInstruction, setEditInstruction] = React.useState("")
  const [showPreview, setShowPreview] = React.useState(true)
  const [isRegeneratingImage, setIsRegeneratingImage] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [baseline, setBaseline] = React.useState<EditBaseline>({
    content: "",
    title: post.title,
    excerpt: post.excerpt ?? "",
    coverImageUrl: post.coverImageUrl ?? "",
  })

  /**
   * MELHORIA: `getPosts` não devolve `content`, então o editor abria vazio.
   * Buscamos o post completo pelo slug e hidratamos o editor quando chega.
   */
  const fullPost = api.blog.getPublicPostBySlug.useQuery(
    { slug: post.slug },
    {
      enabled: open && Boolean(post.slug),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  )

  /** Guarda para hidratar uma única vez por abertura (não apaga edições). */
  const hydratedForRef = React.useRef<string | null>(null)

  /** MELHORIA: useEffect de verdade — re-sincroniza sempre que o post muda. */
  React.useEffect(() => {
    hydratedForRef.current = null
    setStep("review")
    setEditInstruction("")
    setShowPreview(true)
    setIsRegeneratingImage(false)
    setHasChanges(false)
    setContent("")
    setTitle(post.title)
    setExcerpt(post.excerpt ?? "")
    setCoverImageUrl(post.coverImageUrl ?? "")
    setBaseline({
      content: "",
      title: post.title,
      excerpt: post.excerpt ?? "",
      coverImageUrl: post.coverImageUrl ?? "",
    })
  }, [post.id, post.title, post.excerpt, post.coverImageUrl, open])

  /** Hidratação do conteúdo assim que a query completa retorna. */
  React.useEffect(() => {
    const data = fullPost.data
    if (!data || data.id !== post.id) return
    if (hydratedForRef.current === post.id) return
    hydratedForRef.current = post.id
    const nextContent = data.content ?? ""
    setContent(nextContent)
    setTitle(data.title)
    setExcerpt(data.excerpt ?? "")
    setCoverImageUrl(data.coverImageUrl ?? "")
    setBaseline({
      content: nextContent,
      title: data.title,
      excerpt: data.excerpt ?? "",
      coverImageUrl: data.coverImageUrl ?? "",
    })
    setHasChanges(false)
  }, [fullPost.data, post.id])

  const editText = api.blog.editBlogText.useMutation({
    onSuccess: (data) => {
      setContent(data.content)
      setEditInstruction("")
      setStep("review")
      setHasChanges(true)
      toast.success("Texto editado com sucesso!")
    },
    onError: (error) => {
      toast.error("Erro ao editar texto", { description: error.message })
      setStep("review")
    },
  })

  const generateImage = api.blog.generateBlogImage.useMutation({
    onSuccess: (data) => {
      setCoverImageUrl(data.imageUrl)
      setIsRegeneratingImage(false)
      setHasChanges(true)
      toast.success("Nova imagem gerada!")
    },
    onError: (error) => {
      toast.error("Erro ao gerar imagem", { description: error.message })
      setIsRegeneratingImage(false)
    },
  })

  const updateContent = api.blog.updatePostContent.useMutation({
    onSuccess: () => {
      toast.success("Post atualizado com sucesso!")
      onPostUpdated()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error("Erro ao salvar", { description: error.message })
      setStep("review")
    },
  })

  const handleEdit = () => {
    if (!editInstruction.trim() || !content.trim()) return
    setStep("editing")
    editText.mutate({
      currentContent: content,
      editInstruction: editInstruction.trim(),
      title,
    })
  }

  const handleRegenerateImage = () => {
    setIsRegeneratingImage(true)
    generateImage.mutate({
      title,
      excerpt: excerpt || undefined,
      categoryTitle: post.category?.title ?? undefined,
    })
  }

  const handleSave = () => {
    setStep("saving")
    const payload: {
      id: string
      content?: string
      readTimeMinutes?: number
      title?: string
      excerpt?: string
      coverImageUrl?: string
    } = { id: post.id }

    if (content !== baseline.content) {
      payload.content = content
      payload.readTimeMinutes = readTimeFrom(content)
    }
    if (title !== baseline.title) payload.title = title
    if (excerpt !== baseline.excerpt) payload.excerpt = excerpt
    if (coverImageUrl !== baseline.coverImageUrl) {
      payload.coverImageUrl = coverImageUrl
    }

    updateContent.mutate(payload)
  }

  const handleResetAll = () => {
    setStep("review")
    setContent(baseline.content)
    setTitle(baseline.title)
    setExcerpt(baseline.excerpt)
    setCoverImageUrl(baseline.coverImageUrl)
    setEditInstruction("")
    setShowPreview(true)
    setHasChanges(false)
  }

  const isEditing = step === "editing"
  const isSaving = step === "saving"
  const categoryColor = post.category?.color ?? DEFAULT_CATEGORY_COLOR
  const wordCount = countWords(content)
  const isLoadingContent = fullPost.isLoading
  const contentUnavailable = Boolean(fullPost.error)

  const stepTitle: Record<AIEditStep, string> = {
    review: "Editar Post com IA",
    editing: "Editando Texto...",
    saving: "Salvando Alterações...",
  }
  const stepDescription: Record<AIEditStep, string> = {
    review: "Edite o conteúdo diretamente ou peça ajuda à IA",
    editing: "A IA está editando o texto conforme suas instruções",
    saving: "Salvando as alterações no banco de dados...",
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (isEditing || isSaving) return
        onOpenChange(value)
      }}
    >
      <DialogContent
        showCloseButton={!isEditing && !isSaving}
        className="flex h-[90vh] max-h-[90vh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-5xl"
      >
        {/* header */}
        <div className="border-border/40 relative shrink-0 border-b px-4 py-4 sm:px-6">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_12%,transparent)] via-transparent to-[color-mix(in_oklab,var(--brand-green)_8%,transparent)]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-gradient-custom flex size-10 shrink-0 items-center justify-center rounded-2xl text-[#04222A]">
                <MagicWand className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-bold sm:text-lg">
                  {stepTitle[step]}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                  {stepDescription[step]}
                </DialogDescription>
              </div>
            </div>

            {hasChanges && step === "review" && (
              <Badge
                variant="outline"
                className="mr-8 hidden shrink-0 animate-pulse gap-1 rounded-full border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-600 sm:inline-flex dark:text-amber-400"
              >
                <PencilSimple className="size-2.5" weight="fill" />
                Alterações não salvas
              </Badge>
            )}
          </div>
        </div>

        {/* corpo */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === "review" && (
            <div className="flex flex-col">
              {/* toolbar */}
              <div className="border-border/40 bg-muted/20 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 backdrop-blur-md sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    {showPreview ? (
                      <PencilSimple className="size-3" weight="fill" />
                    ) : (
                      <Eye className="size-3" weight="fill" />
                    )}
                    {showPreview ? "Markdown" : "Preview"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateImage}
                    disabled={isRegeneratingImage || generateImage.isPending}
                    className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                  >
                    {isRegeneratingImage || generateImage.isPending ? (
                      <CircleNotch className="size-3 animate-spin" weight="bold" />
                    ) : (
                      <ArrowsClockwise className="size-3" weight="bold" />
                    )}
                    Nova imagem
                  </Button>
                  {hasChanges && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetAll}
                      className="text-muted-foreground h-8 cursor-pointer gap-1.5 rounded-xl text-xs"
                    >
                      <X className="size-3" weight="bold" />
                      Desfazer tudo
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="btn-gradient-auth h-8 cursor-pointer gap-1.5 rounded-xl text-xs font-semibold"
                >
                  {isSaving ? (
                    <CircleNotch className="size-3 animate-spin" weight="bold" />
                  ) : (
                    <FloppyDisk className="size-3" weight="fill" />
                  )}
                  Salvar Alterações
                </Button>
              </div>

              <div className="flex flex-col gap-6 p-4 sm:p-6">
                {/* capa */}
                {coverImageUrl && (
                  <div className="border-border/40 relative aspect-video w-full overflow-hidden rounded-2xl border">
                    <Image
                      src={coverImageUrl}
                      alt={title}
                      fill
                      sizes="(max-width: 1024px) 90vw, 900px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {(isRegeneratingImage || generateImage.isPending) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                        <CircleNotch
                          className="size-8 animate-spin text-[var(--brand-cyan)]"
                          weight="bold"
                        />
                        <p className="text-sm font-medium text-white/85">
                          Gerando nova imagem...
                        </p>
                      </div>
                    )}
                    <Badge className="absolute right-3 bottom-3 gap-1 rounded-full border-0 bg-black/55 text-[10px] text-white/85 backdrop-blur-sm">
                      <ImageSquare className="size-2.5" weight="fill" />
                      Imagem gerada por IA · 16:9
                    </Badge>
                  </div>
                )}

                {/* meta */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {post.category && (
                      <Badge
                        variant="outline"
                        className="gap-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${categoryColor}22`,
                          color: categoryColor,
                          borderColor: `${categoryColor}55`,
                        }}
                      >
                        <Tag className="size-3" weight="fill" />
                        {post.category.title}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="text-muted-foreground gap-1 rounded-full text-xs"
                    >
                      <Clock className="size-3" weight="fill" />
                      {readTimeFrom(content)} min de leitura
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground rounded-full text-xs tabular-nums"
                    >
                      ~{wordCount} palavras
                    </Badge>
                  </div>

                  <Input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value)
                      setHasChanges(true)
                    }}
                    className="border-border/40 focus-visible:border-brand-cyan/60 h-auto rounded-none border-0 border-b bg-transparent px-0 py-2 text-lg font-bold focus-visible:ring-0 sm:text-2xl"
                  />

                  <Input
                    value={excerpt}
                    onChange={(event) => {
                      setExcerpt(event.target.value)
                      setHasChanges(true)
                    }}
                    placeholder="Resumo do post..."
                    className="border-border/30 focus-visible:border-brand-cyan/40 text-muted-foreground h-auto rounded-none border-0 border-b bg-transparent px-0 py-1.5 text-sm focus-visible:ring-0"
                  />

                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {post.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-muted-foreground rounded-full text-[10px]"
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* pedir edição à IA */}
                <div className="rounded-2xl border border-[color-mix(in_oklab,var(--brand-cyan)_25%,transparent)] bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-cyan)_8%,transparent)] to-transparent p-4">
                  <label className="flex items-center gap-2 text-xs font-semibold">
                    <MagicWand
                      className="text-brand-cyan not-dark:text-primary size-3.5"
                      weight="fill"
                    />
                    Pedir à IA para editar o texto
                  </label>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={editInstruction}
                      onChange={(event) => setEditInstruction(event.target.value)}
                      placeholder="Ex: Torne o texto mais informal, adicione mais exemplos práticos, resuma em menos palavras..."
                      className="focus-visible:ring-brand-cyan/40 h-10 min-w-0 flex-1 rounded-xl text-sm"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && editInstruction.trim()) {
                          handleEdit()
                        }
                      }}
                    />
                    <Button
                      onClick={handleEdit}
                      disabled={
                        !editInstruction.trim() || isEditing || !content.trim()
                      }
                      size="sm"
                      className="btn-gradient-auth h-10 shrink-0 cursor-pointer rounded-xl px-3"
                    >
                      {isEditing ? (
                        <CircleNotch
                          className="size-3.5 animate-spin"
                          weight="bold"
                        />
                      ) : (
                        <MagicWand className="size-3.5" weight="fill" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {EDIT_SHORTCUTS.map((shortcut) => (
                      <button
                        key={shortcut}
                        type="button"
                        onClick={() => setEditInstruction(shortcut)}
                        className="border-border/50 text-muted-foreground hover:text-brand-cyan hover:border-brand-cyan/40 hover:bg-brand-cyan/5 cursor-pointer rounded-full border px-2.5 py-1 text-[10px] transition-all"
                      >
                        {shortcut}
                      </button>
                    ))}
                  </div>
                </div>

                {/* conteúdo */}
                <div className="border-border/40 overflow-hidden rounded-2xl border">
                  <div className="border-border/30 bg-muted/25 flex items-center gap-2 border-b px-4 py-2">
                    <BookOpen
                      className="text-muted-foreground size-3.5"
                      weight="fill"
                    />
                    <span className="text-muted-foreground text-xs font-medium">
                      {showPreview ? "Preview" : "Markdown"}
                    </span>
                    <span className="text-muted-foreground/60 ml-auto text-[10px] tabular-nums">
                      ~{wordCount} palavras
                    </span>
                  </div>

                  <div className="overflow-x-auto p-4 sm:p-6">
                    {isLoadingContent ? (
                      <div className="flex flex-col gap-3">
                        <Bone className="h-5 w-2/5" />
                        <Bone delay={80} className="h-3 w-full rounded-full" />
                        <Bone delay={140} className="h-3 w-11/12 rounded-full" />
                        <Bone delay={200} className="h-3 w-4/5 rounded-full" />
                        <Bone delay={260} className="mt-4 h-5 w-1/3" />
                        <Bone delay={320} className="h-3 w-full rounded-full" />
                        <Bone delay={380} className="h-3 w-10/12 rounded-full" />
                        <Bone delay={440} className="h-3 w-3/4 rounded-full" />
                      </div>
                    ) : contentUnavailable && !content ? (
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                          <ShieldWarning className="size-5" weight="fill" />
                        </span>
                        <div className="max-w-sm">
                          <p className="text-sm font-bold">
                            Conteúdo completo indisponível
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                            Só é possível carregar o texto de posts publicados.
                            Você ainda pode ajustar título, resumo e capa — ou
                            escrever o conteúdo abaixo.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowPreview(false)}
                          className="h-8 cursor-pointer rounded-xl text-xs"
                        >
                          <PencilSimple className="size-3" weight="fill" />
                          Escrever conteúdo
                        </Button>
                      </div>
                    ) : showPreview ? (
                      <MarkdownView content={content} accent="cyan" />
                    ) : (
                      <Textarea
                        value={content}
                        onChange={(event) => {
                          setContent(event.target.value)
                          setHasChanges(true)
                        }}
                        placeholder="Conteúdo do post em markdown..."
                        className="min-h-[400px] resize-none border-0 bg-transparent p-0 font-mono text-xs focus-visible:ring-0"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "editing" && (
            <StatusScreen
              tone="cyan"
              icon={<PencilSimple className="size-9 animate-pulse" weight="fill" />}
              title="Editando o texto..."
              description={`A IA está aplicando suas instruções: "${editInstruction}"`}
              hint="Isso pode levar alguns segundos..."
            />
          )}

          {step === "saving" && (
            <StatusScreen
              tone="green"
              icon={<FloppyDisk className="size-9 animate-pulse" weight="fill" />}
              title="Salvando alterações..."
              description="As alterações estão sendo salvas no banco de dados."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
