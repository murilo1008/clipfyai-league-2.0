"use client"

import * as React from "react"
import Image from "next/image"
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChatCircleDots,
  Check,
  CheckCircle,
  CircleNotch,
  Copy,
  DotsThreeVertical,
  Eye,
  EyeSlash,
  FileText,
  FolderOpen,
  FolderPlus,
  Globe,
  Heart,
  List,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldWarning,
  SquaresFour,
  Tag,
  TrendUp,
  Trash,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { BlogCategoriesHeroViz, BlogCategoriesHeroVizSkeleton } from "@/components/blog/blog-categories-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { CountUp, formatCompact } from "@/components/shared/count-up"
import { Reveal } from "@/components/shared/reveal"
import {
  CardGridSkeleton,
  StatTilesGridSkeleton,
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
  DialogFooter,
  DialogHeader,
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
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"
import { UploadDropzone } from "@/utils/uploadthing"

/* ========================================================================
   Tipos e constantes
   ======================================================================== */

type Category = RouterOutputs["blog"]["getCategories"][number]

type FilterStatus = "all" | "active" | "inactive"

interface CategoryForm {
  title: string
  description: string
  coverImageUrl: string | null
  color: string
  isActive: boolean
}

const EMPTY_FORM: CategoryForm = {
  title: "",
  description: "",
  coverImageUrl: null,
  color: "#3B82F6",
  isActive: true,
}

const PRESET_COLORS = [
  { label: "Vermelho", value: "#EF4444" },
  { label: "Rosa", value: "#EC4899" },
  { label: "Roxo", value: "#A855F7" },
  { label: "Violeta", value: "#8B5CF6" },
  { label: "Índigo", value: "#6366F1" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Ciano", value: "#06B6D4" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Verde", value: "#22C55E" },
  { label: "Lima", value: "#84CC16" },
  { label: "Amarelo", value: "#EAB308" },
  { label: "Laranja", value: "#F97316" },
] as const

const FALLBACK_COLOR = "#3B82F6"

/* ========================================================================
   Página
   ======================================================================== */

export default function BlogCategories() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [selectedCategory, setSelectedCategory] =
    React.useState<Category | null>(null)
  const [createForm, setCreateForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [editForm, setEditForm] = React.useState<CategoryForm>(EMPTY_FORM)
  const [copiedSlug, setCopiedSlug] = React.useState<string | null>(null)

  const utils = api.useUtils()

  /* ── Queries ─────────────────────────────────────────────────────────── */
  const {
    data: categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = api.blog.getCategories.useQuery()
  const { data: stats, isLoading: isLoadingStats } =
    api.blog.getCategoryStats.useQuery()

  /* ── Mutations ───────────────────────────────────────────────────────── */
  const createCategory = api.blog.createCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria criada com sucesso!", {
        description: "A nova categoria já está disponível para uso.",
      })
      void utils.blog.getCategories.invalidate()
      void utils.blog.getCategoryStats.invalidate()
      setCreateForm(EMPTY_FORM)
      setIsCreateOpen(false)
    },
    onError: (error) => {
      toast.error("Erro ao criar categoria", { description: error.message })
    },
  })

  const updateCategory = api.blog.updateCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria atualizada com sucesso!")
      void utils.blog.getCategories.invalidate()
      void utils.blog.getCategoryStats.invalidate()
      setIsEditOpen(false)
      setSelectedCategory(null)
    },
    onError: (error) => {
      toast.error("Erro ao atualizar categoria", { description: error.message })
    },
  })

  const toggleActive = api.blog.toggleCategoryActive.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.isActive ? "Categoria ativada!" : "Categoria desativada!",
      )
      void utils.blog.getCategories.invalidate()
      void utils.blog.getCategoryStats.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao alterar status", { description: error.message })
    },
  })

  const deleteCategory = api.blog.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success("Categoria excluída com sucesso!")
      void utils.blog.getCategories.invalidate()
      void utils.blog.getCategoryStats.invalidate()
      setIsDeleteOpen(false)
      setSelectedCategory(null)
    },
    onError: (error) => {
      toast.error("Erro ao excluir categoria", { description: error.message })
    },
  })

  const reorderCategories = api.blog.reorderCategories.useMutation({
    onSuccess: () => {
      toast.success("Ordem atualizada!", {
        description: "A nova ordem já vale para o blog público.",
      })
      void utils.blog.getCategories.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao reordenar categorias", {
        description: error.message,
      })
    },
  })

  /* ── Lista completa (ordenada por `order`) e filtro ──────────────────── */
  const allCategories = React.useMemo(
    () =>
      [...(categories ?? [])].sort(
        (a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"),
      ),
    [categories],
  )

  const filteredCategories = React.useMemo(() => {
    const term = searchQuery.trim().toLowerCase()
    return allCategories.filter((category) => {
      const matchesSearch =
        term.length === 0 ||
        category.title.toLowerCase().includes(term) ||
        category.slug.toLowerCase().includes(term) ||
        (category.description ?? "").toLowerCase().includes(term)
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && category.isActive) ||
        (filterStatus === "inactive" && !category.isActive)
      return matchesSearch && matchesStatus
    })
  }, [allCategories, searchQuery, filterStatus])

  /* ── Handlers ────────────────────────────────────────────────────────── */
  const handleCreate = () => {
    if (!createForm.title.trim()) {
      toast.error("Título obrigatório", {
        description: "Informe um título para a categoria.",
      })
      return
    }
    createCategory.mutate({
      title: createForm.title.trim(),
      description: createForm.description.trim() || undefined,
      coverImageUrl: createForm.coverImageUrl ?? undefined,
      color: createForm.color || undefined,
      isActive: createForm.isActive,
    })
  }

  const handleEdit = () => {
    if (!selectedCategory) return
    if (!editForm.title.trim()) {
      toast.error("Título obrigatório")
      return
    }
    updateCategory.mutate({
      id: selectedCategory.id,
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      coverImageUrl: editForm.coverImageUrl,
      color: editForm.color,
      isActive: editForm.isActive,
    })
  }

  const openEdit = (category: Category) => {
    setSelectedCategory(category)
    setEditForm({
      title: category.title,
      description: category.description ?? "",
      coverImageUrl: category.coverImageUrl,
      color: category.color ?? FALLBACK_COLOR,
      isActive: category.isActive,
    })
    setIsEditOpen(true)
  }

  const openDelete = (category: Category) => {
    setSelectedCategory(category)
    setIsDeleteOpen(true)
  }

  const handleCopySlug = (slug: string) => {
    void navigator.clipboard.writeText(slug)
    setCopiedSlug(slug)
    toast.success("Slug copiado!")
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  /**
   * Reordenação (procedure `reorderCategories` era órfã no original):
   * move a categoria na LISTA COMPLETA ordenada e envia os ids na nova ordem.
   */
  const handleMove = (category: Category, direction: "up" | "down") => {
    const index = allCategories.findIndex((item) => item.id === category.id)
    if (index < 0) return
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= allCategories.length) return

    const next = [...allCategories]
    const moved = next[index]
    if (!moved) return
    next.splice(index, 1)
    next.splice(target, 0, moved)

    reorderCategories.mutate({ orderedIds: next.map((item) => item.id) })
  }

  const hasFilters = searchQuery.trim().length > 0 || filterStatus !== "all"
  const totalCategories = stats?.totalCategories ?? 0
  const activeCategories = stats?.activeCategories ?? 0
  const inactiveCategories = stats?.inactiveCategories ?? 0
  const activeRatio =
    totalCategories > 0 ? (activeCategories / totalCategories) * 100 : 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero das categorias ===== */}
      <HomeHero
        eyebrow="Clipfy League · Blog"
        title={
          <>
            As <span className="text-gradient">categorias</span> do blog
          </>
        }
        subtitle="Gerencie as categorias do blog — organize e classifique seus posts"
        isLoading={isLoadingStats}
        viz={<BlogCategoriesHeroViz />}
        vizSkeleton={<BlogCategoriesHeroVizSkeleton />}
        stats={[
          {
            icon: <FolderOpen className="size-3.5" weight="fill" />,
            label: "Categorias",
            value: totalCategories,
            kind: "int",
          },
          {
            icon: <Globe className="size-3.5" weight="fill" />,
            label: "Ativas",
            value: activeCategories,
            kind: "int",
          },
          {
            icon: <FileText className="size-3.5" weight="fill" />,
            label: "Posts publicados",
            value: stats?.publishedPosts ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      {isLoadingStats ? (
        <StatTilesGridSkeleton
          count={4}
          className="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
        />
      ) : (
        <Reveal immediate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<FolderOpen className="size-4" weight="fill" />}
              label="Total de Categorias"
              value={totalCategories}
              kind="int"
              hint="categorias criadas"
              accent="gradient"
              gradientValue
            />

            {/* Ativas — badge de inativas + barra de proporção */}
            <RichStatTile
              icon={<Globe className="size-4" weight="fill" />}
              label="Categorias Ativas"
              value={activeCategories}
              accent="green"
              hint="visíveis no blog"
              badge={
                inactiveCategories > 0 ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    {inactiveCategories} inativa
                    {inactiveCategories > 1 ? "s" : ""}
                  </Badge>
                ) : null
              }
              progress={activeRatio}
            />

            {/* Posts publicados — badge de sem categoria */}
            <RichStatTile
              icon={<FileText className="size-4" weight="fill" />}
              label="Posts Publicados"
              value={stats?.publishedPosts ?? 0}
              accent="cyan"
              hint={`de ${(stats?.totalPosts ?? 0).toLocaleString("pt-BR")} total`}
              badge={
                (stats?.uncategorizedPosts ?? 0) > 0 ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-600 dark:text-violet-400"
                  >
                    {stats?.uncategorizedPosts} sem categoria
                  </Badge>
                ) : null
              }
            />

            {/* Mais popular — tile de texto espelhando o StatTile */}
            <TextStatTile
              icon={<TrendUp className="size-4" weight="fill" />}
              label="Mais Popular"
              value={stats?.mostPopular?.title ?? "—"}
              accent="gradient"
              hint={stats?.mostPopular ? "mais utilizada" : "nenhuma ainda"}
              badge={
                stats?.mostPopular ? (
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                  >
                    {stats.mostPopular.postsCount} posts
                  </Badge>
                ) : null
              }
            />
          </div>
        </Reveal>
      )}

      {/* ===== Toolbar: busca, status, visualização, nova ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por título, slug ou descrição..."
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
            {/* Pills de status */}
            <div className="border-border/70 bg-muted/30 flex h-10 items-center rounded-full border p-1">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  filterStatus === "all"
                    ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("active")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  filterStatus === "active"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Globe className="size-3.5" weight="fill" />
                Ativas
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("inactive")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  filterStatus === "inactive"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Archive className="size-3.5" weight="fill" />
                Inativas
              </button>
            </div>

            {/* Toggle grid/list */}
            <div className="border-border/70 bg-muted/30 flex h-10 items-center rounded-full border p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Visualização em grade"
                className={cn(
                  "inline-flex h-full cursor-pointer items-center rounded-full px-3 transition-all",
                  viewMode === "grid"
                    ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <SquaresFour
                  className="size-4"
                  weight={viewMode === "grid" ? "fill" : "regular"}
                />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="Visualização em lista"
                className={cn(
                  "inline-flex h-full cursor-pointer items-center rounded-full px-3 transition-all",
                  viewMode === "list"
                    ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List
                  className="size-4"
                  weight={viewMode === "list" ? "bold" : "regular"}
                />
              </button>
            </div>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold"
            >
              <Plus className="size-4" weight="bold" />
              Nova Categoria
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Conteúdo ===== */}
      {isLoadingCategories ? (
        <CardGridSkeleton
          count={6}
          aspectClass="h-32"
          gridClass="grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        />
      ) : categoriesError ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="flex size-13 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <ShieldWarning className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Erro ao carregar categorias</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                {categoriesError.message}
              </p>
            </div>
          </div>
        </Reveal>
      ) : filteredCategories.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <FolderOpen className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                {hasFilters
                  ? "Nenhuma categoria encontrada"
                  : "Nenhuma categoria criada"}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                {hasFilters
                  ? "Tente ajustar os filtros ou a busca."
                  : "Comece criando sua primeira categoria para organizar os posts do blog."}
              </p>
            </div>
            {!hasFilters && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                <Plus className="size-4" weight="bold" />
                Criar Primeira Categoria
              </Button>
            )}
          </div>
        </Reveal>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCategories.map((category, index) => {
            const fullIndex = allCategories.findIndex(
              (item) => item.id === category.id,
            )
            return (
              <Reveal immediate key={category.id} delayMs={(index % 3) * 80}>
                <CategoryCard
                  category={category}
                  copiedSlug={copiedSlug}
                  isFirst={fullIndex <= 0}
                  isLast={fullIndex === allCategories.length - 1}
                  isReordering={reorderCategories.isPending}
                  isTogglePending={toggleActive.isPending}
                  onCopySlug={() => handleCopySlug(category.slug)}
                  onEdit={() => openEdit(category)}
                  onDelete={() => openDelete(category)}
                  onToggleActive={() =>
                    toggleActive.mutate({ id: category.id })
                  }
                  onMoveUp={() => handleMove(category, "up")}
                  onMoveDown={() => handleMove(category, "down")}
                />
              </Reveal>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredCategories.map((category, index) => {
            const fullIndex = allCategories.findIndex(
              (item) => item.id === category.id,
            )
            return (
              <Reveal immediate key={category.id} delayMs={(index % 6) * 50}>
                <CategoryListItem
                  category={category}
                  copiedSlug={copiedSlug}
                  isFirst={fullIndex <= 0}
                  isLast={fullIndex === allCategories.length - 1}
                  isReordering={reorderCategories.isPending}
                  isTogglePending={toggleActive.isPending}
                  onCopySlug={() => handleCopySlug(category.slug)}
                  onEdit={() => openEdit(category)}
                  onDelete={() => openDelete(category)}
                  onToggleActive={() =>
                    toggleActive.mutate({ id: category.id })
                  }
                  onMoveUp={() => handleMove(category, "up")}
                  onMoveDown={() => handleMove(category, "down")}
                />
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Criar categoria ===== */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) setCreateForm(EMPTY_FORM)
        }}
      >
        <DialogContent className="max-h-[90svh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus
                className="text-brand-mint not-dark:text-primary size-5"
                weight="fill"
              />
              Nova Categoria
            </DialogTitle>
            <DialogDescription>
              Crie uma nova categoria para organizar os posts do blog
            </DialogDescription>
          </DialogHeader>

          <CategoryFormFields
            idPrefix="create"
            value={createForm}
            onChange={setCreateForm}
            disabled={createCategory.isPending}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={createCategory.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createCategory.isPending || !createForm.title.trim()}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {createCategory.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="size-4" weight="bold" />
                  Criar Categoria
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Editar categoria ===== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90svh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilSimple
                className="text-brand-mint not-dark:text-primary size-5"
                weight="fill"
              />
              Editar Categoria
            </DialogTitle>
            <DialogDescription>
              Atualize as informações da categoria
            </DialogDescription>
          </DialogHeader>

          <CategoryFormFields
            idPrefix="edit"
            value={editForm}
            onChange={setEditForm}
            disabled={updateCategory.isPending}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={updateCategory.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateCategory.isPending || !editForm.title.trim()}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {updateCategory.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4" weight="fill" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Excluir categoria ===== */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="max-h-[90svh] overflow-y-auto rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash className="text-destructive size-5" weight="fill" />
              Excluir Categoria
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria{" "}
              <strong className="text-foreground">
                {selectedCategory?.title}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {(selectedCategory?.postsCount ?? 0) > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-left">
              <ShieldWarning
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                weight="fill"
              />
              <p className="text-xs leading-relaxed font-medium text-amber-600 dark:text-amber-400">
                Esta categoria possui {selectedCategory?.postsCount} post(s).
                Remova ou mova os posts antes de excluir.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteCategory.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (selectedCategory) {
                  deleteCategory.mutate({ id: selectedCategory.id })
                }
              }}
              disabled={deleteCategory.isPending}
              className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
            >
              {deleteCategory.isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash className="size-4" />
                  Excluir
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ========================================================================
   KPIs customizados — espelham o StatTile da marca
   ======================================================================== */

const ACCENT_CLASS: Record<"cyan" | "green" | "gradient", string> = {
  cyan: "bg-[var(--brand-cyan)] not-dark:bg-[#089eb8] not-dark:text-white",
  green: "bg-[var(--brand-green)] not-dark:bg-[#0eb981] not-dark:text-white",
  gradient: "bg-gradient-custom",
}

function RichStatTile({
  icon,
  label,
  value,
  accent = "gradient",
  hint,
  badge,
  progress,
  isLoading = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: "cyan" | "green" | "gradient"
  hint?: string
  badge?: React.ReactNode
  progress?: number
  isLoading?: boolean
}) {
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]",
            ACCENT_CLASS[accent],
          )}
        >
          {icon}
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <CountUp
          value={value}
          kind="int"
          className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]"
        />
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {badge}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>

      {typeof progress === "number" && (
        <div className="bg-muted/40 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-gradient-custom h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function TextStatTile({
  icon,
  label,
  value,
  accent = "gradient",
  hint,
  badge,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: "cyan" | "green" | "gradient"
  hint?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]",
            ACCENT_CLASS[accent],
          )}
        >
          {icon}
        </span>
      </div>

      <p className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] w-fit max-w-full truncate text-lg font-bold tracking-tight sm:text-xl">
        {value}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {badge}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}

/* ========================================================================
   Card da categoria (grid)
   ======================================================================== */

interface CategoryItemProps {
  category: Category
  copiedSlug: string | null
  isFirst: boolean
  isLast: boolean
  isReordering: boolean
  isTogglePending: boolean
  onCopySlug: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function CategoryCard({
  category,
  copiedSlug,
  isFirst,
  isLast,
  isReordering,
  isTogglePending,
  onCopySlug,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
}: CategoryItemProps) {
  const color = category.color ?? FALLBACK_COLOR
  const publishedRatio =
    category.postsCount > 0
      ? (category.publishedPosts / category.postsCount) * 100
      : 0

  return (
    <div className="glass-card glass-card-hover group relative flex h-full flex-col overflow-hidden rounded-3xl">
      {/* Tingimento e círculo decorativo com a cor da categoria */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(160deg, ${color}1F, transparent 58%)`,
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-14 -right-14 size-28 rounded-full transition-transform duration-500 group-hover:scale-150"
        style={{ backgroundColor: `${color}14` }}
      />

      {/* Capa */}
      {category.coverImageUrl && (
        <div className="relative h-32 w-full shrink-0 overflow-hidden">
          <Image
            src={category.coverImageUrl}
            alt={category.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
          <div className="from-card absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
        </div>
      )}

      <div className="relative flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${color}24` }}
            >
              <Tag className="size-5" weight="fill" style={{ color }} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-bold tracking-tight">
                {category.title}
              </h3>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <span className="text-muted-foreground truncate font-mono text-[11px]">
                  {category.slug}
                </span>
                <button
                  type="button"
                  onClick={onCopySlug}
                  aria-label="Copiar slug"
                  className="text-muted-foreground/70 hover:text-foreground shrink-0 cursor-pointer transition-colors"
                >
                  {copiedSlug === category.slug ? (
                    <Check
                      className="size-3.5 text-emerald-500"
                      weight="bold"
                    />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ações da categoria"
                className="text-muted-foreground hover:text-foreground size-8 shrink-0 cursor-pointer rounded-lg"
              >
                <DotsThreeVertical className="size-4" weight="bold" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                <PencilSimple className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={onToggleActive}
                disabled={isTogglePending}
              >
                {category.isActive ? (
                  <>
                    <EyeSlash className="size-4" />
                    Desativar
                  </>
                ) : (
                  <>
                    <Eye className="size-4" />
                    Ativar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={onMoveUp}
                disabled={isReordering || isFirst}
              >
                <ArrowUp className="size-4" weight="bold" />
                Mover para cima
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={onMoveDown}
                disabled={isReordering || isLast}
              >
                <ArrowDown className="size-4" weight="bold" />
                Mover para baixo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onClick={onDelete}
              >
                <Trash className="size-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Descrição */}
        {category.description && (
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed sm:text-[13px]">
            {category.description}
          </p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge isActive={category.isActive} />
          <Badge
            variant="outline"
            className="text-muted-foreground rounded-full text-[10px] font-semibold tabular-nums"
          >
            #{category.order}
          </Badge>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2">
          <MetricBox
            icon={<FileText className="size-3.5" weight="fill" />}
            label="Posts"
            value={category.postsCount}
            subValue={`${category.publishedPosts} pub.`}
            color={color}
          />
          <MetricBox
            icon={<Eye className="size-3.5" weight="fill" />}
            label="Views"
            value={category.totalViews}
            color={color}
          />
          <MetricBox
            icon={<Heart className="size-3.5" weight="fill" />}
            label="Likes"
            value={category.totalLikes}
            color={color}
          />
        </div>

        {/* Proporção publicados/total */}
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="text-muted-foreground flex items-center justify-between text-[10px] font-semibold tracking-wide uppercase">
            <span>Publicados</span>
            <span className="tabular-nums">
              {category.publishedPosts}/{category.postsCount}
            </span>
          </div>
          <div className="bg-muted/40 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${publishedRatio}%`,
                backgroundImage: `linear-gradient(to right, ${color}, ${color}99)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   Item da categoria (lista)
   ======================================================================== */

function CategoryListItem({
  category,
  copiedSlug,
  isFirst,
  isLast,
  isReordering,
  isTogglePending,
  onCopySlug,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
}: CategoryItemProps) {
  const color = category.color ?? FALLBACK_COLOR

  return (
    <div className="glass-card group relative overflow-hidden rounded-2xl">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(120deg, ${color}17, transparent 52%)`,
        }}
      />

      <div className="relative flex items-stretch">
        {/* Coluna de ordem com as setas de reordenação */}
        <div className="border-border/60 bg-muted/30 flex shrink-0 items-center border-r px-1.5 sm:px-2.5">
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              aria-label="Mover para cima"
              onClick={onMoveUp}
              disabled={isReordering || isFirst}
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="size-3.5" weight="bold" />
            </button>
            <span className="text-muted-foreground w-6 text-center text-sm font-bold tabular-nums">
              {category.order}
            </span>
            <button
              type="button"
              aria-label="Mover para baixo"
              onClick={onMoveDown}
              disabled={isReordering || isLast}
              className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowDown className="size-3.5" weight="bold" />
            </button>
          </div>
        </div>

        <div className="min-w-0 flex-1 p-3.5 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            {/* Capa ou quadrado tingido */}
            <span
              className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${color}24` }}
            >
              {category.coverImageUrl ? (
                <Image
                  src={category.coverImageUrl}
                  alt={category.title}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <Tag className="size-6" weight="fill" style={{ color }} />
              )}
            </span>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-[15px] font-bold tracking-tight">
                  {category.title}
                </h3>
                <StatusBadge isActive={category.isActive} compact />
              </div>
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                <span className="text-muted-foreground truncate font-mono text-[11px]">
                  {category.slug}
                </span>
                <button
                  type="button"
                  onClick={onCopySlug}
                  aria-label="Copiar slug"
                  className="text-muted-foreground/70 hover:text-foreground shrink-0 cursor-pointer transition-colors"
                >
                  {copiedSlug === category.slug ? (
                    <Check
                      className="size-3.5 text-emerald-500"
                      weight="bold"
                    />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Métricas (md+) */}
            <div className="hidden items-center gap-4 md:flex lg:gap-7">
              <ListMetric
                label="Posts"
                value={category.postsCount}
                highlight
                sub={`${category.publishedPosts} pub.`}
              />
              <ListMetric label="Views" value={category.totalViews} />
              <ListMetric label="Likes" value={category.totalLikes} />
              <ListMetric label="Comentários" value={category.totalComments} />
            </div>

            {/* Ações */}
            <div className="flex shrink-0 items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onEdit}
                      aria-label="Editar categoria"
                      className="text-muted-foreground hover:text-foreground size-8 cursor-pointer rounded-lg"
                    >
                      <PencilSimple className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Editar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onToggleActive}
                      disabled={isTogglePending}
                      aria-label={
                        category.isActive
                          ? "Desativar categoria"
                          : "Ativar categoria"
                      }
                      className="text-muted-foreground hover:text-foreground hidden size-8 cursor-pointer rounded-lg sm:inline-flex"
                    >
                      {category.isActive ? (
                        <EyeSlash className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">
                      {category.isActive ? "Desativar" : "Ativar"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Mais ações"
                    className="text-muted-foreground hover:text-foreground size-8 cursor-pointer rounded-lg"
                  >
                    <DotsThreeVertical className="size-4" weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl">
                  <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                    <PencilSimple className="size-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={onToggleActive}
                    disabled={isTogglePending}
                  >
                    {category.isActive ? (
                      <>
                        <EyeSlash className="size-4" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <Eye className="size-4" />
                        Ativar
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={onMoveUp}
                    disabled={isReordering || isFirst}
                  >
                    <ArrowUp className="size-4" weight="bold" />
                    Mover para cima
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={onMoveDown}
                    disabled={isReordering || isLast}
                  >
                    <ArrowDown className="size-4" weight="bold" />
                    Mover para baixo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={onDelete}
                  >
                    <Trash className="size-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Descrição */}
          {category.description && (
            <p className="text-muted-foreground mt-2 line-clamp-1 text-xs sm:text-[13px]">
              {category.description}
            </p>
          )}

          {/* Métricas (mobile) */}
          <div className="mt-3 grid grid-cols-4 gap-2 md:hidden">
            <MobileMetric
              icon={<FileText className="size-3" weight="fill" />}
              label="Posts"
              value={category.postsCount}
              highlight
            />
            <MobileMetric
              icon={<Eye className="size-3" weight="fill" />}
              label="Views"
              value={category.totalViews}
            />
            <MobileMetric
              icon={<Heart className="size-3" weight="fill" />}
              label="Likes"
              value={category.totalLikes}
            />
            <MobileMetric
              icon={<ChatCircleDots className="size-3" weight="fill" />}
              label="Coment."
              value={category.totalComments}
            />
          </div>

          {/* Proporção publicados/total */}
          <div className="bg-muted/40 mt-3 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${
                  category.postsCount > 0
                    ? (category.publishedPosts / category.postsCount) * 100
                    : 0
                }%`,
                backgroundImage: `linear-gradient(to right, ${color}, ${color}99)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================
   Peças reutilizadas
   ======================================================================== */

function StatusBadge({
  isActive,
  compact = false,
}: {
  isActive: boolean
  compact?: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 gap-1 rounded-full text-[10px] font-semibold",
        isActive
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border text-muted-foreground bg-muted/50",
      )}
    >
      {!compact &&
        (isActive ? (
          <Globe className="size-3" weight="fill" />
        ) : (
          <Archive className="size-3" weight="fill" />
        ))}
      {isActive ? "Ativa" : "Inativa"}
    </Badge>
  )
}

function MetricBox({
  icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  subValue?: string
  color: string
}) {
  return (
    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span
        className="text-[13px] font-bold tabular-nums"
        style={{ color }}
      >
        {formatCompact(value)}
      </span>
      <span className="text-muted-foreground truncate text-[9px] leading-tight font-semibold tracking-wide uppercase">
        {label}
      </span>
      {subValue && (
        <span className="text-muted-foreground/70 truncate text-[9px] leading-tight">
          {subValue}
        </span>
      )}
    </div>
  )
}

function ListMetric({
  label,
  value,
  sub,
  highlight = false,
  className,
}: {
  label: string
  value: number
  sub?: string
  highlight?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          highlight &&
            "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
        )}
      >
        {formatCompact(value)}
      </span>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
      {sub && (
        <span className="text-muted-foreground/70 text-[9px]">{sub}</span>
      )}
    </div>
  )
}

function MobileMetric({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="bg-muted/40 flex flex-col items-center gap-0.5 rounded-xl py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span
        className={cn(
          "text-xs font-bold tabular-nums",
          highlight &&
            "text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]",
        )}
      >
        {formatCompact(value)}
      </span>
      <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

/* ========================================================================
   Campos compartilhados dos dialogs (criar/editar)
   ======================================================================== */

function CategoryFormFields({
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  idPrefix: string
  value: CategoryForm
  onChange: React.Dispatch<React.SetStateAction<CategoryForm>>
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-6 py-2">
      {/* Título */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-title`}>Título *</Label>
        <Input
          id={`${idPrefix}-title`}
          placeholder="Ex: Dicas de Viralização"
          value={value.title}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, title: event.target.value }))
          }
          disabled={disabled}
          className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
        />
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Descrição</Label>
        <Textarea
          id={`${idPrefix}-description`}
          placeholder="Descrição breve da categoria..."
          value={value.description}
          onChange={(event) =>
            onChange((prev) => ({ ...prev, description: event.target.value }))
          }
          disabled={disabled}
          className="focus-visible:ring-brand-cyan/40 min-h-[88px] resize-none rounded-xl"
        />
      </div>

      {/* Cor */}
      <div className="flex flex-col gap-3">
        <Label>Cor da Categoria</Label>
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((color) => (
              <Tooltip key={color.value}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({ ...prev, color: color.value }))
                    }
                    disabled={disabled}
                    aria-label={color.label}
                    className={cn(
                      "size-8 cursor-pointer rounded-full border-2 transition-all disabled:cursor-not-allowed",
                      value.color.toUpperCase() === color.value
                        ? "border-foreground scale-110 shadow-lg"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{color.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
        <div className="flex items-center gap-2">
          <span
            className="border-border/60 size-9 shrink-0 rounded-lg border"
            style={{ backgroundColor: value.color }}
          />
          <Input
            value={value.color}
            onChange={(event) =>
              onChange((prev) => ({ ...prev, color: event.target.value }))
            }
            placeholder="#3B82F6"
            disabled={disabled}
            className="focus-visible:ring-brand-cyan/40 h-9 rounded-xl font-mono text-sm"
          />
        </div>
      </div>

      {/* Capa */}
      <div className="flex flex-col gap-3">
        <Label>Imagem de Capa</Label>
        {value.coverImageUrl ? (
          <div className="border-border/60 group relative overflow-hidden rounded-2xl border">
            <div className="relative h-40 w-full">
              <Image
                src={value.coverImageUrl}
                alt="Capa da categoria"
                fill
                sizes="(max-width: 640px) 100vw, 480px"
                className="object-cover"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() =>
                  onChange((prev) => ({ ...prev, coverImageUrl: null }))
                }
                disabled={disabled}
                className="cursor-pointer rounded-xl"
              >
                <X className="size-4" />
                Remover
              </Button>
            </div>
          </div>
        ) : (
          <UploadDropzone
            endpoint="blogCategoryCover"
            onClientUploadComplete={(files) => {
              const url = files?.[0]?.ufsUrl ?? files?.[0]?.url
              if (url) {
                onChange((prev) => ({ ...prev, coverImageUrl: url }))
                toast.success("Imagem enviada!")
              }
            }}
            onUploadError={(error) => {
              toast.error("Erro no upload", { description: error.message })
            }}
            appearance={{
              container:
                "border-border/70 bg-muted/20 rounded-2xl border-dashed cursor-pointer mt-0",
              label: "text-foreground text-sm",
              allowedContent: "text-muted-foreground text-xs",
              button:
                "bg-gradient-custom text-[#04222A] text-sm font-semibold rounded-xl cursor-pointer after:bg-transparent",
            }}
          />
        )}
      </div>

      {/* Status */}
      <div className="border-border/60 bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              value.isActive
                ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            {value.isActive ? (
              <Globe className="size-4" weight="fill" />
            ) : (
              <Archive className="size-4" weight="fill" />
            )}
          </span>
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-active`} className="cursor-pointer">
              Categoria Ativa
            </Label>
            <p className="text-muted-foreground text-xs">
              Categorias inativas não aparecem no blog público
            </p>
          </div>
        </div>
        <Switch
          id={`${idPrefix}-active`}
          checked={value.isActive}
          onCheckedChange={(checked) =>
            onChange((prev) => ({ ...prev, isActive: checked }))
          }
          disabled={disabled}
          className="cursor-pointer"
        />
      </div>
    </div>
  )
}
