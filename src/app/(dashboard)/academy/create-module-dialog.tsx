"use client"

import * as React from "react"
import Image from "next/image"
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  DotsSixVertical,
  Eye,
  EyeSlash,
  FileText,
  Hash,
  Image as ImageIcon,
  Sparkle,
  Stack,
  TextT,
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
import { UploadDropzone } from "@/utils/uploadthing"

const STEPS = [
  { id: 1, title: "Informações", icon: TextT, description: "Título e descrição" },
  { id: 2, title: "Capa", icon: ImageIcon, description: "Imagem do módulo" },
  { id: 3, title: "Posição", icon: Stack, description: "Ordem de exibição" },
  { id: 4, title: "Publicar", icon: Eye, description: "Visibilidade" },
] as const

const COVER_TIPS = [
  "Use imagens de alta qualidade (1080×1920)",
  "Cores vibrantes chamam mais atenção",
  "Evite textos pequenos na imagem",
  "Mantenha o foco principal no centro",
]

const INITIAL_FORM = {
  title: "",
  description: "",
  coverImageUrl: null as string | null,
  order: 0,
  isPublished: false,
}

export function CreateModuleDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const [step, setStep] = React.useState(1)
  const [formData, setFormData] = React.useState(INITIAL_FORM)

  const utils = api.useUtils()

  // Buscar módulos existentes para mostrar preview de posição
  const { data: overviewData } = api.academy.getOverview.useQuery(undefined, {
    enabled: open,
  })

  const existingModules = React.useMemo(
    () => overviewData?.modules ?? [],
    [overviewData?.modules],
  )

  // Calcular posição máxima
  const maxPosition = existingModules.length

  // Inicializar order quando abrir o dialog
  React.useEffect(() => {
    if (open) {
      setFormData((prev) => ({
        ...prev,
        order: maxPosition + 1,
      }))
    }
  }, [open, maxPosition])

  // Lista de módulos com o novo módulo inserido na posição selecionada
  const modulesPreview = React.useMemo(() => {
    const newModule = {
      id: "new",
      title: formData.title || "Novo Módulo",
      coverImageUrl: formData.coverImageUrl,
      isPublished: formData.isPublished,
      lessonsCount: 0,
      isNew: true,
    }

    const modules = existingModules.map((m) => ({
      id: m.id,
      title: m.title,
      coverImageUrl: m.coverImageUrl,
      isPublished: m.isPublished,
      lessonsCount: m.lessonsCount || 0,
      isNew: false,
    }))

    // Inserir na posição correta (order é 1-based)
    const insertIndex = Math.min(Math.max(formData.order - 1, 0), modules.length)
    const result = [...modules]
    result.splice(insertIndex, 0, newModule)
    return result
  }, [
    existingModules,
    formData.title,
    formData.coverImageUrl,
    formData.isPublished,
    formData.order,
  ])

  const createModule = api.academy.createModule.useMutation()
  const reorderModules = api.academy.reorderModules.useMutation()

  const isSaving = createModule.isPending || reorderModules.isPending

  const resetForm = () => {
    setStep(1)
    setFormData(INITIAL_FORM)
  }

  const handleClose = () => {
    if (isSaving) return
    resetForm()
    onOpenChange(false)
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Título obrigatório", {
        description: "Por favor, informe um título para o módulo.",
      })
      setStep(1)
      return
    }

    try {
      const created = await createModule.mutateAsync({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        coverImageUrl: formData.coverImageUrl ?? undefined,
        isPublished: formData.isPublished,
      })

      // MELHORIA sobre o original: o server sempre cria no fim da lista.
      // Se a posição escolhida não for a última, aplica a ordem completa
      // recalculada via reorderModules (procedure órfã no original).
      const isLastPosition = formData.order >= maxPosition + 1
      if (!isLastPosition) {
        const orderedIds = existingModules.map((m) => m.id)
        orderedIds.splice(
          Math.min(Math.max(formData.order - 1, 0), orderedIds.length),
          0,
          created.id,
        )
        try {
          await reorderModules.mutateAsync({
            modules: orderedIds.map((id, index) => ({ id, order: index + 1 })),
          })
        } catch {
          toast.error("Erro ao aplicar a posição", {
            description: "O módulo foi criado no fim da lista.",
          })
        }
      }

      toast.success("Módulo criado com sucesso!", {
        description: formData.isPublished
          ? "O módulo já está publicado e visível."
          : "O módulo foi salvo como rascunho.",
      })
      void utils.academy.getOverview.invalidate()
      void utils.academy.getAllModules.invalidate()
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error("Erro ao criar módulo", {
        description:
          error instanceof Error ? error.message : "Tente novamente mais tarde.",
      })
    }
  }

  const nextStep = () => {
    if (step === 1 && !formData.title.trim()) {
      toast.error("Título obrigatório", {
        description: "Por favor, informe um título para continuar.",
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
        return formData.title.trim().length > 0
      case 2:
        return true // Capa é opcional
      case 3:
        return formData.order > 0
      case 4:
        return true
      default:
        return false
    }
  }

  const movePosition = (direction: "up" | "down") => {
    if (direction === "up" && formData.order > 1) {
      setFormData({ ...formData, order: formData.order - 1 })
    } else if (direction === "down" && formData.order <= maxPosition) {
      setFormData({ ...formData, order: formData.order + 1 })
    }
  }

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
                <BookOpen className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Novo{" "}
                  <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                    Módulo
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Empilhe conhecimento na academia
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
                <BookOpen className="size-4" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-bold">
                  Novo{" "}
                  <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">
                    Módulo
                  </span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preencha as informações para criar um novo módulo na academia
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
                  {/* Step 1: Informações */}
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
                          <TextT className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 1 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Informações do Módulo
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Defina o título e a descrição do seu novo módulo
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        {/* Título */}
                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="module-title"
                            className="flex items-center gap-2 text-sm font-semibold"
                          >
                            <Hash
                              className="text-brand-mint not-dark:text-primary size-4"
                              weight="bold"
                            />
                            Título do Módulo
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="module-title"
                            placeholder="Ex: Fundamentos do Clipping"
                            value={formData.title}
                            onChange={(e) =>
                              setFormData({ ...formData, title: e.target.value })
                            }
                            disabled={isSaving}
                            className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl text-base sm:h-14 sm:text-lg"
                          />
                          <p className="text-muted-foreground text-xs">
                            Um título claro ajuda os alunos a entender o conteúdo
                            do módulo
                          </p>
                        </div>

                        {/* Descrição */}
                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="module-description"
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
                            id="module-description"
                            placeholder="Descreva o que os alunos aprenderão neste módulo..."
                            maxLength={500}
                            value={formData.description}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                description: e.target.value.slice(0, 500),
                              })
                            }
                            disabled={isSaving}
                            className="focus-visible:ring-brand-cyan/40 min-h-[140px] resize-none rounded-xl text-base"
                          />
                          <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <span>Uma boa descrição aumenta o engajamento</span>
                            <span className="tabular-nums">
                              {formData.description.length}/500
                            </span>
                          </div>
                        </div>

                        {/* Preview do card */}
                        {formData.title && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 rounded-2xl border p-4"
                          >
                            <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                              Preview do card
                            </p>
                            <div className="flex items-center gap-3">
                              <span className="bg-gradient-custom flex size-12 shrink-0 items-center justify-center rounded-lg text-[#04222A]">
                                <BookOpen className="size-6" weight="fill" />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">
                                  {formData.title}
                                </p>
                                <p className="text-muted-foreground line-clamp-1 text-xs">
                                  {formData.description || "Sem descrição"}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Capa */}
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
                        <div className="flex items-center gap-2 text-violet-500 dark:text-violet-400">
                          <ImageIcon className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 2 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Capa do Módulo
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Adicione uma imagem vertical atrativa para seu módulo
                        </p>
                      </div>

                      <div className="pt-2">
                        <div className="flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
                          {/* Upload */}
                          <div className="flex w-full flex-col gap-3 lg:w-1/2">
                            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                              <span className="rounded-md bg-violet-500/10 px-2 py-1 font-mono text-xs text-violet-500 dark:text-violet-400">
                                9:16
                              </span>
                              <span>Proporção vertical (1080×1920)</span>
                            </div>

                            {formData.coverImageUrl ? (
                              <div className="relative mx-auto w-full max-w-[240px] lg:mx-0">
                                <div className="border-brand-cyan/30 not-dark:border-primary/30 group relative aspect-[9/16] overflow-hidden rounded-2xl border-2 shadow-xl">
                                  <Image
                                    src={formData.coverImageUrl}
                                    alt="Capa do módulo"
                                    fill
                                    sizes="240px"
                                    className="object-cover"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                    <Button
                                      type="button"
                                      onClick={() =>
                                        setFormData({
                                          ...formData,
                                          coverImageUrl: null,
                                        })
                                      }
                                      disabled={isSaving}
                                      variant="destructive"
                                      size="sm"
                                      className="cursor-pointer gap-2 rounded-xl shadow-lg"
                                    >
                                      <X className="size-4" />
                                      Remover
                                    </Button>
                                  </div>

                                  {/* Badge de sucesso */}
                                  <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                                    <CheckCircle
                                      className="size-4 text-white"
                                      weight="fill"
                                    />
                                  </span>

                                  {/* Título sobre a capa */}
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                                    <p className="line-clamp-2 text-lg font-bold text-white">
                                      {formData.title || "Título do Módulo"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mx-auto w-full max-w-[240px] lg:mx-0">
                                <UploadDropzone
                                  endpoint="moduleCover"
                                  onClientUploadComplete={(files) => {
                                    const url =
                                      files?.[0]?.ufsUrl ?? files?.[0]?.url
                                    if (url) {
                                      setFormData((prev) => ({
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
                                    allowedContent:
                                      "text-muted-foreground text-xs",
                                    button:
                                      "bg-gradient-custom text-[#04222A] text-sm font-semibold rounded-xl cursor-pointer after:bg-transparent",
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Dicas */}
                          <div className="flex w-full flex-col gap-4 lg:w-1/2">
                            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                              <h4 className="mb-3 flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                                <Sparkle className="size-4" weight="fill" />
                                Dicas para uma boa capa
                              </h4>
                              <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
                                {COVER_TIPS.map((tip) => (
                                  <li key={tip} className="flex items-start gap-2">
                                    <Check
                                      className="mt-0.5 size-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                                      weight="bold"
                                    />
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <p className="text-muted-foreground text-xs">
                              A capa é opcional, mas módulos com imagem têm 3x
                              mais engajamento!
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Posição */}
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
                        <div className="text-brand-cyan not-dark:text-primary flex items-center gap-2">
                          <Stack className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 3 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Posição do Módulo
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Escolha onde o módulo aparecerá na lista
                        </p>
                      </div>

                      <div className="pt-2">
                        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
                          {/* Controles de posição */}
                          <div className="w-full lg:w-1/3">
                            <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 rounded-2xl border p-5 sm:p-6">
                              <div className="mb-4 flex items-center justify-center gap-4">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => movePosition("up")}
                                  disabled={formData.order <= 1}
                                  aria-label="Subir posição"
                                  className="size-12 cursor-pointer rounded-xl"
                                >
                                  <ArrowUp className="size-5" weight="bold" />
                                </Button>

                                <div className="text-center">
                                  <div className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] text-5xl font-bold tabular-nums">
                                    {formData.order}º
                                  </div>
                                  <p className="text-muted-foreground mt-1 text-xs">
                                    de {maxPosition + 1} posições
                                  </p>
                                </div>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => movePosition("down")}
                                  disabled={formData.order > maxPosition}
                                  aria-label="Descer posição"
                                  className="size-12 cursor-pointer rounded-xl"
                                >
                                  <ArrowDown className="size-5" weight="bold" />
                                </Button>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={
                                    formData.order === 1 ? "default" : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setFormData({ ...formData, order: 1 })
                                  }
                                  className={cn(
                                    "flex-1 cursor-pointer rounded-xl text-xs",
                                    formData.order === 1 &&
                                      "btn-gradient-auth font-semibold",
                                  )}
                                >
                                  Primeiro
                                </Button>
                                <Button
                                  type="button"
                                  variant={
                                    formData.order === maxPosition + 1
                                      ? "default"
                                      : "outline"
                                  }
                                  size="sm"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      order: maxPosition + 1,
                                    })
                                  }
                                  className={cn(
                                    "flex-1 cursor-pointer rounded-xl text-xs",
                                    formData.order === maxPosition + 1 &&
                                      "btn-gradient-auth font-semibold",
                                  )}
                                >
                                  Último
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Preview da ordem */}
                          <div className="flex w-full flex-col gap-3 lg:w-2/3">
                            <p className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
                              <Eye className="size-4" weight="fill" />
                              Preview da ordem dos módulos
                            </p>

                            <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-2">
                              {modulesPreview.map((module, index) => (
                                <motion.div
                                  key={module.id}
                                  layout
                                  initial={
                                    module.isNew
                                      ? { opacity: 0, scale: 0.9 }
                                      : false
                                  }
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl border p-3 transition-all",
                                    module.isNew
                                      ? "border-brand-cyan/60 bg-brand-cyan/5 not-dark:border-primary/60 not-dark:bg-primary/5 shadow-lg"
                                      : "border-border/60 bg-card/40",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums",
                                      module.isNew
                                        ? "bg-gradient-custom text-[#04222A]"
                                        : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {index + 1}
                                  </span>

                                  {module.coverImageUrl ? (
                                    <span className="border-border/60 relative h-14 w-10 shrink-0 overflow-hidden rounded-lg border">
                                      <Image
                                        src={module.coverImageUrl}
                                        alt={module.title}
                                        fill
                                        sizes="40px"
                                        className="object-cover"
                                      />
                                    </span>
                                  ) : (
                                    <span className="bg-muted flex h-14 w-10 shrink-0 items-center justify-center rounded-lg">
                                      <BookOpen
                                        className="text-muted-foreground size-4"
                                        weight="fill"
                                      />
                                    </span>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <p
                                        className={cn(
                                          "truncate font-semibold",
                                          module.isNew &&
                                            "text-brand-cyan not-dark:text-primary",
                                        )}
                                      >
                                        {module.title}
                                      </p>
                                      {module.isNew && (
                                        <span className="bg-brand-cyan/15 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                          NOVO
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                      <span>{module.lessonsCount} aulas</span>
                                      {!module.isPublished && !module.isNew && (
                                        <span className="text-amber-600 dark:text-amber-400">
                                          • Rascunho
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {module.isNew && (
                                    <DotsSixVertical
                                      className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                                      weight="bold"
                                    />
                                  )}
                                </motion.div>
                              ))}
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
                      className="flex w-full flex-col gap-6 overflow-hidden"
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
                          Confira as informações e publique seu módulo
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        {/* Resumo */}
                        <div className="border-border/60 rounded-2xl border p-5 sm:p-6">
                          <h4 className="mb-4 flex items-center gap-2 font-semibold">
                            <Sparkle
                              className="text-brand-mint not-dark:text-primary size-4"
                              weight="fill"
                            />
                            Resumo do Módulo
                          </h4>

                          <div className="flex flex-col gap-6 sm:flex-row">
                            {/* Capa */}
                            <div className="shrink-0">
                              {formData.coverImageUrl ? (
                                <div className="border-brand-cyan/30 not-dark:border-primary/30 relative aspect-[9/16] w-24 overflow-hidden rounded-xl border-2 shadow-lg">
                                  <Image
                                    src={formData.coverImageUrl}
                                    alt="Capa"
                                    fill
                                    sizes="96px"
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="border-brand-cyan/30 bg-brand-cyan/5 not-dark:border-primary/30 not-dark:bg-primary/5 flex aspect-[9/16] w-24 items-center justify-center rounded-xl border-2 border-dashed">
                                  <ImageIcon className="text-muted-foreground size-6" />
                                </div>
                              )}
                            </div>

                            {/* Detalhes */}
                            <div className="flex min-w-0 flex-1 flex-col gap-4">
                              <div>
                                <p className="text-muted-foreground mb-1 text-xs">
                                  Título
                                </p>
                                <p className="text-lg font-semibold break-words">
                                  {formData.title}
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

                              <div className="flex flex-wrap gap-3">
                                <span className="bg-brand-cyan/10 text-brand-cyan not-dark:bg-primary/10 not-dark:text-primary rounded-lg px-3 py-1.5 text-sm font-medium">
                                  {formData.order}ª posição
                                </span>
                                <span className="bg-muted text-muted-foreground rounded-lg px-3 py-1.5 text-sm">
                                  0 aulas
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Toggle de publicação */}
                        <div
                          className={cn(
                            "flex items-center justify-between gap-4 rounded-2xl border p-5 transition-all sm:p-6",
                            formData.isPublished
                              ? "border-emerald-500/30 bg-emerald-500/10"
                              : "border-amber-500/30 bg-amber-500/10",
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            <span
                              className={cn(
                                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                                formData.isPublished
                                  ? "bg-emerald-500/20 text-emerald-500 dark:text-emerald-400"
                                  : "bg-amber-500/20 text-amber-600 dark:text-amber-400",
                              )}
                            >
                              {formData.isPublished ? (
                                <Eye className="size-6" weight="fill" />
                              ) : (
                                <EyeSlash className="size-6" weight="fill" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <Label
                                htmlFor="module-published"
                                className="cursor-pointer text-base font-semibold"
                              >
                                {formData.isPublished
                                  ? "Publicar agora"
                                  : "Salvar como rascunho"}
                              </Label>
                              <p className="text-muted-foreground text-sm">
                                {formData.isPublished
                                  ? "O módulo ficará visível para os alunos imediatamente"
                                  : "O módulo ficará oculto até você publicar manualmente"}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id="module-published"
                            checked={formData.isPublished}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, isPublished: checked })
                            }
                            disabled={isSaving}
                            className="shrink-0 cursor-pointer"
                          />
                        </div>

                        {/* Nota final */}
                        <div className="bg-muted/50 text-muted-foreground rounded-xl p-4 text-sm">
                          <p>
                            💡 Após criar o módulo, você poderá adicionar aulas,
                            reorganizar a ordem e editar todas as informações.
                          </p>
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
                  disabled={isSaving}
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
                      disabled={isSaving || (step === 1 && !formData.title.trim())}
                      className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                    >
                      Continuar
                      <CaretRight className="size-4" weight="bold" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={isSaving || !formData.title.trim()}
                      className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                    >
                      {isSaving ? (
                        <>
                          <CircleNotch className="size-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Sparkle className="size-4" weight="fill" />
                          Criar Módulo
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
