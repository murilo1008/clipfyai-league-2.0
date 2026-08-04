"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  BookOpen,
  CaretDown,
  CaretUp,
  CheckCircle,
  CircleNotch,
  Clock,
  DotsThreeVertical,
  Eye,
  EyeSlash,
  Gift,
  Heart,
  LinkSimple,
  List,
  MagnifyingGlass,
  PencilSimple,
  Play,
  Plus,
  SquaresFour,
  Trash,
  VideoCamera,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { LessonsHeroViz, LessonsHeroVizSkeleton } from "@/components/academy/lessons-hero-viz"
import { HomeHero } from "@/components/home/home-hero"
import { StatTile } from "@/components/home/stat-tile"
import { Reveal } from "@/components/shared/reveal"
import {
  Bone,
  CardGridSkeleton,
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

import { CreateLessonDialog } from "../create-lesson-dialog"

/* ========================================================================
   Helpers (exatos do original)
   ======================================================================== */

// Função para formatar duração em minutos e segundos
const formatDuration = (seconds: number | null) => {
  if (!seconds) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Função para formatar duração longa
const formatDurationLong = (seconds: number | null) => {
  if (!seconds) return "0min"
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${mins}min`
  }
  return `${mins}min`
}

// Extrair thumbnail do YouTube
const getYouTubeThumbnail = (url: string) => {
  const videoId =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/.exec(
      url,
    )?.[1]
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  }
  return null
}

// Extrair ID do YouTube
const getYouTubeId = (url: string) => {
  const match =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/.exec(
      url,
    )
  return match?.[1] || null
}

// Converter URL do Google Drive para embed preview
const getDriveEmbedUrl = (url: string) => {
  const match = /\/file\/d\/([^\/]+)/.exec(url)
  if (match?.[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`
  }
  return url
}

// Gerar URL de embed para qualquer tipo de vídeo
const getVideoEmbed = (
  url: string,
): { embedUrl: string; type: "youtube" | "drive" | "gcloud" | "other" } => {
  if (!url) return { embedUrl: "", type: "other" }

  // YouTube
  const ytId = getYouTubeId(url)
  if (ytId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`,
      type: "youtube",
    }
  }

  // Google Drive
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
    return {
      embedUrl: getDriveEmbedUrl(url),
      type: "drive",
    }
  }

  // Google Cloud Storage (direct video URL)
  if (
    url.includes("storage.googleapis.com") ||
    url.includes("storage.cloud.google.com") ||
    url.includes("googleusercontent.com")
  ) {
    return {
      embedUrl: url,
      type: "gcloud",
    }
  }

  // Vimeo
  const vimeoMatch = /vimeo\.com\/(\d+)/.exec(url)
  if (vimeoMatch?.[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      type: "other",
    }
  }

  return { embedUrl: url, type: "other" }
}

const IFRAME_ALLOW =
  "accelerometer; encrypted-media; gyroscope; picture-in-picture"

type Lesson = RouterOutputs["academy"]["getAllLessons"][number]

/* ========================================================================
   Página
   ======================================================================== */

export default function Lessons() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const [filterStatus, setFilterStatus] = React.useState<
    "all" | "published" | "draft"
  >("all")
  const [filterModule, setFilterModule] = React.useState<string>("all")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false)
  const [selectedLesson, setSelectedLesson] = React.useState<Lesson | null>(
    null,
  )
  const [editFormData, setEditFormData] = React.useState({
    moduleId: "",
    title: "",
    description: "",
    videoUrl: "",
    duration: "",
    isPublished: false,
    isFree: false,
  })

  const utils = api.useUtils()

  const {
    data: lessonsData,
    isLoading: isLoadingLessons,
    error: lessonsError,
  } = api.academy.getAllLessons.useQuery()
  const { data: overviewData, isLoading: isLoadingOverview } =
    api.academy.getOverview.useQuery()

  const modules = overviewData?.modules ?? []
  const lessons = React.useMemo(() => lessonsData ?? [], [lessonsData])

  const updateLesson = api.academy.updateLesson.useMutation({
    onSuccess: () => {
      toast.success("Aula atualizada com sucesso!")
      void utils.academy.getAllLessons.invalidate()
      void utils.academy.getOverview.invalidate()
      setIsEditOpen(false)
      setSelectedLesson(null)
    },
    onError: (error) => {
      toast.error("Erro ao atualizar aula", { description: error.message })
    },
  })

  const deleteLesson = api.academy.deleteLesson.useMutation({
    onSuccess: () => {
      toast.success("Aula excluída com sucesso!")
      void utils.academy.getAllLessons.invalidate()
      void utils.academy.getOverview.invalidate()
      setIsDeleteOpen(false)
      setSelectedLesson(null)
    },
    onError: (error) => {
      toast.error("Erro ao excluir aula", { description: error.message })
    },
  })

  const togglePublish = api.academy.toggleLessonPublish.useMutation({
    onSuccess: (data) => {
      toast.success(data.isPublished ? "Aula publicada!" : "Aula despublicada!")
      void utils.academy.getAllLessons.invalidate()
      void utils.academy.getOverview.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao alterar status", { description: error.message })
    },
  })

  const toggleFree = api.academy.toggleLessonFree.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.isFree
          ? "Aula marcada como gratuita!"
          : "Aula removida do modo gratuito!",
      )
      void utils.academy.getAllLessons.invalidate()
      // Melhoria: o original esquecia de invalidar a visão geral
      void utils.academy.getOverview.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao alterar status", { description: error.message })
    },
  })

  const moveLesson = api.academy.moveLesson.useMutation({
    onSuccess: (data) => {
      // Melhoria: o backend pode responder { success: false } sem erro
      if (!data.success) {
        toast.info(
          "message" in data
            ? data.message
            : "Não é possível mover nesta direção",
        )
        return
      }
      void utils.academy.getAllLessons.invalidate()
    },
    onError: (error) => {
      toast.error("Erro ao mover aula", { description: error.message })
    },
  })

  // Filtrar aulas
  const filteredLessons = React.useMemo(() => {
    return lessons.filter((lesson) => {
      const matchesSearch =
        lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lesson.description
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ??
          false) ||
        lesson.module.title.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "published" && lesson.isPublished) ||
        (filterStatus === "draft" && !lesson.isPublished)

      const matchesModule =
        filterModule === "all" || lesson.moduleId === filterModule

      return matchesSearch && matchesStatus && matchesModule
    })
  }, [lessons, searchQuery, filterStatus, filterModule])

  // Agrupar por módulo
  const groupedLessons = React.useMemo(() => {
    const groups: Record<string, Lesson[]> = {}
    filteredLessons.forEach((lesson) => {
      groups[lesson.moduleId] ??= []
      groups[lesson.moduleId]!.push(lesson)
    })
    return groups
  }, [filteredLessons])

  // Melhoria: posição na lista COMPLETA do módulo (não no índice filtrado)
  // para desabilitar as setas de reordenação corretamente.
  const modulePositions = React.useMemo(() => {
    const byModule: Record<string, Lesson[]> = {}
    lessons.forEach((lesson) => {
      byModule[lesson.moduleId] ??= []
      byModule[lesson.moduleId]!.push(lesson)
    })
    const positions = new Map<string, { isFirst: boolean; isLast: boolean }>()
    Object.values(byModule).forEach((group) => {
      group.forEach((lesson, index) => {
        positions.set(lesson.id, {
          isFirst: index === 0,
          isLast: index === group.length - 1,
        })
      })
    })
    return positions
  }, [lessons])

  const openEditDialog = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setEditFormData({
      moduleId: lesson.moduleId,
      title: lesson.title,
      description: lesson.description ?? "",
      videoUrl: lesson.videoUrl,
      duration: lesson.duration?.toString() ?? "",
      isPublished: lesson.isPublished,
      isFree: lesson.isFree,
    })
    setIsEditOpen(true)
  }

  const openDeleteDialog = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setIsDeleteOpen(true)
  }

  const handleUpdateLesson = () => {
    if (
      !selectedLesson ||
      !editFormData.title.trim() ||
      !editFormData.videoUrl.trim()
    )
      return

    updateLesson.mutate({
      id: selectedLesson.id,
      moduleId: editFormData.moduleId,
      title: editFormData.title.trim(),
      description: editFormData.description.trim() || null,
      videoUrl: editFormData.videoUrl.trim(),
      duration: editFormData.duration ? parseInt(editFormData.duration) : null,
      isPublished: editFormData.isPublished,
      isFree: editFormData.isFree,
    })
  }

  const handleDeleteLesson = () => {
    if (!selectedLesson) return
    deleteLesson.mutate({ id: selectedLesson.id })
  }

  const handleMoveLesson = (lesson: Lesson, direction: "up" | "down") => {
    moveLesson.mutate({ id: lesson.id, direction })
  }

  const isLoading = isLoadingLessons || isLoadingOverview
  const hasActiveFilters =
    searchQuery.length > 0 || filterStatus !== "all" || filterModule !== "all"

  const publishedCount = lessons.filter((lesson) => lesson.isPublished).length
  const freeCount = lessons.filter((lesson) => lesson.isFree).length
  const totalDuration = lessons.reduce(
    (sum, lesson) => sum + (lesson.duration ?? 0),
    0,
  )

  if (lessonsError) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="glass-card flex flex-col items-center gap-4 rounded-3xl py-16 text-center">
          <span className="bg-destructive/10 text-destructive flex size-13 items-center justify-center rounded-2xl">
            <VideoCamera className="size-6" weight="fill" />
          </span>
          <div>
            <p className="text-base font-bold">Erro ao carregar</p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              {lessonsError.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      {/* ===== Hero da academia ===== */}
      <HomeHero
        eyebrow="Clipfy League · Academia"
        title={
          <>
            As <span className="text-gradient">aulas</span> da academia
          </>
        }
        subtitle="Gerencie as aulas da academia — organize por módulo, publique conteúdos, marque aulas gratuitas e acompanhe conclusões e curtidas em um só lugar."
        isLoading={isLoading}
        viz={<LessonsHeroViz />}
        vizSkeleton={<LessonsHeroVizSkeleton />}
        stats={[
          {
            icon: <VideoCamera className="size-3.5" weight="fill" />,
            label: "Aulas",
            value: lessons.length,
            kind: "int",
          },
          {
            icon: <Eye className="size-3.5" weight="fill" />,
            label: "Publicadas",
            value: publishedCount,
            kind: "int",
          },
          {
            icon: <Gift className="size-3.5" weight="fill" />,
            label: "Gratuitas",
            value: freeCount,
            kind: "int",
          },
        ]}
      />

      {/* ===== KPIs ===== */}
      <Reveal immediate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<VideoCamera className="size-4" weight="fill" />}
            label="Total"
            value={lessons.length}
            kind="int"
            hint="aulas na academia"
            accent="cyan"
            gradientValue
            isLoading={isLoading}
          />
          <StatTile
            icon={<Eye className="size-4" weight="fill" />}
            label="Publicadas"
            value={publishedCount}
            kind="int"
            hint="visíveis aos alunos"
            accent="green"
            isLoading={isLoading}
          />
          <StatTile
            icon={<Gift className="size-4" weight="fill" />}
            label="Gratuitas"
            value={freeCount}
            kind="int"
            hint="preview liberado"
            accent="cyan"
            isLoading={isLoading}
          />
          {/* Duração total é string formatada — tile custom espelhando o StatTile */}
          <div className="glass-card glass-card-hover flex flex-col gap-3 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
                Duração
              </span>
              <span className="bg-gradient-custom flex size-8 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <Clock className="size-4" weight="fill" />
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <span className="text-2xl font-bold tracking-tight tabular-nums sm:text-[1.7rem]">
                {formatDurationLong(totalDuration)}
              </span>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">de conteúdo</span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ===== Toolbar: busca, módulo, status, visualização e nova aula ===== */}
      <Reveal immediate delayMs={60}>
        {isLoading ? (
          <ToolbarSkeleton buttons={4} />
        ) : (
          <div className="glass-card flex flex-col gap-3 rounded-3xl p-3.5 sm:p-4 lg:flex-row lg:items-center">
            {/* Busca */}
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar aulas ou módulos..."
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
              {/* Filtro de módulo */}
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl sm:w-auto sm:min-w-48 data-[size=default]:h-10">
                  <span className="flex min-w-0 items-center gap-2">
                    <BookOpen
                      className="text-muted-foreground size-4 shrink-0"
                      weight="fill"
                    />
                    <SelectValue placeholder="Módulo" />
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="cursor-pointer">
                    Todos os módulos
                  </SelectItem>
                  {modules.map((module) => (
                    <SelectItem
                      key={module.id}
                      value={module.id}
                      className="cursor-pointer"
                    >
                      {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Pills de status */}
              <div className="border-border/70 bg-muted/30 flex h-10 items-center rounded-full border p-1">
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className={cn(
                    "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                    filterStatus === "all"
                      ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("published")}
                  className={cn(
                    "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                    filterStatus === "published"
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="size-3.5" weight="fill" />
                  Publicadas
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("draft")}
                  className={cn(
                    "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all",
                    filterStatus === "draft"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <EyeSlash className="size-3.5" weight="fill" />
                  Rascunhos
                </button>
              </div>

              {/* Toggle list/grid (default: lista) */}
              <div className="border-border/70 flex h-10 shrink-0 items-center overflow-hidden rounded-xl border">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="Visualização em lista"
                  className={cn(
                    "flex h-full cursor-pointer items-center justify-center px-3 transition-colors",
                    viewMode === "list"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <List className="size-4" weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Visualização em grade"
                  className={cn(
                    "border-border/70 flex h-full cursor-pointer items-center justify-center border-l px-3 transition-colors",
                    viewMode === "grid"
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <SquaresFour className="size-4" weight="fill" />
                </button>
              </div>

              <Button
                onClick={() => setIsCreateOpen(true)}
                className="btn-gradient-auth h-10 flex-1 cursor-pointer rounded-xl px-4 font-semibold sm:flex-none"
              >
                <Plus className="size-4" weight="bold" />
                Nova Aula
              </Button>
            </div>
          </div>
        )}
      </Reveal>

      {/* ===== Conteúdo ===== */}
      {isLoading ? (
        viewMode === "list" ? (
          <LessonListSkeleton />
        ) : (
          <CardGridSkeleton
            count={8}
            aspectClass="aspect-video"
            gridClass="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            withStats={false}
          />
        )
      ) : filteredLessons.length === 0 ? (
        <Reveal immediate>
          <div className="glass-card flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
            <span className="bg-gradient-custom flex size-13 items-center justify-center rounded-2xl text-[#04222A]">
              <VideoCamera className="size-6" weight="fill" />
            </span>
            <div>
              <p className="text-base font-bold">
                {hasActiveFilters ? "Nenhuma aula encontrada" : "Nenhuma aula criada"}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                {hasActiveFilters
                  ? "Tente ajustar os filtros ou termos de busca."
                  : "Comece criando sua primeira aula para a academia."}
              </p>
            </div>
            {!hasActiveFilters && (
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="btn-gradient-auth cursor-pointer rounded-xl font-semibold"
              >
                <Plus className="size-4" weight="bold" />
                Criar Primeira Aula
              </Button>
            )}
          </div>
        </Reveal>
      ) : viewMode === "list" ? (
        /* ===== List view — agrupada por módulo ===== */
        <div className="flex flex-col gap-6">
          {Object.entries(groupedLessons).map(
            ([moduleId, moduleLessons], groupIndex) => {
              const lessonModule = modules.find((item) => item.id === moduleId)
              if (!lessonModule) return null

              return (
                <Reveal immediate key={moduleId} delayMs={groupIndex * 80}>
                  <div className="flex flex-col gap-3">
                    {/* Cabeçalho do módulo */}
                    <div className="flex flex-wrap items-center gap-2.5 px-1">
                      <span className="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary flex size-7 shrink-0 items-center justify-center rounded-lg">
                        <BookOpen className="size-4" weight="fill" />
                      </span>
                      <h3 className="min-w-0 truncate text-sm font-bold tracking-tight">
                        {lessonModule.title}
                      </h3>
                      <Badge
                        variant="outline"
                        className="rounded-full text-[10px]"
                      >
                        {moduleLessons.length} aulas
                      </Badge>
                      {!lessonModule.isPublished && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-600 dark:text-amber-400"
                        >
                          Módulo em rascunho
                        </Badge>
                      )}
                    </div>

                    {/* Aulas do módulo */}
                    <div className="flex flex-col gap-2.5">
                      {moduleLessons.map((lesson, index) => {
                        const videoEmbed = getVideoEmbed(lesson.videoUrl)
                        const thumbnail =
                          lesson.thumbnailUrl ??
                          getYouTubeThumbnail(lesson.videoUrl)
                        const position = modulePositions.get(lesson.id)

                        return (
                          <Reveal
                            immediate
                            key={lesson.id}
                            delayMs={(index % 4) * 60}
                          >
                            <div className="glass-card glass-card-hover group flex items-stretch overflow-hidden rounded-3xl">
                              {/* Controles de ordem */}
                              <div className="border-border/60 bg-muted/20 flex shrink-0 items-center border-r px-2 sm:px-2.5">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Mover aula para cima"
                                    className="size-6 cursor-pointer rounded-lg"
                                    onClick={() =>
                                      handleMoveLesson(lesson, "up")
                                    }
                                    disabled={
                                      moveLesson.isPending ||
                                      (position?.isFirst ?? true)
                                    }
                                  >
                                    <CaretUp className="size-3.5" weight="bold" />
                                  </Button>
                                  <span className="text-muted-foreground w-6 text-center text-xs font-bold tabular-nums">
                                    {lesson.order}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Mover aula para baixo"
                                    className="size-6 cursor-pointer rounded-lg"
                                    onClick={() =>
                                      handleMoveLesson(lesson, "down")
                                    }
                                    disabled={
                                      moveLesson.isPending ||
                                      (position?.isLast ?? true)
                                    }
                                  >
                                    <CaretDown
                                      className="size-3.5"
                                      weight="bold"
                                    />
                                  </Button>
                                </div>
                              </div>

                              {/* Preview do vídeo */}
                              <div className="relative min-h-22 w-32 shrink-0 self-stretch overflow-hidden bg-black sm:min-h-26 sm:w-44">
                                {videoEmbed.type === "gcloud" ? (
                                  <video
                                    src={videoEmbed.embedUrl}
                                    className="absolute inset-0 h-full w-full cursor-pointer object-cover"
                                    muted
                                    preload="metadata"
                                    controlsList="nodownload"
                                    onContextMenu={(event) =>
                                      event.preventDefault()
                                    }
                                    onMouseEnter={(event) => {
                                      const video = event.currentTarget
                                      video.currentTime = 0
                                      void video.play()
                                    }}
                                    onMouseLeave={(event) => {
                                      const video = event.currentTarget
                                      video.pause()
                                      video.currentTime = 0
                                    }}
                                  />
                                ) : videoEmbed.type === "youtube" ||
                                  videoEmbed.type === "drive" ? (
                                  <iframe
                                    src={videoEmbed.embedUrl}
                                    title={lesson.title}
                                    className="absolute inset-0 h-full w-full"
                                    allow={IFRAME_ALLOW}
                                    allowFullScreen
                                    loading="lazy"
                                  />
                                ) : thumbnail ? (
                                  <Image
                                    src={thumbnail}
                                    alt={lesson.title}
                                    fill
                                    className="object-cover"
                                    sizes="176px"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)]">
                                    <Play
                                      className="text-brand-cyan size-7"
                                      weight="fill"
                                    />
                                  </div>
                                )}
                                {lesson.duration ? (
                                  <span className="pointer-events-none absolute right-1 bottom-1 z-10 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                                    {formatDuration(lesson.duration)}
                                  </span>
                                ) : null}
                              </div>

                              {/* Conteúdo */}
                              <div className="min-w-0 flex-1 p-3 sm:p-4">
                                <div className="flex items-start justify-between gap-2 sm:gap-4">
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <h4 className="max-w-full truncate text-sm font-bold tracking-tight sm:text-[15px]">
                                        {lesson.title}
                                      </h4>
                                      {lesson.isFree && (
                                        <Badge
                                          variant="outline"
                                          className="gap-1 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                                        >
                                          <Gift className="size-2.5" weight="fill" />
                                          Grátis
                                        </Badge>
                                      )}
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "shrink-0 rounded-full text-[10px]",
                                          lesson.isPublished
                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                            : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                        )}
                                      >
                                        {lesson.isPublished
                                          ? "Publicada"
                                          : "Rascunho"}
                                      </Badge>
                                    </div>
                                    {lesson.description && (
                                      <p className="text-muted-foreground mb-2 hidden text-xs leading-relaxed sm:line-clamp-1 sm:text-[13px]">
                                        {lesson.description}
                                      </p>
                                    )}
                                    <div className="text-muted-foreground flex items-center gap-3 text-xs sm:gap-4">
                                      <span className="inline-flex items-center gap-1 tabular-nums">
                                        <CheckCircle
                                          className="size-3 text-emerald-500"
                                          weight="fill"
                                        />
                                        {lesson.completedCount}
                                      </span>
                                      <span className="inline-flex items-center gap-1 tabular-nums">
                                        <Heart
                                          className="size-3 text-rose-500"
                                          weight="fill"
                                        />
                                        {lesson.likesCount}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Ações */}
                                  <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="Abrir vídeo"
                                      className="hidden size-8 cursor-pointer rounded-lg sm:flex"
                                      onClick={() =>
                                        window.open(lesson.videoUrl, "_blank")
                                      }
                                    >
                                      <ArrowSquareOut className="size-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label={
                                        lesson.isPublished
                                          ? "Despublicar aula"
                                          : "Publicar aula"
                                      }
                                      className="size-8 cursor-pointer rounded-lg"
                                      onClick={() =>
                                        togglePublish.mutate({ id: lesson.id })
                                      }
                                      disabled={togglePublish.isPending}
                                    >
                                      {lesson.isPublished ? (
                                        <EyeSlash className="size-4" />
                                      ) : (
                                        <Eye className="size-4" />
                                      )}
                                    </Button>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label="Mais ações"
                                          className="size-8 cursor-pointer rounded-lg"
                                        >
                                          <DotsThreeVertical
                                            className="size-4"
                                            weight="bold"
                                          />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-48 rounded-xl"
                                      >
                                        <DropdownMenuItem
                                          className="cursor-pointer"
                                          onClick={() => openEditDialog(lesson)}
                                        >
                                          <PencilSimple className="size-4" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="cursor-pointer"
                                          onClick={() =>
                                            toggleFree.mutate({ id: lesson.id })
                                          }
                                        >
                                          <Gift className="size-4" />
                                          {lesson.isFree
                                            ? "Remover gratuidade"
                                            : "Marcar como grátis"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="cursor-pointer"
                                          onClick={() =>
                                            window.open(
                                              lesson.videoUrl,
                                              "_blank",
                                            )
                                          }
                                        >
                                          <ArrowSquareOut className="size-4" />
                                          Abrir vídeo
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          variant="destructive"
                                          className="cursor-pointer"
                                          onClick={() =>
                                            openDeleteDialog(lesson)
                                          }
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
                          </Reveal>
                        )
                      })}
                    </div>
                  </div>
                </Reveal>
              )
            },
          )}
        </div>
      ) : (
        /* ===== Grid view ===== */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredLessons.map((lesson, index) => {
            const videoEmbed = getVideoEmbed(lesson.videoUrl)
            const thumbnail =
              lesson.thumbnailUrl ?? getYouTubeThumbnail(lesson.videoUrl)

            return (
              <Reveal immediate key={lesson.id} delayMs={(index % 4) * 60}>
                <div className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden rounded-3xl">
                  {/* Preview do vídeo */}
                  <div className="relative aspect-video w-full overflow-hidden bg-black">
                    {videoEmbed.type === "gcloud" ? (
                      <video
                        src={videoEmbed.embedUrl}
                        className="absolute inset-0 h-full w-full cursor-pointer object-cover"
                        muted
                        preload="metadata"
                        controlsList="nodownload"
                        onContextMenu={(event) => event.preventDefault()}
                        onMouseEnter={(event) => {
                          const video = event.currentTarget
                          video.currentTime = 0
                          void video.play()
                        }}
                        onMouseLeave={(event) => {
                          const video = event.currentTarget
                          video.pause()
                          video.currentTime = 0
                        }}
                      />
                    ) : videoEmbed.type === "youtube" ||
                      videoEmbed.type === "drive" ? (
                      <iframe
                        src={videoEmbed.embedUrl}
                        title={lesson.title}
                        className="absolute inset-0 h-full w-full"
                        allow={IFRAME_ALLOW}
                        allowFullScreen
                        loading="lazy"
                      />
                    ) : thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt={lesson.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)]">
                        <Play className="text-brand-cyan size-10" weight="fill" />
                      </div>
                    )}

                    {/* Duração */}
                    {lesson.duration ? (
                      <span className="pointer-events-none absolute right-2 bottom-2 z-10 rounded-lg bg-black/80 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                        {formatDuration(lesson.duration)}
                      </span>
                    ) : null}

                    {/* Status */}
                    <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center gap-1">
                      {lesson.isFree && (
                        <span className="flex size-6 items-center justify-center rounded-full bg-emerald-500/90">
                          <Gift className="size-3 text-white" weight="fill" />
                        </span>
                      )}
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full",
                          lesson.isPublished
                            ? "bg-emerald-500/90"
                            : "bg-amber-500/90",
                        )}
                      >
                        {lesson.isPublished ? (
                          <Eye className="size-3 text-white" weight="fill" />
                        ) : (
                          <EyeSlash className="size-3 text-white" weight="fill" />
                        )}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="absolute top-2 left-2 z-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Ações da aula"
                            className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                          >
                            <DotsThreeVertical className="size-4" weight="bold" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-48 rounded-xl"
                        >
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => openEditDialog(lesson)}
                          >
                            <PencilSimple className="size-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() =>
                              togglePublish.mutate({ id: lesson.id })
                            }
                          >
                            {lesson.isPublished ? (
                              <EyeSlash className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                            {lesson.isPublished ? "Despublicar" : "Publicar"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => toggleFree.mutate({ id: lesson.id })}
                          >
                            <Gift className="size-4" />
                            {lesson.isFree
                              ? "Remover gratuidade"
                              : "Marcar como grátis"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => openDeleteDialog(lesson)}
                          >
                            <Trash className="size-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Corpo */}
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h4 className="line-clamp-2 text-sm leading-tight font-bold tracking-tight">
                      {lesson.title}
                    </h4>
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      <BookOpen className="size-3 shrink-0" weight="fill" />
                      <span className="truncate">{lesson.module.title}</span>
                    </div>
                    <div className="border-border/60 text-muted-foreground mt-auto flex items-center justify-between border-t pt-2.5 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <CheckCircle
                            className="size-3 text-emerald-500"
                            weight="fill"
                          />
                          {lesson.completedCount}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Heart className="size-3 text-rose-500" weight="fill" />
                          {lesson.likesCount}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold tabular-nums">
                        #{lesson.order}
                      </span>
                    </div>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      )}

      {/* ===== Dialog "Nova Aula" ===== */}
      <CreateLessonDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* ===== Dialog "Editar Aula" ===== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[92svh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
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
                      Aula
                    </span>
                  </DialogTitle>
                  <DialogDescription className="truncate text-xs sm:text-sm">
                    Atualize as informações da aula
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
            <div className="flex flex-col gap-5">
              {/* Módulo */}
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <BookOpen
                    className="text-brand-mint not-dark:text-primary size-4"
                    weight="fill"
                  />
                  Módulo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={editFormData.moduleId}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, moduleId: value })
                  }
                >
                  <SelectTrigger className="h-11 w-full cursor-pointer rounded-xl data-[size=default]:h-11">
                    <SelectValue placeholder="Selecione um módulo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {modules.map((module) => (
                      <SelectItem
                        key={module.id}
                        value={module.id}
                        className="cursor-pointer"
                      >
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Título */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-title"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <VideoCamera
                    className="text-brand-cyan not-dark:text-primary size-4"
                    weight="fill"
                  />
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-title"
                  placeholder="Título da aula"
                  value={editFormData.title}
                  onChange={(event) =>
                    setEditFormData({
                      ...editFormData,
                      title: event.target.value,
                    })
                  }
                  className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
                />
              </div>

              {/* URL do Vídeo / Drive */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-video"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <LinkSimple className="text-muted-foreground size-4" />
                  URL do Vídeo / Google Drive{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <LinkSimple className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                  <Input
                    id="edit-video"
                    placeholder="https://youtube.com/watch?v=... ou https://drive.google.com/..."
                    value={editFormData.videoUrl}
                    onChange={(event) =>
                      setEditFormData({
                        ...editFormData,
                        videoUrl: event.target.value,
                      })
                    }
                    inputMode="url"
                    className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl pl-10"
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Suporta YouTube, Vimeo, Dailymotion, Twitch e Google Drive
                </p>
              </div>

              {/* Duração */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-duration"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <Clock className="text-muted-foreground size-4" />
                  Duração (em segundos)
                </Label>
                <Input
                  id="edit-duration"
                  type="number"
                  placeholder="Ex: 600 (10 minutos)"
                  value={editFormData.duration}
                  onChange={(event) =>
                    setEditFormData({
                      ...editFormData,
                      duration: event.target.value,
                    })
                  }
                  className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
                />
              </div>

              {/* Descrição */}
              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="edit-description"
                  className="flex items-center gap-1.5 text-sm font-semibold"
                >
                  <PencilSimple className="text-muted-foreground size-4" />
                  Descrição
                </Label>
                <Textarea
                  id="edit-description"
                  placeholder="Descrição da aula"
                  value={editFormData.description}
                  onChange={(event) =>
                    setEditFormData({
                      ...editFormData,
                      description: event.target.value,
                    })
                  }
                  className="focus-visible:ring-brand-cyan/40 min-h-20 resize-none rounded-xl"
                />
              </div>

              {/* Switches */}
              <div className="flex flex-col gap-3">
                <div className="border-border/70 bg-card/40 flex items-center justify-between rounded-2xl border p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
                      <Eye
                        className="size-4 text-emerald-500 dark:text-emerald-400"
                        weight="fill"
                      />
                    </span>
                    <Label
                      htmlFor="edit-published"
                      className="cursor-pointer text-sm font-semibold"
                    >
                      Publicar
                    </Label>
                  </div>
                  <Switch
                    id="edit-published"
                    checked={editFormData.isPublished}
                    onCheckedChange={(checked) =>
                      setEditFormData({ ...editFormData, isPublished: checked })
                    }
                  />
                </div>
                <div className="border-border/70 bg-card/40 flex items-center justify-between rounded-2xl border p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
                      <Gift
                        className="size-4 text-emerald-500 dark:text-emerald-400"
                        weight="fill"
                      />
                    </span>
                    <Label
                      htmlFor="edit-free"
                      className="cursor-pointer text-sm font-semibold"
                    >
                      Aula Gratuita
                    </Label>
                  </div>
                  <Switch
                    id="edit-free"
                    checked={editFormData.isFree}
                    onCheckedChange={(checked) =>
                      setEditFormData({ ...editFormData, isFree: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-border/60 bg-background/85 shrink-0 border-t px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={updateLesson.isPending}
                className="h-10 cursor-pointer rounded-xl sm:h-11"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleUpdateLesson}
                disabled={
                  updateLesson.isPending ||
                  !editFormData.title.trim() ||
                  !editFormData.videoUrl.trim()
                }
                className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
              >
                {updateLesson.isPending ? (
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
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== AlertDialog "Excluir Aula" ===== */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash className="text-destructive size-5" weight="fill" />
              Excluir Aula
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a aula{" "}
              <strong>&ldquo;{selectedLesson?.title}&rdquo;</strong>? Esta ação
              não pode ser desfeita e todo o progresso dos alunos será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteLesson.isPending}
              className="cursor-pointer rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              disabled={deleteLesson.isPending}
              className="bg-destructive hover:bg-destructive/90 cursor-pointer rounded-xl text-white"
            >
              {deleteLesson.isPending ? (
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
    </div>
  )
}

/* ========================================================================
   Skeleton da list view agrupada — ossos espelhando módulo + aulas
   ======================================================================== */

function LessonListSkeleton({ groups = 2 }: { groups?: number }) {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: groups }).map((_, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-3">
          {/* Cabeçalho do módulo */}
          <div className="flex items-center gap-2.5 px-1">
            <Bone delay={groupIndex * 160} className="size-7 rounded-lg" />
            <Bone delay={groupIndex * 160 + 60} className="h-4 w-40" />
            <Bone
              delay={groupIndex * 160 + 120}
              className="h-5 w-16 rounded-full"
            />
          </div>

          {/* Cards de aula */}
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: groupIndex === 0 ? 3 : 2 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="glass-card flex items-stretch overflow-hidden rounded-3xl"
                >
                  <div className="border-border/60 bg-muted/20 flex shrink-0 items-center border-r px-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <Bone delay={index * 90} className="size-5 rounded-lg" />
                      <Bone
                        delay={index * 90 + 40}
                        className="h-3.5 w-5 rounded-full"
                      />
                      <Bone
                        delay={index * 90 + 80}
                        className="size-5 rounded-lg"
                      />
                    </div>
                  </div>
                  <Bone
                    delay={index * 90 + 120}
                    className="min-h-22 w-32 shrink-0 self-stretch rounded-none sm:min-h-26 sm:w-44"
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3.5 sm:p-4">
                    <div className="flex items-center gap-2">
                      <Bone
                        delay={index * 90 + 160}
                        className="h-4 w-2/5 max-w-52"
                      />
                      <Bone
                        delay={index * 90 + 200}
                        className="h-5 w-16 rounded-full"
                      />
                    </div>
                    <Bone
                      delay={index * 90 + 240}
                      className="hidden h-3 w-3/5 max-w-80 rounded-full sm:block"
                    />
                    <div className="flex items-center gap-3">
                      <Bone
                        delay={index * 90 + 280}
                        className="h-3 w-10 rounded-full"
                      />
                      <Bone
                        delay={index * 90 + 320}
                        className="h-3 w-10 rounded-full"
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 pr-3">
                    <Bone
                      delay={index * 90 + 360}
                      className="hidden size-8 rounded-lg sm:block"
                    />
                    <Bone
                      delay={index * 90 + 400}
                      className="size-8 rounded-lg"
                    />
                    <Bone
                      delay={index * 90 + 440}
                      className="size-8 rounded-lg"
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
