"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowSquareOut,
  BookOpen,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Eye,
  EyeSlash,
  FileText,
  Gift,
  Hash,
  Lightbulb,
  LinkSimple,
  Play,
  Sparkle,
  TextT,
  VideoCamera,
  WarningCircle,
  X,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"

const STEPS = [
  { id: 1, title: "Módulo", icon: BookOpen, description: "Selecionar módulo" },
  { id: 2, title: "Informações", icon: TextT, description: "Título e descrição" },
  { id: 3, title: "Conteúdo", icon: VideoCamera, description: "URL do vídeo ou Drive" },
  { id: 4, title: "Publicar", icon: Eye, description: "Visibilidade" },
] as const

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

// Validar URL de vídeo ou Drive.
// Melhoria: aceita também Google Cloud Storage (o original bloqueava na
// criação, mas reproduzia esses links normalmente na listagem).
const isValidVideoUrl = (url: string) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be") ||
      parsed.hostname.includes("vimeo.com") ||
      parsed.hostname.includes("dailymotion.com") ||
      parsed.hostname.includes("twitch.tv") ||
      parsed.hostname.includes("drive.google.com") ||
      parsed.hostname.includes("docs.google.com") ||
      parsed.hostname.includes("storage.googleapis.com") ||
      parsed.hostname.includes("storage.cloud.google.com") ||
      parsed.hostname.includes("googleusercontent.com")
    )
  } catch {
    return false
  }
}

// Formatar duração
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const DURATION_PRESETS = [
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
  { label: "1 hora", value: 3600 },
] as const

export function CreateLessonDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultModuleId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultModuleId?: string
}) {
  const [step, setStep] = React.useState(1)
  const [formData, setFormData] = React.useState({
    moduleId: defaultModuleId ?? "",
    title: "",
    description: "",
    videoUrl: "",
    duration: "",
    isPublished: false,
    isFree: false,
  })

  const utils = api.useUtils()

  // Buscar módulos existentes
  const { data: overviewData } = api.academy.getOverview.useQuery(undefined, {
    enabled: open,
  })

  const modules = React.useMemo(
    () => overviewData?.modules ?? [],
    [overviewData],
  )

  // Inicializar moduleId se defaultModuleId for passado
  React.useEffect(() => {
    if (open && defaultModuleId) {
      setFormData((prev) => ({
        ...prev,
        moduleId: defaultModuleId,
      }))
    }
  }, [open, defaultModuleId])

  // Thumbnail do vídeo
  const videoThumbnail = React.useMemo(() => {
    if (!formData.videoUrl) return null
    return getYouTubeThumbnail(formData.videoUrl)
  }, [formData.videoUrl])

  // Módulo selecionado
  const selectedModule = React.useMemo(() => {
    return modules.find((module) => module.id === formData.moduleId)
  }, [modules, formData.moduleId])

  const createLesson = api.academy.createLesson.useMutation({
    onSuccess: () => {
      toast.success("Aula criada com sucesso!", {
        description: formData.isPublished
          ? "A aula já está publicada e visível."
          : "A aula foi salva como rascunho.",
      })
      void utils.academy.getOverview.invalidate()
      void utils.academy.getAllLessons.invalidate()
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error("Erro ao criar aula", {
        description: error.message,
      })
    },
  })

  const resetForm = () => {
    setStep(1)
    setFormData({
      moduleId: defaultModuleId ?? "",
      title: "",
      description: "",
      videoUrl: "",
      duration: "",
      isPublished: false,
      isFree: false,
    })
  }

  const handleSubmit = () => {
    if (!formData.moduleId) {
      toast.error("Módulo obrigatório", {
        description: "Por favor, selecione um módulo.",
      })
      setStep(1)
      return
    }

    if (!formData.title.trim()) {
      toast.error("Título obrigatório", {
        description: "Por favor, informe um título para a aula.",
      })
      setStep(2)
      return
    }

    if (!formData.videoUrl.trim() || !isValidVideoUrl(formData.videoUrl)) {
      toast.error("URL inválida", {
        description: "Por favor, informe uma URL de vídeo ou Google Drive válida.",
      })
      setStep(3)
      return
    }

    createLesson.mutate({
      moduleId: formData.moduleId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      videoUrl: formData.videoUrl.trim(),
      duration: formData.duration ? parseInt(formData.duration) : undefined,
      isPublished: formData.isPublished,
      isFree: formData.isFree,
    })
  }

  const handleClose = () => {
    if (createLesson.isPending) return
    resetForm()
    onOpenChange(false)
  }

  const nextStep = () => {
    if (step === 1 && !formData.moduleId) {
      toast.error("Módulo obrigatório", {
        description: "Por favor, selecione um módulo para continuar.",
      })
      return
    }
    if (step === 2 && !formData.title.trim()) {
      toast.error("Título obrigatório", {
        description: "Por favor, informe um título para continuar.",
      })
      return
    }
    if (
      step === 3 &&
      (!formData.videoUrl.trim() || !isValidVideoUrl(formData.videoUrl))
    ) {
      toast.error("URL inválida", {
        description: "Por favor, informe uma URL de vídeo ou Google Drive válida.",
      })
      return
    }
    if (step < STEPS.length) setStep(step + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(step - 1)
  }

  const isStepComplete = (stepId: number) => {
    switch (stepId) {
      case 1:
        return formData.moduleId.length > 0
      case 2:
        return formData.title.trim().length > 0
      case 3:
        return (
          formData.videoUrl.trim().length > 0 &&
          isValidVideoUrl(formData.videoUrl)
        )
      case 4:
        return true
      default:
        return false
    }
  }

  const urlIsValid = isValidVideoUrl(formData.videoUrl)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[96svh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:h-[min(90svh,52rem)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden lg:flex-row">
          {/* ===== Sidebar de progresso (desktop) ===== */}
          <div className="border-border/60 bg-muted/20 relative hidden w-72 shrink-0 flex-col overflow-hidden border-r p-6 lg:flex">
            <div
              aria-hidden
              className="bg-gradient-custom pointer-events-none absolute -top-20 -left-16 size-44 rounded-full opacity-10 blur-3xl"
            />
            <div className="relative mb-8 flex items-center gap-3">
              <span className="bg-gradient-custom flex size-11 shrink-0 items-center justify-center rounded-xl text-[#04222A] shadow-[0_8px_24px_-8px_var(--brand-cyan)]">
                <VideoCamera className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Nova{" "}
                  <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                    Aula
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Adicionar conteúdo à academia
                </DialogDescription>
              </div>
            </div>

            <nav className="relative flex flex-1 flex-col gap-2">
              {STEPS.map((s) => {
                const StepIcon = s.icon
                const isActive = step === s.id
                const isComplete =
                  step > s.id || (step === s.id && isStepComplete(s.id))

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    disabled={s.id > step && !isStepComplete(step)}
                    className={cn(
                      "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-300",
                      isActive
                        ? "border-brand-cyan/30 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5"
                        : "hover:bg-muted/50 border-transparent",
                      s.id > step &&
                        !isStepComplete(step) &&
                        "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all",
                        isActive &&
                          "bg-gradient-custom text-[#04222A] shadow-[0_8px_20px_-8px_var(--brand-cyan)]",
                        isComplete &&
                          !isActive &&
                          "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
                        !isActive && !isComplete && "bg-muted text-muted-foreground",
                      )}
                    >
                      {isComplete && !isActive ? (
                        <Check className="size-5" weight="bold" />
                      ) : (
                        <StepIcon
                          className="size-5"
                          weight={isActive ? "fill" : "regular"}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-semibold",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {s.description}
                      </span>
                    </span>
                    {isActive && (
                      <CaretRight
                        className="text-brand-mint not-dark:text-primary size-4"
                        weight="bold"
                      />
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="relative mt-6 flex flex-col gap-2">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Progresso</span>
                <span className="tabular-nums">
                  {Math.round((step / STEPS.length) * 100)}%
                </span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <motion.div
                  className="bg-gradient-custom h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>

          {/* ===== Header mobile ===== */}
          <div className="border-border/60 bg-card/50 flex items-center justify-between gap-3 border-b p-4 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="bg-gradient-custom flex size-9 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                <VideoCamera className="size-4" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-bold">
                  Nova{" "}
                  <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                    Aula
                  </span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preencha as informações para criar uma nova aula
                </DialogDescription>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-1.5">
                {STEPS.map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      step === s.id && "bg-gradient-custom w-6",
                      step > s.id && "w-2 bg-emerald-500",
                      step < s.id && "bg-muted w-2",
                    )}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={handleClose}
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>
          </div>

          {/* ===== Conteúdo ===== */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ScrollArea className="h-0 flex-1">
              <div className="overflow-hidden p-4 sm:p-6 lg:p-8">
                <AnimatePresence mode="wait">
                  {/* Step 1: Módulo */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-6"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="text-brand-mint not-dark:text-primary flex items-center gap-2">
                          <BookOpen className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 1 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Selecionar Módulo
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Escolha o módulo onde a aula será adicionada
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        {modules.length === 0 ? (
                          <div className="border-border/70 bg-muted/20 rounded-2xl border-2 border-dashed p-8 text-center">
                            <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/10">
                              <WarningCircle
                                className="size-7 text-amber-500 dark:text-amber-400"
                                weight="fill"
                              />
                            </span>
                            <h4 className="mb-2 font-semibold">
                              Nenhum módulo disponível
                            </h4>
                            <p className="text-muted-foreground mb-4 text-sm">
                              Você precisa criar pelo menos um módulo antes de
                              adicionar aulas.
                            </p>
                            <Button
                              variant="outline"
                              onClick={handleClose}
                              className="cursor-pointer rounded-xl"
                            >
                              Criar Módulo Primeiro
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3">
                              <Label className="flex items-center gap-2 text-sm font-semibold">
                                <BookOpen
                                  className="text-brand-mint not-dark:text-primary size-4"
                                  weight="fill"
                                />
                                Módulo
                                <span className="text-destructive">*</span>
                              </Label>

                              <div className="grid gap-3 sm:grid-cols-2">
                                {modules.map((module) => {
                                  const isSelected =
                                    formData.moduleId === module.id
                                  return (
                                    <button
                                      key={module.id}
                                      type="button"
                                      onClick={() =>
                                        setFormData({
                                          ...formData,
                                          moduleId: module.id,
                                        })
                                      }
                                      className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                                        isSelected
                                          ? "border-brand-cyan/60 bg-brand-cyan/10 not-dark:border-primary/60 not-dark:bg-primary/10 shadow-lg"
                                          : "border-border/60 bg-card/40 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 not-dark:hover:border-primary/40",
                                      )}
                                    >
                                      {module.coverImageUrl ? (
                                        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg">
                                          <Image
                                            src={module.coverImageUrl}
                                            alt={module.title}
                                            fill
                                            className="object-cover"
                                            sizes="48px"
                                          />
                                        </div>
                                      ) : (
                                        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)]">
                                          <BookOpen
                                            className="text-brand-cyan not-dark:text-primary size-5"
                                            weight="fill"
                                          />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="truncate font-semibold">
                                            {module.title}
                                          </p>
                                          {isSelected && (
                                            <CheckCircle
                                              className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                                              weight="fill"
                                            />
                                          )}
                                        </div>
                                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                          <span>
                                            {module.lessonsCount} aulas
                                          </span>
                                          {!module.isPublished && (
                                            <span className="text-amber-500 dark:text-amber-400">
                                              • Rascunho
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            {selectedModule && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 rounded-2xl border p-4"
                              >
                                <p className="text-muted-foreground mb-2 text-xs">
                                  Módulo selecionado:
                                </p>
                                <div className="flex items-center gap-3">
                                  <span className="bg-brand-cyan/15 not-dark:bg-primary/10 flex size-9 items-center justify-center rounded-lg">
                                    <BookOpen
                                      className="text-brand-cyan not-dark:text-primary size-5"
                                      weight="fill"
                                    />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold">
                                      {selectedModule.title}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      A aula será a{" "}
                                      {(selectedModule.lessonsCount || 0) + 1}ª
                                      do módulo
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Informações */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-6"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="text-brand-cyan not-dark:text-primary flex items-center gap-2">
                          <TextT className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 2 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Informações da Aula
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Defina o título e a descrição da sua aula
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        {/* Título */}
                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="lesson-title"
                            className="flex items-center gap-2 text-sm font-semibold"
                          >
                            <Hash
                              className="text-brand-mint not-dark:text-primary size-4"
                              weight="bold"
                            />
                            Título da Aula
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="lesson-title"
                            placeholder="Ex: Como criar cortes virais"
                            value={formData.title}
                            onChange={(event) =>
                              setFormData({
                                ...formData,
                                title: event.target.value,
                              })
                            }
                            disabled={createLesson.isPending}
                            className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl text-base sm:h-14 sm:text-lg"
                          />
                          <p className="text-muted-foreground text-xs">
                            Use um título claro e objetivo que descreva o
                            conteúdo
                          </p>
                        </div>

                        {/* Descrição */}
                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="lesson-description"
                            className="flex items-center gap-2 text-sm font-semibold"
                          >
                            <FileText
                              className="text-brand-cyan not-dark:text-primary size-4"
                              weight="fill"
                            />
                            Descrição
                            <span className="text-muted-foreground text-xs font-normal">
                              (opcional)
                            </span>
                          </Label>
                          <Textarea
                            id="lesson-description"
                            placeholder="Descreva o que será ensinado nesta aula..."
                            value={formData.description}
                            maxLength={500}
                            onChange={(event) =>
                              setFormData({
                                ...formData,
                                description: event.target.value.slice(0, 500),
                              })
                            }
                            disabled={createLesson.isPending}
                            className="focus-visible:ring-brand-cyan/40 min-h-[120px] resize-none rounded-xl text-base"
                          />
                          <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
                            <span>
                              Uma boa descrição ajuda os alunos a saber o que
                              vão aprender
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formData.description.length}/500
                            </span>
                          </div>
                        </div>

                        {/* Preview */}
                        {formData.title && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 rounded-2xl border p-4"
                          >
                            <p className="text-muted-foreground mb-2 text-xs">
                              Preview:
                            </p>
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[color-mix(in_oklab,var(--brand-cyan)_22%,transparent)] to-[color-mix(in_oklab,var(--brand-mint)_14%,transparent)]">
                                <Play
                                  className="text-brand-cyan not-dark:text-primary size-5"
                                  weight="fill"
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">
                                  {formData.title}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {selectedModule?.title ?? "Módulo"}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Conteúdo */}
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-6"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400">
                          <VideoCamera className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 3 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Conteúdo da Aula
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Adicione a URL do vídeo ou link do Google Drive
                        </p>
                      </div>

                      <div className="pt-2">
                        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                          {/* Form */}
                          <div className="flex w-full flex-col gap-6 lg:w-1/2">
                            {/* URL do Vídeo */}
                            <div className="flex flex-col gap-2.5">
                              <Label
                                htmlFor="lesson-video-url"
                                className="flex items-center gap-2 text-sm font-semibold"
                              >
                                <LinkSimple className="size-4 text-rose-500 dark:text-rose-400" />
                                URL do Vídeo / Google Drive
                                <span className="text-destructive">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="lesson-video-url"
                                  placeholder="https://youtube.com/watch?v=... ou https://drive.google.com/..."
                                  value={formData.videoUrl}
                                  onChange={(event) =>
                                    setFormData({
                                      ...formData,
                                      videoUrl: event.target.value,
                                    })
                                  }
                                  disabled={createLesson.isPending}
                                  inputMode="url"
                                  className={cn(
                                    "focus-visible:ring-brand-cyan/40 h-12 rounded-xl pl-11 text-sm sm:h-14 sm:text-base",
                                    formData.videoUrl && urlIsValid
                                      ? "border-emerald-500/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                                      : formData.videoUrl
                                        ? "border-red-500/60 focus-visible:border-red-500 focus-visible:ring-red-500/30"
                                        : undefined,
                                  )}
                                />
                                <span className="absolute top-1/2 left-3.5 -translate-y-1/2">
                                  {formData.videoUrl && urlIsValid ? (
                                    <CheckCircle
                                      className="size-5 text-emerald-500 dark:text-emerald-400"
                                      weight="fill"
                                    />
                                  ) : formData.videoUrl ? (
                                    <WarningCircle
                                      className="size-5 text-red-500"
                                      weight="fill"
                                    />
                                  ) : (
                                    <LinkSimple className="text-muted-foreground size-5" />
                                  )}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                Suporta YouTube, Vimeo, Dailymotion, Twitch e
                                Google Drive
                              </p>
                            </div>

                            {/* Duração */}
                            <div className="flex flex-col gap-2.5">
                              <Label
                                htmlFor="lesson-duration"
                                className="flex items-center gap-2 text-sm font-semibold"
                              >
                                <Clock
                                  className="text-brand-cyan not-dark:text-primary size-4"
                                  weight="fill"
                                />
                                Duração
                                <span className="text-muted-foreground text-xs font-normal">
                                  (em segundos)
                                </span>
                              </Label>
                              <div className="flex gap-3">
                                <Input
                                  id="lesson-duration"
                                  type="number"
                                  placeholder="600"
                                  value={formData.duration}
                                  onChange={(event) =>
                                    setFormData({
                                      ...formData,
                                      duration: event.target.value,
                                    })
                                  }
                                  disabled={createLesson.isPending}
                                  className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
                                />
                                {formData.duration && (
                                  <span className="bg-muted/60 text-foreground inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold tabular-nums">
                                    <Clock
                                      className="text-brand-cyan not-dark:text-primary size-4"
                                      weight="fill"
                                    />
                                    {formatDuration(
                                      parseInt(formData.duration) || 0,
                                    )}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs">
                                Ex: 600 = 10 minutos • 3600 = 1 hora
                              </p>
                            </div>

                            {/* Presets rápidos */}
                            <div className="flex flex-wrap gap-2">
                              {DURATION_PRESETS.map((preset) => {
                                const isSelected =
                                  formData.duration === String(preset.value)
                                return (
                                  <button
                                    key={preset.value}
                                    type="button"
                                    onClick={() =>
                                      setFormData({
                                        ...formData,
                                        duration: String(preset.value),
                                      })
                                    }
                                    disabled={createLesson.isPending}
                                    className={cn(
                                      "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                                      isSelected
                                        ? "border-brand-cyan/60 bg-brand-cyan/10 text-brand-cyan not-dark:border-primary/60 not-dark:bg-primary/10 not-dark:text-primary"
                                        : "border-border/70 bg-card/40 text-muted-foreground hover:border-brand-cyan/40 hover:text-foreground not-dark:hover:border-primary/40",
                                    )}
                                  >
                                    {preset.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          {/* Preview */}
                          <div className="flex w-full flex-col gap-4 lg:w-1/2">
                            <p className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
                              <Eye className="size-4" weight="fill" />
                              Preview do Vídeo
                            </p>

                            <div className="border-border/70 bg-muted/20 group relative aspect-video overflow-hidden rounded-2xl border-2">
                              {videoThumbnail ? (
                                <>
                                  <Image
                                    src={videoThumbnail}
                                    alt="Thumbnail"
                                    fill
                                    className="object-cover"
                                    sizes="400px"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <span className="flex size-14 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
                                      <Play
                                        className="size-7 text-white"
                                        weight="fill"
                                      />
                                    </span>
                                  </div>
                                  {formData.duration && (
                                    <span className="absolute right-3 bottom-3 rounded-lg bg-black/80 px-2 py-1 text-xs font-semibold text-white tabular-nums">
                                      {formatDuration(
                                        parseInt(formData.duration) || 0,
                                      )}
                                    </span>
                                  )}
                                  {formData.videoUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        window.open(formData.videoUrl, "_blank")
                                      }
                                      className="absolute top-3 right-3 flex cursor-pointer items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/80"
                                    >
                                      <ArrowSquareOut className="size-3" />
                                      Abrir
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                  <VideoCamera
                                    className="text-muted-foreground/50 size-12"
                                    weight="fill"
                                  />
                                  <p className="text-muted-foreground text-sm">
                                    {formData.videoUrl
                                      ? "Preview não disponível"
                                      : "Cole a URL do vídeo"}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="bg-muted/50 text-muted-foreground flex items-start gap-2.5 rounded-xl p-3 text-xs">
                              <Lightbulb
                                className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400"
                                weight="fill"
                              />
                              <span>
                                O thumbnail é extraído automaticamente de URLs
                                do YouTube. Links do Google Drive não geram
                                preview.
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Publicar */}
                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-6"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                          <CheckCircle className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 4 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Revisar e Publicar
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Confira as informações e publique sua aula
                        </p>
                      </div>

                      <div className="flex flex-col gap-5 pt-2">
                        {/* Resumo */}
                        <div className="border-border/60 bg-card/40 rounded-2xl border p-4 sm:p-5">
                          <h4 className="mb-4 flex items-center gap-2 font-semibold">
                            <Sparkle
                              className="text-brand-cyan not-dark:text-primary size-4"
                              weight="fill"
                            />
                            Resumo da Aula
                          </h4>

                          <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
                            {/* Preview do vídeo */}
                            <div className="shrink-0">
                              {videoThumbnail ? (
                                <div className="border-brand-cyan/30 not-dark:border-primary/30 relative aspect-video w-40 overflow-hidden rounded-xl border-2 shadow-lg">
                                  <Image
                                    src={videoThumbnail}
                                    alt="Thumbnail"
                                    fill
                                    className="object-cover"
                                    sizes="160px"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Play
                                      className="size-7 text-white"
                                      weight="fill"
                                    />
                                  </div>
                                  {formData.duration && (
                                    <span className="absolute right-2 bottom-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                                      {formatDuration(
                                        parseInt(formData.duration) || 0,
                                      )}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="border-brand-cyan/30 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5 flex aspect-video w-40 items-center justify-center rounded-xl border-2 border-dashed">
                                  <VideoCamera
                                    className="text-muted-foreground size-7"
                                    weight="fill"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Detalhes */}
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                              <div>
                                <p className="text-muted-foreground mb-1 text-xs">
                                  Título
                                </p>
                                <p className="text-lg font-semibold break-words">
                                  {formData.title}
                                </p>
                              </div>

                              <div>
                                <p className="text-muted-foreground mb-1 text-xs">
                                  Módulo
                                </p>
                                <p className="text-sm">
                                  {selectedModule?.title}
                                </p>
                              </div>

                              {formData.description && (
                                <div>
                                  <p className="text-muted-foreground mb-1 text-xs">
                                    Descrição
                                  </p>
                                  <p className="text-muted-foreground line-clamp-2 text-sm">
                                    {formData.description}
                                  </p>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2 pt-1">
                                {formData.duration && (
                                  <span className="bg-brand-cyan/10 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums">
                                    <Clock className="size-3" weight="fill" />
                                    {formatDuration(
                                      parseInt(formData.duration),
                                    )}
                                  </span>
                                )}
                                <span className="bg-muted text-muted-foreground inline-flex items-center rounded-lg px-2 py-1 text-xs">
                                  {(selectedModule?.lessonsCount || 0) + 1}ª
                                  aula do módulo
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Toggle Aula Gratuita */}
                        <div
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-2xl border-2 p-4 transition-all sm:p-5",
                            formData.isFree
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-border/60 bg-card/40",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3.5">
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                formData.isFree
                                  ? "bg-emerald-500/20"
                                  : "bg-muted",
                              )}
                            >
                              <Gift
                                className={cn(
                                  "size-5",
                                  formData.isFree
                                    ? "text-emerald-500 dark:text-emerald-400"
                                    : "text-muted-foreground",
                                )}
                                weight="fill"
                              />
                            </span>
                            <div className="min-w-0">
                              <Label
                                htmlFor="lesson-is-free"
                                className="cursor-pointer text-base font-semibold"
                              >
                                Aula Gratuita
                              </Label>
                              <p className="text-muted-foreground text-sm">
                                {formData.isFree
                                  ? "Esta aula será disponível como preview gratuito"
                                  : "Apenas assinantes terão acesso"}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id="lesson-is-free"
                            checked={formData.isFree}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, isFree: checked })
                            }
                            disabled={createLesson.isPending}
                          />
                        </div>

                        {/* Toggle Publicar */}
                        <div
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-2xl border-2 p-4 transition-all sm:p-5",
                            formData.isPublished
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-amber-500/30 bg-amber-500/5",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3.5">
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                formData.isPublished
                                  ? "bg-emerald-500/20"
                                  : "bg-amber-500/20",
                              )}
                            >
                              {formData.isPublished ? (
                                <Eye
                                  className="size-5 text-emerald-500 dark:text-emerald-400"
                                  weight="fill"
                                />
                              ) : (
                                <EyeSlash
                                  className="size-5 text-amber-500 dark:text-amber-400"
                                  weight="fill"
                                />
                              )}
                            </span>
                            <div className="min-w-0">
                              <Label
                                htmlFor="lesson-is-published"
                                className="cursor-pointer text-base font-semibold"
                              >
                                {formData.isPublished
                                  ? "Publicar agora"
                                  : "Salvar como rascunho"}
                              </Label>
                              <p className="text-muted-foreground text-sm">
                                {formData.isPublished
                                  ? "A aula ficará visível para os alunos imediatamente"
                                  : "A aula ficará oculta até você publicar manualmente"}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id="lesson-is-published"
                            checked={formData.isPublished}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, isPublished: checked })
                            }
                            disabled={createLesson.isPending}
                          />
                        </div>

                        {/* Nota final */}
                        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2.5 rounded-xl p-4 text-sm">
                          <Lightbulb
                            className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400"
                            weight="fill"
                          />
                          <span>
                            Após criar a aula, você poderá editar todas as
                            informações, reorganizar a ordem e acompanhar o
                            progresso dos alunos.
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>

            {/* ===== Footer ===== */}
            <div className="border-border/60 bg-background/85 shrink-0 border-t px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={step === 1 ? handleClose : prevStep}
                  disabled={createLesson.isPending}
                  className="h-10 cursor-pointer rounded-xl px-3 sm:h-11 sm:px-4"
                >
                  <CaretLeft className="size-4" weight="bold" />
                  <span className="hidden sm:inline">
                    {step === 1 ? "Cancelar" : "Voltar"}
                  </span>
                </Button>

                <span className="text-muted-foreground hidden text-xs font-medium md:inline">
                  Etapa {step} de {STEPS.length} · {STEPS[step - 1]!.title}
                </span>

                <div className="flex items-center gap-2">
                  {step < STEPS.length ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={
                        createLesson.isPending ||
                        (step === 1 && !formData.moduleId) ||
                        (step === 2 && !formData.title.trim()) ||
                        (step === 3 &&
                          (!formData.videoUrl.trim() ||
                            !isValidVideoUrl(formData.videoUrl)))
                      }
                      className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                    >
                      Continuar
                      <CaretRight className="size-4" weight="bold" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={
                        createLesson.isPending ||
                        !formData.title.trim() ||
                        !formData.moduleId ||
                        !isValidVideoUrl(formData.videoUrl)
                      }
                      className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                    >
                      {createLesson.isPending ? (
                        <>
                          <CircleNotch className="size-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Sparkle className="size-4" weight="fill" />
                          Criar Aula
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
