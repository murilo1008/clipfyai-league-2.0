"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Circle,
  Clock,
  Crown,
  GraduationCap,
  ListBullets,
  Lock,
  Play,
  Sparkle,
  ThumbsUp,
  X,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { ClipfyProPricingDialog } from "@/components/clippers/clipfy-pro-pricing-dialog"
import { DarkScope } from "@/components/shared/dark-scope"
import { Bone } from "@/components/shared/skeletons"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { api, type RouterOutputs } from "@/trpc/react"

// ============================================================
// TIPOS
// ============================================================

type MemberContent = RouterOutputs["academy"]["getMemberContent"]
type ModuleItem = MemberContent["modules"][number]
type LessonItem = ModuleItem["lessons"][number]

// ============================================================
// HELPERS
// ============================================================

/** "m:ss" */
const formatDuration = (seconds: number | null) => {
  if (!seconds) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/** "Xh Ymin" | "Ymin" */
const formatDurationLong = (seconds: number | null) => {
  if (!seconds) return "0min"
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${mins}min`
  return `${mins}min`
}

/** Extrai o ID de um vídeo do YouTube (youtube.com | youtu.be). */
const getYouTubeId = (url: string) => {
  const match =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/.exec(
      url,
    )
  return match?.[1] ?? null
}

/** Converte URL do Google Drive para o embed /preview. */
const getDriveEmbedUrl = (url: string) => {
  const match = /\/file\/d\/([^/]+)/.exec(url)
  if (match?.[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`
  }
  return url
}

/** Resolve a URL de embed para qualquer provedor de vídeo. */
const getEmbedUrl = (
  url: string,
): { embedUrl: string; type: "youtube" | "drive" | "gcloud" | "other" } => {
  if (!url) return { embedUrl: "", type: "other" }

  // YouTube
  const ytId = getYouTubeId(url)
  if (ytId) {
    return {
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
      type: "youtube",
    }
  }

  // Google Drive / Docs
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
    return { embedUrl: getDriveEmbedUrl(url), type: "drive" }
  }

  // Vimeo
  const vimeoMatch = /vimeo\.com\/(\d+)/.exec(url)
  if (vimeoMatch?.[1]) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
      type: "other",
    }
  }

  // Google Cloud Storage (vídeo direto)
  if (
    url.includes("storage.googleapis.com") ||
    url.includes("storage.cloud.google.com")
  ) {
    return { embedUrl: url, type: "gcloud" }
  }

  return { embedUrl: url, type: "other" }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Modules() {
  const searchParams = useSearchParams()
  const initialModuleId = searchParams.get("moduleId")
  const initialLessonId = searchParams.get("lessonId")

  const [selectedLessonId, setSelectedLessonId] = React.useState<string | null>(
    null,
  )
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const [openModules, setOpenModules] = React.useState<string[]>([])
  const [isProDialogOpen, setIsProDialogOpen] = React.useState(false)
  const [hasAutoSelected, setHasAutoSelected] = React.useState(false)

  const rootRef = React.useRef<HTMLDivElement>(null)

  // ===== Usuário / assinatura =====
  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? ""
  const { data: userData, isLoading: isLoadingUser } =
    api.user.getCurrentUser.useQuery()
  const isSubscriber = userData?.subscriptionStatus === "ACTIVE"

  // ===== Dados =====
  const { data, isLoading } = api.academy.getMemberContent.useQuery()
  const utils = api.useUtils()

  const markComplete = api.academy.markLessonComplete.useMutation({
    onSuccess: () => {
      void utils.academy.getMemberContent.invalidate()
    },
  })

  const toggleLike = api.academy.toggleLessonLike.useMutation({
    onSuccess: () => {
      void utils.academy.getMemberContent.invalidate()
    },
  })

  // ===== Estado derivado =====

  // Todas as aulas achatadas (Próximo/Anterior atravessam módulos)
  const allLessons = React.useMemo(() => {
    if (!data?.modules) return []
    const lessons: Array<{
      lesson: LessonItem
      module: ModuleItem
      globalIndex: number
    }> = []
    let idx = 0
    data.modules.forEach((mod) => {
      mod.lessons.forEach((lesson) => {
        lessons.push({ lesson, module: mod, globalIndex: idx++ })
      })
    })
    return lessons
  }, [data?.modules])

  // Aula atual: selecionada ?? primeira não concluída ?? primeira
  const currentEntry = React.useMemo(() => {
    if (!allLessons.length) return null
    if (selectedLessonId) {
      return (
        allLessons.find((e) => e.lesson.id === selectedLessonId) ??
        allLessons[0]
      )
    }
    const firstUncompleted = allLessons.find((e) => !e.lesson.isCompleted)
    return firstUncompleted ?? allLessons[0]
  }, [allLessons, selectedLessonId])

  const currentLesson = currentEntry?.lesson ?? null
  const currentModule = currentEntry?.module ?? null
  const currentGlobalIndex = currentEntry?.globalIndex ?? 0

  const nextEntry = allLessons[currentGlobalIndex + 1] ?? null
  const prevEntry =
    currentGlobalIndex > 0 ? (allLessons[currentGlobalIndex - 1] ?? null) : null

  // Auto-seleção via URL: ?lessonId= (prioridade) ou ?moduleId= (uma vez)
  React.useEffect(() => {
    if (hasAutoSelected || allLessons.length === 0) return
    if (!initialLessonId && !initialModuleId) return

    if (initialLessonId) {
      const entry = allLessons.find((e) => e.lesson.id === initialLessonId)
      if (entry) {
        setSelectedLessonId(entry.lesson.id)
        setOpenModules((prev) =>
          prev.includes(entry.module.id) ? prev : [...prev, entry.module.id],
        )
        setHasAutoSelected(true)
        return
      }
    }

    if (initialModuleId) {
      const firstLessonOfModule = allLessons.find(
        (e) => e.module.id === initialModuleId,
      )
      if (firstLessonOfModule) {
        setSelectedLessonId(firstLessonOfModule.lesson.id)
        setOpenModules((prev) =>
          prev.includes(initialModuleId) ? prev : [...prev, initialModuleId],
        )
      }
    }
    setHasAutoSelected(true)
  }, [initialLessonId, initialModuleId, allLessons, hasAutoSelected])

  // Auto-abre no accordion o módulo da aula atual
  const currentModuleId = currentModule?.id
  React.useEffect(() => {
    if (currentModuleId) {
      setOpenModules((prev) =>
        prev.includes(currentModuleId) ? prev : [...prev, currentModuleId],
      )
    }
  }, [currentModuleId])

  // ===== Handlers =====

  const selectLesson = React.useCallback((lessonId: string) => {
    setSelectedLessonId(lessonId)
    setIsSidebarOpen(false)
    // Volta ao topo (o scroll vive no container do dashboard)
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [])

  const handleMarkComplete = React.useCallback(() => {
    if (!currentLesson) return
    const newCompleted = !currentLesson.isCompleted
    markComplete.mutate(
      { lessonId: currentLesson.id, completed: newCompleted },
      {
        onSuccess: () => {
          toast.success(
            newCompleted ? "Aula marcada como concluída!" : "Aula desmarcada",
          )
          // Auto-avança para a próxima aula ao concluir
          if (newCompleted && nextEntry) {
            setTimeout(() => selectLesson(nextEntry.lesson.id), 500)
          }
        },
        onError: () => {
          toast.error("Erro ao atualizar progresso")
        },
      },
    )
  }, [currentLesson, markComplete, nextEntry, selectLesson])

  const handleToggleLike = React.useCallback(() => {
    if (!currentLesson) return
    toggleLike.mutate(
      { lessonId: currentLesson.id },
      {
        onSuccess: (result) => {
          toast.success(result.liked ? "Curtiu a aula! 👍" : "Descurtiu a aula")
        },
        onError: () => {
          toast.error("Erro ao curtir aula")
        },
      },
    )
  }, [currentLesson, toggleLike])

  const handleGoNext = React.useCallback(() => {
    if (nextEntry) selectLesson(nextEntry.lesson.id)
  }, [nextEntry, selectLesson])

  const handleGoPrev = React.useCallback(() => {
    if (prevEntry) selectLesson(prevEntry.lesson.id)
  }, [prevEntry, selectLesson])

  // ===== Embed =====
  const embedInfo = React.useMemo(() => {
    if (!currentLesson?.videoUrl) return null
    return getEmbedUrl(currentLesson.videoUrl)
  }, [currentLesson?.videoUrl])

  const stats = data?.stats

  // ============================================================
  // LOADING — skeleton espelhando o layout do player
  // ============================================================

  if (isLoading) {
    return <ModulesSkeleton />
  }

  // ============================================================
  // BLOQUEIO PRO (não assinante)
  // ============================================================

  if (!isLoading && !isLoadingUser && !isSubscriber) {
    return (
      <>
        <DarkScope className="contents">
          <div className="relative flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#050f1c_0%,#0a1c2b_100%)] p-8">
            {/* Ambiente animado da marca */}
            <span
              aria-hidden
              className="arena-aurora pointer-events-none absolute -top-20 right-[12%] size-80 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,#f59e0b_22%,transparent),transparent_66%)] blur-2xl"
            />
            <span
              aria-hidden
              className="arena-aurora pointer-events-none absolute bottom-[4%] left-[8%] size-80 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand-cyan)_20%,transparent),transparent_66%)] blur-2xl"
              style={{ animationDelay: "-7s" }}
            />
            <div
              aria-hidden
              className="hero-grid pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_50%_45%,#000_30%,transparent_80%)]"
            />
            {[
              { left: "18%", bottom: "18%", size: 3, delay: 0.4, dur: 5.8, x: 12 },
              { left: "40%", bottom: "10%", size: 2, delay: 2.2, dur: 6.6, x: -10 },
              { left: "64%", bottom: "16%", size: 3, delay: 1.2, dur: 5.4, x: 8 },
              { left: "86%", bottom: "12%", size: 2, delay: 3.4, dur: 6.2, x: -12 },
            ].map((particle, index) => (
              <span
                key={index}
                aria-hidden
                className="arena-particle pointer-events-none absolute rounded-full bg-amber-400"
                style={
                  {
                    left: particle.left,
                    bottom: particle.bottom,
                    width: particle.size,
                    height: particle.size,
                    "--particle-delay": `${particle.delay}s`,
                    "--particle-dur": `${particle.dur}s`,
                    "--particle-x": `${particle.x}px`,
                    "--particle-opacity": 0.7,
                  } as React.CSSProperties
                }
              />
            ))}
            {[
              { left: "24%", top: "20%", size: 11, delay: 0.3, dur: 3.8 },
              { left: "74%", top: "14%", size: 13, delay: 1.6, dur: 3.4 },
              { left: "82%", top: "66%", size: 10, delay: 2.6, dur: 4.2 },
            ].map((sparkle, index) => (
              <Sparkle
                key={index}
                aria-hidden
                weight="fill"
                className="arena-twinkle pointer-events-none absolute text-amber-400"
                style={
                  {
                    left: sparkle.left,
                    top: sparkle.top,
                    width: sparkle.size,
                    height: sparkle.size,
                    "--twinkle-delay": `${sparkle.delay}s`,
                    "--twinkle-dur": `${sparkle.dur}s`,
                    "--twinkle-opacity": 0.85,
                  } as React.CSSProperties
                }
              />
            ))}

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative z-10 mx-4 flex max-w-md flex-col items-center gap-6 text-center"
            >
              {/* Cadeado com anéis da marca */}
              <div className="relative">
                <span
                  aria-hidden
                  className="hero-pulse-ring absolute -inset-5 rounded-full bg-amber-500/35"
                />
                <span
                  aria-hidden
                  className="arena-ring absolute -inset-2.5 rounded-full bg-[conic-gradient(from_0deg,transparent_12%,color-mix(in_oklab,#f59e0b_75%,transparent)_30%,transparent_48%,color-mix(in_oklab,var(--brand-cyan)_55%,transparent)_72%,transparent_88%)] [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2.5px))]"
                />
                <span className="relative flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-2xl shadow-amber-500/40">
                  <Lock className="size-11 text-white" weight="fill" />
                </span>
                <span className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-400 shadow-lg">
                  <Crown className="size-4 text-white" weight="fill" />
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-[#ecf7f9] sm:text-3xl">
                  Conteúdo Exclusivo{" "}
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                    PRO
                  </span>
                </h2>
                <p className="text-sm leading-relaxed text-[#8aa3b3] sm:text-base">
                  Assine o Clipfy PRO para ter acesso completo a todos os
                  módulos e aulas da academia.
                </p>
              </div>

              <Button
                onClick={() => setIsProDialogOpen(true)}
                size="lg"
                className="btn-gradient-auth h-12 cursor-pointer rounded-xl px-8 text-base font-bold"
              >
                <Crown className="size-5" weight="fill" />
                Desbloquear com PRO
              </Button>

              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-[#8aa3b3] hover:text-[#ecf7f9]"
              >
                <Link href="/classes">
                  <ArrowLeft className="size-4" />
                  Voltar para Academia
                </Link>
              </Button>
            </motion.div>
          </div>
        </DarkScope>

        <ClipfyProPricingDialog
          open={isProDialogOpen}
          onOpenChange={setIsProDialogOpen}
          userEmail={userEmail}
        />
      </>
    )
  }

  // ============================================================
  // VAZIO
  // ============================================================

  if (!data?.modules?.length) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center p-8">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <span className="bg-gradient-custom flex size-16 items-center justify-center rounded-2xl text-[#04222A]">
            <GraduationCap className="size-8" weight="fill" />
          </span>
          <h2 className="text-xl font-semibold">Nenhum conteúdo disponível</h2>
          <p className="text-muted-foreground">
            Os módulos e aulas serão disponibilizados em breve.
          </p>
          <Button variant="outline" asChild className="cursor-pointer rounded-xl">
            <Link href="/classes">
              <ArrowLeft className="size-4" />
              Voltar para Academia
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <TooltipProvider>
      <div
        ref={rootRef}
        className="bg-background flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row"
      >
        {/* ================= CONTEÚDO PRINCIPAL ================= */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Player de vídeo */}
          <div className="group relative aspect-video w-full overflow-hidden bg-black">
            {currentLesson && embedInfo ? (
              embedInfo.type === "gcloud" ? (
                <video
                  key={currentLesson.id}
                  src={embedInfo.embedUrl}
                  className="absolute inset-0 h-full w-full cursor-pointer"
                  controls
                  autoPlay
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  playsInline
                >
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              ) : (
                <iframe
                  key={currentLesson.id}
                  src={embedInfo.embedUrl}
                  className="absolute inset-0 h-full w-full"
                  title={currentLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; web-share; picture-in-picture"
                  allowFullScreen
                />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="flex size-16 items-center justify-center rounded-full bg-white/10">
                  <Play className="size-8 text-white/50" weight="fill" />
                </span>
                <p className="text-sm text-white/50">
                  Selecione uma aula para assistir
                </p>
              </div>
            )}
          </div>

          {/* Informações da aula */}
          {currentLesson && currentModule && (
            <motion.div
              key={currentLesson.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4 p-4 md:p-6"
            >
              {/* Breadcrumb */}
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Link
                  href="/classes"
                  className="hover:text-foreground transition-colors"
                >
                  Início
                </Link>
                <CaretRight className="size-3.5" />
                <span className="text-foreground truncate font-medium">
                  {currentModule.title}
                </span>
              </div>

              {/* Título e descrição */}
              <div className="flex flex-col gap-2">
                <h1 className="text-foreground text-xl leading-tight font-bold tracking-tight md:text-2xl">
                  {currentLesson.title}
                </h1>
                {currentLesson.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed md:text-base">
                    {currentLesson.description}
                  </p>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {currentLesson.duration ? (
                  <Badge
                    variant="outline"
                    className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5 gap-1.5 rounded-full font-normal"
                  >
                    <Clock
                      className="text-brand-cyan not-dark:text-primary size-3.5"
                      weight="fill"
                    />
                    {formatDurationLong(currentLesson.duration)}
                  </Badge>
                ) : null}
                {currentLesson.isCompleted && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle className="size-3.5" weight="fill" />
                    Concluída
                  </Badge>
                )}
              </div>

              <div className="border-border border-t" />

              {/* Ações */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Marcar como visto */}
                <Button
                  variant={currentLesson.isCompleted ? "outline" : "default"}
                  size="sm"
                  onClick={handleMarkComplete}
                  disabled={markComplete.isPending}
                  className={cn(
                    "cursor-pointer gap-2 rounded-xl font-semibold transition-all",
                    currentLesson.isCompleted
                      ? "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
                      : "btn-gradient-auth",
                  )}
                >
                  {currentLesson.isCompleted ? (
                    <>
                      <CheckCircle className="size-4" weight="fill" />
                      <span className="hidden sm:inline">
                        Desmarcar como visto
                      </span>
                      <span className="sm:hidden">Desmarcar</span>
                    </>
                  ) : (
                    <>
                      <Circle className="size-4" />
                      <span className="hidden sm:inline">Marcar como visto</span>
                      <span className="sm:hidden">Marcar</span>
                    </>
                  )}
                </Button>

                {/* Curtir */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleLike}
                      disabled={toggleLike.isPending}
                      className={cn(
                        "cursor-pointer gap-2 rounded-xl transition-all",
                        currentLesson.isLiked &&
                          "border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5 hover:bg-brand-cyan/10 hover:text-brand-cyan not-dark:border-primary/30 not-dark:text-primary not-dark:bg-primary/5 not-dark:hover:text-primary",
                      )}
                    >
                      <ThumbsUp
                        className="size-4"
                        weight={currentLesson.isLiked ? "fill" : "regular"}
                      />
                      <span className="tabular-nums">
                        {currentLesson.likesCount}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {currentLesson.isLiked ? "Descurtir" : "Curtir"} esta aula
                  </TooltipContent>
                </Tooltip>

                {/* Conteúdo (sidebar mobile) */}
                <Button
                  variant="outline"
                  size="sm"
                  className="cursor-pointer gap-2 rounded-xl lg:hidden"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <ListBullets className="size-4" weight="bold" />
                  <span className="hidden sm:inline">Conteúdo</span>
                </Button>

                <div className="flex-1" />

                {/* Navegação */}
                <div className="flex items-center gap-2">
                  {prevEntry && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGoPrev}
                          className="cursor-pointer gap-1.5 rounded-xl"
                        >
                          <CaretLeft className="size-4" weight="bold" />
                          <span className="hidden sm:inline">Anterior</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{prevEntry.lesson.title}</TooltipContent>
                    </Tooltip>
                  )}
                  {nextEntry && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          onClick={handleGoNext}
                          className="btn-gradient-auth cursor-pointer gap-1.5 rounded-xl font-semibold"
                        >
                          <span className="hidden sm:inline">Próximo</span>
                          <CaretRight className="size-4" weight="bold" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{nextEntry.lesson.title}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============ LISTA INLINE MOBILE (abaixo do player) ============ */}
          <div className="border-border border-t lg:hidden">
            <div className="p-4 pb-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <ListBullets
                    className="text-brand-cyan not-dark:text-primary size-4"
                    weight="bold"
                  />
                  Conteúdo do Curso
                </h2>
                {stats && (
                  <Badge
                    variant="outline"
                    className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5 rounded-full text-xs font-normal"
                  >
                    {stats.completedLessons}/{stats.totalLessons}
                  </Badge>
                )}
              </div>
              {stats && (
                <div className="mb-3 flex flex-col gap-1.5">
                  <Progress value={stats.overallProgress} className="h-1.5" />
                  <p className="text-muted-foreground text-xs">
                    {stats.overallProgress}% concluído
                  </p>
                </div>
              )}
            </div>

            <div className="px-2 pb-6">
              <CourseContent
                modules={data.modules}
                openModules={openModules}
                onOpenModulesChange={setOpenModules}
                currentLessonId={currentLesson?.id ?? null}
                currentModuleId={currentModule?.id ?? null}
                onSelectLesson={selectLesson}
              />
            </div>
          </div>
        </div>

        {/* ================= SIDEBAR DESKTOP ================= */}
        <div className="border-border bg-muted/20 hidden w-[380px] flex-col border-l lg:flex xl:w-[400px]">
          <div className="border-border bg-background/50 border-b p-4 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <ListBullets
                  className="text-brand-cyan not-dark:text-primary size-4"
                  weight="bold"
                />
                Conteúdo do Curso
              </h2>
              {stats && (
                <Badge
                  variant="outline"
                  className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5 rounded-full text-xs font-normal"
                >
                  {stats.completedLessons}/{stats.totalLessons} aulas
                </Badge>
              )}
            </div>
            {stats && (
              <div className="flex flex-col gap-1.5">
                <Progress value={stats.overallProgress} className="h-1.5" />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>{stats.overallProgress}% concluído</span>
                  <span>{formatDurationLong(stats.totalDuration)} total</span>
                </div>
              </div>
            )}
          </div>

          <ScrollArea
            className="flex-1 overflow-y-auto"
            style={{ maxHeight: "calc(100vh - 12rem)" }}
          >
            <div className="px-2 py-2">
              <CourseContent
                modules={data.modules}
                openModules={openModules}
                onOpenModulesChange={setOpenModules}
                currentLessonId={currentLesson?.id ?? null}
                currentModuleId={currentModule?.id ?? null}
                onSelectLesson={selectLesson}
                showDuration
              />
            </div>
          </ScrollArea>
        </div>

        {/* ================= SIDEBAR MOBILE (overlay) ================= */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />

              {/* Painel */}
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="bg-background border-border fixed top-0 right-0 bottom-0 z-50 flex w-[85vw] max-w-[400px] flex-col border-l lg:hidden"
              >
                <div className="border-border border-b p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <ListBullets
                        className="text-brand-cyan not-dark:text-primary size-4"
                        weight="bold"
                      />
                      Conteúdo do Curso
                    </h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 cursor-pointer"
                      onClick={() => setIsSidebarOpen(false)}
                      aria-label="Fechar conteúdo do curso"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  {stats && (
                    <div className="flex flex-col gap-1.5">
                      <Progress
                        value={stats.overallProgress}
                        className="h-1.5"
                      />
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>
                          {stats.completedLessons}/{stats.totalLessons} aulas
                        </span>
                        <span>{stats.overallProgress}%</span>
                      </div>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="px-2 py-2">
                    <CourseContent
                      modules={data.modules}
                      openModules={openModules}
                      onOpenModulesChange={setOpenModules}
                      currentLessonId={currentLesson?.id ?? null}
                      currentModuleId={currentModule?.id ?? null}
                      onSelectLesson={selectLesson}
                      showDuration
                    />
                  </div>
                </ScrollArea>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <ClipfyProPricingDialog
        open={isProDialogOpen}
        onOpenChange={setIsProDialogOpen}
        userEmail={userEmail}
      />
    </TooltipProvider>
  )
}

/* ============================================================
   ACCORDION DE CONTEÚDO DO CURSO (compartilhado pelas 3 listas)
   ============================================================ */

function CourseContent({
  modules,
  openModules,
  onOpenModulesChange,
  currentLessonId,
  currentModuleId,
  onSelectLesson,
  showDuration = true,
}: {
  modules: ModuleItem[]
  openModules: string[]
  onOpenModulesChange: (value: string[]) => void
  currentLessonId: string | null
  currentModuleId: string | null
  onSelectLesson: (lessonId: string) => void
  showDuration?: boolean
}) {
  return (
    <Accordion
      type="multiple"
      value={openModules}
      onValueChange={onOpenModulesChange}
    >
      {modules.map((mod, modIdx) => (
        <AccordionItem
          key={mod.id}
          value={mod.id}
          className="mb-1 overflow-hidden border-b-0"
        >
          <AccordionTrigger className="hover:bg-muted/50 min-w-0 cursor-pointer overflow-hidden rounded-xl px-3 py-3 transition-colors hover:no-underline [&[data-state=open]]:bg-muted/50 [&>svg]:flex-shrink-0">
            <div className="flex w-0 min-w-0 flex-1 items-center gap-3 overflow-hidden">
              {/* Indicador do módulo */}
              <span
                className={cn(
                  "flex size-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  mod.progress === 100
                    ? "bg-gradient-custom text-[#04222A]"
                    : currentModuleId === mod.id
                      ? "bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {mod.progress === 100 ? (
                  <CheckCircle className="size-4" weight="fill" />
                ) : (
                  modIdx + 1
                )}
              </span>
              <div className="min-w-0 flex-1 overflow-hidden text-left">
                <p className="truncate text-sm font-medium">{mod.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {mod.completedLessonsCount}/{mod.lessonsCount} aulas
                  {mod.totalDuration > 0 && (
                    <> · {formatDurationLong(mod.totalDuration)}</>
                  )}
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-1">
            <div className="flex flex-col gap-0.5 pl-2">
              {mod.lessons.map((lesson, lessonIdx) => {
                const isActive = currentLessonId === lesson.id
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onSelectLesson(lesson.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                      isActive
                        ? "bg-brand-cyan/10 border-brand-cyan/20 not-dark:bg-primary/10 not-dark:border-primary/20 border"
                        : "hover:bg-muted/30 active:bg-muted/40",
                    )}
                  >
                    {/* Ícone de status */}
                    <span className="flex-shrink-0">
                      {lesson.isCompleted ? (
                        <CheckCircle
                          className="text-brand-cyan not-dark:text-primary size-4.5"
                          weight="fill"
                        />
                      ) : isActive ? (
                        <span className="border-brand-cyan bg-brand-cyan/20 not-dark:border-primary not-dark:bg-primary/20 flex size-4.5 items-center justify-center rounded-full border-2">
                          <Play
                            className="text-brand-cyan not-dark:text-primary size-2.5"
                            weight="fill"
                          />
                        </span>
                      ) : (
                        <Circle className="text-muted-foreground/40 size-4.5" />
                      )}
                    </span>

                    {/* Título */}
                    <p
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        isActive
                          ? "text-brand-cyan not-dark:text-primary font-medium"
                          : lesson.isCompleted
                            ? "text-muted-foreground"
                            : "text-foreground",
                      )}
                    >
                      {lessonIdx + 1}. {lesson.title}
                    </p>

                    {/* Duração */}
                    {showDuration && lesson.duration ? (
                      <span className="text-muted-foreground flex-shrink-0 text-xs tabular-nums">
                        {formatDuration(lesson.duration)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/* ============================================================
   SKELETON — espelha o layout do player com o kit da marca
   ============================================================ */

function ModulesSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Player */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="dark relative aspect-video w-full overflow-hidden bg-[#050f1c]">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex size-16 items-center justify-center rounded-full bg-white/10">
              <span
                aria-hidden
                className="hero-pulse-ring absolute -inset-2 rounded-full bg-[color-mix(in_oklab,var(--brand-cyan)_30%,transparent)]"
              />
              <Play className="relative size-8 text-white/40" weight="fill" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <span className="skeleton-bone block h-full w-1/3 rounded-none" />
          </div>
        </div>

        {/* Bloco de informações */}
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <div className="flex items-center gap-2">
            <Bone className="h-4 w-16 rounded-full" />
            <Bone delay={60} className="size-4 rounded-full" />
            <Bone delay={120} className="h-4 w-36 rounded-full" />
          </div>
          <Bone delay={180} className="h-7 w-3/4 max-w-md" />
          <div className="flex flex-col gap-2">
            <Bone delay={240} className="h-4 w-full rounded-full" />
            <Bone delay={300} className="h-4 w-5/6 rounded-full" />
            <Bone delay={360} className="h-4 w-2/3 rounded-full" />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Bone delay={420} className="h-9 w-44 rounded-xl" />
            <Bone delay={480} className="h-9 w-24 rounded-xl" />
            <div className="flex-1" />
            <Bone delay={540} className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="border-border bg-muted/20 hidden w-[380px] flex-col border-l lg:flex xl:w-[400px]">
        <div className="border-border flex flex-col gap-3 border-b p-4">
          <div className="flex items-center justify-between">
            <Bone className="h-5 w-40" />
            <Bone delay={60} className="h-5 w-20 rounded-full" />
          </div>
          <Bone delay={120} className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Bone delay={180} className="h-3 w-24 rounded-full" />
            <Bone delay={240} className="h-3 w-16 rounded-full" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="bg-muted/40 flex items-center gap-3 rounded-xl p-3">
                <Bone delay={index * 140} className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Bone delay={index * 140 + 60} className="h-4 w-3/4" />
                  <Bone
                    delay={index * 140 + 120}
                    className="h-3 w-1/3 rounded-full"
                  />
                </div>
              </div>
              {index === 0 && (
                <div className="flex flex-col gap-1 pl-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 rounded-xl p-2.5"
                    >
                      <Bone delay={j * 100} className="size-5 rounded-full" />
                      <Bone delay={j * 100 + 50} className="h-4 w-2/3" />
                      <div className="flex-1" />
                      <Bone
                        delay={j * 100 + 100}
                        className="h-3 w-10 rounded-full"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
