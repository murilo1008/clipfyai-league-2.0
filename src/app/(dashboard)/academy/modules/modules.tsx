"use client"

import * as React from "react"
import Image from "next/image"
import {
  BookOpen,
  CaretDown,
  CaretUp,
  CheckCircle,
  CircleNotch,
  Clock,
  DotsThreeVertical,
  Eye,
  EyeSlash,
  List,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plus,
  SquaresFour,
  Trash,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { ModulesHeroViz, ModulesHeroVizSkeleton } from "@/components/academy/modules-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { Reveal } from "@/components/shared/reveal"
import { CardGridSkeleton } from "@/components/shared/skeletons"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"
import { UploadDropzone } from "@/utils/uploadthing"

import { CreateModuleDialog } from "../create-module-dialog"

type Module = RouterOutputs["academy"]["getOverview"]["modules"][number]

// Função para formatar duração em horas e minutos
const formatDuration = (seconds: number) => {
  if (!seconds) return "0min"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}min`
  }
  return `${minutes}min`
}

type FilterStatus = "all" | "published" | "draft"

export default function Modules() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [selectedModule, setSelectedModule] = React.useState<Module | null>(
    null,
  )
  const [editFormData, setEditFormData] = React.useState({
    title: "",
    description: "",
    coverImageUrl: null as string | null,
    isPublished: false,
  })

  const utils = api.useUtils()

  const { data, isLoading, error } = api.academy.getOverview.useQuery()

  const updateModule = api.academy.updateModule.useMutation({
    onSuccess: () => {
      toast.success("Módulo atualizado com sucesso!")
      void utils.academy.getOverview.invalidate()
      setIsEditOpen(false)
      setSelectedModule(null)
    },
    onError: (error) => {
      toast.error("Erro ao atualizar módulo", { description: error.message })
    },
  })

  const deleteModule = api.academy.deleteModule.useMutation({
    onSuccess: () => {
      toast.success("Módulo excluído com sucesso!")
      void utils.academy.getOverview.invalidate()
      setIsDeleteOpen(false)
      setSelectedModule(null)
    },
    onError: (error) => {
      toast.error("Erro ao excluir módulo", { description: error.message })
    },
  })

  const togglePublish = api.academy.toggleModulePublish.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.isPublished ? "Módulo publicado!" : "Módulo despublicado!",
      )
      void utils.academy.getOverview.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao alterar status", { description: error.message })
    },
  })

  const moveModule = api.academy.moveModule.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        toast.info(
          "message" in result && result.message
            ? result.message
            : "Não é possível mover nesta direção",
        )
        return
      }
      void utils.academy.getOverview.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao mover módulo", { description: error.message })
    },
  })

  const stats = data?.stats
  const modules = React.useMemo(() => data?.modules ?? [], [data?.modules])

  // Posição real na lista COMPLETA ordenada por `order` (não o índice do
  // filtro) — corrige o bug do original que desabilitava as setas errado.
  const fullIndexOf = React.useCallback(
    (id: string) => modules.findIndex((module) => module.id === id),
    [modules],
  )

  // Filtrar módulos
  const filteredModules = modules.filter((module) => {
    const matchesSearch =
      module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (module.description
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ??
        false)

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "published" && module.isPublished) ||
      (filterStatus === "draft" && !module.isPublished)

    return matchesSearch && matchesFilter
  })

  const openEditDialog = (module: Module) => {
    setSelectedModule(module)
    setEditFormData({
      title: module.title,
      description: module.description ?? "",
      coverImageUrl: module.coverImageUrl,
      isPublished: module.isPublished,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (module: Module) => {
    setSelectedModule(module)
    setIsDeleteOpen(true)
  }

  const handleUpdateModule = () => {
    if (!selectedModule || !editFormData.title.trim()) return

    updateModule.mutate({
      id: selectedModule.id,
      title: editFormData.title.trim(),
      description: editFormData.description.trim() || null,
      coverImageUrl: editFormData.coverImageUrl,
      isPublished: editFormData.isPublished,
    })
  }

  const handleDeleteModule = () => {
    if (!selectedModule) return
    deleteModule.mutate({ id: selectedModule.id })
  }

  const handleMoveModule = (module: Module, direction: "up" | "down") => {
    moveModule.mutate({ id: module.id, direction })
  }

  const hasFilters = searchQuery.length > 0 || filterStatus !== "all"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da academia ===== */}
      <HomeHero
        eyebrow="Clipfy League · Academia"
        title={
          <>
            Os <span className="text-gradient">módulos</span> do curso
          </>
        }
        subtitle="Organize, publique e reordene os módulos da academia — capas, aulas e duração em um só lugar."
        isLoading={isLoading}
        viz={<ModulesHeroViz />}
        vizSkeleton={<ModulesHeroVizSkeleton />}
        stats={[
          {
            icon: <SquaresFour className="size-3.5" weight="fill" />,
            label: "Módulos",
            value: stats?.totalModules ?? 0,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Publicados",
            value: stats?.publishedModules ?? 0,
            kind: "int",
          },
          {
            icon: <Play className="size-3.5" weight="fill" />,
            label: "Aulas",
            value: stats?.totalLessons ?? 0,
            kind: "int",
          },
        ]}
      />

      {/* ===== Toolbar: busca, status, visualização, novo ===== */}
      <Reveal immediate delayMs={60}>
        <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar módulos..."
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
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("published")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  filterStatus === "published"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye className="size-3.5" weight="fill" />
                Publicados
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("draft")}
                className={cn(
                  "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  filterStatus === "draft"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <EyeSlash className="size-3.5" weight="fill" />
                Rascunhos
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
              Novo Módulo
            </Button>
          </div>
        </div>
      </Reveal>

      {/* ===== Conteúdo ===== */}
      {isLoading ? (
        <CardGridSkeleton
          count={10}
          aspectClass="aspect-[9/16]"
          gridClass="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          withStats={false}
        />
      ) : error ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
            <span className="bg-destructive/10 text-destructive flex size-13 items-center justify-center rounded-2xl">
              <BookOpen className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">Erro ao carregar</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {error.message}
              </p>
            </div>
          </div>
        </Reveal>
      ) : filteredModules.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <BookOpen className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                {hasFilters ? "Nenhum módulo encontrado" : "Nenhum módulo criado"}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                {hasFilters
                  ? "Tente ajustar os filtros ou termos de busca."
                  : "Comece criando seu primeiro módulo para organizar as aulas da academia."}
              </p>
            </div>
            {!hasFilters && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                <Plus className="size-4" weight="bold" />
                Criar Primeiro Módulo
              </Button>
            )}
          </div>
        </Reveal>
      ) : viewMode === "grid" ? (
        /* ===== Grid view ===== */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {filteredModules.map((module, index) => {
            const fullIndex = fullIndexOf(module.id)
            const isFirst = fullIndex <= 0
            const isLast = fullIndex === modules.length - 1
            return (
              <Reveal immediate key={module.id} delayMs={(index % 5) * 60}>
                <div className="group relative">
                  <div className="glass-card relative aspect-[9/16] overflow-hidden rounded-2xl transition-shadow duration-300 hover:shadow-[0_18px_44px_-18px_color-mix(in_oklab,var(--brand-cyan)_45%,transparent)]">
                    {/* Capa */}
                    {module.coverImageUrl ? (
                      <Image
                        src={module.coverImageUrl}
                        alt={module.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="dashboard-galaxy dark absolute inset-0 flex items-center justify-center">
                        <BookOpen
                          className="size-12 text-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]"
                          weight="fill"
                        />
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 opacity-70 transition-opacity group-hover:opacity-85" />

                    {/* Topo: ordem + ações */}
                    <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                        #{module.order}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Ações do módulo"
                            className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                          >
                            <DotsThreeVertical className="size-4" weight="bold" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => openEditDialog(module)}
                          >
                            <PencilSimple className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => togglePublish.mutate({ id: module.id })}
                            disabled={togglePublish.isPending}
                          >
                            {module.isPublished ? (
                              <>
                                <EyeSlash className="size-4" />
                                Despublicar
                              </>
                            ) : (
                              <>
                                <Eye className="size-4" />
                                Publicar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleMoveModule(module, "up")}
                            disabled={moveModule.isPending || isFirst}
                          >
                            <CaretUp className="size-4" />
                            Mover para cima
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleMoveModule(module, "down")}
                            disabled={moveModule.isPending || isLast}
                          >
                            <CaretDown className="size-4" />
                            Mover para baixo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => openDeleteDialog(module)}
                          >
                            <Trash className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Badge de status */}
                    <div className="absolute top-11 right-2 z-10">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 rounded-full backdrop-blur-md",
                          module.isPublished
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                            : "border-amber-500/40 bg-amber-500/15 text-amber-400",
                        )}
                      >
                        {module.isPublished ? (
                          <Eye className="size-3" weight="fill" />
                        ) : (
                          <EyeSlash className="size-3" weight="fill" />
                        )}
                        {module.isPublished ? "Publicado" : "Rascunho"}
                      </Badge>
                    </div>

                    {/* Base: título + métricas */}
                    <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                      <h3 className="mb-2 line-clamp-2 text-sm font-bold text-white drop-shadow-lg">
                        {module.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 backdrop-blur-sm">
                          <Play className="size-3 text-white" weight="fill" />
                          <span className="text-xs font-medium text-white">
                            {module.lessonsCount}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 backdrop-blur-sm">
                          <Clock className="size-3 text-white" weight="fill" />
                          <span className="text-xs font-medium text-white">
                            {formatDuration(module.totalDuration)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Setas de mover no hover */}
                  <div className="absolute top-1/2 -left-2 z-10 flex -translate-y-1/2 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label="Mover para cima"
                      onClick={() => handleMoveModule(module, "up")}
                      disabled={moveModule.isPending || isFirst}
                      className="border-border bg-background text-foreground flex size-7 cursor-pointer items-center justify-center rounded-lg border shadow-lg transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CaretUp className="size-4" weight="bold" />
                    </button>
                    <button
                      type="button"
                      aria-label="Mover para baixo"
                      onClick={() => handleMoveModule(module, "down")}
                      disabled={moveModule.isPending || isLast}
                      className="border-border bg-background text-foreground flex size-7 cursor-pointer items-center justify-center rounded-lg border shadow-lg transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CaretDown className="size-4" weight="bold" />
                    </button>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      ) : (
        /* ===== List view ===== */
        <div className="flex flex-col gap-2">
          {filteredModules.map((module, index) => {
            const fullIndex = fullIndexOf(module.id)
            const isFirst = fullIndex <= 0
            const isLast = fullIndex === modules.length - 1
            return (
              <Reveal immediate key={module.id} delayMs={(index % 6) * 50}>
                <div className="glass-card group overflow-hidden rounded-2xl">
                  <div className="flex items-stretch">
                    {/* Faixa de ordem */}
                    <div className="border-border/60 bg-muted/30 flex shrink-0 items-center border-r px-2 sm:px-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          aria-label="Mover para cima"
                          onClick={() => handleMoveModule(module, "up")}
                          disabled={moveModule.isPending || isFirst}
                          className="text-muted-foreground hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CaretUp className="size-4" weight="bold" />
                        </button>
                        <span className="text-muted-foreground w-6 text-center text-sm font-bold tabular-nums">
                          {module.order}
                        </span>
                        <button
                          type="button"
                          aria-label="Mover para baixo"
                          onClick={() => handleMoveModule(module, "down")}
                          disabled={moveModule.isPending || isLast}
                          className="text-muted-foreground hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <CaretDown className="size-4" weight="bold" />
                        </button>
                      </div>
                    </div>

                    {/* Thumb da capa */}
                    <div className="bg-muted relative h-auto w-16 shrink-0 overflow-hidden sm:w-20">
                      {module.coverImageUrl ? (
                        <Image
                          src={module.coverImageUrl}
                          alt={module.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="dashboard-galaxy dark absolute inset-0 flex items-center justify-center">
                          <BookOpen
                            className="size-6 text-[color-mix(in_oklab,var(--brand-cyan)_35%,transparent)]"
                            weight="fill"
                          />
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="min-w-0 flex-1 p-3.5 sm:p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
                        <div className="min-w-0">
                          <div className="mb-1 flex items-center gap-2">
                            <h3 className="truncate text-[15px] font-bold sm:text-base">
                              {module.title}
                            </h3>
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 gap-1 rounded-full",
                                module.isPublished
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {module.isPublished ? "Publicado" : "Rascunho"}
                            </Badge>
                          </div>
                          {module.description && (
                            <p className="text-muted-foreground mb-2 line-clamp-1 text-sm">
                              {module.description}
                            </p>
                          )}
                          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                            <span className="inline-flex items-center gap-1">
                              <Play
                                className="text-brand-cyan not-dark:text-primary size-3.5"
                                weight="fill"
                              />
                              {module.lessonsCount} aulas
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock
                                className="size-3.5 text-violet-500 dark:text-violet-400"
                                weight="fill"
                              />
                              {formatDuration(module.totalDuration)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye
                                className="size-3.5 text-emerald-500 dark:text-emerald-400"
                                weight="fill"
                              />
                              {module.publishedLessonsCount}/{module.lessonsCount}
                            </span>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => togglePublish.mutate({ id: module.id })}
                            disabled={togglePublish.isPending}
                            className="h-9 cursor-pointer rounded-xl"
                          >
                            {module.isPublished ? (
                              <>
                                <EyeSlash className="size-4" />
                                Despublicar
                              </>
                            ) : (
                              <>
                                <Eye className="size-4" />
                                Publicar
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(module)}
                            className="h-9 cursor-pointer rounded-xl"
                          >
                            <PencilSimple className="size-4" />
                            Editar
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Mais ações"
                                className="size-9 cursor-pointer rounded-xl"
                              >
                                <DotsThreeVertical className="size-4" weight="bold" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl">
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => openDeleteDialog(module)}
                              >
                                <Trash className="size-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Criar módulo ===== */}
      <CreateModuleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* ===== Editar módulo ===== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90svh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilSimple
                className="text-brand-mint not-dark:text-primary size-5"
                weight="fill"
              />
              Editar Módulo
            </DialogTitle>
            <DialogDescription>
              Atualize as informações do módulo
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-4">
            {/* Título */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-title">Título *</Label>
              <Input
                id="edit-title"
                placeholder="Título do módulo"
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, title: e.target.value })
                }
                disabled={updateModule.isPending}
                className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
              />
            </div>

            {/* Descrição */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                placeholder="Descrição do módulo"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    description: e.target.value,
                  })
                }
                disabled={updateModule.isPending}
                className="focus-visible:ring-brand-cyan/40 min-h-[100px] resize-none rounded-xl"
              />
            </div>

            {/* Capa */}
            <div className="flex flex-col gap-3">
              <Label>Capa do Módulo</Label>
              <p className="text-muted-foreground text-xs">
                Proporção 9:16 (1080x1920) • Formato vertical
              </p>

              {editFormData.coverImageUrl ? (
                <div className="relative w-full max-w-[200px]">
                  <div className="border-brand-cyan/30 not-dark:border-primary/30 group relative aspect-[9/16] overflow-hidden rounded-xl border-2 shadow-lg">
                    <Image
                      src={editFormData.coverImageUrl}
                      alt="Capa"
                      fill
                      sizes="200px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        onClick={() =>
                          setEditFormData({
                            ...editFormData,
                            coverImageUrl: null,
                          })
                        }
                        disabled={updateModule.isPending}
                        variant="destructive"
                        size="sm"
                        className="cursor-pointer rounded-xl"
                      >
                        <X className="size-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-[200px]">
                  <UploadDropzone
                    endpoint="moduleCover"
                    onClientUploadComplete={(files) => {
                      const url = files?.[0]?.ufsUrl ?? files?.[0]?.url
                      if (url) {
                        setEditFormData((prev) => ({
                          ...prev,
                          coverImageUrl: url,
                        }))
                        toast.success("Imagem enviada!")
                      }
                    }}
                    onUploadError={(error) => {
                      toast.error("Erro no upload", {
                        description: error.message,
                      })
                    }}
                    appearance={{
                      container:
                        "border-border/70 bg-muted/20 aspect-[9/16] rounded-2xl border-dashed cursor-pointer mt-0",
                      label: "text-foreground text-sm",
                      allowedContent: "text-muted-foreground text-xs",
                      button:
                        "bg-gradient-custom text-[#04222A] text-sm font-semibold rounded-xl cursor-pointer after:bg-transparent",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Status */}
            <div className="border-border/60 bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    editFormData.isPublished
                      ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {editFormData.isPublished ? (
                    <Eye className="size-4" weight="fill" />
                  ) : (
                    <EyeSlash className="size-4" weight="fill" />
                  )}
                </span>
                <div>
                  <Label htmlFor="edit-published" className="cursor-pointer">
                    {editFormData.isPublished ? "Publicado" : "Rascunho"}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {editFormData.isPublished
                      ? "Visível para os alunos"
                      : "Oculto dos alunos"}
                  </p>
                </div>
              </div>
              <Switch
                id="edit-published"
                checked={editFormData.isPublished}
                onCheckedChange={(checked) =>
                  setEditFormData({ ...editFormData, isPublished: checked })
                }
                disabled={updateModule.isPending}
                className="cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={updateModule.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateModule}
              disabled={updateModule.isPending || !editFormData.title.trim()}
              className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
            >
              {updateModule.isPending ? (
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

      {/* ===== Excluir módulo ===== */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash className="text-destructive size-5" weight="fill" />
              Excluir Módulo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o módulo{" "}
              <strong>&quot;{selectedModule?.title}&quot;</strong>? Esta ação
              não pode ser desfeita e todas as aulas deste módulo também serão
              excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteModule.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteModule}
              disabled={deleteModule.isPending}
              className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer rounded-xl"
            >
              {deleteModule.isPending ? (
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
