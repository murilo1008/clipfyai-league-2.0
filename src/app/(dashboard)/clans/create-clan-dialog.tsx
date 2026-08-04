"use client"

import * as React from "react"
import Image from "next/image"
import {
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  CircleNotch,
  Eye,
  FileText,
  Hash,
  Image as ImageIcon,
  Palette,
  Shield,
  Sparkle,
  TextT,
  Trash,
  X,
} from "@phosphor-icons/react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"

import { CLAN_ICON_MAP, ClanTagBadge } from "@/components/clan-tag-badge"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import { UploadDropzone } from "@/utils/uploadthing"

interface CreateClanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STEPS = [
  { id: 1, title: "Informações", icon: TextT, description: "Nome e descrição" },
  { id: 2, title: "Tag & Ícone", icon: Hash, description: "Tag, ícone e cor" },
  { id: 3, title: "Imagem", icon: ImageIcon, description: "Foto do clã" },
  { id: 4, title: "Revisar", icon: Eye, description: "Confirmar e criar" },
] as const

/** Labels pt-BR dos 39 ícones do CLAN_ICON_MAP (mesma ordem do mapa). */
const ICON_LABELS: Record<string, string> = {
  Flame: "Fogo",
  Zap: "Raio",
  Bolt: "Relâmpago",
  DollarSign: "Cifrão",
  Star: "Estrela",
  Crown: "Coroa",
  Trophy: "Troféu",
  Medal: "Medalha",
  Gem: "Gema",
  Sparkles: "Brilho",
  Heart: "Coração",
  Shield: "Escudo",
  Swords: "Espadas",
  Target: "Alvo",
  Crosshair: "Mira",
  Bomb: "Bomba",
  Skull: "Caveira",
  Ghost: "Fantasma",
  Rocket: "Foguete",
  Moon: "Lua",
  Sun: "Sol",
  Snowflake: "Neve",
  CloudLightning: "Tempestade",
  Mountain: "Montanha",
  Leaf: "Folha",
  TreePine: "Pinheiro",
  Bird: "Pássaro",
  Cat: "Gato",
  Dog: "Cachorro",
  Fish: "Peixe",
  Bug: "Inseto",
  Anchor: "Âncora",
  Compass: "Bússola",
  Gamepad2: "Controle",
  Joystick: "Joystick",
  Dice5: "Dado",
  Music: "Música",
  Headphones: "Fone",
  Alligator: "Jacaré",
}

const ICON_OPTIONS = Object.entries(CLAN_ICON_MAP).map(([name, icon]) => ({
  name,
  icon,
  label: ICON_LABELS[name] ?? name,
}))

const COLOR_PRESETS = [
  { hex: "#FF5733", label: "Vermelho" },
  { hex: "#E74C3C", label: "Rubi" },
  { hex: "#9B59B6", label: "Roxo" },
  { hex: "#8E44AD", label: "Púrpura" },
  { hex: "#3498DB", label: "Azul" },
  { hex: "#2980B9", label: "Cobalto" },
  { hex: "#1ABC9C", label: "Esmeralda" },
  { hex: "#27AE60", label: "Verde" },
  { hex: "#F1C40F", label: "Amarelo" },
  { hex: "#E67E22", label: "Laranja" },
  { hex: "#F39C12", label: "Âmbar" },
  { hex: "#E91E63", label: "Pink" },
]

const INITIAL_FORM = {
  name: "",
  description: "",
  tag: "",
  emoji: "Flame",
  emojiColor: "#FF5733",
  imageUrl: "",
}

export function CreateClanDialog({ open, onOpenChange }: CreateClanDialogProps) {
  const [step, setStep] = React.useState(1)
  const [formData, setFormData] = React.useState(INITIAL_FORM)

  const utils = api.useUtils()

  const createClan = api.clan.create.useMutation({
    onSuccess: () => {
      toast.success("Clã criado com sucesso!", {
        description: `O clã ${formData.name} foi criado.`,
      })
      void utils.clan.list.invalidate()
      void utils.clan.getStats.invalidate()
      resetForm()
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error("Erro ao criar clã", {
        description: error.message,
      })
    },
  })

  const resetForm = () => {
    setStep(1)
    setFormData(INITIAL_FORM)
  }

  const handleClose = () => {
    if (createClan.isPending) return
    resetForm()
    onOpenChange(false)
  }

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.tag.trim()) {
      toast.error("Campos obrigatórios", {
        description: "Nome e tag são obrigatórios.",
      })
      setStep(1)
      return
    }

    createClan.mutate({
      name: formData.name.trim(),
      tag: formData.tag.trim().toUpperCase(),
      emoji: formData.emoji,
      emojiColor: formData.emojiColor,
      description: formData.description.trim() || undefined,
      imageUrl: formData.imageUrl.trim() || undefined,
    })
  }

  const nextStep = () => {
    if (step === 1 && !formData.name.trim()) {
      toast.error("Nome obrigatório", {
        description: "Informe um nome para continuar.",
      })
      return
    }
    if (step === 2 && !formData.tag.trim()) {
      toast.error("Tag obrigatória", {
        description: "Informe uma tag para continuar.",
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
        return formData.name.trim().length > 0
      case 2:
        return formData.tag.trim().length >= 2 && formData.emoji.length > 0
      case 3:
        return true
      case 4:
        return true
      default:
        return false
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
                <Shield className="size-5" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-bold tracking-tight">
                  Novo <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">Clã</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Monte a fortaleza do seu clã
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
                <Shield className="size-4" weight="fill" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-sm font-bold">
                  Novo <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4]">Clã</span>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Preencha as informações para criar um novo clã
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
                          Informações do Clã
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Defina o nome e a descrição do seu novo clã
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="clan-name"
                            className="flex items-center gap-2 text-sm font-semibold"
                          >
                            <Shield
                              className="text-brand-mint not-dark:text-primary size-4"
                              weight="fill"
                            />
                            Nome do Clã
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="clan-name"
                            placeholder='Ex: "Alpha Squad"'
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            disabled={createClan.isPending}
                            className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl text-base sm:h-14 sm:text-lg"
                          />
                          <p className="text-muted-foreground text-xs">
                            Escolha um nome forte e memorável para o clã
                          </p>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="clan-description"
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
                            id="clan-description"
                            placeholder="Descreva a missão, valores e o espírito do clã..."
                            value={formData.description}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                description: e.target.value.slice(0, 500),
                              })
                            }
                            disabled={createClan.isPending}
                            className="focus-visible:ring-brand-cyan/40 min-h-[120px] resize-none rounded-xl text-base"
                          />
                          <div className="text-muted-foreground flex items-center justify-between text-xs">
                            <span>Uma boa descrição atrai membros engajados</span>
                            <span className="tabular-nums">
                              {formData.description.length}/500
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Tag & Ícone */}
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
                          <Hash className="size-5" weight="bold" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 2 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Tag & Ícone
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Defina a identidade visual do clã no estilo Discord
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        {/* Tag */}
                        <div className="flex flex-col gap-2.5">
                          <Label
                            htmlFor="clan-tag"
                            className="flex items-center gap-2 text-sm font-semibold"
                          >
                            <Hash
                              className="text-brand-mint not-dark:text-primary size-4"
                              weight="bold"
                            />
                            Tag do Clã
                            <span className="text-destructive">*</span>
                            <span className="text-muted-foreground text-xs font-normal">
                              (máx. 4 letras)
                            </span>
                          </Label>
                          <Input
                            id="clan-tag"
                            placeholder="Ex: ALFA"
                            maxLength={4}
                            value={formData.tag}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                tag: e.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z]/g, ""),
                              })
                            }
                            disabled={createClan.isPending}
                            className="focus-visible:ring-brand-cyan/40 h-12 rounded-xl font-mono text-base font-bold tracking-widest uppercase sm:h-14 sm:text-lg"
                          />
                        </div>

                        {/* Preview da tag */}
                        <div className="flex flex-col gap-2.5">
                          <p className="text-muted-foreground text-sm font-semibold">
                            Preview da Tag
                          </p>
                          <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex flex-wrap items-center gap-4 rounded-2xl border p-4 sm:p-5">
                            <ClanTagBadge
                              tag={formData.tag || "TAG"}
                              emoji={formData.emoji}
                              emojiColor={formData.emojiColor}
                              size="lg"
                              className="shadow-lg"
                            />
                            <p className="text-muted-foreground min-w-0 text-sm">
                              {formData.tag
                                ? "Será exibida como a identidade do clã"
                                : "Digite a tag para ver a prévia"}
                            </p>
                          </div>
                        </div>

                        {/* Ícone */}
                        <div className="flex flex-col gap-2.5">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <Sparkle
                              className="text-brand-cyan not-dark:text-primary size-4"
                              weight="fill"
                            />
                            Ícone do Clã
                          </Label>
                          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                            {ICON_OPTIONS.map((option) => {
                              const isSelected = formData.emoji === option.name
                              return (
                                <button
                                  key={option.name}
                                  type="button"
                                  title={option.label}
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      emoji: option.name,
                                    })
                                  }
                                  className={cn(
                                    "relative flex h-11 w-full cursor-pointer items-center justify-center rounded-xl border transition-all",
                                    isSelected
                                      ? "border-brand-cyan/60 bg-brand-cyan/10 not-dark:border-primary/60 not-dark:bg-primary/10 shadow-lg"
                                      : "border-border/70 bg-card/40 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 not-dark:hover:border-primary/40",
                                  )}
                                >
                                  <option.icon
                                    className="size-5"
                                    style={{
                                      color: isSelected
                                        ? formData.emojiColor
                                        : undefined,
                                    }}
                                  />
                                  {isSelected && (
                                    <span className="bg-gradient-custom absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[#04222A]">
                                      <Check className="size-2.5" weight="bold" />
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Cor */}
                        <div className="flex flex-col gap-2.5">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <Palette
                              className="text-brand-cyan not-dark:text-primary size-4"
                              weight="fill"
                            />
                            Cor do Ícone
                          </Label>
                          <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                            {COLOR_PRESETS.map((color) => {
                              const isSelected =
                                formData.emojiColor === color.hex
                              return (
                                <button
                                  key={color.hex}
                                  type="button"
                                  onClick={() =>
                                    setFormData({
                                      ...formData,
                                      emojiColor: color.hex,
                                    })
                                  }
                                  title={color.label}
                                  className={cn(
                                    "relative h-10 w-full cursor-pointer rounded-lg border-2 transition-all",
                                    isSelected
                                      ? "scale-110 border-white shadow-lg"
                                      : "border-transparent hover:scale-105",
                                  )}
                                  style={{ backgroundColor: color.hex }}
                                >
                                  {isSelected && (
                                    <Check
                                      className="absolute inset-0 m-auto size-4 text-white drop-shadow-md"
                                      weight="bold"
                                    />
                                  )}
                                </button>
                              )
                            })}
                          </div>
                          <div className="mt-1 flex items-center gap-3">
                            <Label
                              htmlFor="clan-custom-color"
                              className="text-muted-foreground text-xs whitespace-nowrap"
                            >
                              Cor customizada:
                            </Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                id="clan-custom-color"
                                value={formData.emojiColor}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    emojiColor: e.target.value,
                                  })
                                }
                                className="size-8 cursor-pointer rounded-md border-0 bg-transparent"
                              />
                              <Input
                                value={formData.emojiColor}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                                    setFormData({
                                      ...formData,
                                      emojiColor: value,
                                    })
                                  }
                                }}
                                className="focus-visible:ring-brand-cyan/40 h-8 w-24 rounded-lg font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Imagem */}
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
                        <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                          <ImageIcon className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 3 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Imagem do Clã
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Arraste ou selecione uma imagem quadrada (1:1) para o
                          clã
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 pt-2">
                        <div className="flex flex-col gap-2.5">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <ImageIcon
                              className="size-4 text-amber-500 dark:text-amber-400"
                              weight="fill"
                            />
                            Imagem de Capa (1:1)
                            <span className="text-muted-foreground text-xs font-normal">
                              (opcional)
                            </span>
                          </Label>
                          {formData.imageUrl ? (
                            <div className="border-border/60 relative mx-auto aspect-square w-full max-w-60 overflow-hidden rounded-2xl border">
                              <Image
                                src={formData.imageUrl}
                                alt="Imagem do clã"
                                fill
                                sizes="240px"
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData({ ...formData, imageUrl: "" })
                                }
                                disabled={createClan.isPending}
                                aria-label="Remover imagem"
                                className="absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80"
                              >
                                <Trash className="size-4" />
                              </button>
                              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                                <CheckCircle
                                  className="size-3 text-emerald-400"
                                  weight="fill"
                                />
                                Imagem definida
                              </span>
                            </div>
                          ) : (
                            <UploadDropzone
                              endpoint="clanImage"
                              onClientUploadComplete={(files) => {
                                const url = files?.[0]?.ufsUrl ?? files?.[0]?.url
                                if (url) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    imageUrl: url,
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
                                  "border-border/70 bg-muted/20 rounded-2xl border-dashed cursor-pointer mt-0",
                                label: "text-foreground text-sm",
                                allowedContent:
                                  "text-muted-foreground text-xs",
                                button:
                                  "bg-gradient-custom text-[#04222A] text-sm font-semibold rounded-xl cursor-pointer after:bg-transparent",
                              }}
                            />
                          )}
                        </div>

                        {/* Preview completa */}
                        <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex flex-col gap-3 rounded-2xl border p-4 sm:p-5">
                          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                            Preview completa
                          </p>
                          <div className="flex items-center gap-3">
                            {formData.imageUrl ? (
                              <div className="border-border/60 relative size-10 shrink-0 overflow-hidden rounded-lg border">
                                <Image
                                  src={formData.imageUrl}
                                  alt=""
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
                                <Shield
                                  className="text-muted-foreground/50 size-5"
                                  weight="fill"
                                />
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {formData.name || "Nome do Clã"}
                              </p>
                              <div className="mt-1">
                                <ClanTagBadge
                                  tag={formData.tag || "TAG"}
                                  emoji={formData.emoji}
                                  emojiColor={formData.emojiColor}
                                  size="xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Revisar */}
                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex w-full flex-col gap-5 overflow-hidden"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400">
                          <Eye className="size-5" weight="fill" />
                          <span className="text-xs font-semibold tracking-wider uppercase">
                            Etapa 4 de 4
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                          Revisar & Criar
                        </h3>
                        <p className="text-muted-foreground text-sm sm:text-base">
                          Confira todas as informações antes de criar o clã
                        </p>
                      </div>

                      {/* Preview principal */}
                      <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex items-center gap-4 rounded-2xl border p-4">
                        {formData.imageUrl ? (
                          <div className="border-brand-cyan/30 not-dark:border-primary/30 relative size-16 shrink-0 overflow-hidden rounded-xl border-2 sm:size-20">
                            <Image
                              src={formData.imageUrl}
                              alt={formData.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="border-brand-cyan/25 bg-brand-cyan/10 not-dark:border-primary/25 not-dark:bg-primary/10 flex size-16 shrink-0 items-center justify-center rounded-xl border-2 sm:size-20">
                            <Shield
                              className="text-brand-mint not-dark:text-primary size-8"
                              weight="fill"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-lg font-bold sm:text-xl">
                            {formData.name || "Nome do Clã"}
                          </h4>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <ClanTagBadge
                              tag={formData.tag || "TAG"}
                              emoji={formData.emoji}
                              emojiColor={formData.emojiColor}
                              size="md"
                            />
                            <span className="flex items-center gap-1 text-xs text-emerald-500 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              Ativo
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Resumo */}
                      <div className="border-border/60 overflow-hidden rounded-2xl border">
                        <div className="border-border/40 flex items-center gap-3 border-b px-4 py-3">
                          <Shield
                            className="text-brand-mint not-dark:text-primary size-4 shrink-0"
                            weight="fill"
                          />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            Nome
                          </span>
                          <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold">
                            {formData.name || "—"}
                          </span>
                        </div>
                        <div className="border-border/40 flex items-center justify-between gap-3 border-b px-4 py-3">
                          <span className="flex items-center gap-3">
                            <Hash
                              className="text-brand-cyan not-dark:text-primary size-4 shrink-0"
                              weight="bold"
                            />
                            <span className="text-muted-foreground text-xs">
                              Tag
                            </span>
                          </span>
                          <ClanTagBadge
                            tag={formData.tag || "—"}
                            emoji={formData.emoji}
                            emojiColor={formData.emojiColor}
                            size="xs"
                            className="shrink-0"
                          />
                        </div>
                        <div className="border-border/40 flex items-center gap-3 border-b px-4 py-3">
                          <Palette
                            className="size-4 shrink-0 text-amber-500 dark:text-amber-400"
                            weight="fill"
                          />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            Cor
                          </span>
                          <span className="flex flex-1 items-center justify-end gap-2">
                            <span
                              className="border-border/60 size-5 shrink-0 rounded border"
                              style={{ backgroundColor: formData.emojiColor }}
                            />
                            <span className="text-muted-foreground font-mono text-xs">
                              {formData.emojiColor}
                            </span>
                          </span>
                        </div>
                        <div className="border-border/40 flex items-center gap-3 border-b px-4 py-3">
                          <FileText
                            className="size-4 shrink-0 text-sky-500 dark:text-sky-400"
                            weight="fill"
                          />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            Descrição
                          </span>
                          <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm">
                            {formData.description || "Sem descrição"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3">
                          <ImageIcon
                            className="size-4 shrink-0 text-emerald-500 dark:text-emerald-400"
                            weight="fill"
                          />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            Imagem
                          </span>
                          <span className="flex flex-1 items-center justify-end gap-2">
                            {formData.imageUrl ? (
                              <>
                                <span className="relative size-6 shrink-0 overflow-hidden rounded">
                                  <Image
                                    src={formData.imageUrl}
                                    alt=""
                                    fill
                                    sizes="24px"
                                    className="object-cover"
                                  />
                                </span>
                                <span className="text-sm font-medium text-emerald-500 dark:text-emerald-400">
                                  Definida
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                Sem imagem
                              </span>
                            )}
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
                  disabled={createClan.isPending}
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
                      disabled={createClan.isPending}
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
                        createClan.isPending ||
                        !formData.name.trim() ||
                        !formData.tag.trim()
                      }
                      className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                    >
                      {createClan.isPending ? (
                        <>
                          <CircleNotch className="size-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="size-4" weight="fill" />
                          Criar Clã
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
