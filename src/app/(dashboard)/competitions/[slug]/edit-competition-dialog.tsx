"use client"

import * as React from "react"
import Image from "next/image"
import {
  At,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChartBar,
  Check,
  CheckCircle,
  CircleNotch,
  ClipboardText,
  Clock,
  Coins,
  Crown,
  CurrencyCircleDollar,
  Eye,
  FlagCheckered,
  FloppyDisk,
  Globe,
  Hash,
  Info,
  LinkSimple,
  ListChecks,
  Lock,
  Medal,
  Minus,
  PencilSimple,
  Plus,
  Prohibit,
  Pulse,
  Ranking,
  ShieldCheck,
  Sparkle,
  Trash,
  TrendUp,
  Trophy,
  X,
} from "@phosphor-icons/react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatPrizeLabel } from "@/lib/currency"
import { platformConfig, type PlatformKey } from "@/lib/platform-config"
import { cn } from "@/lib/utils"
import { api } from "@/trpc/react"
import { UploadDropzone } from "@/utils/uploadthing"

import type { CompetitionDetails } from "./shared"

/* ========================================================================
   Constantes
   ======================================================================== */

const PLATFORMS = Object.keys(platformConfig) as PlatformKey[]

const AFFILIATE_PLATFORMS = [
  { key: "instagram", platform: "INSTAGRAM" },
  { key: "tiktok", platform: "TIKTOK" },
  { key: "youtube", platform: "YOUTUBE" },
  { key: "facebook", platform: "FACEBOOK" },
  { key: "kwai", platform: "KWAI" },
] as const

type AffiliateKey = (typeof AFFILIATE_PLATFORMS)[number]["key"]

const STEPS = [
  { num: 1, label: "Básico", icon: ClipboardText },
  { num: 2, label: "Período", icon: CalendarBlank },
  { num: 3, label: "Regras", icon: ListChecks },
  { num: 4, label: "Prêmios", icon: Medal },
  { num: 5, label: "Finalizar", icon: FlagCheckered },
] as const

const TOTAL_STEPS = STEPS.length

const brl = (value: number) => value.toLocaleString("pt-BR")

type RankingMetric = "VIEWS" | "VIEWS_X_ENGAGEMENT"

interface FormData {
  name: string
  description: string
  coverImageUrl: string | null
  startDate: Date | undefined
  endDate: Date | undefined
  startTime: string
  endTime: string
  platforms: string[]
  requiredHashtags: string[]
  requiredMentions: string[]
  prohibitedContent: string[]
  prize: string
  isLeaderboardPublic: boolean
  requiresApproval: boolean
  autoApproveCreators: boolean
  rankingMetricType: RankingMetric
  isPrivate: boolean
  isProOnly: boolean
  dailyPix: boolean
  /** Ranking diário de clipadores por quantidade de vídeos publicados. */
  topClippersRankingEnabled: boolean
  /** Prêmio por posição do Top Clipadores: { "1": 100, "2": 80, ... } */
  topClippersPrizeTable: Record<string, number>
}

const DEFAULT_TOP_CLIPPERS_PRIZE_TABLE: Record<string, number> = {
  "1": 100,
  "2": 80,
  "3": 65,
  "4": 55,
}

const INITIAL_FORM: FormData = {
  name: "",
  description: "",
  coverImageUrl: null,
  startDate: undefined,
  endDate: undefined,
  startTime: "20:00",
  endTime: "20:00",
  platforms: [],
  requiredHashtags: [],
  requiredMentions: [],
  prohibitedContent: [],
  prize: "",
  isLeaderboardPublic: true,
  requiresApproval: true,
  autoApproveCreators: false,
  rankingMetricType: "VIEWS",
  isPrivate: false,
  isProOnly: false,
  dailyPix: false,
  topClippersRankingEnabled: false,
  topClippersPrizeTable: DEFAULT_TOP_CLIPPERS_PRIZE_TABLE,
}

interface PrizeConfig {
  dailyEnabled: boolean
  dailyTopCount: number
  dailyTotalPrize: number
  dailyPrizeTable: Record<string, number>
  bonusEnabled: boolean
  bonusMilestone: number
  bonusAmount: number
  bonusMonthlyBudgetCap: number
  monthlyEnabled: boolean
  monthlyTopCount: number
  monthlyTotalPrize: number
  monthlyPrizeTable: Record<string, number>
}

const DEFAULT_DAILY_PRIZE_TABLE: Record<string, number> = {
  "1": 350,
  "2": 200,
  "3": 150,
  "4-15": 25,
}

const DEFAULT_MONTHLY_PRIZE_TABLE: Record<string, number> = {
  "1": 7000,
  "2": 4000,
  "3": 3000,
  "4": 2000,
  "5": 1000,
  "6": 800,
  "7": 700,
  "8": 600,
  "9": 500,
  "10": 400,
}

const INITIAL_PRIZE_CONFIG: PrizeConfig = {
  dailyEnabled: true,
  dailyTopCount: 15,
  dailyTotalPrize: 1000,
  dailyPrizeTable: DEFAULT_DAILY_PRIZE_TABLE,
  bonusEnabled: true,
  bonusMilestone: 1000000,
  bonusAmount: 100,
  bonusMonthlyBudgetCap: 6000,
  monthlyEnabled: true,
  monthlyTopCount: 10,
  monthlyTotalPrize: 20000,
  monthlyPrizeTable: DEFAULT_MONTHLY_PRIZE_TABLE,
}

const INITIAL_AFFILIATE_LINKS: Record<AffiliateKey, string> = {
  instagram: "",
  tiktok: "",
  youtube: "",
  facebook: "",
  kwai: "",
}

/** JsonValue de tabela de prêmios → Record<string, number> (com fallback). */
function toPrizeTable(
  value: unknown,
  fallback: Record<string, number>,
): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    )
    if (entries.length > 0) return Object.fromEntries(entries)
  }
  return fallback
}

/** Soma os prêmios de uma tabela de posições. */
const sumPrizeTable = (table: Record<string, number>) =>
  Object.values(table).reduce(
    (total, value) => total + (Number.isFinite(value) ? value : 0),
    0,
  )

/**
 * Valida a tabela de prêmios do Top Clipadores.
 * Retorna a mensagem do primeiro erro encontrado ou `null` se estiver válida.
 */
const validateTopClippersPrizeTable = (table: Record<string, number>) => {
  const entries = Object.entries(table)

  if (entries.length === 0) {
    return "Adicione ao menos uma posição premiada no Top Clipadores"
  }

  const positions = entries.map(([position]) => Number(position))

  if (positions.some((position) => !Number.isInteger(position) || position < 1))
    return "As posições do Top Clipadores devem ser números inteiros a partir de 1"

  if (new Set(positions).size !== positions.length)
    return "Existem posições duplicadas no Top Clipadores"

  if (entries.some(([, value]) => !Number.isFinite(value) || value < 0))
    return "Os prêmios do Top Clipadores não podem ser negativos"

  if (!entries.some(([, value]) => value > 0))
    return "Informe ao menos um prêmio maior que zero para o Top Clipadores"

  return null
}

/** Extrai o campo `total` do prizeInfo (JsonValue). */
function extractPrizeTotal(prizeInfo: unknown): string {
  if (
    prizeInfo &&
    typeof prizeInfo === "object" &&
    !Array.isArray(prizeInfo) &&
    "total" in prizeInfo
  ) {
    const total = (prizeInfo as { total?: unknown }).total
    if (typeof total === "string") return total
    if (typeof total === "number") return String(total)
  }
  return ""
}

/* ========================================================================
   Dialog principal
   ======================================================================== */

interface EditCompetitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: CompetitionDetails["campaign"]
  onSuccess?: () => void
}

export function EditCompetitionDialog({
  open,
  onOpenChange,
  campaign,
  onSuccess,
}: EditCompetitionDialogProps) {
  const utils = api.useUtils()

  const [step, setStep] = React.useState(1)
  const [maxStepReached, setMaxStepReached] = React.useState(1)
  const [formData, setFormData] = React.useState<FormData>(INITIAL_FORM)
  const [prizeConfig, setPrizeConfig] =
    React.useState<PrizeConfig>(INITIAL_PRIZE_CONFIG)
  const [affiliateLinksEnabled, setAffiliateLinksEnabled] =
    React.useState(false)
  const [affiliateLinks, setAffiliateLinks] = React.useState(
    INITIAL_AFFILIATE_LINKS,
  )

  const [hashtagInput, setHashtagInput] = React.useState("")
  const [mentionInput, setMentionInput] = React.useState("")
  const [prohibitedInput, setProhibitedInput] = React.useState("")

  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [step])

  /* ---------- hidratação com os dados da campanha ---------- */

  React.useEffect(() => {
    if (!open || !campaign) return

    const startDate = campaign.startDate
      ? new Date(campaign.startDate)
      : undefined
    const endDate = campaign.endDate ? new Date(campaign.endDate) : undefined

    setFormData({
      name: campaign.name ?? "",
      description: campaign.description ?? "",
      coverImageUrl: campaign.coverImageUrl ?? null,
      startDate,
      endDate,
      startTime: startDate ? format(startDate, "HH:mm") : "20:00",
      endTime: endDate ? format(endDate, "HH:mm") : "20:00",
      platforms: campaign.platforms ?? [],
      requiredHashtags: campaign.requiredHashtags ?? [],
      requiredMentions: campaign.requiredMentions ?? [],
      prohibitedContent: campaign.prohibitedContent ?? [],
      prize: extractPrizeTotal(campaign.prizeInfo),
      isLeaderboardPublic: campaign.isLeaderboardPublic ?? true,
      requiresApproval: campaign.requiresApproval ?? true,
      autoApproveCreators: campaign.autoApproveCreators ?? false,
      rankingMetricType: campaign.rankingMetricType ?? "VIEWS",
      isPrivate: campaign.isPrivate ?? false,
      isProOnly: campaign.isProOnly ?? false,
      dailyPix: campaign.dailyPix ?? false,
      topClippersRankingEnabled: campaign.topClippersRankingEnabled ?? false,
      topClippersPrizeTable: toPrizeTable(
        campaign.topClippersPrizeTable,
        DEFAULT_TOP_CLIPPERS_PRIZE_TABLE,
      ),
    })

    const rule = campaign.activeRankingRule
    if (rule) {
      setPrizeConfig({
        dailyEnabled: rule.dailyEnabled ?? true,
        dailyTopCount: rule.dailyTopCount ?? 15,
        dailyTotalPrize: rule.dailyTotalPrize ?? 1000,
        dailyPrizeTable: toPrizeTable(
          rule.dailyPrizeTable,
          DEFAULT_DAILY_PRIZE_TABLE,
        ),
        bonusEnabled: rule.bonusEnabled ?? true,
        bonusMilestone: rule.bonusMilestone ?? 1000000,
        bonusAmount: rule.bonusAmount ?? 100,
        bonusMonthlyBudgetCap: rule.bonusMonthlyBudgetCap ?? 6000,
        monthlyEnabled: rule.monthlyEnabled ?? true,
        monthlyTopCount: rule.monthlyTopCount ?? 10,
        monthlyTotalPrize: rule.monthlyTotalPrize ?? 20000,
        monthlyPrizeTable: toPrizeTable(
          rule.monthlyPrizeTable,
          DEFAULT_MONTHLY_PRIZE_TABLE,
        ),
      })
    } else {
      setPrizeConfig(INITIAL_PRIZE_CONFIG)
    }

    const hasAnyAffiliateLink = !!(
      campaign.affiliateLinkInstagram ||
      campaign.affiliateLinkTiktok ||
      campaign.affiliateLinkYoutube ||
      campaign.affiliateLinkFacebook ||
      campaign.affiliateLinkKwai
    )
    setAffiliateLinksEnabled(hasAnyAffiliateLink)
    setAffiliateLinks({
      instagram: campaign.affiliateLinkInstagram ?? "",
      tiktok: campaign.affiliateLinkTiktok ?? "",
      youtube: campaign.affiliateLinkYoutube ?? "",
      facebook: campaign.affiliateLinkFacebook ?? "",
      kwai: campaign.affiliateLinkKwai ?? "",
    })

    setHashtagInput("")
    setMentionInput("")
    setProhibitedInput("")
    setStep(1)
    // Competição existente: todos os passos ficam navegáveis no stepper.
    setMaxStepReached(TOTAL_STEPS)
  }, [open, campaign])

  /* ---------- mutation ---------- */

  const updateCampaign = api.admin.campaigns.update.useMutation({
    onMutate: () => {
      toast.loading("Salvando alterações...", { id: "update-campaign" })
    },
    onSuccess: () => {
      toast.success("Competição atualizada com sucesso!", {
        id: "update-campaign",
      })
      void utils.admin.getCompetitionDetailsAdmin.invalidate()
      void utils.admin.getAllCampaignsWithStats.invalidate()
      void utils.campaign.getAll.invalidate()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar competição: ${error.message}`, {
        id: "update-campaign",
      })
    },
  })

  /* ---------- helpers de listas ---------- */

  const togglePlatform = (platform: string) =>
    setFormData((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }))

  const addHashtag = () => {
    const tag = hashtagInput.replace(/^#+/, "").trim()
    if (!tag) return
    setFormData((prev) =>
      prev.requiredHashtags.includes(tag)
        ? prev
        : { ...prev, requiredHashtags: [...prev.requiredHashtags, tag] },
    )
    setHashtagInput("")
  }

  const removeHashtag = (index: number) =>
    setFormData((prev) => ({
      ...prev,
      requiredHashtags: prev.requiredHashtags.filter((_, i) => i !== index),
    }))

  const addMention = () => {
    const mention = mentionInput.replace(/^@+/, "").trim()
    if (!mention) return
    setFormData((prev) =>
      prev.requiredMentions.includes(mention)
        ? prev
        : { ...prev, requiredMentions: [...prev.requiredMentions, mention] },
    )
    setMentionInput("")
  }

  const removeMention = (index: number) =>
    setFormData((prev) => ({
      ...prev,
      requiredMentions: prev.requiredMentions.filter((_, i) => i !== index),
    }))

  const addProhibited = () => {
    const content = prohibitedInput.trim()
    if (!content) return
    setFormData((prev) =>
      prev.prohibitedContent.includes(content)
        ? prev
        : { ...prev, prohibitedContent: [...prev.prohibitedContent, content] },
    )
    setProhibitedInput("")
  }

  const removeProhibited = (index: number) =>
    setFormData((prev) => ({
      ...prev,
      prohibitedContent: prev.prohibitedContent.filter((_, i) => i !== index),
    }))

  /* ---------- validação e navegação ---------- */

  const validateStep = React.useCallback(
    (target: number) => {
      switch (target) {
        case 1:
          return (
            formData.name.trim() !== "" && formData.description.trim() !== ""
          )
        case 2:
          return (
            !!formData.startDate &&
            !!formData.endDate &&
            formData.platforms.length > 0
          )
        default:
          return true
      }
    },
    [formData],
  )

  const isStepValid = validateStep(step)

  const goToStep = (target: number) => {
    if (target === step) return
    if (target > maxStepReached) return
    for (let s = 1; s < target; s++) {
      if (!validateStep(s)) return
    }
    setStep(target)
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      const next = step + 1
      setStep(next)
      setMaxStepReached((max) => Math.max(max, next))
    }
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  /* ---------- números derivados ---------- */

  const dailyTotal = prizeConfig.dailyEnabled
    ? prizeConfig.dailyTotalPrize * 30
    : 0
  const monthlyTotal = prizeConfig.monthlyEnabled
    ? prizeConfig.monthlyTotalPrize
    : 0
  const bonusTotal = prizeConfig.bonusEnabled
    ? prizeConfig.bonusMonthlyBudgetCap
    : 0
  const topClippersTotal = formData.topClippersRankingEnabled
    ? sumPrizeTable(formData.topClippersPrizeTable) * 30
    : 0
  const grandTotal = dailyTotal + monthlyTotal + bonusTotal + topClippersTotal

  const durationDays =
    formData.startDate && formData.endDate
      ? Math.ceil(
          (formData.endDate.getTime() - formData.startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null

  /* ---------- submit ---------- */

  const handleSubmit = () => {
    if (!formData.startDate || !formData.endDate) {
      toast.error("Por favor, selecione as datas de início e término")
      return
    }

    if (formData.topClippersRankingEnabled) {
      const topClippersError = validateTopClippersPrizeTable(
        formData.topClippersPrizeTable,
      )
      if (topClippersError) {
        toast.error(topClippersError, {
          description: "Ajuste a seção Top Clipadores na etapa de prêmios.",
        })
        setStep(4)
        return
      }
    }

    const [startHours, startMinutes] = formData.startTime
      .split(":")
      .map(Number)
    const [endHours, endMinutes] = formData.endTime.split(":").map(Number)

    const startDateWithTime = new Date(formData.startDate)
    startDateWithTime.setHours(startHours ?? 20, startMinutes ?? 0, 0, 0)

    const endDateWithTime = new Date(formData.endDate)
    endDateWithTime.setHours(endHours ?? 20, endMinutes ?? 0, 0, 0)

    const prizeInfo = {
      total: formData.prize.trim() || `R$ ${brl(grandTotal)}`,
      distribution: "Personalizado",
      daily: prizeConfig.dailyEnabled ? prizeConfig.dailyTotalPrize : 0,
      monthly: prizeConfig.monthlyEnabled ? prizeConfig.monthlyTotalPrize : 0,
      bonus: prizeConfig.bonusEnabled ? prizeConfig.bonusMonthlyBudgetCap : 0,
      topClippers: topClippersTotal,
    }

    updateCampaign.mutate({
      id: campaign.id,
      data: {
        name: formData.name,
        description: formData.description,
        coverImageUrl: formData.coverImageUrl,
        startDate: startDateWithTime,
        endDate: endDateWithTime,
        platforms: formData.platforms,
        requiredHashtags: formData.requiredHashtags,
        requiredMentions: formData.requiredMentions,
        prohibitedContent: formData.prohibitedContent,
        prizeInfo,
        isLeaderboardPublic: formData.isLeaderboardPublic,
        requiresApproval: formData.requiresApproval,
        autoApproveCreators: formData.autoApproveCreators,
        rankingMetricType: formData.rankingMetricType,
        isPrivate: formData.isPrivate,
        isProOnly: formData.isProOnly,
        dailyPix: formData.dailyPix,
        topClippersRankingEnabled: formData.topClippersRankingEnabled,
        topClippersPrizeTable: formData.topClippersPrizeTable,
        // Links de afiliados
        affiliateLinkInstagram:
          affiliateLinksEnabled && affiliateLinks.instagram.trim()
            ? affiliateLinks.instagram.trim()
            : null,
        affiliateLinkTiktok:
          affiliateLinksEnabled && affiliateLinks.tiktok.trim()
            ? affiliateLinks.tiktok.trim()
            : null,
        affiliateLinkYoutube:
          affiliateLinksEnabled && affiliateLinks.youtube.trim()
            ? affiliateLinks.youtube.trim()
            : null,
        affiliateLinkFacebook:
          affiliateLinksEnabled && affiliateLinks.facebook.trim()
            ? affiliateLinks.facebook.trim()
            : null,
        affiliateLinkKwai:
          affiliateLinksEnabled && affiliateLinks.kwai.trim()
            ? affiliateLinks.kwai.trim()
            : null,
      },
      prizeConfig,
    })
  }

  /* ======================================================================
     Render
     ====================================================================== */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[96svh] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:h-[min(90svh,56rem)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl"
      >
        {/* ===== Header fixo ===== */}
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
                    Competição
                  </span>
                </DialogTitle>
                <DialogDescription className="truncate text-xs sm:text-sm">
                  Atualize as informações e regras da competição
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

          {/* Stepper — mobile: barra de progresso */}
          <div className="relative mt-4 sm:hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-semibold">
                Etapa {step} de {TOTAL_STEPS}
              </span>
              <span className="text-foreground inline-flex items-center gap-1.5 font-bold">
                {React.createElement(STEPS[step - 1]!.icon, {
                  className: "size-3.5 text-brand-mint not-dark:text-primary",
                  weight: "fill",
                })}
                {STEPS[step - 1]!.label}
              </span>
            </div>
            <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-gradient-custom h-full rounded-full transition-all duration-500"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          {/* Stepper — desktop: trilho com nós */}
          <div className="relative mt-4 hidden items-center gap-2 sm:flex">
            {STEPS.map((s, index) => {
              const isDone = step > s.num
              const isCurrent = step === s.num
              const isClickable = s.num < step || s.num <= maxStepReached
              const StepIcon = s.icon
              return (
                <React.Fragment key={s.num}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.num)}
                    disabled={!isClickable || isCurrent}
                    title={`${s.num}. ${s.label}`}
                    className={cn(
                      "group flex shrink-0 items-center gap-2",
                      isClickable && !isCurrent
                        ? "cursor-pointer"
                        : "cursor-default",
                    )}
                  >
                    {isCurrent ? (
                      <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-full p-[2px] shadow-[0_0_18px_-4px_var(--brand-cyan)]">
                        <span className="bg-background text-foreground flex size-full items-center justify-center rounded-full">
                          <StepIcon className="size-4" weight="fill" />
                        </span>
                      </span>
                    ) : isDone ? (
                      <span className="bg-gradient-custom flex size-9 items-center justify-center rounded-full text-[#04222A] shadow-[0_0_14px_-6px_var(--brand-cyan)] transition-transform group-hover:scale-105">
                        <Check className="size-4" weight="bold" />
                      </span>
                    ) : (
                      <span className="border-border/70 bg-muted/50 text-muted-foreground flex size-9 items-center justify-center rounded-full border">
                        <StepIcon className="size-4" />
                      </span>
                    )}
                    <span
                      className={cn(
                        "hidden text-xs font-semibold whitespace-nowrap md:inline",
                        isCurrent
                          ? "text-foreground"
                          : isDone
                            ? "text-brand-mint not-dark:text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <span className="bg-muted h-[3px] min-w-4 flex-1 overflow-hidden rounded-full">
                      <span
                        className="bg-gradient-custom block h-full rounded-full transition-all duration-500"
                        style={{ width: isDone ? "100%" : "0%" }}
                      />
                    </span>
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* ===== Conteúdo rolável ===== */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
        >
          <div
            key={step}
            className="animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col gap-5 duration-300 sm:gap-6"
          >
            {step === 1 && (
              <Step1Basics formData={formData} setFormData={setFormData} />
            )}
            {step === 2 && (
              <Step2Schedule
                formData={formData}
                setFormData={setFormData}
                togglePlatform={togglePlatform}
                durationDays={durationDays}
              />
            )}
            {step === 3 && (
              <Step3Rules
                formData={formData}
                hashtagInput={hashtagInput}
                setHashtagInput={setHashtagInput}
                addHashtag={addHashtag}
                removeHashtag={removeHashtag}
                mentionInput={mentionInput}
                setMentionInput={setMentionInput}
                addMention={addMention}
                removeMention={removeMention}
                prohibitedInput={prohibitedInput}
                setProhibitedInput={setProhibitedInput}
                addProhibited={addProhibited}
                removeProhibited={removeProhibited}
              />
            )}
            {step === 4 && (
              <Step4Prizes
                formData={formData}
                setFormData={setFormData}
                prizeConfig={prizeConfig}
                setPrizeConfig={setPrizeConfig}
                dailyTotal={dailyTotal}
                monthlyTotal={monthlyTotal}
                bonusTotal={bonusTotal}
                topClippersTotal={topClippersTotal}
                grandTotal={grandTotal}
              />
            )}
            {step === 5 && (
              <Step5Finish
                formData={formData}
                setFormData={setFormData}
                affiliateLinksEnabled={affiliateLinksEnabled}
                setAffiliateLinksEnabled={setAffiliateLinksEnabled}
                affiliateLinks={affiliateLinks}
                setAffiliateLinks={setAffiliateLinks}
                durationDays={durationDays}
                grandTotal={grandTotal}
              />
            )}
          </div>
        </div>

        {/* ===== Footer fixo ===== */}
        <div className="border-border/60 bg-background/85 shrink-0 border-t px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
              aria-label="Voltar para a etapa anterior"
              className="h-10 cursor-pointer rounded-xl px-3 sm:h-11 sm:px-4"
            >
              <CaretLeft className="size-4" weight="bold" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>

            <span className="text-muted-foreground hidden text-xs font-medium md:inline">
              Etapa {step} de {TOTAL_STEPS} · {STEPS[step - 1]!.label}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 cursor-pointer rounded-xl px-3 sm:h-11 sm:px-4"
              >
                Cancelar
              </Button>

              {step < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!isStepValid}
                  className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                >
                  Próximo
                  <CaretRight className="size-4" weight="bold" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isStepValid || updateCampaign.isPending}
                  className="btn-gradient-auth h-10 cursor-pointer rounded-xl px-4 font-semibold sm:h-11 sm:px-5"
                >
                  {updateCampaign.isPending ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FloppyDisk className="size-4" weight="fill" />
                      <span className="hidden sm:inline">
                        Salvar Alterações
                      </span>
                      <span className="sm:hidden">Salvar</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ========================================================================
   Etapa 1 — Informações básicas
   ======================================================================== */

function Step1Basics({
  formData,
  setFormData,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  return (
    <>
      <SectionHero
        icon={<ClipboardText className="size-5" weight="fill" />}
        chipClass="bg-gradient-custom text-[#04222A]"
        title="Informações Básicas"
        subtitle="Identidade, visibilidade e capa da competição"
      />

      {/* Tipo de competição */}
      <div className="flex flex-col gap-2.5">
        <Label className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck
            className="text-brand-mint not-dark:text-primary size-4"
            weight="fill"
          />
          Tipo de Competição
        </Label>
        <div className="grid grid-cols-1 gap-2.5 min-[400px]:grid-cols-2 sm:gap-3">
          <VisibilityCard
            selected={!formData.isPrivate}
            onSelect={() =>
              setFormData((prev) => ({ ...prev, isPrivate: false }))
            }
            icon={<Globe className="size-5" weight="fill" />}
            title="Pública"
            hint="Clipadores se inscrevem"
            accent="emerald"
          />
          <VisibilityCard
            selected={formData.isPrivate}
            onSelect={() =>
              setFormData((prev) => ({ ...prev, isPrivate: true }))
            }
            icon={<Lock className="size-5" weight="fill" />}
            title="Privada"
            hint="Admin adiciona participantes"
            accent="amber"
          />
        </div>

        <InfoBanner tone={formData.isPrivate ? "amber" : "emerald"}>
          {formData.isPrivate ? (
            <>
              <strong className="font-semibold text-amber-600 dark:text-amber-400">
                Competição Privada:
              </strong>{" "}
              apenas o administrador pode adicionar os clipadores. Eles não
              poderão se inscrever por conta própria.
            </>
          ) : (
            <>
              <strong className="font-semibold text-emerald-600 dark:text-emerald-400">
                Competição Pública:
              </strong>{" "}
              clipadores podem se inscrever livremente. Você pode configurar
              aprovação manual ou automática.
            </>
          )}
        </InfoBanner>
      </div>

      {/* Exclusividade PRO */}
      <div className="flex flex-col gap-2.5">
        <Label className="flex items-center gap-1.5 text-sm font-semibold">
          <Crown
            className="size-4 text-violet-500 dark:text-violet-400"
            weight="fill"
          />
          Exclusividade PRO
        </Label>
        <label
          className={cn(
            "group relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-300 sm:p-4",
            formData.isProOnly
              ? "border-violet-500/50 bg-gradient-to-br from-violet-500/15 via-transparent to-purple-500/10 shadow-lg shadow-violet-500/10"
              : "border-border/70 hover:border-violet-500/40 hover:bg-violet-500/5",
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 sm:size-12",
              formData.isProOnly
                ? "scale-105 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30"
                : "bg-muted/70 text-muted-foreground group-hover:text-violet-500",
            )}
          >
            <Crown className="size-5" weight="fill" />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block text-sm font-bold transition-colors sm:text-[15px]",
                formData.isProOnly &&
                  "bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent dark:from-violet-400 dark:to-purple-400",
              )}
            >
              Apenas Assinantes PRO
            </span>
            <span className="text-muted-foreground block text-xs leading-snug">
              {formData.isProOnly
                ? "Somente assinantes do Clipfy League PRO poderão se inscrever"
                : "Todos os clipadores poderão se inscrever, independente do plano"}
            </span>
          </span>
          <Switch
            checked={formData.isProOnly}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, isProOnly: checked }))
            }
            className="data-[state=checked]:bg-violet-500"
          />
        </label>

        {formData.isProOnly && (
          <InfoBanner tone="violet">
            <strong className="font-semibold text-violet-600 dark:text-violet-400">
              Competição Exclusiva PRO:
            </strong>{" "}
            apenas clipadores com assinatura PRO ativa poderão se inscrever.
            Clipadores sem PRO verão um aviso para assinar.
          </InfoBanner>
        )}
      </div>

      {/* Nome */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-comp-name" className="text-sm font-semibold">
          Nome da Competição *
        </Label>
        <Input
          id="edit-comp-name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Ex.: Cortes do Bruno Silva — Q4 2026"
          className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
        />
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-comp-desc" className="text-sm font-semibold">
            Descrição *
          </Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              formData.description.length >= 500
                ? "font-semibold text-amber-500"
                : "text-muted-foreground",
            )}
          >
            {formData.description.length}/500
          </span>
        </div>
        <Textarea
          id="edit-comp-desc"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              description: e.target.value.slice(0, 500),
            }))
          }
          placeholder="Descreva os objetivos e regras principais da competição..."
          className="focus-visible:ring-brand-cyan/40 min-h-24 resize-none rounded-xl"
        />
      </div>

      {/* Capa */}
      <CoverImagePicker
        value={formData.coverImageUrl}
        onChange={(url) =>
          setFormData((prev) => ({ ...prev, coverImageUrl: url }))
        }
        hint="Imagem quadrada exibida nos cards da competição"
      />
    </>
  )
}

/* ========================================================================
   Etapa 2 — Período e plataformas
   ======================================================================== */

function Step2Schedule({
  formData,
  setFormData,
  togglePlatform,
  durationDays,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  togglePlatform: (platform: string) => void
  durationDays: number | null
}) {
  return (
    <>
      <SectionHero
        icon={<CalendarBlank className="size-5" weight="fill" />}
        chipClass="bg-gradient-to-br from-sky-500 to-cyan-500 text-white"
        title="Período e Plataformas"
        subtitle="Edite quando e onde a competição acontecerá"
      />

      {/* Datas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DateTimeField
          label="Data de Início *"
          date={formData.startDate}
          onDateChange={(date) =>
            setFormData((prev) => ({ ...prev, startDate: date }))
          }
          time={formData.startTime}
          onTimeChange={(time) =>
            setFormData((prev) => ({ ...prev, startTime: time }))
          }
        />
        <DateTimeField
          label="Data de Término *"
          date={formData.endDate}
          onDateChange={(date) =>
            setFormData((prev) => ({ ...prev, endDate: date }))
          }
          time={formData.endTime}
          onTimeChange={(time) =>
            setFormData((prev) => ({ ...prev, endTime: time }))
          }
          disabledDate={(date) =>
            formData.startDate ? date < formData.startDate : false
          }
          defaultMonth={formData.startDate}
        />
      </div>

      {durationDays !== null && durationDays > 0 && (
        <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5">
          <Clock
            className="text-brand-mint not-dark:text-primary size-4"
            weight="fill"
          />
          <p className="text-xs font-semibold sm:text-sm">
            {durationDays} {durationDays === 1 ? "dia" : "dias"} de competição
          </p>
        </div>
      )}

      {/* Plataformas */}
      <div className="flex flex-col gap-2.5">
        <Label className="text-sm font-semibold">
          Plataformas Permitidas *
        </Label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {PLATFORMS.map((platform) => {
            const config = platformConfig[platform]
            const PlatformIcon = config.icon
            const selected = formData.platforms.includes(platform)
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border p-3.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                  selected
                    ? cn(config.borderColor, config.bgColor, "shadow-lg")
                    : "border-border/70 hover:border-border bg-card/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl transition-colors sm:size-11",
                    selected ? config.bgColor : "bg-muted/60",
                  )}
                >
                  <PlatformIcon
                    className={cn(
                      "size-5",
                      selected ? config.color : "text-muted-foreground",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    selected ? config.color : "text-muted-foreground",
                  )}
                >
                  {config.label}
                </span>
                {selected && (
                  <CheckCircle
                    className={cn(
                      "absolute top-2 right-2 size-4.5",
                      config.color,
                    )}
                    weight="fill"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Premiação total */}
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="edit-comp-prize"
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <Sparkle className="size-4 text-amber-500" weight="fill" />
          Premiação Total (opcional)
        </Label>
        <Input
          id="edit-comp-prize"
          value={formData.prize}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, prize: e.target.value }))
          }
          placeholder="Ex.: R$ 50.000"
          className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl"
        />
        <p className="text-muted-foreground text-xs">
          Se vazio, usamos o total estimado da configuração de prêmios da
          próxima etapa.
        </p>
      </div>
    </>
  )
}

/* ========================================================================
   Etapa 3 — Regras de conteúdo
   ======================================================================== */

function Step3Rules(props: {
  formData: FormData
  hashtagInput: string
  setHashtagInput: (value: string) => void
  addHashtag: () => void
  removeHashtag: (index: number) => void
  mentionInput: string
  setMentionInput: (value: string) => void
  addMention: () => void
  removeMention: (index: number) => void
  prohibitedInput: string
  setProhibitedInput: (value: string) => void
  addProhibited: () => void
  removeProhibited: (index: number) => void
}) {
  return (
    <>
      <SectionHero
        icon={<ListChecks className="size-5" weight="fill" />}
        chipClass="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
        title="Regras de Conteúdo"
        subtitle="Edite hashtags, menções e restrições — todas opcionais"
      />

      <ChipsField
        icon={<Hash className="size-4" weight="bold" />}
        label="Hashtags Obrigatórias"
        placeholder="Ex.: #MinhaCompetição"
        inputValue={props.hashtagInput}
        onInputChange={props.setHashtagInput}
        onAdd={props.addHashtag}
        items={props.formData.requiredHashtags}
        onRemove={props.removeHashtag}
        renderItem={(tag) => `#${tag}`}
        chipClass="border-brand-cyan/30 text-brand-cyan not-dark:border-primary/40 not-dark:text-primary"
        emptyHint="Todo post precisará conter essas hashtags para ser validado."
      />

      <ChipsField
        icon={<At className="size-4" weight="bold" />}
        label="Menções Obrigatórias"
        placeholder="Ex.: @meuusuario"
        inputValue={props.mentionInput}
        onInputChange={props.setMentionInput}
        onAdd={props.addMention}
        items={props.formData.requiredMentions}
        onRemove={props.removeMention}
        renderItem={(mention) => `@${mention}`}
        chipClass="border-violet-500/30 text-violet-600 dark:text-violet-400"
        emptyHint="Perfis que precisam ser marcados na legenda ou no vídeo."
      />

      <ChipsField
        icon={<Prohibit className="size-4" weight="bold" />}
        label="Conteúdo Proibido"
        placeholder="Ex.: palavrão, violência"
        inputValue={props.prohibitedInput}
        onInputChange={props.setProhibitedInput}
        onAdd={props.addProhibited}
        items={props.formData.prohibitedContent}
        onRemove={props.removeProhibited}
        renderItem={(content) => content}
        chipClass="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
        emptyHint="Temas ou termos que desclassificam o post da competição."
      />
    </>
  )
}

/* ========================================================================
   Etapa 4 — Premiação
   ======================================================================== */

function Step4Prizes({
  formData,
  setFormData,
  prizeConfig,
  setPrizeConfig,
  dailyTotal,
  monthlyTotal,
  bonusTotal,
  topClippersTotal,
  grandTotal,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  prizeConfig: PrizeConfig
  setPrizeConfig: React.Dispatch<React.SetStateAction<PrizeConfig>>
  dailyTotal: number
  monthlyTotal: number
  bonusTotal: number
  topClippersTotal: number
  grandTotal: number
}) {
  const topClippersDailyTotal = sumPrizeTable(formData.topClippersPrizeTable)

  return (
    <>
      <SectionHero
        icon={<Medal className="size-5" weight="fill" />}
        chipClass="bg-gradient-to-br from-amber-500 to-orange-500 text-white"
        title="Configurar Premiação"
        subtitle="Métrica de ranking, prêmios diários, bônus e mensais"
      />

      {/* Métrica de ranking */}
      <div className="border-border/70 bg-card/40 flex flex-col gap-3.5 rounded-2xl border p-4 sm:p-5">
        <header className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white sm:size-10">
            <ChartBar className="size-4.5" weight="fill" />
          </span>
          <div>
            <h4 className="text-sm font-bold sm:text-[15px]">
              Tipo de Métrica de Ranking
            </h4>
            <p className="text-muted-foreground text-xs">
              Como o ranking será calculado
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
          {/* VIEWS */}
          <button
            type="button"
            onClick={() =>
              setFormData((prev) => ({ ...prev, rankingMetricType: "VIEWS" }))
            }
            className={cn(
              "relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] sm:p-4",
              formData.rankingMetricType === "VIEWS"
                ? "border-cyan-500/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                : "border-border/70 hover:border-cyan-500/40",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                formData.rankingMetricType === "VIEWS"
                  ? "bg-cyan-500 text-white"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              <Eye className="size-5" weight="fill" />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-bold",
                  formData.rankingMetricType === "VIEWS" &&
                    "text-cyan-600 dark:text-cyan-400",
                )}
              >
                Views
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                Ranking baseado apenas na quantidade de visualizações
              </span>
            </span>
            {formData.rankingMetricType === "VIEWS" && (
              <CheckCircle
                className="absolute top-2.5 right-2.5 size-4.5 text-cyan-500"
                weight="fill"
              />
            )}
          </button>

          {/* VIEWS × ENGAJAMENTO */}
          <button
            type="button"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                rankingMetricType: "VIEWS_X_ENGAGEMENT",
              }))
            }
            className={cn(
              "relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] sm:p-4",
              formData.rankingMetricType === "VIEWS_X_ENGAGEMENT"
                ? "border-pink-500/60 bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-orange-500/15 shadow-lg shadow-pink-500/10"
                : "border-border/70 hover:border-pink-500/40",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                formData.rankingMetricType === "VIEWS_X_ENGAGEMENT"
                  ? "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              <Pulse className="size-5" weight="fill" />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-bold",
                  formData.rankingMetricType === "VIEWS_X_ENGAGEMENT" &&
                    "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent dark:from-purple-400 dark:via-pink-400 dark:to-orange-400",
                )}
              >
                Views × Engajamento
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                Views multiplicado pela taxa de engajamento (likes,
                comentários, shares)
              </span>
            </span>
            {formData.rankingMetricType === "VIEWS_X_ENGAGEMENT" && (
              <CheckCircle
                className="absolute top-2.5 right-2.5 size-4.5 text-pink-500"
                weight="fill"
              />
            )}
          </button>
        </div>

        {formData.rankingMetricType === "VIEWS_X_ENGAGEMENT" && (
          <div className="animate-in fade-in-0 slide-in-from-top-1 flex items-start gap-2.5 rounded-xl border border-pink-500/25 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 p-3 duration-200">
            <Info
              className="size-4 shrink-0 text-pink-500 dark:text-pink-400"
              weight="fill"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              <strong className="text-foreground font-semibold">
                Fórmula:
              </strong>{" "}
              Score = Views × (1 + Taxa de Engajamento). Isso recompensa
              vídeos com maior interação da audiência!
            </p>
          </div>
        )}
      </div>

      {/* Premiação diária */}
      <PrizeSection
        icon={<Coins className="size-4.5" weight="fill" />}
        chipClass="bg-gradient-custom text-[#04222A]"
        accentClass="border-brand-cyan/25 not-dark:border-primary/25"
        title="Premiação Diária"
        subtitle="Top vídeos do dia"
        enabled={prizeConfig.dailyEnabled}
        onEnabledChange={(checked) =>
          setPrizeConfig((prev) => ({ ...prev, dailyEnabled: checked }))
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField
            label="Top Posições"
            value={prizeConfig.dailyTopCount}
            onChange={(value) =>
              setPrizeConfig((prev) => ({ ...prev, dailyTopCount: value }))
            }
          />
          <NumField
            label="Prêmio/Dia (R$)"
            prefix="R$"
            value={prizeConfig.dailyTotalPrize}
            onChange={(value) =>
              setPrizeConfig((prev) => ({ ...prev, dailyTotalPrize: value }))
            }
          />
        </div>

        <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <Info
            className="text-brand-mint not-dark:text-primary size-4 shrink-0"
            weight="fill"
          />
          <p className="text-xs font-semibold">
            Total mensal: R$ {brl(prizeConfig.dailyTotalPrize * 30)}{" "}
            <span className="text-muted-foreground font-normal">
              (30 dias)
            </span>
          </p>
        </div>

        <PrizeTableEditor
          table={prizeConfig.dailyPrizeTable}
          onChange={(table) =>
            setPrizeConfig((prev) => ({ ...prev, dailyPrizeTable: table }))
          }
        />
      </PrizeSection>

      {/* Top Clipadores por vídeos postados */}
      <PrizeSection
        icon={<Ranking className="size-4.5" weight="fill" />}
        chipClass="bg-gradient-to-br from-sky-500 to-indigo-500 text-white"
        accentClass="border-sky-500/25"
        title="Top Clipadores"
        subtitle="Ranking diário por vídeos publicados"
        enabled={formData.topClippersRankingEnabled}
        onEnabledChange={(checked) =>
          setFormData((prev) => ({
            ...prev,
            topClippersRankingEnabled: checked,
          }))
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
          <Info
            className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
            weight="fill"
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            Ordena os clipadores pela quantidade de vídeos elegíveis na janela
            diária das 20h às 20h. Em caso de empate, vence quem tiver mais
            views.
          </p>
        </div>

        <PrizeTableEditor
          numericPositions
          label="Premiação por Posição"
          hint={
            <span className="text-xs font-bold text-sky-600 tabular-nums dark:text-sky-400">
              Total/dia: R$ {brl(topClippersDailyTotal)}
            </span>
          }
          table={formData.topClippersPrizeTable}
          onChange={(table) =>
            setFormData((prev) => ({ ...prev, topClippersPrizeTable: table }))
          }
        />
      </PrizeSection>

      {/* Bônus por marco */}
      <PrizeSection
        icon={<TrendUp className="size-4.5" weight="bold" />}
        chipClass="bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
        accentClass="border-brand-mint/25 not-dark:border-emerald-500/25"
        title="Bônus por Marco"
        subtitle="Prêmio por milestone de views"
        enabled={prizeConfig.bonusEnabled}
        onEnabledChange={(checked) =>
          setPrizeConfig((prev) => ({ ...prev, bonusEnabled: checked }))
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField
            label="Milestone de Views"
            icon={<Eye className="size-3.5" weight="fill" />}
            value={prizeConfig.bonusMilestone}
            onChange={(value) =>
              setPrizeConfig((prev) => ({ ...prev, bonusMilestone: value }))
            }
            placeholder="Ex.: 1000000"
          />
          <NumField
            label="Valor do Bônus (R$)"
            prefix="R$"
            value={prizeConfig.bonusAmount}
            onChange={(value) =>
              setPrizeConfig((prev) => ({ ...prev, bonusAmount: value }))
            }
          />
        </div>
        <NumField
          label="Teto Mensal (R$)"
          prefix="R$"
          value={prizeConfig.bonusMonthlyBudgetCap}
          onChange={(value) =>
            setPrizeConfig((prev) => ({
              ...prev,
              bonusMonthlyBudgetCap: value,
            }))
          }
        />
        <div className="border-brand-mint/25 bg-brand-mint/5 not-dark:border-emerald-500/25 not-dark:bg-emerald-500/5 rounded-xl border px-3 py-2.5">
          <p className="text-xs leading-relaxed">
            <strong className="text-brand-mint not-dark:text-emerald-600 font-semibold">
              Exemplo:
            </strong>{" "}
            <span className="text-muted-foreground">
              cada vídeo com {brl(prizeConfig.bonusMilestone)}+ views ganha R${" "}
              {brl(prizeConfig.bonusAmount)}
            </span>
          </p>
        </div>
      </PrizeSection>

      {/* Premiação mensal */}
      <PrizeSection
        icon={<Trophy className="size-4.5" weight="fill" />}
        chipClass="bg-gradient-to-br from-emerald-500 to-green-500 text-white"
        accentClass="border-emerald-500/25"
        title="Premiação Mensal"
        subtitle="Top clipadores do mês"
        enabled={prizeConfig.monthlyEnabled}
        onEnabledChange={(checked) =>
          setPrizeConfig((prev) => ({ ...prev, monthlyEnabled: checked }))
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumField
            label="Top Posições"
            value={prizeConfig.monthlyTopCount}
            onChange={(value) =>
              setPrizeConfig((prev) => ({ ...prev, monthlyTopCount: value }))
            }
          />
          <NumField
            label="Total Mensal (R$)"
            prefix="R$"
            value={prizeConfig.monthlyTotalPrize}
            onChange={(value) =>
              setPrizeConfig((prev) => ({
                ...prev,
                monthlyTotalPrize: value,
              }))
            }
          />
        </div>

        <PrizeTableEditor
          table={prizeConfig.monthlyPrizeTable}
          onChange={(table) =>
            setPrizeConfig((prev) => ({ ...prev, monthlyPrizeTable: table }))
          }
        />
      </PrizeSection>

      {/* Resumo financeiro */}
      <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5 p-4 sm:p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold">
          <CurrencyCircleDollar
            className="size-4.5 text-amber-500"
            weight="fill"
          />
          Resumo Financeiro
        </h4>
        <dl className="mt-3 flex flex-col gap-2 text-xs sm:text-sm">
          {prizeConfig.dailyEnabled && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                Premiação Diária (30 dias)
              </dt>
              <dd className="text-brand-cyan not-dark:text-primary font-bold tabular-nums">
                R$ {brl(dailyTotal)}
              </dd>
            </div>
          )}
          {formData.topClippersRankingEnabled && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">
                Top Clipadores (30 dias)
              </dt>
              <dd className="font-bold text-sky-600 tabular-nums dark:text-sky-400">
                R$ {brl(topClippersTotal)}
              </dd>
            </div>
          )}
          {prizeConfig.monthlyEnabled && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Premiação Mensal</dt>
              <dd className="font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                R$ {brl(monthlyTotal)}
              </dd>
            </div>
          )}
          {prizeConfig.bonusEnabled && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Bônus (teto mensal)</dt>
              <dd className="text-brand-mint not-dark:text-emerald-600 font-bold tabular-nums">
                R$ {brl(bonusTotal)}
              </dd>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-amber-500/20 pt-2.5">
            <dt className="text-sm font-bold">Total estimado</dt>
            <dd className="text-lg font-extrabold text-amber-600 tabular-nums sm:text-xl dark:text-amber-400">
              R$ {brl(grandTotal)}
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}

/* ========================================================================
   Etapa 5 — Finalizar
   ======================================================================== */

function Step5Finish({
  formData,
  setFormData,
  affiliateLinksEnabled,
  setAffiliateLinksEnabled,
  affiliateLinks,
  setAffiliateLinks,
  durationDays,
  grandTotal,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  affiliateLinksEnabled: boolean
  setAffiliateLinksEnabled: (enabled: boolean) => void
  affiliateLinks: Record<AffiliateKey, string>
  setAffiliateLinks: React.Dispatch<
    React.SetStateAction<Record<AffiliateKey, string>>
  >
  durationDays: number | null
  grandTotal: number
}) {
  return (
    <>
      <SectionHero
        icon={<FlagCheckered className="size-5" weight="fill" />}
        chipClass="bg-gradient-to-br from-emerald-500 to-green-500 text-white"
        title="Finalizar Edição"
        subtitle="Capa, links de afiliados, opções finais e revisão"
      />

      {/* Capa (última chance) */}
      <CoverImagePicker
        value={formData.coverImageUrl}
        onChange={(url) =>
          setFormData((prev) => ({ ...prev, coverImageUrl: url }))
        }
        hint="Edite a imagem quadrada da sua competição (opcional)"
      />

      {/* Links de afiliados */}
      <div
        className={cn(
          "flex flex-col gap-3.5 rounded-2xl border p-4 transition-colors sm:p-5",
          affiliateLinksEnabled
            ? "border-indigo-500/40 bg-gradient-to-br from-indigo-500/10 via-transparent to-violet-500/5"
            : "border-border/70 bg-card/40",
        )}
      >
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white sm:size-10">
              <LinkSimple className="size-4.5" weight="bold" />
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-bold sm:text-[15px]">
                Links de Afiliados
              </h4>
              <p className="text-muted-foreground truncate text-xs">
                URLs base para rastreamento de vendas
              </p>
            </div>
          </div>
          <Switch
            checked={affiliateLinksEnabled}
            onCheckedChange={setAffiliateLinksEnabled}
            className="data-[state=checked]:bg-indigo-500"
          />
        </header>

        {affiliateLinksEnabled && (
          <div className="animate-in fade-in-0 slide-in-from-top-1 flex flex-col gap-3 border-t border-indigo-500/20 pt-3.5 duration-200">
            <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
              <Info
                className="mt-0.5 size-3.5 shrink-0 text-indigo-500 dark:text-indigo-400"
                weight="fill"
              />
              Insira a URL base de afiliado para cada plataforma. O ID do
              clipador será adicionado automaticamente no final.
            </p>

            <div className="flex flex-col gap-2.5">
              {AFFILIATE_PLATFORMS.map(({ key, platform }) => {
                const config = platformConfig[platform]
                const PlatformIcon = config.icon
                return (
                  <div key={key} className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        config.bgColor,
                      )}
                    >
                      <PlatformIcon className={cn("size-4", config.color)} />
                    </span>
                    <Input
                      value={affiliateLinks[key]}
                      onChange={(e) =>
                        setAffiliateLinks((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder="https://exemplo.com/afiliado?ref="
                      inputMode="url"
                      className="focus-visible:ring-brand-cyan/40 h-10 rounded-xl text-sm"
                      aria-label={`Link de afiliado ${config.label}`}
                    />
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5">
              <p className="text-muted-foreground text-xs leading-relaxed break-words">
                <strong className="font-semibold text-indigo-500 dark:text-indigo-400">
                  Exemplo:
                </strong>{" "}
                se o link base for{" "}
                <code className="bg-background/60 rounded px-1 py-0.5 text-[11px]">
                  https://kiwify.com.br/abc?src=
                </code>
                , o clipador verá{" "}
                <code className="bg-background/60 rounded px-1 py-0.5 text-[11px]">
                  https://kiwify.com.br/abc?src=CLIPPER_ID
                </code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Configurações */}
      <div className="flex flex-col gap-2.5">
        <Label className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck
            className="text-brand-mint not-dark:text-primary size-4"
            weight="fill"
          />
          Configurações
        </Label>
        <div className="border-border/70 bg-card/40 flex flex-col gap-1 rounded-2xl border p-2">
          <SettingRow
            icon={<CurrencyCircleDollar className="size-4.5" weight="fill" />}
            label="PIX no rank diário"
            hint="Após divulgar e pagar o rank na carteira, permite enviar PIX real (Asaas) pelo admin."
            checked={formData.dailyPix}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, dailyPix: checked }))
            }
          />
          <SettingRow
            icon={<Eye className="size-4.5" weight="fill" />}
            label="Ranking Público"
            hint="Permitir que todos vejam o ranking"
            checked={formData.isLeaderboardPublic}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                isLeaderboardPublic: checked,
              }))
            }
          />
          <SettingRow
            icon={<Lock className="size-4.5" weight="fill" />}
            label="Requer Aprovação"
            hint="Aprovar participantes manualmente"
            checked={formData.requiresApproval}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, requiresApproval: checked }))
            }
          />
          <SettingRow
            icon={<CheckCircle className="size-4.5" weight="fill" />}
            label="Aprovação Automática"
            hint="Aprovar criadores automaticamente"
            checked={formData.autoApproveCreators}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({
                ...prev,
                autoApproveCreators: checked,
              }))
            }
          />
        </div>
      </div>

      {/* Resumo */}
      <div className="border-brand-cyan/25 bg-brand-cyan/5 not-dark:border-primary/25 not-dark:bg-primary/5 rounded-2xl border p-4 sm:p-5">
        <h4 className="flex items-center gap-2 text-sm font-bold">
          <Trophy
            className="text-brand-mint not-dark:text-primary size-4.5"
            weight="fill"
          />
          Resumo das Alterações
        </h4>
        <dl className="mt-3 flex flex-col gap-2.5 text-xs sm:text-sm">
          <SummaryRow label="Nome">
            <span className="max-w-[60%] truncate font-semibold">
              {formData.name || "—"}
            </span>
          </SummaryRow>
          <SummaryRow label="Tipo">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-semibold",
                formData.isPrivate
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {formData.isPrivate ? (
                <Lock className="size-3.5" weight="fill" />
              ) : (
                <Globe className="size-3.5" weight="fill" />
              )}
              {formData.isPrivate ? "Privada" : "Pública"}
              {formData.isProOnly && (
                <Badge
                  className="ml-1 gap-1 rounded-full border-violet-500/30 bg-violet-500/15 text-[10px] text-violet-600 dark:text-violet-400"
                  variant="outline"
                >
                  <Crown className="size-2.5" weight="fill" />
                  PRO
                </Badge>
              )}
            </span>
          </SummaryRow>
          <SummaryRow label="Plataformas">
            {formData.platforms.length > 0 ? (
              <span className="flex items-center gap-1">
                {formData.platforms.map((platform) => {
                  const config = platformConfig[platform as PlatformKey]
                  if (!config) return null
                  const PlatformIcon = config.icon
                  return (
                    <span
                      key={platform}
                      title={config.label}
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md",
                        config.bgColor,
                      )}
                    >
                      <PlatformIcon
                        className={cn("size-3.5", config.color)}
                      />
                    </span>
                  )
                })}
              </span>
            ) : (
              <span className="font-semibold">—</span>
            )}
          </SummaryRow>
          <SummaryRow label="Regras">
            <span className="font-semibold">
              {formData.requiredHashtags.length} hashtags ·{" "}
              {formData.requiredMentions.length} menções ·{" "}
              {formData.prohibitedContent.length} restrições
            </span>
          </SummaryRow>
          <SummaryRow label="Métrica">
            <span className="font-semibold">
              {formData.rankingMetricType === "VIEWS"
                ? "Views"
                : "Views × Engajamento"}
            </span>
          </SummaryRow>
          <SummaryRow label="Top Clipadores">
            <span className="font-semibold">
              {formData.topClippersRankingEnabled
                ? `Ativo · ${Object.keys(formData.topClippersPrizeTable).length} posições`
                : "Desativado"}
            </span>
          </SummaryRow>
          <SummaryRow label="Duração">
            <span className="font-semibold">
              {durationDays !== null
                ? `${durationDays} ${durationDays === 1 ? "dia" : "dias"}`
                : "—"}
            </span>
          </SummaryRow>
          <SummaryRow label="Premiação">
            <span className="text-gradient not-dark:brightness-[0.7] not-dark:saturate-[1.4] font-extrabold tabular-nums">
              {formatPrizeLabel(formData.prize) || `R$ ${brl(grandTotal)}`}
            </span>
          </SummaryRow>
        </dl>
      </div>
    </>
  )
}

/* ========================================================================
   Blocos reutilizáveis
   ======================================================================== */

function SectionHero({
  icon,
  chipClass,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  chipClass: string
  title: string
  subtitle: string
}) {
  return (
    <div className="border-border/60 bg-card/40 relative overflow-hidden rounded-2xl border p-4 sm:p-5">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-14 -right-10 size-32 rounded-full opacity-15 blur-2xl",
          chipClass,
        )}
      />
      <div className="relative flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl shadow-lg sm:size-11",
            chipClass,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight sm:text-lg">
            {title}
          </h3>
          <p className="text-muted-foreground truncate text-xs sm:text-sm">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  )
}

function VisibilityCard({
  selected,
  onSelect,
  icon,
  title,
  hint,
  accent,
}: {
  selected: boolean
  onSelect: () => void
  icon: React.ReactNode
  title: string
  hint: string
  accent: "emerald" | "amber"
}) {
  const palette =
    accent === "emerald"
      ? {
          border: "border-emerald-500/50",
          bg: "bg-gradient-to-br from-emerald-500/15 via-transparent to-emerald-500/5",
          shadow: "shadow-lg shadow-emerald-500/10",
          chip: "bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30",
          text: "text-emerald-600 dark:text-emerald-400",
          hoverBorder: "hover:border-emerald-500/40",
          check: "text-emerald-500",
        }
      : {
          border: "border-amber-500/50",
          bg: "bg-gradient-to-br from-amber-500/15 via-transparent to-orange-500/5",
          shadow: "shadow-lg shadow-amber-500/10",
          chip: "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30",
          text: "text-amber-600 dark:text-amber-400",
          hoverBorder: "hover:border-amber-500/40",
          check: "text-amber-500",
        }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
        selected
          ? cn(palette.border, palette.bg, palette.shadow)
          : cn("border-border/70 bg-card/40", palette.hoverBorder),
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl transition-all duration-300 sm:size-12",
          selected
            ? cn(palette.chip, "scale-105")
            : "bg-muted/70 text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="text-center">
        <span
          className={cn(
            "block text-sm font-bold transition-colors sm:text-[15px]",
            selected
              ? palette.text
              : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          {title}
        </span>
        <span className="text-muted-foreground block text-[11px] leading-tight sm:text-xs">
          {hint}
        </span>
      </span>
      {selected && (
        <CheckCircle
          className={cn("absolute top-2 right-2 size-4.5", palette.check)}
          weight="fill"
        />
      )}
    </button>
  )
}

function InfoBanner({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "violet"
  children: React.ReactNode
}) {
  const palette = {
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-500",
    violet: "border-violet-500/20 bg-violet-500/5 text-violet-500",
  }[tone]

  return (
    <div
      className={cn(
        "animate-in fade-in-0 flex items-start gap-2.5 rounded-xl border p-3 transition-colors duration-200",
        palette,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" weight="fill" />
      <p className="text-muted-foreground text-xs leading-relaxed">
        {children}
      </p>
    </div>
  )
}

function CoverImagePicker({
  value,
  onChange,
  hint,
}: {
  value: string | null
  onChange: (url: string | null) => void
  hint: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-semibold">Imagem de Capa · 1:1</Label>
      <p className="text-muted-foreground -mt-0.5 text-xs">{hint}</p>
      {value ? (
        <div className="border-border/60 relative mx-auto aspect-square w-full max-w-60 overflow-hidden rounded-2xl border">
          <Image
            src={value}
            alt="Capa da competição"
            fill
            sizes="240px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remover capa"
            className="absolute top-2 right-2 flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-red-500/80"
          >
            <Trash className="size-4" />
          </button>
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            <CheckCircle className="size-3 text-emerald-400" weight="fill" />
            Capa definida
          </span>
        </div>
      ) : (
        <UploadDropzone
          endpoint="competitionCover"
          onClientUploadComplete={(files) => {
            const url = files?.[0]?.ufsUrl ?? files?.[0]?.url
            if (url) {
              onChange(url)
              toast.success("Capa enviada!")
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
  )
}

function DateTimeField({
  label,
  date,
  onDateChange,
  time,
  onTimeChange,
  disabledDate,
  defaultMonth,
}: {
  label: string
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  time: string
  onTimeChange: (time: string) => void
  disabledDate?: (date: Date) => boolean
  defaultMonth?: Date
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "focus-visible:ring-brand-cyan/40 h-11 w-full cursor-pointer justify-start rounded-xl text-left text-sm font-normal",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarBlank className="size-4" />
            {date ? (
              format(date, "PPP", { locale: ptBR })
            ) : (
              <span>Selecione a data</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto overflow-hidden rounded-2xl p-0"
          align="start"
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selected) => {
              onDateChange(selected)
              setOpen(false)
            }}
            disabled={disabledDate}
            defaultMonth={date ?? defaultMonth}
            locale={ptBR}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <div className="relative">
        <Clock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <Input
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          className="focus-visible:ring-brand-cyan/40 h-11 rounded-xl pl-10 tabular-nums"
          aria-label={`Horário — ${label}`}
        />
      </div>
    </div>
  )
}

function ChipsField({
  icon,
  label,
  placeholder,
  inputValue,
  onInputChange,
  onAdd,
  items,
  onRemove,
  renderItem,
  chipClass,
  emptyHint,
}: {
  icon: React.ReactNode
  label: string
  placeholder: string
  inputValue: string
  onInputChange: (value: string) => void
  onAdd: () => void
  items: string[]
  onRemove: (index: number) => void
  renderItem: (item: string) => string
  chipClass: string
  emptyHint: string
}) {
  return (
    <div className="border-border/70 bg-card/40 flex flex-col gap-3 rounded-2xl border p-4 sm:p-5">
      <Label className="flex items-center gap-1.5 text-sm font-semibold">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAdd()
            }
          }}
          placeholder={placeholder}
          className="focus-visible:ring-brand-cyan/40 h-10 flex-1 rounded-xl"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onAdd}
          className="h-10 shrink-0 cursor-pointer rounded-xl px-3 sm:px-4"
        >
          <Plus className="size-4 sm:hidden" weight="bold" />
          <span className="hidden sm:inline">Adicionar</span>
        </Button>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <Badge
              key={`${item}-${index}`}
              variant="outline"
              className={cn("gap-1 rounded-full py-1 pr-1 pl-2.5", chipClass)}
            >
              {renderItem(item)}
              <button
                type="button"
                aria-label={`Remover ${renderItem(item)}`}
                onClick={() => onRemove(index)}
                className="hover:bg-foreground/10 ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{emptyHint}</p>
      )}
    </div>
  )
}

function PrizeSection({
  icon,
  chipClass,
  accentClass,
  title,
  subtitle,
  enabled,
  onEnabledChange,
  children,
}: {
  icon: React.ReactNode
  chipClass: string
  accentClass: string
  title: string
  subtitle: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border p-4 transition-colors sm:p-5",
        enabled ? cn(accentClass, "bg-card/40") : "border-border/70 bg-card/20",
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-md sm:size-10",
              enabled ? chipClass : "bg-muted/60 text-muted-foreground",
            )}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold sm:text-[15px]">{title}</h4>
            <p className="text-muted-foreground truncate text-xs">
              {subtitle}
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </header>

      {enabled && (
        <div className="animate-in fade-in-0 slide-in-from-top-1 border-border/60 flex flex-col gap-3 border-t pt-3.5 duration-200">
          {children}
        </div>
      )}
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
  prefix,
  icon,
  placeholder,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  prefix?: string
  icon?: React.ReactNode
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-muted-foreground text-xs font-semibold">
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold">
            {prefix}
          </span>
        )}
        {icon && !prefix && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            {icon}
          </span>
        )}
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={placeholder}
          className={cn(
            "focus-visible:ring-brand-cyan/40 h-10 rounded-xl tabular-nums",
            (prefix ?? icon) && "pl-9",
          )}
        />
      </div>
    </div>
  )
}

function PrizeTableEditor({
  table,
  onChange,
  label = "Distribuição por Posição",
  hint,
  numericPositions = false,
}: {
  table: Record<string, number>
  onChange: (table: Record<string, number>) => void
  label?: string
  hint?: React.ReactNode
  /** Posições sempre numéricas: ordena por número e nunca duplica ao adicionar. */
  numericPositions?: boolean
}) {
  const entries = numericPositions
    ? Object.entries(table).sort(([a], [b]) => Number(a) - Number(b))
    : Object.entries(table)

  const addPosition = () => {
    if (!numericPositions) {
      onChange({ ...table, [String(Object.keys(table).length + 1)]: 0 })
      return
    }
    const positions = Object.keys(table)
      .map(Number)
      .filter((position) => Number.isFinite(position))
    const next = (positions.length > 0 ? Math.max(...positions) : 0) + 1
    onChange({ ...table, [String(next)]: 0 })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Label className="text-xs font-semibold">{label}</Label>
        {hint}
      </div>
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
        {entries.map(([position, value]) => (
          <div key={position} className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-border/70 bg-muted/40 w-14 shrink-0 justify-center rounded-lg font-mono text-xs"
            >
              {position}º
            </Badge>
            <div className="relative flex-1">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs font-bold">
                R$
              </span>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(e) => {
                  const parsed = Number(e.target.value)
                  const next = { ...table }
                  next[position] = Number.isFinite(parsed)
                    ? Math.max(0, parsed)
                    : 0
                  onChange(next)
                }}
                className="focus-visible:ring-brand-cyan/40 h-9 rounded-lg pl-9 text-sm tabular-nums"
                aria-label={`Prêmio da posição ${position}`}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const next = { ...table }
                delete next[position]
                onChange(next)
              }}
              aria-label={`Remover posição ${position}`}
              className="text-muted-foreground flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              <Minus className="size-4" weight="bold" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addPosition}
        className="border-border/70 text-muted-foreground hover:border-brand-cyan/40 hover:text-foreground not-dark:hover:border-primary/40 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs font-semibold transition-colors"
      >
        <Plus className="size-3.5" weight="bold" />
        Adicionar Posição
      </button>
    </div>
  )
}

function SettingRow({
  icon,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <label className="hover:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded-xl p-2.5 transition-colors sm:p-3">
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            checked
              ? "bg-brand-cyan/10 text-brand-mint not-dark:bg-primary/10 not-dark:text-primary"
              : "bg-muted/60 text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {hint}
          </span>
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  )
}

function SummaryRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end text-right">
        {children}
      </dd>
    </div>
  )
}
